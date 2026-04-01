-- Migration 008: Expense Tracker Module
-- Tables: personal_expenses, cc_statements, statement_items, category_rules, connected_accounts

-- ── personal_expenses ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personal_expenses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  merchant TEXT,
  category TEXT DEFAULT 'general',
  date TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('sms', 'email', 'manual', 'statement')),
  source_ref TEXT,
  card_last4 TEXT,
  is_credit BOOLEAN DEFAULT false,
  raw_text TEXT,
  matched_statement_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE personal_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own personal_expenses"
  ON personal_expenses FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own personal_expenses"
  ON personal_expenses FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own personal_expenses"
  ON personal_expenses FOR UPDATE
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can delete own personal_expenses"
  ON personal_expenses FOR DELETE
  USING (user_id = auth.uid()::text);

-- ── cc_statements ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cc_statements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  bank TEXT NOT NULL,
  card_last4 TEXT,
  statement_date DATE NOT NULL,
  total_amount NUMERIC NOT NULL,
  source TEXT NOT NULL,
  source_ref TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cc_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cc_statements"
  ON cc_statements FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own cc_statements"
  ON cc_statements FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own cc_statements"
  ON cc_statements FOR UPDATE
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can delete own cc_statements"
  ON cc_statements FOR DELETE
  USING (user_id = auth.uid()::text);

-- ── statement_items ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS statement_items (
  id TEXT PRIMARY KEY,
  statement_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  matched_expense_id TEXT,
  status TEXT DEFAULT 'unmatched'
);

ALTER TABLE statement_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own statement_items"
  ON statement_items FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own statement_items"
  ON statement_items FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own statement_items"
  ON statement_items FOR UPDATE
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can delete own statement_items"
  ON statement_items FOR DELETE
  USING (user_id = auth.uid()::text);

-- ── category_rules ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS category_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  merchant_pattern TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, merchant_pattern)
);

ALTER TABLE category_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own category_rules"
  ON category_rules FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own category_rules"
  ON category_rules FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own category_rules"
  ON category_rules FOR UPDATE
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can delete own category_rules"
  ON category_rules FOR DELETE
  USING (user_id = auth.uid()::text);

-- ── connected_accounts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connected_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  email TEXT,
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_sync_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active'
);

ALTER TABLE connected_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connected_accounts"
  ON connected_accounts FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own connected_accounts"
  ON connected_accounts FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own connected_accounts"
  ON connected_accounts FOR UPDATE
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can delete own connected_accounts"
  ON connected_accounts FOR DELETE
  USING (user_id = auth.uid()::text);

-- ── Enable realtime ───────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE personal_expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE connected_accounts;
