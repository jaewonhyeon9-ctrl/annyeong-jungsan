# 안녕메디컬 정산 — Vercel 배포

기본 배포는 Supabase 없이 로컬 데이터 모드로 동작합니다.
입력한 데이터는 브라우저 `localStorage`에 저장되므로 같은 브라우저에서는 새로고침 후에도 유지됩니다.

## 배포

1. GitHub에 프로젝트를 push합니다.
2. Vercel에서 해당 repo를 Import합니다.
3. Framework Preset은 `Next.js`로 둡니다.
4. Build Command는 기본값 `npm run build`를 사용합니다.
5. localStorage 모드라면 Environment Variables는 비워도 됩니다.

## Supabase 연결

Supabase를 운영 DB로 사용할 때만 Vercel Environment Variables에 아래 값을 추가합니다.

```bash
NEXT_PUBLIC_DATA_SOURCE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

배포 전에 Supabase Dashboard SQL Editor에서 `supabase/schema.sql`을 실행하세요.

## OCR

OCR을 실제 Claude Vision으로 쓰려면 Vercel Environment Variables에 추가합니다.

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

키가 없으면 OCR API는 mock 데이터를 반환합니다.

## 주의

- `NEXT_PUBLIC_DATA_SOURCE=supabase` 없이는 Supabase 환경변수가 있어도 mock/localStorage 모드로 동작합니다.
- 데이터는 사용자 브라우저에 저장됩니다. 다른 기기/브라우저와 자동 동기화되지 않습니다.
- 브라우저 캐시/사이트 데이터 삭제 시 입력 데이터도 삭제됩니다.
