import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/auth/dal";

export default async function Home() {
  const context = await getAccessContext();
  if (context.kind === "unauthenticated") redirect("/login");
  if (context.kind === "no_membership") redirect("/app");
  if (context.kind === "inactive") redirect("/access-inactive");
  redirect("/app");
}
