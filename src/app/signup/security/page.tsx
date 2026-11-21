import { SignupScreen } from "../signup-screen";

export default async function SecuritySignupPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return <SignupScreen role="security" token={(await searchParams).token} />;
}
