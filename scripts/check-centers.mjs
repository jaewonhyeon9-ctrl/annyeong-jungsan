// check-centers.mjs — anon vs service_role 결과 비교
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

async function query(key, label) {
  const r = await fetch(`${url}/rest/v1/centers?select=id,name,active,enabled_parts`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const data = await r.json();
  console.log(`\n[${label}] (HTTP ${r.status}):`);
  console.log(JSON.stringify(data, null, 2));
}

await query(env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'anon');
await query(env.SUPABASE_SERVICE_ROLE_KEY, 'service_role');
