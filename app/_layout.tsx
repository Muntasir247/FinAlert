import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      {/*
        Status bar: 'dark' for the light (#F4FBF7) welcome screen background.
        The native splash (#02C78E green) auto-handles its own status bar style.
      */}
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          // No slide animation between splash → welcome → tabs
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </SafeAreaProvider>
  );
}
