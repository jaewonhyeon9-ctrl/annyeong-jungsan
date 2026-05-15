// Supabase 구현 — Phase 2에서 본격 사용
// .env.local에 NEXT_PUBLIC_SUPABASE_URL 이 설정되면 자동으로 활성화됨
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
  PartId,
  Pregnancy,
  SettlementRule,
  Severity,
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
    createdAt: r.created_at,
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
        .select("id, role, center_id, part_id, display_name, active, created_at")
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
      };
    },
    setMock(_profile) {
      // no-op in Supabase mode — 실 인증 사용
    },
  },

  users: {
    async list(centerId) {
      const sb = createClient();
      let q = sb
        .from("profiles")
        .select(
          "id, role, center_id, part_id, display_name, active, created_at, email"
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
      }>).map((r) => ({
        id: r.id,
        email: r.email ?? "",
        role: r.role,
        centerId: r.center_id,
        partId: r.part_id,
        displayName: r.display_name,
        active: r.active,
        createdAt: r.created_at,
      }));
    },
    async create(_input) {
      // 신규 사용자 생성은 service_role 권한 필요 — server route 또는 Supabase Dashboard
      throw new Error(
        "사용자 생성은 서버 측 admin API 가 필요합니다. Supabase Dashboard → Authentication → Users 에서 직접 추가 후 SQL 로 profiles row 삽입하세요."
      );
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
      const { data, error } = await sb
        .from("profiles")
        .update(updateRow)
        .eq("id", id)
        .select(
          "id, role, center_id, part_id, display_name, active, created_at, email"
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
      };
    },
    async resetPassword(_id, _newPassword) {
      throw new Error(
        "비번 리셋은 service_role 권한 필요. Supabase Dashboard → Authentication → Users 에서 진행하세요."
      );
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
      if (!id) {
        // 클라이언트 측 ID 발급 — 동월 시퀀스 조회
        const { data: existing } = await sb
          .from("patients")
          .select("id")
          .eq("center_id", input.centerId)
          .like(
            "id",
            `C%-${month.slice(2, 4)}${month.slice(5, 7)}-%`
          );
        const fakeList = ((existing ?? []) as { id: string }[]).map((e) => ({
          id: e.id,
        })) as unknown as Patient[];
        id = generateNextPatientId(fakeList, 1, month);
      }

      const { data, error } = await sb
        .from("patients")
        .insert({
          id,
          center_id: input.centerId,
          first_visit_date: input.firstVisitDate,
          inflow_channels: input.inflowChannels,
          consent: input.consent,
        })
        .select("id, center_id, first_visit_date, inflow_channels, consent, created_at, updated_at")
        .single();
      if (error) throw error;

      // 개인정보 별도 테이블
      if (input.personal) {
        const { error: personalError } = await sb.from("patient_personal").upsert({
          patient_id: id,
          name: input.personal.name ?? null,
          gender: input.personal.gender ?? null,
          phone: input.personal.phone ?? null,
          birth_date: input.personal.birthDate ?? null,
          address: input.personal.address ?? null,
        });
        if (personalError) throw personalError;
      }

      await upsertPatientChart(sb, id, input.chart);

      const created = await this.get(id);
      return created ?? rowToPatient(data);
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
          "id, patient_id, center_id, visit_date, part_id, visit_memo, created_at"
        )
        .eq("patient_id", patientId)
        .order("visit_date", { ascending: false });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data ?? []) as any[]).map((r) => rowToVisit(r));
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
        })
        .select(
          "id, patient_id, center_id, visit_date, part_id, visit_memo, created_at"
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
          }))
        );
        if (salesError) throw salesError;
      }

      return rowToVisit(visitRow, input.sales);
    },
  },

  entries: {
    async byMonth(centerId, yearMonth) {
      const sb = createClient();

      // 1) 수동 입력 entries + sale_lines
      const { data: entryRows, error: entryErr } = await sb
        .from("daily_entries")
        .select("id, center_id, entry_date, note, created_at")
        .eq("center_id", centerId)
        .gte("entry_date", `${yearMonth}-01`)
        .lte("entry_date", `${yearMonth}-31`);
      if (entryErr) throw entryErr;

      const entryIds = ((entryRows ?? []) as { id: string }[]).map((r) => r.id);
      let saleLinesByEntry = new Map<string, DailyEntry["sales"]>();
      if (entryIds.length > 0) {
        const { data: saleRows, error: saleErr } = await sb
          .from("sale_lines")
          .select("entry_id, service_id, service_name, part_id, cash, card")
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
        }[]) {
          const arr = saleLinesByEntry.get(r.entry_id) ?? [];
          arr.push({
            serviceId: r.service_id,
            serviceName: r.service_name,
            partId: r.part_id,
            cash: r.cash,
            card: r.card,
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
        .lte("visit_date", `${yearMonth}-31`);
      if (visitErr) throw visitErr;

      const visitIds = ((visitRows ?? []) as { id: string }[]).map((r) => r.id);
      const visitSalesByVisit = new Map<string, DailyEntry["sales"]>();
      if (visitIds.length > 0) {
        const { data: vsRows, error: vsErr } = await sb
          .from("visit_sale_lines")
          .select("visit_id, service_id, service_name, part_id, cash, card")
          .in("visit_id", visitIds);
        if (vsErr) throw vsErr;
        for (const r of (vsRows ?? []) as {
          visit_id: string;
          service_id: string;
          service_name: string;
          part_id: PartId;
          cash: number;
          card: number;
        }[]) {
          const arr = visitSalesByVisit.get(r.visit_id) ?? [];
          arr.push({
            serviceId: r.service_id,
            serviceName: r.service_name,
            partId: r.part_id,
            cash: r.cash,
            card: r.card,
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
