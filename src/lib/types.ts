// 도메인 모델 — 안녕메디컬 정산

export type PartId =
  | "scalp" // 두피
  | "permanent_makeup" // 반영구
  | "smp" // SMP (Scalp Micropigmentation)
  | "pedicure" // 패디큐어
  | "skincare"; // 피부관리

export type PaymentMethod = "cash" | "card";

// 두피센터 양식(전화/인터넷/옥외/내원/입원/지인/기타) +
// KMPA 환자관리챠트 양식(인스타/블로그/스마트플레이스/인터넷/지인/기타)
// 합집합 — 파트마다 어느 채널을 노출할지는 운영 단계에서 조정 가능
export type InflowChannel =
  | "instagram" // 인스타그램
  | "blog" // 블로그
  | "naver_place" // 스마트 플레이스 (네이버 플레이스)
  | "internet" // 인터넷 검색
  | "outdoor" // 옥외 홍보물
  | "phone" // 전화 문의
  | "visitor" // 내원 환자 (병원 내 다른 진료에서 유입)
  | "inpatient" // 입원 환자
  | "referral" // 지인 소개
  | "other"; // 기타

export interface Center {
  id: string;
  name: string;
  ownerName?: string; // 원장 이름
  createdAt: string;
}

export interface Part {
  id: PartId;
  label: string; // 한글명
  vatExempt: boolean; // 면세 여부 (의료행위면 면세)
}

export interface Service {
  id: string;
  partId: PartId;
  name: string;
  defaultPrice: number;
}

export interface SaleLine {
  serviceId: string;
  serviceName: string; // snapshot — 시술명 바뀌어도 과거 기록 유지
  partId: PartId;
  cash: number;
  card: number;
}

export interface ProductLine {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  cash: number;
  card: number;
}

export interface ProductConsumption {
  productId: string;
  productName: string;
  quantity: number;
}

// 환자 — 의료법 안전 모드: 정산 DB에는 환자번호만, 의료정보/개인정보는
// 센터(원장) 권한 영역에 별도 격리. 법인 admin은 정산 데이터만 볼 수 있음.
export type ChartCondition = "toenail_fungus" | "ingrown_nail" | "callus";
export type ChartDuration = "lt6m" | "gt1y" | "gt3y" | "gt5y";
export type ChartCareExp = "hospital" | "oriental" | "nailshop" | "footcare" | "other";
export type Severity = "high" | "mid" | "low";
export type Pregnancy = "no" | "planning" | "yes";

export interface FootIssueScore {
  // 각 발톱(좌5 우5)의 항목별 점수 (1~5)
  ingrown: number[];      // 파고드는 발톱
  fungus: number[];       // 발톱 무좀
  thick: number[];        // 두꺼운 발톱
  corn: number[];         // 티눈
  callus: number[];       // 굳은 살
}

export interface Patient {
  id: string;             // 자동발급: e.g. "C1-2605-0001"
  centerId: string;
  firstVisitDate: string; // YYYY-MM-DD
  inflowChannels: InflowChannel[]; // 차트의 방문경로 (다중 선택 가능)
  consent: boolean;       // 개인정보 동의

  // 개인정보 — 원장만 접근. DB 저장 정책은 센터 책임 영역.
  // 정산 DB와는 분리된 테이블/스토리지에 보관.
  personal?: {
    name?: string;
    gender?: "male" | "female";
    phone?: string;
    birthDate?: string;
    address?: string;
  };

  // 의료 체크리스트
  chart?: {
    conditions: ChartCondition[];
    duration?: ChartDuration;
    careExperience: ChartCareExp[];
    stress?: Severity;
    pain?: Severity;
    allergy?: { has: boolean; types?: string };
    products: ("antifungal" | "antifungal_tx" | "callus_moist" | "other")[];
    occupation?: string;
    lifestyle: {
      hiking?: boolean; golf?: boolean; soccer?: boolean;
      alcohol?: number; smoking?: number; other?: string;
    };
    sleepHours?: number;
    medications: ("anticancer" | "lipid" | "bp" | "diabetes" | "other")[];
    pregnancy?: Pregnancy;
    footIssue?: FootIssueScore;
    memo?: string;
  };

  // OCR 메타
  ocrSource?: {
    imageUrl?: string;
    confidence: number;
    autoSaved: boolean;
  };

  createdAt: string;
  updatedAt: string;
}

// 방문 차트 — 환자가 방문할 때마다 1건 작성. 시술/결제 정보 포함.
// DailyEntry의 source of truth — 일일 매출은 Visit들의 집계로 산출 가능.
export interface VisitSaleLine {
  serviceId: string;
  serviceName: string;
  partId: PartId;
  cash: number;
  card: number;
}

export interface Visit {
  id: string;
  patientId: string;
  centerId: string;
  visitDate: string;          // YYYY-MM-DD
  partId: PartId;             // 이번 방문의 주 파트 (5개 중)

  // 이번 방문에 받은 시술 + 결제
  sales: VisitSaleLine[];
  productSales: ProductLine[];
  productConsumption: ProductConsumption[];

  // 이번 방문 진료 메모/상태 변화
  visitMemo?: string;
  footIssueUpdate?: FootIssueScore;
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;

  ocrSource?: {
    imageUrl?: string;
    confidence: number;
    autoSaved: boolean;
  };

  createdAt: string;
  createdBy?: string;
}

export interface DailyEntry {
  id: string;
  centerId: string;
  date: string; // YYYY-MM-DD
  sales: SaleLine[];
  productSales: ProductLine[];
  productConsumption: ProductConsumption[];
  note?: string;
  ocrSource?: {
    imageUrl?: string;
    confidence: number; // 0~1
    autoSaved: boolean;
    needsReview: boolean;
  };
  createdAt: string;
  createdBy?: string;
}

export interface InflowEntry {
  id: string;
  centerId: string;
  month: string; // YYYY-MM
  channels: Record<InflowChannel, number>;
  newPatients: number;
  note?: string;
}

export interface SettlementRule {
  vatRate: number; // e.g. 0.1 (10%)
  cardFeeRate: number; // e.g. 0.025 (2.5%)
  centerSharePct: number; // 0~1, default 0.5
  corpSharePct: number; // 0~1, default 0.5
  vatExemptParts: PartId[]; // 면세 파트
}

export const DEFAULT_RULE: SettlementRule = {
  vatRate: 0.1,
  cardFeeRate: 0.025,
  centerSharePct: 0.5,
  corpSharePct: 0.5,
  vatExemptParts: [], // 초기: 전부 과세. 의료법상 의료행위면 면세 — 운영하면서 분류
};

export const PARTS: Part[] = [
  { id: "scalp", label: "두피", vatExempt: false },
  { id: "permanent_makeup", label: "반영구", vatExempt: false },
  { id: "smp", label: "SMP", vatExempt: false },
  { id: "pedicure", label: "패디큐어", vatExempt: false },
  { id: "skincare", label: "피부관리", vatExempt: false },
];

export const INFLOW_CHANNELS: { id: InflowChannel; label: string }[] = [
  { id: "instagram", label: "인스타그램" },
  { id: "blog", label: "블로그" },
  { id: "naver_place", label: "스마트플레이스" },
  { id: "internet", label: "인터넷검색" },
  { id: "outdoor", label: "옥외홍보물" },
  { id: "phone", label: "전화문의" },
  { id: "visitor", label: "내원환자" },
  { id: "inpatient", label: "입원환자" },
  { id: "referral", label: "지인소개" },
  { id: "other", label: "기타" },
];

export function emptyChannels(): Record<InflowChannel, number> {
  return {
    instagram: 0,
    blog: 0,
    naver_place: 0,
    internet: 0,
    outdoor: 0,
    phone: 0,
    visitor: 0,
    inpatient: 0,
    referral: 0,
    other: 0,
  };
}
