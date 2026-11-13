// Shared types for the Afueni WhatsApp channel (WhatsApp Business Platform,
// Cloud API). The conversation engine is pure: it takes a contact's state and
// one inbound message and returns the new state, the replies to send and the
// side effects to record. Storage and the Meta API sit around it.

export type Lang = "en" | "sw";

// Separate permissions, numbered as in the pilot consent form (YES n / STOP n).
export const CONSENT_PURPOSES = ["keep", "ai_read", "crb", "lenders", "reminders"] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];
export const CONSENT_VERSION = "WA-2026-11";

export type Step =
  | "new"
  | "lang"
  | "consent"
  | "declined"
  | "name"
  | "q_loans"
  | "q_behind"
  | "q_days"
  | "q_income_type"
  | "q_income"
  | "q_repay"
  | "q_pressure"
  | "menu"
  | "human"
  | "confirm_delete"
  | "opted_out";

export type IncomeType = "salary" | "business" | "casual" | "none";
export type DaysBehind = "under30" | "30to90" | "over90";
export type Pressure = "threats" | "court" | "none";

export interface Answers {
  loans?: number;
  behind?: boolean;
  daysBehind?: DaysBehind;
  incomeType?: IncomeType;
  income?: number; // KES a month
  repayments?: number; // KES a month, all loans
  pressure?: Pressure;
}

export type DistressLevel = "stable" | "stretched" | "distressed" | "crisis";

export interface Assessment {
  level: DistressLevel;
  dsr: number | null; // repayments / income, null when income is 0 or unknown
  reasons: string[]; // machine codes, e.g. "dsr_over_70", "court"
}

export interface ConvState {
  step: Step;
  lang: Lang;
  name?: string;
  answers: Answers;
  consents: Partial<Record<ConsentPurpose, boolean>>;
  level?: DistressLevel;
  retries: number; // unrecognised answers in a row at the current step
  resumeStep?: Step; // where to go back to after "human" or "confirm_delete"
}

export const initialState = (): ConvState => ({ step: "new", lang: "en", answers: {}, consents: {}, retries: 0 });

// What arrived, reduced to what the engine needs.
export type InboundKind = "text" | "choice" | "media" | "unsupported";
export interface Inbound {
  kind: InboundKind;
  text?: string; // typed text, or the title of the tapped button
  choiceId?: string; // id of the tapped button or list row
  mediaType?: "image" | "document" | "audio" | "video" | "sticker";
}

export interface Button { id: string; title: string } // title max 20 chars
export interface ListRow { id: string; title: string; description?: string } // title max 24, description max 72

export type Reply =
  | { type: "text"; body: string }
  | { type: "buttons"; body: string; buttons: Button[] } // 1 to 3 buttons
  | { type: "list"; body: string; button: string; rows: ListRow[] }; // 1 to 10 rows

export type CaseReason = "asked_for_person" | "assessment" | "document" | "voice_note" | "consent_followup" | "safety" | "stuck";
export type CasePriority = "normal" | "high" | "urgent";

export type Effect =
  | { type: "consent"; purpose: ConsentPurpose; granted: boolean }
  | { type: "case"; reason: CaseReason; priority: CasePriority; note: string }
  | { type: "assessment"; answers: Answers; result: Assessment }
  | { type: "erase" };

export interface EngineContext {
  profileName?: string; // WhatsApp profile name, as a fallback greeting only
  linkedAccount?: { displayName: string; loanCount: number } | null;
  appUrl: string; // public app address, for links in messages
  openCase: boolean; // a case is already waiting for a person
}

export interface EngineResult {
  state: ConvState;
  replies: Reply[];
  effects: Effect[];
}
