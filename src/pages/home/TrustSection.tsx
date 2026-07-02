import React from 'react';
import { ArrowRight, HeartHandshake, ShieldCheck } from 'lucide-react';
import { RevealOnScroll } from '../../shared/RevealOnScroll';

/* ------------------------------------------------------------------ *
 * Founding-garantier — mørk seksjon, slanket fra fem kort til tre rolige.
 * «Vi gjør jobben» og «forsvar/vekst» er foldet inn i intro og kort-tekst.
 * ------------------------------------------------------------------ */

const CARDS = [
  {
    icon: <span className="text-[11px] font-black whitespace-nowrap">3 mnd</span>,
    title: 'Myk oppstart over 3 måneder',
    body: 'SEO tar 60–90 dager å virke. Derfor trapper vi rabatten ned gradvis — 50 % første måned, 30 % andre, 15 % tredje — så du rekker å se resultater før du betaler fullpris. Ingen bindingstid, ingen brå prishopp.',
  },
  {
    icon: <ShieldCheck size={22} />,
    title: 'Din side er trygg',
    body: 'Full backup før alt arbeid, og ingen endringer publiseres uten din godkjenning. Alt Sikt gjør logges med før- og etterverdi og kan angres med ett klikk.',
  },
  {
    icon: <HeartHandshake size={22} />,
    title: 'Founding-pris + grunnlegger på laget',
    body: 'Som en av de første kundene beholder du lav fast pris så lenge abonnementet løper — og du snakker direkte med grunnleggeren, ikke en støtte-kø. Hver uke jobber vi videre med å forsvare posisjonene dine og finne ny vekst.',
  },
] as const;

export const TrustSection = ({ onLogin }: { onLogin: () => void }) => (
  <section className="py-16 sm:py-20 md:py-24 bg-[#1A1A1A] text-white relative overflow-hidden">
    <div className="max-w-6xl mx-auto px-4 sm:px-5 relative z-10 text-center">

      <RevealOnScroll direction="up">
        <div className="mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-white/[0.08] border border-white/15 text-violet-200 text-xs sm:text-sm font-bold mb-6 sm:mb-8">
            <ShieldCheck size={14} className="text-[#52A447]" />
            <span>Founding-kunder · Tidlig tilgang</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 sm:mb-6 leading-tight text-white">
            Bli en av våre <span className="text-violet-300">første kunder</span>
          </h2>
          <p className="text-base sm:text-lg text-white/60 max-w-2xl mx-auto leading-relaxed px-2">
            Vi er et nytt norsk produkt — og helt åpne om det. De første kundene får founding-pris,
            tett oppfølging fra grunnleggeren og null risiko mens vi beviser verdien.
            Din eneste jobb er å si ja eller nei til forslagene våre.
          </p>
        </div>
      </RevealOnScroll>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 text-left">
        {CARDS.map((card, i) => (
          <RevealOnScroll key={card.title} direction="up" delay={i * 80}>
            <div className="h-full bg-white/[0.04] border border-white/10 p-6 sm:p-8 rounded-3xl transition-[background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/[0.07] [@media(hover:hover)_and_(pointer:fine)]:hover:border-white/15">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 sm:mb-6 shrink-0 border border-white/10 bg-white/[0.08] text-violet-300">
                {card.icon}
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-white">{card.title}</h3>
              <p className="text-white/60 text-sm leading-relaxed">{card.body}</p>
            </div>
          </RevealOnScroll>
        ))}
      </div>

      <RevealOnScroll direction="up" delay={200}>
        <div className="mt-10 sm:mt-14">
          <button
            onClick={onLogin}
            className="w-full sm:w-auto bg-white text-[#1A1A1A] px-6 sm:px-8 py-3.5 sm:py-4 rounded-full font-bold text-base sm:text-lg ui-motion shadow-lg shadow-white/10 transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-100 active:scale-[0.98]"
          >
            Start risikofritt i dag <ArrowRight className="inline ml-2" size={20} />
          </button>
          <p className="text-white/45 text-xs mt-4">Ingen liten skrift. Ingen skjulte gebyrer.</p>
        </div>
      </RevealOnScroll>

    </div>
  </section>
);

export default TrustSection;
