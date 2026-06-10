// scripts/seed-admin.mjs
// admin user + profile 생성. Supabase Admin SDK 사용.
// 사용: node scripts/seed-admin.mjs

import { createClient } from '@supabase/supabase-js';
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

const ADMIN_EMAIL = 'capetern@kakao.com';
const ADMIN_PASSWORD = 'wodnjs12^^';
const ADMIN_NAME = '법인 관리자';

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 1) 기존 사용자 확인
const { data: users, error: listErr } = await sb.auth.admin.listUsers();
if (listErr) { console.error('listUsers 실패:', listErr); process.exit(1); }
const existing = users.users.find((u) => u.email === ADMIN_EMAIL);

let userId;
if (existing) {
  userId = existing.id;
  console.log(`admin user 이미 존재: ${userId}`);
} else {
  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: ADMIN_NAME },
  });
  if (createErr) { console.error('createUser 실패:', createErr); process.exit(1); }
  userId = created.user.id;
  console.log(`admin user 생성: ${userId}`);
}

// 2) profiles upsert (admin 권한)
const { data: prof, error: profErr } = await sb
  .from('profiles')
  .upsert({
    id: userId,
    email: ADMIN_EMAIL,
    role: 'admin',
    center_id: null,
    part_id: null,
    display_name: ADMIN_NAME,
    active: true,
  })
  .select()
  .single();
if (profErr) { console.error('profile upsert 실패:', profErr); process.exit(1); }
console.log('profile upsert 완료:', { id: prof.id, role: prof.role, name: prof.display_name });

console.log('\n시드 완료');
console.log(`  email: ${ADMIN_EMAIL}`);
console.log(`  로그인 가능: ${env.NEXT_PUBLIC_SUPABASE_URL.replace('vyajimoneianmnevwcfo.supabase.co', '안녕정산-앱-URL')}/login`);
