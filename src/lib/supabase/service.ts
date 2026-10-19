import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnvironment } from "@/lib/env";
import type { Database } from "@/types/database.types";

export function createServiceClient<DatabaseType = Database>() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  const { url } = getPublicSupabaseEnvironment();

  return createClient<DatabaseType>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
