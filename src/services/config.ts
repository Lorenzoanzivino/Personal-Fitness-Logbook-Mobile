/**
 * Configurazione centralizzata dei parametri di rete e runtime.
 * Le variabili sono lette dall'ambiente Expo (prefisso EXPO_PUBLIC_).
 */
export const API_CONFIG = {
  // In development, defaults to localhost:8000 (Fastify server) if not configured
  baseUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000',
  timeoutMs: 15000,
  apiVersion: 'v1',
};

/**
 * Credenziali e dati anagrafici del Trainer Master.
 * Lette in modo protetto dalle variabili d'ambiente (.env).
 */
export const TRAINER_CONFIG = {
  username: process.env.EXPO_PUBLIC_TRAINER_USERNAME || 'Lorenzo',
  password: process.env.EXPO_PUBLIC_TRAINER_PASSWORD || 'admin123',
  firstName: process.env.EXPO_PUBLIC_TRAINER_FIRST_NAME || 'Lorenzo',
  lastName: process.env.EXPO_PUBLIC_TRAINER_LAST_NAME || 'Anzivino',
  email: process.env.EXPO_PUBLIC_TRAINER_EMAIL || 'lorenzo.anzivino@example.com',
};

export const getApiEndpoint = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_CONFIG.baseUrl}${cleanPath}`;
};
