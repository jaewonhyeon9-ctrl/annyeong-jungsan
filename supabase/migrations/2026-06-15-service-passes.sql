-- ============================================================
-- 회수권 (service_passes) — N회 패키지 구매 → 방문마다 1회씩 차감
-- 멱등 작성: 재실행 안전. loyalty_history RLS 패턴을 그대로 따른다.
-- ============================================================

create table if not exists public.service_passes (
  id                uuid primary key default gen_random_uuid(),
  patient_id        text not null references public.patients(id) on delete cascade,
  center_id         uuid not null references public.centers(id) on delete cascade,
  service_id        text not null,
  service_name      text not null,                              -- snapshot (시술명 바뀌어도 유지)
  part_id           part_id not null,
  total_count       integer not null check (total_count > 0),   -- 구매한 총 횟수
  used_count        integer not null default 0 check (used_count >= 0),
  purchase_visit_id uuid references public.visits(id) on delete set null,
  note              text,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  constraint service_passes_used_lte_total check (used_count <= total_count)
);

create index if not exists service_passes_patient_idx
  on public.service_passes (patient_id, created_at desc);

alter table public.service_passes enable row level security;

drop policy if exists "service_passes_read" on public.service_passes;
create policy "service_passes_read" on public.service_passes for select using (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'owner'
    and center_id = public.current_center_id()
    and public.current_profile_active()
  )
);

drop policy if exists "service_passes_owner_write" on public.service_passes;
create policy "service_passes_owner_write" on public.service_passes for all using (
  public.current_role() = 'owner'
  and center_id = public.current_center_id()
  and public.current_profile_active()
) with check (
  public.current_role() = 'owner'
  and center_id = public.current_center_id()
  and public.current_profile_active()
);

drop policy if exists "service_passes_admin_write" on public.service_passes;
create policy "service_passes_admin_write" on public.service_passes for all using (
  public.current_role() = 'admin'
) with check (public.current_role() = 'admin');

notify pgrst, 'reload schema';
