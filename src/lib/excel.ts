import * as XLSX from "xlsx";
import type { DailyEntry, InflowEntry } from "./types";
import { INFLOW_CHANNELS, PARTS } from "./types";
import type { SettlementResult } from "./settlement";
import { fmtMonth } from "./format";

// ============================================================
// 안녕메디컬 정산 — Excel 내보내기
// 사장님에게 전달할 때 쓰는 양식.
// 3개 시트: 정산 요약 / 파트별 매출 / 환자 유입
// ============================================================

function formatPartLabel(partId: string): string {
  return PARTS.find((p) => p.id === partId)?.label ?? partId;
}

function formatChannelLabel(id: string): string {
  return INFLOW_CHANNELS.find((c) => c.id === id)?.label ?? id;
}

// 시트 1: 정산 요약
function buildSettlementSheet(
  month: string,
  centerName: string,
  settlement: SettlementResult
): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    [`안녕메디컬 ${centerName}`, "", "", ""],
    [`${fmtMonth(month)} 정산 요약`, "", "", ""],
    ["", "", "", ""],
    ["항목", "금액(원)", "", "비고"],
    ["총 매출 (현금+카드)", settlement.totalGross, "", ""],
    ["  현금", settlement.totalCash, "", ""],
    ["  카드", settlement.totalCard, "", ""],
    ["", "", "", ""],
    [
      "부가세",
      -settlement.vat,
      "",
      `과세분 ${settlement.taxableGross.toLocaleString()}원 × 10/110`,
    ],
    [
      "카드 수수료",
      -settlement.cardFee,
      "",
      `카드매출 × ${(settlement.rule.cardFeeRate * 100).toFixed(1)}%`,
    ],
    ["차감 합계", -settlement.totalDeductions, "", ""],
    ["", "", "", ""],
    ["순매출", settlement.netRevenue, "", "총매출 − 차감"],
    ["", "", "", ""],
    [
      `센터 (${settlement.rule.centerSharePct * 100}%)`,
      settlement.centerShare,
      "",
      "",
    ],
    [
      `법인 (${settlement.rule.corpSharePct * 100}%)`,
      settlement.corpShare,
      "",
      "",
    ],
    ["", "", "", ""],
    ["", "", "", ""],
    ["파트별 매출", "", "", ""],
    ["파트", "현금", "카드", "합계"],
    ...settlement.partBreakdown.map((p) => [
      formatPartLabel(p.partId),
      p.cash,
      p.card,
      p.total,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // 컬럼 너비
  ws["!cols"] = [{ wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 28 }];

  // 셀 병합 — 헤더
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
  ];

  return ws;
}

// 시트 2: 파트별 매출 (일자별)
function buildSalesSheet(
  month: string,
  centerName: string,
  entries: DailyEntry[]
): XLSX.WorkSheet {
  const sortedEntries = [...entries].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // 헤더: 파트별 현금/카드 컬럼
  const partCols = PARTS.flatMap((p) => [
    `${p.label} 현금`,
    `${p.label} 카드`,
  ]);

  const header = ["날짜", ...partCols, "일일 현금", "일일 카드", "일일 합계"];

  // 일자별 행
  const rows: (string | number)[][] = [
    [`안녕메디컬 ${centerName} ${fmtMonth(month)} 파트별 매출`],
    [],
    header,
  ];

  let totalCash = 0;
  let totalCard = 0;
  const partTotals: Record<string, { cash: number; card: number }> =
    Object.fromEntries(PARTS.map((p) => [p.id, { cash: 0, card: 0 }]));

  for (const e of sortedEntries) {
    const byPart: Record<string, { cash: number; card: number }> =
      Object.fromEntries(PARTS.map((p) => [p.id, { cash: 0, card: 0 }]));
    for (const line of e.sales) {
      byPart[line.partId].cash += line.cash;
      byPart[line.partId].card += line.card;
      partTotals[line.partId].cash += line.cash;
      partTotals[line.partId].card += line.card;
    }
    const dayCash = Object.values(byPart).reduce((s, v) => s + v.cash, 0);
    const dayCard = Object.values(byPart).reduce((s, v) => s + v.card, 0);
    totalCash += dayCash;
    totalCard += dayCard;

    rows.push([
      e.date,
      ...PARTS.flatMap((p) => [byPart[p.id].cash, byPart[p.id].card]),
      dayCash,
      dayCard,
      dayCash + dayCard,
    ]);
  }

  // 합계 행
  rows.push([]);
  rows.push([
    "합계",
    ...PARTS.flatMap((p) => [partTotals[p.id].cash, partTotals[p.id].card]),
    totalCash,
    totalCard,
    totalCash + totalCard,
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, ...partCols.map(() => ({ wch: 12 })), { wch: 12 }, { wch: 12 }, { wch: 14 }];
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } }];

  return ws;
}

// 시트 3: 환자 유입
function buildInflowSheet(
  month: string,
  centerName: string,
  inflow: InflowEntry | undefined
): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    [`안녕메디컬 ${centerName} ${fmtMonth(month)} 환자 유입`],
    [],
    ["유입경로", "건수"],
  ];

  let total = 0;
  for (const ch of INFLOW_CHANNELS) {
    const count = inflow?.channels[ch.id] ?? 0;
    total += count;
    rows.push([formatChannelLabel(ch.id), count]);
  }
  rows.push([]);
  rows.push(["총 유입수", total]);
  rows.push(["신규 환자", inflow?.newPatients ?? 0]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 16 }, { wch: 12 }];
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];

  return ws;
}

// 메인 export — 클릭 시 다운로드 트리거
export function exportSettlementExcel(
  month: string,
  centerName: string,
  entries: DailyEntry[],
  settlement: SettlementResult,
  inflow?: InflowEntry
) {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    buildSettlementSheet(month, centerName, settlement),
    "정산 요약"
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildSalesSheet(month, centerName, entries),
    "파트별 매출"
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildInflowSheet(month, centerName, inflow),
    "환자 유입"
  );

  const safeCenterName = centerName.replace(/[\\/:*?"<>|]/g, "");
  const filename = `안녕메디컬_${safeCenterName}_${month}_정산.xlsx`;
  XLSX.writeFile(wb, filename);
}
