import React from 'react';
import { createRoot } from 'react-dom/client';
import { DashboardHome } from './DashboardHome';
import { JourneyTimeline } from './JourneyTimeline';
import { ActivationChecklist } from './ActivationChecklist';
import './index.css';

/* ──────────────────────────────────────────────────────────────────────
   Forhåndsvisning av det redesignede dashbordet (Hjem-fanen).
   Realistiske mock-data — ingen Supabase/innlogging nødvendig.
   Kjør:  npm run dev   →   åpne /preview-dashboard.html
   ────────────────────────────────────────────────────────────────────── */

const DAY = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * DAY).toISOString();

// Teknisk + synlighet over tid (organiske, ujevne tall som klatrer)
const scoreHistory = [
  { at: ago(56), mobilePerf: 62, mobileSeo: 68, desktopPerf: 74 },
  { at: ago(49), mobilePerf: 64, mobileSeo: 67, desktopPerf: 76 },
  { at: ago(42), mobilePerf: 66, mobileSeo: 71, desktopPerf: 78 },
  { at: ago(35), mobilePerf: 69, mobileSeo: 73, desktopPerf: 80 },
  { at: ago(28), mobilePerf: 71, mobileSeo: 74, desktopPerf: 81 },
  { at: ago(21), mobilePerf: 74, mobileSeo: 78, desktopPerf: 83 },
  { at: ago(14), mobilePerf: 76, mobileSeo: 80, desktopPerf: 84 },
  { at: ago(7),  mobilePerf: 78, mobileSeo: 82, desktopPerf: 86 },
  { at: ago(1),  mobilePerf: 81, mobileSeo: 85, desktopPerf: 88 },
];

const analysisResults = {
  mobile: {
    performance: 81,
    seo: 88,
    bestPractices: 92,
    accessibility: 79,
    opportunities: [
      { id: 'largest-contentful-paint', title: 'Reduser Largest Contentful Paint', savings: '1,8 s' },
      { id: 'unused-javascript', title: 'Fjern ubrukt JavaScript', savings: '320 kB' },
      { id: 'meta-description', title: 'Legg til meta-beskrivelse', savings: '3 sider' },
      { id: 'image-alt', title: 'Mangler alt-tekst på bilder', savings: '12 bilder' },
    ],
  },
};

const realRankings = [
  { keyword: 'tannlege oslo', position: 3 },
  { keyword: 'akutt tannlege', position: 7 },
  { keyword: 'tannregulering pris', position: 12 },
  { keyword: 'tannbleking oslo', position: 5 },
  { keyword: 'tannlegevakt', position: 18 },
  { keyword: 'implantat tann', position: 24 },
  { keyword: 'tannlege grünerløkka', position: 9 },
  { keyword: 'visdomstann fjerning', position: 31 },
];

const gscKeywords = [
  { clicks: 847, impressions: 23_140 },
  { clicks: 393, impressions: 25_060 },
];

const siktActions = [
  { action: 'analysis_run', details: { technical_score: 85 }, created_at: ago(0.02) },
  { action: 'keyword_check', details: { keyword: 'tannlege grünerløkka', previous_position: 14, position: 9 }, created_at: ago(0.4) },
  { action: 'content_scan', details: { audit: 'Meta-beskrivelse', page: '/tjenester' }, created_at: ago(1.1) },
  { action: 'gsc_connected', details: { impressions: 48_200 }, created_at: ago(2) },
  { action: 'report_sent', details: { recipients: 2 }, created_at: ago(7) },
];

const geo = {
  total: 18,
  mentioned: 7,
  byProvider: {
    chatgpt: { mentioned: 4, total: 6 },
    gemini: { mentioned: 2, total: 6 },
    perplexity: { mentioned: 1, total: 6 },
  },
};

const noop = () => {};

function Nav() {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 40, background: '#F5F5F0', borderBottom: '1px solid #EBEBE6' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '14px 32px', display: 'flex', alignItems: 'center', gap: 24, fontFamily: "'Geist',system-ui" }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: '#1A1A1A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>S</span>
          <span style={{ fontWeight: 600, fontSize: 17, color: '#1A1A1A', letterSpacing: '-0.01em' }}>Sikt</span>
        </div>
        <nav style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', gap: 2, background: '#fff', border: '1px solid #EBEBE6', borderRadius: 999, padding: 5 }}>
            {['Hjem', 'Søkeord', 'Konkurrenter', 'GEO', 'Innstillinger'].map((t, i) => (
              <span key={t} style={{ padding: '9px 16px', borderRadius: 999, fontSize: 14, fontWeight: 600, background: i === 0 ? '#1A1A1A' : 'transparent', color: i === 0 ? '#fff' : '#808080' }}>{t}</span>
            ))}
          </div>
        </nav>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #EBEBE6', borderRadius: 999, padding: '5px 12px 5px 5px' }}>
          <span style={{ width: 28, height: 28, borderRadius: 999, background: '#1A1A1A', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>MB</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>Marte Berg</span>
        </span>
      </div>
    </header>
  );
}

function App() {
  return (
    <div style={{ minHeight: '100vh', background: '#F6F5F1' }}>
      <Nav />
      <main style={{ maxWidth: 1320, margin: '0 auto', padding: '40px 32px 80px' }}>
        <header style={{ fontFamily: "'Geist',system-ui", marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 36, fontWeight: 600, letterSpacing: '-0.03em', color: '#1A1A1A' }}>Dashboard</h1>
          <p style={{ margin: '12px 0 0', fontSize: 16, color: '#8A8578' }}>Slik står det til med bjorklund-tannlege.no.</p>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <ActivationChecklist
            theme="light"
            websiteUrl="https://bjorklund-tannlege.no"
            hasAnalysis
            isAnalyzing={false}
            gscConnected
            hasStandardOrHigher
            hostIsFullyConnected={false}
            hostWasLightOnly={false}
            onAddUrl={noop}
            onRunAnalysis={noop}
            onConnectGsc={noop}
            onConnectWp={noop}
            onDismiss={noop}
          />

          <DashboardHome
            user={{ id: 'preview' }}
            clientData={{ companyName: 'Bjørklund Tannlegesenter', websiteUrl: 'https://bjorklund-tannlege.no' }}
            formData={{ websiteUrl: 'https://bjorklund-tannlege.no' }}
            analysisResults={analysisResults}
            scoreHistory={scoreHistory}
            siktActions={siktActions}
            realRankings={realRankings}
            gscConnected
            gscKeywords={gscKeywords}
            isAnalyzing={false}
            geo={geo}
            onRunAnalysis={noop}
            onNavigate={noop}
          />

          <div style={{ marginTop: 12 }}>
            <JourneyTimeline theme="light" onDismiss={noop} />
          </div>
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
