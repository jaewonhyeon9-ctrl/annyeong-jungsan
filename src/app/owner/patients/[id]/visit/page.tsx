"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDataSource } from "@/lib/data";
import { fmtWon, todayKST } from "@/lib/format";
import { resizeToDataUrl } from "@/lib/image";
import { findService, servicesByPart } from "@/lib/services";
import { PARTS, type Patient, type PartId } from "@/lib/types";
import { useCurrentProfile } from "@/lib/use-current-profile";

// 환자의 방문 차트 작성/수정 — 시술/결제 + 진료 메모 + 사진 (옵션)
// ?edit=<visitId> 파라미터가 있으면 해당 visit을 불러와 수정 모드로 전환.

type SaleDraft = Record<string, { cash: number; card: number }>;

export default function VisitChartPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const editVisitId = searchParams.get("edit");
  const isEdit = Boolean(editVisitId);
  const { profile } = useCurrentProfile();

  const visibleParts = useMemo(
    () =>
      profile?.role === "owner" && profile.partId
        ? PARTS.filter((p) => p.id === profile.partId)
        : PARTS,
    [profile]
  );

  const [patient, setPatient] = useState<Patient | null>(null);
  const [visitNumber, setVisitNumber] = useState(1);
  const [loading, setLoading] = useState(true);

  const [visitDate, setVisitDate] = useState(todayKST());
  const [partId, setPartId] = useState<PartId>("scalp");
  const [draft, setDraft] = useState<SaleDraft>({});
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [beforePhoto, setBeforePhoto] = useState<string | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<string | null>(null);
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getDataSource();
      const p = await data.patients.get(id);
      const visits = p ? await data.visits.listByPatient(id) : [];
      if (cancelled) return;

      setPatient(p);

      if (isEdit && editVisitId) {
        // 수정 모드 — 기존 visit 데이터로 폼 채우기
        const visit = await data.visits.get(editVisitId);
        if (visit && !cancelled) {
          setVisitDate(visit.visitDate);
          setPartId(visit.partId);
          const d: SaleDraft = {};
          for (const s of visit.sales) {
            d[s.serviceId] = { cash: s.cash, card: s.card };
          }
          setDraft(d);
          setMemo(visit.visitMemo ?? "");
          setBeforePhoto(visit.beforePhotoUrl ?? null);
          setAfterPhoto(visit.afterPhotoUrl ?? null);
          // 회차 — 이 visit이 몇 번째인지
          const sortedAsc = [...visits].sort((a, b) =>
            a.visitDate.localeCompare(b.visitDate)
          );
          const idx = sortedAsc.findIndex((v) => v.id === editVisitId);
          setVisitNumber(idx >= 0 ? idx + 1 : visits.length);
        }
      } else {
        setVisitNumber(visits.length + 1);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isEdit, editVisitId]);

  useEffect(() => {
    if (!isEdit && profile?.role === "owner" && profile.partId)
      setPartId(profile.partId);
  }, [profile, isEdit]);

  async function onPhotoPicked(
    file: File,
    setter: (url: string | null) => void
  ) {
    try {
      const dataUrl = await resizeToDataUrl(file, 800, 0.7);
      setter(dataUrl);
    } catch (err) {
      alert(`사진 처리 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const total = useMemo(() => {
    let cash = 0,
      card = 0;
    for (const v of Object.values(draft)) {
      cash += v.cash;
      card += v.card;
    }
    return { cash, card, total: cash + card };
  }, [draft]);

  function setVal(serviceId: string, key: "cash" | "card", v: number) {
    setDraft((d) => {
      const existing = d[serviceId] ?? { cash: 0, card: 0 };
      return { ...d, [serviceId]: { ...existing, [key]: v } };
    });
  }

  async function handleSave() {
    if (!patient) return;
    const filled = Object.entries(draft).filter(([, v]) => v.cash + v.card > 0);
    if (filled.length === 0) {
      alert("입력된 시술이 없습니다.");
      return;
    }
    setSaving(true);
    try {
      const data = await getDataSource();
      const sales = filled.map(([serviceId, v]) => {
        const svc = findService(serviceId)!;
        return {
          serviceId,
          serviceName: svc.name,
          partId: svc.partId,
          cash: v.cash,
          card: v.card,
        };
      });
      if (isEdit && editVisitId) {
        // null 을 명시적으로 보내야 DB 의 기존 값을 지울 수 있다.
        // undefined 는 update 에서 "변경 안 함" 으로 해석되어 빈 값이 저장되지 않는다.
        await data.visits.update(editVisitId, {
          visitDate,
          partId,
          sales,
          visitMemo: memo.trim() ? memo : null,
          beforePhotoUrl: beforePhoto,
          afterPhotoUrl: afterPhoto,
        });
      } else {
        await data.visits.create({
          patientId: patient.id,
          centerId: patient.centerId,
          visitDate,
          partId,
          sales,
          visitMemo: memo || undefined,
          beforePhotoUrl: beforePhoto ?? undefined,
          afterPhotoUrl: afterPhoto ?? undefined,
        });
      }
      router.push(`/owner/patients/${patient.id}`);
    } catch (err) {
      alert(`저장 실패: ${err instanceof Error ? err.message : String(err)}`);
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!patient || !editVisitId) return;
    const confirmed = window.confirm(
      `${visitNumber}회차 방문 차트(${visitDate})를 삭제하시겠습니까?\n\n` +
        `이 작업은 되돌릴 수 없으며, 해당 매출이 정산에서 빠집니다.`
    );
    if (!confirmed) return;
    setSaving(true);
    try {
      const data = await getDataSource();
      await data.visits.delete(editVisitId);
      router.push(`/owner/patients/${patient.id}`);
    } catch (err) {
      alert(`삭제 실패: ${err instanceof Error ? err.message : String(err)}`);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-md p-6 text-center text-sm text-sand-500">
        로딩 중...
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="mx-auto max-w-md p-6 text-center text-sm text-sand-500">
        환자를 찾을 수 없습니다.{" "}
        <Link href="/owner/patients" className="text-clay-600 underline">
          돌아가기
        </Link>
      </div>
    );
  }

  const services = servicesByPart(partId);

  return (
    <div className="min-h-screen bg-sand-50 pb-32">
      <header className="sticky top-0 z-10 border-b border-sand-200 bg-sand-50/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
          <Link
            href={`/owner/patients/${patient.id}`}
            className="text-sand-600 hover:text-sand-800"
          >
            ←
          </Link>
          <div className="text-sm font-semibold text-sand-800">
            {visitNumber}회차 방문 차트{isEdit ? " (수정)" : ""}
          </div>
          <div className="w-4" />
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-5 py-6">
        {/* 환자 식별 */}
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-mono tabular text-sand-500">
                  {patient.id}
                </div>
                <div className="text-base font-semibold text-sand-800">
                  {patient.personal?.name ?? "(이름 미입력)"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase text-sand-500">방문</div>
                <div className="text-lg font-bold text-clay-600 tabular">
                  {visitNumber}회차
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* 방문일 + 파트 */}
        <Card>
          <CardBody className="space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-sand-500">
                방문일
              </div>
              <input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-sand-500">
                파트
              </div>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {visibleParts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPartId(p.id);
                      setDraft({});
                    }}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                      partId === p.id
                        ? "border-clay-500 bg-clay-500/10 text-clay-700"
                        : "border-sand-200 bg-white text-sand-700"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* 시술 + 결제 */}
        <Card>
          <CardHeader>
            <CardTitle>이번 방문 시술 / 결제</CardTitle>
          </CardHeader>
          <CardBody>
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

            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-sand-200 pt-3 text-xs">
              <div>
                <div className="uppercase text-sand-500">현금</div>
                <div className="font-semibold tabular text-sand-800">
                  {fmtWon(total.cash)}
                </div>
              </div>
              <div>
                <div className="uppercase text-sand-500">카드</div>
                <div className="font-semibold tabular text-sand-800">
                  {fmtWon(total.card)}
                </div>
              </div>
              <div>
                <div className="uppercase text-sand-500">합계</div>
                <div className="font-bold tabular text-clay-600">
                  {fmtWon(total.total)}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* 진료 메모 */}
        <Card>
          <CardHeader>
            <CardTitle>이번 방문 진료 메모</CardTitle>
          </CardHeader>
          <CardBody>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={4}
              placeholder="이번 방문 상태/처치 내용/특이사항"
              className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <PhotoSlot
                label="Before"
                photo={beforePhoto}
                onPick={() => beforeRef.current?.click()}
                onClear={() => setBeforePhoto(null)}
              />
              <PhotoSlot
                label="After"
                photo={afterPhoto}
                onPick={() => afterRef.current?.click()}
                onClear={() => setAfterPhoto(null)}
              />
              <input
                ref={beforeRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPhotoPicked(f, setBeforePhoto);
                  e.target.value = "";
                }}
              />
              <input
                ref={afterRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPhotoPicked(f, setAfterPhoto);
                  e.target.value = "";
                }}
              />
            </div>
          </CardBody>
        </Card>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-2xl bg-sand-800 px-5 py-4 text-base font-semibold text-white shadow-md transition hover:bg-sand-900 active:scale-[0.99] disabled:opacity-60"
        >
          {saving ? "저장 중..." : isEdit ? "수정 완료" : "방문 차트 저장"}
        </button>

        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="w-full rounded-2xl border border-clay-300 bg-white px-5 py-3 text-sm font-semibold text-clay-700 transition hover:bg-clay-500/10 disabled:opacity-60"
          >
            🗑 이 방문 차트 삭제
          </button>
        )}

        <p className="px-1 text-center text-[11px] text-sand-500">
          저장된 시술/결제는 일일 매출에 자동 반영되며 월말 정산에 합산됩니다.
        </p>
      </div>
    </div>
  );
}

function PhotoSlot({
  label,
  photo,
  onPick,
  onClear,
}: {
  label: string;
  photo: string | null;
  onPick: () => void;
  onClear: () => void;
}) {
  if (photo) {
    return (
      <div className="relative aspect-square overflow-hidden rounded-lg border border-sand-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt={label} className="h-full w-full object-cover" />
        <div className="absolute left-1.5 top-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {label}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white"
        >
          ✕
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-sand-300 bg-sand-50 text-xs font-medium text-sand-600 hover:border-clay-400 hover:text-clay-600"
    >
      <span className="text-xl">📷</span>
      <span>{label} 촬영</span>
    </button>
  );
}
