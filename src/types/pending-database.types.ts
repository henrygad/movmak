import type { Database } from "@/types/database.types";

/** Compatibility alias for call sites written before the applied schema was generated. */
export type DatabaseWithPendingOnboarding = Database;
