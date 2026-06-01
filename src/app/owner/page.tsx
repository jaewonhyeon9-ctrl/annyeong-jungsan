"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { getDataSource } from "@/lib/data";
import { fmtDate, fmtWon, todayKST } from "@/lib/format";
import { ocrFromFile } from "@/lib/ocr/client";
import type { PosOcrData, ReceiptOcrData } from "@/lib/ocr/types";
import { findService, SERVICES, servicesByPart } from "@/lib/services";
import { isProfileComplete, PARTS, type PartId } from "@/lib/types";
import { useCurrentCenter } from "@/lib/use-current-center";
import { useCurrentProfile } from "@/lib/use-current-profile";

type EntryDraft = Record<string, { cash: number; card: number }>;

export default function OwnerHome() {
  const { centerId, loaded: centerLoaded, error: centerError } = useCurrentCenter();
  const { profile } = useCurrentProfile();
  const [date, setDate] = useState(todayKST());

  // 사용자의 파트로 자동 좁힘 — 원장은 자기 파트만 표시
  const visibleParts = useMemo(
    () =>
      profile?.role === "owner" && profile.partId
        ? PARTS.filter((p) => p.id === profile.partId)
        : PARTS,
    [profile]
  );
  const [openPart, setOpenPart] = useState<PartId | null>("scalp");
  useEffect(() => {
    if (profile?.role === "owner" && profile.partId) {
      setOpenPart(profile.partId);
    }
  }, [profile]);
  const [draft, setDraft] = useState<EntryDraft>({});

  // 카탈로그에 없는 시술 — 직접 추가
  type CustomLine = {
    tempId: string;
    partId: PartId;
    name: string;
    cash: number;
    card: number;
  };
  const [customLines, setCustomLines] = useState<CustomLine[]>([]);
  function addCustom() {
    setCustomLines((arr) => [
      ...arr,
      {
        tempId: `c-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        partId: visibleParts[0]?.id ?? "scalp",
        name: "",
        cash: 0,
        card: 0,
      },
    ]);
  }
  function updateCustom(tempId: string, patch: Partial<CustomLine>) {
    setCustomLines((arr) =>
      arr.map((c) => (c.tempId === tempId ? { ...c, ...patch } : c))
    );
  }
  function removeCustom(tempId: string) {
    setCustomLines((arr) => arr.filter((c) => c.tempId !== tempId));
  }

  const total = useMemo(() => {
    let cash = 0,
      card = 0;
    for (const v of Object.values(draft)) {
      cash += v.cash;
      card += v.card;
    }
    for (const c of customLines) {
      cash += c.cash;
      card += c.card;
    }
    return { cash, card, total: cash + card };
  }, [draft, customLines]);

  function setVal(serviceId: string, key: "cash" | "card", v: number) {
    setDraft((d) => {
      const existing = d[serviceId] ?? { cash: 0, card: 0 };
      return { ...d, [serviceId]: { ...existing, [key]: v } };
    });
  }

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrNotice, setOcrNotice] = useState<{
    type: "receipt" | "pos" | "unknown";
    confidence: number;
    mock?: boolean;
    note?: string;
  } | null>(null);

  function findServiceIdByName(name: string, partGuess: PartId | null): string | null {
    const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
    const exact = SERVICES.find((s) => norm(s.name) === norm(name));
    if (exact) return exact.id;
    if (partGuess) {
      const inPart = servicesByPart(partGuess).find((s) =>
        norm(name).includes(norm(s.name))
      );
      if (inPart) return inPart.id;
    }
    return null;
  }

  function fillFromPos(d: PosOcrData) {
    const updates: typeof draft = {};
    const unmatched: string[] = [];
    for (const item of d.items) {
      const svcId = findServiceIdByName(item.serviceName, item.partGuess);
      if (svcId) {
        updates[svcId] = {
          cash: (updates[svcId]?.cash ?? 0) + item.cash,
          card: (updates[svcId]?.card ?? 0) + item.card,
        };
      } else {
        unmatched.push(`${item.serviceName} (${item.cash + item.card}원)`);
      }
    }
    setDraft((d2) => ({ ...d2, ...updates }));
    if (unmatched.length > 0) {
      setOcrNotice((n) =>
        n ? { ...n, note: `미매칭 시술: ${unmatched.join(", ")}` } : n
      );
    }
  }

  function fillFromReceipt(d: ReceiptOcrData) {
    if (d.date) setDate(d.date);
    // 영수증은 시술 단위가 아니라 결제 단위라 매칭 어려움.
    // 단순히 알림만 표시 — 어느 시술인지 사용자가 직접 선택해야.
    setOcrNotice((n) =>
      n
        ? {
            ...n,
            note: `금액 ${d.totalAmount?.toLocaleString() ?? "?"}원 (${
              d.paymentMethod === "cash" ? "현금" : "카드"
            }) — 어느 시술인지 아래에서 직접 입력하세요`,
          }
        : n
    );
  }

  async function onFilePicked(file: File) {
    setOcrLoading(true);
    setOcrNotice(null);
    try {
      const result = await ocrFromFile(file); // hint 없음 — 자동 분류
      if (result.classification === "chart") {
        alert(
          "환자 차트로 인식됐어요. 환자 등록 화면에서 사용해주세요."
        );
        return;
      }
      if (result.classification === "pos" && result.data) {
        fillFromPos(result.data as PosOcrData);
      } else if (result.classification === "receipt" && result.data) {
        fillFromReceipt(result.data as ReceiptOcrData);
      }
      setOcrNotice({
        type: result.classification as "receipt" | "pos" | "unknown",
        confidence: result.confidence,
        mock: result.mock,
      });
    } catch (err) {
      alert(`OCR 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setOcrLoading(false);
    }
  }

  function handleCameraOCR() {
    fileInputRef.current?.click();
  }

  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  async function handleSave() {
    if (!centerId) {
      alert(centerError ?? "센터 정보를 불러오지 못했습니다.");
      return;
    }
    const filled = Object.entries(draft).filter(([, v]) => v.cash + v.card > 0);
    const customsValid = customLines.filter(
      (c) => c.name.trim() && c.cash + c.card > 0
    );
    if (filled.length === 0 && customsValid.length === 0) {
      alert("입력된 매출이 없습니다.");
      return;
    }
    setSaving(true);
    setSaveNotice(null);
    try {
      const data = await getDataSource();
      const existingEntries = await data.entries.byMonth(centerId, date.slice(0, 7));
      const hasManualEntryForDate = existingEntries.some(
        (entry) => entry.date === date && !entry.id.startsWith("visit-")
      );
      if (
        hasManualEntryForDate &&
        !window.confirm(
          `${fmtDate(date)}에 이미 직접 저장한 매출이 있습니다.\n추가로 저장하면 정산에 함께 합산됩니다. 계속 저장할까요?`
        )
      ) {
        setSaving(false);
        return;
      }
      const catalogSales = filled.map(([serviceId, v]) => {
        const svc = findService(serviceId)!;
        return {
          serviceId,
          serviceName: svc.name,
          partId: svc.partId,
          cash: v.cash,
          card: v.card,
        };
      });
      const customSales = customsValid.map((c) => ({
        serviceId: `custom.${c.partId}.${c.name.replace(/\s+/g, "_")}`,
        serviceName: c.name.trim(),
        partId: c.partId,
        cash: c.cash,
        card: c.card,
      }));
      await data.entries.create({
        centerId,
        date,
        sales: [...catalogSales, ...customSales],
      });
      setSaveNotice(
        `${date} 매출 저장 — ${filled.length + customsValid.length}건 · ${fmtWon(total.total)}`
      );
      setDraft({});
      setCustomLines([]);
    } catch (err) {
      setSaveNotice(
        `저장 실패: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setSaving(false);
    }
  }

  const needsProfileCompletion = profile && !isProfileComplete(profile);

  return (
    <div className="space-y-5">
      {/* 프로필 미완성 알림 */}
      {needsProfileCompletion && (
        <Link
          href="/owner/profile"
          className="block rounded-2xl border-2 border-clay-400 bg-clay-500/10 px-4 py-3 text-sm text-clay-800 hover:bg-clay-500/15"
        >
          <div className="font-semibold">⚠️ 내 정보가 비어있어요</div>
          <div className="mt-0.5 text-xs">
            연락처/정산 계좌 입력해주세요 — 정산 입금에 필요해요. 클릭 →
          </div>
        </Link>
      )}

      {/* 날짜 + 합계 */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-sand-600">오늘</div>
              <div className="mt-0.5 text-lg font-semibold text-sand-800">
                {fmtDate(date)}
              </div>
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-sand-200 bg-white px-3 py-1.5 text-sm text-sand-700 focus:border-clay-400 focus:outline-none"
            />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-sand-200 pt-4">
            <div>
              <div className="text-[11px] uppercase text-sand-500">현금</div>
              <div className="text-base font-semibold text-sand-800 tabular">
                {fmtWon(total.cash)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase text-sand-500">카드</div>
              <div className="text-base font-semibold text-sand-800 tabular">
                {fmtWon(total.card)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase text-sand-500">합계</div>
              <div className="text-base font-bold text-clay-600 tabular">
                {fmtWon(total.total)}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* OCR 입력 (hidden) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFilePicked(f);
          e.target.value = "";
        }}
      />

      {/* 사진 촬영 → 자동입력 — 핵심 동선 */}
      <button
        type="button"
        onClick={handleCameraOCR}
        disabled={ocrLoading}
        className="flex w-full items-center justify-center gap-3 rounded-2xl bg-clay-500 px-5 py-5 text-white shadow-md transition hover:bg-clay-600 active:scale-[0.99] disabled:opacity-60"
      >
        <span className="text-2xl">{ocrLoading ? "⏳" : "📸"}</span>
        <div className="text-left">
          <div className="text-base font-semibold">
            {ocrLoading ? "사진 분석 중..." : "영수증 / POS 촬영해서 자동입력"}
          </div>
          <div className="text-xs text-white/80">
            {ocrLoading
              ? "Claude Vision 추출 중"
              : "차트는 환자 등록 화면에서 → 시술 매출은 여기"}
          </div>
        </div>
      </button>

      {ocrNotice && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            ocrNotice.confidence >= 0.95
              ? "bg-moss-500/10 text-moss-700"
              : "bg-clay-500/10 text-clay-700"
          }`}
        >
          <div className="font-semibold">
            {ocrNotice.type === "pos"
              ? "✓ POS 마감표 추출"
              : ocrNotice.type === "receipt"
              ? "✓ 영수증 추출"
              : "분류 불가"}
            <span className="ml-2 text-xs font-normal">
              신뢰도 {Math.round(ocrNotice.confidence * 100)}%
              {ocrNotice.mock && " · Mock"}
            </span>
          </div>
          {ocrNotice.note && (
            <div className="mt-1 text-xs">{ocrNotice.note}</div>
          )}
        </div>
      )}

      {/* 파트별 매출 입력 — 원장 사용자는 자기 파트만 표시 */}
      <div className="space-y-3">
        {visibleParts.map((part) => {
          const services = servicesByPart(part.id);
          const isOpen = openPart === part.id;
          const partTotal = services.reduce((s, svc) => {
            const v = draft[svc.id];
            return s + (v ? v.cash + v.card : 0);
          }, 0);

          return (
            <Card key={part.id}>
              <button
                type="button"
                onClick={() => setOpenPart(isOpen ? null : part.id)}
                className="flex w-full items-center justify-between px-5 py-4"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sand-800">{part.label}</span>
                  {partTotal > 0 && (
                    <span className="rounded-full bg-clay-500/15 px-2 py-0.5 text-xs font-medium text-clay-600 tabular">
                      {fmtWon(partTotal)}
                    </span>
                  )}
                </div>
                <span className={`text-sand-400 transition ${isOpen ? "rotate-90" : ""}`}>
                  ▶
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-sand-200 px-5 py-4">
                  <div className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2 pb-2 text-[11px] uppercase tracking-wider text-sand-500">
                    <div>시술</div>
                    <div className="text-right">현금</div>
                    <div className="text-right">카드</div>
                  </div>
                  <div className="space-y-2">
                    {services.map((svc) => {
                      const v = draft[svc.id] ?? { cash: 0, card: 0 };
                      return (
                        <div
                          key={svc.id}
                          className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2"
                        >
                          <div className="truncate text-sm text-sand-800">
                            {svc.name}
                            <span className="ml-1 text-xs text-sand-500 tabular">
                              ({fmtWon(svc.defaultPrice)})
                            </span>
                          </div>
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="0"
                            value={v.cash || ""}
                            onChange={(e) =>
                              setVal(svc.id, "cash", Number(e.target.value) || 0)
                            }
                            className="rounded-lg border border-sand-200 bg-white px-2 py-1.5 text-right text-sm tabular focus:border-clay-400 focus:outline-none"
                          />
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="0"
                            value={v.card || ""}
                            onChange={(e) =>
                              setVal(svc.id, "card", Number(e.target.value) || 0)
                            }
                            className="rounded-lg border border-sand-200 bg-white px-2 py-1.5 text-right text-sm tabular focus:border-clay-400 focus:outline-none"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* 기타 — 카탈로그에 없는 시술 직접 추가 */}
      <Card>
        <div className="flex items-center justify-between border-b border-sand-200 px-5 py-3">
          <div className="font-semibold text-sand-800">기타 시술</div>
          <button
            type="button"
            onClick={addCustom}
            className="rounded-lg bg-sand-100 px-3 py-1 text-xs font-medium text-sand-700 hover:bg-sand-200"
          >
            + 추가
          </button>
        </div>
        {customLines.length === 0 ? (
          <div className="px-5 py-4 text-xs text-sand-500">
            카탈로그에 없는 시술이 있으면 직접 추가하세요.
          </div>
        ) : (
          <div className="space-y-2 px-5 py-3">
            {customLines.map((c) => (
              <div
                key={c.tempId}
                className="grid grid-cols-[5rem_1fr_4.5rem_4.5rem_1.5rem] items-center gap-2"
              >
                <select
                  value={c.partId}
                  onChange={(e) =>
                    updateCustom(c.tempId, { partId: e.target.value as PartId })
                  }
                  className="rounded-lg border border-sand-200 bg-white px-2 py-1.5 text-xs"
                >
                  {visibleParts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="시술명"
                  value={c.name}
                  onChange={(e) =>
                    updateCustom(c.tempId, { name: e.target.value })
                  }
                  className="rounded-lg border border-sand-200 bg-white px-2 py-1.5 text-sm focus:border-clay-400 focus:outline-none"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="현금"
                  value={c.cash || ""}
                  onChange={(e) =>
                    updateCustom(c.tempId, {
                      cash: Number(e.target.value) || 0,
                    })
                  }
                  className="rounded-lg border border-sand-200 bg-white px-2 py-1.5 text-right text-sm tabular focus:border-clay-400 focus:outline-none"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="카드"
                  value={c.card || ""}
                  onChange={(e) =>
                    updateCustom(c.tempId, {
                      card: Number(e.target.value) || 0,
                    })
                  }
                  className="rounded-lg border border-sand-200 bg-white px-2 py-1.5 text-right text-sm tabular focus:border-clay-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeCustom(c.tempId)}
                  className="text-sand-400 hover:text-clay-500"
                  aria-label="삭제"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 환자 관리 / 유입 / 시술 품목 */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href="/owner/patients"
          className="rounded-2xl border border-sand-200 bg-white/70 px-4 py-4 text-center"
        >
          <div className="text-xl">👤</div>
          <div className="mt-1 text-sm font-semibold text-sand-800">환자 관리</div>
          <div className="text-[11px] text-sand-500">신규 등록 · 방문 차트</div>
        </Link>
        <Link
          href="/owner/inflow"
          className="rounded-2xl border border-sand-200 bg-white/70 px-4 py-4 text-center"
        >
          <div className="text-xl">📈</div>
          <div className="mt-1 text-sm font-semibold text-sand-800">월별 유입</div>
          <div className="text-[11px] text-sand-500">유입경로 · 신규환자</div>
        </Link>
        <Link
          href="/owner/services"
          className="rounded-2xl border border-sand-200 bg-white/70 px-4 py-4 text-center"
        >
          <div className="text-xl">🧾</div>
          <div className="mt-1 text-sm font-semibold text-sand-800">시술 품목</div>
          <div className="text-[11px] text-sand-500">등록 · 수정 · 비활성</div>
        </Link>
      </div>

      {saveNotice && (
        <div className="rounded-xl bg-moss-500/10 px-4 py-3 text-sm text-moss-700">
          {saveNotice}
        </div>
      )}

      {/* 저장 */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !centerLoaded}
        className="w-full rounded-2xl bg-sand-800 px-5 py-4 text-base font-semibold text-white shadow-md transition hover:bg-sand-900 active:scale-[0.99] disabled:opacity-60"
      >
        {saving ? "저장 중..." : centerLoaded ? "저장" : "센터 확인 중..."}
      </button>
    </div>
  );
}
