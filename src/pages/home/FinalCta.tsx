import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { GradientCTA } from '../../components/marketing/GradientCTA';
import { PillButton } from '../../components/marketing/PillButton';

/* ------------------------------------------------------------------ *
 * Siste CTA — samme delte GradientCTA som undersidene, så avslutningen
 * er identisk i hele merkevaren. Copy uendret fra gamle FinalCTASection.
 * ------------------------------------------------------------------ */

export const FinalCta = () => (
  <GradientCTA
    eyebrow="Klar til å komme i gang?"
    eyebrowIcon={<Sparkles size={13} />}
    title={
      <>
        Gi Sikt en måned.
        <br />
        <span className="text-violet-200">Du kan alltid si opp.</span>
      </>
    }
    intro="Ingen bindingstid. Rabattert de tre første månedene — 50 %, 30 %, 15 % — så du rekker å se resultater før fullpris. Start med Basic for 790 kr."
    trust={['Ingen bindingstid', 'Si opp når som helst', 'Plain norsk garantert']}
  >
    <PillButton
      variant="lightOnDark"
      size="lg"
      onClick={() => {
        document.getElementById('priser')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }}
    >
      Se pakkene
      <ArrowRight size={20} className="transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1.5" />
    </PillButton>
  </GradientCTA>
);

export default FinalCta;
