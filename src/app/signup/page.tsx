"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDataSource, isSupabaseActive } from "@/lib/data";

export default function SignupPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [phone, setPhone] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);

    const normalizedName = displayName.trim();
    const normalizedEmail = email.trim();
    const normalizedPhone = phone.trim();

    if (!normalizedName || !normalizedEmail || !password) {
      setError("성함, 이메일, 비밀번호는 필수입니다.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("이메일 형식이 올바르지 않습니다. (예: name@example.com)");
      return;
    }
    if (password !== passwordConfirm) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    if (password.length < 6) {
      setError("비밀번호는 최소 6자 이상.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await getDataSource();
      await data.users.create({
        email: normalizedEmail,
        password,
        displayName: normalizedName,
        role: "owner",
        centerId: null,
        partId: null,
        phone: normalizedPhone || undefined,
        active: false,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <div className="text-4xl">✅</div>
        <h1 className="text-xl font-bold text-sand-900">가입 신청 완료</h1>
        <p className="text-sm text-sand-600">
          관리자 승인 후 사용 가능합니다.
          <br />
          승인되면 등록하신 이메일로 안내드리며,
          <br />
          지점·파트·정산 정보는 승인 후 입력하실 수 있습니다.
        </p>
        <Link
          href="/login"
          className="mt-2 rounded-xl bg-sand-800 px-6 py-3 text-sm font-semibold text-white hover:bg-sand-900"
        >
          로그인 화면으로
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md space-y-5 px-5 py-8">
      <header className="text-center">
        <div className="mb-3 inline-flex items-center rounded-full bg-clay-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-clay-600">
          BeautyChain
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-sand-900">
          원장 가입 신청
        </h1>
        <p className="mt-2 text-xs text-sand-600">
          간단 정보만 입력 → 관리자 승인 후 사용
          <br />
          지점·파트·정산정보는 승인 후 입력
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <Field label="성함 *">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="홍길동"
              className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
            />
          </Field>
          <Field label="이메일 (로그인 ID) *">
            <input
              type="email"
              inputMode="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              placeholder="name@example.com"
              className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-sand-500">
              한글 모드 OFF · 공백 없이 입력해주세요
            </p>
          </Field>
          <Field label="연락처">
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
            />
          </Field>
          <Field label="비밀번호 * (6자 이상)">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
            />
          </Field>
          <Field label="비밀번호 확인 *">
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
            />
          </Field>
        </CardBody>
      </Card>

      {error && (
        <div className="rounded-xl bg-clay-500/10 px-4 py-3 text-sm text-clay-700">
          {error}
        </div>
      )}

      {!isSupabaseActive && (
        <div className="rounded-xl bg-sand-100 px-4 py-3 text-[11px] text-sand-600">
          데모 모드: 가입 신청만 로컬에 저장됩니다. 새로고침하면 사라집니다.
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full rounded-2xl bg-sand-800 px-5 py-4 text-base font-semibold text-white shadow-md transition hover:bg-sand-900 disabled:opacity-60"
      >
        {submitting ? "신청 중..." : "가입 신청"}
      </button>

      <p className="text-center text-xs text-sand-500">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="text-clay-600 underline">
          로그인
        </Link>
      </p>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <div className="mb-1 font-medium text-sand-600">{label}</div>
      {children}
    </label>
  );
}
