-- 2026-06-12: patients.tags 컬럼 누락 보정
-- schema.sql 에는 tags(환자 태그: VIP/주의/장기관리 등)가 있으나
-- 라이브 DB는 초기 부트스트랩 이후 추가되지 않아 환자 등록 시
-- PGRST204 "Could not find the 'tags' column" 으로 실패함.
-- 코드(supabase.ts patients.create)는 tags 를 insert/select 하므로 컬럼을 추가한다.

alter table public.patients
  add column if not exists tags text[] not null default '{}';

-- PostgREST 스키마 캐시 즉시 갱신 (없으면 최대 수십 초 지연)
notify pgrst, 'reload schema';
