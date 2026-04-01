/**
 * Expense Tracker Service — personal expense storage, statement reconciliation,
 * and connected account management via Supabase.
 */
import { supabase, isSupabaseConfigured } from './supabase';

const uuidv4 = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });

const isDemo = (userId) => typeof userId === 'string' && userId.startsWith('demo-');

// ── Personal Expenses ─────────────────────────────────────────────────────────

/**
 * Insert a new personal expense.
 */
export const addPersonalExpense = async (expense) => {
  if (isDemo(expense.user_id)) return { data: null, error: null };
  if (!isSupabaseConfigured() || !supabase) return { data: null, error: 'Supabase not configured' };

  const row = {
    id: expense.id || uuidv4(),
    user_id: expense.user_id,
    amount: expense.amount,
    merchant: expense.merchant || null,
    category: expense.category || 'general',
    date: expense.date,
    source: expense.source,
    source_ref: expense.source_ref || null,
    card_last4: expense.card_last4 || null,
    is_credit: expense.is_credit || false,
    raw_text: expense.raw_text || null,
    matched_statement_id: expense.matched_statement_id || null,
  };

  const { data, error } = await supabase.from('personal_expenses').insert(row).select().single();
  return { data, error };
};

/**
 * Fetch personal expenses with optional filters: month (YYYY-MM), category, source.
 */
export const getPersonalExpenses = async (userId, { month, category, source } = {}) => {
  if (isDemo(userId)) return [];
  if (!isSupabaseConfigured() || !supabase) return [];

  let query = supabase
    .from('personal_expenses')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (month) {
    const start = `${month}-01T00:00:00Z`;
    const [y, m] = month.split('-').map(Number);
    const end = new Date(y, m, 1).toISOString();
    query = query.gte('date', start).lt('date', end);
  }
  if (category) query = query.eq('category', category);
  if (source) query = query.eq('source', source);

  const { data, error } = await query;
  if (error) { console.error('getPersonalExpenses error:', error); return []; }
  return data || [];
};

/**
 * Update an existing personal expense (e.g. category, matched_statement_id).
 */
export const updatePersonalExpense = async (id, updates) => {
  if (!isSupabaseConfigured() || !supabase) return { data: null, error: 'Supabase not configured' };

  const { data, error } = await supabase
    .from('personal_expenses')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
};

/**
 * Delete a personal expense by id.
 */
export const deletePersonalExpense = async (id) => {
  if (!isSupabaseConfigured() || !supabase) return { data: null, error: 'Supabase not configured' };

  const { data, error } = await supabase
    .from('personal_expenses')
    .delete()
    .eq('id', id);
  return { data, error };
};

/**
 * Aggregate expenses by category for a given month (YYYY-MM).
 */
export const getMonthlyBreakdown = async (userId, month) => {
  if (isDemo(userId)) return [];
  if (!isSupabaseConfigured() || !supabase) return [];

  const expenses = await getPersonalExpenses(userId, { month });
  const breakdown = {};
  for (const exp of expenses) {
    const cat = exp.category || 'general';
    if (!breakdown[cat]) breakdown[cat] = { category: cat, total: 0, count: 0 };
    breakdown[cat].total += Number(exp.amount);
    breakdown[cat].count += 1;
  }
  return Object.values(breakdown).sort((a, b) => b.total - a.total);
};

// ── Statements ────────────────────────────────────────────────────────────────

/**
 * Import a credit card statement and its line items.
 * statementData: { bank, card_last4, statement_date, total_amount, source, source_ref, items: [{ date, description, amount }] }
 */
export const importStatement = async (userId, statementData) => {
  if (isDemo(userId)) return { data: null, error: null };
  if (!isSupabaseConfigured() || !supabase) return { data: null, error: 'Supabase not configured' };

  const statementId = uuidv4();
  const { items, ...header } = statementData;

  const { data: stmt, error: stmtErr } = await supabase
    .from('cc_statements')
    .insert({
      id: statementId,
      user_id: userId,
      bank: header.bank,
      card_last4: header.card_last4 || null,
      statement_date: header.statement_date,
      total_amount: header.total_amount,
      source: header.source,
      source_ref: header.source_ref || null,
    })
    .select()
    .single();

  if (stmtErr) return { data: null, error: stmtErr };

  if (items && items.length > 0) {
    const rows = items.map((item) => ({
      id: uuidv4(),
      statement_id: statementId,
      user_id: userId,
      date: item.date,
      description: item.description,
      amount: item.amount,
      matched_expense_id: null,
      status: 'unmatched',
    }));
    const { error: itemsErr } = await supabase.from('statement_items').insert(rows);
    if (itemsErr) return { data: stmt, error: itemsErr };
  }

  return { data: stmt, error: null };
};

/**
 * Fetch line items for a given statement.
 */
export const getStatementItems = async (statementId) => {
  if (!isSupabaseConfigured() || !supabase) return [];

  const { data, error } = await supabase
    .from('statement_items')
    .select('*')
    .eq('statement_id', statementId)
    .order('date', { ascending: true });

  if (error) { console.error('getStatementItems error:', error); return []; }
  return data || [];
};

/**
 * Reconcile statement items against personal expenses.
 * Matches by amount + date (same day) + card_last4.
 */
export const reconcileStatement = async (statementId, userId) => {
  if (isDemo(userId)) return { matched: 0, unmatched: 0 };
  if (!isSupabaseConfigured() || !supabase) return { matched: 0, unmatched: 0 };

  const items = await getStatementItems(statementId);
  if (!items.length) return { matched: 0, unmatched: 0 };

  // Fetch the statement header for card_last4
  const { data: stmt } = await supabase
    .from('cc_statements')
    .select('card_last4')
    .eq('id', statementId)
    .single();

  const expenses = await getPersonalExpenses(userId, {});
  let matched = 0;
  let unmatched = 0;

  for (const item of items) {
    if (item.status === 'matched') { matched++; continue; }

    const match = expenses.find((exp) => {
      if (Number(exp.amount) !== Number(item.amount)) return false;
      const expDate = new Date(exp.date).toISOString().slice(0, 10);
      const itemDate = item.date.slice(0, 10);
      if (expDate !== itemDate) return false;
      if (stmt?.card_last4 && exp.card_last4 && exp.card_last4 !== stmt.card_last4) return false;
      if (exp.matched_statement_id) return false; // already matched
      return true;
    });

    if (match) {
      await supabase.from('statement_items').update({ matched_expense_id: match.id, status: 'matched' }).eq('id', item.id);
      await supabase.from('personal_expenses').update({ matched_statement_id: statementId }).eq('id', match.id);
      matched++;
    } else {
      unmatched++;
    }
  }

  return { matched, unmatched };
};

// ── Connected Accounts ────────────────────────────────────────────────────────

/**
 * List connected accounts for a user.
 */
export const getConnectedAccounts = async (userId) => {
  if (isDemo(userId)) return [];
  if (!isSupabaseConfigured() || !supabase) return [];

  const { data, error } = await supabase
    .from('connected_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('connected_at', { ascending: false });

  if (error) { console.error('getConnectedAccounts error:', error); return []; }
  return data || [];
};

/**
 * Connect a new account (email, SMS, etc.).
 */
export const connectAccount = async (userId, type, email) => {
  if (isDemo(userId)) return { data: null, error: null };
  if (!isSupabaseConfigured() || !supabase) return { data: null, error: 'Supabase not configured' };

  const { data, error } = await supabase
    .from('connected_accounts')
    .insert({
      id: uuidv4(),
      user_id: userId,
      type,
      email: email || null,
      status: 'active',
    })
    .select()
    .single();
  return { data, error };
};

/**
 * Disconnect an account: set status to 'revoked' and delete related personal_expenses.
 */
export const disconnectAccount = async (accountId, userId) => {
  if (isDemo(userId)) return { data: null, error: null };
  if (!isSupabaseConfigured() || !supabase) return { data: null, error: 'Supabase not configured' };

  // Mark account as revoked
  const { error: updateErr } = await supabase
    .from('connected_accounts')
    .update({ status: 'revoked' })
    .eq('id', accountId)
    .eq('user_id', userId);

  if (updateErr) return { data: null, error: updateErr };

  // Get the account type to identify related expenses
  const { data: account } = await supabase
    .from('connected_accounts')
    .select('type')
    .eq('id', accountId)
    .single();

  if (account) {
    // Delete personal expenses that came from this source type
    await supabase
      .from('personal_expenses')
      .delete()
      .eq('user_id', userId)
      .eq('source', account.type);
  }

  return { data: { id: accountId, status: 'revoked' }, error: null };
};
