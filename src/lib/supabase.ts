import { createClient } from "@supabase/supabase-js";

// We do not have generated Supabase database types in this prototype yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseClient: ReturnType<typeof createClient<any>> | null = null;

export function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase server credentials are not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  if (!supabaseClient) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabaseClient = createClient<any>(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseClient;
}
