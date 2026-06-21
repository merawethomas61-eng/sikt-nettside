import React, { useState, useEffect, useRef } from 'react';

// --- Helper Component for Scroll Reveal ---
interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'scale';
  className?: string;
}

const RevealOnScroll: React.FC<RevealProps> = ({ children, delay = 0, direction = 'up', className = "" }) => {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) setIsVisible(true);
      });
    }, { threshold: 0.1 });

    if (domRef.current) observer.observe(domRef.current);
    return () => domRef.current && observer.unobserve(domRef.current);
  }, []);

  return (
    <div ref={domRef} className={`reveal reveal-${direction} ${isVisible ? 'visible' : ''} ${className}`} style={{ transitionDelay: isVisible ? `${delay}ms` : '0ms' }}>
      {children}
    </div>
  );
};

export { RevealOnScroll };
export default RevealOnScroll;
