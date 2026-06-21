import React from 'react';
import type { PortalTheme } from '../portalTheme';

// PrimaryButton — én primær CTA-stil. Brukes til hovedhandlinger.
const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: 'md' | 'lg';
}> = ({ className = '', size = 'md', children, ...rest }) => {
  const sizeClass = size === 'lg' ? 'px-6 py-3 text-sm' : 'px-4 py-2.5 text-sm';
  return (
    <button
      {...rest}
      className={`${sizeClass} rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium transition-colors inline-flex items-center justify-center gap-2 ${className}`}
    >
      {children}
    </button>
  );
};

// SecondaryButton — diskré sekundær handling.
const SecondaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {
  theme: PortalTheme;
}> = ({ theme, className = '', children, ...rest }) => (
  <button
    {...rest}
    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors inline-flex items-center justify-center gap-2 ${
      theme === 'light'
        ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
        : 'bg-slate-800 border border-white/10 text-slate-200 hover:bg-slate-700'
    } ${className}`}
  >
    {children}
  </button>
);

export { PrimaryButton, SecondaryButton };
