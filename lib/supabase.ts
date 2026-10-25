import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getServiceSupabase() {
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** How PostgREST and Postgres say a table or column isn't there: a
 *  migration hasn't run yet. */
const MISSING_SCHEMA = new Set(["PGRST204", "PGRST205", "42703", "42P01"]);

export function isMissingSchema(error: { code?: string } | null | undefined): boolean {
  return !!error?.code && MISSING_SCHEMA.has(error.code);
}
