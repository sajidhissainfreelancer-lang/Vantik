-- Run once in Supabase SQL Editor
create or replace function public.charge_minutes(p_user uuid, p_n int) returns int language sql security definer as $$
  update public.wallets set minutes = greatest(minutes - p_n, 0) where user_id = p_user returning minutes $$;
revoke execute on function public.charge_minutes(uuid,int) from public, anon, authenticated;
