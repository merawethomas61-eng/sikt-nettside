// Topp-nivå ruting. Nye marketing-sider får ekte URL-er; alt annet (forside,
// login, portal, onboarding, success, settings) går via catch-all til den
// eksisterende App-komponenten, som beholder hele den auth-gatede flyten.
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import App, { Navbar, Footer, PrivacyPage, TermsPage } from '../App';
import FunksjonerPage from './pages/FunksjonerPage';
import OmOssPage from './pages/OmOssPage';
import KontaktPage from './pages/KontaktPage';
import PriserPage from './pages/PriserPage';
import BloggIndexPage from './pages/BloggIndexPage';
import BloggPostPage from './pages/BloggPostPage';

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
      <Routes>
        <Route path="/funksjoner" element={<FunksjonerPage />} />
        <Route path="/om-oss" element={<OmOssPage />} />
        <Route path="/blogg" element={<BloggIndexPage />} />
        <Route path="/blogg/:slug" element={<BloggPostPage />} />
        <Route path="/priser" element={<PriserPage />} />
        <Route path="/kontakt" element={<KontaktPage />} />
        <Route path="/personvern" element={<LegalRoute kind="privacy" />} />
        <Route path="/vilkar" element={<LegalRoute kind="terms" />} />
        {/* Bevar gamle interne lenker */}
        <Route path="/deepdive" element={<Navigate to="/funksjoner" replace />} />
        <Route path="/technology" element={<Navigate to="/funksjoner" replace />} />
        {/* Alt annet → eksisterende app (forside, login, portal, onboarding …) */}
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  );
}
