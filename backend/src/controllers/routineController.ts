import { FastifyRequest, FastifyReply } from 'fastify';
import { routineService } from '../services/routineService';
import { WorkoutRoutine } from '../types/workout';

function validateRoutineDto(body: any, isUpdate = false) {
  if (!body || typeof body !== 'object') {
    throw { statusCode: 400, code: 'INVALID_PAYLOAD', message: 'Il payload della richiesta deve essere un oggetto valido.' };
  }
  if (!isUpdate || body.name !== undefined) {
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      throw { statusCode: 400, code: 'INVALID_NAME', message: 'Il nome della scheda è obbligatorio.' };
    }
  }
  if (body.client_ids !== undefined && !Array.isArray(body.client_ids)) {
    throw { statusCode: 400, code: 'INVALID_CLIENT_IDS', message: 'client_ids deve essere un array.' };
  }
  if (body.clientIds !== undefined && !Array.isArray(body.clientIds)) {
    throw { statusCode: 400, code: 'INVALID_CLIENT_IDS', message: 'clientIds deve essere un array.' };
  }
  if (body.folder_id !== undefined && body.folder_id !== null && typeof body.folder_id !== 'string' && typeof body.folder_id !== 'number') {
    throw { statusCode: 400, code: 'INVALID_FOLDER_ID', message: 'folder_id deve essere una stringa o null.' };
  }
  if (body.folderId !== undefined && body.folderId !== null && typeof body.folderId !== 'string' && typeof body.folderId !== 'number') {
    throw { statusCode: 400, code: 'INVALID_FOLDER_ID', message: 'folderId deve essere una stringa o null.' };
  }
  if (body.blocks !== undefined) {
    if (!Array.isArray(body.blocks)) {
      throw { statusCode: 400, code: 'INVALID_BLOCKS', message: 'I blocchi devono essere forniti come array.' };
    }
    const validBlockTypes = [
      'SINGLE',
      'SUPERSERIE',
      'CIRCUIT_STANDARD',
      'CIRCUIT_INTERVAL',
      'STANDARD',
      'SUPERSET',
      'CIRCUIT',
    ];
    for (let i = 0; i < body.blocks.length; i++) {
      const blk = body.blocks[i];
      if (!blk || typeof blk !== 'object') {
        throw { statusCode: 400, code: 'INVALID_BLOCK', message: `Il blocco alla posizione ${i + 1} non è valido.` };
      }
      if (!validBlockTypes.includes(blk.block_type)) {
        throw {
          statusCode: 400,
          code: 'INVALID_BLOCK_TYPE',
          message: `Tipo di blocco non valido alla posizione ${i + 1}: ${blk.block_type}. Validi: SINGLE, SUPERSERIE, CIRCUIT_STANDARD, CIRCUIT_INTERVAL.`,
        };
      }
      if (blk.rounds !== undefined && (typeof blk.rounds !== 'number' || blk.rounds < 1)) {
        throw {
          statusCode: 400,
          code: 'INVALID_ROUNDS',
          message: `Il numero di round per il blocco ${i + 1} deve essere un numero intero >= 1.`,
        };
      }
      if (blk.rest_between_rounds !== undefined && (typeof blk.rest_between_rounds !== 'number' || blk.rest_between_rounds < 0)) {
        throw {
          statusCode: 400,
          code: 'INVALID_REST_BETWEEN_ROUNDS',
          message: `Il recupero tra round per il blocco ${i + 1} deve essere >= 0 secondi.`,
        };
      }
      if (blk.exercises !== undefined && !Array.isArray(blk.exercises)) {
        throw {
          statusCode: 400,
          code: 'INVALID_BLOCK_EXERCISES',
          message: `Gli esercizi nel blocco ${i + 1} devono essere un array.`,
        };
      }
    }
  }
}

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
      validateRoutineDto(body, false);
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

  async updateRoutine(request: FastifyRequest, reply: FastifyReply) {
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

      const body = request.body as Partial<WorkoutRoutine>;
      validateRoutineDto(body, true);
      const data = await routineService.updateRoutine(request.user, numId, body);
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
