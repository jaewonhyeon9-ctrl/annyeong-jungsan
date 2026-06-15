"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { getDataSource } from "@/lib/data";
import { fmtDate, todayKST } from "@/lib/format";
import { useAllServices } from "@/lib/services";
import {
  PARTS,
  passRemaining,
  RESERVATION_STATUS_LABELS,
  type PartId,
  type Patient,
  type Reservation,
  type ReservationStatus,
  type ServicePass,
  type UserProfile,
} from "@/lib/types";
import { useCurrentCenter } from "@/lib/use-current-center";
import { useCurrentProfile } from "@/lib/use-current-profile";

const SLOT_MIN = 30;
const DAY_START_HOUR = 9;
const DAY_END_HOUR = 21;

// ====================== 캘린더 유틸 ======================

function ymString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function ymdString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function localIsoFromYmdHm(date: string, hour: number, minute: number): string {
  // 한국 시간을 그대로 datetime으로 저장 (UTC 변환 안 함).
  // Supabase timestamptz는 ISO를 받아주고 UTC로 정규화하므로 +09:00 명시.
  return `${date}T${pad(hour)}:${pad(minute)}:00+09:00`;
}

function hourFromIso(iso: string): { h: number; m: number } {
  const d = new Date(iso);
  return { h: d.getHours(), m: d.getMinutes() };
}

// 월 그리드 — 첫 주는 이전 달 잘림, 마지막 주는 다음 달 채움
function buildMonthGrid(year: number, month: number) {
  // month: 0-based
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startWeekday = first.getDay(); // 0=일
  const totalCells = Math.ceil((startWeekday + last.getDate()) / 7) * 7;
  const cells: Array<{ date: Date; inMonth: boolean; ymd: string }> = [];
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(year, month, 1 - startWeekday + i);
    cells.push({
      date: d,
      inMonth: d.getMonth() === month,
      ymd: ymdString(d),
    });
  }
  return cells;
}

// ====================== 페이지 ======================

export default function OwnerReservationsPage() {
  const { centerId, loaded: centerLoaded } = useCurrentCenter();
  const { profile, loaded: profileLoaded } = useCurrentProfile();
  const { services: allServices } = useAllServices();

  const today = todayKST();
  const [cursor, setCursor] = useState(() => {
    const d = new Date(today);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string>(today);

  // 데이터
  const [monthReservations, setMonthReservations] = useState<Reservation[]>([]);
  const [dayReservations, setDayReservations] = useState<Reservation[]>([]);
  const [owners, setOwners] = useState<UserProfile[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);

  // 폼
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [showForm, setShowForm] = useState(false);

  // 완료 처리 + 회수권 차감 모달
  const [completing, setCompleting] = useState<{
    reservation: Reservation;
    passes: ServicePass[];
  } | null>(null);

  // 시술자 — 예약에 입력된 이름 + 이번 세션에 직접 추가한 이름 (칸 분할 기준)
  const [extraPractitioners, setExtraPractitioners] = useState<string[]>([]);

  // 권한 — owner는 자기 파트만
  const myPart: PartId | null = useMemo(() => {
    if (profile?.role === "owner" && profile.partId) return profile.partId;
    return null;
  }, [profile]);

  // 가시 시술자 (가로축) — owner는 자기 1명, admin은 자기 파트(필터) 또는 전체
  const visibleOwners = useMemo(() => {
    if (!profile) return [] as UserProfile[];
    if (profile.role === "owner") {
      return owners.filter((o) => o.id === profile.id);
    }
    return owners.filter((o) => o.role === "owner" && o.centerId === centerId);
  }, [owners, profile, centerId]);

  // 알려진 시술자 이름 — 월/일 예약에 등장한 이름 + 직접 추가한 이름
  const knownPractitioners = useMemo(() => {
    const set = new Set<string>();
    for (const r of monthReservations)
      if (r.practitionerName?.trim()) set.add(r.practitionerName.trim());
    for (const r of dayReservations)
      if (r.practitionerName?.trim()) set.add(r.practitionerName.trim());
    for (const n of extraPractitioners) if (n.trim()) set.add(n.trim());
    return [...set].sort((a, b) => a.localeCompare(b, "ko"));
  }, [monthReservations, dayReservations, extraPractitioners]);

  const refreshMonth = useCallback(async () => {
    if (!centerId) return;
    setLoading(true);
    try {
      const data = await getDataSource();
      const list = await data.reservations.byMonth(centerId, ymString(cursor));
      const filtered =
        profile?.role === "owner" && profile.partId
          ? list.filter((r) => r.partId === profile.partId)
          : list;
      setMonthReservations(filtered);
    } finally {
      setLoading(false);
    }
  }, [centerId, cursor, profile]);

  const refreshDay = useCallback(async () => {
    if (!centerId) return;
    const data = await getDataSource();
    const list = await data.reservations.byDate(centerId, selectedDate);
    const filtered =
      profile?.role === "owner" && profile.partId
        ? list.filter((r) => r.partId === profile.partId)
        : list;
    setDayReservations(filtered);
  }, [centerId, selectedDate, profile]);

  // 완료 확정 — 선택한 회수권이 있으면 1회 차감하고 예약에 기록
  async function confirmComplete(r: Reservation, passId: string | null) {
    const data = await getDataSource();
    if (passId) await data.passes.use(passId, 1);
    await data.reservations.update(r.id, {
      status: "completed",
      deductedPassId: passId,
    });
    setCompleting(null);
    await Promise.all([refreshMonth(), refreshDay()]);
  }

  // 메타: owners + patients
  useEffect(() => {
    (async () => {
      if (!centerId) return;
      const data = await getDataSource();
      const [users, pts] = await Promise.all([
        data.users.list(),
        data.patients.list(centerId),
      ]);
      setOwners(users);
      setPatients(pts);
    })();
  }, [centerId]);

  useEffect(() => {
    refreshMonth();
  }, [refreshMonth]);

  useEffect(() => {
    refreshDay();
  }, [refreshDay]);

  // 월 그리드 — 날짜별 카운트
  const grid = useMemo(
    () => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  );
  const countByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of monthReservations) {
      const d = ymdString(new Date(r.scheduledAt));
      m.set(d, (m.get(d) ?? 0) + 1);
    }
    return m;
  }, [monthReservations]);

  if (!profileLoaded || !centerLoaded) {
    return <div className="py-12 text-center text-sm text-sand-500">로딩 중...</div>;
  }

  const partLabel =
    PARTS.find((p) => p.id === (myPart ?? "scalp"))?.label ?? "전체";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-sand-900">예약</h2>
          <p className="mt-0.5 text-xs text-sand-500">
            {profile?.role === "owner" ? `${partLabel} 파트` : "전체"} · 월간 캘린더 → 일별 그리드
          </p>
        </div>
        <Link
          href="/owner"
          className="text-xs text-sand-500 hover:text-sand-700"
        >
          ← 홈
        </Link>
      </div>

      {/* 월간 캘린더 */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between pb-3">
            <button
              type="button"
              onClick={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
              }
              className="rounded border border-sand-200 px-2 py-1 text-xs hover:border-sand-400"
            >
              ◀
            </button>
            <div className="text-base font-semibold text-sand-800">
              {cursor.getFullYear()}년 {cursor.getMonth() + 1}월
              {loading && (
                <span className="ml-2 text-[11px] font-normal text-sand-400">
                  로딩 중...
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
              }
              className="rounded border border-sand-200 px-2 py-1 text-xs hover:border-sand-400"
            >
              ▶
            </button>
          </div>
          <div className="grid grid-cols-7 gap-px bg-sand-200 text-[11px]">
            {["일", "월", "화", "수", "목", "금", "토"].map((w) => (
              <div
                key={w}
                className="bg-sand-50 py-1.5 text-center font-medium text-sand-600"
              >
                {w}
              </div>
            ))}
            {grid.map(({ date, inMonth, ymd }) => {
              const count = countByDate.get(ymd) ?? 0;
              const isToday = ymd === today;
              const isSelected = ymd === selectedDate;
              return (
                <button
                  key={ymd}
                  type="button"
                  onClick={() => setSelectedDate(ymd)}
                  className={`relative min-h-[44px] bg-white py-1.5 text-left transition ${
                    !inMonth ? "text-sand-300" : "text-sand-700"
                  } ${
                    isSelected
                      ? "bg-clay-500/15 ring-1 ring-clay-500"
                      : "hover:bg-sand-50"
                  }`}
                >
                  <span
                    className={`ml-1.5 inline-block ${
                      isToday
                        ? "rounded-full bg-clay-500 px-1.5 text-white"
                        : ""
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  {count > 0 && (
                    <span className="absolute bottom-1 right-1.5 rounded bg-moss-500/15 px-1 text-[10px] font-medium text-moss-700 tabular">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* 일별 상세 — 가로: 시술자, 세로: 시간 */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between pb-3">
            <div>
              <div className="text-sm font-semibold text-sand-800">
                {fmtDate(selectedDate)} 예약
              </div>
              <div className="text-xs text-sand-500">
                총 {dayReservations.length}건 · 가로 시술자 / 세로 시간
              </div>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const name = window.prompt("추가할 시술자 이름");
                  if (name?.trim())
                    setExtraPractitioners((p) => [
                      ...new Set([...p, name.trim()]),
                    ]);
                }}
                className="rounded-lg border border-sand-300 px-3 py-1.5 text-xs font-semibold text-sand-700 hover:bg-sand-100"
              >
                + 시술자
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setShowForm(true);
                }}
                className="rounded-lg bg-clay-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-clay-600"
              >
                + 예약 추가
              </button>
            </div>
          </div>

          <DayGrid
            practitioners={knownPractitioners}
            reservations={dayReservations}
            onCellClick={(practitionerName, hour, minute) => {
              const iso = localIsoFromYmdHm(selectedDate, hour, minute);
              const empty: Reservation = {
                id: "",
                centerId: centerId ?? "",
                partId:
                  profile?.role === "owner" && profile.partId
                    ? profile.partId
                    : (PARTS[0]?.id ?? "scalp"),
                ownerId:
                  profile?.role === "owner" ? profile.id : null,
                ownerName: undefined,
                practitionerName: practitionerName || null,
                patientId: null,
                patientName: null,
                patientPhone: null,
                scheduledAt: iso,
                durationMin: SLOT_MIN,
                serviceId: null,
                serviceName: null,
                status: "scheduled",
                memo: null,
                deductedPassId: null,
                createdBy: null,
                createdAt: "",
                updatedAt: null,
              };
              setEditing(empty);
              setShowForm(true);
            }}
            onReservationClick={(r) => {
              setEditing(r);
              setShowForm(true);
            }}
            onQuickComplete={async (r) => {
              const data = await getDataSource();
              if (r.status === "completed") {
                // 완료 취소 — 차감했던 회수권 복원
                if (r.deductedPassId) {
                  try {
                    await data.passes.use(r.deductedPassId, -1);
                  } catch {
                    // 이미 변동됐으면 무시 (best-effort 복원)
                  }
                }
                await data.reservations.update(r.id, {
                  status: "scheduled",
                  deductedPassId: null,
                });
                await Promise.all([refreshMonth(), refreshDay()]);
                return;
              }
              // 완료 — 환자 보유 회수권 있으면 차감 모달, 없으면 바로 완료
              let passes: ServicePass[] = [];
              if (r.patientId) {
                try {
                  passes = (await data.passes.listByPatient(r.patientId)).filter(
                    (p) => passRemaining(p) > 0
                  );
                } catch {
                  passes = [];
                }
              }
              if (passes.length > 0) {
                setCompleting({ reservation: r, passes });
              } else {
                await data.reservations.update(r.id, { status: "completed" });
                await Promise.all([refreshMonth(), refreshDay()]);
              }
            }}
          />
        </CardBody>
      </Card>

      {showForm && (
        <ReservationForm
          centerId={centerId ?? ""}
          owners={visibleOwners}
          patients={patients}
          services={allServices}
          myPart={myPart}
          knownPractitioners={knownPractitioners}
          defaultPractitioner={
            profile?.role === "owner" ? profile.displayName : ""
          }
          initial={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setShowForm(false);
            setEditing(null);
            await Promise.all([refreshMonth(), refreshDay()]);
          }}
        />
      )}

      {completing && (
        <CompleteModal
          reservation={completing.reservation}
          passes={completing.passes}
          onCancel={() => setCompleting(null)}
          onConfirm={(passId) => confirmComplete(completing.reservation, passId)}
        />
      )}
    </div>
  );
}

// ====================== 완료 + 회수권 차감 모달 ======================

function CompleteModal({
  reservation,
  passes,
  onCancel,
  onConfirm,
}: {
  reservation: Reservation;
  passes: ServicePass[];
  onCancel: () => void;
  onConfirm: (passId: string | null) => void | Promise<void>;
}) {
  // 예약 시술과 같은 회수권을 기본 선택 (없으면 차감 안 함)
  const [selected, setSelected] = useState<string | null>(
    () =>
      passes.find((p) => p.serviceId === reservation.serviceId)?.id ?? null
  );
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    setSaving(true);
    try {
      await onConfirm(selected);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-sand-900/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-1 text-base font-bold text-sand-900">시술 완료</div>
        <div className="mb-3 text-xs text-sand-500">
          {reservation.patientName ?? "환자"}
          {reservation.serviceName ? ` · ${reservation.serviceName}` : ""}
        </div>

        <div className="mb-2 text-xs font-medium text-sand-600">
          회수권 차감 (1회)
        </div>
        <div className="space-y-1.5">
          {passes.map((p) => {
            const on = selected === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(on ? null : p.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
                  on
                    ? "border-moss-500 bg-moss-500/10"
                    : "border-sand-200 bg-white"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-sand-800">
                    {p.serviceName}
                  </span>
                  <span className="block text-[11px] text-sand-500 tabular">
                    {passRemaining(p)}회 남음 → {passRemaining(p) - 1}회
                  </span>
                </span>
                <span
                  className={`shrink-0 text-sm font-bold ${
                    on ? "text-moss-600" : "text-sand-300"
                  }`}
                >
                  {on ? "✓ 차감" : "선택"}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setSelected(null)}
          className={`mt-2 w-full rounded-lg px-3 py-2 text-xs font-medium transition ${
            selected === null
              ? "bg-sand-200 text-sand-700"
              : "bg-sand-100 text-sand-500"
          }`}
        >
          회수권 차감 안 함 (일반 완료)
        </button>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-sand-200 px-4 py-2 text-sm text-sand-700 disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="rounded-lg bg-moss-600 px-4 py-2 text-sm font-semibold text-white hover:bg-moss-700 disabled:opacity-60"
          >
            {saving
              ? "처리 중..."
              : selected
              ? "완료 + 차감"
              : "완료"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ====================== 일별 그리드 ======================

function DayGrid({
  practitioners,
  reservations,
  onCellClick,
  onReservationClick,
  onQuickComplete,
}: {
  practitioners: string[];
  reservations: Reservation[];
  onCellClick: (practitionerName: string, hour: number, minute: number) => void;
  onReservationClick: (r: Reservation) => void;
  onQuickComplete: (r: Reservation) => void;
}) {
  const slots = useMemo(() => {
    const arr: Array<{ h: number; m: number }> = [];
    for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
      arr.push({ h, m: 0 });
      arr.push({ h, m: 30 });
    }
    return arr;
  }, []);

  // 셀별 예약 매핑 — 시술자 이름 × "HH:MM"
  const cellMap = useMemo(() => {
    const m = new Map<string, Reservation>();
    for (const r of reservations) {
      const { h, m: mm } = hourFromIso(r.scheduledAt);
      const slotMin = mm < 30 ? 0 : 30;
      const key = `${r.practitionerName?.trim() ?? ""}-${pad(h)}:${pad(slotMin)}`;
      m.set(key, r);
    }
    return m;
  }, [reservations]);

  // 시술자 미지정 예약이 있거나 등록된 시술자가 없으면 "미지정" 칸 노출
  const hasUnassigned = reservations.some((r) => !r.practitionerName?.trim());
  const colDefs: Array<{ key: string; name: string }> = [
    ...practitioners.map((n) => ({ key: n, name: n })),
    ...(hasUnassigned || practitioners.length === 0
      ? [{ key: "", name: "미지정" }]
      : []),
  ];

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-px bg-sand-200 text-xs"
        style={{
          gridTemplateColumns: `60px repeat(${colDefs.length}, minmax(120px, 1fr))`,
        }}
      >
        {/* Header */}
        <div className="sticky left-0 z-10 bg-sand-100 py-2 text-center font-medium text-sand-500">
          시간
        </div>
        {colDefs.map((c) => (
          <div
            key={c.key || "_"}
            className="bg-sand-100 py-2 text-center font-semibold text-sand-700"
          >
            {c.name}
          </div>
        ))}

        {/* Slots */}
        {slots.map(({ h, m }) => (
          <FragmentRow
            key={`${h}-${m}`}
            hour={h}
            minute={m}
            cols={colDefs}
            cellMap={cellMap}
            onCellClick={onCellClick}
            onReservationClick={onReservationClick}
            onQuickComplete={onQuickComplete}
          />
        ))}
      </div>
    </div>
  );
}

const STATUS_COLOR: Record<ReservationStatus, string> = {
  scheduled: "bg-clay-500/20 border-clay-500/50 text-clay-800",
  completed: "bg-moss-500/20 border-moss-500/50 text-moss-800",
  cancelled: "bg-sand-200 border-sand-300 text-sand-400 line-through",
  no_show: "bg-rose-100 border-rose-300 text-rose-700",
};

function FragmentRow({
  hour,
  minute,
  cols,
  cellMap,
  onCellClick,
  onReservationClick,
  onQuickComplete,
}: {
  hour: number;
  minute: number;
  cols: Array<{ key: string; name: string }>;
  cellMap: Map<string, Reservation>;
  onCellClick: (practitionerName: string, hour: number, minute: number) => void;
  onReservationClick: (r: Reservation) => void;
  onQuickComplete: (r: Reservation) => void;
}) {
  return (
    <>
      <div className="sticky left-0 z-10 bg-white py-2 text-center text-sand-500 tabular">
        {pad(hour)}:{pad(minute)}
      </div>
      {cols.map((c) => {
        const key = `${c.key}-${pad(hour)}:${pad(minute)}`;
        const r = cellMap.get(key);
        if (r) {
          return (
            <div
              key={key}
              className={`relative min-h-[44px] border-l-2 ${STATUS_COLOR[r.status]}`}
            >
              <button
                type="button"
                onClick={() => onReservationClick(r)}
                className="block w-full px-2 py-1 pr-6 text-left"
              >
                <div className="truncate text-[11px] font-semibold">
                  {r.patientName ?? "(이름 없음)"}
                </div>
                {r.serviceName && (
                  <div className="truncate text-[10px] opacity-70">
                    {r.serviceName}
                  </div>
                )}
                {r.memo && (
                  <div className="truncate text-[10px] italic opacity-70">
                    📝 {r.memo}
                  </div>
                )}
              </button>
              {r.status !== "cancelled" && (
                <button
                  type="button"
                  onClick={() => onQuickComplete(r)}
                  title={r.status === "completed" ? "완료 취소" : "시술완료"}
                  className={`absolute right-0.5 top-0.5 rounded px-1 py-0.5 text-[11px] font-bold ${
                    r.status === "completed"
                      ? "bg-white/60 text-moss-700"
                      : "bg-white/70 text-sand-500 hover:text-moss-700"
                  }`}
                >
                  {r.status === "completed" ? "↩" : "✓"}
                </button>
              )}
            </div>
          );
        }
        return (
          <button
            key={key}
            type="button"
            onClick={() => onCellClick(c.key, hour, minute)}
            className="min-h-[44px] bg-white hover:bg-clay-500/5"
            aria-label={`${pad(hour)}:${pad(minute)} ${c.name} 슬롯`}
          />
        );
      })}
    </>
  );
}

// ====================== 예약 폼 모달 ======================

function ReservationForm({
  centerId,
  owners,
  patients,
  services,
  myPart,
  knownPractitioners,
  defaultPractitioner,
  initial,
  onClose,
  onSaved,
}: {
  centerId: string;
  owners: UserProfile[];
  patients: Patient[];
  services: ReturnType<typeof useAllServices>["services"];
  myPart: PartId | null;
  knownPractitioners: string[];
  defaultPractitioner: string;
  initial: Reservation | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial?.id;
  type FormState = {
    ownerId: string | null;
    practitionerName: string;
    partId: PartId;
    patientId: string | null;
    patientName: string;
    patientPhone: string;
    scheduledAt: string;
    durationMin: number;
    serviceId: string | null;
    serviceName: string;
    status: ReservationStatus;
    memo: string;
  };
  const [form, setForm] = useState<FormState>(() => ({
    ownerId: initial?.ownerId ?? owners[0]?.id ?? null,
    practitionerName: initial?.practitionerName ?? defaultPractitioner,
    partId: (initial?.partId ?? myPart ?? "scalp") as PartId,
    patientId: initial?.patientId ?? null,
    patientName: initial?.patientName ?? "",
    patientPhone: initial?.patientPhone ?? "",
    scheduledAt:
      initial?.scheduledAt ?? new Date().toISOString().slice(0, 16),
    durationMin: initial?.durationMin ?? 30,
    serviceId: initial?.serviceId ?? null,
    serviceName: initial?.serviceName ?? "",
    status: initial?.status ?? "scheduled",
    memo: initial?.memo ?? "",
  }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [patientQuery, setPatientQuery] = useState(initial?.patientName ?? "");

  // datetime-local 입력 변환
  const dtLocal = useMemo(() => {
    if (!form.scheduledAt) return "";
    // form.scheduledAt 이 +09:00 ISO 또는 그냥 yyyy-mm-ddTHH:MM 형태일 수 있음
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(form.scheduledAt)) {
      return form.scheduledAt.slice(0, 16);
    }
    return new Date(form.scheduledAt).toISOString().slice(0, 16);
  }, [form.scheduledAt]);

  const filteredPatients = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return [];
    return patients
      .filter((p) => {
        const name = p.personal?.name?.toLowerCase() ?? "";
        const phone = p.personal?.phone ?? "";
        return name.includes(q) || phone.includes(q) || p.id.toLowerCase().includes(q);
      })
      .slice(0, 8);
  }, [patientQuery, patients]);

  const partServices = useMemo(
    () => services.filter((s) => s.partId === form.partId && s.active),
    [services, form.partId]
  );

  async function handleSave() {
    setError(null);
    if (!form.patientName.trim() && !form.patientId) {
      setError("환자 이름 또는 기존 환자 선택이 필요합니다.");
      return;
    }
    setSaving(true);
    try {
      const data = await getDataSource();
      // scheduled_at: datetime-local 입력은 시간대 정보 없음 → KST(+09:00) 명시
      const scheduledAt = `${dtLocal}:00+09:00`;
      const payload = {
        ownerId: form.ownerId,
        practitionerName: form.practitionerName.trim() || null,
        patientId: form.patientId,
        patientName: form.patientName.trim() || null,
        patientPhone: form.patientPhone.trim() || null,
        scheduledAt,
        durationMin: Number(form.durationMin) || 30,
        serviceId: form.serviceId,
        serviceName: form.serviceName.trim() || null,
        status: form.status as ReservationStatus,
        memo: form.memo.trim() || null,
      };
      if (isEdit && initial) {
        await data.reservations.update(initial.id, payload);
      } else {
        await data.reservations.create({
          centerId,
          partId: form.partId,
          ...payload,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initial?.id) return;
    if (!window.confirm("이 예약을 삭제하시겠어요?")) return;
    setSaving(true);
    try {
      const data = await getDataSource();
      await data.reservations.delete(initial.id);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-sand-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-base font-bold text-sand-900">
            {isEdit ? "예약 수정" : "신규 예약"}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sand-400 hover:text-sand-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {/* 환자 검색 / 입력 */}
          <Field label="환자 (이름/연락처/번호로 검색)">
            <input
              value={patientQuery}
              onChange={(e) => {
                setPatientQuery(e.target.value);
                setForm({
                  ...form,
                  patientId: null,
                  patientName: e.target.value,
                });
              }}
              placeholder="기존 환자 검색 또는 새 이름 입력"
              className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
            />
            {filteredPatients.length > 0 && (
              <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-sand-200 bg-white">
                {filteredPatients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setForm({
                        ...form,
                        patientId: p.id,
                        patientName: p.personal?.name ?? "",
                        patientPhone: p.personal?.phone ?? "",
                      });
                      setPatientQuery(p.personal?.name ?? "");
                    }}
                    className="block w-full px-3 py-1.5 text-left text-xs hover:bg-sand-50"
                  >
                    <span className="font-medium">
                      {p.personal?.name ?? "(이름 없음)"}
                    </span>
                    <span className="ml-2 text-[10px] text-sand-500">
                      {p.id} · {p.personal?.phone ?? "-"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Field>

          <Field label="연락처">
            <input
              value={form.patientPhone}
              onChange={(e) =>
                setForm({ ...form, patientPhone: e.target.value })
              }
              placeholder="010-0000-0000"
              className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm tabular focus:border-clay-400 focus:outline-none"
            />
          </Field>

          <Field label="시간">
            <input
              type="datetime-local"
              value={dtLocal}
              onChange={(e) =>
                setForm({ ...form, scheduledAt: e.target.value })
              }
              className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="시간 (분)">
              <input
                type="number"
                value={form.durationMin}
                onChange={(e) =>
                  setForm({ ...form, durationMin: Number(e.target.value) || 30 })
                }
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-right text-sm tabular focus:border-clay-400 focus:outline-none"
              />
            </Field>
            <Field label="상태">
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value as ReservationStatus,
                  })
                }
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm"
              >
                {Object.entries(RESERVATION_STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {!myPart && (
            <Field label="파트">
              <select
                value={form.partId}
                onChange={(e) =>
                  setForm({ ...form, partId: e.target.value as PartId })
                }
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm"
              >
                {PARTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="시술자 (이름)">
            <input
              list="practitioner-list"
              value={form.practitionerName}
              onChange={(e) =>
                setForm({ ...form, practitionerName: e.target.value })
              }
              placeholder="시술자 이름 입력 (예약 칸이 이름별로 나뉘어요)"
              className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
            />
            <datalist id="practitioner-list">
              {knownPractitioners.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </Field>

          {owners.length > 1 && (
            <Field label="담당 원장 (계정)">
              <select
                value={form.ownerId ?? ""}
                onChange={(e) =>
                  setForm({ ...form, ownerId: e.target.value || null })
                }
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">(미지정)</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.displayName}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="시술 (선택)">
            <select
              value={form.serviceId ?? ""}
              onChange={(e) => {
                const id = e.target.value || null;
                const svc = id ? partServices.find((s) => s.id === id) : null;
                setForm({
                  ...form,
                  serviceId: id,
                  serviceName: svc?.name ?? form.serviceName,
                });
              }}
              className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">(직접 입력)</option>
              {partServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="시술명 (스냅샷)">
            <input
              value={form.serviceName}
              onChange={(e) =>
                setForm({ ...form, serviceName: e.target.value })
              }
              placeholder="시술 직접 입력 가능"
              className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
            />
          </Field>

          <Field label="메모">
            <textarea
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
            />
          </Field>

          {error && (
            <div className="rounded-lg bg-clay-500/10 px-3 py-2 text-xs text-clay-700">
              {error}
            </div>
          )}

          <div className="flex justify-between gap-2 pt-2">
            {isEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="rounded-lg border border-rose-300 px-3 py-2 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
              >
                삭제
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-sand-200 px-4 py-2 text-sm text-sand-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-sand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-sand-900 disabled:opacity-60"
              >
                {saving ? "저장 중..." : isEdit ? "수정 저장" : "등록"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs">
      <div className="mb-1 font-medium text-sand-600">{label}</div>
      {children}
    </label>
  );
}
