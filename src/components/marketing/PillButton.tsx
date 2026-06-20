import React from 'react';
import { Link } from 'react-router-dom';

// Pille-knapp i forsidens stil: rounded-full, font-black, ui-motion + ui-lift,
// mørk → hover violet (eller hvit/ghost). Rendres som Link / a / button.
type Variant = 'dark' | 'white' | 'lightOnDark' | 'ghostOnDark';
type Size = 'md' | 'lg';

const base =
  'group inline-flex items-center justify-center gap-3 rounded-full font-black tracking-tight ui-motion ui-lift';

const sizes: Record<Size, string> = {
  md: 'px-8 py-4 text-base',
  lg: 'px-10 py-4 sm:px-12 sm:py-5 text-base sm:text-lg',
};

const variants: Record<Variant, string> = {
  dark:
    'bg-[#1A1A1A] text-white shadow-xl shadow-[rgba(26,26,26,0.08)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-700 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-2xl [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-violet-500/20',
  white:
    'bg-white text-[#1A1A1A] border border-[#EBEBE6] shadow-sm [@media(hover:hover)_and_(pointer:fine)]:hover:border-violet-300 [@media(hover:hover)_and_(pointer:fine)]:hover:text-violet-700',
  lightOnDark:
    'bg-white text-[#1A1A1A] shadow-2xl [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#F5F5F0]',
  ghostOnDark:
    'bg-transparent text-white border border-white/25 [@media(hover:hover)_and_(pointer:fine)]:hover:border-white/50',
};

type PillButtonProps = {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  to?: string;
  href?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
};

export function PillButton({
  children,
  variant = 'dark',
  size = 'md',
  className = '',
  to,
  href,
  onClick,
  type = 'button',
}: PillButtonProps) {
  const cls = `${base} ${sizes[size]} ${variants[variant]} ${className}`;

  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

export default PillButton;
