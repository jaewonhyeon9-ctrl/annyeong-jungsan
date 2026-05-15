"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { isSupabaseActive } from "@/lib/data";

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

  async function handleEmailPassword() {
    if (!isSupabaseActive) {
      // 데모 모드 — 그냥 통과
      router.push(redirect);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const sb = createClient();
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink() {
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
        email,
        options: { emailRedirectTo: `${location.origin}${redirect}` },
      });
      if (error) throw error;
      setMagicLinkSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 px-6 py-12">
      <header className="text-center">
        <div className="mb-3 inline-flex items-center rounded-full bg-clay-500/10 px-3 py-1 text-xs font-medium text-clay-600">
          안녕메디컬
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-sand-900">로그인</h1>
        <p className="mt-2 text-xs text-sand-600">
          {isSupabaseActive
            ? "원장 또는 법인 대표 계정으로 로그인"
            : "데모 모드 — 아무 값 입력 후 들어가기"}
        </p>
      </header>

      <Card className="w-full">
        <CardBody className="space-y-3">
          <div>
            <label className="text-xs font-medium text-sand-600">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="manager@annyeong.com"
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

      <Link href="/" className="text-xs text-sand-500 hover:text-sand-700">
        ← 홈으로
      </Link>
    </main>
  );
}
