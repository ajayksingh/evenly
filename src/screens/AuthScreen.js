import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  ActivityIndicator, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

const BG = '#0a0a0f';
const CARD = '#1a1a24';
const PRIMARY = '#00d4aa';
const PRIMARY_ALT = '#00b894';
const BORDER = 'rgba(255,255,255,0.1)';
const MUTED = '#a1a1aa';
const ZINC500 = '#71717a';
const ZINC600 = '#52525b';
const ZINC300 = '#d4d4d8';

const DEMO_USERS = [
  { name: 'Alice Demo', email: 'alice@demo.com' },
  { name: 'Bob Demo',   email: 'bob@demo.com'   },
];

const AuthScreen = () => {
  const { login, register, resetPassword } = useApp();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // Entrance animations
  const cardAnim   = useRef(new Animated.Value(0)).current;
  const logoAnim   = useRef(new Animated.Value(0)).current;
  const titleAnim  = useRef(new Animated.Value(0)).current;
  const formAnim   = useRef(new Animated.Value(0)).current;
  const demoAnim   = useRef(new Animated.Value(0)).current;
  const blob1Anim  = useRef(new Animated.Value(0.2)).current;
  const blob2Anim  = useRef(new Animated.Value(0.1)).current;
  const blob3Anim  = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    // Staggered fade-in
    Animated.stagger(100, [
      Animated.spring(logoAnim,  { toValue: 1, tension: 200, friction: 12, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(titleAnim, { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(formAnim,  { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(demoAnim,  { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();

    // Pulsing blobs
    const pulse = (anim, min, max, delay) =>
      Animated.loop(Animated.sequence([
        Animated.timing(anim, { toValue: max, duration: 2000, delay, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(anim, { toValue: min, duration: 2000, useNativeDriver: Platform.OS !== 'web' }),
      ])).start();

    pulse(blob1Anim, 0.15, 0.25, 0);
    pulse(blob2Anim, 0.07, 0.14, 1000);
    pulse(blob3Anim, 0.10, 0.20, 2000);
  }, []);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields'); return;
    }
    if (mode === 'register') {
      if (!name.trim()) { Alert.alert('Error', 'Please enter your name'); return; }
      if (password !== confirmPassword) { Alert.alert('Error', 'Passwords do not match'); return; }
      if (password.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters'); return; }
    }
    setLoading(true);
    try {
      if (mode === 'login') await login(email.trim().toLowerCase(), password);
      else await register(name.trim(), email.trim().toLowerCase(), password);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Reset Password', 'Enter your email above, then tap Forgot Password.'); return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim().toLowerCase());
      Alert.alert('Check your email', `A reset link was sent to ${email.trim().toLowerCase()}.`);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const loginAsDemo = async (demoEmail) => {
    setLoading(true);
    try {
      await login(demoEmail, 'demo123');
    } catch (e) {
      Alert.alert('Error', e.message);
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

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
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
              {Platform.OS === 'web' ? (
                <View style={[styles.logoBox, { backgroundColor: PRIMARY }]}>
                  <Text style={styles.logoLetter}>E</Text>
                </View>
              ) : (
                <LinearGradient colors={[PRIMARY, PRIMARY_ALT]} style={styles.logoBox} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Text style={styles.logoLetter}>E</Text>
                </LinearGradient>
              )}
            </Animated.View>
            <Text style={styles.heading}>Welcome back</Text>
            <Text style={styles.subheading}>Sign in to manage your expenses</Text>
          </Animated.View>

          {/* Login / Register Form Card */}
          <Animated.View style={[styles.card, {
            opacity: formAnim,
            transform: [{ translateY: formAnim.interpolate({ inputRange: [0,1], outputRange: [20,0] }) }],
          }]}>
            {/* Mode Toggle */}
            <View style={styles.toggle}>
              {['login','register'].map(m => (
                <TouchableOpacity key={m} activeOpacity={0.8} style={[styles.toggleBtn, mode === m && styles.toggleActive]} onPress={() => setMode(m)}>
                  <Text style={[styles.toggleText, mode === m && styles.toggleTextActive]}>
                    {m === 'login' ? 'Sign In' : 'Sign Up'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {mode === 'register' && (
              <InputField icon="person-outline" placeholder="Full Name" value={name} onChangeText={setName} autoCapitalize="words" />
            )}

            <InputField
              icon="mail-outline"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              testID="auth-email-input"
            />

            <InputField
              icon="lock-closed-outline"
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              testID="auth-password-input"
              rightIcon={
                <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showPass ? 'eye-off' : 'eye'} size={20} color={ZINC500} />
                </TouchableOpacity>
              }
            />

            {mode === 'register' && (
              <InputField icon="lock-closed-outline" placeholder="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPass} />
            )}

            {/* Submit */}
            <TouchableOpacity
              testID="auth-submit-btn"
              activeOpacity={0.85}
              onPress={handleSubmit}
              disabled={loading}
              style={styles.submitWrap}
            >
              {Platform.OS === 'web' ? (
                <View style={[styles.submitBtn, { backgroundColor: PRIMARY }, loading && { opacity: 0.5 }]}>
                  {loading
                    ? <ActivityIndicator size="small" color={BG} style={{ marginRight: 8 }} />
                    : <Ionicons name="log-in-outline" size={20} color={BG} style={{ marginRight: 8 }} />
                  }
                  <Text style={styles.submitText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
                </View>
              ) : (
                <LinearGradient colors={[PRIMARY, PRIMARY_ALT]} style={[styles.submitBtn, loading && { opacity: 0.5 }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {loading
                    ? <ActivityIndicator size="small" color={BG} style={{ marginRight: 8 }} />
                    : <Ionicons name="log-in-outline" size={20} color={BG} style={{ marginRight: 8 }} />
                  }
                  <Text style={styles.submitText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
                </LinearGradient>
              )}
            </TouchableOpacity>

            {mode === 'login' && (
              <TouchableOpacity activeOpacity={0.7} style={styles.forgotBtn} onPress={handleForgotPassword}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            {mode === 'login' && (
              <TouchableOpacity activeOpacity={0.8} style={styles.switchRow} onPress={() => setMode('register')}>
                <Text style={styles.switchText}>Don't have an account? <Text style={styles.switchLink}>Sign Up</Text></Text>
              </TouchableOpacity>
            )}
            {mode === 'register' && (
              <TouchableOpacity activeOpacity={0.8} style={styles.switchRow} onPress={() => setMode('login')}>
                <Text style={styles.switchText}>Already have an account? <Text style={styles.switchLink}>Sign In</Text></Text>
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Demo Accounts Card */}
          {mode === 'login' && (
            <Animated.View style={[styles.demoCard, {
              opacity: demoAnim,
              transform: [{ translateY: demoAnim.interpolate({ inputRange: [0,1], outputRange: [20,0] }) }],
            }]}>
              <View style={styles.demoHeader}>
                <Ionicons name="sparkles" size={16} color={PRIMARY} />
                <Text style={styles.demoHeaderText}>Quick Demo Access</Text>
              </View>

              {DEMO_USERS.map((user, i) => (
                <TouchableOpacity
                  key={user.email}
                  activeOpacity={0.8}
                  style={styles.demoRow}
                  onPress={() => loginAsDemo(user.email)}
                >
                  {Platform.OS === 'web' ? (
                    <View style={[styles.demoAvatar, { backgroundColor: PRIMARY }]}>
                      <Text style={styles.demoAvatarText}>{user.name[0]}</Text>
                    </View>
                  ) : (
                    <LinearGradient colors={[PRIMARY, PRIMARY_ALT]} style={styles.demoAvatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                      <Text style={styles.demoAvatarText}>{user.name[0]}</Text>
                    </LinearGradient>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.demoName}>{user.name}</Text>
                    <Text style={styles.demoEmail}>{user.email}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={ZINC500} />
                </TouchableOpacity>
              ))}

              <Text style={styles.demoHint}>Password: <Text style={{ ...(Platform.OS !== 'web' && { fontVariant: ['tabular-nums'] }) }}>demo123</Text></Text>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const InputField = ({ icon, placeholder, value, onChangeText, testID, secureTextEntry, keyboardType, autoCapitalize, rightIcon }) => (
  <View style={styles.inputContainer}>
    <Ionicons name={icon} size={20} color={ZINC500} style={styles.inputIcon} />
    <TextInput
      testID={testID}
      style={styles.input}
      placeholder={placeholder}
      placeholderTextColor={ZINC600}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize || 'none'}
      autoCorrect={false}
    />
    {rightIcon}
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  // Blobs
  blob: { position: 'absolute', borderRadius: 999 },
  blob1: { width: 300, height: 300, backgroundColor: PRIMARY,    top: -80,  right: -80 },
  blob2: { width: 260, height: 260, backgroundColor: '#ff6b6b',  top: '35%', left: -80 },
  blob3: { width: 280, height: 280, backgroundColor: '#a55eea',  bottom: 40, right: -60 },
  // Layout
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 48, justifyContent: 'center' },
  // Header
  header: { alignItems: 'center', marginBottom: 32 },
  logoWrap: { marginBottom: 20 },
  logoBox: {
    width: 80, height: 80, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4, shadowRadius: 24, elevation: 16,
  },
  logoLetter: { fontSize: 36, fontWeight: '700', color: BG },
  heading: { fontSize: 34, fontWeight: '700', color: '#fff', letterSpacing: -0.5, marginBottom: 8 },
  subheading: { fontSize: 16, fontWeight: '500', color: MUTED },
  // Form card
  card: {
    backgroundColor: CARD, borderRadius: 24, padding: 28,
    borderWidth: 1, borderColor: BORDER,
  },
  toggle: {
    flexDirection: 'row', backgroundColor: BG,
    borderRadius: 14, padding: 4, marginBottom: 20,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  toggleActive: { backgroundColor: 'rgba(0,212,170,0.12)' },
  toggleText: { fontSize: 15, fontWeight: '500', color: MUTED },
  toggleTextActive: { color: PRIMARY, fontWeight: '700' },
  // Inputs
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: BG, borderRadius: 12,
    paddingHorizontal: 14, marginBottom: 14, height: 48,
    borderWidth: 1, borderColor: BORDER,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#fff' },
  eyeBtn: { padding: 4 },
  // Submit button
  submitWrap: { marginTop: 6 },
  submitBtn: {
    height: 54, borderRadius: 12, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
  },
  submitText: { fontSize: 16, fontWeight: '700', color: BG },
  forgotBtn: { alignItems: 'center', marginTop: 12, padding: 6 },
  forgotText: { color: MUTED, fontSize: 13 },
  switchRow: { alignItems: 'center', marginTop: 16 },
  switchText: { color: ZINC500, fontSize: 13 },
  switchLink: { color: PRIMARY, fontWeight: '700' },
  // Demo card
  demoCard: {
    marginTop: 20, backgroundColor: CARD, borderRadius: 24,
    padding: 24, borderWidth: 1, borderColor: BORDER,
  },
  demoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  demoHeaderText: { fontSize: 13, fontWeight: '700', color: ZINC300 },
  demoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: BG, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 8,
  },
  demoAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  demoAvatarText: { fontSize: 16, fontWeight: '700', color: BG },
  demoName: { fontSize: 14, fontWeight: '600', color: '#fff' },
  demoEmail: { fontSize: 12, color: ZINC500, marginTop: 1 },
  demoHint: { textAlign: 'center', marginTop: 8, fontSize: 12, color: ZINC500 },
});

export default AuthScreen;
