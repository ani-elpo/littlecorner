"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Browser Supabase client authenticated as the current Clerk user.
 *
 * Requires Clerk to be configured as a Supabase "Third-Party Auth" provider
 * (see README) so that Supabase's RLS recognizes a valid Clerk session
 * token and maps the request to the `authenticated` Postgres role. This is
 * what makes the realtime subscription on `posts` privacy-safe.
 *
 * `getToken` should be `session.getToken` from Clerk's `useSession()` hook.
 */
export function getSupabaseBrowserClient(
  getToken: () => Promise<string | null>
) {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  cached = createClient(url, anonKey, {
    accessToken: async () => (await getToken()) ?? null,
  });

  return cached;
}

let uploadClient: SupabaseClient | null = null;

/**
 * Plain anon-key client used only for `uploadToSignedUrl`. No Clerk token
 * needed - the signed upload token itself authorizes the write.
 */
export function getSupabaseUploadClient() {
  if (uploadClient) return uploadClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  uploadClient = createClient(url, anonKey);
  return uploadClient;
}
