import React from 'react';
import { ArrowRight } from 'lucide-react';
import { RevealOnScroll } from '../../shared/RevealOnScroll';
import { Badge } from '../../components/marketing/Badge';

/* ------------------------------------------------------------------ *
 * «Slik funker det» — nummererte redaksjonelle rader (samme mønster som
 * verdilisten på Om oss), i stedet for tre identiske ikon-fliser.
 * ------------------------------------------------------------------ */

const STEPS = [
  {
    n: '01',
    title: 'Velg plan',
    desc: 'Kom i gang på sekunder — ingen oppstartsmøter, ingen binding.',
    badge: 'Myk start — 50/30/15 % rabatt',
  },
  {
    n: '02',
    title: 'Legg til URL',
    desc: 'Vi analyserer siden din umiddelbart og finner det som stopper deg.',
  },
  {
    n: '03',
    title: 'Se veksten',
    desc: 'Sikt fikser og optimaliserer fortløpende — og forklarer alt på plain norsk.',
  },
] as const;

export const StepPlanSection = () => (
  <section id="prosess" className="py-16 sm:py-24 md:py-28 bg-white relative overflow-hidden scroll-mt-24">
    <div className="max-w-3xl mx-auto px-5 sm:px-6">
      <RevealOnScroll direction="up">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#1A1A1A] mb-3 sm:mb-5">
          3 trinn til suksess
        </h2>
        <p className="text-base sm:text-lg text-[#5C574C] font-medium leading-relaxed mb-10 sm:mb-12 max-w-xl">
          Vi har forenklet SEO. Slik tar vi din bedrift fra usynlig til markedsleder.
        </p>
      </RevealOnScroll>

      <div className="border-t border-[#E9E4DA]">
        {STEPS.map((step, i) => (
          <RevealOnScroll key={step.n} direction="up" delay={i * 80}>
            <div className="grid grid-cols-[3.5rem_1fr] sm:grid-cols-[4rem_1fr] gap-3 sm:gap-8 py-7 sm:py-9 border-b border-[#E9E4DA]">
              <div className="text-3xl sm:text-5xl font-black text-violet-600/25 leading-none">{step.n}</div>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight text-[#1A1A1A]">{step.title}</h3>
                  {'badge' in step && step.badge && <Badge>{step.badge}</Badge>}
                </div>
                <p className="mt-2 text-sm sm:text-base text-[#5C574C] font-medium leading-relaxed max-w-xl">{step.desc}</p>
              </div>
            </div>
          </RevealOnScroll>
        ))}
      </div>

      <RevealOnScroll direction="up" delay={200}>
        <div className="mt-10 sm:mt-12">
          <button
            onClick={() => {
              document.getElementById('priser')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="group ui-motion w-full sm:w-auto flex items-center justify-center gap-3 bg-[#1A1A1A] text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-full font-black text-base sm:text-lg tracking-tight shadow-xl shadow-[rgba(26,26,26,0.08)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-700"
          >
            Ta meg til toppen av Google
            <ArrowRight size={20} className="transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1 shrink-0" />
          </button>
        </div>
      </RevealOnScroll>
    </div>
  </section>
);

export default StepPlanSection;
