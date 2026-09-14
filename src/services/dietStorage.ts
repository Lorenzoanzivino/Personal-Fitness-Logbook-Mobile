import AsyncStorage from '@react-native-async-storage/async-storage';
import { DietPdf } from '../types/diet';

const STORAGE_KEY = '@diets_v2';

export const DEFAULT_DIETS: DietPdf[] = [
  {
    id: 1,
    name: 'Dieta Ipertrofia Inverno 2026',
    description: 'Rilasciata dal nutrizionista sportivo. Target: 2.850 kcal/die, ripartizione 40% Carboidrati, 30% Proteine, 30% Grassi.',
    start_date: '2026-09-01',
    end_date: null,
    is_active: 1,
    notes: 'Focus pre e post workout ad alta digeribilità.',
    source_file_name: 'dieta_ipertrofia_v2.pdf',
    file_path: null,
    file_size: 2450000, // ~2.4 MB
    mime_type: 'application/pdf',
    created_at: '2026-09-01T08:00:00.000Z',
    updated_at: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 2,
    name: 'Fase Cut Estate 2026',
    description: 'Protocollo di definizione ipocalorico pre-estivo. Target: 2.100 kcal/die.',
    start_date: '2026-06-01',
    end_date: '2026-08-31',
    is_active: 0,
    notes: 'Completata con successo.',
    source_file_name: 'fase_cut_estate_2026.pdf',
    file_path: null,
    file_size: 1800000, // ~1.8 MB
    mime_type: 'application/pdf',
    created_at: '2026-06-01T08:00:00.000Z',
    updated_at: '2026-06-01T08:00:00.000Z',
  },
];

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
