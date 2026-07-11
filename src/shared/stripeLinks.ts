// =====================================================================
// Stripe Payment Links — leses fra miljøvariabler
// =====================================================================
// ALDRI hardkod live-lenker i koden. Sett disse i Vercel (Production):
//   VITE_STRIPE_BASIC_LINK
//   VITE_STRIPE_STANDARD_LINK
//   VITE_STRIPE_PREMIUM_LINK
// Årlig betaling (12 for 10 — valgfritt; toggle på prissiden vises kun når
// ALLE tre er satt):
//   VITE_STRIPE_BASIC_YEARLY_LINK
//   VITE_STRIPE_STANDARD_YEARLY_LINK
//   VITE_STRIPE_PREMIUM_YEARLY_LINK
// I dev kan du legge test-lenkene (https://buy.stripe.com/test_…) i .env.local.
//
// Hvis en lenke mangler returnerer helperne `undefined` — kallstedet viser da
// en feilmelding i stedet for å sende kunden til en død/test-lenke. Det er med
// vilje: bedre å feile høyt enn å ta imot «liksom»-betaling.
//
// Plan-strengen kan bære intervallet som suffiks («STANDARD_YEARLY») — den
// flyter uendret gjennom ?plan=-parameteren, localStorage-gjenopptak og
// checkout-flyten, så kun denne fila trenger å forstå den.
// =====================================================================

type PlanKey = 'BASIC' | 'STANDARD' | 'PREMIUM';

const LINKS: Record<PlanKey, string | undefined> = {
  BASIC: import.meta.env.VITE_STRIPE_BASIC_LINK as string | undefined,
  STANDARD: import.meta.env.VITE_STRIPE_STANDARD_LINK as string | undefined,
  PREMIUM: import.meta.env.VITE_STRIPE_PREMIUM_LINK as string | undefined,
};

const YEARLY_LINKS: Record<PlanKey, string | undefined> = {
  BASIC: import.meta.env.VITE_STRIPE_BASIC_YEARLY_LINK as string | undefined,
  STANDARD: import.meta.env.VITE_STRIPE_STANDARD_YEARLY_LINK as string | undefined,
  PREMIUM: import.meta.env.VITE_STRIPE_PREMIUM_YEARLY_LINK as string | undefined,
};

/** Er årlig betaling konfigurert for alle tre planene? (styrer toggle-visning) */
export function hasYearlyLinks(): boolean {
  return !!(YEARLY_LINKS.BASIC && YEARLY_LINKS.STANDARD && YEARLY_LINKS.PREMIUM);
}

/** Finner riktig Stripe-betalingslenke ut fra et plannavn ("BASIC", "STANDARD_YEARLY", "Standard Pakke", …). */
export function getStripeLink(plan: string): string | undefined {
  const key = (plan || '').toUpperCase();
  const table = key.includes('YEARLY') ? YEARLY_LINKS : LINKS;
  if (key.includes('PREMIUM')) return table.PREMIUM;
  if (key.includes('STANDARD')) return table.STANDARD;
  if (key.includes('BASIC')) return table.BASIC;
  return undefined;
}

/**
 * Bygger full checkout-URL med prefilled_email + client_reference_id.
 * VIKTIG: client_reference_id må med — Stripe-webhooken kobler betalingen til
 * riktig bruker via denne. Uten den står kunden fast etter betaling.
 */
export function buildStripeCheckoutUrl(
  plan: string,
  opts: { email?: string; userId?: string } = {},
): string | undefined {
  const base = getStripeLink(plan);
  if (!base) return undefined;
  const params = new URLSearchParams();
  if (opts.email) params.set('prefilled_email', opts.email);
  if (opts.userId) params.set('client_reference_id', opts.userId);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
