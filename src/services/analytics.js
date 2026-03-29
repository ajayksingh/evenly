/**
 * Analytics Service
 * Logs events to console in dev mode only.
 * Supabase analytics table writes removed to conserve free-tier DB space.
 */

let currentUserId = null;

export const setAnalyticsUser = (userId) => {
  currentUserId = userId;
};

const log = async (event, params = {}) => {
  if (__DEV__) {
    console.log(`[Analytics] ${event}`, params);
  }
};

export const Analytics = {
  // Auth
  login: (method = 'email') => log('login', { method }),
  register: (method = 'email') => log('register', { method }),
  logout: () => log('logout'),

  // Core actions
  addExpense: (amount, currency, groupId) =>
    log('add_expense', { amount, currency, group_id: groupId }),
  deleteExpense: (expenseId) => log('delete_expense', { expense_id: expenseId }),
  settleUp: (amount, currency) => log('settle_up', { amount, currency }),
  createGroup: (memberCount) => log('create_group', { member_count: memberCount }),
  addFriend: () => log('add_friend'),
  updateProfile: () => log('update_profile'),
  changeCurrency: (currency) => log('change_currency', { currency }),

  // Sync
  syncCompleted: (count) => log('sync_completed', { items_synced: count }),
  offlineSave: (action) => log('offline_save', { action }),
  syncError: (error) => log('sync_error', { error }),

  // Navigation
  screenView: (screen) => log('screen_view', { screen }),

  // WhatsApp
  whatsappNotify: (type) => log('whatsapp_notify', { type }),
};
