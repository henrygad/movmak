import { redirect } from "next/navigation";

export default async function HostSignupPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token;
  redirect(token ? `/signup/resident?token=${encodeURIComponent(token)}` : "/signup/resident");
}
