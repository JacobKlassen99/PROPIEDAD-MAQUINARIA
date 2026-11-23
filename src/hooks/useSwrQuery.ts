import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  getQuerySnapshot,
  getViewFilterState,
  revalidateQuery,
  setViewFilterState,
  subscribeQuery,
  SwrSnapshot,
} from '../services/dataCache';

export interface UseSwrQueryOptions {
  /** When false, pauses automatic fetching while still returning any cached snapshot */
  enabled?: boolean;
  /** Minimum interval (ms) between automatic revalidations when data is not stale (default: 2500ms) */
  minIntervalMs?: number;
  /** Revalidate in background on mount / key change even if already cached (default: true) */
  revalidateOnMount?: boolean;
}

export interface UseSwrQueryResult<T> extends SwrSnapshot<T> {
  /** Manually trigger a forced refresh (keeps existing data visible during update) */
  refresh: () => Promise<T | undefined>;
}

/**
 * React hook implementing Stale-While-Revalidate over the shared in-memory cache.
 * - Initializes synchronously from cached data on the very first render (no loading flash).
 * - Deduplicates concurrent fetches and ignores out-of-order responses.
 * - Preserves confirmed empty lists and previous data on revalidation errors.
 */
export function useSwrQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: UseSwrQueryOptions = {}
): UseSwrQueryResult<T> {
  const { enabled = true, minIntervalMs = 2500, revalidateOnMount = true } = options;

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const snapshot = useSyncExternalStore(
    useCallback((onStoreChange) => subscribeQuery(key, onStoreChange), [key]),
    useCallback(() => getQuerySnapshot<T>(key), [key]),
    useCallback(() => getQuerySnapshot<T>(key), [key])
  );

  useEffect(() => {
    if (!enabled || !key) return;
    if (!revalidateOnMount && snapshot.hasLoaded && !snapshot.stale) return;

    revalidateQuery<T>(key, () => fetcherRef.current(), {
      force: false,
      minIntervalMs,
    }).catch(() => {
      // Error state is stored in the shared snapshot without clearing cached data
    });
  }, [enabled, key, minIntervalMs, revalidateOnMount, snapshot.stale]);

  const refresh = useCallback(async (): Promise<T | undefined> => {
    if (!key) return undefined;
    try {
      return await revalidateQuery<T>(key, () => fetcherRef.current(), {
        force: true,
        minIntervalMs: 0,
      });
    } catch {
      return undefined;
    }
  }, [key]);

  return {
    ...snapshot,
    refresh,
  };
}

/**
 * In-memory persisted state hook for UI filters/tabs.
 * Survives component unmount/remount during navigation, and automatically resets on logout/user switch.
 * Never touches localStorage, sessionStorage, or IndexedDB.
 */
export function usePersistedMemoryState<T>(
  storageKey: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => getViewFilterState<T>(storageKey, initialValue));

  const setPersistedValue: React.Dispatch<React.SetStateAction<T>> = useCallback(
    (updater) => {
      setValue((prev) => {
        const next =
          typeof updater === 'function'
            ? (updater as (prevState: T) => T)(prev)
            : updater;
        setViewFilterState(storageKey, next);
        return next;
      });
    },
    [storageKey]
  );

  return [value, setPersistedValue];
}
