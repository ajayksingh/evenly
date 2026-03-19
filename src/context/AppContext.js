import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getCurrentUser, loginUser, registerUser, logoutUser,
  getGroups, getFriends, calculateBalances,
  getActivity, seedDemoData, loginOrRegisterOAuthUser,
} from '../services/storage';
import { loadSelectedCurrency, saveSelectedCurrency, detectDefaultCurrency } from '../services/currency';

const AppContext = createContext({});

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [friends, setFriends] = useState([]);
  const [balances, setBalances] = useState([]);
  const [activity, setActivity] = useState([]);
  const [currency, setCurrencyState] = useState('INR');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    seedDemoData();
    // Load preferred currency
    loadSelectedCurrency().then(c => setCurrencyState(c));
  }, []);

  useEffect(() => {
    const restore = async () => {
      const currentUser = await getCurrentUser();
      if (currentUser) setUser(currentUser);
      setLoading(false);
    };
    restore();
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
    } else {
      setGroups([]); setFriends([]); setBalances([]); setActivity([]);
    }
  }, [user, refreshTrigger]);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [g, f, b, a] = await Promise.all([
        getGroups(user.id),
        getFriends(user.id),
        calculateBalances(user.id),
        getActivity(user.id),
      ]);
      setGroups(g); setFriends(f); setBalances(b); setActivity(a);
    } catch (e) {
      console.error('Load data error:', e);
    }
  }, [user]);

  const refresh = useCallback(() => {
    setRefreshTrigger(t => t + 1);
  }, []);

  const setCurrency = async (code) => {
    setCurrencyState(code);
    await saveSelectedCurrency(code);
  };

  const login = async (email, password) => {
    const loggedIn = await loginUser({ email, password });
    setUser(loggedIn);
    return loggedIn;
  };

  const register = async (name, email, password) => {
    const registered = await registerUser({ name, email, password });
    setUser(registered);
    return registered;
  };

  const loginWithOAuth = async (oauthData) => {
    const user = await loginOrRegisterOAuthUser(oauthData);
    setUser(user);
    return user;
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
  };

  const totalBalance = balances.reduce((sum, b) => sum + b.amount, 0);

  return (
    <AppContext.Provider value={{
      user, setUser, loading,
      groups, friends, balances, activity,
      totalBalance, currency, setCurrency,
      login, register, loginWithOAuth, logout,
      refresh, loadData,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
