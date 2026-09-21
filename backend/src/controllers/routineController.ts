import { FastifyRequest, FastifyReply } from 'fastify';
import { routineService } from '../services/routineService';
import { WorkoutRoutine } from '../types/workout';

export class RoutineController {
  async getRoutines(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as { owner_id?: string };
      const data = await routineService.getRoutines(request.user, query.owner_id);
      return reply.send({ success: true, data, error: null });
    } catch (err: any) {
      const status = err.statusCode || 500;
      return reply.code(status).send({
        success: false,
        data: null,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
      });
    }
  }

  async createRoutine(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as Omit<WorkoutRoutine, 'id' | 'created_at' | 'updated_at'>;
      const data = await routineService.createRoutine(request.user, body);
      return reply.code(201).send({ success: true, data, error: null });
    } catch (err: any) {
      const status = err.statusCode || 500;
      return reply.code(status).send({
        success: false,
        data: null,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
      });
    }
  }

  async deleteRoutine(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const numId = parseInt(id, 10);
      if (isNaN(numId)) {
        return reply.code(400).send({
          success: false,
          data: null,
          error: { code: 'INVALID_ID', message: 'ID scheda non valido.' },
        });
      }

      const data = await routineService.deleteRoutine(request.user, numId);
      return reply.send({ success: true, data, error: null });
    } catch (err: any) {
      const status = err.statusCode || 500;
      return reply.code(status).send({
        success: false,
        data: null,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
      });
    }
  }
}

export const routineController = new RoutineController();
