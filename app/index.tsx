import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { useRouter } from 'expo-router';

// Keep the native splash visible until our animation is ready to start
SplashScreen.preventAutoHideAsync();

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // --- Screen state: 'welcome' | 'login' ---
  const [screen, setScreen] = useState<'welcome' | 'login'>('welcome');

  // --- Login form state ---
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);

  // --- Forgot Password modal state ---
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const openForgotModal = () => {
    setResetEmail('');
    setResetSent(false);
    setForgotModalVisible(true);
  };

  const closeForgotModal = () => {
    setForgotModalVisible(false);
    setResetEmail('');
    setResetSent(false);
  };

  const handleSendReset = () => {
    if (resetEmail.trim().length === 0) return;
    setResetSent(true);
  };

  // --- Reanimated shared values ---
  // Logo fades + slides up from below
  const logoOpacity = useSharedValue(0);
  const logoTranslateY = useSharedValue(24);
  // Title fades in slightly after logo
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(16);
  // Subtitle/paragraph fades in after title
  const subtextOpacity = useSharedValue(0);
  // Buttons slide in from bottom last
  const buttonsOpacity = useSharedValue(0);
  const buttonsTranslateY = useSharedValue(32);

  useEffect(() => {
    const easing = Easing.out(Easing.cubic);

    // Hold the native splash (1-A green screen) for 2500ms so it is
    // clearly visible, then hide it and immediately begin the 1-B entry.
    const splashTimer = setTimeout(async () => {
      await SplashScreen.hideAsync();

      // Staggered orchestration: logo → title → subtext → buttons
      logoOpacity.value = withDelay(60, withTiming(1, { duration: 520, easing }));
      logoTranslateY.value = withDelay(60, withTiming(0, { duration: 480, easing }));

      titleOpacity.value = withDelay(220, withTiming(1, { duration: 420, easing }));
      titleTranslateY.value = withDelay(220, withTiming(0, { duration: 380, easing }));

      subtextOpacity.value = withDelay(360, withTiming(1, { duration: 380, easing }));

      buttonsOpacity.value = withDelay(480, withTiming(1, { duration: 480, easing }));
      buttonsTranslateY.value = withDelay(480, withTiming(0, { duration: 440, easing }));
    }, 2500);

    return () => clearTimeout(splashTimer);
  }, []);

  // --- Animated styles ---
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateY: logoTranslateY.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const subtextStyle = useAnimatedStyle(() => ({
    opacity: subtextOpacity.value,
  }));

  const buttonsStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
    transform: [{ translateY: buttonsTranslateY.value }],
  }));

  // --- Handlers ---
  const handleLogin = () => {
    // Bypass authentication: navigate directly to main tabs
    router.replace('/(tabs)');
  };

  // ── Login Screen ──────────────────────────────────────────────────────────
  if (screen === 'login') {
    return (
      <KeyboardAvoidingView
        style={[styles.root, { paddingTop: insets.top, paddingHorizontal: 0, alignItems: 'stretch' }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.loginScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Language Selector (top-right floating button) ── */}
          <View style={styles.loginTopRow}>
            <View style={styles.spacer} />
            <TouchableOpacity
              style={styles.langButton}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Select language"
            >
              <Ionicons name="globe-outline" size={16} color="#091E15" style={{ marginRight: 5 }} />
              {/* Subtext token: text-[14px] font-normal */}
              <Text style={styles.langText}>English</Text>
            </TouchableOpacity>
          </View>

          {/* ── Branding ── */}
          <View style={styles.loginBrandBlock}>
            <View style={styles.loginLogoWrapper}>
              <Image
                source={require('../assets/images/logo.png')}
                style={styles.loginLogo}
                resizeMode="contain"
              />
            </View>
            {/* Title token: text-[20px] leading-[22px] font-bold */}
            <Text style={styles.loginBrandTitle}>FinAlert</Text>
            {/* Subtext token: text-[14px] font-normal */}
            <Text style={styles.loginBrandSubtext}>Smart Finance for Smart Families</Text>
          </View>

          {/* ── Tab Segment Control ── */}
          <View style={styles.tabBar}>
            {/* Active: Login — underlined with mainTheme green */}
            <View style={styles.tabItemActive}>
              {/* Subtitle token: text-[16px] font-medium */}
              <Text style={styles.tabLabelActive}>Login</Text>
              <View style={styles.tabUnderline} />
            </View>
            {/* Inactive: Sign Up */}
            <TouchableOpacity
              style={styles.tabItemInactive}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityLabel="Sign Up tab"
            >
              {/* Subtitle token: text-[16px] font-medium */}
              <Text style={styles.tabLabelInactive}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          {/* ── Form ── */}
          <View style={styles.formContainer}>

            {/* Email / Phone Field */}
            <View style={styles.inputGroup}>
              {/* Subtext token: text-[14px] font-normal */}
              <Text style={styles.inputLabel}>Email / Phone</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Email or phone"
                  placeholderTextColor="#A0ADB6"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={emailOrPhone}
                  onChangeText={setEmailOrPhone}
                  accessibilityLabel="Email or phone input"
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.inputGroup}>
              {/* Subtext token: text-[14px] font-normal */}
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.textInput, styles.textInputPassword]}
                  placeholder="Password"
                  placeholderTextColor="#A0ADB6"
                  secureTextEntry={!passwordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={password}
                  onChangeText={setPassword}
                  accessibilityLabel="Password input"
                />
                <TouchableOpacity
                  style={styles.visibilityToggle}
                  onPress={() => setPasswordVisible(prev => !prev)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                >
                  <Ionicons
                    name={passwordVisible ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot Password? — right-aligned, primary green token */}
            <TouchableOpacity
              style={styles.forgotRow}
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel="Forgot password"
              onPress={openForgotModal}
            >
              {/* Subtext token: text-[14px] font-normal */}
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login Button — Button grad token (#0FB384), bold white label */}
            <LinearGradient
              colors={['#02C78E', '#0FB384']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.loginButtonGradient}
            >
              <TouchableOpacity
                style={styles.loginButtonInner}
                onPress={handleLogin}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel="Login"
              >
                {/* Subtitle token elevated to bold per spec */}
                <Text style={styles.loginButtonLabel}>Login</Text>
              </TouchableOpacity>
            </LinearGradient>

            {/* Footer text — centered */}
            <View style={styles.footerRow}>
              {/* Paragraph token: text-[13px] leading-[15px] font-normal */}
              <Text style={styles.footerText}>Don't have an account? </Text>
              {/* Subtitle token: text-[16px] font-medium */}
              <Text style={styles.footerLink}>Create Account</Text>
            </View>

          </View>
        </ScrollView>

        {/* ── Forgot Password Modal ── */}
        <Modal
          visible={forgotModalVisible}
          transparent
          animationType="fade"
          onRequestClose={closeForgotModal}
          statusBarTranslucent
        >
          {/* Semi-transparent dark backdrop */}
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>

              {/* Header row: title + close button */}
              <View style={styles.modalHeader}>
                {/* Title token: text-[20px] leading-[22px] font-bold */}
                <Text style={styles.modalTitle}>Reset Password</Text>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={closeForgotModal}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Close modal"
                >
                  <Ionicons name="close" size={18} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {resetSent ? (
                /* ── State 3: Success Confirmation ── */
                <View style={styles.modalBody}>
                  {/* Checkmark icon in light-green circle */}
                  <View style={styles.modalIconCircle}>
                    <Ionicons name="checkmark-circle-outline" size={36} color="#0FB384" />
                  </View>

                  {/* Title token: text-[20px] font-bold */}
                  <Text style={styles.successTitle}>Check your email!</Text>

                  {/* Paragraph token: text-[13px] leading-[15px] font-normal */}
                  <Text style={styles.successBody}>
                    We've sent a password reset link to {resetEmail}
                  </Text>

                  {/* Back to Login — full-width primary green button */}
                  <TouchableOpacity
                    style={styles.resetBtn}
                    onPress={closeForgotModal}
                    activeOpacity={0.82}
                    accessibilityRole="button"
                    accessibilityLabel="Back to login"
                  >
                    {/* Subtitle token elevated to bold white */}
                    <Text style={styles.resetBtnLabel}>Back to Login</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* ── State 1 & 2: Input form ── */
                <View style={styles.modalBody}>
                  {/* Envelope icon in light-green rounded box */}
                  <View style={styles.modalIconCircle}>
                    <Ionicons name="mail-outline" size={32} color="#0FB384" />
                  </View>

                  {/* Paragraph token: text-[13px] leading-[15px] font-normal */}
                  <Text style={styles.modalInstructions}>
                    Enter your registered email address. We'll send you a link to reset your password.
                  </Text>

                  {/* Email Address label + input */}
                  <View style={styles.inputGroup}>
                    {/* Subtext token: text-[14px] font-normal */}
                    <Text style={styles.inputLabel}>Email Address</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.textInput}
                        placeholder="Enter your email"
                        placeholderTextColor="#A0ADB6"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        value={resetEmail}
                        onChangeText={setResetEmail}
                        accessibilityLabel="Reset email input"
                      />
                    </View>
                  </View>

                  {/* Send Reset Link button — inactive (gray) when empty, green when has text */}
                  <TouchableOpacity
                    style={[
                      styles.resetBtn,
                      resetEmail.trim().length === 0 && styles.resetBtnDisabled,
                    ]}
                    onPress={handleSendReset}
                    activeOpacity={resetEmail.trim().length === 0 ? 1 : 0.82}
                    accessibilityRole="button"
                    accessibilityLabel="Send reset link"
                  >
                    {/* Subtitle token elevated to bold white */}
                    <Text style={styles.resetBtnLabel}>Send Reset Link</Text>
                  </TouchableOpacity>
                </View>
              )}

            </View>
          </View>
        </Modal>

      </KeyboardAvoidingView>
    );
  }

  // ── Welcome Screen ────────────────────────────────────────────────────────
  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      {/* ── Branding block — vertically centered ── */}
      <View style={styles.brandBlock}>

        {/* Logo — dark variant (navy circular mark on light bg) */}
        <Animated.View style={[styles.logoWrapper, logoStyle]}>
          <Image
            source={require('../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        {/* App name — Title token: text-[20px] leading-[22px] font-bold / light-bg-text */}
        <Animated.Text style={[styles.title, titleStyle]}>
          FinAlert
        </Animated.Text>

        {/* Subtext — Paragraph token: text-[13px] leading-[15px] font-normal / light-bg-shade */}
        <Animated.Text style={[styles.paragraph, subtextStyle]}>
          Smart Finance for Smart Families
        </Animated.Text>

      </View>

      {/* ── CTA buttons — pinned to bottom ── */}
      <Animated.View
        style={[
          styles.buttonsContainer,
          { paddingBottom: insets.bottom > 0 ? 0 : 16 },
          buttonsStyle,
        ]}
      >
        {/* Log In — Button grad: mint gradient, white subtitle-weight label */}
        <LinearGradient
          colors={['#02C78E', '#0FB384']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.loginGradient}
        >
          <TouchableOpacity
            style={styles.buttonInner}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Log In"
            onPress={() => setScreen('login')}
          >
            {/* Subtitle token weight for button labels */}
            <Text style={styles.loginLabel}>Log In</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Sign Up — Light Green accent bg, main-theme tint, subtitle-weight label */}
        <TouchableOpacity
          style={styles.signupButton}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="Sign Up"
        >
          <Text style={styles.signupLabel}>Sign Up</Text>
        </TouchableOpacity>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Root ──────────────────────────────────────────────
  root: {
    flex: 1,
    // Token: Background Green White and Letters (#F4FBF7)
    backgroundColor: '#F4FBF7',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },

  // ── Welcome — Brand block ─────────────────────────────
  brandBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  logoWrapper: {
    marginBottom: 4,
  },
  logo: {
    width: 120,
    height: 120,
  },

  // Typography — must match DESIGN.md exactly
  // Title token: text-[20px] leading-[22px] font-bold, light-bg-text (#091E15)
  title: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    color: '#091E15',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  // Paragraph token: text-[13px] leading-[15px] font-normal, light-bg-shade (#6B7280)
  paragraph: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 2,
  },

  // ── Welcome — Buttons ─────────────────────────────────
  buttonsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  loginGradient: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
  },
  buttonInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Subtitle token: text-[16px] font-medium, Letters and Icons (#FFFFFF)
  loginLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  signupButton: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    // Token: Light Green (#E8F7F1)
    backgroundColor: '#E8F7F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Subtitle token: text-[16px] font-medium, main-theme (#0FB384)
  signupLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0FB384',
    letterSpacing: 0.1,
  },

  // ── Login Screen ──────────────────────────────────────
  loginScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  // Top row: spacer + language button
  loginTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    marginBottom: 8,
  },
  spacer: {
    flex: 1,
  },
  // Token: system border — light bg border (#D1D5DB)
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  // Subtext token: text-[14px] font-normal
  langText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#091E15',
  },

  // Login Branding
  loginBrandBlock: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 24,
    gap: 6,
  },
  loginLogoWrapper: {
    width: 72,
    height: 72,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 4,
  },
  loginLogo: {
    width: 72,
    height: 72,
  },
  // Title token: text-[20px] leading-[22px] font-bold
  loginBrandTitle: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    color: '#091E15',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  // Subtext token: text-[14px] font-normal
  loginBrandSubtext: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'center',
  },

  // Tab Segment Control
  tabBar: {
    flexDirection: 'row',
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 24,
  },
  tabItemActive: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 10,
    position: 'relative',
  },
  tabItemInactive: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 10,
  },
  // Subtitle token: text-[16px] font-medium — active green
  tabLabelActive: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0FB384',
  },
  // Subtitle token: text-[16px] font-medium — inactive shade
  tabLabelInactive: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  // Active tab underline — mainTheme green token (#0FB384)
  tabUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#0FB384',
    borderRadius: 1,
  },

  // Form inputs
  formContainer: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 14,
    width: '100%',
  },
  // Subtext token: text-[14px] font-normal
  inputLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#091E15',
    marginBottom: 6,
  },
  // Token: system border (#D1D5DB), corner radius 10, white bg
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
  },
  // Subtext token: text-[14px] font-normal
  textInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    fontWeight: '400',
    color: '#091E15',
  },
  textInputPassword: {
    paddingRight: 8,
  },
  visibilityToggle: {
    padding: 4,
  },

  // Forgot Password? — right-aligned, primary green token
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: 2,
  },
  // Subtext token: text-[14px] font-normal, main-theme green (#0FB384)
  forgotText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#0FB384',
  },

  // Login action button — Button grad token
  loginButtonGradient: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    marginBottom: 24,
  },
  loginButtonInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Subtitle token elevated to bold white per spec
  loginButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },

  // Footer
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  // Paragraph token: text-[13px] leading-[15px] font-normal
  footerText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#6B7280',
  },
  // Subtitle token: text-[16px] font-medium — "Create Account" prominent
  footerLink: {
    fontSize: 16,
    fontWeight: '500',
    color: '#091E15',
  },

  // ── Forgot Password Modal ──────────────────────────────
  // Semi-transparent dark backdrop (Token: Dark Mode Green Black overlay)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 30, 21, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  // White modal card
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  // Header row: title left, X button right
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  // Title token: text-[20px] leading-[22px] font-bold
  modalTitle: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    color: '#091E15',
    letterSpacing: 0.2,
  },
  // Circle close button
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal body — stacked content
  modalBody: {
    alignItems: 'center',
    gap: 14,
    width: '100%',
  },
  // Light-green rounded icon container
  modalIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 18,
    // Token: Light Green (#E8F7F1)
    backgroundColor: '#E8F7F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  // Paragraph token: text-[13px] leading-[15px] font-normal — instruction copy
  modalInstructions: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    // Token: Alternative Accent / main theme green for link-style instruction text
    color: '#0FB384',
    textAlign: 'center',
    marginBottom: 4,
  },
  // Send Reset Link / Back to Login full-width primary button
  resetBtn: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    // Token: Button grad primary green
    backgroundColor: '#0FB384',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  // Disabled state — light gray when input is empty
  resetBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
  // Subtitle token elevated to bold white
  resetBtnLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  // Success state — "Check your email!" Title token
  successTitle: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    color: '#091E15',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  // Success sub-copy — Paragraph token
  successBody: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 4,
  },
});