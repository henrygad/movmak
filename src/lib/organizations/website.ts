export function normalizeOrganizationWebsite(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048 || /\s/.test(trimmed)) return null;

  try {
    const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password || url.port) return null;
    const labels = url.hostname.split(".");
    const topLevelDomain = labels.at(-1) ?? "";
    const validLabel = (label: string) =>
      label.length <= 63 && /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label);
    if (
      labels.length < 2
      || labels.some((label) => !validLabel(label))
      || !/^(?:[a-z]{2,63}|xn--[a-z\d-]{2,59})$/i.test(topLevelDomain)
    ) return null;
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

