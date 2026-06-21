import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Home } from 'lucide-react';
import { PageShell } from '../components/PageShell';
import { Seo } from '../components/Seo';
import { Container } from '../components/marketing/Container';

// Ekte 404: ukjente URL-er skal IKKE vise forsiden (soft-404). Denne siden er
// noindex, og serveren returnerer ekte HTTP 404 via dist/404.html (se prerender
// + vercel.json). Klient-ruten her dekker navigasjon inne i appen.
export default function NotFoundPage() {
  return (
    <PageShell>
      <Seo
        title="404 — Siden finnes ikke | Sikt"
        description="Siden du leter etter finnes ikke eller er flyttet."
        canonical="https://siktseo.com/404"
        noindex
      />
      <Container>
        <div className="min-h-[52vh] flex flex-col items-center justify-center text-center py-20">
          <p className="text-7xl sm:text-8xl font-black tracking-tighter text-[#1A1A1A]">404</p>
          <h1 className="mt-6 text-2xl sm:text-3xl font-black text-[#1A1A1A]">
            Denne siden finnes ikke
          </h1>
          <p className="mt-4 max-w-md text-base sm:text-lg text-[#808080] font-medium leading-relaxed">
            Lenken kan være feil, eller så er siden flyttet. Sjekk adressen, eller
            gå tilbake til forsiden — vi hjelper deg videre derfra.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
            <Link
              to="/"
              className="ui-motion inline-flex items-center gap-2 bg-[#1A1A1A] text-white px-6 py-3 rounded-full text-sm font-bold shadow-lg shadow-[rgba(26,26,26,0.08)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-700"
            >
              <Home size={16} /> Til forsiden
            </Link>
            <Link
              to="/funksjoner"
              className="inline-flex items-center gap-2 text-sm font-bold text-[#808080] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A] transition-colors"
            >
              Se hva Sikt gjør <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </Container>
    </PageShell>
  );
}
