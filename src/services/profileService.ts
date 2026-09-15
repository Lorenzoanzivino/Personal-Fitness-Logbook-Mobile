import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './api';
import { gymStorage } from './gymStorage';
import { TRAINER_CONFIG } from './config';
import {
  UserProfile,
  UserRole,
  ClientAssociation,
  UpdateProfileRequestDto,
  ProfileResponseDto,
} from '../types/profile';

const STORAGE_KEY_PROFILE = '@user_profile_v3';

const DEFAULT_TRAINER_CLIENTS: ClientAssociation[] = [];

const INITIAL_PROFILE: UserProfile = {
  id: 'trainer-1',
  first_name: TRAINER_CONFIG.firstName,
  last_name: TRAINER_CONFIG.lastName,
  birth_date: '01-01-1995',
  height_cm: 180,
  avatar_url: null,
  role: 'TRAINER',
  email: TRAINER_CONFIG.email,
  clients: [],
  trainer_id: undefined,
  trainer_name: undefined,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

let currentProfileState: UserProfile = { ...INITIAL_PROFILE };

type ProfileListener = (profile: UserProfile) => void;
const listeners: Set<ProfileListener> = new Set();

const notifyListeners = () => {
  listeners.forEach((listener) => {
    try {
      listener({ ...currentProfileState });
    } catch (e) {
      console.warn('Listener notification error:', e);
    }
  });
};

const persistProfileState = async (profile: UserProfile) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
  } catch (e) {
    console.warn('Errore salvataggio profilo in AsyncStorage:', e);
  }
};

// Caricamento iniziale asincrono
AsyncStorage.getItem(STORAGE_KEY_PROFILE)
  .then((data) => {
    if (data) {
      const parsed = JSON.parse(data);
      currentProfileState = {
        ...INITIAL_PROFILE,
        ...parsed,
        clients: parsed.clients || DEFAULT_TRAINER_CLIENTS,
      };
      notifyListeners();
    }
  })
  .catch(() => {});

export const profileService = {
  /**
   * Recupera il profilo utente corrente in cache
   */
  getCurrentProfile(): UserProfile {
    return { ...currentProfileState };
  },

  /**
   * Sottoscrizione alle modifiche del profilo
   */
  subscribe(listener: ProfileListener): () => void {
    listeners.add(listener);
    listener({ ...currentProfileState });
    return () => {
      listeners.delete(listener);
    };
  },

  /**
   * Recupera il profilo utente (GET /api/v1/profile)
   */
  async getProfile(): Promise<ProfileResponseDto> {
    const res = await apiService.get<UserProfile>('/api/v1/profile');
    if (res.success && res.data) {
      currentProfileState = { ...res.data };
      await persistProfileState(currentProfileState);
      notifyListeners();
      return res;
    }

    notifyListeners();
    return {
      success: true,
      data: { ...currentProfileState },
      error: null,
    };
  },

  /**
   * Aggiorna il profilo utente (PUT /api/v1/profile)
   */
  async updateProfile(dto: UpdateProfileRequestDto): Promise<ProfileResponseDto> {
    const res = await apiService.put<UserProfile>('/api/v1/profile', dto);
    if (res.success && res.data) {
      currentProfileState = { ...res.data };
      await persistProfileState(currentProfileState);
      notifyListeners();
      return res;
    }

    currentProfileState = {
      ...currentProfileState,
      ...dto,
      updated_at: new Date().toISOString(),
    };
    await persistProfileState(currentProfileState);
    notifyListeners();

    return {
      success: true,
      data: { ...currentProfileState },
      error: null,
    };
  },

  /**
   * Cambia il ruolo attivo (TRAINER <-> CLIENT)
   */
  async switchRole(newRole: UserRole): Promise<UserProfile> {
    currentProfileState = {
      ...currentProfileState,
      role: newRole,
      updated_at: new Date().toISOString(),
    };
    await persistProfileState(currentProfileState);
    notifyListeners();
    return { ...currentProfileState };
  },

  /**
   * Collega un Trainer all'account Cliente
   */
  async linkToTrainer(trainerId: string, trainerName: string): Promise<UserProfile> {
    currentProfileState = {
      ...currentProfileState,
      trainer_id: trainerId,
      trainer_name: trainerName,
      updated_at: new Date().toISOString(),
    };
    await persistProfileState(currentProfileState);
    notifyListeners();
    return { ...currentProfileState };
  },

  /**
   * Scollega il Trainer dall'account Cliente
   */
  async unlinkTrainer(): Promise<UserProfile> {
    currentProfileState = {
      ...currentProfileState,
      trainer_id: undefined,
      trainer_name: undefined,
      updated_at: new Date().toISOString(),
    };
    await persistProfileState(currentProfileState);
    notifyListeners();
    return { ...currentProfileState };
  },

  /**
   * Aggiunge un cliente alla lista del Trainer
   */
  async addClientToTrainer(client: ClientAssociation): Promise<UserProfile> {
    const existing = currentProfileState.clients || [];
    const filtered = existing.filter((c) => c.id !== client.id);
    currentProfileState = {
      ...currentProfileState,
      clients: [client, ...filtered],
      updated_at: new Date().toISOString(),
    };
    await persistProfileState(currentProfileState);
    notifyListeners();
    return { ...currentProfileState };
  },

  /**
   * Rimuove un cliente dalla lista attiva del Trainer impostando isArchived: true (Soft Delete)
   */
  async removeClientFromTrainer(clientId: string): Promise<UserProfile> {
    const existing = currentProfileState.clients || [];
    currentProfileState = {
      ...currentProfileState,
      clients: existing.map((c) =>
        c.id === clientId ? { ...c, isArchived: true } : c
      ),
      updated_at: new Date().toISOString(),
    };
    await persistProfileState(currentProfileState);
    notifyListeners();
    return { ...currentProfileState };
  },

  /**
   * Archivia un cliente (Soft Delete)
   */
  async archiveClient(clientId: string): Promise<UserProfile> {
    return this.removeClientFromTrainer(clientId);
  },

  /**
   * Ripristina un cliente archiviato (Unarchive)
   */
  async unarchiveClient(clientId: string): Promise<UserProfile> {
    const existing = currentProfileState.clients || [];
    currentProfileState = {
      ...currentProfileState,
      clients: existing.map((c) =>
        c.id === clientId ? { ...c, isArchived: false } : c
      ),
      updated_at: new Date().toISOString(),
    };
    await persistProfileState(currentProfileState);
    notifyListeners();
    return { ...currentProfileState };
  },

  /**
   * Elimina definitivamente un cliente (Hard Delete a Cascata)
   * Rimuove il cliente da Auth/Profilo, elimina schede, workout, cartelle, misurazioni e PDF associati.
   */
  async hardDeleteClient(clientId: string): Promise<UserProfile> {
    const existing = currentProfileState.clients || [];
    currentProfileState = {
      ...currentProfileState,
      clients: existing.filter((c) => c.id !== clientId),
      updated_at: new Date().toISOString(),
    };
    await persistProfileState(currentProfileState);
    notifyListeners();

    // 1. Cascade delete su Gym storage (routines, workouts, folders del cliente)
    await gymStorage.hardDeleteClientGymData(clientId);

    // 2. Cascade delete su chiavi dedicate al client in AsyncStorage (misurazioni, PDF nutrizionali, etc.)
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const clientKeys = allKeys.filter(
        (k) =>
          k.includes(clientId) ||
          k.startsWith(`@measurements_${clientId}`) ||
          k.startsWith(`@diet_${clientId}`) ||
          k.startsWith(`@nutrition_pdf_${clientId}`) ||
          k.startsWith(`@client_${clientId}`)
      );
      if (clientKeys.length > 0) {
        await AsyncStorage.multiRemove(clientKeys);
      }
    } catch (err) {
      console.warn('Errore rimozione chiavi correlate al cliente:', clientId, err);
    }

    return { ...currentProfileState };
  },

  /**
   * Resetta il profilo ai valori di default
   */
  async resetProfile(): Promise<void> {
    currentProfileState = { ...INITIAL_PROFILE };
    await persistProfileState(currentProfileState);
    notifyListeners();
  },
};
