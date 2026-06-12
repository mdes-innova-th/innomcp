




export function validateEnv(required: string[]): void {
  const missing: string[] = [];

  for (const name of required) {
    if (!process.env[name]) {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}
