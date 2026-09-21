import { FastifyInstance } from 'fastify';
import { profileController } from '../controllers/profileController';

export async function profileRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/v1/profile',
    { preHandler: [fastify.authenticate] },
    profileController.getProfile
  );

  fastify.put(
    '/api/v1/profile',
    { preHandler: [fastify.authenticate] },
    profileController.updateProfile
  );
}
