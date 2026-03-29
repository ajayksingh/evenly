import { Share, Platform } from 'react-native';

let Clipboard;
try { Clipboard = require('expo-clipboard'); } catch(_) {}

export async function shareOrCopy({ message, title }) {
  try {
    if (Platform.OS === 'web') {
      // Try native Web Share API first
      if (navigator.share) {
        await navigator.share({ text: message, title });
        return 'shared';
      }
      // Fallback: copy to clipboard
      if (Clipboard) {
        await Clipboard.setStringAsync(message);
      } else {
        await navigator.clipboard.writeText(message);
      }
      return 'copied';
    }
    // Mobile: use React Native Share
    await Share.share({ message, title });
    return 'shared';
  } catch (e) {
    if (e.message === 'User did not share') return 'cancelled';
    throw e;
  }
}
