// 브라우저에서 /api/ocr 호출하는 헬퍼

import type { OcrResult } from "./types";

export type OcrHint = "chart" | "receipt" | "pos" | "menu";

export async function ocrFromFile(
  file: File,
  hint?: OcrHint
): Promise<OcrResult> {
  const imageBase64 = await fileToBase64(file);
  const imageMediaType = normalizeMediaType(file.type);

  const resp = await fetch("/api/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64, imageMediaType, hint }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OCR 호출 실패: ${resp.status} ${err}`);
  }
  return (await resp.json()) as OcrResult;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => {
      const result = r.result as string; // data:image/jpeg;base64,...
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    r.readAsDataURL(file);
  });
}

function normalizeMediaType(
  type: string
): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  if (type === "image/jpg") return "image/jpeg";
  if (
    type === "image/jpeg" ||
    type === "image/png" ||
    type === "image/webp" ||
    type === "image/gif"
  )
    return type;
  return "image/jpeg"; // 기본
}
