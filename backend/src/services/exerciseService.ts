import { db } from '../db';
import { exercises } from '../db/schema';
import { asc } from 'drizzle-orm';
import { Exercise } from '../types/workout';

export class ExerciseService {
  /**
   * Recupera il catalogo esercizi dal database.
   * Accesso consentito esclusivamente al TRAINER.
   */
  async getExercises(): Promise<Exercise[]> {
    const rows = await db.select().from(exercises).orderBy(asc(exercises.id));

    return rows.map((e) => ({
      id: e.id,
      name: e.name,
      muscle_group: e.muscleGroup as any,
      exercise_type: e.exerciseType as any,
      description: e.description,
      video_url: e.videoUrl,
      is_archived: e.isArchived,
      notes: e.notes,
      created_at: e.createdAt.toISOString(),
    }));
  }
}

export const exerciseService = new ExerciseService();
