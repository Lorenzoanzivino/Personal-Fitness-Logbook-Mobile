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
   * Esegue lo Smart Login unificato con identifier (username o nome) e secret (password o OTP)
   */
  async login(credentials: LoginCredentials): Promise<ApiResponse<AuthSession>> {
    const cleanIdentifier = (credentials.identifier || credentials.username || '').trim();
    const cleanSecret = (credentials.secret || credentials.passwordOrOtp || '').trim();

    if (!cleanIdentifier || !cleanSecret) {
      return {
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Inserisci sia Username/Nome che Password/Codice OTP.',
        },
      };
    }

    // 0. Prova autenticazione con il server Fastify
    try {
      const remoteRes = await apiService.login({
        identifier: cleanIdentifier,
        secret: cleanSecret,
      });
      if (remoteRes.success && remoteRes.data) {
        if (remoteRes.data.token) {
          await apiService.setAuthToken(remoteRes.data.token);
          await AsyncStorage.setItem('@fitness_auth_token', remoteRes.data.token);
        }
        await this.saveSession(remoteRes.data);
        return remoteRes;
      }
      // Se la chiamata al backend fallisce (errore di rete o credenziali invalide), restituisci subito l'errore
      return remoteRes;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Backend irraggiungibile.';
      return {
        success: false,
        data: null,
        error: { code: 'NETWORK_ERROR', message },
      };
    }

  }

  /**
   * Esegue il Login con Primo Accesso tramite Nome e Codice OTP (delega a smart login)
   */
  async loginOtp(firstName: string, otp: string): Promise<ApiResponse<AuthSession>> {
    return this.login({
      identifier: firstName,
      secret: otp,
    });
  }

  /**
   * Crea un nuovo account cliente da parte del Trainer e genera il codice OTP
   * Accetta ESCLUSIVAMENTE Nome e Cognome.
   */
  async provisionClientAccount(
    firstName: string,
    lastName: string
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

    // 0. Chiamata al server Fastify
    try {
      const remoteRes = await apiService.createTrainerClient({
        firstName: cleanFirstName,
        lastName: cleanLastName,
      });
      if (remoteRes.success && remoteRes.data) {
        const { client, otp } = remoteRes.data;
        const currentClients = await this.getProvisionedClients();
        const updatedList = [client, ...currentClients.filter((c) => c.id !== client.id)];
        await this.saveProvisionedClients(updatedList);
        return {
          success: true,
          data: {
            client,
            otp,
          },
          error: null,
        };
      }
      if (!remoteRes.success && remoteRes.error && remoteRes.error.code !== 'NETWORK_ERROR') {
        return {
          success: false,
          data: null,
          error: remoteRes.error,
        };
      }
    } catch {
      // Backend non raggiungibile, fallback su provisioning locale
    }

    const currentClients = await this.getProvisionedClients();
    const generatedOtp = this.generateOtp();
    const clientId = generateUUID();
    const generatedUsername = `${cleanFirstName.toLowerCase()}.${cleanLastName.toLowerCase()}${Math.floor(10 + Math.random() * 90)}`;

    const newClient: ProvisionedClient = {
      id: clientId,
      username: generatedUsername,
      first_name: cleanFirstName,
      last_name: cleanLastName,
      otp: generatedOtp,
      raw_otp: generatedOtp,
      password: '',
      is_onboarded: false,
      is_profile_completed: false,
      trainer_id: TRAINER_ADMIN.user.id,
      trainer_name: `${TRAINER_ADMIN.user.first_name} ${TRAINER_ADMIN.user.last_name}`,
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
    clients[idx].is_onboarded = true;
    clients[idx].is_profile_completed = true;
    await this.saveProvisionedClients(clients);
    return true;
  }

  /**
   * Completa l'onboarding del cliente: imposta la password, l'eventuale username personalizzato,
   * data di nascita e altezza, e contrassegna is_onboarded e is_profile_completed = true.
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
    target.is_onboarded = true;
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
   * Elimina definitivamente un cliente (Hard Delete a Cascata sia remoto sia locale)
   */
  async hardDeleteClient(clientId: string): Promise<void> {
    try {
      await apiService.deleteTrainerClient(clientId);
    } catch (e) {
      console.warn('Errore eliminazione remota cliente:', e);
    }

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
        const session = JSON.parse(json);
        if (session?.token) {
          await apiService.setAuthToken(session.token);
        }
        return session;
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
      if (session?.token) {
        await apiService.setAuthToken(session.token);
        await AsyncStorage.setItem('@fitness_auth_token', session.token);
      }
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
      await apiService.setAuthToken(null);
      await AsyncStorage.removeItem('@fitness_auth_token');
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
