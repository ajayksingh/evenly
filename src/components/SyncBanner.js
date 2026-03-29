/**
 * SyncBanner — shows offline/syncing/synced status at the top of the screen
 * Status values:
 *   null       → hidden
 *   'offline'  → "Saved locally — will sync when online"
 *   'syncing'  → "Pushing data to server..."
 *   'synced'   → "All synced ✓"  (auto-hides after 2.5s)
 *   'error'    → "Sync issue — retrying..."
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const SyncBanner = ({ status }) => {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-40)).current;

  const CONFIGS = {
    offline: {
      bg: '#E67E22',
      icon: 'cloud-offline-outline',
      text: 'Saved locally — will sync when online',
    },
    syncing: {
      bg: theme.info,
      icon: 'sync-outline',
      text: 'Pushing data to server...',
    },
    synced: {
      bg: theme.success,
      icon: 'checkmark-circle-outline',
      text: 'All synced \u2713',
    },
    error: {
      bg: theme.danger,
      icon: 'warning-outline',
      text: 'Sync issue — retrying...',
    },
  };

  useEffect(() => {
    if (!status) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(translateY, { toValue: -40, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: Platform.OS !== 'web', tension: 80, friction: 10 }),
    ]).start();

    if (status === 'synced' || status === 'error') {
      const delay = status === 'error' ? 8000 : 3000;
      const t = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(translateY, { toValue: -40, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
        ]).start();
      }, delay);
      return () => clearTimeout(t);
    }
  }, [status]);

  const config = CONFIGS[status];
  if (!config) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor: config.bg, opacity, transform: [{ translateY }] },
      ]}
    >
      <Ionicons name={config.icon} size={15} color="#fff" style={styles.icon} />
      <Text style={styles.text}>{config.text}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  icon: { marginRight: 8 },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default SyncBanner;
