"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDataSource } from "@/lib/data";
import { fmtDate, fmtWon } from "@/lib/format";
import {
  INFLOW_CHANNELS,
  PARTS,
  PATIENT_TAGS,
  type Patient,
  type PatientTag,
  type Visit,
} from "@/lib/types";

export default function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function handleToggleTag(tag: PatientTag) {
    if (!patient) return;
    const current = patient.tags ?? [];
    const next = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    try {
      const data = await getDataSource();
      const updated = await data.patients.update(patient.id, { tags: next });
      setPatient(updated);
    } catch (err) {
      alert(`태그 저장 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getDataSource();
      const p = await data.patients.get(id);
      const vs = p ? await data.visits.listByPatient(id) : [];
      if (!cancelled) {
        setPatient(p);
        setVisits(vs);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!loaded) {
    return (
      <div className="mx-auto max-w-md p-6 text-center text-sm text-sand-500">
        로딩 중...
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-sand-50 pb-20">
        <header className="sticky top-0 z-10 border-b border-sand-200 bg-sand-50/80 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
            <Link
              href="/owner/patients"
              className="text-sand-600 hover:text-sand-800"
            >
              ←
            </Link>
            <div className="text-sm font-semibold text-sand-800">환자 상세</div>
            <div className="w-4" />
          </div>
        </header>
        <div className="mx-auto max-w-md p-6 text-center text-sm text-sand-500">
          환자를 찾을 수 없습니다.
        </div>
      </div>
    );
  }

  const channelLabel = (c: string) =>
    INFLOW_CHANNELS.find((x) => x.id === c)?.label ?? c;
  const partLabel = (id: string) => PARTS.find((p) => p.id === id)?.label ?? id;

  return (
    <div className="min-h-screen bg-sand-50 pb-20">
      <header className="sticky top-0 z-10 border-b border-sand-200 bg-sand-50/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
          <Link
            href="/owner/patients"
            className="text-sand-600 hover:text-sand-800"
          >
            ←
          </Link>
          <div className="text-sm font-semibold text-sand-800">환자 상세</div>
          <div className="w-4" />
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-5 py-6">
        {/* 환자 헤더 */}
        <Card>
          <CardBody>
            <div className="text-xs font-mono tabular text-sand-500">
              {patient.id}
            </div>
            <div className="mt-1 text-xl font-bold text-sand-900">
              {patient.personal?.name ?? "(이름 미입력)"}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {patient.inflowChannels.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-clay-500/10 px-2 py-0.5 text-[11px] font-medium text-clay-700"
                >
                  {channelLabel(c)}
                </span>
              ))}
              {patient.tags?.map((t) => {
                const tag = PATIENT_TAGS.find((x) => x.id === t);
                if (!tag) return null;
                return (
                  <span
                    key={t}
                    className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.label}
                  </span>
                );
              })}
            </div>

            {/* 빠른 액션 — 전화/SMS (모바일에서 작동) */}
            {patient.personal?.phone && (
              <div className="mt-3 flex gap-2 border-t border-sand-200 pt-3">
                <a
                  href={`tel:${patient.personal.phone}`}
                  className="flex-1 rounded-lg bg-moss-500 px-3 py-2 text-center text-xs font-medium text-white hover:bg-moss-600"
                >
                  📞 전화
                </a>
                <a
                  href={`sms:${patient.personal.phone}?body=${encodeURIComponent(
                    `${patient.personal.name ?? "고객"}님 안녕하세요.\n\n`
                  )}`}
                  className="flex-1 rounded-lg bg-clay-500 px-3 py-2 text-center text-xs font-medium text-white hover:bg-clay-600"
                >
                  💬 문자
                </a>
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-sand-200 pt-3 text-xs">
              <div>
                <div className="uppercase text-sand-500">최초 방문</div>
                <div className="font-semibold text-sand-800">
                  {fmtDate(patient.firstVisitDate)}
                </div>
              </div>
              <div>
                <div className="uppercase text-sand-500">총 방문</div>
                <div className="font-semibold text-clay-600 tabular">
                  {visits.length}회
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* CRM 통계 */}
        {(() => {
          const totalRevenue = visits.reduce(
            (s, v) =>
              s + v.sales.reduce((a, l) => a + l.cash + l.card, 0),
            0
          );
          const avgTicket =
            visits.length > 0 ? Math.round(totalRevenue / visits.length) : 0;
          const lastVisit = visits[0];
          const daysSince = lastVisit
            ? Math.floor(
                (Date.now() - new Date(lastVisit.visitDate).getTime()) /
                  86400000
              )
            : null;

          return (
            <div className="grid grid-cols-3 gap-2">
              <Card>
                <CardBody className="text-center">
                  <div className="text-[10px] uppercase text-sand-500">
                    총 매출
                  </div>
                  <div className="mt-0.5 text-sm font-bold tabular text-clay-600">
                    {fmtWon(totalRevenue)}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="text-center">
                  <div className="text-[10px] uppercase text-sand-500">
                    평균 객단가
                  </div>
                  <div className="mt-0.5 text-sm font-bold tabular text-sand-800">
                    {fmtWon(avgTicket)}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="text-center">
                  <div className="text-[10px] uppercase text-sand-500">
                    마지막 방문
                  </div>
                  <div
                    className={`mt-0.5 text-sm font-bold tabular ${
                      daysSince !== null && daysSince >= 30
                        ? "text-clay-700"
                        : "text-sand-800"
                    }`}
                  >
                    {daysSince === null
                      ? "—"
                      : daysSince === 0
                      ? "오늘"
                      : `${daysSince}일 전`}
                  </div>
                </CardBody>
              </Card>
            </div>
          );
        })()}

        {/* 환자 태그 */}
        <Card>
          <CardHeader>
            <CardTitle>태그</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {PATIENT_TAGS.map((tag) => {
                const on = patient.tags?.includes(tag.id) ?? false;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleToggleTag(tag.id)}
                    className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
                    style={{
                      borderColor: on ? tag.color : "#E8DDC8",
                      background: on ? tag.color : "#FFFFFF",
                      color: on ? "#FFFFFF" : "#6E5C42",
                    }}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-sand-500">
              VIP / 주의 / 장기관리 등 환자별 라벨. 목록에서 필터 가능.
            </p>
          </CardBody>
        </Card>

        {/* CRM — 카톡 메시지 템플릿 */}
        <MessageTemplates patient={patient} />

        {/* 새 방문 차트 작성 + 차트 수정 */}
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Link
            href={`/owner/patients/${patient.id}/visit`}
            className="flex items-center justify-center gap-2 rounded-2xl bg-clay-500 px-5 py-4 text-white shadow-md transition hover:bg-clay-600"
          >
            <span className="text-lg">＋</span>
            <span className="text-sm font-semibold">이번 방문 차트 작성</span>
          </Link>
          <Link
            href={`/owner/patients/${patient.id}/edit`}
            className="flex items-center justify-center rounded-2xl border border-sand-300 bg-white px-4 py-4 text-sm font-medium text-sand-700 hover:border-clay-400"
            aria-label="차트 수정"
          >
            ✎
          </Link>
        </div>

        {/* 방문 이력 */}
        <Card>
          <CardHeader>
            <CardTitle>방문 이력</CardTitle>
          </CardHeader>
          <CardBody>
            {visits.length === 0 ? (
              <div className="py-6 text-center text-sm text-sand-500">
                아직 방문 기록이 없습니다.
              </div>
            ) : (
              <div className="space-y-2">
                {visits.map((v) => {
                  const cash = v.sales.reduce((s, l) => s + l.cash, 0);
                  const card = v.sales.reduce((s, l) => s + l.card, 0);
                  return (
                    <div
                      key={v.id}
                      className="rounded-lg bg-sand-100/60 px-3 py-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-sand-800">
                          {fmtDate(v.visitDate)}
                          <span className="ml-2 rounded bg-sand-200 px-1.5 py-0.5 text-[10px] font-medium text-sand-700">
                            {partLabel(v.partId)}
                          </span>
                        </div>
                        <div className="text-right text-xs tabular">
                          <div className="font-bold text-clay-600">
                            {fmtWon(cash + card)}
                          </div>
                          <div className="text-[10px] text-sand-500">
                            현 {fmtWon(cash)} · 카 {fmtWon(card)}
                          </div>
                        </div>
                      </div>
                      {v.sales.length > 0 && (
                        <div className="mt-1 text-xs text-sand-700">
                          {v.sales.map((s) => s.serviceName).join(", ")}
                        </div>
                      )}
                      {v.visitMemo && (
                        <div className="mt-1 text-[11px] text-sand-500">
                          {v.visitMemo}
                        </div>
                      )}
                      {(v.beforePhotoUrl || v.afterPhotoUrl) && (
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          {v.beforePhotoUrl && (
                            <a
                              href={v.beforePhotoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="relative block aspect-square overflow-hidden rounded-md"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={v.beforePhotoUrl}
                                alt="Before"
                                className="h-full w-full object-cover"
                              />
                              <span className="absolute left-1 top-1 rounded bg-black/50 px-1 py-0.5 text-[9px] text-white">
                                Before
                              </span>
                            </a>
                          )}
                          {v.afterPhotoUrl && (
                            <a
                              href={v.afterPhotoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="relative block aspect-square overflow-hidden rounded-md"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={v.afterPhotoUrl}
                                alt="After"
                                className="h-full w-full object-cover"
                              />
                              <span className="absolute left-1 top-1 rounded bg-black/50 px-1 py-0.5 text-[9px] text-white">
                                After
                              </span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        {/* 개인정보 (원장 영역) */}
        {patient.personal && (
          <Card>
            <CardHeader>
              <CardTitle>개인정보 (원장 영역)</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="space-y-1.5 text-sm">
                {patient.personal.gender && (
                  <Field
                    label="성별"
                    value={patient.personal.gender === "male" ? "남" : "여"}
                  />
                )}
                {patient.personal.phone && (
                  <Field label="연락처" value={patient.personal.phone} />
                )}
                {patient.personal.birthDate && (
                  <Field label="생년월일" value={patient.personal.birthDate} />
                )}
                {patient.personal.address && (
                  <Field label="주소" value={patient.personal.address} />
                )}
              </dl>
            </CardBody>
          </Card>
        )}

        {/* 의료 차트 */}
        {patient.chart && hasChartData(patient.chart) && (
          <Card>
            <CardHeader>
              <CardTitle>의료 차트</CardTitle>
            </CardHeader>
            <CardBody>
              <ChartView chart={patient.chart} />
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-sand-500">{label}</dt>
      <dd className="font-medium text-sand-800">{value}</dd>
    </div>
  );
}

function MessageTemplates({ patient }: { patient: Patient }) {
  const name = patient.personal?.name ?? "고객";
  const templates = [
    {
      key: "reminder",
      label: "재방문 안내",
      body: `안녕하세요 ${name}님,
오랜만에 인사드립니다. 마지막 방문 이후 시간이 좀 지났네요.
컨디션 점검 차원에서 한 번 들러주시면 좋을 것 같습니다.
편하신 시간 알려주세요. 감사합니다.`,
    },
    {
      key: "thanks",
      label: "감사 메시지",
      body: `안녕하세요 ${name}님,
오늘 방문해 주셔서 감사합니다.
처치 후 변화나 불편하신 점 있으면 언제든 연락주세요.`,
    },
    {
      key: "appointment",
      label: "예약 확인",
      body: `${name}님 안녕하세요.
예약 확인 안내드립니다.

📅 일시: (날짜/시간 입력)
📍 장소: (지점명 입력)

부득이한 변경 시 전날까지 알려주시면 감사하겠습니다.`,
    },
    {
      key: "review",
      label: "리뷰 요청",
      body: `${name}님 안녕하세요.
오늘 시술 만족스러우셨길 바랍니다.
가능하시면 네이버 플레이스 / 인스타그램에
짧은 후기 남겨주시면 큰 힘이 됩니다.
[링크 첨부]
감사합니다.`,
    },
  ];

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      alert(`'${label}' 문자가 복사되었습니다. 카톡/문자에 붙여넣으세요.`);
    } catch {
      prompt("문자 (수동 복사):", text);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>카톡 / 문자 템플릿</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-2 gap-2">
          {templates.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => copy(t.body, t.label)}
              className="rounded-lg border border-sand-200 bg-white px-3 py-2.5 text-xs font-medium text-sand-700 transition hover:border-clay-400"
            >
              📋 {t.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-sand-500">
          버튼 클릭 → 클립보드에 자동 복사. 카톡/문자 앱에 붙여넣어 전송하세요.
          내용은 필요에 따라 수정하셔도 됩니다.
        </p>
      </CardBody>
    </Card>
  );
}

const CONDITION_LABEL: Record<string, string> = {
  toenail_fungus: "발톱 무좀",
  ingrown_nail: "파고드는 발톱",
  callus: "발각질",
};
const DURATION_LABEL: Record<string, string> = {
  lt6m: "6개월 미만",
  gt1y: "1년 이상",
  gt3y: "3년 이상",
  gt5y: "5년 이상",
};
const CARE_LABEL: Record<string, string> = {
  hospital: "병원(약물/레이저)",
  oriental: "한의원",
  nailshop: "네일샵",
  footcare: "발관리 전문샵",
  other: "기타",
};
const SEV_LABEL: Record<string, string> = { high: "상", mid: "중", low: "하" };
const PRODUCT_LABEL: Record<string, string> = {
  antifungal: "무좀 소독제",
  antifungal_tx: "무좀 치료제",
  callus_moist: "발각질 보습제",
  other: "기타",
};
const MED_LABEL: Record<string, string> = {
  anticancer: "항암",
  lipid: "고지혈증",
  bp: "혈압",
  diabetes: "당뇨",
  other: "기타",
};
const PREG_LABEL: Record<string, string> = {
  no: "비임신",
  planning: "임신 준비 중",
  yes: "임신 중",
};

function hasChartData(c: NonNullable<typeof MOCK_TYPE_CHART>): boolean {
  return Boolean(
    c.conditions?.length ||
      c.duration ||
      c.careExperience?.length ||
      c.stress ||
      c.pain ||
      c.allergy ||
      c.products?.length ||
      c.occupation ||
      (c.lifestyle &&
        (c.lifestyle.hiking ||
          c.lifestyle.golf ||
          c.lifestyle.soccer ||
          c.lifestyle.alcohol ||
          c.lifestyle.smoking ||
          c.lifestyle.other)) ||
      c.sleepHours ||
      c.medications?.length ||
      c.pregnancy ||
      c.memo
  );
}

// 차트 표시용 헬퍼 타입 — Patient["chart"] 의 NonNull 형태
const MOCK_TYPE_CHART = null as unknown as NonNullable<
  import("@/lib/types").Patient["chart"]
>;

function ChartView({ chart }: { chart: NonNullable<typeof MOCK_TYPE_CHART> }) {
  const rows: { label: string; value: string }[] = [];

  if (chart.conditions?.length) {
    rows.push({
      label: "상태",
      value: chart.conditions.map((c) => CONDITION_LABEL[c] ?? c).join(", "),
    });
  }
  if (chart.duration) {
    rows.push({ label: "진행 기간", value: DURATION_LABEL[chart.duration] ?? chart.duration });
  }
  if (chart.careExperience?.length) {
    rows.push({
      label: "관리 경험",
      value: chart.careExperience.map((c) => CARE_LABEL[c] ?? c).join(", "),
    });
  }
  if (chart.stress) rows.push({ label: "스트레스", value: SEV_LABEL[chart.stress] });
  if (chart.pain) rows.push({ label: "통증", value: SEV_LABEL[chart.pain] });
  if (chart.allergy) {
    rows.push({
      label: "알레르기",
      value: chart.allergy.has
        ? chart.allergy.types
          ? `있음 — ${chart.allergy.types}`
          : "있음"
        : "없음",
    });
  }
  if (chart.products?.length) {
    rows.push({
      label: "사용 제품",
      value: chart.products.map((p) => PRODUCT_LABEL[p] ?? p).join(", "),
    });
  }
  if (chart.occupation) rows.push({ label: "직업", value: chart.occupation });

  const ls = chart.lifestyle;
  if (ls) {
    const parts: string[] = [];
    if (ls.hiking) parts.push("등산");
    if (ls.golf) parts.push("골프");
    if (ls.soccer) parts.push("축구");
    if (ls.alcohol) parts.push(`음주 주 ${ls.alcohol}회`);
    if (ls.smoking) parts.push(`담배 하루 ${ls.smoking}개피`);
    if (ls.other) parts.push(ls.other);
    if (parts.length > 0) rows.push({ label: "생활 습관", value: parts.join(", ") });
  }

  if (chart.sleepHours) {
    rows.push({ label: "수면 시간", value: `${chart.sleepHours} 시간` });
  }
  if (chart.medications?.length) {
    rows.push({
      label: "약물 복용",
      value: chart.medications.map((m) => MED_LABEL[m] ?? m).join(", "),
    });
  }
  if (chart.pregnancy) {
    rows.push({ label: "임신 여부", value: PREG_LABEL[chart.pregnancy] });
  }

  return (
    <div className="space-y-3 text-sm">
      <dl className="space-y-1.5">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"
          >
            <dt className="text-xs uppercase tracking-wider text-sand-500">
              {r.label}
            </dt>
            <dd className="font-medium text-sand-800">{r.value}</dd>
          </div>
        ))}
      </dl>
      {chart.memo && (
        <div className="rounded-lg bg-sand-100/60 px-3 py-2 text-xs text-sand-700">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-sand-500">
            메모
          </div>
          {chart.memo}
        </div>
      )}
    </div>
  );
}
