import { api, apiDelete, apiGet, apiPatch } from './api';
import { Inspection, InspectionListResult, InspectionLocation } from '../types';

export interface ListInspectionsParams {
  page?: number;
  limit?: number;
  search?: string;
  damageType?: string;
  severity?: string;
  sort?: string;
  from?: string;
  to?: string;
}

export const inspectionsService = {
  async list(params: ListInspectionsParams = {}): Promise<InspectionListResult> {
    return apiGet<InspectionListResult>('/inspections', params as Record<string, unknown>);
  },

  async get(id: string): Promise<Inspection> {
    const data = await apiGet<{ inspection: Inspection }>(`/inspections/${id}`);
    return data.inspection;
  },

  async recent(limit = 5): Promise<Inspection[]> {
    const data = await apiGet<{ items: Inspection[] }>('/inspections/recent', { limit });
    return data.items;
  },

  /**
   * Upload + analyse. `onUploadProgress` receives real axios upload progress
   * (analysis time itself is indeterminate — the UI reflects that honestly).
   */
  async create(
    file: File,
    location: InspectionLocation | null,
    onUploadProgress?: (fraction: number) => void,
  ): Promise<Inspection> {
    const form = new FormData();
    form.append('image', file);
    if (location) {
      form.append('latitude', String(location.latitude));
      form.append('longitude', String(location.longitude));
      if (location.address) form.append('address', location.address);
    }

    const response = await api.post<{ inspection: Inspection }>('/inspections', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (onUploadProgress && event.total) {
          onUploadProgress(Math.min(1, event.loaded / event.total));
        }
      },
    });
    return response.data.inspection;
  },

  async setLocation(id: string, location: InspectionLocation): Promise<Inspection> {
    const data = await apiPatch<{ inspection: Inspection }>(`/inspections/${id}/location`, location);
    return data.inspection;
  },

  async remove(id: string): Promise<void> {
    await apiDelete(`/inspections/${id}`);
  },
};
