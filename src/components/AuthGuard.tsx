"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getDataSource } from "@/lib/data";
import { useCurrentProfile } from "@/lib/use-current-profile";
import type { UserRole } from "@/lib/types";

// 권한 게이트 — 로그인/역할/승인 체크 후 자식 렌더링
// 비로그인 → /login, 역할 불일치 → /, 승인 대기 → 대기 화면

export function AuthGuard({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { profile, loaded } = useCurrentProfile();

  useEffect(() => {
    if (!loaded) return;
    if (!profile) {
      router.replace("/login");
    } else if (profile.role !== role) {
      router.replace("/");
    }
  }, [profile, loaded, role, router]);

  if (!loaded || !profile || profile.role !== role) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 py-12">
        <div className="text-sand-500 text-sm">권한 확인 중...</div>
      </main>
    );
  }

  // 원장 사용자가 active=false 면 승인 대기 화면
  if (profile.role === "owner" && !profile.active) {
    return <PendingApprovalScreen email={profile.email} />;
  }

  return <>{children}</>;
}

function PendingApprovalScreen({ email }: { email: string }) {
  const router = useRouter();

  async function handleLogout() {
    const data = await getDataSource();
    await data.me.logout();
    router.replace("/login");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="text-5xl">⏳</div>
      <div>
        <h1 className="text-xl font-bold text-sand-900">승인 대기 중</h1>
        <p className="mt-2 text-sm text-sand-600">
          가입 신청이 접수되었습니다.
          <br />
          법인 관리자 승인 후 사용 가능합니다.
        </p>
        <p className="mt-3 text-xs text-sand-500">{email}</p>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className="rounded-xl border border-sand-300 px-5 py-2.5 text-sm text-sand-700 hover:border-sand-400"
      >
        로그아웃
      </button>
    </main>
  );
}
