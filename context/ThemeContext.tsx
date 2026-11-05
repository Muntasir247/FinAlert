import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import { colorScheme } from 'nativewind';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  isDark: boolean;
  background: string;
  card: string;
  cardBorder: string;
  surface: string;
  surfaceSubtle: string;
  surfaceHighlight: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  border: string;
  divider: string;
  tabBarBg: string;
  tabBarBorder: string;
  tabBarInactive: string;
  inputBg: string;
  inputBorder: string;
  badgeBg: string;
  badgeText: string;
  danger: string;
  dangerBg: string;
  dangerBorder: string;
  warning: string;
  warningBg: string;
  modalOverlay: string;
  statusBarStyle: 'light' | 'dark';
}

export const LIGHT_THEME: ThemeColors = {
  isDark: false,
  background: '#F8FAFC',
  card: '#FFFFFF',
  cardBorder: '#E2E8F0',
  surface: '#FFFFFF',
  surfaceSubtle: '#F1F5F9',
  surfaceHighlight: '#E8F7F1',
  text: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  primary: '#0FB384',
  primaryLight: '#E8F7F1',
  primaryDark: '#0A8A65',
  border: '#E2E8F0',
  divider: '#F1F5F9',
  tabBarBg: '#FFFFFF',
  tabBarBorder: '#E5E7EB',
  tabBarInactive: '#94A3B8',
  inputBg: '#F8FAFC',
  inputBorder: '#E2E8F0',
  badgeBg: '#E6F4EA',
  badgeText: '#0FB384',
  danger: '#EF4444',
  dangerBg: '#FEF2F2',
  dangerBorder: '#FCA5A5',
  warning: '#F59E0B',
  warningBg: '#FEF3C7',
  modalOverlay: 'rgba(0, 0, 0, 0.45)',
  statusBarStyle: 'dark',
};

export const DARK_THEME: ThemeColors = {
  isDark: true,
  background: '#081E15',      // Dark mode Green Black per DESIGN.md
  card: '#0F2C20',            // Background dark mode and letters
  cardBorder: '#0C2B1F',      // Dark Mode Green bar
  surface: '#0F2C20',
  surfaceSubtle: '#14382A',
  surfaceHighlight: '#1A4D3A',
  text: '#FFFFFF',            // Letters and Icons
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  primary: '#0FB384',         // Main theme
  primaryLight: '#143D2E',
  primaryDark: '#0A8A65',
  border: '#0C2B1F',
  divider: '#143527',
  tabBarBg: '#081E15',
  tabBarBorder: '#0C2B1F',
  tabBarInactive: '#64748B',
  inputBg: '#0A2419',
  inputBorder: '#1A4A36',
  badgeBg: '#143D2E',
  badgeText: '#0FB384',
  danger: '#EF4444',
  dangerBg: '#2B1214',
  dangerBorder: '#7F1D1D',
  warning: '#F59E0B',
  warningBg: '#2E2210',
  modalOverlay: 'rgba(0, 0, 0, 0.75)',
  statusBarStyle: 'light',
};

const THEME_STORAGE_KEY = 'finalert_theme_mode';

interface ThemeContextType {
  theme: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setTheme: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>('light');

  // Load saved theme preference on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
        if (saved === 'dark' || saved === 'light') {
          setThemeState(saved);
          try {
            colorScheme.set(saved);
          } catch {}
        }
      } catch (err) {
        console.warn('[ThemeContext] Failed to load theme preference:', err);
      }
    })();
  }, []);

  const setTheme = useCallback(async (mode: ThemeMode) => {
    try {
      setThemeState(mode);
      try {
        colorScheme.set(mode);
      } catch {}
      await SecureStore.setItemAsync(THEME_STORAGE_KEY, mode);
    } catch (err) {
      console.warn('[ThemeContext] Failed to save theme preference:', err);
    }
  }, []);

  const toggleTheme = useCallback(async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    await setTheme(next);
  }, [theme, setTheme]);

  const isDark = theme === 'dark';
  const colors = useMemo(() => (isDark ? DARK_THEME : LIGHT_THEME), [isDark]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark,
        colors,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

