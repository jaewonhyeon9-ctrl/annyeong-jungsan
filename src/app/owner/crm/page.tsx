"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { getDataSource } from "@/lib/data";
import { fmtWon, todayKST } from "@/lib/format";
import {
  INFLOW_CHANNELS,
  PATIENT_TAGS,
  type CrmPatientRow,
  type InflowChannel,
} from "@/lib/types";
import { useCurrentCenter } from "@/lib/use-current-center";

// CRM — 센터 전체 환자 1행 집계 위에 세그먼트/필터/대시보드를 올린 화면.
// 데이터는 data.stats.crm(centerId) 한 번 호출로 받아 클라이언트에서 가공.

type Segment =
  | "all"
  | "inactive" // 재방문 필요 (N일+ 미방문, 방문≥1)
  | "new" // 신규 (방문 1회)
  | "vip"
  | "pass" // 회수권 임박 (0<잔여≤2)
  | "noshow";

type SortKey = "lastVisit" | "revenue" | "name";

const SEGMENTS: { id: Segment; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "inactive", label: "재방문 필요" },
  { id: "new", label: "신규" },
  { id: "vip", label: "VIP" },
  { id: "pass", label: "회수권 임박" },
  { id: "noshow", label: "노쇼이력" },
];

function daysSince(dateStr: string | null, today: string): number | null {
  if (!dateStr) return null;
  const diff = Math.floor(
    (new Date(today).getTime() - new Date(dateStr).getTime()) / 86400000
  );
  return diff < 0 ? 0 : diff;
}

export default function OwnerCrmPage() {
  const { centerId, loaded: centerLoaded } = useCurrentCenter();
  const today = todayKST();

  const [rows, setRows] = useState<CrmPatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [segment, setSegment] = useState<Segment>("all");
  const [inactiveDays, setInactiveDays] = useState(30);
  const [inflow, setInflow] = useState<InflowChannel | "">("");
  const [sort, setSort] = useState<SortKey>("lastVisit");

  useEffect(() => {
    if (!centerId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await getDataSource();
        const list = await data.stats.crm(centerId);
        if (!cancelled) setRows(list);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [centerId]);

  // 대시보드 지표
  const metrics = useMemo(() => {
    const total = rows.length;
    const visited = rows.filter((r) => r.visitCount >= 1);
    const repeat = rows.filter((r) => r.visitCount >= 2);
    const active = rows.filter((r) => {
      const d = daysSince(r.lastVisitDate, today);
      return d !== null && d <= 90;
    });
    const inactive = visited.filter((r) => {
      const d = daysSince(r.lastVisitDate, today);
      return d !== null && d >= inactiveDays;
    });
    const revenue = rows.reduce((s, r) => s + r.totalRevenue, 0);
    const ltv = visited.length > 0 ? Math.round(revenue / visited.length) : 0;
    const repeatRate =
      visited.length > 0
        ? Math.round((repeat.length / visited.length) * 100)
        : 0;
    return {
      total,
      activeCount: active.length,
      inactiveCount: inactive.length,
      repeatRate,
      revenue,
      ltv,
    };
  }, [rows, today, inactiveDays]);

  // 세그먼트 + 필터 + 정렬
  const filtered = useMemo(() => {
    let list = rows.slice();

    switch (segment) {
      case "inactive":
        list = list.filter((r) => {
          const d = daysSince(r.lastVisitDate, today);
          return r.visitCount >= 1 && d !== null && d >= inactiveDays;
        });
        break;
      case "new":
        list = list.filter((r) => r.visitCount === 1);
        break;
      case "vip":
        list = list.filter((r) => r.tags.includes("vip"));
        break;
      case "pass":
        list = list.filter((r) => r.passRemaining > 0 && r.passRemaining <= 2);
        break;
      case "noshow":
        list = list.filter((r) => r.tags.includes("noshow"));
        break;
    }

    if (inflow) list = list.filter((r) => r.inflowChannels.includes(inflow));

    list.sort((a, b) => {
      if (sort === "revenue") return b.totalRevenue - a.totalRevenue;
      if (sort === "name")
        return (a.name ?? "").localeCompare(b.name ?? "", "ko");
      // lastVisit — 오래된/미방문 우선 (재방문 관리에 유용)
      const da = daysSince(a.lastVisitDate, today);
      const db = daysSince(b.lastVisitDate, today);
      const va = da === null ? Number.MAX_SAFE_INTEGER : da;
      const vb = db === null ? Number.MAX_SAFE_INTEGER : db;
      return vb - va;
    });

    return list;
  }, [rows, segment, inflow, sort, today, inactiveDays]);

  if (!centerLoaded) {
    return (
      <div className="py-12 text-center text-sm text-sand-500">로딩 중...</div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-sand-900">CRM 고객 관리</h2>
          <p className="mt-0.5 text-xs text-sand-500">
            재방문·이탈 관리 · 세그먼트 · 리텐션 분석
          </p>
        </div>
        <Link href="/owner" className="text-xs text-sand-500 hover:text-sand-700">
          ← 홈
        </Link>
      </div>

      {/* 대시보드 */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCard label="전체 고객" value={`${metrics.total}명`} />
        <MetricCard
          label="활성(90일)"
          value={`${metrics.activeCount}명`}
          tone="moss"
        />
        <MetricCard
          label={`이탈위험(${inactiveDays}일+)`}
          value={`${metrics.inactiveCount}명`}
          tone="clay"
        />
        <MetricCard label="재방문율" value={`${metrics.repeatRate}%`} />
        <MetricCard label="총매출" value={fmtWon(metrics.revenue)} />
        <MetricCard label="평균 LTV" value={fmtWon(metrics.ltv)} />
      </div>

      {/* 세그먼트 칩 */}
      <div className="flex flex-wrap gap-1.5">
        {SEGMENTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSegment(s.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              segment === s.id
                ? "bg-clay-500 text-white"
                : "bg-sand-100 text-sand-600 hover:bg-sand-200"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* 필터 */}
      <Card>
        <CardBody className="flex flex-wrap items-end gap-3">
          {segment === "inactive" && (
            <label className="text-xs text-sand-600">
              미방문 기준(일)
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={inactiveDays || ""}
                onChange={(e) =>
                  setInactiveDays(Math.max(1, Number(e.target.value) || 0))
                }
                className="mt-0.5 block w-20 rounded-lg border border-sand-200 bg-white px-2 py-1.5 text-right text-sm tabular focus:border-clay-400 focus:outline-none"
              />
            </label>
          )}
          <label className="text-xs text-sand-600">
            유입경로
            <select
              value={inflow}
              onChange={(e) => setInflow(e.target.value as InflowChannel | "")}
              className="mt-0.5 block rounded-lg border border-sand-200 bg-white px-2 py-1.5 text-sm focus:border-clay-400 focus:outline-none"
            >
              <option value="">전체</option>
              {INFLOW_CHANNELS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-sand-600">
            정렬
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="mt-0.5 block rounded-lg border border-sand-200 bg-white px-2 py-1.5 text-sm focus:border-clay-400 focus:outline-none"
            >
              <option value="lastVisit">오래된 방문순</option>
              <option value="revenue">매출 높은순</option>
              <option value="name">이름순</option>
            </select>
          </label>
          <div className="ml-auto self-center text-xs font-medium text-sand-500">
            {filtered.length}명
          </div>
        </CardBody>
      </Card>

      {/* 결과 리스트 */}
      {loading ? (
        <div className="py-10 text-center text-sm text-sand-500">
          고객 데이터 불러오는 중...
        </div>
      ) : error ? (
        <div className="rounded-xl bg-clay-500/10 px-4 py-3 text-sm text-clay-700">
          불러오기 실패: {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-sand-500">
          조건에 맞는 고객이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <PatientRow key={r.patientId} row={r} today={today} />
          ))}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "moss" | "clay";
}) {
  const color =
    tone === "moss"
      ? "text-moss-600"
      : tone === "clay"
      ? "text-clay-600"
      : "text-sand-800";
  return (
    <Card>
      <CardBody className="text-center">
        <div className="text-[10px] uppercase text-sand-500">{label}</div>
        <div className={`mt-0.5 text-sm font-bold tabular ${color}`}>
          {value}
        </div>
      </CardBody>
    </Card>
  );
}

function PatientRow({ row, today }: { row: CrmPatientRow; today: string }) {
  const d = daysSince(row.lastVisitDate, today);
  const lastLabel =
    d === null ? "방문 기록 없음" : d === 0 ? "오늘 방문" : `${d}일 전 방문`;
  const overdue = d !== null && d >= 30;

  const smsBody = encodeURIComponent(
    `${row.name ?? "고객"}님 안녕하세요. 오랜만에 인사드려요. 컨디션 점검 차원에서 한 번 들러주시면 좋겠습니다. 편하신 시간 알려주세요.`
  );

  return (
    <Card>
      <CardBody className="flex items-center gap-3">
        <Link href={`/owner/patients/${row.patientId}`} className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-sand-800">
              {row.name ?? "(이름 없음)"}
            </span>
            {row.tags.map((t) => {
              const tag = PATIENT_TAGS.find((x) => x.id === t);
              if (!tag) return null;
              return (
                <span
                  key={t}
                  className="rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.label}
                </span>
              );
            })}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-sand-500">
            <span className={overdue ? "font-semibold text-clay-600" : ""}>
              {lastLabel}
            </span>
            <span>· {row.visitCount}회</span>
            <span>· {fmtWon(row.totalRevenue)}</span>
            {row.passRemaining > 0 && (
              <span className="font-medium text-moss-600">
                · 회수권 {row.passRemaining}회
              </span>
            )}
          </div>
        </Link>
        {row.phone && (
          <div className="flex shrink-0 gap-1.5">
            <a
              href={`tel:${row.phone}`}
              className="rounded-lg bg-moss-500/10 px-2.5 py-2 text-xs font-medium text-moss-700 hover:bg-moss-500/20"
            >
              📞
            </a>
            <a
              href={`sms:${row.phone}?body=${smsBody}`}
              className="rounded-lg bg-clay-500/10 px-2.5 py-2 text-xs font-medium text-clay-700 hover:bg-clay-500/20"
            >
              💬
            </a>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
