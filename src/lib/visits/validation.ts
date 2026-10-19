export type VisitorDetails = { fullName: string; phone: string; purpose: string; groupSize: number };

export function validateVisitorDetails(input: VisitorDetails) {
  if (input.fullName.trim().length < 2 || input.fullName.trim().length > 160) return "Enter the visitor's full name.";
  if (input.phone.trim().length < 3 || input.phone.trim().length > 40) return "Enter a valid phone number.";
  if (input.purpose.trim().length < 2 || input.purpose.trim().length > 500) return "Enter the purpose of the visit.";
  if (!Number.isInteger(input.groupSize) || input.groupSize < 1 || input.groupSize > 100) return "Group size must be between 1 and 100.";
  return null;
}
