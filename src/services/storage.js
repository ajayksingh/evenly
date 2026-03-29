/**
 * Storage Service - Supabase as primary data store
 * All reads and writes go directly to Supabase.
 * AsyncStorage is only used for the current user session + demo account data.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';

const uuidv4 = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });

const KEYS = {
  CURRENT_USER: 'sw_current_user',
  // Legacy AsyncStorage keys kept for demo accounts only
  USERS: 'sw_users',
  GROUPS: 'sw_groups',
  EXPENSES: 'sw_expenses',
  FRIENDS: 'sw_friends',
  SETTLEMENTS: 'sw_settlements',
  ACTIVITY: 'sw_activity',
};

// AsyncStorage helpers (demo accounts + auth session only)
const getData = async (key) => {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : [];
  } catch { return []; }
};
const setData = async (key, data) => {
  try { await AsyncStorage.setItem(key, JSON.stringify(data)); }
  catch (e) { console.error('Storage error:', e); }
};

const isDemo = (userId) => typeof userId === 'string' && userId.startsWith('demo-');

// --- Auth rate limiting ---
const authAttempts = { count: 0, resetAt: 0 };
const checkAuthRateLimit = () => {
  const now = Date.now();
  if (now > authAttempts.resetAt) { authAttempts.count = 0; authAttempts.resetAt = now + 60000; }
  authAttempts.count++;
  if (authAttempts.count > 20) throw new Error('Too many attempts. Please wait a minute before trying again.');
};

// --- Auth ---
const DEMO_EMAILS = ['alice@demo.com', 'bob@demo.com', 'carol@demo.com'];

export const loginUser = async ({ email, password }) => {
  email = (email || '').trim();
  if (DEMO_EMAILS.includes(email)) {
    await seedDemoData();
    const users = await getData(KEYS.USERS);
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) throw new Error('Invalid demo credentials');
    const { password: _, ...safeUser } = user;
    await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(safeUser));
    return safeUser;
  }
  throw new Error('Please use Google Sign-In');
};

/**
 * Handle the OAuth session after Supabase auth state changes to SIGNED_IN.
 * Upserts the user profile into the users table and caches it locally.
 */
export const handleOAuthSession = async (session) => {
  if (!session?.user) throw new Error('No session');
  const { user } = session;
  const email = user.email;
  const name = user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0];
  const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
  const provider = user.app_metadata?.provider || 'oauth';

  const profile = {
    id: user.id,
    name,
    email,
    avatar,
    phone: '',
    createdAt: new Date().toISOString(),
  };

  await supabase.from('users').upsert({
    id: profile.id,
    name: profile.name,
    email: profile.email,
    avatar: profile.avatar,
    phone: '',
    provider,
    created_at: profile.createdAt,
  }, { onConflict: 'id', ignoreDuplicates: false });

  await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(profile));
  return profile;
};

export const logoutUser = async () => {
  if (supabase) await supabase.auth.signOut().catch(() => {});
  await AsyncStorage.removeItem(KEYS.CURRENT_USER);
};

export const getCurrentUser = async () => {
  try {
    const cached = await AsyncStorage.getItem(KEYS.CURRENT_USER);
    if (cached) return JSON.parse(cached);

    if (!isSupabaseConfigured()) return null;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data: userData } = await supabase.from('users').select('*').eq('id', session.user.id).single();
    let profile;
    if (userData) {
      profile = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        avatar: userData.avatar || null,
        phone: userData.phone || '',
        createdAt: userData.created_at,
      };
    } else {
      // Auth session exists but users row was deleted — recreate it using metadata
      const email = session.user.email;
      const name = session.user.user_metadata?.full_name || session.user.user_metadata?.name || email.split('@')[0];
      const avatar = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null;
      const provider = session.user.app_metadata?.provider || 'oauth';
      profile = { id: session.user.id, name, email, avatar, phone: '', createdAt: new Date().toISOString() };
      await supabase.from('users').upsert({ id: profile.id, name: profile.name, email: profile.email, avatar: profile.avatar, phone: '', provider, created_at: profile.createdAt });
    }
    await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(profile));
    return profile;
  } catch { return null; }
};

export const updateUserProfile = async (userId, updates) => {
  if (isDemo(userId)) {
    const users = await getData(KEYS.USERS);
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error('User not found');
    users[idx] = { ...users[idx], ...updates };
    await setData(KEYS.USERS, users);
    const { password: _, ...safeUser } = users[idx];
    await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(safeUser));
    return safeUser;
  }
  const { data, error } = await supabase.from('users').update({
    name: updates.name,
    avatar: updates.avatar || null,
    phone: updates.phone || '',
  }).eq('id', userId).select().single();
  if (error) throw new Error('Failed to update profile');
  const profile = { id: data.id, name: data.name, email: data.email, avatar: data.avatar || null, phone: data.phone || '', createdAt: data.created_at };
  await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(profile));
  return profile;
};

// --- Friends ---
export const addFriend = async (currentUserId, email) => {
  if (!email || !email.trim()) throw new Error('Email is required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Invalid email address');
  if (isDemo(currentUserId)) {
    const users = await getData(KEYS.USERS);
    const friend = users.find(u => u.email === email);
    if (!friend) throw new Error('No user found with that email.');
    if (friend.id === currentUserId) throw new Error("You can't add yourself");
    const friends = await getData(KEYS.FRIENDS);
    const exists = friends.find(f =>
      (f.userId === currentUserId && f.friendId === friend.id) ||
      (f.userId === friend.id && f.friendId === currentUserId)
    );
    if (exists) throw new Error('Already friends');
    const entry = { id: uuidv4(), userId: currentUserId, friendId: friend.id, createdAt: new Date().toISOString() };
    await setData(KEYS.FRIENDS, [...friends, entry]);
    const { password: _, ...safeFriend } = friend;
    return safeFriend;
  }

  const { data: remoteUser, error: findErr } = await supabase
    .from('users').select('id,name,email,avatar,phone').eq('email', email).maybeSingle();
  if (!remoteUser) throw new Error('No user found with that email. They need to register first.');
  if (remoteUser.id === currentUserId) throw new Error("You can't add yourself");

  const { data: existing } = await supabase.from('friends').select('id')
    .or(`and(user_id.eq.${currentUserId},friend_id.eq.${remoteUser.id}),and(user_id.eq.${remoteUser.id},friend_id.eq.${currentUserId})`)
    .maybeSingle();
  if (existing) throw new Error('Already friends');

  // Check for existing pending request
  const { data: existingReq } = await supabase.from('friend_requests')
    .select('id,status')
    .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${remoteUser.id}),and(sender_id.eq.${remoteUser.id},receiver_id.eq.${currentUserId})`)
    .maybeSingle();
  if (existingReq?.status === 'pending') throw new Error('Friend request already sent');
  if (existingReq?.status === 'accepted') throw new Error('Already friends');

  // Get current user info for the request record
  const { data: senderUser } = await supabase.from('users').select('name,email').eq('id', currentUserId).maybeSingle();

  const { error: reqError } = await supabase.from('friend_requests').insert({
    id: uuidv4(),
    sender_id: currentUserId,
    sender_name: senderUser?.name || 'Unknown',
    sender_email: senderUser?.email || '',
    receiver_id: remoteUser.id,
    status: 'pending',
    created_at: new Date().toISOString(),
  });
  if (reqError) throw new Error('Failed to send friend request');
  return { requested: true, id: remoteUser.id, name: remoteUser.name, email: remoteUser.email };
};

export const getFriends = async (userId) => {
  if (isDemo(userId)) {
    const friends = await getData(KEYS.FRIENDS);
    const users = await getData(KEYS.USERS);
    const friendIds = friends
      .filter(f => f.userId === userId || f.friendId === userId)
      .map(f => f.userId === userId ? f.friendId : f.userId);
    return users.filter(u => friendIds.includes(u.id)).map(({ password: _, ...u }) => u);
  }

  const { data: friendRows } = await supabase.from('friends').select('*')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
  const friendIds = (friendRows || []).map(f => f.user_id === userId ? f.friend_id : f.user_id);
  if (friendIds.length === 0) return [];
  const { data: users } = await supabase.from('users').select('id,name,email,avatar,phone').in('id', friendIds);
  return (users || []).map(u => ({ id: u.id, name: u.name, email: u.email, avatar: u.avatar || null, phone: u.phone || '' }));
};

export const getFriendRequests = async (userId) => {
  if (isDemo(userId)) return []; // Demo users use direct-add, no requests
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('friend_requests')
    .select('id,sender_id,sender_name,sender_email,status,created_at')
    .eq('receiver_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data || []).map(r => ({
    id: r.id,
    senderId: r.sender_id,
    senderName: r.sender_name,
    senderEmail: r.sender_email,
    createdAt: r.created_at,
  }));
};

export const respondToFriendRequest = async (requestId, accept, currentUserId) => {
  if (!isSupabaseConfigured()) return;
  // Get the request
  const { data: req, error: fetchErr } = await supabase
    .from('friend_requests').select('*').eq('id', requestId).maybeSingle();
  if (!req) throw new Error('Request not found');
  if (req.receiver_id !== currentUserId) throw new Error('Unauthorized');

  // Update status
  await supabase.from('friend_requests').update({ status: accept ? 'accepted' : 'rejected' }).eq('id', requestId);

  if (accept) {
    // Create bilateral friendship
    const { data: receiverUser } = await supabase.from('users').select('name,email,avatar,phone').eq('id', currentUserId).maybeSingle();
    await supabase.from('friends').insert([
      { id: uuidv4(), user_id: req.sender_id, friend_id: currentUserId, created_at: new Date().toISOString() },
      { id: uuidv4(), user_id: currentUserId, friend_id: req.sender_id, created_at: new Date().toISOString() },
    ]);
    await addActivity({ type: 'friend_added', userId: currentUserId, targetUserId: req.sender_id, createdAt: new Date().toISOString() });
  }
};

export const getSentFriendRequests = async (userId) => {
  if (isDemo(userId)) return [];
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('friend_requests')
    .select('id,receiver_id,status,created_at')
    .eq('sender_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) return [];
  // Fetch receiver names
  const ids = (data || []).map(r => r.receiver_id);
  if (ids.length === 0) return [];
  const { data: users } = await supabase.from('users').select('id,name,email').in('id', ids);
  const userMap = Object.fromEntries((users || []).map(u => [u.id, u]));
  return (data || []).map(r => ({
    id: r.id,
    receiverId: r.receiver_id,
    receiverName: userMap[r.receiver_id]?.name || 'Unknown',
    receiverEmail: userMap[r.receiver_id]?.email || '',
    createdAt: r.created_at,
  }));
};

// --- Groups ---
export const createGroup = async (group) => {
  group = { ...group, name: (group.name || '').trim() };
  if (isDemo(group.createdBy)) {
    const groups = await getData(KEYS.GROUPS);
    const newGroup = { id: uuidv4(), ...group, emoji: group.emoji || null, currency: group.currency || null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await setData(KEYS.GROUPS, [...groups, newGroup]);
    await addActivity({ type: 'group_created', groupId: newGroup.id, groupName: newGroup.name, userId: group.createdBy, createdAt: new Date().toISOString() });
    return newGroup;
  }

  const groupType = group.type || 'other';
  const newGroup = {
    id: uuidv4(),
    name: group.name,
    type: groupType,
    description: group.description || '',
    emoji: group.emoji || '',
    currency: group.currency || 'INR',
    end_date: group.endDate || null,
    created_by: group.createdBy,
    members: group.members,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('groups').insert(newGroup);
  if (error) throw new Error('Failed to create group: ' + error.message);

  const local = {
    id: newGroup.id, name: newGroup.name, type: newGroup.type,
    description: newGroup.description, emoji: newGroup.emoji || '',
    currency: newGroup.currency || 'INR', endDate: newGroup.end_date || null,
    createdBy: newGroup.created_by, members: newGroup.members,
    createdAt: newGroup.created_at, updatedAt: newGroup.updated_at,
  };
  await addActivity({ type: 'group_created', groupId: local.id, groupName: local.name, userId: group.createdBy, createdAt: new Date().toISOString() });
  return local;
};

export const getGroups = async (userId, userEmail = null) => {
  if (isDemo(userId)) {
    const groups = await getData(KEYS.GROUPS);
    return groups.filter(g => g.members.some(m => m.id === userId));
  }

  if (!isSupabaseConfigured()) return [];

  // Use server-side function for reliable JSONB membership lookup
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_groups', { p_user_id: userId });
  if (!rpcError && rpcData) {
    return rpcData.map(g => ({
      id: g.id, name: g.name, type: g.type || 'other', description: g.description || '',
      emoji: g.emoji || '', currency: g.currency || 'INR', endDate: g.end_date || null,
      createdBy: g.created_by, members: g.members || [],
      archived: g.archived || false, pinned: g.pinned || false,
      createdAt: g.created_at, updatedAt: g.updated_at,
    }));
  }

  // Fallback: query by userId and optionally by email
  const queries = [
    supabase.from('groups').select('*').order('created_at', { ascending: false })
      .filter('members', 'cs', JSON.stringify([{ id: userId }])),
  ];
  if (userEmail) {
    queries.push(
      supabase.from('groups').select('*').order('created_at', { ascending: false })
        .filter('members', 'cs', JSON.stringify([{ email: userEmail.toLowerCase() }]))
    );
  }
  const results = await Promise.all(queries);
  const allRows = results.flatMap(r => r.data || []);
  const seen = new Set();
  const deduped = allRows.filter(g => { if (seen.has(g.id)) return false; seen.add(g.id); return true; });
  return deduped
    .map(g => ({
      id: g.id, name: g.name, type: g.type || 'other', description: g.description || '',
      emoji: g.emoji || '', currency: g.currency || 'INR', endDate: g.end_date || null,
      createdBy: g.created_by, members: g.members || [],
      archived: g.archived || false, pinned: g.pinned || false,
      createdAt: g.created_at, updatedAt: g.updated_at,
    }));
};

export const getGroup = async (groupId) => {
  // Always check local storage first (demo groups stored here even when Supabase configured)
  const localGroups = await getData(KEYS.GROUPS);
  const localGroup = localGroups.find(g => g.id === groupId);
  if (localGroup) return localGroup;
  if (!isSupabaseConfigured()) return null;
  const { data } = await supabase.from('groups').select('*').eq('id', groupId).single();
  if (!data) return null;
  return { id: data.id, name: data.name, type: data.type || 'other', description: data.description || '', emoji: data.emoji || '', currency: data.currency || 'INR', endDate: data.end_date || null, createdBy: data.created_by, members: data.members || [], createdAt: data.created_at, updatedAt: data.updated_at };
};

export const updateGroup = async (groupId, updates) => {
  const localGroups = await getData(KEYS.GROUPS);
  const idx = localGroups.findIndex(g => g.id === groupId);
  if (idx !== -1) {
    localGroups[idx] = { ...localGroups[idx], ...updates, updatedAt: new Date().toISOString() };
    await setData(KEYS.GROUPS, localGroups);
    return localGroups[idx];
  }
  if (!isSupabaseConfigured()) throw new Error('Group not found');
  const { data, error } = await supabase.from('groups').update({
    ...('name' in updates && { name: updates.name }),
    ...('description' in updates && { description: updates.description }),
    ...('members' in updates && { members: updates.members }),
    updated_at: new Date().toISOString(),
  }).eq('id', groupId).select().single();
  if (error) throw new Error('Failed to update group');
  return { id: data.id, name: data.name, type: data.type || 'other', description: data.description || '', emoji: data.emoji || '', currency: data.currency || 'INR', endDate: data.end_date || null, createdBy: data.created_by, members: data.members || [], createdAt: data.created_at, updatedAt: data.updated_at };
};

export const archiveGroup = async (groupId, archived) => {
  // Demo users: persist in AsyncStorage
  const localGroups = await getData(KEYS.GROUPS);
  const idx = localGroups.findIndex(g => g.id === groupId);
  if (idx !== -1) {
    localGroups[idx] = { ...localGroups[idx], archived, updatedAt: new Date().toISOString() };
    await setData(KEYS.GROUPS, localGroups);
    return localGroups[idx];
  }
  if (!isSupabaseConfigured()) throw new Error('Group not found');
  const { data, error } = await supabase.from('groups').update({
    archived,
    updated_at: new Date().toISOString(),
  }).eq('id', groupId).select().single();
  if (error) throw new Error('Failed to archive group');
  return data;
};

export const pinGroup = async (groupId, pinned) => {
  // Demo users: persist in AsyncStorage
  const localGroups = await getData(KEYS.GROUPS);
  const idx = localGroups.findIndex(g => g.id === groupId);
  if (idx !== -1) {
    localGroups[idx] = { ...localGroups[idx], pinned, updatedAt: new Date().toISOString() };
    await setData(KEYS.GROUPS, localGroups);
    return localGroups[idx];
  }
  if (!isSupabaseConfigured()) throw new Error('Group not found');
  const { data, error } = await supabase.from('groups').update({
    pinned,
    updated_at: new Date().toISOString(),
  }).eq('id', groupId).select().single();
  if (error) throw new Error('Failed to pin group');
  return data;
};

export const addMemberToGroup = async (groupId, user) => {
  const localGroups = await getData(KEYS.GROUPS);
  const idx = localGroups.findIndex(g => g.id === groupId);
  if (idx !== -1) {
    if (localGroups[idx].members.find(m => m.id === user.id)) throw new Error('Already a member');
    localGroups[idx].members.push(user);
    localGroups[idx].updatedAt = new Date().toISOString();
    await setData(KEYS.GROUPS, localGroups);
    return localGroups[idx];
  }
  if (!isSupabaseConfigured()) throw new Error('Group not found');

  // Fetch current group, add member, save
  const { data: group, error: fetchErr } = await supabase.from('groups').select('*').eq('id', groupId).single();
  if (fetchErr || !group) throw new Error('Group not found');
  if (group.members.find(m => m.id === user.id)) throw new Error('Already a member');

  const updatedMembers = [...group.members, user];
  const { data, error } = await supabase.from('groups').update({
    members: updatedMembers,
    updated_at: new Date().toISOString(),
  }).eq('id', groupId).select().single();
  if (error) throw new Error('Failed to add member');
  return { id: data.id, name: data.name, type: data.type || 'other', description: data.description || '', emoji: data.emoji || '', currency: data.currency || 'INR', endDate: data.end_date || null, createdBy: data.created_by, members: data.members || [], createdAt: data.created_at, updatedAt: data.updated_at };
};

// --- Remove Member from Group (Feature #14) ---
export const removeMemberFromGroup = async (groupId, memberId) => {
  const localGroups = await getData(KEYS.GROUPS);
  const idx = localGroups.findIndex(g => g.id === groupId);
  if (idx !== -1) {
    localGroups[idx].members = localGroups[idx].members.filter(m => m.id !== memberId);
    localGroups[idx].updatedAt = new Date().toISOString();
    await setData(KEYS.GROUPS, localGroups);
    return localGroups[idx];
  }
  if (!isSupabaseConfigured()) throw new Error('Group not found');
  const { data: group, error: fetchErr } = await supabase.from('groups').select('*').eq('id', groupId).single();
  if (fetchErr || !group) throw new Error('Group not found');
  const updatedMembers = (group.members || []).filter(m => m.id !== memberId);
  const { data, error } = await supabase.from('groups').update({
    members: updatedMembers,
    updated_at: new Date().toISOString(),
  }).eq('id', groupId).select().single();
  if (error) throw new Error('Failed to remove member');
  return { id: data.id, name: data.name, type: data.type || 'other', description: data.description || '', emoji: data.emoji || '', currency: data.currency || 'INR', endDate: data.end_date || null, createdBy: data.created_by, members: data.members || [], createdAt: data.created_at, updatedAt: data.updated_at };
};

// --- Expenses ---
export const addExpense = async (expense) => {
  expense = { ...expense, description: (expense.description || '').trim() };
  if (isDemo(expense.paidBy?.id)) {
    const expenses = await getData(KEYS.EXPENSES);
    const newExpense = { id: uuidv4(), ...expense, createdAt: new Date().toISOString() };
    await setData(KEYS.EXPENSES, [...expenses, newExpense]);
    await addActivity({ type: 'expense_added', expenseId: newExpense.id, description: newExpense.description, amount: newExpense.amount, groupId: newExpense.groupId, groupName: expense.groupName, userId: newExpense.paidBy.id, paidByName: newExpense.paidBy.name, createdAt: new Date().toISOString() });
    return newExpense;
  }

  const expenseCategory = expense.category || 'general';
  const expenseDate = expense.date || new Date().toISOString();
  const newExpense = {
    id: uuidv4(),
    group_id: expense.groupId,
    description: expense.description,
    amount: expense.amount,
    currency: expense.currency,
    paid_by: expense.paidBy,
    splits: expense.splits,
    category: expenseCategory,
    date: expenseDate,
    notes: expense.notes || '',
    expense_date: expense.expenseDate || null,
    comments: expense.comments || [],
    paid_by_split: expense.paidBySplit || null,
    created_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('expenses').insert(newExpense);
  if (error) throw new Error('Failed to add expense: ' + error.message);

  const local = { id: newExpense.id, groupId: newExpense.group_id, description: newExpense.description, amount: newExpense.amount, currency: newExpense.currency, category: expenseCategory, paidBy: newExpense.paid_by, splits: newExpense.splits, date: expenseDate, notes: newExpense.notes, expenseDate: newExpense.expense_date, receiptUri: newExpense.receipt_uri, comments: newExpense.comments, paidBySplit: newExpense.paid_by_split, createdAt: newExpense.created_at };
  await addActivity({ type: 'expense_added', expenseId: local.id, description: local.description, amount: local.amount, groupId: local.groupId, groupName: expense.groupName, userId: local.paidBy?.id || local.paidBy, paidByName: local.paidBy?.name || local.paidBy, category: expenseCategory, paid_by_id: expense.paidBy?.id || expense.paidBy, createdAt: new Date().toISOString() });
  return local;
};

export const getExpenses = async (groupId) => {
  // Check if this is a local (demo) group — use local storage if so
  const localGroups = await getData(KEYS.GROUPS);
  if (localGroups.some(g => g.id === groupId)) {
    const expenses = await getData(KEYS.EXPENSES);
    return expenses.filter(e => e.groupId === groupId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  if (!isSupabaseConfigured()) return [];
  const { data } = await supabase.from('expenses').select('*').eq('group_id', groupId).order('created_at', { ascending: false });
  return (data || []).map(e => ({ id: e.id, groupId: e.group_id, description: e.description, amount: e.amount, currency: e.currency, category: e.category || 'general', paidBy: e.paid_by, splits: e.splits || [], date: e.date || e.created_at, notes: e.notes || '', expenseDate: e.expense_date || null, receiptUri: e.receipt_uri || null, comments: e.comments || [], paidBySplit: e.paid_by_split || null, createdAt: e.created_at }));
};


export const deleteExpense = async (expenseId) => {
  const localExpenses = await getData(KEYS.EXPENSES);
  if (localExpenses.find(e => e.id === expenseId)) {
    await setData(KEYS.EXPENSES, localExpenses.filter(e => e.id !== expenseId));
    return;
  }
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
  if (error) throw new Error('Failed to delete expense');
};

// --- Balances ---
export const calculateBalances = async (userId, userEmail = null, cachedGroupIds = null) => {
  if (isDemo(userId)) {
    const expenses = await getData(KEYS.EXPENSES);
    const settlements = await getData(KEYS.SETTLEMENTS);
    const users = await getData(KEYS.USERS);
    return _calculateBalancesFromData(userId, expenses, settlements, users);
  }

  // Use pre-fetched groupIds if available, otherwise fetch groups
  let groupIds = cachedGroupIds;
  if (!groupIds) {
    const userGroups = await getGroups(userId, userEmail);
    groupIds = userGroups.map(g => g.id);
  }

  let expenses = [];
  if (groupIds.length > 0) {
    const { data } = await supabase.from('expenses').select('id,paid_by,splits,amount').in('group_id', groupIds);
    expenses = (data || []).map(e => ({ paidBy: e.paid_by, splits: e.splits || [], amount: e.amount }));
  }

  const { data: settlementsData } = await supabase.from('settlements').select('paid_by,paid_to,amount')
    .or(`paid_by.eq.${userId},paid_to.eq.${userId}`);
  const settlements = (settlementsData || []).map(s => ({ paidBy: s.paid_by, paidTo: s.paid_to, amount: s.amount }));

  const balanceMap = {};
  // Build user info inline from expense data — no separate users table lookup needed
  const userInfoMap = {};
  expenses.forEach(expense => {
    const paidById = expense.paidBy?.id;
    if (!paidById) return;
    // Collect name/avatar from paid_by and splits as we process
    if (expense.paidBy?.name) userInfoMap[paidById] = { id: paidById, name: expense.paidBy.name, email: expense.paidBy.email || null, avatar: expense.paidBy.avatar || null };
    expense.splits.forEach(split => {
      if (split.name) userInfoMap[split.userId] = { id: split.userId, name: split.name, email: null, avatar: null };
      if (split.userId === paidById) return;
      const sorted = [paidById, split.userId].sort();
      const key = sorted.join('_');
      if (!balanceMap[key]) balanceMap[key] = { user1: sorted[0], user2: sorted[1], amount: 0 };
      if (paidById === balanceMap[key].user1) balanceMap[key].amount += split.amount;
      else balanceMap[key].amount -= split.amount;
    });
  });

  settlements.forEach(s => {
    const sorted = [s.paidBy, s.paidTo].sort();
    const key = sorted.join('_');
    if (!balanceMap[key]) balanceMap[key] = { user1: sorted[0], user2: sorted[1], amount: 0 };
    // paidBy is settling debt: reduces the credit of paidTo (the creditor)
    if (s.paidBy === balanceMap[key].user1) balanceMap[key].amount += s.amount;
    else balanceMap[key].amount -= s.amount;
  });

  const result = [];
  Object.values(balanceMap).forEach(b => {
    if (Math.abs(b.amount) < 0.01) return;
    if (b.user1 === userId || b.user2 === userId) {
      const otherUserId = b.user1 === userId ? b.user2 : b.user1;
      const otherUser = userInfoMap[otherUserId];
      if (!otherUser) return;
      const amount = parseFloat((b.user1 === userId ? b.amount : -b.amount).toFixed(2));
      result.push({ userId: otherUserId, name: otherUser.name, email: otherUser.email, avatar: otherUser.avatar, amount });
    }
  });
  return result;
};

const _calculateBalancesFromData = (userId, expenses, settlements, users) => {
  const balanceMap = {};
  expenses.forEach(expense => {
    const paidById = expense.paidBy?.id || expense.paidBy;
    expense.splits.forEach(split => {
      if (split.userId === paidById) return;
      const sorted = [paidById, split.userId].sort();
      const key = sorted.join('_');
      if (!balanceMap[key]) balanceMap[key] = { user1: sorted[0], user2: sorted[1], amount: 0 };
      if (paidById === balanceMap[key].user1) balanceMap[key].amount += split.amount;
      else balanceMap[key].amount -= split.amount;
    });
  });
  settlements.forEach(s => {
    const sorted = [s.paidBy, s.paidTo].sort();
    const key = sorted.join('_');
    if (!balanceMap[key]) balanceMap[key] = { user1: sorted[0], user2: sorted[1], amount: 0 };
    if (s.paidBy === balanceMap[key].user1) balanceMap[key].amount += s.amount;
    else balanceMap[key].amount -= s.amount;
  });
  const result = [];
  Object.values(balanceMap).forEach(b => {
    if (Math.abs(b.amount) < 0.01) return;
    if (b.user1 === userId || b.user2 === userId) {
      const otherUserId = b.user1 === userId ? b.user2 : b.user1;
      const otherUser = users.find(u => u.id === otherUserId);
      if (!otherUser) return;
      const amount = parseFloat((b.user1 === userId ? b.amount : -b.amount).toFixed(2));
      result.push({ userId: otherUserId, name: otherUser.name, email: otherUser.email, avatar: otherUser.avatar, amount });
    }
  });
  return result;
};

export const calculateGroupBalances = async (groupId, members) => {
  if (!members || members.length === 0) return [];
  if (isDemo(members[0]?.id)) {
    const expenses = await getData(KEYS.EXPENSES);
    const settlements = await getData(KEYS.SETTLEMENTS);
    const groupExpenses = expenses.filter(e => e.groupId === groupId);
    const groupSettlements = settlements.filter(s => s.groupId === groupId);
    return _calculateGroupBalancesFromData(groupId, members, groupExpenses, groupSettlements);
  }

  const [{ data: expensesData }, { data: settlementsData }] = await Promise.all([
    supabase.from('expenses').select('paid_by,splits,amount').eq('group_id', groupId),
    supabase.from('settlements').select('paid_by,paid_to,amount').eq('group_id', groupId),
  ]);
  const groupExpenses = (expensesData || []).map(e => ({ paidBy: e.paid_by, splits: e.splits || [], amount: e.amount }));
  // Only include settlements explicitly recorded for this group
  const groupSettlements = (settlementsData || [])
    .map(s => ({ paidBy: s.paid_by, paidTo: s.paid_to, amount: s.amount }));
  return _calculateGroupBalancesFromData(groupId, members, groupExpenses, groupSettlements);
};

const _calculateGroupBalancesFromData = (groupId, members, groupExpenses, groupSettlements) => {
  const balanceMap = {};
  members.forEach(m => balanceMap[m.id] = 0);

  groupExpenses.forEach(expense => {
    const paidById = expense.paidBy?.id || expense.paidBy;
    if (balanceMap[paidById] !== undefined) balanceMap[paidById] += expense.amount;
    expense.splits.forEach(split => {
      if (balanceMap[split.userId] !== undefined) balanceMap[split.userId] -= split.amount;
    });
  });

  groupSettlements.forEach(s => {
    const paidBy = s.paidBy || s.paid_by;
    const paidTo = s.paidTo || s.paid_to;
    if (balanceMap[paidBy] !== undefined) balanceMap[paidBy] += s.amount;
    if (balanceMap[paidTo] !== undefined) balanceMap[paidTo] -= s.amount;
  });

  return members.map(m => ({ ...m, balance: parseFloat((balanceMap[m.id] || 0).toFixed(2)) }));
};

// --- Settlements ---
export const recordSettlement = async (settlement) => {
  if (isDemo(settlement.paidBy)) {
    const settlements = await getData(KEYS.SETTLEMENTS);
    const newSettlement = { id: uuidv4(), ...settlement, createdAt: new Date().toISOString() };
    await setData(KEYS.SETTLEMENTS, [...settlements, newSettlement]);
    await addActivity({ type: 'settlement', settlementId: newSettlement.id, amount: newSettlement.amount, paidById: newSettlement.paidBy, paidToId: newSettlement.paidTo, userId: newSettlement.paidBy, createdAt: new Date().toISOString() });
    return newSettlement;
  }

  const newSettlement = {
    id: uuidv4(),
    paid_by: settlement.paidBy,
    paid_to: settlement.paidTo,
    amount: settlement.amount,
    currency: settlement.currency,
    group_id: settlement.groupId || null,
    note: settlement.note || '',
    created_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('settlements').insert(newSettlement);
  if (error) throw new Error('Failed to record settlement: ' + error.message);

  const local = { id: newSettlement.id, paidBy: newSettlement.paid_by, paidTo: newSettlement.paid_to, amount: newSettlement.amount, currency: newSettlement.currency, groupId: newSettlement.group_id, note: newSettlement.note, createdAt: newSettlement.created_at };
  await addActivity({ type: 'settlement', settlementId: local.id, amount: local.amount, paidById: local.paidBy, paidToId: local.paidTo, userId: local.paidBy, createdAt: new Date().toISOString() });
  return local;
};

// --- Activity ---
export const addActivity = async (activity) => {
  const newActivity = { id: uuidv4(), ...activity };

  if (isDemo(activity.userId)) {
    const activities = await getData(KEYS.ACTIVITY);
    await setData(KEYS.ACTIVITY, [newActivity, ...activities].slice(0, 200));
    return;
  }

  if (!isSupabaseConfigured()) return;
  await supabase.from('activity').insert({
    id: newActivity.id,
    type: newActivity.type,
    user_id: newActivity.userId,
    group_id: newActivity.groupId || null,
    expense_id: newActivity.expenseId || null,
    description: newActivity.description || null,
    amount: newActivity.amount || null,
    group_name: newActivity.groupName || null,
    paid_by_name: newActivity.paidByName || null,
    category: newActivity.category || null,
    paid_by_id: newActivity.paid_by_id || null,
    created_at: newActivity.createdAt,
  }).then(() => {}, (e) => console.warn('Activity write failed:', e?.message));
};

export const getActivity = async (userId, cachedGroupIds = null) => {
  if (isDemo(userId)) {
    const activities = await getData(KEYS.ACTIVITY);
    const groups = await getData(KEYS.GROUPS);
    return activities.filter(a => {
      if (a.userId === userId) return true;
      if (a.groupId) {
        const group = groups.find(g => g.id === a.groupId);
        return group && group.members.some(m => m.id === userId);
      }
      return false;
    }).slice(0, 50);
  }

  if (!isSupabaseConfigured()) return [];
  let groupIds = cachedGroupIds;
  if (!groupIds) {
    const userGroups = await getGroups(userId);
    groupIds = userGroups.map(g => g.id);
  }

  // Two separate queries — more reliable than .or() with in.() inside PostgREST
  const [ownResult, groupResult] = await Promise.all([
    supabase.from('activity').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(100),
    groupIds.length > 0
      ? supabase.from('activity').select('*').in('group_id', groupIds)
          .order('created_at', { ascending: false }).limit(200)
      : Promise.resolve({ data: [] }),
  ]);

  const seen = new Set();
  const merged = [...(ownResult.data || []), ...(groupResult.data || [])]
    .filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 200);

  return merged.map(a => ({
    id: a.id, type: a.type, userId: a.user_id, groupId: a.group_id,
    expenseId: a.expense_id, description: a.description,
    amount: a.amount, groupName: a.group_name, paidByName: a.paid_by_name,
    createdAt: a.created_at,
  }));
};

export const getUserById = async (userId) => {
  if (isDemo(userId)) {
    const users = await getData(KEYS.USERS);
    const user = users.find(u => u.id === userId);
    if (!user) return null;
    const { password: _, ...safeUser } = user;
    return safeUser;
  }
  if (!isSupabaseConfigured()) return null;
  const { data } = await supabase.from('users').select('id,name,email,avatar,phone').eq('id', userId).single();
  if (!data) return null;
  return { id: data.id, name: data.name, email: data.email, avatar: data.avatar || null, phone: data.phone || '' };
};

export const searchUsersByEmail = async (email) => {
  // Always check local users first (demo users stored here)
  const localUsers = await getData(KEYS.USERS);
  const localMatches = localUsers.filter(u => u.email && u.email.toLowerCase().includes(email.toLowerCase())).map(({ password: _, ...u }) => u);
  if (localMatches.length > 0) return localMatches;
  if (!isSupabaseConfigured()) return [];
  const { data } = await supabase.from('users').select('id,name,email,avatar,phone')
    .ilike('email', `%${email}%`).limit(10);
  return (data || []).map(u => ({ id: u.id, name: u.name, email: u.email, avatar: u.avatar || null, phone: u.phone || '' }));
};

// --- Group Invites ---
export const sendGroupInvite = async (groupId, groupName, invitedUserId, invitedByUserId, invitedByName) => {
  if (!isSupabaseConfigured()) throw new Error('No connection');

  const { data: group } = await supabase.from('groups').select('members').eq('id', groupId).single();
  if (group?.members?.find(m => m.id === invitedUserId)) throw new Error('Already a member');

  const { data: existing } = await supabase.from('group_invites')
    .select('id').eq('group_id', groupId).eq('invited_user_id', invitedUserId).eq('status', 'pending').maybeSingle();
  if (existing) throw new Error('Invite already sent to this user');

  const invite = {
    id: uuidv4(),
    group_id: groupId,
    group_name: groupName,
    invited_user_id: invitedUserId,
    invited_by_user_id: invitedByUserId,
    invited_by_name: invitedByName,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('group_invites').insert(invite);
  if (error) throw new Error('Failed to send invite: ' + error.message);
  return invite;
};

export const getGroupInvites = async (userId) => {
  if (isDemo(userId) || !isSupabaseConfigured()) return [];
  const { data } = await supabase.from('group_invites').select('*')
    .eq('invited_user_id', userId).eq('status', 'pending')
    .order('created_at', { ascending: false });
  return (data || []).map(inv => ({
    id: inv.id, groupId: inv.group_id, groupName: inv.group_name,
    invitedUserId: inv.invited_user_id, invitedByUserId: inv.invited_by_user_id,
    invitedByName: inv.invited_by_name, status: inv.status, createdAt: inv.created_at,
  }));
};

export const respondToGroupInvite = async (inviteId, accept, userId) => {
  if (!isSupabaseConfigured()) throw new Error('No connection');

  const { data: invite, error: fetchErr } = await supabase.from('group_invites').select('*').eq('id', inviteId).single();
  if (fetchErr || !invite) throw new Error('Invite not found');
  if (invite.invited_user_id && invite.invited_user_id !== userId) {
    throw new Error('This invite does not belong to you');
  }

  const { error: updateErr } = await supabase.from('group_invites')
    .update({ status: accept ? 'accepted' : 'rejected' }).eq('id', inviteId);
  if (updateErr) throw new Error('Failed to respond to invite');

  if (accept) {
    const [{ data: userProfile }, { data: group }] = await Promise.all([
      supabase.from('users').select('id,name,email,avatar').eq('id', userId).single(),
      supabase.from('groups').select('*').eq('id', invite.group_id).single(),
    ]);
    if (!userProfile) throw new Error('User profile not found');
    if (!group) throw new Error('Group not found');

    if (!group.members.find(m => m.id === userId)) {
      const updatedMembers = [...group.members, {
        id: userProfile.id, name: userProfile.name,
        email: userProfile.email, avatar: userProfile.avatar || null,
      }];
      await supabase.from('groups').update({
        members: updatedMembers,
        updated_at: new Date().toISOString(),
      }).eq('id', invite.group_id);
    }

    await addActivity({
      type: 'member_joined', groupId: invite.group_id, groupName: invite.group_name,
      userId, paidByName: userProfile.name, createdAt: new Date().toISOString(),
    });
  }
};


// Seed demo data (local only)
// Bump SEED_VERSION to force a re-seed when demo data format changes
const SEED_VERSION = '2';
export const seedDemoData = async () => {
  const seeded = await AsyncStorage.getItem('sw_demo_seed_v');
  if (seeded === SEED_VERSION) return;

  const now = new Date();
  const daysAgo = (d) => new Date(now - d * 864e5).toISOString();

  const alice = { id: 'demo-alice', name: 'Alice Demo', email: 'alice@demo.com', password: 'demo123', avatar: null, phone: '', createdAt: daysAgo(30) };
  const bob   = { id: 'demo-bob',   name: 'Bob Demo',   email: 'bob@demo.com',   password: 'demo123', avatar: null, phone: '', createdAt: daysAgo(30) };
  const carol = { id: 'demo-carol', name: 'Carol Demo', email: 'carol@demo.com', password: 'demo123', avatar: null, phone: '', createdAt: daysAgo(30) };
  await setData(KEYS.USERS, [alice, bob, carol]);

  // Friends
  await setData(KEYS.FRIENDS, [
    { id: uuidv4(), userId: 'demo-alice', friendId: 'demo-bob',   createdAt: daysAgo(28) },
    { id: uuidv4(), userId: 'demo-alice', friendId: 'demo-carol', createdAt: daysAgo(28) },
    { id: uuidv4(), userId: 'demo-bob',   friendId: 'demo-alice', createdAt: daysAgo(28) },
    { id: uuidv4(), userId: 'demo-bob',   friendId: 'demo-carol', createdAt: daysAgo(28) },
    { id: uuidv4(), userId: 'demo-carol', friendId: 'demo-alice', createdAt: daysAgo(28) },
    { id: uuidv4(), userId: 'demo-carol', friendId: 'demo-bob',   createdAt: daysAgo(28) },
  ]);

  // Groups
  const tripGroup = { id: 'demo-group-trip', name: 'Goa Trip 🏖️', createdBy: 'demo-alice', members: [alice, bob, carol], createdAt: daysAgo(14), updatedAt: daysAgo(1) };
  const flatGroup = { id: 'demo-group-flat', name: 'Flat Expenses 🏠', createdBy: 'demo-bob', members: [alice, bob], createdAt: daysAgo(20), updatedAt: daysAgo(2) };
  await setData(KEYS.GROUPS, [tripGroup, flatGroup]);

  // Expenses — splits must match what _calculateBalancesFromData expects: [{ userId, name, amount }]
  const expenses = [
    { id: 'demo-exp-1', description: 'Hotel booking', amount: 4500, category: 'accommodation', paidBy: { id: 'demo-alice', name: 'Alice Demo' }, splitType: 'equal', splits: [{ userId: 'demo-alice', name: 'Alice Demo', amount: 1500 }, { userId: 'demo-bob', name: 'Bob Demo', amount: 1500 }, { userId: 'demo-carol', name: 'Carol Demo', amount: 1500 }], groupId: 'demo-group-trip', groupName: "Goa Trip 🏖️", date: daysAgo(13), createdAt: daysAgo(13) },
    { id: 'demo-exp-2', description: 'Beach dinner', amount: 1800, category: 'food', paidBy: { id: 'demo-bob', name: 'Bob Demo' }, splitType: 'equal', splits: [{ userId: 'demo-alice', name: 'Alice Demo', amount: 600 }, { userId: 'demo-bob', name: 'Bob Demo', amount: 600 }, { userId: 'demo-carol', name: 'Carol Demo', amount: 600 }], groupId: 'demo-group-trip', groupName: "Goa Trip 🏖️", date: daysAgo(12), createdAt: daysAgo(12) },
    { id: 'demo-exp-3', description: 'Scuba diving', amount: 3000, category: 'entertainment', paidBy: { id: 'demo-carol', name: 'Carol Demo' }, splitType: 'equal', splits: [{ userId: 'demo-alice', name: 'Alice Demo', amount: 1000 }, { userId: 'demo-bob', name: 'Bob Demo', amount: 1000 }, { userId: 'demo-carol', name: 'Carol Demo', amount: 1000 }], groupId: 'demo-group-trip', groupName: "Goa Trip 🏖️", date: daysAgo(11), createdAt: daysAgo(11) },
    { id: 'demo-exp-4', description: 'Cab to airport', amount: 600, category: 'transport', paidBy: { id: 'demo-alice', name: 'Alice Demo' }, splitType: 'equal', splits: [{ userId: 'demo-alice', name: 'Alice Demo', amount: 300 }, { userId: 'demo-bob', name: 'Bob Demo', amount: 300 }], groupId: 'demo-group-flat', groupName: "Flat Expenses 🏠", date: daysAgo(5), createdAt: daysAgo(5) },
    { id: 'demo-exp-5', description: 'Groceries', amount: 1200, category: 'food', paidBy: { id: 'demo-bob', name: 'Bob Demo' }, splitType: 'equal', splits: [{ userId: 'demo-alice', name: 'Alice Demo', amount: 600 }, { userId: 'demo-bob', name: 'Bob Demo', amount: 600 }], groupId: 'demo-group-flat', groupName: "Flat Expenses 🏠", date: daysAgo(3), createdAt: daysAgo(3) },
  ];
  await setData(KEYS.EXPENSES, expenses);

  // Activity
  const activity = [
    { id: uuidv4(), type: 'expense_added', userId: 'demo-alice', groupId: 'demo-group-trip', groupName: "Goa Trip 🏖️", description: 'Hotel booking', amount: 4500, paidByName: 'Alice Demo', createdAt: daysAgo(13) },
    { id: uuidv4(), type: 'expense_added', userId: 'demo-bob',   groupId: 'demo-group-trip', groupName: "Goa Trip 🏖️", description: 'Beach dinner', amount: 1800, paidByName: 'Bob Demo', createdAt: daysAgo(12) },
    { id: uuidv4(), type: 'expense_added', userId: 'demo-carol', groupId: 'demo-group-trip', groupName: "Goa Trip 🏖️", description: 'Scuba diving', amount: 3000, paidByName: 'Carol Demo', createdAt: daysAgo(11) },
    { id: uuidv4(), type: 'expense_added', userId: 'demo-alice', groupId: 'demo-group-flat', groupName: "Flat Expenses 🏠", description: 'Cab to airport', amount: 600, paidByName: 'Alice Demo', createdAt: daysAgo(5) },
    { id: uuidv4(), type: 'expense_added', userId: 'demo-bob',   groupId: 'demo-group-flat', groupName: "Flat Expenses 🏠", description: 'Groceries', amount: 1200, paidByName: 'Bob Demo', createdAt: daysAgo(3) },
  ];
  await setData(KEYS.ACTIVITY, activity);
  await AsyncStorage.setItem('sw_demo_seed_v', SEED_VERSION);
};


// --- Expense Comments ---
export const addExpenseComment = async (expenseId, comment) => {
  // comment: { author, text, date }
  const localExpenses = await getData(KEYS.EXPENSES);
  const localIdx = localExpenses.findIndex(e => e.id === expenseId);
  if (localIdx !== -1) {
    if (!localExpenses[localIdx].comments) localExpenses[localIdx].comments = [];
    localExpenses[localIdx].comments.push(comment);
    await setData(KEYS.EXPENSES, localExpenses);
    return localExpenses[localIdx];
  }
  if (!isSupabaseConfigured()) throw new Error('Expense not found');
  // For Supabase, fetch then update
  const { data: exp, error: fetchErr } = await supabase.from('expenses').select('*').eq('id', expenseId).single();
  if (fetchErr || !exp) throw new Error('Expense not found');
  const comments = Array.isArray(exp.comments) ? exp.comments : [];
  comments.push(comment);
  const { error } = await supabase.from('expenses').update({ comments }).eq('id', expenseId);
  if (error) throw new Error('Failed to add comment');
  return { ...exp, comments };
};

// --- Update Expense (for receipt, recurring, etc.) ---
export const updateExpense = async (expenseId, updates) => {
  const localExpenses = await getData(KEYS.EXPENSES);
  const localIdx = localExpenses.findIndex(e => e.id === expenseId);
  if (localIdx !== -1) {
    localExpenses[localIdx] = { ...localExpenses[localIdx], ...updates };
    await setData(KEYS.EXPENSES, localExpenses);
    return localExpenses[localIdx];
  }
  if (!isSupabaseConfigured()) throw new Error('Expense not found');
  // Map camelCase fields to snake_case for Supabase
  const supabaseUpdates = {};
  if ('description' in updates) supabaseUpdates.description = updates.description;
  if ('amount' in updates) supabaseUpdates.amount = updates.amount;
  if ('category' in updates) supabaseUpdates.category = updates.category;
  if ('splits' in updates) supabaseUpdates.splits = updates.splits;
  if ('notes' in updates) supabaseUpdates.notes = updates.notes || '';

  if ('expenseDate' in updates) supabaseUpdates.expense_date = updates.expenseDate || null;
  if ('paidBySplit' in updates) supabaseUpdates.paid_by_split = updates.paidBySplit || null;
  if ('comments' in updates) supabaseUpdates.comments = updates.comments;
  // Pass through any snake_case keys directly (for callers already using snake_case)
  Object.keys(updates).forEach(k => { if (k.includes('_')) supabaseUpdates[k] = updates[k]; });
  const { data, error } = await supabase.from('expenses').update(supabaseUpdates).eq('id', expenseId).select().single();
  if (error) throw new Error('Failed to update expense');
  return data;
};

// --- Search users by name or email (Feature #5) ---
export const searchUsers = async (query, currentUserId) => {
  if (!query || query.trim().length < 2) return [];
  if (!isSupabaseConfigured()) return [];
  const q = query.trim().toLowerCase();
  const { data, error } = await supabase
    .from('users')
    .select('id,name,email,avatar,phone')
    .or(`email.ilike.%${q}%,name.ilike.%${q}%,phone.ilike.%${q}%`)
    .neq('id', currentUserId)
    .limit(10);
  if (error) return [];
  return (data || []).map(u => ({ id: u.id, name: u.name, email: u.email, avatar: u.avatar || null, phone: u.phone || '' }));
};

// --- Get suggested friends from groups (Feature #4 & #7) ---
export const getSuggestedFriendsFromGroups = async (userId) => {
  if (isDemo(userId) || !isSupabaseConfigured()) return [];
  try {
    const groups = await getGroups(userId);
    const friendIds = new Set();
    const { data: friendRows } = await supabase.from('friends').select('user_id,friend_id')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
    (friendRows || []).forEach(f => {
      friendIds.add(f.user_id === userId ? f.friend_id : f.user_id);
    });
    friendIds.add(userId);

    const memberFreq = {};
    groups.forEach(g => {
      (g.members || []).forEach(m => {
        if (m.id && !friendIds.has(m.id)) {
          memberFreq[m.id] = (memberFreq[m.id] || 0) + 1;
        }
      });
    });

    const memberIds = Object.keys(memberFreq);
    if (memberIds.length === 0) return [];
    const { data: users } = await supabase.from('users').select('id,name,email,avatar,phone').in('id', memberIds);
    return (users || []).map(u => ({ id: u.id, name: u.name, email: u.email, avatar: u.avatar || null, phone: u.phone || '', coGroupCount: memberFreq[u.id] || 0 }))
      .sort((a, b) => b.coGroupCount - a.coGroupCount);
  } catch (e) {
    console.error('getSuggestedFriendsFromGroups error:', e);
    return [];
  }
};

// --- Pending invites (Feature #6) ---
const PENDING_INVITES_KEY = 'sw_pending_invites';

export const getPendingInvites = async (userId) => {
  // Try Supabase first
  if (isSupabaseConfigured() && userId) {
    try {
      const { data, error } = await supabase.from('pending_invites').select('*').eq('inviter_id', userId);
      if (!error && data) return data.map(i => ({ id: i.id, email: i.email, inviterId: i.inviter_id, invitedAt: i.created_at || i.invited_at }));
    } catch {}
  }
  // Fallback to AsyncStorage (demo accounts)
  try {
    const val = await AsyncStorage.getItem(PENDING_INVITES_KEY);
    return val ? JSON.parse(val) : [];
  } catch { return []; }
};

export const savePendingInvite = async (email, userId) => {
  // Save to Supabase if configured
  if (isSupabaseConfigured() && userId) {
    try {
      await supabase.from('pending_invites').upsert({
        id: uuidv4(),
        email,
        inviter_id: userId,
      }, { onConflict: 'email,inviter_id' });
    } catch {}
  }
  // Also save to AsyncStorage for local access
  const invites = await getPendingInvites();
  if (invites.some(i => i.email === email)) return invites;
  const updated = [...invites, { email, invitedAt: new Date().toISOString() }];
  await AsyncStorage.setItem(PENDING_INVITES_KEY, JSON.stringify(updated));
  return updated;
};

export const removePendingInvite = async (email, userId) => {
  // Remove from Supabase if configured
  if (isSupabaseConfigured() && userId) {
    try {
      await supabase.from('pending_invites').delete().eq('email', email).eq('inviter_id', userId);
    } catch {}
  }
  // Also remove from AsyncStorage
  const invites = await getPendingInvites();
  const updated = invites.filter(i => i.email !== email);
  await AsyncStorage.setItem(PENDING_INVITES_KEY, JSON.stringify(updated));
  return updated;
};

// --- Handle invite link: auto-add friend on app open (Feature #2) ---
export const handleInviteLink = async (inviterUserId, currentUserId) => {
  if (!inviterUserId || !currentUserId || inviterUserId === currentUserId) return;
  if (isDemo(currentUserId) || !isSupabaseConfigured()) return;
  try {
    // Check if already friends
    const { data: existing } = await supabase.from('friends').select('id')
      .or(`and(user_id.eq.${currentUserId},friend_id.eq.${inviterUserId}),and(user_id.eq.${inviterUserId},friend_id.eq.${currentUserId})`)
      .maybeSingle();
    if (existing) return;

    // Auto-create bilateral friendship (no request needed for invite links)
    await supabase.from('friends').insert([
      { id: uuidv4(), user_id: inviterUserId, friend_id: currentUserId, created_at: new Date().toISOString() },
      { id: uuidv4(), user_id: currentUserId, friend_id: inviterUserId, created_at: new Date().toISOString() },
    ]);
    await addActivity({ type: 'friend_added', userId: currentUserId, targetUserId: inviterUserId, createdAt: new Date().toISOString() });
  } catch (e) {
    console.error('handleInviteLink error:', e);
  }
};

// --- Get suggested members for a specific group (Feature #7 enhanced) ---
export const getSuggestedMembersForGroup = async (userId, groupId) => {
  if (isDemo(userId) || !isSupabaseConfigured()) return [];
  try {
    const groups = await getGroups(userId);
    const targetGroup = groups.find(g => g.id === groupId);
    if (!targetGroup) return [];
    const targetMemberIds = new Set((targetGroup.members || []).map(m => m.id));

    const memberFreq = {};
    groups.forEach(g => {
      if (g.id === groupId) return;
      (g.members || []).forEach(m => {
        if (m.id && !targetMemberIds.has(m.id) && m.id !== userId) {
          memberFreq[m.id] = (memberFreq[m.id] || 0) + 1;
        }
      });
    });

    const memberIds = Object.keys(memberFreq);
    if (memberIds.length === 0) return [];
    const { data: users } = await supabase.from('users').select('id,name,email,avatar,phone').in('id', memberIds);
    return (users || []).map(u => ({ id: u.id, name: u.name, email: u.email, avatar: u.avatar || null, phone: u.phone || '', coGroupCount: memberFreq[u.id] || 0 }))
      .sort((a, b) => b.coGroupCount - a.coGroupCount)
      .slice(0, 20);
  } catch (e) {
    console.error('getSuggestedMembersForGroup error:', e);
    return [];
  }
};

// --- Match device contacts to registered users (Feature #11) ---
export const matchContactsToUsers = async (contacts) => {
  if (!isSupabaseConfigured() || !contacts?.length) return [];
  try {
    const emails = contacts.map(c => c.email).filter(Boolean).map(e => e.toLowerCase());
    const phones = contacts.map(c => c.phone).filter(Boolean).map(p => p.replace(/[\s\-\(\)\+]/g, ''));
    if (emails.length === 0 && phones.length === 0) return [];

    const orClauses = [];
    // Chunk emails to avoid URL length issues
    for (let i = 0; i < emails.length; i += 50) {
      const chunk = emails.slice(i, i + 50);
      orClauses.push(...chunk.map(e => `email.ilike.${e}`));
    }
    for (let i = 0; i < phones.length; i += 50) {
      const chunk = phones.slice(i, i + 50);
      orClauses.push(...chunk.map(p => `phone.ilike.%${p}%`));
    }

    const results = [];
    // Query in batches of 50 OR clauses
    for (let i = 0; i < orClauses.length; i += 50) {
      const batch = orClauses.slice(i, i + 50);
      const { data } = await supabase.from('users').select('id,name,email,avatar,phone').or(batch.join(','));
      if (data) results.push(...data);
    }

    // Deduplicate and map contact names
    const seen = new Set();
    return results.filter(u => {
      if (seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    }).map(u => {
      const contact = contacts.find(c => c.email?.toLowerCase() === u.email?.toLowerCase() || (c.phone && u.phone?.includes(c.phone.replace(/[\s\-\(\)\+]/g, ''))));
      return { id: u.id, name: u.name, email: u.email, avatar: u.avatar || null, phone: u.phone || '', contactName: contact?.name || null };
    });
  } catch (e) {
    console.error('matchContactsToUsers error:', e);
    return [];
  }
};

// --- Invite context persistence for deep link auto-join (Feature #10) ---
const INVITE_CONTEXT_KEY = 'sw_invite_context';

export const storeInviteContext = async (context) => {
  try {
    await AsyncStorage.setItem(INVITE_CONTEXT_KEY, JSON.stringify(context));
  } catch (e) {
    console.error('storeInviteContext error:', e);
  }
};

export const getAndClearInviteContext = async () => {
  try {
    const val = await AsyncStorage.getItem(INVITE_CONTEXT_KEY);
    if (val) await AsyncStorage.removeItem(INVITE_CONTEXT_KEY);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
};
