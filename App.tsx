import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient'; 
import { 
  ArrowRight, Check, Search, Zap, Target, ChevronDown, Menu, X, Sparkles, 
  MousePointer2, TrendingUp, Cpu, Globe, Activity, ArrowUpRight, User, 
  SearchIcon, TrendingDown, Clock, AlertTriangle, MessageCircle, HelpCircle, 
  Home, Linkedin, Twitter, Mail, ShieldCheck, Wrench, Globe2, Stars, Frown, 
  Layers, BarChart3, Rocket, Shield, Lightbulb, Monitor, HeartHandshake, 
  BrainCircuit, BarChart4, SearchCheck, Database, Server
} from 'lucide-react';

// --- GLOBAL SMART LOGIN FUNKSJON ---
export const handleLogin = async () => {
  console.log("Sjekker status..."); 
  
  if (!supabase) {
    alert("Supabase mangler oppsett i supabaseClient.ts");
    return;
  }

  // 1. SJEKK OM BRUKER ALLEREDE ER INNE
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    console.log("Bruker er allerede logget inn. Sender til Priser/Stripe...");
    
    // Prøv å finne Pris-seksjonen
    const pricingSection = document.getElementById('priser');
    
    if (pricingSection) {
      // Scroll mykt ned til prisene
      pricingSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      // Fallback: Hvis vi ikke finner ID-en, prøv å scrolle til bunnen eller gi beskjed
      console.log("Fant ikke id='priser'. Scroller til 70% av siden.");
      window.scrollTo({ top: document.body.scrollHeight * 0.7, behavior: 'smooth' });
    }
    return; // STOPP HER. Ikke start Google-login på nytt.
  }

  // 2. HVIS IKKE LOGGET INN -> KJØR GOOGLE LOGIN
  console.log("Bruker ikke logget inn. Starter OAuth...");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/srth/'
    }
  });

  if (error) {
    console.error("Supabase Error:", error);
    alert("Feil: " + error.message);
  }
};

// --- Helper Component for Scroll Reveal ---
interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'scale';
  className?: string;
}

const RevealOnScroll: React.FC<RevealProps> = ({ children, delay = 0, direction = 'up', className = "" }) => {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) setIsVisible(true);
      });
    }, { threshold: 0.1 });
    
    if (domRef.current) observer.observe(domRef.current);
    return () => domRef.current && observer.unobserve(domRef.current);
  }, []);

  return (
    <div ref={domRef} className={`reveal reveal-${direction} ${isVisible ? 'visible' : ''} ${className}`} style={{ transitionDelay: isVisible ? `${delay}ms` : '0ms' }}>
      {children}
    </div>
  );
};

// --- Decorative Background Elements ---
const GlobalDecorations = () => {
  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
      <div className="absolute top-[2%] left-[10%] w-[40rem] h-[40rem] bg-violet-400/10 rounded-full blur-[160px] animate-mesh"></div>
      <div className="absolute bottom-[5%] right-[2%] w-[45rem] h-[45rem] bg-indigo-400/10 rounded-full blur-[180px] animate-mesh" style={{ animationDelay: '-12s' }}></div>
      <div className="absolute top-[40%] right-[15%] w-[35rem] h-[35rem] bg-fuchsia-400/5 rounded-full blur-[140px] animate-mesh" style={{ animationDelay: '-6s' }}></div>
      <div className="absolute bottom-[30%] left-[-10%] w-[30rem] h-[30rem] bg-blue-400/5 rounded-full blur-[120px] animate-mesh" style={{ animationDelay: '-18s' }}></div>
      <div className="absolute inset-0 grid-pattern opacity-[0.03] pointer-events-none"></div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[100vw] h-[50vh] bg-gradient-to-b from-violet-50/5 to-transparent blur-[100px]"></div>
    </div>
  );
};

// --- TECHNOLOGY VIEW COMPONENTS ---

const TechnologyHero = () => (
  <section className="relative pt-24 pb-16 md:pt-48 md:pb-32 overflow-hidden bg-white/40">
    <div className="max-w-5xl mx-auto px-5 text-center relative z-10">
      <RevealOnScroll direction="down">
        <h1 className="text-3xl sm:text-4xl md:text-7xl font-black text-slate-950 mb-6 md:mb-8 leading-[1.05] tracking-tight">
          Teknologien som setter din <br className="hidden md:block" />
          <span className="text-violet-600">bedrift på kartet.</span>
        </h1>
        <p className="text-base sm:text-lg md:text-2xl text-slate-600 font-medium leading-relaxed max-w-3xl mx-auto mb-12 md:mb-16">
          Vi kombinerer menneskelig strategi med AI-prosessering for å levere resultater tradisjonelle byråer ikke kan matche.
        </p>
      </RevealOnScroll>

      <RevealOnScroll direction="up" delay={200} className="max-w-4xl mx-auto">
        <div className="relative p-1.5 sm:p-2 bg-slate-950 rounded-[28px] sm:rounded-[40px] shadow-2xl overflow-hidden">
          <div className="bg-white rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 md:p-10 border border-white/20 relative overflow-hidden h-[240px] sm:h-[350px] md:h-[450px]">
            <div className="flex justify-between items-center mb-6 sm:mb-8">
              <div className="flex gap-1.5 sm:gap-2">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-rose-400"></div>
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-400"></div>
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-400"></div>
              </div>
              <div className="h-4 sm:h-6 w-20 sm:w-32 bg-slate-100 rounded-full"></div>
            </div>
            <div className="grid grid-cols-12 gap-2 sm:gap-4">
              <div className="col-span-4 h-24 sm:h-32 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100 p-2 sm:p-4">
                <div className="h-1.5 sm:h-2 w-8 sm:w-12 bg-slate-200 rounded mb-1.5 sm:mb-2"></div>
                <div className="h-3 sm:h-4 w-12 sm:w-20 bg-violet-200 rounded"></div>
              </div>
              <div className="col-span-8 h-24 sm:h-32 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100 flex items-end p-2 sm:p-4 gap-1 sm:gap-2">
                {[40, 70, 45, 90, 65, 80, 50, 95].map((h, i) => (
                  <div key={i} className="flex-1 bg-violet-100 rounded-t" style={{ height: `${h}%` }}></div>
                ))}
              </div>
              <div className="col-span-12 h-32 sm:h-48 bg-slate-50 rounded-[20px] sm:rounded-3xl border border-slate-100"></div>
            </div>
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-20">
              <div className="w-full h-1 bg-violet-500/40 shadow-[0_0_25px_4px_rgba(124,58,237,0.6)] animate-scan-tech"></div>
              <div className="w-full h-20 bg-gradient-to-b from-violet-500/5 to-transparent absolute top-0 animate-scan-area-tech"></div>
            </div>
          </div>
        </div>
      </RevealOnScroll>
    </div>
    
    <style dangerouslySetInnerHTML={{ __html: `
      @keyframes scan-tech {
        0% { transform: translateY(-50px); }
        100% { transform: translateY(500px); }
      }
      @keyframes scan-area-tech {
        0% { transform: translateY(-100%); opacity: 0; }
        20% { opacity: 1; }
        100% { transform: translateY(500px); opacity: 0; }
      }
      .animate-scan-tech { animation: scan-tech 4s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
      .animate-scan-area-tech { animation: scan-area-tech 4s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
    `}} />
  </section>
);

const FeatureMatrix = () => (
  <section className="py-16 sm:py-32 bg-transparent relative overflow-hidden">
    {/* Subtle Animated Background Blobs */}
    <div className="absolute inset-0 pointer-events-none -z-10">
      <div className="absolute top-0 -left-24 w-[40rem] h-[40rem] bg-violet-200/20 rounded-full blur-[120px] animate-blob-slow"></div>
      <div className="absolute bottom-0 -right-24 w-[35rem] h-[35rem] bg-indigo-200/20 rounded-full blur-[140px] animate-blob-slow" style={{ animationDelay: '-5s' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.05] grid-pattern"></div>
    </div>

    <div className="max-w-6xl mx-auto px-5 relative z-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-12">
        <RevealOnScroll direction="left">
          <div className="premium-card p-8 sm:p-10 rounded-[32px] sm:rounded-[40px] h-full flex flex-col group backdrop-blur-xl">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-100 rounded-xl sm:rounded-2xl flex items-center justify-center mb-6 group-hover:bg-violet-600 group-hover:text-white transition-all duration-500">
              <Wrench size={24} />
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-950 mb-4">Teknisk Overvåkning</h3>
            <p className="text-sm sm:text-base text-slate-500 font-medium leading-relaxed mb-6">
              Vi overvåker alt fra PageSpeed og 404-feil til Core Web Vitals. Vårt system varsler oss umiddelbart hvis noe hindrer Google i å lese siden din optimalt.
            </p>
            <div className="mt-auto flex flex-wrap gap-2">
              <span className="px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-full text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Basic</span>
              <span className="px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-full text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Standard</span>
            </div>
          </div>
        </RevealOnScroll>

        <RevealOnScroll direction="right">
          <div className="premium-card p-8 sm:p-10 rounded-[32px] sm:rounded-[40px] h-full flex flex-col group backdrop-blur-xl">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-100 rounded-xl sm:rounded-2xl flex items-center justify-center mb-6 group-hover:bg-violet-600 group-hover:text-white transition-all duration-500">
              <Globe2 size={24} />
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-950 mb-4">Search Console Data</h3>
            <p className="text-sm sm:text-base text-slate-500 font-medium leading-relaxed mb-6">
              Ingen gjetting – bare rådata. Vi integrerer direkte med Search Console for å analysere dine faktiske klikk, visninger og CTR for å finne uutnyttet potensiale.
            </p>
            <div className="mt-auto flex flex-wrap gap-2">
              <span className="px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-full text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Basic</span>
              <span className="px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-full text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Standard</span>
            </div>
          </div>
        </RevealOnScroll>
      </div>

      <RevealOnScroll direction="up" className="mb-6 sm:mb-12">
        <div className="p-1 rounded-[36px] sm:rounded-[44px] bg-gradient-to-r from-violet-500 to-indigo-600 shadow-2xl shadow-violet-200/50">
          <div className="bg-white p-6 sm:p-12 md:p-16 rounded-[35px] sm:rounded-[43px] text-center relative overflow-hidden backdrop-blur-sm">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-violet-100/40 rounded-full blur-3xl"></div>
            <div className="relative z-10 max-w-3xl mx-auto">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-violet-600 rounded-2xl sm:rounded-[28px] flex items-center justify-center mx-auto mb-6 sm:mb-8 shadow-xl text-white">
                <Cpu size={32} />
              </div>
              <h3 className="text-2xl sm:text-3xl md:text-5xl font-black text-slate-950 mb-4 sm:mb-6 tracking-tight">AI-Optimalisering i Sanntid</h3>
              <p className="text-sm sm:text-lg md:text-xl text-slate-600 font-medium leading-relaxed mb-8 sm:mb-10">
                Vår AI-drevne innholdsmotor skanner algoritme-endringer og automatiserer genereringen av meta-titler og beskrivelser som "snakker" direkte med Googles semantiske hjerte.
              </p>
              <div className="flex justify-center gap-3 sm:gap-4">
                <span className="px-3 sm:px-4 py-1.5 bg-violet-50 border border-violet-100 rounded-full text-[9px] sm:text-xs font-black text-violet-600 uppercase">Standard</span>
                <span className="px-3 sm:px-4 py-1.5 bg-violet-50 border border-violet-100 rounded-full text-[9px] sm:text-xs font-black text-violet-600 uppercase">Premium</span>
              </div>
            </div>
          </div>
        </div>
      </RevealOnScroll>

      <RevealOnScroll direction="up">
        <div className="bg-slate-950 p-8 sm:p-16 rounded-[36px] sm:rounded-[48px] text-white relative overflow-hidden group">
          <div className="absolute inset-0 grid-pattern opacity-10"></div>
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-violet-600/20 rounded-full blur-[120px] pointer-events-none"></div>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-center relative z-10 text-center lg:text-left">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-violet-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mb-6 sm:mb-8 border border-white/10">
                <Stars size={12} />
                <span>Eksklusivt for Premium</span>
              </div>
              <h3 className="text-2xl sm:text-3xl md:text-5xl font-black mb-4 sm:mb-6 leading-tight">Full Markedsanalyse & <br className="hidden sm:block" /> Strategi</h3>
              <p className="text-slate-400 text-sm sm:text-lg md:text-xl font-medium leading-relaxed mb-8">
                Vår mest avanserte pakke gir deg strategisk overtak. Vi utfører dyp konkurrentanalyse hvor AI-en dekoder hvorfor konkurrentene rangerer.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-left">
                {[
                  "Konkurrentanalyse (AI-basert)",
                  "Innholdsplaner & Bloggideer",
                  "Avansert intern lenkestruktur",
                  "Månedlig strategimøte"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5 sm:gap-3 text-xs sm:text-sm font-bold">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-violet-600 flex items-center justify-center shrink-0">
                      <Check size={10} />
                    </div>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-5 flex justify-center mt-8 lg:mt-0">
              <div className="relative">
                <div className="absolute inset-0 bg-violet-500/30 blur-[60px] sm:blur-[80px] rounded-full"></div>
                <div className="relative p-6 sm:p-8 bg-white/5 border border-white/10 rounded-[32px] sm:rounded-[40px] shadow-2xl backdrop-blur-md text-center">
                  <Target size={48} className="text-violet-400 mx-auto mb-4 sm:mb-6" />
                  <div className="text-xl sm:text-2xl font-black mb-2">Markedsdominans</div>
                  <div className="text-slate-500 text-[10px] sm:text-sm font-bold uppercase tracking-widest">Aktiv overvåking</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </RevealOnScroll>
    </div>
  </section>
);

const DashboardSection = () => (
  <section className="py-16 sm:py-32 bg-slate-50/50 border-y border-slate-100 relative overflow-hidden">
    <div className="max-w-6xl mx-auto px-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <RevealOnScroll direction="left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 text-violet-600 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mb-4 sm:mb-6 border border-violet-100">
            <Sparkles size={11} />
            <span>Handling foran data</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-black text-slate-950 mb-6 sm:mb-8 leading-[1.05] tracking-tight">
            Strategisk Oversikt: <br />
            <span className="text-violet-600">Din AI-Strateg.</span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-slate-600 font-medium leading-relaxed mb-10 sm:mb-12">
            Vi har fjernet kompliserte grafer og erstattet dem med krystallklare instruksjoner. Begynn å utføre handlinger som gir resultater.
          </p>
          <div className="space-y-6 sm:space-y-8">
            {[
              { 
                title: "Smart Tolkning", 
                desc: "AI-en oversetter rådata til menneskelig språk.", 
                icon: <MessageCircle className="text-violet-600" />,
                example: "AI-tips: 'Innholdet om Varmepumper mister terreng. Legg til en seksjon om energisparing.'"
              },
              { 
                title: "ROI-Prioritering", 
                desc: "Vi fokuserer kun på det som faktisk gir deg flere kunder.", 
                icon: <TrendingUp className="text-violet-600" /> 
              },
              { 
                title: "Konkurrent-Radar", 
                desc: "Vår radar overvåker markedet 24/7 og varsler deg umiddelbart.", 
                icon: <Activity className="text-violet-600" /> 
              }
            ].map((item, i) => (
              <div key={i} className="flex gap-4 sm:gap-6 group">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white shadow-md flex items-center justify-center shrink-0 border border-slate-100 group-hover:scale-110 transition-transform duration-500">
                  {React.cloneElement(item.icon as React.ReactElement<any>, { size: 20 })}
                </div>
                <div>
                  <h4 className="text-lg sm:text-xl font-bold text-slate-950 mb-1.5 sm:mb-2">{item.title}</h4>
                  <p className="text-xs sm:text-base text-slate-500 font-medium leading-relaxed mb-3">{item.desc}</p>
                  {item.example && (
                    <div className="inline-block p-3 sm:p-4 bg-violet-50 border-l-4 border-violet-500 rounded-r-xl italic text-[10px] sm:text-sm text-violet-700 font-bold">
                      {item.example}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </RevealOnScroll>
        
        <RevealOnScroll direction="scale" className="relative h-full flex items-center justify-center mt-12 lg:mt-0">
          <div className="relative w-full max-w-sm sm:max-w-lg aspect-[4/5] bg-white/40 rounded-[36px] sm:rounded-[48px] border border-white/50 shadow-2xl backdrop-blur-md p-6 sm:p-8 overflow-hidden">
            <div className="flex items-center justify-between mb-8 sm:mb-10">
               <div className="flex items-center gap-2.5 sm:gap-3">
                 <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-950 rounded-xl sm:rounded-2xl flex items-center justify-center text-white font-black text-sm sm:text-base">S</div>
                 <div>
                   <div className="text-[10px] sm:text-xs font-black text-slate-900 uppercase">AI Strategi-strøm</div>
                   <div className="text-[8px] sm:text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                     <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div> Aktiv Analyse
                   </div>
                 </div>
               </div>
               <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100"><Search size={12} className="text-slate-400" /></div>
            </div>

            <div className="space-y-4 sm:space-y-6">
               <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm animate-fade-in" style={{ animationDelay: '0.2s' }}>
                 <div className="flex gap-3 sm:gap-4 mb-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-violet-50 flex items-center justify-center text-violet-600 shrink-0"><Zap size={16} /></div>
                    <div>
                      <div className="text-[10px] sm:text-xs font-black text-slate-900 mb-1">Innholds-optimalisering</div>
                      <div className="text-[8px] sm:text-[10px] text-slate-400 font-medium uppercase tracking-wider">Høy prioritet · +15% ROI</div>
                    </div>
                 </div>
                 <p className="text-[10px] sm:text-xs text-slate-600 font-medium leading-relaxed">
                   "Oppdater 'Tjenester'-siden med søkeordet <span className="text-violet-600 font-bold">SEO-byrå Oslo</span>."
                 </p>
               </div>

               <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm animate-fade-in" style={{ animationDelay: '0.4s' }}>
                 <div className="flex gap-3 sm:gap-4 mb-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0"><Target size={16} /></div>
                    <div>
                      <div className="text-[10px] sm:text-xs font-black text-slate-900 mb-1">Markeds-radar</div>
                      <div className="text-[8px] sm:text-[10px] text-slate-400 font-medium uppercase tracking-wider">Aktiv varsling</div>
                    </div>
                 </div>
                 <p className="text-[10px] sm:text-xs text-slate-600 font-medium leading-relaxed">
                   "Konkurrent A har lansert en ny bloggserie. Vi har generert 3 mot-strategier."
                 </p>
               </div>

               <div className="bg-slate-950 p-5 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl animate-fade-in relative overflow-hidden" style={{ animationDelay: '0.6s' }}>
                 <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/20 rounded-full blur-2xl"></div>
                 <div className="flex gap-3 sm:gap-4 mb-3 relative z-10">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/10 flex items-center justify-center text-violet-400 shrink-0"><Sparkles size={16} /></div>
                    <div>
                      <div className="text-[10px] sm:text-xs font-black text-white mb-1">Neste handling</div>
                      <div className="text-[8px] sm:text-[10px] text-slate-400 font-medium uppercase tracking-wider">Anbefalt av AI</div>
                    </div>
                 </div>
                 <div className="text-[11px] sm:text-sm text-white font-bold leading-relaxed relative z-10">
                   "Start optimalisering av produktsider for å øke konvertering."
                 </div>
                 <div className="mt-4 pt-4 border-t border-white/10 flex justify-end relative z-10">
                    <button className="text-[9px] sm:text-[10px] font-black text-violet-400 hover:text-white transition-colors flex items-center gap-1.5 uppercase tracking-widest">
                      Utfør nå <ArrowRight size={10} />
                    </button>
                 </div>
               </div>
            </div>
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-violet-200/40 rounded-full blur-[100px] pointer-events-none"></div>
          </div>
        </RevealOnScroll>
      </div>
    </div>
  </section>
);

const ComparisonTable = () => {
  const features = [
    { name: "Teknisk SEO-analyse", basic: true, standard: true, premium: true },
    { name: "PageSpeed Overvåkning", basic: true, standard: true, premium: true },
    { name: "Google Search Console Data", basic: true, standard: true, premium: true },
    { name: "Innholdsoptimalisering (AI)", basic: false, standard: true, premium: true },
    { name: "Rank Tracking", basic: false, standard: true, premium: true },
    { name: "Konkurrentanalyse (AI)", basic: false, standard: true, premium: true },
    { name: "Innholdsplaner & Bloggideer", basic: false, standard: true, premium: true },
    { name: "Avansert Lenkestruktur", basic: false, standard: true, premium: true },
    { name: "Prioritert Support", basic: false, standard: false, premium: true },
  ];

  return (
    <section className="py-16 sm:py-32 bg-white">
      <div className="max-w-6xl mx-auto px-5">
        <RevealOnScroll direction="up">
          <div className="text-center mb-12 sm:mb-24">
            <h2 className="text-2xl sm:text-4xl md:text-6xl font-black text-slate-950 mb-4 sm:mb-6 tracking-tighter">Sammenlign våre planer</h2>
            <p className="text-sm sm:text-lg text-slate-500 font-medium">Finn pakken som passer din bedrifts ambisjon.</p>
          </div>
        </RevealOnScroll>

        <div className="relative">
          <div className="overflow-x-auto pb-4 scrollbar-hide">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-6 sm:py-8 text-base sm:text-xl font-black text-slate-950 w-1/3">Funksjon</th>
                  <th className="py-6 sm:py-8 text-center text-slate-950">
                    <div className="text-[9px] sm:text-xs font-black text-slate-400 uppercase mb-1 sm:mb-2">Basic</div>
                    <div className="text-lg sm:text-2xl font-black">599,-</div>
                  </th>
                  <th className="py-6 sm:py-8 text-center text-slate-950">
                    <div className="text-[9px] sm:text-xs font-black text-slate-400 uppercase mb-1 sm:mb-2">Standard</div>
                    <div className="text-lg sm:text-2xl font-black">1 499,-</div>
                  </th>
                  <th className="py-6 sm:py-8 text-center text-slate-950">
                    <div className="text-[9px] sm:text-xs font-black text-slate-400 uppercase mb-1 sm:mb-2">Premium</div>
                    <div className="text-lg sm:text-2xl font-black">4 999,-</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {features.map((f, i) => (
                  <tr key={i} className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 sm:py-6 font-bold text-slate-700 text-xs sm:text-base">{f.name}</td>
                    <td className="py-4 sm:py-6 text-center">
                      {f.basic ? <Check className="mx-auto text-emerald-500" size={18} /> : <div className="mx-auto w-4 sm:w-5 h-0.5 bg-slate-200"></div>}
                    </td>
                    <td className="py-4 sm:py-6 text-center">
                      {f.standard ? <Check className="mx-auto text-emerald-500" size={18} /> : <div className="mx-auto w-4 sm:w-5 h-0.5 bg-slate-200"></div>}
                    </td>
                    <td className="py-4 sm:py-6 text-center bg-violet-50/10 group-hover:bg-violet-50/20 transition-all">
                      {f.premium ? <Check className="mx-auto text-violet-600" size={18} /> : <div className="mx-auto w-4 sm:w-5 h-0.5 bg-slate-200"></div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden flex justify-center items-center gap-2 mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest animate-pulse">
            <ArrowRight size={10} className="rotate-0" />
            <span>Sveip for å se mer</span>
            <ArrowRight size={10} className="rotate-180" />
          </div>
        </div>
      </div>
    </section>
  );
};

// --- HOME PAGE COMPONENTS ---

const Hero = () => {
  return (
    <section className="relative pt-24 pb-16 sm:pt-32 sm:pb-28 md:pt-44 md:pb-60 hero-gradient overflow-hidden">
      <div className="absolute top-1/4 -left-12 hidden xl:block animate-float-subtle opacity-20 pointer-events-none">
        <div className="p-5 bg-white rounded-[2rem] shadow-2xl border border-violet-100 rotate-12">
          <SearchIcon size={48} className="text-violet-600" />
        </div>
      </div>
      <div className="absolute bottom-1/4 -right-16 hidden xl:block animate-float-subtle opacity-20 pointer-events-none" style={{ animationDelay: '2s' }}>
        <div className="p-5 bg-white rounded-[2rem] shadow-2xl border border-violet-100 -rotate-12">
          <TrendingUp size={48} className="text-violet-600" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 sm:px-6 text-center relative z-10">
        <RevealOnScroll direction="down" delay={100}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/50 backdrop-blur-md text-violet-600 text-[9px] sm:text-[10px] font-bold mb-6 sm:mb-10 border border-violet-100/50 uppercase tracking-widest shadow-sm">
            <Sparkles size={11} className="fill-current" />
            <span>AI-drevet SEO for vekst</span>
          </div>
        </RevealOnScroll>
        <RevealOnScroll direction="up" delay={200}>
          <h1 className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter text-slate-950 mb-6 sm:mb-10 max-w-5xl mx-auto leading-[1.1] md:leading-[0.9]">
            Ranger høyere på Google <span className="text-violet-600 font-script font-normal relative inline-block px-1 lowercase">automatisk.</span>
          </h1>
        </RevealOnScroll>
        <RevealOnScroll direction="up" delay={300}>
          <p className="text-sm sm:text-lg md:text-xl mb-10 sm:mb-14 max-w-2xl mx-auto leading-relaxed font-semibold tracking-tight animate-subtext-dynamic px-2 opacity-90">
            For bedrifter som vil bli mer synlige og få flere kunder gjennom Google.
          </p>
        </RevealOnScroll>
        <RevealOnScroll direction="scale" delay={400}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#priser" className="group w-full sm:w-auto px-10 py-4 sm:px-12 sm:py-5 bg-slate-950 text-white rounded-full text-base sm:text-lg font-black tracking-tight hover:bg-violet-600 hover:scale-105 hover:shadow-2xl hover:shadow-violet-500/30 transition-all duration-500 flex items-center justify-center gap-3 active:scale-95 shadow-xl shadow-slate-200">
              Begynn nå <ArrowRight size={22} className="transition-transform duration-300 group-hover:translate-x-1.5" />
            </a>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
};

const DashboardPreview = () => (
  <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-8 sm:-mt-20 md:-mt-32 relative z-20">
    <RevealOnScroll direction="scale" delay={200}>
      <div className="relative group">
        <div className="bg-white/40 p-1 rounded-[24px] sm:rounded-[32px] border border-white shadow-[0_40px_80px_-20px_rgba(0,0,0,0.12)] backdrop-blur-md overflow-hidden relative">
          
          {/* Enhanced AI processing background animation - KEEPING AS IS */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40 z-0">
            <div className="absolute inset-0 grid-pattern opacity-10"></div>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-violet-500/30 to-transparent animate-scan-tech"></div>
            <div className="absolute top-[40%] left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent animate-scan-tech" style={{ animationDelay: '1.5s', animationDuration: '6s' }}></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[600px] h-[600px] bg-violet-400/5 rounded-full blur-[120px] animate-pulse"></div>
            </div>
            {[...Array(8)].map((_, i) => (
              <div 
                key={i}
                className="absolute w-1 h-1 bg-violet-400 rounded-full blur-sm animate-float-particle"
                style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${5 + Math.random() * 5}s`
                }}
              ></div>
            ))}
          </div>

          <div className="bg-white rounded-[20px] sm:rounded-[28px] flex overflow-hidden h-[320px] sm:h-[500px] md:h-[650px] shadow-sm border border-slate-100/50 relative z-10">
            
            {/* 1. New Sidebar for density */}
            <div className="hidden sm:flex flex-col w-12 sm:w-16 border-r border-slate-100 bg-white pt-4 items-center gap-4 shrink-0">
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold text-xs mb-4">S</div>
                {[Home, Activity, Layers, User, Wrench].map((Icon, i) => (
                    <div key={i} className={`p-2 rounded-lg ${i === 0 ? 'bg-violet-50 text-violet-600' : 'text-slate-300 hover:text-slate-600'}`}>
                        <Icon size={18} />
                    </div>
                ))}
            </div>

            <div className="flex-1 flex flex-col bg-slate-50/30 overflow-hidden">
              {/* Header */}
              <div className="h-12 md:h-16 border-b border-slate-100 bg-white flex items-center justify-between px-4 md:px-8 shrink-0">
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="sm:hidden w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold text-sm">S</div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">Oversikt Dashboard</h3>
                    <p className="text-[10px] text-slate-400 font-medium hidden sm:block">Sist oppdatert: Akkurat nå</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 rounded-full border border-emerald-100">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-[9px] font-bold text-emerald-600 uppercase">System Normal</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden md:flex gap-4 mr-4">
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] text-slate-400 font-bold uppercase">Nettside helse</span>
                            <span className="text-xs font-black text-slate-900">98.5%</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] text-slate-400 font-bold uppercase">Aktive søkeord</span>
                            <span className="text-xs font-black text-slate-900">2,341</span>
                        </div>
                    </div>
                    <div className="w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-400 relative">
                        <div className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></div>
                        <MessageCircle size={14} />
                    </div>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                
                {/* Row 1: KPI Cards (Dense) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                    {[
                        { l: "Total Trafikk", v: "124.5k", c: "text-violet-600", g: "+12%" },
                        { l: "Synlighet", v: "89.2%", c: "text-emerald-600", g: "+4.1%" },
                        { l: "Domene Autoritet", v: "54", c: "text-amber-600", g: "+1" },
                        { l: "Tekniske Feil", v: "0", c: "text-slate-900", g: "-2" },
                    ].map((kpi, i) => (
                        <div key={i} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between h-20 sm:h-24">
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{kpi.l}</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${kpi.g.startsWith('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-600'}`}>{kpi.g}</span>
                            </div>
                            <span className={`text-lg sm:text-2xl font-black ${kpi.c}`}>{kpi.v}</span>
                            <div className="h-1 w-full bg-slate-50 rounded-full overflow-hidden">
                                <div className="h-full bg-current opacity-20 w-2/3"></div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Row 2: Main Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  
                  {/* Score Card (Detailed) */}
                  <div className="md:col-span-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide">SEO Scorecard</h4>
                        <Wrench size={14} className="text-slate-300" />
                    </div>
                    <div className="flex items-center gap-6 mb-6">
                        <div className="relative">
                            <svg className="w-20 h-20 transform -rotate-90">
                                <circle cx="50%" cy="50%" r="40%" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-50" />
                                <circle cx="50%" cy="50%" r="40%" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-violet-500" strokeDasharray="200" strokeDashoffset="30" />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-xl font-black text-slate-900">85</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 flex-1">
                            {["Teknisk", "Innhold", "Lenker"].map((l, i) => (
                                <div key={i} className="flex flex-col gap-1">
                                    <div className="flex justify-between text-[9px] font-bold text-slate-500">
                                        <span>{l}</span>
                                        <span>{90 - i*5}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                                        <div className="h-full bg-slate-800 rounded-full" style={{width: `${90 - i*5}%`}}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="mt-auto border-t border-slate-50 pt-3 flex justify-between items-center">
                        <span className="text-[10px] text-slate-400 font-medium">Neste scan om 2t 14m</span>
                        <button className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded-md">Scan Nå</button>
                    </div>
                  </div>

                  {/* Chart Card (Detailed) */}
                  <div className="md:col-span-8 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col relative overflow-hidden">
                    <div className="flex justify-between items-center mb-4 z-10">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Trafikk Analyse</h4>
                        <div className="flex gap-2 text-[9px] text-slate-400 font-medium mt-0.5">
                            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-violet-500"></div> Organisk</span>
                            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div> Direkte</span>
                        </div>
                      </div>
                      <div className="flex gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
                        {["1U", "1M", "3M", "1Å"].map((t, i) => (
                            <button key={i} className={`text-[9px] font-bold px-2 py-0.5 rounded ${i === 1 ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>{t}</button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1 relative min-h-[140px] border-b border-l border-slate-50">
                       {/* Grid lines */}
                       <div className="absolute inset-0 grid grid-rows-4 gap-0 pointer-events-none">
                           {[...Array(4)].map((_, i) => <div key={i} className="border-t border-slate-50 w-full h-full"></div>)}
                       </div>
                       <svg className="absolute inset-0 w-full h-full overflow-visible z-10" viewBox="0 0 800 200" preserveAspectRatio="none">
                         <defs>
                           <linearGradient id="chartGradientDense" x1="0%" y1="0%" x2="0%" y2="100%">
                             <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.1" />
                             <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
                           </linearGradient>
                         </defs>
                         <path d="M0 180 C 50 170, 100 140, 150 150 C 200 160, 250 120, 300 110 C 350 100, 400 130, 450 90 C 500 50, 550 60, 600 40 C 650 20, 700 30, 750 10 L 800 5" stroke="#7c3aed" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                         <path d="M0 180 C 50 170, 100 140, 150 150 C 200 160, 250 120, 300 110 C 350 100, 400 130, 450 90 C 500 50, 550 60, 600 40 C 650 20, 700 30, 750 10 L 800 200 L 0 200 Z" fill="url(#chartGradientDense)" />
                         
                         {/* Secondary Line */}
                         <path d="M0 190 C 80 180, 160 170, 240 180 C 320 190, 400 160, 480 150 C 560 140, 640 130, 720 120 L 800 110" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" fill="none" />
                       </svg>
                       {/* Tooltip Simulation */}
                       <div className="absolute top-[30%] left-[60%] bg-slate-900 text-white text-[9px] font-bold px-2 py-1 rounded shadow-xl transform -translate-x-1/2 -translate-y-full z-20">
                           2,451
                           <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                       </div>
                       <div className="absolute top-[30%] left-[60%] w-2 h-2 bg-violet-600 border-2 border-white rounded-full z-20 transform -translate-x-1/2 -translate-y-1/2"></div>
                    </div>
                  </div>
                </div>

                {/* Row 3: Bottom Density (New) */}
                <div className="grid grid-cols-3 gap-4 h-24 hidden sm:grid">
                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm overflow-hidden relative">
                        <h4 className="text-[9px] font-bold text-slate-400 uppercase mb-2">Topp Søkeord</h4>
                        <div className="space-y-1.5">
                            {[{w:"seo byrå", r:1}, {w:"digital markedsføring", r:3}].map((kw, i) => (
                                <div key={i} className="flex justify-between items-center text-[10px] font-medium border-b border-slate-50 pb-1">
                                    <span className="text-slate-700">{kw.w}</span>
                                    <span className="text-violet-600 font-bold">#{kw.r}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                        <h4 className="text-[9px] font-bold text-slate-400 uppercase mb-2">Core Web Vitals</h4>
                        <div className="flex items-end gap-2 h-10 mt-2">
                             {[
                                 {l:"LCP", v:80, c:"bg-emerald-400"}, 
                                 {l:"FID", v:95, c:"bg-emerald-400"}, 
                                 {l:"CLS", v:60, c:"bg-amber-400"}
                             ].map((m, i) => (
                                 <div key={i} className="flex-1 flex flex-col justify-end items-center gap-1">
                                     <div className={`w-full rounded-t-sm ${m.c}`} style={{height: `${m.v}%`}}></div>
                                     <span className="text-[8px] font-bold text-slate-400">{m.l}</span>
                                 </div>
                             ))}
                        </div>
                    </div>
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 shadow-sm overflow-hidden relative flex flex-col justify-center items-center text-center">
                        <div className="absolute inset-0 bg-violet-500/10 animate-pulse"></div>
                        <Activity size={20} className="text-violet-400 mb-2 relative z-10" />
                        <span className="text-[9px] font-bold text-slate-400 uppercase relative z-10">AI Agent</span>
                        <span className="text-[10px] font-black text-white relative z-10">Working...</span>
                    </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </RevealOnScroll>
    <style dangerouslySetInnerHTML={{ __html: `
      @keyframes float-particle {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: 0; }
        50% { transform: translate(20px, -40px) scale(1.5); opacity: 0.6; }
      }
      .animate-float-particle { animation: float-particle ease-in-out infinite; }
    `}} />
  </div>
);

// --- DEEP DIVE (GEO) COMPONENTS ---

const DeepDiveHero = () => (
  <section className="relative pt-24 pb-12 md:pt-48 md:pb-32 overflow-hidden bg-white/40">
    <div className="max-w-4xl mx-auto px-5 text-center relative z-10">
      <RevealOnScroll direction="down">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mb-4 sm:mb-6 border border-emerald-100">
          <Check size={11} />
          <span>Din vei til toppen</span>
        </div>
        <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-slate-950 mb-6 sm:mb-8 leading-[1.05] tracking-tight">
          Fra Usynlig til <br className="hidden sm:block" />
          <span className="text-violet-600">Markedsledende.</span>
        </h1>
        <p className="text-base sm:text-lg md:text-2xl text-slate-600 font-medium leading-relaxed max-w-2xl mx-auto mb-10">
          Å se på prosessen ware er det første steget. <span className="text-slate-900 font-bold underline decoration-violet-300">Google-dominans</span> er matematikk og AI i samspill.
        </p>
      </RevealOnScroll>
    </div>
  </section>
);

const PainPointData = () => (
  <section className="py-16 sm:py-24 bg-slate-950 text-white relative overflow-hidden">
    <div className="absolute top-0 left-0 w-full h-full grid-pattern opacity-10 pointer-events-none"></div>
    <div className="max-w-6xl mx-auto px-5 relative z-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <RevealOnScroll direction="left">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-extrabold leading-tight text-center lg:text-left">
            Prisen på å <br className="hidden lg:block" />
            <span className="text-rose-500 font-black">ikke bli funnet.</span>
          </h2>
          <div className="mt-10 sm:mt-12 space-y-8 sm:space-y-10">
            <div className="flex gap-4 sm:gap-6 items-start">
              <div className="text-4xl sm:text-5xl md:text-7xl font-black text-rose-500 shrink-0">90%</div>
              <div>
                <h4 className="text-lg sm:text-xl font-bold mb-1 sm:mb-2">får 0 trafikk.</h4>
                <p className="text-sm sm:text-base text-slate-400 font-medium leading-relaxed">De fleste bedrifter kaster bort penger på en digital fasade ingen ser.</p>
              </div>
            </div>
            <div className="flex gap-4 sm:gap-6 items-start">
              <div className="text-4xl sm:text-5xl md:text-7xl font-black text-violet-500 shrink-0">95%</div>
              <div>
                <h4 className="text-lg sm:text-xl font-bold mb-1 sm:mb-2">går til toppen.</h4>
                <p className="text-sm sm:text-base text-slate-400 font-medium leading-relaxed">Usynlighet koster bedrifter tapt omsetning hver eneste dag.</p>
              </div>
            </div>
          </div>
        </RevealOnScroll>
        <RevealOnScroll direction="right">
          <div className="bg-white/5 backdrop-blur-xl p-8 sm:p-10 rounded-[32px] sm:rounded-[48px] border border-white/10 shadow-3xl relative mt-8 lg:mt-0">
            <div className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 w-14 h-14 sm:w-20 sm:h-20 bg-rose-600 rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-2xl rotate-12">
              <AlertTriangle size={24} className="text-white sm:w-8 sm:h-8" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Hvert minutt teller.</h3>
            <p className="text-sm sm:text-base md:text-lg text-slate-300 leading-relaxed mb-6 sm:mb-8 font-medium">
              Mens du leser dette, søker potensielle kunder etter dine tjenester. De finner konkurrentene dine akkurat nå. 
            </p>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-3 p-3.5 sm:p-4 bg-white/5 rounded-xl sm:rounded-2xl border border-white/10">
                <Check className="text-emerald-500 shrink-0" size={16} />
                <span className="text-xs sm:text-sm font-semibold">Stopp blødningen av tapt omsetning</span>
              </div>
              <div className="flex items-center gap-3 p-3.5 sm:p-4 bg-white/5 rounded-xl sm:rounded-2xl border border-white/10">
                <Check className="text-emerald-500 shrink-0" size={16} />
                <span className="text-xs sm:text-sm font-semibold">Begynn din klatring i dag</span>
              </div>
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </div>
  </section>
);

const AiProcessDeepDive = () => (
  <section className="py-16 sm:py-32 bg-white">
    <div className="max-w-6xl mx-auto px-5">
      <div className="text-center mb-12 sm:mb-20">
        <RevealOnScroll direction="up">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-slate-950 mb-4 sm:mb-6 leading-tight">Fremtidens SEO (2026-Teknologi)</h2>
          <p className="text-sm sm:text-lg text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed">Vi bruker kraftige AI-modeller for å utkonkurrere markedet.</p>
        </RevealOnScroll>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 items-center">
        <RevealOnScroll direction="left">
          <div className="space-y-6 sm:space-y-8">
            <div className="group">
              <div className="flex items-center gap-4 mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-violet-50 rounded-xl sm:rounded-2xl flex items-center justify-center text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-all shrink-0">
                  <Cpu size={20} />
                </div>
                <h3 className="text-lg sm:text-xl font-bold">Autonome Analyser</h3>
              </div>
              <p className="text-sm sm:text-base text-slate-500 pl-14 sm:pl-16 font-medium leading-relaxed">Våre modeller skanner algoritme-endringer i sanntid og utfører 1000x flere beregninger.</p>
            </div>
            <div className="group">
              <div className="flex items-center gap-4 mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-violet-50 rounded-xl sm:rounded-2xl flex items-center justify-center text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-all shrink-0">
                  <Zap size={20} />
                </div>
                <h3 className="text-lg sm:text-xl font-bold">Lynrask Implementering</h3>
              </div>
              <p className="text-sm sm:text-base text-slate-500 pl-14 sm:pl-16 font-medium leading-relaxed">Vi identifiserer tekniske hull på sekunder og genererer optimalisert innhold umiddelbart.</p>
            </div>
          </div>
        </RevealOnScroll>
        <RevealOnScroll direction="right">
          <div className="p-1.5 sm:p-2 bg-slate-950 rounded-[28px] sm:rounded-[40px] shadow-2xl mt-8 md:mt-0">
            <div className="bg-white rounded-[24px] sm:rounded-[34px] p-6 sm:p-8 border border-slate-100">
               <div className="flex justify-between items-center mb-6 sm:mb-8">
                 <div className="text-sm sm:text-base font-black text-slate-900 uppercase">AI Prosessering</div>
                 <div className="text-[8px] sm:text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full font-bold">Aktiv</div>
               </div>
               <div className="space-y-4 sm:space-y-6">
                 {[
                   { label: "Søkeordsdybde", val: "98%" },
                   { label: "Overvåkning", val: "24/7" },
                   { label: "Innholds-skår", val: "9.2/10" }
                 ].map((stat, i) => (
                   <div key={i}>
                     <div className="flex justify-between text-[9px] sm:text-xs font-bold text-slate-400 mb-1.5 sm:mb-2 uppercase tracking-widest">{stat.label}<span>{stat.val}</span></div>
                     <div className="h-1.5 sm:h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-600 animate-draw-line" style={{ width: stat.val, animationDelay: `${i * 200}ms` }}></div>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </div>
  </section>
);

// --- SHARED COMPONENTS ---

const Pricing = ({ onSelectPlan }: { onSelectPlan?: (plan: string) => void }) => {
  const plans = [
    { 
      title: "⭐ BASIC", 
      price: "599", 
      tagline: "Få kontroll på grunnmuren.",
      desc: "Stopp tapet av kunder ved å fikse det tekniske fundamentet.",
      features: [
        "Automatisk teknisk SEO-analyse",
        "PageSpeed Optimalisering",
        "Search Console-integrasjon",
        "Månedlig resultatrapport"
      ]
    },
    { 
      title: "⭐⭐ STANDARD", 
      price: "1 499", 
      tagline: "Vekst og innholdsdominans.",
      highlighted: true,
      desc: "For bedrifter som aktivt vil klatre og knuse konkurrentene.",
      features: [
        "Alt i Basic +",
        "AI-drevet innholdsoptimalisering",
        "Ukentlig Rank Tracking",
        "SEO-helse overvåkning",
        "Ukentlige suksessrapporter"
      ]
    },
    { 
      title: "⭐⭐⭐ PREMIUM", 
      price: "4 999", 
      tagline: "Full automatisering og ROI.",
      desc: "Total dominans. We overtar hele SEO-arbeidet for maksimal vekst.",
      features: [
        "Alt i Standard +",
        "AI-drevet innholdsstrategi",
        "Dyp Konkurrentanalyse",
        "Avansert lenkeanalyse",
        "AI Forbedringsforslag (ukentlig)"
      ]
    }
  ];

  return (
    <section id="priser" className="py-16 sm:py-32 bg-slate-50 relative text-center">
      <div className="max-w-6xl mx-auto px-5">
        <div className="mb-12 sm:mb-20">
          <RevealOnScroll direction="up">
            <h2 className="text-2xl sm:text-4xl md:text-6xl font-black text-slate-950 mb-4 sm:mb-6 tracking-tight leading-tight">Velg din plan for dominans</h2>
            <p className="text-sm sm:text-lg text-slate-500 font-medium max-w-xl mx-auto leading-relaxed">Finn den strategien som passer din bedrifts ambisjon om å bli størst i markedet.</p>
          </RevealOnScroll>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-stretch">
          {plans.map((p, i) => (
            <RevealOnScroll key={i} direction="up" delay={i * 100}>
              <div className={`premium-card p-8 sm:p-10 rounded-[32px] sm:rounded-[44px] flex flex-col h-full bg-white relative overflow-hidden ${p.highlighted ? 'ring-2 sm:ring-4 ring-violet-500 shadow-2xl' : 'shadow-xl'}`}>
                {p.highlighted && <div className="absolute top-0 right-0 bg-violet-500 text-white text-[9px] sm:text-[10px] font-black py-1.5 px-4 sm:py-2 sm:px-6 rounded-bl-2xl sm:rounded-bl-3xl uppercase tracking-widest">Mest Populær</div>}
                <div className="mb-6 sm:mb-8 text-center sm:text-left">
                   <h3 className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1 sm:mb-2">{p.title}</h3>
                   <div className="text-4xl sm:text-5xl font-black text-slate-950 tracking-tighter mb-1 sm:mb-2">{p.price},-</div>
                   <div className="text-[9px] sm:text-xs font-bold text-slate-400 mb-4 sm:mb-6 uppercase">per måned eks. mva</div>
                   <p className="text-violet-600 font-bold mb-3 sm:mb-4 text-sm sm:text-base">{p.tagline}</p>
                   <p className="text-slate-500 text-xs sm:text-sm leading-relaxed font-medium">{p.desc}</p>
                </div>
                <div className="flex-1 space-y-3 sm:space-y-4 mb-8 sm:mb-10 text-left">
                  {p.features.map((f, j) => (
                    <div key={j} className="flex gap-2.5 sm:gap-3 text-xs sm:text-sm font-bold text-slate-700">
                      <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => onSelectPlan?.(p.title)}
                  className={`w-full py-4 sm:py-5 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg transition-all active:scale-95 shadow-lg ${p.highlighted ? 'bg-slate-950 text-white hover:bg-slate-800' : 'bg-violet-50 text-violet-600 hover:bg-violet-100 border border-violet-100'}`}
                >
                  Velg denne planen
                </button>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
};

const GeoFaq = () => {
  const [open, setOpen] = useState<number | null>(null);
  const faqs = [
    {
      q: "Hvor lang tid tar det før AI gir resultater?",
      a: "Med vår AI-prosess identifiserer vi kritiske tekniske feil på timer. De fleste kunder ser en signifikant økning i rangering innen 30-60 dager."
    },
    {
      q: "Hvorfor er Sikt overlegen byråer i 2026?",
      a: "Byråer bruker ofte utdaterte verktøy. Vår AI utfører sanntidsanalyser og konkurrentovervåkning 24/7 for å forutsi algoritme-endringer."
    },
    {
      q: "Hva er kostnaden ved å ikke ha en plan?",
      a: "For en bedrift i Norge betyr usynlighet at 95% av potensielle kunder ender hos en konkurrent. Dette koster ofte titusenvis hver eneste måned."
    }
  ];

  return (
    <section className="py-16 sm:py-32 bg-white">
      <div className="max-w-4xl mx-auto px-5">
        <RevealOnScroll direction="up">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-center mb-10 sm:mb-16 tracking-tight leading-tight">Designet for Google AI Overviews</h2>
        </RevealOnScroll>
        <div className="space-y-3 sm:space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-slate-100 rounded-[24px] sm:rounded-[32px] overflow-hidden group hover:border-violet-100 transition-all">
              <button 
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full p-6 sm:p-8 flex items-center justify-between text-left group-hover:bg-slate-50/50 transition-colors"
              >
                <span className="text-base sm:text-xl font-bold text-slate-950 pr-6 sm:pr-8 leading-snug">{faq.q}</span>
                <ChevronDown className={`shrink-0 transition-transform duration-500 size-5 ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && (
                <div className="px-6 pb-6 sm:px-8 sm:pb-8 text-sm sm:text-lg text-slate-500 leading-relaxed font-medium animate-fade-in">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// --- VIEWS ---

const HomeView = () => (
  <>
    <Hero />
    <DashboardPreview />
    <PainPointsSection />
    <ValuePropositionSection />
    <StepPlanSection />
    <InsightSection />
    <Pricing />
    <FAQSection />
  </>
);

// RIKTIG: Legg merke til parentesen ( rett etter pila =>
const DeepDiveView = ({ onBack, onSelectPlan }: { onBack: () => void; onSelectPlan?: (plan: string) => void }) => (
  <>
    <DeepDiveHero />
    <PainPointData />
    <AiProcessDeepDive />
    <Pricing onSelectPlan={onSelectPlan} />
    <GeoFaq />
  </>
);

const TechnologyView = () => (
  <>
    <TechnologyHero />
    <FeatureMatrix />
    <DashboardSection />
    <ComparisonTable />
    <TechCTA />
  </>
);

// --- OTHER SHARED COMPONENTS ---

const PainPointsSection = () => (
  <section className="py-12 sm:py-24 md:py-32 bg-transparent overflow-hidden relative text-center">
    <div className="max-w-6xl mx-auto px-5 sm:px-6">
      <RevealOnScroll direction="up">
        <div className="text-center mb-10 sm:mb-16 md:mb-20">
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-950 mb-3 sm:mb-6">Synlighet er nøkkelen</h2>
          <p className="text-sm sm:text-lg md:text-xl text-violet-600 font-semibold opacity-90 px-4">Gir ikke markedsføringen din resultater?</p>
        </div>
      </RevealOnScroll>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5 relative z-10 text-left">
        {[
          { text: "Lave Google-rangeringer hindrer din suksess.", icon: <TrendingDown size={18} />, subIcon: <Monitor className="text-rose-200/40 absolute -right-2 -bottom-2 w-16 h-16 pointer-events-none" /> },
          { text: "Bortkastet tid på strategier som ikke virker.", icon: <Clock size={18} />, subIcon: <Clock className="text-slate-100 absolute -right-2 -bottom-2 w-16 h-16 pointer-events-none" /> },
          { text: "Frustrasjon over manglende kunder.", icon: <Frown size={18} />, subIcon: <User className="text-slate-100 absolute -right-2 -bottom-2 w-16 h-16 pointer-events-none" /> },
          { text: "Tapte muligheter for vekst og salg.", icon: <TrendingDown size={18} />, subIcon: <BarChart3 className="text-rose-200/40 absolute -right-2 -bottom-2 w-16 h-16 pointer-events-none" /> }
        ].map((point, i) => (
          <RevealOnScroll key={i} direction={i % 2 === 0 ? 'left' : 'right'} delay={i * 50}>
            <div className="flex items-center gap-4 sm:gap-6 p-6 sm:p-8 bg-white/60 backdrop-blur-sm rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group relative overflow-hidden">
              {point.subIcon}
              <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-rose-50 group-hover:text-rose-500 transition-colors shrink-0 relative z-10">
                {React.cloneElement(point.icon as React.ReactElement<any>, { size: 24 })}
              </div>
              <p className="text-slate-700 font-bold text-sm sm:text-lg leading-snug relative z-10">{point.text}</p>
            </div>
          </RevealOnScroll>
        ))}
      </div>
    </div>
  </section>
);

const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: "Hvordan kan dere hjelpe min nettside med å rangere høyere på Google?",
      answer: "Vi bruker en velprøvd strategi som kombinerer teknisk optimalisering, innholdsproduksjon og autoritetsbygging. Ved å analysere dine konkurrenter og tette de tekniske hullene på din side, sørger vi for at Google prioriterer deg foran konkurrentene. Vi gir deg ikke bare trafikk, men de riktige kundene."
    },
    {
      question: "Hvor raskt kan jeg forvente resultater når jeg jobber med dere?",
      answer: "Mens SEO generelt tar tid (3–12 måneder), starter vi alltid med \"lavthengende frukter\". Ved å optimalisere ditt eksisterende innhold kan vi ofte se positive bevegelser i løpet av de første ukene. Vi legger en langsiktig plan som sikrer at veksten din blir stabil og varig."
    },
    {
      question: "Kan dere sørge for at min bedrift blir nevnt av AI-er som ChatGPT?",
      answer: "Ja, dette er en sentral del av vår moderne SEO-strategi (GEO). Vi strukturerer innholdet ditt med presise data og autoritære svar som er skreddersydd for at AI-modeller skal plukke det opp. Målet vårt er at når noen spør en AI om anbefalinger i din bransje, er det ditt navn som dukker opp."
    },
    {
      question: "Hvorfor bør jeg velge dere i stedet for å gjøre SEO selv?",
      answer: "SEO endrer seg nesten daglig. Ved å la oss håndtere det tekniske, søkeordsanalysen og innholdet, sparer du hundrevis av timer og unngår kostbare feil. Vi sitter på verktøyene og erfaringen som trengs for å tolke algoritmene korrekt, slik at du kan fokusere på å drive din bedrift."
    },
    {
      question: "Hvordan vet jeg at strategien deres faktisk fungerer?",
      answer: "Vi tror på full åpenhet. Du vil motta jevnlige rapporter som viser nøyaktig hvordan rangeringen din forbedrer seg, hvor mye trafikk som kommer inn, og viktigst av alt: hvor mange av disse som konverterer til faktiske kunder. Din suksess er vårt bevis på at metoden fungerer."
    }
  ];

  return (
    <section className="py-16 sm:py-32 bg-slate-50/30 relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern opacity-[0.05] pointer-events-none"></div>
      
      <div className="max-w-7xl mx-auto px-5 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-20">
          <div className="lg:col-span-4 flex flex-col items-center lg:items-start text-center lg:text-left">
            <RevealOnScroll direction="left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 text-violet-600 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mb-6 border border-violet-100">
                <HelpCircle size={11} />
                <span>Kunskap & Svar</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-slate-950 mb-6 leading-tight tracking-tight">
                Ofte stilte <br className="hidden lg:block" /> spørsmål
              </h2>
              <p className="text-slate-500 font-medium text-sm sm:text-lg leading-relaxed mb-8 max-w-md">
                De vanligste spørsmålene om moderne SEO og AI-drevet markedsføring.
              </p>
              <Lightbulb className="w-32 h-32 text-violet-100 hidden lg:block opacity-50 mt-10 -ml-4" />
            </RevealOnScroll>
          </div>

          <div className="lg:col-span-8">
            <div className="space-y-3 text-left">
              {faqs.map((faq, i) => (
                <RevealOnScroll key={i} direction="up" delay={i * 50}>
                  <div 
                    className={`group transition-all duration-500 ease-in-out border rounded-[20px] sm:rounded-[24px] overflow-hidden ${
                      openIndex === i 
                      ? 'bg-white border-violet-200 shadow-xl shadow-violet-500/5' 
                      : 'bg-white/60 backdrop-blur-sm border-slate-100 hover:border-violet-100 hover:bg-white'
                    }`}
                  >
                    <button 
                      onClick={() => setOpenIndex(openIndex === i ? null : i)}
                      className={`w-full p-6 sm:p-8 flex items-center justify-between text-left gap-4 transition-colors duration-500 ${openIndex === i ? 'bg-violet-50/50' : ''}`}
                    >
                      <span className={`text-sm sm:text-lg font-bold transition-colors duration-300 pr-2 sm:pr-4 ${openIndex === i ? 'text-violet-600' : 'text-slate-800'}`}>
                        {faq.question}
                      </span>
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center shrink-0 transition-all duration-500 ${
                        openIndex === i 
                        ? 'bg-violet-600 border-violet-600 text-white shadow-lg' 
                        : 'bg-slate-50 border-slate-100 text-slate-400'
                      }`}>
                        <ChevronDown size={16} className={`transition-transform duration-500 ${openIndex === i ? 'rotate-180' : 'rotate-0'}`} />
                      </div>
                    </button>
                    <div className={`transition-all duration-500 ease-in-out overflow-hidden ${openIndex === i ? 'max-h-[500px] opacity-100 pb-6 sm:pb-8' : 'max-h-0 opacity-0'}`}>
                      <div className="px-6 sm:px-8 text-xs sm:text-base text-slate-500 font-medium leading-relaxed pt-4 sm:pt-6 border-t border-slate-50/50 mx-2">
                        {faq.answer}
                      </div>
                    </div>
                  </div>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const ValuePropositionSection = () => {
  const benefits = [
    { title: "Høyere rangering", desc: "AI-drevne strategier for Norge.", icon: <TrendingUp className="text-violet-600" />, illu: <BarChart3 className="w-12 h-12 text-violet-100/50 absolute top-4 right-4" /> },
    { title: "Økt trafikk", desc: "Automatisert synlighet for vekst.", icon: <Zap className="text-violet-600" />, illu: <Rocket className="w-12 h-12 text-violet-100/50 absolute top-4 right-4" /> },
    { title: "Sjelefred", desc: "Full oversikt over din dominans.", icon: <ShieldCheck className="text-violet-600" />, illu: <Shield className="w-12 h-12 text-violet-100/50 absolute top-4 right-4" /> }
  ];

  return (
    <section className="py-16 sm:py-32 bg-slate-50/20 relative overflow-hidden text-center">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[50rem] h-[50rem] bg-violet-200/10 rounded-full blur-[140px] animate-mesh opacity-60"></div>
      </div>
      
      <div className="max-w-6xl mx-auto px-5 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-20 items-center">
          <RevealOnScroll direction="left">
            <div className="max-w-xl text-center lg:text-left">
              <h2 className="text-2xl sm:text-4xl lg:text-6xl font-extrabold tracking-tight text-slate-950 mb-4 sm:mb-8 leading-tight">
                Øk din synlighet på nett
              </h2>
              <p className="text-sm sm:text-lg md:text-xl text-slate-600 leading-relaxed mb-8 font-medium opacity-80">
                Forvandle frustrasjon til målbar suksess med banebrytende SEO-løsninger skreddersydd for din bedrift.
              </p>
              <div className="hidden lg:flex gap-4">
                 <div className="w-20 h-20 bg-violet-50 rounded-2xl flex items-center justify-center text-violet-400 rotate-6 shadow-sm"><Globe size={32} /></div>
                 <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-400 -rotate-3 shadow-sm mt-8"><Target size={32} /></div>
                 <div className="w-20 h-20 bg-fuchsia-50 rounded-2xl flex items-center justify-center text-fuchsia-400 rotate-12 shadow-sm"><Sparkles size={32} /></div>
              </div>
            </div>
          </RevealOnScroll>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 text-left">
            {benefits.map((benefit, i) => (
              <RevealOnScroll key={i} direction="right" delay={i * 100} className={i === 0 ? "sm:col-span-2" : ""}>
                <div className="p-6 sm:p-8 rounded-[28px] sm:rounded-[36px] bg-white/80 backdrop-blur-sm border border-slate-100 group hover:shadow-xl hover:border-violet-100 transition-all duration-500 h-full flex flex-col sm:flex-row sm:items-center gap-5 relative overflow-hidden">
                  {benefit.illu}
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 relative z-10">
                    {React.cloneElement(benefit.icon as React.ReactElement<any>, { size: 28 })}
                  </div>
                  <div className="flex-1 relative z-10">
                    <h3 className="text-base sm:text-xl font-bold text-slate-900 mb-1">{benefit.title}</h3>
                    <p className="text-xs sm:text-base text-slate-500 leading-relaxed font-medium">{benefit.desc}</p>
                  </div>
                </div>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const StepPlanSection = () => {
  const steps = [
    { number: "1", title: "Velg plan", desc: "Kom i gang på sekunder.", icon: <MousePointer2 />, illu: <Layers className="w-16 h-16 absolute -bottom-4 -left-4 text-violet-50 opacity-0 group-hover:opacity-100 group-hover:rotate-12 transition-all duration-500" /> },
    { number: "2", title: "Legg til URL", desc: "Vi analyserer umiddelbart.", icon: <Globe />, illu: <Globe className="w-16 h-16 absolute -bottom-4 -left-4 text-violet-50 opacity-0 group-hover:opacity-100 group-hover:rotate-12 transition-all duration-500" /> },
    { number: "3", title: "Se veksten", desc: "Sikt optimaliserer alt.", icon: <Activity />, illu: <TrendingUp className="w-16 h-16 absolute -bottom-4 -left-4 text-violet-50 opacity-0 group-hover:opacity-100 group-hover:rotate-12 transition-all duration-500" /> }
  ];

  return (
    <section id="prosess" className="py-16 sm:py-32 bg-white/40 relative overflow-hidden text-center">
      <div className="absolute inset-0 grid-pattern opacity-[0.06] pointer-events-none"></div>
      <div className="max-w-6xl mx-auto px-5 relative z-10">
        <RevealOnScroll direction="up">
          <div className="mb-12 sm:mb-24">
            <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-950 mb-4 sm:mb-8">3 enkle steg</h2>
            <p className="text-sm sm:text-lg md:text-xl text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed opacity-90 px-4">
              Vi har forenklet SEO. Slik tar vi din bedrift fra usynlig til markedsleder.
            </p>
          </div>
        </RevealOnScroll>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 sm:gap-16 relative">
          <div className="hidden md:block absolute top-[30%] left-[15%] right-[15%] h-[1px] bg-slate-100 -z-0"></div>
          {steps.map((step, i) => (
            <RevealOnScroll key={i} direction="up" delay={i * 150}>
              <div className="relative z-10 flex flex-col items-center group cursor-default">
                <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-[32px] sm:rounded-[44px] bg-white border border-slate-100 shadow-sm flex items-center justify-center mb-8 relative group-hover:-translate-y-2 transition-transform duration-500 overflow-hidden">
                  <div className="absolute -top-1 -right-1 w-8 h-8 sm:w-10 sm:h-10 bg-slate-950 text-white rounded-xl flex items-center justify-center text-xs sm:text-sm font-black border-2 border-white relative z-20">0{step.number}</div>
                  {step.illu}
                  {React.cloneElement(step.icon as React.ReactElement<any>, { size: 32, className: "text-violet-600 relative z-10" })}
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-950 mb-3 group-hover:text-violet-600 transition-colors">{step.title}</h3>
                <p className="text-sm sm:text-lg text-slate-600 font-medium leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
};

const InsightSection = () => {
  return (
    <section className="py-20 sm:py-32 bg-transparent relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          
          {/* Venstre side: Kontekst og emosjonell tekst */}
          <div className="lg:col-span-5 space-y-8">
            <RevealOnScroll direction="left">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-50 text-violet-600 text-[10px] font-black uppercase tracking-widest mb-4 border border-violet-100">
                <Sparkles size={12} />
                <span>Vi hjelper deg å lykkes</span>
              </div>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 leading-[1.1] tracking-tight">
                Føles markedsføringen <span className="text-violet-600">ineffektiv?</span>
              </h2>
              <div className="space-y-6 text-slate-600 font-medium leading-relaxed">
                <p className="text-lg sm:text-xl text-slate-900 font-bold">
                  Hver dag sliter utallige små og mellomstore bedrifter med lav synlighet på Google.
                </p>
                <p className="text-base sm:text-lg opacity-80">
                  Dette fører til tapte muligheter og frustrerte eiere. Hos Sikt bruker vi moderne AI-løsninger for å optimalisere nettstedet ditt, slik at du ikke bare forbedrer rangeringene dine, men også får den oppmerksomheten du fortjener.
                </p>
                <p className="text-base sm:text-lg opacity-80">
                  Ikke la ineffektiv markedsføring holde deg tilbake; ta grep i dag og se bedriften din blomstre med økt nettstedstrafikk og synlighet.
                </p>
              </div>
              
              <div className="pt-6">
                <button className="group flex items-center gap-3 bg-slate-950 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-violet-600 transition-all shadow-xl shadow-slate-200 hover:shadow-violet-200 active:scale-95">
                  Start din suksesshistorie <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </RevealOnScroll>
          </div>

          {/* Høyre side: Bento Grid med løsningskort */}
          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Kort 1: Frustrasjon (Stor) */}
            <RevealOnScroll direction="up" className="md:col-span-2">
              <div className="p-8 sm:p-10 bg-white border border-slate-100 rounded-[32px] shadow-sm hover:shadow-xl transition-all duration-500 group relative overflow-hidden">
                <div className="absolute -right-6 -bottom-6 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-700">
                  <HeartHandshake size={180} />
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-6">
                  <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 shrink-0 shadow-inner">
                    <SearchCheck size={28} />
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-950">Vi forstår frustrasjonen din</h3>
                </div>
                <p className="text-base sm:text-lg text-slate-500 font-medium leading-relaxed max-w-xl">
                  Vi vet hvor kjedelig det er å legge ned arbeid uten å se resultater. Våre AI-løsninger sikrer effektive strategier som øker rangeringene der det faktisk gir verdi for din bunnlinje.
                </p>
              </div>
            </RevealOnScroll>

            {/* Kort 2: AI (Liten) */}
            <RevealOnScroll direction="up" delay={100}>
              <div className="p-8 bg-indigo-50/30 border border-indigo-100/50 rounded-[32px] shadow-sm hover:shadow-xl transition-all duration-500 group relative h-full flex flex-col justify-between overflow-hidden">
                <div className="absolute -right-4 -top-4 opacity-5 group-hover:rotate-12 transition-transform duration-500">
                  <BrainCircuit size={100} />
                </div>
                <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white mb-6 shadow-lg shadow-indigo-100">
                  <Cpu size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-950 mb-3">Drevet av moderne AI</h3>
                  <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
                    Vi bruker banebrytende teknologi for å maksimere rekkevidden din og automatisere suksess på en måte tradisjonelle metoder ikke kan.
                  </p>
                </div>
              </div>
            </RevealOnScroll>

            {/* Kort 3: Vekst (Liten) */}
            <RevealOnScroll direction="up" delay={200}>
              <div className="p-8 bg-emerald-50/30 border border-emerald-100/50 rounded-[32px] shadow-sm hover:shadow-xl transition-all duration-500 group relative h-full flex flex-col justify-between overflow-hidden">
                <div className="absolute -right-4 -top-4 opacity-5 group-hover:-rotate-12 transition-transform duration-500">
                  <BarChart4 size={100} />
                </div>
                <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white mb-6 shadow-lg shadow-emerald-100">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-950 mb-3">Velprøvde strategier</h3>
                  <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
                    Utviklet spesifikt for små bedrifter i Norge med fokus på vekst. Vi leverer målbare resultater som faktisk merkes på trafikken din.
                  </p>
                </div>
              </div>
            </RevealOnScroll>

          </div>
        </div>
      </div>
    </section>
  );
};

const TechCTA = () => (
  <section className="py-20 sm:py-32 bg-white relative overflow-hidden text-center">
    <div className="max-w-4xl mx-auto px-5 relative z-10">
      <RevealOnScroll direction="up">
        <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-slate-950 mb-6 sm:mb-8 tracking-tighter">Klar for en teknisk fordel?</h2>
        <p className="text-base sm:text-xl text-slate-600 font-medium mb-10 max-w-2xl mx-auto leading-relaxed">
          Slutt å gjette. Bruk teknologien som faktisk flytter nålen for din bedrift på Google.
        </p>
        <button className="px-10 py-4 sm:px-12 sm:py-5 bg-slate-950 text-white rounded-full text-base sm:text-lg font-black tracking-tight hover:bg-violet-600 hover:scale-105 transition-all shadow-xl">
          Begynn i dag
        </button>
      </RevealOnScroll>
    </div>
  </section>
);

const Footer = () => (
  <footer className="bg-slate-950 text-white py-16 sm:py-20 border-t border-slate-900 overflow-hidden relative text-center">
    <div className="max-w-6xl mx-auto px-5 relative z-10">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-10 sm:gap-12 mb-16 sm:mb-20">
        <div className="md:col-span-2 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-3 mb-6">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-950 font-black text-xl">S</div>
            <span className="text-2xl font-black tracking-tight">Sikt</span>
          </div>
          <p className="text-slate-400 font-medium max-w-sm leading-relaxed mb-8 mx-auto md:mx-0 text-sm">
            Vi transformerer din digitale tilstedeværelse med neste generasjons AI-drevet SEO. Synlighet er ikke et valg, det er en nødvendighet.
          </p>
          <div className="flex items-center justify-center md:justify-start gap-3 text-slate-400 hover:text-white transition-colors cursor-pointer">
            <Mail size={16} className="text-violet-500" />
            <span className="font-bold text-xs">siktseo@gmail.com</span>
          </div>
        </div>
        <div className="text-center md:text-left">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-6 sm:mb-8">Selskap</h4>
          <ul className="space-y-3 sm:space-y-4 text-slate-400 font-bold text-sm">
            <li><a href="#" className="hover:text-violet-400 transition-colors">Om Sikt</a></li>
            <li><a href="#" className="hover:text-violet-400 transition-colors">Tjenester</a></li>
          </ul>
        </div>
        <div className="text-center md:text-left">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-6 sm:mb-8">Kontakt</h4>
          <div className="flex justify-center md:justify-start gap-4 text-slate-400">
            <Linkedin size={20} className="hover:text-violet-400 cursor-pointer" />
            <Twitter size={20} className="hover:text-violet-400 cursor-pointer" />
          </div>
        </div>
      </div>
      <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-600 text-center">
        <p>© 2024 SIKT TECHNOLOGIES AS. NORSK DESIGN.</p>
        <div className="flex gap-6 sm:gap-10">
          <a href="#" className="hover:text-white transition-colors">Personvern</a>
          <a href="#" className="hover:text-white transition-colors">Vilkår</a>
        </div>
      </div>
    </div>
  </footer>
);

// --- WRAPPER COMPONENTS ---

const Navbar = ({ onNavigate, currentView, user, onLoginTrigger }: { onNavigate: (view: string) => void, currentView: string, user: any, onLoginTrigger: () => void }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 15);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToPricing = () => {
    const el = document.getElementById('priser');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setIsMobileMenuOpen(false);
    }
  };

  const handleGetStarted = () => {
    if (!user) {
      onLoginTrigger();
    } else {
      scrollToPricing();
    }
  };

  // Hjelpefunksjon for å finne riktig bilde-URL fra Supabase/Google
  const getAvatarUrl = (u: any) => {
    return u?.user_metadata?.avatar_url || u?.user_metadata?.picture || u?.picture;
  };

  // Hjelpefunksjon for visningsnavn
  const getName = (u: any) => {
    return u?.user_metadata?.full_name || u?.user_metadata?.name || u?.email?.split('@')[0] || "Bruker";
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled || isMobileMenuOpen ? 'glass border-b border-slate-100 py-3 sm:py-4 shadow-sm' : 'bg-transparent py-5 sm:py-8'}`}>
      <div className="max-w-6xl mx-auto px-5 sm:px-6 flex justify-between items-center">
        <div className="flex items-center gap-2 sm:gap-3 group cursor-pointer" onClick={() => onNavigate('home')}>
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-900 rounded-lg sm:rounded-xl flex items-center justify-center text-white font-bold text-lg transition-all group-hover:bg-violet-600">S</div>
          <span className="text-lg sm:text-xl font-black tracking-tighter text-slate-900 transition-colors group-hover:text-violet-600">Sikt</span>
        </div>
        
        {/* DESKTOP MENY */}
        <div className="hidden md:flex items-center gap-6 text-[13px] font-bold text-slate-500">
          <button 
            onClick={() => onNavigate('deepdive')} 
            className={`transition-all ${currentView === 'deepdive' ? 'text-violet-600 bg-violet-50 px-3 py-1.5 rounded-full' : 'hover:text-slate-900'}`}
          >
            Bli synlig på Google
          </button>
          <button 
            onClick={() => onNavigate('technology')}
            className={`transition-all ${currentView === 'technology' ? 'text-violet-600 bg-violet-50 px-3 py-1.5 rounded-full' : 'hover:text-slate-900'}`}
          >
            Teknologien
          </button>
          
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3 pl-4 border-l border-slate-100">
                <img 
                  src={getAvatarUrl(user)} 
                  alt="profil" 
                  className="w-9 h-9 rounded-full border-2 border-white shadow-md bg-slate-100 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                  }}
                />
                {/* Fallback ikon hvis bilde feiler */}
                <div className="hidden w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold border-2 border-white shadow-md">
                   {user.email?.charAt(0).toUpperCase()}
                </div>
                
                <span className="text-sm font-bold text-slate-700 hidden lg:block">
                  {getName(user)}
                </span>
                
                <button 
                  onClick={scrollToPricing}
                  className="bg-slate-900 text-white px-5 py-2 rounded-full text-xs font-bold hover:bg-slate-800 transition-all ml-2"
                >
                  Oppgrader
                </button>
              </div>
            ) : (
              <button 
                onClick={handleGetStarted} 
                className="bg-slate-900 text-white px-7 py-2.5 rounded-full transition-all hover:bg-violet-600 shadow-xl flex items-center gap-2 active:scale-95"
              >
                Kom i gang <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
        
        <button 
          className="md:hidden text-slate-900 p-2.5 rounded-xl bg-white border border-slate-100 shadow-sm transition-all" 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* MOBIL MENY */}
      {isMobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-white border-b border-slate-100 px-5 py-10 flex flex-col gap-3 shadow-2xl md:hidden animate-fade-in overflow-hidden h-screen sm:h-auto">
          <button 
            onClick={() => {onNavigate('home'); setIsMobileMenuOpen(false);}} 
            className={`flex items-center gap-4 text-lg font-bold px-4 py-4 rounded-2xl w-full text-left transition-colors ${currentView === 'home' ? 'text-violet-600 bg-violet-50' : 'text-slate-900 hover:bg-slate-50'}`}
          >
            <Home size={20} /> Hjem
          </button>
          <button 
            onClick={() => {onNavigate('deepdive'); setIsMobileMenuOpen(false);}} 
            className={`flex items-center gap-4 text-lg font-bold px-4 py-4 rounded-2xl w-full text-left transition-colors ${currentView === 'deepdive' ? 'text-violet-600 bg-violet-50' : 'text-slate-900 hover:bg-slate-50'}`}
          >
            <Target size={20} /> Bli synlig på Google
          </button>
          <button 
            onClick={() => {onNavigate('technology'); setIsMobileMenuOpen(false);}} 
            className={`flex items-center gap-4 text-lg font-bold px-4 py-4 rounded-2xl w-full text-left transition-colors ${currentView === 'technology' ? 'text-violet-600 bg-violet-50' : 'text-slate-900 hover:bg-slate-50'}`}
          >
            <Cpu size={20} /> Teknologien
          </button>
          
          <div className="mt-4 pt-4 border-t border-slate-100">
             {!user ? (
               <button 
                 onClick={handleGetStarted} 
                 className="bg-slate-950 text-white text-center w-full py-5 rounded-2xl font-bold text-xl shadow-2xl flex items-center justify-center gap-3 active:scale-95"
               >
                 Kom i gang <ArrowRight size={20} />
               </button>
             ) : (
               <div className="flex flex-col gap-4">
                 <div className="flex items-center gap-4 bg-violet-50 p-4 rounded-2xl text-left">
                   <img 
                     src={getAvatarUrl(user)} 
                     alt="profil" 
                     className="w-14 h-14 rounded-full border-2 border-white shadow-sm object-cover" 
                     onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + user.email;
                     }}
                   />
                   <div className="flex flex-col">
                     <span className="text-base font-black text-slate-950">{getName(user)}</span>
                     <span className="text-sm font-bold text-slate-500">{user.email}</span>
                   </div>
                 </div>
                 <button 
                   onClick={handleGetStarted} 
                   className="bg-slate-950 text-white text-center py-5 rounded-2xl font-bold text-xl shadow-2xl flex items-center justify-center gap-3 active:scale-95"
                 >
                   Gå til priser <ArrowRight size={20} />
                 </button>
               </div>
             )}
          </div>
        </div>
      )}
    </nav>
  );
};

// --- MAIN APP ---

// --- MAIN APP COMPONENT ---
// --- MAIN APP COMPONENT ---
// --- MAIN APP COMPONENT ---
// --- MAIN APP COMPONENT ---
const App = () => {
  const [view, setView] = useState('home');
  const [user, setUser] = useState<any>(null);

  // 1. Sjekk brukerstatus
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Scroll til toppen ved sidebytte
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  return (
    <div className="min-h-screen selection:bg-violet-100 selection:text-violet-900 bg-[#fcfcfd] relative overflow-x-hidden">
      <GlobalDecorations />
      
      <Navbar 
        currentView={view} 
        onNavigate={setView} 
        user={user} 
        onLoginTrigger={handleLogin} 
      />
      
      <main className="relative z-10">
        {/* SCENARIO 1: FORSIDEN */}
        {view === 'home' && (
          <HomeView 
            onNavigate={setView} 
            onSelectPlan={() => handleLogin()} 
          />
        )}

        {/* SCENARIO 2: TEKNOLOGI */}
        {view === 'technology' && (
          <TechnologyView />
        )}

        {/* SCENARIO 3: ALLE ANDRE SIDER ("Bli synlig på Google", "Dypdykk", osv.) */}
        {/* Dette sikrer at knappen i menyen din alltid virker, selv om jeg ikke vet nøyaktig hva den heter */}
        {view !== 'home' && view !== 'technology' && (
          <DeepDiveView 
            onBack={() => setView('home')} 
            onSelectPlan={() => handleLogin()} 
          />
        )}
      </main>

      <Footer onNavigate={setView} />
    </div>
  );
};

// --- AGGRESSIV LYTTER (Sikrer login-knapper) ---
if (typeof window !== 'undefined') {
  window.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const clickable = target.closest('a, button, div[role="button"]');

    if (clickable && clickable.textContent) {
      const text = clickable.textContent.toLowerCase();
      const triggers = ["kom i gang", "begynn nå", "start", "velg denne"];

      if (triggers.some(t => text.includes(t))) {
        const href = clickable.getAttribute('href');
        // Stopper bare lenker som er "tomme" (#) eller interne anker (#priser)
        if (href === '#' || href === '#priser') {
          e.preventDefault();
        }
        handleLogin();
      }
    }
  }, true);
}

export default App;