export const COLORS = {
  // Primary — Indigo/Violet
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  primaryLight: '#EEF2FF',
  primaryGradient: ['#6366F1', '#8B5CF6'],

  // Semantic
  secondary: '#EC4899',
  accent: '#F59E0B',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  positive: '#10B981',
  negative: '#EF4444',
  neutral: '#64748B',

  // Surface / Layout
  background: '#F8F9FF',
  white: '#FFFFFF',
  black: '#0F172A',
  card: '#FFFFFF',
  border: '#E2E8F0',
  shadow: 'rgba(99,102,241,0.10)',
  overlay: 'rgba(15,23,42,0.5)',

  // Typography
  text: '#0F172A',
  textLight: '#64748B',
  textMuted: '#94A3B8',
};

export const CATEGORIES = [
  { id: 'food',          label: 'Food & Drink',   icon: 'restaurant',    color: '#F43F5E' },
  { id: 'housing',       label: 'Housing',         icon: 'home',          color: '#3B82F6' },
  { id: 'transport',     label: 'Transport',       icon: 'car',           color: '#F59E0B' },
  { id: 'entertainment', label: 'Entertainment',   icon: 'musical-notes', color: '#8B5CF6' },
  { id: 'shopping',      label: 'Shopping',        icon: 'cart',          color: '#EC4899' },
  { id: 'utilities',     label: 'Utilities',       icon: 'flash',         color: '#F97316' },
  { id: 'health',        label: 'Health',          icon: 'medical',       color: '#10B981' },
  { id: 'travel',        label: 'Travel',          icon: 'airplane',      color: '#6366F1' },
  { id: 'general',       label: 'General',         icon: 'receipt',       color: '#64748B' },
];

export const GROUP_TYPES = [
  { id: 'home',   label: 'Home',   icon: 'home' },
  { id: 'trip',   label: 'Trip',   icon: 'airplane' },
  { id: 'couple', label: 'Couple', icon: 'heart' },
  { id: 'other',  label: 'Other',  icon: 'people' },
];
