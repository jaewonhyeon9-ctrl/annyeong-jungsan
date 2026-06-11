"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDataSource } from "@/lib/data";
import { fmtWon } from "@/lib/format";
import { useCurrentCenter } from "@/lib/use-current-center";

export default function OwnerOutstandingPage() {
  const { centerId, loaded } = useCurrentCenter();
  const [list, setList] = useState<
    Array<{ patientId: string; patientName: string | null; total: number }>
  >([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!centerId) return;
      setBusy(true);
      try {
        const data = await getDataSource();
        setList(await data.stats.outstandingByPatient(centerId));
      } finally {
        setBusy(false);
      }
    })();
  }, [centerId]);

  if (!loaded)
    return <div className="py-12 text-center text-sm text-sand-500">로딩 중...</div>;

  const grandTotal = list.reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-sand-900">미수금</h2>
          <p className="mt-0.5 text-xs text-sand-500">
            방문 차트 입력 시 “미수금” 필드에 남긴 금액의 환자별 합계
          </p>
        </div>
        <Link href="/owner" className="text-xs text-sand-500 hover:text-sand-700">
          ← 홈
        </Link>
      </div>

      <Card>
        <CardBody>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-sand-500">전체 미수금 합계</div>
              <div className="text-2xl font-bold text-clay-700 tabular">
                {fmtWon(grandTotal)}
              </div>
            </div>
            <div className="text-xs text-sand-500 tabular">{list.length} 명</div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>환자별 미수금</CardTitle>
        </CardHeader>
        <CardBody>
          {busy ? (
            <div className="py-6 text-center text-xs text-sand-500">로딩 중...</div>
          ) : list.length === 0 ? (
            <div className="py-6 text-center text-xs text-sand-500">
              미수금이 있는 환자가 없습니다. 🎉
            </div>
          ) : (
            <ul className="space-y-1.5">
              {list.map((r) => (
                <li
                  key={r.patientId}
                  className="flex items-center justify-between rounded-lg border border-sand-100 bg-white px-3 py-2"
                >
                  <Link
                    href={`/owner/patients/${r.patientId}`}
                    className="text-sm font-medium text-sand-800 hover:text-clay-600"
                  >
                    {r.patientName ?? "(이름 없음)"}
                    <span className="ml-2 text-[10px] text-sand-400">{r.patientId}</span>
                  </Link>
                  <div className="text-sm font-semibold text-clay-700 tabular">
                    {fmtWon(r.total)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
