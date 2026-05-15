import type { Patient, Visit, InflowChannel } from "./types";

// 환자 번호 자동 발급
// 포맷: C{센터순번}-{YYMM}-{4자리일련}  e.g. "C1-2605-0001"
//
// 이유:
// - 센터별 독립 시퀀스 (다중 센터 운영 대비)
// - 월 단위 grouping — 매월 1번부터 다시 시작 (월별 신규환자 카운트 용이)
// - 환자명/연락처 대신 의료법 안전 식별자로 사용

export function nextPatientId(
  centerOrdinal: number,
  yearMonth: string, // YYYY-MM
  existingForMonth: number
): string {
  const yy = yearMonth.slice(2, 4);
  const mm = yearMonth.slice(5, 7);
  const seq = String(existingForMonth + 1).padStart(4, "0");
  return `C${centerOrdinal}-${yy}${mm}-${seq}`;
}

// 기존 환자 ID 목록에서 다음 ID 산출
export function generateNextPatientId(
  patients: Patient[],
  centerOrdinal: number,
  yearMonth: string
): string {
  const prefix = `C${centerOrdinal}-${yearMonth.slice(2, 4)}${yearMonth.slice(5, 7)}-`;
  const monthCount = patients.filter((p) => p.id.startsWith(prefix)).length;
  return nextPatientId(centerOrdinal, yearMonth, monthCount);
}

// ============================================================
// Mock 데이터 — Phase 1 시연용
// ============================================================

function makePatient(
  id: string,
  inflow: InflowChannel[],
  firstVisit: string,
  personal?: NonNullable<Patient["personal"]>
): Patient {
  return {
    id,
    centerId: "center-1",
    firstVisitDate: firstVisit,
    inflowChannels: inflow,
    consent: true,
    personal: personal ? { ...personal } : undefined,
    chart: {
      conditions: [],
      careExperience: [],
      products: [],
      lifestyle: {},
      medications: [],
    },
    createdAt: `${firstVisit}T10:00:00`,
    updatedAt: `${firstVisit}T10:00:00`,
  };
}

export const MOCK_PATIENTS: Patient[] = [
  makePatient("C1-2605-0001", ["instagram"], "2026-05-02", {
    name: "홍길동",
    gender: "male",
  }),
  makePatient("C1-2605-0002", ["referral", "blog"], "2026-05-06", {
    name: "김민지",
    gender: "female",
  }),
  makePatient("C1-2605-0003", ["naver_place"], "2026-05-08", {
    name: "박서연",
    gender: "female",
  }),
  makePatient("C1-2605-0004", ["internet"], "2026-05-09", {
    name: "이재호",
    gender: "male",
  }),
  makePatient("C1-2605-0005", ["instagram", "referral"], "2026-05-13", {
    name: "최유나",
    gender: "female",
  }),
];

export const MOCK_VISITS: Visit[] = [
  {
    id: "v-1",
    patientId: "C1-2605-0001",
    centerId: "center-1",
    visitDate: "2026-05-02",
    partId: "scalp",
    sales: [
      {
        serviceId: "scalp.scaling",
        serviceName: "스케일링",
        partId: "scalp",
        cash: 0,
        card: 70000,
      },
    ],
    productSales: [],
    productConsumption: [],
    visitMemo: "첫 방문 — 두피 가려움 호소",
    createdAt: "2026-05-02T10:30:00",
  },
  {
    id: "v-2",
    patientId: "C1-2605-0001",
    centerId: "center-1",
    visitDate: "2026-05-09",
    partId: "scalp",
    sales: [
      {
        serviceId: "scalp.laser",
        serviceName: "레이저",
        partId: "scalp",
        cash: 0,
        card: 120000,
      },
    ],
    productSales: [],
    productConsumption: [],
    visitMemo: "2주차 — 호전됨",
    createdAt: "2026-05-09T15:00:00",
  },
  {
    id: "v-3",
    patientId: "C1-2605-0002",
    centerId: "center-1",
    visitDate: "2026-05-06",
    partId: "pedicure",
    sales: [
      {
        serviceId: "pedi.care",
        serviceName: "케어",
        partId: "pedicure",
        cash: 60000,
        card: 0,
      },
    ],
    productSales: [],
    productConsumption: [],
    createdAt: "2026-05-06T14:00:00",
  },
];

// 환자별 방문 횟수
export function visitCountByPatient(visits: Visit[], patientId: string): number {
  return visits.filter((v) => v.patientId === patientId).length;
}

// 환자의 모든 방문 (최신순)
export function visitsByPatient(visits: Visit[], patientId: string): Visit[] {
  return visits
    .filter((v) => v.patientId === patientId)
    .sort((a, b) => b.visitDate.localeCompare(a.visitDate));
}

// 환자 검색 (id 또는 이름)
export function searchPatients(patients: Patient[], q: string): Patient[] {
  if (!q.trim()) return patients;
  const k = q.toLowerCase();
  return patients.filter(
    (p) =>
      p.id.toLowerCase().includes(k) ||
      p.personal?.name?.toLowerCase().includes(k) ||
      p.personal?.phone?.replace(/-/g, "").includes(k.replace(/-/g, ""))
  );
}
