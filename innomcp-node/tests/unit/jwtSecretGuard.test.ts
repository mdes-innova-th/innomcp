import {
  assertProductionJwtSecret,
  PRODUCTION_JWT_SECRET_MIN_LENGTH,
  validateProductionJwtSecret,
} from '../../src/utils/config/security';

describe('JWT startup guard', () => {
  it('allows short secrets outside production', () => {
    expect(() => assertProductionJwtSecret('development', 'short-secret')).not.toThrow();
  });

  it('rejects short secrets in production', () => {
    expect(validateProductionJwtSecret('short-secret')).toContain(
      `JWT_SECRET must be at least ${PRODUCTION_JWT_SECRET_MIN_LENGTH} characters in production`
    );
  });

  it('rejects placeholder secrets in production', () => {
    expect(validateProductionJwtSecret('innomcp-secret-key-change-in-production')).toContain(
      'JWT_SECRET is using a placeholder value'
    );
  });

  it('accepts a strong production secret', () => {
    expect(validateProductionJwtSecret('a'.repeat(PRODUCTION_JWT_SECRET_MIN_LENGTH))).toEqual([]);
    expect(() =>
      assertProductionJwtSecret('production', 'a'.repeat(PRODUCTION_JWT_SECRET_MIN_LENGTH))
    ).not.toThrow();
  });
});