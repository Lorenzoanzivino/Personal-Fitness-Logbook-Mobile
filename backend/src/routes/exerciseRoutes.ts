import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db';
import { exercises } from '../db/schema';
import { asc } from 'drizzle-orm';
import { Exercise } from '../types/workout';

export async function exerciseRoutes(fastify: FastifyInstance) {
  // GET /api/v1/exercises
  fastify.get('/api/v1/exercises', async (request: FastifyRequest, reply: FastifyReply) => {
    const rows = await db.select().from(exercises).orderBy(asc(exercises.id));

    const data: Exercise[] = rows.map((e) => ({
      id: e.id,
      name: e.name,
      muscle_group: e.muscleGroup as any,
      exercise_type: e.exerciseType as any,
      description: e.description,
      video_url: e.videoUrl,
      is_archived: e.isArchived,
      notes: e.notes,
      created_at: e.createdAt.toISOString(),
    }));

    return reply.send({
      success: true,
      data,
      error: null,
    });
  });
}
