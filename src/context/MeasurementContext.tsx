import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { BodyMeasurement, CreateBodyMeasurementDto } from '../types/measurement';
import { measurementStorage } from '../services/measurementStorage';

interface MeasurementContextType {
  measurements: BodyMeasurement[];
  latestMeasurement: BodyMeasurement | null;
  loading: boolean;
  addMeasurement: (dto: CreateBodyMeasurementDto) => Promise<BodyMeasurement>;
  deleteMeasurement: (id: number) => Promise<void>;
  clearAllMeasurements: () => Promise<void>;
  reloadMeasurements: () => Promise<void>;
}

const MeasurementContext = createContext<MeasurementContextType | undefined>(undefined);

export const MeasurementProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await measurementStorage.loadMeasurements();
      // Ordina sempre per data decrescente (più recente in cima)
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
  }, []);

  const addMeasurement = async (dto: CreateBodyMeasurementDto): Promise<BodyMeasurement> => {
    const created = await measurementStorage.addMeasurement(dto);
    const updated = [created, ...measurements.filter((m) => m.id !== created.id)].sort(
      (a, b) => (b.recorded_at > a.recorded_at ? 1 : -1)
    );
    setMeasurements(updated);
    return created;
  };

  const deleteMeasurement = async (id: number): Promise<void> => {
    await measurementStorage.deleteMeasurement(id);
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
  };

  const clearAllMeasurements = async (): Promise<void> => {
    await measurementStorage.clearAllMeasurements();
    setMeasurements([]);
  };

  const latestMeasurement = measurements.length > 0 ? measurements[0] : null;

  return (
    <MeasurementContext.Provider
      value={{
        measurements,
        latestMeasurement,
        loading,
        addMeasurement,
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
