-- ============================================================
-- Migration 002: Fix data sync between accounts
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Ensure type column exists on groups (from migration 001)
ALTER TABLE groups ADD COLUMN IF NOT EXISTS type text DEFAULT 'other';

-- 2. Disable RLS on all tables so all authenticated users can read/write shared data
--    (Friends, groups, and expenses are intentionally shared between users)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE settlements DISABLE ROW LEVEL SECURITY;
ALTER TABLE friends DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity DISABLE ROW LEVEL SECURITY;
ALTER TABLE analytics DISABLE ROW LEVEL SECURITY;

-- 3. Grant full access to authenticated and anon roles on all tables
GRANT ALL ON TABLE users TO authenticated, anon;
GRANT ALL ON TABLE groups TO authenticated, anon;
GRANT ALL ON TABLE expenses TO authenticated, anon;
GRANT ALL ON TABLE settlements TO authenticated, anon;
GRANT ALL ON TABLE friends TO authenticated, anon;
GRANT ALL ON TABLE activity TO authenticated, anon;
GRANT ALL ON TABLE analytics TO authenticated, anon;

-- 4. Create a reliable server-side function to fetch groups by membership
--    (More reliable than client-side JSONB contains filter)
CREATE OR REPLACE FUNCTION get_user_groups(p_user_id text)
RETURNS TABLE (
  id text,
  name text,
  type text,
  description text,
  created_by text,
  members jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, name, COALESCE(type, 'other') as type, COALESCE(description, '') as description,
         created_by, COALESCE(members, '[]'::jsonb) as members, created_at, updated_at
  FROM groups
  WHERE created_by = p_user_id
     OR members @> jsonb_build_array(jsonb_build_object('id', p_user_id))
  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_user_groups(text) TO authenticated, anon;
