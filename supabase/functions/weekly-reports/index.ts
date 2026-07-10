import { createClient } from '@supabase/supabase-js'
import {
  renderEmail, sectionHead, paragraph, statement, winList, statRow,
  defList, railNote, note, escapeHtml, TOKENS,
} from '../_shared/email.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'rapport@siktseo.com'
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
// Eier-adresse for helse-digesten (punkt 3A). Settes som env i prod.
const FOUNDER_EMAIL = Deno.env.get('FOUNDER_EMAIL') ?? 'siktseo@gmail.com'

// Estimert verdi per organisk klikk (NOK) — konservativt anslag for hva et
// tilsvarende Google Ads-klikk ville kostet. Brukes til ROI-linjen i kvitteringen.
const CLICK_VALUE_NOK = 8

const PORTAL_URL = 'https://siktseo.com/portal'

type SiktAction = {
  action_type: string
  category: string
  title: string
  details: Record<string, unknown> | null
  page_url: string | null
  created_at: string
  status?: string | null
}

type ReportSections = {
  results?: boolean
  opportunity?: boolean
  work?: boolean
  competitors?: boolean
  aiVisibility?: boolean
  lifetime?: boolean
}

type NotifPrefs = {
  weeklyReport?: boolean
  criticalAlerts?: boolean
  rankChanges?: boolean
  // Kunde-styrt rapport-timeplan:
  reportFrequency?: string   // 'off'|'weekly'|'biweekly'|'monthly'|'twice_week'|'thrice_week'
  reportHour?: number        // 6–22, Oslo lokal time
  reportAnchorDay?: number   // ISO ukedag 1=man … 7=søn
  reportSections?: ReportSections
}

type Client = {
  user_id: string
  email: string
  company_name: string | null
  contact_person: string | null
  package_name: string
  website_url: string | null
  notification_preferences: NotifPrefs | null
  // Churn-felt (punkt 3C): styrer gjenoppvekkings-e-posten.
  subscription_status: string | null
  last_active_at: string | null
  last_reengagement_at: string | null
  created_at: string | null
  // Kunde-styrt rapport-timeplan: dedup + datavindu + kadens.
  last_report_sent_at: string | null
}

type Opportunity = {
  keyword: string
  recommendation_text: string | null
  estimated_traffic: number | null
  difficulty: string | number | null
  search_volume: number | null
}

type HealthRow = {
  email: string | null
  package_name: string | null
  subscription_status: string | null
  health: string
  last_seen_at: string | null
  last_active_at: string | null
  created_at: string | null
}

// =====================================================================
// Kunde-styrt timeplan — dispatcheren kjøres hver time (pg_cron i UTC) og
// avgjør per kunde om de er «due» nå i NORSK tid (Europe/Oslo, DST-trygt).
// =====================================================================
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function osloNowParts(): { hour: number; weekday: number; dayOfMonth: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Oslo', hour: '2-digit', hour12: false, weekday: 'short', day: '2-digit',
  }).formatToParts(new Date())
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  const wk: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
  let hour = parseInt(get('hour'), 10)
  if (hour === 24) hour = 0 // noen runtimes rendrer midnatt som 24
  return { hour, weekday: wk[get('weekday')] ?? 1, dayOfMonth: parseInt(get('day'), 10) || 1 }
}

function clampHour(h: unknown): number {
  const n = typeof h === 'number' && isFinite(h) ? Math.round(h) : 8
  return Math.min(22, Math.max(6, n))
}
function clampDay(d: unknown): number {
  const n = typeof d === 'number' && isFinite(d) ? Math.round(d) : 1
  return Math.min(7, Math.max(1, n))
}

/** ISO-ukedager (1–7) en kunde skal få e-post på — jevnt fordelt fra anchor. */
function reportWeekdays(frequency: string, anchor: number): number[] {
  const wrap = (d: number) => ((d - 1) % 7 + 7) % 7 + 1
  if (frequency === 'twice_week') return [anchor, wrap(anchor + 3)]      // f.eks. man + tor
  if (frequency === 'thrice_week') return [anchor, wrap(anchor + 2), wrap(anchor + 4)] // man+ons+fre
  return [anchor]
}

/** Er kunden due for rapport NÅ (gitt Oslo-tid + siste sendt)? */
function isReportDue(
  prefs: NotifPrefs | null,
  lastSentIso: string | null,
  oslo: { hour: number; weekday: number; dayOfMonth: number },
): boolean {
  const frequency = prefs?.reportFrequency ?? (prefs?.weeklyReport === false ? 'off' : 'weekly')
  if (frequency === 'off') return false
  if (oslo.hour !== clampHour(prefs?.reportHour)) return false

  const anchor = clampDay(prefs?.reportAnchorDay)
  const lastMs = lastSentIso ? new Date(lastSentIso).getTime() : null
  // Dedup: aldri to ganger innen 20 t (hindrer dobbel-fyring samme time/dag).
  if (lastMs !== null && (Date.now() - lastMs) < 20 * HOUR_MS) return false

  switch (frequency) {
    case 'weekly':
      return oslo.weekday === anchor
    case 'twice_week':
    case 'thrice_week':
      return reportWeekdays(frequency, anchor).includes(oslo.weekday)
    case 'biweekly':
      return oslo.weekday === anchor && (lastMs === null || (Date.now() - lastMs) >= 13 * DAY_MS)
    case 'monthly':
      // Første anchor-ukedag i måneden; 20-dagers guard hindrer to ganger samme måned.
      return oslo.weekday === anchor && oslo.dayOfMonth <= 7 &&
        (lastMs === null || (Date.now() - lastMs) >= 20 * DAY_MS)
    default:
      return false
  }
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
    .select('user_id, email, company_name, contact_person, package_name, website_url, notification_preferences, subscription_status, last_active_at, last_reengagement_at, created_at, last_report_sent_at')
    .not('package_name', 'is', null)
    .not('email', 'is', null)

  if (clientsError || !clients) {
    console.error('Feil ved henting av kunder:', clientsError)
    return new Response('Feil ved henting av kunder', { status: 500 })
  }

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const oslo = osloNowParts() // norsk tid NÅ — styrer hvem som er due

  let sentCount = 0
  let errorCount = 0
  let reengagedCount = 0
  const reengagedUserIds: string[] = []

  for (const client of clients as Client[]) {
    if (!client.email || !client.package_name) continue
    // Kunde-styrt timeplan: send kun når kunden er «due» i norsk tid
    // (frekvens + ukedag + klokkeslett). Erstatter den gamle på/av-sjekken.
    if (!isReportDue(client.notification_preferences, client.last_report_sent_at, oslo)) continue

    // Datavindu = siden forrige rapport (faller tilbake til 7 d), maks 31 d.
    // Hindrer at innholdet gjentas når kunden får e-post flere ganger i uka.
    const lastSentMs = client.last_report_sent_at ? new Date(client.last_report_sent_at).getTime() : null
    const periodMs = lastSentMs
      ? Math.min(31 * DAY_MS, Math.max(DAY_MS, Date.now() - lastSentMs))
      : 7 * DAY_MS
    const periodStart = new Date(Date.now() - periodMs).toISOString()
    const periodDays = Math.round(periodMs / DAY_MS)
    const periodLabel = (periodDays >= 6 && periodDays <= 8) ? 'denne uken'
      : periodDays <= 1 ? 'siden i går'
      : `de siste ${periodDays} dagene`

    // Hvilke seksjoner kunden vil ha (manglende nøkkel = på).
    const secPrefs = client.notification_preferences?.reportSections
    const sections = {
      results: secPrefs?.results !== false,
      opportunity: secPrefs?.opportunity !== false,
      work: secPrefs?.work !== false,
      competitors: secPrefs?.competitors !== false,
      aiVisibility: secPrefs?.aiVisibility !== false,
      lifetime: secPrefs?.lifetime !== false,
    }

    const plan = client.package_name // "Basic Pakke", "Standard Pakke", "Premium Pakke"
    const isStandardOrAbove = plan === 'Standard Pakke' || plan === 'Premium Pakke'
    const isPremium = plan === 'Premium Pakke'

    // Hent ukens handlinger for denne brukeren
    const { data: actions } = await supabase
      .from('sikt_actions')
      .select('action_type, category, title, details, page_url, created_at, status')
      .eq('user_id', client.user_id)
      .gte('created_at', periodStart)
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

    // Plattform-status: kan Sikt faktisk skrive til siden? (full = WordPress/Shopify-token)
    const { data: hostRow } = await supabase
      .from('client_hosts')
      .select('connection_mode')
      .eq('user_id', client.user_id)
      .maybeSingle()
    const canAutoFix = (hostRow as { connection_mode?: string } | null)?.connection_mode === 'full'

    // Klart til godkjenning: ferdigskrevne plan-artikler + interne lenkeforslag.
    // Verdien ligger og venter i portalen — kvitteringen skal minne om det.
    const { count: planArtCount } = await supabase
      .from('sikt_articles')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', client.user_id)
      .eq('source', 'plan')
      .eq('status', 'generated')
    const { count: linkSugCount } = await supabase
      .from('sikt_link_suggestions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', client.user_id)
      .eq('status', 'pending')
    const pendingPlanArticles = planArtCount ?? 0
    const pendingLinkSuggestions = linkSugCount ?? 0

    // Resultat-bevis: artiklenes posisjonsutvikling (viewen sikt_article_results
    // parer artikkel med søkeordets snapshots ETTER publisering). Kvitteringen
    // viser kun ærlige SEIRE (forbedring eller helt ny rangering) — hele bildet
    // ligger i portalen.
    let articleResults: { keyword: string; from: number | null; to: number }[] = []
    {
      const { data: resRows } = await supabase
        .from('sikt_article_results')
        .select('keyword, position_at_creation, latest_position')
        .eq('user_id', client.user_id)
        .not('latest_position', 'is', null)
      articleResults = ((resRows ?? []) as { keyword: string; position_at_creation: number | null; latest_position: number }[])
        .filter(r => r.position_at_creation == null || r.latest_position < r.position_at_creation)
        .map(r => ({
          keyword: r.keyword,
          from: r.position_at_creation != null ? Math.round(r.position_at_creation) : null,
          to: Math.round(r.latest_position),
        }))
        .sort((a, b) => ((b.from ?? 40) - b.to) - ((a.from ?? 40) - a.to))
        .slice(0, 3)
    }

    // Konkurrent-bevegelser + motangrep (mates av competitor-monitor →
    // keyword_opportunities med competitor_ids).
    let competitorMoves = 0
    let counterMoves = 0
    if (isStandardOrAbove) {
      const { count: cm } = await supabase
        .from('competitor_changes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', client.user_id)
        .gte('created_at', periodStart)
      competitorMoves = cm ?? 0
      const { count: co } = await supabase
        .from('keyword_opportunities')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', client.user_id)
        .gte('discovered_at', periodStart)
        .neq('competitor_ids', '{}')
      counterMoves = co ?? 0
    }

    // Henvendelser fra nettsiden (tel/mailto/skjema — beacon i connector v1.3).
    let leadsThisPeriod = 0
    {
      const { count } = await supabase
        .from('sikt_leads')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', client.user_id)
        .gte('occurred_at', periodStart)
      leadsThisPeriod = count ?? 0
    }

    // ROI: ekte Google-klikk nå vs. for ~4 uker siden + estimert kroneverdi.
    // Reframer kvitteringen fra «aktivitet» til «penger». Kilde: GSC (keywords)
    // + keyword_snapshots (ukentlig historikk). Vises kun når data finnes.
    let gscClicks = 0
    let gscImpressions = 0
    let priorClicks: number | null = null
    let wins: { keyword: string; position: number; prev: number }[] = []
    {
      const { data: site } = await supabase
        .from('sites').select('id').eq('user_id', client.user_id).maybeSingle()
      if (site?.id) {
        const { data: kw } = await supabase
          .from('keywords').select('keyword, clicks, impressions, position, previous_position').eq('site_id', site.id)
        type KwRow = { keyword: string; clicks: number | null; impressions: number | null; position: number | null; previous_position: number | null }
        for (const r of (kw ?? []) as KwRow[]) {
          gscClicks += r.clicks ?? 0
          gscImpressions += r.impressions ?? 0
        }
        // Seire: søkeord som klatret merkbart siden forrige GSC-synk.
        wins = ((kw ?? []) as KwRow[])
          .filter(r => typeof r.position === 'number' && typeof r.previous_position === 'number' &&
            (r.position as number) < (r.previous_position as number) && (
              (r.position as number) <= 3 && (r.previous_position as number) > 3 ||
              (r.position as number) <= 10 && (r.previous_position as number) > 10 ||
              (r.previous_position as number) - (r.position as number) >= 5
            ))
          .map(r => ({ keyword: r.keyword, position: r.position as number, prev: r.previous_position as number }))
          .sort((a, b) => (b.prev - b.position) - (a.prev - a.position))
          .slice(0, 5)
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

    // ---------------------------------------------------------------
    // Punkt 3C: auto gjenoppvekkings-e-post.
    // Sendes I STEDET FOR den vanlige rapporten til en BETALENDE kunde
    // som var aktiv før, men har vært stille ≥14 dager — så vi unngår
    // dobbel e-post samme dag. Konservative guards beskytter test-/
    // aldri-aktiverte kontoer (last_active_at = null → aldri trigget).
    // ---------------------------------------------------------------
    const DAY = 24 * 60 * 60 * 1000
    const subStatus = (client.subscription_status ?? '').toLowerCase()
    const isPayingActive = subStatus === 'active' || subStatus === 'past_due' || subStatus === 'trialing'
    const lastActiveMs = client.last_active_at ? new Date(client.last_active_at).getTime() : null
    const quietDays = lastActiveMs ? Math.floor((Date.now() - lastActiveMs) / DAY) : null
    const reengagedRecently = client.last_reengagement_at
      ? (Date.now() - new Date(client.last_reengagement_at).getTime()) < 21 * DAY
      : false
    const shouldReengage =
      isPayingActive &&
      lastActiveMs !== null &&     // utelukker aldri-aktiverte (test-)kontoer
      quietDays !== null && quietDays >= 14 &&
      !reengagedRecently

    if (shouldReengage) {
      const reHtml = buildReengagementHtml({
        firstName, companyName, websiteUrl, plan,
        quietDays: quietDays as number,
        openSuggestions, totalFixes, topOpportunity,
      })
      const reResult = await sendEmail({
        to: client.email,
        subject: firstName
          ? `${firstName}, siden din jobber videre — men savner deg`
          : 'Sikt jobber videre for deg — men savner deg',
        html: reHtml,
      })
      if (reResult.ok) {
        reengagedCount++
        reengagedUserIds.push(client.user_id)
        // Stemple så vi ikke maser igjen før om ≥21 dager. Sett også
        // last_report_sent_at så timeplan-dedup/datavindu forblir konsistent.
        const nowIso = new Date().toISOString()
        await supabase.from('clients')
          .update({ last_reengagement_at: nowIso, last_report_sent_at: nowIso })
          .eq('user_id', client.user_id)
      } else {
        errorCount++
        console.error(`Feil ved gjenoppvekking til ${client.email}:`, await reResult.text())
      }
      continue // hopp over standard-rapporten denne uka for denne kunden
    }

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
      canAutoFix,
      wins,
      periodLabel,
      sections,
      pendingPlanArticles,
      pendingLinkSuggestions,
      articleResults,
      competitorMoves,
      counterMoves,
      leadsThisPeriod,
    })

    const subject = buildSubject({ fixes, findings, plan, topOpportunity, periodLabel })

    const result = await sendEmail({
      to: client.email,
      subject,
      html,
    })

    if (result.ok) {
      sentCount++
      await supabase.from('clients')
        .update({ last_report_sent_at: new Date().toISOString() })
        .eq('user_id', client.user_id)
    } else {
      errorCount++
      console.error(`Feil ved sending til ${client.email}:`, await result.text())
    }
  }

  // -----------------------------------------------------------------
  // Punkt 3A: ukentlig eier-digest. Leser client_health-viewet (røde +
  // gule betalende kunder) og sender ÉN e-post til eier med hvem som er
  // i ferd med å falle av + hvorfor + hva å gjøre. Sendes kun når det
  // faktisk finnes risiko-kunder (ingen nyheter = ingen e-post).
  // -----------------------------------------------------------------
  // Fast ukentlig kadens uavhengig av kunde-tidene: kun mandag 08:00 norsk tid.
  // Den time-baserte cronen treffer denne grenen nøyaktig én gang per uke.
  let digestSent = false
  if (oslo.weekday === 1 && oslo.hour === 8) try {
    const { data: healthRows } = await supabase
      .from('client_health')
      .select('email, package_name, subscription_status, health, last_seen_at, last_active_at, created_at')
      .in('health', ['red', 'yellow'])
      .not('package_name', 'is', null)
      .neq('email', FOUNDER_EMAIL)

    const atRisk = (healthRows ?? []) as HealthRow[]
    if (atRisk.length > 0) {
      const digestHtml = buildFounderDigestHtml(atRisk, reengagedCount)
      const reds = atRisk.filter(r => r.health === 'red').length
      const digestResult = await sendEmail({
        to: FOUNDER_EMAIL,
        subject: `Sikt · ${atRisk.length} kunde${atRisk.length === 1 ? '' : 'r'} trenger oppmerksomhet (${reds} røde)`,
        html: digestHtml,
      })
      digestSent = digestResult.ok
      if (!digestResult.ok) console.error('Feil ved sending av eier-digest:', await digestResult.text())
    }
  } catch (e) {
    console.error('Feil ved bygging av eier-digest:', e)
  }

  console.log(`✅ Ukesrapport: ${sentCount} sendt, ${reengagedCount} gjenoppvekket, ${errorCount} feil, digest=${digestSent}`)
  return new Response(
    JSON.stringify({ sent: sentCount, reengaged: reengagedCount, reengagedUserIds, errors: errorCount, digestSent }),
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

function buildSubject({ fixes, findings, plan, topOpportunity, periodLabel }: { fixes: SiktAction[]; findings: SiktAction[]; plan: string; topOpportunity: Opportunity | null; periodLabel: string }): string {
  if (fixes.length > 0) return `Sikt fikset ${fixes.length} ting for deg ${periodLabel}`
  if (findings.length > 0) return `Sikt fant ${findings.length} ting du bør se på ${periodLabel}`
  // Stille periode på arbeid → led med vekst, aldri en tom «rapport»
  if (topOpportunity) return `Ukens mulighet: ${topOpportunity.keyword}`
  if (plan === 'Premium Pakke') return `Din SEO- og AI-rapport fra Sikt`
  return `Din rapport fra Sikt`
}

// =====================================================================
// HTML — redaksjonell mal (../_shared/email.ts). Kun presentasjon;
// all data-henting over er urørt.
// =====================================================================

/** «Ukens mulighet» — redaksjonell blokk (serif-nøkkelord, ingen pille-boks). */
function opportunityBlock(
  opp: Opportunity | null, canAutoFix: boolean, isBasic: boolean, basicGotFixes: boolean,
): string {
  if (!opp) return ''

  const traffic = typeof opp.estimated_traffic === 'number' && opp.estimated_traffic > 0
    ? `~${opp.estimated_traffic} flere besøk i måneden hvis du tar den`
    : null

  const recommendation = opp.recommendation_text
    ? escapeHtml(opp.recommendation_text)
    : `En konkurrent rangerer på «${escapeHtml(opp.keyword)}» — det gjør ikke du ennå. Tar du dette søkeordet, henter du trafikken deres.`

  // Plattform-bevisst: lov bare auto-fiks når siden faktisk er koblet til for skriving.
  // Basic får kun engangs auto-fiks i oppstart — aldri løpende, selv om tilkoblet.
  const action = isBasic
    ? (basicGotFixes
        ? 'Sikt fikset allerede de viktigste tingene for deg i oppstart. Denne muligheten får du som ferdig oppskrift — eller oppgrader til Standard for løpende auto-fiks hver uke.'
        : 'Med Standard fikser Sikt slike muligheter automatisk, hver uke. På Basic får du oppskriften — gjør det selv, eller oppgrader.')
    : canAutoFix
      ? 'Sikt tar tak i denne for deg — du ser den i neste kvittering.'
      : 'Forslaget er klart til å limes inn. Koble til siden din for skrivetilgang, så fikser Sikt slikt automatisk.'

  return sectionHead('Ukens mulighet')
    + `<div style="font-family:${TOKENS.serif};font-size:20px;font-weight:700;color:${TOKENS.color.ink};letter-spacing:-0.3px;margin-bottom:6px">${escapeHtml(opp.keyword)}</div>`
    + (traffic ? `<div style="font-family:${TOKENS.sans};font-size:13px;font-weight:600;color:${TOKENS.color.green};margin-bottom:12px">${escapeHtml(traffic)}</div>` : '')
    + paragraph(recommendation)
    + `<div style="font-family:${TOKENS.sans};font-size:13px;font-weight:600;color:${TOKENS.color.accent};line-height:1.55;margin-top:12px">${action}</div>`
}

/** «AI-synlighet» (Premium) — kompakt score-blokk, så ROI-tallet forblir fokus. */
function geoBlock(geoScore: number, geoPrevScore: number | null, geoMentioned: number, geoTotal: number): string {
  if (geoTotal > 0) {
    let trend: string
    if (geoPrevScore === null) {
      trend = `<span style="font-family:${TOKENS.sans};font-size:12px;font-weight:600;color:${TOKENS.color.muted}">Ny måling</span>`
    } else {
      const d = geoScore - geoPrevScore
      const col = d > 0 ? TOKENS.color.green : d < 0 ? TOKENS.color.danger : TOKENS.color.muted
      const txt = d > 0 ? `+${d} fra forrige uke` : d < 0 ? `${d} fra forrige uke` : 'uendret fra forrige uke'
      trend = `<span style="font-family:${TOKENS.sans};font-size:12px;font-weight:600;color:${col}">${txt}</span>`
    }
    return sectionHead('AI-synlighet')
      + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="top">
            <div style="font-family:${TOKENS.serif};font-size:30px;font-weight:700;color:${TOKENS.color.ink};line-height:1">${geoScore}<span style="font-family:${TOKENS.sans};font-size:15px;color:${TOKENS.color.muted};font-weight:600"> / 100</span></div>
            <div style="font-family:${TOKENS.sans};font-size:12px;color:${TOKENS.color.muted};text-transform:uppercase;letter-spacing:1px;margin-top:8px">AI-synlighet denne uken</div>
          </td>
          <td valign="top" align="right">${trend}</td>
        </tr></table>`
      + paragraph(
          `Nevnt i <strong style="color:${TOKENS.color.ink}">${geoMentioned} av ${geoTotal}</strong> AI-svar. Vi spør ChatGPT, Gemini og Perplexity bransjespørsmål en kunde ville stilt${geoMentioned > 0 ? ' — og du dukker opp.' : '. Vi jobber med å få deg inn i svarene.'}`,
          { mt: TOKENS.space.md },
        )
  }
  return sectionHead('AI-synlighet') + railNote({
    title: 'Nevner ChatGPT deg?',
    body: 'Stadig flere spør AI-assistenter om anbefalinger i stedet for å google. Vi sjekker ukentlig om ChatGPT, Gemini og Perplexity nevner bedriften din.',
    tone: 'accent',
  })
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
  canAutoFix: boolean
  wins: { keyword: string; position: number; prev: number }[]
  periodLabel: string
  sections: { results: boolean; opportunity: boolean; work: boolean; competitors: boolean; aiVisibility: boolean; lifetime: boolean }
  pendingPlanArticles: number
  pendingLinkSuggestions: number
  articleResults: { keyword: string; from: number | null; to: number }[]
  competitorMoves: number
  counterMoves: number
  leadsThisPeriod: number
}): string {
  const { firstName, websiteUrl, plan, fixes, findings, suggestions, isStandardOrAbove, isPremium, totalFixes, totalFindings, weeksActive, geoMentioned, geoTotal, geoScore, geoPrevScore, topOpportunity, doneThisWeek, openSuggestions, gscClicks, gscImpressions, clicksDeltaPct, estValue, canAutoFix, wins, periodLabel, sections, pendingPlanArticles, pendingLinkSuggestions, articleResults, competitorMoves, counterMoves, leadsThisPeriod } = opts
  const ink = TOKENS.color.ink
  const accent = TOKENS.color.accent
  // Periode-etikett i overskrift (stor forbokstav): «Denne uken» / «De siste 4 dagene».
  const Period = periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)

  const now = new Date()
  const weekNum = Math.ceil((now.getDate() + new Date(now.getFullYear(), now.getMonth(), 1).getDay()) / 7)
  const dateStr = now.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })

  const findFindCount = findings.length + suggestions.length

  // Aldri «0 ting». Tom arbeidsuke → led med vekst (Ukens mulighet) eller vedlikehold.
  const italic = (t: string) => `<span style="font-style:italic;font-weight:400">${t}</span>`
  let headlineHtml: string
  let sublineHtml: string
  if (fixes.length > 0) {
    headlineHtml = `${italic(Period)} fikset vi ${fixes.length} ting for deg.`
    sublineHtml = `Alt skjedde automatisk${websiteUrl ? ` på <strong style="color:${ink}">${escapeHtml(websiteUrl)}</strong>` : ''}, uten at du trengte å løfte en finger.`
  } else if (findFindCount > 0) {
    headlineHtml = `${italic(Period)} fant vi ${findFindCount} ting du bør se på.`
    sublineHtml = `Vi gikk gjennom${websiteUrl ? ` <strong style="color:${ink}">${escapeHtml(websiteUrl)}</strong>` : ' nettstedet ditt'} og fant nye forbedringer du kan ta tak i.`
  } else if (topOpportunity) {
    headlineHtml = `${italic(Period)} jaktet vi vekst for deg.`
    sublineHtml = `Ingen nye feil dukket opp — grunnmuren er i god form. Så vi brukte uken på å finne neste mulighet til å klatre.`
  } else {
    headlineHtml = `${italic(Period)} holdt vi vakt for deg.`
    sublineHtml = `Ingen nye feil, ingen drop${websiteUrl ? ` på <strong style="color:${ink}">${escapeHtml(websiteUrl)}</strong>` : ''}. Vi overvåket siden og konkurrentene dine døgnet rundt, så du slapp.`
  }

  // Blokker bygges i lese-rekkefølge: resultater først (seire → verdi), så
  // mulighet, arbeid, konkurrenter, AI-synlighet og til slutt livstidstall.
  const blocks: string[] = []

  // Punkt 2: sett forventninger eksplisitt for nye kunder (≤6 uker).
  // SEO flytter seg på ukers horisont, ikke dagers — si det rett ut, og
  // led med ledende indikatorer (arbeid gjort) så kunden ikke sier opp
  // mens hen venter på at rangeringene skal røre seg.
  if (weeksActive <= 6) {
    blocks.push(railNote({
      title: 'Hva du kan forvente',
      body: `Resultater i Google kommer sjelden over natten — det tar typisk 4–12 uker før rangeringene flytter seg merkbart. Du er i uke ${weeksActive}. Mens vi venter bygger vi grunnmuren: så langt har Sikt gjort ${totalFixes} ${totalFixes === 1 ? 'fiks' : 'fikser'} og funnet ${totalFindings} ${totalFindings === 1 ? 'forbedring' : 'forbedringer'} på siden din. Det er dette arbeidet som flytter tallene senere.`,
      tone: 'accent',
    }))
  }

  if (sections.results && wins.length > 0) {
    blocks.push(sectionHead(`Seire ${periodLabel}`) + winList(wins.map(w => ({
      keyword: w.keyword,
      from: w.prev,
      to: w.position,
      flag: w.position <= 3 ? 'topp 3' : w.position <= 10 ? 'side 1' : undefined,
    }))))
  }

  // Resultat-bevis: artiklene Sikt skrev → hva de faktisk gjorde på Google.
  // Vises kun når minst én artikkel har ekte snapshot-data (aldri tomme løfter).
  if (sections.results && articleResults.length > 0) {
    blocks.push(sectionHead('Dette har artiklene dine gjort') + winList(articleResults.map(r => ({
      keyword: r.keyword,
      from: r.from != null ? r.from : 'ny',
      to: r.to,
      flag: r.from == null ? 'ny på Google' : r.to <= 10 ? 'side 1' : undefined,
    }))))
  }

  // Henvendelser: det eneste tallet en småbedrift egentlig bryr seg om.
  if (sections.results && leadsThisPeriod > 0) {
    blocks.push(sectionHead('Henvendelser fra nettsiden') + statement({
      value: String(leadsThisPeriod),
      label: leadsThisPeriod === 1 ? 'henvendelse denne perioden' : 'henvendelser denne perioden',
      sub: 'Telefon-klikk, e-post-klikk og skjema-innsendinger på siden din — sporet av Sikt, uten cookies og uten persondata.',
    }))
  }

  if (sections.results && gscClicks > 0) {
    blocks.push(sectionHead('Hva dette er verdt') + statement({
      value: `~${estValue.toLocaleString('nb-NO')} kr`,
      label: 'Estimert verdi per måned',
      trend: (clicksDeltaPct !== null && clicksDeltaPct >= 0) ? `+${clicksDeltaPct} % klikk mot forrige måned` : undefined,
      sub: `${gscClicks.toLocaleString('nb-NO')} klikk fra ${gscImpressions.toLocaleString('nb-NO')} visninger i Google siste 28 dager — verdsatt som hva tilsvarende annonseklikk ville kostet (~${CLICK_VALUE_NOK} kr per klikk).`,
    }))
  }

  const opp = sections.opportunity ? opportunityBlock(topOpportunity, canAutoFix, !isStandardOrAbove, totalFixes > 0) : ''
  if (opp) blocks.push(opp)

  // Klart til godkjenning: innholdsplan-artikler + interne lenkeforslag som
  // ligger ferdige i portalen. Sikt har gjort jobben — kunden skal bare si ja.
  if (sections.work && (pendingPlanArticles > 0 || pendingLinkSuggestions > 0)) {
    const bits: string[] = []
    if (pendingPlanArticles > 0) bits.push(`${pendingPlanArticles} ${pendingPlanArticles === 1 ? 'ferdigskrevet artikkel' : 'ferdigskrevne artikler'} fra månedens innholdsplan`)
    if (pendingLinkSuggestions > 0) bits.push(`${pendingLinkSuggestions} interne lenkeforslag`)
    blocks.push(sectionHead('Klart til godkjenning') + railNote({
      title: `${bits.join(' og ')} venter på deg`,
      body: `Sikt har gjort arbeidet ferdig — les gjennom og godkjenn i portalen, så publiseres det som utkast/endringer på siden din. Ingenting går live uten deg.`,
      tone: 'accent',
    }))
  }

  const explanationOf = (a: SiktAction): string | undefined => {
    const ex = a.details && (a.details as Record<string, string>).explanation
    return ex ? ex : (a.page_url ?? undefined)
  }
  if (sections.work && fixes.length > 0) blocks.push(sectionHead('Fikset av Sikt') + defList(fixes.slice(0, 5).map(a => ({ title: a.title, body: explanationOf(a) }))))
  if (sections.work && findings.length > 0) blocks.push(sectionHead('Vi fant også') + defList(findings.slice(0, 5).map(a => ({ title: a.title, body: explanationOf(a) }))))
  if (sections.work && suggestions.length > 0) blocks.push(sectionHead('AI-forslag') + defList(suggestions.slice(0, 5).map(a => ({ title: a.title, body: explanationOf(a) }))))

  if (sections.work && (doneThisWeek > 0 || openSuggestions > 0)) {
    blocks.push(note(
      `${doneThisWeek > 0 ? `<strong style="color:${ink}">Du tok unna ${doneThisWeek} forslag denne uken.</strong> ` : ''}` +
      `${openSuggestions > 0
        ? `${openSuggestions} forslag venter i <a href="${PORTAL_URL}" style="color:${accent};text-decoration:underline;font-weight:600">Sikt-loggen</a> — hvert ferdig skrevet, klart til å limes inn.`
        : 'Alt er tatt unna. Nytt påfyll kommer.'}`,
    ))
  }

  if (sections.competitors && isStandardOrAbove) {
    // Motangrep: når konkurrentene beveger seg, viser vi at Sikt alt har svart.
    const moveBody = competitorMoves > 0
      ? `${competitorMoves} ${competitorMoves === 1 ? 'bevegelse' : 'bevegelser'} hos konkurrentene dine ${periodLabel}${counterMoves > 0
          ? ` — Sikt har allerede lagt ${counterMoves} ${counterMoves === 1 ? 'motsvar' : 'motsvar'} i mulighetene dine, klare for innholdsplanen.`
          : '. Detaljene ligger i Konkurrenter-fanen.'}`
      : 'Publiserer en konkurrent noe nytt, endrer priser eller klatrer på Google, får du beskjed — og Sikt legger motsvaret rett i innholds-mulighetene dine.'
    blocks.push(sectionHead('Konkurrentene dine') + railNote({
      title: competitorMoves > 0 ? 'Konkurrentene beveget seg — Sikt svarte' : 'Vi holder øye mens du jobber',
      body: moveBody,
    }))
  }

  if (sections.aiVisibility && isPremium) blocks.push(geoBlock(geoScore, geoPrevScore, geoMentioned, geoTotal))

  if (sections.lifetime) blocks.push(sectionHead('Siden du startet med Sikt') + statRow([
    { value: totalFixes, label: 'ting fikset' },
    { value: totalFindings, label: 'funn oppdaget' },
    { value: weeksActive, label: weeksActive === 1 ? 'uke aktiv' : 'uker aktiv' },
  ]))

  const preheader = gscClicks > 0
    ? `Trafikken din er verdt ~${estValue.toLocaleString('nb-NO')} kr i måneden. Her er perioden som var.`
    : wins.length > 0
      ? `Du klatret på ${wins.length} søkeord ${periodLabel}.`
      : topOpportunity
        ? `Ukens mulighet: ${topOpportunity.keyword}.`
        : 'Her er rapporten din fra Sikt.'

  return renderEmail({
    preheader,
    brand: 'sikt',
    kicker: `Uke ${weekNum} · ${dateStr}`,
    heading: headlineHtml,
    intro: (firstName ? `Hei ${escapeHtml(firstName)}. ` : '') + sublineHtml,
    blocks,
    signoff: 'Vi holder vakt videre — snakkes snart.',
    cta: { label: 'Åpne dashbordet', url: PORTAL_URL },
    footer: `Sikt · ${escapeHtml(plan)}${websiteUrl ? ` · ${escapeHtml(websiteUrl)}` : ''} &nbsp;·&nbsp; <a href="${PORTAL_URL}" style="color:${TOKENS.color.faint};text-decoration:underline">Administrer varsler</a> &nbsp;·&nbsp; <a href="${PORTAL_URL}" style="color:${TOKENS.color.faint};text-decoration:underline">Avslutt abonnement</a>`,
  })
}

// =====================================================================
// Punkt 3C — gjenoppvekkings-e-post (sendes til stille, betalende kunde)
// =====================================================================
function buildReengagementHtml(opts: {
  firstName: string | null
  companyName: string
  websiteUrl: string
  plan: string
  quietDays: number
  openSuggestions: number
  totalFixes: number
  topOpportunity: Opportunity | null
}): string {
  const { firstName, websiteUrl, plan, quietDays, openSuggestions, totalFixes, topOpportunity } = opts
  const ink = TOKENS.color.ink
  const blocks: string[] = []

  if (openSuggestions > 0) {
    blocks.push(railNote({
      title: `${openSuggestions} forslag venter på deg`,
      body: 'Hvert ett er ferdig skrevet av Sikt og klart til å limes inn. De tar minutter — og hver av dem er en mulighet til å klatre på Google.',
      tone: 'accent',
    }))
  }
  if (topOpportunity) {
    const traffic = typeof topOpportunity.estimated_traffic === 'number' && topOpportunity.estimated_traffic > 0
      ? ` Tar du den, kan det bety ~${topOpportunity.estimated_traffic} flere besøk i måneden.` : ''
    blocks.push(sectionHead('Ukens mulighet')
      + `<div style="font-family:${TOKENS.serif};font-size:20px;font-weight:700;color:${ink};letter-spacing:-0.3px;margin-bottom:6px">${escapeHtml(topOpportunity.keyword)}</div>`
      + paragraph(`En konkurrent rangerer på dette søkeordet — det gjør ikke du ennå.${escapeHtml(traffic)}`))
  }
  if (totalFixes > 0) {
    blocks.push(note(`Sikt har allerede gjort <strong style="color:${ink}">${totalFixes} ${totalFixes === 1 ? 'fiks' : 'fikser'}</strong> for deg i bakgrunnen. Vi fortsetter uansett — men du henter mest verdi når du er innom og tar tak i det vi finner.`))
  }

  return renderEmail({
    preheader: `Det venter ${openSuggestions > 0 ? `${openSuggestions} forslag` : 'nye muligheter'} i Sikt — du har ikke vært innom på ${quietDays} dager.`,
    brand: 'sikt',
    kicker: 'Vi savner deg',
    heading: `Det er ${quietDays} dager siden sist du var innom.`,
    intro: (firstName ? `Hei ${escapeHtml(firstName)}. ` : '') + 'Sikt jobber videre i bakgrunnen — men de beste resultatene kommer når du er med. Her er hva som venter på deg akkurat nå.',
    blocks,
    signoff: 'Vi er her når du er klar.',
    cta: { label: 'Åpne dashbordet', url: PORTAL_URL },
    footer: `Sikt · ${escapeHtml(plan)}${websiteUrl ? ` · ${escapeHtml(websiteUrl)}` : ''} &nbsp;·&nbsp; <a href="${PORTAL_URL}" style="color:${TOKENS.color.faint};text-decoration:underline">Administrer varsler</a>`,
  })
}

// =====================================================================
// Punkt 3A — ukentlig eier-digest (intern, kun til FOUNDER_EMAIL)
// =====================================================================
function buildFounderDigestHtml(rows: HealthRow[], reengagedCount: number): string {
  const ink = TOKENS.color.ink
  const DAY = 24 * 60 * 60 * 1000
  const reds = rows.filter(r => r.health === 'red')
  const yellows = rows.filter(r => r.health === 'yellow')

  const reasonFor = (r: HealthRow): string => {
    const sub = (r.subscription_status ?? '').toLowerCase()
    if (sub === 'past_due') return 'Betaling feilet (past_due) — i ferd med å falle av'
    if (sub === 'canceled' || sub === 'unpaid') return `Abonnement: ${sub}`
    if (!r.last_active_at) {
      const days = r.created_at ? Math.floor((Date.now() - new Date(r.created_at).getTime()) / DAY) : null
      return days !== null ? `Betalte, men har aldri vært aktiv (${days} dager siden signup)` : 'Betalte, men har aldri vært aktiv'
    }
    const days = r.last_seen_at ? Math.floor((Date.now() - new Date(r.last_seen_at).getTime()) / DAY) : null
    return days !== null ? `Stille i ${days} dager` : 'Stille en stund'
  }

  const rowHtml = (r: HealthRow): string => {
    const dot = r.health === 'red' ? '🔴' : '🟡'
    const who = r.email ?? '(ukjent e-post)'
    const mailto = r.email ? `mailto:${r.email}?subject=${encodeURIComponent('Hei fra Sikt')}` : '#'
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${TOKENS.color.hairline}"><tr><td style="padding:13px 0">
      <div style="font-family:${TOKENS.sans};font-size:15px;font-weight:600;color:${ink}">${dot} ${escapeHtml(who)}<span style="font-weight:500;color:${TOKENS.color.muted}"> · ${escapeHtml(r.package_name ?? '')}</span></div>
      <div style="font-family:${TOKENS.sans};font-size:13px;color:${TOKENS.color.muted};line-height:1.6;margin-top:2px">${escapeHtml(reasonFor(r))} — <a href="${mailto}" style="color:${TOKENS.color.accent};text-decoration:underline;font-weight:600">nå ut</a></div>
    </td></tr></table>`
  }

  const blocks: string[] = []
  if (reds.length > 0) blocks.push(sectionHead(`Røde — handle nå (${reds.length})`) + reds.map(rowHtml).join(''))
  if (yellows.length > 0) blocks.push(sectionHead(`Gule — følg med (${yellows.length})`) + yellows.map(rowHtml).join(''))
  blocks.push(note(`Sikt sendte automatisk ${reengagedCount} gjenoppvekkings-e-post${reengagedCount === 1 ? '' : 'er'} denne uken. En kort, personlig melding fra deg redder flest abonnement.`))

  return renderEmail({
    preheader: `${rows.length} kunder trenger oppmerksomhet (${reds.length} røde).`,
    brand: 'sikt',
    kicker: new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' }),
    heading: `${rows.length} ${rows.length === 1 ? 'kunde trenger' : 'kunder trenger'} oppmerksomhet.`,
    intro: 'Din ukentlige churn-oversikt fra Sikt. Røde er i ferd med å falle av — nå ut til dem først.',
    blocks,
    signoff: 'Ett kontaktpunkt i uka redder abonnement.',
    cta: { label: 'Åpne admin-helse', url: PORTAL_URL },
    footer: 'Sikt · intern eier-rapport',
  })
}
