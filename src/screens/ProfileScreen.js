import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, TextInput, Modal, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS } from '../constants/colors';
import Avatar from '../components/Avatar';
import { updateUserProfile } from '../services/storage';
import { formatAmount, SUPPORTED_CURRENCIES } from '../services/currency';
import { confirmAlert } from '../utils/alert';

const ProfileScreen = ({ navigation }) => {
  const { user, logout, setUser, balances, groups, friends, activity, currency, refresh } = useApp();
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState(true);

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

  const MenuRow = ({ icon, iconColor = '#00d4aa', title, subtitle, onPress, rightElement, danger, testID }) => {
    const resolvedColor = danger ? '#ff6b6b' : iconColor;
    return (
      <TouchableOpacity activeOpacity={0.7} style={styles.menuRow} onPress={onPress} disabled={!onPress && !rightElement} testID={testID}>
        <View style={[styles.menuIcon, { backgroundColor: resolvedColor + '20' }]}>
          <Ionicons name={icon} size={20} color={resolvedColor} />
        </View>
        <View style={styles.menuContent}>
          <Text style={[styles.menuTitle, danger && { color: '#ff6b6b' }]}>{title}</Text>
          {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
        </View>
        {rightElement || (onPress && <Ionicons name="chevron-forward" size={16} color="#52525b" />)}
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero Card */}
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={styles.profileTop} onPress={() => setShowEdit(true)}>
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
            <Text style={[styles.heroStatValue, { color: '#00d4aa' }]}>{formatAmount(totalExpenses, currency)}</Text>
            <Text style={styles.heroStatLabel}>Total Expenses</Text>
          </View>
          <View style={styles.heroStatItem}>
            <Text style={[styles.heroStatValue, { color: '#ff6b6b' }]}>{groups.length}</Text>
            <Text style={styles.heroStatLabel}>Groups</Text>
          </View>
          <View style={styles.heroStatItem}>
            <Text style={[styles.heroStatValue, { color: '#ffd93d' }]}>{friends.length}</Text>
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
          rightElement={<Switch value={notifications} onValueChange={setNotifications} trackColor={{ true: COLORS.primary }} />}
        />
        <MenuRow
          icon="card-outline"
          iconColor="#a78bfa"
          title="Default Currency"
          subtitle={`${currencyInfo?.flag || ''} ${currency} — ${currencyInfo?.name || ''}`}
          onPress={() => navigation.navigate('Currency')}
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

      {/* Edit Modal */}
      <Modal visible={showEdit} animationType="slide" presentationStyle="formSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity activeOpacity={0.7} onPress={() => setShowEdit(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity activeOpacity={0.7} onPress={handleSave} disabled={saving}>
              <Text style={[styles.saveText, saving && { opacity: 0.5 }]}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.avatarEdit}>
            <Avatar name={editName || user?.name} size={80} />
          </View>

          <Text style={styles.fieldLabel}>Name</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={18} color={COLORS.textLight} style={{ marginRight: 10 }} />
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={COLORS.textMuted}
              autoComplete="name"
            />
          </View>

          <Text style={styles.fieldLabel}>Phone (optional)</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="call-outline" size={18} color={COLORS.textLight} style={{ marginRight: 10 }} />
            <TextInput
              style={styles.input}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="+1 555 0123"
              keyboardType="phone-pad"
              placeholderTextColor={COLORS.textMuted}
              autoComplete="tel"
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingTop: 60, paddingBottom: 24, alignItems: 'center',
    backgroundColor: '#1a1a24',
    borderTopWidth: 3, borderTopColor: '#00d4aa',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 16, marginTop: 12, borderRadius: 24,
    shadowColor: '#00d4aa', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 6,
  },
  backBtn: { position: 'absolute', top: 60, left: 16, padding: 4 },
  avatarCircle: { position: 'relative' },
  profileTop: { position: 'relative', marginBottom: 12 },
  editBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#00d4aa',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#1a1a24',
  },
  userName: { fontSize: 24, fontWeight: '800', color: '#fff' },
  userEmail: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  userPhone: { fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  heroStatsRow: {
    flexDirection: 'row', marginTop: 20, marginHorizontal: 12, gap: 8, width: '100%',
    paddingHorizontal: 12,
  },
  heroStatItem: {
    flex: 1, backgroundColor: '#0a0a0f', borderRadius: 16, padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  heroStatValue: { fontSize: 18, fontWeight: '800', color: '#ffffff' },
  heroStatLabel: { fontSize: 11, color: '#a1a1aa', marginTop: 3 },
  section: {
    backgroundColor: '#1a1a24', marginHorizontal: 16, marginTop: 16,
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '600', color: '#a1a1aa',
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4,
  },
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  menuIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuContent: { flex: 1 },
  menuTitle: { fontSize: 15, fontWeight: '500', color: COLORS.text },
  menuSubtitle: { fontSize: 13, color: '#a1a1aa', marginTop: 2 },
  modal: { flex: 1, backgroundColor: '#0a0a0f', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingTop: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  cancelText: { fontSize: 16, color: '#a1a1aa' },
  saveText: { fontSize: 16, color: '#00d4aa', fontWeight: '700' },
  avatarEdit: { alignItems: 'center', marginBottom: 28 },
  fieldLabel: {
    fontSize: 12, fontWeight: '600', color: '#a1a1aa',
    marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a24',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  input: { flex: 1, fontSize: 16, color: COLORS.text },
});

export default ProfileScreen;
