import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { BodyMeasurement, CreateBodyMeasurementDto } from '../types/measurement';
import { measurementStorage } from '../services/measurementStorage';
import { apiService } from '../services/api';
import { useAuth } from './AuthContext';
import { useGym } from './GymContext';

interface MeasurementContextType {
  measurements: BodyMeasurement[];
  latestMeasurement: BodyMeasurement | null;
  loading: boolean;
  isReadOnly: boolean;
  activeOwnerName?: string;
  addMeasurement: (dto: CreateBodyMeasurementDto) => Promise<BodyMeasurement>;
  updateMeasurement: (
    id: number,
    dto: Partial<CreateBodyMeasurementDto>
  ) => Promise<BodyMeasurement | null>;
  deleteMeasurement: (id: number) => Promise<void>;
  clearAllMeasurements: () => Promise<void>;
  reloadMeasurements: () => Promise<void>;
}

const MeasurementContext = createContext<MeasurementContextType | undefined>(undefined);

export const MeasurementProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { selectedClient } = useGym();

  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(true);

  // Il Trainer consulta i dati dell'atleta in modalità sola lettura
  const isViewingAthlete = Boolean(user?.role === 'TRAINER' && selectedClient);
  const isReadOnly = isViewingAthlete;
  const activeOwnerName = isViewingAthlete ? selectedClient!.name : undefined;

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Caso: Trainer che consulta un atleta delegato
      if (isViewingAthlete && selectedClient) {
        try {
          const remoteRes = await apiService.fetchMeasurements(selectedClient.id);
          if (remoteRes.success && remoteRes.data) {
            const sorted = [...remoteRes.data].sort((a, b) => (b.recorded_at > a.recorded_at ? 1 : -1));
            setMeasurements(sorted);
            await measurementStorage.saveMeasurements(sorted, selectedClient.id);
            return;
          }
        } catch (e) {
          console.warn('Errore fetch misurazioni atleta da backend:', e);
        }

        // Fallback locale su cache isolata dell'atleta
        const list = await measurementStorage.loadMeasurements(selectedClient.id);
        const sorted = [...list].sort((a, b) => (b.recorded_at > a.recorded_at ? 1 : -1));
        setMeasurements(sorted);
        return;
      }

      // 2. Caso: Utente corrente (Cliente sui propri dati, o Trainer sui propri dati personali)
      const currentUserId = user?.id || 'default';
      try {
        const remoteRes = await apiService.fetchMeasurements();
        if (remoteRes.success && remoteRes.data) {
          const sorted = [...remoteRes.data].sort((a, b) => (b.recorded_at > a.recorded_at ? 1 : -1));
          setMeasurements(sorted);
          await measurementStorage.saveMeasurements(sorted, currentUserId);
          return;
        }
      } catch (e) {
        console.warn('Errore fetch misurazioni personali da backend:', e);
      }

      // Fallback su storage locale isolato per utente
      const list = await measurementStorage.loadMeasurements(currentUserId);
      const sorted = [...list].sort((a, b) => (b.recorded_at > a.recorded_at ? 1 : -1));
      setMeasurements(sorted);
    } catch (err) {
      console.warn('Errore caricamento misurazioni:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id, selectedClient?.id]);

  const addMeasurement = async (dto: CreateBodyMeasurementDto): Promise<BodyMeasurement> => {
    if (isReadOnly) {
      throw new Error(
        "Azione non consentita: le misurazioni dell'atleta sono consultabili esclusivamente in sola lettura."
      );
    }
    const currentUserId = user?.id || 'default';

    let remoteItem: BodyMeasurement | null = null;
    try {
      const res = await apiService.addMeasurement(dto);
      if (res.success && res.data) {
        remoteItem = res.data;
      }
    } catch (err) {
      console.warn('Errore salvataggio misurazione su backend:', err);
    }

    const created = remoteItem || (await measurementStorage.addMeasurement(dto, currentUserId));
    const updated = [created, ...measurements.filter((m) => m.id !== created.id)].sort(
      (a, b) => (b.recorded_at > a.recorded_at ? 1 : -1)
    );
    setMeasurements(updated);
    if (remoteItem) {
      await measurementStorage.saveMeasurements(updated, currentUserId);
    }
    return created;
  };

  const updateMeasurement = async (
    id: number,
    dto: Partial<CreateBodyMeasurementDto>
  ): Promise<BodyMeasurement | null> => {
    if (isReadOnly) {
      throw new Error(
        "Azione non consentita: le misurazioni dell'atleta sono consultabili esclusivamente in sola lettura."
      );
    }
    const currentUserId = user?.id || 'default';

    try {
      await apiService.updateMeasurement(id, dto);
    } catch (err) {
      console.warn('Errore aggiornamento misurazione su backend:', err);
    }

    const updated = await measurementStorage.updateMeasurement(id, dto, currentUserId);
    if (updated) {
      const newList = measurements
        .map((m) => (m.id === id ? updated : m))
        .sort((a, b) => (b.recorded_at > a.recorded_at ? 1 : -1));
      setMeasurements(newList);
    }
    return updated;
  };

  const deleteMeasurement = async (id: number): Promise<void> => {
    if (isReadOnly) {
      throw new Error(
        "Azione non consentita: le misurazioni dell'atleta sono consultabili esclusivamente in sola lettura."
      );
    }
    const currentUserId = user?.id || 'default';

    try {
      await apiService.deleteMeasurement(id);
    } catch (err) {
      console.warn('Errore cancellazione misurazione su backend:', err);
    }

    await measurementStorage.deleteMeasurement(id, currentUserId);
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
  };

  const clearAllMeasurements = async (): Promise<void> => {
    if (isReadOnly) {
      throw new Error(
        "Azione non consentita: le misurazioni dell'atleta sono consultabili esclusivamente in sola lettura."
      );
    }
    const currentUserId = user?.id || 'default';
    await measurementStorage.clearAllMeasurements(currentUserId);
    setMeasurements([]);
  };

  const latestMeasurement = measurements.length > 0 ? measurements[0] : null;

  return (
    <MeasurementContext.Provider
      value={{
        measurements,
        latestMeasurement,
        loading,
        isReadOnly,
        activeOwnerName,
        addMeasurement,
        updateMeasurement,
        deleteMeasurement,
        clearAllMeasurements,
        reloadMeasurements: loadData,
      }}
    >
      {children}
    </MeasurementContext.Provider>
  );
};

export const useMeasurements = (): MeasurementContextType => {
  const context = useContext(MeasurementContext);
  if (!context) {
    throw new Error('useMeasurements deve essere usato all\'interno di un MeasurementProvider');
  }
  return context;
};
