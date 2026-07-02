import React from 'react';

/* ------------------------------------------------------------------ *
 * Delte produkt-mock-primitiver. Brukes av forsidens ProductPreview og
 * mockene på Funksjoner-siden, slik at «ekte produkt-UI» ser likt ut
 * overalt. Sammen med Frame utgjør de hele mock-språket.
 * ------------------------------------------------------------------ */

// Felles app-topplinje inne i en Frame (vindusramme + app-header = ekte produkt).
export function PanelHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between h-12 sm:h-14 px-4 sm:px-6 border-b border-[#E9E4DA] bg-white">
      <span className="text-xs sm:text-sm font-bold text-[#1A1A1A] tracking-tight">{title}</span>
      {right}
    </div>
  );
}

export function LiveChip() {
  return (
    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#E8F1EB] border border-[#D6EEDF]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#15795A] animate-pulse" />
      <span className="text-[9px] font-black text-[#1A1A1A] uppercase tracking-wider">Live</span>
    </span>
  );
}
