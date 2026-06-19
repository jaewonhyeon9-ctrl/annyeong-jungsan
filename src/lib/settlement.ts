import type {
  DailyEntry,
  PartId,
  ProductLine,
  SaleLine,
  SettlementRule,
} from "./types";

// 정산 계산 — Pure 함수 (테스트 용이)

export interface PartBreakdown {
  partId: PartId;
  cash: number;
  card: number;
  total: number;
  vatExempt: boolean;
}

export interface SettlementResult {
  // 1) 원천 매출
  totalCash: number;
  totalCard: number;
  totalGross: number;

  // 2) 파트별 분해
  partBreakdown: PartBreakdown[];
  productGross: number;

  // 3) 세금/비용 차감
  taxableGross: number; // 과세 매출
  exemptGross: number; // 면세 매출
  vat: number; // 부가세 (taxableGross × 10/110)
  cardFee: number; // 카드 수수료 (totalCard × cardFeeRate)
  totalDeductions: number;

  // 4) 순매출 & 분배
  netRevenue: number;
  centerShare: number;
  corpShare: number;

  // 메타
  rule: SettlementRule;
  entryCount: number;
}

// 한 라인의 카드 합 = 기존(미분류) + 병원포스 + 법인포스
function cardOf(l: { card: number; hospitalCard?: number; corpCard?: number }): number {
  return (l.card || 0) + (l.hospitalCard || 0) + (l.corpCard || 0);
}

function sumSaleLines(lines: SaleLine[]): { cash: number; card: number } {
  return lines.reduce(
    (acc, l) => ({ cash: acc.cash + l.cash, card: acc.card + cardOf(l) }),
    { cash: 0, card: 0 }
  );
}

function sumProductLines(lines: ProductLine[]): { cash: number; card: number } {
  return lines.reduce(
    (acc, l) => ({ cash: acc.cash + l.cash, card: acc.card + l.card }),
    { cash: 0, card: 0 }
  );
}

export function computeSettlement(
  entries: DailyEntry[],
  rule: SettlementRule
): SettlementResult {
  let totalCash = 0;
  let totalCard = 0;
  let productGross = 0;

  // 파트별 집계
  const partAgg = new Map<
    PartId,
    { cash: number; card: number; vatExempt: boolean }
  >();

  for (const entry of entries) {
    for (const line of entry.sales) {
      const lineCard = cardOf(line);
      totalCash += line.cash;
      totalCard += lineCard;

      const existing = partAgg.get(line.partId);
      const vatExempt = rule.vatExemptParts.includes(line.partId);
      if (existing) {
        existing.cash += line.cash;
        existing.card += lineCard;
      } else {
        partAgg.set(line.partId, {
          cash: line.cash,
          card: lineCard,
          vatExempt,
        });
      }
    }

    const prod = sumProductLines(entry.productSales);
    totalCash += prod.cash;
    totalCard += prod.card;
    productGross += prod.cash + prod.card;
  }

  const totalGross = totalCash + totalCard;

  const partBreakdown: PartBreakdown[] = Array.from(partAgg.entries()).map(
    ([partId, v]) => ({
      partId,
      cash: v.cash,
      card: v.card,
      total: v.cash + v.card,
      vatExempt: v.vatExempt,
    })
  );

  const taxableGross =
    partBreakdown
      .filter((p) => !p.vatExempt)
      .reduce((s, p) => s + p.total, 0) + productGross; // 제품 매출은 과세 가정
  const exemptGross = partBreakdown
    .filter((p) => p.vatExempt)
    .reduce((s, p) => s + p.total, 0);

  // VAT 추출 — 부가세 포함 가격에서 10/110 추출
  const vat = Math.round(taxableGross * (rule.vatRate / (1 + rule.vatRate)));
  const cardFee = Math.round(totalCard * rule.cardFeeRate);
  const totalDeductions = vat + cardFee;

  const netRevenue = totalGross - totalDeductions;
  const centerShare = Math.round(netRevenue * rule.centerSharePct);
  const corpShare = netRevenue - centerShare; // 잔여를 법인 (반올림 차이 방지)

  return {
    totalCash,
    totalCard,
    totalGross,
    partBreakdown,
    productGross,
    taxableGross,
    exemptGross,
    vat,
    cardFee,
    totalDeductions,
    netRevenue,
    centerShare,
    corpShare,
    rule,
    entryCount: entries.length,
  };
}

// 월별 필터 헬퍼
export function filterByMonth(entries: DailyEntry[], yearMonth: string): DailyEntry[] {
  return entries.filter((e) => e.date.startsWith(yearMonth));
}

// 센터별 필터 헬퍼
export function filterByCenter(entries: DailyEntry[], centerId: string): DailyEntry[] {
  return entries.filter((e) => e.centerId === centerId);
}
