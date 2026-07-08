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
// Beholder posthog-instansen så `track()` slipper å re-importere modulen for
// hvert event. Null til samtykke er gitt (eller hvis ingen nøkkel er satt).
let ph: typeof import('posthog-js')['default'] | null = null;

// ── A/B-eksperimenter ────────────────────────────────────────────────
// Deterministisk 50/50-bucket per nettleser. Selve bucketen er bare et
// lokalt tall (ingen sporing skjer før samtykke), men den registreres som
// super-property ved oppstart slik at ALLE funnel-events kan segmenteres
// per variant i PostHog. Tving en variant under testing med
// ?exp=<navn>:<A|B> i URL-en (huskes i localStorage til den overstyres).
export const EXPERIMENTS = {
  /** Eksperiment 2: e-postgate ETTER resultat i gratis-analysen */
  freeAuditGate: 'free_audit_gate',
  /** Eksperiment 1: søkeord-steg i onboarding + auto-SERP-sjekk */
  onboardingKeywords: 'onboarding_keywords',
} as const;

const EXP_UID_KEY = 'sikt_exp_uid';

function experimentUid(): string {
  try {
    let uid = localStorage.getItem(EXP_UID_KEY);
    if (!uid) {
      uid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(EXP_UID_KEY, uid);
    }
    return uid;
  } catch {
    // Privat modus uten storage: stabil fallback → alle havner i samme bucket.
    return 'no-storage';
  }
}

// FNV-1a, 32-bit — liten, avhengighetsfri og deterministisk. Mer enn nok
// til en jevn 50/50-splitt; dette er ikke kryptografi.
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function getVariant(experiment: string): 'A' | 'B' {
  try {
    const forced = new URLSearchParams(window.location.search).get('exp');
    if (forced) {
      for (const part of forced.split(',')) {
        const [name, v] = part.split(':');
        if (name === experiment && (v === 'A' || v === 'B')) {
          localStorage.setItem(`sikt_exp_force_${experiment}`, v);
        }
      }
    }
    const stored = localStorage.getItem(`sikt_exp_force_${experiment}`);
    if (stored === 'A' || stored === 'B') return stored;
  } catch {
    /* ignore */
  }
  return hash32(`${experimentUid()}:${experiment}`) % 2 === 0 ? 'A' : 'B';
}

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
  // Variant-tilhørighet på alle events — trakten kan da splittes per
  // eksperiment uten at hvert track()-kall trenger å vite om dem.
  try {
    posthog.register({
      exp_free_audit_gate: getVariant(EXPERIMENTS.freeAuditGate),
      exp_onboarding_keywords: getVariant(EXPERIMENTS.onboardingKeywords),
    });
  } catch {
    /* aldri la sporing brekke oppstart */
  }
  ph = posthog;
}

// Eksplisitt funnel-sporing. Ren no-op uten samtykke/nøkkel (ph er da null), så
// den kan kalles trygt fra hvor som helst uten å vente på consent eller sjekke
// selv. Brukes for CTA-klikk, gratis analyse, plan-valg og checkout.
export function track(event: string, props?: Record<string, unknown>): void {
  if (!ph) return;
  try {
    ph.capture(event, props);
  } catch {
    /* aldri la sporing brekke en brukerhandling */
  }
}

// Som track(), men fyrer maks én gang per nettleser (localStorage-markør).
// Brukes for aktiverings-milepæler («første gang X skjedde») som aha_reached
// og first_rank_check. Markøren settes KUN når eventet faktisk kan sendes
// (samtykke gitt), så et tidlig kall uten samtykke ikke brenner milepælen.
// `onceKey` lar kalleren skille per bruker (f.eks. `aha_reached_<userId>`).
export function trackOnce(event: string, props?: Record<string, unknown>, onceKey?: string): void {
  if (!ph) return;
  try {
    const k = `sikt_once_${onceKey || event}`;
    if (localStorage.getItem(k)) return;
    localStorage.setItem(k, '1');
  } catch {
    /* uten storage: fall tilbake til vanlig track */
  }
  track(event, props);
}

// Knytter den anonyme økten til en innlogget bruker, så trakten kan følges
// anonym → kunde (og betalt konvertering tilskrives riktig person). No-op uten
// samtykke/nøkkel. Kalles ved innlogging/auth.
export function identify(distinctId: string, props?: Record<string, unknown>): void {
  if (!ph || !distinctId) return;
  try {
    ph.identify(distinctId, props);
  } catch {
    /* aldri la sporing brekke en brukerhandling */
  }
}
