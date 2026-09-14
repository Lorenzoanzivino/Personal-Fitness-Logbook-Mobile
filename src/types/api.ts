export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
}

// DTO per generazione codice invito OTP (Trainer)
export interface GenerateOtpResponseDto {
  code: string; // Codice alfanumerico di 6 caratteri
  expires_at: string; // ISO string
  trainer_id: string;
  trainer_name: string;
}

// DTO per pairing Cliente -> Trainer con codice OTP
export interface LinkClientRequestDto {
  client_id: string;
  client_name: string;
  otp_code: string;
}

export interface LinkClientResponseDto {
  success: boolean;
  trainer: {
    id: string;
    name: string;
  };
  client: {
    id: string;
    name: string;
  };
}

// DTO per query schede filtrate per owner_id
export interface RoutinesFilterDto {
  owner_id?: string;
}
