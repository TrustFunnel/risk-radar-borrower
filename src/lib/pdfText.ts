"use client";

// Reads the text of a PDF on the borrower's phone, so password-protected
// statements (M-Pesa, most banks) are opened without the file or its password
// ever leaving the device. Returns the text one visual line at a time.

export class PdfPasswordError extends Error {
  constructor(public wrong: boolean) {
    super(wrong ? "That password didn't open the file." : "This file needs a password.");
  }
}

export interface TextItem { str: string; x: number; y: number }

// pdf.js gives scattered text pieces; rebuild lines by grouping pieces on the
// same baseline (within 2pt), left to right.
export function groupLines(items: TextItem[]): string[] {
  const rows: { y: number; parts: TextItem[] }[] = [];
  for (const it of items) {
    if (!it.str.trim()) continue;
    const row = rows.find((r) => Math.abs(r.y - it.y) <= 2);
    if (row) row.parts.push(it);
    else rows.push({ y: it.y, parts: [it] });
  }
  return rows
    .sort((a, b) => b.y - a.y) // PDF y grows upwards
    .map((r) => r.parts.sort((a, b) => a.x - b.x).map((p) => p.str.trim()).join(" ").replace(/\s+/g, " "));
}

export async function pdfLines(file: File, password?: string): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), password: password || undefined });
  let doc;
  try {
    doc = await task.promise;
  } catch (e) {
    const err = e as { name?: string; code?: number };
    if (err.name === "PasswordException") throw new PdfPasswordError(err.code === 2);
    throw e;
  }
  const lines: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const items = content.items.flatMap((i) => ("str" in i ? [{ str: i.str, x: i.transform[4], y: i.transform[5] }] : []));
    lines.push(...groupLines(items));
  }
  await task.destroy();
  return lines;
}
