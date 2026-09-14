import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  Exercise,
  WorkoutRoutine,
  Workout,
  MuscleGroup,
  ExerciseType,
  RoutineFolder,
  SetDropStep,
} from '../types/workout';
import { UserProfile, UserRole, ClientAssociation } from '../types/profile';
import { gymStorage } from '../services/gymStorage';
import { profileService } from '../services/profileService';

interface ProgressionHistoryPoint {
  date: string;
  workoutName: string;
  maxWeightKg: number;
  totalVolumeKg: number;
  maxTimeSeconds?: number;
}

interface ExerciseProgression {
  exerciseId: number;
  prWeightKg: number;
  maxVolumeKg: number;
  maxTimeSeconds: number;
  lastPerformed: string | null;
  history: ProgressionHistoryPoint[];
}

interface LastPerformance {
  date: string;
  workoutName: string;
  maxWeightKg: number;
  maxTimeSeconds?: number;
  setsSummary: string;
}

export interface PreviousPerformanceDetails {
  date: string;
  workoutName: string;
  sets: Array<{
    weight_kg: number;
    reps: number;
    time_seconds?: number | null;
    rpe?: number | null;
    band_assistance?: string | null;
    drops?: SetDropStep[];
  }>;
}

interface GymContextType {
  exercises: Exercise[];
  routines: WorkoutRoutine[];
  allRoutines: WorkoutRoutine[];
  workouts: Workout[];
  folders: RoutineFolder[];
  allFolders: RoutineFolder[];
  loading: boolean;

  // RBAC & Delegation State
  userRole: UserRole;
  userProfile: UserProfile;
  selectedClient: ClientAssociation | null;
  setSelectedClient: (client: ClientAssociation | null) => void;
  activeOwnerId: string;
  isDelegatedMode: boolean;

  // Exercise actions
  addExercise: (data: {
    name: string;
    muscle_group: MuscleGroup;
    exercise_type: ExerciseType;
    notes?: string;
    description?: string;
    video_url?: string;
  }) => Promise<Exercise>;
  updateExercise: (id: number, data: Partial<Exercise>) => Promise<void>;
  archiveExercise: (id: number) => Promise<void>;
  restoreDefaultExercises: () => Promise<void>;

  // Routine actions
  addRoutine: (data: Omit<WorkoutRoutine, 'id' | 'created_at' | 'updated_at'>) => Promise<WorkoutRoutine>;
  updateRoutine: (id: number, data: Partial<WorkoutRoutine>) => Promise<void>;
  deleteRoutine: (id: number) => Promise<void>;
  deleteMultipleRoutines: (ids: number[]) => Promise<void>;
  clearAllRoutines: () => Promise<void>;
  restoreDefaultRoutines: () => Promise<void>;

  // Folder actions
  addFolder: (name: string) => Promise<RoutineFolder>;
  updateFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  deleteMultipleFolders: (ids: string[]) => Promise<void>;
  clearAllFolders: () => Promise<void>;

  // Workout actions
  saveWorkout: (data: Omit<Workout, 'id' | 'created_at' | 'updated_at'>) => Promise<Workout>;
  deleteWorkout: (id: number) => Promise<void>;
  deleteMultipleWorkouts: (ids: number[]) => Promise<void>;
  clearAllWorkouts: () => Promise<void>;

  // Global actions
  resetEntireApp: () => Promise<void>;

  // Progression & Overload helpers
  getLastPerformance: (exerciseId: number) => LastPerformance | null;
  getPreviousPerformanceForExercise: (exerciseId: number) => PreviousPerformanceDetails | null;
  getExerciseProgression: (exerciseId: number) => ExerciseProgression;
  calculateSetVolume: (
    weightKg: number,
    reps: number,
    setType?: string,
    exerciseType?: string,
    dropsetWeightKg?: number | null,
    drops?: SetDropStep[]
  ) => number;
  calculateTotalVolume: (
    sets: Array<{
      weight_kg: number;
      reps: number;
      set_type?: string;
      completed?: boolean;
      exercise_type?: string;
      dropset_weight_kg?: number | null;
      drops?: SetDropStep[];
    }>
  ) => number;
  calculateTotalTimeSeconds: (
    sets: Array<{
      time_seconds?: number | null;
      completed?: boolean;
    }>
  ) => number;
}

const GymContext = createContext<GymContextType | undefined>(undefined);

export const GymProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [folders, setFolders] = useState<RoutineFolder[]>([]);
  const [loading, setLoading] = useState(true);

  // RBAC & Delegation State
  const [userProfile, setUserProfile] = useState<UserProfile>(profileService.getCurrentProfile());
  const [selectedClient, setSelectedClient] = useState<ClientAssociation | null>(null);

  useEffect(() => {
    const unsub = profileService.subscribe((p) => {
      setUserProfile(p);
      if (p.role === 'CLIENT') {
        setSelectedClient(null);
      }
    });
    return () => unsub();
  }, []);

  const userRole: UserRole = userProfile.role;
  const isDelegatedMode = Boolean(userRole === 'TRAINER' && selectedClient !== null);

  const activeOwnerId: string =
    userRole === 'CLIENT'
      ? String(userProfile.id || 'client-simona-1')
      : selectedClient
      ? selectedClient.id
      : String(userProfile.id || 'trainer-marco-1');

  // Filter routines by active context (RBAC & Delega)
  const filteredRoutines = routines.filter((r) => {
    if (userRole === 'TRAINER') {
      if (selectedClient) {
        return r.owner_id === selectedClient.id;
      }
      return !r.owner_id || r.owner_id === 'trainer-marco-1' || r.owner_id === userProfile.id;
    } else {
      return (
        r.owner_id === activeOwnerId ||
        r.owner_id === 'client-simona-1' ||
        r.owner_id === userProfile.id
      );
    }
  });

  // Filter folders by active context
  const filteredFolders = folders.filter((f) => {
    if (userRole === 'TRAINER') {
      if (selectedClient) {
        return f.owner_id === selectedClient.id;
      }
      return !f.owner_id || f.owner_id === 'trainer-marco-1' || f.owner_id === userProfile.id;
    } else {
      return (
        !f.owner_id ||
        f.owner_id === activeOwnerId ||
        f.owner_id === 'client-simona-1' ||
        f.owner_id === userProfile.id
      );
    }
  });

  useEffect(() => {
    loadAllGymData();
  }, []);

  const loadAllGymData = async () => {
    setLoading(true);
    try {
      const [exList, routList, workList, foldList] = await Promise.all([
        gymStorage.loadExercises(),
        gymStorage.loadRoutines(),
        gymStorage.loadWorkouts(),
        gymStorage.loadFolders(),
      ]);
      setExercises(exList);
      setRoutines(routList);
      setWorkouts(workList);
      setFolders(foldList);
    } catch (err) {
      console.warn('Errore caricamento dati Gym:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- CALCULATION FORMULAS (Rigorous from APP_SPEC Section 4.1 & FASE 2C) ---
  const calculateSetVolume = (
    weightKg: number,
    reps: number,
    setType = 'normal',
    exerciseType = 'reps',
    dropsetWeightKg?: number | null,
    drops?: SetDropStep[]
  ): number => {
    // Le serie warmup sono conteggiate a 0 per non inquinare il tonnellaggio effettivo
    if (setType === 'warmup') return 0;
    // Per esercizi 'time' (isometria pura come Plank) il tonnellaggio mosso è 0
    if (exerciseType === 'time') return 0;

    // Se ci sono drops dinamici (stripping / rest-pause con array dinamico di drop)
    if (drops && drops.length > 0) {
      return drops.reduce((sum, d) => {
        if (d.kg > 0 && d.reps > 0) {
          return sum + d.kg * d.reps;
        }
        return sum;
      }, 0);
    }

    let setVol = 0;
    if (weightKg > 0 && reps > 0) {
      setVol += weightKg * reps;
    }

    // Se è una serie Stripping / Dropset con carico scalato legacy
    if (setType === 'dropset' && dropsetWeightKg && dropsetWeightKg > 0 && reps > 0) {
      setVol += dropsetWeightKg * reps;
    }

    return setVol;
  };

  const calculateTotalVolume = (
    sets: Array<{
      weight_kg: number;
      reps: number;
      set_type?: string;
      completed?: boolean;
      exercise_type?: string;
      dropset_weight_kg?: number | null;
      drops?: SetDropStep[];
    }>
  ): number => {
    return sets.reduce((total, set) => {
      if (set.completed === false) return total;
      return (
        total +
        calculateSetVolume(
          set.weight_kg,
          set.reps,
          set.set_type,
          set.exercise_type,
          set.dropset_weight_kg,
          set.drops
        )
      );
    }, 0);
  };
  const calculateTotalTimeSeconds = (
    sets: Array<{
      time_seconds?: number | null;
      completed?: boolean;
    }>
  ): number => {
    return sets.reduce((total, set) => {
      if (set.completed === false) return total;
      return total + (set.time_seconds || 0);
    }, 0);
  };

  // --- EXERCISE ACTIONS ---
  const addExercise = async (data: {
    name: string;
    muscle_group: MuscleGroup;
    exercise_type: ExerciseType;
    notes?: string;
    description?: string;
    video_url?: string;
  }): Promise<Exercise> => {
    const newId = exercises.length > 0 ? Math.max(...exercises.map((e) => e.id)) + 1 : 1;
    const newExercise: Exercise = {
      id: newId,
      name: data.name.trim(),
      muscle_group: data.muscle_group,
      exercise_type: data.exercise_type,
      is_archived: 0,
      notes: data.notes?.trim() || null,
      description: data.description?.trim() || null,
      video_url: data.video_url?.trim() || null,
      created_at: new Date().toISOString(),
    };
    const updated = [newExercise, ...exercises];
    setExercises(updated);
    await gymStorage.saveExercises(updated);
    return newExercise;
  };

  const updateExercise = async (id: number, data: Partial<Exercise>): Promise<void> => {
    const updated = exercises.map((ex) => (ex.id === id ? { ...ex, ...data } : ex));
    setExercises(updated);
    await gymStorage.saveExercises(updated);
  };

  const archiveExercise = async (id: number): Promise<void> => {
    const updated = exercises.map((ex) =>
      ex.id === id ? { ...ex, is_archived: ex.is_archived === 1 ? 0 : 1 } : ex
    );
    setExercises(updated);
    await gymStorage.saveExercises(updated);
  };

  const restoreDefaultExercises = async (): Promise<void> => {
    const restored = await gymStorage.resetDefaultExercises();
    setExercises(restored);
  };

  // --- ROUTINE ACTIONS ---
  const addRoutine = async (
    data: Omit<WorkoutRoutine, 'id' | 'created_at' | 'updated_at'>
  ): Promise<WorkoutRoutine> => {
    const trimmedName = data.name.trim();
    const targetOwnerId = data.owner_id || activeOwnerId;
    const duplicate = routines.find(
      (r) =>
        (r.owner_id || 'trainer-marco-1') === targetOwnerId &&
        r.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`Esiste già una scheda con il nome "${trimmedName}". Scegli un nome diverso.`);
    }

    const newId = routines.length > 0 ? Math.max(...routines.map((r) => r.id)) + 1 : 1;
    const now = new Date().toISOString();
    const newRoutine: WorkoutRoutine = {
      ...data,
      name: trimmedName,
      id: newId,
      owner_id: targetOwnerId,
      created_at: now,
      updated_at: now,
    };
    const updated = [newRoutine, ...routines];
    setRoutines(updated);
    await gymStorage.saveRoutines(updated);
    return newRoutine;
  };

  const updateRoutine = async (id: number, data: Partial<WorkoutRoutine>): Promise<void> => {
    if (data.name) {
      const trimmedName = data.name.trim();
      const duplicate = routines.find(
        (r) => r.id !== id && r.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicate) {
        throw new Error(`Esiste già una scheda con il nome "${trimmedName}". Scegli un nome diverso.`);
      }
    }

    const now = new Date().toISOString();
    const updated = routines.map((r) => (r.id === id ? { ...r, ...data, updated_at: now } : r));
    setRoutines(updated);
    await gymStorage.saveRoutines(updated);
  };

  const deleteRoutine = async (id: number): Promise<void> => {
    const updated = routines.filter((r) => r.id !== id);
    setRoutines(updated);
    await gymStorage.saveRoutines(updated);
  };

  const deleteMultipleRoutines = async (ids: number[]): Promise<void> => {
    const idSet = new Set(ids);
    const updated = routines.filter((r) => !idSet.has(r.id));
    setRoutines(updated);
    await gymStorage.saveRoutines(updated);
  };

  const clearAllRoutines = async (): Promise<void> => {
    setRoutines([]);
    await gymStorage.saveRoutines([]);
  };

  const restoreDefaultRoutines = async (): Promise<void> => {
    const [restoredRout, restoredFold] = await Promise.all([
      gymStorage.resetDefaultRoutines(),
      gymStorage.resetDefaultFolders(),
    ]);
    setRoutines(restoredRout);
    setFolders(restoredFold);
  };

  // --- FOLDER ACTIONS ---
  const addFolder = async (name: string): Promise<RoutineFolder> => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Il nome della cartella non può essere vuoto.');
    const existing = folders.find(
      (f) =>
        (f.owner_id || 'trainer-marco-1') === activeOwnerId &&
        f.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) return existing;

    const newFolder: RoutineFolder = {
      id: `folder-${Date.now()}`,
      name: trimmed,
      owner_id: activeOwnerId,
      created_at: new Date().toISOString(),
    };
    const updated = [...folders, newFolder];
    setFolders(updated);
    await gymStorage.saveFolders(updated);
    return newFolder;
  };

  const updateFolder = async (id: string, name: string): Promise<void> => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Il nome della cartella non può essere vuoto.');
    const updated = folders.map((f) => (f.id === id ? { ...f, name: trimmed } : f));
    setFolders(updated);
    await gymStorage.saveFolders(updated);

    // Aggiorna anche il nome della cartella nelle schede che vi appartengono
    const updatedRoutines = routines.map((r) =>
      r.folder_id === id ? { ...r, folder_name: trimmed } : r
    );
    setRoutines(updatedRoutines);
    await gymStorage.saveRoutines(updatedRoutines);
  };

  const deleteFolder = async (id: string): Promise<void> => {
    const updated = folders.filter((f) => f.id !== id);
    setFolders(updated);
    await gymStorage.saveFolders(updated);

    // Rimuove l'associazione alla cartella dalle schede, senza cancellarle
    const updatedRoutines = routines.map((r) =>
      r.folder_id === id ? { ...r, folder_id: null, folder_name: null } : r
    );
    setRoutines(updatedRoutines);
    await gymStorage.saveRoutines(updatedRoutines);
  };

  const deleteMultipleFolders = async (ids: string[]): Promise<void> => {
    const idSet = new Set(ids);
    const updated = folders.filter((f) => !idSet.has(f.id));
    setFolders(updated);
    await gymStorage.saveFolders(updated);

    const updatedRoutines = routines.map((r) =>
      r.folder_id && idSet.has(r.folder_id)
        ? { ...r, folder_id: null, folder_name: null }
        : r
    );
    setRoutines(updatedRoutines);
    await gymStorage.saveRoutines(updatedRoutines);
  };

  const clearAllFolders = async (): Promise<void> => {
    setFolders([]);
    await gymStorage.saveFolders([]);

    // Rimuove l'associazione per tutte le schede, conservandole intatte in 'Tutte'
    const updatedRoutines = routines.map((r) => ({
      ...r,
      folder_id: null,
      folder_name: null,
    }));
    setRoutines(updatedRoutines);
    await gymStorage.saveRoutines(updatedRoutines);
  };

  // --- WORKOUT ACTIONS ---
  const saveWorkout = async (
    data: Omit<Workout, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Workout> => {
    const newId = workouts.length > 0 ? Math.max(...workouts.map((w) => w.id)) + 1 : 1;
    const now = new Date().toISOString();
    const newWorkout: Workout = {
      ...data,
      id: newId,
      created_at: now,
      updated_at: now,
    };
    const updated = [newWorkout, ...workouts];
    setWorkouts(updated);
    await gymStorage.saveWorkouts(updated);
    return newWorkout;
  };

  const deleteWorkout = async (id: number): Promise<void> => {
    const updated = workouts.filter((w) => w.id !== id);
    setWorkouts(updated);
    await gymStorage.saveWorkouts(updated);
  };

  const deleteMultipleWorkouts = async (ids: number[]): Promise<void> => {
    const idSet = new Set(ids);
    const updated = workouts.filter((w) => !idSet.has(w.id));
    setWorkouts(updated);
    await gymStorage.saveWorkouts(updated);
  };

  const clearAllWorkouts = async (): Promise<void> => {
    setWorkouts([]);
    await gymStorage.saveWorkouts([]);
  };

  // --- GLOBAL RESET ---
  const resetEntireApp = async (): Promise<void> => {
    await gymStorage.clearAllData();
    profileService.resetProfile();
    setRoutines([]);
    setWorkouts([]);
    setFolders([]);
    const defaultEx = await gymStorage.resetDefaultExercises();
    setExercises(defaultEx);
  };

  // --- PROGRESSION & OVERLOAD HELPERS ---
  const getLastPerformance = (exerciseId: number): LastPerformance | null => {
    const sorted = [...workouts].sort((a, b) => (b.date > a.date ? 1 : -1));

    for (const w of sorted) {
      if (!w.exercises) continue;
      const found = w.exercises.find((e) => e.exercise_id === exerciseId);
      if (found && found.sets.length > 0) {
        const completedSets = found.sets.filter(
          (s) => s.completed !== false && s.set_type !== 'warmup'
        );
        if (completedSets.length === 0) continue;

        const maxWeight = Math.max(...completedSets.map((s) => s.weight_kg));
        const maxTime = Math.max(...completedSets.map((s) => s.time_seconds || 0));

        const exInfo = exercises.find((e) => e.id === exerciseId);
        let summary = '';
        if (exInfo?.exercise_type === 'time') {
          summary = completedSets.map((s) => `${s.time_seconds || 0}s`).join(', ');
        } else {
          summary = completedSets.map((s) => `${s.weight_kg}kg×${s.reps}`).join(', ');
        }

        return {
          date: w.date,
          workoutName: w.name,
          maxWeightKg: maxWeight,
          maxTimeSeconds: maxTime,
          setsSummary: summary,
        };
      }
    }
    return null;
  };

  const getPreviousPerformanceForExercise = (
    exerciseId: number
  ): PreviousPerformanceDetails | null => {
    const sorted = [...workouts].sort((a, b) => (b.date > a.date ? 1 : -1));

    for (const w of sorted) {
      if (!w.exercises) continue;
      const found = w.exercises.find((e) => e.exercise_id === exerciseId);
      if (found && found.sets.length > 0) {
        return {
          date: w.date,
          workoutName: w.name,
          sets: found.sets,
        };
      }
    }
    return null;
  };

  const getExerciseProgression = (exerciseId: number): ExerciseProgression => {
    let prWeightKg = 0;
    let maxVolumeKg = 0;
    let maxTimeSeconds = 0;
    let lastPerformed: string | null = null;
    const history: ProgressionHistoryPoint[] = [];

    const sorted = [...workouts].sort((a, b) => (a.date > b.date ? 1 : -1));

    const exInfo = exercises.find((e) => e.id === exerciseId);
    const exType = exInfo?.exercise_type || 'reps';

    for (const w of sorted) {
      if (!w.exercises) continue;
      const found = w.exercises.find((e) => e.exercise_id === exerciseId);
      if (found && found.sets.length > 0) {
        const validSets = found.sets.filter(
          (s) => s.completed !== false && s.set_type !== 'warmup'
        );
        if (validSets.length === 0) continue;

        const sessionMaxWeight = Math.max(...validSets.map((s) => s.weight_kg));
        const sessionMaxTime = Math.max(...validSets.map((s) => s.time_seconds || 0));
        const sessionVolume = validSets.reduce((sum, s) => {
          return (
            sum +
            calculateSetVolume(
              s.weight_kg,
              s.reps,
              s.set_type,
              exType,
              s.dropset_weight_kg,
              s.drops
            )
          );
        }, 0);

        if (sessionMaxWeight > prWeightKg) prWeightKg = sessionMaxWeight;
        if (sessionVolume > maxVolumeKg) maxVolumeKg = sessionVolume;
        if (sessionMaxTime > maxTimeSeconds) maxTimeSeconds = sessionMaxTime;
        lastPerformed = w.date;

        history.push({
          date: w.date,
          workoutName: w.name,
          maxWeightKg: sessionMaxWeight,
          maxTimeSeconds: sessionMaxTime,
          totalVolumeKg: sessionVolume,
        });
      }
    }

    return {
      exerciseId,
      prWeightKg,
      maxVolumeKg,
      maxTimeSeconds,
      lastPerformed,
      history: history.reverse(),
    };
  };

  return (
    <GymContext.Provider
      value={{
        exercises,
        routines: filteredRoutines,
        allRoutines: routines,
        workouts,
        folders: filteredFolders,
        allFolders: folders,
        loading,
        userRole,
        userProfile,
        selectedClient,
        setSelectedClient,
        activeOwnerId,
        isDelegatedMode,
        addExercise,
        updateExercise,
        archiveExercise,
        restoreDefaultExercises,
        addRoutine,
        updateRoutine,
        deleteRoutine,
        deleteMultipleRoutines,
        clearAllRoutines,
        restoreDefaultRoutines,
        addFolder,
        updateFolder,
        deleteFolder,
        deleteMultipleFolders,
        clearAllFolders,
        saveWorkout,
        deleteWorkout,
        deleteMultipleWorkouts,
        clearAllWorkouts,
        resetEntireApp,
        getLastPerformance,
        getPreviousPerformanceForExercise,
        getExerciseProgression,
        calculateSetVolume,
        calculateTotalVolume,
        calculateTotalTimeSeconds,
      }}
    >
      {children}
    </GymContext.Provider>
  );
};

export const useGym = (): GymContextType => {
  const context = useContext(GymContext);
  if (!context) {
    throw new Error('useGym deve essere usato all\'interno di un GymProvider');
  }
  return context;
};
