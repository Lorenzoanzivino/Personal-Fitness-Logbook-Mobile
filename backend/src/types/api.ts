export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error?: ApiError | null;
}

export interface GenerateOtpResponseDto {
  code: string;
  expires_at: string;
  trainer_id: string;
  trainer_name: string;
}

export interface LinkClientRequestDto {
  otp_code: string;
  client_id: string;
  client_name: string;
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
