-- 2026-06-07: 예약 테이블 (월간 캘린더 + 일별 상세 대시보드 용)
-- 원장은 자기 center+part 예약만 R/W, admin은 전체.

create type reservation_status as enum ('scheduled', 'completed', 'cancelled', 'no_show');

create table public.reservations (
  id              uuid primary key default gen_random_uuid(),
  center_id       uuid not null references public.centers(id) on delete cascade,
  part_id         part_id not null,
  owner_id        uuid references public.profiles(id) on delete set null,
  patient_id      text references public.patients(id) on delete set null,
  patient_name    text,                       -- 비환자(신규) 예약 시 직접 입력
  patient_phone   text,
  scheduled_at    timestamptz not null,
  duration_min    integer not null default 30,
  service_id      text references public.services(id) on delete set null,
  service_name    text,                       -- 시술 스냅샷 (서비스가 지워져도 유지)
  status          reservation_status not null default 'scheduled',
  memo            text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz
);

create index reservations_center_scheduled_idx
  on public.reservations (center_id, scheduled_at);
create index reservations_part_scheduled_idx
  on public.reservations (part_id, scheduled_at);
create index reservations_patient_idx
  on public.reservations (patient_id)
  where patient_id is not null;

alter table public.reservations enable row level security;

create policy "reservations_read" on public.reservations for select using (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'owner'
    and center_id = public.current_center_id()
    and part_id = public.current_part_id()
    and public.current_profile_active()
  )
);

create policy "reservations_owner_write" on public.reservations for all using (
  public.current_role() = 'owner'
  and center_id = public.current_center_id()
  and part_id = public.current_part_id()
  and public.current_profile_active()
) with check (
  public.current_role() = 'owner'
  and center_id = public.current_center_id()
  and part_id = public.current_part_id()
  and public.current_profile_active()
);

create policy "reservations_admin_write" on public.reservations for all using (
  public.current_role() = 'admin'
) with check (public.current_role() = 'admin');
