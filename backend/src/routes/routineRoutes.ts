import { FastifyInstance } from 'fastify';
import { routineController } from '../controllers/routineController';

export async function routineRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/v1/routines',
    { preHandler: [fastify.authenticate] },
    routineController.getRoutines
  );

  fastify.post(
    '/api/v1/routines',
    { preHandler: [fastify.authenticate] },
    routineController.createRoutine
  );

  fastify.delete(
    '/api/v1/routines/:id',
    { preHandler: [fastify.authenticate] },
    routineController.deleteRoutine
  );
}
