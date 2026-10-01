import { UserRole } from './profile';

export interface AuthUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  password?: string;
  is_onboarded?: boolean;
  is_profile_completed?: boolean;
  raw_otp?: string;
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
  identifier: string;
  secret: string;
  username?: string;
  passwordOrOtp?: string;
}

export interface ProvisionedClient {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  otp: string;
  raw_otp?: string;
  password?: string;
  is_onboarded?: boolean;
  is_profile_completed?: boolean;
  trainer_id: string;
  trainer_name: string;
  email?: string;
  notes?: string;
  avatar_url?: string | null;
  created_at: string;
  isArchived?: boolean;
}

export interface CreateClientRequestDto {
  firstName: string;
  lastName: string;
}

export interface CreateClientResponseDto {
  client: ProvisionedClient;
  otp: string;
}

export interface LoginOtpRequestDto {
  firstName: string;
  otp: string;
}

export interface ClientOnboardingDto {
  username: string;
  firstName: string;
  lastName: string;
  password: string;
  height: number;
  dateOfBirth: string;
  avatar_url?: string | null;
}
