-- ============================================================
-- Migration 005: New features backend support
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── Expenses table: new columns ─────────────────────────────
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
-- recurring columns removed (not supported on free tier)
ALTER TABLE expenses DROP COLUMN IF EXISTS recurring;
ALTER TABLE expenses DROP COLUMN IF EXISTS recurring_day;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_date DATE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_by_split JSONB;

-- ── Groups table: new columns ───────────────────────────────
ALTER TABLE groups ADD COLUMN IF NOT EXISTS emoji TEXT DEFAULT '';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS end_date TEXT;

-- ── Users table: activity tracking ──────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_activity_at TIMESTAMPTZ;

-- ── Activity table: extra tracking fields ───────────────────
ALTER TABLE activity ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE activity ADD COLUMN IF NOT EXISTS paid_by_id TEXT;

-- ── Pending invites table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS pending_invites (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  inviter_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent duplicate pending invites
CREATE UNIQUE INDEX IF NOT EXISTS pending_invites_unique
  ON pending_invites (email, inviter_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE pending_invites;

-- Grant access
GRANT ALL ON pending_invites TO anon, authenticated;
