import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ClipboardList, Trash2 } from 'lucide-react';

import { PageHeader } from '../components/layout/AppShell';
import { Badge, SeverityBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { SkeletonTable } from '../components/ui/Skeleton';
import { useDebounce } from '../hooks/useDebounce';
import { inspectionsService } from '../services/inspections.service';
import { useToast } from '../stores/toast';
import { Inspection } from '../types';
import { classLabel, formatDateTime, formatPercent, truncateId } from '../utils/format';

export function HistoryPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [damageType, setDamageType] = useState('');
  const [severity, setSeverity] = useState('');
  const [sort, setSort] = useState('createdAt_desc');
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<Inspection | null>(null);

  const debouncedSearch = useDebounce(search, 350);

  const list = useQuery({
    queryKey: ['inspections', 'list', debouncedSearch, damageType, severity, sort, page],
    queryFn: () =>
      inspectionsService.list({
        search: debouncedSearch || undefined,
        damageType: damageType || undefined,
        severity: severity || undefined,
        sort,
        page,
        limit: 10,
      }),
    placeholderData: (previous) => previous,
  });

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await inspectionsService.remove(toDelete.id);
      toast.success('Inspection deleted');
      list.refetch();
    } catch {
      toast.error('Delete failed', 'The inspection could not be removed.');
    } finally {
      setToDelete(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Inspection history"
        description="Search, filter and review every analysis on your account."
        actions={
          <Button size="sm" onClick={() => navigate('/app/analyze')}>
            New analysis
          </Button>
        }
      />

      <Card className="mb-5" padded>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Search"
            name="search"
            placeholder="Address, damage type, id…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Damage type"
            name="damageType"
            value={damageType}
            onChange={(event) => {
              setDamageType(event.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All types' },
              { value: 'pothole', label: 'Pothole' },
              { value: 'crack', label: 'Crack' },
              { value: 'surface_damage', label: 'Surface Damage' },
              { value: 'other', label: 'Other' },
            ]}
          />
          <Select
            label="Severity"
            name="severity"
            value={severity}
            onChange={(event) => {
              setSeverity(event.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All severities' },
              { value: 'high', label: 'High' },
              { value: 'moderate', label: 'Moderate' },
              { value: 'low', label: 'Low' },
            ]}
          />
          <Select
            label="Sort by"
            name="sort"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            options={[
              { value: 'createdAt_desc', label: 'Newest first' },
              { value: 'createdAt_asc', label: 'Oldest first' },
              { value: 'detections_desc', label: 'Most detections' },
            ]}
          />
        </div>
      </Card>

      {list.isLoading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : list.error ? (
        <ErrorState
          message="Could not load inspections. Please try again."
          onRetry={() => list.refetch()}
        />
      ) : (list.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={<ClipboardList size={22} />}
          title={debouncedSearch || damageType || severity ? 'No matching inspections' : 'No inspections yet'}
          description={
            debouncedSearch || damageType || severity
              ? 'Try adjusting your search or filters.'
              : 'Run your first AI analysis to see results appear here.'
          }
          action={
            debouncedSearch || damageType || severity
              ? {
                  label: 'Clear filters',
                  onClick: () => {
                    setSearch('');
                    setDamageType('');
                    setSeverity('');
                    setPage(1);
                  },
                }
              : { label: 'Analyse an image', onClick: () => navigate('/app/analyze') }
          }
        />
      ) : (
        <>
          <Card padded={false}>
            {/* Desktop table */}
            <table className="hidden w-full text-left text-sm md:table">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Inspection</th>
                  <th className="px-5 py-3 font-medium">Damage types</th>
                  <th className="px-5 py-3 font-medium">Detections</th>
                  <th className="px-5 py-3 font-medium">Severity</th>
                  <th className="px-5 py-3 font-medium">Confidence</th>
                  <th className="px-5 py-3 font-medium">Location</th>
                  <th className="px-5 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {list.data!.items.map((inspection) => {
                  const avgConfidence =
                    inspection.detections.length > 0
                      ? inspection.detections.reduce((sum, d) => sum + d.confidence, 0) /
                        inspection.detections.length
                      : null;
                  return (
                    <tr
                      key={inspection.id}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                      onClick={() => navigate(`/app/inspections/${inspection.id}`)}
                    >
                      <td className="px-5 py-3.5">
                        <p className="tabular text-xs font-medium text-slate-900">
                          #{truncateId(inspection.id, 8)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatDateTime(inspection.createdAt)}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {Object.keys(inspection.summary.countsByClass).map((className) => (
                            <Badge key={className} tone="neutral">
                              {classLabel(className)}
                            </Badge>
                          ))}
                          {inspection.summary.detectionCount === 0 ? (
                            <span className="text-xs text-slate-400">None detected</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="tabular px-5 py-3.5 text-slate-700">
                        {inspection.summary.detectionCount}
                      </td>
                      <td className="px-5 py-3.5">
                        <SeverityBadge severity={inspection.summary.maxSeverity} />
                      </td>
                      <td className="tabular px-5 py-3.5 text-slate-700">
                        {avgConfidence != null ? formatPercent(avgConfidence) : '—'}
                      </td>
                      <td className="max-w-[180px] px-5 py-3.5">
                        <p className="truncate text-xs text-slate-600">
                          {inspection.location?.address ?? (
                            <span className="text-slate-400">No location</span>
                          )}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            aria-label="Delete inspection"
                            onClick={(event) => {
                              event.stopPropagation();
                              setToDelete(inspection);
                            }}
                            className="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={15} />
                          </button>
                          <ChevronRight size={16} className="text-slate-300" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile cards */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {list.data!.items.map((inspection) => (
                <li key={inspection.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/app/inspections/${inspection.id}`)}
                    className="w-full px-4 py-4 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="tabular text-xs font-medium text-slate-900">
                        #{truncateId(inspection.id, 8)} · {formatDateTime(inspection.createdAt)}
                      </p>
                      <SeverityBadge severity={inspection.summary.maxSeverity} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {inspection.summary.detectionCount} detection
                      {inspection.summary.detectionCount === 1 ? '' : 's'} ·{' '}
                      {inspection.location?.address ?? 'No location'}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Pagination
            className="mt-4"
            page={page}
            limit={10}
            total={list.data!.pagination.total}
            onChange={setPage}
          />
        </>
      )}

      <Modal
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Delete inspection?"
        description="This permanently removes the inspection record and its images."
        footer={
          <>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Inspection <span className="tabular font-medium">#{truncateId(toDelete?.id ?? '', 8)}</span>{' '}
          with {toDelete?.summary.detectionCount ?? 0} detection(s) will be deleted. This cannot be
          undone.
        </p>
      </Modal>
    </div>
  );
}
