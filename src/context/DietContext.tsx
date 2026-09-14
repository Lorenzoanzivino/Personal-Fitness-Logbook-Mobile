import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { DietPdf } from '../types/diet';
import { dietStorage } from '../services/dietStorage';

interface DietContextType {
  diets: DietPdf[];
  activeDiet: DietPdf | null;
  loading: boolean;
  addDiet: (data: Omit<DietPdf, 'id' | 'created_at' | 'updated_at'>) => Promise<DietPdf>;
  setActiveDiet: (id: number) => Promise<void>;
  deleteDiet: (id: number) => Promise<void>;
  clearAllDiets: () => Promise<void>;
  reloadDiets: () => Promise<void>;
}

const DietContext = createContext<DietContextType | undefined>(undefined);

export const DietProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [diets, setDiets] = useState<DietPdf[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await dietStorage.loadDiets();
      setDiets(list);
    } catch (err) {
      console.warn('Errore caricamento diete:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const addDiet = async (
    data: Omit<DietPdf, 'id' | 'created_at' | 'updated_at'>
  ): Promise<DietPdf> => {
    const created = await dietStorage.addDiet(data);
    const updated = await dietStorage.loadDiets();
    setDiets(updated);
    return created;
  };

  const setActiveDiet = async (id: number): Promise<void> => {
    await dietStorage.setActiveDiet(id);
    const updated = await dietStorage.loadDiets();
    setDiets(updated);
  };

  const deleteDiet = async (id: number): Promise<void> => {
    await dietStorage.deleteDiet(id);
    setDiets((prev) => prev.filter((d) => d.id !== id));
  };

  const clearAllDiets = async (): Promise<void> => {
    await dietStorage.clearAllDiets();
    setDiets([]);
  };

  const activeDiet = diets.find((d) => d.is_active === 1) || (diets.length > 0 ? diets[0] : null);

  return (
    <DietContext.Provider
      value={{
        diets,
        activeDiet,
        loading,
        addDiet,
        setActiveDiet,
        deleteDiet,
        clearAllDiets,
        reloadDiets: loadData,
      }}
    >
      {children}
    </DietContext.Provider>
  );
};

export const useDiet = (): DietContextType => {
  const context = useContext(DietContext);
  if (!context) {
    throw new Error('useDiet deve essere usato all\'interno di un DietProvider');
  }
  return context;
};
