-- 2026-06-07: RLS 무한 재귀 fix
-- helper 함수들이 SECURITY DEFINER 없이 정의되어 있어 profiles 테이블 RLS와
-- 무한 재귀 → "stack depth limit exceeded" (PostgreSQL 54001). SECURITY DEFINER로 재정의해 RLS 우회.

create or replace function public.current_part_id() returns part_id
language sql stable security definer set search_path = public as $$
  select part_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_center_id() returns uuid
language sql stable security definer set search_path = public as $$
  select center_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_profile_active() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(active, false) from public.profiles where id = auth.uid()
$$;
