import React, { useCallback, useState, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Image,
  RefreshControl, StatusBar, Alert, ActivityIndicator,
  Animated as RNAnimated, Platform, FlatList,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withDelay,
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { respondToGroupInvite } from '../services/storage';
import { COLORS } from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import Avatar from '../components/Avatar';
import BackgroundOrbs from '../components/BackgroundOrbs';
import PressableScale from '../components/PressableScale';
import FadeInView from '../components/FadeInView';
import Skeleton from '../components/Skeleton';
import { formatDate, getSimplifiedDebts } from '../utils/splitCalculator';
import { formatAmount } from '../services/currency';
import { isNarrow, rPadding, rFontSize, rWidth } from '../utils/responsive';
import { BannerAd, BannerAdSize, AD_UNIT_IDS } from '../services/ads';

const HomeScreen = ({ navigation }) => {
  const { user, balances, activity, groups, totalBalance, currency, refresh, groupInvites, notifyWrite, lastLoadTimestamp } = useApp();
  const { theme, colorScheme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [refreshing, setRefreshing] = useState(false);
  const [respondingInvite, setRespondingInvite] = useState(null);

  // Cross-group simplified debts — nets balances across ALL groups
  const globalDebts = useMemo(() => {
    if (!user || balances.length === 0) return [];
    return getSimplifiedDebts(
      balances.map(b => ({ userId: b.userId, name: b.name, amount: -b.amount }))
        .concat([{ userId: user.id, name: user.name, amount: balances.reduce((s, b) => s + b.amount, 0) }])
    );
  }, [balances, user]);

  // Balance card entrance animation (disabled on web to prevent flicker)
  const isWeb = Platform.OS === 'web';
  const cardOpacity = useSharedValue(isWeb ? 1 : 0);
  const cardTranslateY = useSharedValue(isWeb ? 0 : 32);
  const statsOpacity = useSharedValue(isWeb ? 1 : 0);
  const statsTranslateY = useSharedValue(isWeb ? 0 : 20);

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));
  const statsAnimStyle = useAnimatedStyle(() => ({
    opacity: statsOpacity.value,
    transform: [{ translateY: statsTranslateY.value }],
  }));

  const animatedOnce = useRef(false);
  useFocusEffect(useCallback(() => {
    refresh();
    if (!isWeb && !animatedOnce.current) {
      animatedOnce.current = true;
      cardOpacity.value = 0;
      cardTranslateY.value = 32;
      statsOpacity.value = 0;
      statsTranslateY.value = 20;
      cardOpacity.value = withTiming(1, { duration: 380 });
      cardTranslateY.value = withSpring(0, { damping: 18, stiffness: 120 });
      statsOpacity.value = withDelay(120, withTiming(1, { duration: 360 }));
      statsTranslateY.value = withDelay(120, withSpring(0, { damping: 18, stiffness: 120 }));
    }
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

  // Number counter animation for hero balance
  const prevBalance = useRef(totalBalance);
  const displayBalance = useRef(new RNAnimated.Value(totalBalance)).current;
  const [animatedBalance, setAnimatedBalance] = useState(totalBalance);
  React.useEffect(() => {
    if (prevBalance.current !== totalBalance) {
      RNAnimated.timing(displayBalance, {
        toValue: totalBalance,
        duration: 500,
        useNativeDriver: false,
      }).start();
      prevBalance.current = totalBalance;
    }
    const id = displayBalance.addListener(({ value }) => setAnimatedBalance(value));
    return () => displayBalance.removeListener(id);
  }, [totalBalance]);

  const { oweMe, iOwe, totalOwedToMe, totalIOwe } = useMemo(() => {
    const oweMe = balances.filter(b => b.amount > 0);
    const iOwe = balances.filter(b => b.amount < 0);
    const totalOwedToMe = oweMe.reduce((s, b) => s + b.amount, 0);
    const totalIOwe = iOwe.reduce((s, b) => s + Math.abs(b.amount), 0);
    return { oweMe, iOwe, totalOwedToMe, totalIOwe };
  }, [balances]);

  const getActivityIcon = (type) => {
    switch (type) {
      case 'expense_added': return { icon: 'receipt', color: '#4fc3f7' };
      case 'settlement': return { icon: 'checkmark-circle', color: theme.success };
      case 'group_created': return { icon: 'people', color: theme.primary };
      case 'member_joined': return { icon: 'person-add', color: theme.primary };
      default: return { icon: 'ellipse', color: theme.textLight };
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

  // Feature 1: Time-of-day greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const firstName = user?.name ? user.name.split(' ')[0] : '';
    if (hour >= 5 && hour < 12) return `Good morning, ${firstName}`;
    if (hour >= 12 && hour < 17) return `Good afternoon, ${firstName}`;
    if (hour >= 17 && hour < 21) return `Good evening, ${firstName}`;
    return `Hey, ${firstName}`;
  }, [user?.name]);

  // Feature 3: Outstanding debt summary
  const oweMeCount = oweMe.length;
  const iOweCount = iOwe.length;

  // Feature 4: Top pending settlement
  const topPending = useMemo(() => {
    if (balances.length === 0) return null;
    const sorted = [...balances].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    const top = sorted[0];
    if (!top || Math.abs(top.amount) < 0.01) return null;
    return top;
  }, [balances]);

  // Feature 5: Monthly spending insight
  const monthlyInsight = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthlyExpenses = activity.filter(item => {
      if (item.type !== 'expense_added') return false;
      const d = new Date(item.createdAt);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const totalSpent = monthlyExpenses.reduce((sum, item) => sum + (item.amount || 0), 0);
    const groupIds = new Set(monthlyExpenses.map(item => item.groupId).filter(Boolean));
    return { totalSpent, groupCount: groupIds.size, expenseCount: monthlyExpenses.length };
  }, [activity]);

  // Feature 6: Top 3 most active groups
  const topGroups = useMemo(() => {
    if (groups.length === 0) return [];
    const groupActivityMap = {};
    activity.forEach(item => {
      if (item.groupId) {
        if (!groupActivityMap[item.groupId] || new Date(item.createdAt) > new Date(groupActivityMap[item.groupId].createdAt)) {
          groupActivityMap[item.groupId] = item;
        }
      }
    });
    return groups
      .filter(g => !g.archived)
      .map(g => ({ ...g, lastActivity: groupActivityMap[g.id] }))
      .filter(g => g.lastActivity)
      .sort((a, b) => new Date(b.lastActivity.createdAt) - new Date(a.lastActivity.createdAt))
      .slice(0, 3);
  }, [groups, activity]);

  const isSettled = Math.abs(totalBalance) < 0.01;

  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const headerBg = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [theme.headerBgTransparent, theme.headerBg],
    extrapolate: 'clamp',
  });
  const headerBorder = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <BackgroundOrbs />
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      {/* Fixed animated header */}
      <RNAnimated.View style={[styles.appHeader, {
        backgroundColor: headerBg,
        borderBottomColor: headerBorder.interpolate
          ? headerBorder.interpolate({ inputRange: [0, 1], outputRange: ['transparent', theme.border] })
          : theme.border,
      }]}>
        <View style={styles.logoRow}>
          <Image source={require('../../assets/icon.png')} style={styles.logoImg} />
          <View>
            <Text style={styles.greetingText}>{greeting}</Text>
            <Text style={styles.appNameSubtitle}>Evenly</Text>
          </View>
        </View>
        <TouchableOpacity testID="header-avatar" accessibilityLabel="Navigate to Profile" activeOpacity={0.7} onPress={() => navigation.navigate('Profile')} style={styles.avatarBtn}>
          <Avatar name={user?.name} avatar={user?.avatar} size={40} />
        </TouchableOpacity>
      </RNAnimated.View>
      <RNAnimated.ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={RNAnimated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        contentContainerStyle={{ paddingTop: 116 }}
      >

        {/* Skeleton loading state — only show during initial data fetch, not after data has loaded */}
        {user && groups.length === 0 && activity.length === 0 && !refreshing && lastLoadTimestamp?.current === 0 && (
          <View style={{ padding: 16 }}>
            <Skeleton width="100%" height={120} borderRadius={20} style={{ marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <Skeleton width={80} height={80} borderRadius={16} />
              <Skeleton width={80} height={80} borderRadius={16} />
            </View>
            <Skeleton width="100%" height={60} borderRadius={16} style={{ marginBottom: 10 }} />
            <Skeleton width="100%" height={60} borderRadius={16} style={{ marginBottom: 10 }} />
            <Skeleton width="100%" height={50} borderRadius={12} style={{ marginBottom: 8 }} />
            <Skeleton width="100%" height={50} borderRadius={12} style={{ marginBottom: 8 }} />
            <Skeleton width="100%" height={50} borderRadius={12} style={{ marginBottom: 8 }} />
          </View>
        )}

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
                  <Text style={styles.inviteGroupName} numberOfLines={1}>{invite.groupName}</Text>
                  <Text style={styles.inviteSubtext}>{invite.invitedByName} invited you</Text>
                </View>
                <View style={styles.inviteActions}>
                  {respondingInvite === invite.id ? (
                    <ActivityIndicator size="small" color="#00d4aa" />
                  ) : (
                    <>
                      <TouchableOpacity
                        accessibilityLabel={`Accept invite to ${invite.groupName}`}
                        activeOpacity={0.7}
                        style={styles.inviteAcceptBtn}
                        onPress={() => handleInviteResponse(invite, true)}
                      >
                        <Text style={styles.inviteAcceptText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityLabel={`Decline invite to ${invite.groupName}`}
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
          <Text style={styles.heroAmount} numberOfLines={1} adjustsFontSizeToFit={true}>
            {formatAmount(isSettled ? 0 : Math.abs(animatedBalance), currency)}
          </Text>
          <View style={[styles.heroBadge, { backgroundColor: isSettled ? theme.primaryLight : totalBalance > 0 ? theme.primaryLight : 'rgba(255,107,107,0.12)' }]}>
            <View style={[styles.heroDot, { backgroundColor: isSettled ? theme.primary : totalBalance > 0 ? theme.primary : theme.negative }]} />
            <Text style={[styles.heroBadgeText, { color: isSettled ? theme.primary : totalBalance > 0 ? theme.primary : theme.negative }]} numberOfLines={1}>
              {isSettled
              ? (groups.length === 0 && balances.length === 0 ? 'Ready to split' : 'All square! \u{1F91D}')
              : totalBalance > 0 ? 'Friends owe you' : 'You owe friends'}
            </Text>
          </View>
        </Animated.View>

        {/* Feature 2: Quick Action Buttons Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsRow}>
          <PressableScale
            testID="quick-add-expense"
            accessibilityLabel="Add expense"
            style={styles.quickActionBtn}
            onPress={() => navigation.navigate('Groups')}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="add-circle" size={26} color={theme.primary} />
            </View>
            <Text style={styles.quickActionLabel}>Add Expense</Text>
          </PressableScale>
          <PressableScale
            testID="quick-settle-up"
            accessibilityLabel="Settle up"
            style={styles.quickActionBtn}
            onPress={() => navigation.navigate('Friends')}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="checkmark-circle" size={26} color={theme.primary} />
            </View>
            <Text style={styles.quickActionLabel}>Settle Up</Text>
          </PressableScale>
        </ScrollView>

        {/* Feature 3: Outstanding Debts Summary */}
        <Animated.View style={[styles.statsGrid, statsAnimStyle]}>
          {totalOwedToMe < 0.01 && totalIOwe < 0.01 ? (
            <View style={[styles.debtCard, styles.debtCardSettled]}>
              <Text style={styles.debtSettledText}>All square! 🤝</Text>
            </View>
          ) : (
            <>
              {totalOwedToMe > 0 && (
                <TouchableOpacity
                  testID="debt-owed-to-me"
                  accessibilityLabel={`Friends owe you ${formatAmount(totalOwedToMe, currency)}`}
                  activeOpacity={0.7}
                  style={[styles.debtCard, styles.debtCardPositive]}
                  onPress={() => navigation.navigate('Friends')}
                >
                  <View style={[styles.statIcon, { backgroundColor: theme.primaryLight }]}>
                    <Ionicons name="trending-up" size={20} color={theme.primary} />
                  </View>
                  <Text style={styles.debtCardTitle} numberOfLines={2}>{oweMeCount} friend{oweMeCount !== 1 ? 's' : ''} owe{oweMeCount === 1 ? 's' : ''} you {formatAmount(totalOwedToMe, currency)}</Text>
                  <View style={styles.debtActionBtn}>
                    <Text style={styles.debtActionBtnText}>Remind all</Text>
                  </View>
                </TouchableOpacity>
              )}
              {totalIOwe > 0 && (
                <TouchableOpacity
                  testID="debt-i-owe"
                  accessibilityLabel={`You owe friends ${formatAmount(totalIOwe, currency)}`}
                  activeOpacity={0.7}
                  style={[styles.debtCard, styles.debtCardNegative]}
                  onPress={() => navigation.navigate('Friends')}
                >
                  <View style={[styles.statIcon, { backgroundColor: 'rgba(255,107,107,0.1)' }]}>
                    <Ionicons name="trending-down" size={20} color={theme.negative} />
                  </View>
                  <Text style={[styles.debtCardTitle, { color: theme.text }]} numberOfLines={2}>You owe {iOweCount} friend{iOweCount !== 1 ? 's' : ''} {formatAmount(totalIOwe, currency)}</Text>
                  <View style={[styles.debtActionBtn, { backgroundColor: 'rgba(255,107,107,0.15)' }]}>
                    <Text style={[styles.debtActionBtnText, { color: theme.negative }]}>Settle all</Text>
                  </View>
                </TouchableOpacity>
              )}
            </>
          )}
        </Animated.View>

        {/* Feature 4: Top Pending Settlement Card */}
        {topPending && (
          <TouchableOpacity
            testID="top-pending-settlement"
            accessibilityLabel={`Top pending settlement with ${topPending.name}`}
            activeOpacity={0.7}
            style={styles.topPendingCard}
            onPress={() => navigation.navigate('Friends')}
          >
            <View style={styles.topPendingLeft}>
              <Avatar name={topPending.name} avatar={topPending.avatar} size={40} />
              <View style={styles.topPendingInfo}>
                <Text style={styles.topPendingText} numberOfLines={1}>
                  {topPending.amount > 0
                    ? `${topPending.name} owes you`
                    : `You owe ${topPending.name}`}
                </Text>
                <Text style={[styles.topPendingAmount, { color: topPending.amount > 0 ? theme.primary : theme.negative }]}>
                  {formatAmount(Math.abs(topPending.amount), currency)}
                </Text>
              </View>
            </View>
            <View style={[styles.topPendingBtn, { backgroundColor: topPending.amount > 0 ? theme.primaryLight : 'rgba(255,107,107,0.12)' }]}>
              <Text style={[styles.topPendingBtnText, { color: topPending.amount > 0 ? theme.primary : theme.negative }]}>
                {topPending.amount > 0 ? 'Remind' : 'Settle'}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Feature 5: Monthly Spending Insight */}
        {monthlyInsight.expenseCount > 0 && (
          <View style={styles.insightCard}>
            <View style={styles.insightIconBox}>
              <Ionicons name="bar-chart" size={20} color={theme.primary} />
            </View>
            <Text style={styles.insightText}>
              You spent <Text style={styles.insightHighlight}>{formatAmount(monthlyInsight.totalSpent, currency)}</Text> this month{monthlyInsight.groupCount > 0 ? ` across ${monthlyInsight.groupCount} group${monthlyInsight.groupCount !== 1 ? 's' : ''}` : ''}
            </Text>
          </View>
        )}

        {/* Feature 6: Group Quick-Access Row */}
        {topGroups.length > 0 && (
          <View style={styles.groupQuickSection}>
            <Text style={styles.groupQuickTitle}>ACTIVE GROUPS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupQuickRow}>
              {topGroups.map(g => (
                <TouchableOpacity
                  testID={`group-quick-${g.id}`}
                  accessibilityLabel={`Navigate to group ${g.name}`}
                  key={g.id}
                  activeOpacity={0.7}
                  style={styles.groupQuickPill}
                  onPress={() => navigation.navigate('Groups', { screen: 'GroupDetail', params: { groupId: g.id } })}
                >
                  <Text style={styles.groupQuickEmoji}>{g.emoji || '👥'}</Text>
                  <View style={styles.groupQuickInfo}>
                    <Text style={styles.groupQuickName} numberOfLines={1}>{g.name}</Text>
                    {g.lastActivity && g.lastActivity.amount > 0 && (
                      <Text style={styles.groupQuickAmount} numberOfLines={1}>{formatAmount(g.lastActivity.amount, currency)}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Balances Section */}
        {balances.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Balances</Text>
              <TouchableOpacity accessibilityLabel="See all balances" activeOpacity={0.7} onPress={() => navigation.navigate('Friends')}>
                <View style={styles.seeAllRow}>
                  <Text style={styles.seeAll}>See all</Text>
                  <Ionicons name="arrow-forward" size={14} color={theme.primary} />
                </View>
              </TouchableOpacity>
            </View>
            {balances.slice(0, 4).map((b, idx) => (
              <FadeInView key={b.userId} index={idx}>
                <TouchableOpacity
                  accessibilityLabel={`Balance with ${b.name}: ${b.amount > 0 ? 'owes you' : 'you owe'} ${formatAmount(Math.abs(b.amount), currency)}`}
                  activeOpacity={0.7}
                  style={styles.balanceRow}
                  onPress={() => navigation.navigate('Friends')}
                >
                  <Avatar name={b.name} avatar={b.avatar} size={44} />
                  <View style={styles.balanceInfo}>
                    <Text style={styles.balanceName} numberOfLines={1}>{b.name}</Text>
                    <Text style={[styles.balanceSub, { color: b.amount > 0 ? theme.primary : theme.negative }]}>
                      {b.amount > 0 ? 'owes you' : 'you owe'}
                    </Text>
                  </View>
                  <Text style={[styles.balanceValue, { color: b.amount > 0 ? theme.primary : theme.negative }]}>
                    {b.amount > 0 ? '+' : '-'}{formatAmount(Math.abs(b.amount), currency)}
                  </Text>
                </TouchableOpacity>
              </FadeInView>
            ))}
          </View>
        )}

        {/* Cross-Group Simplified Settlements */}
        {globalDebts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Settle Up</Text>
              <Text style={styles.sectionSubtitle}>{globalDebts.length} payment{globalDebts.length > 1 ? 's' : ''} to clear all debts</Text>
            </View>
            {globalDebts.map((d, idx) => {
              const isYouPaying = d.from === user.id;
              const isYouReceiving = d.to === user.id;
              return (
                <FadeInView key={`${d.from}-${d.to}`} index={idx}>
                  <TouchableOpacity
                    accessibilityLabel={`${isYouPaying ? 'You' : d.fromName} pays ${isYouReceiving ? 'you' : d.toName} ${formatAmount(d.amount, currency)}`}
                    activeOpacity={0.7}
                    style={styles.debtRow}
                    onPress={() => navigation.navigate('SettleUp', {
                      preselectedPayer: d.from,
                      preselectedReceiver: d.to,
                      prefilledAmount: d.amount,
                    })}
                  >
                    <Avatar name={isYouPaying ? user.name : d.fromName} size={36} />
                    <View style={styles.debtInfo}>
                      <Text style={styles.debtNames} numberOfLines={1}>
                        {isYouPaying ? 'You' : d.fromName} → {isYouReceiving ? 'You' : d.toName}
                      </Text>
                      <Text style={[styles.debtAmount, { color: isYouPaying ? theme.negative : theme.primary }]}>
                        {formatAmount(d.amount, currency)}
                      </Text>
                    </View>
                    <View style={[styles.debtAction, { backgroundColor: (isYouPaying ? theme.negative : theme.primary) + '18' }]}>
                      <Text style={[styles.debtActionText, { color: isYouPaying ? theme.negative : theme.primary }]}>
                        {isYouPaying ? 'Pay' : 'Collect'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </FadeInView>
              );
            })}
          </View>
        )}

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent transactions</Text>
            <TouchableOpacity accessibilityLabel="See all activity" activeOpacity={0.7} onPress={() => navigation.navigate('Activity')}>
              <View style={styles.seeAllRow}>
                <Text style={styles.seeAll}>See all</Text>
                <Ionicons name="arrow-forward" size={14} color={theme.primary} />
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
                  ? navigation.navigate('Groups', { screen: 'GroupDetail', params: { groupId: item.groupId } })
                  : navigation.navigate('Activity');
                return (
                  <FadeInView key={item.id || idx} index={idx}>
                    <TouchableOpacity accessibilityLabel={`Activity: ${getActivityText(item)}`} activeOpacity={0.7} onPress={handlePress} style={[styles.activityItem, idx < activity.slice(0, 5).length - 1 && styles.activityBorder]}>
                      <View style={[styles.activityIcon, { backgroundColor: color + '18' }]}>
                        <Ionicons name={icon} size={18} color={color} />
                      </View>
                      <View style={styles.activityContent}>
                        <Text style={styles.activityText} numberOfLines={2}>{getActivityText(item)}</Text>
                        <Text style={styles.activityTime}>{formatDate(item.createdAt)}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
                    </TouchableOpacity>
                  </FadeInView>
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
            <PressableScale accessibilityLabel="Create a group" style={styles.emptyStateBtn} onPress={() => navigation.navigate('Groups')}>
              <Text style={styles.emptyStateBtnText}>Create a Group</Text>
            </PressableScale>
          </View>
        )}

        <View style={{ height: 30 }} />
      </RNAnimated.ScrollView>

      {/* Banner ad — native only */}
      {Platform.OS !== 'web' && BannerAd && (
        <View style={{ alignItems: 'center', backgroundColor: theme.background }}>
          <BannerAd
            unitId={AD_UNIT_IDS.banner}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: false }}
          />
        </View>
      )}
    </View>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },

  // App Header
  appHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoImg: {
    width: 44, height: 44,
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
  },
  greetingText: { fontSize: 16, fontWeight: '700', color: theme.text, letterSpacing: -0.5 },
  appNameSubtitle: { fontSize: 11, fontWeight: '600', color: theme.textLight, marginTop: 1 },
  avatarBtn: {},

  // Hero Card
  heroCard: {
    margin: 16, borderRadius: 24, padding: rPadding(28, 20, 16),
    backgroundColor: theme.card,
    borderWidth: 1, borderColor: theme.border,
    borderTopWidth: 2, borderTopColor: theme.primary,
    overflow: 'hidden', position: 'relative',
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 20, elevation: 12,
  },
  heroGlow: {
    position: 'absolute', top: -30, right: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: theme.primary, opacity: 0.15,
  },
  heroLabel: { fontSize: 13, color: theme.textLight, fontWeight: '600', marginBottom: 8 },
  heroAmount: { fontSize: rFontSize(52), fontWeight: '700', color: theme.text, letterSpacing: -0.5, marginBottom: 12, fontVariant: ['tabular-nums'] },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20,
  },
  heroDot: { width: 8, height: 8, borderRadius: 4 },
  heroBadgeText: { fontSize: 13, fontWeight: '700' },

  // Quick Actions (Feature 2)
  quickActionsRow: { paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  quickActionBtn: {
    minWidth: rWidth(80, 64), flex: 1, alignItems: 'center', backgroundColor: theme.white,
    borderRadius: 16, paddingVertical: 14, paddingHorizontal: 6,
    borderWidth: 1, borderColor: theme.border,
  },
  quickActionIcon: { marginBottom: 8 },
  quickActionLabel: { fontSize: 11, fontWeight: '600', color: theme.textLight, textAlign: 'center' },

  // Debt Summary (Feature 3)
  statsGrid: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 12 },
  debtCard: {
    flex: 1, backgroundColor: theme.white, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: theme.border,
  },
  debtCardPositive: { borderLeftWidth: 3, borderLeftColor: theme.primary },
  debtCardNegative: { borderLeftWidth: 3, borderLeftColor: theme.negative },
  debtCardSettled: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24,
    borderLeftWidth: 3, borderLeftColor: theme.primary,
  },
  debtSettledText: { fontSize: 18, fontWeight: '800', color: theme.primary },
  debtCardTitle: { fontSize: 14, fontWeight: '700', color: theme.text, marginBottom: 12 },
  debtActionBtn: {
    alignSelf: 'flex-start', backgroundColor: theme.primaryLight,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7,
  },
  debtActionBtnText: { fontSize: 12, fontWeight: '700', color: theme.primary },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },

  // Top Pending Settlement (Feature 4)
  topPendingCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginBottom: 12, padding: 16,
    backgroundColor: theme.white, borderRadius: 20,
    borderWidth: 1.5, borderColor: 'rgba(0,212,170,0.25)',
  },
  topPendingLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  topPendingInfo: { marginLeft: 12, flex: 1, minWidth: 0 },
  topPendingText: { fontSize: 14, fontWeight: '600', color: theme.textLight },
  topPendingAmount: { fontSize: 20, fontWeight: '800', marginTop: 2, fontVariant: ['tabular-nums'] },
  topPendingBtn: {
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, marginLeft: 'auto',
    flexShrink: 0,
  },
  topPendingBtnText: { fontSize: 13, fontWeight: '700' },

  // Monthly Insight (Feature 5)
  insightCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 12, padding: 14,
    backgroundColor: theme.white, borderRadius: 16,
    borderWidth: 1, borderColor: theme.border,
  },
  insightIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: theme.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  insightText: { fontSize: 13, color: theme.textLight, fontWeight: '500', flex: 1, lineHeight: 18 },
  insightHighlight: { color: theme.text, fontWeight: '700' },

  // Group Quick-Access (Feature 6)
  groupQuickSection: { marginHorizontal: 16, marginBottom: 12 },
  groupQuickTitle: { fontSize: 13, fontWeight: '700', color: theme.textLight, letterSpacing: 1, marginBottom: 8 },
  groupQuickRow: { gap: 10 },
  groupQuickPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.white, borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: theme.border,
    minWidth: rWidth(140, 110),
  },
  groupQuickEmoji: { fontSize: 22, marginRight: 10 },
  groupQuickInfo: {},
  groupQuickName: { fontSize: 13, fontWeight: '700', color: theme.text, flex: 1 },
  groupQuickAmount: { fontSize: 11, fontWeight: '600', color: theme.textLight, marginTop: 2 },

  // Sections
  section: {
    backgroundColor: theme.white, marginHorizontal: 16, marginBottom: 12,
    borderRadius: 24, padding: rPadding(16, 14, 12), borderWidth: 1, borderColor: theme.border,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: theme.textLight, letterSpacing: 1, textTransform: 'uppercase' },
  seeAllRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAll: { fontSize: 13, color: theme.primary, fontWeight: '700' },

  // Balances
  balanceRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderRadius: 16, paddingHorizontal: 4,
  },
  balanceInfo: { flex: 1, marginLeft: 12 },
  balanceName: { fontSize: 15, fontWeight: '600', color: theme.text, flex: 1, minWidth: 0 },
  balanceSub: { fontSize: 12, marginTop: 1, fontWeight: '500' },
  balanceValue: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },

  // Simplified settlements
  sectionSubtitle: { fontSize: 11, color: theme.textMuted, fontWeight: '500' },
  debtRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderRadius: 16, paddingHorizontal: 4,
  },
  debtInfo: { flex: 1, marginLeft: 12 },
  debtNames: { fontSize: 14, fontWeight: '600', color: theme.text },
  debtAmount: { fontSize: 13, fontWeight: '800', marginTop: 2, fontVariant: ['tabular-nums'] },
  debtAction: {
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7,
  },
  debtActionText: { fontSize: 12, fontWeight: '700' },

  // Activity
  activityList: {},
  activityItem: {
    flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10,
    backgroundColor: theme.white, borderRadius: 16,
    paddingHorizontal: 4,
  },
  activityBorder: { borderBottomWidth: 1, borderBottomColor: theme.border },
  activityIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 },
  activityContent: { flex: 1 },
  activityText: { fontSize: 13, color: theme.text, lineHeight: 19 },
  activityTime: { fontSize: 11, color: theme.textMuted, marginTop: 3 },
  emptyActivity: {
    alignItems: 'center', paddingVertical: 28,
    backgroundColor: theme.card, borderRadius: 16,
    borderWidth: 1, borderColor: theme.border,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 14, color: theme.textLight, fontWeight: '600' },

  // Empty State
  emptyState: {
    alignItems: 'center', margin: 16, padding: 28,
    backgroundColor: theme.card, borderRadius: 24, borderWidth: 1, borderColor: theme.border,
  },
  emptyStateEmoji: { fontSize: 48, marginBottom: 12 },
  emptyStateTitle: { fontSize: 20, fontWeight: '800', color: theme.text, marginBottom: 8 },
  emptyStateText: { fontSize: 14, color: theme.textLight, textAlign: 'center', lineHeight: 20 },
  emptyStateBtn: {
    backgroundColor: theme.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, marginTop: 16,
  },
  emptyStateBtnText: { color: theme.background, fontWeight: '800', fontSize: 15 },

  // FAB
  fab: {
    position: 'absolute', right: 20, bottom: 90,
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 10,
  },

  // Invites
  inviteSection: {
    marginHorizontal: 16, marginBottom: 12,
  },
  inviteSectionTitle: {
    fontSize: 13, fontWeight: '700', color: theme.textLight,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
  },
  inviteCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.card, borderRadius: 20, padding: 14,
    borderWidth: 1, borderColor: 'rgba(0,212,170,0.25)',
    marginBottom: 8,
  },
  inviteIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: theme.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  inviteInfo: { flex: 1 },
  inviteGroupName: { fontSize: 15, fontWeight: '700', color: theme.text },
  inviteSubtext: { fontSize: 12, color: theme.textLight, marginTop: 2 },
  inviteActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  inviteAcceptBtn: {
    backgroundColor: theme.primary, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 7, flexShrink: 1,
  },
  inviteAcceptText: { color: theme.background, fontWeight: '700', fontSize: 13 },
  inviteRejectBtn: {
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: theme.border, flexShrink: 1,
  },
  inviteRejectText: { color: theme.textLight, fontWeight: '600', fontSize: 13 },
});

export default HomeScreen;
