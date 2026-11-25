import { api, apiGet } from './api';
import { PublicReportStatus } from '../types';

export interface CapturedReportLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
}

export interface PublicReportConfig {
  camera: string;
  location: string;
  maxImageBytes: number;
  acceptedImageTypes: string[];
  secureContextRequired: boolean;
  modelConfidenceThreshold: number;
  privacyNotice: string;
}

export const reportsService = {
  /** Upload is only called after the citizen confirms the camera photo. */
  async create(
    image: Blob,
    location: CapturedReportLocation,
    onUploadProgress?: (fraction: number) => void,
  ): Promise<PublicReportStatus> {
    const form = new FormData();
    form.append('image', image, `road-capture-${Date.now()}.jpg`);
    form.append('location', JSON.stringify(location));
    const response = await api.post<{ report: PublicReportStatus }>(
      '/public/reports',
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: false,
        onUploadProgress: (event) => {
          if (onUploadProgress && event.total) {
            onUploadProgress(Math.min(1, event.loaded / event.total));
          }
        },
      },
    );
    return response.data.report;
  },

  async status(publicReportId: string): Promise<PublicReportStatus> {
    const data = await apiGet<{ report: PublicReportStatus }>(
      `/public/reports/${encodeURIComponent(publicReportId.trim().toUpperCase())}/status`,
    );
    return data.report;
  },

  async config(): Promise<PublicReportConfig> {
    return apiGet<PublicReportConfig>('/public/config');
  },

  rememberReportId(publicReportId: string): void {
    try {
      sessionStorage.setItem('rdd.lastReportId', publicReportId);
    } catch {
      // Non-essential convenience for the tracking form.
    }
  },

  rememberedReportId(): string {
    try {
      return sessionStorage.getItem('rdd.lastReportId') ?? '';
    } catch {
      return '';
    }
  },
};
