/* Who is signed in, which gyms they work at or belong to, and the app's public config. */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AppConfig, SessionInfo } from "../../../shared/api.ts";
import { api } from "./api.ts";

interface SessionContextValue {
  config: AppConfig | null;
  session: SessionInfo | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [cfg, sess] = await Promise.all([api.get<AppConfig>("/auth/config"), api.get<SessionInfo>("/auth/session")]);
      setConfig(cfg);
      setSession(sess);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await api.post("/auth/logout");
    window.google?.accounts.id.disableAutoSelect();
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <SessionContext.Provider value={{ config, session, loading, error, refresh, signOut }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession outside SessionProvider");
  return value;
}
