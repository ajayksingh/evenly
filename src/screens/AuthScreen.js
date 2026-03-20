import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS } from '../constants/colors';

const AuthScreen = () => {
  const { login, register } = useApp();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

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
      if (mode === 'login') {
        await login(email.trim().toLowerCase(), password);
      } else {
        await register(name.trim(), email.trim().toLowerCase(), password);
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => { setEmail('alice@demo.com'); setPassword('demo123'); };

  return (
    <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.gradient}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoBox}>
              <Ionicons name="receipt" size={40} color={COLORS.primary} />
            </View>
            <Text style={styles.appName}>SplitWise</Text>
            <Text style={styles.tagline}>Split expenses, stay friends</Text>
          </View>

          <View style={styles.card}>
            {/* Tab Toggle */}
            <View style={styles.toggle}>
              <TouchableOpacity style={[styles.toggleBtn, mode === 'login' && styles.toggleActive]} onPress={() => setMode('login')}>
                <Text style={[styles.toggleText, mode === 'login' && styles.toggleTextActive]}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, mode === 'register' && styles.toggleActive]} onPress={() => setMode('register')}>
                <Text style={[styles.toggleText, mode === 'register' && styles.toggleTextActive]}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            {mode === 'register' && (
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={COLORS.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor={COLORS.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={COLORS.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={COLORS.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.textLight} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Password"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                <Ionicons name={showPass ? 'eye-off' : 'eye'} size={20} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>

            {mode === 'register' && (
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={COLORS.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor={COLORS.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPass}
                />
              </View>
            )}

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.submitText}>{mode === 'login' ? 'Sign In' : 'Create Account'}</Text>
              )}
            </TouchableOpacity>

            {mode === 'login' && (
              <TouchableOpacity style={styles.demoBtn} onPress={fillDemo}>
                <Ionicons name="flash" size={16} color={COLORS.primary} />
                <Text style={styles.demoText}>Use Demo Account (alice@demo.com)</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.footer}>
            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <Text style={styles.footerLink} onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  logoContainer: { alignItems: 'center', marginBottom: 32 },
  logoBox: {
    width: 80, height: 80, borderRadius: 20,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  appName: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  card: {
    backgroundColor: '#fff', borderRadius: 24, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  toggle: {
    flexDirection: 'row', backgroundColor: COLORS.background,
    borderRadius: 12, padding: 4, marginBottom: 20,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  toggleActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  toggleText: { fontSize: 15, fontWeight: '500', color: COLORS.textLight },
  toggleTextActive: { color: COLORS.text, fontWeight: '600' },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: 12,
    paddingHorizontal: 14, marginBottom: 12, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: COLORS.text },
  eyeBtn: { padding: 4 },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    height: 52, alignItems: 'center', justifyContent: 'center',
    marginTop: 8, shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3,
    shadowRadius: 8, elevation: 6,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  demoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 12, padding: 10,
  },
  demoText: { color: COLORS.primary, marginLeft: 6, fontSize: 13, fontWeight: '500' },
  footer: { textAlign: 'center', marginTop: 24, color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  footerLink: { color: '#fff', fontWeight: '700' },
});

export default AuthScreen;
