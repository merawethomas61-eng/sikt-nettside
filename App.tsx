import { PaymentModal } from './PaymentModal';
import { DetailedHealthCheck } from './src/components/DetailedHealthCheck';
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  ArrowRight, ArrowDown, Eye, BarChart2, Map as MapIcon, Users, Key, Check, Search, Zap, Target, ChevronDown, Menu, X, Sparkles, CalendarClock,
  MousePointer2, TrendingUp, Cpu, Globe, Activity, ArrowUpRight, User, MonitorCheck, Code2, PenTool,
  SearchIcon, TrendingDown, Clock, AlertTriangle, MessageCircle, HelpCircle, LayoutDashboard, FileText, Link2,
  Home, Linkedin, Twitter, Mail, ShieldCheck, Wrench, Globe2, Stars, Frown, Radar, FileBarChart, AlertOctagon,
  Layers, Minus, BarChart3, Rocket, Shield, Lightbulb, Monitor, HeartHandshake, Lock, ChevronRight,
  BrainCircuit, BarChart4, SearchCheck, Database, Server, LogOut, Coffee, Save, XCircle, AlertCircle, Edit2,
  Settings, Smartphone, ArrowUp, ArrowUpCircle, ArrowDownCircle, CreditCard, LifeBuoy, Loader2, Trash2, Briefcase, Download, CheckCircle2, ArrowLeft, CheckCircle, Copy, ExternalLink
} from 'lucide-react';




const MyComponent = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const isFirstLoad = useRef(true);

  // Ref for å holde styr på om komponenten er montert
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    // Cleanup-funksjon som kjøres når komponenten "dør"
    return () => { isMounted.current = false; };
  }, []);

  const enterPortalWithDelay = async () => {
    // 1. Start loading
    if (isMounted.current) setIsLoading(true);

    // 2. Vent (Delay)
    await new Promise(resolve => setTimeout(resolve, 2800));

    // 3. Sjekk om vi fortsatt er "live" før vi oppdaterer state
    if (!isMounted.current) return; // Stopp her hvis brukeren har dratt

    // 4. Utfør endringene
    // Merk: React 18+ batcher disse automatisk, så du får kun én re-render
    setHasAccess(true);
    setIsLoading(false);
  };

  return (
    // ... din JSX
    <button onClick={enterPortalWithDelay}>Enter Portal</button>
  );
};



// --- GLOBAL SMART LOGIN FUNKSJON (Oppdatert) ---
export const handleLogin = async () => {
  console.log("Starter innlogging...");

  if (!supabase) {
    alert("Supabase mangler oppsett i supabaseClient.ts");
    return;
  }

  // 1. SJEKK OM BRUKER ALLEREDE ER INNE
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    // Hvis bruker allerede er logget inn i appen, send dem til dashboard/priser
    console.log("Bruker er allerede logget inn.");
    const pricingSection = document.getElementById('priser');
    if (pricingSection) {
      pricingSection.scrollIntoView({ behavior: 'smooth' });
    }
    return;
  }

  // 2. START GOOGLE LOGIN (Med tvungen kontovalg)
  console.log("Starter OAuth...");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: {
        // VIKTIG: Dette tvinger Google til å vise "Velg konto" hver gang!
        access_type: 'offline',
        prompt: 'select_account'
      }
    }
  });

  if (error) {
    console.error("Supabase Error:", error);
    alert("Feil ved innlogging: " + error.message);
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


// --- TYPESCRIPT DEFINISJONER (Lim inn dette øverst i filen) ---

export interface AnalysisResult {
  // De 4 store
  performance: number;
  seo: number;
  accessibility: number;
  bestPractices: number;

  // Detaljer
  seoDetails: {
    metaDescription: any;
    documentTitle: any;
    linkText: any;
    viewport: any;
  };

  // Core Web Vitals
  fcp?: { value: string; score: number };
  lcp?: { value: string; score: number };
  cls?: { value: string; score: number };
  tbt?: { value: string; score: number };

  // Standard Pakke (Tiltak)
  opportunities?: {
    title: string;
    description: string;
    savings: string
  }[];

  // Premium Pakke (Sjekkliste)
  diagnostics?: {
    title: string;
    passed: boolean
  }[];

  // NYTT: Ekstra info (Skjermbilde, server-tid osv)
  extras?: {
    screenshot: string;
    serverTime: string;
    totalWeight: string
  };
}

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

// --- DIN NYE CTA KOMPONENT ---
const GoogleCTA = () => (
  <div className="flex justify-center mt-8 sm:mt-12 relative z-30">
    <button
      onClick={handleLogin}
      className="group relative inline-flex items-center gap-3 px-8 py-4 bg-slate-950 text-white rounded-full font-bold text-lg shadow-xl hover:bg-violet-600 hover:shadow-2xl hover:shadow-violet-500/20 transition-all duration-300 transform hover:-translate-y-1"
    >
      <span>Ta meg til toppen av Google</span>
      {/* Vi bruker ikonet du allerede har importert */}
      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />

      {/* En liten 'glow' effekt for å gjøre den uimotståelig */}
      <div className="absolute inset-0 rounded-full ring-2 ring-white/10 group-hover:ring-white/30"></div>
    </button>
  </div>
);

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

    <style dangerouslySetInnerHTML={{
      __html: `
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
              Ta meg til toppen av Google <ArrowRight size={22} className="transition-transform duration-300 group-hover:translate-x-1.5" />
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
                              <span>{90 - i * 5}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                              <div className="h-full bg-slate-800 rounded-full" style={{ width: `${90 - i * 5}%` }}></div>
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
                      {[{ w: "seo byrå", r: 1 }, { w: "digital markedsføring", r: 3 }].map((kw, i) => (
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
                        { l: "LCP", v: 80, c: "bg-emerald-400" },
                        { l: "FID", v: 95, c: "bg-emerald-400" },
                        { l: "CLS", v: 60, c: "bg-amber-400" }
                      ].map((m, i) => (
                        <div key={i} className="flex-1 flex flex-col justify-end items-center gap-1">
                          <div className={`w-full rounded-t-sm ${m.c}`} style={{ height: `${m.v}%` }}></div>
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
    <style dangerouslySetInnerHTML={{
      __html: `
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


const BRANSJER = [
  "Advokat og Juridisk", "Akupunktur og Alternativ behandling", "Anleggsgartner", "Apotek", "Arkitekt", "Asylmottak", "Au pair og Barnepass", "Audiograf",
  "Bakeri og Konditori", "Bank og Finans", "Barnehage", "Begravelsesbyrå", "Bensin og Servicehandel", "Betong og Mur", "Bibliotek", "Bilbransjen - Forhandler", "Bilbransjen - Verksted", "Bilpleie", "Bioteknologi", "Blomsterdekoratør", "Bokhandel", "Brannvern", "Bryggeri", "Budbil og Transport", "Butikk og Detaljhandel", "Bygg og Anlegg", "Båt og Maritim",
  "Catering", "Coaching og Mentoring", "Computer og Data", "Consulting", "Containerutleie",
  "Dagligvare", "Dans og Teater", "Data og IT-drift", "Design og Formgivning", "Dyreklinikk og Veterinær", "Dyrepleie",
  "E-handel og Nettbutikk", "Eiendom og Bolig", "Eiendomsmegling", "Elektriker", "Elektronikk", "Energi og Kraft", "Entreprenør", "Event og Arrangement",
  "Film og TV-produksjon", "Fiskeri og Havbruk", "Fjellsprengning", "Flytting og Transport", "Forlag og Publishing", "Forsikring", "Forskning og Utvikling", "Fotograf", "Frisør", "Fysioterapi",
  "Gartneri", "Gjenvinning og Avfall", "Glassmester", "Grafisk Design", "Grossist", "Gullsmed",
  "Havnevirksomhet", "Helse og Omsorg", "Helsekost", "Hotell og Overnatting", "Hudpleie og Spa", "Hundesalong", "Hytteutleie", "Håndverker",
  "Industri og Produksjon", "Ingeniørtjenester", "Interiørdesign", "Internett og Web", "Investering", "Isolasjon", "IT-Konsulent", "IT-Sikkerhet",
  "Jordbruk og Skogbruk", "Journalistikk",
  "Kafe og Kaffebar", "Kantinedrift", "Kjemisk Industri", "Klesbutikk", "Kiosk", "Kiropraktor", "Kjemi og Laboratorium", "Konsulenttjenester", "Kontorutstyr", "Kraftlag", "Kunst og Kultur", "Kurs og Konferanse", "Kjøreskole",
  "Lager og Logistikk", "Landskapsarkitekt", "Lege og Spesialist", "Leketøy", "Luftfart", "Lyd og Lys", "Låsesmed",
  "Maling og Tapet", "Markedsføring og Reklame", "Maskinentreprenør", "Massasje", "Medier og Kommunikasjon", "Mekansik verksted", "Møbelsnekker", "Møbelbutikk", "Musikk og Lydstudio",
  "Naprapat", "Naturforvaltning", "Nettverk og Telekom",
  "Offentlig forvaltning", "Olje og Gass", "Optiker", "Organisasjon og Forening",
  "Pakking og Emballasje", "Parkering", "Personlig Trener", "Bemanning og Rekruttering", "Pizza og Fastfood", "Planlegging", "Produktdesign", "Psykolog",
  "Regnskap og Revisjon", "Renhold og Vask", "Reisebyrå", "Reiseliv og Turisme", "Restaurant og Servering", "Rigg og Drift", "Rørlegger",
  "Salg og Agentur", "Sikkerhet og Vakt", "Skilt og Dekor", "Skipsfart", "Skole og Utdanning", "Skadedyrkontroll", "Smådyrklinikk", "Snekker og Tømrer", "Sosiale Tjenester", "Spedisjon", "Sport og Idrett", "Sportsbutikk", "Stål og Metall", "Sykehjem", "Sykepleie",
  "Takstmann", "Taktekking", "Tannlege", "Taxi og Persontransport", "Tekstil og Klær", "Telekommunikasjon", "Teater", "Tolk", "Transport og Logistikk", "Treforedling", "Trening og Helse", "Trykkeri", "Turistinformasjon",
  "Urmaker", "Uteliv og Bar", "Utleie",
  "Vann og Avløp", "Vaskeri", "Vedlikehold", "Veidrift", "Verksted", "Webutvikling og Design", "Yrkeshygiene", "Økonomi og Administrasjon"
].sort();


const OnboardingPage = ({ onComplete, user }: { onComplete: () => void, user: any }) => {
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    companyName: '', contactPerson: '', email: '', phone: '',
    websiteUrl: '', industry: '', targetAudience: ''
  });

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleSelectIndustry = (industry: string) => {
    setFormData(prev => ({ ...prev, industry: industry }));
    setShowSuggestions(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Sjekk om det er bransje-feltet som skrives i
    if (name === 'industry') {
      if (value.length > 0) {
        // HER ER ENDRINGEN: Vi bruker startsWith igjen for å matche første bokstav
        const filtered = BRANSJER.filter(item =>
          item.toLowerCase().startsWith(value.toLowerCase())
        );
        setSuggestions(filtered);
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!user) {
      alert("Feil: Ingen bruker funnet. Logg inn på nytt.");
      setLoading(false);
      return;
    }

    try {
      console.log("Starter lagring for User ID:", user.id);

      // 2. CRITICAL FIX: Mapping til Snake_case
      // Jeg antar databasen din bruker standard SQL-navngiving (snake_case).
      // Hvis databasen din faktisk bruker camelCase (companyName), kan du bytte tilbake.
      const dataTilDatabase = {
        user_id: user.id,
        onboarding_completed: true,

        // Venstre side = Navn i Supabase (tabellen)
        // Høyre side = Navn i React (skjemaet)
        companyName: formData.companyName,
        contactPerson: formData.contactPerson,
        email: formData.email,
        phone: formData.phone,
        websiteUrl: formData.websiteUrl,
        industry: formData.industry,
        targetAudience: formData.targetAudience
      };

      const { data, error } = await supabase
        .from('clients')
        .upsert(dataTilDatabase, { onConflict: 'user_id' })
        .select();

      if (error) {
        console.error("Supabase nektet lagring:", error);
        throw error;
      }

      console.log("Suksess! Data lagret:", data);
      onComplete();

    } catch (error: any) {
      alert("Kunne ikke lagre: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="min-h-screen bg-slate-50 py-20 px-5 flex items-center justify-center">
      <div className="max-w-3xl w-full bg-white rounded-[32px] shadow-2xl p-8 sm:p-12 relative z-10 border border-slate-100">
        <h1 className="text-3xl font-black text-slate-950 mb-8">Fortell oss om din <span className="text-violet-600">bedrift</span></h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <input required name="companyName" value={formData.companyName} onChange={handleChange} placeholder="Bedriftsnavn" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-violet-600 outline-none" />
            <input required name="contactPerson" value={formData.contactPerson} onChange={handleChange} placeholder="Kontaktperson" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-violet-600 outline-none" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <input required type="email" name="email" value={formData.email} onChange={handleChange} placeholder="E-post" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-violet-600 outline-none" />
            <input required type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="Telefon" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-violet-600 outline-none" />
          </div>
          <input required type="url" name="websiteUrl" value={formData.websiteUrl} onChange={handleChange} placeholder="Nettside URL (https://...)" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-violet-600 outline-none" />

          {/* 3. CRITICAL FIX: UI for Bransjeforslag */}
          <div className="relative">
            <input
              required
              name="industry"
              value={formData.industry}
              onChange={handleChange}
              // Lukk listen hvis brukeren klikker utenfor (enkelt hack: onBlur med delay)
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Bransje (Begynn å skrive...)"
              className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-violet-600 outline-none"
            />

            {/* Dette er listen som manglet: */}
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-xl mt-1 max-h-60 overflow-y-auto shadow-lg">
                {suggestions.map((suggestion, index) => (
                  <li
                    key={index}
                    onClick={() => handleSelectIndustry(suggestion)}
                    className="p-3 hover:bg-violet-50 cursor-pointer text-slate-700 transition-colors"
                  >
                    {suggestion}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <textarea required name="targetAudience" value={formData.targetAudience} rows={3} onChange={handleChange} placeholder="Målgruppe (Hvem ønsker du å nå?)" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-violet-600 outline-none" />

          <button type="submit" disabled={loading} className="w-full py-5 bg-violet-600 text-white rounded-xl font-bold text-lg hover:bg-violet-700 transition-all shadow-xl disabled:opacity-50">
            {loading ? 'Lagrer data...' : 'Fullfør registrering →'}
          </button>
        </form>
      </div>
    </section>
  );
};

// --- HER STARTER SetupGuide (som du allerede har) ---
const SetupGuide = ({ onComplete }: { onComplete: () => void }) => {
  const [copied, setCopied] = useState(false);
  const [showWhyOwner, setShowWhyOwner] = useState(false); // Ny state for å vise info
  const MY_EMAIL = "siktseo@gmail.com";


  const handleCopy = () => {
    navigator.clipboard.writeText(MY_EMAIL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };


  return (
    <section className="min-h-screen bg-slate-50 py-12 px-4 flex items-center justify-center relative overflow-y-auto">
      <div className="absolute inset-0 grid-pattern opacity-[0.03] pointer-events-none"></div>

      <div className="max-w-2xl w-full bg-white rounded-[24px] shadow-2xl border border-slate-100 overflow-hidden relative z-10 my-10 animate-in fade-in zoom-in-95 duration-500">

        {/* HEADER: Fokus på partnerskap, ikke bare "krav" */}
        <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-violet-500/10 blur-3xl"></div>
          <div className="relative z-10">
            <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">Siste steg for å aktivere AI-en 🚀</h1>
            <p className="text-slate-400 font-medium text-sm sm:text-base">
              For at vi skal kunne analysere dine data, må vi koble oss på Google Search Console.
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-10 space-y-8">

          {/* TILLITS-GARANTI (Viktigste endring for trygghet) */}
          <div className="bg-emerald-50/80 border border-emerald-100 rounded-2xl p-5">
            <h3 className="flex items-center gap-2 font-bold text-emerald-900 text-sm uppercase tracking-wide mb-3">
              <ShieldCheck size={18} className="text-emerald-600" />
              Din Trygghetsgaranti
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex gap-3 items-start">
                <div className="bg-white p-1.5 rounded-md shadow-sm text-emerald-600"><Monitor size={14} /></div>
                <p className="text-xs text-emerald-800 leading-relaxed"><strong>Vi endrer ingenting.</strong> Vi bruker kun lesetilgang til å hente statistikk.</p>
              </div>
              <div className="flex gap-3 items-start">
                <div className="bg-white p-1.5 rounded-md shadow-sm text-emerald-600"><LogOut size={14} /></div>
                <p className="text-xs text-emerald-800 leading-relaxed"><strong>Full kontroll.</strong> Du eier dataene og kan fjerne oss når som helst med ett klikk.</p>
              </div>
            </div>
          </div>

          {/* STEG-FOR-STEG GUIDEN */}
          <div className="space-y-6 relative">
            <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-slate-100 -z-10"></div> {/* Tynn linje som binder stegene sammen */}

            {/* Steg 1 */}
            <div className="flex gap-4 group bg-white">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center shrink-0 border-4 border-slate-50 shadow-sm z-10">1</div>
              <div className="w-full pt-1">
                <h4 className="font-bold text-slate-900 mb-1">Logg inn i Search Console</h4>
                <p className="text-sm text-slate-500 mb-3">Klikk knappen under for å gå direkte til brukerinnstillinger.</p>
                <a href="https://search.google.com/search-console/users" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-white bg-violet-600 px-5 py-2.5 rounded-lg hover:bg-violet-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
                  Åpne Innstillinger <ExternalLink size={14} />
                </a>
              </div>
            </div>

            {/* Steg 2 */}
            <div className="flex gap-4 group bg-white">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center shrink-0 border-4 border-slate-50 shadow-sm z-10">2</div>
              <div className="w-full pt-1">
                <h4 className="font-bold text-slate-900 mb-1">Legg til vår e-post</h4>
                <p className="text-sm text-slate-500 mb-3">Trykk "Legg til bruker" og bruk denne e-posten:</p>

                {/* Optimalisert Kopierings-boks */}
                <div
                  onClick={handleCopy}
                  className="relative overflow-hidden flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-1 cursor-pointer hover:border-violet-500 hover:ring-2 hover:ring-violet-100 transition-all group/copy"
                >
                  <div className="flex items-center gap-3 px-3 py-3">
                    <Mail size={18} className="text-slate-400 group-hover/copy:text-violet-500 transition-colors" />
                    <code className="text-sm sm:text-base font-bold text-slate-700 font-mono tracking-tight">{MY_EMAIL}</code>
                  </div>
                  <div className={`px-4 py-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${copied ? 'bg-green-500 text-white' : 'bg-white border border-slate-200 text-slate-500 group-hover/copy:text-violet-600'}`}>
                    {copied ? <span className="flex items-center gap-1"><Check size={14} /> Kopiert</span> : 'Kopier'}
                  </div>
                </div>
              </div>
            </div>

            {/* Steg 3 - Critical Point */}
            <div className="flex gap-4 group bg-white">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center shrink-0 border-4 border-slate-50 shadow-sm z-10">3</div>
              <div className="pt-1 w-full">
                <h4 className="font-bold text-slate-900 mb-1">Velg rettighet: <span className="text-violet-600 bg-violet-50 px-2 py-0.5 rounded border border-violet-100">Eier</span></h4>
                <p className="text-sm text-slate-500 leading-relaxed mb-3">
                  Velg <strong>"Owner"</strong> (Eier) i listen. Dette er nødvendig for at AI-verktøyet skal kunne koble seg til API-et.
                </p>

                {/* Hvorfor Eier? - Expandable Trust Box */}
                <button
                  onClick={() => setShowWhyOwner(!showWhyOwner)}
                  className="text-xs font-bold text-slate-400 flex items-center gap-1 hover:text-slate-600 transition-colors"
                >
                  <HelpCircle size={12} /> Hvorfor må jeg velge Eier?
                </button>

                {showWhyOwner && (
                  <div className="mt-3 text-xs bg-slate-50 p-3 rounded-lg text-slate-600 leading-relaxed border border-slate-100 animate-in slide-in-from-top-2">
                    Google skiller dessverre ikke mellom "API-tilgang" og "Eier". For at programvare skal kunne hente ut data automatisk, krever Google statusen "Eier". Vi bruker aldri denne tilgangen til annet enn lesing.
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* CTA & Bekreftelse */}
          <div className="pt-8 border-t border-slate-100">
            <button
              onClick={onComplete}
              className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-violet-600 transition-all shadow-xl hover:shadow-violet-200/50 transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3 group"
            >
              <span>Jeg har gitt tilgang</span>
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>

            <div className="mt-6 flex items-start justify-center gap-3 opacity-80">
              <Clock size={16} className="text-slate-400 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-500 text-center max-w-xs leading-relaxed">
                Vi varsler deg via e-post eller telefon så snart analysen din er klar – <strong>senest innen 12 timer.</strong>
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Nød-knapp hvis de står fast */}
      <div className="absolute bottom-5 text-center w-full">
        <a href="mailto:siktseo@gmail.com" className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors">
          Står du fast? Kontakt support
        </a>
      </div>
    </section>
  );
};


// --- STORYBRAND SEKSJON (Med Animasjon) ---
const StoryBrandOneLiner = () => {
  return (
    <section className="relative py-32 sm:py-48 overflow-hidden bg-[#fcfcfd]">

      {/* Bakgrunn: En rolig, pulserende glød */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-tr from-violet-100/50 via-indigo-50/50 to-white rounded-[100%] blur-[80px] animate-[pulse_10s_ease-in-out_infinite] pointer-events-none"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="flex flex-col gap-16 sm:gap-24">

          {/* DEL 1: PROBLEMET (Venstre side) */}
          <RevealOnScroll delay={0} className="self-start sm:ml-12 relative">
            {/* En liten bakgrunns-sirkel for dybde */}
            <div className="absolute -left-4 -top-4 w-20 h-20 bg-slate-100 rounded-full blur-xl opacity-50 animate-pulse pointer-events-none"></div>

            <div className="backdrop-blur-md bg-white/80 border border-slate-200/60 shadow-sm px-8 py-5 rounded-2xl inline-flex items-center gap-4 max-w-lg relative z-10">
              <div className="w-2 h-2 rounded-full bg-slate-400 shrink-0"></div>
              <p className="text-slate-600 font-medium text-lg leading-snug">
                Mange bedrifter gjetter på hvordan de oppnår <span className="text-slate-900 font-bold border-b-2 border-slate-200">høyere rangering</span> på Google.
              </p>
            </div>
          </RevealOnScroll>


          {/* DEL 2: LØSNINGEN (Høyre side) */}
          <RevealOnScroll delay={200} className="self-end text-left sm:text-right max-w-5xl flex flex-col sm:flex-row-reverse items-center sm:items-start gap-8 sm:gap-12">

            {/* NY MODERNE ILLUSTRASJON (Abstrakt Vekst-Graf) */}
            <div className="relative shrink-0 w-48 h-48 sm:w-64 sm:h-64 animate-[float_6s_ease-in-out_infinite]">
              {/* Bakgrunnsglød */}
              <div className="absolute inset-0 bg-gradient-to-tr from-violet-200 via-indigo-200 to-blue-100 rounded-full blur-2xl opacity-60 animate-pulse"></div>

              {/* Glass-kort med graf */}
              <div className="absolute inset-4 backdrop-blur-xl bg-white/40 border border-white/60 rounded-3xl shadow-[0_8px_32px_rgba(31,38,135,0.1)] overflow-hidden flex items-end justify-center p-6">

                {/* Graf-stolper */}
                <div className="flex items-end gap-2 w-full h-32">
                  <div className="w-1/4 bg-slate-200/50 rounded-t-lg h-[30%] animate-[loading_3s_ease-in-out_infinite_0.2s]"></div>
                  <div className="w-1/4 bg-slate-300/50 rounded-t-lg h-[50%] animate-[loading_3s_ease-in-out_infinite_0.5s]"></div>
                  <div className="w-1/4 bg-violet-300/50 rounded-t-lg h-[70%] animate-[loading_3s_ease-in-out_infinite_0.8s]"></div>
                  {/* Vinner-stolpen */}
                  <div className="w-1/4 bg-gradient-to-t from-violet-500 to-indigo-500 rounded-t-lg h-[100%] relative shadow-lg animate-[loading_3s_ease-in-out_infinite_1.1s]">
                    <div className="absolute -top-2 -right-2 w-4 h-4 bg-white rounded-full animate-ping opacity-75"></div>
                    <div className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-violet-500 rounded-full"></div>
                  </div>
                </div>

              </div>
            </div>

            {/* Teksten */}
            <div className="text-left sm:text-right">
              <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold text-slate-900 tracking-tight leading-[1.15]">
                Vi bruker <span className="text-violet-600">AI</span> til å gi deg en <br className="hidden sm:block" />
                konkret oppskrift på å <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">nå toppen.</span>
              </h2>

              <p className="mt-8 text-xl sm:text-2xl text-slate-600 font-normal leading-relaxed max-w-2xl sm:ml-auto">
                Slik at du får trafikken og veksten du fortjener – helt uten gjetting.
              </p>
            </div>
          </RevealOnScroll>

        </div>
      </div>
      {/* Nødvendig for flyte-animasjonen */}
      <style>{`@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }`}</style>
    </section>
  );
};


// Legg merke til at vi nå tar imot "handleLogin" her
const Pricing = ({ onSelectPlan }: { onSelectPlan: (plan: string) => void }) => {
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
      desc: "Total dominans. Vi overtar hele SEO-arbeidet for maksimal vekst.",
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
    <section id="priser" className="py-20 sm:py-32 bg-slate-50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 relative z-10">

        <RevealOnScroll direction="up">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-black text-slate-950 mb-6">Velg din <span className="text-violet-600">vekstplan</span></h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">Ingen skjulte kostnader. Ingen bindingstid.</p>
          </div>
        </RevealOnScroll>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {plans.map((plan, i) => (
            <RevealOnScroll key={i} direction="up" delay={i * 100}>
              <div className={`relative bg-white rounded-[32px] p-8 sm:p-10 shadow-xl transition-transform duration-300 hover:-translate-y-2 border ${plan.highlighted ? 'border-violet-500 shadow-violet-200/50 scale-105 z-10' : 'border-slate-100'}`}>

                <div className="absolute -top-4 -right-4 bg-violet-600 text-white text-xs font-black px-3 py-1 rounded-full shadow-lg shadow-violet-200 z-50 border-2 border-white transform rotate-12">
                  70% RABATT 1. MND
                </div>

                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-1 rounded-full text-sm font-bold uppercase tracking-wide shadow-lg">
                    Mest valgt
                  </div>
                )}

                <h3 className="text-2xl font-bold text-slate-950 mb-2">{plan.title}</h3>
                <p className="text-violet-600 text-sm font-bold mb-4 uppercase tracking-wider">{plan.tagline}</p>

                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-black text-slate-950">{plan.price},-</span>
                  <span className="text-slate-500 font-medium">/mnd</span>
                </div>
                <p className="text-slate-600 mb-8 leading-relaxed">{plan.desc}</p>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feat, j) => (
                    <li key={j} className="flex items-start gap-3 text-slate-700">
                      <div className="mt-1 w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 shrink-0">
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <span className="text-sm font-medium">{feat}</span>
                    </li>
                  ))}
                </ul>

                {/* HER ER RETTELSEN: Vi sender 'plan.title' opp til Appen */}
                <button
                  onClick={() => onSelectPlan(plan.title)}
                  className={`w-full py-4 rounded-xl font-bold transition-all ${plan.highlighted
                    ? 'bg-slate-950 text-white hover:bg-violet-600 shadow-lg hover:shadow-violet-200'
                    : 'bg-slate-100 text-slate-950 hover:bg-slate-200'
                    }`}
                >
                  Velg {plan.title}
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
// --- SUCCESS PAGE (CLEAN & MODERN) ---
const SuccessPage = ({ onBackHome }: { onBackHome: () => void }) => {
  return (
    <section className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Bakgrunnseffekter */}
      <div className="absolute inset-0 grid-pattern opacity-[0.03] pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-xl w-full bg-white rounded-[32px] shadow-2xl border border-slate-100 overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-500">

        {/* Top Decor */}
        <div className="h-2 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500"></div>

        <div className="p-8 sm:p-12 text-center">

          {/* Suksess Ikon (Pulsende) */}
          <div className="mx-auto w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mb-8 relative">
            <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping opacity-20"></div>
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          </div>

          <h1 className="text-3xl font-black text-slate-900 mb-3">Alt er klart! 🎉</h1>
          <p className="text-slate-500 text-lg mb-10 leading-relaxed">
            Vi har mottatt nøklene og AI-motoren har allerede startet analysen av din nettside.
          </p>

          {/* VISUELL TIDSLINJE (Status) */}
          <div className="bg-slate-50 rounded-2xl p-6 mb-10 text-left border border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-5">Status akkurat nå:</h3>

            <div className="space-y-6 relative">
              {/* Linje som binder punktene sammen */}
              <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-200"></div>

              {/* Punkt 1: Ferdig */}
              <div className="flex gap-4 items-center relative z-10">
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm ring-4 ring-white">
                  <Check size={14} className="text-white" />
                </div>
                <span className="text-sm font-bold text-slate-800 line-through decoration-slate-300 decoration-2 opacity-50">Tilkobling opprettet</span>
              </div>

              {/* Punkt 2: Jobber (Aktiv) */}
              <div className="flex gap-4 items-center relative z-10">
                <div className="w-6 h-6 rounded-full bg-white border-2 border-violet-600 flex items-center justify-center shadow-sm ring-4 ring-white relative">
                  <div className="w-2 h-2 bg-violet-600 rounded-full animate-pulse"></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900">Analyserer søkeord & trafikk</span>
                  <span className="text-xs text-violet-600 font-medium animate-pulse">Jobber nå...</span>
                </div>
              </div>

              {/* Punkt 3: Venter */}
              <div className="flex gap-4 items-center relative z-10">
                <div className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center shadow-sm ring-4 ring-white">
                  <Clock size={12} className="text-slate-400" />
                </div>
                <span className="text-sm font-medium text-slate-400">Rapport sendes (ca. 12 timer)</span>
              </div>
            </div>
          </div>

          {/* Knapper */}
          <div className="space-y-3">
            <button
              onClick={onBackHome}
              className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-violet-600 transition-all shadow-xl hover:shadow-violet-200 transform hover:-translate-y-1"
            >
              Gå tilbake til Forsiden
            </button>
            <p className="text-xs text-slate-400">
              Du vil motta en e-postbekreftelse straks.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
};



// --- VIEWS ---

const HomeView = ({ onNavigate, onSelectPlan }: { onNavigate: (view: string) => void, onSelectPlan: (plan: string) => void }) => (
  <>
    <Hero />
    <DashboardPreview />
    <StoryBrandOneLiner />
    <PainPointsSection />
    <ValuePropositionSection />
    <StepPlanSection onNavigate={onNavigate} />
    <InsightSection />
    <TrustSection />
    {/* Her er endringen: Vi sender onSelectPlan videre til Pricing */}
    <Pricing onSelectPlan={onSelectPlan} />
    <FAQSection />
  </>
);

// RIKTIG: Legg merke til parentesen ( rett etter pila =>
const DeepDiveView = ({ onBack, onSelectPlan }: { onBack: () => void; onSelectPlan?: (plan: string) => void }) => (
  <>
    <DeepDiveHero />
    <PainPointData />
    <AiProcessDeepDive />
    {/* Her er rettelsen: Vi bruker onSelectPlan i stedet for handleLogin */}
    <Pricing onSelectPlan={onSelectPlan || (() => { })} />
    <GeoFaq />
  </>
);

const TechnologyView = ({ onNavigate }: { onNavigate: (view: string) => void }) => (
  <>
    <TechnologyHero />
    <FeatureMatrix />
    <DashboardSection />
    <ComparisonTable />
    {/* Nå vet den hva onNavigate er, og rød strek forsvinner */}
    <TechCTA onNavigate={onNavigate} />
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
                    className={`group transition-all duration-500 ease-in-out border rounded-[20px] sm:rounded-[24px] overflow-hidden ${openIndex === i
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
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center shrink-0 transition-all duration-500 ${openIndex === i
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


const velgPakke = async (pakkeNavn) => {
  console.log("Bruker valgte:", pakkeNavn);

  // 1. Lagre valget i Supabase (hvis bruker er logget inn)
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    await supabase
      .from('clients')
      .update({ package_name: pakkeNavn })
      .eq('user_id', user.id);
  }

  // 2. Send brukeren til riktig betalingsside (Stripe/Vipps)
  // DU MÅ BYTTE UT LENKENE UNDER MED DINE EGNE
  if (pakkeNavn === "Basic Pakke") {
    window.location.href = 'https://buy.stripe.com/DIN_BASIC_LINK';
  }
  else if (pakkeNavn === "Standard Pakke") {
    window.location.href = 'https://buy.stripe.com/DIN_STANDARD_LINK';
  }
  else if (pakkeNavn === "Premium Pakke") {
    window.location.href = 'https://buy.stripe.com/DIN_PREMIUM_LINK';
  }
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

const StepPlanSection = ({ onNavigate }: { onNavigate: (view: string) => void }) => {
  const steps = [
    { number: "1", title: "Velg plan", desc: "Kom i gang på sekunder.", icon: <MousePointer2 />, illu: <Layers className="w-16 h-16 absolute -bottom-4 -left-4 text-violet-50 opacity-0 group-hover:opacity-100 group-hover:rotate-12 transition-all duration-500" /> },
    { number: "2", title: "Legg til URL", desc: "Vi analyserer umiddelbart.", icon: <Globe />, illu: <Globe className="w-16 h-16 absolute -bottom-4 -left-4 text-violet-50 opacity-0 group-hover:opacity-100 group-hover:rotate-12 transition-all duration-500" /> },
    { number: "3", title: "Se veksten", desc: "Sikt optimaliserer alt.", icon: <Activity />, illu: <TrendingUp className="w-16 h-16 absolute -bottom-4 -left-4 text-violet-50 opacity-0 group-hover:opacity-100 group-hover:rotate-12 transition-all duration-500" /> }
  ];

  return (
    <section id="prosess" className="py-16 sm:py-32 bg-white/40 relative overflow-hidden text-center">
      <div className="absolute inset-0 grid-pattern opacity-[0.06] pointer-events-none"></div>
      <div className="max-w-6xl mx-auto px-5 relative z-10">

        {/* Intro */}
        <RevealOnScroll direction="up">
          <div className="mb-12 sm:mb-24">
            <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-950 mb-4 sm:mb-8">3 trinn til suksess</h2>
            <p className="text-sm sm:text-lg md:text-xl text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed opacity-90 px-4">
              Vi har forenklet SEO. Slik tar vi din bedrift fra usynlig til markedsleder.
            </p>
          </div>
        </RevealOnScroll>

        {/* Stegene */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 sm:gap-16 relative mb-16">
          <div className="hidden md:block absolute top-[30%] left-[15%] right-[15%] h-[1px] bg-slate-100 -z-0"></div>
          {steps.map((step, i) => (
            <RevealOnScroll key={i} direction="up" delay={i * 150}>
              <div className="relative z-10 flex flex-col items-center group cursor-default">

                <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-[32px] sm:rounded-[44px] bg-white border border-slate-100 shadow-sm flex items-center justify-center mb-8 relative group-hover:-translate-y-2 transition-transform duration-500 overflow-visible">

                  {/* --- HER ER RABATT-BADGEN --- */}
                  {step.number === "1" && (
                    <div className="absolute -top-4 -left-6 bg-violet-600 text-white text-[10px] sm:text-xs font-black px-3 py-1 rounded-full shadow-lg shadow-violet-200 z-50 border-2 border-white transform -rotate-12 whitespace-nowrap">
                      70% RABATT
                    </div>
                  )}
                  {/* --------------------------- */}

                  <div className="absolute -top-1 -right-1 w-8 h-8 sm:w-10 sm:h-10 bg-slate-950 text-white rounded-xl flex items-center justify-center text-xs sm:text-sm font-black border-2 border-white relative z-20">0{step.number}</div>

                  {/* Ikoner og illustrasjoner */}
                  <div className="relative z-10 overflow-hidden w-full h-full rounded-[32px] sm:rounded-[44px] flex items-center justify-center">
                    {step.illu}
                    {React.cloneElement(step.icon as React.ReactElement<any>, { size: 32, className: "text-violet-600 relative z-10" })}
                  </div>

                </div>

                <h3 className="text-xl sm:text-2xl font-bold text-slate-950 mb-3 group-hover:text-violet-600 transition-colors">{step.title}</h3>
                <p className="text-sm sm:text-lg text-slate-600 font-medium leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </div>
            </RevealOnScroll>
          ))}
        </div>

        {/* KNAPPEN */}
        <div className="flex justify-center pt-8">
          <button
            onClick={() => onNavigate('login')}
            className="group flex items-center gap-3 bg-slate-950 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-violet-600 transition-all shadow-xl shadow-slate-200 hover:shadow-violet-200 active:scale-95"
          >
            Ta meg til toppen av Google <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
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
            </RevealOnScroll>
            {/* HER VAR FEILEN - NÅ ER DEN LUKKET RIKTIG: */}
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

const TrustSection = () => {
  return (
    <section className="py-20 bg-slate-950 text-white relative overflow-hidden">
      {/* Bakgrunnseffekt */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
        <div className="absolute top-[-50%] left-[-10%] w-[600px] h-[600px] rounded-full bg-violet-900 blur-[120px]"></div>
        <div className="absolute bottom-[-50%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-900 blur-[100px]"></div>
      </div>

      <div className="max-w-6xl mx-auto px-5 relative z-10 text-center">

        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 text-sm font-bold mb-8">
            <ShieldCheck size={16} />
            <span>Null risiko. Full kontroll.</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black mb-6 leading-tight">
            Vår <span className="text-violet-400">Kvalitetsgaranti</span>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Vi vet at du har brent deg på byråer før. Derfor har vi fjernet usikkerheten og lagt risikoen på våre skuldre, ikke dine.
          </p>
        </div>

        {/* GARANTI-GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">

          {/* Punkt 1: Økonomi (OPPDATERT MED 70% RABATT) */}
          <div className="bg-gradient-to-br from-violet-900/40 to-slate-900/40 border border-violet-500/30 p-8 rounded-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
              ØKONOMISK TRYGGHET
            </div>
            <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-violet-900/20">
              <span className="text-xl font-black">70%</span>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">70% rabatt start</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Er du usikker på effekten? Vi gir deg 70% rabatt den første måneden. Vi tar den økonomiske risikoen for å bevise at vi leverer verdi før du betaler fullpris. Ingen bindingstid.
            </p>
          </div>

          {/* Punkt 2: Sikkerhet */}
          <div className="bg-white/5 border border-white/10 p-8 rounded-3xl hover:bg-white/10 transition-colors group">
            <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
              <ShieldCheck size={24} />
            </div>
            <h3 className="text-xl font-bold mb-3">Din side er trygg</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Frykt ikke for nettsiden din. Vi tar alltid full backup før arbeid. Ingen endringer publiseres uten din godkjenning. Vi passer på merkevaren din.
            </p>
          </div>

          {/* Punkt 3: Kvalitet */}
          <div className="bg-white/5 border border-white/10 p-8 rounded-3xl hover:bg-white/10 transition-colors group">
            <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-blue-400 mb-6 group-hover:scale-110 transition-transform">
              <User size={24} />
            </div>
            <h3 className="text-xl font-bold mb-3">Ekte eksperter</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Ingen automatiserte søppel-rapporter. En rådgiver analyserer din bedrift manuelt og legger en konkret slagplan for å slå dine konkurrenter.
            </p>
          </div>

          {/* Punkt 4: Arbeidsmengde (Med Zap i stedet for Coffee for å unngå feil) */}
          <div className="bg-white/5 border border-white/10 p-8 rounded-3xl hover:bg-white/10 transition-colors group">
            <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-amber-400 mb-6 group-hover:scale-110 transition-transform">
              <Zap size={24} />
            </div>
            <h3 className="text-xl font-bold mb-3">Vi gjør jobben</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Slipp å lære deg SEO. Vi tar det tunge tekniske løftet. Din eneste oppgave er å si "ja" eller "nei" til våre forslag.
            </p>
          </div>

          {/* Punkt 5: Fremtiden */}
          <div className="md:col-span-2 bg-white/5 border border-white/10 p-8 rounded-3xl hover:bg-white/10 transition-colors group relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-rose-400 shrink-0 group-hover:scale-110 transition-transform">
                <TrendingUp size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-3">Hva skjer på toppen?</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  Når vi når 1. plassen, er ikke jobben over. Da velger du veien videre:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                    <strong className="text-white block text-sm mb-1">A) Forsvar</strong>
                    <span className="text-xs text-slate-500">Vi overvåker og nøytraliserer konkurrenter som prøver å ta plassen din.</span>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                    <strong className="text-white block text-sm mb-1">B) Dominans</strong>
                    <span className="text-xs text-slate-500">Vi bruker tilliten Google nå har til deg for å vinne enda flere lønnsomme søkeord.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Call to Action i bunnen av garantien */}
        <div className="mt-16">
          <button
            onClick={handleLogin}
            className="bg-white text-slate-950 px-8 py-4 rounded-full font-bold text-lg hover:bg-violet-200 transition-colors shadow-lg shadow-white/10"
          >
            Start risikofritt i dag <ArrowRight className="inline ml-2" size={20} />
          </button>
          <p className="text-slate-500 text-xs mt-4">Ingen liten skrift. Ingen skjulte gebyrer.</p>
        </div>

      </div>
    </section>
  );
};




// 1. Legg til { onNavigate } her
const TechCTA = ({ onNavigate }: { onNavigate: (view: string) => void }) => (
  <section className="py-20 sm:py-32 bg-white relative overflow-hidden text-center">
    <div className="max-w-4xl mx-auto px-5 relative z-10">
      <RevealOnScroll direction="up">
        <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-slate-950 mb-6 sm:mb-8 tracking-tighter">Klar for en teknisk fordel?</h2>
        <p className="text-base sm:text-xl text-slate-600 font-medium mb-10 max-w-2xl mx-auto leading-relaxed">
          Mange bedrifter gjetter på hvordan de blir synlige på Google. Vi bruker AI til å gi deg en konkret oppskrift på å nå toppen, slik at du får trafikken og veksten du fortjener.
        </p>
        <button
          // 2. Legg til onClick her:
          onClick={() => onNavigate('login')}
          className="px-10 py-4 sm:px-12 sm:py-5 bg-slate-950 text-white rounded-full text-base sm:text-lg font-black tracking-tight hover:bg-violet-600 hover:scale-105 transition-all shadow-xl"
        >
          Ta meg til toppen av Google
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
            Mange bedrifter gjetter på hvordan de blir synlige på Google. Vi bruker AI til å gi deg en konkret oppskrift på å nå toppen, slik at du får trafikken og veksten du fortjener.
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
const Navbar = ({ onNavigate, currentView, user, onLoginTrigger, onLogout, hasAccess }: any) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 15);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getAvatarUrl = (u: any) => u?.user_metadata?.avatar_url || u?.user_metadata?.picture;

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled || isMobileMenuOpen ? 'bg-white/80 backdrop-blur-md border-b border-slate-100 py-4 shadow-sm' : 'bg-transparent py-8'}`}>
      <div className="max-w-6xl mx-auto px-6 flex justify-between items-center">

        {/* LOGO */}
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => onNavigate('home')}>
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold group-hover:bg-violet-600 transition-colors">S</div>
          <span className="text-xl font-black text-slate-900 group-hover:text-violet-600 transition-colors">Sikt</span>
        </div>

        {/* DESKTOP MENY */}
        <div className="hidden md:flex items-center gap-8">

          {/* Dashboard-knapp (KUN FOR BETALENDE KUNDER MED TILGANG) */}
          {user && hasAccess && (
            <button
              onClick={() => onNavigate('dashboard')}
              className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-full transition-all ${currentView === 'dashboard' ? 'bg-violet-100 text-violet-700' : 'text-slate-600 hover:text-violet-600 hover:bg-slate-50'}`}
            >
              <BarChart3 size={18} />
              Dashboard
            </button>
          )}

          <button onClick={() => onNavigate('deepdive')} className={`text-sm font-bold ${currentView === 'deepdive' ? 'text-violet-600' : 'text-slate-500 hover:text-slate-900'}`}>Bli synlig på google</button>
          <button onClick={() => onNavigate('technology')} className={`text-sm font-bold ${currentView === 'technology' ? 'text-violet-600' : 'text-slate-500 hover:text-slate-900'}`}>Teknologien</button>

          {user ? (
            <div className="relative">
              {/* Profilbilde-knapp */}
              <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-2 focus:outline-none">
                <img src={getAvatarUrl(user)} className="w-9 h-9 rounded-full border-2 border-white shadow-sm" alt="" />
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* DROPDOWN MENYEN */}
              {isProfileOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsProfileOpen(false)}></div>
                  <div className="absolute right-0 mt-3 w-60 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 animate-in zoom-in-95 duration-200 z-50 origin-top-right">
                    <div className="px-4 py-3 border-b border-slate-50 mb-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Innlogget som</p>
                      <p className="text-sm font-bold text-slate-900 truncate">{user.email}</p>
                    </div>

                    {/* Dashboard også i dropdown for enkel tilgang */}
                    {hasAccess && (
                      <button onClick={() => { onNavigate('dashboard'); setIsProfileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-violet-50 hover:text-violet-600 transition-colors text-left">
                        <BarChart3 size={16} /> Gå til Dashboard
                      </button>
                    )}

                    <button onClick={() => { onNavigate('profile'); setIsProfileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-violet-600 transition-colors text-left">
                      <Settings size={16} /> Innstillinger
                    </button>

                    <button onClick={() => { onNavigate('billing'); setIsProfileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-violet-600 transition-colors text-left">
                      <CreditCard size={16} /> Abonnement
                    </button>

                    <div className="my-1 border-b border-slate-50"></div>

                    <button onClick={() => { onLogout(); setIsProfileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-rose-500 hover:bg-rose-50 transition-colors text-left">
                      <LogOut size={16} /> Logg ut
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button onClick={onLoginTrigger} className="bg-slate-900 text-white px-6 py-2.5 rounded-full text-sm font-bold hover:bg-violet-600 transition-all shadow-lg shadow-slate-200">Kom i gang</button>
          )}
        </div>

        {/* MOBIL MENY KNAPP */}
        <button className="md:hidden" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>{isMobileMenuOpen ? <X /> : <Menu />}</button>
      </div>

      {/* MOBIL MENY (Expandable) */}
      {isMobileMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-white border-b border-slate-100 p-6 flex flex-col gap-4 shadow-xl md:hidden animate-in slide-in-from-top-5">
          {user && hasAccess && (
            <button onClick={() => { onNavigate('dashboard'); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 text-lg font-bold text-violet-700 bg-violet-50 p-3 rounded-xl">
              <BarChart3 size={20} /> Dashboard
            </button>
          )}
          <button onClick={() => { onNavigate('deepdive'); setIsMobileMenuOpen(false); }} className="text-left font-bold text-slate-600 p-2">Bli synlig på google</button>
          <button onClick={() => { onNavigate('technology'); setIsMobileMenuOpen(false); }} className="text-left font-bold text-slate-600 p-2">Teknologien</button>
          {user && (
            <button onClick={() => { onLogout(); setIsMobileMenuOpen(false); }} className="text-left font-bold text-rose-500 p-2 flex items-center gap-2"><LogOut size={16} /> Logg ut</button>
          )}
          {!user && (
            <button onClick={() => { onLoginTrigger(); setIsMobileMenuOpen(false); }} className="bg-slate-900 text-white py-3 rounded-xl font-bold">Kom i gang</button>
          )}
        </div>
      )}
    </nav>
  );
};

// --- SETTINGS VIEW (INNSTILLINGER) ---
const SettingsView = ({ user, onBack, initialTab = 'general' }: any) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  // URL LOGIKK
  const [website, setWebsite] = useState('www.minbedrift.no');
  const [urlChangeCount, setUrlChangeCount] = useState(0); // 0 = kan endre, 1 = låst
  const maxUrlChanges = 1;
  const isUrlLocked = urlChangeCount >= maxUrlChanges;

  // BRANSJE LOGIKK
  const [industry, setIndustry] = useState('');
  const [isIndustryOpen, setIsIndustryOpen] = useState(false);
  const [industrySearch, setIndustrySearch] = useState('');

  const industries = ["Advokat", "Arkitekt", "Bakeri", "Bygg og Anlegg", "Frisør", "IT-Konsulent", "Kafe & Restaurant", "Rørlegger", "Webutvikling", "Annet"];
  const filteredIndustries = industries.filter(i => i.toLowerCase().startsWith(industrySearch.toLowerCase()));

  const handleSaveUrl = () => {
    if (isUrlLocked) return;
    setUrlChangeCount(prev => prev + 1);
    alert("Nettadresse oppdatert! Den er nå låst for fremtidige endringer.");
  };

  return (
    <div className="pt-32 pb-20 px-6 max-w-5xl mx-auto min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button onClick={onBack} className="mb-8 text-sm font-bold text-slate-400 hover:text-slate-900 flex items-center gap-2">
        <ArrowRight className="rotate-180" size={16} /> Tilbake
      </button>

      <h1 className="text-3xl font-black mb-10 text-slate-900">Innstillinger</h1>

      <div className="flex flex-col md:flex-row gap-8">
        {/* MENY SIDEBAR */}
        <div className="w-full md:w-64 flex flex-col gap-2">
          <button onClick={() => setActiveTab('general')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'general' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
            <User size={18} /> Profil & Bedrift
          </button>
          <button onClick={() => setActiveTab('billing')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'billing' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
            <CreditCard size={18} /> Abonnement
          </button>
        </div>

        {/* INNHOLD */}
        <div className="flex-1">

          {/* FANE 1: PROFIL & BEDRIFT */}
          {activeTab === 'general' && (
            <div className="space-y-6">

              {/* Nettadresse med Lås */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-900">Nettadresse</h3>
                  {isUrlLocked && <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded-full flex items-center gap-1"><Shield size={10} /> Låst</span>}
                </div>

                <div className={`flex items-center border rounded-lg p-2 transition-colors ${isUrlLocked ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200 focus-within:ring-2 focus-within:ring-violet-500'}`}>
                  <Globe size={18} className="text-slate-400 mx-2" />
                  <input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    disabled={isUrlLocked}
                    className={`flex-1 outline-none font-medium ${isUrlLocked ? 'bg-transparent text-slate-500 cursor-not-allowed' : 'text-slate-900'}`}
                  />
                  {!isUrlLocked && (
                    <button onClick={handleSaveUrl} className="bg-slate-900 text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-violet-600 transition-colors">
                      Lagre
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  <span className="font-bold text-slate-500">OBS:</span> Du kan kun endre nettadressen 1 gang.
                </p>
              </div>

              {/* Bransje (Søkbar) */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="font-bold mb-4 text-slate-900">Bransje</h3>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Søk bransje..."
                    value={industrySearch}
                    onFocus={() => setIsIndustryOpen(true)}
                    onChange={(e) => { setIndustrySearch(e.target.value); setIsIndustryOpen(true); }}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg bg-white outline-none font-medium text-slate-900 focus:ring-2 focus:ring-violet-500"
                  />
                  {/* Dropdown liste */}
                  {isIndustryOpen && industrySearch.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-100 rounded-xl shadow-xl z-20">
                      {filteredIndustries.map((item) => (
                        <button key={item} onClick={() => { setIndustry(item); setIndustrySearch(item); setIsIndustryOpen(false); }} className="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 hover:bg-violet-50 hover:text-violet-600 transition-colors">
                          {item}
                        </button>
                      ))}
                      {filteredIndustries.length === 0 && <div className="p-3 text-sm text-slate-400 italic">Ingen treff...</div>}
                    </div>
                  )}
                </div>
                {industry && <p className="mt-2 text-sm text-slate-600 font-bold">Valgt: <span className="text-violet-600">{industry}</span></p>}
              </div>

              {/* Slett Konto */}
              <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100">
                <h3 className="text-rose-900 font-bold mb-2">Farlig område</h3>
                <button onClick={() => alert("Funksjonalitet for sletting kommer.")} className="flex items-center gap-2 text-rose-600 font-bold bg-white px-4 py-2 rounded-lg border border-rose-200 hover:bg-rose-100 transition-colors">
                  <Trash2 size={16} /> Slett min konto
                </button>
              </div>
            </div>
          )}

          {/* FANE 2: ABONNEMENT */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Nåværende plan</p>
                  <h3 className="text-3xl font-black mb-2">Gratis</h3>
                  <button className="bg-white text-slate-900 px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-violet-50 transition-colors mt-4">Endre plan</button>
                </div>
                <div className="absolute top-0 right-0 p-32 bg-violet-600 rounded-full blur-3xl opacity-20 -mr-16 -mt-16"></div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="font-bold mb-4 text-slate-900">Fakturahistorikk</h3>
                <div className="p-4 bg-slate-50 rounded-lg text-center text-slate-400 text-sm font-medium">Ingen fakturaer funnet</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


// --- LOGIN PAGE (KUN GOOGLE) ---
const LoginPage = ({ onBack }: { onBack: () => void }) => {

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '?payment_success=true', // Sender dem tilbake riktig sted
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) throw error;
    } catch (error: any) {
      alert('Kunne ikke logge inn med Google: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfd] flex flex-col items-center justify-center p-4 relative overflow-hidden">

      {/* Bakgrunnsdekorasjon */}
      <div className="absolute inset-0 grid-pattern opacity-[0.04] pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-100/40 blur-[100px] rounded-full pointer-events-none animate-pulse"></div>

      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white/50 p-8 sm:p-12 relative z-10 text-center animate-in fade-in zoom-in-95 duration-500">

        {/* Ikon / Header */}
        <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-slate-200 rotate-3 hover:rotate-6 transition-transform">
          <Sparkles className="text-white w-8 h-8" />
        </div>

        <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Velkommen</h2>
        <p className="text-slate-500 font-medium mb-10 leading-relaxed">
          Logg inn for å få tilgang til analysen din. <br /> Vi bruker Google for maksimal sikkerhet.
        </p>

        {/* GOOGLE KNAPP (Eneste valg) */}
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 hover:border-violet-200 hover:bg-violet-50 text-slate-700 font-bold py-4 px-6 rounded-xl transition-all shadow-sm hover:shadow-md group transform active:scale-95"
        >
          {/* Google Logo SVG */}
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          <span className="group-hover:text-violet-700 transition-colors">Fortsett med Google</span>
        </button>

        {/* TILBAKE KNAPP */}
        <button
          onClick={onBack}
          className="mt-8 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center gap-2 mx-auto"
        >
          <ArrowLeft size={16} /> Gå tilbake til forsiden
        </button>

      </div>

      {/* Sikkerhets-footer */}
      <div className="absolute bottom-6 flex gap-4 text-xs font-bold text-slate-300 uppercase tracking-widest">
        <span className="flex items-center gap-1"><ShieldCheck size={12} /> Sikker innlogging</span>
        <span className="flex items-center gap-1"><Key size={12} /> Kryptert</span>
      </div>

    </div>
  );
};



// --- DASHBOARD VIEW (Looker Studio) ---
const DashboardView = ({ user, onBack }: { user: any, onBack: () => void }) => {
  const [loading, setLoading] = useState(true);
  // URL til din Looker Studio rapport
  const REPORT_URL = "https://lookerstudio.google.com/embed/reporting/b20556ef-7296-4ce3-b391-2d6acb70dc13/page/4flmF?rm=minimal";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col h-screen">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">{user?.email?.charAt(0).toUpperCase()}</div>
          <div><h2 className="font-bold text-slate-800">Ditt SEO Dashboard</h2><p className="text-xs text-slate-500">Live data fra Google</p></div>
        </div>
        <button onClick={onBack} className="text-sm font-bold text-slate-600 hover:text-slate-900">Tilbake</button>
      </div>
      <div className="flex-grow relative bg-white w-full h-full overflow-hidden">
        {loading && <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10 text-slate-500">Henter ferske tall...</div>}
        <iframe src={REPORT_URL} className="w-full h-full border-0" frameBorder="0" allowFullScreen onLoad={() => setLoading(false)} title="SEO Rapport" />
      </div>
    </div>
  );
};



// --- HJELPEKOMPONENT: LÅST SEKSJON ---
const LockedSection = ({
  title,
  description,
  reqPackage,
  onUpgrade,
  color = "violet"
}: {
  title: string,
  description: string,
  reqPackage: string,
  onUpgrade: () => void,
  color?: string
}) => (
  <div className={`relative w-full rounded-2xl overflow-hidden border border-white/5 bg-slate-900/50 p-8 text-center group hover:border-${color}-500/30 transition-all`}>
    {/* Glass-effekt bakgrunn */}
    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] z-0"></div>

    <div className="relative z-10 flex flex-col items-center">
      <div className={`w-12 h-12 bg-${color}-500/10 text-${color}-400 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-${color}-900/20 group-hover:scale-110 transition-transform border border-${color}-500/20`}>
        <Lock size={20} />
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-slate-400 max-w-md mb-6 text-sm">{description}</p>
      <button onClick={onUpgrade} className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:shadow-lg hover:shadow-violet-500/25 transition-all border border-white/10">
        <Zap size={16} fill="currentColor" /> Lås opp i {reqPackage}
      </button>
    </div>
  </div>
);

// --- HJELPEKOMPONENT: STATUS KORT (Dashboard) ---
const StatusCard = ({ icon: Icon, title, value, subtext, color }: any) => (
  <div className="bg-slate-900/50 backdrop-blur-md p-6 rounded-2xl border border-white/5 flex flex-col justify-between hover:border-white/10 transition-all shadow-xl shadow-black/20 group relative overflow-hidden">
    <div className={`absolute -right-10 -top-10 w-20 h-20 bg-${color}-500/10 blur-3xl rounded-full group-hover:bg-${color}-500/20 transition-all`}></div>
    <div className="flex justify-between items-start mb-4 relative z-10">
      <div className={`p-3 rounded-xl bg-${color}-500/10 text-${color}-400 border border-${color}-500/10`}>
        <Icon size={24} />
      </div>
      {subtext && <span className={`text-xs font-bold px-2 py-1 rounded-full bg-${color}-500/10 text-${color}-400 border border-${color}-500/10`}>{subtext}</span>}
    </div>
    <div className="relative z-10">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">{title}</p>
      <p className="text-3xl font-black text-white tracking-tight">{value}</p>
    </div>
  </div>
);

// --- HOVEDKOMPONENT: CLIENT PORTAL ---
const ClientPortal = ({ user, onLogout }: { user: any, onLogout: () => void }) => {

  // 1. STATE & VARIABLER
  const [clientData, setClientData] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Analyse State
  const [analysisResults, setAnalysisResults] = useState<{ mobile: AnalysisResult; desktop: AnalysisResult } | null>(null);
  const [activeDevice, setActiveDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('Forbereder...');

  // UI State
  const [isEditing, setIsEditing] = useState(false);
  const [urlUnlockRequested, setUrlUnlockRequested] = useState(false);

  // SØKEORD STATE (EKTE DATA)
  const [keywordsToTrack, setKeywordsToTrack] = useState<string[]>([]);
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [realRankings, setRealRankings] = useState<any[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [filterIntent, setFilterIntent] = useState('All');
  const [filterPos, setFilterPos] = useState('All');

  // --- VIKTIG: VARIABLER & HJELPERE (Må defineres FØR de brukes) ---
  const getPackageLevel = (pkgName: string) => {
    const name = pkgName?.toLowerCase() || '';
    if (name.includes('premium')) return 3;
    if (name.includes('standard')) return 2;
    return 1;
  };

  const currentLevel = clientData ? getPackageLevel(clientData.package_name) : 1;
  const currentPkgName = clientData?.package_name || 'Basic';

  const plans = [
    { name: 'Basic', level: 1, price: '2 990', color: 'slate', features: ['Dashboard', 'Enkel Analyse', 'Månedlig Rapport'] },
    { name: 'Standard', level: 2, price: '5 990', color: 'amber', features: ['Alt i Basic', 'Tiltaksliste', 'Søkeordsporing', 'Konkurrentanalyse'] },
    { name: 'Premium', level: 3, price: '9 990', color: 'violet', features: ['Alt i Standard', 'Teknisk Helse', 'SEO-Garanti', 'Prioritert Support'] }
  ];

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'analysis', label: 'Analyse', icon: Activity },
    { id: 'keywords', label: 'Søkeord', icon: Search },
    { id: 'content', label: 'Innhold', icon: FileText },
    { id: 'links', label: 'Lenker', icon: Link2 },
    { id: 'reports', label: 'Rapporter', icon: FileBarChart },
    { id: 'settings', label: 'Innstillinger', icon: Settings },
  ];

  // 2. DATA FETCHING (Profil)
  useEffect(() => {
    const fetchClientData = async () => {
      if (!user?.email) return;
      const { data } = await supabase.from('clients').select('*').eq('user_id', user.id).maybeSingle();
      if (data) {
        setClientData(data);
        setFormData({
          contactPerson: data.contactPerson, companyName: data.companyName, email: data.email,
          phone: data.phone, websiteUrl: data.websiteUrl, industry: data.industry, targetAudience: data.targetAudience
        });

        // Hent lagrede søkeord fra nettleseren
        const savedKeywords = localStorage.getItem(`keywords_${user.id}`);
        if (savedKeywords) setKeywordsToTrack(JSON.parse(savedKeywords));

        const savedRankings = localStorage.getItem(`rankings_${user.id}`);
        if (savedRankings) {
          setRealRankings(JSON.parse(savedRankings));
          setHasSearched(true);
        }
      }
      setLoading(false);
    };
    fetchClientData();
  }, [user]);

  // 3. ANIMASJON (Analyse)
  useEffect(() => {
    let interval: any;
    if (isAnalyzing) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) return prev;
          const newProgress = prev + (Math.random() * 2);
          if (newProgress < 20) setProgressText('Kobler til Google...');
          else if (newProgress < 40) setProgressText('Laster ned nettsiden...');
          else if (newProgress < 60) setProgressText('Analyserer kode og bilder...');
          else if (newProgress < 80) setProgressText('Sjekker mobiltilpasning...');
          else setProgressText('Genererer enkel rapport...');
          return newProgress;
        });
      }, 200);
    } else { setProgress(100); }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // --- HANDLERS (Generelle) ---
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm("Vil du lagre endringene?")) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('clients').update(formData).eq('user_id', user.id);
      if (error) throw error;
      setClientData({ ...clientData, ...formData });
      setSaveMessage('Lagret!');
      setIsEditing(false);
      setUrlUnlockRequested(false);
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) { console.error(error); setSaveMessage('Feil ved lagring.'); } finally { setSaving(false); }
  };

  const handleChangePlan = async (newPlanName: string) => {
    if (!confirm(`Vil du endre pakke til ${newPlanName}?`)) return;
    setSaving(true);
    try {
      await supabase.from('clients').update({ package_name: newPlanName }).eq('user_id', user.id);
      setClientData({ ...clientData, package_name: newPlanName });
      alert(`Pakke endret til ${newPlanName}!`);
    } catch (err) { alert("Kunne ikke endre pakke."); } finally { setSaving(false); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleUpgrade = () => setActiveTab('settings');
  const handleUnlockUrl = () => { if (confirm("Endring av URL nullstiller historikk. Sikker?")) setUrlUnlockRequested(true); };

  // --- SØKEORD LOGIKK (Den viktige delen) ---
  const handleAddKeyword = () => {
    if (newKeywordInput.trim()) {
      const updated = [...keywordsToTrack, newKeywordInput.trim()];
      setKeywordsToTrack(updated);
      setNewKeywordInput('');
      localStorage.setItem(`keywords_${user.id}`, JSON.stringify(updated));
    }
  };


  const handleCheckRankings = async () => {
    if (currentLevel < 2) return alert("Du må ha Standard pakke.");
    if (!formData.websiteUrl) return alert("Legg inn URL i innstillinger.");

    let activeKeywords = [...keywordsToTrack];
    if (newKeywordInput.trim()) {
      activeKeywords.push(newKeywordInput.trim());
      setKeywordsToTrack(activeKeywords);
      setNewKeywordInput('');
    }
    if (activeKeywords.length === 0) return alert("Legg til et søkeord.");

    setRankingLoading(true);
    setRealRankings([]);
    setHasSearched(true);

    const cleanDomain = formData.websiteUrl.replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0];

    try {
      const promises = activeKeywords.map(async (keyword) => {
        try {
          // Vi kaller din lokale Vercel API i rotmappen (/api/search.js)
          const response = await fetch(`/api/search?keyword=${encodeURIComponent(keyword)}`);

          if (!response.ok) throw new Error("Server feil");

          const data = await response.json();

          if (data.error) throw new Error(data.error);

          let position = 101;
          let url = '-';

          if (data.organic_results) {
            const found = data.organic_results.find((r: any) => r.link && r.link.includes(cleanDomain));
            if (found) {
              position = found.position;
              url = found.link.replace(formData.websiteUrl, '');
            }
          }

          let intent = 'Info';
          const kw = keyword.toLowerCase();
          if (kw.includes('pris') || kw.includes('kjøp')) intent = 'Trans';
          else if (kw.includes('hvor') || kw.includes('nær')) intent = 'Local';

          const advice = position <= 10 ? "Bra jobba!" : "Du må jobbe med innholdet.";
          const ctr = position === 1 ? 32 : position <= 3 ? 15 : position <= 10 ? 3 : 0;

          return { keyword, position, url, intent, ctr, advice, change: 0 };

        } catch (innerError: any) {
          console.error(`Feil på ordet '${keyword}':`, innerError);
          return { keyword, position: 0, url: 'FEIL', intent: 'Error', ctr: 0, advice: 'Feil ved henting', change: 0 };
        }
      });

      const results = await Promise.all(promises);
      setRealRankings(results);

      localStorage.setItem(`rankings_${user.id}`, JSON.stringify(results));
      localStorage.setItem(`keywords_${user.id}`, JSON.stringify(activeKeywords));

    } catch (error) {
      console.error("Total feil:", error);
      alert("Sjekk VITE_SERP_API_KEY i Vercel.");
    } finally {
      setRankingLoading(false);
    }
  };

  const filteredRankings = realRankings.filter(r => {
    if (filterIntent !== 'All' && r.intent !== filterIntent) return false;
    if (filterPos === 'Top3' && r.position > 3) return false;
    if (filterPos === 'Top10' && r.position > 10) return false;
    return true;
  });

  // --- ANALYSE LOGIKK (PageSpeed) ---
  const formatLighthouseData = (data: any): AnalysisResult => {
    const lh = data.lighthouseResult;
    const cats = lh.categories;
    const audits = lh.audits;
    const field = data.loadingExperience?.metrics;

    const getMetric = (fieldKey: string, labKey: string, unit: 's' | 'ms' | 'unitless') => {
      if (field && field[fieldKey]) {
        const val = field[fieldKey].percentile;
        if (unit === 's') return { value: `${(val / 1000).toFixed(1)}s`, score: field[fieldKey].category === 'FAST' ? 0.9 : 0.5 };
        if (unit === 'ms') return { value: `${val}ms`, score: field[fieldKey].category === 'FAST' ? 0.9 : 0.5 };
        if (unit === 'unitless') return { value: (val / 100).toFixed(2), score: field[fieldKey].category === 'FAST' ? 0.9 : 0.5 };
      }
      const audit = audits[labKey];
      if (!audit) return { value: '-', score: 0 };
      if (unit === 's') return { value: `${(audit.numericValue / 1000).toFixed(1)}s`, score: audit.score };
      if (unit === 'ms') return { value: `${Math.round(audit.numericValue)}ms`, score: audit.score };
      return { value: audit.numericValue.toFixed(2), score: audit.score };
    };

    const fcp = getMetric('FIRST_CONTENTFUL_PAINT_MS', 'first-contentful-paint', 's');
    const lcp = getMetric('LARGEST_CONTENTFUL_PAINT_MS', 'largest-contentful-paint', 's');
    const cls = getMetric('CUMULATIVE_LAYOUT_SHIFT_SCORE', 'cumulative-layout-shift', 'unitless');
    const tbtAudit = audits['total-blocking-time'];
    const tbt = { value: tbtAudit ? `${Math.round(tbtAudit.numericValue)}ms` : '-', score: tbtAudit ? tbtAudit.score : 0 };

    const opportunities = Object.values(audits)
      .filter((audit: any) => audit.details && audit.details.type === 'opportunity' && (audit.score !== null && audit.score < 0.9))
      .sort((a: any, b: any) => (b.details.overallSavingsMs || 0) - (a.details.overallSavingsMs || 0))
      .slice(0, 5)
      .map((audit: any) => ({ title: audit.title, description: audit.description.split('[')[0], savings: audit.displayValue || '' }));

    const diagnostics = [
      { title: "Sikker tilkobling (HTTPS)", passed: audits['is-on-https']?.score === 1 },
      { title: "Mobilvennlig tekst", passed: audits['font-size']?.score === 1 },
      { title: "Mobilvennlige knapper", passed: audits['tap-targets']?.score === 1 },
      { title: "Synlig for Google (SEO)", passed: audits['is-crawlable']?.score === 1 },
      { title: "Har beskrivelse (Meta)", passed: audits['meta-description']?.score === 1 },
      { title: "Bilder har tekst (UU)", passed: audits['image-alt']?.score === 1 },
      { title: "Ingen kodefeil", passed: audits['errors-in-console']?.score === 1 },
    ];

    const extras = {
      screenshot: audits['final-screenshot']?.details?.data,
      serverTime: audits['server-response-time']?.displayValue,
      totalWeight: audits['total-byte-weight']?.displayValue
    };

    return {
      performance: Math.round(cats.performance.score * 100),
      seo: Math.round(cats.seo.score * 100),
      accessibility: Math.round(cats.accessibility.score * 100),
      bestPractices: Math.round(cats['best-practices'].score * 100),
      seoDetails: { metaDescription: audits['meta-description'], documentTitle: audits['document-title'], linkText: audits['link-text'], viewport: audits['viewport'] },
      fcp, lcp, cls, tbt,
      opportunities, diagnostics, extras
    };
  };

  const runRealAnalysis = async () => {
    const url = formData.websiteUrl;
    if (!url) { setAnalyzeError("Mangler URL."); return; }
    setIsAnalyzing(true); setAnalyzeError(null); setAnalysisResults(null);
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http')) formattedUrl = 'https://' + formattedUrl;

    try {
      const apiKey = import.meta.env.VITE_PAGESPEED_API_KEY;
      const mobileP = fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(formattedUrl)}&category=PERFORMANCE&category=SEO&category=ACCESSIBILITY&category=BEST_PRACTICES&strategy=mobile&locale=no&key=${apiKey}`);
      const desktopP = fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(formattedUrl)}&category=PERFORMANCE&category=SEO&category=ACCESSIBILITY&category=BEST_PRACTICES&strategy=desktop&locale=no&key=${apiKey}`);
      const [resM, resD] = await Promise.all([mobileP, desktopP]);
      if (!resM.ok || !resD.ok) throw new Error("Kunne ikke analysere siden.");
      setAnalysisResults({ mobile: formatLighthouseData(await resM.json()), desktop: formatLighthouseData(await resD.json()) });
    } catch (err: any) { setAnalyzeError("Noe gikk galt. Sjekk URLen."); } finally { setIsAnalyzing(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950"><div className="animate-pulse text-violet-400 font-bold">Laster...</div></div>;

  return (
    <div className="flex min-h-screen bg-slate-950 font-sans text-slate-200 selection:bg-violet-500/30">
      {/* Bakgrunn */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0"><div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-violet-900/20 rounded-full blur-[120px]"></div></div>

      {/* Sidebar */}
      <aside className="w-20 lg:w-64 bg-slate-900/80 backdrop-blur-xl border-r border-white/5 fixed h-full z-20 flex flex-col shadow-2xl">
        <div className="p-6 flex items-center gap-3 border-b border-white/5"><div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold">S</div><span className="font-black text-xl hidden lg:block text-white">Sikt.</span></div>
        <nav className="flex-1 px-3 py-6 space-y-2">{menuItems.map((item) => (<button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all border ${activeTab === item.id ? 'bg-white/10 text-white border-white/10' : 'text-slate-400 hover:bg-white/5 border-transparent'}`}><item.icon size={20} /><span className="hidden lg:block text-sm font-medium">{item.label}</span></button>))}</nav>
        <div className="p-4 border-t border-white/5"><p className="text-[10px] font-bold text-slate-500 mb-1 hidden lg:block">ABONNEMENT</p><div className="hidden lg:flex justify-between items-center bg-slate-950/50 p-2 rounded-lg border border-white/5 mb-3"><span className="text-xs font-bold text-slate-300 pl-1">{currentPkgName}</span>{currentLevel < 3 && <button onClick={handleUpgrade} className="text-[10px] font-bold text-violet-400">Oppgrader</button>}</div><button onClick={onLogout} className="flex items-center gap-2 text-slate-500 hover:text-rose-400 text-xs font-bold"><LogOut size={16} /><span className="hidden lg:inline">Logg ut</span></button></div>
      </aside>

      {/* Content */}
      <main className="flex-1 ml-20 lg:ml-64 p-6 lg:p-10 max-w-6xl mx-auto relative z-10">
        <header className="flex justify-between items-center mb-8">
          <div><h1 className="text-3xl font-black text-white">{menuItems.find(i => i.id === activeTab)?.label}</h1><p className="text-slate-400 text-sm mt-1 flex gap-2"><Globe size={14} /> {clientData?.websiteUrl || '...'}</p></div>
          <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-violet-400 font-bold">{user.email.charAt(0).toUpperCase()}</div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="text-center p-20 text-slate-500 bg-slate-900/50 rounded-2xl border border-white/5">
            <LayoutDashboard size={40} className="mx-auto mb-4 opacity-50" />
            <h3 className="text-white font-bold">Oversikt</h3>
            <p>Dashboard innhold kommer her.</p>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-24 bg-slate-900/50 rounded-2xl border border-white/5 relative overflow-hidden">
                <div className="absolute inset-0 bg-violet-500/5 animate-pulse"></div>
                <Loader2 className="w-16 h-16 text-violet-400 animate-spin mb-8 relative z-10" />
                <h3 className="text-3xl font-black text-white mb-2">{Math.round(progress)}%</h3>
                <p className="text-violet-300 font-medium mb-8 text-lg animate-pulse">{progressText}</p>
                <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden border border-white/5"><div className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }}></div></div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center bg-slate-900/50 p-6 rounded-2xl border border-white/5">
                  <div><h2 className="text-2xl font-bold text-white">Live Analyse</h2><p className="text-slate-400 text-sm">Sjekker: <span className="text-violet-400">{formData.websiteUrl}</span></p></div>
                  <div className="flex gap-4">
                    {analysisResults && (<div className="bg-slate-950 p-1 rounded-xl border border-white/10 flex"><button onClick={() => setActiveDevice('mobile')} className={`flex gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeDevice === 'mobile' ? 'bg-violet-600 text-white' : 'text-slate-400'}`}><Smartphone size={16} /> Mobil</button><button onClick={() => setActiveDevice('desktop')} className={`flex gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeDevice === 'desktop' ? 'bg-violet-600 text-white' : 'text-slate-400'}`}><Monitor size={16} /> Desktop</button></div>)}
                    <button onClick={runRealAnalysis} disabled={!formData.websiteUrl} className="bg-violet-600 text-white px-6 py-3 rounded-xl font-bold flex gap-2 hover:bg-violet-500"><Zap size={18} /> Ny test</button>
                  </div>
                </div>
                {analyzeError && <div className="p-4 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">{analyzeError}</div>}
                {analysisResults ? (
                  <div key={activeDevice} className="animate-in fade-in zoom-in-95 space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[{ l: 'Ytelse', s: analysisResults[activeDevice].performance }, { l: 'SEO', s: analysisResults[activeDevice].seo }, { l: 'UU', s: analysisResults[activeDevice].accessibility }, { l: 'Praksis', s: analysisResults[activeDevice].bestPractices }].map((i, idx) => (
                        <div key={idx} className={`p-6 rounded-2xl border flex flex-col items-center justify-center ${i.s >= 90 ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : i.s >= 50 ? 'border-amber-500/30 text-amber-400 bg-amber-500/10' : 'border-rose-500/30 text-rose-400 bg-rose-500/10'}`}>
                          <div className="text-4xl font-black mb-1">{i.s}</div><div className="text-xs font-bold uppercase opacity-80">{i.l}</div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                      <div className="md:col-span-1 bg-slate-900/50 p-4 rounded-2xl border border-white/5 flex flex-col items-center h-fit shadow-xl">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-4 w-full text-center">Slik Google ser siden</p>
                        {analysisResults[activeDevice].extras?.screenshot ? (<img src={analysisResults[activeDevice].extras?.screenshot} alt="Screenshot" className="rounded-lg border border-white/10 shadow-sm w-full object-cover" />) : <div className="w-full h-48 bg-slate-800 rounded-lg flex items-center justify-center text-slate-500 text-xs">Ingen bilde</div>}
                      </div>
                      <div className="md:col-span-2 grid grid-cols-2 gap-4">
                        <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5">
                          <h4 className="text-slate-400 text-xs font-bold uppercase mb-2">Server Respons</h4><p className="text-2xl font-bold text-white">{analysisResults[activeDevice].extras?.serverTime || '-'}</p>
                        </div>
                        <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5">
                          <h4 className="text-slate-400 text-xs font-bold uppercase mb-2">Sidens Vekt</h4><p className="text-2xl font-bold text-white">{analysisResults[activeDevice].extras?.totalWeight || '-'}</p>
                        </div>
                        <div className="col-span-2 bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                          <DetailedHealthCheck result={analysisResults[activeDevice]} />
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      {currentLevel >= 2 ? (
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                          <h3 className="font-bold text-slate-900 text-lg mb-4 flex gap-2"><Lightbulb className="text-amber-500" /> Tiltak som gir effekt</h3>
                          <div className="space-y-3">
                            {analysisResults[activeDevice].opportunities?.map((o, i) => (
                              <div key={i} className="flex justify-between p-3 bg-slate-50 rounded-xl border border-slate-100"><div><p className="font-bold text-sm text-slate-800">{o.title}</p><p className="text-xs text-slate-500">{o.description}</p></div><span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded h-fit">Spar {o.savings}</span></div>
                            ))}
                          </div>
                        </div>
                      ) : <LockedSection title="Se konkrete tiltak" description="Få listen over hva som må fikses." reqPackage="Standard" onUpgrade={handleUpgrade} color="amber" />}
                    </div>
                    <div className="mt-4">
                      {currentLevel >= 3 ? (
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                          <h3 className="font-bold text-slate-900 text-lg mb-4 flex gap-2"><ShieldCheck className="text-violet-500" /> Teknisk Helsesjekk</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {analysisResults[activeDevice].diagnostics?.map((d, i) => (
                              <div key={i} className="flex justify-between p-3 bg-slate-50 rounded-xl border border-slate-100"><span className="text-sm font-medium text-slate-700">{d.title}</span>{d.passed ? <span className="text-emerald-500 text-xs font-bold flex gap-1"><CheckCircle2 size={14} /> OK</span> : <span className="text-rose-500 text-xs font-bold flex gap-1"><XCircle size={14} /> FEIL</span>}</div>
                            ))}
                          </div>
                        </div>
                      ) : <LockedSection title="Teknisk Helsesjekk" description="Full sikkerhets- og SEO-gjennomgang." reqPackage="Premium" onUpgrade={handleUpgrade} color="violet" />}
                    </div>
                  </div>
                ) : <div className="text-center py-20 bg-slate-900/30 rounded-2xl border border-white/5 border-dashed"><Activity className="w-10 h-10 text-slate-500 mx-auto mb-4" /><h3 className="text-white font-bold">Klar for test</h3><p className="text-slate-400 text-sm">Vi sjekker både mobil og desktop.</p></div>}
              </>
            )}
          </div>
        )}

        {/* --- 10-PUNKTS SØKEORD SIDE --- */}
        {activeTab === 'keywords' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">

            {/* Header og Input */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-8">
              <div><h1 className="text-3xl font-black text-white">Søkeord</h1><p className="text-slate-400 text-sm">Spor dine rangeringer på Google Norge.</p></div>
              <div className="flex gap-2 w-full md:w-auto bg-slate-900/80 p-1.5 rounded-xl border border-white/10">
                <input value={newKeywordInput} onChange={(e) => setNewKeywordInput(e.target.value)} placeholder={currentLevel < 2 ? "Oppgrader for å legge til" : "Nytt søkeord..."} disabled={currentLevel < 2} className="bg-transparent pl-3 text-sm text-white outline-none w-full md:w-48" />
                <button onClick={handleAddKeyword} disabled={currentLevel < 2} className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold">+</button>
                <button
                  onClick={handleCheckRankings}
                  disabled={rankingLoading || currentLevel < 2 || (keywordsToTrack.length === 0 && !newKeywordInput)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${currentLevel < 2 || (keywordsToTrack.length === 0 && !newKeywordInput)
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-900/20'
                    }`}
                >
                  {rankingLoading ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} />}
                  {rankingLoading ? 'Henter fra Google...' : 'Oppdater Rangeringer'}
                </button>
              </div>
            </div>

            {/* 1. OVERSIKT (TOP CARDS) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900/50 p-5 rounded-2xl border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Layers size={40} className="text-white" /></div>
                <p className="text-slate-400 text-xs font-bold uppercase">Totalt Funnet</p>
                <p className="text-3xl font-black text-white mt-1">{hasSearched ? realRankings.filter(r => r.position <= 100).length : '-'}</p>
                <p className="text-slate-500 text-[10px] mt-1">Av {keywordsToTrack.length} sjekket</p>
              </div>
              <div className="bg-slate-900/50 p-5 rounded-2xl border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Target size={40} className="text-white" /></div>
                <p className="text-slate-400 text-xs font-bold uppercase">Topp 10</p>
                <p className="text-3xl font-black text-white mt-1">{hasSearched ? realRankings.filter(r => r.position <= 10).length : '-'}</p>
                <p className="text-emerald-400 text-[10px] mt-1 font-bold flex gap-1 items-center"><CheckCircle2 size={10} /> Side 1</p>
              </div>
              <div className="bg-slate-900/50 p-5 rounded-2xl border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={40} className="text-white" /></div>
                <p className="text-slate-400 text-xs font-bold uppercase">Endring</p>
                <p className="text-3xl font-black text-white mt-1">
                  {hasSearched ? (() => {
                    const netChange = realRankings.reduce((acc, curr) => acc + (curr.change || 0), 0);
                    return netChange > 0 ? `+${netChange}` : netChange;
                  })() : '-'}
                </p>
                <p className="text-slate-500 text-[10px] mt-1">Siden forrige søk</p>
              </div>
              <div className="bg-slate-900/50 p-5 rounded-2xl border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Eye size={40} className="text-white" /></div>
                <p className="text-slate-400 text-xs font-bold uppercase">Trafikkpotensial</p>
                <p className="text-3xl font-black text-white mt-1">{hasSearched ? Math.round(realRankings.reduce((acc, curr) => acc + curr.ctr, 0)) + '%' : '-'}</p>
                <p className="text-slate-500 text-[10px] mt-1">Estimert CTR</p>
              </div>
            </div>

            {/* 4. HISTORISK GRAF */}
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-white flex items-center gap-2"><BarChart2 size={18} className="text-violet-400" /> Rangeringstrend</h3>
                {currentLevel < 2 && <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded border border-white/5 flex gap-1 items-center"><Lock size={10} /> Standard</span>}
              </div>
              {currentLevel >= 2 ? (
                <div className="h-40 flex items-end justify-around gap-2 px-4 border-b border-white/5 pb-2">
                  {['1-3', '4-10', '11-20', '21-50', '50+'].map((label, i) => {
                    const count = realRankings.filter(r => {
                      if (i === 0) return r.position <= 3;
                      if (i === 1) return r.position > 3 && r.position <= 10;
                      if (i === 2) return r.position > 10 && r.position <= 20;
                      if (i === 3) return r.position > 20 && r.position <= 50;
                      return r.position > 50;
                    }).length;
                    const height = keywordsToTrack.length > 0 ? (count / keywordsToTrack.length) * 100 : 0;
                    return (
                      <div key={label} className="w-full flex flex-col items-center gap-2">
                        <div className="w-12 bg-violet-500/20 rounded-t-md relative group hover:bg-violet-500/40 transition-all" style={{ height: `${height === 0 ? 5 : height}%`, minHeight: '10px' }}>
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-white opacity-0 group-hover:opacity-100">{count}</div>
                        </div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold">{label}</span>
                      </div>
                    );
                  })}
                </div>
              ) : <LockedSection title="Se historikk" description="Oppgrader for å se utvikling." reqPackage="Standard" onUpgrade={handleUpgrade} color="blue" />}
            </div>

            {/* 3. FILTER & 2. HOVEDTABELL */}
            <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden">
              <div className="p-4 border-b border-white/5 flex gap-2 overflow-x-auto">
                <button onClick={() => setFilterPos('All')} className={`px-3 py-1 text-xs font-bold rounded-lg border ${filterPos === 'All' ? 'bg-white/10 text-white border-white/20' : 'border-transparent text-slate-400'}`}>Alle</button>
                <button onClick={() => setFilterPos('Top3')} className={`px-3 py-1 text-xs font-bold rounded-lg border ${filterPos === 'Top3' ? 'bg-white/10 text-white border-white/20' : 'border-transparent text-slate-400'}`}>Topp 3</button>
                <button onClick={() => setFilterPos('Top10')} className={`px-3 py-1 text-xs font-bold rounded-lg border ${filterPos === 'Top10' ? 'bg-white/10 text-white border-white/20' : 'border-transparent text-slate-400'}`}>Topp 10</button>
                <div className="w-px h-6 bg-white/10 mx-2"></div>
                {['Informational', 'Transactional', 'Commercial', 'Local'].map(i => (
                  <button key={i} onClick={() => setFilterIntent(filterIntent === i ? 'All' : i)} className={`px-3 py-1 text-xs font-bold rounded-lg border ${filterIntent === i ? 'bg-violet-500/20 text-violet-300 border-violet-500/30' : 'border-transparent text-slate-400'}`}>{i}</button>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs font-bold text-slate-500 uppercase border-b border-white/5 bg-white/5">
                      <th className="p-4">Søkeord</th>
                      <th className="p-4">Posisjon</th>
                      <th className="p-4 hidden sm:table-cell">Endring</th>
                      {currentLevel >= 2 && <th className="p-4 hidden md:table-cell">Intent</th>}
                      {currentLevel >= 2 && <th className="p-4 hidden lg:table-cell">CTR Est.</th>}
                      <th className="p-4 hidden xl:table-cell">URL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {hasSearched ? (
                      filteredRankings.length > 0 ? filteredRankings.map((k, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-colors">
                          <td className="p-4 font-bold text-white">{k.keyword}</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${k.position <= 3 ? 'bg-emerald-500/20 text-emerald-400' : k.position <= 10 ? 'bg-blue-500/20 text-blue-400' : k.position > 100 ? 'bg-slate-800 text-slate-500' : 'bg-amber-500/20 text-amber-400'}`}>
                              {k.position > 100 ? '100+' : `#${k.position}`}
                            </span>
                          </td>
                          <td className="p-4 hidden sm:table-cell">
                            {k.change !== 0 ? (
                              <span className={`flex items-center gap-1 text-xs font-bold ${k.change > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {k.change > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />} {Math.abs(k.change)}
                              </span>
                            ) : <span className="text-slate-600 text-xs">-</span>}
                          </td>
                          {currentLevel >= 2 && (
                            <td className="p-4 hidden md:table-cell">
                              <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold border ${k.intent === 'Informational' ? 'text-sky-400 border-sky-500/30' : k.intent === 'Transactional' ? 'text-emerald-400 border-emerald-500/30' : 'text-violet-400 border-violet-500/30'}`}>{k.intent.substring(0, 4)}</span>
                            </td>
                          )}
                          {currentLevel >= 2 && <td className="p-4 hidden lg:table-cell text-slate-400">{k.ctr}%</td>}
                          <td className="p-4 hidden xl:table-cell text-xs text-slate-500 truncate max-w-[150px]">{k.url}</td>
                        </tr>
                      )) : <tr><td colSpan={6} className="p-8 text-center text-slate-500">Ingen treff med dette filteret.</td></tr>
                    ) : (
                      <tr><td colSpan={6} className="p-8 text-center text-slate-500">{keywordsToTrack.length > 0 ? 'Klar til å søke.' : 'Legg til ord over.'}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. & 8. AI ANALYSE (Standard/Premium) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {currentLevel >= 2 ? (
                <div className="bg-gradient-to-br from-violet-900/20 to-indigo-900/20 p-6 rounded-2xl border border-violet-500/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-30"><BrainCircuit size={60} className="text-violet-500" /></div>
                  <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Sparkles size={18} className="text-violet-400" /> AI Analyse & Optimalisering</h3>
                  <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                    {filteredRankings.length > 0 ? filteredRankings.map((r: any, i: number) => (
                      <div key={i} className="bg-white/5 p-3 rounded-xl border border-white/10">
                        <div className="flex justify-between mb-1">
                          <span className="text-violet-400 font-bold text-xs uppercase">{r.keyword}</span>
                          <span className="text-slate-500 text-xs">#{r.position}</span>
                        </div>
                        <p className="text-sm text-slate-200">{r.advice}</p>
                      </div>
                    )) : <p className="text-sm text-slate-400">Ingen data å analysere.</p>}
                  </div>
                </div>
              ) : <LockedSection title="AI Analyse" description="Få konkrete råd for hvert søkeord." reqPackage="Standard" onUpgrade={handleUpgrade} color="violet" />}

              {/* 6. & 9. STRATEGI (Premium) */}
              {currentLevel >= 3 ? (
                <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5">
                  <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Target size={18} className="text-emerald-400" /> Strategi & Muligheter</h3>
                  <div className="flex flex-col items-center justify-center h-48 text-center bg-slate-950/30 rounded-xl border border-white/5 border-dashed">
                    <Map size={32} className="text-slate-600 mb-2" />
                    <p className="text-sm text-slate-400">Koble til Google Search Console for<br />å finne "Money Keywords" du har oversett.</p>
                    <button className="mt-3 text-xs bg-slate-800 text-white px-3 py-1.5 rounded-lg border border-white/10">Koble til GSC</button>
                  </div>
                </div>
              ) : <LockedSection title="AI Strategi & GSC" description="Vi finner søkeordene du burde rangert på." reqPackage="Premium" onUpgrade={handleUpgrade} color="emerald" />}
            </div>

            {/* 7. SIDE-TIL-SØKEORD MAPPING (Vises kun hvis vi har data) */}
            {hasSearched && realRankings.some(r => r.position <= 100) && (
              <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Map size={18} className="text-blue-400" /> Side-Mapping</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {realRankings.filter(r => r.position <= 10).slice(0, 4).map((r, i) => (
                    <div key={i} className="p-3 border border-white/5 bg-slate-950/30 rounded-xl flex justify-between items-center">
                      <div className="truncate pr-4">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Rangerer på: "{r.keyword}"</p>
                        <p className="text-sm font-bold text-white truncate">{r.url}</p>
                      </div>
                      <span className="text-xs font-bold bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20">#{r.position}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SETTINGS m/ Pakkevelger */}
        {activeTab === 'settings' && (
          <div className="max-w-4xl space-y-8 animate-in fade-in">
            {/* PROFILSKJEMA (Forenklet visning for kode-lengde, men full funksjon) */}
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5">
              <div className="flex justify-between mb-6"><h3 className="font-bold text-white">Profil</h3><button onClick={() => setIsEditing(!isEditing)} className="text-xs bg-slate-800 text-white px-3 py-1 rounded">{isEditing ? 'Avbryt' : 'Rediger'}</button></div>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input disabled={!isEditing} name="contactPerson" value={formData.contactPerson} onChange={handleChange} className="bg-slate-950 border border-white/10 rounded p-2 text-white w-full" placeholder="Navn" />
                  <input disabled={!isEditing} name="companyName" value={formData.companyName} onChange={handleChange} className="bg-slate-950 border border-white/10 rounded p-2 text-white w-full" placeholder="Firma" />
                </div>
                <div className="flex gap-2">
                  <input disabled={!isEditing} name="websiteUrl" value={formData.websiteUrl} onChange={handleChange} className="bg-slate-950 border border-white/10 rounded p-2 text-white w-full" placeholder="URL" />
                </div>
                {isEditing && <button type="submit" className="bg-white text-slate-900 font-bold px-4 py-2 rounded">Lagre</button>}
              </form>
            </div>

            {/* PAKKEVELGER */}
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5">
              <h3 className="font-bold text-white mb-4 flex gap-2"><CreditCard /> Pakker</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.map(p => {
                  const active = currentLevel === p.level;
                  return (
                    <div key={p.name} className={`p-4 rounded-xl border flex flex-col ${active ? 'bg-white/5 border-violet-500' : 'bg-slate-950 border-white/5'}`}>
                      <h4 className="font-bold text-white">{p.name}</h4>
                      <p className="text-xl font-black text-slate-300 my-2">{p.price}</p>
                      <ul className="flex-1 space-y-2 mb-4">{p.features.map(f => <li key={f} className="text-xs text-slate-500 flex gap-2"><Check size={12} /> {f}</li>)}</ul>
                      <button onClick={() => handleChangePlan(p.name)} disabled={active} className={`py-2 rounded text-xs font-bold ${active ? 'bg-white/10 text-slate-500' : 'bg-violet-600 text-white'}`}>{active ? 'Din plan' : 'Velg'}</button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// --- MAIN APP COMPONENT ---
function App() {
  // 1. SJEKK URL FØR VI STARTER (Slik at vi ikke blinker innom Home)
  const searchParams = new URLSearchParams(window.location.search);
  const isPaymentSuccess = searchParams.get('payment_success') === 'true';

  // --- STATE ---
  // Hvis URL sier payment_success, starter vi DIREKTE på 'onboarding'!
  const [view, setView] = useState(isPaymentSuccess ? 'onboarding' : 'home');

  const [user, setUser] = useState<any>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  // Denne funksjonen bruker vi når vi VET at kunden skal inn
  const enterPortalWithDelay = async () => {
    setIsLoading(true); // Slå på loading screen
    await new Promise(resolve => setTimeout(resolve, 2800)); // Vent 2,8 sekunder (for effekt)
    setHasAccess(true); // Gi tilgang
    setIsLoading(false); // Slå av loading (vis portal)

  };




  // --- 2. EFFEKTER ---
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  // Legg denne sammen med de andre variablene øverst i App-komponenten:
  const isFirstLoad = useRef(true);

  // --- REVIDERT HOVEDSJEKK ---
  useEffect(() => {
    let isMounted = true;

    const handleUserRouting = async (user: any, shouldAnimate: boolean) => {
      if (!user) return;

      const { data: client } = await supabase
        .from('clients')
        .select('onboarding_completed')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (client && client.onboarding_completed === true) {

        // HER ER MAGIEN:
        // Hvis shouldAnimate er true (første gang), kjør showet.
        // Hvis shouldAnimate er false (fanebytte), bare sett view uten drama.
        if (shouldAnimate) {
          console.log("Første load/login -> Kjører animasjon");
          setView('dashboard');
          enterPortalWithDelay();
        } else {
          // "Stille" oppdatering
          console.log("Allerede logget inn -> Ingen animasjon");
          setView('dashboard');
          setIsLoading(false); // Sørg for at loader er skjult
        }

      } else {
        // Ikke ferdig med onboarding
        console.log("Kunde er ikke ferdig -> Vi lar dem bli på forsiden.");
      }
    };

    const checkInitialStatus = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        if (isMounted) {
          setUser(null);
          setView('home');
          setIsLoading(false);
        }
        return;
      }

      if (isMounted) {
        setUser(user);

        // Sjekk om dette er en retur fra betaling
        if (new URLSearchParams(window.location.search).get('payment_success') === 'true') {
          setView('onboarding');
          return;
        }

        // FØRSTE LOAD: Her sender vi 'true' for å si "Ja, kjør animasjon"
        await handleUserRouting(user, true);

        // Nå er vi ferdige med første runde. Sett ref til false.
        // Da vet resten av koden at vi ikke skal animere mer.
        isFirstLoad.current = false;
      }
    };

    checkInitialStatus();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Ignorer tokens som oppdateres
      if (event === 'TOKEN_REFRESHED') return;

      if (event === 'SIGNED_OUT') {
        if (isMounted) {
          setUser(null);
          setHasAccess(false);
          setView('home');
          setIsLoading(false);
          isFirstLoad.current = true; // Resett til neste gang
        }
      }
      else if (event === 'SIGNED_IN' && session) {
        if (isMounted) {
          setUser(session.user);

          // VIKTIGST: 
          // Vi sjekker isFirstLoad.current.
          // Er det første gang? Ja -> Animer.
          // Er det bare et fanebytte (isFirstLoad er false)? Nei -> Ikke animer.
          const skalAnimere = isFirstLoad.current;

          handleUserRouting(session.user, skalAnimere);

          // Sikre at den er false etterpå uansett
          isFirstLoad.current = false;
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);
  const handleLoginTrigger = () => setView('login');
  const handleBack = () => setView('home');

  const handlePlanSelect = async (plan: string) => {
    // 1. Hent bruker FØRST – vi trenger ID-en til Stripe-linken
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setView('login');
      return;
    }

    // 2. Finn riktig Stripe-link
    let stripeBaseUrl = "";

    if (plan.includes('PREMIUM')) {
      stripeBaseUrl = 'https://buy.stripe.com/test_5kQfZievo3gaeFL84Ads402';
    }
    else if (plan.includes('STANDARD')) {
      stripeBaseUrl = 'https://buy.stripe.com/test_4gMcN63QKbMG55b1Gcds401';
    }
    else if (plan.includes('BASIC')) {
      stripeBaseUrl = 'https://buy.stripe.com/test_eVq5kE870g2WeFL84Ads400';
    }

    if (!stripeBaseUrl) {
      alert("Fant ingen betalingslenke for denne pakken.");
      return;
    }

    // 3. KONSTRUER URL MED SPORING (Viktig!)
    // client_reference_id: Dette er feltet Stripe bruker for å vite HVEM som kjøpte.
    // prefilled_email: Gjør det enklere for kunden (e-posten er ferdig utfylt).
    const targetUrl = `${stripeBaseUrl}?client_reference_id=${user.id}&prefilled_email=${encodeURIComponent(user.email || '')}`;

    console.log("Sender bruker til Stripe med ID:", user.id);

    // 4. Send brukeren direkte til betaling
    // Vi lagrer IKKE i databasen før pengene er på konto.
    window.location.href = targetUrl;
  };

  // --- 3. LOGOUT HANDLER (Lim inn denne under useEffect) ---
  const handleLogout = async () => {
    try {
      // 1. Nullstill appen lokalt FØRST
      setUser(null);
      setHasAccess(false);
      setView('home');

      // 2. Fjern KUN Supabase sine nøkler fra minnet
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      });

      // 3. Fortell Supabase at vi logger ut
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Logout feil:", error);
      }
    } catch (error) {
      console.error("Logout exception:", error);
      // Sikring: Logg ut lokalt uansett
      setUser(null);
      setHasAccess(false);
      setView('home');
    }
  };

  // HER ER MAGIEN: Når skjemaet er ferdig -> Gå til Setup Guide
  const handleOnboardingComplete = () => {
    setView('setup_guide');
  };

  // --- 4. RENDER (LOGIKK FOR VISNING) ---
  // 💎 "CONTROL CENTER" LOADING SCREEN (Fullskjerm-aktivitet)
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col items-center justify-center overflow-hidden font-sans">

        {/* --- BAKGRUNN: DOT MATRIX (Fyller tomrommet) --- */}
        {/* Dette lager et svakt mønster av prikker over hele skjermen */}
        <div className="absolute inset-0 opacity-[0.4]"
          style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
        </div>

        {/* Myk lys-vignett i midten for å fremheve sentrum */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(248,250,252,0.8)_70%)] pointer-events-none"></div>


        {/* --- PERIFERE ELEMENTER (De svevende kortene rundt) --- */}

        {/* 1. TOPP VENSTRE: Server Status */}
        <div className="absolute top-[10%] left-[10%] hidden md:block animate-[float_6s_ease-in-out_infinite]">
          <div className="bg-white/60 backdrop-blur-md border border-white/50 p-4 rounded-2xl shadow-lg w-48">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 01-2 2v4a2 2 0 012 2h14a2 2 0 012-2v-4a2 2 0 01-2-2m-2-4h.01M17 16h.01" /></svg>
              </div>
              <div className="h-2 w-20 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 w-2/3 animate-[loading_2s_ease-in-out_infinite]"></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-1.5 w-full bg-slate-100 rounded-full"></div>
              <div className="h-1.5 w-2/3 bg-slate-100 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* 2. TOPP HØYRE: Sikkerhetssjekk */}
        <div className="absolute top-[15%] right-[12%] hidden md:block animate-[float_7s_ease-in-out_infinite_1s]">
          <div className="bg-white/60 backdrop-blur-md border border-white/50 p-4 rounded-2xl shadow-lg w-40 flex flex-col items-center">
            <div className="mb-2 relative">
              <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-20"></div>
              <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sikkerhet OK</p>
          </div>
        </div>

        {/* 3. BUNN VENSTRE: Database Kobling */}
        <div className="absolute bottom-[15%] left-[12%] hidden md:block animate-[float_8s_ease-in-out_infinite_0.5s]">
          <div className="bg-white/60 backdrop-blur-md border border-white/50 p-4 rounded-2xl shadow-lg flex gap-3 items-center">
            <div className="flex space-x-1">
              <div className="w-1.5 h-6 bg-violet-400 rounded-full animate-[pulse_1s_ease-in-out_infinite]"></div>
              <div className="w-1.5 h-4 bg-violet-300 rounded-full animate-[pulse_1s_ease-in-out_infinite_0.2s]"></div>
              <div className="w-1.5 h-8 bg-violet-500 rounded-full animate-[pulse_1s_ease-in-out_infinite_0.4s]"></div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-700">Henter data...</p>
              <p className="text-[10px] text-slate-400">Synkroniserer</p>
            </div>
          </div>
        </div>

        {/* 4. BUNN HØYRE: Optimalisering */}
        <div className="absolute bottom-[10%] right-[10%] hidden md:block animate-[float_6s_ease-in-out_infinite_2s]">
          <div className="bg-white/60 backdrop-blur-md border border-white/50 p-3 rounded-2xl shadow-lg">
            <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-violet-500 animate-spin"></div>
          </div>
        </div>


        {/* --- SENTRUM (Hovedfokus) --- */}
        <div className="relative z-20 scale-125 mb-10">
          {/* Ytre ring */}
          <div className="absolute inset-[-30px] rounded-full border border-violet-100/80 animate-[spin_8s_linear_infinite]">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[4px] w-3 h-3 bg-violet-400 rounded-full shadow-[0_0_15px_rgba(167,139,250,0.6)]"></div>
          </div>
          {/* Mellomste ring */}
          <div className="absolute inset-[-15px] rounded-full border border-slate-200 animate-[spin_5s_linear_reverse_infinite]">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[3px] w-2 h-2 bg-indigo-400 rounded-full"></div>
          </div>
          {/* KJERNEN (Prismet) */}
          <div className="relative w-28 h-28 bg-white/40 backdrop-blur-xl rounded-3xl shadow-[0_20px_50px_rgba(124,58,237,0.2)] border border-white/60 flex items-center justify-center rotate-45 animate-[pulse_3s_ease-in-out_infinite]">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl shadow-inner rotate-[-45deg] flex items-center justify-center">
              <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            </div>
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/80 to-transparent rounded-t-3xl pointer-events-none"></div>
          </div>
        </div>

        {/* --- TEKST --- */}
        <div className="relative z-20 flex flex-col items-center space-y-3">
          <h2 className="text-3xl font-black text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-violet-700 to-slate-900 bg-[length:200%_auto] animate-[shimmer_3s_linear_infinite]">
            Klargjør Portal
          </h2>
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">Verifiserer tilgang</p>
            <div className="w-64 h-1.5 bg-slate-200 rounded-full overflow-hidden shadow-inner mt-2">
              <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full animate-[loading_1.5s_ease-in-out_infinite] w-1/3"></div>
            </div>
          </div>
        </div>

        {/* --- CSS --- */}
        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
          }
          @keyframes shimmer {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
          @keyframes loading {
            0% { transform: translateX(-150%); }
            50% { transform: translateX(0%); }
            100% { transform: translateX(150%); }
          }
        `}</style>
      </div>
    );
  }

  // ---------------------------------------------------------
  // 🚪 DØRVAKT 1: FERDIG KUNDE (VIP)
  // ---------------------------------------------------------
  // Hvis brukeren er logget inn OG har betalt (hasAccess),
  // sendes de rett til ClientPortal. De får IKKE se hjemmesiden.
  if (user && hasAccess) {
    return <ClientPortal user={user} onLogout={handleLogout} />;
  }

  // ---------------------------------------------------------
  // 🚪 DØRVAKT 2: PROSESS (Registrering)
  // ---------------------------------------------------------
  // Hvis brukeren holder på med bestilling, vis kun det steget.
  // Ingen meny, ingen footer, ingen distraksjoner.

  // 🚪 DØRVAKT 2: PROSESS
  if (view === 'onboarding') {
    // 👇 HER MÅ DU LEGGE TIL: user={user}
    return <OnboardingPage user={user} onComplete={() => setView('setup')} />;
  }

  if (view === 'setup' || view === 'setup_guide') { // Håndterer begge navnene for sikkerhets skyld
    return <SetupGuide onComplete={() => { setHasAccess(true); setView('success'); }} />;
  }

  if (view === 'success') {
    // Når de trykker "Gå videre" her, vil Dørvakt 1 (øverst) slå inn fordi hasAccess nå er true.
    return <SuccessPage onBackHome={() => window.location.reload()} />;
  }

  // ---------------------------------------------------------
  // 🏠 HOVEDHUSET (For nye besøkende / ikke-kunder)
  // ---------------------------------------------------------
  // Hvis ingen av dørvaktene over stoppet oss, viser vi den vanlige nettsiden.

  return (
    <div className="min-h-screen selection:bg-violet-100 selection:text-violet-900 bg-[#fcfcfd] relative overflow-x-hidden">
      <GlobalDecorations />

      {/* Navbar for vanlige besøkende */}
      {view !== 'login' && (
        <Navbar
          currentView={view}
          onNavigate={setView}
          user={user}
          onLoginTrigger={handleLoginTrigger}
          onLogout={handleLogout}
          hasAccess={hasAccess}
        />
      )}

      <main className="relative z-10">

        {view === 'home' && (

          <HomeView onNavigate={setView} onSelectPlan={handlePlanSelect} />

        )}

        {view === 'login' && <LoginPage onBack={() => setView('home')} />}

        {view === 'technology' && <TechnologyView onNavigate={setView} />}

        {(view === 'profile' || view === 'billing') && (
          <SettingsView
            user={user}
            onBack={() => setView('home')}
            initialTab={view === 'billing' ? 'billing' : 'general'}
          />
        )}

        {/* DeepDive vises hvis vi ikke er på en av spesialsidene */}
        {view === 'deepdive' && (
          <DeepDiveView
            onBack={() => setView('home')}
            onSelectPlan={() => handlePlanSelect('PREMIUM')}
          />
        )}

      </main>

      {/* Footer vises kun på vanlige sider */}
      {view !== 'login' && view !== 'profile' && view !== 'billing' && (
        <Footer onNavigate={setView} />
      )}
    </div>
  );
}

export default App;