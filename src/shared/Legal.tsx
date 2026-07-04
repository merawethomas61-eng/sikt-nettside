import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { companyInfo, legalEntityLabel } from './companyInfo';

const SUPPORT_EMAIL = companyInfo.supportEmail;

const LegalPage = ({ title, lastUpdated, onBack, children }: {
  title: string;
  lastUpdated: string;
  onBack: () => void;
  children: React.ReactNode;
}) => (
  <section className="min-h-screen bg-white pt-32 pb-24 sm:pt-40 sm:pb-32">
    <div className="max-w-3xl mx-auto px-5 sm:px-6">
      <button
        onClick={onBack}
        className="ui-motion inline-flex items-center gap-2 text-sm font-bold text-[#808080] mb-10 rounded-lg px-1 py-0.5 -ml-1 [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A]"
      >
        <ArrowLeft size={16} />
        Tilbake til forsiden
      </button>

      <div className="mb-12">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-[#1A1A1A] tracking-tight mb-4 leading-tight">
          {title}
        </h1>
        <p className="text-sm text-[#808080] font-bold uppercase tracking-widest">
          Sist oppdatert: {lastUpdated}
        </p>
      </div>

      <div className="prose-legal space-y-8 text-[#1A1A1A] leading-relaxed">
        {children}
      </div>

      <div className="mt-16 pt-10 border-t border-[#EBEBE6] text-sm text-[#808080]">
        <p className="mb-2">
          Har du spørsmål? Kontakt oss på{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#1A1A1A] font-bold hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </div>

    <style dangerouslySetInnerHTML={{ __html: `
      .prose-legal h2 {
        font-size: 1.5rem;
        font-weight: 900;
        color: rgb(2 6 23);
        margin-top: 2.5rem;
        margin-bottom: 1rem;
        letter-spacing: -0.025em;
      }
      .prose-legal h3 {
        font-size: 1.125rem;
        font-weight: 800;
        color: rgb(15 23 42);
        margin-top: 1.5rem;
        margin-bottom: 0.5rem;
      }
      .prose-legal p { margin-bottom: 1rem; font-size: 0.95rem; }
      .prose-legal ul { list-style: disc; padding-left: 1.5rem; margin-bottom: 1rem; }
      .prose-legal ul li { margin-bottom: 0.5rem; font-size: 0.95rem; }
      .prose-legal strong { color: rgb(15 23 42); font-weight: 700; }
      .prose-legal a { color: rgb(124 58 237); font-weight: 600; }
      .prose-legal a:hover { text-decoration: underline; }
    `}} />
  </section>
);


const PrivacyPage = ({ onBack }: { onBack: () => void }) => (
  <LegalPage title="Personvern" lastUpdated="3. juli 2026" onBack={onBack}>
    <p>
      {legalEntityLabel} ("vi", "oss", "Sikt") respekterer personvernet ditt. Denne erklæringen forklarer på plain norsk hvilke opplysninger vi samler inn, hvordan vi bruker dem, og hvilke rettigheter du har.
    </p>

    <h2>1. Hvem er behandlingsansvarlig?</h2>
    <p>
      {legalEntityLabel} er behandlingsansvarlig for personopplysningene vi samler inn om deg.
      Kontakt: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
    </p>

    <h2>2. Hvilke opplysninger samler vi inn?</h2>

    <h3>Opplysninger du gir oss</h3>
    <ul>
      <li><strong>Konto-informasjon:</strong> navn, e-post og passord når du registrerer deg.</li>
      <li><strong>Bedriftsinformasjon:</strong> nettsideadresse, bransje og informasjon du oppgir i onboarding-skjemaet.</li>
      <li><strong>Betalingsinformasjon:</strong> håndteres av Stripe — vi lagrer aldri kortdetaljer selv.</li>
      <li><strong>Gratis analyse:</strong> e-postadressen og nettadressen du oppgir når du bestiller gratis analyse. Vi bruker dem til å sende deg rapporten og relevante oppfølgingstips (behandlingsgrunnlag: samtykke). Hver e-post har avmeldingslenke, og du kan når som helst be oss slette opplysningene.</li>
    </ul>

    <h3>Opplysninger vi henter automatisk</h3>
    <ul>
      <li><strong>Google Search Console-data:</strong> hvis du kobler til kontoen din, henter vi søkestatistikk om nettsiden din (søkeord, klikk, visninger).</li>
      <li><strong>Google Analytics-data:</strong> trafikk- og besøkendedata fra din egen nettside (ikke fra siktseo.com).</li>
      <li><strong>Teknisk data:</strong> IP-adresse, nettleser, og tidspunkt for besøk — brukes til sikkerhet og feilsøking.</li>
    </ul>

    <h2>3. Hvorfor behandler vi opplysningene?</h2>
    <ul>
      <li>For å levere tjenesten du har betalt for (analyser, rapporter, anbefalinger).</li>
      <li>For å sende viktige meldinger om kontoen og tjenesten din.</li>
      <li>For å forbedre produktet (anonymisert statistikk).</li>
      <li>For å oppfylle rettslige krav (regnskap, skatt).</li>
    </ul>

    <h2>4. Hvem deler vi data med?</h2>
    <p>Vi selger aldri data. Vi deler kun med tredjeparter som er nødvendige for å drive tjenesten:</p>
    <ul>
      <li><strong>Supabase</strong> — lagring av konto og data (servere i EU).</li>
      <li><strong>Stripe</strong> — betalingshåndtering.</li>
      <li><strong>Google</strong> — gjennom deres offisielle API-er (Search Console, Analytics, PageSpeed).</li>
      <li><strong>OpenAI / Google AI</strong> — AI-analyser og Sikt AI-funksjoner. Data sendes anonymisert så langt det er mulig.</li>
      <li><strong>Resend</strong> — utsending av e-post (rapporter, kvitteringer og kontaktskjema).</li>
      <li><strong>PostHog</strong> — produktanalyse på siktseo.com. Brukes kun hvis du samtykker i cookie-banneret (se punkt 8).</li>
      <li><strong>Sentry</strong> — feillogging, slik at vi oppdager og retter tekniske feil raskt.</li>
      <li><strong>Vercel</strong> — drift og hosting av nettsiden.</li>
    </ul>

    <h2>5. Hvor lenge lagrer vi data?</h2>
    <p>
      Vi lagrer kontodata så lenge du er aktiv kunde. Hvis du sier opp, sletter vi konto og data innen 90 dager — med unntak av det vi må oppbevare etter norsk regnskapslov (typisk 5 år for fakturaer).
    </p>

    <h2>6. Dine rettigheter (GDPR)</h2>
    <p>Du har rett til å:</p>
    <ul>
      <li>Få innsyn i hvilke opplysninger vi har om deg.</li>
      <li>Få korrigert feil informasjon.</li>
      <li>Få slettet opplysningene dine ("retten til å bli glemt").</li>
      <li>Få utlevert en kopi av dine data (dataportabilitet).</li>
      <li>Klage til <a href="https://www.datatilsynet.no" target="_blank" rel="noopener">Datatilsynet</a> hvis du mener vi behandler data feil.</li>
    </ul>
    <p>
      Send oss en e-post på <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> så ordner vi det innen 5 dager.
    </p>

    <h2>7. Sikkerhet</h2>
    <p>
      Vi bruker kryptering (HTTPS/TLS) for all dataoverføring. Passord lagres som hash (aldri i klartekst). Tilgang til databasen er begrenset til sertifisert personell, og vi har rutiner for varsling ved sikkerhetshendelser.
    </p>

    <h2>8. Cookies</h2>
    <p>
      Vi bruker <strong>nødvendige cookies</strong> for innlogging og økthåndtering. De kan ikke velges bort — uten dem virker ikke innloggingen.
    </p>
    <p>
      I tillegg bruker vi <strong>valgfrie analyse-cookies</strong> (PostHog) for å forstå hvordan nettsiden brukes, slik at vi kan forbedre den. Disse settes kun hvis du takker ja i samtykke-banneret. Du kan når som helst trekke samtykket tilbake ved å slette nettleserdata for siktseo.com, eller ved å kontakte oss. Vi bruker ikke cookies til reklame, og vi selger aldri data.
    </p>

    <h2>9. Endringer</h2>
    <p>
      Vi oppdaterer denne erklæringen når tjenesten endrer seg. Vesentlige endringer varsles på e-post minst 30 dager i forveien.
    </p>
  </LegalPage>
);


const TermsPage = ({ onBack }: { onBack: () => void }) => (
  <LegalPage title="Vilkår for bruk" lastUpdated="3. juli 2026" onBack={onBack}>
    <p>
      Disse vilkårene gjelder mellom deg som kunde ("du") og {legalEntityLabel} ("Sikt", "vi"). Ved å registrere deg og betale for tjenesten, godtar du vilkårene.
    </p>

    <h2>1. Tjenesten</h2>
    <p>
      Sikt leverer SEO-analyser, AI-drevne anbefalinger og rapporter for din nettside. Tjenesten leveres som et abonnement med tre pakker: Basic, Standard og Premium. Innholdet i hver pakke er beskrevet på <a href="/">siktseo.com</a> og kan endres med 30 dagers forhåndsvarsel.
    </p>

    <h2>2. Konto og ansvar</h2>
    <ul>
      <li>Du må oppgi korrekte opplysninger ved registrering.</li>
      <li>Du er selv ansvarlig for å holde passordet ditt hemmelig.</li>
      <li>Du kan ikke bruke tjenesten til ulovlige formål eller til å skade andres nettsider.</li>
      <li>Du må eie eller ha tillatelse til å analysere den nettsiden du legger inn.</li>
    </ul>

    <h2>3. Priser og betaling</h2>
    <ul>
      <li>Alle priser er oppgitt i norske kroner (NOK). Merverdiavgift (MVA) kommer i tillegg først når Sikt blir mva-registrert; du varsles før det eventuelt skjer.</li>
      <li>Betaling skjer månedlig via Stripe. Kort belastes automatisk den samme datoen hver måned.</li>
      <li>De tre første månedene gis med nedtrappende introrabatt: 50 % første måned, 30 % andre måned, 15 % tredje måned. Fra fjerde måned betales full pris.</li>
      <li>Vi kan justere priser med 30 dagers varsel. Du kan alltid si opp før en prisjustering trer i kraft.</li>
    </ul>

    <h2>4. Oppsigelse, angrerett og refusjon</h2>
    <ul>
      <li><strong>Ingen bindingstid.</strong> Du kan si opp når som helst fra dashbordet.</li>
      <li>Oppsigelsen gjelder fra neste betalingsperiode — du beholder tilgang ut den måneden du har betalt for.</li>
      <li><strong>Angrerett:</strong> er du forbruker, har du 14 dagers angrerett fra avtaleinngåelsen. Tjenesten starter umiddelbart på din anmodning, og ved bruk av angreretten betaler du forholdsmessig for perioden frem til du ga beskjed — resten refunderes. Se <a href="/angrerett">angrerett-siden</a> for fremgangsmåte og angreskjema.</li>
      <li>Utover angreretten refunderer vi ikke allerede betalte måneder, men du kan bruke tjenesten ut perioden.</li>
      <li>Ved tekniske feil på vår side som gjør tjenesten uten verdi en hel måned, refunderer vi den måneden.</li>
    </ul>

    <h2>5. Immaterielle rettigheter</h2>
    <p>
      Rapporter, analyser og anbefalinger vi lager for deg tilhører deg — du kan bruke dem fritt til å forbedre din egen nettside. Sikt beholder eierskapet til selve plattformen, AI-modellene og tilknyttet teknologi.
    </p>

    <h2>6. Ansvarsbegrensning</h2>
    <p>
      Sikt leverer analyse, anbefalinger og verktøy — vi kan ikke garantere spesifikke resultater på Google. Rangering avhenger av mange faktorer utenfor vår kontroll (konkurranse, algoritmeendringer, din egen implementering).
    </p>
    <p>
      Vårt totale erstatningsansvar begrenses til det du har betalt i de siste 12 måneder. Vi er ikke ansvarlige for indirekte tap, tapt omsetning eller følgeskader.
    </p>

    <h2>7. Endringer i vilkårene</h2>
    <p>
      Vi kan oppdatere disse vilkårene. Vesentlige endringer varsles på e-post minst 30 dager i forveien. Hvis du ikke godtar endringene, kan du si opp før de trer i kraft.
    </p>

    <h2>8. Tvisteløsning og lovvalg</h2>
    <p>
      Disse vilkårene er underlagt norsk lov. Hvis vi ikke klarer å løse en uenighet minnelig, avgjøres saken ved {companyInfo.venue} som verneting.
    </p>

    <h2>9. Kontakt</h2>
    <p>
      Spørsmål om vilkårene? Send en e-post til <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
    </p>
  </LegalPage>
);

// Angrerettloven gjelder forbrukere som kjøper på nett. Tjenesten starter
// umiddelbart på kundens anmodning → forholdsmessig betaling ved angring (§ 26).
// Standard angreskjema er lovpålagt informasjon og ligger inline nederst.
const AngrerettPage = ({ onBack }: { onBack: () => void }) => {
  const angreMailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Bruk av angrerett')}&body=${encodeURIComponent(
    'Jeg gir med dette melding om at jeg ønsker å gå fra min avtale om kjøp av abonnement hos Sikt.\n\nNavn:\nE-post brukt ved kjøpet:\nDato for kjøpet:\n'
  )}`;
  return (
    <LegalPage title="Angrerett" lastUpdated="3. juli 2026" onBack={onBack}>
      <p>
        Handler du som forbruker (privatperson), har du 14 dagers angrerett etter angrerettloven når du kjøper abonnement hos {legalEntityLabel} på nett. Her forklarer vi hva det betyr i praksis.
      </p>

      <h2>1. Hvem gjelder angreretten for?</h2>
      <p>
        Angreretten gjelder deg som handler som forbruker. Kjøper du på vegne av en bedrift eller i næringsvirksomhet, gjelder angrerettloven som hovedregel ikke — da gjelder de ordinære oppsigelsesreglene i <a href="/vilkar">vilkårene</a> (ingen bindingstid, si opp når som helst).
      </p>

      <h2>2. Fristen</h2>
      <p>
        Angrefristen er 14 dager fra dagen avtalen ble inngått, altså dagen du gjennomførte kjøpet. Det er nok at du sender melding om at du vil angre før fristen løper ut.
      </p>

      <h2>3. Tjenesten starter med en gang</h2>
      <p>
        Når du kjøper, ber du samtidig om at tjenesten starter umiddelbart — analysene begynner å kjøre fra første dag. Angrer du etter at tjenesten har startet, skal du etter angrerettloven § 26 betale forholdsmessig for perioden fra kjøpet frem til vi mottok meldingen om at du angrer. Resten av det du har betalt, refunderes til samme betalingsmiddel innen 14 dager.
      </p>

      <h2>4. Slik angrer du</h2>
      <p>
        Send en e-post til <a href={angreMailto}>{SUPPORT_EMAIL}</a> og si at du vil bruke angreretten — det finnes ingen formkrav, men oppgi navnet og e-posten du brukte ved kjøpet. Du kan også bruke standard angreskjema under.
      </p>

      <h3>Standard angreskjema</h3>
      <p>
        Fyll ut og send dette skjemaet kun dersom du ønsker å gå fra avtalen:
      </p>
      <ul>
        <li>Til: {legalEntityLabel}, e-post: {SUPPORT_EMAIL}</li>
        <li>Jeg underretter herved om at jeg ønsker å gå fra min avtale om kjøp av følgende tjeneste: abonnement hos Sikt (Basic/Standard/Premium).</li>
        <li>Avtalen ble inngått den: (dato for kjøpet)</li>
        <li>Forbrukerens navn:</li>
        <li>Forbrukerens adresse:</li>
        <li>Dato:</li>
      </ul>

      <h2>5. Etter angrefristen</h2>
      <p>
        Etter at de 14 dagene er ute, gjelder de ordinære oppsigelsesreglene i <a href="/vilkar">vilkårene</a>: ingen bindingstid, du kan si opp når som helst fra dashbordet, og du beholder tilgang ut perioden du har betalt for.
      </p>
    </LegalPage>
  );
};

export { PrivacyPage, TermsPage, AngrerettPage };
