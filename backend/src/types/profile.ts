import { ApiResponse } from './api';

export type UserRole = 'TRAINER' | 'CLIENT';

export interface ClientAssociation {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string | null;
  linked_at: string;
  notes?: string;
  isArchived?: boolean;
}

export interface UserProfile {
  id?: string | number;
  username?: string;
  first_name: string;
  last_name: string;
  birth_date: string; // DD-MM-YYYY
  height_cm: number;
  avatar_url?: string | null;
  role: UserRole;
  email?: string;
  password?: string;
  is_profile_completed?: boolean;
  raw_otp?: string;
  clients?: ClientAssociation[];
  trainer_id?: string;
  trainer_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UpdateProfileRequestDto {
  id?: string | number;
  username?: string;
  email?: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  height_cm: number;
  avatar_url?: string | null;
  role?: UserRole;
  password?: string;
  is_profile_completed?: boolean;
  raw_otp?: string;
  clients?: ClientAssociation[];
  trainer_id?: string;
  trainer_name?: string;
}

export type ProfileResponseDto = ApiResponse<UserProfile>;
