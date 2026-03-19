import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, Modal, TextInput, ActivityIndicator, SectionList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS } from '../constants/colors';
import Avatar from '../components/Avatar';
import { addFriend, registerUser } from '../services/storage';
import { getContacts, requestContactsPermission, sendWhatsAppMessage } from '../services/contacts';
import { formatAmount } from '../services/currency';

const FriendsScreen = ({ navigation }) => {
  const { user, friends, balances, currency, refresh } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState('email'); // email | contacts
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const handleAddFriend = async () => {
    if (!email.trim()) return;
    setAdding(true);
    try {
      await addFriend(user.id, email.trim().toLowerCase());
      setEmail(''); setShowAdd(false);
      refresh();
      Alert.alert('Friend Added!', 'They can now be added to groups and expenses.');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally { setAdding(false); }
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
      Alert.alert(
        'No Email Found',
        `${contact.name} doesn't have an email in your contacts. Would you like to invite them via WhatsApp?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'WhatsApp Invite',
            onPress: () => contact.phone && sendWhatsAppMessage(
              contact.phone,
              `Hey ${contact.name}! I'm using SplitWise to split expenses. Join me! 💸`
            ),
          },
        ]
      );
      return;
    }
    setAdding(true);
    try {
      await addFriend(user.id, contact.email);
      refresh();
      Alert.alert('Added!', `${contact.name} added as friend`);
    } catch (e) {
      // If user not found, offer to create them
      Alert.alert(
        'Not Registered',
        `${contact.name} isn't on SplitWise yet. Invite via WhatsApp?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'WhatsApp',
            onPress: () => contact.phone && sendWhatsAppMessage(
              contact.phone,
              `Hey ${contact.name}! Join me on SplitWise to split expenses easily! 💸`
            ),
          },
        ]
      );
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
      ? `Hey ${friend.name}! Just a reminder, you owe me ${formatAmount(amount, currency)} on SplitWise. 💸`
      : `Hey ${friend.name}! I owe you ${formatAmount(amount, currency)}. Will settle soon! 💸`;
    sendWhatsAppMessage(friend.phone, msg);
  };

  const renderFriend = ({ item }) => {
    const balance = getFriendBalance(item.id);
    const hasBalance = balance && Math.abs(balance.amount) > 0.01;
    return (
      <TouchableOpacity
        style={styles.friendCard}
        onPress={() => navigation.navigate('FriendDetail', { friend: item, balance })}
      >
        <Avatar name={item.name} avatar={item.avatar} size={48} />
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{item.name}</Text>
          <Text style={styles.friendEmail}>{item.email}</Text>
          {item.phone && <Text style={styles.friendPhone}>{item.phone}</Text>}
        </View>
        <View style={styles.rightCol}>
          <View style={styles.balanceContainer}>
            {hasBalance ? (
              <>
                <Text style={[styles.balanceLabel, { color: balance.amount > 0 ? COLORS.success : COLORS.negative }]}>
                  {balance.amount > 0 ? 'owes you' : 'you owe'}
                </Text>
                <Text style={[styles.balanceAmount, { color: balance.amount > 0 ? COLORS.success : COLORS.negative }]}>
                  {formatAmount(Math.abs(balance.amount), currency)}
                </Text>
              </>
            ) : (
              <Text style={styles.settledUp}>settled up</Text>
            )}
          </View>
          {item.phone && (
            <TouchableOpacity style={styles.waBtn} onPress={() => handleWhatsAppBalance(item)}>
              <Text style={styles.waIcon}>💬</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const totalOwed = balances.filter(b => b.amount > 0).reduce((s, b) => s + b.amount, 0);
  const totalOwing = balances.filter(b => b.amount < 0).reduce((s, b) => s + Math.abs(b.amount), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Friends</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setShowAdd(true); setAddMode('email'); }}>
          <Ionicons name="person-add" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {(totalOwed > 0 || totalOwing > 0) && (
        <View style={styles.summaryRow}>
          {totalOwed > 0 && (
            <View style={[styles.summaryCard, { backgroundColor: '#E8FAF6' }]}>
              <Text style={styles.summaryLabel}>You are owed</Text>
              <Text style={[styles.summaryAmount, { color: COLORS.success }]}>{formatAmount(totalOwed, currency)}</Text>
            </View>
          )}
          {totalOwing > 0 && (
            <View style={[styles.summaryCard, { backgroundColor: '#FFF0EE' }]}>
              <Text style={styles.summaryLabel}>You owe</Text>
              <Text style={[styles.summaryAmount, { color: COLORS.negative }]}>{formatAmount(totalOwing, currency)}</Text>
            </View>
          )}
        </View>
      )}

      {friends.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>No friends yet</Text>
          <Text style={styles.emptyText}>Add friends by email or import from contacts</Text>
          <View style={styles.emptyBtns}>
            <TouchableOpacity style={styles.addFriendBtn} onPress={() => { setShowAdd(true); setAddMode('email'); }}>
              <Ionicons name="mail" size={16} color="#fff" />
              <Text style={styles.addFriendBtnText}>Add by Email</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.addFriendBtn, { backgroundColor: '#25D366' }]} onPress={() => { setShowAdd(true); setAddMode('contacts'); loadContacts(); }}>
              <Ionicons name="people" size={16} color="#fff" />
              <Text style={styles.addFriendBtnText}>From Contacts</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={item => item.id}
          renderItem={renderFriend}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            <TouchableOpacity style={styles.importContactsRow} onPress={() => { setShowAdd(true); setAddMode('contacts'); loadContacts(); }}>
              <Ionicons name="people" size={18} color={COLORS.primary} />
              <Text style={styles.importContactsText}>Import from Contacts</Text>
            </TouchableOpacity>
          }
        />
      )}

      {/* Add Friend Modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowAdd(false); setEmail(''); setContacts([]); setContactSearch(''); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Friend</Text>
            {addMode === 'email' ? (
              <TouchableOpacity onPress={handleAddFriend} disabled={adding || !email.trim()}>
                {adding ? <ActivityIndicator color={COLORS.primary} size="small" /> : (
                  <Text style={[styles.saveText, !email.trim() && { opacity: 0.4 }]}>Add</Text>
                )}
              </TouchableOpacity>
            ) : <View style={{ width: 40 }} />}
          </View>

          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, addMode === 'email' && styles.modeBtnActive]}
              onPress={() => setAddMode('email')}
            >
              <Ionicons name="mail" size={16} color={addMode === 'email' ? '#fff' : COLORS.textLight} />
              <Text style={[styles.modeBtnText, addMode === 'email' && styles.modeBtnTextActive]}>By Email</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, addMode === 'contacts' && styles.modeBtnActive]}
              onPress={() => { setAddMode('contacts'); if (contacts.length === 0) loadContacts(); }}
            >
              <Ionicons name="people" size={16} color={addMode === 'contacts' ? '#fff' : COLORS.textLight} />
              <Text style={[styles.modeBtnText, addMode === 'contacts' && styles.modeBtnTextActive]}>Contacts</Text>
            </TouchableOpacity>
          </View>

          {addMode === 'email' ? (
            <>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={20} color={COLORS.textLight} style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.emailInput}
                  placeholder="Enter friend's email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoFocus
                  placeholderTextColor={COLORS.textMuted}
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
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.text },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  summaryRow: { flexDirection: 'row', margin: 16, gap: 10 },
  summaryCard: { flex: 1, borderRadius: 12, padding: 14 },
  summaryLabel: { fontSize: 12, color: COLORS.textLight, marginBottom: 4 },
  summaryAmount: { fontSize: 20, fontWeight: '700' },
  friendCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    marginHorizontal: 16, marginTop: 10, borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  friendInfo: { flex: 1, marginLeft: 12 },
  friendName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  friendEmail: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  friendPhone: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  rightCol: { alignItems: 'flex-end', gap: 6 },
  balanceContainer: { alignItems: 'flex-end' },
  balanceLabel: { fontSize: 12, fontWeight: '500' },
  balanceAmount: { fontSize: 16, fontWeight: '700' },
  settledUp: { fontSize: 13, color: COLORS.textMuted, fontStyle: 'italic' },
  waBtn: { backgroundColor: '#E8FFF0', borderRadius: 20, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  waIcon: { fontSize: 16 },
  importContactsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, margin: 16, backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed' },
  importContactsText: { color: COLORS.primary, fontWeight: '600', marginLeft: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginTop: 16 },
  emptyText: { fontSize: 15, color: COLORS.textLight, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  emptyBtns: { flexDirection: 'row', gap: 12, marginTop: 20 },
  addFriendBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11 },
  addFriendBtnText: { color: '#fff', fontWeight: '700', marginLeft: 6, fontSize: 13 },
  modal: { flex: 1, backgroundColor: COLORS.white, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  cancelText: { fontSize: 16, color: COLORS.textLight },
  saveText: { fontSize: 16, color: COLORS.primary, fontWeight: '700' },
  modeToggle: { flexDirection: 'row', backgroundColor: COLORS.background, borderRadius: 12, padding: 4, marginBottom: 20 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
  modeBtnActive: { backgroundColor: COLORS.primary },
  modeBtnText: { fontSize: 14, color: COLORS.textLight, fontWeight: '500' },
  modeBtnTextActive: { color: '#fff', fontWeight: '700' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background,
    borderRadius: 14, padding: 16, marginBottom: 16,
  },
  emailInput: { flex: 1, fontSize: 16, color: COLORS.text },
  hintBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.primaryLight, padding: 12, borderRadius: 10 },
  hintText: { flex: 1, fontSize: 13, color: COLORS.primary, marginLeft: 8, lineHeight: 18 },
  contactsLoading: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, color: COLORS.textLight },
  contactSearchRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
  },
  contactSearch: { flex: 1, fontSize: 15, color: COLORS.text },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  contactRowAdded: { opacity: 0.5 },
  contactInfo: { flex: 1, marginLeft: 12 },
  contactName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  contactDetail: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  alreadyBadge: { backgroundColor: COLORS.primaryLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  alreadyText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  addContactBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  noContacts: { textAlign: 'center', color: COLORS.textLight, paddingVertical: 40 },
});

export default FriendsScreen;
