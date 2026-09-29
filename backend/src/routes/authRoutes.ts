import { FastifyInstance } from 'fastify';
import { authController } from '../controllers/authController';
import { trainerController } from '../controllers/trainerController';
import { authorize } from '../middleware/auth';

export async function authRoutes(fastify: FastifyInstance) {
  // -------------------------------------------------------------------
  // 1. SMART LOGIN UNIFICATO (TRAINER O CLIENTE CON USERNAME/NOME E PASSWORD/OTP)
  // -------------------------------------------------------------------
  fastify.post('/api/v1/auth/login', authController.login.bind(authController));

  // -------------------------------------------------------------------
  // 2. RECUPERO CLIENTI PROVISIONATI PER IL TRAINER (RETROCOMPATIBILITÀ)
  // -------------------------------------------------------------------
  fastify.get('/api/v1/auth/provisioned-clients', {
    preHandler: [authorize(['TRAINER'])],
    handler: trainerController.getClients.bind(trainerController),
  });

  // -------------------------------------------------------------------
  // 3. CREAZIONE CLIENTE (RETROCOMPATIBILITÀ CON /api/v1/auth/provision)
  // -------------------------------------------------------------------
  fastify.post('/api/v1/auth/provision', {
    preHandler: [authorize(['TRAINER'])],
    handler: trainerController.createClient.bind(trainerController),
  });

  fastify.post('/api/v1/auth/create-client', {
    preHandler: [authorize(['TRAINER'])],
    handler: trainerController.createClient.bind(trainerController),
  });
}
