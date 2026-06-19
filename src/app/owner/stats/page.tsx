"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDataSource } from "@/lib/data";
import { fmtWon, todayKST } from "@/lib/format";
import { PARTS, type PatientSalesRow, type SalesSummary } from "@/lib/types";

const partLabel = (id: string) => PARTS.find((p) => p.id === id)?.label ?? id;
import { useCurrentCenter } from "@/lib/use-current-center";

function todayRange() {
  const t = todayKST();
  return { from: t, to: t };
}
function monthRange() {
  const t = todayKST();
  const [y, m] = t.slice(0, 7).split("-").map(Number);
  const nextFirst = m === 12 ? new Date(y + 1, 0, 1) : new Date(y, m, 1);
  nextFirst.setDate(nextFirst.getDate() - 1);
  const lastDay = String(nextFirst.getDate()).padStart(2, "0");
  const ym = t.slice(0, 7);
  return { from: `${ym}-01`, to: `${ym}-${lastDay}` };
}

export default function OwnerStatsPage() {
  const { centerId, loaded } = useCurrentCenter();
  const [today, setToday] = useState<SalesSummary | null>(null);
  const [month, setMonth] = useState<SalesSummary | null>(null);
  const [top, setTop] = useState<PatientSalesRow[]>([]);
  const [busy, setBusy] = useState(false);

  const mr = useMemo(() => monthRange(), []);
  const tr = useMemo(() => todayRange(), []);

  useEffect(() => {
    (async () => {
      if (!centerId) return;
      setBusy(true);
      try {
        const data = await getDataSource();
        const [t, m, tp] = await Promise.all([
          data.stats.summary(centerId, tr.from, tr.to),
          data.stats.summary(centerId, mr.from, mr.to),
          data.stats.topPatients(centerId, mr.from, mr.to, 10),
        ]);
        setToday(t);
        setMonth(m);
        setTop(tp);
      } finally {
        setBusy(false);
      }
    })();
  }, [centerId, mr, tr]);

  if (!loaded)
    return <div className="py-12 text-center text-sm text-sand-500">로딩 중...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-sand-900">매출 통계</h2>
          <p className="mt-0.5 text-xs text-sand-500">오늘 · 이번 달 · 환자 TOP</p>
        </div>
        <Link href="/owner" className="text-xs text-sand-500 hover:text-sand-700">
          ← 홈
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SummaryCard title="오늘" s={today} busy={busy} />
        <SummaryCard title="이번 달" s={month} busy={busy} accent />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>이번 달 파트별 매출</CardTitle>
        </CardHeader>
        <CardBody>
          {busy ? (
            <div className="py-6 text-center text-xs text-sand-500">로딩 중...</div>
          ) : !month || month.byPart.length === 0 ? (
            <div className="py-6 text-center text-xs text-sand-500">
              이번 달 매출 기록이 없어요.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {month.byPart.map((p) => (
                <li
                  key={p.partId}
                  className="flex items-center justify-between gap-2 rounded-lg border border-sand-100 bg-white px-3 py-2"
                >
                  <span className="text-sm font-medium text-sand-800">
                    {partLabel(p.partId)}
                  </span>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-clay-700 tabular">
                      {fmtWon(p.total)}
                    </div>
                    <div className="text-[10px] text-sand-500 tabular leading-relaxed">
                      현금 {fmtWon(p.cash)} · 병원 {fmtWon(p.hospitalCard)} · 법인{" "}
                      {fmtWon(p.corpCard)}
                      {p.legacyCard > 0 && <> · 기존 {fmtWon(p.legacyCard)}</>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>이번 달 환자 매출 TOP 10</CardTitle>
        </CardHeader>
        <CardBody>
          {busy ? (
            <div className="py-6 text-center text-xs text-sand-500">로딩 중...</div>
          ) : top.length === 0 ? (
            <div className="py-6 text-center text-xs text-sand-500">
              이번 달 매출 기록이 없어요.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {top.map((r, i) => (
                <li
                  key={r.patientId}
                  className="flex items-center justify-between rounded-lg border border-sand-100 bg-white px-3 py-2"
                >
                  <Link
                    href={`/owner/patients/${r.patientId}`}
                    className="flex items-center gap-2 text-sm text-sand-800 hover:text-clay-600"
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sand-100 text-[11px] font-bold text-sand-600">
                      {i + 1}
                    </span>
                    <span className="font-medium">{r.patientName ?? "(이름 없음)"}</span>
                    <span className="text-[10px] text-sand-400">{r.patientId}</span>
                  </Link>
                  <div className="text-sm font-semibold text-clay-700 tabular">
                    {fmtWon(r.total)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function SummaryCard({
  title,
  s,
  busy,
  accent,
}: {
  title: string;
  s: SalesSummary | null;
  busy: boolean;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardBody>
        <div className="text-[11px] uppercase text-sand-500">{title}</div>
        {busy || !s ? (
          <div className="mt-2 text-sm text-sand-400">···</div>
        ) : (
          <>
            <div
              className={`mt-1 text-xl font-bold tabular ${
                accent ? "text-clay-700" : "text-sand-800"
              }`}
            >
              {fmtWon(s.total)}
            </div>
            <div className="mt-1 text-[11px] text-sand-500 tabular leading-relaxed">
              현금 {fmtWon(s.totalCash)} · 병원 {fmtWon(s.totalHospitalCard)} · 법인{" "}
              {fmtWon(s.totalCorpCard)}
              {s.totalLegacyCard > 0 && (
                <> · 기존카드 {fmtWon(s.totalLegacyCard)}</>
              )}
            </div>
            <div className="mt-1 text-[11px] text-sand-500 tabular">
              {s.visitCount}건 · 환자 {s.patientCount}명
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
