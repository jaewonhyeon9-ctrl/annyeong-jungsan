"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDataSource, isSupabaseActive } from "@/lib/data";
import { PARTS, type Center, type PartId } from "@/lib/types";

const BANKS = [
  "국민",
  "신한",
  "하나",
  "우리",
  "농협",
  "기업",
  "카카오뱅크",
  "토스뱅크",
  "케이뱅크",
  "새마을",
  "신협",
  "기타",
];

export default function SignupPage() {
  // 가입 폼
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [phone, setPhone] = useState("");

  // 지점/파트
  const [centers, setCenters] = useState<Center[]>([]);
  const [centerId, setCenterId] = useState("");
  const [partId, setPartId] = useState<PartId | "">("");

  // 정산 정보
  const [bank, setBank] = useState("국민");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [businessNumber, setBusinessNumber] = useState("");

  // 상태
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getDataSource();
        const list = await data.centers.list();
        setCenters(list);
        if (list.length > 0) setCenterId(list[0].id);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  const selectedCenter = centers.find((c) => c.id === centerId);
  const availableParts = selectedCenter?.enabledParts ?? [];

  async function handleSubmit() {
    setError(null);
    if (!displayName || !email || !password) {
      setError("이름, 이메일, 비밀번호는 필수입니다.");
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
    if (!centerId) {
      setError("지점을 선택해주세요.");
      return;
    }
    if (!partId) {
      setError("파트를 선택해주세요.");
      return;
    }
    if (!accountNumber.trim()) {
      setError("정산 계좌번호는 필수입니다.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await getDataSource();
      await data.users.create({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        role: "owner",
        centerId,
        partId: partId as PartId,
        phone: phone.trim() || undefined,
        bankAccount: {
          bank,
          accountNumber: accountNumber.trim(),
          holder: accountHolder.trim() || displayName.trim(),
        },
        businessNumber: businessNumber.trim() || undefined,
        active: false, // 가입 후 법인 승인 대기
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
          법인 관리자 검토 후 승인되면 로그인 가능합니다.
          <br />
          승인되면 등록하신 이메일로 안내드립니다.
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
          모든 정보 입력 후 신청 → 법인 승인 후 사용 가능
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="scalp@annyeong.com"
              className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
            />
          </Field>
          <Field label="연락처">
            <input
              type="tel"
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

      <Card>
        <CardHeader>
          <CardTitle>지점 및 파트</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <Field label="지점 (병원) *">
            <select
              value={centerId}
              onChange={(e) => {
                setCenterId(e.target.value);
                setPartId("");
              }}
              className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">지점 선택</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="파트 *">
            <select
              value={partId}
              onChange={(e) => setPartId(e.target.value as PartId | "")}
              className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm"
              disabled={!centerId}
            >
              <option value="">파트 선택</option>
              {PARTS.filter((p) => availableParts.includes(p.id)).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>정산 정보</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <Field label="은행 *">
            <select
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm"
            >
              {BANKS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>
          <Field label="계좌번호 *">
            <input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="000-0000-0000-00"
              className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm tabular focus:border-clay-400 focus:outline-none"
            />
          </Field>
          <Field label="예금주 (비우면 본인 이름)">
            <input
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
            />
          </Field>
          <Field label="사업자등록번호 (있는 경우)">
            <input
              value={businessNumber}
              onChange={(e) => setBusinessNumber(e.target.value)}
              placeholder="000-00-00000"
              className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm tabular focus:border-clay-400 focus:outline-none"
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
