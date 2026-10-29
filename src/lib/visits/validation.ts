export const VISIT_PURPOSES = [
  "Social visit",
  "Business meeting",
  "Delivery",
  "Maintenance or repairs",
  "Domestic work",
  "Event",
  "Overnight stay",
  "Other",
] as const;

export type VisitPurpose = (typeof VISIT_PURPOSES)[number];
export type VisitorDetails = { fullName: string; phone: string; purpose: string; companionCount: number };

export function isVisitPurpose(value: string): value is VisitPurpose {
  return VISIT_PURPOSES.some((purpose) => purpose === value);
}

export function totalGroupSize(companionCount: number) {
  return companionCount + 1;
}

export function phoneNumbersMatch(phone: string, confirmation: string) {
  return phone.trim() === confirmation.trim();
}

export function validateVisitorDetails(input: VisitorDetails) {
  if (input.fullName.trim().length < 2 || input.fullName.trim().length > 160) return "Enter the visitor's full name.";
  if (input.phone.trim().length < 3 || input.phone.trim().length > 40) return "Enter a valid phone number.";
  if (!isVisitPurpose(input.purpose)) return "Choose a valid purpose of visit.";
  if (!Number.isInteger(input.companionCount) || input.companionCount < 0 || input.companionCount > 99) return "Companions must be between 0 and 99.";
  return null;
}
