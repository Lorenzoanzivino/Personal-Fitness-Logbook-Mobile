/**
 * Configurazione centralizzata dei parametri di rete e runtime.
 * Le variabili sono lette dall'ambiente Expo (prefisso EXPO_PUBLIC_).
 */
export const API_CONFIG = {
  // In development, defaults to localhost:3001 if not configured
  baseUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001',
  timeoutMs: 15000,
  apiVersion: 'v1',
};

export const getApiEndpoint = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_CONFIG.baseUrl}${cleanPath}`;
};
