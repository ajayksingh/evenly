import React, { useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS } from '../constants/colors';
import { formatCurrency, formatDate } from '../utils/splitCalculator';

const ActivityScreen = ({ navigation }) => {
  const { activity, refresh } = useApp();

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const getActivityConfig = (type) => {
    switch (type) {
      case 'expense_added': return { icon: 'receipt', color: '#3498DB', bg: '#EBF5FB' };
      case 'settlement': return { icon: 'checkmark-circle', color: COLORS.success, bg: '#E9F7EF' };
      case 'group_created': return { icon: 'people', color: COLORS.primary, bg: COLORS.primaryLight };
      default: return { icon: 'ellipse', color: COLORS.textLight, bg: COLORS.background };
    }
  };

  const getActivityTitle = (item) => {
    switch (item.type) {
      case 'expense_added': return item.description || 'Expense';
      case 'settlement': return 'Payment';
      case 'group_created': return item.groupName || 'New Group';
      default: return 'Activity';
    }
  };

  const getActivitySubtitle = (item) => {
    switch (item.type) {
      case 'expense_added':
        return `${item.paidByName || 'Someone'} paid ${formatCurrency(item.amount)}${item.groupName ? ` in ${item.groupName}` : ''}`;
      case 'settlement':
        return `${formatCurrency(item.amount)} payment recorded`;
      case 'group_created':
        return `Group created`;
      default:
        return '';
    }
  };

  const renderItem = ({ item }) => {
    const config = getActivityConfig(item.type);
    return (
      <View style={styles.item}>
        <View style={[styles.iconContainer, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon} size={22} color={config.color} />
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>{getActivityTitle(item)}</Text>
          <Text style={styles.subtitle}>{getActivitySubtitle(item)}</Text>
        </View>
        <Text style={styles.time}>{formatDate(item.createdAt)}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
      </View>
      {activity.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="time-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptyText}>Your expense history will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={activity}
          keyExtractor={(item, idx) => item.id || String(idx)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.text },
  item: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    marginHorizontal: 16, marginTop: 10, borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 2,
  },
  iconContainer: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  content: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  time: { fontSize: 12, color: COLORS.textMuted },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginTop: 16 },
  emptyText: { fontSize: 15, color: COLORS.textLight, textAlign: 'center', marginTop: 8 },
});

export default ActivityScreen;
