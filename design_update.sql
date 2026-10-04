-- Run once in Supabase SQL Editor
alter table public.profiles add column if not exists pan text;
alter table public.profiles add column if not exists gstin text;
alter table public.profiles add column if not exists billing_address text;
