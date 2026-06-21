import React, { useState, useEffect } from 'react';

// Google-snippet-forhåndsvisning. Delt mellom App (onboarding/preview) og
// ClientPortal (verksted), så begge viser identisk SERP-utdrag.
function googleSnippetBreadcrumb(url: string): string {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./i, '');
    const path = parsed.pathname.replace(/\/$/, '');
    if (!path || path === '/') return domain;
    const pathPart = path.split('/').filter(Boolean).join(' › ');
    return `${domain} › ${pathPart}`;
  } catch {
    return url;
  }
}

function googleSnippetDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return url;
  }
}

function googleSnippetSiteName(url: string): string {
  const domain = googleSnippetDomain(url);
  const base = domain.split('.')[0] || domain;
  if (!base) return domain;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function GoogleSnippetPreview({
  title,
  url,
  description,
  variant = 'desktop',
}: {
  title: string;
  url: string;
  description: string;
  variant?: 'desktop' | 'mobile';
}) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const isMobile = variant === 'mobile';
  const domain = googleSnippetDomain(url);
  const siteName = googleSnippetSiteName(url);
  const breadcrumb = googleSnippetBreadcrumb(url);
  const displayTitle = title?.trim() || '(Ingen tittel)';
  const faviconSize = isMobile ? 24 : 32;
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;

  useEffect(() => {
    setFaviconFailed(false);
  }, [domain, url]);

  const fontStack = "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif";

  return (
    <div
      className="ws-snippet-preview-enter"
      style={{
        padding: isMobile ? '10px 12px' : '14px 16px',
        background: '#FFFFFF',
        maxWidth: isMobile ? 380 : undefined,
        fontFamily: fontStack,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: isMobile ? 10 : 12, marginBottom: isMobile ? 8 : 10 }}>
        {faviconFailed ? (
          <span
            style={{
              width: faviconSize,
              height: faviconSize,
              borderRadius: '50%',
              background: '#EBEBE6',
              flexShrink: 0,
              marginTop: 2,
            }}
          />
        ) : (
          <img
            src={faviconUrl}
            alt=""
            width={faviconSize}
            height={faviconSize}
            onError={() => setFaviconFailed(true)}
            style={{ borderRadius: '50%', flexShrink: 0, marginTop: 2, objectFit: 'cover' }}
          />
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              margin: 0,
              fontSize: isMobile ? 13 : 14,
              fontWeight: 500,
              color: '#202124',
              lineHeight: 1.3,
              wordBreak: 'break-word',
            }}
          >
            {siteName}
          </p>
          <p
            style={{
              margin: '2px 0 0',
              fontSize: 12,
              color: '#5f6368',
              lineHeight: 1.35,
              wordBreak: 'break-word',
            }}
          >
            {breadcrumb}
          </p>
        </div>
      </div>
      <p
        style={{
          margin: '0 0 6px',
          fontSize: isMobile ? 18 : 20,
          fontWeight: 400,
          color: '#1a0dab',
          lineHeight: 1.3,
          display: '-webkit-box',
          WebkitLineClamp: 1,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
          wordBreak: 'break-word',
        }}
      >
        {displayTitle}
      </p>
      {description?.trim() ? (
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: '#4d5156',
            lineHeight: 1.58,
            display: '-webkit-box',
            WebkitLineClamp: isMobile ? 3 : 2,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
            wordBreak: 'break-word',
          }}
        >
          {description}
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: 14, color: '#808080', fontStyle: 'italic', lineHeight: 1.58 }}>
          (Ingen beskrivelse — Google vil generere én automatisk)
        </p>
      )}
    </div>
  );
}

export { GoogleSnippetPreview };
