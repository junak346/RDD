import { Badge } from '../ui/Badge';
import { CivicPriority, CivicStatus } from '../../types';
import { priorityLabel, priorityTone, statusLabel, statusTone } from '../../utils/civicFormat';

export function StatusBadge({ status }: { status: CivicStatus }) {
  return <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>;
}

export function PriorityBadge({ priority }: { priority: CivicPriority }) {
  return <Badge tone={priorityTone(priority)}>{priorityLabel(priority)}</Badge>;
}
