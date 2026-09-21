import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db';
import { routineFolders } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { RoutineFolder } from '../types/workout';

export async function folderRoutes(fastify: FastifyInstance) {
  // GET /api/v1/folders
  fastify.get('/api/v1/folders', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { owner_id?: string };
    const ownerId = query.owner_id;

    const foldersQuery = ownerId
      ? db.select().from(routineFolders).where(eq(routineFolders.ownerId, ownerId)).orderBy(desc(routineFolders.createdAt))
      : db.select().from(routineFolders).orderBy(desc(routineFolders.createdAt));

    const rows = await foldersQuery;
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
  });

  // POST /api/v1/folders
  fastify.post('/api/v1/folders', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { name: string; owner_id?: string };

    if (!body.name) {
      return reply.code(400).send({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Nome cartella obbligatorio.' },
      });
    }

    const folderId = `folder-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const ownerId = body.owner_id || 'trainer-1';

    const inserted = await db
      .insert(routineFolders)
      .values({
        id: folderId,
        name: body.name.trim(),
        ownerId,
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
  });

  // DELETE /api/v1/folders/:id
  fastify.delete('/api/v1/folders/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    await db.delete(routineFolders).where(eq(routineFolders.id, id));

    return reply.send({
      success: true,
      data: { id, deleted: true },
      error: null,
    });
  });
}
