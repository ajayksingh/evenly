import { Platform } from 'react-native';

let Notifications;
if (Platform.OS !== 'web') {
  try { Notifications = require('expo-notifications'); } catch (_) {}
}

export async function requestNotificationPermission() {
  if (!Notifications) return false;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.warn('Notification permission error:', e);
    return false;
  }
}

export async function scheduleWeeklyReminder(totalOwed, friendCount) {
  if (!Notifications || totalOwed <= 0) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Pending balances',
        body: `${friendCount} friend${friendCount !== 1 ? 's' : ''} owe you. Open Evenly to remind them.`,
      },
      trigger: {
        seconds: 7 * 24 * 60 * 60, // 1 week
        repeats: true,
      },
    });
  } catch (e) {
    console.warn('Schedule weekly reminder error:', e);
  }
}

export async function showExpenseNotification(description, amount, paidByName) {
  if (!Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'New expense added',
        body: `${paidByName} added "${description}" for ${amount}`,
      },
      trigger: null, // immediate
    });
  } catch (e) {
    console.warn('Show expense notification error:', e);
  }
}

export async function cancelAllNotifications() {
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn('Cancel notifications error:', e);
  }
}
