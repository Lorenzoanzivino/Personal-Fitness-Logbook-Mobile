import { FastifyRequest, FastifyReply } from 'fastify';
import { profileService } from '../services/profileService';
import { UpdateProfileRequestDto } from '../types/profile';

export class ProfileController {
  async getProfile(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as { client_id?: string };
      const data = await profileService.getProfile(request.user, query.client_id);
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

  async updateProfile(request: FastifyRequest, reply: FastifyReply) {
    try {
      const dto = request.body as UpdateProfileRequestDto;
      const data = await profileService.updateProfile(request.user, dto);
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

export const profileController = new ProfileController();
