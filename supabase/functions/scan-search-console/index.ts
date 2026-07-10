// supabase/functions/scan-search-console/index.ts
//
// POST { site_id } med Authorization: Bearer <bruker-token>.
// Verifiserer at brukeren eier nettsiden, laster + dekrypterer GSC-tokenet
// (fornyer ved utloep), henter soekeanalyse fra Google Search Console de siste
// 28 dagene, og skriver radene til keywords-tabellen. Returnerer { success }.
//
// Bruker eksisterende secrets: ENCRYPTION_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
// (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY injiseres automatisk.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ENCRYPTION_KEY = Deno.env.get("ENCRYPTION_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function getKey(): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ENCRYPTION_KEY));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)),
  );
  const combined = new Uint8Array(iv.length + ct.length);
  combined.set(iv, 0);
  combined.set(ct, iv.length);
  return btoa(String.fromCharCode(...combined));
}
async function decrypt(b64: string): Promise<string> {
  const key = await getKey();
  const combined = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ct = combined.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  const t = await res.json();
  if (!res.ok || !t.access_token) throw new Error("token_refresh_failed");
  return t as { access_token: string; expires_in?: number };
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function normHost(u: string): string {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return (u || "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  try {
    // 1) Verifiser bruker fra JWT — ELLER service-gren for cron-en:
    //    Authorization: Bearer <SERVICE_ROLE_KEY> + { site_id, user_id } i body.
    //    (runOpportunities i api/cron-scan-competitors.js henter fersk GSC-data
    //    ukentlig slik at motoren ikke er avhengig av at kunden trykker
    //    «Hent søkeord» i portalen.)
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const body = await req.json().catch(() => ({} as { site_id?: string; user_id?: string }));
    const site_id = body.site_id;
    if (!site_id) return json({ success: false, error: "missing_site_id" }, 400);

    let userId: string | null = null;
    if (token === SERVICE_ROLE && typeof body.user_id === "string" && body.user_id) {
      userId = body.user_id;
    } else {
      const authClient = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userErr } = await authClient.auth.getUser(token);
      if (userErr || !user) return json({ success: false, error: "unauthorized" }, 401);
      userId = user.id;
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 2) Bekreft at nettsiden tilhoerer brukeren
    const { data: site, error: siteErr } = await admin
      .from("sites")
      .select("id, user_id, domain, homepage_url")
      .eq("id", site_id)
      .maybeSingle();
    if (siteErr || !site || site.user_id !== userId) {
      return json({ success: false, error: "forbidden" }, 403);
    }

    // 3) Last + dekrypter GSC-token
    const { data: cred } = await admin
      .from("api_credentials")
      .select("credentials, expires_at")
      .eq("user_id", userId)
      .eq("service_name", "google_search_console")
      .maybeSingle();
    if (!cred?.credentials?.enc) return json({ success: false, error: "not_connected" }, 400);

    const stored = JSON.parse(await decrypt(cred.credentials.enc)) as {
      access_token: string;
      refresh_token: string | null;
    };
    let accessToken = stored.access_token;

    // 4) Forny token hvis utloept (med 60 s margin)
    const expired = cred.expires_at ? new Date(cred.expires_at).getTime() < Date.now() + 60000 : true;
    if (expired) {
      if (!stored.refresh_token) return json({ success: false, error: "reauth_required" }, 400);
      const refreshed = await refreshAccessToken(stored.refresh_token);
      accessToken = refreshed.access_token;
      const newPayload = { ...stored, access_token: accessToken };
      const newExpiry = new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString();
      const enc = await encrypt(JSON.stringify(newPayload));
      await admin
        .from("api_credentials")
        .update({ credentials: { enc }, expires_at: newExpiry, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("service_name", "google_search_console");
    }

    // 5) Finn brukerens verifiserte GSC-eiendom som matcher nettsiden
    const propsRes = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const propsData = await propsRes.json();
    if (!propsRes.ok) {
      console.error("GSC sites.list feilet:", propsData);
      return json({ success: false, error: "gsc_sites_failed" }, 400);
    }
    const entries: Array<{ siteUrl: string }> = propsData.siteEntry ?? [];
    const targetHost = normHost(site.homepage_url || site.domain);
    const property =
      entries.find(
        (e) =>
          e.siteUrl?.startsWith("sc-domain:") &&
          e.siteUrl.slice("sc-domain:".length).replace(/^www\./, "") === targetHost,
      ) ?? entries.find((e) => normHost(e.siteUrl) === targetHost);
    if (!property) return json({ success: false, error: "no_matching_property" }, 400);
    const siteUrl = property.siteUrl;

    // 6) Hent soekeanalyse siste 28 dager
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 28);
    const saRes = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: fmtDate(start),
          endDate: fmtDate(end),
          dimensions: ["query"],
          rowLimit: 100,
        }),
      },
    );
    const saData = await saRes.json();
    if (!saRes.ok) {
      console.error("GSC searchAnalytics feilet:", saData);
      return json({ success: false, error: "gsc_query_failed" }, 400);
    }
    const rows: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }> =
      saData.rows ?? [];

    // 7) Erstatt GSC-soekeordene for denne nettsiden (keywords-tabellen er GSC-dedikert)
    await admin.from("keywords").delete().eq("site_id", site_id);
    if (rows.length > 0) {
      const now = new Date().toISOString();
      const toInsert = rows
        .map((r) => ({
          site_id,
          keyword: r.keys?.[0] ?? "",
          clicks: Math.round(r.clicks ?? 0),
          impressions: Math.round(r.impressions ?? 0),
          ctr: r.ctr ?? null, // GSC gir andel 0..1
          position: r.position != null ? Math.round(r.position) : null,
          checked_at: now,
        }))
        .filter((r) => r.keyword);
      if (toInsert.length) {
        const { error: insErr } = await admin.from("keywords").insert(toInsert);
        if (insErr) {
          console.error("Innsetting av keywords feilet:", insErr);
          return json({ success: false, error: "db_insert_failed" }, 500);
        }
      }
    }

    // 8) Marker nettsiden som tilkoblet
    await admin
      .from("sites")
      .update({ google_search_console_connected: true, last_scanned_at: new Date().toISOString() })
      .eq("id", site_id);

    return json({ success: true, count: rows.length });
  } catch (e) {
    console.error("scan-search-console-feil:", e);
    return json({ success: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
