-- 2026-06-07: UB+ 참고 통합관리 4종 추가
-- (1) 상담 관리 — consultations 테이블
-- (2) 미수금 — visits.outstanding_amount + daily_entries.outstanding_amount
-- (3) 적립금 — patients.loyalty_points + loyalty_history (선택, 일단 잔액만)
-- (4) 통계 — view (집계 빠른 응답용)

-- ============================================================
-- (1) 상담 관리
-- ============================================================
create table public.consultations (
  id              uuid primary key default gen_random_uuid(),
  center_id       uuid not null references public.centers(id) on delete cascade,
  part_id         part_id,
  patient_id      text not null references public.patients(id) on delete cascade,
  owner_id        uuid references public.profiles(id) on delete set null,
  consulted_at    timestamptz not null default now(),
  content         text not null,
  next_followup   date,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz
);

create index consultations_patient_idx
  on public.consultations (patient_id, consulted_at desc);
create index consultations_center_idx
  on public.consultations (center_id, consulted_at desc);

alter table public.consultations enable row level security;

create policy "consultations_read" on public.consultations for select using (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'owner'
    and center_id = public.current_center_id()
    and public.current_profile_active()
  )
);
create policy "consultations_owner_write" on public.consultations for all using (
  public.current_role() = 'owner'
  and center_id = public.current_center_id()
  and public.current_profile_active()
) with check (
  public.current_role() = 'owner'
  and center_id = public.current_center_id()
  and public.current_profile_active()
);
create policy "consultations_admin_write" on public.consultations for all using (
  public.current_role() = 'admin'
) with check (public.current_role() = 'admin');

-- ============================================================
-- (2) 미수금 — visits / daily_entries 양쪽 추가
-- ============================================================
alter table public.visits
  add column if not exists outstanding_amount integer not null default 0;
alter table public.daily_entries
  add column if not exists outstanding_amount integer not null default 0;

-- ============================================================
-- (3) 적립금
-- ============================================================
alter table public.patients
  add column if not exists loyalty_points integer not null default 0;

-- 적립금 이력 (선택적, 일단 만들어둠)
create table public.loyalty_history (
  id              uuid primary key default gen_random_uuid(),
  patient_id      text not null references public.patients(id) on delete cascade,
  center_id       uuid not null references public.centers(id) on delete cascade,
  delta           integer not null,             -- 양수=적립, 음수=사용
  reason          text,
  balance_after   integer not null,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index loyalty_history_patient_idx
  on public.loyalty_history (patient_id, created_at desc);

alter table public.loyalty_history enable row level security;

create policy "loyalty_history_read" on public.loyalty_history for select using (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'owner'
    and center_id = public.current_center_id()
    and public.current_profile_active()
  )
);
create policy "loyalty_history_owner_write" on public.loyalty_history for all using (
  public.current_role() = 'owner'
  and center_id = public.current_center_id()
  and public.current_profile_active()
) with check (
  public.current_role() = 'owner'
  and center_id = public.current_center_id()
  and public.current_profile_active()
);
create policy "loyalty_history_admin_write" on public.loyalty_history for all using (
  public.current_role() = 'admin'
) with check (public.current_role() = 'admin');

-- ============================================================
-- (4) 통계 view — 환자별 매출 / 일별 매출 / 시술별 매출
-- ============================================================
-- 시술별 매출 (visit_sale_lines + sale_lines 합집합)
create or replace view public.v_sales_by_service as
select
  service_id,
  service_name,
  part_id,
  center_id,
  visit_date as sale_date,
  sum(cash + card) as total
from (
  select vsl.service_id, vsl.service_name, vsl.part_id, v.center_id, v.visit_date, vsl.cash, vsl.card
  from public.visit_sale_lines vsl
  join public.visits v on v.id = vsl.visit_id
  union all
  select sl.service_id, sl.service_name, sl.part_id, e.center_id, e.entry_date as visit_date, sl.cash, sl.card
  from public.sale_lines sl
  join public.daily_entries e on e.id = sl.entry_id
) src
group by service_id, service_name, part_id, center_id, visit_date;

select 'ub-plus features migration done' as status;
