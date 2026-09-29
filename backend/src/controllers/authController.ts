import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../services/authService';
import { LoginCredentials, AuthSession } from '../types/auth';

export class AuthController {
  /**
   * POST /api/v1/auth/login
   * Smart Login unificato: riceve { identifier, secret }
   * e si adatta automaticamente a Trainer o Cliente (con OTP o Password).
   */
  async login(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as LoginCredentials;
      const identifier = body.identifier || body.username || '';
      const secret = body.secret || body.passwordOrOtp || '';

      const user = await authService.login({ identifier, secret });

      // Generazione token JWT
      const token = (request.server as any).jwt.sign({
        id: user.id,
        username: user.username,
        role: user.role,
      });

      return reply.send({
        success: true,
        data: {
          token,
          user,
        },
        error: null,
      });
    } catch (err: any) {
      const status = err.statusCode || 500;
      return reply.code(status).send({
        success: false,
        data: null,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message || 'Errore durante l\'accesso.',
        },
      });
    }
  }
}

export const authController = new AuthController();
