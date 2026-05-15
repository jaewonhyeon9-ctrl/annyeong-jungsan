import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// 클라이언트 컴포넌트용 Supabase 클라이언트
// 사용법:
//   const supabase = createClient();
//   const { data } = await supabase.from("patients").select("*");
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
