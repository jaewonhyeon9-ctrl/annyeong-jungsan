-- ============================================================
-- 예약 완료 시 회수권 차감 — 어떤 회수권을 차감했는지 예약에 기록.
-- 완료 취소 시 복원(used_count -1)을 위해 필요. 멱등 작성.
-- ============================================================

alter table public.reservations
  add column if not exists deducted_pass_id uuid
    references public.service_passes(id) on delete set null;

notify pgrst, 'reload schema';
