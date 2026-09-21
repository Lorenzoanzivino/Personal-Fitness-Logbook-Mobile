import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { UserProfile, UpdateProfileRequestDto } from '../types/profile';

export async function profileRoutes(fastify: FastifyInstance) {
  // GET /api/v1/profile
  fastify.get('/api/v1/profile', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { id?: string };
    const userId = query.id || 'trainer-1';

    const userRows = await db.select().from(users).where(eq(users.id, userId));

    if (userRows.length === 0) {
      return reply.code(404).send({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Profilo non trovato.' },
      });
    }

    const u = userRows[0];
    const profile: UserProfile = {
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

    return reply.send({
      success: true,
      data: profile,
      error: null,
    });
  });

  // PUT /api/v1/profile
  fastify.put('/api/v1/profile', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as UpdateProfileRequestDto;
    const userId = String(body.id || 'trainer-1');

    await db
      .update(users)
      .set({
        firstName: body.first_name,
        lastName: body.last_name,
        birthDate: body.birth_date,
        heightCm: body.height_cm ? String(body.height_cm) : undefined,
        avatarUrl: body.avatar_url || null,
        email: body.email || null,
        isProfileCompleted: body.is_profile_completed ?? true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    const updated = await db.select().from(users).where(eq(users.id, userId));
    const u = updated[0];

    const profile: UserProfile = {
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

    return reply.send({
      success: true,
      data: profile,
      error: null,
    });
  });
}
