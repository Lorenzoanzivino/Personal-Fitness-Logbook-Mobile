import { UserRole, ClientAssociation, UserProfile } from './profile';
import { AuthUser, AuthSession, LoginCredentials, ProvisionedClient } from './auth';

export type {
  UserRole,
  ClientAssociation,
  UserProfile,
  AuthUser,
  AuthSession,
  LoginCredentials,
  ProvisionedClient,
};

export interface ClientUser extends AuthUser {
  password?: string;
  is_profile_completed?: boolean;
  raw_otp?: string;
}
