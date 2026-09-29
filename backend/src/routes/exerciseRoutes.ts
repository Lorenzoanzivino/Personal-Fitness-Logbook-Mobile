import { FastifyInstance } from 'fastify';
import { exerciseController } from '../controllers/exerciseController';
import { authorize } from '../middleware/auth';

export async function exerciseRoutes(fastify: FastifyInstance) {
  // GET /api/v1/exercises - Protetto: SOLO TRAINER autorizzato
  fastify.get(
    '/api/v1/exercises',
    { preHandler: [authorize(['TRAINER'])] },
    exerciseController.getExercises
  );
}
