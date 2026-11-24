/**
 * Axios client for the versioned REST API.
 * All responses are unwrapped from the { success, data, meta } envelope and
 * failures are normalised into AppError with stable machine-readable codes.
 */
import axios, { AxiosError, AxiosInstance } from 'axios';

import { ApiFailure, AppError, ResponseMeta } from '../types';

const TOKEN_KEY = 'rdd.token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private-mode browsers may block storage — the session simply won't persist.
  }
}

/** Latest meta from any API response — drives the honest DEMO MODE banner. */
let lastMeta: ResponseMeta | null = null;
const metaListeners = new Set<(meta: ResponseMeta) => void>();

export function onApiMeta(listener: (meta: ResponseMeta) => void): () => void {
  metaListeners.add(listener);
  return () => metaListeners.delete(listener);
}

export function getLastMeta(): ResponseMeta | null {
  return lastMeta;
}

export const api: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  timeout: 90_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((request) => {
  const token = getStoredToken();
  if (token) {
    request.headers.Authorization = `Bearer ${token}`;
  }
  return request;
});

api.interceptors.response.use(
  (response) => {
    const body = response.data as { meta?: ResponseMeta };
    if (body?.meta) {
      lastMeta = body.meta;
      metaListeners.forEach((listener) => listener(body.meta as ResponseMeta));
    }
    // Unwrap the envelope: callers receive `data` directly.
    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
      response.data = (response.data as { data: unknown }).data;
    }
    return response;
  },
  (error: AxiosError<ApiFailure>) => {
    if (error.response?.data?.success === false) {
      const failure = error.response.data.error;
      return Promise.reject(
        new AppError(failure.code, failure.message, error.response.status, failure.details),
      );
    }
    if (error.response) {
      return Promise.reject(
        new AppError('HTTP_ERROR', `Request failed with status ${error.response.status}.`, error.response.status),
      );
    }
    return Promise.reject(
      new AppError('NETWORK_ERROR', 'Unable to reach the server — check your connection and try again.'),
    );
  },
);

/** Convenience helpers with typed data. */
export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await api.get<T>(url, { params });
  return response.data;
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const response = await api.post<T>(url, body);
  return response.data;
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const response = await api.patch<T>(url, body);
  return response.data;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const response = await api.delete<T>(url);
  return response.data;
}
