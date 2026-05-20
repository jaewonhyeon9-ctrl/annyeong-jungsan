-- 파트별 증상/관리경험/사용제품/복용약 마스터 + 홈케어 마스터

-- 1) 증상 마스터 (파트별, 카테고리별 칩)
create table if not exists public.symptom_master (
  id          uuid primary key default gen_random_uuid(),
  part_id     part_id not null,
  category    text not null,        -- 'condition' | 'care_experience' | 'product_in_chart' | 'medication' | 'allergy' | 'etc'
  label       text not null,
  value       text not null,        -- OCR 매칭용 코드 (영문/숫자)
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_symptom_master_lookup
  on public.symptom_master (part_id, category, sort_order);
create unique index if not exists uq_symptom_master_value
  on public.symptom_master (part_id, category, value) where active;

alter table public.symptom_master enable row level security;

drop policy if exists "symptom_master_read" on public.symptom_master;
create policy "symptom_master_read" on public.symptom_master
  for select using (true);

drop policy if exists "symptom_master_admin_write" on public.symptom_master;
create policy "symptom_master_admin_write" on public.symptom_master
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- 2) 홈케어 마스터 (파트별 또는 공통)
create table if not exists public.homecare_master (
  id          uuid primary key default gen_random_uuid(),
  part_id     part_id,              -- null = 모든 파트 공통
  name        text not null,
  instruction text,                  -- 환자 안내 문구
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_homecare_master_lookup
  on public.homecare_master (part_id, sort_order);

alter table public.homecare_master enable row level security;

drop policy if exists "homecare_master_read" on public.homecare_master;
create policy "homecare_master_read" on public.homecare_master
  for select using (true);

drop policy if exists "homecare_master_admin_write" on public.homecare_master;
create policy "homecare_master_admin_write" on public.homecare_master
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- 3) 환자/방문에 홈케어 추가
-- patient_charts: 기본 홈케어 (등록 시 기본 처방)
alter table public.patient_charts
  add column if not exists homecare_ids uuid[] not null default '{}';

-- visits: 방문별 추가 홈케어 (누적 처방)
alter table public.visits
  add column if not exists homecare_ids uuid[] not null default '{}',
  add column if not exists homecare_memo text;
