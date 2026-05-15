"use client";

import { useEffect, useState } from "react";
import { getDataSource } from "@/lib/data";
import type { Center } from "@/lib/types";

export function useCurrentCenter() {
  const [center, setCenter] = useState<Center | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getDataSource();
        const current = await data.centers.current();
        if (!cancelled) setCenter(current);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { center, centerId: center?.id ?? null, loaded, error };
}
