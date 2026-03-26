import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Modal, TextInput, ActivityIndicator, Platform, StatusBar, Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS, CATEGORIES } from '../constants/colors';
import Avatar from '../components/Avatar';
import { getGroup, getExpenses, calculateGroupBalances, searchUsersByEmail, deleteExpense, sendGroupInvite } from '../services/storage';
import { supabase } from '../services/supabase';
import { formatCurrency, formatDate, getSimplifiedDebts } from '../utils/splitCalculator';
import { confirmAlert } from '../utils/alert';

const GroupDetailScreen = ({ route, navigation }) => {
  const { groupId } = route.params;
  const { user, refresh: globalRefresh, notifyWrite } = useApp();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [memberBalances, setMemberBalances] = useState([]);
  const [tab, setTab] = useState('expenses'); // expenses | balances | members
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState(null);

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerBg = scrollY.interpolate({ inputRange: [0, 80], outputRange: ['rgba(10,10,15,0)', 'rgba(10,10,15,0.97)'], extrapolate: 'clamp' });
  const headerBorder = scrollY.interpolate({ inputRange: [0, 80], outputRange: ['rgba(255,255,255,0)', COLORS.border], extrapolate: 'clamp' });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [g, e] = await Promise.all([getGroup(groupId), getExpenses(groupId)]);
    if (g) {
      setGroup(g);
      const mb = await calculateGroupBalances(groupId, g.members);
      setMemberBalances(mb);
    }
    setExpenses(e);
    setLoading(false);
  }, [groupId]);

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
        notifyWrite('delete_expense');
        globalRefresh();
        loadData();
      },
    });
  };

  const handleSearchUser = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    const results = await searchUsersByEmail(searchEmail.trim());
    const found = results.find(u => u.email.toLowerCase() === searchEmail.trim().toLowerCase());
    setFoundUser(found || null);
    if (!found) Alert.alert('Not found', 'No user with that email');
    setSearching(false);
  };

  const handleAddMember = async () => {
    if (!foundUser) return;
    try {
      await sendGroupInvite(groupId, group.name, foundUser.id, user.id, user.name);
      Alert.alert('Invite Sent', `${foundUser.name} will receive a request to join "${group.name}".`);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setShowAddMember(false);
      setSearchEmail('');
      setFoundUser(null);
    }
  };

  const simplifiedDebts = getSimplifiedDebts(memberBalances.map(m => ({ userId: m.id, name: m.name, amount: m.balance })));

  const getCategoryInfo = (cat) => CATEGORIES.find(c => c.id === cat) || CATEGORIES[8];

  const totalSpending = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const memberCount = group ? group.members.length : 0;
  const perPersonAvg = memberCount > 0 ? totalSpending / memberCount : 0;

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  if (!group) return <View style={styles.center}><Text>Group not found</Text></View>;

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: headerBorder }]}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.memberCount}>{group.members.length} members</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.addExpBtn}
          onPress={() => navigation.navigate('AddExpense', { groupId, groupName: group.name, members: group.members })}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addExpText}>Add</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['expenses', 'balances', 'members'].map(t => (
          <TouchableOpacity testID={`tab-${t}`} activeOpacity={0.7} key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Hero Stats Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />
        {/* Row 1: icon + label */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <View style={styles.heroIconBox}>
            <Ionicons name="cash-outline" size={20} color="#00d4aa" />
          </View>
          <Text style={styles.heroLabel}>Total group spending</Text>
        </View>
        {/* Row 2: total amount */}
        <Text style={styles.heroAmount}>{formatCurrency(totalSpending)}</Text>
        {/* Row 3: expense count */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 20 }}>
          <View style={styles.heroPulseDot} />
          <Text style={styles.heroExpCount}>{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</Text>
        </View>
        {/* 2-column stat grid */}
        <View style={styles.heroStatGrid}>
          {/* Left: members */}
          <View style={styles.heroStatCell}>
            <View style={styles.heroIconBox}>
              <Ionicons name="people-outline" size={20} color="#00d4aa" />
            </View>
            <Text style={styles.heroStatValue}>{memberCount}</Text>
            <Text style={styles.heroStatLabel}>members</Text>
          </View>
          {/* Right: per person avg */}
          <View style={styles.heroStatCell}>
            <View style={styles.heroIconBoxCoral}>
              <Ionicons name="trending-up-outline" size={20} color="#ff6b6b" />
            </View>
            <Text style={styles.heroStatValue}>{formatCurrency(perPersonAvg)}</Text>
            <Text style={styles.heroStatLabel}>per person avg</Text>
          </View>
        </View>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
      >
        {/* Expenses Tab */}
        {tab === 'expenses' && (
          <View>
            {expenses.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="receipt-outline" size={56} color={COLORS.textMuted} />
                <Text style={styles.emptyTitle}>No expenses yet</Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.addFirstBtn}
                  onPress={() => navigation.navigate('AddExpense', { groupId, groupName: group.name, members: group.members })}
                >
                  <Text style={styles.addFirstBtnText}>Add First Expense</Text>
                </TouchableOpacity>
              </View>
            ) : (
              expenses.map(exp => {
                const catInfo = getCategoryInfo(exp.category);
                const myShare = exp.splits.find(s => s.userId === user.id);
                const iPaid = exp.paidBy.id === user.id;
                return (
                  <View key={exp.id} style={styles.expenseCard}>
                    <View style={[styles.expCatIcon, { backgroundColor: catInfo.color + '20' }]}>
                      <Ionicons name={catInfo.icon} size={20} color={catInfo.color} />
                    </View>
                    <View style={styles.expInfo}>
                      <Text style={styles.expName}>{exp.description}</Text>
                      <Text style={styles.expMeta}>
                        {iPaid ? 'You' : exp.paidBy.name} paid {formatCurrency(exp.amount)} · {formatDate(exp.createdAt)}
                      </Text>
                    </View>
                    <View style={styles.expRight}>
                      {iPaid ? (
                        <>
                          <Text style={styles.expLabelGreen}>you paid</Text>
                          <Text style={[styles.expAmount, { color: COLORS.success }]}>{formatCurrency(exp.amount)}</Text>
                        </>
                      ) : myShare ? (
                        <>
                          <Text style={styles.expLabelRed}>your share</Text>
                          <Text style={[styles.expAmount, { color: COLORS.negative }]}>{formatCurrency(myShare.amount)}</Text>
                        </>
                      ) : (
                        <Text style={styles.expLabelNeutral}>not involved</Text>
                      )}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteExpense(exp)}
                      >
                        <Ionicons name="trash-outline" size={14} color={COLORS.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* Balances Tab */}
        {tab === 'balances' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Group Balances</Text>
            {memberBalances.map(m => (
              <View key={m.id} style={styles.balanceRow}>
                <Avatar name={m.name} avatar={m.avatar} size={38} />
                <View style={styles.balanceInfo}>
                  <Text style={styles.balanceName}>{m.id === user.id ? 'You' : m.name}</Text>
                  <Text style={[styles.balanceAmount, {
                    color: m.balance > 0.01 ? COLORS.success : m.balance < -0.01 ? COLORS.negative : COLORS.textLight
                  }]}>
                    {m.balance > 0.01 ? `gets back ${formatCurrency(m.balance)}`
                      : m.balance < -0.01 ? `owes ${formatCurrency(Math.abs(m.balance))}`
                        : 'settled up'}
                  </Text>
                </View>
              </View>
            ))}

            {simplifiedDebts.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Suggested Settlements</Text>
                {simplifiedDebts.map((d, idx) => (
                  <View key={idx} style={styles.debtRow}>
                    <Avatar name={d.fromName} size={32} />
                    <Text style={styles.debtText}>
                      <Text style={styles.debtName}>{d.fromName === user.name ? 'You' : d.fromName}</Text>
                      {' owes '}
                      <Text style={styles.debtName}>{d.toName === user.name ? 'you' : d.toName}</Text>
                    </Text>
                    <Text style={styles.debtAmount}>{formatCurrency(d.amount)}</Text>
                  </View>
                ))}
              </>
            )}

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.settleBtn}
              onPress={() => navigation.navigate('SettleUp', { group, members: group.members })}
            >
              <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
              <Text style={styles.settleBtnText}>Record a Payment</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Members Tab */}
        {tab === 'members' && (
          <View style={styles.section}>
            {group.members.map(m => (
              <View key={m.id} style={styles.memberRow}>
                <Avatar name={m.name} avatar={m.avatar} size={44} />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{m.id === user.id ? `${m.name} (You)` : m.name}</Text>
                  <Text style={styles.memberEmail}>{m.email}</Text>
                </View>
                {m.id === group.createdBy && (
                  <View style={styles.adminBadge}><Text style={styles.adminText}>Admin</Text></View>
                )}
              </View>
            ))}
            {group.createdBy === user.id && (
              <TouchableOpacity testID="add-member-btn" activeOpacity={0.7} style={styles.addMemberBtn} onPress={() => setShowAddMember(true)}>
                <Ionicons name="person-add" size={18} color={COLORS.primary} />
                <Text style={styles.addMemberText}>Add Member</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Animated.ScrollView>

      {/* Add Member Modal */}
      <Modal visible={showAddMember} animationType="slide" presentationStyle="formSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity testID="modal-cancel-btn" activeOpacity={0.7} style={{ padding: 8 }} onPress={() => { setShowAddMember(false); setFoundUser(null); setSearchEmail(''); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Member</Text>
            <TouchableOpacity testID="add-member-confirm-btn" activeOpacity={foundUser ? 0.7 : 1.0} onPress={handleAddMember}>
              <Text style={[styles.saveText, !foundUser && { opacity: 0.4 }]}>Add</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.searchRow}>
            <TextInput
              testID="member-search-input"
              style={styles.searchInput}
              placeholder="Enter email address"
              value={searchEmail}
              onChangeText={setSearchEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity testID="member-search-btn" activeOpacity={0.7} style={styles.searchBtn} onPress={handleSearchUser}>
              {searching ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchBtnText}>Find</Text>}
            </TouchableOpacity>
          </View>
          {foundUser && (
            <TouchableOpacity testID="add-member-action-btn" activeOpacity={0.7} onPress={handleAddMember} style={styles.foundUser}>
              <Avatar name={foundUser.name} size={44} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.foundName}>{foundUser.name}</Text>
                <Text style={styles.foundEmail}>{foundUser.email}</Text>
              </View>
              <View style={{ backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Add</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 56,
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#0a0a0f', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerCenter: { flex: 1 },
  groupName: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  memberCount: { fontSize: 13, color: '#a1a1aa' },
  addExpBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#00d4aa',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
  },
  addExpText: { color: '#0a0a0f', fontWeight: '700', marginLeft: 4, fontSize: 14 },
  tabs: {
    flexDirection: 'row', backgroundColor: '#1a1a24',
    marginHorizontal: 16, marginTop: 12, borderRadius: 16,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  tabActive: { backgroundColor: 'rgba(0,212,170,0.15)' },
  tabText: { fontSize: 14, color: '#52525b', fontWeight: '500' },
  tabTextActive: { color: '#00d4aa', fontWeight: '700' },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 0,
    borderRadius: 24,
    padding: 24,
    backgroundColor: '#1a1a24',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#00d4aa', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 20, elevation: 6,
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#00d4aa',
    opacity: 0.12,
  },
  heroIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0,212,170,0.1)',
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
    color: '#a1a1aa',
  },
  heroAmount: {
    fontSize: 48,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 4,
  },
  heroPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00d4aa',
    marginRight: 8,
  },
  heroExpCount: {
    fontSize: 13,
    color: '#a1a1aa',
  },
  heroStatGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  heroStatCell: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'flex-start',
  },
  heroStatValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 10,
  },
  heroStatLabel: {
    fontSize: 12,
    color: '#a1a1aa',
    marginTop: 2,
  },
  expenseCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a24',
    marginHorizontal: 16, marginTop: 10, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  deleteBtn: {
    marginTop: 6, padding: 4, alignSelf: 'flex-end',
    borderRadius: 6, backgroundColor: 'rgba(255,107,107,0.08)',
  },
  expCatIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  expInfo: { flex: 1 },
  expName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  expMeta: { fontSize: 12, color: '#a1a1aa', marginTop: 3 },
  expRight: { alignItems: 'flex-end' },
  expLabelGreen: { fontSize: 11, color: COLORS.success },
  expLabelRed: { fontSize: 11, color: COLORS.negative },
  expLabelNeutral: { fontSize: 11, color: '#52525b' },
  expAmount: { fontSize: 15, fontWeight: '700' },
  section: { margin: 16, backgroundColor: '#1a1a24', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  balanceRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    paddingHorizontal: 10, borderRadius: 14, marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  balanceInfo: { flex: 1, marginLeft: 12 },
  balanceName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  balanceAmount: { fontSize: 13, marginTop: 2 },
  debtRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    paddingHorizontal: 10, borderRadius: 14, marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  debtText: { flex: 1, marginLeft: 10, fontSize: 14, color: COLORS.text },
  debtName: { fontWeight: '600' },
  debtAmount: { fontSize: 15, fontWeight: '700', color: COLORS.negative },
  settleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#00d4aa' },
  settleBtnText: { color: '#00d4aa', fontWeight: '600', marginLeft: 6 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    paddingHorizontal: 10, borderRadius: 14, marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  memberInfo: { flex: 1, marginLeft: 12 },
  memberName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  memberEmail: { fontSize: 11, color: '#a1a1aa', marginTop: 2 },
  adminBadge: {
    backgroundColor: 'rgba(0,212,170,0.15)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(0,212,170,0.3)',
  },
  adminText: { fontSize: 11, color: '#00d4aa', fontWeight: '600' },
  addMemberBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: 'rgba(0,212,170,0.12)', borderWidth: 1, borderColor: 'rgba(0,212,170,0.2)' },
  addMemberText: { color: '#00d4aa', fontWeight: '600', marginLeft: 6 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#a1a1aa', marginTop: 12 },
  addFirstBtn: { backgroundColor: '#00d4aa', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, marginTop: 16 },
  addFirstBtnText: { color: '#0a0a0f', fontWeight: '700' },
  modal: { flex: 1, backgroundColor: '#0a0a0f', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  cancelText: { fontSize: 16, color: '#a1a1aa' },
  saveText: { fontSize: 16, color: '#00d4aa', fontWeight: '700' },
  searchRow: { flexDirection: 'row', gap: 10 },
  searchInput: { flex: 1, backgroundColor: '#1a1a24', borderRadius: 14, padding: 14, fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  searchBtn: { backgroundColor: '#00d4aa', borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  searchBtnText: { color: '#0a0a0f', fontWeight: '700' },
  foundUser: { flexDirection: 'row', alignItems: 'center', marginTop: 16, backgroundColor: '#1a1a24', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  foundName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  foundEmail: { fontSize: 13, color: '#a1a1aa' },
});

export default GroupDetailScreen;
