import {
  CivicPaged,
  GovernmentAnalytics,
  GovernmentAuditLog,
  GovernmentDashboard,
  GovernmentDepartment,
  GovernmentIncident,
  GovernmentMapReport,
  GovernmentNotifications,
  GovernmentOfficial,
  GovernmentRole,
  GovernmentSettings,
  OfficialReport,
  OfficialSettingsView,
  OfficialReportFilters,
  PublicReportStatus,
} from '../types';

import {
  officialApi,
  officialGet,
  officialPatch,
  officialPost,
  setOfficialCsrfToken,
} from './officialApi';

export interface OfficialLoginResult {
  official: GovernmentOfficial;
  csrfToken: string;
  expiresIn: string;
}

export type OfficialActionName =
  | 'VERIFY_REPORT'
  | 'REJECT_REPORT'
  | 'ASSIGN_DEPARTMENT'
  | 'ASSIGN_OFFICIAL'
  | 'CHANGE_PRIORITY'
  | 'MARK_IN_PROGRESS'
  | 'ADD_INTERNAL_NOTE'
  | 'REQUEST_INSPECTION'
  | 'MARK_RESOLVED'
  | 'CLOSE_CASE'
  | 'STATUS_UPDATE'
  | 'BULK_STATUS_UPDATE';

export interface OfficialConfigPatch {
  slaRules?: Record<string, number>;
  priorityConfiguration?: Record<string, string>;
  duplicateRadiusMeters?: number;
  duplicateWindowHours?: number;
  modelConfiguration?: { confidenceThreshold?: number };
}

export interface OfficialActionInput {
  action: OfficialActionName;
  status?: string;
  priority?: string;
  departmentId?: string;
  assignedOfficialId?: string;
  dueAt?: string;
  note?: string;
  reason?: string;
  reportIds?: string[];
}

export interface InternalEvent {
  id: string;
  type: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

export const officialService = {
  async login(email: string, password: string): Promise<OfficialLoginResult> {
    const result = await officialPost<OfficialLoginResult>('/auth/login', { email, password });
    setOfficialCsrfToken(result.csrfToken);
    return result;
  },

  async logout(): Promise<void> {
    try {
      await officialPost('/auth/logout');
    } finally {
      setOfficialCsrfToken(null);
    }
  },

  me(): Promise<{ official: GovernmentOfficial }> {
    return officialGet('/auth/me');
  },

  dashboard(): Promise<GovernmentDashboard> {
    return officialGet('/dashboard');
  },

  notifications(): Promise<GovernmentNotifications> {
    return officialGet('/notifications');
  },

  reports(filters: OfficialReportFilters = {}): Promise<CivicPaged<OfficialReport>> {
    return officialGet('/reports', filters as Record<string, unknown>);
  },

  report(id: string): Promise<{ report: OfficialReport }> {
    return officialGet(`/reports/${id}`);
  },

  exactLocation(id: string): Promise<{ location: OfficialReport['exactLocation'] }> {
    return officialGet(`/reports/${id}/location`);
  },

  map(): Promise<{ reports: GovernmentMapReport[] }> {
    return officialGet('/map/reports');
  },

  analytics(): Promise<GovernmentAnalytics> {
    return officialGet('/analytics');
  },

  incidents(): Promise<{ incidents: GovernmentIncident[] }> {
    return officialGet('/incidents');
  },

  departments(): Promise<{ departments: GovernmentDepartment[] }> {
    return officialGet('/departments');
  },

  createDepartment(input: { name: string; code: string; description?: string }): Promise<{ department: GovernmentDepartment }> {
    return officialPost('/departments', input);
  },

  updateDepartment(id: string, input: Partial<{ name: string; code: string; description: string }>): Promise<{ department: GovernmentDepartment }> {
    return officialPatch(`/departments/${id}`, input);
  },

  officials(): Promise<{ officials: GovernmentOfficial[] }> {
    return officialGet('/officials');
  },

  createOfficial(input: {
    name: string;
    email: string;
    department: string;
    designation: string;
    role: GovernmentRole;
    password: string;
  }): Promise<{ official: GovernmentOfficial }> {
    return officialPost('/officials', input);
  },

  settings(): Promise<GovernmentSettings> {
    return officialGet('/config');
  },

  config(): Promise<OfficialSettingsView> {
    return officialGet('/config');
  },

  updateSettings(input: OfficialConfigPatch): Promise<GovernmentSettings> {
    return officialPatch('/config', input);
  },

  updateConfig(input: OfficialConfigPatch): Promise<OfficialSettingsView> {
    return officialPatch('/config', input);
  },

  auditLogs(reportId?: string, limit = 100): Promise<{ logs: GovernmentAuditLog[] }> {
    return officialGet('/audit-logs', { reportId, limit });
  },

  events(limit = 50): Promise<{ events: InternalEvent[] }> {
    return officialGet('/events', { limit });
  },

  performAction(id: string, input: OfficialActionInput): Promise<{ report: OfficialReport }> {
    return officialPost(`/reports/${id}/actions`, input);
  },

  bulkStatus(reportIds: string[], status: string, note?: string): Promise<{ report: OfficialReport; updated: number }> {
    return officialPost('/reports/bulk/status', {
      action: 'BULK_STATUS_UPDATE',
      reportIds,
      status,
      note,
    });
  },

  exportCsvUrl(filters: OfficialReportFilters = {}): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    }
    const query = params.toString();
    return `/api/v1/official/reports/export.csv${query ? `?${query}` : ''}`;
  },

  /** Authenticated image URLs rely on the httpOnly SameSite cookie, not a token in the URL. */
  async imageBlobUrl(url: string): Promise<string> {
    const response = await officialApi.get<Blob>(url, { responseType: 'blob' });
    return URL.createObjectURL(response.data);
  },
};

/** Re-exported for public status previews in the success page. */
export type { PublicReportStatus };
