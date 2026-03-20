import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS } from '../constants/colors';
import Avatar from '../components/Avatar';
import { recordSettlement, calculateBalances, getFriends } from '../services/storage';
import { sendWhatsAppMessage, buildSettlementWhatsAppMessage } from '../services/contacts';
import { formatAmount, getCurrencySymbol } from '../services/currency';
import { formatCurrency, getSimplifiedDebts } from '../utils/splitCalculator';
import { confirmAlert } from '../utils/alert';

const SettleUpScreen = ({ route, navigation }) => {
  const { user, balances: globalBalances, friends, currency, refresh } = useApp();
  const { group, members } = route.params || {};
  const { preselectedPayer, preselectedReceiver } = route.params || {};

  const [payer, setPayer] = useState(null);
  const [receiver, setReceiver] = useState(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState('form'); // form | confirm

  const availableMembers = members || globalBalances.map(b => ({ id: b.userId, name: b.name, avatar: b.avatar }));
  const allParties = [
    { id: user.id, name: user.name, avatar: user.avatar },
    ...availableMembers.filter(m => m.id !== user.id),
  ];

  useEffect(() => {
    if (preselectedPayer) setPayer(allParties.find(p => p.id === preselectedPayer));
    if (preselectedReceiver) setReceiver(allParties.find(p => p.id === preselectedReceiver));
    if (!preselectedPayer) setPayer(allParties[0]);
  }, []);

  // Auto-suggest amount from balances
  useEffect(() => {
    if (payer && receiver) {
      const bal = globalBalances.find(b => b.userId === (payer.id === user.id ? receiver.id : payer.id));
      if (bal && Math.abs(bal.amount) > 0) {
        setAmount(Math.abs(bal.amount).toFixed(2));
      }
    }
  }, [payer, receiver]);

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
      refresh();

      // Check if we can notify via WhatsApp
      const otherParty = payer.id === user.id ? receiver : payer;
      const friendWithPhone = friends.find(f => f.id === otherParty.id && f.phone);

      if (friendWithPhone) {
        confirmAlert({
          title: 'Payment Recorded!',
          message: `${payer.id === user.id ? 'You' : payer.name} paid ${receiver.id === user.id ? 'you' : receiver.name} ${formatAmount(amt, currency)}`,
          confirmText: 'Notify via WhatsApp',
          cancelText: 'Done',
          onConfirm: async () => {
            const msg = buildSettlementWhatsAppMessage({
              payerName: payer.id === user.id ? user.name : payer.name,
              receiverName: receiver.id === user.id ? user.name : receiver.name,
              amount: amt,
              currency,
            });
            await sendWhatsAppMessage(friendWithPhone.phone, msg);
            navigation.goBack();
          },
          onCancel: () => navigation.goBack(),
        });
      } else {
        Alert.alert(
          'Payment Recorded!',
          `${formatAmount(amt, currency)} payment logged`,
          [{ text: 'Done', onPress: () => navigation.goBack() }]
        );
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  // Get simplified debts
  const debts = getSimplifiedDebts(
    globalBalances.map(b => ({ userId: b.userId, name: b.name, amount: b.amount }))
      .concat([{ userId: user.id, name: user.name, amount: -globalBalances.reduce((s, b) => s + b.amount, 0) }])
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settle Up</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Payer selection */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Who's paying?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {allParties.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.personBtn, payer?.id === p.id && styles.personBtnActive]}
                  onPress={() => { setPayer(p); if (receiver?.id === p.id) setReceiver(null); }}
                >
                  <Avatar name={p.name} size={44} />
                  <Text style={[styles.personName, payer?.id === p.id && styles.personNameActive]}>
                    {p.id === user.id ? 'You' : p.name.split(' ')[0]}
                  </Text>
                  {payer?.id === p.id && (
                    <View style={styles.selectedDot}><Ionicons name="checkmark" size={12} color="#fff" /></View>
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
              {allParties.filter(p => p.id !== payer?.id).map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.personBtn, receiver?.id === p.id && styles.personBtnActive]}
                  onPress={() => setReceiver(p)}
                >
                  <Avatar name={p.name} size={44} />
                  <Text style={[styles.personName, receiver?.id === p.id && styles.personNameActive]}>
                    {p.id === user.id ? 'You' : p.name.split(' ')[0]}
                  </Text>
                  {receiver?.id === p.id && (
                    <View style={styles.selectedDot}><Ionicons name="checkmark" size={12} color="#fff" /></View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Amount */}
          <View style={styles.amountSection}>
            <Text style={styles.sectionLabel}>Amount</Text>
            <View style={styles.amountInput}>
              <Text style={styles.currency}>$</Text>
              <TextInput
                style={styles.amountText}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
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

          {/* Current Debts */}
          {debts.length > 0 && (
            <View style={styles.debtsSection}>
              <Text style={styles.sectionLabel}>Outstanding Balances</Text>
              {debts.map((d, idx) => (
                <TouchableOpacity
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
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.settleBtn} onPress={handleSettle} disabled={saving}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.settleBtnText}>{saving ? 'Recording...' : 'Record Payment'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  section: { backgroundColor: COLORS.white, margin: 16, borderRadius: 14, padding: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  personBtn: {
    alignItems: 'center', marginRight: 16, padding: 10, borderRadius: 12,
    backgroundColor: COLORS.background, position: 'relative', minWidth: 70,
  },
  personBtnActive: { backgroundColor: COLORS.primaryLight },
  personName: { fontSize: 13, color: COLORS.textLight, marginTop: 6, fontWeight: '500' },
  personNameActive: { color: COLORS.primary, fontWeight: '700' },
  selectedDot: {
    position: 'absolute', top: 6, right: 6,
    width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  arrowRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, marginVertical: -4 },
  arrowLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  arrowCircle: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginHorizontal: 8,
  },
  amountSection: { backgroundColor: COLORS.white, marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 16 },
  amountInput: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background,
    borderRadius: 12, padding: 14, marginTop: 4,
  },
  currency: { fontSize: 28, fontWeight: '700', color: COLORS.textLight, marginRight: 6 },
  amountText: { flex: 1, fontSize: 36, fontWeight: '800', color: COLORS.text },
  noteSection: { backgroundColor: COLORS.white, marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 16 },
  noteInput: {
    backgroundColor: COLORS.background, borderRadius: 12, padding: 14, fontSize: 15,
    color: COLORS.text, minHeight: 60,
  },
  debtsSection: { backgroundColor: COLORS.white, marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 16 },
  debtRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  debtText: { fontSize: 14, color: COLORS.text },
  debtName: { fontWeight: '600' },
  debtAmountRow: { flexDirection: 'row', alignItems: 'center' },
  debtAmount: { fontSize: 15, fontWeight: '700', color: COLORS.negative },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 10,
  },
  settleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, borderRadius: 14, padding: 16,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  settleBtnText: { color: '#fff', fontWeight: '700', fontSize: 16, marginLeft: 8 },
});

export default SettleUpScreen;
