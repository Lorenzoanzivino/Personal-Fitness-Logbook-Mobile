import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export const STORAGE_KEYS = {
  PROFILE: '@user_profile_v3',
  PROVISIONED_CLIENTS: '@fitness_provisioned_clients_v2',
  ROUTINES: '@gym_routines_v3',
  WORKOUTS: '@gym_workouts_v3',
  FOLDERS: '@gym_folders_v3',
  EXERCISES: '@gym_exercises_v2',
  MEASUREMENTS: '@measurements_v3',
  DIETS: '@diets_v3',
} as const;

export interface FullBackupPayload {
  schemaVersion: number;
  exportDate: string;
  exportedAt: string;
  appName: string;
  profile: any | null;
  provisionedClients: any[];
  routines: any[];
  workouts: any[];
  folders: any[];
  exercises: any[];
  measurements: any[];
  diets: any[];
  data: {
    profile: any | null;
    provisionedClients: any[];
    routines: any[];
    workouts: any[];
    folders: any[];
    exercises: any[];
    measurements: any[];
    diets: any[];
  };
  stats: {
    routinesCount: number;
    workoutsCount: number;
    foldersCount: number;
    exercisesCount: number;
    measurementsCount: number;
    dietsCount: number;
    clientsCount: number;
  };
}

/**
 * Lettura sicura e read-only da AsyncStorage.
 * Non esegue scritture o mutazioni dello stato locale.
 */
async function safeGetParsed<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[backupService] Impossibile analizzare chiave "${key}":`, err);
    return fallback;
  }
}

/**
 * Raccoglie tutti i dati operativi in un unico oggetto JSON consolidato.
 * Operazione strettamente di lettura (read-only).
 */
export async function exportFullBackup(): Promise<string> {
  const [
    profile,
    provisionedClients,
    routines,
    workouts,
    folders,
    exercises,
    measurements,
    diets,
  ] = await Promise.all([
    safeGetParsed<any | null>(STORAGE_KEYS.PROFILE, null),
    safeGetParsed<any[]>(STORAGE_KEYS.PROVISIONED_CLIENTS, []),
    safeGetParsed<any[]>(STORAGE_KEYS.ROUTINES, []),
    safeGetParsed<any[]>(STORAGE_KEYS.WORKOUTS, []),
    safeGetParsed<any[]>(STORAGE_KEYS.FOLDERS, []),
    safeGetParsed<any[]>(STORAGE_KEYS.EXERCISES, []),
    safeGetParsed<any[]>(STORAGE_KEYS.MEASUREMENTS, []),
    safeGetParsed<any[]>(STORAGE_KEYS.DIETS, []),
  ]);

  const nowIso = new Date().toISOString();

  const entityData = {
    profile,
    provisionedClients,
    routines,
    workouts,
    folders,
    exercises,
    measurements,
    diets,
  };

  const backupPayload: FullBackupPayload = {
    schemaVersion: 3,
    exportDate: nowIso,
    exportedAt: nowIso,
    appName: 'MyTrainUp',
    ...entityData,
    data: entityData,
    stats: {
      routinesCount: routines.length,
      workoutsCount: workouts.length,
      foldersCount: folders.length,
      exercisesCount: exercises.length,
      measurementsCount: measurements.length,
      dietsCount: diets.length,
      clientsCount: provisionedClients.length,
    },
  };

  return JSON.stringify(backupPayload, null, 2);
}

/**
 * Condivisione o download del file JSON:
 * - Su Web: download programmatico tramite Blob e anchor link
 * - Su Mobile: salvataggio su file temporaneo in cache e Sharing.shareAsync
 */
export async function shareBackupFile(jsonString: string): Promise<void> {
  const timestamp = Date.now();
  const fileName = `mytrainup_backup_${timestamp}.json`;

  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    return;
  }

  // Mobile (Android / iOS) con Expo SDK 57 FileSystem API
  const file = new File(Paths.cache, fileName);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(jsonString);

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('La condivisione file non è supportata su questo dispositivo.');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Condividi Backup Completo MyTrainUp',
    UTI: 'public.json',
  });
}
