// Supabase DB 타입 — schema.sql 과 일치
// Phase 2 본격 연결 시 `supabase gen types typescript --project-id ...` 로 자동생성 권장.
// 지금은 수기로 골격만.

export type PartId =
  | "scalp"
  | "permanent_makeup"
  | "smp"
  | "pedicure"
  | "skincare";

export type UserRole = "owner" | "admin";

export type InflowChannelDb =
  | "instagram"
  | "blog"
  | "naver_place"
  | "internet"
  | "outdoor"
  | "phone"
  | "visitor"
  | "inpatient"
  | "referral"
  | "other";

export interface Database {
  public: {
    Tables: {
      centers: {
        Row: {
          id: string;
          name: string;
          owner_name: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["centers"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["centers"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          center_id: string | null;
          display_name: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["profiles"]["Row"],
          "created_at"
        > & { created_at?: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      patients: {
        Row: {
          id: string;
          center_id: string;
          first_visit_date: string;
          inflow_channels: InflowChannelDb[];
          consent: boolean;
          tags: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["patients"]["Row"],
          "created_at" | "updated_at"
        > & { created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["patients"]["Insert"]>;
        Relationships: [];
      };
      visits: {
        Row: {
          id: string;
          patient_id: string;
          center_id: string;
          visit_date: string;
          part_id: PartId;
          visit_memo: string | null;
          before_photo_url: string | null;
          after_photo_url: string | null;
          foot_issue_update: unknown | null;
          ocr_image_url: string | null;
          ocr_confidence: number | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["visits"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["visits"]["Insert"]>;
        Relationships: [];
      };
      daily_entries: {
        Row: {
          id: string;
          center_id: string;
          entry_date: string;
          note: string | null;
          ocr_image_url: string | null;
          ocr_confidence: number | null;
          ocr_auto_saved: boolean;
          ocr_needs_review: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["daily_entries"]["Row"],
          "id" | "created_at" | "updated_at"
        > & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<
          Database["public"]["Tables"]["daily_entries"]["Insert"]
        >;
        Relationships: [];
      };
      inflow_entries: {
        Row: {
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
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["inflow_entries"]["Row"],
          "id" | "created_at" | "updated_at"
        > & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<
          Database["public"]["Tables"]["inflow_entries"]["Insert"]
        >;
        Relationships: [];
      };
      settlement_rules: {
        Row: {
          center_id: string;
          vat_rate: number;
          card_fee_rate: number;
          center_share_pct: number;
          corp_share_pct: number;
          vat_exempt_parts: PartId[];
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["settlement_rules"]["Row"],
          "updated_at"
        > & { updated_at?: string };
        Update: Partial<
          Database["public"]["Tables"]["settlement_rules"]["Insert"]
        >;
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          part_id: PartId;
          name: string;
          default_price: number;
          active: boolean;
          sort_order: number;
        };
        Insert: {
          id: string;
          part_id: PartId;
          name: string;
          default_price?: number;
          active?: boolean;
          sort_order?: number;
        };
        Update: {
          id?: string;
          part_id?: PartId;
          name?: string;
          default_price?: number;
          active?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          name: string;
          default_price: number;
          kind: "sale" | "consumable" | "both";
          active: boolean;
        };
        Insert: {
          id: string;
          name: string;
          default_price?: number;
          kind?: "sale" | "consumable" | "both";
          active?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          default_price?: number;
          kind?: "sale" | "consumable" | "both";
          active?: boolean;
        };
        Relationships: [];
      };
      symptom_master: {
        Row: {
          id: string;
          part_id: PartId;
          category: string;
          label: string;
          value: string;
          active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          part_id: PartId;
          category: string;
          label: string;
          value: string;
          active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          part_id?: PartId;
          category?: string;
          label?: string;
          value?: string;
          active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      homecare_master: {
        Row: {
          id: string;
          part_id: PartId | null;
          name: string;
          instruction: string | null;
          active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          part_id?: PartId | null;
          name: string;
          instruction?: string | null;
          active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          part_id?: PartId | null;
          name?: string;
          instruction?: string | null;
          active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
