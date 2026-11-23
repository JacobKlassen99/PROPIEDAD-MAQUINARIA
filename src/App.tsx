import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  getActiveSession,
  logout,
  onSessionChange,
  hasAdminAuthorization,
  onAdminAuthChange,
  validateCurrentSession,
  getCampaigns,
  getMachines,
  getLots,
  getMachineryJobs,
  getExpenses,
  getIncomes,
  getItemsConfig,
  getAssets,
  getExchangeRateConfig,
  syncExchangeRateDailyAuto,
  getMachineJobTypes,
  invalidateBackendDomains,
  resetAllPrivateMemoryData,
} from './services/backend';
import { getCacheSessionGeneration } from './services/dataCache';
import {
  UserSession,
  Campaign,
  Machine,
  MachineJobType,
  Lot,
  MachineryJob,
  Expense,
  Income,
  ItemConfig,
  Asset,
  ExchangeRateConfig,
  Currency,
  MainView,
} from './types';

import { LoginView } from './views/LoginView';
import { Navbar } from './components/Navbar';
import { DashboardView } from './views/DashboardView';
import { MachineryView } from './views/MachineryView';
import { PropertyView } from './views/PropertyView';
import { AdminView } from './views/AdminView';
import { AppsScriptModal } from './components/AppsScriptModal';
import { PWAUpdateNotification } from './components/PWAUpdateNotification';
import { BottomNav } from './components/BottomNav';

export type RefreshScope =
  | 'all'
  | 'catalogs'
  | 'catalogs_and_assets'
  | 'jobs'
  | 'movements'
  | 'assets'
  | 'fx';

const INITIAL_EXCHANGE_RATE: ExchangeRateConfig = {
  tasaBobPerUsd: 0,
  fuente: 'bcb',
  fechaActualizacion: '',
  estado: 'pendiente',
};

export default function App() {
  const [session, setSession] = useState<UserSession | null>(getActiveSession());
  const [isAdmin, setIsAdmin] = useState<boolean>(hasAdminAuthorization());
  const [currentView, setCurrentView] = useState<MainView>('inicio');
  const [showAppsScriptModal, setShowAppsScriptModal] = useState(false);

  // Global State Loaded from Google Sheets (persists across view navigation in memory)
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaign, setActiveCampaignState] = useState<Campaign | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineJobTypes, setMachineJobTypes] = useState<MachineJobType[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [jobs, setJobs] = useState<MachineryJob[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [itemsConfig, setItemsConfig] = useState<ItemConfig[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [exchangeRate, setExchangeRate] = useState<ExchangeRateConfig>(INITIAL_EXCHANGE_RATE);
  const exchangeRateRef = useRef<ExchangeRateConfig>(exchangeRate);
  useEffect(() => {
    exchangeRateRef.current = exchangeRate;
  }, [exchangeRate]);

  // Track initial load & per-domain monotonic sequence numbers to prevent stale overwrites
  const [hasLoadedCoreData, setHasLoadedCoreData] = useState(false);
  const activeLoadsCountRef = useRef(0);
  const domainSeqRef = useRef({
    catalogs: 0,
    jobs: 0,
    movements: 0,
    assets: 0,
    fx: 0,
  });

  // Clear all private in-memory UI state when logging out or switching users
  const clearAllLocalState = useCallback(() => {
    domainSeqRef.current.catalogs += 1;
    domainSeqRef.current.jobs += 1;
    domainSeqRef.current.movements += 1;
    domainSeqRef.current.assets += 1;
    domainSeqRef.current.fx += 1;
    setCampaigns([]);
    setActiveCampaignState(null);
    setMachines([]);
    setMachineJobTypes([]);
    setLots([]);
    setJobs([]);
    setExpenses([]);
    setIncomes([]);
    setItemsConfig([]);
    setAssets([]);
    setExchangeRate(INITIAL_EXCHANGE_RATE);
    setHasLoadedCoreData(false);
    setFetchError(null);
    setCurrentView('inicio');
  }, []);

  // Non-blocking background daily official BCB sync (respects manual override and Bolivia timezone)
  const triggerDailyBcbSync = useCallback((currentRate?: ExchangeRateConfig | null) => {
    if (!getActiveSession()) return;
    const rateToCheck = currentRate ?? exchangeRateRef.current;
    if (rateToCheck?.fuente === 'manual') return;
    const reqGen = getCacheSessionGeneration();
    syncExchangeRateDailyAuto(rateToCheck)
      .then((synced) => {
        if (reqGen !== getCacheSessionGeneration()) return;
        if (synced && synced.tasaBobPerUsd > 0) {
          setExchangeRate(synced);
        }
      })
      .catch(() => {
        // Non-blocking: preserve stored rate on network or backend failure
      });
  }, []);

  const [machineryKey, setMachineryKey] = useState(0);
  const [propertyKey, setPropertyKey] = useState(0);
  const [adminKey, setAdminKey] = useState(0);

  const [currency, setCurrency] = useState<Currency>('USD');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [_isInFinanzas, setIsInFinanzas] = useState(false);

  // Scoped, race-safe data loader from Google Sheets (preserves existing data during updates)
  const loadData = useCallback(
    async (useCache = true, scope: RefreshScope = 'all') => {
      if (!getActiveSession()) return;

      const reqGen = getCacheSessionGeneration();
      const loadCatalogs = scope === 'all' || scope === 'catalogs' || scope === 'catalogs_and_assets';
      const loadJobs = scope === 'all' || scope === 'jobs';
      const loadMovements = scope === 'all' || scope === 'jobs' || scope === 'movements';
      const loadAssets = scope === 'all' || scope === 'assets' || scope === 'catalogs_and_assets';
      const loadFx = scope === 'all' || scope === 'fx';

      const seqCatalogs = loadCatalogs ? ++domainSeqRef.current.catalogs : 0;
      const seqJobs = loadJobs ? ++domainSeqRef.current.jobs : 0;
      const seqMovements = loadMovements ? ++domainSeqRef.current.movements : 0;
      const seqAssets = loadAssets ? ++domainSeqRef.current.assets : 0;
      const seqFx = loadFx ? ++domainSeqRef.current.fx : 0;

      activeLoadsCountRef.current += 1;
      setIsRefreshing(true);
      setFetchError(null);

      try {
        const tasks: Array<Promise<void>> = [];

        if (loadCatalogs) {
          tasks.push(
            Promise.allSettled([
              getCampaigns(useCache),
              getMachines(useCache),
              getLots(useCache),
              getItemsConfig(useCache),
              getMachineJobTypes(undefined, useCache),
            ]).then(([campsRes, machsRes, lotsRes, itemsRes, jobTypesRes]) => {
              if (reqGen !== getCacheSessionGeneration() || seqCatalogs !== domainSeqRef.current.catalogs) {
                return;
              }
              if (campsRes.status === 'fulfilled') {
                const list = campsRes.value || [];
                setCampaigns(list);
                const active = list.find((c) => c.activa) || list[0] || null;
                setActiveCampaignState(active);
              }
              if (machsRes.status === 'fulfilled') {
                setMachines(machsRes.value || []);
              }
              if (lotsRes.status === 'fulfilled') {
                setLots(lotsRes.value || []);
              }
              if (itemsRes.status === 'fulfilled') {
                setItemsConfig(itemsRes.value || []);
              }
              if (jobTypesRes.status === 'fulfilled') {
                setMachineJobTypes(jobTypesRes.value || []);
              }
            })
          );
        }

        if (loadJobs) {
          tasks.push(
            getMachineryJobs(undefined, useCache)
              .then((list) => {
                if (reqGen !== getCacheSessionGeneration() || seqJobs !== domainSeqRef.current.jobs) {
                  return;
                }
                setJobs(list || []);
              })
              .catch(() => {
                // Keep existing jobs visible on transient failure
              })
          );
        }

        if (loadMovements) {
          tasks.push(
            Promise.allSettled([
              getExpenses(undefined, undefined, useCache),
              getIncomes(undefined, undefined, useCache),
            ]).then(([expRes, incRes]) => {
              if (reqGen !== getCacheSessionGeneration() || seqMovements !== domainSeqRef.current.movements) {
                return;
              }
              if (expRes.status === 'fulfilled') setExpenses(expRes.value || []);
              if (incRes.status === 'fulfilled') setIncomes(incRes.value || []);
            })
          );
        }

        if (loadAssets) {
          tasks.push(
            getAssets(useCache)
              .then((list) => {
                if (reqGen !== getCacheSessionGeneration() || seqAssets !== domainSeqRef.current.assets) {
                  return;
                }
                setAssets(list || []);
              })
              .catch(() => {
                // Keep existing assets visible on transient failure
              })
          );
        }

        if (loadFx) {
          tasks.push(
            getExchangeRateConfig(useCache)
              .then((rate) => {
                if (reqGen !== getCacheSessionGeneration() || seqFx !== domainSeqRef.current.fx) {
                  return;
                }
                if (rate) {
                  setExchangeRate(rate);
                  triggerDailyBcbSync(rate);
                }
              })
              .catch(() => {
                // Keep existing exchange rate visible on transient failure
              })
          );
        }

        await Promise.allSettled(tasks);

        if (reqGen === getCacheSessionGeneration() && scope === 'all') {
          setHasLoadedCoreData(true);
        }
      } catch (err: unknown) {
        if (reqGen === getCacheSessionGeneration()) {
          setFetchError(
            err instanceof Error ? err.message : 'Error al sincronizar con Google Sheets'
          );
        }
      } finally {
        activeLoadsCountRef.current = Math.max(0, activeLoadsCountRef.current - 1);
        if (activeLoadsCountRef.current === 0) {
          setIsRefreshing(false);
        }
      }
    },
    [triggerDailyBcbSync]
  );

  const handleScopedRefresh = useCallback(
    (scope: RefreshScope = 'all') => loadData(false, scope),
    [loadData]
  );

  // Load initial data once per active session token (avoids duplicate fetches on login)
  const loadedSessionTokenRef = useRef<string | null>(null);
  useEffect(() => {
    const token = session?.token || null;
    if (!token) {
      loadedSessionTokenRef.current = null;
      clearAllLocalState();
      return;
    }
    if (loadedSessionTokenRef.current !== token) {
      if (loadedSessionTokenRef.current !== null) {
        // User/token switched: wipe prior user's local state before fetching
        clearAllLocalState();
      }
      loadedSessionTokenRef.current = token;
      loadData(true, 'all');
    }
  }, [session?.token, loadData, clearAllLocalState]);

  // Global session and admin authorization listeners
  useEffect(() => {
    const unsubscribeSession = onSessionChange((newSession) => {
      setSession(newSession);
    });
    const unsubscribeAdmin = onAdminAuthChange((authorized) => {
      setIsAdmin(authorized);
    });
    return () => {
      unsubscribeSession();
      unsubscribeAdmin();
    };
  }, []);

  // Proactive session revalidation and new-day BCB check when user re-opens or focuses the app
  useEffect(() => {
    const handleRevalidate = () => {
      if (document.visibilityState === 'visible' && getActiveSession()) {
        validateCurrentSession().catch(() => {});
        triggerDailyBcbSync(exchangeRateRef.current);
      }
    };
    document.addEventListener('visibilitychange', handleRevalidate);
    window.addEventListener('focus', handleRevalidate);
    return () => {
      document.removeEventListener('visibilitychange', handleRevalidate);
      window.removeEventListener('focus', handleRevalidate);
    };
  }, [triggerDailyBcbSync]);

  const handleLoginSuccess = (newSession: UserSession) => {
    setSession(newSession);
  };

  const handleLogout = async () => {
    await logout();
    resetAllPrivateMemoryData();
    clearAllLocalState();
    setSession(null);
  };

  const handleManualGlobalRefresh = () => {
    invalidateBackendDomains(['cobros.', 'harvest.', 'expense.allocations', 'machineType.']);
    loadData(false, 'all');
  };

  const toggleCurrency = () => {
    setCurrency((prev) => (prev === 'BOB' ? 'USD' : 'BOB'));
  };

  const handleNavigate = (view: MainView) => {
    if (view === 'maquinarias') {
      setMachineryKey((prev) => prev + 1);
    } else if (view === 'propiedad') {
      setPropertyKey((prev) => prev + 1);
    } else if (view === 'administracion') {
      setAdminKey((prev) => prev + 1);
    }
    setCurrentView(view);
  };

  if (!session) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  const viewTitles: Record<MainView, { title: string; subtitle: string }> = {
    inicio: {
      title: 'Inicio',
      subtitle: 'Accesos principales',
    },
    maquinarias: {
      title: 'Maquinarias',
      subtitle: 'Movimientos de trabajos y equipos',
    },
    propiedad: {
      title: 'Propiedad',
      subtitle: 'Movimientos, lotes y cosechas',
    },
    administracion: {
      title: 'Administración',
      subtitle: 'Configuración y reportes',
    },
  };

  return (
    <div className="h-screen h-[100dvh] max-h-[100dvh] w-full max-w-full flex flex-col overflow-hidden bg-[#FAFBF8] text-[#26352D] selection:bg-[#EAF5EE] selection:text-[#24875B]">
      {/* PWA Update Banner (Top Full-Width) */}
      <PWAUpdateNotification />

      {/* Top Zone: Fixed Top Header Navbar (shrink-0, outside scroll container) */}
      <Navbar
        title={viewTitles[currentView]?.title || viewTitles.inicio.title}
        subtitle={viewTitles[currentView]?.subtitle || viewTitles.inicio.subtitle}
        activeCampaign={activeCampaign}
        currency={currency}
        onCurrencyToggle={toggleCurrency}
        exchangeRate={exchangeRate}
        onRefresh={handleManualGlobalRefresh}
        isRefreshing={isRefreshing}
        onOpenAppsScriptModal={() => setShowAppsScriptModal(true)}
        session={session}
        onLogout={handleLogout}
        onAdminAuthorizationRevoked={() => {
          setAdminKey((prev) => prev + 1);
          if (currentView === 'administracion') {
            handleNavigate('inicio');
          }
        }}
      />

      {/* Middle Zone: Exclusively Scrollable Content Area */}
      <div
        id="main-scroll-container"
        className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden overscroll-y-contain bg-[#FAFBF8]"
      >
        <main className="p-4 pb-8 sm:p-6 sm:pb-10 lg:p-8 max-w-4xl w-full mx-auto min-w-0">
          {fetchError && (
            <div className="no-print mb-4 rounded-xl border border-[#C44545]/30 bg-[#FCECEC] px-4 py-3 text-sm text-[#C44545] font-medium flex items-center justify-between gap-3">
              <span className="min-w-0 break-words">
                {hasLoadedCoreData
                  ? `No se pudo actualizar (${fetchError}). Mostrando los últimos datos cargados.`
                  : fetchError}
              </span>
              <button
                type="button"
                onClick={handleManualGlobalRefresh}
                className="shrink-0 text-xs font-bold underline cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          )}

          {currentView === 'inicio' && (
            <DashboardView
              activeCampaign={activeCampaign}
              onNavigate={(v) => handleNavigate(v as MainView)}
            />
          )}

          {currentView === 'maquinarias' && (
            <MachineryView
              key={machineryKey}
              campaigns={campaigns}
              activeCampaign={activeCampaign}
              machines={machines}
              machineJobTypes={machineJobTypes}
              lots={lots}
              jobs={jobs}
              expenses={expenses}
              itemsConfig={itemsConfig}
              assets={assets}
              currency={currency}
              exchangeRate={exchangeRate}
              isAdmin={isAdmin}
              isSyncingGlobal={isRefreshing}
              hasLoadedGlobal={hasLoadedCoreData}
              onRefreshData={handleScopedRefresh}
            />
          )}

          {currentView === 'propiedad' && (
            <PropertyView
              key={propertyKey}
              campaigns={campaigns}
              activeCampaign={activeCampaign}
              lots={lots}
              expenses={expenses}
              incomes={incomes}
              jobs={jobs}
              itemsConfig={itemsConfig}
              currency={currency}
              exchangeRate={exchangeRate}
              isAdmin={isAdmin}
              isSyncingGlobal={isRefreshing}
              hasLoadedGlobal={hasLoadedCoreData}
              onRefreshData={handleScopedRefresh}
            />
          )}

          {(currentView === 'administracion' || (currentView as string) === 'reportes') && (
            <AdminView
              key={adminKey}
              session={session}
              campaigns={campaigns}
              activeCampaign={activeCampaign}
              machines={machines}
              machineJobTypes={machineJobTypes}
              lots={lots}
              jobs={jobs}
              expenses={expenses}
              incomes={incomes}
              itemsConfig={itemsConfig}
              assets={assets}
              exchangeRate={exchangeRate}
              onExchangeRateUpdated={setExchangeRate}
              currency={currency}
              isSyncingGlobal={isRefreshing}
              hasLoadedGlobal={hasLoadedCoreData}
              onRefreshData={handleScopedRefresh}
              onRevokeAuthorization={() => handleNavigate('inicio')}
              onFinanzasModeChange={setIsInFinanzas}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Fixed) */}
      <BottomNav
        currentView={currentView}
        onNavigate={handleNavigate}
        session={session}
      />

      {/* Apps Script Companion Code Modal */}
      <AppsScriptModal
        isOpen={showAppsScriptModal}
        onClose={() => setShowAppsScriptModal(false)}
      />
    </div>
  );
}
