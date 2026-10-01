import { db } from '../db';
import { bodyMeasurements, users } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { BodyMeasurement, CreateBodyMeasurementDto } from '../types/measurement';
import { AuthenticatedUser } from '../middleware/auth';

export class MeasurementService {
  /**
   * Recupera le misurazioni con rigoroso isolamento utente
   */
  async getMeasurements(
    authUser: AuthenticatedUser,
    targetClientId?: string
  ): Promise<BodyMeasurement[]> {
    let effectiveOwnerId = authUser.id;

    // Se l'utente è un Trainer e richiede di consultare un'allieva
    if (authUser.role === 'TRAINER' && targetClientId && targetClientId !== authUser.id) {
      // Verifica autorizzazione: l'allieva DEVE essere collegata a questo trainer
      const clientRows = await db
        .select()
        .from(users)
        .where(and(eq(users.id, targetClientId), eq(users.trainerId, authUser.id)));

      if (clientRows.length === 0) {
        throw {
          statusCode: 403,
          code: 'FORBIDDEN_CLIENT_ACCESS',
          message: 'Non sei autorizzato a consultare le misurazioni di questa atleta.',
        };
      }
      effectiveOwnerId = targetClientId;
    }

    // Query isolata tassativamente su effectiveOwnerId
    const rows = await db
      .select()
      .from(bodyMeasurements)
      .where(eq(bodyMeasurements.ownerId, effectiveOwnerId))
      .orderBy(desc(bodyMeasurements.date));

    return rows.map((r) => {
      const dateStr = r.date.toISOString();
      const weightNum = Number(r.weight);
      return {
        id: r.id,
        date: dateStr,
        weight: weightNum,
        recorded_at: dateStr,
        weight_kg: weightNum,
        weight_delta_kg: r.weightDeltaKg ? Number(r.weightDeltaKg) : null,
        bmi: r.bmi ? Number(r.bmi) : null,
        body_fat_percentage: r.bodyFatPercentage ? Number(r.bodyFatPercentage) : null,
        body_fat_pct: r.bodyFatPercentage ? Number(r.bodyFatPercentage) : null,
        muscle_mass_kg: r.muscleMassKg ? Number(r.muscleMassKg) : null,
        bmr: r.bmr ? Number(r.bmr) : null,
        bmr_kcal: r.bmr ? Number(r.bmr) : null,
        water_percentage: r.waterPercentage ? Number(r.waterPercentage) : null,
        water_pct: r.waterPercentage ? Number(r.waterPercentage) : null,
        fat_mass_kg: r.fatMassKg ? Number(r.fatMassKg) : null,
        lean_mass_kg: r.leanMassKg ? Number(r.leanMassKg) : null,
        bone_mass_kg: r.boneMassKg ? Number(r.boneMassKg) : null,
        visceral_fat: r.visceralFat ? Number(r.visceralFat) : null,
        protein_percentage: r.proteinPercentage ? Number(r.proteinPercentage) : null,
        skeletal_muscle_mass_kg: r.skeletalMuscleMassKg ? Number(r.skeletalMuscleMassKg) : null,
        subcutaneous_fat_percentage: r.subcutaneousFatPercentage ? Number(r.subcutaneousFatPercentage) : null,
        notes: r.notes || null,
        created_at: r.createdAt.toISOString(),
        updated_at: r.updatedAt.toISOString(),
        owner_id: r.ownerId,
      };
    });
  }

  /**
   * Crea una nuova misurazione.
   * REGOLA: owner_id è TASSATIVAMENTE l'utente autenticato (authUser.id).
   */
  async createMeasurement(
    authUser: AuthenticatedUser,
    dto: CreateBodyMeasurementDto
  ): Promise<BodyMeasurement> {
    const effectiveWeight = dto.weight !== undefined ? dto.weight : dto.weight_kg;
    if (effectiveWeight === undefined || effectiveWeight <= 0) {
      throw {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Il peso corporeo (weight / weight_kg) è obbligatorio e deve essere maggiore di 0.',
      };
    }

    const recordedDate = dto.date
      ? new Date(dto.date)
      : dto.recorded_at
      ? new Date(dto.recorded_at)
      : new Date();

    // Calcolo delta peso rispetto all'ultima rilevazione dell'utente
    const previous = await db
      .select()
      .from(bodyMeasurements)
      .where(eq(bodyMeasurements.ownerId, authUser.id))
      .orderBy(desc(bodyMeasurements.date))
      .limit(1);

    let weightDelta: number | null = null;
    if (previous.length > 0 && previous[0].weight) {
      weightDelta = Math.round((effectiveWeight - Number(previous[0].weight)) * 10) / 10;
    }

    const inserted = await db
      .insert(bodyMeasurements)
      .values({
        ownerId: authUser.id, // Isolamento forzato dal token JWT
        date: recordedDate,
        weight: String(effectiveWeight),
        weightDeltaKg: weightDelta !== null ? String(weightDelta) : null,
        bmi: dto.bmi != null ? String(dto.bmi) : null,
        bodyFatPercentage:
          (dto.body_fat_percentage ?? dto.body_fat_pct) != null
            ? String(dto.body_fat_percentage ?? dto.body_fat_pct)
            : null,
        muscleMassKg: dto.muscle_mass_kg != null ? String(dto.muscle_mass_kg) : null,
        bmr: (dto.bmr ?? dto.bmr_kcal) != null ? String(dto.bmr ?? dto.bmr_kcal) : null,
        waterPercentage:
          (dto.water_percentage ?? dto.water_pct) != null
            ? String(dto.water_percentage ?? dto.water_pct)
            : null,
        fatMassKg: dto.fat_mass_kg != null ? String(dto.fat_mass_kg) : null,
        leanMassKg: dto.lean_mass_kg != null ? String(dto.lean_mass_kg) : null,
        boneMassKg: dto.bone_mass_kg != null ? String(dto.bone_mass_kg) : null,
        visceralFat: dto.visceral_fat != null ? String(dto.visceral_fat) : null,
        proteinPercentage: dto.protein_percentage != null ? String(dto.protein_percentage) : null,
        skeletalMuscleMassKg:
          dto.skeletal_muscle_mass_kg != null ? String(dto.skeletal_muscle_mass_kg) : null,
        subcutaneousFatPercentage:
          dto.subcutaneous_fat_percentage != null
            ? String(dto.subcutaneous_fat_percentage)
            : null,
        notes: dto.notes ? dto.notes.trim() : null,
      })
      .returning();

    const created = inserted[0];
    const dateStr = created.date.toISOString();
    const weightNum = Number(created.weight);

    return {
      id: created.id,
      date: dateStr,
      weight: weightNum,
      recorded_at: dateStr,
      weight_kg: weightNum,
      weight_delta_kg: created.weightDeltaKg ? Number(created.weightDeltaKg) : null,
      bmi: created.bmi ? Number(created.bmi) : null,
      body_fat_percentage: created.bodyFatPercentage ? Number(created.bodyFatPercentage) : null,
      body_fat_pct: created.bodyFatPercentage ? Number(created.bodyFatPercentage) : null,
      muscle_mass_kg: created.muscleMassKg ? Number(created.muscleMassKg) : null,
      bmr: created.bmr ? Number(created.bmr) : null,
      bmr_kcal: created.bmr ? Number(created.bmr) : null,
      water_percentage: created.waterPercentage ? Number(created.waterPercentage) : null,
      water_pct: created.waterPercentage ? Number(created.waterPercentage) : null,
      fat_mass_kg: created.fatMassKg ? Number(created.fatMassKg) : null,
      lean_mass_kg: created.leanMassKg ? Number(created.leanMassKg) : null,
      bone_mass_kg: created.boneMassKg ? Number(created.boneMassKg) : null,
      visceral_fat: created.visceralFat ? Number(created.visceralFat) : null,
      protein_percentage: created.proteinPercentage ? Number(created.proteinPercentage) : null,
      skeletal_muscle_mass_kg: created.skeletalMuscleMassKg
        ? Number(created.skeletalMuscleMassKg)
        : null,
      subcutaneous_fat_percentage: created.subcutaneousFatPercentage
        ? Number(created.subcutaneousFatPercentage)
        : null,
      notes: created.notes || null,
      created_at: created.createdAt.toISOString(),
      updated_at: created.updatedAt.toISOString(),
      owner_id: created.ownerId,
    };
  }

  /**
   * Modifica una misurazione esistente.
   * REGOLA: Può essere modificata SOLO dal proprietario autenticato.
   */
  async updateMeasurement(
    authUser: AuthenticatedUser,
    id: number,
    dto: Partial<CreateBodyMeasurementDto>
  ): Promise<BodyMeasurement> {
    // Verifica che appartenga all'utente autenticato
    const existing = await db
      .select()
      .from(bodyMeasurements)
      .where(and(eq(bodyMeasurements.id, id), eq(bodyMeasurements.ownerId, authUser.id)));

    if (existing.length === 0) {
      throw {
        statusCode: 404,
        code: 'NOT_FOUND_OR_FORBIDDEN',
        message: 'Misurazione non trovata o non appartiene al tuo account.',
      };
    }

    const effectiveWeight = dto.weight !== undefined ? dto.weight : dto.weight_kg;
    const recordedDate = dto.date
      ? new Date(dto.date)
      : dto.recorded_at
      ? new Date(dto.recorded_at)
      : undefined;

    const updated = await db
      .update(bodyMeasurements)
      .set({
        date: recordedDate,
        weight: effectiveWeight !== undefined ? String(effectiveWeight) : undefined,
        bmi: dto.bmi !== undefined ? (dto.bmi != null ? String(dto.bmi) : null) : undefined,
        bodyFatPercentage:
          (dto.body_fat_percentage ?? dto.body_fat_pct) !== undefined
            ? (dto.body_fat_percentage ?? dto.body_fat_pct) != null
              ? String(dto.body_fat_percentage ?? dto.body_fat_pct)
              : null
            : undefined,
        muscleMassKg:
          dto.muscle_mass_kg !== undefined
            ? dto.muscle_mass_kg != null
              ? String(dto.muscle_mass_kg)
              : null
            : undefined,
        bmr:
          (dto.bmr ?? dto.bmr_kcal) !== undefined
            ? (dto.bmr ?? dto.bmr_kcal) != null
              ? String(dto.bmr ?? dto.bmr_kcal)
              : null
            : undefined,
        waterPercentage:
          (dto.water_percentage ?? dto.water_pct) !== undefined
            ? (dto.water_percentage ?? dto.water_pct) != null
              ? String(dto.water_percentage ?? dto.water_pct)
              : null
            : undefined,
        fatMassKg:
          dto.fat_mass_kg !== undefined
            ? dto.fat_mass_kg != null
              ? String(dto.fat_mass_kg)
              : null
            : undefined,
        leanMassKg:
          dto.lean_mass_kg !== undefined
            ? dto.lean_mass_kg != null
              ? String(dto.lean_mass_kg)
              : null
            : undefined,
        boneMassKg:
          dto.bone_mass_kg !== undefined
            ? dto.bone_mass_kg != null
              ? String(dto.bone_mass_kg)
              : null
            : undefined,
        visceralFat:
          dto.visceral_fat !== undefined
            ? dto.visceral_fat != null
              ? String(dto.visceral_fat)
              : null
            : undefined,
        proteinPercentage:
          dto.protein_percentage !== undefined
            ? dto.protein_percentage != null
              ? String(dto.protein_percentage)
              : null
            : undefined,
        skeletalMuscleMassKg:
          dto.skeletal_muscle_mass_kg !== undefined
            ? dto.skeletal_muscle_mass_kg != null
              ? String(dto.skeletal_muscle_mass_kg)
              : null
            : undefined,
        subcutaneousFatPercentage:
          dto.subcutaneous_fat_percentage !== undefined
            ? dto.subcutaneous_fat_percentage != null
              ? String(dto.subcutaneous_fat_percentage)
              : null
            : undefined,
        notes: dto.notes !== undefined ? (dto.notes ? dto.notes.trim() : null) : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(bodyMeasurements.id, id), eq(bodyMeasurements.ownerId, authUser.id)))
      .returning();

    const r = updated[0];
    const dateStr = r.date.toISOString();
    const weightNum = Number(r.weight);

    return {
      id: r.id,
      date: dateStr,
      weight: weightNum,
      recorded_at: dateStr,
      weight_kg: weightNum,
      weight_delta_kg: r.weightDeltaKg ? Number(r.weightDeltaKg) : null,
      bmi: r.bmi ? Number(r.bmi) : null,
      body_fat_percentage: r.bodyFatPercentage ? Number(r.bodyFatPercentage) : null,
      body_fat_pct: r.bodyFatPercentage ? Number(r.bodyFatPercentage) : null,
      muscle_mass_kg: r.muscleMassKg ? Number(r.muscleMassKg) : null,
      bmr: r.bmr ? Number(r.bmr) : null,
      bmr_kcal: r.bmr ? Number(r.bmr) : null,
      water_percentage: r.waterPercentage ? Number(r.waterPercentage) : null,
      water_pct: r.waterPercentage ? Number(r.waterPercentage) : null,
      fat_mass_kg: r.fatMassKg ? Number(r.fatMassKg) : null,
      lean_mass_kg: r.leanMassKg ? Number(r.leanMassKg) : null,
      bone_mass_kg: r.boneMassKg ? Number(r.boneMassKg) : null,
      visceral_fat: r.visceralFat ? Number(r.visceralFat) : null,
      protein_percentage: r.proteinPercentage ? Number(r.proteinPercentage) : null,
      skeletal_muscle_mass_kg: r.skeletalMuscleMassKg ? Number(r.skeletalMuscleMassKg) : null,
      subcutaneous_fat_percentage: r.subcutaneousFatPercentage
        ? Number(r.subcutaneousFatPercentage)
        : null,
      notes: r.notes || null,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
      owner_id: r.ownerId,
    };
  }

  /**
   * Elimina una misurazione.
   * REGOLA CRITICA: WHERE id = :id AND owner_id = :authUserId.
   * Il Trainer NON PUÒ cancellare le misurazioni dell'atleta!
   */
  async deleteMeasurement(
    authUser: AuthenticatedUser,
    id: number
  ): Promise<{ id: number; deleted: boolean }> {
    const deleted = await db
      .delete(bodyMeasurements)
      .where(and(eq(bodyMeasurements.id, id), eq(bodyMeasurements.ownerId, authUser.id)))
      .returning();

    if (deleted.length === 0) {
      throw {
        statusCode: 404,
        code: 'NOT_FOUND_OR_FORBIDDEN',
        message: 'Misurazione inesistente o non rimovibile (puoi eliminare solo le tue misurazioni personali).',
      };
    }

    return { id, deleted: true };
  }
}

export const measurementService = new MeasurementService();
