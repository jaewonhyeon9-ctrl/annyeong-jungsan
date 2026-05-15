"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCurrentProfile } from "@/lib/use-current-profile";

// 루트 — 인증 상태에 따라 자동 분기
//  - 로그인 안 됨 → /login
//  - admin       → /admin
//  - owner       → /owner

export default function Home() {
  const router = useRouter();
  const { profile, loaded } = useCurrentProfile();

  useEffect(() => {
    if (!loaded) return;
    if (!profile) {
      router.replace("/login");
    } else if (profile.role === "admin") {
      router.replace("/admin");
    } else {
      router.replace("/owner");
    }
  }, [profile, loaded, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 py-12">
      <div className="text-sand-500 text-sm">
        {loaded ? "이동 중..." : "로딩 중..."}
      </div>
    </main>
  );
}
