// scripts/seed-default-center.mjs
// 안녕메디컬 본점 1개를 Supabase centers 테이블에 시드 INSERT.
// 사용: node scripts/seed-default-center.mjs

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 없음');
  process.exit(1);
}

const existing = await fetch(`${url}/rest/v1/centers?select=id,name`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
}).then((r) => r.json());

if (Array.isArray(existing) && existing.length > 0) {
  console.log(`이미 ${existing.length}개 지점 존재. 시드 스킵.`);
  console.log(existing);
  process.exit(0);
}

const res = await fetch(`${url}/rest/v1/centers`, {
  method: 'POST',
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
  body: JSON.stringify({
    name: '안녕메디컬 본점',
    enabled_parts: ['scalp', 'permanent_makeup', 'smp', 'pedicure', 'skincare'],
    address: '서울 강남구',
    phone: '02-0000-0000',
    owner_name: '원장',
  }),
});
const body = await res.json();
if (!res.ok) {
  console.error('INSERT 실패:', res.status, body);
  process.exit(1);
}
console.log('지점 INSERT 완료:');
console.log(body);
