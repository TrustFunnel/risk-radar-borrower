// The Afueni WhatsApp conversation: onboarding, consent, identification,
// distress assessment, guidance and hand-off to a person. Pure function, no
// I/O, so every path is unit-tested; see service.ts for storage and sending.
import { assess, parseAmount, parseCount } from "./assess";
import { copy, say } from "./copy";
import {
  CONSENT_PURPOSES, type CasePriority, type CaseReason, type ConsentPurpose, type ConvState, type DaysBehind,
  type Effect, type EngineContext, type EngineResult, type Inbound, type IncomeType, type Lang, type Pressure,
  type Reply, type Step,
} from "./types";

const MAX_RETRIES = 2;

// Words that point to a risk of self-harm. Any match goes straight to a
// person, ahead of everything else.
const SAFETY = /\b(suicide|kill myself|end my life|want to die|better off dead|kujiua|kujitoa uhai|nataka kufa|nijiue)\b/i;

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const isWord = (text: string, ...words: string[]) => words.includes(norm(text));

export function step(prev: ConvState, msg: Inbound, ctx: EngineContext): EngineResult {
  const s: ConvState = { ...prev, answers: { ...prev.answers }, consents: { ...prev.consents } };
  const out: Reply[] = [];
  const fx: Effect[] = [];
  const L = () => s.lang;
  const text = (msg.text ?? "").trim();
  const id = msg.choiceId ?? "";
  const n = norm(text);

  const send = (body: string) => out.push({ type: "text", body });
  const go = (next: Step) => { s.step = next; s.retries = 0; };
  const openCase = (reason: CaseReason, priority: CasePriority, note: string) => {
    // An urgent case is always raised: the service escalates any case already open.
    if (!ctx.openCase || priority !== "normal") fx.push({ type: "case", reason, priority, note });
    ctx = { ...ctx, openCase: true };
  };
  const toPerson = (reason: CaseReason, priority: CasePriority, note: string, prefix = "") => {
    const already = ctx.openCase;
    openCase(reason, priority, note);
    send(prefix + say(already ? copy.caseAlreadyOpen : copy.caseOpened, L()));
    s.resumeStep = s.step === "human" ? s.resumeStep : s.step;
    go("human");
  };
  const done = (): EngineResult => ({ state: s, replies: out, effects: fx });

  // ---- 1. Opted out: say nothing until START. ----
  if (s.step === "opted_out") {
    if (isWord(text, "start", "anza", "unstop")) {
      send(say(copy.optedIn, L()));
      go(s.consents.keep ? "menu" : "new");
      if ((s.step as Step) === "menu") menu(); else welcome();
    }
    return done();
  }

  // ---- 2. Safety first, at any step. ----
  if (msg.kind === "text" && SAFETY.test(text)) {
    openCase("safety", "urgent", "Message suggests a risk of self-harm. Contact today.");
    send(say(copy.safety, L()));
    if (s.step !== "human") { s.resumeStep = s.step; go("human"); }
    return done();
  }

  // ---- 3. Keywords that work at any step. ----
  if (msg.kind === "text") {
    if (isWord(text, "stop", "unsubscribe", "stop all", "acha", "acha yote")) {
      send(say(copy.optedOut, L()));
      go("opted_out");
      return done();
    }
    const yesNo = n.match(/^(yes|ndio|ndiyo|stop|acha)\s*([1-5])$/);
    if (yesNo) return consentCommand(/^(yes|ndio|ndiyo)$/.test(yesNo[1]), Number(yesNo[2]));
    if (isWord(text, "privacy", "faragha")) { send(say(copy.privacy, L())); return done(); }
    if (isWord(text, "delete", "delete my data", "futa", "futa data yangu", "erase")) return askDelete();
    if (isWord(text, "person", "agent", "human", "coach", "mtu", "kocha", "talk to a person", "ongea na mtu")) {
      toPerson("asked_for_person", "normal", "Borrower asked for a person.");
      return done();
    }
    if (isWord(text, "lang", "language", "lugha", "english", "kiswahili", "swahili")) {
      s.lang = isWord(text, "english") ? "en" : isWord(text, "kiswahili", "swahili") ? "sw" : s.lang === "en" ? "sw" : "en";
      send(say(copy.langSwitched, L()));
      return done();
    }
    if (isWord(text, "menu", "hi", "hello", "hey", "habari", "mambo", "sasa", "niaje", "start", "anza", "afueni") && !["new", "lang"].includes(s.step)) {
      if (s.step === "human") { send(say(copy.caseAlreadyOpen, L())); return done(); }
      if (!s.consents.keep) { askConsent(); return done(); }
      menu();
      return done();
    }
  }
  if (id === "person") { toPerson("asked_for_person", "normal", "Borrower asked for a person."); return done(); }

  // ---- 4. Documents, photos and voice notes. ----
  if (s.step === "new" && msg.kind !== "text") { welcome(); return done(); }
  if (msg.kind === "media") {
    if (!s.consents.keep) { send(say(copy.mediaNoConsent, L())); return done(); }
    const voice = msg.mediaType === "audio";
    openCase(voice ? "voice_note" : "document", "normal", voice ? "Voice note to listen to." : `${msg.mediaType ?? "File"} received; check it.`);
    send(say(voice ? copy.voiceReceived : copy.mediaReceived, L()));
    return done();
  }
  if (msg.kind === "unsupported") { send(say(copy.unsupported, L())); return done(); }

  // ---- 5. The step we're on. ----
  switch (s.step) {
    case "new":
      welcome();
      return done();

    case "lang": {
      const lang: Lang | null = id === "lang:en" || /^(1|en|eng|english)$/.test(n) ? "en" : id === "lang:sw" || /^(2|sw|kiswahili|swahili)$/.test(n) ? "sw" : null;
      if (!lang) return retry(() => welcome(), "hintButtons");
      s.lang = lang;
      askConsent();
      return done();
    }

    case "consent":
    case "declined": {
      const yes = id === "consent:yes" || /^(yes|y|ndio|ndiyo|sawa|ok|okay|nakubali|i agree|agree)$/.test(n);
      const no = id === "consent:no" || /^(no|n|hapana|la)$/.test(n);
      if (yes) { grant("keep"); return afterConsent(); }
      if (no) { send(say(copy.declined, L())); go("declined"); return done(); }
      if (s.step === "declined") { askConsent(); return done(); }
      return retry(() => askConsent(), "hintButtons");
    }

    case "name": {
      const name = text.replace(/[^\p{L}\s'.-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 40);
      if (name.length < 2 || msg.kind !== "text") return retry(() => send(say(copy.askName, L())), "hintButtons");
      s.name = name;
      // One message, not two: since October 2026 Meta charges per service message.
      send(`${say(copy.qIntro(name), L())}\n\n${say(copy.qLoans, L())}`);
      go("q_loans");
      return done();
    }

    case "q_loans": {
      const c = parseCount(text);
      if (c === null) return retry(() => ask("q_loans", false), "hintNumber");
      s.answers.loans = c;
      if (c === 0) {
        s.answers = { loans: 0, behind: false };
        return finishAssessment();
      }
      return ask("q_behind");
    }

    case "q_behind": {
      const yes = id === "behind:yes" || /^(yes|y|ndio|ndiyo)$/.test(n);
      const no = id === "behind:no" || /^(no|n|hapana|la)$/.test(n);
      if (!yes && !no) return retry(() => ask("q_behind", false), "hintButtons");
      s.answers.behind = yes;
      if (!yes) delete s.answers.daysBehind;
      return ask(yes ? "q_days" : "q_income_type");
    }

    case "q_days": {
      const map: Record<string, DaysBehind> = { "days:under30": "under30", "days:30to90": "30to90", "days:over90": "over90", "1": "under30", "2": "30to90", "3": "over90" };
      const v = map[id] ?? map[n];
      if (!v) return retry(() => ask("q_days", false), "hintButtons");
      s.answers.daysBehind = v;
      return ask("q_income_type");
    }

    case "q_income_type": {
      const map: Record<string, IncomeType> = { "income:salary": "salary", "income:business": "business", "income:casual": "casual", "income:none": "none", "1": "salary", "2": "business", "3": "casual", "4": "none" };
      const v = map[id] ?? map[n];
      if (!v) return retry(() => ask("q_income_type", false), "hintButtons");
      s.answers.incomeType = v;
      if (v === "none") { s.answers.income = 0; return ask("q_repay"); }
      return ask("q_income");
    }

    case "q_income": {
      const a = parseAmount(text);
      if (a === null) return retry(() => ask("q_income", false), "hintAmount");
      s.answers.income = a;
      return ask("q_repay");
    }

    case "q_repay": {
      const a = parseAmount(text);
      if (a === null) return retry(() => ask("q_repay", false), "hintAmount");
      s.answers.repayments = a;
      return ask("q_pressure");
    }

    case "q_pressure": {
      const map: Record<string, Pressure> = { "pressure:threats": "threats", "pressure:court": "court", "pressure:none": "none", "1": "threats", "2": "court", "3": "none" };
      const v = map[id] ?? map[n] ?? (/^(no|none|neither|hakuna|hapana)$/.test(n) ? "none" : undefined);
      if (!v) return retry(() => ask("q_pressure", false), "hintButtons");
      s.answers.pressure = v;
      return finishAssessment();
    }

    case "human":
      // A coach has the conversation; the bot stays quiet so the two don't talk over each other.
      return done();

    case "confirm_delete": {
      if (id === "delete:yes" || /^(yes|ndio|ndiyo|delete|futa)$/.test(n)) {
        fx.push({ type: "erase" });
        send(say(copy.deleted, L()));
        return done();
      }
      send(say(copy.deleteCancelled, L()));
      go(s.resumeStep && s.resumeStep !== "confirm_delete" ? s.resumeStep : s.consents.keep ? "menu" : "new");
      if ((s.step as Step) === "menu") menu();
      return done();
    }

    case "menu":
    default:
      return menuChoice();
  }

  // ---------- helpers (hoisted) ----------

  function welcome() {
    out.push({ type: "buttons", body: copy.welcome(ctx.profileName), buttons: [{ id: "lang:en", title: "English" }, { id: "lang:sw", title: "Kiswahili" }] });
    go("lang");
  }

  function askConsent() {
    const b = copy.consentButtons;
    out.push({ type: "buttons", body: say(copy.consentAsk, L()), buttons: [{ id: "consent:yes", title: say(b.yes, L()) }, { id: "consent:no", title: say(b.no, L()) }, { id: "person", title: say(b.person, L()) }] });
    go("consent");
  }

  function grant(p: ConsentPurpose) {
    s.consents[p] = true;
    fx.push({ type: "consent", purpose: p, granted: true });
  }

  function afterConsent(): EngineResult {
    if (ctx.linkedAccount) {
      s.name = ctx.linkedAccount.displayName;
      send(say(copy.welcomeBack(s.name, ctx.linkedAccount.loanCount), L()));
      return ask("q_loans");
    }
    send(say(copy.askName, L()));
    go("name");
    return done();
  }

  function ask(next: Step, move = true): EngineResult {
    if (move) go(next);
    const l = L();
    switch (next) {
      case "q_loans": send(say(copy.qLoans, l)); break;
      case "q_behind": out.push({ type: "buttons", body: say(copy.qBehind, l), buttons: [{ id: "behind:yes", title: say(copy.yesNo.yes, l) }, { id: "behind:no", title: say(copy.yesNo.no, l) }] }); break;
      case "q_days": out.push({ type: "buttons", body: say(copy.qDays, l), buttons: (["under30", "30to90", "over90"] as const).map((k) => ({ id: `days:${k}`, title: say(copy.days[k], l) })) }); break;
      case "q_income_type": out.push({ type: "list", body: say(copy.qIncomeType, l), button: say(copy.incomeTypeButton, l), rows: (["salary", "business", "casual", "none"] as const).map((k) => ({ id: `income:${k}`, title: say(copy.incomeTypes[k], l) })) }); break;
      case "q_income": send(say(copy.qIncome, l)); break;
      case "q_repay": send(say(copy.qRepay, l)); break;
      case "q_pressure": out.push({ type: "buttons", body: say(copy.qPressure, l), buttons: (["threats", "court", "none"] as const).map((k) => ({ id: `pressure:${k}`, title: say(copy.pressure[k], l) })) }); break;
    }
    return done();
  }

  function retry(reask: () => void, hint: "hintNumber" | "hintAmount" | "hintButtons"): EngineResult {
    s.retries += 1;
    if (s.retries > MAX_RETRIES) {
      toPerson("stuck", "normal", `Borrower got stuck at step ${s.step}.`, say(copy.stuck, L()));
      return done();
    }
    send(`${say(copy.notUnderstood, L())} ${say(copy[hint], L())}`);
    reask();
    return done();
  }

  function finishAssessment(): EngineResult {
    const result = assess(s.answers);
    s.level = result.level;
    fx.push({ type: "assessment", answers: { ...s.answers }, result });
    const l = L();
    let body = say(copy.result[result.level], l);
    if (s.answers.pressure === "threats") body += `\n\n${say(copy.threatsNote, l)}`;
    if (s.answers.pressure === "court") body += `\n\n${say(copy.courtNote, l)}`;
    if (result.level === "distressed" || result.level === "crisis") {
      const priority: CasePriority = result.level === "crisis" ? "high" : "normal";
      const already = ctx.openCase;
      openCase("assessment", priority, `Assessment: ${result.level} (${result.reasons.join(", ") || "no flags"}).`);
      body += `\n\n${say(already ? copy.caseAlreadyOpen : copy.caseOpened, l)}`;
      send(body);
      s.resumeStep = "menu";
      go("human");
      return done();
    }
    send(body);
    menu();
    return done();
  }

  function menu() {
    const l = L();
    const keys = ["assess", "statement", "app", "person", "permissions", "delete"] as const;
    out.push({ type: "list", body: say(copy.menuBody, l), button: say(copy.menuButton, l), rows: keys.map((k) => ({ id: `menu:${k}`, title: say(copy.menu[k], l), description: say(copy.menuDesc[k], l) })) });
    go("menu");
  }

  function menuChoice(): EngineResult {
    const byNumber = ["assess", "statement", "app", "person", "permissions", "delete"];
    const key = id.startsWith("menu:") ? id.slice(5) : /^[1-6]$/.test(n) ? byNumber[Number(n) - 1] : "";
    switch (key) {
      case "assess":
        s.answers = {};
        return ask("q_loans");
      case "statement":
        send(say(copy.statement, L()));
        return done();
      case "app":
        send(say(copy.appLink(ctx.appUrl), L()));
        return done();
      case "person":
        toPerson("asked_for_person", "normal", "Borrower asked for a person.");
        return done();
      case "permissions":
        permissions();
        return done();
      case "delete":
        return askDelete();
      default:
        if (!s.consents.keep) { askConsent(); return done(); }
        s.retries += 1;
        if (s.retries > MAX_RETRIES) { toPerson("stuck", "normal", "Borrower wrote something the menu couldn't handle.", say(copy.stuck, L())); return done(); }
        menu();
        s.retries = prev.retries + 1;
        return done();
    }
  }

  function permissions() {
    const l = L();
    const lines = CONSENT_PURPOSES.map((p, i) => `${i + 1}. ${say(copy.permissionNames[p], l)}: *${say(s.consents[p] ? copy.on : copy.off, l)}*`);
    send(`${say(copy.permissionsHeader, l)}\n\n${lines.join("\n")}`);
  }

  function consentCommand(granted: boolean, num: number): EngineResult {
    const p = CONSENT_PURPOSES[num - 1];
    const l = L();
    const what = say(copy.permissionNames[p], l);
    if (granted && p !== "keep" && !s.consents.keep) { send(say(copy.needKeepFirst, l)); return done(); }
    s.consents[p] = granted;
    fx.push({ type: "consent", purpose: p, granted });
    if (!granted) {
      send(say(p === "keep" ? copy.keepWithdrawn : copy.withdrawn(what), l));
      if (p === "keep") go("declined");
      return done();
    }
    let body = say(copy.granted(what), l);
    // CRB requests and speaking to lenders need a person (identity check, letter of authority).
    if (p === "crb" || p === "lenders") {
      openCase("consent_followup", "normal", p === "crb" ? "Borrower allowed a CRB report request (YES 3)." : "Borrower allowed us to speak to lenders (YES 4): send letter of authority.");
      body += `\n\n${say(copy.needsCoach, l)}`;
    }
    send(body);
    if (p === "keep" && (s.step === "consent" || s.step === "declined")) return afterConsent();
    return done();
  }

  function askDelete(): EngineResult {
    const l = L();
    out.push({ type: "buttons", body: say(copy.deleteConfirm, l), buttons: [{ id: "delete:yes", title: say(copy.deleteButtons.yes, l) }, { id: "delete:no", title: say(copy.deleteButtons.no, l) }] });
    if (s.step !== "confirm_delete") s.resumeStep = s.step;
    s.step = "confirm_delete";
    s.retries = 0;
    return done();
  }
}
