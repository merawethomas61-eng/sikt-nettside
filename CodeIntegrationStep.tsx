import React, { useState, useEffect } from 'react';
import { Github, UploadCloud, Globe, ArrowRight, FileCode, CheckCircle2, Loader2, GitMerge, ShoppingBag, LayoutDashboard, Server, X } from 'lucide-react';

export const CodeIntegrationStep = ({ onNext, onSkip }) => {
  const [uploading, setUploading] = useState(false);

  // 1. SIKKER URL-VASK OG AUTOMATISK PANSERLÅS
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Tving på låsen med én gang kunden ser denne skjermen!
      localStorage.setItem('sikt_onboarding_lock', 'true');

      if (window.location.search.includes('payment_success')) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
  }, []);

  // 2. LESE FRA MINNET (Kjører KUN i det millisekundet skjemaet tegnes opp)
  const [uploadedFiles, setUploadedFiles] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sikt_final_files');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const [activePlatform, setActivePlatform] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sikt_final_platform') || null;
    }
    return null;
  });

  const [integrationInput, setIntegrationInput] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sikt_final_input') || '';
    }
    return '';
  });

  // 3. SKRIVE TIL MINNET (Kjører KUN når du fysisk klikker på noe. Ingen automatikk som kan feile!)
  const updatePlatform = (platform) => {
    setActivePlatform(platform);
    if (platform) localStorage.setItem('sikt_final_platform', platform);
    else localStorage.removeItem('sikt_final_platform');
  };

  const updateInput = (text) => {
    setIntegrationInput(text);
    localStorage.setItem('sikt_final_input', text);
  };

  const updateFiles = (newFiles) => {
    setUploadedFiles(newFiles);
    localStorage.setItem('sikt_final_files', JSON.stringify(newFiles));
  };

  // Håndtering av filopplasting (Drag & Drop)
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      updateFiles([...uploadedFiles, { name: file.name, content: event.target.result }]);
      setUploading(false);
    };
    reader.readAsText(file);
  };

  // Håndtering av GitHub / Plattform tilkobling
  const handleConnectPlatform = (e) => {
    e.preventDefault();
    setUploading(true);
    setTimeout(() => {
      updateFiles([...uploadedFiles, { name: `tilkoblet-fra-${activePlatform}.js`, content: "// Kode hentet automatisk" }]);
      setUploading(false);
      updatePlatform(null); // Lukk popup
      updateInput('');      // Tøm tekstfelt
    }, 1500);
  };

  // Når kunden er ferdig og går til dashbordet
  const handleFinish = (action) => {
    // Slett alt minne så skjemaet er tomt neste gang de skal bruke det
    localStorage.removeItem('sikt_final_files');
    localStorage.removeItem('sikt_final_platform');
    localStorage.removeItem('sikt_final_input');

    // Lås opp dørvakten i App.tsx
    localStorage.removeItem('sikt_onboarding_lock');

    if (action === 'next') onNext(uploadedFiles);
    else onSkip();
  };

  return (
    <div className="min-h-screen bg-[#0D1117] flex items-center justify-center p-6 font-sans">
      <div className="max-w-3xl w-full bg-slate-900/50 border border-white/10 rounded-3xl p-10 backdrop-blur-xl shadow-2xl relative overflow-hidden">

        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[500px] bg-violet-600/20 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="relative z-10 text-center mb-10">
          <h1 className="text-3xl font-black text-white mb-4 tracking-tight">Hvor ligger koden din?</h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xl mx-auto">
            Sikt støtter alle plattformer. Gi oss tilgang til kildekoden din, så gir AI-en deg nøyaktige "copy-paste"-løsninger for dine spesifikke filer.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-8">

          {/* VENSTRE SIDE: De store plattformene */}
          <div className="lg:col-span-3 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2 mb-3">Koble til plattform</h3>

            <div className="grid grid-cols-2 gap-3 relative group">
              <button onClick={() => updatePlatform('github')} className="flex flex-col items-start p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-violet-500/50 transition-all text-left">
                <Github className="text-white mb-3" size={24} />
                <h4 className="text-white font-semibold text-sm">GitHub / Repo</h4>
                <p className="text-xs text-slate-500 mt-1">Koble til direkte</p>
              </button>

              <button onClick={() => updatePlatform('wordpress')} className="flex flex-col items-start p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-violet-500/50 transition-all text-left">
                <LayoutDashboard className="text-white mb-3" size={24} />
                <h4 className="text-white font-semibold text-sm">WordPress</h4>
                <p className="text-xs text-slate-500 mt-1">Koble til via URL</p>
              </button>

              <button onClick={() => updatePlatform('shopify')} className="flex flex-col items-start p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-violet-500/50 transition-all text-left">
                <ShoppingBag className="text-white mb-3" size={24} />
                <h4 className="text-white font-semibold text-sm">Shopify</h4>
                <p className="text-xs text-slate-500 mt-1">Koble til butikk</p>
              </button>

              <button onClick={() => updatePlatform('vercel')} className="flex flex-col items-start p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-violet-500/50 transition-all text-left">
                <Server className="text-white mb-3" size={24} />
                <h4 className="text-white font-semibold text-sm">Vercel / AWS</h4>
                <p className="text-xs text-slate-500 mt-1">Koble til server</p>
              </button>
            </div>
          </div>

          {/* HØYRE SIDE: Filopplasting */}
          <div className="lg:col-span-2 space-y-4 flex flex-col">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2 mb-3">Eller last opp fil</h3>

            <label className="w-full flex-1 flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-950/50 border-2 border-dashed border-white/10 hover:border-violet-500/50 hover:bg-violet-500/5 cursor-pointer transition-all group relative min-h-[200px]">
              <input type="file" className="hidden" onChange={handleFileUpload} accept=".js,.jsx,.ts,.tsx,.css,.html,.php" />
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <UploadCloud className="text-slate-400 group-hover:text-violet-400 transition-colors" size={24} />
              </div>
              <h4 className="text-white font-semibold text-sm mb-2">Slipp filen her</h4>
              <p className="text-xs text-slate-500 text-center max-w-[150px]">Fungerer med alle kodespråk</p>
            </label>
          </div>
        </div>

        {/* Visning av opplastede filer */}
        {uploadedFiles.length > 0 && (
          <div className="mb-2 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={18} />
            <div>
              <h4 className="text-emerald-400 text-sm font-bold mb-1">Filer klar for AI-analyse</h4>
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((file, i) => (
                  <span key={i} className="text-xs text-emerald-300/80 bg-emerald-500/10 px-2 py-1 rounded-md flex items-center gap-1.5">
                    <FileCode size={12} /> {file.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Navigasjon */}
        <div className="flex items-center justify-between pt-6 border-t border-white/10 mt-6">
          <button onClick={() => handleFinish('skip')} className="text-sm font-medium text-slate-500 hover:text-white transition-colors">
            Hopp over og fullfør senere
          </button>

          <button
            onClick={() => handleFinish('next')}
            className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${uploadedFiles.length > 0
              ? 'bg-violet-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:bg-violet-400'
              : 'bg-white/5 text-slate-400 cursor-not-allowed'
              }`}
          >
            Fortsett til Dashboard
          </button>
        </div>

        {/* --- POPUP FOR PLATTFORM-TILKOBLING --- */}
        {activePlatform && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white capitalize flex items-center gap-2">
                  {activePlatform === 'github' && <Github size={20} />}
                  {activePlatform === 'wordpress' && <LayoutDashboard size={20} />}
                  {activePlatform === 'shopify' && <ShoppingBag size={20} />}
                  {activePlatform === 'vercel' && <Server size={20} />}
                  Koble til {activePlatform}
                </h3>
                <button onClick={() => updatePlatform(null)} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleConnectPlatform}>
                <div className="mb-6">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    URL til repository / nettside
                  </label>
                  <input
                    type="text"
                    required
                    value={integrationInput}
                    onChange={(e) => updateInput(e.target.value)}
                    placeholder={activePlatform === 'github' ? "https://github.com/brukernavn/repo" : "https://din-nettside.no"}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 px-4 rounded-xl transition-all flex justify-center items-center gap-2"
                >
                  {uploading ? <Loader2 size={18} className="animate-spin" /> : 'Koble til og hent kode'}
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};