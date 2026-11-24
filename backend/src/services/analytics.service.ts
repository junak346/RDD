/**
 * Analytics and map aggregations — all numbers are computed from stored
 * inspections, never hardcoded.
 */
import { getRepositories } from '../repositories';
import { AnalyticsFilter, Severity } from '../types/domain';

export interface AnalyticsInput {
  userId: string;
  isAdmin: boolean;
  damageType?: string;
  severity?: Severity;
  from?: Date;
  to?: Date;
}

function toFilter(input: AnalyticsInput): AnalyticsFilter {
  return {
    userId: input.isAdmin ? undefined : input.userId,
    damageType: input.damageType,
    severity: input.severity,
    from: input.from,
    to: input.to,
  };
}

export const analyticsService = {
  async summary(input: AnalyticsInput) {
    const repos = getRepositories();
    return repos.inspections.summary(toFilter(input));
  },

  async timeseries(input: AnalyticsInput, interval: 'day' | 'week' | 'month') {
    const repos = getRepositories();
    return repos.inspections.timeseries(toFilter(input), interval);
  },

  async distribution(input: AnalyticsInput) {
    const repos = getRepositories();
    return repos.inspections.distribution(toFilter(input));
  },

  async mapReports(input: AnalyticsInput) {
    const repos = getRepositories();
    const reports = await repos.inspections.mapReports(toFilter(input));
    return reports.map((report) => ({
      ...report,
      timestamp: report.timestamp.toISOString(),
      // Reference back to the inspection (images stay behind auth).
      inspectionUrl: `/api/v1/inspections/${report.inspectionId}`,
    }));
  },
};
