import { createClient } from '@supabase/supabase-js'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'rapport@siktseo.com'
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

// Estimert verdi per organisk klikk (NOK) — konservativt anslag for hva et
// tilsvarende Google Ads-klikk ville kostet. Brukes til ROI-linjen i kvitteringen.
const CLICK_VALUE_NOK = 8

type SiktAction = {
  action_type: string
  category: string
  title: string
  details: Record<string, unknown> | null
  page_url: string | null
  created_at: string
  status?: string | null
}

type Client = {
  user_id: string
  email: string
  company_name: string | null
  contact_person: string | null
  package_name: string
  website_url: string | null
}

type Opportunity = {
  keyword: string
  recommendation_text: string | null
  estimated_traffic: number | null
  difficulty: string | number | null
  search_volume: number | null
}

Deno.serve(async (req) => {
  // Krev secret token i custom header så kun pg_cron kan kalle denne
  const cronSecret = req.headers.get('x-cron-secret')
  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Hent alle betalende kunder med e-post
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('user_id, email, company_name, contact_person, package_name, website_url')
    .not('package_name', 'is', null)
    .not('email', 'is', null)

  if (clientsError || !clients) {
    console.error('Feil ved henting av kunder:', clientsError)
    return new Response('Feil ved henting av kunder', { status: 500 })
  }

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  let sentCount = 0
  let errorCount = 0

  for (const client of clients as Client[]) {
    if (!client.email || !client.package_name) continue

    const plan = client.package_name // "Basic Pakke", "Standard Pakke", "Premium Pakke"
    const isStandardOrAbove = plan === 'Standard Pakke' || plan === 'Premium Pakke'
    const isPremium = plan === 'Premium Pakke'

    // Hent ukens handlinger for denne brukeren
    const { data: actions } = await supabase
      .from('sikt_actions')
      .select('action_type, category, title, details, page_url, created_at, status')
      .eq('user_id', client.user_id)
      .gte('created_at', oneWeekAgo)
      .order('created_at', { ascending: false })

    const weekActions = (actions ?? []) as SiktAction[]

    const fixes = weekActions.filter(a => a.category === 'fix')
    const findings = weekActions.filter(a => a.category === 'finding')
    const suggestions = weekActions.filter(a => a.category === 'suggestion')
    const alerts = weekActions.filter(a => a.category === 'alert')

    // GEO (Premium): nevner AI-assistentene bedriften denne uka? + trend mot forrige uke.
    let geoMentioned = 0
    let geoTotal = 0
    let geoScore = 0                       // 0–100 denne uka
    let geoPrevScore: number | null = null // 0–100 forrige uke (null = ingen historikk)
    if (isPremium) {
      const { data: geo } = await supabase
        .from('geo_checks')
        .select('mentioned, checked_at')
        .eq('user_id', client.user_id)
        .gte('checked_at', twoWeeksAgo)
      const rows = (geo ?? []) as { mentioned: boolean; checked_at: string }[]
      const thisWeek = rows.filter(g => g.checked_at >= oneWeekAgo)
      const lastWeek = rows.filter(g => g.checked_at < oneWeekAgo)
      geoTotal = thisWeek.length
      geoMentioned = thisWeek.filter(g => g.mentioned).length
      geoScore = geoTotal > 0 ? Math.round((geoMentioned / geoTotal) * 100) : 0
      if (lastWeek.length > 0) {
        geoPrevScore = Math.round((lastWeek.filter(g => g.mentioned).length / lastWeek.length) * 100)
      }
    }

    const companyName = client.company_name ?? 'Din bedrift'
    const firstName = client.contact_person ? client.contact_person.split(' ')[0] : null
    const websiteUrl = client.website_url ?? ''

    // Hent totaltall siden start
    const { data: allActions } = await supabase
      .from('sikt_actions')
      .select('category, created_at, status')
      .eq('user_id', client.user_id)

    // Lim-inn-fremgang: forslag tatt unna denne uka + forslag som fortsatt venter
    const doneThisWeek = weekActions.filter(a => a.category === 'suggestion' && a.status === 'done').length
    const openSuggestions = ((allActions ?? []) as { category: string; status?: string | null }[])
      .filter(a => a.category === 'suggestion' && a.status === 'open').length

    const totalFixes = (allActions ?? []).filter(a => a.category === 'fix').length
    const totalFindings = (allActions ?? []).filter(a => a.category === 'finding').length
    const firstAction = (allActions ?? []).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]
    const weeksActive = firstAction
      ? Math.max(1, Math.round((Date.now() - new Date(firstAction.created_at).getTime()) / (7 * 24 * 60 * 60 * 1000)))
      : 1

    // Ukens mulighet: høyest-verdi vekstmulighet (gap-søkeord fra konkurrentanalysen).
    // Gjør kvitteringen offensiv — og sørger for at den aldri er tom.
    const { data: oppRows } = await supabase
      .from('keyword_opportunities')
      .select('keyword, recommendation_text, estimated_traffic, difficulty, search_volume')
      .eq('user_id', client.user_id)
      .order('estimated_traffic', { ascending: false, nullsFirst: false })
      .limit(1)
    const topOpportunity = ((oppRows ?? []) as Opportunity[])[0] ?? null

    // ROI: ekte Google-klikk nå vs. for ~4 uker siden + estimert kroneverdi.
    // Reframer kvitteringen fra «aktivitet» til «penger». Kilde: GSC (keywords)
    // + keyword_snapshots (ukentlig historikk). Vises kun når data finnes.
    let gscClicks = 0
    let gscImpressions = 0
    let priorClicks: number | null = null
    {
      const { data: site } = await supabase
        .from('sites').select('id').eq('user_id', client.user_id).maybeSingle()
      if (site?.id) {
        const { data: kw } = await supabase
          .from('keywords').select('clicks, impressions').eq('site_id', site.id)
        for (const r of (kw ?? []) as { clicks: number | null; impressions: number | null }[]) {
          gscClicks += r.clicks ?? 0
          gscImpressions += r.impressions ?? 0
        }
      }
      // Forrige måned: eldste snapshot mellom 25 og 40 dager tilbake
      const from = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
      const to = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
      const { data: snaps } = await supabase
        .from('keyword_snapshots').select('clicks, captured_at')
        .eq('user_id', client.user_id).gte('captured_at', from).lte('captured_at', to)
        .order('captured_at', { ascending: true })
      if (snaps && snaps.length) {
        const firstDay = (snaps[0] as { captured_at: string }).captured_at.slice(0, 10)
        priorClicks = (snaps as { clicks: number | null; captured_at: string }[])
          .filter(s => s.captured_at.slice(0, 10) === firstDay)
          .reduce((sum, s) => sum + (s.clicks ?? 0), 0)
      }
    }
    const estValue = Math.round(gscClicks * CLICK_VALUE_NOK)
    const clicksDeltaPct = (priorClicks && priorClicks > 0)
      ? Math.round(((gscClicks - priorClicks) / priorClicks) * 100)
      : null

    const html = buildEmailHtml({
      companyName,
      firstName,
      websiteUrl,
      plan,
      fixes,
      findings,
      suggestions,
      alerts,
      isStandardOrAbove,
      isPremium,
      totalFixes,
      totalFindings,
      weeksActive,
      geoMentioned,
      geoTotal,
      geoScore,
      geoPrevScore,
      topOpportunity,
      doneThisWeek,
      openSuggestions,
      gscClicks,
      gscImpressions,
      clicksDeltaPct,
      estValue,
    })

    const subject = buildSubject({ fixes, findings, plan, topOpportunity })

    const result = await sendEmail({
      to: client.email,
      subject,
      html,
    })

    if (result.ok) {
      sentCount++
    } else {
      errorCount++
      console.error(`Feil ved sending til ${client.email}:`, await result.text())
    }
  }

  console.log(`✅ Ukesrapport sendt: ${sentCount} ok, ${errorCount} feil`)
  return new Response(
    JSON.stringify({ sent: sentCount, errors: errorCount }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})

async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Sikt <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    }),
  })
}

function buildSubject({ fixes, findings, plan, topOpportunity }: { fixes: SiktAction[]; findings: SiktAction[]; plan: string; topOpportunity: Opportunity | null }): string {
  if (fixes.length > 0) return `Sikt fikset ${fixes.length} ting for deg denne uken`
  if (findings.length > 0) return `Sikt fant ${findings.length} ting du bør se på denne uken`
  // Stille uke på arbeid → led med vekst, aldri en tom «rapport»
  if (topOpportunity) return `Ukens mulighet: ${topOpportunity.keyword}`
  if (plan === 'Premium Pakke') return `Din ukentlige SEO og AI-rapport fra Sikt`
  return `Din ukentlige rapport fra Sikt`
}

function row(items: SiktAction[], borderColor: string): string {
  return items.slice(0, 5).map(a => `
    <tr>
      <td style="width:3px;background:${borderColor};border-radius:2px" valign="top">&nbsp;</td>
      <td style="padding-left:16px;padding-bottom:18px">
        <div style="font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">${escapeHtml(a.title)}</div>
        ${a.details && (a.details as Record<string,string>).explanation
          ? `<div style="font-size:13px;color:#6b6880;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">${escapeHtml((a.details as Record<string,string>).explanation)}</div>`
          : a.page_url
            ? `<div style="font-size:13px;color:#9591a8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">${escapeHtml(a.page_url)}</div>`
            : ''
        }
      </td>
    </tr>
  `).join('')
}

function opportunitySection(opp: Opportunity | null, isStandardOrAbove: boolean, lightWeek: boolean): string {
  if (!opp) return ''

  const traffic = typeof opp.estimated_traffic === 'number' && opp.estimated_traffic > 0
    ? `~${opp.estimated_traffic} flere besøk/mnd hvis du tar den`
    : null

  const recommendation = opp.recommendation_text
    ? escapeHtml(opp.recommendation_text)
    : `En konkurrent rangerer på «${escapeHtml(opp.keyword)}» — det gjør ikke du ennå. Tar du dette søkeordet, henter du trafikken deres.`

  const action = isStandardOrAbove
    ? 'Sikt tar tak i denne for deg — du ser den i neste kvittering.'
    : 'Med Standard fikser Sikt slike muligheter automatisk. På Basic får du oppskriften — gjør det selv, eller oppgrader.'

  // Fremhevet kort (lys lilla) når det er ukens hovedsak; ellers samme stil som øvrige seksjoner.
  const bg = lightWeek ? '#faf7ff' : '#ffffff'
  const border = lightWeek ? '#e4d8fb' : '#e2e0ea'

  return `
  <tr><td style="padding-top:32px">
    <div style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:2px;margin-bottom:18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">Ukens mulighet</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="background:${bg};border:1px solid ${border};border-radius:14px;padding:20px">
        <div style="font-size:17px;font-weight:800;color:#1a1a2e;margin-bottom:6px;letter-spacing:-0.3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">${escapeHtml(opp.keyword)}</div>
        ${traffic ? `<div style="display:inline-block;background:#f0e9fe;color:#6b21a8;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;margin-bottom:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">${traffic}</div>` : ''}
        <div style="font-size:14px;color:#6b6880;line-height:1.65;margin-bottom:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">${recommendation}</div>
        <div style="font-size:13px;color:#7c3aed;font-weight:700;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">${action}</div>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding-top:32px;border-bottom:1px solid #e2e0ea"></td></tr>
  `
}

function section(label: string, content: string): string {
  return `
    <tr><td style="padding-top:32px">
      <div style="font-size:11px;font-weight:700;color:#9591a8;text-transform:uppercase;letter-spacing:2px;margin-bottom:18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">${label}</div>
      <table width="100%" cellpadding="0" cellspacing="0">${content}</table>
    </td></tr>
    <tr><td style="padding-top:32px;border-bottom:1px solid #e2e0ea"></td></tr>
  `
}

function buildEmailHtml(opts: {
  companyName: string
  firstName: string | null
  websiteUrl: string
  plan: string
  fixes: SiktAction[]
  findings: SiktAction[]
  suggestions: SiktAction[]
  alerts: SiktAction[]
  isStandardOrAbove: boolean
  isPremium: boolean
  totalFixes: number
  totalFindings: number
  weeksActive: number
  geoMentioned: number
  geoTotal: number
  geoScore: number
  geoPrevScore: number | null
  topOpportunity: Opportunity | null
  doneThisWeek: number
  openSuggestions: number
  gscClicks: number
  gscImpressions: number
  clicksDeltaPct: number | null
  estValue: number
}): string {
  const { firstName, websiteUrl, plan, fixes, findings, suggestions, alerts, isStandardOrAbove, isPremium, totalFixes, totalFindings, weeksActive, geoMentioned, geoTotal, geoScore, geoPrevScore, topOpportunity, doneThisWeek, openSuggestions, gscClicks, gscImpressions, clicksDeltaPct, estValue } = opts

  const now = new Date()
  const weekNum = Math.ceil((now.getDate() + new Date(now.getFullYear(), now.getMonth(), 1).getDay()) / 7)
  const monthName = now.toLocaleDateString('nb-NO', { month: 'long' })
  const dateStr = now.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })

  const findFindCount = findings.length + suggestions.length
  const lightWeek = fixes.length === 0 && findings.length === 0 && suggestions.length === 0 && alerts.length === 0

  // Aldri «0 ting». Tom arbeidsuke → led med vekst (Ukens mulighet) eller vedlikehold.
  const italic = (t: string) => `<span style="font-family:Georgia,serif;font-style:italic;font-weight:400">${t}</span>`
  let headlineHtml: string
  let sublineHtml: string
  if (fixes.length > 0) {
    headlineHtml = `${italic('Denne uken')} fikset vi<br>${fixes.length} ting for deg.`
    sublineHtml = `Alt skjedde automatisk${websiteUrl ? ` på <strong style="color:#1a1a2e">${escapeHtml(websiteUrl)}</strong>` : ''} og du trengte ikke å gjøre noe.`
  } else if (findFindCount > 0) {
    headlineHtml = `${italic('Denne uken')} fant vi<br>${findFindCount} ting du bør se på.`
    sublineHtml = `Vi gikk gjennom${websiteUrl ? ` <strong style="color:#1a1a2e">${escapeHtml(websiteUrl)}</strong>` : ' nettstedet ditt'} og fant nye forbedringer du kan ta tak i.`
  } else if (topOpportunity) {
    headlineHtml = `${italic('Denne uken')} jaktet vi<br>vekst for deg.`
    sublineHtml = `Ingen nye feil dukket opp — grunnmuren er i god form. Så vi brukte uken på å finne neste mulighet til å klatre.`
  } else {
    headlineHtml = `${italic('Denne uken')} holdt vi<br>vakt for deg.`
    sublineHtml = `Ingen nye feil, ingen drop${websiteUrl ? ` på <strong style="color:#1a1a2e">${escapeHtml(websiteUrl)}</strong>` : ''}. Vi overvåket siden og konkurrentene dine døgnet rundt så du slapp.`
  }

  // GEO-trend (Premium): badge som viser bevegelse i AI-synlighet mot forrige uke.
  let geoTrendHtml = ''
  if (geoPrevScore === null) {
    geoTrendHtml = `<span style="display:inline-block;background:#f0e9fe;color:#6b21a8;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px">Ny måling</span>`
  } else {
    const delta = geoScore - geoPrevScore
    if (delta > 0) {
      geoTrendHtml = `<span style="display:inline-block;background:#e7f7ee;color:#137a47;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px">&#9650; +${delta} fra forrige uke</span>`
    } else if (delta < 0) {
      geoTrendHtml = `<span style="display:inline-block;background:#fdeeee;color:#b42318;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px">&#9660; ${delta} fra forrige uke</span>`
    } else {
      geoTrendHtml = `<span style="display:inline-block;background:#f0eff4;color:#6b6880;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px">&#8594; uendret fra forrige uke</span>`
    }
  }

  return `<!DOCTYPE html>
<html lang="no">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0eff4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0eff4;padding:32px 16px">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%">

  <!-- LOGO -->
  <tr><td style="padding:40px 0 36px">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="width:34px;height:34px;background:linear-gradient(135deg,#2d1054,#6b21a8);border-radius:9px;text-align:center;vertical-align:middle">
        <span style="font-size:18px;font-weight:900;color:#fff;line-height:34px;font-family:Georgia,serif">S</span>
      </td>
      <td style="padding-left:11px;font-size:15px;font-weight:700;color:#1a1a2e;letter-spacing:-0.2px">Sikt</td>
    </tr></table>
  </td></tr>

  <!-- INTRO -->
  <tr><td style="padding-bottom:32px;border-bottom:1px solid #e2e0ea">
    <div style="font-size:12px;color:#9591a8;font-weight:600;margin-bottom:14px;text-transform:uppercase;letter-spacing:1.5px">Uke ${weekNum} — ${dateStr}</div>
    ${firstName ? `<div style="font-size:15px;color:#6b6880;margin-bottom:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">Hei, <span style="color:#1a1a2e;font-weight:700">${escapeHtml(firstName)}</span></div>` : ''}
    <div style="font-size:28px;font-weight:800;color:#1a1a2e;line-height:1.25;margin-bottom:14px;letter-spacing:-0.5px">
      ${headlineHtml}
    </div>
    <div style="font-size:15px;color:#6b6880;line-height:1.7;margin-bottom:28px">${sublineHtml}</div>
  </td></tr>

  ${opportunitySection(topOpportunity, isStandardOrAbove, lightWeek)}

  ${fixes.length > 0 ? section('Fikset av Sikt', row(fixes, '#7c3aed')) : ''}
  ${findings.length > 0 ? section('Vi fant også', row(findings, '#e2e0ea')) : ''}
  ${suggestions.length > 0 ? section('AI-forslag', row(suggestions, '#e2e0ea')) : ''}

  ${(doneThisWeek > 0 || openSuggestions > 0) ? `
  <tr><td style="padding-top:24px">
    <div style="font-size:13px;color:#6b6880;line-height:1.7;background:#ffffff;border:1px solid #e2e0ea;border-radius:12px;padding:14px 16px">
      ${doneThisWeek > 0 ? `<strong style="color:#137a47">Du tok unna ${doneThisWeek} forslag denne uken — sterkt!</strong> ` : ''}${openSuggestions > 0 ? `${openSuggestions} forslag venter på deg i <a href="https://siktseo.com/portal" style="color:#7c3aed;font-weight:700;text-decoration:none">Sikt-loggen</a> — hvert av dem er ferdig skrevet, klart til å limes inn.` : 'Alt er tatt unna. Ny påfyll kommer.'}
    </div>
  </td></tr>
  ` : ''}

  ${isStandardOrAbove ? `
  <tr><td style="padding-top:32px">
    <div style="font-size:11px;font-weight:700;color:#9591a8;text-transform:uppercase;letter-spacing:2px;margin-bottom:18px">Konkurrentene dine</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:3px;background:#e2e0ea;border-radius:2px" valign="top">&nbsp;</td>
        <td style="padding-left:16px;padding-bottom:16px">
          <div style="font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:4px">Vi holder øye mens du jobber</div>
          <div style="font-size:13px;color:#6b6880;line-height:1.6">Hvis en konkurrent publiserer noe nytt, endrer priser eller klatrer på Google får du vite det. Du slipper å følge med selv.</div>
          <a href="https://siktseo.com/portal" style="display:inline-block;margin-top:10px;font-size:13px;font-weight:700;color:#7c3aed;text-decoration:none">Se konkurrentoversikt</a>
        </td>
      </tr>
    </table>
  </td></tr>
  <tr><td style="padding-top:32px;border-bottom:1px solid #e2e0ea"></td></tr>
  ` : ''}

  ${isPremium ? `
  <tr><td style="padding-top:32px">
    <div style="font-size:11px;font-weight:700;color:#9591a8;text-transform:uppercase;letter-spacing:2px;margin-bottom:18px">AI-synlighet</div>
    ${geoTotal > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="background:#faf7ff;border:1px solid #e4d8fb;border-radius:14px;padding:22px">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="top">
            <div style="font-size:42px;font-weight:800;color:#1a1a2e;line-height:1;letter-spacing:-1px">${geoScore}<span style="font-size:20px;color:#9591a8;font-weight:700">/100</span></div>
            <div style="font-size:13px;color:#6b6880;font-weight:600;margin-top:6px">AI-synlighet denne uken</div>
          </td>
          <td valign="top" align="right">${geoTrendHtml}</td>
        </tr></table>
        <div style="font-size:13px;color:#6b6880;line-height:1.6;margin-top:16px;padding-top:16px;border-top:1px solid #ece4fb">
          Nevnt i <strong style="color:#1a1a2e">${geoMentioned} av ${geoTotal}</strong> AI-svar. Vi stilte ChatGPT, Gemini og Perplexity bransjespørsmål en kunde ville brukt${geoMentioned > 0 ? ' — og du dukket opp.' : '. Vi jobber med å få deg inn i svarene.'}
        </div>
      </td></tr>
    </table>
    ` : `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:3px;background:#7c3aed;border-radius:2px" valign="top">&nbsp;</td>
        <td style="padding-left:16px;padding-bottom:16px">
          <div style="font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:4px">Nevner ChatGPT deg?</div>
          <div style="font-size:13px;color:#6b6880;line-height:1.6">Stadig flere kunder spør AI-assistenter om anbefalinger istedenfor Google. Vi sjekker ukentlig om ChatGPT, Gemini og Perplexity nevner bedriften din.</div>
        </td>
      </tr>
    </table>
    `}
    <a href="https://siktseo.com/portal" style="display:inline-block;margin-top:14px;font-size:13px;font-weight:700;color:#7c3aed;text-decoration:none">Se AI-synlighetsrapport</a>
  </td></tr>
  <tr><td style="padding-top:32px;border-bottom:1px solid #e2e0ea"></td></tr>
  ` : ''}

  ${gscClicks > 0 ? `
  <!-- ROI: hva arbeidet er verdt -->
  <tr><td style="padding-top:32px">
    <div style="font-size:11px;font-weight:700;color:#9591a8;text-transform:uppercase;letter-spacing:2px;margin-bottom:18px">Hva dette er verdt</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="background:#f3fbf6;border:1px solid #cdeed9;border-radius:14px;padding:22px">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="top">
            <div style="font-size:34px;font-weight:800;color:#137a47;line-height:1;letter-spacing:-0.5px">~${estValue.toLocaleString('nb-NO')} kr<span style="font-size:16px;color:#6b9e82;font-weight:700">/mnd</span></div>
            <div style="font-size:13px;color:#5a7e6a;font-weight:600;margin-top:6px">Estimert verdi av Google-trafikken din</div>
          </td>
          ${clicksDeltaPct !== null ? `<td valign="top" align="right"><span style="display:inline-block;background:${clicksDeltaPct >= 0 ? '#e7f7ee' : '#fdeeee'};color:${clicksDeltaPct >= 0 ? '#137a47' : '#b42318'};font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px">${clicksDeltaPct >= 0 ? '&#9650; +' : '&#9660; '}${clicksDeltaPct}% klikk vs forrige mnd</span></td>` : ''}
        </tr></table>
        <div style="font-size:13px;color:#5a7e6a;line-height:1.6;margin-top:16px;padding-top:16px;border-top:1px solid #d8efe0">
          <strong style="color:#137a47">${gscClicks.toLocaleString('nb-NO')}</strong> klikk fra <strong style="color:#137a47">${gscImpressions.toLocaleString('nb-NO')}</strong> visninger i Google siste 28 dager. Verdien er hva tilsvarende annonseklikk ville kostet (~${CLICK_VALUE_NOK} kr/klikk).
        </div>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding-top:32px;border-bottom:1px solid #e2e0ea"></td></tr>
  ` : ''}

  <!-- SIDEN DU STARTET -->
  <tr><td style="padding-top:32px">
    <div style="font-size:11px;font-weight:700;color:#9591a8;text-transform:uppercase;letter-spacing:2px;margin-bottom:18px">Siden du startet med Sikt</div>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="width:25%;padding-right:8px">
        <div style="text-align:center;background:#ffffff;border-radius:12px;padding:16px 8px;border:1px solid #e2e0ea">
          <div style="font-size:22px;font-weight:800;color:#7c3aed;letter-spacing:-0.5px">${totalFixes}</div>
          <div style="font-size:11px;color:#9591a8;font-weight:600;margin-top:4px;line-height:1.4">ting fikset</div>
        </div>
      </td>
      <td style="width:25%;padding-right:8px">
        <div style="text-align:center;background:#ffffff;border-radius:12px;padding:16px 8px;border:1px solid #e2e0ea">
          <div style="font-size:22px;font-weight:800;color:#7c3aed;letter-spacing:-0.5px">${totalFindings}</div>
          <div style="font-size:11px;color:#9591a8;font-weight:600;margin-top:4px;line-height:1.4">funn oppdaget</div>
        </div>
      </td>
      <td style="width:25%;padding-right:8px">
        <div style="text-align:center;background:#ffffff;border-radius:12px;padding:16px 8px;border:1px solid #e2e0ea">
          <div style="font-size:22px;font-weight:800;color:#7c3aed;letter-spacing:-0.5px">${totalFixes + totalFindings}</div>
          <div style="font-size:11px;color:#9591a8;font-weight:600;margin-top:4px;line-height:1.4">totalt utført</div>
        </div>
      </td>
      <td style="width:25%">
        <div style="text-align:center;background:#ffffff;border-radius:12px;padding:16px 8px;border:1px solid #e2e0ea">
          <div style="font-size:22px;font-weight:800;color:#7c3aed;letter-spacing:-0.5px">${weeksActive}</div>
          <div style="font-size:11px;color:#9591a8;font-weight:600;margin-top:4px;line-height:1.4">uker aktiv</div>
        </div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding-top:32px;border-bottom:1px solid #e2e0ea"></td></tr>

  <!-- SIGN OFF -->
  <tr><td style="padding-top:36px">
    <div style="font-size:15px;color:#6b6880;line-height:1.8">Ha en god uke.<br>
    <span style="color:#1a1a2e;font-weight:600">Vi sees neste mandag.</span></div>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding-top:24px;padding-bottom:0">
    <a href="https://siktseo.com/portal" style="display:inline-block;background:#7c3aed;color:#fff;font-weight:700;font-size:14px;padding:13px 26px;border-radius:9px;text-decoration:none">Åpne dashboardet</a>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:40px 0 48px;border-top:1px solid #e2e0ea;margin-top:40px">
    <div style="font-size:11px;color:#b8b5c8;line-height:1.9">
      Sikt · ${escapeHtml(plan)} · ${websiteUrl ? escapeHtml(websiteUrl) : ''}<br>
      <a href="https://siktseo.com/portal" style="color:#b8b5c8;text-decoration:none">Administrer varsler</a> · <a href="https://siktseo.com/portal" style="color:#b8b5c8;text-decoration:none">Avslutt abonnement</a>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
