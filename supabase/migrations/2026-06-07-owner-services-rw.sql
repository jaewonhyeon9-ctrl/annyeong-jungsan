-- 2026-06-07: 원장(owner)이 자기 파트의 시술을 직접 등록/수정/삭제할 수 있도록 RLS 추가
-- (이전엔 admin만 변경 가능 → localStorage로 우회하던 것을 Supabase로 통일)

create policy "services_owner_write" on public.services for all
using (
  public.current_role() = 'owner'
  and part_id = public.current_part_id()
  and public.current_profile_active()
)
with check (
  public.current_role() = 'owner'
  and part_id = public.current_part_id()
  and public.current_profile_active()
);
