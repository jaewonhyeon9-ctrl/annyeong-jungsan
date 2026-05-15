"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { getDataSource } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import { searchPatients, visitsByPatient } from "@/lib/patient";
import {
  INFLOW_CHANNELS,
  PATIENT_TAGS,
  type Patient,
  type PatientTag,
  type Visit,
} from "@/lib/types";
import { useCurrentCenter } from "@/lib/use-current-center";

type LapseFilter = "all" | "30" | "60" | "90";

function daysSince(iso: string): number {
  const d = new Date(iso).getTime();
  return Math.floor((Date.now() - d) / 86400000);
}

export default function PatientsPage() {
  const { centerId, loaded: centerLoaded, error: centerError } = useCurrentCenter();
  const [q, setQ] = useState("");
  const [lapse, setLapse] = useState<LapseFilter>("all");
  const [tagFilter, setTagFilter] = useState<PatientTag | "all">("all");
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

  // 검색 → 미내방 → 태그 필터 적용
  const list = useMemo(() => {
    let result = searchPatients(patients, q);
    if (lapse !== "all") {
      const threshold = parseInt(lapse, 10);
      result = result.filter((p) => {
        const lastVisit = visitsByPatient(visits, p.id)[0];
        const baseline = lastVisit?.visitDate ?? p.firstVisitDate;
        return daysSince(baseline) >= threshold;
      });
    }
    if (tagFilter !== "all") {
      result = result.filter((p) => p.tags?.includes(tagFilter));
    }
    return result;
  }, [patients, visits, q, lapse, tagFilter]);

  // 미내방 카운트 — 탭 라벨용
  const lapseCounts = useMemo(() => {
    const counts: Record<LapseFilter, number> = { all: patients.length, "30": 0, "60": 0, "90": 0 };
    for (const p of patients) {
      const lastVisit = visitsByPatient(visits, p.id)[0];
      const baseline = lastVisit?.visitDate ?? p.firstVisitDate;
      const days = daysSince(baseline);
      if (days >= 30) counts["30"] += 1;
      if (days >= 60) counts["60"] += 1;
      if (days >= 90) counts["90"] += 1;
    }
    return counts;
  }, [patients, visits]);

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

        {/* CRM — 미내방 필터 */}
        <div className="flex gap-1.5 overflow-x-auto">
          {(
            [
              { v: "all", l: "전체" },
              { v: "30", l: "30일+" },
              { v: "60", l: "60일+" },
              { v: "90", l: "90일+" },
            ] as { v: LapseFilter; l: string }[]
          ).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setLapse(opt.v)}
              className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                lapse === opt.v
                  ? "border-clay-500 bg-clay-500/10 text-clay-700"
                  : "border-sand-200 bg-white text-sand-700"
              }`}
            >
              {opt.l}{" "}
              <span className="ml-0.5 text-[10px] text-sand-500 tabular">
                ({lapseCounts[opt.v]})
              </span>
            </button>
          ))}
        </div>

        {/* 태그 필터 */}
        <div className="flex gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setTagFilter("all")}
            className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              tagFilter === "all"
                ? "border-sand-700 bg-sand-700 text-white"
                : "border-sand-200 bg-white text-sand-700"
            }`}
          >
            태그 전체
          </button>
          {PATIENT_TAGS.map((tag) => {
            const on = tagFilter === tag.id;
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => setTagFilter(on ? "all" : tag.id)}
                className="flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition"
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
              const patientVisits = visitsByPatient(visits, p.id);
              const visitCount = patientVisits.length;
              const lastVisit = patientVisits[0];
              const baseline = lastVisit?.visitDate ?? p.firstVisitDate;
              const days = daysSince(baseline);
              const isLapsed = days >= 30;

              return (
                <Link
                  key={p.id}
                  href={`/owner/patients/${p.id}`}
                  className={`block rounded-2xl border bg-white px-5 py-4 shadow-sm transition hover:border-clay-400 ${
                    isLapsed ? "border-clay-300" : "border-sand-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-mono text-sand-500 tabular">
                        {p.id}
                      </div>
                      <div className="mt-0.5 truncate text-base font-semibold text-sand-800">
                        {p.personal?.name ?? "(이름 미입력)"}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {p.tags?.map((t) => {
                          const tag = PATIENT_TAGS.find((x) => x.id === t);
                          if (!tag) return null;
                          return (
                            <span
                              key={t}
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                              style={{ backgroundColor: tag.color }}
                            >
                              {tag.label}
                            </span>
                          );
                        })}
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
                      <div
                        className={`mt-1 text-[10px] tabular ${
                          isLapsed ? "font-semibold text-clay-700" : "text-sand-500"
                        }`}
                      >
                        {lastVisit ? (
                          <>
                            {days}일 전{isLapsed ? " ⚠️" : ""}
                          </>
                        ) : (
                          `등록 ${days}일`
                        )}
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
