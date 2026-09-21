import { FastifyRequest, FastifyReply } from 'fastify';
import { measurementService } from '../services/measurementService';
import { CreateBodyMeasurementDto } from '../types/measurement';

export class MeasurementController {
  async getMeasurements(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as { client_id?: string };
      const data = await measurementService.getMeasurements(request.user, query.client_id);
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

  async createMeasurement(request: FastifyRequest, reply: FastifyReply) {
    try {
      const dto = request.body as CreateBodyMeasurementDto;
      const data = await measurementService.createMeasurement(request.user, dto);
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

  async updateMeasurement(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const numId = parseInt(id, 10);
      if (isNaN(numId)) {
        return reply.code(400).send({
          success: false,
          data: null,
          error: { code: 'INVALID_ID', message: 'ID misurazione non valido.' },
        });
      }

      const dto = request.body as Partial<CreateBodyMeasurementDto>;
      const data = await measurementService.updateMeasurement(request.user, numId, dto);
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

  async deleteMeasurement(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const numId = parseInt(id, 10);
      if (isNaN(numId)) {
        return reply.code(400).send({
          success: false,
          data: null,
          error: { code: 'INVALID_ID', message: 'ID misurazione non valido.' },
        });
      }

      const data = await measurementService.deleteMeasurement(request.user, numId);
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

export const measurementController = new MeasurementController();
