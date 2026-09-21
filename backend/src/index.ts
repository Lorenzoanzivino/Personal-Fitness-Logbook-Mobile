import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import * as dotenv from 'dotenv';
import { runMigrationsAndSeed } from './db/migrate';
import { authRoutes } from './routes/authRoutes';
import { routineRoutes } from './routes/routineRoutes';
import { workoutRoutes } from './routes/workoutRoutes';
import { folderRoutes } from './routes/folderRoutes';
import { exerciseRoutes } from './routes/exerciseRoutes';
import { profileRoutes } from './routes/profileRoutes';
import { healthRoutes } from './routes/healthRoutes';

dotenv.config();

const port = parseInt(process.env.PORT || '8000', 10);
const host = '0.0.0.0';

async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
    disableRequestLogging: false,
  });

  // Registrazione CORS per Expo Mobile (LAN, localhost, emulatori)
  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Registrazione JWT
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'fitness_super_secret_jwt_key_2026_change_in_production',
  });

  // Registrazione Moduli Rotte REST
  await fastify.register(healthRoutes);
  await fastify.register(authRoutes);
  await fastify.register(routineRoutes);
  await fastify.register(workoutRoutes);
  await fastify.register(folderRoutes);
  await fastify.register(exerciseRoutes);
  await fastify.register(profileRoutes);

  return fastify;
}

async function start() {
  try {
    // 1. Migrazioni e Seeding automatico dello schema decoupled
    await runMigrationsAndSeed();

    // 2. Avvio Server Fastify
    const app = await buildApp();
    await app.listen({ port, host });
    app.log.info(`🚀 Server Fastify in ascolto su http://${host}:${port}`);
  } catch (err) {
    console.error('❌ Errore fatale avvio server:', err);
    process.exit(1);
  }
}

start();
