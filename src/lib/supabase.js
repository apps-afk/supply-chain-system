import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client. Uses the SERVICE ROLE key, so it bypasses
// Row Level Security — we already authenticate users via NextAuth before
// touching the database.
//
// If env vars are not set, isSupabaseConfigured will be false and the
// app falls back to in-memory storage (good for local dev without setting
// up Supabase).
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

export const isSupabaseConfigured = !!(URL && KEY);

export const supabase = isSupabaseConfigured
  ? createClient(URL, KEY, { auth: { persistSession: false } })
  : null;
