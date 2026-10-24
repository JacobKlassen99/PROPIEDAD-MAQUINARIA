import React, { useState, useEffect, useCallback } from 'react';
import {
  getActiveSession,
  logout,
  getCampaigns,
  getMachines,
  getLots,
  getMachineryJobs,
  getExpenses,
  getIncomes,
  getItemsConfig,
  getAssets,
  getExchangeRateConfig,
  checkBackendHealth,
} from './services/backend';
import {
  UserSession,
  Campaign,
  Machine,
  Lot,
  MachineryJob,
  Expense,
  Income,
  ItemConfig,
  Asset,
  ExchangeRateConfig,
  Currency,
} from './types';

import { LoginView } from './views/LoginView';
import { Sidebar, MainView } from './components/Sidebar';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAppsScriptModal, setShowAppsScriptModal] = useState(false);

  // Global State Loaded from Google Sheets
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaign, setActiveCampaignState] = useState<Campaign | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
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
      if (lotsRes.status === 'fulfilled') setLots(lotsRes.value || []);
      if (jobsRes.status === 'fulfilled') setJobs(jobsRes.value || []);
      if (expRes.status === 'fulfilled') setExpenses(expRes.value || []);
      if (incRes.status === 'fulfilled') setIncomes(incRes.value || []);
      if (itemsRes.status === 'fulfilled') setItemsConfig(itemsRes.value || []);
      if (assetsRes.status === 'fulfilled') setAssets(assetsRes.value || []);
      if (rateRes.status === 'fulfilled') setExchangeRate(rateRes.value);
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

  if (!session) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  const [machineryKey, setMachineryKey] = useState(0);
  const [propertyKey, setPropertyKey] = useState(0);
  const [adminKey, setAdminKey] = useState(0);

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

  const viewTitles: Record<MainView, { title: string; subtitle: string }> = {
    inicio: {
      title: 'INICIO Y RESUMEN GENERAL',
      subtitle: 'Visión consolidada de Maquinarias y Propiedad para la campaña activa',
    },
    maquinarias: {
      title: 'MAQUINARIAS',
      subtitle: 'Servicios a terceros, trabajos en propiedad, gastos y rendimiento de equipos',
    },
    propiedad: {
      title: 'PROPIEDAD',
      subtitle: 'Lotes, gastos agrícolas, ingresos de cosecha y trabajos recibidos',
    },
    administracion: {
      title: 'ADMINISTRACIÓN DEL SISTEMA',
      subtitle: 'Configuración, reportes financieros y parámetros maestros',
    },
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 flex font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        session={session}
        onLogout={handleLogout}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
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
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenAppsScriptModal={() => setShowAppsScriptModal(true)}
        />

        {/* View Body */}
        <main className="flex-1 p-3 pb-24 sm:p-6 sm:pb-8 lg:p-8 max-w-7xl w-full mx-auto min-w-0">
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
              lots={lots}
              jobs={jobs}
              expenses={expenses}
              incomes={incomes}
              itemsConfig={itemsConfig}
              assets={assets}
              exchangeRate={exchangeRate}
              currency={currency}
              onRefreshData={() => loadData(false)}
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
