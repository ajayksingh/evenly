import * as Haptics from 'expo-haptics';
import { getFlagSync } from '../services/flags';

const safe = (fn) => { try { if (getFlagSync('haptic_feedback')) fn(); } catch {} };

export const hapticLight = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
export const hapticMedium = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
export const hapticHeavy = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
export const hapticSuccess = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
export const hapticError = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
export const hapticSelection = () => safe(() => Haptics.selectionAsync());
