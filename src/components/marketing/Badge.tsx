import React from 'react';

// Pille-etikett (eyebrow) i forsidens stil. Standard = grønn (som forsiden),
// med valgfritt lite ikon. `onDark` brukes på mørke/gradient-seksjoner.
type Tone = 'green' | 'violet' | 'onDark';

const tones: Record<Tone, string> = {
  green: 'bg-[rgba(63,143,56,0.09)] text-[#3F8F38] border border-[#EBEBE6]',
  violet: 'bg-violet-50 text-violet-700 border border-violet-100',
  onDark: 'bg-white/10 text-white border border-white/20 backdrop-blur-md',
};

export function Badge({
  children,
  icon,
  tone = 'green',
  className = '',
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest ${tones[tone]} ${className}`}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}

export default Badge;
