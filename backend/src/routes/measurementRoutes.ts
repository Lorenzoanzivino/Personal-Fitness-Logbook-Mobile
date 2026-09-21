import { FastifyInstance } from 'fastify';
import { measurementController } from '../controllers/measurementController';

export async function measurementRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/v1/measurements',
    { preHandler: [fastify.authenticate] },
    measurementController.getMeasurements
  );

  fastify.post(
    '/api/v1/measurements',
    { preHandler: [fastify.authenticate] },
    measurementController.createMeasurement
  );

  fastify.put(
    '/api/v1/measurements/:id',
    { preHandler: [fastify.authenticate] },
    measurementController.updateMeasurement
  );

  fastify.delete(
    '/api/v1/measurements/:id',
    { preHandler: [fastify.authenticate] },
    measurementController.deleteMeasurement
  );
}
