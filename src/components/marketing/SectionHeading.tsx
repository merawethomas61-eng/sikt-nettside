import React from 'react';

// Overskrift-blokk i forsidens stil: valgfri badge → font-black-tittel (med farget
// <span> på linje to) → valgfri ingress. `title` er ReactNode så sider kan markere
// aksent-ord, f.eks. <span className="text-violet-600">.
type Size = 'hero' | 'section' | 'sub';

const titleSizes: Record<Size, string> = {
  hero: 'text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.05]',
  section: 'text-3xl sm:text-4xl md:text-5xl leading-[1.1]',
  sub: 'text-2xl sm:text-3xl leading-tight',
};

export function SectionHeading({
  badge,
  title,
  intro,
  align = 'left',
  as: Tag = 'h2',
  size = 'section',
  className = '',
  introClassName = '',
}: {
  badge?: React.ReactNode;
  title: React.ReactNode;
  intro?: React.ReactNode;
  align?: 'left' | 'center';
  as?: 'h1' | 'h2';
  size?: Size;
  className?: string;
  introClassName?: string;
}) {
  const center = align === 'center';
  return (
    <div className={`${center ? 'text-center' : ''} ${className}`}>
      {badge && <div className={`mb-6 ${center ? 'flex justify-center' : ''}`}>{badge}</div>}
      <Tag className={`font-black tracking-tight text-[#1A1A1A] ${titleSizes[size]}`}>{title}</Tag>
      {intro && (
        <p
          className={`mt-5 sm:mt-6 text-base sm:text-lg md:text-xl text-[#808080] font-medium leading-relaxed ${center ? 'mx-auto max-w-2xl' : 'max-w-2xl'} ${introClassName}`}
        >
          {intro}
        </p>
      )}
    </div>
  );
}

export default SectionHeading;
