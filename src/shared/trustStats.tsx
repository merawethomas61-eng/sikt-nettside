import React, { useEffect, useState } from 'react';
import { supabaseRest } from '../supabaseRest';

// Ærlig sosialt bevis ved null kunder: antall gratis-analyser kjørt («X sider
// analysert med Sikt»), hentet live fra audit_leads via en trygg RPC som KUN
// returnerer antallet (se migrations/2026-06-29_public_audit_stats.sql).
//
// Gating: vi viser tallet KUN når det er stort nok (AUDIT_COUNT_THRESHOLD), og
// runder NED — så vi aldri overdriver eller viser et pinlig lavt tall rett
// etter lansering. Under terskel / ved feil → komponenten rendrer ingenting.

export const AUDIT_COUNT_THRESHOLD = 200;

// Modul-nivå cache: én fetch deles av alle instanser (hero, social proof, …).
// undefined = ikke hentet ennå · null = hentet, men feilet/utilgjengelig.
let cachedCount: number | null | undefined;
let inflight: Promise<number | null> | null = null;

async function fetchAuditCount(): Promise<number | null> {
  try {
    // PostgREST returnerer skalar-funksjoner direkte som tall (evt. [tall]).
    const res = await supabaseRest<unknown>('rpc/public_audit_stats', {
      method: 'POST',
      requireAuth: false,
      body: {},
      timeoutMs: 8000,
    });
    const raw = Array.isArray(res) ? res[0] : res;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null; // non-blocking: skjul tallet, aldri krasj forsiden
  }
}

/** Henter audit-antallet én gang (cachet). Returnerer null til det finnes / ved feil. */
export function useAuditCount(): number | null {
  const [count, setCount] = useState<number | null>(cachedCount ?? null);

  useEffect(() => {
    if (cachedCount !== undefined) {
      setCount(cachedCount);
      return;
    }
    let alive = true;
    if (!inflight) inflight = fetchAuditCount();
    inflight.then((n) => {
      cachedCount = n;
      if (alive) setCount(n);
    });
    return () => {
      alive = false;
    };
  }, []);

  return count;
}

/** «1 200+» når over terskel (rundet ned til nærmeste 100), ellers null. */
export function formatAuditCount(n: number | null): string | null {
  if (n == null || n < AUDIT_COUNT_THRESHOLD) return null;
  const rounded = Math.floor(n / 100) * 100;
  return `${rounded.toLocaleString('nb-NO')}+`;
}

/**
 * Ærlig bruks-tall. Rendrer INGENTING når tallet er skjult (under terskel, feil,
 * eller ikke hentet ennå) — så seksjonen ser nøyaktig ut som før til tallet er
 * ekte og stort nok. `tone="dark"` for bruk på mørk flate.
 */
export function UsageStat({
  tone = 'light',
  className = '',
}: {
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const count = useAuditCount();
  const label = formatAuditCount(count);
  if (!label) return null;

  const dark = tone === 'dark';
  return (
    <div className={`flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 ${className}`}>
      <span className={`text-2xl sm:text-3xl font-black tracking-tight ${dark ? 'text-white' : 'text-[#1A1A1A]'}`}>
        {label}
      </span>
      <span className={`text-sm font-bold ${dark ? 'text-white/60' : 'text-[#808080]'}`}>
        sider analysert med Sikt
      </span>
    </div>
  );
}

export default UsageStat;
