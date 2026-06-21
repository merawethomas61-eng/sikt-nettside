import React from 'react';
import { Check } from 'lucide-react';
import { RevealOnScroll } from '../../shared/RevealOnScroll';

// Redaksjonell feature-rad: tekst på én side, ekte produkt-mockup på den andre,
// vekslende side nedover via `reverse`. Hovedgrepet mot «repetitivt / malete» preg
// — erstatter symmetriske kort-grid med en variert zig-zag. Gjenbrukes på de andre
// marketing-sidene. `tone="dark"` brukes inne i en mørk seksjon.
export function FeatureSplit({
  eyebrow,
  title,
  body,
  points,
  media,
  reverse = false,
  tone = 'light',
  className = '',
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  points?: string[];
  media: React.ReactNode;
  reverse?: boolean;
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const dark = tone === 'dark';
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 xl:gap-20 items-center ${className}`}>
      {/* Tekst */}
      <RevealOnScroll
        direction={reverse ? 'right' : 'left'}
        className={reverse ? 'lg:order-2' : ''}
      >
        {eyebrow && <div className="mb-5">{eyebrow}</div>}
        <h3
          className={`font-black tracking-tight text-2xl sm:text-3xl md:text-4xl leading-[1.1] ${
            dark ? 'text-white' : 'text-[#1A1A1A]'
          }`}
        >
          {title}
        </h3>
        {body && (
          <p
            className={`mt-5 text-base sm:text-lg leading-relaxed font-medium ${
              dark ? 'text-white/70' : 'text-[#808080]'
            }`}
          >
            {body}
          </p>
        )}
        {points && points.length > 0 && (
          <ul className="mt-7 space-y-3.5">
            {points.map((p) => (
              <li
                key={p}
                className={`flex items-start gap-3 text-sm sm:text-base font-semibold ${
                  dark ? 'text-white/85' : 'text-[#1A1A1A]'
                }`}
              >
                <span
                  className={`mt-px shrink-0 flex items-center justify-center w-5 h-5 rounded-full ${
                    dark
                      ? 'bg-violet-500/20 text-violet-300'
                      : 'bg-[rgba(63,143,56,0.1)] text-[#3F8F38]'
                  }`}
                >
                  <Check size={13} strokeWidth={2.5} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        )}
      </RevealOnScroll>

      {/* Media */}
      <RevealOnScroll
        direction={reverse ? 'left' : 'right'}
        delay={120}
        className={reverse ? 'lg:order-1' : ''}
      >
        {media}
      </RevealOnScroll>
    </div>
  );
}

export default FeatureSplit;
