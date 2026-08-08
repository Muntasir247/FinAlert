import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { FlashMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useTransactions } from '../context/TransactionsContext';
import { parseReceiptFromImage } from '../services/receiptIntentService';
import type { ReceiptData } from '../services/receiptIntentService';

const CORNER_GREEN = '#0FB384';

type Status = 'camera' | 'processing' | 'review' | 'success';

const FLASH_ICONS: Record<FlashMode, keyof typeof Ionicons.glyphMap> = {
  off: 'flash-outline',
  on: 'flash',
  auto: 'flash-outline',
};

const todayIso = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

function CornerBracket({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const base = {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: CORNER_GREEN,
    borderWidth: 3,
  } as const;

  const positions: Record<string, object> = {
    tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
    tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
    bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
    br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  };

  return <View style={[base, positions[position]]} />;
}

export default function ScanInvoiceModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { addTransaction } = useTransactions();

  const [permission, requestPermission] = useCameraPermissions();

  const cameraRef = useRef<CameraView>(null);

  const [status, setStatus] = useState<Status>('camera');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [adding, setAdding] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (visible) {
      setStatus('camera');
      setFlash('off');
      setErrorMsg(null);
      setReceipt(null);
      setSelected([]);
      setAdding(false);
      setAddedCount(0);
    }
  }, [visible]);

  const processImage = async (base64: string, mimeType: string) => {
    setStatus('processing');
    setErrorMsg(null);
    try {
      const parsed = await parseReceiptFromImage(base64, mimeType);
      setReceipt(parsed);
      setSelected(parsed.items.map(() => true));
      setStatus('review');
    } catch (err) {
      setStatus('camera');
      setErrorMsg(err instanceof Error ? err.message : 'Could not process that receipt.');
    }
  };

  const handleCapture = async () => {
    if (status !== 'camera' || !permission?.granted) return;
    setErrorMsg(null);
    let photo;
    try {
      photo = await cameraRef.current?.takePictureAsync({ quality: 0.7, base64: true });
    } catch (err) {
      console.error('Receipt capture failed:', err);
      setErrorMsg('Could not take a photo. Please try again.');
      return;
    }
    if (!photo?.base64) {
      setErrorMsg('Could not read the captured image. Please try again.');
      return;
    }
    await processImage(photo.base64, 'image/jpeg');
  };

  const handlePickImage = async () => {
    if (status !== 'camera') return;
    setErrorMsg(null);
    let permissionResult;
    try {
      permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    } catch (err) {
      console.error('Photo library permission failed:', err);
      setErrorMsg('Could not access your photo library. Please try again.');
      return;
    }
    if (!permissionResult.granted) {
      setErrorMsg(
        'Photo library access is required to import a receipt. Enable it in Settings to try again.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) {
      setErrorMsg('Could not read that image. Please try another one.');
      return;
    }
    await processImage(asset.base64, asset.mimeType ?? 'image/jpeg');
  };

  const toggleItem = (index: number) => {
    if (adding) return;
    setSelected((prev) => prev.map((value, i) => (i === index ? !value : value)));
  };

  const backToCamera = () => {
    setStatus('camera');
    setReceipt(null);
    setSelected([]);
    setErrorMsg(null);
  };

  const handleAdd = async () => {
    if (!receipt || adding) return;
    const chosen = receipt.items
      .map((item, index) => ({ item, index }))
      .filter(({ index }) => selected[index]);
    if (chosen.length === 0) return;

    setAdding(true);
    setErrorMsg(null);
    const date = receipt.date ?? todayIso();
    let failures = 0;

    for (const { item } of chosen) {
      const { error } = await addTransaction({
        type: 'expense',
        amount: item.price,
        category: receipt.category,
        description: item.name,
        date,
      });
      if (error) {
        failures += 1;
        console.error('Add scanned expense failed:', error);
      }
    }

    setAdding(false);
    if (failures > 0) {
      setErrorMsg(
        `Could not save ${failures} expense${failures > 1 ? 's' : ''}. Please try again.`
      );
      return;
    }
    setAddedCount(chosen.length);
    setStatus('success');
  };

  const handleClose = () => {
    if (statusRef.current === 'processing') return;
    onClose();
  };

  const handleRequestClose = () => {
    if (statusRef.current === 'processing') return;
    if (statusRef.current === 'review' || statusRef.current === 'success') {
      backToCamera();
      return;
    }
    onClose();
  };

  const selectedCount = selected.filter(Boolean).length;
  const isCameraReady = permission?.granted ?? false;

  const renderPermission = () => (
    <View style={styles.permissionRoot}>
      <TouchableOpacity
        style={styles.permissionClose}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close Scan Invoice"
      >
        <Ionicons name="close" size={26} color="#FFFFFF" />
      </TouchableOpacity>
      <View style={styles.permissionIconBox}>
        <Ionicons name="camera-outline" size={48} color={CORNER_GREEN} />
      </View>
      <Text style={styles.permissionTitle}>Camera access needed</Text>
      <Text style={styles.permissionBody}>
        FinAlert uses your camera to scan receipts and automatically add expenses.
      </Text>
      <TouchableOpacity
        style={styles.permissionButton}
        onPress={requestPermission}
        accessibilityRole="button"
        accessibilityLabel="Grant camera access"
      >
        <Text style={styles.permissionButtonText}>Grant camera access</Text>
      </TouchableOpacity>
      {permission && !permission.canAskAgain && (
        <TouchableOpacity
          onPress={() => Linking.openSettings()}
          accessibilityRole="button"
          accessibilityLabel="Open Settings"
        >
          <Text style={styles.settingsLink}>Open Settings</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderCamera = () => (
    <View style={styles.cameraShell}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        flash={flash}
      />

      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity
          style={styles.topBarButton}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close Scan Invoice"
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Scan Receipt</Text>
        <TouchableOpacity
          style={styles.topBarButton}
          onPress={() =>
            setFlash((prev) => (prev === 'off' ? 'on' : prev === 'on' ? 'auto' : 'off'))
          }
          accessibilityRole="button"
          accessibilityLabel="Toggle flash"
        >
          <Ionicons name={FLASH_ICONS[flash]} size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View pointerEvents="none" style={styles.viewfinderWrap}>
        <View style={styles.viewfinder}>
          <View style={styles.viewfinderBg} />
          <CornerBracket position="tl" />
          <CornerBracket position="tr" />
          <CornerBracket position="bl" />
          <CornerBracket position="br" />
        </View>
        <Text style={styles.hint}>Align the receipt within the frame</Text>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={styles.sideButton}
          onPress={handlePickImage}
          accessibilityRole="button"
          accessibilityLabel="Pick a receipt image from gallery"
        >
          <Ionicons name="images-outline" size={22} color="#FFFFFF" />
          <Text style={styles.sideButtonText}>Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.captureButton}
          onPress={handleCapture}
          accessibilityRole="button"
          accessibilityLabel="Capture receipt"
        >
          <Ionicons name="scan-outline" size={32} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.sideButton} />
      </View>

      {status === 'processing' && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.processingText}>Reading your receipt...</Text>
        </View>
      )}

      {errorMsg && status === 'camera' && (
        <View style={[styles.cameraErrorBanner, { bottom: Math.max(insets.bottom, 16) + 96 }]}>
          <Text style={styles.cameraErrorText}>{errorMsg}</Text>
        </View>
      )}
    </View>
  );

  const renderReview = () => {
    if (!receipt) return null;
    return (
      <View style={styles.lightRoot}>
        <View style={[styles.reviewHeader, { paddingTop: Math.max(insets.top, 12) }]}>
          <View style={styles.reviewHeaderText}>
            <Text style={styles.reviewTitle}>Review Expenses</Text>
            <Text style={styles.reviewSubtitle} numberOfLines={1}>
              {receipt.merchant || 'Receipt'}
              {receipt.date ? ` · ${receipt.date}` : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.reviewClose}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close Scan Invoice"
          >
            <Ionicons name="close" size={22} color="#091E15" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.reviewList}
          contentContainerStyle={styles.reviewListContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.reviewSummaryRow}>
            <Text style={styles.reviewSummaryLabel}>Total</Text>
            <Text style={styles.reviewSummaryTotal}>৳{receipt.total.toLocaleString()}</Text>
          </View>
          {receipt.items.map((item, index) => {
            const isSelected = selected[index] ?? false;
            return (
              <TouchableOpacity
                key={`${index}-${item.name}`}
                style={[styles.itemRow, isSelected && styles.itemRowSelected]}
                onPress={() => toggleItem(index)}
                disabled={adding}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={`Add ${item.name} for ${item.price} taka`}
              >
                <Ionicons
                  name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={isSelected ? CORNER_GREEN : '#CBD5E1'}
                />
                <View style={styles.itemTextArea}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemCategory}>{receipt.category}</Text>
                </View>
                <Text style={styles.itemPrice}>৳{item.price.toLocaleString()}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {errorMsg && (
          <View style={[styles.reviewErrorBox, { paddingBottom: Math.max(insets.bottom, 16) + 76 }]}>
            <Text style={styles.reviewErrorText}>{errorMsg}</Text>
          </View>
        )}

        <View style={[styles.reviewFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={styles.rescanButton}
            onPress={backToCamera}
            disabled={adding}
            accessibilityRole="button"
            accessibilityLabel="Scan another receipt"
          >
            <Ionicons name="refresh" size={18} color="#334155" />
            <Text style={styles.rescanButtonText}>Rescan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addButton, selectedCount === 0 && styles.addButtonDisabled]}
            onPress={handleAdd}
            disabled={selectedCount === 0 || adding}
            accessibilityRole="button"
            accessibilityState={{ busy: adding }}
            accessibilityLabel={`Add ${selectedCount} expenses`}
          >
            {adding ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.addButtonText}>
                {selectedCount > 0 ? `Add ${selectedCount} Expense${selectedCount > 1 ? 's' : ''}` : 'Select Items'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSuccess = () => (
    <View style={styles.lightRoot}>
      <View style={styles.successContent}>
        <View style={styles.successIconBox}>
          <Ionicons name="checkmark-circle" size={72} color={CORNER_GREEN} />
        </View>
        <Text style={styles.successTitle}>
          {addedCount} expense{addedCount > 1 ? 's' : ''} added
        </Text>
        <Text style={styles.successSubtitle}>Your scanned receipt has been saved.</Text>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.scanAnotherButton}
          onPress={backToCamera}
          accessibilityRole="button"
          accessibilityLabel="Scan another receipt"
        >
          <Text style={styles.scanAnotherText}>Scan another receipt</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleRequestClose}
      statusBarTranslucent
    >
      {!permission ? (
        <View style={styles.permissionRoot}>
          <ActivityIndicator size="large" color={CORNER_GREEN} />
        </View>
      ) : !permission.granted ? (
        renderPermission()
      ) : status === 'review' ? (
        renderReview()
      ) : status === 'success' ? (
        renderSuccess()
      ) : (
        renderCamera()
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Shared roots
  lightRoot: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Permission
  permissionRoot: {
    flex: 1,
    backgroundColor: '#0B0E14',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  permissionClose: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionIconBox: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(15, 179, 132, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  permissionBody: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    color: '#A1A1AA',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  permissionButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: CORNER_GREEN,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  settingsLink: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0FB384',
    marginTop: 20,
    textDecorationLine: 'underline',
  },

  // Camera
  cameraShell: {
    flex: 1,
    backgroundColor: '#0B0E14',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  topBarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  viewfinderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinder: {
    width: 264,
    height: 264,
    borderRadius: 16,
  },
  viewfinderBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(15, 179, 132, 0.35)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    color: '#D1D5DB',
    marginTop: 28,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  sideButton: {
    width: 72,
    alignItems: 'center',
    gap: 6,
  },
  sideButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: CORNER_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: CORNER_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  processingText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  cameraErrorBanner: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(220, 38, 38, 0.95)',
    borderRadius: 12,
    padding: 12,
  },
  cameraErrorText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  // Review
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  reviewHeaderText: {
    flex: 1,
    marginRight: 12,
  },
  reviewTitle: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    color: '#091E15',
  },
  reviewSubtitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: '#6B7280',
    marginTop: 2,
  },
  reviewClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewList: {
    flex: 1,
  },
  reviewListContent: {
    padding: 16,
    gap: 10,
  },
  reviewSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E8F7F1',
    borderRadius: 12,
    padding: 14,
    marginBottom: 4,
  },
  reviewSummaryLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0F6B4E',
  },
  reviewSummaryTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#091E15',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 10,
  },
  itemRowSelected: {
    borderColor: CORNER_GREEN,
    backgroundColor: '#F0FDF9',
  },
  itemTextArea: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: '#091E15',
  },
  itemCategory: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '400',
    color: '#94A3B8',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#091E15',
  },
  reviewErrorBox: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
  },
  reviewErrorText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: '#DC2626',
    textAlign: 'center',
  },
  reviewFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 18,
  },
  rescanButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
  },
  addButton: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: CORNER_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Success
  successContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  successIconBox: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#E8F7F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    color: '#091E15',
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 28,
  },
  doneButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: CORNER_GREEN,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scanAnotherButton: {
    marginTop: 14,
    paddingVertical: 12,
  },
  scanAnotherText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0FB384',
  },
});
