// 현재 배포된 centers 정책 확인
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

// pg_policies 조회는 PostgREST로 직접 안되니, raw SQL 호출용 rpc 또는 SQL endpoint 사용
// Supabase는 /rest/v1/rpc/<name>으로 함수 호출 가능

// 우선 anon 키로 centers 조회 시도 + raw query 시도 (rpc 함수 정의 필요)
// 대안: pg_policies는 information_schema 권한 필요. service_role로 raw select 시도

// PostgREST는 information_schema 노출 안 함. 다른 방법: 가능한 인증 컨텍스트 직접 확인

// 1) anon으로 active=true 명시 필터
async function test1() {
  const r = await fetch(`${url}/rest/v1/centers?select=id,name,active&active=eq.true`, {
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
  });
  console.log('[anon + active=eq.true]', r.status, await r.json());
}

// 2) anon으로 모든 칼럼
async function test2() {
  const r = await fetch(`${url}/rest/v1/centers`, {
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
  });
  console.log('[anon all cols]', r.status, await r.json());
}

await test1();
await test2();
