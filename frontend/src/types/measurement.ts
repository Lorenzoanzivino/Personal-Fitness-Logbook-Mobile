export interface BodyMeasurement {
  id: number;
  date: string; // ISO-8601 YYYY-MM-DDTHH:mm
  weight: number;
  recorded_at: string; // Backward-compatible alias
  weight_kg: number; // Backward-compatible alias
  weight_delta_kg?: number | null;
  bmi?: number | null;
  body_fat_percentage?: number | null;
  body_fat_pct?: number | null;
  muscle_mass_kg?: number | null;
  bmr?: number | null;
  bmr_kcal?: number | null;
  water_percentage?: number | null;
  water_pct?: number | null;
  fat_mass_kg?: number | null;
  lean_mass_kg?: number | null;
  bone_mass_kg?: number | null;
  visceral_fat?: number | null;
  protein_percentage?: number | null;
  skeletal_muscle_mass_kg?: number | null;
  subcutaneous_fat_percentage?: number | null;
  amr_kcal?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  owner_id?: string;
}

export interface CreateBodyMeasurementDto {
  date?: string;
  weight?: number;
  recorded_at?: string;
  weight_kg?: number;
  bmi?: number | null;
  body_fat_percentage?: number | null;
  body_fat_pct?: number | null;
  muscle_mass_kg?: number | null;
  bmr?: number | null;
  bmr_kcal?: number | null;
  water_percentage?: number | null;
  water_pct?: number | null;
  fat_mass_kg?: number | null;
  lean_mass_kg?: number | null;
  bone_mass_kg?: number | null;
  visceral_fat?: number | null;
  protein_percentage?: number | null;
  skeletal_muscle_mass_kg?: number | null;
  subcutaneous_fat_percentage?: number | null;
  amr_kcal?: number | null;
  notes?: string | null;
}

