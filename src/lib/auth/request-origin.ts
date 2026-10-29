type HeaderReader = Pick<Headers, "get">;

type RuntimeEnvironment = {
  NODE_ENV?: string;
  VERCEL_URL?: string;
};

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value.trim());
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) return null;
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function resolveRequestOrigin(
  requestHeaders: HeaderReader,
  environment: RuntimeEnvironment = process.env,
) {
  const requestOrigin = normalizeOrigin(requestHeaders.get("origin"));
  if (requestOrigin) return requestOrigin;

  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHost) {
    const forwardedOrigin = normalizeOrigin(`${forwardedProtocol === "http" ? "http" : "https"}://${forwardedHost}`);
    if (forwardedOrigin) return forwardedOrigin;
  }

  const vercelOrigin = environment.VERCEL_URL
    ? normalizeOrigin(`https://${environment.VERCEL_URL}`)
    : null;
  if (vercelOrigin) return vercelOrigin;

  return environment.NODE_ENV === "development" ? "http://localhost:3000" : null;
}
