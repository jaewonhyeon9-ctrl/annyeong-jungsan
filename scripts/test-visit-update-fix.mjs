// 방문 차트 편집 시 메모/사진 비우기 로직 검증
// Codex 리뷰 P2 fix 가 의도대로 동작하는지 확인.

console.log("=== 방문 차트 편집 클리어 로직 검증 ===\n");

// ─────────────────────────────────────────────
// 1. 페이지에서 visits.update 호출 시 보내는 값 시뮬레이션
// ─────────────────────────────────────────────

function buildEditPatch(memo, beforePhoto, afterPhoto) {
  // src/app/owner/patients/[id]/visit/page.tsx 의 수정된 로직과 동일
  return {
    visitDate: "2026-05-20",
    partId: "scalp",
    sales: [],
    visitMemo: memo.trim() ? memo : null,
    beforePhotoUrl: beforePhoto,
    afterPhotoUrl: afterPhoto,
  };
}

// ─────────────────────────────────────────────
// 2. mock.ts visits.update 핵심 로직 시뮬레이션
// ─────────────────────────────────────────────

function mockUpdate(current, patch) {
  return {
    ...current,
    visitDate: patch.visitDate ?? current.visitDate,
    partId: patch.partId ?? current.partId,
    sales: patch.sales ?? current.sales,
    visitMemo:
      patch.visitMemo !== undefined
        ? (patch.visitMemo ?? undefined)
        : current.visitMemo,
    beforePhotoUrl:
      patch.beforePhotoUrl !== undefined
        ? (patch.beforePhotoUrl ?? undefined)
        : current.beforePhotoUrl,
    afterPhotoUrl:
      patch.afterPhotoUrl !== undefined
        ? (patch.afterPhotoUrl ?? undefined)
        : current.afterPhotoUrl,
  };
}

// ─────────────────────────────────────────────
// 3. supabase.ts visits.update payload 빌더 시뮬레이션
// ─────────────────────────────────────────────

function supabaseUpdatePayload(patch) {
  const update = {};
  if (patch.visitDate !== undefined) update.visit_date = patch.visitDate;
  if (patch.partId !== undefined) update.part_id = patch.partId;
  if (patch.visitMemo !== undefined) update.visit_memo = patch.visitMemo ?? null;
  if (patch.beforePhotoUrl !== undefined)
    update.before_photo_url = patch.beforePhotoUrl ?? null;
  if (patch.afterPhotoUrl !== undefined)
    update.after_photo_url = patch.afterPhotoUrl ?? null;
  return update;
}

// ─────────────────────────────────────────────
// 4. 시나리오들
// ─────────────────────────────────────────────

const existingVisit = {
  id: "v-1",
  visitDate: "2026-05-19",
  partId: "scalp",
  sales: [],
  visitMemo: "기존 메모",
  beforePhotoUrl: "https://example.com/before.jpg",
  afterPhotoUrl: "https://example.com/after.jpg",
};

const scenarios = [
  {
    name: "메모 비우기 (사진 그대로)",
    inputs: { memo: "", beforePhoto: existingVisit.beforePhotoUrl, afterPhoto: existingVisit.afterPhotoUrl },
    expectedMemo: undefined,
    expectedSupabaseMemo: null,
  },
  {
    name: "Before 사진 제거 (메모 유지)",
    inputs: { memo: existingVisit.visitMemo, beforePhoto: null, afterPhoto: existingVisit.afterPhotoUrl },
    expectedBefore: undefined,
    expectedSupabaseBefore: null,
  },
  {
    name: "전부 클리어",
    inputs: { memo: "", beforePhoto: null, afterPhoto: null },
    expectedAll: undefined,
    expectedSupabaseAll: null,
  },
  {
    name: "공백만 입력된 메모 (clear 로 간주)",
    inputs: { memo: "   ", beforePhoto: existingVisit.beforePhotoUrl, afterPhoto: existingVisit.afterPhotoUrl },
    expectedMemo: undefined,
    expectedSupabaseMemo: null,
  },
  {
    name: "메모 수정 (실제 값 유지)",
    inputs: { memo: "새 메모", beforePhoto: existingVisit.beforePhotoUrl, afterPhoto: existingVisit.afterPhotoUrl },
    expectedMemo: "새 메모",
    expectedSupabaseMemo: "새 메모",
  },
];

let pass = 0, fail = 0;

for (const s of scenarios) {
  const patch = buildEditPatch(s.inputs.memo, s.inputs.beforePhoto, s.inputs.afterPhoto);
  const mockResult = mockUpdate(existingVisit, patch);
  const supabasePayload = supabaseUpdatePayload(patch);

  console.log(`▶ ${s.name}`);
  console.log(`  patch        : visitMemo=${JSON.stringify(patch.visitMemo)}, before=${JSON.stringify(patch.beforePhotoUrl)}, after=${JSON.stringify(patch.afterPhotoUrl)}`);
  console.log(`  mock 결과    : memo=${JSON.stringify(mockResult.visitMemo)}, before=${JSON.stringify(mockResult.beforePhotoUrl)}, after=${JSON.stringify(mockResult.afterPhotoUrl)}`);
  console.log(`  supabase     : ${JSON.stringify(supabasePayload)}`);

  // 검증
  let ok = true;
  if ("expectedMemo" in s && mockResult.visitMemo !== s.expectedMemo) { ok = false; console.log(`  ❌ mock memo expected ${JSON.stringify(s.expectedMemo)} got ${JSON.stringify(mockResult.visitMemo)}`); }
  if ("expectedBefore" in s && mockResult.beforePhotoUrl !== s.expectedBefore) { ok = false; console.log(`  ❌ mock before expected ${JSON.stringify(s.expectedBefore)} got ${JSON.stringify(mockResult.beforePhotoUrl)}`); }
  if ("expectedAll" in s) {
    if (mockResult.visitMemo !== s.expectedAll || mockResult.beforePhotoUrl !== s.expectedAll || mockResult.afterPhotoUrl !== s.expectedAll) {
      ok = false; console.log(`  ❌ mock 전부 클리어 실패`);
    }
  }
  if ("expectedSupabaseMemo" in s && supabasePayload.visit_memo !== s.expectedSupabaseMemo) { ok = false; console.log(`  ❌ supabase memo expected ${JSON.stringify(s.expectedSupabaseMemo)} got ${JSON.stringify(supabasePayload.visit_memo)}`); }
  if ("expectedSupabaseBefore" in s && supabasePayload.before_photo_url !== s.expectedSupabaseBefore) { ok = false; console.log(`  ❌ supabase before expected ${JSON.stringify(s.expectedSupabaseBefore)} got ${JSON.stringify(supabasePayload.before_photo_url)}`); }
  if ("expectedSupabaseAll" in s) {
    if (supabasePayload.visit_memo !== s.expectedSupabaseAll || supabasePayload.before_photo_url !== s.expectedSupabaseAll || supabasePayload.after_photo_url !== s.expectedSupabaseAll) {
      ok = false; console.log(`  ❌ supabase 전부 클리어 payload 실패`);
    }
  }

  if (ok) { console.log(`  ✅ PASS\n`); pass++ } else { console.log(`  ❌ FAIL\n`); fail++ }
}

console.log(`=== 결과: ${pass} 통과 / ${fail} 실패 ===`);
process.exit(fail > 0 ? 1 : 0);
