import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS, CATEGORIES } from '../constants/colors';
import Avatar from '../components/Avatar';
import { addExpense, getGroups } from '../services/storage';
import { sendWhatsAppMessage, buildExpenseWhatsAppMessage } from '../services/contacts';
import { SPLIT_TYPES, calculateEqualSplit, calculatePercentageSplit, calculateSharesSplit, formatCurrency } from '../utils/splitCalculator';
import { formatAmount, getCurrencySymbol } from '../services/currency';
import { confirmAlert } from '../utils/alert';
import { hapticMedium, hapticSuccess, hapticError } from '../utils/haptics';

const AddExpenseScreen = ({ route, navigation }) => {
  const { user, groups, friends, currency, refresh, notifyWrite } = useApp();
  const { groupId: initGroupId, groupName: initGroupName, members: initMembers } = route.params || {};

  const descriptionRef = useRef('');
  const amountRef = useRef('');
  const [category, setCategory] = useState('general');
  const [paidBy, setPaidBy] = useState(null);
  const [splitType, setSplitType] = useState(SPLIT_TYPES.EQUAL);
  const [selectedGroup, setSelectedGroup] = useState(initGroupId ? { id: initGroupId, name: initGroupName, members: initMembers } : null);
  const [participants, setParticipants] = useState([]);
  const [exactAmounts, setExactAmounts] = useState({});
  const [percentages, setPercentages] = useState({});
  const [shares, setShares] = useState({});
  const [showGroupPicker, setShowGroupPicker] = useState(!initGroupId);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showSplitOptions, setShowSplitOptions] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedGroup) {
      const allMembers = selectedGroup.members || [];
      setParticipants(allMembers);
      const init = {};
      allMembers.forEach(m => { init[m.id] = 0; });
      setExactAmounts(init);
      setPercentages(init);
      setShares(allMembers.reduce((s, m) => ({ ...s, [m.id]: 1 }), {}));
      setPaidBy(allMembers.find(m => m.id === user.id) || allMembers[0] || null);
    }
  }, [selectedGroup, user]);

  const getSplits = () => {
    const amt = parseFloat(amountRef.current);
    if (isNaN(amt) || amt <= 0) return [];
    switch (splitType) {
      case SPLIT_TYPES.EQUAL:
        return calculateEqualSplit(amt, participants);
      case SPLIT_TYPES.EXACT:
        return participants.map(m => ({ userId: m.id, name: m.name, amount: parseFloat(exactAmounts[m.id] || 0) }));
      case SPLIT_TYPES.PERCENTAGE:
        return calculatePercentageSplit(amt, participants, percentages);
      case SPLIT_TYPES.SHARES:
        return calculateSharesSplit(amt, participants, shares);
      default:
        return calculateEqualSplit(amt, participants);
    }
  };

  const validate = () => {
    if (!descriptionRef.current.trim()) { Alert.alert('Error', 'Add a description'); return false; }
    const amt = parseFloat(amountRef.current);
    if (isNaN(amt) || amt <= 0) { Alert.alert('Error', 'Enter a valid amount'); return false; }
    if (!selectedGroup) { Alert.alert('Error', 'Select a group'); return false; }
    if (!paidBy) { Alert.alert('Error', 'Select who paid'); return false; }
    if (splitType === SPLIT_TYPES.EXACT) {
      const total = Object.values(exactAmounts).reduce((s, v) => s + parseFloat(v || 0), 0);
      if (Math.abs(total - amt) > 0.01) {
        Alert.alert('Error', `Exact amounts total ${formatCurrency(total)}, should be ${formatCurrency(amt)}`);
        return false;
      }
    }
    if (splitType === SPLIT_TYPES.PERCENTAGE) {
      const total = Object.values(percentages).reduce((s, v) => s + parseFloat(v || 0), 0);
      if (Math.abs(total - 100) > 0.01) {
        Alert.alert('Error', `Percentages total ${total.toFixed(1)}%, should be 100%`);
        return false;
      }
    }
    if (splitType === SPLIT_TYPES.SHARES) {
      const total = Object.values(shares).reduce((s, v) => s + (v || 0), 0);
      if (total === 0) {
        Alert.alert('Error', 'Each person needs at least 1 share');
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
if (!validate()) { hapticError(); return; }
    hapticMedium();
    setSaving(true);
    try {
      const splits = getSplits();
      const expense = await addExpense({
        description: descriptionRef.current.trim(),
        amount: parseFloat(amountRef.current),
        currency,
        category,
        groupId: selectedGroup.id,
        groupName: selectedGroup.name,
        paidBy: { id: paidBy.id, name: paidBy.name, avatar: paidBy.avatar },
        splits: [...splits],
        date: new Date().toISOString(),
      });
      hapticSuccess();
      notifyWrite('add_expense');

      // WhatsApp notifications: ask user if they want to notify others
      const otherSplits = splits.filter(s => s.userId !== user.id && s.amount > 0);
      if (otherSplits.length > 0 && paidBy.id === user.id) {
        // Find friends with phone numbers
        const friendsWithPhone = friends.filter(f =>
          otherSplits.some(s => s.userId === f.id) && f.phone
        );
        if (friendsWithPhone.length > 0) {
          confirmAlert({
            title: 'Notify via WhatsApp?',
            message: `Send expense split details to ${friendsWithPhone.length} friend${friendsWithPhone.length > 1 ? 's' : ''}?`,
            confirmText: 'Send WhatsApp',
            cancelText: 'Skip',
            onCancel: () => navigation.goBack(),
            onConfirm: async () => {
              for (const friend of friendsWithPhone) {
                const split = splits.find(s => s.userId === friend.id);
                if (split) {
                  const msg = buildExpenseWhatsAppMessage({
                    expense: { description: descriptionRef.current.trim(), amount: parseFloat(amountRef.current) },
                    paidBy: paidBy.id === user.id ? 'You' : paidBy.name,
                    splitAmount: split.amount,
                    groupName: selectedGroup.name,
                    currency,
                  });
                  await sendWhatsAppMessage(friend.phone, msg);
                }
              }
              navigation.goBack();
            },
          });
          return;
        }
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const catInfo = CATEGORIES.find(c => c.id === category) || CATEGORIES[8];
  const splits = getSplits();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ flex: 1 }}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Expense</Text>
          <TouchableOpacity testID="expense-save-btn" activeOpacity={0.7} onPress={handleSave} disabled={saving}>
            <LinearGradient
              colors={['#00d4aa', '#00b894']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveBtn}
            >
              <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Amount Input */}
          <View style={styles.amountSection}>
            <TouchableOpacity activeOpacity={0.7} style={styles.catBtn} onPress={() => setShowCatPicker(true)}>
              <Ionicons name={catInfo.icon} size={24} color={catInfo.color} />
              <Text style={styles.catBtnLabel}>{catInfo.label}</Text>
            </TouchableOpacity>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>{getCurrencySymbol(currency)}</Text>
              <TextInput
                testID="expense-amount-input"
                style={styles.amountInput}
                placeholder="0.00"
                onChangeText={v => { amountRef.current = v; }}
                keyboardType="decimal-pad"
                placeholderTextColor="rgba(255,255,255,0.2)"
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.formCard}>
            <Text style={styles.sectionLabel}>DESCRIPTION</Text>
            <TextInput
              testID="expense-description-input"
              style={styles.descInput}
              placeholder="What's this expense for?"
              onChangeText={v => { descriptionRef.current = v; }}
              placeholderTextColor={COLORS.textMuted}
              autoCorrect={false}
              autoCapitalize="sentences"
              keyboardType="default"
            />
          </View>

          {/* Group */}
          <TouchableOpacity activeOpacity={0.7} style={styles.formCard} onPress={() => setShowGroupPicker(true)}>
            <Text style={styles.sectionLabel}>GROUP</Text>
            <View style={styles.fieldRow}>
              <View style={styles.fieldIcon}><Ionicons name="people" size={20} color={COLORS.primary} /></View>
              <Text style={[styles.fieldText, !selectedGroup && styles.placeholder]}>
                {selectedGroup ? selectedGroup.name : 'Select a group'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
            </View>
          </TouchableOpacity>

          {/* Paid By */}
          {selectedGroup && (
            <View style={styles.formCard}>
              <Text style={styles.sectionLabel}>PAID BY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.paidByScroll}>
                {participants.map(m => (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    key={m.id}
                    onPress={() => setPaidBy(m)}
                  >
                    {paidBy?.id === m.id ? (
                      <LinearGradient
                        colors={['#00d4aa', '#00b894']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.paidByBtn}
                      >
                        <Text style={styles.paidByTextActive}>
                          {m.id === user.id ? 'You' : (m.name || '').split(' ')[0]}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.paidByBtnInactive}>
                        <Text style={styles.paidByText}>
                          {m.id === user.id ? 'You' : (m.name || '').split(' ')[0]}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Split Type */}
          {selectedGroup && (
            <TouchableOpacity activeOpacity={0.7} style={styles.formCard} onPress={() => setShowSplitOptions(true)}>
              <Text style={styles.sectionLabel}>SPLIT</Text>
              <View style={styles.fieldRow}>
                <View style={styles.fieldIcon}><Ionicons name="git-branch" size={20} color={COLORS.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.splitTypeText}>
                    {{
                      [SPLIT_TYPES.EQUAL]: 'Equally',
                      [SPLIT_TYPES.EXACT]: 'By exact amounts',
                      [SPLIT_TYPES.PERCENTAGE]: 'By percentage',
                      [SPLIT_TYPES.SHARES]: 'By shares',
                    }[splitType]}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
              </View>
            </TouchableOpacity>
          )}

          {/* Split Preview */}
          {selectedGroup && splits.length > 0 && (
            <View style={styles.splitsSection}>
              <Text style={styles.sectionLabel}>SPLIT PREVIEW</Text>

              {splitType === SPLIT_TYPES.EXACT && participants.map(m => (
                <View key={m.id} style={styles.splitInputRow}>
                  <Avatar name={m.name} size={36} />
                  <Text style={styles.splitName}>{m.id === user.id ? 'You' : (m.name || '').split(' ')[0]}</Text>
                  <View style={styles.splitExactInput}>
                    <Text style={styles.splitCurrency}>{getCurrencySymbol(currency)}</Text>
                    <TextInput
                      style={styles.splitInput}
                      value={String(exactAmounts[m.id] || '')}
                      onChangeText={v => setExactAmounts(prev => ({ ...prev, [m.id]: v }))}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={COLORS.textMuted}
                    />
                  </View>
                </View>
              ))}

              {splitType === SPLIT_TYPES.PERCENTAGE && participants.map(m => (
                <View key={m.id} style={styles.splitInputRow}>
                  <Avatar name={m.name} size={36} />
                  <Text style={styles.splitName}>{m.id === user.id ? 'You' : (m.name || '').split(' ')[0]}</Text>
                  <View style={styles.splitExactInput}>
                    <TextInput
                      style={styles.splitInput}
                      value={String(percentages[m.id] || '')}
                      onChangeText={v => setPercentages(prev => ({ ...prev, [m.id]: v }))}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={COLORS.textMuted}
                    />
                    <Text style={styles.splitCurrency}>%</Text>
                  </View>
                </View>
              ))}

              {splitType === SPLIT_TYPES.SHARES && participants.map(m => (
                <View key={m.id} style={styles.splitInputRow}>
                  <Avatar name={m.name} size={36} />
                  <Text style={styles.splitName}>{m.id === user.id ? 'You' : (m.name || '').split(' ')[0]}</Text>
                  <View style={styles.sharesControl}>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => setShares(prev => ({ ...prev, [m.id]: Math.max(0, (prev[m.id] || 1) - 1) }))}>
                      <Ionicons name="remove-circle" size={28} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Text style={styles.sharesCount}>{shares[m.id] || 0}</Text>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => setShares(prev => ({ ...prev, [m.id]: (prev[m.id] || 0) + 1 }))}>
                      <Ionicons name="add-circle" size={28} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {splitType === SPLIT_TYPES.EQUAL && splits.map(s => (
                <View key={s.userId} style={styles.splitPreviewRow}>
                  <Avatar name={s.name} size={36} />
                  <Text style={styles.splitPreviewName}>{s.userId === user.id ? 'You' : (s.name || '').split(' ')[0]}</Text>
                  <Text style={styles.splitPreviewAmount}>{formatCurrency(s.amount)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Save Button */}
          <TouchableOpacity testID="expense-save-bottom-btn" activeOpacity={0.8} onPress={handleSave} disabled={saving} style={styles.saveBottomWrapper}>
            <LinearGradient
              colors={['#00d4aa', '#00b894']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveBottomBtn}
            >
              <Text style={styles.saveBottomText}>{saving ? 'Saving...' : 'Save Expense'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Group Picker Modal */}
        <Modal visible={showGroupPicker} animationType="slide" presentationStyle="formSheet">
          <View style={styles.modal}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <TouchableOpacity activeOpacity={0.7} onPress={() => setShowGroupPicker(false)}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Select Group</Text>
              <View style={{ width: 50 }} />
            </View>
            {groups.map(g => (
              <TouchableOpacity testID="group-picker-item" activeOpacity={0.7} key={g.id} style={styles.pickerItem} onPress={() => { setSelectedGroup(g); setShowGroupPicker(false); }}>
                <View style={styles.pickerIcon}><Ionicons name="people" size={20} color={COLORS.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerName}>{g.name}</Text>
                  <Text style={styles.pickerMeta}>{g.members.length} members</Text>
                </View>
                {selectedGroup?.id === g.id && <Ionicons name="checkmark" size={22} color={COLORS.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </Modal>

        {/* Category Picker Modal */}
        <Modal visible={showCatPicker} animationType="slide" presentationStyle="formSheet">
          <View style={styles.modal}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <TouchableOpacity activeOpacity={0.7} onPress={() => setShowCatPicker(false)}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Category</Text>
              <View style={{ width: 50 }} />
            </View>
            <View style={styles.catGrid}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  activeOpacity={0.7}
                  key={c.id}
                  style={[styles.catItem, category === c.id && { borderColor: c.color, borderWidth: 2 }]}
                  onPress={() => { setCategory(c.id); setShowCatPicker(false); }}
                >
                  <View style={[styles.catItemIcon, { backgroundColor: c.color + '26' }]}>
                    <Text style={styles.catEmoji}>{c.emoji || ''}</Text>
                    {!c.emoji && <Ionicons name={c.icon} size={24} color={c.color} />}
                  </View>
                  <Text style={styles.catItemLabel}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        {/* Split Options Modal */}
        <Modal visible={showSplitOptions} animationType="slide" presentationStyle="formSheet">
          <View style={styles.modal}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <TouchableOpacity activeOpacity={0.7} onPress={() => setShowSplitOptions(false)}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Split Type</Text>
              <View style={{ width: 50 }} />
            </View>
            {[
              { type: SPLIT_TYPES.EQUAL, icon: 'people', title: 'Equally', desc: 'Everyone pays the same' },
              { type: SPLIT_TYPES.EXACT, icon: 'calculator', title: 'Exact amounts', desc: 'Enter specific amounts' },
              { type: SPLIT_TYPES.PERCENTAGE, icon: 'pie-chart', title: 'Percentage', desc: 'Split by percentage' },
              { type: SPLIT_TYPES.SHARES, icon: 'grid', title: 'Shares', desc: 'Split proportionally by shares' },
            ].map(opt => (
              <TouchableOpacity
                activeOpacity={0.7}
                key={opt.type}
                style={[styles.splitOption, splitType === opt.type && styles.splitOptionActive]}
                onPress={() => { setSplitType(opt.type); setShowSplitOptions(false); }}
              >
                <View style={[styles.splitOptIcon, { backgroundColor: splitType === opt.type ? COLORS.primary : 'rgba(0,212,170,0.12)' }]}>
                  <Ionicons name={opt.icon} size={20} color={splitType === opt.type ? '#fff' : COLORS.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.splitOptTitle}>{opt.title}</Text>
                  <Text style={styles.splitOptDesc}>{opt.desc}</Text>
                </View>
                {splitType === opt.type && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#1a1a24',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  cancelBtn: { padding: 4 },
  cancelText: { fontSize: 16, color: '#a1a1aa' },
  saveBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 7 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Amount section — large card
  amountSection: {
    backgroundColor: '#1a1a24',
    borderRadius: 24,
    margin: 16,
    marginBottom: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#00d4aa',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  catBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginBottom: 16,
    gap: 6,
  },
  catBtnLabel: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
  amountInputContainer: { flexDirection: 'row', alignItems: 'center' },
  currencySymbol: { fontSize: 32, fontWeight: '700', color: '#00d4aa', marginRight: 6 },
  amountInput: { flex: 1, fontSize: 48, fontWeight: '800', color: '#ffffff' },

  // Form cards
  formCard: {
    backgroundColor: '#1a1a24',
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  descInput: {
    fontSize: 17,
    color: '#ffffff',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center' },
  fieldIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(0,212,170,0.12)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  fieldText: { flex: 1, fontSize: 16, color: '#ffffff', fontWeight: '500' },
  placeholder: { color: '#a1a1aa' },

  // Paid-by pills
  paidByScroll: { flexDirection: 'row' },
  paidByBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8,
  },
  paidByBtnInactive: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  paidByText: { fontSize: 14, color: '#a1a1aa', fontWeight: '500' },
  paidByTextActive: { color: '#fff', fontWeight: '700', fontSize: 14 },

  splitTypeText: { fontSize: 15, color: '#ffffff', fontWeight: '500' },

  // Split preview section
  splitsSection: {
    backgroundColor: '#1a1a24',
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  splitInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a24',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  splitName: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: '500', color: '#ffffff' },
  splitExactInput: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minWidth: 90,
  },
  splitInput: { fontSize: 15, fontWeight: '600', color: '#ffffff', minWidth: 50, textAlign: 'right' },
  splitCurrency: { fontSize: 14, color: '#a1a1aa', marginRight: 4 },
  sharesControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sharesCount: { fontSize: 18, fontWeight: '700', color: '#ffffff', minWidth: 24, textAlign: 'center' },
  splitPreviewRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a24',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  splitPreviewName: { flex: 1, marginLeft: 12, fontSize: 15, color: '#ffffff' },
  splitPreviewAmount: { fontSize: 15, fontWeight: '700', color: '#00d4aa' },

  // Save bottom button
  saveBottomWrapper: { marginHorizontal: 16, marginTop: 8 },
  saveBottomBtn: {
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBottomText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Modals
  modal: {
    flex: 1, backgroundColor: '#1a1a24', padding: 20,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20, paddingTop: 4,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  pickerIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(0,212,170,0.12)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  pickerName: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  pickerMeta: { fontSize: 13, color: '#a1a1aa' },

  // Category grid
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 4 },
  catItem: {
    width: '30%', alignItems: 'center', padding: 12,
    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 2, borderColor: 'transparent',
  },
  catItemIcon: {
    width: 48, height: 48, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  catEmoji: { fontSize: 24 },
  catItemLabel: { fontSize: 11, color: '#ffffff', textAlign: 'center', fontWeight: '500' },

  // Split options
  splitOption: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  splitOptionActive: {
    backgroundColor: 'rgba(0,212,170,0.10)',
    borderColor: '#00d4aa',
  },
  splitOptIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  splitOptTitle: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  splitOptDesc: { fontSize: 13, color: '#a1a1aa', marginTop: 2 },
});

export default AddExpenseScreen;
