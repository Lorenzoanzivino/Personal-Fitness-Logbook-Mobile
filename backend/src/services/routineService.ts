import { db } from '../db';
import {
  workoutRoutines,
  routineBlocks,
  routineExercises,
  routineExerciseSets,
  routineFolders,
  exercises,
  users,
} from '../db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import {
  WorkoutRoutine,
  RoutineBlock,
  RoutineBlockType,
  CircuitType,
  RoutineExercise,
  RoutineExerciseSet,
} from '../types/workout';
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
      // 1. Cerca i blocchi della routine ordinati per orderIndex
      const blockRows = await db
        .select()
        .from(routineBlocks)
        .where(eq(routineBlocks.routineId, r.id))
        .orderBy(asc(routineBlocks.orderIndex));

      const structuredBlocks: RoutineBlock[] = [];
      const flatExercises: RoutineExercise[] = [];

      if (blockRows.length > 0) {
        // Nuova architettura a blocchi
        for (const blk of blockRows) {
          const rExList = await db
            .select()
            .from(routineExercises)
            .where(eq(routineExercises.blockId, blk.id))
            .orderBy(asc(routineExercises.exerciseOrder));

          const blockExercises: RoutineExercise[] = [];

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
              drop_count: s.dropCount != null ? Number(s.dropCount) : (s.drops ? s.drops.length : 0),
              drop_percentage: s.dropPercentage != null ? Number(s.dropPercentage) : undefined,
              rest_pause_seconds: s.restPauseSeconds ?? undefined,
              rest_seconds: s.restSeconds,
              notes: s.notes || undefined,
            }));

            const structuredEx: RoutineExercise = {
              id: rx.id,
              block_id: blk.id,
              routine_id: rx.routineId || r.id,
              exercise_id: rx.exerciseId || 0,
              exercise_order: rx.exerciseOrder,
              intra_rest_seconds: rx.intraRestSeconds ?? 0,
              superset_group: rx.supersetGroup || undefined,
              custom_description: rx.customDescription || undefined,
              custom_video_url: rx.customVideoUrl || undefined,
              notes: rx.notes || undefined,
              exercise: catalogEx,
              sets: structuredSets,
            };

            blockExercises.push(structuredEx);
            flatExercises.push(structuredEx);
          }

          structuredBlocks.push({
            id: blk.id,
            routine_id: r.id,
            block_type: blk.blockType as RoutineBlockType,
            order_index: blk.orderIndex,
            rounds: blk.rounds,
            rest_between_rounds: blk.restBetweenRounds ?? 0,
            circuit_type: (blk.circuitType as any) || 'STANDARD',
            interval_work_seconds: blk.intervalWorkSeconds ?? null,
            interval_rest_seconds: blk.intervalRestSeconds ?? null,
            created_at: blk.createdAt.toISOString(),
            exercises: blockExercises,
          });
        }
      } else {
        // Fallback per schede legacy senza blocchi
        const rExList = await db
          .select()
          .from(routineExercises)
          .where(eq(routineExercises.routineId, r.id))
          .orderBy(asc(routineExercises.exerciseOrder));

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
            drop_count: s.dropCount != null ? Number(s.dropCount) : (s.drops ? s.drops.length : 0),
            drop_percentage: s.dropPercentage != null ? Number(s.dropPercentage) : undefined,
            rest_pause_seconds: s.restPauseSeconds ?? undefined,
            rest_seconds: s.restSeconds,
            notes: s.notes || undefined,
          }));

          const structuredEx: RoutineExercise = {
            id: rx.id,
            routine_id: rx.routineId || r.id,
            exercise_id: rx.exerciseId || 0,
            exercise_order: rx.exerciseOrder,
            intra_rest_seconds: rx.intraRestSeconds ?? 0,
            superset_group: rx.supersetGroup || undefined,
            custom_description: rx.customDescription || undefined,
            custom_video_url: rx.customVideoUrl || undefined,
            notes: rx.notes || undefined,
            exercise: catalogEx,
            sets: structuredSets,
          };

          flatExercises.push(structuredEx);
        }

        // Crea un blocco STANDARD sintetico per retrocompatibilità
        structuredBlocks.push({
          routine_id: r.id,
          block_type: 'STANDARD',
          order_index: 1,
          rounds: 1,
          rest_between_rounds: 0,
          created_at: r.createdAt.toISOString(),
          exercises: flatExercises,
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
        current_week: r.currentWeek ?? 1,
        created_at: r.createdAt.toISOString(),
        updated_at: r.updatedAt.toISOString(),
        owner_id: r.ownerId,
        blocks: structuredBlocks,
        exercises: flatExercises,
      });
    }

    return result;
  }

  async createRoutine(
    authUser: AuthenticatedUser,
    body: Omit<WorkoutRoutine, 'id' | 'created_at' | 'updated_at'> & {
      client_ids?: (string | number)[];
      clientIds?: (string | number)[];
    }
  ): Promise<WorkoutRoutine> {
    if (authUser.role !== 'TRAINER') {
      throw {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Solo il Personal Trainer è autorizzato a creare schede mesociclo.',
      };
    }

    if (!body.name || !body.name.trim()) {
      throw {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Nome scheda obbligatorio.',
      };
    }

    const rawClientIds =
      (body as any).clientIds ||
      body.client_ids ||
      body.clientIds ||
      (body as any).clientId ||
      (body as any).client_id;

    let targetOwnerIds: string[] = [];

    if (Array.isArray(rawClientIds) && rawClientIds.length > 0) {
      const mapped = rawClientIds
        .map((id) => String(id).trim())
        .filter((id) => id.length > 0)
        .map((id) => (id === 'trainer-1' || id === 'trainer-marco-1' ? authUser.id : id));

      targetOwnerIds = Array.from(new Set(mapped));
    } else if (body.owner_id && String(body.owner_id).trim()) {
      const rawId = String(body.owner_id).trim();
      targetOwnerIds = [rawId === 'trainer-1' || rawId === 'trainer-marco-1' ? authUser.id : rawId];
    } else if ((body as any).ownerId && String((body as any).ownerId).trim()) {
      const rawId = String((body as any).ownerId).trim();
      targetOwnerIds = [rawId === 'trainer-1' || rawId === 'trainer-marco-1' ? authUser.id : rawId];
    } else {
      targetOwnerIds = [authUser.id];
    }

    for (const targetOwnerId of targetOwnerIds) {
      if (targetOwnerId !== authUser.id) {
        const clientRows = await db
          .select()
          .from(users)
          .where(and(eq(users.id, targetOwnerId), eq(users.trainerId, authUser.id)));

        if (clientRows.length === 0) {
          throw {
            statusCode: 403,
            code: 'FORBIDDEN_CLIENT_ACCESS',
            message: `Non puoi assegnare schede ad atlete non collegate al tuo account (ID: ${targetOwnerId}).`,
          };
        }
      }
    }

    const effectiveFolderId =
      (body as any).folderId !== undefined
        ? ((body as any).folderId ? String((body as any).folderId).trim() : null)
        : (body.folder_id !== undefined
        ? (body.folder_id ? String(body.folder_id).trim() : null)
        : null);

    let effectiveFolderName =
      (body as any).folderName !== undefined
        ? ((body as any).folderName ? String((body as any).folderName).trim() : null)
        : (body.folder_name !== undefined
        ? (body.folder_name ? String(body.folder_name).trim() : null)
        : null);

    // Normalizzazione: se arrivano blocks usa quelli; se arriva solo la lista piatta exercises, crea un blocco SINGLE
    let blocksInput = body.blocks;
    if ((!blocksInput || blocksInput.length === 0) && body.exercises && body.exercises.length > 0) {
      blocksInput = [
        {
          block_type: 'SINGLE',
          order_index: 1,
          rounds: 1,
          rest_between_rounds: 0,
          exercises: body.exercises,
        },
      ];
    }

    // TRANSAZIONE DRIZZLE PER INSERIMENTO / CLONAZIONE A CASCATA (Opzione A - Physical Cloning)
    return await db.transaction(async (tx) => {
      let firstCreatedRoutine: WorkoutRoutine | null = null;

      for (const targetOwnerId of targetOwnerIds) {
        let finalFolderName = effectiveFolderName;

        if (effectiveFolderId) {
          const folderRows = await tx
            .select()
            .from(routineFolders)
            .where(eq(routineFolders.id, effectiveFolderId));

          if (folderRows.length === 0) {
            await tx.insert(routineFolders).values({
              id: effectiveFolderId,
              name: effectiveFolderName || 'Cartella',
              ownerId: targetOwnerId,
            });
            if (!finalFolderName) {
              finalFolderName = effectiveFolderName || 'Cartella';
            }
          } else if (!finalFolderName) {
            finalFolderName = folderRows[0].name;
          }
        }

        const insertedRoutines = await tx
          .insert(workoutRoutines)
          .values({
            folderId: effectiveFolderId || null,
            folderName: finalFolderName || null,
            borderColor: body.border_color || '#3B82F6',
            name: body.name.trim(),
            description: body.description || null,
            workoutType: body.workout_type || null,
            durationWeeks: body.duration_weeks || 4,
            currentWeek: (body as any).current_week || 1,
            ownerId: targetOwnerId,
          })
          .returning();

        const createdRoutine = insertedRoutines[0];
        const createdBlocks: RoutineBlock[] = [];
        const flatExercises: RoutineExercise[] = [];

        if (blocksInput && blocksInput.length > 0) {
          for (let bIdx = 0; bIdx < blocksInput.length; bIdx++) {
            const blk = blocksInput[bIdx];
            const blockType = blk.block_type || 'SINGLE';
            const circuitType =
              blk.circuit_type ||
              (blockType === 'CIRCUIT_INTERVAL' ? 'INTERVAL' : 'STANDARD');

            const insertedBlocks = await tx
              .insert(routineBlocks)
              .values({
                routineId: createdRoutine.id,
                blockType: blockType,
              orderIndex: blk.order_index ?? bIdx + 1,
              rounds: blk.rounds ?? 1,
              restBetweenRounds: blk.rest_between_rounds ?? 0,
              circuitType: circuitType,
              intervalWorkSeconds: blk.interval_work_seconds ?? null,
              intervalRestSeconds: blk.interval_rest_seconds ?? null,
            })
            .returning();

          const createdBlockRecord = insertedBlocks[0];
          const blockExercises: RoutineExercise[] = [];

          if (blk.exercises && blk.exercises.length > 0) {
            for (let eIdx = 0; eIdx < blk.exercises.length; eIdx++) {
              const ex = blk.exercises[eIdx];
              const insertedEx = await tx
                .insert(routineExercises)
                .values({
                  blockId: createdBlockRecord.id,
                  routineId: createdRoutine.id,
                  exerciseId: ex.exercise_id || null,
                  exerciseOrder: ex.exercise_order ?? eIdx + 1,
                  intraRestSeconds: ex.intra_rest_seconds ?? 0,
                  supersetGroup: ex.superset_group || null,
                  customDescription: ex.custom_description || null,
                  customVideoUrl: ex.custom_video_url || null,
                  notes: ex.notes || null,
                })
                .returning();

              const curEx = insertedEx[0];
              const createdSets: RoutineExerciseSet[] = [];

              if (ex.sets && ex.sets.length > 0) {
                for (let sIdx = 0; sIdx < ex.sets.length; sIdx++) {
                  const s = ex.sets[sIdx];
                  let drops = s.drops ? s.drops.map((d) => ({ ...d })) : [];
                  const dropPct = s.drop_percentage != null ? Number(s.drop_percentage) : null;
                  const dropCnt = s.drop_count != null ? Number(s.drop_count) : (drops.length > 0 ? drops.length : 0);

                  const rawSetType = s.set_type ? String(s.set_type).toUpperCase() : 'NORMAL';
                  const setType = ['WARMUP', 'NORMAL', 'STRIPPING', 'REST_PAUSE'].includes(rawSetType)
                    ? rawSetType
                    : (rawSetType === 'DROPSET' ? 'STRIPPING' : rawSetType);

                  if (setType === 'STRIPPING' && dropPct !== null && dropPct > 0 && drops.length > 1) {
                    for (let d = 1; d < drops.length; d++) {
                      const prevKg = Number(drops[d - 1].kg || 0);
                      drops[d].kg = Math.max(0, Math.round(prevKg * (1 - dropPct / 100) * 10) / 10);
                    }
                  }

                  const insertedSet = await tx
                    .insert(routineExerciseSets)
                    .values({
                      routineExerciseId: curEx.id,
                      setNumber: s.set_number ?? sIdx + 1,
                      setType: setType,
                      targetWeightKg: String(s.target_weight_kg || 0),
                      targetReps: s.target_reps || 0,
                      targetTimeSeconds: s.target_time_seconds || null,
                      bandAssistance: s.band_assistance || 'none',
                      dropsetWeightKg: s.dropset_weight_kg ? String(s.dropset_weight_kg) : null,
                      drops: drops,
                      dropCount: dropCnt,
                      dropPercentage: dropPct,
                      restPauseSeconds: s.rest_pause_seconds != null ? Number(s.rest_pause_seconds) : null,
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
                    drop_count: insertedSet[0].dropCount,
                    drop_percentage: insertedSet[0].dropPercentage ? Number(insertedSet[0].dropPercentage) : undefined,
                    rest_pause_seconds: insertedSet[0].restPauseSeconds ?? undefined,
                    rest_seconds: insertedSet[0].restSeconds,
                    notes: insertedSet[0].notes || undefined,
                  });
                }
              }

              const structuredEx: RoutineExercise = {
                id: curEx.id,
                block_id: createdBlockRecord.id,
                routine_id: createdRoutine.id,
                exercise_id: curEx.exerciseId || 0,
                exercise_order: curEx.exerciseOrder,
                intra_rest_seconds: curEx.intraRestSeconds ?? 0,
                superset_group: curEx.supersetGroup || undefined,
                custom_description: curEx.customDescription || undefined,
                custom_video_url: curEx.customVideoUrl || undefined,
                notes: curEx.notes || undefined,
                sets: createdSets,
              };

              blockExercises.push(structuredEx);
              flatExercises.push(structuredEx);
            }
          }

          createdBlocks.push({
            id: createdBlockRecord.id,
            routine_id: createdRoutine.id,
            block_type: createdBlockRecord.blockType as RoutineBlockType,
            order_index: createdBlockRecord.orderIndex,
            rounds: createdBlockRecord.rounds,
            rest_between_rounds: createdBlockRecord.restBetweenRounds ?? 0,
            circuit_type: createdBlockRecord.circuitType as CircuitType,
            interval_work_seconds: createdBlockRecord.intervalWorkSeconds,
            interval_rest_seconds: createdBlockRecord.intervalRestSeconds,
            created_at: createdBlockRecord.createdAt.toISOString(),
            exercises: blockExercises,
          });
        }
      }

      const routineResult: WorkoutRoutine = {
        id: createdRoutine.id,
        folder_id: createdRoutine.folderId || undefined,
        folder_name: createdRoutine.folderName || undefined,
        border_color: createdRoutine.borderColor || undefined,
        name: createdRoutine.name,
        description: createdRoutine.description || undefined,
        workout_type: createdRoutine.workoutType || undefined,
        duration_weeks: createdRoutine.durationWeeks,
        current_week: createdRoutine.currentWeek ?? 1,
        created_at: createdRoutine.createdAt.toISOString(),
        updated_at: createdRoutine.updatedAt.toISOString(),
        owner_id: createdRoutine.ownerId,
        blocks: createdBlocks,
        exercises: flatExercises,
      };

      if (!firstCreatedRoutine) {
        firstCreatedRoutine = routineResult;
      }
    }

    return firstCreatedRoutine!;
  });
}

  async updateRoutine(
    authUser: AuthenticatedUser,
    id: number,
    body: Partial<WorkoutRoutine>
  ): Promise<WorkoutRoutine> {
    if (authUser.role !== 'TRAINER') {
      throw {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Solo il Personal Trainer può modificare schede mesociclo.',
      };
    }

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
      const clientRows = await db
        .select()
        .from(users)
        .where(and(eq(users.id, r.ownerId), eq(users.trainerId, authUser.id)));

      if (clientRows.length === 0) {
        throw {
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Non sei autorizzato a modificare questa scheda.',
        };
      }
    }

    // TRANSAZIONE DRIZZLE PER AGGIORNAMENTO ATOMICO A CASCATA
    return await db.transaction(async (tx) => {
      let targetOwnerId = r.ownerId;
      const rawTargetOwnerId =
        (body as any).ownerId ||
        body.owner_id ||
        (Array.isArray((body as any).clientIds) && (body as any).clientIds[0]) ||
        (Array.isArray((body as any).client_ids) && (body as any).client_ids[0]);

      if (rawTargetOwnerId) {
        const cleanId =
          String(rawTargetOwnerId).trim() === 'trainer-1' || String(rawTargetOwnerId).trim() === 'trainer-marco-1'
            ? authUser.id
            : String(rawTargetOwnerId).trim();

        if (cleanId === authUser.id) {
          targetOwnerId = authUser.id;
        } else {
          const clientRows = await tx
            .select()
            .from(users)
            .where(and(eq(users.id, cleanId), eq(users.trainerId, authUser.id)));

          if (clientRows.length === 0) {
            throw {
              statusCode: 403,
              code: 'FORBIDDEN_CLIENT_ACCESS',
              message: `Non puoi assegnare schede ad atlete non collegate al tuo account (ID: ${cleanId}).`,
            };
          }
          targetOwnerId = cleanId;
        }
      }

      const effectiveFolderId =
        (body as any).folderId !== undefined
          ? ((body as any).folderId ? String((body as any).folderId).trim() : null)
          : (body.folder_id !== undefined
          ? (body.folder_id ? String(body.folder_id).trim() : null)
          : undefined);

      let effectiveFolderName =
        (body as any).folderName !== undefined
          ? ((body as any).folderName ? String((body as any).folderName).trim() : null)
          : (body.folder_name !== undefined
          ? (body.folder_name ? String(body.folder_name).trim() : null)
          : undefined);

      if (effectiveFolderId) {
        const folderRows = await tx
          .select()
          .from(routineFolders)
          .where(eq(routineFolders.id, effectiveFolderId));

        if (folderRows.length === 0) {
          await tx.insert(routineFolders).values({
            id: effectiveFolderId,
            name: effectiveFolderName || 'Cartella',
            ownerId: targetOwnerId,
          });
          if (!effectiveFolderName) {
            effectiveFolderName = 'Cartella';
          }
        } else if (!effectiveFolderName) {
          effectiveFolderName = folderRows[0].name;
        }
      }

      // 1. Aggiornamento anagrafico routine
      await tx
        .update(workoutRoutines)
        .set({
          ownerId: targetOwnerId,
          folderId: effectiveFolderId !== undefined ? effectiveFolderId : r.folderId,
          folderName: effectiveFolderName !== undefined ? effectiveFolderName : r.folderName,
          borderColor: body.border_color !== undefined ? body.border_color : r.borderColor,
          name: body.name !== undefined ? body.name.trim() : r.name,
          description: body.description !== undefined ? body.description : r.description,
          workoutType: body.workout_type !== undefined ? body.workout_type : r.workoutType,
          durationWeeks: body.duration_weeks !== undefined ? body.duration_weeks : r.durationWeeks,
          currentWeek: (body as any).current_week !== undefined ? (body as any).current_week : r.currentWeek,
          updatedAt: new Date(),
        })
        .where(eq(workoutRoutines.id, id));

      let blocksInput = body.blocks;
      if ((!blocksInput || blocksInput.length === 0) && body.exercises && body.exercises.length > 0) {
        blocksInput = [
          {
            block_type: 'STANDARD',
            order_index: 1,
            rounds: 1,
            rest_between_rounds: 0,
            exercises: body.exercises,
          },
        ];
      }

      // Se forniti blocchi o esercizi, sostituisci a cascata
      if (blocksInput !== undefined) {
        // Rimuovi vecchi blocchi (la cascade elimina anche routine_exercises e sets)
        await tx.delete(routineBlocks).where(eq(routineBlocks.routineId, id));
        await tx.delete(routineExercises).where(eq(routineExercises.routineId, id));

        for (let bIdx = 0; bIdx < blocksInput.length; bIdx++) {
          const blk = blocksInput[bIdx];
          const insertedBlocks = await tx
            .insert(routineBlocks)
            .values({
              routineId: id,
              blockType: blk.block_type || 'SINGLE',
              orderIndex: blk.order_index ?? bIdx + 1,
              rounds: blk.rounds ?? 1,
              restBetweenRounds: blk.rest_between_rounds ?? 0,
              circuitType: blk.circuit_type || (blk.block_type === 'CIRCUIT_INTERVAL' ? 'INTERVAL' : 'STANDARD'),
              intervalWorkSeconds: blk.interval_work_seconds ?? null,
              intervalRestSeconds: blk.interval_rest_seconds ?? null,
            })
            .returning();

          const createdBlockRecord = insertedBlocks[0];

          if (blk.exercises && blk.exercises.length > 0) {
            for (let eIdx = 0; eIdx < blk.exercises.length; eIdx++) {
              const ex = blk.exercises[eIdx];
              const insertedEx = await tx
                .insert(routineExercises)
                .values({
                  blockId: createdBlockRecord.id,
                  routineId: id,
                  exerciseId: ex.exercise_id || null,
                  exerciseOrder: ex.exercise_order ?? eIdx + 1,
                  intraRestSeconds: ex.intra_rest_seconds ?? 0,
                  supersetGroup: ex.superset_group || null,
                  customDescription: ex.custom_description || null,
                  customVideoUrl: ex.custom_video_url || null,
                  notes: ex.notes || null,
                })
                .returning();

              const curEx = insertedEx[0];

              if (ex.sets && ex.sets.length > 0) {
                for (let sIdx = 0; sIdx < ex.sets.length; sIdx++) {
                  const s = ex.sets[sIdx];
                  let drops = s.drops ? s.drops.map((d) => ({ ...d })) : [];
                  const dropPct = s.drop_percentage != null ? Number(s.drop_percentage) : null;
                  const dropCnt = s.drop_count != null ? Number(s.drop_count) : (drops.length > 0 ? drops.length : 0);

                  const rawSetType = s.set_type ? String(s.set_type).toUpperCase() : 'NORMAL';
                  const setType = ['WARMUP', 'NORMAL', 'STRIPPING', 'REST_PAUSE'].includes(rawSetType)
                    ? rawSetType
                    : (rawSetType === 'DROPSET' ? 'STRIPPING' : rawSetType);

                  if (setType === 'STRIPPING' && dropPct !== null && dropPct > 0 && drops.length > 1) {
                    for (let d = 1; d < drops.length; d++) {
                      const prevKg = Number(drops[d - 1].kg || 0);
                      drops[d].kg = Math.max(0, Math.round(prevKg * (1 - dropPct / 100) * 10) / 10);
                    }
                  }

                  await tx.insert(routineExerciseSets).values({
                    routineExerciseId: curEx.id,
                    setNumber: s.set_number ?? sIdx + 1,
                    setType: setType,
                    targetWeightKg: String(s.target_weight_kg || 0),
                    targetReps: s.target_reps || 0,
                    targetTimeSeconds: s.target_time_seconds || null,
                    bandAssistance: s.band_assistance || 'none',
                    dropsetWeightKg: s.dropset_weight_kg ? String(s.dropset_weight_kg) : null,
                    drops: drops,
                    dropCount: dropCnt,
                    dropPercentage: dropPct,
                    restPauseSeconds: s.rest_pause_seconds != null ? Number(s.rest_pause_seconds) : null,
                    restSeconds: s.rest_seconds || 90,
                    notes: s.notes || null,
                  });
                }
              }
            }
          }
        }
      }

      // Ricarica la scheda aggiornata
      const updatedList = await this.getRoutines(authUser, targetOwnerId);
      const found = updatedList.find((item) => item.id === id);
      return found!;
    });
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
