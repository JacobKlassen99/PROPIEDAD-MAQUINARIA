/**
 * Shared In-Memory Stale-While-Revalidate (SWR) Query & View Filter Store
 *
 * Strictly in-memory (NEVER uses localStorage, sessionStorage, or IndexedDB).
 * Survives component unmount/remount during navigation while the app is open,
 * deduplicates concurrent requests, guards against out-of-order responses,
 * supports selective invalidation without wiping displayed data, and clears
 * completely on logout or user/session change.
 */

export interface SwrSnapshot<T> {
  data: T | undefined;
  hasLoaded: boolean;
  isFetching: boolean;
  isInitialLoading: boolean;
  isRevalidating: boolean;
  error: string | null;
  updatedAt: number | null;
  stale: boolean;
}

interface CacheEntry<T> {
  snapshot: SwrSnapshot<T>;
  inFlightPromise: Promise<T> | null;
  inFlightSeq: number;
  latestSeq: number;
  listeners: Set<() => void>;
}

const EMPTY_SNAPSHOT: SwrSnapshot<any> = Object.freeze({
  data: undefined,
  hasLoaded: false,
  isFetching: false,
  isInitialLoading: false,
  isRevalidating: false,
  error: null,
  updatedAt: null,
  stale: false,
});

const cacheStore = new Map<string, CacheEntry<any>>();
const viewStateStore = new Map<string, any>();

/** Monotonic generation counter incremented on session reset / logout to reject stale in-flight responses */
let sessionGeneration = 0;

export function getCacheSessionGeneration(): number {
  return sessionGeneration;
}

function getOrCreateEntry<T>(key: string): CacheEntry<T> {
  let entry = cacheStore.get(key) as CacheEntry<T> | undefined;
  if (!entry) {
    entry = {
      snapshot: { ...EMPTY_SNAPSHOT },
      inFlightPromise: null,
      inFlightSeq: 0,
      latestSeq: 0,
      listeners: new Set(),
    };
    cacheStore.set(key, entry);
  }
  return entry;
}

function notifyEntry(entry: CacheEntry<any>) {
  entry.listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Ignore listener errors
    }
  });
}

function updateSnapshot<T>(
  entry: CacheEntry<T>,
  patch: Partial<Omit<SwrSnapshot<T>, 'isInitialLoading' | 'isRevalidating'>>
) {
  const nextHasLoaded = patch.hasLoaded !== undefined ? patch.hasLoaded : entry.snapshot.hasLoaded;
  const nextIsFetching = patch.isFetching !== undefined ? patch.isFetching : entry.snapshot.isFetching;

  entry.snapshot = {
    data: patch.data !== undefined ? patch.data : entry.snapshot.data,
    hasLoaded: nextHasLoaded,
    isFetching: nextIsFetching,
    isInitialLoading: nextIsFetching && !nextHasLoaded,
    isRevalidating: nextIsFetching && nextHasLoaded,
    error: patch.error !== undefined ? patch.error : entry.snapshot.error,
    updatedAt: patch.updatedAt !== undefined ? patch.updatedAt : entry.snapshot.updatedAt,
    stale: patch.stale !== undefined ? patch.stale : entry.snapshot.stale,
  };
  notifyEntry(entry);
}

/**
 * Synchronous read of the current cached snapshot for useSyncExternalStore or imperative reads.
 */
export function getQuerySnapshot<T>(key: string | null): SwrSnapshot<T> {
  if (!key) return EMPTY_SNAPSHOT as SwrSnapshot<T>;
  const entry = cacheStore.get(key);
  return entry ? (entry.snapshot as SwrSnapshot<T>) : (EMPTY_SNAPSHOT as SwrSnapshot<T>);
}

/**
 * Subscribe to changes for a single cache key.
 */
export function subscribeQuery(key: string | null, listener: () => void): () => void {
  if (!key) return () => {};
  const entry = getOrCreateEntry<any>(key);
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
  };
}

export interface RevalidateOptions {
  /** Force a fresh request even if within minIntervalMs (still preserves displayed data) */
  force?: boolean;
  /** Minimum ms between automatic background revalidations when entry is not stale (default: 2500ms) */
  minIntervalMs?: number;
}

/**
 * Stale-While-Revalidate fetch:
 * - Preserves existing data while fetching in background.
 * - Deduplicates identical concurrent in-flight requests.
 * - Guards against out-of-order responses using per-key sequence numbers and global session generation.
 * - Never wipes existing cached data when a background refresh fails.
 */
export function revalidateQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: RevalidateOptions = {}
): Promise<T> {
  const { force = false, minIntervalMs = 2500 } = options;
  const entry = getOrCreateEntry<T>(key);

  // Deduplicate simultaneous identical calls when not forcing a post-mutation refresh
  if (entry.inFlightPromise && !force) {
    return entry.inFlightPromise;
  }

  // Respect cooldown for rapid navigation when data is already loaded and fresh (not invalidated)
  if (
    !force &&
    entry.snapshot.hasLoaded &&
    !entry.snapshot.stale &&
    entry.snapshot.updatedAt !== null &&
    minIntervalMs > 0 &&
    Date.now() - entry.snapshot.updatedAt < minIntervalMs
  ) {
    return Promise.resolve(entry.snapshot.data as T);
  }

  const reqSeq = ++entry.latestSeq;
  const reqGen = sessionGeneration;

  // Transition to fetching WITHOUT clearing data or hasLoaded
  updateSnapshot(entry, {
    isFetching: true,
    ...(force ? { error: null } : {}),
  });

  const promise = Promise.resolve()
    .then(() => fetcher())
    .then((result) => {
      // Discard stale response if a newer request started or session was reset
      if (reqGen !== sessionGeneration || reqSeq !== entry.latestSeq) {
        return result;
      }
      entry.inFlightPromise = null;
      entry.inFlightSeq = 0;
      updateSnapshot(entry, {
        data: result,
        hasLoaded: true,
        isFetching: false,
        error: null,
        updatedAt: Date.now(),
        stale: false,
      });
      return result;
    })
    .catch((err: unknown) => {
      if (reqGen !== sessionGeneration || reqSeq !== entry.latestSeq) {
        throw err;
      }
      entry.inFlightPromise = null;
      entry.inFlightSeq = 0;
      const msg =
        err instanceof Error ? err.message : 'No se pudo actualizar los datos desde el servidor.';
      // Keep existing data & hasLoaded intact; only set error and stop fetching
      updateSnapshot(entry, {
        isFetching: false,
        error: msg,
      });
      throw err;
    });

  entry.inFlightPromise = promise;
  entry.inFlightSeq = reqSeq;
  return promise;
}

/**
 * Synchronously update or seed a cached entry (e.g., optimistic/returned mutation result).
 */
export function setQueryData<T>(
  key: string,
  updater: T | ((prev: T | undefined) => T),
  options?: { markStale?: boolean }
) {
  const entry = getOrCreateEntry<T>(key);
  const nextData =
    typeof updater === 'function'
      ? (updater as (prev: T | undefined) => T)(entry.snapshot.data)
      : updater;

  // Advance sequence slightly? No, only update data; if a force refresh follows, it gets a newer seq.
  updateSnapshot(entry, {
    data: nextData,
    hasLoaded: true,
    error: null,
    updatedAt: Date.now(),
    stale: options?.markStale ?? false,
  });
}

/**
 * Patch all loaded cached entries whose key starts with `prefix`.
 * Useful for immediately updating an item (e.g., a CobroCuenta or HarvestRecord)
 * across all cached filter variants without waiting for full refetch.
 */
export function patchQueriesByPrefix<T>(
  prefix: string,
  updater: (prev: T, key: string) => T
) {
  for (const [key, entry] of cacheStore.entries()) {
    if (!key.startsWith(prefix)) continue;
    if (!entry.snapshot.hasLoaded || entry.snapshot.data === undefined) continue;
    try {
      const nextData = updater(entry.snapshot.data as T, key);
      if (nextData !== entry.snapshot.data) {
        updateSnapshot(entry, {
          data: nextData,
          updatedAt: Date.now(),
        });
      }
    } catch {
      // Ignore patch errors on mismatched shapes
    }
  }
}

/**
 * Mark matching cached queries as stale WITHOUT deleting their cached data.
 * Displayed lists remain visible; next mount or explicit revalidate fetches fresh data.
 */
export function invalidateQueries(prefixes: string | string[]) {
  const list = Array.isArray(prefixes) ? prefixes : [prefixes];
  for (const [key, entry] of cacheStore.entries()) {
    if (list.some((p) => key.startsWith(p) || key.includes(p))) {
      entry.inFlightPromise = null;
      updateSnapshot(entry, { stale: true });
    }
  }
}

/**
 * Hard reset all private in-memory cache and view filter state.
 * MUST be called on logout, session expiration, user switch, or admin revocation.
 */
export function resetAllCache() {
  sessionGeneration += 1;
  viewStateStore.clear();
  for (const entry of cacheStore.values()) {
    entry.inFlightPromise = null;
    entry.inFlightSeq = 0;
    entry.latestSeq += 1;
    entry.snapshot = { ...EMPTY_SNAPSHOT };
    notifyEntry(entry);
  }
  cacheStore.clear();
}

// -------------------------------------------------------------
// In-Memory View Filter State (survives navigation, cleared on logout)
// -------------------------------------------------------------

export function getViewFilterState<T>(key: string, fallback: T): T {
  if (viewStateStore.has(key)) {
    return viewStateStore.get(key) as T;
  }
  return fallback;
}

export function setViewFilterState<T>(key: string, value: T): void {
  viewStateStore.set(key, value);
}

// -------------------------------------------------------------
// Standardized Cache Keys
// -------------------------------------------------------------

export const cacheKeys = {
  cobrosList: (campanaId?: string, soloPendientes = true) =>
    `cobros.list:${campanaId && campanaId !== 'all' ? campanaId : 'all'}:${soloPendientes ? 'pending' : 'all'}`,
  cobroEstado: (trabajoId: string) => `cobros.estado:${trabajoId.trim()}`,
  harvestPending: () => 'harvest.pending:all',
  harvestList: (campanaId?: string) =>
    `harvest.list:${campanaId && campanaId !== 'all' ? campanaId : 'all'}`,
  expenseAllocations: (campanaId?: string) =>
    `expense.allocations:${campanaId && campanaId !== 'all' ? campanaId : 'all'}`,
  machineTypes: () => 'machineType.list:all',
  financialReport: (campanaId?: string) =>
    `report.get:${campanaId && campanaId !== 'all' ? campanaId : 'all'}`,
};
