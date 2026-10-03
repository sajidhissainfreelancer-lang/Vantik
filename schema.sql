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

-- ===== credits & payments (run this part once) =====
create table if not exists public.wallets (user_id uuid primary key references auth.users(id) on delete cascade, credits int not null default 0);
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  razorpay_order_id text unique, razorpay_payment_id text, pack text, calls int, amount_paise int,
  status text default 'created', created_at timestamptz default now());
alter table public.wallets enable row level security;
alter table public.payments enable row level security;
create policy "own wallet" on public.wallets for select using (auth.uid() = user_id);
create policy "own payments" on public.payments for select using (auth.uid() = user_id);

create or replace function public.get_credits(p_user uuid, p_free int) returns int language plpgsql security definer as $$
declare c int; begin
  insert into public.wallets(user_id, credits) values (p_user, p_free) on conflict (user_id) do nothing;
  select credits into c from public.wallets where user_id = p_user; return c; end $$;
create or replace function public.add_credits(p_user uuid, p_n int) returns int language sql security definer as $$
  update public.wallets set credits = credits + p_n where user_id = p_user returning credits $$;
create or replace function public.use_credits(p_user uuid, p_n int) returns int language sql security definer as $$
  update public.wallets set credits = credits - p_n where user_id = p_user and credits >= p_n returning credits $$;
revoke execute on function public.get_credits(uuid,int), public.add_credits(uuid,int), public.use_credits(uuid,int) from public, anon, authenticated;
