import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = '@evenly_theme_mode';

export const DARK_THEME = {
  background: '#111113',
  card: '#1c1c22',
  text: '#f0f0f5',
  textLight: '#9ca3af',
  textMuted: '#6b7280',
  primary: '#00d4aa',
  primaryDark: '#00b894',
  primaryLight: 'rgba(0,212,170,0.12)',
  primaryGradient: ['#00d4aa', '#00b894'],
  accent: '#FFB84D',
  negative: '#ff6b6b',
  positive: '#00d4aa',
  success: '#00d4aa',
  danger: '#ff4757',
  warning: '#ffd93d',
  info: '#4fc3f7',
  secondary: '#a55eea',
  neutral: '#71717a',
  border: 'rgba(255,255,255,0.08)',
  white: '#1c1c22',
  black: '#ffffff',
  shadow: 'rgba(0,212,170,0.15)',
  overlay: 'rgba(0,0,0,0.7)',
  headerBg: 'rgba(17,17,19,0.97)',
  headerBgTransparent: 'rgba(17,17,19,0)',
  tabBar: 'rgba(17,17,19,0.95)',
  inputBg: 'rgba(255,255,255,0.06)',
  ctaGradient: ['#00d4aa', '#00b4d8'],
  // Orb colors for BackgroundOrbs
  orbPrimary: '#00d4aa',
  orbSecondary: '#ff6b6b',
  orbOpacityHigh: 0.35,
  orbOpacityLow: 0.08,
  // Desktop
  desktopBg: '#050508',
  desktopBorder: 'rgba(255,255,255,0.06)',
};

export const LIGHT_THEME = {
  background: '#FAFAF9',
  card: '#FFFFFF',
  text: '#1A1A2E',
  textLight: '#6B7280',
  textMuted: '#9CA3AF',
  primary: '#00b894',
  primaryDark: '#009d7e',
  primaryLight: 'rgba(0,184,148,0.10)',
  primaryGradient: ['#00b894', '#009d7e'],
  accent: '#FF8C42',
  negative: '#E54D4D',
  positive: '#00b894',
  success: '#00b894',
  danger: '#E54D4D',
  warning: '#F59E0B',
  info: '#3B82F6',
  secondary: '#8B5CF6',
  neutral: '#6B7280',
  border: 'rgba(0,0,0,0.08)',
  white: '#FFFFFF',
  black: '#1A1A2E',
  shadow: 'rgba(0,184,148,0.10)',
  overlay: 'rgba(0,0,0,0.5)',
  headerBg: 'rgba(250,250,249,0.97)',
  headerBgTransparent: 'rgba(250,250,249,0)',
  tabBar: 'rgba(250,250,249,0.95)',
  inputBg: 'rgba(0,0,0,0.04)',
  ctaGradient: ['#00b894', '#00a3cc'],
  // Orb colors for BackgroundOrbs
  orbPrimary: '#00b894',
  orbSecondary: '#ff6b6b',
  orbOpacityHigh: 0.12,
  orbOpacityLow: 0.04,
  // Desktop
  desktopBg: '#F0F0EE',
  desktopBorder: 'rgba(0,0,0,0.06)',
};

const ThemeContext = createContext({
  theme: DARK_THEME,
  colorScheme: 'dark',
  themeMode: 'auto',
  setThemeMode: () => {},
});

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [themeMode, setThemeModeState] = useState('auto'); // 'light' | 'dark' | 'auto'
  const [loaded, setLoaded] = useState(false);

  // Load persisted theme mode
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then(val => {
        if (val === 'light' || val === 'dark' || val === 'auto') {
          setThemeModeState(val);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const setThemeMode = React.useCallback((mode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {});
  }, []);

  const colorScheme = useMemo(() => {
    if (themeMode === 'auto') {
      return systemScheme === 'light' ? 'light' : 'dark';
    }
    return themeMode;
  }, [themeMode, systemScheme]);

  const theme = useMemo(() => {
    return colorScheme === 'light' ? LIGHT_THEME : DARK_THEME;
  }, [colorScheme]);

  const value = useMemo(() => ({
    theme,
    colorScheme,
    themeMode,
    setThemeMode,
  }), [theme, colorScheme, themeMode]);

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  // Fallback to dark theme if context not yet available
  if (!ctx || !ctx.theme) {
    return { theme: DARK_THEME, colorScheme: 'dark', themeMode: 'auto', setThemeMode: () => {} };
  }
  return ctx;
};
