import { API_CONFIG, getApiEndpoint } from './config';
import {
  ApiResponse,
  GenerateOtpResponseDto,
  LinkClientRequestDto,
  LinkClientResponseDto,
} from '../types/api';
import { WorkoutRoutine, RoutineFolder } from '../types/workout';
import { gymStorage } from './gymStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ActiveOtpRecord {
  code: string;
  trainer_id: string;
  trainer_name: string;
  expires_at: string;
}

const STORAGE_KEY_OTPS = '@fitness_active_otps_v1';

class ApiService {
  private inMemoryOtps: Map<string, ActiveOtpRecord> = new Map();

  constructor() {
    this.loadPersistedOtps();
  }

  private async loadPersistedOtps(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY_OTPS);
      if (data) {
        const parsed: ActiveOtpRecord[] = JSON.parse(data);
        const now = Date.now();
        parsed.forEach((rec) => {
          if (new Date(rec.expires_at).getTime() > now) {
            this.inMemoryOtps.set(rec.code, rec);
          }
        });
      }
    } catch {
      // ignore
    }
  }

  private async persistOtps(): Promise<void> {
    try {
      const records = Array.from(this.inMemoryOtps.values());
      await AsyncStorage.setItem(STORAGE_KEY_OTPS, JSON.stringify(records));
    } catch {
      // ignore
    }
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = getApiEndpoint(path);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);

    try {
      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {}),
      };

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const json = await response.json();
        return json as ApiResponse<T>;
      }

      if (!response.ok) {
        return {
          success: false,
          data: null,
          error: {
            code: `HTTP_${response.status}`,
            message: `Richiesta fallita con codice ${response.status}`,
          },
        };
      }

      return {
        success: true,
        data: null,
        error: null,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const message = err instanceof Error ? err.message : 'Errore sconosciuto di rete';
      return {
        success: false,
        data: null,
        error: {
          code: 'NETWORK_ERROR',
          message,
        },
      };
    }
  }

  async get<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'GET' });
  }

  async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'DELETE' });
  }

  // ==========================================
  // FASE 3: MOCK ENDPOINTS PER RBAC & OTP PAIRING
  // ==========================================

  /**
   * Genera un codice OTP di 6 caratteri alfanumerici per il Trainer (POST /api/v1/auth/otp/generate)
   */
  async generateTrainerOtp(
    trainerId: string,
    trainerName: string
  ): Promise<ApiResponse<GenerateOtpResponseDto>> {
    // Genera codice alfanumerico di 6 caratteri escludendo caratteri ambigui (0, O, 1, I)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Scadenza a 30 minuti da adesso
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const record: ActiveOtpRecord = {
      code,
      trainer_id: trainerId,
      trainer_name: trainerName,
      expires_at: expiresAt,
    };

    this.inMemoryOtps.set(code, record);
    await this.persistOtps();

    return {
      success: true,
      data: {
        code,
        expires_at: expiresAt,
        trainer_id: trainerId,
        trainer_name: trainerName,
      },
      error: null,
    };
  }

  /**
   * Collega un Cliente al Trainer verificando il codice OTP (POST /api/v1/auth/otp/verify-link)
   */
  async linkClientWithOtp(
    dto: LinkClientRequestDto
  ): Promise<ApiResponse<LinkClientResponseDto>> {
    const code = dto.otp_code.trim().toUpperCase();

    // Supporta codici demo predefiniti per testing immediato
    if (code === 'TRN892' || code === 'DEMO26') {
      return {
        success: true,
        data: {
          success: true,
          trainer: {
            id: 'trainer-marco-1',
            name: 'Marco Rossi (Trainer)',
          },
          client: {
            id: dto.client_id,
            name: dto.client_name,
          },
        },
        error: null,
      };
    }

    const record = this.inMemoryOtps.get(code);

    if (!record) {
      return {
        success: false,
        data: null,
        error: {
          code: 'OTP_INVALID',
          message: 'Codice OTP non valido o inesistente. Ricontrolla il codice fornito dal Trainer.',
        },
      };
    }

    const now = Date.now();
    if (new Date(record.expires_at).getTime() < now) {
      this.inMemoryOtps.delete(code);
      await this.persistOtps();
      return {
        success: false,
        data: null,
        error: {
          code: 'OTP_EXPIRED',
          message: 'Il codice OTP è scaduto. Richiedine uno nuovo al tuo Trainer.',
        },
      };
    }

    return {
      success: true,
      data: {
        success: true,
        trainer: {
          id: record.trainer_id,
          name: record.trainer_name,
        },
        client: {
          id: dto.client_id,
          name: dto.client_name,
        },
      },
      error: null,
    };
  }

  /**
   * Recupera schede filtrate per owner_id (GET /api/v1/routines?owner_id=...)
   */
  async fetchRoutinesByOwner(ownerId: string): Promise<ApiResponse<WorkoutRoutine[]>> {
    try {
      const allRoutines = await gymStorage.loadRoutines();
      const filtered = allRoutines.filter((r) => r.owner_id === ownerId || (!r.owner_id && ownerId === 'trainer-1'));
      return {
        success: true,
        data: filtered,
        error: null,
      };
    } catch {
      return {
        success: false,
        data: null,
        error: {
          code: 'STORAGE_ERROR',
          message: 'Errore durante il recupero delle schede.',
        },
      };
    }
  }

  /**
   * Recupera cartelle filtrate per owner_id (GET /api/v1/folders?owner_id=...)
   */
  async fetchFoldersByOwner(ownerId: string): Promise<ApiResponse<RoutineFolder[]>> {
    try {
      const allFolders = await gymStorage.loadFolders();
      const filtered = allFolders.filter((f) => f.owner_id === ownerId || (!f.owner_id && ownerId === 'trainer-1'));
      return {
        success: true,
        data: filtered,
        error: null,
      };
    } catch {
      return {
        success: false,
        data: null,
        error: {
          code: 'STORAGE_ERROR',
          message: 'Errore durante il recupero delle cartelle.',
        },
      };
    }
  }
}

export const apiService = new ApiService();
