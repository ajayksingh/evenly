import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, StatusBar,
  Animated as RNAnimated, Alert, Platform,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence } from 'react-native-reanimated';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
import { useFocusEffect } from '@react-navigation/native';
import { hapticMedium } from '../utils/haptics';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS, GROUP_TYPES } from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import Avatar from '../components/Avatar';
import BackgroundOrbs from '../components/BackgroundOrbs';
import { getExpenses, archiveGroup, pinGroup } from '../services/storage';
import { formatAmount } from '../services/currency';

const GroupsScreen = ({ navigation }) => {
  const { theme, colorScheme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { groups, balances, currency, refresh } = useApp();
  const [groupTotals, setGroupTotals] = useState({});
  const [viewTab, setViewTab] = useState('active'); // active | archived

  // Derive pinned/archived from group objects (Supabase-backed)
  const pinnedIds = useMemo(() => new Set(groups.filter(g => g.pinned).map(g => g.id)), [groups]);
  const archivedIds = useMemo(() => new Set(groups.filter(g => g.archived).map(g => g.id)), [groups]);

  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const headerBg = scrollY.interpolate({ inputRange: [0, 80], outputRange: [theme.headerBgTransparent, theme.headerBg], extrapolate: 'clamp' });
  const headerBorder = scrollY.interpolate({ inputRange: [0, 80], outputRange: ['transparent', theme.border], extrapolate: 'clamp' });

  const fabScale = useSharedValue(1);
  const fabAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  const handleFabPress = () => {
    hapticMedium();
    fabScale.value = withSequence(
      withSpring(0.87, { damping: 8, stiffness: 400 }),
      withSpring(1, { damping: 12, stiffness: 300 })
    );
    navigation.navigate('CreateGroup');
  };

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const togglePin = async (groupId) => {
    const isPinned = pinnedIds.has(groupId);
    try {
      await pinGroup(groupId, !isPinned);
      refresh();
    } catch (e) {
      console.error('Pin error:', e);
    }
  };

  const toggleArchive = async (groupId) => {
    const isArchived = archivedIds.has(groupId);
    try {
      await archiveGroup(groupId, !isArchived);
      refresh();
    } catch (e) {
      console.error('Archive error:', e);
    }
  };

  const hasUnsettledBalances = (groupId) => {
    return balances.some(b => b.groupId === groupId && Math.abs(b.amount) > 0.01);
  };

  const showGroupMenu = (item) => {
    hapticMedium();
    const isPinned = pinnedIds.has(item.id);
    const isArchived = archivedIds.has(item.id);

    const doArchive = () => toggleArchive(item.id);

    const archiveAction = () => {
      if (!isArchived && hasUnsettledBalances(item.id)) {
        Alert.alert(
          'Unsettled Balances',
          'This group has unsettled balances. Archive anyway?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Archive', style: 'destructive', onPress: doArchive },
          ],
        );
      } else {
        doArchive();
      }
    };

    Alert.alert(
      item.name,
      'Choose an action',
      [
        { text: isPinned ? 'Unpin' : 'Pin to Top', onPress: () => togglePin(item.id) },
        { text: isArchived ? 'Unarchive' : 'Archive', onPress: archiveAction },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  // Filter and sort groups
  const filteredGroups = useMemo(() => {
    return groups
      .filter(g => viewTab === 'archived' ? archivedIds.has(g.id) : !archivedIds.has(g.id))
      .sort((a, b) => {
        const aPinned = pinnedIds.has(a.id) ? 0 : 1;
        const bPinned = pinnedIds.has(b.id) ? 0 : 1;
        return aPinned - bPinned;
      });
  }, [groups, viewTab, archivedIds, pinnedIds]);

  // Load total expenses per group
  useEffect(() => {
    if (!groups.length) return;
    const load = async () => {
      const totals = {};
      await Promise.all(groups.map(async (g) => {
        try {
          const expenses = await getExpenses(g.id);
          totals[g.id] = expenses.reduce((s, e) => s + (e.amount || 0), 0);
        } catch { totals[g.id] = 0; }
      }));
      setGroupTotals(totals);
    };
    load();
  }, [groups]);

  const renderGroup = ({ item }) => {
    const typeInfo = GROUP_TYPES.find(t => t.id === item.type) || GROUP_TYPES[3];
    const total = groupTotals[item.id] || 0;
    const isPinned = pinnedIds.has(item.id);
    return (
      <TouchableOpacity
        accessibilityLabel={`Group: ${item.name}, ${item.members.length} members`}
        activeOpacity={0.7}
        style={styles.groupCard}
        onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
        onLongPress={() => showGroupMenu(item)}
        testID={`group-card-${item.id}`}
      >
        <View style={[styles.groupIconBox, { backgroundColor: (typeInfo.color || theme.primary) + '26' }]}>
          <Text style={styles.groupEmoji}>{item.emoji || typeInfo.emoji}</Text>
        </View>
        <View style={styles.groupInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {isPinned && <Text style={{ fontSize: 12 }}>📌</Text>}
            <Text numberOfLines={1} style={styles.groupName}>{item.name}</Text>
          </View>
          <View style={styles.groupMetaRow}>
            <Text numberOfLines={1} style={styles.groupMeta}>{item.members.length} member{item.members.length !== 1 ? 's' : ''}</Text>
            {total > 0 && (
              <>
                <Text style={styles.groupMetaDot}>·</Text>
                <Text numberOfLines={1} style={styles.groupMetaTotal}>{formatAmount(total, currency)} total</Text>
              </>
            )}
          </View>
        </View>
        <View style={styles.groupRight}>
          <TouchableOpacity
            testID="group-menu-btn"
            accessibilityLabel={`Group options for ${item.name}`}
            activeOpacity={0.6}
            style={styles.groupMenuBtn}
            onPress={(e) => { e.stopPropagation && e.stopPropagation(); showGroupMenu(item); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={theme.textMuted} />
          </TouchableOpacity>
          <View style={styles.memberAvatarRow}>
            {item.members.slice(0, 3).map((m, idx) => (
              <View key={m.id} style={[styles.memberAvatarWrap, { marginLeft: idx > 0 ? -10 : 0, zIndex: 3 - idx }]}>
                <Avatar name={m.name} avatar={m.avatar} size={28} />
              </View>
            ))}
            {item.members.length > 3 && (
              <View style={[styles.memberAvatarWrap, styles.memberMore, { marginLeft: -10 }]}>
                <Text style={styles.memberMoreText}>+{item.members.length - 3}</Text>
              </View>
            )}
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.textMuted} style={{ marginTop: 6 }} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <BackgroundOrbs />
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <RNAnimated.View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: headerBorder }]}>
        <Text style={styles.title}>Groups</Text>
        <TouchableOpacity testID="add-group-btn" accessibilityLabel="Create new group" activeOpacity={0.7} style={styles.addBtn} onPress={() => navigation.navigate('CreateGroup')}>
          <Ionicons name="add" size={22} color={theme.primary} />
        </TouchableOpacity>
      </RNAnimated.View>

      {/* Active / Archived toggle */}
      {groups.length > 0 && (
        <View style={styles.viewTabs}>
          <TouchableOpacity
            testID="tab-active-groups"
            accessibilityLabel="Show active groups"
            activeOpacity={0.7}
            style={[styles.viewTab, viewTab === 'active' && styles.viewTabActive]}
            onPress={() => setViewTab('active')}
          >
            <Text style={[styles.viewTabText, viewTab === 'active' && styles.viewTabTextActive]}>Active</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="tab-archived-groups"
            accessibilityLabel="Show archived groups"
            activeOpacity={0.7}
            style={[styles.viewTab, viewTab === 'archived' && styles.viewTabActive]}
            onPress={() => setViewTab('archived')}
          >
            <Text style={[styles.viewTabText, viewTab === 'archived' && styles.viewTabTextActive]}>Archived</Text>
          </TouchableOpacity>
        </View>
      )}

      {groups.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>👥</Text>
          <Text style={styles.emptyTitle}>No groups yet</Text>
          <Text style={styles.emptyText}>Create one to start splitting expenses with friends</Text>
          <TouchableOpacity accessibilityLabel="Create new group" activeOpacity={0.7} style={styles.createBtn} onPress={() => navigation.navigate('CreateGroup')}>
            <Ionicons name="add" size={20} color="#0a0a0f" />
            <Text style={styles.createBtnText}>New Group</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredGroups}
          keyExtractor={item => item.id}
          renderItem={renderGroup}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={RNAnimated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          removeClippedSubviews={Platform.OS !== 'web'}
          maxToRenderPerBatch={10}
          ListEmptyComponent={viewTab === 'archived' ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No archived groups</Text>
              <Text style={styles.emptyText}>Tap the ⋯ menu on a group to archive it</Text>
            </View>
          ) : null}
        />
      )}

      {/* FAB for creating groups */}
      <AnimatedTouchable
        testID="fab-add-group"
        accessibilityLabel="Create new group"
        activeOpacity={0.85}
        style={[styles.fab, fabAnimStyle]}
        onPress={handleFabPress}
      >
        <Ionicons name="add" size={28} color="#0a0a0f" />
      </AnimatedTouchable>
    </View>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1 },
  fab: {
    position: 'absolute', bottom: 100, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: theme.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 20, elevation: 10,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 28, fontWeight: '700', color: theme.text, letterSpacing: -0.5 },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },

  viewTabs: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 8,
    backgroundColor: theme.card, borderRadius: 12, padding: 3,
  },
  viewTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  viewTabActive: { backgroundColor: theme.primaryLight },
  viewTabText: { fontSize: 13, color: theme.textMuted, fontWeight: '600' },
  viewTabTextActive: { color: theme.primary, fontWeight: '700' },

  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },
  groupCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.card, borderRadius: 24,
    padding: 20, marginBottom: 12,
    borderWidth: 1, borderColor: theme.border,
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08, shadowRadius: 20, elevation: 4,
  },
  groupIconBox: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  groupEmoji: { fontSize: 26 },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 4, flex: 1, minWidth: 0 },
  groupMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  groupMeta: { fontSize: 12, color: theme.textLight, flexShrink: 1 },
  groupMetaDot: { fontSize: 12, color: theme.textLight },
  groupMetaTotal: { fontSize: 12, color: theme.primary, fontWeight: '600', fontVariant: ['tabular-nums'], flexShrink: 1 },
  groupRight: { alignItems: 'flex-end' },
  groupMenuBtn: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.border,
    marginBottom: 4,
  },
  memberAvatarRow: { flexDirection: 'row', alignItems: 'center' },
  memberAvatarWrap: { borderWidth: 2, borderColor: theme.card, borderRadius: 16 },
  memberMore: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: theme.border, alignItems: 'center', justifyContent: 'center',
  },
  memberMoreText: { fontSize: 10, color: theme.textLight, fontWeight: '700' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 64, marginBottom: 20 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: theme.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: theme.textLight, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.primary, borderRadius: 16,
    paddingHorizontal: 28, paddingVertical: 14,
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 6,
  },
  createBtnText: { color: theme.background, fontWeight: '800', marginLeft: 8, fontSize: 15 },

});

export default GroupsScreen;
