import { ApiResponse } from './api';

export interface UserProfile {
  id?: string | number;
  first_name: string; // Nome
  last_name: string; // Cognome
  birth_date: string; // Formato DD-MM-YYYY
  height_cm: number; // Altezza in cm
  avatar_url?: string | null; // URI o percorso locale / remote avatar
  role?: 'TRAINER' | 'CLIENT';
  email?: string;
  created_at?: string;
  updated_at?: string;
}

// Request DTO per aggiornamento profilo (PUT /api/v1/profile)
export interface UpdateProfileRequestDto {
  first_name: string;
  last_name: string;
  birth_date: string; // DD-MM-YYYY
  height_cm: number;
  avatar_url?: string | null;
}

// Response DTO per profilo utente (GET /api/v1/profile, PUT /api/v1/profile)
export type ProfileResponseDto = ApiResponse<UserProfile>;
