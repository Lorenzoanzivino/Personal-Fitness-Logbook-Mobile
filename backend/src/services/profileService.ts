import { db } from '../db';
import { users } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { UserProfile, UpdateProfileRequestDto } from '../types/profile';
import { AuthenticatedUser } from '../middleware/auth';

export class ProfileService {
  async getProfile(
    authUser: AuthenticatedUser,
    targetUserId?: string
  ): Promise<UserProfile> {
    let effectiveUserId = authUser.id;

    if (authUser.role === 'TRAINER' && targetUserId && targetUserId !== authUser.id) {
      // Trainer può visualizzare solo un'allieva a lui collegata
      const clientRows = await db
        .select()
        .from(users)
        .where(and(eq(users.id, targetUserId), eq(users.trainerId, authUser.id)));

      if (clientRows.length === 0) {
        throw {
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Non sei autorizzato a visualizzare il profilo di questo utente.',
        };
      }
      effectiveUserId = targetUserId;
    }

    const userRows = await db.select().from(users).where(eq(users.id, effectiveUserId));

    if (userRows.length === 0) {
      throw {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Profilo non trovato.',
      };
    }

    const u = userRows[0];
    return {
      id: u.id,
      username: u.username,
      first_name: u.firstName,
      last_name: u.lastName,
      birth_date: u.birthDate || '01-01-1995',
      height_cm: u.heightCm ? Number(u.heightCm) : 175,
      avatar_url: u.avatarUrl || null,
      role: u.role as any,
      email: u.email || undefined,
      is_profile_completed: u.isProfileCompleted ?? false,
      trainer_id: u.trainerId || undefined,
      trainer_name: u.trainerName || undefined,
      created_at: u.createdAt.toISOString(),
      updated_at: u.updatedAt.toISOString(),
    };
  }

  async updateProfile(
    authUser: AuthenticatedUser,
    dto: UpdateProfileRequestDto
  ): Promise<UserProfile> {
    // TASSATIVO: Un utente può aggiornare unicamente il proprio profilo
    let usernameToSet: string | undefined = undefined;
    if (dto.username !== undefined && dto.username.trim() !== '') {
      const cleanUsername = dto.username.trim().replace(/^@/, '');
      if (cleanUsername !== authUser.username) {
        const existingUsers = await db
          .select()
          .from(users)
          .where(eq(users.username, cleanUsername));

        if (existingUsers.length > 0 && existingUsers[0].id !== authUser.id) {
          throw {
            statusCode: 409,
            code: 'CONFLICT',
            message: `Lo username @${cleanUsername} è già in uso. Scegline un altro.`,
          };
        }
        usernameToSet = cleanUsername;
      }
    }

    let birthDateToSet: string | undefined = undefined;
    if (dto.birth_date !== undefined && dto.birth_date.trim() !== '') {
      const trimmed = dto.birth_date.trim();
      const dmy = trimmed.match(/^(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{4})/);
      const ymd = trimmed.match(/^(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})/);
      if (dmy) {
        birthDateToSet = `${dmy[1].padStart(2, '0')}-${dmy[2].padStart(2, '0')}-${dmy[3]}`;
      } else if (ymd) {
        birthDateToSet = `${ymd[3].padStart(2, '0')}-${ymd[2].padStart(2, '0')}-${ymd[1]}`;
      } else {
        birthDateToSet = trimmed;
      }
    }

    await db
      .update(users)
      .set({
        username: usernameToSet !== undefined ? usernameToSet : undefined,
        firstName: dto.first_name !== undefined ? dto.first_name : undefined,
        lastName: dto.last_name !== undefined ? dto.last_name : undefined,
        birthDate: birthDateToSet !== undefined ? birthDateToSet : undefined,
        heightCm: dto.height_cm ? String(dto.height_cm) : undefined,
        avatarUrl: dto.avatar_url !== undefined ? dto.avatar_url : undefined,
        email: dto.email !== undefined ? dto.email : undefined,
        isProfileCompleted: dto.is_profile_completed !== undefined ? dto.is_profile_completed : undefined,
        updatedAt: new Date(),
      })
      .where(eq(users.id, authUser.id));

    const updated = await db.select().from(users).where(eq(users.id, authUser.id));
    if (updated.length === 0) {
      throw {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Profilo utente non trovato.',
      };
    }
    const u = updated[0];

    return {
      id: u.id,
      username: u.username,
      first_name: u.firstName,
      last_name: u.lastName,
      birth_date: u.birthDate || '01-01-1995',
      height_cm: u.heightCm ? Number(u.heightCm) : 175,
      avatar_url: u.avatarUrl || null,
      role: u.role as any,
      email: u.email || undefined,
      is_profile_completed: u.isProfileCompleted ?? true,
      trainer_id: u.trainerId || undefined,
      trainer_name: u.trainerName || undefined,
      created_at: u.createdAt.toISOString(),
      updated_at: u.updatedAt.toISOString(),
    };
  }
}

export const profileService = new ProfileService();
