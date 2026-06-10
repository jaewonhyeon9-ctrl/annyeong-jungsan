// scripts/mgmt-sql.mjs — Supabase Management API로 DDL/SQL 실행
// 사용: node scripts/mgmt-sql.mjs <file.sql>

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

const arg = process.argv[2];
if (!arg) {
  console.error('사용: node scripts/mgmt-sql.mjs <file.sql>');
  process.exit(1);
}

const token = env.SUPABASE_ACCESS_TOKEN;
const ref = env.SUPABASE_PROJECT_REF;
if (!token || !ref) {
  console.error('SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF 없음.');
  process.exit(1);
}

const sql = readFileSync(arg, 'utf8');
console.log(`적용 중: ${arg}`);

const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

const text = await r.text();
console.log(`HTTP ${r.status}`);
console.log(text);

if (!r.ok) process.exit(1);
console.log('OK');
