"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { getDataSource, isSupabaseActive } from "@/lib/data";
import type { UserProfile } from "@/lib/types";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center justify-center">
      <div className="text-sm text-sand-500">로딩 중...</div>
    </main>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Mock 사용자 선택 (Supabase 미설정 시 데모용)
  const [mockUsers, setMockUsers] = useState<UserProfile[]>([]);
  useEffect(() => {
    if (isSupabaseActive) return;
    (async () => {
      const data = await getDataSource();
      const users = await data.users.list();
      setMockUsers(users);
    })();
  }, []);

  async function loginAsMock(user: UserProfile) {
    const data = await getDataSource();
    data.me.setMock(user);
    router.push(redirect);
  }

  async function handleEmailPassword() {
    const normalizedEmail = email.trim();
    if (!isSupabaseActive) {
      // 데모 모드 — 이메일로 mock 사용자 찾기
      const found = mockUsers.find(
        (u) => u.email.toLowerCase() === normalizedEmail.toLowerCase()
      );
      if (!found) {
        setError(
          "데모 모드: 이메일이 mock 사용자와 일치하지 않습니다. 아래 빠른 로그인 사용."
        );
        return;
      }
      await loginAsMock(found);
      return;
    }
    if (!normalizedEmail || !password) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const sb = createClient();
      const { data: signInData, error } = await sb.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) throw error;

      // 승인 대기/정지(active=false) 계정 차단
      const userId = signInData.user?.id;
      if (userId) {
        const { data: prof } = await sb
          .from("profiles")
          .select("active")
          .eq("id", userId)
          .single<{ active: boolean | null }>();
        if (prof && prof.active === false) {
          await sb.auth.signOut();
          throw new Error(
            "관리자 승인 대기 중이거나 정지된 계정입니다. 관리자에게 문의해주세요."
          );
        }
      }

      router.push(redirect);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        message === "Invalid login credentials"
          ? "계정이 없거나 비밀번호가 맞지 않습니다. 처음 이용하는 원장님은 아래 '+ 원장 가입 신청'을 먼저 진행해주세요."
          : message
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("이메일을 입력해주세요.");
      return;
    }
    if (!isSupabaseActive) {
      router.push(redirect);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const sb = createClient();
      const { error } = await sb.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${location.origin}${redirect}`,
          shouldCreateUser: false,
        },
      });
      if (error) throw error;
      setMagicLinkSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        message.includes("Signups not allowed") ||
          message.includes("User not found")
          ? "등록된 계정이 없습니다. 먼저 '+ 원장 가입 신청'을 진행해주세요."
          : message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 px-6 py-12">
      <header className="text-center">
        <div className="mb-3 inline-flex items-center rounded-full bg-clay-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-clay-600">
          BeautyChain
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-sand-900">로그인</h1>
        <p className="mt-2 text-xs text-sand-600">
          {isSupabaseActive
            ? "원장 또는 법인 대표 계정으로 로그인"
            : "데모 모드 — 아래에서 사용자 선택"}
        </p>
      </header>

{/* 빠른 로그인은 details 아래로 접어둠 — 데모 시연용 */}

      <Card className="w-full">
        <CardBody className="space-y-3">
          <div>
            <label className="text-xs font-medium text-sand-600">이메일</label>
            <input
              type="email"
              inputMode="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              placeholder="name@example.com"
              className="mt-1 w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-sand-600">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-clay-500/10 px-3 py-2 text-xs text-clay-700">
              {error}
            </p>
          )}
          {magicLinkSent && (
            <p className="rounded-lg bg-moss-500/10 px-3 py-2 text-xs text-moss-700">
              이메일로 로그인 링크를 보냈어요. 받은편지함 확인.
            </p>
          )}
          <button
            type="button"
            onClick={handleEmailPassword}
            disabled={loading}
            className="w-full rounded-xl bg-sand-800 px-4 py-3 text-sm font-semibold text-white hover:bg-sand-900 disabled:opacity-50"
          >
            {loading ? "처리 중..." : "로그인"}
          </button>
          <button
            type="button"
            onClick={handleMagicLink}
            disabled={loading || !email}
            className="w-full rounded-xl border border-sand-300 px-4 py-3 text-sm font-medium text-sand-700 hover:border-sand-400 disabled:opacity-50"
          >
            이메일 링크로 로그인
          </button>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
        <Link href="/signup" className="font-medium text-clay-600 hover:text-clay-800">
          + 원장 가입 신청
        </Link>
        <Link href="/manual" className="text-sand-500 hover:text-sand-700">
          📖 매뉴얼
        </Link>
      </div>

      {/* 데모 계정 (접힌 상태로) */}
      {!isSupabaseActive && mockUsers.length > 0 && (
        <details className="w-full">
          <summary className="cursor-pointer text-center text-[11px] text-sand-400 hover:text-sand-600">
            데모 계정 보기
          </summary>
          <div className="mt-2 grid gap-1.5">
            {mockUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => loginAsMock(u)}
                className="flex items-center justify-between rounded-lg border border-sand-200 bg-white px-3 py-2 text-left text-xs hover:border-clay-400"
              >
                <div>
                  <span className="font-semibold text-sand-800">
                    {u.displayName}
                  </span>
                  <span className="ml-2 text-[10px] text-sand-500">{u.email}</span>
                </div>
                <span className="text-[10px] text-sand-400">바로 로그인 →</span>
              </button>
            ))}
          </div>
        </details>
      )}
    </main>
  );
}
