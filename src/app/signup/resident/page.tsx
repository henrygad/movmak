import { SignupScreen } from "../signup-screen";

export default async function ResidentSignupPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return <SignupScreen role="host" token={(await searchParams).token} />;
}
