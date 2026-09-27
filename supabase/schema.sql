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

-- 3. Clients — your private CRM. Two product lines: website builds and
--    SaaS/tool builds, tracked separately so you can report on each.
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_name text,
  email text,
  phone text,
  product_type text not null default 'website', -- 'website' | 'saas' | 'both'
  status text not null default 'lead',            -- 'lead' | 'active' | 'completed' | 'lost'
  notes text,
  created_at timestamptz not null default now()
);

-- 4. Invoices — your accountant's view. Linked to a client so revenue
--    reports can be grouped and totalled.
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  amount numeric(12,2) not null default 0,
  status text not null default 'pending', -- 'paid' | 'pending' | 'overdue'
  issue_date date not null default current_date,
  due_date date,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.clients enable row level security;
alter table public.invoices enable row level security;

-- Clients and invoices are business-private data: unlike settings/projects
-- above, there is NO public-read policy here at all. Only a signed-in
-- session (you, via /admin) can read or write these two tables — the
-- public site never queries them.
drop policy if exists "clients are readable by authenticated users" on public.clients;
create policy "clients are readable by authenticated users"
  on public.clients for select
  using (auth.role() = 'authenticated');

drop policy if exists "clients are writable by authenticated users" on public.clients;
create policy "clients are writable by authenticated users"
  on public.clients for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "invoices are readable by authenticated users" on public.invoices;
create policy "invoices are readable by authenticated users"
  on public.invoices for select
  using (auth.role() = 'authenticated');

drop policy if exists "invoices are writable by authenticated users" on public.invoices;
create policy "invoices are writable by authenticated users"
  on public.invoices for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

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
