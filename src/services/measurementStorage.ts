import AsyncStorage from '@react-native-async-storage/async-storage';
import { BodyMeasurement, CreateBodyMeasurementDto } from '../types/measurement';

const getStorageKey = (userId?: string | null) => `@measurements_v3_${userId || 'default'}`;

export const DEFAULT_MEASUREMENTS: BodyMeasurement[] = [];

export const measurementStorage = {
  async loadMeasurements(userId?: string | null): Promise<BodyMeasurement[]> {
    const key = getStorageKey(userId);
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        return JSON.parse(raw);
      }
      await AsyncStorage.setItem(key, JSON.stringify(DEFAULT_MEASUREMENTS));
      return DEFAULT_MEASUREMENTS;
    } catch (e) {
      console.warn(`Errore lettura misurazioni per ${key} da AsyncStorage:`, e);
      return DEFAULT_MEASUREMENTS;
    }
  },

  async saveMeasurements(measurements: BodyMeasurement[], userId?: string | null): Promise<void> {
    const key = getStorageKey(userId);
    try {
      await AsyncStorage.setItem(key, JSON.stringify(measurements));
    } catch (e) {
      console.warn(`Errore salvataggio misurazioni per ${key} su AsyncStorage:`, e);
    }
  },

  async addMeasurement(dto: CreateBodyMeasurementDto, userId?: string | null): Promise<BodyMeasurement> {
    const list = await this.loadMeasurements(userId);
    const newId = list.length > 0 ? Math.max(...list.map((m) => m.id)) + 1 : 1;
    const now = new Date().toISOString();

    const sorted = [...list].sort((a, b) => (b.recorded_at > a.recorded_at ? 1 : -1));
    const previous = sorted[0];
    const delta = previous
      ? Math.round((dto.weight_kg - previous.weight_kg) * 10) / 10
      : null;

    const newMeasurement: BodyMeasurement = {
      id: newId,
      recorded_at: dto.recorded_at || now,
      weight_kg: dto.weight_kg,
      weight_delta_kg: delta,
      bmi: dto.bmi ?? null,
      body_fat_pct: dto.body_fat_pct ?? null,
      muscle_mass_kg: dto.muscle_mass_kg ?? null,
      lean_mass_kg: dto.lean_mass_kg ?? null,
      water_pct: dto.water_pct ?? null,
      bone_mass_kg: dto.bone_mass_kg ?? null,
      visceral_fat: dto.visceral_fat ?? null,
      bmr_kcal: dto.bmr_kcal ?? null,
      amr_kcal: dto.amr_kcal ?? null,
      notes: dto.notes?.trim() || null,
      created_at: now,
      updated_at: now,
      owner_id: userId || undefined,
    };

    const updated = [newMeasurement, ...list];
    await this.saveMeasurements(updated, userId);
    return newMeasurement;
  },

  async updateMeasurement(
    id: number,
    updatedData: Partial<CreateBodyMeasurementDto>,
    userId?: string | null
  ): Promise<BodyMeasurement | null> {
    const list = await this.loadMeasurements(userId);
    const index = list.findIndex((m) => m.id === id);
    if (index === -1) return null;

    const existing = list[index];
    const updatedWeight =
      updatedData.weight_kg !== undefined ? updatedData.weight_kg : existing.weight_kg;

    const otherMeasurements = list.filter((m) => m.id !== id);
    const sorted = [...otherMeasurements].sort((a, b) => (b.recorded_at > a.recorded_at ? 1 : -1));
    const previous = sorted[0];
    const delta = previous
      ? Math.round((updatedWeight - previous.weight_kg) * 10) / 10
      : existing.weight_delta_kg;

    const updatedItem: BodyMeasurement = {
      ...existing,
      ...updatedData,
      weight_kg: updatedWeight,
      weight_delta_kg: delta,
      notes: updatedData.notes !== undefined ? (updatedData.notes?.trim() || null) : existing.notes,
      updated_at: new Date().toISOString(),
    };

    list[index] = updatedItem;
    await this.saveMeasurements(list, userId);
    return updatedItem;
  },

  async deleteMeasurement(id: number, userId?: string | null): Promise<void> {
    const list = await this.loadMeasurements(userId);
    const updated = list.filter((m) => m.id !== id);
    await this.saveMeasurements(updated, userId);
  },

  async clearAllMeasurements(userId?: string | null): Promise<void> {
    const key = getStorageKey(userId);
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn(`Errore pulizia misurazioni per ${key}:`, e);
    }
  },
};
