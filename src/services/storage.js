/**
 * Local Storage Service - AsyncStorage based
 * Acts as primary data store with Supabase sync
 * Offline-first: writes go local first, then sync queue
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueueUpsert, enqueueDelete } from './syncService';
import { supabase, isSupabaseConfigured } from './supabase';

// Simple UUID generator (no crypto dependency)
const uuidv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const KEYS = {
  USERS: 'sw_users',
  CURRENT_USER: 'sw_current_user',
  GROUPS: 'sw_groups',
  EXPENSES: 'sw_expenses',
  FRIENDS: 'sw_friends',
  SETTLEMENTS: 'sw_settlements',
  ACTIVITY: 'sw_activity',
};

// Generic CRUD helpers
const getData = async (key) => {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : [];
  } catch { return []; }
};

const setData = async (key, data) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) { console.error('Storage error:', e); }
};

// --- Auth ---
const DEMO_EMAILS = ['alice@demo.com', 'bob@demo.com', 'carol@demo.com'];

export const registerUser = async ({ name, email, password }) => {
  // Demo accounts stay local-only
  if (DEMO_EMAILS.includes(email)) {
    const users = await getData(KEYS.USERS);
    if (users.find(u => u.email === email)) throw new Error('Email already in use');
    const user = { id: uuidv4(), name, email, password, avatar: null, phone: '', createdAt: new Date().toISOString() };
    await setData(KEYS.USERS, [...users, user]);
    const { password: _, ...safeUser } = user;
    await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(safeUser));
    return safeUser;
  }

  if (!isSupabaseConfigured()) throw new Error('Registration requires a network connection');

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    if (error.message.includes('already registered') || error.message.includes('already exists')) {
      throw new Error('Email already in use. Please sign in instead.');
    }
    throw new Error(error.message);
  }

  if (!data.session) {
    throw new Error('Account created! Please check your email to confirm your account, then sign in.');
  }

  const profile = {
    id: data.user.id,
    name,
    email,
    avatar: null,
    phone: '',
    createdAt: new Date().toISOString(),
  };

  // Cache locally
  const users = await getData(KEYS.USERS);
  await setData(KEYS.USERS, [...users, { ...profile, password }]);
  await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(profile));

  // Write profile to Supabase users table
  await supabase.from('users').upsert({
    id: profile.id,
    name: profile.name,
    email: profile.email,
    avatar: null,
    phone: '',
    provider: 'email',
    created_at: profile.createdAt,
  });

  return profile;
};

export const loginUser = async ({ email, password }) => {
  // Demo accounts: seed then local lookup
  if (DEMO_EMAILS.includes(email)) {
    await seedDemoData();
    const users = await getData(KEYS.USERS);
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) throw new Error('Invalid email or password');
    const { password: _, ...safeUser } = user;
    await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(safeUser));
    return safeUser;
  }

  if (!isSupabaseConfigured()) {
    // Offline fallback — check local cache
    const users = await getData(KEYS.USERS);
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) throw new Error('Invalid email or password');
    const { password: _, ...safeUser } = user;
    await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(safeUser));
    return safeUser;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.message.includes('not confirmed') || error.message.includes('Email not confirmed')) {
      throw new Error('Please confirm your email address first. Check your inbox for the confirmation link.');
    }
    // Check if user exists in users table but has no auth account (pre-migration user)
    const { data: existingUser } = await supabase.from('users').select('id').eq('email', email).single();
    if (existingUser) {
      throw new Error('Your account was created before our login system was updated. Please tap "Sign Up" to set a password for your account.');
    }
    throw new Error('Invalid email or password');
  }

  // Try local profile cache first, then fetch from Supabase
  const users = await getData(KEYS.USERS);
  let localUser = users.find(u => u.id === data.user.id);

  if (!localUser) {
    // New device — fetch profile from Supabase
    const { data: userData } = await supabase.from('users').select('*').eq('id', data.user.id).single();
    if (userData) {
      localUser = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        avatar: userData.avatar || null,
        phone: userData.phone || '',
        createdAt: userData.created_at,
      };
      await setData(KEYS.USERS, [...users, { ...localUser, password }]);
    } else {
      localUser = { id: data.user.id, name: email.split('@')[0], email, avatar: null, phone: '', createdAt: new Date().toISOString() };
    }
  }

  const { password: _, ...safeUser } = { ...localUser, password: '' };
  await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(safeUser));
  // Sync all data from Supabase after login
  await syncFromSupabase(safeUser.id);
  return safeUser;
};

export const logoutUser = async () => {
  if (supabase) await supabase.auth.signOut().catch(() => {});
  await AsyncStorage.removeItem(KEYS.CURRENT_USER);
};

export const getCurrentUser = async () => {
  try {
    // Fast path: local cache
    const cached = await AsyncStorage.getItem(KEYS.CURRENT_USER);
    if (cached) return JSON.parse(cached);

    // Slow path: restore from Supabase session (cross-device login)
    if (!isSupabaseConfigured()) return null;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const users = await getData(KEYS.USERS);
    let profile = users.find(u => u.id === session.user.id);

    if (!profile) {
      const { data: userData } = await supabase.from('users').select('*').eq('id', session.user.id).single();
      if (!userData) return null;
      profile = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        avatar: userData.avatar || null,
        phone: userData.phone || '',
        createdAt: userData.created_at,
      };
      await setData(KEYS.USERS, [...users, profile]);
    }

    const { password: _, ...safeProfile } = { ...profile, password: '' };
    await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(safeProfile));
    // Sync all data from Supabase on session restore
    await syncFromSupabase(safeProfile.id);
    return safeProfile;
  } catch { return null; }
};

export const updateUserProfile = async (userId, updates) => {
  const users = await getData(KEYS.USERS);
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) throw new Error('User not found');
  users[idx] = { ...users[idx], ...updates };
  await setData(KEYS.USERS, users);
  const { password: _, ...safeUser } = users[idx];
  await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(safeUser));
  enqueueUpsert(KEYS.USERS, safeUser);
  if (isSupabaseConfigured()) {
    supabase.from('users').upsert({
      id: safeUser.id,
      name: safeUser.name,
      email: safeUser.email,
      avatar: safeUser.avatar || null,
      phone: safeUser.phone || '',
    }).then(() => {}, () => enqueueUpsert(KEYS.USERS, safeUser));
  }
  return safeUser;
};

// --- Friends ---
export const addFriend = async (currentUserId, email) => {
  const users = await getData(KEYS.USERS);
  let friend = users.find(u => u.email === email);

  // If not found locally, try Supabase (users registered on other devices)
  if (!friend && isSupabaseConfigured()) {
    const { data: remoteUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    if (remoteUser) {
      friend = {
        id: remoteUser.id,
        name: remoteUser.name,
        email: remoteUser.email,
        avatar: remoteUser.avatar || null,
        phone: remoteUser.phone || '',
        createdAt: remoteUser.created_at,
      };
      await setData(KEYS.USERS, [...users, friend]);
    }
  }

  if (!friend) throw new Error('No user found with that email. They need to register first.');
  if (friend.id === currentUserId) throw new Error("You can't add yourself");

  const friends = await getData(KEYS.FRIENDS);
  const exists = friends.find(f =>
    (f.userId === currentUserId && f.friendId === friend.id) ||
    (f.userId === friend.id && f.friendId === currentUserId)
  );
  if (exists) throw new Error('Already friends');

  const entry = { id: uuidv4(), userId: currentUserId, friendId: friend.id, createdAt: new Date().toISOString() };
  await setData(KEYS.FRIENDS, [...friends, entry]);
  enqueueUpsert(KEYS.FRIENDS, entry);
  if (isSupabaseConfigured()) {
    supabase.from('friends').upsert({
      id: entry.id,
      user_id: entry.userId,
      friend_id: entry.friendId,
      created_at: entry.createdAt,
    }).then(() => {}, () => enqueueUpsert(KEYS.FRIENDS, entry));
  }
  return friend;
};

export const getFriends = async (userId) => {
  const friends = await getData(KEYS.FRIENDS);
  const users = await getData(KEYS.USERS);
  const friendIds = friends
    .filter(f => f.userId === userId || f.friendId === userId)
    .map(f => f.userId === userId ? f.friendId : f.userId);
  return users
    .filter(u => friendIds.includes(u.id))
    .map(({ password: _, ...u }) => u);
};

// --- Groups ---
export const createGroup = async (group) => {
  console.log('[storage.createGroup] called with', group?.name);
  const groups = await getData(KEYS.GROUPS);
  console.log('[storage.createGroup] existing groups count:', groups.length);
  const newGroup = {
    id: uuidv4(),
    ...group,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await setData(KEYS.GROUPS, [...groups, newGroup]);
  console.log('[storage.createGroup] saved, adding activity...');
  enqueueUpsert(KEYS.GROUPS, newGroup);
  if (isSupabaseConfigured()) {
    supabase.from('groups').upsert({
      id: newGroup.id,
      name: newGroup.name,
      description: newGroup.description || '',
      created_by: newGroup.createdBy,
      members: newGroup.members,
      created_at: newGroup.createdAt,
      updated_at: newGroup.updatedAt,
    }).then(() => {}, () => enqueueUpsert(KEYS.GROUPS, newGroup));
  }
  await addActivity({
    type: 'group_created',
    groupId: newGroup.id,
    groupName: newGroup.name,
    userId: group.createdBy,
    createdAt: new Date().toISOString(),
  });
  console.log('[storage.createGroup] done, returning', newGroup.id);
  return newGroup;
};

export const getGroups = async (userId) => {
  const groups = await getData(KEYS.GROUPS);
  return groups.filter(g => g.members.some(m => m.id === userId));
};

export const getGroup = async (groupId) => {
  const groups = await getData(KEYS.GROUPS);
  return groups.find(g => g.id === groupId);
};

export const updateGroup = async (groupId, updates) => {
  const groups = await getData(KEYS.GROUPS);
  const idx = groups.findIndex(g => g.id === groupId);
  if (idx === -1) throw new Error('Group not found');
  groups[idx] = { ...groups[idx], ...updates, updatedAt: new Date().toISOString() };
  await setData(KEYS.GROUPS, groups);
  enqueueUpsert(KEYS.GROUPS, groups[idx]);
  return groups[idx];
};

export const addMemberToGroup = async (groupId, user) => {
  const groups = await getData(KEYS.GROUPS);
  const idx = groups.findIndex(g => g.id === groupId);
  if (idx === -1) throw new Error('Group not found');
  if (groups[idx].members.find(m => m.id === user.id)) throw new Error('Already a member');
  groups[idx].members.push(user);
  groups[idx].updatedAt = new Date().toISOString();
  await setData(KEYS.GROUPS, groups);
  enqueueUpsert(KEYS.GROUPS, groups[idx]);
  return groups[idx];
};

// --- Expenses ---
export const addExpense = async (expense) => {
  const expenses = await getData(KEYS.EXPENSES);
  const newExpense = {
    id: uuidv4(),
    ...expense,
    createdAt: new Date().toISOString(),
  };
  await setData(KEYS.EXPENSES, [...expenses, newExpense]);
  enqueueUpsert(KEYS.EXPENSES, newExpense);
  if (isSupabaseConfigured()) {
    supabase.from('expenses').upsert({
      id: newExpense.id,
      group_id: newExpense.groupId,
      description: newExpense.description,
      amount: newExpense.amount,
      currency: newExpense.currency,
      paid_by: newExpense.paidBy,
      splits: newExpense.splits,
      created_at: newExpense.createdAt,
    }).then(() => {}, () => enqueueUpsert(KEYS.EXPENSES, newExpense));
  }
  await addActivity({
    type: 'expense_added',
    expenseId: newExpense.id,
    description: newExpense.description,
    amount: newExpense.amount,
    groupId: newExpense.groupId,
    groupName: expense.groupName,
    userId: newExpense.paidBy.id,
    paidByName: newExpense.paidBy.name,
    createdAt: new Date().toISOString(),
  });
  return newExpense;
};

export const getExpenses = async (groupId) => {
  const expenses = await getData(KEYS.EXPENSES);
  return expenses
    .filter(e => e.groupId === groupId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

export const getAllExpenses = async (userId) => {
  const expenses = await getData(KEYS.EXPENSES);
  return expenses
    .filter(e => e.paidBy.id === userId || e.splits.some(s => s.userId === userId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

export const deleteExpense = async (expenseId) => {
  const expenses = await getData(KEYS.EXPENSES);
  await setData(KEYS.EXPENSES, expenses.filter(e => e.id !== expenseId));
  enqueueDelete(KEYS.EXPENSES, expenseId);
  if (isSupabaseConfigured()) {
    supabase.from('expenses').delete().eq('id', expenseId)
      .then(() => {}, () => enqueueDelete(KEYS.EXPENSES, expenseId));
  }
};

// --- Balances ---
export const calculateBalances = async (userId) => {
  const expenses = await getData(KEYS.EXPENSES);
  const settlements = await getData(KEYS.SETTLEMENTS);
  const balanceMap = {};

  expenses.forEach(expense => {
    const paidById = expense.paidBy.id;
    expense.splits.forEach(split => {
      if (split.userId === paidById) return;
      const key = [paidById, split.userId].sort().join('_');
      if (!balanceMap[key]) balanceMap[key] = { user1: paidById, user2: split.userId, amount: 0 };
      if (paidById === balanceMap[key].user1) {
        balanceMap[key].amount += split.amount;
      } else {
        balanceMap[key].amount -= split.amount;
      }
    });
  });

  settlements.forEach(s => {
    const key = [s.paidBy, s.paidTo].sort().join('_');
    if (!balanceMap[key]) balanceMap[key] = { user1: s.paidBy, user2: s.paidTo, amount: 0 };
    if (s.paidBy === balanceMap[key].user1) {
      balanceMap[key].amount -= s.amount;
    } else {
      balanceMap[key].amount += s.amount;
    }
  });

  const users = await getData(KEYS.USERS);
  const result = [];
  Object.values(balanceMap).forEach(b => {
    if (Math.abs(b.amount) < 0.01) return;
    if (b.user1 === userId || b.user2 === userId) {
      const otherUserId = b.user1 === userId ? b.user2 : b.user1;
      const otherUser = users.find(u => u.id === otherUserId);
      if (!otherUser) return;
      let amount = b.user1 === userId ? b.amount : -b.amount;
      result.push({
        userId: otherUserId,
        name: otherUser.name,
        email: otherUser.email,
        avatar: otherUser.avatar,
        amount,
      });
    }
  });
  return result;
};

export const calculateGroupBalances = async (groupId, members) => {
  const expenses = await getData(KEYS.EXPENSES);
  const settlements = await getData(KEYS.SETTLEMENTS);
  const groupExpenses = expenses.filter(e => e.groupId === groupId);
  const groupSettlements = settlements.filter(s => s.groupId === groupId);

  const balanceMap = {};
  members.forEach(m => balanceMap[m.id] = 0);

  groupExpenses.forEach(expense => {
    const paidById = expense.paidBy.id;
    if (balanceMap[paidById] !== undefined) balanceMap[paidById] += expense.amount;
    expense.splits.forEach(split => {
      if (balanceMap[split.userId] !== undefined) balanceMap[split.userId] -= split.amount;
    });
  });

  groupSettlements.forEach(s => {
    if (balanceMap[s.paidBy] !== undefined) balanceMap[s.paidBy] += s.amount;
    if (balanceMap[s.paidTo] !== undefined) balanceMap[s.paidTo] -= s.amount;
  });

  return members.map(m => ({
    ...m,
    balance: balanceMap[m.id] || 0,
  }));
};

// --- Settlements ---
export const recordSettlement = async (settlement) => {
  const settlements = await getData(KEYS.SETTLEMENTS);
  const newSettlement = {
    id: uuidv4(),
    ...settlement,
    createdAt: new Date().toISOString(),
  };
  await setData(KEYS.SETTLEMENTS, [...settlements, newSettlement]);
  enqueueUpsert(KEYS.SETTLEMENTS, newSettlement);
  if (isSupabaseConfigured()) {
    supabase.from('settlements').upsert({
      id: newSettlement.id,
      paid_by: newSettlement.paidBy,
      paid_to: newSettlement.paidTo,
      amount: newSettlement.amount,
      currency: newSettlement.currency,
      group_id: newSettlement.groupId,
      note: newSettlement.note || '',
      created_at: newSettlement.createdAt,
    }).then(() => {}, () => enqueueUpsert(KEYS.SETTLEMENTS, newSettlement));
  }
  await addActivity({
    type: 'settlement',
    settlementId: newSettlement.id,
    amount: newSettlement.amount,
    paidById: newSettlement.paidBy,
    paidToId: newSettlement.paidTo,
    userId: newSettlement.paidBy,
    createdAt: new Date().toISOString(),
  });
  return newSettlement;
};

// --- Activity ---
export const addActivity = async (activity) => {
  const activities = await getData(KEYS.ACTIVITY);
  const newActivity = { id: uuidv4(), ...activity };
  await setData(KEYS.ACTIVITY, [newActivity, ...activities].slice(0, 200));
  enqueueUpsert(KEYS.ACTIVITY, newActivity);
  if (isSupabaseConfigured()) {
    supabase.from('activity').upsert({
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
    }).then(() => {}, () => enqueueUpsert(KEYS.ACTIVITY, newActivity));
  }
};

export const getActivity = async (userId) => {
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
};

export const getUserById = async (userId) => {
  const users = await getData(KEYS.USERS);
  const user = users.find(u => u.id === userId);
  if (!user) return null;
  const { password: _, ...safeUser } = user;
  return safeUser;
};

export const searchUsersByEmail = async (email) => {
  const users = await getData(KEYS.USERS);
  return users
    .filter(u => u.email.toLowerCase().includes(email.toLowerCase()))
    .map(({ password: _, ...u }) => u);
};

// Sync all data from Supabase into local storage (source of truth pull)
export const syncFromSupabase = async (userId) => {
  if (!isSupabaseConfigured()) return;
  try {
    // Fetch groups (filter client-side by membership since members is JSONB)
    const { data: remoteGroups } = await supabase
      .from('groups').select('*').order('created_at', { ascending: false }).limit(200);
    const userGroups = (remoteGroups || []).filter(g =>
      Array.isArray(g.members) && g.members.some(m => m.id === userId)
    );

    // Fetch expenses for user's groups
    const groupIds = userGroups.map(g => g.id);
    let remoteExpenses = [];
    if (groupIds.length > 0) {
      const { data } = await supabase.from('expenses').select('*')
        .in('group_id', groupIds).order('created_at', { ascending: false }).limit(500);
      remoteExpenses = data || [];
    }

    // Fetch friends
    const { data: remoteFriends } = await supabase.from('friends').select('*')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    // Fetch settlements
    const { data: remoteSettlements } = await supabase.from('settlements').select('*')
      .or(`paid_by.eq.${userId},paid_to.eq.${userId}`)
      .order('created_at', { ascending: false }).limit(200);

    // Fetch activity
    const groupIdsStr = groupIds.join(',') || 'null';
    const { data: remoteActivity } = await supabase.from('activity').select('*')
      .or(`user_id.eq.${userId},group_id.in.(${groupIdsStr})`)
      .order('created_at', { ascending: false }).limit(100);

    // Fetch user profiles for all group members and friends
    const friendIds = (remoteFriends || []).map(f => f.user_id === userId ? f.friend_id : f.user_id);
    const memberIds = userGroups.flatMap(g => (g.members || []).map(m => m.id));
    const allUserIds = [...new Set([...friendIds, ...memberIds])].filter(id => id !== userId);
    let remoteUsers = [];
    if (allUserIds.length > 0) {
      const { data } = await supabase.from('users').select('id,name,email,avatar,phone,created_at').in('id', allUserIds);
      remoteUsers = data || [];
    }

    // Convert Supabase snake_case → local camelCase
    const localGroups = userGroups.map(g => ({
      id: g.id, name: g.name, description: g.description || '',
      createdBy: g.created_by, members: g.members || [],
      createdAt: g.created_at, updatedAt: g.updated_at,
    }));
    const localExpenses = remoteExpenses.map(e => ({
      id: e.id, groupId: e.group_id, description: e.description,
      amount: e.amount, currency: e.currency,
      paidBy: e.paid_by, splits: e.splits || [], createdAt: e.created_at,
    }));
    const localSettlements = (remoteSettlements || []).map(s => ({
      id: s.id, paidBy: s.paid_by, paidTo: s.paid_to,
      amount: s.amount, currency: s.currency,
      groupId: s.group_id, note: s.note || '', createdAt: s.created_at,
    }));
    const localFriends = (remoteFriends || []).map(f => ({
      id: f.id, userId: f.user_id, friendId: f.friend_id, createdAt: f.created_at,
    }));
    const localActivity = (remoteActivity || []).map(a => ({
      id: a.id, type: a.type, userId: a.user_id, groupId: a.group_id,
      expenseId: a.expense_id, description: a.description,
      amount: a.amount, groupName: a.group_name, paidByName: a.paid_by_name,
      createdAt: a.created_at,
    }));
    const localUsers = remoteUsers.map(u => ({
      id: u.id, name: u.name, email: u.email,
      avatar: u.avatar || null, phone: u.phone || '', createdAt: u.created_at,
    }));

    // Save to local storage (overwrite with Supabase as source of truth)
    await setData(KEYS.GROUPS, localGroups);
    await setData(KEYS.EXPENSES, localExpenses);
    await setData(KEYS.SETTLEMENTS, localSettlements);
    await setData(KEYS.FRIENDS, localFriends);
    if (localActivity.length > 0) await setData(KEYS.ACTIVITY, localActivity);

    // Merge users without losing current user's password cache
    const existingUsers = await getData(KEYS.USERS);
    const currentUserCached = existingUsers.find(u => u.id === userId);
    const mergedUsers = [...localUsers.filter(u => u.id !== userId)];
    if (currentUserCached) mergedUsers.push(currentUserCached);
    else mergedUsers.push({ id: userId });
    await setData(KEYS.USERS, mergedUsers);

    console.log(`[syncFromSupabase] groups:${localGroups.length} expenses:${localExpenses.length} friends:${localFriends.length}`);
    return { groups: localGroups.length, expenses: localExpenses.length };
  } catch (e) {
    console.error('[syncFromSupabase] failed:', e.message);
    return null;
  }
};

// Seed demo data
export const seedDemoData = async () => {
  const users = await getData(KEYS.USERS);
  if (users.length > 0) return;

  const alice = { id: 'demo-alice', name: 'Alice Demo', email: 'alice@demo.com', password: 'demo123', avatar: null, phone: '', createdAt: new Date().toISOString() };
  const bob = { id: 'demo-bob', name: 'Bob Demo', email: 'bob@demo.com', password: 'demo123', avatar: null, phone: '', createdAt: new Date().toISOString() };
  const carol = { id: 'demo-carol', name: 'Carol Demo', email: 'carol@demo.com', password: 'demo123', avatar: null, phone: '', createdAt: new Date().toISOString() };
  await setData(KEYS.USERS, [alice, bob, carol]);
};
