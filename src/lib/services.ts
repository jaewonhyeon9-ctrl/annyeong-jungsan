import { useEffect, useState } from "react";
import type { PartId, Service, ServiceRecord } from "./types";
import { getDataSource } from "./data";

// 파트별 시술 카탈로그 — 두피는 엑셀 양식 기준, 나머지 4개 파트는 일반적 시술로 초안.
// 운영 중 admin에서 자유롭게 추가/수정 예정.

export const SERVICES: Service[] = [
  // 두피
  { id: "scalp.naeseong", partId: "scalp", name: "내성", defaultPrice: 80000 },
  { id: "scalp.gakjil", partId: "scalp", name: "발각질", defaultPrice: 50000 },
  { id: "scalp.scaling", partId: "scalp", name: "스케일링", defaultPrice: 70000 },
  { id: "scalp.laser", partId: "scalp", name: "레이저", defaultPrice: 120000 },

  // 반영구
  { id: "pm.eyebrow", partId: "permanent_makeup", name: "눈썹", defaultPrice: 250000 },
  { id: "pm.eyeline", partId: "permanent_makeup", name: "아이라인", defaultPrice: 200000 },
  { id: "pm.lip", partId: "permanent_makeup", name: "입술", defaultPrice: 350000 },
  { id: "pm.hairline", partId: "permanent_makeup", name: "헤어라인", defaultPrice: 400000 },

  // SMP
  { id: "smp.partial", partId: "smp", name: "부분", defaultPrice: 500000 },
  { id: "smp.full", partId: "smp", name: "전체", defaultPrice: 1500000 },
  { id: "smp.retouch", partId: "smp", name: "리터치", defaultPrice: 200000 },

  // 패디큐어
  { id: "pedi.basic", partId: "pedicure", name: "기본", defaultPrice: 40000 },
  { id: "pedi.care", partId: "pedicure", name: "케어", defaultPrice: 60000 },
  { id: "pedi.nailart", partId: "pedicure", name: "네일아트", defaultPrice: 80000 },

  // 피부관리
  { id: "skin.facial", partId: "skincare", name: "페이셜", defaultPrice: 100000 },
  { id: "skin.lifting", partId: "skincare", name: "리프팅", defaultPrice: 150000 },
  { id: "skin.peeling", partId: "skincare", name: "필링", defaultPrice: 90000 },
  { id: "skin.massage", partId: "skincare", name: "마사지", defaultPrice: 80000 },
];

// ----- Custom services (원장이 등록한 시술) -----
// 브라우저 localStorage 에 영속화. SSR 안전.

export interface CustomService extends Service {
  active: boolean;
  sortOrder?: number;
  createdBy?: string; // userId
  createdAt?: string;
}

const CUSTOM_SERVICES_KEY = "annyeong-custom-services-v1";

let customServices: CustomService[] = [];
let customLoaded = false;

function loadCustomServices(): void {
  if (customLoaded) return;
  if (typeof window === "undefined") return;
  customLoaded = true;
  try {
    const raw = window.localStorage.getItem(CUSTOM_SERVICES_KEY);
    if (raw) customServices = JSON.parse(raw) as CustomService[];
  } catch {
    customServices = [];
  }
}

function persistCustomServices(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CUSTOM_SERVICES_KEY,
      JSON.stringify(customServices)
    );
  } catch {
    // private mode 등 — 메모리는 유지
  }
}

export function getCustomServices(): CustomService[] {
  loadCustomServices();
  return [...customServices];
}

export function isBuiltinService(id: string): boolean {
  return SERVICES.some((s) => s.id === id);
}

export function addCustomService(
  input: Omit<CustomService, "active" | "createdAt"> & { active?: boolean }
): CustomService {
  loadCustomServices();
  if (customServices.some((s) => s.id === input.id) || isBuiltinService(input.id)) {
    throw new Error(`이미 사용 중인 ID 입니다: ${input.id}`);
  }
  const created: CustomService = {
    id: input.id,
    partId: input.partId,
    name: input.name,
    defaultPrice: input.defaultPrice,
    sortOrder: input.sortOrder,
    createdBy: input.createdBy,
    active: input.active ?? true,
    createdAt: new Date().toISOString(),
  };
  customServices = [created, ...customServices];
  persistCustomServices();
  return created;
}

export function updateCustomService(
  id: string,
  patch: Partial<Omit<CustomService, "id" | "createdAt">>
): CustomService | null {
  loadCustomServices();
  const idx = customServices.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  const updated: CustomService = { ...customServices[idx], ...patch };
  customServices = customServices.map((s, i) => (i === idx ? updated : s));
  persistCustomServices();
  return updated;
}

export function removeCustomService(id: string): boolean {
  loadCustomServices();
  const before = customServices.length;
  customServices = customServices.filter((s) => s.id !== id);
  if (customServices.length === before) return false;
  persistCustomServices();
  return true;
}

export function servicesByPart(partId: PartId): Service[] {
  loadCustomServices();
  const builtin = SERVICES.filter((s) => s.partId === partId);
  const custom = customServices.filter((s) => s.partId === partId && s.active);
  return [...builtin, ...custom];
}

export function findService(id: string): Service | undefined {
  loadCustomServices();
  return (
    SERVICES.find((s) => s.id === id) ||
    customServices.find((s) => s.id === id)
  );
}

// ============================================================
// Supabase services 테이블 기반 hook — single source of truth
// ============================================================
// 모듈-수준 캐시: 한 번 fetch한 결과를 페이지 간 공유 + 무효화 가능

let _cache: ServiceRecord[] | null = null;
let _cachePromise: Promise<ServiceRecord[]> | null = null;
const _listeners = new Set<() => void>();

async function fetchServicesFromSource(): Promise<ServiceRecord[]> {
  const data = await getDataSource();
  const list = await data.services.list();
  _cache = list;
  for (const l of _listeners) l();
  return list;
}

export function invalidateServicesCache() {
  _cache = null;
  _cachePromise = null;
  for (const l of _listeners) l();
}

/**
 * 전체 시술 목록을 reactive하게 받는 hook.
 * 첫 호출 시 Supabase에서 fetch하고 캐시. invalidateServicesCache() 호출로 갱신.
 */
export function useAllServices(): {
  services: ServiceRecord[];
  loaded: boolean;
  refresh: () => Promise<void>;
} {
  const [, setTick] = useState(0);
  const [loaded, setLoaded] = useState(_cache !== null);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    _listeners.add(listener);
    if (_cache === null && _cachePromise === null) {
      _cachePromise = fetchServicesFromSource()
        .then((list) => {
          setLoaded(true);
          return list;
        })
        .finally(() => {
          _cachePromise = null;
        });
    } else if (_cache !== null) {
      setLoaded(true);
    }
    return () => {
      _listeners.delete(listener);
    };
  }, []);

  const refresh = async () => {
    invalidateServicesCache();
    await fetchServicesFromSource();
  };

  return { services: _cache ?? [], loaded, refresh };
}

/**
 * 특정 파트 시술만 — active=true & sortOrder/name 정렬.
 */
export function useServicesByPart(partId: PartId | null) {
  const { services, loaded, refresh } = useAllServices();
  const filtered = partId
    ? services
        .filter((s) => s.partId === partId && s.active)
        .sort(
          (a, b) =>
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
            a.name.localeCompare(b.name)
        )
    : [];
  return { services: filtered, loaded, refresh };
}

// 제품 카탈로그 (두피 파트 — 엑셀 기준)
export interface Product {
  id: string;
  name: string;
  defaultPrice: number;
  kind: "sale" | "consumable" | "both";
}

export const PRODUCTS: Product[] = [
  { id: "clean_ampule", name: "클린앰플", defaultPrice: 35000, kind: "sale" },
  { id: "smooth_ampule", name: "스무스앰플", defaultPrice: 35000, kind: "sale" },
  { id: "active_ampule", name: "엑티브앰플", defaultPrice: 40000, kind: "sale" },
  { id: "repair_mist", name: "리페어미스트", defaultPrice: 30000, kind: "sale" },
  { id: "pure_mist", name: "퓨어미스트", defaultPrice: 30000, kind: "sale" },
  { id: "onycoclip", name: "오니코클립", defaultPrice: 0, kind: "consumable" },
  { id: "medisop_footcream", name: "메디솝풋크림", defaultPrice: 25000, kind: "both" },
];
