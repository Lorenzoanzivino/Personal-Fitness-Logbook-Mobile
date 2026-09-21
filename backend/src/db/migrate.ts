import { client, db } from './index';
import { users, exercises } from './schema';
import { sql } from 'drizzle-orm';
import { DEFAULT_EXERCISES } from './defaultExercises';

export async function runMigrationsAndSeed() {
  console.log('🔄 [MIGRATE] Verifica e applicazione schema PostgreSQL Decoupled...');

  // DDL: Creazione tabelle se non esistono
  await client.unsafe(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- TABELLA UTENTI
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255),
      role VARCHAR(20) NOT NULL CHECK (role IN ('TRAINER', 'CLIENT')),
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      birth_date VARCHAR(20),
      height_cm NUMERIC(5, 2),
      avatar_url TEXT,
      email VARCHAR(255),
      is_profile_completed BOOLEAN DEFAULT FALSE,
      raw_otp VARCHAR(20),
      notes TEXT,
      trainer_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
      trainer_name VARCHAR(150),
      is_archived BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    -- TABELLA OTPS
    CREATE TABLE IF NOT EXISTS otps (
      code VARCHAR(16) PRIMARY KEY,
      trainer_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      trainer_name VARCHAR(150) NOT NULL,
      client_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    -- CATALOGO ESERCIZI BASE
    CREATE TABLE IF NOT EXISTS exercises (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      muscle_group VARCHAR(50) NOT NULL,
      exercise_type VARCHAR(20) NOT NULL CHECK (exercise_type IN ('reps', 'time', 'bodyweight')),
      description TEXT,
      video_url TEXT,
      is_archived SMALLINT DEFAULT 0 NOT NULL,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    -- CARTELLE SCHEDE
    CREATE TABLE IF NOT EXISTS routine_folders (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    -- TEMPLATE SCHEDE (MASTER ROUTINES - GESTITE DAL TRAINER)
    CREATE TABLE IF NOT EXISTS workout_routines (
      id SERIAL PRIMARY KEY,
      folder_id VARCHAR(64) REFERENCES routine_folders(id) ON DELETE SET NULL,
      folder_name VARCHAR(100),
      border_color VARCHAR(30) DEFAULT '#3B82F6',
      name VARCHAR(150) NOT NULL,
      description TEXT,
      workout_type VARCHAR(50),
      duration_weeks INT DEFAULT 4 NOT NULL,
      owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS routine_exercises (
      id SERIAL PRIMARY KEY,
      routine_id INT NOT NULL REFERENCES workout_routines(id) ON DELETE CASCADE,
      exercise_id INT REFERENCES exercises(id) ON DELETE SET NULL,
      exercise_order INT NOT NULL DEFAULT 1,
      superset_group VARCHAR(20),
      custom_description TEXT,
      custom_video_url TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS routine_exercise_sets (
      id SERIAL PRIMARY KEY,
      routine_exercise_id INT NOT NULL REFERENCES routine_exercises(id) ON DELETE CASCADE,
      set_number INT NOT NULL,
      set_type VARCHAR(30) NOT NULL DEFAULT 'normal',
      target_weight_kg NUMERIC(6, 2) DEFAULT 0 NOT NULL,
      target_reps INT DEFAULT 0 NOT NULL,
      target_time_seconds INT,
      band_assistance VARCHAR(30) DEFAULT 'none',
      dropset_weight_kg NUMERIC(6, 2),
      drops JSONB DEFAULT '[]'::jsonb,
      rest_seconds INT NOT NULL DEFAULT 90,
      notes TEXT
    );

    -- =========================================================
    -- LOG STORICI DI ALLENAMENTO (DECOUPLED - IMMUTABILI)
    -- =========================================================
    CREATE TABLE IF NOT EXISTS workout_sessions (
      id BIGSERIAL PRIMARY KEY,
      owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      routine_id INT REFERENCES workout_routines(id) ON DELETE SET NULL,
      routine_name_snapshot VARCHAR(150) NOT NULL,
      date VARCHAR(20) NOT NULL,
      duration_minutes INT,
      workout_type VARCHAR(50),
      week_number INT,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_workout_sessions_owner_date ON workout_sessions(owner_id, date DESC);

    CREATE TABLE IF NOT EXISTS workout_session_exercises (
      id BIGSERIAL PRIMARY KEY,
      workout_session_id BIGINT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
      exercise_id INT REFERENCES exercises(id) ON DELETE SET NULL,
      exercise_name_snapshot VARCHAR(150) NOT NULL,
      muscle_group_snapshot VARCHAR(50) NOT NULL,
      exercise_order INT NOT NULL DEFAULT 1,
      superset_group VARCHAR(20),
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS workout_session_sets (
      id BIGSERIAL PRIMARY KEY,
      session_exercise_id BIGINT NOT NULL REFERENCES workout_session_exercises(id) ON DELETE CASCADE,
      set_number INT NOT NULL,
      set_type VARCHAR(30) NOT NULL DEFAULT 'normal',
      weight_kg NUMERIC(6, 2) NOT NULL DEFAULT 0,
      reps INT NOT NULL DEFAULT 0,
      time_seconds INT,
      band_assistance VARCHAR(30) DEFAULT 'none',
      dropset_weight_kg NUMERIC(6, 2),
      drops JSONB DEFAULT '[]'::jsonb,
      rest_seconds INT,
      rpe NUMERIC(3, 1),
      completed BOOLEAN DEFAULT TRUE NOT NULL,
      notes TEXT
    );

    -- MISURAZIONI CORPOREE & PIANI ALIMENTARI (PDF)
    CREATE TABLE IF NOT EXISTS body_measurements (
      id BIGSERIAL PRIMARY KEY,
      owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
      weight_kg NUMERIC(5, 2) NOT NULL,
      weight_delta_kg NUMERIC(5, 2),
      bmi NUMERIC(4, 1),
      body_fat_pct NUMERIC(4, 1),
      muscle_mass_kg NUMERIC(5, 2),
      lean_mass_kg NUMERIC(5, 2),
      water_pct NUMERIC(4, 1),
      bone_mass_kg NUMERIC(4, 2),
      visceral_fat NUMERIC(4, 1),
      bmr_kcal INT,
      amr_kcal INT,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS diet_pdfs (
      id SERIAL PRIMARY KEY,
      owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(150) NOT NULL,
      description TEXT,
      start_date VARCHAR(20) NOT NULL,
      end_date VARCHAR(20),
      is_active SMALLINT DEFAULT 1 NOT NULL,
      notes TEXT,
      source_file_name VARCHAR(255),
      file_path VARCHAR(500) NOT NULL,
      file_size INT,
      mime_type VARCHAR(100) DEFAULT 'application/pdf',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `);

  console.log('✅ [MIGRATE] Schema tabelle e indici verificati con successo.');

  // Auto-seed Trainer Master se non esiste
  const defaultTrainerUsername = process.env.TRAINER_USERNAME || 'Lorenzo';
  const existingTrainer = await db
    .select()
    .from(users)
    .where(sql`LOWER(${users.username}) = LOWER(${defaultTrainerUsername})`);

  if (existingTrainer.length === 0) {
    console.log(`🌱 [SEED] Creazione Trainer predefinito: ${defaultTrainerUsername}...`);
    await db.insert(users).values({
      id: 'trainer-1',
      username: defaultTrainerUsername,
      passwordHash: process.env.TRAINER_PASSWORD || 'admin123', // In prod viene usato hash bcrypt o comparazione
      role: 'TRAINER',
      firstName: 'Lorenzo',
      lastName: 'Anzivino',
      birthDate: '01-01-1995',
      heightCm: '180',
      email: 'lorenzo.anzivino@example.com',
      isProfileCompleted: true,
    });
    console.log('✅ [SEED] Trainer predefinito inserito.');
  }

  // Auto-seed Esercizi di default se tabella vuota
  const existingExercises = await db.select({ count: sql<number>`count(*)` }).from(exercises);
  const exerciseCount = Number(existingExercises[0]?.count || 0);

  if (exerciseCount === 0) {
    console.log(`🌱 [SEED] Inserimento dei ${DEFAULT_EXERCISES.length} esercizi base del catalogo...`);
    for (const ex of DEFAULT_EXERCISES) {
      await db.insert(exercises).values({
        name: ex.name,
        muscleGroup: ex.muscle_group,
        exerciseType: ex.exercise_type,
        notes: ex.notes,
        isArchived: 0,
      });
    }
    console.log('✅ [SEED] Catalogo esercizi inizializzato.');
  }
}

// Se invocato direttamente da riga di comando
if (require.main === module) {
  runMigrationsAndSeed()
    .then(() => {
      console.log('🏁 [MIGRATE] Completato con successo.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ [MIGRATE] Errore critico:', err);
      process.exit(1);
    });
}
