import React from 'react';
import { Lock } from 'lucide-react';

// Vindus-/produkt-ramme i forsidens dashboard-stil. Wrapper hvilket som helst
// mockup-innhold slik at det føles som ekte produkt-UI — ikke pynt.
// - `url`  → viser en adresselinje (nettleser-modus). Utelat for en ren app-ramme.
// - `label`→ valgfri chip/tekst til høyre i topplinja (f.eks. status).
// - `glow` → svak lilla glød bak rammen (brukes på hero-visuellet).
export function Frame({
  children,
  url,
  label,
  glow = false,
  className = '',
}: {
  children: React.ReactNode;
  url?: string;
  label?: React.ReactNode;
  glow?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      {glow && (
        <div className="pointer-events-none absolute -inset-6 sm:-inset-10 bg-gradient-to-tr from-violet-500/15 via-indigo-400/8 to-transparent blur-3xl rounded-[44px]" />
      )}
      <div className="relative rounded-2xl sm:rounded-[26px] bg-white border border-[#EBEBE6] shadow-[0_30px_60px_-24px_rgba(26,26,26,0.18)] overflow-hidden">
        {/* Topplinje */}
        <div className="flex items-center gap-3 h-9 sm:h-11 px-3 sm:px-4 border-b border-[#EBEBE6] bg-[#F5F5F0]/70">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EBEBE6]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#EBEBE6]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#EBEBE6]" />
          </div>
          {url && (
            <div className="flex-1 flex justify-center min-w-0">
              <span className="flex items-center gap-1.5 max-w-full px-3 py-1 rounded-full bg-white border border-[#EBEBE6] text-[10px] sm:text-xs font-medium text-[#808080]">
                <Lock size={10} className="text-[#B3AD9F] shrink-0" />
                <span className="truncate">{url}</span>
              </span>
            </div>
          )}
          {label && <div className={`shrink-0 ${url ? '' : 'ml-auto'}`}>{label}</div>}
        </div>
        {/* Innhold */}
        {children}
      </div>
    </div>
  );
}

export default Frame;
