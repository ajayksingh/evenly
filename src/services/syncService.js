/**
 * Offline Sync Service
 * - Queues all writes when offline
 * - Flushes queue to Supabase when back online
 * - Tracks sync status for UI indicators
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { upsertRecord, deleteRecord, isSupabaseConfigured } from './supabase';

const QUEUE_KEY = 'sw_sync_queue';
const LAST_SYNC_KEY = 'sw_last_sync';

// Map local AsyncStorage keys to Supabase table names
const TABLE_MAP = {
  sw_users: 'users',
  sw_groups: 'groups',
  sw_expenses: 'expenses',
  sw_settlements: 'settlements',
  sw_friends: 'friends',
  sw_activity: 'activity',
};

// Map local record fields to Supabase snake_case columns
const toSupabaseRecord = (table, record) => {
  switch (table) {
    case 'expenses':
      return {
        id: record.id,
        group_id: record.groupId,
        description: record.description,
        amount: record.amount,
        currency: record.currency,
        paid_by: record.paidBy,
        splits: record.splits,
        created_at: record.createdAt,
      };
    case 'groups':
      return {
        id: record.id,
        name: record.name,
        description: record.description || '',
        created_by: record.createdBy,
        members: record.members,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      };
    case 'settlements':
      return {
        id: record.id,
        paid_by: record.paidBy,
        paid_to: record.paidTo,
        amount: record.amount,
        currency: record.currency,
        group_id: record.groupId || null,
        note: record.note || '',
        created_at: record.createdAt,
      };
    case 'friends':
      return {
        id: record.id,
        user_id: record.userId,
        friend_id: record.friendId,
        created_at: record.createdAt,
      };
    case 'activity':
      return {
        id: record.id,
        type: record.type,
        user_id: record.userId,
        group_id: record.groupId || null,
        expense_id: record.expenseId || null,
        description: record.description || null,
        amount: record.amount || null,
        group_name: record.groupName || null,
        paid_by_name: record.paidByName || null,
        created_at: record.createdAt,
      };
    case 'users':
      return {
        id: record.id,
        name: record.name,
        email: record.email,
        avatar: record.avatar || null,
        phone: record.phone || '',
        provider: record.provider || 'email',
        created_at: record.createdAt,
      };
    default:
      return record;
  }
};

export const getQueue = async () => {
  try {
    const q = await AsyncStorage.getItem(QUEUE_KEY);
    return q ? JSON.parse(q) : [];
  } catch { return []; }
};

const saveQueue = async (queue) => {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const getQueueLength = async () => {
  const q = await getQueue();
  return q.length;
};

// Add a write operation to the sync queue
export const enqueueUpsert = async (storageKey, record) => {
  if (!isSupabaseConfigured()) return;
  const table = TABLE_MAP[storageKey];
  if (!table) return;

  const queue = await getQueue();
  // Remove any existing entry for same record to avoid duplicates
  const filtered = queue.filter(i => !(i.table === table && i.record?.id === record?.id));
  await saveQueue([
    ...filtered,
    {
      op: 'upsert',
      table,
      record: toSupabaseRecord(table, record),
      queuedAt: new Date().toISOString(),
      retries: 0,
    },
  ]);
};

export const enqueueDelete = async (storageKey, id) => {
  if (!isSupabaseConfigured()) return;
  const table = TABLE_MAP[storageKey];
  if (!table) return;

  const queue = await getQueue();
  await saveQueue([
    ...queue.filter(i => !(i.table === table && i.record?.id === id)),
    { op: 'delete', table, id, queuedAt: new Date().toISOString(), retries: 0 },
  ]);
};

// Flush all queued operations to Supabase
// Returns { synced, failed }
export const flushQueue = async (onProgress) => {
  const queue = await getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const remaining = [];

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    try {
      if (item.op === 'upsert') {
        await upsertRecord(item.table, item.record);
      } else if (item.op === 'delete') {
        await deleteRecord(item.table, item.id);
      }
      synced++;
      if (onProgress) onProgress(i + 1, queue.length);
    } catch (e) {
      item.retries = (item.retries || 0) + 1;
      if (item.retries < 5) remaining.push(item);
      else failed++;
    }
  }

  await saveQueue(remaining);

  if (synced > 0) {
    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  }

  return { synced, failed };
};

export const getLastSyncTime = async () => {
  const t = await AsyncStorage.getItem(LAST_SYNC_KEY);
  return t ? new Date(t) : null;
};

export const clearQueue = async () => {
  await AsyncStorage.removeItem(QUEUE_KEY);
};
