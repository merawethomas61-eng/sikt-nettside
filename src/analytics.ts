// Samtykke-gatet analytics. Gjør INGENTING uten en PostHog-nøkkel
// (`VITE_POSTHOG_KEY`) — da vises heller ingen cookie-banner. Settes nøkkelen i
// Vercel sine env vars, aktiveres banner + sporing (og sporing skjer kun etter
// at brukeren har sagt ja). PostHog lastes lazy (dynamisk import) først ved samtykke.
const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://eu.i.posthog.com';
const CONSENT_KEY = 'sikt-analytics-consent';

export type Consent = 'granted' | 'denied';

export const analyticsConfigured = (): boolean => Boolean(KEY);

export function getConsent(): Consent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(c: Consent): void {
  try {
    localStorage.setItem(CONSENT_KEY, c);
  } catch {
    /* ignore (privat modus e.l.) */
  }
}

let started = false;
export async function startAnalytics(): Promise<void> {
  if (started || !KEY) return;
  started = true;
  const { default: posthog } = await import('posthog-js');
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: true,
    autocapture: true,
    persistence: 'localStorage+cookie',
  });
}
