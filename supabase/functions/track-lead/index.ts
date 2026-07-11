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
//  - Misbruksvern: maks LEADS_DAILY_CAP rader per kunde per døgn + bot-vakt
//    (≥ BOT_GUARD_MAX like events siste time → droppes stille).
//  - verify_jwt = false (offentlig) — token-oppslaget ER autorisasjonen;
//    lead_token er en ugjettbar uuid per kunde (clients.lead_token).
//
// Runde 5 — instant varsel: ved kind='form' (høy intensjon) sendes en kort
// e-post til kunden med en gang («Noen sendte inn skjemaet på siden din»),
// gated på notification_preferences.leadAlerts (opt-out, default PÅ),
// stille timer (kun 07–21 Oslo-tid) og dagstak (ALERTS_DAILY_CAP per døgn).
// Varslede rader stemples notified=true; alt annet (tel/mailto + skjema
// utenfor vindu/tak) plukkes opp av den daglige digesten i weekly-reports.
// E-postfeil må ALDRI knekke beacon-svaret — alltid 204.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderEmail, defList, note, escapeHtml } from "../_shared/email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "rapport@siktseo.com";

const PORTAL_URL = "https://siktseo.com/portal";

const LEADS_DAILY_CAP = 300;
const ALERTS_DAILY_CAP = 5;    // maks instant-e-poster per kunde per døgn
const BOT_GUARD_MAX = 20;      // like (kind+path)-events siste time → bot, dropp
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

/** Oslo-lokal time (0–23) + dato (YYYY-MM-DD), DST-trygt. */
function osloNow(): { hour: number; date: string } {
  const now = new Date();
  const hourStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo", hour: "2-digit", hour12: false,
  }).format(now);
  let hour = parseInt(hourStr, 10);
  if (hour === 24) hour = 0; // noen runtimes rendrer midnatt som 24
  // en-CA gir ISO-format YYYY-MM-DD
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo" }).format(now);
  return { hour, date };
}

type ClientRow = {
  user_id: string;
  email: string | null;
  contact_person: string | null;
  notification_preferences: { leadAlerts?: boolean } | null;
  lead_alert_day: string | null;
  lead_alert_count: number | null;
};

function buildFormAlertHtml(path: string, timeLabel: string): string {
  const where = path ? `Siden ${escapeHtml(path)}` : "Nettsiden din";
  return renderEmail({
    brand: "sikt",
    kicker: "Henvendelse",
    preheader: "Noen sendte inn skjemaet på nettsiden din.",
    heading: "Noen sendte inn skjemaet på siden din.",
    blocks: [
      defList([{ title: "Skjema sendt", body: `${where} · kl ${timeLabel}` }]),
      note(
        "Sikt sporer uten cookies og uten persondata — vi vet ikke hvem det var, bare at det skjedde. " +
        "Selve meldingen finner du i skjema-mottaket eller innboksen din.",
      ),
    ],
    cta: { label: "Se henvendelsene i portalen", url: PORTAL_URL },
    footer:
      "Du får dette varselet fordi henvendelses-varsling er på. " +
      "Du kan slå det av under Innstillinger → Varsler i portalen.",
  });
}

/**
 * Instant skjema-varsel. Kalles ETTER vellykket insert; all feil svelges —
 * beacon-svaret (204) skal aldri påvirkes av varslingslogikken.
 */
async function maybeSendFormAlert(
  admin: ReturnType<typeof createClient>,
  client: ClientRow,
  leadId: string | number,
  path: string,
): Promise<void> {
  try {
    if (!RESEND_API_KEY || !client.email) return;
    if (client.notification_preferences?.leadAlerts === false) return; // opt-out

    const oslo = osloNow();
    if (oslo.hour < 7 || oslo.hour >= 21) return; // stille timer → digesten tar den

    const sameDay = client.lead_alert_day === oslo.date;
    const sentToday = sameDay ? (client.lead_alert_count ?? 0) : 0;
    if (sentToday >= ALERTS_DAILY_CAP) return; // dagstak → digesten tar den

    const timeLabel = new Intl.DateTimeFormat("nb-NO", {
      timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit",
    }).format(new Date());

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Sikt <${FROM_EMAIL}>`,
        to: [client.email],
        subject: "Noen sendte inn skjemaet på nettsiden din",
        html: buildFormAlertHtml(path, timeLabel),
      }),
    });
    if (!res.ok) {
      console.error("track-lead varsel-sending feilet:", await res.text());
      return; // notified forblir false → digesten tar den
    }

    // Stemple raden som varslet + tell opp dagens varsler.
    await admin.from("sikt_leads").update({ notified: true }).eq("id", leadId);
    await admin.from("clients").update({
      lead_alert_day: oslo.date,
      lead_alert_count: sentToday + 1,
    }).eq("user_id", client.user_id);
  } catch (e) {
    console.error("track-lead varsel-feil:", e);
  }
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
      .select("user_id, email, contact_person, notification_preferences, lead_alert_day, lead_alert_count")
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

    // Bot-vakt: samme event (kind+path) i løkke siste time → dropp stille,
    // så verken tallene i portalen eller digesten forurenses.
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    let botQuery = admin
      .from("sikt_leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", client.user_id)
      .eq("kind", kind)
      .gte("occurred_at", hourAgo);
    // NB: eq(null) matcher aldri i PostgREST — tom sti må sammenlignes med is().
    botQuery = path ? botQuery.eq("page_path", path) : botQuery.is("page_path", null);
    const { count: sameCount } = await botQuery;
    if ((sameCount ?? 0) >= BOT_GUARD_MAX) return noContent();

    const { data: inserted, error: insErr } = await admin
      .from("sikt_leads")
      .insert({
        user_id: client.user_id,
        kind,
        page_path: path || null,
      })
      .select("id")
      .single();
    if (insErr) {
      console.error("track-lead insert feilet:", insErr.message);
      return noContent();
    }

    // Instant varsel kun for skjema (høy intensjon). Feil svelges.
    if (kind === "form" && inserted?.id != null) {
      await maybeSendFormAlert(admin, client as ClientRow, inserted.id, path);
    }

    return noContent();
  } catch (e) {
    console.error("track-lead-feil:", e);
    return noContent();
  }
});
