import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
let NetInfo;
try { NetInfo = require('@react-native-community/netinfo').default; } catch (_) {}
import {
  getCurrentUser, loginUser, registerUser, logoutUser, resetPasswordForEmail,
  getGroups, getFriends, calculateBalances,
  getActivity, getGroupInvites, seedDemoData,
  getFriendRequests, respondToFriendRequest,
} from '../services/storage';
import { loadSelectedCurrency, saveSelectedCurrency, detectDefaultCurrency } from '../services/currency';
import { Analytics, setAnalyticsUser } from '../services/analytics';
import { supabase, isSupabaseConfigured } from '../services/supabase';

const AppContext = createContext({});

// How often to poll Supabase for remote changes (ms)
const POLL_INTERVAL_MS = 30000;

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [friends, setFriends] = useState([]);
  const [balances, setBalances] = useState([]);
  const [activity, setActivity] = useState([]);
  const [groupInvites, setGroupInvites] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [currency, setCurrencyState] = useState('INR');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Network & sync state
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState(null); // null | 'offline' | 'syncing' | 'synced' | 'error'
  const syncTimeoutRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const userRef = useRef(null);

  // Keep userRef in sync so polling closure always has latest user
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    seedDemoData();
    loadSelectedCurrency().then(c => setCurrencyState(c));
  }, []);

  useEffect(() => {
    const restore = async () => {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setAnalyticsUser(currentUser.id);
      }
      setLoading(false);
    };
    restore();
  }, []);

  // Supabase auth state listener — handles session expiry and sign-out across devices
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setSyncStatus(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadData = useCallback(async () => {
    if (!userRef.current) return;
    try {
      const { id, email } = userRef.current;
      // Fetch groups first so groupIds can be reused — avoids 2 extra getGroups calls
      const g = await getGroups(id, email);
      const groupIds = g.map(gr => gr.id);
      const [f, b, a, inv, fr] = await Promise.all([
        getFriends(id),
        calculateBalances(id, email, groupIds),
        getActivity(id, groupIds),
        getGroupInvites(id),
        getFriendRequests(id),
      ]);
      setGroups(g); setFriends(f); setBalances(b); setActivity(a); setGroupInvites(inv); setFriendRequests(fr);
    } catch (e) {
      console.error('Load data error:', e);
    }
  }, []);

  // Network listener — reload data when coming back online
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleOnline = () => { setIsOnline(true); loadData().catch(() => {}); };
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
    if (!NetInfo) return;
    let unsubscribe;
    try {
      unsubscribe = NetInfo.addEventListener((state) => {
        const online = state.isConnected && state.isInternetReachable !== false;
        setIsOnline(online);
        if (online) loadData().catch(() => {});
      });
    } catch (_) {
      // NetInfo unavailable (e.g. web fallback missing); silently ignore
      return;
    }
    return () => unsubscribe();
  }, [loadData]);

  const triggerSync = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const clearSyncStatusAfter = (ms) => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => setSyncStatus(null), ms);
  };

  // Called after any write operation to refresh data
  const notifyWrite = useCallback(async (action) => {
    if (!isOnline) {
      setSyncStatus('offline');
      Analytics.offlineSave(action);
      return;
    }
    try {
      await loadData();
      setSyncStatus('synced');
      clearSyncStatusAfter(1500);
    } catch (e) {
      setSyncStatus('error');
      clearSyncStatusAfter(3000);
    }
  }, [isOnline, loadData]);

  useEffect(() => {
    if (user) {
      loadData();
    } else {
      setGroups([]); setFriends([]); setBalances([]); setActivity([]); setGroupInvites([]); setFriendRequests([]);
    }
  }, [user, refreshTrigger, loadData]);

  const refresh = useCallback(() => {
    setRefreshTrigger(t => t + 1);
  }, []);

  const syncData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  // Background polling: pull remote changes every 30 seconds while logged in
  useEffect(() => {
    if (!user || !isSupabaseConfigured()) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    const poll = async () => {
      if (!userRef.current) return;
      try { await loadData(); } catch (e) { console.error('[Sync] polling error:', e); }
    };

    // Start polling
    pollIntervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [user, loadData]);

  // Supabase Realtime: subscribe to changes in groups/expenses/settlements/friends
  useEffect(() => {
    if (!user || !supabase || !isSupabaseConfigured()) return;

    const channel = supabase
      .channel(`user-sync-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => { loadData().catch(() => {}); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => { loadData().catch(() => {}); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements' }, () => { loadData().catch(() => {}); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends' }, () => { loadData().catch(() => {}); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity' }, () => { loadData().catch(() => {}); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_invites' }, () => { loadData().catch(() => {}); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, () => { loadData().catch(() => {}); })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadData]);

  const setCurrency = async (code) => {
    setCurrencyState(code);
    await saveSelectedCurrency(code);
    Analytics.changeCurrency(code);
  };

  const login = async (email, password) => {
    const loggedIn = await loginUser({ email, password });
    setUser(loggedIn);
    setAnalyticsUser(loggedIn.id);
    Analytics.login('email');
    return loggedIn;
  };

  const register = async (name, email, password) => {
    const registered = await registerUser({ name, email, password });
    setUser(registered);
    setAnalyticsUser(registered.id);
    Analytics.register('email');
    return registered;
  };

  const logout = async () => {
    Analytics.logout();
    await logoutUser();
    setUser(null);
    setSyncStatus(null);
  };

  const resetPassword = async (email) => {
    await resetPasswordForEmail(email);
  };

  const totalBalance = balances.reduce((sum, b) => sum + b.amount, 0);

  return (
    <AppContext.Provider value={{
      user, setUser, loading,
      groups, friends, balances, activity, groupInvites, friendRequests,
      totalBalance, currency, setCurrency,
      login, register, logout, resetPassword,
      refresh, loadData, syncData,
      respondToFriendRequest,
      // Sync & network
      isOnline, syncStatus,
      notifyWrite, triggerSync,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
