// 환경에 따라 mock 또는 supabase 자동 선택
// .env.local 에 NEXT_PUBLIC_SUPABASE_URL 이 있으면 supabase, 없으면 mock.

import type { DataSource } from "./source";
import { mockDataSource } from "./mock";

const hasSupabase =
  typeof process !== "undefined" &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cached: DataSource | null = null;

export async function getDataSource(): Promise<DataSource> {
  if (cached) return cached;
  if (hasSupabase) {
    const { supabaseDataSource } = await import("./supabase");
    cached = supabaseDataSource;
  } else {
    cached = mockDataSource;
  }
  return cached;
}

// 동기 진입점 — mock 기본, Supabase 사용 시에는 getDataSource() 권장
export const data: DataSource = mockDataSource;

export type { DataSource } from "./source";
export const isSupabaseActive = hasSupabase;
