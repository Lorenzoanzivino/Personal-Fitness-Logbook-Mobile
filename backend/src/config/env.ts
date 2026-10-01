import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// 1. Determina la modalità di esecuzione (default 'development' se non definita)
const nodeEnv = process.env.NODE_ENV || 'development';
process.env.NODE_ENV = nodeEnv;

// 2. Definizione priorità file .env in base all'ambiente
const envFiles =
  nodeEnv === 'production'
    ? ['.env.production.local', '.env.production', '.env.local', '.env']
    : ['.env.development.local', '.env.development', '.env.local', '.env'];

// Cerca nella directory del backend (sia se eseguito da /backend che dalla root del progetto)
const backendDir = path.resolve(__dirname, '../../');
const searchDirs = [backendDir, path.resolve(process.cwd(), 'backend'), process.cwd()];

for (const dir of searchDirs) {
  for (const file of envFiles) {
    const fullPath = path.join(dir, file);
    if (fs.existsSync(fullPath)) {
      dotenv.config({ path: fullPath });
    }
  }
}

// 3. Fallback di default per sviluppo locale
if (!process.env.PORT) {
  process.env.PORT = '8000';
}
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'postgres://fitness_user:fitness_secure_password_here@localhost:5435/fitness_db';
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'super_secret_jwt_key_fitness_logbook_2026';
}

// 4. Stampa diagnostica all'avvio in dev (mascherando password)
if (process.env.NODE_ENV !== 'production') {
  try {
    const parsed = new URL(process.env.DATABASE_URL);
    const masked = `${parsed.protocol}//${parsed.username ? parsed.username + ':***' : ''}@${parsed.host}${parsed.pathname}`;
    console.log(`🔌 [BACKEND ENV] Modalità: ${process.env.NODE_ENV} | Porta: ${process.env.PORT} | DB: ${masked}`);
  } catch {
    console.log(`🔌 [BACKEND ENV] Modalità: ${process.env.NODE_ENV} | Porta: ${process.env.PORT}`);
  }
}
