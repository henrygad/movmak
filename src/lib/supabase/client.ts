"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

export function createClient<DatabaseType = Database>() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new Error("Supabase browser configuration is missing.");
  return createBrowserClient<DatabaseType>(url, publishableKey, {
    global: {
      // PostgREST requires this public header even when an authenticated
      // access token is also present. Set it explicitly so browser requests
      // cannot lose it during session rotation or production bundling.
      headers: { apikey: publishableKey },
    },
  });
}
