import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Added for dynamic padding

// Colors from DESIGN.md (Main Theme & Text colors)
const COLORS = {
  mainTheme: '#0FB384', // Solid mint/green active state
  inactive: '#9CA3AF',  // Gray inactive state
  tabBarBg: '#FFFFFF',  // White background
  border: '#E5E7EB',    // Light gray border
};

export default function TabLayout() {
  const insets = useSafeAreaInsets(); // Calculates the device's exact bottom chin inset

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.mainTheme,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarStyle: {
          backgroundColor: COLORS.tabBarBg,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          // Calculate height and padding dynamically based on device safe area
          height: Platform.OS === 'ios' ? 64 + insets.bottom : 72 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
          paddingTop: 12,
        },
        tabBarLabelStyle: {
          fontSize: 13, // Standardized to 13px to perfectly match DESIGN.md Paragraph token
          fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
          marginTop: 4,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={Platform.select({
                ios: 'house.fill',
                default: 'home',
              }) as any}
              size={size}
              tintColor={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={Platform.select({
                ios: 'arrow.left.and.right',
                default: 'swap_horiz',
              }) as any}
              size={size}
              tintColor={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: 'Family',
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={Platform.select({
                ios: 'person.2.fill',
                default: 'group',
              }) as any}
              size={size}
              tintColor={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={Platform.select({
                ios: 'chart.bar.fill',
                default: 'bar_chart',
              }) as any}
              size={size}
              tintColor={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={Platform.select({
                ios: 'person.fill',
                default: 'person',
              }) as any}
              size={size}
              tintColor={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}