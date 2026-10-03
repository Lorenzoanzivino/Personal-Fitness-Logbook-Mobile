import { mutationQueue, PendingMutation } from './mutationQueue';
import { apiService } from './api';
import { gymStorage } from './gymStorage';
import { networkStatus } from '../context/NetworkContext';
import { ApiResponse } from '../types/api';

export type SyncCompleteListener = () => void | Promise<void>;

export interface SyncProcessResult {
  processed: number;
  failed: number;
  remaining: number;
}

class SyncEngine {
  private isProcessing = false;
  private listeners: Set<SyncCompleteListener> = new Set();

  /**
   * Registra un listener che viene invocato al completamento del PULL finale
   * (es. per consentire a GymContext di aggiornare il proprio state React)
   */
  onSyncCompleted(listener: SyncCompleteListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifySyncCompleted(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.warn('[SyncService] Errore notifica listener syncCompleted:', err);
      }
    });
  }

  /**
   * Esegue il PULL dal server Fastify verso il local storage (gymStorage)
   */
  async pullLatestData(): Promise<void> {
    try {
      console.log('[SyncService] Avvio PULL dati freschi dal server Fastify...');
      const [routinesRes, workoutsRes, foldersRes, exercisesRes] = await Promise.allSettled([
        apiService.fetchRoutinesByOwner(),
        apiService.fetchWorkoutsByOwner(),
        apiService.fetchFoldersByOwner(),
        apiService.fetchExercises(),
      ]);

      if (routinesRes.status === 'fulfilled' && routinesRes.value.success && routinesRes.value.data) {
        await gymStorage.saveRoutines(routinesRes.value.data);
      }
      if (workoutsRes.status === 'fulfilled' && workoutsRes.value.success && workoutsRes.value.data) {
        await gymStorage.saveWorkouts(workoutsRes.value.data);
      }
      if (foldersRes.status === 'fulfilled' && foldersRes.value.success && foldersRes.value.data) {
        await gymStorage.saveFolders(foldersRes.value.data);
      }
      if (exercisesRes.status === 'fulfilled' && exercisesRes.value.success && exercisesRes.value.data) {
        await gymStorage.saveExercises(exercisesRes.value.data);
      }
      console.log('[SyncService] PULL completato con successo nel local storage.');
    } catch (err) {
      console.warn('[SyncService] Errore durante pullLatestData:', err);
    }
  }

  /**
   * Elabora la coda PENDING in rigoroso ordine FIFO (sequenziale)
   */
  async processQueue(): Promise<SyncProcessResult> {
    // 1. Controllo concorrenza (mutex lock)
    if (this.isProcessing) {
      console.log('[SyncService] Sincronizzazione già in corso. Salto esecuzione concorrente.');
      const remaining = await mutationQueue.count();
      return { processed: 0, failed: 0, remaining };
    }

    // 2. Controllo connettività
    if (!networkStatus.isOnline()) {
      console.log('[SyncService] Dispositivo offline. Sincronizzazione rimandata.');
      const remaining = await mutationQueue.count();
      return { processed: 0, failed: 0, remaining };
    }

    this.isProcessing = true;
    let processed = 0;
    let failed = 0;

    try {
      // 3. Recupero e ordinamento FIFO (dal più vecchio al più recente)
      const queue = await mutationQueue.getQueue();
      if (queue.length === 0) {
        console.log('[SyncService] Coda mutazioni vuota. Nessuna operazione PUSH necessaria.');
        // Se la coda è già vuota, eseguiamo comunque il PULL se online
        await this.pullLatestData();
        this.notifySyncCompleted();
        return { processed: 0, failed: 0, remaining: 0 };
      }

      queue.sort((a, b) => a.timestamp - b.timestamp);
      console.log(`[SyncService] Inizio elaborazione FIFO di ${queue.length} mutazioni...`);

      // 4. Ciclo sequenziale for...of con await (nessun Promise.all per preservare dipendenze)
      for (const mutation of queue) {
        // Verifica ancora la connettività prima di ciascuna richiesta
        if (!networkStatus.isOnline()) {
          console.warn('[SyncService] Connessione persa durante il processing della coda. Sospendo.');
          failed++;
          break;
        }

        let res: ApiResponse<any>;
        try {
          switch (mutation.method) {
            case 'POST':
              res = await apiService.post(mutation.endpoint, mutation.payload, {
                headers: { 'X-Sync-Engine': 'true' },
              });
              break;
            case 'PUT':
              res = await apiService.put(mutation.endpoint, mutation.payload, {
                headers: { 'X-Sync-Engine': 'true' },
              });
              break;
            case 'PATCH':
              res = await apiService.patch(mutation.endpoint, mutation.payload, {
                headers: { 'X-Sync-Engine': 'true' },
              });
              break;
            case 'DELETE':
              res = await apiService.delete(mutation.endpoint, {
                headers: { 'X-Sync-Engine': 'true' },
              });
              break;
            default:
              console.warn(`[SyncService] Metodo HTTP '${mutation.method}' sconosciuto per ${mutation.id}. Rimuovo.`);
              await mutationQueue.dequeue(mutation.id);
              processed++;
              continue;
          }
        } catch (fetchException: any) {
          // Errore di rete o timeout non gestito
          console.warn(`[SyncService] Eccezione di rete per ${mutation.id}:`, fetchException);
          await mutationQueue.incrementRetry(mutation.id);
          failed++;
          break; // Stop immediato del processing sequenziale
        }

        if (res.success) {
          // Successo (200 / 201 OK) -> Rimuovi dalla coda
          console.log(`[SyncService] ✔ Mutazione ${mutation.id} (${mutation.method} ${mutation.endpoint}) sincronizzata con successo.`);
          await mutationQueue.dequeue(mutation.id);
          processed++;
        } else {
          const status = res.error?.status ?? 0;
          const isNetworkOr5xx = status === 0 || status >= 500 || res.error?.code === 'NETWORK_ERROR';

          if (isNetworkOr5xx) {
            // Errore di rete o server 5xx: l'elemento resta in coda con retryCount incrementato
            console.warn(`[SyncService] ⚠️ Errore transitorio (status: ${status}, code: ${res.error?.code}) per ${mutation.id}. Incremento retry e sospendo coda.`);
            await mutationQueue.incrementRetry(mutation.id);
            failed++;
            break; // Stop sequenziale: riproveremo alla prossima connessione
          } else {
            // Errore 4xx (400 Bad Request, 401 Unauthorized, 404, 422, ecc.)
            // Non riprovare all'infinito per payload malformati: logga e rimuovi dalla coda
            console.error(`[SyncService] ❌ Errore 4xx permanente (status: ${status}, code: ${res.error?.code}): ${res.error?.message}. Rimuovo mutazione ${mutation.id}.`);
            await mutationQueue.dequeue(mutation.id);
            processed++;
          }
        }
      }

      // 5. PULL FINALE: Se la coda si è svuotata, aggiorna la cache locale e notifica i contesti
      const remaining = await mutationQueue.count();
      if (remaining === 0) {
        console.log('[SyncService] Coda interamente svuotata! Esecuzione PULL finale dal backend...');
        await this.pullLatestData();
        this.notifySyncCompleted();
      } else {
        console.log(`[SyncService] Processing interrotto: ${remaining} mutazioni rimaste in coda.`);
      }

      return { processed, failed, remaining };
    } finally {
      this.isProcessing = false;
    }
  }
}

export const syncService = new SyncEngine();

/**
 * Esportazione diretta della funzione processQueue come specificato nel task
 */
export const processQueue = (): Promise<SyncProcessResult> => {
  return syncService.processQueue();
};
