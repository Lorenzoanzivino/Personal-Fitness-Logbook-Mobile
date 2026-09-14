export type MuscleGroup =
  | 'Petto'
  | 'Dorso'
  | 'Spalle'
  | 'Bicipiti'
  | 'Tricipiti'
  | 'Quadricipiti'
  | 'Femorali'
  | 'Polpacci'
  | 'Addome';

export type ExerciseType = 'reps' | 'time' | 'bodyweight';

export type SetType = 'normal' | 'warmup' | 'dropset' | 'rest_pause';

export type BandAssistance = 'none' | 'light' | 'medium' | 'heavy' | 'weighted';

export interface RoutineFolder {
  id: string;
  name: string;
  created_at: string;
  owner_id?: string;
}

export interface SetDropStep {
  id?: string;
  kg: number;
  reps: number;
  rest_seconds?: number;
}

export interface Exercise {
  id: number;
  name: string;
  muscle_group: MuscleGroup;
  exercise_type: ExerciseType;
  description?: string | null;
  video_url?: string | null;
  is_archived: number;
  notes?: string | null;
  created_at: string;
}

export interface ExerciseSet {
  id?: number;
  workout_exercise_id?: number;
  set_number: number;
  set_type: SetType;
  weight_kg: number;
  reps: number;
  time_seconds?: number | null;
  band_assistance?: BandAssistance;
  dropset_weight_kg?: number | null;
  drops?: SetDropStep[];
  rest_seconds?: number | null;
  rpe?: number | null;
  notes?: string | null;
  completed?: boolean;
}

export interface WorkoutExercise {
  id?: number;
  workout_id?: number;
  exercise_id: number;
  exercise_order: number;
  superset_group?: string | null;
  notes?: string | null;
  exercise?: Exercise;
  sets: ExerciseSet[];
}

export interface Workout {
  id: number;
  date: string; // YYYY-MM-DD
  name: string;
  duration_minutes?: number | null;
  workout_type?: string | null;
  notes?: string | null;
  routine_id?: number | null;
  week_number?: number | null;
  created_at: string;
  updated_at: string;
  exercises?: WorkoutExercise[];
  owner_id?: string;
}

export interface RoutineExerciseSet {
  id?: number;
  routine_exercise_id?: number;
  set_number: number;
  set_type: SetType;
  target_weight_kg: number;
  target_reps: number;
  target_time_seconds?: number | null;
  band_assistance?: BandAssistance;
  dropset_weight_kg?: number | null;
  drops?: SetDropStep[];
  rest_seconds: number;
  notes?: string | null;
}

export interface RoutineExercise {
  id?: number;
  routine_id?: number;
  exercise_id: number;
  exercise_order: number;
  superset_group?: string | null;
  custom_description?: string | null;
  custom_video_url?: string | null;
  notes?: string | null;
  exercise?: Exercise;
  sets: RoutineExerciseSet[];
}

export interface WorkoutRoutine {
  id: number;
  folder_id?: string | null;
  folder_name?: string | null;
  border_color?: string;
  name: string;
  description?: string | null;
  workout_type?: string | null;
  duration_weeks: number;
  created_at: string;
  updated_at: string;
  exercises?: RoutineExercise[];
  owner_id?: string;
}
