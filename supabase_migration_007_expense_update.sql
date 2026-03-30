-- ============================================================
-- Migration 007: Add UPDATE policy for expenses
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================
-- Comments and expense edits were silently failing because
-- migration 006 only added SELECT, INSERT, DELETE policies
-- for expenses — no UPDATE policy existed.
-- ============================================================

CREATE POLICY "expenses_update" ON expenses
  FOR UPDATE TO authenticated
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
