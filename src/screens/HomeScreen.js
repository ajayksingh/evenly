import React, { useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../context/AppContext';
import { COLORS } from '../constants/colors';
import Avatar from '../components/Avatar';
import { formatDate } from '../utils/splitCalculator';
import { formatAmount } from '../services/currency';

const HomeScreen = ({ navigation }) => {
  const { user, balances, activity, groups, totalBalance, currency, refresh, loading } = useApp();
  const [refreshing, setRefreshing] = React.useState(false);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const onRefresh = async () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 800);
  };

  const oweMe = balances.filter(b => b.amount > 0);
  const iOwe = balances.filter(b => b.amount < 0);

  const getActivityIcon = (type) => {
    switch (type) {
      case 'expense_added': return { icon: 'receipt', color: '#3498DB' };
      case 'settlement': return { icon: 'checkmark-circle', color: COLORS.success };
      case 'group_created': return { icon: 'people', color: COLORS.primary };
      default: return { icon: 'ellipse', color: COLORS.textLight };
    }
  };

  const getActivityText = (item) => {
    switch (item.type) {
      case 'expense_added':
        return `${item.paidByName || 'Someone'} added "${item.description}" — ${formatAmount(item.amount, currency)}`;
      case 'settlement':
        return `Payment of ${formatAmount(item.amount, currency)} recorded`;
      case 'group_created':
        return `Group "${item.groupName}" created`;
      default:
        return 'Activity';
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Header */}
        <LinearGradient colors={COLORS.primaryGradient} style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'} 👋</Text>
              <Text style={styles.userName}>{user?.name?.split(' ')[0] || 'there'}</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
              <Avatar name={user?.name} avatar={user?.avatar} size={44} />
            </TouchableOpacity>
          </View>

          {/* Total Balance */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Net Balance</Text>
            <Text style={[styles.balanceAmount, {
              color: totalBalance > 0.01 ? COLORS.success : totalBalance < -0.01 ? COLORS.negative : COLORS.text
            }]}>
              {totalBalance > 0.01 ? '+' : ''}{formatAmount(totalBalance, currency)}
            </Text>
            <Text style={styles.balanceSubtext}>
              {Math.abs(totalBalance) < 0.01
                ? 'All settled up!'
                : totalBalance > 0
                  ? `${oweMe.length} people owe you`
                  : `You owe ${iOwe.length} people`}
            </Text>
          </View>
        </LinearGradient>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statAmount, { color: COLORS.success }]}>{formatAmount(oweMe.reduce((s, b) => s + b.amount, 0), currency)}</Text>
            <Text style={styles.statLabel}>You're owed</Text>
          </View>
          <View style={[styles.statCard, styles.statCardMiddle]}>
            <Text style={[styles.statAmount, { color: COLORS.primary }]}>{groups.length}</Text>
            <Text style={styles.statLabel}>Groups</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statAmount, { color: COLORS.negative }]}>{formatAmount(iOwe.reduce((s, b) => s + Math.abs(b.amount), 0), currency)}</Text>
            <Text style={styles.statLabel}>You owe</Text>
          </View>
        </View>

        {/* Who Owes You */}
        {oweMe.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Owed to you</Text>
            {oweMe.slice(0, 3).map(b => (
              <TouchableOpacity key={b.userId} style={styles.balanceItem} onPress={() => navigation.navigate('Friends')}>
                <Avatar name={b.name} avatar={b.avatar} size={40} />
                <View style={styles.balanceInfo}>
                  <Text style={styles.balanceName}>{b.name}</Text>
                  <Text style={styles.balanceSubLabel}>owes you</Text>
                </View>
                <Text style={[styles.balanceValue, { color: COLORS.success }]}>+{formatAmount(b.amount, currency)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* You Owe */}
        {iOwe.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>You owe</Text>
            {iOwe.slice(0, 3).map(b => (
              <TouchableOpacity key={b.userId} style={styles.balanceItem} onPress={() => navigation.navigate('Friends')}>
                <Avatar name={b.name} avatar={b.avatar} size={40} />
                <View style={styles.balanceInfo}>
                  <Text style={styles.balanceName}>{b.name}</Text>
                  <Text style={styles.balanceSubLabel}>you owe</Text>
                </View>
                <Text style={[styles.balanceValue, { color: COLORS.negative }]}>{formatAmount(Math.abs(b.amount), currency)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Activity')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {activity.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Ionicons name="time-outline" size={32} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No activity yet</Text>
              <Text style={styles.emptySubText}>Start by adding a group or expense</Text>
            </View>
          ) : (
            activity.slice(0, 8).map((item, idx) => {
              const { icon, color } = getActivityIcon(item.type);
              return (
                <View key={item.id || idx} style={styles.activityItem}>
                  <View style={[styles.activityIcon, { backgroundColor: color + '20' }]}>
                    <Ionicons name={icon} size={18} color={color} />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityText} numberOfLines={2}>{getActivityText(item)}</Text>
                    <Text style={styles.activityTime}>{formatDate(item.createdAt)}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Empty state for new users */}
        {groups.length === 0 && balances.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>💸</Text>
            <Text style={styles.emptyStateTitle}>Welcome to SplitWise!</Text>
            <Text style={styles.emptyStateText}>Create a group and start splitting expenses with friends.</Text>
            <TouchableOpacity style={styles.emptyStateBtn} onPress={() => navigation.navigate('Groups')}>
              <Text style={styles.emptyStateBtnText}>Create a Group</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddExpense', {})}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  userName: { fontSize: 24, fontWeight: '800', color: '#fff' },
  balanceCard: {
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20,
    padding: 20, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 6, letterSpacing: 0.3 },
  balanceAmount: { fontSize: 38, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  balanceSubtext: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 },
  statsRow: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    marginHorizontal: 16, marginTop: -1, borderRadius: 20,
    marginBottom: 12,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10, shadowRadius: 12, elevation: 4,
  },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 18 },
  statCardMiddle: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: COLORS.border },
  statAmount: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 11, color: COLORS.textLight, marginTop: 3, fontWeight: '500' },
  section: {
    backgroundColor: COLORS.white, marginHorizontal: 16, marginBottom: 12,
    borderRadius: 20, padding: 16,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  seeAll: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  balanceItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  balanceInfo: { flex: 1, marginLeft: 12 },
  balanceName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  balanceSubLabel: { fontSize: 12, color: COLORS.textLight, marginTop: 1 },
  balanceValue: { fontSize: 16, fontWeight: '700' },
  activityItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
  activityIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  activityContent: { flex: 1 },
  activityText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  activityTime: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  emptyActivity: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { fontSize: 15, fontWeight: '600', color: COLORS.textLight, marginTop: 8 },
  emptySubText: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
  emptyState: { alignItems: 'center', margin: 16, padding: 24, backgroundColor: COLORS.white, borderRadius: 16 },
  emptyStateEmoji: { fontSize: 48 },
  emptyStateTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginTop: 12 },
  emptyStateText: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  emptyStateBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 16 },
  emptyStateBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  fab: {
    position: 'absolute', right: 20, bottom: 90,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
});

export default HomeScreen;
