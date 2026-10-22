import { SignupScreen } from "../signup-screen";

export default async function AdminSignupPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return <SignupScreen role="admin" token={(await searchParams).token} />;
}
