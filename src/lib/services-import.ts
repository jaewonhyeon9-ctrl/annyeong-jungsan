import * as XLSX from "xlsx";
import { PARTS, type PartId } from "./types";

// ============================================================
// 시술 품목 일괄 등록 — 엑셀/사진 OCR 공용 파싱 유틸
// ============================================================

// 검토용 초안 행 — 엑셀/OCR 모두 이 형태로 변환 후 화면에서 수정·확정
export interface ServiceDraft {
  partId: PartId | null; // 추정 실패 시 null → 사용자가 지정
  name: string;
  price: number;
  sortOrder?: number;
}

// 파트 라벨/별칭 → PartId. 한글·영문·약어 모두 허용.
const PART_ALIASES: Record<string, PartId> = {
  // 정식 라벨
  두피: "scalp",
  반영구: "permanent_makeup",
  smp: "smp",
  패디큐어: "pedicure",
  피부관리: "skincare",
  // 영문/별칭
  scalp: "scalp",
  "permanent_makeup": "permanent_makeup",
  pm: "permanent_makeup",
  반영구화장: "permanent_makeup",
  pedicure: "pedicure",
  페디큐어: "pedicure",
  발관리: "pedicure",
  skincare: "skincare",
  피부: "skincare",
  스킨케어: "skincare",
  "에스엠피": "smp",
};

export function partFromLabel(raw: unknown): PartId | null {
  if (raw == null) return null;
  const key = String(raw).trim().toLowerCase().replace(/\s+/g, "");
  if (!key) return null;
  // PARTS 의 정식 라벨 우선 매칭
  const byLabel = PARTS.find((p) => p.label === String(raw).trim());
  if (byLabel) return byLabel.id;
  if (PART_ALIASES[key]) return PART_ALIASES[key];
  // PartId 자체가 들어온 경우
  const asId = PARTS.find((p) => p.id === key);
  return asId ? asId.id : null;
}

// "70,000원" / "₩70000" / "7만" 등 → 숫자
export function parsePrice(raw: unknown): number {
  if (typeof raw === "number") return Math.round(raw);
  if (raw == null) return 0;
  const s = String(raw).trim();
  if (!s) return 0;
  // "7만" / "7만5천" 같은 만/천 표기 처리
  const manMatch = s.match(/^(\d+(?:\.\d+)?)\s*만\s*(?:(\d+)\s*천)?/);
  if (manMatch) {
    const man = parseFloat(manMatch[1]) * 10000;
    const cheon = manMatch[2] ? parseInt(manMatch[2], 10) * 1000 : 0;
    return Math.round(man + cheon);
  }
  const digits = s.replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

// 영문/숫자만 남긴 slug. 한글 등은 제거되므로 비면 fallback 필요.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const PART_PREFIX: Record<PartId, string> = {
  scalp: "scalp",
  permanent_makeup: "pm",
  smp: "smp",
  pedicure: "pedi",
  skincare: "skin",
};

// 파트 + 이름으로 services.id 생성. 기존 id 와 충돌하지 않도록 보정.
export function genServiceId(
  partId: PartId,
  name: string,
  existing: Set<string>
): string {
  const prefix = PART_PREFIX[partId];
  const slug = slugify(name);
  let base = slug ? `${prefix}.${slug}` : `${prefix}.item`;
  let id = base;
  let n = 2;
  while (existing.has(id)) {
    id = `${base}_${n}`;
    n += 1;
  }
  existing.add(id);
  return id;
}

// 엑셀/CSV → 초안 행 목록.
// 헤더 인식: 파트 / 이름(시술명/품목) / 가격(기본가/단가/금액) / 정렬(순서)
export async function parseServicesExcel(file: File): Promise<ServiceDraft[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  if (rows.length === 0) return [];

  // 헤더 키 매핑 — 첫 행의 키들을 보고 어떤 컬럼이 무엇인지 추정
  const keys = Object.keys(rows[0]);
  const findKey = (cands: string[]) =>
    keys.find((k) => {
      const norm = k.trim().toLowerCase().replace(/\s+/g, "");
      return cands.some((c) => norm.includes(c));
    });

  const partKey = findKey(["파트", "part", "분류", "구분"]);
  const nameKey = findKey(["이름", "시술", "품목", "name", "메뉴", "항목"]);
  const priceKey = findKey(["가격", "기본가", "단가", "금액", "price", "요금"]);
  const sortKey = findKey(["정렬", "순서", "sort", "order"]);

  const drafts: ServiceDraft[] = [];
  for (const r of rows) {
    const name = nameKey ? String(r[nameKey] ?? "").trim() : "";
    if (!name) continue; // 이름 없는 행은 스킵
    drafts.push({
      partId: partKey ? partFromLabel(r[partKey]) : null,
      name,
      price: priceKey ? parsePrice(r[priceKey]) : 0,
      sortOrder: sortKey ? parsePrice(r[sortKey]) : undefined,
    });
  }
  return drafts;
}
