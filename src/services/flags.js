/**
 * Feature Flags — local defaults + AsyncStorage persistence + Supabase remote override
 *
 * Usage:
 *   import { getFlag, setFlag, refreshFlags } from '../services/flags';
 *   const adsEnabled = await getFlag('ads_enabled');       // returns boolean
 *   await setFlag('ads_enabled', false);                    // local override
 *   await refreshFlags();                                   // pull remote config
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';

const STORAGE_KEY = '@evenly_feature_flags';

// ── Default flags ──────────────────────────────────────────────────────────
const DEFAULTS = {
  // Monetization
  ads_enabled: true,
  interstitial_after_settle: true,
  interstitial_frequency: 1,            // show every Nth settle (1 = every time)

  // Social
  whatsapp_sharing: true,
  contact_sync: true,
  qr_invites: true,
  friend_requests_required: true,

  // UX
  demo_mode: true,
  onboarding_flow: true,
  dark_mode: true,
  entrance_animations: true,
  haptic_feedback: true,

  // Data
  offline_mode: true,
  realtime_sync: true,
  cross_group_simplification: true,

  // Upcoming (ship flag now, enable later)
  receipt_scanning: false,
  recurring_expenses: false,
  spending_analytics: false,
  upi_deep_link: false,

  // Expense Tracker
  sms_expense_tracking: false,
  email_expense_tracking: false,
  statement_reconciliation: false,
  spending_dashboard: false,
};

// ── In-memory cache ────────────────────────────────────────────────────────
let _flags = { ...DEFAULTS };
let _loaded = false;

// ── Load from AsyncStorage ─────────────────────────────────────────────────
const loadLocal = async () => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      _flags = { ...DEFAULTS, ...parsed };
    }
    _loaded = true;
  } catch {
    _loaded = true;
  }
};

// ── Save to AsyncStorage ───────────────────────────────────────────────────
const saveLocal = async () => {
  try {
    // Only save overrides (values that differ from defaults)
    const overrides = {};
    for (const [key, val] of Object.entries(_flags)) {
      if (DEFAULTS[key] !== val) overrides[key] = val;
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {}
};

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Get a flag value. Returns the default if not loaded yet.
 */
export const getFlag = async (key) => {
  if (!_loaded) await loadLocal();
  return _flags[key] ?? DEFAULTS[key] ?? false;
};

/**
 * Get a flag synchronously (uses cached value — call after init).
 */
export const getFlagSync = (key) => {
  return _flags[key] ?? DEFAULTS[key] ?? false;
};

/**
 * Set a flag locally (persists to AsyncStorage).
 */
export const setFlag = async (key, value) => {
  if (!_loaded) await loadLocal();
  _flags[key] = value;
  await saveLocal();
};

/**
 * Get all flags as an object.
 */
export const getAllFlags = async () => {
  if (!_loaded) await loadLocal();
  return { ..._flags };
};

/**
 * Reset a flag to its default value.
 */
export const resetFlag = async (key) => {
  if (key in DEFAULTS) {
    _flags[key] = DEFAULTS[key];
    await saveLocal();
  }
};

/**
 * Reset all flags to defaults.
 */
export const resetAllFlags = async () => {
  _flags = { ...DEFAULTS };
  await AsyncStorage.removeItem(STORAGE_KEY);
};

/**
 * Pull remote flag overrides from Supabase.
 * Expects a `feature_flags` table with columns: key (text), value (jsonb), enabled (boolean)
 * Falls back silently if table doesn't exist or Supabase is offline.
 */
export const refreshFlags = async () => {
  if (!_loaded) await loadLocal();
  if (!isSupabaseConfigured() || !supabase) return;
  try {
    const { data } = await supabase.from('feature_flags').select('key,value,enabled');
    if (data && Array.isArray(data)) {
      data.forEach(row => {
        if (row.key in DEFAULTS) {
          // Boolean flags use `enabled`, numeric/string flags use `value`
          _flags[row.key] = typeof DEFAULTS[row.key] === 'boolean' ? row.enabled : (row.value ?? row.enabled);
        }
      });
      await saveLocal();
    }
  } catch {
    // Table doesn't exist or network error — use local flags
  }
};

/**
 * Initialize flags — call once at app startup.
 */
export const initFlags = async () => {
  await loadLocal();
  // Non-blocking remote refresh
  refreshFlags().catch(() => {});
};

/**
 * Get the defaults for reference.
 */
export const FLAG_DEFAULTS = { ...DEFAULTS };
