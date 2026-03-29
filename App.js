import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './src/context/AppContext';
import { ThemeProvider } from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import { initAds } from './src/services/ads';

export default function App() {
  useEffect(() => { setTimeout(() => initAds(), 3000); }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppProvider>
          <StatusBar style="auto" />
          <AppNavigator />
        </AppProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
