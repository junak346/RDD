/** Separate session state for the private government portal. */
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { officialService } from '../services/official.service';
import { GovernmentOfficial, GovernmentRole } from '../types';

interface OfficialAuthContextValue {
  official: GovernmentOfficial | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const OfficialAuthContext = createContext<OfficialAuthContextValue | null>(null);

/**
 * `enabled` keeps the official `/auth/me` request out of the citizen journey.
 * It is mounted only for the hidden portal and its protected command pages.
 */
export function OfficialAuthProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const [official, setOfficial] = useState<GovernmentOfficial | null>(null);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setOfficial(null);
      setLoading(false);
      return;
    }
    try {
      const data = await officialService.me();
      setOfficial(data.official);
    } catch {
      setOfficial(null);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    setLoading(enabled);
    if (enabled) void refresh();
    else setOfficial(null);
  }, [enabled, refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await officialService.login(email, password);
    setOfficial(result.official);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await officialService.logout();
    } finally {
      setOfficial(null);
    }
  }, []);

  const value = useMemo<OfficialAuthContextValue>(
    () => ({ official, loading, login, logout, refresh }),
    [official, loading, login, logout, refresh],
  );

  return <OfficialAuthContext.Provider value={value}>{children}</OfficialAuthContext.Provider>;
}

export function useOfficialAuth(): OfficialAuthContextValue {
  const context = useContext(OfficialAuthContext);
  if (!context) throw new Error('useOfficialAuth must be used inside OfficialAuthProvider');
  return context;
}

export function roleAllows(
  official: GovernmentOfficial | null,
  roles: GovernmentRole[],
): boolean {
  return Boolean(official && roles.includes(official.role));
}
