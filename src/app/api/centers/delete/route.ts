import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// 지점(센터) 강제 삭제 — admin 본인 비밀번호 재확인 후 cascade 삭제
// profiles.center_id 는 ON DELETE RESTRICT 이므로 배정된 프로필을 먼저 정리해야 함.
// 동적 라우트 [id] 대신 body 로 centerId 전달.
export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnon || !serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다. .env.local 을 확인하세요.",
      },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    centerId?: string;
    password?: string;
  };
  const centerId = body.centerId?.trim();
  const password = body.password?.trim();
  if (!centerId) {
    return NextResponse.json({ error: "지점 ID가 필요합니다." }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json(
      { error: "본인 비밀번호를 입력하세요." },
      { status: 400 }
    );
  }

  // 1) 호출자가 admin인지 확인
  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Route handler — 인증 쿠키 변경 없음
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json(
      { error: "관리자 권한이 필요합니다." },
      { status: 403 }
    );
  }

  // 2) 비밀번호 재확인 — 별도 anon 클라이언트로 sign-in 검증
  const verifier = createClient(supabaseUrl, supabaseAnon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: pwErr } = await verifier.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (pwErr) {
    return NextResponse.json(
      { error: "비밀번호가 일치하지 않습니다." },
      { status: 403 }
    );
  }

  // 3) service_role 로 강제 삭제
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 이 지점에 배정된 모든 프로필 — 호출자 본인 제외 (자기삭제 방지)
  const { data: assignedProfiles, error: profErr } = await admin
    .from("profiles")
    .select("id")
    .eq("center_id", centerId)
    .neq("id", user.id);
  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }
  const assignedIds = ((assignedProfiles ?? []) as { id: string }[]).map(
    (p) => p.id
  );

  // 순서가 중요:
  // (a) profiles.center_id 는 ON DELETE RESTRICT — 센터를 지우려면 먼저 분리해야 함.
  // (b) visits.created_by / daily_entries.created_by 는 auth.users 참조 (no cascade).
  //     이 센터의 visits/entries 는 (c) 에서 cascade 로 사라지지만, 같은 owner 가
  //     다른 센터에 남긴 활동도 있을 수 있으므로 전역으로 created_by 를 null 처리.
  // (c) 센터 삭제 → patients/visits/daily_entries/inflow_entries/
  //     settlement_rules/patient_personal/patient_charts/sale_lines/
  //     visit_sale_lines 등이 cascade 로 정리됨.
  // (d) 마지막으로 auth.users 삭제 → profiles 가 cascade 로 정리됨.

  // (a) 이 센터에 매여있던 프로필 분리 (호출자 포함 — 자기삭제는 deleteUser 단계에서만 회피)
  {
    const { error } = await admin
      .from("profiles")
      .update({ center_id: null })
      .eq("center_id", centerId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // (b) created_by 정리 — 어느 센터든 이 owner 들이 남긴 활동 흔적의 작성자 null 처리
  if (assignedIds.length > 0) {
    const { error: vErr } = await admin
      .from("visits")
      .update({ created_by: null })
      .in("created_by", assignedIds);
    if (vErr) {
      return NextResponse.json({ error: vErr.message }, { status: 500 });
    }
    const { error: dErr } = await admin
      .from("daily_entries")
      .update({ created_by: null })
      .in("created_by", assignedIds);
    if (dErr) {
      return NextResponse.json({ error: dErr.message }, { status: 500 });
    }
  }

  // (c) 센터 삭제 — 위에 나열한 테이블들이 cascade 로 정리됨
  {
    const { error } = await admin.from("centers").delete().eq("id", centerId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // (d) auth.users 삭제 → profiles 도 cascade 정리. 본인은 여기서 제외.
  for (const id of assignedIds) {
    const { error: delAuthErr } = await admin.auth.admin.deleteUser(id);
    if (delAuthErr) {
      return NextResponse.json(
        {
          error: `배정 계정 삭제 실패 (${id}): ${delAuthErr.message}`,
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
