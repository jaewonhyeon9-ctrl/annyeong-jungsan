import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  ChartOcrData,
  OcrClassification,
  OcrResult,
  PosOcrData,
  ReceiptOcrData,
} from "@/lib/ocr/types";

const VALID_CLASSIFICATIONS: OcrClassification[] = [
  "chart",
  "receipt",
  "pos",
  "unknown",
];

// POST /api/ocr
// Body: { imageBase64: string, imageMediaType: "image/jpeg" | "image/png" | "image/webp",
//         hint?: "chart" | "receipt" | "pos" }
// 응답: OcrResult

export const runtime = "nodejs";
export const maxDuration = 30;

const OCR_SYSTEM_PROMPT = `당신은 한국 의료/뷰티센터 정산앱의 OCR 추출 엔진입니다.
이미지에서 정산에 필요한 데이터만 정확히 추출해 JSON 으로 응답하세요.

## 허용 분류

- "chart": 환자 관리 차트 (KMPA 양식 등). 방문경로 + 의료 체크리스트
- "receipt": 카드 매출전표 / 영수증
- "pos": POS 일일 마감표 / 매출 정리표
- "unknown": 분류 불가

## 의료법 — 안전 모드 (필수)

- 환자명/연락처/주소/생년월일 등 **개인 식별 정보는 절대 추출하지 마세요**. 출력에 포함 X.
- 의료 체크리스트(질환/약물/임신여부)는 차트 본문에 명시된 경우에만 추출.

## 방문경로 정규화

체크된 항목을 다음 ID 로 매핑:

- 인스타그램 → instagram
- 블로그 → blog
- 스마트 플레이스 / 네이버 플레이스 → naver_place
- 인터넷 검색 → internet
- 옥외 홍보물 → outdoor
- 전화 문의 → phone
- 내원 환자 → visitor
- 입원 환자 → inpatient
- 지인 소개 → referral
- 기타 → other

## 파트 추정 (PartId)

영수증/POS의 시술명을 보고 다음 중 하나 추정:
scalp(두피) | permanent_makeup(반영구) | smp | pedicure(패디큐어) | skincare(피부관리)
모르면 null.

## 출력 형식 — JSON ONLY, 다른 텍스트 금지

\`\`\`json
{
  "classification": "chart" | "receipt" | "pos" | "unknown",
  "confidence": 0~1,
  "data": { ...분류별 필드... } | null,
  "warnings": ["저화질" | "흐림" | "일부 누락" 등]
}
\`\`\`

### chart 데이터 필드
{ inflowChannels: [...], conditions: [...], duration, careExperience: [...],
  stress, pain, allergy: { has, types }, products: [...], occupation,
  lifestyle: { hiking, golf, soccer, alcohol, smoking, other },
  sleepHours, medications: [...], pregnancy, memo, consent }

### receipt 데이터 필드
{ date: "YYYY-MM-DD" | null, totalAmount: int, paymentMethod: "cash" | "card",
  merchant, approval }

### pos 데이터 필드
{ date: "YYYY-MM-DD" | null,
  items: [{ serviceName, partGuess, cash, card }],
  totals: { cash, card } }

확실하지 않은 필드는 null. 미확인 체크박스는 절대 true로 단정 X.`;

interface OcrRequestBody {
  imageBase64: string;
  imageMediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  hint?: "chart" | "receipt" | "pos";
}

export async function POST(req: Request) {
  let body: OcrRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.imageBase64 || !body.imageMediaType) {
    return NextResponse.json(
      { error: "missing_fields", required: ["imageBase64", "imageMediaType"] },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // ─────────────────────────────────────────────
  // Mock 모드 — API 키 없을 때 데모용 응답
  // ─────────────────────────────────────────────
  if (!apiKey) {
    await new Promise((r) => setTimeout(r, 1200)); // OCR 체감 시간
    const mock: OcrResult = {
      classification: body.hint ?? "chart",
      confidence: 0.96,
      data: mockData(body.hint ?? "chart"),
      warnings: [
        "ANTHROPIC_API_KEY가 설정되지 않아 mock 데이터를 반환합니다 (.env.local 참조)",
      ],
      mock: true,
    };
    return NextResponse.json(mock);
  }

  // ─────────────────────────────────────────────
  // 실제 Claude Vision 호출
  // ─────────────────────────────────────────────
  const client = new Anthropic({ apiKey });

  const userInstruction = body.hint
    ? `이 이미지는 "${body.hint}"로 추정됩니다. 위 형식에 맞춰 JSON 출력.`
    : "이 이미지를 분류하고 위 형식에 맞춰 JSON 출력.";

  try {
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: OCR_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: body.imageMediaType,
                data: body.imageBase64,
              },
            },
            { type: "text", text: userInstruction },
          ],
        },
      ],
    });

    const textBlock = resp.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "no_text_response" },
        { status: 502 }
      );
    }

    const parsed = extractJson(textBlock.text);
    if (!parsed) {
      return NextResponse.json(
        { error: "json_parse_failed", raw: textBlock.text.slice(0, 500) },
        { status: 502 }
      );
    }

    const cls = VALID_CLASSIFICATIONS.includes(
      parsed.classification as OcrClassification
    )
      ? (parsed.classification as OcrClassification)
      : "unknown";

    const result: OcrResult = {
      classification: cls,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      data: (parsed.data ?? null) as
        | ChartOcrData
        | ReceiptOcrData
        | PosOcrData
        | null,
      warnings: Array.isArray(parsed.warnings)
        ? (parsed.warnings as string[])
        : [],
      mock: false,
      modelUsed: resp.model,
    };
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "anthropic_call_failed", message },
      { status: 502 }
    );
  }
}

// ─────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────

function extractJson(text: string): {
  classification?: string;
  confidence?: number;
  data?: unknown;
  warnings?: unknown;
} | null {
  // ```json ... ``` 또는 raw JSON 둘 다 처리
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1] : text;
  try {
    return JSON.parse(candidate.trim());
  } catch {
    // 마지막 brace 까지 trim 시도
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function mockData(hint: "chart" | "receipt" | "pos"): OcrResult["data"] {
  if (hint === "chart") {
    return {
      inflowChannels: ["instagram", "referral"],
      conditions: ["toenail_fungus", "callus"],
      duration: "gt1y",
      careExperience: ["hospital", "nailshop"],
      stress: "mid",
      pain: "mid",
      allergy: { has: false },
      products: ["antifungal"],
      occupation: null,
      lifestyle: { hiking: false, golf: true, soccer: false, alcohol: 1, smoking: 0 },
      sleepHours: 7,
      medications: [],
      pregnancy: "no",
      memo: "Mock 추출 — 키 설정 시 실제 OCR 결과",
      consent: true,
    };
  }
  if (hint === "receipt") {
    return {
      date: "2026-05-14",
      totalAmount: 70000,
      paymentMethod: "card",
      merchant: "안녕메디컬",
      approval: "12345678",
    };
  }
  return {
    date: "2026-05-14",
    items: [
      { serviceName: "스케일링", partGuess: "scalp", cash: 0, card: 70000 },
      { serviceName: "케어", partGuess: "pedicure", cash: 60000, card: 0 },
    ],
    totals: { cash: 60000, card: 70000 },
  };
}
