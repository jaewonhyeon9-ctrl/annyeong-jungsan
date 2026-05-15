-- ============================================================
-- 안녕메디컬 정산앱 — Supabase DB 스키마 (Phase 2)
-- 실행 위치: Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- 1) ENUM 타입
-- ============================================================
create type user_role as enum ('owner', 'admin');  -- owner=원장, admin=법인대표
create type payment_method as enum ('cash', 'card');
create type part_id as enum (
  'scalp',             -- 두피
  'permanent_makeup',  -- 반영구
  'smp',               -- SMP
  'pedicure',          -- 패디큐어
  'skincare'           -- 피부관리
);
create type inflow_channel as enum (
  'instagram', 'blog', 'naver_place', 'internet', 'outdoor',
  'phone', 'visitor', 'inpatient', 'referral', 'other'
);

-- ============================================================
-- 2) 센터 / 사용자
-- ============================================================
create table public.centers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_name  text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Supabase auth.users 를 확장한 프로필 (역할/소속 센터)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        user_role not null default 'owner',
  center_id   uuid references public.centers(id) on delete restrict,
  display_name text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 3) 시술 카탈로그 (admin이 수정 가능)
-- ============================================================
create table public.services (
  id              text primary key,           -- e.g. 'scalp.naeseong'
  part_id         part_id not null,
  name            text not null,
  default_price   integer not null default 0,
  active          boolean not null default true,
  sort_order      integer not null default 0
);

create table public.products (
  id              text primary key,
  name            text not null,
  default_price   integer not null default 0,
  kind            text not null default 'sale',  -- 'sale' | 'consumable' | 'both'
  active          boolean not null default true
);

-- ============================================================
-- 4) 환자 / 방문 차트
-- ============================================================
-- 의료법 안전 모드 — 정산 DB는 환자번호만 식별자로 사용.
-- 개인정보(이름/연락처/주소/생년월일)는 별도 `patient_personal` 테이블에
-- 보관하고 RLS로 원장 권한자만 접근 가능. 법인 admin은 정산 데이터만 봄.

create table public.patients (
  id                text primary key,                  -- 'C1-2605-0001' 형식
  center_id         uuid not null references public.centers(id) on delete cascade,
  first_visit_date  date not null,
  inflow_channels   inflow_channel[] not null default '{}',
  consent           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on public.patients (center_id, first_visit_date desc);

-- 개인정보 — 원장만 접근. 법인 admin은 못 봄.
create table public.patient_personal (
  patient_id  text primary key references public.patients(id) on delete cascade,
  name        text,
  gender      text,
  phone       text,
  birth_date  date,
  address     text,
  updated_at  timestamptz not null default now()
);

-- 의료 체크리스트
create table public.patient_charts (
  patient_id            text primary key references public.patients(id) on delete cascade,
  conditions            text[] not null default '{}',
  duration              text,
  care_experience       text[] not null default '{}',
  stress                text,
  pain                  text,
  allergy_has           boolean,
  allergy_types         text,
  products              text[] not null default '{}',
  occupation            text,
  lifestyle             jsonb not null default '{}',
  sleep_hours           integer,
  medications           text[] not null default '{}',
  pregnancy             text,
  foot_issue            jsonb,
  memo                  text,
  ocr_image_url         text,
  ocr_confidence        numeric(3,2),
  updated_at            timestamptz not null default now()
);

-- 방문 차트 (매 방문마다 1개)
create table public.visits (
  id              uuid primary key default gen_random_uuid(),
  patient_id      text not null references public.patients(id) on delete cascade,
  center_id       uuid not null references public.centers(id) on delete cascade,
  visit_date      date not null,
  part_id         part_id not null,
  visit_memo      text,
  before_photo_url text,
  after_photo_url  text,
  foot_issue_update jsonb,
  ocr_image_url   text,
  ocr_confidence  numeric(3,2),
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

create index on public.visits (patient_id, visit_date desc);
create index on public.visits (center_id, visit_date desc);

create table public.visit_sale_lines (
  id           uuid primary key default gen_random_uuid(),
  visit_id     uuid not null references public.visits(id) on delete cascade,
  service_id   text not null references public.services(id),
  service_name text not null,
  part_id      part_id not null,
  cash         integer not null default 0,
  card         integer not null default 0
);

create index on public.visit_sale_lines (visit_id);

-- ============================================================
-- 5) 일일 매출 입력 (Visit 없는 매출 — POS 마감/영수증 직접 입력용)
-- ============================================================
create table public.daily_entries (
  id          uuid primary key default gen_random_uuid(),
  center_id   uuid not null references public.centers(id) on delete cascade,
  entry_date  date not null,
  note        text,
  -- OCR 메타
  ocr_image_url   text,
  ocr_confidence  numeric(3,2),     -- 0.00 ~ 1.00
  ocr_auto_saved  boolean not null default false,
  ocr_needs_review boolean not null default false,
  -- 감사
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on public.daily_entries (center_id, entry_date desc);

create table public.sale_lines (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid not null references public.daily_entries(id) on delete cascade,
  service_id   text not null references public.services(id),
  service_name text not null,       -- snapshot
  part_id      part_id not null,    -- snapshot
  cash         integer not null default 0,
  card         integer not null default 0
);

create index on public.sale_lines (entry_id);

create table public.product_sale_lines (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid not null references public.daily_entries(id) on delete cascade,
  product_id   text not null references public.products(id),
  product_name text not null,
  quantity     integer not null default 1,
  unit_price   integer not null default 0,
  cash         integer not null default 0,
  card         integer not null default 0
);

create table public.product_consumptions (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid not null references public.daily_entries(id) on delete cascade,
  product_id   text not null references public.products(id),
  product_name text not null,
  quantity     integer not null default 1
);

-- ============================================================
-- 6) 환자 유입 (월별)
-- ============================================================
create table public.inflow_entries (
  id            uuid primary key default gen_random_uuid(),
  center_id     uuid not null references public.centers(id) on delete cascade,
  month         text not null,   -- 'YYYY-MM'
  instagram     integer not null default 0,
  blog          integer not null default 0,
  naver_place   integer not null default 0,
  internet      integer not null default 0,
  outdoor       integer not null default 0,
  phone         integer not null default 0,
  visitor       integer not null default 0,
  inpatient     integer not null default 0,
  referral      integer not null default 0,
  other         integer not null default 0,
  new_patients  integer not null default 0,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (center_id, month)
);

-- ============================================================
-- 7) 정산 규칙 (센터별)
-- ============================================================
create table public.settlement_rules (
  center_id            uuid primary key references public.centers(id) on delete cascade,
  vat_rate             numeric(4,3) not null default 0.100,
  card_fee_rate        numeric(4,3) not null default 0.025,
  center_share_pct     numeric(4,3) not null default 0.500,
  corp_share_pct       numeric(4,3) not null default 0.500,
  vat_exempt_parts     part_id[] not null default '{}',
  updated_at           timestamptz not null default now()
);

-- ============================================================
-- 8) RLS — 원장은 자기 센터만, admin은 전 센터
--     단 patient_personal 은 환자가 속한 센터의 원장만 (admin도 못 봄)
-- ============================================================
alter table public.centers enable row level security;
alter table public.profiles enable row level security;
alter table public.daily_entries enable row level security;
alter table public.sale_lines enable row level security;
alter table public.product_sale_lines enable row level security;
alter table public.product_consumptions enable row level security;
alter table public.inflow_entries enable row level security;
alter table public.settlement_rules enable row level security;
alter table public.services enable row level security;
alter table public.products enable row level security;
alter table public.patients enable row level security;
alter table public.patient_personal enable row level security;
alter table public.patient_charts enable row level security;
alter table public.visits enable row level security;
alter table public.visit_sale_lines enable row level security;

-- helper: 현재 유저의 role
create or replace function public.current_role() returns user_role
language sql stable as $$
  select role from public.profiles where id = auth.uid()
$$;

-- helper: 현재 유저의 center_id
create or replace function public.current_center_id() returns uuid
language sql stable as $$
  select center_id from public.profiles where id = auth.uid()
$$;

-- 카탈로그(services/products): 모두 SELECT 가능, admin만 변경
create policy "services_read" on public.services for select using (true);
create policy "services_admin_write" on public.services for all using (
  public.current_role() = 'admin'
) with check (public.current_role() = 'admin');
create policy "products_read" on public.products for select using (true);
create policy "products_admin_write" on public.products for all using (
  public.current_role() = 'admin'
) with check (public.current_role() = 'admin');

-- centers: admin은 전체, owner는 자기 센터
create policy "centers_read" on public.centers for select using (
  public.current_role() = 'admin' or id = public.current_center_id()
);
create policy "centers_admin_write" on public.centers for all using (
  public.current_role() = 'admin'
) with check (public.current_role() = 'admin');

-- profiles: 본인만 R, admin은 전체 R/W
create policy "profiles_self_read" on public.profiles for select using (
  id = auth.uid() or public.current_role() = 'admin'
);
create policy "profiles_admin_write" on public.profiles for all using (
  public.current_role() = 'admin'
) with check (public.current_role() = 'admin');

-- daily_entries: owner는 자기 센터만, admin은 전체
create policy "entries_read" on public.daily_entries for select using (
  public.current_role() = 'admin' or center_id = public.current_center_id()
);
create policy "entries_owner_write" on public.daily_entries for all using (
  center_id = public.current_center_id() or public.current_role() = 'admin'
) with check (
  center_id = public.current_center_id() or public.current_role() = 'admin'
);

-- 자식 테이블 — entry의 권한을 따름
create policy "sale_lines_via_entry" on public.sale_lines for all using (
  exists (
    select 1 from public.daily_entries e
    where e.id = sale_lines.entry_id
      and (public.current_role() = 'admin' or e.center_id = public.current_center_id())
  )
) with check (
  exists (
    select 1 from public.daily_entries e
    where e.id = sale_lines.entry_id
      and (public.current_role() = 'admin' or e.center_id = public.current_center_id())
  )
);

create policy "product_sales_via_entry" on public.product_sale_lines for all using (
  exists (
    select 1 from public.daily_entries e
    where e.id = product_sale_lines.entry_id
      and (public.current_role() = 'admin' or e.center_id = public.current_center_id())
  )
) with check (
  exists (
    select 1 from public.daily_entries e
    where e.id = product_sale_lines.entry_id
      and (public.current_role() = 'admin' or e.center_id = public.current_center_id())
  )
);

create policy "product_consumptions_via_entry" on public.product_consumptions for all using (
  exists (
    select 1 from public.daily_entries e
    where e.id = product_consumptions.entry_id
      and (public.current_role() = 'admin' or e.center_id = public.current_center_id())
  )
) with check (
  exists (
    select 1 from public.daily_entries e
    where e.id = product_consumptions.entry_id
      and (public.current_role() = 'admin' or e.center_id = public.current_center_id())
  )
);

-- inflow: owner는 자기 센터만, admin은 전체
create policy "inflow_read" on public.inflow_entries for select using (
  public.current_role() = 'admin' or center_id = public.current_center_id()
);
create policy "inflow_write" on public.inflow_entries for all using (
  center_id = public.current_center_id() or public.current_role() = 'admin'
) with check (
  center_id = public.current_center_id() or public.current_role() = 'admin'
);

-- 정산 룰: 모두 READ, admin만 WRITE
create policy "rules_read" on public.settlement_rules for select using (true);
create policy "rules_admin_write" on public.settlement_rules for all using (
  public.current_role() = 'admin'
) with check (public.current_role() = 'admin');

-- 환자 — 원장은 자기 센터, admin은 전체 (단 개인정보 X)
create policy "patients_read" on public.patients for select using (
  public.current_role() = 'admin' or center_id = public.current_center_id()
);
create policy "patients_owner_write" on public.patients for all using (
  center_id = public.current_center_id() or public.current_role() = 'admin'
) with check (
  center_id = public.current_center_id() or public.current_role() = 'admin'
);

-- 개인정보 — 해당 환자의 센터 원장만 (admin도 못 봄)
create policy "patient_personal_owner_only" on public.patient_personal for all using (
  exists (
    select 1 from public.patients p
    where p.id = patient_personal.patient_id
      and p.center_id = public.current_center_id()
  )
) with check (
  exists (
    select 1 from public.patients p
    where p.id = patient_personal.patient_id
      and p.center_id = public.current_center_id()
  )
);

-- 의료 차트 — 원장 + admin 모두 R/W (의료 정보는 진료/품질관리 목적)
create policy "patient_charts_read" on public.patient_charts for select using (
  public.current_role() = 'admin' or exists (
    select 1 from public.patients p
    where p.id = patient_charts.patient_id
      and p.center_id = public.current_center_id()
  )
);
create policy "patient_charts_write" on public.patient_charts for all using (
  exists (
    select 1 from public.patients p
    where p.id = patient_charts.patient_id
      and (public.current_role() = 'admin' or p.center_id = public.current_center_id())
  )
) with check (
  exists (
    select 1 from public.patients p
    where p.id = patient_charts.patient_id
      and (public.current_role() = 'admin' or p.center_id = public.current_center_id())
  )
);

-- 방문 — 원장 본인 센터, admin 전체
create policy "visits_read" on public.visits for select using (
  public.current_role() = 'admin' or center_id = public.current_center_id()
);
create policy "visits_write" on public.visits for all using (
  center_id = public.current_center_id() or public.current_role() = 'admin'
) with check (
  center_id = public.current_center_id() or public.current_role() = 'admin'
);
create policy "visit_sale_lines_via_visit" on public.visit_sale_lines for all using (
  exists (
    select 1 from public.visits v
    where v.id = visit_sale_lines.visit_id
      and (public.current_role() = 'admin' or v.center_id = public.current_center_id())
  )
) with check (
  exists (
    select 1 from public.visits v
    where v.id = visit_sale_lines.visit_id
      and (public.current_role() = 'admin' or v.center_id = public.current_center_id())
  )
);

-- ============================================================
-- 8) updated_at 자동갱신 트리거
-- ============================================================
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger entries_touch before update on public.daily_entries
  for each row execute function public.touch_updated_at();
create trigger inflow_touch before update on public.inflow_entries
  for each row execute function public.touch_updated_at();
create trigger rules_touch before update on public.settlement_rules
  for each row execute function public.touch_updated_at();

-- ============================================================
-- 9) 시드 데이터 (초기 1개 센터 + 기본 카탈로그)
-- ============================================================
-- 카탈로그 시드는 src/lib/services.ts 와 동일 — 별도 시드 스크립트로 분리하거나
-- Supabase Dashboard 에서 직접 입력
