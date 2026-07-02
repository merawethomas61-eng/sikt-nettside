import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { track } from '../../analytics';

// Sticky «Sjekk siden din gratis»-bar for mobil. Dukker opp etter at brukeren
// har scrollet forbi hero, og skjules igjen når gratis-analyse-seksjonen selv er
// synlig (da er CTA-en allerede på skjermen). Kun additivt og kun på mobil
// (md:hidden) — på desktop viser navbaren alltid «Kom i gang», og bunn-høyre er
// opptatt av ScrollProgressRing. Respekterer prefers-reduced-motion via
// `motion-reduce`-varianten.
export function StickyCta() {
  const [visible, setVisible] = useState(false);
  const pastHero = useRef(false);
  const auditInView = useRef(false);

  useEffect(() => {
    const update = () => setVisible(pastHero.current && !auditInView.current);

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        pastHero.current = window.scrollY > window.innerHeight * 0.6;
        update();
      });
    };

    // Skjul baren når selve gratis-analyse-seksjonen er i view — da er det
    // doblet opp. rootMargin trekker «synlig» litt inn så det føles naturlig.
    let observer: IntersectionObserver | null = null;
    const target = document.getElementById('gratis-analyse');
    if (target && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        ([entry]) => {
          auditInView.current = entry.isIntersecting;
          update();
        },
        { rootMargin: '0px 0px -40% 0px' },
      );
      observer.observe(target);
    }

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 md:hidden px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#F2EFE8] via-[#F2EFE8]/95 to-transparent transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${
        visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      aria-hidden={!visible}
    >
      <a
        href="#gratis-analyse"
        onClick={() => track('cta_click', { location: 'sticky', target: 'free_analysis' })}
        tabIndex={visible ? 0 : -1}
        className="group flex items-center justify-center gap-2 w-full px-6 py-3.5 bg-[#1A1A1A] text-white rounded-full text-base font-black tracking-tight shadow-xl shadow-[rgba(26,26,26,0.18)] transition-transform active:scale-[0.98]"
      >
        Sjekk siden din gratis
        <ArrowRight size={20} className="transition-transform duration-200 group-active:translate-x-1" />
      </a>
    </div>
  );
}

export default StickyCta;
