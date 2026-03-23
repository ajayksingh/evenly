-- ============================================================
-- Migration 001: Add missing columns
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Add 'type' column to groups (e.g. 'trip', 'home', 'other')
ALTER TABLE groups ADD COLUMN IF NOT EXISTS type text DEFAULT 'other';

-- Add 'category' and 'date' columns to expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category text DEFAULT 'general';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS date timestamptz DEFAULT now();

-- Backfill existing expenses: set date = created_at where date is null
UPDATE expenses SET date = created_at WHERE date IS NULL;

-- ============================================================
-- Enable Realtime for live updates across clients
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE groups;
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE settlements;
ALTER PUBLICATION supabase_realtime ADD TABLE friends;
ALTER PUBLICATION supabase_realtime ADD TABLE activity;
