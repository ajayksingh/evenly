import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency } from '../utils/splitCalculator';

const BalanceSummary = ({ balances }) => {
  const { theme } = useTheme();
  const owed = balances.filter(b => b.amount > 0);
  const owing = balances.filter(b => b.amount < 0);
  const totalOwed = owed.reduce((s, b) => s + b.amount, 0);
  const totalOwing = owing.reduce((s, b) => s + Math.abs(b.amount), 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.white, shadowColor: '#000' }]}>
      <View style={[styles.box, styles.positiveBox]}>
        <Text style={[styles.label, { color: theme.textLight }]}>You are owed</Text>
        <Text style={[styles.amount, { color: theme.positive }]}>{formatCurrency(totalOwed)}</Text>
      </View>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <View style={[styles.box, styles.negativeBox]}>
        <Text style={[styles.label, { color: theme.textLight }]}>You owe</Text>
        <Text style={[styles.amount, { color: theme.negative }]}>{formatCurrency(totalOwing)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  box: { flex: 1, alignItems: 'center' },
  positiveBox: {},
  negativeBox: {},
  divider: { width: 1, marginHorizontal: 8 },
  label: { fontSize: 12, marginBottom: 4 },
  amount: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
});

export default BalanceSummary;
