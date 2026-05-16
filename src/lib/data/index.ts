// 데이터 모드는 명시적으로만 전환한다.
// 기본값은 localStorage mock, NEXT_PUBLIC_DATA_SOURCE=supabase 일 때만 Supabase 사용.

import type { DataSource } from "./source";
import { mockDataSource } from "./mock";

const dataSourceMode = process.env.NEXT_PUBLIC_DATA_SOURCE ?? "mock";
const hasSupabaseEnv =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const useSupabase = dataSourceMode === "supabase" && hasSupabaseEnv;

let cached: DataSource | null = null;

export async function getDataSource(): Promise<DataSource> {
  if (cached) return cached;
  if (useSupabase) {
    const { supabaseDataSource } = await import("./supabase");
    cached = supabaseDataSource;
  } else {
    cached = mockDataSource;
  }
  return cached;
}

// 동기 진입점
export const data: DataSource = mockDataSource;

export type { DataSource } from "./source";
export const isSupabaseActive = useSupabase;
