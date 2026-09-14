import { API_CONFIG, getApiEndpoint } from './config';
import { ApiResponse } from '../types/api';

class ApiService {
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = getApiEndpoint(path);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);

    try {
      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {}),
      };

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const json = await response.json();
        return json as ApiResponse<T>;
      }

      if (!response.ok) {
        return {
          success: false,
          data: null,
          error: {
            code: `HTTP_${response.status}`,
            message: `Richiesta fallita con codice ${response.status}`,
          },
        };
      }

      return {
        success: true,
        data: null,
        error: null,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const message = err instanceof Error ? err.message : 'Errore sconosciuto di rete';
      return {
        success: false,
        data: null,
        error: {
          code: 'NETWORK_ERROR',
          message,
        },
      };
    }
  }

  async get<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'GET' });
  }

  async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const apiService = new ApiService();
