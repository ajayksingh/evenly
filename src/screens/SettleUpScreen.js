import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { useTheme } from '../context/ThemeContext';
import Avatar from '../components/Avatar';
import PressableScale from '../components/PressableScale';
import { recordSettlement, calculateBalances, getFriends } from '../services/storage';
import { sendWhatsAppMessage, buildSettlementWhatsAppMessage } from '../services/contacts';
import { formatAmount, getCurrencySymbol } from '../services/currency';
import { formatCurrency, getSimplifiedDebts } from '../utils/splitCalculator';
import { confirmAlert } from '../utils/alert';
import { isNarrow, rFontSize, rWidth } from '../utils/responsive';
import { showInterstitial } from '../services/ads';
import ShakeView from '../components/ShakeView';

const getPaymentMethods = (theme) => [
  { key: 'upi',  label: 'UPI',           icon: 'wallet',   color: theme.primary },
  { key: 'cash', label: 'Cash',          icon: 'cash',     color: theme.negative },
  { key: 'bank', label: 'Bank Transfer', icon: 'business', color: '#a55eea' },
];

const SettleUpScreen = ({ route, navigation }) => {
  const { theme, colorScheme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { user, balances: globalBalances, friends, currency, notifyWrite } = useApp();
  const { group, members } = route.params || {};
  const { preselectedPayer, preselectedReceiver, prefilledAmount } = route.params || {};

  const [payer, setPayer] = useState(null);
  const [receiver, setReceiver] = useState(null);
  const [amount, setAmount] = useState(prefilledAmount || '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'processing' | 'success'
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [settledAmount, setSettledAmount] = useState(0);
  const [settledWith, setSettledWith] = useState(null);

  const amountShakeRef = useRef(null);
  const spinAnim = useRef(new RNAnimated.Value(0)).current;
  const scrollY = useRef(new RNAnimated.Value(0)).current;

  // Celebration confetti particles
  const CONFETTI_COUNT = 12;
  const confettiAnims = useRef(
    Array.from({ length: CONFETTI_COUNT }, () => ({
      x: new RNAnimated.Value(0),
      y: new RNAnimated.Value(0),
      opacity: new RNAnimated.Value(1),
      scale: new RNAnimated.Value(0),
    }))
  ).current;
  const CONFETTI_COLORS = [theme.primary, '#00b4d8', '#ffd93d', theme.negative, '#a55eea', '#4fc3f7'];
  const headerBg = scrollY.interpolate({ inputRange: [0, 80], outputRange: [theme.headerBgTransparent, theme.headerBg], extrapolate: 'clamp' });
  const headerBorder = scrollY.interpolate({ inputRange: [0, 80], outputRange: ['transparent', theme.border], extrapolate: 'clamp' });

  const isWeb = Platform.OS === 'web';
  const screenOpacity = useSharedValue(isWeb ? 1 : 0);
  const screenTranslateY = useSharedValue(isWeb ? 0 : 32);
  const screenAnimStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
    transform: [{ translateY: screenTranslateY.value }],
  }));
  useFocusEffect(useCallback(() => {
    if (!isWeb) {
      screenOpacity.value = 0;
      screenTranslateY.value = 32;
      screenOpacity.value = withTiming(1, { duration: 380 });
      screenTranslateY.value = withSpring(0, { damping: 18, stiffness: 120 });
    }
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

  // Auto-suggest amount from balances — only when direction matches the actual debt
  useEffect(() => {
    if (payer && receiver) {
      if (payer.id === user.id) {
        // User is paying: only suggest if user actually owes the receiver (bal < 0)
        const bal = globalBalances.find(b => b.userId === receiver.id);
        if (bal && bal.amount < 0) setAmount(Math.abs(bal.amount).toFixed(2));
        else setAmount('');
      } else if (receiver.id === user.id) {
        // User is receiving: only suggest if payer actually owes the user (bal > 0)
        const bal = globalBalances.find(b => b.userId === payer.id);
        if (bal && bal.amount > 0) setAmount(bal.amount.toFixed(2));
        else setAmount('');
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
    if (isNaN(amt) || amt <= 0) { amountShakeRef.current?.shake(); Alert.alert('Error', 'Enter a valid amount'); return; }

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
      showInterstitial();
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
        setTimeout(() => navigation.popToTop(), 1500);
      }, 1000);
    } catch (e) {
      Alert.alert('Error', e.message);
      setSaving(false);
    }
  };

  // Get simplified debts — negate amounts to convert from user-perspective (positive = others owe user)
  // to getSimplifiedDebts convention (positive = this person is a creditor)
  const debts = getSimplifiedDebts(
    globalBalances.map(b => ({ userId: b.userId, name: b.name, amount: -b.amount }))
      .concat([{ userId: user.id, name: user.name, amount: globalBalances.reduce((s, b) => s + b.amount, 0) }])
  );

  // --- Processing state ---
  if (step === 'processing') {
    return (
      <View style={styles.centeredScreen}>
        <RNAnimated.View style={[styles.spinnerRing, { transform: [{ rotate: spin }] }]} />
        <Text style={styles.processingText}>Settling up...</Text>
      </View>
    );
  }

  // Trigger confetti burst when success step starts
  useEffect(() => {
    if (step === 'success') {
      confettiAnims.forEach((anim, i) => {
        const angle = (Math.PI * 2 * i) / CONFETTI_COUNT;
        const distance = 100 + Math.random() * 80;
        anim.scale.setValue(0);
        anim.x.setValue(0);
        anim.y.setValue(0);
        anim.opacity.setValue(1);
        RNAnimated.parallel([
          RNAnimated.spring(anim.scale, { toValue: 1, friction: 4, tension: 80, delay: i * 30, useNativeDriver: Platform.OS !== 'web' }),
          RNAnimated.timing(anim.x, { toValue: Math.cos(angle) * distance, duration: 600, delay: i * 30, useNativeDriver: Platform.OS !== 'web' }),
          RNAnimated.timing(anim.y, { toValue: Math.sin(angle) * distance - 40, duration: 600, delay: i * 30, useNativeDriver: Platform.OS !== 'web' }),
          RNAnimated.timing(anim.opacity, { toValue: 0, duration: 400, delay: 400 + i * 30, useNativeDriver: Platform.OS !== 'web' }),
        ]).start();
      });
    }
  }, [step]);

  // --- Success state ---
  if (step === 'success') {
    const name = settledWith?.name || '';
    const displayName = settledWith?.id === user.id ? 'You' : name;

    return (
      <View style={styles.centeredScreen}>
        {/* Confetti particles */}
        {confettiAnims.map((anim, i) => (
          <RNAnimated.View
            key={i}
            style={{
              position: 'absolute',
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              transform: [
                { translateX: anim.x },
                { translateY: anim.y },
                { scale: anim.scale },
              ],
              opacity: anim.opacity,
            }}
          />
        ))}
        <View style={styles.successCard}>
          <Text style={styles.celebrationEmoji}>🎉</Text>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={48} color="#ffffff" />
          </View>
          <Text style={styles.successTitle}>All settled!</Text>
          <Text style={styles.successSubtitle}>
            {'You settled '}
            <Text style={styles.successAmt}>{formatAmount(settledAmount, currency)}</Text>
            {' with '}
            <Text style={styles.successName}>{displayName}</Text>
          </Text>
          <Text style={[styles.successSubtitle, { marginTop: 8, color: theme.primary }]}>
            You and {displayName} are square
          </Text>
        </View>
      </View>
    );
  }

  // --- Form state ---
  return (
    <Animated.View style={[{ flex: 1 }, screenAnimStyle]}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <RNAnimated.View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: headerBorder }]}>
          <TouchableOpacity accessibilityLabel="Go back" activeOpacity={0.7} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
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
                  accessibilityLabel={`Select payer: ${p.id === user.id ? 'You' : p.name}`}
                  activeOpacity={0.7}
                  key={p.id}
                  onPress={() => { setPayer(p); if (receiver?.id === p.id) setReceiver(null); }}
                >
                  {payer?.id === p.id ? (
                    <LinearGradient
                      colors={theme.ctaGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.personBtnActive}
                    >
                      <Avatar name={p.name} size={44} />
                      <Text style={styles.personNameActive} numberOfLines={1}>
                        {p.id === user.id ? 'You' : p.name.split(' ')[0]}
                      </Text>
                      <View style={styles.selectedDot}><Ionicons name="checkmark" size={12} color="#fff" /></View>
                    </LinearGradient>
                  ) : (
                    <View style={styles.personBtn}>
                      <Avatar name={p.name} size={44} />
                      <Text style={styles.personName} numberOfLines={1}>
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
            <View style={styles.arrowCircle}><Ionicons name="arrow-forward" size={18} color={theme.primary} /></View>
            <View style={styles.arrowLine} />
          </View>

          {/* Receiver selection */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Who receives?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {allParties.filter(p => p.id !== payer?.id).map((p, idx) => (
                <TouchableOpacity
                  testID={idx === 0 ? 'settle-receiver-first' : `settle-receiver-${idx}`}
                  accessibilityLabel={`Select receiver: ${p.id === user.id ? 'You' : p.name}`}
                  activeOpacity={0.7}
                  key={p.id}
                  onPress={() => setReceiver(p)}
                >
                  {receiver?.id === p.id ? (
                    <LinearGradient
                      colors={theme.ctaGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.personBtnActive}
                    >
                      <Avatar name={p.name} size={44} />
                      <Text style={styles.personNameActive} numberOfLines={1}>
                        {p.id === user.id ? 'You' : p.name.split(' ')[0]}
                      </Text>
                      <View style={styles.selectedDot}><Ionicons name="checkmark" size={12} color="#fff" /></View>
                    </LinearGradient>
                  ) : (
                    <View style={styles.personBtn}>
                      <Avatar name={p.name} size={44} />
                      <Text style={styles.personName} numberOfLines={1}>
                        {p.id === user.id ? 'You' : p.name.split(' ')[0]}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Amount */}
          <ShakeView ref={amountShakeRef}>
          <View style={styles.amountSection}>
            <Text style={styles.sectionLabel}>Amount</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.currency}>{getCurrencySymbol(currency)}</Text>
              <TextInput
                testID="settle-amount-input"
                accessibilityLabel="Settlement amount"
                style={styles.amountText}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={theme.textMuted}
              />
            </View>
          </View>
          </ShakeView>

          {/* Note */}
          <View style={styles.noteSection}>
            <Text style={styles.sectionLabel}>Note (optional)</Text>
            <TextInput
              accessibilityLabel="Settlement note"
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Add a note..."
              placeholderTextColor={theme.textMuted}
              multiline
            />
          </View>

          {/* Payment Method */}
          <View style={styles.paymentMethodSection}>
            <Text style={styles.sectionLabel}>Payment Method</Text>
            <View style={styles.paymentMethodRow}>
              {getPaymentMethods(theme).map(method => {
                const isSelected = paymentMethod === method.key;
                return (
                  <TouchableOpacity
                    key={method.key}
                    accessibilityLabel={`Payment method: ${method.label}`}
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
                    <Text style={[styles.paymentMethodLabel, { color: isSelected ? theme.text : theme.textLight }]}>
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
                  accessibilityLabel={`${d.fromName} owes ${d.toName} ${formatCurrency(d.amount, currency)}`}
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
                  <Text style={styles.debtText} numberOfLines={1}>
                    <Text style={styles.debtName}>{d.fromName === user.name ? 'You' : d.fromName}</Text>
                    {' → '}
                    <Text style={styles.debtName}>{d.toName === user.name ? 'You' : d.toName}</Text>
                  </Text>
                  <View style={styles.debtAmountRow}>
                    <Text style={styles.debtAmount} numberOfLines={1}>{formatCurrency(d.amount, currency)}</Text>
                    <Ionicons name="arrow-forward-circle" size={18} color={theme.primary} style={{ marginLeft: 6 }} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </RNAnimated.ScrollView>

        <View style={styles.footer}>
          <PressableScale testID="settle-record-btn" accessibilityLabel="Record settlement" onPress={handleSettle} disabled={saving}>
            <LinearGradient
              colors={theme.ctaGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.settleBtn}
            >
              <Ionicons name="checkmark-circle" size={20} color={theme.background} />
              <Text style={styles.settleBtnText}>{saving ? 'Settling up...' : 'Settle Up'}</Text>
            </LinearGradient>
          </PressableScale>
        </View>
      </View>
    </KeyboardAvoidingView>
    </Animated.View>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: theme.card,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: theme.text, letterSpacing: -0.5 },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: theme.textLight,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },

  // Payer/receiver sections
  section: {
    backgroundColor: theme.card,
    margin: 16,
    marginBottom: 0,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  personBtn: {
    alignItems: 'center', marginRight: 12, padding: 12, borderRadius: 16,
    backgroundColor: theme.card,
    borderWidth: 1, borderColor: theme.border,
    position: 'relative', minWidth: rWidth(72, 60),
  },
  personBtnActive: {
    alignItems: 'center', marginRight: 12, padding: 12, borderRadius: 16,
    position: 'relative', minWidth: rWidth(72, 60),
  },
  personName: { fontSize: 13, color: theme.textLight, marginTop: 6, fontWeight: '500', textAlign: 'center' },
  personNameActive: { color: theme.text, fontWeight: '700', fontSize: 13, marginTop: 6 },
  selectedDot: {
    position: 'absolute', top: 6, right: 6,
    width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },

  arrowRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, marginVertical: 10 },
  arrowLine: { flex: 1, height: 1, backgroundColor: theme.border },
  arrowCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginHorizontal: 8,
  },

  // Amount card
  amountSection: {
    backgroundColor: theme.card,
    marginHorizontal: 16, marginTop: 12, marginBottom: 10,
    borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: theme.border,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  amountInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.inputBg,
    borderRadius: 16, padding: 16, marginTop: 4,
  },
  currency: { fontSize: 32, fontWeight: '700', color: theme.primary, marginRight: 8, fontVariant: ['tabular-nums'] },
  amountText: { flex: 1, fontSize: rFontSize(48), fontWeight: '700', color: theme.text, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },

  // Note
  noteSection: {
    backgroundColor: theme.card,
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: theme.border,
  },
  noteInput: {
    backgroundColor: theme.inputBg,
    borderRadius: 12, padding: 14, fontSize: 15,
    color: theme.text, minHeight: 60,
  },

  // Payment method
  paymentMethodSection: {
    backgroundColor: theme.card,
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: theme.border,
  },
  paymentMethodRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  paymentMethodBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 16, position: 'relative',
  },
  paymentMethodBtnSelected: {
    borderWidth: 2, borderColor: theme.primary,
    backgroundColor: theme.primaryLight,
  },
  paymentMethodBtnUnselected: {
    borderWidth: 1, borderColor: theme.border,
    backgroundColor: theme.inputBg,
  },
  paymentMethodIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  paymentMethodLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  paymentCheckmark: {
    position: 'absolute', top: 6, right: 6,
    width: 16, height: 16, borderRadius: 8, backgroundColor: theme.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  // Debts section
  debtsSection: {
    backgroundColor: theme.card,
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: theme.border,
  },
  debtRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: theme.card,
    borderRadius: 14, marginBottom: 8,
    borderWidth: 1, borderColor: theme.inputBg,
  },
  debtText: { fontSize: 14, color: theme.text, flex: 1, minWidth: 0 },
  debtName: { fontWeight: '600' },
  debtAmountRow: { flexDirection: 'row', alignItems: 'center' },
  debtAmount: { fontSize: 15, fontWeight: '700', color: theme.negative, fontVariant: ['tabular-nums'], flexShrink: 0 },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: theme.card, padding: 20,
    borderTopWidth: 1, borderTopColor: theme.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 10,
  },
  settleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, height: 52,
  },
  settleBtnText: { color: theme.background, fontWeight: '700', fontSize: 16, marginLeft: 8 },

  // Processing state
  centeredScreen: {
    flex: 1, backgroundColor: theme.background,
    alignItems: 'center', justifyContent: 'center',
  },
  spinnerRing: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: theme.primary,
    borderTopColor: 'transparent',
  },
  processingText: {
    marginTop: 20, fontSize: 16, color: theme.textLight, fontWeight: '500',
  },

  // Success state
  successCard: {
    backgroundColor: theme.card,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginHorizontal: 24,
    borderWidth: 1, borderColor: theme.border,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  celebrationEmoji: { fontSize: 40, marginBottom: 16 },
  successCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: theme.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10,
  },
  successTitle: { fontSize: 24, fontWeight: '700', color: theme.text, marginBottom: 10, letterSpacing: -0.5 },
  successSubtitle: { fontSize: 15, color: theme.textLight, textAlign: 'center', paddingHorizontal: 16 },
  successAmt: { color: theme.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
  successName: { color: theme.primary, fontWeight: '700' },
});

export default SettleUpScreen;
