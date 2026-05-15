import type { Center, DailyEntry, InflowEntry } from "./types";
import { SERVICES } from "./services";
import { emptyChannels } from "./types";

// Phase 1 시연용 mock 데이터. Phase 2에서 Supabase로 교체.

export const MOCK_CENTERS: Center[] = [
  {
    id: "center-1",
    name: "안녕메디컬 본점",
    enabledParts: ["scalp", "permanent_makeup", "smp", "pedicure", "skincare"],
    address: "서울 강남구",
    phone: "02-0000-0000",
    ownerName: "원장 김OO",
    createdAt: "2025-01-01",
  },
];

function entry(
  id: string,
  centerId: string,
  date: string,
  rows: { serviceId: string; cash?: number; card?: number }[],
  note?: string
): DailyEntry {
  return {
    id,
    centerId,
    date,
    sales: rows.map((r) => {
      const svc = SERVICES.find((s) => s.id === r.serviceId)!;
      return {
        serviceId: r.serviceId,
        serviceName: svc.name,
        partId: svc.partId,
        cash: r.cash ?? 0,
        card: r.card ?? 0,
      };
    }),
    productSales: [],
    productConsumption: [],
    note,
    createdAt: `${date}T18:00:00`,
  };
}

// 2026-05 한 달치 데모 데이터 (요일별 매출 패턴 흉내)
export const MOCK_ENTRIES: DailyEntry[] = [
  entry("e1", "center-1", "2026-05-02", [
    { serviceId: "scalp.scaling", card: 70000 },
    { serviceId: "pm.eyebrow", card: 250000 },
    { serviceId: "skin.facial", cash: 100000 },
  ]),
  entry("e2", "center-1", "2026-05-03", [
    { serviceId: "scalp.laser", card: 120000 },
    { serviceId: "smp.partial", card: 500000 },
  ]),
  entry("e3", "center-1", "2026-05-06", [
    { serviceId: "pedi.care", cash: 60000 },
    { serviceId: "scalp.gakjil", cash: 50000 },
    { serviceId: "scalp.naeseong", card: 80000 },
  ]),
  entry("e4", "center-1", "2026-05-07", [
    { serviceId: "pm.lip", card: 350000 },
    { serviceId: "skin.lifting", card: 150000 },
  ]),
  entry("e5", "center-1", "2026-05-08", [
    { serviceId: "smp.full", card: 1500000 },
    { serviceId: "pedi.basic", cash: 40000 },
  ]),
  entry("e6", "center-1", "2026-05-09", [
    { serviceId: "scalp.scaling", card: 70000 },
    { serviceId: "scalp.laser", card: 120000 },
    { serviceId: "pm.eyeline", card: 200000 },
    { serviceId: "skin.peeling", cash: 90000 },
  ]),
  entry("e7", "center-1", "2026-05-10", [
    { serviceId: "pedi.nailart", card: 80000 },
    { serviceId: "pedi.care", cash: 60000 },
  ]),
  entry("e8", "center-1", "2026-05-13", [
    { serviceId: "scalp.naeseong", card: 80000 },
    { serviceId: "pm.hairline", card: 400000 },
    { serviceId: "smp.retouch", card: 200000 },
    { serviceId: "skin.massage", cash: 80000 },
  ]),
  entry("e9", "center-1", "2026-05-14", [
    { serviceId: "scalp.laser", card: 120000 },
    { serviceId: "pm.eyebrow", card: 250000 },
    { serviceId: "pedi.basic", cash: 40000 },
    { serviceId: "skin.facial", card: 100000 },
  ], "OCR 자동저장 — 신뢰도 96%"),
];

export const MOCK_INFLOWS: InflowEntry[] = [
  {
    id: "inflow-1",
    centerId: "center-1",
    month: "2026-05",
    channels: {
      ...emptyChannels(),
      instagram: 18,
      blog: 8,
      naver_place: 15,
      internet: 22,
      outdoor: 4,
      phone: 12,
      visitor: 9,
      referral: 7,
      other: 2,
    },
    newPatients: 24,
  },
];
