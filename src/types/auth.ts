import { UserRole } from './profile';

export interface AuthUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  email?: string;
  trainer_id?: string;
  trainer_name?: string;
  height_cm?: number;
  birth_date?: string;
  avatar_url?: string | null;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
}

export interface LoginCredentials {
  username: string;
  passwordOrOtp: string;
}

export interface ProvisionedClient {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  otp: string;
  trainer_id: string;
  trainer_name: string;
  email?: string;
  notes?: string;
  created_at: string;
  isArchived?: boolean;
}
