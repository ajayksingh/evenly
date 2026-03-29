import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Modal, TextInput, ActivityIndicator, Platform, StatusBar, Animated,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS, CATEGORIES } from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import Avatar from '../components/Avatar';
import { getGroup, getExpenses, calculateGroupBalances, searchUsersByEmail, deleteExpense, sendGroupInvite, addExpenseComment, getActivity, removeMemberFromGroup, updateExpense, recordSettlement } from '../services/storage';
import { supabase } from '../services/supabase';
import { formatCurrency, formatDate, getSimplifiedDebts } from '../utils/splitCalculator';
import { confirmAlert } from '../utils/alert';
import { shareOrCopy } from '../utils/share';
import AddPeopleModal from '../components/AddPeopleModal';
import { isNarrow, rPadding, rFontSize, rWidth } from '../utils/responsive';

const GroupDetailScreen = ({ route, navigation }) => {
  const { theme, colorScheme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { groupId } = route.params;
  const { user, refresh: globalRefresh, notifyWrite, currency } = useApp();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [memberBalances, setMemberBalances] = useState([]);
  const [tab, setTab] = useState('expenses'); // expenses | balances | members | activity
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  // Feature 6: Comments
  const [expandedExpenseId, setExpandedExpenseId] = useState(null);
  const [commentText, setCommentText] = useState('');
  // Feature 5: Receipt modal
  const [receiptModalUri, setReceiptModalUri] = useState(null);
  // Feature 10: Activity feed
  const [activityItems, setActivityItems] = useState([]);
  // Feature 1: Expense sorting
  const [expenseSortMode, setExpenseSortMode] = useState('date_desc'); // date_desc | date_asc | amount_desc | amount_asc | category
  const [showSortMenu, setShowSortMenu] = useState(false);
  // Feature 2: Expense search
  const [expenseSearch, setExpenseSearch] = useState('');
  // Feature 8: Delete confirmation on long press
  const [longPressExpenseId, setLongPressExpenseId] = useState(null);
  const [settlingAll, setSettlingAll] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerBg = scrollY.interpolate({ inputRange: [0, 80], outputRange: [theme.headerBgTransparent, theme.headerBg], extrapolate: 'clamp' });
  const headerBorder = scrollY.interpolate({ inputRange: [0, 80], outputRange: ['transparent', theme.border], extrapolate: 'clamp' });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [g, e, allActivity] = await Promise.all([
      getGroup(groupId),
      getExpenses(groupId),
      getActivity(user?.id).catch(() => []),
    ]);
    if (g) {
      setGroup(g);
      const mb = await calculateGroupBalances(groupId, g.members);
      setMemberBalances(mb);
    }
    setExpenses(e);
    setActivityItems((allActivity || []).filter(a => a.groupId === groupId));
    setLoading(false);
  }, [groupId, user?.id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // Realtime subscription: reload when any expense or settlement changes for this group
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(`group-detail-${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${groupId}` }, () => { loadData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements', filter: `group_id=eq.${groupId}` }, () => { loadData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups', filter: `id=eq.${groupId}` }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, loadData]);

  const handleDeleteExpense = (expense) => {
    confirmAlert({
      title: 'Delete Expense',
      message: `Delete "${expense.description}"?`,
      confirmText: 'Delete',
      destructive: true,
      onConfirm: async () => {
        await deleteExpense(expense.id);
        await notifyWrite('delete_expense');
        globalRefresh();
        loadData();
      },
    });
  };


  // Feature 7: Share summary
  const handleShareSummary = async () => {
    if (!group) return;
    const debts = getSimplifiedDebts(memberBalances.map(m => ({ userId: m.id, name: m.name, amount: m.balance })));
    let text = `📊 ${group.name} - Group Summary\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💰 Total: ${formatCurrency(totalSpending, currency)}\n`;
    text += `👥 ${memberCount} members · ${expenses.length} expenses\n`;
    text += `💵 Per person avg: ${formatCurrency(perPersonAvg, currency)}\n\n`;
    text += `📋 Per-member breakdown:\n`;
    memberBalances.forEach(m => {
      const status = m.balance > 0.01 ? `gets back ${formatCurrency(m.balance, currency)}`
        : m.balance < -0.01 ? `owes ${formatCurrency(Math.abs(m.balance), currency)}`
        : 'all square ✅';
      text += `  • ${m.name}: ${status}\n`;
    });
    if (debts.length > 0) {
      text += `\n🔄 Settlements needed:\n`;
      debts.forEach(d => {
        text += `  • ${d.fromName} → ${formatCurrency(d.amount, currency)} → ${d.toName}\n`;
      });
    }
    text += `\n— Shared via Evenly`;
    try {
      const result = await shareOrCopy({ message: text });
      if (result === 'copied') {
        Alert.alert('Link copied!', 'Share it with your friends');
      }
    } catch {}
  };

  // Feature 6: Add comment
  const handleAddComment = async (expenseId) => {
    if (!commentText.trim()) return;
    try {
      await addExpenseComment(expenseId, {
        author: user.name,
        text: commentText.trim(),
        date: new Date().toISOString(),
      });
      setCommentText('');
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to add comment');
    }
  };

  // Feature 1 & 2: sorted and filtered expenses
  const sortedFilteredExpenses = useMemo(() => {
    let list = [...expenses];
    // Search filter
    if (expenseSearch.trim()) {
      const q = expenseSearch.trim().toLowerCase();
      list = list.filter(e => (e.description || '').toLowerCase().includes(q));
    }
    // Sort
    switch (expenseSortMode) {
      case 'date_asc': list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
      case 'amount_desc': list.sort((a, b) => (b.amount || 0) - (a.amount || 0)); break;
      case 'amount_asc': list.sort((a, b) => (a.amount || 0) - (b.amount || 0)); break;
      case 'category': list.sort((a, b) => (a.category || '').localeCompare(b.category || '')); break;
      default: list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
    }
    return list;
  }, [expenses, expenseSearch, expenseSortMode]);

  // Feature 3: Edit expense handler
  const handleEditExpense = (expense) => {
    navigation.navigate('AddExpense', {
      groupId, groupName: group.name, members: group.members,
      editExpense: expense,
    });
  };

  // Feature 4: Duplicate expense handler
  const handleDuplicateExpense = (expense) => {
    const { id, createdAt, ...rest } = expense;
    navigation.navigate('AddExpense', {
      groupId, groupName: group.name, members: group.members,
      duplicateExpense: rest,
    });
  };

  // Feature 10: Settle All handler
  const handleSettleAll = () => {
    if (settlingAll) return;
    const debts = getSimplifiedDebts(memberBalances.map(m => ({ userId: m.id, name: m.name, amount: m.balance })));
    if (debts.length === 0) { Alert.alert('All settled', 'No outstanding balances.'); return; }
    confirmAlert({
      title: 'Settle All Debts',
      message: `This will record ${debts.length} settlement${debts.length > 1 ? 's' : ''} to clear all balances. Continue?`,
      confirmText: 'Settle All',
      onConfirm: async () => {
        setSettlingAll(true);
        try {
          await Promise.all(debts.map(d => recordSettlement({
            paidBy: d.from,
            paidTo: d.to,
            amount: d.amount,
            currency,
            groupId,
            note: 'Settle All',
          })));
          await notifyWrite('settle_all');
          globalRefresh();
          loadData();
          Alert.alert('Done', 'All balances have been settled.');
        } catch (e) {
          Alert.alert('Error', e.message || 'Failed to settle');
        } finally {
          setSettlingAll(false);
        }
      },
    });
  };

  // Feature 14: Remove member handler
  const handleRemoveMember = (member) => {
    const memberBal = memberBalances.find(b => b.id === member.id);
    if (memberBal && Math.abs(memberBal.balance) > 0.01) {
      Alert.alert('Cannot Remove', `${member.name} has an outstanding balance. Settle up first.`);
      return;
    }
    confirmAlert({
      title: 'Remove Member',
      message: `Remove ${member.name} from this group?`,
      confirmText: 'Remove',
      destructive: true,
      onConfirm: async () => {
        try {
          await removeMemberFromGroup(groupId, member.id);
          await notifyWrite('remove_member');
          globalRefresh();
          loadData();
        } catch (e) {
          Alert.alert('Error', e.message || 'Failed to remove member');
        }
      },
    });
  };

  // Feature 16: Share group invite link
  const handleShareInviteLink = async () => {
    const link = `https://ajayksingh.github.io/evenly/?joinGroup=${groupId}`;
    try {
      const result = await shareOrCopy({ message: `Join my group "${group.name}" on Evenly!\n${link}` });
      if (result === 'copied') {
        Alert.alert('Link copied!', 'Share it with your friends');
      }
    } catch {}
  };

  const simplifiedDebts = useMemo(() => getSimplifiedDebts(memberBalances.map(m => ({ userId: m.id, name: m.name, amount: m.balance }))), [memberBalances]);

  const getCategoryInfo = (cat) => CATEGORIES.find(c => c.id === cat) || CATEGORIES[8];

  const { totalSpending, perPersonAvg, topSpender, topCategories } = useMemo(() => {
    const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const mc = group ? group.members.length : 0;
    const avg = mc > 0 ? total / mc : 0;
    const spenderMap = {};
    const catMap = {};
    expenses.forEach(e => {
      const name = e.paidBy?.name || 'Unknown';
      spenderMap[name] = (spenderMap[name] || 0) + (e.amount || 0);
      const cat = e.category || 'general';
      catMap[cat] = (catMap[cat] || 0) + (e.amount || 0);
    });
    const ts = Object.entries(spenderMap).sort((a, b) => b[1] - a[1])[0];
    const tc = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([catId, amount]) => {
      const catInfo = CATEGORIES.find(c => c.id === catId) || CATEGORIES[8];
      return { emoji: catInfo.emoji, label: catInfo.label, amount };
    });
    return { totalSpending: total, perPersonAvg: avg, topSpender: ts, topCategories: tc };
  }, [expenses, group]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.primary} size="large" /></View>;
  if (!group) return <View style={styles.center}><Text>Group not found</Text></View>;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <Animated.View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: headerBorder }]}>
        <TouchableOpacity accessibilityLabel="Go back" activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.memberCount}>{group.members.length} members</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            testID="share-summary-btn"
            accessibilityLabel="Share group summary"
            activeOpacity={0.7}
            style={styles.shareBtn}
            onPress={handleShareSummary}
          >
            <Ionicons name="share-outline" size={20} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Add expense"
            activeOpacity={0.7}
            style={styles.addExpBtn}
            onPress={() => navigation.navigate('AddExpense', { groupId, groupName: group.name, members: group.members })}
          >
            <Ionicons name="add" size={20} color={theme.background} />
            <Text style={styles.addExpText}>Add</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['expenses', 'balances', 'members', 'activity'].map(t => (
          <TouchableOpacity testID={`tab-${t}`} accessibilityLabel={`${t.charAt(0).toUpperCase() + t.slice(1)} tab`} activeOpacity={0.7} key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 100 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
      >
      {/* Hero Stats Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />
        {/* Row 1: icon + label */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <View style={styles.heroIconBox}>
            <Ionicons name="cash-outline" size={20} color={theme.primary} />
          </View>
          <Text style={styles.heroLabel}>Total group spending</Text>
        </View>
        {/* Row 2: total amount */}
        <Text style={styles.heroAmount}>{formatCurrency(totalSpending, currency)}</Text>
        {/* Row 3: expense count */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 20 }}>
          <View style={styles.heroPulseDot} />
          <Text style={styles.heroExpCount}>{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</Text>
        </View>
        {/* Top spender + category breakdown */}
        {expenses.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            {topSpender && (
              <Text style={styles.heroExtraLine}>
                👑 Top spender: <Text style={{ fontWeight: '700', color: theme.text }}>{topSpender[0]}</Text> ({formatCurrency(topSpender[1], currency)})
              </Text>
            )}
            {topCategories.length > 0 && (
              <Text style={styles.heroExtraLine}>
                {topCategories.map((c, i) => `${c.emoji} ${c.label} ${formatCurrency(c.amount, currency)}`).join(' · ')}
              </Text>
            )}
          </View>
        )}
        {/* 2-column stat grid */}
        <View style={styles.heroStatGrid}>
          {/* Left: members */}
          <View style={styles.heroStatCell}>
            <View style={styles.heroIconBox}>
              <Ionicons name="people-outline" size={20} color={theme.primary} />
            </View>
            <Text style={styles.heroStatValue}>{memberCount}</Text>
            <Text style={styles.heroStatLabel}>members</Text>
          </View>
          {/* Right: per person avg */}
          <View style={styles.heroStatCell}>
            <View style={styles.heroIconBoxCoral}>
              <Ionicons name="trending-up-outline" size={20} color="#ff6b6b" />
            </View>
            <Text style={styles.heroStatValue}>{formatCurrency(perPersonAvg, currency)}</Text>
            <Text style={styles.heroStatLabel}>per person avg</Text>
          </View>
        </View>
      </View>

        {/* Expenses Tab */}
        {tab === 'expenses' && (
          <View>
            {expenses.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="receipt-outline" size={56} color={theme.textMuted} />
                <Text style={styles.emptyTitle}>No expenses yet</Text>
                <TouchableOpacity
                  accessibilityLabel="Add first expense"
                  activeOpacity={0.7}
                  style={styles.addFirstBtn}
                  onPress={() => navigation.navigate('AddExpense', { groupId, groupName: group.name, members: group.members })}
                >
                  <Text style={styles.addFirstBtnText}>Add First Expense</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                {/* Feature 2: Search + Feature 1: Sort controls */}
                <View style={styles.expenseControls}>
                  <View style={styles.expenseSearchRow}>
                    <Ionicons name="search" size={16} color={theme.textMuted} />
                    <TextInput
                      testID="expense-search-input"
                      accessibilityLabel="Search expenses"
                      style={styles.expenseSearchInput}
                      placeholder="Search expenses..."
                      placeholderTextColor={theme.textMuted}
                      value={expenseSearch}
                      onChangeText={setExpenseSearch}
                    />
                    {expenseSearch.length > 0 && (
                      <TouchableOpacity testID="expense-search-clear" accessibilityLabel="Clear search" onPress={() => setExpenseSearch('')}>
                        <Ionicons name="close-circle" size={18} color={theme.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <TouchableOpacity testID="expense-sort-btn" accessibilityLabel="Sort expenses" activeOpacity={0.7} style={styles.sortBtn} onPress={() => setShowSortMenu(!showSortMenu)}>
                    <Ionicons name="swap-vertical" size={18} color={theme.primary} />
                  </TouchableOpacity>
                </View>
                {showSortMenu && (
                  <View style={styles.sortMenu}>
                    {[
                      { key: 'date_desc', label: 'Newest first' },
                      { key: 'date_asc', label: 'Oldest first' },
                      { key: 'amount_desc', label: 'Highest amount' },
                      { key: 'amount_asc', label: 'Lowest amount' },
                      { key: 'category', label: 'By category' },
                    ].map(opt => (
                      <TouchableOpacity
                        testID={`sort-option-${opt.key}`}
                        accessibilityLabel={`Sort by ${opt.label}`}
                        key={opt.key}
                        activeOpacity={0.7}
                        style={[styles.sortMenuItem, expenseSortMode === opt.key && styles.sortMenuItemActive]}
                        onPress={() => { setExpenseSortMode(opt.key); setShowSortMenu(false); }}
                      >
                        <Text style={[styles.sortMenuText, expenseSortMode === opt.key && styles.sortMenuTextActive]}>{opt.label}</Text>
                        {expenseSortMode === opt.key && <Ionicons name="checkmark" size={16} color={theme.primary} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {sortedFilteredExpenses.map(exp => {
                  const catInfo = getCategoryInfo(exp.category);
                  const myShare = exp.splits.find(s => s.userId === user.id);
                  const iPaid = exp.paidBy.id === user.id;
                  const isExpanded = expandedExpenseId === exp.id;
                  const expComments = exp.comments || [];
                  const isLongPressed = longPressExpenseId === exp.id;
                  return (
                    <View key={exp.id}>
                      <TouchableOpacity
                        testID={`expense-item-${exp.id}`}
                        accessibilityLabel={`Expense: ${exp.description}, ${formatCurrency(exp.amount, currency)}`}
                        activeOpacity={0.7}
                        style={styles.expenseCard}
                        onPress={() => {
                          if (longPressExpenseId) { setLongPressExpenseId(null); return; }
                          setExpandedExpenseId(isExpanded ? null : exp.id);
                        }}
                        onLongPress={() => setLongPressExpenseId(isLongPressed ? null : exp.id)}
                      >
                        <View style={[styles.expCatIcon, { backgroundColor: catInfo.color + '20' }]}>
                          <Ionicons name={catInfo.icon} size={20} color={catInfo.color} />
                        </View>
                        <View style={styles.expInfo}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.expName} numberOfLines={1}>{exp.description}</Text>

                          </View>
                          {/* Feature 6: Split preview on cards */}
                          <Text style={styles.expMeta}>
                            {iPaid
                              ? `You paid ${formatCurrency(exp.amount, currency)}${myShare ? ` · Your share ${formatCurrency(myShare.amount, currency)}` : ''}`
                              : `${exp.paidBy.name} paid ${formatCurrency(exp.amount, currency)}${myShare ? ` · Your share ${formatCurrency(myShare.amount, currency)}` : ''}`
                            }
                          </Text>
                          <Text style={[styles.expMeta, { fontSize: 11, color: theme.textMuted }]}>{formatDate(exp.expenseDate || exp.date || exp.createdAt)}</Text>
                        </View>
                        <View style={styles.expRight}>
                          {iPaid ? (
                            <>
                              <Text style={styles.expLabelGreen}>you paid</Text>
                              <Text style={[styles.expAmount, { color: theme.success }]} numberOfLines={1}>{formatCurrency(exp.amount, currency)}</Text>
                            </>
                          ) : myShare ? (
                            <>
                              <Text style={styles.expLabelRed}>your share</Text>
                              <Text style={[styles.expAmount, { color: theme.negative }]} numberOfLines={1}>{formatCurrency(myShare.amount, currency)}</Text>
                            </>
                          ) : (
                            <Text style={styles.expLabelNeutral}>not involved</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                      {/* Feature 3,4,8: Action buttons on long press */}
                      {isLongPressed && (
                        <View style={styles.expenseActions}>
                          <TouchableOpacity testID={`edit-expense-${exp.id}`} accessibilityLabel={`Edit ${exp.description}`} activeOpacity={0.7} style={styles.expActionBtn} onPress={() => { setLongPressExpenseId(null); handleEditExpense(exp); }}>
                            <Ionicons name="create-outline" size={16} color={theme.primary} />
                            <Text style={styles.expActionText}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity testID={`duplicate-expense-${exp.id}`} accessibilityLabel={`Duplicate ${exp.description}`} activeOpacity={0.7} style={styles.expActionBtn} onPress={() => { setLongPressExpenseId(null); handleDuplicateExpense(exp); }}>
                            <Ionicons name="copy-outline" size={16} color={theme.primary} />
                            <Text style={styles.expActionText}>Duplicate</Text>
                          </TouchableOpacity>
                          <TouchableOpacity testID={`delete-expense-${exp.id}`} accessibilityLabel={`Delete ${exp.description}`} activeOpacity={0.7} style={[styles.expActionBtn, { borderColor: 'rgba(255,107,107,0.3)' }]} onPress={() => { setLongPressExpenseId(null); handleDeleteExpense(exp); }}>
                            <Ionicons name="trash-outline" size={16} color={theme.negative} />
                            <Text style={[styles.expActionText, { color: theme.negative }]}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      {/* Expandable comments section */}
                      {isExpanded && (
                        <View style={styles.commentsSection}>
                          {exp.notes ? (
                            <View style={{ marginBottom: 8 }}>
                              <Text style={{ fontSize: 11, color: theme.textMuted, textTransform: 'uppercase', fontWeight: '700', marginBottom: 4 }}>Notes</Text>
                              <Text style={{ fontSize: 13, color: theme.textLight }}>{exp.notes}</Text>
                            </View>
                          ) : null}
                          {expComments.length > 0 && expComments.map((c, idx) => (
                            <View key={idx} style={styles.commentRow}>
                              <Text style={styles.commentAuthor}>{c.author}</Text>
                              <Text style={styles.commentText}>{c.text}</Text>
                              <Text style={styles.commentDate}>{formatDate(c.date)}</Text>
                            </View>
                          ))}
                          <View style={styles.commentInputRow}>
                            <TextInput
                              testID={`comment-input-${exp.id}`}
                              accessibilityLabel="Add a comment"
                              style={styles.commentInput}
                              placeholder="Add a comment..."
                              placeholderTextColor={theme.textMuted}
                              value={commentText}
                              onChangeText={setCommentText}
                            />
                            <TouchableOpacity
                              testID={`comment-send-${exp.id}`}
                              accessibilityLabel="Send comment"
                              activeOpacity={0.7}
                              style={styles.commentSendBtn}
                              onPress={() => handleAddComment(exp.id)}
                            >
                              <Ionicons name="send" size={16} color={theme.primary} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Balances Tab */}
        {tab === 'balances' && (
          <View>
            {/* Feature 10: Settle All button */}
            {simplifiedDebts.length > 0 && (
              <View style={{ marginHorizontal: 16, marginTop: 12 }}>
                <TouchableOpacity testID="settle-all-btn" accessibilityLabel="Settle all debts" activeOpacity={0.7} style={[styles.settleAllBtn, settlingAll && { opacity: 0.5 }]} onPress={handleSettleAll} disabled={settlingAll}>
                  {settlingAll ? <ActivityIndicator size="small" color={theme.background} /> : <Ionicons name="checkmark-done-circle" size={20} color={theme.background} />}
                  <Text style={styles.settleAllBtnText}>{settlingAll ? 'Settling...' : `Settle All (${simplifiedDebts.length} payment${simplifiedDebts.length > 1 ? 's' : ''})`}</Text>
                </TouchableOpacity>
              </View>
            )}
            {/* Simplified debts at top (Feature 3) */}
            {simplifiedDebts.length > 0 && (
              <View style={[styles.section, { marginBottom: 0 }]}>
                <Text style={styles.sectionLabel}>Suggested Settlements</Text>
                {simplifiedDebts.map((d, idx) => (
                  <View key={idx} style={styles.settlementFlowCard}>
                    <View style={styles.settlementFlowPerson}>
                      <Avatar name={d.fromName} size={32} />
                      <Text style={styles.settlementFlowName} numberOfLines={1}>
                        {d.fromName === user.name ? 'You' : d.fromName}
                      </Text>
                    </View>
                    <View style={styles.settlementFlowArrow}>
                      <View style={styles.settlementFlowLine} />
                      <Text style={styles.settlementFlowAmount}>{formatCurrency(d.amount, currency)}</Text>
                      <Ionicons name="arrow-forward" size={16} color={theme.primary} />
                    </View>
                    <View style={styles.settlementFlowPerson}>
                      <Avatar name={d.toName} size={32} />
                      <Text style={styles.settlementFlowName} numberOfLines={1}>
                        {d.toName === user.name ? 'You' : d.toName}
                      </Text>
                    </View>
                    {/* Feature 12: Navigate with pre-filled amount */}
                    <TouchableOpacity
                      testID={`settle-btn-${idx}`}
                      accessibilityLabel={`Settle ${formatCurrency(d.amount, currency)} from ${d.fromName} to ${d.toName}`}
                      activeOpacity={0.7}
                      style={styles.settlementFlowBtn}
                      onPress={() => navigation.navigate('SettleUp', {
                        group, members: group.members,
                        preselectedPayer: d.from,
                        preselectedReceiver: d.to,
                        prefilledAmount: String(d.amount),
                      })}
                    >
                      <Text style={styles.settlementFlowBtnText}>Settle</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Group Balances</Text>
              {memberBalances.map(m => (
                <View key={m.id} style={styles.balanceRow}>
                  <Avatar name={m.name} avatar={m.avatar} size={38} />
                  <View style={styles.balanceInfo}>
                    <Text style={styles.balanceName} numberOfLines={1}>{m.id === user.id ? 'You' : m.name}</Text>
                    <Text style={[styles.balanceAmount, {
                      color: m.balance > 0.01 ? theme.success : m.balance < -0.01 ? theme.negative : theme.textLight
                    }]}>
                      {m.balance > 0.01 ? `gets back ${formatCurrency(m.balance, currency)}`
                        : m.balance < -0.01 ? `owes ${formatCurrency(Math.abs(m.balance), currency)}`
                          : expenses.length > 0 ? 'all square' : 'no expenses yet'}
                    </Text>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                accessibilityLabel="Record a payment"
                activeOpacity={0.7}
                style={styles.settleBtn}
                onPress={() => navigation.navigate('SettleUp', { group, members: group.members })}
              >
                <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
                <Text style={styles.settleBtnText}>Record a Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Members Tab */}
        {tab === 'members' && (
          <View style={styles.section}>
            {group.members.map(m => {
              // Feature 13: Member spending breakdown
              const memberPaid = expenses.filter(e => e.paidBy?.id === m.id).reduce((s, e) => s + (e.amount || 0), 0);
              const memberShare = expenses.reduce((s, e) => {
                const split = (e.splits || []).find(sp => sp.userId === m.id);
                return s + (split ? split.amount : 0);
              }, 0);
              const memberBal = memberBalances.find(b => b.id === m.id);
              const netBal = memberBal ? memberBal.balance : 0;
              return (
                <View key={m.id} style={styles.memberRow}>
                  <Avatar name={m.name} avatar={m.avatar} size={44} />
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName} numberOfLines={1}>{m.id === user.id ? `${m.name} (You)` : m.name}</Text>
                    <Text style={styles.memberEmail}>{m.email}</Text>
                    {/* Feature 13: Stats */}
                    {expenses.length > 0 && (
                      <View style={styles.memberStats}>
                        <Text style={styles.memberStatText}>Paid: {formatCurrency(memberPaid, currency)}</Text>
                        <Text style={styles.memberStatText}> · Share: {formatCurrency(memberShare, currency)}</Text>
                        <Text style={[styles.memberStatText, { color: netBal > 0.01 ? theme.success : netBal < -0.01 ? theme.negative : theme.textMuted }]}>
                          {' · '}{netBal > 0.01 ? `+${formatCurrency(netBal, currency)}` : netBal < -0.01 ? `-${formatCurrency(Math.abs(netBal), currency)}` : 'settled'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {m.id === group.createdBy && (
                      <View style={styles.adminBadge}><Text style={styles.adminText}>Admin</Text></View>
                    )}
                    {/* Feature 14: Remove member (admin only, not self, zero balance) */}
                    {group.createdBy === user.id && m.id !== user.id && (
                      <TouchableOpacity testID={`remove-member-${m.id}`} accessibilityLabel={`Remove ${m.name} from group`} activeOpacity={0.7} onPress={() => handleRemoveMember(m)} style={styles.removeMemberBtn}>
                        <Ionicons name="close-circle-outline" size={18} color={theme.negative} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
            {group.createdBy === user.id && (
              <TouchableOpacity testID="add-member-btn" accessibilityLabel="Add member to group" activeOpacity={0.7} style={styles.addMemberBtn} onPress={() => setShowAddMember(true)}>
                <Ionicons name="person-add" size={18} color={theme.primary} />
                <Text style={styles.addMemberText}>Add Member</Text>
              </TouchableOpacity>
            )}
            {/* Feature 16: Share invite link */}
            <TouchableOpacity testID="share-invite-link-btn" accessibilityLabel="Share group invite link" activeOpacity={0.7} style={[styles.addMemberBtn, { marginTop: 8 }]} onPress={handleShareInviteLink}>
              <Ionicons name="link-outline" size={18} color={theme.primary} />
              <Text style={styles.addMemberText}>Share Group Invite</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Activity Tab (Feature 10) */}
        {tab === 'activity' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Group Activity</Text>
            {activityItems.length === 0 ? (
              <Text style={{ color: theme.textMuted, textAlign: 'center', paddingVertical: 20 }}>No activity yet</Text>
            ) : (
              activityItems.map((item, idx) => {
                const getActivityEmoji = (type) => {
                  switch (type) {
                    case 'expense_added': return '📝';
                    case 'settlement': return '💰';
                    case 'group_created': return '👥';
                    case 'member_joined': return '🙋';
                    default: return '📝';
                  }
                };
                const getActivityTitle = (item) => {
                  switch (item.type) {
                    case 'expense_added': return item.description || 'Expense added';
                    case 'settlement': return 'Payment settled';
                    case 'group_created': return 'Group created';
                    case 'member_joined': return `${item.paidByName || 'Someone'} joined`;
                    default: return 'Activity';
                  }
                };
                const getActivitySubtitle = (item) => {
                  switch (item.type) {
                    case 'expense_added':
                      return `${item.paidByName || 'Someone'} paid ${formatCurrency(item.amount, currency)}`;
                    case 'settlement':
                      return formatCurrency(item.amount, currency);
                    default: return '';
                  }
                };
                return (
                  <View key={item.id || idx} style={styles.activityRow}>
                    <View style={[styles.activityIconBox, { backgroundColor: theme.primaryLight }]}>
                      <Text style={{ fontSize: 18 }}>{getActivityEmoji(item.type)}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.activityTitle}>{getActivityTitle(item)}</Text>
                      {getActivitySubtitle(item) ? <Text style={styles.activitySub}>{getActivitySubtitle(item)}</Text> : null}
                    </View>
                    <Text style={styles.activityTime}>{formatDate(item.createdAt)}</Text>
                  </View>
                );
              })
            )}
          </View>
        )}
      </Animated.ScrollView>

      {/* Receipt Modal (Feature 5) */}
      <Modal visible={!!receiptModalUri} animationType="fade" transparent>
        <TouchableOpacity activeOpacity={1} style={styles.receiptModalOverlay} onPress={() => setReceiptModalUri(null)}>
          <TouchableOpacity
            testID="close-receipt-modal"
            accessibilityLabel="Close receipt"
            activeOpacity={0.7}
            style={styles.receiptModalClose}
            onPress={() => setReceiptModalUri(null)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {receiptModalUri && (
            <Image
              source={{ uri: receiptModalUri }}
              style={styles.receiptModalImage}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </Modal>

      {/* Unified Add Member Modal */}
      <AddPeopleModal
        visible={showAddMember}
        onClose={() => setShowAddMember(false)}
        mode="group-member"
        groupId={groupId}
        groupName={group?.name}
        existingMemberIds={(group?.members || []).map(m => m.id)}
        onPersonAdded={async () => { await notifyWrite('add_member'); globalRefresh(); loadData(); }}
      />
    </View>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 56,
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerCenter: { flex: 1 },
  groupName: { fontSize: 20, fontWeight: '700', color: theme.text, letterSpacing: -0.5 },
  memberCount: { fontSize: 13, color: theme.textLight },
  addExpBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
  },
  addExpText: { color: theme.background, fontWeight: '700', marginLeft: 4, fontSize: 14 },
  tabs: {
    flexDirection: 'row', backgroundColor: theme.card,
    marginHorizontal: 16, marginTop: 12, borderRadius: 16,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  tabActive: { backgroundColor: theme.primaryLight },
  tabText: { fontSize: 14, color: theme.textMuted, fontWeight: '500' },
  tabTextActive: { color: theme.primary, fontWeight: '700' },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 0,
    borderRadius: 24,
    padding: 24,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 20, elevation: 6,
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: theme.primary,
    opacity: 0.12,
  },
  heroIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  heroIconBoxCoral: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,107,107,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  heroLabel: {
    fontSize: 14,
    color: theme.textLight,
  },
  heroAmount: {
    fontSize: 48,
    fontWeight: '700',
    color: theme.text,
    marginTop: 4,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  heroPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.primary,
    marginRight: 8,
  },
  heroExpCount: {
    fontSize: 13,
    color: theme.textLight,
  },
  heroStatGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  heroStatCell: {
    flex: 1,
    backgroundColor: theme.inputBg,
    borderRadius: 16,
    padding: 14,
    alignItems: 'flex-start',
  },
  heroStatValue: {
    fontSize: rFontSize(28),
    fontWeight: '700',
    color: theme.text,
    marginTop: 10,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  heroStatLabel: {
    fontSize: 12,
    color: theme.textLight,
    marginTop: 2,
  },
  expenseCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card,
    marginHorizontal: 16, marginTop: 10, borderRadius: 16, padding: rPadding(14, 10),
    borderWidth: 1, borderColor: theme.border,
  },
  deleteBtn: {
    marginTop: 6, padding: 4, alignSelf: 'flex-end',
    borderRadius: 6, backgroundColor: 'rgba(255,107,107,0.08)',
  },
  expCatIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  expInfo: { flex: 1 },
  expName: { fontSize: 15, fontWeight: '600', color: theme.text, flex: 1, minWidth: 0 },
  expMeta: { fontSize: 12, color: theme.textLight, marginTop: 3 },
  expRight: { alignItems: 'flex-end' },
  expLabelGreen: { fontSize: 11, color: theme.success },
  expLabelRed: { fontSize: 11, color: theme.negative },
  expLabelNeutral: { fontSize: 11, color: theme.textMuted },
  expAmount: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'], flexShrink: 0 },
  section: { margin: 16, backgroundColor: theme.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  balanceRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    paddingHorizontal: 10, borderRadius: 14, marginBottom: 6,
    backgroundColor: theme.inputBg,
  },
  balanceInfo: { flex: 1, marginLeft: 12 },
  balanceName: { fontSize: 15, fontWeight: '600', color: theme.text, flex: 1, minWidth: 0 },
  balanceAmount: { fontSize: 13, marginTop: 2 },
  debtRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    paddingHorizontal: 10, borderRadius: 14, marginBottom: 6,
    backgroundColor: theme.inputBg,
  },
  debtText: { flex: 1, minWidth: 0, marginLeft: 10, fontSize: 14, color: theme.text },
  debtName: { fontWeight: '600' },
  debtAmount: { fontSize: 15, fontWeight: '700', color: theme.negative, fontVariant: ['tabular-nums'], flexShrink: 0 },
  settleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: theme.primary },
  settleBtnText: { color: theme.primary, fontWeight: '600', marginLeft: 6 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    paddingHorizontal: 10, borderRadius: 14, marginBottom: 6,
    backgroundColor: theme.inputBg,
  },
  memberInfo: { flex: 1, marginLeft: 12 },
  memberName: { fontSize: 15, fontWeight: '600', color: theme.text, flex: 1, minWidth: 0 },
  memberEmail: { fontSize: 11, color: theme.textLight, marginTop: 2 },
  adminBadge: {
    backgroundColor: theme.primaryLight, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(0,212,170,0.3)',
  },
  adminText: { fontSize: 11, color: theme.primary, fontWeight: '600' },
  addMemberBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: theme.primaryLight, borderWidth: 1, borderColor: 'rgba(0,212,170,0.2)' },
  addMemberText: { color: theme.primary, fontWeight: '600', marginLeft: 6 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: theme.textLight, marginTop: 12 },
  addFirstBtn: { backgroundColor: theme.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, marginTop: 16 },
  addFirstBtnText: { color: theme.background, fontWeight: '700' },
  modal: { flex: 1, backgroundColor: theme.background, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
  cancelText: { fontSize: 16, color: theme.textLight },
  saveText: { fontSize: 16, color: theme.primary, fontWeight: '700' },
  searchRow: { flexDirection: 'row', gap: 10 },
  searchInput: { flex: 1, backgroundColor: theme.card, borderRadius: 14, padding: 14, fontSize: 15, color: theme.text, borderWidth: 1, borderColor: theme.border },
  searchBtn: { backgroundColor: theme.primary, borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  searchBtnText: { color: theme.background, fontWeight: '700' },
  foundUser: { flexDirection: 'row', alignItems: 'center', marginTop: 16, backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.border },
  foundName: { fontSize: 16, fontWeight: '600', color: theme.text },
  foundEmail: { fontSize: 13, color: theme.textLight },

  // Feature 2: Hero extra lines
  heroExtraLine: { fontSize: 12, color: theme.textLight, marginBottom: 4, lineHeight: 18 },

  // Feature 3: Settlement flow cards
  settlementFlowCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,212,170,0.06)', borderRadius: 16,
    padding: 14, marginBottom: 10,
    borderWidth: 1.5, borderColor: 'rgba(0,212,170,0.2)',
  },
  settlementFlowPerson: { alignItems: 'center', width: rWidth(56, 48) },
  settlementFlowName: { fontSize: 10, color: theme.textLight, marginTop: 4, textAlign: 'center', width: '100%' },
  settlementFlowArrow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  settlementFlowLine: { width: 20, height: 1.5, backgroundColor: 'rgba(0,212,170,0.3)' },
  settlementFlowAmount: { fontSize: 14, fontWeight: '800', color: theme.primary, fontVariant: ['tabular-nums'] },
  settlementFlowBtn: {
    backgroundColor: theme.primary, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 8, marginLeft: 8,
  },
  settlementFlowBtnText: { fontSize: 12, fontWeight: '700', color: theme.background },

  // Feature 5: Receipt modal
  receiptModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center', alignItems: 'center',
  },
  receiptModalClose: {
    position: 'absolute', top: 60, right: 20, zIndex: 10,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.border,
    alignItems: 'center', justifyContent: 'center',
  },
  receiptModalImage: { width: '90%', height: '70%' },

  // Feature 6: Comments
  commentsSection: {
    marginHorizontal: 16, marginTop: -4, marginBottom: 10,
    backgroundColor: theme.card, borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
    padding: 14, borderWidth: 1, borderTopWidth: 0,
    borderColor: theme.border,
  },
  commentRow: {
    paddingVertical: 8, borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  commentAuthor: { fontSize: 12, fontWeight: '700', color: theme.primary },
  commentText: { fontSize: 13, color: theme.text, marginTop: 2 },
  commentDate: { fontSize: 10, color: theme.textMuted, marginTop: 2 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  commentInput: {
    flex: 1, backgroundColor: theme.inputBg,
    borderRadius: 12, padding: 10, fontSize: 13, color: theme.text,
    borderWidth: 1, borderColor: theme.border,
  },
  commentSendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },

  // Feature 1,2: Search + Sort controls
  expenseControls: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 10, gap: 8,
  },
  expenseSearchRow: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: theme.border, gap: 8,
  },
  expenseSearchInput: { flex: 1, fontSize: 14, color: theme.text },
  sortBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: theme.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.border,
  },
  sortMenu: {
    marginHorizontal: 16, marginTop: 6, backgroundColor: theme.card,
    borderRadius: 12, padding: 6, borderWidth: 1, borderColor: theme.border,
  },
  sortMenuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8,
  },
  sortMenuItemActive: { backgroundColor: theme.primaryLight },
  sortMenuText: { fontSize: 14, color: theme.textLight },
  sortMenuTextActive: { color: theme.primary, fontWeight: '600' },

  // Feature 3,4,8: Expense action buttons
  expenseActions: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: -4, marginBottom: 6, gap: 8,
  },
  expActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, borderRadius: 10, backgroundColor: theme.card,
    borderWidth: 1, borderColor: 'rgba(0,212,170,0.2)', gap: 4,
  },
  expActionText: { fontSize: 12, fontWeight: '600', color: theme.primary },

  // Feature 10: Settle All
  settleAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.primary, borderRadius: 14,
    paddingVertical: 12, gap: 8,
  },
  settleAllBtnText: { fontSize: 14, fontWeight: '700', color: theme.background },

  // Feature 13: Member stats
  memberStats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  memberStatText: { fontSize: 11, color: theme.textMuted },

  // Feature 14: Remove member button
  removeMemberBtn: { padding: 4 },

  // Feature 7: Share button
  shareBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },

  // Feature 10: Activity feed
  activityRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  activityIconBox: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  activityTitle: { fontSize: 14, fontWeight: '600', color: theme.text },
  activitySub: { fontSize: 12, color: theme.textLight, marginTop: 2 },
  activityTime: { fontSize: 11, color: theme.textMuted },
});

export default GroupDetailScreen;
