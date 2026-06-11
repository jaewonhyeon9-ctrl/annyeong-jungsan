// E2E 시나리오: 새 원장 가입 → 관리자 승인 → 정리
// 실행: node scripts/e2e-signup-approval.mjs
// 환경: D:\annyeong-jungsan\.env.local 의 service_role 사용

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// .env.local 직접 파싱 (next 환경 없이 실행)
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
const PRODUCTION_URL = "https://annyeong-jungsan.vercel.app";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ts = Date.now();
const TEST_EMAIL = `e2e-test-${ts}@example.com`;
const TEST_PASSWORD = "e2e-test-pwd-1234";
const TEST_NAME = "E2E테스트원장";
const TEST_PHONE = "010-0000-0000";

function log(step, label, data) {
  console.log(`\n[${step}] ${label}`);
  if (data !== undefined) console.log("    ", data);
}

let createdUserId = null;

try {
  // --- 1) production 가입 API 호출 (실제 /signup 폼이 거치는 흐름과 동일) ---
  log(1, "production /api/users POST — 새 원장 가입 (공개 가입, active=false)");
  const signupResp = await fetch(`${PRODUCTION_URL}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      displayName: TEST_NAME,
      role: "owner",
      centerId: null,
      partId: null,
      phone: TEST_PHONE,
      active: false,
    }),
  });
  const signupBody = await signupResp.json();
  if (!signupResp.ok) {
    throw new Error(
      `가입 API 실패 (${signupResp.status}): ${signupBody.error ?? JSON.stringify(signupBody)}`
    );
  }
  createdUserId = signupBody.id;
  log("✓", "가입 응답", {
    id: signupBody.id,
    email: signupBody.email,
    displayName: signupBody.displayName,
    role: signupBody.role,
    active: signupBody.active,
    centerId: signupBody.centerId,
    partId: signupBody.partId,
  });
  if (signupBody.active !== false) {
    throw new Error(`가입 직후 active=${signupBody.active} (false 기대)`);
  }

  // --- 2) DB에서 가입 대기 상태 확인 ---
  log(2, "DB에서 가입 대기 원장 조회 (admin이 /admin/users에서 보는 모습)");
  const { data: pendingRow, error: pendingErr } = await admin
    .from("profiles")
    .select("id, email, display_name, role, active, center_id, part_id")
    .eq("id", createdUserId)
    .single();
  if (pendingErr) throw pendingErr;
  log("✓", "DB 상태", pendingRow);

  // --- 3) 활성 센터 + 첫 enabled part 선택 ---
  log(3, "승인 대상 지점·파트 선택");
  const { data: centers, error: centersErr } = await admin
    .from("centers")
    .select("id, name, enabled_parts")
    .eq("active", true)
    .order("created_at", { ascending: true });
  if (centersErr) throw centersErr;
  if (!centers || centers.length === 0) {
    throw new Error("활성 지점 없음 — 먼저 지점을 등록해야 합니다.");
  }
  const targetCenter = centers[0];
  const targetPart = targetCenter.enabled_parts?.[0];
  if (!targetPart) {
    throw new Error(
      `지점 "${targetCenter.name}" 에 enabled_parts가 비어 있음. 지점 설정 필요.`
    );
  }
  log("✓", "선택", { center: targetCenter.name, part: targetPart });

  // --- 4) admin이 모달에서 누른 것과 동일한 패치 ---
  log(4, "승인 패치 (active=true + center_id + part_id 한 번에)");
  const { data: approved, error: approveErr } = await admin
    .from("profiles")
    .update({
      active: true,
      center_id: targetCenter.id,
      part_id: targetPart,
    })
    .eq("id", createdUserId)
    .select("id, email, display_name, role, active, center_id, part_id")
    .single();
  if (approveErr) throw approveErr;
  log("✓", "승인 후 상태", approved);
  if (approved.active !== true) {
    throw new Error(`승인 후 active=${approved.active} (true 기대)`);
  }
  if (!approved.center_id || !approved.part_id) {
    throw new Error("승인 후 center_id/part_id가 비어 있음");
  }

  // --- 5) 가짜 원장 자격으로 로그인 시도 (active=true로 통과해야 함) ---
  log(5, "원장 자격으로 로그인 시도 (anon key + 이메일/비번)");
  const anon = createClient(SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signInData, error: signInErr } = await anon.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (signInErr) throw new Error(`로그인 실패: ${signInErr.message}`);
  log("✓", "로그인 성공", {
    userId: signInData.user?.id,
    email: signInData.user?.email,
    session: !!signInData.session,
  });

  console.log("\n=========================================");
  console.log("✅ E2E 통과 — 가입 → 승인 → 로그인 전 흐름 정상");
  console.log("=========================================");
} catch (err) {
  console.error("\n❌ E2E 실패:", err.message || err);
  process.exitCode = 1;
} finally {
  // --- 6) 정리: 가짜 계정 삭제 (profiles는 cascade) ---
  if (createdUserId) {
    log(6, "정리 — 테스트 계정 삭제 (auth.users → profiles cascade)");
    const { error: delErr } = await admin.auth.admin.deleteUser(createdUserId);
    if (delErr) {
      console.error("    삭제 실패:", delErr.message);
    } else {
      console.log("    ✓ 테스트 계정 완전 삭제");
    }
  }
}
