import '../global.css';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';

function NavigationLayout() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    const isRoot = segments[0] === 'index' || !segments[0];

    if (!session) {
      // Force unauthenticated users to the auth screens only if trying to access tabs
      if (inTabsGroup) {
        router.replace('/(auth)/login');
      }
    } else {
      // Direct authenticated users away from landing/auth screens to the tab system
      if (inAuthGroup || isRoot) {
        router.replace('/(tabs)');
      }
    }
  }, [session, segments, isLoading]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-green-black justify-center items-center">
        <ActivityIndicator size="large" color="#0FB384" />
      </View>
    );
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
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <NavigationLayout />
      </SafeAreaProvider>
    </AuthProvider>
  );
}

