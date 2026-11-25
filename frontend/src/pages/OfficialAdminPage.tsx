import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, ShieldCheck } from 'lucide-react';

import { OfficialLayout, OfficialPageHeader } from '../components/layout/OfficialLayout';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Select } from '../components/ui/Input';
import { officialService } from '../services/official.service';
import { useOfficialAuth } from '../stores/officialAuth';
import { AppError, GovernmentRole, OfficialSettingsView } from '../types';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const ROLE_OPTIONS: Array<{ value: GovernmentRole; label: string }> = [
  { value: 'SUPER_ADMIN', label: 'Super admin' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'INSPECTOR', label: 'Inspector' },
  { value: 'DEPARTMENT_OFFICIAL', label: 'Department official' },
  { value: 'VIEWER', label: 'Viewer' },
];

function strongPassword(value: string): boolean {
  return (
    value.length >= 12 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

export function OfficialAdminPage() {
  const { official } = useOfficialAuth();
  const config = useQuery({ queryKey: ['official-config'], queryFn: officialService.config });
  const [form, setForm] = useState<OfficialSettingsView | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config.data) setForm(config.data);
  }, [config.data]);

  if (config.isLoading || !form) {
    return <OfficialLayout><Card title="Loading configuration" description="Reading stored settings." /></OfficialLayout>;
  }
  if (config.isError) {
    return <OfficialLayout><Alert tone="danger">Administrative configuration could not be loaded.</Alert></OfficialLayout>;
  }

  const canEdit = official?.role === 'SUPER_ADMIN' || official?.role === 'ADMIN';
  const baseline = form.modelConfiguration.baselineConfidenceThreshold;

  const updateSla = (priority: string, value: string) => {
    setForm((current) =>
      current ? { ...current, slaRules: { ...current.slaRules, [priority]: Number(value) } } : current,
    );
  };

  const save = async () => {
    if (!form) return;
    const threshold = form.modelConfiguration.confidenceThreshold;
    if (threshold < baseline || threshold > 1) {
      setError(`The model gate must be between ${baseline.toFixed(2)} and 1.00.`);
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await officialService.updateConfig({
        slaRules: form.slaRules,
        priorityConfiguration: form.priorityConfiguration,
        duplicateRadiusMeters: form.duplicateRadiusMeters,
        duplicateWindowHours: form.duplicateWindowHours,
        modelConfiguration: { confidenceThreshold: threshold },
      });
      setForm(saved);
      setMessage('Stored settings updated. This change is audited and applied server-side.');
    } catch {
      setError('Could not save settings. Check your role and values, then try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OfficialLayout>
      <OfficialPageHeader
        title="Administration"
        description="Configurable departments, officials, roles, duplicate grouping, model quality gate and planning SLAs."
      />

      <Alert tone="info" className="mb-6" title="Planning values, not government policy">
        SLA values are configurable operational defaults for this deployment. They do not claim to
        represent any real authority’s statutory service levels.
      </Alert>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="System settings" description="Stored server-side configuration.">
          {message ? <Alert tone="success" className="mb-4">{message}</Alert> : null}
          {error ? <Alert tone="danger" className="mb-4">{error}</Alert> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Duplicate radius (meters)" name="duplicateRadiusMeters" type="number" min={1} value={form.duplicateRadiusMeters} onChange={(event) => setForm({ ...form, duplicateRadiusMeters: Number(event.target.value) })} disabled={!canEdit} />
            <Input label="Duplicate window (hours)" name="duplicateWindowHours" type="number" min={1} value={form.duplicateWindowHours} onChange={(event) => setForm({ ...form, duplicateWindowHours: Number(event.target.value) })} disabled={!canEdit} />
            <Input label="Administrative minimum confidence" name="modelConfidenceThreshold" type="number" min={baseline} max={1} step={0.01} value={form.modelConfiguration.confidenceThreshold} onChange={(event) => setForm({ ...form, modelConfiguration: { ...form.modelConfiguration, confidenceThreshold: Number(event.target.value) } })} disabled={!canEdit} hint={`MODEL_CONFIDENCE_THRESHOLD baseline: ${baseline.toFixed(2)}. The backend never goes below it.`} />
            {PRIORITIES.map((priority) => (
              <Input key={priority} label={`${priority} planning SLA (hours)`} name={`sla-${priority}`} type="number" min={1} value={form.slaRules[priority] ?? 0} onChange={(event) => updateSla(priority, event.target.value)} disabled={!canEdit} />
            ))}
          </div>

          <h3 className="mt-6 text-sm font-semibold text-slate-900">Priority labels</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {PRIORITIES.map((priority) => (
              <Input
                key={priority}
                label={`${priority} label`}
                name={`priority-${priority}`}
                value={form.priorityConfiguration[priority] ?? priority}
                onChange={(event) =>
                  setForm({
                    ...form,
                    priorityConfiguration: { ...form.priorityConfiguration, [priority]: event.target.value },
                  })
                }
                disabled={!canEdit}
              />
            ))}
          </div>

          {canEdit ? (
            <Button className="mt-6" icon={<Save size={15} />} loading={saving} onClick={() => void save()}>Save settings</Button>
          ) : null}
        </Card>

        <div className="space-y-6">
          <Card title="Your access">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Role</dt><dd className="font-semibold">{official?.role.replace(/_/g, ' ')}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Department</dt><dd className="font-semibold">{official?.department}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">MFA / SSO</dt><dd><Badge tone="warning">Architecture ready</Badge></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Public registration</dt><dd><Badge tone="success">Disabled</Badge></dd></div>
            </dl>
          </Card>

          <Card title="Server-enforced roles" description="Labels only; backend middleware is the authority.">
            <div className="flex flex-wrap gap-1.5">
              {form.roleCatalog.map((role) => <Badge key={role} tone="neutral">{role.replace(/_/g, ' ')}</Badge>)}
            </div>
          </Card>

          <Card title="Lifecycle catalog">
            <p className="mb-3 text-sm text-slate-600">{form.statusCatalog.length} persisted workflow states.</p>
            <div className="flex flex-wrap gap-1.5">
              {form.statusCatalog.map((status) => <Badge key={status} tone="neutral">{status.replace(/_/g, ' ')}</Badge>)}
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-6" title="Configuration source">
        <p className="text-sm leading-relaxed text-slate-600">
          <strong>{form.modelConfiguration.source}.</strong> {form.modelConfiguration.note}
        </p>
        <p className="mt-2 text-xs text-slate-500">{form.note}</p>
      </Card>
    </OfficialLayout>
  );
}

export function OfficialDepartmentsPage() {
  const { official } = useOfficialAuth();
  const queryClient = useQueryClient();
  const departments = useQuery({ queryKey: ['official-departments'], queryFn: officialService.departments });
  const canCreate = official?.role === 'SUPER_ADMIN' || official?.role === 'ADMIN';
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const create = useMutation({
    mutationFn: () => officialService.createDepartment({ name, code, description }),
    onSuccess: () => {
      setName('');
      setCode('');
      setDescription('');
      void queryClient.invalidateQueries({ queryKey: ['official-departments'] });
    },
  });

  return (
    <OfficialLayout>
      <OfficialPageHeader title="Departments" description="Configurable operational units — no country-specific assumptions." />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Configured departments" padded={false}>
          {departments.isLoading ? <p className="p-5 text-sm text-slate-500">Loading…</p> : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Code</th><th className="px-5 py-3">Description</th><th className="px-5 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {(departments.data?.departments ?? []).map((department) => (
                  <tr key={department.id}>
                    <td className="px-5 py-3 font-semibold text-slate-900">{department.name}</td>
                    <td className="px-5 py-3">{department.code}</td>
                    <td className="px-5 py-3 text-slate-500">{department.description || '—'}</td>
                    <td className="px-5 py-3"><Badge tone={department.active ? 'success' : 'neutral'}>{department.active ? 'Active' : 'Inactive'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Create department" description="Available only to administrators; audited server-side.">
          {!canCreate ? <Alert tone="info">Your role has read-only access to department configuration.</Alert> : (
            <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
              <Input label="Name" name="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} />
              <Input label="Code" name="code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} required minLength={2} placeholder="PWD" />
              <Input label="Description" name="description" value={description} onChange={(event) => setDescription(event.target.value)} />
              {create.isError ? <Alert tone="danger">{create.error instanceof AppError ? create.error.message : 'Department could not be created.'}</Alert> : null}
              {create.isSuccess ? <Alert tone="success">Department created and audit recorded.</Alert> : null}
              <Button type="submit" loading={create.isPending} disabled={!name || !code}>Create department</Button>
            </form>
          )}
        </Card>
      </div>
    </OfficialLayout>
  );
}

export function OfficialOfficialsPage() {
  const { official } = useOfficialAuth();
  const queryClient = useQueryClient();
  const officials = useQuery({ queryKey: ['official-accounts'], queryFn: officialService.officials });
  const config = useQuery({ queryKey: ['official-config'], queryFn: officialService.config });
  const canCreate = official?.role === 'SUPER_ADMIN' || official?.role === 'ADMIN';
  const [form, setForm] = useState({
    name: '',
    email: '',
    department: '',
    designation: '',
    role: 'VIEWER' as GovernmentRole,
    password: '',
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => officialService.createOfficial(form),
    onSuccess: () => {
      setForm({ name: '', email: '', department: '', designation: '', role: 'VIEWER', password: '' });
      setLocalError(null);
      void queryClient.invalidateQueries({ queryKey: ['official-accounts'] });
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!strongPassword(form.password)) {
      setLocalError('Use at least 12 characters with uppercase, lowercase, a number and a symbol.');
      return;
    }
    setLocalError(null);
    create.mutate();
  };

  return (
    <OfficialLayout>
      <OfficialPageHeader title="Officials" description="Provisioned accounts only. Password hashes and credentials are never returned." />
      {officials.isError ? <Alert tone="danger" className="mb-5">Official accounts could not be loaded.</Alert> : null}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Provisioned officials" padded={false}>
          {officials.isLoading ? <p className="p-5 text-sm text-slate-500">Loading…</p> : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Official ID</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Department</th><th className="px-5 py-3">State</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(officials.data?.officials ?? []).map((account) => (
                  <tr key={account.id}>
                    <td className="px-5 py-3 font-semibold text-slate-900">{account.name}<p className="text-xs font-normal text-slate-500">{account.designation}</p></td>
                    <td className="px-5 py-3">{account.officialId}</td>
                    <td className="px-5 py-3">{account.role.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-3">{account.department}</td>
                    <td className="px-5 py-3"><Badge tone={account.accountStatus === 'ACTIVE' ? 'success' : 'danger'}>{account.accountStatus}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Provision official" description="Controlled administrator action — no public self-registration.">
          {!canCreate ? <Alert tone="info">Only administrators can provision official accounts.</Alert> : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <Input label="Full name" name="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required minLength={2} autoComplete="off" />
              <Input label="Official email" name="email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required autoComplete="off" />
              <Input label="Department" name="department" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} required minLength={2} />
              <Input label="Designation" name="designation" value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} required minLength={2} />
              <Select
                label="Role"
                name="role"
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value as GovernmentRole })}
                options={ROLE_OPTIONS.filter((option) =>
                  !config.data?.roleCatalog.length || config.data.roleCatalog.includes(option.value),
                )}
              />
              <Input label="Strong temporary password" name="password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={12} autoComplete="new-password" />
              {localError ? <Alert tone="danger">{localError}</Alert> : null}
              {create.isError ? <Alert tone="danger">{create.error instanceof AppError ? create.error.message : 'Official could not be provisioned.'}</Alert> : null}
              {create.isSuccess ? <Alert tone="success">Official provisioned and audit recorded.</Alert> : null}
              <Button type="submit" loading={create.isPending}>Provision account</Button>
            </form>
          )}
        </Card>
      </div>
      <p className="mt-4 flex gap-2 text-xs text-slate-500"><ShieldCheck size={14} /> For production, provision through the server-side CLI or an administrator session over HTTPS; passwords are bcrypt-hashed and never logged.</p>
    </OfficialLayout>
  );
}
