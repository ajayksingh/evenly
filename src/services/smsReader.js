/**
 * SMS Reader Service - Android SMS Inbox
 * Reads bank transaction SMS messages from the Android SMS inbox.
 * Uses PermissionsAndroid and NativeModules to access content://sms/inbox.
 * Returns empty array on iOS/web (SMS reading is Android-only).
 */
import { Platform, NativeModules, PermissionsAndroid } from 'react-native';
import { BANK_SENDERS, isBankSender } from './smsParser';

/**
 * Request READ_SMS permission on Android.
 * Returns true if granted, false otherwise.
 * On non-Android platforms, returns false.
 */
export async function requestSMSPermission() {
  if (Platform.OS !== 'android') return false;

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      {
        title: 'SMS Permission',
        message:
          'Evenly needs access to your SMS to automatically detect bank transactions and help you split expenses.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    console.warn('[smsReader] Permission request failed:', error);
    return false;
  }
}

/**
 * Check if READ_SMS permission is already granted.
 */
export async function hasSMSPermission() {
  if (Platform.OS !== 'android') return false;

  try {
    return await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_SMS
    );
  } catch {
    return false;
  }
}

/**
 * Build the SMS sender filter selection string for ContentResolver query.
 * Matches sender IDs that contain any of the BANK_SENDERS entries.
 */
function buildSenderFilter() {
  // Android SMS address field stores the sender ID.
  // We use LIKE clauses to match bank sender patterns (e.g., "%HDFCBK%").
  const clauses = BANK_SENDERS.map((id) => `address LIKE '%${id}%'`);
  return clauses.join(' OR ');
}

/**
 * Read SMS messages from the Android inbox using ContentResolver via NativeModules.
 *
 * The React Native bridge exposes a ContentResolver module on some setups.
 * If not available, we fall back to the SmsModule or return empty.
 *
 * @param {Object} options
 * @param {number} options.maxCount - Maximum number of SMS to read (default: 200)
 * @param {number} options.afterDate - Only read SMS after this timestamp in ms (default: 30 days ago)
 * @returns {Promise<Array<{body: string, sender: string, date: Date}>>}
 */
export async function readSMSInbox({ maxCount = 200, afterDate } = {}) {
  if (Platform.OS !== 'android') return [];

  const hasPermission = await hasSMSPermission();
  if (!hasPermission) {
    const granted = await requestSMSPermission();
    if (!granted) {
      console.warn('[smsReader] SMS permission denied by user');
      return [];
    }
  }

  // Default: read SMS from the last 30 days
  const sinceTimestamp = afterDate || Date.now() - 30 * 24 * 60 * 60 * 1000;

  try {
    // Try SmsAndroid NativeModule (react-native-get-sms-android pattern)
    const SmsAndroid = NativeModules.SmsAndroid || NativeModules.SmsModule;

    if (SmsAndroid && typeof SmsAndroid.list === 'function') {
      return await readViaSmsAndroidModule(SmsAndroid, sinceTimestamp, maxCount);
    }

    // Try ContentResolver NativeModule
    const ContentResolver =
      NativeModules.ContentResolver || NativeModules.ContentResolverModule;

    if (ContentResolver && typeof ContentResolver.query === 'function') {
      return await readViaContentResolver(
        ContentResolver,
        sinceTimestamp,
        maxCount
      );
    }

    // Fallback: try the Expo-style SMS module
    const ExpoSMS = NativeModules.ExpoSMS;
    if (ExpoSMS && typeof ExpoSMS.getMessagesAsync === 'function') {
      return await readViaExpoSMS(ExpoSMS, sinceTimestamp, maxCount);
    }

    console.warn(
      '[smsReader] No SMS native module available. ' +
        'Ensure a compatible SMS reading module is linked (e.g., react-native-get-sms-android).'
    );
    return [];
  } catch (error) {
    console.error('[smsReader] Failed to read SMS inbox:', error);
    return [];
  }
}

/**
 * Read SMS via react-native-get-sms-android style NativeModule.
 */
async function readViaSmsAndroidModule(SmsAndroid, sinceTimestamp, maxCount) {
  return new Promise((resolve) => {
    const filter = {
      box: 'inbox',
      minDate: sinceTimestamp,
      maxCount,
      bodyRegex: '(?:' + BANK_SENDERS.join('|') + ')',
    };

    SmsAndroid.list(
      JSON.stringify(filter),
      (fail) => {
        console.warn('[smsReader] SmsAndroid.list failed:', fail);
        resolve([]);
      },
      (_count, smsList) => {
        try {
          const messages = JSON.parse(smsList);
          const results = messages
            .filter((msg) => msg.body && isBankSender(msg.address || ''))
            .map((msg) => ({
              body: msg.body,
              sender: msg.address || '',
              date: msg.date ? new Date(parseInt(msg.date, 10)) : new Date(),
            }));
          resolve(results);
        } catch (parseError) {
          console.warn('[smsReader] Failed to parse SMS list:', parseError);
          resolve([]);
        }
      }
    );
  });
}

/**
 * Read SMS via ContentResolver NativeModule.
 */
async function readViaContentResolver(
  ContentResolver,
  sinceTimestamp,
  maxCount
) {
  const uri = 'content://sms/inbox';
  const projection = ['address', 'body', 'date'];
  const senderFilter = buildSenderFilter();
  const selection = `(${senderFilter}) AND date > ${sinceTimestamp}`;
  const sortOrder = `date DESC LIMIT ${maxCount}`;

  const cursor = await ContentResolver.query(
    uri,
    projection,
    selection,
    null,
    sortOrder
  );

  if (!cursor || !Array.isArray(cursor)) return [];

  return cursor
    .filter((row) => row.body && isBankSender(row.address || ''))
    .map((row) => ({
      body: row.body,
      sender: row.address || '',
      date: row.date ? new Date(parseInt(row.date, 10)) : new Date(),
    }));
}

/**
 * Read SMS via Expo SMS module (if available).
 */
async function readViaExpoSMS(ExpoSMS, sinceTimestamp, maxCount) {
  try {
    const messages = await ExpoSMS.getMessagesAsync({
      from: sinceTimestamp,
      maxCount,
    });

    if (!Array.isArray(messages)) return [];

    return messages
      .filter((msg) => msg.body && isBankSender(msg.sender || msg.address || ''))
      .map((msg) => ({
        body: msg.body,
        sender: msg.sender || msg.address || '',
        date: msg.date ? new Date(msg.date) : new Date(),
      }));
  } catch (error) {
    console.warn('[smsReader] ExpoSMS read failed:', error);
    return [];
  }
}

/**
 * Read transaction SMS messages from the inbox.
 * Convenience function that reads SMS and filters to bank senders.
 *
 * @param {Object} options
 * @param {number} options.maxCount - Maximum SMS to read (default: 200)
 * @param {number} options.afterDate - Only SMS after this timestamp (default: 30 days ago)
 * @returns {Promise<Array<{body: string, sender: string, date: Date}>>}
 */
export async function readTransactionSMS(options = {}) {
  if (Platform.OS !== 'android') return [];

  const messages = await readSMSInbox(options);

  // Double-check bank sender filter (in case native module didn't filter)
  return messages.filter((msg) => isBankSender(msg.sender));
}
