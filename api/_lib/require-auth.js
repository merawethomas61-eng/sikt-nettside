import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function unauthorized(message) {
  const err = new Error(message);
  err.statusCode = 401;
  return err;
}

/**
 * Validerer Supabase JWT fra Authorization-headeren.
 * @returns {Promise<{ user: import('@supabase/supabase-js').User, token: string }>}
 */
export async function requireAuth(req) {
  const authHeader = req.headers?.authorization;
  if (!authHeader) {
    throw unauthorized('Avvist: Du er ikke logget inn');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw unauthorized('Avvist: Du er ikke logget inn');
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const err = new Error('Supabase er ikke konfigurert på serveren');
    err.statusCode = 500;
    throw err;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    throw unauthorized('Avvist: Ugyldig bruker');
  }

  return { user, token };
}
