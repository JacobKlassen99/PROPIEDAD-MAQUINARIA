/**
 * Progressive In-Memory Background Preloader
 *
 * Preloads frequently accessed sections quietly after login (and admin-only sections
 * only when administrative authorization is active), strictly in-memory:
 * - Never blocks initial render of Inicio.
 * - Limits concurrency to MAX_BACKGROUND_CONCURRENCY (2) to avoid saturating Google Apps Script.
 * - Yields to active user-triggered requests so navigation/mutations always take priority.
 * - Reuses shared SWR cache keys (revalidateQuery) for zero duplicate requests.
 * - Cancels cleanly on logout, session change, or admin revocation.
 * - Silently swallows background errors while preserving the last valid cached data.
 */

import type { HarvestRecord, HarvestSale } from '../types';
import {
  getActiveSession,
  getArSummary,
  getExpenseAllocations,
  getHarvests,
  getHarvestSales,
  getMachineTypes,
  getPendingHarvests,
  hasAdminAuthorization,
} from './backend';
import {
  cacheKeys,
  clearAdminCache,
  getCacheSessionGeneration,
  getQuerySnapshot,
  revalidateQuery,
  setCachedQuery,
  waitForUserRequestsIdle,
} from './dataCache';
import { computeHarvestAvailability, filterAvailableHarvests } from './harvestAvailability';

export interface HarvestSalesCacheBundle {
  sales: HarvestSale[];
  harvests: HarvestRecord[];
}

const MAX_BACKGROUND_CONCURRENCY = 2;
const INITIAL_START_DELAY_MS = 220;
const TASK_STAGGER_MS = 110;
const PRELOAD_MIN_INTERVAL_MS = 30_000;

interface PreloadTask {
  key: string;
  priority: number; // Lower number = higher priority
  adminOnly: boolean;
  sessionGen: number;
  adminGen: number;
  run: () => Promise<unknown>;
}

const pendingQueue: PreloadTask[] = [];
const queuedOrRunningKeys = new Set<string>();
let activeWorkers = 0;
let adminGeneration = 0;
let startTimer: ReturnType<typeof setTimeout> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Shared fetcher for Ventas de cosecha + Almacén de cosechas.
 * Reconciles harvest availability against active sales and seeds the pending harvest cache.
 * Used identically by Preloader, HarvestSalesView, and ReportsView to guarantee zero duplicate calls.
 */
export async function fetchNormalizedHarvestSalesBundle(
  useBackendCache = true
): Promise<HarvestSalesCacheBundle> {
  const fresh = await getHarvestSales({}, useBackendCache);
  const reconciledHarvests = computeHarvestAvailability(fresh.harvests, fresh.sales);
  const normalizedBundle: HarvestSalesCacheBundle = {
    sales: fresh.sales,
    harvests: reconciledHarvests,
  };
  // Keep warehouse pending-harvests cache synchronized from the same server response
  setCachedQuery(cacheKeys.harvestPending(), filterAvailableHarvests(reconciledHarvests));
  return normalizedBundle;
}

function isTaskStillValid(task: PreloadTask): boolean {
  if (!getActiveSession()) return false;
  if (task.sessionGen !== getCacheSessionGeneration()) return false;
  if (task.adminOnly) {
    if (task.adminGen !== adminGeneration) return false;
    if (!hasAdminAuthorization()) return false;
  }
  return true;
}

function enqueueTask(task: PreloadTask) {
  if (!isTaskStillValid(task)) return;

  // Skip if already queued or currently running
  if (queuedOrRunningKeys.has(task.key)) return;

  // Skip if cache already holds fresh non-stale data within preload window
  const snap = getQuerySnapshot(task.key);
  if (
    snap.hasLoaded &&
    !snap.stale &&
    snap.updatedAt !== null &&
    Date.now() - snap.updatedAt < PRELOAD_MIN_INTERVAL_MS
  ) {
    return;
  }

  queuedOrRunningKeys.add(task.key);
  pendingQueue.push(task);
  pendingQueue.sort((a, b) => a.priority - b.priority);

  schedulePump();
}

function schedulePump(delayMs = 0) {
  if (delayMs > 0) {
    if (startTimer !== null) return;
    startTimer = setTimeout(() => {
      startTimer = null;
      pumpQueue();
    }, delayMs);
    return;
  }
  pumpQueue();
}

function pumpQueue() {
  while (activeWorkers < MAX_BACKGROUND_CONCURRENCY && pendingQueue.length > 0) {
    const task = pendingQueue.shift()!;
    if (!isTaskStillValid(task)) {
      queuedOrRunningKeys.delete(task.key);
      continue;
    }

    activeWorkers += 1;
    void runTask(task);
  }
}

async function runTask(task: PreloadTask) {
  try {
    // Always yield briefly if a direct user request is currently in flight
    await waitForUserRequestsIdle(1800);
    if (!isTaskStillValid(task)) return;

    await task.run();
  } catch {
    // Silent failure: preserve last valid cached data and never block UI
  } finally {
    queuedOrRunningKeys.delete(task.key);
    activeWorkers = Math.max(0, activeWorkers - 1);

    if (pendingQueue.length > 0 && getActiveSession()) {
      await sleep(TASK_STAGGER_MS);
      pumpQueue();
    }
  }
}

/**
 * Schedule progressive background preload for standard operational sections
 * (Historial de Propiedad, Almacén de cosechas, gastos prorrateados y tipos de maquinaria).
 * Safe to call immediately after login and again once activeCampaignId resolves.
 */
export function scheduleStandardPreload(activeCampaignId?: string | null) {
  if (!getActiveSession()) return;
  const sessionGen = getCacheSessionGeneration();
  const normalizedCampaign =
    activeCampaignId && activeCampaignId !== 'all' ? String(activeCampaignId) : undefined;
  const campaignKey = normalizedCampaign || 'all';

  const tasks: PreloadTask[] = [
    {
      key: cacheKeys.harvestList(campaignKey),
      priority: 10,
      adminOnly: false,
      sessionGen,
      adminGen: adminGeneration,
      run: () =>
        revalidateQuery(
          cacheKeys.harvestList(campaignKey),
          () => getHarvests({ campanaId: normalizedCampaign, soloPendientes: false }, false),
          { force: false, minIntervalMs: PRELOAD_MIN_INTERVAL_MS, priority: 'background' }
        ),
    },
    {
      key: cacheKeys.harvestPending(),
      priority: 20,
      adminOnly: false,
      sessionGen,
      adminGen: adminGeneration,
      run: () =>
        revalidateQuery(cacheKeys.harvestPending(), () => getPendingHarvests(false), {
          force: false,
          minIntervalMs: PRELOAD_MIN_INTERVAL_MS,
          priority: 'background',
        }),
    },
    {
      key: cacheKeys.expenseAllocations(campaignKey),
      priority: 30,
      adminOnly: false,
      sessionGen,
      adminGen: adminGeneration,
      run: () =>
        revalidateQuery(
          cacheKeys.expenseAllocations(campaignKey),
          () => getExpenseAllocations({ campanaId: normalizedCampaign }, false),
          { force: false, minIntervalMs: PRELOAD_MIN_INTERVAL_MS, priority: 'background' }
        ),
    },
    {
      key: cacheKeys.machineTypes(),
      priority: 40,
      adminOnly: false,
      sessionGen,
      adminGen: adminGeneration,
      run: () =>
        revalidateQuery(cacheKeys.machineTypes(), () => getMachineTypes(true), {
          force: false,
          minIntervalMs: PRELOAD_MIN_INTERVAL_MS,
          priority: 'background',
        }),
    },
  ];

  // Defer slightly so Inicio paints immediately and core App.tsx catalog requests start first
  if (startTimer !== null) {
    clearTimeout(startTimer);
    startTimer = null;
  }
  startTimer = setTimeout(() => {
    startTimer = null;
    if (!getActiveSession() || sessionGen !== getCacheSessionGeneration()) return;
    tasks.forEach(enqueueTask);
  }, INITIAL_START_DELAY_MS);
}

/**
 * Schedule progressive background preload for administrative sections
 * (Cuentas por cobrar, Ventas de cosecha y Almacén conciliado).
 * Strictly gated by hasAdminAuthorization() — never fires for non-admin sessions.
 */
export function scheduleAdminPreload() {
  if (!getActiveSession() || !hasAdminAuthorization()) return;
  const sessionGen = getCacheSessionGeneration();
  const currentAdminGen = adminGeneration;

  const adminTasks: PreloadTask[] = [
    {
      key: cacheKeys.arSummary(),
      priority: 15,
      adminOnly: true,
      sessionGen,
      adminGen: currentAdminGen,
      run: () =>
        revalidateQuery(cacheKeys.arSummary(), () => getArSummary(true), {
          force: false,
          minIntervalMs: PRELOAD_MIN_INTERVAL_MS,
          priority: 'background',
        }),
    },
    {
      key: cacheKeys.harvestSalesList('all'),
      priority: 25,
      adminOnly: true,
      sessionGen,
      adminGen: currentAdminGen,
      run: () =>
        revalidateQuery(
          cacheKeys.harvestSalesList('all'),
          () => fetchNormalizedHarvestSalesBundle(true),
          { force: false, minIntervalMs: PRELOAD_MIN_INTERVAL_MS, priority: 'background' }
        ),
    },
  ];

  setTimeout(() => {
    if (
      !getActiveSession() ||
      !hasAdminAuthorization() ||
      sessionGen !== getCacheSessionGeneration() ||
      currentAdminGen !== adminGeneration
    ) {
      return;
    }
    adminTasks.forEach(enqueueTask);
  }, INITIAL_START_DELAY_MS + 120);
}

/**
 * Cancel all queued/in-flight admin preload tasks and immediately purge admin-only cache entries.
 * Call whenever admin authorization is revoked or expires.
 */
export function cancelAdminPreload() {
  adminGeneration += 1;
  for (let i = pendingQueue.length - 1; i >= 0; i -= 1) {
    if (pendingQueue[i].adminOnly) {
      queuedOrRunningKeys.delete(pendingQueue[i].key);
      pendingQueue.splice(i, 1);
    }
  }
  clearAdminCache();
}

/**
 * Cancel all background preloading immediately (logout / session switch).
 */
export function cancelAllPreloads() {
  adminGeneration += 1;
  if (startTimer !== null) {
    clearTimeout(startTimer);
    startTimer = null;
  }
  pendingQueue.length = 0;
  queuedOrRunningKeys.clear();
}
