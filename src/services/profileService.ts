import { apiService } from './api';
import { UserProfile, UpdateProfileRequestDto, ProfileResponseDto } from '../types/profile';

// Stato iniziale di fallback per sviluppo locale offline
let mockProfileState: UserProfile = {
  id: 1,
  first_name: 'Marco',
  last_name: 'Rossi',
  birth_date: '15-05-1994',
  height_cm: 180,
  avatar_url: null,
  role: 'CLIENT',
  email: 'marco.rossi@example.com',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

type ProfileListener = (profile: UserProfile) => void;
const listeners: Set<ProfileListener> = new Set();

const notifyListeners = () => {
  listeners.forEach((listener) => {
    try {
      listener({ ...mockProfileState });
    } catch (e) {
      console.warn('Listener notification error:', e);
    }
  });
};

export const profileService = {
  /**
   * Recupera il profilo utente corrente in cache
   */
  getCurrentProfile(): UserProfile {
    return { ...mockProfileState };
  },

  /**
   * Sottoscrizione alle modifiche del profilo
   */
  subscribe(listener: ProfileListener): () => void {
    listeners.add(listener);
    listener({ ...mockProfileState });
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
      mockProfileState = { ...res.data };
      notifyListeners();
      return res;
    }

    // In fase di sviluppo iniziale / fallback offline
    notifyListeners();
    return {
      success: true,
      data: { ...mockProfileState },
      error: null,
    };
  },

  /**
   * Aggiorna il profilo utente (PUT /api/v1/profile)
   */
  async updateProfile(dto: UpdateProfileRequestDto): Promise<ProfileResponseDto> {
    const res = await apiService.put<UserProfile>('/api/v1/profile', dto);
    if (res.success && res.data) {
      mockProfileState = { ...res.data };
      notifyListeners();
      return res;
    }

    // Aggiorna stato mock locale per test UI
    mockProfileState = {
      ...mockProfileState,
      ...dto,
      updated_at: new Date().toISOString(),
    };
    notifyListeners();

    return {
      success: true,
      data: { ...mockProfileState },
      error: null,
    };
  },

  /**
   * Resetta il profilo ai valori di default
   */
  resetProfile(): void {
    mockProfileState = {
      id: 1,
      first_name: 'Atleta',
      last_name: 'Fitness',
      birth_date: '01-01-2000',
      height_cm: 175,
      avatar_url: null,
      role: 'CLIENT',
      email: 'atleta@example.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    notifyListeners();
  },
};

