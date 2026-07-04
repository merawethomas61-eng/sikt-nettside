// Topp-nivå ruting. Marketing-sider + forsiden/portalen lastes lazy slik at hver
// rute blir sin egen chunk: marketing-/blogg-sider drar IKKE lenger inn den store
// App.tsx (med ClientPortal). Forsiden + alle auth-gatede flyter (login, portal,
// onboarding, success, settings) bor fortsatt i App, som nå er en egen lazy chunk.
import React, { Suspense, lazy, useLayoutEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Navbar } from './shared/Navbar';
import { Footer } from './shared/Footer';
import { PrivacyPage, TermsPage, AngrerettPage } from './shared/Legal';
import { ConsentBanner } from './components/ConsentBanner';

const App = lazy(() => import('../App'));
const FunksjonerPage = lazy(() => import('./pages/FunksjonerPage'));
const OmOssPage = lazy(() => import('./pages/OmOssPage'));
const KontaktPage = lazy(() => import('./pages/KontaktPage'));
const PriserPage = lazy(() => import('./pages/PriserPage'));
const BloggIndexPage = lazy(() => import('./pages/BloggIndexPage'));
const BloggPostPage = lazy(() => import('./pages/BloggPostPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Nøytral fallback mens en rute-chunk lastes. Holder forsidens bakgrunnsfarge så
// det ikke blir et hvitt blink, men uten innhold (rask, layout-stabil).
function RouteFallback() {
  return <div className="min-h-screen bg-[#F2EFE8]" aria-hidden="true" />;
}

// Nullstiller scroll til toppen ved hvert rute-bytte. React Router v7 med
// <BrowserRouter> gjenoppretter IKKE scroll automatisk (kun data-routerens
// <ScrollRestoration> gjør det), så uten dette ble man stående på samme
// scroll-posisjon når man byttet «fane» (f.eks. forside → /funksjoner).
// Unntak: når URL-en har en hash (#gratis-analyse, #priser) lar vi anker-
// scrollingen styre selv. useLayoutEffect kjører før paint → ingen synlig hopp.
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useLayoutEffect(() => {
    if (hash) return;
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

// De juridiske sidene gjenbrukes som ekte URL-er, med Navbar/Footer rundt (samme
// layout som når de vises inne i App).
function LegalRoute({ kind }: { kind: 'privacy' | 'terms' | 'withdrawal' }) {
  const navigate = useNavigate();
  const goHome = () => navigate('/');
  return (
    <div className="min-h-screen selection:bg-[#E9E4DA] selection:text-[#1A1A1A] bg-[#F2EFE8] relative overflow-x-hidden">
      <Navbar />
      <main className="relative z-10">
        {kind === 'privacy' && <PrivacyPage onBack={goHome} />}
        {kind === 'terms' && <TermsPage onBack={goHome} />}
        {kind === 'withdrawal' && <AngrerettPage onBack={goHome} />}
      </main>
      <Footer />
    </div>
  );
}

export default function Root() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/funksjoner" element={<FunksjonerPage />} />
          <Route path="/om-oss" element={<OmOssPage />} />
          <Route path="/blogg" element={<BloggIndexPage />} />
          <Route path="/blogg/:slug" element={<BloggPostPage />} />
          <Route path="/priser" element={<PriserPage />} />
          <Route path="/kontakt" element={<KontaktPage />} />
          <Route path="/personvern" element={<LegalRoute kind="privacy" />} />
          <Route path="/vilkar" element={<LegalRoute kind="terms" />} />
          <Route path="/angrerett" element={<LegalRoute kind="withdrawal" />} />
          {/* Bevar gamle interne lenker (server-redirect i vercel.json; dette er klient-fallback) */}
          <Route path="/deepdive" element={<Navigate to="/funksjoner" replace />} />
          <Route path="/technology" element={<Navigate to="/funksjoner" replace />} />
          {/* Forsiden + alle auth-gatede flyter (login, portal, onboarding, success) */}
          <Route path="/" element={<App />} />
          {/* Ekte 404: ukjente URL-er viser NotFound (ikke forsiden) */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      <ConsentBanner />
    </BrowserRouter>
  );
}
