-- Run this once in Supabase: SQL Editor > New query > paste > Run
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_name text not null,
  contact_name text not null,
  phone text not null,
  industry text,
  city text,
  terms_version text not null,
  terms_accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "read own profile"   on public.profiles for select using (auth.uid() = id);
create policy "insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "update own profile" on public.profiles for update using (auth.uid() = id);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text, status text default 'queued', total int default 0, done int default 0,
  created_at timestamptz default now());
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null, idx int, row jsonb, status text default 'pending', result jsonb);
alter table public.campaigns enable row level security;
alter table public.leads enable row level security;
create policy "own campaigns" on public.campaigns for select using (auth.uid() = user_id);
create policy "own leads" on public.leads for select using (auth.uid() = user_id);
