# 안녕메디컬 정산앱

안녕메디컬 뷰티센터 정산 시스템입니다. 현재 버전은 Supabase 없이 동작하는 라이트 버전이며, 입력 데이터는 브라우저 `localStorage`에 저장됩니다.

## 핵심 기능

| 역할 | 화면 | 비고 |
|---|---|---|
| 원장 | `/owner` | 일일 매출 입력, 영수증/POS OCR |
| 원장 | `/owner/patients` | 환자 목록 + 검색 |
| 원장 | `/owner/patients/new` | 신규 환자 등록, 차트 OCR |
| 원장 | `/owner/patients/[id]` | 환자 상세 + 방문 이력 |
| 원장 | `/owner/inflow` | 월별 환자 유입 카운트 |
| 법인 | `/admin` | 통합 정산 대시보드 |

## 데이터 모드

- 기본 데이터는 mock seed로 시작합니다.
- 사용자가 입력/수정한 데이터는 같은 브라우저의 `localStorage`에 유지됩니다.
- 브라우저 사이트 데이터를 삭제하면 입력 데이터도 삭제됩니다.
- 현재 버전은 Supabase 환경변수가 있어도 Supabase로 자동 전환하지 않습니다.

## OCR

`ANTHROPIC_API_KEY`가 없으면 OCR API는 데모용 mock 응답을 반환합니다.
실제 OCR을 쓰려면 `.env.local` 또는 Vercel 환경 변수에 키를 추가합니다.

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

## 개발

```bash
npm install
npm run dev
```

## 배포

Vercel에서 `npm run build`로 배포합니다. 자세한 내용은 [DEPLOY.md](DEPLOY.md)를 참고하세요.

## 스택

Next.js 15 · React 19 · TypeScript · Tailwind CSS · localStorage mock data
