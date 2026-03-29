import React, { useState, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Platform, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS, GROUP_TYPES } from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import Avatar from '../components/Avatar';
import { createGroup, searchUsers, getSuggestedFriendsFromGroups } from '../services/storage';
import { getContacts, requestContactsPermission } from '../services/contacts';
import { hapticMedium, hapticSuccess, hapticError } from '../utils/haptics';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import ShakeView from '../components/ShakeView';

// Feature 17: Preset emojis
const PRESET_EMOJIS = ['🏠', '🌴', '💑', '🍕', '🎉', '💼', '✈️', '🎓', '🏖️', '🎬'];

// Feature 19: Templates
const GROUP_TEMPLATES = [
  { name: 'Weekend Trip', type: 'trip', emoji: '🌴' },
  { name: 'Apartment', type: 'home', emoji: '🏠' },
  { name: 'Office Lunch', type: 'other', emoji: '🍕' },
  { name: 'Event', type: 'other', emoji: '🎉' },
];

// Feature 20: Currencies
const CURRENCY_OPTIONS = [
  { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' },
];

const CreateGroupScreen = ({ navigation }) => {
  const { theme, colorScheme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { user, friends, currency, refresh } = useApp();

  const isWeb = Platform.OS === 'web';
  const animatedOnce = useRef(false);
  const screenOpacity = useSharedValue(isWeb ? 1 : 0);
  const screenTranslateY = useSharedValue(isWeb ? 0 : 32);
  const screenAnimStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
    transform: [{ translateY: screenTranslateY.value }],
  }));
  useFocusEffect(useCallback(() => {
    if (!isWeb && !animatedOnce.current) {
      animatedOnce.current = true;
      screenOpacity.value = withTiming(1, { duration: 380 });
      screenTranslateY.value = withSpring(0, { damping: 18, stiffness: 120 });
    }
  }, []));

  const groupNameRef = useRef('');
  const groupNameShakeRef = useRef(null);
  const [groupNameDisplay, setGroupNameDisplay] = useState('');
  const [groupType, setGroupType] = useState('other');
  const [endDate, setEndDate] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [creating, setCreating] = useState(false);
  // Feature 17: Group emoji
  const [groupEmoji, setGroupEmoji] = useState('');
  // Feature 18: Search members
  const [memberSearch, setMemberSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  // Feature 20: Currency
  const [groupCurrency, setGroupCurrency] = useState(currency || 'INR');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  // Contacts & suggestions for member selection
  const [showContacts, setShowContacts] = useState(false);
  const [deviceContacts, setDeviceContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [suggestedMembers, setSuggestedMembers] = useState([]);

  const GROUP_TYPE_HINTS = {
    trip: null, // trip shows end date field instead
    home: 'Great for recurring shared expenses',
    couple: 'Defaults to 50/50 split',
    other: null,
  };

  // Feature 18: Search for users to add as members
  const handleMemberSearch = async (query) => {
    setMemberSearch(query);
    if (query.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const results = await searchUsers(query.trim(), user.id);
      setSearchResults(results.filter(r => !selectedMembers.find(m => m.id === r.id) && !friends.find(f => f.id === r.id)));
    } catch { setSearchResults([]); }
    setSearching(false);
  };

  // Feature 19: Apply template
  const applyTemplate = (template) => {
    groupNameRef.current = template.name;
    setGroupNameDisplay(template.name);
    setGroupType(template.type);
    setGroupEmoji(template.emoji);
    hapticMedium();
  };

  const handleCreate = async () => {
    const groupName = groupNameRef.current;
    if (!groupName.trim()) { groupNameShakeRef.current?.shake(); hapticError(); Alert.alert('Error', 'Enter group name'); return; }
    hapticMedium();
    setCreating(true);
    try {
      const members = [
        { id: user.id, name: user.name, email: user.email, avatar: user.avatar },
        ...selectedMembers,
      ];
      await createGroup({ name: groupName.trim(), type: groupType, endDate: endDate.trim() || null, members, createdBy: user.id, emoji: groupEmoji || null, currency: groupCurrency });
      hapticSuccess();
      await refresh();
      navigation.goBack();
    } catch (e) {
      hapticError();
      Alert.alert('Error', e.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: 'New Group',
      headerStyle: { backgroundColor: theme.tabBar },
      headerTitleStyle: { color: theme.text, fontSize: 18, fontWeight: '700' },
      headerLeft: () => (
        <TouchableOpacity accessibilityLabel="Cancel group creation" activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity accessibilityLabel="Create group" activeOpacity={0.7} onPress={handleCreate} disabled={creating} style={styles.headerBtn}>
          <Text style={[styles.createText, creating && { opacity: 0.5 }]}>Create</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, groupType, selectedMembers, creating]);

  // Load device contacts for member selection
  const loadDeviceContacts = async () => {
    setContactsLoading(true);
    try {
      const granted = await requestContactsPermission();
      if (granted) {
        const contacts = await getContacts();
        setDeviceContacts(contacts);
        setShowContacts(true);
      } else {
        Alert.alert('Permission Required', 'Allow contacts access to import members');
      }
    } catch (e) {
      console.error('loadDeviceContacts error:', e);
    }
    setContactsLoading(false);
  };

  // Load suggested members from other groups
  useFocusEffect(useCallback(() => {
    if (!user) return;
    getSuggestedFriendsFromGroups(user.id).then(setSuggestedMembers).catch(() => {});
  }, [user]));

  const toggleMember = (friend) => {
    setSelectedMembers(prev =>
      prev.find(m => m.id === friend.id)
        ? prev.filter(m => m.id !== friend.id)
        : [...prev, { id: friend.id, name: friend.name, email: friend.email, avatar: friend.avatar }]
    );
  };

  return (
    <Animated.View style={[{ flex: 1 }, screenAnimStyle]}>
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
        {/* Feature 19: Templates */}
        <Text style={styles.fieldLabel}>Quick Start</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {GROUP_TEMPLATES.map((t, idx) => (
            <TouchableOpacity testID={`template-${idx}`} accessibilityLabel={`Template: ${t.name}`} key={idx} activeOpacity={0.7} style={styles.templateBtn} onPress={() => applyTemplate(t)}>
              <Text style={{ fontSize: 18 }}>{t.emoji}</Text>
              <Text style={styles.templateLabel}>{t.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Feature 17: Emoji Picker */}
        <Text style={styles.fieldLabel}>Group Icon</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {PRESET_EMOJIS.map((em, idx) => (
            <TouchableOpacity
              testID={`emoji-${idx}`}
              accessibilityLabel={`Select emoji ${em}`}
              key={idx}
              activeOpacity={0.7}
              style={[styles.emojiBtn, groupEmoji === em && styles.emojiBtnActive]}
              onPress={() => setGroupEmoji(groupEmoji === em ? '' : em)}
            >
              <Text style={{ fontSize: 24 }}>{em}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.fieldLabel}>Group Name</Text>
        <ShakeView ref={groupNameShakeRef}>
        <TextInput
          testID="group-name-input"
          accessibilityLabel="Group name"
          style={styles.textInput}
          placeholder="e.g., Goa Trip, Apartment..."
          placeholderTextColor={theme.textMuted}
          value={groupNameDisplay}
          onChangeText={v => { groupNameRef.current = v; setGroupNameDisplay(v); }}
          autoCorrect={false}
          autoCapitalize="none"
          keyboardType="default"
        />
        </ShakeView>

        <Text style={styles.fieldLabel}>Type</Text>
        <View style={styles.typeRow}>
          {GROUP_TYPES.map(t => (
            <TouchableOpacity
              accessibilityLabel={`Group type: ${t.label}`}
              activeOpacity={0.7}
              key={t.id}
              testID={`group-type-${t.id}`}
              style={[styles.typeBtn, groupType === t.id && styles.typeBtnActive]}
              onPress={() => setGroupType(t.id)}
            >
              <Text style={styles.typeEmoji}>{t.emoji}</Text>
              <Text style={[styles.typeLabel, groupType === t.id && styles.typeLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Group type hint */}
        {GROUP_TYPE_HINTS[groupType] && (
          <Text style={styles.typeHint}>{GROUP_TYPE_HINTS[groupType]}</Text>
        )}

        {/* Trip end date */}
        {groupType === 'trip' && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.fieldLabel}>End Date (optional)</Text>
            <TextInput
              testID="trip-end-date-input"
              accessibilityLabel="Trip end date"
              style={styles.textInput}
              placeholder='e.g., "March 30"'
              placeholderTextColor={theme.textMuted}
              value={endDate}
              onChangeText={setEndDate}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
        )}

        {/* Feature 20: Currency picker */}
        <Text style={styles.fieldLabel}>Currency</Text>
        <TouchableOpacity testID="currency-picker-btn" accessibilityLabel={`Select currency, current: ${groupCurrency}`} activeOpacity={0.7} style={styles.currencyPickerBtn} onPress={() => setShowCurrencyPicker(true)}>
          <Text style={styles.currencyPickerText}>
            {CURRENCY_OPTIONS.find(c => c.code === groupCurrency)?.symbol || ''} {groupCurrency}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textLight} />
        </TouchableOpacity>

        {/* Selected member chips (Feature 18) */}
        {selectedMembers.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {selectedMembers.map(m => (
              <View key={m.id} style={styles.memberChip}>
                <Text style={styles.memberChipText} numberOfLines={1}>{m.name}</Text>
                <TouchableOpacity testID={`remove-chip-${m.id}`} onPress={() => toggleMember(m)}>
                  <Ionicons name="close-circle" size={16} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.fieldLabel}>Add Members ({selectedMembers.length} selected)</Text>

        {/* Feature 18: Search for users */}
        <TextInput
          testID="member-search-input"
          accessibilityLabel="Search members by name or email"
          style={[styles.textInput, { marginBottom: 10 }]}
          placeholder="Search by name or email..."
          placeholderTextColor={theme.textMuted}
          value={memberSearch}
          onChangeText={handleMemberSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchResults.length > 0 && (
          <View style={{ marginBottom: 10 }}>
            {searchResults.slice(0, 5).map(r => (
              <TouchableOpacity testID={`search-result-${r.id}`} key={r.id} activeOpacity={0.7} style={styles.friendRow} onPress={() => { toggleMember(r); setMemberSearch(''); setSearchResults([]); }}>
                <Avatar name={r.name} size={38} />
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName} numberOfLines={1}>{r.name}</Text>
                  <Text style={styles.friendEmail} numberOfLines={1}>{r.email}</Text>
                </View>
                <Ionicons name="add-circle" size={24} color={theme.primary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {friends.length === 0 && searchResults.length === 0 ? (
          <View style={styles.noFriendsBox}>
            <Text style={styles.noFriendsText}>No friends yet — add friends from the Friends tab, or search above.</Text>
          </View>
        ) : (
          friends.map(f => (
            <TouchableOpacity activeOpacity={0.7} key={f.id} style={styles.friendRow} onPress={() => toggleMember(f)}>
              <Avatar name={f.name} size={38} />
              <View style={styles.friendInfo}>
                <Text style={styles.friendName} numberOfLines={1}>{f.name}</Text>
                <Text style={styles.friendEmail} numberOfLines={1}>{f.email}</Text>
              </View>
              <View style={[styles.checkbox, selectedMembers.find(m => m.id === f.id) && styles.checkboxChecked]}>
                {selectedMembers.find(m => m.id === f.id) && <Ionicons name="checkmark" size={14} color={theme.background} />}
              </View>
            </TouchableOpacity>
          ))
        )}
        {/* From Contacts button */}
        {Platform.OS !== 'web' && !showContacts && (
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.importContactsBtn}
            onPress={loadDeviceContacts}
            disabled={contactsLoading}
          >
            <Ionicons name="people-outline" size={18} color={theme.primary} />
            <Text style={styles.importContactsBtnText}>
              {contactsLoading ? 'Loading...' : 'From Contacts'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Device contacts list */}
        {showContacts && deviceContacts.length > 0 && (
          <>
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Device Contacts</Text>
            {deviceContacts.slice(0, 20).map(c => {
              const isSelected = selectedMembers.find(m => m.email === c.email);
              return (
                <TouchableOpacity
                  key={c.id}
                  activeOpacity={0.7}
                  style={styles.friendRow}
                  onPress={() => c.email && toggleMember({ id: c.id, name: c.name, email: c.email, avatar: c.avatar })}
                  disabled={!c.email}
                >
                  <Avatar name={c.name} size={38} />
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName} numberOfLines={1}>{c.name}</Text>
                    <Text style={styles.friendEmail} numberOfLines={1}>{c.email || c.phone || 'No email'}</Text>
                  </View>
                  {c.email ? (
                    <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color={theme.background} />}
                    </View>
                  ) : (
                    <Text style={{ fontSize: 11, color: theme.textMuted }}>No email</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* Suggested members from other groups */}
        {suggestedMembers.length > 0 && (
          <>
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Suggested from your groups</Text>
            {suggestedMembers.slice(0, 10).map(s => {
              const isSelected = selectedMembers.find(m => m.id === s.id);
              const isFriend = friends.find(f => f.id === s.id);
              if (isFriend) return null; // Already shown in friends list
              return (
                <TouchableOpacity key={s.id} activeOpacity={0.7} style={styles.friendRow} onPress={() => toggleMember(s)}>
                  <Avatar name={s.name} size={38} />
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName} numberOfLines={1}>{s.name}</Text>
                    <Text style={styles.friendEmail} numberOfLines={1}>{s.email}</Text>
                    {s.coGroupCount > 0 && (
                      <Text style={{ fontSize: 11, color: theme.primary, fontStyle: 'italic' }}>
                        {s.coGroupCount} shared group{s.coGroupCount > 1 ? 's' : ''}
                      </Text>
                    )}
                  </View>
                  <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color={theme.background} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {Platform.OS === 'web' && (
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.createBtn, creating && { opacity: 0.5 }]}
            onPress={handleCreate}
            disabled={creating}
          >
            <Text style={styles.createBtnText}>{creating ? 'Creating…' : 'Create Group'}</Text>
          </TouchableOpacity>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Feature 20: Currency Picker Modal */}
      <Modal visible={showCurrencyPicker} animationType="slide" presentationStyle="formSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity testID="currency-modal-close" activeOpacity={0.7} onPress={() => setShowCurrencyPicker(false)}>
              <Text style={{ fontSize: 16, color: theme.textMuted }}>Close</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>Currency</Text>
            <View style={{ width: 50 }} />
          </View>
          {CURRENCY_OPTIONS.map(c => (
            <TouchableOpacity
              testID={`currency-option-${c.code}`}
              key={c.code}
              activeOpacity={0.7}
              style={[styles.currencyOption, groupCurrency === c.code && styles.currencyOptionActive]}
              onPress={() => { setGroupCurrency(c.code); setShowCurrencyPicker(false); }}
            >
              <Text style={{ fontSize: 20, marginRight: 12 }}>{c.symbol}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text }}>{c.code}</Text>
                <Text style={{ fontSize: 13, color: theme.textLight }}>{c.label}</Text>
              </View>
              {groupCurrency === c.code && <Ionicons name="checkmark" size={22} color={theme.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </View>
    </Animated.View>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20 },
  headerBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  cancelText: { fontSize: 16, color: theme.textMuted },
  createText: { fontSize: 16, fontWeight: '700', color: theme.primary },
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: theme.textLight,
    marginBottom: 10, marginTop: 20,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  textInput: {
    backgroundColor: theme.white, borderRadius: 14,
    padding: 16, fontSize: 16, color: theme.text,
    borderWidth: 1, borderColor: theme.border,
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20, backgroundColor: theme.white,
    borderWidth: 1, borderColor: theme.border, gap: 6,
  },
  typeBtnActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  typeEmoji: { fontSize: 16 },
  typeLabel: { fontSize: 13, color: theme.textLight, fontWeight: '600' },
  typeLabelActive: { color: theme.background, fontWeight: '700' },
  typeHint: { fontSize: 13, color: theme.primary, marginTop: 8, fontStyle: 'italic' },
  noFriendsBox: {
    backgroundColor: theme.white, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: theme.border,
  },
  noFriendsText: { fontSize: 14, color: theme.textLight, lineHeight: 20 },
  friendRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  friendInfo: { flex: 1, marginLeft: 12 },
  friendName: { fontSize: 15, fontWeight: '600', color: theme.text, flex: 1, minWidth: 0 },
  friendEmail: { fontSize: 13, color: theme.textLight, marginTop: 1 },
  checkbox: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: theme.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: theme.primary, borderColor: theme.primary },
  createBtn: {
    backgroundColor: theme.primary, borderRadius: 14,
    padding: 16, alignItems: 'center', marginTop: 24,
  },
  createBtnText: { fontSize: 16, fontWeight: '700', color: theme.background },
  // Feature 17: Emoji picker
  emojiBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.white, borderWidth: 2, borderColor: theme.border, marginRight: 8,
  },
  emojiBtnActive: { borderColor: theme.primary, backgroundColor: theme.primaryLight },
  // Feature 18: Member chip
  memberChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primaryLight,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 6,
    borderWidth: 1, borderColor: 'rgba(0,212,170,0.2)', maxWidth: '45%',
  },
  memberChipText: { fontSize: 13, color: theme.primary, fontWeight: '600', flexShrink: 1 },
  // Feature 19: Template buttons
  templateBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.white,
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginRight: 8,
    borderWidth: 1, borderColor: theme.border, gap: 6,
  },
  templateLabel: { fontSize: 13, color: theme.text, fontWeight: '600' },
  // Feature 20: Currency picker
  currencyPickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.white, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: theme.border,
  },
  currencyPickerText: { fontSize: 16, color: theme.text, fontWeight: '500' },
  modalContainer: { flex: 1, backgroundColor: theme.background, padding: 20 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20, paddingTop: Platform.OS === 'android' ? 24 : 12,
  },
  currencyOption: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12,
    borderRadius: 12, marginBottom: 6,
  },
  currencyOptionActive: { backgroundColor: theme.primaryLight },
  // Contacts import button
  importContactsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 14, marginTop: 12,
    backgroundColor: theme.card, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(0,212,170,0.2)', borderStyle: 'dashed',
    gap: 8,
  },
  importContactsBtnText: { color: theme.primary, fontWeight: '600', fontSize: 14 },
});

export default CreateGroupScreen;
