import { CivicPriority, CivicStatus } from '../types';

export function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function priorityLabel(priority: string): string {
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

export function statusTone(status: CivicStatus): BadgeTone {
  switch (status) {
    case 'RESOLVED':
    case 'CLOSED':
      return 'success';
    case 'REJECTED':
      return 'danger';
    case 'IN_PROGRESS':
    case 'ASSIGNED':
      return 'info';
    case 'UNDER_REVIEW':
    case 'VERIFIED':
      return 'warning';
    case 'AI_ANALYSIS':
    case 'AI_ANALYSED':
      return 'brand';
    default:
      return 'neutral';
  }
}

export function priorityTone(priority: CivicPriority): BadgeTone {
  switch (priority) {
    case 'CRITICAL':
      return 'danger';
    case 'HIGH':
      return 'warning';
    case 'MEDIUM':
      return 'brand';
    default:
      return 'neutral';
  }
}

export function severityTone(severity: string | null): BadgeTone {
  if (severity === 'high') return 'danger';
  if (severity === 'moderate') return 'warning';
  if (severity === 'low') return 'success';
  return 'neutral';
}
