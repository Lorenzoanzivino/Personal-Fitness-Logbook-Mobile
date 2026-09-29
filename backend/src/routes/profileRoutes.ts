import { FastifyInstance } from 'fastify';
import { profileController } from '../controllers/profileController';

export async function profileRoutes(fastify: FastifyInstance) {
  // GET /api/v1/profile (e alias /api/v1/users/profile)
  fastify.get(
    '/api/v1/profile',
    { preHandler: [fastify.authenticate] },
    profileController.getProfile
  );
  fastify.get(
    '/api/v1/users/profile',
    { preHandler: [fastify.authenticate] },
    profileController.getProfile
  );

  // PUT /api/v1/profile (e alias /api/v1/users/profile)
  fastify.put(
    '/api/v1/profile',
    { preHandler: [fastify.authenticate] },
    profileController.updateProfile
  );
  fastify.put(
    '/api/v1/users/profile',
    { preHandler: [fastify.authenticate] },
    profileController.updateProfile
  );

  // PATCH /api/v1/profile (e alias /api/v1/users/profile)
  fastify.patch(
    '/api/v1/profile',
    { preHandler: [fastify.authenticate] },
    profileController.updateProfile
  );
  fastify.patch(
    '/api/v1/users/profile',
    { preHandler: [fastify.authenticate] },
    profileController.updateProfile
  );
}
