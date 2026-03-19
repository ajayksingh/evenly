import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';
import { formatCurrency } from '../utils/splitCalculator';

const BalanceSummary = ({ balances }) => {
  const owed = balances.filter(b => b.amount > 0);
  const owing = balances.filter(b => b.amount < 0);
  const totalOwed = owed.reduce((s, b) => s + b.amount, 0);
  const totalOwing = owing.reduce((s, b) => s + Math.abs(b.amount), 0);

  return (
    <View style={styles.container}>
      <View style={[styles.box, styles.positiveBox]}>
        <Text style={styles.label}>You are owed</Text>
        <Text style={[styles.amount, { color: COLORS.positive }]}>{formatCurrency(totalOwed)}</Text>
      </View>
      <View style={styles.divider} />
      <View style={[styles.box, styles.negativeBox]}>
        <Text style={styles.label}>You owe</Text>
        <Text style={[styles.amount, { color: COLORS.negative }]}>{formatCurrency(totalOwing)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  box: { flex: 1, alignItems: 'center' },
  positiveBox: {},
  negativeBox: {},
  divider: { width: 1, backgroundColor: COLORS.border, marginHorizontal: 8 },
  label: { fontSize: 12, color: COLORS.textLight, marginBottom: 4 },
  amount: { fontSize: 20, fontWeight: '700' },
});

export default BalanceSummary;
