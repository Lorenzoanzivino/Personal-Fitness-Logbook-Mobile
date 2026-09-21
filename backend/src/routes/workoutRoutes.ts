import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db';
import {
  workoutSessions,
  workoutSessionExercises,
  workoutSessionSets,
  exercises,
} from '../db/schema';
import { eq, desc, asc } from 'drizzle-orm';
import { Workout, WorkoutExercise, ExerciseSet } from '../types/workout';

export async function workoutRoutes(fastify: FastifyInstance) {
  // -------------------------------------------------------------------
  // 1. GET WORKOUTS (DECOUPLED LOGS - FILTRATI PER ATLETA)
  // -------------------------------------------------------------------
  fastify.get('/api/v1/workouts', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { owner_id?: string };
    const ownerId = query.owner_id;

    const sessionsQuery = ownerId
      ? db.select().from(workoutSessions).where(eq(workoutSessions.ownerId, ownerId)).orderBy(desc(workoutSessions.date))
      : db.select().from(workoutSessions).orderBy(desc(workoutSessions.date));

    const sessionList = await sessionsQuery;
    const result: Workout[] = [];

    for (const s of sessionList) {
      const sExList = await db
        .select()
        .from(workoutSessionExercises)
        .where(eq(workoutSessionExercises.workoutSessionId, s.id))
        .orderBy(asc(workoutSessionExercises.exerciseOrder));

      const structuredExercises: WorkoutExercise[] = [];

      for (const sx of sExList) {
        // Ripristino metadata esercizio salvaguardato da snapshot immutabile
        let catalogEx: any = undefined;
        if (sx.exerciseId) {
          const exRows = await db.select().from(exercises).where(eq(exercises.id, sx.exerciseId));
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

        // Se l'esercizio master fosse stato cancellato dal catalogo, usiamo lo snapshot congelato!
        if (!catalogEx) {
          catalogEx = {
            id: sx.exerciseId || 0,
            name: sx.exerciseNameSnapshot,
            muscle_group: sx.muscleGroupSnapshot as any,
            exercise_type: 'reps' as any,
            is_archived: 0,
            created_at: s.createdAt.toISOString(),
          };
        }

        const setRows = await db
          .select()
          .from(workoutSessionSets)
          .where(eq(workoutSessionSets.sessionExerciseId, sx.id))
          .orderBy(asc(workoutSessionSets.setNumber));

        const structuredSets: ExerciseSet[] = setRows.map((set) => ({
          id: set.id,
          workout_exercise_id: sx.id,
          set_number: set.setNumber,
          set_type: set.setType as any,
          weight_kg: Number(set.weightKg),
          reps: set.reps,
          time_seconds: set.timeSeconds || undefined,
          band_assistance: set.bandAssistance as any,
          dropset_weight_kg: set.dropsetWeightKg ? Number(set.dropsetWeightKg) : undefined,
          drops: set.drops || [],
          rest_seconds: set.restSeconds || undefined,
          rpe: set.rpe ? Number(set.rpe) : undefined,
          completed: set.completed,
          notes: set.notes || undefined,
        }));

        structuredExercises.push({
          id: sx.id,
          workout_id: s.id,
          exercise_id: sx.exerciseId || 0,
          exercise_order: sx.exerciseOrder,
          superset_group: sx.supersetGroup || undefined,
          notes: sx.notes || undefined,
          exercise: catalogEx,
          sets: structuredSets,
        });
      }

      result.push({
        id: s.id,
        date: s.date,
        name: s.routineNameSnapshot, // Garanzia di fedeltà storica del nome
        duration_minutes: s.durationMinutes || undefined,
        workout_type: s.workoutType || undefined,
        notes: s.notes || undefined,
        routine_id: s.routineId || undefined,
        week_number: s.weekNumber || undefined,
        created_at: s.createdAt.toISOString(),
        updated_at: s.updatedAt.toISOString(),
        owner_id: s.ownerId,
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
  // 2. SAVE WORKOUT SESSION (DECOUPLED SNAPSHOT - ZERO LOSS)
  // -------------------------------------------------------------------
  fastify.post('/api/v1/workouts', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Omit<Workout, 'id' | 'created_at' | 'updated_at'>;

    if (!body.name || !body.date) {
      return reply.code(400).send({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Data e nome allenamento obbligatori.' },
      });
    }

    const ownerId = body.owner_id || 'trainer-1';

    // Inserisci sessione con snapshot congelato del nome della scheda
    const insertedSessions = await db
      .insert(workoutSessions)
      .values({
        ownerId,
        routineId: body.routine_id || null,
        routineNameSnapshot: body.name,
        date: body.date,
        durationMinutes: body.duration_minutes || null,
        workoutType: body.workout_type || null,
        weekNumber: body.week_number || null,
        notes: body.notes || null,
      })
      .returning();

    const createdSession = insertedSessions[0];
    const createdExercises: WorkoutExercise[] = [];

    if (body.exercises && body.exercises.length > 0) {
      for (const ex of body.exercises) {
        const exName = ex.exercise?.name || 'Esercizio';
        const exMuscle = ex.exercise?.muscle_group || 'Petto';

        const insertedEx = await db
          .insert(workoutSessionExercises)
          .values({
            workoutSessionId: createdSession.id,
            exerciseId: ex.exercise_id || null,
            exerciseNameSnapshot: exName,
            muscleGroupSnapshot: exMuscle,
            exerciseOrder: ex.exercise_order || 1,
            supersetGroup: ex.superset_group || null,
            notes: ex.notes || null,
          })
          .returning();

        const curEx = insertedEx[0];
        const createdSets: ExerciseSet[] = [];

        if (ex.sets && ex.sets.length > 0) {
          for (const s of ex.sets) {
            const insertedSet = await db
              .insert(workoutSessionSets)
              .values({
                sessionExerciseId: curEx.id,
                setNumber: s.set_number,
                setType: s.set_type || 'normal',
                weightKg: String(s.weight_kg || 0),
                reps: s.reps || 0,
                timeSeconds: s.time_seconds || null,
                bandAssistance: s.band_assistance || 'none',
                dropsetWeightKg: s.dropset_weight_kg ? String(s.dropset_weight_kg) : null,
                drops: s.drops || [],
                restSeconds: s.rest_seconds || null,
                rpe: s.rpe ? String(s.rpe) : null,
                completed: s.completed ?? true,
                notes: s.notes || null,
              })
              .returning();

            createdSets.push({
              id: insertedSet[0].id,
              workout_exercise_id: curEx.id,
              set_number: insertedSet[0].setNumber,
              set_type: insertedSet[0].setType as any,
              weight_kg: Number(insertedSet[0].weightKg),
              reps: insertedSet[0].reps,
              time_seconds: insertedSet[0].timeSeconds || undefined,
              band_assistance: insertedSet[0].bandAssistance as any,
              dropset_weight_kg: insertedSet[0].dropsetWeightKg ? Number(insertedSet[0].dropsetWeightKg) : undefined,
              drops: insertedSet[0].drops || [],
              rest_seconds: insertedSet[0].restSeconds || undefined,
              rpe: insertedSet[0].rpe ? Number(insertedSet[0].rpe) : undefined,
              completed: insertedSet[0].completed,
              notes: insertedSet[0].notes || undefined,
            });
          }
        }

        createdExercises.push({
          id: curEx.id,
          workout_id: createdSession.id,
          exercise_id: curEx.exerciseId || 0,
          exercise_order: curEx.exerciseOrder,
          superset_group: curEx.supersetGroup || undefined,
          notes: curEx.notes || undefined,
          exercise: ex.exercise,
          sets: createdSets,
        });
      }
    }

    const fullWorkout: Workout = {
      id: createdSession.id,
      date: createdSession.date,
      name: createdSession.routineNameSnapshot,
      duration_minutes: createdSession.durationMinutes || undefined,
      workout_type: createdSession.workoutType || undefined,
      notes: createdSession.notes || undefined,
      routine_id: createdSession.routineId || undefined,
      week_number: createdSession.weekNumber || undefined,
      created_at: createdSession.createdAt.toISOString(),
      updated_at: createdSession.updatedAt.toISOString(),
      owner_id: createdSession.ownerId,
      exercises: createdExercises,
    };

    return reply.status(201).send({
      success: true,
      data: fullWorkout,
      error: null,
    });
  });

  // -------------------------------------------------------------------
  // 3. DELETE WORKOUT SESSION
  // -------------------------------------------------------------------
  fastify.delete('/api/v1/workouts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);

    if (isNaN(numId)) {
      return reply.code(400).send({
        success: false,
        data: null,
        error: { code: 'INVALID_ID', message: 'ID sessione non valido.' },
      });
    }

    await db.delete(workoutSessions).where(eq(workoutSessions.id, numId));

    return reply.send({
      success: true,
      data: { id: numId, deleted: true },
      error: null,
    });
  });
}
