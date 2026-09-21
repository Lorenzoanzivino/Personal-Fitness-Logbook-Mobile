import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db';
import {
  workoutRoutines,
  routineExercises,
  routineExerciseSets,
  exercises,
} from '../db/schema';
import { eq, desc, asc } from 'drizzle-orm';
import { WorkoutRoutine, RoutineExercise, RoutineExerciseSet } from '../types/workout';

export async function routineRoutes(fastify: FastifyInstance) {
  // -------------------------------------------------------------------
  // 1. GET ALL ROUTINES (OPZIONALMENTE FILTRATE PER OWNER_ID)
  // -------------------------------------------------------------------
  fastify.get('/api/v1/routines', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { owner_id?: string };
    const ownerId = query.owner_id;

    // Recupera schede
    const routinesQuery = ownerId
      ? db.select().from(workoutRoutines).where(eq(workoutRoutines.ownerId, ownerId)).orderBy(desc(workoutRoutines.createdAt))
      : db.select().from(workoutRoutines).orderBy(desc(workoutRoutines.createdAt));

    const routineList = await routinesQuery;

    // Per ogni scheda, recupera gli esercizi e le serie
    const result: WorkoutRoutine[] = [];

    for (const r of routineList) {
      const rExList = await db
        .select()
        .from(routineExercises)
        .where(eq(routineExercises.routineId, r.id))
        .orderBy(asc(routineExercises.exerciseOrder));

      const structuredExercises: RoutineExercise[] = [];

      for (const rx of rExList) {
        // Esercizio catalogo se presente
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

    return reply.send({
      success: true,
      data: result,
      error: null,
    });
  });

  // -------------------------------------------------------------------
  // 2. CREATE NEW ROUTINE (CON ESERCIZI E SERIE NESTED)
  // -------------------------------------------------------------------
  fastify.post('/api/v1/routines', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Omit<WorkoutRoutine, 'id' | 'created_at' | 'updated_at'>;

    if (!body.name) {
      return reply.code(400).send({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Nome scheda obbligatorio.' },
      });
    }

    const ownerId = body.owner_id || 'trainer-1';

    // Inserimento master routine
    const insertedRoutines = await db
      .insert(workoutRoutines)
      .values({
        folderId: body.folder_id || null,
        folderName: body.folder_name || null,
        borderColor: body.border_color || '#3B82F6',
        name: body.name,
        description: body.description || null,
        workoutType: body.workout_type || null,
        durationWeeks: body.duration_weeks || 4,
        ownerId,
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

    const fullRoutine: WorkoutRoutine = {
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

    return reply.status(201).send({
      success: true,
      data: fullRoutine,
      error: null,
    });
  });

  // -------------------------------------------------------------------
  // 3. DELETE ROUTINE (DECOUPLED - NON INTACCA MAI LE SESSIONI DEGLI ATLETI)
  // -------------------------------------------------------------------
  fastify.delete('/api/v1/routines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);

    if (isNaN(numId)) {
      return reply.code(400).send({
        success: false,
        data: null,
        error: { code: 'INVALID_ID', message: 'ID scheda non valido.' },
      });
    }

    await db.delete(workoutRoutines).where(eq(workoutRoutines.id, numId));

    return reply.send({
      success: true,
      data: { id: numId, deleted: true },
      error: null,
    });
  });
}
