export function sanitizeInput(input: string | null): string | null {
  if (input === null) return null;
  // Remove any potentially harmful characters
  return input.replace(/[^a-zA-Z0-9-_ ]/g, '');
}
