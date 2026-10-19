export function validateHostProfile(fullName: string, phone: string) {
  const name = fullName.trim();
  const number = phone.trim();
  if (name.length < 2 || name.length > 160) return "Enter a name between 2 and 160 characters.";
  if (number && (number.length < 3 || number.length > 40)) return "Enter a valid phone number or leave it blank.";
  return null;
}
