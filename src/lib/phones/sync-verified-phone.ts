export type VerifiedPhoneSyncResult = {
  phone: string | null;
  status: number | null;
};

export async function syncVerifiedPhoneWithSession(
  accessToken: string,
): Promise<VerifiedPhoneSyncResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey || !accessToken) {
    return { phone: null, status: null };
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sync_my_verified_phone`, {
    method: "POST",
    headers: {
      accept: "application/json",
      apikey: publishableKey,
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: "{}",
  });

  if (!response.ok) return { phone: null, status: response.status };
  const result: unknown = await response.json();
  return typeof result === "string"
    ? { phone: result, status: response.status }
    : { phone: null, status: response.status };
}
