import {
  isValidCoordinate,
  isValidEmail,
  normalizeBusCode,
  normalizeEmail,
  validateBusCode,
  validatePassword,
} from './input-validation';

describe('authentication input validation', () => {
  test('normalizes and validates email addresses', () => {
    expect(normalizeEmail(' Rider@Example.COM ')).toBe('rider@example.com');
    expect(isValidEmail('rider@example.com')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
  });

  test('enforces production password bounds', () => {
    expect(validatePassword('short')).toMatch(/at least 8/);
    expect(validatePassword('correct horse battery staple')).toBeNull();
    expect(validatePassword('x'.repeat(129))).toMatch(/no more than 128/);
  });
});

describe('dispatch input validation', () => {
  test('normalizes a bus code and rejects unsafe values', () => {
    expect(normalizeBusCode(' ab-  142 ')).toBe('AB- 142');
    expect(validateBusCode('AB-142')).toBeNull();
    expect(validateBusCode('<script>')).not.toBeNull();
    expect(validateBusCode('A')).not.toBeNull();
  });

  test('accepts only finite world coordinates', () => {
    expect(isValidCoordinate(11.009, 124.609)).toBe(true);
    expect(isValidCoordinate(91, 124.609)).toBe(false);
    expect(isValidCoordinate(Number.NaN, 124.609)).toBe(false);
  });
});
