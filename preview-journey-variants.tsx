import React from 'react';
import { createRoot } from 'react-dom/client';
import { X } from 'lucide-react';
import './index.css';

const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
const PHASES = [
  { n: '01', week: 'Uke 1–2', title: 'Grunnmuren', body: 'Sikt kobler til, analyserer og fikser de tekniske feilene som holder deg nede.' },
  { n: '02', week: 'Uke 3–6', title: 'Klatringen', body: 'Innhold og søkeord optimaliseres. Du begynner å klatre på «nesten på side 1».' },
  { n: '03', week: 'Uke 8–12', title: 'Resultatene', body: 'Rangering og trafikk begynner å bevege seg synlig. Tålmodigheten betaler seg.' },
];
const SERIF = "Georgia, 'Times New Roman', serif";
const keyframes = `@keyframes jin { from { opacity:0; transform:translateY(8px);} to {opacity:1; transform:translateY(0);} } .jit{opacity:0;animation:jin 360ms ${EASE} forwards} @media (prefers-reduced-motion:reduce){@keyframes jin{from{opacity:0}to{opacity:1}}}`;

/* ── A — Editorial warm (merkevarens serif-stemme, varmt papir) ── */
function VariantA() {
  return (
    <div style={{ position: 'relative', background: '#F7F4EE', border: '1px solid #E7E0D3', borderRadius: 20, padding: 28, fontFamily: "'DM Sans',system-ui" }}>
      <button style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: '#A89F8C', cursor: 'pointer' }}><X size={16} /></button>
      <div className="jit" style={{ animationDelay: '0ms' }}>
        <p style={{ fontFamily: 'ui-monospace,monospace', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#A0784B', margin: 0 }}>Slik ser veien ut</p>
        <h2 style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 26, color: '#22201B', margin: '10px 0 0', lineHeight: 1.2 }}>SEO er en klatring,<br />ikke en bryter.</h2>
        <p style={{ fontSize: 13.5, color: '#6B6557', lineHeight: 1.6, margin: '12px 0 0', maxWidth: 440 }}>Resultater på Google tar 60–90 dager. Men du ser arbeidet vårt hver mandag — lenge før rangeringen flytter seg.</p>
      </div>
      <div style={{ marginTop: 24, borderTop: '1px solid #E7E0D3' }}>
        {PHASES.map((p, i) => (
          <div key={i} className="jit" style={{ animationDelay: `${100 + i * 70}ms`, display: 'flex', gap: 18, padding: '16px 0', borderBottom: i < 2 ? '1px solid #ECE6DA' : 'none' }}>
            <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 30, color: '#CDBfA3', lineHeight: 1, width: 38, flexShrink: 0 }}>{p.n}</span>
            <div>
              <p style={{ fontFamily: 'ui-monospace,monospace', fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#A0784B', margin: 0 }}>{p.week} · {p.title}</p>
              <p style={{ fontSize: 13.5, color: '#48433A', lineHeight: 1.55, margin: '5px 0 0' }}>{p.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── B — Cinematic dark (matcher dashbordets mørke hero-kort) ── */
function VariantB() {
  return (
    <div style={{ position: 'relative', background: '#141414', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 28, fontFamily: "'DM Sans',system-ui", boxShadow: '0 20px 50px rgba(0,0,0,0.45)' }}>
      <button style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: '#6b6b6b', cursor: 'pointer' }}><X size={16} /></button>
      <div className="jit" style={{ animationDelay: '0ms' }}>
        <p style={{ fontFamily: 'ui-monospace,monospace', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#A7F3D0', margin: 0 }}>Slik ser veien ut</p>
        <h2 style={{ fontWeight: 700, fontSize: 25, color: '#fff', margin: '10px 0 0', lineHeight: 1.2, letterSpacing: '-0.02em' }}>SEO er en klatring, <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, color: '#A7F3D0' }}>ikke en bryter.</span></h2>
        <p style={{ fontSize: 13.5, color: '#9a9a9a', lineHeight: 1.6, margin: '12px 0 0', maxWidth: 440 }}>Resultater på Google tar 60–90 dager. Men du ser arbeidet vårt hver mandag — lenge før rangeringen flytter seg.</p>
      </div>
      <div style={{ marginTop: 24, position: 'relative', paddingLeft: 26 }}>
        <div style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 2, background: 'linear-gradient(#065F46,#A7F3D0,rgba(167,243,208,0.1))', borderRadius: 2 }} />
        {PHASES.map((p, i) => (
          <div key={i} className="jit" style={{ animationDelay: `${100 + i * 70}ms`, marginBottom: i < 2 ? 18 : 0 }}>
            <span style={{ position: 'absolute', left: 0, marginTop: 3, width: 12, height: 12, borderRadius: 999, background: '#A7F3D0', boxShadow: '0 0 0 4px #141414' }} />
            <p style={{ fontFamily: 'ui-monospace,monospace', fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5fae8a', margin: 0 }}>{p.week}</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: '3px 0 0' }}>{p.title}</p>
            <p style={{ fontSize: 13, color: '#9a9a9a', lineHeight: 1.5, margin: '3px 0 0' }}>{p.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── C — Swiss minimal (store ghost-tall, rutenett, én aksent) ── */
function VariantC() {
  return (
    <div style={{ position: 'relative', background: '#fff', border: '1px solid #E8EAED', borderRadius: 20, padding: 28, fontFamily: "'DM Sans',system-ui" }}>
      <div style={{ position: 'absolute', top: 0, left: 28, right: 28, height: 3, background: '#1A1A1A', borderRadius: '0 0 2px 2px' }} />
      <button style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: '#aab', cursor: 'pointer' }}><X size={16} /></button>
      <div className="jit" style={{ animationDelay: '0ms', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontWeight: 800, fontSize: 22, color: '#11151A', margin: '6px 0 0', letterSpacing: '-0.02em' }}>Slik ser veien ut</h2>
        <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 11, color: '#9AA3AD' }}>60–90 dager</span>
      </div>
      <p className="jit" style={{ animationDelay: '60ms', fontSize: 13.5, color: '#5B6570', lineHeight: 1.6, margin: '10px 0 0', maxWidth: 460 }}>Resultater tar tid. Men du ser arbeidet vårt hver mandag — lenge før rangeringen flytter seg.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginTop: 22 }}>
        {PHASES.map((p, i) => (
          <div key={i} className="jit" style={{ animationDelay: `${120 + i * 70}ms`, borderTop: '1px solid #11151A', paddingTop: 12 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: '#D6DBE0', letterSpacing: '-0.04em', lineHeight: 1 }}>{p.n}</span>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#E0533D', margin: '8px 0 0', letterSpacing: '0.02em' }}>{p.week}</p>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: '#11151A', margin: '2px 0 0' }}>{p.title}</p>
            <p style={{ fontSize: 12.5, color: '#5B6570', lineHeight: 1.45, margin: '5px 0 0' }}>{p.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function App() {
  const variants: [string, React.FC][] = [['A — Editorial / varmt papir + serif', VariantA], ['B — Cinematic mørk (matcher hero-kortet)', VariantB], ['C — Swiss minimal / rutenett', VariantC]];
  return (
    <div style={{ background: '#e2e5ea', minHeight: '100vh', padding: 28 }}>
      <style>{keyframes}</style>
      <h1 style={{ fontFamily: 'system-ui', fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Forventnings-kort — tre stil-retninger</h1>
      <p style={{ fontFamily: 'system-ui', fontSize: 13, color: '#64748b', marginBottom: 24 }}>Velg én (eller bland), så bygger jeg den inn i den ekte, tema-bevisste komponenten.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 620 }}>
        {variants.map(([label, V]) => (
          <div key={label}>
            <p style={{ fontFamily: 'system-ui', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 10 }}>{label}</p>
            <V />
          </div>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
