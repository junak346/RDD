import { FormEvent, useState } from 'react';

import { PageHeader } from '../components/layout/AppShell';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { accountService } from '../services/auth.service';
import { useAuth } from '../stores/auth';
import { useToast } from '../stores/toast';
import { AppError } from '../types';
import { formatDate } from '../utils/format';

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();

  const [name, setName] = useState(user?.name ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const onSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      await accountService.updateProfile({ name: name.trim() });
      await refreshUser();
      toast.success('Profile updated');
    } catch (error) {
      toast.error('Update failed', error instanceof AppError ? error.message : undefined);
    } finally {
      setSavingProfile(false);
    }
  };

  const onChangePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordError('Use at least 8 characters with letters and a number.');
      return;
    }
    setSavingPassword(true);
    try {
      await accountService.updateProfile({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Password changed');
    } catch (error) {
      setPasswordError(
        error instanceof AppError ? error.message : 'Password change failed.',
      );
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div>
      <PageHeader title="Profile" description="Manage your account details and password." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Account">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-lg font-semibold text-white">
              {user?.name?.charAt(0).toUpperCase() ?? '?'}
            </span>
            <div>
              <p className="text-base font-semibold text-slate-900">{user?.name}</p>
              <p className="text-sm text-slate-500">{user?.email}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <Badge tone="brand">{user?.role ?? 'user'}</Badge>
                <span className="text-xs text-slate-400">
                  Member since {user ? formatDate(user.createdAt) : '—'}
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={onSaveProfile} className="mt-6 space-y-4">
            <Input
              label="Display name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Input
              label="Email"
              name="email"
              value={user?.email ?? ''}
              readOnly
              disabled
              hint="Contact an administrator to change your email."
            />
            <Button type="submit" loading={savingProfile}>
              Save changes
            </Button>
          </form>
        </Card>

        <Card title="Change password">
          {passwordError ? (
            <Alert tone="danger" className="mb-4">
              {passwordError}
            </Alert>
          ) : null}
          <form onSubmit={onChangePassword} className="space-y-4">
            <Input
              label="Current password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
            <Input
              label="New password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              hint="At least 8 characters, including letters and a number."
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <Button type="submit" variant="secondary" loading={savingPassword}>
              Update password
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
