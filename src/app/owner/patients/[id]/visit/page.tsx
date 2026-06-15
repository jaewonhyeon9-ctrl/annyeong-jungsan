"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDataSource } from "@/lib/data";
import { fmtWon, todayKST } from "@/lib/format";
import { resizeToDataUrl } from "@/lib/image";
import { useServicesByPart, useAllServices } from "@/lib/services";
import { ocrFromFile } from "@/lib/ocr/client";
import type { PosOcrData } from "@/lib/ocr/types";
import {
  PARTS,
  type Patient,
  type PartId,
  type PaymentMethod,
  type VisitSaleLine,
} from "@/lib/types";
import { useCurrentProfile } from "@/lib/use-current-profile";

// 환자의 방문 차트 작성/수정 — 시술/결제 + 진료 메모 + 사진 (옵션)
// ?edit=<visitId> 파라미터가 있으면 해당 visit을 불러와 수정 모드로 전환.

// 입력 보조 상태 — 시술별 "갯수"만 들고 있고, 결제액은 (단가 × 갯수 − 할인)으로
// 계산한다. 저장 시점에 기존 VisitSaleLine(cash/card) 형식으로 변환하므로
// 정산/통계 로직은 그대로 유지된다.
const DISCOUNT_PRESETS = [0, 10, 20, 30, 50, 100];

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
  const { services: allServices } = useAllServices();

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
  const [qty, setQty] = useState<Record<string, number>>({});
  const [discountRate, setDiscountRate] = useState(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("card");
  // 수정 모드에서 불러온 기존 시술 — allServices 로드 후 갯수/할인/결제방식으로 역산
  const [pendingSales, setPendingSales] = useState<VisitSaleLine[] | null>(null);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [beforePhoto, setBeforePhoto] = useState<string | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<string | null>(null);
  const beforeCamRef = useRef<HTMLInputElement>(null);
  const beforeGalRef = useRef<HTMLInputElement>(null);
  const afterCamRef = useRef<HTMLInputElement>(null);
  const afterGalRef = useRef<HTMLInputElement>(null);

  // OCR — 종이 방문차트/매출표 촬영 → 시술·결제 자동 입력
  const ocrRef = useRef<HTMLInputElement>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrNotice, setOcrNotice] = useState<{
    matched: number;
    unmatched: string[];
    confidence: number;
    warnings: string[];
    mock?: boolean;
  } | null>(null);

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
          setPendingSales(visit.sales);
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

  // 수정 모드 — 불러온 기존 시술(cash/card)을 갯수·할인율·결제방식으로 역산.
  // 단가가 있어야 갯수를 추정할 수 있으므로 allServices 로드 후 실행.
  useEffect(() => {
    if (!pendingSales || allServices.length === 0) return;
    const nextQty: Record<string, number> = {};
    let cashSum = 0;
    let cardSum = 0;
    let grossSum = 0;
    for (const s of pendingSales) {
      const price = allServices.find((x) => x.id === s.serviceId)?.defaultPrice ?? 0;
      const paid = s.cash + s.card;
      const q = price > 0 ? Math.max(1, Math.round(paid / price)) : 1;
      nextQty[s.serviceId] = q;
      cashSum += s.cash;
      cardSum += s.card;
      grossSum += price * q;
    }
    setQty(nextQty);
    setPayMethod(cardSum >= cashSum ? "card" : "cash");
    const paidTotal = cashSum + cardSum;
    setDiscountRate(
      grossSum > 0 && paidTotal < grossSum
        ? Math.round((1 - paidTotal / grossSum) * 100)
        : 0
    );
    setPendingSales(null);
  }, [pendingSales, allServices]);

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

  async function handleOcr(file: File) {
    setOcrLoading(true);
    setOcrNotice(null);
    try {
      const result = await ocrFromFile(file, "pos");
      // 차트/메뉴 등 매출표가 아닌 사진은 거부
      if (
        result.classification !== "pos" &&
        result.classification !== "unknown"
      ) {
        setOcrNotice({
          matched: 0,
          unmatched: [],
          confidence: result.confidence,
          warnings: [
            `이 사진은 "${result.classification}"로 인식됐어요. 방문차트/매출표를 다시 촬영해 주세요.`,
          ],
          mock: result.mock,
        });
        return;
      }

      const data =
        result.data && "items" in result.data
          ? (result.data as PosOcrData)
          : null;

      if (data?.date) setVisitDate(data.date);

      const items = data?.items ?? [];
      const nextQty: Record<string, number> = { ...qty };
      const unmatched: string[] = [];
      const partCount: Record<string, number> = {};
      let cashSum = 0;
      let cardSum = 0;
      let matched = 0;

      for (const it of items) {
        const svc = matchService(it.serviceName, allServices);
        if (svc) {
          const paid = (it.cash || 0) + (it.card || 0);
          // 영수증 금액 → 단가로 나눠 갯수 추정 (단가 없으면 1개)
          nextQty[svc.id] =
            svc.defaultPrice > 0
              ? Math.max(1, Math.round(paid / svc.defaultPrice))
              : 1;
          cashSum += it.cash || 0;
          cardSum += it.card || 0;
          partCount[svc.partId] = (partCount[svc.partId] ?? 0) + 1;
          matched++;
        } else if (it.serviceName?.trim()) {
          unmatched.push(it.serviceName.trim());
        }
      }
      setQty(nextQty);
      if (cashSum + cardSum > 0) setPayMethod(cardSum >= cashSum ? "card" : "cash");

      // 매칭된 시술이 보이도록 가장 많이 매칭된 파트로 전환 (권한 내에서만)
      const parts = Object.keys(partCount).sort(
        (a, b) => partCount[b] - partCount[a]
      );
      const dominant = parts[0] as PartId | undefined;
      if (dominant && visibleParts.some((p) => p.id === dominant))
        setPartId(dominant);

      setOcrNotice({
        matched,
        unmatched,
        confidence: result.confidence,
        warnings: result.warnings,
        mock: result.mock,
      });
    } catch (err) {
      setOcrNotice({
        matched: 0,
        unmatched: [],
        confidence: 0,
        warnings: [
          `OCR 실패: ${err instanceof Error ? err.message : String(err)}`,
        ],
      });
    } finally {
      setOcrLoading(false);
    }
  }

  // 담긴 시술(갯수>0) → 라인별 정가 합계. 파트가 달라도 전부 집계해 저장과 일치.
  const calc = useMemo(() => {
    const rate = Math.min(100, Math.max(0, discountRate));
    const lines = Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => {
        const svc = allServices.find((s) => s.id === id);
        const price = svc?.defaultPrice ?? 0;
        return {
          serviceId: id,
          serviceName: svc?.name ?? id,
          partId: (svc?.partId ?? partId) as PartId,
          q,
          gross: price * q,
        };
      });
    const subtotal = lines.reduce((s, l) => s + l.gross, 0);
    const discountAmount = Math.round((subtotal * rate) / 100);
    const finalTotal = subtotal - discountAmount;
    return { lines, subtotal, discountAmount, finalTotal, rate };
  }, [qty, discountRate, allServices, partId]);

  function inc(serviceId: string) {
    setQty((d) => ({ ...d, [serviceId]: (d[serviceId] ?? 0) + 1 }));
  }
  function dec(serviceId: string) {
    setQty((d) => {
      const next = (d[serviceId] ?? 0) - 1;
      const copy = { ...d };
      if (next <= 0) delete copy[serviceId];
      else copy[serviceId] = next;
      return copy;
    });
  }

  // 저장용 — 할인 적용 최종액을 라인별로 분배하고 결제방식(현금/카드)에 몰아준다.
  // 라운딩 오차는 첫 라인이 흡수해 합계가 finalTotal과 정확히 일치하도록 보정.
  function buildSales(): VisitSaleLine[] {
    const factor = 1 - calc.rate / 100;
    const amounts = calc.lines.map((l) => Math.round(l.gross * factor));
    const diff = calc.finalTotal - amounts.reduce((a, b) => a + b, 0);
    if (amounts.length > 0) amounts[0] += diff;
    return calc.lines.map((l, i) => ({
      serviceId: l.serviceId,
      serviceName: l.serviceName,
      partId: l.partId,
      cash: payMethod === "cash" ? amounts[i] : 0,
      card: payMethod === "card" ? amounts[i] : 0,
    }));
  }

  async function handleSave() {
    if (!patient) return;
    if (calc.lines.length === 0) {
      alert("담긴 시술이 없습니다. 시술 버튼을 눌러 추가하세요.");
      return;
    }
    // 최종액 0원(100% 할인=서비스 시술)도 기록 가능 — 차트에 남긴다.
    setSaving(true);
    try {
      const data = await getDataSource();
      const sales = buildSales();
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

  const { services } = useServicesByPart(partId);

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

        {/* OCR — 종이 차트/매출표 촬영 자동입력 */}
        <button
          type="button"
          onClick={() => ocrRef.current?.click()}
          disabled={ocrLoading || saving}
          className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-clay-300 bg-clay-500/5 px-4 py-3 text-left transition hover:bg-clay-500/10 disabled:opacity-60"
        >
          <span className="text-2xl">{ocrLoading ? "⏳" : "📸"}</span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-clay-700">
              {ocrLoading ? "사진 분석 중..." : "차트·매출표 촬영해서 자동입력"}
            </div>
            <div className="text-[11px] text-sand-500">
              {ocrLoading
                ? "잠시만 기다려 주세요"
                : "시술·결제 금액을 자동으로 채워줘요 (확인 후 수정 가능)"}
            </div>
          </div>
        </button>
        <input
          ref={ocrRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleOcr(f);
            e.target.value = "";
          }}
        />

        {ocrNotice && (
          <div
            className={`rounded-xl border px-4 py-3 text-xs ${
              ocrNotice.matched > 0
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            <div className="flex items-center justify-between font-semibold">
              <span>
                {ocrNotice.matched > 0
                  ? `✓ ${ocrNotice.matched}개 시술 자동 입력`
                  : "⚠️ 자동 입력된 시술 없음"}
              </span>
              {ocrNotice.confidence > 0 && (
                <span className="text-[10px] font-normal opacity-70">
                  신뢰도 {Math.round(ocrNotice.confidence * 100)}%
                  {ocrNotice.mock && " · Mock"}
                </span>
              )}
            </div>
            {ocrNotice.unmatched.length > 0 && (
              <div className="mt-1.5 text-[11px] opacity-80">
                매칭 실패(직접 입력): {ocrNotice.unmatched.join(", ")}
              </div>
            )}
            {ocrNotice.warnings.length > 0 && (
              <ul className="mt-1.5 list-disc pl-4 text-[11px] opacity-80">
                {ocrNotice.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            <div className="mt-1.5 text-[11px] opacity-70">
              아래에서 금액을 확인하고 저장하세요.
            </div>
          </div>
        )}

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
                      setQty({});
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
            <div className="pb-2 text-[11px] text-sand-500">
              시술 버튼을 눌러 담고, − / ＋ 로 갯수를 조절하세요.
            </div>
            {services.length === 0 ? (
              <div className="rounded-lg border border-dashed border-sand-300 bg-sand-50 px-3 py-6 text-center text-xs text-sand-500">
                이 파트에 등록된 시술이 없습니다.
              </div>
            ) : (
              <div className="space-y-2">
                {services.map((svc) => {
                  const q = qty[svc.id] ?? 0;
                  const active = q > 0;
                  return (
                    <div
                      key={svc.id}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition ${
                        active
                          ? "border-clay-400 bg-clay-500/5"
                          : "border-sand-200 bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => inc(svc.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="truncate text-sm font-medium text-sand-800">
                          {svc.name}
                        </div>
                        <div className="text-xs tabular text-sand-500">
                          {fmtWon(svc.defaultPrice)}
                          {active && (
                            <span className="ml-1 font-semibold text-clay-600">
                              × {q} = {fmtWon(svc.defaultPrice * q)}
                            </span>
                          )}
                        </div>
                      </button>
                      {active ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => dec(svc.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-sand-200 text-lg font-bold text-sand-700 active:scale-95"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-base font-bold tabular text-sand-800">
                            {q}
                          </span>
                          <button
                            type="button"
                            onClick={() => inc(svc.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-clay-500 text-lg font-bold text-white active:scale-95"
                          >
                            ＋
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => inc(svc.id)}
                          className="rounded-full bg-clay-500/10 px-4 py-2 text-xs font-semibold text-clay-700 active:scale-95"
                        >
                          담기
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 합산 + 할인율 */}
            <div className="mt-4 space-y-2.5 border-t border-sand-200 pt-3 text-sm">
              <div className="flex items-center justify-between text-sand-700">
                <span>시술 합계</span>
                <span className="font-semibold tabular">
                  {fmtWon(calc.subtotal)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sand-700">할인율</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    placeholder="0"
                    value={discountRate || ""}
                    onChange={(e) =>
                      setDiscountRate(
                        Math.min(100, Math.max(0, Number(e.target.value) || 0))
                      )
                    }
                    className="w-16 rounded-lg border border-sand-200 bg-white px-2 py-1.5 text-right text-sm tabular focus:border-clay-400 focus:outline-none"
                  />
                  <span className="text-sand-600">%</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {DISCOUNT_PRESETS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDiscountRate(d)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      discountRate === d
                        ? "bg-clay-500 text-white"
                        : "bg-sand-100 text-sand-600"
                    }`}
                  >
                    {d}%
                  </button>
                ))}
              </div>

              {calc.discountAmount > 0 && (
                <div className="flex items-center justify-between text-clay-600">
                  <span>할인 금액</span>
                  <span className="font-semibold tabular">
                    − {fmtWon(calc.discountAmount)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-sand-200 pt-2.5">
                <span className="font-semibold text-sand-800">최종 결제액</span>
                <span className="text-lg font-bold tabular text-clay-600">
                  {fmtWon(calc.finalTotal)}
                </span>
              </div>
            </div>

            {/* 결제 방식 — 총액을 현금/카드 중 하나로 */}
            <div className="mt-4 space-y-1.5">
              <div className="text-xs uppercase tracking-wider text-sand-500">
                결제 방식
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: "cash", label: "💵 현금" },
                    { id: "card", label: "💳 카드" },
                  ] as { id: PaymentMethod; label: string }[]
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPayMethod(m.id)}
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                      payMethod === m.id
                        ? "border-clay-500 bg-clay-500/10 text-clay-700"
                        : "border-sand-200 bg-white text-sand-600"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
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
                onCamera={() => beforeCamRef.current?.click()}
                onGallery={() => beforeGalRef.current?.click()}
                onClear={() => setBeforePhoto(null)}
              />
              <PhotoSlot
                label="After"
                photo={afterPhoto}
                onCamera={() => afterCamRef.current?.click()}
                onGallery={() => afterGalRef.current?.click()}
                onClear={() => setAfterPhoto(null)}
              />
              {/* Before — 카메라 / 갤러리 */}
              <input
                ref={beforeCamRef}
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
                ref={beforeGalRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPhotoPicked(f, setBeforePhoto);
                  e.target.value = "";
                }}
              />
              {/* After — 카메라 / 갤러리 */}
              <input
                ref={afterCamRef}
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
              <input
                ref={afterGalRef}
                type="file"
                accept="image/*"
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
  onCamera,
  onGallery,
  onClear,
}: {
  label: string;
  photo: string | null;
  onCamera: () => void;
  onGallery: () => void;
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
    <div className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-sand-300 bg-sand-50 text-xs font-medium text-sand-600">
      <span className="text-xl">📷</span>
      <span>{label}</span>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onCamera}
          className="rounded bg-clay-500/10 px-2 py-1 text-[11px] font-medium text-clay-700 hover:bg-clay-500/20"
        >
          촬영
        </button>
        <button
          type="button"
          onClick={onGallery}
          className="rounded bg-sand-200 px-2 py-1 text-[11px] font-medium text-sand-700 hover:bg-sand-300"
        >
          갤러리
        </button>
      </div>
    </div>
  );
}

// OCR 시술명 → 등록된 시술 매칭 (공백/괄호 무시, 부분 일치 허용)
function matchService<T extends { id: string; name: string; partId: PartId }>(
  ocrName: string,
  services: T[]
): T | null {
  const norm = (s: string) =>
    s.replace(/\s+/g, "").replace(/[()[\]·/]/g, "").toLowerCase();
  const n = norm(ocrName);
  if (!n) return null;
  const exact = services.find((s) => norm(s.name) === n);
  if (exact) return exact;
  return (
    services.find((s) => {
      const sn = norm(s.name);
      return sn.includes(n) || n.includes(sn);
    }) ?? null
  );
}
