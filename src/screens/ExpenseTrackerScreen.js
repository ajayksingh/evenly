import React, { useCallback, useState, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, SectionList, StyleSheet, TouchableOpacity,
  RefreshControl, StatusBar, Platform,
  Animated as RNAnimated,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withDelay,
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import BackgroundOrbs from '../components/BackgroundOrbs';
import PressableScale from '../components/PressableScale';
import FadeInView from '../components/FadeInView';
import { getPersonalExpenses, getMonthlyBreakdown } from '../services/expenseTracker';
import { getFlagSync } from '../services/flags';
import { formatAmount } from '../services/currency';
import { rPadding, rFontSize } from '../utils/responsive';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SOURCE_BADGES = {
  sms: '📱',
  email: '📧',
  manual: '✋',
};

const CATEGORY_EMOJIS = {
  food: '🍔', transport: '🚗', shopping: '🛍️', entertainment: '🎬',
  groceries: '🥦', utilities: '📱', health: '💊', travel: '✈️',
  housing: '🏠', insurance: '🛡️', education: '📚', general: '📝',
};

/**
 * Format a date string into a relative or short date label.
 */
const formatRelativeDate = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today - target) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return `${MONTH_NAMES[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
};

/**
 * Format a date string into a section header key (e.g. "Today", "Yesterday", "Mar 28").
 */
const getSectionKey = (dateStr) => formatRelativeDate(dateStr);

/**
 * Format amount in compact form (e.g. 12000 -> "12K").
 */
const compactAmount = (amount, symbol = '₹') => {
  const abs = Math.abs(amount);
  if (abs >= 100000) return `${symbol}${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${symbol}${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}K`;
  return `${symbol}${Math.round(abs)}`;
};

const ExpenseTrackerScreen = ({ navigation }) => {
  const { user, currency } = useApp();
  const { theme, colorScheme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [refreshing, setRefreshing] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [prevMonthTotal, setPrevMonthTotal] = useState(null);
  const [loading, setLoading] = useState(true);

  // Month selector state
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-indexed

  const monthKey = useMemo(
    () => `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`,
    [selectedYear, selectedMonth],
  );

  const prevMonthKey = useMemo(() => {
    const pm = selectedMonth === 0 ? 11 : selectedMonth - 1;
    const py = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
    return `${py}-${String(pm + 1).padStart(2, '0')}`;
  }, [selectedYear, selectedMonth]);

  const monthLabel = `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;

  // Scroll-fade header
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

  // Card entrance animation
  const isWeb = Platform.OS === 'web';
  const cardOpacity = useSharedValue(isWeb ? 1 : 0);
  const cardTranslateY = useSharedValue(isWeb ? 0 : 32);
  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [expData, breakdownData, prevExpenses] = await Promise.all([
        getPersonalExpenses(user.id, { month: monthKey }),
        getMonthlyBreakdown(user.id, monthKey),
        getPersonalExpenses(user.id, { month: prevMonthKey }),
      ]);
      setExpenses(expData);
      setBreakdown(breakdownData);
      const prevTotal = prevExpenses.reduce(
        (sum, e) => sum + (e.is_credit ? 0 : Number(e.amount)),
        0,
      );
      setPrevMonthTotal(prevTotal);
    } catch (e) {
      console.error('ExpenseTracker loadData error:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, monthKey, prevMonthKey]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
      if (!isWeb) {
        cardOpacity.value = 0;
        cardTranslateY.value = 32;
        cardOpacity.value = withTiming(1, { duration: 380 });
        cardTranslateY.value = withSpring(0, { damping: 18, stiffness: 120 });
      }
    }, [loadData]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setTimeout(() => setRefreshing(false), 800);
  };

  // Month navigation
  const goToPrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };
  const goToNextMonth = () => {
    // Don't allow going past current month
    if (selectedYear === now.getFullYear() && selectedMonth === now.getMonth()) return;
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

  // Memoized totals
  const totalSpent = useMemo(
    () => expenses.reduce((sum, e) => sum + (e.is_credit ? 0 : Number(e.amount)), 0),
    [expenses],
  );

  const percentChange = useMemo(() => {
    if (prevMonthTotal === null || prevMonthTotal === 0) return null;
    return Math.round(((totalSpent - prevMonthTotal) / prevMonthTotal) * 100);
  }, [totalSpent, prevMonthTotal]);

  // Memoized sections (grouped by date)
  const sections = useMemo(() => {
    const groups = {};
    for (const exp of expenses) {
      const key = getSectionKey(exp.date);
      if (!groups[key]) groups[key] = { title: key, data: [] };
      groups[key].data.push(exp);
    }
    return Object.values(groups);
  }, [expenses]);

  // Feature flag check
  const smsEnabled = getFlagSync('sms_expense_tracking');
  const emailEnabled = getFlagSync('email_expense_tracking');

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  const renderExpenseItem = ({ item, index }) => {
    const isCredit = item.is_credit;
    const categoryEmoji = CATEGORY_EMOJIS[item.category] || CATEGORY_EMOJIS.general;
    const sourceBadge = SOURCE_BADGES[item.source] || '📝';

    return (
      <FadeInView index={index} delay={40}>
        <PressableScale style={styles.expenseRow}>
          {/* Source badge */}
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceBadgeText}>{sourceBadge}</Text>
          </View>

          {/* Info */}
          <View style={styles.expenseInfo}>
            <Text style={styles.merchantName} numberOfLines={1}>
              {item.merchant || 'Unknown'}
            </Text>
            <View style={styles.categoryChipRow}>
              <View style={styles.categoryChip}>
                <Text style={styles.categoryChipText}>
                  {categoryEmoji} {item.category || 'general'}
                </Text>
              </View>
              {item.card_last4 ? (
                <Text style={styles.cardHint}>•••• {item.card_last4}</Text>
              ) : null}
            </View>
          </View>

          {/* Amount + date */}
          <View style={styles.expenseRight}>
            <Text
              style={[
                styles.expenseAmount,
                { color: isCredit ? theme.positive : theme.negative },
              ]}
            >
              {isCredit ? '+' : '-'}{formatAmount(Number(item.amount), currency)}
            </Text>
            <Text style={styles.expenseDate}>{formatRelativeDate(item.date)}</Text>
          </View>
        </PressableScale>
      </FadeInView>
    );
  };

  const renderCategoryChips = () => (
    <RNAnimated.ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipScrollContent}
      style={styles.chipScroll}
    >
      {breakdown.map((cat, i) => (
        <FadeInView key={cat.category} index={i} delay={50}>
          <TouchableOpacity activeOpacity={0.7} style={styles.categoryCard}>
            <Text style={styles.categoryCardEmoji}>
              {CATEGORY_EMOJIS[cat.category] || '📝'}
            </Text>
            <Text style={styles.categoryCardLabel} numberOfLines={1}>
              {cat.category}
            </Text>
            <Text style={styles.categoryCardAmount}>
              {compactAmount(cat.total)}
            </Text>
            <Text style={styles.categoryCardCount}>
              {cat.count} txn{cat.count !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        </FadeInView>
      ))}
    </RNAnimated.ScrollView>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateEmoji}>📊</Text>
      <Text style={styles.emptyStateTitle}>No expenses yet</Text>
      <Text style={styles.emptyStateText}>
        {smsEnabled || emailEnabled
          ? 'Your auto-tracked expenses will appear here'
          : 'Connect SMS to auto-track your spending'}
      </Text>
      {!smsEnabled && !emailEnabled && (
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.emptyStateBtn}
          onPress={() => navigation.navigate('ConnectedAccounts')}
        >
          <Text style={styles.emptyStateBtnText}>Connect SMS</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.emptyStateBtn, { backgroundColor: theme.primaryLight, marginTop: 10 }]}
        onPress={() => navigation.navigate('AddExpense', { personal: true })}
      >
        <Text style={[styles.emptyStateBtnText, { color: theme.primary }]}>Add manually</Text>
      </TouchableOpacity>
    </View>
  );

  const renderListHeader = () => (
    <>
      {/* Total card */}
      <Animated.View style={[styles.totalCard, cardAnimStyle]}>
        <View style={styles.totalCardGlow} />
        <Text style={styles.totalCardLabel}>Total spent</Text>
        <Text style={styles.totalCardAmount}>
          {formatAmount(totalSpent, currency)}
        </Text>
        {percentChange !== null && (
          <View
            style={[
              styles.changeBadge,
              {
                backgroundColor: percentChange > 0
                  ? 'rgba(255,107,107,0.12)'
                  : 'rgba(0,212,170,0.12)',
              },
            ]}
          >
            <Ionicons
              name={percentChange > 0 ? 'trending-up' : 'trending-down'}
              size={14}
              color={percentChange > 0 ? theme.negative : theme.positive}
            />
            <Text
              style={[
                styles.changeBadgeText,
                { color: percentChange > 0 ? theme.negative : theme.positive },
              ]}
            >
              {Math.abs(percentChange)}% vs last month
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Category chips */}
      {breakdown.length > 0 && (
        <View style={styles.categorySection}>
          <Text style={styles.categorySectionTitle}>CATEGORIES</Text>
          {renderCategoryChips()}
        </View>
      )}

      {/* Transactions header */}
      {sections.length > 0 && (
        <View style={styles.txnHeaderRow}>
          <Text style={styles.categorySectionTitle}>TRANSACTIONS</Text>
          <Text style={styles.txnCount}>{expenses.length} total</Text>
        </View>
      )}
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <BackgroundOrbs />
      <StatusBar
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      {/* Fixed animated header */}
      <RNAnimated.View
        style={[
          styles.appHeader,
          {
            backgroundColor: headerBg,
            borderBottomColor: headerBorder.interpolate
              ? headerBorder.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['transparent', theme.border],
                })
              : theme.border,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Expenses</Text>
        </View>

        {/* Month selector */}
        <View style={styles.monthSelector}>
          <TouchableOpacity activeOpacity={0.7} onPress={goToPrevMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={20} color={theme.primary} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={goToNextMonth}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            disabled={isCurrentMonth}
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={isCurrentMonth ? theme.textMuted : theme.primary}
            />
          </TouchableOpacity>
        </View>
      </RNAnimated.View>

      {/* Main content */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderExpenseItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={!loading ? renderEmpty : null}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={RNAnimated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        contentContainerStyle={{ paddingTop: 116, paddingBottom: 100 }}
        stickySectionHeadersEnabled={false}
      />

      {/* FAB — manual expense entry */}
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.fab}
        onPress={() => navigation.navigate('AddExpense', { personal: true })}
      >
        <Ionicons name="add" size={28} color={theme.background} />
      </TouchableOpacity>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },

  // Header
  appHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: theme.text, letterSpacing: -0.5 },

  // Month selector
  monthSelector: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthLabel: { fontSize: 13, fontWeight: '700', color: theme.text, minWidth: 100, textAlign: 'center' },

  // Total card
  totalCard: {
    margin: 16, borderRadius: 24, padding: rPadding(28, 20, 16),
    backgroundColor: theme.card,
    borderWidth: 1, borderColor: theme.border,
    borderTopWidth: 2, borderTopColor: theme.primary,
    overflow: 'hidden', position: 'relative',
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 20, elevation: 12,
  },
  totalCardGlow: {
    position: 'absolute', top: -30, right: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: theme.primary, opacity: 0.15,
  },
  totalCardLabel: { fontSize: 13, color: theme.textLight, fontWeight: '600', marginBottom: 8 },
  totalCardAmount: {
    fontSize: rFontSize(42), fontWeight: '700', color: theme.text,
    letterSpacing: -0.5, marginBottom: 12, fontVariant: ['tabular-nums'],
  },
  changeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20,
  },
  changeBadgeText: { fontSize: 12, fontWeight: '700' },

  // Category section
  categorySection: { marginBottom: 8 },
  categorySectionTitle: {
    fontSize: 13, fontWeight: '700', color: theme.textLight,
    letterSpacing: 1, textTransform: 'uppercase',
    marginHorizontal: 16, marginBottom: 10,
  },
  chipScroll: { marginBottom: 4 },
  chipScrollContent: { paddingHorizontal: 16, gap: 10 },
  categoryCard: {
    backgroundColor: theme.card, borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: theme.border,
    alignItems: 'center', minWidth: 90,
  },
  categoryCardEmoji: { fontSize: 22, marginBottom: 4 },
  categoryCardLabel: {
    fontSize: 11, fontWeight: '600', color: theme.textLight,
    textTransform: 'capitalize', marginBottom: 2,
  },
  categoryCardAmount: { fontSize: 15, fontWeight: '800', color: theme.text, fontVariant: ['tabular-nums'] },
  categoryCardCount: { fontSize: 10, fontWeight: '500', color: theme.textMuted, marginTop: 2 },

  // Transactions header
  txnHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 4, marginTop: 8,
  },
  txnCount: { fontSize: 12, fontWeight: '600', color: theme.textMuted },

  // Section header
  sectionHeader: {
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: theme.textLight,
    letterSpacing: 1, textTransform: 'uppercase',
  },

  // Expense row
  expenseRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8, padding: 14,
    backgroundColor: theme.card, borderRadius: 20,
    borderWidth: 1, borderColor: theme.border,
  },
  sourceBadge: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: theme.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  sourceBadgeText: { fontSize: 18 },
  expenseInfo: { flex: 1, minWidth: 0 },
  merchantName: { fontSize: 15, fontWeight: '600', color: theme.text, marginBottom: 4 },
  categoryChipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryChip: {
    backgroundColor: theme.primaryLight, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  categoryChipText: { fontSize: 11, fontWeight: '600', color: theme.primary, textTransform: 'capitalize' },
  cardHint: { fontSize: 11, fontWeight: '500', color: theme.textMuted },
  expenseRight: { alignItems: 'flex-end', marginLeft: 8 },
  expenseAmount: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  expenseDate: { fontSize: 11, fontWeight: '500', color: theme.textMuted, marginTop: 3 },

  // Empty state
  emptyState: {
    alignItems: 'center', margin: 16, padding: 28,
    backgroundColor: theme.card, borderRadius: 24,
    borderWidth: 1, borderColor: theme.border,
  },
  emptyStateEmoji: { fontSize: 48, marginBottom: 12 },
  emptyStateTitle: { fontSize: 20, fontWeight: '800', color: theme.text, marginBottom: 8 },
  emptyStateText: { fontSize: 14, color: theme.textLight, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  emptyStateBtn: {
    backgroundColor: theme.primary, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 12,
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
});

export default ExpenseTrackerScreen;
