import AsyncStorage from '@react-native-async-storage/async-storage';
import { BodyMeasurement, CreateBodyMeasurementDto } from '../types/measurement';

const STORAGE_KEY = '@measurements_v2';

export const DEFAULT_MEASUREMENTS: BodyMeasurement[] = [
  {
    id: 1,
    recorded_at: '2026-08-16T07:30:00.000Z',
    weight_kg: 80.2,
    weight_delta_kg: null,
    bmi: 24.8,
    body_fat_pct: 15.6,
    lean_mass_kg: 67.7,
    muscle_mass_kg: 64.2,
    water_pct: 60.1,
    bone_mass_kg: 3.5,
    visceral_fat: 5,
    bmr_kcal: 1780,
    amr_kcal: 2650,
    notes: 'Inizio blocco ipertrofia. Rilevazione a digiuno.',
    created_at: '2026-08-16T07:30:00.000Z',
    updated_at: '2026-08-16T07:30:00.000Z',
  },
  {
    id: 2,
    recorded_at: '2026-08-25T07:45:00.000Z',
    weight_kg: 79.6,
    weight_delta_kg: -0.6,
    bmi: 24.6,
    body_fat_pct: 15.0,
    lean_mass_kg: 67.7,
    muscle_mass_kg: 64.3,
    water_pct: 60.8,
    bone_mass_kg: 3.4,
    visceral_fat: 5,
    bmr_kcal: 1775,
    amr_kcal: 2640,
    notes: 'Buona idratazione post weekend.',
    created_at: '2026-08-25T07:45:00.000Z',
    updated_at: '2026-08-25T07:45:00.000Z',
  },
  {
    id: 3,
    recorded_at: '2026-09-06T07:40:00.000Z',
    weight_kg: 79.0,
    weight_delta_kg: -0.6,
    bmi: 24.4,
    body_fat_pct: 14.6,
    lean_mass_kg: 67.5,
    muscle_mass_kg: 64.4,
    water_pct: 61.2,
    bone_mass_kg: 3.4,
    visceral_fat: 4,
    bmr_kcal: 1765,
    amr_kcal: 2620,
    notes: 'Aumento quota idrica giornaliera.',
    created_at: '2026-09-06T07:40:00.000Z',
    updated_at: '2026-09-06T07:40:00.000Z',
  },
  {
    id: 4,
    recorded_at: '2026-09-13T07:30:00.000Z',
    weight_kg: 78.4,
    weight_delta_kg: -0.6,
    bmi: 24.2,
    body_fat_pct: 14.2,
    lean_mass_kg: 67.3,
    muscle_mass_kg: 64.5,
    water_pct: 61.5,
    bone_mass_kg: 3.4,
    visceral_fat: 4,
    bmr_kcal: 1750,
    amr_kcal: 2600,
    notes: 'Ottima condizione, calo costante del grasso corporeo.',
    created_at: '2026-09-13T07:30:00.000Z',
    updated_at: '2026-09-13T07:30:00.000Z',
  },
];

export const measurementStorage = {
  async loadMeasurements(): Promise<BodyMeasurement[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MEASUREMENTS));
      return DEFAULT_MEASUREMENTS;
    } catch (e) {
      console.warn('Errore lettura misurazioni da AsyncStorage:', e);
      return DEFAULT_MEASUREMENTS;
    }
  },

  async saveMeasurements(measurements: BodyMeasurement[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(measurements));
    } catch (e) {
      console.warn('Errore salvataggio misurazioni su AsyncStorage:', e);
    }
  },

  async addMeasurement(dto: CreateBodyMeasurementDto): Promise<BodyMeasurement> {
    const list = await this.loadMeasurements();
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
    };

    const updated = [newMeasurement, ...list];
    await this.saveMeasurements(updated);
    return newMeasurement;
  },

  async deleteMeasurement(id: number): Promise<void> {
    const list = await this.loadMeasurements();
    const updated = list.filter((m) => m.id !== id);
    await this.saveMeasurements(updated);
  },

  async clearAllMeasurements(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Errore pulizia misurazioni:', e);
    }
  },
};
