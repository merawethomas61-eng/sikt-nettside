import React from 'react';
import { ArrowRight, X } from 'lucide-react';
import { RevealOnScroll } from '../../shared/RevealOnScroll';
import { Frame } from '../../components/marketing/Frame';
import { Badge } from '../../components/marketing/Badge';
import { track } from '../../analytics';

/* ------------------------------------------------------------------ *
 * Problem-seksjonen. Slår sammen de gamle PainPoints-, Insight- og
 * StoryBrand-seksjonene til ÉN redaksjonell splitt: tekst + smerte-liste
 * til venstre, et ærlig «slik ser du ut på Google i dag»-utsnitt til høyre.
 * ------------------------------------------------------------------ */

const PAINS = [
  'Lave Google-rangeringer hindrer din suksess.',
  'Bortkastet tid på strategier som ikke virker.',
  'Frustrasjon over manglende kunder.',
  'Tapte muligheter for vekst og salg.',
] as const;

// Ett svakt søkeresultat under to sterke konkurrenter — problemet, vist.
const SerpMock = () => (
  <Frame url="google.com/søk?q=rørlegger+i+nærheten">
    <div className="bg-[#FBFBFA] p-4 sm:p-6 space-y-3">
      {[
        { w: 'w-3/4', o: 'opacity-90' },
        { w: 'w-2/3', o: 'opacity-70' },
      ].map((row, i) => (
        <div key={i} className={`rounded-xl bg-white p-3.5 border border-[#E9E4DA] ${row.o}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-5 h-5 rounded-full bg-[#F2EFE8] border border-[#E9E4DA]" />
            <div className="h-2 bg-[#E9E4DA] rounded-full w-24" />
          </div>
          <div className={`h-2.5 bg-[#5C574C]/30 rounded-full ${row.w} mb-1.5`} />
          <div className="h-2 bg-[#E9E4DA] rounded-full w-5/6" />
        </div>
      ))}
      <div className="rounded-xl bg-white p-3.5 border border-[#E9E4DA] opacity-50">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-5 h-5 rounded-full bg-[#F2EFE8] border border-[#E9E4DA] flex items-center justify-center text-[9px] font-black text-[#5C574C]">D</span>
          <div className="leading-tight min-w-0">
            <div className="text-[11px] font-semibold text-[#1A1A1A]">Bedriften din</div>
            <div className="text-[10px] text-[#5C574C] truncate">dinbedrift.no</div>
          </div>
        </div>
        <h5 className="text-sm font-bold leading-snug text-[#5C574C]">Hjem</h5>
        <p className="text-xs text-[#5C574C] leading-relaxed mt-1">Velkommen til vår nettside. Vi tilbyr tjenester.</p>
      </div>
      <p className="text-[11px] text-[#5C574C] font-medium text-center pt-1">
        Slik ser mange småbedrifter ut for Google i dag — nederst og anonyme.
      </p>
    </div>
  </Frame>
);

export const ProblemSection = () => (
  <section className="py-16 sm:py-24 md:py-28 bg-transparent relative overflow-hidden">
    <div className="max-w-6xl mx-auto px-5 sm:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 xl:gap-20 items-center">

        <RevealOnScroll direction="left">
          <div className="mb-5">
            <Badge>Vi forstår problemet</Badge>
          </div>
          <h2 className="font-black tracking-tight text-3xl sm:text-4xl md:text-5xl leading-[1.1] text-[#1A1A1A]">
            Føles markedsføringen <span className="text-violet-600">ineffektiv?</span>
          </h2>
          <p className="mt-5 text-base sm:text-lg leading-relaxed font-medium text-[#5C574C]">
            Du legger ned timer og kroner — men telefonen ringer ikke. Du er ikke alene,
            og det er ikke din feil: SEO og AI-søk har blitt et eget fag.
          </p>
          <ul className="mt-7 space-y-3.5">
            {PAINS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm sm:text-base font-semibold text-[#1A1A1A]">
                <span className="mt-px shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-white border border-[#E9E4DA] text-[#B4231F]">
                  <X size={12} strokeWidth={2.5} />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <div className="mt-9 flex flex-col items-start gap-3">
            <a
              href="#gratis-analyse"
              onClick={() => track('cta_click', { location: 'painpoints', target: 'free_analysis' })}
              className="group inline-flex items-center gap-2 px-8 py-4 bg-[#1A1A1A] text-white rounded-full text-sm sm:text-base font-black tracking-tight ui-motion [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-700"
            >
              Sjekk siden din gratis
              <ArrowRight size={18} className="transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1" />
            </a>
            <span className="text-xs sm:text-sm text-[#5C574C] font-semibold">Gratis · ingen bindingstid</span>
          </div>
        </RevealOnScroll>

        <RevealOnScroll direction="right" delay={120}>
          <SerpMock />
        </RevealOnScroll>

      </div>
    </div>
  </section>
);

export default ProblemSection;
