import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withDelay,
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { respondToGroupInvite } from '../services/storage';
import { COLORS } from '../constants/colors';
import Avatar from '../components/Avatar';
import BackgroundOrbs from '../components/BackgroundOrbs';
import { formatDate } from '../utils/splitCalculator';
import { formatAmount } from '../services/currency';

const HomeScreen = ({ navigation }) => {
  const { user, balances, activity, groups, totalBalance, currency, refresh, groupInvites, notifyWrite } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [respondingInvite, setRespondingInvite] = useState(null);

  // Balance card entrance animation
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(32);
  const statsOpacity = useSharedValue(0);
  const statsTranslateY = useSharedValue(20);

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));
  const statsAnimStyle = useAnimatedStyle(() => ({
    opacity: statsOpacity.value,
    transform: [{ translateY: statsTranslateY.value }],
  }));

  useFocusEffect(useCallback(() => {
    refresh();
    // Entrance animation on each focus
    cardOpacity.value = 0;
    cardTranslateY.value = 32;
    statsOpacity.value = 0;
    statsTranslateY.value = 20;
    cardOpacity.value = withTiming(1, { duration: 380 });
    cardTranslateY.value = withSpring(0, { damping: 18, stiffness: 120 });
    statsOpacity.value = withDelay(120, withTiming(1, { duration: 360 }));
    statsTranslateY.value = withDelay(120, withSpring(0, { damping: 18, stiffness: 120 }));
  }, [refresh]));

  const onRefresh = async () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleInviteResponse = async (invite, accept) => {
    setRespondingInvite(invite.id);
    try {
      await respondToGroupInvite(invite.id, accept, user.id);
      await notifyWrite(accept ? 'accept_invite' : 'reject_invite');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setRespondingInvite(null);
    }
  };

  const oweMe = balances.filter(b => b.amount > 0);
  const iOwe = balances.filter(b => b.amount < 0);
  const totalOwedToMe = oweMe.reduce((s, b) => s + b.amount, 0);
  const totalIOwe = iOwe.reduce((s, b) => s + Math.abs(b.amount), 0);

  const getActivityIcon = (type) => {
    switch (type) {
      case 'expense_added': return { icon: 'receipt', color: '#4fc3f7' };
      case 'settlement': return { icon: 'checkmark-circle', color: COLORS.success };
      case 'group_created': return { icon: 'people', color: COLORS.primary };
      case 'member_joined': return { icon: 'person-add', color: '#00d4aa' };
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
      case 'member_joined':
        return `${item.paidByName || 'Someone'} joined "${item.groupName}"`;
      default:
        return 'Activity';
    }
  };

  const isSettled = Math.abs(totalBalance) < 0.01;

  return (
    <View style={styles.container}>
      <BackgroundOrbs />
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* App Header */}
        <View style={styles.appHeader}>
          <View style={styles.logoRow}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>E</Text>
            </View>
            <Text style={styles.appName}>Evenly</Text>
          </View>
          <TouchableOpacity testID="header-avatar" activeOpacity={0.7} onPress={() => navigation.navigate('Profile')} style={styles.avatarBtn}>
            <Avatar name={user?.name} avatar={user?.avatar} size={40} />
          </TouchableOpacity>
        </View>

        {/* Pending Group Invites */}
        {groupInvites && groupInvites.length > 0 && (
          <View style={styles.inviteSection}>
            <Text style={styles.inviteSectionTitle}>Group Invitations</Text>
            {groupInvites.map(invite => (
              <View key={invite.id} style={styles.inviteCard}>
                <View style={styles.inviteIconBox}>
                  <Ionicons name="people" size={20} color="#00d4aa" />
                </View>
                <View style={styles.inviteInfo}>
                  <Text style={styles.inviteGroupName}>{invite.groupName}</Text>
                  <Text style={styles.inviteSubtext}>{invite.invitedByName} invited you</Text>
                </View>
                <View style={styles.inviteActions}>
                  {respondingInvite === invite.id ? (
                    <ActivityIndicator size="small" color="#00d4aa" />
                  ) : (
                    <>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={styles.inviteAcceptBtn}
                        onPress={() => handleInviteResponse(invite, true)}
                      >
                        <Text style={styles.inviteAcceptText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={styles.inviteRejectBtn}
                        onPress={() => handleInviteResponse(invite, false)}
                      >
                        <Text style={styles.inviteRejectText}>Decline</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Hero Balance Card */}
        <Animated.View style={[styles.heroCard, cardAnimStyle]}>
          {/* Glow effect */}
          <View style={styles.heroGlow} />
          <Text style={styles.heroLabel}>Total balance</Text>
          <Text style={styles.heroAmount}>
            {formatAmount(Math.abs(totalBalance), currency)}
          </Text>
          <View style={[styles.heroBadge, { backgroundColor: isSettled ? COLORS.primaryLight : totalBalance > 0 ? COLORS.primaryLight : 'rgba(255,107,107,0.12)' }]}>
            <View style={[styles.heroDot, { backgroundColor: isSettled ? COLORS.primary : totalBalance > 0 ? COLORS.primary : COLORS.negative }]} />
            <Text style={[styles.heroBadgeText, { color: isSettled ? COLORS.primary : totalBalance > 0 ? COLORS.primary : COLORS.negative }]}>
              {isSettled ? 'All settled up!' : totalBalance > 0 ? 'You are owed' : 'You owe'}
            </Text>
          </View>
        </Animated.View>

        {/* Stats Grid */}
        <Animated.View style={[styles.statsGrid, statsAnimStyle]}>
          <TouchableOpacity
            activeOpacity={totalOwedToMe > 0 ? 0.7 : 1}
            style={[styles.statCard, styles.statCardPositive]}
            onPress={() => totalOwedToMe > 0 && navigation.navigate('Friends')}
          >
            <View style={[styles.statIcon, { backgroundColor: 'rgba(0,212,170,0.1)' }]}>
              <Ionicons name="trending-up" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.statAmount}>{formatAmount(totalOwedToMe, currency)}</Text>
            <Text style={styles.statLabel}>you're owed</Text>
            {totalOwedToMe > 0 && <Text style={styles.statTapHint}>tap to see who →</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={totalIOwe > 0 ? 0.7 : 1}
            style={[styles.statCard, styles.statCardNegative]}
            onPress={() => totalIOwe > 0 && navigation.navigate('Friends')}
          >
            <View style={[styles.statIcon, { backgroundColor: 'rgba(255,107,107,0.1)' }]}>
              <Ionicons name="trending-down" size={20} color={COLORS.negative} />
            </View>
            <Text style={[styles.statAmount, { color: COLORS.negative }]}>{formatAmount(totalIOwe, currency)}</Text>
            <Text style={styles.statLabel}>you owe</Text>
            {totalIOwe > 0 && <Text style={[styles.statTapHint, { color: '#ff6b6b' }]}>tap to see who →</Text>}
          </TouchableOpacity>
        </Animated.View>

        {/* Balances Section */}
        {balances.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Balances</Text>
              <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Friends')}>
                <View style={styles.seeAllRow}>
                  <Text style={styles.seeAll}>See all</Text>
                  <Ionicons name="arrow-forward" size={14} color={COLORS.primary} />
                </View>
              </TouchableOpacity>
            </View>
            {balances.slice(0, 4).map(b => (
              <TouchableOpacity
                activeOpacity={0.7}
                key={b.userId}
                style={styles.balanceRow}
                onPress={() => navigation.navigate('Friends')}
              >
                <Avatar name={b.name} avatar={b.avatar} size={44} />
                <View style={styles.balanceInfo}>
                  <Text style={styles.balanceName}>{b.name}</Text>
                  <Text style={[styles.balanceSub, { color: b.amount > 0 ? COLORS.primary : COLORS.negative }]}>
                    {b.amount > 0 ? 'owes you' : 'you owe'}
                  </Text>
                </View>
                <Text style={[styles.balanceValue, { color: b.amount > 0 ? COLORS.primary : COLORS.negative }]}>
                  {b.amount > 0 ? '+' : '-'}{formatAmount(Math.abs(b.amount), currency)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent activity</Text>
            <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Activity')}>
              <View style={styles.seeAllRow}>
                <Text style={styles.seeAll}>See all</Text>
                <Ionicons name="arrow-forward" size={14} color={COLORS.primary} />
              </View>
            </TouchableOpacity>
          </View>
          {activity.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Text style={styles.emptyEmoji}>✨</Text>
              <Text style={styles.emptyText}>No activity yet</Text>
            </View>
          ) : (
            <View style={styles.activityList}>
              {activity.slice(0, 5).map((item, idx) => {
                const { icon, color } = getActivityIcon(item.type);
                const handlePress = () => item.groupId
                  ? navigation.navigate('GroupDetail', { groupId: item.groupId })
                  : navigation.navigate('Activity');
                return (
                  <TouchableOpacity key={item.id || idx} activeOpacity={0.7} onPress={handlePress} style={[styles.activityItem, idx < activity.slice(0, 5).length - 1 && styles.activityBorder]}>
                    <View style={[styles.activityIcon, { backgroundColor: color + '18' }]}>
                      <Ionicons name={icon} size={18} color={color} />
                    </View>
                    <View style={styles.activityContent}>
                      <Text style={styles.activityText} numberOfLines={2}>{getActivityText(item)}</Text>
                      <Text style={styles.activityTime}>{formatDate(item.createdAt)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.2)" />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Empty state for new users */}
        {groups.length === 0 && balances.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>💸</Text>
            <Text style={styles.emptyStateTitle}>Welcome to Evenly!</Text>
            <Text style={styles.emptyStateText}>Create a group and start splitting expenses with friends.</Text>
            <TouchableOpacity activeOpacity={0.7} style={styles.emptyStateBtn} onPress={() => navigation.navigate('Groups')}>
              <Text style={styles.emptyStateBtnText}>Create a Group</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // App Header
  appHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: 'rgba(10,10,15,0.9)',
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
  },
  logoText: { color: '#0a0a0f', fontSize: 20, fontWeight: '800' },
  appName: { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  avatarBtn: {},

  // Hero Card
  heroCard: {
    margin: 16, borderRadius: 24, padding: 28,
    backgroundColor: '#1a1a24',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: 2, borderTopColor: '#00d4aa',
    overflow: 'hidden', position: 'relative',
    shadowColor: '#00d4aa', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 20, elevation: 12,
  },
  heroGlow: {
    position: 'absolute', top: -30, right: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: COLORS.primary, opacity: 0.15,
  },
  heroLabel: { fontSize: 13, color: COLORS.textLight, fontWeight: '600', marginBottom: 8 },
  heroAmount: { fontSize: 52, fontWeight: '800', color: COLORS.text, letterSpacing: -1, marginBottom: 12 },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20,
  },
  heroDot: { width: 8, height: 8, borderRadius: 4 },
  heroBadgeText: { fontSize: 13, fontWeight: '700' },

  // Stats Grid
  statsGrid: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 8 },
  statCard: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  statCardPositive: { borderLeftWidth: 3, borderLeftColor: '#00d4aa' },
  statCardNegative: { borderLeftWidth: 3, borderLeftColor: '#ff6b6b' },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statAmount: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  statLabel: { fontSize: 12, color: COLORS.textLight, fontWeight: '600' },
  statTapHint: { fontSize: 10, color: '#00d4aa', marginTop: 6, fontWeight: '600' },

  // Sections
  section: {
    backgroundColor: COLORS.white, marginHorizontal: 16, marginBottom: 12,
    borderRadius: 24, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#a1a1aa', letterSpacing: 1, textTransform: 'uppercase' },
  seeAllRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAll: { fontSize: 13, color: COLORS.primary, fontWeight: '700' },

  // Balances
  balanceRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderRadius: 16, paddingHorizontal: 4,
  },
  balanceInfo: { flex: 1, marginLeft: 12 },
  balanceName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  balanceSub: { fontSize: 12, marginTop: 1, fontWeight: '500' },
  balanceValue: { fontSize: 16, fontWeight: '800' },

  // Activity
  activityList: {},
  activityItem: {
    flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10,
    backgroundColor: COLORS.white, borderRadius: 16,
    paddingHorizontal: 4,
  },
  activityBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  activityIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 },
  activityContent: { flex: 1 },
  activityText: { fontSize: 13, color: COLORS.text, lineHeight: 19 },
  activityTime: { fontSize: 11, color: COLORS.textMuted, marginTop: 3 },
  emptyActivity: {
    alignItems: 'center', paddingVertical: 28,
    backgroundColor: '#1a1a24', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 14, color: COLORS.textLight, fontWeight: '600' },

  // Empty State
  emptyState: {
    alignItems: 'center', margin: 16, padding: 28,
    backgroundColor: '#1a1a24', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyStateEmoji: { fontSize: 48, marginBottom: 12 },
  emptyStateTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  emptyStateText: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', lineHeight: 20 },
  emptyStateBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, marginTop: 16,
  },
  emptyStateBtnText: { color: '#0a0a0f', fontWeight: '800', fontSize: 15 },

  // FAB
  fab: {
    position: 'absolute', right: 20, bottom: 90,
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 10,
  },

  // Invites
  inviteSection: {
    marginHorizontal: 16, marginBottom: 12,
  },
  inviteSectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#a1a1aa',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
  },
  inviteCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a24', borderRadius: 20, padding: 14,
    borderWidth: 1, borderColor: 'rgba(0,212,170,0.25)',
    marginBottom: 8,
  },
  inviteIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(0,212,170,0.1)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  inviteInfo: { flex: 1 },
  inviteGroupName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  inviteSubtext: { fontSize: 12, color: '#a1a1aa', marginTop: 2 },
  inviteActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  inviteAcceptBtn: {
    backgroundColor: '#00d4aa', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  inviteAcceptText: { color: '#0a0a0f', fontWeight: '700', fontSize: 13 },
  inviteRejectBtn: {
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  inviteRejectText: { color: '#a1a1aa', fontWeight: '600', fontSize: 13 },
});

export default HomeScreen;
