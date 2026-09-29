import { FastifyRequest, FastifyReply } from 'fastify';
import { trainerService } from '../services/trainerService';
import { CreateClientRequestDto } from '../types/auth';

export class TrainerController {
  /**
   * POST /api/v1/trainer/clients
   * Creazione cliente: accetta solo firstName e lastName.
   */
  async createClient(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as CreateClientRequestDto;
      const trainerId = (request as any).user?.id || 'trainer-1';
      const trainerName = (request as any).user?.username
        ? `${(request as any).user.username} (Trainer)`
        : 'Lorenzo (Trainer)';

      const result = await trainerService.createClient({
        firstName: body.firstName,
        lastName: body.lastName,
        trainerId,
        trainerName,
      });

      return reply.code(201).send({
        success: true,
        data: result,
        error: null,
      });
    } catch (err: any) {
      const status = err.statusCode || 500;
      return reply.code(status).send({
        success: false,
        data: null,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message || 'Errore nella creazione del cliente.',
        },
      });
    }
  }

  /**
   * DELETE /api/v1/trainer/clients/:id
   * Eliminazione irreversibile (Hard Delete) a cascata del cliente.
   */
  async deleteClient(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const result = await trainerService.deleteClient(id);

      return reply.send({
        success: true,
        data: result,
        error: null,
      });
    } catch (err: any) {
      const status = err.statusCode || 500;
      return reply.code(status).send({
        success: false,
        data: null,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message || 'Errore nell\'eliminazione del cliente.',
        },
      });
    }
  }

  /**
   * GET /api/v1/trainer/clients
   * Recupero clienti gestiti dal trainer.
   */
  async getClients(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = await trainerService.getClients();
      return reply.send({
        success: true,
        data,
        error: null,
      });
    } catch (err: any) {
      const status = err.statusCode || 500;
      return reply.code(status).send({
        success: false,
        data: null,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message || 'Errore nel recupero della lista clienti.',
        },
      });
    }
  }
}

export const trainerController = new TrainerController();
