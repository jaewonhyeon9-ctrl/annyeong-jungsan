// 데이터 소스 인터페이스 — Mock과 Supabase 양쪽 구현이 따름.
// 모든 메서드는 async로 통일하여 두 구현이 동일 호출 시그니처를 갖도록 함.

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

export interface PatientCreateInput {
  centerId: string;
  id?: string;                    // 미지정 시 서버/클라이언트가 자동 발급
  firstVisitDate: string;
  inflowChannels: Patient["inflowChannels"];
  consent: boolean;
  tags?: Patient["tags"];
  personal?: Patient["personal"];
  chart?: Patient["chart"];
}

export interface VisitCreateInput {
  patientId: string;
  centerId: string;
  visitDate: string;
  partId: Visit["partId"];
  sales: Visit["sales"];
  productSales?: Visit["productSales"];
  productConsumption?: Visit["productConsumption"];
  visitMemo?: string | null;
  beforePhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
}

export interface CenterCreateInput {
  name: string;
  enabledParts: import("@/lib/types").PartId[];
  address?: string;
  phone?: string;
}

export interface DailyEntryCreateInput {
  centerId: string;
  date: string;
  sales: DailyEntry["sales"];
  productSales?: DailyEntry["productSales"];
  productConsumption?: DailyEntry["productConsumption"];
  note?: string;
  ocrSource?: DailyEntry["ocrSource"];
}

export interface DataSource {
  // 인증된 사용자 본인의 프로필
  me: {
    current(): Promise<UserProfile | null>;
    setMock(profile: UserProfile | null): void; // mock 모드 전용 — 데모 사용자 전환
    logout(): Promise<void>;
    changePassword(newPassword: string): Promise<void>;
  };
  // 사용자 관리 (admin 권한)
  users: {
    list(centerId?: string): Promise<UserProfile[]>;
    create(input: UserCreateInput): Promise<UserProfile>;
    update(id: string, patch: Partial<UserProfile>): Promise<UserProfile>;
    resetPassword(id: string, newPassword: string): Promise<void>;
  };
  centers: {
    list(): Promise<Center[]>;
    current(): Promise<Center | null>;
    create(input: CenterCreateInput): Promise<Center>;
    update(id: string, patch: Partial<Center>): Promise<Center>;
    delete(id: string): Promise<void>;
  };
  patients: {
    list(centerId?: string): Promise<Patient[]>;
    get(id: string): Promise<Patient | null>;
    create(input: PatientCreateInput): Promise<Patient>;
    update(id: string, patch: Partial<Patient>): Promise<Patient>;
  };
  visits: {
    listByPatient(patientId: string): Promise<Visit[]>;
    get(id: string): Promise<Visit | null>;
    create(input: VisitCreateInput): Promise<Visit>;
    update(id: string, patch: Partial<VisitCreateInput>): Promise<Visit>;
    delete(id: string): Promise<void>;
  };
  entries: {
    // 방문(Visit) + 수동입력(DailyEntry)을 모두 합산해 일자별 entry로 반환
    byMonth(centerId: string, yearMonth: string): Promise<DailyEntry[]>;
    create(input: DailyEntryCreateInput): Promise<DailyEntry>;
  };
  inflows: {
    byMonth(centerId: string, month: string): Promise<InflowEntry | null>;
    upsert(entry: InflowEntry): Promise<InflowEntry>;
  };
  settlement: {
    rule(centerId: string): Promise<SettlementRule>;
  };
}
