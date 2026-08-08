import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import type { ExpoSpeechRecognitionErrorEvent } from 'expo-speech-recognition';
import { parseVoiceIntent } from '../services/voiceIntentService';
import type { VoiceIntent } from '../services/voiceIntentService';

const SHEET_MAX_HEIGHT = 500;

type Status = 'idle' | 'listening' | 'processing' | 'error';

type LangKey = 'bn-BD' | 'en-US';

const LANGUAGES: { key: LangKey; label: string }[] = [
  { key: 'bn-BD', label: 'বাংলা' },
  { key: 'en-US', label: 'English' },
];

const friendlyError = (err: ExpoSpeechRecognitionErrorEvent) => {
  switch (err.error) {
    case 'not-allowed':
      return 'Microphone permission denied. Enable it in Settings to use voice entry.';
    case 'audio-capture':
      return 'Could not access the microphone. Check your permissions in Settings.';
    case 'no-speech':
    case 'speech-timeout':
      return 'Could not understand that. Please speak more clearly and try again.';
    case 'language-not-supported':
      return 'This language is not supported on your device. Try switching to English.';
    case 'busy':
      return 'Speech recognition is busy. Wait a moment and try again.';
    case 'network':
      return 'Speech recognition needs a network connection. Check your connection and try again.';
    case 'service-not-allowed':
      return 'Speech recognition is not available on this device.';
    default:
      return err.message || 'Speech recognition failed. Please try again.';
  }
};

export default function VoiceEntryModal({
  visible,
  onClose,
  onIntent,
}: {
  visible: boolean;
  onClose: () => void;
  onIntent: (intent: VoiceIntent) => void;
}) {
  const insets = useSafeAreaInsets();

  const [lang, setLang] = useState<LangKey>('bn-BD');
  const [status, setStatus] = useState<Status>('idle');
  const [partialText, setPartialText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const translateY = useRef(new Animated.Value(SHEET_MAX_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  const transcriptRef = useRef('');
  const finalizeRef = useRef(false);
  const langRef = useRef(lang);
  const onIntentRef = useRef(onIntent);
  const visibleRef = useRef(visible);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  useEffect(() => {
    onIntentRef.current = onIntent;
  }, [onIntent]);

  useEffect(() => {
    if (visible) {
      setLang('bn-BD');
      setStatus('idle');
      setPartialText('');
      setErrorMsg(null);
      transcriptRef.current = '';
      finalizeRef.current = false;

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateY.setValue(SHEET_MAX_HEIGHT);
      backdropOpacity.setValue(0);
      finalizeRef.current = false;
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {}
    }
  }, [visible, translateY, backdropOpacity]);

  // Pulsing ring on the mic button while actively listening.
  useEffect(() => {
    if (!visible || status !== 'listening') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, status, pulse]);

  const finalize = async () => {
    if (finalizeRef.current) return;
    const text = transcriptRef.current.trim();
    if (!text) {
      setStatus('idle');
      setErrorMsg('No speech detected. Tap the mic and try again.');
      return;
    }

    finalizeRef.current = true;
    setStatus('processing');

    try {
      const intent = await parseVoiceIntent(text);
      if (intent.action === 'UNKNOWN') {
        finalizeRef.current = false;
        setStatus('error');
        setErrorMsg('Could not understand command. Try: "Spent 500 on food"');
        return;
      }
      onIntentRef.current(intent);
    } catch (err) {
      finalizeRef.current = false;
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Could not process that request.');
    }
  };

  // Listen for recognition events. Handlers only touch stable refs + state setters.
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript ?? '';
    transcriptRef.current = text;
    setPartialText(text);
    if (event.isFinal && !finalizeRef.current) {
      setStatus('processing');
      finalize();
    }
  });

  useSpeechRecognitionEvent('nomatch', () => {
    if (!visibleRef.current || finalizeRef.current) return;
    setStatus('idle');
    setErrorMsg('Could not understand that. Please speak more clearly and try again.');
  });

  useSpeechRecognitionEvent('end', () => {
    if (!visibleRef.current || finalizeRef.current) return;
    if (transcriptRef.current.trim()) {
      setStatus('processing');
      finalize();
    } else {
      setStatus('idle');
      setErrorMsg('No speech detected. Tap the mic and try again.');
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (!visibleRef.current || finalizeRef.current) return;
    if (event.error === 'aborted') return;
    setStatus('error');
    setErrorMsg(friendlyError(event));
  });

  const startListening = async () => {
    setErrorMsg(null);
    setPartialText('');
    transcriptRef.current = '';
    finalizeRef.current = false;

    let permission;
    try {
      permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    } catch (err) {
      setStatus('error');
      setErrorMsg('Could not request microphone access. Please try again.');
      console.error('Microphone permission request failed:', err);
      return;
    }
    if (!permission.granted) {
      setStatus('error');
      setErrorMsg(
        'Microphone permission is required for voice entry. Enable it in Settings to try again.'
      );
      return;
    }

    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setStatus('error');
      setErrorMsg('Speech recognition is not available on this device.');
      return;
    }

    setStatus('listening');

    try {
      ExpoSpeechRecognitionModule.start({
        lang: langRef.current,
        interimResults: true,
        continuous: false,
      });
    } catch (err) {
      setStatus('error');
      setErrorMsg('Could not start the microphone. Please try again.');
      console.error('Speech recognition start failed:', err);
    }
  };

  const stopListening = () => {
    setStatus('processing');
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (err) {
      finalizeRef.current = false;
      setStatus('idle');
      setErrorMsg('Speech recognition stopped unexpectedly.');
      console.error('Speech recognition stop failed:', err);
    }
  };

  const handleMicPress = () => {
    if (status === 'listening') stopListening();
    else if (status === 'idle' || status === 'error') startListening();
  };

  const handleClose = () => {
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {}
    finalizeRef.current = false;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SHEET_MAX_HEIGHT,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(onClose);
  };

  const isListening = status === 'listening';
  const isProcessing = status === 'processing';
  const micDisabled = isProcessing;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <TouchableOpacity
            style={styles.backdropTouchable}
            activeOpacity={1}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Dismiss Voice Entry"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY }] },
          ]}
        >
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Voice Entry</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close Voice Entry"
            >
              <Ionicons name="close" size={22} color="#091E15" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View style={styles.body}>
            <Animated.View
              style={[
                styles.micOuter,
                isListening && styles.micOuterActive,
                { transform: [{ scale: pulse }] },
              ]}
            >
              {isProcessing ? (
                <View style={styles.micButton}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.micButton, isListening && styles.micButtonActive]}
                  onPress={handleMicPress}
                  disabled={micDisabled}
                  accessibilityRole="button"
                  accessibilityState={{ busy: isProcessing }}
                  accessibilityLabel={
                    isListening ? 'Stop recording' : 'Start voice recording'
                  }
                >
                  <Ionicons
                    name={isListening ? 'stop' : 'mic'}
                    size={40}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              )}
            </Animated.View>

            {/* Transcript / status area */}
            <View style={styles.statusArea}>
              {isProcessing ? (
                <>
                  {partialText ? (
                    <Text style={styles.partialText}>{partialText}</Text>
                  ) : null}
                  <Text style={styles.processingText}>
                    Understanding your request...
                  </Text>
                </>
              ) : isListening ? (
                <>
                  <Text style={styles.partialText}>
                    {partialText || 'Listening...'}
                  </Text>
                  <Text style={styles.hint}>Tap the button when you are done</Text>
                </>
              ) : (
                <>
                  <Text style={styles.instruction}>
                    Tap the mic and speak your expense or income
                  </Text>
                  <Text style={styles.hint}>
                    Example: {"Spent 500 taka on food"} or {"Received 10000 salary"}
                  </Text>
                </>
              )}
            </View>

            {errorMsg && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {/* Language picker */}
            <View style={styles.langRow}>
              {LANGUAGES.map((item) => {
                const isActive = lang === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.langChip,
                      isActive && styles.langChipActive,
                      isProcessing && styles.langChipDisabled,
                    ]}
                    onPress={() => setLang(item.key)}
                    disabled={isProcessing}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={`Language ${item.label}`}
                  >
                    <Text
                      style={[
                        styles.langChipText,
                        isActive && styles.langChipTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropTouchable: {
    flex: 1,
    backgroundColor: 'rgba(8, 30, 21, 0.55)',
  },
  sheet: {
    maxHeight: SHEET_MAX_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    flex: 1,
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    color: '#091E15',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 16,
  },
  micOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1FAE5',
    marginBottom: 20,
  },
  micOuterActive: {
    backgroundColor: '#FEE2E2',
  },
  micButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#0FB384',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0FB384',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  micButtonActive: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  statusArea: {
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    marginBottom: 4,
  },
  instruction: {
    fontSize: 16,
    fontWeight: '500',
    color: '#091E15',
    textAlign: 'center',
    marginBottom: 8,
  },
  partialText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    color: '#091E15',
    textAlign: 'center',
    marginBottom: 6,
  },
  processingText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'center',
  },
  hint: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#94A3B8',
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignSelf: 'stretch',
  },
  errorText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#DC2626',
    textAlign: 'center',
  },
  langRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  langChip: {
    paddingHorizontal: 20,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langChipActive: {
    backgroundColor: '#E8F7F1',
    borderColor: '#0FB384',
  },
  langChipDisabled: {
    opacity: 0.5,
  },
  langChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
  },
  langChipTextActive: {
    color: '#0FB384',
    fontWeight: '600',
  },
});
