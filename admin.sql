-- Run once in Supabase SQL Editor (admin panel tables)
create table if not exists public.account_status (user_id uuid primary key references auth.users(id) on delete cascade, email text, suspended boolean not null default false);
create table if not exists public.packs (id text primary key, name text, calls int, price int, active boolean default true, sort int default 0);
insert into public.packs values ('starter','Starter',50,1000,true,1),('growth','Growth',100,1800,true,2),('business','Business',500,8000,true,3) on conflict do nothing;
create table if not exists public.tickets (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  subject text, message text, status text default 'open', admin_reply text, created_at timestamptz default now());
alter table public.account_status enable row level security;
alter table public.packs enable row level security;
alter table public.tickets enable row level security;
