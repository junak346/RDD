/**
 * Separate axios client for the hidden government portal. It never reads the
 * citizen JWT from localStorage; official auth uses credentialed, SameSite
 * cookies plus a double-submit CSRF header.
 */
import axios, { AxiosError, AxiosInstance } from 'axios';

import { ApiFailure, AppError } from '../types';

const CSRF_STORAGE_KEY = 'rdd.official.csrf';
const CSRF_COOKIE = 'rdd_official_csrf';

export function setOfficialCsrfToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(CSRF_STORAGE_KEY, token);
    else sessionStorage.removeItem(CSRF_STORAGE_KEY);
  } catch {
    // Private mode may block storage; the readable CSRF cookie is the fallback.
  }
}

function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const entry = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CSRF_COOKIE}=`));
  if (!entry) return null;
  try {
    return decodeURIComponent(entry.slice(CSRF_COOKIE.length + 1));
  } catch {
    return entry.slice(CSRF_COOKIE.length + 1);
  }
}

export function getOfficialCsrfToken(): string | null {
  try {
    const stored = sessionStorage.getItem(CSRF_STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // Fall through to the cookie.
  }
  return readCsrfCookie();
}

export const officialApi: AxiosInstance = axios.create({
  baseURL: '/api/v1/official',
  timeout: 90_000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

officialApi.interceptors.request.use((request) => {
  const csrf = getOfficialCsrfToken();
  if (csrf) request.headers['X-CSRF-Token'] = csrf;
  return request;
});

officialApi.interceptors.response.use(
  (response) => {
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
      new AppError('NETWORK_ERROR', 'Unable to reach the official service — please try again.'),
    );
  },
);

export async function officialGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await officialApi.get<T>(url, { params });
  return response.data;
}

export async function officialPost<T>(url: string, body?: unknown): Promise<T> {
  const response = await officialApi.post<T>(url, body);
  return response.data;
}

export async function officialPatch<T>(url: string, body?: unknown): Promise<T> {
  const response = await officialApi.patch<T>(url, body);
  return response.data;
}
