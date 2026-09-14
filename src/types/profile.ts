import { ApiResponse } from './api';

export type UserRole = 'TRAINER' | 'CLIENT';

export interface ClientAssociation {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string | null;
  linked_at: string;
  notes?: string;
}

export interface UserProfile {
  id?: string | number;
  first_name: string; // Nome
  last_name: string; // Cognome
  birth_date: string; // Formato DD-MM-YYYY
  height_cm: number; // Altezza in cm
  avatar_url?: string | null; // URI o percorso locale / remote avatar
  role: UserRole; // Ruolo utente nel sistema RBAC
  email?: string;
  clients?: ClientAssociation[]; // Lista clienti associati (se Trainer)
  trainer_id?: string; // ID del Personal Trainer associato (se Client)
  trainer_name?: string; // Nome del Personal Trainer associato (se Client)
  created_at?: string;
  updated_at?: string;
}

// Request DTO per aggiornamento profilo (PUT /api/v1/profile)
export interface UpdateProfileRequestDto {
  id?: string | number;
  email?: string;
  first_name: string;
  last_name: string;
  birth_date: string; // DD-MM-YYYY
  height_cm: number;
  avatar_url?: string | null;
  role?: UserRole;
  clients?: ClientAssociation[];
  trainer_id?: string;
  trainer_name?: string;
}

// Response DTO per profilo utente (GET /api/v1/profile, PUT /api/v1/profile)
export type ProfileResponseDto = ApiResponse<UserProfile>;
