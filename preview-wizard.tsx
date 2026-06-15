import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { X, Loader2 } from 'lucide-react';
import './index.css';

// Speiler ADVISORY_PLATFORMS + FULL_PLATFORMS i App.tsx (hold i sync).
const ADVISORY_PLATFORMS = [
  { id: 'ai_built', label: 'AI-bygd side (Claude, v0, Cursor …)', hint: 'Forslag du limer inn i AI-verktøyet' },
  { id: 'webflow', label: 'Webflow', hint: 'Forslag du limer inn' },
  { id: 'wix', label: 'Wix', hint: 'Forslag du limer inn' },
  { id: 'squarespace', label: 'Squarespace', hint: 'Forslag du limer inn' },
  { id: 'ghost', label: 'Ghost', hint: 'Forslag du limer inn' },
  { id: 'other', label: 'Annet / egen side', hint: 'Forslag du limer inn' },
];
const shortLabel: Record<string, string> = { ai_built: 'AI-bygd side', webflow: 'Webflow', wix: 'Wix', squarespace: 'Squarespace', ghost: 'Ghost', other: 'egen side' };

function Wizard({ onClose }: { onClose: () => void }) {
  const [platform, setPlatform] = useState<string | null>(null);
  const advisory = platform && platform !== 'wordpress' && platform !== 'shopify' ? platform : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Lukk" onClick={onClose} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg rounded-2xl border border-[#EBEBE6] bg-[#FFFFFF] shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <header className="flex items-center justify-between mb-4">
          <p className="text-xs uppercase tracking-[0.12em]" style={{ color: '#808080', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>
            {platform === null ? 'Velg plattform' : platform === 'shopify' ? 'Shopify' : platform === 'wordpress' ? 'WordPress' : shortLabel[platform]}
          </p>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md" style={{ color: '#808080' }}><X size={16} /></button>
        </header>

        {platform === null && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: '#1A1A1A' }}>Hvilken plattform bruker du?</h3>
            <p className="text-sm" style={{ color: '#808080' }}>WordPress kobles med skrivetilgang så Sikt fikser automatisk. På andre plattformer lager Sikt ferdige forslag du limer inn selv.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button type="button" onClick={() => setPlatform('wordpress')} className="text-left p-4 rounded-xl border border-violet-300 bg-violet-50/40">
                <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>WordPress <span className="text-violet-600">· auto-fiks</span></p>
                <p className="text-xs mt-2" style={{ color: '#808080' }}>Sikt pusher endringer direkte til siden</p>
              </button>
              <button type="button" onClick={() => setPlatform('shopify')} className="text-left p-4 rounded-xl border border-violet-300 bg-violet-50/40">
                <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Shopify <span className="text-violet-600">· auto-fiks</span></p>
                <p className="text-xs mt-2" style={{ color: '#808080' }}>Sikt oppdaterer SEO via Admin API</p>
              </button>
              {ADVISORY_PLATFORMS.map((p) => (
                <button key={p.id} type="button" onClick={() => setPlatform(p.id)} className="text-left p-4 rounded-xl border border-[#EBEBE6] bg-[#FFFFFF]">
                  <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{p.label}</p>
                  <p className="text-xs mt-2" style={{ color: '#808080' }}>{p.hint}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {platform === 'shopify' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: '#1A1A1A' }}>Koble til Shopify</h3>
            <p className="text-sm" style={{ color: '#808080' }}>Sikt oppdaterer SEO-titler og beskrivelser automatisk via Shopify Admin API. Lag en «custom app» i Shopify og lim inn tokenet — det tar ett minutt.</p>
            <ol className="text-sm space-y-2 list-decimal list-inside" style={{ color: '#1A1A1A' }}>
              <li>I Shopify-admin: Innstillinger → Apper og salgskanaler → <em>Utvikle apper</em>.</li>
              <li>Klikk «Opprett app», gi den navnet «Sikt».</li>
              <li>Admin API: gi tilgangene <code style={{ background: '#F5F5F0', padding: '1px 5px', borderRadius: 4 }}>write_products</code> og <code style={{ background: '#F5F5F0', padding: '1px 5px', borderRadius: 4 }}>write_content</code>.</li>
              <li>Installer appen, kopier <em>Admin API-tilgangstoken</em> (<code style={{ background: '#F5F5F0', padding: '1px 5px', borderRadius: 4 }}>shpat_…</code>).</li>
            </ol>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#808080' }}>Shopify-adresse (.myshopify.com)</label>
              <input className="w-full rounded-lg px-3 py-2.5 text-sm border border-[#EBEBE6] bg-[#FFFFFF]" placeholder="minbutikk.myshopify.com" style={{ color: '#1A1A1A' }} />
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#808080' }}>Admin API-tilgangstoken</label>
              <input type="password" className="w-full rounded-lg px-3 py-2.5 text-sm border border-[#EBEBE6] bg-[#FFFFFF]" placeholder="shpat_..." style={{ color: '#1A1A1A' }} />
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <button type="button" onClick={() => setPlatform(null)} className="rounded-full px-4 py-2 text-sm border border-[#EBEBE6] bg-[#FFFFFF]" style={{ color: '#1A1A1A' }}>Tilbake</button>
              <button type="button" className="rounded-full px-4 py-2 text-sm border border-[#1A1A1A] bg-[#1A1A1A] text-white inline-flex items-center gap-2">Koble til</button>
            </div>
          </div>
        )}

        {advisory && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: '#1A1A1A' }}>Koble til {shortLabel[advisory]}</h3>
            <p className="text-sm" style={{ color: '#808080' }}>
              Lim inn nettadressen din (https). Sikt lager ferdige forslag — meta-titler, beskrivelser, FAQ og mer — som du kopierer inn i {shortLabel[advisory]}.
            </p>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#808080' }}>Nettside-URL</label>
              <input type="url" className="w-full rounded-lg px-3 py-2.5 text-sm border border-[#EBEBE6] bg-[#FFFFFF]" placeholder="https://dinside.no" style={{ color: '#1A1A1A' }} />
              <p className="text-xs mt-1.5" style={{ color: '#808080' }}>Må starte med https://</p>
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <button type="button" onClick={() => setPlatform(null)} className="rounded-full px-4 py-2 text-sm border border-[#EBEBE6] bg-[#FFFFFF]" style={{ color: '#1A1A1A' }}>Tilbake</button>
              <button type="button" className="rounded-full px-4 py-2 text-sm border border-[#1A1A1A] bg-[#1A1A1A] text-white inline-flex items-center gap-2">Koble til</button>
            </div>
          </div>
        )}

        {platform === 'wordpress' && (
          <div className="space-y-3 text-sm" style={{ color: '#808080' }}>
            <h3 className="text-lg font-semibold" style={{ color: '#1A1A1A' }}>WordPress (3 trinn)</h3>
            <p>Trinn 1: Last ned Sikt Connector-tillegget + lag Application Password. Trinn 2: lim inn URL/brukernavn/passord. Trinn 3: tilkoblet ✓.</p>
            <p style={{ fontStyle: 'italic' }}>(Verifisert i egen forhåndsvisning tidligere — vist forenklet her.)</p>
            <button type="button" onClick={() => setPlatform(null)} className="rounded-full px-4 py-2 text-sm border border-[#EBEBE6] bg-[#FFFFFF]" style={{ color: '#1A1A1A' }}>Tilbake</button>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ background: '#f1f5f9', minHeight: '100vh', padding: 24, fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Tilkoblings-wizard — plattformvalg</h1>
      <p style={{ fontSize: 13, color: '#64748b', margin: '8px 0 16px' }}>Klikk en plattform for å se skjermen. Lukk og åpne igjen for å gå tilbake til valget.</p>
      <button onClick={() => setOpen(true)} style={{ background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 999, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Åpne wizard</button>
      {open && <Wizard onClose={() => setOpen(false)} />}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
