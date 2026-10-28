import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  DollarSign,
  Tractor,
  Trees,
  Layers,
  Calendar,
  ChevronRight,
  ArrowLeft,
  Info,
  AlertCircle,
} from 'lucide-react';
import {
  Campaign,
  Machine,
  MachineJobType,
  Lot,
  MachineryJob,
  Expense,
  Income,
  Currency,
  ExchangeRateConfig,
} from '../types';

interface Props {
  campaigns?: Campaign[];
  activeCampaign?: Campaign | null;
  machines?: Machine[];
  machineJobTypes?: MachineJobType[];
  lots?: Lot[];
  jobs?: MachineryJob[];
  expenses?: Expense[];
  incomes?: Income[];
  currency?: Currency;
  exchangeRate?: ExchangeRateConfig;
}

type ReportScreen =
  | 'menu'
  | 'resumen'
  | 'maquinarias'
  | 'propiedad'
  | 'lotes'
  | 'campanas';

// ============================================================================
// REACT ERROR BOUNDARY TO PREVENT WHITE SCREENS
// ============================================================================
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ReportsErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ReportsErrorBoundary Error Caught]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-red-900 space-y-4 max-w-xl mx-auto my-6 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-red-950">
                Ocurrió un inconveniente al cargar el reporte
              </h3>
              <p className="text-xs text-red-800 mt-1 leading-relaxed">
                {this.state.error?.message ||
                  'No se pudo presentar la información de reportes correctamente.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl transition cursor-pointer min-h-[40px]"
          >
            Reintentar vista de reportes
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// MAIN REPORTS COMPONENT
// ============================================================================
const ReportsViewInner: React.FC<Props> = ({
  campaigns = [],
  activeCampaign = null,
  machines = [],
  machineJobTypes = [],
  lots = [],
  jobs = [],
  expenses = [],
  incomes = [],
  currency: activeCurrency = 'BOB',
  exchangeRate,
}) => {
  // Defensive Normalization of Props (Guarantees Arrays even if caller passed null)
  const safeCampaigns = useMemo(
    () => (Array.isArray(campaigns) ? campaigns.filter(Boolean) : []),
    [campaigns]
  );
  const safeMachines = useMemo(
    () => (Array.isArray(machines) ? machines.filter(Boolean) : []),
    [machines]
  );
  const safeLots = useMemo(
    () => (Array.isArray(lots) ? lots.filter(Boolean) : []),
    [lots]
  );
  const safeJobs = useMemo(
    () => (Array.isArray(jobs) ? jobs.filter(Boolean) : []),
    [jobs]
  );
  const safeExpenses = useMemo(
    () => (Array.isArray(expenses) ? expenses.filter(Boolean) : []),
    [expenses]
  );
  const safeIncomes = useMemo(
    () => (Array.isArray(incomes) ? incomes.filter(Boolean) : []),
    [incomes]
  );
  const safeExchangeRate = useMemo(
    () =>
      exchangeRate && typeof exchangeRate === 'object'
        ? exchangeRate
        : { tasaBobPerUsd: 6.96, fuente: 'manual' as const, fechaActualizacion: '' },
    [exchangeRate]
  );

  // Navigation State
  const [currentScreen, setCurrentScreen] = useState<ReportScreen>('menu');
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [selectedCampaignDetailId, setSelectedCampaignDetailId] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // Gestiones Extraction & Selection
  // --------------------------------------------------------------------------
  const availableGestiones = useMemo(() => {
    const gestionSet = new Set<string>();

    safeCampaigns.forEach((c) => {
      if (!c) return;
      const nombreStr = String(c.nombre ?? '');
      const match = nombreStr.match(/\b(20\d{2})\b/);
      if (match) {
        gestionSet.add(match[1]);
      } else if (c.fechaInicio) {
        const year = String(c.fechaInicio).slice(0, 4);
        if (year && year.startsWith('20')) gestionSet.add(year);
      }
    });

    [...safeJobs, ...safeExpenses, ...safeIncomes].forEach((item) => {
      if (item && item.fecha) {
        const year = String(item.fecha).slice(0, 4);
        if (year && year.startsWith('20')) gestionSet.add(year);
      }
    });

    if (gestionSet.size === 0) {
      gestionSet.add('2026');
    }

    return Array.from(gestionSet).sort((a, b) => b.localeCompare(a));
  }, [safeCampaigns, safeJobs, safeExpenses, safeIncomes]);

  const defaultActiveGestion = useMemo(() => {
    if (activeCampaign) {
      const activeNombreStr = String(activeCampaign.nombre ?? '');
      const match = activeNombreStr.match(/\b(20\d{2})\b/);
      if (match) return match[1];
      if (activeCampaign.fechaInicio) {
        const year = String(activeCampaign.fechaInicio).slice(0, 4);
        if (year && year.startsWith('20')) return year;
      }
    }
    return availableGestiones[0] || '2026';
  }, [activeCampaign, availableGestiones]);

  const [selectedGestion, setSelectedGestion] = useState<string>(defaultActiveGestion);

  // --------------------------------------------------------------------------
  // Currency Conversion Helpers (Strictly using shared activeCurrency)
  // --------------------------------------------------------------------------
  const toViewCurrency = (
    amount: number | undefined | null,
    itemMoneda: Currency | string = 'BOB',
    itemTc?: number
  ): number => {
    const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    const itemCur: Currency = String(itemMoneda || 'BOB')
      .toUpperCase()
      .includes('USD')
      ? 'USD'
      : 'BOB';

    if (itemCur === activeCurrency) return num;

    const rate =
      typeof itemTc === 'number' && itemTc > 0
        ? itemTc
        : safeExchangeRate.tasaBobPerUsd && safeExchangeRate.tasaBobPerUsd > 0
        ? safeExchangeRate.tasaBobPerUsd
        : 6.96;

    if (itemCur === 'USD' && activeCurrency === 'BOB') {
      return num * rate;
    }
    if (itemCur === 'BOB' && activeCurrency === 'USD') {
      return num / rate;
    }
    return num;
  };

  const formatMoney = (val: number | undefined | null, cur: Currency = activeCurrency) => {
    const symbol = cur === 'BOB' ? 'Bs' : 'USD';
    const num = typeof val === 'number' && !isNaN(val) ? val : 0;
    return `${symbol} ${num.toLocaleString('es-BO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatOriginal = (amount: number | undefined | null, itemMoneda: Currency | string = 'BOB') => {
    const symbol = String(itemMoneda || 'BOB')
      .toUpperCase()
      .includes('USD')
      ? 'USD'
      : 'Bs';
    const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    return `${symbol} ${num.toLocaleString('es-BO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // --------------------------------------------------------------------------
  // Dataset Filtered Strictly by Gestión
  // --------------------------------------------------------------------------
  const isCampaignInGestion = (c: Campaign | null | undefined, gestion: string) => {
    if (!c) return false;
    const nombreStr = String(c.nombre ?? '');
    const fechaInicioStr = String(c.fechaInicio ?? '');
    const fechaFinStr = String(c.fechaFin ?? '');

    if (nombreStr.includes(gestion)) return true;
    if (fechaInicioStr.startsWith(gestion)) return true;
    if (fechaFinStr.startsWith(gestion)) return true;
    return false;
  };

  const isItemInGestion = (
    item: { fecha?: string; campanaId?: string } | null | undefined,
    gestion: string
  ) => {
    if (!item) return false;
    if (item.campanaId) {
      const camp = safeCampaigns.find((c) => c && String(c.id) === String(item.campanaId));
      if (camp && isCampaignInGestion(camp, gestion)) return true;
    }
    const fechaStr = String(item.fecha ?? '');
    if (fechaStr.startsWith(gestion)) return true;
    return false;
  };

  const filteredJobs = useMemo(
    () => safeJobs.filter((j) => isItemInGestion(j, selectedGestion)),
    [safeJobs, selectedGestion, safeCampaigns]
  );

  const filteredExpenses = useMemo(
    () => safeExpenses.filter((e) => isItemInGestion(e, selectedGestion)),
    [safeExpenses, selectedGestion, safeCampaigns]
  );

  const filteredIncomes = useMemo(
    () => safeIncomes.filter((i) => isItemInGestion(i, selectedGestion)),
    [safeIncomes, selectedGestion, safeCampaigns]
  );

  const gestionCampaigns = useMemo(
    () => safeCampaigns.filter((c) => isCampaignInGestion(c, selectedGestion)),
    [safeCampaigns, selectedGestion]
  );

  // --------------------------------------------------------------------------
  // Aggregates
  // --------------------------------------------------------------------------
  const extJobIncomes = filteredJobs
    .filter((j) => j && j.tipoTrabajo === 'tercero')
    .reduce(
      (sum, j) => sum + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
      0
    );

  const cropIncomes = filteredIncomes
    .filter((i) => i && i.modulo === 'propiedad' && !i.esTrabajoPropio)
    .reduce(
      (sum, i) => sum + toViewCurrency(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc),
      0
    );

  const maqDirectExps = filteredExpenses
    .filter((e) => e && e.modulo === 'maquinarias')
    .reduce(
      (sum, e) => sum + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
      0
    );

  const propDirectExps = filteredExpenses
    .filter((e) => e && e.modulo === 'propiedad' && !e.esTrabajoPropio)
    .reduce(
      (sum, e) => sum + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
      0
    );

  const intJobIncomes = filteredJobs
    .filter((j) => j && j.tipoTrabajo === 'propiedad')
    .reduce(
      (sum, j) => sum + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
      0
    );

  const propMaqServiceExps = filteredExpenses
    .filter((e) => e && e.modulo === 'propiedad' && e.esTrabajoPropio)
    .reduce(
      (sum, e) => sum + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
      0
    );

  const consolidatedIncomes = extJobIncomes + cropIncomes;
  const consolidatedExpenses = maqDirectExps + propDirectExps;
  const consolidatedProfit = consolidatedIncomes - consolidatedExpenses;

  const totalHorasMaq = filteredJobs
    .filter((j) => j && (j.unidad === 'hora' || (j.unidad as string) === 'h'))
    .reduce((sum, j) => sum + (Number(j.cantidad) || 0), 0);

  const totalHectareasMaq = filteredJobs
    .filter((j) => j && (j.unidad === 'hectarea' || (j.unidad as string) === 'ha'))
    .reduce((sum, j) => sum + (Number(j.cantidad) || 0), 0);

  // --------------------------------------------------------------------------
  // Print & Export Handlers
  // --------------------------------------------------------------------------
  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = (reportName: string, rows: (string | number)[][]) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      rows
        .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `reporte_${reportName}_gestion_${selectedGestion}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportResumenCSV = () => {
    const rows = [
      ['REPORTE', 'RESUMEN GENERAL'],
      ['GESTIÓN', selectedGestion],
      ['MONEDA REPORTE', activeCurrency],
      [''],
      ['CONCEPTO', `IMPORTE (${activeCurrency})`, 'DETALLE'],
      ['Ingresos por Servicios a Terceros', extJobIncomes.toFixed(2), 'Cobrado a clientes externos'],
      ['Ingresos por Venta de Cosechas', cropIncomes.toFixed(2), 'Ventas de productos agrícolas'],
      ['TOTAL INGRESOS REALES', consolidatedIncomes.toFixed(2), 'Ingreso de caja externo'],
      [''],
      ['Gastos Directos de Maquinarias', maqDirectExps.toFixed(2), 'Diésel, repuestos, filtros'],
      ['Gastos Directos de Propiedad', propDirectExps.toFixed(2), 'Semillas, fertilizantes, químicos'],
      ['TOTAL GASTOS REALES', consolidatedExpenses.toFixed(2), 'Egresos reales de caja'],
      [''],
      ['RESULTADO GENERAL', consolidatedProfit.toFixed(2), 'Ingresos reales menos gastos reales'],
      [''],
      [
        'NOTA INTERNA',
        intJobIncomes.toFixed(2),
        'Trabajo interno de maquinaria propia compensado internamente (no altera caja externa)',
      ],
    ];
    handleExportCSV('resumen_general', rows);
  };

  const exportMaquinariasCSV = () => {
    const rows = [
      ['REPORTE', 'MAQUINARIAS'],
      ['GESTIÓN', selectedGestion],
      ['MONEDA REPORTE', activeCurrency],
      [''],
      [
        'MAQUINARIA',
        'TIPO',
        'TRABAJOS',
        'HORAS',
        'HECTÁREAS',
        `INGRESOS TERCEROS (${activeCurrency})`,
        `TRABAJOS EN PROPIEDAD (${activeCurrency})`,
        `GASTOS DIRECTOS (${activeCurrency})`,
        `RESULTADO (${activeCurrency})`,
      ],
      ...safeMachines.map((m) => {
        const mJobs = filteredJobs.filter((j) => j && j.maquinariaId === m.id);
        const mExps = filteredExpenses.filter((e) => e && e.maquinariaId === m.id);
        const hrs = mJobs
          .filter((j) => j && (j.unidad === 'hora' || (j.unidad as string) === 'h'))
          .reduce((s, j) => s + (Number(j.cantidad) || 0), 0);
        const ha = mJobs
          .filter((j) => j && (j.unidad === 'hectarea' || (j.unidad as string) === 'ha'))
          .reduce((s, j) => s + (Number(j.cantidad) || 0), 0);
        const incExt = mJobs
          .filter((j) => j && j.tipoTrabajo === 'tercero')
          .reduce((s, j) => s + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc), 0);
        const incProp = mJobs
          .filter((j) => j && j.tipoTrabajo === 'propiedad')
          .reduce((s, j) => s + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc), 0);
        const exp = mExps.reduce(
          (s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
          0
        );
        const res = incExt + incProp - exp;
        return [
          m.nombre || 'Sin nombre',
          m.tipo || 'Maquinaria',
          mJobs.length,
          hrs.toFixed(1),
          ha.toFixed(1),
          incExt.toFixed(2),
          incProp.toFixed(2),
          exp.toFixed(2),
          res.toFixed(2),
        ];
      }),
      [''],
      [
        'TOTALES',
        '',
        filteredJobs.length,
        totalHorasMaq.toFixed(1),
        totalHectareasMaq.toFixed(1),
        extJobIncomes.toFixed(2),
        intJobIncomes.toFixed(2),
        maqDirectExps.toFixed(2),
        (extJobIncomes + intJobIncomes - maqDirectExps).toFixed(2),
      ],
    ];
    handleExportCSV('maquinarias', rows);
  };

  const exportPropiedadCSV = () => {
    const rows = [
      ['REPORTE', 'PROPIEDAD'],
      ['GESTIÓN', selectedGestion],
      ['MONEDA REPORTE', activeCurrency],
      [''],
      ['CONCEPTO', `IMPORTE (${activeCurrency})`, 'DETALLE'],
      ['Ingresos Agrícolas (Cosecha)', cropIncomes.toFixed(2), 'Venta de cosechas y productos agrícolas'],
      ['Gastos Directos Agrícolas', propDirectExps.toFixed(2), 'Semillas, fertilizantes, químicos, mano de obra'],
      ['Trabajos de Maquinaria Propia', propMaqServiceExps.toFixed(2), 'Costo interno de servicios asignado a lotes'],
      [''],
      [
        'RESULTADO AGRÍCOLA',
        (cropIncomes - propDirectExps - propMaqServiceExps).toFixed(2),
        'Ingresos menos gastos directos y maquinaria propia',
      ],
    ];
    handleExportCSV('propiedad', rows);
  };

  const exportLotesCSV = () => {
    const rows = [
      ['REPORTE', 'POR LOTE'],
      ['GESTIÓN', selectedGestion],
      ['MONEDA REPORTE', activeCurrency],
      [''],
      [
        'LOTE',
        'SUPERFICIE (HA)',
        'CULTIVO',
        `INGRESOS COSECHA (${activeCurrency})`,
        `GASTOS DIRECTOS (${activeCurrency})`,
        `MAQUINARIA PROPIA (${activeCurrency})`,
        `RESULTADO LOTE (${activeCurrency})`,
      ],
      ...safeLots.map((l) => {
        const lIncs = filteredIncomes
          .filter((i) => i && i.loteId === l.id)
          .reduce((s, i) => s + toViewCurrency(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc), 0);
        const lExpDir = filteredExpenses
          .filter((e) => e && e.loteId === l.id && !e.esTrabajoPropio)
          .reduce((s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc), 0);
        const lExpMaq = filteredExpenses
          .filter((e) => e && e.loteId === l.id && e.esTrabajoPropio)
          .reduce((s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc), 0);
        const net = lIncs - (lExpDir + lExpMaq);
        return [
          l.nombre || 'Sin nombre',
          l.superficieHectareas || 0,
          l.cultivoActual || 'Sin cultivo',
          lIncs.toFixed(2),
          lExpDir.toFixed(2),
          lExpMaq.toFixed(2),
          net.toFixed(2),
        ];
      }),
    ];
    handleExportCSV('lotes', rows);
  };

  const exportCampanasCSV = () => {
    const rows = [
      ['REPORTE', 'POR CAMPAÑA'],
      ['GESTIÓN', selectedGestion],
      ['MONEDA REPORTE', activeCurrency],
      [''],
      [
        'CAMPAÑA',
        'ESTADO',
        `INGRESOS (${activeCurrency})`,
        `GASTOS DIRECTOS (${activeCurrency})`,
        `MAQUINARIA PROPIA (${activeCurrency})`,
        `RESULTADO (${activeCurrency})`,
      ],
      ...gestionCampaigns.map((c) => {
        const cJobs = filteredJobs.filter((j) => j && j.campanaId === c.id);
        const cIncs = filteredIncomes.filter((i) => i && i.campanaId === c.id);
        const cExps = filteredExpenses.filter((e) => e && e.campanaId === c.id);

        const ext = cJobs
          .filter((j) => j && j.tipoTrabajo === 'tercero')
          .reduce((s, j) => s + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc), 0);
        const crop = cIncs
          .filter((i) => i && i.modulo === 'propiedad' && !i.esTrabajoPropio)
          .reduce((s, i) => s + toViewCurrency(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc), 0);
        const expDir = cExps
          .filter((e) => e && !e.esTrabajoPropio)
          .reduce((s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc), 0);
        const maqInt = cExps
          .filter((e) => e && e.esTrabajoPropio)
          .reduce((s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc), 0);
        const net = ext + crop - (expDir + maqInt);

        return [
          c.nombre || 'Sin nombre',
          c.activa ? 'Activa' : 'Cerrada',
          (ext + crop).toFixed(2),
          expDir.toFixed(2),
          maqInt.toFixed(2),
          net.toFixed(2),
        ];
      }),
    ];
    handleExportCSV('campanas', rows);
  };

  // --------------------------------------------------------------------------
  // TOP BAR FOR SUB-REPORTS
  // --------------------------------------------------------------------------
  const renderSubReportHeader = (
    title: string,
    onBack: () => void,
    onExportCSV: () => void,
    subtitle?: string
  ) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="no-print inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 hover:bg-slate-50 transition cursor-pointer min-h-[44px] shadow-xs active:scale-95"
        >
          <ArrowLeft className="h-4 w-4 text-emerald-700 shrink-0" />
          <span>Volver a Reportes</span>
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {title}
            </h1>
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0">
              Gestión {selectedGestion}
            </span>
          </div>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>

      <div className="no-print flex items-center gap-2 self-start sm:self-center">
        {/* Active Currency Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
          <span className="text-slate-400 font-normal">Moneda:</span>
          <span className="font-mono text-emerald-800 font-extrabold">
            {activeCurrency === 'BOB' ? 'Bs (BOB)' : 'USD ($)'}
          </span>
        </div>

        <button
          type="button"
          onClick={onExportCSV}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer min-h-[44px]"
          title="Descargar este reporte en archivo CSV"
        >
          <Download className="h-4 w-4 text-slate-600" />
          <span>CSV</span>
        </button>

        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition cursor-pointer min-h-[44px] shadow-xs"
          title="Imprimir o guardar en PDF este reporte"
        >
          <Printer className="h-4 w-4 text-emerald-400" />
          <span>Imprimir</span>
        </button>
      </div>
    </div>
  );

  const hasNoDataInGestion =
    filteredJobs.length === 0 &&
    filteredExpenses.length === 0 &&
    filteredIncomes.length === 0;

  // ==========================================================================
  // SCREEN 1: MENU PRINCIPAL DE REPORTES
  // ==========================================================================
  if (currentScreen === 'menu') {
    return (
      <div className="space-y-6 max-w-2xl mx-auto w-full">
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { background: white !important; }
          }
        `}</style>

        {/* Header Title */}
        <div className="border-b border-slate-200 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-xs">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Reportes
              </h1>
              <p className="text-xs text-slate-500">
                Consulta los resultados financieros y operativos por área
              </p>
            </div>
          </div>
        </div>

        {/* Top Control: Selector de Gestión Únicamente (Sección 2) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Gestión Agrícola
            </label>
            <div className="relative">
              <select
                value={selectedGestion}
                onChange={(e) => setSelectedGestion(e.target.value)}
                className="w-full appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-900 text-sm font-bold rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-600 transition cursor-pointer min-h-[48px]"
              >
                {availableGestiones.map((gest) => {
                  const isAct = gest === defaultActiveGestion;
                  return (
                    <option key={gest} value={gest}>
                      Gestión {gest} {isAct ? '— Activa' : ''}
                    </option>
                  );
                })}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-500">
                <Calendar className="h-4 w-4 text-emerald-700" />
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 pt-1">
            Los datos de cada reporte se calculan automáticamente para la{' '}
            <strong>Gestión {selectedGestion}</strong>. Usa el switch <strong>Bs / USD</strong> en la barra superior para cambiar la moneda.
          </p>
        </div>

        {/* Las 5 Opciones Principales de Reportes */}
        <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setCurrentScreen('resumen')}
            className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer text-left group min-h-[76px]"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 group-hover:bg-emerald-700 group-hover:text-white transition shadow-xs">
                <DollarSign className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-emerald-800 transition">
                  Resumen general
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cuánto ingresó, cuánto se gastó y cuánto quedó.
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-emerald-700 transition shrink-0 ml-2" />
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedMachineId(null);
              setCurrentScreen('maquinarias');
            }}
            className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer text-left group min-h-[76px]"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-800 group-hover:bg-sky-700 group-hover:text-white transition shadow-xs">
                <Tractor className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-sky-800 transition">
                  Maquinarias
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Servicios, gastos, trabajos realizados y resultados.
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-sky-700 transition shrink-0 ml-2" />
          </button>

          <button
            type="button"
            onClick={() => setCurrentScreen('propiedad')}
            className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer text-left group min-h-[76px]"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-900 group-hover:bg-emerald-800 group-hover:text-white transition shadow-xs">
                <Trees className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-emerald-900 transition">
                  Propiedad
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ingresos agrícolas, gastos y resultado.
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-emerald-800 transition shrink-0 ml-2" />
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedLotId(null);
              setCurrentScreen('lotes');
            }}
            className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer text-left group min-h-[76px]"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-100 text-purple-800 group-hover:bg-purple-700 group-hover:text-white transition shadow-xs">
                <Layers className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-purple-800 transition">
                  Por lote
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ingresos, gastos y resultado de cada lote.
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-purple-700 transition shrink-0 ml-2" />
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedCampaignDetailId(null);
              setCurrentScreen('campanas');
            }}
            className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer text-left group min-h-[76px]"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 group-hover:bg-amber-700 group-hover:text-white transition shadow-xs">
                <Calendar className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-amber-800 transition">
                  Por campaña
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Resultados de cada campaña agrícola.
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-amber-700 transition shrink-0 ml-2" />
          </button>
        </div>

        {/* Vistazo Rápido o Estado Vacío */}
        {hasNoDataInGestion ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center space-y-2 shadow-xs">
            <Info className="h-6 w-6 text-slate-400 mx-auto" />
            <p className="text-xs font-bold text-slate-800">
              No hay movimientos registrados en esta gestión ({selectedGestion})
            </p>
            <p className="text-[11px] text-slate-500">
              Puedes seleccionar otra gestión en el menú desplegable superior.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Vistazo Rápido &bull; Gestión {selectedGestion}
              </span>
              <span className="text-xs font-mono font-semibold text-slate-500">
                {activeCurrency}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
              <div className="p-2 sm:p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
                <span className="text-[10px] sm:text-xs font-semibold text-emerald-800 block">
                  Ingresos Reales
                </span>
                <p className="text-sm sm:text-base font-bold text-emerald-950 font-mono mt-0.5 truncate">
                  {formatMoney(consolidatedIncomes)}
                </p>
              </div>
              <div className="p-2 sm:p-3 rounded-xl bg-red-50/70 border border-red-100">
                <span className="text-[10px] sm:text-xs font-semibold text-red-800 block">
                  Gastos Reales
                </span>
                <p className="text-sm sm:text-base font-bold text-red-950 font-mono mt-0.5 truncate">
                  {formatMoney(consolidatedExpenses)}
                </p>
              </div>
              <div className="p-2 sm:p-3 rounded-xl bg-slate-900 text-white shadow-xs">
                <span className="text-[10px] sm:text-xs font-semibold text-emerald-400 block">
                  Resultado
                </span>
                <p className="text-sm sm:text-base font-bold text-white font-mono mt-0.5 truncate">
                  {formatMoney(consolidatedProfit)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================================================
  // SCREEN 2: REPORTE RESUMEN GENERAL
  // ==========================================================================
  if (currentScreen === 'resumen') {
    return (
      <div className="space-y-6 max-w-3xl mx-auto w-full">
        {renderSubReportHeader(
          'Resumen general',
          () => setCurrentScreen('menu'),
          exportResumenCSV,
          'Cuánto ingresó, cuánto se gastó y cuánto quedó'
        )}

        {hasNoDataInGestion && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-amber-700" />
            <span>No hay movimientos registrados en la Gestión {selectedGestion}.</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 shadow-xs">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
              Ingresos
            </span>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-950 font-mono mt-1 break-words">
              {formatMoney(consolidatedIncomes)}
            </p>
            <p className="text-[11px] text-emerald-800 mt-2 pt-2 border-t border-emerald-200/70 leading-relaxed">
              Todo el dinero real ingresado desde clientes externos y venta de cosechas.
            </p>
          </div>

          <div className="rounded-2xl border border-red-200 bg-red-50/80 p-5 shadow-xs">
            <span className="text-xs font-bold text-red-800 uppercase tracking-wider block">
              Gastos
            </span>
            <p className="text-2xl sm:text-3xl font-extrabold text-red-950 font-mono mt-1 break-words">
              {formatMoney(consolidatedExpenses)}
            </p>
            <p className="text-[11px] text-red-800 mt-2 pt-2 border-t border-red-200/70 leading-relaxed">
              Todos los gastos reales registrados en Maquinarias y Propiedad.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-300 bg-slate-900 text-white p-5 shadow-md">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
              Resultado
            </span>
            <p
              className={`text-2xl sm:text-3xl font-extrabold font-mono mt-1 break-words ${
                consolidatedProfit >= 0 ? 'text-white' : 'text-red-400'
              }`}
            >
              {formatMoney(consolidatedProfit)}
            </p>
            <p className="text-[11px] text-slate-300 mt-2 pt-2 border-t border-slate-800 leading-relaxed">
              Ingresos reales menos gastos reales de la gestión.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
            Detalle de Ingresos y Gastos
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-900">
                  Ingresos por servicios a terceros
                </p>
                <p className="text-[11px] text-slate-500">
                  Trabajos realizados para clientes externos con maquinaria
                </p>
              </div>
              <span className="text-sm sm:text-base font-bold font-mono text-emerald-800">
                {formatMoney(extJobIncomes)}
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-900">
                  Ingresos por venta de cosechas
                </p>
                <p className="text-[11px] text-slate-500">
                  Ventas de granos y productos agrícolas cosechados
                </p>
              </div>
              <span className="text-sm sm:text-base font-bold font-mono text-emerald-800">
                {formatMoney(cropIncomes)}
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-900">
                  Gastos de Maquinarias
                </p>
                <p className="text-[11px] text-slate-500">
                  Diésel, filtros, repuestos, aceites y mantenimiento de máquinas
                </p>
              </div>
              <span className="text-sm sm:text-base font-bold font-mono text-red-700">
                {formatMoney(maqDirectExps)}
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-900">
                  Gastos directos de Propiedad
                </p>
                <p className="text-[11px] text-slate-500">
                  Semillas, fertilizantes, productos químicos y agroinsumos
                </p>
              </div>
              <span className="text-sm sm:text-base font-bold font-mono text-red-700">
                {formatMoney(propDirectExps)}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-1">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-amber-800 shrink-0" />
              <p className="text-xs font-bold text-amber-950">
                Trabajos de maquinaria propia en la propiedad
              </p>
            </div>
            <p className="text-xs text-amber-900 leading-relaxed">
              Los trabajos realizados por la maquinaria propia en los lotes de la propiedad sumaron{' '}
              <strong className="font-mono">{formatMoney(intJobIncomes)}</strong>. Estos costos
              internos se asignan a los lotes para conocer su costo agrícola real, pero{' '}
              <strong>no se suman como ingresos ni como gastos externos</strong> en este Resumen
              General para no alterar la caja real.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // SCREEN 3: REPORTE MAQUINARIAS
  // ==========================================================================
  if (currentScreen === 'maquinarias') {
    if (selectedMachineId) {
      const machine = safeMachines.find((m) => m && m.id === selectedMachineId);
      const mJobs = filteredJobs.filter((j) => j && j.maquinariaId === selectedMachineId);
      const mExps = filteredExpenses.filter((e) => e && e.maquinariaId === selectedMachineId);

      const mHrs = mJobs
        .filter((j) => j && (j.unidad === 'hora' || (j.unidad as string) === 'h'))
        .reduce((s, j) => s + (Number(j.cantidad) || 0), 0);

      const mHa = mJobs
        .filter((j) => j && (j.unidad === 'hectarea' || (j.unidad as string) === 'ha'))
        .reduce((s, j) => s + (Number(j.cantidad) || 0), 0);

      const mIncTerceros = mJobs
        .filter((j) => j && j.tipoTrabajo === 'tercero')
        .reduce(
          (s, j) => s + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
          0
        );

      const mIncPropiedad = mJobs
        .filter((j) => j && j.tipoTrabajo === 'propiedad')
        .reduce(
          (s, j) => s + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
          0
        );

      const mExpDirect = mExps.reduce(
        (s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
        0
      );

      const mResultado = mIncTerceros + mIncPropiedad - mExpDirect;

      const jobsByLaborMap = new Map<
        string,
        {
          nombre: string;
          count: number;
          ha: number;
          hrs: number;
          total: number;
        }
      >();

      mJobs.forEach((j) => {
        if (!j) return;
        const obsStr = String(j.observacion ?? '');
        const trabajoNombreStr = j.trabajoNombre ? String(j.trabajoNombre) : null;
        const laborName =
          trabajoNombreStr ||
          (obsStr.includes('[Trabajo:')
            ? obsStr.match(/\[Trabajo:\s*([^\]]+)\]/)?.[1]
            : null) ||
          'Labor estándar';

        const existing = jobsByLaborMap.get(laborName) || {
          nombre: laborName,
          count: 0,
          ha: 0,
          hrs: 0,
          total: 0,
        };

        existing.count += 1;
        if (j.unidad === 'hectarea' || (j.unidad as string) === 'ha') {
          existing.ha += Number(j.cantidad) || 0;
        } else if (j.unidad === 'hora' || (j.unidad as string) === 'h') {
          existing.hrs += Number(j.cantidad) || 0;
        }
        existing.total += toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc);
        jobsByLaborMap.set(laborName, existing);
      });

      const jobsByLabor = Array.from(jobsByLaborMap.values());

      return (
        <div className="space-y-6 max-w-3xl mx-auto w-full">
          {renderSubReportHeader(
            machine?.nombre || 'Reporte de Máquina',
            () => setSelectedMachineId(null),
            exportMaquinariasCSV,
            `Detalle operativo de ${machine?.tipo || 'Maquinaria'} en Gestión ${selectedGestion}`
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Trabajos para Terceros
              </span>
              <p className="text-xl font-bold font-mono text-emerald-800 mt-1">
                {formatMoney(mIncTerceros)}
              </p>
              <span className="text-[10px] text-slate-400">
                {mJobs.filter((j) => j && j.tipoTrabajo === 'tercero').length} servicios cobrados
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Trabajo en Propiedad
              </span>
              <p className="text-xl font-bold font-mono text-emerald-900 mt-1">
                {formatMoney(mIncPropiedad)}
              </p>
              <span className="text-[10px] text-slate-400">
                {mJobs.filter((j) => j && j.tipoTrabajo === 'propiedad').length} labores internas
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Gastos Directos
              </span>
              <p className="text-xl font-bold font-mono text-red-700 mt-1">
                {formatMoney(mExpDirect)}
              </p>
              <span className="text-[10px] text-slate-400">{mExps.length} gastos cargados</span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Hectáreas
              </span>
              <p className="text-xl font-bold font-mono text-slate-900 mt-1">
                {mHa.toFixed(1)} ha
              </p>
              <span className="text-[10px] text-slate-400">Superficie trabajada</span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Horas
              </span>
              <p className="text-xl font-bold font-mono text-slate-900 mt-1">
                {mHrs.toFixed(1)} horas
              </p>
              <span className="text-[10px] text-slate-400">Tiempo de labor</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-xs">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                Resultado Neto
              </span>
              <p
                className={`text-xl font-bold font-mono mt-1 ${
                  mResultado >= 0 ? 'text-emerald-300' : 'text-red-400'
                }`}
              >
                {formatMoney(mResultado)}
              </p>
              <span className="text-[10px] text-slate-400">Ingresos menos gastos</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
              Trabajos por Implemento o Tipo de Labor ({jobsByLabor.length})
            </h3>

            {jobsByLabor.length > 0 ? (
              <div className="space-y-2.5">
                {jobsByLabor.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{item.nombre}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.count} trabajos realizados &bull;{' '}
                        {item.ha > 0 && <span>{item.ha.toFixed(1)} ha </span>}
                        {item.ha > 0 && item.hrs > 0 && <span>&bull; </span>}
                        {item.hrs > 0 && <span>{item.hrs.toFixed(1)} horas</span>}
                      </p>
                    </div>
                    <div className="text-right sm:self-center">
                      <span className="text-sm font-bold font-mono text-emerald-800">
                        {formatMoney(item.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">
                No hay labores registradas para esta máquina en la Gestión {selectedGestion}.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
              Historial de Servicios en Gestión {selectedGestion} ({mJobs.length})
            </h3>

            {mJobs.length > 0 ? (
              <div className="space-y-2">
                {mJobs.map((j) => (
                  <div
                    key={j.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{j.fecha}</span>
                        <span className="text-slate-400">&bull;</span>
                        <span className="font-bold text-slate-900">
                          {j.tipoTrabajo === 'tercero'
                            ? `Cliente: ${j.cliente || 'Tercero'}`
                            : `Lote: ${j.loteNombre || 'Propiedad'}`}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        {j.trabajoNombre || 'Servicio'} &bull; {j.cantidad}{' '}
                        {j.unidad === 'hora' || (j.unidad as string) === 'h' ? 'horas' : 'ha'}{' '}
                        &times; {formatOriginal(j.tarifa, j.moneda)}/{j.unidad}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-900 text-xs">
                        {formatOriginal(j.total, j.moneda)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">
                Sin registros de servicios en este período.
              </p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 max-w-3xl mx-auto w-full">
        {renderSubReportHeader(
          'Maquinarias',
          () => setCurrentScreen('menu'),
          exportMaquinariasCSV,
          'Servicios, gastos, trabajos realizados y resultados'
        )}

        {hasNoDataInGestion && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-amber-700" />
            <span>No hay trabajos ni gastos de maquinaria en la Gestión {selectedGestion}.</span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Servicios a Terceros
            </span>
            <p className="text-xl sm:text-2xl font-bold font-mono text-emerald-800 mt-1">
              {formatMoney(extJobIncomes)}
            </p>
            <span className="text-[10px] text-slate-400">Ingresos externos reales</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Gastos de Maquinaria
            </span>
            <p className="text-xl sm:text-2xl font-bold font-mono text-red-700 mt-1">
              {formatMoney(maqDirectExps)}
            </p>
            <span className="text-[10px] text-slate-400">Diésel, filtros y repuestos</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-xs">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
              Resultado Maquinarias
            </span>
            <p className="text-xl sm:text-2xl font-bold font-mono text-white mt-1">
              {formatMoney(extJobIncomes + intJobIncomes - maqDirectExps)}
            </p>
            <span className="text-[10px] text-slate-400">Incluye valor de labores propias</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Trabajos Realizados
            </span>
            <p className="text-xl sm:text-2xl font-bold font-mono text-slate-900 mt-1">
              {filteredJobs.length}
            </p>
            <span className="text-[10px] text-slate-400">Servicios totales</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Hectáreas
            </span>
            <p className="text-xl sm:text-2xl font-bold font-mono text-emerald-900 mt-1">
              {totalHectareasMaq.toFixed(1)} ha
            </p>
            <span className="text-[10px] text-slate-400">Superficie trabajada</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Horas
            </span>
            <p className="text-xl sm:text-2xl font-bold font-mono text-sky-900 mt-1">
              {totalHorasMaq.toFixed(1)} horas
            </p>
            <span className="text-[10px] text-slate-400">Tiempo trabajado</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Máquinas Registradas ({safeMachines.length})
            </h3>
            <span className="text-[11px] text-slate-500">
              Toca una máquina para ver su reporte individual
            </span>
          </div>

          <div className="space-y-3">
            {safeMachines.map((m) => {
              const mJobs = filteredJobs.filter((j) => j && j.maquinariaId === m.id);
              const mExps = filteredExpenses.filter((e) => e && e.maquinariaId === m.id);

              const hrs = mJobs
                .filter((j) => j && (j.unidad === 'hora' || (j.unidad as string) === 'h'))
                .reduce((s, j) => s + (Number(j.cantidad) || 0), 0);
              const ha = mJobs
                .filter((j) => j && (j.unidad === 'hectarea' || (j.unidad as string) === 'ha'))
                .reduce((s, j) => s + (Number(j.cantidad) || 0), 0);

              const incExt = mJobs
                .filter((j) => j && j.tipoTrabajo === 'tercero')
                .reduce(
                  (s, j) => s + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
                  0
                );
              const incProp = mJobs
                .filter((j) => j && j.tipoTrabajo === 'propiedad')
                .reduce(
                  (s, j) => s + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
                  0
                );
              const exp = mExps.reduce(
                (s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
                0
              );
              const net = incExt + incProp - exp;

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMachineId(m.id)}
                  className="w-full text-left p-4 rounded-xl bg-slate-50 hover:bg-slate-100/80 active:bg-slate-200/70 border border-slate-200 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-800 group-hover:bg-sky-700 group-hover:text-white transition">
                      <Tractor className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-sky-800 transition truncate">
                        {m.nombre || 'Sin nombre'}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {m.tipo || 'Maquinaria'} &bull; {mJobs.length} trabajos &bull;{' '}
                        {ha > 0 && <span>{ha.toFixed(1)} ha </span>}
                        {ha > 0 && hrs > 0 && <span>&bull; </span>}
                        {hrs > 0 && <span>{hrs.toFixed(1)} horas</span>}
                        {ha === 0 && hrs === 0 && <span>0 horas / ha</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-400 block sm:inline mr-1">
                        Resultado:
                      </span>
                      <span
                        className={`text-sm font-bold font-mono ${
                          net >= 0 ? 'text-emerald-800' : 'text-red-700'
                        }`}
                      >
                        {formatMoney(net)}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-sky-700 group-hover:translate-x-0.5 transition flex items-center">
                      Ver reporte &gt;
                    </span>
                  </div>
                </button>
              );
            })}

            {safeMachines.length === 0 && (
              <p className="text-xs text-slate-400 py-6 text-center">
                No hay máquinas registradas en el sistema.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // SCREEN 4: REPORTE PROPIEDAD
  // ==========================================================================
  if (currentScreen === 'propiedad') {
    const propResultadoAgricola = cropIncomes - propDirectExps - propMaqServiceExps;

    return (
      <div className="space-y-6 max-w-3xl mx-auto w-full">
        {renderSubReportHeader(
          'Propiedad',
          () => setCurrentScreen('menu'),
          exportPropiedadCSV,
          'Ingresos agrícolas, gastos y resultado'
        )}

        {hasNoDataInGestion && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-amber-700" />
            <span>No hay movimientos agrícolas registrados en la Gestión {selectedGestion}.</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 shadow-xs">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
              Ingresos Agrícolas
            </span>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-950 font-mono mt-1 break-words">
              {formatMoney(cropIncomes)}
            </p>
            <p className="text-[11px] text-emerald-800 mt-2 pt-2 border-t border-emerald-200/70 leading-relaxed">
              Dinero recibido por ventas de cosechas y otros ingresos agrícolas reales.
            </p>
          </div>

          <div className="rounded-2xl border border-red-200 bg-red-50/80 p-5 shadow-xs">
            <span className="text-xs font-bold text-red-800 uppercase tracking-wider block">
              Gastos Directos
            </span>
            <p className="text-2xl sm:text-3xl font-extrabold text-red-950 font-mono mt-1 break-words">
              {formatMoney(propDirectExps)}
            </p>
            <p className="text-[11px] text-red-800 mt-2 pt-2 border-t border-red-200/70 leading-relaxed">
              Semillas, fertilizantes, productos químicos, insumos y gastos directos.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 shadow-xs">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block">
              Trabajos de Maquinaria Propia
            </span>
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-950 font-mono mt-1 break-words">
              {formatMoney(propMaqServiceExps)}
            </p>
            <p className="text-[11px] text-amber-800 mt-2 pt-2 border-t border-amber-200/70 leading-relaxed">
              Costo asignado a los lotes por trabajos internos realizados por maquinaria propia.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-300 bg-slate-900 text-white p-5 shadow-md">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
              Resultado Agrícola
            </span>
            <p
              className={`text-2xl sm:text-3xl font-extrabold font-mono mt-1 break-words ${
                propResultadoAgricola >= 0 ? 'text-white' : 'text-red-400'
              }`}
            >
              {formatMoney(propResultadoAgricola)}
            </p>
            <p className="text-[11px] text-slate-300 mt-2 pt-2 border-t border-slate-800 leading-relaxed">
              Ingresos agrícolas menos gastos directos y costos internos de maquinaria.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-emerald-700 shrink-0" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Explicación del Resultado Agrícola
            </h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            El costo de los trabajos de maquinaria propia ({formatMoney(propMaqServiceExps)}) se
            incluye aquí para conocer la rentabilidad neta real de los cultivos y lotes. Sin
            embargo, en el <strong>Resumen General</strong> consolidado no se duplica como gasto
            externo, ya que no representa una salida de dinero fuera de la operación.
          </p>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // SCREEN 5: REPORTE POR LOTE
  // ==========================================================================
  if (currentScreen === 'lotes') {
    if (selectedLotId) {
      const lot = safeLots.find((l) => l && l.id === selectedLotId);
      const isUnassigned = selectedLotId === 'unassigned';

      const lJobs = isUnassigned
        ? filteredJobs.filter((j) => j && !j.loteId && j.tipoTrabajo === 'propiedad')
        : filteredJobs.filter((j) => j && j.loteId === selectedLotId);

      const lIncs = isUnassigned
        ? filteredIncomes.filter((i) => i && !i.loteId)
        : filteredIncomes.filter((i) => i && i.loteId === selectedLotId);

      const lExpDir = (
        isUnassigned
          ? filteredExpenses.filter((e) => e && !e.loteId && !e.esTrabajoPropio)
          : filteredExpenses.filter((e) => e && e.loteId === selectedLotId && !e.esTrabajoPropio)
      ).reduce((s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc), 0);

      const lExpMaq = (
        isUnassigned
          ? filteredExpenses.filter((e) => e && !e.loteId && e.esTrabajoPropio)
          : filteredExpenses.filter((e) => e && e.loteId === selectedLotId && e.esTrabajoPropio)
      ).reduce((s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc), 0);

      const lTotalIncs = lIncs.reduce(
        (s, i) => s + toViewCurrency(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc),
        0
      );

      const lNet = lTotalIncs - (lExpDir + lExpMaq);

      return (
        <div className="space-y-6 max-w-3xl mx-auto w-full">
          {renderSubReportHeader(
            isUnassigned ? 'Sin lote asignado' : lot?.nombre || 'Reporte del Lote',
            () => setSelectedLotId(null),
            exportLotesCSV,
            isUnassigned
              ? `Movimientos agrícolas sin asignación de lote en Gestión ${selectedGestion}`
              : `Superficie: ${lot?.superficieHectareas || 0} ha · Cultivo: ${
                  lot?.cultivoActual || 'Sin cultivo'
                }`
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Ingresos Cosecha
              </span>
              <p className="text-lg sm:text-xl font-bold font-mono text-emerald-800 mt-1">
                {formatMoney(lTotalIncs)}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Gastos Directos
              </span>
              <p className="text-lg sm:text-xl font-bold font-mono text-red-700 mt-1">
                {formatMoney(lExpDir)}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Maquinaria Propia
              </span>
              <p className="text-lg sm:text-xl font-bold font-mono text-amber-800 mt-1">
                {formatMoney(lExpMaq)}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-xs">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                Resultado Neto
              </span>
              <p
                className={`text-lg sm:text-xl font-bold font-mono mt-1 ${
                  lNet >= 0 ? 'text-white' : 'text-red-400'
                }`}
              >
                {formatMoney(lNet)}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
              Trabajos de Maquinaria Realizados ({lJobs.length})
            </h3>

            {lJobs.length > 0 ? (
              <div className="space-y-2">
                {lJobs.map((j) => (
                  <div
                    key={j.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{j.fecha}</span>
                        <span className="text-slate-400">&bull;</span>
                        <span className="font-bold text-slate-900">
                          {j.maquinariaNombre || 'Maquinaria'}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        {j.trabajoNombre || 'Labor'} &bull; {j.cantidad}{' '}
                        {j.unidad === 'hora' || (j.unidad as string) === 'h' ? 'horas' : 'ha'}{' '}
                        &times; {formatOriginal(j.tarifa, j.moneda)}/{j.unidad}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-900 text-xs">
                        {formatOriginal(j.total, j.moneda)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-3 text-center">
                Sin labores de maquinaria registradas en este lote.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
              Gastos Directos de Insumos (
              {
                (isUnassigned
                  ? filteredExpenses.filter((e) => e && !e.loteId && !e.esTrabajoPropio)
                  : filteredExpenses.filter((e) => e && e.loteId === selectedLotId && !e.esTrabajoPropio)
                ).length
              }
              )
            </h3>

            {(isUnassigned
              ? filteredExpenses.filter((e) => e && !e.loteId && !e.esTrabajoPropio)
              : filteredExpenses.filter((e) => e && e.loteId === selectedLotId && !e.esTrabajoPropio)
            ).length > 0 ? (
              <div className="space-y-2">
                {(isUnassigned
                  ? filteredExpenses.filter((e) => e && !e.loteId && !e.esTrabajoPropio)
                  : filteredExpenses.filter((e) => e && e.loteId === selectedLotId && !e.esTrabajoPropio)
                ).map((e) => (
                  <div
                    key={e.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-800">{e.fecha}</span> &bull;{' '}
                      <span className="font-bold text-slate-900">{e.itemGasto}</span>
                      {e.observacion && (
                        <p className="text-slate-500 text-[11px] mt-0.5">{e.observacion}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-red-700 text-xs">
                        {formatOriginal(e.total, e.moneda)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-3 text-center">
                Sin gastos directos registrados.
              </p>
            )}
          </div>
        </div>
      );
    }

    const unassignedExpenses = filteredExpenses.filter((e) => e && !e.loteId);
    const unassignedIncomes = filteredIncomes.filter((i) => i && !i.loteId);

    return (
      <div className="space-y-6 max-w-3xl mx-auto w-full">
        {renderSubReportHeader(
          'Por lote',
          () => setCurrentScreen('menu'),
          exportLotesCSV,
          'Ingresos, gastos y resultado de cada lote'
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Lotes Agrícolas ({safeLots.length})
            </h3>
            <span className="text-[11px] text-slate-500">
              Toca un lote para ver sus gastos e ingresos detallados
            </span>
          </div>

          <div className="space-y-3">
            {safeLots.map((l) => {
              const lIncs = filteredIncomes
                .filter((i) => i && i.loteId === l.id)
                .reduce(
                  (s, i) => s + toViewCurrency(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc),
                  0
                );
              const lExpDir = filteredExpenses
                .filter((e) => e && e.loteId === l.id && !e.esTrabajoPropio)
                .reduce(
                  (s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
                  0
                );
              const lExpMaq = filteredExpenses
                .filter((e) => e && e.loteId === l.id && e.esTrabajoPropio)
                .reduce(
                  (s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
                  0
                );
              const net = lIncs - (lExpDir + lExpMaq);

              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelectedLotId(l.id)}
                  className="w-full text-left p-4 rounded-xl bg-slate-50 hover:bg-slate-100/80 active:bg-slate-200/70 border border-slate-200 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-800 group-hover:bg-purple-700 group-hover:text-white transition">
                      <Layers className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-purple-800 transition truncate">
                        {l.nombre || 'Sin nombre'}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {l.superficieHectareas || 0} ha &bull; Cultivo:{' '}
                        {l.cultivoActual || 'Sin cultivo'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-400 block sm:inline mr-1">
                        Resultado:
                      </span>
                      <span
                        className={`text-sm font-bold font-mono ${
                          net >= 0 ? 'text-emerald-800' : 'text-red-700'
                        }`}
                      >
                        {formatMoney(net)}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-purple-700 group-hover:translate-x-0.5 transition flex items-center">
                      Ver reporte &gt;
                    </span>
                  </div>
                </button>
              );
            })}

            {(unassignedExpenses.length > 0 || unassignedIncomes.length > 0) && (
              <button
                type="button"
                onClick={() => setSelectedLotId('unassigned')}
                className="w-full text-left p-4 rounded-xl bg-amber-50/70 hover:bg-amber-100/80 border border-amber-200 transition cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-amber-900">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-950">
                      Sin lote asignado
                    </h4>
                    <p className="text-xs text-amber-800">
                      {unassignedExpenses.length} gastos y {unassignedIncomes.length} ingresos sin
                      lote específico
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-amber-900 group-hover:translate-x-0.5 transition">
                  Ver detalle &gt;
                </span>
              </button>
            )}

            {safeLots.length === 0 && (
              <p className="text-xs text-slate-400 py-6 text-center">
                No hay lotes configurados en el sistema.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // SCREEN 6: REPORTE POR CAMPAÑA
  // ==========================================================================
  if (currentScreen === 'campanas') {
    if (selectedCampaignDetailId) {
      const camp = safeCampaigns.find((c) => c && c.id === selectedCampaignDetailId);
      const isUnassignedCamp = selectedCampaignDetailId === 'unassigned';

      const cJobs = isUnassignedCamp
        ? filteredJobs.filter((j) => j && !j.campanaId)
        : filteredJobs.filter((j) => j && j.campanaId === selectedCampaignDetailId);

      const cIncs = isUnassignedCamp
        ? filteredIncomes.filter((i) => i && !i.campanaId)
        : filteredIncomes.filter((i) => i && i.campanaId === selectedCampaignDetailId);

      const cExps = isUnassignedCamp
        ? filteredExpenses.filter((e) => e && !e.campanaId)
        : filteredExpenses.filter((e) => e && e.campanaId === selectedCampaignDetailId);

      const ext = cJobs
        .filter((j) => j && j.tipoTrabajo === 'tercero')
        .reduce(
          (s, j) => s + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
          0
        );

      const crop = cIncs
        .filter((i) => i && i.modulo === 'propiedad' && !i.esTrabajoPropio)
        .reduce(
          (s, i) => s + toViewCurrency(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc),
          0
        );

      const expDir = cExps
        .filter((e) => e && !e.esTrabajoPropio)
        .reduce(
          (s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
          0
        );

      const maqInt = cExps
        .filter((e) => e && e.esTrabajoPropio)
        .reduce(
          (s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
          0
        );

      const campNet = ext + crop - (expDir + maqInt);

      const lotIdsInCamp = new Set<string>();
      cJobs.forEach((j) => j && j.loteId && lotIdsInCamp.add(j.loteId));
      cIncs.forEach((i) => i && i.loteId && lotIdsInCamp.add(i.loteId));
      cExps.forEach((e) => e && e.loteId && lotIdsInCamp.add(e.loteId));
      const associatedLots = safeLots.filter((l) => l && lotIdsInCamp.has(l.id));

      return (
        <div className="space-y-6 max-w-3xl mx-auto w-full">
          {renderSubReportHeader(
            isUnassignedCamp ? 'Sin campaña' : camp?.nombre || 'Reporte de Campaña',
            () => setSelectedCampaignDetailId(null),
            exportCampanasCSV,
            isUnassignedCamp
              ? `Movimientos sin campaña asignada en Gestión ${selectedGestion}`
              : `Estado: ${camp?.activa ? 'Activa' : 'Cerrada'} &bull; Gestión ${selectedGestion}`
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Ingresos
              </span>
              <p className="text-lg sm:text-xl font-bold font-mono text-emerald-800 mt-1">
                {formatMoney(ext + crop)}
              </p>
              <span className="text-[10px] text-slate-400">Terceros + Cosecha</span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Gastos Directos
              </span>
              <p className="text-lg sm:text-xl font-bold font-mono text-red-700 mt-1">
                {formatMoney(expDir)}
              </p>
              <span className="text-[10px] text-slate-400">Insumos y operación</span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Maquinaria Propia
              </span>
              <p className="text-lg sm:text-xl font-bold font-mono text-amber-800 mt-1">
                {formatMoney(maqInt)}
              </p>
              <span className="text-[10px] text-slate-400">Costo interno</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-xs">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                Resultado
              </span>
              <p
                className={`text-lg sm:text-xl font-bold font-mono mt-1 ${
                  campNet >= 0 ? 'text-white' : 'text-red-400'
                }`}
              >
                {formatMoney(campNet)}
              </p>
              <span className="text-[10px] text-slate-400">Neto de campaña</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
              Lotes Asociados a esta Campaña ({associatedLots.length})
            </h3>

            {associatedLots.length > 0 ? (
              <div className="space-y-2">
                {associatedLots.map((l) => (
                  <div
                    key={l.id}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <h4 className="font-bold text-slate-900">{l.nombre || 'Sin nombre'}</h4>
                      <p className="text-slate-500 text-[11px]">
                        {l.superficieHectareas || 0} ha &bull; {l.cultivoActual || 'Sin cultivo'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLotId(l.id);
                        setCurrentScreen('lotes');
                      }}
                      className="text-emerald-700 hover:text-emerald-900 font-semibold text-xs cursor-pointer"
                    >
                      Ver lote &gt;
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-3 text-center">
                No hay lotes con movimientos asociados a esta campaña.
              </p>
            )}
          </div>
        </div>
      );
    }

    const unassignedCampJobs = filteredJobs.filter((j) => j && !j.campanaId);
    const unassignedCampExps = filteredExpenses.filter((e) => e && !e.campanaId);

    return (
      <div className="space-y-6 max-w-3xl mx-auto w-full">
        {renderSubReportHeader(
          'Por campaña',
          () => setCurrentScreen('menu'),
          exportCampanasCSV,
          'Resultados de cada campaña agrícola'
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Campañas de la Gestión {selectedGestion} ({gestionCampaigns.length})
            </h3>
            <span className="text-[11px] text-slate-500">
              Toca una campaña para ver su resultado detallado
            </span>
          </div>

          <div className="space-y-3">
            {gestionCampaigns.map((c) => {
              const cJobs = filteredJobs.filter((j) => j && j.campanaId === c.id);
              const cIncs = filteredIncomes.filter((i) => i && i.campanaId === c.id);
              const cExps = filteredExpenses.filter((e) => e && e.campanaId === c.id);

              const ext = cJobs
                .filter((j) => j && j.tipoTrabajo === 'tercero')
                .reduce(
                  (s, j) => s + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
                  0
                );
              const crop = cIncs
                .filter((i) => i && i.modulo === 'propiedad' && !i.esTrabajoPropio)
                .reduce(
                  (s, i) => s + toViewCurrency(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc),
                  0
                );
              const expDir = cExps
                .filter((e) => e && !e.esTrabajoPropio)
                .reduce(
                  (s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
                  0
                );
              const maqInt = cExps
                .filter((e) => e && e.esTrabajoPropio)
                .reduce(
                  (s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
                  0
                );
              const net = ext + crop - (expDir + maqInt);

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCampaignDetailId(c.id)}
                  className="w-full text-left p-4 rounded-xl bg-slate-50 hover:bg-slate-100/80 active:bg-slate-200/70 border border-slate-200 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 group-hover:bg-amber-700 group-hover:text-white transition">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-amber-800 transition truncate">
                          {c.nombre || 'Sin nombre'}
                        </h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            c.activa
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {c.activa ? 'Activa' : 'Cerrada'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Ingresos: {formatMoney(ext + crop)} &bull; Gastos: {formatMoney(expDir + maqInt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-400 block sm:inline mr-1">
                        Resultado:
                      </span>
                      <span
                        className={`text-sm font-bold font-mono ${
                          net >= 0 ? 'text-emerald-800' : 'text-red-700'
                        }`}
                      >
                        {formatMoney(net)}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-amber-700 group-hover:translate-x-0.5 transition flex items-center">
                      Ver reporte &gt;
                    </span>
                  </div>
                </button>
              );
            })}

            {(unassignedCampJobs.length > 0 || unassignedCampExps.length > 0) && (
              <button
                type="button"
                onClick={() => setSelectedCampaignDetailId('unassigned')}
                className="w-full text-left p-4 rounded-xl bg-amber-50/70 hover:bg-amber-100/80 border border-amber-200 transition cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-amber-900">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-950">
                      Sin campaña asignada
                    </h4>
                    <p className="text-xs text-amber-800">
                      {unassignedCampJobs.length} trabajos y {unassignedCampExps.length} gastos sin
                      campaña específica
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-amber-900 group-hover:translate-x-0.5 transition">
                  Ver detalle &gt;
                </span>
              </button>
            )}

            {gestionCampaigns.length === 0 && (
              <p className="text-xs text-slate-400 py-6 text-center">
                No se encontraron campañas específicas para la Gestión {selectedGestion}.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

// Export ReportsView wrapped in ReportsErrorBoundary
export const ReportsView: React.FC<Props> = (props) => {
  return (
    <ReportsErrorBoundary>
      <ReportsViewInner {...props} />
    </ReportsErrorBoundary>
  );
};
