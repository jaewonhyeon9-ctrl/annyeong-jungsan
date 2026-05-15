import type {
  CenterCreateInput,
  DailyEntryCreateInput,
  DataSource,
  PatientCreateInput,
  VisitCreateInput,
} from "./source";
import type {
  Center,
  DailyEntry,
  InflowEntry,
  Patient,
  SettlementRule,
  UserCreateInput,
  UserProfile,
  Visit,
} from "@/lib/types";
import { DEFAULT_RULE } from "@/lib/types";
import { MOCK_CENTERS, MOCK_ENTRIES, MOCK_INFLOWS } from "@/lib/mock";
import {
  MOCK_PATIENTS,
  MOCK_VISITS,
  generateNextPatientId,
} from "@/lib/patient";

// Mock 사용자 — 시연용
const MOCK_USERS: UserProfile[] = [
  {
    id: "u-admin",
    email: "admin@annyeong.com",
    role: "admin",
    centerId: null,
    partId: null,
    displayName: "법인 관리자",
    active: true,
    createdAt: "2026-01-01T00:00:00",
  },
  {
    id: "u-scalp",
    email: "scalp@annyeong.com",
    role: "owner",
    centerId: "center-1",
    partId: "scalp",
    displayName: "두피 원장",
    active: true,
    createdAt: "2026-01-01T00:00:00",
  },
  {
    id: "u-permanent_makeup",
    email: "pm@annyeong.com",
    role: "owner",
    centerId: "center-1",
    partId: "permanent_makeup",
    displayName: "반영구 원장",
    active: true,
    createdAt: "2026-01-01T00:00:00",
  },
  {
    id: "u-smp",
    email: "smp@annyeong.com",
    role: "owner",
    centerId: "center-1",
    partId: "smp",
    displayName: "SMP 원장",
    active: true,
    createdAt: "2026-01-01T00:00:00",
  },
  {
    id: "u-pedicure",
    email: "pedi@annyeong.com",
    role: "owner",
    centerId: "center-1",
    partId: "pedicure",
    displayName: "패디큐어 원장",
    active: true,
    createdAt: "2026-01-01T00:00:00",
  },
  {
    id: "u-skincare",
    email: "skin@annyeong.com",
    role: "owner",
    centerId: "center-1",
    partId: "skincare",
    displayName: "피부관리 원장",
    active: true,
    createdAt: "2026-01-01T00:00:00",
  },
];

// 메모리 store — 데모용. 새로고침하면 mock 시드로 리셋.
const store = {
  centers: [...MOCK_CENTERS],
  patients: [...MOCK_PATIENTS],
  visits: [...MOCK_VISITS],
  entries: [...MOCK_ENTRIES],
  inflows: [...MOCK_INFLOWS],
  users: [...MOCK_USERS],
};

// 현재 사용자 — localStorage 에 저장 (mock 모드 데모용)
const ME_KEY = "mock-current-user-id";

function getCurrentMockUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ME_KEY);
}

function setCurrentMockUserId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(ME_KEY, id);
  else localStorage.removeItem(ME_KEY);
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export const mockDataSource: DataSource = {
  me: {
    async current() {
      const id = getCurrentMockUserId();
      if (!id) return null;
      const found = store.users.find((u) => u.id === id);
      return found ? clone(found) : null;
    },
    setMock(profile) {
      setCurrentMockUserId(profile?.id ?? null);
    },
    async logout() {
      setCurrentMockUserId(null);
    },
  },

  users: {
    async list(centerId) {
      const filtered = centerId
        ? store.users.filter((u) => u.centerId === centerId)
        : store.users;
      return clone(filtered);
    },
    async create(input: UserCreateInput) {
      const user: UserProfile = {
        id: `u-${Math.random().toString(36).slice(2, 10)}`,
        email: input.email,
        role: input.role,
        centerId: input.centerId,
        partId: input.partId,
        displayName: input.displayName,
        active: input.active ?? true,
        phone: input.phone,
        bankAccount: input.bankAccount,
        businessNumber: input.businessNumber,
        contractStartDate: input.contractStartDate,
        memo: input.memo,
        createdAt: new Date().toISOString(),
      };
      store.users = [user, ...store.users];
      return clone(user);
    },
    async update(id, patch) {
      const idx = store.users.findIndex((u) => u.id === id);
      if (idx < 0) throw new Error(`user not found: ${id}`);
      store.users[idx] = { ...store.users[idx], ...patch };
      return clone(store.users[idx]);
    },
    async resetPassword(_id, _newPassword) {
      // Mock mode — pretend to reset
    },
  },

  centers: {
    async list() {
      return clone(store.centers);
    },
    async current() {
      return clone(store.centers[0] ?? null);
    },
    async create(input: CenterCreateInput) {
      const center: Center = {
        id: `center-${Math.random().toString(36).slice(2, 8)}`,
        name: input.name,
        enabledParts: input.enabledParts,
        address: input.address,
        phone: input.phone,
        createdAt: new Date().toISOString(),
      };
      store.centers = [...store.centers, center];
      return clone(center);
    },
    async update(id, patch) {
      const idx = store.centers.findIndex((c) => c.id === id);
      if (idx < 0) throw new Error(`center not found: ${id}`);
      store.centers[idx] = { ...store.centers[idx], ...patch };
      return clone(store.centers[idx]);
    },
  },

  patients: {
    async list(centerId) {
      const filtered = centerId
        ? store.patients.filter((p) => p.centerId === centerId)
        : store.patients;
      return clone(filtered);
    },
    async get(id) {
      const found = store.patients.find((p) => p.id === id);
      return found ? clone(found) : null;
    },
    async create(input: PatientCreateInput) {
      const month = input.firstVisitDate.slice(0, 7);
      const id = input.id ?? generateNextPatientId(store.patients, 1, month);
      const now = new Date().toISOString();
      const patient: Patient = {
        id,
        centerId: input.centerId,
        firstVisitDate: input.firstVisitDate,
        inflowChannels: input.inflowChannels,
        consent: input.consent,
        personal: input.personal,
        chart: input.chart ?? {
          conditions: [],
          careExperience: [],
          products: [],
          lifestyle: {},
          medications: [],
        },
        createdAt: now,
        updatedAt: now,
      };
      store.patients = [patient, ...store.patients];
      return clone(patient);
    },
    async update(id, patch) {
      const idx = store.patients.findIndex((p) => p.id === id);
      if (idx < 0) throw new Error(`patient not found: ${id}`);
      const updated = {
        ...store.patients[idx],
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      store.patients[idx] = updated;
      return clone(updated);
    },
  },

  visits: {
    async listByPatient(patientId) {
      return clone(
        store.visits
          .filter((v) => v.patientId === patientId)
          .sort((a, b) => b.visitDate.localeCompare(a.visitDate))
      );
    },
    async create(input: VisitCreateInput) {
      const visit: Visit = {
        id: `v-${Math.random().toString(36).slice(2, 10)}`,
        patientId: input.patientId,
        centerId: input.centerId,
        visitDate: input.visitDate,
        partId: input.partId,
        sales: input.sales,
        productSales: input.productSales ?? [],
        productConsumption: input.productConsumption ?? [],
        visitMemo: input.visitMemo,
        createdAt: new Date().toISOString(),
      };
      store.visits = [visit, ...store.visits];
      return clone(visit);
    },
  },

  entries: {
    async byMonth(centerId, yearMonth) {
      const manual = store.entries.filter(
        (e) => e.centerId === centerId && e.date.startsWith(yearMonth)
      );

      // 방문 차트도 일자별로 합쳐 가상 entry로 변환
      const visits = store.visits.filter(
        (v) => v.centerId === centerId && v.visitDate.startsWith(yearMonth)
      );
      const grouped = new Map<string, Visit[]>();
      for (const v of visits) {
        const arr = grouped.get(v.visitDate) ?? [];
        arr.push(v);
        grouped.set(v.visitDate, arr);
      }
      const visitEntries: DailyEntry[] = Array.from(grouped.entries()).map(
        ([date, vs]) => ({
          id: `visit-${centerId}-${date}`,
          centerId,
          date,
          sales: vs.flatMap((v) => v.sales),
          productSales: vs.flatMap((v) => v.productSales),
          productConsumption: vs.flatMap((v) => v.productConsumption),
          note: `방문 ${vs.length}건 (자동집계)`,
          createdAt: vs[0].createdAt,
        })
      );

      // 같은 날짜에 manual + visit 동시에 있으면 둘 다 따로 보여줌 (id 다름)
      return clone([...manual, ...visitEntries]).sort((a, b) =>
        a.date.localeCompare(b.date)
      );
    },
    async create(input: DailyEntryCreateInput) {
      const entry: DailyEntry = {
        id: `e-${Math.random().toString(36).slice(2, 10)}`,
        centerId: input.centerId,
        date: input.date,
        sales: input.sales,
        productSales: input.productSales ?? [],
        productConsumption: input.productConsumption ?? [],
        note: input.note,
        ocrSource: input.ocrSource,
        createdAt: new Date().toISOString(),
      };
      store.entries = [entry, ...store.entries];
      return clone(entry);
    },
  },

  inflows: {
    async byMonth(centerId, month) {
      const found = store.inflows.find(
        (i) => i.centerId === centerId && i.month === month
      );
      return found ? clone(found) : null;
    },
    async upsert(entry: InflowEntry) {
      const idx = store.inflows.findIndex(
        (i) => i.centerId === entry.centerId && i.month === entry.month
      );
      if (idx >= 0) store.inflows[idx] = clone(entry);
      else store.inflows = [...store.inflows, clone(entry)];
      return clone(entry);
    },
  },

  settlement: {
    async rule(_centerId: string): Promise<SettlementRule> {
      return { ...DEFAULT_RULE };
    },
  },
};
