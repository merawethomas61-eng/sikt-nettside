import React from 'react';
import { Check, FileText, TrendingUp, Undo2 } from 'lucide-react';
import { RevealOnScroll } from '../../shared/RevealOnScroll';
import { Frame } from '../../components/marketing/Frame';
import { PanelHeader, LiveChip } from '../../components/marketing/ProductMock';

/* ------------------------------------------------------------------ *
 * Produkt-glimt under hero. Samme mock-språk som Funksjoner-siden
 * (Frame + PanelHeader): rolig, troverdig produkt-UI. Tallene beskriver
 * Sikts eget arbeid (fikser, retning) — aldri oppdiktet trafikk.
 * ------------------------------------------------------------------ */

const KPIS = [
  { label: 'Feil å fikse', value: '0', chip: '−6 denne uka' },
  { label: 'Fikser gjort', value: '7', chip: 'denne uka' },
] as const;

const FEED = [
  'Skrev ny meta-tittel på /tjenester',
  'La til alt-tekst på 4 bilder',
  'Fikset en ødelagt lenke',
] as const;

export const ProductPreview = () => (
  <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-8 sm:-mt-20 md:-mt-32 relative z-20">
    <RevealOnScroll direction="up" delay={200}>
      <Frame glow url="app.siktseo.com">
        <PanelHeader title="Din oversikt" right={<LiveChip />} />
        <div className="bg-[#FBFBFA] p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">

            {/* Hovedspalte: KPI-er + arbeidsfeed */}
            <div className="md:col-span-2 space-y-4 sm:space-y-5">
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {KPIS.map((k) => (
                  <div key={k.label} className="bg-white rounded-xl border border-[#E9E4DA] p-3 sm:p-4">
                    <div className="text-[9px] sm:text-[10px] text-[#5C574C] font-bold uppercase tracking-wide truncate">{k.label}</div>
                    <div className="flex items-end justify-between gap-1 mt-1.5">
                      <span className="text-xl sm:text-3xl font-black text-[#1A1A1A] leading-none">{k.value}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-[#E8F1EB] text-[#15795A] shrink-0 mb-0.5 truncate">{k.chip}</span>
                    </div>
                  </div>
                ))}
                <div className="bg-white rounded-xl border border-[#E9E4DA] p-3 sm:p-4">
                  <div className="text-[9px] sm:text-[10px] text-[#5C574C] font-bold uppercase tracking-wide truncate">Synlighet</div>
                  <div className="flex items-end justify-between gap-2 mt-1.5">
                    <span className="inline-flex items-center gap-1 text-sm sm:text-base font-black text-[#15795A] leading-none">
                      Stigende <TrendingUp size={14} className="shrink-0" />
                    </span>
                  </div>
                  <svg viewBox="0 0 92 26" className="w-full h-5 sm:h-6 mt-1.5" aria-hidden="true">
                    <polyline
                      points="2,21 17,18 32,19 47,13 62,12 77,8 88,5"
                      fill="none"
                      stroke="#15795A"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="88" cy="5" r="2.5" fill="#15795A" />
                  </svg>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#E9E4DA] p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3.5">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-[#5C574C]">Sikt jobber automatisk</span>
                </div>
                <div className="space-y-3">
                  {FEED.map((t) => (
                    <div key={t} className="flex items-center gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-[#E8F1EB] text-[#15795A] flex items-center justify-center">
                        <Check size={13} strokeWidth={2.5} />
                      </span>
                      <span className="flex-1 min-w-0 text-xs sm:text-sm font-medium text-[#1A1A1A] truncate">{t}</span>
                      <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-[#5C574C] border border-[#E9E4DA] rounded-full px-2 py-0.5">
                        <Undo2 size={10} /> Angre
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidespalte: ukerapport + neste sjekk */}
            <div className="space-y-4 sm:space-y-5">
              <div className="bg-white rounded-2xl border border-[#E9E4DA] p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="shrink-0 w-6 h-6 rounded-lg bg-[#F2EFE8] border border-[#E9E4DA] text-[#5C574C] flex items-center justify-center">
                    <FileText size={13} />
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wide text-[#5C574C]">Ukerapport</span>
                </div>
                <p className="font-display italic text-sm sm:text-[15px] text-[#1A1A1A] leading-snug">
                  «Denne uka fikset vi 7 ting på siden din. Her er hva det betyr.»
                </p>
                <p className="text-[10px] text-[#5C574C] font-medium mt-3">Sendes hver mandag — på plain norsk.</p>
              </div>

              <div className="bg-white rounded-2xl border border-[#E9E4DA] px-4 py-3.5 sm:px-5 flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#15795A]" />
                <span className="text-[11px] sm:text-xs font-bold text-[#5C574C]">Neste sjekk om 2 timer</span>
              </div>
            </div>

          </div>
        </div>
      </Frame>
    </RevealOnScroll>
  </div>
);

export default ProductPreview;
