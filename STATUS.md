# 안녕메디컬 정산 — 작업 일지

> 마지막 업데이트: **2026-05-15** · 다음 세션 핸드오프용

---

## 한 줄 상태

**Vercel 빌드 완료 + Supabase 없는 라이트 버전으로 방향 전환.** 환자 등록/방문/매출/유입은 mock data source에 저장되고, 브라우저 localStorage에 유지됨. Supabase 자동 전환은 비활성화.

---

## 작업 이력

### 2026-05-14 (Day 1) — 골격 완성
- 프로젝트 셋업, 도메인 모델, 정산 계산
- 환자/방문/유입 전체 페이지 (mock)
- OCR API + 카메라 wiring
- Auth + 미들웨어
- Supabase 데이터 레이어 골격 추가 후, 현재 운영 모드에서는 비활성화
- 엑셀 내보내기 3시트
- PWA 매니페스트
- 시각화 (BarChart, DonutChart)
- 의료법 안전모드 (개인정보 별도 테이블)

### 2026-05-15 (Day 2) — 실 wiring + UX 강화

**저장 흐름 wiring (alert → mock store 실저장):**
- `/owner/patients/new` 환자 등록 → `data.patients.create()` → 목록에 즉시 반영
- `/owner/patients/[id]/visit` 방문 차트 → `data.visits.create()` → 환자 이력에 반영
- `/owner` 빠른 매출 → `data.entries.create()`
- `/owner/inflow` 유입 → `data.inflows.upsert()` (월 재방문 시 저장값 로드)

**페이지 → 데이터 레이어 전환:**
- `/owner/patients` 목록 — `data.patients.list()` + `data.visits.listByPatient()` 합산
- `/owner/patients/[id]` 상세 — `data.patients.get()` + `data.visits.listByPatient()`
- `/admin` — `data.centers.list()` + `data.entries.byMonth()` + `data.inflows.byMonth()`
- `data.entries.byMonth()` — **visits + manual entries 자동 합산** (방문 차트 저장 시 정산에 즉시 반영)

**Admin 대시보드 강화:**
- 환자 통계 4카드 (총 / 신규 / 재방문 / 평균 객단가)
- 최근 6개월 매출 트렌드 (막대 차트)
- 정산 룰 **localStorage 영구 저장** (센터별)
- `data.centers.current()` 추가 — 로그인 시 자기 센터 자동 선택

**환자 상세에 의료 차트 카드:**
- 등록 시 입력한 모든 의료 정보 (상태/진행기간/관리경험/스트레스/통증/알레르기/제품/직업/생활습관/수면/약물/임신/메모) 표시 (값 있는 것만)

**환자 차트 전체 수정 페이지 (`/owner/patients/[id]/edit`):**
- 개인정보 + 방문경로 + 의료 체크리스트 **모든 필드** 편집 가능
- 환자 상세 우상단 ✎ 버튼으로 진입
- `data.patients.update()` — mock + Supabase 양쪽 구현 완료
- Supabase 구현: `patients` / `patient_personal` / `patient_charts` 세 테이블 동시 upsert

**기타 시술 직접 추가:**
- `/owner` 빠른 매출에서 카탈로그에 없는 시술도 입력 가능 (파트 선택 + 시술명 + 현금/카드)

**배포 가이드 (`DEPLOY.md`):**
- GitHub → Supabase → Vercel 5단계
- 시드 SQL, 새 센터/원장 추가 SQL 포함
- 비용 예상 (5센터, 월 약 22,500원)

---

## 지금 동작하는 끝-끝 흐름

```
1. /owner/patients/new
   📸 (또는 수동) → 환자번호 C1-YYMM-NNNN 자동발급 → 등록

2. /owner/patients/[id]
   환자 상세 + 방문 이력 + 의료 차트 카드 + 개인정보 카드
   ✎ → 차트 수정 페이지에서 모든 필드 수정 가능

3. /owner/patients/[id]/visit
   파트 선택 → 시술/결제 입력 → 메모 → 저장
       ↓
4. /admin
   ✅ 방금 입력한 매출이 정산에 자동 합산
   ✅ 환자 통계 카드 업데이트
   ✅ 6개월 트렌드 막대에 반영
   ✅ 정산 룰 조정은 새로고침에도 유지
       ↓
5. 📊 엑셀 다운로드 → 사장님께 전달
```

---

## 다음 세션 (Day 3) 할 일

### 사용자 액션 필요 (외부 가입)
- [ ] **GitHub repo** 생성 (private)
- [ ] **Supabase 프로젝트** 생성 + schema.sql 실행 + 초기 센터/유저 시드
- [ ] **Anthropic API 키** 발급
- [ ] **Vercel 배포** — repo 연결 + env 입력
- [ ] **`.env.local`** 채우기 (로컬 개발용)
- 자세히: [DEPLOY.md](DEPLOY.md), [src/lib/supabase/README.md](src/lib/supabase/README.md)

### 키 채운 후 검증
- [ ] 로그인 동작 (admin + owner 각각)
- [ ] RLS — 원장이 다른 센터 못 보는지
- [ ] 실 OCR — Claude Vision 추출 정확도
- [ ] 엑셀 export — 원본 양식과 비교
- [ ] 모바일 카메라 — 실제 폰에서 PWA 설치 후 촬영 동선

### 코드 디테일 (선택)
- [ ] PWA PNG 아이콘 (192/512) — 현재 SVG만
- [ ] Before/After 사진 업로드 → Supabase Storage
- [ ] OCR 결과 → 시술 매칭 실패 시 사용자가 매칭하는 모달
- [ ] Admin에 면세 파트 토글 UI (현재 코드엔 vatExemptParts 필드 있지만 화면 X)
- [ ] 카드사별 수수료 차등 (현재는 단일값)
- [ ] 정산 룰을 Supabase에도 저장 (현재 localStorage만)
- [ ] 환자 검색에 더 많은 필터 (방문 횟수, 시술 종류 등)
- [ ] 일자별 매출 추이에 visits/manual 색상 구분

---

## 알려진 이슈

1. **Windows production build EISDIR** — `next build --turbopack` 의 "Collecting page data" 단계가 styled-jsx readlink로 실패. Linux/Vercel CI에서는 정상. 로컬은 `next dev --turbopack` 로 우회.
2. **Mock 모드 데이터 휘발** — 새로고침 시 시드로 리셋. Supabase 연결로 해결.
3. **환자번호 동시발급 레이스** — Phase 2 운영 시 DB unique constraint 의존. 동시 발급 시 재시도 로직 필요할 수도.
4. **OCR Mock 응답** — `ANTHROPIC_API_KEY` 없을 때 더미 데이터 반환 (개발 편의용). 운영에선 반드시 키 필요.

---

## 빠른 재시작

```bash
cd D:\annyeong-jungsan
npm run dev
# → http://localhost:3000
```

VS Code: `code D:\annyeong-jungsan`

---

## 핵심 파일

| 무엇 | 파일 |
|---|---|
| 정산 계산 | [src/lib/settlement.ts](src/lib/settlement.ts) |
| 도메인 모델 | [src/lib/types.ts](src/lib/types.ts) |
| 환자 번호 | [src/lib/patient.ts](src/lib/patient.ts) |
| 시술 카탈로그 | [src/lib/services.ts](src/lib/services.ts) |
| 엑셀 내보내기 | [src/lib/excel.ts](src/lib/excel.ts) |
| OCR API | [src/app/api/ocr/route.ts](src/app/api/ocr/route.ts) |
| OCR 클라이언트 | [src/lib/ocr/client.ts](src/lib/ocr/client.ts) |
| 데이터 레이어 (인터페이스) | [src/lib/data/source.ts](src/lib/data/source.ts) |
| 데이터 레이어 (mock) | [src/lib/data/mock.ts](src/lib/data/mock.ts) |
| 데이터 레이어 (Supabase 초안, 비활성) | [src/lib/data/supabase.ts](src/lib/data/supabase.ts) |
| 데이터 모드 고정 | [src/lib/data/index.ts](src/lib/data/index.ts) |
| Supabase 클라이언트 | [src/lib/supabase/](src/lib/supabase/) |
| DB 스키마 | [supabase/schema.sql](supabase/schema.sql) |
| 미들웨어 | [src/middleware.ts](src/middleware.ts) |
| 환경 변수 | [.env.example](.env.example) |
| 배포 가이드 | [DEPLOY.md](DEPLOY.md) |
| Supabase 셋업 | [src/lib/supabase/README.md](src/lib/supabase/README.md) |

---

## 정산식 (확정)

```
총매출 (현금 + 카드)
 − 부가세 10%  (과세 매출 × 10/110)
 − 카드 수수료 2.5%  (카드 매출 × 0.025)
= 순매출
 × 50%  →  센터 몫
 × 50%  →  법인 몫
```

룰은 `/admin` 우측 상단 ⚙️ 에서 실시간 조정 + localStorage 영구 저장.

---

## 의료법 안전 모드 (지킬 것)

- 환자명/연락처/주소/생년월일은 OCR system prompt에서 추출 차단
- 개인정보는 별도 `patient_personal` 테이블 — 해당 센터 원장만 접근 (admin도 못 봄)
- 차트 원본 이미지는 OCR 후 단기 보관 또는 즉시 삭제 (운영 정책 결정 필요)
- 환자 식별은 환자번호(`C1-2605-0001`)로만 정산 DB에서 사용
