import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db';
import { routineFolders, users } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { RoutineFolder } from '../types/workout';

export async function folderRoutes(fastify: FastifyInstance) {
  // GET /api/v1/folders
  fastify.get(
    '/api/v1/folders',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { owner_id?: string };
      let effectiveOwnerId = request.user.id;

      if (request.user.role === 'TRAINER' && query.owner_id && query.owner_id !== request.user.id) {
        const clientRows = await db
          .select()
          .from(users)
          .where(and(eq(users.id, query.owner_id), eq(users.trainerId, request.user.id)));

        if (clientRows.length > 0) {
          effectiveOwnerId = query.owner_id;
        }
      }

      const rows = await db
        .select()
        .from(routineFolders)
        .where(eq(routineFolders.ownerId, effectiveOwnerId))
        .orderBy(desc(routineFolders.createdAt));

      const data: RoutineFolder[] = rows.map((f) => ({
        id: f.id,
        name: f.name,
        created_at: f.createdAt.toISOString(),
        owner_id: f.ownerId,
      }));

      return reply.send({
        success: true,
        data,
        error: null,
      });
    }
  );

  // POST /api/v1/folders
  fastify.post(
    '/api/v1/folders',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { name: string; owner_id?: string };

      if (!body.name || !body.name.trim()) {
        return reply.code(400).send({
          success: false,
          data: null,
          error: { code: 'VALIDATION_ERROR', message: 'Nome cartella obbligatorio.' },
        });
      }

      let effectiveOwnerId = request.user.id;
      if (request.user.role === 'TRAINER' && body.owner_id && body.owner_id !== request.user.id) {
        effectiveOwnerId = body.owner_id;
      }

      const folderId = `folder-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const inserted = await db
        .insert(routineFolders)
        .values({
          id: folderId,
          name: body.name.trim(),
          ownerId: effectiveOwnerId,
        })
        .returning();

      const created = inserted[0];
      const data: RoutineFolder = {
        id: created.id,
        name: created.name,
        created_at: created.createdAt.toISOString(),
        owner_id: created.ownerId,
      };

      return reply.status(201).send({
        success: true,
        data,
        error: null,
      });
    }
  );

  // DELETE /api/v1/folders/:id
  fastify.delete(
    '/api/v1/folders/:id',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const deleted = await db
        .delete(routineFolders)
        .where(and(eq(routineFolders.id, id), eq(routineFolders.ownerId, request.user.id)))
        .returning();

      if (deleted.length === 0) {
        return reply.code(404).send({
          success: false,
          data: null,
          error: { code: 'NOT_FOUND_OR_FORBIDDEN', message: 'Cartella non trovata o non autorizzato.' },
        });
      }

      return reply.send({
        success: true,
        data: { id, deleted: true },
        error: null,
      });
    }
  );
}
