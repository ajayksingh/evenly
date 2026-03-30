import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Modal, SectionList, Platform, StatusBar,
  Animated, Image, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS } from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { themedAlert } from '../components/ThemedAlert';
import Avatar from '../components/Avatar';
import BackgroundOrbs from '../components/BackgroundOrbs';
import { addFriend, respondToFriendRequest, getSuggestedFriendsFromGroups, getPendingInvites, savePendingInvite } from '../services/storage';
import { sendWhatsAppMessage, buildInviteMessage, buildWhatsAppInviteMessage } from '../services/contacts';
import { formatAmount } from '../services/currency';
import { shareOrCopy } from '../utils/share';
import Skeleton from '../components/Skeleton';
import AddPeopleModal from '../components/AddPeopleModal';
import { rPadding, rWidth } from '../utils/responsive';

const INVITE_BASE_URL = 'https://ajayksingh.github.io/evenly/';

const FriendsScreen = ({ navigation }) => {
  const { theme, colorScheme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { user, friends, balances, currency, refresh, friendRequests } = useApp();

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerBg = scrollY.interpolate({ inputRange: [0, 80], outputRange: [theme.headerBgTransparent, theme.headerBg], extrapolate: 'clamp' });
  const headerBorder = scrollY.interpolate({ inputRange: [0, 80], outputRange: ['transparent', theme.border], extrapolate: 'clamp' });

  // Modal state
  const [showAdd, setShowAdd] = useState(false);
  const [respondingTo, setRespondingTo] = useState(null);

  // Suggested friends (for horizontal bar on main screen)
  const [suggestedFriends, setSuggestedFriends] = useState([]);

  // Pending invites (Feature #6)
  const [pendingInvites, setPendingInvites] = useState([]);

  // QR Code modal (Feature #3)
  const [showQR, setShowQR] = useState(false);

  const inviteLink = user ? `${INVITE_BASE_URL}?invite=${user.id}` : '';

  useFocusEffect(useCallback(() => {
    refresh();
    loadPendingInvites();
    loadSuggestions();
  }, [refresh]));

  // Load pending invites
  const loadPendingInvites = async () => {
    const invites = await getPendingInvites();
    setPendingInvites(invites);
  };

  // Load suggestions (Feature #7)
  const loadSuggestions = async () => {
    if (!user) return;
    try {
      const suggestions = await getSuggestedFriendsFromGroups(user.id);
      setSuggestedFriends(suggestions);
    } catch (e) {
      console.error('Load suggestions error:', e);
    }
  };

  // handleAddFriend for suggestions bar on main screen
  const handleAddFriend = async (targetEmail) => {
    if (!targetEmail) return;
    try {
      await addFriend(user.id, targetEmail);
      refresh();
      loadPendingInvites();
      themedAlert('Request Sent!', 'They will be notified and can accept your friend request.', 'success');
    } catch (e) {
      if (e.message?.includes('No user found') || e.message?.includes('not found')) {
        await savePendingInvite(targetEmail, user.id);
        loadPendingInvites();
        themedAlert('User Not Found', `${targetEmail} hasn't joined Evenly yet. Saved as pending invite.`, 'warning');
      } else {
        themedAlert('Error', e.message, 'error');
      }
    }
  };

  const handleRespondToRequest = async (requestId, accept) => {
    setRespondingTo(requestId);
    try {
      await respondToFriendRequest(requestId, accept, user.id);
      refresh();
      if (accept) themedAlert('Friend Added!', 'You are now friends and can split expenses together.', 'success');
    } catch (e) {
      themedAlert('Error', e.message, 'error');
    } finally {
      setRespondingTo(null);
    }
  };

  // Feature #2: Share invite link
  const handleShareInvite = async () => {
    try {
      const result = await shareOrCopy({
        message: buildInviteMessage(user?.name, inviteLink),
        title: 'Join me on Evenly',
      });
      if (result === 'copied') {
        themedAlert('Link copied!', 'Share it with your friends', 'success');
      }
    } catch (e) {
      themedAlert('Error', 'Could not share invite link', 'error');
    }
  };

  // Feature #6: Resend pending invite
  const handleResendInvite = () => {
    handleShareInvite();
  };

  // Feature #8: WhatsApp invite
  const handleWhatsAppInvite = (phone) => {
    const msg = buildWhatsAppInviteMessage(user?.name, inviteLink);
    if (phone) {
      sendWhatsAppMessage(phone, msg);
    } else {
      handleShareInvite();
    }
  };

  const getFriendBalance = (friendId) => balances.find(b => b.userId === friendId);

  const handleWhatsAppBalance = (friend) => {
    const balance = getFriendBalance(friend.id);
    if (!friend.phone) {
      themedAlert('No Phone', `No phone number for ${friend.name}`, 'warning');
      return;
    }
    const amount = Math.abs(balance?.amount || 0);
    const msg = balance?.amount > 0
      ? `Hey ${friend.name}! Just a reminder, you owe me ${formatAmount(amount, currency)} on Evenly. \u{1F4B8}`
      : `Hey ${friend.name}! I owe you ${formatAmount(amount, currency)}. Will settle soon! \u{1F4B8}`;
    sendWhatsAppMessage(friend.phone, msg);
  };

  const renderFriend = ({ item }) => {
    const balance = getFriendBalance(item.id);
    const hasBalance = balance && Math.abs(balance.amount) > 0.01;
    const owesThem = balance && balance.amount < 0;
    const owesUs = balance && balance.amount > 0;
    return (
      <View
        testID="friend-card"
        accessibilityLabel={`Friend: ${item.name}`}
        style={styles.friendCard}
      >
        <Avatar name={item.name} avatar={item.avatar} size={44} />
        <View style={styles.friendInfo}>
          <Text style={styles.friendName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.friendEmail} numberOfLines={1}>{item.email}</Text>
          {item.phone && <Text style={styles.friendPhone} numberOfLines={1}>{item.phone}</Text>}
        </View>
        <View style={styles.rightCol}>
          <View style={styles.balanceContainer}>
            {hasBalance ? (
              <>
                <Text style={[styles.balanceLabel, { color: balance.amount > 0 ? theme.primary : theme.negative }]} numberOfLines={1}>
                  {balance.amount > 0 ? 'owes you' : 'you owe'}
                </Text>
                <Text style={[styles.balanceAmount, { color: balance.amount > 0 ? theme.primary : theme.negative }]} numberOfLines={1}>
                  {formatAmount(Math.abs(balance.amount), currency)}
                </Text>
              </>
            ) : balance ? (
              <Text style={styles.settledUp}>all square</Text>
            ) : (
              <Text style={[styles.settledUp, { color: theme.textMuted }]}>no expenses yet</Text>
            )}
          </View>
          {/* BUG-008: Action buttons */}
          <View style={styles.actionRow}>
            {owesUs && (
              <TouchableOpacity
                accessibilityLabel={`Remind ${item.name}`}
                activeOpacity={0.7}
                style={styles.remindPill}
                onPress={() => handleWhatsAppBalance(item)}
              >
                <Text style={styles.remindPillText}>Remind</Text>
              </TouchableOpacity>
            )}
            {owesThem && (
              <TouchableOpacity
                accessibilityLabel={`Settle up with ${item.name}`}
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
              <TouchableOpacity accessibilityLabel={`Message ${item.name} on WhatsApp`} activeOpacity={0.7} style={styles.waBtn} onPress={() => handleWhatsAppBalance(item)}>
                <Text style={styles.waIcon}>{'\u{1F4AC}'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderFriendRequest = ({ item }) => (
    <View style={styles.requestCard}>
      <Avatar name={item.senderName} size={44} />
      <View style={styles.requestInfo}>
        <Text style={styles.requestName} numberOfLines={1}>{item.senderName}</Text>
        <Text style={styles.requestEmail} numberOfLines={1}>{item.senderEmail}</Text>
        <Text style={styles.requestMeta}>wants to be friends</Text>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          accessibilityLabel={`Accept friend request from ${item.senderName}`}
          activeOpacity={0.7}
          style={styles.acceptBtn}
          disabled={respondingTo === item.id}
          onPress={() => handleRespondToRequest(item.id, true)}
        >
          <Text style={styles.acceptBtnText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel={`Decline friend request from ${item.senderName}`}
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

  // Feature #6: Render pending invite card
  const renderPendingInvite = (invite) => (
    <View key={invite.email} style={styles.pendingCard}>
      <View style={styles.pendingIcon}>
        <Ionicons name="hourglass-outline" size={20} color="#ffd93d" />
      </View>
      <View style={styles.pendingInfo}>
        <Text style={styles.pendingEmail} numberOfLines={1}>{invite.email}</Text>
        <Text style={styles.pendingStatus}>Invited - awaiting signup</Text>
      </View>
      <TouchableOpacity
        testID="resend-invite-btn"
        accessibilityLabel={`Resend invite to ${invite.email}`}
        activeOpacity={0.7}
        style={styles.resendBtn}
        onPress={() => handleResendInvite(invite.email)}
      >
        <Ionicons name="share-outline" size={14} color="#00d4aa" />
        <Text style={styles.resendBtnText}>Resend</Text>
      </TouchableOpacity>
    </View>
  );

  // Feature #7: Suggestions horizontal scroll
  const renderSuggestionsBar = () => {
    if (suggestedFriends.length === 0) return null;
    return (
      <View style={styles.suggestionsSection}>
        <Text style={styles.suggestionsSectionTitle}>People you may know</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
          {suggestedFriends.map(s => (
            <TouchableOpacity
              key={s.id}
              testID="suggestion-card"
              accessibilityLabel={`Add suggested friend ${s.name}`}
              activeOpacity={0.7}
              style={styles.suggestionCard}
              onPress={() => handleAddFriend(s.email)}
            >
              <Avatar name={s.name} avatar={s.avatar} size={40} />
              <Text style={styles.suggestionName} numberOfLines={1}>{s.name}</Text>
              <Text style={styles.suggestionEmail} numberOfLines={1}>{s.email}</Text>
              <View style={styles.suggestionAddBtn}>
                <Ionicons name="person-add-outline" size={14} color="#00d4aa" />
                <Text style={styles.suggestionAddText}>Add</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // BUG-006 + BUG-007: Single-pass partition of friends by balance category
  const { oweYouFriends, youOweFriends, allSquareFriends, noHistoryFriends, oweYouCount, youOweCount, settledCount } = useMemo(() => {
    const owe = [], you = [], square = [], noHist = [];
    friends.forEach(f => {
      const b = getFriendBalance(f.id);
      if (b && b.amount > 0) owe.push(f);
      else if (b && b.amount < 0) you.push(f);
      else if (b && Math.abs(b.amount) <= 0.01) square.push(f);
      else noHist.push(f);
    });
    return { oweYouFriends: owe, youOweFriends: you, allSquareFriends: square, noHistoryFriends: noHist, oweYouCount: owe.length, youOweCount: you.length, settledCount: square.length + noHist.length };
  }, [friends, balances]);

  const sections = useMemo(() => [
    ...(oweYouFriends.length > 0 ? [{ title: 'People who owe you', data: oweYouFriends }] : []),
    ...(youOweFriends.length > 0 ? [{ title: 'People you owe', data: youOweFriends }] : []),
    ...(allSquareFriends.length > 0 ? [{ title: 'All square', data: allSquareFriends }] : []),
    ...(noHistoryFriends.length > 0 ? [{ title: 'No balance', data: noHistoryFriends }] : []),
  ], [oweYouFriends, youOweFriends, allSquareFriends, noHistoryFriends]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <BackgroundOrbs />
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <Animated.View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: headerBorder }]}>
        <Text style={styles.title}>Friends</Text>
        <View style={styles.headerRight}>
          {/* Feature #3: QR Code button */}
          <TouchableOpacity testID="qr-code-btn" accessibilityLabel="Show QR code" activeOpacity={0.7} style={styles.headerIconBtn} onPress={() => setShowQR(true)}>
            <Ionicons name="qr-code" size={18} color={theme.primary} />
          </TouchableOpacity>
          {/* Feature #2: Share invite link */}
          <TouchableOpacity testID="share-invite-btn" accessibilityLabel="Share invite link" activeOpacity={0.7} style={styles.headerIconBtn} onPress={handleShareInvite}>
            <Ionicons name="share-outline" size={18} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity testID="friends-add-btn" accessibilityLabel="Add friend" activeOpacity={0.7} style={styles.addBtn} onPress={() => setShowAdd(true)}>
            <Ionicons name="person-add" size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* BUG-006: 3-column summary grid with counts */}
      {friends.length > 0 && (
        <View style={styles.summaryGrid}>
          <View style={[styles.statCard, styles.statCardOweYou]}>
            <Text style={[styles.statCount, { color: theme.primary }]}>{oweYouCount}</Text>
            <Text style={styles.statLabel}>owe you</Text>
          </View>
          <View style={[styles.statCard, styles.statCardYouOwe]}>
            <Text style={[styles.statCount, { color: theme.negative }]}>{youOweCount}</Text>
            <Text style={styles.statLabel}>you owe</Text>
          </View>
          <View style={[styles.statCard, styles.statCardSettled]}>
            <Text style={[styles.statCount, { color: theme.neutral }]}>{settledCount}</Text>
            <Text style={styles.statLabel}>no balance</Text>
          </View>
        </View>
      )}

      {/* Feature #7: Suggestions horizontal bar */}
      {renderSuggestionsBar()}

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
            removeClippedSubviews={Platform.OS !== 'web'}
            maxToRenderPerBatch={10}
          />
        </View>
      )}

      {/* Feature #6: Pending invites */}
      {pendingInvites.length > 0 && (
        <View style={styles.pendingSection}>
          <Text style={styles.requestsSectionTitle}>
            Pending Invites ({pendingInvites.length})
          </Text>
          {pendingInvites.map(renderPendingInvite)}
        </View>
      )}

      {friends.length === 0 && friendRequests.length === 0 && pendingInvites.length === 0 ? (
        /* Skeleton loading state — shown when friends haven't loaded yet */
        <View style={{ padding: 16 }}>
          <Skeleton width="100%" height={70} borderRadius={16} style={{ marginBottom: 10 }} />
          <Skeleton width="100%" height={70} borderRadius={16} style={{ marginBottom: 10 }} />
          <Skeleton width="100%" height={70} borderRadius={16} style={{ marginBottom: 10 }} />
        </View>
      ) : friends.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>{'\u{1F465}'}</Text>
            <Text style={styles.emptyTitle}>No friends yet</Text>
            <Text style={styles.emptyText}>Add friends by email or import from contacts to start splitting expenses</Text>
            <View style={styles.emptyBtns}>
              <TouchableOpacity accessibilityLabel="Search and add friends" activeOpacity={0.7} style={styles.addFriendBtn} onPress={() => setShowAdd(true)}>
                <Ionicons name="search" size={16} color="#fff" />
                <Text style={styles.addFriendBtnText}>Search & Add</Text>
              </TouchableOpacity>
              {/* Feature #2: Share invite link in empty state */}
              <TouchableOpacity testID="empty-share-invite-btn" accessibilityLabel="Share invite link" activeOpacity={0.7} style={[styles.addFriendBtn, { backgroundColor: theme.primaryLight }]} onPress={handleShareInvite}>
                <Ionicons name="link" size={16} color="#00d4aa" />
                <Text style={styles.addFriendBtnText}>Share Invite Link</Text>
              </TouchableOpacity>
              {/* Feature #8: WhatsApp invite in empty state */}
              <TouchableOpacity testID="empty-whatsapp-invite-btn" accessibilityLabel="Invite via WhatsApp" activeOpacity={0.7} style={[styles.addFriendBtn, { backgroundColor: 'rgba(37,211,102,0.18)' }]} onPress={() => handleWhatsAppInvite()}>
                <Text style={{ fontSize: 16 }}>{'\u{1F4AC}'}</Text>
                <Text style={[styles.addFriendBtnText, { color: '#25D366' }]}>Invite via WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        /* BUG-007: Categorized SectionList */
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderItem={renderFriend}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          renderSectionHeader={({ section: { title } }) => {
            const dotColor =
              title === 'People who owe you' ? theme.primary
              : title === 'People you owe' ? theme.negative
              : theme.neutral;
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
              <TouchableOpacity activeOpacity={0.7} style={styles.importContactsRow} onPress={() => setShowAdd(true)}>
                <Ionicons name="people" size={18} color={theme.primary} />
                <Text style={styles.importContactsText}>Import from Contacts</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {/* Unified Add People Modal */}
      <AddPeopleModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        mode="friend"
        onPersonAdded={() => { refresh(); loadPendingInvites(); }}
      />

      {/* Feature #3: QR Code Modal */}
      <Modal visible={showQR} animationType="fade" transparent>
        <TouchableOpacity activeOpacity={1} style={styles.qrOverlay} onPress={() => setShowQR(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.qrModal} onPress={() => {}}>
            <View style={styles.qrHeader}>
              <Text style={styles.qrTitle}>My QR Code</Text>
              <TouchableOpacity testID="qr-close-btn" activeOpacity={0.7} onPress={() => setShowQR(false)}>
                <Ionicons name="close-circle" size={28} color={theme.textLight} />
              </TouchableOpacity>
            </View>
            <Text style={styles.qrSubtitle}>Scan to add me as a friend</Text>
            <View style={styles.qrImageContainer}>
              <Image
                testID="qr-code-image"
                source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(inviteLink)}&size=200x200&bgcolor=1a1a24&color=00d4aa&format=png` }}
                style={styles.qrImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.qrName}>{user?.name || 'Me'}</Text>
            <Text style={styles.qrEmail} numberOfLines={1}>{user?.email || ''}</Text>

            <View style={styles.qrActions}>
              <TouchableOpacity testID="qr-share-btn" activeOpacity={0.7} style={styles.qrShareBtn} onPress={handleShareInvite}>
                <Ionicons name="share-outline" size={18} color="#00d4aa" />
                <Text style={styles.qrShareText}>Share Link</Text>
              </TouchableOpacity>
              {Platform.OS === 'web' && (
                <View style={styles.qrLinkBox}>
                  <Text style={styles.qrLinkText} selectable numberOfLines={1}>{inviteLink}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,212,170,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: '700', color: theme.text, letterSpacing: -0.5 },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },

  // Summary stat cards
  summaryGrid: { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, marginBottom: 8, gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  statCardOweYou: { borderTopWidth: 2, borderTopColor: theme.primary },
  statCardYouOwe: { borderTopWidth: 2, borderTopColor: theme.negative },
  statCardSettled: { borderTopWidth: 2, borderTopColor: theme.neutral },
  statCount: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 11, color: theme.textLight, marginTop: 4 },

  // Feature #7: Suggestions horizontal bar
  suggestionsSection: { marginTop: 12, marginBottom: 4 },
  suggestionsSectionTitle: {
    fontSize: 12, fontWeight: '700', color: theme.textLight,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginHorizontal: 16, marginBottom: 10,
  },
  suggestionsScroll: { paddingHorizontal: 16, gap: 10 },
  suggestionCard: {
    backgroundColor: theme.card,
    borderRadius: 16, padding: 14,
    alignItems: 'center', minWidth: rWidth(120, 100),
    borderWidth: 1, borderColor: theme.border,
  },
  suggestionName: { fontSize: 13, fontWeight: '600', color: theme.text, marginTop: 8, textAlign: 'center' },
  suggestionEmail: { fontSize: 11, color: theme.textLight, marginTop: 2, textAlign: 'center' },
  suggestionAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.primaryLight,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 8,
  },
  suggestionAddText: { fontSize: 12, fontWeight: '600', color: theme.primary },

  // Section headers
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 20, marginBottom: 6,
  },
  sectionDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  sectionHeader: {
    fontSize: 12, fontWeight: '700', color: theme.textLight,
    textTransform: 'uppercase', letterSpacing: 1,
  },

  // Friend balance cards
  friendCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card,
    marginHorizontal: rPadding(16, 12, 10), marginBottom: 8, borderRadius: 20, padding: rPadding(16, 12, 10),
    borderWidth: 1, borderColor: theme.border,
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08, shadowRadius: 16,
  },
  friendInfo: { flex: 1, minWidth: 0, marginLeft: 12 },
  friendName: { fontSize: 15, fontWeight: '600', color: theme.text },
  friendEmail: { fontSize: 13, color: theme.textLight, marginTop: 2 },
  friendPhone: { fontSize: 12, color: theme.neutral, marginTop: 1 },
  rightCol: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  balanceContainer: { alignItems: 'flex-end' },
  balanceLabel: { fontSize: 12, fontWeight: '500' },
  balanceAmount: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'], flexShrink: 0 },
  settledUp: { fontSize: 12, color: theme.neutral },

  // Action pill buttons
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  remindPill: {
    backgroundColor: theme.inputBg,
    borderRadius: 999, height: 30, paddingHorizontal: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  remindPillText: { fontSize: 12, fontWeight: '600', color: theme.textLight },
  settlePill: {
    backgroundColor: theme.primaryLight,
    borderRadius: 999, height: 30, paddingHorizontal: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  settlePillText: { fontSize: 12, fontWeight: '600', color: theme.primary },
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
    backgroundColor: theme.card, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(0,212,170,0.2)', borderStyle: 'dashed',
  },
  importContactsText: { color: theme.primary, fontWeight: '600', marginLeft: 8 },

  // Empty state
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyCard: {
    backgroundColor: theme.card, borderRadius: 24, padding: rPadding(32, 24, 20),
    alignItems: 'center', width: '100%',
    borderWidth: 1, borderColor: theme.border,
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1, shadowRadius: 16,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: theme.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: theme.textLight, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtns: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  addFriendBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.primaryLight,
    borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11,
  },
  addFriendBtnText: { color: theme.primary, fontWeight: '700', marginLeft: 6, fontSize: 13 },

  // Feature #6: Pending invites
  pendingSection: { marginHorizontal: 16, marginBottom: 8 },
  pendingCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.card, borderRadius: 14,
    padding: 14, marginBottom: 6,
    borderWidth: 1, borderColor: 'rgba(255,215,61,0.2)',
  },
  pendingIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,215,61,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  pendingInfo: { flex: 1, marginLeft: 12 },
  pendingEmail: { fontSize: 14, fontWeight: '600', color: theme.text },
  pendingStatus: { fontSize: 12, color: theme.warning, marginTop: 2 },
  resendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.primaryLight,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
  },
  resendBtnText: { fontSize: 12, fontWeight: '600', color: theme.primary },

  // Add Friend Modal
  modal: {
    flex: 1, backgroundColor: theme.card, padding: 20,
    borderTopLeftRadius: Platform.OS === 'ios' ? 28 : 0,
    borderTopRightRadius: Platform.OS === 'ios' ? 28 : 0,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
  cancelText: { fontSize: 16, color: theme.textLight },
  saveText: { fontSize: 16, color: theme.primary, fontWeight: '700' },

  // Tab toggle
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: theme.background,
    borderRadius: 12, padding: 4, marginBottom: 16,
  },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 10, gap: 6,
  },
  modeBtnActive: {
    borderBottomWidth: 2, borderBottomColor: theme.primary,
  },
  modeBtnText: { fontSize: 14, color: theme.textLight, fontWeight: '500' },
  modeBtnTextActive: { color: theme.primary, fontWeight: '700' },

  // Feature #8: WhatsApp invite row in modal
  whatsappInviteRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(37,211,102,0.1)',
    borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(37,211,102,0.2)',
  },
  whatsappInviteText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#25D366', marginLeft: 10 },

  // Email/Search input
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

  contactsLoading: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, color: theme.textLight, textAlign: 'center', paddingHorizontal: 20 },

  // Contact search
  contactSearchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.inputBg,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
  },
  contactSearch: { flex: 1, fontSize: 15, color: theme.text },

  // Feature #1: Batch add button
  batchAddBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.primary, borderRadius: 12,
    paddingVertical: 12, marginBottom: 12, gap: 8,
  },
  batchAddBtnText: { fontSize: 14, fontWeight: '700', color: theme.background },

  // Feature #1: Checkbox
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: theme.textMuted,
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  checkboxSelected: {
    backgroundColor: theme.primary, borderColor: theme.primary,
  },

  // Contact rows
  contactRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.card, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 12, marginBottom: 6,
  },
  contactRowAdded: { opacity: 0.45 },
  contactInfo: { flex: 1, marginLeft: 12 },
  contactName: { fontSize: 15, fontWeight: '600', color: theme.text },
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

  // Feature #3: QR Code Modal
  qrOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  qrModal: {
    backgroundColor: theme.card, borderRadius: 24, padding: 28,
    alignItems: 'center', width: '100%', maxWidth: '90%',
    borderWidth: 1, borderColor: theme.border,
  },
  qrHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', marginBottom: 4,
  },
  qrTitle: { fontSize: 20, fontWeight: '700', color: theme.text },
  qrSubtitle: { fontSize: 13, color: theme.textLight, marginBottom: 20, alignSelf: 'flex-start' },
  qrImageContainer: {
    backgroundColor: theme.card, borderRadius: 16, padding: 16,
    marginBottom: 16,
  },
  qrImage: { width: 200, height: 200 },
  qrName: { fontSize: 18, fontWeight: '700', color: theme.text },
  qrEmail: { fontSize: 13, color: theme.textLight, marginTop: 4 },
  qrActions: { marginTop: 20, width: '100%', alignItems: 'center', gap: 12 },
  qrShareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.primaryLight,
    borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12,
  },
  qrShareText: { fontSize: 14, fontWeight: '700', color: theme.primary },
  qrLinkBox: {
    backgroundColor: theme.inputBg,
    borderRadius: 10, padding: 10, width: '100%',
  },
  qrLinkText: { fontSize: 12, color: theme.textLight, textAlign: 'center' },

  requestsSection: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  requestsSectionTitle: {
    fontSize: 12, fontWeight: '700', color: theme.textLight,
    marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6,
  },
  requestCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.white, borderRadius: 14,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: theme.primary + '40',
  },
  requestInfo: { flex: 1, marginLeft: 12 },
  requestName: { fontSize: 15, fontWeight: '600', color: theme.text },
  requestEmail: { fontSize: 13, color: theme.textLight, marginTop: 1 },
  requestMeta: { fontSize: 12, color: theme.primary, marginTop: 2 },
  requestActions: { flexDirection: 'column', gap: 6 },
  acceptBtn: {
    backgroundColor: theme.primary, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 6, alignItems: 'center',
  },
  acceptBtnText: { fontSize: 13, fontWeight: '700', color: theme.background },
  declineBtn: {
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6,
    alignItems: 'center', borderWidth: 1, borderColor: theme.border,
  },
  declineBtnText: { fontSize: 13, fontWeight: '600', color: theme.textMuted },
});

export default FriendsScreen;
