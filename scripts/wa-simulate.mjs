#!/usr/bin/env node
// End-to-end simulation of the Afueni WhatsApp channel against a running app.
// It plays Meta's part on both sides: it POSTs signed webhooks to the app, and
// runs a mock Graph API that receives what the app sends back. Nothing reaches
// Meta or a real phone. Prints a transcript and exits non-zero on any failure.
//
// 1. Start the app with the simulation settings:
//    WHATSAPP_APP_SECRET=sim-secret WHATSAPP_VERIFY_TOKEN=sim-verify WHATSAPP_TOKEN=sim-token \
//    WHATSAPP_PHONE_NUMBER_ID=PNID123 WHATSAPP_GRAPH_BASE=http://localhost:4010 \
//    COACH_ACCESS_KEY=sim-coach-key-0123456789abcdef WHATSAPP_ALLOW_MEMORY_STORE=1 npm run dev
// 2. node scripts/wa-simulate.mjs [--app http://localhost:3000] [--out transcript.md]
import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import { writeFileSync } from "node:fs";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const APP = arg("--app", "http://localhost:3000");
const OUT = arg("--out", null);
const SECRET = process.env.WHATSAPP_APP_SECRET || "sim-secret";
const VERIFY = process.env.WHATSAPP_VERIFY_TOKEN || "sim-verify";
const COACH = process.env.COACH_ACCESS_KEY || "sim-coach-key-0123456789abcdef";
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "PNID123";
const WA = "254700000123"; // a made-up Kenyan number

// ---------- mock Graph API ----------
const outbox = [];
let seq = 0;
const graph = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const ok = req.headers.authorization === "Bearer " + (process.env.WHATSAPP_TOKEN || "sim-token");
    if (!ok) { res.writeHead(401).end(JSON.stringify({ error: { message: "Invalid OAuth access token", code: 190 } })); return; }
    const json = body ? JSON.parse(body) : {};
    if (json.status === "read") { res.writeHead(200, { "Content-Type": "application/json" }).end('{"success":true}'); return; }
    const id = `wamid.SIM.OUT.${++seq}`;
    outbox.push({ id, path: req.url, json });
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ messaging_product: "whatsapp", contacts: [{ input: json.to, wa_id: json.to }], messages: [{ id }] }));
  });
});
await new Promise((r) => graph.listen(4010, r));

// ---------- helpers ----------
const lines = [];
const log = (s = "") => { lines.push(s); console.log(s); };
let failures = 0;
const check = (cond, what) => { if (!cond) failures++; log(`${cond ? "  ✅" : "  ❌"} ${what}`); };
let n = 0, t = Math.floor(Date.now() / 1000) - 600;

function envelope(value) {
  return { object: "whatsapp_business_account", entry: [{ id: "WABA-SIM", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "254700000000", phone_number_id: PHONE_ID }, ...value } }] }] };
}
function message(m) {
  return envelope({ contacts: [{ profile: { name: "Mercy Wanjiku" }, wa_id: WA }], messages: [{ from: WA, id: `wamid.SIM.IN.${++n}`, timestamp: String(++t), ...m }] });
}
async function post(payload, secret = SECRET) {
  const raw = JSON.stringify(payload);
  const sig = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  return fetch(`${APP}/api/whatsapp/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": sig }, body: raw });
}
function show(j) {
  if (j.type === "text") return j.text.body;
  const i = j.interactive;
  if (i?.type === "button") return `${i.body.text}\n   ${i.action.buttons.map((b) => `[${b.reply.title}]`).join(" ")}`;
  if (i?.type === "list") return `${i.body.text}\n   ≡ ${i.action.button}: ${i.action.sections[0].rows.map((r) => r.title).join(" | ")}`;
  if (j.type === "template") return `(template ${j.template.name}/${j.template.language.code})`;
  return JSON.stringify(j);
}
async function say(label, m) {
  const before = outbox.length;
  const res = await post(message(m));
  log(`\n👤 Borrower: ${label}`);
  if (res.status !== 200) { check(false, `webhook answered HTTP ${res.status}`); return []; }
  const replies = outbox.slice(before);
  for (const r of replies) log(`🤖 Afueni: ${show(r.json).replace(/\n/g, "\n   ")}`);
  return replies;
}
const coach = (path, init = {}) => fetch(`${APP}${path}`, { ...init, headers: { Authorization: `Bearer ${COACH}`, "Content-Type": "application/json" } }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));
const text = (body) => ({ type: "text", text: { body } });
const tap = (id, title) => ({ type: "interactive", interactive: { type: "button_reply", button_reply: { id, title } } });
const pick = (id, title) => ({ type: "interactive", interactive: { type: "list_reply", list_reply: { id, title } } });

try {
  log(`# Afueni WhatsApp simulation, ${new Date().toISOString()}`);
  log(`App: ${APP}. Meta's side is simulated: signed webhooks in, mock Graph API out.\n`);

  log("## Security checks");
  const hs = await fetch(`${APP}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=4242`);
  check(hs.status === 200 && (await hs.text()) === "4242", "Meta's verification handshake returns the challenge");
  const bad = await fetch(`${APP}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=4242`);
  check(bad.status === 403, "a wrong verify token is refused (403)");
  const forged = await post(message(text("hi")), "not-the-secret");
  check(forged.status === 401 && outbox.length === 0, "a webhook with a forged signature is refused (401) and gets no reply");
  check((await coach("/api/coach/cases", { headers: {} }).then(() => fetch(`${APP}/api/coach/cases`))).status === 401, "the coach inbox refuses requests without the key");

  log("\n## Conversation (English)");
  let r = await say("Hi", text("Hi"));
  check(r.length === 1 && r[0].json.to === WA && r[0].path === `/v25.0/${PHONE_ID}/messages`, "welcome sent to the borrower through the Graph API messages endpoint");
  await say("[English]", tap("lang:en", "English"));
  await say("[Yes, I agree]", tap("consent:yes", "Yes, I agree"));
  await say("Mercy", text("Mercy"));
  await say("3", text("3"));
  await say("[Yes]", tap("behind:yes", "Yes"));
  await say("[1 to 3 months]", tap("days:30to90", "1 to 3 months"));
  await say("[My own business]", pick("income:business", "My own business"));
  await say("about 30k", text("about 30k"));
  await say("18,000", text("18,000"));
  r = await say("[Calls or threats]", tap("pressure:threats", "Calls or threats"));
  check(r.some((x) => /coach will message you/.test(show(x.json))), "assessment rated the borrower and promised a coach");

  const dupBefore = outbox.length;
  const retry = message(text("Hello?"));
  await post(retry); await post(retry);
  log(`\n👤 Borrower: Hello? (Meta delivers this webhook twice)`);
  for (const x of outbox.slice(dupBefore)) log(`🤖 Afueni: ${show(x.json)}`);
  check(outbox.length === dupBefore + 1, "a message Meta delivers twice gets exactly one reply");

  log("\n## Delivery status tracking");
  const lastOut = outbox[outbox.length - 1].id;
  for (const s of ["delivered", "read"]) await post(envelope({ statuses: [{ id: lastOut, status: s, timestamp: String(++t), recipient_id: WA, pricing: { billable: true, pricing_model: "PMP", category: "service" } }] }));

  log("\n## Coach inbox");
  const cases = await coach("/api/coach/cases");
  const c = cases.json.cases?.[0];
  check(cases.status === 200 && c?.reason === "assessment" && c?.contact.level === "distressed" && c?.contact.phoneEnd === "123", `case waiting: ${c?.reason}, ${c?.priority} priority, level ${c?.contact.level}, number shown as ···${c?.contact.phoneEnd}`);
  const conv = await coach(`/api/coach/conversations/${c.contact.id}`);
  const outMsg = conv.json.messages?.find((m) => m.direction === "out" && m.status === "read");
  check(!!outMsg, "Meta's 'delivered' then 'read' statuses were recorded against the sent message");
  check(conv.json.contact?.consents?.keep === true, "consent to keep information is recorded");
  const before = outbox.length;
  const rep = await coach(`/api/coach/conversations/${c.contact.id}/reply`, { method: "POST", body: JSON.stringify({ text: "Hi Mercy, I'm Faith, your Afueni coach. Can I call you at 3pm today?" }) });
  check(rep.status === 200 && outbox.length === before + 1, "coach reply sent on WhatsApp");
  log(`🧑‍💼 Coach: ${show(outbox[outbox.length - 1].json)}`);
  const closed = await coach(`/api/coach/cases/${c.id}/close`, { method: "POST", body: JSON.stringify({ contactId: c.contact.id }) });
  check(closed.status === 200, "coach closed the case and handed the chat back to the bot");

  log("\n## Back with the bot: permissions, documents and erasure");
  r = await say("MENU", text("MENU"));
  check(r.some((x) => x.json.interactive?.type === "list"), "menu shown as a WhatsApp list");
  r = await say("YES 5", text("YES 5"));
  r = await say("[My permissions]", pick("menu:permissions", "My permissions"));
  check(r.some((x) => /reminders: \*on\*/.test(show(x.json))), "reminder permission now on");
  r = await say("(sends M-Pesa statement PDF)", { type: "document", document: { id: "MEDIA-SIM-1", filename: "MPESA_Statement.pdf", mime_type: "application/pdf" } });
  check(r.some((x) => /coach will check it/.test(show(x.json))), "document acknowledged and passed to a coach");
  r = await say("I want to end my life", text("I want to end my life"));
  const urgent = await coach("/api/coach/cases");
  check(r.some((x) => /1199/.test(show(x.json))), "safety message with helpline sent");
  check(urgent.json.cases?.[0]?.priority === "urgent" && urgent.json.cases?.[0]?.reason === "safety", "the open case was raised to URGENT (safety) for the coach");
  r = await say("DELETE", text("DELETE"));
  r = await say("[Yes, delete]", tap("delete:yes", "Yes, delete"));
  check(r.some((x) => /erased everything/.test(show(x.json))), "erasure confirmed");
  const after = await coach(`/api/coach/conversations/${c.contact.id}`);
  check(after.status === 404, "the conversation, messages, consents and cases are gone from storage");

  log("\n## Conversation (Kiswahili)");
  const WA2 = WA; // same number starting over after erasure
  await say("Habari", text("Habari"));
  await say("[Kiswahili]", tap("lang:sw", "Kiswahili"));
  await say("ndiyo", text("ndiyo"));
  await say("Juma", text("Juma"));
  await say("mbili", text("mbili"));
  await say("hapana", text("hapana"));
  await say("1", text("1"));
  await say("elfu 50", text("elfu 50"));
  await say("8000", text("8000"));
  r = await say("[Hakuna]", tap("pressure:none", "Hakuna"));
  check(r.some((x) => x.json.interactive?.type === "list" && /Ungependa/.test(x.json.interactive.body.text)), `stable borrower (${WA2.slice(-3)}) gets the Kiswahili menu`);
  r = await say("STOP", text("STOP"));
  r = await say("hello?", text("hello?"));
  check(r.length === 0, "after STOP the bot sends nothing");

  log(`\n## Result: ${failures === 0 ? "all checks passed" : `${failures} check(s) failed`} (${outbox.length} messages sent to the mock Graph API)`);
} catch (e) {
  failures++;
  log(`\n❌ Simulation crashed: ${e.stack || e}`);
} finally {
  graph.close();
  if (OUT) writeFileSync(OUT, lines.join("\n") + "\n");
  process.exit(failures ? 1 : 0);
}
