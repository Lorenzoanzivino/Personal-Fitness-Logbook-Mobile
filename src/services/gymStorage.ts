import AsyncStorage from '@react-native-async-storage/async-storage';
import { Exercise, WorkoutRoutine, Workout, RoutineFolder } from '../types/workout';
import { DEFAULT_EXERCISES } from '../data/defaultExercises';
import { DEFAULT_ROUTINES, DEFAULT_WORKOUTS } from '../data/defaultRoutines';

export const DEFAULT_FOLDERS: RoutineFolder[] = [];

const STORAGE_KEYS = {
  EXERCISES: '@gym_exercises_v2',
  ROUTINES: '@gym_routines_v2',
  WORKOUTS: '@gym_workouts_v2',
  FOLDERS: '@gym_folders_v2',
};

export const gymStorage = {
  // --- EXERCISES ---
  async loadExercises(): Promise<Exercise[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.EXERCISES);
      if (data) {
        return JSON.parse(data);
      }
      // Auto-seed iniziale dei 46 esercizi
      await AsyncStorage.setItem(
        STORAGE_KEYS.EXERCISES,
        JSON.stringify(DEFAULT_EXERCISES)
      );
      return DEFAULT_EXERCISES;
    } catch (e) {
      console.warn('Errore lettura esercizi da AsyncStorage:', e);
      return DEFAULT_EXERCISES;
    }
  },

  async saveExercises(exercises: Exercise[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.EXERCISES,
        JSON.stringify(exercises)
      );
    } catch (e) {
      console.warn('Errore salvataggio esercizi su AsyncStorage:', e);
    }
  },

  async resetDefaultExercises(): Promise<Exercise[]> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.EXERCISES,
        JSON.stringify(DEFAULT_EXERCISES)
      );
      return DEFAULT_EXERCISES;
    } catch (e) {
      console.warn('Errore ripristino catalogo esercizi:', e);
      return DEFAULT_EXERCISES;
    }
  },

  // --- ROUTINES ---
  async loadRoutines(): Promise<WorkoutRoutine[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ROUTINES);
      if (data) {
        return JSON.parse(data);
      }
      await AsyncStorage.setItem(
        STORAGE_KEYS.ROUTINES,
        JSON.stringify(DEFAULT_ROUTINES)
      );
      return DEFAULT_ROUTINES;
    } catch (e) {
      console.warn('Errore lettura schede da AsyncStorage:', e);
      return DEFAULT_ROUTINES;
    }
  },

  async saveRoutines(routines: WorkoutRoutine[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.ROUTINES,
        JSON.stringify(routines)
      );
    } catch (e) {
      console.warn('Errore salvataggio schede su AsyncStorage:', e);
    }
  },

  async resetDefaultRoutines(): Promise<WorkoutRoutine[]> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.ROUTINES,
        JSON.stringify(DEFAULT_ROUTINES)
      );
      return DEFAULT_ROUTINES;
    } catch (e) {
      console.warn('Errore ripristino schede:', e);
      return DEFAULT_ROUTINES;
    }
  },

  // --- WORKOUTS ---
  async loadWorkouts(): Promise<Workout[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.WORKOUTS);
      if (data) {
        return JSON.parse(data);
      }
      await AsyncStorage.setItem(
        STORAGE_KEYS.WORKOUTS,
        JSON.stringify(DEFAULT_WORKOUTS)
      );
      return DEFAULT_WORKOUTS;
    } catch (e) {
      console.warn('Errore lettura workout da AsyncStorage:', e);
      return DEFAULT_WORKOUTS;
    }
  },

  async saveWorkouts(workouts: Workout[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.WORKOUTS,
        JSON.stringify(workouts)
      );
    } catch (e) {
      console.warn('Errore salvataggio workout su AsyncStorage:', e);
    }
  },

  // --- FOLDERS ---
  async loadFolders(): Promise<RoutineFolder[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.FOLDERS);
      if (data) {
        return JSON.parse(data);
      }
      await AsyncStorage.setItem(
        STORAGE_KEYS.FOLDERS,
        JSON.stringify(DEFAULT_FOLDERS)
      );
      return DEFAULT_FOLDERS;
    } catch (e) {
      console.warn('Errore lettura cartelle da AsyncStorage:', e);
      return DEFAULT_FOLDERS;
    }
  },

  async saveFolders(folders: RoutineFolder[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.FOLDERS,
        JSON.stringify(folders)
      );
    } catch (e) {
      console.warn('Errore salvataggio cartelle su AsyncStorage:', e);
    }
  },

  async resetDefaultFolders(): Promise<RoutineFolder[]> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.FOLDERS,
        JSON.stringify(DEFAULT_FOLDERS)
      );
      return DEFAULT_FOLDERS;
    } catch (e) {
      console.warn('Errore ripristino cartelle:', e);
      return DEFAULT_FOLDERS;
    }
  },

  async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.EXERCISES,
        STORAGE_KEYS.ROUTINES,
        STORAGE_KEYS.WORKOUTS,
        STORAGE_KEYS.FOLDERS,
        '@measurements_v2',
        '@diets_v2',
        '@user_profile_v1',
      ]);
    } catch (e) {
      console.warn('Errore pulizia totale dati da AsyncStorage:', e);
    }
  },
};
