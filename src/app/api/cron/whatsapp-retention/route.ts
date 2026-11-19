// Daily: clears WhatsApp message text older than 90 days and deletes people
// who never agreed to us keeping their information (30 days after their last
// message). See wa_purge() in supabase/migrations/0004_whatsapp.sql.
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { data, error } = await serviceClient().rpc("wa_purge");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
