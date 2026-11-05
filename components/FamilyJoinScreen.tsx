import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useFamily } from '../context/FamilyContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

export default function FamilyJoinScreen() {
  const { joinFamily, createFamily } = useFamily();
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const isBangla = language === 'bn';
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length === 0) {
      setErrorMsg('Enter the invite code shared by your family member.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const { error } = await joinFamily(trimmed);
      if (error) {
        setErrorMsg(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setErrorMsg('Enter a name for your family group.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const { error } = await createFamily(trimmed);
      if (error) {
        setErrorMsg(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (next: 'join' | 'create') => {
    setMode(next);
    setErrorMsg(null);
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.iconCircle, isDark && { backgroundColor: '#14382A' }]}>
        <Ionicons name="people" size={32} color="#0FB384" />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>
        {mode === 'join'
          ? (isBangla ? 'পারিবারিক গ্রুপে যুক্ত হন' : 'Join a Family Group')
          : (isBangla ? 'নতুন পরিবার তৈরি করুন' : 'Create a New Family')}
      </Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {mode === 'join'
          ? (isBangla ? 'যোগ দিতে আপনার পরিবারের সদস্যের শেয়ার করা আমন্ত্রণ কোডটি লিখুন।' : 'Enter the invite code shared by your family member to join.')
          : (isBangla ? 'আপনার পরিবারের জন্য একটি অনন্য গ্রুপ তৈরি করুন।' : 'Create a unique group for your family.')}
      </Text>

      {mode === 'join' ? (
        <>
          <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
            <Feather name="hash" size={18} color="#0FB384" />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={code}
              onChangeText={(text) => {
                setCode(text);
                setErrorMsg(null);
              }}
              placeholder="FAMS-XXXX"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={9}
              editable={!submitting}
              accessibilityLabel="Family invite code"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
            onPress={handleJoin}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Join Family"
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isBangla ? 'পরিবারে যুক্ত হন' : 'Join Family'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>
              {isBangla ? 'অথবা' : 'or'}
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: isDark ? colors.surfaceSubtle : '#FFFFFF' }]}
            onPress={() => switchMode('create')}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Create a new family group"
          >
            <Ionicons name="add-circle-outline" size={18} color="#0FB384" />
            <Text style={styles.secondaryButtonText}>
              {isBangla ? 'নতুন পরিবার তৈরি করুন' : 'Create a new family'}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
            <Feather name="users" size={18} color="#0FB384" />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={name}
              onChangeText={(text) => {
                setName(text);
                setErrorMsg(null);
              }}
              placeholder={isBangla ? 'পরিবারের নাম (যেমন: আমাদের পরিবার)' : 'Family name (e.g., My Family)'}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!submitting}
              accessibilityLabel="Family name"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
            onPress={handleCreate}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Create Family"
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isBangla ? 'পরিবার তৈরি করুন' : 'Create Family'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backLink}
            onPress={() => switchMode('join')}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Back to join with a code"
          >
            <Feather name="arrow-left" size={16} color="#0FB384" />
            <Text style={styles.secondaryButtonText}>
              {isBangla ? 'যোগদানে ফিরুন' : 'Back to join'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {errorMsg && (
        <View style={[styles.errorBox, isDark && { backgroundColor: '#3B1828', borderColor: '#BE185D' }]}>
          <Text style={[styles.errorText, isDark && { color: '#FCA5A5' }]}>{errorMsg}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E8F7F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    color: '#091E15',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 52,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#091E15',
    padding: 0,
    letterSpacing: 1,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0FB384',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#94A3B8',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    paddingHorizontal: 24,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#0FB384',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0FB384',
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    marginTop: 8,
  },
  errorBox: {
    width: '100%',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginTop: 20,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#DC2626',
    textAlign: 'center',
  },
});
