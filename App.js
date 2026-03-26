import React, { useEffect } from 'react';
import { View, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import { initAds } from './src/services/ads';

export default function App() {
  useEffect(() => { initAds(); }, []);

  const nav = (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="auto" />
        <AppNavigator />
      </AppProvider>
    </SafeAreaProvider>
  );

  if (Platform.OS !== 'web') return nav;

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#05050a', alignItems: 'stretch' }}>
      {/* Left ad slot */}
      <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 8 }}>
        <View style={{ width: 160, minHeight: 600, backgroundColor: '#0f0f18', borderRadius: 12, overflow: 'hidden' }}>
          {/* AdSense left — replace data-ad-slot with your unit ID */}
          {/* <ins className="adsbygoogle" style={{display:'block'}} data-ad-client="ca-pub-9004418283363709" data-ad-slot="XXXXXXXXXX" data-ad-format="auto" /> */}
        </View>
      </View>

      {/* App — capped at 430px phone width */}
      <View style={{ width: 430, maxWidth: '100%', alignSelf: 'stretch' }}>
        {nav}
      </View>

      {/* Right ad slot */}
      <View style={{ flex: 1, alignItems: 'flex-start', justifyContent: 'center', paddingLeft: 8 }}>
        <View style={{ width: 160, minHeight: 600, backgroundColor: '#0f0f18', borderRadius: 12, overflow: 'hidden' }}>
          {/* AdSense right — replace data-ad-slot with your unit ID */}
          {/* <ins className="adsbygoogle" style={{display:'block'}} data-ad-client="ca-pub-9004418283363709" data-ad-slot="XXXXXXXXXX" data-ad-format="auto" /> */}
        </View>
      </View>
    </View>
  );
}
