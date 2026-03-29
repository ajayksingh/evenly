import React, { useCallback, useMemo, useState, useRef } from 'react';
import {
  View, Text, SectionList, FlatList, StyleSheet, TouchableOpacity,
  StatusBar, ScrollView, Animated, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS, CATEGORIES } from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import BackgroundOrbs from '../components/BackgroundOrbs';
import Avatar from '../components/Avatar';
import { formatCurrency, formatDate } from '../utils/splitCalculator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Skeleton from '../components/Skeleton';

const SEEN_KEY = '@evenly_seen_activity';

const ActivityScreen = ({ navigation }) => {
  const { theme, colorScheme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { user, activity, groups, friends, balances, refresh, currency } = useApp();
  const [filterGroupId, setFilterGroupId] = useState('all');
  const [viewMode, setViewMode] = useState('timeline'); // timeline | person
  const [seenIds, setSeenIds] = useState(new Set());

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerBg = scrollY.interpolate({ inputRange: [0, 80], outputRange: [theme.headerBgTransparent, theme.headerBg], extrapolate: 'clamp' });
  const headerBorder = scrollY.interpolate({ inputRange: [0, 80], outputRange: ['transparent', theme.border], extrapolate: 'clamp' });

  // Load seen activity IDs
  useFocusEffect(useCallback(() => {
    refresh();
    AsyncStorage.getItem(SEEN_KEY).then(val => {
      if (val) setSeenIds(new Set(JSON.parse(val)));
    }).catch(() => {});
  }, [refresh]));

  // Mark all current activities as seen when screen is focused
  useFocusEffect(useCallback(() => {
    return () => {
      // On blur, mark all as seen
      if (activity.length > 0) {
        const allIds = activity.map(a => a.id).filter(Boolean);
        const merged = new Set([...seenIds, ...allIds]);
        setSeenIds(merged);
        AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...merged])).catch(() => {});
      }
    };
  }, [activity, seenIds]));

  const isUnseen = (item) => item.id && !seenIds.has(item.id);

  // ─── Smart Nudges ──────────────────────────────────────────
  const nudges = useMemo(() => {
    if (!user) return [];
    const items = [];

    // Friends who owe you — sorted by amount desc
    const oweYou = balances
      .filter(b => b.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    oweYou.forEach(b => {
      const friend = friends.find(f => f.id === b.userId);
      if (friend) {
        const daysSince = b.lastExpenseDate
          ? Math.floor((Date.now() - new Date(b.lastExpenseDate).getTime()) / 86400000)
          : null;
        items.push({
          id: `nudge-owe-${friend.id}`,
          type: 'remind',
          icon: '💬',
          color: theme.primary,
          text: `${friend.name} owes you ${formatCurrency(b.amount, currency)}`,
          subtext: daysSince ? `${daysSince}d ago` : null,
          action: 'Remind',
          friend,
        });
      }
    });

    // You owe friends
    const youOwe = balances
      .filter(b => b.amount < 0)
      .sort((a, b) => a.amount - b.amount)
      .slice(0, 2);

    youOwe.forEach(b => {
      const friend = friends.find(f => f.id === b.userId);
      if (friend) {
        items.push({
          id: `nudge-settle-${friend.id}`,
          type: 'settle',
          icon: '💸',
          color: theme.negative,
          text: `You owe ${friend.name} ${formatCurrency(Math.abs(b.amount), currency)}`,
          subtext: null,
          action: 'Settle',
          friend,
        });
      }
    });

    return items.slice(0, 4);
  }, [user, balances, friends, currency]);

  // ─── Activity config helpers ───────────────────────────────
  const getActivityConfig = (item) => {
    switch (item.type) {
      case 'expense_added': {
        const cat = CATEGORIES.find(c => c.id === item.category);
        return { emoji: cat?.emoji || '📝', color: cat?.color || '#64748B' };
      }
      case 'settlement': return { emoji: '💰', color: theme.primary };
      case 'group_created': return { emoji: '👥', color: theme.primary };
      case 'member_joined': return { emoji: '🙋', color: theme.primary };
      default: return { emoji: '📝', color: theme.textLight };
    }
  };

  const getTitle = (item) => {
    switch (item.type) {
      case 'expense_added': return item.description || 'Expense';
      case 'settlement': return 'Payment settled';
      case 'group_created': return item.groupName ? `"${item.groupName}" created` : 'New group';
      case 'member_joined': return item.groupName ? `Joined "${item.groupName}"` : 'Joined group';
      default: return 'Activity';
    }
  };

  const getSubtitle = (item) => {
    switch (item.type) {
      case 'expense_added':
        return `${item.paidByName || 'Someone'} paid ${formatCurrency(item.amount)}${item.groupName ? ` · ${item.groupName}` : ''}`;
      case 'settlement':
        return formatCurrency(item.amount);
      case 'member_joined':
        return item.paidByName ? `${item.paidByName} accepted the invite` : '';
      default: return '';
    }
  };

  // ─── Timeline sections (by month with summary) ────────────
  const sections = useMemo(() => {
    const filtered = filterGroupId === 'all'
      ? activity
      : activity.filter(a => a.groupId === filterGroupId);

    const byMonth = {};
    filtered.forEach(item => {
      const d = new Date(item.createdAt);
      const key = isNaN(d) ? 'Unknown' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(item);
    });

    return Object.entries(byMonth).map(([month, data]) => {
      const expenses = data.filter(i => i.type === 'expense_added');
      const settlements = data.filter(i => i.type === 'settlement');
      const totalSpent = expenses.reduce((s, i) => s + (i.amount || 0), 0);
      const totalSettled = settlements.reduce((s, i) => s + (i.amount || 0), 0);
      return { title: month, data, totalSpent, totalSettled, expenseCount: expenses.length, settlementCount: settlements.length };
    });
  }, [activity, filterGroupId]);

  // ─── By Person sections ────────────────────────────────────
  const personSections = useMemo(() => {
    if (viewMode !== 'person') return [];
    const filtered = filterGroupId === 'all'
      ? activity
      : activity.filter(a => a.groupId === filterGroupId);

    const byPerson = {};
    filtered.forEach(item => {
      const personName = item.paidByName || item.groupName || 'Unknown';
      const personKey = item.paidById || personName;
      if (!byPerson[personKey]) byPerson[personKey] = { name: personName, items: [], total: 0 };
      byPerson[personKey].items.push(item);
      if (item.type === 'expense_added') byPerson[personKey].total += (item.amount || 0);
    });

    return Object.values(byPerson)
      .sort((a, b) => b.items.length - a.items.length)
      .map(p => ({ title: p.name, data: p.items, total: p.total }));
  }, [activity, filterGroupId, viewMode]);

  const activeSections = viewMode === 'person' ? personSections : sections;

  // ─── Nudge actions ─────────────────────────────────────────
  const handleNudge = (nudge) => {
    if (nudge.type === 'settle') {
      navigation.navigate('SettleUp', {
        preselectedPayer: user.id,
        preselectedReceiver: nudge.friend.id,
      });
    } else {
      // Navigate to friend or show remind
      navigation.navigate('Friends');
    }
  };

  // ─── Render functions ──────────────────────────────────────
  const renderNudge = ({ item }) => (
    <TouchableOpacity
      testID="nudge-card"
      accessibilityLabel={`${item.action}: ${item.text}`}
      activeOpacity={0.8}
      style={[styles.nudgeCard, { borderLeftColor: item.color }]}
      onPress={() => handleNudge(item)}
    >
      <Text style={styles.nudgeIcon}>{item.icon}</Text>
      <View style={styles.nudgeContent}>
        <Text style={styles.nudgeText} numberOfLines={1}>{item.text}</Text>
        {item.subtext && <Text style={styles.nudgeSub}>{item.subtext}</Text>}
      </View>
      <View style={[styles.nudgeAction, { backgroundColor: item.color + '20' }]}>
        <Text style={[styles.nudgeActionText, { color: item.color }]}>{item.action}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderItem = ({ item, index, section }) => {
    const config = getActivityConfig(item);
    const isLast = index === section.data.length - 1;
    const tappable = !!item.groupId;
    const unseen = isUnseen(item);
    const handlePress = () => {
      if (item.groupId) {
        navigation.navigate('Groups', { screen: 'GroupDetail', params: { groupId: item.groupId } });
      }
    };
    return (
      <TouchableOpacity
        accessibilityLabel={`${getTitle(item)}: ${getSubtitle(item)}`}
        activeOpacity={tappable ? 0.7 : 1}
        onPress={tappable ? handlePress : undefined}
        style={[styles.itemContainer, index === 0 && styles.itemFirst, isLast && styles.itemLast]}
      >
        {/* Unread indicator */}
        {unseen && <View style={styles.unseenDot} />}
        <View style={[styles.iconBox, { backgroundColor: config.color + '18' }]}>
          <Text style={styles.iconEmoji}>{config.emoji}</Text>
        </View>
        <View style={styles.itemContent}>
          <Text style={[styles.itemTitle, unseen && styles.itemTitleUnseen]} numberOfLines={2}>{getTitle(item)}</Text>
          {getSubtitle(item) ? <Text style={styles.itemSub} numberOfLines={1}>{getSubtitle(item)}</Text> : null}
        </View>
        <View style={styles.itemRight}>
          <Text style={styles.itemTime} numberOfLines={1}>{formatDate(item.createdAt)}</Text>
          {tappable && <Ionicons name="chevron-forward" size={14} color={theme.textMuted} style={{ marginTop: 2 }} />}
        </View>
        {!isLast && <View style={styles.divider} />}
      </TouchableOpacity>
    );
  };

  const renderMonthSummary = (section) => (
    <View style={styles.monthSummary}>
      <View style={styles.monthSummaryRow}>
        <View style={styles.monthSummaryStat}>
          <Text style={styles.monthSummaryValue}>{formatCurrency(section.totalSpent, currency)}</Text>
          <Text style={styles.monthSummaryLabel}>spent</Text>
        </View>
        {section.settlementCount > 0 && (
          <View style={styles.monthSummaryStat}>
            <Text style={[styles.monthSummaryValue, { color: theme.primary }]}>{formatCurrency(section.totalSettled, currency)}</Text>
            <Text style={styles.monthSummaryLabel}>settled</Text>
          </View>
        )}
        <View style={styles.monthSummaryStat}>
          <Text style={styles.monthSummaryValue}>{section.expenseCount}</Text>
          <Text style={styles.monthSummaryLabel}>{section.expenseCount === 1 ? 'expense' : 'expenses'}</Text>
        </View>
      </View>
    </View>
  );

  const unseenCount = activity.filter(a => isUnseen(a)).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <BackgroundOrbs />
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <Animated.View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: headerBorder }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Activity</Text>
          {unseenCount > 0 && (
            <View style={styles.unseenBadge}>
              <Text style={styles.unseenBadgeText}>{unseenCount} new</Text>
            </View>
          )}
        </View>
        {/* View Mode Toggle */}
        <View style={styles.viewToggle}>
          <TouchableOpacity
            testID="view-timeline"
            accessibilityLabel="View timeline"
            activeOpacity={0.7}
            style={[styles.viewToggleBtn, viewMode === 'timeline' && styles.viewToggleBtnActive]}
            onPress={() => setViewMode('timeline')}
          >
            <Ionicons name="time-outline" size={14} color={viewMode === 'timeline' ? theme.background : theme.textLight} />
            <Text style={[styles.viewToggleText, viewMode === 'timeline' && styles.viewToggleTextActive]}>Timeline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="view-person"
            accessibilityLabel="View by person"
            activeOpacity={0.7}
            style={[styles.viewToggleBtn, viewMode === 'person' && styles.viewToggleBtnActive]}
            onPress={() => setViewMode('person')}
          >
            <Ionicons name="people-outline" size={14} color={viewMode === 'person' ? theme.background : theme.textLight} />
            <Text style={[styles.viewToggleText, viewMode === 'person' && styles.viewToggleTextActive]}>By Person</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Group filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        <View style={styles.filterIcon}>
          <Ionicons name="filter" size={16} color={theme.primary} />
        </View>
        <TouchableOpacity
          accessibilityLabel="Filter all groups"
          activeOpacity={0.7}
          style={[styles.filterChip, filterGroupId === 'all' && styles.filterChipActive]}
          onPress={() => setFilterGroupId('all')}
        >
          <Text style={[styles.filterChipText, filterGroupId === 'all' && styles.filterChipTextActive]}>All</Text>
        </TouchableOpacity>
        {groups.map(g => (
          <TouchableOpacity
            accessibilityLabel={`Filter by group ${g.name}`}
            activeOpacity={0.7}
            key={g.id}
            style={[styles.filterChip, filterGroupId === g.id && styles.filterChipActive]}
            onPress={() => setFilterGroupId(g.id)}
          >
            <Text style={[styles.filterChipText, filterGroupId === g.id && styles.filterChipTextActive]} numberOfLines={1}>
              {g.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {activeSections.length === 0 && nudges.length === 0 && activity.length === 0 && groups.length > 0 ? (
        /* Skeleton loading state for initial load */
        <View style={{ padding: 20 }}>
          <Skeleton width="100%" height={50} borderRadius={12} style={{ marginBottom: 10 }} />
          <Skeleton width="100%" height={50} borderRadius={12} style={{ marginBottom: 10 }} />
          <Skeleton width="100%" height={50} borderRadius={12} style={{ marginBottom: 10 }} />
          <Skeleton width="100%" height={50} borderRadius={12} style={{ marginBottom: 10 }} />
        </View>
      ) : activeSections.length === 0 && nudges.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📝</Text>
          <Text style={styles.emptyTitle}>No transactions yet</Text>
          <Text style={styles.emptyText}>Add an expense in a group and it'll show up here</Text>
        </View>
      ) : (
        <SectionList
          sections={activeSections}
          keyExtractor={(item, idx) => item.id || String(idx)}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListHeaderComponent={() => (
            <>
              {/* Smart Nudges */}
              {nudges.length > 0 && viewMode === 'timeline' && (
                <View style={styles.nudgesSection}>
                  <Text style={styles.nudgesSectionTitle}>Action needed</Text>
                  <FlatList
                    data={nudges}
                    keyExtractor={item => item.id}
                    renderItem={renderNudge}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
                  />
                </View>
              )}
            </>
          )}
          renderSectionHeader={({ section }) => (
            <View>
              <Text style={styles.monthHeader}>
                {viewMode === 'person' ? section.title : section.title}
              </Text>
              {/* Monthly summary card (timeline mode only) */}
              {viewMode === 'timeline' && section.totalSpent > 0 && renderMonthSummary(section)}
            </View>
          )}
          renderSectionFooter={({ section }) =>
            viewMode === 'person' && section.total > 0 ? (
              <View style={styles.monthFooter}>
                <Text style={styles.monthFooterLeft}>{section.data.length} transaction{section.data.length !== 1 ? 's' : ''}</Text>
                <Text style={styles.monthFooterRight} numberOfLines={1}>Total: {formatCurrency(section.total, currency)}</Text>
              </View>
            ) : null
          }
          renderItem={renderItem}
        />
      )}
    </View>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Platform.OS === 'web' ? 16 : 52, paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: theme.text, letterSpacing: -0.5 },
  unseenBadge: {
    marginLeft: 10, backgroundColor: theme.primary, borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  unseenBadgeText: { fontSize: 12, fontWeight: '700', color: theme.background },

  // View mode toggle
  viewToggle: { flexDirection: 'row', backgroundColor: theme.inputBg, borderRadius: 10, padding: 3 },
  viewToggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 7, borderRadius: 8, gap: 5,
  },
  viewToggleBtnActive: { backgroundColor: theme.primary },
  viewToggleText: { fontSize: 13, fontWeight: '600', color: theme.textLight },
  viewToggleTextActive: { color: theme.background, fontWeight: '700' },

  filterScroll: { borderBottomWidth: 1, borderBottomColor: theme.border, flexShrink: 0, flexGrow: 0, minHeight: 54 },
  filterRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 10, gap: 8, minHeight: 54,
  },
  filterIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: theme.primaryLight, alignItems: 'center', justifyContent: 'center' },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border,
  },
  filterChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  filterChipText: { fontSize: 13, color: theme.textLight, fontWeight: '600' },
  filterChipTextActive: { color: theme.background, fontWeight: '700' },

  // Smart Nudges
  nudgesSection: { marginTop: 16, marginBottom: 8 },
  nudgesSectionTitle: {
    fontSize: 12, fontWeight: '700', color: theme.textLight,
    textTransform: 'uppercase', letterSpacing: 1,
    paddingHorizontal: 20, marginBottom: 10,
  },
  nudgeCard: {
    backgroundColor: theme.card, borderRadius: 16, padding: 14,
    width: '85%', maxWidth: 300, borderLeftWidth: 3,
    borderWidth: 1, borderColor: theme.border,
    flexDirection: 'row', alignItems: 'center',
  },
  nudgeIcon: { fontSize: 20, marginRight: 10 },
  nudgeContent: { flex: 1 },
  nudgeText: { fontSize: 13, fontWeight: '600', color: theme.text },
  nudgeSub: { fontSize: 11, color: theme.textLight, marginTop: 2 },
  nudgeAction: {
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginLeft: 8,
  },
  nudgeActionText: { fontSize: 12, fontWeight: '700' },

  // Monthly summary
  monthSummary: {
    marginHorizontal: 20, marginBottom: 10,
    backgroundColor: theme.inputBg, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: theme.inputBg,
  },
  monthSummaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  monthSummaryStat: { alignItems: 'center' },
  monthSummaryValue: { fontSize: 16, fontWeight: '800', color: theme.text, fontVariant: ['tabular-nums'] },
  monthSummaryLabel: { fontSize: 11, color: theme.textLight, marginTop: 2 },

  monthHeader: {
    fontSize: 12, fontWeight: '700', color: theme.textLight,
    textTransform: 'uppercase', letterSpacing: 1,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
  },
  monthFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 20, marginTop: 8, marginBottom: 4,
    backgroundColor: theme.primaryLight, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(0,212,170,0.2)',
  },
  monthFooterLeft: { fontSize: 12, color: theme.textLight, fontWeight: '600' },
  monthFooterRight: { fontSize: 13, fontWeight: '800', color: theme.primary, fontVariant: ['tabular-nums'] },

  // Activity items
  itemContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.card, marginHorizontal: 20,
    padding: 14, position: 'relative',
    borderWidth: 1, borderColor: theme.border,
  },
  itemFirst: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  itemLast: { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  iconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 },
  iconEmoji: { fontSize: 20 },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: theme.text, lineHeight: 20 },
  itemTitleUnseen: { fontWeight: '800', color: theme.text },
  itemSub: { fontSize: 12, color: theme.textLight, marginTop: 2 },
  itemRight: { alignItems: 'flex-end', marginLeft: 8 },
  itemTime: { fontSize: 11, color: theme.textMuted },
  divider: { position: 'absolute', bottom: 0, left: 74, right: 0, height: 1, backgroundColor: theme.border },

  // Unread dot
  unseenDot: {
    position: 'absolute', left: 6, top: '50%', marginTop: -4,
    width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary,
    zIndex: 1,
  },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40,
    backgroundColor: theme.card, margin: 20, borderRadius: 24,
    borderWidth: 1, borderColor: theme.border,
  },
  emptyEmoji: { fontSize: 52, marginBottom: 14 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: theme.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: theme.textLight, textAlign: 'center', lineHeight: 20 },
});

export default ActivityScreen;
