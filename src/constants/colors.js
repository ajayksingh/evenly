// Legacy COLORS export — kept for backward compatibility during migration.
// New code should use useTheme() from ThemeContext instead.
export const COLORS = {
  // Primary — Teal (matches Figma)
  primary: '#00d4aa',
  primaryDark: '#00b894',
  primaryLight: 'rgba(0,212,170,0.12)',
  primaryGradient: ['#00d4aa', '#00b894'],
  // Gradient CTA: teal → cyan
  ctaGradient: ['#00d4aa', '#00b4d8'],

  // Semantic
  secondary: '#a55eea',
  accent: '#ffd93d',
  success: '#00d4aa',
  danger: '#ff4757',
  warning: '#ffd93d',
  info: '#4fc3f7',
  positive: '#00d4aa',
  negative: '#ff6b6b',
  neutral: '#71717a',

  // Surface / Layout — Dark theme (softer, warmer)
  background: '#111113',
  white: '#1c1c22',
  black: '#ffffff',
  card: '#1c1c22',
  border: 'rgba(255,255,255,0.08)',
  shadow: 'rgba(0,212,170,0.15)',
  overlay: 'rgba(0,0,0,0.7)',

  // Typography
  text: '#ffffff',
  textLight: '#9ca3af',
  textMuted: '#52525b',
};

// Border radius system
export const RADIUS_SM = 12;
export const RADIUS_MD = 16;
export const RADIUS_LG = 24;

export const CATEGORIES = [
  { id: 'food',          label: 'Food & Drink',   icon: 'restaurant',    emoji: '🍔', color: '#F43F5E' },
  { id: 'housing',       label: 'Housing',         icon: 'home',          emoji: '🏠', color: '#3B82F6' },
  { id: 'transport',     label: 'Transport',       icon: 'car',           emoji: '🚗', color: '#F59E0B' },
  { id: 'entertainment', label: 'Entertainment',   icon: 'musical-notes', emoji: '🎬', color: '#8B5CF6' },
  { id: 'shopping',      label: 'Shopping',        icon: 'cart',          emoji: '🛍️', color: '#EC4899' },
  { id: 'utilities',     label: 'Utilities',       icon: 'flash',         emoji: '💡', color: '#F97316' },
  { id: 'health',        label: 'Health',          icon: 'medical',       emoji: '💊', color: '#10B981' },
  { id: 'travel',        label: 'Travel',          icon: 'airplane',      emoji: '✈️', color: '#6366F1' },
  { id: 'general',       label: 'General',         icon: 'receipt',       emoji: '📝', color: '#64748B' },
];

export const GROUP_TYPES = [
  { id: 'home',   label: 'Home',   icon: 'home',     emoji: '🏠' },
  { id: 'trip',   label: 'Trip',   icon: 'airplane', emoji: '✈️' },
  { id: 'couple', label: 'Couple', icon: 'heart',    emoji: '💑' },
  { id: 'other',  label: 'Other',  icon: 'people',   emoji: '👥' },
];
