import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, ScrollView, ActivityIndicator, Animated, Image as RNImage,
} from 'react-native';

const AppLogo = require('../../assets/icon.png');
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { themedAlert } from '../components/ThemedAlert';

import { COLORS } from '../constants/colors';
import { useTheme } from '../context/ThemeContext';

// These are resolved inside the component via useTheme()
const PRIMARY_ALT = '#00b894';

const DEMO_USERS = [
  { name: 'Alice Demo', email: 'alice@demo.com' },
  { name: 'Bob Demo',   email: 'bob@demo.com'   },
];

const OAUTH_PROVIDERS = [
  { id: 'google',  label: 'Continue with Google',  icon: 'logo-google',  bg: '#ffffff', color: '#1f1f1f' },
];

const AuthScreen = () => {
  const { theme, colorScheme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { login, signInWithOAuth } = useApp();
  const [loading, setLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState(null);

  // Entrance animations
  const logoAnim   = useRef(new Animated.Value(0)).current;
  const titleAnim  = useRef(new Animated.Value(0)).current;
  const formAnim   = useRef(new Animated.Value(0)).current;
  const demoAnim   = useRef(new Animated.Value(0)).current;
  const blob1Anim  = useRef(new Animated.Value(0.2)).current;
  const blob2Anim  = useRef(new Animated.Value(0.1)).current;
  const blob3Anim  = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.spring(logoAnim,  { toValue: 1, tension: 200, friction: 12, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(titleAnim, { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(formAnim,  { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(demoAnim,  { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();

    const pulse = (anim, min, max, delay) =>
      Animated.loop(Animated.sequence([
        Animated.timing(anim, { toValue: max, duration: 3500, delay, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(anim, { toValue: min, duration: 3500, useNativeDriver: Platform.OS !== 'web' }),
      ])).start();

    pulse(blob1Anim, 0.15, 0.25, 0);
    pulse(blob2Anim, 0.07, 0.14, 1200);
    pulse(blob3Anim, 0.10, 0.20, 2400);
  }, []);

  const handleOAuth = async (provider) => {
    setLoading(true);
    setLoadingProvider(provider);
    try {
      await signInWithOAuth(provider);
    } catch (e) {
      themedAlert('Sign In Error', e.message || 'Something went wrong. Please try again.', 'error');
    } finally {
      setLoading(false);
      setLoadingProvider(null);
    }
  };

  const loginAsDemo = async (demoEmail) => {
    setLoading(true);
    try {
      await login(demoEmail, 'demo123');
    } catch (e) {
      themedAlert('Error', e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Animated background blobs */}
      <Animated.View style={[styles.blob, styles.blob1, { opacity: blob1Anim }]} />
      <Animated.View style={[styles.blob, styles.blob2, { opacity: blob2Anim }]} />
      <Animated.View style={[styles.blob, styles.blob3, { opacity: blob3Anim }]} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo + Header */}
        <Animated.View style={[styles.header, {
          opacity: titleAnim,
          transform: [{ translateY: titleAnim.interpolate({ inputRange: [0,1], outputRange: [20,0] }) }],
        }]}>
          <Animated.View style={[styles.logoWrap, {
            transform: [{ scale: logoAnim.interpolate({ inputRange: [0,1], outputRange: [0,1] }) }],
          }]}>
            <RNImage source={AppLogo} style={styles.logoImage} />
          </Animated.View>
          <Text style={styles.heading}>Evenly</Text>
          <Text style={styles.subheading}>Split expenses with friends, effortlessly</Text>
        </Animated.View>

        {/* OAuth Buttons Card */}
        <Animated.View style={[styles.card, {
          opacity: formAnim,
          transform: [{ translateY: formAnim.interpolate({ inputRange: [0,1], outputRange: [20,0] }) }],
        }]}>
          <Text style={styles.cardTitle}>Sign in to get started</Text>

          {OAUTH_PROVIDERS.map((provider) => (
            <TouchableOpacity
              key={provider.id}
              testID={`auth-${provider.id}-btn`}
              accessibilityLabel={provider.label}
              activeOpacity={0.85}
              disabled={loading}
              onPress={() => handleOAuth(provider.id)}
              style={[styles.oauthBtn, { backgroundColor: provider.bg }, loading && { opacity: 0.5 }]}
            >
              {loadingProvider === provider.id ? (
                <ActivityIndicator size="small" color={provider.color} style={{ marginRight: 12 }} />
              ) : (
                <Ionicons name={provider.icon} size={22} color={provider.color} style={{ marginRight: 12 }} />
              )}
              <Text style={[styles.oauthBtnText, { color: provider.color }]}>{provider.label}</Text>
            </TouchableOpacity>
          ))}

          <Text style={styles.termsText}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </Animated.View>

        {/* Demo Accounts Card */}
        <Animated.View style={[styles.demoCard, {
          opacity: demoAnim,
          transform: [{ translateY: demoAnim.interpolate({ inputRange: [0,1], outputRange: [20,0] }) }],
        }]}>
          <View style={styles.demoHeader}>
            <Ionicons name="sparkles" size={16} color={theme.primary} />
            <Text style={styles.demoHeaderText}>Quick Demo Access</Text>
          </View>

          {DEMO_USERS.map((user) => (
            <TouchableOpacity
              key={user.email}
              accessibilityLabel={`Sign in as ${user.name}`}
              activeOpacity={0.8}
              style={styles.demoRow}
              onPress={() => loginAsDemo(user.email)}
              disabled={loading}
            >
              {Platform.OS === 'web' ? (
                <View style={[styles.demoAvatar, { backgroundColor: theme.primary }]}>
                  <Text style={styles.demoAvatarText}>{user.name[0]}</Text>
                </View>
              ) : (
                <LinearGradient colors={[theme.primary, PRIMARY_ALT]} style={styles.demoAvatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Text style={styles.demoAvatarText}>{user.name[0]}</Text>
                </LinearGradient>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.demoName}>{user.name}</Text>
                <Text style={styles.demoEmail}>{user.email}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.neutral} />
            </TouchableOpacity>
          ))}

          <Text style={styles.demoHint}>Tap to explore with sample data</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const getStyles = (theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  // Blobs
  blob: { position: 'absolute', borderRadius: 999 },
  blob1: { width: 300, height: 300, backgroundColor: theme.primary,    top: -80,  right: -80 },
  blob2: { width: 260, height: 260, backgroundColor: theme.negative,  top: '35%', left: -80 },
  blob3: { width: 280, height: 280, backgroundColor: '#a55eea',  bottom: 40, right: -60 },
  // Layout
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 48, justifyContent: 'center' },
  // Header
  header: { alignItems: 'center', marginBottom: 32 },
  logoWrap: { marginBottom: 20 },
  logoImage: {
    width: 80, height: 80,
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4, shadowRadius: 24, elevation: 16,
  },
  heading: { fontSize: 36, fontWeight: '700', color: theme.text, letterSpacing: -0.5, marginBottom: 8, lineHeight: 42 },
  subheading: { fontSize: 16, fontWeight: '400', color: theme.textLight, textAlign: 'center', lineHeight: 22 },
  // OAuth card
  card: {
    backgroundColor: theme.card, borderRadius: 24, padding: 28,
    borderWidth: 1, borderColor: theme.border,
  },
  cardTitle: { fontSize: 17, fontWeight: '600', color: theme.textLight, textAlign: 'center', marginBottom: 20 },
  oauthBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 54, borderRadius: 12, marginBottom: 12,
    borderWidth: 1, borderColor: theme.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  oauthBtnText: { fontSize: 16, fontWeight: '600' },
  termsText: { fontSize: 11, color: theme.neutral, textAlign: 'center', marginTop: 8, lineHeight: 16 },
  // Demo card
  demoCard: {
    marginTop: 20, backgroundColor: theme.card, borderRadius: 24,
    padding: 24, borderWidth: 1, borderColor: theme.border,
  },
  demoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  demoHeaderText: { fontSize: 13, fontWeight: '700', color: theme.textLight },
  demoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.background, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: theme.border,
    marginBottom: 8,
  },
  demoAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  demoAvatarText: { fontSize: 16, fontWeight: '700', color: theme.background },
  demoName: { fontSize: 14, fontWeight: '600', color: theme.text },
  demoEmail: { fontSize: 12, color: theme.neutral, marginTop: 1 },
  demoHint: { textAlign: 'center', marginTop: 8, fontSize: 12, color: theme.neutral },
});

export default AuthScreen;
