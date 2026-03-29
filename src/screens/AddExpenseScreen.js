import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform, Animated as RNAnimated,
  Switch, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { COLORS, CATEGORIES } from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import Avatar from '../components/Avatar';
import PressableScale from '../components/PressableScale';
import { addExpense, getGroups, getGroup, updateExpense } from '../services/storage';
import { sendWhatsAppMessage, buildExpenseWhatsAppMessage } from '../services/contacts';
import { SPLIT_TYPES, calculateEqualSplit, calculatePercentageSplit, calculateSharesSplit, formatCurrency } from '../utils/splitCalculator';
import { formatAmount, getCurrencySymbol } from '../services/currency';
import { confirmAlert } from '../utils/alert';
import { hapticMedium, hapticSuccess, hapticError } from '../utils/haptics';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import ShakeView from '../components/ShakeView';
import { isNarrow, rFontSize, rWidth } from '../utils/responsive';

// Smart category detection from description
const detectCategory = (description) => {
  const desc = (description || '').toLowerCase();
  if (/uber|cab|taxi|ola|lyft|ride/.test(desc)) return 'transport';
  if (/dinner|lunch|food|breakfast|snack|pizza|burger|restaurant|cafe|coffee/.test(desc)) return 'food';
  if (/hotel|stay|airbnb|hostel|resort/.test(desc)) return 'travel';
  if (/movie|netflix|spotify|concert|show|game/.test(desc)) return 'entertainment';
  if (/grocery|groceries|supermarket|mart/.test(desc)) return 'shopping';
  if (/rent|electricity|water|wifi|internet|gas|bill/.test(desc)) return 'utilities';
  if (/doctor|medicine|pharmacy|hospital|health/.test(desc)) return 'health';
  if (/flight|train|bus|metro|ticket/.test(desc)) return 'travel';
  return null;
};

const AddExpenseScreen = ({ route, navigation }) => {
  const { theme, colorScheme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { user, groups, friends, currency, refresh, notifyWrite } = useApp();
  const { groupId: initGroupId, groupName: initGroupName, members: initMembers, editExpense, duplicateExpense } = route.params || {};
  const isEditMode = !!editExpense;
  const prefillData = editExpense || duplicateExpense || null;

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

  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const headerBg = scrollY.interpolate({ inputRange: [0, 80], outputRange: [theme.headerBgTransparent, theme.headerBg], extrapolate: 'clamp' });
  const headerBorder = scrollY.interpolate({ inputRange: [0, 80], outputRange: ['transparent', theme.border], extrapolate: 'clamp' });

  const descriptionRef = useRef(prefillData?.description || '');
  const amountRef = useRef(prefillData ? String(prefillData.amount) : '');
  const amountShakeRef = useRef(null);
  const descriptionShakeRef = useRef(null);
  const [descriptionDisplay, setDescriptionDisplay] = useState(prefillData?.description || '');
  const [amountDisplay, setAmountDisplay] = useState(prefillData ? String(prefillData.amount) : '');
  const [category, setCategory] = useState(prefillData?.category || 'general');
  const [paidBy, setPaidBy] = useState(null);
  const [splitType, setSplitType] = useState(SPLIT_TYPES.EQUAL);
  const [selectedGroup, setSelectedGroup] = useState(initGroupId ? { id: initGroupId, name: initGroupName, members: initMembers } : null);
  const [participants, setParticipants] = useState([]);
  const [exactAmounts, setExactAmounts] = useState({});
  const [percentages, setPercentages] = useState({});
  const [shares, setShares] = useState({});
  const [showGroupPicker, setShowGroupPicker] = useState(!initGroupId && !prefillData);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showSplitOptions, setShowSplitOptions] = useState(false);
  const [saving, setSaving] = useState(false);

  const [groupType, setGroupType] = useState(null);
  // Feature 7: Date picker for backdating
  const [expenseDate, setExpenseDate] = useState(prefillData?.expenseDate || prefillData?.date || new Date().toISOString().split('T')[0]);
  // Feature 21: Quick mode
  const [quickMode, setQuickMode] = useState(false);
  // Feature 22: Calculator
  const [calcResult, setCalcResult] = useState(null);
  // Feature 23: Multiple payers
  const [multiplePayers, setMultiplePayers] = useState(false);
  const [payerAmounts, setPayerAmounts] = useState({});
  // Feature 24: Notes
  const [notes, setNotes] = useState(prefillData?.notes || '');
  // Feature 26: Split with selected members
  const [splitMemberSelection, setSplitMemberSelection] = useState({});

  useEffect(() => {
    if (selectedGroup) {
      const allMembers = selectedGroup.members || [];
      setParticipants(allMembers);
      const init = {};
      allMembers.forEach(m => { init[m.id] = 0; });
      setExactAmounts(init);
      setPercentages(init);
      setShares(allMembers.reduce((s, m) => ({ ...s, [m.id]: 1 }), {}));
      // Feature 26: Initialize split member selection (all checked by default)
      const selectionInit = {};
      allMembers.forEach(m => { selectionInit[m.id] = true; });
      setSplitMemberSelection(selectionInit);
      // Feature 23: Initialize payer amounts
      const payerInit = {};
      allMembers.forEach(m => { payerInit[m.id] = ''; });
      setPayerAmounts(payerInit);

      // Handle prefill for edit/duplicate
      if (prefillData) {
        const payer = allMembers.find(m => m.id === prefillData.paidBy?.id) || allMembers[0];
        setPaidBy(payer);
        if (prefillData.splitType) setSplitType(prefillData.splitType);
      } else {
        setPaidBy(allMembers.find(m => m.id === user.id) || allMembers[0] || null);
      }

      // Load group type for couple default
      const loadGroupType = async () => {
        try {
          const g = await getGroup(selectedGroup.id);
          const type = g?.type || 'other';
          setGroupType(type);
          if (type === 'couple') setSplitType(SPLIT_TYPES.EQUAL);
          if (allMembers.length === 2) setSplitType(SPLIT_TYPES.EQUAL);
        } catch {}
      };
      if (!prefillData) loadGroupType();

      // Remember last used split type per group
      if (!prefillData) {
        AsyncStorage.getItem(`@evenly_last_split_${selectedGroup.id}`).then(val => {
          if (val && Object.values(SPLIT_TYPES).includes(val)) {
            setSplitType(val);
          }
        }).catch(() => {});
      }
    }
  }, [selectedGroup, user]);

  // Feature 26: Get only selected members for split
  const getSelectedParticipants = () => {
    return participants.filter(m => splitMemberSelection[m.id] !== false);
  };

  const getSplits = () => {
    const amt = parseFloat(amountRef.current);
    if (isNaN(amt) || amt <= 0) return [];
    const selectedParts = getSelectedParticipants();
    if (selectedParts.length === 0) return [];
    switch (splitType) {
      case SPLIT_TYPES.EQUAL:
        return calculateEqualSplit(amt, selectedParts);
      case SPLIT_TYPES.EXACT:
        return selectedParts.map(m => ({ userId: m.id, name: m.name, amount: parseFloat(exactAmounts[m.id] || 0) }));
      case SPLIT_TYPES.PERCENTAGE:
        return calculatePercentageSplit(amt, selectedParts, percentages);
      case SPLIT_TYPES.SHARES:
        return calculateSharesSplit(amt, selectedParts, shares);
      default:
        return calculateEqualSplit(amt, selectedParts);
    }
  };

  const validate = () => {
    if (!descriptionRef.current.trim()) { descriptionShakeRef.current?.shake(); Alert.alert('Missing description', 'What was this expense for?'); return false; }
    const amt = parseFloat(amountRef.current);
    if (isNaN(amt) || amt <= 0) { amountShakeRef.current?.shake(); Alert.alert('Missing amount', 'Enter how much was spent'); return false; }
    if (!selectedGroup) { Alert.alert('No group selected', 'Pick a group to split this expense with'); return false; }
    if (!paidBy) { Alert.alert('Who paid?', 'Select the person who paid for this'); return false; }
    if (splitType === SPLIT_TYPES.EXACT) {
      const total = Object.values(exactAmounts).reduce((s, v) => s + parseFloat(v || 0), 0);
      if (Math.abs(total - amt) > 0.01) {
        Alert.alert('Amounts don\'t add up', `The split totals ${formatCurrency(total, currency)} but the expense is ${formatCurrency(amt, currency)}`);
        return false;
      }
    }
    if (splitType === SPLIT_TYPES.PERCENTAGE) {
      const total = Object.values(percentages).reduce((s, v) => s + parseFloat(v || 0), 0);
      if (Math.abs(total - 100) > 0.01) {
        Alert.alert('Percentages don\'t add up', `Currently at ${total.toFixed(1)}% — needs to be exactly 100%`);
        return false;
      }
    }
    if (splitType === SPLIT_TYPES.SHARES) {
      const total = Object.values(shares).reduce((s, v) => s + (v || 0), 0);
      if (total === 0) {
        Alert.alert('No shares assigned', 'Give at least 1 share to each person');
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
      const now = new Date();
      // Feature 23: Build paidBy (single or multiple)
      let paidByData;
      if (multiplePayers) {
        const payers = participants.filter(m => parseFloat(payerAmounts[m.id] || 0) > 0)
          .map(m => ({ userId: m.id, name: m.name, avatar: m.avatar, amount: parseFloat(payerAmounts[m.id]) }));
        paidByData = payers.length === 1
          ? { id: payers[0].userId, name: payers[0].name, avatar: payers[0].avatar }
          : { id: paidBy.id, name: paidBy.name, avatar: paidBy.avatar, multiplePayers: payers };
      } else {
        paidByData = { id: paidBy.id, name: paidBy.name, avatar: paidBy.avatar };
      }
      // Feature 7: Use custom expense date
      const dateStr = expenseDate ? new Date(expenseDate).toISOString() : now.toISOString();

      if (isEditMode) {
        // Feature 3: Update existing expense
        await updateExpense(editExpense.id, {
          description: descriptionRef.current.trim(),
          amount: parseFloat(amountRef.current),
          currency,
          category,
          paid_by: paidByData,
          paidBy: paidByData,
          splits: [...splits],
          date: dateStr,
          expenseDate: expenseDate,
          notes: notes.trim() || null,
        });
        hapticSuccess();
        notifyWrite('update_expense');
        navigation.goBack();
        return;
      }

      const expense = await addExpense({
        description: descriptionRef.current.trim(),
        amount: parseFloat(amountRef.current),
        currency,
        category,
        groupId: selectedGroup.id,
        groupName: selectedGroup.name,
        paidBy: paidByData,
        splits: [...splits],
        date: dateStr,
        expenseDate: expenseDate,
        notes: notes.trim() || null,
        comments: [],
      });
      // Remember last used split type per group
      if (selectedGroup?.id) {
        AsyncStorage.setItem(`@evenly_last_split_${selectedGroup.id}`, splitType).catch(() => {});
      }
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
    <Animated.View style={[{ flex: 1 }, screenAnimStyle]}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <RNAnimated.View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: headerBorder }]}>
          <TouchableOpacity accessibilityLabel="Cancel expense" activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditMode ? 'Edit Expense' : 'Add Expense'}</Text>
          <TouchableOpacity testID="expense-save-btn" accessibilityLabel="Save expense" activeOpacity={0.7} onPress={handleSave} disabled={saving}>
            <LinearGradient
              colors={theme.ctaGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveBtn}
            >
              <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </RNAnimated.View>

        <RNAnimated.ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={RNAnimated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        >
          {/* Feature 21: Quick/Detailed mode toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity testID="quick-mode-btn" accessibilityLabel="Quick mode" activeOpacity={0.7} style={[styles.modeBtn, quickMode && styles.modeBtnActive]} onPress={() => setQuickMode(true)}>
              <Ionicons name="flash" size={16} color={quickMode ? theme.background : theme.textMuted} />
              <Text style={[styles.modeBtnText, quickMode && styles.modeBtnTextActive]}>Quick</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="detailed-mode-btn" accessibilityLabel="Detailed mode" activeOpacity={0.7} style={[styles.modeBtn, !quickMode && styles.modeBtnActive]} onPress={() => setQuickMode(false)}>
              <Ionicons name="list" size={16} color={!quickMode ? theme.background : theme.textMuted} />
              <Text style={[styles.modeBtnText, !quickMode && styles.modeBtnTextActive]}>Detailed</Text>
            </TouchableOpacity>
          </View>

          {/* Amount Input */}
          <ShakeView ref={amountShakeRef}>
          <View style={styles.amountSection}>
            {!quickMode && (
              <TouchableOpacity activeOpacity={0.7} style={styles.catBtn} onPress={() => setShowCatPicker(true)}>
                <Ionicons name={catInfo.icon} size={24} color={catInfo.color} />
                <Text style={styles.catBtnLabel}>{catInfo.label}</Text>
              </TouchableOpacity>
            )}
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>{getCurrencySymbol(currency)}</Text>
              <TextInput
                testID="expense-amount-input"
                accessibilityLabel="Expense amount"
                style={styles.amountInput}
                placeholder="0.00"
                value={amountDisplay}
                onChangeText={v => {
                  amountRef.current = v;
                  setAmountDisplay(v);
                  // Feature 22: Calculator detection
                  if (/[+\-*/]/.test(v) && v.length > 1) {
                    try {
                      const result = Function('"use strict"; return (' + v + ')')();
                      if (!isNaN(result) && isFinite(result)) setCalcResult(result.toFixed(2));
                      else setCalcResult(null);
                    } catch { setCalcResult(null); }
                  } else {
                    setCalcResult(null);
                  }
                }}
                onBlur={() => {
                  // Feature 22: Replace with calculated result on blur
                  if (calcResult) {
                    amountRef.current = calcResult;
                    setAmountDisplay(calcResult);
                    setCalcResult(null);
                  }
                }}
                keyboardType="default"
                placeholderTextColor={theme.textMuted}
              />
            </View>
            {/* Feature 22: Show calc result */}
            {calcResult && (
              <Text style={styles.calcResultText}>= {getCurrencySymbol(currency)}{calcResult}</Text>
            )}
          </View>
          </ShakeView>

          {/* Receipt feature removed — not supported on free tier */}
          {false && (
            <Text style={{ display: 'none' }}>placeholder</Text>
          )}

          {/* Description */}
          <ShakeView ref={descriptionShakeRef}>
          <View style={styles.formCard}>
            <Text style={styles.sectionLabel}>DESCRIPTION</Text>
            <TextInput
              testID="expense-description-input"
              accessibilityLabel="Expense description"
              style={styles.descInput}
              placeholder="What's this expense for?"
              value={descriptionDisplay}
              onChangeText={v => {
                descriptionRef.current = v;
                setDescriptionDisplay(v);
                const detected = detectCategory(v);
                if (detected) setCategory(detected);
              }}
              placeholderTextColor={theme.textMuted}
              autoCorrect={false}
              autoCapitalize="sentences"
              keyboardType="default"
            />
          </View>
          </ShakeView>

          {/* Feature 7: Date picker */}
          {!quickMode && (
            <View style={styles.formCard}>
              <Text style={styles.sectionLabel}>DATE</Text>
              <TextInput
                testID="expense-date-input"
                accessibilityLabel="Expense date"
                style={styles.descInput}
                placeholder="YYYY-MM-DD"
                value={expenseDate}
                onChangeText={setExpenseDate}
                placeholderTextColor={theme.textMuted}
                autoCorrect={false}
                keyboardType="default"
              />
            </View>
          )}

          {/* Feature 24: Notes */}
          {!quickMode && (
            <View style={styles.formCard}>
              <Text style={styles.sectionLabel}>NOTES (OPTIONAL)</Text>
              <TextInput
                testID="expense-notes-input"
                accessibilityLabel="Expense notes"
                style={[styles.descInput, { minHeight: 60 }]}
                placeholder="Add any additional notes..."
                value={notes}
                onChangeText={setNotes}
                placeholderTextColor={theme.textMuted}
                multiline
                autoCorrect={false}
              />
            </View>
          )}

          {/* Group */}
          {!quickMode && (
            <TouchableOpacity activeOpacity={0.7} style={styles.formCard} onPress={() => setShowGroupPicker(true)}>
              <Text style={styles.sectionLabel}>GROUP</Text>
              <View style={styles.fieldRow}>
                <View style={styles.fieldIcon}><Ionicons name="people" size={20} color={theme.primary} /></View>
                <Text style={[styles.fieldText, !selectedGroup && styles.placeholder]}>
                  {selectedGroup ? selectedGroup.name : 'Select a group'}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={theme.textLight} />
              </View>
            </TouchableOpacity>
          )}

          {/* Paid By */}
          {selectedGroup && !quickMode && (
            <View style={styles.formCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.sectionLabel}>PAID BY</Text>
                {/* Feature 23: Multiple payers toggle */}
                <TouchableOpacity testID="multiple-payers-toggle" accessibilityLabel={`Switch to ${multiplePayers ? 'single' : 'multiple'} payers`} activeOpacity={0.7} style={styles.multiPayerToggle} onPress={() => setMultiplePayers(!multiplePayers)}>
                  <Text style={[styles.multiPayerToggleText, multiplePayers && { color: theme.primary }]}>
                    {multiplePayers ? 'Multiple' : 'Single'}
                  </Text>
                </TouchableOpacity>
              </View>
              {!multiplePayers ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.paidByScroll}>
                  {participants.map(m => (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      key={m.id}
                      onPress={() => setPaidBy(m)}
                    >
                      {paidBy?.id === m.id ? (
                        <LinearGradient
                          colors={theme.ctaGradient}
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
              ) : (
                /* Feature 23: Multiple payer inputs */
                <View>
                  {participants.map(m => (
                    <View key={m.id} style={styles.splitInputRow}>
                      <Avatar name={m.name} size={36} />
                      <Text numberOfLines={1} style={styles.splitName}>{m.id === user.id ? 'You' : (m.name || '').split(' ')[0]}</Text>
                      <View style={styles.splitExactInput}>
                        <Text style={styles.splitCurrency}>{getCurrencySymbol(currency)}</Text>
                        <TextInput
                          testID={`payer-amount-${m.id}`}
                          style={styles.splitInput}
                          value={payerAmounts[m.id] || ''}
                          onChangeText={v => setPayerAmounts(prev => ({ ...prev, [m.id]: v }))}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={theme.textMuted}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Split Type */}
          {selectedGroup && !quickMode && (
            <TouchableOpacity activeOpacity={0.7} style={styles.formCard} onPress={() => setShowSplitOptions(true)}>
              <Text style={styles.sectionLabel}>SPLIT</Text>
              <View style={styles.fieldRow}>
                <View style={styles.fieldIcon}><Ionicons name="git-branch" size={20} color={theme.primary} /></View>
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
                <Ionicons name="chevron-forward" size={18} color={theme.textLight} />
              </View>
            </TouchableOpacity>
          )}

          {/* Split Preview */}
          {selectedGroup && splits.length > 0 && !quickMode && (
            <View style={styles.splitsSection}>
              <Text style={styles.sectionLabel}>SPLIT PREVIEW</Text>

              {/* Feature 26: Member checkboxes for split selection */}
              {splitType === SPLIT_TYPES.EQUAL && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 11, color: theme.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Include in split:</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {participants.map(m => (
                      <TouchableOpacity
                        testID={`split-member-toggle-${m.id}`}
                        key={m.id}
                        activeOpacity={0.7}
                        style={[styles.splitMemberChip, splitMemberSelection[m.id] !== false && styles.splitMemberChipActive]}
                        onPress={() => setSplitMemberSelection(prev => ({ ...prev, [m.id]: prev[m.id] === false ? true : false }))}
                      >
                        <Text style={[styles.splitMemberChipText, splitMemberSelection[m.id] !== false && styles.splitMemberChipTextActive]}>
                          {m.id === user.id ? 'You' : (m.name || '').split(' ')[0]}
                        </Text>
                        {splitMemberSelection[m.id] !== false && <Ionicons name="checkmark" size={14} color="#0a0a0f" />}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Feature 25: Visual bar for unequal splits */}
              {(splitType === SPLIT_TYPES.PERCENTAGE || splitType === SPLIT_TYPES.SHARES) && splits.length > 0 && parseFloat(amountRef.current) > 0 && (
                <View style={styles.splitBarContainer}>
                  <View style={styles.splitBar}>
                    {splits.map((s, idx) => {
                      const total = splits.reduce((sum, sp) => sum + sp.amount, 0);
                      const pct = total > 0 ? (s.amount / total) * 100 : 0;
                      const barColors = [theme.primary, '#a55eea', theme.negative, '#ffd93d', '#4fc3f7', '#ff9f43', '#ee5a24', '#6ab04c'];
                      return pct > 0 ? (
                        <View key={s.userId} style={[styles.splitBarSegment, { width: `${pct}%`, backgroundColor: barColors[idx % barColors.length] }]} />
                      ) : null;
                    })}
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                    {splits.map((s, idx) => {
                      const barColors = [theme.primary, '#a55eea', theme.negative, '#ffd93d', '#4fc3f7', '#ff9f43', '#ee5a24', '#6ab04c'];
                      return (
                        <View key={s.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: barColors[idx % barColors.length] }} />
                          <Text style={{ fontSize: 11, color: theme.textLight }}>{(s.name || '').split(' ')[0]}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {splitType === SPLIT_TYPES.EXACT && participants.map(m => (
                <View key={m.id} style={styles.splitInputRow}>
                  <Avatar name={m.name} size={36} />
                  <Text numberOfLines={1} style={styles.splitName}>{m.id === user.id ? 'You' : (m.name || '').split(' ')[0]}</Text>
                  <View style={styles.splitExactInput}>
                    <Text style={styles.splitCurrency}>{getCurrencySymbol(currency)}</Text>
                    <TextInput
                      style={styles.splitInput}
                      value={String(exactAmounts[m.id] || '')}
                      onChangeText={v => setExactAmounts(prev => ({ ...prev, [m.id]: v }))}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                </View>
              ))}

              {splitType === SPLIT_TYPES.PERCENTAGE && participants.map(m => {
                const split = splits.find(s => s.userId === m.id);
                return (
                  <View key={m.id} style={styles.splitInputRow}>
                    <Avatar name={m.name} size={36} />
                    <Text numberOfLines={1} style={styles.splitName}>{m.id === user.id ? 'You' : (m.name || '').split(' ')[0]}</Text>
                    <View style={styles.splitExactInput}>
                      <TextInput
                        style={styles.splitInput}
                        value={String(percentages[m.id] || '')}
                        onChangeText={v => setPercentages(prev => ({ ...prev, [m.id]: v }))}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={theme.textMuted}
                      />
                      <Text style={styles.splitCurrency}>%</Text>
                    </View>
                    {split && <Text style={styles.splitPreviewAmount}>{formatCurrency(split.amount, currency)}</Text>}
                  </View>
                );
              })}

              {splitType === SPLIT_TYPES.SHARES && participants.map(m => {
                const split = splits.find(s => s.userId === m.id);
                return (
                  <View key={m.id} style={styles.splitInputRow}>
                    <Avatar name={m.name} size={36} />
                    <Text numberOfLines={1} style={styles.splitName}>{m.id === user.id ? 'You' : (m.name || '').split(' ')[0]}</Text>
                    <View style={styles.sharesControl}>
                      <TouchableOpacity activeOpacity={0.7} onPress={() => setShares(prev => ({ ...prev, [m.id]: Math.max(0, (prev[m.id] || 1) - 1) }))}>
                        <Ionicons name="remove-circle" size={28} color={theme.primary} />
                      </TouchableOpacity>
                      <Text style={styles.sharesCount}>{shares[m.id] || 0}</Text>
                      <TouchableOpacity activeOpacity={0.7} onPress={() => setShares(prev => ({ ...prev, [m.id]: (prev[m.id] || 0) + 1 }))}>
                        <Ionicons name="add-circle" size={28} color={theme.primary} />
                      </TouchableOpacity>
                    </View>
                    {split && <Text style={styles.splitPreviewAmount}>{formatCurrency(split.amount, currency)}</Text>}
                  </View>
                );
              })}

              {splitType === SPLIT_TYPES.EQUAL && splits.map(s => (
                <View key={s.userId} style={styles.splitPreviewRow}>
                  <Avatar name={s.name} size={36} />
                  <Text numberOfLines={1} style={styles.splitPreviewName}>{s.userId === user.id ? 'You' : (s.name || '').split(' ')[0]}</Text>
                  <Text style={styles.splitPreviewAmount}>{formatCurrency(s.amount, currency)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Recurring toggle removed — not supported on free tier */}

          {/* Save Button */}
          <TouchableOpacity testID="expense-save-bottom-btn" accessibilityLabel="Save expense" activeOpacity={0.8} onPress={handleSave} disabled={saving} style={styles.saveBottomWrapper}>
            <LinearGradient
              colors={theme.ctaGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveBottomBtn}
            >
              <Text style={styles.saveBottomText}>{saving ? 'Saving...' : isEditMode ? 'Update Expense' : 'Save Expense'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </RNAnimated.ScrollView>

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
            {groups.filter(g => !g.archived).map(g => (
              <TouchableOpacity testID="group-picker-item" activeOpacity={0.7} key={g.id} style={styles.pickerItem} onPress={() => { setSelectedGroup(g); setShowGroupPicker(false); }}>
                <View style={styles.pickerIcon}><Ionicons name="people" size={20} color={theme.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerName}>{g.name}</Text>
                  <Text style={styles.pickerMeta}>{g.members.length} members</Text>
                </View>
                {selectedGroup?.id === g.id && <Ionicons name="checkmark" size={22} color={theme.primary} />}
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
                  <Text numberOfLines={1} style={styles.catItemLabel}>{c.label}</Text>
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
              { type: SPLIT_TYPES.EQUAL, icon: 'people', title: 'Equally', desc: 'Everyone pays the same amount' },
              { type: SPLIT_TYPES.EXACT, icon: 'calculator', title: 'Exact amounts', desc: 'You decide who pays what' },
              { type: SPLIT_TYPES.PERCENTAGE, icon: 'pie-chart', title: 'Percentage', desc: 'Split by custom percentages' },
              { type: SPLIT_TYPES.SHARES, icon: 'grid', title: 'Shares', desc: 'e.g. 2 shares for couples, 1 for singles' },
            ].map(opt => (
              <TouchableOpacity
                activeOpacity={0.7}
                key={opt.type}
                style={[styles.splitOption, splitType === opt.type && styles.splitOptionActive]}
                onPress={() => { setSplitType(opt.type); setShowSplitOptions(false); }}
              >
                <View style={[styles.splitOptIcon, { backgroundColor: splitType === opt.type ? theme.primary : theme.primaryLight }]}>
                  <Ionicons name={opt.icon} size={20} color={splitType === opt.type ? '#fff' : theme.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.splitOptTitle}>{opt.title}</Text>
                  <Text style={styles.splitOptDesc}>{opt.desc}</Text>
                </View>
                {splitType === opt.type && <Ionicons name="checkmark" size={20} color={theme.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
    </Animated.View>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: theme.card,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.text, letterSpacing: -0.5 },
  cancelBtn: { padding: 4 },
  cancelText: { fontSize: 16, color: theme.textLight },
  saveBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 7 },
  saveText: { color: theme.background, fontWeight: '700', fontSize: 15 },

  // Amount section — large card
  amountSection: {
    backgroundColor: theme.card,
    borderRadius: 24,
    margin: 16,
    marginBottom: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  catBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.inputBg,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginBottom: 16,
    gap: 6,
  },
  catBtnLabel: { fontSize: 13, fontWeight: '600', color: theme.text },
  amountInputContainer: { flexDirection: 'row', alignItems: 'center' },
  currencySymbol: { fontSize: 32, fontWeight: '700', color: theme.primary, marginRight: 6, fontVariant: ['tabular-nums'] },
  amountInput: { flex: 1, fontSize: rFontSize(48), fontWeight: '700', color: theme.text, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },

  // Form cards
  formCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  descInput: {
    fontSize: 17,
    color: theme.text,
    backgroundColor: theme.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center' },
  fieldIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: theme.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  fieldText: { flex: 1, fontSize: 16, color: theme.text, fontWeight: '500' },
  placeholder: { color: theme.textLight },

  // Paid-by pills
  paidByScroll: { flexDirection: 'row' },
  paidByBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8,
  },
  paidByBtnInactive: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8,
    backgroundColor: theme.inputBg,
  },
  paidByText: { fontSize: 14, color: theme.textLight, fontWeight: '500' },
  paidByTextActive: { color: theme.background, fontWeight: '700', fontSize: 14 },

  splitTypeText: { fontSize: 15, color: theme.text, fontWeight: '500' },

  // Split preview section
  splitsSection: {
    backgroundColor: theme.card,
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  splitInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  splitName: { flex: 1, minWidth: 0, marginLeft: 12, fontSize: 15, fontWeight: '500', color: theme.text },
  splitExactInput: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.inputBg,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minWidth: rWidth(90, 72),
  },
  splitInput: { fontSize: 15, fontWeight: '600', color: theme.text, minWidth: 50, textAlign: 'right' },
  splitCurrency: { fontSize: 14, color: theme.textLight, marginRight: 4 },
  sharesControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sharesCount: { fontSize: 18, fontWeight: '700', color: theme.text, minWidth: 24, textAlign: 'center' },
  splitPreviewRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  splitPreviewName: { flex: 1, minWidth: 0, marginLeft: 12, fontSize: 15, color: theme.text },
  splitPreviewAmount: { fontSize: 15, fontWeight: '700', color: theme.primary },

  // Save bottom button
  saveBottomWrapper: { marginHorizontal: 16, marginTop: 8 },
  saveBottomBtn: {
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBottomText: { color: theme.background, fontWeight: '700', fontSize: 16 },

  // Modals
  modal: {
    flex: 1, backgroundColor: theme.card, padding: 20,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: theme.textMuted,
    alignSelf: 'center', marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20, paddingTop: 4,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  pickerIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: theme.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  pickerName: { fontSize: 16, fontWeight: '600', color: theme.text },
  pickerMeta: { fontSize: 13, color: theme.textLight },

  // Category grid
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 4 },
  catItem: {
    width: isNarrow ? '46%' : '30%', alignItems: 'center', padding: 12,
    borderRadius: 16, backgroundColor: theme.inputBg,
    borderWidth: 2, borderColor: 'transparent',
  },
  catItemIcon: {
    width: 48, height: 48, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  catEmoji: { fontSize: 24 },
  catItemLabel: { fontSize: 11, color: theme.text, textAlign: 'center', fontWeight: '500' },

  // Split options
  splitOption: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 16, backgroundColor: theme.inputBg, marginBottom: 10,
    borderWidth: 1, borderColor: theme.border,
  },
  splitOptionActive: {
    backgroundColor: theme.primaryLight,
    borderColor: theme.primary,
  },
  splitOptIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  splitOptTitle: { fontSize: 16, fontWeight: '600', color: theme.text },
  splitOptDesc: { fontSize: 13, color: theme.textLight, marginTop: 2 },

  // Receipt button
  receiptBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.card, borderRadius: 20,
    marginHorizontal: 16, marginBottom: 10, padding: 16,
    borderWidth: 1, borderColor: theme.border,
  },
  receiptBtnEmoji: { fontSize: 18, marginRight: 10 },
  receiptBtnText: { fontSize: 14, color: theme.textLight, fontWeight: '600' },

  // Recurring toggle
  _recurringRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  recurringLabel: { flex: 1, fontSize: 15, color: theme.text, fontWeight: '500' },

  // Feature 21: Mode toggle
  modeToggle: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    backgroundColor: theme.card, borderRadius: 12, padding: 3,
  },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, borderRadius: 10, gap: 4,
  },
  modeBtnActive: { backgroundColor: theme.primary },
  modeBtnText: { fontSize: 13, color: theme.textMuted, fontWeight: '600' },
  modeBtnTextActive: { color: theme.background, fontWeight: '700' },

  // Feature 22: Calculator result
  calcResultText: {
    fontSize: 16, color: theme.primary, fontWeight: '700', marginTop: 8,
  },

  // Feature 23: Multiple payers toggle
  multiPayerToggle: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    backgroundColor: theme.inputBg,
  },
  multiPayerToggleText: { fontSize: 12, color: theme.textMuted, fontWeight: '600' },

  // Feature 25: Split bar
  splitBarContainer: { marginBottom: 12 },
  splitBar: {
    flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden',
    backgroundColor: theme.inputBg,
  },
  splitBarSegment: { height: '100%' },

  // Feature 26: Split member selection chips
  splitMemberChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 16, backgroundColor: theme.inputBg,
    borderWidth: 1, borderColor: theme.border, gap: 4,
  },
  splitMemberChipActive: {
    backgroundColor: theme.primary, borderColor: theme.primary,
  },
  splitMemberChipText: { fontSize: 12, color: theme.textMuted, fontWeight: '600' },
  splitMemberChipTextActive: { color: theme.background },
});

export default AddExpenseScreen;
