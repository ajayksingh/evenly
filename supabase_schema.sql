-- ============================================================
-- Evenly Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Users
create table if not exists users (
  id text primary key,
  name text not null,
  email text unique not null,
  avatar text,
  phone text default '',
  provider text default 'email',
  created_at timestamptz default now()
);

-- Groups
create table if not exists groups (
  id text primary key,
  name text not null,
  type text default 'other',
  description text default '',
  created_by text,
  members jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Expenses
create table if not exists expenses (
  id text primary key,
  group_id text,
  description text not null,
  amount numeric not null,
  currency text default 'INR',
  paid_by jsonb not null,
  splits jsonb default '[]',
  category text default 'general',
  date timestamptz default now(),
  created_at timestamptz default now()
);

-- Settlements
create table if not exists settlements (
  id text primary key,
  paid_by text not null,
  paid_to text not null,
  amount numeric not null,
  currency text default 'INR',
  group_id text,
  note text default '',
  created_at timestamptz default now()
);

-- Friends
create table if not exists friends (
  id text primary key,
  user_id text not null,
  friend_id text not null,
  created_at timestamptz default now()
);

-- Activity
create table if not exists activity (
  id text primary key,
  type text not null,
  user_id text,
  group_id text,
  expense_id text,
  description text,
  amount numeric,
  group_name text,
  paid_by_name text,
  created_at timestamptz default now()
);

-- Analytics (free analytics — no extra service needed!)
create table if not exists analytics (
  id text primary key,
  event text not null,
  user_id text,
  params jsonb default '{}',
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security (RLS) — enable for production
-- ============================================================
-- Uncomment after setting up Supabase Auth:
--
-- alter table users enable row level security;
-- alter table groups enable row level security;
-- alter table expenses enable row level security;
-- alter table settlements enable row level security;
-- alter table friends enable row level security;
-- alter table activity enable row level security;
--
-- create policy "Users can read their own data"
--   on users for select using (auth.uid()::text = id);
-- create policy "Users can insert their own record"
--   on users for insert with check (auth.uid()::text = id);
-- create policy "Users can update their own record"
--   on users for update using (auth.uid()::text = id);
