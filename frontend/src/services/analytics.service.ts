import { apiGet } from './api';
import { DistributionResult, MapReport, SummaryStats, TimeseriesPoint } from '../types';

export interface AnalyticsParams {
  damageType?: string;
  severity?: string;
  from?: string;
  to?: string;
}

export const analyticsService = {
  summary(params: AnalyticsParams = {}): Promise<SummaryStats> {
    return apiGet<SummaryStats>('/analytics/summary', params as Record<string, unknown>);
  },

  timeseries(params: AnalyticsParams & { interval?: 'day' | 'week' | 'month' } = {}) {
    return apiGet<{ interval: string; points: TimeseriesPoint[] }>('/analytics/timeseries', params as Record<string, unknown>);
  },

  distribution(params: AnalyticsParams = {}): Promise<DistributionResult> {
    return apiGet<DistributionResult>('/analytics/distribution', params as Record<string, unknown>);
  },

  mapReports(params: AnalyticsParams = {}) {
    return apiGet<{ reports: MapReport[] }>('/maps/reports', params as Record<string, unknown>);
  },
};
