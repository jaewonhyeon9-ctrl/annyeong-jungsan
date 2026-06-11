// detect-db-host.mjs — Supabase 풀러 호스트 자동 탐지
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dns from 'node:dns/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  })
);

const ref = 'vyajimoneianmnevwcfo';
const password = env.SUPABASE_DB_PASSWORD;

const regions = [
  'ap-northeast-2', // Seoul
  'ap-northeast-1', // Tokyo
  'ap-southeast-1', // Singapore
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'eu-west-1',
  'eu-central-1',
];

const candidates = [];
// 새로운 pooler 포맷 시도 (region 명시 없이 자동 라우팅)
for (const r of regions) {
  candidates.push({ host: `aws-1-${r}.pooler.supabase.com`, port: 6543, user: `postgres.${ref}` });
  candidates.push({ host: `aws-1-${r}.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` });
}
// 신규: pooler 도메인 자체가 다를 수 있음
candidates.push({ host: `${ref}.pooler.supabase.com`, port: 6543, user: 'postgres' });
candidates.push({ host: `${ref}.supabase.co`, port: 5432, user: 'postgres' });
candidates.push({ host: `${ref}.db.supabase.co`, port: 5432, user: 'postgres' });

for (const c of candidates) {
  try {
    await dns.lookup(c.host);
  } catch (e) {
    continue;
  }
  // DNS 통과 — 실제 연결 시도
  const client = new pg.Client({
    host: c.host,
    port: c.port,
    user: c.user,
    password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    await client.query('select 1');
    console.log(`\n✅ 연결 성공!`);
    console.log(`  host: ${c.host}`);
    console.log(`  port: ${c.port}`);
    console.log(`  user: ${c.user}`);
    await client.end();
    process.exit(0);
  } catch (e) {
    console.log(`× ${c.host}:${c.port} (${c.user}) - ${e.message.slice(0, 60)}`);
    try { await client.end(); } catch {}
  }
}
console.log('\n전부 실패. 페이지 직접 확인 필요.');
process.exit(1);
