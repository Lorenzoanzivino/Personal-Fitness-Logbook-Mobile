export interface DietPdf {
  id: number;
  name: string;
  description?: string | null;
  start_date: string; // YYYY-MM-DD
  end_date?: string | null;
  is_active: number; // 0 | 1
  notes?: string | null;
  source_file_name?: string | null;
  file_path?: string | null;
  file_size?: number | null;
  mime_type: string;
  created_at: string;
  updated_at: string;
}
