// Supabase 구현 초안.
// 현재 운영 모드에서는 src/lib/data/index.ts 가 mockDataSource로 고정되어
// 이 파일은 자동으로 사용되지 않는다.
//
// 타입 주의: database.types.ts 는 최소 골격만 있음. 실제 Supabase 셋업 후
// `npx supabase gen types typescript --project-id ...` 로 자동생성 권장.
// 그때까지는 일부 쿼리에 `as never` 또는 캐스팅이 필요.

import { createClient as createSb } from "@/lib/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createClient = (): any => createSb();

import type {
  CenterCreateInput,
  DailyEntryCreateInput,
  DataSource,
  PatientCreateInput,
  VisitCreateInput,
} from "./source";
import type {
  Center,
  ChartCareExp,
  ChartCondition,
  ChartDuration,
  DailyEntry,
  FootIssueScore,
  InflowChannel,
  InflowEntry,
  Patient,
  PatientTag,
  PartId,
  Pregnancy,
  Consultation,
  ConsultationCreateInput,
  ConsultationUpdateInput,
  CrmPatientRow,
  LoyaltyCreateInput,
  LoyaltyEntry,
  PatientSalesRow,
  Reservation,
  ReservationCreateInput,
  ReservationStatus,
  ReservationUpdateInput,
  SalesSummary,
  ServiceCreateInput,
  ServicePass,
  ServicePassCreateInput,
  ServiceRecord,
  ServiceUpdateInput,
  SettlementRule,
  Severity,
  UserProfile,
  Visit,
} from "@/lib/types";
import { DEFAULT_RULE, emptyChannels } from "@/lib/types";
import { generateNextPatientId } from "@/lib/patient";

// 행→도메인 변환
function rowToCenter(r: {
  id: string;
  name: string;
  owner_name: string | null;
  enabled_parts?: PartId[] | null;
  address?: string | null;
  phone?: string | null;
  created_at: string;
}): Center {
  return {
    id: r.id,
    name: r.name,
    enabledParts: r.enabled_parts ?? [],
    address: r.address ?? undefined,
    phone: r.phone ?? undefined,
    ownerName: r.owner_name ?? undefined,
    createdAt: r.created_at,
  };
}

function rowToPatient(r: {
  id: string;
  center_id: string;
  first_visit_date: string;
  inflow_channels: InflowChannel[];
  consent: boolean;
  tags?: PatientTag[] | null;
  created_at: string;
  updated_at: string;
  personal?: {
    name: string | null;
    gender: "male" | "female" | null;
    phone: string | null;
    birth_date: string | null;
    address: string | null;
  } | null;
  chart?: {
    conditions: ChartCondition[] | null;
    duration: ChartDuration | null;
    care_experience: ChartCareExp[] | null;
    stress: Severity | null;
    pain: Severity | null;
    allergy_has: boolean | null;
    allergy_types: string | null;
    products:
      | ("antifungal" | "antifungal_tx" | "callus_moist" | "other")[]
      | null;
    occupation: string | null;
    lifestyle: NonNullable<Patient["chart"]>["lifestyle"] | null;
    sleep_hours: number | null;
    medications: ("anticancer" | "lipid" | "bp" | "diabetes" | "other")[] | null;
    pregnancy: Pregnancy | null;
    foot_issue: FootIssueScore | null;
    memo: string | null;
  } | null;
}): Patient {
  const personal = r.personal
    ? {
        name: r.personal.name ?? undefined,
        gender: r.personal.gender ?? undefined,
        phone: r.personal.phone ?? undefined,
        birthDate: r.personal.birth_date ?? undefined,
        address: r.personal.address ?? undefined,
      }
    : undefined;
  const chart = r.chart
    ? {
        conditions: r.chart.conditions ?? [],
        duration: r.chart.duration ?? undefined,
        careExperience: r.chart.care_experience ?? [],
        stress: r.chart.stress ?? undefined,
        pain: r.chart.pain ?? undefined,
        allergy:
          r.chart.allergy_has === null
            ? undefined
            : {
                has: r.chart.allergy_has,
                types: r.chart.allergy_types ?? undefined,
              },
        products: r.chart.products ?? [],
        occupation: r.chart.occupation ?? undefined,
        lifestyle: r.chart.lifestyle ?? {},
        sleepHours: r.chart.sleep_hours ?? undefined,
        medications: r.chart.medications ?? [],
        pregnancy: r.chart.pregnancy ?? undefined,
        footIssue: r.chart.foot_issue ?? undefined,
        memo: r.chart.memo ?? undefined,
      }
    : {
        conditions: [],
        careExperience: [],
        products: [],
        lifestyle: {},
        medications: [],
      };
  return {
    id: r.id,
    centerId: r.center_id,
    firstVisitDate: r.first_visit_date,
    inflowChannels: r.inflow_channels,
    consent: r.consent,
    tags: r.tags ?? undefined,
    personal,
    chart,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const PATIENT_SELECT = `
  id,
  center_id,
  first_visit_date,
  inflow_channels,
  consent,
  tags,
  created_at,
  updated_at,
  personal:patient_personal(
    name,
    gender,
    phone,
    birth_date,
    address
  ),
  chart:patient_charts(
    conditions,
    duration,
    care_experience,
    stress,
    pain,
    allergy_has,
    allergy_types,
    products,
    occupation,
    lifestyle,
    sleep_hours,
    medications,
    pregnancy,
    foot_issue,
    memo
  )
`;

async function currentCenterId(sb: ReturnType<typeof createClient>) {
  const {
    data: { user },
    error: userError,
  } = await sb.auth.getUser();
  if (userError) throw userError;
  if (!user) return null;

  const { data: profile, error } = await sb
    .from("profiles")
    .select("role, center_id")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (profile?.center_id) return profile.center_id as string;

  if (profile?.role === "admin") {
    const { data: firstCenter, error: centerError } = await sb
      .from("centers")
      .select("id")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (centerError) throw centerError;
    return firstCenter?.id ?? null;
  }

  return null;
}

async function upsertPatientChart(
  sb: ReturnType<typeof createClient>,
  patientId: string,
  chart: PatientCreateInput["chart"]
) {
  if (!chart) return;
  const { error } = await sb.from("patient_charts").upsert({
    patient_id: patientId,
    conditions: chart.conditions ?? [],
    duration: chart.duration ?? null,
    care_experience: chart.careExperience ?? [],
    stress: chart.stress ?? null,
    pain: chart.pain ?? null,
    allergy_has: chart.allergy?.has ?? null,
    allergy_types: chart.allergy?.types ?? null,
    products: chart.products ?? [],
    occupation: chart.occupation ?? null,
    lifestyle: chart.lifestyle ?? {},
    sleep_hours: chart.sleepHours ?? null,
    medications: chart.medications ?? [],
    pregnancy: chart.pregnancy ?? null,
    foot_issue: chart.footIssue ?? null,
    memo: chart.memo ?? null,
  });
  if (error) throw error;
}

function rowToVisit(
  r: {
    id: string;
    patient_id: string;
    center_id: string;
    visit_date: string;
    part_id: PartId;
    visit_memo: string | null;
    before_photo_url?: string | null;
    after_photo_url?: string | null;
    created_at: string;
  },
  saleLines: Visit["sales"] = []
): Visit {
  return {
    id: r.id,
    patientId: r.patient_id,
    centerId: r.center_id,
    visitDate: r.visit_date,
    partId: r.part_id,
    sales: saleLines,
    productSales: [],
    productConsumption: [],
    visitMemo: r.visit_memo ?? undefined,
    beforePhotoUrl: r.before_photo_url ?? undefined,
    afterPhotoUrl: r.after_photo_url ?? undefined,
    createdAt: r.created_at,
  };
}

type RawConsultationRow = {
  id: string;
  center_id: string;
  part_id: PartId | null;
  patient_id: string;
  owner_id: string | null;
  consulted_at: string;
  content: string;
  next_followup: string | null;
  created_at: string;
  updated_at: string | null;
  owner?: { display_name: string } | { display_name: string }[] | null;
  patient_personal?:
    | { name: string | null }
    | { name: string | null }[]
    | null;
};

function rowToConsultation(r: RawConsultationRow): Consultation {
  const ownerObj = Array.isArray(r.owner) ? r.owner[0] : r.owner;
  const ppObj = Array.isArray(r.patient_personal)
    ? r.patient_personal[0]
    : r.patient_personal;
  return {
    id: r.id,
    centerId: r.center_id,
    partId: r.part_id,
    patientId: r.patient_id,
    patientName: ppObj?.name ?? undefined,
    ownerId: r.owner_id,
    ownerName: ownerObj?.display_name,
    consultedAt: r.consulted_at,
    content: r.content,
    nextFollowup: r.next_followup,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

type RawReservationRow = {
  id: string;
  center_id: string;
  part_id: PartId;
  owner_id: string | null;
  practitioner_name: string | null;
  patient_id: string | null;
  patient_name: string | null;
  patient_phone: string | null;
  scheduled_at: string;
  duration_min: number;
  service_id: string | null;
  service_name: string | null;
  status: ReservationStatus;
  memo: string | null;
  deducted_pass_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  owner?: { display_name: string } | { display_name: string }[] | null;
};

function rowToReservation(r: RawReservationRow): Reservation {
  const ownerObj = Array.isArray(r.owner) ? r.owner[0] : r.owner;
  return {
    id: r.id,
    centerId: r.center_id,
    partId: r.part_id,
    ownerId: r.owner_id,
    ownerName: ownerObj?.display_name,
    practitionerName: r.practitioner_name,
    patientId: r.patient_id,
    patientName: r.patient_name,
    patientPhone: r.patient_phone,
    scheduledAt: r.scheduled_at,
    durationMin: r.duration_min,
    serviceId: r.service_id,
    serviceName: r.service_name,
    status: r.status,
    memo: r.memo,
    deductedPassId: r.deducted_pass_id ?? null,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToInflow(r: {
  id: string;
  center_id: string;
  month: string;
  instagram: number;
  blog: number;
  naver_place: number;
  internet: number;
  outdoor: number;
  phone: number;
  visitor: number;
  inpatient: number;
  referral: number;
  other: number;
  new_patients: number;
}): InflowEntry {
  return {
    id: r.id,
    centerId: r.center_id,
    month: r.month,
    channels: {
      instagram: r.instagram,
      blog: r.blog,
      naver_place: r.naver_place,
      internet: r.internet,
      outdoor: r.outdoor,
      phone: r.phone,
      visitor: r.visitor,
      inpatient: r.inpatient,
      referral: r.referral,
      other: r.other,
    },
    newPatients: r.new_patients,
  };
}

export const supabaseDataSource: DataSource = {
  me: {
    async current() {
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return null;
      const { data: profile, error } = await sb
        .from("profiles")
        .select(
          "id, role, center_id, part_id, display_name, active, created_at, phone, bank_name, bank_account, bank_holder, business_number, contract_start_date, memo"
        )
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!profile) return null;
      return {
        id: profile.id,
        email: user.email ?? "",
        role: profile.role,
        centerId: profile.center_id,
        partId: profile.part_id,
        displayName: profile.display_name,
        active: profile.active ?? true,
        createdAt: profile.created_at,
        phone: profile.phone ?? undefined,
        bankAccount:
          profile.bank_name || profile.bank_account
            ? {
                bank: profile.bank_name ?? "",
                accountNumber: profile.bank_account ?? "",
                holder: profile.bank_holder ?? "",
              }
            : undefined,
        businessNumber: profile.business_number ?? undefined,
        contractStartDate: profile.contract_start_date ?? undefined,
        memo: profile.memo ?? undefined,
      };
    },
    setMock(_profile) {
      // no-op in Supabase mode — 실 인증 사용
    },
    async logout() {
      const sb = createClient();
      await sb.auth.signOut();
    },
    async changePassword(newPassword) {
      const sb = createClient();
      const { error } = await sb.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
  },

  users: {
    async list(centerId) {
      const sb = createClient();
      let q = sb
        .from("profiles")
        .select(
          "id, role, center_id, part_id, display_name, active, created_at, email, phone, bank_name, bank_account, bank_holder, business_number, contract_start_date, memo"
        )
        .order("created_at", { ascending: false });
      if (centerId) q = q.eq("center_id", centerId);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as Array<{
        id: string;
        email: string | null;
        role: "admin" | "owner";
        center_id: string | null;
        part_id: PartId | null;
        display_name: string;
        active: boolean;
        created_at: string;
        phone: string | null;
        bank_name: string | null;
        bank_account: string | null;
        bank_holder: string | null;
        business_number: string | null;
        contract_start_date: string | null;
        memo: string | null;
      }>).map((r) => ({
        id: r.id,
        email: r.email ?? "",
        role: r.role,
        centerId: r.center_id,
        partId: r.part_id,
        displayName: r.display_name,
        active: r.active,
        createdAt: r.created_at,
        phone: r.phone ?? undefined,
        bankAccount:
          r.bank_name || r.bank_account
            ? {
                bank: r.bank_name ?? "",
                accountNumber: r.bank_account ?? "",
                holder: r.bank_holder ?? "",
              }
            : undefined,
        businessNumber: r.business_number ?? undefined,
        contractStartDate: r.contract_start_date ?? undefined,
        memo: r.memo ?? undefined,
      }));
    },
    async create(input) {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = (await response.json()) as
        | UserProfile
        | { error?: string };
      if (!response.ok) {
        throw new Error(
          "error" in result && result.error
            ? result.error
            : "사용자 생성에 실패했습니다."
        );
      }
      return result as UserProfile;
    },
    async update(id, patch) {
      const sb = createClient();
      const updateRow: Record<string, unknown> = {};
      if (patch.role !== undefined) updateRow.role = patch.role;
      if (patch.centerId !== undefined) updateRow.center_id = patch.centerId;
      if (patch.partId !== undefined) updateRow.part_id = patch.partId;
      if (patch.displayName !== undefined)
        updateRow.display_name = patch.displayName;
      if (patch.active !== undefined) updateRow.active = patch.active;
      if (patch.phone !== undefined) updateRow.phone = patch.phone ?? null;
      if (patch.businessNumber !== undefined)
        updateRow.business_number = patch.businessNumber ?? null;
      if (patch.contractStartDate !== undefined)
        updateRow.contract_start_date = patch.contractStartDate ?? null;
      if (patch.memo !== undefined) updateRow.memo = patch.memo ?? null;
      if (patch.bankAccount !== undefined) {
        updateRow.bank_name = patch.bankAccount?.bank ?? null;
        updateRow.bank_account = patch.bankAccount?.accountNumber ?? null;
        updateRow.bank_holder = patch.bankAccount?.holder ?? null;
      }
      const { data, error } = await sb
        .from("profiles")
        .update(updateRow)
        .eq("id", id)
        .select(
          "id, role, center_id, part_id, display_name, active, created_at, email, phone, bank_name, bank_account, bank_holder, business_number, contract_start_date, memo"
        )
        .single();
      if (error) throw error;
      return {
        id: data.id,
        email: data.email ?? "",
        role: data.role,
        centerId: data.center_id,
        partId: data.part_id,
        displayName: data.display_name,
        active: data.active,
        createdAt: data.created_at,
        phone: data.phone ?? undefined,
        bankAccount:
          data.bank_name || data.bank_account
            ? {
                bank: data.bank_name ?? "",
                accountNumber: data.bank_account ?? "",
                holder: data.bank_holder ?? "",
              }
            : undefined,
        businessNumber: data.business_number ?? undefined,
        contractStartDate: data.contract_start_date ?? undefined,
        memo: data.memo ?? undefined,
      };
    },
    async resetPassword(id, newPassword) {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password: newPassword }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "비밀번호 재설정에 실패했습니다.");
      }
    },
    async delete(id) {
      const response = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "사용자 삭제에 실패했습니다.");
      }
    },
  },

  centers: {
    async list() {
      const sb = createClient();
      const { data, error } = await sb
        .from("centers")
        .select("id, name, owner_name, enabled_parts, address, phone, created_at")
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map(rowToCenter);
    },
    async current() {
      const sb = createClient();
      const id = await currentCenterId(sb);
      if (!id) return null;
      const { data: center, error } = await sb
        .from("centers")
        .select("id, name, owner_name, enabled_parts, address, phone, created_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return center ? rowToCenter(center) : null;
    },
    async create(input: CenterCreateInput) {
      const sb = createClient();
      const { data, error } = await sb
        .from("centers")
        .insert({
          name: input.name,
          enabled_parts: input.enabledParts,
          address: input.address ?? null,
          phone: input.phone ?? null,
        })
        .select("id, name, owner_name, enabled_parts, address, phone, created_at")
        .single();
      if (error) throw error;
      return rowToCenter(data);
    },
    async update(id, patch) {
      const sb = createClient();
      const update: Record<string, unknown> = {};
      if (patch.name !== undefined) update.name = patch.name;
      if (patch.enabledParts !== undefined)
        update.enabled_parts = patch.enabledParts;
      if (patch.address !== undefined) update.address = patch.address;
      if (patch.phone !== undefined) update.phone = patch.phone;
      const { data, error } = await sb
        .from("centers")
        .update(update)
        .eq("id", id)
        .select("id, name, owner_name, enabled_parts, address, phone, created_at")
        .single();
      if (error) throw error;
      return rowToCenter(data);
    },
    async delete(id) {
      const sb = createClient();
      // 안전 검사 — 환자/원장 계정이 있으면 거부
      const { count: patientCount, error: pErr } = await sb
        .from("patients")
        .select("id", { count: "exact", head: true })
        .eq("center_id", id);
      if (pErr) throw pErr;
      if ((patientCount ?? 0) > 0) {
        throw new Error(
          "이 지점에 등록된 환자가 있어 삭제할 수 없습니다. 환자를 다른 지점으로 이동하거나 먼저 삭제하세요."
        );
      }
      const { count: ownerCount, error: oErr } = await sb
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("center_id", id)
        .eq("role", "owner");
      if (oErr) throw oErr;
      if ((ownerCount ?? 0) > 0) {
        throw new Error(
          "이 지점에 배정된 원장 계정이 있어 삭제할 수 없습니다. 먼저 계정을 다른 지점으로 옮기거나 정지하세요."
        );
      }
      const { error } = await sb.from("centers").delete().eq("id", id);
      if (error) throw error;
    },
  },

  patients: {
    async list(centerId) {
      const sb = createClient();
      let q = sb
        .from("patients")
        .select(PATIENT_SELECT)
        .order("first_visit_date", { ascending: false });
      if (centerId) q = q.eq("center_id", centerId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(rowToPatient);
    },
    async get(id) {
      const sb = createClient();
      const { data, error } = await sb
        .from("patients")
        .select(PATIENT_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToPatient(data) : null;
    },
    async create(input: PatientCreateInput) {
      const sb = createClient();

      const month = input.firstVisitDate.slice(0, 7);
      let id = input.id;

      // ID 충돌 시 최대 5회 재시도 (동시 가입 경합 방지)
      let data: {
        id: string;
        center_id: string;
        first_visit_date: string;
        inflow_channels: Patient["inflowChannels"];
        consent: boolean;
        tags: string[];
        created_at: string;
        updated_at: string | null;
      } | null = null;
      let lastError: { code?: string; message: string } | null = null;
      const maxAttempts = id ? 1 : 5;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (!input.id) {
          const { data: existing } = await sb
            .from("patients")
            .select("id")
            .eq("center_id", input.centerId)
            .like("id", `C%-${month.slice(2, 4)}${month.slice(5, 7)}-%`);
          const fakeList = ((existing ?? []) as { id: string }[]).map((e) => ({
            id: e.id,
          })) as unknown as Patient[];
          // 충돌 발생 시 attempt 만큼 더 건너뜀
          id = generateNextPatientId(fakeList, 1 + attempt, month);
        }

        const insertResult = await sb
          .from("patients")
          .insert({
            id,
            center_id: input.centerId,
            first_visit_date: input.firstVisitDate,
            inflow_channels: input.inflowChannels,
            consent: input.consent,
            tags: input.tags ?? [],
          })
          .select(
            "id, center_id, first_visit_date, inflow_channels, consent, tags, created_at, updated_at"
          )
          .single();

        if (!insertResult.error) {
          data = insertResult.data as typeof data;
          break;
        }
        lastError = insertResult.error;
        // 23505 = unique_violation. 다른 에러는 재시도 의미 없음.
        if (insertResult.error.code !== "23505") break;
        // 짧은 백오프
        await new Promise((r) => setTimeout(r, 100 + attempt * 100));
      }

      if (!data) {
        const msg = lastError?.message ?? "환자 등록 실패";
        const code = lastError?.code ? ` (${lastError.code})` : "";
        throw new Error(`${msg}${code}`);
      }
      const patientRow = data;

      // 개인정보 별도 테이블
      if (input.personal) {
        const { error: personalError } = await sb.from("patient_personal").upsert({
          patient_id: patientRow.id,
          name: input.personal.name ?? null,
          gender: input.personal.gender ?? null,
          phone: input.personal.phone ?? null,
          birth_date: input.personal.birthDate ?? null,
          address: input.personal.address ?? null,
        });
        if (personalError) throw personalError;
      }

      await upsertPatientChart(sb, patientRow.id, input.chart);

      const created = await this.get(patientRow.id);
      return created ?? rowToPatient(patientRow);
    },
    async update(id, patch) {
      const sb = createClient();

      // patients 테이블 — inflowChannels, consent, firstVisitDate
      const patientsPatch: Record<string, unknown> = {};
      if (patch.inflowChannels !== undefined)
        patientsPatch.inflow_channels = patch.inflowChannels;
      if (patch.consent !== undefined) patientsPatch.consent = patch.consent;
      if (patch.firstVisitDate !== undefined)
        patientsPatch.first_visit_date = patch.firstVisitDate;
      if (patch.tags !== undefined) patientsPatch.tags = patch.tags ?? [];

      if (Object.keys(patientsPatch).length > 0) {
        const { error } = await sb
          .from("patients")
          .update(patientsPatch)
          .eq("id", id);
        if (error) throw error;
      }

      // patient_personal 별도 테이블
      if (patch.personal !== undefined) {
        const p = patch.personal;
        const { error } = await sb.from("patient_personal").upsert({
          patient_id: id,
          name: p?.name ?? null,
          gender: p?.gender ?? null,
          phone: p?.phone ?? null,
          birth_date: p?.birthDate ?? null,
          address: p?.address ?? null,
        });
        if (error) throw error;
      }

      // 의료 차트
      if (patch.chart !== undefined) {
        await upsertPatientChart(sb, id, patch.chart);
      }

      const updated = await this.get(id);
      if (!updated) throw new Error("not found after update");
      return updated;
    },
  },

  visits: {
    async listByPatient(patientId) {
      const sb = createClient();
      const { data, error } = await sb
        .from("visits")
        .select(
          "id, patient_id, center_id, visit_date, part_id, visit_memo, before_photo_url, after_photo_url, created_at"
        )
        .eq("patient_id", patientId)
        .order("visit_date", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as {
        id: string;
        patient_id: string;
        center_id: string;
        visit_date: string;
        part_id: PartId;
        visit_memo: string | null;
        before_photo_url: string | null;
        after_photo_url: string | null;
        created_at: string;
      }[];
      const visitIds = rows.map((r) => r.id);
      const salesByVisit = new Map<string, Visit["sales"]>();
      if (visitIds.length > 0) {
        const { data: saleRows, error: saleError } = await sb
          .from("visit_sale_lines")
          .select("visit_id, service_id, service_name, part_id, cash, card, hospital_card, corp_card")
          .in("visit_id", visitIds);
        if (saleError) throw saleError;
        for (const r of (saleRows ?? []) as {
          visit_id: string;
          service_id: string;
          service_name: string;
          part_id: PartId;
          cash: number;
          card: number;
          hospital_card: number | null;
          corp_card: number | null;
        }[]) {
          const lines = salesByVisit.get(r.visit_id) ?? [];
          lines.push({
            serviceId: r.service_id,
            serviceName: r.service_name,
            partId: r.part_id,
            cash: r.cash,
            card: r.card,
            hospitalCard: r.hospital_card ?? 0,
            corpCard: r.corp_card ?? 0,
          });
          salesByVisit.set(r.visit_id, lines);
        }
      }
      return rows.map((r) => rowToVisit(r, salesByVisit.get(r.id) ?? []));
    },
    async get(id) {
      const sb = createClient();
      const { data, error } = await sb
        .from("visits")
        .select(
          "id, patient_id, center_id, visit_date, part_id, visit_memo, before_photo_url, after_photo_url, created_at"
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: saleRows, error: saleErr } = await sb
        .from("visit_sale_lines")
        .select("service_id, service_name, part_id, cash, card, hospital_card, corp_card")
        .eq("visit_id", id);
      if (saleErr) throw saleErr;
      const sales = ((saleRows ?? []) as {
        service_id: string;
        service_name: string;
        part_id: PartId;
        cash: number;
        card: number;
        hospital_card: number | null;
        corp_card: number | null;
      }[]).map((r) => ({
        serviceId: r.service_id,
        serviceName: r.service_name,
        partId: r.part_id,
        cash: r.cash,
        card: r.card,
        hospitalCard: r.hospital_card ?? 0,
        corpCard: r.corp_card ?? 0,
      }));
      return rowToVisit(data, sales);
    },
    async create(input: VisitCreateInput) {
      const sb = createClient();
      const { data: visitRow, error } = await sb
        .from("visits")
        .insert({
          patient_id: input.patientId,
          center_id: input.centerId,
          visit_date: input.visitDate,
          part_id: input.partId,
          visit_memo: input.visitMemo ?? null,
          before_photo_url: input.beforePhotoUrl ?? null,
          after_photo_url: input.afterPhotoUrl ?? null,
        })
        .select(
          "id, patient_id, center_id, visit_date, part_id, visit_memo, before_photo_url, after_photo_url, created_at"
        )
        .single();
      if (error) throw error;

      if (input.sales.length > 0) {
        const { error: salesError } = await sb.from("visit_sale_lines").insert(
          input.sales.map((s) => ({
            visit_id: visitRow.id,
            service_id: s.serviceId,
            service_name: s.serviceName,
            part_id: s.partId,
            cash: s.cash,
            card: s.card,
            hospital_card: s.hospitalCard ?? 0,
            corp_card: s.corpCard ?? 0,
          }))
        );
        if (salesError) throw salesError;
      }

      return rowToVisit(visitRow, input.sales);
    },
    async update(id, patch) {
      const sb = createClient();
      const update: Record<string, unknown> = {};
      if (patch.visitDate !== undefined) update.visit_date = patch.visitDate;
      if (patch.partId !== undefined) update.part_id = patch.partId;
      if (patch.visitMemo !== undefined)
        update.visit_memo = patch.visitMemo ?? null;
      if (patch.beforePhotoUrl !== undefined)
        update.before_photo_url = patch.beforePhotoUrl ?? null;
      if (patch.afterPhotoUrl !== undefined)
        update.after_photo_url = patch.afterPhotoUrl ?? null;

      if (Object.keys(update).length > 0) {
        const { error } = await sb.from("visits").update(update).eq("id", id);
        if (error) throw error;
      }

      // sales 라인을 교체하는 패턴 — patch.sales가 명시되면 기존 라인 삭제 후 새로 삽입
      if (patch.sales !== undefined) {
        const { error: delErr } = await sb
          .from("visit_sale_lines")
          .delete()
          .eq("visit_id", id);
        if (delErr) throw delErr;
        if (patch.sales.length > 0) {
          const { error: insErr } = await sb.from("visit_sale_lines").insert(
            patch.sales.map((s) => ({
              visit_id: id,
              service_id: s.serviceId,
              service_name: s.serviceName,
              part_id: s.partId,
              cash: s.cash,
              card: s.card,
            hospital_card: s.hospitalCard ?? 0,
            corp_card: s.corpCard ?? 0,
            }))
          );
          if (insErr) throw insErr;
        }
      }

      const updated = await this.get(id);
      if (!updated) throw new Error("visit not found after update");
      return updated;
    },
    async delete(id) {
      const sb = createClient();
      // visit_sale_lines는 ON DELETE CASCADE 가정 — 아니면 명시적으로 먼저 삭제
      const { error: lineErr } = await sb
        .from("visit_sale_lines")
        .delete()
        .eq("visit_id", id);
      if (lineErr) throw lineErr;
      const { error } = await sb.from("visits").delete().eq("id", id);
      if (error) throw error;
    },
  },

  entries: {
    async byMonth(centerId, yearMonth) {
      const sb = createClient();
      const [yy, mm] = yearMonth.split("-").map(Number);
      const nextYm =
        mm === 12
          ? `${yy + 1}-01-01`
          : `${yy}-${String(mm + 1).padStart(2, "0")}-01`;

      // 1) 수동 입력 entries + sale_lines
      const { data: entryRows, error: entryErr } = await sb
        .from("daily_entries")
        .select("id, center_id, entry_date, note, created_at")
        .eq("center_id", centerId)
        .gte("entry_date", `${yearMonth}-01`)
        .lt("entry_date", nextYm);
      if (entryErr) throw entryErr;

      const entryIds = ((entryRows ?? []) as { id: string }[]).map((r) => r.id);
      let saleLinesByEntry = new Map<string, DailyEntry["sales"]>();
      if (entryIds.length > 0) {
        const { data: saleRows, error: saleErr } = await sb
          .from("sale_lines")
          .select("entry_id, service_id, service_name, part_id, cash, card, hospital_card, corp_card")
          .in("entry_id", entryIds);
        if (saleErr) throw saleErr;
        saleLinesByEntry = new Map();
        for (const r of (saleRows ?? []) as {
          entry_id: string;
          service_id: string;
          service_name: string;
          part_id: PartId;
          cash: number;
          card: number;
          hospital_card: number | null;
          corp_card: number | null;
        }[]) {
          const arr = saleLinesByEntry.get(r.entry_id) ?? [];
          arr.push({
            serviceId: r.service_id,
            serviceName: r.service_name,
            partId: r.part_id,
            cash: r.cash,
            card: r.card,
            hospitalCard: r.hospital_card ?? 0,
            corpCard: r.corp_card ?? 0,
          });
          saleLinesByEntry.set(r.entry_id, arr);
        }
      }

      const manualEntries: DailyEntry[] = ((entryRows ?? []) as {
        id: string;
        center_id: string;
        entry_date: string;
        note: string | null;
        created_at: string;
      }[]).map((r) => ({
        id: r.id,
        centerId: r.center_id,
        date: r.entry_date,
        sales: saleLinesByEntry.get(r.id) ?? [],
        productSales: [],
        productConsumption: [],
        note: r.note ?? undefined,
        createdAt: r.created_at,
      }));

      // 2) 방문 차트 → 일자별 entry로 합산
      const { data: visitRows, error: visitErr } = await sb
        .from("visits")
        .select("id, center_id, visit_date, created_at")
        .eq("center_id", centerId)
        .gte("visit_date", `${yearMonth}-01`)
        .lt("visit_date", nextYm);
      if (visitErr) throw visitErr;

      const visitIds = ((visitRows ?? []) as { id: string }[]).map((r) => r.id);
      const visitSalesByVisit = new Map<string, DailyEntry["sales"]>();
      if (visitIds.length > 0) {
        const { data: vsRows, error: vsErr } = await sb
          .from("visit_sale_lines")
          .select("visit_id, service_id, service_name, part_id, cash, card, hospital_card, corp_card")
          .in("visit_id", visitIds);
        if (vsErr) throw vsErr;
        for (const r of (vsRows ?? []) as {
          visit_id: string;
          service_id: string;
          service_name: string;
          part_id: PartId;
          cash: number;
          card: number;
          hospital_card: number | null;
          corp_card: number | null;
        }[]) {
          const arr = visitSalesByVisit.get(r.visit_id) ?? [];
          arr.push({
            serviceId: r.service_id,
            serviceName: r.service_name,
            partId: r.part_id,
            cash: r.cash,
            card: r.card,
            hospitalCard: r.hospital_card ?? 0,
            corpCard: r.corp_card ?? 0,
          });
          visitSalesByVisit.set(r.visit_id, arr);
        }
      }

      const visitsByDate = new Map<
        string,
        { id: string; sales: DailyEntry["sales"]; createdAt: string }[]
      >();
      for (const r of (visitRows ?? []) as {
        id: string;
        center_id: string;
        visit_date: string;
        created_at: string;
      }[]) {
        const sales = visitSalesByVisit.get(r.id) ?? [];
        const arr = visitsByDate.get(r.visit_date) ?? [];
        arr.push({ id: r.id, sales, createdAt: r.created_at });
        visitsByDate.set(r.visit_date, arr);
      }

      const visitEntries: DailyEntry[] = Array.from(visitsByDate.entries()).map(
        ([date, vs]) => ({
          id: `visit-${centerId}-${date}`,
          centerId,
          date,
          sales: vs.flatMap((v) => v.sales),
          productSales: [],
          productConsumption: [],
          note: `방문 ${vs.length}건 (자동집계)`,
          createdAt: vs[0]?.createdAt ?? new Date().toISOString(),
        })
      );

      return [...manualEntries, ...visitEntries].sort((a, b) =>
        a.date.localeCompare(b.date)
      );
    },
    async create(input: DailyEntryCreateInput) {
      const sb = createClient();
      const { data: entryRow, error } = await sb
        .from("daily_entries")
        .insert({
          center_id: input.centerId,
          entry_date: input.date,
          note: input.note ?? null,
          ocr_image_url: input.ocrSource?.imageUrl ?? null,
          ocr_confidence: input.ocrSource?.confidence ?? null,
          ocr_auto_saved: input.ocrSource?.autoSaved ?? false,
          ocr_needs_review: input.ocrSource?.needsReview ?? false,
        })
        .select("id, center_id, entry_date, note, created_at")
        .single();
      if (error) throw error;

      if (input.sales.length > 0) {
        const { error: saleErr } = await sb.from("sale_lines").insert(
          input.sales.map((s) => ({
            entry_id: entryRow.id,
            service_id: s.serviceId,
            service_name: s.serviceName,
            part_id: s.partId,
            cash: s.cash,
            card: s.card,
            hospital_card: s.hospitalCard ?? 0,
            corp_card: s.corpCard ?? 0,
          }))
        );
        if (saleErr) throw saleErr;
      }

      const entry: DailyEntry = {
        id: entryRow.id,
        centerId: entryRow.center_id,
        date: entryRow.entry_date,
        sales: input.sales,
        productSales: input.productSales ?? [],
        productConsumption: input.productConsumption ?? [],
        note: entryRow.note ?? undefined,
        ocrSource: input.ocrSource,
        createdAt: entryRow.created_at,
      };
      return entry;
    },
  },

  inflows: {
    async byMonth(centerId, month) {
      const sb = createClient();
      const { data, error } = await sb
        .from("inflow_entries")
        .select(
          "id, center_id, month, instagram, blog, naver_place, internet, outdoor, phone, visitor, inpatient, referral, other, new_patients"
        )
        .eq("center_id", centerId)
        .eq("month", month)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToInflow(data) : null;
    },
    async upsert(entry: InflowEntry) {
      const sb = createClient();
      const { data, error } = await sb
        .from("inflow_entries")
        .upsert({
          center_id: entry.centerId,
          month: entry.month,
          ...entry.channels,
          new_patients: entry.newPatients,
        }, { onConflict: "center_id,month" })
        .select(
          "id, center_id, month, instagram, blog, naver_place, internet, outdoor, phone, visitor, inpatient, referral, other, new_patients"
        )
        .single();
      if (error) throw error;
      return rowToInflow(data);
    },
  },

  services: {
    async list(): Promise<ServiceRecord[]> {
      const sb = createClient();
      const { data, error } = await sb
        .from("services")
        .select("id, part_id, name, default_price, active, sort_order")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return ((data ?? []) as Array<{
        id: string;
        part_id: PartId;
        name: string;
        default_price: number;
        active: boolean;
        sort_order: number;
      }>).map((r) => ({
        id: r.id,
        partId: r.part_id,
        name: r.name,
        defaultPrice: r.default_price,
        active: r.active,
        sortOrder: r.sort_order,
      }));
    },
    async create(input: ServiceCreateInput): Promise<ServiceRecord> {
      const sb = createClient();
      const id =
        input.id?.trim() ||
        `${input.partId}.${input.name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9가-힣]+/g, "_")
          .replace(/^_+|_+$/g, "") || `svc_${Date.now().toString(36)}`}`;
      const { data, error } = await sb
        .from("services")
        .insert({
          id,
          part_id: input.partId,
          name: input.name.trim(),
          default_price: input.defaultPrice,
          active: input.active ?? true,
          sort_order: input.sortOrder ?? 0,
        })
        .select("id, part_id, name, default_price, active, sort_order")
        .single();
      if (error) throw error;
      return {
        id: data.id,
        partId: data.part_id,
        name: data.name,
        defaultPrice: data.default_price,
        active: data.active,
        sortOrder: data.sort_order,
      };
    },
    async update(id, patch: ServiceUpdateInput): Promise<ServiceRecord> {
      const sb = createClient();
      const update: Record<string, unknown> = {};
      if (patch.name !== undefined) update.name = patch.name;
      if (patch.defaultPrice !== undefined)
        update.default_price = patch.defaultPrice;
      if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;
      if (patch.active !== undefined) update.active = patch.active;
      const { data, error } = await sb
        .from("services")
        .update(update)
        .eq("id", id)
        .select("id, part_id, name, default_price, active, sort_order")
        .single();
      if (error) throw error;
      return {
        id: data.id,
        partId: data.part_id,
        name: data.name,
        defaultPrice: data.default_price,
        active: data.active,
        sortOrder: data.sort_order,
      };
    },
    async delete(id) {
      const sb = createClient();
      const { error } = await sb.from("services").delete().eq("id", id);
      if (error) throw error;
    },
  },

  reservations: {
    async byMonth(centerId, yearMonth): Promise<Reservation[]> {
      const sb = createClient();
      // KST(+09) 자정 기준으로 범위 산출 → UTC ISO로 변환
      const [y, m] = yearMonth.split("-").map(Number);
      // KST 자정 = UTC 전날 15시
      const startUtc = new Date(Date.UTC(y, m - 1, 1, -9, 0, 0)).toISOString();
      const endUtc = new Date(Date.UTC(y, m, 1, -9, 0, 0)).toISOString();
      const { data, error } = await sb
        .from("reservations")
        .select(
          `id, center_id, part_id, owner_id, practitioner_name, patient_id, patient_name,
           patient_phone, scheduled_at, duration_min, service_id, service_name,
           status, memo, deducted_pass_id, created_by, created_at, updated_at,
           owner:profiles!reservations_owner_id_fkey(display_name)`
        )
        .eq("center_id", centerId)
        .gte("scheduled_at", startUtc)
        .lt("scheduled_at", endUtc)
        .order("scheduled_at");
      if (error) throw error;
      return ((data ?? []) as Array<RawReservationRow>).map(rowToReservation);
    },
    async byDate(centerId, date): Promise<Reservation[]> {
      const sb = createClient();
      // KST 해당 날짜 00:00 ~ 다음날 00:00 (UTC로 환산)
      const [y, m, d] = date.split("-").map(Number);
      const startUtc = new Date(Date.UTC(y, m - 1, d, -9, 0, 0)).toISOString();
      const endUtc = new Date(Date.UTC(y, m - 1, d + 1, -9, 0, 0)).toISOString();
      const { data, error } = await sb
        .from("reservations")
        .select(
          `id, center_id, part_id, owner_id, practitioner_name, patient_id, patient_name,
           patient_phone, scheduled_at, duration_min, service_id, service_name,
           status, memo, deducted_pass_id, created_by, created_at, updated_at,
           owner:profiles!reservations_owner_id_fkey(display_name)`
        )
        .eq("center_id", centerId)
        .gte("scheduled_at", startUtc)
        .lt("scheduled_at", endUtc)
        .order("scheduled_at");
      if (error) throw error;
      return ((data ?? []) as Array<RawReservationRow>).map(rowToReservation);
    },
    async create(input: ReservationCreateInput): Promise<Reservation> {
      const sb = createClient();
      const { data, error } = await sb
        .from("reservations")
        .insert({
          center_id: input.centerId,
          part_id: input.partId,
          owner_id: input.ownerId ?? null,
          practitioner_name: input.practitionerName ?? null,
          patient_id: input.patientId ?? null,
          patient_name: input.patientName ?? null,
          patient_phone: input.patientPhone ?? null,
          scheduled_at: input.scheduledAt,
          duration_min: input.durationMin ?? 30,
          service_id: input.serviceId ?? null,
          service_name: input.serviceName ?? null,
          status: input.status ?? "scheduled",
          memo: input.memo ?? null,
          deducted_pass_id: input.deductedPassId ?? null,
        })
        .select(
          `id, center_id, part_id, owner_id, practitioner_name, patient_id, patient_name,
           patient_phone, scheduled_at, duration_min, service_id, service_name,
           status, memo, deducted_pass_id, created_by, created_at, updated_at,
           owner:profiles!reservations_owner_id_fkey(display_name)`
        )
        .single();
      if (error) throw error;
      return rowToReservation(data as RawReservationRow);
    },
    async update(id, patch: ReservationUpdateInput): Promise<Reservation> {
      const sb = createClient();
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.ownerId !== undefined) update.owner_id = patch.ownerId;
      if (patch.practitionerName !== undefined)
        update.practitioner_name = patch.practitionerName;
      if (patch.patientId !== undefined) update.patient_id = patch.patientId;
      if (patch.patientName !== undefined) update.patient_name = patch.patientName;
      if (patch.patientPhone !== undefined) update.patient_phone = patch.patientPhone;
      if (patch.scheduledAt !== undefined) update.scheduled_at = patch.scheduledAt;
      if (patch.durationMin !== undefined) update.duration_min = patch.durationMin;
      if (patch.serviceId !== undefined) update.service_id = patch.serviceId;
      if (patch.serviceName !== undefined) update.service_name = patch.serviceName;
      if (patch.status !== undefined) update.status = patch.status;
      if (patch.memo !== undefined) update.memo = patch.memo;
      if (patch.deductedPassId !== undefined)
        update.deducted_pass_id = patch.deductedPassId;
      const { data, error } = await sb
        .from("reservations")
        .update(update)
        .eq("id", id)
        .select(
          `id, center_id, part_id, owner_id, practitioner_name, patient_id, patient_name,
           patient_phone, scheduled_at, duration_min, service_id, service_name,
           status, memo, deducted_pass_id, created_by, created_at, updated_at,
           owner:profiles!reservations_owner_id_fkey(display_name)`
        )
        .single();
      if (error) throw error;
      return rowToReservation(data as RawReservationRow);
    },
    async delete(id) {
      const sb = createClient();
      const { error } = await sb.from("reservations").delete().eq("id", id);
      if (error) throw error;
    },
  },

  consultations: {
    async listByPatient(patientId: string): Promise<Consultation[]> {
      const sb = createClient();
      const { data, error } = await sb
        .from("consultations")
        .select(
          `id, center_id, part_id, patient_id, owner_id, consulted_at, content,
           next_followup, created_at, updated_at,
           owner:profiles!consultations_owner_id_fkey(display_name)`
        )
        .eq("patient_id", patientId)
        .order("consulted_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as RawConsultationRow[]).map(rowToConsultation);
    },
    async listByCenter(centerId: string, limit = 100): Promise<Consultation[]> {
      const sb = createClient();
      const { data, error } = await sb
        .from("consultations")
        .select(
          `id, center_id, part_id, patient_id, owner_id, consulted_at, content,
           next_followup, created_at, updated_at,
           owner:profiles!consultations_owner_id_fkey(display_name),
           patient:patients!consultations_patient_id_fkey(personal:patient_personal(name))`
        )
        .eq("center_id", centerId)
        .order("consulted_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      const rows = (data ?? []) as Array<RawConsultationRow & {
        patient?:
          | { personal?: { name: string | null } | { name: string | null }[] | null }
          | Array<{ personal?: { name: string | null } | { name: string | null }[] | null }>
          | null;
      }>;
      return rows.map((r) => {
        const patientObj = Array.isArray(r.patient) ? r.patient[0] : r.patient;
        const personalObj = patientObj
          ? Array.isArray(patientObj.personal)
            ? patientObj.personal[0]
            : patientObj.personal
          : null;
        return rowToConsultation({
          ...r,
          patient_personal: personalObj ?? null,
        });
      });
    },
    async create(input: ConsultationCreateInput): Promise<Consultation> {
      const sb = createClient();
      const { data, error } = await sb
        .from("consultations")
        .insert({
          center_id: input.centerId,
          part_id: input.partId ?? null,
          patient_id: input.patientId,
          owner_id: input.ownerId ?? null,
          consulted_at: input.consultedAt ?? new Date().toISOString(),
          content: input.content,
          next_followup: input.nextFollowup ?? null,
        })
        .select(
          `id, center_id, part_id, patient_id, owner_id, consulted_at, content,
           next_followup, created_at, updated_at,
           owner:profiles!consultations_owner_id_fkey(display_name)`
        )
        .single();
      if (error) throw error;
      return rowToConsultation(data as RawConsultationRow);
    },
    async update(
      id: string,
      patch: ConsultationUpdateInput
    ): Promise<Consultation> {
      const sb = createClient();
      const update: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (patch.ownerId !== undefined) update.owner_id = patch.ownerId;
      if (patch.consultedAt !== undefined)
        update.consulted_at = patch.consultedAt;
      if (patch.content !== undefined) update.content = patch.content;
      if (patch.nextFollowup !== undefined)
        update.next_followup = patch.nextFollowup;
      const { data, error } = await sb
        .from("consultations")
        .update(update)
        .eq("id", id)
        .select(
          `id, center_id, part_id, patient_id, owner_id, consulted_at, content,
           next_followup, created_at, updated_at,
           owner:profiles!consultations_owner_id_fkey(display_name)`
        )
        .single();
      if (error) throw error;
      return rowToConsultation(data as RawConsultationRow);
    },
    async delete(id: string) {
      const sb = createClient();
      const { error } = await sb.from("consultations").delete().eq("id", id);
      if (error) throw error;
    },
  },

  loyalty: {
    async historyByPatient(patientId: string): Promise<LoyaltyEntry[]> {
      const sb = createClient();
      const { data, error } = await sb
        .from("loyalty_history")
        .select("id, patient_id, center_id, delta, reason, balance_after, created_at")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Array<{
        id: string;
        patient_id: string;
        center_id: string;
        delta: number;
        reason: string | null;
        balance_after: number;
        created_at: string;
      }>).map((r) => ({
        id: r.id,
        patientId: r.patient_id,
        centerId: r.center_id,
        delta: r.delta,
        reason: r.reason,
        balanceAfter: r.balance_after,
        createdAt: r.created_at,
      }));
    },
    async addEntry(input: LoyaltyCreateInput): Promise<LoyaltyEntry> {
      const sb = createClient();
      // 현재 잔액 읽기
      const { data: p, error: pErr } = await sb
        .from("patients")
        .select("loyalty_points")
        .eq("id", input.patientId)
        .single();
      if (pErr) throw pErr;
      const newBalance = (p?.loyalty_points ?? 0) + input.delta;
      if (newBalance < 0) throw new Error("적립금이 부족합니다.");
      // 이력 + 잔액 동시에
      const { data: hist, error: hErr } = await sb
        .from("loyalty_history")
        .insert({
          patient_id: input.patientId,
          center_id: input.centerId,
          delta: input.delta,
          reason: input.reason ?? null,
          balance_after: newBalance,
        })
        .select("id, patient_id, center_id, delta, reason, balance_after, created_at")
        .single();
      if (hErr) throw hErr;
      const { error: uErr } = await sb
        .from("patients")
        .update({ loyalty_points: newBalance })
        .eq("id", input.patientId);
      if (uErr) throw uErr;
      return {
        id: hist.id,
        patientId: hist.patient_id,
        centerId: hist.center_id,
        delta: hist.delta,
        reason: hist.reason,
        balanceAfter: hist.balance_after,
        createdAt: hist.created_at,
      };
    },
  },

  passes: {
    async listByPatient(patientId: string): Promise<ServicePass[]> {
      const sb = createClient();
      const { data, error } = await sb
        .from("service_passes")
        .select(
          "id, patient_id, center_id, service_id, service_name, part_id, total_count, used_count, note, created_at"
        )
        .eq("patient_id", patientId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as Array<{
        id: string;
        patient_id: string;
        center_id: string;
        service_id: string;
        service_name: string;
        part_id: PartId;
        total_count: number;
        used_count: number;
        note: string | null;
        created_at: string;
      }>).map((r) => ({
        id: r.id,
        patientId: r.patient_id,
        centerId: r.center_id,
        serviceId: r.service_id,
        serviceName: r.service_name,
        partId: r.part_id,
        totalCount: r.total_count,
        usedCount: r.used_count,
        note: r.note,
        createdAt: r.created_at,
      }));
    },
    async purchase(input: ServicePassCreateInput): Promise<ServicePass> {
      const sb = createClient();
      const { data, error } = await sb
        .from("service_passes")
        .insert({
          patient_id: input.patientId,
          center_id: input.centerId,
          service_id: input.serviceId,
          service_name: input.serviceName,
          part_id: input.partId,
          total_count: input.totalCount,
          used_count: 0,
          purchase_visit_id: input.purchaseVisitId ?? null,
          note: input.note ?? null,
        })
        .select(
          "id, patient_id, center_id, service_id, service_name, part_id, total_count, used_count, note, created_at"
        )
        .single();
      if (error) throw error;
      return {
        id: data.id,
        patientId: data.patient_id,
        centerId: data.center_id,
        serviceId: data.service_id,
        serviceName: data.service_name,
        partId: data.part_id,
        totalCount: data.total_count,
        usedCount: data.used_count,
        note: data.note,
        createdAt: data.created_at,
      };
    },
    async use(passId: string, count = 1): Promise<ServicePass> {
      const sb = createClient();
      const { data: cur, error: e1 } = await sb
        .from("service_passes")
        .select("total_count, used_count")
        .eq("id", passId)
        .single();
      if (e1) throw e1;
      const newUsed = (cur.used_count ?? 0) + count;
      if (newUsed > cur.total_count) {
        throw new Error("남은 횟수가 부족합니다.");
      }
      const { data, error } = await sb
        .from("service_passes")
        .update({ used_count: newUsed })
        .eq("id", passId)
        .select(
          "id, patient_id, center_id, service_id, service_name, part_id, total_count, used_count, note, created_at"
        )
        .single();
      if (error) throw error;
      return {
        id: data.id,
        patientId: data.patient_id,
        centerId: data.center_id,
        serviceId: data.service_id,
        serviceName: data.service_name,
        partId: data.part_id,
        totalCount: data.total_count,
        usedCount: data.used_count,
        note: data.note,
        createdAt: data.created_at,
      };
    },
  },

  stats: {
    async summary(centerId, from, to): Promise<SalesSummary> {
      const sb = createClient();
      // 두 출처 합산 — visit_sale_lines + sale_lines, 환자 수는 visits.patient_id distinct
      const { data: vsl, error: vErr } = await sb
        .from("visit_sale_lines")
        .select(
          `cash, card, hospital_card, corp_card,
           visit:visits!inner(id, center_id, visit_date, patient_id)`
        )
        .eq("visit.center_id", centerId)
        .gte("visit.visit_date", from)
        .lte("visit.visit_date", to);
      if (vErr) throw vErr;
      const { data: sl, error: sErr } = await sb
        .from("sale_lines")
        .select(
          `cash, card, hospital_card, corp_card,
           entry:daily_entries!inner(id, center_id, entry_date)`
        )
        .eq("entry.center_id", centerId)
        .gte("entry.entry_date", from)
        .lte("entry.entry_date", to);
      if (sErr) throw sErr;
      let totalCash = 0;
      let totalLegacyCard = 0;
      let totalHospitalCard = 0;
      let totalCorpCard = 0;
      const visitIds = new Set<string>();
      const patientIds = new Set<string>();
      for (const r of (vsl ?? []) as Array<{
        cash: number;
        card: number;
        hospital_card: number | null;
        corp_card: number | null;
        visit: { id: string; patient_id: string } | { id: string; patient_id: string }[];
      }>) {
        totalCash += r.cash;
        totalLegacyCard += r.card;
        totalHospitalCard += r.hospital_card ?? 0;
        totalCorpCard += r.corp_card ?? 0;
        const vv = Array.isArray(r.visit) ? r.visit[0] : r.visit;
        if (vv) {
          visitIds.add(vv.id);
          patientIds.add(vv.patient_id);
        }
      }
      for (const r of (sl ?? []) as Array<{
        cash: number;
        card: number;
        hospital_card: number | null;
        corp_card: number | null;
      }>) {
        totalCash += r.cash;
        totalLegacyCard += r.card;
        totalHospitalCard += r.hospital_card ?? 0;
        totalCorpCard += r.corp_card ?? 0;
      }
      const totalCard = totalLegacyCard + totalHospitalCard + totalCorpCard;
      return {
        totalCash,
        totalCard,
        totalHospitalCard,
        totalCorpCard,
        totalLegacyCard,
        total: totalCash + totalCard,
        visitCount: visitIds.size,
        patientCount: patientIds.size,
      };
    },
    async topPatients(centerId, from, to, limit = 10): Promise<PatientSalesRow[]> {
      const sb = createClient();
      const { data, error } = await sb
        .from("visit_sale_lines")
        .select(
          `cash, card,
           visit:visits!inner(visit_date, patient_id, center_id,
             personal:patient_personal(name))`
        )
        .eq("visit.center_id", centerId)
        .gte("visit.visit_date", from)
        .lte("visit.visit_date", to);
      if (error) throw error;
      const acc = new Map<
        string,
        { name: string | null; total: number; last: string | null }
      >();
      for (const r of (data ?? []) as Array<{
        cash: number;
        card: number;
        visit:
          | {
              visit_date: string;
              patient_id: string;
              personal:
                | { name: string | null }
                | { name: string | null }[]
                | null;
            }
          | Array<{
              visit_date: string;
              patient_id: string;
              personal:
                | { name: string | null }
                | { name: string | null }[]
                | null;
            }>;
      }>) {
        const vv = Array.isArray(r.visit) ? r.visit[0] : r.visit;
        if (!vv) continue;
        const personal = Array.isArray(vv.personal) ? vv.personal[0] : vv.personal;
        const cur = acc.get(vv.patient_id) ?? {
          name: personal?.name ?? null,
          total: 0,
          last: null as string | null,
        };
        cur.total += r.cash + r.card;
        if (!cur.last || vv.visit_date > cur.last) cur.last = vv.visit_date;
        acc.set(vv.patient_id, cur);
      }
      const rows = Array.from(acc.entries())
        .map(([patientId, v]) => ({
          patientId,
          patientName: v.name,
          total: v.total,
          lastVisitDate: v.last,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, limit);
      return rows;
    },
    async outstandingByPatient(centerId) {
      const sb = createClient();
      const { data, error } = await sb
        .from("visits")
        .select(
          `outstanding_amount, patient_id,
           personal:patient_personal(name)`
        )
        .eq("center_id", centerId)
        .gt("outstanding_amount", 0);
      if (error) throw error;
      const acc = new Map<
        string,
        { name: string | null; total: number }
      >();
      for (const r of (data ?? []) as Array<{
        outstanding_amount: number;
        patient_id: string;
        personal:
          | { name: string | null }
          | { name: string | null }[]
          | null;
      }>) {
        const personal = Array.isArray(r.personal) ? r.personal[0] : r.personal;
        const cur = acc.get(r.patient_id) ?? {
          name: personal?.name ?? null,
          total: 0,
        };
        cur.total += r.outstanding_amount;
        acc.set(r.patient_id, cur);
      }
      return Array.from(acc.entries())
        .map(([patientId, v]) => ({
          patientId,
          patientName: v.name,
          total: v.total,
        }))
        .sort((a, b) => b.total - a.total);
    },
    async crm(centerId): Promise<CrmPatientRow[]> {
      const sb = createClient();
      // 1) 환자 마스터 (이름/연락처/태그/유입/최초방문)
      const { data: pData, error: pErr } = await sb
        .from("patients")
        .select(PATIENT_SELECT)
        .eq("center_id", centerId);
      if (pErr) throw pErr;
      const patients: Patient[] = (
        (pData ?? []) as Parameters<typeof rowToPatient>[0][]
      ).map(rowToPatient);

      // 2) 방문 집계 — 방문 수 + 마지막 방문일
      const { data: vData, error: vErr } = await sb
        .from("visits")
        .select("patient_id, visit_date")
        .eq("center_id", centerId);
      if (vErr) throw vErr;
      const visitAgg = new Map<string, { count: number; last: string | null }>();
      for (const r of (vData ?? []) as { patient_id: string; visit_date: string }[]) {
        const cur = visitAgg.get(r.patient_id) ?? { count: 0, last: null };
        cur.count += 1;
        if (!cur.last || r.visit_date > cur.last) cur.last = r.visit_date;
        visitAgg.set(r.patient_id, cur);
      }

      // 3) 매출 집계 — visit_sale_lines (방문 조인으로 센터 필터)
      const { data: sData, error: sErr } = await sb
        .from("visit_sale_lines")
        .select("cash, card, visit:visits!inner(patient_id, center_id)")
        .eq("visit.center_id", centerId);
      if (sErr) throw sErr;
      const revAgg = new Map<string, number>();
      for (const r of (sData ?? []) as Array<{
        cash: number;
        card: number;
        visit:
          | { patient_id: string }
          | { patient_id: string }[];
      }>) {
        const vv = Array.isArray(r.visit) ? r.visit[0] : r.visit;
        if (!vv) continue;
        revAgg.set(vv.patient_id, (revAgg.get(vv.patient_id) ?? 0) + r.cash + r.card);
      }

      // 4) 회수권 잔여 합계
      const { data: passData, error: passErr } = await sb
        .from("service_passes")
        .select("patient_id, total_count, used_count")
        .eq("center_id", centerId);
      if (passErr) throw passErr;
      const passAgg = new Map<string, number>();
      for (const r of (passData ?? []) as {
        patient_id: string;
        total_count: number;
        used_count: number;
      }[]) {
        const remain = Math.max(0, r.total_count - r.used_count);
        passAgg.set(r.patient_id, (passAgg.get(r.patient_id) ?? 0) + remain);
      }

      return patients.map((p) => {
        const v = visitAgg.get(p.id);
        return {
          patientId: p.id,
          name: p.personal?.name ?? null,
          phone: p.personal?.phone ?? null,
          tags: p.tags ?? [],
          inflowChannels: p.inflowChannels,
          firstVisitDate: p.firstVisitDate,
          lastVisitDate: v?.last ?? null,
          visitCount: v?.count ?? 0,
          totalRevenue: revAgg.get(p.id) ?? 0,
          passRemaining: passAgg.get(p.id) ?? 0,
        };
      });
    },
  },

  settlement: {
    async rule(centerId): Promise<SettlementRule> {
      const sb = createClient();
      const { data, error } = await sb
        .from("settlement_rules")
        .select("vat_rate, card_fee_rate, center_share_pct, corp_share_pct, vat_exempt_parts")
        .eq("center_id", centerId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { ...DEFAULT_RULE };
      return {
        vatRate: Number(data.vat_rate),
        cardFeeRate: Number(data.card_fee_rate),
        centerSharePct: Number(data.center_share_pct),
        corpSharePct: Number(data.corp_share_pct),
        vatExemptParts: data.vat_exempt_parts ?? [],
      };
    },
  },
};

// Suppress unused warning placeholder — emptyChannels import is needed for type inference
void emptyChannels;
