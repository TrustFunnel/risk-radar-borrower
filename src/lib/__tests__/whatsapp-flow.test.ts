import { describe, expect, it } from "vitest";
import { assess, parseAmount, parseCount } from "../whatsapp/assess";
import { copy } from "../whatsapp/copy";
import { step } from "../whatsapp/flow";
import { initialState, type ConvState, type EngineContext, type Inbound, type Reply } from "../whatsapp/types";

const ctx: EngineContext = { appUrl: "https://app.example", openCase: false, profileName: "Mercy" };
const txt = (text: string): Inbound => ({ kind: "text", text });
const tap = (choiceId: string): Inbound => ({ kind: "choice", choiceId, text: choiceId });
const bodyOf = (r: Reply) => r.body;

// Runs a conversation and returns the final state with everything said.
function run(inputs: Inbound[], c: EngineContext = ctx, start: ConvState = initialState()) {
  let state = start;
  const replies: Reply[] = [];
  const effects: ReturnType<typeof step>["effects"] = [];
  let openCase = c.openCase;
  for (const i of inputs) {
    const r = step(state, i, { ...c, openCase });
    state = r.state;
    replies.push(...r.replies);
    effects.push(...r.effects);
    if (r.effects.some((e) => e.type === "case")) openCase = true;
  }
  return { state, replies, effects, last: replies[replies.length - 1] };
}

describe("distress assessment", () => {
  it("rates a manageable situation as stable", () => {
    expect(assess({ loans: 2, behind: false, income: 60000, repayments: 12000, pressure: "none" }).level).toBe("stable");
  });
  it("rates a heavy load as stretched or worse", () => {
    expect(assess({ loans: 2, behind: false, income: 40000, repayments: 14000 }).level).toBe("stretched");
    expect(assess({ loans: 3, behind: false, income: 40000, repayments: 22000 }).level).toBe("distressed");
  });
  it("rates court action and long arrears as crisis", () => {
    expect(assess({ loans: 1, behind: true, daysBehind: "under30", income: 50000, repayments: 5000, pressure: "court" }).level).toBe("crisis");
    expect(assess({ loans: 3, behind: true, daysBehind: "over90", income: 30000, repayments: 20000 }).level).toBe("crisis");
    expect(assess({ loans: 2, behind: true, daysBehind: "30to90", incomeType: "none", income: 0, repayments: 8000 }).level).toBe("crisis");
  });
  it("flags threats as distressed and explains why", () => {
    const r = assess({ loans: 2, behind: false, income: 50000, repayments: 5000, pressure: "threats" });
    expect(r.level).toBe("distressed");
    expect(r.reasons).toContain("threats");
    expect(r.dsr).toBe(0.1);
  });
  it.each([["25000", 25000], ["25,000", 25000], ["25k", 25000], ["KES 2.5k", 2500], ["Ksh 40,500", 40500], ["elfu 30", 30000], ["about 18000 bob", 18000], ["none", null]])("reads amount %s", (s, n) => expect(parseAmount(s)).toBe(n));
  it.each([["3", 3], ["tatu", 3], ["two", 2], ["hakuna", 0], ["I have 4 loans", 4], ["many", null], ["99", null]])("reads count %s", (s, n) => expect(parseCount(s)).toBe(n));
});

describe("WhatsApp conversation", () => {
  it("onboards, assesses and hands a distressed borrower to a coach (English)", () => {
    const r = run([
      txt("Hi"), tap("lang:en"), tap("consent:yes"), txt("Mercy"), txt("3"), tap("behind:yes"), tap("days:30to90"),
      tap("income:business"), txt("30k"), txt("18,000"), tap("pressure:threats"),
    ]);
    expect(r.replies[0]).toMatchObject({ type: "buttons" });
    expect(bodyOf(r.replies[0])).toContain("Afueni by Risk Radar");
    expect(r.state.step).toBe("human");
    expect(r.state.level).toBe("distressed");
    expect(r.state.answers).toEqual({ loans: 3, behind: true, daysBehind: "30to90", incomeType: "business", income: 30000, repayments: 18000, pressure: "threats" });
    expect(r.effects).toContainEqual({ type: "consent", purpose: "keep", granted: true });
    expect(r.effects.find((e) => e.type === "case")).toMatchObject({ reason: "assessment", priority: "normal" });
    expect(bodyOf(r.last)).toContain("Know your rights");
    expect(bodyOf(r.last)).toContain("within 2 hours");
  });

  it("works in Kiswahili and shows the menu to a stable borrower", () => {
    const r = run([txt("Habari"), tap("lang:sw"), txt("ndiyo"), txt("Juma"), txt("mbili"), txt("hapana"), txt("1"), txt("elfu 50"), txt("8000"), txt("3")]);
    expect(r.state.lang).toBe("sw");
    expect(r.state.level).toBe("stable");
    expect(r.state.step).toBe("menu");
    expect(r.last).toMatchObject({ type: "list" });
    expect(bodyOf(r.last)).toBe(copy.menuBody.sw);
    expect(r.effects.some((e) => e.type === "case")).toBe(false);
  });

  it("greets a borrower who already has an app account by name and skips the name question", () => {
    const r = run([txt("hi"), tap("lang:en"), tap("consent:yes")], { ...ctx, linkedAccount: { displayName: "Wanjiru", loanCount: 2 } });
    expect(r.state.name).toBe("Wanjiru");
    expect(r.state.step).toBe("q_loans");
    expect(r.replies.map(bodyOf).join("\n")).toContain("Welcome back, Wanjiru");
  });

  it("stores nothing more when consent is declined, and can be given later", () => {
    const declined = run([txt("hi"), tap("lang:en"), tap("consent:no")]);
    expect(declined.state.step).toBe("declined");
    expect(declined.effects).toEqual([]);
    const later = run([txt("YES 1")], ctx, declined.state);
    expect(later.effects).toContainEqual({ type: "consent", purpose: "keep", granted: true });
    expect(later.state.step).toBe("name");
  });

  it("goes to a coach as a priority for court cases", () => {
    const r = run([txt("hi"), tap("lang:en"), tap("consent:yes"), txt("Ali"), txt("1"), tap("behind:yes"), tap("days:over90"), tap("income:salary"), txt("40000"), txt("15000"), tap("pressure:court")]);
    expect(r.state.level).toBe("crisis");
    expect(r.effects.find((e) => e.type === "case")).toMatchObject({ priority: "high" });
    expect(bodyOf(r.last)).toContain("Kituo Cha Sheria");
  });

  it("someone with no loans gets tips and the menu", () => {
    const r = run([txt("hi"), tap("lang:en"), tap("consent:yes"), txt("Ann"), txt("0")]);
    expect(r.state.level).toBe("stable");
    expect(r.state.step).toBe("menu");
  });

  it("handles YES n and STOP n for each permission, and needs keep first", () => {
    const none = run([txt("hi"), tap("lang:en"), txt("YES 5")]);
    expect(bodyOf(none.last)).toBe(copy.needKeepFirst.en);
    const base = run([txt("hi"), tap("lang:en"), tap("consent:yes"), txt("Mercy"), txt("0")]);
    const r = run([txt("yes 4"), txt("YES 5"), txt("STOP 5"), tap("menu:permissions")], ctx, base.state);
    expect(r.effects.filter((e) => e.type === "consent")).toEqual([
      { type: "consent", purpose: "lenders", granted: true },
      { type: "consent", purpose: "reminders", granted: true },
      { type: "consent", purpose: "reminders", granted: false },
    ]);
    expect(r.effects.find((e) => e.type === "case")).toMatchObject({ reason: "consent_followup" });
    expect(bodyOf(r.last)).toMatch(/5\. Send me payment reminders: \*off\*/);
    expect(bodyOf(r.last)).toMatch(/4\. Speak to my lenders for me: \*on\*/);
  });

  it("withdrawing permission 1 stops the conversation keeping data", () => {
    const base = run([txt("hi"), tap("lang:en"), tap("consent:yes"), txt("Mercy"), txt("0")]);
    const r = run([txt("STOP 1")], ctx, base.state);
    expect(r.state.consents.keep).toBe(false);
    expect(r.state.step).toBe("declined");
    expect(bodyOf(r.last)).toBe(copy.keepWithdrawn.en);
  });

  it("STOP silences the bot until START", () => {
    const r = run([txt("hi"), tap("lang:en"), txt("STOP"), txt("hello?"), txt("menu")]);
    expect(r.state.step).toBe("opted_out");
    expect(bodyOf(r.last)).toBe(copy.optedOut.en);
    const back = run([txt("START")], ctx, r.state);
    expect(back.replies.length).toBeGreaterThan(0);
  });

  it("DELETE asks to confirm, then erases", () => {
    const base = run([txt("hi"), tap("lang:en"), tap("consent:yes"), txt("Mercy"), txt("0")]);
    const cancel = run([txt("delete"), tap("delete:no")], ctx, base.state);
    expect(cancel.effects).toEqual([]);
    expect(cancel.state.step).toBe("menu");
    const yes = run([txt("FUTA"), tap("delete:yes")], ctx, base.state);
    expect(yes.effects).toEqual([{ type: "erase" }]);
  });

  it("puts safety first at any step", () => {
    const r = run([txt("hi"), tap("lang:en"), tap("consent:yes"), txt("I want to die, I can't pay")]);
    expect(r.effects.find((e) => e.type === "case")).toMatchObject({ reason: "safety", priority: "urgent" });
    expect(bodyOf(r.last)).toContain("1199");
    expect(r.state.step).toBe("human");
  });

  it("hands over to a person after repeated answers it can't read", () => {
    const base = run([txt("hi"), tap("lang:en"), tap("consent:yes"), txt("Mercy")]);
    const r = run([txt("lots"), txt("many many"), txt("too many to count")], ctx, base.state);
    expect(r.state.step).toBe("human");
    expect(r.effects.find((e) => e.type === "case")).toMatchObject({ reason: "stuck" });
  });

  it("stays quiet while a coach has the chat, apart from STOP/DELETE", () => {
    const base = run([txt("hi"), tap("lang:en"), tap("consent:yes"), txt("PERSON")]);
    expect(base.state.step).toBe("human");
    const quiet = run([txt("ok thanks, waiting")], { ...ctx, openCase: true }, base.state);
    expect(quiet.replies).toEqual([]);
  });

  it("asks for consent before accepting documents", () => {
    const r = run([txt("hi"), tap("lang:en"), { kind: "media", mediaType: "document" }]);
    expect(bodyOf(r.last)).toBe(copy.mediaNoConsent.en);
    const ok = run([{ kind: "media", mediaType: "document" }], ctx, run([txt("hi"), tap("lang:en"), tap("consent:yes"), txt("Mercy"), txt("0")]).state);
    expect(ok.effects.find((e) => e.type === "case")).toMatchObject({ reason: "document" });
  });

  it("keeps every button and list title within WhatsApp's limits", () => {
    const seen: Reply[] = [];
    for (const lang of ["lang:en", "lang:sw"]) {
      seen.push(...run([txt("hi"), tap(lang), tap("consent:yes"), txt("Mercy"), txt("2"), tap("behind:yes"), tap("days:under30"), tap("income:salary"), txt("40000"), txt("10000"), tap("pressure:none"), txt("delete")]).replies);
    }
    for (const r of seen) {
      if (r.type === "buttons") { expect(r.buttons.length).toBeLessThanOrEqual(3); for (const b of r.buttons) expect(b.title.length, b.title).toBeLessThanOrEqual(20); }
      if (r.type === "list") { expect(r.button.length).toBeLessThanOrEqual(20); for (const x of r.rows) { expect(x.title.length, x.title).toBeLessThanOrEqual(24); expect((x.description ?? "").length).toBeLessThanOrEqual(72); } }
      expect(r.body.length).toBeLessThanOrEqual(1024);
    }
  });
});
