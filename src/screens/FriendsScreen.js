import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, Modal, TextInput, ActivityIndicator, SectionList, Platform, StatusBar,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS } from '../constants/colors';
import Avatar from '../components/Avatar';
import BackgroundOrbs from '../components/BackgroundOrbs';
import { addFriend, respondToFriendRequest } from '../services/storage';
import { getContacts, requestContactsPermission, sendWhatsAppMessage } from '../services/contacts';
import { formatAmount } from '../services/currency';
import { confirmAlert } from '../utils/alert';

const FriendsScreen = ({ navigation }) => {
  const { user, friends, balances, currency, refresh, friendRequests } = useApp();

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerBg = scrollY.interpolate({ inputRange: [0, 80], outputRange: ['rgba(10,10,15,0)', 'rgba(10,10,15,0.97)'], extrapolate: 'clamp' });
  const headerBorder = scrollY.interpolate({ inputRange: [0, 80], outputRange: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.08)'], extrapolate: 'clamp' });
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState('email'); // email | contacts
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [respondingTo, setRespondingTo] = useState(null); // requestId being responded to

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const handleAddFriend = async () => {
    if (!email.trim()) return;
    setAdding(true);
    try {
      await addFriend(user.id, email.trim().toLowerCase());
      setEmail(''); setShowAdd(false);
      refresh();
      Alert.alert('Request Sent!', 'They will be notified and can accept your friend request.');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally { setAdding(false); }
  };

  const handleRespondToRequest = async (requestId, accept) => {
    setRespondingTo(requestId);
    try {
      await respondToFriendRequest(requestId, accept, user.id);
      refresh();
      if (accept) Alert.alert('Friend Added!', 'You are now friends and can split expenses together.');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setRespondingTo(null);
    }
  };

  const loadContacts = async () => {
    setContactsLoading(true);
    try {
      const granted = await requestContactsPermission();
      if (!granted) {
        Alert.alert('Permission Required', 'Allow contacts access to import friends');
        setContactsLoading(false);
        return;
      }
      const list = await getContacts();
      setContacts(list);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally { setContactsLoading(false); }
  };

  const handleAddFromContact = async (contact) => {
    if (!contact.email) {
      confirmAlert({
        title: 'No Email Found',
        message: `${contact.name} doesn't have an email in your contacts. Would you like to invite them via WhatsApp?`,
        confirmText: 'WhatsApp Invite',
        onConfirm: () => contact.phone && sendWhatsAppMessage(
          contact.phone,
          `Hey ${contact.name}! I'm using Evenly to split expenses. Join me! 💸`
        ),
      });
      return;
    }
    setAdding(true);
    try {
      await addFriend(user.id, contact.email);
      refresh();
      Alert.alert('Added!', `${contact.name} added as friend`);
    } catch (e) {
      // If user not found, offer to create them
      confirmAlert({
        title: 'Not Registered',
        message: `${contact.name} isn't on Evenly yet. Invite via WhatsApp?`,
        confirmText: 'WhatsApp',
        onConfirm: () => contact.phone && sendWhatsAppMessage(
          contact.phone,
          `Hey ${contact.name}! Join me on Evenly to split expenses easily! 💸`
        ),
      });
    } finally { setAdding(false); }
  };

  const filteredContacts = contactSearch
    ? contacts.filter(c =>
        c.name?.toLowerCase().includes(contactSearch.toLowerCase()) ||
        c.phone?.includes(contactSearch)
      )
    : contacts;

  const getFriendBalance = (friendId) => balances.find(b => b.userId === friendId);

  const handleWhatsAppBalance = (friend) => {
    const balance = getFriendBalance(friend.id);
    if (!friend.phone) {
      Alert.alert('No Phone', `No phone number for ${friend.name}`);
      return;
    }
    const amount = Math.abs(balance?.amount || 0);
    const msg = balance?.amount > 0
      ? `Hey ${friend.name}! Just a reminder, you owe me ${formatAmount(amount, currency)} on Evenly. 💸`
      : `Hey ${friend.name}! I owe you ${formatAmount(amount, currency)}. Will settle soon! 💸`;
    sendWhatsAppMessage(friend.phone, msg);
  };

  const renderFriend = ({ item }) => {
    const balance = getFriendBalance(item.id);
    const hasBalance = balance && Math.abs(balance.amount) > 0.01;
    const owesThem = balance && balance.amount < 0;
    const owesUs = balance && balance.amount > 0;
    return (
      <TouchableOpacity
        testID="friend-card"
        activeOpacity={0.7}
        style={styles.friendCard}
        onPress={() => {}}
      >
        <Avatar name={item.name} avatar={item.avatar} size={44} />
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{item.name}</Text>
          <Text style={styles.friendEmail}>{item.email}</Text>
          {item.phone && <Text style={styles.friendPhone}>{item.phone}</Text>}
        </View>
        <View style={styles.rightCol}>
          <View style={styles.balanceContainer}>
            {hasBalance ? (
              <>
                <Text style={[styles.balanceLabel, { color: balance.amount > 0 ? '#00d4aa' : '#ff6b6b' }]}>
                  {balance.amount > 0 ? 'owes you' : 'you owe'}
                </Text>
                <Text style={[styles.balanceAmount, { color: balance.amount > 0 ? '#00d4aa' : '#ff6b6b' }]}>
                  {formatAmount(Math.abs(balance.amount), currency)}
                </Text>
              </>
            ) : (
              <Text style={styles.settledUp}>settled up</Text>
            )}
          </View>
          {/* BUG-008: Action buttons — Remind if they owe you, Settle if you owe them */}
          <View style={styles.actionRow}>
            {owesUs && (
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.remindPill}
                onPress={() => handleWhatsAppBalance(item)}
              >
                <Text style={styles.remindPillText}>Remind</Text>
              </TouchableOpacity>
            )}
            {owesThem && (
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.settlePill}
                onPress={() => navigation.navigate('SettleUp', {
                  preselectedPayer: user.id,
                  preselectedReceiver: item.id,
                })}
              >
                <Text style={styles.settlePillText}>Settle</Text>
              </TouchableOpacity>
            )}
            {item.phone && (
              <TouchableOpacity activeOpacity={0.7} style={styles.waBtn} onPress={() => handleWhatsAppBalance(item)}>
                <Text style={styles.waIcon}>💬</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFriendRequest = ({ item }) => (
    <View style={styles.requestCard}>
      <Avatar name={item.senderName} size={44} />
      <View style={styles.requestInfo}>
        <Text style={styles.requestName}>{item.senderName}</Text>
        <Text style={styles.requestEmail}>{item.senderEmail}</Text>
        <Text style={styles.requestMeta}>wants to be friends</Text>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.acceptBtn}
          disabled={respondingTo === item.id}
          onPress={() => handleRespondToRequest(item.id, true)}
        >
          <Text style={styles.acceptBtnText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.declineBtn}
          disabled={respondingTo === item.id}
          onPress={() => handleRespondToRequest(item.id, false)}
        >
          <Text style={styles.declineBtnText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // BUG-006: Summary grid — counts per Figma spec (not amounts)
  const oweYouCount = friends.filter(f => { const b = getFriendBalance(f.id); return b && b.amount > 0; }).length;
  const youOweCount = friends.filter(f => { const b = getFriendBalance(f.id); return b && b.amount < 0; }).length;
  const settledCount = friends.filter(f => { const b = getFriendBalance(f.id); return !b || Math.abs(b.amount) <= 0.01; }).length;

  // BUG-007: Build categorized sections for SectionList
  const oweYouFriends = friends.filter(f => { const b = getFriendBalance(f.id); return b && b.amount > 0; });
  const youOweFriends = friends.filter(f => { const b = getFriendBalance(f.id); return b && b.amount < 0; });
  const settledFriends = friends.filter(f => { const b = getFriendBalance(f.id); return !b || Math.abs(b.amount) <= 0.01; });

  const sections = [
    ...(oweYouFriends.length > 0 ? [{ title: 'People who owe you', data: oweYouFriends }] : []),
    ...(youOweFriends.length > 0 ? [{ title: 'People you owe', data: youOweFriends }] : []),
    ...(settledFriends.length > 0 ? [{ title: 'Settled up', data: settledFriends }] : []),
  ];

  return (
    <View style={styles.container}>
      <BackgroundOrbs />
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />
      <Animated.View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: headerBorder }]}>
        <Text style={styles.title}>Friends</Text>
        <TouchableOpacity testID="friends-add-btn" activeOpacity={0.7} style={styles.addBtn} onPress={() => { setShowAdd(true); setAddMode('email'); }}>
          <Ionicons name="person-add" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </Animated.View>

      {/* BUG-006: 3-column summary grid with counts */}
      {friends.length > 0 && (
        <View style={styles.summaryGrid}>
          <View style={[styles.statCard, styles.statCardOweYou]}>
            <Text style={[styles.statCount, { color: '#00d4aa' }]}>{oweYouCount}</Text>
            <Text style={styles.statLabel}>owe you</Text>
          </View>
          <View style={[styles.statCard, styles.statCardYouOwe]}>
            <Text style={[styles.statCount, { color: '#ff6b6b' }]}>{youOweCount}</Text>
            <Text style={styles.statLabel}>you owe</Text>
          </View>
          <View style={[styles.statCard, styles.statCardSettled]}>
            <Text style={[styles.statCount, { color: '#71717a' }]}>{settledCount}</Text>
            <Text style={styles.statLabel}>settled</Text>
          </View>
        </View>
      )}

      {friendRequests.length > 0 && (
        <View style={styles.requestsSection}>
          <Text style={styles.requestsSectionTitle}>
            Friend Requests ({friendRequests.length})
          </Text>
          <FlatList
            data={friendRequests}
            keyExtractor={item => item.id}
            renderItem={renderFriendRequest}
            scrollEnabled={false}
          />
        </View>
      )}

      {friends.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyTitle}>No friends yet</Text>
            <Text style={styles.emptyText}>Add friends by email or import from contacts to start splitting expenses</Text>
            <View style={styles.emptyBtns}>
              <TouchableOpacity activeOpacity={0.7} style={styles.addFriendBtn} onPress={() => { setShowAdd(true); setAddMode('email'); }}>
                <Ionicons name="mail" size={16} color="#fff" />
                <Text style={styles.addFriendBtnText}>Add by Email</Text>
              </TouchableOpacity>
              {Platform.OS !== 'web' && (
                <TouchableOpacity activeOpacity={0.7} style={[styles.addFriendBtn, { backgroundColor: 'rgba(37,211,102,0.18)' }]} onPress={() => { setShowAdd(true); setAddMode('contacts'); loadContacts(); }}>
                  <Ionicons name="people" size={16} color="#25D366" />
                  <Text style={[styles.addFriendBtnText, { color: '#25D366' }]}>From Contacts</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      ) : (
        /* BUG-007: Categorized SectionList replacing flat FlatList */
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderItem={renderFriend}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          renderSectionHeader={({ section: { title } }) => {
            const dotColor =
              title === 'People who owe you' ? '#00d4aa'
              : title === 'People you owe' ? '#ff6b6b'
              : '#71717a';
            return (
              <View style={styles.sectionHeaderRow}>
                <View style={[styles.sectionDot, { backgroundColor: dotColor }]} />
                <Text style={styles.sectionHeader}>{title}</Text>
              </View>
            );
          }}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            Platform.OS !== 'web' ? (
              <TouchableOpacity activeOpacity={0.7} style={styles.importContactsRow} onPress={() => { setShowAdd(true); setAddMode('contacts'); loadContacts(); }}>
                <Ionicons name="people" size={18} color={COLORS.primary} />
                <Text style={styles.importContactsText}>Import from Contacts</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {/* Add Friend Modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity testID="modal-cancel-btn" activeOpacity={0.7} style={{ padding: 8 }} onPress={() => { setShowAdd(false); setEmail(''); setContacts([]); setContactSearch(''); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Friend</Text>
            {addMode === 'email' ? (
              <TouchableOpacity testID="friends-add-submit" activeOpacity={0.7} onPress={handleAddFriend} disabled={adding || !email.trim()}>
                {adding ? <ActivityIndicator color={COLORS.primary} size="small" /> : (
                  <Text style={[styles.saveText, !email.trim() && { opacity: 0.4 }]}>Add</Text>
                )}
              </TouchableOpacity>
            ) : <View style={{ width: 40 }} />}
          </View>

          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.modeBtn, addMode === 'email' && styles.modeBtnActive]}
              onPress={() => setAddMode('email')}
            >
              <Ionicons name="mail" size={16} color={addMode === 'email' ? '#00d4aa' : COLORS.textLight} />
              <Text style={[styles.modeBtnText, addMode === 'email' && styles.modeBtnTextActive]}>By Email</Text>
            </TouchableOpacity>
            {Platform.OS !== 'web' && (
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.modeBtn, addMode === 'contacts' && styles.modeBtnActive]}
                onPress={() => { setAddMode('contacts'); if (contacts.length === 0) loadContacts(); }}
              >
                <Ionicons name="people" size={16} color={addMode === 'contacts' ? '#00d4aa' : COLORS.textLight} />
                <Text style={[styles.modeBtnText, addMode === 'contacts' && styles.modeBtnTextActive]}>Contacts</Text>
              </TouchableOpacity>
            )}
          </View>

          {addMode === 'email' ? (
            <>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={20} color={COLORS.textLight} style={{ marginRight: 10 }} />
                <TextInput
                  testID="friends-email-input"
                  style={styles.emailInput}
                  placeholder="Enter friend's email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoFocus
                  placeholderTextColor={COLORS.textMuted}
                  autoComplete="email"
                />
              </View>
              <View style={styles.hintBox}>
                <Ionicons name="information-circle" size={16} color={COLORS.primary} />
                <Text style={styles.hintText}>
                  Demo accounts: bob@demo.com / carol@demo.com
                </Text>
              </View>
            </>
          ) : (
            <>
              {contactsLoading ? (
                <View style={styles.contactsLoading}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.loadingText}>Loading contacts...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.contactSearchRow}>
                    <Ionicons name="search" size={18} color={COLORS.textLight} style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.contactSearch}
                      placeholder="Search contacts..."
                      value={contactSearch}
                      onChangeText={setContactSearch}
                      placeholderTextColor={COLORS.textMuted}
                    />
                  </View>
                  <FlatList
                    data={filteredContacts}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => {
                      const isAlreadyFriend = friends.some(f => f.email === item.email);
                      return (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          style={[styles.contactRow, isAlreadyFriend && styles.contactRowAdded]}
                          onPress={() => !isAlreadyFriend && handleAddFromContact(item)}
                          disabled={isAlreadyFriend}
                        >
                          <Avatar name={item.name} avatar={item.avatar} size={40} />
                          <View style={styles.contactInfo}>
                            <Text style={styles.contactName}>{item.name}</Text>
                            <Text style={styles.contactDetail}>
                              {item.email || item.phone || 'No contact info'}
                            </Text>
                          </View>
                          {isAlreadyFriend ? (
                            <View style={styles.alreadyBadge}>
                              <Text style={styles.alreadyText}>Added</Text>
                            </View>
                          ) : (
                            <View style={styles.addContactBtn}>
                              <Ionicons name="person-add-outline" size={18} color={COLORS.primary} />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    }}
                    ListEmptyComponent={
                      <Text style={styles.noContacts}>
                        {contacts.length === 0 ? 'No contacts found' : 'No matching contacts'}
                      </Text>
                    }
                    showsVerticalScrollIndicator={false}
                  />
                </>
              )}
            </>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.text },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,212,170,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Summary stat cards
  summaryGrid: { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, marginBottom: 8, gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a24',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statCardOweYou: { borderTopWidth: 2, borderTopColor: '#00d4aa' },
  statCardYouOwe: { borderTopWidth: 2, borderTopColor: '#ff6b6b' },
  statCardSettled: { borderTopWidth: 2, borderTopColor: '#71717a' },
  statCount: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 11, color: '#a1a1aa', marginTop: 4 },

  // Section headers
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 20, marginBottom: 6,
  },
  sectionDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  sectionHeader: {
    fontSize: 12, fontWeight: '700', color: '#a1a1aa',
    textTransform: 'uppercase', letterSpacing: 1,
  },

  // Friend balance cards
  friendCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a24',
    marginHorizontal: 16, marginBottom: 8, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    shadowColor: '#00d4aa', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08, shadowRadius: 16,
  },
  friendInfo: { flex: 1, marginLeft: 12 },
  friendName: { fontSize: 15, fontWeight: '600', color: '#fff' },
  friendEmail: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  friendPhone: { fontSize: 12, color: '#71717a', marginTop: 1 },
  rightCol: { alignItems: 'flex-end', gap: 6 },
  balanceContainer: { alignItems: 'flex-end' },
  balanceLabel: { fontSize: 12, fontWeight: '500' },
  balanceAmount: { fontSize: 14, fontWeight: '700' },
  settledUp: { fontSize: 12, color: '#71717a' },

  // Action pill buttons
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  remindPill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999, height: 30, paddingHorizontal: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  remindPillText: { fontSize: 12, fontWeight: '600', color: '#a1a1aa' },
  settlePill: {
    backgroundColor: 'rgba(0,212,170,0.12)',
    borderRadius: 999, height: 30, paddingHorizontal: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  settlePillText: { fontSize: 12, fontWeight: '600', color: '#00d4aa' },
  waBtn: {
    backgroundColor: 'rgba(37,211,102,0.12)',
    borderRadius: 999, width: 30, height: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  waIcon: { fontSize: 15 },

  // Import contacts footer row
  importContactsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 16, margin: 16,
    backgroundColor: '#1a1a24', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(0,212,170,0.2)', borderStyle: 'dashed',
  },
  importContactsText: { color: '#00d4aa', fontWeight: '600', marginLeft: 8 },

  // Empty state
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyCard: {
    backgroundColor: '#1a1a24', borderRadius: 24, padding: 32,
    alignItems: 'center', width: '100%',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#00d4aa', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1, shadowRadius: 16,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#a1a1aa', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtns: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  addFriendBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,212,170,0.15)',
    borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11,
  },
  addFriendBtnText: { color: '#00d4aa', fontWeight: '700', marginLeft: 6, fontSize: 13 },

  // Add Friend Modal
  modal: {
    flex: 1, backgroundColor: '#1a1a24', padding: 20,
    borderTopLeftRadius: Platform.OS === 'ios' ? 28 : 0,
    borderTopRightRadius: Platform.OS === 'ios' ? 28 : 0,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  cancelText: { fontSize: 16, color: '#a1a1aa' },
  saveText: { fontSize: 16, color: '#00d4aa', fontWeight: '700' },

  // Tab toggle
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#0a0a0f',
    borderRadius: 12, padding: 4, marginBottom: 20,
  },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 10, gap: 6,
  },
  modeBtnActive: {
    borderBottomWidth: 2, borderBottomColor: '#00d4aa',
  },
  modeBtnText: { fontSize: 14, color: '#a1a1aa', fontWeight: '500' },
  modeBtnTextActive: { color: '#00d4aa', fontWeight: '700' },

  // Email input
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, padding: 16, marginBottom: 16,
  },
  emailInput: { flex: 1, fontSize: 16, color: COLORS.text },
  hintBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: 'rgba(0,212,170,0.08)', padding: 12, borderRadius: 12,
  },
  hintText: { flex: 1, fontSize: 13, color: '#00d4aa', marginLeft: 8, lineHeight: 18 },

  contactsLoading: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, color: '#a1a1aa' },

  // Contact search
  contactSearchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
  },
  contactSearch: { flex: 1, fontSize: 15, color: COLORS.text },

  // Contact rows
  contactRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a24', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 12, marginBottom: 6,
  },
  contactRowAdded: { opacity: 0.45 },
  contactInfo: { flex: 1, marginLeft: 12 },
  contactName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  contactDetail: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  alreadyBadge: {
    backgroundColor: 'rgba(0,212,170,0.1)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  alreadyText: { fontSize: 12, color: '#00d4aa', fontWeight: '600' },
  addContactBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,212,170,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  noContacts: { textAlign: 'center', color: '#a1a1aa', paddingVertical: 40 },

  requestsSection: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  requestsSectionTitle: {
    fontSize: 12, fontWeight: '700', color: COLORS.textLight,
    marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6,
  },
  requestCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 14,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.primary + '40',
  },
  requestInfo: { flex: 1, marginLeft: 12 },
  requestName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  requestEmail: { fontSize: 13, color: COLORS.textLight, marginTop: 1 },
  requestMeta: { fontSize: 12, color: COLORS.primary, marginTop: 2 },
  requestActions: { flexDirection: 'column', gap: 6 },
  acceptBtn: {
    backgroundColor: COLORS.primary, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 6, alignItems: 'center',
  },
  acceptBtnText: { fontSize: 13, fontWeight: '700', color: '#0a0a0f' },
  declineBtn: {
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  declineBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
});

export default FriendsScreen;
