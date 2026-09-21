import { FastifyInstance } from 'fastify';
import { workoutController } from '../controllers/workoutController';

export async function workoutRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/v1/workouts',
    { preHandler: [fastify.authenticate] },
    workoutController.getWorkouts
  );

  fastify.post(
    '/api/v1/workouts',
    { preHandler: [fastify.authenticate] },
    workoutController.createWorkout
  );

  fastify.delete(
    '/api/v1/workouts/:id',
    { preHandler: [fastify.authenticate] },
    workoutController.deleteWorkout
  );
}
