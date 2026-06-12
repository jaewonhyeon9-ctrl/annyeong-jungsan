-- 2026-06-12: reservations.practitioner_name 추가
-- 시술자(치료사)는 별도 로그인 계정이 아닐 수 있어, 원장 1명 밑에서
-- 여러 시술자를 "이름"으로 지정하고 예약 그리드를 시술자별 칸으로 나눈다.
-- owner_id(원장 계정)는 그대로 유지하고, 표시·칸분할 기준은 practitioner_name 사용.

alter table public.reservations
  add column if not exists practitioner_name text;

-- PostgREST 스키마 캐시 즉시 갱신
notify pgrst, 'reload schema';
