import { FastifyRequest, FastifyReply } from 'fastify';
import { clientService } from '../services/clientService';
import { ClientOnboardingDto } from '../types/auth';

export class ClientController {
  /**
   * PUT /api/v1/clients/onboarding
   * Endpoint onboarding obbligatorio: aggiorna profilo e setta is_onboarded = true.
   */
  async completeOnboarding(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.code(401).send({
          success: false,
          data: null,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Sessione utente non valida.',
          },
        });
      }

      const body = request.body as ClientOnboardingDto;
      const data = await clientService.completeOnboarding(userId, body);

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
          message: err.message || 'Errore durante il completamento dell\'onboarding.',
        },
      });
    }
  }
}

export const clientController = new ClientController();
