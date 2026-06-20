import React from 'react';

// Én kilde til layout-bredde + side-padding for alle marketing-seksjoner.
type Size = 'sm' | 'md' | 'lg' | 'xl';

const widths: Record<Size, string> = {
  sm: 'max-w-2xl',
  md: 'max-w-3xl',
  lg: 'max-w-5xl',
  xl: 'max-w-6xl',
};

export function Container({
  children,
  size = 'lg',
  className = '',
}: {
  children: React.ReactNode;
  size?: Size;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full px-5 sm:px-6 ${widths[size]} ${className}`}>
      {children}
    </div>
  );
}

export default Container;
