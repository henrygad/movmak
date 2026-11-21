const nigeriaCountryCode = "234";

export type NormalizedPhone =
  | { ok: true; value: string }
  | { ok: false; error: string };

/** Normalize a user-entered number to E.164. Nigerian local numbers such as
 * 0803 123 4567 become +2348031234567. Other countries must include their
 * country code (with + or 00) so that we never guess the caller's country.
 */
export function normalizePhoneNumber(input: string): NormalizedPhone {
  const compact = input.trim().replace(/[\s().-]/g, "");
  if (!compact) return { ok: false, error: "Enter a phone number." };

  let digits: string;
  if (compact.startsWith("+")) {
    digits = compact.slice(1);
  } else if (compact.startsWith("00")) {
    digits = compact.slice(2);
  } else if (compact.startsWith("0")) {
    digits = `${nigeriaCountryCode}${compact.slice(1)}`;
  } else {
    digits = compact;
  }

  if (!/^\d{8,15}$/.test(digits) || digits.startsWith("0")) {
    return { ok: false, error: "Enter a valid phone number with its country code." };
  }

  return { ok: true, value: `+${digits}` };
}

export function phoneNumbersMatch(first: string, second: string) {
  const normalizedFirst = normalizePhoneNumber(first);
  const normalizedSecond = normalizePhoneNumber(second);
  return normalizedFirst.ok && normalizedSecond.ok && normalizedFirst.value === normalizedSecond.value;
}
