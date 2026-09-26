-- Vantik — Supabase schema
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run.

-- 1. Site-wide counters + design theme shown on the public homepage
create table if not exists public.settings (
  id int primary key default 1,
  clients_count int not null default 19,
  projects_count int not null default 21,
  theme text not null default 'futuristic',
  updated_at timestamptz not null default now(),
  constraint settings_singleton check (id = 1)
);

-- Already ran this file before the theme feature existed? This adds the
-- column without touching your existing row.
alter table public.settings add column if not exists theme text not null default 'futuristic';

insert into public.settings (id, clients_count, projects_count, theme)
values (1, 19, 21, 'futuristic')
on conflict (id) do nothing;

-- 2. Client portfolio projects shown under "Recent client work"
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  industry text not null,
  description text,
  image_url text,
  live_url text,
  github_url text,
  tags text[] not null default '{}',
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

-- Row Level Security -----------------------------------------------------
alter table public.settings enable row level security;
alter table public.projects enable row level security;

-- Anyone (the public site, using the anon key) can read.
drop policy if exists "settings are publicly readable" on public.settings;
create policy "settings are publicly readable"
  on public.settings for select
  using (true);

drop policy if exists "projects are publicly readable" on public.projects;
create policy "projects are publicly readable"
  on public.projects for select
  using (true);

-- Only signed-in users (you, via the admin panel) can write.
drop policy if exists "settings are writable by authenticated users" on public.settings;
create policy "settings are writable by authenticated users"
  on public.settings for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "projects are writable by authenticated users" on public.projects;
create policy "projects are writable by authenticated users"
  on public.projects for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
