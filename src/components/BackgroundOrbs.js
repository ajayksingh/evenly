import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const BackgroundOrbs = React.memo(() => {
  const { theme } = useTheme();
  const pulse1 = useRef(new Animated.Value(0.2)).current;
  const pulse2 = useRef(new Animated.Value(0.1)).current;

  useEffect(() => {
    const anim1 = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse1, { toValue: theme.orbOpacityHigh, duration: 4000, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse1, { toValue: theme.orbOpacityHigh * 0.57, duration: 4000, useNativeDriver: Platform.OS !== 'web' }),
      ])
    );
    anim1.start();
    const timer = setTimeout(() => {
      const anim2 = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse2, { toValue: theme.orbOpacityLow * 2.25, duration: 4000, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(pulse2, { toValue: theme.orbOpacityLow, duration: 4000, useNativeDriver: Platform.OS !== 'web' }),
        ])
      );
      anim2.start();
    }, 1500);
    return () => {
      clearTimeout(timer);
      anim1.stop();
      pulse1.stopAnimation();
      pulse2.stopAnimation();
    };
  }, []);

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View style={[styles.orb1, { opacity: pulse1, backgroundColor: theme.orbPrimary }]} />
      <Animated.View style={[styles.orb2, { opacity: pulse2, backgroundColor: theme.orbSecondary }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    overflow: 'hidden',
  },
  orb1: {
    position: 'absolute', top: -80, right: -80,
    width: 320, height: 320, borderRadius: 160,
  },
  orb2: {
    position: 'absolute', top: 300, left: -80,
    width: 280, height: 280, borderRadius: 140,
  },
});

export default BackgroundOrbs;
