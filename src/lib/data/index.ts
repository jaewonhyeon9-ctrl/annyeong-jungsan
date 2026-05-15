// 현재 운영 모드: Supabase를 사용하지 않고 로컬 mock 데이터 소스로 고정.
// NEXT_PUBLIC_SUPABASE_* 환경 변수가 있어도 자동 전환하지 않는다.

import type { DataSource } from "./source";
import { mockDataSource } from "./mock";

let cached: DataSource | null = null;

export async function getDataSource(): Promise<DataSource> {
  if (cached) return cached;
  cached = mockDataSource;
  return cached;
}

// 동기 진입점
export const data: DataSource = mockDataSource;

export type { DataSource } from "./source";
export const isSupabaseActive = false;
