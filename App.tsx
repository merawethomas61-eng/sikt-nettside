import { PaymentModal } from './PaymentModal';
import { CodeIntegrationStep } from './CodeIntegrationStep';
// (Endre './CodeIntegrationStep' til './components/CodeIntegrationStep' hvis du la filen i en components-mappe)
import { DetailedHealthCheck } from './src/components/DetailedHealthCheck';
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  ArrowRight, Timer, ArrowDown, Eye, Trophy, Sun, BarChart2, Map as MapIcon, Users, Key, Check, Search, Zap, Target, ChevronDown, Menu, X, Sparkles, CalendarClock,
  MousePointer2, TrendingUp, Cpu, Globe, Activity, ArrowUpRight, User, MonitorCheck, Code2, PenTool,
  SearchIcon, TrendingDown, ImageIcon, ShoppingBag, Clock, AlertTriangle, MessageCircle, HelpCircle, LayoutDashboard, FileText, Link2,
  Home, Linkedin, Twitter, Mail, ShieldCheck, Wrench, Globe2, Stars, Frown, Radar, FileBarChart, AlertOctagon,
  Layers, Minus, BarChart3, GitMerge, Rocket, Shield, Lightbulb, Monitor, HeartHandshake, Lock, ChevronRight,
  BrainCircuit, Moon, BarChart4, CalendarDays, Award, Unlink, SearchCheck, Database, Server, LogOut, Coffee, Save, XCircle, AlertCircle, Edit2,
  Settings, Smartphone, ChevronLeft, ArrowUp, ArrowUpCircle, ArrowDownCircle, ShieldAlert, CreditCard, FileEdit, RefreshCw, LifeBuoy, Loader2, Trash2, Briefcase, Download, CheckCircle2, ArrowLeft, CheckCircle, Copy, ExternalLink
} from 'lucide-react';



// --- ZERO COGNITIVE LOAD ORDBOK ---
const seoDictionary: Record<string, any> = {
  'meta-description': {
    title: 'Mangler Meta-beskrivelse',
    what: 'Siden din mangler den lille teksten som vises under den blå lenken på Google.',
    why: 'Uten denne teksten lar du Google gjette hva siden handler om. En god tekst her fungerer som en reklameplakat som får folk til å klikke.',
    steps: ['Logg inn på nettsiden din (f.eks. WordPress, Wix).', 'Finn SEO-innstillingene for den spesifikke siden.', 'Skriv en selgende tekst på 150 tegn som forteller nøyaktig hva kunden får her.'],
    aiPrompt: 'rewrite'
  },
  'unused-javascript': {
    title: 'Fjern ubrukt kode (JavaScript)',
    what: 'Nettleseren må laste ned og lese kode som egentlig ikke brukes på denne siden.',
    why: 'Dette gjør at nettsiden din laster tregere på mobil. Trege sider mister kunder og straffes av Google.',
    steps: ['Finn ut hvilke plugins/utvidelser du ikke bruker, og slett dem.', 'Bruk et optimaliseringsverktøy (som WP Rocket) for å "forsinke" kode.', 'Test siden på nytt for å se at den laster raskere.'],
    aiPrompt: 'code'
  },
  'first-contentful-paint': {
    title: 'Siden er treg å vise frem (FCP)',
    what: 'Det tar for lang tid fra kunden klikker, til det første bildet eller teksten dukker opp på skjermen.',
    why: 'Hvert sekund ekstra ventetid gjør at flere besøkende snur i døren og går til konkurrenten din.',
    steps: ['Gjør det øverste bildet på siden din mindre (komprimer det).', 'Skru på "caching" (hurtigbuffer) på serveren din.', 'Sørg for at du har et raskt webhotell.'],
    aiPrompt: 'optimize'
  },
  // Standard-fallback hvis problemet ikke ligger i ordboken enda
  'default': {
    title: 'Optimaliser teknisk feil',
    what: 'Vi har funnet et teknisk hinder som gjør at Google ikke forstår siden din optimalt.',
    why: 'Ved å fikse dette, sender du et sterkt signal til søkemotorene om at siden din er profesjonell og rask.',
    steps: ['Gjennomgå ressursene som er flagget i analysen.', 'Oppdater innstillingene i ditt publiseringssystem.', 'Trykk på "Ny test" i Sikt for å bekrefte at det er løst.'],
    aiPrompt: 'optimize'
  }
};

const getProblemDetails = (problemId: string, rawTitle: string) => {
  // Prøver å finne problemet i ordboken, hvis ikke bruker vi standard + den rå tittelen
  const match = Object.keys(seoDictionary).find(key => problemId.toLowerCase().includes(key) || rawTitle.toLowerCase().includes(key));
  return match ? seoDictionary[match] : { ...seoDictionary['default'], title: rawTitle };
};


// Husker hvilket hjelpepanel som skal være åpent. Null = lukket.

// --- DATAMODELL FOR INNHOLD (Content) ---
interface ContentPage {
  id: string;
  url: string;
  title: string;
  wordCount: number;
  status: 'Bra' | 'Advarsel' | 'Kritisk';
  lastUpdated: string;
  // Standard (AI Analyse)
  score: number; // 0-100
  readability: 'Lett' | 'Middels' | 'Tung';
  issues: string[]; // F.eks "Mangler H1", "Tynt innhold"
  // Premium (Strategi)
  topicCluster: string;
  action: string; // "Oppdater", "Slett", "Behold"
}



// --- DATAMODELL FOR LENKER ---
interface LinkPage {
  id: string;
  url: string;
  title: string;
  inlinks: number;
  outlinks: number;
  status: 'Bra' | 'Isolert' | 'Blindvei' | 'Kritisk';
  brokenLinks: number;
  linkScore: number;
  anchorIssues: string[];
  hubType: 'Pillar' | 'Cluster' | 'None';
  suggestedInlinks: { fromUrl: string; anchor: string; reason: string }[];
}

// --- OPPDATERT DATAMODELL ---
interface KeywordData {
  keyword: string;
  location: string;
  position: number;
  url: string;
  change: number;
  volume: string;
  competition: number;
  kd: number;
  intent: 'Kjøp' | 'Info' | 'Lokal';
  history: { date: string; rank: number }[];
  // NYTT: Vi lagrer konkurrentene direkte fra API-et
  competitors: { position: number; title: string; url: string; snippet: string }[];
}
// Legg til disse i import-listen din fra 'recharts' (hvis den ikke finnes, lag en ny linje):
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

// --- TOOLTIP KOMPONENT (Enkle forklaringer) ---
const InfoHint = ({ text }: { text: string }) => (
  <div className="group relative inline-flex ml-1.5 cursor-help">
    <div className="text-slate-500 hover:text-white transition-colors opacity-50 hover:opacity-100">
      <HelpCircle size={12} />
    </div>
    {/* Tooltip boks */}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 bg-slate-800 text-white text-[10px] leading-relaxed font-medium rounded-lg shadow-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
    </div>
  </div>
);


const MyComponent = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const isFirstLoad = useRef(true);

  // Ref for å holde styr på om komponenten er montert
  const isMounted = useRef(false);



  // --- VIKTIG: DETTE ER LOGIKKEN FOR LENKER ---

  // 1. Definer variablene (State)
  const [linkPages, setLinkPages] = useState<LinkPage[]>([]);
  const [selectedLinkPage, setSelectedLinkPage] = useState<LinkPage | null>(null);
  const [isScanningLinks, setIsScanningLinks] = useState(false);

  // 2. Funksjonen som henter data (Simulert)
  const runLinkScan = () => {
    setIsScanningLinks(true);
    // Simulerer en scan som tar 1.5 sekunder
    setTimeout(() => {
      const mockLinkPages: LinkPage[] = [
        { id: '1', url: '/', title: 'Hjem - Forsiden', inlinks: 45, outlinks: 12, status: 'Bra', brokenLinks: 0, linkScore: 98, anchorIssues: [], hubType: 'Pillar', suggestedInlinks: [] },
        { id: '2', url: '/tjenester', title: 'Våre Tjenester', inlinks: 28, outlinks: 8, status: 'Bra', brokenLinks: 0, linkScore: 92, anchorIssues: [], hubType: 'Pillar', suggestedInlinks: [] },
        { id: '3', url: '/tjenester/seo', title: 'SEO Optimalisering', inlinks: 3, outlinks: 5, status: 'Bra', brokenLinks: 0, linkScore: 85, anchorIssues: [], hubType: 'Cluster', suggestedInlinks: [{ fromUrl: '/blogg/hva-er-seo', anchor: 'profesjonell SEO hjelp', reason: 'Relevant innhold' }] },
        { id: '4', url: '/om-oss', title: 'Om Oss', inlinks: 42, outlinks: 0, status: 'Blindvei', brokenLinks: 0, linkScore: 60, anchorIssues: [], hubType: 'None', suggestedInlinks: [] },
        { id: '5', url: '/kampanje-2023', title: 'Julebord 2023', inlinks: 0, outlinks: 2, status: 'Isolert', brokenLinks: 1, linkScore: 20, anchorIssues: [], hubType: 'None', suggestedInlinks: [{ fromUrl: '/', anchor: 'arkiv', reason: 'Orphan page' }] },
        { id: '6', url: '/blogg/tips', title: '5 gode tips', inlinks: 5, outlinks: 12, status: 'Kritisk', brokenLinks: 3, linkScore: 45, anchorIssues: ['Klikk her'], hubType: 'Cluster', suggestedInlinks: [] },
      ];
      setLinkPages(mockLinkPages);
      setIsScanningLinks(false);
    }, 1500);
  };

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
      console.log("1. Starter lagring for User ID:", user.id);

      const dataTilDatabase = {
        user_id: user.id,
        onboarding_completed: true,
        company_name: formData.companyName,
        contact_person: formData.contactPerson,
        email: formData.email,
        phone: formData.phone,
        website_url: formData.websiteUrl,
        industry: formData.industry,
        target_audience: formData.targetAudience
      };

      console.log("2. Sender data til Supabase...");

      // Vi fjerner .select() for å unngå RLS-lesefeil!
      const { error } = await supabase
        .from('clients')
        .upsert(dataTilDatabase, { onConflict: 'user_id' });

      if (error) {
        console.error("3a. Supabase returnerte en feil:", error);
        alert("Supabase nektet lagring: " + error.message);
        throw error;
      }

      console.log("3b. Suksess! Data trygt lagret i Supabase.");

      if (typeof onComplete === 'function') {
        onComplete();
      }

    } catch (error: any) {
      console.error("Kritisk feil ved lagring:", error.message);
    } finally {
      console.log("4. Skrur av lastehjul uansett utfall.");
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
      // Henter kun den rene hovedadressen (f.eks. https://sikt-nettside.vercel.app)
      const cleanUrl = typeof window !== 'undefined' ? window.location.origin : '';

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: cleanUrl, // <-- HER ER MAGIEN! Ingen payment_success her.
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
// Her tar vi imot ALLE verktøyene fra App (theme, setView, selectedPlan osv.)
// Vi døper om 'clientData' til 'startData' midlertidig her oppe:
const ClientPortal = ({ user, clientData: startData, onLogout, theme, setTheme, setView, selectedPlan, onSelectPlan }: any) => {
  const getStableMetrics = (keyword: string) => {
    let hash = 0;
    for (let i = 0; i < keyword.length; i++) {
      hash = keyword.charCodeAt(i) + ((hash << 5) - hash);
    }
    const positiveHash = Math.abs(hash);
    const volume = (positiveHash % 200) * 10 + 50;
    const competition = positiveHash % 3;
    return { volume, competition };
  };

  const [locationInput, setLocationInput] = useState('Oslo');
  const [showSuggestions, setShowSuggestions] = useState(false);
  // En liste over norske kommuner (utvalg - du kan legge til flere selv)
  const NORWEGIAN_MUNICIPALITIES = [
    "Agdenes", "Alstahaug", "Alta", "Alvdal", "Alver", "Andøy", "Aremark", "Arendal", "Asker", "Askvoll", "Askøy", "Aukra", "Aure", "Aurland", "Aurskog-Høland", "Austevoll", "Austrheim", "Averøy",
    "Balsfjord", "Bamble", "Bardu", "Beiarn", "Bergen", "Berlevåg", "Bindal", "Birkenes", "Bjerkreim", "Bjørnafjorden", "Bodø", "Bokn", "Bremanger", "Brønnøy", "Bygland", "Bykle", "Bærum", "Bø", "Bømlo", "Båtsfjord",
    "Dovre", "Drammen", "Drangedal", "Dyrøy", "Dønna",
    "Eidfjord", "Eidskog", "Eidsvoll", "Eigersund", "Elverum", "Enebakk", "Engerdal", "Etne", "Etnedal", "Evenes", "Evje og Hornnes",
    "Farsund", "Fauske", "Fedje", "Fitjar", "Fjaler", "Fjord", "Flakstad", "Flatanger", "Flekkefjord", "Flesberg", "Flå", "Folldal", "Fredrikstad", "Frogn", "Froland", "Frosta", "Frøya", "Fyresdal", "Færder",
    "Gamvik", "Gausdal", "Gildeskål", "Giske", "Gjemnes", "Gjerdrum", "Gjerstad", "Gjesdal", "Gjøvik", "Gloppen", "Gol", "Gran", "Grane", "Gratangen", "Grimstad", "Grong", "Grue", "Gulen",
    "Hadsel", "Halden", "Hamar", "Hamarøy", "Hammerfest", "Hareid", "Harstad", "Hasvik", "Hattfjelldal", "Haugesund", "Heim", "Hemnes", "Hemsedal", "Herøy", "Hitra", "Hjartdal", "Hjelmeland", "Hol", "Hole", "Holmestrand", "Holtålen", "Horten", "Hurdal", "Hustadvika", "Hvaler", "Hyllestad", "Hægebostad", "Høyanger", "Høylandet", "Hå",
    "Ibestad", "Inderøy", "Indre Østfold", "Iveland",
    "Jevnaker",
    "Karasjok", "Karlsøy", "Karmøy", "Kautokeino", "Klepp", "Kongsberg", "Kongsvinger", "Kragerø", "Kristiansand", "Kristiansund", "Krødsherad", "Kvam", "Kvinesdal", "Kvinnherad", "Kviteseid", "Kvitsøy", "Kvæfjord", "Kvænangen", "Kåfjord",
    "Larvik", "Lavangen", "Lebesby", "Leirfjord", "Leka", "Lenvik", "Lesja", "Levanger", "Lier", "Lierne", "Lillehammer", "Lillesand", "Lillestrøm", "Lindesnes", "Lom", "Loppa", "Lund", "Lunner", "Lurøy", "Luster", "Lyngdal", "Lyngen", "Lærdal", "Lødingen", "Lørenskog", "Løten",
    "Malvik", "Marker", "Masfjorden", "Melhus", "Meløy", "Meråker", "Midt-Telemark", "Midtre Gauldal", "Modalen", "Modum", "Molde", "Moskenes", "Moss", "Målselv", "Måsøy",
    "Namsos", "Namsskogan", "Nannestad", "Narvik", "Nes", "Nesbyen", "Nesna", "Nesodden", "Nissedal", "Nittedal", "Nome", "Nord-Aurdal", "Nord-Fron", "Nord-Odal", "Nordkapp", "Nordre Follo", "Nordre Land", "Nordreisa", "Nore og Uvdal", "Notodden", "Nærøysund",
    "Oppdal", "Orkland", "Os", "Osen", "Oslo", "Overhalla",
    "Porsanger", "Porsgrunn",
    "Rakkestad", "Rana", "Randaberg", "Rauma", "Rendalen", "Rennebu", "Rindal", "Ringebu", "Ringerike", "Ringsaker", "Risør", "Rollag", "Rælingen", "Rødøy", "Røros", "Røst", "Råde",
    "Salangen", "Saltdal", "Samnanger", "Sande", "Sandefjord", "Sandnes", "Sarpsborg", "Sauda", "Sel", "Selbu", "Seljord", "Senja", "Sigdal", "Siljan", "Sirdal", "Skaun", "Skien", "Skiptvet", "Skjervøy", "Skjåk", "Smøla", "Snåsa", "Sogndal", "Sokndal", "Sola", "Solund", "Sortland", "Stad", "Stange", "Stavanger", "Steinkjer", "Stjordal", "Stord", "Stor-Elvdal", "Storfjord", "Stranda", "Stryn", "Sula", "Suldal", "Sunndal", "Sunnfjord", "Surnadal", "Sveio", "Sykkylven", "Sømna", "Sør-Aurdal", "Sør-Fron", "Sør-Odal", "Sør-Varanger", "Sørfold", "Sørreisa",
    "Tana", "Time", "Tingvoll", "Tinn", "Tjeldsund", "Tokke", "Tolga", "Tromsø", "Trondheim", "Trysil", "Træna", "Tvedestrand", "Tydal", "Tynset", "Tysnes", "Tysvær", "Tønsberg",
    "Ullensaker", "Ullensvang", "Ulstein", "Ulvik", "Utsira",
    "Vadsø", "Vaksdal", "Valle", "Vang", "Vanylven", "Vardø", "Vefsn", "Vega", "Vegårshei", "Vennesla", "Verdal", "Vestby", "Vestnes", "Vestre Slidre", "Vestre Toten", "Vestvågøy", "Vevelstad", "Vik", "Vindafjord", "Vinje", "Volda", "Voss", "Værøy", "Vågan", "Våler",
    "Øksnes", "Ørland", "Ørsta", "Østre Toten", "Øvre Eiker", "Øyer", "Øygarden", "Øystre Slidre",
    "Åfjord", "Ål", "Ålesund", "Åmli", "Åmot", "Årdal", "Ås", "Åseral", "Åsnes"
  ];

  // 1. STATE & VARIABLER
  // VIKTIG: Vi har SLETTET [clientData, setClientData] herfra fordi den kommer fra props!
  const [formData, setFormData] = useState<any>({});
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [clientData, setClientData] = useState<any>(startData);

  // --- HUKOMMELSE FOR "LØS PROBLEMET" - ARBEIDSROMMET ---
  const [activeSolveProblem, setActiveSolveProblem] = useState<any>(null); // Hvilket problem vi er inni nå
  const [problemHistory, setProblemHistory] = useState<any[]>([]); // Historikk over løste problemer
  const [selectedPreviewProblem, setSelectedPreviewProblem] = useState<any>(null); // Det man har trykket på i analysen (viser knappen)
  const [aiIsThinking, setAiIsThinking] = useState(false);
  const [aiHasSolved, setAiHasSolved] = useState(false);
  const [aiSolution, setAiSolution] = useState<any>(null);



  // Denne funksjonen avfyres automatisk når kunden velger et problem i Verkstedet
  useEffect(() => {
    const fetchAiSolution = async () => {
      if (!activeSolveProblem) return;

      setAiIsThinking(true);
      setAiSolution(null);

      try {
        const response = await fetch('/api/solve-problem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'din-nettside.no',
            problemTitle: activeSolveProblem.raw?.title || activeSolveProblem.title || 'Ukjent feil',
            problemDetails: activeSolveProblem
          })
        });

        if (!response.ok) throw new Error("Klarte ikke å koble til AI");

        const data = await response.json();
        setAiSolution(data);
      } catch (error) {
        console.error(error);
        setAiSolution({
          explanation: "Systembeskjed: Klarte ikke å koble til AI-serveren. Sjekk at api/solve-problem.js kjører riktig.",
          codePatch: null
        });
      } finally {
        setAiIsThinking(false);
      }
    };

    fetchAiSolution();
  }, [activeSolveProblem]);



  // Denne funksjonen avfyres automatisk når kunden velger et problem i Verkstedet
  useEffect(() => {
    const fetchAiSolution = async () => {
      if (!activeSolveProblem) return;

      setAiIsThinking(true);
      setAiSolution(null);

      try {
        const response = await fetch('/api/solve-problem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'din-nettside.no',
            problemTitle: activeSolveProblem.raw?.title || activeSolveProblem.title || 'Ukjent feil',
            problemDetails: activeSolveProblem
          })
        });

        if (!response.ok) throw new Error("Klarte ikke å koble til AI");

        const data = await response.json();
        setAiSolution(data);
      } catch (error) {
        console.error(error);
        setAiSolution({
          explanation: "Systembeskjed: Klarte ikke å koble til AI-serveren. Sjekk at api/solve-problem.js kjører riktig.",
          codePatch: null
        });
      } finally {
        setAiIsThinking(false);
      }
    };

    fetchAiSolution();
  }, [activeSolveProblem]);

  // Når vi får ny data fra App (sjefen), oppdaterer vi vår lokale data
  useEffect(() => {
    if (startData) {
      setClientData(startData);
      setFormData(startData); // Fyller også ut skjemaet
      setLoading(false);
    }
  }, [startData]);

  // Analyse State
  const [analysisResults, setAnalysisResults] = useState<{ mobile: AnalysisResult; desktop: AnalysisResult } | null>(null);
  const [activeDevice, setActiveDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('Forbereder...');

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

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
    { id: 'verksted', label: 'Verksted', icon: Wrench },
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

  const handleUpgrade = () => {
    // Legger til kundens ID helt på slutten av lenken!
    const stripeLenke = "https://buy.stripe.com/test_din_stripe_lenke";
    window.location.href = `${stripeLenke}?client_reference_id=${user.id}`;
  };
  const handleUnlockUrl = () => { if (confirm("Endring av URL nullstiller historikk. Sikker?")) setUrlUnlockRequested(true); };

  // --- NY STATE FOR DENNE SIDEN ---
  const [keywordData, setKeywordData] = useState<KeywordData[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordData | null>(null); // For AI-analyse



  // --- STATE FOR INNHOLD SIDE ---
  const [contentPages, setContentPages] = useState<ContentPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<ContentPage | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // EKTE INNHOLDSSKANNER (Bruker Vercel Backend)
  const runContentScan = async (forceRefresh = false) => {
    if (!formData.websiteUrl) return alert("Legg inn URL i innstillinger først.");

    if (contentPages.length > 0 && !forceRefresh) return;

    setIsScanning(true);
    setIsScanningLinks(true);

    const { data: { session } } = await supabase.auth.getSession();
    try {
      const response = await fetch('/api/scan-website', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ url: formData.websiteUrl })
      });

      const data = await response.json();

      if (data.error) {
        alert("Feil ved skanning: " + data.error);
        return;
      }

      if (data.pages && data.pages.length > 0) {
        setContentPages(data.pages);

        const formattedLinkPages = data.pages.map((p: any, index: number) => ({
          id: `link-${index}`,
          url: p.url,
          title: p.title,
          inlinks: p.inlinks,
          outlinks: p.outlinks,
          status: p.inlinks === 0 ? 'Isolert' : p.status === 'Kritisk' ? 'Kritisk' : 'Bra',
          brokenLinks: 0,
          linkScore: p.score,
          anchorIssues: [],
          hubType: index === 0 ? 'Pillar' : 'Cluster',
          suggestedInlinks: []
        }));

        setLinkPages(formattedLinkPages);
      } else {
        alert("Fant ingen sider på dette domenet. Er URL-en riktig?");
      }

    } catch (error) {
      console.error(error);
      alert("Nettverksfeil under skanning.");
    } finally {
      setIsScanning(false);
      setIsScanningLinks(false);
    }
  };
  const [linkPages, setLinkPages] = useState<LinkPage[]>([]);
  const [selectedLinkPage, setSelectedLinkPage] = useState<LinkPage | null>(null);
  const [isScanningLinks, setIsScanningLinks] = useState(false);


  // --- DYNAMISK RAPPORT-GENERATOR (Bruker dine ekte data) ---
  const [dynamicReport, setDynamicReport] = useState<any>(null);

  useEffect(() => {
    // Kjør denne hver gang vi åpner rapport-fanen eller data endres
    if (activeTab === 'reports') {
      generateRealReport();
    }
  }, [activeTab, keywordData, contentPages, linkPages]);

  const generateRealReport = () => {
    // 1. Finn beste og dårligste data
    const topKeywords = keywordData.filter(k => k.position <= 10);
    const criticalPages = contentPages.filter(p => p.status === 'Kritisk');
    const isolatedPages = linkPages.filter(p => p.status === 'Isolert');
    const bestPage = contentPages.reduce((prev, current) => (prev.score > current.score) ? prev : current, contentPages[0]);
    const worstPage = contentPages.reduce((prev, current) => (prev.score < current.score) ? prev : current, contentPages[0]);

    // 2. Generer "Hvorfor du vokser" tekst basert på fakta
    let growthText = "Vi har ikke nok data enda. Kjør flere analyser.";
    let growthTitle = "Venter på data";

    if (topKeywords.length > 0) {
      growthTitle = "Sterk rangering";
      growthText = `Google belønner deg for søkeordet "${topKeywords[0].keyword}" (Pos #${topKeywords[0].position}). Dette driver mesteparten av din organiske synlighet akkurat nå.`;
    } else if (bestPage && bestPage.score > 80) {
      growthTitle = "Kvalitetsinnhold";
      growthText = `Siden din "${bestPage.title}" har en svært høy teknisk score (${bestPage.score}/100). Google liker sider som laster raskt og har godt innhold.`;
    }

    // 3. Generer "Hva som holder deg tilbake" tekst
    let problemText = "Alt ser bra ut så langt!";
    let problemTitle = "Ingen kritiske feil";

    if (criticalPages.length > 0) {
      problemTitle = "Tekniske hindringer";
      problemText = `Du har ${criticalPages.length} sider med kritiske feil. Siden "${criticalPages[0].title}" ${criticalPages[0].issues[0] ? 'har problemet: ' + criticalPages[0].issues[0] : 'trenger umiddelbar oppmerksomhet'}.`;
    } else if (isolatedPages.length > 0) {
      problemTitle = "Isolert innhold";
      problemText = `Siden "${isolatedPages[0].title}" har ingen interne lenker. Google finner ikke denne siden, og du går glipp av trafikk.`;
    } else if (keywordData.length > 0 && topKeywords.length === 0) {
      problemTitle = "Lav synlighet";
      problemText = `Ingen av dine ${keywordData.length} søkeord er på side 1 enda. Du må jobbe med innholdet på sidene som rangerer på side 2-3.`;
    }

    // 4. Lag en faktisk handlingsplan (Weekly Plan)
    const tasks = [];

    // Oppgave 1: Lavthengende frukt (Søkeord pos 4-20)
    const opportunityKeyword = keywordData.find(k => k.position > 3 && k.position < 20);
    if (opportunityKeyword) {
      tasks.push({
        task: `Optimaliser teksten for "${opportunityKeyword.keyword}"`,
        desc: `Du er på posisjon #${opportunityKeyword.position}. Litt mer innhold kan vippe deg til side 1.`,
        impact: 'Høy trafikk',
        time: '30 min',
        color: 'emerald'
      });
    }

    // Oppgave 2: Fiks den verste siden
    if (worstPage && worstPage.status === 'Kritisk') {
      tasks.push({
        task: `Fiks feil på "${worstPage.title}"`,
        desc: `Denne siden har score ${worstPage.score}/100. ${worstPage.issues[0] || 'Se gjennom innholdet.'}`,
        impact: 'Teknisk SEO',
        time: '15 min',
        color: 'rose'
      });
    }

    // Oppgave 3: Internlenking
    if (isolatedPages.length > 0) {
      tasks.push({
        task: `Lenk til "${isolatedPages[0].title}"`,
        desc: "Siden er foreldreløs. Legg til en lenke fra forsiden eller menyen.",
        impact: 'Indeksering',
        time: '5 min',
        color: 'blue'
      });
    }

    // Fallback oppgaver hvis alt er perfekt
    if (tasks.length === 0) {
      tasks.push({ task: "Se etter nye søkeord", desc: "Du har god helse. Utvid horisonten.", impact: 'Vekst', time: '20 min', color: 'violet' });
    }

    setDynamicReport({ growthTitle, growthText, problemTitle, problemText, tasks });
  };

  // --- AI HANDLERS FOR INNHOLD ---
  const [aiLoading, setAiLoading] = useState<string | null>(null); // 'text' | 'links'
  const [aiResponse, setAiResponse] = useState<any>(null);

  // --- EKTE AI HANDLER (Bruker OpenAI API) ---
  const handleAiAction = async (type: 'text' | 'links') => {
    if (!selectedPage) return;
    setAiLoading(type);
    setAiResponse(null);

    if (type === 'links') {
      // Lenkeforslag er allerede ekte (den sjekker dine andre sider via koden din)
      const internalSuggestions = contentPages
        .filter(p => p.id !== selectedPage.id)
        .slice(0, 3)
        .map(p => ({
          fromUrl: p.url,
          anchor: selectedPage.title.split(' - ')[0] || 'Les mer'
        }));
      setAiResponse({ type: 'links', title: 'Forslag til interne lenker', links: internalSuggestions.length > 0 ? internalSuggestions : null });
      setAiLoading(null);
      return;
    }

    // EKTE TEKSTGENERERING VIA CHATGPT
    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        alert("Mangler OpenAI API-nøkkel i .env filen.");
        setAiLoading(null);
        return;
      }

      const prompt = `Du er en SEO-ekspert. Skriv en optimalisert og selgende intro-tekst (ca 50 ord) for en nettside med tittel "${selectedPage.title}". Den skal være på norsk, fengende, og inkludere viktige nøkkelord for temaet.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Rask og billig modell
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 150
        })
      });

      const data = await response.json();

      if (data.choices && data.choices.length > 0) {
        setAiResponse({
          type: 'text',
          title: 'AI-optimalisert utkast',
          content: data.choices[0].message.content.trim()
        });
      } else {
        throw new Error("Fikk ikke svar fra AI.");
      }
    } catch (error) {
      console.error(error);
      setAiResponse({ type: 'text', title: 'Feil', content: 'Kunne ikke koble til AI. Prøv igjen senere.' });
    } finally {
      setAiLoading(null);
    }
  };



  // --- STATE FOR LENKER (LIM INN HER, INNI ClientPortal) ---

  // EKTE LENKESKANNER (Bruker Vercel Backend)
  const runLinkScan = async () => {
    if (!formData.websiteUrl) return alert("Legg inn URL i innstillinger først.");

    setIsScanningLinks(true);

    const { data: { session } } = await supabase.auth.getSession();
    try {
      const response = await fetch('/api/scan-website', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ url: formData.websiteUrl })
      });

      const data = await response.json();

      if (data.error) {
        alert("Feil ved skanning: " + data.error);
        return;
      }

      if (data.pages && data.pages.length > 0) {
        // Formaterer dataen perfekt for Lenke-tabellen din
        const formattedLinkPages = data.pages.map((p: any, index: number) => ({
          id: `link-${index}`,
          url: p.url,
          title: p.title,
          inlinks: p.inlinks,
          outlinks: p.outlinks,
          status: p.inlinks === 0 ? 'Isolert' : p.status === 'Kritisk' ? 'Kritisk' : 'Bra',
          brokenLinks: 0,
          linkScore: p.score,
          anchorIssues: [],
          hubType: index === 0 ? 'Pillar' : 'Cluster',
          suggestedInlinks: []
        }));

        setLinkPages(formattedLinkPages);

        // Bonus: Siden vi allerede hentet all dataen, fyller vi Innholds-fanen samtidig!
        setContentPages(data.pages);
      } else {
        alert("Fant ingen lesbare sider på dette domenet.");
      }

    } catch (error) {
      console.error("Feil ved lenkeskanning:", error);
      alert("Nettverksfeil under lenkeskanning.");
    } finally {
      setIsScanningLinks(false);
    }
  };

  // Denne sørger for at dataene dine lastes inn igjen når du refresher siden
  useEffect(() => {
    const savedRankings = localStorage.getItem(`rankings_${user.id}`);
    if (savedRankings) {
      try {
        const parsed = JSON.parse(savedRankings);
        setKeywordData(parsed);
        setHasSearched(true);
      } catch (e) {
        console.error("Kunne ikke laste lagrede data", e);
      }
    }
  }, [user.id]);

  // --- AUTO-LOAD CACHE (Gjør appen lynrask) ---
  useEffect(() => {
    if (!formData.websiteUrl) return;

    // Last inn Innhold-cache hvis tabellen er tom
    if (activeTab === 'content' && contentPages.length === 0) {
      const contentCache = localStorage.getItem(`content_cache_${formData.websiteUrl}`);
      if (contentCache) {
        try {
          const { data, timestamp } = JSON.parse(contentCache);
          if (Date.now() - timestamp < 86400000) setContentPages(data);
        } catch (e) { }
      }
    }

    // Last inn Lenke-cache hvis tabellen er tom
    if (activeTab === 'links' && linkPages.length === 0) {
      const linkCache = localStorage.getItem(`link_cache_${formData.websiteUrl}`);
      if (linkCache) {
        try {
          const { data, timestamp } = JSON.parse(linkCache);
          if (Date.now() - timestamp < 86400000) setLinkPages(data);
        } catch (e) { }
      }
    }
  }, [activeTab, formData.websiteUrl, contentPages.length, linkPages.length]);

  // --- SØKEORDSGRENSER ---
  const getKeywordLimit = (level: number) => {
    if (level >= 3) return 50; // Premium
    if (level === 2) return 15; // Standard
    return 3; // Basic
  };
  const currentKeywordLimit = getKeywordLimit(currentLevel);
  const keywordsUsed = keywordsToTrack.length;
  const canAddMoreKeywords = keywordsUsed < currentKeywordLimit;

  // --- LEGG TIL SØKEORD (Med grense-sjekk) ---
  const handleAddKeyword = () => {
    if (!canAddMoreKeywords) {
      alert(`Du har nådd grensen på ${currentKeywordLimit} søkeord for din nåværende plan. Oppgrader for å overvåke flere ord.`);
      return;
    }
    if (newKeywordInput.trim() && locationInput.trim()) {
      const newEntry = { keyword: newKeywordInput.trim(), location: locationInput.trim() };
      const updated = [...keywordsToTrack, newEntry];
      setKeywordsToTrack(updated);
      setNewKeywordInput('');
      localStorage.setItem(`keywords_${user.id}`, JSON.stringify(updated));
    } else {
      alert("Du må skrive både søkeord og velge en kommune.");
    }
  };

  // --- STRENG SLETTING ---
  const handleRemoveKeyword = (keywordToRemove: string, locationToRemove: string) => {
    const isConfirmed = window.confirm(
      `STRENG ADVARSEL: \n\nHvis du sletter "${keywordToRemove}", sletter du all historikk og grafdata for dette ordet for alltid.\n\nSEO handler om å bygge data over tid. Vi anbefaler sterkt å beholde ordet.\n\nEr du 100% sikker på at du vil slette det?`
    );
    if (!isConfirmed) return;

    // Fjern fra listen over ord
    const updatedKeywords = keywordsToTrack.filter((k: any) =>
      !(k.keyword === keywordToRemove && k.location === locationToRemove)
    );
    setKeywordsToTrack(updatedKeywords);
    localStorage.setItem(`keywords_${user.id}`, JSON.stringify(updatedKeywords));

    // Fjern fra resultat-listen
    const updatedRankings = realRankings.filter(r =>
      !(r.keyword === keywordToRemove && r.location === locationToRemove)
    );
    setRealRankings(updatedRankings);
    localStorage.setItem(`rankings_${user.id}`, JSON.stringify(updatedRankings));
  };


  const handleCheckRankings = async () => {
    if (!formData.websiteUrl) return alert("Legg inn URL i innstillinger.");


    // --- 1. SØKEORDSKVOTE & AUTOMATISK LEGG TIL ---
    const currentKeywordLimit = currentLevel >= 3 ? 50 : currentLevel === 2 ? 15 : 3;
    let activeList = [...keywordsToTrack];

    // Sjekk om brukeren har skrevet noe nytt i søkefeltet
    if (newKeywordInput.trim()) {
      if (!locationInput.trim()) return alert("Du må fylle ut sted (f.eks Oslo) for å søke.");
      if (activeList.length >= currentKeywordLimit) {
        alert(`Søkeordskvoten din på ${currentKeywordLimit} er full!`);
        return;
      }

      const newEntry = { keyword: newKeywordInput.trim(), location: locationInput.trim() };
      activeList = [...activeList, newEntry];
      setKeywordsToTrack(activeList);

      // Vi sletter localStorage her, siden vi lagrer alt i Supabase lenger ned
      setNewKeywordInput(''); // Tømmer feltet
    }

    if (activeList.length === 0) return alert("Legg til et søkeord.");

    setRankingLoading(true);
    setHasSearched(true);

    const cleanDomain = formData.websiteUrl.replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0];

    try {
      const promises = activeList.map(async (entry: any) => {
        const keyword = typeof entry === 'string' ? entry : entry.keyword;
        const location = typeof entry === 'string' ? 'Oslo' : entry.location;

        const { data: { session } } = await supabase.auth.getSession();
        try {
          // Snakker med den trygge Vercel-serveren din (backend)
          const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({ keyword, location })
          });

          const data = await response.json();

          if (data.error) {
            console.error("Server svarte med feil:", data.error);
            return null; // Hopper over dette ordet hvis serveren feiler
          }

          let position = 101;
          let url = '-';
          let extractedCompetitors: any[] = [];
          let resultType = 'Tekst';

          if (data.organic_results) {
            const found = data.organic_results.find((r: any) => r.link && r.link.includes(cleanDomain));
            if (found) {
              position = found.position;
              url = found.link.replace(formData.websiteUrl, '').replace('https://', '').replace(cleanDomain, '');
              if (url === '') url = '/';
            }
            extractedCompetitors = data.organic_results.slice(0, 5).map((r: any) => ({
              position: r.position, title: r.title, url: r.link, snippet: r.snippet
            }));
          }

          // Sjekk hva slags resultater Google viser
          if (data.local_results) resultType += ", Kart";
          if (data.inline_images) resultType += ", Bilder";

          // Ekte data (eller estimater basert på live tall) for volum og KD
          const totalResults = data.search_information?.total_results || 10000;
          const kd = Math.min(100, Math.max(10, Math.round((totalResults / 1000000) * 10)));
          const intent = ['Kjøp', 'Info', 'Lokal'][Math.floor(Math.random() * 3)];

          // --- 2. EKTE HISTORIKK-LOGIKK ---
          const todayDate = new Date().toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit' });

          // Finn tidligere data for dette søkeordet for å beholde grafen
          const existingKeywordData = realRankings.find((r: any) => r.keyword === keyword && r.location === location);
          let newHistory = existingKeywordData?.history ? [...existingKeywordData.history] : [];

          // Sjekk om vi allerede har et punkt for i dag
          const hasToday = newHistory.some((h: any) => h.date === todayDate);

          if (hasToday) {
            // Oppdater dagens posisjon hvis man søker flere ganger samme dag
            newHistory = newHistory.map((h: any) => h.date === todayDate ? { ...h, rank: position } : h);
          } else {
            // Legg til ny måling
            newHistory.push({ date: todayDate, rank: position });
          }

          // Behold maks de siste 30 dagene
          if (newHistory.length > 30) newHistory.shift();

          // Kalkuler ekte endring (Change) siden forrige måling
          let change = 0;
          if (newHistory.length > 1) {
            const previousRank = newHistory[newHistory.length - 2].rank;
            change = previousRank - position;
          }

          return {
            keyword,
            location,
            position,
            url,
            change: change,
            volume: resultType,
            competition: totalResults,
            kd,
            intent,
            history: newHistory,
            competitors: extractedCompetitors
          } as any;

        } catch (err) {
          console.error(err);
          return null;
        }
      });

      const results = (await Promise.all(promises)).filter(Boolean);
      setKeywordData(results);
      setRealRankings(results);

      // --- 3. LAGRE TIL SUPABASE (ERSTATTER LOCALSTORAGE) ---
      for (const result of results) {
        // 1. Sjekk om ordet allerede finnes i databasen for denne kunden
        const { data: existing } = await supabase
          .from('user_keywords')
          .select('id')
          .eq('user_id', user.id)
          .eq('keyword', result.keyword)
          .eq('location', result.location)
          .single();

        if (existing) {
          // 2. Hvis det finnes, oppdaterer vi grafen og historikken
          await supabase
            .from('user_keywords')
            .update({ keyword_data: result })
            .eq('id', existing.id);
        } else {
          // 3. Hvis det er helt nytt, legger vi det inn i databasen
          await supabase
            .from('user_keywords')
            .insert({
              user_id: user.id,
              keyword: result.keyword,
              location: result.location,
              keyword_data: result
            });
        }
      }

      // Sletter lokale data for å være 100% sikre på at vi kun bruker databasen
      localStorage.removeItem(`keywords_${user.id}`);
      localStorage.removeItem(`rankings_${user.id}`);

    } catch (error) {
      alert("Feil ved henting av data.");
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
    <div className={`flex min-h-screen transition-colors duration-300 ${theme === 'light' ? 'bg-[#F8FAFC] text-slate-800' : 'bg-slate-950 text-slate-200'}`}>

      {/* Bakgrunnseffekter (Mykere i lys modus) */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className={`absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full blur-[120px] ${theme === 'light' ? 'bg-indigo-100/40' : 'bg-violet-900/20'}`}></div>
      </div>

      {/* Sidebar med skygge i lys modus */}
      <aside className={`w-20 lg:w-64 fixed h-full z-20 flex flex-col transition-colors duration-300 border-r backdrop-blur-xl
        ${theme === 'light' ? 'bg-white border-slate-200/50 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)]' : 'bg-slate-900/80 border-white/5 shadow-2xl'}
      `}>
        <div className={`p-6 flex items-center gap-3 border-b ${theme === 'light' ? 'border-slate-100' : 'border-white/5'}`}>
          <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-sm">S</div>
          <span className={`font-black text-xl hidden lg:block ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Sikt.</span>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-2">
          {menuItems.map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all border font-medium ${activeTab === item.id ? 'bg-violet-600 text-white shadow-md border-transparent' : theme === 'light' ? 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 border-transparent' : 'text-slate-400 hover:bg-white/5 border-transparent'}`}>
              <item.icon size={20} />
              <span className="hidden lg:block text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className={`p-4 border-t ${theme === 'light' ? 'border-slate-100' : 'border-white/5'}`}>
          <p className="text-[10px] font-bold text-slate-500 mb-1 hidden lg:block uppercase tracking-wider">ABONNEMENT</p>
          <div className={`hidden lg:flex justify-between items-center p-2 rounded-lg border mb-3 ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-white/5'}`}>
            <span className={`text-xs font-bold pl-1 ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{currentPkgName}</span>
            {currentLevel < 3 && <button onClick={handleUpgrade} className="text-[10px] font-bold text-violet-500 hover:text-violet-600">Oppgrader</button>}
          </div>
          <button onClick={onLogout} className={`flex items-center gap-2 text-xs font-bold w-full p-2 rounded-lg transition-colors ${theme === 'light' ? 'text-slate-500 hover:bg-rose-50 hover:text-rose-600' : 'text-slate-500 hover:text-rose-400 hover:bg-white/5'}`}>
            <LogOut size={16} /><span className="hidden lg:inline">Logg ut</span>
          </button>
        </div>
      </aside>

      {/* Content Area */}
      <main className="flex-1 ml-20 lg:ml-64 p-6 lg:p-10 max-w-6xl mx-auto relative z-10">

        {/* Top Header */}
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className={`text-3xl font-black ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
              {menuItems.find(i => i.id === activeTab)?.label}
            </h1>
            <p className="text-slate-400 text-sm mt-1 flex gap-2">
              <Globe size={14} /> {clientData?.websiteUrl || '...'}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-full border flex items-center justify-center font-bold shadow-sm
            ${theme === 'light' ? 'bg-white border-slate-200 text-violet-600' : 'bg-slate-800 border-white/10 text-violet-400'}
          `}>
            {user.email.charAt(0).toUpperCase()}
          </div>
        </header>

        {/* --- CRM DASHBOARD (MINIMALISTISK & CLEAN) --- */}
        {activeTab === 'dashboard' && (
          <div className="max-w-5xl mx-auto pt-8 pb-32 animate-in fade-in duration-700">

            {/* Header - Syltynn og ren */}
            <div className="mb-20">
              <h1 className="text-2xl font-medium text-slate-900 dark:text-white tracking-tight">Oversikt</h1>
              <p className="text-sm text-slate-500 mt-1">Ditt domenes helsetilstand akkurat nå.</p>
            </div>

            {/* Hovedgrid: Asymmetrisk balanse (Venstre tyngde, Høyre lister) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24">

              {/* VENSTRE: Hovedfokus (Massiv typografi, ingen bokser) - 5 kolonner */}
              <div className="lg:col-span-5 space-y-16">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Systemhelse</p>
                  <div className="flex items-baseline gap-2">
                    {/* Ekte minimalisme bruker gigantisk, tynn skrift i stedet for store bokser */}
                    <span className="text-8xl font-light tracking-tighter text-slate-900 dark:text-white">78</span>
                    <span className="text-2xl font-light text-slate-400">/ 100</span>
                  </div>
                  <p className="text-sm text-emerald-500 mt-4 flex items-center gap-1.5 font-medium">
                    <TrendingUp size={14} /> +12% siden forrige uke
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-100 dark:border-white/5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Oppgaver i kø</p>
                    <span className="text-3xl font-light text-slate-900 dark:text-white">4</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Løst i år</p>
                    <span className="text-3xl font-light text-slate-900 dark:text-white">12</span>
                  </div>
                </div>

                <button onClick={() => setActiveTab('analysis')} className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2 hover:opacity-70 transition-opacity">
                  <Activity size={16} /> Kjør ny systemanalyse
                </button>
              </div>

              {/* HØYRE: Handling og Historikk (Rene linjer) - 7 kolonner */}
              <div className="lg:col-span-7 space-y-16 mt-4 lg:mt-0">

                {/* Triage / Innboks */}
                <div>
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100 dark:border-white/5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Krever handling</p>
                    <button onClick={() => setActiveTab('verksted')} className="text-xs font-medium text-violet-500 hover:text-violet-600 transition-colors">
                      Åpne Verksted &rarr;
                    </button>
                  </div>

                  <div className="space-y-1">
                    {[
                      { t: 'Reduser ubrukt JavaScript', src: 'Teknisk', priority: 'Kritisk' },
                      { t: 'Manglende Meta-beskrivelse', src: 'Innhold', priority: 'Høy' }
                    ].map((item, i) => (
                      <div
                        key={i}
                        onClick={() => setActiveTab('verksted')}
                        className="group flex items-center justify-between py-4 hover:px-4 -mx-4 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          {/* Minimalistisk indikator i stedet for store fargede knapper */}
                          <div className={`w-1.5 h-1.5 rounded-full ${item.priority === 'Kritisk' ? 'bg-rose-500' : 'bg-amber-500'}`}></div>
                          <p className="text-sm text-slate-900 dark:text-slate-200">{item.t}</p>
                        </div>
                        <span className="text-[10px] uppercase tracking-widest text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          Gå til løsning
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Logg / Historikk */}
                <div>
                  <div className="mb-4 pb-4 border-b border-slate-100 dark:border-white/5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Siste hendelser</p>
                  </div>
                  <div className="space-y-5 pt-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Markerte "Treg LCP" som løst via Verkstedet.</span>
                      <span className="text-slate-400 text-xs font-mono">I dag</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Kjørte full systemanalyse. Fant 2 nye problemer.</span>
                      <span className="text-slate-400 text-xs font-mono">2 dager siden</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Organisk trafikk-estimat økte med 4%.</span>
                      <span className="text-slate-400 text-xs font-mono">1. april</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 relative">

            {/* --- 1. Liten popup som dukker opp når man trykker på et kort --- */}
            {selectedPreviewProblem && !activeSolveProblem && (
              <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
                <div className={`p-4 pl-6 pr-4 rounded-2xl shadow-2xl flex items-center gap-6 border ${theme === 'light' ? 'bg-slate-900 text-white border-slate-800' : 'bg-white text-slate-900 border-white'}`}>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Valgt problem</p>
                    <p className="font-bold">{selectedPreviewProblem.title}</p>
                  </div>
                  <button
                    onClick={() => {
                      const details = getProblemDetails(selectedPreviewProblem.title, selectedPreviewProblem.title);
                      setActiveSolveProblem({ raw: selectedPreviewProblem, details });
                      setSelectedPreviewProblem(null);
                      setActiveTab('verksted'); // <--- DENNE KASTER DEG TIL VERKSTEDET
                    }}
                    className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 ${theme === 'light' ? 'bg-violet-500 hover:bg-violet-400 text-white' : 'bg-violet-600 hover:bg-violet-700 text-white'}`}
                  >
                    Gå til dybde <ArrowRight size={16} />
                  </button>
                  <button onClick={() => setSelectedPreviewProblem(null)} className="p-2 opacity-50 hover:opacity-100 rounded-full hover:bg-white/10"><X size={16} /></button>
                </div>
              </div>
            )}

            {/* --- 3. DEN VANLIGE ANALYSEN (Skjules når arbeidsrommet er åpent) --- */}
            {!activeSolveProblem && (
              <div className="space-y-8">
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

                        {/* --- TILTAK SOM GIR EFFEKT (NÅ MED LØS-PROBLEM-KNAPP) --- */}
                        <div className="mt-4">
                          {currentLevel >= 2 ? (
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                              <h3 className="font-bold text-slate-900 text-lg mb-4 flex gap-2"><Lightbulb className="text-amber-500" /> Tiltak som gir effekt</h3>
                              <div className="space-y-3">
                                {analysisResults[activeDevice].opportunities?.map((o, i) => (
                                  <div
                                    key={i}
                                    onClick={() => setSelectedPreviewProblem({ raw: o, title: o.title, description: o.description })}
                                    className="group relative cursor-pointer flex justify-between items-center p-4 bg-slate-50 hover:bg-amber-50/50 rounded-xl border border-slate-100 hover:border-amber-300 transition-all duration-200 hover:shadow-sm"
                                  >
                                    <div>
                                      <p className="font-bold text-sm text-slate-800 group-hover:text-amber-700 transition-colors">{o.title}</p>
                                      <p className="text-xs text-slate-500 truncate max-w-[200px] md:max-w-xs">{o.description}</p>
                                    </div>
                                    <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded h-fit">Spar {o.savings}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : <LockedSection title="Se konkrete tiltak" description="Få listen over hva som må fikses." reqPackage="Standard" onUpgrade={handleUpgrade} color="amber" />}
                        </div>

                        {/* --- TEKNISK HELSESJEKK (NÅ MED LØS-PROBLEM-KNAPP) --- */}
                        <div className="mt-4">
                          {currentLevel >= 3 ? (
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                              <h3 className="font-bold text-slate-900 text-lg mb-4 flex gap-2"><ShieldCheck className="text-violet-500" /> Teknisk Helsesjekk</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {analysisResults[activeDevice].diagnostics?.map((d, i) => (
                                  <div
                                    key={i}
                                    onClick={() => !d.passed && setSelectedPreviewProblem({ raw: d, title: d.title, description: 'Teknisk feil funnet.' })}
                                    className={`group relative flex justify-between items-center p-3 rounded-xl border transition-all duration-200 ${!d.passed ? 'cursor-pointer bg-slate-50 hover:bg-rose-50/50 border-slate-100 hover:border-rose-300' : 'bg-slate-50/50 border-slate-100 opacity-70'}`}
                                  >
                                    <span className={`text-sm font-medium ${!d.passed ? 'group-hover:text-rose-700 text-slate-700' : 'text-slate-500'}`}>{d.title}</span>
                                    {d.passed ?
                                      <span className="text-emerald-500 text-xs font-bold flex gap-1"><CheckCircle2 size={14} /> OK</span> :
                                      <span className="text-rose-500 text-xs font-bold flex gap-1"><XCircle size={14} /> FEIL</span>
                                    }
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : <LockedSection title="Teknisk Helsesjekk" description="Full sikkerhets- og SEO-gjennomgang." reqPackage="Premium" onUpgrade={handleUpgrade} color="violet" />}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-20 bg-slate-900/30 rounded-2xl border border-white/5 border-dashed">
                        <Activity className="w-10 h-10 text-slate-500 mx-auto mb-4" />
                        <h3 className="text-white font-bold">Klar for test</h3>
                        <p className="text-slate-400 text-sm">Vi sjekker både mobil og desktop.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- INNHOLD & REVISJON (MED FUNGERENDE KNAPPER) --- */}
        {activeTab === 'content' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-40">

            {/* 1. HEADER & HANDINGER */}
            <div className={`flex flex-col md:flex-row justify-between items-end gap-6 p-8 rounded-3xl border relative overflow-hidden transition-all duration-300 ${theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/50 border-white/5'}`}>
              <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-[80px] pointer-events-none"></div>

              <div className="relative z-10">
                <h1 className={`text-4xl font-black tracking-tight flex items-center gap-3 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                  Innhold & Kvalitet
                </h1>
                <p className={`mt-2 text-lg font-light max-w-2xl ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                  Totaloversikt over nettstedets innhold. Vi finner tekniske feil, tynt innhold og muligheter for bedre rangering.
                </p>
              </div>

              <button
                onClick={() => runContentScan(true)}
                disabled={isScanning}
                className="relative z-10 bg-violet-600 hover:bg-violet-500 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-violet-500/20 flex items-center gap-3 transition-all whitespace-nowrap group"
              >
                {isScanning ? <Loader2 className="animate-spin" /> : <RefreshCw className="group-hover:rotate-180 transition-transform duration-500" />}
                {isScanning ? 'Analyserer nettsiden...' : 'Skann Nettsted'}
              </button>
            </div>

            {/* 2. KPI KORT */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: 'Sider Funnet',
                  val: contentPages.length > 0 ? contentPages.length : '-',
                  icon: FileText,
                  col: theme === 'light' ? 'text-blue-600' : 'text-blue-400',
                  hint: 'Totalt antall sider vi fant på ditt domene.'
                },
                {
                  label: 'Kritisk Innhold',
                  val: contentPages.length > 0 ? contentPages.filter(p => p.status === 'Kritisk').length : '-',
                  icon: AlertTriangle,
                  col: 'text-rose-500',
                  hint: 'Sider med alvorlige mangler som skader din SEO.'
                },
                {
                  label: 'Innholdshelse',
                  val: contentPages.length > 0 ? (currentLevel >= 2 ? Math.round(contentPages.reduce((acc, p) => acc + p.score, 0) / contentPages.length) + '/100' : 'Låst') : '-',
                  icon: Activity,
                  col: currentLevel >= 2 ? 'text-emerald-500' : 'text-slate-500',
                  hint: 'Samlet kvalitetsscore.'
                },
                {
                  label: 'Nye Muligheter',
                  val: contentPages.length > 0 ? (currentLevel >= 3 ? 'Høy' : 'Låst') : '-',
                  icon: Layers,
                  col: currentLevel >= 3 ? 'text-violet-500' : 'text-slate-500',
                  hint: 'Potensial for nye artikler.'
                },
              ].map((stat, i) => (
                <div key={i} className={`p-6 rounded-2xl border relative group transition-all overflow-visible z-10 duration-300 ${theme === 'light' ? 'bg-white border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] hover:shadow-[0_8px_20px_-6px_rgba(6,81,237,0.1)] hover:border-violet-200' : 'bg-slate-900/50 border-white/5 hover:border-white/10'}`}>
                  <div className={`absolute top-4 right-4 opacity-20 ${stat.col}`}><stat.icon size={24} /></div>
                  <div className="flex items-center gap-2 mb-2 relative z-20">
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>{stat.label}</p>
                    <InfoHint text={stat.hint} />
                  </div>
                  <p className={`text-3xl font-black ${stat.col} flex items-center gap-2`}>
                    {stat.val === 'Låst' && <Lock size={16} className="text-slate-400" />}
                    {stat.val}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[800px]">

              {/* 3. HOVEDTABELL (VENSTRE SIDE) */}
              <div className={`lg:col-span-2 rounded-3xl border shadow-xl flex flex-col overflow-hidden relative transition-all duration-300 ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/50 border-white/5'}`}>

                <div className={`p-6 border-b flex justify-between items-center ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'}`}>
                  <h3 className={`font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}><FileText size={18} className="text-blue-500" /> Alle Sider</h3>
                  {contentPages.length > 0 && <span className="text-xs text-slate-500">{contentPages.length} URLer</span>}
                </div>

                <div className="flex-1 overflow-hidden relative">
                  {contentPages.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                      <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 relative ${theme === 'light' ? 'bg-violet-50' : 'bg-slate-800/50'}`}>
                        <div className="absolute inset-0 bg-violet-500/20 rounded-full animate-ping"></div>
                        <Radar size={40} className="text-violet-500 relative z-10" />
                      </div>
                      <h3 className={`text-xl font-bold mb-2 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Klar til å kartlegge nettstedet</h3>
                      <p className={`text-sm max-w-sm leading-relaxed mb-8 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                        Klikk på <span className="font-bold">"Skann Nettsted"</span> øverst for å hente inn alle sidene dine og analysere kvaliteten.
                      </p>
                    </div>
                  ) : (
                    <div className="h-full overflow-y-auto overflow-x-hidden custom-scrollbar">
                      <table className="w-full text-left border-collapse">
                        <thead className={`text-[10px] uppercase font-black tracking-wider sticky top-0 z-20 shadow-sm ${theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-slate-950 text-slate-500'}`}>
                          <tr>
                            <th className="p-4"><div className="flex items-center gap-1 cursor-help">Side / Tittel <InfoHint text="Sidens tittel og URL." /></div></th>
                            <th className="p-4"><div className="flex items-center gap-1 cursor-help">Ord <InfoHint text="Antall ord." /></div></th>
                            <th className="p-4"><div className="flex items-center gap-1 cursor-help">Status <InfoHint text="Vår vurdering." /></div></th>
                            <th className="p-4 text-right"><div className="flex items-center justify-end gap-1 cursor-help">Sist endret <InfoHint text="Dato." /></div></th>
                          </tr>
                        </thead>
                        <tbody className={`divide-y text-sm ${theme === 'light' ? 'divide-slate-100' : 'divide-white/5'}`}>
                          {contentPages.map((page, i) => (
                            <tr
                              key={i}
                              onClick={() => { setSelectedPage(page); setAiResponse(null); }}
                              className={`transition-colors group cursor-pointer 
                                ${theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-white/5'}
                                ${selectedPage === page ? (theme === 'light' ? 'bg-violet-50/50 border-l-2 border-violet-500' : 'bg-white/10 border-l-2 border-violet-500') : ''}
                              `}
                            >
                              <td className="p-4">
                                <div className={`font-bold truncate max-w-[200px] ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{page.title}</div>
                                <div className="text-xs text-slate-500 truncate max-w-[200px]">{page.url}</div>
                              </td>
                              <td className={`p-4 font-mono text-xs ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{page.wordCount}</td>
                              <td className="p-4">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border flex w-fit items-center gap-1 
                                  ${page.status === 'Bra' ? (theme === 'light' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20') :
                                    page.status === 'Advarsel' ? (theme === 'light' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-amber-500/10 text-amber-400 border-amber-500/20') :
                                      (theme === 'light' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-rose-500/10 text-rose-400 border-rose-500/20')}
                                `}>
                                  {page.status === 'Bra' && <CheckCircle2 size={10} />}
                                  {page.status === 'Advarsel' && <AlertTriangle size={10} />}
                                  {page.status === 'Kritisk' && <AlertCircle size={10} />}
                                  {page.status}
                                </span>
                              </td>
                              <td className="p-4 text-right text-xs text-slate-500">
                                {page.lastUpdated}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. AI INSPEKTØR (HØYRE SIDE) */}
              <div className={`rounded-3xl border flex flex-col h-full relative overflow-hidden shadow-2xl transition-all duration-300 ${theme === 'light' ? 'bg-gradient-to-b from-violet-50/50 to-white border-violet-100' : 'bg-slate-900/50 border-white/5'}`}>

                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500"></div>

                <div className={`p-6 border-b ${theme === 'light' ? 'border-violet-100 bg-white' : 'border-white/5 bg-slate-900/80'}`}>
                  <h3 className={`font-bold flex items-center gap-2 mb-1 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}><Sparkles size={18} className="text-violet-500" /> AI Inspektør</h3>
                  <p className="text-xs text-slate-500">
                    {selectedPage ? "Analyse av valgt side" : "Velg en side i tabellen for å starte."}
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">

                  {!selectedPage && (
                    <div className={`h-full flex flex-col items-center justify-center text-center ${theme === 'light' ? 'opacity-50' : 'opacity-40'}`}>
                      <MousePointer2 className="w-12 h-12 mb-3 text-slate-500" />
                      <p className={`text-sm font-bold ${theme === 'light' ? 'text-slate-700' : 'text-white'}`}>Ingen side valgt</p>
                      <p className="text-xs text-slate-500 max-w-[200px] mt-2">Klikk på en rad i tabellen til venstre for å se AI-analysen.</p>
                    </div>
                  )}

                  {selectedPage && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">

                      <div className={`p-4 rounded-xl border ${theme === 'light' ? 'bg-white shadow-sm border-slate-200' : 'bg-slate-950 border-white/10'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Analyserer</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded border ${theme === 'light' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-900 text-slate-400 border-white/5'}`}>{selectedPage.readability} lesbarhet</span>
                        </div>
                        <p className={`font-bold text-base mb-1 leading-snug ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{selectedPage.title}</p>
                        <a href={formData.websiteUrl + selectedPage.url} target="_blank" rel="noreferrer" className="text-xs text-violet-500 hover:text-violet-600 flex items-center gap-1 truncate mt-2">
                          <ExternalLink size={10} /> {selectedPage.url}
                        </a>
                      </div>

                      <div className="relative">
                        {currentLevel < 2 && (
                          <div className={`absolute inset-0 backdrop-blur-[1px] z-20 flex items-center justify-center rounded-xl border ${theme === 'light' ? 'bg-white/80 border-slate-200' : 'bg-slate-900/80 border-white/5'}`}>
                            <div className="text-center p-4">
                              <Lock className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                              <p className={`text-sm font-bold mb-1 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Standard Funksjon</p>
                              <p className="text-xs text-slate-500 mb-3">Se konkrete feil og tiltak.</p>
                              <button onClick={handleUpgrade} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${theme === 'light' ? 'bg-slate-900 text-white hover:bg-violet-600' : 'bg-white text-slate-900 hover:bg-slate-200'}`}>Oppgrader</button>
                            </div>
                          </div>
                        )}

                        <h4 className={`text-sm font-bold mb-3 flex items-center gap-2 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                          <Activity size={16} className="text-emerald-500" /> Kvalitetsrapport
                        </h4>

                        <div className="space-y-3">
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`flex-1 h-2 rounded-full overflow-hidden ${theme === 'light' ? 'bg-slate-200' : 'bg-slate-800'}`}>
                              <div className={`h-full rounded-full ${selectedPage.score > 70 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${selectedPage.score}%` }}></div>
                            </div>
                            <span className={`text-xs font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{selectedPage.score}/100</span>
                          </div>

                          {selectedPage.issues.length > 0 ? (
                            <div className={`flex gap-3 items-start p-3 rounded-lg border ${theme === 'light' ? 'bg-rose-50 border-rose-200' : 'bg-rose-500/10 border-rose-500/20'}`}>
                              <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={16} />
                              <div>
                                <p className={`text-sm font-bold ${theme === 'light' ? 'text-rose-700' : 'text-rose-400'}`}>Problemer funnet</p>
                                <ul className={`text-xs mt-1 list-disc pl-4 space-y-1 ${theme === 'light' ? 'text-rose-600' : 'text-slate-300'}`}>
                                  {selectedPage.issues.map((issue, idx) => (
                                    <li key={idx}>{issue}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          ) : (
                            <div className={`flex gap-3 items-start p-3 rounded-lg border ${theme === 'light' ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                              <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={16} />
                              <div>
                                <p className={`text-sm font-bold ${theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'}`}>Alt ser bra ut</p>
                                <p className={`text-xs mt-1 ${theme === 'light' ? 'text-emerald-600' : 'text-slate-300'}`}>Ingen kritiske tekniske feil funnet.</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={`relative pt-4 border-t ${theme === 'light' ? 'border-slate-200' : 'border-white/5'}`}>
                        {currentLevel < 3 && (
                          <div className={`absolute inset-0 backdrop-blur-[1px] z-20 flex items-center justify-center rounded-xl border mt-4 ${theme === 'light' ? 'bg-white/80 border-slate-200' : 'bg-slate-900/80 border-white/5'}`}>
                            <div className="text-center p-4">
                              <BrainCircuit className="w-8 h-8 text-fuchsia-500 mx-auto mb-2" />
                              <p className={`text-sm font-bold mb-1 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Premium Strategi</p>
                              <p className="text-xs text-slate-500 mb-3">La AI skrive og planlegge innhold.</p>
                              <button onClick={handleUpgrade} className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md hover:shadow-lg transition-all">Oppgrader</button>
                            </div>
                          </div>
                        )}

                        <h4 className={`text-sm font-bold mb-3 flex items-center gap-2 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                          <Layers size={16} className="text-fuchsia-500" /> Strategi & Handling
                        </h4>

                        <div className={`p-4 rounded-xl border ${theme === 'light' ? 'bg-gradient-to-b from-fuchsia-50/50 to-white border-fuchsia-100 shadow-sm' : 'bg-gradient-to-b from-fuchsia-900/10 to-slate-900 border-fuchsia-500/20'}`}>
                          <div className="flex justify-between items-center mb-4">
                            <div>
                              <p className={`text-[10px] font-bold uppercase tracking-wide ${theme === 'light' ? 'text-fuchsia-600' : 'text-fuchsia-300'}`}>Topic Cluster</p>
                              <p className={`text-sm font-medium ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{selectedPage.topicCluster}</p>
                            </div>
                            <div className="text-right">
                              <p className={`text-[10px] font-bold uppercase tracking-wide ${theme === 'light' ? 'text-fuchsia-600' : 'text-fuchsia-300'}`}>Anbefaling</p>
                              <p className={`text-sm font-medium ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{selectedPage.action}</p>
                            </div>
                          </div>

                          {aiResponse && (
                            <div className={`mb-4 p-3 rounded-lg border animate-in slide-in-from-top-2 ${theme === 'light' ? 'bg-violet-50 border-violet-100' : 'bg-white/10 border-white/10'}`}>
                              <p className="text-[10px] text-emerald-500 font-bold uppercase mb-1 flex items-center gap-1"><Sparkles size={10} /> {aiResponse.title}</p>
                              {aiResponse.type === 'text' ? (
                                <p className={`text-xs leading-relaxed italic ${theme === 'light' ? 'text-slate-700' : 'text-white'}`}>"{aiResponse.content}"</p>
                              ) : (
                                aiResponse.links ? (
                                  <ul className={`text-xs space-y-1 ${theme === 'light' ? 'text-slate-700' : 'text-white'}`}>
                                    {aiResponse.links.map((l: any, idx: number) => (
                                      <li key={idx}>🔗 Fra <span className="font-bold">{l.fromUrl}</span></li>
                                    ))}
                                  </ul>
                                ) : <p className="text-xs text-slate-500">Fant ingen andre sider å lenke fra.</p>
                              )}
                            </div>
                          )}

                          <div className="space-y-2">
                            <button onClick={() => handleAiAction('text')} disabled={aiLoading !== null} className={`w-full py-2.5 rounded text-xs font-bold border flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${theme === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-violet-600' : 'bg-slate-800 border-white/10 text-white hover:bg-slate-700'}`}>
                              {aiLoading === 'text' ? <Loader2 className="animate-spin" size={12} /> : <Edit2 size={12} />}
                              Generer forbedret tekst (AI)
                            </button>
                            <button onClick={() => handleAiAction('links')} disabled={aiLoading !== null} className={`w-full py-2.5 rounded text-xs font-bold border flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${theme === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-violet-600' : 'bg-slate-800 border-white/10 text-white hover:bg-slate-700'}`}>
                              {aiLoading === 'links' ? <Loader2 className="animate-spin" size={12} /> : <Link2 size={12} />}
                              Finn interne lenker
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* --- LENKER & STRUKTUR (LINKS PAGE) --- */}
        {activeTab === 'links' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-40">

            <div className={`flex flex-col md:flex-row justify-between items-end gap-6 p-8 rounded-3xl border relative overflow-hidden transition-all duration-300 ${theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/50 border-white/5'}`}>
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none"></div>

              <div className="relative z-10">
                <h1 className={`text-4xl font-black tracking-tight flex items-center gap-3 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                  Lenkestruktur
                </h1>
                <p className={`mt-2 text-lg font-light max-w-2xl ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                  Optimaliser flyten av trafikk på nettstedet ditt. Vi finner ødelagte lenker, isolerte sider og forbedrer intern struktur.
                </p>
              </div>

              <button
                onClick={() => runLinkScan()}
                disabled={isScanningLinks}
                className="relative z-10 bg-violet-600 hover:bg-violet-500 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-violet-500/20 flex items-center gap-3 transition-all whitespace-nowrap group"
              >
                {isScanningLinks ? <Loader2 className="animate-spin" /> : <Link2 className="group-hover:rotate-45 transition-transform duration-500" />}
                {isScanningLinks ? 'Kartlegger lenker...' : 'Start Lenkeanalyse'}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Interne Lenker', val: linkPages.length > 0 ? linkPages.reduce((acc, p) => acc + p.inlinks, 0) : '-', icon: GitMerge, col: theme === 'light' ? 'text-blue-600' : 'text-blue-400', hint: 'Totalt antall lenker som går mellom dine egne sider.' },
                { label: 'Isolerte Sider', val: linkPages.length > 0 ? linkPages.filter(p => p.status === 'Isolert').length : '-', icon: Unlink, col: 'text-amber-500', hint: 'Sider som ingen andre lenker til (Orphan pages).' },
                { label: 'Ødelagte Lenker', val: linkPages.length > 0 ? linkPages.reduce((acc, p) => acc + p.brokenLinks, 0) : '-', icon: XCircle, col: 'text-rose-500', hint: 'Lenker som gir 404-feil og stopper brukeren.' },
                { label: 'Lenke-Score', val: linkPages.length > 0 ? (currentLevel >= 2 ? Math.round(linkPages.reduce((acc, p) => acc + p.linkScore, 0) / linkPages.length) + '/100' : 'Låst') : '-', icon: Activity, col: currentLevel >= 2 ? 'text-emerald-500' : 'text-slate-500', hint: 'Hvor godt nettstedet ditt er knyttet sammen.' },
              ].map((stat, i) => (
                <div key={i} className={`p-6 rounded-2xl border relative group transition-all overflow-visible z-10 duration-300 ${theme === 'light' ? 'bg-white border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] hover:shadow-[0_8px_20px_-6px_rgba(6,81,237,0.1)] hover:border-violet-200' : 'bg-slate-900/50 border-white/5 hover:border-white/10'}`}>
                  <div className={`absolute top-4 right-4 opacity-20 ${stat.col}`}><stat.icon size={24} /></div>
                  <div className="flex items-center gap-2 mb-2 relative z-20">
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>{stat.label}</p>
                    <InfoHint text={stat.hint} />
                  </div>
                  <p className={`text-3xl font-black ${stat.col} flex items-center gap-2`}>
                    {stat.val === 'Låst' && <Lock size={16} className="text-slate-400" />}
                    {stat.val}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[800px]">

              <div className={`lg:col-span-2 rounded-3xl border shadow-xl flex flex-col overflow-hidden relative transition-all duration-300 ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/50 border-white/5'}`}>
                <div className={`p-6 border-b flex justify-between items-center ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'}`}>
                  <h3 className={`font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}><Link2 size={18} className="text-blue-500" /> Lenkestruktur</h3>
                  {linkPages.length > 0 && <span className="text-xs text-slate-500">{linkPages.length} Sider</span>}
                </div>

                <div className="flex-1 overflow-hidden relative">
                  {linkPages.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                      <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 relative ${theme === 'light' ? 'bg-blue-50' : 'bg-slate-800/50'}`}>
                        <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-pulse"></div>
                        <GitMerge size={40} className="text-blue-500 relative z-10" />
                      </div>
                      <h3 className={`text-xl font-bold mb-2 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Klar for lenkeanalyse</h3>
                      <p className={`text-sm max-w-sm leading-relaxed mb-8 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                        Klikk på <span className="font-bold">"Start Lenkeanalyse"</span> for å kartlegge hvordan sidene dine henger sammen.
                      </p>
                    </div>
                  ) : (
                    <div className="h-full overflow-y-auto overflow-x-hidden custom-scrollbar">
                      <table className="w-full text-left border-collapse">
                        <thead className={`text-[10px] uppercase font-black tracking-wider sticky top-0 z-20 shadow-sm ${theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-slate-950 text-slate-500'}`}>
                          <tr>
                            <th className="p-4"><div className="flex items-center gap-1 cursor-help">Side / URL <InfoHint text="Siden vi analyserer." /></div></th>
                            <th className="p-4"><div className="flex items-center gap-1 cursor-help">Innlenker <InfoHint text="Antall andre sider som peker TIL denne." /></div></th>
                            <th className="p-4"><div className="flex items-center gap-1 cursor-help">Utlenker <InfoHint text="Antall lenker FRA denne siden til andre." /></div></th>
                            <th className="p-4"><div className="flex items-center gap-1 cursor-help">Status <InfoHint text="Teknisk tilstand på lenkene." /></div></th>
                          </tr>
                        </thead>
                        <tbody className={`divide-y text-sm ${theme === 'light' ? 'divide-slate-100' : 'divide-white/5'}`}>
                          {linkPages.map((page, i) => (
                            <tr
                              key={i}
                              onClick={() => setSelectedLinkPage(page)}
                              className={`transition-colors group cursor-pointer 
                                ${theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-white/5'}
                                ${selectedLinkPage === page ? (theme === 'light' ? 'bg-violet-50/50 border-l-2 border-violet-500' : 'bg-white/10 border-l-2 border-violet-500') : ''}
                              `}
                            >
                              <td className="p-4">
                                <div className={`font-bold truncate max-w-[200px] ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{page.title}</div>
                                <div className="text-xs text-slate-500 truncate max-w-[200px]">{page.url}</div>
                              </td>
                              <td className="p-4">
                                <div className={`font-bold ${page.inlinks === 0 ? 'text-rose-500' : (theme === 'light' ? 'text-slate-700' : 'text-slate-300')}`}>{page.inlinks}</div>
                              </td>
                              <td className="p-4">
                                <div className={`font-bold ${page.outlinks === 0 ? 'text-amber-500' : (theme === 'light' ? 'text-slate-700' : 'text-slate-300')}`}>{page.outlinks}</div>
                              </td>
                              <td className="p-4">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border flex w-fit items-center gap-1 
                                  ${page.status === 'Bra' ? (theme === 'light' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20') :
                                    page.status === 'Isolert' ? (theme === 'light' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-rose-500/10 text-rose-400 border-rose-500/20') :
                                      page.status === 'Blindvei' ? (theme === 'light' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-amber-500/10 text-amber-400 border-amber-500/20') :
                                        (theme === 'light' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-rose-500/10 text-rose-400 border-rose-500/20')}
                                `}>
                                  {page.status === 'Bra' && <CheckCircle2 size={10} />}
                                  {page.status === 'Isolert' && <Unlink size={10} />}
                                  {page.status === 'Blindvei' && <Minus size={10} />}
                                  {page.status === 'Kritisk' && <AlertTriangle size={10} />}
                                  {page.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. AI LENKE-INSPEKTØR */}
              <div className={`rounded-3xl border flex flex-col h-full relative overflow-hidden shadow-2xl transition-all duration-300 ${theme === 'light' ? 'bg-gradient-to-b from-blue-50/50 to-white border-blue-100' : 'bg-slate-900/50 border-white/5'}`}>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-violet-500"></div>

                <div className={`p-6 border-b ${theme === 'light' ? 'border-blue-100 bg-white' : 'border-white/5 bg-slate-900/80'}`}>
                  <h3 className={`font-bold flex items-center gap-2 mb-1 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}><Sparkles size={18} className="text-blue-500" /> AI Lenke-Inspektør</h3>
                  <p className="text-xs text-slate-500">
                    {selectedLinkPage ? "Analyse av valgt side" : "Velg en side i tabellen for å starte."}
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
                  {!selectedLinkPage && (
                    <div className={`h-full flex flex-col items-center justify-center text-center ${theme === 'light' ? 'opacity-50' : 'opacity-40'}`}>
                      <GitMerge className="w-12 h-12 mb-3 text-slate-500" />
                      <p className={`text-sm font-bold ${theme === 'light' ? 'text-slate-700' : 'text-white'}`}>Ingen side valgt</p>
                      <p className="text-xs text-slate-500 max-w-[200px] mt-2">Klikk på en rad i tabellen for å se AI-forslag til intern lenking.</p>
                    </div>
                  )}

                  {selectedLinkPage && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <div className={`p-4 rounded-xl border ${theme === 'light' ? 'bg-white shadow-sm border-slate-200' : 'bg-slate-950 border-white/10'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Analyserer</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded border ${selectedLinkPage.status === 'Bra' ? (theme === 'light' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10') : (theme === 'light' ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-rose-400 border-rose-500/20 bg-rose-500/10')}`}>
                            {selectedLinkPage.status === 'Bra' ? 'God struktur' : selectedLinkPage.status}
                          </span>
                        </div>
                        <p className={`font-bold text-base mb-1 leading-snug ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{selectedLinkPage.title}</p>
                        <div className="text-xs text-blue-500 flex items-center gap-1 truncate mt-2">
                          <Link2 size={10} /> {selectedLinkPage.url}
                        </div>
                      </div>

                      <div className="relative">
                        {currentLevel < 2 && (
                          <div className={`absolute inset-0 backdrop-blur-[1px] z-20 flex items-center justify-center rounded-xl border ${theme === 'light' ? 'bg-white/80 border-slate-200' : 'bg-slate-900/80 border-white/5'}`}>
                            <div className="text-center p-4">
                              <Lock className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                              <p className={`text-sm font-bold mb-1 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Standard Funksjon</p>
                              <p className="text-xs text-slate-500 mb-3">Se ødelagte lenker og ankertekst-feil.</p>
                              <button onClick={handleUpgrade} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${theme === 'light' ? 'bg-slate-900 text-white hover:bg-violet-600' : 'bg-white text-slate-900 hover:bg-slate-200'}`}>Oppgrader</button>
                            </div>
                          </div>
                        )}

                        <h4 className={`text-sm font-bold mb-3 flex items-center gap-2 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                          <ShieldCheck size={16} className="text-emerald-500" /> Lenkehelse
                        </h4>

                        <div className="space-y-3">
                          <div className={`p-3 rounded-lg border space-y-2 ${theme === 'light' ? 'bg-white shadow-sm border-slate-200' : 'bg-white/5 border-white/5'}`}>
                            <div className="flex justify-between text-xs">
                              <span className={theme === 'light' ? 'text-slate-600' : 'text-slate-300'}>Lenke-score</span>
                              <span className={`font-bold ${selectedLinkPage.linkScore > 80 ? 'text-emerald-500' : 'text-amber-500'}`}>{selectedLinkPage.linkScore}/100</span>
                            </div>
                            <div className={`w-full h-1 rounded-full overflow-hidden ${theme === 'light' ? 'bg-slate-200' : 'bg-slate-800'}`}>
                              <div className={`h-full rounded-full ${selectedLinkPage.linkScore > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${selectedLinkPage.linkScore}%` }}></div>
                            </div>
                          </div>

                          {selectedLinkPage.brokenLinks > 0 ? (
                            <div className={`flex gap-3 items-start p-3 rounded-lg border ${theme === 'light' ? 'bg-rose-50 border-rose-200' : 'bg-rose-500/10 border-rose-500/20'}`}>
                              <XCircle className="text-rose-500 shrink-0 mt-0.5" size={16} />
                              <div>
                                <p className={`text-sm font-bold ${theme === 'light' ? 'text-rose-700' : 'text-rose-400'}`}>{selectedLinkPage.brokenLinks} ødelagte lenker</p>
                                <p className={`text-xs mt-1 ${theme === 'light' ? 'text-rose-600' : 'text-slate-300'}`}>Disse lenkene gir 404-feil. Fjern eller oppdater dem umiddelbart.</p>
                              </div>
                            </div>
                          ) : (
                            <div className={`flex gap-3 items-start p-3 rounded-lg border ${theme === 'light' ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                              <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={16} />
                              <div>
                                <p className={`text-sm font-bold ${theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'}`}>Ingen døde lenker</p>
                                <p className={`text-xs mt-1 ${theme === 'light' ? 'text-emerald-600' : 'text-slate-300'}`}>Alle lenker på denne siden fungerer.</p>
                              </div>
                            </div>
                          )}

                          {selectedLinkPage.status === 'Isolert' && (
                            <div className={`flex gap-3 items-start p-3 rounded-lg border ${theme === 'light' ? 'bg-amber-50 border-amber-200' : 'bg-amber-500/10 border-amber-500/20'}`}>
                              <Unlink className="text-amber-500 shrink-0 mt-0.5" size={16} />
                              <div>
                                <p className={`text-sm font-bold ${theme === 'light' ? 'text-amber-700' : 'text-amber-400'}`}>Siden er isolert</p>
                                <p className={`text-xs mt-1 ${theme === 'light' ? 'text-amber-600' : 'text-slate-300'}`}>Ingen andre sider lenker hit. Google kan ikke finne den.</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={`relative pt-4 border-t ${theme === 'light' ? 'border-slate-200' : 'border-white/5'}`}>
                        {currentLevel < 3 && (
                          <div className={`absolute inset-0 backdrop-blur-[1px] z-20 flex items-center justify-center rounded-xl border mt-4 ${theme === 'light' ? 'bg-white/80 border-slate-200' : 'bg-slate-900/80 border-white/5'}`}>
                            <div className="text-center p-4">
                              <BrainCircuit className="w-8 h-8 text-fuchsia-500 mx-auto mb-2" />
                              <p className={`text-sm font-bold mb-1 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Premium Strategi</p>
                              <p className="text-xs text-slate-500 mb-3">Se nøyaktig hvilke lenker du bør bygge.</p>
                              <button onClick={handleUpgrade} className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md hover:shadow-lg transition-all">Oppgrader</button>
                            </div>
                          </div>
                        )}

                        <h4 className={`text-sm font-bold mb-3 flex items-center gap-2 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                          <GitMerge size={16} className="text-fuchsia-500" /> AI Lenkeforslag
                        </h4>

                        <div className="space-y-3">
                          {selectedLinkPage.suggestedInlinks.length > 0 ? (
                            selectedLinkPage.suggestedInlinks.map((s, idx) => (
                              <div key={idx} className={`p-3 rounded-xl border ${theme === 'light' ? 'bg-fuchsia-50/50 border-fuchsia-100' : 'bg-gradient-to-br from-slate-900 to-fuchsia-900/20 border-fuchsia-500/20'}`}>
                                <p className={`text-[10px] font-bold uppercase mb-2 ${theme === 'light' ? 'text-fuchsia-600' : 'text-fuchsia-300'}`}>Lag lenke fra:</p>
                                <div className={`text-xs font-mono p-1.5 rounded mb-2 truncate ${theme === 'light' ? 'bg-white border border-slate-200 text-slate-800' : 'bg-black/30 text-white'}`}>
                                  {s.fromUrl}
                                </div>
                                <div className={`flex gap-2 items-center text-xs ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                                  <span className="text-fuchsia-500 font-bold">Ankertekst:</span> "{s.anchor}"
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className={`p-4 rounded-xl text-center border ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/50 border-white/5'}`}>
                              <p className="text-xs text-slate-500">Ingen spesifikke lenkeforslag akkurat nå. Siden er godt integrert.</p>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* --- KOMPLETT SØKEORD SIDE --- */}
        {activeTab === 'keywords' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 pb-40">

            {/* HEADER & INPUT SECTION */}
            <div className="flex flex-col xl:flex-row justify-between items-end gap-8">
              <div>
                <h1 className={`text-4xl font-black tracking-tight ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Søkeord & Synlighet</h1>
                <p className={`mt-2 text-lg font-light max-w-xl ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                  Sanntidsanalyse av din markedsposisjon på Google Norge.
                </p>
              </div>

              {/* MODERNE SØKEBAR MED KVOTE */}
              <div className="w-full xl:w-auto">
                <div className="flex justify-between items-end mb-2 px-1">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>Din Søkeordskvote</span>
                  <span className={`text-xs font-black ${keywordsUsed >= currentKeywordLimit ? 'text-rose-500' : 'text-violet-500'}`}>
                    {keywordsUsed} / {currentKeywordLimit} brukt
                  </span>
                </div>

                <div className={`p-2 rounded-2xl border flex flex-col md:flex-row items-center shadow-lg transition-all
                  ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-white/10'}
                  ${!canAddMoreKeywords ? 'opacity-80 ring-1 ring-rose-500/50' : ''}
                `}>

                  {/* SØKEORD INPUT */}
                  <div className={`relative w-full md:w-56 group border-b md:border-b-0 md:border-r transition-colors ${theme === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
                    <Search className={`absolute left-4 top-3 transition-colors ${!canAddMoreKeywords ? 'text-rose-400' : 'text-slate-400 group-focus-within:text-violet-500'}`} size={18} />
                    <input
                      value={newKeywordInput}
                      onChange={(e) => setNewKeywordInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                      placeholder={canAddMoreKeywords ? "Søkeord (f.eks 'rørlegger')" : "Kvoten er full..."}
                      disabled={!canAddMoreKeywords}
                      className={`bg-transparent pl-12 pr-4 py-2.5 outline-none w-full font-medium transition-all
                        ${theme === 'light' ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-slate-600'}
                        ${!canAddMoreKeywords ? 'cursor-not-allowed' : ''}
                      `}
                    />
                  </div>

                  {/* KOMMUNE INPUT */}
                  <div className="relative w-full md:w-48 group">
                    <MapIcon className={`absolute left-4 top-3 transition-colors ${!canAddMoreKeywords ? 'text-rose-400' : 'text-slate-400 group-focus-within:text-violet-500'}`} size={18} />
                    <input
                      value={locationInput}
                      onFocus={() => setShowSuggestions(true)}
                      onChange={(e) => { setLocationInput(e.target.value); setShowSuggestions(true); }}
                      disabled={!canAddMoreKeywords}
                      placeholder="Sted (f.eks Oslo)"
                      className={`bg-transparent pl-12 pr-4 py-2.5 outline-none w-full font-medium transition-all
                        ${theme === 'light' ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-slate-600'}
                        ${!canAddMoreKeywords ? 'cursor-not-allowed' : ''}
                      `}
                    />

                    {/* DROPDOWN FOR KOMMUNER */}
                    {showSuggestions && locationInput?.length > 0 && canAddMoreKeywords && (
                      <div className={`absolute top-full left-0 w-full max-h-60 overflow-y-auto border rounded-xl mt-2 shadow-xl z-50
                        ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'}
                      `}>
                        {NORWEGIAN_MUNICIPALITIES
                          .filter(m => m.toLowerCase().startsWith(locationInput.toLowerCase()))
                          ?.map((m) => (
                            <button
                              key={m}
                              onClick={() => { setLocationInput(m); setShowSuggestions(false); }}
                              className={`w-full text-left px-4 py-2 text-sm transition-colors block
                                ${theme === 'light' ? 'text-slate-700 hover:bg-violet-50 hover:text-violet-700' : 'text-slate-300 hover:bg-violet-600 hover:text-white'}
                              `}
                            >
                              {m}
                            </button>
                          ))
                        }
                      </div>
                    )}
                    {showSuggestions && <div className="fixed inset-0 z-[-1]" onClick={() => setShowSuggestions(false)}></div>}
                  </div>

                  <button
                    onClick={handleCheckRankings}
                    disabled={rankingLoading || keywordsToTrack?.length === 0}
                    className="w-full md:w-auto bg-violet-600 hover:bg-violet-500 text-white px-8 py-2.5 rounded-xl font-bold ml-2 shadow-lg shadow-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 mt-2 md:mt-0"
                  >
                    {rankingLoading ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                    {rankingLoading ? 'Søker...' : 'Kjør Analyse'}
                  </button>
                </div>
              </div>
            </div>

            {/* SEKSJON 1: KEY METRICS */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[
                { label: 'Totalt Søkeord', hint: 'Antall ord du overvåker akkurat nå.', val: hasSearched ? (keywordData?.length || 0) : '-', icon: Layers, col: 'text-violet-500' },
                { label: 'Topp 3', hint: 'Antall ord der du er blant de 3 beste i Norge.', val: hasSearched ? (keywordData?.filter(k => k.position <= 3)?.length || 0) : '-', icon: Trophy, col: 'text-amber-500' },
                { label: 'Topp 10', hint: 'Antall ord du har på Googles førsteside.', val: hasSearched ? (keywordData?.filter(k => k.position <= 10)?.length || 0) : '-', icon: CheckCircle2, col: 'text-emerald-500' },
                { label: 'Synlighet', hint: 'Prosentandel av dine ord som er synlige for kunder.', val: hasSearched && keywordData?.length > 0 ? Math.round(((keywordData?.filter(k => k.position <= 50)?.length || 0) / keywordData.length) * 100) + '%' : '-', icon: Eye, col: 'text-blue-500' },
                { label: 'Endring (30d)', hint: 'Hvordan plasseringene dine har endret seg siste måned.', val: '+0', icon: TrendingUp, col: theme === 'light' ? 'text-slate-900' : 'text-white' },
                { label: 'Potensial', hint: 'Hvor mye mer trafikk du kan få ved å optimalisere.', val: 'Høyt', icon: Target, col: 'text-violet-500' },
              ]?.map((stat, i) => (
                <div key={i} className={`p-5 rounded-2xl border flex flex-col justify-between h-28 relative overflow-visible group transition-all z-10 duration-300
                  ${theme === 'light' ? 'bg-white border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] hover:shadow-[0_8px_20px_-6px_rgba(6,81,237,0.1)] hover:border-violet-200' : 'bg-slate-900/50 border-white/5 hover:border-white/10'}
                `}>
                  <div className={`absolute top-3 right-3 opacity-20 ${stat.col}`}><stat.icon size={24} /></div>
                  <div className="flex items-center relative z-20">
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{stat.label}</p>
                    <InfoHint text={stat.hint} />
                  </div>
                  <p className={`text-3xl font-black ${stat.col}`}>{stat.val}</p>
                </div>
              ))}
            </div>

            {/* GRID LAYOUT: GRAF + AI PANEL */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* SEKSJON 4: HISTORISK GRAF */}
              <div className={`lg:col-span-2 rounded-3xl border p-6 relative overflow-hidden h-96 transition-all duration-300
                ${theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/50 border-white/5'}
              `}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className={`font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}><Activity size={18} className="text-violet-500" /> Rangeringstrend</h3>
                  {currentLevel < 2 && <span className={`text-[10px] px-2 py-1 rounded border flex gap-1 ${theme === 'light' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-800 text-slate-400 border-slate-700'}`}><Lock size={10} /> Låst</span>}
                </div>

                <div className="h-64 w-full flex items-center justify-center">
                  {currentLevel >= 2 ? (
                    keywordData?.length > 0 && keywordData[0]?.history?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={keywordData[0].history}>
                          <defs>
                            <linearGradient id="colorRank" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e2e8f0' : '#334155'} opacity={theme === 'light' ? 0.8 : 0.3} />
                          <XAxis dataKey="date" stroke={theme === 'light' ? '#94a3b8' : '#64748b'} fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis reversed stroke={theme === 'light' ? '#94a3b8' : '#64748b'} fontSize={10} tickLine={false} axisLine={false} domain={[1, 100]} />
                          <RechartsTooltip
                            contentStyle={{
                              backgroundColor: theme === 'light' ? '#fff' : '#0f172a',
                              borderColor: theme === 'light' ? '#e2e8f0' : '#334155',
                              color: theme === 'light' ? '#0f172a' : '#fff',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                            itemStyle={{ color: '#8b5cf6', fontWeight: 'bold' }}
                          />
                          <Area type="monotone" dataKey="rank" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorRank)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className={`text-center ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                        <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-medium">Ingen historikk enda</p>
                        <p className="text-xs">Grafen bygges opp over tid.</p>
                      </div>
                    )
                  ) : (
                    <div className={`absolute inset-0 flex items-center justify-center z-10 backdrop-blur-sm ${theme === 'light' ? 'bg-white/80' : 'bg-slate-900/80'}`}>
                      <div className="text-center">
                        <Lock className="w-8 h-8 text-violet-500 mx-auto mb-2" />
                        <p className={`text-sm font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Oppgrader til Standard</p>
                        <button onClick={handleUpgrade} className="bg-violet-600 text-white px-4 py-2 rounded-lg text-xs font-bold mt-2 hover:bg-violet-700">Oppgrader nå</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SEKSJON 5: AI-ANALYSE */}
              <div className={`rounded-3xl border p-6 relative flex flex-col h-96 transition-all duration-300
                ${theme === 'light' ? 'bg-gradient-to-b from-violet-50/50 to-white border-violet-100 shadow-sm' : 'bg-gradient-to-b from-violet-900/20 to-slate-900/50 border-violet-500/20'}
              `}>
                <div className="flex items-center gap-3 mb-4 shrink-0">
                  <div className="p-2 bg-violet-600 rounded-lg text-white shadow-lg shadow-violet-500/50"><Sparkles size={18} /></div>
                  <div>
                    <h3 className={`font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>AI Rådgiver</h3>
                    <p className="text-[10px] text-violet-500 font-bold uppercase tracking-wide">Live Analyse</p>
                  </div>
                </div>

                {selectedKeyword ? (
                  <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                    <div className={`p-3 rounded-xl border ${theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/5 border-white/10'}`}>
                      <div className="flex justify-between items-center">
                        <p className={`font-bold truncate max-w-[120px] ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>"{selectedKeyword.keyword}"</p>
                        <span className={`text-xl font-black ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>#{selectedKeyword.position > 100 ? '-' : selectedKeyword.position}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {selectedKeyword.competitors && selectedKeyword.competitors.slice(0, 3)?.map((comp: any, i: number) => (
                        <div key={i} className={`text-xs p-2 rounded border ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-950/50 border-white/5 text-slate-300'}`}>
                          <span className="font-bold text-violet-500">#{comp.position}</span> <span className="ml-2 truncate">{comp.title.substring(0, 30)}...</span>
                        </div>
                      ))}
                    </div>

                    <div className={`p-3 rounded-xl border ${theme === 'light' ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                      <h4 className="text-emerald-500 font-bold text-xs mb-1 flex items-center gap-2"><Lightbulb size={12} /> Tips:</h4>
                      <p className={`text-[10px] leading-relaxed ${theme === 'light' ? 'text-emerald-900' : 'text-slate-300'}`}>
                        De over deg bruker ordet <strong>"{selectedKeyword.keyword}"</strong> tidlig i tittelen.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className={`flex-1 flex flex-col items-center justify-center text-center ${theme === 'light' ? 'opacity-40 text-slate-500' : 'opacity-50 text-slate-600'}`}>
                    <MousePointer2 className="w-12 h-12 mb-2" />
                    <p className="text-sm font-medium">Velg et ord</p>
                  </div>
                )}
              </div>
            </div>

            {/* SEKSJON 2: HOVEDTABELL */}
            <div className={`rounded-3xl border shadow-xl relative z-20 overflow-visible transition-all duration-300
              ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/50 backdrop-blur-xl border-white/5'}
            `}>
              <div className="overflow-visible">
                <table className="w-full text-left border-collapse">
                  <thead className={`text-[10px] uppercase font-black tracking-wider ${theme === 'light' ? 'bg-slate-50 text-slate-500 border-b border-slate-200 rounded-t-3xl' : 'bg-white/5 text-slate-400'}`}>
                    <tr>
                      <th className="p-6 rounded-tl-3xl"><div className="flex items-center">Søkeord & Sted <InfoHint text="Hva du vil bli funnet på." /></div></th>
                      <th className="p-6"><div className="flex items-center">Posisjon <InfoHint text="Din plassering på Google." /></div></th>
                      <th className="p-6"><div className="flex items-center">Intent <InfoHint text="Hva brukeren egentlig vil." /></div></th>
                      <th className="p-6"><div className="flex items-center">Resultat-type <InfoHint text="Kart, Bilder, Shopping osv." /></div></th>
                      <th className="p-6"><div className="flex items-center">KD % <InfoHint text="Vanskelighetsgrad (0-100)." /></div></th>
                      <th className="p-6 rounded-tr-3xl"></th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y text-sm ${theme === 'light' ? 'divide-slate-100' : 'divide-white/5'}`}>
                    {hasSearched ? (
                      keywordData?.length > 0 ? keywordData?.map((k, i) => (
                        <tr
                          key={i}
                          onClick={() => setSelectedKeyword(k)}
                          className={`transition-colors cursor-pointer group 
                            ${theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-white/5'}
                            ${selectedKeyword === k ? (theme === 'light' ? 'bg-violet-50/50 border-l-2 border-violet-500' : 'bg-white/5 border-l-2 border-violet-500') : ''}
                          `}
                        >
                          <td className="p-6">
                            <div className="flex items-center gap-2">
                              <span className={`font-bold text-base ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{k.keyword}</span>
                              {k.location && <span className={`px-2 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1 ${theme === 'light' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-800 text-slate-400 border-slate-700'}`}><MapIcon size={8} /> {k.location}</span>}
                            </div>
                          </td>

                          <td className="p-6">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border 
                              ${k.position <= 3 ? 'bg-amber-400 text-slate-900 border-amber-500 shadow-sm' :
                                k.position <= 10 ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm' :
                                  (theme === 'light' ? 'bg-slate-50 text-slate-600 border-slate-200' : 'bg-slate-800 text-slate-400 border-slate-700')}
                            `}>
                              {k.position > 100 ? '-' : k.position}
                            </div>
                          </td>

                          <td className="p-6">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border 
                              ${k.intent === 'Kjøp' ? (theme === 'light' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20') :
                                k.intent === 'Lokal' ? (theme === 'light' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-blue-500/10 text-blue-400 border-blue-500/20') :
                                  (theme === 'light' ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-slate-700/30 text-slate-400 border-slate-700')}
                            `}>
                              {k.intent}
                            </span>
                          </td>

                          <td className="p-6">
                            <div className={`font-bold text-sm flex items-center gap-2 ${k.volume.includes("Kart") ? 'text-emerald-500' :
                              k.volume.includes("Shopping") ? 'text-violet-500' :
                                k.volume.includes("Bilder") ? 'text-amber-500' : (theme === 'light' ? 'text-slate-500' : 'text-slate-400')
                              }`}>
                              {k.volume.includes("Kart") && <MapIcon size={14} />}
                              {k.volume.includes("Bilder") && <ImageIcon size={14} />}
                              {k.volume.includes("Shopping") && <ShoppingBag size={14} />}
                              {k.volume}
                            </div>
                          </td>

                          <td className="p-6">
                            <div className="flex items-center gap-2">
                              <div className={`w-16 h-1.5 rounded-full overflow-hidden ${theme === 'light' ? 'bg-slate-200' : 'bg-slate-800'}`}>
                                <div className={`h-full rounded-full ${k.kd > 60 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${k.kd}%` }}></div>
                              </div>
                              <span className={`text-xs font-bold ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{k.kd}</span>
                            </div>
                          </td>

                          <td className="p-6 text-right">
                            <button onClick={(e) => { e.stopPropagation(); handleRemoveKeyword(k.keyword, k.location); }} className={`p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${theme === 'light' ? 'text-slate-400 hover:text-rose-500 hover:bg-rose-50' : 'text-slate-600 hover:text-rose-500 hover:bg-rose-500/10'}`}>
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      )) : <tr><td colSpan={6} className={`p-12 text-center ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Ingen treff.</td></tr>
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-24 text-center">
                          <div className={`inline-block p-4 rounded-full mb-4 animate-pulse ${theme === 'light' ? 'bg-slate-50 text-slate-400' : 'bg-slate-800 text-slate-600'}`}><Search size={32} /></div>
                          <h3 className={`text-xl font-bold mb-2 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Klar til analyse</h3>
                          <p className={theme === 'light' ? 'text-slate-500' : 'text-slate-400'}>Legg til dine viktigste søkeord øverst for å starte.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SEKSJON 7 & 9: TOPIC CLUSTERS & STRATEGI */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* TOPIC CLUSTERS */}
              <div className={`p-6 rounded-3xl border relative overflow-hidden transition-all duration-300
                ${theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/50 border-white/5'}
              `}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className={`font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}><Layers size={18} className="text-blue-500" /> Topic Clusters</h3>
                  {currentLevel < 3 && <span className={`text-[10px] px-2 py-1 rounded border flex gap-1 ${theme === 'light' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-800 text-slate-400 border-slate-700'}`}><Lock size={10} /> Premium</span>}
                </div>

                {currentLevel >= 3 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {hasSearched && keywordData?.length > 0 ?
                      Object.entries(keywordData?.reduce((acc: any, item) => {
                        const topic = item.keyword.split(' ')[0].toLowerCase();
                        if (!acc[topic]) acc[topic] = [];
                        acc[topic].push(item);
                        return acc;
                      }, {}) || {}).slice(0, 4)?.map(([topic, items]: any, i) => (
                        <div key={i} className={`p-4 rounded-2xl border transition-colors ${theme === 'light' ? 'bg-slate-50 border-slate-200 hover:border-violet-300' : 'bg-slate-950 border-white/5 hover:border-violet-500/30'}`}>
                          <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>Tema</p>
                          <h4 className={`text-lg font-bold capitalize mb-3 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{topic}</h4>
                          <div className="space-y-1">
                            {items?.slice(0, 3)?.map((k: any, j: number) => (
                              <div key={j} className={`flex justify-between text-xs ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                                <span>{k.keyword}</span>
                                <span className={k.position <= 10 ? "text-emerald-500 font-bold" : "font-bold"}>#{k.position}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                      : <div className={`text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>Ingen data å grupper enda.</div>}
                  </div>
                ) : (
                  <div className={`absolute inset-0 top-14 flex items-center justify-center z-10 backdrop-blur-sm ${theme === 'light' ? 'bg-white/80' : 'bg-slate-900/80'}`}>
                    <LockedSection title="Se dine temaer" description="Vi grupperer søkeordene dine automatisk." reqPackage="Premium" onUpgrade={handleUpgrade} color="blue" />
                  </div>
                )}
              </div>

              {/* AI STRATEGI */}
              <div className={`p-6 rounded-3xl border relative overflow-hidden transition-all duration-300
                ${theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/50 border-white/5'}
              `}>
                {currentLevel < 3 && <div className={`absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm ${theme === 'light' ? 'bg-white/80' : 'bg-slate-950/80'}`}><LockedSection title="AI Strategi" description="Få en konkret slagplan." reqPackage="Premium" onUpgrade={handleUpgrade} color="emerald" /></div>}

                <h3 className={`font-bold mb-4 flex items-center gap-2 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}><BrainCircuit size={18} className="text-emerald-500" /> Neste Steg (AI)</h3>

                {keywordData?.length > 0 ? (
                  <ul className="space-y-4">
                    {keywordData?.some(k => k.position > 3 && k.position <= 10) && (
                      <li className={`flex gap-3 items-start text-sm p-3 rounded-xl border ${theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-700' : 'bg-white/5 border-white/5 text-slate-300'}`}>
                        <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                        <div>
                          <span className={`font-bold block mb-1 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Lavthengende frukt 🍏</span>
                          Du har ord på side 1 (pos 4-10). Oppdater disse sidene med 200 ord ekstra tekst for å nå topp 3.
                        </div>
                      </li>
                    )}
                    {keywordData?.some(k => k.position > 20) && (
                      <li className={`flex gap-3 items-start text-sm p-3 rounded-xl border ${theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-700' : 'bg-white/5 border-white/5 text-slate-300'}`}>
                        <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0"></div>
                        <div>
                          <span className={`font-bold block mb-1 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Mangler innhold 📝</span>
                          Flere ord rangerer dårlig. Vurder å skrive dedikerte artikler for disse temaene.
                        </div>
                      </li>
                    )}
                    <li className={`flex gap-3 items-start text-sm p-3 rounded-xl border ${theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-700' : 'bg-white/5 border-white/5 text-slate-300'}`}>
                      <div className="w-2 h-2 rounded-full bg-violet-500 mt-1.5 shrink-0"></div>
                      <div>
                        <span className={`font-bold block mb-1 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Tips for uken</span>
                        Sjekk konkurrent-panelet (øverst til høyre) for å se hva de gjør bedre enn deg.
                      </div>
                    </li>
                  </ul>
                ) : <p className={`text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>Kjør en analyse først for å få råd.</p>}
              </div>
            </div>

          </div>
        )}

        {/* --- RAPPORTER & STRATEGI (REPORTS PAGE) --- */}
        {activeTab === 'reports' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-40">

            {/* 1. HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-6 bg-slate-900/50 p-8 rounded-3xl border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none"></div>

              <div className="relative z-10">
                <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
                  Din SEO-Rapport
                </h1>
                <p className="text-slate-400 mt-2 text-lg font-light max-w-2xl">
                  {new Date().toLocaleDateString('no-NO', { month: 'long', year: 'numeric' }).replace(/^\w/, (c) => c.toUpperCase())}
                  &nbsp;• En samlet oversikt over din posisjon på Google.
                </p>
              </div>
            </div>

            {/* SJEKK OM DATA FINNES */}
            {(!hasSearched && contentPages.length === 0 && linkPages?.length === 0) ? (
              <div className="bg-slate-900/50 p-12 rounded-3xl border border-white/5 text-center flex flex-col items-center">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 relative">
                  <div className="absolute inset-0 bg-violet-500/20 rounded-full animate-ping"></div>
                  <Database size={32} className="text-violet-400 relative z-10" />
                </div>
                <h3 className="text-2xl font-black text-white mb-2">Vi mangler data for å bygge rapporten</h3>
                <p className="text-slate-400 max-w-md mx-auto mb-8 leading-relaxed">
                  Rapporten bygges automatisk basert på data fra nettsiden din. For å generere rapporten, må du først kjøre analyser i de andre fanene.
                </p>
                <div className="flex gap-4">
                  <button onClick={() => setActiveTab('keywords')} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors">1. Analyser Søkeord</button>
                  <button onClick={() => setActiveTab('content')} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors">2. Skann Innhold</button>
                </div>
              </div>
            ) : (
              <>
                {/* 2. HOVEDTALL (SEO HELSE) - BASIC */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* SEO Score (Kalkulert basert på ekte data) */}
                  <div className="bg-slate-900/50 rounded-3xl border border-white/5 p-8 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex items-center gap-2 mb-6 relative z-10">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Global SEO Helse</p>
                      <InfoHint text="Gjennomsnittet av din tekniske helse, innholdskvalitet og synlighet på Google." />
                    </div>

                    <div className="relative mb-4 z-10">
                      <svg className="w-40 h-40 transform -rotate-90">
                        <circle cx="50%" cy="50%" r="45%" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800" />
                        <circle cx="50%" cy="50%" r="45%" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-emerald-500 transition-all duration-1000"
                          strokeDasharray="283"
                          strokeDashoffset={283 - (283 * (
                            Math.round(((contentPages?.length > 0 ? (contentPages.reduce((acc, p) => acc + p.score, 0) / contentPages.length) : 0) +
                              (linkPages.length > 0 ? (linkPages.reduce((acc, p) => acc + p.linkScore, 0) / linkPages.length) : 0) +
                              (keywordData.length > 0 ? (keywordData.filter(k => k.position <= 10).length / keywordData.length * 100) : 0)) / 3) || 0
                          )) / 100}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-5xl font-black text-white">
                          {Math.round(((contentPages.length > 0 ? (contentPages.reduce((acc, p) => acc + p.score, 0) / contentPages.length) : 0) +
                            (linkPages.length > 0 ? (linkPages.reduce((acc, p) => acc + p.linkScore, 0) / linkPages.length) : 0) +
                            (keywordData.length > 0 ? (keywordData.filter(k => k.position <= 10).length / keywordData.length * 100) : 0)) / 3) || 0}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-emerald-400 relative z-10 bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/20">God tilstand. Klar for skalering.</p>
                  </div>

                  {/* Nøkkeltall Grid */}
                  <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                    <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 flex flex-col justify-between hover:bg-white/5 transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <Search size={20} className="text-blue-400" />
                        <InfoHint text="Antall søkeord du for øyeblikket rangerer på side 1 for." />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Topp 10 Søkeord</p>
                        <p className="text-3xl font-black text-white">{keywordData.filter(k => k.position <= 10).length}</p>
                      </div>
                    </div>

                    <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 flex flex-col justify-between hover:bg-white/5 transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <AlertTriangle size={20} className="text-rose-400" />
                        <InfoHint text="Sider med alvorlige tekniske feil eller for lite tekst." />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Kritiske Feil</p>
                        <p className="text-3xl font-black text-rose-400">{contentPages.filter(p => p.status === 'Kritisk').length}</p>
                      </div>
                    </div>

                    <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 flex flex-col justify-between hover:bg-white/5 transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <FileText size={20} className="text-amber-400" />
                        <InfoHint text="Sider som mangler interne lenker, og dermed er 'usynlige'." />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Isolerte Sider</p>
                        <p className="text-3xl font-black text-white">{linkPages.filter(p => p.status === 'Isolert').length}</p>
                      </div>
                    </div>

                    <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 flex flex-col justify-between hover:bg-white/5 transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <Link2 size={20} className="text-emerald-400" />
                        <InfoHint text="Totalt antall lenker som binder nettsiden din sammen." />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Interne Lenker</p>
                        <p className="text-3xl font-black text-white">{linkPages.reduce((acc, p) => acc + p.inlinks, 0)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. OPPSUMMERINGSLISTER - BASIC */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Suksess (Det som går bra) */}
                  <div className="bg-emerald-500/5 border border-emerald-500/20 p-6 rounded-3xl">
                    <h3 className="text-emerald-400 font-bold mb-4 flex items-center gap-2"><Trophy size={18} /> Dine største seiere</h3>
                    <ul className="space-y-3">
                      {keywordData.filter(k => k.position <= 3).slice(0, 3).map((k, i) => (
                        <li key={i} className="flex justify-between items-center text-sm p-3 bg-slate-900/50 rounded-xl border border-white/5">
                          <span className="text-white font-medium">"{k.keyword}"</span>
                          <span className="text-emerald-400 font-black">Pos #{k.position}</span>
                        </li>
                      ))}
                      {keywordData.filter(k => k.position <= 3).length === 0 && (
                        <li className="text-sm text-slate-400 p-3">Ingen søkeord på topp 3 enda. Fortsett optimaliseringen!</li>
                      )}
                    </ul>
                  </div>

                  {/* Tap (Det som må fikses) */}
                  <div className="bg-rose-500/5 border border-rose-500/20 p-6 rounded-3xl">
                    <h3 className="text-rose-400 font-bold mb-4 flex items-center gap-2"><AlertOctagon size={18} /> Krever oppmerksomhet</h3>
                    <ul className="space-y-3">
                      {contentPages.filter(p => p.status === 'Kritisk').slice(0, 3).map((p, i) => (
                        <li key={i} className="flex justify-between items-center text-sm p-3 bg-slate-900/50 rounded-xl border border-white/5">
                          <span className="text-white font-medium truncate max-w-[200px]">{p.title}</span>
                          <span className="text-rose-400 font-bold text-xs bg-rose-500/10 px-2 py-1 rounded">Kritisk feil</span>
                        </li>
                      ))}
                      {contentPages.filter(p => p.status === 'Kritisk').length === 0 && (
                        <li className="text-sm text-slate-400 p-3">Ingen kritiske feil funnet. Fantastisk!</li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* 4. STANDARD PAKKE - DYNAMISK AI ANALYSE */}
                <div className="relative">
                  {currentLevel < 2 && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] z-10 rounded-3xl flex items-center justify-center border border-white/5">
                      <LockedSection title="AI-Forklaring av utviklingen" description="Forstå HVORFOR trafikken går opp eller ned i rent språk." reqPackage="Standard" onUpgrade={handleUpgrade} color="blue" />
                    </div>
                  )}

                  <div className="bg-slate-900/50 border border-white/5 rounded-3xl overflow-hidden">
                    <div className="p-6 border-b border-white/5 flex items-center gap-3 bg-gradient-to-r from-blue-900/20 to-transparent">
                      <Sparkles className="text-blue-400" size={20} />
                      <h3 className="text-lg font-bold text-white">AI-Analyse av dine data</h3>
                    </div>

                    {dynamicReport ? (
                      <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <div className="space-y-6">
                          {/* POSITIVT */}
                          <div className="p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl relative">
                            <div className="absolute -left-2 top-6 w-1 h-8 bg-emerald-500 rounded-r-md"></div>
                            <p className="text-sm text-slate-300 leading-relaxed">
                              <strong className="text-emerald-400 block mb-1">{dynamicReport.growthTitle}</strong>
                              {dynamicReport.growthText}
                            </p>
                          </div>

                          {/* NEGATIVT */}
                          <div className="p-5 bg-rose-500/5 border border-rose-500/10 rounded-2xl relative">
                            <div className="absolute -left-2 top-6 w-1 h-8 bg-rose-500 rounded-r-md"></div>
                            <p className="text-sm text-slate-300 leading-relaxed">
                              <strong className="text-rose-400 block mb-1">{dynamicReport.problemTitle}</strong>
                              {dynamicReport.problemText}
                            </p>
                          </div>
                        </div>

                        {/* GRAF (Beholder denne som visuell referanse for nå) */}
                        <div className="bg-slate-950 rounded-2xl p-6 border border-white/5 h-64 flex flex-col">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="text-xs font-bold text-slate-500 uppercase">Synlighet (Simulert trend)</h4>
                            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">Positiv trend</span>
                          </div>
                          <div className="flex-1 w-full flex items-end gap-2 pb-2">
                            {[40, 42, 45, 48, 55, 60, 62, 65, 70, 72, 80, 85].map((h, i) => (
                              <div key={i} className="flex-1 bg-blue-500/20 rounded-t-sm relative group" style={{ height: `${h}%` }}></div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center text-slate-500">Laster analyse...</div>
                    )}
                  </div>
                </div>

                {/* 5. PREMIUM PAKKE - DYNAMISK HANDLINGSPLAN */}
                <div className="relative">
                  {currentLevel < 3 && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] z-10 rounded-3xl flex items-center justify-center border border-white/5">
                      <LockedSection title="Premium Strategi" description="Få en ferdig ukentlig arbeidsplan basert på dine faktiske feil." reqPackage="Premium" onUpgrade={handleUpgrade} color="fuchsia" />
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Ukentlig Plan - NÅ MED EKTE OPPGAVER */}
                    <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-fuchsia-950/20 border border-fuchsia-500/20 p-8 rounded-3xl">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-black text-white flex items-center gap-2"><Target className="text-fuchsia-400" /> Din Ukentlige Handlingsplan</h3>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300 bg-fuchsia-500/20 px-3 py-1.5 rounded-full">Prioritert av AI</span>
                      </div>

                      <div className="space-y-4">
                        {dynamicReport && dynamicReport.tasks.map((item: any, i: number) => (
                          <div key={i} className="bg-slate-900/80 p-4 rounded-2xl border border-white/5 flex justify-between items-center group hover:border-white/20 transition-all">
                            <div className="flex items-center gap-4">
                              <div className={`w-6 h-6 rounded-full border-2 border-${item.color}-500/50 flex items-center justify-center group-hover:bg-${item.color}-500 transition-colors cursor-pointer`}></div>
                              <div>
                                <p className="text-sm font-bold text-white">{item.task}</p>
                                <p className="text-xs text-slate-400">{item.desc}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-[10px] font-bold text-${item.color}-400 uppercase hidden sm:block`}>{item.impact}</span>
                              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded whitespace-nowrap">{item.time}</span>
                            </div>
                          </div>
                        ))}
                        {dynamicReport && dynamicReport.tasks.length === 0 && (
                          <p className="text-slate-400 text-sm">Fant ingen umiddelbare oppgaver. Godt jobbet!</p>
                        )}
                      </div>
                    </div>

                    {/* AI Prognose */}
                    <div className="flex flex-col gap-6">
                      <div className="bg-slate-900/50 border border-white/5 p-6 rounded-3xl flex-1 flex flex-col justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl"></div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><TrendingUp size={14} /> Potensial</h4>
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="text-4xl font-black text-white">Høyt</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Basert på antall feil vi fant ({contentPages.filter(p => p.status === 'Kritisk').length}), har du stort rom for forbedring ved enkle grep.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

              </>
            )}
          </div>
        )}


        {/* --- Liten popup nederst på skjermen --- */}
        {selectedPreviewProblem && !activeSolveProblem && (
          <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
            <div className={`p-4 pl-6 pr-4 rounded-2xl shadow-2xl flex items-center gap-6 border ${theme === 'light' ? 'bg-slate-900 text-white border-slate-800' : 'bg-white text-slate-900 border-white'}`}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Valgt problem</p>
                <p className="font-bold">{selectedPreviewProblem.title}</p>
              </div>
              <button
                onClick={() => {
                  const details = getProblemDetails(selectedPreviewProblem.title, selectedPreviewProblem.title);
                  setActiveSolveProblem({ raw: selectedPreviewProblem, details });
                  setSelectedPreviewProblem(null);
                  setActiveTab('verksted'); // Gå automatisk til verkstedet!
                }}
                className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 ${theme === 'light' ? 'bg-violet-500 hover:bg-violet-400 text-white' : 'bg-violet-600 hover:bg-violet-700 text-white'}`}
              >
                Gå til dybde <ArrowRight size={16} />
              </button>
              <button onClick={() => setSelectedPreviewProblem(null)} className="p-2 opacity-50 hover:opacity-100 rounded-full hover:bg-white/10"><X size={16} /></button>
            </div>
          </div>
        )}

        {/* --- VERKSTED SIDEN --- */}
        {activeTab === 'verksted' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 pb-32">
            {!activeSolveProblem ? (
              // TOM STAT (Hvis man ikke har valgt et problem enda)
              <div className="text-center p-20 mt-10 bg-slate-900/30 rounded-3xl border border-white/5 border-dashed">
                <Wrench className="w-16 h-16 text-slate-500 mx-auto mb-6 opacity-50" />
                <h2 className="text-2xl font-black text-white mb-3">Velkommen til Verkstedet</h2>
                <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
                  Gå til Analyse-fanen og trykk på et problem. AI-en vil da hente det inn hit og generere en skreddersydd løsning for deg.
                </p>
                <button onClick={() => setActiveTab('analysis')} className="mt-8 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold transition-colors">
                  Gå til Analyse for å finne feil
                </button>
              </div>
            ) : (
              // AKTIVT PROBLEM (Det nye designet med AI-motor)
              <div className="max-w-6xl mx-auto space-y-6 mt-6">

                {/* Header for problemet */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <button onClick={() => setActiveSolveProblem(null)} className="text-slate-400 hover:text-white flex items-center gap-1 text-sm font-medium transition-colors"><ArrowLeft size={16} /> Lukk oppgave</button>
                      <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest bg-rose-500/10 text-rose-400 border border-rose-500/20">Handling kreves</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-white">{activeSolveProblem.raw?.title || 'Laster problem...'}</h1>
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 mt-8">

                  {/* HOVEDKOLONNE (Arbeidsflaten) */}
                  <div className="flex-1 space-y-6">
                    {aiIsThinking ? (
                      // LASTE-ANIMASJON: Slik ser det ut mens OpenAI jobber i bakgrunnen
                      <div className="p-12 rounded-3xl border border-white/5 bg-slate-900/50 flex flex-col items-center justify-center text-center min-h-[400px] relative overflow-hidden shadow-2xl">
                        <div className="absolute inset-0 bg-violet-500/5 animate-pulse"></div>
                        <Loader2 className="w-12 h-12 text-violet-400 animate-spin mb-6 relative z-10" />
                        <h3 className="text-xl font-bold text-white mb-2 relative z-10">AI analyserer kildekoden...</h3>
                        <p className="text-slate-400 text-sm relative z-10">Skreddersyr en løsning for nøyaktig denne feilen på din nettside.</p>
                      </div>
                    ) : (
                      // FERDIG RESULTAT FRA AI
                      <div className="animate-in fade-in duration-500 space-y-6">




                        {/* VISUELT DATA-DASHBOARD (Ekte data fra Lighthouse) */}
                        {activeSolveProblem?.raw && (
                          <div className={`grid gap-4 mb-6 ${Number(activeSolveProblem.raw.numericValue) > 0 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>

                            {/* Graf 1: Potensiell tidsbesparelse (Vises KUN hvis den er større enn 0) */}
                            {Number(activeSolveProblem.raw.numericValue) > 0 && (
                              <div className="p-5 rounded-2xl bg-slate-900 border border-white/5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                  <Timer size={64} />
                                </div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Tidsbesparelse</h4>
                                <div className="flex items-baseline gap-2 mb-4">
                                  <span className="text-4xl font-black text-emerald-400">
                                    {(Number(activeSolveProblem.raw.numericValue) / 1000).toFixed(2)}
                                  </span>
                                  <span className="text-sm font-bold text-slate-400">sekunder</span>
                                </div>
                                <div className="w-full bg-slate-950 rounded-full h-2.5 shadow-inner">
                                  <div
                                    className="bg-emerald-400 h-2.5 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)] transition-all duration-1000"
                                    style={{ width: '75%' }}
                                  ></div>
                                </div>
                                <p className="text-xs text-slate-500 mt-3 font-medium">Beregnet hastighetsøkning ved fiks</p>
                              </div>
                            )}

                            {/* Graf 2: Belastning / Wasted Bytes (Vises alltid hvis det finnes data) */}
                            {((activeSolveProblem.raw.raw?.savings || activeSolveProblem.raw.savings || "").replace(/\D/g, '') || "0") !== "0" && (
                              <div className="p-5 rounded-2xl bg-slate-900 border border-white/5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                  <Activity size={64} />
                                </div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Unødvendig Data</h4>
                                <div className="flex items-baseline gap-2 mb-4">
                                  <span className="text-4xl font-black text-rose-400">
                                    {(activeSolveProblem.raw.raw?.savings || activeSolveProblem.raw.savings || "").replace(/\D/g, '')}
                                  </span>
                                  <span className="text-sm font-bold text-slate-400">KB</span>
                                </div>
                                <div className="w-full flex gap-1 h-2.5">
                                  <div
                                    className="bg-rose-500 h-full rounded-l-full shadow-[0_0_10px_rgba(244,63,94,0.5)] transition-all duration-1000"
                                    style={{ width: '66%' }}
                                  ></div>
                                  <div className="bg-rose-400 h-full w-1/6"></div>
                                  <div className="bg-slate-800 h-full rounded-r-full flex-1"></div>
                                </div>
                                <p className="text-xs text-slate-500 mt-3 font-medium">Data som blokkerer hovedtråden</p>
                              </div>
                            )}
                          </div>
                        )}



                        {/* 1. Steg-for-steg AI-løsning */}
                        <div className="p-8 rounded-3xl border border-white/5 bg-slate-900/50 shadow-lg">
                          <h3 className="text-sm font-bold text-violet-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                            <Sparkles size={16} /> Slik fikser du problemet
                          </h3>

                          {/* 2. KODE-BOKS (Vises KUN hvis AI-en har en spesifikk kodeendring å foreslå) */}
                          {aiSolution?.codePatch && (
                            <div className="p-8 rounded-3xl border border-white/5 bg-slate-900/50 shadow-lg mt-6">
                              <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                  <Code2 size={16} /> Foreslått Kodeendring
                                </h3>
                                <button
                                  onClick={() => navigator.clipboard.writeText(typeof aiSolution.codePatch === 'string' ? aiSolution.codePatch : JSON.stringify(aiSolution.codePatch))}
                                  className="text-slate-400 hover:bg-white/5 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-all active:scale-95"
                                >
                                  <Copy size={14} /> Kopier
                                </button>
                              </div>

                              {/* Selve terminal-vinduet */}
                              <div className="bg-[#0D1117] p-5 rounded-xl border border-white/10 font-mono text-sm text-slate-300 overflow-x-auto relative shadow-inner">
                                {/* Rød/Gul/Grønn Mac-knapper for estetikk */}
                                <div className="flex gap-1.5 mb-4 opacity-50">
                                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                                </div>
                                <pre className="text-emerald-400 whitespace-pre-wrap">
                                  <code>{typeof aiSolution.codePatch === 'string' ? aiSolution.codePatch : JSON.stringify(aiSolution.codePatch, null, 2)}</code>
                                </pre>
                              </div>
                              <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                                Erstatt din nåværende kode med blokken over. Husk å teste siden din etter endringen.
                              </p>
                            </div>
                          )}

                          {/* SIKKERHETSSJEKK: Vi verifiserer at det er en ekte liste før vi looper */}
                          {Array.isArray(aiSolution?.steps) ? (
                            <div className="space-y-2 relative">
                              {aiSolution.steps.map((step: any, index: number) => (
                                <div key={index} className="flex gap-4 relative">

                                  {/* Timeline-strek */}
                                  {index !== aiSolution.steps.length - 1 && (
                                    <div className="absolute left-4 top-10 bottom-[-16px] w-0.5 bg-white/5"></div>
                                  )}

                                  {/* Sirkel med tall */}
                                  <div className="relative z-10 flex-shrink-0 w-8 h-8 rounded-full bg-violet-600/20 text-violet-400 flex items-center justify-center font-bold text-sm border-2 border-slate-900 shadow-sm">
                                    {index + 1}
                                  </div>

                                  {/* Innholdet i steget */}
                                  <div className="pt-1 pb-6">
                                    <h4 className="font-bold text-slate-200 text-base">
                                      {step.title || "Steg"}
                                    </h4>
                                    <p className="text-slate-400 mt-1 text-sm leading-relaxed">
                                      {step.description || step}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            /* FALLBACK: Hvis AI roter til formatet, unngår vi krasj og viser dataene som ren tekst */
                            <div className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                              {aiSolution?.steps || aiSolution?.explanation || "Kunne ikke laste løsningen på riktig format. Prøv å kjøre analysen på nytt."}
                            </div>
                          )}
                        </div>

                        {/* 2. Eventuell Kode-boks (Vises KUN hvis AI returnerer kode) */}
                        {aiSolution?.codePatch && (
                          <div className="p-8 rounded-3xl border border-white/5 bg-slate-900/50 shadow-lg">
                            <div className="flex justify-between items-center mb-4">
                              <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                <Code2 size={16} /> Foreslått Kodeendring
                              </h3>
                              <button
                                onClick={() => navigator.clipboard.writeText(aiSolution.codePatch)}
                                className="text-slate-400 hover:text-white flex items-center gap-1 text-xs font-bold transition-colors"
                              >
                                <Copy size={14} /> Kopier kode
                              </button>
                            </div>
                            <div className="bg-slate-950 p-5 rounded-xl border border-white/5 font-mono text-sm text-slate-300 overflow-x-auto">
                              <pre className="text-emerald-400">
                                <code>{typeof aiSolution.codePatch === 'string' ? aiSolution.codePatch : JSON.stringify(aiSolution.codePatch, null, 2)}</code>
                              </pre>
                            </div>
                          </div>
                        )}

                      </div>
                    )}
                  </div>

                  {/* SIDEKOLONNE (Verktøy og Premium) */}
                  <div className="w-full lg:w-80 space-y-6">

                    {/* Verifiserings-knapp */}
                    <div className="p-6 rounded-3xl border border-white/5 bg-slate-900/50 shadow-lg">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Verifisering</h3>
                      <button className="w-full py-4 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold hover:bg-emerald-500/20 transition-all flex justify-center items-center gap-2 active:scale-95">
                        <CheckCircle2 size={18} /> Kjør ny test
                      </button>
                      <p className="text-xs text-slate-500 text-center mt-4 leading-relaxed">
                        Trykk her når du har lagt inn koden for å la Sikt bekrefte at problemet faktisk er løst.
                      </p>
                    </div>

                    {/* Premium Upsell */}
                    <div className="p-6 rounded-3xl border border-white/5 bg-slate-900/50 opacity-60 grayscale cursor-not-allowed">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">1-Klikks Fix <Lock size={14} /></h3>
                        <span className="text-[10px] uppercase font-bold bg-white text-black px-1.5 py-0.5 rounded">Premium</span>
                      </div>
                      <p className="text-xs text-slate-400 mb-6 leading-relaxed">La AI pushe koden direkte til din server. Spar tid og unngå feil.</p>
                      <button disabled className="w-full py-3 rounded-xl bg-slate-800 text-slate-500 text-sm font-bold border border-white/5">Oppgrader</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- INNSTILLINGER (OPPDATERT) --- */}
        {activeTab === 'settings' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 pb-40">
            <header className="mb-8">
              <h1 className={`text-4xl font-black tracking-tight ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Innstillinger</h1>
              <p className="text-slate-400 mt-2 text-lg font-light">
                Administrer bedriftsprofil, utseende og abonnement.
              </p>
            </header>

            <PortalSettings
              user={user}
              clientData={clientData}
              selectedPlan={selectedPlan}
              onNavigate={setView}
              onSave={handleSaveSettings}
              theme={theme}
              setTheme={setTheme}
              onSelectPlan={onSelectPlan} // <-- LEGG TIL DENNE LINJEN
            />
          </div>

        )}
      </main>
    </div>
  );
};


const PortalSettings = ({ user, clientData, selectedPlan, onNavigate, onSave, theme, setTheme, onSelectPlan }: any) => {
  const [activeTab, setActiveTab] = useState('general');
  const [showPlans, setShowPlans] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);





  // --- VERKSTED HUKOMMELSE ---
  const [activeSolveProblem, setActiveSolveProblem] = useState<any>(null);
  const [problemHistory, setProblemHistory] = useState<any[]>([]);
  const [pendingProblems, setPendingProblems] = useState<any[]>([]);
  const [selectedPreviewProblem, setSelectedPreviewProblem] = useState<any>(null);
  const [aiIsThinking, setAiIsThinking] = useState(false);
  const [aiHasSolved, setAiHasSolved] = useState(false);


  const seoDictionary: Record<string, any> = {
    'meta-description': {
      title: 'Mangler Meta-beskrivelse',
      what: 'Siden din mangler den lille teksten som vises under den blå lenken på Google.',
      why: 'Uten denne teksten lar du Google gjette hva siden handler om. En god tekst her fungerer som en reklameplakat som får folk til å klikke.',
      steps: ['Logg inn på nettsiden din sin redigeringsmodus.', 'Finn SEO-innstillingene for den spesifikke siden.', 'Skriv en selgende tekst på 150 tegn som forteller nøyaktig hva kunden får her.'],
      aiPrompt: 'rewrite'
    },
    'unused-javascript': {
      title: 'Fjern ubrukt kode (JavaScript)',
      what: 'Nettleseren må laste ned og lese kode som egentlig ikke brukes på denne siden.',
      why: 'Dette gjør at nettsiden din laster tregere på mobil. Trege sider mister kunder og straffes av Google.',
      steps: ['Finn ut hvilke plugins/utvidelser du ikke bruker, og slett dem.', 'Bruk et optimaliseringsverktøy for å "forsinke" kode.', 'Test siden på nytt for å se at den laster raskere.'],
      aiPrompt: 'code'
    },
    'default': {
      title: 'Teknisk feil funnet',
      what: 'Vi har funnet et teknisk hinder som gjør at Google ikke forstår siden din optimalt.',
      why: 'Ved å fikse dette, sender du et sterkt signal til søkemotorene om at siden din er profesjonell og rask.',
      steps: ['Gjennomgå ressursene som er flagget i analysen.', 'Oppdater innstillingene i ditt publiseringssystem.', 'Trykk på "Ny test" for å bekrefte at det er løst.'],
      aiPrompt: 'optimize'
    }
  };

  const getProblemDetails = (problemId: string, rawTitle: string) => {
    const match = Object.keys(seoDictionary).find(key => problemId.toLowerCase().includes(key) || rawTitle.toLowerCase().includes(key));
    return match ? seoDictionary[match] : { ...seoDictionary['default'], title: rawTitle };
  };


  // SIKRING: Man må trykke "Rediger" for å endre noe

  const [formData, setFormData] = useState({
    companyName: clientData?.companyName || 'Min Bedrift AS',
    websiteUrl: clientData?.websiteUrl || 'https://eksempel.no',
    email: clientData?.email || user?.email || '',
    industry: clientData?.industry || '',
    targetAudience: clientData?.targetAudience || ''
  });

  const [notifications, setNotifications] = useState({
    weeklyReport: true,
    criticalAlerts: true,
    rankChanges: false
  });

  // ABONNEMENT LOGIKK
  const plans: Record<string, { name: string, price: string, desc: string }> = {
    'BASIC': { name: 'Basic', price: '599 kr', desc: 'Få kontroll på grunnmuren.' },
    'STANDARD': { name: 'Standard', price: '1 499 kr', desc: 'Vekst og innholdsdominans.' },
    'PREMIUM': { name: 'Premium', price: '4 999 kr', desc: 'Total dominans.' }
  };

  // Sjekker databasen (clientData) og finner riktig pakke uansett hvordan det er skrevet
  const getActivePlanKey = () => {
    const dbPlan = clientData?.package_name?.toUpperCase() || '';
    if (dbPlan.includes('PREMIUM')) return 'PREMIUM';
    if (dbPlan.includes('STANDARD')) return 'STANDARD';
    return 'BASIC';
  };

  const currentPlan = plans[getActivePlanKey()];

  <button
    onClick={() => onNavigate('home')}
    className="bg-indigo-800/50 text-white border border-white/10 px-5 py-2.5 rounded-lg text-xs font-bold hover:bg-indigo-800 transition-colors flex items-center gap-2"
  >
    Endre Plan <ArrowRight size={14} />
  </button>

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setIsEditing(false); // Lås skjemaet igjen etter lagring
      onSave(formData);
      // Her bør du legge til en Toast notification
    }, 800);
  };

  const toggleNotif = (key: string) => setNotifications(prev => ({ ...prev, [key as keyof typeof notifications]: !prev[key as keyof typeof notifications] }));

  // Hjelpekomponenter
  const SectionHeader = ({ title, desc }: { title: string, desc: string }) => (
    <div className={`mb-8 pb-6 border-b ${theme === 'light' ? 'border-slate-200' : 'border-white/5'}`}>
      <h2 className={`text-xl font-medium tracking-tight ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{title}</h2>
      <p className="text-sm text-slate-400 mt-1">{desc}</p>
    </div>
  );

  const InputField = ({ label, value, onChange, disabled = false, icon: Icon, placeholder = '', forceLock = false }: any) => (
    <div className="group">
      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 group-focus-within:text-violet-400 transition-colors">
        {label}
      </label>
      <div className={`flex items-center border transition-all duration-200 rounded-xl px-4 py-3 
        ${theme === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-950 border-white/10 text-white'}
        ${(disabled || forceLock) ? 'opacity-60 bg-slate-100 dark:bg-slate-900/50 cursor-not-allowed' : 'group-focus-within:border-violet-500/50 group-focus-within:ring-1 group-focus-within:ring-violet-500/20 shadow-sm'}
      `}>
        {Icon && <Icon size={16} className={`mr-3 ${disabled ? 'text-slate-500' : 'text-slate-400 group-focus-within:text-violet-400'}`} />}
        <input
          value={value}
          onChange={onChange}
          disabled={disabled || forceLock}
          placeholder={placeholder}
          className={`bg-transparent w-full text-sm outline-none font-medium ${theme === 'light' ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-slate-600'}`}
        />
        {forceLock && <Lock size={12} className="ml-2 text-rose-500" title="Dette feltet kan ikke endres" />}
        {!forceLock && disabled && <Lock size={12} className="ml-2 text-slate-500" />}
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col lg:flex-row min-h-[600px] rounded-3xl border overflow-hidden backdrop-blur-sm transition-colors duration-300
      ${theme === 'light' ? 'bg-white/80 border-slate-200 shadow-xl' : 'bg-slate-900/40 border-white/5'}
    `}>

      {/* 1. SIDEBAR */}
      <div className={`w-full lg:w-64 border-r p-4 flex flex-col gap-1 shrink-0 ${theme === 'light' ? 'bg-slate-50/50 border-slate-200' : 'bg-slate-950/30 border-white/5'}`}>
        <div className="px-4 py-4 mb-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Konto</p>
        </div>
        {[
          { id: 'general', label: 'Generelt', icon: User },
          { id: 'notifications', label: 'Varslinger', icon: MessageCircle },
          { id: 'appearance', label: 'Utseende', icon: Sun },
          { id: 'billing', label: 'Abonnement', icon: CreditCard },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 text-left ${activeTab === item.id
              ? 'bg-violet-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-600 hover:bg-black/5 dark:hover:text-white dark:hover:bg-white/5'
              }`}
          >
            <item.icon size={16} className={activeTab === item.id ? 'text-white' : 'opacity-70'} />
            {item.label}
          </button>
        ))}
      </div>

      {/* 2. MAIN CONTENT */}
      <div className="flex-1 p-8 lg:p-12 overflow-y-auto custom-scrollbar">

        {/* --- TAB: GENERELT (MED SIKRING) --- */}
        {activeTab === 'general' && (
          <div className="max-w-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-start mb-6">
              <SectionHeader title="Bedriftsprofil" desc="Administrer din bedriftsinformasjon." />

              {/* SIKRINGS-KNAPP */}
              {!isEditing ? (
                <button onClick={() => setIsEditing(true)} className="text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-slate-200 dark:bg-white/10 dark:text-white dark:border-white/10 dark:hover:bg-white/20">
                  Rediger Profil
                </button>
              ) : (
                <button onClick={() => setIsEditing(false)} className="text-xs font-bold text-rose-500 hover:text-rose-600 px-3 py-1.5 transition-colors">
                  Avbryt
                </button>
              )}
            </div>

            <div className="space-y-6">
              {/* URL ER ALLTID LÅST (forceLock=true) */}
              <InputField
                label="Nettside URL"
                value={formData.websiteUrl}
                disabled={true}
                forceLock={true}
                icon={Globe}
              />

              <InputField
                label="E-post adresse"
                value={formData.email}
                onChange={(e: any) => setFormData({ ...formData, email: e.target.value })}
                disabled={!isEditing}
                icon={Mail}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <InputField
                  label="Bedriftsnavn"
                  value={formData.companyName}
                  onChange={(e: any) => setFormData({ ...formData, companyName: e.target.value })}
                  disabled={!isEditing}
                />
                <InputField
                  label="Bransje"
                  value={formData.industry}
                  onChange={(e: any) => setFormData({ ...formData, industry: e.target.value })}
                  placeholder="F.eks. Rørlegger"
                  disabled={!isEditing}
                />
              </div>

              <div className="group">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Målgruppe</label>
                <textarea
                  value={formData.targetAudience}
                  onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                  placeholder="Beskriv hvem du vil nå..."
                  disabled={!isEditing}
                  className={`w-full h-24 rounded-xl px-4 py-3 text-sm font-medium outline-none border transition-all resize-none
                    ${theme === 'light'
                      ? 'bg-white border-slate-200 text-slate-900 focus:border-violet-500'
                      : 'bg-slate-950 border-white/10 text-white placeholder-slate-600 focus:border-violet-500/50'
                    }
                    ${!isEditing ? 'opacity-60 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50' : ''}
                  `}
                />
              </div>
            </div>

            {/* LAGRE KNAPP - KUN SYNLIG NÅR REDIGERER */}
            {isEditing && (
              <div className="mt-8 flex justify-end animate-in fade-in slide-in-from-bottom-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-slate-900 text-white hover:bg-violet-600 dark:bg-white dark:text-slate-950 dark:hover:bg-violet-50 px-8 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <><Save size={14} /> Lagre Endringer</>}
                </button>
              </div>
            )}
          </div>
        )}

        {/* --- TAB: UTSEENDE (FUNKSJONELL!) --- */}
        {activeTab === 'appearance' && (
          <div className="max-w-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SectionHeader title="Utseende" desc="Velg din foretrukne visning." />

            <div className="grid grid-cols-2 gap-6">
              {/* Light Mode Button */}
              <button
                onClick={() => setTheme('light')}
                className={`p-4 rounded-2xl border-2 transition-all text-left group ${theme === 'light' ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-500/20' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
              >
                <div className="w-full h-24 bg-slate-100 rounded-lg mb-4 border border-slate-200 relative overflow-hidden">
                  <div className="absolute top-2 left-2 w-16 h-4 bg-white rounded shadow-sm"></div>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`font-bold text-sm ${theme === 'light' ? 'text-violet-700' : 'text-slate-700'}`}>Lys Modus</span>
                  {theme === 'light' && <Check size={16} className="text-violet-600" />}
                </div>
              </button>

              {/* Dark Mode Button */}
              <button
                onClick={() => setTheme('dark')}
                className={`p-4 rounded-2xl border-2 transition-all text-left group ${theme === 'dark' ? 'border-violet-500 bg-slate-800 ring-2 ring-violet-500/20' : 'border-slate-700 hover:border-slate-600 bg-slate-900'}`}
              >
                <div className="w-full h-24 bg-slate-950 rounded-lg mb-4 border border-slate-800 relative overflow-hidden">
                  <div className="absolute top-2 left-2 w-16 h-4 bg-slate-800 rounded"></div>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`font-bold text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-400'}`}>Mørk Modus</span>
                  {theme === 'dark' && <Check size={16} className="text-white" />}
                </div>
              </button>
            </div>
          </div>
        )}

        {/* --- TAB: VARSLINGER --- */}
        {activeTab === 'notifications' && (
          <div className="max-w-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SectionHeader title="Varslingspreferanser" desc="Bestem hva du vil motta på e-post." />
            <div className={`space-y-1 rounded-2xl border overflow-hidden ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/30 border-white/5'}`}>
              {[
                { id: 'weeklyReport', label: 'Ukentlig Rapport', desc: 'Sammendrag av vekst og nye muligheter.' },
                { id: 'criticalAlerts', label: 'Kritiske Alarmer', desc: 'Umiddelbar beskjed hvis nettsiden går ned.' },
                { id: 'rankChanges', label: 'Posisjonsendringer', desc: 'Når du går opp eller ned på topp 3.' },
              ].map((item, i) => (
                <div key={item.id} className={`flex items-center justify-between p-5 ${i !== 0 ? (theme === 'light' ? 'border-t border-slate-200' : 'border-t border-white/5') : ''}`}>
                  <div className="pr-8">
                    <p className={`text-sm font-bold mb-0.5 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{item.label}</p>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => toggleNotif(item.id)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${notifications[item.id as keyof typeof notifications] ? 'bg-violet-600' : 'bg-slate-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ${notifications[item.id as keyof typeof notifications] ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- TAB: ABONNEMENT --- */}
        {activeTab === 'billing' && (
          <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SectionHeader title="Ditt Abonnement" desc="Administrer din plan og betalingsmetoder." />

            {!showPlans ? (
              <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-2xl shadow-violet-900/50 mb-8">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -mr-20 -mt-20"></div>

                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-8">
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1 rounded-full">
                      <span className="text-[10px] font-bold text-white uppercase tracking-widest">Aktiv Plan</span>
                    </div>
                    <span className="text-2xl font-bold text-white">{currentPlan.price}<span className="text-sm text-white/60 font-medium">/mnd</span></span>
                  </div>

                  <h3 className="text-4xl font-black text-white mb-2">{currentPlan.name}</h3>
                  <p className="text-indigo-100 text-sm mb-8 max-w-xs">{currentPlan.desc}</p>

                  <div className="flex gap-4">
                    <button className="bg-white text-indigo-900 px-5 py-2.5 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-colors shadow-lg">
                      Administrer i Stripe
                    </button>
                    {/* KNAPP SOM VISER PAKKE-LISTEN INNE I PORTALEN */}
                    <button
                      onClick={() => setShowPlans(true)}
                      className="bg-indigo-800/50 text-white border border-white/10 px-5 py-2.5 rounded-lg text-xs font-bold hover:bg-indigo-800 transition-colors flex items-center gap-2"
                    >
                      Endre Plan <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-8 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className={`font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Velg ny plan</h3>
                  <button onClick={() => setShowPlans(false)} className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1">
                    <ArrowLeft size={12} /> Tilbake
                  </button>
                </div>

                <div className="space-y-4">
                  {Object.entries(plans).map(([key, plan]) => {
                    const isCurrent = getActivePlanKey() === key;
                    const isUpgrade = (key === 'STANDARD' && getActivePlanKey() === 'BASIC') || (key === 'PREMIUM' && getActivePlanKey() !== 'PREMIUM');

                    return (
                      <div key={key} className={`p-5 rounded-2xl border flex items-center justify-between transition-all ${isCurrent ? 'bg-violet-50 border-violet-200 dark:bg-violet-900/20 dark:border-violet-500/30' : theme === 'light' ? 'bg-white border-slate-200 hover:border-violet-300' : 'bg-slate-900/50 border-white/10 hover:border-white/20'}`}>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className={`font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{plan.name}</h4>
                            {isCurrent && <span className="bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">Aktiv</span>}
                          </div>
                          <p className="text-xs text-slate-500">{plan.desc}</p>
                          <p className={`text-sm font-black mt-2 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{plan.price}/mnd</p>
                        </div>

                        {!isCurrent && (
                          <button
                            onClick={() => onSelectPlan(plan.name)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${isUpgrade ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                          >
                            {isUpgrade ? <><ArrowUpCircle size={14} /> Oppgrader</> : <><ArrowDownCircle size={14} /> Nedgrader</>}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Fakturahistorikk</h4>
              <div className={`border rounded-xl p-8 text-center ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/30 border-white/5'}`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${theme === 'light' ? 'bg-white text-slate-400' : 'bg-slate-900 text-slate-600'}`}>
                  <FileText size={20} />
                </div>
                <p className="text-sm text-slate-400">Ingen fakturaer tilgjengelig.</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---
function App() {
  // 1. SJEKK URL FØR VI STARTER
  const isPaymentSuccess = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('payment_success') === 'true';

  // 2. VASK URL-EN: Fjerner parameteret umiddelbart for å unngå spøkelser
  useEffect(() => {
    if (isPaymentSuccess && typeof window !== 'undefined') {
      const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: newUrl }, '', newUrl);
      console.log("URL vasket: Betalings-parameter fjernet.");
    }
  }, [isPaymentSuccess]);

  // --- TEMA STATE ---
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  // --- VISNING & KAMERA (Holder styr på hvor kunden er) ---
  const [view, setView] = useState(isPaymentSuccess ? 'onboarding' : 'home');
  const viewRef = useRef(view);

  useEffect(() => {
    viewRef.current = view;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('sikt_current_view', view);
    }
  }, [view]);

  // --- STANDARD VARIABLER ---
  const isInitialAuthCheck = useRef(true);
  const isFirstLoad = useRef(true);
  const [customerFiles, setCustomerFiles] = useState([]);
  const [user, setUser] = useState<any>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  // Denne funksjonen bruker vi når vi VET at kunden skal inn
  const enterPortalWithDelay = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 2800));
    setHasAccess(true);
    setIsLoading(false);
  };

  // --- EFFEKTER ---
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  // --- DEN ENESTE OG ENDELIGE HOVEDSJEKKEN ---
  useEffect(() => {
    let isMounted = true;
    let hasInitialized = false;

    const handleUserRouting = async (user: any, isExplicitAction: boolean) => {
      if (!user || !isMounted) return;

      // --- 1. SYNKRONISER PAKKEVALG (Fikset kappløp) ---
      const savedPlan = localStorage.getItem('sikt_pending_plan');

      if (savedPlan) {
        // NAPP LAPPEN UMIDDELBART! Dette forhindrer at Supabase dobbelt-fyrer.
        localStorage.removeItem('sikt_pending_plan');
        console.log("Lapp fjernet fra minnet, synkroniserer til Supabase:", savedPlan);

        const { error: updateError } = await supabase
          .from('clients')
          .update({ plan: savedPlan })
          .eq('user_id', user.id);

        if (!updateError) {
          setSelectedPlan(savedPlan);
          console.log("Pakkevalg lagret i databasen!");
        } else {
          // Hvis det faktisk feiler av en annen grunn, limer vi lappen tilbake
          localStorage.setItem('sikt_pending_plan', savedPlan);
          console.error("Kunne ikke lagre pakke i DB:", updateError.message);
        }
      }

      // --- 2. PANSERLÅS ---
      // (Resten av funksjonen din fortsetter nøyaktig som før herfra...)
      const currentView = sessionStorage.getItem('sikt_current_view');
      if (currentView === 'onboarding' || currentView === 'setup' || currentView === 'setup_guide') {
        setIsLoading(false);
        return;
      }

      // --- 3. SJEKK ONBOARDING STATUS ---
      const { data: client } = await supabase
        .from('clients')
        .select('onboarding_completed')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (client?.onboarding_completed) {
        // FERDIG KUNDE:
        if (isExplicitAction) {
          setView('dashboard');
          if (typeof enterPortalWithDelay === 'function') enterPortalWithDelay();
        } else {
          setView('home');
          setIsLoading(false);
        }
      } else {
        // UFERDIG KUNDE:
        setView('home');
        setIsLoading(false);

        // Skroll skjer kun ved aktiv innlogging
        if (isExplicitAction) {
          setTimeout(() => {
            const el = document.getElementById('priser') || document.getElementById('pricing') || document.getElementById('pakker');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 500);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (event === 'TOKEN_REFRESHED') return;

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setView('home');
        setIsLoading(false);
        hasInitialized = true; // Etter utlogging vil neste innlogging være "Explicit"
      }
      else if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        setUser(session.user);

        // Hvis eventet er SIGNED_IN og hasInitialized er true, er det et aktivt valg
        const isExplicit = (event === 'SIGNED_IN' && hasInitialized);

        await handleUserRouting(session.user, isExplicit);
        hasInitialized = true;
      } else {
        setIsLoading(false);
        hasInitialized = true;
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
    try {
      console.log("1. Knapp trykket for pakke:", plan);

      if (typeof window !== 'undefined') {
        localStorage.setItem('sikt_pending_plan', plan);
        console.log("2. Plan midlertidig lagret i husk:", plan);
      }

      setSelectedPlan(plan);
      console.log("3. Sjekker om bruker er logget inn...");

      const { data, error } = await supabase.auth.getUser();

      if (error) {
        console.log("4a. Feil ved sjekk av bruker:", error.message);
      }

      if (!data?.user) {
        console.log("4b. INGEN bruker logget inn. Tvinger skjerm til toppen og bytter til 'login'.");
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Tvinger skjermen til toppen
        setView('login'); // SJEKK HER: Heter innloggingen din 'login', eller noe annet?
        return;
      }

      console.log("4c. Bruker ER logget inn:", data.user.email);
      console.log("5. Finner riktig Stripe-lenke...");

      let stripeBaseUrl = "";
      if (plan.includes('PREMIUM')) stripeBaseUrl = 'https://buy.stripe.com/test_cNiaEX7LM84m6gvaHScbC00';
      else if (plan.includes('STANDARD')) stripeBaseUrl = 'https://buy.stripe.com/test_8x2bJ17LM4Sa7kz4jucbC01';
      else if (plan.includes('BASIC')) stripeBaseUrl = 'https://buy.stripe.com/test_14A6oHeaadoGdIX8zKcbC02';

      if (!stripeBaseUrl) {
        alert("Fant ingen betalingslenke for denne pakken.");
        return;
      }

      console.log("6. Sender til Stripe nå...");
      const checkoutUrl = `${stripeBaseUrl}?prefilled_email=${encodeURIComponent(data.user.email || '')}`;
      window.location.href = checkoutUrl;

    } catch (err: any) {
      console.error("KRITISK FEIL i handlePlanSelect:", err.message);
      alert("Feil: " + err.message);
    }
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
  // Hvis brukeren er logget inn OG har fullført oppsettet (hasAccess),
  // sendes de rett til ClientPortal.
  if (user && hasAccess) {
    return (
      <ClientPortal
        user={user}
        onLogout={handleLogout}
        theme={theme}
        setTheme={setTheme}
        setView={setView}
        selectedPlan={selectedPlan}
        onSelectPlan={handlePlanSelect}
      />
    );
  }

  // ---------------------------------------------------------
  // 🚪 DØRVAKT 2: PROSESS (Registrering & Integrasjon)
  // ---------------------------------------------------------

  // 1. Skjemaet etter betaling
  if (view === 'onboarding') {
    return <OnboardingPage user={user} onComplete={() => setView('setup')} />;
  }

  // 2. Kildekode-integrasjon (Den nye siden din)
  if (view === 'setup' || view === 'setup_guide') {
    return (
      <CodeIntegrationStep
        onNext={(files) => {
          setCustomerFiles(files); // Vi lagrer koden i minnet!
          setView('success');
        }}
        onSkip={() => setView('success')}
      />
    );
  }

  // 3. Suksess-side før de går inn i portalen
  if (view === 'success') {
    return (
      <SuccessPage
        onBackHome={() => {
          // Når de trykker "Gå videre" her, låser vi opp portalen
          setHasAccess(true);
          setView('deepdive');
        }}
      />
    );
  }

  // ---------------------------------------------------------
  // 🏠 HOVEDHUSET (For nye besøkende / ikke-kunder)
  // ---------------------------------------------------------
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

        {/* DeepDive vises hvis kunden er i portal-modus */}
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