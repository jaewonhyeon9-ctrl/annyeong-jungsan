# 안녕메디컬 정산 — 배포 가이드

> Vercel + Supabase 기준. 무료 티어로 시작 가능.

---

## 사전 준비

- [ ] GitHub 계정
- [ ] Vercel 계정 (https://vercel.com — GitHub 로그인 가능)
- [ ] Supabase 계정 (https://supabase.com — GitHub 로그인 가능)
- [ ] Anthropic API 키 (https://console.anthropic.com) — OCR 사용 시
- [ ] 결제 카드 (Anthropic 사용량은 OCR 1건당 ~5원, Supabase/Vercel 무료티어 충분)

---

## Phase A — GitHub 푸시

```bash
cd D:\annyeong-jungsan

# 첫 푸시 (이미 git init 돼있음)
git add -A
git commit -m "Initial commit — 안녕메디컬 정산 Phase 1~3"

# GitHub에서 새 private repo 만들고 (예: annyeong-jungsan), 그 URL 사용
git remote add origin https://github.com/<USERNAME>/annyeong-jungsan.git
git push -u origin main
```

> Private repo로 만들어야 합니다 — 의료 도메인이라 비공개.

---

## Phase B — Supabase 셋업

### 1) 프로젝트 생성

1. https://supabase.com → New project
2. Region: **Northeast Asia (Seoul)**
3. Database password 안전한 곳에 저장

### 2) DB 스키마 적용

1. Dashboard → SQL Editor → 새 쿼리
2. `supabase/schema.sql` 전체 복사 → 붙여넣기 → **Run**
3. Table editor에서 다음 테이블 생성 확인:
   - `centers`, `profiles`, `patients`, `patient_personal`, `patient_charts`
   - `visits`, `visit_sale_lines`, `daily_entries`, `sale_lines`, `inflow_entries`
   - `settlement_rules`, `services`, `products`

### 3) Auth 설정

1. Authentication → Providers → **Email** 활성화
2. 운영 환경에서는 "Confirm email" 켜기 권장

### 4) 시드 데이터 (초기 센터 1개)

```sql
insert into public.centers (id, name, owner_name)
values (gen_random_uuid(), '안녕메디컬 본점', '원장 OOO');
```

해당 센터 ID 메모.

### 5) 첫 사용자 등록

Authentication → Users → Add user (이메일/비번)
→ SQL Editor 에서 profile 추가:

```sql
insert into public.profiles (id, role, center_id, display_name)
values (
  '<auth.users 에 생성된 UUID>',
  'admin',  -- 또는 'owner'
  '<위에서 만든 센터 UUID>',
  '관리자'
);
```

### 6) API 키 확인

Project Settings → API:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Phase C — Vercel 배포

### 1) Import GitHub repo

1. https://vercel.com → Add new... → Project
2. GitHub repo 선택 (`annyeong-jungsan`)
3. Framework Preset: **Next.js** (자동 감지)
4. Root Directory: `.` (기본)

### 2) 환경 변수 입력

**Environment Variables** 섹션에서 추가:

```
NEXT_PUBLIC_SUPABASE_URL = https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGci...
ANTHROPIC_API_KEY = sk-ant-...
```

→ Apply to: **Production, Preview, Development** 모두 체크.

### 3) Deploy

**Deploy** 클릭 → 첫 빌드 ~3분.

> Linux CI에서 빌드하므로 Windows EISDIR 이슈 없음.

배포 URL은 `https://annyeong-jungsan-<hash>.vercel.app` 형태로 나옵니다.

### 4) 커스텀 도메인 (선택)

Project Settings → Domains → 본인 소유 도메인 연결.

---

## Phase D — 운영 점검

### 1) 로그인 동작 확인

배포된 URL → `/login` → 위에서 만든 admin 계정으로 로그인.

### 2) Auth 미들웨어 동작

`/owner` 또는 `/admin` 접근 시 로그인되지 않으면 `/login`으로 리다이렉트.

### 3) RLS 검증

원장 계정으로 다른 센터의 환자 조회 시도 → 비어있어야 정상.

### 4) OCR 동작

`/owner/patients/new` → 📸 → 환자차트 사진 업로드 → 자동 채워짐.

### 5) 엑셀 다운로드

`/admin` → 📊 → 정산 엑셀 파일 생성.

---

## Phase E — 운영 중 관리

### 새 센터 추가 (5개로 확장 시)

```sql
insert into public.centers (id, name, owner_name)
values (gen_random_uuid(), '안녕메디컬 강남점', '원장 OOO');

-- 정산 룰 (선택 — 안 넣으면 DEFAULT_RULE 적용)
insert into public.settlement_rules (center_id, vat_rate, card_fee_rate, center_share_pct, corp_share_pct)
values ('<센터 id>', 0.100, 0.025, 0.500, 0.500);
```

### 새 원장 추가

1. Authentication → Users → Add user (이메일 + 비번)
2. SQL:
   ```sql
   insert into public.profiles (id, role, center_id, display_name)
   values ('<auth user id>', 'owner', '<센터 id>', '원장 이름');
   ```
3. 비번 알려주거나 매직링크 사용.

### 모니터링

- Supabase Dashboard → Logs → API 호출 추적
- Vercel Dashboard → Analytics
- Anthropic Console → API 사용량/비용

---

## 비용 예상 (월 운영)

| 서비스 | 무료 한도 | 예상 사용 (5센터, 일 평균 환자 30명) | 월 추정 |
|---|---|---|---|
| Vercel Hobby | 100GB 대역폭 | 충분 | 0원 |
| Supabase Free | 500MB DB, 1GB 스토리지 | 충분 | 0원 |
| Claude Haiku 4.5 OCR | — | 30 × 30 × 5 = 4,500건 × ~5원 | 약 22,500원 |
| **합계** | | | **약 22,500원** |

---

## 문제 발생 시

- **빌드 실패** → Vercel build logs 확인. 대부분 env 변수 누락.
- **로그인 안 됨** → Supabase Auth → Users 확인. `profiles` row 존재 여부 확인.
- **RLS 차단** → SQL Editor 에서 직접 쿼리 시도하면 권한 문제 디버깅 가능.
- **OCR 실패** → Anthropic Console 에서 사용량/한도 확인. API 키 valid 여부.
