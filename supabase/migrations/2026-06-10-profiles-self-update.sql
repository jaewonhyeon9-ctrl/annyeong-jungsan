-- 2026-06-10: 원장 본인 프로필 UPDATE 허용
-- 증상: /owner/profile 에서 연락처/은행 계좌 저장 시 RLS 0행 → 에러
-- 원장은 본인 행만 UPDATE, 역할/활성화 상태는 본인이 못 바꿈.

drop policy if exists profiles_self_update on public.profiles;

create policy profiles_self_update on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = public.current_role()
    and active = public.current_profile_active()
  );
