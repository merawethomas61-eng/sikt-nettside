import React, { useState, useEffect } from 'react';
import { Github, Globe, CheckCircle2, Loader2, LayoutDashboard, ShoppingBag, Server, X, Lock, Sparkles, Zap, ArrowRight, Rocket } from 'lucide-react';
import { supabaseRest } from './src/supabaseRest';
import { toastSuccess, toastError, toastInfo } from './src/toast';

type Tier = 'BASIC' | 'STANDARD' | 'PREMIUM';

type Platform = 'github' | 'wordpress' | 'shopify' | 'wix' | 'webflow' | 'vercel' | 'custom';

const PLATFORMS: { id: Platform; name: string; icon: any; desc: string; inputLabel: string; placeholder: string }[] = [
  { id: 'github', name: 'GitHub', icon: Github, desc: 'Koble til repo', inputLabel: 'URL til repository', placeholder: 'https://github.com/brukernavn/repo' },
  { id: 'wordpress', name: 'WordPress', icon: LayoutDashboard, desc: 'Via admin-URL', inputLabel: 'URL til /wp-admin', placeholder: 'https://dinside.no/wp-admin' },
  { id: 'shopify', name: 'Shopify', icon: ShoppingBag, desc: 'Butikk-URL', inputLabel: 'URL til butikken', placeholder: 'https://dinside.myshopify.com' },
  { id: 'wix', name: 'Wix', icon: Globe, desc: 'Wix-side', inputLabel: 'URL til Wix-siden', placeholder: 'https://dinside.wixsite.com/hjem' },
  { id: 'webflow', name: 'Webflow', icon: Rocket, desc: 'Webflow-prosjekt', inputLabel: 'URL til prosjektet', placeholder: 'https://dinside.webflow.io' },
  { id: 'vercel', name: 'Vercel', icon: Server, desc: 'Koble til deploy', inputLabel: 'URL til Vercel-deploy', placeholder: 'https://dinside.vercel.app' },
  { id: 'custom', name: 'Eget webhotell', icon: Server, desc: 'Fritekst', inputLabel: 'Beskriv hvor siden er hostet', placeholder: 'F.eks. one.com, DomeneShop, cPanel hos Bluehost...' },
];

type Props = {
  userId: string;
  tier: Tier;
  onFinish: () => void;
  onUpgrade?: () => void;
};

/**
 * ConnectHostPage
 *
 * Vises MELLOM onboarding-skjemaet og ClientPortal.
 *
 * - Basic-brukere skal aldri se denne siden (App ruter forbi den).
 *   Hvis de likevel lander her som fallback, vises en oppgrader-prompt.
 * - Standard-brukere får kun "lett" tilkobling (plattform + URL).
 * - Premium-brukere kan velge mellom "lett" eller "full OAuth-tilgang"
 *   (sistnevnte er placeholder inntil vi bygger ut OAuth-integrasjoner).
 *
 * Lagrer til tabellen public.client_hosts via supabaseRest.
 */
export const CodeIntegrationStep: React.FC<Props> = ({ userId, tier, onFinish, onUpgrade }) => {
  const [activePlatform, setActivePlatform] = useState<Platform | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [showFullModePrompt, setShowFullModePrompt] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('payment_success')) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const canUseFullMode = tier === 'PREMIUM';
  const isBasic = tier === 'BASIC';

  // Lagrer host-info til client_hosts (UPSERT) og fullfører steget
  const saveHost = async (payload: {
    platform: Platform;
    connection_mode: 'light' | 'full';
    repo_url?: string;
    admin_url?: string;
    notes?: string;
  }) => {
    setSaving(true);
    try {
      await supabaseRest('client_hosts?on_conflict=user_id', {
        method: 'POST',
        body: {
          user_id: userId,
          ...payload,
          last_changed_at: new Date().toISOString(),
        },
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      });
      toastSuccess('Tilkoblet! Du er klar til å kjøre analyse.');
      onFinish();
    } catch (err: any) {
      console.error('[ConnectHost] Kunne ikke lagre:', err);
      toastError('Kunne ikke lagre tilkoblingen: ' + (err?.message || 'ukjent feil'));
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    const ok = window.confirm(
      'Er du sikker på at du vil hoppe over? Du kan koble til senere i Innstillinger, men AI-en vil gi mer generiske svar frem til du gjør det.',
    );
    if (!ok) return;

    setSaving(true);
    try {
      // Lag en "skipped"-rad slik at vi vet at kunden bevisst har hoppet over
      await supabaseRest('client_hosts?on_conflict=user_id', {
        method: 'POST',
        body: {
          user_id: userId,
          connection_mode: 'skipped',
          platform: null,
          last_changed_at: new Date().toISOString(),
        },
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      });
    } catch (err: any) {
      // Ikke blokker — vi lar kunden gå videre selv om lagringen feilet
      console.warn('[ConnectHost] Kunne ikke lagre skip:', err?.message || err);
    } finally {
      setSaving(false);
      toastInfo('Du kan koble til når som helst i Innstillinger.');
      onFinish();
    }
  };

  const handleSubmitLight = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlatform || !inputValue.trim()) return;

    const payload: any = {
      platform: activePlatform,
      connection_mode: 'light' as const,
    };
    if (activePlatform === 'github') {
      payload.repo_url = inputValue.trim();
    } else if (activePlatform === 'wordpress' || activePlatform === 'shopify') {
      payload.admin_url = inputValue.trim();
    } else if (activePlatform === 'custom') {
      payload.notes = inputValue.trim();
    } else {
      payload.admin_url = inputValue.trim();
    }

    saveHost(payload);
  };

  // -----------------------------------------
  // BASIC-FALLBACK (vises hvis en Basic-bruker
  // likevel ender opp her — App ruter normalt forbi)
  // -----------------------------------------
  if (isBasic) {
    return (
      <div className="min-h-screen bg-[#0D1117] flex items-center justify-center p-6 font-sans">
        <div className="max-w-xl w-full bg-slate-900/50 border border-white/10 rounded-3xl p-10 backdrop-blur-xl shadow-2xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-6">
            <Lock size={22} />
          </div>
          <h1 className="text-2xl font-black text-white mb-3">Koble-til-host er låst i Basic</h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Oppgrader til Standard eller Premium for at Sikts AI skal kunne lese siden din og foreslå
            eksakt hvilken kode-linje som må fjernes og hva den skal erstattes med.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onFinish}
              className="px-6 py-3 rounded-xl bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 transition-all font-bold text-sm"
            >
              Gå til dashbord
            </button>
            <button
              onClick={onUpgrade}
              className="px-6 py-3 rounded-xl bg-violet-500 hover:bg-violet-400 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-500/30"
            >
              <Zap size={14} fill="currentColor" /> Oppgrader plan
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1117] flex items-center justify-center p-6 font-sans">
      <div className="max-w-3xl w-full bg-slate-900/50 border border-white/10 rounded-3xl p-10 backdrop-blur-xl shadow-2xl relative overflow-hidden">

        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[500px] bg-violet-600/20 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="relative z-10 text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
            <Sparkles size={12} className="text-violet-400" /> Siste steg
          </div>
          <h1 className="text-3xl font-black text-white mb-3 tracking-tight">Koble til hosten din</h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xl mx-auto">
            Gi oss en referanse til hvor siden din ligger, så kan AI-en peke på nøyaktig kode-linje du må
            fjerne og hva den skal erstattes med. Du kan hoppe over og gjøre det senere i innstillinger.
          </p>
        </div>

        {/* --- MODE-VELGER (kun Premium ser full-mode) --- */}
        {canUseFullMode && (
          <div className="relative z-10 mb-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-5 rounded-2xl border border-violet-500/30 bg-violet-500/5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-black text-violet-300 uppercase tracking-widest">Lett tilkobling</span>
                <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">INKLUDERT</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Velg plattform og lim inn URL. AI-en leser den offentlige HTML-en og foreslår fikser.
              </p>
            </div>
            <button
              onClick={() => setShowFullModePrompt(true)}
              className="text-left p-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-black text-amber-300 uppercase tracking-widest">Full integrasjon</span>
                <span className="text-[9px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">PREMIUM</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                OAuth til GitHub/Shopify så Sikt kan foreslå og pushe patcher automatisk. Kommer snart.
              </p>
            </button>
          </div>
        )}

        {/* --- PLATTFORM-GRID (Lett tilkobling) --- */}
        <div className="relative z-10 space-y-4 mb-8">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2">Velg plattform</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => { setActivePlatform(p.id); setInputValue(''); }}
                className="flex flex-col items-start p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-violet-500/50 transition-all text-left"
              >
                <p.icon className="text-white mb-3" size={22} />
                <h4 className="text-white font-semibold text-sm">{p.name}</h4>
                <p className="text-xs text-slate-500 mt-1">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Navigasjon */}
        <div className="relative z-10 flex items-center justify-between pt-6 border-t border-white/10 mt-6 gap-4">
          <button
            onClick={handleSkip}
            disabled={saving}
            className="text-sm font-medium text-slate-500 hover:text-white transition-colors disabled:opacity-50"
          >
            Hopp over og fortsett
          </button>

          <span className="text-xs text-slate-600 hidden sm:block">
            Du kan endre dette én gang i uken i Innstillinger.
          </span>
        </div>

        {/* --- POPUP FOR LETT TILKOBLING --- */}
        {activePlatform && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  {(() => {
                    const p = PLATFORMS.find(x => x.id === activePlatform)!;
                    const Icon = p.icon;
                    return (<><Icon size={20} /> Koble til {p.name}</>);
                  })()}
                </h3>
                <button onClick={() => setActivePlatform(null)} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmitLight}>
                {(() => {
                  const p = PLATFORMS.find(x => x.id === activePlatform)!;
                  return (
                    <div className="mb-6">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        {p.inputLabel}
                      </label>
                      <input
                        type={activePlatform === 'custom' ? 'text' : 'url'}
                        required
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={p.placeholder}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                      />
                      <p className="text-[11px] text-slate-500 mt-2">
                        Denne URL-en brukes kun som kontekst til AI-analyse. Sikt får ikke skrive-tilgang.
                      </p>
                    </div>
                  );
                })()}

                <button
                  type="submit"
                  disabled={saving || !inputValue.trim()}
                  className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-all flex justify-center items-center gap-2"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : (<><CheckCircle2 size={16} /> Koble til</>)}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* --- POPUP FOR FULL OAUTH (PREMIUM, PLACEHOLDER) --- */}
        {showFullModePrompt && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-5">
                <Rocket size={22} />
              </div>
              <h3 className="text-lg font-black text-white mb-2">Full OAuth kommer snart</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                Vi er i ferd med å rulle ut full toveis-integrasjon for Premium — hvor Sikt kan foreslå
                patcher direkte i repoet ditt. Inntil videre kan du bruke "lett tilkobling" og kopiere
                forslagene manuelt.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowFullModePrompt(false)}
                  className="flex-1 px-5 py-3 rounded-xl bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 transition-all font-bold text-sm"
                >
                  Lukk
                </button>
                <button
                  onClick={() => setShowFullModePrompt(false)}
                  className="flex-1 px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
                >
                  Bruk lett tilkobling <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
