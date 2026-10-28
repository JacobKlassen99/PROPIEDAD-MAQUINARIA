import React, { useState, useEffect, useCallback } from 'react';
import {
  getActiveSession,
  logout,
  onSessionChange,
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
  getMachineJobTypes,
  checkBackendHealth,
} from './services/backend';
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
import { ReportsView } from './views/ReportsView';
import { AdminView } from './views/AdminView';
import { AppsScriptModal } from './components/AppsScriptModal';
import { PWAUpdateNotification } from './components/PWAUpdateNotification';
import { BottomNav } from './components/BottomNav';

export default function App() {
  const [session, setSession] = useState<UserSession | null>(getActiveSession());
  const [currentView, setCurrentView] = useState<MainView>('inicio');
  const [showAppsScriptModal, setShowAppsScriptModal] = useState(false);

  // Global State Loaded from Google Sheets
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
  const [exchangeRate, setExchangeRate] = useState<ExchangeRateConfig>({
    tasaBobPerUsd: 6.96,
    fuente: 'manual',
    fechaActualizacion: new Date().toISOString().slice(0, 10),
  });

  const [machineryKey, setMachineryKey] = useState(0);
  const [propertyKey, setPropertyKey] = useState(0);
  const [adminKey, setAdminKey] = useState(0);

  const [currency, setCurrency] = useState<Currency>('BOB');
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Load initial data from Google Sheets
  const loadData = useCallback(async (useCache = true) => {
    if (!getActiveSession()) return;
    setIsRefreshing(true);
    setFetchError(null);

    try {
      const [
        campsRes,
        machsRes,
        lotsRes,
        jobsRes,
        expRes,
        incRes,
        itemsRes,
        assetsRes,
        rateRes,
        jobTypesRes,
      ] = await Promise.allSettled([
        getCampaigns(useCache),
        getMachines(useCache),
        getLots(useCache),
        getMachineryJobs(undefined, useCache),
        getExpenses(undefined, undefined, useCache),
        getIncomes(undefined, undefined, useCache),
        getItemsConfig(useCache),
        getAssets(useCache),
        getExchangeRateConfig(useCache),
        getMachineJobTypes(undefined, useCache),
      ]);

      if (campsRes.status === 'fulfilled') {
        const list = campsRes.value || [];
        setCampaigns(list);
        const active = list.find((c) => c.activa) || list[0] || null;
        setActiveCampaignState(active);
      }

      if (machsRes.status === 'fulfilled') {
        const mList = machsRes.value || [];
        console.log(`[App.tsx Diagnostic] Machines loaded into state: ${mList.length}`);
        setMachines(mList);
      } else {
        console.warn(`[App.tsx Diagnostic Error] Machines fetch rejected:`, machsRes.reason);
      }

      if (jobTypesRes.status === 'fulfilled') {
        setMachineJobTypes(jobTypesRes.value || []);
      }

      if (lotsRes.status === 'fulfilled') setLots(lotsRes.value || []);
      if (jobsRes.status === 'fulfilled') setJobs(jobsRes.value || []);
      if (expRes.status === 'fulfilled') setExpenses(expRes.value || []);
      if (incRes.status === 'fulfilled') setIncomes(incRes.value || []);
      if (itemsRes.status === 'fulfilled') setItemsConfig(itemsRes.value || []);
      if (assetsRes.status === 'fulfilled') setAssets(assetsRes.value || []);
      if (rateRes.status === 'fulfilled' && rateRes.value) {
        setExchangeRate(rateRes.value);
      }
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Error al sincronizar con Google Sheets');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (session) {
      loadData(true);
    }
  }, [session, loadData]);

  // Global session invalidation listener
  useEffect(() => {
    const unsubscribe = onSessionChange((newSession) => {
      setSession(newSession);
    });
    return unsubscribe;
  }, []);

  // Proactive session revalidation when user re-opens or focuses the app
  useEffect(() => {
    const handleRevalidate = () => {
      if (document.visibilityState === 'visible' && getActiveSession()) {
        validateCurrentSession().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleRevalidate);
    window.addEventListener('focus', handleRevalidate);
    return () => {
      document.removeEventListener('visibilitychange', handleRevalidate);
      window.removeEventListener('focus', handleRevalidate);
    };
  }, []);

  const handleLoginSuccess = (newSession: UserSession) => {
    setSession(newSession);
    loadData(false);
  };

  const handleLogout = async () => {
    await logout();
    setSession(null);
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
      subtitle: 'Resumen operativo',
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
    <div className="min-h-screen bg-[#F2F2F7] text-slate-900 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Sticky Header Navbar */}
      <Navbar
        title={viewTitles[currentView]?.title || viewTitles.inicio.title}
        subtitle={viewTitles[currentView]?.subtitle || viewTitles.inicio.subtitle}
        activeCampaign={activeCampaign}
        currency={currency}
        onCurrencyToggle={toggleCurrency}
        showCurrencyToggle={currentView === 'administracion'}
        exchangeRate={exchangeRate}
        onRefresh={() => loadData(false)}
        isRefreshing={isRefreshing}
        onOpenAppsScriptModal={() => setShowAppsScriptModal(true)}
        session={session}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* View Body */}
        <main className="flex-1 p-3 pb-28 sm:p-6 sm:pb-28 lg:p-8 lg:pb-28 max-w-5xl w-full mx-auto min-w-0">
          {currentView === 'inicio' && (
            <DashboardView
              activeCampaign={activeCampaign}
              machines={machines}
              lots={lots}
              jobs={jobs}
              onNavigate={(v) => handleNavigate(v as MainView)}
            />
          )}

          {currentView === 'maquinarias' && (
            <MachineryView
              key={machineryKey}
              activeCampaign={activeCampaign}
              machines={machines}
              machineJobTypes={machineJobTypes}
              lots={lots}
              jobs={jobs}
              expenses={expenses}
              itemsConfig={itemsConfig}
              currency={currency}
              exchangeRate={exchangeRate}
              onRefreshData={() => loadData(false)}
            />
          )}

          {currentView === 'propiedad' && (
            <PropertyView
              key={propertyKey}
              activeCampaign={activeCampaign}
              lots={lots}
              expenses={expenses}
              incomes={incomes}
              jobs={jobs}
              itemsConfig={itemsConfig}
              currency={currency}
              exchangeRate={exchangeRate}
              onRefreshData={() => loadData(false)}
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
              currency={currency}
              onRefreshData={() => loadData(false)}
              onRevokeAuthorization={() => handleNavigate('inicio')}
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

      {/* PWA Update Banner */}
      <PWAUpdateNotification />

      {/* Apps Script Companion Code Modal */}
      <AppsScriptModal
        isOpen={showAppsScriptModal}
        onClose={() => setShowAppsScriptModal(false)}
      />
    </div>
  );
}
