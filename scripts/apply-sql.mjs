// scripts/apply-sql.mjs
// Supabase에 DDL/SQL을 적용하기 위한 다양한 경로 시도.
// 1) /pg-meta API (관리 콘솔 내부 — 보통 외부 차단)
// 2) /api/v1/projects/<ref>/database/query (Management API — PAT 필요)
// 3) RPC sql_exec (사전 정의된 RPC 필요)
//
// 결론: service_role로 DDL은 PostgREST 표준 경로로 불가. SQL Editor 사용 권장.
// 다만, /platform/pg-meta 같은 내부 엔드포인트는 일부 케이스에서 작동.

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

const SQL = `
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = public.current_role()
    and active = public.current_profile_active()
  );
`;

// 시도 1: pg-meta query 엔드포인트 (실패 가능성 높음)
const r1 = await fetch(`${url}/pg-meta/default/query`, {
  method: 'POST',
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: SQL }),
}).catch((e) => ({ ok: false, status: 'ERR', json: () => e.message }));

console.log('[pg-meta query]', r1.status, await (r1.text ? r1.text() : Promise.resolve('-')));

// 시도 2: 일반적 SQL exec RPC (사전 정의 필요)
const r2 = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ sql: SQL }),
}).catch((e) => ({ status: 'ERR', text: () => e.message }));

console.log('[rpc/exec_sql]', r2.status, await (r2.text ? r2.text() : Promise.resolve('-')));

console.log('\n둘 다 실패하면 SQL Editor 사용 필요.');
