import React, { useState } from 'react';
import { Github, UploadCloud, Globe, ArrowRight, FileCode, CheckCircle2, Loader2, GitMerge, ShoppingBag, LayoutDashboard, Server } from 'lucide-react';

export const CodeIntegrationStep = ({ onNext, onSkip }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  // Simulering av filopplasting
  const handleFileUpload = (e) => {
    setUploading(true);
    setTimeout(() => {
      setUploadedFiles([...uploadedFiles, e.target.files[0].name]);
      setUploading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#0D1117] flex items-center justify-center p-6 font-sans">
      <div className="max-w-3xl w-full bg-slate-900/50 border border-white/10 rounded-3xl p-10 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        
        {/* Kosmetisk bakgrunnslys */}
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
            
            <div className="grid grid-cols-2 gap-3">
              {/* GitHub / GitLab */}
              <button className="flex flex-col items-start p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-violet-500/30 transition-all group text-left">
                <Github className="text-white mb-3" size={24} />
                <h4 className="text-white font-semibold text-sm">GitHub / Repo</h4>
                <p className="text-xs text-slate-500 mt-1">Gjennomgå kildekode</p>
              </button>

              {/* WordPress / CMS */}
              <button className="flex flex-col items-start p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-violet-500/30 transition-all group text-left">
                <LayoutDashboard className="text-white mb-3" size={24} />
                <h4 className="text-white font-semibold text-sm">WordPress / CMS</h4>
                <p className="text-xs text-slate-500 mt-1">Temaer og plugins</p>
              </button>

              {/* Shopify / E-com */}
              <button className="flex flex-col items-start p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-violet-500/30 transition-all group text-left">
                <ShoppingBag className="text-white mb-3" size={24} />
                <h4 className="text-white font-semibold text-sm">Shopify / E-com</h4>
                <p className="text-xs text-slate-500 mt-1">Liquid og assets</p>
              </button>

              {/* Vercel / Netlify / AWS */}
              <button className="flex flex-col items-start p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-violet-500/30 transition-all group text-left">
                <Server className="text-white mb-3" size={24} />
                <h4 className="text-white font-semibold text-sm">Hosting & Cloud</h4>
                <p className="text-xs text-slate-500 mt-1">Vercel, AWS, cPanel</p>
              </button>
            </div>
          </div>

          {/* HØYRE SIDE: Den universelle opplastingen */}
          <div className="lg:col-span-2 space-y-4 flex flex-col">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2 mb-3">Eller last opp fil</h3>
            
            <label className="w-full flex-1 flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-950/50 border-2 border-dashed border-white/10 hover:border-violet-500/50 hover:bg-violet-500/5 cursor-pointer transition-all group relative min-h-[200px]">
              <input type="file" className="hidden" onChange={handleFileUpload} />
              
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="text-violet-400 animate-spin" size={28} />
                  <span className="text-xs text-slate-400 font-medium">Laster opp...</span>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <UploadCloud className="text-slate-400 group-hover:text-violet-400 transition-colors" size={24} />
                  </div>
                  <h4 className="text-white font-semibold text-sm mb-2">Slipp filen her</h4>
                  <p className="text-xs text-slate-500 text-center max-w-[150px]">
                    Fungerer med alle typer kodespråk og filtyper
                  </p>
                </>
              )}
            </label>
          </div>
        </div>

        {/* Visning av opplastede filer */}
        {uploadedFiles.length > 0 && (
          <div className="mb-2 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={18} />
            <div>
              <h4 className="text-emerald-400 text-sm font-bold mb-1">Filer klar for analyse</h4>
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((file, i) => (
                  <span key={i} className="text-xs text-emerald-300/80 bg-emerald-500/10 px-2 py-1 rounded-md flex items-center gap-1.5">
                    <FileCode size={12} /> {file}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Navigasjon */}
        <div className="flex items-center justify-between pt-6 border-t border-white/10 mt-6">
          <button onClick={onSkip} className="text-sm font-medium text-slate-500 hover:text-white transition-colors">
            Hopp over og fullfør senere
          </button>
          
          <button 
            onClick={onNext}
            className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${
              uploadedFiles.length > 0 
                ? 'bg-violet-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:bg-violet-400' 
                : 'bg-white/5 text-slate-400 cursor-not-allowed'
            }`}
          >
            Fortsett til Dashboard
          </button>
        </div>

      </div>
    </div>
  );
};