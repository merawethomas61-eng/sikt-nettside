import React from 'react';
import { RevealOnScroll } from '../../shared/RevealOnScroll';

/* ------------------------------------------------------------------ *
 * «Er dette for meg» — kompakt typografisk bånd. Bransjene som tekst-chips
 * med hairline-kant i stedet for ikon-grid: raskere å skanne, roligere
 * uttrykk, og et bevisst symmetrisk pust mellom to splitt-seksjoner.
 * ------------------------------------------------------------------ */

const INDUSTRIES = [
  { name: 'Håndverker', example: 'rørlegger, elektriker, snekker' },
  { name: 'Klinikk & helse', example: 'tannlege, fysioterapeut, kiropraktor' },
  { name: 'Nettbutikk', example: 'alt fra klær til spesialprodukter' },
  { name: 'Restaurant & kafé', example: 'spisested, bakeri, catering' },
  { name: 'Byrå & konsulent', example: 'advokat, regnskap, rådgivning' },
  { name: 'Eiendom & bolig', example: 'megler, utleie, boligbyggere' },
] as const;

export const IndustriesSection = () => (
  <section className="py-14 sm:py-20 bg-transparent relative overflow-hidden">
    <div className="max-w-4xl mx-auto px-5 sm:px-6 text-center">
      <RevealOnScroll direction="up">
        <div className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#5C574C] mb-4">
          Er dette for meg
        </div>
        <h2 className="text-2xl sm:text-4xl font-black text-[#1A1A1A] mb-4 tracking-tight leading-tight">
          Sikt hjelper <span className="text-violet-600">bedrifter som dere.</span>
        </h2>
        <p className="text-base sm:text-lg text-[#5C574C] font-medium max-w-2xl mx-auto">
          Hvis kundene dine søker etter deg på Google — så fungerer Sikt for deg.
        </p>
      </RevealOnScroll>

      <RevealOnScroll direction="up" delay={120}>
        <div className="mt-8 sm:mt-10 flex flex-wrap justify-center gap-2.5 sm:gap-3">
          {INDUSTRIES.map((industry) => (
            <span
              key={industry.name}
              className="inline-flex items-baseline gap-1.5 bg-white border border-[#E9E4DA] rounded-full px-4 py-2 text-xs sm:text-sm"
            >
              <span className="font-black text-[#1A1A1A]">{industry.name}</span>
              <span className="hidden sm:inline font-medium text-[#5C574C]">— {industry.example}</span>
            </span>
          ))}
        </div>
        <p className="text-xs sm:text-sm text-[#5C574C] font-medium mt-7 italic">
          Driver du noe annet? Sikt fungerer for alle bransjer der Google er kilden til kunder.
        </p>
      </RevealOnScroll>
    </div>
  </section>
);

export default IndustriesSection;
