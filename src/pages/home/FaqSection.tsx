import React from 'react';
import { HelpCircle } from 'lucide-react';
import { RevealOnScroll } from '../../shared/RevealOnScroll';
import { Badge } from '../../components/marketing/Badge';
import { FaqList } from '../../components/marketing/Faq';
import { homeFaqs } from '../../content/faqData.mjs';

/* ------------------------------------------------------------------ *
 * Forside-FAQ. 12-kolonners redaksjonell splitt (intro-rail + accordion)
 * med den delte, JS-frie <details>-lista fra Priser/bloggen.
 * Tekstene bor i src/content/faqData.mjs — SAMME fil som prerender.mjs
 * bygger FAQPage-schemaet fra, så markup og synlig tekst kan aldri spriker.
 * ------------------------------------------------------------------ */

export { homeFaqs };

export const FaqSection = () => (
  <section className="py-16 sm:py-24 md:py-28 bg-transparent relative overflow-hidden">
    <div className="max-w-7xl mx-auto px-5 sm:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-20">
        <div className="lg:col-span-4">
          <RevealOnScroll direction="left">
            <div className="mb-6">
              <Badge icon={<HelpCircle size={11} />}>Det du lurer på</Badge>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-[#1A1A1A] mb-6 leading-tight tracking-tight">
              Spørsmål vi <br className="hidden lg:block" /> faktisk får.
            </h2>
            <p className="text-[#5C574C] font-medium text-sm sm:text-lg leading-relaxed max-w-md">
              Ærlige svar på det folk lurer på før de prøver Sikt. Ingen salgssnakk.
            </p>
          </RevealOnScroll>
        </div>

        <div className="lg:col-span-8">
          <RevealOnScroll direction="up" delay={100}>
            <FaqList items={homeFaqs.map((f) => ({ q: f.q, a: f.a }))} />
          </RevealOnScroll>
        </div>
      </div>
    </div>
  </section>
);

export default FaqSection;
