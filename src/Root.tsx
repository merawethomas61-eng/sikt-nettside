// Topp-nivå ruting. Marketing-sider + forsiden/portalen lastes lazy slik at hver
// rute blir sin egen chunk: marketing-/blogg-sider drar IKKE lenger inn den store
// App.tsx (med ClientPortal). Forsiden + alle auth-gatede flyter (login, portal,
// onboarding, success, settings) bor fortsatt i App, som nå er en egen lazy chunk.
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Navbar } from './shared/Navbar';
import { Footer } from './shared/Footer';
import { PrivacyPage, TermsPage } from './shared/Legal';
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
  return <div className="min-h-screen bg-[#F5F5F0]" aria-hidden="true" />;
}

// De juridiske sidene gjenbrukes som ekte URL-er, med Navbar/Footer rundt (samme
// layout som når de vises inne i App).
function LegalRoute({ kind }: { kind: 'privacy' | 'terms' }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen selection:bg-[#EBEBE6] selection:text-[#1A1A1A] bg-[#F5F5F0] relative overflow-x-hidden">
      <Navbar />
      <main className="relative z-10">
        {kind === 'privacy'
          ? <PrivacyPage onBack={() => navigate('/')} />
          : <TermsPage onBack={() => navigate('/')} />}
      </main>
      <Footer />
    </div>
  );
}

export default function Root() {
  return (
    <BrowserRouter>
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
