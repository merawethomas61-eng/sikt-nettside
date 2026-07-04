// supabase/functions/google-oauth-callback/index.ts
//
// Mottar Googles OAuth-redirect (?code=...&state=<user_id>), bytter koden mot
// tokens, krypterer dem og lagrer i api_credentials, og sender brukeren tilbake
// til appen med ?gsc=connected (eller ?gsc_error=1).
//
// Bruker eksisterende secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
//                   ENCRYPTION_KEY, FRONTEND_URL
// (SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY injiseres automatisk av Supabase.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const ENCRYPTION_KEY = Deno.env.get("ENCRYPTION_KEY")!;
let APP_URL = (Deno.env.get("FRONTEND_URL") ?? "https://siktseo.com").trim().replace(/\/+$/, "");
if (!/^https?:\/\//i.test(APP_URL)) APP_URL = "https://" + APP_URL;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-oauth-callback`;

// AES-256-GCM via Web Crypto. Noekkel utledes med SHA-256 saa enhver streng funker.
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

function redirect(to: string): Response {
  return new Response(null, { status: 302, headers: { Location: to } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // = user_id (satt av frontend)
  const oauthError = url.searchParams.get("error");

  if (oauthError || !code || !state) {
    return redirect(`${APP_URL}/?gsc_error=1`);
  }

  try {
    // 1) Bytt koden mot tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.access_token) {
      console.error("Token-bytte feilet:", tokens);
      return redirect(`${APP_URL}/?gsc_error=1`);
    }

    const payload = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      scope: tokens.scope ?? null,
      token_type: tokens.token_type ?? "Bearer",
    };
    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();
    const encrypted = await encrypt(JSON.stringify(payload));

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 2) Erstatt ev. eksisterende GSC-credential for brukeren
    //    (ingen unik constraint paa user_id+service_name, derfor slett + sett inn).
    await supabase
      .from("api_credentials")
      .delete()
      .eq("user_id", state)
      .eq("service_name", "google_search_console");

    const { error: insErr } = await supabase.from("api_credentials").insert({
      user_id: state,
      service_name: "google_search_console",
      credentials: { enc: encrypted },
      expires_at: expiresAt,
    });
    if (insErr) {
      console.error("Lagring av credentials feilet:", insErr);
      return redirect(`${APP_URL}/?gsc_error=1`);
    }

    return redirect(`${APP_URL}/?gsc=connected`);
  } catch (e) {
    console.error("Callback-feil:", e);
    return redirect(`${APP_URL}/?gsc_error=1`);
  }
});
