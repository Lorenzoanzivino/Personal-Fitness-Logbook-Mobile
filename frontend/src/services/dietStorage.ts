import AsyncStorage from '@react-native-async-storage/async-storage';
import { DietPdf } from '../types/diet';

const STORAGE_KEY = '@diets_v3';

export const DEFAULT_DIETS: DietPdf[] = [];

export const dietStorage = {
  async loadDiets(): Promise<DietPdf[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DIETS));
      return DEFAULT_DIETS;
    } catch (e) {
      console.warn('Errore lettura diete da AsyncStorage:', e);
      return DEFAULT_DIETS;
    }
  },

  async saveDiets(diets: DietPdf[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(diets));
    } catch (e) {
      console.warn('Errore salvataggio diete su AsyncStorage:', e);
    }
  },

  async addDiet(data: Omit<DietPdf, 'id' | 'created_at' | 'updated_at'>): Promise<DietPdf> {
    const list = await this.loadDiets();
    const newId = list.length > 0 ? Math.max(...list.map((d) => d.id)) + 1 : 1;
    const now = new Date().toISOString();

    // Se la nuova dieta è attiva, disattiva le altre
    let updatedList = list;
    if (data.is_active === 1) {
      updatedList = list.map((d) => ({ ...d, is_active: 0 }));
    }

    const newDiet: DietPdf = {
      ...data,
      id: newId,
      created_at: now,
      updated_at: now,
    };

    const finalList = [newDiet, ...updatedList];
    await this.saveDiets(finalList);
    return newDiet;
  },

  async setActiveDiet(id: number): Promise<void> {
    const list = await this.loadDiets();
    const updated = list.map((d) => ({
      ...d,
      is_active: d.id === id ? 1 : 0,
      updated_at: new Date().toISOString(),
    }));
    await this.saveDiets(updated);
  },

  async deleteDiet(id: number): Promise<void> {
    const list = await this.loadDiets();
    const updated = list.filter((d) => d.id !== id);
    await this.saveDiets(updated);
  },

  async clearAllDiets(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Errore pulizia diete:', e);
    }
  },
};
