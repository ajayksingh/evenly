/**
 * HTTP API Client for Dropwizard REST backend.
 * Used by storage.js for all non-demo (real) users.
 */
import { supabase } from './supabase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

const getAuthHeader = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return {};
    return { Authorization: `Bearer ${session.access_token}` };
  } catch {
    return {};
  }
};

// ---------------------------------------------------------------------------
// Generic fetch helpers
// ---------------------------------------------------------------------------

const apiFetch = async (path, options = {}) => {
  try {
    const authHeader = await getAuthHeader();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      let message = 'API error';
      try {
        const body = await response.json();
        message = body.message || body.error || message;
      } catch {
        // body not JSON — keep default message
      }
      throw new Error(message);
    }
    // 204 No Content — return null
    if (response.status === 204) return null;
    return response.json();
  } catch (err) {
    throw err;
  }
};

const apiGet = async (path) =>
  apiFetch(path, { method: 'GET' });

const apiPost = async (path, body) =>
  apiFetch(path, { method: 'POST', body: JSON.stringify(body) });

const apiPatch = async (path, body) =>
  apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) });

const apiDel = async (path) =>
  apiFetch(path, { method: 'DELETE' });

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const upsertUserProfile = async (profile) =>
  apiPost('/api/v1/users/me', profile);

export const updateUserProfileRemote = async (userId, updates) =>
  apiPatch('/api/v1/users/me', updates);

export const searchUsersByEmailRemote = async (email) =>
  apiGet(`/api/v1/users/search?email=${encodeURIComponent(email)}`);

export const getUserByIdRemote = async (userId) =>
  apiGet(`/api/v1/users/${userId}`);

// ---------------------------------------------------------------------------
// Friends
// ---------------------------------------------------------------------------

export const getFriendsRemote = async (userId) =>
  apiGet('/api/v1/friends');

export const addFriendRemote = async (email) =>
  apiPost('/api/v1/friends', { email });

export const removeFriendRemote = async (friendId) =>
  apiDel(`/api/v1/friends/${friendId}`);

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export const getGroupsRemote = async (userId) =>
  apiGet('/api/v1/groups');

export const getGroupRemote = async (groupId) =>
  apiGet(`/api/v1/groups/${groupId}`);

export const createGroupRemote = async (group) =>
  apiPost('/api/v1/groups', group);

export const updateGroupRemote = async (groupId, updates) =>
  apiPatch(`/api/v1/groups/${groupId}`, updates);

export const addMemberToGroupRemote = async (groupId, user) =>
  apiPost(`/api/v1/groups/${groupId}/members`, { email: user.email });

export const getGroupBalancesRemote = async (groupId) =>
  apiGet(`/api/v1/groups/${groupId}/balances`);

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export const getExpensesRemote = async (groupId) =>
  apiGet(`/api/v1/groups/${groupId}/expenses`);

export const getAllExpensesRemote = async (userId) =>
  apiGet('/api/v1/expenses');

export const addExpenseRemote = async (expense) =>
  apiPost(`/api/v1/groups/${expense.groupId}/expenses`, expense);

export const deleteExpenseRemote = async (expenseId, groupId) =>
  apiDel(`/api/v1/expenses/${expenseId}`);

// ---------------------------------------------------------------------------
// Settlements
// ---------------------------------------------------------------------------

export const recordSettlementRemote = async (settlement) =>
  apiPost(`/api/v1/groups/${settlement.groupId || 'none'}/settlements`, settlement);

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export const getActivityRemote = async (userId) =>
  apiGet('/api/v1/activity');

// ---------------------------------------------------------------------------
// Balance calculations — delegate to server
// ---------------------------------------------------------------------------

export const calculateBalancesRemote = async (userId) =>
  apiGet('/api/v1/balances');
