import React, { useState } from 'react';
import { Mail, ArrowRight, Check, Clock, MessageSquare, Sparkles, ShieldCheck } from 'lucide-react';
import { PageShell } from '../components/PageShell';
import { Seo } from '../components/Seo';
import { RevealOnScroll } from '../shared/RevealOnScroll';
import { Container } from '../components/marketing/Container';
import { SectionHeading } from '../components/marketing/SectionHeading';
import { Badge } from '../components/marketing/Badge';
import { PillButton } from '../components/marketing/PillButton';
import { GlassCard } from '../components/marketing/GlassCard';
import { companyInfo } from '../shared/companyInfo';

const SUPPORT_EMAIL = companyInfo.supportEmail;

const inputCls =
  'w-full px-5 py-4 rounded-2xl border border-[#E9E4DA] bg-[#F2EFE8] text-[#1A1A1A] font-semibold placeholder:text-[#B3AD9F] focus:outline-none focus:border-violet-400 transition-[border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]';

const perks = [
  { icon: Clock, title: 'Raskt svar', body: 'Vi svarer som regel innen én arbeidsdag.' },
  { icon: MessageSquare, title: 'Ingen salgsmaskin', body: 'Et menneske leser meldingen og svarer ærlig — også om Sikt ikke passer for deg.' },
  { icon: ShieldCheck, title: 'Helt uforpliktende', body: 'Ingen bindingstid, ingen press. Bare et godt svar på plain norsk.' },
];

type SubmitStatus = 'idle' | 'sending' | 'sent' | 'error';

export default function KontaktPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [hp, setHp] = useState(''); // honeypot — skjult for ekte brukere
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const sent = status === 'sent';

  // Faller tilbake til e-postklienten hvis backend ikke er tilgjengelig,
  // slik at en henvendelse aldri går tapt.
  const openMailto = () => {
    const subject = `Henvendelse fra ${name || 'nettsiden'}`;
    const body = `Navn: ${name}\nE-post: ${email}\n\n${message}`;
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, hp }),
      });
      if (res.ok) {
        setStatus('sent');
        return;
      }
      // 503 = e-posttjeneste ikke satt opp ennå → bruk mailto i stedet.
      openMailto();
      setStatus('sent');
    } catch {
      openMailto();
      setStatus('error');
    }
  };

  return (
    <PageShell>
      <Seo
        title="Kontakt oss | Sikt"
        description="Har du spørsmål om Sikt, SEO eller AI-synlighet? Ta kontakt, så svarer vi raskt. Vi snakker plain norsk."
        canonical="https://siktseo.com/kontakt"
        image="https://siktseo.com/og/kontakt.png"
      />

      {/* Hero */}
      <section className="relative pt-6 pb-12 sm:pb-16 hero-gradient overflow-hidden">
        <Container size="md" className="text-center relative z-10">
          <RevealOnScroll direction="up">
            <SectionHeading
              as="h1"
              size="hero"
              align="center"
              badge={<Badge icon={<Mail size={12} />}>Kontakt</Badge>}
              title={<>La oss ta en <span className="text-violet-600">prat.</span></>}
              intro="Lurer du på om Sikt passer for deg? Skriv et par ord, så svarer vi raskt — på plain norsk."
            />
          </RevealOnScroll>
        </Container>
      </section>

      {/* To-kolonne: info + skjema */}
      <Container size="xl" className="pb-20 sm:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* Info */}
          <RevealOnScroll direction="left">
            <div className="space-y-4">
              {perks.map((p) => (
                <div key={p.title} className="flex items-start gap-4 rounded-[24px] bg-white/80 backdrop-blur-sm border border-[#E9E4DA] p-5 sm:p-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#F2EFE8] flex items-center justify-center text-violet-600 shrink-0">
                    <p.icon size={22} />
                  </div>
                  <div>
                    <p className="font-bold text-[#1A1A1A]">{p.title}</p>
                    <p className="text-sm sm:text-base text-[#5C574C] font-medium leading-relaxed">{p.body}</p>
                  </div>
                </div>
              ))}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="flex items-center gap-3 rounded-[24px] bg-[#1A1A1A] text-white p-5 sm:p-6 ui-motion ui-lift-sm [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-700"
              >
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                  <Mail size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Send e-post direkte</p>
                  <p className="font-black tracking-tight">{SUPPORT_EMAIL}</p>
                </div>
              </a>
            </div>
          </RevealOnScroll>

          {/* Skjema */}
          <RevealOnScroll direction="right" delay={100}>
            <GlassCard illu={<Sparkles size={56} />} className="p-6 sm:p-8" lift={false}>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-6">
                  <Badge tone="violet" icon={<Sparkles size={12} />}>Skriv til oss</Badge>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Honeypot — skjult for ekte brukere, fanger bots */}
                  <input
                    type="text"
                    value={hp}
                    onChange={(e) => setHp(e.target.value)}
                    name="company_website"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="absolute -left-[9999px] h-0 w-0 opacity-0"
                  />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Navn"
                    required
                    className={inputCls}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="din@epost.no"
                    required
                    className={inputCls}
                  />
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Hva kan vi hjelpe deg med?"
                    required
                    rows={5}
                    className={`${inputCls} resize-none`}
                  />
                  <PillButton type="submit" variant="dark" className="w-full" disabled={status === 'sending' || sent}>
                    {sent ? (
                      <>
                        <Check size={20} /> Takk! Vi har mottatt meldingen
                      </>
                    ) : status === 'sending' ? (
                      <>Sender …</>
                    ) : (
                      <>
                        Send melding
                        <ArrowRight size={20} className="transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1.5" />
                      </>
                    )}
                  </PillButton>
                  {sent && (
                    <p className="text-sm text-[#5C574C] font-medium text-center">Vi svarer som regel innen én arbeidsdag.</p>
                  )}
                </form>
              </div>
            </GlassCard>
          </RevealOnScroll>
        </div>
      </Container>
    </PageShell>
  );
}
