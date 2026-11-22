-- Rnexa database update. Run ONCE in Supabase > SQL Editor > New query > paste all > Run.
-- Safe on your live database: it only creates what is missing and never deletes data.
-- NOTE: get_minutes / add_minutes / use_minutes already exist in your database and are NOT touched here.

-- 1) Tables the app uses (created only if missing)
alter table public.wallets   add column if not exists minutes int not null default 0;
alter table public.campaigns add column if not exists prompt text;
alter table public.campaigns add column if not exists ai_name text;

alter table public.packs add column if not exists kind text;
alter table public.packs add column if not exists mrp int;
alter table public.packs add column if not exists rate_per_min int;
alter table public.packs add column if not exists description text;
alter table public.packs add column if not exists badge text;
alter table public.packs add column if not exists button_text text;

alter table public.payments add column if not exists kind text;
alter table public.payments add column if not exists base_paise int;
alter table public.payments add column if not exists cgst_paise int;
alter table public.payments add column if not exists sgst_paise int;
alter table public.payments add column if not exists gst_rate numeric;
alter table public.payments add column if not exists gstin_snapshot text;
alter table public.payments add column if not exists item_text text;

create table if not exists public.lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  business jsonb, status text default 'new', error text,
  agent_id text, phone_number text, phone_number_id text,
  provisioned_at timestamptz, paid_until timestamptz, reminded_for timestamptz,
  expired_at timestamptz, released_at timestamptz,
  autopay_id text, autopay_status text, autopay_needs_update boolean default false,
  created_at timestamptz default now());

create table if not exists public.calls (
  execution_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  line_id uuid, from_number text, status text, duration_sec int, minutes int,
  transcript text, summary text, extracted jsonb, recording_url text,
  created_at timestamptz default now());

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
  kind text default 'message', title text, body text, created_at timestamptz default now());
create table if not exists public.notif_reads (
  user_id uuid not null references auth.users(id) on delete cascade, notif_id uuid not null,
  primary key (user_id, notif_id));

create table if not exists public.app_settings (key text primary key, value jsonb);
create table if not exists public.page_views (id bigint generated always as identity primary key, path text, created_at timestamptz default now());
create table if not exists public.presence (user_id uuid primary key references auth.users(id) on delete cascade, last_seen timestamptz, last_log timestamptz);
create table if not exists public.pings (id bigint generated always as identity primary key, user_id uuid references auth.users(id) on delete cascade, created_at timestamptz default now());
create table if not exists public.admin_alerts (id uuid primary key default gen_random_uuid(), kind text, title text, body text, read boolean not null default false, created_at timestamptz default now());

create table if not exists public.sales_people (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade,
  name text, phone text, code text unique, status text default 'active', payout_details text,
  terms_version text, terms_accepted_at timestamptz, created_at timestamptz default now());
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade,
  sp_id uuid not null references public.sales_people(id) on delete cascade, code text, created_at timestamptz default now());
create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(), sp_id uuid not null references public.sales_people(id) on delete cascade,
  client_user_id uuid, payment_id uuid, kind text, amount int not null, status text default 'earned', note text, created_at timestamptz default now());
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(), sp_id uuid not null references public.sales_people(id) on delete cascade,
  amount int not null, details text, status text default 'requested', requested_at timestamptz default now(), paid_at timestamptz, reference text);

-- 2) Lock every table so nobody can read it with the public (anon) key.
-- Your server uses the service key, which ignores these locks. The website only reads "profiles" directly, which already has its own policies.
alter table public.profiles        enable row level security;
alter table public.campaigns       enable row level security;
alter table public.leads           enable row level security;
alter table public.wallets         enable row level security;
alter table public.payments        enable row level security;
alter table public.account_status  enable row level security;
alter table public.packs           enable row level security;
alter table public.tickets         enable row level security;
alter table public.lines           enable row level security;
alter table public.calls           enable row level security;
alter table public.notifications   enable row level security;
alter table public.notif_reads     enable row level security;
alter table public.app_settings    enable row level security;
alter table public.page_views      enable row level security;
alter table public.presence        enable row level security;
alter table public.pings           enable row level security;
alter table public.admin_alerts    enable row level security;
alter table public.sales_people    enable row level security;
alter table public.referrals       enable row level security;
alter table public.commissions     enable row level security;
alter table public.payouts         enable row level security;
