// Server only. Reads CRB reports and bank statements (as text read from the
// PDF on the borrower's phone) into structured data with Claude, and guesses
// an industry when the keyword rules in industry.ts don't recognise the work.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { INDUSTRIES } from "./industry";

export const extractEnabled = () => !!process.env.ANTHROPIC_API_KEY;

// A six-month bank statement is typically 20k-80k characters; refuse anything
// far beyond a real statement instead of cutting it short.
export const MAX_TEXT = 400_000;

const CrbSchema = z.object({
  bureau: z.enum(["Metropol", "TransUnion", "Creditinfo", "Other"]),
  reportDate: z.string().nullable().describe("YYYY-MM-DD"),
  score: z.number().nullable(),
  scoreBand: z.string().nullable(),
  accounts: z.array(z.object({
    lender: z.string(),
    accountType: z.string(),
    openedOn: z.string().nullable().describe("YYYY-MM-DD"),
    principal: z.number().nullable(),
    balance: z.number().describe("Current balance in KES, 0 if closed"),
    arrearsDays: z.number().describe("Days past due, 0 if up to date"),
    status: z.enum(["performing", "non_performing", "written_off", "closed", "settled"]),
    negative: z.boolean().describe("True if the bureau lists this account as a negative / default entry"),
  })),
});

const BankSchema = z.object({
  bank: z.string().nullable(),
  months: z.array(z.object({
    month: z.string().describe("YYYY-MM"),
    inflow: z.number().describe("Money received in KES, excluding loan disbursements, reversals and transfers from the account holder's own accounts"),
    outflow: z.number().describe("Money spent in KES, excluding loan repayments"),
  })),
});

const IndustrySchema = z.object({ industry: z.enum(INDUSTRIES) });

export type CrbExtract = z.infer<typeof CrbSchema>;
export type BankExtract = z.infer<typeof BankSchema>;

const PROMPTS = {
  crb: `This is the text of a Kenyan Credit Reference Bureau report (Metropol, TransUnion or Creditinfo) that the borrower uploaded about themselves. List every credit account in it, including mobile loans, closed and settled accounts. Amounts are KES. Use null for anything the report doesn't show.`,
  bank: `This is the text of a Kenyan bank statement the account holder uploaded. Total the money in and money out for each calendar month. Leave out of income: loan disbursements, reversals, and transfers from the holder's own accounts (including M-Pesa to own account). Leave out of spending: loan repayments.`,
};

function client() {
  return new Anthropic();
}

async function parse<T>(schema: z.ZodType<T>, system: string, text: string): Promise<T> {
  const response = await client().beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content: `<document>\n${text}\n</document>` }],
  });
  if (response.stop_reason === "refusal") throw new Error("The document couldn't be read.");
  if (response.stop_reason === "max_tokens" || !response.parsed_output) throw new Error("The document was too long to read in one go.");
  return response.parsed_output as T;
}

export const readCrb = (text: string) => parse(CrbSchema, PROMPTS.crb, text);
export const readBank = (text: string) => parse(BankSchema, PROMPTS.bank, text);

export async function readIndustry(employer: string, jobTitle: string) {
  const r = await parse(IndustrySchema, "Pick the industry this Kenyan borrower works in. If unsure, choose Other.", `Employer or business: ${employer}\nJob title: ${jobTitle}`);
  return r.industry;
}
