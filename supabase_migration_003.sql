-- ============================================================
-- Migration 003: Group Invites (member request accept/reject flow)
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

CREATE TABLE IF NOT EXISTS group_invites (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  group_name TEXT NOT NULL,
  invited_user_id TEXT NOT NULL,
  invited_by_user_id TEXT NOT NULL,
  invited_by_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable realtime for group_invites so invited users get instant notifications
ALTER PUBLICATION supabase_realtime ADD TABLE group_invites;

-- Grant access (RLS is disabled per migration 002)
GRANT ALL ON group_invites TO anon, authenticated;
