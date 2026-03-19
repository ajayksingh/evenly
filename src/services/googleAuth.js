/**
 * Google Sign-In using Expo AuthSession
 * Free - uses Google OAuth 2.0
 * Secure token storage with Expo Secure Store
 */
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import SecureStore from 'expo-secure-store';

WebBrowser.maybeCompleteAuthSession();

// Use Expo proxy for easy setup - works without configuring SHA keys
const CLIENT_ID = '764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com'; // Expo proxy client

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

// Storage keys for tokens
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'google_access_token',
  REFRESH_TOKEN: 'google_refresh_token',
  USER_ID: 'google_user_id',
};

export const useGoogleAuth = () => {
  const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.Token,
      extraParams: { nonce: Math.random().toString(36).slice(2) },
    },
    discovery
  );

  return { request, response, promptAsync };
};

export const fetchGoogleUserInfo = async (accessToken) => {
  try {
    const res = await fetch('https://www.googleapis.com/userinfo/v2/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error('Failed to fetch user info');
    return res.json();
  } catch (error) {
    console.error('Error fetching Google user info:', error);
    throw new Error('Unable to fetch your Google profile. Please check your connection.');
  }
};

/**
 * Store access token securely
 */
export const storeAccessToken = async (accessToken, userId) => {
  try {
    await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    await SecureStore.setItemAsync(STORAGE_KEYS.USER_ID, userId);
  } catch (error) {
    console.warn('Could not store access token securely:', error);
  }
};

/**
 * Retrieve stored access token
 */
export const getStoredAccessToken = async () => {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
  } catch (error) {
    console.warn('Could not retrieve access token:', error);
    return null;
  }
};

/**
 * Revoke access token
 */
export const revokeAccessToken = async () => {
  try {
    const token = await getStoredAccessToken();
    if (token) {
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `token=${token}`,
      });
    }
  } catch (error) {
    console.warn('Could not revoke token:', error);
  } finally {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_ID);
    } catch (e) {
      console.warn('Could not clear stored tokens:', e);
    }
  }
};

export const signInWithGoogle = async (promptAsync) => {
  const result = await promptAsync({ useProxy: true });
  if (result.type !== 'success') throw new Error('Google sign-in cancelled');
  const { access_token } = result.params;
  const userInfo = await fetchGoogleUserInfo(access_token);

  // Store token securely
  await storeAccessToken(access_token, userInfo.id);

  return {
    id: `google_${userInfo.id}`,
    name: userInfo.name,
    email: userInfo.email,
    avatar: userInfo.picture,
    provider: 'google',
  };
};
