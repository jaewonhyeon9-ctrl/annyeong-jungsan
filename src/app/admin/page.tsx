"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart, type BarDatum } from "@/components/charts/BarChart";
import { DonutChart, type DonutSlice } from "@/components/charts/DonutChart";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { getDataSource } from "@/lib/data";
import { exportSettlementExcel } from "@/lib/excel";
import {
  fmtDate,
  fmtMonth,
  fmtWon,
  lastNMonths,
  thisMonthKST,
} from "@/lib/format";
import { computeSettlement } from "@/lib/settlement";
import {
  DEFAULT_RULE,
  INFLOW_CHANNELS,
  PARTS,
  type Center,
  type DailyEntry,
  type InflowEntry,
  type PartId,
} from "@/lib/types";

export default function AdminDashboard() {
  const [month, setMonth] = useState(thisMonthKST());
  const [centers, setCenters] = useState<Center[]>([]);
  const [centerId, setCenterId] = useState<string>("");
  const [rule, setRule] = useState(DEFAULT_RULE);

  const [monthEntries, setMonthEntries] = useState<DailyEntry[]>([]);
  const [inflow, setInflow] = useState<InflowEntry | null>(null);

  // 트렌드 / 환자 통계
  const [trend, setTrend] = useState<{ month: string; total: number }[]>([]);
  const [patientStats, setPatientStats] = useState<{
    total: number;
    newThisMonth: number;
    repeat: number;
    avgTicket: number;
  } | null>(null);

  // 센터 목록 — 1번만
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getDataSource();
      const cs = await data.centers.list();
      if (!cancelled) {
        setCenters(cs);
        if (cs.length > 0 && !centerId) setCenterId(cs[0].id);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 월/센터 바뀔 때마다 entries + inflow 다시 로드
  useEffect(() => {
    if (!centerId) return;
    let cancelled = false;
    (async () => {
      const data = await getDataSource();
      const [es, inf] = await Promise.all([
        data.entries.byMonth(centerId, month),
        data.inflows.byMonth(centerId, month),
      ]);
      if (!cancelled) {
        setMonthEntries(es);
        setInflow(inf);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [centerId, month]);

  // 최근 6개월 트렌드 + 환자 통계
  useEffect(() => {
    if (!centerId) return;
    let cancelled = false;
    (async () => {
      const data = await getDataSource();

      // 6개월 (현재 포함, 과거 5개월)
      const months = lastNMonths(month, 6);
      const monthly = await Promise.all(
        months.map(async (m) => {
          const es = await data.entries.byMonth(centerId, m);
          const total = es.reduce(
            (s, e) => s + e.sales.reduce((a, l) => a + l.cash + l.card, 0),
            0
          );
          return { month: m, total };
        })
      );

      // 환자 통계
      const patients = await data.patients.list(centerId);
      const newThis = patients.filter((p) =>
        p.firstVisitDate.startsWith(month)
      ).length;
      const visitCounts = await Promise.all(
        patients.map((p) =>
          data.visits.listByPatient(p.id).then((vs) => vs.length)
        )
      );
      const repeat = visitCounts.filter((c) => c >= 2).length;
      const totalVisits = visitCounts.reduce((a, b) => a + b, 0);
      const thisMonthTotal =
        monthly.find((m) => m.month === month)?.total ?? 0;
      const avgTicket = totalVisits > 0 ? thisMonthTotal / Math.max(1, visitCounts.filter((c) => c > 0).length) : 0;

      if (!cancelled) {
        setTrend(monthly);
        setPatientStats({
          total: patients.length,
          newThisMonth: newThis,
          repeat,
          avgTicket,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [centerId, month]);

  // 정산 룰 — localStorage 영구 저장 (센터별)
  useEffect(() => {
    if (!centerId) return;
    try {
      const stored = localStorage.getItem(`settlement-rule-${centerId}`);
      if (stored) {
        setRule(JSON.parse(stored));
      } else {
        setRule(DEFAULT_RULE);
      }
    } catch {
      // localStorage 사용 불가 — 기본값 유지
    }
  }, [centerId]);

  function updateRule(next: typeof rule) {
    setRule(next);
    if (!centerId) return;
    try {
      localStorage.setItem(`settlement-rule-${centerId}`, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  const settlement = useMemo(
    () => computeSettlement(monthEntries, rule),
    [monthEntries, rule]
  );

  const partLabel = (id: PartId) => PARTS.find((p) => p.id === id)?.label ?? id;

  // 일자별 매출 — BarChart 데이터
  const dailyData: BarDatum[] = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const e of monthEntries) {
      const total = e.sales.reduce((s, l) => s + l.cash + l.card, 0);
      byDate.set(e.date, (byDate.get(e.date) ?? 0) + total);
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({
        label: date.slice(8, 10), // DD
        value,
      }));
  }, [monthEntries]);

  // 파트별 비중 — DonutChart 데이터
  const partColors: Record<PartId, string> = {
    scalp: "#A26F54",
    permanent_makeup: "#C28B6E",
    smp: "#71875E",
    pedicure: "#D9C7A6",
    skincare: "#8FA37A",
  };
  const donutSlices: DonutSlice[] = useMemo(
    () =>
      settlement.partBreakdown
        .filter((p) => p.total > 0)
        .map((p) => ({
          label: partLabel(p.partId),
          value: p.total,
          color: partColors[p.partId],
        })),
    [settlement.partBreakdown]
  );

  return (
    <div className="space-y-6">
      {/* 필터바 */}
      <Card>
        <CardBody className="flex flex-wrap items-center gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-sand-500">센터</div>
            <select
              value={centerId}
              onChange={(e) => setCenterId(e.target.value)}
              className="mt-1 rounded-lg border border-sand-200 bg-white px-3 py-1.5 text-sm"
            >
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-sand-500">월</div>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 rounded-lg border border-sand-200 bg-white px-3 py-1.5 text-sm"
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-sand-500">
                {fmtMonth(month)} 정산
              </div>
              <div className="text-xs text-sand-600">
                {settlement.entryCount}건 집계
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const center = centers.find((c) => c.id === centerId);
                exportSettlementExcel(
                  month,
                  center?.name ?? centerId,
                  monthEntries,
                  settlement,
                  inflow ?? undefined
                );
              }}
              className="rounded-lg bg-moss-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-moss-600"
            >
              📊 엑셀 다운로드
            </button>
          </div>
        </CardBody>
      </Card>

      {/* 환자 통계 4개 카드 */}
      {patientStats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardBody>
              <Stat label="총 환자" value={`${patientStats.total}명`} />
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat
                label="이번 달 신규"
                value={`${patientStats.newThisMonth}명`}
                tone="primary"
              />
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat
                label="재방문 환자"
                value={`${patientStats.repeat}명`}
                hint={
                  patientStats.total > 0
                    ? `${Math.round(
                        (patientStats.repeat / patientStats.total) * 100
                      )}%`
                    : undefined
                }
              />
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat
                label="평균 객단가"
                value={patientStats.avgTicket}
                tone="positive"
                hint="이번 달 매출 ÷ 방문환자수"
              />
            </CardBody>
          </Card>
        </div>
      )}

      {/* 6개월 매출 트렌드 */}
      <Card>
        <CardHeader>
          <CardTitle>최근 6개월 매출</CardTitle>
        </CardHeader>
        <CardBody>
          <BarChart
            data={trend.map((t) => ({
              label: t.month.slice(5), // MM
              value: t.total,
            }))}
            height={200}
            color="#71875E"
          />
        </CardBody>
      </Card>

      {/* 핵심 정산 결과 */}
      <Card>
        <CardHeader>
          <CardTitle>정산 결과</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <Stat label="총 매출" value={settlement.totalGross} />
            <Stat
              label="차감 합계"
              value={settlement.totalDeductions}
              tone="muted"
              hint={`부가세 ${fmtWon(settlement.vat)} + 카드수수료 ${fmtWon(
                settlement.cardFee
              )}`}
            />
            <Stat label="순매출" value={settlement.netRevenue} tone="primary" />
            <Stat
              label="센터 / 법인 (50:50)"
              value={fmtWon(settlement.centerShare)}
              tone="positive"
              hint={`각자 ${fmtWon(settlement.centerShare)}`}
            />
          </div>

          {/* 정산식 시각화 */}
          <div className="mt-6 overflow-x-auto rounded-xl bg-sand-100/60 p-4">
            <table className="w-full min-w-[400px] text-sm">
              <tbody className="tabular">
                <tr>
                  <td className="py-1 text-sand-600">총매출 (현금+카드)</td>
                  <td className="py-1 text-right font-semibold text-sand-800">
                    {fmtWon(settlement.totalGross)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 pl-4 text-sand-500">– 부가세 ({rule.vatRate * 100}%)</td>
                  <td className="py-1 text-right text-sand-600">
                    − {fmtWon(settlement.vat)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 pl-4 text-sand-500">
                    – 카드 수수료 ({(rule.cardFeeRate * 100).toFixed(1)}%)
                  </td>
                  <td className="py-1 text-right text-sand-600">
                    − {fmtWon(settlement.cardFee)}
                  </td>
                </tr>
                <tr className="border-t border-sand-300">
                  <td className="py-2 font-semibold text-sand-800">순매출</td>
                  <td className="py-2 text-right font-bold text-clay-600">
                    {fmtWon(settlement.netRevenue)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 pl-4 text-sand-700">
                    센터 몫 ({rule.centerSharePct * 100}%)
                  </td>
                  <td className="py-1 text-right font-semibold text-moss-600">
                    {fmtWon(settlement.centerShare)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 pl-4 text-sand-700">
                    법인 몫 ({rule.corpSharePct * 100}%)
                  </td>
                  <td className="py-1 text-right font-semibold text-moss-600">
                    {fmtWon(settlement.corpShare)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 정산 룰 조정 */}
          <details className="mt-4 rounded-xl border border-sand-200 px-4 py-3">
            <summary className="cursor-pointer text-xs font-medium text-sand-600">
              ⚙️ 정산 룰 조정 (부가세율 / 카드 수수료율 / 분배율)
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <label className="text-xs">
                <div className="text-sand-500">부가세율 (%)</div>
                <input
                  type="number"
                  step="0.1"
                  value={rule.vatRate * 100}
                  onChange={(e) =>
                    updateRule({
                      ...rule,
                      vatRate: (Number(e.target.value) || 0) / 100,
                    })
                  }
                  className="mt-1 w-full rounded border border-sand-200 px-2 py-1"
                />
              </label>
              <label className="text-xs">
                <div className="text-sand-500">카드수수료 (%)</div>
                <input
                  type="number"
                  step="0.1"
                  value={rule.cardFeeRate * 100}
                  onChange={(e) =>
                    updateRule({
                      ...rule,
                      cardFeeRate: (Number(e.target.value) || 0) / 100,
                    })
                  }
                  className="mt-1 w-full rounded border border-sand-200 px-2 py-1"
                />
              </label>
              <label className="text-xs">
                <div className="text-sand-500">센터 (%)</div>
                <input
                  type="number"
                  step="1"
                  value={rule.centerSharePct * 100}
                  onChange={(e) => {
                    const c = (Number(e.target.value) || 0) / 100;
                    updateRule({
                      ...rule,
                      centerSharePct: c,
                      corpSharePct: 1 - c,
                    });
                  }}
                  className="mt-1 w-full rounded border border-sand-200 px-2 py-1"
                />
              </label>
              <label className="text-xs">
                <div className="text-sand-500">법인 (%)</div>
                <input
                  type="number"
                  step="1"
                  value={rule.corpSharePct * 100}
                  readOnly
                  className="mt-1 w-full rounded border border-sand-200 bg-sand-100 px-2 py-1 text-sand-600"
                />
              </label>
            </div>

            {/* 면세 파트 토글 */}
            <div className="mt-4 border-t border-sand-200 pt-3">
              <div className="text-xs font-medium text-sand-700">
                면세 파트 (의료행위로 부가세 없음)
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 md:grid-cols-5">
                {PARTS.map((p) => {
                  const exempt = rule.vatExemptParts.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        const next = exempt
                          ? rule.vatExemptParts.filter((x) => x !== p.id)
                          : [...rule.vatExemptParts, p.id];
                        updateRule({ ...rule, vatExemptParts: next });
                      }}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        exempt
                          ? "border-moss-500 bg-moss-500/10 text-moss-700"
                          : "border-sand-200 bg-white text-sand-700 hover:border-sand-300"
                      }`}
                    >
                      {p.label}
                      <div className="text-[10px] font-normal">
                        {exempt ? "면세" : "과세"}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] text-sand-500">
                의료행위 (의료법상 면세)면 면세로, 비의료 미용이면 과세로 설정.
                면세 파트는 부가세 차감에서 제외됩니다.
              </p>
            </div>
          </details>
        </CardBody>
      </Card>

      {/* 시각화 — 일자별 매출 추이 + 파트별 비중 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>일자별 매출 추이</CardTitle>
          </CardHeader>
          <CardBody>
            <BarChart data={dailyData} height={180} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>파트별 비중</CardTitle>
          </CardHeader>
          <CardBody>
            <DonutChart slices={donutSlices} />
          </CardBody>
        </Card>
      </div>

      {/* 파트별 매출 */}
      <Card>
        <CardHeader>
          <CardTitle>파트별 매출</CardTitle>
        </CardHeader>
        <CardBody>
          {settlement.partBreakdown.length === 0 ? (
            <div className="py-6 text-center text-sm text-sand-500">
              집계할 매출이 없습니다.
            </div>
          ) : (
            <table className="w-full text-sm tabular">
              <thead>
                <tr className="border-b border-sand-200 text-left text-[11px] uppercase tracking-wider text-sand-500">
                  <th className="py-2">파트</th>
                  <th className="py-2 text-right">현금</th>
                  <th className="py-2 text-right">카드</th>
                  <th className="py-2 text-right">합계</th>
                  <th className="py-2 text-right">과세</th>
                </tr>
              </thead>
              <tbody>
                {settlement.partBreakdown.map((p) => (
                  <tr key={p.partId} className="border-b border-sand-100">
                    <td className="py-2 font-medium text-sand-800">{partLabel(p.partId)}</td>
                    <td className="py-2 text-right text-sand-700">{fmtWon(p.cash)}</td>
                    <td className="py-2 text-right text-sand-700">{fmtWon(p.card)}</td>
                    <td className="py-2 text-right font-semibold text-sand-800">
                      {fmtWon(p.total)}
                    </td>
                    <td className="py-2 text-right">
                      {p.vatExempt ? (
                        <span className="rounded bg-moss-500/15 px-2 py-0.5 text-[10px] font-medium text-moss-600">
                          면세
                        </span>
                      ) : (
                        <span className="rounded bg-sand-500/15 px-2 py-0.5 text-[10px] font-medium text-sand-600">
                          과세
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {/* 환자 유입 + 일자별 매출 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>환자 유입경로</CardTitle>
          </CardHeader>
          <CardBody>
            {inflow ? (
              <div className="space-y-2 text-sm">
                {INFLOW_CHANNELS.map((ch) => (
                  <div key={ch.id} className="flex justify-between">
                    <span className="text-sand-700">{ch.label}</span>
                    <span className="font-semibold text-sand-800 tabular">
                      {inflow.channels[ch.id]}건
                    </span>
                  </div>
                ))}
                <div className="mt-2 flex justify-between border-t border-sand-200 pt-2">
                  <span className="font-semibold text-sand-800">신규환자</span>
                  <span className="font-bold text-clay-600 tabular">
                    {inflow.newPatients}명
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-sand-500">
                해당 월 유입 데이터 없음
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>일자별 매출</CardTitle>
          </CardHeader>
          <CardBody>
            {monthEntries.length === 0 ? (
              <div className="py-6 text-center text-sm text-sand-500">매출 없음</div>
            ) : (
              <div className="space-y-1.5 text-sm">
                {monthEntries.map((e) => {
                  const dayCash = e.sales.reduce((s, l) => s + l.cash, 0);
                  const dayCard = e.sales.reduce((s, l) => s + l.card, 0);
                  return (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-lg bg-sand-100/60 px-3 py-2"
                    >
                      <div>
                        <div className="font-medium text-sand-800">{fmtDate(e.date)}</div>
                        {e.ocrSource && (
                          <div className="text-[10px] text-moss-600">
                            📸 OCR · 신뢰도 {Math.round(e.ocrSource.confidence * 100)}%
                          </div>
                        )}
                        {e.note && (
                          <div className="text-[10px] text-sand-500">{e.note}</div>
                        )}
                      </div>
                      <div className="text-right tabular">
                        <div className="font-semibold text-sand-800">
                          {fmtWon(dayCash + dayCard)}
                        </div>
                        <div className="text-[10px] text-sand-500">
                          현 {fmtWon(dayCash)} / 카 {fmtWon(dayCard)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
