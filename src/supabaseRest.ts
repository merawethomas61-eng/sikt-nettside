// Hjelpebibliotek for å snakke direkte med Supabase REST API via rå fetch.
//
// Hvorfor: supabase-js sin klient-tilstand kan fryse (auth-lock-deadlock)
// hvis det finnes rusk/ugyldige tokens i localStorage fra før nøkkel-rotasjon.
// Rå fetch omgår hele klient-maskineriet, tar tokenet direkte fra localStorage,
// og gir oss alltid et svar (eller en klar feilmelding) innen timeout.
//
// Bruk der du ellers ville brukt `supabase.from(...).select/insert/update/upsert/delete(...)`.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export function getStoredAccessToken(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const keys = Object.keys(localStorage);
    const tokenKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (!tokenKey) return null;
    const raw = localStorage.getItem(tokenKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token ?? parsed?.currentSession?.access_token ?? null;
  } catch {
    return null;
  }
}

type RestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Krever innlogget bruker — kaster feil hvis token mangler */
  requireAuth?: boolean;
};

/**
 * Rå fetch mot Supabase PostgREST.
 *
 * @example
 *   // SELECT
 *   const rows = await supabaseRest('clients?user_id=eq.' + uid + '&select=*');
 *
 *   // UPSERT
 *   await supabaseRest('clients?on_conflict=user_id', {
 *     method: 'POST',
 *     body: { user_id: uid, ... },
 *     headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
 *   });
 *
 *   // UPDATE
 *   await supabaseRest('clients?user_id=eq.' + uid, {
 *     method: 'PATCH',
 *     body: { package_name: 'Premium' },
 *     headers: { Prefer: 'return=representation' },
 *   });
 */
export async function supabaseRest<T = any>(
  path: string,
  options: RestOptions = {},
): Promise<T> {
  const { method = 'GET', body, headers = {}, timeoutMs = 15000, requireAuth = true } = options;

  const token = getStoredAccessToken();
  if (requireAuth && !token) {
    throw new Error('Ingen gyldig sesjon i localStorage. Logg inn på nytt.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let parsed: any = null;
    if (text) {
      try { parsed = JSON.parse(text); } catch { parsed = text; }
    }

    if (!response.ok) {
      const msg = (parsed && typeof parsed === 'object' && (parsed.message || parsed.error || parsed.hint))
        || (typeof parsed === 'string' ? parsed : null)
        || `HTTP ${response.status}`;
      throw new Error(String(msg));
    }

    return parsed as T;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Supabase svarte ikke innen ${Math.round(timeoutMs / 1000)}s (${method} ${path})`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
