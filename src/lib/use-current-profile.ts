"use client";

import { useEffect, useState } from "react";
import { getDataSource } from "@/lib/data";
import type { UserProfile } from "@/lib/types";

// 현재 로그인한 사용자의 프로필 (역할 + 센터 + 파트)
// 모든 권한 분리는 이 hook의 반환값 기반.

export function useCurrentProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getDataSource();
        const me = await data.me.current();
        if (!cancelled) {
          setProfile(me);
          setLoaded(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { profile, loaded, error };
}
