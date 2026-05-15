import type { PartId, Service } from "./types";

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

export function servicesByPart(partId: PartId): Service[] {
  return SERVICES.filter((s) => s.partId === partId);
}

export function findService(id: string): Service | undefined {
  return SERVICES.find((s) => s.id === id);
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
