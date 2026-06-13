import { CodeIntegrationStep } from './CodeIntegrationStep';
import { ActivationChecklist } from './ActivationChecklist';
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
  ClipboardCheck, Bell, Sparkle, Bot, Microscope, Send, Plus, Info, PhoneIncoming, Coins, Gauge, Type
} from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

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
  fullUrl?: string;
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
// recharts (+ d3, ~110 KB gzip) er flyttet til src/PortalCharts.tsx og lazy-lastes
// kun i portalen, slik at markedssidene slipper hele charts-chunken.
const LazySparkline = React.lazy(() => import('./src/PortalCharts').then(m => ({ default: m.Sparkline })));
const Sparkline = (props: { data: number[]; color?: string; height?: number; fill?: boolean }) => (
  <React.Suspense fallback={<div style={{ height: props.height ?? 32 }} />}><LazySparkline {...props} /></React.Suspense>
);
const LazyRadialScore = React.lazy(() => import('./src/PortalCharts').then(m => ({ default: m.RadialScore })));
const RadialScore = (props: { value: number | null; size?: number; theme: PortalTheme }) => (
  <React.Suspense fallback={<div style={{ width: props.size ?? 96, height: props.size ?? 96 }} />}><LazyRadialScore {...props} /></React.Suspense>
);
const LazyScoreHistoryChart = React.lazy(() => import('./src/PortalCharts').then(m => ({ default: m.ScoreHistoryChart })));
const LazyKeywordRankChart = React.lazy(() => import('./src/PortalCharts').then(m => ({ default: m.KeywordRankChart })));
const LazyPositionBucketsChart = React.lazy(() => import('./src/PortalCharts').then(m => ({ default: m.PositionBucketsChart })));

// DashboardHome bruker recharts → lazy-last den så charts-chunken holdes ute av markedssidene.
const DashboardHome = React.lazy(() => import('./DashboardHome').then(m => ({ default: m.DashboardHome })));

// --- TOOLTIP KOMPONENT (Enkle forklaringer) ---
const InfoHint = ({ text }: { text: string }) => (
  <div className="group relative inline-flex ml-1.5 cursor-help">
    <div className="text-[#808080] hover:text-white transition-colors opacity-50 hover:opacity-100">
      <HelpCircle size={12} />
    </div>
    {/* Tooltip boks */}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 bg-[#1A1A1A] text-white text-[10px] leading-relaxed font-medium rounded-lg shadow-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1A1A1A]"></div>
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
      <div className="absolute top-[2%] left-[10%] w-[40rem] h-[40rem] bg-[#F5F5F0] rounded-full blur-[160px] animate-mesh"></div>
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
      className="group relative ui-motion ui-lift inline-flex items-center gap-3 px-8 py-4 bg-[#1A1A1A] text-white rounded-full font-bold text-lg shadow-xl [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-700 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-2xl [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-violet-500/20"
    >
      <span>Ta meg til toppen av Google</span>
      {/* Vi bruker ikonet du allerede har importert */}
      <ArrowRight className="w-5 h-5 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1" />

      {/* En liten 'glow' effekt for å gjøre den uimotståelig */}
      <div className="absolute inset-0 rounded-full ring-2 ring-white/10 group-hover:ring-white/30"></div>
    </button>
  </div>
);

// --- TECHNOLOGY VIEW COMPONENTS (V2) ---

const TECH_EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

function useTechReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

const TechDarkBackground = ({ glowStrength = 'default' }: { glowStrength?: 'default' | 'strong' }) => {
  const uid = React.useId().replace(/:/g, '');
  const opacity = glowStrength === 'strong' ? 0.18 : 0.12;
  return (
    <>
      <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
        <defs>
          <pattern id={`tech-dots-${uid}`} width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="0.75" fill="#1c2433" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#tech-dots-${uid})`} opacity="0.7" />
        <g stroke="#1c2433" strokeWidth="0.5" opacity="0.35">
          <line x1="20" y1="20" x2="60" y2="20" />
          <line x1="20" y1="20" x2="20" y2="60" />
          <line x1="60" y1="20" x2="60" y2="60" />
          <line x1="20" y1="60" x2="60" y2="60" />
        </g>
      </svg>
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] max-w-[90vw] pointer-events-none"
        style={{ background: `radial-gradient(closest-side, rgba(124,58,237,${opacity}), transparent)` }}
      />
    </>
  );
};

// Page-agnostic scroll progress ring. Computes progress from a plain scroll
// listener (no GSAP/ScrollTrigger) so it can be dropped into any view.
const ScrollProgressRing = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<SVGCircleElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);
  const reducedMotion = useTechReducedMotion();
  const radius = 22;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const container = containerRef.current;
    const progressEl = progressRef.current;
    const numberEl = numberRef.current;
    if (!container || !progressEl || !numberEl) return;

    progressEl.style.strokeDasharray = `${circumference}`;
    // prefers-reduced-motion: static ring at current progress, no animated transitions.
    if (reducedMotion) container.style.transition = 'none';

    let frame = 0;
    const apply = () => {
      frame = 0;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
      const progress = Math.min(1, Math.max(0, ratio));
      progressEl.style.strokeDashoffset = `${circumference * (1 - progress)}`;
      numberEl.textContent = String(Math.round(progress * 100));
      // Fade in only after the user has scrolled past ~80vh.
      container.style.opacity = window.scrollY > window.innerHeight * 0.8 ? '1' : '0';
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reducedMotion, circumference]);

  return (
    <div
      ref={containerRef}
      className="fixed bottom-6 right-6 z-40 hidden md:flex items-center justify-center w-14 h-14 opacity-0 transition-opacity duration-[400ms] ease-[cubic-bezier(0.23,1,0.32,1)]"
      aria-hidden="true"
    >
      <svg width="56" height="56" viewBox="0 0 56 56" className="absolute inset-0">
        <circle cx="28" cy="28" r={radius} fill="none" stroke="rgba(42,42,42,0.2)" strokeWidth="3" />
        <circle
          ref={progressRef}
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="#7c3aed"
          strokeWidth="3"
          strokeLinecap="round"
          transform="rotate(-90 28 28)"
        />
      </svg>
      <span ref={numberRef} className="relative text-[10px] font-bold text-white font-display tabular-nums">
        0
      </span>
    </div>
  );
};

const TECH_LIVE_FEED = [
  'Skanner forsiden …',
  'Leser sidetitler …',
  'Måler hastighet: 1,2 s',
  'Fant 3 forbedringer',
  'Skriver løsning på norsk …',
  'Overvåker — alt i orden',
];

const TechHeroV2 = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useTechReducedMotion();
  const [feedIndex, setFeedIndex] = useState(reducedMotion ? TECH_LIVE_FEED.length - 1 : 0);
  const [feedVisible, setFeedVisible] = useState(true);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.set('.tech-hero-word', { y: 0, opacity: 1 });
        return;
      }
      gsap.from('.tech-hero-word', {
        y: 24,
        opacity: 0,
        stagger: 0.05,
        duration: 0.65,
        ease: TECH_EASE,
      });
      if (cardRef.current) {
        gsap.to(cardRef.current, {
          y: -10,
          duration: 3,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
        });
      }
    }, sectionRef);
    requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => ctx.revert();
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;
    const interval = setInterval(() => {
      setFeedVisible(false);
      setTimeout(() => {
        setFeedIndex((i) => (i + 1) % TECH_LIVE_FEED.length);
        setFeedVisible(true);
      }, 280);
    }, 2400);
    return () => clearInterval(interval);
  }, [reducedMotion]);

  const headlineWords = ['Maskinen', 'som', 'ser', 'det', 'Google', 'ser.'];

  return (
    <section
      ref={sectionRef}
      className="tech-hero-v2 relative min-h-[92vh] flex flex-col items-center justify-center bg-[#0B0E14] px-5 py-24 overflow-hidden"
    >
      <TechDarkBackground />
      <div className="relative z-10 max-w-3xl mx-auto text-center w-full">
        <p className="text-[11px] tracking-[3px] uppercase font-bold text-[#a78bfa] mb-6 font-display">
          SIKT-TEKNOLOGIEN
        </p>
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white leading-[1.08] tracking-tight mb-4">
          {headlineWords.map((word, i) => (
            <span key={i} className="tech-hero-word inline-block mr-[0.28em]">
              {word}
            </span>
          ))}
          <br />
          <span className="tech-hero-word inline-block font-script font-normal italic text-[#a78bfa] text-3xl sm:text-4xl md:text-5xl mt-2">
            Døgnet rundt.
          </span>
        </h1>
        <p className="tech-hero-word text-base sm:text-lg text-[#9ca3af] max-w-xl mx-auto mt-6 leading-relaxed font-medium">
          Under panseret på Sikt jobber en AI som leser nettsiden din slik søkemotorer og AI-assistenter gjør — og gjør funnene om til vekst.
        </p>

        <div ref={cardRef} className="mt-12 mx-auto max-w-md w-full">
          <div className="rounded-2xl bg-[#11161f] border border-[#232c3d] p-5 sm:p-6 text-left">
            <div className="flex items-center justify-between mb-5">
              <span className="text-sm font-bold text-white font-display">Sikt Dashboard</span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Overvåker live
              </span>
            </div>
            <div className="text-4xl sm:text-5xl font-extrabold text-white font-display tracking-tight">
              94 <span className="text-lg sm:text-xl font-bold text-[#9ca3af]">/ 100 teknisk score</span>
            </div>
            <p className="text-sm font-bold text-[#a78bfa] mt-2">+12 denne måneden</p>
          </div>

          <div className="mt-4 h-5 flex items-center justify-center gap-2 overflow-hidden">
            <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] shrink-0 animate-pulse" />
            <span
              className="text-xs text-[#6b7280] font-mono transition-[opacity,transform] duration-300"
              style={{
                opacity: feedVisible ? 1 : 0,
                transform: feedVisible ? 'translateY(0)' : 'translateY(-6px)',
              }}
            >
              {TECH_LIVE_FEED[feedIndex]}
            </span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <ArrowDown
          size={20}
          className={`text-[#9ca3af] ${reducedMotion ? '' : 'animate-pulse'}`}
          aria-hidden="true"
        />
      </div>
    </section>
  );
};

const TechChapter1Scan = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const mockupBodyRef = useRef<HTMLDivElement>(null);
  const scanlineRef = useRef<HTMLDivElement>(null);
  const pill1Ref = useRef<HTMLDivElement>(null);
  const pill2Ref = useRef<HTMLDivElement>(null);
  const pill3Ref = useRef<HTMLDivElement>(null);
  const blockTitleRef = useRef<HTMLDivElement>(null);
  const blockImg1Ref = useRef<HTMLDivElement>(null);
  const blockImg2Ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useTechReducedMotion();

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (!sectionRef.current || !pinRef.current || !mockupBodyRef.current || !scanlineRef.current) return;

      const pills = [pill1Ref.current, pill2Ref.current, pill3Ref.current].filter(Boolean) as HTMLElement[];

      if (reducedMotion) {
        const h = mockupBodyRef.current.offsetHeight;
        gsap.set(scanlineRef.current, { y: h * 0.5 });
        gsap.set(pills, { scale: 1, opacity: 1 });
        return;
      }

      gsap.set(scanlineRef.current, { y: 0 });
      gsap.set(pills, { scale: 0.9, opacity: 0 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          pin: pinRef.current,
          scrub: 0.5,
          start: 'top top',
          end: '+=120%',
        },
      });

      tl.to(scanlineRef.current, {
        y: () => mockupBodyRef.current!.offsetHeight,
        ease: 'none',
        duration: 1,
      }, 0);

      if (pill1Ref.current) tl.to(pill1Ref.current, { scale: 1, opacity: 1, duration: 0.08, ease: TECH_EASE }, 0.3);
      if (pill2Ref.current) tl.to(pill2Ref.current, { scale: 1, opacity: 1, duration: 0.08, ease: TECH_EASE }, 0.6);
      if (pill3Ref.current) tl.to(pill3Ref.current, { scale: 1, opacity: 1, duration: 0.08, ease: TECH_EASE }, 0.85);

      // As the scanline passes each block it briefly lights up. The tinted blocks
      // (title → amber, first image → violet) settle on their tint; the second image
      // flashes blue (#E6F1FB) then settles back to neutral.
      if (blockTitleRef.current) {
        gsap.set(blockTitleRef.current, { backgroundColor: '#F0F0EB' });
        tl.to(blockTitleRef.current, { backgroundColor: '#FAEEDA', duration: 0.08, ease: 'none' }, 0.12);
      }
      if (blockImg1Ref.current) {
        gsap.set(blockImg1Ref.current, { backgroundColor: '#F0F0EB' });
        tl.to(blockImg1Ref.current, { backgroundColor: '#EEEDFE', duration: 0.08, ease: 'none' }, 0.5);
      }
      if (blockImg2Ref.current) {
        gsap.set(blockImg2Ref.current, { backgroundColor: '#F0F0EB' });
        tl.to(blockImg2Ref.current, { backgroundColor: '#E6F1FB', duration: 0.04, ease: 'none' }, 0.58);
        tl.to(blockImg2Ref.current, { backgroundColor: '#F0F0EB', duration: 0.1, ease: 'none' }, 0.64);
      }
    }, sectionRef);

    requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section ref={sectionRef} className="tech-chapter-1 relative bg-[#F5F5F0]" style={{ minHeight: reducedMotion ? 'auto' : '220vh' }}>
      <div ref={pinRef} className="min-h-screen flex flex-col items-center justify-center px-5 py-20">
        <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-14">
          <p className="text-[11px] tracking-[3px] uppercase font-bold text-[#808080] mb-4 font-display">01 — RØNTGENSYNET</p>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl md:text-5xl text-[#111111] leading-tight tracking-tight mb-5">
            Hver linje. Hvert bilde. Hver feil.
          </h2>
          <p className="text-base sm:text-lg text-[#808080] leading-relaxed max-w-2xl mx-auto">
            Sikt leser nettsiden din fra topp til bunn — titler, tekster, lenker, hastighet, mobilvisning og over 200 andre faktorer Google bruker. Mens du scroller, ser du skanningen skje.
          </p>
        </div>

        <div className="relative w-full max-w-lg mx-auto">
          <div className="rounded-2xl bg-white border border-[#EBEBE6] overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#EBEBE6] bg-[#FAFAF8]">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F09595]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#FAC775]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#97C459]" />
              </div>
              <span className="text-xs text-[#808080] font-mono flex-1 text-center truncate">dinbedrift.no</span>
            </div>
            <div ref={mockupBodyRef} className="relative p-5 sm:p-6 space-y-3 min-h-[220px] sm:min-h-[260px]">
              <div ref={blockTitleRef} className="h-4 w-3/4 rounded" style={{ backgroundColor: '#FAEEDA' }} />
              <div className="h-3 w-full rounded bg-[#F5F5F0]" />
              <div className="h-3 w-5/6 rounded bg-[#F5F5F0]" />
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div ref={blockImg1Ref} className="h-20 rounded-lg" style={{ backgroundColor: '#EEEDFE' }} />
                <div ref={blockImg2Ref} className="h-20 rounded-lg" style={{ backgroundColor: '#F0F0EB' }} />
              </div>
              <div className="h-16 rounded-lg bg-[#F5F5F0]" />
              <div
                ref={scanlineRef}
                className="absolute left-0 right-0 top-0 h-0.5 bg-[#7c3aed] pointer-events-none z-20"
                style={{ boxShadow: '0 0 12px rgba(124,58,237,0.5)' }}
              >
                {/* 24px fading trail beneath the scanline, moves with it */}
                <div
                  className="absolute left-0 right-0 top-full h-6"
                  style={{ background: 'linear-gradient(to bottom, rgba(124,58,237,0.10), transparent)' }}
                />
              </div>
            </div>
          </div>

          <div
            ref={pill1Ref}
            className="absolute -left-2 sm:-left-6 top-[28%] flex items-center gap-2 px-3 py-2 rounded-full bg-[#FAEEDA] text-xs font-bold text-[#854F0B] shadow-sm"
            style={{ opacity: reducedMotion ? 1 : 0, transform: reducedMotion ? 'scale(1)' : 'scale(0.9)' }}
          >
            <AlertTriangle size={14} className="text-orange-500 shrink-0" />
            Mangler beskrivelse
          </div>
          <div
            ref={pill2Ref}
            className="absolute -right-2 sm:-right-4 top-[48%] flex items-center gap-2 px-3 py-2 rounded-full bg-[#FAEEDA] text-xs font-bold text-[#854F0B] shadow-sm"
            style={{ opacity: reducedMotion ? 1 : 0, transform: reducedMotion ? 'scale(1)' : 'scale(0.9)' }}
          >
            <Clock size={14} className="text-[#BA7517] shrink-0" />
            Treg lasting
          </div>
          <div
            ref={pill3Ref}
            className="absolute left-1/2 -translate-x-1/2 -bottom-3 flex items-center gap-2 px-3 py-2 rounded-full bg-[#EEEDFE] text-xs font-bold text-[#534AB7] shadow-sm"
            style={{ opacity: reducedMotion ? 1 : 0, transform: reducedMotion ? 'scale(1)' : 'scale(0.9)' }}
          >
            <Sparkles size={14} className="text-[#7c3aed] shrink-0" />
            AI-løsning klar
          </div>
        </div>
      </div>
    </section>
  );
};

const TECH_FACTORS = [
  { icon: Type, title: 'Sidetitler', desc: 'Det første Google leser.' },
  { icon: Gauge, title: 'Hastighet', desc: 'Trege sider taper kunder.' },
  { icon: Smartphone, title: 'Mobilvisning', desc: 'De fleste søk skjer på mobil.' },
  { icon: FileText, title: 'Innhold', desc: 'Svarer du på det folk spør om?' },
  { icon: Link2, title: 'Lenker', desc: 'Tillit bygges av hvem som peker på deg.' },
  { icon: Shield, title: 'Sikkerhet', desc: 'HTTPS er et rangeringssignal.' },
];

const TechHorizontalFactors = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useTechReducedMotion();

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (!sectionRef.current || !containerRef.current || !trackRef.current || reducedMotion) return;

      const getScroll = () => trackRef.current!.scrollWidth - containerRef.current!.offsetWidth;

      gsap.to(trackRef.current, {
        x: () => -getScroll(),
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          pin: true,
          scrub: 0.5,
          end: () => `+=${getScroll()}`,
        },
      });
    }, sectionRef);

    requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section ref={sectionRef} className="relative bg-[#0A0A0A] overflow-hidden" style={{ minHeight: reducedMotion ? 'auto' : '100vh' }}>
      <TechDarkBackground />
      <div className="relative z-10 px-5 py-20 sm:py-28">
        <div className="max-w-6xl mx-auto mb-10 sm:mb-14">
          <p className="text-[11px] tracking-[3px] uppercase font-bold text-[#a78bfa] mb-4 font-display">DET MASKINEN LESER</p>
          <p className="text-lg sm:text-xl text-[#9ca3af] font-medium max-w-xl">
            Et utvalg av faktorene som avgjør om du blir funnet.
          </p>
        </div>

        <div
          ref={containerRef}
          className={`max-w-6xl mx-auto ${reducedMotion ? '' : 'overflow-hidden'}`}
        >
          <div
            ref={trackRef}
            className={`gap-6 ${reducedMotion ? 'grid grid-cols-2 md:grid-cols-3 max-w-4xl mx-auto' : 'flex w-max pl-5 sm:pl-0'}`}
          >
            {TECH_FACTORS.map((factor) => {
              const Icon = factor.icon;
              return (
                <div
                  key={factor.title}
                  className={`${reducedMotion ? 'w-full' : 'w-64'} shrink-0 rounded-2xl bg-[#11161f] border border-[#2a2a2a] p-6`}
                >
                  <div className="w-10 h-10 rounded-xl bg-[#1c2433] flex items-center justify-center mb-4">
                    <Icon size={20} className="text-[#a78bfa]" />
                  </div>
                  <h3 className="font-display font-bold text-white text-lg mb-2">{factor.title}</h3>
                  <p className="text-sm text-[#9ca3af] leading-relaxed">{factor.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

const TECH_KEYWORDS = [
  { keyword: 'rørlegger oslo', clicks: 128, impressions: 2100, position: 3, color: 'green' as const },
  { keyword: 'rørlegger akutt', clicks: 86, impressions: 1540, position: 5, color: 'green' as const },
  { keyword: 'bad oppussing pris', clicks: 41, impressions: 980, position: 11, color: 'violet' as const },
];

const TechChapter2Data = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const reducedMotion = useTechReducedMotion();
  const counterRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (!sectionRef.current) return;

      const formatImpressions = (n: number) => n.toLocaleString('nb-NO');

      const animateCounters = () => {
        TECH_KEYWORDS.forEach((row, rowIdx) => {
          const base = rowIdx * 3;
          const pairs = [
            { el: counterRefs.current[base], val: row.clicks },
            { el: counterRefs.current[base + 1], val: row.impressions },
            { el: counterRefs.current[base + 2], val: row.position },
          ];
          pairs.forEach(({ el, val }, colIdx) => {
            if (!el) return;
            const isImpressions = colIdx === 1;
            if (reducedMotion) {
              el.textContent = isImpressions ? formatImpressions(val) : String(val);
              return;
            }
            const obj = { n: 0 };
            gsap.to(obj, {
              n: val,
              duration: 1.4,
              ease: TECH_EASE,
              onUpdate: () => {
                const rounded = Math.round(obj.n);
                el.textContent = isImpressions ? formatImpressions(rounded) : String(rounded);
              },
            });
          });
        });
      };

      if (reducedMotion) {
        animateCounters();
        return;
      }

      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top 75%',
        once: true,
        onEnter: animateCounters,
      });
    }, sectionRef);

    requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section ref={sectionRef} className="relative bg-white px-5 py-20 sm:py-32">
      <div className="max-w-3xl mx-auto">
        <p className="text-[11px] tracking-[3px] uppercase font-bold text-[#808080] mb-4 font-display text-center">02 — EKTE DATA</p>
        <h2 className="font-display font-extrabold text-3xl sm:text-4xl md:text-5xl text-[#111111] text-center leading-tight tracking-tight mb-5">
          Koblet rett på Google.
        </h2>
        <p className="text-base sm:text-lg text-[#808080] text-center leading-relaxed mb-12 max-w-2xl mx-auto">
          Søkeordene kundene dine faktisk skriver — med klikk, visninger og posisjon — rett fra Google Search Console. Du ser nøyaktig hvor du klatrer, uke for uke.
        </p>

        <div className="rounded-2xl bg-white border border-[#EBEBE6] overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-[#EBEBE6] text-[10px] font-bold uppercase tracking-wider text-[#808080]">
            <span>Søkeord</span>
            <span className="text-right w-14">Klikk</span>
            <span className="text-right w-16">Visn.</span>
            <span className="text-right w-10">Pos.</span>
          </div>
          {TECH_KEYWORDS.map((row, rowIdx) => (
            <div
              key={row.keyword}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-4 border-b border-[#EBEBE6] last:border-0 items-center text-sm"
            >
              <span className="font-medium text-[#111111] truncate">{row.keyword}</span>
              <span className="text-right w-14 font-bold tabular-nums text-[#111111]">
                <span ref={(el) => { counterRefs.current[rowIdx * 3] = el; }}>{reducedMotion ? row.clicks : 0}</span>
              </span>
              <span className="text-right w-16 font-bold tabular-nums text-[#111111]">
                <span ref={(el) => { counterRefs.current[rowIdx * 3 + 1] = el; }}>{reducedMotion ? row.impressions : 0}</span>
              </span>
              <span className={`text-right w-10 font-bold tabular-nums flex items-center justify-end gap-0.5 ${row.color === 'green' ? 'text-emerald-600' : 'text-[#7c3aed]'}`}>
                <span ref={(el) => { counterRefs.current[rowIdx * 3 + 2] = el; }}>{reducedMotion ? row.position : 0}</span>
                <ArrowUp size={12} />
              </span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[#808080] mt-4 text-center">
          Illustrasjon — dine tall kommer fra din egen Search Console
        </p>
      </div>
    </section>
  );
};

const TECH_AI_RESPONSE =
  'Siden din mangler beskrivelser på 4 viktige sider, og forsiden laster tregt på mobil. Begynn der — jeg viser deg steg for steg.';

const TechChapter3Brain = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const aiTextRef = useRef<HTMLParagraphElement>(null);
  const reducedMotion = useTechReducedMotion();
  const [typedLen, setTypedLen] = useState(reducedMotion ? TECH_AI_RESPONSE.length : 0);
  const [showCaret, setShowCaret] = useState(!reducedMotion);

  useEffect(() => {
    if (reducedMotion) return;
    const el = sectionRef.current;
    if (!el) return;

    let interval: ReturnType<typeof setInterval> | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        let i = 0;
        interval = setInterval(() => {
          i += 1;
          setTypedLen(i);
          if (i >= TECH_AI_RESPONSE.length) {
            if (interval) clearInterval(interval);
            setShowCaret(false);
          }
        }, 28);
        observer.disconnect();
      },
      { threshold: 0.35, rootMargin: '0px' }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (interval) clearInterval(interval);
    };
  }, [reducedMotion]);

  return (
    <section ref={sectionRef} className="relative bg-[#0A0A0A] px-5 py-20 sm:py-32 overflow-hidden">
      <TechDarkBackground />
      <div className="relative z-10 max-w-2xl mx-auto">
        <p className="text-[11px] tracking-[3px] uppercase font-bold text-[#a78bfa] mb-4 font-display text-center">03 — HJERNEN</p>
        <h2 className="font-display font-extrabold text-3xl sm:text-4xl md:text-5xl text-white text-center leading-tight tracking-tight mb-5">
          AI som snakker norsk. Ikke fagspråk.
        </h2>
        <p className="text-base sm:text-lg text-[#9ca3af] text-center leading-relaxed mb-12">
          Alt maskinen finner, oversettes til klare beskjeder — hva som er galt, hvorfor det koster deg kunder, og hvordan du fikser det.
        </p>

        <div className="space-y-4">
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-[#1f1f1f] px-4 py-3 text-sm text-[#e5e5e5]">
              Hvorfor får jeg ikke flere kunder fra nettsiden?
            </div>
          </div>
          <div className="flex justify-start">
            <div className="max-w-[90%] rounded-2xl rounded-tl-md bg-[#2a1f47] border border-[#3a2a5a] px-4 py-3">
              <div className="flex items-start gap-2">
                <Sparkles size={16} className="text-[#a78bfa] shrink-0 mt-0.5" />
                <p ref={aiTextRef} className="text-sm text-[#e9e2ff] leading-relaxed">
                  {TECH_AI_RESPONSE.slice(0, typedLen)}
                  {showCaret && <span className="inline-block w-0.5 h-4 bg-[#a78bfa] ml-0.5 align-middle animate-pulse" />}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const TechChapter4Future = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const reducedMotion = useTechReducedMotion();

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (!sectionRef.current || reducedMotion) {
        gsap.set('.tech-ch4-reveal', { opacity: 1 });
        return;
      }
      gsap.utils.toArray<HTMLElement>('.tech-ch4-reveal').forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0.25 },
          {
            opacity: 1,
            ease: TECH_EASE,
            scrollTrigger: {
              trigger: el,
              start: 'top 85%',
              end: 'top 55%',
              scrub: 0.5,
            },
          }
        );
      });
    }, sectionRef);

    requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section ref={sectionRef} className="relative bg-[#0B0E14] px-5 py-20 sm:py-32 overflow-hidden">
      <TechDarkBackground glowStrength="strong" />
      <div className="relative z-10 max-w-2xl mx-auto">
        <p className="tech-ch4-reveal text-[11px] tracking-[3px] uppercase font-bold text-[#a78bfa] mb-4 font-display text-center" style={{ opacity: reducedMotion ? 1 : 0.25 }}>
          04 — FREMTIDEN
        </p>
        <h2 className="tech-ch4-reveal font-display font-extrabold text-3xl sm:text-4xl md:text-5xl text-white text-center leading-tight tracking-tight mb-5" style={{ opacity: reducedMotion ? 1 : 0.25 }}>
          Når kundene spør ChatGPT, er du svaret.
        </h2>
        <p className="tech-ch4-reveal text-base sm:text-lg text-[#9ca3af] text-center leading-relaxed mb-12" style={{ opacity: reducedMotion ? 1 : 0.25 }}>
          Søk flytter seg fra Google til AI-assistenter — og de gir ett svar, ikke ti lenker. Sikt bygger synligheten din for AI-søk (GEO) nå, mens konkurrentene dine ennå ikke vet hva det er.
        </p>

        <div className="tech-ch4-reveal rounded-2xl bg-[#11161f] border border-[#232c3d] p-5 sm:p-6" style={{ opacity: reducedMotion ? 1 : 0.25 }}>
          <p className="text-[10px] font-bold uppercase tracking-[3px] text-[#9ca3af] mb-4">AI-assistent</p>
          <p className="text-sm text-[#9ca3af] mb-4 italic">
            «Hvilken rørlegger i Oslo bør jeg bruke?»
          </p>
          <p className="text-sm sm:text-base text-white leading-relaxed">
            For akutte rørleggerjobber i Oslo anbefaler jeg{' '}
            <span className="text-[#a78bfa] font-bold">din bedrift</span>
            {' '}— de har gode anmeldelser, rask responstid og tydelig prisinformasjon på nettsiden.
          </p>
        </div>
      </div>
    </section>
  );
};

const TECH_BEFORE_ITEMS = [
  { icon: Search, text: 'Usynlig på side to og tre i Google — der ingen leter.' },
  { icon: CreditCard, text: 'Betaler for annonser hver måned for å bli sett i det hele tatt.' },
  { icon: HelpCircle, text: 'Aner ikke hva som virker, eller hvorfor konkurrenten ligger øverst.' },
];

const TECH_AFTER_ITEMS = [
  { icon: Eye, text: 'Synlig der kundene faktisk leter — også når du sover.' },
  { icon: Coins, text: 'Trafikken kommer organisk, ikke bare fra annonsebudsjettet.' },
  { icon: LayoutDashboard, text: 'Du ser i dashboardet hva som er gjort, hva som skjer, og hva som kommer.' },
];

const TECH_OUTCOME_CARDS = [
  { icon: PhoneIncoming, color: '#7c3aed', title: 'Henvendelser fra Google', desc: 'Folk som finner deg selv, har allerede bestemt seg.' },
  { icon: Coins, color: '#7c3aed', title: 'Mindre annonseavhengighet', desc: 'Organisk synlighet jobber uten klikkbudsjett.' },
  { icon: Clock, color: '#BA7517', title: 'Tid tilbake', desc: 'Maskinen overvåker og forklarer — du driver bedriften.' },
  { icon: ShieldCheck, color: '#185FA5', title: 'Ro i magen', desc: 'Du vet at noen følger med på siden din, døgnet rundt.' },
  { icon: MessageCircle, color: '#7c3aed', title: 'Svar når du lurer', desc: 'Spør Sikt AI og få forklaringer på norsk, med én gang.' },
  { icon: Rocket, color: '#7c3aed', title: 'Klar for AI-søk', desc: 'Bygget for der søk skjer i morgen, ikke bare i dag.' },
];

const TechChapter5Result = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const greenLineRef = useRef<SVGPolylineElement>(null);
  const violetLineRef = useRef<SVGPolylineElement>(null);
  const marker2Ref = useRef<SVGGElement>(null);
  const marker4Ref = useRef<SVGGElement>(null);
  const marker6Ref = useRef<SVGGElement>(null);
  const endDotRef = useRef<SVGGElement>(null);
  const annot1Ref = useRef<SVGGElement>(null);
  const annot2Ref = useRef<SVGGElement>(null);
  const annot3Ref = useRef<SVGGElement>(null);
  const reducedMotion = useTechReducedMotion();

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (!sectionRef.current) return;

      const prepLine = (line: SVGPolylineElement | null) => {
        if (!line) return 0;
        const length = line.getTotalLength();
        line.style.strokeDasharray = `${length}`;
        line.style.strokeDashoffset = `${length}`;
        return length;
      };

      prepLine(greenLineRef.current);
      prepLine(violetLineRef.current);

      const popEls = [
        marker2Ref.current,
        annot1Ref.current,
        marker4Ref.current,
        annot2Ref.current,
        marker6Ref.current,
        annot3Ref.current,
        endDotRef.current,
      ].filter(Boolean);

      if (reducedMotion) {
        if (greenLineRef.current) greenLineRef.current.style.strokeDashoffset = '0';
        if (violetLineRef.current) violetLineRef.current.style.strokeDashoffset = '0';
        gsap.set('.tech-ch5-grid, .tech-ch5-axis, .tech-ch5-area', { opacity: 1 });
        gsap.set(popEls, { opacity: 1, scale: 1, transformOrigin: 'center center' });
        gsap.set('.tech-ch5-before', { opacity: 0.9, x: 0, y: 0 });
        gsap.set('.tech-ch5-after, .tech-ch5-outcome, .tech-ch5-outcome-icon, .tech-ch5-closing-line', { opacity: 1, x: 0, y: 0, scale: 1 });
        return;
      }

      gsap.set(popEls, { opacity: 0, scale: 0.9, transformOrigin: 'center center' });
      gsap.set('.tech-ch5-grid, .tech-ch5-axis, .tech-ch5-area', { opacity: 0 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 60%',
          end: 'top 15%',
          scrub: 0.5,
        },
      });

      tl.to('.tech-ch5-grid, .tech-ch5-axis, .tech-ch5-area', {
        opacity: 1,
        duration: 0.12,
        ease: TECH_EASE,
      }, 0);

      if (greenLineRef.current) {
        tl.to(greenLineRef.current, { strokeDashoffset: 0, ease: 'none', duration: 0.48 }, 0.08);
      }
      if (violetLineRef.current) {
        tl.to(violetLineRef.current, { strokeDashoffset: 0, ease: 'none', duration: 0.44 }, 0.18);
      }

      const pop = (el: Element | null, at: number) => {
        if (!el) return;
        tl.to(el, { opacity: 1, scale: 1, duration: 0.06, ease: TECH_EASE }, at);
      };

      pop(marker2Ref.current, 0.28);
      pop(annot1Ref.current, 0.3);
      pop(marker4Ref.current, 0.48);
      pop(annot2Ref.current, 0.5);
      pop(marker6Ref.current, 0.72);
      pop(annot3Ref.current, 0.74);
      pop(endDotRef.current, 0.9);

      gsap.fromTo('.tech-ch5-before', {
        opacity: 0,
        y: 12,
      }, {
        opacity: 0.9,
        y: 0,
        duration: 0.5,
        ease: TECH_EASE,
        scrollTrigger: { trigger: '.tech-ch5-compare', start: 'top 82%', once: true },
      });

      gsap.from('.tech-ch5-after', {
        opacity: 0,
        x: 24,
        duration: 0.55,
        ease: TECH_EASE,
        delay: 0.12,
        scrollTrigger: { trigger: '.tech-ch5-compare', start: 'top 82%', once: true },
      });

      gsap.from('.tech-ch5-outcome', {
        y: 16,
        opacity: 0,
        stagger: 0.05,
        duration: 0.5,
        ease: TECH_EASE,
        scrollTrigger: { trigger: '.tech-ch5-outcomes', start: 'top 85%', once: true },
      });

      gsap.from('.tech-ch5-outcome-icon', {
        scale: 0.8,
        duration: 0.4,
        stagger: 0.05,
        ease: TECH_EASE,
        scrollTrigger: { trigger: '.tech-ch5-outcomes', start: 'top 85%', once: true },
      });

      gsap.from('.tech-ch5-closing-line', {
        y: 20,
        opacity: 0,
        stagger: 0.14,
        duration: 0.6,
        ease: TECH_EASE,
        scrollTrigger: { trigger: '.tech-ch5-closing', start: 'top 88%', once: true },
      });
    }, sectionRef);

    requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section ref={sectionRef} className="relative bg-[#F5F5F0] px-5 pt-20 sm:pt-32 pb-12">
      <div className="max-w-4xl mx-auto">
        <p className="text-[11px] tracking-[3px] uppercase font-bold text-[#808080] mb-4 font-display text-center">05 — RESULTATET</p>
        <h2 className="font-display font-extrabold text-3xl sm:text-4xl md:text-5xl text-[#111111] text-center leading-tight tracking-tight mb-5">
          Se for deg om seks måneder.
        </h2>
        <p className="text-base sm:text-lg text-[#808080] text-center leading-relaxed mb-12 max-w-2xl mx-auto">
          Kundene finner deg — ikke konkurrenten. Telefonen ringer fra folk som allerede har bestemt seg. Og du vet nøyaktig hvorfor, fordi tallene står i dashboardet ditt.
        </p>

        <div
          className="max-w-xl mx-auto mb-12 rounded-2xl bg-white pt-[22px] px-5 pb-3.5"
          style={{ border: '0.5px solid #EBEBE6' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <span className="text-xs font-medium text-[#1A1A1A]">Synlighet i Google</span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[10px] text-[#808080]">
                <span className="w-3.5 h-0.5 rounded-full bg-[#52A447]" />
                Visninger
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-[#808080]">
                <span className="w-3.5 h-0.5 rounded-full bg-[#7c3aed]" />
                Klikk
              </span>
            </div>
          </div>

          <svg viewBox="0 0 460 200" className="w-full" aria-hidden="true">
            {[20, 60, 100, 140, 170].map((y) => (
              <line key={y} className="tech-ch5-grid" x1="40" y1={y} x2="440" y2={y} stroke="#F0F0EB" strokeWidth="1" />
            ))}
            <text className="tech-ch5-axis" x="12" y="23" fill="#b0b0aa" fontSize="9">2k</text>
            <text className="tech-ch5-axis" x="10" y="103" fill="#b0b0aa" fontSize="9">1k</text>
            <text className="tech-ch5-axis" x="14" y="173" fill="#b0b0aa" fontSize="9">0</text>
            <text className="tech-ch5-axis" x="34" y="188" fill="#b0b0aa" fontSize="9">Mnd 1</text>
            <text className="tech-ch5-axis" x="100" y="188" fill="#b0b0aa" fontSize="9">2</text>
            <text className="tech-ch5-axis" x="166" y="188" fill="#b0b0aa" fontSize="9">3</text>
            <text className="tech-ch5-axis" x="232" y="188" fill="#b0b0aa" fontSize="9">4</text>
            <text className="tech-ch5-axis" x="298" y="188" fill="#b0b0aa" fontSize="9">5</text>
            <text className="tech-ch5-axis" x="424" y="188" fill="#b0b0aa" fontSize="9">Mnd 6</text>

            <path
              className="tech-ch5-area"
              d="M40,168 L106,160 L172,148 L238,118 L304,86 L370,52 L436,28 L436,170 L40,170 Z"
              fill="#EAF3DE"
              opacity="0.6"
            />
            <polyline
              ref={greenLineRef}
              fill="none"
              stroke="#52A447"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points="40,168 106,160 172,148 238,118 304,86 370,52 436,28"
            />
            <polyline
              ref={violetLineRef}
              fill="none"
              stroke="#7c3aed"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points="40,169 106,166 172,160 238,144 304,124 370,102 436,84"
            />

            <g ref={marker2Ref}>
              <circle cx="106" cy="160" r="3.5" fill="#FFFFFF" stroke="#52A447" strokeWidth="2" />
            </g>
            <g ref={marker4Ref}>
              <circle cx="238" cy="118" r="3.5" fill="#FFFFFF" stroke="#52A447" strokeWidth="2" />
            </g>
            <g ref={marker6Ref}>
              <circle cx="370" cy="52" r="3.5" fill="#FFFFFF" stroke="#52A447" strokeWidth="2" />
            </g>
            <g ref={endDotRef}>
              <circle cx="436" cy="28" r="4" fill="#52A447" />
            </g>

            <g ref={annot1Ref}>
              <line x1="106" y1="144" x2="106" y2="156" stroke="#EF9F27" strokeWidth="1" />
              <rect x="62" y="124" width="92" height="20" rx="10" fill="#FAEEDA" />
              <text x="108" y="138" fill="#854F0B" fontSize="9" textAnchor="middle">Feil fikset</text>
            </g>
            <g ref={annot2Ref}>
              <line x1="238" y1="104" x2="238" y2="114" stroke="#378ADD" strokeWidth="1" />
              <rect x="186" y="84" width="104" height="20" rx="10" fill="#E6F1FB" />
              <text x="238" y="98" fill="#185FA5" fontSize="9" textAnchor="middle">Innhold forbedret</text>
            </g>
            <g ref={annot3Ref}>
              <line x1="370" y1="38" x2="370" y2="48" stroke="#7F77DD" strokeWidth="1" />
              <rect x="306" y="18" width="128" height="20" rx="10" fill="#EEEDFE" />
              <text x="370" y="32" fill="#534AB7" fontSize="9" textAnchor="middle">Klatrer på søkeordene</text>
            </g>
          </svg>

          <p className="text-right text-[9px] text-[#b0b0aa] mt-2">
            Illustrasjon av et typisk forløp — resultater varierer
          </p>
        </div>

        <div className="tech-ch5-compare mt-16 sm:mt-20">
          <h3 className="font-display font-bold text-lg text-[#1A1A1A] text-center mb-6">
            Hverdagen, før og med Sikt
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="tech-ch5-before rounded-2xl bg-white border border-[#EBEBE6] p-5 sm:p-6">
              <p className="text-[11px] tracking-wide uppercase text-[#808080] mb-4">Uten</p>
              <ul className="space-y-4">
                {TECH_BEFORE_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.text} className="flex items-start gap-3">
                      <Icon size={16} className="shrink-0 mt-0.5 text-[#b0b0aa]" />
                      <span className="text-[13px] text-[#5F5E5A] leading-relaxed">{item.text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div
              className="tech-ch5-after relative rounded-2xl bg-white border-2 border-[#52A447]/40 p-5 sm:p-6 overflow-hidden"
              style={{ opacity: reducedMotion ? 1 : undefined }}
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-[#EAF3DE]" />
              <p className="text-[11px] tracking-wide uppercase text-[#3B6D11] font-medium mb-4">Med Sikt</p>
              <ul className="space-y-4">
                {TECH_AFTER_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.text} className="flex items-start gap-3">
                      <Icon size={16} className="shrink-0 mt-0.5 text-[#52A447]" />
                      <span className="text-[13px] text-[#1A1A1A] leading-relaxed">{item.text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>

        <div className="tech-ch5-outcomes mt-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {TECH_OUTCOME_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="tech-ch5-outcome rounded-2xl bg-white border border-[#EBEBE6] p-4 sm:p-5"
                style={{ opacity: reducedMotion ? 1 : 0 }}
              >
                <div
                  className="tech-ch5-outcome-icon mb-3"
                  style={{ transform: reducedMotion ? 'scale(1)' : 'scale(0.8)' }}
                >
                  <Icon size={18} style={{ color: card.color }} />
                </div>
                <p className="text-[13px] font-medium text-[#1A1A1A] leading-snug mb-1">{card.title}</p>
                <p className="text-[11px] text-[#808080] leading-relaxed">{card.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="tech-ch5-closing mt-14 text-center">
          <p
            className="tech-ch5-closing-line font-display font-extrabold text-[#1A1A1A] text-[28px] sm:text-[32px] leading-tight tracking-tight"
            style={{ opacity: reducedMotion ? 1 : 0 }}
          >
            Fra usynlig
          </p>
          <p
            className="tech-ch5-closing-line font-display font-extrabold text-[#1A1A1A] text-[28px] sm:text-[32px] leading-tight tracking-tight mt-1"
            style={{ opacity: reducedMotion ? 1 : 0 }}
          >
            til{' '}
            <span className="font-script font-normal italic text-violet-600">selvsagt.</span>
          </p>
        </div>
      </div>
    </section>
  );
};

const TechCTAV2 = ({ onNavigate }: { onNavigate: (view: string) => void }) => (
  <section className="relative bg-[#0B0E14] px-5 pt-12 sm:pt-16 pb-20 sm:pb-32 overflow-hidden text-center">
    <TechDarkBackground />
    <div className="relative z-10 max-w-2xl mx-auto">
      <h2 className="font-display font-extrabold text-3xl sm:text-4xl md:text-5xl text-white leading-tight tracking-tight mb-5">
        Teknologien er klar.
      </h2>
      <p className="text-base sm:text-lg text-[#9ca3af] mb-10 leading-relaxed">
        Spørsmålet er om konkurrentene dine finner den først.
      </p>
      <button
        type="button"
        onClick={() => onNavigate('login')}
        className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-white text-[#111111] text-base font-bold font-display transition-transform duration-[160ms] ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[0.98]"
      >
        Se hva Sikt finner på din side
      </button>
      <p className="text-xs text-[#9ca3af] mt-6">Ingen bindingstid · Oppsett på minutter</p>
    </div>
  </section>
);


// --- HOME PAGE COMPONENTS ---

const Hero = () => {
  return (
    <section className="relative pt-24 pb-16 sm:pt-32 sm:pb-28 md:pt-44 md:pb-60 hero-gradient overflow-hidden">
      <div className="absolute top-1/4 -left-12 hidden xl:block animate-float-subtle opacity-20 pointer-events-none">
        <div className="p-5 bg-white rounded-[2rem] shadow-2xl border border-[#EBEBE6] rotate-12">
          <SearchIcon size={48} className="text-[#3F8F38]" />
        </div>
      </div>
      <div className="absolute bottom-1/4 -right-16 hidden xl:block animate-float-subtle opacity-20 pointer-events-none" style={{ animationDelay: '2s' }}>
        <div className="p-5 bg-white rounded-[2rem] shadow-2xl border border-[#EBEBE6] -rotate-12">
          <TrendingUp size={48} className="text-[#3F8F38]" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 sm:px-6 text-center relative z-10">
        <RevealOnScroll direction="up" delay={200}>
          <h1 className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter text-[#1A1A1A] mb-6 sm:mb-10 max-w-5xl mx-auto leading-[1.1] md:leading-[0.9]">
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
            <a href="#priser" className="group w-full sm:w-auto px-10 py-4 sm:px-12 sm:py-5 bg-[#1A1A1A] text-white rounded-full text-base sm:text-lg font-black tracking-tight ui-motion ui-lift flex items-center justify-center gap-3 shadow-xl shadow-[rgba(26,26,26,0.08)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-700 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-2xl [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-violet-500/20">
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
              <div className="w-[600px] h-[600px] bg-transparent rounded-full blur-[120px] animate-pulse"></div>
            </div>
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-[#808080] rounded-full blur-sm animate-float-particle"
                style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${5 + Math.random() * 5}s`
                }}
              ></div>
            ))}
          </div>

          <div className="bg-white rounded-[20px] sm:rounded-[28px] flex overflow-hidden h-[320px] sm:h-[500px] md:h-[650px] shadow-sm border border-[#EBEBE6]/50 relative z-10">

            {/* 1. New Sidebar for density */}
            <div className="hidden sm:flex flex-col w-12 sm:w-16 border-r border-[#EBEBE6] bg-white pt-4 items-center gap-4 shrink-0">
              <div className="w-8 h-8 bg-[#1A1A1A] rounded-lg flex items-center justify-center text-white font-bold text-xs mb-4">S</div>
              {[Home, Activity, Layers, User, Wrench].map((Icon, i) => (
                <div key={i} className={`p-2 rounded-lg ${i === 0 ? 'bg-[rgba(63,143,56,0.09)] text-[#3F8F38]' : 'text-[#808080] hover:text-[#808080]'}`}>
                  <Icon size={18} />
                </div>
              ))}
            </div>

            <div className="flex-1 flex flex-col bg-[#F5F5F0]/30 overflow-hidden">
              {/* Header */}
              <div className="h-12 md:h-16 border-b border-[#EBEBE6] bg-white flex items-center justify-between px-4 md:px-8 shrink-0">
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="sm:hidden w-8 h-8 bg-[#1A1A1A] rounded-lg flex items-center justify-center text-white font-bold text-sm">S</div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-[#1A1A1A] tracking-tight">Din oversikt</h3>
                    <p className="text-[10px] text-[#808080] font-medium hidden sm:block">Oppdatert akkurat nå</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 bg-[rgba(63,143,56,0.09)] rounded-full border border-[rgba(63,143,56,0.18)]">
                    <div className="w-1.5 h-1.5 bg-[#808080] rounded-full animate-pulse"></div>
                    <span className="text-[9px] font-bold text-[#1A1A1A] uppercase">Alt OK</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden md:flex gap-4 mr-4">
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] text-[#808080] font-bold uppercase">Siden din</span>
                      <span className="text-xs font-black text-[#1A1A1A]">98.5%</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] text-[#808080] font-bold uppercase">Ord du ranker på</span>
                      <span className="text-xs font-black text-[#1A1A1A]">2,341</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full border border-[#EBEBE6] bg-white flex items-center justify-center text-[#808080] relative">
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
                    { l: "Besøkende", v: "124.5k", c: "text-[#3F8F38]", g: "+12%" },
                    { l: "Synlighet", v: "89.2%", c: "text-[#3F8F38]", g: "+4.1%" },
                    { l: "Troverdighet", v: "54", c: "text-amber-600", g: "+1" },
                    { l: "Feil å fikse", v: "0", c: "text-[#1A1A1A]", g: "-2" },
                  ].map((kpi, i) => (
                    <div key={i} className="bg-white p-3 rounded-xl border border-[#EBEBE6] shadow-sm flex flex-col justify-between h-20 sm:h-24">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] text-[#808080] font-bold uppercase tracking-wide">{kpi.l}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${kpi.g.startsWith('+') ? 'bg-[rgba(63,143,56,0.09)] text-[#3F8F38]' : 'bg-[#F5F5F0] text-[#808080]'}`}>{kpi.g}</span>
                      </div>
                      <span className={`text-lg sm:text-2xl font-black ${kpi.c}`}>{kpi.v}</span>
                      <div className="h-1 w-full bg-[#F5F5F0] rounded-full overflow-hidden">
                        <div className="h-full bg-current opacity-20 w-2/3"></div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Row 2: Main Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">

                  {/* Score Card (Detailed) */}
                  <div className="md:col-span-4 bg-white p-4 rounded-2xl border border-[#EBEBE6] shadow-sm flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-[#1A1A1A] text-xs uppercase tracking-wide">Total score</h4>
                      <Wrench size={14} className="text-[#808080]" />
                    </div>
                    <div className="flex items-center gap-6 mb-6">
                      <div className="relative">
                        <svg className="w-20 h-20 transform -rotate-90">
                          <circle cx="50%" cy="50%" r="40%" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-[#F5F5F0]" />
                          <circle cx="50%" cy="50%" r="40%" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-[#3F8F38]" strokeDasharray="200" strokeDashoffset="30" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-xl font-black text-[#1A1A1A]">85</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 flex-1">
                        {["Teknisk", "Innhold", "Lenker"].map((l, i) => (
                          <div key={i} className="flex flex-col gap-1">
                            <div className="flex justify-between text-[9px] font-bold text-[#808080]">
                              <span>{l}</span>
                              <span>{90 - i * 5}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-[#F5F5F0] rounded-full overflow-hidden">
                              <div className="h-full bg-[#3F8F38] rounded-full" style={{ width: `${90 - i * 5}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-auto border-t border-[#EBEBE6] pt-3 flex justify-between items-center">
                      <span className="text-[10px] text-[#808080] font-medium">Neste sjekk om 2t 14m</span>
                      <button className="text-[10px] font-bold text-[#3F8F38] bg-[rgba(63,143,56,0.09)] px-2 py-1 rounded-md">Sjekk nå</button>
                    </div>
                  </div>

                  {/* Chart Card (Detailed) */}
                  <div className="md:col-span-8 bg-white p-4 rounded-2xl border border-[#EBEBE6] shadow-sm flex flex-col relative overflow-hidden">
                    <div className="flex justify-between items-center mb-4 z-10">
                      <div>
                        <h4 className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wide">Besøkende på siden</h4>
                        <div className="flex gap-2 text-[9px] text-[#808080] font-medium mt-0.5">
                          <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-[#3F8F38]"></div> Fra Google</span>
                          <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-[#EBEBE6]"></div> Direkte</span>
                        </div>
                      </div>
                      <div className="flex gap-1 bg-[#F5F5F0] p-1 rounded-lg border border-[#EBEBE6]">
                        {["1U", "1M", "3M", "1Å"].map((t, i) => (
                          <button key={i} className={`text-[9px] font-bold px-2 py-0.5 rounded ${i === 1 ? 'bg-white shadow-sm text-[#1A1A1A]' : 'text-[#808080]'}`}>{t}</button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1 relative min-h-[140px] border-b border-l border-[#EBEBE6]">
                      {/* Grid lines */}
                      <div className="absolute inset-0 grid grid-rows-4 gap-0 pointer-events-none">
                        {[...Array(4)].map((_, i) => <div key={i} className="border-t border-[#EBEBE6] w-full h-full"></div>)}
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
                      <div className="absolute top-[30%] left-[60%] bg-[#1A1A1A] text-white text-[9px] font-bold px-2 py-1 rounded shadow-xl transform -translate-x-1/2 -translate-y-full z-20">
                        2,451
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-[#1A1A1A] rotate-45"></div>
                      </div>
                      <div className="absolute top-[30%] left-[60%] w-2 h-2 bg-[#3F8F38] border-2 border-white rounded-full z-20 transform -translate-x-1/2 -translate-y-1/2"></div>
                    </div>
                  </div>
                </div>

                {/* Row 3: Bottom Density (New) */}
                <div className="grid grid-cols-3 gap-4 h-24 hidden sm:grid">
                  <div className="bg-white p-3 rounded-xl border border-[#EBEBE6] shadow-sm overflow-hidden relative">
                    <h4 className="text-[9px] font-bold text-[#808080] uppercase mb-2">Topp søk</h4>
                    <div className="space-y-1.5">
                      {[{ w: "seo byrå", r: 1 }, { w: "digital markedsføring", r: 3 }].map((kw, i) => (
                        <div key={i} className="flex justify-between items-center text-[10px] font-medium border-b border-[#EBEBE6] pb-1">
                          <span className="text-[#1A1A1A]">{kw.w}</span>
                          <span className="text-[#3F8F38] font-bold">#{kw.r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-[#EBEBE6] shadow-sm overflow-hidden">
                    <h4 className="text-[9px] font-bold text-[#808080] uppercase mb-2">Brukeropplevelse</h4>
                    <div className="flex items-end gap-2 h-10 mt-2">
                      {[
                        { l: "Fart", v: 80, c: "bg-[#3F8F38]" },
                        { l: "Respons", v: 95, c: "bg-[#3F8F38]" },
                        { l: "Stabilitet", v: 60, c: "bg-amber-400" }
                      ].map((m, i) => (
                        <div key={i} className="flex-1 flex flex-col justify-end items-center gap-1">
                          <div className={`w-full rounded-t-sm ${m.c}`} style={{ height: `${m.v}%` }}></div>
                          <span className="text-[8px] font-bold text-[#808080]">{m.l}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-[#1A1A1A] p-3 rounded-xl border border-[#EBEBE6] shadow-sm overflow-hidden relative flex flex-col justify-center items-center text-center">
                    <div className="absolute inset-0 bg-[#F5F5F0] animate-pulse"></div>
                    <Activity size={20} className="text-[#1A1A1A] mb-2 relative z-10" />
                    <span className="text-[9px] font-bold text-[#808080] uppercase relative z-10">Sikt AI</span>
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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F5F5F0] text-[#1A1A1A] text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mb-4 sm:mb-6 border border-[#EBEBE6]">
          <Check size={11} />
          <span>Din vei til toppen</span>
        </div>
        <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-[#1A1A1A] mb-6 sm:mb-8 leading-[1.05] tracking-tight">
          Fra Usynlig til <br className="hidden sm:block" />
          <span className="text-[#1A1A1A]">Markedsledende.</span>
        </h1>
        <p className="text-base sm:text-lg md:text-2xl text-[#808080] font-medium leading-relaxed max-w-2xl mx-auto mb-10">
          Å se på prosessen ware er det første steget. <span className="text-[#1A1A1A] font-bold underline decoration-[#EBEBE6]">Google-dominans</span> er matematikk og AI i samspill.
        </p>
      </RevealOnScroll>
    </div>
  </section>
);

const PainPointData = () => (
  <section className="py-16 sm:py-24 bg-[#1A1A1A] text-white relative overflow-hidden">
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
                <p className="text-sm sm:text-base text-[#808080] font-medium leading-relaxed">De fleste bedrifter kaster bort penger på en digital fasade ingen ser.</p>
              </div>
            </div>
            <div className="flex gap-4 sm:gap-6 items-start">
              <div className="text-4xl sm:text-5xl md:text-7xl font-black text-[#1A1A1A] shrink-0">95%</div>
              <div>
                <h4 className="text-lg sm:text-xl font-bold mb-1 sm:mb-2">går til toppen.</h4>
                <p className="text-sm sm:text-base text-[#808080] font-medium leading-relaxed">Usynlighet koster bedrifter tapt omsetning hver eneste dag.</p>
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
            <p className="text-sm sm:text-base md:text-lg text-[#808080] leading-relaxed mb-6 sm:mb-8 font-medium">
              Mens du leser dette, søker potensielle kunder etter dine tjenester. De finner konkurrentene dine akkurat nå.
            </p>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-3 p-3.5 sm:p-4 bg-white/5 rounded-xl sm:rounded-2xl border border-white/10">
                <Check className="text-[#1A1A1A] shrink-0" size={16} />
                <span className="text-xs sm:text-sm font-semibold">Stopp blødningen av tapt omsetning</span>
              </div>
              <div className="flex items-center gap-3 p-3.5 sm:p-4 bg-white/5 rounded-xl sm:rounded-2xl border border-white/10">
                <Check className="text-[#1A1A1A] shrink-0" size={16} />
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
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-[#1A1A1A] mb-4 sm:mb-6 leading-tight">Fremtidens SEO (2026-Teknologi)</h2>
          <p className="text-sm sm:text-lg text-[#808080] max-w-2xl mx-auto font-medium leading-relaxed">Vi bruker kraftige AI-modeller for å utkonkurrere markedet.</p>
        </RevealOnScroll>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 items-center">
        <RevealOnScroll direction="left">
          <div className="space-y-6 sm:space-y-8">
            <div className="group">
              <div className="flex items-center gap-4 mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#F5F5F0] rounded-xl sm:rounded-2xl flex items-center justify-center text-[#1A1A1A] [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-violet-700 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-white transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] shrink-0">
                  <Cpu size={20} />
                </div>
                <h3 className="text-lg sm:text-xl font-bold">Autonome Analyser</h3>
              </div>
              <p className="text-sm sm:text-base text-[#808080] pl-14 sm:pl-16 font-medium leading-relaxed">Våre modeller skanner algoritme-endringer i sanntid og utfører 1000x flere beregninger.</p>
            </div>
            <div className="group">
              <div className="flex items-center gap-4 mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#F5F5F0] rounded-xl sm:rounded-2xl flex items-center justify-center text-[#1A1A1A] [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-violet-700 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-white transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] shrink-0">
                  <Zap size={20} />
                </div>
                <h3 className="text-lg sm:text-xl font-bold">Lynrask Implementering</h3>
              </div>
              <p className="text-sm sm:text-base text-[#808080] pl-14 sm:pl-16 font-medium leading-relaxed">Vi identifiserer tekniske hull på sekunder og genererer optimalisert innhold umiddelbart.</p>
            </div>
          </div>
        </RevealOnScroll>
        <RevealOnScroll direction="right">
          <div className="p-1.5 sm:p-2 bg-[#1A1A1A] rounded-[28px] sm:rounded-[40px] shadow-2xl mt-8 md:mt-0">
            <div className="bg-white rounded-[24px] sm:rounded-[34px] p-6 sm:p-8 border border-[#EBEBE6]">
              <div className="flex justify-between items-center mb-6 sm:mb-8">
                <div className="text-sm sm:text-base font-black text-[#1A1A1A] uppercase">AI Prosessering</div>
                <div className="text-[8px] sm:text-xs bg-[#F5F5F0] text-[#1A1A1A] px-2 py-1 rounded-full font-bold">Aktiv</div>
              </div>
              <div className="space-y-4 sm:space-y-6">
                {[
                  { label: "Søkeordsdybde", val: "98%" },
                  { label: "Overvåkning", val: "24/7" },
                  { label: "Innholds-skår", val: "9.2/10" }
                ].map((stat, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-[9px] sm:text-xs font-bold text-[#808080] mb-1.5 sm:mb-2 uppercase tracking-widest">{stat.label}<span>{stat.val}</span></div>
                    <div className="h-1.5 sm:h-2 bg-[#F5F5F0] rounded-full overflow-hidden">
                      <div className="h-full bg-[#1A1A1A] animate-draw-line" style={{ width: stat.val, animationDelay: `${i * 200}ms` }}></div>
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
      <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">
        Før du kobler til Google
      </h2>
      <p className="text-[#808080] mb-6">
        For at Sikt skal kunne hente søkeorddata for nettsiden din, må disse to tingene være på plass:
      </p>

      {/* Sjekkliste */}
      <div className="space-y-4 mb-6">
        {/* Punkt 1 */}
        <div
          onClick={() => setVerified(!verified)}
          className="flex items-start gap-3 p-4 rounded-lg border-2 border-[#EBEBE6] hover:border-[#808080] cursor-pointer transition-colors"
        >
          <div className="pt-0.5">
            {verified ? (
              <CheckCircle2 className="w-5 h-5 text-[#1A1A1A]" />
            ) : (
              <Circle className="w-5 h-5 text-[#808080]" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium text-[#1A1A1A] mb-1">
              Jeg har verifisert nettsiden min i Google Search Console
            </p>
            <a
              href="https://support.google.com/webmasters/answer/9008080"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#1A1A1A] hover:text-[#1A1A1A] inline-flex items-center gap-1"
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
          className="flex items-start gap-3 p-4 rounded-lg border-2 border-[#EBEBE6] hover:border-[#808080] cursor-pointer transition-colors"
        >
          <div className="pt-0.5">
            {sameAccount ? (
              <CheckCircle2 className="w-5 h-5 text-[#1A1A1A]" />
            ) : (
              <Circle className="w-5 h-5 text-[#808080]" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium text-[#1A1A1A] mb-1">
              Jeg vil koble til med samme Google-konto som eier nettsiden
            </p>
            <p className="text-sm text-[#808080]">
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
              ? 'bg-[#52A447] hover:bg-violet-600 text-white'
              : 'bg-[#EBEBE6] text-[#808080] cursor-not-allowed'
          }`}
        >
          {canProceed
            ? 'Koble til Google Search Console'
            : 'Bekreft begge punkter for å fortsette'
          }
        </button>

        <button
          onClick={onCancel}
          className="w-full py-2 text-sm text-[#808080] transition-[color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A] active:scale-[0.98]"
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

      onComplete();

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

  return (
    <section className="min-h-screen bg-[#F5F5F0] py-20 px-5 flex items-center justify-center">
      <div className="max-w-3xl w-full bg-white rounded-[32px] shadow-2xl p-8 sm:p-12 relative z-10 border border-[#EBEBE6]">
        <h1 className="text-3xl font-black text-[#1A1A1A] mb-2">Fortell oss om din <span className="text-[#1A1A1A]">bedrift</span></h1>
        <p className="text-sm text-[#808080] mb-8">
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
            <input required name="companyName" value={formData.companyName} onChange={handleChange} onBlur={handleBlur} placeholder="Bedriftsnavn" className="w-full p-4 bg-[#F5F5F0] rounded-xl border border-[#EBEBE6] focus:ring-2 focus:ring-[#808080]/25 outline-none" />
            <input required name="contactPerson" value={formData.contactPerson} onChange={handleChange} onBlur={handleBlur} placeholder="Kontaktperson" className="w-full p-4 bg-[#F5F5F0] rounded-xl border border-[#EBEBE6] focus:ring-2 focus:ring-[#808080]/25 outline-none" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <input required type="email" name="email" value={formData.email} onChange={handleChange} onBlur={handleBlur} placeholder="E-post" className="w-full p-4 bg-[#F5F5F0] rounded-xl border border-[#EBEBE6] focus:ring-2 focus:ring-[#808080]/25 outline-none" />
            <input required type="tel" name="phone" value={formData.phone} onChange={handleChange} onBlur={handleBlur} placeholder="Telefon" className="w-full p-4 bg-[#F5F5F0] rounded-xl border border-[#EBEBE6] focus:ring-2 focus:ring-[#808080]/25 outline-none" />
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
                className={`w-full p-4 pr-11 bg-[#F5F5F0] rounded-xl border ${websiteUrlStatus === 'valid' ? 'border-[#808080]' : websiteUrlStatus === 'invalid' ? 'border-rose-300' : 'border-[#EBEBE6]'} focus:ring-2 focus:ring-[#808080]/25 outline-none`}
              />
              {websiteUrlStatus === 'valid' && (
                <CheckCircle size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1A1A1A]" />
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
              className="w-full p-4 bg-[#F5F5F0] rounded-xl border border-[#EBEBE6] focus:ring-2 focus:ring-[#808080]/25 outline-none"
            />

            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-50 w-full bg-white border border-[#EBEBE6] rounded-xl mt-1 max-h-60 overflow-y-auto shadow-lg">
                {suggestions.map((suggestion, index) => (
                  <li
                    key={index}
                    onClick={() => handleSelectIndustry(suggestion)}
                    className="p-3 hover:bg-[#F5F5F0] cursor-pointer text-[#1A1A1A] transition-colors"
                  >
                    {suggestion}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <textarea required name="targetAudience" value={formData.targetAudience} rows={3} onChange={handleChange} onBlur={handleBlur} placeholder="Målgruppe (Hvem ønsker du å nå?)" className="w-full p-4 bg-[#F5F5F0] rounded-xl border border-[#EBEBE6] focus:ring-2 focus:ring-[#808080]/25 outline-none" />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-violet-700 text-white rounded-xl font-bold text-lg transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-xl disabled:opacity-50 enabled:hover:bg-violet-600 active:enabled:scale-[0.98]"
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
    <section className="relative py-20 sm:py-32 md:py-48 overflow-hidden bg-[#F5F5F0]">

      {/* Bakgrunn: En rolig, pulserende glød */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[800px] h-[400px] sm:h-[500px] bg-gradient-to-tr from-violet-100/50 via-indigo-50/50 to-white rounded-[100%] blur-[80px] animate-[pulse_10s_ease-in-out_infinite] pointer-events-none"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col gap-12 sm:gap-16 md:gap-24">

          {/* DEL 1: PROBLEMET (Venstre side) */}
          <RevealOnScroll delay={0} className="self-start sm:ml-12 relative">
            {/* En liten bakgrunns-sirkel for dybde */}
            <div className="absolute -left-4 -top-4 w-20 h-20 bg-[#F5F5F0] rounded-full blur-xl opacity-50 animate-pulse pointer-events-none"></div>

            <div className="backdrop-blur-md bg-white/80 border border-[#EBEBE6]/60 shadow-sm px-5 py-4 sm:px-8 sm:py-5 rounded-2xl inline-flex items-center gap-3 sm:gap-4 max-w-lg relative z-10">
              <div className="w-2 h-2 rounded-full bg-[#808080] shrink-0"></div>
              <p className="text-[#808080] font-medium text-sm sm:text-lg leading-snug">
                Mange bedrifter gjetter på hvordan de oppnår <span className="text-[#1A1A1A] font-bold border-b-2 border-[#EBEBE6]">høyere rangering</span> på Google.
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
                  <div className="w-1/4 bg-[#EBEBE6]/50 rounded-t-lg h-[30%] animate-[loading_3s_ease-in-out_infinite_0.2s]"></div>
                  <div className="w-1/4 bg-[#EBEBE6]/50 rounded-t-lg h-[50%] animate-[loading_3s_ease-in-out_infinite_0.5s]"></div>
                  <div className="w-1/4 bg-violet-300/50 rounded-t-lg h-[70%] animate-[loading_3s_ease-in-out_infinite_0.8s]"></div>
                  {/* Vinner-stolpen */}
                  <div className="w-1/4 bg-gradient-to-t from-violet-500 to-indigo-500 rounded-t-lg h-[100%] relative shadow-lg animate-[loading_3s_ease-in-out_infinite_1.1s]">
                    <div className="absolute -top-2 -right-2 w-4 h-4 bg-white rounded-full animate-ping opacity-75"></div>
                    <div className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-[#1A1A1A] rounded-full"></div>
                  </div>
                </div>

              </div>
            </div>

            {/* Teksten */}
            <div className="text-left sm:text-right">
              <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#1A1A1A] tracking-tight leading-[1.2] sm:leading-[1.15]">
                Vi bruker <span className="text-[#1A1A1A]">AI</span> til å gi deg en <br className="hidden sm:block" />
                konkret oppskrift på å <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">nå toppen.</span>
              </h2>

              <p className="mt-4 sm:mt-8 text-base sm:text-xl md:text-2xl text-[#808080] font-normal leading-relaxed max-w-2xl sm:ml-auto">
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(63,143,56,0.09)] text-[#3F8F38] text-[10px] font-bold uppercase tracking-widest mb-5 border border-[#EBEBE6]">
              <Users size={11} />
              <span>Er dette for meg</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-[#1A1A1A] mb-4 tracking-tight leading-tight">
              Sikt hjelper <span className="text-[#1A1A1A]">bedrifter som dere.</span>
            </h2>
            <p className="text-base sm:text-lg text-[#808080] font-medium max-w-2xl mx-auto">
              Hvis kundene dine søker etter deg på Google — så fungerer Sikt for deg. Her er noen eksempler.
            </p>
          </div>
        </RevealOnScroll>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          {industries.map((industry, i) => (
            <RevealOnScroll key={i} direction="up" delay={i * 50}>
              <div className="group p-5 sm:p-7 bg-white/70 backdrop-blur-sm border border-[#EBEBE6] rounded-2xl sm:rounded-3xl ui-motion ui-lift-sm h-full [@media(hover:hover)_and_(pointer:fine)]:hover:border-[#EBEBE6] [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-lg">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#F5F5F0] text-[#1A1A1A] flex items-center justify-center mb-4 [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-violet-700 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-white transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]">
                  {industry.icon}
                </div>
                <h3 className="text-sm sm:text-base font-black text-[#1A1A1A] mb-1">{industry.name}</h3>
                <p className="text-[11px] sm:text-xs text-[#808080] font-medium leading-relaxed">{industry.example}</p>
              </div>
            </RevealOnScroll>
          ))}
        </div>

        <RevealOnScroll direction="up" delay={300}>
          <p className="text-center text-xs sm:text-sm text-[#808080] font-medium mt-8 italic">
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
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F5F5F0] backdrop-blur-md border border-[#EBEBE6] text-[#808080] text-[10px] sm:text-xs font-bold mb-6 sm:mb-8 uppercase tracking-widest">
              <BrainCircuit size={13} />
              <span>Både Google og AI</span>
            </div>

            <h2 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight mb-4 sm:mb-6 leading-[1.1] sm:leading-[1.05]">
              Google er ikke <span className="text-[#1A1A1A]">alene</span> lenger.
              <br className="hidden sm:block" />
              <span className="sm:hidden"> </span>Kundene spør også ChatGPT.
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-[#808080] max-w-2xl mx-auto leading-relaxed font-medium px-2">
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
                  <div className="w-9 h-9 rounded-full bg-[#1A1A1A]/70 flex items-center justify-center">
                    <SearchIcon size={16} className="text-[#808080]" />
                  </div>
                  <span className="text-xs uppercase tracking-widest text-[#808080] font-bold">Google</span>
                </div>
                <span className="text-[9px] uppercase tracking-wider text-[#1A1A1A] font-black bg-[#F5F5F0] px-2 py-0.5 rounded-full border border-[#EBEBE6]">Fortsatt viktig</span>
              </div>

              <div className="bg-white/10 rounded-xl p-4 mb-5 border border-white/5">
                <p className="text-sm text-[#EBEBE6] italic">"Beste SEO-byrå Oslo"</p>
              </div>

              {/* Fake søkeresultater */}
              <div className="space-y-3">
                <div className="flex items-start gap-2 opacity-70">
                  <div className="w-1 h-1 rounded-full bg-[#808080] mt-2 shrink-0"></div>
                  <div className="h-2.5 bg-[#808080] rounded-full w-3/4"></div>
                </div>
                <div className="flex items-start gap-2 opacity-50">
                  <div className="w-1 h-1 rounded-full bg-[#808080] mt-2 shrink-0"></div>
                  <div className="h-2.5 bg-[#808080] rounded-full w-2/3"></div>
                </div>
                <div className="flex items-start gap-2 opacity-30">
                  <div className="w-1 h-1 rounded-full bg-[#808080] mt-2 shrink-0"></div>
                  <div className="h-2.5 bg-[#808080] rounded-full w-1/2"></div>
                </div>
                <div className="flex items-start gap-2 opacity-20">
                  <div className="w-1 h-1 rounded-full bg-[#808080] mt-2 shrink-0"></div>
                  <div className="h-2.5 bg-[#808080] rounded-full w-5/6"></div>
                </div>
              </div>

              <p className="text-xs text-[#808080] mt-6 italic">Sikt løfter deg til topps her. Det er grunnmuren.</p>
            </div>
          </RevealOnScroll>

          {/* AI — Det nye laget */}
          <RevealOnScroll direction="right" delay={200}>
            <div className="relative bg-gradient-to-br from-violet-600/20 to-indigo-600/20 backdrop-blur-md border border-[#EBEBE6] rounded-3xl p-7 sm:p-9 h-full shadow-2xl shadow-violet-900/30">
              {/* "Nytt"-indikator */}
              <div className="absolute -top-3 -right-3 bg-[#1A1A1A] text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">
                Nytt
              </div>

              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
                    <Sparkles size={16} className="text-white" />
                  </div>
                  <span className="text-xs uppercase tracking-widest text-violet-200 font-bold">ChatGPT</span>
                </div>
                <span className="text-[9px] uppercase tracking-wider text-violet-200 font-black bg-[#EBEBE6] px-2 py-0.5 rounded-full border border-[#EBEBE6]">I tillegg</span>
              </div>

              <div className="bg-white/10 rounded-xl p-4 mb-5 border border-[#EBEBE6]">
                <p className="text-sm text-[#F5F5F0] italic">"Hvilket SEO-byrå bør jeg velge?"</p>
              </div>

              {/* AI-svar med én anbefaling */}
              <div className="space-y-3">
                <div className="bg-white/10 rounded-xl p-4 border border-[#EBEBE6]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-400 to-indigo-400 flex items-center justify-center">
                      <Sparkles size={10} className="text-white" />
                    </div>
                    <span className="text-xs text-violet-200 font-bold">ChatGPT</span>
                  </div>
                  <p className="text-sm text-[#F5F5F0] leading-relaxed">
                    Jeg vil anbefale <span className="font-bold text-[#808080] bg-[#EBEBE6] px-1.5 rounded">din bedrift</span> — de er kjent for...
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
              Sikt jobber for <span className="text-[#1A1A1A]">begge deler.</span>
            </h3>
            <p className="text-[#808080] text-base sm:text-lg mb-10 leading-relaxed">
              Vi løfter deg høyere på Google — og sørger samtidig for at ChatGPT, Gemini og Perplexity anbefaler deg.
              <br className="hidden sm:block" />
              Ingen andre byråer i Norge gjør begge deler — ennå.
            </p>

            <button
              onClick={() => onSelectPlan('PREMIUM')}
              className="group ui-motion ui-lift inline-flex items-center gap-3 px-10 py-5 bg-violet-700 text-white rounded-full text-base sm:text-lg font-black tracking-tight shadow-xl shadow-violet-900/50 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-600 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-violet-500/20"
            >
              Inkludert i Premium
              <ArrowRight size={20} className="transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1.5" />
            </button>

            <p className="text-xs text-[#808080] mt-5 uppercase tracking-widest font-bold">
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
      tagline: "Når én ny kunde er verdt titusener.",
      desc: "Bygd for bedrifter der hver kunde teller mest — advokater, tannleger, klinikker, håndverkere og B2B. Full synlighet i både Google og AI-søk, så du fanger kundene konkurrentene dine går glipp av. Én ekstra kunde i måneden betaler hele abonnementet.",
      features: [
        { text: "Alt i Standard", detail: "Auto-fiks, ukentlig kvittering, AI-tekster, 50-søkeord-sporing, konkurrent-radar og prioritert support er inkludert." },
        { text: "For høyverdi-bransjer der ett oppdrag betaler året", detail: "Tjenesten er priset for bedrifter med høy kundeverdi — advokat, tannlege, eiendomsmegler, entreprenør, B2B. Er marginen din lav per kunde, er Standard sannsynligvis riktigere for deg." },
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
    <section id="priser" className="py-16 sm:py-24 md:py-32 bg-[#F5F5F0] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-5 relative z-10">

        <RevealOnScroll direction="up">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#1A1A1A] mb-4 sm:mb-6">Velg din <span className="text-[#1A1A1A]">vekstplan</span></h2>
            <p className="text-base sm:text-lg md:text-xl text-[#808080] max-w-2xl mx-auto px-2">Ingen skjulte kostnader. Ingen bindingstid. Trykk på <HelpCircle size={14} className="inline text-[#808080] -mt-0.5" /> for å se detaljer.</p>
          </div>
        </RevealOnScroll>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-start">
          {plans.map((plan, i) => (
            <RevealOnScroll key={i} direction="up" delay={i * 100}>
              <div className={`relative bg-white rounded-3xl sm:rounded-[32px] p-6 sm:p-8 md:p-10 shadow-xl transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-2 border ${plan.highlighted ? 'border-violet-400 shadow-violet-200/50 md:scale-105 z-10' : 'border-[#EBEBE6]'}`}>

                <div className="absolute -top-3 -right-2 sm:-top-4 sm:-right-4 bg-[#1A1A1A] text-white text-[10px] sm:text-xs font-black px-2.5 py-1 sm:px-3 rounded-full shadow-lg shadow-violet-200 z-50 border-2 border-white transform rotate-12 whitespace-nowrap">
                  70% RABATT 1. MND
                </div>

                {plan.highlighted && (
                  <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 bg-[#1A1A1A] text-white px-3 sm:px-4 py-1 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wide shadow-lg whitespace-nowrap">
                    Mest valgt
                  </div>
                )}

                <h3 className="text-xl sm:text-2xl font-bold text-[#1A1A1A] mb-2 mt-2 sm:mt-0">{plan.title}</h3>
                <p className="text-[#1A1A1A] text-xs sm:text-sm font-bold mb-3 sm:mb-4 uppercase tracking-wider">{plan.tagline}</p>

                <div className="flex items-baseline gap-1 mb-3 sm:mb-4">
                  <span className="text-3xl sm:text-4xl font-black text-[#1A1A1A]">{plan.price},-</span>
                  <span className="text-[#808080] font-medium text-sm sm:text-base">/mnd</span>
                </div>
                <p className="text-sm sm:text-base text-[#808080] mb-6 sm:mb-8 leading-relaxed">{plan.desc}</p>

                <ul className="space-y-3 mb-6 sm:mb-8">
                  {plan.features.map((feat, j) => {
                    const detailKey = `${i}-${j}`;
                    const isOpen = openDetail === detailKey;
                    return (
                      <li key={j} className="text-[#1A1A1A]">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 w-5 h-5 rounded-full bg-[#F5F5F0] flex items-center justify-center text-[#1A1A1A] shrink-0">
                            <Check size={12} strokeWidth={3} />
                          </div>
                          <span className="text-sm font-medium flex-1">{feat.text}</span>
                          {feat.detail && (
                            <button
                              type="button"
                              onClick={() => setOpenDetail(isOpen ? null : detailKey)}
                              aria-label={isOpen ? "Skjul detaljer" : "Vis detaljer"}
                              className={`mt-0.5 shrink-0 transition-colors ${isOpen ? 'text-[#1A1A1A]' : 'text-[#808080] hover:text-[#1A1A1A]'}`}
                            >
                              <HelpCircle size={14} />
                            </button>
                          )}
                        </div>
                        {isOpen && feat.detail && (
                          <div className="mt-2 ml-8 p-3 bg-[#F5F5F0] border border-[#EBEBE6] rounded-lg text-xs text-[#808080] leading-relaxed">
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
                    ? 'bg-[#1A1A1A] text-white [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-700 shadow-lg [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-violet-200'
                    : 'bg-[#F5F5F0] text-[#1A1A1A] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#EBEBE6]'
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
            <div key={i} className="border border-[#EBEBE6] rounded-[24px] sm:rounded-[32px] overflow-hidden group [@media(hover:hover)_and_(pointer:fine)]:hover:border-[#EBEBE6] transition-[border-color,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full p-6 sm:p-8 flex items-center justify-between text-left [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-[#F5F5F0]/50 transition-[background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.99]"
              >
                <span className="text-base sm:text-xl font-bold text-[#1A1A1A] pr-6 sm:pr-8 leading-snug">{faq.q}</span>
                <ChevronDown className={`shrink-0 transition-transform duration-[280ms] ease-[cubic-bezier(0.77,0,0.175,1)] size-5 ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && (
                <div className="px-6 pb-6 sm:px-8 sm:pb-8 text-sm sm:text-lg text-[#808080] leading-relaxed font-medium animate-fade-in">
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
    { icon: Key,      label: 'Kobler til Google Search Console', detail: 'Søkeord fra Google kommer vanligvis om 1–2 uker — vi varsler deg når data er inne', duration: 12000 },
    { icon: Activity, label: 'Kjører teknisk helsesjekk',         detail: 'Ytelse, mobil, SSL og tekniske funn — klart på minutter', duration: 15000 },
    { icon: Radar,    label: 'Scanner konkurrenter',              detail: 'Første oversikt over hvem som ranker i din nisje', duration: 14000 },
    { icon: Sparkles, label: 'Klargjør AI-innsikt & dashboard',   detail: 'Teknisk analyse og anbefalinger er klare med én gang', duration: 14000 },
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
    <section className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Bakgrunnseffekter */}
      <div className="absolute inset-0 grid-pattern opacity-[0.03] pointer-events-none"></div>
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-transparent rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-transparent rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-2xl w-full bg-white rounded-[32px] shadow-2xl border border-[#EBEBE6] overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-300">

        {/* Toppstripe — fylles opp i takt med hovedprogressjonen */}
        <div className="h-1.5 bg-[#F5F5F0] relative overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 via-indigo-500 to-emerald-500 transition-[width] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]"
            style={{ width: `${overallProgress}%` }}
          />
        </div>

        <div className="p-8 sm:p-12 text-center">

          {/* Pulserende ikon som skifter med aktivt steg */}
          <div className="mx-auto w-24 h-24 bg-[#F5F5F0] rounded-full flex items-center justify-center mb-6 relative">
            <div className="absolute inset-0 bg-[#F5F5F0] rounded-full animate-ping opacity-30"></div>
            <div className="absolute inset-2 bg-white rounded-full"></div>
            {currentStep < steps.length ? (
              (() => {
                const StepIcon = steps[currentStep].icon;
                return <StepIcon className="w-10 h-10 text-[#1A1A1A] relative z-10 animate-pulse" />;
              })()
            ) : (
              <CheckCircle2 className="w-12 h-12 text-[#1A1A1A] relative z-10" />
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-[#1A1A1A] mb-3">
            {currentStep < steps.length ? 'Setter opp Sikt for deg' : 'Alt er klart!'}
          </h1>
          <p className="text-[#808080] text-base sm:text-lg mb-2 leading-relaxed">
            {currentStep < steps.length
              ? steps[currentStep].detail
              : 'Åpner dashboardet ditt...'}
          </p>

          {/* Nedtelling + prosent */}
          <div className="flex items-center justify-center gap-4 mb-8 text-sm">
            <span className="text-[#808080] font-mono">
              {currentStep < steps.length
                ? `~${remainingSeconds}s igjen`
                : 'Ferdig'}
            </span>
            <span className="w-1 h-1 bg-[#EBEBE6] rounded-full" />
            <span className="text-[#1A1A1A] font-black">{Math.round(overallProgress)}%</span>
          </div>

          {/* Stor progress-bar */}
          <div className="h-2 bg-[#F5F5F0] rounded-full overflow-hidden mb-10 relative">
            <div
              className="h-full bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-500 rounded-full transition-[width,background-position] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] bg-[length:200%_100%]"
              style={{ width: `${overallProgress}%`, backgroundPosition: `${overallProgress * 2}% 0` }}
            />
          </div>

          {/* Steg-liste */}
          <div className="bg-[#F5F5F0] rounded-2xl p-6 text-left border border-[#EBEBE6]">
            <h3 className="text-xs font-bold text-[#808080] uppercase tracking-wider mb-5">Sikt jobber i bakgrunnen</h3>

            <div className="space-y-4 relative">
              <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-[#EBEBE6]"></div>

              {steps.map((step, i) => {
                const StepIcon = step.icon;
                const isDone = currentStep > i;
                const isActive = currentStep === i;
                const isPending = currentStep < i;

                return (
                  <div key={i} className="flex gap-4 items-center relative z-10">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shadow-sm ring-4 ring-[#F5F5F0] shrink-0 transition-[background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]
                      ${isDone ? 'bg-[#1A1A1A]' : isActive ? 'bg-white border-2 border-[#1A1A1A]' : 'bg-[#EBEBE6] border-2 border-white'}
                    `}>
                      {isDone ? (
                        <Check size={13} className="text-white" />
                      ) : isActive ? (
                        <div className="w-2 h-2 bg-[#808080] rounded-full animate-pulse" />
                      ) : (
                        <StepIcon size={11} className="text-[#808080]" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className={`text-sm font-bold transition-colors
                        ${isDone ? 'text-[#808080] line-through decoration-[#EBEBE6]' : isActive ? 'text-[#1A1A1A]' : 'text-[#808080]'}
                      `}>
                        {step.label}
                      </span>
                      {isActive && (
                        <span className="text-xs text-[#1A1A1A] font-medium animate-pulse mt-0.5">Jobber nå...</span>
                      )}
                      {isPending && (
                        <span className="text-xs text-[#808080] mt-0.5">Venter</span>
                      )}
                      {isDone && (
                        <span className="text-xs text-[#1A1A1A] font-medium mt-0.5">Ferdig</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-sm text-[#808080] mt-6 pt-5 border-t border-[#EBEBE6] leading-relaxed">
            Teknisk analyse er klar med én gang. Søkeorddata fra Google kommer vanligvis om 1–2 uker etter tilkobling — det er normalt for en ny konto, og du får varsel når tallene er inne.
          </p>
          <p className="text-xs text-[#808080] mt-3">
            Du blir automatisk sendt til dashboardet når oppsettet er ferdig.
          </p>

        </div>
      </div>
    </section>
  );
};



// --- VIEWS ---

const HomeView = ({ onNavigate, onSelectPlan }: { onNavigate: (view: string) => void, onSelectPlan: (plan?: string) => void }) => (
  <>
    <ScrollProgressRing />
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
    <ScrollProgressRing />
    <DeepDiveHero />
    <PainPointData />
    <AiProcessDeepDive />
    {/* Her er rettelsen: Vi bruker onSelectPlan i stedet for handleLogin */}
    <Pricing onSelectPlan={onSelectPlan || (() => { })} />
    <GeoFaq />
  </>
);


const TechnologyView = ({ onNavigate }: { onNavigate: (view: string) => void }) => (
  <div className="tech-page">
    <ScrollProgressRing />
    <TechHeroV2 />
    <TechChapter1Scan />
    <TechHorizontalFactors />
    <TechChapter2Data />
    <TechChapter3Brain />
    <TechChapter4Future />
    <TechChapter5Result />
    <TechCTAV2 onNavigate={onNavigate} />
  </div>
);

// --- OTHER SHARED COMPONENTS ---

const PainPointsSection = () => (
  <section className="py-12 sm:py-24 md:py-32 bg-transparent overflow-hidden relative text-center">
    <div className="max-w-6xl mx-auto px-5 sm:px-6">
      <RevealOnScroll direction="up">
        <div className="text-center mb-10 sm:mb-16 md:mb-20">
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#1A1A1A] mb-3 sm:mb-6">Synlighet er nøkkelen</h2>
          <p className="text-sm sm:text-lg md:text-xl text-[#1A1A1A] font-semibold opacity-90 px-4">Gir ikke markedsføringen din resultater?</p>
        </div>
      </RevealOnScroll>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5 relative z-10 text-left">
        {[
          { text: "Lave Google-rangeringer hindrer din suksess.", icon: <TrendingDown size={18} />, subIcon: <Monitor className="text-rose-200/40 absolute -right-2 -bottom-2 w-16 h-16 pointer-events-none" /> },
          { text: "Bortkastet tid på strategier som ikke virker.", icon: <Clock size={18} />, subIcon: <Clock className="text-[#F5F5F0] absolute -right-2 -bottom-2 w-16 h-16 pointer-events-none" /> },
          { text: "Frustrasjon over manglende kunder.", icon: <Frown size={18} />, subIcon: <User className="text-[#F5F5F0] absolute -right-2 -bottom-2 w-16 h-16 pointer-events-none" /> },
          { text: "Tapte muligheter for vekst og salg.", icon: <TrendingDown size={18} />, subIcon: <BarChart3 className="text-rose-200/40 absolute -right-2 -bottom-2 w-16 h-16 pointer-events-none" /> }
        ].map((point, i) => (
          <RevealOnScroll key={i} direction={i % 2 === 0 ? 'left' : 'right'} delay={i * 50}>
            <div className="flex items-center gap-4 sm:gap-6 p-6 sm:p-8 bg-white/60 backdrop-blur-sm rounded-2xl sm:rounded-3xl border border-[#EBEBE6] shadow-sm ui-motion ui-lift-sm relative overflow-hidden group [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-md">
              {point.subIcon}
              <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl bg-[#F5F5F0] flex items-center justify-center text-[#808080] [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-rose-50 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-rose-500 transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] shrink-0 relative z-10">
                {React.cloneElement(point.icon as React.ReactElement<any>, { size: 24 })}
              </div>
              <p className="text-[#1A1A1A] font-bold text-sm sm:text-lg leading-snug relative z-10">{point.text}</p>
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
    <section className="py-16 sm:py-32 bg-[#F5F5F0]/30 relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern opacity-[0.05] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-5 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-20">
          <div className="lg:col-span-4 flex flex-col items-center lg:items-start text-center lg:text-left">
            <RevealOnScroll direction="left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(63,143,56,0.09)] text-[#3F8F38] text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mb-6 border border-[#EBEBE6]">
                <HelpCircle size={11} />
                <span>Det du lurer på</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-[#1A1A1A] mb-6 leading-tight tracking-tight">
                Spørsmål vi <br className="hidden lg:block" /> faktisk får.
              </h2>
              <p className="text-[#808080] font-medium text-sm sm:text-lg leading-relaxed mb-8 max-w-md">
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
                      ? 'bg-white border-[#EBEBE6] shadow-xl shadow-violet-500/5'
                      : 'bg-white/60 backdrop-blur-sm border-[#EBEBE6] [@media(hover:hover)_and_(pointer:fine)]:hover:border-[#EBEBE6] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white'
                      }`}
                  >
                    <button
                      onClick={() => setOpenIndex(openIndex === i ? null : i)}
                      className={`w-full p-6 sm:p-8 flex items-center justify-between text-left gap-4 transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${openIndex === i ? 'bg-[#F5F5F0]/50' : ''}`}
                    >
                      <span className={`text-sm sm:text-lg font-bold transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] pr-2 sm:pr-4 ${openIndex === i ? 'text-[#1A1A1A]' : 'text-[#1A1A1A]'}`}>
                        {faq.question}
                      </span>
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center shrink-0 transition-[background-color,border-color,color,transform] duration-[280ms] ease-[cubic-bezier(0.77,0,0.175,1)] ${openIndex === i
                        ? 'bg-violet-700 border-violet-700 text-white shadow-lg'
                        : 'bg-[#F5F5F0] border-[#EBEBE6] text-[#808080]'
                        }`}>
                        <ChevronDown size={16} className={`transition-transform duration-[280ms] ease-[cubic-bezier(0.77,0,0.175,1)] ${openIndex === i ? 'rotate-180' : 'rotate-0'}`} />
                      </div>
                    </button>
                    <div className={`transition-[max-height,opacity,padding-bottom] duration-[280ms] ease-[cubic-bezier(0.77,0,0.175,1)] overflow-hidden ${openIndex === i ? 'max-h-[500px] opacity-100 pb-6 sm:pb-8' : 'max-h-0 opacity-0'}`}>
                      <div className="px-6 sm:px-8 text-xs sm:text-base text-[#808080] font-medium leading-relaxed pt-4 sm:pt-6 border-t border-[#EBEBE6]/50 mx-2">
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
      <div className="absolute top-0 left-1/4 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-[#F5F5F0] rounded-full blur-[100px] sm:blur-[120px] pointer-events-none"></div>
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
              className="group ui-motion ui-lift w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 bg-white text-[#1A1A1A] rounded-full text-base sm:text-lg font-black tracking-tight flex items-center justify-center gap-3 shadow-2xl [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#F5F5F0]"
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
    if (typeof window !== 'undefined') {
      localStorage.setItem('sikt_pending_plan', pakkeNavn);
    }
  } catch {
    /* ignore — hint for UI, ikke tilgang */
  }

  // Send brukeren til riktig betalingsside (Stripe/Vipps)
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
      icon: <FileText className="text-[#3F8F38]" />,
      illu: <FileText className="w-12 h-12 text-violet-100/50 absolute top-4 right-4" />
    },
    {
      title: "Spør Sikt AI hva som helst",
      desc: "Ikke en anelse hva et søkeord eller en backlink er? Spør dashboardet. Du får svar som en 10-åring kan forstå på 10 sekunder.",
      icon: <Sparkles className="text-[#3F8F38]" />,
      illu: <Sparkles className="w-12 h-12 text-violet-100/50 absolute top-4 right-4" />
    },
    {
      title: "Vi måler i kunder, ikke i bounce rate",
      desc: "Du ser ekte forretningstall: hvor mange besøkende, hvor mange potensielle kunder, hvor mye omsetning. Ikke tall du må google for å forstå.",
      icon: <TrendingUp className="text-[#3F8F38]" />,
      illu: <TrendingUp className="w-12 h-12 text-violet-100/50 absolute top-4 right-4" />
    }
  ];

  return (
    <section className="py-16 sm:py-32 bg-[#F5F5F0]/20 relative overflow-hidden text-center">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[50rem] h-[50rem] bg-violet-200/10 rounded-full blur-[140px] animate-mesh opacity-60"></div>
      </div>

      <div className="max-w-6xl mx-auto px-5 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-20 items-center">
          <RevealOnScroll direction="left">
            <div className="max-w-xl text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(63,143,56,0.09)] text-[#3F8F38] text-[10px] font-bold uppercase tracking-widest mb-6 border border-[#EBEBE6]">
                <Sparkles size={11} />
                <span>Hvorfor Sikt</span>
              </div>
              <h2 className="text-2xl sm:text-4xl lg:text-6xl font-extrabold tracking-tight text-[#1A1A1A] mb-4 sm:mb-8 leading-tight">
                Andre byråer snakker tech.
                <br />
                <span className="text-[#3F8F38]">Vi snakker norsk.</span>
              </h2>
              <p className="text-sm sm:text-lg md:text-xl text-[#808080] leading-relaxed mb-8 font-medium opacity-80">
                Du driver en bedrift, ikke et IT-selskap. Sikt oversetter alt det tekniske til plain norsk — så du kan fokusere på det viktigste: kundene dine.
              </p>
              <div className="hidden lg:flex gap-4">
                <div className="w-20 h-20 bg-[#F5F5F0] rounded-2xl flex items-center justify-center text-[#1A1A1A] rotate-6 shadow-sm"><FileText size={32} /></div>
                <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-400 -rotate-3 shadow-sm mt-8"><Sparkles size={32} /></div>
                <div className="w-20 h-20 bg-fuchsia-50 rounded-2xl flex items-center justify-center text-fuchsia-400 rotate-12 shadow-sm"><TrendingUp size={32} /></div>
              </div>
            </div>
          </RevealOnScroll>
          <div className="grid grid-cols-1 gap-4 sm:gap-6 text-left">
            {benefits.map((benefit, i) => (
              <RevealOnScroll key={i} direction="right" delay={i * 100}>
                <div className="p-6 sm:p-8 rounded-[28px] sm:rounded-[36px] bg-white/80 backdrop-blur-sm border border-[#EBEBE6] ui-motion ui-lift-sm h-full flex flex-col sm:flex-row sm:items-start gap-5 relative overflow-hidden [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-xl [@media(hover:hover)_and_(pointer:fine)]:hover:border-[#EBEBE6]">
                  {benefit.illu}
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-[#F5F5F0] flex items-center justify-center shrink-0 relative z-10">
                    {React.cloneElement(benefit.icon as React.ReactElement<any>, { size: 28 })}
                  </div>
                  <div className="flex-1 relative z-10">
                    <h3 className="text-base sm:text-xl font-bold text-[#1A1A1A] mb-2">{benefit.title}</h3>
                    <p className="text-xs sm:text-base text-[#808080] leading-relaxed font-medium">{benefit.desc}</p>
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
            <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#1A1A1A] mb-4 sm:mb-8">3 trinn til suksess</h2>
            <p className="text-sm sm:text-lg md:text-xl text-[#808080] font-medium max-w-2xl mx-auto leading-relaxed opacity-90 px-4">
              Vi har forenklet SEO. Slik tar vi din bedrift fra usynlig til markedsleder.
            </p>
          </div>
        </RevealOnScroll>

        {/* Stegene */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 sm:gap-16 relative mb-16">
          <div className="hidden md:block absolute top-[30%] left-[15%] right-[15%] h-[1px] bg-[#F5F5F0] -z-0"></div>
          {steps.map((step, i) => (
            <RevealOnScroll key={i} direction="up" delay={i * 150}>
              <div className="relative z-10 flex flex-col items-center group cursor-default">

                <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-[32px] sm:rounded-[44px] bg-white border border-[#EBEBE6] shadow-sm flex items-center justify-center mb-8 relative [@media(hover:hover)_and_(pointer:fine)]:group-hover:-translate-y-2 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-visible">

                  {/* --- HER ER RABATT-BADGEN --- */}
                  {step.number === "1" && (
                    <div className="absolute -top-4 -left-6 bg-[#1A1A1A] text-white text-[10px] sm:text-xs font-black px-3 py-1 rounded-full shadow-lg shadow-violet-200 z-50 border-2 border-white transform -rotate-12 whitespace-nowrap">
                      70% RABATT
                    </div>
                  )}
                  {/* --------------------------- */}

                  <div className="absolute -top-1 -right-1 w-8 h-8 sm:w-10 sm:h-10 bg-[#1A1A1A] text-white rounded-xl flex items-center justify-center text-xs sm:text-sm font-black border-2 border-white relative z-20">0{step.number}</div>

                  {/* Ikoner og illustrasjoner */}
                  <div className="relative z-10 overflow-hidden w-full h-full rounded-[32px] sm:rounded-[44px] flex items-center justify-center">
                    {step.illu}
                    {React.cloneElement(step.icon as React.ReactElement<any>, { size: 32, className: "text-[#1A1A1A] relative z-10" })}
                  </div>

                </div>

                <h3 className="text-xl sm:text-2xl font-bold text-[#1A1A1A] mb-3 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-violet-700 transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]">{step.title}</h3>
                <p className="text-sm sm:text-lg text-[#808080] font-medium leading-relaxed max-w-xs mx-auto">{step.desc}</p>
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
            className="group ui-motion w-full sm:w-auto flex items-center justify-center gap-3 bg-[#1A1A1A] text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl font-bold text-base sm:text-lg shadow-xl shadow-[rgba(26,26,26,0.08)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-700 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-violet-200"
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
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-[rgba(63,143,56,0.09)] text-[#3F8F38] text-[10px] font-black uppercase tracking-widest mb-4 border border-[#EBEBE6]">
                <Sparkles size={12} />
                <span>Vi forstår problemet</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-[#1A1A1A] leading-[1.15] sm:leading-[1.1] tracking-tight">
                Føles markedsføringen <span className="text-[#1A1A1A]">ineffektiv?</span>
              </h2>
              <div className="space-y-4 sm:space-y-6 text-[#808080] font-medium leading-relaxed mt-6 sm:mt-8">
                <p className="text-base sm:text-lg md:text-xl text-[#1A1A1A] font-bold">
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
              <div className="p-6 sm:p-8 md:p-10 bg-white border border-[#EBEBE6] rounded-3xl sm:rounded-[32px] shadow-sm ui-motion ui-lift-sm relative overflow-hidden group [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-xl">
                <div className="absolute -right-6 -bottom-6 opacity-5 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-10 [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-110 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]">
                  <HeartHandshake size={180} />
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 mb-4 sm:mb-6">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 shrink-0 shadow-inner">
                    <SearchCheck size={24} />
                  </div>
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-[#1A1A1A]">Full åpenhet, null gjetting</h3>
                </div>
                <p className="text-sm sm:text-base md:text-lg text-[#808080] font-medium leading-relaxed max-w-xl">
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
                  <h3 className="text-lg sm:text-xl font-black text-[#1A1A1A] mb-2 sm:mb-3">Drevet av moderne AI</h3>
                  <p className="text-sm sm:text-base text-[#808080] font-medium leading-relaxed">
                    Vi bruker banebrytende teknologi for å maksimere rekkevidden din og automatisere suksess på en måte tradisjonelle metoder ikke kan.
                  </p>
                </div>
              </div>
            </RevealOnScroll>

            {/* Kort 3: Vekst (Liten) */}
            <RevealOnScroll direction="up" delay={200}>
              <div className="group p-6 sm:p-8 bg-[#F5F5F0]/30 border border-[#EBEBE6]/50 rounded-3xl sm:rounded-[32px] shadow-sm ui-motion ui-lift-sm relative h-full flex flex-col justify-between overflow-hidden [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-xl">
                <div className="absolute -right-4 -top-4 opacity-5 [@media(hover:hover)_and_(pointer:fine)]:group-hover:-rotate-12 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]">
                  <BarChart4 size={100} />
                </div>
                <div className="w-11 h-11 sm:w-12 sm:h-12 bg-[#1A1A1A] rounded-xl flex items-center justify-center text-white mb-4 sm:mb-6 shadow-lg shadow-emerald-100">
                  <TrendingUp size={22} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-[#1A1A1A] mb-2 sm:mb-3">Velprøvde strategier</h3>
                  <p className="text-sm sm:text-base text-[#808080] font-medium leading-relaxed">
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
  const iconTileClass =
    'w-12 h-12 rounded-xl flex items-center justify-center mb-4 sm:mb-6 shrink-0 border border-white/10 bg-white/[0.08] transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.04]';

  return (
    <section className="py-16 sm:py-20 md:py-24 bg-[#1A1A1A] text-white relative overflow-hidden">
      {/* Bakgrunnseffekt */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
        <div className="absolute top-[-50%] left-[-10%] w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] rounded-full bg-violet-900 blur-[100px] sm:blur-[120px]"></div>
        <div className="absolute bottom-[-50%] right-[-10%] w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] rounded-full bg-indigo-900 blur-[80px] sm:blur-[100px]"></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-5 relative z-10 text-center">

        <div className="mb-10 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-white/[0.08] border border-white/15 text-violet-200 text-xs sm:text-sm font-bold mb-6 sm:mb-8">
            <ShieldCheck size={14} className="text-[#6BBF63]" />
            <span>Null risiko. Full kontroll.</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 sm:mb-6 leading-tight text-white">
            Vår <span className="text-violet-300">Kvalitetsgaranti</span>
          </h2>
          <p className="text-base sm:text-lg text-white/60 max-w-2xl mx-auto leading-relaxed px-2">
            Vi vet at du har brent deg på byråer før. Derfor har vi fjernet usikkerheten og lagt risikoen på våre skuldre, ikke dine.
          </p>
        </div>

        {/* GARANTI-GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 text-left">

          {/* Punkt 1: Økonomi (OPPDATERT MED 70% RABATT) */}
          <div className="bg-gradient-to-br from-violet-900/50 to-indigo-950/40 border border-violet-500/25 p-6 sm:p-8 rounded-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 bg-violet-700 text-white text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 rounded-bl-xl">
              ØKONOMISK TRYGGHET
            </div>
            <div className={`${iconTileClass} bg-violet-500/20 border-violet-400/20 text-white shadow-lg shadow-violet-900/30 mt-2`}>
              <span className="text-xl font-black">70%</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-white">70% rabatt start</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Er du usikker på effekten? Vi gir deg 70% rabatt den første måneden. Vi tar den økonomiske risikoen for å bevise at vi leverer verdi før du betaler fullpris. Ingen bindingstid.
            </p>
          </div>

          {/* Punkt 2: Sikkerhet */}
          <div className="bg-white/[0.04] border border-white/10 p-6 sm:p-8 rounded-3xl transition-[background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/[0.07] [@media(hover:hover)_and_(pointer:fine)]:hover:border-white/15 group">
            <div className={`${iconTileClass} text-[#6BBF63]`}>
              <ShieldCheck size={22} />
            </div>
            <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-white">Din side er trygg</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Frykt ikke for nettsiden din. Vi tar alltid full backup før arbeid. Ingen endringer publiseres uten din godkjenning. Vi passer på merkevaren din.
            </p>
          </div>

          {/* Punkt 3: Kvalitet */}
          <div className="bg-white/[0.04] border border-white/10 p-6 sm:p-8 rounded-3xl transition-[background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/[0.07] [@media(hover:hover)_and_(pointer:fine)]:hover:border-white/15 group">
            <div className={`${iconTileClass} text-violet-300`}>
              <User size={22} />
            </div>
            <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-white">Ekte eksperter</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Ingen automatiserte søppel-rapporter. En rådgiver analyserer din bedrift manuelt og legger en konkret slagplan for å slå dine konkurrenter.
            </p>
          </div>

          {/* Punkt 4: Arbeidsmengde (Med Zap i stedet for Coffee for å unngå feil) */}
          <div className="bg-white/[0.04] border border-white/10 p-6 sm:p-8 rounded-3xl transition-[background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/[0.07] [@media(hover:hover)_and_(pointer:fine)]:hover:border-white/15 group">
            <div className={`${iconTileClass} text-amber-300`}>
              <Zap size={22} />
            </div>
            <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-white">Vi gjør jobben</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Slipp å lære deg SEO. Vi tar det tunge tekniske løftet. Din eneste oppgave er å si "ja" eller "nei" til våre forslag.
            </p>
          </div>

          {/* Punkt 5: Fremtiden */}
          <div className="md:col-span-2 bg-white/[0.04] border border-white/10 p-6 sm:p-8 rounded-3xl transition-[background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/[0.07] [@media(hover:hover)_and_(pointer:fine)]:hover:border-white/15 group relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
              <div className={`${iconTileClass} text-rose-300 mb-0 sm:mb-0`}>
                <TrendingUp size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-white">Hva skjer på toppen?</h3>
                <p className="text-white/60 text-sm leading-relaxed mb-3 sm:mb-4">
                  Når vi når 1. plassen, er ikke jobben over. Da velger du veien videre:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-white/[0.06] p-3 sm:p-4 rounded-xl border border-white/10">
                    <strong className="text-white block text-sm mb-1">A) Forsvar</strong>
                    <span className="text-xs text-white/55">Vi overvåker og nøytraliserer konkurrenter som prøver å ta plassen din.</span>
                  </div>
                  <div className="bg-white/[0.06] p-3 sm:p-4 rounded-xl border border-white/10">
                    <strong className="text-white block text-sm mb-1">B) Dominans</strong>
                    <span className="text-xs text-white/55">Vi bruker tilliten Google nå har til deg for å vinne enda flere lønnsomme søkeord.</span>
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
            className="w-full sm:w-auto bg-white text-[#1A1A1A] px-6 sm:px-8 py-3.5 sm:py-4 rounded-full font-bold text-base sm:text-lg ui-motion shadow-lg shadow-white/10 transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-100 active:scale-[0.98]"
          >
            Start risikofritt i dag <ArrowRight className="inline ml-2" size={20} />
          </button>
          <p className="text-white/45 text-xs mt-4">Ingen liten skrift. Ingen skjulte gebyrer.</p>
        </div>

      </div>
    </section>
  );
};




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
        className="ui-motion inline-flex items-center gap-2 text-sm font-bold text-[#808080] mb-10 rounded-lg px-1 py-0.5 -ml-1 [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A]"
      >
        <ArrowLeft size={16} />
        Tilbake til forsiden
      </button>

      <div className="mb-12">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-[#1A1A1A] tracking-tight mb-4 leading-tight">
          {title}
        </h1>
        <p className="text-sm text-[#808080] font-bold uppercase tracking-widest">
          Sist oppdatert: {lastUpdated}
        </p>
      </div>

      <div className="prose-legal space-y-8 text-[#1A1A1A] leading-relaxed">
        {children}
      </div>

      <div className="mt-16 pt-10 border-t border-[#EBEBE6] text-sm text-[#808080]">
        <p className="mb-2">
          Har du spørsmål? Kontakt oss på{" "}
          <a href="mailto:siktseo@gmail.com" className="text-[#1A1A1A] font-bold hover:underline">
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
  <footer className="bg-[#1A1A1A] text-white py-16 sm:py-20 border-t border-slate-900 overflow-hidden relative text-center">
    <div className="max-w-6xl mx-auto px-5 relative z-10">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-10 sm:gap-12 mb-16 sm:mb-20">
        <div className="md:col-span-2 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-3 mb-6">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[#1A1A1A] font-black text-xl">S</div>
            <span className="text-2xl font-black tracking-tight">Sikt</span>
          </div>
          <p className="text-[#808080] font-medium max-w-sm leading-relaxed mb-8 mx-auto md:mx-0 text-sm">
            Mange bedrifter gjetter på hvordan de blir synlige på Google. Vi bruker AI til å gi deg en konkret oppskrift på å nå toppen, slik at du får trafikken og veksten du fortjener.
          </p>
          <div className="flex items-center justify-center md:justify-start gap-3 text-[#808080] transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] cursor-pointer [@media(hover:hover)_and_(pointer:fine)]:hover:text-white">
            <Mail size={16} className="text-[#1A1A1A]" />
            <span className="font-bold text-xs">siktseo@gmail.com</span>
          </div>
        </div>
        <div className="text-center md:text-left">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-[#808080] mb-6 sm:mb-8">Selskap</h4>
          <ul className="space-y-3 sm:space-y-4 text-[#808080] font-bold text-sm">
            <li><a href="#" className="transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A]">Om Sikt</a></li>
            <li><a href="#" className="transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A]">Tjenester</a></li>
          </ul>
        </div>
        <div className="text-center md:text-left">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-[#808080] mb-6 sm:mb-8">Kontakt</h4>
          <div className="flex justify-center md:justify-start gap-4 text-[#808080]">
            <Linkedin size={20} className="cursor-pointer transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A]" />
            <Twitter size={20} className="cursor-pointer transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A]" />
          </div>
        </div>
      </div>
      <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#808080] text-center">
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
    <nav className={`fixed top-0 left-0 right-0 z-50 navbar-shell-t ${isScrolled || isMobileMenuOpen ? 'bg-white/80 backdrop-blur-md border-b border-[#EBEBE6] py-3 sm:py-4 shadow-sm' : 'bg-transparent py-5 sm:py-8'}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex justify-between items-center">

        {/* LOGO */}
        <div className="flex items-center gap-2 sm:gap-3 cursor-pointer group" onClick={() => onNavigate('home')}>
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#1A1A1A] rounded-xl flex items-center justify-center text-white font-bold [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-violet-700 transition-[background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]">S</div>
          <span className="text-lg sm:text-xl font-black text-[#1A1A1A] [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-violet-700 transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]">Sikt</span>
        </div>

        {/* DESKTOP MENY */}
        <div className="hidden md:flex items-center gap-8">

          {/* Dashboard-knapp (KUN FOR BETALENDE KUNDER MED TILGANG) */}
          {user && hasAccess && (
            <button
              onClick={() => onNavigate('dashboard')}
              className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-full transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${currentView === 'dashboard' ? 'bg-[#EBEBE6] text-[#1A1A1A]' : 'text-[#808080] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#F5F5F0]'}`}
            >
              <BarChart3 size={18} />
              Dashboard
            </button>
          )}

          <button onClick={() => onNavigate('deepdive')} className={`text-sm font-bold transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${currentView === 'deepdive' ? 'text-[#1A1A1A] font-black' : 'text-[#808080] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A]'}`}>Bli synlig på google</button>
          <button onClick={() => onNavigate('technology')} className={`text-sm font-bold transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${currentView === 'technology' ? 'text-[#1A1A1A] font-black' : 'text-[#808080] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A]'}`}>Teknologien</button>

          {user ? (
            <div className="relative">
              {/* Profilbilde-knapp */}
              <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-2 focus:outline-none">
                <img src={getAvatarUrl(user)} className="w-9 h-9 rounded-full border-2 border-white shadow-sm" alt="" />
                <ChevronDown size={14} className={`text-[#808080] transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* DROPDOWN MENYEN */}
              {isProfileOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsProfileOpen(false)}></div>
                  <div className="absolute right-0 mt-3 w-60 bg-white rounded-2xl shadow-2xl border border-[#EBEBE6] py-2 animate-in zoom-in-95 duration-200 z-50 origin-top-right">
                    <div className="px-4 py-3 border-b border-[#EBEBE6] mb-1">
                      <p className="text-[10px] font-black text-[#808080] uppercase tracking-widest">Innlogget som</p>
                      <p className="text-sm font-bold text-[#1A1A1A] truncate">{user.email}</p>
                    </div>

                    {/* Dashboard også i dropdown for enkel tilgang */}
                    {hasAccess && (
                      <button onClick={() => { onNavigate('dashboard'); setIsProfileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-[#808080] transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] text-left [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#F5F5F0] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A] active:bg-[#F5F5F0]/80">
                        <BarChart3 size={16} /> Gå til Dashboard
                      </button>
                    )}

                    <button onClick={() => { onNavigate('profile'); setIsProfileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-[#808080] transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] text-left [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#F5F5F0] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A] active:bg-[#F5F5F0]/80">
                      <Settings size={16} /> Innstillinger
                    </button>

                    <button onClick={() => { onNavigate('billing'); setIsProfileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-[#808080] transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] text-left [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#F5F5F0] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A] active:bg-[#F5F5F0]/80">
                      <CreditCard size={16} /> Abonnement
                    </button>

                    <div className="my-1 border-b border-[#EBEBE6]"></div>

                    <button onClick={() => { onLogout(); setIsProfileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-rose-500 transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] text-left [@media(hover:hover)_and_(pointer:fine)]:hover:bg-rose-50 active:bg-rose-50/80">
                      <LogOut size={16} /> Logg ut
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button onClick={onLoginTrigger} className="ui-motion bg-[#1A1A1A] text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-[rgba(26,26,26,0.08)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-700">Kom i gang</button>
          )}
        </div>

        {/* MOBIL MENY KNAPP */}
        <button className="md:hidden p-2 -mr-2 text-[#1A1A1A]" aria-label={isMobileMenuOpen ? "Lukk meny" : "Åpne meny"} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>{isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}</button>
      </div>

      {/* MOBIL MENY (Expandable) */}
      {isMobileMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-white border-b border-[#EBEBE6] p-6 flex flex-col gap-4 shadow-xl md:hidden animate-in slide-in-from-top-5 duration-200">
          {user && hasAccess && (
            <button onClick={() => { onNavigate('dashboard'); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 text-lg font-bold text-[#1A1A1A] bg-[#F5F5F0] p-3 rounded-xl">
              <BarChart3 size={20} /> Dashboard
            </button>
          )}
          <button onClick={() => { onNavigate('deepdive'); setIsMobileMenuOpen(false); }} className="text-left font-bold text-[#808080] p-2 rounded-xl transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#F5F5F0] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A]">Bli synlig på google</button>
          <button onClick={() => { onNavigate('technology'); setIsMobileMenuOpen(false); }} className="text-left font-bold text-[#808080] p-2 rounded-xl transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#F5F5F0] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A]">Teknologien</button>
          {user && (
            <button onClick={() => { onLogout(); setIsMobileMenuOpen(false); }} className="text-left font-bold text-rose-500 p-2 flex items-center gap-2"><LogOut size={16} /> Logg ut</button>
          )}
          {!user && (
            <button onClick={() => { onLoginTrigger(); setIsMobileMenuOpen(false); }} className="bg-[#1A1A1A] text-white py-3 rounded-xl font-bold ui-motion [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-700">Kom i gang</button>
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
      <button onClick={onBack} className="mb-8 ui-motion text-sm font-bold text-[#808080] flex items-center gap-2 rounded-lg px-1 py-0.5 -ml-1 [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A]">
        <ArrowRight className="rotate-180" size={16} /> Tilbake
      </button>

      <h1 className="text-3xl font-black mb-10 text-[#1A1A1A]">Innstillinger</h1>

      <div className="flex flex-col md:flex-row gap-8">
        {/* MENY SIDEBAR */}
        <div className="w-full md:w-64 flex flex-col gap-2">
          <button onClick={() => setActiveTab('general')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] ${activeTab === 'general' ? 'bg-[#1A1A1A] text-white' : 'bg-white text-[#808080] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#F5F5F0]'}`}>
            <User size={18} /> Profil & Bedrift
          </button>
          <button onClick={() => setActiveTab('billing')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] ${activeTab === 'billing' ? 'bg-[#1A1A1A] text-white' : 'bg-white text-[#808080] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#F5F5F0]'}`}>
            <CreditCard size={18} /> Abonnement
          </button>
        </div>

        {/* INNHOLD */}
        <div className="flex-1">

          {/* FANE 1: PROFIL & BEDRIFT */}
          {activeTab === 'general' && (
            <div className="space-y-6">

              {/* Nettadresse med Lås */}
              <div className="bg-white p-6 rounded-2xl border border-[#EBEBE6] shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-[#1A1A1A]">Nettadresse</h3>
                  {isUrlLocked && <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded-full flex items-center gap-1"><Shield size={10} /> Låst</span>}
                </div>

                <div className={`flex items-center border rounded-lg p-2 transition-colors ${isUrlLocked ? 'bg-[#F5F5F0] border-[#EBEBE6]' : 'bg-white border-[#EBEBE6] focus-within:ring-2 focus-within:ring-violet-500'}`}>
                  <Globe size={18} className="text-[#808080] mx-2" />
                  <input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    disabled={isUrlLocked}
                    className={`flex-1 outline-none font-medium ${isUrlLocked ? 'bg-transparent text-[#808080] cursor-not-allowed' : 'text-[#1A1A1A]'}`}
                  />
                  {!isUrlLocked && (
                    <button onClick={handleSaveUrl} className="bg-[#1A1A1A] text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-violet-700 transition-colors">
                      Lagre
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[#808080] mt-2">
                  <span className="font-bold text-[#808080]">OBS:</span> Du kan kun endre nettadressen 1 gang.
                </p>
              </div>

              {/* Bransje (Søkbar) */}
              <div className="bg-white p-6 rounded-2xl border border-[#EBEBE6] shadow-sm">
                <h3 className="font-bold mb-4 text-[#1A1A1A]">Bransje</h3>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-3 text-[#808080]" size={18} />
                  <input
                    type="text"
                    placeholder="Søk bransje..."
                    value={industrySearch}
                    onFocus={() => setIsIndustryOpen(true)}
                    onChange={(e) => { setIndustrySearch(e.target.value); setIsIndustryOpen(true); }}
                    className="w-full pl-10 pr-4 py-2.5 border border-[#EBEBE6] rounded-lg bg-white outline-none font-medium text-[#1A1A1A] focus:ring-2 focus:ring-violet-500"
                  />
                  {/* Dropdown liste */}
                  {isIndustryOpen && industrySearch.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-[#EBEBE6] rounded-xl shadow-xl z-20">
                      {filteredIndustries.map((item) => (
                        <button key={item} onClick={() => { setIndustry(item); setIndustrySearch(item); setIsIndustryOpen(false); }} className="w-full text-left px-4 py-3 text-sm font-bold text-[#808080] hover:bg-[#F5F5F0] hover:text-[#1A1A1A] transition-colors">
                          {item}
                        </button>
                      ))}
                      {filteredIndustries.length === 0 && <div className="p-3 text-sm text-[#808080] italic">Ingen treff...</div>}
                    </div>
                  )}
                </div>
                {industry && <p className="mt-2 text-sm text-[#808080] font-bold">Valgt: <span className="text-[#1A1A1A]">{industry}</span></p>}
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
              <div className="bg-[#1A1A1A] text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-[#808080] text-xs font-bold uppercase tracking-widest mb-1">Nåværende plan</p>
                  <h3 className="text-3xl font-black mb-2">Gratis</h3>
                  <button className="bg-white text-[#1A1A1A] px-6 py-2.5 rounded-lg font-bold text-sm ui-motion mt-4 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#F5F5F0]">Endre plan</button>
                </div>
                <div className="absolute top-0 right-0 p-32 bg-[#808080] rounded-full blur-3xl opacity-20 -mr-16 -mt-16"></div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-[#EBEBE6] shadow-sm">
                <h3 className="font-bold mb-4 text-[#1A1A1A]">Fakturahistorikk</h3>
                <div className="p-4 bg-[#F5F5F0] rounded-lg text-center text-[#808080] text-sm font-medium">Ingen fakturaer funnet</div>
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
    <div className="min-h-screen bg-[#F5F5F0] flex flex-col items-center justify-center p-4 relative overflow-hidden">

      <div className="absolute inset-0 grid-pattern opacity-[0.04] pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#F5F5F0] blur-[100px] rounded-full pointer-events-none animate-pulse"></div>

      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white/50 p-8 sm:p-12 relative z-10 text-center animate-in fade-in zoom-in-95 duration-[280ms]">

        <div className="w-16 h-16 bg-[#1A1A1A] rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-[rgba(26,26,26,0.08)] rotate-3 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:rotate-6">
          <Sparkles className="text-white w-8 h-8" />
        </div>

        <h2 className="text-3xl font-black text-[#1A1A1A] mb-3 tracking-tight">Velkommen</h2>
        <p className="text-[#808080] font-medium mb-8 leading-relaxed">
          Logg inn for å få tilgang til analysen din.
        </p>

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border border-[#EBEBE6] text-[#1A1A1A] font-bold py-4 px-6 rounded-xl ui-motion transition-[border-color,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-sm group [@media(hover:hover)_and_(pointer:fine)]:hover:border-[#EBEBE6] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#F5F5F0] [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-md"
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
          <span className="group-hover:text-[#1A1A1A] transition-colors">Fortsett med Google</span>
        </button>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-[#EBEBE6]"></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-[#808080]">eller</span>
          <div className="flex-1 h-px bg-[#EBEBE6]"></div>
        </div>

        {magicLinkSent ? (
          <div className="bg-[#F5F5F0] border border-emerald-200 rounded-xl p-5 text-left">
            <div className="flex items-center gap-3 mb-2">
              <Mail size={18} className="text-[#1A1A1A]" />
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
            <label className="text-xs font-bold text-[#808080] block">Logg inn med e-post (uten passord)</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="din@bedrift.no"
              className="w-full p-3 bg-white border border-[#EBEBE6] rounded-xl focus:ring-2 focus:ring-[#808080]/25 focus:border-transparent outline-none text-sm"
              disabled={magicLinkLoading}
            />
            <button
              type="submit"
              disabled={magicLinkLoading || !email.trim()}
              className="w-full flex items-center justify-center gap-2 bg-[#1A1A1A] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl ui-motion transition-[background-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-sm enabled:hover:bg-[#1A1A1A] enabled:hover:shadow-md"
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
            <p className="text-[10px] text-[#808080] text-center pt-1">
              Vi sender en engangs-lenke til e-posten din. Ingen passord å huske på.
            </p>
          </form>
        )}

        <button
          onClick={onBack}
          className="mt-8 text-sm font-bold text-[#808080] hover:text-[#808080] transition-colors flex items-center justify-center gap-2 mx-auto"
        >
          <ArrowLeft size={16} /> Gå tilbake til forsiden
        </button>

      </div>

      <div className="absolute bottom-6 flex gap-4 text-xs font-bold text-[#808080] uppercase tracking-widest">
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
    <div className="min-h-screen bg-[#F5F5F0] flex flex-col h-screen">
      <div className="bg-white border-b border-[#EBEBE6] px-6 py-4 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1A1A1A] rounded-lg flex items-center justify-center text-white font-bold text-xl">{user?.email?.charAt(0).toUpperCase()}</div>
          <div><h2 className="font-bold text-[#1A1A1A]">Ditt SEO Dashboard</h2><p className="text-xs text-[#808080]">Live data fra Google</p></div>
        </div>
        <button onClick={onBack} className="text-sm font-bold text-[#808080] hover:text-[#1A1A1A]">Tilbake</button>
      </div>
      <div className="flex-grow relative bg-white w-full h-full overflow-hidden">
        {loading && <div className="absolute inset-0 flex items-center justify-center bg-[#F5F5F0] z-10 text-[#808080]">Henter ferske tall...</div>}
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
      if (isApiRateLimited(scanRes.status, scanData)) {
        toastWarning(apiRateLimitUserMessage(scanData));
      } else if (!scanRes.ok) {
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
      if (isApiRateLimited(res.status, data)) {
        toastWarning(apiRateLimitUserMessage(data));
      } else if (!res.ok) {
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
          <div style={{ marginTop: -16 }}>
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
                    <p style={{ fontSize: 16, fontWeight: 700, color: C.ink, margin: 0, lineHeight: 1.3 }}>{selectedComp.keyword_count ? selectedComp.keyword_count : 'Skann for å telle søkeord'}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted, margin: '0 0 4px' }}>Snitt pos.</p>
                    <p style={{ fontSize: 38, fontWeight: 900, color: C.ink, margin: 0, lineHeight: 1 }}>
                      {selectedComp.avg_position ? `#${selectedComp.avg_position}` : 'Måles ved skann'}
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
                    Ingen rangeringer ennå — trykk «Skann». Første tall kommer vanligvis innen noen minutter.
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

// --- SIKT ACTIONS: flerlinje-logging fra skann (kun ekte tall fra respons) ---
type SiktLogEntry = {
  actionType: string;
  category: 'finding' | 'suggestion' | 'fix' | 'alert';
  title: string;
  details?: Record<string, unknown>;
  pageUrl?: string;
};

const buildAnalysisLogEntries = (mobile: AnalysisResult, pageUrl: string): SiktLogEntry[] => {
  const entries: SiktLogEntry[] = [
    { actionType: 'analysis_run', category: 'finding', title: `Mobil ytelse: ${mobile.performance}/100 (Lighthouse)`, details: { score: mobile.performance }, pageUrl },
    { actionType: 'analysis_run', category: 'finding', title: `Mobil SEO: ${mobile.seo}/100`, details: { seo: mobile.seo }, pageUrl },
    { actionType: 'analysis_run', category: 'finding', title: `Mobil tilgjengelighet: ${mobile.accessibility}/100`, details: { accessibility: mobile.accessibility }, pageUrl },
    { actionType: 'analysis_run', category: 'finding', title: `Mobil beste praksis: ${mobile.bestPractices}/100`, details: { best_practices: mobile.bestPractices }, pageUrl },
  ];
  const failed = (mobile.diagnostics || []).filter((d) => !d.passed);
  if (failed.length > 0) {
    entries.push({
      actionType: 'analysis_run',
      category: 'finding',
      title: `${failed.length} tekniske sjekkpunkter trenger oppmerksomhet`,
      details: { checks: failed.map((d) => d.title) },
      pageUrl,
    });
  }
  const opps = mobile.opportunities || [];
  if (opps.length > 0) {
    entries.push({
      actionType: 'analysis_run',
      category: 'finding',
      title: `${opps.length} forbedringsmuligheter identifisert på mobil`,
      details: { count: opps.length },
      pageUrl,
    });
    opps.slice(0, 3).forEach((o) => {
      entries.push({
        actionType: 'analysis_run',
        category: 'suggestion',
        title: o.savings ? `${o.title} (${o.savings})` : o.title,
        details: { savings: o.savings || null },
        pageUrl,
      });
    });
  }
  return entries.slice(0, 8);
};

const buildContentScanLogEntries = (pages: any[], pageUrl?: string): SiktLogEntry[] => {
  if (!pages.length) return [];
  const critical = pages.filter((p) => p.status === 'Kritisk').length;
  const warning = pages.filter((p) => p.status === 'Advarsel').length;
  const good = pages.filter((p) => p.status === 'Bra').length;
  const missingMeta = pages.filter((p) => (p.issues || []).some((i: string) => /meta/i.test(i))).length;
  const missingH1 = pages.filter((p) => (p.issues || []).some((i: string) => /H1/i.test(i))).length;
  const entries: SiktLogEntry[] = [
    { actionType: 'content_scan', category: 'finding', title: `Skannet ${pages.length} sider på nettsiden`, details: { total_pages: pages.length }, pageUrl },
  ];
  if (critical > 0) entries.push({ actionType: 'content_scan', category: 'finding', title: `${critical} sider med kritisk innhold`, details: { critical }, pageUrl });
  if (warning > 0) entries.push({ actionType: 'content_scan', category: 'finding', title: `${warning} sider med advarsler (tynt innhold m.m.)`, details: { warning }, pageUrl });
  if (good > 0) entries.push({ actionType: 'content_scan', category: 'finding', title: `${good} sider uten alvorlige innholdsfunn`, details: { good }, pageUrl });
  if (missingMeta > 0) entries.push({ actionType: 'content_scan', category: 'suggestion', title: `${missingMeta} sider mangler meta-beskrivelse`, details: { missing_meta: missingMeta }, pageUrl });
  if (missingH1 > 0) entries.push({ actionType: 'content_scan', category: 'suggestion', title: `${missingH1} sider mangler H1`, details: { missing_h1: missingH1 }, pageUrl });
  return entries.slice(0, 6);
};

const buildLinkScanLogEntries = (linkPages: any[], pageUrl?: string): SiktLogEntry[] => {
  if (!linkPages.length) return [];
  const isolated = linkPages.filter((p) => p.status === 'Isolert' || p.inlinks === 0).length;
  const healthy = linkPages.filter((p) => p.status === 'Bra').length;
  const entries: SiktLogEntry[] = [
    { actionType: 'link_scan', category: 'finding', title: `Kartla lenker på ${linkPages.length} sider`, details: { total_pages: linkPages.length }, pageUrl },
  ];
  if (isolated > 0) entries.push({ actionType: 'link_scan', category: 'finding', title: `${isolated} isolerte sider uten innkommende lenker`, details: { isolated }, pageUrl });
  if (healthy > 0) entries.push({ actionType: 'link_scan', category: 'finding', title: `${healthy} sider med god lenkestruktur`, details: { healthy }, pageUrl });
  return entries.slice(0, 4);
};

type ContentFixFieldType = 'meta-description' | 'seo-title' | 'h1' | 'content';

type WordPressFetchYoast = {
  installed: boolean;
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
};

type WordPressFetchResponse = {
  ok: boolean;
  page: {
    id: number;
    type: string;
    slug: string;
    link: string;
    title: string;
    content: string;
    excerpt: string;
  };
  yoast: WordPressFetchYoast;
};

type PageContextQaEntry = {
  question: string;
  answer: string;
};

type PageContextAnswersLegacy = {
  goal: string;
  audience: string;
  differentiator: string;
};

type PageContextAnswersQa = {
  qa: PageContextQaEntry[];
};

type PageContextAnswers = PageContextAnswersLegacy | PageContextAnswersQa;

type ContextQuestion = {
  question: string;
  options: string[];
  optional?: boolean;
};

type ContentFixCacheEntry = {
  pageData: WordPressFetchResponse;
  aiSuggestion: string | null;
  fieldType: ContentFixFieldType;
  pageContextAnswers?: PageContextAnswers | null;
  contextQuestions?: ContextQuestion[];
};

type ContentFixActiveState = {
  todoId: string | null;
  loading:
    | 'fetching'
    | 'generating-questions'
    | 'questionnaire'
    | 'generating'
    | 'idle'
    | 'error';
  error: string | null;
};

const PAGE_CONTEXT_GOAL_OPTIONS = [
  'Få henvendelser / kontakt',
  'Selge et produkt eller en tjeneste',
  'Bygge tillit og troverdighet',
  'Informere eller forklare noe',
] as const;

const PAGE_CONTEXT_AUDIENCE_OPTIONS = [
  'Privatkunder',
  'Bedrifter',
  'Lokale kunder i nærområdet',
  'Hele landet / bredt publikum',
] as const;

const FALLBACK_QUESTIONS: ContextQuestion[] = [
  {
    question: 'Hva er hovedmålet med denne siden?',
    options: [...PAGE_CONTEXT_GOAL_OPTIONS],
  },
  {
    question: 'Hvem snakker siden til?',
    options: [...PAGE_CONTEXT_AUDIENCE_OPTIONS],
  },
  {
    question: 'Hva skiller deg fra konkurrentene?',
    options: [],
    optional: true,
  },
];

function stripJsonFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function parseContextQuestionsResponse(raw: string): ContextQuestion[] | null {
  try {
    const parsed = JSON.parse(stripJsonFences(raw)) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const questionsRaw = (parsed as { questions?: unknown }).questions;
    if (!Array.isArray(questionsRaw)) return null;
    if (questionsRaw.length === 0) return [];

    const questions: ContextQuestion[] = [];
    for (const item of questionsRaw) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const question = typeof row.question === 'string' ? row.question.trim() : '';
      if (!question) continue;
      const options = Array.isArray(row.options)
        ? row.options
            .filter((opt): opt is string => typeof opt === 'string' && opt.trim().length > 0)
            .map((opt) => opt.trim())
        : [];
      questions.push({ question, options });
    }

    return questions.length > 0 ? questions : null;
  } catch {
    return null;
  }
}

const RATE_LIMIT_USER_MESSAGE =
  'Vi har mange forespørsler akkurat nå — prøv igjen om et minutt.';

function isApiRateLimited(status: number, data: Record<string, unknown> | null | undefined): boolean {
  return status === 429 || data?.error === 'rate_limited';
}

function apiRateLimitUserMessage(data: Record<string, unknown> | null | undefined): string {
  const msg = data?.message;
  return typeof msg === 'string' && msg.trim() ? msg : RATE_LIMIT_USER_MESSAGE;
}

// Trekker ut ny meta-tittel/-beskrivelse fra et AI-kodeforslag, slik at vi kan
// vise kunden en ekte Google-forhåndsvisning («slik ser du ut i søk»).
function extractSerpPreview(
  sol: { codePatch?: unknown; effectiveUrl?: unknown } | null | undefined,
  fallbackUrl?: string,
): { title: string | null; description: string | null; host: string } | null {
  if (!sol) return null;
  const code = typeof sol.codePatch === 'string' ? sol.codePatch : '';
  if (!code) return null;
  const titleMatch = code.match(/<title[^>]*>([^<]+)<\/title>/i);
  const descMatch =
    code.match(/name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    code.match(/content=["']([^"']+)["'][^>]*name=["']description["']/i);
  const title = titleMatch?.[1]?.trim() || null;
  const description = descMatch?.[1]?.trim() || null;
  if (!title && !description) return null;
  let host = '';
  const rawUrl = (typeof sol.effectiveUrl === 'string' && sol.effectiveUrl) || fallbackUrl || '';
  try {
    host = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`).hostname.replace(/^www\./, '');
  } catch {
    host = '';
  }
  return { title, description, host };
}

function buildContextQuestionsPrompt(pageData: WordPressFetchResponse): string {
  const contentRaw = decodeHtmlEntities(stripHtmlTags(pageData.page.content || ''));
  const content = truncateText(contentRaw, 2000);
  return `Du skal hjelpe med å forbedre teksten på denne siden. Her er sidens innhold: ${content}. Lag 2-4 spørsmål som hjelper deg å forstå siden godt nok til å skrive best mulig innhold. Hvis du allerede forstår nok, returner færre eller ingen spørsmål. Hvert spørsmål skal ha 3-4 konkrete svaralternativer tilpasset denne siden. Kunden kan også skrive eget svar. Svar KUN med gyldig JSON, ingen forklaring, på dette formatet: {"questions":[{"question":"...","options":["...","..."]}]}`;
}

async function generateContextQuestions(
  pageData: WordPressFetchResponse,
  signal: AbortSignal,
  token: string,
): Promise<ContextQuestion[]> {
  try {
    const aiRes = await fetch('/api/openai-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        prompt: buildContextQuestionsPrompt(pageData),
        model: 'gpt-4o-mini',
        maxTokens: 600,
      }),
      signal,
    });
    const aiData = await aiRes.json().catch(() => ({}));
    if (signal.aborted) return [];
    if (isApiRateLimited(aiRes.status, aiData)) {
      toastWarning(apiRateLimitUserMessage(aiData));
      return FALLBACK_QUESTIONS;
    }
    if (!aiRes.ok) return FALLBACK_QUESTIONS;

    const parsed = parseContextQuestionsResponse(String(aiData.content || ''));
    if (parsed === null) return FALLBACK_QUESTIONS;
    return parsed;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') {
      throw err;
    }
    return FALLBACK_QUESTIONS;
  }
}

function normalizePageContextAnswers(raw: unknown): PageContextAnswers | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;

  if (Array.isArray(o.qa)) {
    const qa = o.qa
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const question = typeof row.question === 'string' ? row.question.trim() : '';
        const answer = typeof row.answer === 'string' ? row.answer.trim() : '';
        if (!question || !answer) return null;
        return { question, answer };
      })
      .filter((entry): entry is PageContextQaEntry => entry != null);
    if (qa.length > 0) return { qa };
    return null;
  }

  const goal = typeof o.goal === 'string' ? o.goal.trim() : '';
  const audience = typeof o.audience === 'string' ? o.audience.trim() : '';
  const differentiator = typeof o.differentiator === 'string' ? o.differentiator.trim() : '';
  if (!goal || !audience) return null;
  return { goal, audience, differentiator };
}

function buildPageContextPromptBlock(normalized: PageContextAnswers): string {
  if ('qa' in normalized && normalized.qa.length > 0) {
    return `\n\nKontekst om siden (oppgitt av kunden):
${normalized.qa.map((x) => `- ${x.question}: ${x.answer}`).join('\n')}

Bruk denne konteksten til å gjøre forslaget relevant. Ikke dikt opp fakta utover det som er oppgitt.`;
  }
  if ('goal' in normalized) {
    return `\n\nKontekst om siden (oppgitt av kunden):
- Sidens hovedmål: ${normalized.goal}
- Målgruppe: ${normalized.audience}${normalized.differentiator ? `\n- Det som skiller bedriften ut: ${normalized.differentiator}` : ''}

Bruk denne konteksten til å gjøre forslaget relevant for kundens faktiske situasjon. Ikke dikt opp fakta om bedriften utover det som er oppgitt.`;
  }
  return '';
}

async function savePageContextAnswers(
  pageUrl: string,
  answers: PageContextAnswers,
  userId: string,
  clientHostId: string | null,
): Promise<void> {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('sikt_page_context').upsert(
      {
        user_id: userId,
        client_host_id: clientHostId,
        page_url: pageUrl,
        answers,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,page_url' },
    );
    if (error) {
      console.warn('[Verksted] Kunne ikke lagre page context:', error.message);
    }
  } catch (err: unknown) {
    console.warn('[Verksted] Kunne ikke lagre page context:', err);
  }
}

const INITIAL_CONTENT_FIX_ACTIVE: ContentFixActiveState = {
  todoId: null,
  loading: 'idle',
  error: null,
};

function detectFieldType(issueString: string): ContentFixFieldType {
  const lower = (issueString || '').toLowerCase();
  if (
    lower.includes('meta') &&
    (lower.includes('beskrivelse') || lower.includes('description'))
  ) {
    return 'meta-description';
  }
  if (
    (lower.includes('seo') || lower.includes('meta')) &&
    (lower.includes('tittel') || lower.includes('title'))
  ) {
    return 'seo-title';
  }
  if (lower.includes('h1')) {
    return 'h1';
  }
  if (lower.includes('innhold') || lower.includes('tynt') || lower.includes('thin')) {
    return 'content';
  }
  return 'content';
}

type ContentChangeRow = {
  id: string;
  page_url: string;
  field: string;
  old_value: string | null;
  new_value: string;
  pushed_at: string;
  client_host_id: string | null;
};

type TodoChangeData = {
  field: string;
  old_value: string | null;
  new_value: string;
  pushed_at: string;
};

function pathLabelFromPageUrl(pageUrl: string): string {
  try {
    const parsed = new URL(pageUrl);
    return parsed.pathname.replace(/\/$/, '') || '/';
  } catch {
    return pageUrl;
  }
}

function pageTitleFromPageUrl(pageUrl: string): string {
  try {
    const parsed = new URL(pageUrl);
    const path = parsed.pathname.replace(/\/$/, '');
    if (!path || path === '/') return 'Forside';
    const segments = path.split('/').filter(Boolean);
    const last = segments[segments.length - 1] || 'Forside';
    return last.charAt(0).toUpperCase() + last.slice(1);
  } catch {
    return 'Forside';
  }
}

function solvedTitleForField(field: string): string {
  if (field === 'meta-description') return 'Mangler meta description (løst)';
  if (field === 'seo-title') return 'Mangler SEO-tittel (løst)';
  if (field === 'h1') return 'Mangler H1 (løst)';
  if (field === 'content') return 'Tynt innhold (løst)';
  return 'Innhold endret (løst)';
}

function formatPushedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat('nb-NO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function googleSnippetBreadcrumb(url: string): string {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./i, '');
    const path = parsed.pathname.replace(/\/$/, '');
    if (!path || path === '/') return domain;
    const pathPart = path.split('/').filter(Boolean).join(' › ');
    return `${domain} › ${pathPart}`;
  } catch {
    return url;
  }
}

function googleSnippetDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return url;
  }
}

function googleSnippetSiteName(url: string): string {
  const domain = googleSnippetDomain(url);
  const base = domain.split('.')[0] || domain;
  if (!base) return domain;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function GoogleSnippetPreview({
  title,
  url,
  description,
  variant = 'desktop',
}: {
  title: string;
  url: string;
  description: string;
  variant?: 'desktop' | 'mobile';
}) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const isMobile = variant === 'mobile';
  const domain = googleSnippetDomain(url);
  const siteName = googleSnippetSiteName(url);
  const breadcrumb = googleSnippetBreadcrumb(url);
  const displayTitle = title?.trim() || '(Ingen tittel)';
  const faviconSize = isMobile ? 24 : 32;
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;

  useEffect(() => {
    setFaviconFailed(false);
  }, [domain, url]);

  const fontStack = "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif";

  return (
    <div
      className="ws-snippet-preview-enter"
      style={{
        padding: isMobile ? '10px 12px' : '14px 16px',
        background: '#FFFFFF',
        maxWidth: isMobile ? 380 : undefined,
        fontFamily: fontStack,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: isMobile ? 10 : 12, marginBottom: isMobile ? 8 : 10 }}>
        {faviconFailed ? (
          <span
            style={{
              width: faviconSize,
              height: faviconSize,
              borderRadius: '50%',
              background: '#EBEBE6',
              flexShrink: 0,
              marginTop: 2,
            }}
          />
        ) : (
          <img
            src={faviconUrl}
            alt=""
            width={faviconSize}
            height={faviconSize}
            onError={() => setFaviconFailed(true)}
            style={{ borderRadius: '50%', flexShrink: 0, marginTop: 2, objectFit: 'cover' }}
          />
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              margin: 0,
              fontSize: isMobile ? 13 : 14,
              fontWeight: 500,
              color: '#202124',
              lineHeight: 1.3,
              wordBreak: 'break-word',
            }}
          >
            {siteName}
          </p>
          <p
            style={{
              margin: '2px 0 0',
              fontSize: 12,
              color: '#5f6368',
              lineHeight: 1.35,
              wordBreak: 'break-word',
            }}
          >
            {breadcrumb}
          </p>
        </div>
      </div>
      <p
        style={{
          margin: '0 0 6px',
          fontSize: isMobile ? 18 : 20,
          fontWeight: 400,
          color: '#1a0dab',
          lineHeight: 1.3,
          display: '-webkit-box',
          WebkitLineClamp: 1,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
          wordBreak: 'break-word',
        }}
      >
        {displayTitle}
      </p>
      {description?.trim() ? (
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: '#4d5156',
            lineHeight: 1.58,
            display: '-webkit-box',
            WebkitLineClamp: isMobile ? 3 : 2,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
            wordBreak: 'break-word',
          }}
        >
          {description}
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: 14, color: '#808080', fontStyle: 'italic', lineHeight: 1.58 }}>
          (Ingen beskrivelse — Google vil generere én automatisk)
        </p>
      )}
    </div>
  );
}

function SnippetPreviewVariantToggle({
  value,
  onChange,
  ink,
  borderColor,
}: {
  value: 'desktop' | 'mobile';
  onChange: (next: 'desktop' | 'mobile') => void;
  ink: string;
  borderColor: string;
  muted: string;
}) {
  const options: Array<{ key: 'desktop' | 'mobile'; label: string }> = [
    { key: 'desktop', label: 'Desktop' },
    { key: 'mobile', label: 'Mobil' },
  ];
  return (
    <div
      role="group"
      aria-label="Forhåndsvisning"
      style={{
        display: 'inline-flex',
        border: `1px solid ${borderColor}`,
        borderRadius: 9,
        overflow: 'hidden',
        background: '#FFFFFF',
      }}
    >
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            style={{
              border: 'none',
              background: active ? ink : '#FFFFFF',
              color: active ? '#FFFFFF' : ink,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 160ms cubic-bezier(0.23, 1, 0.32, 1), color 160ms cubic-bezier(0.23, 1, 0.32, 1), transform 100ms ease-out',
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.97)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const CONTENT_FIX_VALUE_COPY: Record<
  ContentFixFieldType,
  {
    title: string;
    whatItIs: string;
    whyItMatters: string;
    recommendations: string[];
  }
> = {
  'meta-description': {
    title: 'Hva du tjener på en god meta-beskrivelse',
    whatItIs: 'Den 2-3 setninger lange teksten under tittelen i Google-søk.',
    whyItMatters:
      'Påvirker hvor mange som klikker på linken din. Påvirker ikke rangering direkte. Hvis siden mangler meta-beskrivelse, lager Google én automatisk — sjelden like overbevisende.',
    recommendations: [
      '120–155 tegn (vises i sin helhet uten å bli kuttet av)',
      'Inkluder hovednøkkelordet for siden',
      'Avslutt med en handlingsoppfordring',
    ],
  },
  'seo-title': {
    title: 'Hva du tjener på en god SEO-tittel',
    whatItIs: 'Tittelen som vises som klikkbar link i Google-søk.',
    whyItMatters:
      'Det første brukere ser. En av de viktigste enkeltfaktorene for både klikk-frekvens og hvordan Google rangerer siden.',
    recommendations: [
      '50–60 tegn (vises i sin helhet)',
      'Inkluder hovednøkkelordet tidlig i tittelen',
      'Beskriv konkret hva siden tilbyr',
    ],
  },
  h1: {
    title: 'Hva du tjener på en god H1-overskrift',
    whatItIs: 'Sidens hovedoverskrift, det største synlige tekstelementet på siden.',
    whyItMatters:
      'Forteller Google og besøkende hva siden handler om. Mangler den, mister du en grunnleggende strukturmarkør for både SEO og brukeropplevelse.',
    recommendations: [
      'Én tydelig H1 per side',
      'Inkluder hovednøkkelordet',
      'Hold den beskrivende og konkret',
    ],
  },
  content: {
    title: 'Hva du tjener på dypere innhold',
    whatItIs: 'Antall ord i sidens hovedinnhold.',
    whyItMatters:
      'Sider under 300 ord regnes ofte som tynt innhold av Google. Dypere innhold gir flere kontekst-signaler for hva siden handler om.',
    recommendations: [
      'Minimum 300 ord for grunnleggende SEO',
      '1000+ ord for konkurranseutsatte søk',
      'Strukturer med tydelige underoverskrifter',
    ],
  },
};

function ContentFixValueCard({
  fieldType,
  borderColor,
}: {
  fieldType: ContentFixFieldType;
  borderColor: string;
}) {
  const copy = CONTENT_FIX_VALUE_COPY[fieldType];
  const sectionTitleStyle = {
    margin: '0 0 6px',
    fontSize: 12,
    fontWeight: 700,
    color: '#808080',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  };
  const bodyStyle = { margin: 0, color: '#1A1A1A', fontSize: 13, lineHeight: 1.6 };
  return (
    <div
      style={{
        background: '#F5F5F0',
        border: `1px solid ${borderColor}`,
        borderRadius: 12,
        padding: '18px 20px',
      }}
    >
      <p style={{ margin: '0 0 16px', color: '#1A1A1A', fontSize: 15, fontWeight: 700 }}>{copy.title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <p style={sectionTitleStyle}>Hva det er</p>
          <p style={bodyStyle}>{copy.whatItIs}</p>
        </div>
        <div>
          <p style={sectionTitleStyle}>Hvorfor det påvirker deg</p>
          <p style={bodyStyle}>{copy.whyItMatters}</p>
        </div>
        <div>
          <p style={sectionTitleStyle}>Sikt anbefaler</p>
          <ul style={{ margin: 0, paddingLeft: 18, color: '#1A1A1A', fontSize: 13, lineHeight: 1.6 }}>
            {copy.recommendations.map((item) => (
              <li key={item} style={{ marginBottom: 4 }}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function getContentFixCharLimit(fieldType: ContentFixFieldType): number | null {
  if (fieldType === 'meta-description') return 155;
  if (fieldType === 'seo-title') return 60;
  return null;
}

function getContentFixCharCounter(count: number, fieldType: ContentFixFieldType) {
  const max = getContentFixCharLimit(fieldType);
  if (max == null) {
    return { color: '#808080', label: `${count} tegn`, overMax: false };
  }
  const ratio = count / max;
  let color = '#52A447';
  if (ratio > 1) color = '#C42E2E';
  else if (ratio >= 0.8) color = '#D97706';
  return { color, label: `${count} / ${max}`, overMax: count > max };
}

function findPlaceholders(text: string): string[] {
  const m = (text || '').match(/\[[^\]\n]{1,80}\]/g);
  return m ? Array.from(new Set(m)) : [];
}

function ContentFixPreviewSection({
  fieldType,
  pageData,
  editedSuggestion,
  previewVariant,
  onPreviewVariantChange,
  borderColor,
  green,
  muted,
  ink,
}: {
  fieldType: ContentFixFieldType;
  pageData: WordPressFetchResponse;
  editedSuggestion: string;
  previewVariant: 'desktop' | 'mobile';
  onPreviewVariantChange: (next: 'desktop' | 'mobile') => void;
  borderColor: string;
  green: string;
  muted: string;
  ink: string;
}) {
  const pageLink = pageData.page.link || '';
  const beforeTitle = decodeHtmlEntities(
    pageData.yoast?.title?.trim() || pageData.page.title || '',
  );
  const beforeDescription = decodeHtmlEntities(pageData.yoast?.description?.trim() || '');
  const beforeH1 = decodeHtmlEntities(pageData.page.title || '(Tom)');

  const previewCardStyle = (accent?: 'green') => ({
    background: '#FFFFFF',
    border: `1px solid ${borderColor}`,
    borderTop: accent === 'green' ? `3px solid ${green}` : undefined,
    borderRadius: 12,
    padding: accent === 'green' ? '12px 14px 14px' : '12px 14px 14px',
    overflow: 'hidden' as const,
  });

  const labelStyle = {
    margin: '0 0 10px',
    fontSize: 11,
    fontWeight: 700,
    color: muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  };

  if (fieldType === 'meta-description' || fieldType === 'seo-title') {
    const beforeSnippet = {
      title: beforeTitle,
      url: pageLink,
      description: beforeDescription,
      variant: previewVariant,
    };
    const afterSnippet =
      fieldType === 'meta-description'
        ? { title: beforeTitle, url: pageLink, description: editedSuggestion, variant: previewVariant }
        : { title: editedSuggestion, url: pageLink, description: beforeDescription, variant: previewVariant };
    const previewGridClass =
      previewVariant === 'mobile' ? 'ws-content-preview-stack' : 'ws-content-diff-grid';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <SnippetPreviewVariantToggle
            value={previewVariant}
            onChange={onPreviewVariantChange}
            ink={ink}
            borderColor={borderColor}
            muted={muted}
          />
        </div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: muted }}>Slik ser det ut i Google</p>
        <div className={previewGridClass} key={previewVariant}>
          <div style={previewCardStyle()}>
            <p style={labelStyle}>Før</p>
            <GoogleSnippetPreview {...beforeSnippet} />
          </div>
          <div style={previewCardStyle('green')}>
            <p style={{ ...labelStyle, color: green }}>Etter</p>
            <GoogleSnippetPreview {...afterSnippet} />
          </div>
        </div>
      </div>
    );
  }

  if (fieldType === 'h1') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: muted }}>Slik ser overskriften ut på siden</p>
        <div className="ws-content-diff-grid">
          <div style={previewCardStyle()}>
            <p style={labelStyle}>Før</p>
            <div style={{ background: '#F5F5F0', borderRadius: 8, padding: '16px 18px', boxShadow: '0 1px 4px rgba(26,26,26,0.04)' }}>
              <h1 style={{ margin: 0, color: ink, fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{beforeH1}</h1>
            </div>
          </div>
          <div style={previewCardStyle('green')}>
            <p style={{ ...labelStyle, color: green }}>Etter</p>
            <div style={{ background: '#F5F5F0', borderRadius: 8, padding: '16px 18px', boxShadow: '0 1px 4px rgba(26,26,26,0.04)' }}>
              <h1 style={{ margin: 0, color: ink, fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>
                {editedSuggestion.trim() || '(Tom)'}
              </h1>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (fieldType === 'content') {
    return null;
  }

  return null;
}

function stripHtmlTags(html: string): string {
  if (!html) return '';
  try {
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
    }
  } catch { /* fallback */ }
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  try {
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(text, 'text/html');
      return doc.documentElement.textContent || '';
    }
  } catch { /* fallback */ }
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&hellip;/gi, '…')
    .replace(/&rsquo;/gi, '\u2019')
    .replace(/&lsquo;/gi, '\u2018')
    .replace(/&rdquo;/gi, '\u201D')
    .replace(/&ldquo;/gi, '\u201C');
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trimEnd()}…`;
}

function buildContentFixAiPrompt(
  fieldType: ContentFixFieldType,
  pageData: WordPressFetchResponse,
  pageContextAnswers?: PageContextAnswers | null,
): string {
  const title = decodeHtmlEntities(stripHtmlTags(pageData.page.title || ''));
  const contextRaw = decodeHtmlEntities(
    stripHtmlTags(pageData.page.excerpt || pageData.page.content || ''),
  );
  const context = truncateText(contextRaw, 500);

  switch (fieldType) {
    case 'meta-description':
      return `Skriv en konkret meta-beskrivelse på norsk for denne nettsiden, maks 155 tegn. Bruk informasjonen fra sidens innhold til å gjøre den relevant. Returner KUN meta-beskrivelsen, ingen forklaring eller anførselstegn.\n\nSidetittel: ${title}\n\nInnhold:\n${context}`;
    case 'seo-title':
      return `Skriv en SEO-tittel på norsk, maks 60 tegn. Bruk informasjonen fra sidens innhold til å gjøre den relevant og klikkbar. Returner KUN tittelen, ingen forklaring eller anførselstegn.\n\nSidetittel: ${title}\n\nInnhold:\n${context}`;
    case 'h1':
      return `Forslå en H1-overskrift basert på sideinnholdet. Returner KUN overskriften, ingen forklaring eller anførselstegn.\n\nNåværende sidetittel: ${title}\n\nInnhold:\n${context}`;
    case 'content':
    default: {
      const normalized = pageContextAnswers ? normalizePageContextAnswers(pageContextAnswers) : null;
      const contextBlock = normalized ? buildPageContextPromptBlock(normalized) : '';
      return `Du skal skrive forbedret brødtekst for denne nettsiden. Behold tema og tone fra eksisterende innhold.

Returner kun selve den forbedrede sideteksten som rene avsnitt, klar til å være sidens innhold. Ikke skriv etiketter som "Sidetittel:" eller "Ny tekst:", ikke forklar endringene, ikke gjenta sidens tittel, og ikke inkluder metadata eller kommentarer. Skriv teksten slik en besøkende skal lese den på siden — naturlige avsnitt, ikke en rapport om hva som er endret.

Bakgrunn for deg (skal ikke gjenspeiles ordrett i svaret):
- Sidens tittel er «${title}» (ikke gjenta denne i brødteksten)
- Nåværende innhold på siden:
${truncateText(contextRaw, 800)}${contextBlock}`;
    }
  }
}

const ContentPageContextQuestionnaire: React.FC<{
  questions: ContextQuestion[];
  onSubmit: (answers: PageContextAnswers) => void;
  onSkip: () => void;
}> = ({ questions, onSubmit, onSkip }) => {
  const [responses, setResponses] = useState<Array<{ choice: string | null; custom: string }>>(() =>
    questions.map(() => ({ choice: null, custom: '' })),
  );

  useEffect(() => {
    setResponses(questions.map(() => ({ choice: null, custom: '' })));
  }, [questions]);

  const resolvedAnswers = responses.map((r) => r.custom.trim() || r.choice?.trim() || '');
  const canSubmit = questions.every((q, i) => q.optional || Boolean(resolvedAnswers[i]));

  const chipStyle = (selected: boolean): React.CSSProperties => ({
    border: `1px solid ${selected ? '#52A447' : '#EBEBE6'}`,
    background: selected ? 'rgba(82,164,71,0.1)' : '#FFFFFF',
    color: '#1A1A1A',
    borderRadius: 999,
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 160ms cubic-bezier(0.23, 1, 0.32, 1), background-color 160ms ease, border-color 160ms ease',
    textAlign: 'left' as const,
  });

  const pressHandlers = {
    onMouseDown: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.transform = 'scale(0.97)';
    },
    onMouseUp: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.transform = 'scale(1)';
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.transform = 'scale(1)';
    },
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    marginTop: 4,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #EBEBE6',
    background: '#F5F5F0',
    color: '#1A1A1A',
    fontSize: 13,
    outline: 'none',
  };

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #EBEBE6',
        borderRadius: 16,
        padding: '24px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
      }}
    >
      <div>
        <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#808080' }}>
          Før vi lager forslag
        </p>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.3 }}>
          Hjelp Sikt å forstå siden din
        </h3>
        <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.55, color: '#808080' }}>
          {questions.length === 1
            ? 'Et kort svar gir et mer relevant innholdsforslag. Svarene lagres for denne siden.'
            : `${questions.length} korte svar gir et mer relevant innholdsforslag. Svarene lagres for denne siden.`}
        </p>
      </div>

      {questions.map((q, index) => {
        const response = responses[index] || { choice: null, custom: '' };
        const hasCustom = Boolean(response.custom.trim());
        const useTextarea = q.options.length === 0;

        return (
          <div key={`${q.question}-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>
              {q.question}
              {q.optional ? (
                <span style={{ fontWeight: 500, color: '#808080' }}> (valgfritt)</span>
              ) : null}
            </p>
            {q.options.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {q.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    {...pressHandlers}
                    style={chipStyle(response.choice === option && !hasCustom)}
                    onClick={() => {
                      setResponses((prev) => {
                        const next = [...prev];
                        next[index] = { choice: option, custom: '' };
                        return next;
                      });
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
            {useTextarea ? (
              <textarea
                value={response.custom}
                onChange={(e) => {
                  const value = e.target.value;
                  setResponses((prev) => {
                    const next = [...prev];
                    next[index] = { choice: null, custom: value };
                    return next;
                  });
                }}
                placeholder="Skriv ditt svar …"
                rows={3}
                style={{ ...fieldStyle, lineHeight: 1.55, resize: 'vertical' }}
              />
            ) : (
              <input
                type="text"
                value={response.custom}
                onChange={(e) => {
                  const value = e.target.value;
                  setResponses((prev) => {
                    const next = [...prev];
                    const current = next[index] || { choice: null, custom: '' };
                    next[index] = { choice: value.trim() ? null : current.choice, custom: value };
                    return next;
                  });
                }}
                placeholder="Eller skriv ditt eget …"
                style={fieldStyle}
              />
            )}
          </div>
        );
      })}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
        <button
          type="button"
          disabled={!canSubmit}
          {...pressHandlers}
          onClick={() => {
            if (!canSubmit) return;
            const qa = questions
              .map((q, i) => ({
                question: q.question,
                answer: resolvedAnswers[i] || '',
              }))
              .filter((entry, i) => {
                if (questions[i].optional && !entry.answer) return false;
                return Boolean(entry.answer);
              });
            onSubmit({ qa });
          }}
          style={{
            border: 'none',
            borderRadius: 11,
            padding: '12px 20px',
            fontSize: 14,
            fontWeight: 700,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            background: canSubmit ? '#52A447' : '#EBEBE6',
            color: canSubmit ? '#FFFFFF' : '#808080',
            transition: 'transform 160ms cubic-bezier(0.23, 1, 0.32, 1), background-color 160ms ease',
          }}
        >
          Lag forslag
        </button>
        <button
          type="button"
          onClick={onSkip}
          style={{
            border: 'none',
            background: 'transparent',
            padding: 0,
            fontSize: 13,
            fontWeight: 600,
            color: '#808080',
            cursor: 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          Hopp over
        </button>
      </div>
    </div>
  );
};

function getWixFieldInstruction(fieldType: ContentFixFieldType): string {
  switch (fieldType) {
    case 'meta-description':
      return 'I Wix: Pages & Menu → klikk siden → SEO Basics → lim inn i Meta description → Publiser.';
    case 'seo-title':
      return 'I Wix: Pages & Menu → klikk siden → SEO Basics → lim inn i Title tag → Publiser.';
    case 'h1':
      return 'I Wix-editoren: klikk på overskriften øverst på siden, endre teksten, og Publiser.';
    case 'content':
    default:
      return 'I Wix-editoren: klikk på tekstområdet, lim inn den nye teksten, og Publiser.';
  }
}

function buildAdvisoryPageDataFromContentScan(
  pageUrl: string,
  pages: ContentPage[],
): WordPressFetchResponse | null {
  const match = pages.find((p) => p.fullUrl === pageUrl);
  if (!match) return null;
  let slug = '/';
  try {
    slug = new URL(pageUrl).pathname || '/';
  } catch {
    slug = match.url || '/';
  }
  const title = match.title.replace(/\.\.\.$/, '').trim() || match.url;
  return {
    ok: true,
    page: {
      id: 0,
      type: 'page',
      slug,
      link: pageUrl,
      title,
      content: '',
      excerpt: '',
    },
    yoast: { installed: false },
  };
}

function getContentFixCurrentValue(
  fieldType: ContentFixFieldType,
  pageData: WordPressFetchResponse,
): { value: string; hint?: string } {
  switch (fieldType) {
    case 'meta-description':
      return {
        value:
          (pageData.yoast?.description?.trim()
            ? decodeHtmlEntities(pageData.yoast.description.trim())
            : '') ||
          '(Tom — siden har ingen meta-beskrivelse)',
      };
    case 'seo-title':
      return {
        value: decodeHtmlEntities(
          pageData.yoast?.title?.trim() || pageData.page.title || '(Tom)',
        ),
      };
    case 'h1':
      return {
        value: decodeHtmlEntities(pageData.page.title || '(Tom)'),
        hint: 'Vi viser sidetittelen som referanse — H1 må sjekkes i selve innholdet',
      };
    case 'content':
    default: {
      const plain = decodeHtmlEntities(
        stripHtmlTags(pageData.page.excerpt || pageData.page.content || ''),
      );
      return { value: truncateText(plain, 300) || '(Tom innhold)' };
    }
  }
}

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
  const [contentFixCache, setContentFixCache] = useState<Record<string, ContentFixCacheEntry>>({});
  const [editedSuggestions, setEditedSuggestions] = useState<Record<string, string>>({});
  const [snippetPreviewVariant, setSnippetPreviewVariant] = useState<'desktop' | 'mobile'>('desktop');
  const [contentFixActive, setContentFixActive] = useState<ContentFixActiveState>(INITIAL_CONTENT_FIX_ACTIVE);
  const [contentFixRetry, setContentFixRetry] = useState(0);
  const contentFixAbortRef = useRef<AbortController | null>(null);
  const questionsGeneratedRef = useRef<Record<string, boolean>>({});
  const contentFixCacheRef = useRef(contentFixCache);
  contentFixCacheRef.current = contentFixCache;
  const lastSyncedAiRef = useRef<Record<string, string>>({});
  const [pushState, setPushState] = useState<
    'idle' | 'content-warning' | 'confirming' | 'pushing' | 'success' | 'error'
  >('idle');
  const [pushError, setPushError] = useState<string | null>(null);
  const [lastChangeId, setLastChangeId] = useState<string | null>(null);
  const [lastOldValue, setLastOldValue] = useState<string | null>(null);
  const [lastH1Rendered, setLastH1Rendered] = useState<boolean | null>(null);
  const [rollbackState, setRollbackState] = useState<'idle' | 'confirming' | 'rolling_back' | 'success' | 'error'>('idle');
  const [rollbackError, setRollbackError] = useState<string | null>(null);
  const [contentChanges, setContentChanges] = useState<ContentChangeRow[]>([]);
  // Verksted-filter: alle / aapne / loste
  const [workshopFilter, setWorkshopFilter] = useState<'all' | 'open' | 'done'>('all');
  const [workshopQuery, setWorkshopQuery] = useState('');
  // Hjem: vis alle todos, ikke bare topp 3
  const [showAllTodos, setShowAllTodos] = useState(false);

  // Settings-tab: hvilken seksjon som redigeres akkurat nå (kun én om gangen).
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [showWpWizard, setShowWpWizard] = useState(false);
  const [connectWizardPlatform, setConnectWizardPlatform] = useState<'wordpress' | 'wix' | null>(null);
  const [wpWizardStep, setWpWizardStep] = useState<1 | 2 | 3>(1);
  const [wixSiteUrl, setWixSiteUrl] = useState('');
  const [wixSiteUrlError, setWixSiteUrlError] = useState<string | null>(null);
  const [wixConnecting, setWixConnecting] = useState(false);
  const [wixConnectError, setWixConnectError] = useState<string | null>(null);
  const [wpSiteUrl, setWpSiteUrl] = useState('');
  const [wpUsername, setWpUsername] = useState('');
  const [wpAppPassword, setWpAppPassword] = useState('');
  const [wpSiteUrlError, setWpSiteUrlError] = useState<string | null>(null);
  const [wpConnecting, setWpConnecting] = useState(false);
  const [wpConnectError, setWpConnectError] = useState<string | null>(null);
  const [wpConnectResult, setWpConnectResult] = useState<{ site: string; wpUser: string } | null>(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const [planChangeTarget, setPlanChangeTarget] = useState<{ key: string; name: string; price: string; type: 'upgrade' | 'downgrade' } | null>(null);
  const [switchingPlan, setSwitchingPlan] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({ weeklyReport: true, criticalAlerts: true, rankChanges: false });
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState('');
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

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
  // --- GODKJENNINGS-KØ (hybrid auto-fiks: synlige felt som venter på ja) ---
  const [fixQueue, setFixQueue] = useState<any[]>([]);
  const [queueBusyId, setQueueBusyId] = useState<string | null>(null);
  // --- GEO (AI-synlighet: ukentlig sjekk om ChatGPT/Gemini/Perplexity nevner deg) ---
  const [geoSummary, setGeoSummary] = useState<any>(null);
  const [geoState, setGeoState] = useState<any>(null);      // geo_state: llms.txt + score
  const [geoFaqs, setGeoFaqs] = useState<any[]>([]);        // ventende FAQ til godkjenning
  const [geoFaqBusyId, setGeoFaqBusyId] = useState<string | null>(null);
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
  const runContentFixAi = useCallback(
    async (
      todoId: string,
      pageData: WordPressFetchResponse,
      fieldType: ContentFixFieldType,
      signal: AbortSignal,
      pageContextAnswers?: PageContextAnswers | null,
    ) => {
      const token = getStoredAccessToken();
      if (!token) {
        if (signal.aborted) return;
        setContentFixActive((prev) =>
          prev.todoId === todoId
            ? { ...prev, loading: 'error', error: 'Du må være logget inn.' }
            : prev,
        );
        return;
      }

      try {
        const aiRes = await fetch('/api/openai-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            prompt: buildContentFixAiPrompt(fieldType, pageData, pageContextAnswers),
            model: 'gpt-4o-mini',
            maxTokens: 450,
          }),
          signal,
        });
        const aiData = await aiRes.json().catch(() => ({}));
        if (signal.aborted) return;
        if (isApiRateLimited(aiRes.status, aiData)) {
          toastWarning(apiRateLimitUserMessage(aiData));
          setContentFixActive((prev) =>
            prev.todoId === todoId
              ? { ...prev, loading: 'error', error: apiRateLimitUserMessage(aiData) }
              : prev,
          );
          return;
        }
        if (!aiRes.ok) {
          setContentFixActive((prev) =>
            prev.todoId === todoId
              ? {
                  ...prev,
                  loading: 'error',
                  error:
                    typeof aiData?.error === 'string'
                      ? aiData.error
                      : `Feil ${aiRes.status}`,
                }
              : prev,
          );
          return;
        }
        const aiSuggestion = decodeHtmlEntities(String(aiData.content || '').trim());
        setContentFixCache((prev) => ({
          ...prev,
          [todoId]: {
            pageData,
            fieldType,
            aiSuggestion,
            pageContextAnswers: pageContextAnswers ?? prev[todoId]?.pageContextAnswers ?? null,
          },
        }));
        setContentFixActive((prev) =>
          prev.todoId === todoId
            ? { ...prev, loading: 'idle', error: null }
            : prev,
        );
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setContentFixActive((prev) =>
          prev.todoId === todoId
            ? { ...prev, loading: 'error', error: err?.message || 'Kunne ikke nå AI.' }
            : prev,
        );
      }
    },
    [],
  );

  const startContentFixGeneration = useCallback(
    async (
      todoId: string,
      pageUrl: string,
      pageData: WordPressFetchResponse,
      answers: PageContextAnswers | null,
      saveAnswers: boolean,
    ) => {
      if (saveAnswers && answers && user?.id) {
        await savePageContextAnswers(
          pageUrl,
          answers,
          user.id,
          hostConnection?.id ?? null,
        );
      }

      contentFixAbortRef.current?.abort();
      const ac = new AbortController();
      contentFixAbortRef.current = ac;

      setContentFixCache((prev) => ({
        ...prev,
        [todoId]: {
          ...(prev[todoId] || { pageData, fieldType: 'content', aiSuggestion: null }),
          pageData,
          fieldType: 'content',
          aiSuggestion: null,
          pageContextAnswers: answers,
        },
      }));
      delete lastSyncedAiRef.current[todoId];
      setContentFixActive((prev) =>
        prev.todoId === todoId
          ? { ...prev, loading: 'generating', error: null }
          : prev,
      );
      await runContentFixAi(todoId, pageData, 'content', ac.signal, answers);
    },
    [user?.id, hostConnection?.id, runContentFixAi],
  );

  const regenerateContentFixAi = useCallback(() => {
    const todoId = contentFixActive.todoId;
    if (!todoId) return;
    const entry = contentFixCache[todoId];
    if (!entry?.pageData || !entry.fieldType) return;
    contentFixAbortRef.current?.abort();
    const ac = new AbortController();
    contentFixAbortRef.current = ac;
    setContentFixCache((prev) => ({
      ...prev,
      [todoId]: { ...entry, aiSuggestion: null },
    }));
    delete lastSyncedAiRef.current[todoId];
    setContentFixActive((prev) =>
      prev.todoId === todoId
        ? { ...prev, loading: 'generating', error: null }
        : prev,
    );
    runContentFixAi(
      todoId,
      entry.pageData,
      entry.fieldType,
      ac.signal,
      entry.pageContextAnswers ?? null,
    );
  }, [contentFixActive.todoId, contentFixCache, runContentFixAi]);

  const activeAiSuggestion =
    contentFixActive.todoId != null
      ? contentFixCache[contentFixActive.todoId]?.aiSuggestion ?? null
      : null;

  useEffect(() => {
    const todoId = contentFixActive.todoId;
    if (!todoId || activeAiSuggestion == null) return;
    if (lastSyncedAiRef.current[todoId] === activeAiSuggestion) return;
    lastSyncedAiRef.current[todoId] = activeAiSuggestion;
    setEditedSuggestions((prev) => ({ ...prev, [todoId]: activeAiSuggestion }));
  }, [contentFixActive.todoId, activeAiSuggestion]);

  const resetContentFixPushUi = useCallback(() => {
    setPushState('idle');
    setPushError(null);
    setRollbackState('idle');
    setRollbackError(null);
    setLastChangeId(null);
    setLastOldValue(null);
    setLastH1Rendered(null);
  }, []);

  const userIdRef = useRef<string | undefined>(user?.id);
  userIdRef.current = user?.id;

  const fetchContentChanges = useCallback(async () => {
    if (!supabase || !userIdRef.current) {
      setContentChanges([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('sikt_changes')
        .select('id, page_url, field, old_value, new_value, pushed_at, client_host_id')
        .eq('status', 'active');
      if (error) {
        console.warn('[Verksted] Kunne ikke hente sikt_changes:', error.message);
        return;
      }
      const rows = Array.isArray(data) ? (data as ContentChangeRow[]) : [];
      const uniqueRows = Array.from(new Map(rows.map((row) => [row.id, row])).values());
      setContentChanges(uniqueRows);
    } catch (err: any) {
      console.warn('[Verksted] Kunne ikke hente sikt_changes:', err?.message || err);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'workshop' || !userIdRef.current) return;
    fetchContentChanges();
  }, [activeTab, fetchContentChanges]);

  useEffect(() => {
    resetContentFixPushUi();
  }, [expandedWorkshopProblem, resetContentFixPushUi]);

  useEffect(() => {
    if (pushState === 'idle') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pushState === 'pushing' || rollbackState === 'rolling_back') return;
      resetContentFixPushUi();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pushState, rollbackState, resetContentFixPushUi]);

  useEffect(() => {
    if (pushState !== 'idle') return;
    if (rollbackState !== 'confirming' && rollbackState !== 'error') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setRollbackState('idle');
      setRollbackError(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pushState, rollbackState]);

  const executeContentFixPush = useCallback(
    async (
      pageUrl: string,
      field: 'meta-description' | 'seo-title' | 'h1' | 'content',
      newValue: string,
    ) => {
      if (findPlaceholders(newValue).length > 0) return;
      setPushState('pushing');
      setPushError(null);
      const token = getStoredAccessToken();
      if (!token) {
        setPushState('error');
        setPushError('Du må være logget inn.');
        return;
      }
      try {
        const res = await fetch('/api/wordpress-push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ pageUrl, field, newValue }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPushState('error');
          setPushError(
            typeof data?.error === 'string' ? data.error : `Feil ${res.status}`,
          );
          return;
        }
        setLastChangeId(typeof data?.changeId === 'string' ? data.changeId : null);
        const prevOld =
          data?.previous && Object.prototype.hasOwnProperty.call(data.previous, 'oldValue')
            ? data.previous.oldValue
            : null;
        setLastOldValue(typeof prevOld === 'string' ? prevOld : null);
        setLastH1Rendered(
          field === 'h1' && typeof data?.h1Rendered === 'boolean' ? data.h1Rendered : null,
        );
        setPushState('success');
        fetchContentChanges();
      } catch (err: any) {
        setPushState('error');
        setPushError(err?.message || 'Kunne ikke pushe til WordPress.');
      }
    },
    [fetchContentChanges],
  );

  // --- GODKJENNINGS-KØ: hent + godkjenn/avvis synlige fikser fra cron-auto-fix ---
  const fetchFixQueue = useCallback(async () => {
    if (!user?.id) return;
    try {
      const rows = await supabaseRest<any[]>(
        `sikt_fix_queue?user_id=eq.${user.id}&status=eq.pending&order=created_at.desc&limit=20`,
      );
      setFixQueue(Array.isArray(rows) ? rows : []);
    } catch { /* stille — kø er valgfri */ }
  }, [user?.id]);

  useEffect(() => { fetchFixQueue(); }, [fetchFixQueue]);

  const fetchGeo = useCallback(async () => {
    if (!user?.id) return;
    try {
      const since = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      const rows = await supabaseRest<any[]>(
        `geo_checks?user_id=eq.${user.id}&checked_at=gte.${since}&select=provider,mentioned,checked_at&order=checked_at.desc&limit=200`,
      );
      if (!Array.isArray(rows) || rows.length === 0) { setGeoSummary(null); return; }
      const byProvider: Record<string, { total: number; mentioned: number }> = {};
      let total = 0, mentioned = 0;
      for (const r of rows) {
        total += 1;
        if (r.mentioned) mentioned += 1;
        const p = r.provider || 'ukjent';
        byProvider[p] = byProvider[p] || { total: 0, mentioned: 0 };
        byProvider[p].total += 1;
        if (r.mentioned) byProvider[p].mentioned += 1;
      }
      setGeoSummary({ total, mentioned, byProvider, lastCheckedAt: rows[0].checked_at });
    } catch { setGeoSummary(null); }

    // GEO-state (llms.txt + score) og ventende FAQ-utkast til godkjenning
    try {
      const st = await supabaseRest<any[]>(
        `geo_state?user_id=eq.${user.id}&select=geo_score,llms_published_at,schema_published_at,llms_txt&limit=1`,
      );
      setGeoState(Array.isArray(st) && st.length ? st[0] : null);
    } catch { setGeoState(null); }
    try {
      const faqs = await supabaseRest<any[]>(
        `geo_faqs?user_id=eq.${user.id}&status=eq.pending&select=id,question,answer,created_at&order=created_at.desc&limit=20`,
      );
      setGeoFaqs(Array.isArray(faqs) ? faqs : []);
    } catch { setGeoFaqs([]); }
  }, [user?.id]);

  useEffect(() => { fetchGeo(); }, [fetchGeo]);

  // Godkjenn/avvis et FAQ-utkast. Godkjente mates inn i llms.txt + FAQPage-schema
  // ved neste optimaliserings-kjøring.
  const resolveGeoFaq = useCallback(async (id: string, approve: boolean) => {
    setGeoFaqBusyId(id);
    try {
      await supabaseRest(`geo_faqs?id=eq.${id}`, {
        method: 'PATCH',
        body: { status: approve ? 'approved' : 'rejected', resolved_at: new Date().toISOString() },
        headers: { Prefer: 'return=minimal' },
      });
      setGeoFaqs((prev) => prev.filter((f) => f.id !== id));
      if (approve) toastSuccess('Godkjent — publiseres i llms.txt og FAQ-schema ved neste kjøring.');
    } catch (err: any) {
      toastError(err?.message || 'Kunne ikke lagre.');
    } finally {
      setGeoFaqBusyId(null);
    }
  }, []);

  const approveQueuedFix = useCallback(async (item: any) => {
    const token = getStoredAccessToken();
    if (!token) { toastError('Du må være logget inn.'); return; }
    setQueueBusyId(item.id);
    try {
      const res = await fetch('/api/wordpress-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pageUrl: item.page_url, field: item.field, newValue: item.suggested_value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        toastError(typeof data?.error === 'string' ? data.error : 'Kunne ikke publisere endringen.');
        return;
      }
      await supabaseRest(`sikt_fix_queue?id=eq.${item.id}`, {
        method: 'PATCH',
        body: { status: 'approved', resolved_at: new Date().toISOString() },
        headers: { Prefer: 'return=minimal' },
      });
      setFixQueue((prev) => prev.filter((q) => q.id !== item.id));
      toastSuccess('Publisert til siden din.');
    } catch (err: any) {
      toastError(err?.message || 'Noe gikk galt.');
    } finally {
      setQueueBusyId(null);
    }
  }, []);

  const rejectQueuedFix = useCallback(async (item: any) => {
    setQueueBusyId(item.id);
    try {
      await supabaseRest(`sikt_fix_queue?id=eq.${item.id}`, {
        method: 'PATCH',
        body: { status: 'rejected', resolved_at: new Date().toISOString() },
        headers: { Prefer: 'return=minimal' },
      });
      setFixQueue((prev) => prev.filter((q) => q.id !== item.id));
    } catch (err: any) {
      toastError(err?.message || 'Noe gikk galt.');
    } finally {
      setQueueBusyId(null);
    }
  }, []);

  const executeContentFixRollback = useCallback(async (
    changeIdOverride?: string,
    options?: { deferListRefetch?: boolean },
  ) => {
    setRollbackState('rolling_back');
    setRollbackError(null);
    const token = getStoredAccessToken();
    if (!token) {
      setRollbackState('error');
      setRollbackError('Du må være logget inn.');
      return;
    }
    const targetChangeId = changeIdOverride || lastChangeId;
    if (!targetChangeId) {
      setRollbackState('error');
      setRollbackError('Fant ikke endrings-ID. Lukk og prøv push på nytt.');
      return;
    }
    try {
      const res = await fetch('/api/wordpress-rollback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ changeId: targetChangeId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRollbackState('error');
        setRollbackError(
          typeof data?.error === 'string' ? data.error : `Feil ${res.status}`,
        );
        return;
      }
      setRollbackState('success');
      if (!options?.deferListRefetch) {
        fetchContentChanges();
      }
    } catch (err: any) {
      setRollbackState('error');
      setRollbackError(err?.message || 'Kunne ikke rulle tilbake endringen.');
    }
  }, [lastChangeId, fetchContentChanges]);

  useEffect(() => {
    const fetchAiSolution = async () => {
      if (!activeSolveProblem) return;
      if (expandedWorkshopProblem?.startsWith('content-')) return;

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
        if (isApiRateLimited(response.status, data)) {
          const msg = apiRateLimitUserMessage(data);
          toastWarning(msg);
          setAiSolution({
            steps: [{ title: 'Midlertidig begrensning', description: msg }],
            explanation: msg,
            codePatch: null,
          });
          return;
        }
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
  }, [activeSolveProblem, expandedWorkshopProblem]);

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
  const [activationDismissed, setActivationDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem(`sikt_activation_dismissed_${user?.id || ''}`) === '1'; } catch { return false; }
  });
  const dismissActivation = () => {
    setActivationDismissed(true);
    try { localStorage.setItem(`sikt_activation_dismissed_${user?.id || ''}`, '1'); } catch { /* ignore */ }
  };
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
      if (isApiRateLimited(res.status, data)) {
        toastWarning(apiRateLimitUserMessage(data));
        setGeoChatReply(null);
        return;
      }
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

      if (isApiRateLimited(response.status, data)) {
        toastWarning(apiRateLimitUserMessage(data));
        return;
      }

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

        if (user?.id) {
          await logSiktActionsBatch(buildContentScanLogEntries(data.pages, formData.websiteUrl));
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

  // «Merk som gjort» på forslag/varsler — oppdaterer status i sikt_actions
  // (RLS tillater update på egne rader) og speiler i UI umiddelbart.
  const markActionDone = async (actionId: string, done: boolean) => {
    const newStatus = done ? 'done' : 'open';
    setSiktActions((prev: any[]) => prev.map((a: any) =>
      a.id === actionId ? { ...a, status: newStatus, done_at: done ? new Date().toISOString() : null } : a
    ));
    try {
      const { error } = await supabase
        .from('sikt_actions')
        .update({ status: newStatus, done_at: done ? new Date().toISOString() : null })
        .eq('id', actionId);
      if (error) throw error;
      if (done) toastSuccess('Markert som gjort.');
    } catch (e: any) {
      // Rull tilbake hvis databasen avviste (f.eks. migrasjon ikke kjørt ennå)
      setSiktActions((prev: any[]) => prev.map((a: any) =>
        a.id === actionId ? { ...a, status: done ? 'open' : 'done' } : a
      ));
      toastError('Kunne ikke lagre: ' + (e?.message || 'ukjent feil'));
    }
  };

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

      if (isApiRateLimited(response.status, data)) {
        toastWarning(apiRateLimitUserMessage(data));
        return;
      }

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

        if (user?.id) {
          await logSiktActionsBatch(buildLinkScanLogEntries(formattedLinkPages, formData.websiteUrl));
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
      let rateLimitNotified = false;
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

          if (isApiRateLimited(response.status, data)) {
            if (!rateLimitNotified) {
              rateLimitNotified = true;
              toastWarning(apiRateLimitUserMessage(data));
            }
            return null;
          }

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
    const localRow = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      created_at: new Date().toISOString(),
      user_id: user.id,
      action_type: params.actionType,
      category: params.category,
      title: params.title,
      details: params.details ?? null,
      page_url: params.pageUrl ?? null,
      before_value: params.beforeValue ?? null,
      after_value: params.afterValue ?? null,
    };
    setSiktActions((prev) => dedupeSiktActions([localRow, ...prev]));
    try {
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

  const logSiktActionsBatch = async (entries: SiktLogEntry[]) => {
    for (const entry of entries) {
      await logSiktAction(entry);
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

        if (isApiRateLimited(res.status, errBody)) {
          setAnalyzeError(apiRateLimitUserMessage(errBody));
          return;
        }

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

          await logSiktActionsBatch(buildAnalysisLogEntries(mobile, formattedUrl));
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
  // Datakilde: geo_state.geo_score (nevne-rate 60% + llms.txt 20 + godkjente FAQ 20),
  // skrevet av optimaliserings-motoren. Null for ikke-Premium → utelatt fra snittet.
  const geoScore: number | null =
    hasPremium && geoState?.geo_score != null ? Number(geoState.geo_score) : null;

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

  // Webhost-status (for settings-fanen). Kun connection_mode 'full' telles som ekte tilkobling.
  const hostMode: string = hostConnection?.connectionMode || 'none';
  const hostIsFullyConnected = hostMode === 'full';
  const hostWasLightOnly = hostMode === 'light';
  const hostIsWix = hostConnection?.platform === 'wix';

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

  const resetWpWizardForm = () => {
    setConnectWizardPlatform(null);
    setWpWizardStep(1);
    setWpSiteUrl('');
    setWpUsername('');
    setWpAppPassword('');
    setWpSiteUrlError(null);
    setWpConnecting(false);
    setWpConnectError(null);
    setWpConnectResult(null);
    setWixSiteUrl('');
    setWixSiteUrlError(null);
    setWixConnecting(false);
    setWixConnectError(null);
  };

  const openHostConnectWizard = (platform?: 'wordpress' | 'wix') => {
    resetWpWizardForm();
    setConnectWizardPlatform(platform ?? null);
    setShowWpWizard(true);
  };

  const openWpWizard = () => {
    openHostConnectWizard();
  };

  const closeWpWizard = () => {
    if (wpConnecting || wixConnecting) return;
    setShowWpWizard(false);
    resetWpWizardForm();
  };

  const wpStep2Valid =
    wpSiteUrl.trim().startsWith('https://') &&
    !!wpUsername.trim() &&
    !!wpAppPassword.trim();

  const wixStepValid = wixSiteUrl.trim().startsWith('https://');

  const connectWixAdvisory = async () => {
    if (!wixStepValid) return;
    if (!user?.id || !supabase) {
      setWixConnectError('Du må være innlogget for å koble til.');
      return;
    }
    setWixConnecting(true);
    setWixConnectError(null);
    try {
      const { error } = await supabase.from('client_hosts').upsert(
        {
          user_id: user.id,
          platform: 'wix',
          connection_mode: 'advisory',
          admin_url: wixSiteUrl.trim(),
          access_token_encrypted: null,
          repo_url: null,
          notes: null,
          last_changed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
      if (error) {
        setWixConnectError(error.message || 'Kunne ikke lagre tilkoblingen.');
        return;
      }
      setHostConnection({
        platform: 'wix',
        connectionMode: 'advisory',
        repoUrl: '',
        adminUrl: wixSiteUrl.trim(),
        notes: '',
        lastChangedAt: new Date().toISOString(),
      });
      toastSuccess('Wix er koblet til. Sikt viser forslag du limer inn selv i editoren.');
      setShowWpWizard(false);
      resetWpWizardForm();
    } catch {
      setWixConnectError('Kunne ikke lagre tilkoblingen. Prøv igjen.');
    } finally {
      setWixConnecting(false);
    }
  };

  const resetDeleteAccountModal = () => {
    setDeleteAccountConfirmText('');
    setDeleteAccountError(null);
    setDeletingAccount(false);
  };

  const closeDeleteAccountModal = () => {
    if (deletingAccount) return;
    setShowDeleteAccountModal(false);
    resetDeleteAccountModal();
  };

  const confirmDeleteAccount = async () => {
    if (deleteAccountConfirmText !== 'SLETT') return;
    setDeletingAccount(true);
    setDeleteAccountError(null);
    const { error } = await supabase.rpc('delete_current_user');
    if (error) {
      setDeleteAccountError(error.message || 'Kunne ikke slette kontoen.');
      setDeletingAccount(false);
      return;
    }
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
      setShowDeleteAccountModal(false);
      resetDeleteAccountModal();
      onLogout();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message) : 'Kunne ikke logge ut etter sletting.';
      setDeleteAccountError(msg);
      setDeletingAccount(false);
    }
  };

  const disconnectWixAdvisory = async () => {
    if (!user?.id || !supabase) {
      setDisconnectError('Du må være innlogget for å koble fra.');
      return;
    }
    setIsDisconnecting(true);
    setDisconnectError(null);
    try {
      const { error } = await supabase.from('client_hosts').upsert(
        {
          user_id: user.id,
          connection_mode: 'skipped',
          platform: null,
          admin_url: null,
          access_token_encrypted: null,
          last_changed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
      if (error) {
        setDisconnectError(error.message || 'Kunne ikke frakoble.');
        return;
      }
      setHostConnection(null);
      setShowDisconnectConfirm(false);
      toastSuccess('Wix-tilkoblingen er fjernet.');
    } catch {
      setDisconnectError('Kunne ikke frakoble. Prøv igjen.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const connectWordPress = async () => {
    if (!wpStep2Valid) return;
    const accessToken = getStoredAccessToken();
    setWpWizardStep(3);
    setWpConnectError(null);
    setWpConnectResult(null);
    if (!accessToken) {
      setWpConnectError('Du må være innlogget for å koble til.');
      return;
    }
    setWpConnecting(true);
    try {
      const res = await fetch('/api/wordpress-connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          siteUrl: wpSiteUrl.trim(),
          wpUsername: wpUsername.trim(),
          appPassword: wpAppPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWpConnectError(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
        return;
      }
      setWpConnectResult({
        site: data.site || wpSiteUrl.trim(),
        wpUser: data.wpUser || wpUsername.trim(),
      });
      setHostConnection({
        platform: 'wordpress',
        connectionMode: 'full',
        repoUrl: '',
        adminUrl: data.site || wpSiteUrl.trim(),
        notes: wpUsername.trim(),
        lastChangedAt: new Date().toISOString(),
      });
    } catch {
      setWpConnectError('Kunne ikke nå Sikt-serveren. Sjekk internett og prøv igjen.');
    } finally {
      setWpConnecting(false);
    }
  };

  const disconnectWordPress = async () => {
    const accessToken = getStoredAccessToken();
    setDisconnectError(null);
    if (!accessToken) {
      setDisconnectError('Du må være innlogget for å koble fra.');
      return;
    }
    setIsDisconnecting(true);
    try {
      const res = await fetch('/api/wordpress-disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDisconnectError(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
        return;
      }
      setHostConnection((prev: any) => (prev ? { ...prev, connectionMode: 'skipped' } : null));
      setShowDisconnectConfirm(false);
      setDisconnectError(null);
      toastInfo('Frakoblet fra WordPress.');
    } catch {
      setDisconnectError('Kunne ikke nå Sikt-serveren. Sjekk internett og prøv igjen.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  useEffect(() => {
    if (!showWpWizard && !showDisconnectConfirm) return;
    const wizardBusy = wpConnecting || wixConnecting;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showDisconnectConfirm) {
        if (!isDisconnecting) {
          setShowDisconnectConfirm(false);
          setDisconnectError(null);
        }
        return;
      }
      if (showWpWizard && !wpConnecting && !wixConnecting) closeWpWizard();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showWpWizard, showDisconnectConfirm, wpConnecting, wixConnecting, isDisconnecting]);

  const toggleNotif = (key: keyof typeof notifPrefs) =>
    setNotifPrefs((prev) => ({ ...prev, [key]: !prev[key] }));

  // ===================================================================
  // TODOS — aggregert "i dag"-liste fra alle kilder, sortert etter impact.
  // Brukes paa Hjem (3 oeverst + "mer") og er kilden til Verksted-fanen.
  // ===================================================================
  type TodoKind = 'pagespeed' | 'keyword' | 'content' | 'content-page' | 'onboarding' | 'competitor' | 'geo';
  type Todo = {
    id: string;
    kind: TodoKind;
    title: string;
    desc: string;
    impact: number; // 0-100, hoyere = viktigere
    action: { label: string; onClick: () => void };
    raw?: any; // for verksted-drawer (PageSpeed-opportunity)
    pageUrl?: string;
    pageTitle?: string;
    status?: 'open' | 'solved';
    changeId?: string;
    changeData?: TodoChangeData;
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
    if (hasStandardOrHigher && !hostIsFullyConnected) {
      items.push({
        id: 'onboarding-cms',
        kind: 'onboarding',
        title: hostWasLightOnly ? 'Koble til WordPress (på nytt)' : 'Koble til WordPress',
        desc: 'Lar Sikt pushe fikser direkte til siden din med et trygt Application Password.',
        impact: 80,
        action: { label: 'Koble til', onClick: () => { setActiveTab('settings'); openWpWizard(); } },
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

    // 2b. Innhold — én todo per issue per side (maks 20 viktigste etter impact)
    const contentPageTodos: Todo[] = [];
    for (const p of contentPages) {
      if (!p.fullUrl || typeof p.fullUrl !== 'string' || !p.fullUrl.trim()) continue;
      let resolvedPageUrl: string;
      try {
        resolvedPageUrl = new URL(p.url, p.fullUrl).toString();
      } catch {
        continue;
      }
      const issueList = Array.isArray(p.issues) ? p.issues : [];
      const impactByStatus =
        p.status === 'Kritisk' ? 75 : p.status === 'Advarsel' ? 60 : 40;
      for (const issue of issueList) {
        if (!issue || typeof issue !== 'string') continue;
        contentPageTodos.push({
          id: `content-${p.url}-${issue}`,
          kind: 'content-page',
          title: issue,
          desc: `Side: ${p.url}`,
          impact: impactByStatus,
          pageUrl: resolvedPageUrl,
          pageTitle: p.title,
          action: {
            label: 'Åpne i Verksted',
            onClick: () => {
              setActiveTab('workshop');
              setExpandedWorkshopProblem(`content-${p.url}-${issue}`);
            },
          },
        });
      }
    }
    contentPageTodos.sort((a, b) => b.impact - a.impact);

    const uniqueChanges = Array.from(
      new Map(contentChanges.map((change) => [change.id, change])).values(),
    ) as ContentChangeRow[];
    const handledChangeIds = new Set<string>();
    const openContentTodos: Todo[] = [];
    const solvedContentTodos: Todo[] = [];

    for (const todo of contentPageTodos) {
      if (todo.status === 'solved') {
        if (todo.changeId) handledChangeIds.add(todo.changeId);
        solvedContentTodos.push(todo);
        continue;
      }

      const issue = todo.title.includes(' — ')
        ? todo.title.split(' — ')[0]
        : todo.title;
      const field = detectFieldType(issue);
      const match = uniqueChanges.find(
        (change) =>
          !handledChangeIds.has(change.id) &&
          change.page_url === todo.pageUrl &&
          change.field === field,
      );

      if (match) {
        handledChangeIds.add(match.id);
        solvedContentTodos.push({
          ...todo,
          status: 'solved',
          changeId: match.id,
          changeData: {
            field: match.field,
            old_value: match.old_value,
            new_value: match.new_value,
            pushed_at: match.pushed_at,
          },
        });
      } else {
        openContentTodos.push({ ...todo, status: 'open' });
      }
    }

    items.push(...openContentTodos.slice(0, 20));
    items.push(...solvedContentTodos);

    for (const change of uniqueChanges) {
      if (handledChangeIds.has(change.id)) continue;
      if (change.field !== 'meta-description' && change.field !== 'seo-title' && change.field !== 'h1' && change.field !== 'content') continue;

      handledChangeIds.add(change.id);
      const pathLabel = pathLabelFromPageUrl(change.page_url);
      items.push({
        id: `solved-${change.id}`,
        kind: 'content-page',
        status: 'solved',
        changeId: change.id,
        changeData: {
          field: change.field,
          old_value: change.old_value,
          new_value: change.new_value,
          pushed_at: change.pushed_at,
        },
        pageUrl: change.page_url,
        pageTitle: pageTitleFromPageUrl(change.page_url),
        title: solvedTitleForField(change.field),
        desc: `Side: ${pathLabel}`,
        impact: 35,
        action: {
          label: 'Åpne i Verksted',
          onClick: () => {
            setActiveTab('workshop');
            setExpandedWorkshopProblem(`solved-${change.id}`);
          },
        },
      });
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

    return Array.from(new Map(items.map((todo) => [todo.id, todo])).values())
      .sort((a, b) => b.impact - a.impact);
  }, [analysisResults, realRankings, websiteUrl, hostIsFullyConnected, hostWasLightOnly, keywordsToTrack.length, hasStandardOrHigher, isAnalyzing, contentPages, contentChanges]);

  const todayTodos = todos.slice(0, 3);
  const moreTodos = todos.slice(3);
  const todosRef = useRef(todos);
  todosRef.current = todos;
  const contentPagesRef = useRef(contentPages);
  contentPagesRef.current = contentPages;
  const hostConnectionRef = useRef(hostConnection);
  hostConnectionRef.current = hostConnection;

  const workshopContentFixFieldType = useMemo((): ContentFixFieldType | null => {
    const todoId = expandedWorkshopProblem;
    if (!todoId?.startsWith('content-')) return null;
    const todo = todosRef.current.find(
      (t) => t.id === todoId && t.kind === 'content-page',
    );
    if (!todo) return null;
    const issue = todo.title.includes(' — ')
      ? todo.title.split(' — ')[0]
      : todo.title;
    return detectFieldType(issue);
  }, [expandedWorkshopProblem]);

  useEffect(() => {
    if (rollbackState !== 'success') return;
    const todo = todosRef.current.find((t) => t.id === expandedWorkshopProblem);
    if (todo?.status !== 'solved') return;
    const timer = setTimeout(() => {
      fetchContentChanges();
      setExpandedWorkshopProblem(null);
      resetContentFixPushUi();
    }, 2000);
    return () => clearTimeout(timer);
  }, [rollbackState, expandedWorkshopProblem, resetContentFixPushUi, fetchContentChanges]);

  useEffect(() => {
    const abortInFlight = () => {
      contentFixAbortRef.current?.abort();
      contentFixAbortRef.current = null;
    };

    if (!expandedWorkshopProblem?.startsWith('content-')) {
      abortInFlight();
      return;
    }

    const todo = todosRef.current.find(
      (t) => t.id === expandedWorkshopProblem && t.kind === 'content-page',
    );
    const todoId = expandedWorkshopProblem;

    if (todo?.status === 'solved') {
      abortInFlight();
      return;
    }

    if (!todo?.pageUrl) {
      abortInFlight();
      setContentFixActive({
        todoId,
        loading: 'error',
        error: 'Mangler side-URL for dette funnet.',
      });
      return;
    }

    const cached = contentFixCacheRef.current[todoId];
    if (cached?.pageData && cached?.aiSuggestion) {
      setContentFixActive({ todoId, loading: 'idle', error: null });
      return () => abortInFlight();
    }
    if (cached?.pageData && cached?.contextQuestions && cached.contextQuestions.length > 0) {
      setContentFixActive({ todoId, loading: 'questionnaire', error: null });
      return () => abortInFlight();
    }
    if (cached?.pageData && cached?.pageContextAnswers != null) {
      return () => abortInFlight();
    }
    if (questionsGeneratedRef.current[todoId] && cached?.pageData) {
      if (cached.contextQuestions && cached.contextQuestions.length > 0) {
        setContentFixActive({ todoId, loading: 'questionnaire', error: null });
      }
      return;
    }

    const fieldType = workshopContentFixFieldType ?? detectFieldType(
      todo.title.includes(' — ') ? todo.title.split(' — ')[0] : todo.title,
    );

    abortInFlight();
    const ac = new AbortController();
    contentFixAbortRef.current = ac;

    setContentFixActive({
      todoId,
      loading: 'fetching',
      error: null,
    });

    const run = async () => {
      const token = getStoredAccessToken();
      if (!token) {
        if (ac.signal.aborted) return;
        setContentFixActive((prev) =>
          prev.todoId === todoId
            ? { ...prev, loading: 'error', error: 'Du må være logget inn.' }
            : prev,
        );
        return;
      }

      try {
        let pageData: WordPressFetchResponse;
        if (hostConnectionRef.current?.platform === 'wix') {
          const advisoryPageData = buildAdvisoryPageDataFromContentScan(
            todo.pageUrl,
            contentPagesRef.current,
          );
          if (ac.signal.aborted) return;
          if (!advisoryPageData) {
            setContentFixActive((prev) =>
              prev.todoId === todoId
                ? {
                    ...prev,
                    loading: 'error',
                    error:
                      'Kjør innholdsskanning under Synlighet først, så Sikt vet hvilken side dette gjelder.',
                  }
                : prev,
            );
            return;
          }
          pageData = advisoryPageData;
        } else {
          const fetchRes = await fetch('/api/wordpress-fetch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ pageUrl: todo.pageUrl }),
            signal: ac.signal,
          });
          const fetchData = await fetchRes.json().catch(() => ({}));
          if (ac.signal.aborted) return;
          if (!fetchRes.ok) {
            setContentFixActive((prev) =>
              prev.todoId === todoId
                ? {
                    ...prev,
                    loading: 'error',
                    error:
                      typeof fetchData?.error === 'string'
                        ? fetchData.error
                        : `Feil ${fetchRes.status}`,
                  }
                : prev,
            );
            return;
          }

          pageData = fetchData as WordPressFetchResponse;
        }
        setContentFixCache((prev) => ({
          ...prev,
          [todoId]: { pageData, fieldType, aiSuggestion: null },
        }));

        if (fieldType === 'content') {
          let savedAnswers: PageContextAnswers | null = null;
          if (supabase) {
            try {
              const { data: ctxRow, error: ctxErr } = await supabase
                .from('sikt_page_context')
                .select('answers')
                .eq('page_url', todo.pageUrl)
                .maybeSingle();
              if (ctxErr) {
                console.warn('[Verksted] Kunne ikke hente page context:', ctxErr.message);
              } else {
                savedAnswers = normalizePageContextAnswers(ctxRow?.answers);
              }
            } catch (ctxCatch: unknown) {
              console.warn('[Verksted] Kunne ikke hente page context:', ctxCatch);
            }
          }
          if (ac.signal.aborted) return;

          if (savedAnswers) {
            questionsGeneratedRef.current[todoId] = true;
            setContentFixCache((prev) => ({
              ...prev,
              [todoId]: {
                pageData,
                fieldType,
                aiSuggestion: null,
                pageContextAnswers: savedAnswers,
              },
            }));
            setContentFixActive((prev) =>
              prev.todoId === todoId ? { ...prev, loading: 'generating' } : prev,
            );
            await runContentFixAi(todoId, pageData, fieldType, ac.signal, savedAnswers);
            return;
          }

          if (questionsGeneratedRef.current[todoId]) {
            const lockedEntry = contentFixCacheRef.current[todoId];
            if (lockedEntry?.contextQuestions && lockedEntry.contextQuestions.length > 0) {
              setContentFixActive((prev) =>
                prev.todoId === todoId ? { ...prev, loading: 'questionnaire', error: null } : prev,
              );
              return;
            }
            return;
          }

          questionsGeneratedRef.current[todoId] = true;

          setContentFixActive((prev) =>
            prev.todoId === todoId ? { ...prev, loading: 'generating-questions', error: null } : prev,
          );

          let contextQuestions: ContextQuestion[];
          try {
            contextQuestions = await generateContextQuestions(pageData, ac.signal, token);
          } catch (err: unknown) {
            if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') {
              return;
            }
            contextQuestions = FALLBACK_QUESTIONS;
          }
          if (ac.signal.aborted) return;

          if (contextQuestions.length === 0) {
            setContentFixActive((prev) =>
              prev.todoId === todoId ? { ...prev, loading: 'generating' } : prev,
            );
            await runContentFixAi(todoId, pageData, fieldType, ac.signal, null);
            return;
          }

          setContentFixCache((prev) => ({
            ...prev,
            [todoId]: {
              pageData,
              fieldType,
              aiSuggestion: null,
              contextQuestions,
            },
          }));
          setContentFixActive((prev) =>
            prev.todoId === todoId ? { ...prev, loading: 'questionnaire', error: null } : prev,
          );
          return;
        }

        setContentFixActive((prev) =>
          prev.todoId === todoId ? { ...prev, loading: 'generating' } : prev,
        );
        await runContentFixAi(todoId, pageData, fieldType, ac.signal);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setContentFixActive((prev) =>
          prev.todoId === todoId
            ? { ...prev, loading: 'error', error: err?.message || 'Kunne ikke hente fra WordPress.' }
            : prev,
        );
      }
    };

    run();
    return () => abortInFlight();
  }, [expandedWorkshopProblem, workshopContentFixFieldType, contentFixRetry]);

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
  const domainLabel = websiteUrl
    .replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
  const tabFadeInClass = 'animate-in fade-in slide-in-from-bottom-2 duration-150 ease-out motion-reduce:slide-in-from-bottom-0';

  return (
    <div className={`min-h-screen ${rootBg} antialiased`}>

      {/* ===== NY: STICKY HORISONTAL TOPP-NAV ===== */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: '#F5F5F0', borderBottom: '1px solid #EBEBE6' }}>
        {/* Desktop nav */}
        <div style={{ maxWidth: 1320, margin: '0 auto', padding: '14px 32px', display: 'flex', alignItems: 'center', gap: 24 }}
             className="hidden sm:flex">

          {/* VENSTRE: logo + nettside-velger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <button
              onClick={() => setActiveTab('home')}
              style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <span style={{ width: 30, height: 30, borderRadius: 9, background: '#1A1A1A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>S</span>
              <span style={{ fontWeight: 600, fontSize: 17, color: '#1A1A1A', letterSpacing: '-0.01em' }}>Sikt</span>
            </button>
          </div>

          {/* MIDT: sentrert pill-meny */}
          <nav style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#FFFFFF', border: '1px solid #EBEBE6', borderRadius: 999, padding: 5 }}>
              {navItems.map(item => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                let badge: number | null = null;
                if (item.id === 'workshop' || item.id === 'home') {
                  const c = todos.length;
                  if (c > 0) badge = c;
                }
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 16px', borderRadius: 999, fontSize: 14,
                      fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
                      border: 'none',
                      background: active ? '#1A1A1A' : 'transparent',
                      color: active ? '#FFFFFF' : '#808080',
                      transition: 'background 160ms cubic-bezier(0.23,1,0.32,1), color 160ms cubic-bezier(0.23,1,0.32,1), transform 140ms cubic-bezier(0.23,1,0.32,1)',
                    }}
                  >
                    <Icon size={15} />
                    <span>{item.label}</span>
                    {badge !== null && (
                      <span style={{
                        minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999,
                        fontSize: 11, fontWeight: 700, display: 'inline-flex',
                        alignItems: 'center', justifyContent: 'center',
                        background: active ? 'rgba(255,255,255,0.18)' : '#EBEBE6',
                        color: active ? '#FFFFFF' : '#1A1A1A',
                      }}>{badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* HØYRE: konto + oppgrader */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {currentLevel < 3 && (
              <button
                onClick={() => handleUpgrade()}
                style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: 8, transition: 'opacity 160ms' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.65'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
              >
                Oppgrader
              </button>
            )}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserFooterMenuOpen(v => !v)}
                aria-haspopup="menu"
                aria-expanded={userFooterMenuOpen}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFFFFF', border: '1px solid #EBEBE6', borderRadius: 999, padding: '5px 10px 5px 5px', cursor: 'pointer', transition: 'background 160ms cubic-bezier(0.23,1,0.32,1)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F5F5F0'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FFFFFF'; }}
              >
                <span style={{ width: 28, height: 28, borderRadius: 999, background: '#1A1A1A', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{footerInitials}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                <ChevronsUpDown size={14} style={{ color: '#808080' }} />
              </button>
              {userFooterMenuOpen && (
                <div
                  role="menu"
                  style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', minWidth: 180, background: '#FFFFFF', border: '1px solid #EBEBE6', borderRadius: 12, padding: 6, zIndex: 50, boxShadow: '0 18px 40px -20px rgba(26,26,26,0.25)' }}
                >
                  <button
                    role="menuitem"
                    onClick={() => { setActiveTab('settings'); setUserFooterMenuOpen(false); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', fontSize: 13, fontWeight: 600, color: '#1A1A1A', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F5F5F0'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    <Settings size={15} /> Innstillinger
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { onLogout(); setUserFooterMenuOpen(false); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', fontSize: 13, fontWeight: 600, color: '#b4231f', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff0f0'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    <LogOut size={15} /> Logg ut
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MOBIL (< sm): kompakt rad + scrollbart fane-bånd */}
        <div className="sm:hidden">
          <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #EBEBE6' }}>
            <button
              onClick={() => setActiveTab('home')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <span style={{ width: 26, height: 26, borderRadius: 8, background: '#1A1A1A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>S</span>
              <span style={{ fontWeight: 600, fontSize: 15, color: '#1A1A1A' }}>Sikt</span>
            </button>
            <button
              onClick={() => setUserFooterMenuOpen(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFFFFF', border: '1px solid #EBEBE6', borderRadius: 999, padding: '4px 8px 4px 4px', cursor: 'pointer' }}
            >
              <span style={{ width: 24, height: 24, borderRadius: 999, background: '#1A1A1A', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{footerInitials}</span>
              <ChevronsUpDown size={12} style={{ color: '#808080' }} />
            </button>
            {userFooterMenuOpen && (
              <div
                role="menu"
                style={{ position: 'absolute', right: 16, top: 'calc(100% - 4px)', minWidth: 160, background: '#FFFFFF', border: '1px solid #EBEBE6', borderRadius: 12, padding: 6, zIndex: 50, boxShadow: '0 18px 40px -20px rgba(26,26,26,0.25)' }}
              >
                <button role="menuitem" onClick={() => { setActiveTab('settings'); setUserFooterMenuOpen(false); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', fontSize: 13, fontWeight: 600, color: '#1A1A1A', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                  <Settings size={15} /> Innstillinger
                </button>
                <button role="menuitem" onClick={() => { onLogout(); setUserFooterMenuOpen(false); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', fontSize: 13, fontWeight: 600, color: '#b4231f', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                  <LogOut size={15} /> Logg ut
                </button>
              </div>
            )}
          </div>
          {/* Horisontalt scrollbart fane-bånd */}
          <div style={{ overflowX: 'auto', display: 'flex', gap: 4, padding: '8px 12px', scrollbarWidth: 'none' }}>
            {navItems.map(item => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              let badge: number | null = null;
              if (item.id === 'workshop' || item.id === 'home') { const c = todos.length; if (c > 0) badge = c; }
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', border: 'none', flexShrink: 0, background: active ? '#1A1A1A' : '#F5F5F0', color: active ? '#FFFFFF' : '#808080', transition: 'background 160ms, color 160ms' }}
                >
                  <Icon size={14} />
                  <span>{item.label}</span>
                  {badge !== null && (
                    <span style={{ minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: active ? 'rgba(255,255,255,0.18)' : '#EBEBE6', color: active ? '#FFFFFF' : '#1A1A1A' }}>{badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

    <main style={{ maxWidth: 1320, margin: '0 auto', width: '100%' }}
          className="px-4 sm:px-6 lg:px-8 py-6 sm:py-10">

        {/* =============================================================== */}
        {/* HJEM — én skjerm, vertikal feed. Maks én primær handling synlig. */}
        {/* =============================================================== */}
        {activeTab === 'home' && (
          <div key={activeTab} className="space-y-6">
            <header className="flex items-end justify-between flex-wrap gap-3">
              <div>
                <h1 className={`text-3xl sm:text-4xl font-semibold tracking-tight ${textMain}`}>Dashboard</h1>
                <p className={`text-base mt-3 ${textDim}`}>Slik står det til med {domainLabel || 'nettsiden din'}.</p>
              </div>
            </header>

            {/* Godkjenningskø: synlige fikser Sikt har klargjort, venter på ditt ja */}
            {fixQueue.length > 0 && (
              <div className={`rounded-2xl border ${divider} ${isLight ? 'bg-white' : 'bg-white/[0.03]'} p-5 sm:p-6`}>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={16} className="text-violet-500 shrink-0" />
                  <h2 className={`text-lg font-bold ${textMain}`}>Venter på din godkjenning</h2>
                  <span className="ml-auto text-[11px] font-bold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">{fixQueue.length}</span>
                </div>
                <p className={`text-sm ${textDim} mb-4`}>Sikt har klargjort disse synlige endringene. Godkjenn for å publisere dem rett til siden din.</p>
                <div className="space-y-3">
                  {fixQueue.map((item) => {
                    const label = item.field === 'h1' ? 'Overskrift (H1)' : item.field === 'content' ? 'Sideinnhold' : item.field;
                    const busy = queueBusyId === item.id;
                    return (
                      <div key={item.id} className={`rounded-xl border ${divider} p-4`}>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600 bg-violet-50 px-2 py-0.5 rounded">{label}</span>
                          <span className={`text-xs ${textDim} truncate max-w-full`}>{item.page_url}</span>
                        </div>
                        <p className={`text-sm font-semibold ${textMain} mb-1`}>{item.suggested_value}</p>
                        {item.explanation && <p className={`text-xs ${textDim} mb-3 leading-relaxed`}>{item.explanation}</p>}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => approveQueuedFix(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1A1A1A] text-white text-xs font-bold ui-motion disabled:opacity-60 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-700"
                          >
                            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                            Godkjenn og publiser
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => rejectQueuedFix(item)}
                            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border ${divider} ${textDim} text-xs font-bold ui-motion disabled:opacity-60`}
                          >
                            <X size={13} /> Avvis
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className={`${tabFadeInClass} space-y-6`}>
              {!activationDismissed && (
                <ActivationChecklist
                  theme={themed}
                  websiteUrl={websiteUrl}
                  hasAnalysis={!!analysisResults}
                  isAnalyzing={isAnalyzing}
                  gscConnected={gscConnected}
                  hasStandardOrHigher={hasStandardOrHigher}
                  hostIsFullyConnected={hostIsFullyConnected}
                  hostWasLightOnly={hostWasLightOnly}
                  onAddUrl={() => { setActiveTab('settings'); setEditingSection('profile'); }}
                  onRunAnalysis={() => runRealAnalysis()}
                  onConnectGsc={() => { setActiveTab('keywords'); setShowGscPreCheck(true); }}
                  onConnectWp={() => { openWpWizard(); }}
                  onDismiss={dismissActivation}
                />
              )}
              <React.Suspense fallback={<div className="h-64" />}>
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
                  geo={geoSummary}
                  onRunAnalysis={runRealAnalysis}
                  onNavigate={setActiveTab}
                />
              </React.Suspense>
              <div className="mt-12 pb-20">
                <DashboardCompetitorWidget
                  userId={user.id}
                  theme={themed}
                  onNavigate={() => setActiveTab('competitors')}
                />
              </div>
            </div>
          </div>
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
                    {hasStandardOrHigher && !hostIsFullyConnected && (
                      <li className="flex items-center gap-3">
                        <span className={`w-1 h-1 rounded-full ${isLight ? 'bg-slate-400' : 'bg-slate-500'}`} />
                        <button onClick={() => { setActiveTab('settings'); openWpWizard(); }} className="text-violet-600 hover:text-violet-500 font-medium">Koble til WordPress for auto-fiks</button>
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
                      'content-page': { label: 'S', bg: isLight ? 'bg-sky-100' : 'bg-sky-500/15', fg: 'text-sky-700' },
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
            <div key={activeTab} className="space-y-6" style={{ color: palette.ink }}>
              <header className="flex items-end justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: palette.ink }}>Synlighet</h1>
                  <p className="text-base mt-3" style={{ color: palette.muted }}>Hvordan ser Google nettsiden din — fart, innhold og lenker.</p>
                </div>
              </header>
              <div className={`${tabFadeInClass} space-y-6`}>
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
                          <p className="text-5xl font-semibold mt-2 leading-none" style={{ color: palette.ink }}>{totalScore ?? 'Venter på score'}</p>
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
                              <React.Suspense fallback={<div className="w-full h-full" />}>
                                <LazyScoreHistoryChart scoreHistory={scoreHistory} palette={palette} />
                              </React.Suspense>
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
            </div>
          );
        })()}

        {/* =============================================================== */}
        {/* SOKEORD — egen fane.                                            */}
        {/* =============================================================== */}
        {activeTab === 'keywords' && (
          <div key={activeTab} className="space-y-6">
            <header className="flex items-end justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: '#1A1A1A' }}>Søkeord</h1>
                <p className="text-base mt-3" style={{ color: '#808080' }}>
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
            <div className={`${tabFadeInClass} space-y-6`}>

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
                    <p className="text-xs" style={{ color: '#808080' }}>Google sender søkeorddata vanligvis 1–2 uker etter tilkobling. Vi varsler deg når tallene er klare.</p>
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
                          {kwSearch
                            ? 'Ingen treff på søket — prøv et annet ord'
                            : gscConnected
                              ? 'Google sender flere søkeord fortløpende — typisk 1–2 uker etter tilkobling. Vi varsler deg når listen fylles.'
                              : 'Koble til Google Search Console, eller legg til egne søkeord nedenfor. Rangering måles ved første sjekk.'}
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
                                    {kw.change === 0 && <span className="text-[11px] ml-1" style={{ color: '#808080' }}>0,0</span>}
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
                                : selected.source === 'gsc'
                                  ? 'Oppdateres med nye GSC-data'
                                  : 'Måles ved «Sjekk rangering nå»',
                              delta: selected.change,
                              positive: (selected.change ?? 0) > 0,
                            },
                            {
                              label: 'Klikk',
                              value: selected.clicks != null
                                ? (selected.clicks as number).toLocaleString('no-NO')
                                : selected.source === 'gsc'
                                  ? 'Kommer med GSC-data (1–2 uker)'
                                  : 'Kun via Search Console',
                              delta: null,
                              positive: false,
                            },
                            {
                              label: 'Visninger',
                              value: selected.impressions != null
                                ? (selected.impressions as number).toLocaleString('no-NO')
                                : selected.source === 'gsc'
                                  ? 'Kommer med GSC-data (1–2 uker)'
                                  : 'Kun via Search Console',
                              delta: null,
                              positive: false,
                            },
                            {
                              label: 'CTR',
                              value: selected.ctr != null
                                ? `${((selected.ctr as number) * 100).toFixed(1)} %`
                                : selected.source === 'gsc'
                                  ? 'Beregnes når klikk er inne'
                                  : 'Kun via Search Console',
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
                                  {stat.delta !== 0 ? `${Math.abs(stat.delta as number).toFixed(1)}` : '0,0'}
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
                              <React.Suspense fallback={<div className="w-full h-full" />}>
                                <LazyKeywordRankChart data={chartData} />
                              </React.Suspense>
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
                                  <span className="text-xs tabular-nums text-right" style={{ color: '#808080' }}>Ikke fra GSC</span>
                                  <span className="text-xs font-semibold tabular-nums text-right" style={{ color: '#1A1A1A' }}>
                                    {selected.position != null ? `#${selected.position}` : 'Måles ved rangeringssjekk'}
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
                                return <p className="text-xs" style={{ color: '#808080' }}>Sikt jobber i bakgrunnen — første hendelser dukker opp her etter analyse eller søkeordsjekk.</p>;
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
                  <React.Suspense fallback={<div className="w-full h-full" />}>
                    <LazyPositionBucketsChart data={positionBuckets} />
                  </React.Suspense>
                </div>
              </div>
            )}
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* KONKURRENTER — KonkurrenterPage (egen komponent)              */}
        {/* =============================================================== */}
        {activeTab === 'competitors' && (
          <div key={activeTab} className="space-y-6">
            <header className="flex items-end justify-between flex-wrap gap-3">
              <div>
                <h1 className={`text-3xl sm:text-4xl font-semibold tracking-tight ${textMain}`}>Konkurrenter</h1>
                <p className={`text-base mt-3 ${textDim}`}>Følg konkurrentene dine og oppdag åpne muligheter.</p>
              </div>
            </header>
            <div className={tabFadeInClass}>
              <KonkurrenterPage
                user={user}
                theme={themed}
                hasStandardOrHigher={hasStandardOrHigher}
                hasPremium={hasPremium}
                onUpgrade={handleUpgrade}
              />
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* AI-SYNLIGHET (GEO) — alltid synlig */}
        {/* =============================================================== */}
        {activeTab === 'geo' && (
          <div key={activeTab} className="space-y-6">
            <header className="flex items-end justify-between flex-wrap gap-3">
              <div>
                <h1 className={`text-3xl sm:text-4xl font-semibold tracking-tight ${textMain}`}>AI-synlighet</h1>
                <p className={`text-base mt-3 ${textDim}`}>Hvordan nettsiden din omtales i AI-søk.</p>
              </div>
            </header>
            <div className={`${tabFadeInClass} space-y-6`}>
              {hasPremium && (geoState?.geo_score != null || geoFaqs.length > 0) && (
                <PortalCard theme={themed} className="p-5 sm:p-6">
                  {geoState?.geo_score != null && (
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <p className={`text-[11px] font-semibold uppercase tracking-wider ${textLabel}`}>GEO-score</p>
                        <div className="flex items-baseline gap-1.5 mt-1.5">
                          <span className={`text-4xl font-bold tracking-tight ${textMain}`}>{Number(geoState.geo_score)}</span>
                          <span className={`text-base ${textDim}`}>/100</span>
                        </div>
                      </div>
                      <div className={`text-[12px] ${textDim} space-y-1 text-right`}>
                        <p>{geoState.llms_published_at ? '✓ llms.txt publisert' : '— llms.txt ikke publisert ennå'}</p>
                        <p>{geoState.schema_published_at ? '✓ FAQ-schema publisert' : '— FAQ-schema ikke publisert ennå'}</p>
                      </div>
                    </div>
                  )}

                  {geoFaqs.length > 0 && (
                    <div className={geoState?.geo_score != null ? 'mt-5 pt-5 border-t ' + divider : ''}>
                      <p className={`text-[13px] font-semibold ${textMain}`}>Godkjenn FAQ-svar Sikt foreslår</p>
                      <p className={`text-[12px] ${textDim} mt-1 mb-4`}>
                        For spørsmål der AI-assistentene ikke nevnte deg. Godkjente svar publiseres i <code>llms.txt</code> og FAQ-schema, så ChatGPT, Gemini og Perplexity lettere siterer deg.
                      </p>
                      <div className="space-y-3">
                        {geoFaqs.map((f) => (
                          <div key={f.id} className={`rounded-xl border ${divider} ${subtleBg} p-4`}>
                            <p className={`text-[13px] font-semibold ${textMain}`}>{f.question}</p>
                            <p className={`text-[13px] ${textDim} mt-1.5 leading-relaxed`}>{f.answer}</p>
                            <div className="flex items-center gap-3 mt-3">
                              <button
                                type="button"
                                disabled={geoFaqBusyId === f.id}
                                onClick={() => resolveGeoFaq(f.id, true)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 text-white px-3.5 py-2 text-[12px] font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
                              >
                                <CheckCircle2 size={13} /> Godkjenn og publiser
                              </button>
                              <button
                                type="button"
                                disabled={geoFaqBusyId === f.id}
                                onClick={() => resolveGeoFaq(f.id, false)}
                                className={`text-[12px] font-semibold ${textDim} hover:${textMain} disabled:opacity-50`}
                              >
                                Avvis
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </PortalCard>
              )}
              <GeoPage onNotify={() => toastInfo('Vi sier fra når automatisk GEO-sporing åpner for betatest.')} />
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* VERKSTED — liste-view, ekspander inline for AI-løsning.         */}
        {/* =============================================================== */}
        {activeTab === 'workshop' && (() => {
          const workshopKinds: TodoKind[] = ['pagespeed', 'content-page', 'keyword'];
          const problems = todos
            .filter((t) => workshopKinds.includes(t.kind))
            .map((todo) => ({
              id: todo.id,
              kind: todo.kind,
              title: todo.title,
              desc: todo.desc,
              raw: todo.raw,
              status: todo.status ?? 'open',
              pageUrl: todo.pageUrl,
              pageTitle: todo.pageTitle,
              changeId: todo.changeId,
              changeData: todo.changeData,
            }));
          const W = {
            bg: '#F5F5F0',
            card: '#FFFFFF',
            ink: '#1A1A1A',
            green: '#52A447',
            muted: '#808080',
            border: '#EBEBE6',
          } as const;
          const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
          const pressDown = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'scale(0.97)'; };
          const pressReset = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'scale(1)'; };
          const filteredProblems =
            (workshopFilter === 'all' ? problems :
              workshopFilter === 'open' ? problems.filter((p) => p.status !== 'solved') :
              problems.filter((p) => p.status === 'solved'))
              .filter((p) => {
                const q = workshopQuery.trim().toLowerCase();
                if (!q) return true;
                return `${p.title} ${p.desc} ${p.raw?.description || ''}`.toLowerCase().includes(q);
              });
          const selectedProblem =
            problems.find((p) => p.id === expandedWorkshopProblem) ||
            filteredProblems[0] ||
            problems[0] ||
            null;
          const selectedIndex = selectedProblem ? problems.findIndex((p) => p.id === selectedProblem.id) : -1;
          const openCount = problems.filter((p) => p.status !== 'solved').length;
          const doneCount = problems.filter((p) => p.status === 'solved').length;
          const latestScore = scoreHistory[scoreHistory.length - 1];
          const analyzedLabel = latestScore?.at
            ? new Date(latestScore.at).toLocaleString('nb-NO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
            : (analysisResults ? 'Siste analyse' : 'Ikke analysert');
          const siteLabel = websiteUrl
            ? websiteUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
            : 'Ingen nettside';
          const copyTicket = () => {
            if (!selectedProblem) return;
            const text = [
              `Funn: ${selectedProblem.title}`,
              `Beskrivelse: ${selectedProblem.raw?.description || selectedProblem.desc}`,
              `Besparelse: ${selectedProblem.raw?.savings || 'Ikke oppgitt av Lighthouse'}`,
              `Kilde: Google Lighthouse / PageSpeed mobil`,
            ].join('\n');
            navigator.clipboard?.writeText(text);
            toastSuccess('Kopiert som ticket.');
          };
          const selectProblem = (p: typeof problems[number]) => {
            setExpandedWorkshopProblem(p.id);
            if (p.kind === 'content-page') {
              setActiveSolveProblem(null);
              setAiSolution(null);
              setAiIsThinking(false);
            } else {
              setActiveSolveProblem({ raw: p.raw, title: p.title });
            }
          };
          const contentFixReady =
            selectedProblem?.kind === 'content-page' &&
            contentFixActive.todoId === selectedProblem.id;
          const contentFixEntry = contentFixReady ? contentFixCache[selectedProblem.id] : undefined;
          const contentFixLoading = !contentFixReady
            ? 'fetching'
            : contentFixActive.loading === 'idle' &&
                !contentFixEntry?.pageData &&
                !contentFixActive.error
              ? 'fetching'
              : contentFixActive.loading;
          const showYoastMissingNote =
            contentFixReady &&
            contentFixEntry?.pageData &&
            contentFixEntry.pageData.yoast?.installed === false &&
            (contentFixEntry.fieldType === 'meta-description' || contentFixEntry.fieldType === 'seo-title');
          const showPushPlaceholder =
            !hostIsWix &&
            contentFixReady &&
            contentFixEntry?.pageData &&
            (contentFixEntry.fieldType === 'content' ||
              contentFixEntry.fieldType === 'h1' ||
              (contentFixEntry.pageData.yoast?.installed === true &&
                (contentFixEntry.fieldType === 'meta-description' ||
                  contentFixEntry.fieldType === 'seo-title')));
          const showWixAdvisoryActions =
            hostIsWix &&
            contentFixReady &&
            contentFixEntry?.pageData &&
            contentFixEntry.fieldType;
          const goRelative = (delta: number) => {
            if (!problems.length) return;
            const current = selectedIndex >= 0 ? selectedIndex : 0;
            const next = Math.min(problems.length - 1, Math.max(0, current + delta));
            selectProblem(problems[next]);
          };

          return (
            <div key={activeTab} className="space-y-6">
              <header className="flex items-end justify-between flex-wrap gap-3">
                <div>
                  <h1 className={`text-3xl sm:text-4xl font-semibold tracking-tight ${textMain}`}>Verksted</h1>
                  <p className={`text-base mt-3 ${textDim}`}>Prioriterte Lighthouse-funn med AI-forslag.</p>
                </div>
              </header>
              <div className={`${tabFadeInClass} space-y-6`}>
              <style>{`
                @keyframes ws-fade-up {
                  from { opacity: 0; transform: translateY(6px); }
                  to   { opacity: 1; transform: translateY(0);   }
                }
                @media (prefers-reduced-motion: reduce) {
                  @keyframes ws-fade-up {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                  }
                }
                @keyframes ws-spin {
                  to { transform: rotate(360deg); }
                }
                @media (prefers-reduced-motion: reduce) {
                  .ws-content-spin { animation: none !important; }
                }
                .ws-content-diff-grid {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 16px;
                }
                .ws-content-preview-stack {
                  display: grid;
                  grid-template-columns: 1fr;
                  gap: 12px;
                }
                @keyframes ws-snippet-fade {
                  from { opacity: 0; transform: translateY(4px); }
                  to { opacity: 1; transform: translateY(0); }
                }
                .ws-snippet-preview-enter {
                  animation: ws-snippet-fade 180ms cubic-bezier(0.23, 1, 0.32, 1) both;
                }
                @media (prefers-reduced-motion: reduce) {
                  @keyframes ws-snippet-fade {
                    from { opacity: 0; }
                    to { opacity: 1; }
                  }
                  .ws-snippet-preview-enter {
                    animation-duration: 0ms;
                  }
                }
                @media (max-width: 768px) {
                  .ws-content-diff-grid { grid-template-columns: 1fr; }
                }
              `}</style>
              <div style={{ background: 'transparent', overflow: 'hidden', minHeight: 'min(840px, calc(100dvh - 150px))', display: 'flex', flexDirection: 'column' }}>

                {/* ── TOP BAR ── */}
                <div style={{ height: 56, display: expandedWorkshopProblem === null ? 'none' : 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: `1px solid ${W.border}`, background: isLight ? 'rgba(248,250,252,0.92)' : 'rgba(15,23,42,0.92)', flexShrink: 0, gap: 16 }}>
                  {/* Left */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexShrink: 0 }}>
                    <span style={{ width: 24, height: 24, borderRadius: 7, background: W.ink, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, flexShrink: 0 }}>S</span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, color: W.ink, fontSize: 13, fontWeight: 700 }}>Verksted</p>
                      <p style={{ margin: '1px 0 0', color: W.muted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{siteLabel}</p>
                    </div>
                  </div>

                  {/* Center: search (overview) OR nav arrows (detail) */}
                  {expandedWorkshopProblem === null ? (
                    <label style={{ height: 34, maxWidth: 360, width: '100%', background: W.card, border: `1px solid ${W.border}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 9, padding: '0 12px', transition: `border-color 160ms ${EASE}`, cursor: 'text' }}
                      onFocusCapture={e => (e.currentTarget.style.borderColor = W.ink)}
                      onBlurCapture={e => (e.currentTarget.style.borderColor = W.border)}
                    >
                      <Search size={14} style={{ color: W.muted, flexShrink: 0 }} />
                      <input
                        value={workshopQuery}
                        onChange={e => setWorkshopQuery(e.target.value)}
                        placeholder="Søk i funn"
                        style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', color: W.ink, fontSize: 12 }}
                      />
                      <span style={{ color: W.muted, border: `1px solid ${W.border}`, borderRadius: 6, padding: '1px 5px', fontSize: 10, fontWeight: 700, flexShrink: 0, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>⌘K</span>
                    </label>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        disabled={selectedIndex <= 0}
                        onClick={() => goRelative(-1)}
                        onMouseDown={pressDown}
                        onMouseUp={pressReset}
                        onMouseLeave={pressReset}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${W.border}`, background: W.card, color: W.ink, borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: selectedIndex <= 0 ? 'not-allowed' : 'pointer', opacity: selectedIndex <= 0 ? 0.4 : 1, transition: `transform 160ms ${EASE}, opacity 160ms ${EASE}` }}
                      >
                        <ChevronLeft size={14} /> Forrige funn
                      </button>
                      <button
                        type="button"
                        disabled={selectedIndex >= problems.length - 1}
                        onClick={() => goRelative(1)}
                        onMouseDown={pressDown}
                        onMouseUp={pressReset}
                        onMouseLeave={pressReset}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${W.border}`, background: W.card, color: W.ink, borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: selectedIndex >= problems.length - 1 ? 'not-allowed' : 'pointer', opacity: selectedIndex >= problems.length - 1 ? 0.4 : 1, transition: `transform 160ms ${EASE}, opacity 160ms ${EASE}` }}
                      >
                        Neste funn <ChevronRight size={14} />
                      </button>
                    </div>
                  )}

                  {/* Right: status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: analysisResults ? W.green : W.border, flexShrink: 0 }} />
                    <p style={{ margin: 0, color: W.muted, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{analysisResults ? `Analysert ${analyzedLabel}` : 'Ikke analysert'}</p>
                  </div>
                </div>

                {/* ── SCROLLABLE BODY ── */}
                <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

                  {expandedWorkshopProblem === null ? (
                    /* ═══════════════════════════════════
                       SCREEN A — OVERSIKT
                       ═══════════════════════════════════ */
                    <div style={{ padding: '20px 48px 40px', display: 'flex', flexDirection: 'column', gap: 28 }}>

                      {/* Headline */}
                      <div />

                      {/* Bento grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,0.9fr)', gap: 16 }}>

                        {/* LEFT — Hovedfunn */}
                        <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 16, padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', minHeight: 220 }}>
                          {problems.length > 0 ? (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: W.green, flexShrink: 0 }} />
                                <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Hovedfunn · Høyest gevinst</span>
                              </div>
                              <h2 style={{ margin: '0 0 12px', color: W.ink, fontSize: 'clamp(26px,3.2vw,40px)', fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1.1, flex: 1 }}>
                                {problems[0].title}
                              </h2>
                              {problems[0].raw?.description && (
                                <p style={{ margin: '0 0 20px', color: W.muted, fontSize: 14, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                  {problems[0].raw.description}
                                </p>
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                                <span style={{ color: problems[0].raw?.savings ? W.green : W.muted, fontSize: 26, fontWeight: 600, fontFamily: problems[0].raw?.savings ? "ui-monospace,'SF Mono',Menlo,monospace" : 'inherit', fontVariantNumeric: 'tabular-nums' }}>
                                  {problems[0].raw?.savings ? `Sparer ${problems[0].raw.savings}` : 'Forbedring foreslått av Lighthouse'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => selectProblem(problems[0])}
                                  onMouseDown={pressDown}
                                  onMouseUp={pressReset}
                                  onMouseLeave={pressReset}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: W.ink, color: '#fff', border: 'none', borderRadius: 11, padding: '11px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}`, flexShrink: 0 }}
                                >
                                  <Sparkles size={14} /> Be AI om løsning
                                </button>
                              </div>
                            </>
                          ) : (
                            <div style={{ margin: 'auto', textAlign: 'center' }}>
                              <p style={{ margin: '0 0 8px', color: W.ink, fontSize: 16, fontWeight: 700 }}>Ingen funn enda</p>
                              <p style={{ margin: 0, color: W.muted, fontSize: 14, lineHeight: 1.6 }}>Kjør en PageSpeed-analyse under Synlighet for å fylle Verkstedet med ekte Lighthouse-funn.</p>
                            </div>
                          )}
                        </div>

                        {/* RIGHT — nested stats */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {/* 3 stat cards */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                            {[
                              { label: 'FUNN TOTALT', value: String(problems.length).padStart(2, '0'), foot: 'mobile · siste kjøring', dim: false },
                              { label: 'ÅPNE',        value: String(openCount).padStart(2, '0'),       foot: 'ikke markert løst',    dim: false },
                              { label: 'LØSTE',       value: String(doneCount).padStart(2, '0'),       foot: 'bekreftet i ny analyse', dim: doneCount === 0 },
                            ].map((s) => (
                              <div key={s.label} style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 18, padding: '18px 16px' }}>
                                <p style={{ margin: '0 0 6px', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{s.label}</p>
                                <p style={{ margin: '0 0 8px', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 44, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1, color: s.dim ? W.muted : W.ink, fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
                                <p style={{ margin: 0, color: W.muted, fontSize: 11 }}>{s.foot}</p>
                              </div>
                            ))}
                          </div>

                          {/* Sparkline + Kilde */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {/* Sparkline */}
                            {(() => {
                              const sparkRaw: number[] = scoreHistory
                                .map((s: any) => s.score ?? s.performance ?? null)
                                .filter((v: any): v is number => typeof v === 'number' && v >= 0);
                              const hasEnough = sparkRaw.length >= 2;
                              const svgW = 160, svgH = 48;
                              let linePath = '', areaPath = '', sparkDelta: number | null = null;
                              if (hasEnough) {
                                const mn = Math.min(...sparkRaw), mx = Math.max(...sparkRaw);
                                const rng = mx - mn || 1;
                                const pts = sparkRaw.map((v, i) => ({
                                  x: (i / (sparkRaw.length - 1)) * svgW,
                                  y: svgH - ((v - mn) / rng) * (svgH - 8) - 4,
                                }));
                                linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
                                areaPath = `${linePath} L${svgW},${svgH} L0,${svgH} Z`;
                                sparkDelta = Math.round(sparkRaw[sparkRaw.length - 1] - sparkRaw[0]);
                              }
                              const dateLabel = (idx: number) => {
                                const entry = scoreHistory[idx];
                                if (!entry?.at) return '';
                                return new Date(entry.at).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' }).replace(/\//g, '.');
                              };
                              return (
                                <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 16, padding: '18px 16px', display: 'flex', flexDirection: 'column' }}>
                                  <p style={{ margin: '0 0 12px', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Ytelse · Siste analyser</p>
                                  {hasEnough ? (
                                    <>
                                      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ overflow: 'visible', width: '100%', height: svgH }}>
                                        <defs>
                                          <linearGradient id="ws-spark-grad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%"   stopColor={W.green} stopOpacity="0.18" />
                                            <stop offset="100%" stopColor={W.green} stopOpacity="0" />
                                          </linearGradient>
                                        </defs>
                                        <path d={areaPath} fill="url(#ws-spark-grad)" />
                                        <path d={linePath} fill="none" stroke={W.green} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
                                      </svg>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                                        <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, color: W.muted }}>{dateLabel(0)}</span>
                                        {sparkDelta !== null && (
                                          <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, color: sparkDelta >= 0 ? W.green : '#C0392B', fontWeight: 700 }}>
                                            {sparkDelta >= 0 ? '+' : ''}{sparkDelta}
                                          </span>
                                        )}
                                        <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, color: W.muted }}>{dateLabel(scoreHistory.length - 1)}</span>
                                      </div>
                                    </>
                                  ) : (
                                    <p style={{ margin: 'auto 0', color: W.muted, fontSize: 12, lineHeight: 1.5 }}>Ikke nok historikk enda</p>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Kilde */}
                            <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 16, padding: '18px 16px' }}>
                              <p style={{ margin: '0 0 10px', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Kilde</p>
                              <p style={{ margin: '0 0 4px', color: W.ink, fontSize: 14, fontWeight: 700 }}>Google Lighthouse</p>
                              <p style={{ margin: '0 0 12px', color: W.muted, fontSize: 12, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>mobil · {analyzedLabel}</p>
                              {(analysisResults?.mobile?.lcp?.value || analysisResults?.mobile?.tbt?.value) && (
                                <div style={{ display: 'flex', gap: 16 }}>
                                  {analysisResults?.mobile?.lcp?.value && (
                                    <div>
                                      <p style={{ margin: '0 0 2px', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, color: W.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>LCP</p>
                                      <p style={{ margin: 0, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 14, fontWeight: 600, color: W.ink }}>{analysisResults.mobile.lcp.value}</p>
                                    </div>
                                  )}
                                  {analysisResults?.mobile?.tbt?.value && (
                                    <div>
                                      <p style={{ margin: '0 0 2px', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, color: W.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>TBT</p>
                                      <p style={{ margin: 0, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 14, fontWeight: 600, color: W.ink }}>{analysisResults.mobile.tbt.value}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Filter tabs + list */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex' }}>
                            {([
                              { key: 'all'  as const, label: `Alle ${problems.length}` },
                              { key: 'open' as const, label: `Åpne ${openCount}` },
                              { key: 'done' as const, label: `Løste ${doneCount}` },
                            ]).map((tab) => {
                              const active = workshopFilter === tab.key;
                              return (
                                <button
                                  key={tab.key}
                                  type="button"
                                  onClick={() => setWorkshopFilter(tab.key)}
                                  style={{ background: 'none', border: 'none', padding: '10px 16px', fontSize: 14, fontWeight: active ? 600 : 400, color: active ? W.ink : W.muted, cursor: 'pointer', position: 'relative', transition: `color 160ms ${EASE}` }}
                                >
                                  {tab.label}
                                  {active && <span style={{ position: 'absolute', bottom: 0, left: 16, right: 16, height: 2, background: W.ink, borderRadius: 2 }} />}
                                </button>
                              );
                            })}
                          </div>
                          <p style={{ margin: 0, color: W.muted, fontSize: 12 }}>Sortert etter besparelse</p>
                        </div>
                        <div style={{ height: 1, background: W.border }} />

                        {filteredProblems.length === 0 ? (
                          <div style={{ padding: '32px 0' }}>
                            <p style={{ margin: '0 0 8px', color: W.ink, fontSize: 16, fontWeight: 700 }}>
                              {problems.length === 0 ? 'Ingen aktive problemer' : 'Ingen problemer i dette filteret'}
                            </p>
                            <p style={{ margin: '0 0 16px', color: W.muted, fontSize: 14, lineHeight: 1.6 }}>
                              {problems.length === 0
                                ? 'Kjør en analyse under Synlighet → PageSpeed for å finne ting å fikse.'
                                : workshopQuery.trim()
                                  ? 'Ingen funn matcher søket. Tøm søket eller bytt filter.'
                                  : 'Bytt filter for å se andre problemer.'}
                            </p>
                            {workshopQuery.trim() && (
                              <button
                                type="button"
                                onClick={() => setWorkshopQuery('')}
                                onMouseDown={pressDown}
                                onMouseUp={pressReset}
                                onMouseLeave={pressReset}
                                style={{ background: W.ink, color: '#fff', border: 'none', borderRadius: 9, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                              >
                                Tøm søk
                              </button>
                            )}
                          </div>
                        ) : (
                          filteredProblems.map((p, listIdx) => {
                            const num = String(problems.findIndex(x => x.id === p.id) + 1).padStart(2, '0');
                            return (
                              <div
                                key={p.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => selectProblem(p)}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectProblem(p); } }}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '36px 1fr auto',
                                  alignItems: 'center',
                                  gap: 16,
                                  padding: '18px 4px',
                                  borderBottom: `1px solid ${W.border}`,
                                  cursor: 'pointer',
                                  background: 'transparent',
                                  transition: `background 120ms ${EASE}`,
                                  animation: `ws-fade-up 220ms ${EASE} both`,
                                  animationDelay: `${listIdx * 40}ms`,
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(26,26,26,0.03)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                              >
                                <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 12, color: W.muted, fontWeight: 600 }}>{num}</span>
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: W.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</p>
                                  <p style={{ margin: 0, fontSize: 12, color: p.raw?.savings ? W.green : W.muted }}>{p.desc}</p>
                                </div>
                                <p style={{ margin: 0, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 13, fontWeight: 600, color: p.raw?.savings ? W.green : 'transparent', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{p.raw?.savings || '\u00a0'}</p>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Tier teaser */}
                      {!hasStandardOrHigher && (
                        <div style={{ background: W.ink, borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(82,164,71,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Sparkles size={16} style={{ color: W.green }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 180 }}>
                            <p style={{ margin: '0 0 3px', color: '#fff', fontSize: 14, fontWeight: 700 }}>Lås opp AI-løsninger for alle funnene</p>
                            <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Inkluderer automatisk re-analyse hver natt, søkeordsposisjon og konkurrent-sporing.</p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                            <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: 600 }}>1 499 kr <span style={{ fontWeight: 400, fontSize: 11 }}>/mnd</span></p>
                            <button
                              type="button"
                              onClick={() => handleUpgrade('Standard')}
                              onMouseDown={pressDown}
                              onMouseUp={pressReset}
                              onMouseLeave={pressReset}
                              style={{ background: '#fff', color: W.ink, border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                            >
                              Oppgrader <ArrowRight size={12} style={{ display: 'inline', verticalAlign: '-2px' }} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                  ) : selectedProblem?.kind === 'content-page' && selectedProblem.status === 'solved' && selectedProblem.changeData && !hostIsWix ? (
                    /* ═══════════════════════════════════
                       SCREEN B — INNHOLD (løst via push)
                       ═══════════════════════════════════ */
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ padding: '16px 48px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${W.border}` }}>
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedWorkshopProblem(null);
                            resetContentFixPushUi();
                          }}
                          onMouseDown={pressDown}
                          onMouseUp={pressReset}
                          onMouseLeave={pressReset}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${W.border}`, background: 'transparent', color: W.ink, borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                        >
                          <ChevronLeft size={12} /> Verksted
                        </button>
                        <span style={{ color: W.border, fontSize: 14 }}>/</span>
                        <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 12, color: W.muted }}>
                          Innhold · {String(selectedIndex + 1).padStart(2, '0')} av {String(problems.length).padStart(2, '0')}
                        </span>
                      </div>

                      <div style={{ padding: '28px 48px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div>
                          <h2 style={{ margin: '0 0 10px', color: W.ink, fontSize: 'clamp(24px,3.2vw,38px)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
                            {selectedProblem.title}
                          </h2>
                          {selectedProblem.pageUrl && (
                            <p style={{ margin: 0, fontSize: 13, color: W.muted, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span>Side:</span>
                              <a
                                href={selectedProblem.pageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: W.ink, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                {selectedProblem.pageUrl}
                                <ExternalLink size={13} style={{ flexShrink: 0 }} />
                              </a>
                            </p>
                          )}
                        </div>

                        {rollbackState === 'success' ? (
                          <div style={{ background: 'rgba(82,164,71,0.08)', border: `1px solid ${W.border}`, borderRadius: 14, padding: '20px 22px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                            <CheckCircle2 size={22} style={{ color: W.green, flexShrink: 0, marginTop: 2 }} />
                            <div>
                              <p style={{ margin: '0 0 6px', color: W.ink, fontSize: 16, fontWeight: 700 }}>Rullet tilbake ✓</p>
                              <p style={{ margin: 0, color: W.muted, fontSize: 14, lineHeight: 1.55 }}>
                                Feltet er satt tilbake til den gamle verdien på WordPress.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div style={{ background: 'rgba(82,164,71,0.08)', border: `1px solid ${W.border}`, borderRadius: 14, padding: '20px 22px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                              <CheckCircle2 size={22} style={{ color: W.green, flexShrink: 0, marginTop: 2 }} />
                              <div>
                                <p style={{ margin: '0 0 6px', color: W.ink, fontSize: 16, fontWeight: 700 }}>Pushet til WordPress ✓</p>
                                <p style={{ margin: 0, color: W.muted, fontSize: 14, lineHeight: 1.55 }}>
                                  Pushet {formatPushedAt(selectedProblem.changeData.pushed_at)}
                                </p>
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                              <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 12, padding: '14px 16px' }}>
                                <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: W.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Verdi før push</p>
                                <p style={{
                                  margin: 0,
                                  color: W.ink,
                                  fontSize: 14,
                                  lineHeight: 1.55,
                                  whiteSpace: 'pre-wrap',
                                  ...(selectedProblem.changeData.field === 'content'
                                    ? { maxHeight: 240, overflowY: 'auto' as const }
                                    : {}),
                                }}>
                                  {selectedProblem.changeData.old_value && selectedProblem.changeData.old_value.trim()
                                    ? selectedProblem.changeData.old_value
                                    : '(Tom)'}
                                </p>
                              </div>
                              <div style={{ background: 'rgba(82,164,71,0.06)', border: `1px solid ${W.border}`, borderRadius: 12, padding: '14px 16px' }}>
                                <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: W.green, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sikt-AI sitt forslag</p>
                                <p style={{
                                  margin: 0,
                                  color: W.ink,
                                  fontSize: 14,
                                  lineHeight: 1.55,
                                  whiteSpace: 'pre-wrap',
                                  ...(selectedProblem.changeData.field === 'content'
                                    ? { maxHeight: 240, overflowY: 'auto' as const }
                                    : {}),
                                }}>
                                  {selectedProblem.changeData.new_value}
                                </p>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 4 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedWorkshopProblem(null);
                                  resetContentFixPushUi();
                                }}
                                onMouseDown={pressDown}
                                onMouseUp={pressReset}
                                onMouseLeave={pressReset}
                                style={{ border: `1px solid ${W.border}`, background: W.card, color: W.ink, borderRadius: 11, padding: '11px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                              >
                                Lukk
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRollbackError(null);
                                  setRollbackState('confirming');
                                }}
                                onMouseDown={pressDown}
                                onMouseUp={pressReset}
                                onMouseLeave={pressReset}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: W.ink, color: '#fff', border: 'none', borderRadius: 11, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                              >
                                Angre push
                              </button>
                            </div>
                          </>
                        )}

                        {rollbackState === 'success' && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => {
                                fetchContentChanges();
                                setExpandedWorkshopProblem(null);
                                resetContentFixPushUi();
                              }}
                              onMouseDown={pressDown}
                              onMouseUp={pressReset}
                              onMouseLeave={pressReset}
                              style={{ background: W.ink, color: '#fff', border: 'none', borderRadius: 11, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                            >
                              Lukk
                            </button>
                          </div>
                        )}

                        {rollbackState !== 'idle' && rollbackState !== 'success' && selectedProblem.changeData && (() => {
                          const solvedOldValueLabel =
                            selectedProblem.changeData.old_value && selectedProblem.changeData.old_value.trim()
                              ? `'${selectedProblem.changeData.old_value}'`
                              : '(tom)';
                          const rollbackBusy = rollbackState === 'rolling_back';
                          return (
                            <div
                              style={{
                                position: 'fixed',
                                inset: 0,
                                zIndex: 50,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 16,
                              }}
                            >
                              <button
                                type="button"
                                aria-label="Lukk"
                                onClick={() => {
                                  if (rollbackBusy) return;
                                  setRollbackState('idle');
                                  setRollbackError(null);
                                }}
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  background: 'rgba(26,26,26,0.45)',
                                  border: 'none',
                                  cursor: rollbackBusy ? 'default' : 'pointer',
                                }}
                              />
                              <div
                                style={{
                                  position: 'relative',
                                  width: '100%',
                                  maxWidth: 480,
                                  background: W.card,
                                  border: `1px solid ${W.border}`,
                                  borderRadius: 16,
                                  padding: '24px 22px',
                                  boxShadow: '0 16px 48px rgba(26,26,26,0.12)',
                                }}
                              >
                                <h3 style={{ margin: '0 0 10px', color: W.ink, fontSize: 18, fontWeight: 700 }}>
                                  Rull tilbake endringen?
                                </h3>
                                <p style={{ margin: '0 0 18px', color: W.muted, fontSize: 14, lineHeight: 1.6 }}>
                                  Vi setter feltet tilbake til den gamle verdien: {solvedOldValueLabel}
                                </p>

                                {rollbackState === 'error' && rollbackError && (
                                  <div style={{ background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                                    <p style={{ margin: 0, color: '#8B2E2E', fontSize: 13, lineHeight: 1.5 }}>{rollbackError}</p>
                                  </div>
                                )}

                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                  {rollbackBusy ? (
                                    <button
                                      type="button"
                                      disabled
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: W.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'not-allowed', opacity: 0.7 }}
                                    >
                                      <Loader2 size={14} className="ws-content-spin" style={{ animation: 'ws-spin 1s linear infinite' }} />
                                      Ruller tilbake …
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRollbackState('idle');
                                          setRollbackError(null);
                                        }}
                                        onMouseDown={pressDown}
                                        onMouseUp={pressReset}
                                        onMouseLeave={pressReset}
                                        style={{ border: `1px solid ${W.border}`, background: W.card, color: W.ink, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                                      >
                                        Avbryt
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!selectedProblem.changeId) return;
                                          executeContentFixRollback(selectedProblem.changeId, { deferListRefetch: true });
                                        }}
                                        onMouseDown={pressDown}
                                        onMouseUp={pressReset}
                                        onMouseLeave={pressReset}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: W.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                                      >
                                        Rull tilbake nå
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                  ) : selectedProblem?.kind === 'content-page' ? (
                    /* ═══════════════════════════════════
                       SCREEN B — INNHOLD (WordPress diff)
                       ═══════════════════════════════════ */
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ padding: '16px 48px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${W.border}` }}>
                        <button
                          type="button"
                          onClick={() => setExpandedWorkshopProblem(null)}
                          onMouseDown={pressDown}
                          onMouseUp={pressReset}
                          onMouseLeave={pressReset}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${W.border}`, background: 'transparent', color: W.ink, borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                        >
                          <ChevronLeft size={12} /> Verksted
                        </button>
                        <span style={{ color: W.border, fontSize: 14 }}>/</span>
                        <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 12, color: W.muted }}>
                          Innhold · {String(selectedIndex + 1).padStart(2, '0')} av {String(problems.length).padStart(2, '0')}
                        </span>
                      </div>

                      <div style={{ padding: '28px 48px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                            <span style={{ background: 'rgba(14,165,233,0.12)', color: '#0369a1', borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>Innhold</span>
                            <span style={{ border: `1px solid ${W.border}`, borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: W.ink, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: W.green, flexShrink: 0 }} /> Åpen
                            </span>
                          </div>
                          <h2 style={{ margin: '0 0 10px', color: W.ink, fontSize: 'clamp(24px,3.2vw,38px)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
                            {selectedProblem.title}
                          </h2>
                          {selectedProblem.pageUrl && (
                            <p style={{ margin: 0, fontSize: 13, color: W.muted, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span>Side:</span>
                              <a
                                href={selectedProblem.pageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: W.ink, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                {selectedProblem.pageUrl}
                                <ExternalLink size={13} style={{ flexShrink: 0 }} />
                              </a>
                            </p>
                          )}
                        </div>

                        {showYoastMissingNote && (
                          <div style={{ background: W.bg, border: `1px solid ${W.border}`, borderRadius: 12, padding: '14px 16px' }}>
                            <p style={{ margin: 0, color: W.muted, fontSize: 13, lineHeight: 1.55 }}>
                              Vi ser at Yoast SEO ikke er installert. For å pushe meta-felter må Yoast være aktivt på siden.
                            </p>
                          </div>
                        )}

                        {contentFixLoading === 'fetching' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px 0' }}>
                            <Loader2 size={20} className="ws-content-spin" style={{ color: W.green, animation: 'ws-spin 1s linear infinite', flexShrink: 0 }} />
                            <p style={{ margin: 0, color: W.ink, fontSize: 14, fontWeight: 600 }}>Henter nåværende side fra WordPress …</p>
                          </div>
                        )}

                        {contentFixLoading === 'generating-questions' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px 0' }}>
                            <Loader2 size={20} className="ws-content-spin" style={{ color: W.green, animation: 'ws-spin 1s linear infinite', flexShrink: 0 }} />
                            <p style={{ margin: 0, color: W.ink, fontSize: 14, fontWeight: 600 }}>Sikt leser siden …</p>
                          </div>
                        )}

                        {contentFixLoading === 'error' && (
                          <div style={{ background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
                            <p style={{ margin: 0, color: '#8B2E2E', fontSize: 14, lineHeight: 1.5 }}>{contentFixActive.error || 'Noe gikk galt.'}</p>
                            <button
                              type="button"
                              onClick={() => {
                                if (selectedProblem?.id) {
                                  delete questionsGeneratedRef.current[selectedProblem.id];
                                  setContentFixCache((prev) => {
                                    const next = { ...prev };
                                    delete next[selectedProblem.id];
                                    return next;
                                  });
                                }
                                setContentFixRetry((n) => n + 1);
                              }}
                              onMouseDown={pressDown}
                              onMouseUp={pressReset}
                              onMouseLeave={pressReset}
                              style={{ background: W.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                            >
                              Prøv igjen
                            </button>
                          </div>
                        )}

                        {contentFixLoading === 'questionnaire' &&
                          contentFixEntry?.pageData &&
                          contentFixEntry.fieldType === 'content' &&
                          contentFixEntry.contextQuestions &&
                          contentFixEntry.contextQuestions.length > 0 &&
                          selectedProblem.pageUrl && (
                          <ContentPageContextQuestionnaire
                            questions={contentFixEntry.contextQuestions}
                            onSubmit={(answers) => {
                              startContentFixGeneration(
                                selectedProblem.id,
                                selectedProblem.pageUrl!,
                                contentFixEntry.pageData,
                                answers,
                                true,
                              );
                            }}
                            onSkip={() => {
                              startContentFixGeneration(
                                selectedProblem.id,
                                selectedProblem.pageUrl!,
                                contentFixEntry.pageData,
                                null,
                                false,
                              );
                            }}
                          />
                        )}

                        {contentFixLoading === 'generating' && contentFixEntry?.pageData && contentFixEntry.fieldType && (() => {
                          const cur = getContentFixCurrentValue(contentFixEntry.fieldType, contentFixEntry.pageData);
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                              <ContentFixValueCard fieldType={contentFixEntry.fieldType} borderColor={W.border} />
                              <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 14, padding: '18px 20px' }}>
                                <p style={{ margin: '0 0 8px', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Nåværende</p>
                                {cur.hint && <p style={{ margin: '0 0 8px', color: W.muted, fontSize: 11, lineHeight: 1.45 }}>{cur.hint}</p>}
                                <p style={{ margin: 0, color: W.ink, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{cur.value}</p>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Loader2 size={20} className="ws-content-spin" style={{ color: W.green, animation: 'ws-spin 1s linear infinite', flexShrink: 0 }} />
                                <p style={{ margin: 0, color: W.ink, fontSize: 14, fontWeight: 600 }}>Sikt-AI lager et forslag …</p>
                              </div>
                            </div>
                          );
                        })()}

                        {contentFixLoading === 'idle' && contentFixEntry?.aiSuggestion && contentFixEntry.pageData && contentFixEntry.fieldType && (() => {
                          const cur = getContentFixCurrentValue(contentFixEntry.fieldType, contentFixEntry.pageData);
                          const todoId = selectedProblem.id;
                          const editedSuggestion =
                            editedSuggestions[todoId] ?? contentFixEntry.aiSuggestion ?? '';
                          const charCounter = getContentFixCharCounter(
                            editedSuggestion.length,
                            contentFixEntry.fieldType,
                          );
                          const placeholders = findPlaceholders(editedSuggestion);
                          const pushBlockedByPlaceholders = placeholders.length > 0;
                          return (
                            <>
                              <ContentFixValueCard fieldType={contentFixEntry.fieldType} borderColor={W.border} />
                              <ContentFixPreviewSection
                                fieldType={contentFixEntry.fieldType}
                                pageData={contentFixEntry.pageData}
                                editedSuggestion={editedSuggestion}
                                previewVariant={snippetPreviewVariant}
                                onPreviewVariantChange={setSnippetPreviewVariant}
                                borderColor={W.border}
                                green={W.green}
                                muted={W.muted}
                                ink={W.ink}
                              />
                              <div className="ws-content-diff-grid">
                                <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 14, padding: '18px 20px', minHeight: 120 }}>
                                  <p style={{ margin: '0 0 10px', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Nåværende</p>
                                  {cur.hint && <p style={{ margin: '0 0 8px', color: W.muted, fontSize: 11, lineHeight: 1.45 }}>{cur.hint}</p>}
                                  <p style={{ margin: 0, color: W.ink, fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{cur.value}</p>
                                </div>
                                <div style={{ background: 'rgba(82,164,71,0.06)', border: `1px solid ${W.border}`, borderRadius: 14, padding: '18px 20px', minHeight: 120 }}>
                                  <p style={{ margin: '0 0 10px', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.green, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Sikt foreslår</p>
                                  <textarea
                                    value={editedSuggestion}
                                    onChange={(e) => {
                                      setEditedSuggestions((prev) => ({
                                        ...prev,
                                        [todoId]: e.target.value,
                                      }));
                                    }}
                                    placeholder="Sikt-AI sitt forslag vil vises her …"
                                    rows={5}
                                    style={{
                                      width: '100%',
                                      boxSizing: 'border-box',
                                      margin: 0,
                                      padding: '10px 12px',
                                      border: `1px solid ${W.border}`,
                                      borderRadius: 10,
                                      background: '#fff',
                                      color: W.ink,
                                      fontSize: 14,
                                      lineHeight: 1.65,
                                      fontFamily: 'inherit',
                                      resize: 'vertical',
                                      minHeight: 88,
                                      outline: 'none',
                                    }}
                                    onFocus={(e) => {
                                      e.currentTarget.style.borderColor = W.green;
                                    }}
                                    onBlur={(e) => {
                                      e.currentTarget.style.borderColor = W.border;
                                    }}
                                  />
                                  <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 600, color: charCounter.color }}>
                                    {charCounter.label}
                                  </p>
                                  {charCounter.overMax && (
                                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#C42E2E', lineHeight: 1.45 }}>
                                      Lengre enn anbefalt — kan bli kuttet av i søk
                                    </p>
                                  )}
                                  {placeholders.length > 0 && (
                                    <div
                                      style={{
                                        marginTop: 8,
                                        background: 'rgba(245,158,11,0.08)',
                                        border: '1px solid rgba(245,158,11,0.35)',
                                        borderRadius: 10,
                                        padding: '10px 12px',
                                      }}
                                    >
                                      <p style={{ margin: 0, fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
                                        ⚠ Teksten inneholder plassholdere du må fylle inn før du pusher:{' '}
                                        {placeholders.join(', ')}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 4 }}>
                                <button
                                  type="button"
                                  onClick={regenerateContentFixAi}
                                  onMouseDown={pressDown}
                                  onMouseUp={pressReset}
                                  onMouseLeave={pressReset}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: `1px solid ${W.border}`, background: W.card, color: W.ink, borderRadius: 11, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                                >
                                  <RefreshCw size={14} /> Generer på nytt
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (editedSuggestion.trim()) {
                                      navigator.clipboard?.writeText(editedSuggestion);
                                      toastSuccess('Kopiert til utklippstavle');
                                    }
                                  }}
                                  onMouseDown={pressDown}
                                  onMouseUp={pressReset}
                                  onMouseLeave={pressReset}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: W.ink, color: '#fff', border: 'none', borderRadius: 11, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                                >
                                  <Copy size={14} /> Kopier forslag
                                </button>
                                {showPushPlaceholder && (
                                  <button
                                    type="button"
                                    disabled={pushBlockedByPlaceholders}
                                    title={pushBlockedByPlaceholders ? 'Fyll inn plassholderne først' : undefined}
                                    onClick={() => {
                                      if (pushBlockedByPlaceholders) return;
                                      setPushError(null);
                                      if (contentFixEntry.fieldType === 'content') {
                                        setPushState('content-warning');
                                      } else {
                                        setPushState('confirming');
                                      }
                                    }}
                                    onMouseDown={pushBlockedByPlaceholders ? undefined : pressDown}
                                    onMouseUp={pushBlockedByPlaceholders ? undefined : pressReset}
                                    onMouseLeave={pushBlockedByPlaceholders ? undefined : pressReset}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 7,
                                      border: `1px solid ${W.border}`,
                                      background: W.card,
                                      color: W.ink,
                                      borderRadius: 11,
                                      padding: '11px 16px',
                                      fontSize: 13,
                                      fontWeight: 700,
                                      cursor: pushBlockedByPlaceholders ? 'not-allowed' : 'pointer',
                                      opacity: pushBlockedByPlaceholders ? 0.5 : 1,
                                      transition: `transform 160ms ${EASE}, opacity 160ms ${EASE}`,
                                    }}
                                  >
                                    Push til WordPress
                                  </button>
                                )}
                              </div>
                              {showWixAdvisoryActions && contentFixLoading === 'idle' && contentFixEntry?.aiSuggestion && (() => {
                                const wixEditedSuggestion =
                                  editedSuggestions[selectedProblem.id] ?? contentFixEntry.aiSuggestion ?? '';
                                const wixPlaceholders = findPlaceholders(wixEditedSuggestion);
                                const wixCopyBlocked = wixPlaceholders.length > 0;
                                return (
                                  <div
                                    style={{
                                      marginTop: 4,
                                      background: 'rgba(245,158,11,0.06)',
                                      border: `1px solid ${W.border}`,
                                      borderRadius: 14,
                                      padding: '16px 18px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 12,
                                    }}
                                  >
                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: W.ink }}>
                                      Lim inn i Wix selv
                                    </p>
                                    <p style={{ margin: 0, fontSize: 13, color: W.muted, lineHeight: 1.55 }}>
                                      {getWixFieldInstruction(contentFixEntry.fieldType)}
                                    </p>
                                    <button
                                      type="button"
                                      disabled={wixCopyBlocked || !wixEditedSuggestion.trim()}
                                      title={wixCopyBlocked ? 'Fyll inn plassholderne først' : undefined}
                                      onClick={() => {
                                        if (wixCopyBlocked || !wixEditedSuggestion.trim()) return;
                                        navigator.clipboard?.writeText(wixEditedSuggestion);
                                        toastSuccess('Kopiert til utklippstavle');
                                      }}
                                      onMouseDown={wixCopyBlocked ? undefined : pressDown}
                                      onMouseUp={wixCopyBlocked ? undefined : pressReset}
                                      onMouseLeave={wixCopyBlocked ? undefined : pressReset}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 7,
                                        alignSelf: 'flex-start',
                                        background: W.ink,
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 11,
                                        padding: '11px 16px',
                                        fontSize: 13,
                                        fontWeight: 700,
                                        cursor: wixCopyBlocked ? 'not-allowed' : 'pointer',
                                        opacity: wixCopyBlocked ? 0.5 : 1,
                                        transition: `transform 160ms ${EASE}, opacity 160ms ${EASE}`,
                                      }}
                                    >
                                      <Copy size={14} /> Kopier
                                    </button>
                                  </div>
                                );
                              })()}
                            </>
                          );
                        })()}

                        {pushState !== 'idle' && showPushPlaceholder && contentFixEntry?.fieldType && contentFixEntry.pageData && (() => {
                          const cur = getContentFixCurrentValue(contentFixEntry.fieldType, contentFixEntry.pageData);
                          const pushEditedSuggestion =
                            editedSuggestions[selectedProblem.id] ?? contentFixEntry.aiSuggestion ?? '';
                          const pushPlaceholders = findPlaceholders(pushEditedSuggestion);
                          const pushBlockedByPlaceholders = pushPlaceholders.length > 0;
                          const pushTitle =
                            contentFixEntry.fieldType === 'seo-title'
                              ? 'Push SEO-tittel til WordPress?'
                              : contentFixEntry.fieldType === 'h1'
                                ? 'Push H1 til WordPress?'
                                : contentFixEntry.fieldType === 'content'
                                  ? 'Push innhold til WordPress?'
                                  : 'Push meta-beskrivelse til WordPress?';
                          const isContentField = contentFixEntry.fieldType === 'content';
                          const scrollableValueStyle: React.CSSProperties = isContentField
                            ? { maxHeight: 200, overflowY: 'auto' }
                            : {};
                          const rollbackBusy = rollbackState === 'rolling_back';
                          const pushBusy = pushState === 'pushing';
                          const overlayBusy = pushBusy || rollbackBusy;
                          const oldValueLabel =
                            lastOldValue && lastOldValue.trim()
                              ? `'${lastOldValue}'`
                              : '(tom)';
                          const popupTitle =
                            rollbackState === 'success'
                              ? 'Rullet tilbake ✓'
                              : rollbackState === 'confirming'
                                ? 'Rull tilbake endringen?'
                                : pushState === 'content-warning'
                                  ? 'Erstatt sideinnhold?'
                                  : pushState === 'success'
                                    ? 'Pushet til WordPress ✓'
                                    : pushTitle;
                          return (
                            <div
                              style={{
                                position: 'fixed',
                                inset: 0,
                                zIndex: 50,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 16,
                              }}
                            >
                              <button
                                type="button"
                                aria-label="Lukk"
                                onClick={() => {
                                  if (overlayBusy) return;
                                  resetContentFixPushUi();
                                }}
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  background: 'rgba(26,26,26,0.45)',
                                  border: 'none',
                                  cursor: overlayBusy ? 'default' : 'pointer',
                                }}
                              />
                              <div
                                style={{
                                  position: 'relative',
                                  width: '100%',
                                  maxWidth: 480,
                                  background: W.card,
                                  border: `1px solid ${W.border}`,
                                  borderRadius: 16,
                                  padding: '24px 22px',
                                  boxShadow: '0 16px 48px rgba(26,26,26,0.12)',
                                }}
                              >
                                <h3 style={{ margin: '0 0 10px', color: W.ink, fontSize: 18, fontWeight: 700 }}>
                                  {popupTitle}
                                </h3>

                                {rollbackState === 'success' ? (
                                  <p style={{ margin: 0, color: W.muted, fontSize: 14, lineHeight: 1.55 }}>
                                    Feltet er satt tilbake til den gamle verdien på WordPress.
                                  </p>
                                ) : rollbackState === 'confirming' ? (
                                  <p style={{ margin: '0 0 18px', color: W.muted, fontSize: 14, lineHeight: 1.6 }}>
                                    Vi setter feltet tilbake til den gamle verdien: {oldValueLabel}
                                  </p>
                                ) : pushState === 'content-warning' ? (
                                  <p style={{ margin: '0 0 18px', color: W.muted, fontSize: 14, lineHeight: 1.6 }}>
                                    Dette erstatter HELE tekstinnholdet på siden med den nye teksten. Bilder og spesial-formatering på siden kan gå tapt. Du kan angre når som helst i Løste-fanen.
                                  </p>
                                ) : pushState === 'success' ? (
                                  <>
                                    <p style={{ margin: '0 0 6px', color: W.muted, fontSize: 14, lineHeight: 1.55 }}>
                                      Endringen er lagret på siden din.
                                    </p>
                                    {contentFixEntry.fieldType === 'h1' && lastH1Rendered === false && (
                                      <p style={{ margin: '0 0 6px', color: W.muted, fontSize: 13, lineHeight: 1.55 }}>
                                        Vi oppdaterte sidetittelen, men temaet ditt viser den kanskje ikke som H1 på siden. Dette kan kreve en tema-endring.
                                      </p>
                                    )}
                                    <p style={{ margin: 0, color: W.muted, fontSize: 13, lineHeight: 1.55 }}>
                                      Den gamle verdien er lagret. Du kan rulle tilbake hvis du ombestemmer deg.
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p style={{ margin: '0 0 18px', color: W.muted, fontSize: 14, lineHeight: 1.6 }}>
                                      Den nye verdien skrives direkte til siden din. Den gamle verdien lagres, så du kan rulle tilbake etterpå om du ombestemmer deg.
                                    </p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
                                      <div style={{ background: W.bg, border: `1px solid ${W.border}`, borderRadius: 10, padding: '12px 14px' }}>
                                        <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: W.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Nåværende</p>
                                        <p style={{ margin: 0, color: W.ink, fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', ...scrollableValueStyle }}>{cur.value}</p>
                                      </div>
                                      <div style={{ background: 'rgba(82,164,71,0.06)', border: `1px solid ${W.border}`, borderRadius: 10, padding: '12px 14px' }}>
                                        <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: W.green, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ny</p>
                                        <p style={{ margin: 0, color: W.ink, fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', ...scrollableValueStyle }}>{pushEditedSuggestion}</p>
                                      </div>
                                    </div>
                                  </>
                                )}

                                {pushState === 'error' && pushError && (
                                  <div style={{ background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                                    <p style={{ margin: 0, color: '#8B2E2E', fontSize: 13, lineHeight: 1.5 }}>{pushError}</p>
                                  </div>
                                )}

                                {rollbackState === 'error' && rollbackError && (
                                  <div style={{ background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                                    <p style={{ margin: 0, color: '#8B2E2E', fontSize: 13, lineHeight: 1.5 }}>{rollbackError}</p>
                                  </div>
                                )}

                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: rollbackState === 'confirming' || pushState === 'success' || rollbackState === 'success' || pushState === 'content-warning' ? 18 : 0 }}>
                                  {rollbackState === 'success' ? (
                                    <button
                                      type="button"
                                      onClick={resetContentFixPushUi}
                                      onMouseDown={pressDown}
                                      onMouseUp={pressReset}
                                      onMouseLeave={pressReset}
                                      style={{ background: W.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                                    >
                                      Lukk
                                    </button>
                                  ) : rollbackState === 'confirming' ? (
                                    <>
                                      <button
                                        type="button"
                                        disabled={rollbackBusy}
                                        onClick={() => {
                                          setRollbackState('idle');
                                          setRollbackError(null);
                                        }}
                                        onMouseDown={pressDown}
                                        onMouseUp={pressReset}
                                        onMouseLeave={pressReset}
                                        style={{ border: `1px solid ${W.border}`, background: W.card, color: W.ink, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: `transform 160ms ${EASE}, opacity 160ms ${EASE}` }}
                                      >
                                        Avbryt
                                      </button>
                                      <button
                                        type="button"
                                        disabled={rollbackBusy}
                                        onClick={() => executeContentFixRollback()}
                                        onMouseDown={pressDown}
                                        onMouseUp={pressReset}
                                        onMouseLeave={pressReset}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: W.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}, opacity 160ms ${EASE}` }}
                                      >
                                        Rull tilbake nå
                                      </button>
                                    </>
                                  ) : rollbackState === 'rolling_back' ? (
                                    <button
                                      type="button"
                                      disabled
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: W.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'not-allowed', opacity: 0.7 }}
                                    >
                                      <Loader2 size={14} className="ws-content-spin" style={{ animation: 'ws-spin 1s linear infinite' }} />
                                      Ruller tilbake …
                                    </button>
                                  ) : rollbackState === 'error' ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRollbackState('idle');
                                          setRollbackError(null);
                                        }}
                                        onMouseDown={pressDown}
                                        onMouseUp={pressReset}
                                        onMouseLeave={pressReset}
                                        style={{ border: `1px solid ${W.border}`, background: W.card, color: W.ink, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                                      >
                                        Avbryt
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => executeContentFixRollback()}
                                        onMouseDown={pressDown}
                                        onMouseUp={pressReset}
                                        onMouseLeave={pressReset}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: W.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                                      >
                                        Rull tilbake nå
                                      </button>
                                    </>
                                  ) : pushState === 'content-warning' ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={resetContentFixPushUi}
                                        onMouseDown={pressDown}
                                        onMouseUp={pressReset}
                                        onMouseLeave={pressReset}
                                        style={{ border: `1px solid ${W.border}`, background: W.card, color: W.ink, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                                      >
                                        Avbryt
                                      </button>
                                      <button
                                        type="button"
                                        disabled={
                                          pushBlockedByPlaceholders ||
                                          !pushEditedSuggestion.trim() ||
                                          !selectedProblem.pageUrl
                                        }
                                        title={pushBlockedByPlaceholders ? 'Fyll inn plassholderne først' : undefined}
                                        onClick={() => {
                                          if (
                                            pushBlockedByPlaceholders ||
                                            !pushEditedSuggestion.trim() ||
                                            !selectedProblem.pageUrl
                                          ) return;
                                          executeContentFixPush(
                                            selectedProblem.pageUrl,
                                            'content',
                                            pushEditedSuggestion,
                                          );
                                        }}
                                        onMouseDown={pushBlockedByPlaceholders ? undefined : pressDown}
                                        onMouseUp={pushBlockedByPlaceholders ? undefined : pressReset}
                                        onMouseLeave={pushBlockedByPlaceholders ? undefined : pressReset}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 7,
                                          background: W.ink,
                                          color: '#fff',
                                          border: 'none',
                                          borderRadius: 10,
                                          padding: '10px 16px',
                                          fontSize: 13,
                                          fontWeight: 700,
                                          cursor: pushBlockedByPlaceholders ? 'not-allowed' : 'pointer',
                                          opacity: pushBlockedByPlaceholders ? 0.5 : 1,
                                          transition: `transform 160ms ${EASE}, opacity 160ms ${EASE}`,
                                        }}
                                      >
                                        Ja, erstatt innholdet
                                      </button>
                                    </>
                                  ) : pushState === 'success' ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={resetContentFixPushUi}
                                        onMouseDown={pressDown}
                                        onMouseUp={pressReset}
                                        onMouseLeave={pressReset}
                                        style={{ border: `1px solid ${W.border}`, background: W.card, color: W.ink, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                                      >
                                        Lukk
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRollbackError(null);
                                          setRollbackState('confirming');
                                        }}
                                        onMouseDown={pressDown}
                                        onMouseUp={pressReset}
                                        onMouseLeave={pressReset}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: W.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                                      >
                                        Angre push
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        disabled={pushBusy}
                                        onClick={resetContentFixPushUi}
                                        onMouseDown={pressDown}
                                        onMouseUp={pressReset}
                                        onMouseLeave={pressReset}
                                        style={{ border: `1px solid ${W.border}`, background: W.card, color: W.ink, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: pushBusy ? 'not-allowed' : 'pointer', opacity: pushBusy ? 0.5 : 1, transition: `transform 160ms ${EASE}, opacity 160ms ${EASE}` }}
                                      >
                                        Avbryt
                                      </button>
                                      <button
                                        type="button"
                                        disabled={
                                          pushBusy ||
                                          pushBlockedByPlaceholders ||
                                          !pushEditedSuggestion.trim() ||
                                          !selectedProblem.pageUrl
                                        }
                                        title={pushBlockedByPlaceholders ? 'Fyll inn plassholderne først' : undefined}
                                        onClick={() => {
                                          if (
                                            pushBlockedByPlaceholders ||
                                            !pushEditedSuggestion.trim() ||
                                            !selectedProblem.pageUrl ||
                                            (contentFixEntry.fieldType !== 'meta-description' &&
                                              contentFixEntry.fieldType !== 'seo-title' &&
                                              contentFixEntry.fieldType !== 'h1' &&
                                              contentFixEntry.fieldType !== 'content')
                                          ) return;
                                          executeContentFixPush(
                                            selectedProblem.pageUrl,
                                            contentFixEntry.fieldType,
                                            pushEditedSuggestion,
                                          );
                                        }}
                                        onMouseDown={pushBlockedByPlaceholders || pushBusy ? undefined : pressDown}
                                        onMouseUp={pushBlockedByPlaceholders || pushBusy ? undefined : pressReset}
                                        onMouseLeave={pushBlockedByPlaceholders || pushBusy ? undefined : pressReset}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: W.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: pushBusy || pushBlockedByPlaceholders ? 'not-allowed' : 'pointer', opacity: pushBusy ? 0.7 : pushBlockedByPlaceholders ? 0.5 : 1, transition: `transform 160ms ${EASE}, opacity 160ms ${EASE}` }}
                                      >
                                        {pushBusy ? (
                                          <>
                                            <Loader2 size={14} className="ws-content-spin" style={{ animation: 'ws-spin 1s linear infinite' }} />
                                            Pusher …
                                          </>
                                        ) : (
                                          'Push nå'
                                        )}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                  ) : selectedProblem ? (
                    /* ═══════════════════════════════════
                       SCREEN B — DETALJ (PageSpeed)
                       ═══════════════════════════════════ */
                    <div style={{ display: 'flex', flexDirection: 'column' }}>

                      {/* Breadcrumb */}
                      <div style={{ padding: '16px 48px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${W.border}` }}>
                        <button
                          type="button"
                          onClick={() => setExpandedWorkshopProblem(null)}
                          onMouseDown={pressDown}
                          onMouseUp={pressReset}
                          onMouseLeave={pressReset}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${W.border}`, background: 'transparent', color: W.ink, borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                        >
                          <ChevronLeft size={12} /> Verksted
                        </button>
                        <span style={{ color: W.border, fontSize: 14 }}>/</span>
                        <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 12, color: W.muted }}>
                          Funn {String(selectedIndex + 1).padStart(2, '0')} av {String(problems.length).padStart(2, '0')}
                          {selectedProblem.raw?.id ? ` · ${selectedProblem.raw.id}` : ''}
                        </span>
                      </div>

                      {/* Two-column main */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,0.7fr)', gap: 32, padding: '32px 48px', alignItems: 'start' }}>

                        {/* Left: title + meta */}
                        <div>
                          {/* Tag pills */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                            <span style={{ background: W.ink, color: '#fff', borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>PageSpeed</span>
                            <span style={{ border: `1px solid ${W.border}`, borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: W.ink, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: W.green, flexShrink: 0 }} /> Åpen
                            </span>
                            <span style={{ border: `1px solid ${W.border}`, borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 500, color: W.muted, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>Google Lighthouse · mobil</span>
                          </div>

                          {/* Title */}
                          <h2 style={{ margin: '0 0 16px', color: W.ink, fontSize: 'clamp(30px,4vw,50px)', fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.05 }}>
                            {selectedProblem.title}
                          </h2>

                          {/* Description */}
                          <p style={{ margin: '0 0 28px', color: W.muted, fontSize: 16, lineHeight: 1.65, maxWidth: '52ch' }}>
                            {selectedProblem.raw?.description || 'Lighthouse foreslår en forbedring for mobilversjonen av nettsiden.'}
                          </p>

                          {/* Savings */}
                          <div>
                            <p style={{ margin: '0 0 4px', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.muted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Lighthouse anslår</p>
                            <p style={{ margin: 0, fontSize: 36, fontWeight: 600, color: selectedProblem.raw?.savings ? W.green : W.muted, fontFamily: selectedProblem.raw?.savings ? "ui-monospace,'SF Mono',Menlo,monospace" : 'inherit', fontVariantNumeric: 'tabular-nums' }}>
                              {selectedProblem.raw?.savings ? `Sparer ${selectedProblem.raw.savings}` : 'Forbedring foreslått'}
                            </p>
                          </div>
                        </div>

                        {/* Right: 2×2 meta cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          {[
                            { label: 'KATEGORI',   value: 'Performance',                                                                  color: W.ink,                                                dot: false, mono: false },
                            { label: 'STATUS',     value: 'Åpen',                                                                         color: W.green,                                              dot: true,  mono: false },
                            { label: 'KILDE',      value: 'Lighthouse · mobil',                                                           color: W.ink,                                                dot: false, mono: true  },
                            { label: 'BESPARELSE', value: selectedProblem.raw?.savings || 'Ikke oppgitt', color: selectedProblem.raw?.savings ? W.green : W.muted, dot: false, mono: !!selectedProblem.raw?.savings },
                          ].map((card) => (
                            <div key={card.label} style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 16, padding: '18px 16px' }}>
                              <p style={{ margin: '0 0 8px', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{card.label}</p>
                              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: card.color as string, fontFamily: card.mono ? "ui-monospace,'SF Mono',Menlo,monospace" : 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {card.dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: W.green, flexShrink: 0 }} />}
                                {card.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Divider */}
                      <div style={{ height: 1, background: W.border, margin: '0 48px' }} />

                      {/* AI solution section */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 32, padding: '32px 48px', alignItems: 'start' }}>

                        {/* Left: explanation + steps */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: W.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Sparkles size={13} style={{ color: W.green }} />
                              </div>
                              <div>
                                <p style={{ margin: 0, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 11, fontWeight: 700, color: W.ink, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Sikt-AI · Løsning</p>
                                <p style={{ margin: '2px 0 0', color: W.muted, fontSize: 11 }}>Forklaring og nummererte steg</p>
                              </div>
                            </div>
                            <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.muted, background: W.bg, border: `1px solid ${W.border}`, borderRadius: 6, padding: '3px 7px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                              {aiIsThinking ? 'Jobber' : aiSolution ? 'Svar' : 'Klar'}
                            </span>
                          </div>

                          {aiIsThinking ? (
                            <div style={{ padding: '32px 0', textAlign: 'center' }}>
                              <Loader2 size={22} style={{ color: W.green, margin: '0 auto 12px', animation: 'spin 1s linear infinite', display: 'block' }} />
                              <p style={{ margin: '0 0 4px', color: W.ink, fontSize: 14, fontWeight: 700 }}>Sikt-AI jobber</p>
                              <p style={{ margin: 0, color: W.muted, fontSize: 12 }}>Normalt tar AI-svar 5–15 sekunder.</p>
                            </div>
                          ) : aiSolution ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                              {aiSolution.usedHtmlContext && (
                                <span style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 6, background: 'rgba(82,164,71,0.08)', border: `1px solid ${W.green}`, color: W.green, borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 700 }}>
                                  <Check size={12} /> Hentet fra din faktiske side
                                </span>
                              )}
                              {aiSolution.qualityNote && (
                                <div style={{ display: 'flex', gap: 8, background: 'rgba(186,117,23,0.07)', border: '1px solid rgba(186,117,23,0.35)', borderRadius: 10, padding: '10px 12px' }}>
                                  <AlertTriangle size={14} style={{ color: '#BA7517', flexShrink: 0, marginTop: 1 }} />
                                  <p style={{ margin: 0, fontSize: 12, color: '#854F0B', lineHeight: 1.5 }}>{aiSolution.qualityNote}</p>
                                </div>
                              )}
                              {aiSolution.replacementExplanation && (
                                <div>
                                  <p style={{ margin: '0 0 6px', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Forklaring</p>
                                  <p style={{ margin: 0, color: W.muted, fontSize: 14, lineHeight: 1.6 }}>{aiSolution.replacementExplanation}</p>
                                </div>
                              )}
                              {aiSolution.fileHint && (
                                <span style={{ display: 'inline-flex', alignSelf: 'flex-start', border: `1px solid ${W.border}`, borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: W.muted, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>
                                  HVOR {aiSolution.fileHint}
                                </span>
                              )}
                              {Array.isArray(aiSolution.steps) && aiSolution.steps.length > 0 && (
                                <div>
                                  <p style={{ margin: '0 0 12px', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Steg</p>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {aiSolution.steps.map((step: any, i: number) => (
                                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: 12, padding: '14px 0', borderTop: `1px solid ${W.border}` }}>
                                        <span style={{ width: 24, height: 24, borderRadius: 7, background: W.bg, border: `1px solid ${W.border}`, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 11, fontWeight: 700, color: W.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                          {String(i + 1).padStart(2, '0')}
                                        </span>
                                        <div>
                                          <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 600, color: W.ink }}>{step.title || `Steg ${i + 1}`}</p>
                                          {step.description && <p style={{ margin: 0, fontSize: 12, color: W.muted, lineHeight: 1.55 }}>{step.description}</p>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ border: `1.5px dashed ${W.border}`, borderRadius: 14, padding: '24px 20px', textAlign: 'center' }}>
                              <p style={{ margin: '0 0 6px', color: W.ink, fontSize: 14, fontWeight: 700 }}>Ingen løsning generert enda</p>
                              <p style={{ margin: '0 0 16px', color: W.muted, fontSize: 13, lineHeight: 1.6 }}>Be AI om en forklaring og nummererte steg for dette funnet.</p>
                              <button
                                type="button"
                                onClick={() => selectProblem(selectedProblem)}
                                onMouseDown={pressDown}
                                onMouseUp={pressReset}
                                onMouseLeave={pressReset}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: W.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                              >
                                <Sparkles size={13} /> Be AI om løsning
                              </button>
                              <p style={{ margin: '12px 0 0', color: W.muted, fontSize: 11 }}>Normalt tar AI-svar 5–15 sekunder.</p>
                            </div>
                          )}
                        </div>

                        {/* Right: code panels */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {(() => {
                            const serp = extractSerpPreview(aiSolution, formData.websiteUrl || clientData?.websiteUrl || '');
                            if (!serp) return null;
                            return (
                              <div style={{ background: '#fff', border: `1px solid ${W.border}`, borderRadius: 14, overflow: 'hidden' }}>
                                <div style={{ padding: '10px 14px', borderBottom: `1px solid ${W.border}`, display: 'flex', alignItems: 'center', gap: 7 }}>
                                  <SearchIcon size={12} style={{ color: W.muted }} />
                                  <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Slik ser du ut på Google</span>
                                </div>
                                <div style={{ padding: '14px 16px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#F0F0EB', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: W.muted }}>
                                      {(serp.host || 's')[0].toUpperCase()}
                                    </span>
                                    <span style={{ fontSize: 12, color: '#202124' }}>{serp.host || 'dinside.no'}</span>
                                  </div>
                                  <p style={{ margin: '0 0 3px', color: '#1a0dab', fontSize: 17, lineHeight: 1.3, fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {serp.title || 'Sidetittelen din'}
                                  </p>
                                  <p style={{ margin: 0, color: '#4d5156', fontSize: 13, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {serp.description || 'Beskrivelsen din vises her under den blå lenken.'}
                                  </p>
                                </div>
                              </div>
                            );
                          })()}
                          {aiSolution?.originalCode && (
                            <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 14, overflow: 'hidden' }}>
                              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${W.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: aiSolution.originalCodeVerified ? W.green : W.muted }} />
                                  <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                    {aiSolution.originalCodeVerified ? 'Gammel kode · funnet på siden din' : 'Gammel kode'}
                                  </span>
                                </div>
                                {aiSolution.fileHint && <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, color: W.muted }}>{aiSolution.fileHint}</span>}
                              </div>
                              <div style={{ background: W.ink, padding: '14px 16px', overflowX: 'auto' }}>
                                <pre style={{ margin: 0, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 12, lineHeight: 1.6, color: 'rgba(245,245,240,0.65)', whiteSpace: 'pre-wrap' }}><code>{String(aiSolution.originalCode)}</code></pre>
                              </div>
                              <div style={{ padding: '8px 14px' }}>
                                <button type="button" onClick={() => { navigator.clipboard?.writeText(String(aiSolution.originalCode)); toastSuccess('Kopiert.'); }} style={{ background: 'none', border: 'none', color: W.green, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <Copy size={12} /> Kopier
                                </button>
                              </div>
                            </div>
                          )}
                          {aiSolution?.codePatch && (
                            <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 14, overflow: 'hidden' }}>
                              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${W.border}`, display: 'flex', alignItems: 'center', gap: 7 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: W.green }} />
                                <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 700, color: W.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Foreslått patch</span>
                              </div>
                              <div style={{ background: 'rgba(82,164,71,0.06)', padding: '14px 16px', overflowX: 'auto' }}>
                                <pre style={{ margin: 0, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 12, lineHeight: 1.6, color: W.green, whiteSpace: 'pre-wrap' }}><code>{typeof aiSolution.codePatch === 'string' ? aiSolution.codePatch : JSON.stringify(aiSolution.codePatch, null, 2)}</code></pre>
                              </div>
                              <div style={{ padding: '8px 14px' }}>
                                <button type="button" onClick={() => { navigator.clipboard?.writeText(typeof aiSolution.codePatch === 'string' ? aiSolution.codePatch : JSON.stringify(aiSolution.codePatch)); toastSuccess('Kopiert.'); }} style={{ background: 'none', border: 'none', color: W.green, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <Copy size={12} /> Kopier
                                </button>
                              </div>
                            </div>
                          )}
                          {!aiSolution && !aiIsThinking && (
                            <div style={{ background: W.bg, border: `1px solid ${W.border}`, borderRadius: 14, padding: '20px 16px', textAlign: 'center' }}>
                              <p style={{ margin: 0, color: W.muted, fontSize: 13, lineHeight: 1.5 }}>Kodepaneler vises her etter at AI har svart.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Divider */}
                      <div style={{ height: 1, background: W.border, margin: '0 48px' }} />

                      {/* Action row */}
                      <div style={{ padding: '22px 48px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => toastSuccess('Markert som løst (lagres ikke i denne versjonen).')}
                          onMouseDown={pressDown}
                          onMouseUp={pressReset}
                          onMouseLeave={pressReset}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: W.ink, color: '#fff', border: 'none', borderRadius: 11, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          Marker som løst
                        </button>
                        <button
                          type="button"
                          onClick={copyTicket}
                          onMouseDown={pressDown}
                          onMouseUp={pressReset}
                          onMouseLeave={pressReset}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: `1px solid ${W.border}`, background: 'transparent', color: W.ink, borderRadius: 11, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                        >
                          <Copy size={13} /> Kopier som ticket
                        </button>
                        <button
                          type="button"
                          onClick={() => selectProblem(selectedProblem)}
                          onMouseDown={pressDown}
                          onMouseUp={pressReset}
                          onMouseLeave={pressReset}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', background: 'transparent', color: W.muted, borderRadius: 11, padding: '11px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                        >
                          Be om annen vinkling
                        </button>
                        <p style={{ margin: '0 0 0 auto', color: W.muted, fontSize: 12 }}>Normalt tar AI-svar 5–15 sekunder</p>
                      </div>

                      {/* Tier teaser */}
                      {!hasStandardOrHigher && (
                        <div style={{ margin: '0 48px 32px', background: W.ink, borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(82,164,71,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Sparkles size={16} style={{ color: W.green }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 180 }}>
                            <p style={{ margin: '0 0 3px', color: '#fff', fontSize: 14, fontWeight: 700 }}>Få AI-løsninger for alle funnene</p>
                            <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Inkluderer automatisk re-analyse hver natt, søkeordsposisjon og konkurrent-sporing.</p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                            <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: 600 }}>1 499 kr <span style={{ fontWeight: 400, fontSize: 11 }}>/mnd</span></p>
                            <button
                              type="button"
                              onClick={() => handleUpgrade('Standard')}
                              onMouseDown={pressDown}
                              onMouseUp={pressReset}
                              onMouseLeave={pressReset}
                              style={{ background: '#fff', color: W.ink, border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                            >
                              Oppgrader <ArrowRight size={12} style={{ display: 'inline', verticalAlign: '-2px' }} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                  ) : (
                    <div style={{ padding: '64px 48px', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 8px', color: W.ink, fontSize: 18, fontWeight: 700 }}>Funn ikke funnet</p>
                      <button type="button" onClick={() => setExpandedWorkshopProblem(null)} style={{ marginTop: 12, background: W.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>← Tilbake</button>
                    </div>
                  )}

                </div>
              </div>
              </div>
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

          const L = {
            bg:     '#F5F5F0',
            card:   '#FFFFFF',
            ink:    '#1A1A1A',
            green:  '#52A447',
            muted:  '#808080',
            border: '#EBEBE6',
          } as const;
          const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
          const catColor = (c: string) =>
            c === 'fix' ? L.green : c === 'alert' ? L.muted : L.ink;
          const pressD = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'scale(0.97)'; };
          const pressU = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'scale(1)'; };
          const MONO = "ui-monospace,'SF Mono',Menlo,monospace";

          // ── AVLEDNINGER ──────────────────────────────────────────────────
          const siteLabel = websiteUrl
            ? websiteUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
            : '';
          const companyLabel = (clientData as any)?.companyName || siteLabel || 'Din bedrift';
          const initials = (() => {
            const parts = companyLabel.trim().split(/\s+/).filter(Boolean);
            if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            return companyLabel.slice(0, 2).toUpperCase() || '??';
          })();
          const currentPkgName = (clientData as any)?.package_name || 'Basic';

          // perDay: group filtered by calendar day, sorted ascending
          const perDay: { dateKey: string; label: string; weekdayLong: string; actions: typeof filtered }[] = [];
          filtered.forEach((a) => {
            const d = new Date(a.created_at);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            let group = perDay.find(g => g.dateKey === key);
            if (!group) {
              group = {
                dateKey: key,
                label: d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }),
                weekdayLong: d.toLocaleDateString('nb-NO', { weekday: 'long' }),
                actions: [],
              };
              perDay.push(group);
            }
            group.actions.push(a);
          });
          perDay.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
          perDay.forEach(g => g.actions.sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          ));

          // weekdayCounts: mon(0)…sun(6) counts from inWeek
          const weekdayCounts: number[] = Array(7).fill(0);
          inWeek.forEach((a) => {
            const d = new Date(a.created_at).getDay(); // 0=sun
            const idx = d === 0 ? 6 : d - 1; // mon=0…sun=6
            weekdayCounts[idx]++;
          });
          const maxWDCount = Math.max(...weekdayCounts, 1);
          const todayWDIdx = (() => {
            if (weekOffset !== 0) return -1;
            const d = new Date().getDay();
            return d === 0 ? 6 : d - 1;
          })();

          // periodEndLabel: viewedEnd minus 1 min
          const periodEndDate = new Date(viewedEnd.getTime() - 60000);
          const periodEndLabel = periodEndDate.toLocaleDateString('nb-NO', {
            weekday: 'short', day: 'numeric', month: 'short',
          }).replace('.', '') + ' · ' + periodEndDate.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });

          return (
            <div key={activeTab} className="space-y-6">
              <header className="flex items-end justify-between flex-wrap gap-3">
                <div>
                  <h1 className={`text-3xl sm:text-4xl font-semibold tracking-tight ${textMain}`}>Sikt-loggen</h1>
                  <p className={`text-base mt-3 ${textDim}`}>Historikk over funn, forslag, fikser og varsler.</p>
                </div>
              </header>
              <div className={`${tabFadeInClass} space-y-6`}>
              <style>{`
                @keyframes log-card-in {
                  from { opacity: 0; transform: translateY(6px); }
                  to   { opacity: 1; transform: translateY(0); }
                }
                @media (prefers-reduced-motion: reduce) {
                  @keyframes log-card-in {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                  }
                }
              `}</style>

              {/* ── TWO-COLUMN WRAPPER ── */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,300px) 1fr',
                gap: 0,
                alignItems: 'start',
                background: 'transparent',
              }}>

                {/* ══════════════════════════════════
                    LEFT SIDEBAR
                    ══════════════════════════════════ */}
                <aside style={{
                  borderRight: `1px solid ${L.border}`,
                  padding: '28px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  position: 'sticky',
                  top: 24,
                  alignSelf: 'start',
                }}>

                  {/* Firmakort */}
                  <div style={{ background: L.card, border: `1px solid ${L.border}`, borderRadius: 16, padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: L.ink, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: L.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{companyLabel}</p>
                      {siteLabel && (
                        <p style={{ margin: '2px 0 0', fontFamily: MONO, fontSize: 11, color: L.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{siteLabel}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('settings')}
                      onMouseDown={pressD}
                      onMouseUp={pressU}
                      onMouseLeave={pressU}
                      style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: L.muted, display: 'flex', alignItems: 'center', transition: `transform 160ms ${EASE}`, flexShrink: 0 }}
                      aria-label="Innstillinger"
                    >
                      <Settings size={14} />
                    </button>
                  </div>

                  {/* Ukekalender-kort */}
                  <div style={{ background: L.card, border: `1px solid ${L.border}`, borderRadius: 16, padding: '14px 14px 12px' }}>
                    {/* Nav row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <button
                        type="button"
                        onClick={() => setWeekOffset((o) => o - 1)}
                        onMouseDown={pressD}
                        onMouseUp={pressU}
                        onMouseLeave={pressU}
                        style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: L.ink, display: 'flex', alignItems: 'center', transition: `transform 160ms ${EASE}` }}
                        aria-label="Forrige uke"
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: L.ink }}>Uke {getWeekNumber(viewedStart)}</p>
                        <p style={{ margin: '1px 0 0', fontFamily: MONO, fontSize: 10, color: L.muted }}>
                          {viewedStart.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}–{new Date(viewedEnd.getTime() - 86400000).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })} · {viewedStart.getFullYear()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setWeekOffset((o) => Math.min(0, o + 1))}
                        disabled={weekOffset >= 0}
                        onMouseDown={pressD}
                        onMouseUp={pressU}
                        onMouseLeave={pressU}
                        style={{ background: 'none', border: 'none', padding: 4, cursor: weekOffset >= 0 ? 'not-allowed' : 'pointer', color: weekOffset >= 0 ? L.border : L.ink, opacity: weekOffset >= 0 ? 0.35 : 1, display: 'flex', alignItems: 'center', transition: `transform 160ms ${EASE}, opacity 160ms ${EASE}` }}
                        aria-label="Neste uke"
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>

                    {/* Mini søylerad: M T O T F L S */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                      {(['M','T','O','T','F','L','S'] as const).map((letter, i) => {
                        const count = weekdayCounts[i];
                        const isToday = i === todayWDIdx;
                        const barPct = count > 0 ? Math.max(0.15, count / maxWDCount) : 0;
                        return (
                          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: '100%', height: 36, borderRadius: 5, background: isToday ? L.ink : L.bg, position: 'relative', overflow: 'hidden' }}>
                              {count > 0 && (
                                <div style={{
                                  position: 'absolute',
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  height: `${barPct * 100}%`,
                                  background: isToday ? 'rgba(255,255,255,0.55)' : L.green,
                                  borderRadius: 4,
                                }} />
                              )}
                            </div>
                            <span style={{ fontFamily: MONO, fontSize: 9, color: L.muted, letterSpacing: '0.04em' }}>{letter}</span>
                            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: count === 0 ? L.muted : L.ink }}>{count}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Bunnlinje */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                      {weekOffset === 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(82,164,71,0.10)', borderRadius: 99, padding: '3px 9px', fontSize: 11, fontWeight: 600, color: L.green }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: L.green }} />
                          denne uken
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setWeekOffset(0)}
                          onMouseDown={pressD}
                          onMouseUp={pressU}
                          onMouseLeave={pressU}
                          style={{ background: 'none', border: 'none', fontFamily: MONO, fontSize: 10, color: L.muted, cursor: 'pointer', padding: 0, textDecoration: 'underline', textDecorationColor: L.border, transition: `transform 160ms ${EASE}` }}
                        >
                          → denne uken
                        </button>
                      )}
                      <span style={{ fontFamily: MONO, fontSize: 10, color: L.muted }}>{periodEndLabel}</span>
                    </div>
                  </div>

                  {/* Filter-kort */}
                  <div style={{ background: L.card, border: `1px solid ${L.border}`, borderRadius: 16, padding: '14px 14px 10px' }}>
                    <p style={{ margin: '0 0 10px', fontFamily: MONO, fontSize: 10, fontWeight: 700, color: L.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Filtre</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {filterPills.map((p) => {
                        const active = receiptCategoryFilter === p.key;
                        const dot = p.key === 'all' ? L.muted : catColor(p.key);
                        // split label into text + count for alignment
                        const labelMatch = p.label.match(/^(.*?)(\d+)$/);
                        const labelText = labelMatch ? labelMatch[1].trim() : p.label;
                        const labelNum  = labelMatch ? labelMatch[2] : '';
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => setReceiptCategoryFilter(p.key)}
                            onMouseDown={pressD}
                            onMouseUp={pressU}
                            onMouseLeave={(e) => { pressU(e); (e.currentTarget as HTMLButtonElement).style.background = active ? L.ink : 'transparent'; }}
                            onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(26,26,26,0.04)'; }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              width: '100%',
                              background: active ? L.ink : 'transparent',
                              border: 'none',
                              borderRadius: 10,
                              padding: '8px 10px',
                              cursor: 'pointer',
                              transition: `transform 160ms ${EASE}, background 160ms ${EASE}`,
                              textAlign: 'left',
                            }}
                          >
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? '#fff' : dot, flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: active ? '#fff' : L.ink }}>{labelText}</span>
                            <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: active ? 'rgba(255,255,255,0.6)' : L.muted }}>{labelNum}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Abonnementskort */}
                  <div style={{ background: L.bg, border: `1px solid ${L.border}`, borderRadius: 14, padding: 14 }}>
                    <p style={{ margin: '0 0 4px', fontFamily: MONO, fontSize: 10, fontWeight: 700, color: L.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Abonnement</p>
                    <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: L.ink }}>{currentPkgName}</p>
                    <p style={{ margin: 0, fontSize: 12, color: L.muted, lineHeight: 1.5 }}>
                      {hasStandardOrHigher
                        ? 'Du ser før/etter-verdier og full historikk.'
                        : 'Oppgrader for å se før/etter-verdier og full historikk.'}
                    </p>
                  </div>
                </aside>

                {/* ══════════════════════════════════
                    RIGHT FEED
                    ══════════════════════════════════ */}
                <main style={{ padding: '28px 40px', minWidth: 0 }}>

                  {/* Feed header */}
                  <div style={{ marginBottom: 16 }}>
                    <h1 style={{ margin: 0, fontSize: 'clamp(28px,3.5vw,38px)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1, color: L.ink }}>
                      {counts.all} hendelser{' '}
                      <span style={{ color: L.muted, fontWeight: 400 }}>
                        {weekOffset === 0 ? 'denne uken' : 'denne perioden'}
                      </span>
                    </h1>
                  </div>
                  <div style={{ height: 1, background: L.border, marginBottom: 24 }} />

                  {/* States */}
                  {loadingReceipt ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: L.muted, fontSize: 14 }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
                        <circle cx="8" cy="8" r="6" fill="none" stroke={L.border} strokeWidth="2" />
                        <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke={L.ink} strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      Laster aktivitetsloggen…
                    </div>
                  ) : filtered.length === 0 ? (
                    <div style={{ background: L.card, border: `1px solid ${L.border}`, borderRadius: 18, padding: '48px 32px', textAlign: 'center', maxWidth: 420 }}>
                      <ClipboardCheck size={28} style={{ color: L.muted, margin: '0 auto 14px', display: 'block' }} />
                      <p style={{ margin: '0 0 8px', color: L.ink, fontSize: 16, fontWeight: 600 }}>
                        {`Ingen handlinger ${weekOffset === 0 ? 'denne uken enda' : 'i denne uken'}`}
                      </p>
                      <p style={{ margin: '0 0 20px', color: L.muted, fontSize: 14, lineHeight: 1.6 }}>
                        {weekOffset === 0
                          ? 'Sikt jobber i bakgrunnen — første funn dukker opp her i løpet av kort tid etter at nettsiden er koblet til.'
                          : 'Sikt logget ingenting i denne perioden.'}
                      </p>
                      {weekOffset === 0 && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('home')}
                          onMouseDown={pressD}
                          onMouseUp={pressU}
                          onMouseLeave={pressU}
                          style={{ background: L.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: `transform 160ms ${EASE}` }}
                        >
                          Gå til Hjem
                        </button>
                      )}
                    </div>
                  ) : (
                    /* Day groups */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                      {perDay.map((group) => (
                        <div key={group.dateKey}>
                          {/* Day header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: L.ink, textTransform: 'capitalize', flexShrink: 0 }}>
                              {group.weekdayLong.charAt(0).toUpperCase() + group.weekdayLong.slice(1)}
                            </h2>
                            <span style={{ fontFamily: MONO, fontSize: 12, color: L.muted, flexShrink: 0 }}>{group.label}</span>
                            <div style={{ flex: 1, height: 1, background: L.border }} />
                            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: L.muted, letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0 }}>
                              {group.actions.length} hendelse{group.actions.length !== 1 ? 'r' : ''}
                            </span>
                          </div>

                          {/* Timeline */}
                          <div style={{ position: 'relative', paddingLeft: 48 }}>
                            {/* Vertical line */}
                            <div style={{ position: 'absolute', left: 14, top: 15, bottom: 15, width: 1, background: L.border }} />

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                              {group.actions.map((a, idx) => {
                                const meta = categoryMeta(a.category);
                                const nodeColor = catColor(a.category);
                                const catBg = a.category === 'fix'
                                  ? 'rgba(82,164,71,0.12)'
                                  : a.category === 'alert'
                                  ? 'rgba(128,128,128,0.14)'
                                  : 'rgba(26,26,26,0.07)';
                                const globalIdx = filtered.indexOf(a);
                                return (
                                  <div
                                    key={a.id}
                                    style={{
                                      position: 'relative',
                                      animation: `log-card-in 220ms ${EASE} both`,
                                      animationDelay: `${globalIdx * 35}ms`,
                                    }}
                                  >
                                    {/* Node */}
                                    <div style={{
                                      position: 'absolute',
                                      left: -48,
                                      top: 14,
                                      width: 28,
                                      height: 28,
                                      borderRadius: '50%',
                                      background: nodeColor,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      boxShadow: `0 0 0 3px ${L.bg}`,
                                    }}>
                                      {a.category === 'fix' ? (
                                        <CheckCircle2 size={13} style={{ color: '#fff' }} />
                                      ) : a.category === 'alert' ? (
                                        <Bell size={12} style={{ color: '#fff' }} />
                                      ) : a.category === 'suggestion' ? (
                                        <ArrowRight size={12} style={{ color: '#fff', transform: 'rotate(-45deg)' }} />
                                      ) : (
                                        <Search size={12} style={{ color: '#fff' }} />
                                      )}
                                    </div>

                                    {/* Card */}
                                    <div
                                      style={{
                                        background: L.card,
                                        border: `1px solid ${L.border}`,
                                        borderRadius: 14,
                                        padding: '16px 18px',
                                        boxShadow: '0 1px 2px rgba(26,26,26,0.02), 0 14px 34px -24px rgba(26,26,26,0.10)',
                                        transition: `transform 160ms ${EASE}, box-shadow 160ms ${EASE}, opacity 160ms ${EASE}`,
                                        opacity: a.status === 'done' ? 0.55 : 1,
                                      }}
                                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 2px rgba(26,26,26,0.03), 0 18px 40px -20px rgba(26,26,26,0.13)'; }}
                                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 2px rgba(26,26,26,0.02), 0 14px 34px -24px rgba(26,26,26,0.10)'; }}
                                    >
                                      {/* Card top row: category pill + URL + time */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                                        <span style={{
                                          background: catBg,
                                          color: nodeColor,
                                          borderRadius: 6,
                                          padding: '3px 8px',
                                          fontSize: 11,
                                          fontWeight: 700,
                                          letterSpacing: '0.04em',
                                          fontFamily: MONO,
                                        }}>
                                          {meta.label}
                                        </span>
                                        {a.page_url && (
                                          <span style={{ fontFamily: MONO, fontSize: 11, color: L.muted, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {(() => {
                                              try {
                                                const u = new URL(a.page_url.startsWith('http') ? a.page_url : `https://${a.page_url}`);
                                                return u.hostname + u.pathname;
                                              } catch { return a.page_url; }
                                            })()}
                                          </span>
                                        )}
                                        <span style={{ fontFamily: MONO, fontSize: 11, color: L.muted, marginLeft: 'auto', flexShrink: 0 }}>
                                          {new Date(a.created_at).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>

                                      {/* Title */}
                                      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: L.ink, lineHeight: 1.35, textDecoration: a.status === 'done' ? 'line-through' : 'none' }}>{a.title}</p>

                                      {/* Forklaring (fra motoren) */}
                                      {a.details?.explanation && (
                                        <p style={{ margin: '8px 0 0', fontSize: 13, color: L.muted, lineHeight: 1.55 }}>{a.details.explanation}</p>
                                      )}

                                      {/* Oppskrift: konkret «slik gjør du det» */}
                                      {a.details?.recipe && (
                                        <div style={{ background: L.bg, border: `1px solid ${L.border}`, borderRadius: 12, marginTop: 12, padding: '10px 12px' }}>
                                          <p style={{ margin: '0 0 4px', fontFamily: MONO, fontSize: 9, fontWeight: 700, color: L.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Slik gjør du det</p>
                                          <p style={{ margin: 0, fontSize: 13, color: L.ink, lineHeight: 1.55 }}>{a.details.recipe}</p>
                                        </div>
                                      )}

                                      {/* Svarutkast (GBP-anmeldelser): klart til å lime inn */}
                                      {a.details?.reply && (
                                        <div style={{ background: L.bg, border: `1px solid ${L.border}`, borderRadius: 12, marginTop: 12, padding: '10px 12px' }}>
                                          <p style={{ margin: '0 0 4px', fontFamily: MONO, fontSize: 9, fontWeight: 700, color: L.green, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Klart til å lime inn</p>
                                          <p style={{ margin: 0, fontSize: 13, color: L.ink, lineHeight: 1.55, fontStyle: 'italic' }}>«{a.details.reply}»</p>
                                        </div>
                                      )}

                                      {/* Before / After */}
                                      {(a.before_value || a.after_value) && (
                                        <div style={{
                                          background: L.bg,
                                          border: `1px solid ${L.border}`,
                                          borderRadius: 12,
                                          marginTop: 14,
                                          display: 'grid',
                                          gridTemplateColumns: a.before_value && a.after_value ? '1fr 28px 1fr' : '1fr',
                                          alignItems: 'start',
                                          overflow: 'hidden',
                                        }}>
                                          {a.before_value && (
                                            <div style={{ padding: '10px 12px' }}>
                                              <p style={{ margin: '0 0 4px', fontFamily: MONO, fontSize: 9, fontWeight: 700, color: L.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Før</p>
                                              <p style={{ margin: 0, fontFamily: MONO, fontSize: 12, color: L.muted, textDecoration: 'line-through', lineHeight: 1.45 }}>{a.before_value}</p>
                                            </div>
                                          )}
                                          {a.before_value && a.after_value && (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 22 }}>
                                              <ArrowRight size={12} style={{ color: L.green }} />
                                            </div>
                                          )}
                                          {a.after_value && (
                                            <div style={{ padding: '10px 12px' }}>
                                              <p style={{ margin: '0 0 4px', fontFamily: MONO, fontSize: 9, fontWeight: 700, color: L.green, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Etter</p>
                                              <p style={{ margin: 0, fontFamily: MONO, fontSize: 12, color: L.green, fontWeight: 600, lineHeight: 1.45 }}>{a.after_value}</p>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* Handlingsrad: kopier + merk som gjort */}
                                      {(() => {
                                        const copyText = a.details?.reply || (a.category === 'suggestion' ? a.after_value : null);
                                        const canMarkDone = a.category === 'suggestion' || a.category === 'alert';
                                        if (!copyText && !canMarkDone) return null;
                                        return (
                                          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                                            {copyText && (
                                              <button
                                                type="button"
                                                onClick={() => { navigator.clipboard?.writeText(copyText); toastSuccess('Kopiert til utklipp.'); }}
                                                onMouseDown={pressD}
                                                onMouseUp={pressU}
                                                onMouseLeave={pressU}
                                                style={{ background: 'none', border: 'none', color: L.ink, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 5, transition: `transform 160ms ${EASE}` }}
                                              >
                                                <Copy size={12} /> Kopier til utklipp
                                              </button>
                                            )}
                                            {canMarkDone && (
                                              <button
                                                type="button"
                                                onClick={() => markActionDone(a.id, a.status !== 'done')}
                                                onMouseDown={pressD}
                                                onMouseUp={pressU}
                                                onMouseLeave={pressU}
                                                style={{ background: 'none', border: 'none', color: a.status === 'done' ? L.muted : L.green, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 5, transition: `transform 160ms ${EASE}` }}
                                              >
                                                <CheckCircle2 size={12} /> {a.status === 'done' ? 'Angre «gjort»' : 'Merk som gjort'}
                                              </button>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </main>
              </div>
              </div>
            </div>
          );
        })()}

        {/* =============================================================== */}
        {/* INNSTILLINGER — KONFIGURASJON                                  */}
        {/* =============================================================== */}
        {activeTab === 'settings' && (() => {
          const settingsMono = "ui-monospace,'SF Mono',Menlo,monospace";
          const settingsDomain = domainLabel || 'ingen-nettside';
          const profileDisplayFields = [
            { label: 'Bedrift', value: clientData?.companyName || 'Ikke oppgitt' },
            { label: 'Kontaktperson', value: clientData?.contactPerson || 'Ikke oppgitt' },
            { label: 'E-post', value: clientData?.email || user?.email || 'Ikke oppgitt' },
            { label: 'Telefon', value: clientData?.phone || 'Ikke oppgitt' },
            { label: 'Nettside', value: websiteUrl || 'Legg inn under rediger profil' },
            { label: 'Bransje', value: clientData?.industry || 'Ikke oppgitt' },
            { label: 'Målgruppe', value: clientData?.targetAudience || 'Ikke oppgitt' },
          ];
          const profileEditFields = [
            { key: 'companyName', label: 'Bedrift', placeholder: 'Min Bedrift AS' },
            { key: 'contactPerson', label: 'Kontaktperson', placeholder: 'Ola Nordmann' },
            { key: 'email', label: 'E-post', placeholder: 'ola@bedrift.no' },
            { key: 'phone', label: 'Telefon', placeholder: '+47 ...' },
            { key: 'industry', label: 'Bransje', placeholder: 'F.eks. rørlegger' },
          ] as const;
          const notifRows = [
            { id: 'weeklyReport' as const, label: hasStandardOrHigher ? 'Ukentlig rapport' : 'Månedlig rapport', desc: 'Sammendrag av fikser, funn og rangeringer.' },
            { id: 'criticalAlerts' as const, label: 'Kritiske varsler', desc: 'Når nettsiden går ned eller får alvorlige feil.' },
            { id: 'rankChanges' as const, label: 'Rangeringsendringer', desc: 'Når du går opp eller ned på topp 10.' },
          ];
          const sectionCountProfile = editingSection === 'profile' ? profileEditFields.length + 2 : profileDisplayFields.length;
          const sectionCountCms = (/basic/i.test(planBundle) && !hasStandardOrHigher) ? 0 : 3;
          const sectionCountNotif = notifRows.length;
          const sectionCountTheme = 2;
          const planCost = planPrices[activePlanKey];

          const sectionShell = "rounded-2xl border border-[#EBEBE6] bg-[#FFFFFF] overflow-hidden";
          const sectionSummary = "list-none px-4 sm:px-6 py-4 cursor-pointer";
          const rowShell = "flex items-start justify-between gap-4 py-3 border-t border-[#EBEBE6]";

          return (
            <div key={activeTab} className="space-y-6">
              <header className="flex items-end justify-between flex-wrap gap-3">
                <div>
                  <h1 className={`text-3xl sm:text-4xl font-semibold tracking-tight ${textMain}`}>Konfigurasjon</h1>
                  <p className={`text-base mt-3 ${textDim}`}>innstillinger</p>
                </div>
              </header>
              <div className={`${tabFadeInClass} space-y-6`}>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[#EBEBE6] bg-[#FFFFFF] p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: '#808080', fontFamily: settingsMono }}>Plan</p>
                  <p className="text-xl font-semibold mt-2" style={{ color: '#1A1A1A' }}>{planNames[activePlanKey]}</p>
                </div>
                <div className="rounded-xl border border-[#EBEBE6] bg-[#FFFFFF] p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: '#808080', fontFamily: settingsMono }}>Mnd. kostnad</p>
                  <p className="text-xl font-semibold mt-2" style={{ color: '#1A1A1A' }}>{planCost}</p>
                </div>
                <div className="rounded-xl border border-[#EBEBE6] bg-[#FFFFFF] p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: '#808080', fontFamily: settingsMono }}>CMS</p>
                  <p className="text-xl font-semibold mt-2" style={{ color: hostIsFullyConnected || hostIsWix ? '#52A447' : '#1A1A1A' }}>
                    {hostIsWix ? 'Wix' : hostIsFullyConnected ? 'WordPress' : hostWasLightOnly ? 'Koble på nytt' : 'Ikke koblet'}
                  </p>
                </div>
              </div>

              <details className={sectionShell} open>
                <summary className={sectionSummary}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs tracking-[0.14em] uppercase" style={{ color: '#808080', fontFamily: settingsMono }}>01</span>
                      <p className="text-base sm:text-lg font-semibold truncate" style={{ color: '#1A1A1A' }}>Bedrift og nettside · {sectionCountProfile} felt</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setEditingSection(editingSection === 'profile' ? null : 'profile'); }}
                      onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                      onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                      className="text-xs uppercase tracking-[0.12em] px-2.5 py-1 rounded-full"
                      style={{ color: '#1A1A1A', border: '1px solid #EBEBE6', background: '#FFFFFF', fontFamily: settingsMono, transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), background 160ms cubic-bezier(0.23,1,0.32,1)' }}
                    >
                      {editingSection === 'profile' ? 'edit off' : 'edit'}
                    </button>
                  </div>
                </summary>
                <div className="px-4 sm:px-6 pb-5">
                  {editingSection !== 'profile' ? (
                    <dl>
                      {profileDisplayFields.map((row) => (
                        <div key={row.label} className={rowShell}>
                          <dt className="text-sm" style={{ color: '#808080' }}>{row.label}</dt>
                          <dd className="text-sm text-right max-w-[70%] break-words" style={{ color: '#1A1A1A', fontFamily: settingsMono }}>{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <div className="space-y-4 pt-1">
                      {profileEditFields.map((f) => (
                        <div key={f.key}>
                          <label className="block text-sm mb-1.5" style={{ color: '#808080' }}>{f.label}</label>
                          <input
                            type="text"
                            value={formData[f.key] ?? ''}
                            onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                            placeholder={f.placeholder}
                            className="w-full rounded-lg px-3 py-2.5 text-sm border border-[#EBEBE6] bg-[#FFFFFF] focus:outline-none"
                            style={{ color: '#1A1A1A' }}
                          />
                        </div>
                      ))}
                      <div>
                        <label className="block text-sm mb-1.5" style={{ color: '#808080' }}>
                          Nettside
                          {urlLocked && (
                            <span className="ml-2 text-[11px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border border-[#EBEBE6]" style={{ color: '#808080', fontFamily: settingsMono }}>
                              locked · {urlDaysLeft}d
                            </span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={formData.websiteUrl ?? ''}
                          onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                          placeholder="https://minbedrift.no"
                          disabled={urlLocked}
                          className="w-full rounded-lg px-3 py-2.5 text-sm border border-[#EBEBE6] bg-[#FFFFFF] focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                          style={{ color: '#1A1A1A' }}
                        />
                        <p className="text-xs mt-1.5" style={{ color: '#808080' }}>
                          Du kan endre nettadressen én gang per uke. Etter lagring er den låst i 7 dager.
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm mb-1.5" style={{ color: '#808080' }}>Målgruppe</label>
                        <textarea
                          value={formData.targetAudience ?? ''}
                          onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                          placeholder="Hvem vil du nå?"
                          rows={3}
                          className="w-full rounded-lg px-3 py-2.5 text-sm border border-[#EBEBE6] bg-[#FFFFFF] focus:outline-none resize-none"
                          style={{ color: '#1A1A1A' }}
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingSection(null)}
                          onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                          onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                          className="rounded-full px-4 py-2 text-sm border border-[#EBEBE6] bg-[#FFFFFF]"
                          style={{ color: '#1A1A1A', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1)' }}
                        >
                          Avbryt
                        </button>
                        <button
                          type="button"
                          onClick={async () => { await handleSaveSettings(formData); setEditingSection(null); }}
                          disabled={saving}
                          onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                          onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                          className="rounded-full px-4 py-2 text-sm border border-[#1A1A1A] bg-[#1A1A1A] text-white inline-flex items-center gap-2 disabled:opacity-70"
                          style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                        >
                          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          Lagre
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </details>

              {!(/basic/i.test(planBundle) && !hasStandardOrHigher) && (
                <details className={sectionShell} open>
                  <summary className={sectionSummary}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs tracking-[0.14em] uppercase" style={{ color: '#808080', fontFamily: settingsMono }}>02</span>
                      <p className="text-base sm:text-lg font-semibold truncate" style={{ color: '#1A1A1A' }}>CMS-tilkobling · {sectionCountCms} plattformer</p>
                    </div>
                  </summary>
                  <div className="px-4 sm:px-6 pb-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-xl border border-[#EBEBE6] bg-[#FFFFFF] p-4 flex flex-col min-h-[140px]">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>WordPress</p>
                          {hostIsFullyConnected && (
                            <span className="text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full shrink-0" style={{ color: '#52A447', background: '#F5F5F0', fontFamily: settingsMono }}>
                              tilkoblet
                            </span>
                          )}
                        </div>
                        {hostIsFullyConnected ? (
                          <>
                            <p className="text-sm mt-3 flex-1 break-words" style={{ color: '#808080' }}>
                              Tilkoblet: {hostConnection?.adminUrl || '—'} som {hostConnection?.notes || '—'}
                            </p>
                            <button
                              type="button"
                              onClick={() => { setDisconnectError(null); setShowDisconnectConfirm(true); }}
                              onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                              onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                              className="mt-4 text-sm text-left"
                              style={{ color: '#808080', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                            >
                              Koble fra
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="text-sm mt-3 flex-1" style={{ color: '#808080' }}>
                              {hostWasLightOnly
                                ? 'Tidligere registrert uten skrivetilgang. Koble til på nytt med Application Password.'
                                : 'Koble til for at Sikt kan gjøre endringer direkte på siden din.'}
                            </p>
                            <button
                              type="button"
                              onClick={() => openHostConnectWizard('wordpress')}
                              onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                              onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                              className="mt-4 rounded-full px-4 py-2 text-sm border border-[#1A1A1A] bg-[#1A1A1A] text-white"
                              style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                            >
                              {hostWasLightOnly ? 'Koble til WordPress (på nytt)' : 'Koble til'}
                            </button>
                          </>
                        )}
                      </div>
                      <div className="rounded-xl border border-[#EBEBE6] bg-[#FFFFFF] p-4 flex flex-col min-h-[140px]">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Wix</p>
                          {hostIsWix && (
                            <span className="text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full shrink-0" style={{ color: '#52A447', background: '#F5F5F0', fontFamily: settingsMono }}>
                              tilkoblet
                            </span>
                          )}
                        </div>
                        {hostIsWix ? (
                          <>
                            <p className="text-sm mt-3 flex-1 break-words" style={{ color: '#808080' }}>
                              Rådgiver-modus: {hostConnection?.adminUrl || '—'}. Du kopierer Sikt-forslag inn i Wix selv.
                            </p>
                            <button
                              type="button"
                              onClick={() => { setDisconnectError(null); setShowDisconnectConfirm(true); }}
                              onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                              onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                              className="mt-4 text-sm text-left"
                              style={{ color: '#808080', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                            >
                              Koble fra
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="text-sm mt-3 flex-1" style={{ color: '#808080' }}>
                              Koble til med nettside-URL. Sikt lager forslag du limer inn i Wix-editoren.
                            </p>
                            <button
                              type="button"
                              onClick={() => openHostConnectWizard('wix')}
                              onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                              onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                              className="mt-4 rounded-full px-4 py-2 text-sm border border-[#1A1A1A] bg-[#1A1A1A] text-white"
                              style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                            >
                              Koble til
                            </button>
                          </>
                        )}
                      </div>
                      <div
                        className="rounded-xl border border-[#EBEBE6] bg-[#FFFFFF] p-4 flex flex-col min-h-[140px]"
                        style={{ pointerEvents: 'none', opacity: 0.5 }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Shopify</p>
                          <span className="text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full shrink-0" style={{ color: '#808080', background: '#F5F5F0', fontFamily: settingsMono }}>
                            Kommer snart
                          </span>
                        </div>
                        <p className="text-sm mt-3 flex-1" style={{ color: '#808080' }}>
                          Vi bygger denne integrasjonen etter hva kundene bruker mest.
                        </p>
                      </div>
                    </div>
                    <p className="text-sm" style={{ color: '#808080' }}>
                      Bruker du en annen plattform? Ta kontakt — vi prioriterer hvilke vi bygger neste etter hva kundene faktisk bruker.
                    </p>
                    {!hostIsFullyConnected && !hostIsWix && (
                      <p className="text-sm" style={{ color: '#808080' }}>
                        Ikke koblet til. Sikt viser fortsatt funn og forslag, men du må kopiere fiksene inn selv.
                      </p>
                    )}
                  </div>
                </details>
              )}

              <details className={sectionShell} open>
                <summary className={sectionSummary}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs tracking-[0.14em] uppercase" style={{ color: '#808080', fontFamily: settingsMono }}>03</span>
                    <p className="text-base sm:text-lg font-semibold" style={{ color: '#1A1A1A' }}>Abonnement</p>
                  </div>
                </summary>
                <div className="px-4 sm:px-6 pb-5">
                  <div className="grid sm:grid-cols-3 gap-3">
                    {(['BASIC', 'STANDARD', 'PREMIUM'] as const).map((key) => {
                      const isCurrent = activePlanKey === key;
                      const order: Record<string, number> = { BASIC: 1, STANDARD: 2, PREMIUM: 3 };
                      const type: 'upgrade' | 'downgrade' = order[key] > order[activePlanKey] ? 'upgrade' : 'downgrade';
                      return (
                        <div key={key} className="rounded-xl border border-[#EBEBE6] bg-[#FFFFFF] p-4">
                          <p className="text-xs uppercase tracking-[0.14em]" style={{ color: '#808080', fontFamily: settingsMono }}>{planNames[key]}</p>
                          <p className="text-xl font-semibold mt-2" style={{ color: '#1A1A1A' }}>{planPrices[key]}<span className="text-xs font-normal ml-1" style={{ color: '#808080' }}>/mnd</span></p>
                          {isCurrent ? (
                            <p className="mt-3 text-xs uppercase tracking-[0.12em]" style={{ color: '#52A447', fontFamily: settingsMono }}>aktiv</p>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPlanChangeTarget({ key, name: planNames[key], price: planPrices[key], type })}
                              onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                              onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                              className="mt-3 text-sm"
                              style={{ color: '#1A1A1A', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                            >
                              {type === 'upgrade' ? 'Oppgrader' : 'Nedgrader'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </details>

              <details className={sectionShell} open>
                <summary className={sectionSummary}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs tracking-[0.14em] uppercase" style={{ color: '#808080', fontFamily: settingsMono }}>04</span>
                    <p className="text-base sm:text-lg font-semibold" style={{ color: '#1A1A1A' }}>Varsler · {sectionCountNotif} felt</p>
                  </div>
                </summary>
                <div className="px-4 sm:px-6 pb-5">
                  <ul>
                    {notifRows.map((item) => (
                      <li key={item.id} className={rowShell}>
                        <div className="min-w-0">
                          <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{item.label}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#808080' }}>{item.desc}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs uppercase tracking-[0.12em]" style={{ color: '#808080', fontFamily: settingsMono }}>
                            {notifPrefs[item.id] ? 'true' : 'false'}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleNotif(item.id)}
                            className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full"
                            style={{ background: notifPrefs[item.id] ? '#52A447' : '#EBEBE6', transition: 'background 160ms cubic-bezier(0.23,1,0.32,1)' }}
                          >
                            <span
                              className="inline-block h-4 w-4 rounded-full bg-white"
                              style={{ transform: notifPrefs[item.id] ? 'translateX(24px)' : 'translateX(4px)', transition: 'transform 160ms cubic-bezier(0.23,1,0.32,1)' }}
                            />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>

              <details className={sectionShell} open>
                <summary className={sectionSummary}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs tracking-[0.14em] uppercase" style={{ color: '#808080', fontFamily: settingsMono }}>05</span>
                    <p className="text-base sm:text-lg font-semibold" style={{ color: '#1A1A1A' }}>Utseende · {sectionCountTheme} felt</p>
                  </div>
                </summary>
                <div className="px-4 sm:px-6 pb-5">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'light' as const, label: 'Lys' },
                      { id: 'dark' as const, label: 'Mørk' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setTheme(opt.id)}
                        onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                        onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                        className="px-5 py-4 rounded-xl border text-sm font-medium"
                        style={{
                          borderColor: '#EBEBE6',
                          background: theme === opt.id ? '#1A1A1A' : '#FFFFFF',
                          color: theme === opt.id ? '#FFFFFF' : '#1A1A1A',
                          transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), background 160ms cubic-bezier(0.23,1,0.32,1), color 160ms cubic-bezier(0.23,1,0.32,1)',
                        }}
                      >
                        {opt.id === 'light' ? <Sun size={16} className="inline mr-2" /> : <Moon size={16} className="inline mr-2" />}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </details>

              <div className="rounded-2xl border border-[#EBEBE6] bg-[#FFFFFF] p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="text-lg font-semibold" style={{ color: '#1A1A1A' }}>Vanlige spørsmål</h3>
                  <button
                    type="button"
                    onClick={() => setShowFaqModal(true)}
                    onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    className="text-xs uppercase tracking-[0.12em] px-2.5 py-1 rounded-full"
                    style={{ color: '#1A1A1A', border: '1px solid #EBEBE6', background: '#FFFFFF', fontFamily: settingsMono, transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), background 160ms cubic-bezier(0.23,1,0.32,1)' }}
                  >
                    åpne
                  </button>
                </div>
                <p className="text-sm" style={{ color: '#808080' }}>
                  Felles svar om analyseintervall, GSC-forsinkelse, GEO-status og Technical Score.
                </p>
              </div>

              <div
                className="rounded-2xl border p-5 sm:p-6"
                style={{ borderColor: 'rgba(192,57,43,0.35)', background: 'rgba(192,57,43,0.04)' }}
              >
                <h3 className="text-lg font-semibold" style={{ color: '#8B2E2E' }}>Slett konto</h3>
                <p className="text-sm mt-2 mb-4" style={{ color: '#808080', lineHeight: 1.55 }}>
                  Dette sletter kontoen din og alle data permanent. Handlingen kan ikke angres.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    resetDeleteAccountModal();
                    setShowDeleteAccountModal(true);
                  }}
                  onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                  onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: '#C0392B', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                >
                  Slett konto
                </button>
              </div>
              </div>
            </div>
          );
        })()}

        <footer className="mt-12 pt-6 border-t border-[#EBEBE6] text-center text-sm" style={{ color: '#808080' }}>
          <p className="inline-flex items-center justify-center gap-2 flex-wrap" style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>
            <span>support@siktseo.com</span>
            <span>·</span>
            <span>sla 1 working day</span>
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
            <div className="relative w-full max-w-2xl rounded-2xl border border-[#EBEBE6] bg-[#FFFFFF] p-6 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold" style={{ color: '#1A1A1A' }}>Vanlige spørsmål</h3>
                <button type="button" onClick={() => setShowFaqModal(false)} className="p-1.5 rounded-md" style={{ color: '#808080' }}>
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
                  <div key={idx} className="rounded-lg border border-[#EBEBE6] p-4">
                    <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{item.q}</p>
                    <p className="text-sm mt-1" style={{ color: '#808080' }}>{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
    </main>

      {/* =============================================================== */}
      {/* WORDPRESS CONNECT WIZARD                                        */}
      {/* =============================================================== */}
      {showWpWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <style>{`
            @keyframes wp-wizard-in {
              from { opacity: 0; transform: translateY(8px) scale(0.98); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
            @media (prefers-reduced-motion: reduce) {
              @keyframes wp-wizard-in {
                from { opacity: 0; }
                to   { opacity: 1; }
              }
            }
          `}</style>
          <button
            type="button"
            aria-label="Lukk"
            onClick={closeWpWizard}
            disabled={wpConnecting || wixConnecting}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm disabled:cursor-wait"
            style={{ transition: 'opacity 200ms ease-out' }}
          />
          <div
            className="relative w-full max-w-lg rounded-2xl border border-[#EBEBE6] bg-[#FFFFFF] shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
            style={{ animation: 'wp-wizard-in 220ms cubic-bezier(0.23,1,0.32,1) forwards' }}
            role="dialog"
            aria-modal="true"
          >
            <header className="flex items-center justify-between mb-4">
              <p className="text-xs uppercase tracking-[0.12em]" style={{ color: '#808080', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>
                {connectWizardPlatform === null
                  ? 'Velg plattform'
                  : connectWizardPlatform === 'wix'
                    ? 'Wix'
                    : wpWizardStep === 3
                      ? 'Resultat'
                      : `Trinn ${wpWizardStep} av 3`}
              </p>
              <button
                type="button"
                onClick={closeWpWizard}
                disabled={wpConnecting || wixConnecting}
                className="p-1.5 rounded-md disabled:opacity-40"
                style={{ color: '#808080', transition: 'opacity 160ms ease-out' }}
              >
                <X size={16} />
              </button>
            </header>

            {connectWizardPlatform === null && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold" style={{ color: '#1A1A1A' }}>Hvilken plattform bruker du?</h3>
                <p className="text-sm" style={{ color: '#808080' }}>
                  WordPress kan kobles med skrivetilgang. Wix bruker rådgiver-modus — du kopierer forslag inn selv.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setConnectWizardPlatform('wordpress');
                      setWpWizardStep(1);
                    }}
                    onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    className="text-left p-4 rounded-xl border border-[#EBEBE6] bg-[#FFFFFF] [@media(hover:hover)_and_(pointer:fine)]:hover:border-[#1A1A1A]"
                    style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), border-color 160ms ease' }}
                  >
                    <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>WordPress</p>
                    <p className="text-xs mt-2" style={{ color: '#808080' }}>Push endringer direkte fra Sikt</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConnectWizardPlatform('wix')}
                    onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    className="text-left p-4 rounded-xl border border-[#EBEBE6] bg-[#FFFFFF] [@media(hover:hover)_and_(pointer:fine)]:hover:border-[#1A1A1A]"
                    style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), border-color 160ms ease' }}
                  >
                    <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Wix</p>
                    <p className="text-xs mt-2" style={{ color: '#808080' }}>Kun URL — kopier forslag selv</p>
                  </button>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={closeWpWizard}
                    onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    className="rounded-full px-4 py-2 text-sm border border-[#EBEBE6] bg-[#FFFFFF]"
                    style={{ color: '#1A1A1A', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1)' }}
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            )}

            {connectWizardPlatform === 'wix' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold" style={{ color: '#1A1A1A' }}>Koble til Wix</h3>
                <p className="text-sm" style={{ color: '#808080' }}>
                  Lim inn adressen til Wix-siden din (https). Sikt lager forslag du kopierer inn i editoren.
                </p>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: '#808080' }}>Nettside-URL</label>
                  <input
                    type="url"
                    value={wixSiteUrl}
                    onChange={(e) => {
                      const v = e.target.value;
                      setWixSiteUrl(v);
                      if (!v.trim()) setWixSiteUrlError(null);
                      else if (!v.trim().startsWith('https://')) setWixSiteUrlError('Må starte med https://');
                      else setWixSiteUrlError(null);
                    }}
                    placeholder="https://dinside.wixsite.com/hjem"
                    className="w-full rounded-lg px-3 py-2.5 text-sm border border-[#EBEBE6] bg-[#FFFFFF] focus:outline-none"
                    style={{ color: '#1A1A1A' }}
                  />
                  {wixSiteUrlError ? (
                    <p className="text-xs mt-1.5" style={{ color: '#c0392b' }}>{wixSiteUrlError}</p>
                  ) : (
                    <p className="text-xs mt-1.5" style={{ color: '#808080' }}>Må starte med https://</p>
                  )}
                </div>
                {wixConnectError && (
                  <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#F5F5F0', color: '#c0392b', border: '1px solid #EBEBE6' }}>
                    {wixConnectError}
                  </div>
                )}
                <div className="flex justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setConnectWizardPlatform(null)}
                    disabled={wixConnecting}
                    onMouseDown={(e) => { if (wixConnecting) return; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    className="rounded-full px-4 py-2 text-sm border border-[#EBEBE6] bg-[#FFFFFF] disabled:opacity-50"
                    style={{ color: '#1A1A1A', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1)' }}
                  >
                    Tilbake
                  </button>
                  <button
                    type="button"
                    onClick={connectWixAdvisory}
                    disabled={!wixStepValid || wixConnecting}
                    onMouseDown={(e) => { if (!wixStepValid || wixConnecting) return; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    className="rounded-full px-4 py-2 text-sm border border-[#1A1A1A] bg-[#1A1A1A] text-white disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                  >
                    {wixConnecting ? <Loader2 size={14} className="animate-spin" /> : null}
                    Koble til
                  </button>
                </div>
              </div>
            )}

            {connectWizardPlatform === 'wordpress' && wpWizardStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold" style={{ color: '#1A1A1A' }}>Installer Sikt-tillegget</h3>
                <p className="text-sm" style={{ color: '#808080' }}>
                  Sikt fikser siden din via et lite, trygt WordPress-tillegg. Last det ned og installer det først — det tar ett minutt.
                </p>
                <a
                  href="/sikt-connector.zip"
                  download
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold border border-[#1A1A1A] bg-[#1A1A1A] text-white"
                  style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1)' }}
                  onMouseDown={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(0.97)'; }}
                  onMouseUp={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1)'; }}
                >
                  <Download size={15} /> Last ned Sikt Connector
                </a>
                <ol className="text-sm space-y-2 list-decimal list-inside" style={{ color: '#1A1A1A' }}>
                  <li>I WordPress-admin: gå til Tillegg → Legg til nytt → Last opp tillegg.</li>
                  <li>Velg filen <code style={{ background: '#F5F5F0', padding: '1px 5px', borderRadius: 4 }}>sikt-connector.zip</code> du nettopp lastet ned.</li>
                  <li>Klikk &quot;Installer nå&quot;, deretter &quot;Aktiver&quot;.</li>
                </ol>
                <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#F5F5F0', color: '#808080' }}>
                  Allerede installert tidligere? Last ned på nytt og velg «Erstatt» for å få siste versjon — nye funksjoner som schema, alt-tekst og llms.txt krever det.
                </div>

                <div className="pt-1 border-t" style={{ borderColor: '#EBEBE6' }} />
                <h3 className="text-lg font-semibold pt-1" style={{ color: '#1A1A1A' }}>Lag et Application Password</h3>
                <p className="text-sm" style={{ color: '#808080' }}>
                  Sikt trenger et eget passord for å gjøre endringer på siden din. Det er trygt, du kan trekke det tilbake når som helst, og det erstatter ikke vanlig innlogging.
                </p>
                <ol className="text-sm space-y-2 list-decimal list-inside" style={{ color: '#1A1A1A' }}>
                  <li>Gå til Brukere → Profil i WordPress-admin.</li>
                  <li>Bla ned til &quot;Application Passwords&quot;.</li>
                  <li>Skriv &quot;Sikt&quot; som navn, klikk &quot;Add New&quot;.</li>
                  <li>Kopier den 24-tegns koden som vises — den vises kun én gang.</li>
                </ol>
                <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#F5F5F0', color: '#1A1A1A' }}>
                  Hvis du ikke ser Application Passwords-seksjonen, kan WordPress-versjonen din være for gammel. Du må ha WordPress 5.6 eller nyere.
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeWpWizard}
                    onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    className="rounded-full px-4 py-2 text-sm border border-[#EBEBE6] bg-[#FFFFFF]"
                    style={{ color: '#1A1A1A', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1)' }}
                  >
                    Avbryt
                  </button>
                  <button
                    type="button"
                    onClick={() => setWpWizardStep(2)}
                    onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    className="rounded-full px-4 py-2 text-sm border border-[#1A1A1A] bg-[#1A1A1A] text-white"
                    style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                  >
                    Jeg har koden, fortsett →
                  </button>
                </div>
              </div>
            )}

            {connectWizardPlatform === 'wordpress' && wpWizardStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold" style={{ color: '#1A1A1A' }}>Koble til WordPress</h3>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: '#808080' }}>WordPress-adresse</label>
                  <input
                    type="url"
                    value={wpSiteUrl}
                    onChange={(e) => {
                      const v = e.target.value;
                      setWpSiteUrl(v);
                      if (!v.trim()) setWpSiteUrlError(null);
                      else if (!v.trim().startsWith('https://')) setWpSiteUrlError('Må starte med https://');
                      else setWpSiteUrlError(null);
                    }}
                    placeholder="https://dinside.no"
                    className="w-full rounded-lg px-3 py-2.5 text-sm border border-[#EBEBE6] bg-[#FFFFFF] focus:outline-none"
                    style={{ color: '#1A1A1A' }}
                  />
                  {wpSiteUrlError ? (
                    <p className="text-xs mt-1.5" style={{ color: '#c0392b' }}>{wpSiteUrlError}</p>
                  ) : (
                    <p className="text-xs mt-1.5" style={{ color: '#808080' }}>Må starte med https://</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: '#808080' }}>Brukernavn</label>
                  <input
                    type="text"
                    value={wpUsername}
                    onChange={(e) => setWpUsername(e.target.value)}
                    placeholder="ditt-wp-brukernavn"
                    autoComplete="username"
                    className="w-full rounded-lg px-3 py-2.5 text-sm border border-[#EBEBE6] bg-[#FFFFFF] focus:outline-none"
                    style={{ color: '#1A1A1A' }}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: '#808080' }}>Application Password</label>
                  <input
                    type="password"
                    value={wpAppPassword}
                    onChange={(e) => setWpAppPassword(e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                    autoComplete="new-password"
                    className="w-full rounded-lg px-3 py-2.5 text-sm border border-[#EBEBE6] bg-[#FFFFFF] focus:outline-none"
                    style={{ color: '#1A1A1A' }}
                  />
                  <p className="text-xs mt-1.5" style={{ color: '#808080' }}>
                    Lim inn akkurat slik WordPress viste den, med mellomrom
                  </p>
                </div>
                <div className="flex justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setWpWizardStep(1)}
                    onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    className="rounded-full px-4 py-2 text-sm border border-[#EBEBE6] bg-[#FFFFFF]"
                    style={{ color: '#1A1A1A', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1)' }}
                  >
                    Tilbake
                  </button>
                  <button
                    type="button"
                    onClick={connectWordPress}
                    disabled={!wpStep2Valid}
                    onMouseDown={(e) => { if (!wpStep2Valid) return; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    className="rounded-full px-4 py-2 text-sm border border-[#1A1A1A] bg-[#1A1A1A] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                  >
                    Koble til
                  </button>
                </div>
              </div>
            )}

            {connectWizardPlatform === 'wordpress' && wpWizardStep === 3 && (
              <div className="space-y-4">
                {wpConnecting && (
                  <div className="flex flex-col items-center py-8 gap-3">
                    <Loader2 size={28} className="animate-spin" style={{ color: '#52A447' }} />
                    <p className="text-sm text-center" style={{ color: '#808080' }}>
                      Verifiserer mot WordPress-siden din — dette tar opp til 10 sekunder.
                    </p>
                  </div>
                )}
                {!wpConnecting && wpConnectResult && (
                  <div className="space-y-4">
                    <div className="rounded-xl px-4 py-4" style={{ background: '#F5F5F0' }}>
                      <p className="text-lg font-semibold" style={{ color: '#52A447' }}>Tilkoblet ✓</p>
                      <p className="text-sm mt-2" style={{ color: '#808080' }}>
                        {wpConnectResult.site} · {wpConnectResult.wpUser}
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={closeWpWizard}
                        onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                        onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                        className="rounded-full px-4 py-2 text-sm border border-[#1A1A1A] bg-[#1A1A1A] text-white"
                        style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                      >
                        Ferdig
                      </button>
                    </div>
                  </div>
                )}
                {!wpConnecting && wpConnectError && (
                  <div className="space-y-4">
                    <div className="rounded-xl px-4 py-4 text-sm" style={{ background: '#F5F5F0', color: '#c0392b', border: '1px solid #EBEBE6' }}>
                      {wpConnectError}
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => { setWpConnectError(null); setWpWizardStep(2); }}
                        onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                        onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                        className="rounded-full px-4 py-2 text-sm border border-[#1A1A1A] bg-[#1A1A1A] text-white"
                        style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
                      >
                        Prøv igjen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Lukk"
            onClick={closeDeleteAccountModal}
            disabled={deletingAccount}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm disabled:cursor-wait"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-[#EBEBE6] bg-[#FFFFFF] shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold mb-2" style={{ color: '#8B2E2E' }}>Slett konto permanent?</h3>
            <p className="text-sm mb-3" style={{ color: '#808080', lineHeight: 1.55 }}>
              Dette sletter følgende permanent og kan ikke angres:
            </p>
            <ul className="text-sm mb-3 space-y-1.5 list-disc pl-5" style={{ color: '#1A1A1A', lineHeight: 1.5 }}>
              <li>WordPress-tilkoblinger</li>
              <li>Skann og analyser</li>
              <li>Konkurrentdata</li>
              <li>Søkeord og rangeringer</li>
              <li>Selve kontoen din</li>
            </ul>
            <p className="text-sm mb-4 font-semibold" style={{ color: '#8B2E2E', lineHeight: 1.55 }}>
              Sletting kansellerer IKKE abonnementet ditt. Si opp abonnementet separat for å unngå videre trekk.
            </p>
            <label className="block text-sm mb-1.5" style={{ color: '#808080' }}>
              Skriv SLETT for å bekrefte
            </label>
            <input
              type="text"
              value={deleteAccountConfirmText}
              onChange={(e) => setDeleteAccountConfirmText(e.target.value)}
              autoComplete="off"
              disabled={deletingAccount}
              placeholder="SLETT"
              className="w-full rounded-lg px-3 py-2.5 text-sm border border-[#EBEBE6] bg-[#FFFFFF] focus:outline-none disabled:opacity-60"
              style={{ color: '#1A1A1A', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}
            />
            {deleteAccountError && (
              <div className="rounded-xl px-4 py-3 text-sm mt-4" style={{ background: '#F5F5F0', color: '#c0392b', border: '1px solid rgba(192,57,43,0.25)' }}>
                {deleteAccountError}
              </div>
            )}
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={closeDeleteAccountModal}
                disabled={deletingAccount}
                onMouseDown={(e) => { if (deletingAccount) return; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                className="rounded-full px-4 py-2 text-sm border border-[#EBEBE6] bg-[#FFFFFF] disabled:opacity-50"
                style={{ color: '#1A1A1A', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={confirmDeleteAccount}
                disabled={deletingAccount || deleteAccountConfirmText !== 'SLETT'}
                onMouseDown={(e) => { if (deletingAccount || deleteAccountConfirmText !== 'SLETT') return; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                className={`rounded-full px-4 py-2 text-sm text-white inline-flex items-center gap-2${deletingAccount || deleteAccountConfirmText !== 'SLETT' ? ' opacity-50 cursor-not-allowed' : ''}`}
                style={{ background: '#C0392B', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
              >
                {deletingAccount ? <Loader2 size={14} className="animate-spin" /> : null}
                Slett konto permanent
              </button>
            </div>
          </div>
        </div>
      )}

      {showDisconnectConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Lukk"
            onClick={() => { if (!isDisconnecting) { setShowDisconnectConfirm(false); setDisconnectError(null); } }}
            disabled={isDisconnecting}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm disabled:cursor-wait"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-[#EBEBE6] bg-[#FFFFFF] shadow-2xl p-6">
            <h3 className="text-base font-semibold mb-2" style={{ color: '#1A1A1A' }}>
              {hostIsWix ? 'Koble fra Wix?' : 'Koble fra WordPress?'}
            </h3>
            <p className="text-sm" style={{ color: '#808080' }}>
              {hostIsWix
                ? 'Sikt husker ikke lenger at du bruker Wix. Du kan koble til på nytt når som helst.'
                : 'Sikt kan ikke lenger gjøre endringer på siden din. Du kan koble til på nytt når som helst.'}
            </p>
            {!hostIsWix && (
              <p className="text-sm mt-3 mb-4" style={{ color: '#808080' }}>
                Tips: Application Password-et i WordPress er fortsatt aktivt etter at du kobler fra her. Hvis du vil fjerne det helt, gå til Brukere → Profil → Application Passwords i WordPress og klikk Revoke.
              </p>
            )}
            {hostIsWix && <div className="mb-4" />}
            {disconnectError && (
              <div className="rounded-xl px-4 py-3 text-sm mb-4" style={{ background: '#F5F5F0', color: '#c0392b', border: '1px solid #EBEBE6' }}>
                {disconnectError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowDisconnectConfirm(false); setDisconnectError(null); }}
                disabled={isDisconnecting}
                onMouseDown={(e) => { if (isDisconnecting) return; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                className="rounded-full px-4 py-2 text-sm border border-[#EBEBE6] bg-[#FFFFFF] disabled:opacity-50"
                style={{ color: '#1A1A1A', transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={hostIsWix ? disconnectWixAdvisory : disconnectWordPress}
                disabled={isDisconnecting}
                onMouseDown={(e) => { if (isDisconnecting) return; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                className={`rounded-full px-4 py-2 text-sm border border-[#1A1A1A] bg-[#1A1A1A] text-white inline-flex items-center gap-2${isDisconnecting ? ' opacity-50 cursor-not-allowed' : ''}`}
                style={{ transition: 'transform 140ms cubic-bezier(0.23,1,0.32,1), opacity 160ms cubic-bezier(0.23,1,0.32,1)' }}
              >
                {isDisconnecting ? <Loader2 size={14} className="animate-spin" /> : null}
                Koble fra
              </button>
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

const LOADING_STATUS_MESSAGES = [
  'Klargjør portalen din',
  'Henter dine SEO-data',
  'Verifiserer tilgang',
  'Nesten klar',
] as const;

function SiktLoadingScreen() {
  const [statusIndex, setStatusIndex] = useState(0);
  const [statusOpacity, setStatusOpacity] = useState(1);

  useEffect(() => {
    let fadeTimeout: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      setStatusOpacity(0);
      fadeTimeout = setTimeout(() => {
        setStatusIndex((i) => (i + 1) % LOADING_STATUS_MESSAGES.length);
        setStatusOpacity(1);
      }, 500);
    }, 2200);
    return () => {
      clearInterval(interval);
      if (fadeTimeout) clearTimeout(fadeTimeout);
    };
  }, []);

  return (
    <div
      className="sikt-loading-screen fixed inset-0 z-[100] bg-[#F5F5F0] flex flex-col items-center justify-center overflow-hidden"
      style={{ animation: 'sikt-loader-fade-in 400ms cubic-bezier(0.23, 1, 0.32, 1) forwards', opacity: 0 }}
    >
      <span className="absolute top-5 left-6 text-xl font-black tracking-tight text-slate-900">Sikt.</span>

      <div className="flex flex-col items-center gap-[30px] px-6 max-w-lg w-full">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tighter text-slate-950 leading-tight text-center max-w-md mx-auto">
          Ranger høyere på Google{' '}
          <span className="font-script font-normal text-violet-600 lowercase">automatisk.</span>
        </h1>

        <div className="relative w-[200px] h-[2px] bg-[#EBEBE6] rounded-full overflow-hidden">
          <div className="sikt-loading-sweep h-full w-[35%] bg-[#1A1A1A] rounded-full" />
        </div>

        <p
          aria-live="polite"
          className="text-[13px] font-semibold text-[#808080] min-h-[1.25rem] text-center"
          style={{
            opacity: statusOpacity,
            transition: 'opacity 500ms cubic-bezier(0.23, 1, 0.32, 1)',
          }}
        >
          {LOADING_STATUS_MESSAGES[statusIndex]}
        </p>
      </div>
    </div>
  );
}

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
  const _sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const isPaymentSuccess = !!_sp && (_sp.get('payment_success') === 'true' || _sp.get('payment') === 'success');
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
  const [view, setView] = useState('home');
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
        const savedPlan = localStorage.getItem('sikt_pending_plan');
        if (savedPlan) {
          setSelectedPlan(savedPlan);
        }

        const fetchClientRow = async (): Promise<{
          onboarding_completed?: boolean;
          package_name?: string;
          subscription_status?: string;
        } | null> => {
          try {
            const rows = await supabaseRest<any[]>(
              `clients?user_id=eq.${user.id}&select=onboarding_completed,package_name,subscription_status&limit=1`,
            );
            return Array.isArray(rows) && rows.length ? rows[0] : null;
          } catch (e: any) {
            console.error('[Routing] Kunne ikke hente client:', e?.message || e);
            return null;
          }
        };

        if (justPaid) setIsLoading(true);

        let client = await fetchClientRow();
        if (justPaid && client?.subscription_status !== 'active') {
          const pollIntervalMs = 2000;
          const pollMaxMs = 10000;
          let waitedMs = 0;
          while (client?.subscription_status !== 'active' && waitedMs < pollMaxMs) {
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
            waitedMs += pollIntervalMs;
            if (!isMounted) return;
            client = await fetchClientRow();
          }
        }

        if (!isMounted) return;

        if (justPaid && client?.subscription_status !== 'active') {
          setHasAccess(false);
          setView('home');
          toastWarning(
            'Betaling ikke bekreftet ennå. Vent litt og oppdater siden, eller kontakt support@siktseo.com hvis problemet vedvarer.',
          );
          return;
        }

        const harBetalt = client?.subscription_status === 'active';
        const harFyltUtSkjema = !!client?.onboarding_completed;

        // --- DEN PERMANENTE RUTINGEN DIN ---
        // Tilgang (harBetalt) krever subscription_status === 'active' fra Stripe-webhooken.

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
      <SiktLoadingScreen />
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
    <div className="min-h-screen selection:bg-[#EBEBE6] selection:text-[#1A1A1A] bg-[#F5F5F0] relative overflow-x-hidden">
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
