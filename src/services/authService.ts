import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthUser, AuthSession, LoginCredentials, ProvisionedClient } from '../types/auth';
import { ApiResponse } from '../types/api';
import { TRAINER_CONFIG } from './config';
import { generateUUID } from '../utils/uuid';
import { apiService } from './api';

const STORAGE_KEY_AUTH_SESSION = '@fitness_auth_session_v2';
const STORAGE_KEY_PROVISIONED_CLIENTS = '@fitness_provisioned_clients_v2';

// 1. CREDENZIALI MASTER TRAINER (lette in modo sicuro da .env tramite TRAINER_CONFIG)
export const TRAINER_ADMIN = {
  username: TRAINER_CONFIG.username,
  password: TRAINER_CONFIG.password,
  user: {
    id: 'trainer-1',
    username: TRAINER_CONFIG.username,
    first_name: TRAINER_CONFIG.firstName,
    last_name: TRAINER_CONFIG.lastName,
    role: 'TRAINER' as const,
    email: TRAINER_CONFIG.email,
    height_cm: 180,
    birth_date: '01-01-1995',
    avatar_url: null,
  },
  token: 'mock-jwt-trainer-token',
};

// 2. CLIENTI INIZIALI (partenza a zero)
const INITIAL_PROVISIONED_CLIENTS: ProvisionedClient[] = [];

class AuthService {
  /**
   * Genera codice OTP alfanumerico di 6 caratteri
   */
  private generateOtp(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Carica la lista dei clienti provisionati
   */
  async getProvisionedClients(): Promise<ProvisionedClient[]> {
    try {
      // 1. Prova a scaricare i clienti aggiornati dal server backend Fastify
      const remoteRes = await apiService.fetchProvisionedClients();
      if (remoteRes.success && remoteRes.data) {
        await AsyncStorage.setItem(
          STORAGE_KEY_PROVISIONED_CLIENTS,
          JSON.stringify(remoteRes.data)
        );
        return remoteRes.data;
      }
    } catch {
      // Network non disponibile, fallback su storage locale
    }

    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY_PROVISIONED_CLIENTS);
      if (data) {
        return JSON.parse(data);
      }
      await AsyncStorage.setItem(
        STORAGE_KEY_PROVISIONED_CLIENTS,
        JSON.stringify(INITIAL_PROVISIONED_CLIENTS)
      );
      return INITIAL_PROVISIONED_CLIENTS;
    } catch {
      return INITIAL_PROVISIONED_CLIENTS;
    }
  }

  /**
   * Salva la lista dei clienti provisionati
   */
  async saveProvisionedClients(clients: ProvisionedClient[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY_PROVISIONED_CLIENTS,
        JSON.stringify(clients)
      );
    } catch (e) {
      console.warn('Errore salvataggio provisioned clients:', e);
    }
  }

  /**
   * Esegue il Login con username e password/OTP
   */
  async login(credentials: LoginCredentials): Promise<ApiResponse<AuthSession>> {
    const cleanUsername = credentials.username.trim();
    const cleanPasswordOrOtp = credentials.passwordOrOtp.trim();

    if (!cleanUsername || !cleanPasswordOrOtp) {
      return {
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Inserisci sia Username che Password/Codice OTP.',
        },
      };
    }

    // 0. Prova autenticazione con il server Fastify remoto
    try {
      const remoteRes = await apiService.login({
        username: cleanUsername,
        passwordOrOtp: cleanPasswordOrOtp,
      });
      if (remoteRes.success && remoteRes.data) {
        apiService.setAuthToken(remoteRes.data.token);
        await this.saveSession(remoteRes.data);
        return remoteRes;
      }
    } catch {
      // Backend non raggiungibile o offline, fallback su autenticazione locale
    }

    // A. Verifica Credenziali TRAINER (Lorenzo o configurato via .env)
    const configuredUsername = TRAINER_CONFIG.username.toLowerCase();
    const isTrainerMatch =
      (cleanUsername.toLowerCase() === configuredUsername ||
        cleanUsername.toLowerCase() === 'lorenzo' ||
        cleanUsername.toLowerCase() === 'lorenzoanzivino' ||
        cleanUsername.toLowerCase() === 'trainer' ||
        cleanUsername.toLowerCase() === 'admin') &&
      cleanPasswordOrOtp === TRAINER_CONFIG.password;

    if (isTrainerMatch) {
      const session: AuthSession = {
        user: { ...TRAINER_ADMIN.user },
        token: TRAINER_ADMIN.token,
      };
      await this.saveSession(session);
      return { success: true, data: session, error: null };
    }

    // B. Verifica Credenziali CLIENTE (Identificativo + Password / OTP Perpetuo)
    const provisionedList = await this.getProvisionedClients();
    const matchingClients = provisionedList.filter((c) => {
      if (c.isArchived) return false;
      const target = cleanUsername.toLowerCase();
      const usernameMatch = Boolean(c.username && c.username.toLowerCase() === target);
      const firstNameMatch = Boolean(c.first_name && c.first_name.toLowerCase() === target);
      const fullNameMatch = Boolean(`${c.first_name} ${c.last_name}`.trim().toLowerCase() === target);
      const emailMatch = Boolean(c.email && c.email.toLowerCase() === target);
      return usernameMatch || firstNameMatch || fullNameMatch || emailMatch;
    });

    const matchedClient = matchingClients.find((c) => {
      const inputPassOrOtp = cleanPasswordOrOtp.trim();
      const rawOtp = (c.raw_otp || c.otp || '').trim();
      const storedPassword = (c.password || '').trim();

      const isOtpMatch = rawOtp.length > 0 && inputPassOrOtp.toUpperCase() === rawOtp.toUpperCase();
      const isPasswordMatch = storedPassword.length > 0 && inputPassOrOtp === storedPassword;

      return isOtpMatch || isPasswordMatch;
    });

    if (matchedClient) {
      const clientUser: AuthUser = {
        id: matchedClient.id,
        username: matchedClient.username,
        first_name: matchedClient.first_name,
        last_name: matchedClient.last_name,
        role: 'CLIENT',
        email: matchedClient.email,
        password: matchedClient.password,
        is_profile_completed: matchedClient.is_profile_completed ?? false,
        raw_otp: matchedClient.raw_otp || matchedClient.otp,
        trainer_id: matchedClient.trainer_id,
        trainer_name: matchedClient.trainer_name,
        height_cm: 168,
        birth_date: '01-01-1998',
        avatar_url: null,
      };

      const session: AuthSession = {
        user: clientUser,
        token: `mock-jwt-client-${matchedClient.id}`,
      };
      await this.saveSession(session);
      return { success: true, data: session, error: null };
    }

    return {
      success: false,
      data: null,
      error: {
        code: 'AUTH_FAILED',
        message:
          'Credenziali non valide. Inserisci lo Username/Nome e la tua Password o il codice OTP fornito dal Trainer.',
      },
    };
  }

  /**
   * Crea un nuovo account cliente da parte del Trainer e genera il codice OTP (Password iniziale)
   * Richiede Nome e Cognome obbligatori, genera l'username dal Nome e imposta is_profile_completed = false.
   */
  async provisionClientAccount(
    firstName: string,
    lastName: string,
    notes?: string
  ): Promise<ApiResponse<{ client: ProvisionedClient; otp: string }>> {
    const cleanFirstName = firstName.trim();
    const cleanLastName = (lastName || '').trim();
    if (!cleanFirstName) {
      return {
        success: false,
        data: null,
        error: { code: 'INVALID_NAME', message: 'Il Nome dell\'atleta è obbligatorio.' },
      };
    }
    if (!cleanLastName) {
      return {
        success: false,
        data: null,
        error: { code: 'INVALID_LASTNAME', message: 'Il Cognome dell\'atleta è obbligatorio.' },
      };
    }

    // 0. Prova provisioning su server Fastify
    try {
      const remoteRes = await apiService.provisionClient({
        first_name: cleanFirstName,
        last_name: cleanLastName,
        notes: notes?.trim(),
        trainer_id: TRAINER_ADMIN.user.id,
        trainer_name: `${TRAINER_ADMIN.user.first_name} ${TRAINER_ADMIN.user.last_name}`,
      });
      if (remoteRes.success && remoteRes.data) {
        const client = remoteRes.data;
        const currentClients = await this.getProvisionedClients();
        const updatedList = [client, ...currentClients.filter((c) => c.id !== client.id)];
        await this.saveProvisionedClients(updatedList);
        return {
          success: true,
          data: {
            client,
            otp: client.otp,
          },
          error: null,
        };
      }
    } catch {
      // Backend non raggiungibile, fallback su provisioning locale
    }

    const currentClients = await this.getProvisionedClients();
    const generatedOtp = this.generateOtp();
    const clientId = generateUUID();
    const generatedUsername = cleanFirstName;

    const newClient: ProvisionedClient = {
      id: clientId,
      username: generatedUsername,
      first_name: cleanFirstName,
      last_name: cleanLastName,
      otp: generatedOtp,
      raw_otp: generatedOtp,
      password: '',
      is_profile_completed: false,
      trainer_id: TRAINER_ADMIN.user.id,
      trainer_name: `${TRAINER_ADMIN.user.first_name} ${TRAINER_ADMIN.user.last_name}`,
      email: `${cleanFirstName.toLowerCase()}@fitnesslogbook.local`,
      notes: notes?.trim() || 'Account cliente creato dal Trainer',
      created_at: new Date().toISOString(),
      isArchived: false,
    };

    const updatedList = [newClient, ...currentClients];
    await this.saveProvisionedClients(updatedList);

    return {
      success: true,
      data: {
        client: newClient,
        otp: generatedOtp,
      },
      error: null,
    };
  }

  /**
   * Aggiorna la password del cliente e imposta is_profile_completed a true
   */
  async updateClientPassword(
    clientId: string,
    newPassword: string
  ): Promise<boolean> {
    const clients = await this.getProvisionedClients();
    const idx = clients.findIndex((c) => c.id === clientId);
    if (idx === -1) return false;
    clients[idx].password = newPassword;
    clients[idx].is_profile_completed = true;
    await this.saveProvisionedClients(clients);
    return true;
  }

  /**
   * Completa l'onboarding del cliente: imposta la password, l'eventuale username personalizzato,
   * data di nascita e altezza, e contrassegna is_profile_completed = true.
   */
  async completeClientOnboarding(
    clientId: string,
    data: {
      username?: string;
      password: string;
      birthDate?: string;
      heightCm?: number;
    }
  ): Promise<ProvisionedClient | null> {
    const clients = await this.getProvisionedClients();
    const idx = clients.findIndex((c) => c.id === clientId);
    if (idx === -1) return null;

    const target = clients[idx];
    target.password = data.password.trim();
    if (data.username && data.username.trim()) {
      target.username = data.username.trim();
    }
    target.is_profile_completed = true;

    await this.saveProvisionedClients(clients);
    return target;
  }

  /**
   * Archivia un cliente (Soft Delete)
   */
  async archiveClient(clientId: string): Promise<ProvisionedClient[]> {
    const clients = await this.getProvisionedClients();
    const updated = clients.map((c) =>
      c.id === clientId ? { ...c, isArchived: true } : c
    );
    await this.saveProvisionedClients(updated);
    return updated;
  }

  /**
   * Ripristina un cliente archiviato (Unarchive)
   */
  async unarchiveClient(clientId: string): Promise<ProvisionedClient[]> {
    const clients = await this.getProvisionedClients();
    const updated = clients.map((c) =>
      c.id === clientId ? { ...c, isArchived: false } : c
    );
    await this.saveProvisionedClients(updated);
    return updated;
  }

  /**
   * Elimina definitivamente un cliente (Hard Delete a Cascata)
   */
  async hardDeleteClient(clientId: string): Promise<void> {
    const clients = await this.getProvisionedClients();
    const updated = clients.filter((c) => c.id !== clientId);
    await this.saveProvisionedClients(updated);

    // Se la sessione attiva appartiene al cliente eliminato, effettua il logout
    const session = await this.getStoredSession();
    if (session && String(session.user.id) === String(clientId)) {
      await this.clearSession();
    }
  }

  /**
   * Recupera la sessione persistita in AsyncStorage
   */
  async getStoredSession(): Promise<AuthSession | null> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY_AUTH_SESSION);
      if (json) {
        return JSON.parse(json);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Salva la sessione in AsyncStorage
   */
  async saveSession(session: AuthSession): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_AUTH_SESSION, JSON.stringify(session));
    } catch (e) {
      console.warn('Errore salvataggio sessione auth:', e);
    }
  }

  /**
   * Elimina la sessione (Logout)
   */
  async clearSession(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_AUTH_SESSION);
    } catch (e) {
      console.warn('Errore rimozione sessione auth:', e);
    }
  }

  /**
   * Elimina tutti i clienti provisionati salvati (Reset Completo)
   */
  async clearAllProvisionedClients(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_PROVISIONED_CLIENTS);
    } catch (e) {
      console.warn('Errore rimozione provisioned clients:', e);
    }
  }
}

export const authService = new AuthService();
