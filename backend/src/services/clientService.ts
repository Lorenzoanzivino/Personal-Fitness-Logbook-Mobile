import { db } from '../db';
import { users } from '../db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { ClientOnboardingDto, AuthUser } from '../types/auth';
import { hashPassword } from '../utils/crypto';

export class ClientService {
  /**
   * Completa l'onboarding obbligatorio del cliente:
   * Aggiorna username, nome, cognome, password (hashata), altezza, data di nascita e avatar_url.
   * Imposta is_onboarded = true.
   */
  async completeOnboarding(userId: string, data: ClientOnboardingDto): Promise<AuthUser> {
    const cleanUsername = data.username ? data.username.trim().replace(/^@/, '') : '';
    const cleanFirst = data.firstName ? data.firstName.trim() : '';
    const cleanLast = data.lastName ? data.lastName.trim() : '';
    const cleanPass = data.password ? data.password.trim() : '';
    const cleanBirthDate = data.dateOfBirth ? data.dateOfBirth.trim() : '';
    const numHeight = Number(data.height);

    if (!cleanUsername) {
      throw {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Lo Username è obbligatorio.',
      };
    }

    if (!cleanFirst || !cleanLast) {
      throw {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Nome e Cognome sono obbligatori.',
      };
    }

    if (!cleanPass || cleanPass.length < 4) {
      throw {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'La Password deve contenere almeno 4 caratteri.',
      };
    }

    if (isNaN(numHeight) || numHeight < 50 || numHeight > 260) {
      throw {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'L\'Altezza deve essere un numero valido compreso tra 50 e 260 cm.',
      };
    }

    if (!cleanBirthDate) {
      throw {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'La Data di Nascita è obbligatoria.',
      };
    }

    // Verifica unicità username su altri utenti
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.username, cleanUsername), ne(users.id, userId)))
      .limit(1);

    if (existing.length > 0) {
      throw {
        statusCode: 409,
        code: 'CONFLICT',
        message: `Lo username @${cleanUsername} è già in uso. Scegline un altro.`,
      };
    }

    const passwordHash = hashPassword(cleanPass);

    await db
      .update(users)
      .set({
        username: cleanUsername,
        firstName: cleanFirst,
        lastName: cleanLast,
        passwordHash,
        heightCm: String(numHeight),
        birthDate: cleanBirthDate,
        avatarUrl: data.avatar_url || null,
        isOnboarded: true,
        isProfileCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    const updatedRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (updatedRows.length === 0) {
      throw {
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        message: 'Utente non trovato.',
      };
    }

    const u = updatedRows[0];
    return {
      id: u.id,
      username: u.username,
      first_name: u.firstName,
      last_name: u.lastName,
      role: u.role as any,
      email: u.email || undefined,
      birth_date: u.birthDate || undefined,
      height_cm: u.heightCm ? Number(u.heightCm) : undefined,
      avatar_url: u.avatarUrl || null,
      is_onboarded: true,
      is_profile_completed: true,
      trainer_id: u.trainerId || undefined,
      trainer_name: u.trainerName || undefined,
    };
  }
}

export const clientService = new ClientService();
