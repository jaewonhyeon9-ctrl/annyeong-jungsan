"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { getDataSource } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import { searchPatients, visitsByPatient } from "@/lib/patient";
import { INFLOW_CHANNELS, type Patient, type Visit } from "@/lib/types";
import { useCurrentCenter } from "@/lib/use-current-center";

export default function PatientsPage() {
  const { centerId, loaded: centerLoaded, error: centerError } = useCurrentCenter();
  const [q, setQ] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!centerLoaded) return;
    let cancelled = false;
    (async () => {
      if (!centerId) {
        if (!cancelled) setLoaded(true);
        return;
      }
      const data = await getDataSource();
      const ps = await data.patients.list(centerId);
      // 방문 수 카운트용 — 환자별 visit 한 번에 받기
      const allVisits = (
        await Promise.all(ps.map((p) => data.visits.listByPatient(p.id)))
      ).flat();
      if (!cancelled) {
        setPatients(ps);
        setVisits(allVisits);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [centerId, centerLoaded]);

  const list = useMemo(() => searchPatients(patients, q), [patients, q]);

  const channelLabel = (id: string) =>
    INFLOW_CHANNELS.find((c) => c.id === id)?.label ?? id;

  return (
    <div className="min-h-screen bg-sand-50 pb-20">
      <header className="sticky top-0 z-10 border-b border-sand-200 bg-sand-50/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
          <Link href="/owner" className="text-sand-600 hover:text-sand-800">
            ←
          </Link>
          <div className="text-sm font-semibold text-sand-800">환자 관리</div>
          <Link
            href="/owner/patients/new"
            className="rounded-lg bg-clay-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-clay-600"
          >
            + 신규
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-5 py-6">
        <input
          type="search"
          placeholder="환자번호 / 이름 / 연락처 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-2xl border border-sand-200 bg-white px-4 py-3 text-sm focus:border-clay-400 focus:outline-none"
        />

        <div className="space-y-2">
          {!loaded ? (
            <Card>
              <CardBody>
                <div className="py-6 text-center text-sm text-sand-500">
                  {centerError ?? "로딩 중..."}
                </div>
              </CardBody>
            </Card>
          ) : list.length === 0 ? (
            <Card>
              <CardBody>
                <div className="py-6 text-center text-sm text-sand-500">
                  {patients.length === 0
                    ? "아직 환자가 없습니다. 우상단 + 신규 로 등록하세요."
                    : "검색 결과 없음"}
                </div>
              </CardBody>
            </Card>
          ) : (
            list.map((p) => {
              const visitCount = visitsByPatient(visits, p.id).length;
              return (
                <Link
                  key={p.id}
                  href={`/owner/patients/${p.id}`}
                  className="block rounded-2xl border border-sand-200 bg-white px-5 py-4 shadow-sm transition hover:border-clay-400"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-mono text-sand-500 tabular">
                        {p.id}
                      </div>
                      <div className="mt-0.5 text-base font-semibold text-sand-800">
                        {p.personal?.name ?? "(이름 미입력)"}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {p.inflowChannels.map((c) => (
                          <span
                            key={c}
                            className="rounded-full bg-sand-100 px-2 py-0.5 text-[10px] text-sand-700"
                          >
                            {channelLabel(c)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase text-sand-500">
                        방문
                      </div>
                      <div className="text-lg font-bold text-clay-600 tabular">
                        {visitCount}회
                      </div>
                      <div className="mt-1 text-[10px] text-sand-500">
                        최초 {fmtDate(p.firstVisitDate)}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
