/**
 * Masks a personal name by showing only the first and last characters
 * Format: S***** L*****e (for "Somchai Lastname")
 * @param name The name to mask
 * @returns The masked name
 */
export function maskName(name: string): string {
  if (!name || name.trim() === "") return "";

  // Split by spaces to handle first and last names
  const parts = name.split(" ").filter((part) => part.trim() !== "");

  return parts
    .map((part) => {
      if (part.length <= 2) return part; // Don't mask very short names/initials
      return part[0] + "*".repeat(part.length - 2) + part[part.length - 1];
    })
    .join(" ");
}

/**
 * Masks a phone number showing only first 3 and last 2 digits
 * Format: 087*****55 (for "0871234555")
 * @param phone The phone number to mask
 * @returns The masked phone number
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.trim() === "") return "";

  // Remove any non-digit characters
  const cleanPhone = phone.replace(/\D/g, "");

  if (cleanPhone.length <= 5) return "*".repeat(cleanPhone.length);

  // Keep first 3 digits and last 2 digits, mask the rest
  return (
    cleanPhone.substring(0, 3) +
    "*".repeat(cleanPhone.length - 5) +
    cleanPhone.substring(cleanPhone.length - 2)
  );
}

/**
 * Masks an email address by showing first 2 characters of local part and first character of domain
 * Format: ex****@g****.com (for "example@gmail.com")
 * @param email The email address to mask
 * @returns The masked email address
 */
export function maskEmail(email: string): string {
  if (!email || email.trim() === "") return "";

  const parts = email.split("@");
  if (parts.length !== 2) return "*".repeat(email.length); // Invalid email format

  const [localPart, domain] = parts;
  const domainParts = domain.split(".");

  // Mask local part (username): Keep first 2 chars, mask the rest
  const maskedLocal =
    localPart.length <= 3
      ? localPart[0] + "*".repeat(localPart.length - 1)
      : localPart.substring(0, 2) + "*".repeat(localPart.length - 2);

  // Mask domain: Keep first char of domain and TLD extension
  const maskedDomain = domainParts
    .map((part, index) => {
      // Don't mask TLD extension (e.g., .com, .org)
      if (index === domainParts.length - 1) return part;

      // For the main domain part, show first char and mask the rest
      return part.substring(0, 1) + "*".repeat(part.length - 1);
    })
    .join(".");

  return `${maskedLocal}@${maskedDomain}`;
}
