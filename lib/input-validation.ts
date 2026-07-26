export const PASSWORD_MIN_LENGTH = 8;

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  const email = normalizeEmail(value);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(value: string) {
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (value.length > 128) {
    return 'Password must be no more than 128 characters.';
  }
  return null;
}

export function normalizeBusCode(value: string) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

export function validateBusCode(value: string) {
  const normalized = normalizeBusCode(value);
  if (!/^[A-Z0-9][A-Z0-9 -]{1,19}$/.test(normalized)) {
    return 'Bus code must contain 2–20 letters, numbers, spaces, or hyphens.';
  }
  return null;
}

export function isValidCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}
