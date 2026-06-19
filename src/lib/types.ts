// 도메인 모델 — BeautyChain

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

// 사용자 프로필 — auth.users 를 확장한 정보
// 법인 admin이 발급/관리. 원장은 본인 정보만 R.
export type UserRole = "admin" | "owner";

export interface BankAccount {
  bank: string;          // 은행명 (국민/신한/하나 등)
  accountNumber: string; // 계좌번호
  holder: string;        // 예금주
}

export interface UserProfile {
  id: string;              // auth user id
  email: string;
  role: UserRole;
  centerId: string | null; // admin은 null (전체), owner는 자기 센터
  partId: PartId | null;   // admin은 null (전체), owner는 자기 파트
  displayName: string;
  active: boolean;
  createdAt: string;

  // 원장 부가 정보 — 원장 본인이 /owner/profile 에서 입력
  phone?: string;
  bankAccount?: BankAccount;
  businessNumber?: string;     // 사업자등록번호
  contractStartDate?: string;  // 계약 시작일
  memo?: string;
}

// 원장 프로필 완성도 — 정산에 필요한 필수 정보 다 채워졌는지
export function isProfileComplete(p: UserProfile): boolean {
  if (p.role !== "owner") return true;
  return Boolean(
    p.phone &&
      p.bankAccount?.bank &&
      p.bankAccount?.accountNumber &&
      p.bankAccount?.holder
  );
}

export interface UserCreateInput {
  email: string;
  password: string;
  role: UserRole;
  centerId: string | null;
  partId: PartId | null;
  displayName: string;
  // 셀프 가입(/signup) 시 함께 받는 정보. admin이 직접 만들 땐 비워둘 수 있음.
  phone?: string;
  bankAccount?: BankAccount;
  businessNumber?: string;
  contractStartDate?: string;
  memo?: string;
  // 가입 직후 활성 여부 — 셀프 가입은 false (승인 대기), admin 발급은 true
  active?: boolean;
}

export interface Center {
  id: string;
  name: string;
  enabledParts: PartId[]; // 이 지점에서 운영하는 파트들 (admin이 설정)
  address?: string;
  phone?: string;
  ownerName?: string; // 원장 이름 — legacy
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

// services 테이블 한 행. builtin/custom 구분 없이 동일 구조.
export interface ServiceRecord extends Service {
  active: boolean;
  sortOrder: number;
}

export interface ServiceCreateInput {
  id?: string;          // 미지정 시 name+partId로 자동 생성
  partId: PartId;
  name: string;
  defaultPrice: number;
  sortOrder?: number;
  active?: boolean;
}

export type ServiceUpdateInput = Partial<{
  name: string;
  defaultPrice: number;
  sortOrder: number;
  active: boolean;
}>;

// ============================================================
// 예약 (Reservation)
// ============================================================
export type ReservationStatus =
  | "scheduled"
  | "completed"
  | "cancelled"
  | "no_show";

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  scheduled: "예정",
  completed: "완료",
  cancelled: "취소",
  no_show: "노쇼",
};

export interface Reservation {
  id: string;
  centerId: string;
  partId: PartId;
  ownerId: string | null;
  ownerName?: string;            // 조인 결과 — 선택 표시용
  practitionerName: string | null; // 시술자 이름 (계정 없는 치료사 — 칸분할 기준)
  patientId: string | null;       // 환자 DB 연결 시
  patientName: string | null;     // 신규/스냅샷
  patientPhone: string | null;
  scheduledAt: string;            // ISO datetime
  durationMin: number;
  serviceId: string | null;
  serviceName: string | null;
  status: ReservationStatus;
  memo: string | null;
  deductedPassId: string | null; // 완료 시 차감한 회수권 (취소 시 복원용)
  createdBy: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface ReservationCreateInput {
  centerId: string;
  partId: PartId;
  ownerId?: string | null;
  practitionerName?: string | null;
  patientId?: string | null;
  patientName?: string | null;
  patientPhone?: string | null;
  scheduledAt: string;
  durationMin?: number;
  serviceId?: string | null;
  serviceName?: string | null;
  status?: ReservationStatus;
  memo?: string | null;
  deductedPassId?: string | null;
}

export type ReservationUpdateInput = Partial<
  Omit<ReservationCreateInput, "centerId" | "partId">
>;

// ============================================================
// 상담 (Consultation)
// ============================================================
export interface Consultation {
  id: string;
  centerId: string;
  partId: PartId | null;
  patientId: string;
  patientName?: string;          // 조인 결과 — 표시용
  ownerId: string | null;
  ownerName?: string;
  consultedAt: string;           // ISO datetime
  content: string;
  nextFollowup: string | null;   // ISO date
  createdAt: string;
  updatedAt: string | null;
}

export interface ConsultationCreateInput {
  centerId: string;
  partId?: PartId | null;
  patientId: string;
  ownerId?: string | null;
  consultedAt?: string;
  content: string;
  nextFollowup?: string | null;
}

export type ConsultationUpdateInput = Partial<{
  ownerId: string | null;
  consultedAt: string;
  content: string;
  nextFollowup: string | null;
}>;

// ============================================================
// 적립금 이력 (Loyalty)
// ============================================================
export interface LoyaltyEntry {
  id: string;
  patientId: string;
  centerId: string;
  delta: number;            // 양수=적립, 음수=사용
  reason: string | null;
  balanceAfter: number;
  createdAt: string;
}

export interface LoyaltyCreateInput {
  patientId: string;
  centerId: string;
  delta: number;
  reason?: string | null;
}

// ============================================================
// 회수권 (Service Pass) — N회 패키지 구매 → 방문마다 차감
// ============================================================
export interface ServicePass {
  id: string;
  patientId: string;
  centerId: string;
  serviceId: string;
  serviceName: string; // snapshot
  partId: PartId;
  totalCount: number; // 구매한 총 횟수
  usedCount: number; // 사용한 횟수
  note: string | null;
  createdAt: string;
}

// 남은 횟수 = totalCount - usedCount
export function passRemaining(p: ServicePass): number {
  return Math.max(0, p.totalCount - p.usedCount);
}

export interface ServicePassCreateInput {
  patientId: string;
  centerId: string;
  serviceId: string;
  serviceName: string;
  partId: PartId;
  totalCount: number;
  purchaseVisitId?: string | null;
  note?: string | null;
}

// ============================================================
// 통계 — 가벼운 집계 결과 타입
// ============================================================
// 파트별 매출 1행 (주체별 분해 포함)
export interface PartSalesRow {
  partId: PartId;
  cash: number;
  hospitalCard: number;
  corpCard: number;
  legacyCard: number;
  card: number; // 카드 합(병원+법인+기존)
  total: number;
}

export interface SalesSummary {
  totalCash: number;       // 현금
  totalCard: number;       // 카드 전체(병원+법인+기존)
  totalHospitalCard: number; // 병원포스
  totalCorpCard: number;     // 법인포스
  totalLegacyCard: number;   // 기존(미분류) 카드
  total: number;
  visitCount: number;
  patientCount: number;
  byPart: PartSalesRow[];    // 파트별 분해 (매출 있는 파트만)
}

export interface PatientSalesRow {
  patientId: string;
  patientName: string | null;
  total: number;
  lastVisitDate: string | null;
}

// CRM — 센터 전체 환자 1행 집계 (재방문/이탈 관리·세그먼트·대시보드 공용)
export interface CrmPatientRow {
  patientId: string;
  name: string | null;
  phone: string | null;
  tags: PatientTag[];
  inflowChannels: InflowChannel[];
  firstVisitDate: string;
  lastVisitDate: string | null;
  visitCount: number;
  totalRevenue: number;
  passRemaining: number; // 보유 회수권 잔여 합계
}

export interface SaleLine {
  serviceId: string;
  serviceName: string; // snapshot — 시술명 바뀌어도 과거 기록 유지
  partId: PartId;
  cash: number;          // 현금
  card: number;          // 기존(미분류) 카드 — 과거 데이터 보존용
  hospitalCard?: number; // 병원포스기
  corpCard?: number;     // 법인포스기
}

// 결제 주체(입력 주체) — 현금 / 병원포스 / 법인포스 + 기존(미분류) 카드
export type PaySource = "cash" | "hospital" | "corp" | "legacy";
export const PAY_SOURCES: { id: PaySource; label: string; short: string }[] = [
  { id: "cash", label: "현금", short: "현금" },
  { id: "hospital", label: "병원포스", short: "병원" },
  { id: "corp", label: "법인포스", short: "법인" },
  { id: "legacy", label: "기존카드(미분류)", short: "기존" },
];
// 한 라인의 주체별 금액 합산 헬퍼
export function lineBySource(l: { cash: number; card: number; hospitalCard?: number; corpCard?: number }) {
  return {
    cash: l.cash || 0,
    hospital: l.hospitalCard || 0,
    corp: l.corpCard || 0,
    legacy: l.card || 0,
  };
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

// 환자 태그 — 원장이 환자에 붙이는 라벨
export type PatientTag = "vip" | "careful" | "longterm" | "newcomer" | "noshow";
export const PATIENT_TAGS: { id: PatientTag; label: string; color: string }[] = [
  { id: "vip", label: "VIP", color: "#A26F54" },
  { id: "careful", label: "주의", color: "#C28B6E" },
  { id: "longterm", label: "장기관리", color: "#71875E" },
  { id: "newcomer", label: "신규", color: "#8FA37A" },
  { id: "noshow", label: "노쇼이력", color: "#A8916A" },
];

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
  tags?: PatientTag[];    // 원장이 붙인 라벨 (VIP, 주의 등)

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
  cash: number;          // 현금
  card: number;          // 기존(미분류) 카드 — 과거 데이터 보존용
  hospitalCard?: number; // 병원포스기
  corpCard?: number;     // 법인포스기
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
