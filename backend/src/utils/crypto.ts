import crypto from 'crypto';

/**
 * Genera un codice OTP alfanumerico casuale in maiuscolo (default: 6 caratteri).
 */
export function generateRandomOtp(length: number = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Esegue l'hashing crittografico di una password con SHA-256.
 */
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password.trim()).digest('hex');
}

/**
 * Verifica una password in chiaro rispetto all'hash memorizzato nel database.
 * Supporta sia hash SHA-256 sia password in chiaro legacy / seed di sviluppo.
 */
export function verifyPassword(password: string, storedHash?: string | null): boolean {
  if (!storedHash) return false;
  const cleanPass = password.trim();
  const hashed = hashPassword(cleanPass);
  return storedHash === hashed || storedHash === cleanPass;
}
