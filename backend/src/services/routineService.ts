import { db } from '../db';
import {
  workoutRoutines,
  routineExercises,
  routineExerciseSets,
  exercises,
  users,
} from '../db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { WorkoutRoutine, RoutineExercise, RoutineExerciseSet } from '../types/workout';
import { AuthenticatedUser } from '../middleware/auth';

export class RoutineService {
  async getRoutines(
    authUser: AuthenticatedUser,
    targetOwnerId?: string
  ): Promise<WorkoutRoutine[]> {
    let effectiveOwnerId = authUser.id;

    if (authUser.role === 'CLIENT') {
      // Il cliente vede tassativamente solo le schede assegnate al proprio ID
      effectiveOwnerId = authUser.id;
    } else if (authUser.role === 'TRAINER' && targetOwnerId && targetOwnerId !== authUser.id) {
      // Il trainer può visualizzare le schede dell'allieva se è associata a lui
      const clientRows = await db
        .select()
        .from(users)
        .where(and(eq(users.id, targetOwnerId), eq(users.trainerId, authUser.id)));

      if (clientRows.length === 0) {
        throw {
          statusCode: 403,
          code: 'FORBIDDEN_CLIENT_ACCESS',
          message: 'Non sei autorizzato a visualizzare le schede di questa atleta.',
        };
      }
      effectiveOwnerId = targetOwnerId;
    }

    const routineList = await db
      .select()
      .from(workoutRoutines)
      .where(eq(workoutRoutines.ownerId, effectiveOwnerId))
      .orderBy(desc(workoutRoutines.createdAt));

    const result: WorkoutRoutine[] = [];

    for (const r of routineList) {
      const rExList = await db
        .select()
        .from(routineExercises)
        .where(eq(routineExercises.routineId, r.id))
        .orderBy(asc(routineExercises.exerciseOrder));

      const structuredExercises: RoutineExercise[] = [];

      for (const rx of rExList) {
        let catalogEx: any = undefined;
        if (rx.exerciseId) {
          const exRows = await db.select().from(exercises).where(eq(exercises.id, rx.exerciseId));
          if (exRows.length > 0) {
            catalogEx = {
              id: exRows[0].id,
              name: exRows[0].name,
              muscle_group: exRows[0].muscleGroup as any,
              exercise_type: exRows[0].exerciseType as any,
              description: exRows[0].description,
              video_url: exRows[0].videoUrl,
              is_archived: exRows[0].isArchived,
              notes: exRows[0].notes,
              created_at: exRows[0].createdAt.toISOString(),
            };
          }
        }

        const setRows = await db
          .select()
          .from(routineExerciseSets)
          .where(eq(routineExerciseSets.routineExerciseId, rx.id))
          .orderBy(asc(routineExerciseSets.setNumber));

        const structuredSets: RoutineExerciseSet[] = setRows.map((s) => ({
          id: s.id,
          routine_exercise_id: s.routineExerciseId,
          set_number: s.setNumber,
          set_type: s.setType as any,
          target_weight_kg: Number(s.targetWeightKg),
          target_reps: s.targetReps,
          target_time_seconds: s.targetTimeSeconds || undefined,
          band_assistance: (s.bandAssistance as any) || 'none',
          dropset_weight_kg: s.dropsetWeightKg ? Number(s.dropsetWeightKg) : undefined,
          drops: s.drops || [],
          rest_seconds: s.restSeconds,
          notes: s.notes || undefined,
        }));

        structuredExercises.push({
          id: rx.id,
          routine_id: rx.routineId,
          exercise_id: rx.exerciseId || 0,
          exercise_order: rx.exerciseOrder,
          superset_group: rx.supersetGroup || undefined,
          custom_description: rx.customDescription || undefined,
          custom_video_url: rx.customVideoUrl || undefined,
          notes: rx.notes || undefined,
          exercise: catalogEx,
          sets: structuredSets,
        });
      }

      result.push({
        id: r.id,
        folder_id: r.folderId || undefined,
        folder_name: r.folderName || undefined,
        border_color: r.borderColor || undefined,
        name: r.name,
        description: r.description || undefined,
        workout_type: r.workoutType || undefined,
        duration_weeks: r.durationWeeks,
        created_at: r.createdAt.toISOString(),
        updated_at: r.updatedAt.toISOString(),
        owner_id: r.ownerId,
        exercises: structuredExercises,
      });
    }

    return result;
  }

  async createRoutine(
    authUser: AuthenticatedUser,
    body: Omit<WorkoutRoutine, 'id' | 'created_at' | 'updated_at'>
  ): Promise<WorkoutRoutine> {
    if (authUser.role !== 'TRAINER') {
      throw {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Solo il Personal Trainer è autorizzato a creare schede mesociclo.',
      };
    }

    if (!body.name) {
      throw {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Nome scheda obbligatorio.',
      };
    }

    let targetOwnerId = authUser.id;
    if (body.owner_id && body.owner_id !== authUser.id) {
      // Verifica che il target sia un'allieva di questo trainer
      const clientRows = await db
        .select()
        .from(users)
        .where(and(eq(users.id, body.owner_id), eq(users.trainerId, authUser.id)));

      if (clientRows.length === 0) {
        throw {
          statusCode: 403,
          code: 'FORBIDDEN_CLIENT_ACCESS',
          message: 'Non puoi assegnare schede ad atlete non collegate al tuo account.',
        };
      }
      targetOwnerId = body.owner_id;
    }

    const insertedRoutines = await db
      .insert(workoutRoutines)
      .values({
        folderId: body.folder_id || null,
        folderName: body.folder_name || null,
        borderColor: body.border_color || '#3B82F6',
        name: body.name.trim(),
        description: body.description || null,
        workoutType: body.workout_type || null,
        durationWeeks: body.duration_weeks || 4,
        ownerId: targetOwnerId,
      })
      .returning();

    const createdRoutine = insertedRoutines[0];
    const createdExercises: RoutineExercise[] = [];

    if (body.exercises && body.exercises.length > 0) {
      for (const ex of body.exercises) {
        const insertedEx = await db
          .insert(routineExercises)
          .values({
            routineId: createdRoutine.id,
            exerciseId: ex.exercise_id || null,
            exerciseOrder: ex.exercise_order || 1,
            supersetGroup: ex.superset_group || null,
            customDescription: ex.custom_description || null,
            customVideoUrl: ex.custom_video_url || null,
            notes: ex.notes || null,
          })
          .returning();

        const curEx = insertedEx[0];
        const createdSets: RoutineExerciseSet[] = [];

        if (ex.sets && ex.sets.length > 0) {
          for (const s of ex.sets) {
            const insertedSet = await db
              .insert(routineExerciseSets)
              .values({
                routineExerciseId: curEx.id,
                setNumber: s.set_number,
                setType: s.set_type || 'normal',
                targetWeightKg: String(s.target_weight_kg || 0),
                targetReps: s.target_reps || 0,
                targetTimeSeconds: s.target_time_seconds || null,
                bandAssistance: s.band_assistance || 'none',
                dropsetWeightKg: s.dropset_weight_kg ? String(s.dropset_weight_kg) : null,
                drops: s.drops || [],
                restSeconds: s.rest_seconds || 90,
                notes: s.notes || null,
              })
              .returning();

            createdSets.push({
              id: insertedSet[0].id,
              routine_exercise_id: curEx.id,
              set_number: insertedSet[0].setNumber,
              set_type: insertedSet[0].setType as any,
              target_weight_kg: Number(insertedSet[0].targetWeightKg),
              target_reps: insertedSet[0].targetReps,
              target_time_seconds: insertedSet[0].targetTimeSeconds || undefined,
              band_assistance: insertedSet[0].bandAssistance as any,
              dropset_weight_kg: insertedSet[0].dropsetWeightKg ? Number(insertedSet[0].dropsetWeightKg) : undefined,
              drops: insertedSet[0].drops || [],
              rest_seconds: insertedSet[0].restSeconds,
              notes: insertedSet[0].notes || undefined,
            });
          }
        }

        createdExercises.push({
          id: curEx.id,
          routine_id: createdRoutine.id,
          exercise_id: curEx.exerciseId || 0,
          exercise_order: curEx.exerciseOrder,
          superset_group: curEx.supersetGroup || undefined,
          custom_description: curEx.customDescription || undefined,
          custom_video_url: curEx.customVideoUrl || undefined,
          notes: curEx.notes || undefined,
          sets: createdSets,
        });
      }
    }

    return {
      id: createdRoutine.id,
      folder_id: createdRoutine.folderId || undefined,
      folder_name: createdRoutine.folderName || undefined,
      border_color: createdRoutine.borderColor || undefined,
      name: createdRoutine.name,
      description: createdRoutine.description || undefined,
      workout_type: createdRoutine.workoutType || undefined,
      duration_weeks: createdRoutine.durationWeeks,
      created_at: createdRoutine.createdAt.toISOString(),
      updated_at: createdRoutine.updatedAt.toISOString(),
      owner_id: createdRoutine.ownerId,
      exercises: createdExercises,
    };
  }

  async deleteRoutine(
    authUser: AuthenticatedUser,
    id: number
  ): Promise<{ id: number; deleted: boolean }> {
    if (authUser.role !== 'TRAINER') {
      throw {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Solo il Personal Trainer può eliminare schede mesociclo.',
      };
    }

    // Il trainer può eliminare le proprie schede o quelle assegnate alle proprie allieve
    const routineRows = await db
      .select()
      .from(workoutRoutines)
      .where(eq(workoutRoutines.id, id));

    if (routineRows.length === 0) {
      throw {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Scheda non trovata.',
      };
    }

    const r = routineRows[0];
    if (r.ownerId !== authUser.id) {
      // Verifica che appartenga a una sua allieva
      const clientRows = await db
        .select()
        .from(users)
        .where(and(eq(users.id, r.ownerId), eq(users.trainerId, authUser.id)));

      if (clientRows.length === 0) {
        throw {
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Non sei autorizzato a eliminare questa scheda.',
        };
      }
    }

    await db.delete(workoutRoutines).where(eq(workoutRoutines.id, id));
    return { id, deleted: true };
  }
}

export const routineService = new RoutineService();
