import type {
  DailyEntryCreateInput,
  DataSource,
  PatientCreateInput,
  VisitCreateInput,
} from "./source";
import type {
  DailyEntry,
  InflowEntry,
  Patient,
  SettlementRule,
  Visit,
} from "@/lib/types";
import { DEFAULT_RULE } from "@/lib/types";
import { MOCK_CENTERS, MOCK_ENTRIES, MOCK_INFLOWS } from "@/lib/mock";
import {
  MOCK_PATIENTS,
  MOCK_VISITS,
  generateNextPatientId,
} from "@/lib/patient";

// 메모리 store — 데모용. 새로고침하면 mock 시드로 리셋.
const store = {
  centers: [...MOCK_CENTERS],
  patients: [...MOCK_PATIENTS],
  visits: [...MOCK_VISITS],
  entries: [...MOCK_ENTRIES],
  inflows: [...MOCK_INFLOWS],
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export const mockDataSource: DataSource = {
  centers: {
    async list() {
      return clone(store.centers);
    },
    async current() {
      return clone(store.centers[0] ?? null);
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
