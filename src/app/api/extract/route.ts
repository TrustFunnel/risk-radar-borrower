import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { extractEnabled, MAX_TEXT, readBank, readCrb, readIndustry } from "@/lib/extract";
import { accountsEnabled, supabase } from "@/lib/supabase";

// Reads the text of an uploaded CRB report or bank statement, or names an
// industry. The browser opens the PDF and sends only its text; nothing is
// stored here. With accounts on, only signed-in borrowers can call it.
// A long CRB report can take over a minute to read, so allow Vercel's
// maximum (300s with Fluid compute, the default for new projects).
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!extractEnabled()) return NextResponse.json({ error: "Reading documents isn't switched on yet." }, { status: 503 });
  if (accountsEnabled) {
    const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
    const { data } = token ? await supabase!.auth.getUser(token) : { data: { user: null } };
    if (!data.user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { kind?: string; text?: string; employer?: string; jobTitle?: string };
  try {
    if (body.kind === "industry") {
      if (!body.employer && !body.jobTitle) return NextResponse.json({ error: "Nothing to classify." }, { status: 400 });
      return NextResponse.json({ industry: await readIndustry(String(body.employer ?? "").slice(0, 200), String(body.jobTitle ?? "").slice(0, 200)) });
    }
    const text = String(body.text ?? "");
    if (text.trim().length < 50) return NextResponse.json({ error: "We couldn't find any text in that file. If it's a photo or scan, ask for the PDF version." }, { status: 400 });
    if (text.length > MAX_TEXT) return NextResponse.json({ error: "That file is too long. Upload up to 6 months at a time." }, { status: 413 });
    if (body.kind !== "crb" && body.kind !== "bank") return NextResponse.json({ error: "Unknown document type." }, { status: 400 });
    const started = Date.now();
    const result = body.kind === "crb" ? await readCrb(text) : await readBank(text);
    console.log(`extract: read ${body.kind}, ${text.length} chars in ${Math.round((Date.now() - started) / 1000)}s`);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "We're busy reading other documents. Try again in a minute." }, { status: 429 });
    if (e instanceof Anthropic.APIError) {
      console.error("extract: Claude API error", e.status, e.message);
      return NextResponse.json({ error: "We couldn't read that document right now. Try again later." }, { status: 502 });
    }
    console.error("extract: failed", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}
