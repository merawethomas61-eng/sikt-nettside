import React from 'react';
import { ChevronDown } from 'lucide-react';

// Tilgjengelig, JS-fri accordion (native <details>). Chevron roterer via transform
// (group-open) — emil-konformt. Brukes på Priser og bloggen.
export const FaqItem: React.FC<{ q: string; a: React.ReactNode }> = ({ q, a }) => {
  return (
    <details className="group bg-white/80 backdrop-blur-sm border border-[#EBEBE6] rounded-2xl px-5 sm:px-6 ui-motion [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-sm">
      <summary className="flex items-center justify-between gap-4 cursor-pointer list-none py-4 sm:py-5 text-[#1A1A1A] font-bold text-base sm:text-lg [&::-webkit-details-marker]:hidden">
        {q}
        <ChevronDown
          size={20}
          className="text-[#808080] shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-open:rotate-180"
        />
      </summary>
      <div className="pb-5 -mt-1 text-[#808080] font-medium leading-relaxed">{a}</div>
    </details>
  );
};

export function FaqList({ items, className = '' }: { items: { q: string; a: React.ReactNode }[]; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {items.map((f, i) => (
        <FaqItem key={i} q={f.q} a={f.a} />
      ))}
    </div>
  );
}

export default FaqItem;
