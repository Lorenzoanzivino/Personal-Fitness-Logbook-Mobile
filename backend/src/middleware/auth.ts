import { FastifyRequest, FastifyReply } from 'fastify';

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: 'TRAINER' | 'CLIENT';
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireTrainer: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthenticatedUser;
    user: AuthenticatedUser;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({
      success: false,
      data: null,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Token di autenticazione mancante o non valido.',
      },
    });
  }
}

export async function requireTrainer(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await authenticate(request, reply);
  if (reply.sent) return;

  if (request.user.role !== 'TRAINER') {
    reply.status(403).send({
      success: false,
      data: null,
      error: {
        code: 'FORBIDDEN',
        message: 'Azione consentita esclusivamente al Personal Trainer.',
      },
    });
  }
}
