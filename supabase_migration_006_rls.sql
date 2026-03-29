-- ============================================================
-- Migration 006: Enable Row-Level Security on all tables
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================
-- This enables RLS so that the anon key alone can't read/write everything.
-- Policies use auth.uid() which maps to the Supabase Auth user ID.
-- Demo accounts (demo-*) are local-only and never hit Supabase, so
-- they are unaffected by these policies.
-- ============================================================

-- 1. Revoke the blanket grants from migration 002
REVOKE ALL ON TABLE users FROM anon;
REVOKE ALL ON TABLE groups FROM anon;
REVOKE ALL ON TABLE expenses FROM anon;
REVOKE ALL ON TABLE settlements FROM anon;
REVOKE ALL ON TABLE friends FROM anon;
REVOKE ALL ON TABLE activity FROM anon;
REVOKE ALL ON TABLE analytics FROM anon;
REVOKE ALL ON TABLE group_invites FROM anon;
REVOKE ALL ON TABLE friend_requests FROM anon;
REVOKE ALL ON TABLE pending_invites FROM anon;

-- 2. Enable RLS on every table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_invites ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. Policies
-- ============================================================

-- ── users ────────────────────────────────────────────────────
-- Users can read any profile (needed to show names in groups)
CREATE POLICY "users_select" ON users
  FOR SELECT TO authenticated USING (true);

-- Users can insert/update only their own row
CREATE POLICY "users_insert" ON users
  FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = id);

CREATE POLICY "users_update" ON users
  FOR UPDATE TO authenticated USING (auth.uid()::text = id);

-- ── groups ───────────────────────────────────────────────────
-- A user can see groups they created or are a member of
CREATE POLICY "groups_select" ON groups
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()::text
    OR members @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
  );

-- Any authenticated user can create a group
CREATE POLICY "groups_insert" ON groups
  FOR INSERT TO authenticated WITH CHECK (true);

-- Only creator or members can update a group
CREATE POLICY "groups_update" ON groups
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()::text
    OR members @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
  );

-- Only creator can delete a group
CREATE POLICY "groups_delete" ON groups
  FOR DELETE TO authenticated
  USING (created_by = auth.uid()::text);

-- ── expenses ─────────────────────────────────────────────────
-- Users can see expenses in groups they belong to
CREATE POLICY "expenses_select" ON expenses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = expenses.group_id
        AND (
          g.created_by = auth.uid()::text
          OR g.members @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
        )
    )
  );

-- Members of a group can insert expenses
CREATE POLICY "expenses_insert" ON expenses
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_id
        AND (
          g.created_by = auth.uid()::text
          OR g.members @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
        )
    )
  );

-- Members can delete expenses in their groups
CREATE POLICY "expenses_delete" ON expenses
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = expenses.group_id
        AND (
          g.created_by = auth.uid()::text
          OR g.members @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
        )
    )
  );

-- ── settlements ──────────────────────────────────────────────
-- Users can see settlements they paid or received
CREATE POLICY "settlements_select" ON settlements
  FOR SELECT TO authenticated
  USING (
    paid_by = auth.uid()::text
    OR paid_to = auth.uid()::text
  );

-- Users can create settlements where they are the payer
CREATE POLICY "settlements_insert" ON settlements
  FOR INSERT TO authenticated WITH CHECK (paid_by = auth.uid()::text);

-- ── friends ──────────────────────────────────────────────────
-- Users can see their own friend rows
CREATE POLICY "friends_select" ON friends
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text OR friend_id = auth.uid()::text);

CREATE POLICY "friends_insert" ON friends
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "friends_delete" ON friends
  FOR DELETE TO authenticated
  USING (user_id = auth.uid()::text OR friend_id = auth.uid()::text);

-- ── activity ─────────────────────────────────────────────────
-- Users can see activity in their groups or where they're the actor
CREATE POLICY "activity_select" ON activity
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = activity.group_id
        AND (
          g.created_by = auth.uid()::text
          OR g.members @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
        )
    )
  );

CREATE POLICY "activity_insert" ON activity
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── analytics ────────────────────────────────────────────────
-- Only the user's own analytics; insert-only (no reads needed)
CREATE POLICY "analytics_insert" ON analytics
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── group_invites ────────────────────────────────────────────
-- Users can see invites sent to them or invites they sent
CREATE POLICY "group_invites_select" ON group_invites
  FOR SELECT TO authenticated
  USING (invited_user_id = auth.uid()::text OR invited_by_user_id = auth.uid()::text);

CREATE POLICY "group_invites_insert" ON group_invites
  FOR INSERT TO authenticated WITH CHECK (invited_by_user_id = auth.uid()::text);

-- Invited user can update (accept/reject)
CREATE POLICY "group_invites_update" ON group_invites
  FOR UPDATE TO authenticated
  USING (invited_user_id = auth.uid()::text);

-- ── friend_requests ──────────────────────────────────────────
-- Users can see requests they sent or received
CREATE POLICY "friend_requests_select" ON friend_requests
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid()::text OR receiver_id = auth.uid()::text);

CREATE POLICY "friend_requests_insert" ON friend_requests
  FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid()::text);

-- Receiver can update (accept/reject)
CREATE POLICY "friend_requests_update" ON friend_requests
  FOR UPDATE TO authenticated
  USING (receiver_id = auth.uid()::text);

-- ── pending_invites ──────────────────────────────────────────
-- Users can see and create invites they sent
CREATE POLICY "pending_invites_select" ON pending_invites
  FOR SELECT TO authenticated
  USING (inviter_id = auth.uid()::text);

CREATE POLICY "pending_invites_insert" ON pending_invites
  FOR INSERT TO authenticated WITH CHECK (inviter_id = auth.uid()::text);

-- ============================================================
-- 4. Keep the get_user_groups function as SECURITY DEFINER
--    so it bypasses RLS (it already filters by user_id)
-- ============================================================
-- No changes needed — the function from migration 002 uses
-- SECURITY DEFINER which runs as the function owner, not the caller.
