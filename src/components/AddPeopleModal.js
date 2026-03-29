/**
 * AddPeopleModal - Unified component for adding friends and group members
 * Supports modes: 'friend' and 'group-member'
 * Tabs: Search | Contacts | Friends (group only) | Suggested | Link (group only)
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, Modal, TextInput, ActivityIndicator, Platform, StatusBar, Image, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import Avatar from './Avatar';
import ShakeView from './ShakeView';
import {
  addFriend, searchUsers, sendGroupInvite, addMemberToGroup,
  getSuggestedFriendsFromGroups, getSuggestedMembersForGroup,
  savePendingInvite,
} from '../services/storage';
import {
  getContacts, requestContactsPermission, sendWhatsAppMessage,
  buildInviteMessage, buildWhatsAppInviteMessage, buildGroupWhatsAppInviteMessage,
} from '../services/contacts';
import { shareOrCopy } from '../utils/share';
import { rPadding, rWidth, screenWidth } from '../utils/responsive';

const INVITE_BASE_URL = 'https://ajayksingh.github.io/evenly/';

const AddPeopleModal = ({
  visible,
  onClose,
  mode = 'friend', // 'friend' | 'group-member'
  groupId,
  groupName,
  existingMemberIds = [],
  onPersonAdded,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { user, friends, refresh } = useApp();

  // Determine available tabs
  const isGroupMode = mode === 'group-member';
  const tabs = useMemo(() => {
    if (isGroupMode) {
      const t = [{ key: 'friends', label: 'Friends', icon: 'people' }];
      t.push({ key: 'search', label: 'Search', icon: 'search' });
      if (Platform.OS !== 'web') t.push({ key: 'contacts', label: 'Contacts', icon: 'call' });
      t.push({ key: 'suggested', label: 'Suggested', icon: 'sparkles' });
      t.push({ key: 'link', label: 'Link', icon: 'link' });
      return t;
    }
    const t = [{ key: 'search', label: 'Search', icon: 'search' }];
    if (Platform.OS !== 'web') t.push({ key: 'contacts', label: 'Contacts', icon: 'call' });
    t.push({ key: 'suggested', label: 'Suggested', icon: 'sparkles' });
    return t;
  }, [isGroupMode]);

  const [activeTab, setActiveTab] = useState(isGroupMode ? 'friends' : 'search');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef(null);
  const emailShakeRef = useRef(null);

  // Contacts state
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  // Suggested state
  const [suggestedPeople, setSuggestedPeople] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // Selection state (unified across tabs)
  const [selectedItems, setSelectedItems] = useState({}); // { id: item }
  const [batchAdding, setBatchAdding] = useState(false);
  const [adding, setAdding] = useState(false);

  const selectedCount = Object.keys(selectedItems).length;

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setSearchResults([]);
      setContacts([]);
      setContactSearch('');
      setSuggestedPeople([]);
      setSelectedItems({});
      setActiveTab(isGroupMode ? 'friends' : 'search');
    }
  }, [visible, isGroupMode]);

  // Filter friends for group mode
  const availableFriends = useMemo(() => {
    if (!isGroupMode) return [];
    const existingSet = new Set(existingMemberIds);
    return friends.filter(f => !existingSet.has(f.id));
  }, [friends, existingMemberIds, isGroupMode]);

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts;
    const q = contactSearch.toLowerCase().trim();
    return contacts.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    );
  }, [contacts, contactSearch]);

  // Invite link
  const inviteLink = useMemo(() => {
    if (isGroupMode && groupId) return `${INVITE_BASE_URL}?joinGroup=${groupId}`;
    return user ? `${INVITE_BASE_URL}?invite=${user.id}` : INVITE_BASE_URL;
  }, [isGroupMode, groupId, user]);

  // --- Handlers ---

  const handleSearchInput = useCallback((text) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (text.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchUsers(text.trim(), user.id);
        setSearchResults(results);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 300);
  }, [user]);

  const loadContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      const granted = await requestContactsPermission();
      if (granted) {
        const data = await getContacts();
        setContacts(data);
      }
    } catch (e) {
      console.error('loadContacts error:', e);
    }
    setContactsLoading(false);
  }, []);

  const loadSuggestions = useCallback(async () => {
    if (!user) return;
    setSuggestionsLoading(true);
    try {
      const data = isGroupMode && groupId
        ? await getSuggestedMembersForGroup(user.id, groupId)
        : await getSuggestedFriendsFromGroups(user.id);
      setSuggestedPeople(data);
    } catch { setSuggestedPeople([]); }
    setSuggestionsLoading(false);
  }, [user, isGroupMode, groupId]);

  const toggleSelection = useCallback((item) => {
    setSelectedItems(prev => {
      const key = item.id;
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: item };
    });
  }, []);

  // Add member to group — direct add (no invite flow, instant membership)
  const addToGroup = useCallback(async (item) => {
    await addMemberToGroup(groupId, { id: item.id, name: item.name, email: item.email, avatar: item.avatar || null });
  }, [groupId]);

  const handleAddSingle = useCallback(async (item) => {
    setAdding(true);
    try {
      if (isGroupMode) {
        await addToGroup(item);
        Alert.alert('Member Added', `${item.name} has been added to "${groupName}".`);
      } else {
        if (!item.email) {
          Alert.alert('No Email', `${item.name || 'This contact'} doesn't have an email address. Share your invite link instead.`);
          setAdding(false);
          return;
        }
        const result = await addFriend(user.id, item.email);
        if (result?.requested) {
          Alert.alert('Request Sent', `Friend request sent to ${item.name || item.email}.`);
        } else {
          Alert.alert('Friend Added', `${item.name || item.email} has been added!`);
        }
      }
      onPersonAdded?.();
    } catch (e) {
      if (e.message?.includes('No user found') && !isGroupMode) {
        await savePendingInvite(item.email, user.id);
        Alert.alert('Invited', `${item.email} isn't on Evenly yet. We'll notify you when they join.`);
        onPersonAdded?.();
      } else {
        Alert.alert('Error', e.message);
      }
    }
    setAdding(false);
  }, [isGroupMode, groupId, groupName, user, onPersonAdded]);

  const handleAddByEmail = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setAdding(true);
    try {
      if (isGroupMode) {
        // Search for user first
        const results = await searchUsers(searchQuery.trim(), user.id);
        const found = results.find(u => u.email.toLowerCase() === searchQuery.trim().toLowerCase());
        if (found) {
          await sendGroupInvite(groupId, groupName, found.id, user.id, user.name);
          Alert.alert('Invite Sent', `${found.name} will receive a request to join "${groupName}".`);
        } else {
          Alert.alert('Not Found', 'No user found with that email. Share the group link instead.');
        }
      } else {
        const result = await addFriend(user.id, searchQuery.trim());
        if (result?.requested) {
          Alert.alert('Request Sent', 'Friend request sent!');
        }
      }
      onPersonAdded?.();
    } catch (e) {
      if (e.message?.includes('No user found') && !isGroupMode) {
        await savePendingInvite(searchQuery.trim(), user.id);
        Alert.alert('Invited', `${searchQuery.trim()} isn't on Evenly yet. We'll notify you when they join.`);
        onPersonAdded?.();
      } else {
        Alert.alert('Error', e.message);
      }
    }
    setAdding(false);
    setSearchQuery('');
  }, [searchQuery, isGroupMode, groupId, groupName, user, onPersonAdded]);

  const handleBatchAdd = useCallback(async () => {
    const items = Object.values(selectedItems);
    if (items.length === 0) return;
    setBatchAdding(true);
    let added = 0, failed = 0, invited = 0;
    for (const item of items) {
      try {
        if (isGroupMode) {
          if (item.id && !item.id.startsWith('contact-')) {
            await addToGroup(item);
            added++;
          } else if (item.email) {
            // Contact - try to find registered user
            const results = await searchUsers(item.email, user.id);
            const found = results.find(u => u.email.toLowerCase() === item.email.toLowerCase());
            if (found) {
              await addToGroup(found);
              added++;
            } else {
              invited++;
            }
          } else {
            invited++;
          }
        } else {
          if (item.email) {
            try {
              await addFriend(user.id, item.email);
              added++;
            } catch (e) {
              if (e.message?.includes('No user found')) {
                await savePendingInvite(item.email, user.id);
                invited++;
              } else { failed++; }
            }
          } else {
            invited++;
          }
        }
      } catch { failed++; }
    }
    const parts = [];
    if (added > 0) parts.push(`${added} ${isGroupMode ? 'invited' : 'added'}`);
    if (invited > 0) parts.push(`${invited} not on Evenly`);
    if (failed > 0) parts.push(`${failed} failed`);
    Alert.alert('Batch Add Complete', parts.join(', '));
    setSelectedItems({});
    onPersonAdded?.();
    setBatchAdding(false);
  }, [selectedItems, isGroupMode, groupId, groupName, user, onPersonAdded]);

  const handleShareInvite = useCallback(async () => {
    const message = isGroupMode
      ? `Join "${groupName}" on Evenly to split expenses: ${inviteLink}`
      : buildInviteMessage(user?.name, inviteLink);
    await shareOrCopy({ message, title: isGroupMode ? `Join ${groupName} on Evenly` : 'Join me on Evenly' });
  }, [isGroupMode, groupName, inviteLink, user]);

  const handleWhatsAppInvite = useCallback(async (phone) => {
    const message = isGroupMode
      ? buildGroupWhatsAppInviteMessage(user?.name, groupName, inviteLink)
      : buildWhatsAppInviteMessage(user?.name, inviteLink);
    if (phone) {
      await sendWhatsAppMessage(phone, message);
    } else {
      await shareOrCopy({ message, title: 'Invite to Evenly' });
    }
  }, [isGroupMode, groupName, inviteLink, user]);

  // --- Render helpers ---

  const renderPersonRow = useCallback(({ item, isAlready = false, showCheckbox = true }) => {
    const isSelected = !!selectedItems[item.id];
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.contactRow, isAlready && styles.contactRowAdded]}
        onPress={() => !isAlready && (showCheckbox ? toggleSelection(item) : handleAddSingle(item))}
        disabled={isAlready || adding}
      >
        {showCheckbox && !isAlready && (
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && <Ionicons name="checkmark" size={14} color="#0a0a0f" />}
          </View>
        )}
        <Avatar name={item.name} avatar={item.avatar} size={40} />
        <View style={styles.contactInfo}>
          <Text style={styles.contactName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.contactDetail} numberOfLines={1}>
            {item.email || item.phone || 'No contact info'}
          </Text>
          {item.coGroupCount > 0 && (
            <Text style={styles.suggestedLabel}>{item.coGroupCount} shared group{item.coGroupCount > 1 ? 's' : ''}</Text>
          )}
        </View>
        {isAlready ? (
          <View style={styles.alreadyBadge}>
            <Text style={styles.alreadyText}>{isGroupMode ? 'Member' : 'Added'}</Text>
          </View>
        ) : !showCheckbox ? (
          <View style={styles.addContactBtn}>
            <Ionicons name="person-add-outline" size={18} color={theme.primary} />
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }, [selectedItems, adding, isGroupMode, theme, styles, toggleSelection, handleAddSingle]);

  const renderBatchButton = () => {
    if (selectedCount === 0) return null;
    return (
      <TouchableOpacity
        testID="batch-add-btn"
        activeOpacity={0.7}
        style={styles.batchAddBtn}
        onPress={handleBatchAdd}
        disabled={batchAdding}
      >
        {batchAdding ? (
          <ActivityIndicator size="small" color="#0a0a0f" />
        ) : (
          <>
            <Ionicons name="people" size={16} color="#0a0a0f" />
            <Text style={styles.batchAddBtnText}>
              {isGroupMode ? `Invite Selected (${selectedCount})` : `Add Selected (${selectedCount})`}
            </Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  // --- Tab content renderers ---

  const renderSearchTab = () => (
    <>
      <ShakeView ref={emailShakeRef}>
        <View style={styles.inputRow}>
          <Ionicons name="search-outline" size={20} color={theme.textLight} style={{ marginRight: 10 }} />
          <TextInput
            testID="member-search-input"
            style={styles.emailInput}
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChangeText={handleSearchInput}
            autoCapitalize="none"
            autoFocus={activeTab === 'search'}
            placeholderTextColor={theme.textMuted}
            autoComplete="email"
          />
          {searching && <ActivityIndicator size="small" color={theme.primary} />}
        </View>
      </ShakeView>

      {renderBatchButton()}

      {searchResults.length > 0 ? (
        <FlatList
          data={searchResults}
          keyExtractor={item => item.id}
          extraData={selectedItems}
          renderItem={({ item }) => {
            const isAlready = isGroupMode
              ? existingMemberIds.includes(item.id)
              : friends.some(f => f.id === item.id);
            return renderPersonRow({ item, isAlready, showCheckbox: true });
          }}
          showsVerticalScrollIndicator={false}
        />
      ) : searchQuery.trim().length >= 2 && !searching ? (
        <View style={styles.hintBox}>
          <Ionicons name="information-circle" size={16} color={theme.primary} />
          <Text style={styles.hintText}>
            {isGroupMode
              ? 'No users found. Share the group link to invite them.'
              : 'No users found. Tap "Add" to send an invite by email, or share your invite link.'}
          </Text>
        </View>
      ) : !searchQuery.trim() ? (
        <View style={styles.hintBox}>
          <Ionicons name="information-circle" size={16} color={theme.primary} />
          <Text style={styles.hintText}>
            Search by name, email, or phone number. Results appear as you type.
          </Text>
        </View>
      ) : null}
    </>
  );

  const renderContactsTab = () => (
    <>
      {contactsLoading ? (
        <View style={styles.contactsLoading}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading contacts...</Text>
        </View>
      ) : (
        <>
          <View style={styles.contactSearchRow}>
            <Ionicons name="search" size={18} color={theme.textLight} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.contactSearch}
              placeholder="Search contacts..."
              value={contactSearch}
              onChangeText={setContactSearch}
              placeholderTextColor={theme.textMuted}
            />
          </View>

          {renderBatchButton()}

          <FlatList
            data={filteredContacts}
            keyExtractor={item => item.id}
            extraData={selectedItems}
            renderItem={({ item }) => {
              const isAlready = friends.some(f =>
              f.email === item.email && (isGroupMode ? existingMemberIds.includes(f.id) : true)
            );
              return renderPersonRow({ item, isAlready, showCheckbox: true });
            }}
            ListEmptyComponent={
              <Text style={styles.noContacts}>
                {contacts.length === 0 ? 'No contacts found. Tap to grant permission.' : 'No matching contacts'}
              </Text>
            }
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </>
  );

  const renderFriendsTab = () => (
    <>
      {renderBatchButton()}
      <FlatList
        data={availableFriends}
        keyExtractor={item => item.id}
        extraData={selectedItems}
        renderItem={({ item }) => renderPersonRow({ item, isAlready: false, showCheckbox: true })}
        ListEmptyComponent={
          <View style={styles.hintBox}>
            <Ionicons name="information-circle" size={16} color={theme.primary} />
            <Text style={styles.hintText}>
              {friends.length === 0
                ? 'No friends yet. Add friends first, then you can quickly add them to groups.'
                : 'All your friends are already in this group!'}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </>
  );

  const renderSuggestedTab = () => (
    <>
      {suggestionsLoading ? (
        <View style={styles.contactsLoading}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Finding suggestions...</Text>
        </View>
      ) : (
        <>
          {renderBatchButton()}
          <FlatList
            data={suggestedPeople}
            keyExtractor={item => item.id}
            extraData={selectedItems}
            renderItem={({ item }) => {
              const isAlready = isGroupMode
                ? existingMemberIds.includes(item.id)
                : friends.some(f => f.id === item.id);
              return renderPersonRow({ item, isAlready, showCheckbox: true });
            }}
            ListEmptyComponent={
              <View style={styles.hintBox}>
                <Ionicons name="sparkles" size={16} color={theme.primary} />
                <Text style={styles.hintText}>
                  {isGroupMode
                    ? 'No suggestions yet. Suggestions appear based on your other groups.'
                    : 'No suggestions yet. Join groups to discover people you can add as friends.'}
                </Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </>
  );

  const renderLinkTab = () => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(inviteLink)}&size=200x200&bgcolor=1a1a24&color=00d4aa&format=png`;
    return (
      <ScrollView contentContainerStyle={styles.linkTabContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.linkTabTitle}>
          {isGroupMode ? `Invite to "${groupName}"` : 'My QR Code'}
        </Text>
        <Text style={styles.linkTabSubtitle}>
          {isGroupMode ? 'Share this QR code or link to invite people' : 'Scan to add me as a friend'}
        </Text>

        <View style={styles.qrImageContainer}>
          <Image
            source={{ uri: qrUrl }}
            style={styles.qrImage}
            resizeMode="contain"
          />
        </View>

        {Platform.OS === 'web' && (
          <View style={styles.linkBox}>
            <Text style={styles.linkText} selectable numberOfLines={2}>{inviteLink}</Text>
          </View>
        )}

        <View style={styles.linkActions}>
          <TouchableOpacity activeOpacity={0.7} style={styles.linkShareBtn} onPress={handleShareInvite}>
            <Ionicons name="share-outline" size={18} color={theme.primary} />
            <Text style={styles.linkShareText} numberOfLines={1}>Share Link</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.7} style={styles.whatsappShareBtn} onPress={() => handleWhatsAppInvite()}>
            <Text style={{ fontSize: 18 }}>{'\u{1F4AC}'}</Text>
            <Text style={styles.whatsappShareText} numberOfLines={1}>WhatsApp Invite</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'search': return renderSearchTab();
      case 'contacts': return renderContactsTab();
      case 'friends': return renderFriendsTab();
      case 'suggested': return renderSuggestedTab();
      case 'link': return renderLinkTab();
      default: return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modal}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity testID="modal-cancel-btn" activeOpacity={0.7} style={{ padding: 8 }} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {isGroupMode ? 'Add Members' : 'Add Friend'}
          </Text>
          {activeTab === 'search' && searchQuery.trim() && !searchResults.length ? (
            <TouchableOpacity activeOpacity={0.7} onPress={handleAddByEmail} disabled={adding || !searchQuery.trim()}>
              {adding ? <ActivityIndicator color={theme.primary} size="small" /> : (
                <Text style={[styles.saveText, !searchQuery.trim() && { opacity: 0.4 }]}>Add</Text>
              )}
            </TouchableOpacity>
          ) : <View style={{ width: 40 }} />}
        </View>

        {/* Tab Toggle */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modeToggleScroll} contentContainerStyle={styles.modeToggle}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              testID={`tab-${tab.key}`}
              activeOpacity={0.7}
              style={[styles.modeBtn, activeTab === tab.key && styles.modeBtnActive]}
              onPress={() => {
                setActiveTab(tab.key);
                if (tab.key === 'contacts' && contacts.length === 0) loadContacts();
                if (tab.key === 'suggested' && suggestedPeople.length === 0) loadSuggestions();
              }}
            >
              <Ionicons name={tab.icon} size={16} color={activeTab === tab.key ? theme.primary : theme.textLight} />
              <Text style={[styles.modeBtnText, activeTab === tab.key && styles.modeBtnTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* WhatsApp invite row */}
        <TouchableOpacity activeOpacity={0.7} style={styles.whatsappInviteRow} onPress={() => handleWhatsAppInvite()}>
          <Text style={{ fontSize: 18 }}>{'\u{1F4AC}'}</Text>
          <Text style={styles.whatsappInviteText} numberOfLines={1}>
            {isGroupMode ? `Invite to ${groupName} via WhatsApp` : 'Invite via WhatsApp'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#25D366" />
        </TouchableOpacity>

        {/* Tab Content */}
        {renderActiveTab()}
      </View>
    </Modal>
  );
};

const getStyles = (theme) => StyleSheet.create({
  modal: {
    flex: 1, backgroundColor: theme.card, padding: rPadding(20, 16, 12),
    borderTopLeftRadius: Platform.OS === 'ios' ? 28 : 0,
    borderTopRightRadius: Platform.OS === 'ios' ? 28 : 0,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
  cancelText: { fontSize: 16, color: theme.textLight },
  saveText: { fontSize: 16, color: theme.primary, fontWeight: '700' },

  // Tab toggle
  modeToggleScroll: { flexGrow: 0, marginBottom: 16 },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: theme.background,
    borderRadius: 12, padding: 4,
  },
  modeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, gap: 6,
  },
  modeBtnActive: { borderBottomWidth: 2, borderBottomColor: theme.primary },
  modeBtnText: { fontSize: 13, color: theme.textLight, fontWeight: '500' },
  modeBtnTextActive: { color: theme.primary, fontWeight: '700' },

  // WhatsApp row
  whatsappInviteRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(37,211,102,0.1)',
    borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(37,211,102,0.2)',
  },
  whatsappInviteText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#25D366', marginLeft: 10 },

  // Search input
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.inputBg,
    borderRadius: 14, padding: 16, marginBottom: 16,
  },
  emailInput: { flex: 1, fontSize: 16, color: theme.text },
  hintBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: 'rgba(0,212,170,0.08)', padding: 12, borderRadius: 12,
  },
  hintText: { flex: 1, fontSize: 13, color: theme.primary, marginLeft: 8, lineHeight: 18 },

  // Contacts loading
  contactsLoading: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, color: theme.textLight, textAlign: 'center', paddingHorizontal: 20 },

  // Contact search
  contactSearchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.inputBg,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
  },
  contactSearch: { flex: 1, fontSize: 15, color: theme.text },

  // Batch add
  batchAddBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.primary, borderRadius: 12,
    paddingVertical: 12, marginBottom: 12, gap: 8,
  },
  batchAddBtnText: { fontSize: 14, fontWeight: '700', color: theme.background },

  // Checkbox
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: theme.textMuted,
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  checkboxSelected: { backgroundColor: theme.primary, borderColor: theme.primary },

  // Contact/Person rows
  contactRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.card, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 12, marginBottom: 6,
  },
  contactRowAdded: { opacity: 0.45 },
  contactInfo: { flex: 1, marginLeft: 12, minWidth: 0 },
  contactName: { fontSize: 15, fontWeight: '600', color: theme.text, flex: 1, minWidth: 0 },
  contactDetail: { fontSize: 13, color: theme.textLight, marginTop: 2 },
  suggestedLabel: { fontSize: 11, color: theme.primary, marginTop: 2, fontStyle: 'italic' },
  alreadyBadge: {
    backgroundColor: theme.primaryLight, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  alreadyText: { fontSize: 12, color: theme.primary, fontWeight: '600' },
  addContactBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: theme.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  noContacts: { textAlign: 'center', color: theme.textLight, paddingVertical: 40 },

  // Link tab
  linkTabContent: { alignItems: 'center', paddingVertical: 10 },
  linkTabTitle: { fontSize: 20, fontWeight: '700', color: theme.text, marginBottom: 4 },
  linkTabSubtitle: { fontSize: 13, color: theme.textLight, marginBottom: 20 },
  qrImageContainer: {
    backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: theme.border,
  },
  qrImage: { width: Math.min(200, screenWidth * 0.5), height: Math.min(200, screenWidth * 0.5) },
  linkBox: {
    backgroundColor: theme.inputBg,
    borderRadius: 10, padding: 10, width: '100%', marginBottom: 16,
  },
  linkText: { fontSize: 12, color: theme.textLight, textAlign: 'center' },
  linkActions: { flexDirection: 'row', gap: 12, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' },
  linkShareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.primaryLight,
    borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12,
  },
  linkShareText: { fontSize: 14, fontWeight: '700', color: theme.primary },
  whatsappShareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(37,211,102,0.1)',
    borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(37,211,102,0.2)',
  },
  whatsappShareText: { fontSize: 14, fontWeight: '700', color: '#25D366' },
});

export default AddPeopleModal;
