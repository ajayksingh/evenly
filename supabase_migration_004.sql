-- ============================================================
-- Migration 004: Friend Requests + get_user_groups RPC fix
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

CREATE TABLE IF NOT EXISTS friend_requests (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent duplicate friend requests between the same two users
ALTER TABLE friend_requests ADD CONSTRAINT friend_requests_unique
  UNIQUE (sender_id, receiver_id);

-- Enable realtime for friend_requests so users get instant notifications
ALTER PUBLICATION supabase_realtime ADD TABLE friend_requests;

-- Grant access (RLS is disabled per migration 002)
GRANT ALL ON friend_requests TO anon, authenticated;

-- Fix missing 'type' column on groups table (PGRST204 error on group creation)
ALTER TABLE groups ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'other';

-- Fix missing get_user_groups RPC (called at storage.js:325, was causing 404 errors)
CREATE OR REPLACE FUNCTION get_user_groups(p_user_id TEXT)
RETURNS SETOF groups AS $$
  SELECT * FROM groups
  WHERE members::jsonb @> jsonb_build_array(jsonb_build_object('id', p_user_id))
  ORDER BY created_at DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_groups(TEXT) TO anon, authenticated;

-- Fix missing 'category' and 'date' columns on expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ DEFAULT NOW();
