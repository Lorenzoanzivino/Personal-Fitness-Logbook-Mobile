import { FastifyInstance } from 'fastify';
import { client } from '../db';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (request, reply) => {
    let dbStatus = 'disconnected';
    try {
      const result = await client`SELECT 1 as connected`;
      if (result && result.length > 0) {
        dbStatus = 'connected';
      }
    } catch (e) {
      dbStatus = 'error';
    }

    return reply.send({
      status: 'ok',
      uptime: process.uptime(),
      db: dbStatus,
      timestamp: new Date().toISOString(),
      memoryUsage: process.memoryUsage(),
    });
  });
}
