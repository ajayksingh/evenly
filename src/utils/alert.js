import { Platform, Alert } from 'react-native';

export const confirmAlert = ({ title, message, confirmText = 'OK', cancelText = 'Cancel', onConfirm, onCancel, destructive = false }) => {
  if (Platform.OS === 'web') {
    const msg = message ? `${title}\n\n${message}` : title;
    if (window.confirm(msg)) {
      onConfirm?.();
    } else {
      onCancel?.();
    }
  } else {
    Alert.alert(title, message, [
      { text: cancelText, onPress: onCancel, style: 'cancel' },
      { text: confirmText, onPress: onConfirm, style: destructive ? 'destructive' : 'default' },
    ]);
  }
};

export const infoAlert = (title, message) => {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
};
