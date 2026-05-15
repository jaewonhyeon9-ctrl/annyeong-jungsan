"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDataSource } from "@/lib/data";
import { useCurrentProfile } from "@/lib/use-current-profile";
import { PARTS } from "@/lib/types";

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

export default function OwnerProfilePage() {
  const { profile, loaded } = useCurrentProfile();

  const [phone, setPhone] = useState("");
  const [bank, setBank] = useState("국민");
  const [accountNumber, setAccountNumber] = useState("");
  const [holder, setHolder] = useState("");
  const [businessNumber, setBusinessNumber] = useState("");
  const [contractStartDate, setContractStartDate] = useState("");
  const [memo, setMemo] = useState("");

  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setPhone(profile.phone ?? "");
    setBank(profile.bankAccount?.bank ?? "국민");
    setAccountNumber(profile.bankAccount?.accountNumber ?? "");
    setHolder(profile.bankAccount?.holder ?? profile.displayName);
    setBusinessNumber(profile.businessNumber ?? "");
    setContractStartDate(profile.contractStartDate ?? "");
    setMemo(profile.memo ?? "");
  }, [profile]);

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    setSavedNotice(null);
    try {
      const data = await getDataSource();
      await data.users.update(profile.id, {
        phone: phone.trim() || undefined,
        bankAccount:
          bank && accountNumber.trim()
            ? {
                bank,
                accountNumber: accountNumber.trim(),
                holder: holder.trim() || profile.displayName,
              }
            : undefined,
        businessNumber: businessNumber.trim() || undefined,
        contractStartDate: contractStartDate || undefined,
        memo: memo.trim() || undefined,
      });
      setSavedNotice("저장 완료");
    } catch (err) {
      setSavedNotice(
        `저장 실패: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div className="py-12 text-center text-sm text-sand-500">로딩 중...</div>
    );
  }
  if (!profile) {
    return (
      <div className="py-12 text-center text-sm text-sand-500">
        로그인이 필요합니다.{" "}
        <Link href="/login" className="text-clay-600 underline">
          로그인
        </Link>
      </div>
    );
  }

  const partLabel = profile.partId
    ? PARTS.find((p) => p.id === profile.partId)?.label
    : null;

  return (
    <div className="space-y-5">
      {/* 헤더 — 식별 정보 */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-sand-500">{profile.email}</div>
              <div className="mt-0.5 text-lg font-bold text-sand-900">
                {profile.displayName}
              </div>
              {partLabel && (
                <span className="mt-1 inline-block rounded-full bg-clay-500/15 px-2 py-0.5 text-[11px] font-medium text-clay-700">
                  {partLabel} 원장
                </span>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>연락처</CardTitle>
        </CardHeader>
        <CardBody>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-0000-0000"
            className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>정산 계좌 *</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <div>
            <label className="text-xs font-medium text-sand-600">은행</label>
            <select
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              className="mt-1 w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm"
            >
              {BANKS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-sand-600">계좌번호</label>
            <input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="000-0000-0000-00"
              className="mt-1 w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm tabular focus:border-clay-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-sand-600">예금주</label>
            <input
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
              className="mt-1 w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
            />
          </div>
          <p className="text-[10px] text-sand-500">
            * 정산 시 입금되는 계좌입니다. 정확하게 입력해주세요.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>사업자 정보 (선택)</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <div>
            <label className="text-xs font-medium text-sand-600">
              사업자등록번호
            </label>
            <input
              value={businessNumber}
              onChange={(e) => setBusinessNumber(e.target.value)}
              placeholder="000-00-00000"
              className="mt-1 w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm tabular focus:border-clay-400 focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-sand-500">
              개인사업자로 등록되어 있다면 입력해주세요. (없으면 비워두기)
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-sand-600">
              계약 시작일
            </label>
            <input
              type="date"
              value={contractStartDate}
              onChange={(e) => setContractStartDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>메모 (선택)</CardTitle>
        </CardHeader>
        <CardBody>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            placeholder="법인에 전달할 메모"
            className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
          />
        </CardBody>
      </Card>

      {savedNotice && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            savedNotice.startsWith("저장 완료")
              ? "bg-moss-500/10 text-moss-700"
              : "bg-clay-500/10 text-clay-700"
          }`}
        >
          {savedNotice}
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-2xl bg-sand-800 px-5 py-4 text-base font-semibold text-white shadow-md transition hover:bg-sand-900 disabled:opacity-60"
      >
        {saving ? "저장 중..." : "내 정보 저장"}
      </button>
    </div>
  );
}
