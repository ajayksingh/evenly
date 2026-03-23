/**
 * Storage Service - Supabase as primary data store
 * All reads and writes go directly to Supabase.
 * AsyncStorage is only used for the current user session + demo account data.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';
import {
  getFriendsRemote, addFriendRemote,
  getGroupsRemote, getGroupRemote, createGroupRemote, updateGroupRemote,
  addMemberToGroupRemote, getGroupBalancesRemote,
  getExpensesRemote, getAllExpensesRemote, addExpenseRemote, deleteExpenseRemote,
  recordSettlementRemote, getActivityRemote, calculateBalancesRemote,
  getUserByIdRemote, searchUsersByEmailRemote, updateUserProfileRemote,
  upsertUserProfile,
} from './api';

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

// --- Auth ---
const DEMO_EMAILS = ['alice@demo.com', 'bob@demo.com', 'carol@demo.com'];

export const registerUser = async ({ name, email, password }) => {
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
  if (DEMO_EMAILS.includes(email)) {
    await seedDemoData();
    const users = await getData(KEYS.USERS);
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) throw new Error('Invalid email or password');
    const { password: _, ...safeUser } = user;
    await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(safeUser));
    return safeUser;
  }

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
  // Ensure profile is synced to backend
  upsertUserProfile(profile).catch(() => {});
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
    if (!userData) return null;
    const profile = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      avatar: userData.avatar || null,
      phone: userData.phone || '',
      createdAt: userData.created_at,
    };
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
  const updated = await updateUserProfileRemote(userId, updates);
  await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(updated));
  return updated;
};

// --- Friends ---
export const addFriend = async (currentUserId, email) => {
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

  return await addFriendRemote(email);
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

  const friends = await getFriendsRemote(userId);
  return friends;
};

// --- Groups ---
export const createGroup = async (group) => {
  if (isDemo(group.createdBy)) {
    const groups = await getData(KEYS.GROUPS);
    const newGroup = { id: uuidv4(), ...group, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await setData(KEYS.GROUPS, [...groups, newGroup]);
    await addActivity({ type: 'group_created', groupId: newGroup.id, groupName: newGroup.name, userId: group.createdBy, createdAt: new Date().toISOString() });
    return newGroup;
  }

  const payload = { name: group.name, type: group.type || 'other', description: group.description || '', members: group.members };
  const created = await createGroupRemote(payload);
  await addActivity({ type: 'group_created', groupId: created.id, groupName: created.name, userId: group.createdBy, createdAt: new Date().toISOString() });
  return created;
};

export const getGroups = async (userId, userEmail = null) => {
  if (isDemo(userId)) {
    const groups = await getData(KEYS.GROUPS);
    return groups.filter(g => g.members.some(m => m.id === userId));
  }

  const groups = await getGroupsRemote(userId);
  return groups;
};

export const getGroup = async (groupId) => {
  // Always check local storage first (demo groups stored here)
  const localGroups = await getData(KEYS.GROUPS);
  const localGroup = localGroups.find(g => g.id === groupId);
  if (localGroup) return localGroup;
  const group = await getGroupRemote(groupId);
  return group;
};

export const updateGroup = async (groupId, updates) => {
  const localGroups = await getData(KEYS.GROUPS);
  const idx = localGroups.findIndex(g => g.id === groupId);
  if (idx !== -1) {
    localGroups[idx] = { ...localGroups[idx], ...updates, updatedAt: new Date().toISOString() };
    await setData(KEYS.GROUPS, localGroups);
    return localGroups[idx];
  }
  return await updateGroupRemote(groupId, updates);
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
  return await addMemberToGroupRemote(groupId, user);
};

// --- Expenses ---
export const addExpense = async (expense) => {
  if (isDemo(expense.paidBy?.id)) {
    const expenses = await getData(KEYS.EXPENSES);
    const newExpense = { id: uuidv4(), ...expense, createdAt: new Date().toISOString() };
    await setData(KEYS.EXPENSES, [...expenses, newExpense]);
    await addActivity({ type: 'expense_added', expenseId: newExpense.id, description: newExpense.description, amount: newExpense.amount, groupId: newExpense.groupId, groupName: expense.groupName, userId: newExpense.paidBy.id, paidByName: newExpense.paidBy.name, createdAt: new Date().toISOString() });
    return newExpense;
  }

  const created = await addExpenseRemote(expense);
  await addActivity({ type: 'expense_added', expenseId: created.id, description: created.description, amount: created.amount, groupId: created.groupId, groupName: expense.groupName, userId: created.paidBy?.id, paidByName: created.paidBy?.name, createdAt: new Date().toISOString() });
  return created;
};

export const getExpenses = async (groupId) => {
  // Check if this is a local (demo) group — use local storage if so
  const localGroups = await getData(KEYS.GROUPS);
  if (localGroups.some(g => g.id === groupId)) {
    const expenses = await getData(KEYS.EXPENSES);
    return expenses.filter(e => e.groupId === groupId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  return await getExpensesRemote(groupId);
};

export const getAllExpenses = async (userId) => {
  if (isDemo(userId)) {
    const expenses = await getData(KEYS.EXPENSES);
    return expenses.filter(e => e.paidBy.id === userId || e.splits.some(s => s.userId === userId)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  return await getAllExpensesRemote(userId);
};

export const deleteExpense = async (expenseId) => {
  const localExpenses = await getData(KEYS.EXPENSES);
  if (localExpenses.find(e => e.id === expenseId)) {
    await setData(KEYS.EXPENSES, localExpenses.filter(e => e.id !== expenseId));
    return;
  }
  await deleteExpenseRemote(expenseId, null);
};

// --- Balances ---
export const calculateBalances = async (userId) => {
  if (isDemo(userId)) {
    const expenses = await getData(KEYS.EXPENSES);
    const settlements = await getData(KEYS.SETTLEMENTS);
    const users = await getData(KEYS.USERS);
    return _calculateBalancesFromData(userId, expenses, settlements, users);
  }

  return await calculateBalancesRemote(userId);
};

const _calculateBalancesFromData = (userId, expenses, settlements, users) => {
  const balanceMap = {};
  expenses.forEach(expense => {
    const paidById = expense.paidBy?.id || expense.paidBy;
    expense.splits.forEach(split => {
      if (split.userId === paidById) return;
      const key = [paidById, split.userId].sort().join('_');
      if (!balanceMap[key]) balanceMap[key] = { user1: paidById, user2: split.userId, amount: 0 };
      if (paidById === balanceMap[key].user1) balanceMap[key].amount += split.amount;
      else balanceMap[key].amount -= split.amount;
    });
  });
  settlements.forEach(s => {
    const key = [s.paidBy, s.paidTo].sort().join('_');
    if (!balanceMap[key]) balanceMap[key] = { user1: s.paidBy, user2: s.paidTo, amount: 0 };
    if (s.paidBy === balanceMap[key].user1) balanceMap[key].amount -= s.amount;
    else balanceMap[key].amount += s.amount;
  });
  const result = [];
  Object.values(balanceMap).forEach(b => {
    if (Math.abs(b.amount) < 0.01) return;
    if (b.user1 === userId || b.user2 === userId) {
      const otherUserId = b.user1 === userId ? b.user2 : b.user1;
      const otherUser = users.find(u => u.id === otherUserId);
      if (!otherUser) return;
      const amount = b.user1 === userId ? b.amount : -b.amount;
      result.push({ userId: otherUserId, name: otherUser.name, email: otherUser.email, avatar: otherUser.avatar, amount });
    }
  });
  return result;
};

export const calculateGroupBalances = async (groupId, members) => {
  if (isDemo(members[0]?.id)) {
    const expenses = await getData(KEYS.EXPENSES);
    const settlements = await getData(KEYS.SETTLEMENTS);
    const groupExpenses = expenses.filter(e => e.groupId === groupId);
    const groupSettlements = settlements.filter(s => s.groupId === groupId);
    return _calculateGroupBalancesFromData(groupId, members, groupExpenses, groupSettlements);
  }

  return await getGroupBalancesRemote(groupId);
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

  return members.map(m => ({ ...m, balance: balanceMap[m.id] || 0 }));
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

  const created = await recordSettlementRemote(settlement);
  await addActivity({ type: 'settlement', settlementId: created.id, amount: created.amount, paidById: created.paidBy, paidToId: created.paidTo, userId: created.paidBy, createdAt: new Date().toISOString() });
  return created;
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
  await supabase.from('activity').upsert({
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

export const getActivity = async (userId) => {
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

  return await getActivityRemote(userId);
};

export const getUserById = async (userId) => {
  if (isDemo(userId)) {
    const users = await getData(KEYS.USERS);
    const user = users.find(u => u.id === userId);
    if (!user) return null;
    const { password: _, ...safeUser } = user;
    return safeUser;
  }
  return await getUserByIdRemote(userId);
};

export const searchUsersByEmail = async (email) => {
  // Always check local users first (demo users stored here)
  const localUsers = await getData(KEYS.USERS);
  const localMatches = localUsers.filter(u => u.email && u.email.toLowerCase().includes(email.toLowerCase())).map(({ password: _, ...u }) => u);
  if (localMatches.length > 0) return localMatches;
  return await searchUsersByEmailRemote(email);
};

// syncFromSupabase is no longer needed — reads go directly to Supabase.
// Kept as a no-op for compatibility with any remaining call sites.
export const syncFromSupabase = async (userId, userEmail) => {
  return { groups: 0, expenses: 0 };
};

// Seed demo data (local only)
export const seedDemoData = async () => {
  const users = await getData(KEYS.USERS);
  if (users.length > 0) return;
  const alice = { id: 'demo-alice', name: 'Alice Demo', email: 'alice@demo.com', password: 'demo123', avatar: null, phone: '', createdAt: new Date().toISOString() };
  const bob = { id: 'demo-bob', name: 'Bob Demo', email: 'bob@demo.com', password: 'demo123', avatar: null, phone: '', createdAt: new Date().toISOString() };
  const carol = { id: 'demo-carol', name: 'Carol Demo', email: 'carol@demo.com', password: 'demo123', avatar: null, phone: '', createdAt: new Date().toISOString() };
  await setData(KEYS.USERS, [alice, bob, carol]);
};
