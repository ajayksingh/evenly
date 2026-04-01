import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, Animated as RNAnimated,
  FlatList, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { themedAlert } from '../components/ThemedAlert';
import { confirmAlert } from '../utils/alert';
import { formatAmount } from '../services/currency';
import { getStatementItems, reconcileStatement, addPersonalExpense } from '../services/expenseTracker';
import { isNarrow, rPadding, rFontSize } from '../utils/responsive';

const ReconciliationScreen = ({ route, navigation }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { user, currency, notifyWrite } = useApp();
  const { statementId, bank, cardLast4, statementDate, totalAmount } = route.params;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [matchModalItem, setMatchModalItem] = useState(null);

  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const headerBg = scrollY.interpolate({ inputRange: [0, 80], outputRange: [theme.headerBgTransparent, theme.headerBg], extrapolate: 'clamp' });
  const headerBorder = scrollY.interpolate({ inputRange: [0, 80], outputRange: ['transparent', theme.border], extrapolate: 'clamp' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await reconcileStatement(statementId, user?.id);
      const data = await getStatementItems(statementId);
      setItems(data);
    } catch (e) {
      console.error('ReconciliationScreen loadData error:', e);
    }
    setLoading(false);
  }, [statementId, user?.id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // -- Memoised derived data --------------------------------------------------

  const { matched, unmatched, trackedTotal } = useMemo(() => {
    const m = items.filter((i) => i.status === 'matched');
    const u = items.filter((i) => i.status !== 'matched');
    const tracked = m.reduce((sum, i) => sum + Number(i.amount), 0);
    return { matched: m, unmatched: u, trackedTotal: tracked };
  }, [items]);

  const difference = useMemo(() => Math.abs(totalAmount - trackedTotal), [totalAmount, trackedTotal]);

  const differenceColor = useMemo(() => {
    if (difference < 10) return theme.positive;
    if (difference < 100) return theme.warning;
    return theme.negative;
  }, [difference, theme]);

  const formattedDate = useMemo(() => {
    if (!statementDate) return '';
    const d = new Date(statementDate);
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }, [statementDate]);

  // -- Handlers ---------------------------------------------------------------

  const handleAddMissing = () => {
    if (!unmatched.length) return;
    confirmAlert({
      title: 'Import Unmatched Items',
      message: `Add ${unmatched.length} unmatched statement item${unmatched.length === 1 ? '' : 's'} as personal expenses?`,
      confirmText: 'Import All',
      onConfirm: importAllUnmatched,
    });
  };

  const importAllUnmatched = async () => {
    setImporting(true);
    try {
      for (const item of unmatched) {
        await addPersonalExpense({
          user_id: user?.id,
          amount: item.amount,
          merchant: item.description,
          category: 'general',
          date: item.date,
          source: 'statement_import',
          card_last4: cardLast4 || null,
          matched_statement_id: statementId,
        });
      }
      await notifyWrite('import_statement_items');
      themedAlert('Imported', `${unmatched.length} expense${unmatched.length === 1 ? '' : 's'} added`, 'success');
      loadData();
    } catch (e) {
      themedAlert('Error', 'Failed to import expenses', 'error');
    }
    setImporting(false);
  };

  const handleImportSingle = (item) => {
    confirmAlert({
      title: 'Add as Expense',
      message: `Add "${item.description}" (${formatAmount(item.amount, currency)}) as a personal expense?`,
      confirmText: 'Add',
      onConfirm: async () => {
        try {
          await addPersonalExpense({
            user_id: user?.id,
            amount: item.amount,
            merchant: item.description,
            category: 'general',
            date: item.date,
            source: 'statement_import',
            card_last4: cardLast4 || null,
            matched_statement_id: statementId,
          });
          await notifyWrite('import_statement_item');
          themedAlert('Added', 'Expense added successfully', 'success');
          loadData();
        } catch {
          themedAlert('Error', 'Failed to add expense', 'error');
        }
      },
    });
  };

  // -- Format helpers ---------------------------------------------------------

  const fmtItemDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  // -- Render -----------------------------------------------------------------

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ color: theme.textLight, marginTop: 12, fontSize: 14 }}>Reconciling...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <RNAnimated.View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: headerBorder }]}>
        <TouchableOpacity accessibilityLabel="Go back" activeOpacity={0.7} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Statement Reconciliation</Text>
        <View style={{ width: 24 }} />
      </RNAnimated.View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: unmatched.length > 0 ? 100 : 32 }}
        scrollEventThrottle={16}
        onScroll={RNAnimated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
      >
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.bankBadge}>
              <Ionicons name="card" size={18} color={theme.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.bankName}>{bank} ****{cardLast4}</Text>
              <Text style={styles.statementDate}>{formattedDate}</Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <Text style={[styles.summaryValue, { color: theme.positive }]}>
                {formatAmount(trackedTotal, currency)}
              </Text>
              <Text style={styles.summaryLabel}>Tracked</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCol}>
              <Text style={styles.summaryValue}>
                {formatAmount(totalAmount, currency)}
              </Text>
              <Text style={styles.summaryLabel}>Statement</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCol}>
              <Text style={[styles.summaryValue, { color: differenceColor }]}>
                {formatAmount(difference, currency)}
              </Text>
              <Text style={styles.summaryLabel}>Difference</Text>
            </View>
          </View>
        </View>

        {/* Matched Section */}
        {matched.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Matched ({matched.length})</Text>
            {matched.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={[styles.statusIcon, { backgroundColor: 'rgba(0,212,170,0.12)' }]}>
                  <Ionicons name="checkmark-circle" size={20} color={theme.positive} />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemMerchant} numberOfLines={1}>{item.description}</Text>
                  <Text style={styles.itemDate}>{fmtItemDate(item.date)}</Text>
                </View>
                <Text style={styles.itemAmount}>{formatAmount(item.amount, currency)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Unmatched Section */}
        {unmatched.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Unmatched ({unmatched.length})</Text>
            {unmatched.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.itemRow, styles.unmatchedRow]}
                activeOpacity={0.7}
                onPress={() => handleImportSingle(item)}
              >
                <View style={[styles.statusIcon, { backgroundColor: 'rgba(255,107,107,0.12)' }]}>
                  <Ionicons name="close-circle" size={20} color={theme.negative} />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemMerchant} numberOfLines={1}>{item.description}</Text>
                  <Text style={styles.itemDate}>{fmtItemDate(item.date)}</Text>
                </View>
                <Text style={[styles.itemAmount, { color: theme.negative }]}>
                  {formatAmount(item.amount, currency)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Empty state */}
        {items.length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Ionicons name="document-text-outline" size={48} color={theme.textMuted} />
            <Text style={{ color: theme.textLight, marginTop: 12, fontSize: 15 }}>
              No statement items found
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer: Add Missing Button */}
      {unmatched.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.addMissingBtn}
            activeOpacity={0.8}
            onPress={handleAddMissing}
            disabled={importing}
          >
            {importing ? (
              <ActivityIndicator size="small" color={theme.background} />
            ) : (
              <>
                <Ionicons name="add-circle" size={20} color={theme.background} />
                <Text style={styles.addMissingText}>
                  Add {unmatched.length} Missing Expense{unmatched.length === 1 ? '' : 's'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default ReconciliationScreen;

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: theme.card,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: theme.text, letterSpacing: -0.5 },

  // Summary card
  summaryCard: {
    backgroundColor: theme.card,
    marginHorizontal: 16, marginTop: 16, marginBottom: 10,
    borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: theme.border,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  summaryHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 20,
  },
  bankBadge: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: theme.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  bankName: { fontSize: 16, fontWeight: '700', color: theme.text, letterSpacing: -0.3 },
  statementDate: { fontSize: 13, color: theme.textLight, marginTop: 2 },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.inputBg, borderRadius: 16, padding: 16,
  },
  summaryCol: { flex: 1, alignItems: 'center' },
  summaryValue: {
    fontSize: rFontSize(18), fontWeight: '700', color: theme.text,
    fontVariant: ['tabular-nums'], letterSpacing: -0.3,
  },
  summaryLabel: { fontSize: 11, color: theme.textLight, marginTop: 4, fontWeight: '500' },
  summaryDivider: {
    width: 1, height: 32, backgroundColor: theme.border, marginHorizontal: 4,
  },

  // Section container
  section: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: theme.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: theme.border,
  },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: theme.textLight,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },

  // Item rows
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: 14, marginBottom: 6,
    backgroundColor: theme.inputBg,
  },
  unmatchedRow: {
    borderWidth: 1, borderColor: 'rgba(255,107,107,0.15)',
  },
  statusIcon: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  itemInfo: { flex: 1, minWidth: 0 },
  itemMerchant: { fontSize: 14, fontWeight: '600', color: theme.text },
  itemDate: { fontSize: 12, color: theme.textLight, marginTop: 2 },
  itemAmount: {
    fontSize: 15, fontWeight: '700', color: theme.text,
    fontVariant: ['tabular-nums'], flexShrink: 0, marginLeft: 8,
  },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: theme.card, padding: 20,
    borderTopWidth: 1, borderTopColor: theme.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 10,
  },
  addMissingBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.primary, borderRadius: 16, height: 52, gap: 8,
  },
  addMissingText: { color: theme.background, fontWeight: '700', fontSize: 16 },
});
