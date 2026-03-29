import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, TextInput, Modal, Switch, Animated as RNAnimated, Platform,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, withDelay,
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { COLORS } from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import Avatar from '../components/Avatar';
import { updateUserProfile } from '../services/storage';
import { formatAmount, SUPPORTED_CURRENCIES } from '../services/currency';
import { confirmAlert } from '../utils/alert';
import { requestNotificationPermission, scheduleWeeklyReminder, cancelAllNotifications } from '../services/notifications';

const ProfileScreen = ({ navigation }) => {
  const { theme, colorScheme, themeMode, setThemeMode } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { user, logout, setUser, balances, groups, friends, activity, currency, refresh } = useApp();
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState(true);

  // Load persisted notification preference
  useEffect(() => {
    AsyncStorage.getItem('@evenly_notifications_enabled').then(val => {
      if (val !== null) setNotifications(val === 'true');
    }).catch(() => {});
  }, []);

  const handleNotificationToggle = async (enabled) => {
    setNotifications(enabled);
    try {
      await AsyncStorage.setItem('@evenly_notifications_enabled', String(enabled));
      if (enabled) {
        const granted = await requestNotificationPermission();
        if (granted) {
          const totalOwed = balances.filter(b => b.amount > 0).reduce((s, b) => s + b.amount, 0);
          const friendCount = balances.filter(b => b.amount > 0).length;
          await scheduleWeeklyReminder(totalOwed, friendCount);
        }
      } else {
        await cancelAllNotifications();
      }
    } catch (e) {
      console.warn('Notification toggle error:', e);
    }
  };

  const isWeb = Platform.OS === 'web';
  const screenOpacity = useSharedValue(isWeb ? 1 : 0);
  const screenTranslateY = useSharedValue(isWeb ? 0 : 32);
  const screenAnimStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
    transform: [{ translateY: screenTranslateY.value }],
  }));

  useFocusEffect(useCallback(() => {
    if (!isWeb) {
      screenOpacity.value = 0;
      screenTranslateY.value = 32;
      screenOpacity.value = withTiming(1, { duration: 380 });
      screenTranslateY.value = withSpring(0, { damping: 18, stiffness: 120 });
    }
  }, []));

  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const headerBg = scrollY.interpolate({ inputRange: [0, 80], outputRange: [theme.headerBgTransparent, theme.headerBg], extrapolate: 'clamp' });
  const headerBorder = scrollY.interpolate({ inputRange: [0, 80], outputRange: ['transparent', theme.border], extrapolate: 'clamp' });

  const totalOwed = balances.filter(b => b.amount > 0).reduce((s, b) => s + b.amount, 0);
  const totalOwing = balances.filter(b => b.amount < 0).reduce((s, b) => s + Math.abs(b.amount), 0);
  const totalExpenses = activity.filter(a => a.type === 'expense_added').reduce((s, a) => s + (a.amount || 0), 0);
  const currencyInfo = SUPPORTED_CURRENCIES.find(c => c.code === currency);

  const handleSave = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const updated = await updateUserProfile(user.id, { name: editName.trim(), phone: editPhone.trim() });
      setUser(updated);
      setShowEdit(false);
      refresh();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    confirmAlert({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      confirmText: 'Sign Out',
      destructive: true,
      onConfirm: () => { logout(); },
    });
  };

  const MenuRow = ({ icon, iconColor = theme.primary, title, subtitle, onPress, rightElement, danger, testID }) => {
    const resolvedColor = danger ? theme.negative : iconColor;
    return (
      <TouchableOpacity accessibilityLabel={title} activeOpacity={0.7} style={styles.menuRow} onPress={onPress} disabled={!onPress && !rightElement} testID={testID}>
        <View style={[styles.menuIcon, { backgroundColor: resolvedColor + '20' }]}>
          <Ionicons name={icon} size={20} color={resolvedColor} />
        </View>
        <View style={styles.menuContent}>
          <Text style={[styles.menuTitle, danger && { color: theme.negative }]}>{title}</Text>
          {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
        </View>
        {rightElement || (onPress && <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />)}
      </TouchableOpacity>
    );
  };

  return (
    <Animated.View style={[{ flex: 1 }, screenAnimStyle]}>
    <View style={{ flex: 1 }}>
      <RNAnimated.View style={styles.fixedHeader}>
        <TouchableOpacity accessibilityLabel="Go back" activeOpacity={0.7} onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.fixedHeaderTitle, { color: theme.text }]}>Profile</Text>
        <View style={{ width: 32 }} />
      </RNAnimated.View>
      <RNAnimated.ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      onScroll={RNAnimated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
    >
      {/* Hero Card */}
      <View style={styles.header}>
        <TouchableOpacity accessibilityLabel="Edit profile picture" activeOpacity={0.7} style={styles.profileTop} onPress={() => setShowEdit(true)}>
          <View style={styles.avatarCircle}>
            <Avatar name={user?.name} avatar={user?.avatar} size={80} />
          </View>
          <View style={styles.editBadge}><Ionicons name="pencil" size={12} color="#fff" /></View>
        </TouchableOpacity>
        <Text style={styles.userName}>{user?.name}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        {user?.phone ? <Text style={styles.userPhone}>{user.phone}</Text> : null}

        {/* Stats row inside hero card */}
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatItem}>
            <Text style={[styles.heroStatValue, { color: theme.primary }]}>{formatAmount(totalExpenses, currency)}</Text>
            <Text style={styles.heroStatLabel}>Total Expenses</Text>
          </View>
          <View style={styles.heroStatItem}>
            <Text style={[styles.heroStatValue, { color: theme.negative }]}>{groups.length}</Text>
            <Text style={styles.heroStatLabel}>Groups</Text>
          </View>
          <View style={styles.heroStatItem}>
            <Text style={[styles.heroStatValue, { color: theme.warning }]}>{friends.length}</Text>
            <Text style={styles.heroStatLabel}>Friends</Text>
          </View>
        </View>
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <MenuRow icon="person-outline" iconColor="#00d4aa" title="Edit Profile" subtitle="Name, phone number" onPress={() => setShowEdit(true)} />
        <MenuRow icon="lock-closed-outline" iconColor="#00d4aa" title="Change Password" subtitle="Update your password" onPress={() => Alert.alert('Coming Soon', 'Password change coming soon')} />
        <MenuRow icon="mail-outline" iconColor="#00d4aa" title="Email" subtitle={user?.email} />
      </View>

      {/* Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <MenuRow
          icon="notifications-outline"
          iconColor="#a78bfa"
          title="Notifications"
          rightElement={<Switch value={notifications} onValueChange={handleNotificationToggle} trackColor={{ true: theme.primary }} />}
        />
        <MenuRow
          icon="card-outline"
          iconColor="#a78bfa"
          title="Default Currency"
          subtitle={`${currencyInfo?.flag || ''} ${currency} — ${currencyInfo?.name || ''}`}
          onPress={() => navigation.navigate('Currency')}
        />
        <MenuRow
          icon={colorScheme === 'dark' ? 'moon-outline' : 'sunny-outline'}
          iconColor="#f59e0b"
          title="Theme"
          subtitle={themeMode === 'auto' ? 'System default' : themeMode === 'dark' ? 'Dark' : 'Light'}
          onPress={() => {
            // Cycle through themes: auto → light → dark → auto
            const next = themeMode === 'auto' ? 'light' : themeMode === 'light' ? 'dark' : 'auto';
            setThemeMode(next);
          }}
        />
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <MenuRow icon="information-circle-outline" iconColor="#a78bfa" title="Version" subtitle="1.0.0" />
        <MenuRow icon="shield-checkmark-outline" iconColor="#a78bfa" title="Privacy Policy" onPress={() => Alert.alert('Privacy Policy', 'Your data is stored locally on your device. No data is shared with third parties.')} />
        <MenuRow icon="star-outline" iconColor="#ffd93d" title="Rate the App" onPress={() => Alert.alert('Thank you!', 'Rating feature coming soon!')} />
      </View>

      {/* Sign Out */}
      <View style={styles.section}>
        <MenuRow icon="log-out-outline" title="Sign Out" danger onPress={handleLogout} testID="profile-sign-out" />
      </View>

      <View style={{ height: 100 }} />

      </RNAnimated.ScrollView>
    </View>

      {/* Edit Modal */}
      <Modal visible={showEdit} animationType="slide" presentationStyle="formSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity accessibilityLabel="Cancel editing" activeOpacity={0.7} onPress={() => setShowEdit(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity accessibilityLabel="Save profile" activeOpacity={0.7} onPress={handleSave} disabled={saving}>
              <Text style={[styles.saveText, saving && { opacity: 0.5 }]}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.avatarEdit}>
            <Avatar name={editName || user?.name} size={80} />
          </View>

          <Text style={styles.fieldLabel}>Name</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={18} color={theme.textLight} style={{ marginRight: 10 }} />
            <TextInput
              accessibilityLabel="Your name"
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={theme.textMuted}
              autoComplete="name"
            />
          </View>

          <Text style={styles.fieldLabel}>Phone (optional)</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="call-outline" size={18} color={theme.textLight} style={{ marginRight: 10 }} />
            <TextInput
              accessibilityLabel="Phone number"
              style={styles.input}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="+1 555 0123"
              keyboardType="phone-pad"
              placeholderTextColor={theme.textMuted}
              autoComplete="tel"
            />
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1 },
  fixedHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.select({ web: 16, default: 52 }), paddingBottom: 12,
    borderBottomWidth: 1,
    backgroundColor: theme.background,
    borderBottomColor: theme.border,
  },
  fixedHeaderTitle: { fontSize: 17, fontWeight: '700', color: theme.text },
  header: {
    paddingTop: 24, paddingBottom: 24, alignItems: 'center',
    backgroundColor: theme.card,
    borderTopWidth: 3, borderTopColor: theme.primary,
    borderBottomWidth: 1, borderBottomColor: theme.border,
    marginHorizontal: 16, marginTop: 12, borderRadius: 24,
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 6,
  },
  backBtn: { position: 'absolute', top: 60, left: 16, padding: 4 },
  avatarCircle: { position: 'relative' },
  profileTop: { position: 'relative', marginBottom: 12 },
  editBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12, backgroundColor: theme.primary,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.card,
  },
  userName: { fontSize: 24, fontWeight: '700', color: theme.text, letterSpacing: -0.5 },
  userEmail: { fontSize: 14, color: theme.textLight, marginTop: 4 },
  userPhone: { fontSize: 14, color: theme.textMuted, marginTop: 2 },
  heroStatsRow: {
    flexDirection: 'row', marginTop: 20, marginHorizontal: 12, gap: 8, width: '100%',
    paddingHorizontal: 12,
  },
  heroStatItem: {
    flex: 1, backgroundColor: theme.background, borderRadius: 16, padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: theme.inputBg,
  },
  heroStatValue: { fontSize: 18, fontWeight: '700', color: theme.text, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  heroStatLabel: { fontSize: 11, color: theme.textLight, marginTop: 3 },
  section: {
    backgroundColor: theme.card, marginHorizontal: 16, marginTop: 16,
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: theme.border,
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '600', color: theme.textLight,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4,
  },
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderTopWidth: 1, borderTopColor: theme.inputBg,
  },
  menuIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuContent: { flex: 1 },
  menuTitle: { fontSize: 15, fontWeight: '500', color: theme.text },
  menuSubtitle: { fontSize: 13, color: theme.textLight, marginTop: 2 },
  modal: { flex: 1, backgroundColor: theme.background, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingTop: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
  cancelText: { fontSize: 16, color: theme.textLight },
  saveText: { fontSize: 16, color: theme.primary, fontWeight: '700' },
  avatarEdit: { alignItems: 'center', marginBottom: 28 },
  fieldLabel: {
    fontSize: 12, fontWeight: '600', color: theme.textLight,
    marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: theme.border,
  },
  input: { flex: 1, fontSize: 16, color: theme.text },
});

export default ProfileScreen;
