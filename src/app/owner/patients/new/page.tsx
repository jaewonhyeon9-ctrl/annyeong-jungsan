"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDataSource } from "@/lib/data";
import { todayKST, thisMonthKST } from "@/lib/format";
import { ocrFromFile } from "@/lib/ocr/client";
import type { ChartOcrData } from "@/lib/ocr/types";
import { generateNextPatientId } from "@/lib/patient";
import {
  INFLOW_CHANNELS,
  type ChartCareExp,
  type ChartCondition,
  type InflowChannel,
  type Pregnancy,
  type Severity,
} from "@/lib/types";
import { useCurrentCenter } from "@/lib/use-current-center";

// 신규 환자 등록 — 차트의 모든 필드 노출 + 수정 가능
// Phase 3에서 차트 사진 OCR 결과를 미리 채워준 뒤 이 화면으로 진입

type CheckSet<T extends string> = Record<T, boolean>;
const empty = <T extends string>(keys: readonly T[]): CheckSet<T> =>
  Object.fromEntries(keys.map((k) => [k, false])) as CheckSet<T>;

const CONDITION_OPTS: readonly ChartCondition[] = [
  "toenail_fungus",
  "ingrown_nail",
  "callus",
];
const CONDITION_LABELS: Record<ChartCondition, string> = {
  toenail_fungus: "발톱 무좀",
  ingrown_nail: "파고드는 발톱",
  callus: "발각질",
};

const CARE_OPTS: readonly ChartCareExp[] = [
  "hospital",
  "oriental",
  "nailshop",
  "footcare",
  "other",
];
const CARE_LABELS: Record<ChartCareExp, string> = {
  hospital: "병원(약물/레이저)",
  oriental: "한의원",
  nailshop: "네일샵",
  footcare: "발관리 전문샵",
  other: "기타",
};

const PRODUCT_OPTS = ["antifungal", "antifungal_tx", "callus_moist", "other"] as const;
const PRODUCT_LABELS: Record<(typeof PRODUCT_OPTS)[number], string> = {
  antifungal: "무좀 소독제",
  antifungal_tx: "무좀 치료제",
  callus_moist: "발각질 보습제",
  other: "기타",
};

const MED_OPTS = ["anticancer", "lipid", "bp", "diabetes", "other"] as const;
const MED_LABELS: Record<(typeof MED_OPTS)[number], string> = {
  anticancer: "항암",
  lipid: "고지혈증",
  bp: "혈압",
  diabetes: "당뇨",
  other: "기타",
};

export default function NewPatientPage() {
  const router = useRouter();
  const { centerId, loaded: centerLoaded, error: centerError } = useCurrentCenter();

  // 현재 환자 목록 조회 후 다음 ID 발급
  const [patientId, setPatientId] = useState("");
  useEffect(() => {
    if (!centerLoaded || !centerId) return;
    let cancelled = false;
    (async () => {
      const data = await getDataSource();
      const patients = await data.patients.list(centerId);
      if (!cancelled) {
        setPatientId(generateNextPatientId(patients, 1, thisMonthKST()));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [centerId, centerLoaded]);

  const [saving, setSaving] = useState(false);
  const [firstVisit, setFirstVisit] = useState(todayKST());
  const [consent, setConsent] = useState(true);

  // 개인정보 (원장 영역, 정산 DB 분리)
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [address, setAddress] = useState("");

  // 방문 경로 (다중 선택)
  const [channels, setChannels] = useState<CheckSet<InflowChannel>>(() =>
    empty(INFLOW_CHANNELS.map((c) => c.id))
  );
  const [otherChannel, setOtherChannel] = useState("");

  // 의료 체크리스트
  const [conditions, setConditions] = useState<CheckSet<ChartCondition>>(() =>
    empty(CONDITION_OPTS)
  );
  const [duration, setDuration] = useState<string>("");
  const [careExp, setCareExp] = useState<CheckSet<ChartCareExp>>(() =>
    empty(CARE_OPTS)
  );
  const [careExpOther, setCareExpOther] = useState("");
  const [stress, setStress] = useState<Severity | "">("");
  const [pain, setPain] = useState<Severity | "">("");
  const [hasAllergy, setHasAllergy] = useState<"yes" | "no" | "">("");
  const [allergyTypes, setAllergyTypes] = useState("");
  const [products, setProducts] = useState<CheckSet<(typeof PRODUCT_OPTS)[number]>>(
    () => empty(PRODUCT_OPTS)
  );
  const [occupation, setOccupation] = useState("");
  const [hiking, setHiking] = useState(false);
  const [golf, setGolf] = useState(false);
  const [soccer, setSoccer] = useState(false);
  const [alcohol, setAlcohol] = useState(0);
  const [smoking, setSmoking] = useState(0);
  const [otherLifestyle, setOtherLifestyle] = useState("");
  const [sleepHours, setSleepHours] = useState(0);
  const [meds, setMeds] = useState<CheckSet<(typeof MED_OPTS)[number]>>(() =>
    empty(MED_OPTS)
  );
  const [medOther, setMedOther] = useState("");
  const [pregnancy, setPregnancy] = useState<Pregnancy | "">("");
  const [memo, setMemo] = useState("");

  // OCR
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrNotice, setOcrNotice] = useState<{
    confidence: number;
    autoSaved: boolean;
    warnings: string[];
    mock?: boolean;
  } | null>(null);

  function fillFromOcr(d: ChartOcrData) {
    if (d.inflowChannels) {
      setChannels((c) => {
        const next = { ...c };
        for (const k of d.inflowChannels!) next[k] = true;
        return next;
      });
    }
    if (d.conditions) {
      setConditions((c) => {
        const next = { ...c };
        for (const k of d.conditions!) next[k] = true;
        return next;
      });
    }
    if (d.duration) setDuration(d.duration);
    if (d.careExperience) {
      setCareExp((c) => {
        const next = { ...c };
        for (const k of d.careExperience!) next[k] = true;
        return next;
      });
    }
    if (d.stress) setStress(d.stress);
    if (d.pain) setPain(d.pain);
    if (d.allergy) {
      setHasAllergy(d.allergy.has ? "yes" : "no");
      if (d.allergy.types) setAllergyTypes(d.allergy.types);
    }
    if (d.products) {
      setProducts((p) => {
        const next = { ...p };
        for (const k of d.products!) next[k] = true;
        return next;
      });
    }
    if (d.occupation) setOccupation(d.occupation);
    if (d.lifestyle) {
      if (d.lifestyle.hiking !== undefined) setHiking(!!d.lifestyle.hiking);
      if (d.lifestyle.golf !== undefined) setGolf(!!d.lifestyle.golf);
      if (d.lifestyle.soccer !== undefined) setSoccer(!!d.lifestyle.soccer);
      if (typeof d.lifestyle.alcohol === "number") setAlcohol(d.lifestyle.alcohol);
      if (typeof d.lifestyle.smoking === "number") setSmoking(d.lifestyle.smoking);
      if (d.lifestyle.other) setOtherLifestyle(d.lifestyle.other);
    }
    if (typeof d.sleepHours === "number") setSleepHours(d.sleepHours);
    if (d.medications) {
      setMeds((m) => {
        const next = { ...m };
        for (const k of d.medications!) next[k] = true;
        return next;
      });
    }
    if (d.pregnancy) setPregnancy(d.pregnancy);
    if (d.memo) setMemo(d.memo);
    if (typeof d.consent === "boolean") setConsent(d.consent);
  }

  async function onFilePicked(file: File) {
    setOcrLoading(true);
    setOcrNotice(null);
    try {
      const result = await ocrFromFile(file, "chart");
      if (result.classification !== "chart" && result.classification !== "unknown") {
        alert(
          `이 사진은 "${result.classification}"로 인식됐어요. 환자 차트로 다시 촬영해주세요.`
        );
        return;
      }
      if (result.data) fillFromOcr(result.data as ChartOcrData);
      setOcrNotice({
        confidence: result.confidence,
        autoSaved: result.confidence >= 0.95,
        warnings: result.warnings,
        mock: result.mock,
      });
    } catch (err) {
      alert(`OCR 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setOcrLoading(false);
    }
  }

  async function handleSave() {
    if (!centerId) {
      alert(centerError ?? "센터 정보를 불러오지 못했습니다.");
      return;
    }
    const selectedChannels = (
      Object.entries(channels) as [InflowChannel, boolean][]
    )
      .filter(([, v]) => v)
      .map(([k]) => k);

    if (!consent) {
      alert("개인정보 수집 동의가 필요합니다.");
      return;
    }

    setSaving(true);
    try {
      const data = await getDataSource();
      const patient = await data.patients.create({
        centerId,
        id: patientId,
        firstVisitDate: firstVisit,
        inflowChannels: selectedChannels,
        consent,
        personal: name || phone || birthDate || address
          ? {
              name: name || undefined,
              gender: gender || undefined,
              phone: phone || undefined,
              birthDate: birthDate || undefined,
              address: address || undefined,
            }
          : undefined,
        chart: {
          conditions: (Object.entries(conditions) as [ChartCondition, boolean][])
            .filter(([, v]) => v)
            .map(([k]) => k),
          duration: (duration || undefined) as
            | "lt6m"
            | "gt1y"
            | "gt3y"
            | "gt5y"
            | undefined,
          careExperience: (
            Object.entries(careExp) as [ChartCareExp, boolean][]
          )
            .filter(([, v]) => v)
            .map(([k]) => k),
          stress: stress || undefined,
          pain: pain || undefined,
          allergy:
            hasAllergy === "yes"
              ? { has: true, types: allergyTypes }
              : hasAllergy === "no"
              ? { has: false }
              : undefined,
          products: (Object.entries(products) as [string, boolean][])
            .filter(([, v]) => v)
            .map(([k]) => k) as ("antifungal" | "antifungal_tx" | "callus_moist" | "other")[],
          occupation: occupation || undefined,
          lifestyle: {
            hiking,
            golf,
            soccer,
            alcohol,
            smoking,
            other: otherLifestyle || undefined,
          },
          sleepHours: sleepHours || undefined,
          medications: (Object.entries(meds) as [string, boolean][])
            .filter(([, v]) => v)
            .map(([k]) => k) as ("anticancer" | "lipid" | "bp" | "diabetes" | "other")[],
          pregnancy: pregnancy || undefined,
          memo: memo || undefined,
        },
      });
      router.push(`/owner/patients/${patient.id}`);
    } catch (err) {
      alert(`저장 실패: ${err instanceof Error ? err.message : String(err)}`);
      setSaving(false);
    }
  }

  function handleOCR() {
    fileInputRef.current?.click();
  }

  return (
    <div className="min-h-screen bg-sand-50 pb-32">
      <header className="sticky top-0 z-10 border-b border-sand-200 bg-sand-50/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
          <Link href="/owner/patients" className="text-sand-600 hover:text-sand-800">
            ←
          </Link>
          <div className="text-sm font-semibold text-sand-800">신규 환자 등록</div>
          <div className="w-4" />
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-5 py-6">
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

        {/* OCR 버튼 */}
        <button
          type="button"
          onClick={handleOCR}
          disabled={ocrLoading}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-clay-500 px-5 py-4 text-white shadow-md transition hover:bg-clay-600 active:scale-[0.99] disabled:opacity-60"
        >
          <span className="text-2xl">{ocrLoading ? "⏳" : "📸"}</span>
          <div className="text-left">
            <div className="text-sm font-semibold">
              {ocrLoading ? "사진 분석 중..." : "차트 촬영해서 자동입력"}
            </div>
            <div className="text-xs text-white/80">
              {ocrLoading
                ? "Claude Vision 추출 중"
                : "방문경로/체크리스트 추출"}
            </div>
          </div>
        </button>

        {/* OCR 결과 알림 */}
        {ocrNotice && (
          <div
            className={`rounded-xl px-4 py-3 text-sm ${
              ocrNotice.autoSaved
                ? "bg-moss-500/10 text-moss-700"
                : "bg-clay-500/10 text-clay-700"
            }`}
          >
            <div className="font-semibold">
              {ocrNotice.autoSaved ? "✓ 자동 추출 완료" : "⚠️ 확인 필요"}
              <span className="ml-2 text-xs font-normal">
                신뢰도 {Math.round(ocrNotice.confidence * 100)}%
                {ocrNotice.mock && " · Mock"}
              </span>
            </div>
            {ocrNotice.warnings.length > 0 && (
              <ul className="mt-1 text-xs">
                {ocrNotice.warnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-xs">
              아래 필드 확인 후 필요 시 수정하고 저장하세요.
            </p>
          </div>
        )}

        {/* 환자번호 + 첫 방문일 */}
        <Card>
          <CardBody>
            <label className="block text-xs uppercase tracking-wider text-sand-500">
              환자번호 (자동발급)
            </label>
            <input
              type="text"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-sand-200 bg-white px-3 py-2 font-mono text-sm tabular focus:border-clay-400 focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-sand-500">
              형식: C[센터순번]-[YYMM]-[일련4자리] · 수정 가능
            </p>
            <label className="mt-3 block text-xs uppercase tracking-wider text-sand-500">
              최초 방문일
            </label>
            <input
              type="date"
              value={firstVisit}
              onChange={(e) => setFirstVisit(e.target.value)}
              className="mt-1 w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
            />
          </CardBody>
        </Card>

        {/* 개인정보 (원장 영역) */}
        <Card>
          <CardHeader>
            <CardTitle>개인정보 (원장 영역)</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <Row label="성함">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
              />
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as "male" | "female" | "")}
                className="rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">성별</option>
                <option value="male">남</option>
                <option value="female">여</option>
              </select>
            </Row>
            <Row label="연락처">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                className="flex-1 rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
              />
            </Row>
            <Row label="생년월일">
              <input
                type="date"
                value={birthDate}
                min="1900-01-01"
                max={todayKST()}
                onChange={(e) => setBirthDate(e.target.value)}
                className="flex-1 rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
              />
            </Row>
            <Row label="주소">
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="flex-1 rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
              />
            </Row>
            <label className="flex items-center gap-2 text-xs text-sand-700">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="accent-clay-500"
              />
              개인정보 수집 및 이용에 동의함
            </label>
          </CardBody>
        </Card>

        {/* 방문 경로 */}
        <Card>
          <CardHeader>
            <CardTitle>방문 경로 (복수 선택)</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-2">
              {INFLOW_CHANNELS.map((ch) => (
                <CheckPill
                  key={ch.id}
                  label={ch.label}
                  checked={channels[ch.id]}
                  onChange={(v) => setChannels({ ...channels, [ch.id]: v })}
                />
              ))}
            </div>
            {channels.other && (
              <input
                value={otherChannel}
                onChange={(e) => setOtherChannel(e.target.value)}
                placeholder="기타 — 직접 입력"
                className="mt-2 w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
              />
            )}
          </CardBody>
        </Card>

        {/* 고객 체크리스트 */}
        <Card>
          <CardHeader>
            <CardTitle>고객 체크리스트</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <Label>상태</Label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {CONDITION_OPTS.map((c) => (
                  <CheckPill
                    key={c}
                    label={CONDITION_LABELS[c]}
                    checked={conditions[c]}
                    onChange={(v) => setConditions({ ...conditions, [c]: v })}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label>진행 기간</Label>
              <div className="mt-1.5 grid grid-cols-4 gap-2">
                {[
                  { v: "lt6m", l: "6개월 미만" },
                  { v: "gt1y", l: "1년 이상" },
                  { v: "gt3y", l: "3년 이상" },
                  { v: "gt5y", l: "5년 이상" },
                ].map((o) => (
                  <RadioPill
                    key={o.v}
                    label={o.l}
                    selected={duration === o.v}
                    onClick={() => setDuration(duration === o.v ? "" : o.v)}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label>관리 경험</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {CARE_OPTS.map((c) => (
                  <CheckPill
                    key={c}
                    label={CARE_LABELS[c]}
                    checked={careExp[c]}
                    onChange={(v) => setCareExp({ ...careExp, [c]: v })}
                  />
                ))}
              </div>
              {careExp.other && (
                <input
                  value={careExpOther}
                  onChange={(e) => setCareExpOther(e.target.value)}
                  placeholder="관리 경험 — 직접 입력"
                  className="mt-2 w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
                />
              )}
            </div>

            <SeverityRow label="스트레스" value={stress} onChange={setStress} />
            <SeverityRow label="통증여부" value={pain} onChange={setPain} />

            <div>
              <Label>알레르기 질환</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <RadioPill
                  label="예"
                  selected={hasAllergy === "yes"}
                  onClick={() => setHasAllergy(hasAllergy === "yes" ? "" : "yes")}
                />
                <RadioPill
                  label="아니오"
                  selected={hasAllergy === "no"}
                  onClick={() => setHasAllergy(hasAllergy === "no" ? "" : "no")}
                />
              </div>
              {hasAllergy === "yes" && (
                <input
                  value={allergyTypes}
                  onChange={(e) => setAllergyTypes(e.target.value)}
                  placeholder="알레르기 종류"
                  className="mt-2 w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
                />
              )}
            </div>

            <div>
              <Label>사용중인 제품</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {PRODUCT_OPTS.map((p) => (
                  <CheckPill
                    key={p}
                    label={PRODUCT_LABELS[p]}
                    checked={products[p]}
                    onChange={(v) => setProducts({ ...products, [p]: v })}
                  />
                ))}
              </div>
            </div>

            <Row label="직업">
              <input
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                className="flex-1 rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
              />
            </Row>

            <div>
              <Label>생활 습관</Label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                <CheckPill label="등산" checked={hiking} onChange={setHiking} />
                <CheckPill label="골프" checked={golf} onChange={setGolf} />
                <CheckPill label="축구" checked={soccer} onChange={setSoccer} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <NumberRow
                  label="음주 (주)"
                  value={alcohol}
                  onChange={setAlcohol}
                  suffix="회"
                />
                <NumberRow
                  label="담배 (하루)"
                  value={smoking}
                  onChange={setSmoking}
                  suffix="개피"
                />
              </div>
              <input
                value={otherLifestyle}
                onChange={(e) => setOtherLifestyle(e.target.value)}
                placeholder="기타 생활습관"
                className="mt-2 w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
              />
            </div>

            <NumberRow
              label="수면 시간"
              value={sleepHours}
              onChange={setSleepHours}
              suffix="시간"
            />

            <div>
              <Label>약물 복용</Label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {MED_OPTS.map((m) => (
                  <CheckPill
                    key={m}
                    label={MED_LABELS[m]}
                    checked={meds[m]}
                    onChange={(v) => setMeds({ ...meds, [m]: v })}
                  />
                ))}
              </div>
              {meds.other && (
                <input
                  value={medOther}
                  onChange={(e) => setMedOther(e.target.value)}
                  placeholder="기타 약물"
                  className="mt-2 w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
                />
              )}
            </div>

            <div>
              <Label>임신 여부</Label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {[
                  { v: "no", l: "비임신" },
                  { v: "planning", l: "임신 준비 중" },
                  { v: "yes", l: "임신 중" },
                ].map((o) => (
                  <RadioPill
                    key={o.v}
                    label={o.l}
                    selected={pregnancy === o.v}
                    onClick={() =>
                      setPregnancy(pregnancy === o.v ? "" : (o.v as Pregnancy))
                    }
                  />
                ))}
              </div>
            </div>

            <div>
              <Label>메모</Label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={3}
                className="mt-1.5 w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
              />
            </div>
          </CardBody>
        </Card>

        <p className="px-1 text-[11px] text-sand-500">
          모든 항목은 차트 OCR로 자동입력 후 수정 가능합니다. 개인정보는 원장(센터)
          영역에만 저장되며 법인 정산 데이터와 분리됩니다.
        </p>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !centerLoaded}
          className="w-full rounded-2xl bg-sand-800 px-5 py-4 text-base font-semibold text-white shadow-md transition hover:bg-sand-900 active:scale-[0.99] disabled:opacity-60"
        >
          {saving ? "저장 중..." : centerLoaded ? "환자 등록" : "센터 확인 중..."}
        </button>
      </div>
    </div>
  );
}

// ============ UI helpers ============
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5 flex gap-2">{children}</div>
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-medium uppercase tracking-wider text-sand-600">
      {children}
    </div>
  );
}
function CheckPill({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
        checked
          ? "border-clay-500 bg-clay-500/10 text-clay-700"
          : "border-sand-200 bg-white text-sand-700 hover:border-sand-300"
      }`}
    >
      {label}
    </button>
  );
}
function RadioPill({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
        selected
          ? "border-moss-500 bg-moss-500/10 text-moss-700"
          : "border-sand-200 bg-white text-sand-700 hover:border-sand-300"
      }`}
    >
      {label}
    </button>
  );
}
function SeverityRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Severity | "";
  onChange: (v: Severity | "") => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        {(["high", "mid", "low"] as Severity[]).map((s) => (
          <RadioPill
            key={s}
            label={s === "high" ? "상" : s === "mid" ? "중" : "하"}
            selected={value === s}
            onClick={() => onChange(value === s ? "" : s)}
          />
        ))}
      </div>
    </div>
  );
}
function NumberRow({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={value || ""}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="w-24 rounded-lg border border-sand-200 bg-white px-3 py-2 text-right text-sm tabular focus:border-clay-400 focus:outline-none"
        />
        {suffix && <span className="text-xs text-sand-500">{suffix}</span>}
      </div>
    </div>
  );
}
