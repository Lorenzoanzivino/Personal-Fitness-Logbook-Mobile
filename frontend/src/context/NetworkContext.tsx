import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from 'react';
import NetInfo, {
  NetInfoState,
  NetInfoSubscription,
} from '@react-native-community/netinfo';
import { mutationQueue } from '../services/mutationQueue';
import { syncService } from '../services/SyncService';

export interface NetworkContextType {
  /** True se il dispositivo ha connettività di rete attiva e internet raggiungibile */
  isOnline: boolean;
  /** True se collegato a una rete (WiFi, cellulare, etc.) */
  isConnected: boolean | null;
  /** True se internet è effettivamente raggiungibile */
  isInternetReachable: boolean | null;
  /** Tipo di connessione ('wifi', 'cellular', 'none', etc.) */
  connectionType: string | null;
  /** Numero di mutazioni offline attualmente in attesa di sincronizzazione */
  pendingCount: number;
  /** Aggiorna e restituisce il conteggio delle mutazioni in coda */
  refreshPendingCount: () => Promise<number>;
  /** Esegue un controllo immediato dello stato di connessione */
  checkConnection: () => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

// ============================================================================
// Singleton helper per contesti non-React (es. ApiService, SyncEngine, Storage)
// ============================================================================
type NetworkListener = (isOnline: boolean) => void;
const listeners = new Set<NetworkListener>();
let currentOnlineState = true;

type QueueChangeListener = () => void;
const queueChangeListeners = new Set<QueueChangeListener>();

export const networkStatus = {
  /**
   * Lettura sincrona immediata dello stato online noto
   */
  isOnline(): boolean {
    return currentOnlineState;
  },

  /**
   * Sottoscrizione a variazioni di stato online (utile per SyncService in background)
   */
  subscribe(listener: NetworkListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Notifica i componenti/contesti che la coda delle mutazioni è cambiata (es. nuova mutazione offline)
   */
  notifyQueueChanged(): void {
    queueChangeListeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.warn('Errore listener queueChanged:', err);
      }
    });
  },

  /**
   * Sottoscrizione a modifiche della coda delle mutazioni offline
   */
  onQueueChanged(listener: QueueChangeListener): () => void {
    queueChangeListeners.add(listener);
    return () => queueChangeListeners.delete(listener);
  },

  /**
   * Forza un check attivo con NetInfo
   */
  async checkNow(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      const online = Boolean(
        state.isConnected && state.isInternetReachable !== false
      );
      currentOnlineState = online;
      return online;
    } catch {
      return currentOnlineState;
    }
  },
};

// ============================================================================
// NetworkProvider Component
// ============================================================================
export const NetworkProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(null);
  const [connectionType, setConnectionType] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const wasOnlineRef = useRef<boolean>(true);

  const refreshPendingCount = async (): Promise<number> => {
    try {
      const count = await mutationQueue.count();
      setPendingCount(count);
      return count;
    } catch {
      return 0;
    }
  };

  const handleNetworkChange = (state: NetInfoState) => {
    // In NetInfo, isInternetReachable può essere inizialmente null mentre esegue il probe.
    // Consideriamo online quando isConnected è true e isInternetReachable non è esplicitamente false.
    const online = Boolean(state.isConnected && state.isInternetReachable !== false);
    const isTransitionToOnline = wasOnlineRef.current === false && online === true;

    setIsConnected(state.isConnected);
    setIsInternetReachable(state.isInternetReachable);
    setConnectionType(state.type);
    setIsOnline(online);
    currentOnlineState = online;

    // Notifica eventuali subscriber esterni
    listeners.forEach((listener) => {
      try {
        listener(online);
      } catch (err) {
        console.warn('Errore notifica subscriber networkStatus:', err);
      }
    });

    wasOnlineRef.current = online;

    // Trigger automatico al ritorno della connessione (offline -> online)
    if (isTransitionToOnline) {
      console.log('[NetworkContext] Connessione ripristinata (offline -> online). Avvio SyncService.processQueue()...');
      syncService.processQueue().finally(() => {
        refreshPendingCount();
      });
    }
  };

  useEffect(() => {
    // 1. Fetch dello stato iniziale
    NetInfo.fetch().then((initialState) => {
      handleNetworkChange(initialState);
      const isCurrentlyOnline = Boolean(
        initialState.isConnected && initialState.isInternetReachable !== false
      );
      if (isCurrentlyOnline) {
        mutationQueue.count().then((count) => {
          if (count > 0) {
            console.log(`[NetworkContext] Rilevate ${count} mutazioni in coda all'avvio. Avvio sync...`);
            syncService.processQueue().finally(() => {
              refreshPendingCount();
            });
          }
        });
      }
    });

    // 2. Listener continuo per cambi di connettività
    const unsubscribeNetInfo: NetInfoSubscription = NetInfo.addEventListener(handleNetworkChange);

    // 3. Listener per aggiornare il conteggio pendenti ogni volta che il SyncEngine completa
    const unsubscribeSync = syncService.onSyncCompleted(() => {
      refreshPendingCount();
    });

    // 4. Listener per aggiornamenti immediati quando una mutazione viene accodata offline
    const unsubscribeQueue = networkStatus.onQueueChanged(() => {
      refreshPendingCount();
    });

    // 5. Conteggio iniziale della coda mutazioni
    refreshPendingCount();

    return () => {
      unsubscribeNetInfo();
      unsubscribeSync();
      unsubscribeQueue();
    };
  }, []);

  const checkConnection = async (): Promise<boolean> => {
    const state = await NetInfo.fetch();
    handleNetworkChange(state);
    return Boolean(state.isConnected && state.isInternetReachable !== false);
  };

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        isConnected,
        isInternetReachable,
        connectionType,
        pendingCount,
        refreshPendingCount,
        checkConnection,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork deve essere usato all\'interno di un NetworkProvider');
  }
  return context;
};
