import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.ts";

export interface ApiState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  reload: () => void;
}

/** Loads a GET endpoint; pass null to wait. Keeps the last data while reloading so screens don't flash. */
export function useApi<T>(path: string | null): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(path != null);
  const [tick, setTick] = useState(0);
  const lastPath = useRef(path);

  useEffect(() => {
    if (path == null) return;
    if (lastPath.current !== path) {
      setData(null);
      lastPath.current = path;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<T>(path)
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}
