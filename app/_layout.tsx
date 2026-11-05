import '../global.css';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { LanguageProvider } from '../context/LanguageContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { TransactionsProvider } from '../context/TransactionsContext';
import { BudgetsProvider } from '../context/BudgetsContext';
import { NotificationsProvider } from '../context/NotificationsContext';
import { SavingsGoalsProvider } from '../context/SavingsGoalsContext';
import { FamilyProvider } from '../context/FamilyContext';
import BudgetSetupModal from '../components/BudgetSetupModal';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text } from 'react-native';

const MIN_SPLASH_MS = 2500;

// ── Green Loading Screen ───────────────────────────────────────────────────
// Full-screen brand splash shown on every app open. Acts as the loading
// screen while auth/profile state is being resolved and for a minimum hold.
function GreenLoadingScreen() {
  return (
    <LinearGradient
      colors={['#02C78E', '#0FB384']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.splashRoot}
    >
      <Image
        source={require('../assets/images/logo_light.png')}
        style={styles.splashLogo}
        resizeMode="contain"
      />
      <Text style={styles.splashTitle}>FinAlert</Text>
      <ActivityIndicator size="large" color="#FFFFFF" style={styles.splashSpinner} />
    </LinearGradient>
  );
}

function NavigationLayout() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);

  // Show the green loading screen on every app open: keep it mounted for a
  // minimum duration after auth resolves so it reads as a real splash.
  useEffect(() => {
    if (isLoading) return;
    const timer = setTimeout(() => setShowSplash(false), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Our green loading screen replaces the native splash visually, so the
  // native splash can be released as soon as this screen is rendered.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isForgotPassword = (segments as string[]).includes('forgot-password');
    const inTabsGroup = segments[0] === '(tabs)';
    const isRoot = segments[0] === 'index' || !segments[0];

    if (!session) {
      // Force unauthenticated users to the auth screens only if trying to access tabs
      if (inTabsGroup) {
        router.replace('/(auth)/login');
      }
    } else {
      // Direct authenticated users away from landing/auth screens to the tab system,
      // except while on the password recovery screen to allow redirecting to login.
      if ((inAuthGroup && !isForgotPassword) || isRoot) {
        router.replace('/(tabs)');
      }
    }
  }, [session, segments, isLoading]);

  if (isLoading || showSplash) {
    return <GreenLoadingScreen />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}

function AppContent() {
  const { isDark } = useTheme();
  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationLayout />
      <BudgetSetupModal />
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <TransactionsProvider>
            <NotificationsProvider>
              <BudgetsProvider>
                <SavingsGoalsProvider>
                  <FamilyProvider>
                    <AppContent />
                  </FamilyProvider>
                </SavingsGoalsProvider>
              </BudgetsProvider>
            </NotificationsProvider>
          </TransactionsProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  splashRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    width: 120,
    height: 120,
  },
  splashTitle: {
    marginTop: 20,
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  splashSpinner: {
    marginTop: 32,
  },
});

