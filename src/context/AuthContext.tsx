import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthUser, LoginCredentials, ProvisionedClient } from '../types/auth';
import { UserRole } from '../types/profile';
import { authService } from '../services/authService';
import { profileService } from '../services/profileService';
import { apiService } from '../services/api';

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  role: UserRole | null;
  token: string | null;
  loading: boolean;
  provisionedClients: ProvisionedClient[];
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  loginOtp: (data: { firstName: string; otp: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  createClientAccount: (
    firstName: string,
    lastName: string
  ) => Promise<{ success: boolean; otp?: string; error?: string }>;
  completeClientOnboarding: (data: {
    username: string;
    firstName: string;
    lastName: string;
    password: string;
    height: number;
    dateOfBirth: string;
    avatar_url?: string | null;
  }) => Promise<{ success: boolean; error?: string }>;
  archiveClient: (clientId: string) => Promise<void>;
  unarchiveClient: (clientId: string) => Promise<void>;
  hardDeleteClient: (clientId: string) => Promise<void>;
  refreshProvisionedClients: () => Promise<void>;
  updateUserSession: (userData: Partial<AuthUser>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [provisionedClients, setProvisionedClients] = useState<ProvisionedClient[]>([]);

  useEffect(() => {
    checkInitialSession();
  }, []);

  const checkInitialSession = async () => {
    setLoading(true);
    try {
      const [savedSession, clients, storedToken] = await Promise.all([
        authService.getStoredSession(),
        authService.getProvisionedClients(),
        AsyncStorage.getItem('@fitness_auth_token'),
      ]);

      setProvisionedClients(clients);

      const effectiveToken = savedSession?.token || storedToken;
      if (effectiveToken) {
        await apiService.setAuthToken(effectiveToken);
      }

      if (savedSession && savedSession.user && effectiveToken) {
        const userAvatar = await profileService.getUserAvatar(savedSession.user.id);
        const userWithAvatar = {
          ...savedSession.user,
          avatar_url: userAvatar,
        };
        setUser(userWithAvatar);
        setRole(savedSession.user.role);
        setToken(effectiveToken);
        setIsAuthenticated(true);
        syncWithProfileService(userWithAvatar);
      }
    } catch (e) {
      console.warn('Errore verifica sessione iniziale:', e);
    } finally {
      setLoading(false);
    }
  };

  const syncWithProfileService = async (authUser: AuthUser) => {
    try {
      const userAvatar = await profileService.getUserAvatar(authUser.id);
      await profileService.updateProfile({
        id: authUser.id,
        username: authUser.username,
        email: authUser.email,
        first_name: authUser.first_name,
        last_name: authUser.last_name,
        birth_date: authUser.birth_date || '01-01-1995',
        height_cm: authUser.height_cm || 175,
        avatar_url: userAvatar,
        role: authUser.role,
        password: authUser.password,
        is_profile_completed: authUser.is_profile_completed,
        raw_otp: authUser.raw_otp,
        trainer_id: authUser.trainer_id,
        trainer_name: authUser.trainer_name,
      });
      await profileService.switchRole(authUser.role);
    } catch (e) {
      console.warn('Errore sync auth -> profile:', e);
    }
  };

  const login = async (
    credentials: LoginCredentials
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await authService.login(credentials);

    if (res.success && res.data) {
      const { user: loggedUser, token: loggedToken } = res.data;
      // 1. Imposta immediatamente il Bearer Token su apiService e storage PRIMA di qualsiasi query
      if (loggedToken) {
        await apiService.setAuthToken(loggedToken);
        await AsyncStorage.setItem('@fitness_auth_token', loggedToken);
      }

      const userAvatar = await profileService.getUserAvatar(loggedUser.id);
      const userWithAvatar = {
        ...loggedUser,
        avatar_url: userAvatar,
      };
      setUser(userWithAvatar);
      setRole(loggedUser.role);
      setToken(loggedToken);
      setIsAuthenticated(true);
      await syncWithProfileService(userWithAvatar);
      return { success: true };
    }

    return {
      success: false,
      error: res.error?.message || 'Credenziali non valide.',
    };
  };

  const loginOtp = async (data: {
    firstName: string;
    otp: string;
  }): Promise<{ success: boolean; error?: string }> => {
    const res = await authService.loginOtp(data.firstName, data.otp);

    if (res.success && res.data) {
      const { user: loggedUser, token: loggedToken } = res.data;
      if (loggedToken) {
        await apiService.setAuthToken(loggedToken);
        await AsyncStorage.setItem('@fitness_auth_token', loggedToken);
      }
      const userAvatar = await profileService.getUserAvatar(loggedUser.id);
      const userWithAvatar = {
        ...loggedUser,
        avatar_url: userAvatar || loggedUser.avatar_url,
      };
      setUser(userWithAvatar);
      setRole(loggedUser.role);
      setToken(loggedToken);
      setIsAuthenticated(true);
      await syncWithProfileService(userWithAvatar);
      return { success: true };
    }

    return {
      success: false,
      error: res.error?.message || 'Nome o Codice OTP errato.',
    };
  };

  const logout = async (): Promise<void> => {
    await apiService.setAuthToken(null);
    await AsyncStorage.removeItem('@fitness_auth_token');
    await authService.clearSession();
    await profileService.resetProfile();
    setUser(null);
    setRole(null);
    setToken(null);
    setIsAuthenticated(false);
  };

  const refreshProvisionedClients = async (): Promise<void> => {
    const clients = await authService.getProvisionedClients();
    setProvisionedClients(clients);
  };

  const createClientAccount = async (
    firstName: string,
    lastName: string
  ): Promise<{ success: boolean; otp?: string; error?: string }> => {
    const res = await authService.provisionClientAccount(firstName, lastName);

    if (res.success && res.data) {
      const { client, otp } = res.data;
      await refreshProvisionedClients();

      // Sincronizza anche nell'archivio clienti del profileService per retrocompatibilità
      await profileService.addClientToTrainer({
        id: client.id,
        name: `${client.first_name} ${client.last_name}`.trim(),
        email: client.email,
        linked_at: client.created_at,
        notes: client.notes,
      });

      return { success: true, otp };
    }

    return {
      success: false,
      error: res.error?.message || 'Impossibile creare account cliente.',
    };
  };

  const completeClientOnboarding = async (data: {
    username: string;
    firstName: string;
    lastName: string;
    password: string;
    height: number;
    dateOfBirth: string;
    avatar_url?: string | null;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!user?.id) {
      return { success: false, error: 'Nessuna sessione attiva.' };
    }
    try {
      // 1. Chiamata al backend endpoint PUT /api/v1/clients/onboarding
      const res = await apiService.completeClientOnboarding(data);
      if (!res.success || !res.data) {
        return {
          success: false,
          error: res.error?.message || 'Impossibile completare il setup del profilo.',
        };
      }

      const updatedUser: AuthUser = {
        ...user,
        ...res.data,
        is_onboarded: true,
        is_profile_completed: true,
      };

      if (token) {
        await authService.saveSession({ user: updatedUser, token });
      }
      setUser(updatedUser);

      // Sincronizza anche il profileService
      await profileService.updateProfile({
        id: updatedUser.id,
        username: updatedUser.username,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        birth_date: updatedUser.birth_date || '01-01-1998',
        height_cm: updatedUser.height_cm || 170,
        avatar_url: updatedUser.avatar_url,
        is_profile_completed: true,
        trainer_id: updatedUser.trainer_id,
        trainer_name: updatedUser.trainer_name,
      });

      await refreshProvisionedClients();
      return { success: true };
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || 'Errore durante il completamento dell\'onboarding.',
      };
    }
  };

  const archiveClient = async (clientId: string): Promise<void> => {
    await Promise.all([
      authService.archiveClient(clientId),
      profileService.archiveClient(clientId),
    ]);
    await refreshProvisionedClients();
  };

  const unarchiveClient = async (clientId: string): Promise<void> => {
    await Promise.all([
      authService.unarchiveClient(clientId),
      profileService.unarchiveClient(clientId),
    ]);
    await refreshProvisionedClients();
  };

  const hardDeleteClient = async (clientId: string): Promise<void> => {
    await Promise.all([
      authService.hardDeleteClient(clientId),
      profileService.hardDeleteClient(clientId),
    ]);
    // Aggiornamento immediato dello stato locale per far sparire il cliente dalla UI
    setProvisionedClients((prev) => prev.filter((c) => c.id !== clientId));
  };

  const updateUserSession = async (userData: Partial<AuthUser>): Promise<void> => {
    if (!user) return;
    const updatedUser: AuthUser = {
      ...user,
      ...userData,
    };
    setUser(updatedUser);
    if (token) {
      await authService.saveSession({ user: updatedUser, token });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        role,
        token,
        loading,
        provisionedClients,
        login,
        loginOtp,
        logout,
        createClientAccount,
        completeClientOnboarding,
        archiveClient,
        unarchiveClient,
        hardDeleteClient,
        refreshProvisionedClients,
        updateUserSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve essere utilizzato all\'interno di un AuthProvider');
  }
  return context;
};
