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
    id: "u-main",
    email: "jaewonhyeon9@gmail.com",
    role: "admin",
    centerId: null,
    partId: null,
    displayName: "법인 메인",
    active: true,
    createdAt: "2026-01-01T00:00:00",
  },
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

type MockStore = {
  centers: Center[];
  patients: Patient[];
  visits: Visit[];
  entries: DailyEntry[];
  inflows: InflowEntry[];
  users: UserProfile[];
};

const STORE_KEY = "annyeong-local-store-v1";

function seedStore(): MockStore {
  return {
    centers: clone(MOCK_CENTERS),
    patients: clone(MOCK_PATIENTS),
    visits: clone(MOCK_VISITS),
    entries: clone(MOCK_ENTRIES),
    inflows: clone(MOCK_INFLOWS),
    users: clone(MOCK_USERS),
  };
}

// 메모리 store + 브라우저 localStorage 영속화.
let store: MockStore = {
  centers: [...MOCK_CENTERS],
  patients: [...MOCK_PATIENTS],
  visits: [...MOCK_VISITS],
  entries: [...MOCK_ENTRIES],
  inflows: [...MOCK_INFLOWS],
  users: [...MOCK_USERS],
};
let hydrated = false;

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

// 기존 사용자 유지 + 시드의 누락 사용자 자동 보강
// (앱 업데이트로 새 시드 admin 등 추가 시 기존 localStorage에도 반영됨)
function mergeUsers(
  parsed: UserProfile[] | undefined,
  seeded: UserProfile[]
): UserProfile[] {
  if (!parsed) return seeded;
  const existingIds = new Set(parsed.map((u) => u.id));
  const existingEmails = new Set(parsed.map((u) => u.email.toLowerCase()));
  const missing = seeded.filter(
    (u) => !existingIds.has(u.id) && !existingEmails.has(u.email.toLowerCase())
  );
  return [...missing, ...parsed];
}

function hydrateStore() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      store = seedStore();
      persistStore();
      return;
    }
    const parsed = JSON.parse(raw) as Partial<MockStore>;
    const seeded = seedStore();
    store = {
      centers: parsed.centers ?? seeded.centers,
      patients: parsed.patients ?? seeded.patients,
      visits: parsed.visits ?? seeded.visits,
      entries: parsed.entries ?? seeded.entries,
      inflows: parsed.inflows ?? seeded.inflows,
      users: mergeUsers(parsed.users, seeded.users),
    };
    persistStore(); // 시드 보강된 사용자 다시 저장
  } catch {
    store = seedStore();
  }
}

function persistStore() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // Storage can be unavailable in private modes. In-memory still works.
  }
}

function readStore() {
  hydrateStore();
  return store;
}

function commit(mutator: (s: MockStore) => void) {
  hydrateStore();
  mutator(store);
  persistStore();
}

export const mockDataSource: DataSource = {
  me: {
    async current() {
      const id = getCurrentMockUserId();
      if (!id) return null;
      const found = readStore().users.find((u) => u.id === id);
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
      const store = readStore();
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
      commit((store) => {
        store.users = [user, ...store.users];
      });
      return clone(user);
    },
    async update(id, patch) {
      const store = readStore();
      const idx = store.users.findIndex((u) => u.id === id);
      if (idx < 0) throw new Error(`user not found: ${id}`);
      const updated = { ...store.users[idx], ...patch };
      commit((store) => {
        store.users[idx] = updated;
      });
      return clone(updated);
    },
    async resetPassword(_id, _newPassword) {
      // Mock mode — pretend to reset
    },
  },

  centers: {
    async list() {
      return clone(readStore().centers);
    },
    async current() {
      return clone(readStore().centers[0] ?? null);
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
      commit((store) => {
        store.centers = [...store.centers, center];
      });
      return clone(center);
    },
    async update(id, patch) {
      const store = readStore();
      const idx = store.centers.findIndex((c) => c.id === id);
      if (idx < 0) throw new Error(`center not found: ${id}`);
      const updated = { ...store.centers[idx], ...patch };
      commit((store) => {
        store.centers[idx] = updated;
      });
      return clone(updated);
    },
  },

  patients: {
    async list(centerId) {
      const store = readStore();
      const filtered = centerId
        ? store.patients.filter((p) => p.centerId === centerId)
        : store.patients;
      return clone(filtered);
    },
    async get(id) {
      const found = readStore().patients.find((p) => p.id === id);
      return found ? clone(found) : null;
    },
    async create(input: PatientCreateInput) {
      const store = readStore();
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
      commit((store) => {
        store.patients = [patient, ...store.patients];
      });
      return clone(patient);
    },
    async update(id, patch) {
      const store = readStore();
      const idx = store.patients.findIndex((p) => p.id === id);
      if (idx < 0) throw new Error(`patient not found: ${id}`);
      const updated = {
        ...store.patients[idx],
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      commit((store) => {
        store.patients[idx] = updated;
      });
      return clone(updated);
    },
  },

  visits: {
    async listByPatient(patientId) {
      const store = readStore();
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
        beforePhotoUrl: input.beforePhotoUrl,
        afterPhotoUrl: input.afterPhotoUrl,
        createdAt: new Date().toISOString(),
      };
      commit((store) => {
        store.visits = [visit, ...store.visits];
      });
      return clone(visit);
    },
  },

  entries: {
    async byMonth(centerId, yearMonth) {
      const store = readStore();
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
      commit((store) => {
        store.entries = [entry, ...store.entries];
      });
      return clone(entry);
    },
  },

  inflows: {
    async byMonth(centerId, month) {
      const found = readStore().inflows.find(
        (i) => i.centerId === centerId && i.month === month
      );
      return found ? clone(found) : null;
    },
    async upsert(entry: InflowEntry) {
      const store = readStore();
      const idx = store.inflows.findIndex(
        (i) => i.centerId === entry.centerId && i.month === entry.month
      );
      commit((store) => {
        if (idx >= 0) store.inflows[idx] = clone(entry);
        else store.inflows = [...store.inflows, clone(entry)];
      });
      return clone(entry);
    },
  },

  settlement: {
    async rule(_centerId: string): Promise<SettlementRule> {
      return { ...DEFAULT_RULE };
    },
  },
};
