import { db } from '../db';
import { users, otps } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { generateRandomOtp } from '../utils/crypto';
import { ProvisionedClient, CreateClientResponseDto } from '../types/auth';

export class TrainerService {
  /**
   * Crea un nuovo account cliente accettando ESCLUSIVAMENTE Nome e Cognome.
   * Genera un codice OTP a 6 caratteri, imposta is_onboarded = false e restituisce
   * l'OTP in chiaro nella risposta.
   */
  async createClient(data: {
    firstName: string;
    lastName: string;
    trainerId?: string;
    trainerName?: string;
  }): Promise<CreateClientResponseDto> {
    const cleanFirst = data.firstName.trim();
    const cleanLast = data.lastName.trim();

    if (!cleanFirst || !cleanLast) {
      throw {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Nome e cognome sono entrambi obbligatori per creare il cliente.',
      };
    }

    const cleanFirstLower = cleanFirst.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanLastLower = cleanLast.toLowerCase().replace(/[^a-z0-9]/g, '');
    const randSuffix = Math.floor(10 + Math.random() * 90);
    const generatedUsername = `${cleanFirstLower}.${cleanLastLower}${randSuffix}`;
    const generatedOtp = generateRandomOtp(6);
    const clientId = `client-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const trainerId = data.trainerId || 'trainer-1';
    const trainerName = data.trainerName || 'Lorenzo (Trainer)';

    // Inserimento utente nel DB con is_onboarded = false
    await db.insert(users).values({
      id: clientId,
      username: generatedUsername,
      role: 'CLIENT',
      firstName: cleanFirst,
      lastName: cleanLast,
      rawOtp: generatedOtp,
      isOnboarded: false,
      isProfileCompleted: false,
      trainerId,
      trainerName,
    });

    // Inserimento record OTP collegato al cliente (scadenza a 30 giorni)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.insert(otps).values({
      code: generatedOtp,
      trainerId,
      trainerName,
      clientId,
      expiresAt,
    });

    const client: ProvisionedClient = {
      id: clientId,
      username: generatedUsername,
      first_name: cleanFirst,
      last_name: cleanLast,
      otp: generatedOtp,
      raw_otp: generatedOtp,
      trainer_id: trainerId,
      trainer_name: trainerName,
      avatar_url: null,
      created_at: new Date().toISOString(),
      is_onboarded: false,
      is_profile_completed: false,
      isArchived: false,
    };

    return {
      client,
      otp: generatedOtp,
    };
  }

  /**
   * Elimina definitivamente un cliente (HARD DELETE).
   * Grazie al vincolo ON DELETE CASCADE sulle chiavi esterne di PostgreSQL,
   * vengono distrutte istantaneamente e a cascata tutte le schede,
   * i blocchi, gli esercizi, i set, i log di allenamento, le misurazioni e gli OTP.
   */
  async deleteClient(clientId: string): Promise<{ id: string; deleted: boolean }> {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, clientId), eq(users.role, 'CLIENT')))
      .limit(1);

    if (existing.length === 0) {
      throw {
        statusCode: 404,
        code: 'CLIENT_NOT_FOUND',
        message: `Cliente con ID "${clientId}" non trovato.`,
      };
    }

    await db.delete(users).where(eq(users.id, clientId));

    return {
      id: clientId,
      deleted: true,
    };
  }

  /**
   * Recupera la lista di tutti i clienti gestiti dal trainer.
   */
  async getClients(): Promise<ProvisionedClient[]> {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.role, 'CLIENT'))
      .orderBy(desc(users.createdAt));

    return rows.map((u) => ({
      id: u.id,
      username: u.username,
      first_name: u.firstName,
      last_name: u.lastName,
      otp: u.rawOtp || '',
      raw_otp: u.rawOtp || '',
      trainer_id: u.trainerId || 'trainer-1',
      trainer_name: u.trainerName || 'Lorenzo (Trainer)',
      notes: u.notes || undefined,
      avatar_url: u.avatarUrl || null,
      email: u.email || undefined,
      created_at: u.createdAt.toISOString(),
      isArchived: u.isArchived ?? false,
      is_onboarded: u.isOnboarded ?? false,
      is_profile_completed: u.isProfileCompleted ?? false,
    }));
  }
}

export const trainerService = new TrainerService();
