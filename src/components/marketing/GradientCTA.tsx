import React from 'react';
import { Check } from 'lucide-react';
import { RevealOnScroll } from '../../../App';
import { Badge } from './Badge';

// Lilla gradient-CTA i forsidens stil (samme som FinalCTASection): gløde-blobs,
// prikkemønster, badge, font-black-overskrift med lys span, knapper og trygghet-
// punkter. `children` er knappene; sider sender inn egne PillButton-er.
export function GradientCTA({
  eyebrow,
  eyebrowIcon,
  title,
  intro,
  trust,
  children,
}: {
  eyebrow?: React.ReactNode;
  eyebrowIcon?: React.ReactNode;
  title: React.ReactNode;
  intro?: React.ReactNode;
  trust?: string[];
  children?: React.ReactNode;
}) {
  return (
    <section className="relative py-16 sm:py-24 md:py-32 overflow-hidden bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 text-white">
      {/* Dekorative glød-effekter */}
      <div className="absolute top-0 left-1/4 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-[#F5F5F0] rounded-full blur-[100px] sm:blur-[120px] pointer-events-none opacity-60"></div>
      <div className="absolute bottom-0 right-1/4 w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] bg-indigo-400/20 rounded-full blur-[100px] sm:blur-[120px] pointer-events-none"></div>
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }}
      ></div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <RevealOnScroll direction="up">
          {eyebrow && (
            <div className="flex justify-center mb-6 sm:mb-8">
              <Badge tone="onDark" icon={eyebrowIcon}>
                {eyebrow}
              </Badge>
            </div>
          )}

          <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight mb-4 sm:mb-6 leading-[1.1] sm:leading-[1.05]">
            {title}
          </h2>

          {intro && (
            <p className="text-base sm:text-lg md:text-xl text-violet-100 max-w-2xl mx-auto leading-relaxed font-medium mb-8 sm:mb-12 px-2">
              {intro}
            </p>
          )}

          {children && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">{children}</div>
          )}

          {trust && trust.length > 0 && (
            <div className="flex flex-wrap justify-center gap-x-4 sm:gap-x-6 gap-y-3 mt-8 sm:mt-10 text-xs sm:text-sm font-bold text-violet-100">
              {trust.map((t) => (
                <span key={t} className="flex items-center gap-2">
                  <Check size={16} className="text-violet-300" /> {t}
                </span>
              ))}
            </div>
          )}
        </RevealOnScroll>
      </div>
    </section>
  );
}

export default GradientCTA;
