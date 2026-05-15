# Supabase 연동 — Phase 2 가이드

## 1) Supabase 프로젝트 생성

1. https://supabase.com → New project
2. Region: **Northeast Asia (Seoul)**
3. DB password 안전한 곳에 저장

## 2) 환경 변수 설정

프로젝트 루트에서:

```bash
cp .env.example .env.local
```

`.env.local` 에 채워넣기:

- `NEXT_PUBLIC_SUPABASE_URL` — Project Settings → API → Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API → anon public

## 3) DB 스키마 적용

Supabase Dashboard → SQL Editor → 새 쿼리 → `supabase/schema.sql` 전체 붙여넣기 → Run.

테이블 + RLS 정책이 한 번에 생성됩니다.

## 4) Auth 설정

Authentication → Providers:
- **Email** 활성화 (또는 카카오 OAuth 추가)
- "Confirm email" 옵션은 운영 환경에선 켜기

원장/법인대표 계정은 admin이 직접 추가:
- Authentication → Users → Add user
- 추가 후 `profiles` 테이블에 row 생성 (role + center_id)

## 5) 클라이언트 사용

```ts
"use client";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
const { data: patients } = await supabase
  .from("patients")
  .select("*")
  .order("first_visit_date", { ascending: false });
```

서버 컴포넌트/Route Handler:
```ts
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();
```

## 6) 타입 자동생성 (선택)

```bash
npx supabase gen types typescript --project-id <your-ref> > src/lib/supabase/database.types.ts
```

## 7) RLS 확인

원장 계정으로 로그인 → 다른 센터 데이터 접근 시도 → 막혀야 함.
관리자 계정 → 모든 센터 데이터 보임. `patient_personal` 은 admin도 못 봄.
