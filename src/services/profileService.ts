import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './api';
import {
  UserProfile,
  UserRole,
  ClientAssociation,
  UpdateProfileRequestDto,
  ProfileResponseDto,
} from '../types/profile';

const STORAGE_KEY_PROFILE = '@user_profile_v2';

const DEFAULT_TRAINER_CLIENTS: ClientAssociation[] = [
  {
    id: 'client-simona-1',
    name: 'Simona Bianchi',
    email: 'simona.b@example.com',
    linked_at: '2026-09-01T10:00:00Z',
    notes: 'Obiettivo: Tonificazione glutei & ricomposizione (3x/week)',
  },
  {
    id: 'client-luca-2',
    name: 'Luca Moretti',
    email: 'luca.m@example.com',
    linked_at: '2026-09-08T14:30:00Z',
    notes: 'Obiettivo: Forza panca e progressione carichi (4x/week)',
  },
];

const INITIAL_PROFILE: UserProfile = {
  id: 'trainer-marco-1',
  first_name: 'Marco',
  last_name: 'Rossi',
  birth_date: '15-05-1994',
  height_cm: 180,
  avatar_url: null,
  role: 'TRAINER',
  email: 'marco.trainer@example.com',
  clients: DEFAULT_TRAINER_CLIENTS,
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
   * Rimuove un cliente dalla lista del Trainer
   */
  async removeClientFromTrainer(clientId: string): Promise<UserProfile> {
    const existing = currentProfileState.clients || [];
    currentProfileState = {
      ...currentProfileState,
      clients: existing.filter((c) => c.id !== clientId),
      updated_at: new Date().toISOString(),
    };
    await persistProfileState(currentProfileState);
    notifyListeners();
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
