import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { UserCreateInput, UserProfile } from "@/lib/types";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function rowToProfile(
  row: {
    id: string;
    email: string | null;
    role: UserProfile["role"];
    center_id: string | null;
    part_id: UserProfile["partId"];
    display_name: string;
    active: boolean;
    created_at: string;
    phone: string | null;
    bank_name: string | null;
    bank_account: string | null;
    bank_holder: string | null;
    business_number: string | null;
    contract_start_date: string | null;
    memo: string | null;
  }
): UserProfile {
  return {
    id: row.id,
    email: row.email ?? "",
    role: row.role,
    centerId: row.center_id,
    partId: row.part_id,
    displayName: row.display_name,
    active: row.active,
    createdAt: row.created_at,
    phone: row.phone ?? undefined,
    bankAccount:
      row.bank_name || row.bank_account
        ? {
            bank: row.bank_name ?? "",
            accountNumber: row.bank_account ?? "",
            holder: row.bank_holder ?? "",
          }
        : undefined,
    businessNumber: row.business_number ?? undefined,
    contractStartDate: row.contract_start_date ?? undefined,
    memo: row.memo ?? undefined,
  };
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnon || !serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다. Supabase Dashboard > Project Settings > API에서 service_role 키를 .env.local에 추가해주세요.",
      },
      { status: 500 }
    );
  }

  const input = (await request.json()) as Partial<UserCreateInput>;
  if (!input.email || !input.password || !input.displayName || !input.role) {
    return badRequest("이메일, 비밀번호, 이름, 역할은 필수입니다.");
  }
  if (input.role === "owner" && (!input.centerId || !input.partId)) {
    return badRequest("원장 계정은 지점과 파트가 필요합니다.");
  }
  if (input.password.length < 6) {
    return badRequest("비밀번호는 최소 6자 이상이어야 합니다.");
  }

  const isPublicSignup = input.role === "owner" && input.active === false;
  let isAdminRequest = false;

  if (!isPublicSignup) {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnon, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Route handlers do not need to mutate auth cookies here.
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      isAdminRequest = profile?.role === "admin";
    }

    if (!isAdminRequest) {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email: input.email.trim(),
      password: input.password,
      email_confirm: true,
    });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const userId = authData.user.id;
  const profileRow = {
    id: userId,
    email: input.email.trim(),
    role: input.role,
    center_id: input.centerId ?? null,
    part_id: input.partId ?? null,
    display_name: input.displayName.trim(),
    active: isAdminRequest ? input.active ?? true : false,
    phone: input.phone ?? null,
    bank_name: input.bankAccount?.bank ?? null,
    bank_account: input.bankAccount?.accountNumber ?? null,
    bank_holder: input.bankAccount?.holder ?? null,
    business_number: input.businessNumber ?? null,
    contract_start_date: input.contractStartDate ?? null,
    memo: input.memo ?? null,
  };

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .insert(profileRow)
    .select(
      "id, role, center_id, part_id, display_name, active, created_at, email, phone, bank_name, bank_account, bank_holder, business_number, contract_start_date, memo"
    )
    .single();

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json(rowToProfile(profile));
}

export async function PATCH(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnon || !serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다. Supabase Dashboard > Project Settings > API에서 service_role 키를 .env.local에 추가해주세요.",
      },
      { status: 500 }
    );
  }

  const input = (await request.json()) as {
    id?: string;
    password?: string;
  };
  if (!input.id || !input.password) {
    return badRequest("사용자 ID와 새 비밀번호가 필요합니다.");
  }
  if (input.password.length < 6) {
    return badRequest("비밀번호는 최소 6자 이상이어야 합니다.");
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Route handlers do not need to mutate auth cookies here.
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { error } = await admin.auth.admin.updateUserById(input.id, {
    password: input.password,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
