import { FastifyRequest, FastifyReply } from 'fastify';
import { exerciseService } from '../services/exerciseService';

export class ExerciseController {
  async getExercises(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = await exerciseService.getExercises();
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
          message: err.message || 'Errore nel recupero degli esercizi.',
        },
      });
    }
  }
}

export const exerciseController = new ExerciseController();
