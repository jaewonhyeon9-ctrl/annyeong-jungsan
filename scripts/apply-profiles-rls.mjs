// scripts/apply-profiles-rls.mjs
// profiles_self_update RLS 정책 추가. Supabase RPC 통한 SQL 실행.

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

const sql = `
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = public.current_role()
    and active = public.current_profile_active()
  );
`;

// Supabase는 기본적으로 raw SQL endpoint를 노출하지 않음.
// 대신 pg-meta 또는 자체 RPC 필요.
// 여기서는 사용자에게 SQL Editor에서 실행하라는 안내만.
console.log('아래 SQL을 Supabase SQL Editor에서 실행하세요:\n');
console.log(sql);
console.log('\n(자동 실행은 service_role로도 DDL 권한 없음 — RPC 함수 정의 필요)');
