import {
  pgTable,
  serial,
  bigserial,
  varchar,
  text,
  timestamp,
  date,
  numeric,
  integer,
  boolean,
  smallint,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { SetDropStep } from '../types/workout';

// =====================================================================
// UTENTI & AUTENTICAZIONE (RBAC)
// =====================================================================
export const users = pgTable('users', {
  id: varchar('id', { length: 64 }).primaryKey(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  role: varchar('role', { length: 20 }).notNull(), // 'TRAINER' | 'CLIENT'
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  birthDate: varchar('birth_date', { length: 20 }),
  heightCm: numeric('height_cm', { precision: 5, scale: 2 }),
  avatarUrl: text('avatar_url'),
  email: varchar('email', { length: 255 }),
  isProfileCompleted: boolean('is_profile_completed').default(false),
  rawOtp: varchar('raw_otp', { length: 20 }),
  notes: text('notes'),
  trainerId: varchar('trainer_id', { length: 64 }),
  trainerName: varchar('trainer_name', { length: 150 }),
  isArchived: boolean('is_archived').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const otps = pgTable('otps', {
  code: varchar('code', { length: 16 }).primaryKey(),
  trainerId: varchar('trainer_id', { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  trainerName: varchar('trainer_name', { length: 150 }).notNull(),
  clientId: varchar('client_id', { length: 64 }).references(() => users.id, {
    onDelete: 'set null',
  }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// =====================================================================
// CATALOGO ESERCIZI BASE
// =====================================================================
export const exercises = pgTable('exercises', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 150 }).notNull(),
  muscleGroup: varchar('muscle_group', { length: 50 }).notNull(),
  exerciseType: varchar('exercise_type', { length: 20 }).notNull(), // 'reps' | 'time' | 'bodyweight'
  description: text('description'),
  videoUrl: text('video_url'),
  isArchived: smallint('is_archived').default(0).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// =====================================================================
// TEMPLATE MASTER SCHEDE (WORKOUT ROUTINES - GESTITE DAL TRAINER)
// =====================================================================
export const routineFolders = pgTable('routine_folders', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  ownerId: varchar('owner_id', { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const workoutRoutines = pgTable('workout_routines', {
  id: serial('id').primaryKey(),
  folderId: varchar('folder_id', { length: 64 }).references(() => routineFolders.id, {
    onDelete: 'set null',
  }),
  folderName: varchar('folder_name', { length: 100 }),
  borderColor: varchar('border_color', { length: 30 }).default('#3B82F6'),
  name: varchar('name', { length: 150 }).notNull(),
  description: text('description'),
  workoutType: varchar('workout_type', { length: 50 }),
  durationWeeks: integer('duration_weeks').default(4).notNull(),
  ownerId: varchar('owner_id', { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const routineExercises = pgTable('routine_exercises', {
  id: serial('id').primaryKey(),
  routineId: integer('routine_id')
    .notNull()
    .references(() => workoutRoutines.id, { onDelete: 'cascade' }),
  exerciseId: integer('exercise_id').references(() => exercises.id, {
    onDelete: 'set null',
  }),
  exerciseOrder: integer('exercise_order').default(1).notNull(),
  supersetGroup: varchar('superset_group', { length: 20 }),
  customDescription: text('custom_description'),
  customVideoUrl: text('custom_video_url'),
  notes: text('notes'),
});

export const routineExerciseSets = pgTable('routine_exercise_sets', {
  id: serial('id').primaryKey(),
  routineExerciseId: integer('routine_exercise_id')
    .notNull()
    .references(() => routineExercises.id, { onDelete: 'cascade' }),
  setNumber: integer('set_number').notNull(),
  setType: varchar('set_type', { length: 30 }).default('normal').notNull(),
  targetWeightKg: numeric('target_weight_kg', { precision: 6, scale: 2 }).default('0').notNull(),
  targetReps: integer('target_reps').default(0).notNull(),
  targetTimeSeconds: integer('target_time_seconds'),
  bandAssistance: varchar('band_assistance', { length: 30 }).default('none'),
  dropsetWeightKg: numeric('dropset_weight_kg', { precision: 6, scale: 2 }),
  drops: jsonb('drops').$type<SetDropStep[]>().default([]),
  restSeconds: integer('rest_seconds').default(90).notNull(),
  notes: text('notes'),
});

// =====================================================================
// LOG STORICI DI ALLENAMENTO (DECOUPLED - IMMUTABILI)
// =====================================================================
export const workoutSessions = pgTable('workout_sessions', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  ownerId: varchar('owner_id', { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // RELAZIONE DEBOLE: Se la routine originaria viene eliminata/modificata dal trainer,
  // la sessione rimane al 100% intatta (routine_id diventa null, ma snapshot preserva il nome).
  routineId: integer('routine_id').references(() => workoutRoutines.id, {
    onDelete: 'set null',
  }),
  routineNameSnapshot: varchar('routine_name_snapshot', { length: 150 }).notNull(),
  date: varchar('date', { length: 20 }).notNull(), // 'YYYY-MM-DD'
  durationMinutes: integer('duration_minutes'),
  workoutType: varchar('workout_type', { length: 50 }),
  weekNumber: integer('week_number'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const workoutSessionExercises = pgTable('workout_session_exercises', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  workoutSessionId: bigserial('workout_session_id', { mode: 'number' })
    .notNull()
    .references(() => workoutSessions.id, { onDelete: 'cascade' }),
  exerciseId: integer('exercise_id').references(() => exercises.id, {
    onDelete: 'set null',
  }),
  // Snapshot immutabile dei dati dell'esercizio
  exerciseNameSnapshot: varchar('exercise_name_snapshot', { length: 150 }).notNull(),
  muscleGroupSnapshot: varchar('muscle_group_snapshot', { length: 50 }).notNull(),
  exerciseOrder: integer('exercise_order').default(1).notNull(),
  supersetGroup: varchar('superset_group', { length: 20 }),
  notes: text('notes'),
});

export const workoutSessionSets = pgTable('workout_session_sets', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  sessionExerciseId: bigserial('session_exercise_id', { mode: 'number' })
    .notNull()
    .references(() => workoutSessionExercises.id, { onDelete: 'cascade' }),
  setNumber: integer('set_number').notNull(),
  setType: varchar('set_type', { length: 30 }).default('normal').notNull(),
  weightKg: numeric('weight_kg', { precision: 6, scale: 2 }).default('0').notNull(),
  reps: integer('reps').default(0).notNull(),
  timeSeconds: integer('time_seconds'),
  bandAssistance: varchar('band_assistance', { length: 30 }).default('none'),
  dropsetWeightKg: numeric('dropset_weight_kg', { precision: 6, scale: 2 }),
  drops: jsonb('drops').$type<SetDropStep[]>().default([]),
  restSeconds: integer('rest_seconds'),
  rpe: numeric('rpe', { precision: 3, scale: 1 }),
  completed: boolean('completed').default(true).notNull(),
  notes: text('notes'),
});

// =====================================================================
// MISURAZIONI CORPOREE & PIANI ALIMENTARI (PDF)
// =====================================================================
export const bodyMeasurements = pgTable('body_measurements', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  ownerId: varchar('owner_id', { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  weightKg: numeric('weight_kg', { precision: 5, scale: 2 }).notNull(),
  weightDeltaKg: numeric('weight_delta_kg', { precision: 5, scale: 2 }),
  bmi: numeric('bmi', { precision: 4, scale: 1 }),
  bodyFatPct: numeric('body_fat_pct', { precision: 4, scale: 1 }),
  muscleMassKg: numeric('muscle_mass_kg', { precision: 5, scale: 2 }),
  leanMassKg: numeric('lean_mass_kg', { precision: 5, scale: 2 }),
  waterPct: numeric('water_pct', { precision: 4, scale: 1 }),
  boneMassKg: numeric('bone_mass_kg', { precision: 4, scale: 2 }),
  visceralFat: numeric('visceral_fat', { precision: 4, scale: 1 }),
  bmrKcal: integer('bmr_kcal'),
  amrKcal: integer('amr_kcal'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const dietPdfs = pgTable('diet_pdfs', {
  id: serial('id').primaryKey(),
  ownerId: varchar('owner_id', { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 150 }).notNull(),
  description: text('description'),
  startDate: varchar('start_date', { length: 20 }).notNull(),
  endDate: varchar('end_date', { length: 20 }),
  isActive: smallint('is_active').default(1).notNull(),
  notes: text('notes'),
  sourceFileName: varchar('source_file_name', { length: 255 }),
  filePath: varchar('file_path', { length: 500 }).notNull(),
  fileSize: integer('file_size'),
  mimeType: varchar('mime_type', { length: 100 }).default('application/pdf'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// =====================================================================
// DRIZZLE RELATIONS (Query Builder Helpers)
// =====================================================================
export const usersRelations = relations(users, ({ many }) => ({
  routines: many(workoutRoutines),
  sessions: many(workoutSessions),
  folders: many(routineFolders),
}));

export const workoutRoutinesRelations = relations(workoutRoutines, ({ one, many }) => ({
  owner: one(users, { fields: [workoutRoutines.ownerId], references: [users.id] }),
  folder: one(routineFolders, { fields: [workoutRoutines.folderId], references: [routineFolders.id] }),
  exercises: many(routineExercises),
}));

export const routineExercisesRelations = relations(routineExercises, ({ one, many }) => ({
  routine: one(workoutRoutines, { fields: [routineExercises.routineId], references: [workoutRoutines.id] }),
  exercise: one(exercises, { fields: [routineExercises.exerciseId], references: [exercises.id] }),
  sets: many(routineExerciseSets),
}));

export const routineExerciseSetsRelations = relations(routineExerciseSets, ({ one }) => ({
  routineExercise: one(routineExercises, {
    fields: [routineExerciseSets.routineExerciseId],
    references: [routineExercises.id],
  }),
}));

export const workoutSessionsRelations = relations(workoutSessions, ({ one, many }) => ({
  owner: one(users, { fields: [workoutSessions.ownerId], references: [users.id] }),
  routine: one(workoutRoutines, { fields: [workoutSessions.routineId], references: [workoutRoutines.id] }),
  exercises: many(workoutSessionExercises),
}));

export const workoutSessionExercisesRelations = relations(workoutSessionExercises, ({ one, many }) => ({
  session: one(workoutSessions, {
    fields: [workoutSessionExercises.workoutSessionId],
    references: [workoutSessions.id],
  }),
  exercise: one(exercises, {
    fields: [workoutSessionExercises.exerciseId],
    references: [exercises.id],
  }),
  sets: many(workoutSessionSets),
}));

export const workoutSessionSetsRelations = relations(workoutSessionSets, ({ one }) => ({
  sessionExercise: one(workoutSessionExercises, {
    fields: [workoutSessionSets.sessionExerciseId],
    references: [workoutSessionExercises.id],
  }),
}));
