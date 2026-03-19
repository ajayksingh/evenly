/**
 * Local Storage Service - AsyncStorage based
 * Acts as primary data store with optional Firebase sync
 * Free, offline-first approach
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

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
export const registerUser = async ({ name, email, password }) => {
  const users = await getData(KEYS.USERS);
  if (users.find(u => u.email === email)) {
    throw new Error('Email already in use');
  }
  const user = {
    id: uuidv4(),
    name,
    email,
    password, // In production, hash this!
    avatar: null,
    phone: '',
    createdAt: new Date().toISOString(),
  };
  await setData(KEYS.USERS, [...users, user]);
  const { password: _, ...safeUser } = user;
  await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(safeUser));
  return safeUser;
};

export const loginUser = async ({ email, password }) => {
  const users = await getData(KEYS.USERS);
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) throw new Error('Invalid email or password');
  const { password: _, ...safeUser } = user;
  await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(safeUser));
  return safeUser;
};

/**
 * Login or register user with OAuth credentials
 * Used for Google Sign-In and other OAuth providers
 */
export const loginOrRegisterOAuthUser = async ({ id, name, email, avatar, provider }) => {
  const users = await getData(KEYS.USERS);
  let user = users.find(u => u.email === email);

  if (!user) {
    // Register new OAuth user
    user = {
      id: uuidv4(),
      name: name || email.split('@')[0],
      email,
      password: null, // No password for OAuth
      avatar: avatar || null,
      phone: '',
      provider,
      oauthId: id,
      createdAt: new Date().toISOString(),
    };
    await setData(KEYS.USERS, [...users, user]);
  } else {
    // Update existing user with OAuth info if not already set
    if (!user.provider) {
      user.provider = provider;
      user.oauthId = id;
      if (!user.avatar) user.avatar = avatar;
      await setData(KEYS.USERS, users);
    }
  }

  const { password: _, ...safeUser } = user;
  await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(safeUser));
  return safeUser;
};

export const logoutUser = async () => {
  await AsyncStorage.removeItem(KEYS.CURRENT_USER);
};

export const getCurrentUser = async () => {
  try {
    const user = await AsyncStorage.getItem(KEYS.CURRENT_USER);
    return user ? JSON.parse(user) : null;
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
  return safeUser;
};

// --- Friends ---
export const addFriend = async (currentUserId, email) => {
  const users = await getData(KEYS.USERS);
  const friend = users.find(u => u.email === email);
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
  const groups = await getData(KEYS.GROUPS);
  const newGroup = {
    id: uuidv4(),
    ...group,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await setData(KEYS.GROUPS, [...groups, newGroup]);
  await addActivity({
    type: 'group_created',
    groupId: newGroup.id,
    groupName: newGroup.name,
    userId: group.createdBy,
    createdAt: new Date().toISOString(),
  });
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
};

// --- Balances ---
export const calculateBalances = async (userId) => {
  const expenses = await getData(KEYS.EXPENSES);
  const settlements = await getData(KEYS.SETTLEMENTS);
  const balanceMap = {};

  // Process expenses
  expenses.forEach(expense => {
    const paidById = expense.paidBy.id;
    expense.splits.forEach(split => {
      if (split.userId === paidById) return; // skip self
      const key = [paidById, split.userId].sort().join('_');
      if (!balanceMap[key]) balanceMap[key] = { user1: paidById, user2: split.userId, amount: 0 };
      // positive = user1 is owed by user2
      if (paidById === balanceMap[key].user1) {
        balanceMap[key].amount += split.amount;
      } else {
        balanceMap[key].amount -= split.amount;
      }
    });
  });

  // Process settlements
  settlements.forEach(s => {
    const key = [s.paidBy, s.paidTo].sort().join('_');
    if (!balanceMap[key]) balanceMap[key] = { user1: s.paidBy, user2: s.paidTo, amount: 0 };
    if (s.paidBy === balanceMap[key].user1) {
      balanceMap[key].amount -= s.amount; // payer reduces debt
    } else {
      balanceMap[key].amount += s.amount;
    }
  });

  // Convert to user-centric array
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
        amount, // positive = they owe me, negative = I owe them
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
};

export const getActivity = async (userId) => {
  const activities = await getData(KEYS.ACTIVITY);
  const expenses = await getData(KEYS.EXPENSES);
  const groups = await getData(KEYS.GROUPS);
  // Return activity relevant to user
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

// Seed demo data
export const seedDemoData = async () => {
  const users = await getData(KEYS.USERS);
  if (users.length > 0) return; // Already seeded

  const alice = { id: 'demo-alice', name: 'Alice Demo', email: 'alice@demo.com', password: 'demo123', avatar: null, phone: '', createdAt: new Date().toISOString() };
  const bob = { id: 'demo-bob', name: 'Bob Demo', email: 'bob@demo.com', password: 'demo123', avatar: null, phone: '', createdAt: new Date().toISOString() };
  const carol = { id: 'demo-carol', name: 'Carol Demo', email: 'carol@demo.com', password: 'demo123', avatar: null, phone: '', createdAt: new Date().toISOString() };
  await setData(KEYS.USERS, [alice, bob, carol]);
};
