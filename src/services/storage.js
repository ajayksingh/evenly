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

export const registerUser = async ({ name, email, password }) => {
  name = (name || '').trim();
  email = (email || '').trim();
  if (DEMO_EMAILS.includes(email)) {
    const users = await getData(KEYS.USERS);
    if (users.find(u => u.email === email)) throw new Error('Email already in use');
    const user = { id: uuidv4(), name, email, password, avatar: null, phone: '', createdAt: new Date().toISOString() };
    await setData(KEYS.USERS, [...users, user]);
    const { password: _, ...safeUser } = user;
    await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(safeUser));
    return safeUser;
  }

  checkAuthRateLimit();
  if (!isSupabaseConfigured()) throw new Error('Registration requires a network connection');

  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
  if (error) {
    if (error.message.includes('already registered') || error.message.includes('already exists')) {
      throw new Error('Email already in use. Please sign in instead.');
    }
    throw new Error(error.message);
  }

  const profile = {
    id: data.user.id,
    name,
    email,
    avatar: null,
    phone: '',
    createdAt: new Date().toISOString(),
  };

  // Always save profile to users table (data.user is available even before email confirmation)
  await supabase.from('users').upsert({
    id: profile.id,
    name: profile.name,
    email: profile.email,
    avatar: null,
    phone: '',
    provider: 'email',
    created_at: profile.createdAt,
  });

  if (!data.session) {
    throw new Error('Account created! Please check your email to confirm your account, then sign in.');
  }

  await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(profile));
  return profile;
};

export const loginUser = async ({ email, password }) => {
  email = (email || '').trim();
  if (DEMO_EMAILS.includes(email)) {
    await seedDemoData();
    const users = await getData(KEYS.USERS);
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) throw new Error('Invalid email or password');
    const { password: _, ...safeUser } = user;
    await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(safeUser));
    return safeUser;
  }

  const EVENLY_DEMO_EMAILS = ['demo@evenly.app', 'alex@evenly.app'];
  if (!EVENLY_DEMO_EMAILS.includes(email)) checkAuthRateLimit();
  if (!isSupabaseConfigured()) throw new Error('No network connection. Please connect to the internet to sign in.');

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.message.includes('not confirmed') || error.message.includes('Email not confirmed')) {
      throw new Error('Please confirm your email address first. Check your inbox for the confirmation link.');
    }
    const { data: existingUser } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
    if (existingUser) {
      throw new Error('Your account was created before our login system was updated. Please tap "Sign Up" to set a password for your account.');
    }
    throw new Error('No account found with this email. Please sign up first, or check for typos.');
  }

  // Fetch profile from Supabase
  const { data: userData } = await supabase.from('users').select('*').eq('id', data.user.id).single();
  let profile;
  if (userData) {
    profile = { id: userData.id, name: userData.name, email: userData.email, avatar: userData.avatar || null, phone: userData.phone || '', createdAt: userData.created_at };
  } else {
    // Profile missing from users table — create it now so friend lookups work
    profile = { id: data.user.id, name: email.split('@')[0], email, avatar: null, phone: '', createdAt: new Date().toISOString() };
    await supabase.from('users').upsert({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      avatar: null,
      phone: '',
      provider: 'email',
      created_at: profile.createdAt,
    });
  }

  await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(profile));
  return profile;
};

export const logoutUser = async () => {
  if (supabase) await supabase.auth.signOut().catch(() => {});
  await AsyncStorage.removeItem(KEYS.CURRENT_USER);
};

export const resetPasswordForEmail = async (email) => {
  if (DEMO_EMAILS.includes(email)) throw new Error('Demo accounts cannot reset passwords.');
  if (!isSupabaseConfigured()) throw new Error('No network connection.');
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw new Error(error.message);
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
      // Auth session exists but users row was deleted — recreate it using metadata name if available
      const email = session.user.email;
      const name = session.user.user_metadata?.name || email.split('@')[0];
      profile = { id: session.user.id, name, email, avatar: null, phone: '', createdAt: new Date().toISOString() };
      await supabase.from('users').upsert({ id: profile.id, name: profile.name, email: profile.email, avatar: null, phone: '', provider: 'email', created_at: profile.createdAt });
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
    const newGroup = { id: uuidv4(), ...group, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
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
    created_by: group.createdBy,
    members: group.members,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('groups').insert(newGroup);
  if (error) throw new Error('Failed to create group: ' + error.message);

  const local = {
    id: newGroup.id, name: newGroup.name, type: newGroup.type,
    description: newGroup.description,
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
      createdBy: g.created_by, members: g.members || [],
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
      createdBy: g.created_by, members: g.members || [],
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
  return { id: data.id, name: data.name, type: data.type || 'other', description: data.description || '', createdBy: data.created_by, members: data.members || [], createdAt: data.created_at, updatedAt: data.updated_at };
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
  return { id: data.id, name: data.name, type: data.type || 'other', description: data.description || '', createdBy: data.created_by, members: data.members || [], createdAt: data.created_at, updatedAt: data.updated_at };
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
  return { id: data.id, name: data.name, type: data.type || 'other', description: data.description || '', createdBy: data.created_by, members: data.members || [], createdAt: data.created_at, updatedAt: data.updated_at };
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
    created_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('expenses').insert(newExpense);
  if (error) throw new Error('Failed to add expense: ' + error.message);

  const local = { id: newExpense.id, groupId: newExpense.group_id, description: newExpense.description, amount: newExpense.amount, currency: newExpense.currency, category: expenseCategory, paidBy: newExpense.paid_by, splits: newExpense.splits, date: expenseDate, createdAt: newExpense.created_at };
  await addActivity({ type: 'expense_added', expenseId: local.id, description: local.description, amount: local.amount, groupId: local.groupId, groupName: expense.groupName, userId: local.paidBy.id, paidByName: local.paidBy.name, createdAt: new Date().toISOString() });
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
  return (data || []).map(e => ({ id: e.id, groupId: e.group_id, description: e.description, amount: e.amount, currency: e.currency, category: e.category || 'general', paidBy: e.paid_by, splits: e.splits || [], date: e.date || e.created_at, createdAt: e.created_at }));
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
