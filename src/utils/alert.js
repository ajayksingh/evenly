import { themedAlert, themedConfirm } from '../components/ThemedAlert';

export const confirmAlert = ({ title, message, confirmText = 'OK', cancelText = 'Cancel', onConfirm, onCancel, destructive = false }) => {
  themedConfirm({ title, message, confirmText, cancelText, onConfirm, onCancel, destructive });
};

export const infoAlert = (title, message) => {
  themedAlert(title, message, 'info');
};
