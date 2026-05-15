"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDataSource } from "@/lib/data";
import {
  INFLOW_CHANNELS,
  type ChartCareExp,
  type ChartCondition,
  type InflowChannel,
  type Patient,
  type Pregnancy,
  type Severity,
} from "@/lib/types";

// 환자 차트 — 전체 수정 페이지

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
const PRODUCT_OPTS = [
  "antifungal",
  "antifungal_tx",
  "callus_moist",
  "other",
] as const;
const PRODUCT_LABELS: Record<(typeof PRODUCT_OPTS)[number], string> = {
  antifungal: "무좀 소독제",
  antifungal_tx: "무좀 치료제",
  callus_moist: "발각질 보습제",
  other: "기타",
};
const MED_OPTS = [
  "anticancer",
  "lipid",
  "bp",
  "diabetes",
  "other",
] as const;
const MED_LABELS: Record<(typeof MED_OPTS)[number], string> = {
  anticancer: "항암",
  lipid: "고지혈증",
  bp: "혈압",
  diabetes: "당뇨",
  other: "기타",
};

export default function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // 개인정보
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [address, setAddress] = useState("");
  const [consent, setConsent] = useState(true);

  // 방문 경로
  const [channels, setChannels] = useState<CheckSet<InflowChannel>>(() =>
    empty(INFLOW_CHANNELS.map((c) => c.id))
  );

  // 체크리스트
  const [conditions, setConditions] = useState<CheckSet<ChartCondition>>(() =>
    empty(CONDITION_OPTS)
  );
  const [duration, setDuration] = useState<string>("");
  const [careExp, setCareExp] = useState<CheckSet<ChartCareExp>>(() =>
    empty(CARE_OPTS)
  );
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
  const [pregnancy, setPregnancy] = useState<Pregnancy | "">("");
  const [memo, setMemo] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getDataSource();
      const p = await data.patients.get(id);
      if (cancelled) return;
      if (p) {
        setPatient(p);
        // 개인정보
        setName(p.personal?.name ?? "");
        setGender((p.personal?.gender as "male" | "female" | "") ?? "");
        setPhone(p.personal?.phone ?? "");
        setBirthDate(p.personal?.birthDate ?? "");
        setAddress(p.personal?.address ?? "");
        setConsent(p.consent);

        // 방문 경로
        const ch = empty(INFLOW_CHANNELS.map((c) => c.id));
        for (const k of p.inflowChannels) ch[k] = true;
        setChannels(ch);

        // 차트
        const c = p.chart;
        if (c) {
          const cd = empty(CONDITION_OPTS);
          for (const k of c.conditions ?? []) cd[k] = true;
          setConditions(cd);
          setDuration(c.duration ?? "");
          const ce = empty(CARE_OPTS);
          for (const k of c.careExperience ?? []) ce[k] = true;
          setCareExp(ce);
          setStress(c.stress ?? "");
          setPain(c.pain ?? "");
          if (c.allergy) {
            setHasAllergy(c.allergy.has ? "yes" : "no");
            setAllergyTypes(c.allergy.types ?? "");
          }
          const pr = empty(PRODUCT_OPTS);
          for (const k of c.products ?? []) pr[k] = true;
          setProducts(pr);
          setOccupation(c.occupation ?? "");
          setHiking(!!c.lifestyle?.hiking);
          setGolf(!!c.lifestyle?.golf);
          setSoccer(!!c.lifestyle?.soccer);
          setAlcohol(c.lifestyle?.alcohol ?? 0);
          setSmoking(c.lifestyle?.smoking ?? 0);
          setOtherLifestyle(c.lifestyle?.other ?? "");
          setSleepHours(c.sleepHours ?? 0);
          const md = empty(MED_OPTS);
          for (const k of c.medications ?? []) md[k] = true;
          setMeds(md);
          setPregnancy(c.pregnancy ?? "");
          setMemo(c.memo ?? "");
        }
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSave() {
    if (!patient) return;
    setSaving(true);
    try {
      const data = await getDataSource();
      const selectedChannels = (
        Object.entries(channels) as [InflowChannel, boolean][]
      )
        .filter(([, v]) => v)
        .map(([k]) => k);
      await data.patients.update(patient.id, {
        consent,
        inflowChannels: selectedChannels,
        personal:
          name || phone || birthDate || address
            ? {
                name: name || undefined,
                gender: gender || undefined,
                phone: phone || undefined,
                birthDate: birthDate || undefined,
                address: address || undefined,
              }
            : undefined,
        chart: {
          conditions: (
            Object.entries(conditions) as [ChartCondition, boolean][]
          )
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
            .map(([k]) => k) as (typeof PRODUCT_OPTS)[number][],
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
            .map(([k]) => k) as (typeof MED_OPTS)[number][],
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

  if (!loaded) {
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
          <div className="text-sm font-semibold text-sand-800">차트 수정</div>
          <div className="w-4" />
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-5 py-6">
        <Card>
          <CardBody>
            <div className="text-xs font-mono tabular text-sand-500">
              {patient.id}
            </div>
            <div className="mt-0.5 text-lg font-semibold text-sand-800">
              {patient.personal?.name ?? "(이름 미입력)"}
            </div>
          </CardBody>
        </Card>

        {/* 개인정보 */}
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
                onChange={(e) =>
                  setGender(e.target.value as "male" | "female" | "")
                }
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
            <CardTitle>방문 경로</CardTitle>
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

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-2xl bg-sand-800 px-5 py-4 text-base font-semibold text-white shadow-md transition hover:bg-sand-900 disabled:opacity-60"
        >
          {saving ? "저장 중..." : "수정 저장"}
        </button>
      </div>
    </div>
  );
}

// ─── UI helpers ───
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
