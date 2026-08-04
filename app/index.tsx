import React, { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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

  // --- Reanimated shared values ---
  const logoOpacity = useSharedValue(0);
  const logoTranslateY = useSharedValue(24);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(16);
  const subtextOpacity = useSharedValue(0);
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
            onPress={() => router.push('/(auth)/login')}
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
          onPress={() => router.push('/(auth)/signup')}
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
});