import AsyncStorage from '@react-native-async-storage/async-storage';

export type HttpMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface PendingMutation {
  id: string;
  timestamp: number;
  method: HttpMethod;
  endpoint: string;
  payload?: any;
  retryCount?: number;
  description?: string;
  entityType?: 'routine' | 'workout' | 'folder' | 'measurement' | 'generic';
}

export const STORAGE_KEY_PENDING_MUTATIONS = '@fitness_pending_mutations_v1';

export const mutationQueue = {
  /**
   * Restituisce tutte le mutazioni attualmente in coda
   */
  async getQueue(): Promise<PendingMutation[]> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY_PENDING_MUTATIONS);
      if (!json) return [];
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('Errore lettura coda mutazioni offline:', e);
      return [];
    }
  },

  /**
   * Aggiunge una nuova mutazione in fondo alla coda
   */
  async enqueue(
    mutation: Omit<PendingMutation, 'id' | 'timestamp'>
  ): Promise<PendingMutation> {
    try {
      const current = await this.getQueue();
      const newMutation: PendingMutation = {
        ...mutation,
        id: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        timestamp: Date.now(),
        retryCount: mutation.retryCount ?? 0,
      };
      const updated = [...current, newMutation];
      await AsyncStorage.setItem(
        STORAGE_KEY_PENDING_MUTATIONS,
        JSON.stringify(updated)
      );
      return newMutation;
    } catch (e) {
      console.warn('Errore aggiunta mutazione alla coda offline:', e);
      throw e;
    }
  },

  /**
   * Rimuove una specifica mutazione dalla coda (es. sincronizzazione riuscita)
   */
  async dequeue(id: string): Promise<void> {
    try {
      const current = await this.getQueue();
      const updated = current.filter((m) => m.id !== id);
      await AsyncStorage.setItem(
        STORAGE_KEY_PENDING_MUTATIONS,
        JSON.stringify(updated)
      );
    } catch (e) {
      console.warn('Errore rimozione mutazione dalla coda offline:', e);
    }
  },

  /**
   * Rimuove più mutazioni in blocco per ID
   */
  async removeMultiple(ids: string[]): Promise<void> {
    try {
      const idSet = new Set(ids);
      const current = await this.getQueue();
      const updated = current.filter((m) => !idSet.has(m.id));
      await AsyncStorage.setItem(
        STORAGE_KEY_PENDING_MUTATIONS,
        JSON.stringify(updated)
      );
    } catch (e) {
      console.warn('Errore rimozione multipla mutazioni offline:', e);
    }
  },

  /**
   * Incrementa il contatore dei retry per una mutazione fallita
   */
  async incrementRetry(id: string): Promise<void> {
    try {
      const current = await this.getQueue();
      const updated = current.map((m) =>
        m.id === id ? { ...m, retryCount: (m.retryCount || 0) + 1 } : m
      );
      await AsyncStorage.setItem(
        STORAGE_KEY_PENDING_MUTATIONS,
        JSON.stringify(updated)
      );
    } catch (e) {
      console.warn('Errore aggiornamento retry count mutazione:', e);
    }
  },

  /**
   * Svuota completamente la coda delle mutazioni
   */
  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_PENDING_MUTATIONS);
    } catch (e) {
      console.warn('Errore pulizia coda mutazioni offline:', e);
    }
  },

  /**
   * Restituisce il conteggio degli elementi in coda
   */
  async count(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  },

  /**
   * Restituisce la mutazione più vecchia in coda senza rimuoverla
   */
  async peek(): Promise<PendingMutation | null> {
    const queue = await this.getQueue();
    return queue.length > 0 ? queue[0] : null;
  },
};
