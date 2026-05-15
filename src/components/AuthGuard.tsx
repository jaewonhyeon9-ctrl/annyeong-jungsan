"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCurrentProfile } from "@/lib/use-current-profile";
import type { UserRole } from "@/lib/types";

// 권한 게이트 — 로그인/역할 체크 후 자식 렌더링
// 비로그인 → /login, 역할 불일치 → /

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

  return <>{children}</>;
}
