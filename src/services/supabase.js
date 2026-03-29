/**
 * Supabase Backend Service
 * Free tier: 500MB DB, 2GB bandwidth, 50MB file storage
 * Setup: https://supabase.com → create project → copy URL + anon key below
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

// Complete any pending auth sessions (required for native OAuth)
if (Platform.OS !== 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

// Loaded from .env (EXPO_PUBLIC_ prefix makes them available in the app bundle)
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const isConfigured = !SUPABASE_URL.includes('YOUR_PROJECT_ID');

// Build the redirect URI for OAuth callbacks
export const oauthRedirectUri = makeRedirectUri({
  scheme: 'evenly',
  path: 'auth/callback',
});

export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : null;

// Upsert a single record into a Supabase table
export const upsertRecord = async (table, record) => {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from(table).upsert(record, { onConflict: 'id' });
  if (error) throw error;
};

// Upsert multiple records
export const upsertMany = async (table, records) => {
  if (!supabase || records.length === 0) return;
  const { error } = await supabase.from(table).upsert(records, { onConflict: 'id' });
  if (error) throw error;
};

// Fetch records relevant to a user
export const fetchUserData = async (table, userId, extraFilters = {}) => {
  if (!supabase) return [];
  let q = supabase.from(table).select('*').eq('user_id', userId);
  Object.entries(extraFilters).forEach(([k, v]) => { q = q.eq(k, v); });
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
};

// Delete a record
export const deleteRecord = async (table, id) => {
  if (!supabase) return;
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
};


export const isSupabaseConfigured = () => isConfigured;
