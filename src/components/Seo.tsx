// Per-side SEO. Forsiden leverer statiske tagger fra index.html; undersidene
// MÅ overstyre dem (ikke duplisere). Derfor styrer vi <head> imperativt:
// vi upserter title/meta/canonical/JSON-LD og gjenoppretter forrige verdi når
// siden forlates — så å gå tilbake til forsiden gir forsidens egne tagger igjen.
// (React 19s native hoisting ville lagt til DUPLIKATER ved siden av index.html.)
import { useEffect } from 'react';

type SeoProps = {
  title: string;
  description?: string;
  /** Full kanonisk URL, f.eks. https://siktseo.com/blogg */
  canonical?: string;
  image?: string;
  type?: 'website' | 'article';
  jsonLd?: object | object[];
  noindex?: boolean;
};

const DEFAULT_IMAGE = 'https://siktseo.com/og-image.png';

export function Seo({
  title,
  description,
  canonical,
  image = DEFAULT_IMAGE,
  type = 'website',
  jsonLd,
  noindex,
}: SeoProps) {
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    const prevTitle = document.title;
    document.title = title;
    cleanups.push(() => {
      document.title = prevTitle;
    });

    const setMeta = (attr: 'name' | 'property', key: string, content?: string) => {
      if (content == null) return;
      let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      let created = false;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
        created = true;
      }
      const prev = el.getAttribute('content');
      el.setAttribute('content', content);
      cleanups.push(() => {
        if (created) el!.remove();
        else if (prev != null) el!.setAttribute('content', prev);
      });
    };

    const setLink = (rel: string, href?: string) => {
      if (!href) return;
      let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      let created = false;
      if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        document.head.appendChild(el);
        created = true;
      }
      const prev = el.getAttribute('href');
      el.setAttribute('href', href);
      cleanups.push(() => {
        if (created) el!.remove();
        else if (prev != null) el!.setAttribute('href', prev);
      });
    };

    setMeta('name', 'description', description);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    setLink('canonical', canonical);

    setMeta('property', 'og:type', type);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', canonical);
    setMeta('property', 'og:image', image);

    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);

    if (jsonLd) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-seo', 'page');
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
      cleanups.push(() => script.remove());
    }

    return () => {
      // Gjenopprett i motsatt rekkefølge.
      for (let i = cleanups.length - 1; i >= 0; i--) cleanups[i]();
    };
  }, [title, description, canonical, image, type, noindex, JSON.stringify(jsonLd)]);

  return null;
}

export default Seo;
