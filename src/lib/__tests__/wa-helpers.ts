// Builders for WhatsApp Cloud API webhook payloads, shaped like Meta's.
export const PHONE_ID = "PNID123";
let n = 0;
const ts = () => String(1_763_000_000 + ++n);

function wrap(value: Record<string, unknown>) {
  return { object: "whatsapp_business_account", entry: [{ id: "WABA1", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "254700000000", phone_number_id: PHONE_ID }, ...value } }] }] };
}

export function textMsg(from: string, body: string, id = `wamid.in.${++n}`, name = "Mercy Wanjiku") {
  return wrap({ contacts: [{ profile: { name }, wa_id: from }], messages: [{ from, id, timestamp: ts(), type: "text", text: { body } }] });
}
export function buttonMsg(from: string, replyId: string, title = replyId, id = `wamid.in.${++n}`) {
  return wrap({ contacts: [{ profile: { name: "Mercy" }, wa_id: from }], messages: [{ from, id, timestamp: ts(), type: "interactive", interactive: { type: "button_reply", button_reply: { id: replyId, title } } }] });
}
export function listMsg(from: string, rowId: string, title = rowId, id = `wamid.in.${++n}`) {
  return wrap({ contacts: [{ profile: { name: "Mercy" }, wa_id: from }], messages: [{ from, id, timestamp: ts(), type: "interactive", interactive: { type: "list_reply", list_reply: { id: rowId, title } } }] });
}
export function docMsg(from: string, id = `wamid.in.${++n}`) {
  return wrap({ contacts: [{ profile: { name: "Mercy" }, wa_id: from }], messages: [{ from, id, timestamp: ts(), type: "document", document: { id: "MEDIA1", filename: "MPESA_Statement.pdf", mime_type: "application/pdf" } }] });
}
export function statusMsg(wamid: string, status: string, error?: { code: number; title: string }) {
  return wrap({ statuses: [{ id: wamid, status, timestamp: ts(), recipient_id: "254712345678", ...(error ? { errors: [{ code: error.code, title: error.title }] } : {}), pricing: { billable: true, pricing_model: "PMP", category: "service" } }] });
}
