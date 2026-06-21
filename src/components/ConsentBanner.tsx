import React, { useEffect, useState } from 'react';
import { analyticsConfigured, getConsent, setConsent, startAnalytics } from '../analytics';

// GDPR-vennlig samtykke-banner. Vises KUN når analytics er konfigurert
// (VITE_POSTHOG_KEY satt) og brukeren ikke har valgt ennå. Sporing starter først
// etter «Godta». Uten nøkkel rendres ingenting — ingen unødvendig friksjon.
export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!analyticsConfigured()) return;
    const existing = getConsent();
    if (existing === 'granted') {
      void startAnalytics();
    } else if (existing === null) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const accept = () => {
    setConsent('granted');
    void startAnalytics();
    setVisible(false);
  };
  const decline = () => {
    setConsent('denied');
    setVisible(false);
  };

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:max-w-sm z-[70]">
      <div className="animate-fade-in rounded-2xl bg-white border border-[#EBEBE6] shadow-[0_20px_50px_-20px_rgba(26,26,26,0.25)] p-5">
        <p className="text-sm text-[#1A1A1A] font-semibold leading-relaxed">
          Vi bruker analyse-informasjonskapsler for å forstå hvordan siden brukes — bare hvis du sier ja.
        </p>
        <p className="mt-1 text-xs text-[#808080] leading-relaxed">
          Les mer i{' '}
          <a href="/personvern" className="font-bold text-violet-700 underline decoration-violet-200 underline-offset-2">
            personvernerklæringen
          </a>
          .
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={accept}
            className="flex-1 rounded-full bg-[#1A1A1A] text-white text-sm font-black py-2.5 ui-motion ui-lift-sm [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-700"
          >
            Godta
          </button>
          <button
            onClick={decline}
            className="flex-1 rounded-full bg-white text-[#1A1A1A] border border-[#EBEBE6] text-sm font-bold py-2.5 ui-motion [@media(hover:hover)_and_(pointer:fine)]:hover:border-violet-300"
          >
            Avslå
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConsentBanner;
