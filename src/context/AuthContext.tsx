import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AuthUser, LoginCredentials, ProvisionedClient } from '../types/auth';
import { UserRole } from '../types/profile';
import { authService } from '../services/authService';
import { profileService } from '../services/profileService';

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  role: UserRole | null;
  token: string | null;
  loading: boolean;
  provisionedClients: ProvisionedClient[];
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  createClientAccount: (
    username: string,
    fullName?: string,
    notes?: string
  ) => Promise<{ success: boolean; otp?: string; error?: string }>;
  refreshProvisionedClients: () => Promise<void>;
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
      const [savedSession, clients] = await Promise.all([
        authService.getStoredSession(),
        authService.getProvisionedClients(),
      ]);

      setProvisionedClients(clients);

      if (savedSession && savedSession.user && savedSession.token) {
        setUser(savedSession.user);
        setRole(savedSession.user.role);
        setToken(savedSession.token);
        setIsAuthenticated(true);
        syncWithProfileService(savedSession.user);
      }
    } catch (e) {
      console.warn('Errore verifica sessione iniziale:', e);
    } finally {
      setLoading(false);
    }
  };

  const syncWithProfileService = async (authUser: AuthUser) => {
    try {
      await profileService.updateProfile({
        id: authUser.id,
        email: authUser.email,
        first_name: authUser.first_name,
        last_name: authUser.last_name,
        birth_date: authUser.birth_date || '01-01-1995',
        height_cm: authUser.height_cm || 175,
        role: authUser.role,
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
      setUser(loggedUser);
      setRole(loggedUser.role);
      setToken(loggedToken);
      setIsAuthenticated(true);
      await syncWithProfileService(loggedUser);
      return { success: true };
    }

    return {
      success: false,
      error: res.error?.message || 'Credenziali non valide.',
    };
  };

  const logout = async (): Promise<void> => {
    await authService.clearSession();
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
    username: string,
    fullName?: string,
    notes?: string
  ): Promise<{ success: boolean; otp?: string; error?: string }> => {
    const res = await authService.provisionClientAccount(username, fullName, notes);

    if (res.success && res.data) {
      const { client, otp } = res.data;
      await refreshProvisionedClients();

      // Sincronizza anche nell'archivio clienti del profileService per retrocompatibilità
      await profileService.addClientToTrainer({
        id: client.id,
        name: `${client.first_name} ${client.last_name}`,
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
        logout,
        createClientAccount,
        refreshProvisionedClients,
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
