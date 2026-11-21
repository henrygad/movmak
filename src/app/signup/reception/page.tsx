import { redirect } from "next/navigation";

export default async function ReceptionSignupPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token;
  redirect(token ? `/signup/security?token=${encodeURIComponent(token)}` : "/signup/security");
}
