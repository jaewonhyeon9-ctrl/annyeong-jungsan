// OCR 결과 스키마 — Claude Vision 응답 형식과 1:1 매칭

import type { InflowChannel, PartId, Severity, Pregnancy } from "@/lib/types";

export type OcrClassification = "chart" | "receipt" | "pos" | "unknown";

export interface ChartOcrData {
  inflowChannels: InflowChannel[];
  conditions?: ("toenail_fungus" | "ingrown_nail" | "callus")[];
  duration?: "lt6m" | "gt1y" | "gt3y" | "gt5y" | null;
  careExperience?: ("hospital" | "oriental" | "nailshop" | "footcare" | "other")[];
  stress?: Severity | null;
  pain?: Severity | null;
  allergy?: { has: boolean; types?: string };
  products?: ("antifungal" | "antifungal_tx" | "callus_moist" | "other")[];
  occupation?: string | null;
  lifestyle?: {
    hiking?: boolean;
    golf?: boolean;
    soccer?: boolean;
    alcohol?: number;
    smoking?: number;
    other?: string | null;
  };
  sleepHours?: number | null;
  medications?: ("anticancer" | "lipid" | "bp" | "diabetes" | "other")[];
  pregnancy?: Pregnancy | null;
  memo?: string | null;
  consent?: boolean;
}

export interface ReceiptOcrData {
  date: string | null; // YYYY-MM-DD
  totalAmount: number | null;
  paymentMethod: "cash" | "card" | null;
  merchant?: string | null;
  approval?: string | null;
}

export interface PosLineOcr {
  serviceName: string;
  partGuess: PartId | null;
  cash: number;
  card: number;
}

export interface PosOcrData {
  date: string | null;
  items: PosLineOcr[];
  totals: { cash: number; card: number };
}

export interface OcrResult {
  classification: OcrClassification;
  confidence: number; // 0~1
  data: ChartOcrData | ReceiptOcrData | PosOcrData | null;
  warnings: string[];
  // 메타
  mock?: boolean;
  modelUsed?: string;
}
