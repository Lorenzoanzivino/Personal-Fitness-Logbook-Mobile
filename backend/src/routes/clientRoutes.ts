import { FastifyInstance } from 'fastify';
import { clientController } from '../controllers/clientController';
import { authenticate } from '../middleware/auth';

export async function clientRoutes(fastify: FastifyInstance) {
  // Rotta onboarding obbligatorio: aggiorna profilo atleta e imposta is_onboarded = true
  fastify.put('/api/v1/clients/onboarding', {
    preHandler: [authenticate],
    handler: clientController.completeOnboarding.bind(clientController),
  });
}
