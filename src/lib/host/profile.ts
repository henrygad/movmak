export function validateHostProfile(fullName: string, phone: string, address: string) {
  const name = fullName.trim();
  const number = phone.trim();
  const homeAddress = address.trim();
  if (name.length < 2 || name.length > 160) return "Enter a name between 2 and 160 characters.";
  if (number.length < 3 || number.length > 40) return "Enter a valid phone number.";
  if (homeAddress.length < 5 || homeAddress.length > 300) return "Enter your house or unit address.";
  return null;
}
