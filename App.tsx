import { GoogleSnippetPreview } from './src/shared/GoogleSnippetPreview';
import { RevealOnScroll } from './src/shared/RevealOnScroll';
import { PrimaryButton, SecondaryButton } from './src/shared/Buttons';
import { Pricing } from './src/shared/Pricing';
import { Navbar } from './src/shared/Navbar';
import { Footer } from './src/shared/Footer';
import { PrivacyPage, TermsPage } from './src/shared/Legal';
import { buildStripeCheckoutUrl } from './src/shared/stripeLinks';

import { CodeIntegrationStep } from './CodeIntegrationStep';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { toastInfo, toastSuccess, toastError, toastWarning } from './src/toast';
import { track } from './src/analytics';
import { UsageStat } from './src/shared/trustStats';
import { StickyCta } from './src/components/marketing/StickyCta';
import { ProductPreview } from './src/pages/home/ProductPreview';
import { ProblemSection } from './src/pages/home/ProblemSection';
import { WhySiktSection } from './src/pages/home/WhySiktSection';
import { IndustriesSection as HomeIndustriesSection } from './src/pages/home/IndustriesSection';
import { StepPlanSection as HomeStepPlanSection } from './src/pages/home/StepPlanSection';
import { TrustSection as HomeTrustSection } from './src/pages/home/TrustSection';
import { FaqSection as HomeFaqSection } from './src/pages/home/FaqSection';
import { FinalCta } from './src/pages/home/FinalCta';
import { supabaseRest, getStoredAccessToken } from './src/supabaseRest';
import {
  ArrowRight, Timer, ArrowDown, Eye, Trophy, Sun, BarChart2, Map as MapIcon, Users, Key, Check, Search, Zap, Target, ChevronDown, Menu, X, Sparkles, CalendarClock,
  MousePointer2, TrendingUp, Cpu, Globe, Activity, ArrowUpRight, User, MonitorCheck, Code2, PenTool,
  SearchIcon, TrendingDown, ImageIcon, ShoppingBag, Clock, AlertTriangle, MessageCircle, HelpCircle, LayoutDashboard, FileText, Link2,
  Home, Linkedin, Twitter, Mail, ShieldCheck, Wrench, Globe2, Stars, Frown, Radar, FileBarChart, AlertOctagon,
  Layers, Minus, BarChart3, GitMerge, Rocket, Shield, Lightbulb, Monitor, HeartHandshake, Lock, ChevronRight,
  BrainCircuit, Moon, BarChart4, CalendarDays, Award, Unlink, SearchCheck, Database, Server, LogOut, Coffee, Save, XCircle, AlertCircle, Edit2, ChevronsUpDown,
  Settings, Smartphone, ChevronLeft, ArrowUp, ArrowUpCircle, ArrowDownCircle, ShieldAlert, CreditCard, FileEdit, RefreshCw, LifeBuoy, Loader2, Trash2, Briefcase, Download, CheckCircle2, ArrowLeft, CheckCircle, Copy, ExternalLink, Circle,
  ClipboardCheck, Bell, Sparkle, Bot, Microscope, Send, Plus, Info, PhoneIncoming, Coins, Gauge, Type, Star, MessageSquare, QrCode
} from 'lucide-react';
import { gsap } from 'gsap';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// --- LAZY SUPABASE ---
// Supabase-SDK-en (~206 KB) trengs kun ved innlogging/auth, ikke for å rendre
// forsiden. Vi importerer den derfor dynamisk slik at supabase-chunken IKKE blir
// en statisk avhengighet av App-chunken (og dermed holdes ute av forsidens
// første lastebølge). Klienten memoiseres så den kun opprettes én gang.
let _supabasePromise: Promise<typeof import('./supabaseClient')['supabase']> | null = null;
const getSupabase = () => (_supabasePromise ??= import('./supabaseClient').then((m) => m.supabase));


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



// --- DATAMODELL FOR LENKER ---

// --- OPPDATERT DATAMODELL ---
const ClientPortal = React.lazy(() => import('./src/portal/ClientPortal'));

// --- TOOLTIP KOMPONENT (Enkle forklaringer) ---
const InfoHint = ({ text }: { text: string }) => (
  <div className="group relative inline-flex ml-1.5 cursor-help">
    <div className="text-[#5C574C] hover:text-white transition-colors opacity-50 hover:opacity-100">
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
  try {
    const supabase = await getSupabase();
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








// --- TYPESCRIPT DEFINISJONER (Lim inn dette øverst i filen) ---


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

// Telefon-breakpoint (≤ 640px = Tailwind `sm`). Brukes til å gjøre inline-style-
// seksjoner responsive der Tailwind-breakpoints ikke kan brukes (grids/padding).

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
          stroke="#15795A"
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
        <p className="text-[11px] tracking-[3px] uppercase font-bold text-[#52A447] mb-6 font-display">
          SIKT-TEKNOLOGIEN
        </p>
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white leading-[1.08] tracking-tight mb-4">
          {headlineWords.map((word, i) => (
            <span key={i} className="tech-hero-word inline-block mr-[0.28em]">
              {word}
            </span>
          ))}
          <br />
          <span className="tech-hero-word inline-block font-script font-normal italic text-[#52A447] text-3xl sm:text-4xl md:text-5xl mt-2">
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
            <p className="text-sm font-bold text-[#52A447] mt-2">+12 denne måneden</p>
          </div>

          <div className="mt-4 h-5 flex items-center justify-center gap-2 overflow-hidden">
            <span className="w-1.5 h-1.5 rounded-full bg-[#52A447] shrink-0 animate-pulse" />
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
    <section ref={sectionRef} className="tech-chapter-1 relative bg-[#F2EFE8]" style={{ minHeight: reducedMotion ? 'auto' : '220vh' }}>
      <div ref={pinRef} className="min-h-screen flex flex-col items-center justify-center px-5 py-20">
        <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-14">
          <p className="text-[11px] tracking-[3px] uppercase font-bold text-[#5C574C] mb-4 font-display">01 — RØNTGENSYNET</p>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl md:text-5xl text-[#111111] leading-tight tracking-tight mb-5">
            Hver linje. Hvert bilde. Hver feil.
          </h2>
          <p className="text-base sm:text-lg text-[#5C574C] leading-relaxed max-w-2xl mx-auto">
            Sikt leser nettsiden din fra topp til bunn — titler, tekster, lenker, hastighet, mobilvisning og over 200 andre faktorer Google bruker. Mens du scroller, ser du skanningen skje.
          </p>
        </div>

        <div className="relative w-full max-w-lg mx-auto">
          <div className="rounded-2xl bg-white border border-[#E9E4DA] overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E9E4DA] bg-[#FAFAF8]">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F09595]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#FAC775]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#97C459]" />
              </div>
              <span className="text-xs text-[#5C574C] font-mono flex-1 text-center truncate">dinbedrift.no</span>
            </div>
            <div ref={mockupBodyRef} className="relative p-5 sm:p-6 space-y-3 min-h-[220px] sm:min-h-[260px]">
              <div ref={blockTitleRef} className="h-4 w-3/4 rounded" style={{ backgroundColor: '#FAEEDA' }} />
              <div className="h-3 w-full rounded bg-[#F2EFE8]" />
              <div className="h-3 w-5/6 rounded bg-[#F2EFE8]" />
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div ref={blockImg1Ref} className="h-20 rounded-lg" style={{ backgroundColor: '#EEEDFE' }} />
                <div ref={blockImg2Ref} className="h-20 rounded-lg" style={{ backgroundColor: '#F0F0EB' }} />
              </div>
              <div className="h-16 rounded-lg bg-[#F2EFE8]" />
              <div
                ref={scanlineRef}
                className="absolute left-0 right-0 top-0 h-0.5 bg-[#15795A] pointer-events-none z-20"
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
            <Sparkles size={14} className="text-[#15795A] shrink-0" />
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
          <p className="text-[11px] tracking-[3px] uppercase font-bold text-[#52A447] mb-4 font-display">DET MASKINEN LESER</p>
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
                    <Icon size={20} className="text-[#52A447]" />
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
        <p className="text-[11px] tracking-[3px] uppercase font-bold text-[#5C574C] mb-4 font-display text-center">02 — EKTE DATA</p>
        <h2 className="font-display font-extrabold text-3xl sm:text-4xl md:text-5xl text-[#111111] text-center leading-tight tracking-tight mb-5">
          Koblet rett på Google.
        </h2>
        <p className="text-base sm:text-lg text-[#5C574C] text-center leading-relaxed mb-12 max-w-2xl mx-auto">
          Søkeordene kundene dine faktisk skriver — med klikk, visninger og posisjon — rett fra Google Search Console. Du ser nøyaktig hvor du klatrer, uke for uke.
        </p>

        <div className="rounded-2xl bg-white border border-[#E9E4DA] overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-[#E9E4DA] text-[10px] font-bold uppercase tracking-wider text-[#5C574C]">
            <span>Søkeord</span>
            <span className="text-right w-14">Klikk</span>
            <span className="text-right w-16">Visn.</span>
            <span className="text-right w-10">Pos.</span>
          </div>
          {TECH_KEYWORDS.map((row, rowIdx) => (
            <div
              key={row.keyword}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-4 border-b border-[#E9E4DA] last:border-0 items-center text-sm"
            >
              <span className="font-medium text-[#111111] truncate">{row.keyword}</span>
              <span className="text-right w-14 font-bold tabular-nums text-[#111111]">
                <span ref={(el) => { counterRefs.current[rowIdx * 3] = el; }}>{reducedMotion ? row.clicks : 0}</span>
              </span>
              <span className="text-right w-16 font-bold tabular-nums text-[#111111]">
                <span ref={(el) => { counterRefs.current[rowIdx * 3 + 1] = el; }}>{reducedMotion ? row.impressions : 0}</span>
              </span>
              <span className={`text-right w-10 font-bold tabular-nums flex items-center justify-end gap-0.5 ${row.color === 'green' ? 'text-emerald-600' : 'text-[#15795A]'}`}>
                <span ref={(el) => { counterRefs.current[rowIdx * 3 + 2] = el; }}>{reducedMotion ? row.position : 0}</span>
                <ArrowUp size={12} />
              </span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[#5C574C] mt-4 text-center">
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
        <p className="text-[11px] tracking-[3px] uppercase font-bold text-[#52A447] mb-4 font-display text-center">03 — HJERNEN</p>
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
                <Sparkles size={16} className="text-[#52A447] shrink-0 mt-0.5" />
                <p ref={aiTextRef} className="text-sm text-[#e9e2ff] leading-relaxed">
                  {TECH_AI_RESPONSE.slice(0, typedLen)}
                  {showCaret && <span className="inline-block w-0.5 h-4 bg-[#52A447] ml-0.5 align-middle animate-pulse" />}
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
        <p className="tech-ch4-reveal text-[11px] tracking-[3px] uppercase font-bold text-[#52A447] mb-4 font-display text-center" style={{ opacity: reducedMotion ? 1 : 0.25 }}>
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
            <span className="text-[#52A447] font-bold">din bedrift</span>
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
  { icon: PhoneIncoming, color: '#15795A', title: 'Henvendelser fra Google', desc: 'Folk som finner deg selv, har allerede bestemt seg.' },
  { icon: Coins, color: '#15795A', title: 'Mindre annonseavhengighet', desc: 'Organisk synlighet jobber uten klikkbudsjett.' },
  { icon: Clock, color: '#BA7517', title: 'Tid tilbake', desc: 'Maskinen overvåker og forklarer — du driver bedriften.' },
  { icon: ShieldCheck, color: '#185FA5', title: 'Ro i magen', desc: 'Du vet at noen følger med på siden din, døgnet rundt.' },
  { icon: MessageCircle, color: '#15795A', title: 'Svar når du lurer', desc: 'Spør Sikt AI og få forklaringer på norsk, med én gang.' },
  { icon: Rocket, color: '#15795A', title: 'Klar for AI-søk', desc: 'Bygget for der søk skjer i morgen, ikke bare i dag.' },
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
    <section ref={sectionRef} className="relative bg-[#F2EFE8] px-5 pt-20 sm:pt-32 pb-12">
      <div className="max-w-4xl mx-auto">
        <p className="text-[11px] tracking-[3px] uppercase font-bold text-[#5C574C] mb-4 font-display text-center">05 — RESULTATET</p>
        <h2 className="font-display font-extrabold text-3xl sm:text-4xl md:text-5xl text-[#111111] text-center leading-tight tracking-tight mb-5">
          Se for deg om seks måneder.
        </h2>
        <p className="text-base sm:text-lg text-[#5C574C] text-center leading-relaxed mb-12 max-w-2xl mx-auto">
          Kundene finner deg — ikke konkurrenten. Telefonen ringer fra folk som allerede har bestemt seg. Og du vet nøyaktig hvorfor, fordi tallene står i dashboardet ditt.
        </p>

        <div
          className="max-w-xl mx-auto mb-12 rounded-2xl bg-white pt-[22px] px-5 pb-3.5"
          style={{ border: '0.5px solid #E9E4DA' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <span className="text-xs font-medium text-[#1A1A1A]">Synlighet i Google</span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[10px] text-[#5C574C]">
                <span className="w-3.5 h-0.5 rounded-full bg-[#52A447]" />
                Visninger
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-[#5C574C]">
                <span className="w-3.5 h-0.5 rounded-full bg-[#15795A]" />
                Klikk
              </span>
            </div>
          </div>

          <svg viewBox="0 0 460 200" className="w-full" aria-hidden="true">
            {[20, 60, 100, 140, 170].map((y) => (
              <line key={y} className="tech-ch5-grid" x1="40" y1={y} x2="440" y2={y} stroke="#F0F0EB" strokeWidth="1" />
            ))}
            <text className="tech-ch5-axis" x="12" y="23" fill="#8A8578" fontSize="9">2k</text>
            <text className="tech-ch5-axis" x="10" y="103" fill="#8A8578" fontSize="9">1k</text>
            <text className="tech-ch5-axis" x="14" y="173" fill="#8A8578" fontSize="9">0</text>
            <text className="tech-ch5-axis" x="34" y="188" fill="#8A8578" fontSize="9">Mnd 1</text>
            <text className="tech-ch5-axis" x="100" y="188" fill="#8A8578" fontSize="9">2</text>
            <text className="tech-ch5-axis" x="166" y="188" fill="#8A8578" fontSize="9">3</text>
            <text className="tech-ch5-axis" x="232" y="188" fill="#8A8578" fontSize="9">4</text>
            <text className="tech-ch5-axis" x="298" y="188" fill="#8A8578" fontSize="9">5</text>
            <text className="tech-ch5-axis" x="424" y="188" fill="#8A8578" fontSize="9">Mnd 6</text>

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
              stroke="#15795A"
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

          <p className="text-right text-[9px] text-[#8A8578] mt-2">
            Illustrasjon av et typisk forløp — resultater varierer
          </p>
        </div>

        <div className="tech-ch5-compare mt-16 sm:mt-20">
          <h3 className="font-display font-bold text-lg text-[#1A1A1A] text-center mb-6">
            Hverdagen, før og med Sikt
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="tech-ch5-before rounded-2xl bg-white border border-[#E9E4DA] p-5 sm:p-6">
              <p className="text-[11px] tracking-wide uppercase text-[#5C574C] mb-4">Uten</p>
              <ul className="space-y-4">
                {TECH_BEFORE_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.text} className="flex items-start gap-3">
                      <Icon size={16} className="shrink-0 mt-0.5 text-[#8A8578]" />
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
                className="tech-ch5-outcome rounded-2xl bg-white border border-[#E9E4DA] p-4 sm:p-5"
                style={{ opacity: reducedMotion ? 1 : 0 }}
              >
                <div
                  className="tech-ch5-outcome-icon mb-3"
                  style={{ transform: reducedMotion ? 'scale(1)' : 'scale(0.8)' }}
                >
                  <Icon size={18} style={{ color: card.color }} />
                </div>
                <p className="text-[13px] font-medium text-[#1A1A1A] leading-snug mb-1">{card.title}</p>
                <p className="text-[11px] text-[#5C574C] leading-relaxed">{card.desc}</p>
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
        onClick={() => { track('cta_click', { location: 'tech_cta', target: 'login' }); onNavigate('login'); }}
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
      <div className="max-w-6xl mx-auto px-5 sm:px-6 text-center relative z-10">
        <RevealOnScroll direction="up" delay={200}>
          <h1 className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter text-[#1A1A1A] mb-6 sm:mb-10 max-w-5xl mx-auto leading-[1.1] md:leading-[0.9]">
            Ranger høyere på Google <span className="text-violet-600 font-script font-normal relative inline-block px-1 lowercase">automatisk.</span>
          </h1>
        </RevealOnScroll>
        <RevealOnScroll direction="up" delay={300}>
          <p className="text-sm sm:text-lg md:text-xl mb-10 sm:mb-14 max-w-2xl mx-auto leading-relaxed font-semibold tracking-tight text-[#5C574C] px-2">
            For bedrifter som vil bli mer synlige og få flere kunder gjennom Google.
          </p>
        </RevealOnScroll>
        <RevealOnScroll direction="scale" delay={400}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#gratis-analyse" onClick={() => track('cta_click', { location: 'hero', target: 'free_analysis' })} className="group w-full sm:w-auto px-10 py-4 sm:px-12 sm:py-5 bg-[#1A1A1A] text-white rounded-full text-base sm:text-lg font-black tracking-tight ui-motion ui-lift flex items-center justify-center gap-3 shadow-xl shadow-[rgba(26,26,26,0.08)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-700 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-2xl [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-violet-500/20">
              Sjekk siden din gratis <ArrowRight size={22} className="transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1.5" />
            </a>
            <a href="#priser" onClick={() => track('cta_click', { location: 'hero', target: 'pricing' })} className="group w-full sm:w-auto px-10 py-4 sm:px-12 sm:py-5 bg-white text-[#1A1A1A] border border-[#E9E4DA] rounded-full text-base sm:text-lg font-black tracking-tight ui-motion ui-lift flex items-center justify-center gap-3 shadow-sm [@media(hover:hover)_and_(pointer:fine)]:hover:border-violet-300 [@media(hover:hover)_and_(pointer:fine)]:hover:text-violet-700">
              Se priser
            </a>
          </div>
        </RevealOnScroll>
        {/* Sanne trygghetssignaler — kun verifiserbare påstander (ingen falske logoer/anmeldelser).
            UsageStat vises kun når audit-tallet er ekte og stort nok (gated) — ellers usynlig,
            så raden ser nøyaktig ut som før til da. */}
        <RevealOnScroll direction="up" delay={500}>
          <div className="mt-7 sm:mt-10 flex flex-col items-center gap-4 sm:gap-5">
            <UsageStat tone="light" />
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs sm:text-sm font-bold text-[#5C574C]">
              {['Ingen binding', 'Data lagres i EU', 'Plain norsk', 'Gratis å teste'].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <Check size={15} className="text-[#15795A]" /> {t}
                </span>
              ))}
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
};

// --- DEEP DIVE (GEO) COMPONENTS ---

const DeepDiveHero = () => (
  <section className="relative pt-24 pb-12 md:pt-48 md:pb-32 overflow-hidden bg-white/40">
    <div className="max-w-4xl mx-auto px-5 text-center relative z-10">
      <RevealOnScroll direction="down">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F2EFE8] text-[#1A1A1A] text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mb-4 sm:mb-6 border border-[#E9E4DA]">
          <Check size={11} />
          <span>Din vei til toppen</span>
        </div>
        <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-[#1A1A1A] mb-6 sm:mb-8 leading-[1.05] tracking-tight">
          Fra Usynlig til <br className="hidden sm:block" />
          <span className="text-[#1A1A1A]">Markedsledende.</span>
        </h1>
        <p className="text-base sm:text-lg md:text-2xl text-[#5C574C] font-medium leading-relaxed max-w-2xl mx-auto mb-10">
          Å se på prosessen ware er det første steget. <span className="text-[#1A1A1A] font-bold underline decoration-[#E9E4DA]">Google-dominans</span> er matematikk og AI i samspill.
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
              <div className="text-4xl sm:text-5xl md:text-7xl font-black text-rose-500 shrink-0">9/10</div>
              <div>
                <h4 className="text-lg sm:text-xl font-bold mb-1 sm:mb-2">får nær null trafikk.</h4>
                <p className="text-sm sm:text-base text-[#5C574C] font-medium leading-relaxed">De fleste nettsider er en digital fasade nesten ingen finner via Google.</p>
              </div>
            </div>
            <div className="flex gap-4 sm:gap-6 items-start">
              <div className="text-4xl sm:text-5xl md:text-7xl font-black text-[#1A1A1A] shrink-0">Side 1</div>
              <div>
                <h4 className="text-lg sm:text-xl font-bold mb-1 sm:mb-2">er alt som teller.</h4>
                <p className="text-sm sm:text-base text-[#5C574C] font-medium leading-relaxed">Nesten ingen blar til side 2 på Google — er du ikke der oppe, mister du kunden.</p>
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
            <p className="text-sm sm:text-base md:text-lg text-[#5C574C] leading-relaxed mb-6 sm:mb-8 font-medium">
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
          <p className="text-sm sm:text-lg text-[#5C574C] max-w-2xl mx-auto font-medium leading-relaxed">Vi bruker kraftige AI-modeller for å utkonkurrere markedet.</p>
        </RevealOnScroll>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 items-center">
        <RevealOnScroll direction="left">
          <div className="space-y-6 sm:space-y-8">
            <div className="group">
              <div className="flex items-center gap-4 mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#F2EFE8] rounded-xl sm:rounded-2xl flex items-center justify-center text-[#1A1A1A] [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-violet-700 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-white transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] shrink-0">
                  <Cpu size={20} />
                </div>
                <h3 className="text-lg sm:text-xl font-bold">Autonome Analyser</h3>
              </div>
              <p className="text-sm sm:text-base text-[#5C574C] pl-14 sm:pl-16 font-medium leading-relaxed">Våre modeller skanner algoritme-endringer i sanntid og utfører 1000x flere beregninger.</p>
            </div>
            <div className="group">
              <div className="flex items-center gap-4 mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#F2EFE8] rounded-xl sm:rounded-2xl flex items-center justify-center text-[#1A1A1A] [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-violet-700 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-white transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] shrink-0">
                  <Zap size={20} />
                </div>
                <h3 className="text-lg sm:text-xl font-bold">Lynrask Implementering</h3>
              </div>
              <p className="text-sm sm:text-base text-[#5C574C] pl-14 sm:pl-16 font-medium leading-relaxed">Vi identifiserer tekniske hull på sekunder og genererer optimalisert innhold umiddelbart.</p>
            </div>
          </div>
        </RevealOnScroll>
        <RevealOnScroll direction="right">
          <div className="p-1.5 sm:p-2 bg-[#1A1A1A] rounded-[28px] sm:rounded-[40px] shadow-2xl mt-8 md:mt-0">
            <div className="bg-white rounded-[24px] sm:rounded-[34px] p-6 sm:p-8 border border-[#E9E4DA]">
              <div className="flex justify-between items-center mb-6 sm:mb-8">
                <div className="text-sm sm:text-base font-black text-[#1A1A1A] uppercase">AI Prosessering</div>
                <div className="text-[8px] sm:text-xs bg-[#F2EFE8] text-[#1A1A1A] px-2 py-1 rounded-full font-bold">Aktiv</div>
              </div>
              <div className="space-y-4 sm:space-y-6">
                {[
                  { label: "Søkeordsdybde", val: "98%" },
                  { label: "Overvåkning", val: "24/7" },
                  { label: "Innholds-skår", val: "9.2/10" }
                ].map((stat, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-[9px] sm:text-xs font-bold text-[#5C574C] mb-1.5 sm:mb-2 uppercase tracking-widest">{stat.label}<span>{stat.val}</span></div>
                    <div className="h-1.5 sm:h-2 bg-[#F2EFE8] rounded-full overflow-hidden">
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



// Plattform-valg i onboarding. id-ene MÅ matche client_hosts.platform-id-ene
// (FULL_PLATFORMS/ADVISORY_PLATFORMS i ClientPortal) + solve-problem-logikken.
const SITE_PLATFORMS: { id: string; label: string }[] = [
  { id: 'wordpress', label: 'WordPress' },
  { id: 'shopify', label: 'Shopify' },
  { id: 'webflow', label: 'Webflow' },
  { id: 'wix', label: 'Wix' },
  { id: 'squarespace', label: 'Squarespace' },
  { id: 'ghost', label: 'Ghost' },
  { id: 'ai_built', label: 'Bygd med AI (Claude, Cursor, v0, Lovable …)' },
  { id: 'other', label: 'Annet / egen side' },
];

const OnboardingPage = ({ onComplete, user }: { onComplete: () => void, user: any }) => {
  const [loading, setLoading] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(true);
  const [websiteUrlStatus, setWebsiteUrlStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');

  const [formData, setFormData] = useState({
    companyName: '', contactPerson: '', email: '', phone: '',
    websiteUrl: '', industry: '', targetAudience: '', platform: ''
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
      // URL fra gratis-analysen på forsiden — friksjonsfri overgang til konto.
      let auditUrl = '';
      try { auditUrl = (localStorage.getItem('sikt_audit_url') || '').trim(); } catch { /* ignore */ }
      try {
        const rows = await supabaseRest<any[]>(
          `clients?user_id=eq.${user.id}&select=company_name,contact_person,email,phone,website_url,industry,target_audience,platform&limit=1`,
        );
        if (cancelled) return;
        const existing = Array.isArray(rows) && rows.length ? rows[0] : null;
        if (existing) {
          setFormData({
            companyName: existing.company_name || '',
            contactPerson: existing.contact_person || '',
            email: existing.email || user.email || '',
            phone: existing.phone || '',
            websiteUrl: existing.website_url || auditUrl || '',
            industry: existing.industry || '',
            targetAudience: existing.target_audience || '',
            platform: existing.platform || '',
          });
        } else if (user.email || auditUrl) {
          // Førstegangs-bruker: preutfyll e-post fra Google + URL fra gratis-analysen
          setFormData(prev => ({ ...prev, email: user.email || prev.email, websiteUrl: auditUrl || prev.websiteUrl }));
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
          platform: latest.platform || null,
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
        const supabase = await getSupabase();
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
        target_audience: formData.targetAudience,
        platform: formData.platform
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
    <section className="min-h-screen bg-[#F2EFE8] py-20 px-5 flex items-center justify-center">
      <div className="max-w-3xl w-full bg-white rounded-[32px] shadow-2xl p-8 sm:p-12 relative z-10 border border-[#E9E4DA]">
        <h1 className="text-3xl font-black text-[#1A1A1A] mb-2">Fortell oss om din <span className="text-[#1A1A1A]">bedrift</span></h1>
        <p className="text-sm text-[#5C574C] mb-8">
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
            <input required name="companyName" value={formData.companyName} onChange={handleChange} onBlur={handleBlur} placeholder="Bedriftsnavn" className="w-full p-4 bg-[#F2EFE8] rounded-xl border border-[#E9E4DA] focus:ring-2 focus:ring-[#5C574C]/25 outline-none" />
            <input required name="contactPerson" value={formData.contactPerson} onChange={handleChange} onBlur={handleBlur} placeholder="Kontaktperson" className="w-full p-4 bg-[#F2EFE8] rounded-xl border border-[#E9E4DA] focus:ring-2 focus:ring-[#5C574C]/25 outline-none" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <input required type="email" name="email" value={formData.email} onChange={handleChange} onBlur={handleBlur} placeholder="E-post" className="w-full p-4 bg-[#F2EFE8] rounded-xl border border-[#E9E4DA] focus:ring-2 focus:ring-[#5C574C]/25 outline-none" />
            <input required type="tel" name="phone" value={formData.phone} onChange={handleChange} onBlur={handleBlur} placeholder="Telefon" className="w-full p-4 bg-[#F2EFE8] rounded-xl border border-[#E9E4DA] focus:ring-2 focus:ring-[#5C574C]/25 outline-none" />
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
                className={`w-full p-4 pr-11 bg-[#F2EFE8] rounded-xl border ${websiteUrlStatus === 'valid' ? 'border-[#5C574C]' : websiteUrlStatus === 'invalid' ? 'border-rose-300' : 'border-[#E9E4DA]'} focus:ring-2 focus:ring-[#5C574C]/25 outline-none`}
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

          <div>
            <select
              required
              name="platform"
              value={formData.platform}
              onChange={(e) => { const v = e.target.value; setFormData(prev => { const next = { ...prev, platform: v }; saveDraft(next); return next; }); }}
              className={`w-full p-4 bg-[#F2EFE8] rounded-xl border border-[#E9E4DA] focus:ring-2 focus:ring-[#5C574C]/25 outline-none ${formData.platform ? 'text-[#1A1A1A]' : 'text-[#5C574C]'}`}
            >
              <option value="" disabled>Hvilken plattform er siden bygd på?</option>
              {SITE_PLATFORMS.map((p) => (
                <option key={p.id} value={p.id} className="text-[#1A1A1A]">{p.label}</option>
              ))}
            </select>
            <p className="text-xs text-[#5C574C] mt-2">Bygde du siden med et AI-verktøy (Claude, Cursor, v0 …)? Velg «Bygd med AI» — da får du ferdige prompts du kan lime rett inn.</p>
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
              className="w-full p-4 bg-[#F2EFE8] rounded-xl border border-[#E9E4DA] focus:ring-2 focus:ring-[#5C574C]/25 outline-none"
            />

            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-50 w-full bg-white border border-[#E9E4DA] rounded-xl mt-1 max-h-60 overflow-y-auto shadow-lg">
                {suggestions.map((suggestion, index) => (
                  <li
                    key={index}
                    onClick={() => handleSelectIndustry(suggestion)}
                    className="p-3 hover:bg-[#F2EFE8] cursor-pointer text-[#1A1A1A] transition-colors"
                  >
                    {suggestion}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <textarea required name="targetAudience" value={formData.targetAudience} rows={3} onChange={handleChange} onBlur={handleBlur} placeholder="Målgruppe (Hvem ønsker du å nå?)" className="w-full p-4 bg-[#F2EFE8] rounded-xl border border-[#E9E4DA] focus:ring-2 focus:ring-[#5C574C]/25 outline-none" />

          <button
            type="submit"
            disabled={loading || websiteUrlStatus === 'invalid'}
            className="w-full py-5 bg-violet-700 text-white rounded-xl font-bold text-lg transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-xl disabled:opacity-50 enabled:hover:bg-violet-600 active:enabled:scale-[0.98]"
          >
            {loading ? 'Lagrer data...' : 'Fullfør registrering →'}
          </button>
        </form>
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
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/70 text-[10px] sm:text-xs font-bold mb-6 sm:mb-8 uppercase tracking-widest">
              <BrainCircuit size={13} />
              <span>Både Google og AI</span>
            </div>

            <h2 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight mb-4 sm:mb-6 leading-[1.1] sm:leading-[1.05]">
              Google er ikke <span className="text-violet-300">alene</span> lenger.
              <br className="hidden sm:block" />
              <span className="sm:hidden"> </span>Kundene spør også ChatGPT.
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed font-medium px-2">
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
                  <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                    <SearchIcon size={16} className="text-white/60" />
                  </div>
                  <span className="text-xs uppercase tracking-widest text-white/60 font-bold">Google</span>
                </div>
                <span className="text-[9px] uppercase tracking-wider text-[#1A1A1A] font-black bg-white px-2 py-0.5 rounded-full">Fortsatt viktig</span>
              </div>

              <div className="bg-white/10 rounded-xl p-4 mb-5 border border-white/5">
                <p className="text-sm text-white/80 italic">"Beste SEO-byrå Oslo"</p>
              </div>

              {/* Fake søkeresultater */}
              <div className="space-y-3">
                <div className="flex items-start gap-2 opacity-70">
                  <div className="w-1 h-1 rounded-full bg-white/40 mt-2 shrink-0"></div>
                  <div className="h-2.5 bg-white/40 rounded-full w-3/4"></div>
                </div>
                <div className="flex items-start gap-2 opacity-50">
                  <div className="w-1 h-1 rounded-full bg-white/40 mt-2 shrink-0"></div>
                  <div className="h-2.5 bg-white/40 rounded-full w-2/3"></div>
                </div>
                <div className="flex items-start gap-2 opacity-30">
                  <div className="w-1 h-1 rounded-full bg-white/40 mt-2 shrink-0"></div>
                  <div className="h-2.5 bg-white/40 rounded-full w-1/2"></div>
                </div>
                <div className="flex items-start gap-2 opacity-20">
                  <div className="w-1 h-1 rounded-full bg-white/40 mt-2 shrink-0"></div>
                  <div className="h-2.5 bg-white/40 rounded-full w-5/6"></div>
                </div>
              </div>

              <p className="text-xs text-white/60 mt-6 italic">Sikt løfter deg til topps her. Det er grunnmuren.</p>
            </div>
          </RevealOnScroll>

          {/* AI — Det nye laget */}
          <RevealOnScroll direction="right" delay={200}>
            <div className="relative bg-gradient-to-br from-violet-600/20 to-indigo-600/20 backdrop-blur-md border border-white/15 rounded-3xl p-7 sm:p-9 h-full shadow-2xl shadow-violet-900/30">
              {/* "Nytt"-indikator */}
              <div className="absolute -top-3 -right-3 bg-white text-[#1A1A1A] text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">
                Nytt
              </div>

              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
                    <Sparkles size={16} className="text-white" />
                  </div>
                  <span className="text-xs uppercase tracking-widest text-violet-200 font-bold">ChatGPT</span>
                </div>
                <span className="text-[9px] uppercase tracking-wider text-violet-200 font-black bg-white/10 px-2 py-0.5 rounded-full border border-white/20">I tillegg</span>
              </div>

              <div className="bg-white/10 rounded-xl p-4 mb-5 border border-white/10">
                <p className="text-sm text-white/90 italic">"Hvilket SEO-byrå bør jeg velge?"</p>
              </div>

              {/* AI-svar med én anbefaling */}
              <div className="space-y-3">
                <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-400 to-indigo-400 flex items-center justify-center">
                      <Sparkles size={10} className="text-white" />
                    </div>
                    <span className="text-xs text-violet-200 font-bold">ChatGPT</span>
                  </div>
                  <p className="text-sm text-white/90 leading-relaxed">
                    Jeg vil anbefale <span className="font-bold text-white bg-violet-500/25 px-1.5 rounded">din bedrift</span> — de er kjent for...
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
              Sikt jobber for <span className="text-violet-300">begge deler.</span>
            </h3>
            <p className="text-white/70 text-base sm:text-lg mb-10 leading-relaxed">
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

            <p className="text-xs text-white/50 mt-5 uppercase tracking-widest font-bold">
              Vær synlig der kundene leter — både på Google og i AI
            </p>
          </div>
        </RevealOnScroll>

      </div>
    </section>
  );
};



const GeoFaq = () => {
  const [open, setOpen] = useState<number | null>(null);
  const faqs = [
    {
      q: "Hvor lang tid tar det før AI gir resultater?",
      a: "Vi identifiserer kritiske tekniske feil på timer. Synlige forbedringer på det tekniske kommer gjerne første uke; flere besøkende merkes vanligvis etter 2–3 måneder, og topposisjoner tar 6–12 måneder. Du får ærlige tall underveis så du ser at det går riktig vei."
    },
    {
      q: "Hvorfor velge Sikt fremfor et vanlig byrå?",
      a: "Mange byråer sender deg månedsrapporter fulle av grafer du ikke forstår. Sikt overvåker konkurrenter og teknisk SEO løpende, og forteller deg på vanlig norsk hva vi har gjort og hva som faktisk virker — uten byråpriser og uten bindingstid."
    },
    {
      q: "Hva er kostnaden ved å ikke ha en plan?",
      a: "Når bedriften din ikke er synlig på Google, ender mange potensielle kunder hos en konkurrent i stedet. Over tid kan det koste deg en god del omsetning."
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
            <div key={i} className="border border-[#E9E4DA] rounded-[24px] sm:rounded-[32px] overflow-hidden group [@media(hover:hover)_and_(pointer:fine)]:hover:border-[#E9E4DA] transition-[border-color,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full p-6 sm:p-8 flex items-center justify-between text-left [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-[#F2EFE8]/50 transition-[background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.99]"
              >
                <span className="text-base sm:text-xl font-bold text-[#1A1A1A] pr-6 sm:pr-8 leading-snug">{faq.q}</span>
                <ChevronDown className={`shrink-0 transition-transform duration-[280ms] ease-[cubic-bezier(0.77,0,0.175,1)] size-5 ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && (
                <div className="px-6 pb-6 sm:px-8 sm:pb-8 text-sm sm:text-lg text-[#5C574C] leading-relaxed font-medium animate-fade-in">
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
    <section className="min-h-screen bg-[#F2EFE8] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Bakgrunnseffekter */}
      <div className="absolute inset-0 grid-pattern opacity-[0.03] pointer-events-none"></div>
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-transparent rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-transparent rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-2xl w-full bg-white rounded-[32px] shadow-2xl border border-[#E9E4DA] overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-300">

        {/* Toppstripe — fylles opp i takt med hovedprogressjonen */}
        <div className="h-1.5 bg-[#F2EFE8] relative overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 via-indigo-500 to-emerald-500 transition-[width] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]"
            style={{ width: `${overallProgress}%` }}
          />
        </div>

        <div className="p-8 sm:p-12 text-center">

          {/* Pulserende ikon som skifter med aktivt steg */}
          <div className="mx-auto w-24 h-24 bg-[#F2EFE8] rounded-full flex items-center justify-center mb-6 relative">
            <div className="absolute inset-0 bg-[#F2EFE8] rounded-full animate-ping opacity-30"></div>
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
          <p className="text-[#5C574C] text-base sm:text-lg mb-2 leading-relaxed">
            {currentStep < steps.length
              ? steps[currentStep].detail
              : 'Åpner dashboardet ditt...'}
          </p>

          {/* Nedtelling + prosent */}
          <div className="flex items-center justify-center gap-4 mb-8 text-sm">
            <span className="text-[#5C574C] font-mono">
              {currentStep < steps.length
                ? `~${remainingSeconds}s igjen`
                : 'Ferdig'}
            </span>
            <span className="w-1 h-1 bg-[#E9E4DA] rounded-full" />
            <span className="text-[#1A1A1A] font-black">{Math.round(overallProgress)}%</span>
          </div>

          {/* Stor progress-bar */}
          <div className="h-2 bg-[#F2EFE8] rounded-full overflow-hidden mb-10 relative">
            <div
              className="h-full bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-500 rounded-full transition-[width,background-position] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] bg-[length:200%_100%]"
              style={{ width: `${overallProgress}%`, backgroundPosition: `${overallProgress * 2}% 0` }}
            />
          </div>

          {/* Steg-liste */}
          <div className="bg-[#F2EFE8] rounded-2xl p-6 text-left border border-[#E9E4DA]">
            <h3 className="text-xs font-bold text-[#5C574C] uppercase tracking-wider mb-5">Sikt jobber i bakgrunnen</h3>

            <div className="space-y-4 relative">
              <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-[#E9E4DA]"></div>

              {steps.map((step, i) => {
                const StepIcon = step.icon;
                const isDone = currentStep > i;
                const isActive = currentStep === i;
                const isPending = currentStep < i;

                return (
                  <div key={i} className="flex gap-4 items-center relative z-10">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shadow-sm ring-4 ring-[#F2EFE8] shrink-0 transition-[background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]
                      ${isDone ? 'bg-[#1A1A1A]' : isActive ? 'bg-white border-2 border-[#1A1A1A]' : 'bg-[#E9E4DA] border-2 border-white'}
                    `}>
                      {isDone ? (
                        <Check size={13} className="text-white" />
                      ) : isActive ? (
                        <div className="w-2 h-2 bg-[#5C574C] rounded-full animate-pulse" />
                      ) : (
                        <StepIcon size={11} className="text-[#5C574C]" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className={`text-sm font-bold transition-colors
                        ${isDone ? 'text-[#5C574C] line-through decoration-[#E9E4DA]' : isActive ? 'text-[#1A1A1A]' : 'text-[#5C574C]'}
                      `}>
                        {step.label}
                      </span>
                      {isActive && (
                        <span className="text-xs text-[#1A1A1A] font-medium animate-pulse mt-0.5">Jobber nå...</span>
                      )}
                      {isPending && (
                        <span className="text-xs text-[#5C574C] mt-0.5">Venter</span>
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

          <p className="text-sm text-[#5C574C] mt-6 pt-5 border-t border-[#E9E4DA] leading-relaxed">
            Teknisk analyse er klar med én gang. Søkeorddata fra Google kommer vanligvis om 1–2 uker etter tilkobling — det er normalt for en ny konto, og du får varsel når tallene er inne.
          </p>
          <p className="text-xs text-[#5C574C] mt-3">
            Du blir automatisk sendt til dashboardet når oppsettet er ferdig.
          </p>

        </div>
      </div>
    </section>
  );
};



// --- VIEWS ---

// Gratis e-post-gated analyse — lokkemiddelet øverst i trakten.
// Lar besøkende se ekte score + topp-funn FØR de logger inn/kjøper.
// On-page-fakta som edge-funksjonen henter fra kundens faktiske HTML.
type PageFacts = {
  title: string | null;
  titleLen: number;
  metaDescription: string | null;
  metaLen: number;
  h1Count: number;
  h1Text: string | null;
  imgTotal: number;
  imgMissingAlt: number;
  wordCount: number;
  hasOg: boolean;
  hasSchema: boolean;
  hasViewport: boolean;
};

type PageFinding = { w: number; title: string; impact: string };

// Bygger spesifikke, plain-norsk-funn fra on-page-fakta. Ren funksjon, ferdige
// maler (ingen AI) — siterer kundens egen side så det føles som «de leste MIN
// side». Sortert sterkest først; kalleren viser topp 3 og låser resten.
const GENERIC_TITLES = ['hjem', 'home', 'forside', 'startside', 'velkommen', 'min side', 'untitled', 'document', 'ny side'];
function buildPageFindings(f: PageFacts): PageFinding[] {
  const out: PageFinding[] = [];

  if (!f.title || f.titleLen === 0) {
    out.push({ w: 100, title: 'Siden din mangler en tittel', impact: 'Tittelen er det aller første Google viser i søkeresultatet. Uten den blir du nesten usynlig.' });
  } else if (f.titleLen < 15 || GENERIC_TITLES.includes(f.title.toLowerCase())) {
    out.push({ w: 90, title: `Tittelen din: «${f.title}»`, impact: 'Dette er det aller første Google og kundene ser. Den sier ikke hva du tilbyr — folk scroller forbi.' });
  } else if (f.titleLen > 60) {
    out.push({ w: 55, title: `Tittelen din er ${f.titleLen} tegn — Google kutter den midt i setningen`, impact: 'Det viktigste forsvinner bak «…». Hold den under ~60 tegn så hele budskapet vises.' });
  }

  if (!f.metaDescription || f.metaLen === 0) {
    out.push({ w: 85, title: 'Du mangler meta-beskrivelse', impact: 'Teksten under lenken i Google. Uten den gjetter Google selv — ofte feil, og færre klikker seg inn.' });
  } else if (f.metaLen < 50) {
    out.push({ w: 50, title: `Meta-beskrivelsen din er bare ${f.metaLen} tegn`, impact: 'Du lar verdifull plass i Google stå tom. 120–158 tegn gir flere klikk.' });
  } else if (f.metaLen > 160) {
    out.push({ w: 40, title: `Meta-beskrivelsen din er ${f.metaLen} tegn — Google kutter den`, impact: 'Slutten forsvinner bak «…». Hold den under ~158 tegn så hele teksten vises.' });
  }

  if (!f.hasViewport) {
    out.push({ w: 80, title: 'Siden er ikke satt opp for mobil', impact: 'Uten viewport-tag vises siden feil på telefon. Google rangerer mobil-først — dette straffer deg direkte.' });
  }

  if (f.h1Count === 0) {
    out.push({ w: 75, title: 'Forsiden mangler en H1-overskrift', impact: 'Google bruker H1 til å forstå hva siden handler om. Uten den famler den i blinde.' });
  } else if (f.h1Count > 1) {
    out.push({ w: 30, title: `Forsiden har ${f.h1Count} H1-overskrifter`, impact: 'Flere H1-er forvirrer Google om hva som er hovedbudskapet. Én tydelig H1 er best.' });
  }

  if (f.wordCount < 300) {
    out.push({ w: 70, title: `Forsiden leverer bare ${f.wordCount} ord til Google ved første lasting`, impact: 'Google belønner sider som svarer grundig. Under 300 ord oppfattes ofte som tynt — og rankes lavere.' });
  }

  if (f.imgMissingAlt > 0) {
    out.push({ w: 60, title: `${f.imgMissingAlt} av ${f.imgTotal} bilder mangler alt-tekst`, impact: 'Google «ser» ikke bilder uten alt-tekst — du taper Google Bilder-trafikk, og siden blir utilgjengelig for skjermlesere.' });
  }

  if (!f.hasSchema) {
    out.push({ w: 45, title: 'Google vet ikke at du er en bedrift', impact: 'Uten strukturert data (schema) går du glipp av rik visning — stjerner, åpningstider og kontaktinfo rett i søket.' });
  }

  if (!f.hasOg) {
    out.push({ w: 35, title: 'Lenken din ser kjedelig ut når den deles', impact: 'Uten Open Graph-bilde og -tittel blir delinger på Facebook og LinkedIn grå og tomme — nesten ingen klikker.' });
  }

  return out.sort((a, b) => b.w - a.w);
}

const FreeAuditSection = ({ onSelectPlan }: { onSelectPlan: (plan?: string) => void }) => {
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    url: string;
    scores: { performance: number | null; seo: number | null; accessibility: number | null; bestPractices: number | null };
    topIssues: { title: string; displayValue: string }[];
    issueCount?: number;
    pageFacts?: PageFacts | null;
  } | null>(null);
  const [monthlyVisits, setMonthlyVisits] = useState(1000);

  const runAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    const cleanUrl = url.trim();
    const cleanEmail = email.trim();
    if (!cleanUrl) { setError('Skriv inn nettsiden din.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) { setError('Skriv inn en gyldig e-postadresse.'); return; }
    setLoading(true);
    track('free_analysis_started', { url: cleanUrl });
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-pagespeed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ url: cleanUrl, email: cleanEmail, mode: 'public' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Kunne ikke analysere siden. Prøv igjen.');
        track('free_analysis_failed', { reason: data?.error || `http_${res.status}` });
        return;
      }
      setResult(data);
      track('free_analysis_completed', {
        performance: data?.scores?.performance ?? null,
        seo: data?.scores?.seo ?? null,
      });
      try { localStorage.setItem('sikt_audit_url', data?.url || cleanUrl); } catch { /* ignore */ }
    } catch {
      setError('Noe gikk galt. Sjekk URL-en og prøv igjen.');
      track('free_analysis_failed', { reason: 'network' });
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (s: number | null) => {
    if (s === null || s === undefined) return '#5C574C';
    if (s >= 90) return '#15795A';
    if (s >= 50) return '#9A6700';
    return '#B4231F';
  };

  const scoreCards = result ? [
    { label: 'Fart', value: result.scores.performance },
    { label: 'SEO', value: result.scores.seo },
    { label: 'Tilgjengelighet', value: result.scores.accessibility },
    { label: 'Teknisk', value: result.scores.bestPractices },
  ] : [];

  // Avledede salgs-tall (brukes kun i resultat-grenen).
  const availableScores = result
    ? [result.scores.performance, result.scores.seo, result.scores.accessibility, result.scores.bestPractices].filter((n): n is number => typeof n === 'number')
    : [];
  const overall = availableScores.length ? Math.round(availableScores.reduce((a, b) => a + b, 0) / availableScores.length) : null;
  // Ærlig estimat: PSI vet IKKE faktisk trafikk → bygger på en synlig forutsetning (besøk/mnd).
  const perfForEstimate = result?.scores.performance ?? overall ?? 90;
  const uplift = Math.max(0, Math.min(0.3, (90 - perfForEstimate) / 100));
  const extraVisits = Math.round(monthlyVisits * uplift);
  const krLost = extraVisits * 8; // 8 kr/besøk — samme antakelse som ROI-/kvitterings-arbeidet.
  const issueCount = result?.issueCount ?? result?.topIssues.length ?? 0;
  const hiddenIssues = Math.max(0, issueCount - (result?.topIssues.length ?? 0));

  // Spesifikke on-page-funn (det Google ser) — leder resultatet når vi klarte
  // å lese HTML-en. Topp 3 vises; resten (inkl. PSI-funn) låses ærlig.
  const pageFindings = result?.pageFacts ? buildPageFindings(result.pageFacts) : [];
  const shownFindings = pageFindings.slice(0, 3);
  const totalFindings = pageFindings.length + issueCount;
  const hiddenFindings = Math.max(0, totalFindings - shownFindings.length);

  return (
    <section id="gratis-analyse" className="py-16 sm:py-24 md:py-28 bg-white relative overflow-hidden scroll-mt-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-5 relative z-10">
        <RevealOnScroll direction="up">
          <div className="text-center mb-8 sm:mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F2EFE8] text-[#1A1A1A] text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-5 border border-[#E9E4DA]">
              Gratis · Tar 30 sekunder
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#1A1A1A] mb-4">Hvor synlig er siden din <span className="text-violet-600">i dag?</span></h2>
            <p className="text-base sm:text-lg text-[#5C574C] max-w-xl mx-auto">Skriv inn nettsiden din, så analyserer vi fart, SEO og teknisk kvalitet — og viser deg de største mulighetene. Ingen forpliktelser.</p>
          </div>
        </RevealOnScroll>

        {!result ? (
          <RevealOnScroll direction="up" delay={100}>
            <form onSubmit={runAudit} className="bg-[#F2EFE8] border border-[#E9E4DA] rounded-3xl p-5 sm:p-8 shadow-sm">
              <div className="space-y-3">
                <input
                  type="text"
                  inputMode="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="dinbedrift.no"
                  className="w-full px-5 py-4 rounded-2xl border border-[#E9E4DA] bg-white text-[#1A1A1A] text-base font-semibold placeholder:text-[#B3AD9F] focus:outline-none focus:border-violet-400"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="din@epost.no"
                  className="w-full px-5 py-4 rounded-2xl border border-[#E9E4DA] bg-white text-[#1A1A1A] text-base font-semibold placeholder:text-[#B3AD9F] focus:outline-none focus:border-violet-400"
                />
              </div>
              {error && (
                <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#B4231F]"><AlertCircle size={16} /> {error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="group w-full mt-4 px-8 py-4 bg-[#1A1A1A] text-white rounded-2xl text-base font-black tracking-tight ui-motion flex items-center justify-center gap-3 disabled:opacity-60 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-700"
              >
                {loading ? (<><Loader2 size={20} className="animate-spin" /> Analyserer siden …</>) : (<>Analyser gratis <ArrowRight size={20} className="transition-transform duration-200 [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1" /></>)}
              </button>
              <p className="mt-3 text-center text-xs text-[#5C574C]">Vi sender deg rapporten og tips. Ingen spam — meld deg av når som helst.</p>
            </form>
          </RevealOnScroll>
        ) : (
          <RevealOnScroll direction="up">
            <div className="bg-white border border-[#E9E4DA] rounded-3xl p-5 sm:p-8 shadow-xl">
              {/* Dom */}
              <p className="text-xs font-bold uppercase tracking-widest text-[#5C574C] mb-1">Resultat for</p>
              <p className="text-sm font-bold text-[#1A1A1A] mb-5 break-all">{result.url}</p>

              {/* Leder med spesifikke on-page-funn — det som føles som «de leste MIN side». */}
              {shownFindings.length > 0 && (
                <div className="mb-7">
                  <p className="text-sm font-black text-[#1A1A1A] mb-1">Vi leste faktisk siden din. Dette fant vi:</p>
                  <p className="text-xs text-[#B3AD9F] mb-3">Slik ser forsiden din ut for Google ved første lasting.</p>
                  <ul className="space-y-3">
                    {shownFindings.map((find, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <AlertCircle size={16} className="text-[#9A6700] mt-0.5 shrink-0" />
                        <span className="text-sm text-[#1A1A1A]">
                          <span className="font-bold">{find.title}</span>
                          <span className="block text-[#5C574C] font-normal mt-0.5">{find.impact}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {hiddenFindings > 0 && (
                    <div className="mt-3 rounded-xl border border-dashed border-[#E9E4DA] bg-[#FAF8F3] px-4 py-3 flex items-center gap-2.5">
                      <Lock size={15} className="text-[#B3AD9F] shrink-0" />
                      <span className="text-sm font-bold text-[#5C574C]">+{hiddenFindings} flere funn venter i full rapport</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-end gap-2 mb-1">
                <span className="text-5xl sm:text-6xl font-black tabular-nums leading-none" style={{ color: scoreColor(overall) }}>{overall ?? '–'}</span>
                <span className="text-lg font-bold text-[#B3AD9F] mb-1">/ 100</span>
              </div>
              <p className="text-base text-[#5C574C] mb-6">
                {overall !== null && overall >= 90
                  ? 'Sterkt! Men selv små forbedringer kan gi flere kunder.'
                  : 'Under det Google belønner — her er hva som holder deg tilbake.'}
              </p>

              {/* Score-rad + benchmark */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-2">
                {scoreCards.map((c) => (
                  <div key={c.label} className="bg-[#F2EFE8] border border-[#E9E4DA] rounded-2xl p-4 text-center">
                    <div className="text-3xl font-black tabular-nums" style={{ color: scoreColor(c.value) }}>{c.value ?? '–'}</div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#5C574C] mt-1">{c.label}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[#B3AD9F] mb-7">Beste i bransjen ligger på 90+ på alle fire.</p>

              {/* Fallback: rene PSI-funn vises kun når vi IKKE klarte å lese HTML-en (ingen on-page-funn). */}
              {shownFindings.length === 0 && issueCount > 0 && (
                <div className="mb-7">
                  <p className="text-sm font-black text-[#1A1A1A] mb-3">Vi fant <span className="text-[#B4231F]">{issueCount}</span> ting som koster deg synlighet:</p>
                  <ul className="space-y-2">
                    {result.topIssues.map((issue, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-[#1A1A1A]">
                        <AlertCircle size={16} className="text-[#9A6700] mt-0.5 shrink-0" />
                        <span className="font-semibold">{issue.title}{issue.displayValue ? <span className="text-[#5C574C] font-normal"> — {issue.displayValue}</span> : null}</span>
                      </li>
                    ))}
                  </ul>
                  {hiddenIssues > 0 && (
                    <div className="mt-2 rounded-xl border border-dashed border-[#E9E4DA] bg-[#FAF8F3] px-4 py-3 flex items-center gap-2.5">
                      <Lock size={15} className="text-[#B3AD9F] shrink-0" />
                      <span className="text-sm font-bold text-[#5C574C]">+{hiddenIssues} flere funn venter i full rapport</span>
                    </div>
                  )}
                </div>
              )}

              {/* Ærlig estimat (synlig forutsetning, justerbar) */}
              {extraVisits > 0 && (
                <div className="mb-7 rounded-2xl bg-[#F2EFE8] border border-[#E9E4DA] p-4 sm:p-5">
                  <p className="text-sm text-[#1A1A1A] leading-relaxed">
                    <span className="font-black">Grovt anslag:</span> en side med ~<span className="font-bold tabular-nums">{monthlyVisits.toLocaleString('nb-NO')}</span> besøk/mnd kan tape i størrelsesorden <span className="font-black">~{krLost.toLocaleString('nb-NO')} kr/mnd</span> i tapt synlighet på denne scoren (≈ {extraVisits.toLocaleString('nb-NO')} besøk · 8 kr/besøk).
                  </p>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <label className="text-xs font-bold text-[#5C574C]">Tilpass med dine tall:</label>
                    <input
                      type="number"
                      min={0}
                      value={monthlyVisits}
                      onChange={(e) => setMonthlyVisits(Math.max(0, Math.min(10000000, Number(e.target.value) || 0)))}
                      className="w-28 px-3 py-1.5 rounded-lg border border-[#E9E4DA] bg-white text-sm font-bold text-[#1A1A1A] tabular-nums focus:outline-none focus:border-violet-400"
                    />
                    <span className="text-xs text-[#5C574C]">besøk/mnd</span>
                  </div>
                  <p className="mt-2 text-[11px] text-[#B3AD9F]">Anslag, ikke en måling av din faktiske trafikk — vi kan ikke se besøkstallet ditt fra en hastighetsanalyse.</p>
                </div>
              )}

              {/* Verdi-stige-CTA */}
              <div className="bg-gradient-to-br from-violet-50 to-white border border-violet-200 rounded-2xl p-5 sm:p-6">
                <p className="text-base font-black text-[#1A1A1A] mb-3">Slik fikser du det:</p>
                <button
                  onClick={() => onSelectPlan('BASIC')}
                  className="group w-full px-6 py-4 bg-violet-700 text-white rounded-2xl text-base font-black tracking-tight ui-motion flex items-center justify-between gap-3 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-600"
                >
                  <span className="text-left leading-tight">Få hele lista + ferdige fikser<br /><span className="text-xs font-semibold text-violet-200">Start med Basic — gjør det selv</span></span>
                  <ArrowRight size={20} className="shrink-0 transition-transform duration-200 [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1" />
                </button>
                <button
                  onClick={() => onSelectPlan('STANDARD')}
                  className="group w-full mt-3 px-6 py-4 bg-white text-[#1A1A1A] border border-[#E9E4DA] rounded-2xl text-base font-black tracking-tight ui-motion flex items-center justify-between gap-3 [@media(hover:hover)_and_(pointer:fine)]:hover:border-violet-300 [@media(hover:hover)_and_(pointer:fine)]:hover:text-violet-700"
                >
                  <span className="text-left leading-tight">La oss fikse alt for deg<br /><span className="text-xs font-semibold text-[#5C574C]">Standard — vi gjør jobben automatisk</span></span>
                  <ArrowRight size={20} className="shrink-0 transition-transform duration-200 [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1" />
                </button>
                <p className="mt-4 text-center text-xs font-bold text-[#5C574C]">Founding-pris for de første kundene · ingen bindingstid</p>
                <button onClick={() => { setResult(null); setError(null); }} className="w-full mt-3 text-sm font-bold text-[#5C574C] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A]">Analyser en annen side</button>
              </div>
            </div>
          </RevealOnScroll>
        )}
      </div>
    </section>
  );
};

// --- A2: Sosialt bevis (ærlig founding-stage) ---------------------------
// Ekte sitater legges i TESTIMONIALS når de finnes. Til da viser vi en
// ærlig founding-tilstand — bevisst INGEN oppdiktede sitater, fordi falsk
// sosialt bevis undergraver nettopp tilliten denne seksjonen skal bygge.
// Når arrayet får oppføringer, flipper seksjonen automatisk til sitat-grid.
type Testimonial = { quote: string; name: string; role: string; rating?: number };
// PASTE-KLAR: fjern kommentar-tegnene på ÉN blokk og bytt verdiene med en ekte
// uttalelse. Krev kundens samtykke før du publiserer navn/rolle. Tomt array =
// seksjonen viser den ærlige «vi er nye»-tilstanden automatisk.
const TESTIMONIALS: Testimonial[] = [
  // {
  //   quote: 'Sikt fant feil ingen andre hadde sett — og fikset dem uten at jeg løftet en finger.',
  //   name: 'Ola Nordmann',
  //   role: 'Daglig leder, Eksempel AS',
  //   rating: 5, // valgfritt, 1–5
  // },
];

const SocialProofSection = () => {
  const hasTestimonials = TESTIMONIALS.length > 0;
  return (
    <section id="kundehistorier" className="py-16 sm:py-24 md:py-28 bg-white relative overflow-hidden scroll-mt-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-5 relative z-10">
        <RevealOnScroll direction="up">
          <div className="text-center mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F2EFE8] text-[#1A1A1A] text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-5 border border-[#E9E4DA]">
              {hasTestimonials ? 'Kundehistorier' : 'Bygget i åpenhet'}
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#1A1A1A] mb-4">
              {hasTestimonials
                ? <>Hva kundene <span className="text-violet-600">faktisk sier</span></>
                : <>Vi er nye — og <span className="text-violet-600">ærlige om det</span></>}
            </h2>
            <p className="text-base sm:text-lg text-[#5C574C] max-w-2xl mx-auto">
              {hasTestimonials
                ? 'Ekte resultater fra bedrifter som bruker Sikt.'
                : 'De fleste SEO-løfter er umulige å etterprøve. Vi gjør det motsatte: se nøyaktig hva som er galt på din egen side først — gratis — så bestemmer du.'}
            </p>
          </div>
        </RevealOnScroll>

        {hasTestimonials ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {TESTIMONIALS.map((t, i) => (
              <RevealOnScroll key={i} direction="up" delay={i * 80}>
                <figure className="h-full bg-[#F2EFE8] border border-[#E9E4DA] rounded-3xl p-6 sm:p-7 flex flex-col">
                  {typeof t.rating === 'number' && (
                    <div className="flex gap-0.5 mb-3">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star key={s} size={15} className={s < t.rating! ? 'text-[#9A6700] fill-[#9A6700]' : 'text-[#E9E4DA]'} />
                      ))}
                    </div>
                  )}
                  <blockquote className="text-[#1A1A1A] text-sm sm:text-base leading-relaxed font-medium flex-1">«{t.quote}»</blockquote>
                  <figcaption className="mt-5 pt-4 border-t border-[#E9E4DA]">
                    <div className="text-sm font-black text-[#1A1A1A]">{t.name}</div>
                    <div className="text-xs text-[#5C574C]">{t.role}</div>
                  </figcaption>
                </figure>
              </RevealOnScroll>
            ))}
          </div>
        ) : (
          <RevealOnScroll direction="up">
            {/* Ærlig bruks-tall (gated) + alltid-sanne kapabilitets-fakta — sosialt bevis ved null kunder. */}
            <UsageStat tone="light" className="mb-6 sm:mb-8" />
            <div className="mb-8 sm:mb-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs sm:text-sm font-bold text-[#5C574C]">
              {['Googles egne data', 'Svar på ~30 sekunder', 'Ingen binding'].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <Check size={15} className="text-[#15795A]" /> {t}
                </span>
              ))}
            </div>
            <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
              {[
                { icon: SearchCheck, title: 'Se det selv først', body: 'Kjør en gratis analyse av din egen side og se ekte funn på 30 sekunder — før du betaler en krone.' },
                { icon: HeartHandshake, title: 'Grunnleggeren svarer', body: 'Som en av de første kundene snakker du direkte med grunnleggeren, ikke en støtte-kø.' },
                { icon: Shield, title: 'Ingen binding', body: 'Måned for måned. Alt Sikt gjør på siden din kan angres med ett klikk.' },
              ].map((card, i) => {
                const Icon = card.icon;
                return (
                  <div key={i} className="bg-[#F2EFE8] border border-[#E9E4DA] rounded-3xl p-5 sm:p-6">
                    <div className="w-10 h-10 rounded-xl bg-white border border-[#E9E4DA] flex items-center justify-center text-violet-700 mb-3"><Icon size={18} /></div>
                    <div className="text-sm font-black text-[#1A1A1A] mb-1">{card.title}</div>
                    <div className="text-xs text-[#5C574C] leading-relaxed">{card.body}</div>
                  </div>
                );
              })}
            </div>
            <div className="text-center mt-8">
              <a href="#gratis-analyse" onClick={() => track('cta_click', { location: 'features_grid', target: 'free_analysis' })} className="group inline-flex items-center gap-2 px-8 py-4 bg-[#1A1A1A] text-white rounded-full text-sm sm:text-base font-black tracking-tight ui-motion [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-700">
                Test din egen side gratis
                <ArrowRight size={18} className="transition-transform duration-200 [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1" />
              </a>
            </div>
          </RevealOnScroll>
        )}
      </div>
    </section>
  );
};

// Ekte case legges i CASES når piloten har levert dokumenterte tall.
// Bevisst tom til da — N=1 ærlig, INGEN oppdiktede resultater. Tallene hentes
// rett fra sikt_changes (hva Sikt endret) + keyword_snapshots/GSC (klikk/posisjon
// over uker). Seksjonen rendres KUN når arrayet har innhold — SocialProofSection
// dekker allerede den ærlige tom-tilstanden, så vi unngår to redundante seksjoner.
type CaseStudy = {
  domain: string;            // samtykket, vises offentlig
  consent: boolean;          // må være true for å vises
  snippet: {                 // hva Sikt endret, vist som Google-resultat før/etter
    url: string;
    changedLabel: string;    // f.eks. «SEO-tittel» / «Meta-beskrivelse»
    beforeTitle: string;
    afterTitle: string;
    beforeDescription: string;
    afterDescription: string;
  };
  outcome?: {                // fra keyword_snapshots — fylles når ~4-ukers-tallene er inne
    keyword: string;
    posBefore: number;
    posAfter: number;
    clicksBefore: number;
    clicksAfter: number;
    period: string;          // f.eks. «4 uker»
  };
  quote?: string;
};
// PASTE-KLAR: fjern kommentar-tegnene og fyll inn ÉT ekte case (krever kundens
// samtykke). snippet.* hentes fra sikt_changes (old_value → new_value).
// outcome.* hentes fra keyword_snapshots / Google Search Console etter ~4 uker —
// utelat hele `outcome` til de tallene faktisk er inne. Tomt array = seksjonen skjules.
const CASES: CaseStudy[] = [
  // {
  //   domain: 'eksempelbedrift.no',
  //   consent: true,
  //   snippet: {
  //     url: 'https://eksempelbedrift.no/tjenester',
  //     changedLabel: 'Meta-beskrivelse',
  //     beforeTitle: 'Tjenester',
  //     afterTitle: 'Rørlegger i Oslo — rask hjelp samme dag | Eksempelbedrift',
  //     beforeDescription: '',
  //     afterDescription: 'Trenger du rørlegger i Oslo? Vi rykker ut samme dag — ring for gratis befaring.',
  //   },
  //   outcome: {
  //     keyword: 'rørlegger oslo',
  //     posBefore: 14, posAfter: 6,
  //     clicksBefore: 3, clicksAfter: 21,
  //     period: '4 uker',
  //   },
  //   quote: 'Vi merket flere henvendelser allerede etter en måned.', // valgfritt
  // },
];

const CaseStudySection = () => {
  const cases = CASES.filter((c) => c.consent);
  if (cases.length === 0) return null; // ekte tall eller ingenting — aldri en tom skval
  return (
    <section id="resultater" className="py-16 sm:py-24 md:py-28 bg-[#F2EFE8] relative overflow-hidden scroll-mt-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-5 relative z-10">
        <RevealOnScroll direction="up">
          <div className="text-center mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white text-[#1A1A1A] text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-5 border border-[#E9E4DA]">
              Dokumentert resultat
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#1A1A1A] mb-4">
              {cases.length > 1
                ? <>Ekte <span className="text-violet-600">resultater</span></>
                : <>Vårt første <span className="text-violet-600">dokumenterte resultat</span></>}
            </h2>
            <p className="text-base sm:text-lg text-[#5C574C] max-w-2xl mx-auto">
              Ikke et løfte — de faktiske endringene Sikt gjorde, og hva som skjedde etterpå. Tallene er hentet rett fra Google Search Console.
            </p>
          </div>
        </RevealOnScroll>

        <div className="space-y-12 sm:space-y-16">
          {cases.map((c, i) => (
            <RevealOnScroll key={i} direction="up" delay={i * 80}>
              <div>
                <div className="text-sm font-black text-[#1A1A1A] mb-4">{c.domain}</div>

                <p className="text-[11px] tracking-wide uppercase text-[#5C574C] mb-3">
                  Hva Sikt endret · {c.snippet.changedLabel}
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-white border border-[#E9E4DA] overflow-hidden">
                    <p className="text-[11px] tracking-wide uppercase text-[#5C574C] px-4 pt-3">Før</p>
                    <GoogleSnippetPreview
                      title={c.snippet.beforeTitle}
                      url={c.snippet.url}
                      description={c.snippet.beforeDescription}
                    />
                  </div>
                  <div className="relative rounded-2xl bg-white border-2 border-[#52A447]/40 overflow-hidden">
                    <div className="absolute inset-x-0 top-0 h-1 bg-[#EAF3DE]" />
                    <p className="text-[11px] tracking-wide uppercase text-[#3B6D11] font-medium px-4 pt-3">Etter</p>
                    <GoogleSnippetPreview
                      title={c.snippet.afterTitle}
                      url={c.snippet.url}
                      description={c.snippet.afterDescription}
                    />
                  </div>
                </div>

                {c.outcome && (
                  <div className="mt-5 rounded-2xl bg-white border border-[#E9E4DA] p-5 sm:p-6">
                    <div className="flex items-center gap-2 mb-5">
                      <TrendingUp size={16} className="text-[#52A447]" />
                      <p className="text-sm font-black text-[#1A1A1A]">
                        «{c.outcome.keyword}» etter {c.outcome.period}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-[#5C574C] mb-1">Posisjon i Google</p>
                        <p className="text-2xl sm:text-3xl font-black tabular-nums text-[#1A1A1A]">
                          #{c.outcome.posBefore}
                          <ArrowRight size={18} className="inline mx-1 -mt-1 text-[#5C574C]" />
                          <span className="text-[#15795A]">#{c.outcome.posAfter}</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-[#5C574C] mb-1">Klikk per måned</p>
                        <p className="text-2xl sm:text-3xl font-black tabular-nums text-[#1A1A1A]">
                          {c.outcome.clicksBefore}
                          <ArrowRight size={18} className="inline mx-1 -mt-1 text-[#5C574C]" />
                          <span className="text-[#15795A]">{c.outcome.clicksAfter}</span>
                        </p>
                      </div>
                    </div>
                    {c.outcome.clicksAfter > c.outcome.clicksBefore && (
                      <p className="text-xs text-[#5C574C] mt-4 leading-relaxed">
                        ~{((c.outcome.clicksAfter - c.outcome.clicksBefore) * 8).toLocaleString('nb-NO')} kr/mnd i estimert verdi av de ekstra klikkene (8 kr/klikk — samme forsiktige anslag som i ukesrapporten).
                      </p>
                    )}
                  </div>
                )}

                {c.quote && (
                  <blockquote className="mt-5 text-[#1A1A1A] text-sm sm:text-base leading-relaxed font-medium border-l-2 border-violet-600 pl-4">
                    «{c.quote}»
                  </blockquote>
                )}
              </div>
            </RevealOnScroll>
          ))}
        </div>

        <p className="text-center text-[11px] text-[#8A8578] mt-10">
          Tallene er hentet fra Google Search Console og delt med kundens samtykke.
        </p>
      </div>
    </section>
  );
};

const HomeView = ({ onNavigate, onSelectPlan }: { onNavigate: (view: string) => void, onSelectPlan: (plan?: string) => void }) => (
  <>
    <Hero />
    <ProductPreview />
    {/* Gratis-analyse: lokkemiddel høyt i trakten — verdi før innlogging */}
    <FreeAuditSection onSelectPlan={onSelectPlan} />
    {/* Problemet: samler gamle StoryBrand/PainPoints/Insight i ÉN redaksjonell splitt */}
    <ProblemSection />
    {/* Hvorfor Sikt: løftet + plain-norsk-beviset (erstatter ValueProposition) */}
    <WhySiktSection />
    {/* "Er dette for min bransje?" — self-identification etter "Hvorfor Sikt" */}
    <HomeIndustriesSection />
    <HomeStepPlanSection />
    <HomeTrustSection onLogin={handleLogin} />
    {/* Ekte case: dokumentert før/etter — rendres KUN når CASES er fylt med ekte tall */}
    <CaseStudySection />
    {/* Sosialt bevis: ærlig founding-tilstand (sitater når de finnes) */}
    <SocialProofSection />
    {/* GEO-seksjon: peak-end — siste wow-argument før pris */}
    <GeoShiftSection onSelectPlan={onSelectPlan as (plan: string) => void} />
    <Pricing onSelectPlan={onSelectPlan} />
    <HomeFaqSection />
    {/* Final CTA: fanger opp besøkere som scrollet helt ned — delt GradientCTA */}
    <FinalCta />
    {/* Sticky mobil-CTA: dukker opp etter hero, skjules når gratis-analyse er i view */}
    <StickyCta />
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

// ---------------------------------------------------------
// LEGAL PAGES — Personvern & Vilkår
// Delt layout-komponent så de to sidene ser like ut
// ---------------------------------------------------------



// --- WRAPPER COMPONENTS ---

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
      <button onClick={onBack} className="mb-8 ui-motion text-sm font-bold text-[#5C574C] flex items-center gap-2 rounded-lg px-1 py-0.5 -ml-1 [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A]">
        <ArrowRight className="rotate-180" size={16} /> Tilbake
      </button>

      <h1 className="text-3xl font-black mb-10 text-[#1A1A1A]">Innstillinger</h1>

      <div className="flex flex-col md:flex-row gap-8">
        {/* MENY SIDEBAR */}
        <div className="w-full md:w-64 flex flex-col gap-2">
          <button onClick={() => setActiveTab('general')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] ${activeTab === 'general' ? 'bg-[#1A1A1A] text-white' : 'bg-white text-[#5C574C] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#F2EFE8]'}`}>
            <User size={18} /> Profil & Bedrift
          </button>
          <button onClick={() => setActiveTab('billing')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] ${activeTab === 'billing' ? 'bg-[#1A1A1A] text-white' : 'bg-white text-[#5C574C] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#F2EFE8]'}`}>
            <CreditCard size={18} /> Abonnement
          </button>
        </div>

        {/* INNHOLD */}
        <div className="flex-1">

          {/* FANE 1: PROFIL & BEDRIFT */}
          {activeTab === 'general' && (
            <div className="space-y-6">

              {/* Nettadresse med Lås */}
              <div className="bg-white p-6 rounded-2xl border border-[#E9E4DA] shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-[#1A1A1A]">Nettadresse</h3>
                  {isUrlLocked && <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded-full flex items-center gap-1"><Shield size={10} /> Låst</span>}
                </div>

                <div className={`flex items-center border rounded-lg p-2 transition-colors ${isUrlLocked ? 'bg-[#F2EFE8] border-[#E9E4DA]' : 'bg-white border-[#E9E4DA] focus-within:ring-2 focus-within:ring-violet-500'}`}>
                  <Globe size={18} className="text-[#5C574C] mx-2" />
                  <input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    disabled={isUrlLocked}
                    className={`flex-1 outline-none font-medium ${isUrlLocked ? 'bg-transparent text-[#5C574C] cursor-not-allowed' : 'text-[#1A1A1A]'}`}
                  />
                  {!isUrlLocked && (
                    <button onClick={handleSaveUrl} className="bg-[#1A1A1A] text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-violet-700 transition-colors">
                      Lagre
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[#5C574C] mt-2">
                  <span className="font-bold text-[#5C574C]">OBS:</span> Du kan kun endre nettadressen 1 gang.
                </p>
              </div>

              {/* Bransje (Søkbar) */}
              <div className="bg-white p-6 rounded-2xl border border-[#E9E4DA] shadow-sm">
                <h3 className="font-bold mb-4 text-[#1A1A1A]">Bransje</h3>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-3 text-[#5C574C]" size={18} />
                  <input
                    type="text"
                    placeholder="Søk bransje..."
                    value={industrySearch}
                    onFocus={() => setIsIndustryOpen(true)}
                    onChange={(e) => { setIndustrySearch(e.target.value); setIsIndustryOpen(true); }}
                    className="w-full pl-10 pr-4 py-2.5 border border-[#E9E4DA] rounded-lg bg-white outline-none font-medium text-[#1A1A1A] focus:ring-2 focus:ring-violet-500"
                  />
                  {/* Dropdown liste */}
                  {isIndustryOpen && industrySearch.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-[#E9E4DA] rounded-xl shadow-xl z-20">
                      {filteredIndustries.map((item) => (
                        <button key={item} onClick={() => { setIndustry(item); setIndustrySearch(item); setIsIndustryOpen(false); }} className="w-full text-left px-4 py-3 text-sm font-bold text-[#5C574C] hover:bg-[#F2EFE8] hover:text-[#1A1A1A] transition-colors">
                          {item}
                        </button>
                      ))}
                      {filteredIndustries.length === 0 && <div className="p-3 text-sm text-[#5C574C] italic">Ingen treff...</div>}
                    </div>
                  )}
                </div>
                {industry && <p className="mt-2 text-sm text-[#5C574C] font-bold">Valgt: <span className="text-[#1A1A1A]">{industry}</span></p>}
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
                  <p className="text-[#5C574C] text-xs font-bold uppercase tracking-widest mb-1">Nåværende plan</p>
                  <h3 className="text-3xl font-black mb-2">Gratis</h3>
                  <button className="bg-white text-[#1A1A1A] px-6 py-2.5 rounded-lg font-bold text-sm ui-motion mt-4 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#F2EFE8]">Endre plan</button>
                </div>
                <div className="absolute top-0 right-0 p-32 bg-[#5C574C] rounded-full blur-3xl opacity-20 -mr-16 -mt-16"></div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-[#E9E4DA] shadow-sm">
                <h3 className="font-bold mb-4 text-[#1A1A1A]">Fakturahistorikk</h3>
                <div className="p-4 bg-[#F2EFE8] rounded-lg text-center text-[#5C574C] text-sm font-medium">Ingen fakturaer funnet</div>
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

      const supabase = await getSupabase();
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
      const supabase = await getSupabase();
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
    <div className="min-h-screen bg-[#F2EFE8] flex flex-col items-center justify-center p-4 relative overflow-hidden">

      <div className="absolute inset-0 grid-pattern opacity-[0.04] pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#F2EFE8] blur-[100px] rounded-full pointer-events-none animate-pulse"></div>

      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white/50 p-8 sm:p-12 relative z-10 text-center animate-in fade-in zoom-in-95 duration-[280ms]">

        <div className="w-16 h-16 bg-[#1A1A1A] rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-[rgba(26,26,26,0.08)] rotate-3 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:rotate-6">
          <Sparkles className="text-white w-8 h-8" />
        </div>

        <h2 className="text-3xl font-black text-[#1A1A1A] mb-3 tracking-tight">Velkommen</h2>
        <p className="text-[#5C574C] font-medium mb-8 leading-relaxed">
          Logg inn for å få tilgang til analysen din.
        </p>

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border border-[#E9E4DA] text-[#1A1A1A] font-bold py-4 px-6 rounded-xl ui-motion transition-[border-color,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-sm group [@media(hover:hover)_and_(pointer:fine)]:hover:border-[#E9E4DA] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#F2EFE8] [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-md"
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
          <div className="flex-1 h-px bg-[#E9E4DA]"></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-[#5C574C]">eller</span>
          <div className="flex-1 h-px bg-[#E9E4DA]"></div>
        </div>

        {magicLinkSent ? (
          <div className="bg-[#F2EFE8] border border-emerald-200 rounded-xl p-5 text-left">
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
            <label className="text-xs font-bold text-[#5C574C] block">Logg inn med e-post (uten passord)</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="din@bedrift.no"
              className="w-full p-3 bg-white border border-[#E9E4DA] rounded-xl focus:ring-2 focus:ring-[#5C574C]/25 focus:border-transparent outline-none text-sm"
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
            <p className="text-[10px] text-[#5C574C] text-center pt-1">
              Vi sender en engangs-lenke til e-posten din. Ingen passord å huske på.
            </p>
          </form>
        )}

        <button
          onClick={onBack}
          className="mt-8 text-sm font-bold text-[#5C574C] hover:text-[#5C574C] transition-colors flex items-center justify-center gap-2 mx-auto"
        >
          <ArrowLeft size={16} /> Gå tilbake til forsiden
        </button>

      </div>

      <div className="absolute bottom-6 flex gap-4 text-xs font-bold text-[#5C574C] uppercase tracking-widest">
        <span className="flex items-center gap-1"><ShieldCheck size={12} /> Sikker innlogging</span>
        <span className="flex items-center gap-1"><Key size={12} /> Kryptert</span>
      </div>

    </div>
  );
};



// --- DASHBOARD VIEW (Looker Studio) ---

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
      className="sikt-loading-screen fixed inset-0 z-[100] bg-[#F2EFE8] flex flex-col items-center justify-center overflow-hidden"
      style={{ animation: 'sikt-loader-fade-in 400ms cubic-bezier(0.23, 1, 0.32, 1) forwards', opacity: 0 }}
    >
      <span className="absolute top-5 left-6 text-xl font-black tracking-tight text-slate-900">Sikt.</span>

      <div className="flex flex-col items-center gap-[30px] px-6 max-w-lg w-full">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tighter text-slate-950 leading-tight text-center max-w-md mx-auto">
          Ranger høyere på Google{' '}
          <span className="font-script font-normal text-violet-600 lowercase">automatisk.</span>
        </h1>

        <div className="relative w-[200px] h-[2px] bg-[#E9E4DA] rounded-full overflow-hidden">
          <div className="sikt-loading-sweep h-full w-[35%] bg-[#1A1A1A] rounded-full" />
        </div>

        <p
          aria-live="polite"
          className="text-[13px] font-semibold text-[#5C574C] min-h-[1.25rem] text-center"
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
  // Brukeren velger en PREFERANSE (lys/mørk/system). 'system' følger enhetens
  // OS-innstilling (prefers-color-scheme) og reagerer live når den endres.
  // `theme` (resolved) er den faktiske lys/mørk som UI-et bruker.
  type ThemePref = 'light' | 'dark' | 'system';
  const [themePref, setThemePref] = useState<ThemePref>(() => {
    try {
      const v = localStorage.getItem('sikt_theme');
      if (v === 'light' || v === 'dark' || v === 'system') return v;
    } catch { /* ignore */ }
    return 'system';
  });
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  const theme: 'dark' | 'light' = themePref === 'system' ? (systemDark ? 'dark' : 'light') : themePref;
  const setTheme = (t: ThemePref) => {
    setThemePref(t);
    try { localStorage.setItem('sikt_theme', t); } catch { /* ignore */ }
  };

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

      // Last supabase-SDK-en lazy (holdt ute av forsidens kritiske bane).
      const supabase = await getSupabase();
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

    // Utsett auth-bootstrap til etter første paint slik at marketing-helten/LCP
    // rendres før supabase-SDK-en lastes. requestIdleCallback når nettleseren er
    // ledig, med setTimeout-fallback (Safari) og 2s timeout som sikkerhetsnett.
    const ric: typeof requestIdleCallback | undefined =
      typeof window !== 'undefined' ? (window as any).requestIdleCallback : undefined;
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    if (ric) {
      idleHandle = ric(() => { init(); }, { timeout: 2000 });
    } else {
      timeoutHandle = setTimeout(() => { init(); }, 0);
    }

    return () => {
      isMounted = false;
      if (idleHandle !== null && typeof (window as any).cancelIdleCallback === 'function') {
        (window as any).cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
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
        let formattedUrl = String(client.website_url).trim();
        if (!formattedUrl.startsWith('http')) formattedUrl = 'https://' + formattedUrl;

        const supabase = await getSupabase();
        const { data: { session } } = await supabase.auth.getSession();
        toastInfo('Vi kjører en første analyse av nettsiden din i bakgrunnen...');
        // Marker som «underveis» så portalens auto-scan venter på dette resultatet
        // i stedet for å starte en konkurrerende analyse.
        try { localStorage.setItem(`sikt_first_analysis_pending_${user.id}`, String(Date.now())); } catch { /* ignore */ }

        // Vent på resultatet og lagre RÅ-svaret lokalt. Portalen formaterer og
        // viser det ved innlasting (sikt_first_analysis_raw → analyse-cache),
        // så dashbordet ikke er tomt når kunden kommer inn første gang.
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-pagespeed`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ url: formattedUrl, user_id: user.id }),
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.mobile && data?.desktop) {
            try {
              localStorage.setItem(
                `sikt_first_analysis_raw_${user.id}`,
                JSON.stringify({ url: formattedUrl, mobileRaw: data.mobile, desktopRaw: data.desktop, timestamp: Date.now() }),
              );
            } catch { /* ignore */ }
          }
        }
      } catch (err: any) {
        console.error('[first-analysis] Kunne ikke starte analyse:', err?.message || err);
      } finally {
        try { localStorage.removeItem(`sikt_first_analysis_pending_${user.id}`); } catch { /* ignore */ }
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

      track('plan_selected', { plan });

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
        track('signup_started', { plan });
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (typeof setView === 'function') {
          setView('login');
        }
        return; // Vi beholder låsen på frem til siden er byttet
      }


      const planNavn = plan.toUpperCase();

      // Lenkene leses fra miljøvariabler (VITE_STRIPE_*_LINK). client_reference_id
      // settes av helperen — webhooken bruker den til å koble betalingen mot riktig
      // bruker. Uten den står kunden fast etter betaling.
      const checkoutUrl = buildStripeCheckoutUrl(planNavn, {
        email: currentUser.email || '',
        userId: currentUser.id,
      });

      if (!checkoutUrl) {
        toastError(`Fant ingen betalingslenke for denne pakken: ${plan}. Sjekk at VITE_STRIPE_*_LINK er satt.`);
        return;
      }

      track('checkout_redirect', { plan });
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

  // Bro fra frittstående /priser-side: ?plan=BASIC|STANDARD|PREMIUM ved mount
  // → start plan-valg gjennom den eksisterende checkout-flyten (login → Stripe).
  // App er fortsatt eneste kilde til betalingslogikk; nye sider sender bare planen.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const planParam = new URLSearchParams(window.location.search).get('plan');
    if (!planParam) return;
    // Rydd URL-en så refresh ikke trigger checkout på nytt.
    const clean = window.location.protocol + '//' + window.location.host + window.location.pathname;
    window.history.replaceState({ path: clean }, '', clean);
    handlePlanSelect(planParam.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Når man kommer fra en annen side med en hash (f.eks. /#gratis-analyse),
  // scroll til seksjonen når forsiden er rendret.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = window.location.hash.slice(1);
    if (!id) return;
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }, 300);
  }, []);


  const handleLogout = async () => {
    try {
      const supabase = await getSupabase();
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
      <React.Suspense fallback={<SiktLoadingScreen />}>
        <ClientPortal
          user={user}
          onLogout={handleLogout}
          theme={theme}
          themePref={themePref}
          setTheme={setTheme}
          setView={setView}
          selectedPlan={selectedPlan}
          onSelectPlan={handlePlanSelect}
        />
      </React.Suspense>
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
    <div className="min-h-screen selection:bg-[#E9E4DA] selection:text-[#1A1A1A] bg-[#F2EFE8] relative overflow-x-hidden">
      {devOverlay}

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
