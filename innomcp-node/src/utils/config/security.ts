export const PRODUCTION_JWT_SECRET_MIN_LENGTH = 32;

const JWT_SECRET_PLACEHOLDERS = new Set([
  'default-secret-change-me',
  'innomcp-secret-key-change-in-production',
  'change_this_in_production_xyz789',
]);

function normalizeJwtSecret(secret: string | undefined): string {
  return String(secret || '').trim();
}

export function validateProductionJwtSecret(secret: string | undefined): string[] {
  const normalizedSecret = normalizeJwtSecret(secret);
  const errors: string[] = [];

  if (!normalizedSecret) {
    return ['JWT_SECRET is required in production'];
  }

  if (normalizedSecret.length < PRODUCTION_JWT_SECRET_MIN_LENGTH) {
    errors.push(
      `JWT_SECRET must be at least ${PRODUCTION_JWT_SECRET_MIN_LENGTH} characters in production`
    );
  }

  if (JWT_SECRET_PLACEHOLDERS.has(normalizedSecret.toLowerCase())) {
    errors.push('JWT_SECRET is using a placeholder value');
  }

  return errors;
}

export function assertProductionJwtSecret(
  environment: string | undefined,
  secret: string | undefined
): void {
  if (environment !== 'production') {
    return;
  }

  const errors = validateProductionJwtSecret(secret);
  if (errors.length > 0) {
    throw new Error(
      `Refusing to start in production with invalid JWT_SECRET: ${errors.join('; ')}`
    );
  }
}