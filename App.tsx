import { CodeIntegrationStep } from './CodeIntegrationStep';
import { DashboardHome } from './DashboardHome';
// (Endre './CodeIntegrationStep' til './components/CodeIntegrationStep' hvis du la filen i en components-mappe)
import { DetailedHealthCheck } from './src/components/DetailedHealthCheck';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { toastInfo, toastSuccess, toastError, toastWarning } from './src/toast';
import { supabaseRest, getStoredAccessToken } from './src/supabaseRest';
import {
  ArrowRight, Timer, ArrowDown, Eye, Trophy, Sun, BarChart2, Map as MapIcon, Users, Key, Check, Search, Zap, Target, ChevronDown, Menu, X, Sparkles, CalendarClock,
  MousePointer2, TrendingUp, Cpu, Globe, Activity, ArrowUpRight, User, MonitorCheck, Code2, PenTool,
  SearchIcon, TrendingDown, ImageIcon, ShoppingBag, Clock, AlertTriangle, MessageCircle, HelpCircle, LayoutDashboard, FileText, Link2,
  Home, Linkedin, Twitter, Mail, ShieldCheck, Wrench, Globe2, Stars, Frown, Radar, FileBarChart, AlertOctagon,
  Layers, Minus, BarChart3, GitMerge, Rocket, Shield, Lightbulb, Monitor, HeartHandshake, Lock, ChevronRight,
  BrainCircuit, Moon, BarChart4, CalendarDays, Award, Unlink, SearchCheck, Database, Server, LogOut, Coffee, Save, XCircle, AlertCircle, Edit2, ChevronsUpDown,
  Settings, Smartphone, ChevronLeft, ArrowUp, ArrowUpCircle, ArrowDownCircle, ShieldAlert, CreditCard, FileEdit, RefreshCw, LifeBuoy, Loader2, Trash2, Briefcase, Download, CheckCircle2, ArrowLeft, CheckCircle, Copy, ExternalLink, Circle,
  ClipboardCheck, Bell, Sparkle, Bot, Microscope, Send, Plus, Info
} from 'lucide-react';

import {
  DashboardCompetitorWidget,
  CompetitorChangeFeed,
  CompetitorCardEnhanced,
  useCompetitorChanges,
  useCompetitorPages,
} from './CompetitorMonitor';


// --- GLOBALE KONSTANTER ---
// Hvor lenge "Control Center"-loading-skjermen vises før vi slipper
// brukeren inn i ClientPortal. Juster her ett sted for hele appen.
const PORTAL_ENTRY_DELAY_MS = 2800;



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
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, BarChart, Bar, RadialBarChart, RadialBar, Cell } from 'recharts';

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


// --- GLOBAL SMART LOGIN FUNKSJON (Oppdatert) ---
export const handleLogin = async () => {
  if (!supabase) {
    toastError("Supabase mangler oppsett i supabaseClient.ts");
    return;
  }

  try {
    // 1. SJEKK OM BRUKER ALLEREDE ER INNE
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      // Hvis bruker allerede er logget inn i appen, send dem til dashboard/priser
      const pricingSection = document.getElementById('priser');
      if (pricingSection) {
        pricingSection.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    // 2. START GOOGLE LOGIN (Med tvungen kontovalg)
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
      toastError("Feil ved innlogging: " + error.message);
    }
  } catch (error: any) {
    toastError("Feil ved innlogging: " + (error?.message || 'ukjent feil'));
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
      className="group relative ui-motion ui-lift inline-flex items-center gap-3 px-8 py-4 bg-slate-950 text-white rounded-full font-bold text-lg shadow-xl [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-600 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-2xl [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-violet-500/20"
    >
      <span>Ta meg til toppen av Google</span>
      {/* Vi bruker ikonet du allerede har importert */}
      <ArrowRight className="w-5 h-5 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1" />

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
          Under panseret: AI. <br className="hidden md:block" />
          <span className="text-violet-600">For deg: plain norsk.</span>
        </h1>
        <p className="text-base sm:text-lg md:text-2xl text-slate-600 font-medium leading-relaxed max-w-3xl mx-auto mb-12 md:mb-16">
          Vi overvåker siden din døgnet rundt, leser Google-dataene dine, og bruker AI til å finne ting du burde gjøre. Du får én rapport i måneden som forteller deg hva som skjer — uten forkortelser eller engelske ord.
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
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-100 rounded-xl sm:rounded-2xl flex items-center justify-center mb-6 [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-violet-600 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-white transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]">
              <Wrench size={24} />
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-950 mb-4">Vi passer på siden din</h3>
            <p className="text-sm sm:text-base text-slate-500 font-medium leading-relaxed mb-6">
              Hastighet, ødelagte lenker, feilmeldinger og brukeropplevelse — vi sjekker alt sammen hvert døgn. Hvis noe hindrer Google i å vise siden din, får vi beskjed med en gang og fikser det.
            </p>
            <div className="mt-auto flex flex-wrap gap-2">
              <span className="px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-full text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Basic</span>
              <span className="px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-full text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Standard</span>
            </div>
          </div>
        </RevealOnScroll>

        <RevealOnScroll direction="right">
          <div className="premium-card p-8 sm:p-10 rounded-[32px] sm:rounded-[40px] h-full flex flex-col group backdrop-blur-xl">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-100 rounded-xl sm:rounded-2xl flex items-center justify-center mb-6 [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-violet-600 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-white transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]">
              <Globe2 size={24} />
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-950 mb-4">Ekte tall rett fra Google</h3>
            <p className="text-sm sm:text-base text-slate-500 font-medium leading-relaxed mb-6">
              Ingen gjetninger. Vi henter data direkte fra Google: hva folk faktisk søker etter før de finner deg, hvilke sider de klikker på, og hvor mange som går videre til kjøp.
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
              <h3 className="text-2xl sm:text-3xl md:text-5xl font-black text-slate-950 mb-4 sm:mb-6 tracking-tight">AI som skriver for deg</h3>
              <p className="text-sm sm:text-lg md:text-xl text-slate-600 font-medium leading-relaxed mb-8 sm:mb-10">
                AI-en vår skriver overskriftene og tekstene som vises når folk finner deg på Google — skreddersydd slik at de får lyst til å klikke. Du slipper å bry deg. Det bare blir gjort.
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
              <h3 className="text-2xl sm:text-3xl md:text-5xl font-black mb-4 sm:mb-6 leading-tight">Vi dekoder <br className="hidden sm:block" /> konkurrentene dine</h3>
              <p className="text-slate-400 text-sm sm:text-lg md:text-xl font-medium leading-relaxed mb-8">
                Hvorfor ligger de over deg på Google? Hva gjør de bedre? AI-en leser konkurrentene dine hver uke og forteller deg nøyaktig hva du må gjøre for å ta dem igjen.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-left">
                {[
                  "Hvem du må slå — og hvordan",
                  "Ideer til blogg og nye sider",
                  "Hvilke lenker du mangler",
                  "Strategimøte hver måned"
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
            <span>Handling, ikke grafer</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-black text-slate-950 mb-6 sm:mb-8 leading-[1.05] tracking-tight">
            Ikke tall og grafer. <br />
            <span className="text-violet-600">Bare gjøremål.</span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-slate-600 font-medium leading-relaxed mb-10 sm:mb-12">
            Andre dashboards krever at du tolker tallene selv. Hos Sikt får du én klar beskjed: "Gjør dette nå." Ferdig.
          </p>
          <div className="space-y-6 sm:space-y-8">
            {[
              {
                title: "AI som oversetter tallene",
                desc: "I stedet for grafer får du en setning du skjønner.",
                icon: <MessageCircle className="text-violet-600" />,
                example: "Eksempel: 'Siden om varmepumper får færre besøk. Skriv en seksjon om strømsparing.'"
              },
              {
                title: "Bare det som gir kunder",
                desc: "Vi kutter alt som ikke fører til flere kunder. Du jobber bare med det som betyr noe.",
                icon: <TrendingUp className="text-violet-600" />
              },
              {
                title: "Vi følger med på konkurrentene",
                desc: "Får du beskjed når noen gjør noe nytt som kan treffe kundene dine. Da kan du svare.",
                icon: <Activity className="text-violet-600" />
              }
            ].map((item, i) => (
              <div key={i} className="flex gap-4 sm:gap-6 group">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white shadow-md flex items-center justify-center shrink-0 border border-slate-100 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105">
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
                  <div className="text-[10px] sm:text-xs font-black text-slate-900 uppercase">Sikt AI — Gjøremål</div>
                  <div className="text-[8px] sm:text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div> Jobber nå
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
                    <div className="text-[10px] sm:text-xs font-black text-slate-900 mb-1">Fiks innholdet</div>
                    <div className="text-[8px] sm:text-[10px] text-slate-400 font-medium uppercase tracking-wider">Høy prioritet · +15% kunder</div>
                  </div>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-600 font-medium leading-relaxed">
                  "Legg til <span className="text-violet-600 font-bold">SEO-byrå Oslo</span> på tjeneste-siden. Det er dette kundene dine søker på."
                </p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm animate-fade-in" style={{ animationDelay: '0.4s' }}>
                <div className="flex gap-3 sm:gap-4 mb-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0"><Target size={16} /></div>
                  <div>
                    <div className="text-[10px] sm:text-xs font-black text-slate-900 mb-1">Konkurrent-varsel</div>
                    <div className="text-[8px] sm:text-[10px] text-slate-400 font-medium uppercase tracking-wider">Nettopp publisert</div>
                  </div>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-600 font-medium leading-relaxed">
                  "Nærmeste konkurrent la ut 3 nye blogger. Her er 3 ideer du kan publisere for å svare."
                </p>
              </div>

              <div className="bg-slate-950 p-5 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl animate-fade-in relative overflow-hidden" style={{ animationDelay: '0.6s' }}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/20 rounded-full blur-2xl"></div>
                <div className="flex gap-3 sm:gap-4 mb-3 relative z-10">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/10 flex items-center justify-center text-violet-400 shrink-0"><Sparkles size={16} /></div>
                  <div>
                    <div className="text-[10px] sm:text-xs font-black text-white mb-1">Gjør dette nå</div>
                    <div className="text-[8px] sm:text-[10px] text-slate-400 font-medium uppercase tracking-wider">Anbefalt av Sikt AI</div>
                  </div>
                </div>
                <div className="text-[11px] sm:text-sm text-white font-bold leading-relaxed relative z-10">
                  "Oppdater produktsidene. 80% av kundene som besøker dem klikker seg ikke videre."
                </div>
                <div className="mt-4 pt-4 border-t border-white/10 flex justify-end relative z-10">
                  <button className="text-[9px] sm:text-[10px] font-black text-violet-400 hover:text-white transition-colors flex items-center gap-1.5 uppercase tracking-widest">
                    Start nå <ArrowRight size={10} />
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
  // Zero cognitive load: default er ren sjekkmark-visning. Detaljer er ett klikk unna.
  // Vi bruker "gruppe-featureIndex" som nøkkel for hvilken rad som har detaljer åpne.
  const [openDetail, setOpenDetail] = useState<string | null>(null);

  type CellValue = boolean | string;
  type FeatureRow = {
    name: string;
    detail?: string;
    basic: CellValue;
    standard: CellValue;
    premium: CellValue;
    highlight?: boolean;
  };
  type Group = { label: string; features: FeatureRow[] };

  // Gruppert etter tema — gjør tabellen mye enklere å lese
  // (zero cognitive load: fire tydelige bolker som matcher kundens reise: fundament → auto-fiks → vekst → AI-søk)
  const groups: Group[] = [
    {
      label: "Grunnleggende (alle pakker)",
      features: [
        { name: "Hvor høyt du kommer opp på Google", detail: "Posisjon for alle søkeord du allerede rangerer på, rett fra Google Search Console. Ubegrenset antall søkeord i alle pakker.", basic: true, standard: true, premium: true },
        { name: "Månedlig teknisk helsesjekk", detail: "Vi sjekker hastighet, mobilvennlighet, ødelagte lenker, SSL, redirect-kjeder og Core Web Vitals hver måned.", basic: true, standard: true, premium: true },
        { name: "Data direkte fra Google", detail: "Klikk, visninger og posisjon siste 16 måneder fra Search Console og Analytics — forklart uten jargon.", basic: true, standard: true, premium: true },
        { name: "AI-tekstforslag klar til bruk", detail: "Meta-titler, meta-beskrivelser, alt-tekster og JSON-LD schema generert av AI og klargjort for innliming.", basic: true, standard: true, premium: true },
        { name: "Konkurrent-radar (du sover — Sikt holder øye)", detail: "Varsel når konkurrentene dine publiserer nytt innhold, endrer priser eller fikser tekniske ting. Du får beskjed før de løper fra deg.", basic: "2 konkurrenter", standard: "3 konkurrenter", premium: "Ubegrenset + AI", highlight: true },
        { name: "Ukentlig «Dette har Sikt fikset for deg»-kvittering", detail: "Hver mandag: konkret arbeid Sikt har gjort denne uken. Basic: funn + AI-forslag klare til innliming («3 meta-titler skrevet, 2 ødelagte lenker funnet»). Standard/Premium: faktiske fikser pushet til siden («12 meta-titler oppdatert, 6 bilder komprimert, 1 redirect opprettet»).", basic: "Funn + forslag", standard: "Fikser pushet", premium: "Fikser + GEO", highlight: true },
        { name: "Månedlig rapport på plain norsk", detail: "PDF som forklarer hva som er endret og hva du bør gjøre — uten SEO-jargon.", basic: true, standard: true, premium: true },
        { name: "Varsling når noe kritisk skjer", detail: "E-post med én gang ved trafikkdropp, nye 404-feil, nedetid eller mistet indeksering.", basic: true, standard: true, premium: true },
      ]
    },
    {
      label: "Innholdsjobben (Standard og Premium)",
      features: [
        { name: "Sikt fikser nettsiden din automatisk", detail: "Koble til plattformen (WordPress, Shopify, Webflow, Wix, GitHub m.fl.) — Sikt pusher endringer rett inn uten at du løfter en finger.", basic: false, standard: true, premium: true, highlight: true },
        { name: "Meta-tekster skrives og publiseres", detail: "AI skriver meta-titler og -beskrivelser, og Sikt legger dem rett inn på siden. Du gjør ingenting.", basic: false, standard: true, premium: true },
        { name: "Alt-tekster på bilder", detail: "Vision-AI ser på bildene dine og skriver beskrivende alt-tekster som både Google og skjermlesere forstår.", basic: false, standard: true, premium: true },
        { name: "Schema markup legges inn automatisk", detail: "Organization, LocalBusiness, Article, Product, FAQ og BreadcrumbList injiseres slik at Google viser deg med stjerner, bilder og rik info i søk.", basic: false, standard: true, premium: true },
        { name: "Intern lenking bygges opp", detail: "AI finner relaterte sider og legger inn lenker med gode ankertekster — uten at du løfter en finger.", basic: false, standard: true, premium: true },
        { name: "Bildekomprimering og WebP", detail: "Sikt krymper bilder og konverterer til moderne format så siden laster raskere på mobil.", basic: false, standard: true, premium: true },
        { name: "1-klikks angre (rollback)", detail: "Hver eneste endring Sikt gjør kan angres med ett klikk. Du er alltid i kontroll.", basic: false, standard: true, premium: true },
        { name: "Full endringslogg", detail: "Se nøyaktig hva Sikt har gjort for deg, når, og på hvilken side.", basic: false, standard: true, premium: true },
      ]
    },
    {
      label: "Vekst og strategi (Standard og Premium)",
      features: [
        { name: "Ukentlig rangeringssjekk", detail: "Vi sporer hvor du rangerer hver uke, ikke bare hver måned, så du oppdager endringer raskt.", basic: false, standard: "50 søkeord", premium: "Ubegrenset" },
        { name: "Dyp konkurrentanalyse", detail: "Utover radar-varslingen: AI analyserer innholdsstrategien deres, estimerer trafikken og viser hva som virker — så du vet nøyaktig hva du må gjøre for å gå forbi.", basic: false, standard: true, premium: "Inkl. AI-søk" },
        { name: "Søkeord kundene faktisk bruker", detail: "Finner søkeord dine kunder leter etter, men som du ennå ikke rangerer på.", basic: false, standard: true, premium: true },
        { name: "Månedlig innholdskalender", detail: "Månedlig plan med 4–8 artikkelforslag, skrevet av AI basert på det kundene dine faktisk søker etter.", basic: false, standard: true, premium: true },
        { name: "A/B-test av meta-titler", detail: "Sikt roterer automatisk mellom varianter og måler hvilken tittel som får flest klikk i søkeresultatene.", basic: false, standard: false, premium: true },
      ]
    },
    {
      label: "AI-søk og eksperthjelp (kun Premium)",
      features: [
        { name: "Synlig i ChatGPT, Gemini og Perplexity (GEO)", detail: "Sikt stiller 20–50 bransjerelevante spørsmål til AI-assistentene hver uke og rapporterer om — og hvordan — bedriften din nevnes.", basic: false, standard: false, premium: true, highlight: true },
        { name: "GEO-score per side", detail: "0–100-poeng som forteller hvor godt innholdet ditt leses av AI. Vi forteller deg nøyaktig hva du må endre for å score høyere.", basic: false, standard: false, premium: true },
        { name: "llms.txt publiseres automatisk", detail: "Vi lager og publiserer den nye standardfilen på /llms.txt som hjelper AI-søkemotorer forstå siden din.", basic: false, standard: false, premium: true },
        { name: "Hvem på nettet nevner deg", detail: "Overvåkning av Reddit, forum og bransjesider for omtaler av bedriften din.", basic: false, standard: false, premium: true },
        { name: "Citation-muligheter", detail: "Liste over autoritative norske nettsteder der du burde være nevnt — bransjeregistre, Wikipedia, bransjemedier.", basic: false, standard: false, premium: true },
        { name: "Spør Sikt AI — 24/7", detail: "AI-chat som kjenner din SEO-data og svarer på alt du lurer på, når som helst.", basic: false, standard: false, premium: true, highlight: true },
        { name: "Månedlig strategirapport (10+ sider)", detail: "Grundig analyse hver måned, inkludert GEO-konkurrentanalyse, vekststrategi og konkrete neste steg.", basic: false, standard: false, premium: true },
        { name: "Prioritert support (4 timer)", detail: "Svar innen 4 timer på hverdager, mot 24 timer i Standard.", basic: false, standard: false, premium: true },
      ]
    }
  ];

  const Cell = ({ value, isPremiumCol = false }: { value: CellValue, isPremiumCol?: boolean }) => {
    if (typeof value === 'string') {
      return (
        <span className={`text-[11px] sm:text-xs font-black ${isPremiumCol ? 'text-violet-600' : 'text-slate-700'}`}>
          {value}
        </span>
      );
    }
    return value
      ? <Check className={`mx-auto ${isPremiumCol ? 'text-violet-600' : 'text-emerald-500'}`} size={18} />
      : <div className="mx-auto w-4 sm:w-5 h-0.5 bg-slate-200"></div>;
  };

  return (
    <section className="py-16 sm:py-32 bg-white">
      <div className="max-w-6xl mx-auto px-5">
        <RevealOnScroll direction="up">
          <div className="text-center mb-12 sm:mb-24">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 text-violet-600 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mb-5 border border-violet-100">
              <Check size={11} />
              <span>Hva får du i hver pakke</span>
            </div>
            <h2 className="text-2xl sm:text-4xl md:text-6xl font-black text-slate-950 mb-4 sm:mb-6 tracking-tighter">Sammenlign pakkene.</h2>
            <p className="text-sm sm:text-lg text-slate-500 font-medium max-w-xl mx-auto">
              Start med Basic, oppgrader når du er klar. Ingen bindingstid — du betaler måned for måned.
            </p>
          </div>
        </RevealOnScroll>

        <div className="relative">
          <div className="overflow-x-auto pb-4 scrollbar-hide">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="py-6 sm:py-8 text-base sm:text-xl font-black text-slate-950 w-2/5"></th>
                  <th className="py-6 sm:py-8 text-center text-slate-950">
                    <div className="text-[9px] sm:text-xs font-black text-slate-400 uppercase mb-1 sm:mb-2">Basic</div>
                    <div className="text-lg sm:text-2xl font-black">499,-</div>
                    <div className="text-[9px] sm:text-[10px] text-slate-400 font-medium mt-1">pr mnd</div>
                  </th>
                  <th className="py-6 sm:py-8 text-center text-slate-950">
                    <div className="text-[9px] sm:text-xs font-black text-slate-400 uppercase mb-1 sm:mb-2">Standard</div>
                    <div className="text-lg sm:text-2xl font-black">1 499,-</div>
                    <div className="text-[9px] sm:text-[10px] text-slate-400 font-medium mt-1">pr mnd</div>
                  </th>
                  <th className="py-6 sm:py-8 text-center text-slate-950 bg-violet-50/40 border-x border-violet-100 rounded-t-2xl">
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-600 text-white text-[8px] sm:text-[9px] font-black uppercase tracking-wider mb-1.5">
                      <Sparkles size={9} /> Anbefalt
                    </div>
                    <div className="text-[9px] sm:text-xs font-black text-violet-600 uppercase mb-1 sm:mb-2">Premium</div>
                    <div className="text-lg sm:text-2xl font-black">4 999,-</div>
                    <div className="text-[9px] sm:text-[10px] text-slate-400 font-medium mt-1">pr mnd</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group, gi) => (
                  <React.Fragment key={gi}>
                    {/* Gruppe-overskrift */}
                    <tr>
                      <td colSpan={4} className="pt-8 sm:pt-10 pb-3">
                        <div className="text-[10px] sm:text-xs font-black text-violet-600 uppercase tracking-widest">
                          {group.label}
                        </div>
                      </td>
                    </tr>
                    {group.features.map((f, i) => {
                      const detailKey = `${gi}-${i}`;
                      const isOpen = openDetail === detailKey;
                      return (
                        <React.Fragment key={detailKey}>
                          <tr className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 sm:py-5 font-bold text-slate-700 text-xs sm:text-base">
                              <div className="flex items-center gap-2">
                                {f.highlight && <Sparkles size={12} className="text-violet-500 shrink-0" />}
                                <span className="flex-1">{f.name}</span>
                                {f.detail && (
                                  <button
                                    type="button"
                                    onClick={() => setOpenDetail(isOpen ? null : detailKey)}
                                    aria-label={isOpen ? "Skjul detaljer" : "Vis detaljer"}
                                    aria-expanded={isOpen}
                                    className={`shrink-0 transition-colors ${isOpen ? 'text-violet-600' : 'text-slate-300 hover:text-violet-500'}`}
                                  >
                                    <HelpCircle size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-4 sm:py-5 text-center">
                              <Cell value={f.basic} />
                            </td>
                            <td className="py-4 sm:py-5 text-center">
                              <Cell value={f.standard} />
                            </td>
                            <td className="py-4 sm:py-5 text-center bg-violet-50/40 border-x border-violet-100 [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-violet-50/60 transition-[background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]">
                              <Cell value={f.premium} isPremiumCol />
                            </td>
                          </tr>
                          {isOpen && f.detail && (
                            <tr className="border-b border-slate-50">
                              <td className="pb-4 sm:pb-5 pt-0" colSpan={3}>
                                <div className="p-3 sm:p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs sm:text-sm text-slate-600 leading-relaxed">
                                  {f.detail}
                                </div>
                              </td>
                              <td className="pb-4 sm:pb-5 pt-0 bg-violet-50/40 border-x border-violet-100"></td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                ))}
                {/* Bunn av Premium-kolonnen (avrundet hjørne) */}
                <tr>
                  <td colSpan={3}></td>
                  <td className="bg-violet-50/40 border-x border-b border-violet-100 rounded-b-2xl h-4"></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="md:hidden flex justify-center items-center gap-2 mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest animate-pulse">
            <ArrowRight size={10} className="rotate-0" />
            <span>Sveip for å se alle pakker</span>
            <ArrowRight size={10} className="rotate-180" />
          </div>
        </div>

        {/* Myk CTA under tabellen — guider brukeren videre uten å tvinge */}
        <RevealOnScroll direction="up" delay={200}>
          <div className="mt-12 sm:mt-16 text-center">
            <p className="text-xs sm:text-sm text-slate-500 font-medium mb-4">
              Usikker på hvilken pakke som passer? Start med Basic — du kan oppgradere når som helst.
            </p>
            <a href="#priser" className="inline-flex items-center gap-2 text-sm sm:text-base font-black text-violet-600 transition-[color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-violet-700 group">
              Se pakkene og kom i gang
              <ArrowRight size={16} className="transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1" />
            </a>
          </div>
        </RevealOnScroll>
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
            <a href="#priser" className="group w-full sm:w-auto px-10 py-4 sm:px-12 sm:py-5 bg-slate-950 text-white rounded-full text-base sm:text-lg font-black tracking-tight ui-motion ui-lift flex items-center justify-center gap-3 shadow-xl shadow-slate-200 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-600 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-2xl [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-violet-500/30">
              Ta meg til toppen av Google <ArrowRight size={22} className="transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1.5" />
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
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">Din oversikt</h3>
                    <p className="text-[10px] text-slate-400 font-medium hidden sm:block">Oppdatert akkurat nå</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 rounded-full border border-emerald-100">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-[9px] font-bold text-emerald-600 uppercase">Alt OK</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden md:flex gap-4 mr-4">
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] text-slate-400 font-bold uppercase">Siden din</span>
                      <span className="text-xs font-black text-slate-900">98.5%</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] text-slate-400 font-bold uppercase">Ord du ranker på</span>
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
                    { l: "Besøkende", v: "124.5k", c: "text-violet-600", g: "+12%" },
                    { l: "Synlighet", v: "89.2%", c: "text-emerald-600", g: "+4.1%" },
                    { l: "Troverdighet", v: "54", c: "text-amber-600", g: "+1" },
                    { l: "Feil å fikse", v: "0", c: "text-slate-900", g: "-2" },
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
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide">Total score</h4>
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
                      <span className="text-[10px] text-slate-400 font-medium">Neste sjekk om 2t 14m</span>
                      <button className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded-md">Sjekk nå</button>
                    </div>
                  </div>

                  {/* Chart Card (Detailed) */}
                  <div className="md:col-span-8 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col relative overflow-hidden">
                    <div className="flex justify-between items-center mb-4 z-10">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Besøkende på siden</h4>
                        <div className="flex gap-2 text-[9px] text-slate-400 font-medium mt-0.5">
                          <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-violet-500"></div> Fra Google</span>
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
                    <h4 className="text-[9px] font-bold text-slate-400 uppercase mb-2">Topp søk</h4>
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
                    <h4 className="text-[9px] font-bold text-slate-400 uppercase mb-2">Brukeropplevelse</h4>
                    <div className="flex items-end gap-2 h-10 mt-2">
                      {[
                        { l: "Fart", v: 80, c: "bg-emerald-400" },
                        { l: "Respons", v: 95, c: "bg-emerald-400" },
                        { l: "Stabilitet", v: 60, c: "bg-amber-400" }
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
                    <span className="text-[9px] font-bold text-slate-400 uppercase relative z-10">Sikt AI</span>
                    <span className="text-[10px] font-black text-white relative z-10">Jobber...</span>
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
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-violet-50 rounded-xl sm:rounded-2xl flex items-center justify-center text-violet-600 [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-violet-600 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-white transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] shrink-0">
                  <Cpu size={20} />
                </div>
                <h3 className="text-lg sm:text-xl font-bold">Autonome Analyser</h3>
              </div>
              <p className="text-sm sm:text-base text-slate-500 pl-14 sm:pl-16 font-medium leading-relaxed">Våre modeller skanner algoritme-endringer i sanntid og utfører 1000x flere beregninger.</p>
            </div>
            <div className="group">
              <div className="flex items-center gap-4 mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-violet-50 rounded-xl sm:rounded-2xl flex items-center justify-center text-violet-600 [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-violet-600 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-white transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] shrink-0">
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

const GscPreCheck = ({ onConfirm, onCancel, theme }: {
  onConfirm: () => void;
  onCancel: () => void;
  theme?: any;
}) => {
  const [verified, setVerified] = useState(false);
  const [sameAccount, setSameAccount] = useState(false);
  const canProceed = verified && sameAccount;

  return (
    <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">
        Før du kobler til Google
      </h2>
      <p className="text-slate-600 mb-6">
        For at Sikt skal kunne hente søkeorddata for nettsiden din, må disse to tingene være på plass:
      </p>

      {/* Sjekkliste */}
      <div className="space-y-4 mb-6">
        {/* Punkt 1 */}
        <div
          onClick={() => setVerified(!verified)}
          className="flex items-start gap-3 p-4 rounded-lg border-2 border-slate-200 hover:border-violet-300 cursor-pointer transition-colors"
        >
          <div className="pt-0.5">
            {verified ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <Circle className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium text-slate-900 mb-1">
              Jeg har verifisert nettsiden min i Google Search Console
            </p>
            <a
              href="https://support.google.com/webmasters/answer/9008080"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-violet-600 hover:text-violet-700 inline-flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              Har du ikke gjort det ennå? Slik gjør du det
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Punkt 2 */}
        <div
          onClick={() => setSameAccount(!sameAccount)}
          className="flex items-start gap-3 p-4 rounded-lg border-2 border-slate-200 hover:border-violet-300 cursor-pointer transition-colors"
        >
          <div className="pt-0.5">
            {sameAccount ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <Circle className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium text-slate-900 mb-1">
              Jeg vil koble til med samme Google-konto som eier nettsiden
            </p>
            <p className="text-sm text-slate-600">
              Hvis nettsiden er verifisert med jobbkonto, logg inn med jobbkonto.
            </p>
          </div>
        </div>
      </div>

      {/* Knapper */}
      <div className="space-y-3">
        <button
          onClick={onConfirm}
          disabled={!canProceed}
          className={`w-full py-3 px-4 rounded-lg font-semibold transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] disabled:active:scale-100 ${
            canProceed
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {canProceed
            ? 'Koble til Google Search Console'
            : 'Bekreft begge punkter for å fortsette'
          }
        </button>

        <button
          onClick={onCancel}
          className="w-full py-2 text-sm text-slate-600 transition-[color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-slate-900 active:scale-[0.98]"
        >
          Hopp over for nå — jeg gjør dette senere
        </button>
      </div>
    </div>
  );
};


const OnboardingPage = ({ onComplete, user }: { onComplete: () => void, user: any }) => {
  const [loading, setLoading] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(true);
  const [showGscStep, setShowGscStep] = useState(false);
  const [websiteUrlStatus, setWebsiteUrlStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');

  const [formData, setFormData] = useState({
    companyName: '', contactPerson: '', email: '', phone: '',
    websiteUrl: '', industry: '', targetAudience: ''
  });

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Preutfyll skjemaet med eksisterende data hvis brukeren har vært her før.
  // Dette gjør at en bruker som betalte og fylte ut delvis kan fortsette der
  // de slapp i stedet for å begynne på nytt.
  useEffect(() => {
    let cancelled = false;
    const loadDraft = async () => {
      if (!user?.id) {
        setPrefillLoading(false);
        return;
      }
      try {
        const rows = await supabaseRest<any[]>(
          `clients?user_id=eq.${user.id}&select=company_name,contact_person,email,phone,website_url,industry,target_audience&limit=1`,
        );
        if (cancelled) return;
        const existing = Array.isArray(rows) && rows.length ? rows[0] : null;
        if (existing) {
          setFormData({
            companyName: existing.company_name || '',
            contactPerson: existing.contact_person || '',
            email: existing.email || user.email || '',
            phone: existing.phone || '',
            websiteUrl: existing.website_url || '',
            industry: existing.industry || '',
            targetAudience: existing.target_audience || '',
          });
        } else if (user.email) {
          // Førstegangs-bruker: bare preutfyll e-post fra Google-kontoen
          setFormData(prev => ({ ...prev, email: user.email }));
        }
      } catch (err: any) {
        console.warn('[Onboarding] Kunne ikke hente eksisterende data:', err?.message || err);
      } finally {
        if (!cancelled) setPrefillLoading(false);
      }
    };
    loadDraft();
    return () => { cancelled = true; };
  }, [user?.id, user?.email]);

  // Lagrer en kladd til databasen uten å sette onboarding_completed=true.
  // Kalles når et felt forlates, slik at brukeren ikke mister fremgangen
  // hvis de lukker fanen midt i utfyllingen.
  const saveDraft = async (latest: typeof formData) => {
    if (!user?.id) return;
    // Hopp over hvis alt er tomt (unngå å skrive en tom rad)
    const hasAnyValue = Object.values(latest).some(v => String(v || '').trim().length > 0);
    if (!hasAnyValue) return;
    try {
      await supabaseRest('clients?on_conflict=user_id', {
        method: 'POST',
        body: {
          user_id: user.id,
          company_name: latest.companyName || null,
          contact_person: latest.contactPerson || null,
          email: latest.email || null,
          phone: latest.phone || null,
          website_url: latest.websiteUrl || null,
          industry: latest.industry || null,
          target_audience: latest.targetAudience || null,
        },
        headers: { Prefer: 'resolution=merge-duplicates' },
      });
    } catch (err: any) {
      console.warn('[Onboarding] Kunne ikke lagre kladd:', err?.message || err);
    }
  };

  const handleSelectIndustry = (industry: string) => {
    setFormData(prev => {
      const next = { ...prev, industry };
      saveDraft(next);
      return next;
    });
    setShowSuggestions(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'industry') {
      if (value.length > 0) {
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

  const handleBlur = (_e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Lagre kladd når et felt forlates (debounce-fri og pålitelig)
    saveDraft(formData);
  };

  const handleWebsiteUrlBlur = () => {
    const raw = String(formData.websiteUrl || '').trim();
    if (!raw) {
      setWebsiteUrlStatus('idle');
      saveDraft(formData);
      return;
    }

    let normalized = raw;
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    normalized = normalized.replace(/\/+$/, '');

    const next = { ...formData, websiteUrl: normalized };
    setFormData(next);
    setWebsiteUrlStatus(/^https?:\/\/.+\..+/.test(normalized) ? 'valid' : 'invalid');
    saveDraft(next);
  };

  const handleConnectSearchConsole = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const redirectUri = `${supabaseUrl}/functions/v1/google-oauth-callback`;
    const scope = 'https://www.googleapis.com/auth/webmasters.readonly';

    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${encodeURIComponent(user?.id || '')}`;

    window.location.href = oauthUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Selvbergning: Hvis user-prop mangler (timing-race ved redirect fra Stripe
    // eller treg auth-init), henter vi brukeren direkte fra Supabase i stedet
    // for å gi opp. Da kan skjemaet lagres uansett om prop-en er satt ennå.
    let aktivBruker = user;
    if (!aktivBruker) {
      console.warn("[Onboarding] User-prop mangler, prøver supabase.auth.getUser()");
      try {
        const { data: { user: fetchedUser } } = await supabase.auth.getUser();
        aktivBruker = fetchedUser;
      } catch (err) {
        console.error("[Onboarding] getUser() feilet:", err);
      }
    }

    if (!aktivBruker) {
      console.warn("[Onboarding] Avbryter: ingen bruker funnet (heller ikke fra Supabase)");
      toastError("Feil: Ingen bruker funnet. Logg inn på nytt.");
      setLoading(false);
      return;
    }

    try {
      const dataTilDatabase = {
        user_id: aktivBruker.id,
        onboarding_completed: true,
        company_name: formData.companyName,
        contact_person: formData.contactPerson,
        email: formData.email,
        phone: formData.phone,
        website_url: formData.websiteUrl,
        industry: formData.industry,
        target_audience: formData.targetAudience
      };

      // Vi bruker rå fetch mot Supabase REST API i stedet for supabase-js-klienten.
      // Årsak: klienten henger av og til ved ugyldig sesjonstilstand (auth-lock-deadlock).
      // Dette gir oss full kontroll og synlige feilmeldinger.

      // Hent token direkte fra localStorage (samme sted supabase-js lagrer det)
      const getStoredAccessToken = (): string | null => {
        try {
          const keys = Object.keys(localStorage);
          const tokenKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
          if (!tokenKey) return null;
          const raw = localStorage.getItem(tokenKey);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          return parsed?.access_token || null;
        } catch {
          return null;
        }
      };

      const accessToken = getStoredAccessToken();

      if (!accessToken) {
        throw new Error("Ingen gyldig sesjon i localStorage. Logg ut og logg inn på nytt.");
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const fetchController = new AbortController();
      const fetchTimeout = setTimeout(() => fetchController.abort(), 15000);

      let response: Response;
      try {
        response = await fetch(`${supabaseUrl}/rest/v1/clients?on_conflict=user_id`, {
          method: 'POST',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify(dataTilDatabase),
          signal: fetchController.signal,
        });
      } finally {
        clearTimeout(fetchTimeout);
      }

      const responseText = await response.text();
      let responseJson: any = null;
      try { responseJson = responseText ? JSON.parse(responseText) : null; } catch { /* ikke json */ }

      if (!response.ok) {
        const details = responseJson?.message || responseJson?.error || responseText || `HTTP ${response.status}`;
        throw new Error(`Supabase avviste: ${details}`);
      }

      if (!responseJson || (Array.isArray(responseJson) && responseJson.length === 0)) {
        throw new Error("Ingen rad returnert — sannsynligvis RLS-policy som blokkerer. Sjekk INSERT/UPDATE-policy på clients-tabellen.");
      }

      setShowGscStep(true);

    } catch (error: any) {
      const rawMsg = error?.message || String(error);
      const friendlyMsg = /abort/i.test(rawMsg)
        ? "Tidsavbrudd (20s) — Supabase svarte ikke. Sjekk nettverkstilkobling og RLS-policy på clients-tabellen."
        : rawMsg;
      console.error("[Onboarding] Feil ved lagring:", { message: rawMsg, details: error?.details, code: error?.code, hint: error?.hint });
      toastError("Noe gikk galt under lagring: " + friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  if (showGscStep) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50 flex items-center justify-center p-4">
        <GscPreCheck
          onConfirm={handleConnectSearchConsole}
          onCancel={onComplete}
        />
      </div>
    );
  }

  return (
    <section className="min-h-screen bg-slate-50 py-20 px-5 flex items-center justify-center">
      <div className="max-w-3xl w-full bg-white rounded-[32px] shadow-2xl p-8 sm:p-12 relative z-10 border border-slate-100">
        <h1 className="text-3xl font-black text-slate-950 mb-2">Fortell oss om din <span className="text-violet-600">bedrift</span></h1>
        <p className="text-sm text-slate-500 mb-8">
          {prefillLoading
            ? 'Henter dine opplysninger…'
            : (formData.companyName || formData.websiteUrl)
              ? 'Vi har lagret det du fylte ut sist. Du kan fortsette der du slapp.'
              : 'Vi lagrer fremgangen din automatisk når du forlater et felt.'}
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <input required name="companyName" value={formData.companyName} onChange={handleChange} onBlur={handleBlur} placeholder="Bedriftsnavn" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-violet-600 outline-none" />
            <input required name="contactPerson" value={formData.contactPerson} onChange={handleChange} onBlur={handleBlur} placeholder="Kontaktperson" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-violet-600 outline-none" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <input required type="email" name="email" value={formData.email} onChange={handleChange} onBlur={handleBlur} placeholder="E-post" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-violet-600 outline-none" />
            <input required type="tel" name="phone" value={formData.phone} onChange={handleChange} onBlur={handleBlur} placeholder="Telefon" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-violet-600 outline-none" />
          </div>
          <div>
            <div className="relative">
              <input
                required
                type="url"
                name="websiteUrl"
                value={formData.websiteUrl}
                onChange={handleChange}
                onBlur={handleWebsiteUrlBlur}
                placeholder="Nettside URL (https://...)"
                className={`w-full p-4 pr-11 bg-slate-50 rounded-xl border ${websiteUrlStatus === 'valid' ? 'border-emerald-300' : websiteUrlStatus === 'invalid' ? 'border-rose-300' : 'border-slate-200'} focus:ring-2 focus:ring-violet-600 outline-none`}
              />
              {websiteUrlStatus === 'valid' && (
                <CheckCircle size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600" />
              )}
              {websiteUrlStatus === 'invalid' && (
                <AlertCircle size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-600" />
              )}
            </div>
            {websiteUrlStatus === 'invalid' && (
              <p className="text-xs text-rose-600 mt-2">URL ser ugyldig ut. Husk å bruke et domenenavn med punktum.</p>
            )}
          </div>

          <div className="relative">
            <input
              required
              name="industry"
              value={formData.industry}
              onChange={handleChange}
              onBlur={(e) => {
                handleBlur(e);
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              placeholder="Bransje (Begynn å skrive...)"
              className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-violet-600 outline-none"
            />

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

          <textarea required name="targetAudience" value={formData.targetAudience} rows={3} onChange={handleChange} onBlur={handleBlur} placeholder="Målgruppe (Hvem ønsker du å nå?)" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-violet-600 outline-none" />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-violet-600 text-white rounded-xl font-bold text-lg transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-xl disabled:opacity-50 enabled:hover:bg-violet-700 active:enabled:scale-[0.98]"
          >
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
    <section className="relative py-20 sm:py-32 md:py-48 overflow-hidden bg-[#fcfcfd]">

      {/* Bakgrunn: En rolig, pulserende glød */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[800px] h-[400px] sm:h-[500px] bg-gradient-to-tr from-violet-100/50 via-indigo-50/50 to-white rounded-[100%] blur-[80px] animate-[pulse_10s_ease-in-out_infinite] pointer-events-none"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col gap-12 sm:gap-16 md:gap-24">

          {/* DEL 1: PROBLEMET (Venstre side) */}
          <RevealOnScroll delay={0} className="self-start sm:ml-12 relative">
            {/* En liten bakgrunns-sirkel for dybde */}
            <div className="absolute -left-4 -top-4 w-20 h-20 bg-slate-100 rounded-full blur-xl opacity-50 animate-pulse pointer-events-none"></div>

            <div className="backdrop-blur-md bg-white/80 border border-slate-200/60 shadow-sm px-5 py-4 sm:px-8 sm:py-5 rounded-2xl inline-flex items-center gap-3 sm:gap-4 max-w-lg relative z-10">
              <div className="w-2 h-2 rounded-full bg-slate-400 shrink-0"></div>
              <p className="text-slate-600 font-medium text-sm sm:text-lg leading-snug">
                Mange bedrifter gjetter på hvordan de oppnår <span className="text-slate-900 font-bold border-b-2 border-slate-200">høyere rangering</span> på Google.
              </p>
            </div>
          </RevealOnScroll>


          {/* DEL 2: LØSNINGEN (Høyre side) */}
          <RevealOnScroll delay={200} className="self-end text-left sm:text-right max-w-5xl flex flex-col sm:flex-row-reverse items-center sm:items-start gap-6 sm:gap-8 md:gap-12">

            {/* NY MODERNE ILLUSTRASJON (Abstrakt Vekst-Graf) */}
            <div className="relative shrink-0 w-40 h-40 sm:w-64 sm:h-64 animate-[float_6s_ease-in-out_infinite]">
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
              <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-[1.2] sm:leading-[1.15]">
                Vi bruker <span className="text-violet-600">AI</span> til å gi deg en <br className="hidden sm:block" />
                konkret oppskrift på å <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">nå toppen.</span>
              </h2>

              <p className="mt-4 sm:mt-8 text-base sm:text-xl md:text-2xl text-slate-600 font-normal leading-relaxed max-w-2xl sm:ml-auto">
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


// ---------------------------------------------------------
// INDUSTRIES SECTION — "Er dette for min bransje?"
// Psykologi: Self-identification. Når en rørlegger ser "Håndverker",
//   skjer det en instant match. Fjerner tvilen om passform.
// ---------------------------------------------------------
const IndustriesSection = () => {
  const industries = [
    { icon: <Wrench size={24} />, name: "Håndverker", example: "Rørlegger, elektriker, snekker" },
    { icon: <HeartHandshake size={24} />, name: "Klinikk & Helse", example: "Tannlege, fysioterapeut, kiropraktor" },
    { icon: <ShoppingBag size={24} />, name: "Nettbutikk", example: "Alt fra klær til spesialprodukter" },
    { icon: <Coffee size={24} />, name: "Restaurant & Kafé", example: "Spisested, bakeri, catering" },
    { icon: <Briefcase size={24} />, name: "Byrå & Konsulent", example: "Advokat, regnskap, rådgivning" },
    { icon: <Home size={24} />, name: "Eiendom & Bolig", example: "Megler, utleie, boligbyggere" }
  ];

  return (
    <section className="py-16 sm:py-24 bg-transparent relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <RevealOnScroll direction="up">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 text-violet-600 text-[10px] font-bold uppercase tracking-widest mb-5 border border-violet-100">
              <Users size={11} />
              <span>Er dette for meg</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-950 mb-4 tracking-tight leading-tight">
              Sikt hjelper <span className="text-violet-600">bedrifter som dere.</span>
            </h2>
            <p className="text-base sm:text-lg text-slate-500 font-medium max-w-2xl mx-auto">
              Hvis kundene dine søker etter deg på Google — så fungerer Sikt for deg. Her er noen eksempler.
            </p>
          </div>
        </RevealOnScroll>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          {industries.map((industry, i) => (
            <RevealOnScroll key={i} direction="up" delay={i * 50}>
              <div className="group p-5 sm:p-7 bg-white/70 backdrop-blur-sm border border-slate-100 rounded-2xl sm:rounded-3xl ui-motion ui-lift-sm h-full [@media(hover:hover)_and_(pointer:fine)]:hover:border-violet-200 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-lg">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center mb-4 [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-violet-600 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-white transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]">
                  {industry.icon}
                </div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 mb-1">{industry.name}</h3>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-relaxed">{industry.example}</p>
              </div>
            </RevealOnScroll>
          ))}
        </div>

        <RevealOnScroll direction="up" delay={300}>
          <p className="text-center text-xs sm:text-sm text-slate-400 font-medium mt-8 italic">
            Driver du noe annet? Sikt fungerer for alle bransjer der Google er kilden til kunder.
          </p>
        </RevealOnScroll>
      </div>
    </section>
  );
};


// ---------------------------------------------------------
// GEO SHIFT SECTION — Presenterer GEO (AI-søk-synlighet) for kunden
// Design-prinsipp: ZERO COGNITIVE LOAD
//   - Én overskrift, én visuell kontrast, én handling
//   - Plassering: rett før Pricing (peak-end-prinsipp — siste argument før pris)
//   - Psykologi: paradigmeskifte ("før vs nå") trigger FOMO uten å preke
// ---------------------------------------------------------
const GeoShiftSection = ({ onSelectPlan }: { onSelectPlan: (plan: string) => void }) => {
  return (
    <section id="geo" className="relative py-16 sm:py-24 md:py-36 overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Myk glød i bakgrunnen */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[900px] h-[400px] sm:h-[600px] bg-gradient-to-tr from-violet-600/20 via-indigo-500/10 to-transparent rounded-full blur-[100px] sm:blur-[120px] pointer-events-none"></div>

      {/* Svake dotter for dybde — ZERO COGNITIVE LOAD: de må ikke ta fokus */}
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">

        {/* --- OVERSKRIFT --- */}
        <RevealOnScroll direction="up">
          <div className="text-center mb-10 sm:mb-16 md:mb-24">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-600/10 backdrop-blur-md border border-violet-400/30 text-violet-300 text-[10px] sm:text-xs font-bold mb-6 sm:mb-8 uppercase tracking-widest">
              <BrainCircuit size={13} />
              <span>Både Google og AI</span>
            </div>

            <h2 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight mb-4 sm:mb-6 leading-[1.1] sm:leading-[1.05]">
              Google er ikke <span className="text-violet-400">alene</span> lenger.
              <br className="hidden sm:block" />
              <span className="sm:hidden"> </span>Kundene spør også ChatGPT.
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed font-medium px-2">
              For å vinne i dag må du være synlig begge steder. Sikt jobber for begge.
            </p>
          </div>
        </RevealOnScroll>

        {/* --- VISUELL KONTRAST: Google (før) vs ChatGPT (nå) --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-16 sm:mb-24 max-w-5xl mx-auto">

          {/* GOOGLE — Fortsatt viktig */}
          <RevealOnScroll direction="left" delay={100}>
            <div className="relative bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-7 sm:p-9 h-full">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-700/70 flex items-center justify-center">
                    <SearchIcon size={16} className="text-slate-300" />
                  </div>
                  <span className="text-xs uppercase tracking-widest text-slate-300 font-bold">Google</span>
                </div>
                <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-black bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-400/30">Fortsatt viktig</span>
              </div>

              <div className="bg-white/10 rounded-xl p-4 mb-5 border border-white/5">
                <p className="text-sm text-slate-200 italic">"Beste SEO-byrå Oslo"</p>
              </div>

              {/* Fake søkeresultater */}
              <div className="space-y-3">
                <div className="flex items-start gap-2 opacity-70">
                  <div className="w-1 h-1 rounded-full bg-violet-400 mt-2 shrink-0"></div>
                  <div className="h-2.5 bg-slate-600 rounded-full w-3/4"></div>
                </div>
                <div className="flex items-start gap-2 opacity-50">
                  <div className="w-1 h-1 rounded-full bg-violet-400 mt-2 shrink-0"></div>
                  <div className="h-2.5 bg-slate-600 rounded-full w-2/3"></div>
                </div>
                <div className="flex items-start gap-2 opacity-30">
                  <div className="w-1 h-1 rounded-full bg-violet-400 mt-2 shrink-0"></div>
                  <div className="h-2.5 bg-slate-600 rounded-full w-1/2"></div>
                </div>
                <div className="flex items-start gap-2 opacity-20">
                  <div className="w-1 h-1 rounded-full bg-violet-400 mt-2 shrink-0"></div>
                  <div className="h-2.5 bg-slate-600 rounded-full w-5/6"></div>
                </div>
              </div>

              <p className="text-xs text-slate-400 mt-6 italic">Sikt løfter deg til topps her. Det er grunnmuren.</p>
            </div>
          </RevealOnScroll>

          {/* AI — Det nye laget */}
          <RevealOnScroll direction="right" delay={200}>
            <div className="relative bg-gradient-to-br from-violet-600/20 to-indigo-600/20 backdrop-blur-md border border-violet-400/30 rounded-3xl p-7 sm:p-9 h-full shadow-2xl shadow-violet-900/30">
              {/* "Nytt"-indikator */}
              <div className="absolute -top-3 -right-3 bg-violet-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">
                Nytt
              </div>

              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
                    <Sparkles size={16} className="text-white" />
                  </div>
                  <span className="text-xs uppercase tracking-widest text-violet-200 font-bold">ChatGPT</span>
                </div>
                <span className="text-[9px] uppercase tracking-wider text-violet-200 font-black bg-violet-500/20 px-2 py-0.5 rounded-full border border-violet-400/40">I tillegg</span>
              </div>

              <div className="bg-white/10 rounded-xl p-4 mb-5 border border-violet-400/20">
                <p className="text-sm text-slate-100 italic">"Hvilket SEO-byrå bør jeg velge?"</p>
              </div>

              {/* AI-svar med én anbefaling */}
              <div className="space-y-3">
                <div className="bg-white/10 rounded-xl p-4 border border-violet-400/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-400 to-indigo-400 flex items-center justify-center">
                      <Sparkles size={10} className="text-white" />
                    </div>
                    <span className="text-xs text-violet-200 font-bold">ChatGPT</span>
                  </div>
                  <p className="text-sm text-slate-100 leading-relaxed">
                    Jeg vil anbefale <span className="font-bold text-violet-300 bg-violet-500/20 px-1.5 rounded">din bedrift</span> — de er kjent for...
                  </p>
                </div>
              </div>

              <p className="text-xs text-violet-200 mt-6 italic">Sikt sørger for at AI-en anbefaler deg også.</p>
            </div>
          </RevealOnScroll>
        </div>

        {/* --- LØSNINGEN + CTA --- */}
        <RevealOnScroll direction="up" delay={300}>
          <div className="max-w-3xl mx-auto text-center">
            <h3 className="text-2xl sm:text-3xl font-black mb-4 leading-tight">
              Sikt jobber for <span className="text-violet-400">begge deler.</span>
            </h3>
            <p className="text-slate-400 text-base sm:text-lg mb-10 leading-relaxed">
              Vi løfter deg høyere på Google — og sørger samtidig for at ChatGPT, Gemini og Perplexity anbefaler deg.
              <br className="hidden sm:block" />
              Ingen andre byråer i Norge gjør begge deler — ennå.
            </p>

            <button
              onClick={() => onSelectPlan('PREMIUM')}
              className="group ui-motion ui-lift inline-flex items-center gap-3 px-10 py-5 bg-violet-600 text-white rounded-full text-base sm:text-lg font-black tracking-tight shadow-xl shadow-violet-900/50 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-500 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-violet-500/50"
            >
              Inkludert i Premium
              <ArrowRight size={20} className="transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1.5" />
            </button>

            <p className="text-xs text-slate-500 mt-5 uppercase tracking-widest font-bold">
              Vær synlig der kundene leter — både på Google og i AI
            </p>
          </div>
        </RevealOnScroll>

      </div>
    </section>
  );
};


// Legg merke til at vi nå tar imot "handleLogin" her
const Pricing = ({ onSelectPlan }: { onSelectPlan: (plan: string) => void }) => {
  // Sporer hvilken feature-bullet som har detaljer åpne. Format: "kortIndex-featureIndex" eller null.
  // Zero cognitive load: default er lukket, detaljer er ett klikk unna.
  const [openDetail, setOpenDetail] = useState<string | null>(null);

  type PlanFeature = { text: string; detail?: string };
  type Plan = { title: string; price: string; tagline: string; desc: string; features: PlanFeature[]; highlighted?: boolean };

  const plans: Plan[] = [
    {
      title: "BASIC",
      price: "499",
      tagline: "Fiks grunnmuren — selv.",
      desc: "Se alt som holder deg nede på Google. Du får klare instruksjoner og AI-genererte tekster du kan bruke selv.",
      features: [
        { text: "Se hvor du står på Google — ubegrenset antall søkeord", detail: "Posisjon, klikk og visninger for alle søkeord du allerede rangerer på, hentet direkte fra Google Search Console." },
        { text: "Månedlig sjekk av hastighet og tekniske feil", detail: "Vi sjekker Core Web Vitals, mobilvennlighet, ødelagte lenker, SSL og redirect-kjeder hver måned." },
        { text: "AI skriver meta-tekster og alt-tekster — du limer inn", detail: "Ferdige tekster for manglende meta-titler, beskrivelser og bilde-alt som du kan kopiere rett inn i ditt eget system." },
        { text: "Kopier-og-lim-inn kode for tekniske fikser", detail: "Når vi finner en teknisk feil, får du nøyaktig hvilken kode som må endres — forklart på plain norsk." },
        { text: "Konkurrent-radar: varsel når 2 konkurrenter endrer seg", detail: "Du sover — Sikt holder øye. E-postvarsel når dine 2 hovedkonkurrenter publiserer nytt innhold, endrer priser eller fikser tekniske ting, så du aldri blir overrasket." },
        { text: "Ukentlig «Dette har Sikt klargjort for deg»-kvittering", detail: "Hver mandag: konkret liste over funn og ferdige AI-forslag du kan lime inn selv. «3 meta-titler skrevet, 2 ødelagte lenker funnet, 4 alt-tekster generert.» Ingen abstrakte SEO-tall — bare konkret arbeid klart til bruk." },
        { text: "E-postvarsel når noe går galt", detail: "Øyeblikkelig varsel ved trafikkdropp, nye 404-feil eller nedetid." },
        { text: "Månedlig rapport på plain norsk", detail: "PDF som forklarer hva som har endret seg og hva du bør gjøre — uten SEO-jargon." }
      ]
    },
    {
      title: "STANDARD",
      price: "1 499",
      tagline: "Vi gjør jobben for deg.",
      highlighted: true,
      desc: "Koble nettsiden din til Sikt, så fikser vi feilene og skriver inn forbedringene — automatisk, hver uke.",
      features: [
        { text: "Alt i Basic", detail: "Full teknisk analyse, søkeord-sporing, AI-tekstforslag, månedlig rapport og konkurrent-radar er inkludert." },
        { text: "Sikt fikser nettsiden din automatisk", detail: "Koble til plattformen (WordPress, Shopify, Webflow, Wix, GitHub m.fl.) — Sikt pusher endringer rett inn uten at du løfter en finger." },
        { text: "Ukentlig «Dette har Sikt fikset for deg»-kvittering (pushet til siden)", detail: "Hver mandag: «12 meta-titler oppdatert, 3 ødelagte lenker fikset, 1 ny redirect opprettet, 6 bilder komprimert til WebP.» I motsetning til Basic (hvor du limer inn selv), ligger disse endringene allerede live på siden din." },
        { text: "AI skriver og publiserer tekster, alt-tekster og schema", detail: "Meta-titler, beskrivelser, alt-tekster og strukturert data genereres og oppdateres automatisk på siden din." },
        { text: "Ukentlig rangeringssjekk på inntil 50 søkeord", detail: "Vi sporer posisjonen din hver uke — ikke bare hver måned — så du oppdager endringer tidlig." },
        { text: "Konkurrent-radar utvidet: 3 konkurrenter + innholdsanalyse", detail: "Som i Basic, men utvidet til 3 konkurrenter og med AI-drevet analyse av hva som faktisk virker for dem — så du kan slå tilbake raskt." },
        { text: "1-klikks angre på enhver endring", detail: "Full endringslogg + rollback. Du er alltid i kontroll — ingenting gjøres som ikke kan reverseres." },
        { text: "Prioritert e-post-support", detail: "Svar innen 24 timer på hverdager." }
      ]
    },
    {
      title: "PREMIUM",
      price: "4 999",
      tagline: "Dominér både Google og AI.",
      desc: "Alt i Standard, pluss full synlighet i ChatGPT, Gemini og Perplexity. Vær først ute i AI-søk.",
      features: [
        { text: "Alt i Standard", detail: "Auto-fiks, ukentlig kvittering, AI-tekster, 50-søkeord-sporing, konkurrent-radar og prioritert support er inkludert." },
        { text: "Ukentlig sjekk: anbefaler ChatGPT, Gemini og Perplexity deg?", detail: "Sikt stiller 20–50 bransjerelevante spørsmål til AI-assistentene hver uke og rapporterer om — og hvordan — bedriften din nevnes." },
        { text: "Ubegrenset søkeord-sporing", detail: "Ingen grense. Spor alle søkeord som er relevante for bedriften din." },
        { text: "Spør Sikt AI hva som helst — 24/7", detail: "AI-chat som kjenner dine egne SEO-data og svarer på alt du lurer på, når som helst." },
        { text: "Konkurrent-radar uten grenser + dyp AI-analyse", detail: "Overvåk så mange konkurrenter du vil. AI leser deres innhold, estimerer trafikken og sjekker om ChatGPT/Gemini/Perplexity nevner dem — så du vet nøyaktig hva du må gjøre for å gå forbi." },
        { text: "Månedlig strategirapport på 10+ sider", detail: "Grundig AI-generert analyse med GEO-konkurrentanalyse, vekststrategi og konkrete neste steg." },
        { text: "4-timers support på hverdager", detail: "Raskeste svartid vi tilbyr — svar innen 4 timer, mot 24 timer i Standard." }
      ]
    }
  ];

  return (
    <section id="priser" className="py-16 sm:py-24 md:py-32 bg-slate-50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-5 relative z-10">

        <RevealOnScroll direction="up">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-950 mb-4 sm:mb-6">Velg din <span className="text-violet-600">vekstplan</span></h2>
            <p className="text-base sm:text-lg md:text-xl text-slate-600 max-w-2xl mx-auto px-2">Ingen skjulte kostnader. Ingen bindingstid. Trykk på <HelpCircle size={14} className="inline text-slate-400 -mt-0.5" /> for å se detaljer.</p>
          </div>
        </RevealOnScroll>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-start">
          {plans.map((plan, i) => (
            <RevealOnScroll key={i} direction="up" delay={i * 100}>
              <div className={`relative bg-white rounded-3xl sm:rounded-[32px] p-6 sm:p-8 md:p-10 shadow-xl transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-2 border ${plan.highlighted ? 'border-violet-500 shadow-violet-200/50 md:scale-105 z-10' : 'border-slate-100'}`}>

                <div className="absolute -top-3 -right-2 sm:-top-4 sm:-right-4 bg-violet-600 text-white text-[10px] sm:text-xs font-black px-2.5 py-1 sm:px-3 rounded-full shadow-lg shadow-violet-200 z-50 border-2 border-white transform rotate-12 whitespace-nowrap">
                  70% RABATT 1. MND
                </div>

                {plan.highlighted && (
                  <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-3 sm:px-4 py-1 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wide shadow-lg whitespace-nowrap">
                    Mest valgt
                  </div>
                )}

                <h3 className="text-xl sm:text-2xl font-bold text-slate-950 mb-2 mt-2 sm:mt-0">{plan.title}</h3>
                <p className="text-violet-600 text-xs sm:text-sm font-bold mb-3 sm:mb-4 uppercase tracking-wider">{plan.tagline}</p>

                <div className="flex items-baseline gap-1 mb-3 sm:mb-4">
                  <span className="text-3xl sm:text-4xl font-black text-slate-950">{plan.price},-</span>
                  <span className="text-slate-500 font-medium text-sm sm:text-base">/mnd</span>
                </div>
                <p className="text-sm sm:text-base text-slate-600 mb-6 sm:mb-8 leading-relaxed">{plan.desc}</p>

                <ul className="space-y-3 mb-6 sm:mb-8">
                  {plan.features.map((feat, j) => {
                    const detailKey = `${i}-${j}`;
                    const isOpen = openDetail === detailKey;
                    return (
                      <li key={j} className="text-slate-700">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 shrink-0">
                            <Check size={12} strokeWidth={3} />
                          </div>
                          <span className="text-sm font-medium flex-1">{feat.text}</span>
                          {feat.detail && (
                            <button
                              type="button"
                              onClick={() => setOpenDetail(isOpen ? null : detailKey)}
                              aria-label={isOpen ? "Skjul detaljer" : "Vis detaljer"}
                              className={`mt-0.5 shrink-0 transition-colors ${isOpen ? 'text-violet-600' : 'text-slate-300 hover:text-violet-500'}`}
                            >
                              <HelpCircle size={14} />
                            </button>
                          )}
                        </div>
                        {isOpen && feat.detail && (
                          <div className="mt-2 ml-8 p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-600 leading-relaxed">
                            {feat.detail}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {/* HER ER RETTELSEN: Vi sender 'plan.title' opp til Appen */}
                <button
                  onClick={() => onSelectPlan(plan.title)}
                  className={`w-full py-3.5 sm:py-4 rounded-xl font-bold text-sm sm:text-base ui-motion transition-[background-color,color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${plan.highlighted
                    ? 'bg-slate-950 text-white [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-600 shadow-lg [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-violet-200'
                    : 'bg-slate-100 text-slate-950 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-slate-200'
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
            <div key={i} className="border border-slate-100 rounded-[24px] sm:rounded-[32px] overflow-hidden group [@media(hover:hover)_and_(pointer:fine)]:hover:border-violet-100 transition-[border-color,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full p-6 sm:p-8 flex items-center justify-between text-left [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-slate-50/50 transition-[background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.99]"
              >
                <span className="text-base sm:text-xl font-bold text-slate-950 pr-6 sm:pr-8 leading-snug">{faq.q}</span>
                <ChevronDown className={`shrink-0 transition-transform duration-[280ms] ease-[cubic-bezier(0.77,0,0.175,1)] size-5 ${open === i ? 'rotate-180' : ''}`} />
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
  // --- Total varighet: ~55 sekunder, deretter auto-redirect til portal ---
  const TOTAL_DURATION_MS = 55_000;
  const STEP_COUNT = 4;

  // Hvert steg har egen varighet (summeres til TOTAL_DURATION_MS)
  const steps = [
    { icon: Key,      label: 'Kobler til Google Search Console', detail: 'Henter 16 måneder med søkeord- og klikkdata',     duration: 12000 },
    { icon: Activity, label: 'Kjører teknisk helsesjekk',         detail: 'Core Web Vitals, mobil, SSL, ødelagte lenker',  duration: 15000 },
    { icon: Radar,    label: 'Scanner konkurrenter',              detail: 'Finner hvem som ranker i din nisje',             duration: 14000 },
    { icon: Sparkles, label: 'Klargjør AI-innsikt & dashboard',   detail: 'Genererer første anbefalinger',                 duration: 14000 },
  ];

  const [overallProgress, setOverallProgress] = useState(0); // 0–100
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      setElapsedMs(elapsed);

      const pct = Math.min(100, (elapsed / TOTAL_DURATION_MS) * 100);
      setOverallProgress(pct);

      // Regn ut hvilket steg vi er på
      let cumulative = 0;
      let step = 0;
      for (let i = 0; i < steps.length; i++) {
        cumulative += steps[i].duration;
        if (elapsed < cumulative) { step = i; break; }
        step = i + 1;
      }
      setCurrentStep(Math.min(step, steps.length));

      if (elapsed >= TOTAL_DURATION_MS) {
        clearInterval(interval);
        // Gi en kort pust før vi bytter til portalen
        setTimeout(() => onBackHome(), 400);
      }
    };
    const interval = setInterval(tick, 150);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remainingSeconds = Math.max(0, Math.ceil((TOTAL_DURATION_MS - elapsedMs) / 1000));

  return (
    <section className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Bakgrunnseffekter */}
      <div className="absolute inset-0 grid-pattern opacity-[0.03] pointer-events-none"></div>
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-violet-500/5 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-2xl w-full bg-white rounded-[32px] shadow-2xl border border-slate-100 overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-300">

        {/* Toppstripe — fylles opp i takt med hovedprogressjonen */}
        <div className="h-1.5 bg-slate-100 relative overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 via-indigo-500 to-emerald-500 transition-[width] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]"
            style={{ width: `${overallProgress}%` }}
          />
        </div>

        <div className="p-8 sm:p-12 text-center">

          {/* Pulserende ikon som skifter med aktivt steg */}
          <div className="mx-auto w-24 h-24 bg-violet-50 rounded-full flex items-center justify-center mb-6 relative">
            <div className="absolute inset-0 bg-violet-100 rounded-full animate-ping opacity-30"></div>
            <div className="absolute inset-2 bg-white rounded-full"></div>
            {currentStep < steps.length ? (
              (() => {
                const StepIcon = steps[currentStep].icon;
                return <StepIcon className="w-10 h-10 text-violet-600 relative z-10 animate-pulse" />;
              })()
            ) : (
              <CheckCircle2 className="w-12 h-12 text-emerald-500 relative z-10" />
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mb-3">
            {currentStep < steps.length ? 'Setter opp Sikt for deg' : 'Alt er klart!'}
          </h1>
          <p className="text-slate-500 text-base sm:text-lg mb-2 leading-relaxed">
            {currentStep < steps.length
              ? steps[currentStep].detail
              : 'Åpner dashboardet ditt...'}
          </p>

          {/* Nedtelling + prosent */}
          <div className="flex items-center justify-center gap-4 mb-8 text-sm">
            <span className="text-slate-400 font-mono">
              {currentStep < steps.length
                ? `~${remainingSeconds}s igjen`
                : 'Ferdig'}
            </span>
            <span className="w-1 h-1 bg-slate-300 rounded-full" />
            <span className="text-violet-600 font-black">{Math.round(overallProgress)}%</span>
          </div>

          {/* Stor progress-bar */}
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-10 relative">
            <div
              className="h-full bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-500 rounded-full transition-[width,background-position] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] bg-[length:200%_100%]"
              style={{ width: `${overallProgress}%`, backgroundPosition: `${overallProgress * 2}% 0` }}
            />
          </div>

          {/* Steg-liste */}
          <div className="bg-slate-50 rounded-2xl p-6 text-left border border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-5">Sikt jobber i bakgrunnen</h3>

            <div className="space-y-4 relative">
              <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-slate-200"></div>

              {steps.map((step, i) => {
                const StepIcon = step.icon;
                const isDone = currentStep > i;
                const isActive = currentStep === i;
                const isPending = currentStep < i;

                return (
                  <div key={i} className="flex gap-4 items-center relative z-10">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shadow-sm ring-4 ring-slate-50 shrink-0 transition-[background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]
                      ${isDone ? 'bg-emerald-500' : isActive ? 'bg-white border-2 border-violet-600' : 'bg-slate-200 border-2 border-white'}
                    `}>
                      {isDone ? (
                        <Check size={13} className="text-white" />
                      ) : isActive ? (
                        <div className="w-2 h-2 bg-violet-600 rounded-full animate-pulse" />
                      ) : (
                        <StepIcon size={11} className="text-slate-400" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className={`text-sm font-bold transition-colors
                        ${isDone ? 'text-slate-400 line-through decoration-slate-300' : isActive ? 'text-slate-900' : 'text-slate-400'}
                      `}>
                        {step.label}
                      </span>
                      {isActive && (
                        <span className="text-xs text-violet-600 font-medium animate-pulse mt-0.5">Jobber nå...</span>
                      )}
                      {isPending && (
                        <span className="text-xs text-slate-400 mt-0.5">Venter</span>
                      )}
                      {isDone && (
                        <span className="text-xs text-emerald-600 font-medium mt-0.5">Ferdig</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-6">
            Du blir automatisk sendt til dashboardet når alt er klart.
          </p>

        </div>
      </div>
    </section>
  );
};



// --- VIEWS ---

const HomeView = ({ onNavigate, onSelectPlan }: { onNavigate: (view: string) => void, onSelectPlan: (plan?: string) => void }) => (
  <>
    <Hero />
    <DashboardPreview />
    <StoryBrandOneLiner />
    <PainPointsSection />
    <ValuePropositionSection />
    {/* "Er dette for min bransje?" — self-identification etter "Hvorfor Sikt" */}
    <IndustriesSection />
    {/* Her er endringen: Vi sender onSelectPlan videre til StepPlanSection også */}
    <StepPlanSection onNavigate={onNavigate} onSelectPlan={onSelectPlan} />
    <InsightSection />
    <TrustSection />
    {/* GEO-seksjon: peak-end — siste wow-argument før pris */}
    <GeoShiftSection onSelectPlan={onSelectPlan as (plan: string) => void} />
    <Pricing onSelectPlan={onSelectPlan} />
    <FAQSection />
    {/* Final CTA: fanger opp besøkere som scrollet helt ned */}
    <FinalCTASection onSelectPlan={onSelectPlan} />
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
            <div className="flex items-center gap-4 sm:gap-6 p-6 sm:p-8 bg-white/60 backdrop-blur-sm rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm ui-motion ui-lift-sm relative overflow-hidden group [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-md">
              {point.subIcon}
              <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-rose-50 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-rose-500 transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] shrink-0 relative z-10">
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
      question: "Jeg skjønner ikke SEO. Må jeg lære det?",
      answer: "Nei. Det er hele poenget med Sikt. Vi tar oss av det tekniske og oversetter det til plain norsk i en månedlig rapport. Du trenger ikke vite hva en \"meta-description\" er — du trenger bare å vite at flere kunder finner deg. Hvis du lurer på noe, kan du spørre Sikt AI direkte på dashboardet og få svar som en 10-åring kan forstå."
    },
    {
      question: "Hvor lang tid tar det før jeg ser resultater?",
      answer: "Du ser forbedringer på det tekniske (hastighet, feilmeldinger, sidescore) allerede første uken. Flere besøkende på nettsiden merker du vanligvis etter 2–3 måneder. Topposisjoner på Google tar 6–12 måneder — det er ikke noen som kan love det raskere uten å lyve. Vi gir deg ærlige tall hver måned så du ser at det går riktig vei."
    },
    {
      question: "Hva skjer hvis det ikke fungerer?",
      answer: "Ingen bindingstid. Du kan si opp når som helst. Men vi har aldri hatt en kunde som ikke har sett forbedring i løpet av tre måneder — fordi første måned handler om å fikse åpenbare ting mange har oversett: treg side, ødelagte lenker, manglende tekst. Det er alltid noe å hente."
    },
    {
      question: "Hva er det med ChatGPT? Må jeg bry meg om det?",
      answer: "Ja, hvis du vil ha kunder om 2–3 år. I dag googler folk. I morgen spør de ChatGPT, Gemini og Perplexity. Disse AI-ene gir ett svar, ikke 10 lenker — så hvis de ikke nevner deg, er du borte. Det er dette vi kaller GEO, og det er inkludert i Premium-pakken. Du er tidlig ute — de fleste norske bedrifter tenker ikke på dette ennå."
    },
    {
      question: "Hvorfor skal jeg velge dere i stedet for et vanlig SEO-byrå?",
      answer: "Vanlige byråer sender deg månedsrapporter full av grafer og begreper du ikke forstår. Du aner ikke hva du betaler for. Sikt forteller deg hva vi har gjort, hva som har skjedd med bedriften din, og hva vi fokuserer på neste måned — på norsk du faktisk leser. I tillegg har du tilgang til et AI-dashboard 24/7 som svarer på spørsmålene dine med én gang."
    },
    {
      question: "Er det tekniske vanskelig å sette opp?",
      answer: "Nei. Vi trenger tilgang til Google Search Console og Google Analytics — to gratis verktøy de fleste bedrifter allerede har. Hvis du ikke har det, setter vi det opp for deg på 10 minutter. Etter det trenger du ikke gjøre noe selv. Vi overvåker og jobber i bakgrunnen."
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
                <span>Det du lurer på</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-slate-950 mb-6 leading-tight tracking-tight">
                Spørsmål vi <br className="hidden lg:block" /> faktisk får.
              </h2>
              <p className="text-slate-500 font-medium text-sm sm:text-lg leading-relaxed mb-8 max-w-md">
                Ærlige svar på det folk lurer på før de prøver Sikt. Ingen salgssnakk.
              </p>
              <Lightbulb className="w-32 h-32 text-violet-100 hidden lg:block opacity-50 mt-10 -ml-4" />
            </RevealOnScroll>
          </div>

          <div className="lg:col-span-8">
            <div className="space-y-3 text-left">
              {faqs.map((faq, i) => (
                <RevealOnScroll key={i} direction="up" delay={i * 50}>
                  <div
                    className={`group transition-[border-color,background-color,box-shadow] duration-[280ms] ease-[cubic-bezier(0.77,0,0.175,1)] border rounded-[20px] sm:rounded-[24px] overflow-hidden ${openIndex === i
                      ? 'bg-white border-violet-200 shadow-xl shadow-violet-500/5'
                      : 'bg-white/60 backdrop-blur-sm border-slate-100 [@media(hover:hover)_and_(pointer:fine)]:hover:border-violet-100 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white'
                      }`}
                  >
                    <button
                      onClick={() => setOpenIndex(openIndex === i ? null : i)}
                      className={`w-full p-6 sm:p-8 flex items-center justify-between text-left gap-4 transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${openIndex === i ? 'bg-violet-50/50' : ''}`}
                    >
                      <span className={`text-sm sm:text-lg font-bold transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] pr-2 sm:pr-4 ${openIndex === i ? 'text-violet-600' : 'text-slate-800'}`}>
                        {faq.question}
                      </span>
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center shrink-0 transition-[background-color,border-color,color,transform] duration-[280ms] ease-[cubic-bezier(0.77,0,0.175,1)] ${openIndex === i
                        ? 'bg-violet-600 border-violet-600 text-white shadow-lg'
                        : 'bg-slate-50 border-slate-100 text-slate-400'
                        }`}>
                        <ChevronDown size={16} className={`transition-transform duration-[280ms] ease-[cubic-bezier(0.77,0,0.175,1)] ${openIndex === i ? 'rotate-180' : 'rotate-0'}`} />
                      </div>
                    </button>
                    <div className={`transition-[max-height,opacity,padding-bottom] duration-[280ms] ease-[cubic-bezier(0.77,0,0.175,1)] overflow-hidden ${openIndex === i ? 'max-h-[500px] opacity-100 pb-6 sm:pb-8' : 'max-h-0 opacity-0'}`}>
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


// ---------------------------------------------------------
// FINAL CTA — siste sjanse før bruker forlater siden
// Psykologi: Besøkere som scroller helt ned har høy kjøpsintensjon.
//   Én stor, tydelig handling. Ingen distraksjoner.
// ---------------------------------------------------------
const FinalCTASection = ({ onSelectPlan }: { onSelectPlan?: (plan?: string) => void }) => {
  const scrollToPricing = () => {
    document.getElementById('priser')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="relative py-16 sm:py-24 md:py-36 overflow-hidden bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 text-white">
      {/* Dekorative glød-effekter */}
      <div className="absolute top-0 left-1/4 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-violet-400/20 rounded-full blur-[100px] sm:blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] bg-indigo-400/20 rounded-full blur-[100px] sm:blur-[120px] pointer-events-none"></div>
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <RevealOnScroll direction="up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-[10px] sm:text-xs font-bold mb-6 sm:mb-8 uppercase tracking-widest">
            <Sparkles size={13} />
            <span>Klar til å komme i gang?</span>
          </div>

          <h2 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight mb-4 sm:mb-6 leading-[1.1] sm:leading-[1.05]">
            Gi Sikt en måned.
            <br />
            <span className="text-violet-200">Du kan alltid si opp.</span>
          </h2>

          <p className="text-base sm:text-lg md:text-xl text-violet-100 max-w-2xl mx-auto leading-relaxed font-medium mb-8 sm:mb-12 px-2">
            Ingen bindingstid. 70% rabatt første måned. Start med Basic for 499 kr — oppgrader når du er klar.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={scrollToPricing}
              className="group ui-motion ui-lift w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 bg-white text-violet-700 rounded-full text-base sm:text-lg font-black tracking-tight flex items-center justify-center gap-3 shadow-2xl [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-50"
            >
              Se pakkene
              <ArrowRight size={20} className="transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1.5" />
            </button>
          </div>

          {/* Trygghet-punkter under CTA */}
          <div className="flex flex-wrap justify-center gap-x-4 sm:gap-x-6 gap-y-3 mt-8 sm:mt-10 text-xs sm:text-sm font-bold text-violet-100">
            <span className="flex items-center gap-2">
              <Check size={16} className="text-violet-300" /> Ingen bindingstid
            </span>
            <span className="flex items-center gap-2">
              <Check size={16} className="text-violet-300" /> Si opp når som helst
            </span>
            <span className="flex items-center gap-2">
              <Check size={16} className="text-violet-300" /> Plain norsk garantert
            </span>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
};


const velgPakke = async (pakkeNavn) => {
  try {
    // 1. Lagre valget i Supabase (hvis bruker er logget inn)
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabase
        .from('clients')
        .update({ package_name: pakkeNavn })
        .eq('user_id', user.id);
      if (error) throw error;
    }
  } catch (error: any) {
    toastWarning(error?.message || 'Kunne ikke lagre pakkevalget, men du kan fortsatt gå videre.');
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
  // "Hvorfor Sikt"-seksjon. Psykologi:
  //   - Kontrast mellom "andre byråer" og "Sikt" skaper klart valg
  //   - Tre konkrete løfter, ikke vage slagord
  //   - Plain norsk = seksjonen beviser sitt eget budskap
  const benefits = [
    {
      title: "Rapporter på norsk du faktisk leser",
      desc: "Ingen grafer med engelske forkortelser. Du får vite hva vi har gjort, hva som har skjedd med bedriften din, og hva som kommer — på plain norsk.",
      icon: <FileText className="text-violet-600" />,
      illu: <FileText className="w-12 h-12 text-violet-100/50 absolute top-4 right-4" />
    },
    {
      title: "Spør Sikt AI hva som helst",
      desc: "Ikke en anelse hva et søkeord eller en backlink er? Spør dashboardet. Du får svar som en 10-åring kan forstå på 10 sekunder.",
      icon: <Sparkles className="text-violet-600" />,
      illu: <Sparkles className="w-12 h-12 text-violet-100/50 absolute top-4 right-4" />
    },
    {
      title: "Vi måler i kunder, ikke i bounce rate",
      desc: "Du ser ekte forretningstall: hvor mange besøkende, hvor mange potensielle kunder, hvor mye omsetning. Ikke tall du må google for å forstå.",
      icon: <TrendingUp className="text-violet-600" />,
      illu: <TrendingUp className="w-12 h-12 text-violet-100/50 absolute top-4 right-4" />
    }
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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 text-violet-600 text-[10px] font-bold uppercase tracking-widest mb-6 border border-violet-100">
                <Sparkles size={11} />
                <span>Hvorfor Sikt</span>
              </div>
              <h2 className="text-2xl sm:text-4xl lg:text-6xl font-extrabold tracking-tight text-slate-950 mb-4 sm:mb-8 leading-tight">
                Andre byråer snakker tech.
                <br />
                <span className="text-violet-600">Vi snakker norsk.</span>
              </h2>
              <p className="text-sm sm:text-lg md:text-xl text-slate-600 leading-relaxed mb-8 font-medium opacity-80">
                Du driver en bedrift, ikke et IT-selskap. Sikt oversetter alt det tekniske til plain norsk — så du kan fokusere på det viktigste: kundene dine.
              </p>
              <div className="hidden lg:flex gap-4">
                <div className="w-20 h-20 bg-violet-50 rounded-2xl flex items-center justify-center text-violet-400 rotate-6 shadow-sm"><FileText size={32} /></div>
                <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-400 -rotate-3 shadow-sm mt-8"><Sparkles size={32} /></div>
                <div className="w-20 h-20 bg-fuchsia-50 rounded-2xl flex items-center justify-center text-fuchsia-400 rotate-12 shadow-sm"><TrendingUp size={32} /></div>
              </div>
            </div>
          </RevealOnScroll>
          <div className="grid grid-cols-1 gap-4 sm:gap-6 text-left">
            {benefits.map((benefit, i) => (
              <RevealOnScroll key={i} direction="right" delay={i * 100}>
                <div className="p-6 sm:p-8 rounded-[28px] sm:rounded-[36px] bg-white/80 backdrop-blur-sm border border-slate-100 ui-motion ui-lift-sm h-full flex flex-col sm:flex-row sm:items-start gap-5 relative overflow-hidden [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-xl [@media(hover:hover)_and_(pointer:fine)]:hover:border-violet-100">
                  {benefit.illu}
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 relative z-10">
                    {React.cloneElement(benefit.icon as React.ReactElement<any>, { size: 28 })}
                  </div>
                  <div className="flex-1 relative z-10">
                    <h3 className="text-base sm:text-xl font-bold text-slate-900 mb-2">{benefit.title}</h3>
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

const StepPlanSection = ({ onNavigate, onSelectPlan }: { onNavigate: (view: string) => void, onSelectPlan: (plan?: string) => void }) => {
  const steps = [
    { number: "1", title: "Velg plan", desc: "Kom i gang på sekunder.", icon: <MousePointer2 />, illu: <Layers className="w-16 h-16 absolute -bottom-4 -left-4 text-violet-50 opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-hover:rotate-12 transition-[opacity,transform] duration-[250ms] ease-[cubic-bezier(0.23,1,0.32,1)]" /> },
    { number: "2", title: "Legg til URL", desc: "Vi analyserer umiddelbart.", icon: <Globe />, illu: <Globe className="w-16 h-16 absolute -bottom-4 -left-4 text-violet-50 opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-hover:rotate-12 transition-[opacity,transform] duration-[250ms] ease-[cubic-bezier(0.23,1,0.32,1)]" /> },
    { number: "3", title: "Se veksten", desc: "Sikt optimaliserer alt.", icon: <Activity />, illu: <TrendingUp className="w-16 h-16 absolute -bottom-4 -left-4 text-violet-50 opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-hover:rotate-12 transition-[opacity,transform] duration-[250ms] ease-[cubic-bezier(0.23,1,0.32,1)]" /> }
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

                <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-[32px] sm:rounded-[44px] bg-white border border-slate-100 shadow-sm flex items-center justify-center mb-8 relative [@media(hover:hover)_and_(pointer:fine)]:group-hover:-translate-y-2 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-visible">

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

                <h3 className="text-xl sm:text-2xl font-bold text-slate-950 mb-3 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-violet-600 transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]">{step.title}</h3>
                <p className="text-sm sm:text-lg text-slate-600 font-medium leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </div>
            </RevealOnScroll>
          ))}
        </div>

        {/* KNAPPEN */}
        <div className="flex justify-center pt-6 sm:pt-8 px-4">
          <button
            onClick={() => {
              // Dette fungerer som en heis direkte ned til pris-seksjonen
              document.getElementById('priser')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="group ui-motion w-full sm:w-auto flex items-center justify-center gap-3 bg-slate-950 text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl font-bold text-base sm:text-lg shadow-xl shadow-slate-200 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-600 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-violet-200"
          >
            Ta meg til toppen av Google <ArrowRight size={20} className="transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1 shrink-0" />
          </button>
        </div>

      </div>
    </section>
  );
};

const InsightSection = () => {
  return (
    <section className="py-16 sm:py-24 md:py-32 bg-transparent relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 lg:gap-16 items-start">

          {/* Venstre side: Kontekst og emosjonell tekst */}
          <div className="lg:col-span-5 space-y-6 sm:space-y-8">
            <RevealOnScroll direction="left">
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-violet-50 text-violet-600 text-[10px] font-black uppercase tracking-widest mb-4 border border-violet-100">
                <Sparkles size={12} />
                <span>Vi forstår problemet</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-slate-950 leading-[1.15] sm:leading-[1.1] tracking-tight">
                Føles markedsføringen <span className="text-violet-600">ineffektiv?</span>
              </h2>
              <div className="space-y-4 sm:space-y-6 text-slate-600 font-medium leading-relaxed mt-6 sm:mt-8">
                <p className="text-base sm:text-lg md:text-xl text-slate-900 font-bold">
                  Du legger ned timer og kroner — men telefonen ringer ikke.
                </p>
                <p className="text-sm sm:text-base md:text-lg opacity-80">
                  Du er ikke alene, og det er ikke din feil. SEO og AI-søk har blitt et eget fag. Vi gjør jobben for deg, og viser nøyaktig hva som skjer.
                </p>
              </div>
            </RevealOnScroll>
            {/* HER VAR FEILEN - NÅ ER DEN LUKKET RIKTIG: */}
          </div>

          {/* Høyre side: Bento Grid med løsningskort */}
          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">

            {/* Kort 1: Frustrasjon (Stor) */}
            <RevealOnScroll direction="up" className="md:col-span-2">
              <div className="p-6 sm:p-8 md:p-10 bg-white border border-slate-100 rounded-3xl sm:rounded-[32px] shadow-sm ui-motion ui-lift-sm relative overflow-hidden group [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-xl">
                <div className="absolute -right-6 -bottom-6 opacity-5 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-10 [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-110 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]">
                  <HeartHandshake size={180} />
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 mb-4 sm:mb-6">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 shrink-0 shadow-inner">
                    <SearchCheck size={24} />
                  </div>
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-950">Full åpenhet, null gjetting</h3>
                </div>
                <p className="text-sm sm:text-base md:text-lg text-slate-500 font-medium leading-relaxed max-w-xl">
                  Du ser nøyaktig hva vi gjør, hvorfor, og hvilken effekt det har. Ingen svarte bokser, ingen månedsrapporter fulle av stammespråk.
                </p>
              </div>
            </RevealOnScroll>

            {/* Kort 2: AI (Liten) */}
            <RevealOnScroll direction="up" delay={100}>
              <div className="group p-6 sm:p-8 bg-indigo-50/30 border border-indigo-100/50 rounded-3xl sm:rounded-[32px] shadow-sm ui-motion ui-lift-sm relative h-full flex flex-col justify-between overflow-hidden [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-xl">
                <div className="absolute -right-4 -top-4 opacity-5 [@media(hover:hover)_and_(pointer:fine)]:group-hover:rotate-12 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]">
                  <BrainCircuit size={100} />
                </div>
                <div className="w-11 h-11 sm:w-12 sm:h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white mb-4 sm:mb-6 shadow-lg shadow-indigo-100">
                  <Cpu size={22} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-950 mb-2 sm:mb-3">Drevet av moderne AI</h3>
                  <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
                    Vi bruker banebrytende teknologi for å maksimere rekkevidden din og automatisere suksess på en måte tradisjonelle metoder ikke kan.
                  </p>
                </div>
              </div>
            </RevealOnScroll>

            {/* Kort 3: Vekst (Liten) */}
            <RevealOnScroll direction="up" delay={200}>
              <div className="group p-6 sm:p-8 bg-emerald-50/30 border border-emerald-100/50 rounded-3xl sm:rounded-[32px] shadow-sm ui-motion ui-lift-sm relative h-full flex flex-col justify-between overflow-hidden [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-xl">
                <div className="absolute -right-4 -top-4 opacity-5 [@media(hover:hover)_and_(pointer:fine)]:group-hover:-rotate-12 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]">
                  <BarChart4 size={100} />
                </div>
                <div className="w-11 h-11 sm:w-12 sm:h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white mb-4 sm:mb-6 shadow-lg shadow-emerald-100">
                  <TrendingUp size={22} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-950 mb-2 sm:mb-3">Velprøvde strategier</h3>
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
    <section className="py-16 sm:py-20 md:py-24 bg-slate-950 text-white relative overflow-hidden">
      {/* Bakgrunnseffekt */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
        <div className="absolute top-[-50%] left-[-10%] w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] rounded-full bg-violet-900 blur-[100px] sm:blur-[120px]"></div>
        <div className="absolute bottom-[-50%] right-[-10%] w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] rounded-full bg-indigo-900 blur-[80px] sm:blur-[100px]"></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-5 relative z-10 text-center">

        <div className="mb-10 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 text-xs sm:text-sm font-bold mb-6 sm:mb-8">
            <ShieldCheck size={14} />
            <span>Null risiko. Full kontroll.</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 sm:mb-6 leading-tight">
            Vår <span className="text-violet-400">Kvalitetsgaranti</span>
          </h2>
          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed px-2">
            Vi vet at du har brent deg på byråer før. Derfor har vi fjernet usikkerheten og lagt risikoen på våre skuldre, ikke dine.
          </p>
        </div>

        {/* GARANTI-GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 text-left">

          {/* Punkt 1: Økonomi (OPPDATERT MED 70% RABATT) */}
          <div className="bg-gradient-to-br from-violet-900/40 to-slate-900/40 border border-violet-500/30 p-6 sm:p-8 rounded-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 bg-violet-600 text-white text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 rounded-bl-xl">
              ØKONOMISK TRYGGHET
            </div>
            <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-white mb-4 sm:mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-violet-900/20 mt-2">
              <span className="text-xl font-black">70%</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-white">70% rabatt start</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Er du usikker på effekten? Vi gir deg 70% rabatt den første måneden. Vi tar den økonomiske risikoen for å bevise at vi leverer verdi før du betaler fullpris. Ingen bindingstid.
            </p>
          </div>

          {/* Punkt 2: Sikkerhet */}
          <div className="bg-white/5 border border-white/10 p-6 sm:p-8 rounded-3xl hover:bg-white/10 transition-colors group">
            <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-emerald-400 mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
              <ShieldCheck size={22} />
            </div>
            <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3">Din side er trygg</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Frykt ikke for nettsiden din. Vi tar alltid full backup før arbeid. Ingen endringer publiseres uten din godkjenning. Vi passer på merkevaren din.
            </p>
          </div>

          {/* Punkt 3: Kvalitet */}
          <div className="bg-white/5 border border-white/10 p-6 sm:p-8 rounded-3xl hover:bg-white/10 transition-colors group">
            <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-blue-400 mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
              <User size={22} />
            </div>
            <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3">Ekte eksperter</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Ingen automatiserte søppel-rapporter. En rådgiver analyserer din bedrift manuelt og legger en konkret slagplan for å slå dine konkurrenter.
            </p>
          </div>

          {/* Punkt 4: Arbeidsmengde (Med Zap i stedet for Coffee for å unngå feil) */}
          <div className="bg-white/5 border border-white/10 p-6 sm:p-8 rounded-3xl hover:bg-white/10 transition-colors group">
            <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-amber-400 mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
              <Zap size={22} />
            </div>
            <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3">Vi gjør jobben</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Slipp å lære deg SEO. Vi tar det tunge tekniske løftet. Din eneste oppgave er å si "ja" eller "nei" til våre forslag.
            </p>
          </div>

          {/* Punkt 5: Fremtiden */}
          <div className="md:col-span-2 bg-white/5 border border-white/10 p-6 sm:p-8 rounded-3xl hover:bg-white/10 transition-colors group relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
              <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-rose-400 shrink-0 group-hover:scale-110 transition-transform">
                <TrendingUp size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3">Hva skjer på toppen?</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-3 sm:mb-4">
                  Når vi når 1. plassen, er ikke jobben over. Da velger du veien videre:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-slate-900/50 p-3 sm:p-4 rounded-xl border border-white/5">
                    <strong className="text-white block text-sm mb-1">A) Forsvar</strong>
                    <span className="text-xs text-slate-500">Vi overvåker og nøytraliserer konkurrenter som prøver å ta plassen din.</span>
                  </div>
                  <div className="bg-slate-900/50 p-3 sm:p-4 rounded-xl border border-white/5">
                    <strong className="text-white block text-sm mb-1">B) Dominans</strong>
                    <span className="text-xs text-slate-500">Vi bruker tilliten Google nå har til deg for å vinne enda flere lønnsomme søkeord.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Call to Action i bunnen av garantien */}
        <div className="mt-10 sm:mt-16">
          <button
            onClick={handleLogin}
            className="w-full sm:w-auto bg-white text-slate-950 px-6 sm:px-8 py-3.5 sm:py-4 rounded-full font-bold text-base sm:text-lg ui-motion shadow-lg shadow-white/10 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-200"
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
          className="ui-motion ui-lift px-10 py-4 sm:px-12 sm:py-5 bg-slate-950 text-white rounded-full text-base sm:text-lg font-black tracking-tight shadow-xl [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-600"
        >
          Ta meg til toppen av Google
        </button>
      </RevealOnScroll>
    </div>
  </section>
);

// ---------------------------------------------------------
// LEGAL PAGES — Personvern & Vilkår
// Delt layout-komponent så de to sidene ser like ut
// ---------------------------------------------------------
const LegalPage = ({ title, lastUpdated, onBack, children }: {
  title: string;
  lastUpdated: string;
  onBack: () => void;
  children: React.ReactNode;
}) => (
  <section className="min-h-screen bg-white pt-32 pb-24 sm:pt-40 sm:pb-32">
    <div className="max-w-3xl mx-auto px-5 sm:px-6">
      <button
        onClick={onBack}
        className="ui-motion inline-flex items-center gap-2 text-sm font-bold text-slate-500 mb-10 rounded-lg px-1 py-0.5 -ml-1 [@media(hover:hover)_and_(pointer:fine)]:hover:text-violet-600"
      >
        <ArrowLeft size={16} />
        Tilbake til forsiden
      </button>

      <div className="mb-12">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-950 tracking-tight mb-4 leading-tight">
          {title}
        </h1>
        <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">
          Sist oppdatert: {lastUpdated}
        </p>
      </div>

      <div className="prose-legal space-y-8 text-slate-700 leading-relaxed">
        {children}
      </div>

      <div className="mt-16 pt-10 border-t border-slate-100 text-sm text-slate-500">
        <p className="mb-2">
          Har du spørsmål? Kontakt oss på{" "}
          <a href="mailto:siktseo@gmail.com" className="text-violet-600 font-bold hover:underline">
            siktseo@gmail.com
          </a>
        </p>
      </div>
    </div>

    <style dangerouslySetInnerHTML={{ __html: `
      .prose-legal h2 {
        font-size: 1.5rem;
        font-weight: 900;
        color: rgb(2 6 23);
        margin-top: 2.5rem;
        margin-bottom: 1rem;
        letter-spacing: -0.025em;
      }
      .prose-legal h3 {
        font-size: 1.125rem;
        font-weight: 800;
        color: rgb(15 23 42);
        margin-top: 1.5rem;
        margin-bottom: 0.5rem;
      }
      .prose-legal p { margin-bottom: 1rem; font-size: 0.95rem; }
      .prose-legal ul { list-style: disc; padding-left: 1.5rem; margin-bottom: 1rem; }
      .prose-legal ul li { margin-bottom: 0.5rem; font-size: 0.95rem; }
      .prose-legal strong { color: rgb(15 23 42); font-weight: 700; }
      .prose-legal a { color: rgb(124 58 237); font-weight: 600; }
      .prose-legal a:hover { text-decoration: underline; }
    `}} />
  </section>
);


const PrivacyPage = ({ onBack }: { onBack: () => void }) => (
  <LegalPage title="Personvern" lastUpdated="20. april 2026" onBack={onBack}>
    <p>
      Sikt Technologies AS ("vi", "oss", "Sikt") respekterer personvernet ditt. Denne erklæringen forklarer på plain norsk hvilke opplysninger vi samler inn, hvordan vi bruker dem, og hvilke rettigheter du har.
    </p>

    <h2>1. Hvem er behandlingsansvarlig?</h2>
    <p>
      Sikt Technologies AS er behandlingsansvarlig for personopplysningene vi samler inn om deg.
      Kontakt: <a href="mailto:siktseo@gmail.com">siktseo@gmail.com</a>
    </p>

    <h2>2. Hvilke opplysninger samler vi inn?</h2>

    <h3>Opplysninger du gir oss</h3>
    <ul>
      <li><strong>Konto-informasjon:</strong> navn, e-post og passord når du registrerer deg.</li>
      <li><strong>Bedriftsinformasjon:</strong> nettsideadresse, bransje og informasjon du oppgir i onboarding-skjemaet.</li>
      <li><strong>Betalingsinformasjon:</strong> håndteres av Stripe — vi lagrer aldri kortdetaljer selv.</li>
    </ul>

    <h3>Opplysninger vi henter automatisk</h3>
    <ul>
      <li><strong>Google Search Console-data:</strong> hvis du kobler til kontoen din, henter vi søkestatistikk om nettsiden din (søkeord, klikk, visninger).</li>
      <li><strong>Google Analytics-data:</strong> trafikk- og besøkendedata fra din egen nettside (ikke fra siktseo.no).</li>
      <li><strong>Teknisk data:</strong> IP-adresse, nettleser, og tidspunkt for besøk — brukes til sikkerhet og feilsøking.</li>
    </ul>

    <h2>3. Hvorfor behandler vi opplysningene?</h2>
    <ul>
      <li>For å levere tjenesten du har betalt for (analyser, rapporter, anbefalinger).</li>
      <li>For å sende viktige meldinger om kontoen og tjenesten din.</li>
      <li>For å forbedre produktet (anonymisert statistikk).</li>
      <li>For å oppfylle rettslige krav (regnskap, skatt).</li>
    </ul>

    <h2>4. Hvem deler vi data med?</h2>
    <p>Vi selger aldri data. Vi deler kun med tredjeparter som er nødvendige for å drive tjenesten:</p>
    <ul>
      <li><strong>Supabase</strong> — lagring av konto og data (servere i EU).</li>
      <li><strong>Stripe</strong> — betalingshåndtering.</li>
      <li><strong>Google</strong> — gjennom deres offisielle API-er (Search Console, Analytics, PageSpeed).</li>
      <li><strong>OpenAI / Google AI</strong> — AI-analyser og Sikt AI-funksjoner. Data sendes anonymisert så langt det er mulig.</li>
    </ul>

    <h2>5. Hvor lenge lagrer vi data?</h2>
    <p>
      Vi lagrer kontodata så lenge du er aktiv kunde. Hvis du sier opp, sletter vi konto og data innen 90 dager — med unntak av det vi må oppbevare etter norsk regnskapslov (typisk 5 år for fakturaer).
    </p>

    <h2>6. Dine rettigheter (GDPR)</h2>
    <p>Du har rett til å:</p>
    <ul>
      <li>Få innsyn i hvilke opplysninger vi har om deg.</li>
      <li>Få korrigert feil informasjon.</li>
      <li>Få slettet opplysningene dine ("retten til å bli glemt").</li>
      <li>Få utlevert en kopi av dine data (dataportabilitet).</li>
      <li>Klage til <a href="https://www.datatilsynet.no" target="_blank" rel="noopener">Datatilsynet</a> hvis du mener vi behandler data feil.</li>
    </ul>
    <p>
      Send oss en e-post på <a href="mailto:siktseo@gmail.com">siktseo@gmail.com</a> så ordner vi det innen 5 dager.
    </p>

    <h2>7. Sikkerhet</h2>
    <p>
      Vi bruker kryptering (HTTPS/TLS) for all dataoverføring. Passord lagres som hash (aldri i klartekst). Tilgang til databasen er begrenset til sertifisert personell, og vi har rutiner for varsling ved sikkerhetshendelser.
    </p>

    <h2>8. Cookies</h2>
    <p>
      Vi bruker kun nødvendige cookies for innlogging og økthåndtering. Vi bruker ikke sporings-cookies for reklame. Du kan deaktivere cookies i nettleseren din, men da kan du ikke logge inn på tjenesten.
    </p>

    <h2>9. Endringer</h2>
    <p>
      Vi oppdaterer denne erklæringen når tjenesten endrer seg. Vesentlige endringer varsles på e-post minst 30 dager i forveien.
    </p>
  </LegalPage>
);


const TermsPage = ({ onBack }: { onBack: () => void }) => (
  <LegalPage title="Vilkår for bruk" lastUpdated="20. april 2026" onBack={onBack}>
    <p>
      Disse vilkårene gjelder mellom deg som kunde ("du") og Sikt Technologies AS ("Sikt", "vi"). Ved å registrere deg og betale for tjenesten, godtar du vilkårene.
    </p>

    <h2>1. Tjenesten</h2>
    <p>
      Sikt leverer SEO-analyser, AI-drevne anbefalinger og rapporter for din nettside. Tjenesten leveres som et abonnement med tre pakker: Basic, Standard og Premium. Innholdet i hver pakke er beskrevet på <a href="/">siktseo.no</a> og kan endres med 30 dagers forhåndsvarsel.
    </p>

    <h2>2. Konto og ansvar</h2>
    <ul>
      <li>Du må oppgi korrekte opplysninger ved registrering.</li>
      <li>Du er selv ansvarlig for å holde passordet ditt hemmelig.</li>
      <li>Du kan ikke bruke tjenesten til ulovlige formål eller til å skade andres nettsider.</li>
      <li>Du må eie eller ha tillatelse til å analysere den nettsiden du legger inn.</li>
    </ul>

    <h2>3. Priser og betaling</h2>
    <ul>
      <li>Alle priser er oppgitt i norske kroner (NOK) og eksklusive MVA.</li>
      <li>Betaling skjer månedlig via Stripe. Kort belastes automatisk den samme datoen hver måned.</li>
      <li>Første måned gis med 70% rabatt som introduksjonstilbud.</li>
      <li>Vi kan justere priser med 30 dagers varsel. Du kan alltid si opp før en prisjustering trer i kraft.</li>
    </ul>

    <h2>4. Oppsigelse og refusjon</h2>
    <ul>
      <li><strong>Ingen bindingstid.</strong> Du kan si opp når som helst fra dashbordet.</li>
      <li>Oppsigelsen gjelder fra neste betalingsperiode — du beholder tilgang ut den måneden du har betalt for.</li>
      <li>Vi refunderer ikke allerede betalte måneder, men du kan bruke tjenesten ut perioden.</li>
      <li>Ved tekniske feil på vår side som gjør tjenesten uten verdi en hel måned, refunderer vi den måneden.</li>
    </ul>

    <h2>5. Immaterielle rettigheter</h2>
    <p>
      Rapporter, analyser og anbefalinger vi lager for deg tilhører deg — du kan bruke dem fritt til å forbedre din egen nettside. Sikt beholder eierskapet til selve plattformen, AI-modellene og tilknyttet teknologi.
    </p>

    <h2>6. Ansvarsbegrensning</h2>
    <p>
      Sikt leverer analyse, anbefalinger og verktøy — vi kan ikke garantere spesifikke resultater på Google. Rangering avhenger av mange faktorer utenfor vår kontroll (konkurranse, algoritmeendringer, din egen implementering).
    </p>
    <p>
      Vårt totale erstatningsansvar begrenses til det du har betalt i de siste 12 måneder. Vi er ikke ansvarlige for indirekte tap, tapt omsetning eller følgeskader.
    </p>

    <h2>7. Endringer i vilkårene</h2>
    <p>
      Vi kan oppdatere disse vilkårene. Vesentlige endringer varsles på e-post minst 30 dager i forveien. Hvis du ikke godtar endringene, kan du si opp før de trer i kraft.
    </p>

    <h2>8. Tvisteløsning og lovvalg</h2>
    <p>
      Disse vilkårene er underlagt norsk lov. Hvis vi ikke klarer å løse en uenighet minnelig, skal saken avgjøres av Oslo tingrett som verneting.
    </p>

    <h2>9. Kontakt</h2>
    <p>
      Spørsmål om vilkårene? Send en e-post til <a href="mailto:siktseo@gmail.com">siktseo@gmail.com</a>.
    </p>
  </LegalPage>
);


const Footer = ({ onNavigate }: { onNavigate?: (view: string) => void }) => (
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
          <div className="flex items-center justify-center md:justify-start gap-3 text-slate-400 transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] cursor-pointer [@media(hover:hover)_and_(pointer:fine)]:hover:text-white">
            <Mail size={16} className="text-violet-500" />
            <span className="font-bold text-xs">siktseo@gmail.com</span>
          </div>
        </div>
        <div className="text-center md:text-left">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-6 sm:mb-8">Selskap</h4>
          <ul className="space-y-3 sm:space-y-4 text-slate-400 font-bold text-sm">
            <li><a href="#" className="transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-violet-400">Om Sikt</a></li>
            <li><a href="#" className="transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-violet-400">Tjenester</a></li>
          </ul>
        </div>
        <div className="text-center md:text-left">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-6 sm:mb-8">Kontakt</h4>
          <div className="flex justify-center md:justify-start gap-4 text-slate-400">
            <Linkedin size={20} className="cursor-pointer transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-violet-400" />
            <Twitter size={20} className="cursor-pointer transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-violet-400" />
          </div>
        </div>
      </div>
      <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-600 text-center">
        <p>© 2026 SIKT TECHNOLOGIES AS. NORSK DESIGN.</p>
        <div className="flex gap-6 sm:gap-10">
          <button
            type="button"
            onClick={() => {
              onNavigate?.('privacy');
              window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
            }}
            className="transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] uppercase tracking-widest [@media(hover:hover)_and_(pointer:fine)]:hover:text-white active:text-white/90"
          >
            Personvern
          </button>
          <button
            type="button"
            onClick={() => {
              onNavigate?.('terms');
              window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
            }}
            className="transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] uppercase tracking-widest [@media(hover:hover)_and_(pointer:fine)]:hover:text-white active:text-white/90"
          >
            Vilkår
          </button>
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
    <nav className={`fixed top-0 left-0 right-0 z-50 navbar-shell-t ${isScrolled || isMobileMenuOpen ? 'bg-white/80 backdrop-blur-md border-b border-slate-100 py-3 sm:py-4 shadow-sm' : 'bg-transparent py-5 sm:py-8'}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex justify-between items-center">

        {/* LOGO */}
        <div className="flex items-center gap-2 sm:gap-3 cursor-pointer group" onClick={() => onNavigate('home')}>
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-violet-600 transition-[background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]">S</div>
          <span className="text-lg sm:text-xl font-black text-slate-900 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-violet-600 transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]">Sikt</span>
        </div>

        {/* DESKTOP MENY */}
        <div className="hidden md:flex items-center gap-8">

          {/* Dashboard-knapp (KUN FOR BETALENDE KUNDER MED TILGANG) */}
          {user && hasAccess && (
            <button
              onClick={() => onNavigate('dashboard')}
              className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-full transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${currentView === 'dashboard' ? 'bg-violet-100 text-violet-700' : 'text-slate-600 [@media(hover:hover)_and_(pointer:fine)]:hover:text-violet-600 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-slate-50'}`}
            >
              <BarChart3 size={18} />
              Dashboard
            </button>
          )}

          <button onClick={() => onNavigate('deepdive')} className={`text-sm font-bold transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${currentView === 'deepdive' ? 'text-violet-600' : 'text-slate-500 [@media(hover:hover)_and_(pointer:fine)]:hover:text-slate-900'}`}>Bli synlig på google</button>
          <button onClick={() => onNavigate('technology')} className={`text-sm font-bold transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${currentView === 'technology' ? 'text-violet-600' : 'text-slate-500 [@media(hover:hover)_and_(pointer:fine)]:hover:text-slate-900'}`}>Teknologien</button>

          {user ? (
            <div className="relative">
              {/* Profilbilde-knapp */}
              <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-2 focus:outline-none">
                <img src={getAvatarUrl(user)} className="w-9 h-9 rounded-full border-2 border-white shadow-sm" alt="" />
                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${isProfileOpen ? 'rotate-180' : ''}`} />
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
                      <button onClick={() => { onNavigate('dashboard'); setIsProfileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-600 transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] text-left [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-50 [@media(hover:hover)_and_(pointer:fine)]:hover:text-violet-600 active:bg-violet-50/80">
                        <BarChart3 size={16} /> Gå til Dashboard
                      </button>
                    )}

                    <button onClick={() => { onNavigate('profile'); setIsProfileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-600 transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] text-left [@media(hover:hover)_and_(pointer:fine)]:hover:bg-slate-50 [@media(hover:hover)_and_(pointer:fine)]:hover:text-violet-600 active:bg-slate-50/80">
                      <Settings size={16} /> Innstillinger
                    </button>

                    <button onClick={() => { onNavigate('billing'); setIsProfileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-600 transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] text-left [@media(hover:hover)_and_(pointer:fine)]:hover:bg-slate-50 [@media(hover:hover)_and_(pointer:fine)]:hover:text-violet-600 active:bg-slate-50/80">
                      <CreditCard size={16} /> Abonnement
                    </button>

                    <div className="my-1 border-b border-slate-50"></div>

                    <button onClick={() => { onLogout(); setIsProfileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-rose-500 transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] text-left [@media(hover:hover)_and_(pointer:fine)]:hover:bg-rose-50 active:bg-rose-50/80">
                      <LogOut size={16} /> Logg ut
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button onClick={onLoginTrigger} className="ui-motion bg-slate-900 text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-slate-200 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-600">Kom i gang</button>
          )}
        </div>

        {/* MOBIL MENY KNAPP */}
        <button className="md:hidden p-2 -mr-2 text-slate-900" aria-label={isMobileMenuOpen ? "Lukk meny" : "Åpne meny"} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>{isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}</button>
      </div>

      {/* MOBIL MENY (Expandable) */}
      {isMobileMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-white border-b border-slate-100 p-6 flex flex-col gap-4 shadow-xl md:hidden animate-in slide-in-from-top-5 duration-200">
          {user && hasAccess && (
            <button onClick={() => { onNavigate('dashboard'); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 text-lg font-bold text-violet-700 bg-violet-50 p-3 rounded-xl">
              <BarChart3 size={20} /> Dashboard
            </button>
          )}
          <button onClick={() => { onNavigate('deepdive'); setIsMobileMenuOpen(false); }} className="text-left font-bold text-slate-600 p-2 rounded-xl transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-slate-50 [@media(hover:hover)_and_(pointer:fine)]:hover:text-slate-900">Bli synlig på google</button>
          <button onClick={() => { onNavigate('technology'); setIsMobileMenuOpen(false); }} className="text-left font-bold text-slate-600 p-2 rounded-xl transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-slate-50 [@media(hover:hover)_and_(pointer:fine)]:hover:text-slate-900">Teknologien</button>
          {user && (
            <button onClick={() => { onLogout(); setIsMobileMenuOpen(false); }} className="text-left font-bold text-rose-500 p-2 flex items-center gap-2"><LogOut size={16} /> Logg ut</button>
          )}
          {!user && (
            <button onClick={() => { onLoginTrigger(); setIsMobileMenuOpen(false); }} className="bg-slate-900 text-white py-3 rounded-xl font-bold ui-motion [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-600">Kom i gang</button>
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
    toastSuccess("Nettadresse oppdatert! Den er nå låst for fremtidige endringer.");
  };

  return (
    <div className="pt-32 pb-20 px-6 max-w-5xl mx-auto min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-[280ms]">
      <button onClick={onBack} className="mb-8 ui-motion text-sm font-bold text-slate-400 flex items-center gap-2 rounded-lg px-1 py-0.5 -ml-1 [@media(hover:hover)_and_(pointer:fine)]:hover:text-slate-900">
        <ArrowRight className="rotate-180" size={16} /> Tilbake
      </button>

      <h1 className="text-3xl font-black mb-10 text-slate-900">Innstillinger</h1>

      <div className="flex flex-col md:flex-row gap-8">
        {/* MENY SIDEBAR */}
        <div className="w-full md:w-64 flex flex-col gap-2">
          <button onClick={() => setActiveTab('general')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] ${activeTab === 'general' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-slate-50'}`}>
            <User size={18} /> Profil & Bedrift
          </button>
          <button onClick={() => setActiveTab('billing')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] ${activeTab === 'billing' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-slate-50'}`}>
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
                <button onClick={() => toastInfo("Funksjonalitet for sletting kommer.")} className="flex items-center gap-2 text-rose-600 font-bold bg-white px-4 py-2 rounded-lg border border-rose-200 ui-motion [@media(hover:hover)_and_(pointer:fine)]:hover:bg-rose-100">
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
                  <button className="bg-white text-slate-900 px-6 py-2.5 rounded-lg font-bold text-sm ui-motion mt-4 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-50">Endre plan</button>
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
  const [email, setEmail] = useState('');
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      const cleanUrl = typeof window !== 'undefined' ? window.location.origin : '';

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: cleanUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
    } catch (error: any) {
      toastError('Kunne ikke logge inn med Google: ' + error.message);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toastError('Skriv inn en gyldig e-postadresse.');
      return;
    }

    setMagicLinkLoading(true);
    try {
      const cleanUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: cleanUrl,
        },
      });
      if (error) throw error;
      setMagicLinkSent(true);
      toastSuccess('Sjekk e-posten din for innloggings-lenke.');
    } catch (error: any) {
      toastError('Kunne ikke sende lenke: ' + (error?.message || 'ukjent feil'));
    } finally {
      setMagicLinkLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfd] flex flex-col items-center justify-center p-4 relative overflow-hidden">

      <div className="absolute inset-0 grid-pattern opacity-[0.04] pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-100/40 blur-[100px] rounded-full pointer-events-none animate-pulse"></div>

      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white/50 p-8 sm:p-12 relative z-10 text-center animate-in fade-in zoom-in-95 duration-[280ms]">

        <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-slate-200 rotate-3 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:rotate-6">
          <Sparkles className="text-white w-8 h-8" />
        </div>

        <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Velkommen</h2>
        <p className="text-slate-500 font-medium mb-8 leading-relaxed">
          Logg inn for å få tilgang til analysen din.
        </p>

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 font-bold py-4 px-6 rounded-xl ui-motion transition-[border-color,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-sm group [@media(hover:hover)_and_(pointer:fine)]:hover:border-violet-200 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-50 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-md"
        >
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

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-slate-200"></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">eller</span>
          <div className="flex-1 h-px bg-slate-200"></div>
        </div>

        {magicLinkSent ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-left">
            <div className="flex items-center gap-3 mb-2">
              <Mail size={18} className="text-emerald-600" />
              <p className="text-sm font-bold text-emerald-900">Lenke sendt</p>
            </div>
            <p className="text-xs text-emerald-800 leading-relaxed">
              Vi sendte en innloggings-lenke til <strong>{email}</strong>. Åpne e-posten på samme enhet for å logge inn.
            </p>
            <button
              onClick={() => { setMagicLinkSent(false); setEmail(''); }}
              className="mt-3 text-xs font-bold text-emerald-700 hover:text-emerald-900 underline"
            >
              Prøv en annen e-post
            </button>
          </div>
        ) : (
          <form onSubmit={handleMagicLink} className="space-y-3 text-left">
            <label className="text-xs font-bold text-slate-500 block">Logg inn med e-post (uten passord)</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="din@bedrift.no"
              className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-600 focus:border-transparent outline-none text-sm"
              disabled={magicLinkLoading}
            />
            <button
              type="submit"
              disabled={magicLinkLoading || !email.trim()}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl ui-motion transition-[background-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-sm enabled:hover:bg-slate-800 enabled:hover:shadow-md"
            >
              {magicLinkLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Sender lenke…
                </>
              ) : (
                <>
                  <Mail size={16} /> Send innloggings-lenke
                </>
              )}
            </button>
            <p className="text-[10px] text-slate-400 text-center pt-1">
              Vi sender en engangs-lenke til e-posten din. Ingen passord å huske på.
            </p>
          </form>
        )}

        <button
          onClick={onBack}
          className="mt-8 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center gap-2 mx-auto"
        >
          <ArrowLeft size={16} /> Gå tilbake til forsiden
        </button>

      </div>

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
// =====================================================================
// PORTAL UI BUILDING BLOCKS
// =====================================================================
// Felles, profesjonelle byggeklosser brukt av den redesignede ClientPortal.
// Holdt minimale (én aksent-farge, ingen gradient/blur, sentence-case labels).
// =====================================================================

type PortalTheme = 'light' | 'dark';

const portalCardClass = (theme: PortalTheme) =>
  theme === 'light'
    ? 'bg-white border border-slate-200 rounded-2xl'
    : 'bg-slate-900 border border-white/10 rounded-2xl';

const portalTextMainClass = (theme: PortalTheme) =>
  theme === 'light' ? 'text-slate-900' : 'text-white';

const portalTextDimClass = (theme: PortalTheme) =>
  theme === 'light' ? 'text-slate-600' : 'text-slate-400';

const portalTextLabelClass = (theme: PortalTheme) =>
  theme === 'light' ? 'text-slate-500' : 'text-slate-500';

const portalDividerClass = (theme: PortalTheme) =>
  theme === 'light' ? 'border-slate-200' : 'border-white/10';

const portalSubtleBgClass = (theme: PortalTheme) =>
  theme === 'light' ? 'bg-slate-50' : 'bg-slate-950/40';

// PortalCard — én konsistent kort-stil. Erstatter dagens fire-fem varianter.
const PortalCard: React.FC<{
  theme: PortalTheme;
  className?: string;
  children: React.ReactNode;
}> = ({ theme, className = '', children }) => (
  <section className={`${portalCardClass(theme)} ${className}`}>{children}</section>
);

// CardHeader — overskrift + valgfri handling. Sentence case, ikke uppercase.
const CardHeader: React.FC<{
  theme: PortalTheme;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: 'violet' | 'emerald' | 'amber' | 'rose' | 'sky' | 'slate';
}> = ({ theme, title, subtitle, action, icon, accent = 'violet' }) => {
  const isLight = theme === 'light';
  const accentBg: Record<string, string> = isLight
    ? {
        violet: 'bg-violet-50 text-violet-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        amber: 'bg-amber-50 text-amber-600',
        rose: 'bg-rose-50 text-rose-600',
        sky: 'bg-sky-50 text-sky-600',
        slate: 'bg-slate-100 text-slate-600',
      }
    : {
        violet: 'bg-violet-500/15 text-violet-300',
        emerald: 'bg-emerald-500/15 text-emerald-300',
        amber: 'bg-amber-500/15 text-amber-300',
        rose: 'bg-rose-500/15 text-rose-300',
        sky: 'bg-sky-500/15 text-sky-300',
        slate: 'bg-white/10 text-slate-300',
      };
  return (
    <header className="flex items-start justify-between gap-4 mb-5">
      <div className="min-w-0 flex items-start gap-3">
        {icon && (
          <span className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${accentBg[accent]}`}>
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className={`text-base font-semibold tracking-tight ${portalTextMainClass(theme)}`}>{title}</h3>
          {subtitle && <p className={`text-sm mt-1 ${portalTextDimClass(theme)}`}>{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
};

// BigNumber — store, profesjonelle tall (semibold, ikke black).
const BigNumber: React.FC<{
  theme: PortalTheme;
  value: React.ReactNode;
  unit?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}> = ({ theme, value, unit, tone = 'neutral' }) => {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-600'
      : tone === 'warn'
        ? 'text-amber-600'
        : tone === 'bad'
          ? 'text-rose-600'
          : portalTextMainClass(theme);
  return (
    <div className="flex items-baseline gap-2">
      <span className={`text-4xl font-semibold tracking-tight ${toneClass}`}>{value}</span>
      {unit && <span className={`text-sm ${portalTextDimClass(theme)}`}>{unit}</span>}
    </div>
  );
};

// PrimaryButton — én primær CTA-stil. Brukes til hovedhandlinger.
const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: 'md' | 'lg';
}> = ({ className = '', size = 'md', children, ...rest }) => {
  const sizeClass = size === 'lg' ? 'px-6 py-3 text-sm' : 'px-4 py-2.5 text-sm';
  return (
    <button
      {...rest}
      className={`${sizeClass} rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium transition-colors inline-flex items-center justify-center gap-2 ${className}`}
    >
      {children}
    </button>
  );
};

// SecondaryButton — diskré sekundær handling.
const SecondaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {
  theme: PortalTheme;
}> = ({ theme, className = '', children, ...rest }) => (
  <button
    {...rest}
    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors inline-flex items-center justify-center gap-2 ${
      theme === 'light'
        ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
        : 'bg-slate-800 border border-white/10 text-slate-200 hover:bg-slate-700'
    } ${className}`}
  >
    {children}
  </button>
);

// TierTeaser — diskré "Lås opp i Standard/Premium"-linje. Erstatter LockedSection.
// Aldri full-card overlay; bare én linje med klar invitasjon nederst i et kort.
const TierTeaser: React.FC<{
  theme: PortalTheme;
  tier: 'Standard' | 'Premium';
  price: string;
  message: string;
  onUpgrade: (targetPlan?: 'Basic' | 'Standard' | 'Premium') => void;
}> = ({ theme, tier, price, message, onUpgrade }) => (
  <div
    className={`rounded-xl px-4 py-3 flex items-center gap-3 ${
      theme === 'light'
        ? 'bg-violet-50 border border-violet-100'
        : 'bg-violet-500/10 border border-violet-500/20'
    }`}
  >
    <Sparkles size={16} className="text-violet-600 shrink-0" />
    <p className={`flex-1 text-sm ${portalTextDimClass(theme)} min-w-0`}>
      <span className={`font-medium ${portalTextMainClass(theme)}`}>{message}</span>
      <span className="hidden sm:inline">{' '}— {tier} {price}/mnd.</span>
    </p>
    <button
      type="button"
      onClick={() => onUpgrade(tier)}
      className="text-sm font-medium text-violet-600 hover:text-violet-500 shrink-0"
    >
      Lås opp →
    </button>
  </div>
);

const HoverTooltip: React.FC<{ text: string }> = ({ text }) => (
  <div className="relative group inline-flex">
    <Info className="w-4 h-4 text-gray-400 cursor-help" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
      {text}
    </div>
  </div>
);

const InlineLoading: React.FC<{ text: string; theme: PortalTheme; className?: string }> = ({ text, theme, className = '' }) => (
  <div className={`py-8 flex items-center justify-center gap-3 ${className}`}>
    <Loader2 size={16} className="text-violet-600 animate-spin shrink-0" />
    <span className={`text-sm ${portalTextDimClass(theme)}`}>{text}</span>
  </div>
);

const EmptyState: React.FC<{
  theme: PortalTheme;
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ theme, icon, title, description, action }) => (
  <div className={`rounded-xl px-5 py-10 text-center ${portalSubtleBgClass(theme)}`}>
    {icon && <div className="mb-4 flex justify-center text-slate-400">{icon}</div>}
    <p className={`text-sm font-medium ${portalTextMainClass(theme)} mb-1`}>{title}</p>
    <p className={`text-sm ${portalTextDimClass(theme)} max-w-md mx-auto`}>{description}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
);

const scoreStatus = (score: number | null) => {
  if (score == null) return { label: 'Ikke målt', shortLabel: 'Mangler data', color: '#64748b', textClass: 'text-slate-500' };
  if (score >= 80) return { label: 'Sterk score', shortLabel: 'Bra', color: '#10b981', textClass: 'text-emerald-600' };
  if (score >= 60) return { label: 'God, men kan løftes', shortLabel: 'OK', color: '#f59e0b', textClass: 'text-amber-600' };
  return { label: 'Trenger forbedring', shortLabel: 'Svak', color: '#f43f5e', textClass: 'text-rose-600' };
};

const dedupeSiktActions = (rows: any[]) => {
  const seen = new Set<string>();
  return rows.filter((row: any) => {
    const ts = new Date(row.created_at).getTime();
    const minuteBucket = Number.isFinite(ts) ? Math.floor(ts / 60000) : 0;
    const key = [
      row.action_type || row.action || '',
      row.category || '',
      row.title || '',
      row.page_url || '',
      minuteBucket,
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Sparkline — bittesmå linjer for trend-data (score-historikk, klikk-trend osv.).
// Bruker Recharts med ingen aksene/grid for et minimalistisk uttrykk.
const Sparkline: React.FC<{
  data: number[];
  color?: string; // tailwind text-* eller hex
  height?: number;
  fill?: boolean;
}> = ({ data, color = '#7c3aed', height = 32, fill = true }) => {
  if (!data || data.length < 2) {
    return <div className="text-xs text-slate-400">—</div>;
  }
  const points = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.75}
            fill={fill ? `url(#spark-${color.replace('#', '')})` : 'none'}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// RadialScore — donut-stil maaler 0-100 med farge basert paa score.
// Brukes til total-score paa Hjem og PageSpeed.
const RadialScore: React.FC<{
  value: number | null;
  size?: number;
  theme: PortalTheme;
}> = ({ value, size = 96, theme }) => {
  const hasValue = value != null;
  const v = hasValue ? Math.max(0, Math.min(100, value)) : 0;
  const meta = scoreStatus(hasValue ? v : null);
  const color = meta.color;
  const trackColor = theme === 'light' ? '#f1f5f9' : '#1e293b';
  const data = [{ name: 'score', value: v, fill: color }];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="72%"
          outerRadius="100%"
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <RadialBar
            background={{ fill: trackColor }}
            dataKey="value"
            cornerRadius={6}
            isAnimationActive={false}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xl font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
          {hasValue ? Math.round(v) : '—'}
        </span>
        <span className={`text-[10px] ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>/ 100</span>
        <span className={`text-[10px] font-medium mt-0.5 ${meta.textClass}`}>{meta.shortLabel}</span>
      </div>
    </div>
  );
};

// KpiTile — liten KPI-rute med subtil fargeaksent. Brukes paa Hjem.
const KpiTile: React.FC<{
  theme: PortalTheme;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tooltip?: string;
  accent?: 'violet' | 'emerald' | 'amber' | 'rose' | 'slate';
  spark?: number[];
  icon?: React.ReactNode;
}> = ({ theme, label, value, hint, tooltip, accent = 'slate', spark, icon }) => {
  const isLight = theme === 'light';
  const accentColors: Record<string, { ring: string; dot: string; spark: string; iconBg: string; iconFg: string }> = {
    violet: { ring: 'border-violet-200', dot: 'bg-violet-500', spark: '#7c3aed', iconBg: isLight ? 'bg-violet-50' : 'bg-violet-500/10', iconFg: 'text-violet-600' },
    emerald: { ring: 'border-emerald-200', dot: 'bg-emerald-500', spark: '#10b981', iconBg: isLight ? 'bg-emerald-50' : 'bg-emerald-500/10', iconFg: 'text-emerald-600' },
    amber: { ring: 'border-amber-200', dot: 'bg-amber-500', spark: '#f59e0b', iconBg: isLight ? 'bg-amber-50' : 'bg-amber-500/10', iconFg: 'text-amber-600' },
    rose: { ring: 'border-rose-200', dot: 'bg-rose-500', spark: '#f43f5e', iconBg: isLight ? 'bg-rose-50' : 'bg-rose-500/10', iconFg: 'text-rose-600' },
    slate: { ring: isLight ? 'border-slate-200' : 'border-white/10', dot: 'bg-slate-400', spark: '#64748b', iconBg: isLight ? 'bg-slate-50' : 'bg-slate-800', iconFg: 'text-slate-500' },
  };
  const c = accentColors[accent];
  return (
    <div className={`rounded-xl border ${isLight ? 'bg-white' : 'bg-slate-900/40'} ${c.ring} p-4 flex flex-col gap-2 min-w-0`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <span className={`shrink-0 w-7 h-7 rounded-lg ${c.iconBg} ${c.iconFg} flex items-center justify-center`}>
              {icon}
            </span>
          )}
          <span className={`text-xs font-medium uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'} truncate`}>
            {label}
          </span>
          {tooltip && <HoverTooltip text={tooltip} />}
        </div>
      </div>
      <div className={`text-2xl font-semibold ${isLight ? 'text-slate-900' : 'text-white'} leading-none`}>
        {value}
      </div>
      {hint && (
        <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          {hint}
        </div>
      )}
      {spark && spark.length >= 2 && (
        <div className="-mb-1">
          <Sparkline data={spark} color={c.spark} height={28} />
        </div>
      )}
    </div>
  );
};

// CategoryDot — fargemerket prikk for sikt_actions-kategori i loggen.
const categoryMeta = (
  category: 'finding' | 'suggestion' | 'fix' | 'alert',
): { label: string; dot: string; bg: string; fg: string; icon: any } => {
  switch (category) {
    case 'fix':
      return { label: 'Fiks', dot: 'bg-emerald-500', bg: 'bg-emerald-50', fg: 'text-emerald-700', icon: CheckCircle2 };
    case 'suggestion':
      return { label: 'Forslag', dot: 'bg-sky-500', bg: 'bg-sky-50', fg: 'text-sky-700', icon: PenTool };
    case 'alert':
      return { label: 'Varsel', dot: 'bg-amber-500', bg: 'bg-amber-50', fg: 'text-amber-700', icon: Bell };
    default:
      return { label: 'Funn', dot: 'bg-violet-500', bg: 'bg-violet-50', fg: 'text-violet-700', icon: Search };
  }
};

// ============================================================
// KONKURRENTER — Interfaces, hook, og KonkurrenterPage
// ============================================================

interface Competitor {
  id: string;
  user_id: string;
  domain: string;
  avg_position: number | null;
  keyword_count: number;
  competitor_type: 'main' | 'local' | 'rising';
  avatar_color: string | null;
  created_at: string;
  last_scanned_at: string | null;
}

interface KeywordOpportunity {
  id: string;
  user_id: string;
  keyword: string;
  search_volume: number;
  difficulty: 'easy' | 'medium' | 'hard';
  recommendation_type: 'new_page' | 'faq' | 'expand_existing';
  recommendation_text: string;
  estimated_traffic: number;
  competitor_ids: string[];
  discovered_at: string;
  generated_at: string | null;
}

interface CompetitorKeywordRanking {
  id: string;
  competitor_id: string;
  keyword: string;
  position: number;
  url: string;
  checked_at: string;
}

// Deterministisk fargevalg basert på domenenavn
function getAvatarColor(domain: string): string {
  const palette = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#0891b2', '#be185d'];
  let hash = 0;
  for (let i = 0; i < domain.length; i++) hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function formatVolume(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return String(n);
}

/** Dekoder Supabase JWT (kun for sub / bruker-id — ikke validering). */
function getUserIdFromAccessToken(accessToken: string | null | undefined): string | null {
  if (!accessToken || typeof accessToken !== 'string') return null;
  try {
    const part = accessToken.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    const payload = JSON.parse(atob(b64 + pad));
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Samme bruker-id som JWT / scan-API: session → getUser → JWT i localStorage → ev. fallback fra props. */
async function getCompetitorScopeUserId(fallback: string | null): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) return session.user.id;
  } catch {
    /* ignore */
  }
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) return user.id;
  } catch {
    /* ignore */
  }
  const fromJwt = getUserIdFromAccessToken(getStoredAccessToken());
  if (fromJwt) return fromJwt;
  return fallback ?? null;
}

// Custom hook — henter konkurrenter + muligheter fra Supabase med real-time
function useCompetitorData(userId: string | null) {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [opportunities, setOpportunities] = useState<KeywordOpportunity[]>([]);
  const [hasSite, setHasSite] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const uid = await getCompetitorScopeUserId(userId);
    if (!uid) {
      setCompetitors([]);
      setOpportunities([]);
      setHasSite(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Tabellene er knyttet til bruker via user_id (samme som scan-competitor API).
      setHasSite(true);

      const [{ data: compRows, error: compError }, { data: oppRows, error: oppError }] = await Promise.all([
        supabase
          .from('competitors')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: true }),
        supabase
          .from('keyword_opportunities')
          .select('*')
          .eq('user_id', uid)
          .order('estimated_traffic', { ascending: false }),
      ]);

      if (compError) throw compError;
      if (oppError) throw oppError;

      setCompetitors(compRows || []);
      setOpportunities(oppRows || []);
    } catch (e: any) {
      setError(e?.message || 'Ukjent feil');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      await fetchData();
      const uid = await getCompetitorScopeUserId(userId);
      if (cancelled || !uid) return;
      channel = supabase
        .channel(`competitors-rt-${uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'competitors', filter: `user_id=eq.${uid}` }, fetchData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'keyword_opportunities', filter: `user_id=eq.${uid}` }, fetchData)
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, fetchData]);

  return { competitors, opportunities, hasSite, loading, error, refetch: fetchData };
}

// ============================================================
// KonkurrenterPage
// ============================================================

// Relative-time helper (Norwegian) — used only inside KonkurrenterPage
function kpTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Nå';
  if (m < 60) return `${m} min siden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}t siden`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'I går';
  if (d < 7) return `${d} dager siden`;
  return new Date(dateStr).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}

// ─── GEO / AI-SYNLIGHET PAGE ────────────────────────────────────────────────
const GeoPage: React.FC<{ onNotify: () => void }> = ({ onNotify }) => {
  const G = {
    bg:     '#F5F5F0',
    card:   '#FFFFFF',
    ink:    '#1A1A1A',
    green:  '#52A447',
    muted:  '#808080',
    border: '#EBEBE6',
  } as const;
  const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const pressD = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'scale(0.97)'; };
  const pressU = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'scale(1)'; };

  const [geoPrompt, setGeoPrompt] = useState('');
  const suggestions = [
    'Hvilken regnskapsfører bør jeg bruke i Bergen?',
    'Beste elektriker i Oslo for varmepumpe',
    'Anbefal en rørlegger i Trondheim sentrum',
  ];
  const openAI = (url: string) => {
    const q = geoPrompt.trim();
    window.open(q ? `${url}?q=${encodeURIComponent(q)}` : url, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── HERO: split ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* Left: editorial text */}
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: G.muted, margin: 0 }}>
              GEO · Generative Engine Optimization
            </p>
            <span style={{ fontSize: 10, fontWeight: 700, background: G.green, color: '#fff', borderRadius: 100, padding: '2px 8px', letterSpacing: '0.06em' }}>
              Beta
            </span>
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 3.5vw, 48px)', fontWeight: 900, lineHeight: 1.08, color: G.ink, margin: '0 0 20px', letterSpacing: '-0.02em' }}>
            Når kundene spør AI-en,{' '}
            <em style={{ fontStyle: 'italic', color: G.muted, fontWeight: 800 }}>blir du nevnt?</em>
          </h1>
          <p style={{ fontSize: 15, color: G.muted, lineHeight: 1.65, margin: '0 0 28px', maxWidth: 420 }}>
            Småbedrifter sjekker fortsatt hvordan de rangerer på Google. Men nordmenn
            flytter spørsmålene sine til ChatGPT, Perplexity og Gemini. Sikt hjelper deg
            med å se hvordan bedriften din omtales i svarene.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => { document.getElementById('geo-tester')?.scrollIntoView({ behavior: 'smooth' }); }}
              style={{ background: G.ink, color: '#fff', border: 'none', borderRadius: 11, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, transition: `transform 160ms ${EASE}` }}
              onMouseDown={pressD} onMouseUp={pressU} onMouseLeave={pressU}
            >
              Start en test <ChevronRight size={15} />
            </button>
            <button
              onClick={() => { document.getElementById('geo-veikartet')?.scrollIntoView({ behavior: 'smooth' }); }}
              style={{ background: 'none', color: G.muted, border: `1px solid ${G.border}`, borderRadius: 11, padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: `all 160ms ${EASE}` }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = G.ink; e.currentTarget.style.color = G.ink; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = G.border; e.currentTarget.style.color = G.muted; }}
            >
              Slik fungerer GEO
            </button>
          </div>
        </div>

        {/* Right: stat cards 2×2 */}
        <div style={{ flex: '0 0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: 'min(360px, 100%)' }}>
          {/* Card 1 – dark */}
          <div style={{ background: G.ink, borderRadius: 14, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', margin: 0 }}>Av nordmenn</p>
            <p style={{ fontSize: 42, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1 }}>95%</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.45 }}>bruker ChatGPT til å finne lokale bedrifter</p>
          </div>
          {/* Card 2 – white */}
          <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: G.muted, margin: 0 }}>Brukere</p>
            <p style={{ fontSize: 42, fontWeight: 900, color: G.ink, margin: 0, lineHeight: 1 }}>200M</p>
            <p style={{ fontSize: 11, color: G.muted, margin: 0, lineHeight: 1.45 }}>bruker ChatGPT månedlig — og spør om alt</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 18, marginTop: 4 }}>
              {[40, 55, 45, 65, 58, 72, 80, 88, 95].map((h, i) => (
                <div key={i} style={{ flex: 1, background: G.green, borderRadius: 2, height: `${h}%`, opacity: 0.7 + i * 0.033 }} />
              ))}
            </div>
          </div>
          {/* Card 3 – white */}
          <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: G.muted, margin: 0 }}>Perplexity</p>
              <TrendingUp size={13} style={{ color: G.green }} />
            </div>
            <p style={{ fontSize: 13, fontWeight: 700, color: G.ink, margin: 0, lineHeight: 1.4 }}>erstatter Google-søket for mange profesjonelle</p>
            <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 14, marginTop: 4 }}>
              {[30, 50, 42, 60, 55, 68, 75].map((h, i) => (
                <div key={i} style={{ flex: 1, background: G.border, borderRadius: 2, height: `${h}%` }} />
              ))}
            </div>
          </div>
          {/* Card 4 – white */}
          <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: G.muted, margin: 0 }}>Gemini</p>
              <ExternalLink size={12} style={{ color: G.border }} />
            </div>
            <p style={{ fontSize: 13, fontWeight: 700, color: G.ink, margin: 0, lineHeight: 1.4 }}>er integrert direkte i Chrome — alle norske brukere</p>
            <p style={{ fontSize: 10, color: G.muted, margin: '4px 0 0' }}>Brukes automatisk ved søk</p>
          </div>
        </div>
      </div>

      {/* ── PROMPT TESTER ──────────────────────────────────────────── */}
      <div id="geo-tester" style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 16, padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: G.muted, margin: 0 }}>Test en prompt</p>
          <span style={{ fontSize: 10, fontWeight: 600, background: G.bg, border: `1px solid ${G.border}`, borderRadius: 100, padding: '2px 10px', color: G.muted }}>
            Manuell — ingen automatikk ennå
          </span>
        </div>

        {/* Input row */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <div
            style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 10, background: G.bg, border: `1px solid ${G.border}`, borderRadius: 12, padding: '12px 16px', transition: `border-color 150ms ${EASE}` }}
            onFocusCapture={e => (e.currentTarget.style.borderColor = G.ink)}
            onBlurCapture={e => (e.currentTarget.style.borderColor = G.border)}
          >
            <Search size={15} style={{ color: G.muted, flexShrink: 0 }} />
            <input
              type="text"
              value={geoPrompt}
              onChange={e => setGeoPrompt(e.target.value)}
              placeholder="Hvilken regnskapsfører bør jeg bruke i Bergen?"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: G.ink, caretColor: G.ink }}
            />
          </div>
          <button
            onClick={() => openAI('https://chatgpt.com')}
            style={{ background: G.ink, color: '#fff', border: 'none', borderRadius: 11, padding: '12px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', transition: `transform 160ms ${EASE}`, flexShrink: 0 }}
            onMouseDown={pressD} onMouseUp={pressU} onMouseLeave={pressU}
          >
            <ExternalLink size={13} /> Åpne i ChatGPT
          </button>
        </div>

        {/* Secondary: Perplexity */}
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => openAI('https://www.perplexity.ai/search')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: G.muted, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 0', transition: `color 150ms ${EASE}` }}
            onMouseEnter={e => (e.currentTarget.style.color = G.ink)}
            onMouseLeave={e => (e.currentTarget.style.color = G.muted)}
          >
            <ExternalLink size={12} /> Åpne i Perplexity
          </button>
        </div>

        {/* Suggestion chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => setGeoPrompt(s)}
              style={{ background: G.bg, border: `1px solid ${G.border}`, borderRadius: 100, padding: '6px 14px', fontSize: 12, color: G.muted, cursor: 'pointer', transition: `all 150ms ${EASE}` }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = G.ink; e.currentTarget.style.color = G.ink; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = G.border; e.currentTarget.style.color = G.muted; }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── WARNING BANNER ─────────────────────────────────────────── */}
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <AlertTriangle size={16} style={{ color: '#C07B00', flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#C07B00', margin: '0 0 2px' }}>
            Du må sjekke manuelt om bedriften din nevnes
          </p>
          <p style={{ fontSize: 12, color: G.muted, margin: 0 }}>
            Automatisk sporing kommer snart. Test promptene under for hånd inntil videre.
          </p>
        </div>
      </div>

      {/* ── VEIKARTET / ROADMAP ────────────────────────────────────── */}
      <div id="geo-veikartet">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: G.muted, margin: 0 }}>
            På veikartet
          </p>
          <span style={{ fontSize: 11, fontWeight: 600, color: G.muted, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Lock size={11} /> Kommer Q3 2026
          </span>
        </div>
        <h2 style={{ fontSize: 'clamp(22px, 2.5vw, 34px)', fontWeight: 900, color: G.ink, margin: '0 0 20px', letterSpacing: '-0.01em' }}>
          Det vi snart automatiserer for deg.
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {([
            {
              num: '01',
              title: 'Daglig sporing av 50+ relevante prompts',
              badge: 'Under utvikling',
              green: true,
              desc: 'Vi spør ChatGPT, Perplexity og Gemini hver natt om de samme spørsmålene en kunde ville stilt. Du får varsel hvis du dukker opp — eller blir borte.',
            },
            {
              num: '02',
              title: 'Automatisk GEO-sporing',
              badge: 'Lansering Q3 2026',
              green: false,
              desc: 'Posisjon, sitater og kontekst — på samme måte som Google Search Console, bare for AI-svar.',
            },
          ] as const).map(item => (
            <div key={item.num} style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 16, padding: '22px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <span style={{ fontSize: 28, fontWeight: 900, color: G.border, letterSpacing: '-0.03em', lineHeight: 1 }}>{item.num}</span>
                <span style={{ fontSize: 10, fontWeight: 700, background: item.green ? 'rgba(82,164,71,0.1)' : G.bg, color: item.green ? G.green : G.muted, border: `1px solid ${item.green ? 'rgba(82,164,71,0.2)' : G.border}`, borderRadius: 100, padding: '3px 10px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {!item.green && <Lock size={9} />}{item.badge}
                </span>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: G.ink, margin: '0 0 10px', lineHeight: 1.35 }}>{item.title}</h3>
              <p style={{ fontSize: 13, color: G.muted, margin: 0, lineHeight: 1.6 }}>{item.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            onClick={onNotify}
            style={{ background: G.ink, color: '#fff', border: 'none', borderRadius: 11, padding: '11px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, transition: `transform 160ms ${EASE}` }}
            onMouseDown={pressD} onMouseUp={pressU} onMouseLeave={pressU}
          >
            Bli varslet når det lanseres <ChevronRight size={14} />
          </button>
        </div>
      </div>

    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const KonkurrenterPage: React.FC<{
  user: any;
  theme: PortalTheme;
  hasStandardOrHigher: boolean;
  hasPremium: boolean;
  onUpgrade: (targetPlan?: 'Basic' | 'Standard' | 'Premium') => void;
}> = ({ user, theme, hasStandardOrHigher, hasPremium, onUpgrade }) => {
  // Colour tokens — always this palette regardless of theme
  const C = {
    bg:     '#F5F5F0',
    card:   '#FFFFFF',
    ink:    '#1A1A1A',
    green:  '#52A447',
    muted:  '#808080',
    border: '#EBEBE6',
  } as const;

  // Custom easing (Emil: never use default CSS easings)
  const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

  // Shared button press helpers
  const pressDown  = (e: React.MouseEvent<HTMLButtonElement>) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; };
  const pressReset = (e: React.MouseEvent<HTMLButtonElement>) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; };

  void theme; // palette is always hardcoded — theme prop kept for API compatibility

  const { competitors, opportunities, loading, error, refetch } = useCompetitorData(user?.id ?? null);
  const { changes, unreadCount, markAllRead }                    = useCompetitorChanges(user?.id, 20);

  const [showAddModal,      setShowAddModal]      = useState(false);
  const [addDomain,         setAddDomain]         = useState('');
  const [addLoading,        setAddLoading]        = useState(false);
  const [addError,          setAddError]          = useState<string | null>(null);
  const [scanningId,        setScanningId]        = useState<string | null>(null);
  const [selectedComp,      setSelectedComp]      = useState<Competitor | null>(null);
  const [compRankings,      setCompRankings]      = useState<CompetitorKeywordRanking[]>([]);
  const [rankingsLoading,   setRankingsLoading]   = useState(false);
  const [oppFilter,         setOppFilter]         = useState<'all' | 'easy' | 'high_value'>('all');
  const [generateTarget,    setGenerateTarget]    = useState<KeywordOpportunity | null>(null);
  const [generateLoading,   setGenerateLoading]   = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  const maxCompetitors = hasPremium ? 99 : 3;
  const totalTraffic = opportunities.reduce((s, o) => s + (o.estimated_traffic || 0), 0);
  const easyCount = opportunities.filter((o) => o.difficulty === 'easy').length;
  const highValueCount = opportunities.filter((o) => o.estimated_traffic > 500).length;

  const filteredOpps = opportunities.filter((o) => {
    if (oppFilter === 'easy') return o.difficulty === 'easy';
    if (oppFilter === 'high_value') return o.estimated_traffic > 500;
    return true;
  });

  const getAccessTokenForApi = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? getStoredAccessToken();
  };

  // --- Legg til konkurrent ---
  const handleAddCompetitor = async () => {
    const raw = addDomain.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
    if (!/^[a-z0-9][a-z0-9\-\.]{1,60}[a-z0-9](\.[a-z]{2,})$/i.test(raw)) {
      setAddError('Ugyldig domenenavn. Skriv f.eks. «konkurrent.no».');
      return;
    }
    if (competitors.length >= maxCompetitors) {
      setShowUpgradePrompt(true);
      return;
    }
    setAddLoading(true);
    setAddError(null);
    try {
      // 1. Lag raden i Supabase — user_id må være auth.users.id (samme som JWT). Ikke bruk bare getUser(); session/JWT er mer pålitelig i nettleseren.
      const color = getAvatarColor(raw);
      const uid = await getCompetitorScopeUserId(user?.id ?? null);
      if (!uid) {
        throw new Error('Kunne ikke hente bruker-ID. Oppdater siden og logg inn på nytt, og prøv igjen.');
      }
      const { data: newComp, error: insertError } = await supabase
        .from('competitors')
        .insert({ user_id: uid, domain: raw, avatar_color: color, competitor_type: 'main' })
        .select('*')
        .single();
      if (insertError || !newComp) throw insertError || new Error('Klarte ikke å opprette konkurrent');
      setShowAddModal(false);
      setAddDomain('');
      toastInfo(`Analyserer ${raw}… Dette tar 1–2 minutter.`);
      // 2. Kjør scan umiddelbart i bakgrunnen
      setScanningId(newComp.id);
      const token = await getAccessTokenForApi();
      if (!token) {
        toastError('Sesjon utløpt — logg inn på nytt for å skanne.');
        await refetch();
        return;
      }
      const scanRes = await fetch('/api/scan-competitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ competitor_id: newComp.id }),
      });
      const scanData = await scanRes.json().catch(() => ({}));
      if (!scanRes.ok) {
        const msg = [scanData?.error, scanData?.hint].filter(Boolean).join(' — ');
        toastError(msg || 'Scanning feilet — prøv igjen om litt.');
      } else toastSuccess(scanData?.message || `${raw} er lagt til og skannet.`);
      await refetch();
    } catch (e: any) {
      setAddError(e?.message || 'Kunne ikke legge til konkurrenten.');
    } finally {
      setAddLoading(false);
      setScanningId(null);
    }
  };

  // --- Skann på nytt ---
  const handleRescan = async (comp: Competitor) => {
    setScanningId(comp.id);
    try {
      const token = await getAccessTokenForApi();
      if (!token) {
        toastError('Sesjon utløpt — logg inn på nytt for å skanne.');
        return;
      }
      const res = await fetch('/api/scan-competitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ competitor_id: comp.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = [data?.error, data?.hint].filter(Boolean).join(' — ');
        toastError(msg || 'Scanning feilet.');
      } else toastSuccess(data?.message || 'Scanning fullført.');
      await refetch();
    } catch (e: any) {
      toastError(e?.message || 'Kunne ikke skanne konkurrenten akkurat nå.');
    } finally {
      setScanningId(null);
    }
  };

  // --- Last detaljer for valgt konkurrent ---
  const handleSelectCompetitor = useCallback(async (comp: Competitor) => {
    setSelectedComp(comp);
    setRankingsLoading(true);
    try {
      const rows = await supabaseRest<CompetitorKeywordRanking[]>(
        `competitor_keyword_rankings?competitor_id=eq.${comp.id}&select=*&order=position.asc&limit=50`,
      );
      setCompRankings(Array.isArray(rows) ? rows : []);
    } catch { setCompRankings([]); } finally { setRankingsLoading(false); }
  }, []);

  // Auto-select first competitor once data loads
  useEffect(() => {
    if (!loading && competitors.length > 0 && !selectedComp) {
      handleSelectCompetitor(competitors[0]);
    }
  }, [loading, competitors, selectedComp, handleSelectCompetitor]);

  // --- Generer side ---
  const handleGeneratePage = async () => {
    if (!generateTarget) return;
    setGenerateLoading(true);
    try {
      const token = getStoredAccessToken();
      const res = await fetch('/api/generate-page-from-keyword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ keyword_opportunity_id: generateTarget.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastError(data?.error || 'Kunne ikke generere siden.');
      } else {
        if (data?.url) toastSuccess(`Siden er publisert! ${data.url}`);
        else toastSuccess('Innholdet er generert. Publiser via din CMS-integrasjon.');
        await refetch();
      }
    } catch (e: any) {
      toastError(e?.message || 'Kunne ikke generere siden akkurat nå.');
    } finally {
      setGenerateLoading(false);
      setGenerateTarget(null);
    }
  };

  // CSV export for selected competitor rankings
  const exportCSV = () => {
    if (!compRankings.length || !selectedComp) return;
    const rows = [
      ['Søkeord', 'Posisjon', 'URL'],
      ...compRankings.map(r => [r.keyword, String(r.position), r.url || '']),
    ];
    const csv = rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${selectedComp.domain}-rangeringer.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Derived values
  const competitorMap: Record<string, string> = {};
  competitors.forEach(c => { competitorMap[c.id] = c.domain; });

  const lastScannedGlobal = competitors
    .filter(c => c.last_scanned_at)
    .sort((a, b) => new Date(b.last_scanned_at!).getTime() - new Date(a.last_scanned_at!).getTime())[0]
    ?.last_scanned_at;

  const formatScanDate = (d: string | null | undefined) => {
    if (!d) return null;
    const dt = new Date(d);
    return dt.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
      + ' · '
      + dt.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  };

  // ISO week number
  const weekNumber = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const ys = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d.getTime() - ys.getTime()) / 86400000) + 1) / 7);
  })();

  const changeConfig: Record<string, { symbol: string; positive: boolean }> = {
    new_page:      { symbol: '↑', positive: true  },
    removed_page:  { symbol: '↓', positive: false },
    new_keyword:   { symbol: '✦', positive: true  },
    rank_improved: { symbol: '↑', positive: true  },
    rank_dropped:  { symbol: '↓', positive: false },
  };

  // === BASIC — Locked state ===
  if (!hasStandardOrHigher) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 48, textAlign: 'center', maxWidth: 440 }}>
          <Lock size={28} style={{ color: C.muted, margin: '0 auto 16px', display: 'block' }} />
          <h2 style={{ color: C.ink, fontWeight: 800, fontSize: 20, margin: '0 0 8px' }}>Konkurrent-analyse er låst</h2>
          <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
            Se hvilke søkeord konkurrentene rangerer på som du mangler. Tilgjengelig i Standard og oppover.
          </p>
          <button
            onClick={() => onUpgrade('Standard')}
            style={{ background: C.ink, color: '#fff', padding: '11px 22px', borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, transition: `transform 160ms ${EASE}` }}
            onMouseDown={pressDown} onMouseUp={pressReset} onMouseLeave={pressReset}
          >
            <Sparkles size={14} /> Oppgrader til Standard
          </button>
        </div>
      </div>
    );
  }

  // === STANDARD / PREMIUM ===
  return (
    <div>
      {/* ── ACTION BAR ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, paddingBottom: 20 }}>
        {scanningId && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: C.green }}>
            <span style={{ width: 7, height: 7, background: C.green, borderRadius: '50%', display: 'inline-block' }} />
            Skanner aktiv
          </span>
        )}
        <button
          onClick={() => { if (competitors.length >= maxCompetitors) { setShowUpgradePrompt(true); return; } setShowAddModal(true); }}
          style={{ background: C.ink, color: '#fff', padding: '9px 18px', borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: 6, transition: `transform 160ms ${EASE}` }}
          onMouseDown={pressDown} onMouseUp={pressReset} onMouseLeave={pressReset}
        >
          <Plus size={14} /> Legg til konkurrent
        </button>
      </div>

      {/* ── 2-COLUMN LAYOUT ── */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* ── LEFT: MAIN ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* HERO */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.muted, margin: '0 0 14px' }}>
              Konkurrenter · Uke {weekNumber}
            </p>
            {loading ? (
              <div style={{ height: 88, display: 'flex', alignItems: 'center' }}>
                <Loader2 size={20} className="animate-spin" style={{ color: C.muted }} />
              </div>
            ) : (
              <>
                <h1 style={{ fontSize: 'clamp(24px, 3.2vw, 42px)', fontWeight: 900, lineHeight: 1.1, color: C.ink, margin: 0 }}>
                  {competitors.length} konkurrenter overvåkes.{' '}
                  <span style={{ color: C.muted }}>{opportunities.length} åpne muligheter</span>{' '}
                  ligger på bordet,
                </h1>
                <p style={{ fontSize: 'clamp(24px, 3.2vw, 42px)', fontWeight: 900, lineHeight: 1.2, color: C.green, margin: '4px 0 0' }}>
                  verdt +{formatVolume(totalTraffic)} besøk/mnd.
                </p>
              </>
            )}
          </div>

          {error && (
            <div style={{ background: '#fff0f0', border: '1px solid #ffd0d0', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#c0392b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span>{error}</span>
              <button onClick={refetch} style={{ fontWeight: 700, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>Prøv igjen</button>
            </div>
          )}

          {/* COMPETITOR TABS */}
          {!loading && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {competitors.map(c => {
                const isActive  = selectedComp?.id === c.id;
                const isScanning = scanningId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCompetitor(c)}
                    style={{
                      background: isActive ? C.ink : C.card,
                      border:     `1px solid ${isActive ? C.ink : C.border}`,
                      borderRadius: 12,
                      padding: '12px 18px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: `all 180ms ${EASE}`,
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = C.ink; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = C.border; }}
                  >
                    <p style={{ fontSize: 13, fontWeight: 700, color: isActive ? '#fff' : C.ink, margin: 0 }}>{c.domain}</p>
                    <p style={{ fontSize: 11, color: isActive ? 'rgba(255,255,255,0.55)' : C.muted, margin: '4px 0 0' }}>
                      {isScanning ? 'Analyserer…' : c.keyword_count > 0
                        ? `${c.keyword_count} søkeord · snitt #${c.avg_position ?? '?'}`
                        : 'Ikke skannet ennå'}
                    </p>
                  </button>
                );
              })}
              {competitors.length === 0 && (
                <button
                  onClick={() => setShowAddModal(true)}
                  style={{ background: C.card, border: `1px dashed ${C.border}`, borderRadius: 12, padding: '12px 18px', cursor: 'pointer', fontSize: 13, color: C.muted, fontWeight: 600 }}
                >
                  + Legg til din første konkurrent
                </button>
              )}
            </div>
          )}

          {/* SELECTED COMPETITOR DETAIL (inline) */}
          {selectedComp && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '24px 28px' }}>
              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted, margin: '0 0 4px' }}>Domene</p>
                  <h2 style={{ fontSize: 'clamp(20px, 2.2vw, 32px)', fontWeight: 900, color: C.ink, margin: 0, lineHeight: 1.1 }}>{selectedComp.domain}</h2>
                  <p style={{ fontSize: 11, color: C.muted, margin: '6px 0 0' }}>
                    {selectedComp.last_scanned_at
                      ? `Sist skannet ${new Date(selectedComp.last_scanned_at).toLocaleString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                      : 'Aldri skannet'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexShrink: 0 }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted, margin: '0 0 4px' }}>Søkeord</p>
                    <p style={{ fontSize: 38, fontWeight: 900, color: C.ink, margin: 0, lineHeight: 1 }}>{selectedComp.keyword_count || '—'}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted, margin: '0 0 4px' }}>Snitt pos.</p>
                    <p style={{ fontSize: 38, fontWeight: 900, color: C.ink, margin: 0, lineHeight: 1 }}>
                      {selectedComp.avg_position ? `#${selectedComp.avg_position}` : '—'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 2 }}>
                    <button
                      onClick={() => handleRescan(selectedComp)}
                      disabled={scanningId === selectedComp.id}
                      style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 12px', cursor: scanningId === selectedComp.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: C.ink, opacity: scanningId === selectedComp.id ? 0.5 : 1, transition: `transform 160ms ${EASE}` }}
                      onMouseDown={e => { if (!scanningId) pressDown(e); }}
                      onMouseUp={pressReset} onMouseLeave={pressReset}
                    >
                      {scanningId === selectedComp.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                      Skann
                    </button>
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Fjern ${selectedComp.domain}?`)) return;
                        try {
                          await supabase.from('competitors').delete().eq('id', selectedComp.id);
                          setSelectedComp(null); setCompRankings([]);
                          await refetch(); toastSuccess('Konkurrent fjernet.');
                        } catch (e: any) { toastError(e?.message || 'Kunne ikke fjerne.'); }
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: C.muted, padding: '7px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, transition: `color 150ms ${EASE}` }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#c0392b')}
                      onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
                    >
                      <Trash2 size={13} /> Fjern
                    </button>
                  </div>
                </div>
              </div>

              {/* Rankings */}
              <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 20, paddingTop: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: C.ink, margin: 0 }}>Rangeringer · Topp 20</p>
                  <button
                    onClick={exportCSV}
                    disabled={!compRankings.length}
                    style={{ fontSize: 11, fontWeight: 600, color: C.muted, background: 'none', border: 'none', cursor: compRankings.length ? 'pointer' : 'not-allowed', padding: '4px 8px', borderRadius: 6, transition: `color 150ms ${EASE}` }}
                    onMouseEnter={e => { if (compRankings.length) e.currentTarget.style.color = C.ink; }}
                    onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
                  >
                    Eksporter CSV
                  </button>
                </div>
                {rankingsLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px 0', justifyContent: 'center' }}>
                    <Loader2 size={16} className="animate-spin" style={{ color: C.muted }} />
                    <span style={{ fontSize: 13, color: C.muted }}>Laster rangeringer…</span>
                  </div>
                ) : compRankings.length === 0 ? (
                  <p style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '24px 0', margin: 0 }}>
                    Ingen rangeringer ennå — trykk «Skann» for å hente data.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, background: C.border, borderRadius: 10, overflow: 'hidden' }}>
                    {compRankings.slice(0, 20).map(r => (
                      <div key={r.id} style={{ background: C.card, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 900, minWidth: 32, flexShrink: 0, color: r.position <= 3 ? C.green : r.position <= 10 ? C.ink : C.muted }}>
                          #{r.position}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: C.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.keyword}</p>
                          {r.url && (
                            <a href={r.url} target="_blank" rel="noreferrer"
                              style={{ fontSize: 10, color: C.muted, textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: `color 120ms ${EASE}` }}
                              onMouseEnter={e => (e.currentTarget.style.color = C.ink)}
                              onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
                            >
                              {r.url.replace(/^https?:\/\/[^/]+/, '') || '/'}
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* OPPORTUNITIES */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.ink, margin: 0 }}>Topp søkeord-muligheter</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: C.muted }}>
                  {opportunities.length} totalt · {easyCount} lette · {highValueCount} høy verdi
                </span>
                {(['all', 'easy', 'high_value'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setOppFilter(f)}
                    style={{
                      padding: '4px 12px', borderRadius: 100, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      background: oppFilter === f ? C.ink : C.card,
                      color:      oppFilter === f ? '#fff' : C.muted,
                      border: `1px solid ${oppFilter === f ? C.ink : C.border}`,
                      transition: `all 150ms ${EASE}`,
                    }}
                  >
                    {f === 'all' ? 'Alle' : f === 'easy' ? 'Lette' : 'Høy verdi'}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 }}>
                <Loader2 size={16} className="animate-spin" style={{ color: C.muted }} />
                <span style={{ fontSize: 13, color: C.muted }}>Analyserer søkeord-gap…</span>
              </div>
            ) : filteredOpps.length === 0 ? (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 48, textAlign: 'center' }}>
                <Search size={32} style={{ color: C.border, margin: '0 auto 12px', display: 'block' }} />
                <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>
                  {opportunities.length === 0
                    ? 'Legg til eller skann konkurrenter. Søkeord-gap vises her etter neste skann.'
                    : 'Ingen treff i dette filteret.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {filteredOpps.map((opp, i) => {
                  const diffLabel = opp.difficulty === 'easy' ? 'Lett' : opp.difficulty === 'medium' ? 'Middels' : 'Vanskelig';
                  const diffDots  = opp.difficulty === 'easy' ? '●' : opp.difficulty === 'medium' ? '●●' : '●●●';
                  const diffColor = opp.difficulty === 'easy' ? C.green : opp.difficulty === 'medium' ? C.muted : C.ink;
                  const rankedBy  = (opp.competitor_ids || []).slice(0, 3).map((id: string) => competitorMap[id]).filter(Boolean);
                  return (
                    <div
                      key={opp.id}
                      style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 10, animationDelay: `${i * 45}ms` }}
                      className="sikt-stagger-item"
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 800, color: C.ink, margin: 0, lineHeight: 1.3, flex: 1 }}>{opp.keyword}</h3>
                        <span style={{ fontSize: 10, fontWeight: 700, color: diffColor, flexShrink: 0, whiteSpace: 'nowrap' }}>{diffDots} {diffLabel}</span>
                      </div>
                      {opp.recommendation_text && (
                        <p style={{ fontSize: 12, color: C.muted, margin: 0, lineHeight: 1.5 }}>{opp.recommendation_text}</p>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.muted, margin: '0 0 4px' }}>Søkevolum</p>
                          <p style={{ fontSize: 22, fontWeight: 900, color: C.ink, margin: 0, lineHeight: 1 }}>
                            {formatVolume(opp.search_volume)}<span style={{ fontSize: 11, fontWeight: 400, color: C.muted }}>/mnd</span>
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.muted, margin: '0 0 4px' }}>Potensial</p>
                          <p style={{ fontSize: 22, fontWeight: 900, color: C.green, margin: 0, lineHeight: 1 }}>
                            +{opp.estimated_traffic}<span style={{ fontSize: 11, fontWeight: 400, color: C.muted }}> besøk</span>
                          </p>
                        </div>
                      </div>
                      {rankedBy.length > 0 && (
                        <div>
                          <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.muted, margin: '0 0 6px' }}>Rangeres av</p>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {rankedBy.map((domain: string) => (
                              <span key={domain} style={{ fontSize: 10, fontWeight: 700, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 5, padding: '2px 8px', color: C.ink }}>
                                {domain}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => setGenerateTarget(opp)}
                        style={{ background: C.ink, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', transition: `transform 160ms ${EASE}` }}
                        onMouseDown={pressDown} onMouseUp={pressReset} onMouseLeave={pressReset}
                      >
                        <Sparkles size={11} /> Generer side
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {!hasPremium && competitors.length >= 3 && (
              <div style={{ marginTop: 12, padding: '14px 18px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Overvåk ubegrenset antall konkurrenter</p>
                <button
                  onClick={() => onUpgrade('Premium')}
                  style={{ background: C.ink, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: `transform 160ms ${EASE}` }}
                  onMouseDown={pressDown} onMouseUp={pressReset} onMouseLeave={pressReset}
                >
                  Premium → 4 999 kr
                </button>
              </div>
            )}
          </div>
        </div>{/* end LEFT */}

        {/* ── RIGHT: SIDEBAR ── */}
        <div style={{ width: 232, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Info card */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted, margin: '0 0 4px' }}>Plan</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: 0 }}>
                  {hasPremium ? 'Premium' : 'Standard'} · {competitors.length} av {maxCompetitors}
                </p>
              </div>
              {lastScannedGlobal && (
                <div>
                  <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted, margin: '0 0 4px' }}>Sist skannet</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: 0 }}>{formatScanDate(lastScannedGlobal)}</p>
                </div>
              )}
              <div>
                <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted, margin: '0 0 4px' }}>Nye varsler</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: unreadCount > 0 ? C.green : C.muted, margin: 0 }}>
                    {unreadCount > 0 ? `${unreadCount} uleste` : 'Ingen uleste'}
                  </p>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} style={{ fontSize: 10, fontWeight: 600, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: `color 120ms ${EASE}` }}
                      onMouseEnter={e => (e.currentTarget.style.color = C.ink)}
                      onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
                    >
                      Merk lest
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Changes feed */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, color: C.ink, margin: 0 }}>Endringer</h3>
              {unreadCount > 0 && (
                <span style={{ background: C.ink, color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 100, padding: '2px 8px' }}>
                  {unreadCount}
                </span>
              )}
            </div>
            {changes.length === 0 ? (
              <p style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: '16px 0', margin: 0 }}>Ingen endringer enda</p>
            ) : (
              <div>
                {changes.slice(0, 8).map((change, i) => {
                  const cfg = changeConfig[change.change_type] || { symbol: '●', positive: true };
                  return (
                    <div
                      key={change.id}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: i < Math.min(changes.length - 1, 7) ? `1px solid ${C.border}` : 'none', opacity: change.is_read ? 0.45 : 1, transition: `opacity 150ms ${EASE}` }}
                    >
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: cfg.positive ? 'rgba(82,164,71,0.1)' : 'rgba(26,26,26,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: cfg.positive ? C.green : C.muted }}>{cfg.symbol}</span>
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: C.ink, margin: 0, lineHeight: 1.4 }}>{change.title}</p>
                        {change.detail && (
                          <p style={{ fontSize: 10, color: C.muted, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{change.detail}</p>
                        )}
                        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.05em', color: C.muted, margin: '4px 0 0' }}>{kpTimeAgo(change.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {changes.length > 8 && (
              <button
                style={{ width: '100%', marginTop: 10, padding: '8px 0', fontSize: 11, fontWeight: 600, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', transition: `color 150ms ${EASE}` }}
                onMouseEnter={e => (e.currentTarget.style.color = C.ink)}
                onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
              >
                Vis hele historikken →
              </button>
            )}
          </div>
        </div>{/* end RIGHT */}

      </div>{/* end 2-col */}

      {/* ── MODALS ── */}

      {/* ADD COMPETITOR */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,26,26,0.45)', backdropFilter: 'blur(6px)' }} onClick={() => { setShowAddModal(false); setAddError(null); setAddDomain(''); }} />
          <div style={{ position: 'relative', background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.12)' }} className="sikt-stagger-item">
            <h3 style={{ fontSize: 17, fontWeight: 800, color: C.ink, margin: '0 0 6px' }}>Legg til konkurrent</h3>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 18px', lineHeight: 1.5 }}>Skriv inn domenenavnet uten «https://» eller «www.»</p>
            <input
              type="text" value={addDomain} onChange={e => setAddDomain(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCompetitor()}
              placeholder="konkurrent.no" autoFocus
              style={{ width: '100%', borderRadius: 10, padding: '11px 14px', fontSize: 14, border: `1px solid ${C.border}`, color: C.ink, background: C.bg, outline: 'none', boxSizing: 'border-box', marginBottom: 8, transition: `border-color 150ms ${EASE}` }}
              onFocus={e => (e.currentTarget.style.borderColor = C.ink)}
              onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
            />
            {addError && <p style={{ fontSize: 12, color: '#c0392b', margin: '0 0 12px' }}>{addError}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={handleAddCompetitor} disabled={addLoading || !addDomain.trim()}
                style={{ flex: 1, background: C.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: addLoading || !addDomain.trim() ? 'not-allowed' : 'pointer', opacity: addLoading || !addDomain.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: `transform 160ms ${EASE}` }}
                onMouseDown={e => { if (!addLoading && addDomain.trim()) pressDown(e); }}
                onMouseUp={pressReset} onMouseLeave={pressReset}
              >
                {addLoading ? <><Loader2 size={13} className="animate-spin" /> Analyserer…</> : 'Legg til og skann'}
              </button>
              <button onClick={() => { setShowAddModal(false); setAddError(null); setAddDomain(''); }}
                style={{ background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >Avbryt</button>
            </div>
          </div>
        </div>
      )}

      {/* GENERATE PAGE */}
      {generateTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,26,26,0.45)', backdropFilter: 'blur(6px)' }} onClick={() => { if (!generateLoading) setGenerateTarget(null); }} />
          <div style={{ position: 'relative', background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.12)' }} className="sikt-stagger-item">
            <h3 style={{ fontSize: 17, fontWeight: 800, color: C.ink, margin: '0 0 8px' }}>Generer side for «{generateTarget.keyword}»?</h3>
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
              <ul style={{ fontSize: 12, color: C.muted, margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                <li>✦ AI skriver SEO-optimalisert innhold på 800–1200 ord</li>
                <li>✦ Optimaliserer meta-tittel og meta-beskrivelse</li>
                {generateTarget.recommendation_type === 'faq' && <li>✦ Strukturerer som FAQ med schema markup</li>}
                <li>✦ Publiserer via din CMS-integrasjon (hvis tilkoblet)</li>
              </ul>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleGeneratePage} disabled={generateLoading}
                style={{ flex: 1, background: C.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: generateLoading ? 'not-allowed' : 'pointer', opacity: generateLoading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: `transform 160ms ${EASE}` }}
                onMouseDown={e => { if (!generateLoading) pressDown(e); }}
                onMouseUp={pressReset} onMouseLeave={pressReset}
              >
                {generateLoading ? <><Loader2 size={13} className="animate-spin" /> AI skriver…</> : <><Sparkles size={13} /> Ja, generer</>}
              </button>
              <button onClick={() => { if (!generateLoading) setGenerateTarget(null); }}
                style={{ background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >Avbryt</button>
            </div>
          </div>
        </div>
      )}

      {/* UPGRADE PROMPT */}
      {showUpgradePrompt && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,26,26,0.45)', backdropFilter: 'blur(6px)' }} onClick={() => setShowUpgradePrompt(false)} />
          <div style={{ position: 'relative', background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 32, width: '100%', maxWidth: 360, boxShadow: '0 24px 64px rgba(0,0,0,0.12)', textAlign: 'center' }} className="sikt-stagger-item">
            <div style={{ width: 48, height: 48, background: C.bg, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Sparkles size={20} style={{ color: C.ink }} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: C.ink, margin: '0 0 8px' }}>Grense nådd</h3>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 22px', lineHeight: 1.6 }}>
              Du har nådd grensen på 3 konkurrenter med Standard. Oppgrader til Premium for ubegrenset overvåkning.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowUpgradePrompt(false); onUpgrade('Premium'); }}
                style={{ flex: 1, background: C.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                onMouseDown={pressDown} onMouseUp={pressReset} onMouseLeave={pressReset}
              >Oppgrader til Premium</button>
              <button onClick={() => setShowUpgradePrompt(false)}
                style={{ background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >Lukk</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

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
  // Den redesignede portalen har 8 faner i en sidebar. Verksted er egen fane (ikke drawer).
  type PortalTab = 'home' | 'visibility' | 'keywords' | 'competitors' | 'geo' | 'workshop' | 'log' | 'settings';
  const [activeTab, setActiveTab] = useState<PortalTab>('home');
  const [loading, setLoading] = useState(true);
  const [clientData, setClientData] = useState<any>(startData);

  // Sidebar mobile-state (under 768px viser vi hamburger).
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userFooterMenuOpen, setUserFooterMenuOpen] = useState(false);
  // Sidebar desktop-collapse: skyver sidebar sammen til kun-ikoner. Persistert.
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem('sikt_sidebar_collapsed') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('sikt_sidebar_collapsed', sidebarCollapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [sidebarCollapsed]);
  useEffect(() => {
    if (sidebarCollapsed) setUserFooterMenuOpen(false);
  }, [sidebarCollapsed]);
  // Synlighet-fane har tre sub-faner (PageSpeed, Innhold, Lenker).
  const [visibilitySubTab, setVisibilitySubTab] = useState<'pagespeed' | 'content' | 'links'>('pagespeed');
  // Verksted-fane: hvilket problem som er ekspandert inline.
  const [expandedWorkshopProblem, setExpandedWorkshopProblem] = useState<string | null>(null);
  // Verksted-filter: alle / aapne / loste
  const [workshopFilter, setWorkshopFilter] = useState<'all' | 'open' | 'done'>('all');
  // Hjem: vis alle todos, ikke bare topp 3
  const [showAllTodos, setShowAllTodos] = useState(false);

  // Settings-tab: hvilken seksjon som redigeres akkurat nå (kun én om gangen).
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [showHostModal, setShowHostModal] = useState(false);
  const [hostPlatform, setHostPlatform] = useState<string>('');
  const [hostInputValue, setHostInputValue] = useState<string>('');
  const [hostSaving, setHostSaving] = useState(false);
  const [planChangeTarget, setPlanChangeTarget] = useState<{ key: string; name: string; price: string; type: 'upgrade' | 'downgrade' } | null>(null);
  const [switchingPlan, setSwitchingPlan] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({ weeklyReport: true, criticalAlerts: true, rankChanges: false });

  // Host-tilkoblings-info (fra client_hosts-tabellen). null = ikke hentet ennå eller
  // ingen rad finnes. Relevante felt: connectionMode ('light' | 'full' | 'skipped'),
  // platform, repoUrl, adminUrl, notes, lastChangedAt.
  const [hostConnection, setHostConnection] = useState<any>(null);

  // Konkurrenter: ekte domener fra dine Google-resultater (SERP), kan fjernes manuelt
  const [trackedCompetitors, setTrackedCompetitors] = useState<{ id: string; domain: string; title?: string; url?: string; serpRank: number; sourceKeyword?: string }[]>([]);
  useEffect(() => {
    if (!user?.id) return;
    try {
      const raw = localStorage.getItem(`sikt_competitors_${user.id}`);
      if (raw) setTrackedCompetitors(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [user?.id]);

  const persistCompetitors = (list: typeof trackedCompetitors) => {
    setTrackedCompetitors(list);
    if (user?.id) {
      try { localStorage.setItem(`sikt_competitors_${user.id}`, JSON.stringify(list)); } catch { /* ignore */ }
    }
  };

  const loadCompetitorsFromSerp = () => {
    const rawUrl = (formData.websiteUrl || clientData?.websiteUrl || '').trim();
    if (!rawUrl) { toastWarning('Legg inn nettside-URL under Innstillinger først.'); return; }
    const cleanDomain = rawUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
    const out: typeof trackedCompetitors = [];
    const seen = new Set<string>();
    for (const r of realRankings || []) {
      const myPos = typeof (r as any).position === 'number' ? (r as any).position : 101;
      for (const c of (r as any).competitors || []) {
        try {
          if (!c?.url) continue;
          const cp = typeof c.position === 'number' ? c.position : 999;
          if (myPos <= 100) {
            if (cp >= myPos) continue;
          } else {
            if (cp > 20) continue;
          }
          const host = new URL(c.url).hostname.replace(/^www\./i, '').toLowerCase();
          if (!host || host === cleanDomain) continue;
          if (seen.has(host)) continue;
          seen.add(host);
          out.push({
            id: host,
            domain: host,
            title: c.title,
            url: c.url,
            serpRank: cp,
            sourceKeyword: (r as any).keyword,
          });
        } catch { /* ignore */ }
      }
    }
    out.sort((a, b) => a.serpRank - b.serpRank);
    const cap = hasPremium ? 12 : hasStandardOrHigher ? 6 : 4;
    if (out.length === 0) {
      toastWarning('Ingen konkurrenter funnet. Kjør «Kjør Analyse» på søkeord-fanen først — vi henter da ekte treff fra Google.');
      return;
    }
    persistCompetitors(out.slice(0, cap));
    toastSuccess(`La til ${Math.min(out.length, cap)} konkurrenter fra søkeresultater (bedre plassering enn deg i listen).`);
  };

  const removeCompetitor = (id: string) => {
    persistCompetitors(trackedCompetitors.filter((c) => c.id !== id));
  };

  // --- GEO / AI-synlighet chat ---
  const [geoChatInput, setGeoChatInput] = useState('');
  const [geoChatLoading, setGeoChatLoading] = useState(false);
  const [geoChatReply, setGeoChatReply] = useState<string | null>(null);

  // --- UKENS KVITTERING (Sikt-handlinger) ---
  const [siktActions, setSiktActions] = useState<any[]>([]);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = denne uken, -1 = forrige, osv.
  const [receiptCategoryFilter, setReceiptCategoryFilter] = useState<'all' | 'finding' | 'suggestion' | 'fix' | 'alert'>('all');

  // --- OVERSIKT-KORT (Besøkende + Synlighet) — periode-velger paa Hjem ---
  const [overviewPeriod, setOverviewPeriod] = useState<'1M' | '2M' | '3M'>('1M');

  // --- HUKOMMELSE FOR "LØS PROBLEMET" - ARBEIDSROMMET ---
  // Brukes av WorkshopDrawer-overlayet i Hjem-fanen.
  const [activeSolveProblem, setActiveSolveProblem] = useState<any>(null);
  const [aiIsThinking, setAiIsThinking] = useState(false);
  const [aiSolution, setAiSolution] = useState<any>(null);



  // Denne funksjonen avfyres automatisk når kunden velger et problem i Verkstedet.
  // Sender webhost + URL til serveren, slik at AI kan hente HTML og finne eksakt kode
  // å fjerne/erstatte (når webhost er koblet til).
  useEffect(() => {
    const fetchAiSolution = async () => {
      if (!activeSolveProblem) return;

      setAiIsThinking(true);
      setAiSolution(null);

      try {
        const accessToken = getStoredAccessToken();
        if (!accessToken) {
          setAiSolution({
            steps: [{ title: 'Ikke innlogget', description: 'Logg inn på nytt og prøv «Gå til dybde» igjen.' }],
            codePatch: null,
          });
          return;
        }
        const response = await fetch('/api/solve-problem', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            url: formData.websiteUrl || clientData?.websiteUrl || '',
            problemTitle: activeSolveProblem.raw?.title || activeSolveProblem.title || 'Ukjent feil',
            problemDetails: activeSolveProblem,
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const msg = data?.error || data?.message || `HTTP ${response.status}`;
          setAiSolution({
            steps: [{ title: 'AI-serveren svarte med feil', description: String(msg) }],
            explanation: String(msg),
            codePatch: null,
          });
          return;
        }
        setAiSolution(data);
      } catch (error: any) {
        console.error(error);
        setAiSolution({
          steps: [{ title: 'Nettverksfeil', description: error?.message || 'Ukjent feil. Sjekk internett og at OPENAI_API_KEY er satt i Vercel.' }],
          explanation: error?.message || 'Ukjent feil',
          codePatch: null,
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
      // Dev-modus: hvis brukeren har byttet plan lokalt, overstyr package_name
      let seed = startData;
      try {
        const devPlan = typeof window !== 'undefined' ? localStorage.getItem('sikt_dev_plan') : null;
        if (devPlan) seed = { ...startData, package_name: devPlan };
      } catch { /* ignore */ }
      setClientData(seed);
      setFormData(seed);
      setLoading(false);
    }
  }, [startData]);

  // Analyse State
  const [analysisResults, setAnalysisResults] = useState<{ mobile: AnalysisResult; desktop: AnalysisResult } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('Forbereder...');

  // Historikk for teknisk score (mobil) — lagres lokalt per bruker, norsk tidsstempel i visning
  const [scoreHistory, setScoreHistory] = useState<{ at: string; mobilePerf: number; mobileSeo: number; desktopPerf: number }[]>([]);
  useEffect(() => {
    if (!user?.id) return;
    try {
      const arr = JSON.parse(localStorage.getItem(`sikt_portal_score_history_${user.id}`) || '[]');
      setScoreHistory(Array.isArray(arr) ? arr : []);
    } catch { setScoreHistory([]); }
  }, [user?.id]);

  // Markér første åpning av portalen — brukes til å vise ekstra-vennlig hilsen
  // i StatusHero ved første besøk. Ingen mørklegging av meny eller onboarding-banner.
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  useEffect(() => {
    if (!user?.id) return;
    try {
      const seenKey = `sikt_portal_first_seen_${user.id}`;
      if (localStorage.getItem(seenKey) !== '1') {
        setIsFirstVisit(true);
        localStorage.setItem(seenKey, '1');
      }
    } catch { /* ignore */ }
  }, [user?.id]);

  const [showFirstAnalysisBanner, setShowFirstAnalysisBanner] = useState(false);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const checkFirstAnalysis = async () => {
      try {
        const siteRows = await supabaseRest<any[]>(
          `sites?user_id=eq.${user.id}&select=id&limit=1`,
        );
        const site = Array.isArray(siteRows) && siteRows.length ? siteRows[0] : null;

        if (!site?.id) {
          if (!cancelled) setShowFirstAnalysisBanner(true);
          return;
        }

        const healthRows = await supabaseRest<any[]>(
          `health_checks?site_id=eq.${site.id}&select=id&limit=1`,
        );
        if (!cancelled) setShowFirstAnalysisBanner(!(Array.isArray(healthRows) && healthRows.length > 0));
      } catch {
        if (!cancelled) setShowFirstAnalysisBanner(false);
      }
    };

    checkFirstAnalysis();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!showFirstAnalysisBanner) return;
    const timer = setTimeout(() => setShowFirstAnalysisBanner(false), 60000);
    return () => clearTimeout(timer);
  }, [showFirstAnalysisBanner]);

  // Gjenopprett siste analyse fra cache (samme domene som i profilen)
  useEffect(() => {
    if (!user?.id) return;
    const urlNow = (formData.websiteUrl || clientData?.websiteUrl || '').trim();
    if (!urlNow) return;
    try {
      const raw = localStorage.getItem(`sikt_analysis_cache_${user.id}`);
      if (!raw) return;
      const { url: cachedUrl, results } = JSON.parse(raw);
      const norm = (s: string) => String(s || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '').toLowerCase();
      if (results?.mobile && results?.desktop && norm(cachedUrl) === norm(urlNow)) {
        setAnalysisResults(results);
      }
    } catch { /* ignore */ }
  }, [user?.id, formData.websiteUrl, clientData?.websiteUrl]);

  const [saving, setSaving] = useState(false);

  // SØKEORD STATE (EKTE DATA)
  const [keywordsToTrack, setKeywordsToTrack] = useState<any[]>([]);
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [realRankings, setRealRankings] = useState<any[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  // Internt brukt av data-fetching-hooks og handlers — beholdes for kompatibilitet
  // (den nye UI-en bruker realRankings, men disse settes fortsatt for fremtidig bruk).
  const [, setHasSearched] = useState(false);
  const [keywordData, setKeywordData] = useState<KeywordData[]>([]);

  // GOOGLE SEARCH CONSOLE STATE
  const [gscConnected, setGscConnected] = useState(false);
  const [gscLoading, setGscLoading] = useState(false);
  const [gscKeywords, setGscKeywords] = useState<any[]>([]);
  const [showGscPreCheck, setShowGscPreCheck] = useState(false);
  const [selectedKwId, setSelectedKwId] = useState<string | null>(null);
  const [kwFilter, setKwFilter] = useState<'all' | 'mine' | 'gsc'>('all');
  const [kwSearch, setKwSearch] = useState('');
  const [kwChartRange, setKwChartRange] = useState<'28d' | '90d' | '12mnd'>('28d');
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [scores, setScores] = useState<{ technical: number | null; visibility: number | null }>({
    technical: null,
    visibility: null,
  });
  const [scoresLoading, setScoresLoading] = useState(false);

  const getScoreColor = (score: number) => {
    if (score >= 86) return { color: 'text-green-600', label: 'Utmerket', emoji: '🟢' };
    if (score >= 71) return { color: 'text-blue-600', label: 'Bra', emoji: '✓' };
    if (score >= 51) return { color: 'text-yellow-600', label: 'Trenger forbedring', emoji: '🟡' };
    return { color: 'text-red-600', label: 'Kritisk', emoji: '🔴' };
  };

  // Sjekk om GSC allerede er koblet til
  useEffect(() => {
    const checkGscConnection = async () => {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase
          .from('api_credentials')
          .select('id')
          .eq('user_id', user.id)
          .eq('service_name', 'google_search_console')
          .maybeSingle();
        if (error) throw error;
        if (data) setGscConnected(true);
      } catch {
        setGscConnected(false);
      }
    };
    checkGscConnection();
  }, [user?.id]);

  useEffect(() => {
    const fetchScores = async () => {
      if (!user?.id) return;
      setScoresLoading(true);
      try {
        const { data: site } = await supabase
          .from('sites')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!site?.id) {
          setScores({ technical: null, visibility: null });
          return;
        }

        const { data: techCheck } = await supabase
          .from('health_checks')
          .select('technical_score')
          .eq('site_id', site.id)
          .not('technical_score', 'is', null)
          .order('checked_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: visCheck } = await supabase
          .from('health_checks')
          .select('visibility_score')
          .eq('site_id', site.id)
          .not('visibility_score', 'is', null)
          .order('checked_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        setScores({
          technical: techCheck?.technical_score ?? null,
          visibility: visCheck?.visibility_score ?? null,
        });
      } catch (err) {
        console.error('Error:', err);
        toastError('Kunne ikke hente data. Prøv igjen senere.');
      } finally {
        setScoresLoading(false);
      }
    };
    fetchScores();
  }, [user?.id]);

  // Hent GSC-søkeord fra databasen
  const handleFetchGscKeywords = async () => {
    if (!user?.id) return;
    setGscLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const { data: site } = await supabase
        .from('sites')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!site?.id) {
        toastError('Ingen nettside funnet. Kjør en PageSpeed-analyse først.');
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-search-console`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ site_id: site.id }),
        }
      );

      const result = await res.json().catch(() => ({}));

      if (result.success) {
        const { data: keywords, error: keywordsError } = await supabase
          .from('keywords')
          .select('keyword, position, clicks, impressions, ctr')
          .eq('site_id', site.id)
          .order('clicks', { ascending: false })
          .limit(50);
        if (keywordsError) throw keywordsError;

        if (keywords && keywords.length > 0) {
          setGscKeywords(keywords);
          toastSuccess(`Hentet ${keywords.length} søkeord fra Google Search Console!`);
        } else {
          toastSuccess('Tilkoblet! Ingen søkeorddata ennå — dette tar noen uker for nye nettsider.');
        }
      } else {
        toastError('Kunne ikke hente søkeorddata: ' + (result.error || 'ukjent feil'));
      }
    } catch (err: any) {
      toastError('Noe gikk galt: ' + (err?.message || 'ukjent feil'));
    } finally {
      setGscLoading(false);
    }
  };

  // Start OAuth-flyt for Google Search Console
  const handleConnectGsc = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const redirectUri = `${supabaseUrl}/functions/v1/google-oauth-callback`;
    const scope = 'https://www.googleapis.com/auth/webmasters.readonly';

    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${encodeURIComponent(user?.id || '')}`;

    window.location.href = oauthUrl;
  };

  // Håndter redirect tilbake fra Google OAuth.
  // Kjører på nytt når user?.id blir tilgjengelig slik at vi ikke prøver å
  // hente data eller navigere til fane før brukeren er logget inn.
  useEffect(() => {
    if (!user?.id) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('gsc') === 'connected') {
      setGscConnected(true);
      setActiveTab('keywords');
      toastSuccess('Google Search Console koblet til! Henter søkeorddata...');
      window.history.replaceState({}, '', window.location.pathname);
      handleFetchGscKeywords();
    } else if (params.get('gsc_error')) {
      toastError('Kunne ikke koble til Google Search Console. Prøv igjen.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [user?.id]);

  // --- VIKTIG: VARIABLER & HJELPERE (Må defineres FØR de brukes) ---
  const getPackageLevel = (pkgName: string) => {
    const name = pkgName?.toLowerCase() || '';
    if (name.includes('premium')) return 3;
    if (name.includes('standard')) return 2;
    return 1;
  };

  const currentPkgName = clientData?.package_name || 'Basic';

  const plans = [
    { name: 'Basic', level: 1, price: '2 990', color: 'slate', features: ['Dashboard', 'Enkel Analyse', 'Månedlig Rapport'] },
    { name: 'Standard', level: 2, price: '5 990', color: 'amber', features: ['Alt i Basic', 'Tiltaksliste', 'Søkeordsporing', 'Konkurrentanalyse'] },
    { name: 'Premium', level: 3, price: '9 990', color: 'violet', features: ['Alt i Standard', 'Teknisk Helse', 'SEO-Garanti', 'Prioritert Support'] }
  ];

  const planBundle = `${clientData?.package_name || ''} ${selectedPlan || ''} ${typeof window !== 'undefined' ? (localStorage.getItem('sikt_dev_plan') || '') : ''}`;
  const hasPremium = /premium/i.test(planBundle) || /⭐\s*⭐\s*⭐/.test(planBundle);
  const hasStandardOrHigher = hasPremium || /standard/i.test(planBundle);
  const dbPackageLevel = clientData ? getPackageLevel(clientData.package_name) : 1;
  const bundlePackageLevel = hasPremium ? 3 : hasStandardOrHigher ? 2 : 1;
  const currentLevel = Math.max(dbPackageLevel, bundlePackageLevel);

  // Sidebar-navigasjon (8 faner). Hvert ikon gir rask gjenkjennelse selv naar
  // navnet er kort. Tier-faner (konkurrenter, geo) er ALLTID synlige — innholdet
  // viser TierTeaser hvis brukeren ikke har riktig pakke.
  const navItems: { id: PortalTab; label: string; icon: any }[] = [
    { id: 'home', label: 'Hjem', icon: Home },
    { id: 'visibility', label: 'Synlighet', icon: Activity },
    { id: 'keywords', label: 'Søkeord', icon: Search },
    { id: 'competitors', label: 'Konkurrenter', icon: Radar },
    { id: 'geo', label: 'AI-synlighet', icon: BrainCircuit },
    { id: 'workshop', label: 'Verksted', icon: Wrench },
    { id: 'log', label: 'Sikt-loggen', icon: ClipboardCheck },
  ];

  // 2. DATA FETCHING (Profil)
  useEffect(() => {
    const fetchClientData = async () => {
      if (!user?.email) return;
      try {
        // Bruker rå fetch (supabaseRest) for å omgå auth-lock-deadlock i supabase-js.
        const rows = await supabaseRest<any[]>(
          `clients?user_id=eq.${user.id}&select=*&limit=1`,
        );
        const raw = Array.isArray(rows) && rows.length ? rows[0] : null;

        if (raw) {
          // DB-en bruker snake_case. Vi mapper til camelCase som resten av UI-koden forventer.
          const mapped = {
            ...raw,
            companyName: raw.company_name ?? raw.companyName ?? '',
            contactPerson: raw.contact_person ?? raw.contactPerson ?? '',
            websiteUrl: raw.website_url ?? raw.websiteUrl ?? '',
            targetAudience: raw.target_audience ?? raw.targetAudience ?? '',
            email: raw.email ?? '',
            phone: raw.phone ?? '',
            industry: raw.industry ?? '',
            // Ukentlig lås for URL
            urlLastChangedAt: raw.url_last_changed_at ?? null,
          };

          setClientData(mapped);
          setFormData({
            contactPerson: mapped.contactPerson,
            companyName: mapped.companyName,
            email: mapped.email,
            phone: mapped.phone,
            websiteUrl: mapped.websiteUrl,
            industry: mapped.industry,
            targetAudience: mapped.targetAudience,
          });

          // Hent lagrede søkeord/resultater fra nettleseren (fallback)
          const savedKeywords = localStorage.getItem(`keywords_${user.id}`);
          if (savedKeywords) setKeywordsToTrack(JSON.parse(savedKeywords));

          const savedRankings = localStorage.getItem(`rankings_${user.id}`);
          if (savedRankings) {
            const parsedRankings = JSON.parse(savedRankings);
            setRealRankings(parsedRankings);
            setKeywordData(parsedRankings);
            setHasSearched(true);
          }

          // Primærkilde: hent alle brukerens søkeord fra Supabase
          try {
            const keywordRows = await supabaseRest<any[]>(
              `user_keywords?user_id=eq.${user.id}&select=keyword,location,keyword_data`,
            );
            if (Array.isArray(keywordRows) && keywordRows.length > 0) {
              const parsedRows = keywordRows
                .map((row: any) => row.keyword_data || { keyword: row.keyword, location: row.location })
                .filter(Boolean);
              setKeywordsToTrack(parsedRows.map((r: any) => ({ keyword: r.keyword, location: r.location })));
              setKeywordData(parsedRows);
              setRealRankings(parsedRows);
              setHasSearched(true);
              localStorage.setItem(`keywords_${user.id}`, JSON.stringify(parsedRows.map((r: any) => ({ keyword: r.keyword, location: r.location }))));
              localStorage.setItem(`rankings_${user.id}`, JSON.stringify(parsedRows));
            }
          } catch (kwErr: any) {
            console.warn('[ClientPortal] Kunne ikke hente user_keywords:', kwErr?.message || kwErr);
          }
        }

        // Hent host-tilkoblings-info fra client_hosts (kan være tom)
        try {
          const hostRows = await supabaseRest<any[]>(
            `client_hosts?user_id=eq.${user.id}&select=*&limit=1`,
          );
          const hostRaw = Array.isArray(hostRows) && hostRows.length ? hostRows[0] : null;
          if (hostRaw) {
            setHostConnection({
              platform: hostRaw.platform ?? null,
              connectionMode: hostRaw.connection_mode ?? 'skipped',
              repoUrl: hostRaw.repo_url ?? '',
              adminUrl: hostRaw.admin_url ?? '',
              notes: hostRaw.notes ?? '',
              lastChangedAt: hostRaw.last_changed_at ?? null,
            });
          } else {
            setHostConnection(null);
          }
        } catch (hostErr: any) {
          console.warn('[ClientPortal] Kunne ikke hente client_hosts:', hostErr?.message || hostErr);
        }
      } catch (err: any) {
        console.error('[ClientPortal] Kunne ikke hente clients:', err?.message || err);
      } finally {
        setLoading(false);
      }
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
  // Mottar oppdatert formData fra PortalSettings (camelCase) og lagrer til DB med snake_case.
  // URL er låst i 7 dager etter hver endring (urlLastChangedAt). Host-info lagres i egen
  // tabell (client_hosts) via ConnectHost-flyten, ikke her.
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
  const handleSaveSettings = async (incomingFormData?: any) => {
    const merged = incomingFormData || {};
    if (!confirm("Vil du lagre endringene?")) return;
    setSaving(true);
    try {
      const urlChanged = merged.websiteUrl !== undefined
        && merged.websiteUrl !== (clientData?.websiteUrl ?? '');

      // Ukentlig lås: sjekk hvor lang tid det er siden forrige URL-endring
      const lastAt = clientData?.urlLastChangedAt ? new Date(clientData.urlLastChangedAt).getTime() : 0;
      const sinceLast = Date.now() - lastAt;
      if (urlChanged && lastAt > 0 && sinceLast < MS_PER_WEEK) {
        const daysLeft = Math.ceil((MS_PER_WEEK - sinceLast) / (24 * 60 * 60 * 1000));
        toastError(`Nettadressen kan endres på nytt om ${daysLeft} dag${daysLeft === 1 ? '' : 'er'}.`);
        setSaving(false);
        return;
      }

      // Bygg patch med kun snake_case kolonner som faktisk finnes i DB
      const patch: Record<string, any> = {};
      if (merged.companyName !== undefined) patch.company_name = merged.companyName;
      if (merged.contactPerson !== undefined) patch.contact_person = merged.contactPerson;
      if (merged.email !== undefined) patch.email = merged.email;
      if (merged.phone !== undefined) patch.phone = merged.phone;
      if (merged.industry !== undefined) patch.industry = merged.industry;
      if (merged.targetAudience !== undefined) patch.target_audience = merged.targetAudience;
      if (urlChanged) {
        patch.website_url = merged.websiteUrl;
        patch.url_last_changed_at = new Date().toISOString();
      }

      await supabaseRest(`clients?user_id=eq.${user.id}`, {
        method: 'PATCH',
        body: patch,
        headers: { Prefer: 'return=representation' },
      });

      // Oppdater lokal state umiddelbart
      setClientData({
        ...clientData,
        ...merged,
        urlLastChangedAt: urlChanged ? patch.url_last_changed_at : clientData?.urlLastChangedAt,
      });

      if (urlChanged) toastSuccess("Nettadresse lagret. Kan endres igjen om 7 dager.");
      else toastSuccess("Endringer lagret.");
    } catch (err: any) {
      console.error('[handleSaveSettings] feil:', err?.message || err);
      toastError("Kunne ikke lagre: " + (err?.message || 'ukjent feil'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpgrade = (targetPlan?: 'Basic' | 'Standard' | 'Premium') => {
    try {
      const fallbackPlan: 'Standard' | 'Premium' = currentLevel <= 1 ? 'Standard' : 'Premium';
      const selectedTarget = (targetPlan || fallbackPlan).toUpperCase();
      const stripeUrls: Record<string, string> = {
        BASIC: 'https://buy.stripe.com/test_eVq5kE870g2WeFL84Ads400',
        STANDARD: 'https://buy.stripe.com/test_4gMcN63QKbMG55b1Gcds401',
        PREMIUM: 'https://buy.stripe.com/test_5kQfZievo3gaeFL84Ads402',
      };
      const stripeBaseUrl = stripeUrls[selectedTarget];
      if (!stripeBaseUrl) {
        toastError('Fant ikke riktig planlenke. Prøv igjen.');
        return;
      }
      const checkoutUrl = `${stripeBaseUrl}?prefilled_email=${encodeURIComponent(user?.email || '')}&client_reference_id=${encodeURIComponent(user?.id || '')}`;
      window.location.href = checkoutUrl;
    } catch (err) {
      console.error('Error:', err);
      if (typeof onSelectPlan === 'function') onSelectPlan(targetPlan || 'Standard');
      else toastError('Kunne ikke starte betaling. Prøv igjen senere.');
    }
  };

  const sendGeoChat = async () => {
    const q = geoChatInput.trim();
    if (!q || geoChatLoading || !hasPremium) return;
    const token = getStoredAccessToken();
    if (!token) {
      toastError('Du må være logget inn. Prøv å logge inn på nytt.');
      return;
    }
    setGeoChatLoading(true);
    setGeoChatReply(null);
    try {
      const ctx = [clientData?.companyName, formData.websiteUrl || clientData?.websiteUrl, clientData?.industry].filter(Boolean).join(' · ');
      const prompt = `Du er Sikt AI, en norsk rådgiver for synlighet i Google og generativ søk (ChatGPT m.fl.). Bedriftskontekst: ${ctx || 'ikke oppgitt'}. Svar kort, konkret og på norsk (maks ca. 150 ord). Ingen hallusinerte tall om rangering — gi metode og prioritering.\n\nSpørsmål: ${q}`;
      const res = await fetch('/api/openai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt, model: 'gpt-4o-mini', maxTokens: 450 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : (data?.message || `Feil ${res.status}`));
      const text = String(data.content || '').trim();
      setGeoChatReply(text || 'Tomt svar fra modellen.');
    } catch (e: any) {
      toastError(e?.message || 'Kunne ikke nå AI.');
      setGeoChatReply(null);
    } finally {
      setGeoChatLoading(false);
    }
  };

  // --- INNHOLDS-/LENKE-DATA (brukes av runContentScan/runLinkScan + cache) ---
  const [contentPages, setContentPages] = useState<ContentPage[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  // EKTE INNHOLDSSKANNER (Bruker Vercel Backend)
  const runContentScan = async (forceRefresh = false) => {
    if (!formData.websiteUrl) { toastWarning("Legg inn URL i innstillinger først."); return; }

    if (contentPages.length > 0 && !forceRefresh) return;

    setIsScanning(true);
    setIsScanningLinks(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/scan-website', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ url: formData.websiteUrl })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.error) {
        toastError("Feil ved skanning: " + data.error);
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

        // Logg til Ukens kvittering
        const criticalCount = data.pages.filter((p: any) => p.status === 'Kritisk').length;
        const isolatedCount = formattedLinkPages.filter((p: any) => p.status === 'Isolert').length;
        if (user?.id) {
          await supabase.from('sikt_actions').insert({
            user_id: user.id,
            action_type: 'content_scan',
            category: 'finding',
            title: `Skannet ${data.pages.length} sider — fant ${criticalCount} med kritisk innhold`,
            details: { total_pages: data.pages.length, critical: criticalCount, isolated: isolatedCount },
            page_url: formData.websiteUrl,
          }).then(() => {}, () => {});
        }
      } else {
        toastWarning("Fant ingen sider på dette domenet. Er URL-en riktig?");
      }

    } catch (error: any) {
      toastError(error?.message || "Nettverksfeil under skanning.");
    } finally {
      setIsScanning(false);
      setIsScanningLinks(false);
    }
  };
  const [linkPages, setLinkPages] = useState<LinkPage[]>([]);
  const [selectedLinkPage, setSelectedLinkPage] = useState<LinkPage | null>(null);
  const [isScanningLinks, setIsScanningLinks] = useState(false);


  // --- HENT SIKT-HANDLINGER NÅR LOGGEN ÅPNES ---
  useEffect(() => {
    if (activeTab !== 'log' || !user?.id) return;

    const fetchActions = async () => {
      setLoadingReceipt(true);
      try {
        // Hent de siste 60 dagene, så filtrerer vi per uke i UI-laget
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        const { data, error } = await supabase
          .from('sikt_actions')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', sixtyDaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          // Tabellen finnes trolig ikke ennå — vis tom tilstand
          console.warn('sikt_actions ikke tilgjengelig:', error.message);
          setSiktActions([]);
        } else {
          setSiktActions(dedupeSiktActions(Array.isArray(data) ? data : []));
        }
      } catch {
        setSiktActions([]);
      } finally {
        setLoadingReceipt(false);
      }
    };

    fetchActions();
  }, [activeTab, user?.id]);

  // --- LENKE-SKANNER (kalles ikke fra UI ennå, men beholdt for fremtidig bruk) ---
  const runLinkScan = async () => {
    if (!formData.websiteUrl) { toastWarning("Legg inn URL i innstillinger først."); return; }

    setIsScanningLinks(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/scan-website', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ url: formData.websiteUrl })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.error) {
        toastError("Feil ved skanning: " + data.error);
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

        // Logg til Ukens kvittering
        const isolatedCount = formattedLinkPages.filter((p: any) => p.status === 'Isolert').length;
        if (user?.id) {
          await supabase.from('sikt_actions').insert({
            user_id: user.id,
            action_type: 'link_scan',
            category: 'finding',
            title: `Kartla lenker på ${formattedLinkPages.length} sider — fant ${isolatedCount} isolerte sider`,
            details: { total_pages: formattedLinkPages.length, isolated: isolatedCount },
            page_url: formData.websiteUrl,
          }).then(() => {}, () => {});
        }
      } else {
        toastWarning("Fant ingen lesbare sider på dette domenet.");
      }

    } catch (error: any) {
      toastError(error?.message || "Nettverksfeil under lenkeskanning.");
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

  // --- AUTO-LOAD CACHE (innhold/lenker hentes ved bruk i drawer/scan) ---
  useEffect(() => {
    if (!formData.websiteUrl) return;
    if (contentPages.length === 0) {
      const contentCache = localStorage.getItem(`content_cache_${formData.websiteUrl}`);
      if (contentCache) {
        try {
          const { data, timestamp } = JSON.parse(contentCache);
          if (Date.now() - timestamp < 86400000) setContentPages(data);
        } catch (e) { /* ignore */ }
      }
    }
    if (linkPages.length === 0) {
      const linkCache = localStorage.getItem(`link_cache_${formData.websiteUrl}`);
      if (linkCache) {
        try {
          const { data, timestamp } = JSON.parse(linkCache);
          if (Date.now() - timestamp < 86400000) setLinkPages(data);
        } catch (e) { /* ignore */ }
      }
    }
  }, [formData.websiteUrl, contentPages.length, linkPages.length]);

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
      toastWarning(`Du har nådd grensen på ${currentKeywordLimit} søkeord for din nåværende plan. Oppgrader for å overvåke flere ord.`);
      return;
    }
    if (newKeywordInput.trim() && locationInput.trim()) {
      const newEntry = { keyword: newKeywordInput.trim(), location: locationInput.trim() };
      const updated = [...keywordsToTrack, newEntry];
      setKeywordsToTrack(updated);
      setNewKeywordInput('');
      localStorage.setItem(`keywords_${user.id}`, JSON.stringify(updated));

      // Logg til Ukens kvittering
      if (user?.id) {
        supabase.from('sikt_actions').insert({
          user_id: user.id,
          action_type: 'keyword_added',
          category: 'finding',
          title: `La til søkeord «${newEntry.keyword}» for overvåkning i ${newEntry.location}`,
          details: { keyword: newEntry.keyword, location: newEntry.location },
        }).then(() => {}, () => {});
      }
    } else {
      toastWarning("Du må skrive både søkeord og velge en kommune.");
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
    if (!formData.websiteUrl) { toastWarning("Legg inn URL i innstillinger."); return; }


    // --- 1. SØKEORDSKVOTE & AUTOMATISK LEGG TIL ---
    const currentKeywordLimit = currentLevel >= 3 ? 50 : currentLevel === 2 ? 15 : 3;
    let activeList = [...keywordsToTrack];

    // Sjekk om brukeren har skrevet noe nytt i søkefeltet
    if (newKeywordInput.trim()) {
      if (!locationInput.trim()) { toastWarning("Du må fylle ut sted (f.eks Oslo) for å søke."); return; }
      if (activeList.length >= currentKeywordLimit) {
        toastWarning(`Søkeordskvoten din på ${currentKeywordLimit} er full!`);
        return;
      }

      const newEntry = { keyword: newKeywordInput.trim(), location: locationInput.trim() };
      activeList = [...activeList, newEntry];
      setKeywordsToTrack(activeList);

      // Vi sletter localStorage her, siden vi lagrer alt i Supabase lenger ned
      setNewKeywordInput(''); // Tømmer feltet
    }

    if (activeList.length === 0) { toastWarning("Legg til et søkeord."); return; }

    setRankingLoading(true);
    setHasSearched(true);

    const cleanDomain = formData.websiteUrl.replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0];

    const rankToken = getStoredAccessToken();
    if (!rankToken) {
      toastWarning('Sesjonen din er utløpt. Logg inn på nytt.');
      setRankingLoading(false);
      return;
    }

    try {
      const promises = activeList.map(async (entry: any) => {
        const keyword = typeof entry === 'string' ? entry : entry.keyword;
        const location = typeof entry === 'string' ? 'Oslo' : entry.location;

        try {
          // Snakker med den trygge Vercel-serveren din (backend)
          const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${rankToken}`
            },
            body: JSON.stringify({ keyword, location })
          });

          const data = await response.json().catch(() => ({}));

          if (!response.ok || data.error) {
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

        } catch {
          return null;
        }
      });

      const results = (await Promise.all(promises)).filter(Boolean) as any[];
      setKeywordData(results);
      setRealRankings(results);
      setKeywordsToTrack(results.map((r: any) => ({ keyword: r.keyword, location: r.location })));

      // Logg til Ukens kvittering
      const top10 = results.filter((r: any) => r.position <= 10).length;
      const top3 = results.filter((r: any) => r.position <= 3).length;
      if (user?.id) {
        supabase.from('sikt_actions').insert({
          user_id: user.id,
          action_type: 'keyword_check',
          category: 'finding',
          title: `Sjekket rangering for ${results.length} søkeord — ${top10} på side 1, ${top3} i topp 3`,
          details: { total: results.length, top10, top3 },
          page_url: formData.websiteUrl,
        }).then(() => {}, () => {});
      }

      // --- 3. LAGRE TIL SUPABASE (ERSTATTER LOCALSTORAGE) ---
      for (const result of results) {
        // 1. Sjekk om ordet allerede finnes i databasen for denne kunden
        const { data: existing, error: existingError } = await supabase
          .from('user_keywords')
          .select('id')
          .eq('user_id', user.id)
          .eq('keyword', result.keyword)
          .eq('location', result.location)
          .maybeSingle();
        if (existingError) throw existingError;

        if (existing) {
          // 2. Hvis det finnes, oppdaterer vi grafen og historikken
          const { error: updateError } = await supabase
            .from('user_keywords')
            .update({ keyword_data: result })
            .eq('id', existing.id);
          if (updateError) throw updateError;
        } else {
          // 3. Hvis det er helt nytt, legger vi det inn i databasen
          const { error: insertError } = await supabase
            .from('user_keywords')
            .insert({
              user_id: user.id,
              keyword: result.keyword,
              location: result.location,
              keyword_data: result
            });
          if (insertError) throw insertError;
        }
      }

      // Behold lokal cache i tillegg til Supabase for rask last ved refresh.
      localStorage.setItem(`keywords_${user.id}`, JSON.stringify(activeList));
      localStorage.setItem(`rankings_${user.id}`, JSON.stringify(results));

    } catch (error: any) {
      toastError(error?.message || "Feil ved henting av data.");
    } finally {
      setRankingLoading(false);
    }
  };

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

  // --- SIKT ACTIONS LOGGER ---
  // Kalles når Sikt gjør noe for brukeren, slik at det dukker opp i "Ukens kvittering"
  // Feiler stille hvis tabellen ikke finnes enda (for bakoverkompatibilitet)
  const logSiktAction = async (params: {
    actionType: string;
    category: 'finding' | 'suggestion' | 'fix' | 'alert';
    title: string;
    details?: any;
    pageUrl?: string;
    beforeValue?: string;
    afterValue?: string;
  }) => {
    if (!user?.id) return;
    try {
      // Rå REST — unngår supabase-js som kan henge ved auth-lock
      await supabaseRest('sikt_actions', {
        method: 'POST',
        body: {
          user_id: user.id,
          action_type: params.actionType,
          category: params.category,
          title: params.title,
          details: params.details ?? null,
          page_url: params.pageUrl ?? null,
          before_value: params.beforeValue ?? null,
          after_value: params.afterValue ?? null,
        },
        headers: { Prefer: 'return=minimal' },
      });
    } catch (err) {
      try {
        const key = `sikt_actions_fallback_${user.id}`;
        const q = JSON.parse(localStorage.getItem(key) || '[]');
        q.push({ ...params, savedAt: new Date().toISOString() });
        localStorage.setItem(key, JSON.stringify(q.slice(-50)));
      } catch { /* ignore */ }
    }
  };

  const runRealAnalysis = async () => {
    const url = formData.websiteUrl || clientData?.websiteUrl;
    if (!url) { setAnalyzeError("Mangler URL. Legg inn nettadresse under Innstillinger."); return; }
    setIsAnalyzing(true); setAnalyzeError(null);
    let formattedUrl = String(url).trim();
    if (!formattedUrl.startsWith('http')) formattedUrl = 'https://' + formattedUrl;

    const token = getStoredAccessToken();
    if (!token) {
      setAnalyzeError("Du må være logget inn for å kjøre analyse.");
      setIsAnalyzing(false);
      return;
    }

    let lastErr = 'Ukjent feil';
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          setAnalyzeError(`Prøver på nytt (${attempt + 1}/3) …`);
          await new Promise(r => setTimeout(r, 1200 * attempt));
        }

        const { data: { session } } = await supabase.auth.getSession();

        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-pagespeed`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            url: formattedUrl,
            user_id: user?.id
          }),
        });

        const errBody = await res.json().catch(() => ({}));

        if (res.ok) {
          const { mobile: mobileRaw, desktop: desktopRaw } = errBody;
          const mobile = formatLighthouseData(mobileRaw);
          const desktop = formatLighthouseData(desktopRaw);
          setAnalysisResults({ mobile, desktop });
          setAnalyzeError(null);

          try {
            localStorage.setItem(`sikt_analysis_cache_${user.id}`, JSON.stringify({ url: formattedUrl, results: { mobile, desktop }, timestamp: Date.now() }));
          } catch { /* ignore */ }

          const histEntry = {
            at: new Date().toISOString(),
            mobilePerf: mobile.performance,
            mobileSeo: mobile.seo,
            desktopPerf: desktop.performance,
          };
          setScoreHistory((prev) => {
            const next = [...prev, histEntry].slice(-30);
            try { localStorage.setItem(`sikt_portal_score_history_${user.id}`, JSON.stringify(next)); } catch { /* ignore */ }
            return next;
          });

          const issuesFound = (mobile.opportunities?.length ?? 0) + (mobile.diagnostics?.filter((d: any) => !d.passed)?.length ?? 0);
          await logSiktAction({
            actionType: 'analysis_run',
            category: 'finding',
            title: `Kjørte teknisk helsesjekk — fant ${issuesFound} punkter å fikse`,
            details: { mobile_score: mobile.performance, desktop_score: desktop.performance, seo_score: mobile.seo },
            pageUrl: formattedUrl,
          });
          return;
        }

        lastErr = errBody.error || `HTTP ${res.status}`;
        // Logger detaljer til console (aldri til UI)
        if (errBody.detail) console.error('[runRealAnalysis] Google-detail:', errBody.detail);
        console.error('[runRealAnalysis] response', res.status, errBody);
        if (![429, 500, 502, 503].includes(res.status)) break;
      }

      throw new Error(lastErr);
    } catch (err: any) {
      const msg = err?.message || lastErr;
      console.error('[runRealAnalysis] Feil:', err);
      // Fjern eventuelle API-nøkler fra feilmeldingen (mønster: AIza + 35 tegn)
      const safeMsg = msg.replace(/AIza[A-Za-z0-9_-]{35}/g, '[nøkkel skjult]')
                         .replace(/api_key:[^\s'"]+/gi, 'api_key:[skjult]');
      if (/PAGESPEED_API_KEY/i.test(safeMsg)) {
        setAnalyzeError('Serveren mangler PAGESPEED_API_KEY. Legg den til i .env.local og restart dev-serveren.');
      } else if (/suspended/i.test(safeMsg)) {
        setAnalyzeError('PageSpeed API-nøkkelen er suspendert av Google. Lag en ny nøkkel i Google Cloud Console og oppdater den i Vercel → Environment Variables.');
      } else if (/API key not valid|API_KEY_INVALID/i.test(safeMsg)) {
        setAnalyzeError('PageSpeed-nøkkelen ble avvist av Google. Sjekk at nøkkelen er gyldig og at PageSpeed Insights API er aktivert i samme prosjekt.');
      } else if (/quota|RESOURCE_EXHAUSTED/i.test(safeMsg)) {
        setAnalyzeError('PageSpeed-kvoten er brukt opp. Vent et minutt eller sjekk kvotene dine i Google Cloud.');
      } else if (/HTTP 5\d\d|Intern feil|PageSpeed feilet|feilet/i.test(safeMsg)) {
        setAnalyzeError('Kunne ikke kjøre PageSpeed akkurat nå. Prøv igjen om litt.');
      } else {
        setAnalyzeError(safeMsg);
      }
    } finally { setIsAnalyzing(false); }
  };

  // ===================================================================
  // AUTO-SCAN — fyrer av PageSpeed + innholds-scan + lenke-scan i bakgrunnen
  // foerste gang brukeren entrer portalen og har en URL satt. Respekterer cache
  // (24t for innhold/lenker, 12t for PageSpeed) saa vi ikke spinner unoedig.
  // ===================================================================
  const autoScanFiredRef = useRef(false);
  const [autoScanInfo, setAutoScanInfo] = useState<{ active: boolean; label: string }>({ active: false, label: '' });

  useEffect(() => {
    if (autoScanFiredRef.current) return;
    if (loading) return;
    if (!user?.id) return;
    const url = (formData.websiteUrl || clientData?.websiteUrl || '').trim();
    if (!url) return;

    autoScanFiredRef.current = true;

    (async () => {
      // PageSpeed: bare hvis vi mangler resultater eller cache er > 12t
      const pageSpeedStale = (() => {
        try {
          const raw = localStorage.getItem(`sikt_analysis_cache_${user.id}`);
          if (!raw) return true;
          const parsed = JSON.parse(raw);
          const norm = (s: string) => String(s || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '').toLowerCase();
          if (norm(parsed.url) !== norm(url)) return true;
          // 12 timer
          const ts = parsed.timestamp || 0;
          return Date.now() - ts > 12 * 60 * 60 * 1000;
        } catch { return true; }
      })();

      try {
        if (!analysisResults && !isAnalyzing && pageSpeedStale) {
          setAutoScanInfo({ active: true, label: 'Sjekker PageSpeed mot Google…' });
          await runRealAnalysis();
        }
      } catch (e) { console.warn('[auto-scan] pagespeed:', e); }

      try {
        if (contentPages.length === 0) {
          setAutoScanInfo({ active: true, label: 'Skanner innhold på sidene dine…' });
          await runContentScan();
        }
      } catch (e) { console.warn('[auto-scan] content:', e); }

      try {
        if (linkPages.length === 0) {
          setAutoScanInfo({ active: true, label: 'Sjekker lenker for brudd…' });
          await runLinkScan();
        }
      } catch (e) { console.warn('[auto-scan] links:', e); }

      setAutoScanInfo({ active: false, label: '' });
    })();
  }, [loading, user?.id, formData.websiteUrl, clientData?.websiteUrl]);

  // VIKTIG: Vi gjør IKKE en early return for loading her. Det vil bryte React
  // Rules of Hooks fordi useMemo (todos) lenger ned ikke ville bli kalt under
  // loading. Vi bruker en flag i stedet og rendrer loading-skjermen helt nederst,
  // etter at alle hooks er deklarert.

  // ===================================================================
  // DESIGN-TOKENS — én konsistent palett for hele portalen.
  // ===================================================================
  const themed: PortalTheme = theme === 'light' ? 'light' : 'dark';
  const isLight = themed === 'light';
  const rootBg = isLight ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100';
  const textMain = portalTextMainClass(themed);
  const textDim = portalTextDimClass(themed);
  const textLabel = portalTextLabelClass(themed);
  const divider = portalDividerClass(themed);
  const subtleBg = portalSubtleBgClass(themed);
  const navBg = isLight ? 'bg-white/90' : 'bg-slate-950/90';
  const navBorder = divider;

  const navBtnClass = (active: boolean) =>
    active
      ? `px-4 py-2 rounded-lg text-sm font-medium ${isLight ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`
      : `px-4 py-2 rounded-lg text-sm font-medium ${textDim} hover:${textMain} transition-colors`;

  // ===================================================================
  // AVLEDET DATA — alt vi trenger for å vise et meningsfylt Hjem.
  // ===================================================================
  const firstName = (clientData?.contactPerson || clientData?.companyName || user?.email || '').toString().split(/[\s@]/)[0] || 'der';
  const websiteUrl = (formData.websiteUrl || clientData?.websiteUrl || '').trim();

  // ===================================================================
  // SCORE-MODELL — Sikt-scoren paa Hjem er en kombinasjon av tre faktorer:
  //   1. TEKNISK HELSE   (0-100) — Core Web Vitals, Lighthouse, hastighet, HTTPS, mobil
  //                                 Datakilde: Google PageSpeed API
  //   2. GOOGLE SYNLIGHET(0-100) — rangering paa soekeord, organisk synlighet
  //                                 Datakilde: SERP / Google Search Console
  //   3. GEO SCORE       (0-100) — AI-sitering, llms.txt, schema for LLM (kun Premium)
  //                                 Datakilde: intern GEO-analyse
  //
  // `totalScore` beholdes som "ren teknisk score" og brukes paa PageSpeed-fanen.
  // `combinedScore` er snittet av tilgjengelige komponenter og vises paa Hjem.
  // ===================================================================

  // 1) TEKNISK HELSE — gjennomsnitt av de fire Lighthouse-kategoriene (mobil)
  const perfMobile = analysisResults?.mobile?.performance ?? null;
  const seoMobile = analysisResults?.mobile?.seo ?? null;
  const bpMobile = analysisResults?.mobile?.bestPractices ?? null;
  const a11yMobile = analysisResults?.mobile?.accessibility ?? null;
  const totalScore = analysisResults
    ? Math.round(((perfMobile ?? 0) + (seoMobile ?? 0) + (bpMobile ?? 0) + (a11yMobile ?? 0)) / 4)
    : null;
  const technicalScore = totalScore;

  // 2) GOOGLE SYNLIGHET — bygd fra posisjon paa sporede soekeord.
  // Hvert soekeord faar poeng etter posisjon (1-3=100, 4-10=80, 11-20=50, 21-50=25, ellers 10).
  // Ikke-rangerte soekeord teller med i nevneren slik at de drar scoren ned — det er reelt.
  const visibilityScore: number | null = (() => {
    if (!realRankings || realRankings.length === 0) return null;
    const sum = realRankings.reduce((acc: number, r: any) => {
      const p = typeof r?.position === 'number' ? r.position : null;
      if (p == null) return acc + 10;
      if (p <= 3) return acc + 100;
      if (p <= 10) return acc + 80;
      if (p <= 20) return acc + 50;
      if (p <= 50) return acc + 25;
      return acc + 10;
    }, 0);
    return Math.round(sum / realRankings.length);
  })();

  // 3) GEO SCORE — AI-sitering, llms.txt, schema markup for LLM (kun premium).
  // Ikke implementert ennå — null betyr at den ikke regnes med i kombinert score.
  const geoScore: number | null = null;

  // 4) KOMBINERT SIKT-SCORE — snitt av tilgjengelige komponenter.
  // Hvis brukeren ikke har Premium, regnes scoren ut fra to komponenter (teknisk + synlighet).
  const combinedScore: number | null = (() => {
    const parts: number[] = [];
    if (technicalScore != null) parts.push(technicalScore);
    if (visibilityScore != null) parts.push(visibilityScore);
    if (geoScore != null) parts.push(geoScore);
    if (parts.length === 0) return null;
    return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
  })();

  const scoreTone: 'good' | 'warn' | 'bad' | 'neutral' =
    combinedScore == null ? 'neutral' : combinedScore >= 80 ? 'good' : combinedScore >= 60 ? 'warn' : 'bad';

  // Søkeord-grense (brukes i Sokeord- og Innstillinger-fanen)
  const keywordLimit = getKeywordLimit(currentLevel);

  // Pakke-pris-tekst (brukes i settings + teaser)
  const planPrices: Record<string, string> = { BASIC: '499 kr', STANDARD: '1 499 kr', PREMIUM: '4 999 kr' };
  const planNames: Record<string, string> = { BASIC: 'Basic', STANDARD: 'Standard', PREMIUM: 'Premium' };
  const activePlanKey: 'BASIC' | 'STANDARD' | 'PREMIUM' =
    /premium/i.test(planBundle) ? 'PREMIUM' : /standard/i.test(planBundle) ? 'STANDARD' : 'BASIC';

  // Webhost-status (for settings-fanen)
  const hostMode: string = hostConnection?.connectionMode || 'none';
  const hostIsConnected = hostMode === 'light' || hostMode === 'full';

  // URL-lås (én endring per uke)
  const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
  const urlLastChangedMs = clientData?.urlLastChangedAt ? new Date(clientData.urlLastChangedAt).getTime() : 0;
  const urlMsUntilUnlock = urlLastChangedMs ? Math.max(0, MS_WEEK - (Date.now() - urlLastChangedMs)) : 0;
  const urlLocked = urlMsUntilUnlock > 0;
  const urlDaysLeft = Math.ceil(urlMsUntilUnlock / (24 * 60 * 60 * 1000));

  // Dev-modus for plan-bytte (kun lokal `vite dev`)
  const isDevMode = import.meta.env.DEV;
  const isMockUser = user?.id === 'dev-mock-user-id' || user?.app_metadata?.provider === 'dev' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user?.id || '');

  // Lokal handler for plan-bytte (dev) — speiler den gamle logikken fra PortalSettings
  const performPlanChange = async () => {
    if (!planChangeTarget || !user?.id) return;
    setSwitchingPlan(true);
    try {
      if (isMockUser) {
        setClientData((prev: any) => ({ ...(prev || {}), package_name: planChangeTarget.name }));
        try { localStorage.setItem('sikt_dev_plan', planChangeTarget.name); } catch { /* ignore */ }
        toastSuccess(`Byttet til ${planChangeTarget.name} (dev-modus, kun lokalt).`);
      } else {
        await supabaseRest(`clients?user_id=eq.${user.id}`, {
          method: 'PATCH',
          body: { package_name: planChangeTarget.name },
          headers: { Prefer: 'return=representation' },
        });
        toastSuccess(`Byttet til ${planChangeTarget.name}.`);
        setTimeout(() => window.location.reload(), 800);
      }
      setPlanChangeTarget(null);
    } catch (err: any) {
      toastError('Kunne ikke bytte plan: ' + (err?.message || 'ukjent feil'));
    } finally {
      setSwitchingPlan(false);
    }
  };

  // Webhost-tilkobling-handler (speiler logikken fra gamle PortalSettings)
  const saveHostConnection = async () => {
    if (!hostPlatform || !hostInputValue.trim()) return;
    setHostSaving(true);
    try {
      const body: any = {
        user_id: user.id,
        platform: hostPlatform,
        connection_mode: 'light',
        repo_url: hostPlatform === 'github' ? hostInputValue.trim() : null,
        admin_url: (hostPlatform !== 'github' && hostPlatform !== 'custom') ? hostInputValue.trim() : null,
        notes: hostPlatform === 'custom' ? hostInputValue.trim() : null,
        last_changed_at: new Date().toISOString(),
      };
      await supabaseRest('client_hosts?on_conflict=user_id', {
        method: 'POST',
        body,
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      });
      setHostConnection({
        platform: body.platform,
        connectionMode: 'light',
        repoUrl: body.repo_url || '',
        adminUrl: body.admin_url || '',
        notes: body.notes || '',
        lastChangedAt: body.last_changed_at,
      });
      toastSuccess('CMS koblet til. Sikt kan nå pushe fikser direkte.');
      setShowHostModal(false);
      setHostPlatform('');
      setHostInputValue('');
    } catch (err: any) {
      toastError('Kunne ikke koble til: ' + (err?.message || 'ukjent feil'));
    } finally {
      setHostSaving(false);
    }
  };

  const toggleNotif = (key: keyof typeof notifPrefs) =>
    setNotifPrefs((prev) => ({ ...prev, [key]: !prev[key] }));

  // ===================================================================
  // TODOS — aggregert "i dag"-liste fra alle kilder, sortert etter impact.
  // Brukes paa Hjem (3 oeverst + "mer") og er kilden til Verksted-fanen.
  // ===================================================================
  type TodoKind = 'pagespeed' | 'keyword' | 'content' | 'onboarding' | 'competitor' | 'geo';
  type Todo = {
    id: string;
    kind: TodoKind;
    title: string;
    desc: string;
    impact: number; // 0-100, hoyere = viktigere
    action: { label: string; onClick: () => void };
    raw?: any; // for verksted-drawer (PageSpeed-opportunity)
  };

  const todos = useMemo<Todo[]>(() => {
    const items: Todo[] = [];

    // 1. Onboarding-rest - hoyest prioritet hvis ufullstendig
    if (!websiteUrl) {
      items.push({
        id: 'onboarding-url',
        kind: 'onboarding',
        title: 'Legg inn nettsiden din',
        desc: 'Sikt trenger nettadressen for å sjekke synlighet og rangering.',
        impact: 100,
        action: { label: 'Legg til', onClick: () => { setActiveTab('settings'); setEditingSection('profile'); } },
      });
    } else if (!analysisResults) {
      items.push({
        id: 'onboarding-analysis',
        kind: 'onboarding',
        title: 'Kjør første tekniske sjekk',
        desc: 'Test mot Google og få Lighthouse-resultatet på 30 sekunder.',
        impact: 95,
        action: { label: isAnalyzing ? 'Kjører…' : 'Kjør analyse', onClick: () => runRealAnalysis() },
      });
    }
    if (websiteUrl && keywordsToTrack.length === 0) {
      items.push({
        id: 'onboarding-keywords',
        kind: 'onboarding',
        title: 'Legg til søkeord du vil rangere på',
        desc: 'Sikt sjekker plasseringen din på Google for hvert ord du sporer.',
        impact: 88,
        action: { label: 'Legg til', onClick: () => setActiveTab('keywords') },
      });
    }
    if (hasStandardOrHigher && !hostConnection) {
      items.push({
        id: 'onboarding-cms',
        kind: 'onboarding',
        title: 'Koble til CMS',
        desc: 'Lar Sikt pushe fikser direkte til siden, og gir AI eksakt kode-context.',
        impact: 80,
        action: { label: 'Koble til', onClick: () => { setActiveTab('settings'); setShowHostModal(true); } },
      });
    }

    // 2. PageSpeed-opportunities (mobile, hoy impact = stor savings)
    if (analysisResults?.mobile?.opportunities) {
      for (const o of analysisResults.mobile.opportunities) {
        const savingsMs = (o as any).numericValue ?? 0;
        const savingsLabel = o.savings || (savingsMs > 0 ? `Sparer ${(savingsMs/1000).toFixed(1)}s` : '');
        items.push({
          id: `ps-${o.title}`,
          kind: 'pagespeed',
          title: o.title,
          desc: savingsLabel || 'Forbedring foreslått av Lighthouse',
          impact: Math.min(85, 40 + Math.round(savingsMs / 100)),
          action: {
            label: 'Åpne',
            onClick: () => {
              setActiveSolveProblem({ raw: o, title: o.title });
              setActiveTab('workshop');
              setExpandedWorkshopProblem(`ps-${o.title}`);
            },
          },
          raw: o,
        });
      }
    }

    // 3. Sokeord pa pos 4-20 (lavt-hengende frukt)
    for (const r of realRankings) {
      const pos = (r as any).position;
      if (pos > 3 && pos < 20) {
        items.push({
          id: `kw-${r.keyword}-${r.location}`,
          kind: 'keyword',
          title: `«${r.keyword}» — plass ${pos}`,
          desc: pos <= 10 ? `${pos - 3} plasser unna topp 3` : `${pos - 10} plasser unna side 1`,
          impact: 70 - (pos - 4) * 2,
          action: { label: 'Se søkeord', onClick: () => setActiveTab('keywords') },
        });
      }
    }

    return items.sort((a, b) => b.impact - a.impact);
  }, [analysisResults, realRankings, websiteUrl, hostConnection, keywordsToTrack.length, hasStandardOrHigher, isAnalyzing]);

  const todayTodos = todos.slice(0, 3);
  const moreTodos = todos.slice(3);

  // Aktivitetsfeed paa Hjem - siste 8 sikt_actions
  const homeFeedActions = dedupeSiktActions(siktActions || []).slice(0, 8);

  // KPI-data for Hjem-tilene
  const top10Count = realRankings.filter((r: any) => r.position && r.position <= 10).length;
  const top3Count = realRankings.filter((r: any) => r.position && r.position <= 3).length;
  const actionsLast7d = (siktActions || []).filter((a: any) => {
    const ts = new Date(a.created_at).getTime();
    return Date.now() - ts < 7 * 24 * 60 * 60 * 1000;
  }).length;
  const fixesLast7d = (siktActions || []).filter((a: any) => {
    const ts = new Date(a.created_at).getTime();
    return a.category === 'fix' && Date.now() - ts < 7 * 24 * 60 * 60 * 1000;
  }).length;
  const scoreSpark = scoreHistory.slice(-12).map((h) =>
    Math.round(((h.mobilePerf ?? 0) + (h.mobileSeo ?? 0)) / 2),
  );
  const scoreDelta = scoreHistory.length >= 2
    ? Math.round(((scoreHistory[scoreHistory.length - 1].mobilePerf + scoreHistory[scoreHistory.length - 1].mobileSeo) / 2)
        - ((scoreHistory[scoreHistory.length - 2].mobilePerf + scoreHistory[scoreHistory.length - 2].mobileSeo) / 2))
    : 0;

  // Posisjon-fordeling for Sokeord-fanen (Topp 3 / 4-10 / 11-20 / 21+)
  const positionBuckets = [
    { name: 'Topp 3', value: realRankings.filter((r: any) => r.position && r.position <= 3).length, fill: '#10b981' },
    { name: '4–10', value: realRankings.filter((r: any) => r.position && r.position > 3 && r.position <= 10).length, fill: '#7c3aed' },
    { name: '11–20', value: realRankings.filter((r: any) => r.position && r.position > 10 && r.position <= 20).length, fill: '#f59e0b' },
    { name: '21+', value: realRankings.filter((r: any) => !r.position || r.position > 20).length, fill: '#f43f5e' },
  ];

  // Aktivitets-mini-graf for KPI-tilene (siste 7 dager, telle pr dag)
  const activityByDay = Array.from({ length: 7 }, (_, i) => {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - (6 - i));
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    return (siktActions || []).filter((a: any) => {
      const ts = new Date(a.created_at).getTime();
      return ts >= dayStart.getTime() && ts < dayEnd.getTime();
    }).length;
  });

  // Loading-skjerm: vises etter at ALLE hooks er deklarert, slik at vi ikke
  // bryter React Rules of Hooks naar `loading` flipper fra true -> false.
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isLight ? 'bg-slate-50' : 'bg-slate-950'}`}>
        <div className={`rounded-2xl border ${divider} ${isLight ? 'bg-white' : 'bg-slate-900/60'} px-6 py-5 shadow-sm flex items-center gap-3`}>
          <Loader2 size={18} className="text-violet-600 animate-spin" />
          <div>
            <p className={`text-sm font-medium ${textMain}`}>Laster portalen</p>
            <p className={`text-xs ${textDim}`}>Henter profil, score og siste aktivitet.</p>
          </div>
        </div>
      </div>
    );
  }

  const displayName = (clientData?.contactPerson || clientData?.companyName || user?.email || 'Bruker').toString();
  const footerInitials = (() => {
    const n = displayName.trim();
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return n.slice(0, 2).toUpperCase() || '?';
  })();
  const footerPlanLabel = `${planNames[activePlanKey]} plan`;

  return (
    <div className={`min-h-screen ${rootBg} antialiased`}>

      {/* =============================================================== */}
      {/* SIDEBAR-NAVIGASJON — vertikal liste, 7 faner + innstillinger i bunntekst */}
      {/* Kollapsbar (kun-ikoner) via knapp i topp. Persistert i localStorage.*/}
      {/* =============================================================== */}
      <div className="flex min-h-screen">
        {/* Sidebar (md+): alltid synlig. Mobil: drawer styrt av mobileNavOpen. */}
        <aside
          className={`fixed md:sticky top-0 left-0 z-40 h-screen ${sidebarCollapsed ? 'w-16' : 'w-64'} shrink-0 border-r ${navBorder} ${navBg} backdrop-blur flex flex-col transition-[width,transform] duration-200 ${
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          {/* Logo + collapse-knapp */}
          <div className={`h-16 ${sidebarCollapsed ? 'px-3 justify-center' : 'px-5 justify-between'} flex items-center border-b ${navBorder}`}>
            {!sidebarCollapsed ? (
              <>
                <button onClick={() => { setActiveTab('home'); setMobileNavOpen(false); }} className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white font-semibold text-sm shadow-sm shadow-violet-500/30 shrink-0">S</div>
                  <span className={`font-semibold text-base ${textMain} truncate`}>Sikt</span>
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed(true)}
                    className={`hidden md:inline-flex p-1.5 rounded-md ${textDim} hover:${textMain} ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'} transition-colors`}
                    aria-label="Skjul meny"
                    title="Skjul meny"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileNavOpen(false)}
                    className={`md:hidden p-1.5 rounded-md ${textDim} hover:${textMain}`}
                    aria-label="Lukk meny"
                  >
                    <X size={18} />
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white font-semibold text-sm shadow-sm shadow-violet-500/30 hover:scale-105 transition-transform"
                aria-label="Vis meny"
                title="Vis meny"
              >
                S
              </button>
            )}
          </div>

          {/* Nav-liste */}
          <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-4 ${sidebarCollapsed ? 'px-2' : 'px-3'} space-y-0.5`}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              // Liten badge: antall todos paa Verksted/Hjem
              let badge: number | null = null;
              if (item.id === 'workshop' || item.id === 'home') {
                const c = todos.length;
                if (c > 0) badge = c;
              }
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setMobileNavOpen(false); }}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2'} rounded-lg text-sm font-medium transition-colors relative ${
                    active
                      ? isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'
                      : `${textDim} hover:${textMain} ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-violet-600" aria-hidden />
                  )}
                  <Icon size={16} className={active ? 'text-violet-600' : ''} />
                  {!sidebarCollapsed && <span className="truncate flex-1 text-left">{item.label}</span>}
                  {!sidebarCollapsed && badge !== null && (
                    <span className={`ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full ${active ? 'bg-violet-600 text-white' : isLight ? 'bg-slate-200 text-slate-700' : 'bg-white/15 text-white'}`}>{badge}</span>
                  )}
                  {sidebarCollapsed && badge !== null && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-violet-500 ring-2 ring-white dark:ring-slate-900" aria-hidden />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bruker-rad + snarveier (innstillinger ligger her — ikke i nav-listen). */}
          <div className={`border-t ${navBorder} ${sidebarCollapsed ? 'px-1.5' : 'px-3'} py-3 relative`}>
            {!sidebarCollapsed ? (
              <>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 select-none"
                    style={{ background: '#1A1A1A' }}
                    aria-hidden
                  >
                    {footerInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{displayName}</p>
                    <p className="text-xs truncate mt-0.5" style={{ color: '#808080' }}>{footerPlanLabel}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('settings'); setMobileNavOpen(false); setUserFooterMenuOpen(false); }}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-transform active:scale-[0.97]"
                    style={{ border: '1px solid #EBEBE6', color: '#1A1A1A', background: isLight ? '#fff' : 'rgba(255,255,255,0.06)' }}
                    aria-label="Innstillinger"
                    title="Innstillinger"
                  >
                    <Settings size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserFooterMenuOpen((v) => !v)}
                    className={`inline-flex items-center justify-center w-8 h-9 rounded-lg shrink-0 transition-transform active:scale-[0.97] ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/10'}`}
                    aria-expanded={userFooterMenuOpen}
                    aria-haspopup="menu"
                    aria-label="Konto-meny"
                  >
                    <ChevronsUpDown size={16} />
                  </button>
                </div>
                {userFooterMenuOpen && (
                  <div
                    className="absolute bottom-full left-2 right-2 mb-2 rounded-xl py-1 z-50 shadow-lg"
                    style={{ background: '#FFFFFF', border: '1px solid #EBEBE6' }}
                    role="menu"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { onLogout(); setUserFooterMenuOpen(false); setMobileNavOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <LogOut size={16} /> Logg ut
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0 select-none"
                  style={{ background: '#1A1A1A' }}
                  title={displayName}
                >
                  {footerInitials}
                </div>
                <button
                  type="button"
                  onClick={() => { setActiveTab('settings'); setMobileNavOpen(false); setUserFooterMenuOpen(false); }}
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-lg transition-transform active:scale-[0.97] ${isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-200 hover:bg-white/10'}`}
                  aria-label="Innstillinger"
                  title="Innstillinger"
                >
                  <Settings size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setUserFooterMenuOpen((v) => !v)}
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-lg transition-transform active:scale-[0.97] ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/10'}`}
                  aria-expanded={userFooterMenuOpen}
                  aria-label="Konto-meny"
                  title="Mer"
                >
                  <ChevronsUpDown size={16} />
                </button>
                {userFooterMenuOpen && (
                  <div
                    className="absolute bottom-full left-0 right-0 mb-1 mx-1 rounded-xl py-1 z-50 shadow-lg"
                    style={{ background: '#FFFFFF', border: '1px solid #EBEBE6' }}
                    role="menu"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { onLogout(); setUserFooterMenuOpen(false); setMobileNavOpen(false); }}
                      className="w-full flex items-center justify-center gap-1 px-2 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      <LogOut size={14} /> Logg ut
                    </button>
                  </div>
                )}
              </div>
            )}

            {currentLevel < 3 && (
              <button
                onClick={handleUpgrade}
                title={sidebarCollapsed ? 'Oppgrader' : undefined}
                className={`mt-2 w-full flex items-center ${sidebarCollapsed ? 'justify-center px-0 py-2' : 'gap-3 px-3 py-2'} rounded-lg text-sm font-medium text-violet-600 hover:text-violet-500 ${isLight ? 'hover:bg-violet-50' : 'hover:bg-violet-500/10'} transition-colors`}
              >
                <ArrowUpCircle size={16} />
                {!sidebarCollapsed && <span>Oppgrader</span>}
              </button>
            )}
          </div>
        </aside>

        {/* Mobil-overlay bak sidebar */}
        {mobileNavOpen && (
          <button
            type="button"
            aria-label="Lukk meny"
            onClick={() => { setMobileNavOpen(false); setUserFooterMenuOpen(false); }}
            className="md:hidden fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-sm"
          />
        )}

        {/* Hovedinnhold-kolonne */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Mobil-toppbar med hamburger */}
          <header className={`md:hidden sticky top-0 z-20 h-14 px-4 flex items-center justify-between border-b ${navBorder} ${navBg} backdrop-blur`}>
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className={`p-2 -ml-2 rounded-md ${textDim} hover:${textMain}`}
              aria-label="Åpne meny"
            >
              <Menu size={20} />
            </button>
            <span className={`text-sm font-semibold ${textMain}`}>
              {activeTab === 'settings' ? 'Innstillinger' : (navItems.find((n) => n.id === activeTab)?.label || 'Sikt')}
            </span>
            <div className="w-8" />
          </header>

          <main className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {/* =============================================================== */}
        {/* HJEM — én skjerm, vertikal feed. Maks én primær handling synlig. */}
        {/* =============================================================== */}
        {activeTab === 'home' && (
          <>
            <DashboardHome
              user={user}
              clientData={clientData}
              formData={formData}
              analysisResults={analysisResults}
              scoreHistory={scoreHistory}
              siktActions={siktActions}
              realRankings={realRankings}
              gscConnected={gscConnected}
              gscKeywords={gscKeywords}
              isAnalyzing={isAnalyzing}
              onRunAnalysis={runRealAnalysis}
              onNavigate={setActiveTab}
            />
            <div className="max-w-5xl mx-auto px-4 mt-12 pb-20">
              <DashboardCompetitorWidget
                userId={user.id}
                theme={themed}
                onNavigate={() => setActiveTab('competitors')}
              />
            </div>
          </>
        )}
        {false && activeTab === 'home' && (
          <div className="space-y-6">
            {showFirstAnalysisBanner && (
              <div className={`rounded-xl border ${divider} ${isLight ? 'bg-violet-50' : 'bg-violet-950/30'} px-4 py-3 flex items-start justify-between gap-3`}>
                <p className={`text-sm ${textMain}`}>
                  👋 Velkommen til Sikt! Vi analyserer nettsiden din nå. Resultatene vises her om 30-60 sekunder.
                </p>
                <button
                  type="button"
                  onClick={() => setShowFirstAnalysisBanner(false)}
                  className={`shrink-0 p-1 rounded-md ${textDim} hover:${textMain}`}
                  aria-label="Lukk velkomstmelding"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* HERO — radial-score + greeting + neste handling. Subtil violet aksent. */}
            <div
              className={`rounded-2xl border ${divider} ${isLight ? 'bg-gradient-to-br from-white to-violet-50/40' : 'bg-gradient-to-br from-slate-900/60 to-violet-950/40'} px-6 py-6 sm:px-8 sm:py-7 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between`}
            >
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${textDim}`}>
                  {isFirstVisit ? `Velkommen, ${firstName}.` : `Hei ${firstName}.`}
                </p>
                <h1 className={`text-2xl sm:text-3xl font-semibold tracking-tight mt-1 ${textMain}`}>
                  {combinedScore == null ? (
                    'Klar for første sjekk?'
                  ) : (
                    <>
                      Sikt-scoren din er{' '}
                      <span className={scoreTone === 'good' ? 'text-emerald-600' : scoreTone === 'warn' ? 'text-amber-600' : 'text-rose-600'}>
                        {combinedScore >= 80 ? 'sterk' : combinedScore >= 60 ? 'god' : 'svak'}
                      </span>
                      .
                    </>
                  )}
                </h1>
                <p className={`text-sm mt-2 ${textDim}`}>
                  {!websiteUrl
                    ? 'Legg inn nettsiden din i Innstillinger, så starter Sikt å jobbe.'
                    : !analysisResults
                      ? 'Kjør første tekniske sjekk og få Lighthouse-resultatet på 30 sekunder.'
                      : todos.length === 0
                        ? 'Ingenting krever oppmerksomhet akkurat nå. Bra jobbet.'
                        : `Du har ${todos.length} ${todos.length === 1 ? 'oppgave' : 'oppgaver'} å se på i dag.`}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {!websiteUrl ? (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('settings'); setEditingSection('profile'); }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors"
                    >
                      <Globe size={14} /> Legg til nettside
                    </button>
                  ) : !analysisResults ? (
                    <button
                      type="button"
                      onClick={() => runRealAnalysis()}
                      disabled={isAnalyzing}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors disabled:opacity-50"
                    >
                      <Activity size={14} /> {isAnalyzing ? 'Kjører…' : 'Kjør første analyse'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveTab('log')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors"
                    >
                      <ClipboardCheck size={14} /> Se Sikt-loggen
                    </button>
                  )}
                  {analysisResults && scoreHistory.length > 0 && (
                    <span className={`inline-flex items-center text-xs ${textLabel} px-2`}>
                      Sjekket {new Date(scoreHistory[scoreHistory.length - 1].at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-center gap-3 shrink-0">
                  <RadialScore value={combinedScore} theme={themed} size={108} />
                  {/* Sub-score breakdown — viser hva totalscoren består av med tydelig fallback */}
                  <div className="flex flex-wrap items-start justify-center gap-2 max-w-[300px]">
                    {(() => {
                      const tech = scores.technical;
                      const vis = scores.visibility;
                      const toneClass = (v: number | null) => {
                        const tone: 'good' | 'warn' | 'bad' | 'neutral' =
                          v == null ? 'neutral' : v >= 80 ? 'good' : v >= 60 ? 'warn' : 'bad';
                        return tone === 'good'
                          ? (isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20')
                          : tone === 'warn'
                            ? (isLight ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-amber-500/10 text-amber-300 border-amber-500/20')
                            : tone === 'bad'
                              ? (isLight ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-rose-500/10 text-rose-300 border-rose-500/20')
                              : (isLight ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-800 text-slate-400 border-white/10');
                      };

                      return (
                        <>
                          <div className="flex flex-col items-center gap-1">
                            <div className={`rounded-lg border px-2 py-1 text-center ${toneClass(tech)}`}>
                              <div className="flex items-center justify-center gap-1 mb-1">
                                <span className="text-[11px] font-medium">Technical Score</span>
                                <HoverTooltip text="Score fra 0-100 basert på lastetid, mobile-vennlighet, sikkerhet og SEO-teknisk." />
                              </div>
                              {scoresLoading ? (
                                <div className="flex items-center justify-center p-2">
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                </div>
                              ) : tech == null ? (
                                <div className="text-center">
                                  <div className="text-4xl font-bold text-gray-400">—</div>
                                  <button
                                    onClick={() => runRealAnalysis()}
                                    className="mt-2 text-sm text-blue-600 hover:underline"
                                  >
                                    Kjør analyse
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className={`text-2xl font-bold ${getScoreColor(tech).color}`}>{tech}</span>
                                  <span className="text-[11px] text-gray-600">{getScoreColor(tech).emoji} {getScoreColor(tech).label}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-center gap-1">
                            <div className={`rounded-lg border px-2 py-1 text-center ${toneClass(vis)}`}>
                              <div className="flex items-center justify-center gap-1 mb-1">
                                <span className="text-[11px] font-medium">Visibility Score</span>
                                <HoverTooltip text="Synlighetsscore fra 0-100 basert på søkeordsdata fra Google Search Console." />
                              </div>
                              {!gscConnected ? (
                                <div className="text-center">
                                  <Link2 className="w-8 h-8 text-gray-400 mb-2 mx-auto" />
                                  <button
                                    onClick={() => setActiveTab('keywords')}
                                    className="text-sm text-blue-600 hover:underline"
                                  >
                                    Koble til
                                  </button>
                                </div>
                              ) : scoresLoading ? (
                                <div className="flex items-center justify-center p-2">
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                </div>
                              ) : vis == null ? (
                                <div className="text-center">
                                  <div className="text-4xl font-bold text-gray-400">—</div>
                                  <div className="text-xs text-gray-500 mt-1">Henter data...</div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className={`text-2xl font-bold ${getScoreColor(vis).color}`}>{vis}</span>
                                  <span className="text-[11px] text-gray-600">{getScoreColor(vis).emoji} {getScoreColor(vis).label}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-center gap-1">
                            <div className={`rounded-lg border px-2 py-1 text-center ${toneClass(null)}`}>
                              <div className="flex items-center justify-center gap-1 mb-1">
                                <span className="text-[11px] font-medium">GEO</span>
                                <HoverTooltip text="GEO viser synlighet i AI-søk. Full automatisk scoring lanseres i Q3 2026." />
                              </div>
                              <div className="text-center">
                                <div className="text-4xl font-bold text-gray-400">—</div>
                                <div className="text-xs text-gray-500 mt-1">Kommer Q3 2026</div>
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
            </div>

            {analyzeError && (
              <div className={`rounded-xl px-4 py-3 text-sm border ${isLight ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-rose-500/10 text-rose-300 border-rose-500/20'}`}>
                {analyzeError}
              </div>
            )}
            {isAnalyzing && (
              <div className={`rounded-xl border ${divider} px-5 py-4`}>
                <p className={`text-sm ${textMain} mb-2`}>{progressText}</p>
                <div className={`h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-slate-800'}`}>
                  <div className="h-full bg-violet-600 transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            {autoScanInfo.active && !isAnalyzing && (
              <div className={`rounded-xl border ${isLight ? 'bg-violet-50/60 border-violet-100' : 'bg-violet-500/10 border-violet-500/20'} px-4 py-3 flex items-center gap-3`}>
                <Loader2 size={14} className="text-violet-600 animate-spin shrink-0" />
                <p className={`text-sm ${isLight ? 'text-violet-900' : 'text-violet-200'} flex-1 min-w-0 truncate`}>
                  Sikt jobber i bakgrunnen — {autoScanInfo.label}
                </p>
              </div>
            )}

            {/* OVERSIKT-KORT — Besøkende + Synlighet med periode-velger */}
            {(() => {
              // Besøkende: ingen GA-kobling ennå — klar for ekte data fra Google Analytics API.
              // Synlighet: bruker visibilityScore (ekte data fra søkeordrangeringer).
              const periodLabel = overviewPeriod === '1M' ? '1 måned' : overviewPeriod === '2M' ? '2 måneder' : '3 måneder';

              // Endrings-pil for synlighet basert paa scoreHistory (mobileSeo-trenden).
              const synlighetDelta: number | null = (() => {
                if (scoreHistory.length < 2) return null;
                const latest = scoreHistory[scoreHistory.length - 1].mobileSeo;
                // finn referansepunkt basert paa periode
                const months = overviewPeriod === '1M' ? 1 : overviewPeriod === '2M' ? 2 : 3;
                const msBack = months * 30 * 24 * 60 * 60 * 1000;
                const ref = [...scoreHistory].reverse().find((h) => Date.now() - new Date(h.at).getTime() >= msBack);
                if (!ref) return null;
                return Math.round(latest - ref.mobileSeo);
              })();

              const visDeltaColor = synlighetDelta == null ? textLabel
                : synlighetDelta > 0 ? 'text-emerald-600'
                : synlighetDelta < 0 ? 'text-rose-600'
                : textLabel;

              return (
                <div className={`rounded-2xl border ${divider} ${isLight ? 'bg-white' : 'bg-slate-900/40'} px-5 py-5 sm:px-6`}>
                  {/* Header rad */}
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <div>
                      <h2 className={`text-sm font-semibold uppercase tracking-wide ${textLabel}`}>Din oversikt</h2>
                    </div>
                    {/* Periode-velger */}
                    <div className={`inline-flex rounded-lg border ${divider} p-0.5 gap-0.5`}>
                      {(['1M', '2M', '3M'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setOverviewPeriod(p)}
                          className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                            overviewPeriod === p
                              ? (isLight ? 'bg-slate-900 text-white' : 'bg-white text-slate-900')
                              : `${textDim} hover:${textMain}`
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* To KPI-bokser side om side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    {/* BESØKENDE */}
                    <div className={`rounded-xl border ${isLight ? 'border-slate-100 bg-slate-50/60' : 'border-white/8 bg-slate-800/40'} p-4`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`text-xs font-medium uppercase tracking-wide ${textLabel} inline-flex items-center gap-1`}>
                          Besøkende
                          <HoverTooltip text="Antall brukere fra Google Analytics for valgt periode. Vises når Analytics er koblet til." />
                        </span>
                        <span className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${isLight ? 'bg-violet-50 text-violet-600' : 'bg-violet-500/10 text-violet-400'}`}>
                          <Users size={12} />
                        </span>
                      </div>
                      {/* Ingen GA-data ennå */}
                      <p className={`text-3xl font-semibold ${textMain} leading-none mb-1`}>—</p>
                      <p className={`text-xs ${textDim}`}>
                        Koble til Google Analytics for å se besøkende de siste{' '}
                        <button
                          type="button"
                          onClick={() => { setActiveTab('settings'); }}
                          className="text-violet-600 hover:text-violet-500 font-medium underline underline-offset-2"
                        >
                          {periodLabel}
                        </button>
                      </p>
                    </div>

                    {/* SYNLIGHET */}
                    <div className={`rounded-xl border ${isLight ? 'border-slate-100 bg-slate-50/60' : 'border-white/8 bg-slate-800/40'} p-4`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`text-xs font-medium uppercase tracking-wide ${textLabel} inline-flex items-center gap-1`}>
                          Synlighet
                          <HoverTooltip text="0-100 basert på plasseringene dine for sporede søkeord. Topp 3 gir mest poeng." />
                        </span>
                        <span className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${isLight ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/10 text-emerald-400'}`}>
                          <Search size={12} />
                        </span>
                      </div>
                      <div className="flex items-end gap-2 mb-1">
                        <p className={`text-3xl font-semibold ${textMain} leading-none`}>
                          {visibilityScore != null ? `${visibilityScore}` : '—'}
                        </p>
                        {visibilityScore != null && (
                          <span className={`text-sm ${textDim} mb-0.5`}>/ 100</span>
                        )}
                        {synlighetDelta != null && synlighetDelta !== 0 && (
                          <span className={`text-sm font-semibold mb-0.5 ${visDeltaColor}`}>
                            {synlighetDelta > 0 ? `+${synlighetDelta}` : synlighetDelta}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs ${textDim}`}>
                        {visibilityScore == null
                          ? 'Kjør søkeordsjekk for å måle synlighet'
                          : synlighetDelta == null
                            ? `Basert på ${realRankings.length} sporede søkeord`
                            : `${synlighetDelta >= 0 ? 'Økt' : 'Redusert'} siste ${periodLabel} · ${realRankings.length} søkeord`}
                      </p>
                    </div>

                  </div>
                </div>
              );
            })()}

            {/* KPI-RAD — fire tiles med subtile fargeaksenter + sparklines. */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiTile
                theme={themed}
                label="Sikt-score"
                value={combinedScore == null ? '—' : `${combinedScore}`}
                hint={
                  combinedScore == null
                    ? 'Ikke målt enda'
                    : (
                        <span>
                          Tek {technicalScore ?? '—'} · Syn {visibilityScore ?? '—'}
                          {hasPremium ? <> · GEO {geoScore ?? '—'}</> : null}
                        </span>
                      )
                }
                accent={scoreTone === 'good' ? 'emerald' : scoreTone === 'warn' ? 'amber' : scoreTone === 'bad' ? 'rose' : 'slate'}
                spark={scoreSpark.length >= 2 ? scoreSpark : undefined}
                icon={<Activity size={14} />}
                tooltip="Samlet score fra teknisk helse, søkesynlighet og GEO når tilgjengelig. Høyere betyr bedre."
              />
              <KpiTile
                theme={themed}
                label="Topp 10 søkeord"
                value={top10Count}
                hint={
                  realRankings.length === 0
                    ? 'Ikke sjekket enda'
                    : top3Count > 0
                      ? <>{top3Count} på topp 3</>
                      : <>{realRankings.length - top10Count} utenfor topp 10</>
                }
                accent={top10Count > 0 ? 'violet' : 'slate'}
                icon={<Search size={14} />}
                tooltip="Antall sporede søkeord der siden din vises blant topp 10 i Google-resultatene."
              />
              <KpiTile
                theme={themed}
                label="Aktivitet 7d"
                value={actionsLast7d}
                hint={fixesLast7d > 0 ? <>{fixesLast7d} {fixesLast7d === 1 ? 'fiks' : 'fikser'}</> : 'Ingen fikser enda'}
                accent={actionsLast7d > 0 ? 'emerald' : 'slate'}
                spark={activityByDay.some((v) => v > 0) ? activityByDay : undefined}
                icon={<Sparkles size={14} />}
                tooltip="Antall funn, forslag, varsler og fikser Sikt har registrert de siste 7 dagene."
              />
              <KpiTile
                theme={themed}
                label="Å fikse"
                value={todos.length}
                hint={todos.length === 0 ? 'Alt på stell' : <>{todayTodos.length} prioritert</>}
                accent={todos.length > 5 ? 'amber' : todos.length > 0 ? 'violet' : 'emerald'}
                icon={<Wrench size={14} />}
                tooltip="Antall prioriterte oppgaver Sikt mener bør løses basert på analyser og søkeordsdata."
              />
            </div>

            {/* I DAG — 3 prioriterte oppgaver (eller tom-tilstand med proaktive forslag) */}
            <PortalCard theme={themed} className="p-6 sm:p-8">
              <CardHeader
                theme={themed}
                icon={<Target size={16} />}
                accent={todos.length === 0 ? 'emerald' : todos.length > 5 ? 'amber' : 'violet'}
                title="I dag"
                subtitle={todos.length === 0 ? 'Ingenting krever oppmerksomhet akkurat nå.' : `${todos.length} ${todos.length === 1 ? 'oppgave' : 'oppgaver'} sortert etter effekt`}
                action={
                  todos.length > 3 && (
                    <span className={`text-xs ${textLabel}`}>
                      Topp 3 av {todos.length}
                    </span>
                  )
                }
              />

              {todos.length === 0 ? (
                <div className={`rounded-xl px-5 py-8 ${subtleBg} space-y-4`}>
                  <p className={`text-sm ${textMain}`}>Alt ser bra ut. Her er noen ting du kan gjøre uansett:</p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-3">
                      <span className={`w-1 h-1 rounded-full ${isLight ? 'bg-slate-400' : 'bg-slate-500'}`} />
                      <button onClick={() => runRealAnalysis()} className="text-violet-600 hover:text-violet-500 font-medium">Kjør en ny teknisk sjekk</button>
                    </li>
                    <li className="flex items-center gap-3">
                      <span className={`w-1 h-1 rounded-full ${isLight ? 'bg-slate-400' : 'bg-slate-500'}`} />
                      <button onClick={() => setActiveTab('keywords')} className="text-violet-600 hover:text-violet-500 font-medium">Legg til flere søkeord å spore</button>
                    </li>
                    {hasStandardOrHigher && !hostConnection && (
                      <li className="flex items-center gap-3">
                        <span className={`w-1 h-1 rounded-full ${isLight ? 'bg-slate-400' : 'bg-slate-500'}`} />
                        <button onClick={() => { setActiveTab('settings'); setShowHostModal(true); }} className="text-violet-600 hover:text-violet-500 font-medium">Koble til CMS for auto-fiks</button>
                      </li>
                    )}
                  </ul>
                </div>
              ) : (
                <ul className={`divide-y ${divider} -mx-2`}>
                  {todayTodos.map((t) => {
                    const kindStyle: Record<TodoKind, { label: string; bg: string; fg: string }> = {
                      pagespeed:  { label: 'P', bg: isLight ? 'bg-violet-100'  : 'bg-violet-500/15',  fg: 'text-violet-700' },
                      keyword:    { label: 'K', bg: isLight ? 'bg-emerald-100' : 'bg-emerald-500/15', fg: 'text-emerald-700' },
                      content:    { label: 'I', bg: isLight ? 'bg-sky-100'     : 'bg-sky-500/15',     fg: 'text-sky-700' },
                      onboarding: { label: '!', bg: isLight ? 'bg-amber-100'   : 'bg-amber-500/15',   fg: 'text-amber-700' },
                      competitor: { label: 'C', bg: isLight ? 'bg-rose-100'    : 'bg-rose-500/15',    fg: 'text-rose-700' },
                      geo:        { label: 'A', bg: isLight ? 'bg-violet-100'  : 'bg-violet-500/15',  fg: 'text-violet-700' },
                    };
                    const k = kindStyle[t.kind];
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={t.action.onClick}
                          className={`w-full flex items-start gap-4 px-2 py-4 text-left rounded-lg hover:${subtleBg} transition-colors group`}
                        >
                          <span className={`shrink-0 w-8 h-8 rounded-lg ${k.bg} ${k.fg} text-sm font-bold flex items-center justify-center mt-0.5`}>
                            {k.label}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium ${textMain}`}>{t.title}</p>
                            <p className={`text-xs mt-1 ${textDim}`}>{t.desc}</p>
                          </div>
                          <span className={`shrink-0 inline-flex items-center gap-1 text-sm font-medium text-violet-600 group-hover:text-violet-500 mt-1.5`}>
                            {t.action.label} <ChevronRight size={14} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {moreTodos.length > 0 && (
                <div className={`pt-5 mt-2 border-t ${divider}`}>
                  <button
                    type="button"
                    onClick={() => setShowAllTodos((v) => !v)}
                    className={`text-sm font-medium ${textDim} hover:${textMain} inline-flex items-center gap-1`}
                  >
                    {showAllTodos ? `Skjul ${moreTodos.length} ekstra` : `Vis ${moreTodos.length} flere å fikse`}
                    <ChevronDown size={14} className={`transition-transform ${showAllTodos ? 'rotate-180' : ''}`} />
                  </button>
                  {showAllTodos && (
                    <ul className={`mt-3 divide-y ${divider}`}>
                      {moreTodos.map((t) => (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={t.action.onClick}
                            className={`w-full flex items-center justify-between gap-3 py-3 text-left hover:${subtleBg} px-2 rounded-lg`}
                          >
                            <div className="min-w-0">
                              <p className={`text-sm ${textMain} truncate`}>{t.title}</p>
                              <p className={`text-xs mt-0.5 ${textDim} truncate`}>{t.desc}</p>
                            </div>
                            <ChevronRight size={14} className={`shrink-0 ${textDim}`} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </PortalCard>

            {/* DETTE HAR SIKT GJORT SIDEN SIST — aktivitetsfeed */}
            <PortalCard theme={themed} className="p-6 sm:p-8">
              <CardHeader
                theme={themed}
                icon={<Activity size={16} />}
                accent="sky"
                title="Dette har Sikt gjort siden sist"
                subtitle={homeFeedActions.length > 0 ? 'Aktivitet i bakgrunnen — fikser, funn og varsler.' : 'Sikt har ikke logget noe enda.'}
                action={
                  homeFeedActions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('log')}
                      className="text-sm font-medium text-violet-600 hover:text-violet-500 inline-flex items-center gap-1"
                    >
                      Se hele loggen <ArrowRight size={14} />
                    </button>
                  )
                }
              />

              {homeFeedActions.length === 0 ? (
                <div className={`rounded-xl px-5 py-6 text-center ${subtleBg}`}>
                  <p className={`text-sm ${textDim}`}>
                    {hasStandardOrHigher ? 'Sikt jobber i bakgrunnen — kom tilbake i morgen.' : 'Kjør en analyse, så dukker første funn opp her.'}
                  </p>
                </div>
              ) : (
                <ol className="relative pl-6">
                  {/* Vertikal tidslinje-strek */}
                  <span className={`absolute top-2 bottom-2 left-[7px] w-px ${isLight ? 'bg-slate-200' : 'bg-white/10'}`} aria-hidden />
                  {homeFeedActions.map((a: any) => {
                    const meta = categoryMeta(a.category);
                    const ts = new Date(a.created_at);
                    const diffMs = Date.now() - ts.getTime();
                    const diffH = Math.round(diffMs / (1000 * 60 * 60));
                    const diffD = Math.round(diffMs / (1000 * 60 * 60 * 24));
                    const ago = diffH < 1 ? 'nå' : diffH < 24 ? `${diffH}t` : diffD === 1 ? '1 dg' : `${diffD} dg`;
                    return (
                      <li key={a.id} className="relative flex items-start gap-3 py-3">
                        <span
                          className={`absolute -left-6 mt-1.5 w-3.5 h-3.5 rounded-full ${meta.dot} ring-4 ${isLight ? 'ring-white' : 'ring-slate-900'} shrink-0`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm ${textMain} truncate`}>{a.title}</p>
                          <p className={`text-xs mt-0.5 ${textDim}`}>{meta.label}</p>
                        </div>
                        <span className={`shrink-0 text-xs ${textLabel} font-mono tabular-nums`}>{ago}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </PortalCard>
          </div>
        )}

        {/* =============================================================== */}
        {/* SYNLIGHET — sub-faner: PageSpeed, Innhold, Lenker.              */}
        {/* =============================================================== */}
        {activeTab === 'visibility' && (() => {
          const palette = {
            bg: '#F5F5F0',
            card: '#FFFFFF',
            ink: '#1A1A1A',
            muted: '#808080',
            border: '#EBEBE6',
            success: '#52A447',
            successBg: '#EAF4E8',
            warn: '#B57A1A',
            warnBg: '#F8F0DE',
            danger: '#C75353',
            dangerBg: '#FBECEC',
          };
          const tabItems = [
            { id: 'pagespeed', label: 'PageSpeed' },
            { id: 'content', label: 'Innhold' },
            { id: 'links', label: 'Lenker' },
          ] as const;
          const latestRun = scoreHistory.length > 0 ? scoreHistory[scoreHistory.length - 1] : null;
          const latestLabel = latestRun
            ? new Date(latestRun.at).toLocaleString('nb-NO', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
            : 'Ingen analyse ennå';
          const totalTone = totalScore == null ? 'n/a' : totalScore >= 80 ? 'God' : totalScore >= 60 ? 'Advarsel' : 'Svak';
          const contentCriticalCount = contentPages.filter((p: any) => p?.status === 'Kritisk').length;
          const linksIsolatedCount = linkPages.filter((p: any) => p?.status === 'Isolert' || p?.inlinks === 0 || p?.isolated).length;

          const metricTone = (score: number): 'good' | 'warn' | 'bad' => (score >= 0.9 ? 'good' : score >= 0.5 ? 'warn' : 'bad');
          const scoreTone = (value: number): 'good' | 'warn' | 'bad' => (value >= 80 ? 'good' : value >= 60 ? 'warn' : 'bad');
          const tonePill = (tone: 'good' | 'warn' | 'bad') => {
            if (tone === 'good') return { bg: palette.successBg, fg: palette.success, label: 'God' };
            if (tone === 'warn') return { bg: palette.warnBg, fg: palette.warn, label: 'Advarsel' };
            return { bg: palette.dangerBg, fg: palette.danger, label: 'Dårlig' };
          };

          return (
            <div className="space-y-5 px-2 sm:px-3 py-1" style={{ background: palette.bg, color: palette.ink }}>
              <header className="space-y-2">
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: palette.ink }}>Synlighet</h1>
                <p className="text-base" style={{ color: palette.muted }}>Hvordan ser Google nettsiden din — fart, innhold og lenker.</p>
              </header>

              <div className="border-b pb-3 flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: palette.border }}>
                <div className="inline-flex items-center gap-2">
                  {tabItems.map((sub) => {
                    const active = visibilitySubTab === sub.id;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setVisibilitySubTab(sub.id)}
                        className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                        style={{
                          border: active ? `2px solid ${palette.ink}` : '2px solid transparent',
                          background: active ? palette.card : 'transparent',
                          color: active ? palette.ink : palette.muted,
                        }}
                      >
                        {sub.label}
                      </button>
                    );
                  })}
                </div>

                {visibilitySubTab === 'pagespeed' && (
                  <button
                    type="button"
                    onClick={runRealAnalysis}
                    disabled={isAnalyzing}
                    className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-transform active:scale-[0.97] disabled:opacity-60"
                    style={{ background: palette.ink, color: '#fff' }}
                  >
                    <RefreshCw size={14} className={isAnalyzing ? 'animate-spin' : ''} />
                    {isAnalyzing ? 'Kjører test…' : analysisResults ? 'Kjør ny test' : 'Kjør første test'}
                  </button>
                )}

                {visibilitySubTab === 'content' && (
                  <button
                    type="button"
                    onClick={() => runContentScan(contentPages.length > 0)}
                    disabled={isScanning}
                    className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-transform active:scale-[0.97] disabled:opacity-60"
                    style={{ background: palette.ink, color: '#fff' }}
                  >
                    <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
                    {isScanning ? 'Skanner…' : contentPages.length > 0 ? 'Skann på nytt' : 'Start skann'}
                  </button>
                )}

                {visibilitySubTab === 'links' && (
                  <button
                    type="button"
                    onClick={runLinkScan}
                    disabled={isScanningLinks}
                    className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-transform active:scale-[0.97] disabled:opacity-60"
                    style={{ background: palette.ink, color: '#fff' }}
                  >
                    <RefreshCw size={14} className={isScanningLinks ? 'animate-spin' : ''} />
                    {isScanningLinks ? 'Skanner…' : linkPages.length > 0 ? 'Skann på nytt' : 'Start skann'}
                  </button>
                )}
              </div>

              {visibilitySubTab === 'pagespeed' && (
                <section className="space-y-4">
                  <div className="flex items-center gap-4 text-sm flex-wrap" style={{ color: palette.muted }}>
                    <span>Siste analyse: <strong style={{ color: palette.ink }}>{latestLabel}</strong></span>
                    <span>Mobil Lighthouse</span>
                  </div>

                  {!analysisResults ? (
                    <div className="rounded-xl p-7 text-sm" style={{ background: palette.card, border: `1px solid ${palette.border}`, color: palette.muted }}>
                      Trykk «Kjør første test», så henter vi resultatene på ca. 30 sekunder.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <article className="rounded-xl p-4" style={{ background: palette.card, border: `1px solid ${palette.border}` }}>
                          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: palette.muted }}>Total score</p>
                          <p className="text-5xl font-semibold mt-2 leading-none" style={{ color: palette.ink }}>{totalScore ?? '—'}</p>
                          <div className="mt-3 inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold" style={{ background: totalScore != null && totalScore >= 60 ? palette.successBg : palette.warnBg, color: totalScore != null && totalScore >= 60 ? palette.success : palette.warn }}>
                            {totalTone}
                          </div>
                          <p className="text-xs mt-2" style={{ color: palette.muted }}>av 4 Lighthouse-kategorier</p>
                        </article>

                        {[
                          { label: 'Fart', metric: 'LCP', value: analysisResults.mobile.lcp.value, score: analysisResults.mobile.lcp.score },
                          { label: 'Respons', metric: 'TBT', value: analysisResults.mobile.tbt.value, score: analysisResults.mobile.tbt.score },
                          { label: 'Stabilitet', metric: 'CLS', value: analysisResults.mobile.cls.value, score: analysisResults.mobile.cls.score },
                        ].map((m, i) => {
                          const tone = tonePill(metricTone(m.score));
                          return (
                            <article key={i} className="rounded-xl p-4" style={{ background: palette.card, border: `1px solid ${palette.border}` }}>
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <p className="text-sm font-semibold" style={{ color: palette.ink }}>{m.label}</p>
                                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: tone.bg, color: tone.fg }}>
                                  {tone.label}
                                </span>
                              </div>
                              <p className="text-xs mb-2" style={{ color: palette.muted }}>{m.metric}</p>
                              <p className="text-4xl font-semibold leading-none" style={{ color: palette.ink }}>{m.value}</p>
                            </article>
                          );
                        })}
                      </div>

                      <div className="rounded-xl p-4 space-y-3" style={{ background: palette.card, border: `1px solid ${palette.border}` }}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold" style={{ color: palette.ink }}>Lighthouse-kategorier</p>
                          <span className="text-xs" style={{ color: palette.muted }}>Mobilversjon /100</span>
                        </div>
                        {[
                          { label: 'Ytelse', value: Math.round(perfMobile ?? 0) },
                          { label: 'SEO', value: Math.round(seoMobile ?? 0) },
                          { label: 'Beste praksis', value: Math.round(bpMobile ?? 0) },
                          { label: 'Tilgjengelighet', value: Math.round(a11yMobile ?? 0) },
                        ].map((row, i) => {
                          const tone = tonePill(scoreTone(row.value));
                          return (
                            <div key={i} className="space-y-1">
                              <div className="flex items-center justify-between gap-2 text-sm">
                                <span style={{ color: palette.ink }}>{row.label}</span>
                                <div className="inline-flex items-center gap-2">
                                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: tone.bg, color: tone.fg }}>
                                    {tone.label}
                                  </span>
                                  <span className="font-semibold" style={{ color: palette.ink }}>{row.value}</span>
                                </div>
                              </div>
                              <div className="h-2 rounded-full overflow-hidden" style={{ background: palette.border }}>
                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${row.value}%`, background: scoreTone(row.value) === 'good' ? palette.success : scoreTone(row.value) === 'warn' ? palette.warn : palette.danger }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="rounded-xl p-4" style={{ background: palette.card, border: `1px solid ${palette.border}` }}>
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <p className="text-sm font-semibold" style={{ color: palette.ink }}>Forbedringsmuligheter</p>
                            <span className="text-xs" style={{ color: palette.muted }}>Klikk for å åpne Verksted</span>
                          </div>

                          {(analysisResults.mobile.opportunities || []).length === 0 ? (
                            <p className="text-sm" style={{ color: palette.muted }}>Ingen konkrete forslag funnet i siste kjøring.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {analysisResults.mobile.opportunities.slice(0, 6).map((o: any, i: number) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => {
                                    setActiveSolveProblem({ raw: o, title: o.title });
                                    setActiveTab('workshop');
                                    setExpandedWorkshopProblem(`ps-${o.title}`);
                                  }}
                                  className="w-full rounded-lg px-3 py-2.5 text-left flex items-center justify-between gap-2 transition-colors"
                                  style={{ border: `1px solid ${palette.border}` }}
                                >
                                  <span className="inline-flex items-start gap-2 min-w-0">
                                    <AlertTriangle size={13} style={{ color: palette.warn }} className="shrink-0 mt-0.5" />
                                    <span className="min-w-0">
                                      <span className="block text-sm font-medium truncate" style={{ color: palette.ink }}>{o.title}</span>
                                      {o.savings ? <span className="block text-xs" style={{ color: palette.muted }}>{o.savings}</span> : null}
                                    </span>
                                  </span>
                                  <ArrowRight size={14} style={{ color: palette.muted }} className="shrink-0" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="rounded-xl p-4" style={{ background: palette.card, border: `1px solid ${palette.border}` }}>
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <p className="text-sm font-semibold" style={{ color: palette.ink }}>Utvikling over tid</p>
                            <div className="text-xs flex items-center gap-3" style={{ color: palette.muted }}>
                              <span className="inline-flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full" style={{ background: palette.success }} />
                                Ytelse
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full" style={{ background: palette.ink }} />
                                SEO
                              </span>
                            </div>
                          </div>

                          {scoreHistory.length < 2 ? (
                            <p className="text-sm" style={{ color: palette.muted }}>Grafen vises når du har minst to målepunkter.</p>
                          ) : (
                            <div className="h-52">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                  data={scoreHistory.map((h, i) => ({ idx: i, perf: h.mobilePerf, seo: h.mobileSeo }))}
                                  margin={{ top: 6, right: 6, bottom: 0, left: -20 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={palette.border} />
                                  <XAxis dataKey="idx" tick={false} axisLine={false} tickLine={false} />
                                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: palette.muted }} axisLine={false} tickLine={false} />
                                  <RechartsTooltip
                                    contentStyle={{ background: '#fff', border: `1px solid ${palette.border}`, borderRadius: 10, fontSize: 12 }}
                                    labelFormatter={(idx: number) => scoreHistory[idx] ? new Date(scoreHistory[idx].at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) : ''}
                                  />
                                  <Line type="monotone" dataKey="perf" stroke={palette.success} strokeWidth={2.5} dot={false} />
                                  <Line type="monotone" dataKey="seo" stroke={palette.ink} strokeWidth={2.5} dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {visibilitySubTab === 'content' && (
                <section className="rounded-xl overflow-hidden" style={{ background: palette.card, border: `1px solid ${palette.border}` }}>
                  <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap border-b" style={{ borderColor: palette.border }}>
                    <div className="flex items-center gap-4 text-sm">
                      <span style={{ color: palette.ink }}><strong>{contentPages.length}</strong> sider skannet</span>
                      <span style={{ color: contentCriticalCount > 0 ? palette.danger : palette.muted }}>
                        {contentCriticalCount} kritiske
                      </span>
                    </div>
                  </div>

                  {contentPages.length === 0 ? (
                    <div className="p-7 text-sm" style={{ color: palette.muted }}>
                      Trykk «Start skann», så går vi gjennom sider for meta, overskrifter og alt-tekster.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px]">
                        <thead>
                          <tr style={{ background: palette.bg, color: palette.muted }}>
                            <th className="text-left text-xs font-semibold px-4 py-2.5">SIDE</th>
                            <th className="text-left text-xs font-semibold px-4 py-2.5">URL</th>
                            <th className="text-right text-xs font-semibold px-4 py-2.5">FUNN</th>
                          </tr>
                        </thead>
                        <tbody>
                          {contentPages.slice(0, 30).map((p: any, i: number) => {
                            const issues = (p.issues || []).length;
                            const critical = p?.status === 'Kritisk' || issues >= 3;
                            const warn = issues > 0 && !critical;
                            return (
                              <tr key={i} style={{ borderTop: `1px solid ${palette.border}` }}>
                                <td className="px-4 py-3 text-sm font-medium" style={{ color: palette.ink }}>{p.title || p.url}</td>
                                <td className="px-4 py-3 text-sm font-mono" style={{ color: palette.muted }}>{p.url}</td>
                                <td className="px-4 py-3 text-right">
                                  <span
                                    className="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold"
                                    style={{
                                      background: issues === 0 ? palette.successBg : critical ? palette.dangerBg : palette.warnBg,
                                      color: issues === 0 ? palette.success : critical ? palette.danger : palette.warn,
                                    }}
                                  >
                                    {issues === 0 ? 'OK' : warn ? `${issues} funn` : `${issues} funn`}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              {visibilitySubTab === 'links' && (
                <section className="rounded-xl overflow-hidden" style={{ background: palette.card, border: `1px solid ${palette.border}` }}>
                  <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap border-b" style={{ borderColor: palette.border }}>
                    <div className="flex items-center gap-4 text-sm">
                      <span style={{ color: palette.ink }}><strong>{linkPages.length}</strong> sider</span>
                      <span style={{ color: linksIsolatedCount > 0 ? palette.warn : palette.muted }}>
                        {linksIsolatedCount} isolert
                      </span>
                    </div>
                  </div>

                  {linkPages.length === 0 ? (
                    <div className="p-7 text-sm" style={{ color: palette.muted }}>
                      Trykk «Start skann», så kartlegger vi interne/eksterne lenker per side.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px]">
                        <thead>
                          <tr style={{ background: palette.bg, color: palette.muted }}>
                            <th className="text-left text-xs font-semibold px-4 py-2.5">SIDE</th>
                            <th className="text-right text-xs font-semibold px-4 py-2.5">INN</th>
                            <th className="text-right text-xs font-semibold px-4 py-2.5">UT</th>
                            <th className="text-right text-xs font-semibold px-4 py-2.5">STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {linkPages.slice(0, 30).map((p: any, i: number) => {
                            const brokenCount = Array.isArray(p.brokenLinks) ? p.brokenLinks.length : Number(p.brokenLinks || 0);
                            const isolated = p?.status === 'Isolert' || p?.inlinks === 0 || p?.isolated;
                            const statusText = isolated ? 'Isolert' : brokenCount > 0 ? `${brokenCount} brutte` : 'Bra';
                            const statusTone = isolated ? 'warn' : brokenCount > 0 ? 'bad' : 'good';
                            const tone = tonePill(statusTone);
                            return (
                              <tr key={i} style={{ borderTop: `1px solid ${palette.border}` }}>
                                <td className="px-4 py-3 text-sm font-medium" style={{ color: palette.ink }}>{p.title || p.url}</td>
                                <td className="px-4 py-3 text-sm text-right" style={{ color: palette.ink }}>{p.inlinks ?? 0}</td>
                                <td className="px-4 py-3 text-sm text-right" style={{ color: palette.ink }}>{p.outlinks ?? 0}</td>
                                <td className="px-4 py-3 text-right">
                                  <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold" style={{ background: tone.bg, color: tone.fg }}>
                                    {statusText}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
            </div>
          );
        })()}

        {/* =============================================================== */}
        {/* SOKEORD — egen fane.                                            */}
        {/* =============================================================== */}
        {activeTab === 'keywords' && (
          <div className="space-y-4">
            <header className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#1A1A1A' }}>Søkeord</h1>
                <p className="text-sm mt-1" style={{ color: '#808080' }}>
                  Velg et søkeord til venstre for å se detaljer
                </p>
              </div>
              {keywordsToTrack.length > 0 && (
                <button
                  onClick={handleCheckRankings}
                  disabled={rankingLoading}
                  className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg transition-transform active:scale-[0.97] disabled:opacity-60"
                  style={{ background: '#1A1A1A', color: '#fff' }}
                >
                  <Search size={14} />
                  {rankingLoading ? 'Sjekker…' : 'Sjekk rangering nå'}
                </button>
              )}
            </header>

            {/* GSC connection banner */}
            {!gscConnected && (
              <div className="rounded-xl p-4 flex items-center gap-4 justify-between flex-wrap" style={{ background: '#FFFFFF', border: '1px solid #EBEBE6' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#EBEBE6' }}>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Koble til Google Search Console</p>
                    <p className="text-xs" style={{ color: '#808080' }}>Hent dine faktiske søkeord, posisjoner, klikk og visninger direkte fra Google.</p>
                  </div>
                </div>
                {!showGscPreCheck ? (
                  <button
                    onClick={() => setShowGscPreCheck(true)}
                    className="shrink-0 inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-transform active:scale-[0.97]"
                    style={{ background: '#1A1A1A', color: '#fff' }}
                  >
                    Koble til Google
                  </button>
                ) : (
                  <GscPreCheck onConfirm={handleConnectGsc} onCancel={() => setShowGscPreCheck(false)} theme={themed} />
                )}
              </div>
            )}

            {/* Two-panel keyword layout */}
            {(() => {
              const combinedList: Array<{
                id: string; keyword: string; source: 'gsc' | 'tracked';
                location?: string; position: number | null; change: number | null;
                clicks?: number; impressions?: number; ctr?: number;
                history: any[]; url?: string | null; competitors?: any[];
              }> = [
                ...gscKeywords.map((kw: any) => ({
                  id: `gsc-${kw.keyword}`,
                  keyword: kw.keyword,
                  source: 'gsc' as const,
                  position: kw.position != null ? parseFloat(kw.position.toFixed(1)) : null,
                  change: null,
                  clicks: kw.clicks,
                  impressions: kw.impressions,
                  ctr: kw.ctr,
                  history: [],
                })),
                ...keywordsToTrack.map((k: any) => {
                  const r = realRankings.find((r: any) => r.keyword === k.keyword && r.location === k.location);
                  return {
                    id: `tracked-${k.keyword}-${k.location}`,
                    keyword: k.keyword,
                    location: k.location,
                    source: 'tracked' as const,
                    position: r?.position ?? null,
                    change: r?.change ?? null,
                    history: r?.history ?? [],
                    url: r?.url ?? null,
                    competitors: r?.competitors ?? [],
                  };
                }),
              ];

              const filtered = combinedList.filter(kw => {
                if (kwFilter === 'mine' && kw.source !== 'tracked') return false;
                if (kwFilter === 'gsc' && kw.source !== 'gsc') return false;
                if (kwSearch && !kw.keyword.toLowerCase().includes(kwSearch.toLowerCase())) return false;
                return true;
              });

              const selected = selectedKwId ? combinedList.find(k => k.id === selectedKwId) ?? null : null;

              const chartData = (() => {
                if (!selected?.history?.length) return [];
                const days = kwChartRange === '28d' ? 28 : kwChartRange === '90d' ? 90 : 365;
                return selected.history.slice(-Math.min(days, selected.history.length));
              })();

              return (
                <div className="flex gap-4" style={{ minHeight: 600 }}>
                  {/* LEFT: keyword list */}
                  <div className="flex flex-col gap-3 shrink-0" style={{ width: 260 }}>
                    {/* Search */}
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#808080' }} />
                      <input
                        type="text"
                        value={kwSearch}
                        onChange={e => setKwSearch(e.target.value)}
                        placeholder={`Søk i ${combinedList.length} søkeord…`}
                        className="w-full rounded-lg pl-8 pr-3 py-2 text-sm outline-none"
                        style={{ background: '#FFFFFF', border: '1px solid #EBEBE6', color: '#1A1A1A' }}
                      />
                    </div>

                    {/* Filter tabs */}
                    <div className="flex gap-1.5">
                      {(['all', 'mine', 'gsc'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setKwFilter(f)}
                          className="flex-1 py-1 rounded-full text-xs font-semibold transition-colors"
                          style={{
                            background: kwFilter === f ? '#1A1A1A' : '#EBEBE6',
                            color: kwFilter === f ? '#fff' : '#808080',
                          }}
                        >
                          {f === 'all' ? 'Alle' : f === 'mine' ? 'Mine' : 'GSC'}
                        </button>
                      ))}
                    </div>

                    {/* Keyword list */}
                    <div className="flex-1 overflow-y-auto rounded-xl" style={{ background: '#FFFFFF', border: '1px solid #EBEBE6', maxHeight: 420 }}>
                      {filtered.length === 0 ? (
                        <div className="p-6 text-center text-sm" style={{ color: '#808080' }}>
                          {kwSearch ? 'Ingen treff' : 'Ingen søkeord ennå'}
                        </div>
                      ) : (
                        <ul>
                          {filtered.map((kw, i) => {
                            const isSelected = selectedKwId === kw.id;
                            const posUp = kw.change !== null && kw.change > 0;
                            const posDown = kw.change !== null && kw.change < 0;
                            return (
                              <li
                                key={kw.id}
                                onClick={() => setSelectedKwId(isSelected ? null : kw.id)}
                                className="px-3 py-2.5 cursor-pointer"
                                style={{
                                  background: isSelected ? '#F5F5F0' : 'transparent',
                                  borderBottom: i < filtered.length - 1 ? '1px solid #EBEBE6' : 'none',
                                  borderLeft: isSelected ? '3px solid #1A1A1A' : '3px solid transparent',
                                  transition: 'background 150ms ease-out',
                                }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{kw.keyword}</p>
                                  <div className="flex items-center gap-0.5 shrink-0 tabular-nums">
                                    {kw.position !== null && (
                                      <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>
                                        {typeof kw.position === 'number' ? kw.position.toFixed(1) : kw.position}
                                      </span>
                                    )}
                                    {posUp && <span className="text-[11px] font-semibold ml-1" style={{ color: '#52A447' }}>▲{Math.abs(kw.change as number).toFixed(1)}</span>}
                                    {posDown && <span className="text-[11px] font-semibold ml-1" style={{ color: '#ef4444' }}>▼{Math.abs(kw.change as number).toFixed(1)}</span>}
                                    {kw.change === 0 && <span className="text-[11px] ml-1" style={{ color: '#808080' }}>—0,0</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span
                                    className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide"
                                    style={{ background: '#EBEBE6', color: '#808080' }}
                                  >
                                    {kw.source === 'gsc' ? 'GSC' : 'EGEN'}
                                  </span>
                                  {kw.location && (
                                    <span className="text-[10px] truncate" style={{ color: '#808080' }}>{kw.location}</span>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    {/* Add keyword */}
                    <div className="rounded-xl p-3" style={{ background: '#FFFFFF', border: '1px solid #EBEBE6' }}>
                      <p className="text-xs font-semibold mb-2" style={{ color: '#1A1A1A' }}>Legg til søkeord</p>
                      {canAddMoreKeywords ? (
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            value={newKeywordInput}
                            onChange={e => setNewKeywordInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddKeyword()}
                            placeholder="f.eks. rørlegger oslo"
                            className="w-full rounded-lg px-3 py-2 text-xs outline-none"
                            style={{ background: '#F5F5F0', border: '1px solid #EBEBE6', color: '#1A1A1A' }}
                          />
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={locationInput}
                              onChange={e => setLocationInput(e.target.value)}
                              placeholder="Sted"
                              className="flex-1 rounded-lg px-3 py-2 text-xs outline-none min-w-0"
                              style={{ background: '#F5F5F0', border: '1px solid #EBEBE6', color: '#1A1A1A' }}
                            />
                            <button
                              onClick={handleAddKeyword}
                              className="px-3 py-2 rounded-lg text-xs font-semibold transition-transform active:scale-[0.97] shrink-0 flex items-center justify-center"
                              style={{ background: '#1A1A1A', color: '#fff' }}
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                          <p className="text-[10px]" style={{ color: '#808080' }}>
                            {keywordsToTrack.length}/{keywordLimit} søkeord brukt
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs" style={{ color: '#808080' }}>
                          Grensen på {keywordLimit} søkeord er nådd.{' '}
                          <button onClick={() => handleUpgrade()} className="underline font-medium" style={{ color: '#1A1A1A' }}>
                            Oppgrader
                          </button>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* RIGHT: detail panel */}
                  <div className="flex-1 min-w-0 rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #EBEBE6' }}>
                    {!selected ? (
                      <div className="h-full flex flex-col items-center justify-center p-12 text-center" style={{ minHeight: 400 }}>
                        <BarChart3 size={36} style={{ color: '#EBEBE6', marginBottom: 12 }} />
                        <p className="text-sm font-semibold mb-1" style={{ color: '#1A1A1A' }}>Velg et søkeord</p>
                        <p className="text-xs max-w-xs" style={{ color: '#808080' }}>
                          Klikk på et søkeord til venstre for å se graf, landingssider og historikk på samme skjerm
                        </p>
                      </div>
                    ) : (
                      <div className="p-5 flex flex-col gap-5">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h2 className="text-lg font-semibold" style={{ color: '#1A1A1A' }}>{selected.keyword}</h2>
                            <p className="text-xs mt-0.5" style={{ color: '#808080' }}>
                              {selected.source === 'gsc'
                                ? `Google Search Console · ${gscKeywords.length} søkeord hentet`
                                : `${selected.location} · Manuelt sporet${selected.history.length > 0 ? ` · ${selected.history.length} målinger` : ''}`}
                            </p>
                          </div>
                          {selected.source === 'tracked' && (
                            <button
                              onClick={() => { handleRemoveKeyword(selected.keyword, selected.location!); setSelectedKwId(null); }}
                              className="text-xs transition-colors shrink-0"
                              style={{ color: '#808080' }}
                            >
                              Fjern
                            </button>
                          )}
                        </div>

                        {/* Stat cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            {
                              label: 'Posisjon',
                              value: selected.position != null
                                ? (selected.source === 'gsc' ? (selected.position as number).toFixed(1) : `#${selected.position}`)
                                : '—',
                              delta: selected.change,
                              positive: (selected.change ?? 0) > 0,
                            },
                            {
                              label: 'Klikk',
                              value: selected.clicks != null ? (selected.clicks as number).toLocaleString('no-NO') : '—',
                              delta: null,
                              positive: false,
                            },
                            {
                              label: 'Visninger',
                              value: selected.impressions != null ? (selected.impressions as number).toLocaleString('no-NO') : '—',
                              delta: null,
                              positive: false,
                            },
                            {
                              label: 'CTR',
                              value: selected.ctr != null ? `${((selected.ctr as number) * 100).toFixed(1)} %` : '—',
                              delta: null,
                              positive: false,
                            },
                          ].map(stat => (
                            <div key={stat.label} className="rounded-lg p-3" style={{ background: '#F5F5F0' }}>
                              <p className="text-[11px] font-medium mb-1.5" style={{ color: '#808080' }}>{stat.label}</p>
                              <p className="text-2xl font-semibold leading-none" style={{ color: '#1A1A1A' }}>{stat.value}</p>
                              {stat.delta !== null && (
                                <p className="text-xs font-semibold mt-1" style={{ color: stat.positive ? '#52A447' : '#ef4444' }}>
                                  {stat.positive ? '▲' : stat.delta === 0 ? '' : '▼'}
                                  {stat.delta !== 0 ? `${Math.abs(stat.delta as number).toFixed(1)}` : '—0,0'}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Position chart */}
                        {chartData.length > 0 ? (
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Posisjon over tid</p>
                              <div className="flex gap-1">
                                {(['28d', '90d', '12mnd'] as const).map(r => (
                                  <button
                                    key={r}
                                    onClick={() => setKwChartRange(r)}
                                    className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                                    style={{
                                      background: kwChartRange === r ? '#1A1A1A' : '#EBEBE6',
                                      color: kwChartRange === r ? '#fff' : '#808080',
                                    }}
                                  >
                                    {r}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div style={{ height: 176 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EBEBE6" />
                                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#808080' }} axisLine={false} tickLine={false} />
                                  <YAxis
                                    reversed
                                    allowDecimals={false}
                                    tick={{ fontSize: 10, fill: '#808080' }}
                                    axisLine={false}
                                    tickLine={false}
                                    domain={['dataMin - 1', 'dataMax + 1']}
                                  />
                                  <RechartsTooltip
                                    contentStyle={{ background: '#fff', border: '1px solid #EBEBE6', borderRadius: 8, fontSize: 12 }}
                                    formatter={(val: any) => [`#${val}`, 'Posisjon']}
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="rank"
                                    stroke="#1A1A1A"
                                    strokeWidth={2}
                                    dot={{ fill: '#52A447', r: 3, strokeWidth: 0 }}
                                    activeDot={{ fill: '#52A447', r: 5, strokeWidth: 0 }}
                                    isAnimationActive={false}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        ) : selected.source === 'tracked' ? (
                          <div className="rounded-lg p-5 text-center" style={{ background: '#F5F5F0' }}>
                            <p className="text-xs" style={{ color: '#808080' }}>Kjør «Sjekk rangering nå» for å se historikk her</p>
                          </div>
                        ) : null}

                        {/* Bottom: landing pages + event log */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Landing pages */}
                          <div className="rounded-lg p-4" style={{ border: '1px solid #EBEBE6' }}>
                            <p className="text-sm font-semibold mb-3" style={{ color: '#1A1A1A' }}>Landingssider for dette ordet</p>
                            {selected.source === 'tracked' && selected.url ? (
                              <div>
                                <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 pb-1.5 mb-1.5" style={{ borderBottom: '1px solid #EBEBE6' }}>
                                  <p className="text-[11px] font-semibold" style={{ color: '#808080' }}>URL</p>
                                  <p className="text-[11px] font-semibold" style={{ color: '#808080' }}>KLIKK</p>
                                  <p className="text-[11px] font-semibold" style={{ color: '#808080' }}>POS</p>
                                </div>
                                <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center py-1.5">
                                  <a
                                    href={selected.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs truncate hover:underline"
                                    style={{ color: '#52A447' }}
                                  >
                                    {(selected.url as string).replace(/^https?:\/\/[^/]+/, '') || '/'}
                                  </a>
                                  <span className="text-xs tabular-nums text-right" style={{ color: '#1A1A1A' }}>—</span>
                                  <span className="text-xs font-semibold tabular-nums text-right" style={{ color: '#1A1A1A' }}>
                                    {selected.position ?? '—'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs" style={{ color: '#808080' }}>
                                {selected.source === 'gsc'
                                  ? 'Landingssidedata er ikke tilgjengelig via GSC-integrasjonen.'
                                  : 'Kjør rangering for å finne landingssider.'}
                              </p>
                            )}
                          </div>

                          {/* Event log */}
                          <div className="rounded-lg p-4" style={{ border: '1px solid #EBEBE6' }}>
                            <p className="text-sm font-semibold mb-3" style={{ color: '#1A1A1A' }}>Hendelseslogg</p>
                            {(() => {
                              const events: Array<{ text: string; sub?: string }> = [];
                              if (selected.source === 'tracked') {
                                if (selected.history.length >= 2) {
                                  const first = selected.history[0];
                                  const last = selected.history[selected.history.length - 1];
                                  if (first.rank !== last.rank) {
                                    events.push({
                                      text: `Posisjon ${first.rank > last.rank ? 'forbedret' : 'svekket'} fra ${first.rank} → ${last.rank}`,
                                      sub: last.date,
                                    });
                                  }
                                }
                                if (selected.history.length > 0) {
                                  events.push({ text: 'Første rangering sjekket', sub: selected.history[0].date });
                                }
                                events.push({ text: 'Ord lagt til manuelt', sub: selected.location });
                              } else {
                                if (selected.position != null) {
                                  events.push({ text: `Gjennomsnittlig posisjon ${(selected.position as number).toFixed(1)}`, sub: 'Siste 28 dager' });
                                }
                                if (selected.clicks) {
                                  events.push({ text: `${(selected.clicks as number).toLocaleString('no-NO')} klikk fra organisk søk`, sub: 'Siste 28 dager' });
                                }
                                events.push({ text: 'Koblet via Google Search Console', sub: '' });
                              }
                              if (!events.length) {
                                return <p className="text-xs" style={{ color: '#808080' }}>Ingen hendelser ennå.</p>;
                              }
                              return (
                                <ul className="space-y-2.5">
                                  {events.map((ev, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: '#52A447' }} />
                                      <div>
                                        <p className="text-xs" style={{ color: '#1A1A1A' }}>{ev.text}</p>
                                        {ev.sub && <p className="text-[10px] mt-0.5" style={{ color: '#808080' }}>{ev.sub}</p>}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Position distribution */}
            {realRankings.length > 0 && (
              <div className="rounded-xl p-5" style={{ background: '#FFFFFF', border: '1px solid #EBEBE6' }}>
                <p className="text-sm font-semibold mb-4" style={{ color: '#1A1A1A' }}>Posisjonsfordeling</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  {positionBuckets.map((b) => (
                    <div key={b.name} className="rounded-lg p-3" style={{ background: '#F5F5F0' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.fill }} />
                        <p className="text-xs" style={{ color: '#808080' }}>{b.name}</p>
                      </div>
                      <p className="text-2xl font-semibold" style={{ color: '#1A1A1A' }}>{b.value}</p>
                    </div>
                  ))}
                </div>
                <div style={{ height: 112 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={positionBuckets} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EBEBE6" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#808080' }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#808080' }} axisLine={false} tickLine={false} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #EBEBE6', borderRadius: 8, fontSize: 12 }}
                        cursor={{ fill: '#F5F5F0' }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                        {positionBuckets.map((b, i) => <Cell key={i} fill={b.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =============================================================== */}
        {/* KONKURRENTER — KonkurrenterPage (egen komponent)              */}
        {/* =============================================================== */}
        {activeTab === 'competitors' && (
          <KonkurrenterPage
            user={user}
            theme={themed}
            hasStandardOrHigher={hasStandardOrHigher}
            hasPremium={hasPremium}
            onUpgrade={handleUpgrade}
          />
        )}

        {/* =============================================================== */}
        {/* AI-SYNLIGHET (GEO) — alltid synlig */}
        {/* =============================================================== */}
        {activeTab === 'geo' && (
          <GeoPage onNotify={() => toastInfo('Vi sier fra når automatisk GEO-sporing åpner for betatest.')} />
        )}

        {/* =============================================================== */}
        {/* VERKSTED — liste-view, ekspander inline for AI-løsning.         */}
        {/* =============================================================== */}
        {activeTab === 'workshop' && (() => {
          const opportunities = analysisResults?.mobile?.opportunities || [];
          const problems = opportunities.map((o: any) => ({
            id: `ps-${o.title}`,
            title: o.title,
            desc: o.savings ? `Sparer ${o.savings}` : 'Forbedring foreslått av Lighthouse',
            raw: o,
            status: 'open' as const,
          }));
          const filteredProblems =
            workshopFilter === 'all' ? problems :
            workshopFilter === 'open' ? problems.filter((p) => p.status === 'open') :
            problems.filter((p) => p.status !== 'open');

          return (
            <div className="space-y-6">
              <header>
                <h1 className={`text-3xl sm:text-4xl font-semibold tracking-tight ${textMain}`}>Verksted</h1>
                <p className={`text-base mt-3 ${textDim}`}>
                  Aktive problemer Sikt har funnet. Klikk for å se AI-løsningen og kopier kode.
                </p>
              </header>

              {/* Filter-pills */}
              <div className="flex flex-wrap gap-2">
                {([
                  { key: 'all' as const, label: `Alle ${problems.length}` },
                  { key: 'open' as const, label: `Åpne ${problems.filter((p) => p.status === 'open').length}` },
                  { key: 'done' as const, label: `Løste ${problems.filter((p) => p.status !== 'open').length}` },
                ]).map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setWorkshopFilter(p.key)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      workshopFilter === p.key
                        ? isLight ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
                        : isLight
                          ? 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                          : 'bg-slate-900 border border-white/10 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {!hasStandardOrHigher && (
                <TierTeaser
                  theme={themed}
                  tier="Standard"
                  price="1 499 kr"
                  message="Med Standard leser Sikt HTML-en fra siden din og viser eksakt kode-linje å fjerne"
                  onUpgrade={handleUpgrade}
                />
              )}

              <PortalCard theme={themed}>
                {filteredProblems.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className={`text-sm font-medium ${textMain} mb-1`}>
                      {problems.length === 0 ? 'Ingen aktive problemer' : 'Ingen problemer i dette filteret'}
                    </p>
                    <p className={`text-sm ${textDim}`}>
                      {problems.length === 0 ? 'Kjør en analyse under Synlighet → PageSpeed for å finne ting å fikse.' : 'Bytt filter for å se andre problemer.'}
                    </p>
                  </div>
                ) : (
                  <ul className={`divide-y ${divider}`}>
                    {filteredProblems.map((p) => {
                      const isExpanded = expandedWorkshopProblem === p.id;
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => {
                              if (isExpanded) {
                                setExpandedWorkshopProblem(null);
                                setActiveSolveProblem(null);
                              } else {
                                setExpandedWorkshopProblem(p.id);
                                setActiveSolveProblem({ raw: p.raw, title: p.title });
                              }
                            }}
                            className={`w-full flex items-center justify-between gap-3 px-6 py-4 text-left hover:${subtleBg} transition-colors`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span className={`shrink-0 w-2 h-2 rounded-full ${p.status === 'open' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                              <div className="min-w-0">
                                <p className={`text-sm font-medium ${textMain} truncate`}>{p.title}</p>
                                <p className={`text-xs mt-0.5 ${textDim}`}>{p.desc}</p>
                              </div>
                            </div>
                            <ChevronDown size={16} className={`shrink-0 ${textDim} transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>

                          {isExpanded && (
                            <div className={`px-6 pb-6 pt-2 border-t ${divider} ${subtleBg} space-y-4`}>
                              {hasStandardOrHigher && !hostIsConnected && (
                                <div className={`rounded-xl px-4 py-3 ${isLight ? 'bg-white' : 'bg-slate-900/40'} border ${divider}`}>
                                  <p className={`text-sm font-medium ${textMain} mb-1`}>CMS ikke koblet til</p>
                                  <p className={`text-sm ${textDim} mb-3`}>
                                    Koble til der nettsiden din ligger, så finner Sikt eksakt kode-linje.
                                  </p>
                                  <SecondaryButton theme={themed} onClick={() => { setActiveTab('settings'); setShowHostModal(true); }}>
                                    <Server size={14} /> Koble til CMS
                                  </SecondaryButton>
                                </div>
                              )}

                              {aiIsThinking ? (
                                <div className={`rounded-xl px-5 py-12 text-center ${isLight ? 'bg-white' : 'bg-slate-900/40'}`}>
                                  <Loader2 className="w-6 h-6 mx-auto mb-3 text-violet-600 animate-spin" />
                                  <p className={`text-sm font-medium ${textMain}`}>AI analyserer kildekoden…</p>
                                  <p className={`text-xs mt-1 ${textDim}`}>Dette tar normalt 5–15 sekunder.</p>
                                </div>
                              ) : aiSolution ? (
                                <>
                                  {aiSolution.originalCode && (
                                    <section>
                                      <p className={`text-sm font-medium ${textMain} mb-2`}>Fjern denne koden</p>
                                      <div className="rounded-xl bg-slate-950 p-4 font-mono text-xs overflow-x-auto">
                                        <pre className="text-rose-300 whitespace-pre-wrap"><code>{String(aiSolution.originalCode)}</code></pre>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => { navigator.clipboard?.writeText(String(aiSolution.originalCode)); toastSuccess('Kopiert.'); }}
                                        className="mt-2 text-sm font-medium text-violet-600 hover:text-violet-500 inline-flex items-center gap-1"
                                      >
                                        <Copy size={12} /> Kopier
                                      </button>
                                      {aiSolution.fileHint && (
                                        <p className={`text-xs mt-2 ${textDim}`}>Hvor: {aiSolution.fileHint}</p>
                                      )}
                                    </section>
                                  )}

                                  {aiSolution.codePatch && (
                                    <section>
                                      <p className={`text-sm font-medium ${textMain} mb-2`}>
                                        {aiSolution.originalCode ? 'Bytt ut med' : 'Foreslått kode'}
                                      </p>
                                      <div className="rounded-xl bg-slate-950 p-4 font-mono text-xs overflow-x-auto">
                                        <pre className="text-emerald-300 whitespace-pre-wrap"><code>{typeof aiSolution.codePatch === 'string' ? aiSolution.codePatch : JSON.stringify(aiSolution.codePatch, null, 2)}</code></pre>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => { navigator.clipboard?.writeText(typeof aiSolution.codePatch === 'string' ? aiSolution.codePatch : JSON.stringify(aiSolution.codePatch)); toastSuccess('Kopiert.'); }}
                                        className="mt-2 text-sm font-medium text-violet-600 hover:text-violet-500 inline-flex items-center gap-1"
                                      >
                                        <Copy size={12} /> Kopier
                                      </button>
                                      {aiSolution.replacementExplanation && (
                                        <p className={`text-xs mt-2 ${textDim}`}>Hvorfor: {aiSolution.replacementExplanation}</p>
                                      )}
                                    </section>
                                  )}

                                  {Array.isArray(aiSolution.steps) && aiSolution.steps.length > 0 && (
                                    <section>
                                      <p className={`text-sm font-medium ${textMain} mb-3`}>Slik fikser du det</p>
                                      <ol className="space-y-3">
                                        {aiSolution.steps.map((step: any, i: number) => (
                                          <li key={i} className="flex gap-3">
                                            <span className={`shrink-0 w-6 h-6 rounded-full ${isLight ? 'bg-violet-100 text-violet-700' : 'bg-violet-500/20 text-violet-300'} text-xs font-semibold flex items-center justify-center`}>
                                              {i + 1}
                                            </span>
                                            <div className="min-w-0">
                                              <p className={`text-sm font-medium ${textMain}`}>{step.title || `Steg ${i + 1}`}</p>
                                              {step.description && <p className={`text-sm mt-0.5 ${textDim}`}>{step.description}</p>}
                                            </div>
                                          </li>
                                        ))}
                                      </ol>
                                    </section>
                                  )}
                                </>
                              ) : (
                                <div className={`rounded-xl px-5 py-8 text-center text-sm ${textDim} ${isLight ? 'bg-white' : 'bg-slate-900/40'}`}>
                                  Ingen løsning generert enda.
                                </div>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </PortalCard>
            </div>
          );
        })()}

        {/* =============================================================== */}
        {/* SIKT-LOGGEN — én tidslinje, filter-pills, ekspanderbare rader.  */}
        {/* =============================================================== */}
        {activeTab === 'log' && (() => {
          const now = new Date();
          const weekStart = new Date(now);
          const day = weekStart.getDay() || 7;
          weekStart.setDate(weekStart.getDate() - (day - 1));
          weekStart.setHours(0, 0, 0, 0);
          const viewedStart = new Date(weekStart);
          viewedStart.setDate(viewedStart.getDate() + weekOffset * 7);
          const viewedEnd = new Date(viewedStart);
          viewedEnd.setDate(viewedEnd.getDate() + 7);

          const getWeekNumber = (d: Date) => {
            const date = new Date(d.getTime());
            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
            const week1 = new Date(date.getFullYear(), 0, 4);
            return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
          };

          const inWeek = siktActions.filter((a) => {
            const ts = new Date(a.created_at).getTime();
            return ts >= viewedStart.getTime() && ts < viewedEnd.getTime();
          });
          const filtered = receiptCategoryFilter === 'all' ? inWeek : inWeek.filter((a) => a.category === receiptCategoryFilter);
          const counts = {
            all: inWeek.length,
            finding: inWeek.filter((a) => a.category === 'finding').length,
            suggestion: inWeek.filter((a) => a.category === 'suggestion').length,
            fix: inWeek.filter((a) => a.category === 'fix').length,
            alert: inWeek.filter((a) => a.category === 'alert').length,
          };

          const filterPills: { key: typeof receiptCategoryFilter; label: string }[] = [
            { key: 'all', label: `Alle ${counts.all}` },
            { key: 'fix', label: `Fikser ${counts.fix}` },
            { key: 'suggestion', label: `Forslag ${counts.suggestion}` },
            { key: 'finding', label: `Funn ${counts.finding}` },
            { key: 'alert', label: `Varsler ${counts.alert}` },
          ];

          return (
            <div className="space-y-6">
              <header>
                <p className={`text-sm ${textDim}`}>
                  Uke {getWeekNumber(viewedStart)} · {viewedStart.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })}
                  {weekOffset === 0 ? ' (denne uken)' : ''}
                </p>
                <h1 className={`text-3xl sm:text-4xl font-semibold tracking-tight mt-2 ${textMain}`}>
                  {hasStandardOrHigher ? 'Dette har Sikt fikset for deg' : 'Dette har Sikt funnet for deg'}
                </h1>
                <p className={`text-base mt-3 ${textDim}`}>
                  {hasStandardOrHigher
                    ? 'Konkret arbeid Sikt har utført på siden din. Hver linje er en endring du kan se og angre.'
                    : 'Funn og AI-forslag du kan kopiere inn i CMS-en din selv. Oppgrader for å la Sikt pushe automatisk.'}
                </p>
              </header>

              {/* Uke-navigator */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWeekOffset((o) => o - 1)}
                  className={`px-3 py-2 rounded-lg text-sm border ${divider} ${textDim} hover:${textMain}`}
                >
                  <ChevronLeft size={14} className="inline" /> Forrige uke
                </button>
                <button
                  type="button"
                  onClick={() => setWeekOffset((o) => Math.min(0, o + 1))}
                  disabled={weekOffset >= 0}
                  className={`px-3 py-2 rounded-lg text-sm border ${divider} ${textDim} hover:${textMain} disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  Neste uke <ChevronRight size={14} className="inline" />
                </button>
                {weekOffset !== 0 && (
                  <button
                    type="button"
                    onClick={() => setWeekOffset(0)}
                    className="ml-2 text-sm font-medium text-violet-600 hover:text-violet-500"
                  >
                    Tilbake til denne uken
                  </button>
                )}
              </div>

              {/* Filter-pills med fargekoding pr kategori */}
              <div className="flex flex-wrap gap-2">
                {filterPills.map((p) => {
                  const dotColor: Record<string, string> = {
                    all: 'bg-slate-400',
                    fix: 'bg-emerald-500',
                    suggestion: 'bg-sky-500',
                    finding: 'bg-violet-500',
                    alert: 'bg-amber-500',
                  };
                  const active = receiptCategoryFilter === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setReceiptCategoryFilter(p.key)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                        active
                          ? isLight
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-900'
                          : isLight
                            ? 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                            : 'bg-slate-900 border border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${dotColor[p.key] || 'bg-slate-400'}`} />
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Logg-feed */}
              <PortalCard theme={themed}>
                {loadingReceipt ? (
                  <InlineLoading theme={themed} text="Laster aktivitetsloggen…" />
                ) : filtered.length === 0 ? (
                  <EmptyState
                    theme={themed}
                    icon={<ClipboardCheck className="w-10 h-10" />}
                    title={`Ingen handlinger ${weekOffset === 0 ? 'denne uken enda' : 'i denne uken'}`}
                    description={weekOffset === 0 ? 'Kjør en analyse eller legg til søkeord for å fylle loggen med konkrete funn.' : 'Sikt logget ingenting i denne perioden.'}
                    action={weekOffset === 0 ? (
                      <SecondaryButton theme={themed} onClick={() => setActiveTab('home')}>
                        Gå til Hjem
                      </SecondaryButton>
                    ) : undefined}
                  />
                ) : (
                  <ul className={`divide-y ${divider}`}>
                    {filtered.map((a) => {
                      const meta = categoryMeta(a.category);
                      return (
                        <li key={a.id} className="px-6 py-5">
                          <div className="flex items-start gap-4">
                            <span className={`mt-2 w-2 h-2 rounded-full ${meta.dot} shrink-0`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-3 flex-wrap">
                                <p className={`text-sm font-medium ${textMain}`}>{a.title}</p>
                                <span className={`text-xs ${textLabel}`}>{meta.label}</span>
                              </div>
                              {a.page_url && (
                                <p className={`text-xs mt-1 ${textDim} truncate font-mono`}>
                                  {(() => {
                                    try {
                                      const u = new URL(a.page_url.startsWith('http') ? a.page_url : `https://${a.page_url}`);
                                      return u.hostname + u.pathname;
                                    } catch { return a.page_url; }
                                  })()}
                                </p>
                              )}
                              {(a.before_value || a.after_value) && (
                                <div className="grid sm:grid-cols-2 gap-2 mt-3">
                                  {a.before_value && (
                                    <div className={`rounded-lg px-3 py-2 text-xs ${isLight ? 'bg-rose-50 text-rose-700' : 'bg-rose-500/10 text-rose-300'} line-through opacity-80`}>
                                      {a.before_value}
                                    </div>
                                  )}
                                  {a.after_value && (
                                    <div className={`rounded-lg px-3 py-2 text-xs ${isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-500/10 text-emerald-300'} font-medium`}>
                                      {a.after_value}
                                    </div>
                                  )}
                                </div>
                              )}
                              {a.category === 'suggestion' && a.after_value && (
                                <button
                                  type="button"
                                  onClick={() => { navigator.clipboard?.writeText(a.after_value); toastSuccess('Kopiert til utklipp.'); }}
                                  className="mt-3 text-sm font-medium text-violet-600 hover:text-violet-500 inline-flex items-center gap-1"
                                >
                                  <Copy size={12} /> Kopier til utklipp
                                </button>
                              )}
                            </div>
                            <span className={`text-xs ${textLabel} shrink-0 font-mono`}>
                              {new Date(a.created_at).toLocaleDateString('nb-NO', { weekday: 'short' }).replace('.', '')}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </PortalCard>

            </div>
          );
        })()}

        {/* =============================================================== */}
        {/* INNSTILLINGER — vertikal liste av seksjoner.                    */}
        {/* =============================================================== */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <header>
              <h1 className={`text-3xl sm:text-4xl font-semibold tracking-tight ${textMain}`}>Innstillinger</h1>
              <p className={`text-base mt-3 ${textDim}`}>Ett sted for alt — bedrift, CMS, abonnement og varsler.</p>
            </header>

            {/* SEKSJON: Bedrift & nettside */}
            <PortalCard theme={themed} className="p-6 sm:p-8">
              <CardHeader
                theme={themed}
                icon={<Briefcase size={16} />}
                accent="violet"
                title="Bedrift og nettside"
                subtitle="Hvem du er og hvor nettsiden din ligger."
                action={
                  <button
                    type="button"
                    onClick={() => setEditingSection(editingSection === 'profile' ? null : 'profile')}
                    className={`text-sm font-medium ${editingSection === 'profile' ? 'text-rose-600' : 'text-violet-600'} hover:opacity-80`}
                  >
                    {editingSection === 'profile' ? 'Avbryt' : 'Rediger'}
                  </button>
                }
              />

              {editingSection !== 'profile' ? (
                <dl className={`divide-y ${divider}`}>
                  {[
                    { label: 'Bedrift', value: clientData?.companyName || '—' },
                    { label: 'Kontaktperson', value: clientData?.contactPerson || '—' },
                    { label: 'E-post', value: clientData?.email || user?.email || '—' },
                    { label: 'Telefon', value: clientData?.phone || '—' },
                    { label: 'Nettside', value: websiteUrl || '—' },
                    { label: 'Bransje', value: clientData?.industry || '—' },
                    { label: 'Målgruppe', value: clientData?.targetAudience || '—' },
                  ].map((row) => (
                    <div key={row.label} className="flex items-baseline justify-between py-3 gap-4">
                      <dt className={`text-sm ${textDim}`}>{row.label}</dt>
                      <dd className={`text-sm font-medium ${textMain} text-right truncate max-w-xs`}>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <div className="space-y-4">
                  {[
                    { key: 'companyName', label: 'Bedrift', placeholder: 'Min Bedrift AS' },
                    { key: 'contactPerson', label: 'Kontaktperson', placeholder: 'Ola Nordmann' },
                    { key: 'email', label: 'E-post', placeholder: 'ola@bedrift.no' },
                    { key: 'phone', label: 'Telefon', placeholder: '+47 ...' },
                    { key: 'industry', label: 'Bransje', placeholder: 'F.eks. rørlegger' },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className={`block text-sm ${textDim} mb-1`}>{f.label}</label>
                      <input
                        type="text"
                        value={formData[f.key] ?? ''}
                        onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                        placeholder={f.placeholder}
                        className={`w-full rounded-lg px-3 py-2.5 text-sm border ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'} ${textMain} focus:outline-none focus:border-violet-500`}
                      />
                    </div>
                  ))}

                  <div>
                    <label className={`block text-sm ${textDim} mb-1`}>
                      Nettside {urlLocked && <span className={textLabel}>(låst i {urlDaysLeft} dag{urlDaysLeft === 1 ? '' : 'er'})</span>}
                    </label>
                    <input
                      type="text"
                      value={formData.websiteUrl ?? ''}
                      onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                      placeholder="https://minbedrift.no"
                      disabled={urlLocked}
                      className={`w-full rounded-lg px-3 py-2.5 text-sm border ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'} ${textMain} focus:outline-none focus:border-violet-500 disabled:opacity-60 disabled:cursor-not-allowed`}
                    />
                    <p className={`text-xs mt-1.5 ${textLabel}`}>
                      Du kan endre nettadressen én gang per uke. Etter lagring er den låst i 7 dager.
                    </p>
                  </div>

                  <div>
                    <label className={`block text-sm ${textDim} mb-1`}>Målgruppe</label>
                    <textarea
                      value={formData.targetAudience ?? ''}
                      onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                      placeholder="Hvem vil du nå?"
                      rows={3}
                      className={`w-full rounded-lg px-3 py-2.5 text-sm border ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'} ${textMain} focus:outline-none focus:border-violet-500 resize-none`}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <SecondaryButton theme={themed} onClick={() => setEditingSection(null)}>Avbryt</SecondaryButton>
                    <PrimaryButton onClick={async () => { await handleSaveSettings(formData); setEditingSection(null); }} disabled={saving}>
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Lagre
                    </PrimaryButton>
                  </div>
                </div>
              )}
            </PortalCard>

            {/* SEKSJON: CMS-tilkobling */}
            {!(/basic/i.test(planBundle) && !hasStandardOrHigher) && (
              <PortalCard theme={themed} className="p-6 sm:p-8">
                <CardHeader
                  theme={themed}
                  icon={<Server size={16} />}
                  accent={hostIsConnected ? 'emerald' : 'amber'}
                  title="CMS-tilkobling"
                  subtitle="Koble til der nettsiden din ligger, så pusher Sikt fikser automatisk."
                  action={
                    <SecondaryButton
                      theme={themed}
                      onClick={() => {
                        setHostPlatform(hostConnection?.platform || '');
                        setHostInputValue(hostConnection?.repoUrl || hostConnection?.adminUrl || hostConnection?.notes || '');
                        setShowHostModal(true);
                      }}
                    >
                      <Server size={14} /> {hostIsConnected ? 'Endre' : 'Koble til'}
                    </SecondaryButton>
                  }
                />
                {hostIsConnected ? (
                  <div className="space-y-2">
                    <p className={`text-sm ${textMain}`}>
                      <span className="font-medium">{hostConnection?.platform}</span>
                      {hostConnection?.repoUrl && <span className={textDim}> · {hostConnection.repoUrl}</span>}
                      {hostConnection?.adminUrl && !hostConnection?.repoUrl && <span className={textDim}> · {hostConnection.adminUrl}</span>}
                    </p>
                    <p className={`text-sm ${textDim}`}>
                      <CheckCircle2 size={14} className="inline text-emerald-600 mr-1" />
                      Sikt har lese-tilgang. Auto-fiks aktivt.
                    </p>
                  </div>
                ) : (
                  <p className={`text-sm ${textDim}`}>
                    Ikke koblet til. Sikt viser fortsatt funn og forslag, men du må kopiere fiksene inn selv.
                  </p>
                )}
              </PortalCard>
            )}

            {/* SEKSJON: Abonnement */}
            <PortalCard theme={themed} className="p-6 sm:p-8">
              <CardHeader
                theme={themed}
                icon={<CreditCard size={16} />}
                accent="violet"
                title="Abonnement"
                subtitle={`${planNames[activePlanKey]} · ${planPrices[activePlanKey]}/mnd`}
              />

              <div className="grid sm:grid-cols-3 gap-3">
                {(['BASIC', 'STANDARD', 'PREMIUM'] as const).map((key) => {
                  const isCurrent = activePlanKey === key;
                  const order: Record<string, number> = { BASIC: 1, STANDARD: 2, PREMIUM: 3 };
                  const type: 'upgrade' | 'downgrade' = order[key] > order[activePlanKey] ? 'upgrade' : 'downgrade';
                  return (
                    <div
                      key={key}
                      className={`rounded-xl p-5 border ${
                        isCurrent
                          ? isLight ? 'border-violet-300 bg-violet-50/50' : 'border-violet-500/40 bg-violet-500/10'
                          : divider
                      }`}
                    >
                      <p className={`text-sm font-semibold ${textMain}`}>{planNames[key]}</p>
                      <p className={`text-2xl font-semibold mt-2 ${textMain}`}>
                        {planPrices[key]}<span className={`text-xs font-normal ${textDim}`}>/mnd</span>
                      </p>
                      {isCurrent ? (
                        <p className={`mt-4 text-xs font-medium text-violet-600`}>Aktiv plan</p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPlanChangeTarget({ key, name: planNames[key], price: planPrices[key], type })}
                          className={`mt-4 text-sm font-medium ${type === 'upgrade' ? 'text-violet-600 hover:text-violet-500' : `${textDim} hover:${textMain}`}`}
                        >
                          {type === 'upgrade' ? 'Oppgrader →' : 'Nedgrader'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </PortalCard>

            {/* SEKSJON: Varsler */}
            <PortalCard theme={themed} className="p-6 sm:p-8">
              <CardHeader theme={themed} icon={<Bell size={16} />} accent="amber" title="Varsler" subtitle="Hva Sikt skal sende deg på e-post." />
              <ul className={`divide-y ${divider}`}>
                {[
                  { id: 'weeklyReport' as const, label: hasStandardOrHigher ? 'Ukentlig rapport' : 'Månedlig rapport', desc: 'Sammendrag av fikser, funn og rangeringer.' },
                  { id: 'criticalAlerts' as const, label: 'Kritiske varsler', desc: 'Når nettsiden går ned eller får alvorlige feil.' },
                  { id: 'rankChanges' as const, label: 'Rangeringsendringer', desc: 'Når du går opp eller ned på topp 10.' },
                ].map((item) => (
                  <li key={item.id} className="flex items-start justify-between py-4 gap-4">
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${textMain}`}>{item.label}</p>
                      <p className={`text-xs mt-0.5 ${textDim}`}>{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleNotif(item.id)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                        notifPrefs[item.id] ? 'bg-violet-600' : isLight ? 'bg-slate-200' : 'bg-slate-700'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${notifPrefs[item.id] ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </li>
                ))}
              </ul>
            </PortalCard>

            {/* SEKSJON: Utseende */}
            <PortalCard theme={themed} className="p-6 sm:p-8">
              <CardHeader theme={themed} icon={<Sparkle size={16} />} accent="sky" title="Utseende" subtitle="Velg hvordan portalen skal se ut." />
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'light' as const, label: 'Lys' },
                  { id: 'dark' as const, label: 'Mørk' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTheme(opt.id)}
                    className={`px-5 py-4 rounded-xl border text-sm font-medium transition-colors ${
                      theme === opt.id
                        ? isLight ? 'border-violet-300 bg-violet-50 text-slate-900' : 'border-violet-500/40 bg-violet-500/10 text-white'
                        : `${divider} ${textDim} hover:${textMain}`
                    }`}
                  >
                    {opt.id === 'light' ? <Sun size={16} className="inline mr-2" /> : <Moon size={16} className="inline mr-2" />}
                    {opt.label}
                  </button>
                ))}
              </div>
            </PortalCard>
          </div>
        )}

            <footer className={`mt-12 pt-6 border-t ${divider} text-center text-sm ${textDim}`}>
              <p className="inline-flex items-center justify-center gap-2 flex-wrap">
                <LifeBuoy size={14} className="text-violet-600" />
                <span>Support-kanal:</span>
                <a href="mailto:support@siktseo.com?subject=Support%20fra%20Sikt-portalen" className="text-violet-600 hover:text-violet-500 font-medium underline underline-offset-2">
                  support@siktseo.com
                </a>
                <span className={textLabel}>Svar normalt innen én arbeidsdag.</span>
              </p>
              <p className="mt-2">
                <button
                  type="button"
                  onClick={() => setShowFaqModal(true)}
                  className="text-violet-600 hover:text-violet-500 underline underline-offset-2"
                >
                  Se vanlige spørsmål
                </button>
              </p>
            </footer>

            {showFaqModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <button
                  type="button"
                  aria-label="Lukk FAQ"
                  onClick={() => setShowFaqModal(false)}
                  className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                />
                <div className={`relative w-full max-w-2xl rounded-2xl ${isLight ? 'bg-white' : 'bg-slate-900'} border ${divider} shadow-2xl p-6 max-h-[80vh] overflow-y-auto`}>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className={`text-lg font-semibold ${textMain}`}>Vanlige spørsmål</h3>
                    <button type="button" onClick={() => setShowFaqModal(false)} className={`p-1.5 rounded-md ${textDim} hover:${textMain}`}>
                      <X size={16} />
                    </button>
                  </div>
                  <div className="space-y-4">
                    {[
                      {
                        q: 'Hvor raskt ser jeg resultater i Sikt?',
                        a: 'Teknisk analyse vises vanligvis innen 30-60 sekunder, mens søkeordsdata fra GSC kan ta 7-14 dager.',
                      },
                      {
                        q: 'Hvorfor vises ingen søkeord ennå?',
                        a: 'Google Search Console trenger historikk før data vises. Sørg for at siden er verifisert og indeksert.',
                      },
                      {
                        q: 'Hvordan oppgraderer jeg abonnementet?',
                        a: 'Trykk på «Oppgrader» i portalen. Du sendes direkte til Stripe checkout for valgt plan.',
                      },
                      {
                        q: 'Kan jeg koble flere nettsider?',
                        a: 'Per nå støtter portalen én hovedside per bruker. Kontakt support for fler-domene oppsett.',
                      },
                      {
                        q: 'Hva betyr Technical Score?',
                        a: 'Scoren vurderer lastetid, mobilvennlighet, sikkerhet og SEO-tekniske signaler på en skala fra 0 til 100.',
                      },
                      {
                        q: 'Hvordan fungerer GEO-fanen?',
                        a: 'Du kan teste synlighet manuelt i AI-søk nå. Automatisk GEO-sporing lanseres i Q3 2026.',
                      },
                    ].map((item, idx) => (
                      <div key={idx} className={`rounded-lg border ${divider} p-4`}>
                        <p className={`text-sm font-semibold ${textMain}`}>{item.q}</p>
                        <p className={`text-sm mt-1 ${textDim}`}>{item.a}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* =============================================================== */}
      {/* HOST CONNECT MODAL                                              */}
      {/* =============================================================== */}
      {showHostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Lukk"
            onClick={() => setShowHostModal(false)}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />
          <div className={`relative w-full max-w-md rounded-2xl ${isLight ? 'bg-white' : 'bg-slate-900'} border ${divider} shadow-2xl p-6`}>
            <header className="flex items-center justify-between mb-5">
              <h3 className={`text-base font-semibold ${textMain}`}>Koble til CMS</h3>
              <button type="button" onClick={() => setShowHostModal(false)} className={`p-1.5 rounded-md ${textDim} hover:${textMain}`}>
                <X size={16} />
              </button>
            </header>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm ${textDim} mb-1.5`}>Plattform</label>
                <select
                  value={hostPlatform}
                  onChange={(e) => setHostPlatform(e.target.value)}
                  className={`w-full rounded-lg px-3 py-2.5 text-sm border ${isLight ? 'bg-white border-slate-200' : 'bg-slate-950 border-white/10'} ${textMain} focus:outline-none focus:border-violet-500`}
                >
                  <option value="">Velg plattform…</option>
                  <option value="github">GitHub (repo)</option>
                  <option value="wordpress">WordPress</option>
                  <option value="shopify">Shopify</option>
                  <option value="wix">Wix</option>
                  <option value="webflow">Webflow</option>
                  <option value="vercel">Vercel</option>
                  <option value="custom">Annet (eget webhotell)</option>
                </select>
              </div>

              {hostPlatform && (
                <div>
                  <label className={`block text-sm ${textDim} mb-1.5`}>
                    {hostPlatform === 'github' ? 'URL til repository' : hostPlatform === 'custom' ? 'Beskrivelse' : 'URL til admin/side'}
                  </label>
                  <input
                    type="text"
                    value={hostInputValue}
                    onChange={(e) => setHostInputValue(e.target.value)}
                    placeholder={
                      hostPlatform === 'github' ? 'https://github.com/brukernavn/repo' :
                      hostPlatform === 'wordpress' ? 'https://dinside.no/wp-admin' :
                      hostPlatform === 'shopify' ? 'https://dinside.myshopify.com' :
                      hostPlatform === 'custom' ? 'F.eks. one.com cPanel' :
                      'https://…'
                    }
                    className={`w-full rounded-lg px-3 py-2.5 text-sm border ${isLight ? 'bg-white border-slate-200' : 'bg-slate-950 border-white/10'} ${textMain} focus:outline-none focus:border-violet-500`}
                  />
                </div>
              )}

              <p className={`text-xs ${textLabel}`}>
                URL-en brukes som kontekst for AI-analyse. Sikt får ikke skrive-tilgang.
              </p>

              <PrimaryButton
                onClick={saveHostConnection}
                disabled={!hostPlatform || !hostInputValue.trim() || hostSaving}
                className="w-full"
                size="lg"
              >
                {hostSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Lagre tilkobling
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* PLAN CHANGE MODAL                                               */}
      {/* =============================================================== */}
      {planChangeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Lukk"
            onClick={() => !switchingPlan && setPlanChangeTarget(null)}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />
          <div className={`relative w-full max-w-md rounded-2xl ${isLight ? 'bg-white' : 'bg-slate-900'} border ${divider} shadow-2xl p-6`}>
            <h3 className={`text-base font-semibold ${textMain} mb-2`}>
              {planChangeTarget.type === 'upgrade' ? 'Oppgrader' : 'Nedgrader'} til {planChangeTarget.name}?
            </h3>
            <p className={`text-sm ${textDim} mb-5`}>
              {planChangeTarget.type === 'upgrade'
                ? `Du får tilgang til alt i ${planChangeTarget.name} umiddelbart. Nytt beløp ${planChangeTarget.price}/mnd belastes ved neste faktura.`
                : `Du beholder nåværende funksjoner ut faktureringsperioden, deretter byttes du til ${planChangeTarget.name} (${planChangeTarget.price}/mnd).`}
            </p>

            {isDevMode && (
              <div className={`rounded-lg px-3 py-2 mb-4 text-xs ${isLight ? 'bg-amber-50 text-amber-800' : 'bg-amber-500/10 text-amber-300'}`}>
                Dev-modus: kan bytte direkte uten Stripe.
              </div>
            )}

            <div className="flex gap-2">
              <SecondaryButton theme={themed} onClick={() => setPlanChangeTarget(null)} className="flex-1" disabled={switchingPlan}>
                Avbryt
              </SecondaryButton>
              {isDevMode ? (
                <PrimaryButton onClick={performPlanChange} disabled={switchingPlan} className="flex-1">
                  {switchingPlan ? <Loader2 size={14} className="animate-spin" /> : null}
                  Bytt direkte
                </PrimaryButton>
              ) : (
                <PrimaryButton onClick={() => onSelectPlan(planChangeTarget.name)} disabled={switchingPlan} className="flex-1">
                  Fortsett til Stripe <ArrowRight size={14} />
                </PrimaryButton>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- MAIN APP COMPONENT ---
// ------------------------------------------------------------
// DEV BYPASS PANEL
// ------------------------------------------------------------
// Flytende panel som KUN er synlig på localhost (eller med ?dev=1 i URL).
// Gir utviklere en snarvei til innloggede/betalte sider uten å gå gjennom
// Google OAuth. Panelet rendres aldri i produksjon.
type DevTarget = 'home' | 'onboarding' | 'setup' | 'success' | 'portal' | 'deepdive' | 'reset';

const DevBypassPanel = ({ onJumpTo, currentView }: { onJumpTo: (target: DevTarget) => void, currentView: string }) => {
  const [open, setOpen] = useState(false);

  const buttons: { target: DevTarget; label: string; emphasis?: boolean; desc: string }[] = [
    { target: 'home', label: 'Hjemmeside', desc: 'Tilbake til forsiden' },
    { target: 'onboarding', label: 'Onboarding-skjema', desc: 'Steg etter betaling' },
    { target: 'setup', label: 'Kode-integrasjon', desc: 'Koble nettsiden til Sikt' },
    { target: 'success', label: 'Suksess-side', desc: 'Før portalen åpnes' },
    { target: 'portal', label: 'ClientPortal (dashboard)', emphasis: true, desc: 'Betalt område — full tilgang' },
    { target: 'deepdive', label: 'DeepDive-analyse', desc: 'Bli-synlig-på-Google-siden' },
    { target: 'reset', label: 'Nullstill bypass', desc: 'Logg ut mock-bruker' },
  ];

  return (
    <div className="fixed bottom-4 right-4 z-[99999] font-sans">
      {open ? (
        <div className="bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 p-4 w-72 max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider">Dev bypass</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition"
              aria-label="Lukk"
            >
              <X size={14} />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed mb-3">
            Hopp til innloggede sider uten OAuth. Kun synlig på localhost eller med <code className="bg-slate-800 px-1 rounded">?dev=1</code>.
            <br />Aktiv: <span className="text-amber-300 font-bold">{currentView}</span>
          </p>
          <div className="space-y-1.5">
            {buttons.map((b) => {
              const isActive = (b.target === 'portal' && currentView === 'dashboard')
                || (b.target === currentView as any);
              return (
                <button
                  key={b.target}
                  onClick={() => onJumpTo(b.target)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition ${b.emphasis
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500'
                    : isActive
                      ? 'bg-amber-500/20 border border-amber-400/50 text-amber-100'
                      : 'bg-slate-800 hover:bg-slate-700'
                    }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>{b.label}</span>
                    <ChevronRight size={12} className="opacity-50" />
                  </div>
                  <div className={`text-[10px] font-normal mt-0.5 ${b.emphasis ? 'text-violet-100' : 'text-slate-400'}`}>
                    {b.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="group bg-slate-900 text-white px-4 py-3 rounded-full shadow-2xl border border-slate-700 flex items-center gap-2 hover:bg-violet-600 hover:border-violet-500 transition"
          aria-label="Åpne dev bypass"
        >
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
          <span className="text-xs font-black uppercase tracking-wider">Dev</span>
        </button>
      )}
    </div>
  );
};


function App() {
  // 1. SJEKK URL FØR VI STARTER
  // Viktig: Disse må fanges ved render, FØR URL-vasken under kjører.
  // Ellers tror init() at det er en normal visning og logger deg ut.
  const isPaymentSuccess = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('payment_success') === 'true';
  const isAuthRedirect = typeof window !== 'undefined' && (
    window.location.hash.includes('access_token') ||
    window.location.search.includes('code=')
  );
  const isAnyRedirect = isPaymentSuccess || isAuthRedirect;

  // FRESH-TAB DETEKTOR: sessionStorage er tomt naar brukeren aapner siden i en
  // ny fane / nytt vindu, eller skriver inn URL-en. Den BLIR fylt naar brukeren
  // refresher en eksisterende portal-side. Vi bruker dette til aa avgjoere om
  // vi skal logge ut en lagret sesjon (fresh besoek) eller beholde den (refresh).
  // Maa fanges i useRef saa initial-verdien beholdes etter at view-useEffekten
  // har skrevet til sessionStorage.
  const isFreshTabRef = useRef(
    typeof window !== 'undefined' && !sessionStorage.getItem('sikt_current_view')
  );

  const isProcessingClick = useRef(false);

  // 2. VASK URL-EN: Fjerner parameteret umiddelbart for å unngå spøkelser
  useEffect(() => {
    if (isPaymentSuccess && typeof window !== 'undefined') {
      const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: newUrl }, '', newUrl);
    }
  }, [isPaymentSuccess]);

  // --- TEMA STATE ---
  const [theme, setTheme] = useState<'dark' | 'light'>('light');

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
  const [justCompletedOnboarding, setJustCompletedOnboarding] = useState(false);

  // --- DEV BYPASS (kun lokal `vite dev`) ---
  // Lar oss jobbe med innloggede sider uten å gå gjennom Google OAuth.
  // import.meta.env.DEV er KUN true under `vite dev`. I prod-bygget tree-shakes
  // Vite hele dev-grenen bort, så panelet kan aldri aktiveres på siktseo.no.
  const isDevMode = import.meta.env.DEV;

  const handleDevBypass = (target: DevTarget) => {
    const MOCK_USER = {
      id: 'dev-mock-user-id',
      email: 'dev@sikt.local',
      user_metadata: { full_name: 'Dev Bruker', avatar_url: null },
      app_metadata: { provider: 'dev' },
      aud: 'authenticated',
      role: 'authenticated',
      created_at: new Date().toISOString(),
    };

    if (target === 'reset') {
      setUser(null);
      setHasAccess(false);
      setIsLoading(false);
      setSelectedPlan(null);
      setView('home');
      try { localStorage.removeItem('sikt_dev_plan'); } catch { /* ignore */ }
      return;
    }

    if (target === 'home') {
      setUser(null);
      setHasAccess(false);
      setIsLoading(false);
      setView('home');
      return;
    }

    if (target === 'portal') {
      setUser(MOCK_USER as any);
      setHasAccess(true);
      setIsLoading(false);
      setSelectedPlan(selectedPlan || '⭐⭐⭐ PREMIUM');
      setView('dashboard');
      return;
    }

    if (target === 'deepdive') {
      // DeepDive er offentlig rute, men vi setter mock-bruker for Navbar-visning.
      setUser(MOCK_USER as any);
      setHasAccess(false);
      setIsLoading(false);
      setView('deepdive');
      return;
    }

    // onboarding | setup | success — trenger bruker, men ikke hasAccess
    setUser(MOCK_USER as any);
    setHasAccess(false);
    setIsLoading(false);
    setView(target);
  };

  // Panelet har position:fixed, så det flyter over alt uansett hvor det rendres.
  const devOverlay = isDevMode ? <DevBypassPanel onJumpTo={handleDevBypass} currentView={view} /> : null;

  // --- AUTH: behold gyldig sesjon på refresh ---
  // Vi lytter på auth-events, men vi tvangsutlogger ikke ved vanlig sidebesøk.

  // Denne funksjonen bruker vi når vi VET at kunden skal inn
  const enterPortalWithDelay = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, PORTAL_ENTRY_DELAY_MS));
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
    let lastRoutedUserId: string | null = null;
    let subscription: { unsubscribe: () => void } | null = null;

    const handleUserRouting = async (user: any, isExplicitAction: boolean) => {
      if (!user || !isMounted) return;

      // NB: Vi viser IKKE loading-skjermen her. Den er forbeholdt
      // inngangen til ClientPortal (se REGEL 3 nederst).

      // Bruker state-variabelen som ble fanget FØR URL-vasken,
      // så vi unngår race mellom vasken og denne ruteren.
      const justPaid = isPaymentSuccess;

      try {
        // 1. Sjekk om vi har "lappen" med pakke-valget fra betalingen.
        // VIKTIG: Vi skriver kun til databasen hvis brukeren faktisk kom tilbake
        // fra Stripe (?payment_success=true). Uten denne sjekken ville en bruker
        // som valgte pakke og deretter logget inn uten å betale bli feilaktig
        // ruter til onboarding-skjemaet.
        const savedPlan = localStorage.getItem('sikt_pending_plan');
        if (savedPlan && justPaid) {
          localStorage.removeItem('sikt_pending_plan');
          try {
            await supabaseRest('clients?on_conflict=user_id', {
              method: 'POST',
              body: { user_id: user.id, package_name: savedPlan },
              headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
            });
          } catch (e: any) {
            console.error('[Routing] Kunne ikke lagre pakke:', e?.message || e);
          }
          setSelectedPlan(savedPlan);
        } else if (savedPlan && !justPaid) {
          // Brukeren valgte pakke men betalte ikke — behold lappen i localStorage
          // slik at vi kan preutfylle valget når de faktisk betaler.
          setSelectedPlan(savedPlan);
        }

        // 2. Hent fasiten fra databasen (rå fetch — supabase-js kan henge ved auth-lock)
        let client: { onboarding_completed?: boolean; package_name?: string } | null = null;
        try {
          const rows = await supabaseRest<any[]>(
            `clients?user_id=eq.${user.id}&select=onboarding_completed,package_name&limit=1`,
          );
          client = Array.isArray(rows) && rows.length ? rows[0] : null;
        } catch (e: any) {
          console.error('[Routing] Kunne ikke hente client:', e?.message || e);
        }

        if (!isMounted) return;

        // 3. Sett opp reglene
        const harBetalt = !!client?.package_name || justPaid;
        const harFyltUtSkjema = !!client?.onboarding_completed;

        // --- DEN PERMANENTE RUTINGEN DIN ---
        // Viktig: justPaid overstyrer IKKE fullført onboarding lenger.
        // Det hindrer at eksisterende kunder blir sendt tilbake til skjemaet
        // når de oppgraderer pakken og returnerer med ?payment_success=true.

        if (harBetalt && !harFyltUtSkjema) {
          // REGEL 2: Betalt, men mangler skjema -> Rett til skjemaet!
          setHasAccess(false);
          setView('onboarding');
        }
        else if (!harBetalt) {
          // REGEL 1: Ikke betalt -> Bli på hjemmesiden!
          setHasAccess(false);
          setView('home');
          // Scroller til priser kun hvis de akkurat trykket "Logg inn" på forsiden
          if (isExplicitAction) {
            setTimeout(() => {
              document.getElementById('priser')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 500);
          }
        }
        else {
          // REGEL 3: Betalt og skjema levert -> Rett inn i ClientPortal
          // MED loading-skjerm (Control Center) som mellomstopp.
          setView('dashboard');
          setIsLoading(true);
          await new Promise(resolve => setTimeout(resolve, PORTAL_ENTRY_DELAY_MS));
          if (!isMounted) return;
          setHasAccess(true);
        }
      } catch (err: any) {
        console.error("Feil i handleUserRouting:", err?.message || err);
        // Fallback: Aldri la brukeren stå fast. Send til home og fjern loader.
        if (isMounted) setView('home');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    // --- INIT: FØRST sletter vi gammel sesjon (hvis normal visning),
    //          DERETTER abonnerer vi på auth-endringer.
    //          Denne rekkefølgen er kritisk — ellers fanger listeneren
    //          den gamle sesjonen via INITIAL_SESSION og logger deg inn igjen.
    const init = async () => {
      // Viktig: Vi bruker den FØRFANGEDE isAnyRedirect i stedet for å lese
      // URL-en på nytt, fordi URL-vasken rekker å kjøre før denne init-en.
      if (isAnyRedirect) {
      } else {
      }

      if (!isMounted) return;


      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return;
        if (event === 'TOKEN_REFRESHED') return;


        if (event === 'SIGNED_OUT') {
          setUser(null);
          setHasAccess(false);
          setSelectedPlan(null);
          setView('home');
          setIsLoading(false);
          hasInitialized = true;
        }
        else if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
          // FRESH BESOEK: Hvis brukeren akkurat aapnet siden i en ny fane
          // (sessionStorage var tomt) og det IKKE er en redirect fra Stripe/OAuth,
          // skal vi IKKE auto-logge dem inn. Vi sletter den lagrede sesjonen
          // slik at hjemmesiden alltid er en ren, ikke-paalogget opplevelse.
          // SIGNED_OUT-handleren under tar seg av state-resettet.
          if (event === 'INITIAL_SESSION' && isFreshTabRef.current && !isAnyRedirect) {
            isFreshTabRef.current = false; // unngaa loop hvis signOut paa magisk vis re-fyrer
            try { await supabase.auth.signOut(); } catch { /* ignore */ }
            return;
          }

          const sameUserAsBefore = lastRoutedUserId === session.user.id;
          setUser(session.user);

          // Viktig: Hvis vi allerede har rutet denne brukeren, IKKE kjør ruting igjen.
          // Dette skjer f.eks. når brukeren bytter fane og kommer tilbake —
          // supabase fyrer SIGNED_IN på nytt etter token-refresh, og uten denne
          // sjekken ville vi flyttet brukeren ut av onboarding / settings / verksted.
          if (event === 'SIGNED_IN' && hasInitialized && sameUserAsBefore) {
            hasInitialized = true;
            return;
          }

          // Hvis eventet er SIGNED_IN og hasInitialized er true, er det et aktivt valg
          const isExplicit = (event === 'SIGNED_IN' && hasInitialized);

          lastRoutedUserId = session.user.id;
          await handleUserRouting(session.user, isExplicit);
          hasInitialized = true;
        } else {
          setIsLoading(false);
          hasInitialized = true;
        }
      });

      subscription = data.subscription;
    };

    init();

    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  // Når onboarding nettopp er fullført, kjør en første PageSpeed-analyse i bakgrunnen.
  useEffect(() => {
    if (!justCompletedOnboarding || !hasAccess || !user?.id) return;
    let cancelled = false;

    const runFirstAnalysis = async () => {
      try {
        const rows = await supabaseRest<any[]>(
          `clients?user_id=eq.${user.id}&select=website_url&limit=1`,
        );
        const client = Array.isArray(rows) && rows.length ? rows[0] : null;
        if (!client?.website_url) return;

        const { data: { session } } = await supabase.auth.getSession();
        toastInfo('Vi kjører en første analyse av nettsiden din i bakgrunnen...');

        void fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-pagespeed`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            url: client.website_url,
            user_id: user.id,
          }),
        }).catch((err) => console.error('[first-analysis] scan-pagespeed feilet:', err));
      } catch (err: any) {
        console.error('[first-analysis] Kunne ikke starte analyse:', err?.message || err);
      } finally {
        if (!cancelled) setJustCompletedOnboarding(false);
      }
    };

    runFirstAnalysis();
    return () => { cancelled = true; };
  }, [justCompletedOnboarding, hasAccess, user?.id]);

  const handleLoginTrigger = () => setView('login');
  const handleBack = () => setView('home');

  const handlePlanSelect = async (plan: string) => {
    // 0. SKJOLDET: Hvis funksjonen allerede kjører, avbryt umiddelbart!
    if (isProcessingClick.current) {
      return;
    }

    try {
      // Lås døren!
      isProcessingClick.current = true;

      if (typeof window !== 'undefined') {
        localStorage.setItem('sikt_pending_plan', plan);
      }

      if (typeof setSelectedPlan === 'function') {
        setSelectedPlan(plan);
      }


      // NB: Vi bruker IKKE supabase.auth.getSession() her — den kan henge
      // på grunn av auth-lock-deadlock i supabase-js. Vi sjekker i stedet
      // om det finnes et gyldig token i localStorage + om vi har user-state.
      const hasToken = !!getStoredAccessToken();
      const currentUser = hasToken ? user : null;

      if (!currentUser) {
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (typeof setView === 'function') {
          setView('login');
        }
        return; // Vi beholder låsen på frem til siden er byttet
      }


      const planNavn = plan.toUpperCase();
      let stripeBaseUrl = "";

      if (planNavn.includes('PREMIUM')) stripeBaseUrl = 'https://buy.stripe.com/test_5kQfZievo3gaeFL84Ads402';
      else if (planNavn.includes('STANDARD')) stripeBaseUrl = 'https://buy.stripe.com/test_4gMcN63QKbMG55b1Gcds401';
      else if (planNavn.includes('BASIC')) stripeBaseUrl = 'https://buy.stripe.com/test_eVq5kE870g2WeFL84Ads400';

      if (!stripeBaseUrl) {
        toastError(`Fant ingen betalingslenke for denne pakken: ${plan}`);
        return;
      }

      // VIKTIG: client_reference_id må med — webhook bruker dette til å koble
      // betalingen mot riktig bruker. Uten dette står kunden fast etter betaling.
      const checkoutUrl = `${stripeBaseUrl}?prefilled_email=${encodeURIComponent(currentUser.email || '')}&client_reference_id=${encodeURIComponent(currentUser.id)}`;
      window.location.href = checkoutUrl;

    } catch (err: any) {
      console.error("KRITISK FEIL i handlePlanSelect:", err.message);
      toastError("Feil: " + err.message);
    } finally {
      // Uansett hva som skjer (suksess eller krasj), låser vi opp døren igjen
      // Vi venter 1 sekund før vi låser opp for å hindre ekstrem hurtig-klikking
      setTimeout(() => {
        isProcessingClick.current = false;
      }, 1000);
    }
  };


  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();

      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sb-') || key === 'sikt_pending_plan') {
          localStorage.removeItem(key);
        }
      });

      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('sikt_current_view');
      }

      setUser(null);
      setHasAccess(false);
      setSelectedPlan(null);
      setView('home');
    } catch (error: any) {
      console.error("Feil ved utlogging:", error.message);
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
      <>
      {devOverlay}
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
      </>
    );
  }

  // ---------------------------------------------------------
  // 🚪 DØRVAKT 1: FERDIG KUNDE (VIP)
  // ---------------------------------------------------------
  // Hvis brukeren er logget inn OG har fullført oppsettet (hasAccess),
  // sendes de rett til ClientPortal.
  if (user && hasAccess) {
    return (
      <>
      {devOverlay}
      <ClientPortal
        user={user}
        onLogout={handleLogout}
        theme={theme}
        setTheme={setTheme}
        setView={setView}
        selectedPlan={selectedPlan}
        onSelectPlan={handlePlanSelect}
      />
      </>
    );
  }

  // ---------------------------------------------------------
  // 🚪 DØRVAKT 2: PROSESS (Registrering & Integrasjon)
  // ---------------------------------------------------------

  // Hjelpefunksjon: utled tier (Basic/Standard/Premium) fra plan-navn
  const getTier = (): 'BASIC' | 'STANDARD' | 'PREMIUM' => {
    const planStr = (selectedPlan || '').toString().toUpperCase();
    if (planStr.includes('PREMIUM')) return 'PREMIUM';
    if (planStr.includes('STANDARD')) return 'STANDARD';
    return 'BASIC';
  };

  // 1. Skjemaet etter betaling + valgfri GSC-kobling før første portalbesøk.
  if (view === 'onboarding') {
    return <>{devOverlay}<OnboardingPage user={user} onComplete={async () => {
      setJustCompletedOnboarding(true);
      try {
        setView('dashboard');
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, PORTAL_ENTRY_DELAY_MS));
        setHasAccess(true);
      } catch (err: any) {
        console.error("Feil ved inngang til portal fra onboarding:", err?.message || err);
        setHasAccess(true);
      } finally {
        setIsLoading(false);
      }
    }} /></>;
  }

  // 2. Koble til webhost (kun Standard/Premium ser dette steget)
  if (view === 'setup' || view === 'setup_guide') {
    return (
      <>
      {devOverlay}
      <CodeIntegrationStep
        userId={user.id}
        tier={getTier()}
        onFinish={() => setView('success')}
        onUpgrade={() => { setView('home'); setTimeout(() => document.getElementById('priser')?.scrollIntoView({ behavior: 'smooth' }), 200); }}
      />
      </>
    );
  }

  // 3. Suksess-side før de går inn i portalen
  if (view === 'success') {
    return (
      <>
      {devOverlay}
      <SuccessPage
        onBackHome={async () => {
          // Når de trykker "Gå videre" her, viser vi Control Center-loader
          // i 2,8 s før vi slipper dem inn i ClientPortal.
          try {
            setView('deepdive');
            setIsLoading(true);
            await new Promise(resolve => setTimeout(resolve, PORTAL_ENTRY_DELAY_MS));
            setHasAccess(true);
          } catch (err: any) {
            console.error("Feil ved inngang til portal fra SuccessPage:", err?.message || err);
            setHasAccess(true);
          } finally {
            setIsLoading(false);
          }
        }}
      />
      </>
    );
  }

  // ---------------------------------------------------------
  // 🏠 HOVEDHUSET (For nye besøkende / ikke-kunder)
  // ---------------------------------------------------------
  return (
    <div className="min-h-screen selection:bg-violet-100 selection:text-violet-900 bg-[#fcfcfd] relative overflow-x-hidden">
      {devOverlay}
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

        {/* Legal sider */}
        {view === 'privacy' && <PrivacyPage onBack={() => setView('home')} />}
        {view === 'terms' && <TermsPage onBack={() => setView('home')} />}

      </main>

      {/* Footer vises kun på vanlige sider */}
      {view !== 'login' && view !== 'profile' && view !== 'billing' && (
        <Footer onNavigate={setView} />
      )}
    </div>
  );
}

export default App;
