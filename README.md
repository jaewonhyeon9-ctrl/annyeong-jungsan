# 안녕메디컬 정산앱

안녕메디컬 뷰티센터(다중 지점) 정산 시스템.
원장님이 매출/유입을 입력하고, 법인이 통합 정산을 확인합니다.

## 구조

```
법인 (메인센터)
 └─ 센터(병원) ×1 → ×5 확장 예정
      └─ 파트 ×5: 두피 / 반영구 / SMP / 패디큐어 / 피부관리
            └─ 시술 항목
```

## 정산 룰 (예시 — 운영 중 조정)

```
총매출 (현금+카드)
 − 부가세 10% (과세 매출의 10/110)
 − 카드 수수료 2.5% (카드매출 × 2.5%)
= 순매출
 ÷ 2 = 센터 50%  /  법인 50%
```

대시보드에서 룰을 실시간 조정해 결과를 즉시 확인 가능.

## 핵심 기능

| 역할 | 화면 | 비고 |
|---|---|---|
| 원장 | `/owner` — 빠른 일일 매출 입력 (파트별) | 영수증/POS 마감 직접 입력용 |
| 원장 | `/owner/patients` — 환자 목록 + 검색 | 환자번호/이름/연락처 검색 |
| 원장 | `/owner/patients/new` — 신규 환자 등록 | 차트 OCR → 모든 필드 편집 가능, 환자번호 자동발급 |
| 원장 | `/owner/patients/[id]` — 환자 상세 + 방문 이력 | |
| 원장 | `/owner/patients/[id]/visit` — 방문 차트 작성 | 매 방문마다 시술/결제/메모 입력 → 일일 매출 자동연동 |
| 원장 | `/owner/inflow` — 월별 환자 유입 | 10가지 채널 +/− 빠른 카운트 |
| 법인 | `/admin` — 통합 정산 대시보드 | 50:50 분배, 룰 실시간 조정 |

## 환자번호 체계

`C{센터순번}-{YYMM}-{4자리일련}` 예: `C1-2605-0001`
- 센터별 독립 시퀀스 (5개 센터 확장 대비)
- 월 단위 grouping → 월별 신규환자 카운트 용이
- 환자 식별자는 번호만 — 의료법 안전모드

## OCR 자동입력 (Phase 3)

**한 장 촬영 → 자동 분류 → 적절한 곳에 저장:**
- 환자 차트 → 신규 환자 등록 (방문경로 + 의료체크리스트, 환자번호 자동발급)
- 시술 영수증 → 매출 자동입력
- POS 마감표 → 일일 매출 일괄 입력
- 신뢰도 ≥ 95% → 무검토 자동저장, 미만 → "확인 필요" 표시

환자 개인정보(이름·연락처·주소)는 **OCR 추출도 정산 DB 저장도 안 함**.
원장(센터) 영역에만 별도 보관, 법인 admin은 정산 데이터만 봄.

## 단계별 로드맵

- **Phase 1** ✅ — 도메인 모델, 정산 계산, 환자/방문 차트, 전체 UI
- **Phase 1.5** ✅ — 엑셀 내보내기(3시트), PWA 매니페스트, Supabase 골격
- **Phase 2** ✅ — Auth + 데이터 레이어 (Mock↔Supabase 자동전환)
   - `/login` 페이지, `middleware.ts` (인증 보호)
   - `src/lib/data/{source,mock,supabase}.ts` — 한 인터페이스, 두 구현
   - **활성화 방법:** `cp .env.example .env.local` 후 키 채우기 → Supabase Dashboard에서 `supabase/schema.sql` 실행
   - 키 없으면 자동으로 mock 데이터 모드 (페이지는 동일하게 동작)
   - 자세히: [src/lib/supabase/README.md](src/lib/supabase/README.md)
- **Phase 3** ✅ — Claude Vision OCR (`/api/ocr`)
   - 분류 자동: 환자차트 / 영수증 / POS 마감표
   - 환자등록 화면 + 원장 홈에 카메라 연결 (`accept="image/*" capture="environment"`)
   - 신뢰도 ≥ 95% 시 자동저장, 미만은 검토 표시
   - 환자 개인정보(이름/연락처)는 추출 자체를 금지하는 system prompt
   - **활성화 방법:** `.env.local` 에 `ANTHROPIC_API_KEY=sk-ant-...` 추가
   - 키 없으면 자동 mock 응답 (1.2초 지연 + 더미 데이터)
- **Phase 4** — Vercel 배포 + PWA 정식 인증 + 매출 트렌드 누적 + 카드수수료 자동 차감

## 시각화

- 일자별 매출 추이 (막대 차트, 순수 SVG)
- 파트별 비중 (도넛 차트, 순수 SVG)
- 외부 차트 라이브러리 X — 의존성/번들 사이즈 최소화

## 개발

```bash
npm install
npm run dev          # http://localhost:3000
```

Node 20+ 필요.

## 의료법/개인정보

- 환자명/연락처는 **OCR 추출 및 DB 저장 모두 안 함**
- 차트 원본 이미지는 OCR 후 단기 보관 또는 즉시 삭제
- 모든 정산 데이터는 **금액·시술·결제수단·유입경로**만 저장

## DB 스키마

[supabase/schema.sql](supabase/schema.sql) — Phase 2에서 Supabase에 적용.

- `centers`, `profiles` — 센터 / 사용자 (역할: owner / admin)
- `services`, `products` — 시술/제품 카탈로그
- `daily_entries` + `sale_lines` / `product_sale_lines` / `product_consumptions`
- `inflow_entries` — 월별 환자 유입
- `settlement_rules` — 센터별 정산 룰 (부가세율, 카드수수료율, 분배율, 면세 파트)
- RLS: 원장은 자기 센터만, admin은 전 센터 접근

## 기반 자료 (입력 매핑)

| 엑셀 양식 | 앱 매핑 |
|---|---|
| 두피센터_월별매출정리.xlsx | `daily_entries.sale_lines` (파트=두피) + `product_sale_lines` |
| 두피센터_월별현황.xlsx | `inflow_entries` |

## 스택

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind 3 · Supabase (예정)
