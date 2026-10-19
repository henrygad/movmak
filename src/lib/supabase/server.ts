import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";
import { getPublicSupabaseEnvironment } from "@/lib/env";

export async function createClient<DatabaseType = Database>() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getPublicSupabaseEnvironment();

  return createServerClient<DatabaseType>(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies. The request proxy refreshes them.
        }
      },
    },
  });
}
