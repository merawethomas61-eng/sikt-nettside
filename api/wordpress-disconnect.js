/**
 * POST /api/wordpress-disconnect
 * Frakobler WordPress ved å nullstille tokens og sette connection_mode til 'skipped'.
 * Sletter ikke raden — historikk (platform, admin_url, notes) bevares.
 */

import { createClient } from '@supabase/supabase-js';
import { requireAuth } from './_lib/require-auth.js';
import { withSentry, Sentry } from './_lib/sentry.js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default withSentry(async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Kun POST er tillatt' });
  }

  let user;
  try {
    ({ user } = await requireAuth(req));
  } catch (err) {
    const status = err?.statusCode === 401 ? 401 : err?.statusCode || 500;
    return res.status(status).json({
      error: err?.message || 'Autentisering feilet',
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY mangler på serveren' });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const now = new Date().toISOString();

    const { data: existing, error: fetchErr } = await supabase
      .from('client_hosts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchErr) {
      console.error('[wordpress-disconnect] Kunne ikke lese client_hosts:', fetchErr.message);
      Sentry.captureException(fetchErr);
      return res.status(500).json({ error: 'Kunne ikke frakoble.' });
    }

    if (!existing) {
      return res.status(200).json({ ok: true, wasConnected: false });
    }

    const { error: writeErr } = await supabase
      .from('client_hosts')
      .update({
        connection_mode: 'skipped',
        access_token_encrypted: null,
        refresh_token_encrypted: null,
        token_expires_at: null,
        last_changed_at: now,
        updated_at: now,
      })
      .eq('user_id', user.id);

    if (writeErr) {
      console.error('[wordpress-disconnect] Kunne ikke oppdatere client_hosts:', writeErr.message);
      Sentry.captureException(writeErr);
      return res.status(500).json({ error: 'Kunne ikke frakoble.' });
    }

    return res.status(200).json({ ok: true, wasConnected: true });
  } catch (err) {
    const status = err?.statusCode || 500;
    if (status >= 500) {
      console.error('[wordpress-disconnect] Feil:', err?.message || err);
      Sentry.captureException(err);
    }
    return res.status(status).json({
      error: err?.message || 'Noe gikk galt',
    });
  }
});
