"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getDataSource } from "@/lib/data";
import { useCurrentProfile } from "@/lib/use-current-profile";

// 사용자 표시 + 로그아웃 메뉴 (헤더 우측)

export function UserMenu() {
  const router = useRouter();
  const { profile, loaded } = useCurrentProfile();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  if (!loaded || !profile) return <div className="w-4" />;

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const data = await getDataSource();
      await data.me.logout();
      router.replace("/login");
    } finally {
      setLoggingOut(false);
      setOpen(false);
    }
  }

  async function handleChangePassword() {
    const pwd = prompt("새 비밀번호를 입력하세요 (6자 이상):");
    if (!pwd) return;
    if (pwd.length < 6) {
      alert("비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }
    const confirm = prompt("확인을 위해 한 번 더 입력하세요:");
    if (pwd !== confirm) {
      alert("두 번 입력이 일치하지 않습니다.");
      return;
    }
    try {
      const data = await getDataSource();
      await data.me.changePassword(pwd);
      alert("비밀번호가 변경되었습니다.");
      setOpen(false);
    } catch (err) {
      alert(`변경 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-full bg-sand-100 px-3 py-1.5 text-xs font-medium text-sand-700 hover:bg-sand-200"
      >
        <span className="max-w-[6rem] truncate">{profile.displayName}</span>
        <span className="text-sand-500">▾</span>
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-xl border border-sand-200 bg-white shadow-lg">
            <div className="border-b border-sand-100 px-4 py-2.5 text-xs">
              <div className="font-semibold text-sand-800">
                {profile.displayName}
              </div>
              <div className="truncate text-sand-500">{profile.email}</div>
              <div className="mt-1 text-[10px] text-sand-500">
                {profile.role === "admin" ? "법인 관리자" : "원장"}
              </div>
            </div>
            {profile.role === "owner" && (
              <Link
                href="/owner/profile"
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-xs text-sand-700 hover:bg-sand-50"
              >
                내 정보 수정
              </Link>
            )}
            <button
              type="button"
              onClick={handleChangePassword}
              className="block w-full px-4 py-2 text-left text-xs text-sand-700 hover:bg-sand-50"
            >
              비밀번호 변경
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="block w-full px-4 py-2 text-left text-xs text-clay-600 hover:bg-clay-500/5 disabled:opacity-60"
            >
              {loggingOut ? "로그아웃 중..." : "로그아웃"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
