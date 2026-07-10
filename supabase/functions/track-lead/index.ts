// supabase/functions/track-lead/index.ts
//
// Offentlig beacon-endepunkt for henvendelses-sporing («leads»):
// connector-pluginens front-end-script (v1.3) / copy-paste-snippetet sender
// POST {t: lead_token, k: 'tel'|'mailto'|'form', p: pathname} når en
// besøkende klikker telefon/e-post eller sender et skjema på KUNDENS side.
//
// Prinsipper:
//  - ALDRI PII: kun event-type + sti. Ingen cookies, ingen fingerprinting.
//  - Ingen info-lekkasje: svarer alltid 204, også ved ukjent token/feil.
//  - Misbruksvern: maks LEADS_DAILY_CAP rader per kunde per døgn.
//  - verify_jwt = false (offentlig) — token-oppslaget ER autorisasjonen;
//    lead_token er en ugjettbar uuid per kunde (clients.lead_token).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const LEADS_DAILY_CAP = 300;
const ALLOWED_KINDS = new Set(["tel", "mailto", "form"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function noContent(): Response {
  return new Response(null, { status: 204, headers: cors });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return noContent();

  try {
    // sendBeacon sender ofte text/plain — parse rått.
    const raw = await req.text();
    let body: { t?: string; k?: string; p?: string } = {};
    try { body = JSON.parse(raw); } catch { return noContent(); }

    const token = typeof body.t === "string" ? body.t.trim() : "";
    const kind = typeof body.k === "string" ? body.k.trim() : "";
    let path = typeof body.p === "string" ? body.p.trim() : "";
    if (!UUID_RE.test(token) || !ALLOWED_KINDS.has(kind)) return noContent();
    // Kun sti — strip query/hash (skulle snippetet sende mer) og kutt lengden.
    path = path.split("?")[0].split("#")[0].slice(0, 300);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: client } = await admin
      .from("clients")
      .select("user_id")
      .eq("lead_token", token)
      .maybeSingle();
    if (!client?.user_id) return noContent(); // ukjent token → stille 204

    // Døgn-tak per kunde (mot script-løkker/misbruk).
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const { count } = await admin
      .from("sikt_leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", client.user_id)
      .gte("occurred_at", dayStart.toISOString());
    if ((count ?? 0) >= LEADS_DAILY_CAP) return noContent();

    const { error: insErr } = await admin.from("sikt_leads").insert({
      user_id: client.user_id,
      kind,
      page_path: path || null,
    });
    if (insErr) console.error("track-lead insert feilet:", insErr.message);

    return noContent();
  } catch (e) {
    console.error("track-lead-feil:", e);
    return noContent();
  }
});
