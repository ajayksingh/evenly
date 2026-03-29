/**
 * Responsive utilities for adaptive layouts across different screen sizes.
 * Provides consistent breakpoints and scaling helpers used by all screens.
 */
import { Dimensions, Platform } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Breakpoints
export const isNarrow = SCREEN_WIDTH < 375;
export const isVeryNarrow = SCREEN_WIDTH < 340;
export const screenWidth = SCREEN_WIDTH;

// Responsive padding — reduces on narrow screens to preserve content space
export const rPadding = (normal, narrow, veryNarrow) =>
  isVeryNarrow ? (veryNarrow ?? narrow ?? normal * 0.6)
    : isNarrow ? (narrow ?? normal * 0.75)
    : normal;

// Responsive font size — scales down on narrow screens for large display text
export const rFontSize = (normal) => {
  if (isVeryNarrow) return Math.round(normal * 0.7);
  if (isNarrow) return Math.round(normal * 0.85);
  return normal;
};

// Scroll event throttle — 60fps on native, relaxed on web
export const scrollThrottle = SCREEN_WIDTH && Platform.OS === 'web' ? 100 : 16;

// Responsive width — replaces hardcoded widths with screen-relative values
export const rWidth = (normal, minVal) => {
  const scaled = isVeryNarrow ? normal * 0.75 : isNarrow ? normal * 0.85 : normal;
  return minVal ? Math.max(scaled, minVal) : scaled;
};
