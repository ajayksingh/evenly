import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
          console.log('Deep link OAuth: setting session from URL');
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

        // User is logged in — process immediately
        if (inviteUserId) {
          await handleInviteLink(inviteUserId, user.id);
          loadData();
        }
        if (joinGroupId) {
          try {
            const grp = await getGroup(joinGroupId);
            if (grp && !grp.members.find(m => m.id === user.id)) {
              await addMemberToGroup(joinGroupId, { id: user.id, name: user.name, email: user.email, avatar: user.avatar });
            }
            loadData();
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
          loadData();
        } else if (ctx.type === 'joinGroup' && ctx.id) {
          const grp = await getGroup(ctx.id);
          if (grp && !grp.members.find(m => m.id === user.id)) {
            await addMemberToGroup(ctx.id, { id: user.id, name: user.name, email: user.email, avatar: user.avatar });
          }
          loadData();
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
      console.log('Auth state change:', event, !!session);
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && session) {
        try {
          console.log('Handling OAuth session for event:', event);
          // Race against a timeout — if Supabase upsert hangs, use basic profile
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000));
          let profile;
          try {
            profile = await Promise.race([handleOAuthSession(session), timeoutPromise]);
          } catch (e) {
            console.warn('handleOAuthSession timed out or failed, using basic profile:', e.message);
            // Fallback: create profile from session data without Supabase upsert
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
          console.log('OAuth profile set:', profile?.name);
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
      loadData().then(() => {
        try {
          requestNotificationPermission().then(() => {
            // Schedule weekly reminder based on current balances
            const owedBalances = (balances || []).filter(b => b.amount > 0);
            const totalOwed = owedBalances.reduce((s, b) => s + b.amount, 0);
            const friendCount = owedBalances.length;
            scheduleWeeklyReminder(totalOwed, friendCount);
          });
        } catch (e) {
          console.warn('Notification setup error:', e);
        }
      });
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, (payload) => {
        loadData().catch(() => {});
        try {
          if (payload?.eventType === 'INSERT' && payload.new) {
            const expense = payload.new;
            if (expense.paid_by !== user.id) {
              showExpenseNotification(
                expense.description || 'Expense',
                expense.amount || '',
                expense.paid_by_name || 'Someone',
              );
            }
          }
        } catch (e) {
          console.warn('Expense notification error:', e);
        }
      })
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
      console.log('OAuth result type:', result.type);
      console.log('OAuth result url:', result.url?.substring(0, 100));
      if (result.type === 'success' && result.url) {
        // Extract tokens from the redirect URL and set the session
        const redirectUrl = result.url;
        // Tokens can be in hash fragment (#) or query params (?)
        const hashPart = redirectUrl.includes('#') ? redirectUrl.split('#')[1] : '';
        const queryPart = redirectUrl.includes('?') ? redirectUrl.split('?')[1] : '';
        const tokenString = hashPart || queryPart;
        console.log('OAuth token string:', tokenString?.substring(0, 80));
        const params = new URLSearchParams(tokenString);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        console.log('OAuth tokens found:', !!access_token, !!refresh_token);
        if (access_token && refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
          console.log('OAuth setSession result:', sessionError ? sessionError.message : 'success');
        } else {
          console.log('OAuth: No tokens in redirect URL, trying to get session...');
          // Fallback: Supabase may have already set the session via the URL
          const { data: session } = await supabase.auth.getSession();
          console.log('OAuth fallback session:', !!session?.session);
        }
      } else {
        console.log('OAuth flow ended with:', result.type);
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

  // Feature #11: Contact sync & auto-match — runs once after user logs in and data loads
  // Uses getContactsIfPermitted() which never prompts for permission
  useEffect(() => {
    if (!user || Platform.OS === 'web' || friends.length === 0) return;
    const syncContacts = async () => {
      try {
        const deviceContacts = await getContactsIfPermitted();
        if (deviceContacts.length === 0) return;
        const matches = await matchContactsToUsers(deviceContacts);
        const newMatches = matches.filter(m => !friends.some(f => f.id === m.id) && m.id !== user.id);
        if (newMatches.length > 0) {
          setContactMatches(newMatches);
        }
      } catch (e) {
        console.error('Contact sync error:', e);
      }
    };
    syncContacts();
  }, [user?.id, friends.length]);

  const totalBalance = parseFloat(balances.reduce((sum, b) => sum + b.amount, 0).toFixed(2));

  return (
    <AppContext.Provider value={{
      user, setUser, loading,
      groups, friends, balances, activity, groupInvites, friendRequests,
      totalBalance, currency, setCurrency,
      login, signInWithOAuth, logout,
      refresh, loadData, syncData,
      respondToFriendRequest,
      // Sync & network
      isOnline, syncStatus,
      notifyWrite, triggerSync,
      // Feature #11: Contact matches
      contactMatches,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
