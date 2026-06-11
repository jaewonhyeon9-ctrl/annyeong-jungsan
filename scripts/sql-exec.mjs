// scripts/sql-exec.mjs
// Postgres 직접 연결로 DDL/SQL 실행.
// 사용: node scripts/sql-exec.mjs <file.sql>
//   또는: cat foo.sql | node scripts/sql-exec.mjs -

import pg from 'pg';
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
  console.error('사용: node scripts/sql-exec.mjs <file.sql>');
  process.exit(1);
}

let sql;
if (arg === '-') {
  sql = readFileSync(0, 'utf8');
} else {
  sql = readFileSync(arg, 'utf8');
}

import dns from 'node:dns';
const family = Number(env.SUPABASE_DB_FAMILY || 0) || 0;

const client = new pg.Client({
  host: env.SUPABASE_DB_HOST,
  port: Number(env.SUPABASE_DB_PORT || 5432),
  user: env.SUPABASE_DB_USER || 'postgres',
  password: env.SUPABASE_DB_PASSWORD,
  database: env.SUPABASE_DB_NAME || 'postgres',
  ssl: { rejectUnauthorized: false },
  // IPv6 강제
  ...(family === 6 ? {
    lookup: (hostname, opts, cb) => dns.lookup(hostname, { family: 6 }, cb),
  } : {}),
});

await client.connect();
console.log('연결됨:', env.SUPABASE_DB_HOST);

try {
  const result = await client.query(sql);
  if (Array.isArray(result)) {
    result.forEach((r, i) => console.log(`[${i}] command=${r.command} rows=${r.rowCount ?? '-'}`));
  } else {
    console.log(`command=${result.command} rows=${result.rowCount ?? '-'}`);
    if (result.rows?.length) console.log(result.rows);
  }
  console.log('OK');
} catch (e) {
  console.error('ERR:', e.message);
  process.exit(1);
} finally {
  await client.end();
}
