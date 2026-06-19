-- 결제 주체(입력 주체)별 매출 구분: 현금 / 병원포스 / 법인포스
-- 기존 컬럼 유지: cash(현금), card(기존 미분류 카드 — 과거 데이터 보존)
-- 신규 컬럼: hospital_card(병원포스), corp_card(법인포스)
-- 분할결제 지원 — 한 라인에 여러 주체 금액이 동시에 들어갈 수 있음.

ALTER TABLE visit_sale_lines
  ADD COLUMN IF NOT EXISTS hospital_card integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS corp_card integer NOT NULL DEFAULT 0;

ALTER TABLE sale_lines
  ADD COLUMN IF NOT EXISTS hospital_card integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS corp_card integer NOT NULL DEFAULT 0;
