import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthUser, AuthSession, LoginCredentials, ProvisionedClient } from '../types/auth';
import { ApiResponse } from '../types/api';
import { TRAINER_CONFIG } from './config';
import { generateUUID } from '../utils/uuid';

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

    // B. Verifica Credenziali CLIENTE (Username + OTP)
    const provisionedList = await this.getProvisionedClients();
    const matchedClient = provisionedList.find(
      (c) =>
        !c.isArchived &&
        c.username.toLowerCase() === cleanUsername.toLowerCase() &&
        c.otp.toUpperCase() === cleanPasswordOrOtp.toUpperCase()
    );

    if (matchedClient) {
      const clientUser: AuthUser = {
        id: matchedClient.id,
        username: matchedClient.username,
        first_name: matchedClient.first_name,
        last_name: matchedClient.last_name,
        role: 'CLIENT',
        email: matchedClient.email,
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
          'Credenziali non valide. Per i clienti inserire lo Username e il codice OTP fornito dal Trainer.',
      },
    };
  }

  /**
   * Crea un nuovo account cliente da parte del Trainer e genera il codice OTP (Password)
   * Supporta infiniti clienti con lo stesso nome grazie agli identificatori univoci UUID.
   */
  async provisionClientAccount(
    username: string,
    fullName?: string,
    notes?: string
  ): Promise<ApiResponse<{ client: ProvisionedClient; otp: string }>> {
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      return {
        success: false,
        data: null,
        error: { code: 'INVALID_USERNAME', message: 'Lo Username cliente è obbligatorio.' },
      };
    }

    const currentClients = await this.getProvisionedClients();
    const generatedOtp = this.generateOtp();
    const clientId = generateUUID();
    const nameParts = (fullName || cleanUsername).trim().split(' ');
    const firstName = nameParts[0] || cleanUsername;
    const lastName = nameParts.slice(1).join(' ') || '';

    const newClient: ProvisionedClient = {
      id: clientId,
      username: cleanUsername,
      first_name: firstName,
      last_name: lastName,
      otp: generatedOtp,
      trainer_id: TRAINER_ADMIN.user.id,
      trainer_name: `${TRAINER_ADMIN.user.first_name} ${TRAINER_ADMIN.user.last_name}`,
      email: `${cleanUsername.toLowerCase()}@fitnesslogbook.local`,
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
