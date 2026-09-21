import { FastifyRequest, FastifyReply } from 'fastify';
import { workoutService } from '../services/workoutService';
import { Workout } from '../types/workout';

export class WorkoutController {
  async getWorkouts(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as { client_id?: string };
      const data = await workoutService.getWorkouts(request.user, query.client_id);
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

  async createWorkout(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as Omit<Workout, 'id' | 'created_at' | 'updated_at'>;
      const data = await workoutService.createWorkout(request.user, body);
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

  async deleteWorkout(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const numId = parseInt(id, 10);
      if (isNaN(numId)) {
        return reply.code(400).send({
          success: false,
          data: null,
          error: { code: 'INVALID_ID', message: 'ID sessione non valido.' },
        });
      }

      const data = await workoutService.deleteWorkout(request.user, numId);
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

export const workoutController = new WorkoutController();
