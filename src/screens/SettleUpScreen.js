import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, KeyboardAvoidingView, Platform,
  ActivityIndicator, Animated as RNAnimated,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS } from '../constants/colors';
import Avatar from '../components/Avatar';
import { recordSettlement, calculateBalances, getFriends } from '../services/storage';
import { sendWhatsAppMessage, buildSettlementWhatsAppMessage } from '../services/contacts';
import { formatAmount, getCurrencySymbol } from '../services/currency';
import { formatCurrency, getSimplifiedDebts } from '../utils/splitCalculator';
import { confirmAlert } from '../utils/alert';

const PAYMENT_METHODS = [
  { key: 'upi',  label: 'UPI',           icon: 'wallet',   color: '#00d4aa' },
  { key: 'cash', label: 'Cash',          icon: 'cash',     color: '#ff6b6b' },
  { key: 'bank', label: 'Bank Transfer', icon: 'business', color: '#a55eea' },
];

const SettleUpScreen = ({ route, navigation }) => {
  const { user, balances: globalBalances, friends, currency, notifyWrite } = useApp();
  const { group, members } = route.params || {};
  const { preselectedPayer, preselectedReceiver } = route.params || {};

  const [payer, setPayer] = useState(null);
  const [receiver, setReceiver] = useState(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'processing' | 'success'
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [settledAmount, setSettledAmount] = useState(0);
  const [settledWith, setSettledWith] = useState(null);

  const spinAnim = useRef(new RNAnimated.Value(0)).current;
  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const headerBg = scrollY.interpolate({ inputRange: [0, 80], outputRange: ['rgba(10,10,15,0)', 'rgba(10,10,15,0.97)'], extrapolate: 'clamp' });
  const headerBorder = scrollY.interpolate({ inputRange: [0, 80], outputRange: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.08)'], extrapolate: 'clamp' });

  const screenOpacity = useSharedValue(0);
  const screenTranslateY = useSharedValue(32);
  const screenAnimStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
    transform: [{ translateY: screenTranslateY.value }],
  }));
  useFocusEffect(useCallback(() => {
    screenOpacity.value = 0;
    screenTranslateY.value = 32;
    screenOpacity.value = withTiming(1, { duration: 380 });
    screenTranslateY.value = withSpring(0, { damping: 18, stiffness: 120 });
  }, []));

  const availableMembers = members || (() => {
    const fromBalances = globalBalances.map(b => ({ id: b.userId, name: b.name, avatar: b.avatar }));
    const fromFriends = friends.filter(f => !fromBalances.some(b => b.id === f.id));
    return [...fromBalances, ...fromFriends];
  })();
  const allParties = [
    { id: user.id, name: user.name, avatar: user.avatar },
    ...availableMembers.filter(m => m.id !== user.id),
  ];

  useEffect(() => {
    if (preselectedPayer) setPayer(allParties.find(p => p.id === preselectedPayer));
    if (preselectedReceiver) setReceiver(allParties.find(p => p.id === preselectedReceiver));
    if (!preselectedPayer && allParties.length > 0) setPayer(allParties[0]);
  }, []);

  // Auto-suggest amount from balances
  useEffect(() => {
    if (payer && receiver) {
      let balanceUserId = null;
      if (payer.id === user.id) balanceUserId = receiver.id;
      else if (receiver.id === user.id) balanceUserId = payer.id;
      if (balanceUserId) {
        const bal = globalBalances.find(b => b.userId === balanceUserId);
        if (bal && Math.abs(bal.amount) > 0) setAmount(Math.abs(bal.amount).toFixed(2));
      }
    }
  }, [payer, receiver]);

  // Spin animation for processing state
  useEffect(() => {
    if (step === 'processing') {
      RNAnimated.loop(
        RNAnimated.timing(spinAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: Platform.OS !== 'web',
        })
      ).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [step]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleSettle = async () => {
    if (!payer || !receiver) { Alert.alert('Error', 'Select payer and receiver'); return; }
    if (payer.id === receiver.id) { Alert.alert('Error', 'Payer and receiver must be different'); return; }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { Alert.alert('Error', 'Enter a valid amount'); return; }

    setSaving(true);
    try {
      await recordSettlement({
        paidBy: payer.id,
        paidTo: receiver.id,
        amount: amt,
        currency,
        note: note.trim(),
        groupId: group?.id || null,
      });
      notifyWrite('settlement');

      // Store for success screen
      const otherParty = payer.id === user.id ? receiver : payer;
      setSettledAmount(amt);
      setSettledWith(otherParty);

      // Check if we can notify via WhatsApp
      const friendWithPhone = friends.find(f => f.id === otherParty.id && f.phone);

      // Transition to processing → success → navigate
      setStep('processing');
      setTimeout(() => {
        setStep('success');
        if (friendWithPhone) {
          const msg = buildSettlementWhatsAppMessage({
            payerName: payer.id === user.id ? user.name : payer.name,
            receiverName: receiver.id === user.id ? user.name : receiver.name,
            amount: amt,
            currency,
          });
          sendWhatsAppMessage(friendWithPhone.phone, msg).catch(() => {});
        }
        setTimeout(() => navigation.navigate('Main'), 1500);
      }, 1000);
    } catch (e) {
      Alert.alert('Error', e.message);
      setSaving(false);
    }
  };

  // Get simplified debts
  const debts = getSimplifiedDebts(
    globalBalances.map(b => ({ userId: b.userId, name: b.name, amount: b.amount }))
      .concat([{ userId: user.id, name: user.name, amount: -globalBalances.reduce((s, b) => s + b.amount, 0) }])
  );

  // --- Processing state ---
  if (step === 'processing') {
    return (
      <View style={styles.centeredScreen}>
        <RNAnimated.View style={[styles.spinnerRing, { transform: [{ rotate: spin }] }]} />
        <Text style={styles.processingText}>Processing payment...</Text>
      </View>
    );
  }

  // --- Success state ---
  if (step === 'success') {
    const name = settledWith?.name || '';
    const displayName = settledWith?.id === user.id ? 'You' : name;
    return (
      <View style={styles.centeredScreen}>
        <View style={styles.successCard}>
          <Text style={styles.celebrationEmoji}>🎉</Text>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={48} color="#ffffff" />
          </View>
          <Text style={styles.successTitle}>Payment Successful!</Text>
          <Text style={styles.successSubtitle}>
            {'You settled '}
            <Text style={styles.successAmt}>{formatAmount(settledAmount, currency)}</Text>
            {' with '}
            <Text style={styles.successName}>{displayName}</Text>
          </Text>
        </View>
      </View>
    );
  }

  // --- Form state ---
  return (
    <Animated.View style={[{ flex: 1 }, screenAnimStyle]}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ flex: 1 }}>
      <View style={styles.container}>
        <RNAnimated.View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: headerBorder }]}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settle Up</Text>
          <View style={{ width: 24 }} />
        </RNAnimated.View>

        <RNAnimated.ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={RNAnimated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        >
          {/* Payer selection */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Who's paying?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {allParties.map(p => (
                <TouchableOpacity
                  activeOpacity={0.7}
                  key={p.id}
                  onPress={() => { setPayer(p); if (receiver?.id === p.id) setReceiver(null); }}
                >
                  {payer?.id === p.id ? (
                    <LinearGradient
                      colors={['#00d4aa', '#00b894']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.personBtnActive}
                    >
                      <Avatar name={p.name} size={44} />
                      <Text style={styles.personNameActive}>
                        {p.id === user.id ? 'You' : p.name.split(' ')[0]}
                      </Text>
                      <View style={styles.selectedDot}><Ionicons name="checkmark" size={12} color="#fff" /></View>
                    </LinearGradient>
                  ) : (
                    <View style={styles.personBtn}>
                      <Avatar name={p.name} size={44} />
                      <Text style={styles.personName}>
                        {p.id === user.id ? 'You' : p.name.split(' ')[0]}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.arrowRow}>
            <View style={styles.arrowLine} />
            <View style={styles.arrowCircle}><Ionicons name="arrow-forward" size={18} color={COLORS.primary} /></View>
            <View style={styles.arrowLine} />
          </View>

          {/* Receiver selection */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Who receives?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {allParties.filter(p => p.id !== payer?.id).map((p, idx) => (
                <TouchableOpacity
                  testID={idx === 0 ? 'settle-receiver-first' : `settle-receiver-${idx}`}
                  activeOpacity={0.7}
                  key={p.id}
                  onPress={() => setReceiver(p)}
                >
                  {receiver?.id === p.id ? (
                    <LinearGradient
                      colors={['#00d4aa', '#00b894']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.personBtnActive}
                    >
                      <Avatar name={p.name} size={44} />
                      <Text style={styles.personNameActive}>
                        {p.id === user.id ? 'You' : p.name.split(' ')[0]}
                      </Text>
                      <View style={styles.selectedDot}><Ionicons name="checkmark" size={12} color="#fff" /></View>
                    </LinearGradient>
                  ) : (
                    <View style={styles.personBtn}>
                      <Avatar name={p.name} size={44} />
                      <Text style={styles.personName}>
                        {p.id === user.id ? 'You' : p.name.split(' ')[0]}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Amount */}
          <View style={styles.amountSection}>
            <Text style={styles.sectionLabel}>Amount</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.currency}>{getCurrencySymbol(currency)}</Text>
              <TextInput
                testID="settle-amount-input"
                style={styles.amountText}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.2)"
              />
            </View>
          </View>

          {/* Note */}
          <View style={styles.noteSection}>
            <Text style={styles.sectionLabel}>Note (optional)</Text>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Add a note..."
              placeholderTextColor={COLORS.textMuted}
              multiline
            />
          </View>

          {/* Payment Method */}
          <View style={styles.paymentMethodSection}>
            <Text style={styles.sectionLabel}>Payment Method</Text>
            <View style={styles.paymentMethodRow}>
              {PAYMENT_METHODS.map(method => {
                const isSelected = paymentMethod === method.key;
                return (
                  <TouchableOpacity
                    key={method.key}
                    activeOpacity={0.7}
                    style={[
                      styles.paymentMethodBtn,
                      isSelected ? styles.paymentMethodBtnSelected : styles.paymentMethodBtnUnselected,
                    ]}
                    onPress={() => setPaymentMethod(method.key)}
                  >
                    {isSelected && (
                      <View style={styles.paymentCheckmark}>
                        <Ionicons name="checkmark" size={10} color="#fff" />
                      </View>
                    )}
                    <View style={[styles.paymentMethodIcon, { backgroundColor: method.color + '26' }]}>
                      <Ionicons name={method.icon} size={22} color={method.color} />
                    </View>
                    <Text style={[styles.paymentMethodLabel, { color: isSelected ? '#ffffff' : '#a1a1aa' }]}>
                      {method.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Current Debts */}
          {debts.length > 0 && (
            <View style={styles.debtsSection}>
              <Text style={styles.sectionLabel}>Outstanding Balances</Text>
              {debts.map((d, idx) => (
                <TouchableOpacity
                  activeOpacity={0.7}
                  key={idx}
                  style={styles.debtRow}
                  onPress={() => {
                    const p = allParties.find(p => p.id === d.from || p.name === d.fromName);
                    const r = allParties.find(p => p.id === d.to || p.name === d.toName);
                    if (p) setPayer(p);
                    if (r) setReceiver(r);
                    setAmount(d.amount.toFixed(2));
                  }}
                >
                  <Text style={styles.debtText}>
                    <Text style={styles.debtName}>{d.fromName === user.name ? 'You' : d.fromName}</Text>
                    {' → '}
                    <Text style={styles.debtName}>{d.toName === user.name ? 'You' : d.toName}</Text>
                  </Text>
                  <View style={styles.debtAmountRow}>
                    <Text style={styles.debtAmount}>{formatCurrency(d.amount)}</Text>
                    <Ionicons name="arrow-forward-circle" size={18} color={COLORS.primary} style={{ marginLeft: 6 }} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </RNAnimated.ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity testID="settle-record-btn" activeOpacity={0.8} onPress={handleSettle} disabled={saving}>
            <LinearGradient
              colors={['#00d4aa', '#00b894']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.settleBtn}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.settleBtnText}>{saving ? 'Recording...' : 'Record Payment'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#1a1a24',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#ffffff' },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#a1a1aa',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },

  // Payer/receiver sections
  section: {
    backgroundColor: '#1a1a24',
    margin: 16,
    marginBottom: 0,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  personBtn: {
    alignItems: 'center', marginRight: 12, padding: 12, borderRadius: 16,
    backgroundColor: '#1a1a24',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative', minWidth: 72,
  },
  personBtnActive: {
    alignItems: 'center', marginRight: 12, padding: 12, borderRadius: 16,
    position: 'relative', minWidth: 72,
  },
  personName: { fontSize: 13, color: '#a1a1aa', marginTop: 6, fontWeight: '500' },
  personNameActive: { color: '#ffffff', fontWeight: '700', fontSize: 13, marginTop: 6 },
  selectedDot: {
    position: 'absolute', top: 6, right: 6,
    width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },

  arrowRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, marginVertical: 10 },
  arrowLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  arrowCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,212,170,0.12)',
    alignItems: 'center', justifyContent: 'center', marginHorizontal: 8,
  },

  // Amount card
  amountSection: {
    backgroundColor: '#1a1a24',
    marginHorizontal: 16, marginTop: 12, marginBottom: 10,
    borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#00d4aa',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  amountInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 16, marginTop: 4,
  },
  currency: { fontSize: 32, fontWeight: '700', color: '#00d4aa', marginRight: 8 },
  amountText: { flex: 1, fontSize: 48, fontWeight: '800', color: '#ffffff' },

  // Note
  noteSection: {
    backgroundColor: '#1a1a24',
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  noteInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, padding: 14, fontSize: 15,
    color: '#ffffff', minHeight: 60,
  },

  // Payment method
  paymentMethodSection: {
    backgroundColor: '#1a1a24',
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  paymentMethodRow: { flexDirection: 'row', gap: 10 },
  paymentMethodBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 16, position: 'relative',
  },
  paymentMethodBtnSelected: {
    borderWidth: 2, borderColor: '#00d4aa',
    backgroundColor: 'rgba(0,212,170,0.10)',
  },
  paymentMethodBtnUnselected: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  paymentMethodIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  paymentMethodLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  paymentCheckmark: {
    position: 'absolute', top: 6, right: 6,
    width: 16, height: 16, borderRadius: 8, backgroundColor: '#00d4aa',
    alignItems: 'center', justifyContent: 'center',
  },

  // Debts section
  debtsSection: {
    backgroundColor: '#1a1a24',
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  debtRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: '#1a1a24',
    borderRadius: 14, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  debtText: { fontSize: 14, color: '#ffffff' },
  debtName: { fontWeight: '600' },
  debtAmountRow: { flexDirection: 'row', alignItems: 'center' },
  debtAmount: { fontSize: 15, fontWeight: '700', color: COLORS.negative },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#1a1a24', padding: 20,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 10,
  },
  settleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, height: 52,
  },
  settleBtnText: { color: '#fff', fontWeight: '700', fontSize: 16, marginLeft: 8 },

  // Processing state
  centeredScreen: {
    flex: 1, backgroundColor: '#0a0a0f',
    alignItems: 'center', justifyContent: 'center',
  },
  spinnerRing: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: '#00d4aa',
    borderTopColor: 'transparent',
  },
  processingText: {
    marginTop: 20, fontSize: 16, color: '#a1a1aa', fontWeight: '500',
  },

  // Success state
  successCard: {
    backgroundColor: '#1a1a24',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginHorizontal: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#00d4aa',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  celebrationEmoji: { fontSize: 40, marginBottom: 16 },
  successCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#00d4aa',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#00d4aa', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10,
  },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#ffffff', marginBottom: 10 },
  successSubtitle: { fontSize: 15, color: '#a1a1aa', textAlign: 'center', paddingHorizontal: 16 },
  successAmt: { color: '#ffffff', fontWeight: '700' },
  successName: { color: '#00d4aa', fontWeight: '700' },
});

export default SettleUpScreen;
