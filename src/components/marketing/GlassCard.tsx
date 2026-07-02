import React from 'react';

// Glasskort i forsidens stil: white/80 + backdrop-blur, myk kant, ui-lift-sm og
// hover-skygge. `illu` legger et svakt dekor-ikon øverst til høyre (som forsiden).
// Padding/innhold styres av forbruker.
export function GlassCard({
  children,
  className = '',
  illu,
  lift = true,
}: {
  children: React.ReactNode;
  className?: string;
  illu?: React.ReactNode;
  lift?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[28px] sm:rounded-[36px] bg-white/80 backdrop-blur-sm border border-[#E9E4DA] ui-motion ${
        lift ? 'ui-lift-sm [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-xl' : ''
      } ${className}`}
    >
      {illu && (
        <div className="pointer-events-none absolute top-4 right-4 text-violet-100/60">{illu}</div>
      )}
      {children}
    </div>
  );
}

export default GlassCard;
