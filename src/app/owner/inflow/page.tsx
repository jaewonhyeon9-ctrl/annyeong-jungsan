"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { getDataSource } from "@/lib/data";
import { fmtMonth, thisMonthKST } from "@/lib/format";
import { INFLOW_CHANNELS, emptyChannels, type InflowChannel } from "@/lib/types";
import { useCurrentCenter } from "@/lib/use-current-center";

export default function InflowPage() {
  const { centerId, loaded: centerLoaded, error: centerError } = useCurrentCenter();
  const [month, setMonth] = useState(thisMonthKST());
  const [channels, setChannels] = useState<Record<InflowChannel, number>>(
    emptyChannels()
  );
  const [newPatients, setNewPatients] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // 월이 바뀔 때마다 기존 데이터 불러오기
  useEffect(() => {
    if (!centerLoaded) return;
    let cancelled = false;
    (async () => {
      if (!centerId) {
        if (!cancelled) {
          setChannels(emptyChannels());
          setNewPatients(0);
        }
        return;
      }
      const data = await getDataSource();
      const existing = await data.inflows.byMonth(centerId, month);
      if (!cancelled) {
        if (existing) {
          setChannels(existing.channels);
          setNewPatients(existing.newPatients);
        } else {
          setChannels(emptyChannels());
          setNewPatients(0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [centerId, centerLoaded, month]);

  const total = Object.values(channels).reduce((s, v) => s + v, 0);

  function inc(ch: InflowChannel, delta: number) {
    setChannels((c) => ({ ...c, [ch]: Math.max(0, c[ch] + delta) }));
  }

  async function handleSave() {
    if (!centerId) {
      setSavedNotice(centerError ?? "센터 정보를 불러오지 못했습니다.");
      return;
    }
    setSaving(true);
    setSavedNotice(null);
    try {
      const data = await getDataSource();
      await data.inflows.upsert({
        id: `inflow-${month}`,
        centerId,
        month,
        channels,
        newPatients,
      });
      setSavedNotice(`${fmtMonth(month)} 저장 완료 — 총 ${total}건 / 신규 ${newPatients}명`);
    } catch (err) {
      setSavedNotice(`저장 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-sand-50 pb-20">
      <header className="sticky top-0 z-10 border-b border-sand-200 bg-sand-50/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
          <Link href="/owner" className="text-sand-600 hover:text-sand-800">
            ←
          </Link>
          <div className="text-sm font-semibold text-sand-800">환자 유입</div>
          <div className="w-4" />
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-5 px-5 py-6">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-sand-600">집계 월</div>
                <div className="mt-0.5 text-lg font-semibold text-sand-800">
                  {fmtMonth(month)}
                </div>
              </div>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="rounded-lg border border-sand-200 bg-white px-3 py-1.5 text-sm text-sand-700"
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between border-b border-sand-200 pb-3">
              <div className="text-sm font-semibold text-sand-800">유입경로별 카운트</div>
              <div className="text-xs text-sand-500 tabular">총 {total}건</div>
            </div>
            <div className="mt-3 space-y-2">
              {INFLOW_CHANNELS.map((ch) => (
                <div
                  key={ch.id}
                  className="flex items-center justify-between rounded-lg bg-sand-100/60 px-3 py-2"
                >
                  <div className="text-sm text-sand-800">{ch.label}</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => inc(ch.id, -1)}
                      className="h-8 w-8 rounded-lg bg-white text-sand-600 shadow-sm active:bg-sand-200"
                    >
                      −
                    </button>
                    <div className="min-w-[2.5rem] text-center text-base font-semibold tabular text-sand-800">
                      {channels[ch.id]}
                    </div>
                    <button
                      type="button"
                      onClick={() => inc(ch.id, 1)}
                      className="h-8 w-8 rounded-lg bg-clay-500 text-white shadow-sm active:bg-clay-600"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-sand-800">신규환자수</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNewPatients((n) => Math.max(0, n - 1))}
                  className="h-8 w-8 rounded-lg bg-sand-100 text-sand-600 active:bg-sand-200"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  value={newPatients}
                  onChange={(e) => setNewPatients(Math.max(0, Number(e.target.value) || 0))}
                  className="w-16 rounded-lg border border-sand-200 bg-white px-2 py-1.5 text-center text-base font-semibold tabular focus:border-clay-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setNewPatients((n) => n + 1)}
                  className="h-8 w-8 rounded-lg bg-moss-500 text-white active:bg-moss-600"
                >
                  +
                </button>
              </div>
            </div>
          </CardBody>
        </Card>

        {savedNotice && (
          <div className="rounded-xl bg-moss-500/10 px-4 py-3 text-sm text-moss-700">
            {savedNotice}
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !centerLoaded}
          className="w-full rounded-2xl bg-sand-800 px-5 py-4 text-base font-semibold text-white shadow-md transition hover:bg-sand-900 active:scale-[0.99] disabled:opacity-60"
        >
          {saving ? "저장 중..." : centerLoaded ? "저장" : "센터 확인 중..."}
        </button>
      </div>
    </div>
  );
}
