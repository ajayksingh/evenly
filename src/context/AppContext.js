import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Platform } from 'react-native';
let NetInfo;
try { NetInfo = require('@react-native-community/netinfo').default; } catch (_) {}
import {
  getCurrentUser, loginUser, logoutUser, handleOAuthSession,
  getGroups, getFriends, calculateBalances,
  getActivity, getGroupInvites, seedDemoData,
  getFriendRequests, respondToFriendRequest,
  handleInviteLink, addMemberToGroup, getGroup,
  storeInviteContext, getAndClearInviteContext, matchContactsToUsers,
} from '../services/storage';
import { getContactsIfPermitted } from '../services/contacts';
import { loadSelectedCurrency, saveSelectedCurrency, detectDefaultCurrency } from '../services/currency';
import { Analytics, setAnalyticsUser } from '../services/analytics';
import { requestNotificationPermission, scheduleWeeklyReminder, cancelAllNotifications, showExpenseNotification } from '../services/notifications';
import { supabase, isSupabaseConfigured, oauthRedirectUri } from '../services/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

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
  const [contactMatches, setContactMatches] = useState([]); // Feature #11: contacts who joined Evenly

  // Network & sync state
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState(null); // null | 'offline' | 'syncing' | 'synced' | 'error'
  const syncTimeoutRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const userRef = useRef(null);
  const loadingRef = useRef(null); // Prevents concurrent loadData calls
  const realtimeActiveRef = useRef(false); // Skip polling when realtime is active
  const lastLoadTimestampRef = useRef(0); // Stale-time tracking for screen focus
  const syncScheduledRef = useRef(false); // Debounce realtime change handlers

  // Keep userRef in sync so polling closure always has latest user
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    loadSelectedCurrency().then(c => setCurrencyState(c));
    const restore = async () => {
      const t0 = Date.now();
      const currentUser = await getCurrentUser();
      __DEV__ && console.log(`[perf] getCurrentUser: ${Date.now() - t0}ms, found: ${!!currentUser}`);
      if (currentUser) {
        setUser(currentUser);
        setAnalyticsUser(currentUser.id);
      } else {
        // Only seed demo data if no authenticated user — saves startup time for real users
        await seedDemoData();
      }
      setLoading(false);
    };
    restore();
  }, []);

  // Handle OAuth deep link on app restart (Android relaunches activity)
  useEffect(() => {
    if (user) return; // Already logged in
    const handleDeepLink = async (url) => {
      if (!url || !url.includes('access_token')) return;
      try {
        const hashPart = url.includes('#') ? url.split('#')[1] : '';
        const queryPart = url.includes('?') ? url.split('?')[1] : '';
        const params = new URLSearchParams(hashPart || queryPart);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          __DEV__ && console.log('Deep link OAuth: setting session from URL');
          await supabase.auth.setSession({ access_token, refresh_token });
        }
      } catch (e) {
        console.error('Deep link OAuth error:', e);
      }
    };
    // Check initial URL (app was launched/restarted by the deep link)
    if (Platform.OS !== 'web') {
      Linking.getInitialURL().then(handleDeepLink).catch(() => {});
      // Also listen for URL while app is running
      const sub = Linking.addEventListener('url', (event) => handleDeepLink(event.url));
      return () => sub.remove();
    }
  }, [user]);

  // Handle invite link on app open (Feature #2) + persist context for auto-join (Feature #10)
  useEffect(() => {
    const checkInviteLink = async () => {
      try {
        let inviteUserId = null;
        let joinGroupId = null;
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          inviteUserId = params.get('invite');
          joinGroupId = params.get('joinGroup');
          if (inviteUserId || joinGroupId) {
            window.history.replaceState({}, '', window.location.pathname);
          }
        } else {
          const url = await Linking.getInitialURL();
          if (url) {
            const parsed = Linking.parse(url);
            inviteUserId = parsed.queryParams?.invite || null;
            joinGroupId = parsed.queryParams?.joinGroup || null;
          }
        }

        if (!user) {
          // Feature #10: User not logged in yet — store invite context for after signup
          if (inviteUserId) await storeInviteContext({ type: 'invite', id: inviteUserId });
          if (joinGroupId) await storeInviteContext({ type: 'joinGroup', id: joinGroupId });
          return;
        }

        // User is logged in — process immediately (loadData called by main user effect)
        if (inviteUserId) {
          await handleInviteLink(inviteUserId, user.id);
        }
        if (joinGroupId) {
          try {
            const grp = await getGroup(joinGroupId);
            if (grp && !grp.members.find(m => m.id === user.id)) {
              await addMemberToGroup(joinGroupId, { id: user.id, name: user.name, email: user.email, avatar: user.avatar });
            }
          } catch (e) {
            console.error('Join group link error:', e);
          }
        }
      } catch (e) {
        console.error('Invite link handling error:', e);
      }
    };
    checkInviteLink();
  }, [user]);

  // Feature #10: Process stored invite context after login
  useEffect(() => {
    if (!user) return;
    const processStoredInvite = async () => {
      try {
        const ctx = await getAndClearInviteContext();
        if (!ctx) return;
        if (ctx.type === 'invite' && ctx.id) {
          await handleInviteLink(ctx.id, user.id);
        } else if (ctx.type === 'joinGroup' && ctx.id) {
          const grp = await getGroup(ctx.id);
          if (grp && !grp.members.find(m => m.id === user.id)) {
            await addMemberToGroup(ctx.id, { id: user.id, name: user.name, email: user.email, avatar: user.avatar });
          }
        }
      } catch (e) {
        console.error('Process stored invite error:', e);
      }
    };
    processStoredInvite();
  }, [user]);

  // Supabase auth state listener — handles OAuth callback and sign-out
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      __DEV__ && console.log('Auth state change:', event, !!session);
      // Clean up OAuth tokens from URL on web to prevent reload loops
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hash?.includes('access_token')) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && session) {
        // Skip if user is already restored from cache — avoid duplicate loadData
        if (event === 'INITIAL_SESSION' && userRef.current) {
          __DEV__ && console.log('[perf] Skipping INITIAL_SESSION — user already restored from cache');
          return;
        }
        try {
          __DEV__ && console.log('Handling OAuth session for event:', event);
          // Race against a timeout — if Supabase upsert hangs, use basic profile
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000));
          let profile;
          try {
            profile = await Promise.race([handleOAuthSession(session), timeoutPromise]);
          } catch (e) {
            console.warn('handleOAuthSession timed out or failed, using basic profile:', e.message);
            const { user: authUser } = session;
            profile = {
              id: authUser.id,
              name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
              email: authUser.email,
              avatar: authUser.user_metadata?.avatar_url || null,
              phone: '',
              createdAt: new Date().toISOString(),
            };
          }
          __DEV__ && console.log('OAuth profile set:', profile?.name);
          setUser(profile);
          setAnalyticsUser(profile.id);
          Analytics.login(session.user.app_metadata?.provider || 'oauth');
        } catch (e) {
          console.error('OAuth session handling failed completely:', e);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setSyncStatus(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadData = useCallback(async (force = false) => {
    // Deduplicate: if already loading, return the existing promise
    if (loadingRef.current) return loadingRef.current;
    if (!userRef.current) return;
    // Stale-time gate: skip if last load was within 5 seconds (unless forced)
    if (!force && Date.now() - lastLoadTimestampRef.current < 5000) return;
    loadingRef.current = (async () => {
      try {
        const t0 = Date.now();
        const { id, email } = userRef.current;
        // Phase 1: Fetch groups + independent queries in parallel
        const [g, f, inv, fr] = await Promise.all([
          getGroups(id, email),
          getFriends(id),
          getGroupInvites(id),
          getFriendRequests(id),
        ]);
        __DEV__ && console.log(`[perf] Phase 1 done: ${Date.now() - t0}ms`);
        // Set phase 1 data immediately so UI renders with groups/friends
        setGroups(g); setFriends(f); setGroupInvites(inv); setFriendRequests(fr);

        // Phase 2: Queries that depend on groupIds
        const t1 = Date.now();
        const groupIds = g.map(gr => gr.id);
        const [b, a] = await Promise.all([
          calculateBalances(id, email, groupIds),
          getActivity(id, groupIds),
        ]);
        __DEV__ && console.log(`[perf] Phase 2 done: ${Date.now() - t1}ms (total: ${Date.now() - t0}ms)`);
        setBalances(b); setActivity(a);
        lastLoadTimestampRef.current = Date.now();
      } catch (e) {
        console.error('Load data error:', e);
      } finally {
        loadingRef.current = null;
      }
    })();
    return loadingRef.current;
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
    await loadData(true);
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
      await loadData(true);
      setSyncStatus('synced');
      clearSyncStatusAfter(1500);
    } catch (e) {
      setSyncStatus('error');
      clearSyncStatusAfter(3000);
    }
  }, [isOnline, loadData]);

  useEffect(() => {
    if (user) {
      // Load data first — don't block on notification permission
      loadData();
      // Request notification permission AFTER a delay so it doesn't block the home screen render
      const notifTimer = setTimeout(() => {
        requestNotificationPermission().then(() => {
          const owedBalances = (balances || []).filter(b => b.amount > 0);
          const totalOwed = owedBalances.reduce((s, b) => s + b.amount, 0);
          scheduleWeeklyReminder(totalOwed, owedBalances.length);
        }).catch(() => {});
      }, 3000);
      return () => clearTimeout(notifTimer);
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
      if (realtimeActiveRef.current) return; // Skip poll when realtime is active
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

  // Debounced sync handler — batches multiple realtime events into one loadData call
  const scheduleSync = useCallback(() => {
    if (syncScheduledRef.current) return;
    syncScheduledRef.current = true;
    setTimeout(() => {
      loadData().catch(() => {});
      syncScheduledRef.current = false;
    }, 500);
  }, [loadData]);

  // Supabase Realtime: subscribe to changes (native only — web uses polling)
  useEffect(() => {
    if (!user || !supabase || !isSupabaseConfigured() || Platform.OS === 'web') return;

    const channel = supabase
      .channel(`user-sync-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => scheduleSync())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, (payload) => {
        scheduleSync();
        try {
          if (payload?.eventType === 'INSERT' && payload.new) {
            const expense = payload.new;
            if (expense.paid_by !== user.id) {
              showExpenseNotification(expense.description || 'Expense', expense.amount || '', expense.paid_by_name || 'Someone');
            }
          }
        } catch (e) { console.warn('Expense notification error:', e); }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements' }, () => scheduleSync())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends' }, () => scheduleSync())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity' }, () => scheduleSync())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_invites' }, () => scheduleSync())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, () => scheduleSync())
      .subscribe();

    realtimeActiveRef.current = true;

    return () => {
      realtimeActiveRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [user, loadData, scheduleSync]);

  const setCurrency = async (code) => {
    setCurrencyState(code);
    await saveSelectedCurrency(code);
    Analytics.changeCurrency(code);
  };

  // Demo account login (kept for testing)
  const login = async (email, password) => {
    const loggedIn = await loginUser({ email, password });
    setUser(loggedIn);
    setAnalyticsUser(loggedIn.id);
    Analytics.login('demo');
    return loggedIn;
  };

  // OAuth sign-in — opens browser for Google/GitHub/Apple
  const signInWithOAuth = async (provider) => {
    if (!isSupabaseConfigured()) throw new Error('No network connection.');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: Platform.OS === 'web' ? window.location.origin + '/evenly/' : oauthRedirectUri,
        skipBrowserRedirect: Platform.OS !== 'web',
      },
    });
    if (error) throw error;
    // On native, open the auth URL in an in-app browser
    if (Platform.OS !== 'web' && data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        oauthRedirectUri,
        { showInRecents: true, createTask: false }
      );
      __DEV__ && console.log('OAuth result:', result.type);
      if (result.type === 'success' && result.url) {
        const redirectUrl = result.url;
        const hashPart = redirectUrl.includes('#') ? redirectUrl.split('#')[1] : '';
        const queryPart = redirectUrl.includes('?') ? redirectUrl.split('?')[1] : '';
        const tokenString = hashPart || queryPart;
        const params = new URLSearchParams(tokenString);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        } else {
          await supabase.auth.getSession();
        }
      }
    }
  };

  const logout = async () => {
    Analytics.logout();
    try { await cancelAllNotifications(); } catch (e) { console.warn('Cancel notifications on logout error:', e); }
    await logoutUser();
    setUser(null);
    setSyncStatus(null);
  };

  // Feature #11: Contact sync & auto-match — delayed 5s to not compete with initial load
  useEffect(() => {
    if (!user || Platform.OS === 'web' || friends.length === 0) return;
    const timerId = setTimeout(async () => {
      try {
        const deviceContacts = await getContactsIfPermitted();
        if (deviceContacts.length === 0) return;
        const matches = await matchContactsToUsers(deviceContacts);
        const newMatches = matches.filter(m => !friends.some(f => f.id === m.id) && m.id !== user.id);
        if (newMatches.length > 0) setContactMatches(newMatches);
      } catch (e) {
        console.error('Contact sync error:', e);
      }
    }, 5000);
    return () => clearTimeout(timerId);
  }, [user?.id, friends.length]);

  const totalBalance = useMemo(() => parseFloat(balances.reduce((sum, b) => sum + b.amount, 0).toFixed(2)), [balances]);

  const contextValue = useMemo(() => ({
    user, setUser, loading,
    groups, friends, balances, activity, groupInvites, friendRequests,
    totalBalance, currency, setCurrency,
    login, signInWithOAuth, logout,
    refresh, loadData, syncData,
    respondToFriendRequest,
    isOnline, syncStatus,
    notifyWrite, triggerSync,
    contactMatches,
    lastLoadTimestamp: lastLoadTimestampRef,
  }), [user, loading, groups, friends, balances, activity, groupInvites, friendRequests, totalBalance, currency, isOnline, syncStatus, contactMatches]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
