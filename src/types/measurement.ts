export interface BodyMeasurement {
  id: number;
  recorded_at: string; // ISO-8601 YYYY-MM-DDTHH:mm
  weight_kg: number;
  weight_delta_kg?: number | null;
  bmi?: number | null;
  body_fat_pct?: number | null;
  muscle_mass_kg?: number | null;
  lean_mass_kg?: number | null;
  water_pct?: number | null;
  bone_mass_kg?: number | null;
  visceral_fat?: number | null;
  bmr_kcal?: number | null;
  amr_kcal?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBodyMeasurementDto {
  recorded_at: string;
  weight_kg: number;
  bmi?: number;
  body_fat_pct?: number;
  muscle_mass_kg?: number;
  lean_mass_kg?: number;
  water_pct?: number;
  bone_mass_kg?: number;
  visceral_fat?: number;
  bmr_kcal?: number;
  amr_kcal?: number;
  notes?: string;
}
