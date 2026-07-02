import React from 'react';
import { Check, Sparkles } from 'lucide-react';
import { Frame } from '../../components/marketing/Frame';
import { Badge } from '../../components/marketing/Badge';
import { FeatureSplit } from '../../components/marketing/FeatureSplit';
import { PanelHeader } from '../../components/marketing/ProductMock';

/* ------------------------------------------------------------------ *
 * «Hvorfor Sikt». Slår sammen gamle ValueProposition + StoryBrand-løftet.
 * Media: en «plain norsk»-kvittering — byrå-sjargong strøket over, Sikts
 * oversettelse under. Seksjonen beviser sitt eget budskap.
 * ------------------------------------------------------------------ */

const PlainNorskMock = () => (
  <Frame>
    <PanelHeader
      title="Månedsrapport"
      right={
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#15795A] bg-[#E8F1EB] border border-[#D6EEDF] rounded-full px-2.5 py-0.5">
          Plain norsk
        </span>
      }
    />
    <div className="bg-[#FBFBFA] p-4 sm:p-6 space-y-3">
      <div className="rounded-xl bg-white p-4 border border-[#E9E4DA]">
        <div className="text-[10px] uppercase tracking-wide text-[#5C574C] font-bold mb-2">Slik sier byråene det</div>
        <p className="text-sm text-[#5C574C] leading-relaxed line-through decoration-[#B4231F]/50">
          «CTR i SERP økte 14 % etter title-tag-optimalisering og schema-implementering.»
        </p>
      </div>
      <div className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-widest text-violet-600">
        <span className="h-px w-6 bg-[#E9E4DA]" />
        Sikt sier
        <span className="h-px w-6 bg-[#E9E4DA]" />
      </div>
      <div className="rounded-xl bg-white p-4 border border-[#15795A]/40 shadow-sm">
        <p className="text-sm sm:text-[15px] text-[#1A1A1A] font-semibold leading-relaxed">
          «Flere klikker på deg på Google nå, fordi vi skrev om titlene dine så de svarer på det folk faktisk søker etter.»
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-[#15795A]">
          <Check size={13} strokeWidth={2.5} /> Forstått på første lesning
        </span>
      </div>
    </div>
  </Frame>
);

export const WhySiktSection = () => (
  <section className="py-16 sm:py-24 md:py-28 bg-white relative overflow-hidden">
    <div className="max-w-6xl mx-auto px-5 sm:px-6">
      <FeatureSplit
        reverse
        eyebrow={<Badge icon={<Sparkles size={11} />}>Hvorfor Sikt</Badge>}
        title={
          <>
            Andre byråer snakker tech. <span className="text-violet-600">Vi snakker norsk.</span>
          </>
        }
        body="Du driver en bedrift, ikke et IT-selskap. Vi bruker AI til å gi deg en konkret oppskrift på å nå toppen — og oversetter alt det tekniske til plain norsk, helt uten gjetting."
        points={[
          'Rapporter på norsk du faktisk leser — hva vi gjorde, og hva det betydde',
          'Spør Sikt AI hva som helst — svar du forstår på 10 sekunder',
          'Vi måler i kunder og omsetning, ikke bounce rate',
        ]}
        media={<PlainNorskMock />}
      />
    </div>
  </section>
);

export default WhySiktSection;
