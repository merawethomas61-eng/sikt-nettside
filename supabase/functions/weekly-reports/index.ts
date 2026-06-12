import { createClient } from '@supabase/supabase-js'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'rapport@siktapp.com'
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

type SiktAction = {
  action_type: string
  category: string
  title: string
  details: Record<string, unknown> | null
  page_url: string | null
  created_at: string
}

type Client = {
  user_id: string
  email: string
  company_name: string | null
  contact_person: string | null
  package_name: string
  website_url: string | null
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
      .select('action_type, category, title, details, page_url, created_at')
      .eq('user_id', client.user_id)
      .gte('created_at', oneWeekAgo)
      .order('created_at', { ascending: false })

    const weekActions = (actions ?? []) as SiktAction[]

    const fixes = weekActions.filter(a => a.category === 'fix')
    const findings = weekActions.filter(a => a.category === 'finding')
    const suggestions = weekActions.filter(a => a.category === 'suggestion')
    const alerts = weekActions.filter(a => a.category === 'alert')

    // GEO (Premium): nevner AI-assistentene bedriften denne uka?
    let geoMentioned = 0
    let geoTotal = 0
    if (isPremium) {
      const { data: geo } = await supabase
        .from('geo_checks')
        .select('mentioned')
        .eq('user_id', client.user_id)
        .gte('checked_at', oneWeekAgo)
      geoTotal = (geo ?? []).length
      geoMentioned = (geo ?? []).filter((g: { mentioned: boolean }) => g.mentioned).length
    }

    const companyName = client.company_name ?? 'Din bedrift'
    const firstName = client.contact_person ? client.contact_person.split(' ')[0] : null
    const websiteUrl = client.website_url ?? ''

    // Hent totaltall siden start
    const { data: allActions } = await supabase
      .from('sikt_actions')
      .select('category, created_at')
      .eq('user_id', client.user_id)

    const totalFixes = (allActions ?? []).filter(a => a.category === 'fix').length
    const totalFindings = (allActions ?? []).filter(a => a.category === 'finding').length
    const firstAction = (allActions ?? []).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]
    const weeksActive = firstAction
      ? Math.max(1, Math.round((Date.now() - new Date(firstAction.created_at).getTime()) / (7 * 24 * 60 * 60 * 1000)))
      : 1

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
    })

    const subject = buildSubject({ fixes, findings, plan })

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

function buildSubject({ fixes, findings, plan }: { fixes: SiktAction[]; findings: SiktAction[]; plan: string }): string {
  if (fixes.length > 0) return `Sikt fikset ${fixes.length} ting for deg denne uken`
  if (findings.length > 0) return `Sikt fant ${findings.length} ting du bør se på denne uken`
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
}): string {
  const { firstName, websiteUrl, plan, fixes, findings, suggestions, alerts, isStandardOrAbove, isPremium, totalFixes, totalFindings, weeksActive, geoMentioned, geoTotal } = opts

  const now = new Date()
  const weekNum = Math.ceil((now.getDate() + new Date(now.getFullYear(), now.getMonth(), 1).getDay()) / 7)
  const monthName = now.toLocaleDateString('nb-NO', { month: 'long' })
  const dateStr = now.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })

  const headlineCount = fixes.length > 0 ? fixes.length : findings.length + suggestions.length
  const headlineWord = fixes.length > 0 ? 'fikset' : 'fant'

  const allEmpty = fixes.length === 0 && findings.length === 0 && suggestions.length === 0 && alerts.length === 0

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
      <span style="font-family:Georgia,serif;font-style:italic;font-weight:400">Denne uken</span> ${headlineWord} vi<br>${headlineCount} ting for deg.
    </div>
    <div style="font-size:15px;color:#6b6880;line-height:1.7;margin-bottom:28px">Alt skjedde automatisk${websiteUrl ? ` på <strong style="color:#1a1a2e">${escapeHtml(websiteUrl)}</strong>` : ''} og du trengte ikke å gjøre noe.</div>
  </td></tr>

  ${allEmpty ? `
  <tr><td style="padding:32px 0">
    <div style="font-size:15px;color:#6b6880;line-height:1.7">Vi overvåker nettstedet ditt kontinuerlig. Neste uke har vi mer å rapportere.</div>
  </td></tr>
  ` : ''}

  ${fixes.length > 0 ? section('Fikset av Sikt', row(fixes, '#7c3aed')) : ''}
  ${findings.length > 0 ? section('Vi fant også', row(findings, '#e2e0ea')) : ''}
  ${suggestions.length > 0 ? section('AI-forslag', row(suggestions, '#e2e0ea')) : ''}

  ${isStandardOrAbove ? `
  <tr><td style="padding-top:32px">
    <div style="font-size:11px;font-weight:700;color:#9591a8;text-transform:uppercase;letter-spacing:2px;margin-bottom:18px">Konkurrentene dine</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:3px;background:#e2e0ea;border-radius:2px" valign="top">&nbsp;</td>
        <td style="padding-left:16px;padding-bottom:16px">
          <div style="font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:4px">Vi holder øye mens du jobber</div>
          <div style="font-size:13px;color:#6b6880;line-height:1.6">Hvis en konkurrent publiserer noe nytt, endrer priser eller klatrer på Google får du vite det. Du slipper å følge med selv.</div>
          <a href="https://siktapp.com/portal" style="display:inline-block;margin-top:10px;font-size:13px;font-weight:700;color:#7c3aed;text-decoration:none">Se konkurrentoversikt</a>
        </td>
      </tr>
    </table>
  </td></tr>
  <tr><td style="padding-top:32px;border-bottom:1px solid #e2e0ea"></td></tr>
  ` : ''}

  ${isPremium ? `
  <tr><td style="padding-top:32px">
    <div style="font-size:11px;font-weight:700;color:#9591a8;text-transform:uppercase;letter-spacing:2px;margin-bottom:18px">AI-synlighet</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:3px;background:#7c3aed;border-radius:2px" valign="top">&nbsp;</td>
        <td style="padding-left:16px;padding-bottom:16px">
          ${geoTotal > 0 ? `
          <div style="font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:4px">Nevnt i ${geoMentioned} av ${geoTotal} AI-svar denne uken</div>
          <div style="font-size:13px;color:#6b6880;line-height:1.6">Vi stilte ChatGPT, Gemini og Perplexity bransjespørsmål en kunde ville brukt. ${geoMentioned > 0 ? 'Bedriften din ble nevnt — det betyr at AI-assistentene kjenner deg.' : 'Bedriften din ble ikke nevnt ennå. Vi jobber med å øke synligheten din i AI-søk.'}</div>
          ` : `
          <div style="font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:4px">Nevner ChatGPT deg?</div>
          <div style="font-size:13px;color:#6b6880;line-height:1.6">Stadig flere kunder spør AI-assistenter om anbefalinger istedenfor Google. Vi sjekker ukentlig om ChatGPT, Gemini og Perplexity nevner bedriften din.</div>
          `}
          <a href="https://siktapp.com/portal" style="display:inline-block;margin-top:10px;font-size:13px;font-weight:700;color:#7c3aed;text-decoration:none">Se AI-synlighetsrapport</a>
        </td>
      </tr>
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
    <a href="https://siktapp.com/portal" style="display:inline-block;background:#7c3aed;color:#fff;font-weight:700;font-size:14px;padding:13px 26px;border-radius:9px;text-decoration:none">Åpne dashboardet</a>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:40px 0 48px;border-top:1px solid #e2e0ea;margin-top:40px">
    <div style="font-size:11px;color:#b8b5c8;line-height:1.9">
      Sikt · ${escapeHtml(plan)} · ${websiteUrl ? escapeHtml(websiteUrl) : ''}<br>
      <a href="https://siktapp.com/portal" style="color:#b8b5c8;text-decoration:none">Administrer varsler</a> · <a href="https://siktapp.com/portal" style="color:#b8b5c8;text-decoration:none">Avslutt abonnement</a>
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
