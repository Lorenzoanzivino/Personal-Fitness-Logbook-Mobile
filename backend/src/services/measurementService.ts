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
      .orderBy(desc(bodyMeasurements.recordedAt));

    return rows.map((r) => ({
      id: r.id,
      recorded_at: r.recordedAt.toISOString(),
      weight_kg: Number(r.weightKg),
      weight_delta_kg: r.weightDeltaKg ? Number(r.weightDeltaKg) : null,
      bmi: r.bmi ? Number(r.bmi) : null,
      body_fat_pct: r.bodyFatPct ? Number(r.bodyFatPct) : null,
      muscle_mass_kg: r.muscleMassKg ? Number(r.muscleMassKg) : null,
      lean_mass_kg: r.leanMassKg ? Number(r.leanMassKg) : null,
      water_pct: r.waterPct ? Number(r.waterPct) : null,
      bone_mass_kg: r.boneMassKg ? Number(r.boneMassKg) : null,
      visceral_fat: r.visceralFat ? Number(r.visceralFat) : null,
      bmr_kcal: r.bmrKcal || null,
      amr_kcal: r.amrKcal || null,
      notes: r.notes || null,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
      owner_id: r.ownerId,
    }));
  }

  /**
   * Crea una nuova misurazione.
   * REGOLA: owner_id è TASSATIVAMENTE l'utente autenticato (authUser.id).
   */
  async createMeasurement(
    authUser: AuthenticatedUser,
    dto: CreateBodyMeasurementDto
  ): Promise<BodyMeasurement> {
    if (dto.weight_kg === undefined || dto.weight_kg <= 0) {
      throw {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Il peso corporeo (weight_kg) è obbligatorio e deve essere maggiore di 0.',
      };
    }

    const recordedAtDate = dto.recorded_at ? new Date(dto.recorded_at) : new Date();

    // Calcolo delta peso rispetto all'ultima rilevazione dell'utente
    const previous = await db
      .select()
      .from(bodyMeasurements)
      .where(eq(bodyMeasurements.ownerId, authUser.id))
      .orderBy(desc(bodyMeasurements.recordedAt))
      .limit(1);

    let weightDelta: number | null = null;
    if (previous.length > 0 && previous[0].weightKg) {
      weightDelta = Math.round((dto.weight_kg - Number(previous[0].weightKg)) * 10) / 10;
    }

    const inserted = await db
      .insert(bodyMeasurements)
      .values({
        ownerId: authUser.id, // Isolamento forzato dal token JWT
        recordedAt: recordedAtDate,
        weightKg: String(dto.weight_kg),
        weightDeltaKg: weightDelta !== null ? String(weightDelta) : null,
        bmi: dto.bmi !== undefined ? String(dto.bmi) : null,
        bodyFatPct: dto.body_fat_pct !== undefined ? String(dto.body_fat_pct) : null,
        muscleMassKg: dto.muscle_mass_kg !== undefined ? String(dto.muscle_mass_kg) : null,
        leanMassKg: dto.lean_mass_kg !== undefined ? String(dto.lean_mass_kg) : null,
        waterPct: dto.water_pct !== undefined ? String(dto.water_pct) : null,
        boneMassKg: dto.bone_mass_kg !== undefined ? String(dto.bone_mass_kg) : null,
        visceralFat: dto.visceral_fat !== undefined ? String(dto.visceral_fat) : null,
        bmrKcal: dto.bmr_kcal || null,
        amrKcal: dto.amr_kcal || null,
        notes: dto.notes ? dto.notes.trim() : null,
      })
      .returning();

    const created = inserted[0];
    return {
      id: created.id,
      recorded_at: created.recordedAt.toISOString(),
      weight_kg: Number(created.weightKg),
      weight_delta_kg: created.weightDeltaKg ? Number(created.weightDeltaKg) : null,
      bmi: created.bmi ? Number(created.bmi) : null,
      body_fat_pct: created.bodyFatPct ? Number(created.bodyFatPct) : null,
      muscle_mass_kg: created.muscleMassKg ? Number(created.muscleMassKg) : null,
      lean_mass_kg: created.leanMassKg ? Number(created.leanMassKg) : null,
      water_pct: created.waterPct ? Number(created.waterPct) : null,
      bone_mass_kg: created.boneMassKg ? Number(created.boneMassKg) : null,
      visceral_fat: created.visceralFat ? Number(created.visceralFat) : null,
      bmr_kcal: created.bmrKcal || null,
      amr_kcal: created.amrKcal || null,
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

    const updated = await db
      .update(bodyMeasurements)
      .set({
        recordedAt: dto.recorded_at ? new Date(dto.recorded_at) : undefined,
        weightKg: dto.weight_kg !== undefined ? String(dto.weight_kg) : undefined,
        bmi: dto.bmi !== undefined ? String(dto.bmi) : undefined,
        bodyFatPct: dto.body_fat_pct !== undefined ? String(dto.body_fat_pct) : undefined,
        muscleMassKg: dto.muscle_mass_kg !== undefined ? String(dto.muscle_mass_kg) : undefined,
        leanMassKg: dto.lean_mass_kg !== undefined ? String(dto.lean_mass_kg) : undefined,
        waterPct: dto.water_pct !== undefined ? String(dto.water_pct) : undefined,
        boneMassKg: dto.bone_mass_kg !== undefined ? String(dto.bone_mass_kg) : undefined,
        visceralFat: dto.visceral_fat !== undefined ? String(dto.visceral_fat) : undefined,
        bmrKcal: dto.bmr_kcal !== undefined ? dto.bmr_kcal : undefined,
        amrKcal: dto.amr_kcal !== undefined ? dto.amr_kcal : undefined,
        notes: dto.notes !== undefined ? (dto.notes ? dto.notes.trim() : null) : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(bodyMeasurements.id, id), eq(bodyMeasurements.ownerId, authUser.id)))
      .returning();

    const r = updated[0];
    return {
      id: r.id,
      recorded_at: r.recordedAt.toISOString(),
      weight_kg: Number(r.weightKg),
      weight_delta_kg: r.weightDeltaKg ? Number(r.weightDeltaKg) : null,
      bmi: r.bmi ? Number(r.bmi) : null,
      body_fat_pct: r.bodyFatPct ? Number(r.bodyFatPct) : null,
      muscle_mass_kg: r.muscleMassKg ? Number(r.muscleMassKg) : null,
      lean_mass_kg: r.leanMassKg ? Number(r.leanMassKg) : null,
      water_pct: r.waterPct ? Number(r.waterPct) : null,
      bone_mass_kg: r.boneMassKg ? Number(r.boneMassKg) : null,
      visceral_fat: r.visceralFat ? Number(r.visceralFat) : null,
      bmr_kcal: r.bmrKcal || null,
      amr_kcal: r.amrKcal || null,
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
