import { FastifyInstance } from 'fastify';
import { trainerController } from '../controllers/trainerController';
import { authorize } from '../middleware/auth';

export async function trainerRoutes(fastify: FastifyInstance) {
  // Rotta creazione cliente: solo Nome e Cognome, genera OTP
  fastify.post('/clients', {
    preHandler: [authorize(['TRAINER'])],
    handler: trainerController.createClient.bind(trainerController),
  });

  // Rotta hard delete cliente: eliminazione totale a cascata
  fastify.delete('/clients/:id', {
    preHandler: [authorize(['TRAINER'])],
    handler: trainerController.deleteClient.bind(trainerController),
  });

  // Rotta elenco clienti per il trainer
  fastify.get('/clients', {
    preHandler: [authorize(['TRAINER'])],
    handler: trainerController.getClients.bind(trainerController),
  });
}
