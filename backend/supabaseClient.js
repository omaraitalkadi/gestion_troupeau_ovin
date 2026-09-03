// Supabase client singleton.
//
// Works in Node (process.env) and bundlers like Vite (import.meta.env).
// Provide the URL + anon key via environment variables:
//   SUPABASE_URL / SUPABASE_ANON_KEY              (Node, generic)
//   VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY    (Vite)
//   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (Next.js)
//
// On the server you can swap the anon key for the SERVICE_ROLE key (bypasses RLS).
import { createClient } from '@supabase/supabase-js';

import { loadEnvFile } from 'node:process'

loadEnvFile()



// Supabase client
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
export default supabase;
