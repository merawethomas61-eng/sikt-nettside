import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  // Fanges opp tidlig slik at vi ikke lanserer med tom konfig
  throw new Error(
    'Mangler VITE_SUPABASE_URL eller VITE_SUPABASE_ANON_KEY. Sett dem i .env.local (lokalt) og i Vercel → Project Settings → Environment Variables (produksjon).'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
