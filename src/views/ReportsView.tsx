import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  TrendingUp,
  Printer,
  Tractor,
  Trees,
  Layers,
  Calendar,
  ChevronRight,
  ArrowLeft,
  Info,
  AlertCircle,
  Search,
  CheckCircle2,
  LandPlot,
  X,
  FileSpreadsheet,
  BookOpen,
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
import { VisualIcon } from '../components/VisualIcon';
import { getIconDefinition } from '../services/iconCatalog';

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
  onBack?: () => void;
}

type ReportScreen =
  | 'menu'
  | 'balance_general'
  | 'maquinarias'
  | 'propiedad_menu'
  | 'propiedad_balance'
  | 'lotes'
  | 'lote_detail'
  | 'campanas'
  | 'campana_detail'
  | 'libro_diario';

export interface DetailRecord {
  id: string;
  fecha: string;
  concepto: string;
  entidad?: string; // Lote, cliente o máquina
  maquinaImplemento?: string;
  cantidad?: number;
  unidad?: string;
  tarifa?: number;
  monto: number;
  icono?: string;
}

export interface LibroDiarioState {
  title: string;
  subtitle?: string;
  totalAmount: number;
  records: DetailRecord[];
  returnScreen: ReportScreen;
}

interface TreeNode {
  id: string;
  label: string;
  sublabel?: string;
  type: 'group' | 'subgroup' | 'item' | 'detail';
  amount: number;
  isIncome?: boolean;
  isExpense?: boolean;
  isResult?: boolean;
  isInformative?: boolean;
  icon?: string;
  records?: DetailRecord[];
  children?: TreeNode[];
}

// ============================================================================
// REACT ERROR BOUNDARY
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
    console.error('[Finanzas ErrorBoundary caught an error]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center space-y-3 max-w-xl mx-auto my-6 shadow-xs">
          <div className="flex items-center justify-center gap-3">
            <AlertCircle className="h-6 w-6 text-red-600 shrink-0" />
            <div className="text-left">
              <h3 className="text-sm font-bold text-red-950">
                Ocurrió un inconveniente al cargar Finanzas
              </h3>
              <p className="text-xs text-red-800 mt-0.5 leading-relaxed">
                {this.state.error?.message ||
                  'No se pudo presentar la información financiera correctamente.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-lg transition cursor-pointer"
          >
            Reintentar vista de finanzas
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// MAIN COMPONENT: REPORTS / FINANZAS (COMPACT EXCEL + SEPARATE LIBRO DIARIO)
// ============================================================================
const FinanzasViewInner: React.FC<Props> = ({
  campaigns = [],
  activeCampaign = null,
  machines = [],
  machineJobTypes = [],
  lots = [],
  jobs = [],
  expenses = [],
  incomes = [],
  currency: initialCurrency = 'BOB',
  exchangeRate,
  onBack,
}) => {
  // Defensive array normalization
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
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [selectedCampaignDetailId, setSelectedCampaignDetailId] = useState<string | null>(null);

  // Libro Diario / Detalle Separate Screen State
  const [libroDiarioData, setLibroDiarioData] = useState<LibroDiarioState | null>(null);

  // Selected Campaign in Finanzas
  const defaultCampaignId = useMemo(() => {
    if (activeCampaign?.id) return String(activeCampaign.id);
    const active = safeCampaigns.find((c) => c.activa);
    if (active?.id) return String(active.id);
    if (safeCampaigns[0]?.id) return String(safeCampaigns[0].id);
    return 'default';
  }, [activeCampaign, safeCampaigns]);

  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(defaultCampaignId);
  const [showCampaignDropdown, setShowCampaignDropdown] = useState(false);

  // Currency switcher state inside Finanzas
  const [activeCurrency, setActiveCurrency] = useState<Currency>(initialCurrency || 'BOB');

  // Lot search term
  const [lotSearchTerm, setLotSearchTerm] = useState('');

  // Selected Campaign Object
  const currentCampaign = useMemo(() => {
    return (
      safeCampaigns.find((c) => String(c.id) === String(selectedCampaignId)) ||
      safeCampaigns.find((c) => c.activa) ||
      safeCampaigns[0] || {
        id: 'default',
        nombre: 'Campaña General',
        activa: true,
        estado: 'activa',
      }
    );
  }, [safeCampaigns, selectedCampaignId]);

  // Currency conversion helper
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

  // Helper getters
  const getJobMachineId = (j: MachineryJob): string => {
    return j.maquinariaId || (j as any).maquinaId || '';
  };

  const getJobName = (j: MachineryJob): string => {
    return j.trabajoNombre || (j as any).trabajo || 'Labor de maquinaria';
  };

  const getJobIcon = (j: MachineryJob): string | undefined => {
    return j.trabajoIcono || j.icono || j.maquinariaIcono;
  };

  const getExpenseMachineId = (e: Expense): string => {
    return e.maquinariaId || (e as any).maquinaId || '';
  };

  const getExpenseRubro = (e: Expense): string => {
    return e.itemGasto || (e as any).rubro || (e as any).categoria || 'Gastos operativos';
  };

  const getExpenseDescription = (e: Expense): string => {
    return e.observacion || e.itemGasto || (e as any).concepto || (e as any).descripcion || 'Gasto registrado';
  };

  const getExpenseIcon = (e: Expense): string | undefined => {
    return e.itemIcono || e.icono;
  };

  const getIncomeConcept = (i: Income): string => {
    return i.concepto || (i as any).rubro || 'Ingreso registrado';
  };

  const getIncomeClient = (i: Income): string => {
    return (i as any).cliente || i.observacion || '';
  };

  const getIncomeIcon = (i: Income): string | undefined => {
    return i.icono;
  };

  const getLotSurface = (l: Lot | undefined): number => {
    if (!l) return 0;
    return typeof l.superficieHectareas === 'number'
      ? l.superficieHectareas
      : typeof l.superficie === 'number'
      ? l.superficie
      : 0;
  };

  const getLotCrop = (l: Lot | undefined): string => {
    if (!l) return '';
    return l.cultivoActual || (l as any).cultivo || '';
  };

  const getMachineIcon = (mId: string | undefined): string | undefined => {
    if (!mId) return undefined;
    const found = safeMachines.find((m) => String(m.id) === String(mId));
    return found?.icono || found?.tipo || 'tractor';
  };

  // Match item to campaign
  const matchesCampaign = (
    item: { campanaId?: string; campana?: string; campanaNombre?: string; fecha?: string } | null | undefined,
    targetCamp: Campaign | { id?: string; nombre?: string; fechaInicio?: string; fechaFin?: string }
  ) => {
    if (!item || !targetCamp) return false;
    if (item.campanaId && targetCamp.id && String(item.campanaId) === String(targetCamp.id)) {
      return true;
    }
    const targetName = String(targetCamp.nombre ?? '').trim().toLowerCase();
    const itemCampName = String(item.campana || item.campanaNombre || '').trim().toLowerCase();
    if (itemCampName && targetName && itemCampName === targetName) {
      return true;
    }
    const yearMatch = targetName.match(/\b(20\d{2})\b/);
    if (yearMatch && item.fecha && String(item.fecha).startsWith(yearMatch[1])) {
      return true;
    }
    if (item.fecha && targetCamp.fechaInicio && targetCamp.fechaFin) {
      if (item.fecha >= targetCamp.fechaInicio && item.fecha <= targetCamp.fechaFin) {
        return true;
      }
    }
    return false;
  };

  // Datasets filtered by selected Campaign
  const campaignJobs = useMemo(
    () => safeJobs.filter((j) => matchesCampaign(j, currentCampaign)),
    [safeJobs, currentCampaign]
  );
  const campaignExpenses = useMemo(
    () => safeExpenses.filter((e) => matchesCampaign(e, currentCampaign)),
    [safeExpenses, currentCampaign]
  );
  const campaignIncomes = useMemo(
    () => safeIncomes.filter((i) => matchesCampaign(i, currentCampaign)),
    [safeIncomes, currentCampaign]
  );

  // Helper to identify internal machinery job expenses that should be excluded from direct expenses
  const isInternalMachineryJobExpense = (e: Expense): boolean => {
    if (!e) return false;
    if (e.esTrabajoPropio) return true;
    if (e.trabajoId) return true;
    const item = (e.itemGasto || (e as any).rubro || (e as any).concepto || '').trim();
    const obs = (e.observacion || (e as any).descripcion || '').trim();
    const pattern = /Servicio\s+Maquinaria\s+Propia|Trabajo\s+de\s+Maquinaria|Trabajo\s+en\s+Propiedad|Labores?\s+de\s+Maquinaria|Servicio\s+de\s+Maquinaria/i;
    if (pattern.test(item) || pattern.test(obs)) return true;
    return false;
  };

  const getMachineName = (mId: string | undefined) => {
    if (!mId) return 'Maquinaria general';
    const found = safeMachines.find((m) => String(m.id) === String(mId));
    return found ? found.nombre : `Máquina ${mId}`;
  };

  const getLotName = (lId: string | undefined) => {
    if (!lId) return 'Lote general';
    const found = safeLots.find((l) => String(l.id) === String(lId));
    return found ? found.nombre : `Lote ${lId}`;
  };

  // Concept & Title Shortening Helper
  const formatShortConceptName = (rawName: string | undefined): string => {
    if (!rawName) return '';
    let clean = rawName.trim();
    clean = clean.replace(/^Servicio\s+Maquinaria\s+Propia\s*-\s*/i, '');
    clean = clean.replace(/^Servicio\s+Maquinaria\s+Propia\s*/i, '');
    clean = clean.replace(/^Servicio\s+a\s+terceros\s*-\s*/i, '');
    clean = clean.replace(/^Servicio\s+a\s+terceros\s*/i, '');
    clean = clean.replace(/^Trabajo\s+en\s+propiedad\s*-\s*/i, '');
    clean = clean.replace(/^Trabajo\s+en\s+propiedad\s*/i, '');
    clean = clean.replace(/^Trabajo\s+de\s+maquinaria\s*-\s*/i, '');
    clean = clean.replace(/^Trabajo\s+de\s+maquinaria\s*/i, '');
    clean = clean.replace(/^Labores\s+de\s+maquinaria\s*-\s*/i, '');
    clean = clean.replace(/^Labores\s+de\s+maquinaria\s*/i, '');

    // Strip leading "con " or "con"
    clean = clean.replace(/^con\s+/i, '');

    if (clean.includes('(') && clean.includes(')')) {
      const withoutParens = clean.replace(/\s*\([^)]*\)/g, '').trim();
      if (withoutParens.length > 0) clean = withoutParens;
      else clean = clean.replace(/[()]/g, '').trim();
    }

    if (clean.length > 0) {
      clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    }

    return clean || rawName;
  };

  // Helper to determine if an implement name represents a real separate implement
  const isRealImplement = (cleanImpName: string | undefined, cleanMachineName: string | undefined): boolean => {
    if (!cleanImpName) return false;
    const imp = cleanImpName.trim().toLowerCase();
    const mac = (cleanMachineName || '').trim().toLowerCase();

    if (!imp) return false;
    if (imp === mac) return false;

    const genericPatterns = [
      'labor de maquinaria',
      'trabajo de maquinaria',
      'labores de maquinaria',
      'trabajos de maquinaria',
      'labor',
      'trabajo',
      'maquinaria',
      'sin implemento',
      'servicio',
      'servicio a terceros',
      'trabajo en propiedad',
      'servicio maquinaria propia',
      'maquinaria general',
    ];

    if (genericPatterns.some((p) => imp === p || imp.startsWith('servicio maquinaria') || imp.startsWith('trabajo en propiedad'))) {
      return false;
    }

    return true;
  };

  // Helper to construct machine tree nodes without artificial implement children
  const buildMachineTreeNodes = (
    jobsList: MachineryJob[],
    idPrefix: string,
    entityLabelGetter: (j: MachineryJob) => string
  ): TreeNode[] => {
    const machineMap: Record<
      string,
      {
        machineName: string;
        machineTotal: number;
        realImplements: Record<
          string,
          { impName: string; total: number; jobs: MachineryJob[]; icon?: string }
        >;
        directMachineJobs: MachineryJob[];
      }
    > = {};

    jobsList.forEach((j) => {
      const mId = getJobMachineId(j) || 'sin_maquina';
      const mName = getMachineName(mId);
      const cleanMName = formatShortConceptName(mName);
      const rawImp = j.trabajoNombre || (j as any).trabajo || '';
      const cleanImp = formatShortConceptName(rawImp);

      if (!machineMap[mId]) {
        machineMap[mId] = {
          machineName: mName,
          machineTotal: 0,
          realImplements: {},
          directMachineJobs: [],
        };
      }

      const val = toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc);
      machineMap[mId].machineTotal += val;

      if (isRealImplement(cleanImp, cleanMName)) {
        if (!machineMap[mId].realImplements[cleanImp]) {
          machineMap[mId].realImplements[cleanImp] = {
            impName: cleanImp,
            total: 0,
            jobs: [],
            icon: getJobIcon(j) || getMachineIcon(mId),
          };
        }
        machineMap[mId].realImplements[cleanImp].total += val;
        machineMap[mId].realImplements[cleanImp].jobs.push(j);
      } else {
        machineMap[mId].directMachineJobs.push(j);
      }
    });

    return Object.entries(machineMap).map(([mId, mData]) => {
      const hasRealImplements = Object.keys(mData.realImplements).length > 0;

      if (hasRealImplements) {
        const impNodes: TreeNode[] = Object.entries(mData.realImplements).map(
          ([impKey, impData]) => {
            const records: DetailRecord[] = impData.jobs.map((j, idx) => ({
              id: j.id || `${idPrefix}_imp_job_${idx}`,
              fecha: j.fecha || '',
              concepto: formatShortConceptName(j.trabajoNombre || impData.impName),
              entidad: entityLabelGetter(j),
              maquinaImplemento: mData.machineName,
              cantidad: j.cantidad,
              unidad: j.unidad,
              tarifa: j.tarifa,
              monto: toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
              icono: impData.icon,
            }));

            return {
              id: `${idPrefix}_imp_${mId}_${impKey}`,
              label: impData.impName,
              icon: impData.icon,
              type: 'item',
              amount: impData.total,
              records,
            };
          }
        );

        if (mData.directMachineJobs.length > 0) {
          const directTotal = mData.directMachineJobs.reduce(
            (acc, j) => acc + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
            0
          );
          const directRecords: DetailRecord[] = mData.directMachineJobs.map((j, idx) => ({
            id: j.id || `${idPrefix}_dir_job_${idx}`,
            fecha: j.fecha || '',
            concepto: formatShortConceptName(j.trabajoNombre || mData.machineName),
            entidad: entityLabelGetter(j),
            maquinaImplemento: mData.machineName,
            cantidad: j.cantidad,
            unidad: j.unidad,
            tarifa: j.tarifa,
            monto: toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
            icono: getJobIcon(j) || getMachineIcon(mId),
          }));

          impNodes.push({
            id: `${idPrefix}_direct_${mId}`,
            label: mData.machineName,
            icon: getMachineIcon(mId),
            type: 'item',
            amount: directTotal,
            records: directRecords,
          });
        }

        const allMachineRecords: DetailRecord[] = impNodes.flatMap((n) => n.records || []);

        return {
          id: `${idPrefix}_m_${mId}`,
          label: mData.machineName,
          icon: getMachineIcon(mId),
          type: 'subgroup',
          amount: mData.machineTotal,
          children: impNodes,
          records: allMachineRecords,
        };
      } else {
        // NO REAL IMPLEMENTS: Single machine leaf node with no children
        const directRecords: DetailRecord[] = mData.directMachineJobs.map((j, idx) => ({
          id: j.id || `${idPrefix}_dir_job_${idx}`,
          fecha: j.fecha || '',
          concepto: formatShortConceptName(j.trabajoNombre || mData.machineName),
          entidad: entityLabelGetter(j),
          maquinaImplemento: mData.machineName,
          cantidad: j.cantidad,
          unidad: j.unidad,
          tarifa: j.tarifa,
          monto: toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
          icono: getJobIcon(j) || getMachineIcon(mId),
        }));

        return {
          id: `${idPrefix}_m_${mId}`,
          label: mData.machineName,
          icon: getMachineIcon(mId),
          type: 'item',
          amount: mData.machineTotal,
          records: directRecords,
        };
      }
    });
  };

  // Helper to open the new full-screen Libro Diario view
  const openLibroDiario = (rawTitle: string, subtitle: string | undefined, totalAmount: number, records: DetailRecord[]) => {
    if (!records || records.length === 0) return;
    const shortName = formatShortConceptName(rawTitle);
    const displayTitle = shortName.toLowerCase().startsWith('detalle')
      ? shortName
      : `Detalle de ${shortName}`;

    // Sort records chronologically (newest first)
    const sortedRecords = [...records].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    setLibroDiarioData({
      title: displayTitle,
      subtitle,
      totalAmount,
      records: sortedRecords,
      returnScreen: currentScreen,
    });
    setCurrentScreen('libro_diario');
  };

  // Recursively collect all records from a tree node
  const collectNodeRecords = (node: TreeNode): DetailRecord[] => {
    let result: DetailRecord[] = node.records ? [...node.records] : [];
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        result = result.concat(collectNodeRecords(child));
      }
    }
    return result;
  };

  // Excel Export via SheetJS
  const handleExportToExcel = (reportTitle: string, filename: string, tree: TreeNode[]) => {
    const rows: (string | number)[][] = [
      ['MAQUINARIAS Y PROPIEDAD - SISTEMA FINANCIERO'],
      [reportTitle.toUpperCase()],
      [
        `Campaña: ${currentCampaign.nombre || 'Actual'}`,
        `Moneda: ${activeCurrency === 'BOB' ? 'Bolivianos (Bs)' : 'Dólares (USD)'}`,
        `Fecha de Emisión: ${new Date().toISOString().slice(0, 10)}`,
        `T.C. Referencial: ${safeExchangeRate.tasaBobPerUsd || 6.96} BOB/USD`,
      ],
      [],
      [
        'Nivel',
        'Concepto / Categoría',
        'Fecha / Ref',
        'Entidad / Referencia',
        `Importe (${activeCurrency === 'BOB' ? 'Bs' : 'USD'})`,
      ],
    ];

    const traverse = (nodeList: TreeNode[], level = 0) => {
      for (const node of nodeList) {
        const indent = '  '.repeat(level);
        const prefix = level === 0 ? '' : level === 1 ? '• ' : '- ';
        rows.push([
          `Nivel ${level}`,
          `${indent}${prefix}${node.label}`,
          '',
          node.sublabel || '',
          node.amount,
        ]);
        if (node.children && node.children.length > 0) {
          traverse(node.children, level + 1);
        }
      }
    };

    traverse(tree);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    ws['!cols'] = [
      { wch: 10 },
      { wch: 45 },
      { wch: 12 },
      { wch: 28 },
      { wch: 18 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Balance');
    const safeFilename = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(wb, `${safeFilename}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  // ==========================================================================
  // TREE GENERATOR 1: BALANCE GENERAL CONSOLIDADO
  // ==========================================================================
  const balanceGeneralTree = useMemo((): TreeNode[] => {
    // 1. Servicios para otros (Maquinarias)
    const extJobs = campaignJobs.filter((j) => j.tipoTrabajo === 'tercero');
    const extJobsTotal = extJobs.reduce(
      (acc, j) => acc + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
      0
    );

    const extMachineChildren = buildMachineTreeNodes(
      extJobs,
      'bg_ext',
      (j) => (j.cliente ? `Cliente: ${j.cliente}` : 'Servicio a tercero')
    );

    // 2. Trabajos en propiedad (Maquinarias)
    const internalJobs = campaignJobs.filter((j) => j.tipoTrabajo !== 'tercero');
    const internalJobsTotal = internalJobs.reduce(
      (acc, j) => acc + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
      0
    );

    const propMachineTreeNodes = buildMachineTreeNodes(
      internalJobs,
      'bg_prop',
      (j) => getLotName(j.loteId)
    );

    // 3. Ventas de cosecha (Propiedad)
    const cropIncomes = campaignIncomes.filter(
      (i) => i.modulo === 'propiedad' && !i.esTrabajoPropio
    );
    const cropIncomesTotal = cropIncomes.reduce(
      (acc, i) => acc + toViewCurrency(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc),
      0
    );

    const cropByLot: Record<string, { total: number; items: Income[] }> = {};
    cropIncomes.forEach((i) => {
      const lId = i.loteId || 'sin_lote';
      if (!cropByLot[lId]) cropByLot[lId] = { total: 0, items: [] };
      const val = toViewCurrency(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc);
      cropByLot[lId].total += val;
      cropByLot[lId].items.push(i);
    });

    const cropLotChildren: TreeNode[] = Object.entries(cropByLot).map(([lId, data]) => {
      const records: DetailRecord[] = data.items.map((i, idx) => {
        const client = getIncomeClient(i);
        return {
          id: i.id || `crop_inc_${idx}`,
          fecha: i.fecha || '',
          concepto: formatShortConceptName(getIncomeConcept(i)),
          entidad: client ? `Comprador: ${client}` : getLotName(lId),
          cantidad: i.cantidad,
          unidad: i.unidad,
          tarifa: i.precio,
          monto: toViewCurrency(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc),
          icono: getIncomeIcon(i) || 'granos',
        };
      });

      return {
        id: `bg_ing_crop_${lId}`,
        label: getLotName(lId),
        icon: 'terreno',
        type: 'item',
        amount: data.total,
        records,
      };
    });

    const totalConsolidatedIncome = extJobsTotal + internalJobsTotal + cropIncomesTotal;

    // 4. Gastos directos de Maquinarias
    const directMachExpenses = campaignExpenses.filter((e) => e.modulo === 'maquinarias');
    const directMachTotal = directMachExpenses.reduce(
      (acc, e) => acc + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
      0
    );

    const machExpByRubro: Record<string, { total: number; items: Expense[] }> = {};
    directMachExpenses.forEach((e) => {
      const rubro = getExpenseRubro(e);
      if (!machExpByRubro[rubro]) machExpByRubro[rubro] = { total: 0, items: [] };
      const val = toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc);
      machExpByRubro[rubro].total += val;
      machExpByRubro[rubro].items.push(e);
    });

    const machExpChildren: TreeNode[] = Object.entries(machExpByRubro).map(([rubro, data]) => {
      const records: DetailRecord[] = data.items.map((e, idx) => ({
        id: e.id || `mach_exp_${idx}`,
        fecha: e.fecha || '',
        concepto: formatShortConceptName(getExpenseDescription(e)),
        entidad: getMachineName(getExpenseMachineId(e)),
        cantidad: e.cantidad,
        unidad: e.unidad,
        tarifa: e.precio,
        monto: toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
        icono: getExpenseIcon(e) || getIconDefinition(rubro, 'gasto').id,
      }));

      return {
        id: `bg_exp_mach_${rubro}`,
        label: rubro,
        icon: getIconDefinition(rubro, 'gasto').id || 'diesel',
        type: 'item',
        amount: data.total,
        records,
      };
    });

    // 5. Gastos directos de Propiedad
    const directPropExpenses = campaignExpenses.filter(
      (e) => e.modulo === 'propiedad' && !isInternalMachineryJobExpense(e)
    );
    const directPropTotal = directPropExpenses.reduce(
      (acc, e) => acc + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
      0
    );

    const propExpByRubro: Record<string, { total: number; items: Expense[] }> = {};
    directPropExpenses.forEach((e) => {
      const rubro = getExpenseRubro(e);
      if (!propExpByRubro[rubro]) propExpByRubro[rubro] = { total: 0, items: [] };
      const val = toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc);
      propExpByRubro[rubro].total += val;
      propExpByRubro[rubro].items.push(e);
    });

    const propExpChildren: TreeNode[] = Object.entries(propExpByRubro).map(([rubro, data]) => {
      const records: DetailRecord[] = data.items.map((e, idx) => ({
        id: e.id || `prop_exp_${idx}`,
        fecha: e.fecha || '',
        concepto: formatShortConceptName(getExpenseDescription(e)),
        entidad: getLotName(e.loteId),
        cantidad: e.cantidad,
        unidad: e.unidad,
        tarifa: e.precio,
        monto: toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
        icono: getExpenseIcon(e) || getIconDefinition(rubro, 'gasto').id,
      }));

      return {
        id: `bg_exp_prop_${rubro}`,
        label: rubro,
        icon: getIconDefinition(rubro, 'gasto').id || 'insumo',
        type: 'item',
        amount: data.total,
        records,
      };
    });

    // 6. Trabajos de maquinaria (Propiedad)
    const internalByLot: Record<string, { total: number; jobs: MachineryJob[] }> = {};
    internalJobs.forEach((j) => {
      const lId = j.loteId || 'sin_lote';
      if (!internalByLot[lId]) internalByLot[lId] = { total: 0, jobs: [] };
      const val = toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc);
      internalByLot[lId].total += val;
      internalByLot[lId].jobs.push(j);
    });

    const internalLotChildren: TreeNode[] = Object.entries(internalByLot).map(
      ([lId, data]) => {
        const records: DetailRecord[] = data.jobs.map((j, idx) => ({
          id: j.id || `bg_rec_job_${idx}`,
          fecha: j.fecha || '',
          concepto: formatShortConceptName(getJobName(j)),
          entidad: getLotName(lId),
          maquinaImplemento: getMachineName(getJobMachineId(j)),
          cantidad: j.cantidad,
          unidad: j.unidad,
          tarifa: j.tarifa,
          monto: toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
          icono: getJobIcon(j) || 'tractor',
        }));

        return {
          id: `bg_exp_jobs_${lId}`,
          label: getLotName(lId),
          icon: 'terreno',
          type: 'item',
          amount: data.total,
          records,
        };
      }
    );

    const totalConsolidatedExpense = directMachTotal + directPropTotal + internalJobsTotal;
    const consolidatedResult = totalConsolidatedIncome - totalConsolidatedExpense;

    return [
      {
        id: 'bg_ingresos',
        label: 'INGRESOS CONSOLIDADOS',
        type: 'group',
        amount: totalConsolidatedIncome,
        isIncome: true,
        children: [
          {
            id: 'bg_ing_ext',
            label: 'Servicios para otros',
            type: 'subgroup',
            amount: extJobsTotal,
            children: extMachineChildren,
          },
          {
            id: 'bg_ing_prop',
            label: 'Trabajos en propiedad',
            type: 'subgroup',
            amount: internalJobsTotal,
            children: propMachineTreeNodes,
          },
          {
            id: 'bg_ing_crops',
            label: 'Ventas de cosecha',
            type: 'subgroup',
            amount: cropIncomesTotal,
            children: cropLotChildren,
          },
        ],
      },
      {
        id: 'bg_gastos',
        label: 'GASTOS CONSOLIDADOS',
        type: 'group',
        amount: totalConsolidatedExpense,
        isExpense: true,
        children: [
          {
            id: 'bg_exp_mach',
            label: 'Gastos de Maquinarias',
            type: 'subgroup',
            amount: directMachTotal,
            children: machExpChildren,
          },
          {
            id: 'bg_exp_prop',
            label: 'Gastos de Propiedad',
            type: 'subgroup',
            amount: directPropTotal,
            children: propExpChildren,
          },
          {
            id: 'bg_exp_machinery',
            label: 'Trabajos de maquinaria',
            type: 'subgroup',
            amount: internalJobsTotal,
            children: internalLotChildren,
          },
        ],
      },
      {
        id: 'bg_resultado',
        label: 'RESULTADO CONSOLIDADO',
        type: 'group',
        amount: consolidatedResult,
        isResult: true,
      },
    ];
  }, [campaignJobs, campaignIncomes, campaignExpenses, activeCurrency, safeExchangeRate]);

  // ==========================================================================
  // TREE GENERATOR 2: BALANCE DE MAQUINARIAS
  // ==========================================================================
  const balanceMaquinariasTree = useMemo((): TreeNode[] => {
    // 1. Trabajos en propiedad
    const propJobs = campaignJobs.filter((j) => j.tipoTrabajo !== 'tercero');
    const propJobsTotal = propJobs.reduce(
      (acc, j) => acc + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
      0
    );

    // Grouping: Machine -> Implement (Job Type)
    // Structure:
    // Machine (e.g. New Holland TS115)
    //   -> Implement (e.g. Romplow) [Accumulated total, appears ONCE!]
    const propMachineTreeNodes = buildMachineTreeNodes(
      propJobs,
      'maq_prop',
      (j) => getLotName(j.loteId)
    );

    // 2. Servicios para otros
    const extJobs = campaignJobs.filter((j) => j.tipoTrabajo === 'tercero');
    const extJobsTotal = extJobs.reduce(
      (acc, j) => acc + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
      0
    );

    const extMachineTreeNodes = buildMachineTreeNodes(
      extJobs,
      'maq_ext',
      (j) => (j.cliente ? `Cliente: ${j.cliente}` : 'Servicio a tercero')
    );

    const totalMaqIncome = propJobsTotal + extJobsTotal;

    // 3. Gastos de maquinaria
    const machExpenses = campaignExpenses.filter((e) => e.modulo === 'maquinarias');
    const machExpensesTotal = machExpenses.reduce(
      (acc, e) => acc + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
      0
    );

    const machExpByRubro: Record<string, { total: number; items: Expense[] }> = {};
    machExpenses.forEach((e) => {
      const rubro = getExpenseRubro(e);
      if (!machExpByRubro[rubro]) machExpByRubro[rubro] = { total: 0, items: [] };
      const val = toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc);
      machExpByRubro[rubro].total += val;
      machExpByRubro[rubro].items.push(e);
    });

    const machExpRubroChildren: TreeNode[] = Object.entries(machExpByRubro).map(
      ([rubro, data]) => {
        const records: DetailRecord[] = data.items.map((e, idx) => ({
          id: e.id || `mach_exp_${idx}`,
          fecha: e.fecha || '',
          concepto: formatShortConceptName(getExpenseDescription(e)),
          entidad: getMachineName(getExpenseMachineId(e)),
          cantidad: e.cantidad,
          unidad: e.unidad,
          tarifa: e.precio,
          monto: toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
          icono: getExpenseIcon(e) || getIconDefinition(rubro, 'gasto').id,
        }));

        return {
          id: `maq_exp_${rubro}`,
          label: rubro,
          icon: getIconDefinition(rubro, 'gasto').id || 'diesel',
          type: 'item',
          amount: data.total,
          records,
        };
      }
    );

    const maqResult = totalMaqIncome - machExpensesTotal;

    return [
      {
        id: 'maq_ingresos',
        label: 'INGRESOS DE MAQUINARIAS',
        type: 'group',
        amount: totalMaqIncome,
        isIncome: true,
        children: [
          {
            id: 'maq_ing_prop',
            label: 'Trabajos en propiedad',
            type: 'subgroup',
            amount: propJobsTotal,
            children: propMachineTreeNodes,
          },
          {
            id: 'maq_ing_ext',
            label: 'Servicios para otros',
            type: 'subgroup',
            amount: extJobsTotal,
            children: extMachineTreeNodes,
          },
        ],
      },
      {
        id: 'maq_gastos',
        label: 'GASTOS DE MAQUINARIAS',
        type: 'group',
        amount: machExpensesTotal,
        isExpense: true,
        children: [
          {
            id: 'maq_exp_directos',
            label: 'Gastos directos',
            type: 'subgroup',
            amount: machExpensesTotal,
            children: machExpRubroChildren,
          },
        ],
      },
      {
        id: 'maq_resultado',
        label: 'RESULTADO OPERATIVO',
        type: 'group',
        amount: maqResult,
        isResult: true,
      },
    ];
  }, [campaignJobs, campaignExpenses, activeCurrency, safeExchangeRate]);

  // ==========================================================================
  // TREE GENERATOR 3: BALANCE DE PROPIEDAD
  // ==========================================================================
  const balancePropiedadTree = useMemo((): TreeNode[] => {
    // 1. Ventas de Cosecha
    const cropIncomes = campaignIncomes.filter(
      (i) => i.modulo === 'propiedad' && !i.esTrabajoPropio
    );
    const cropIncomesTotal = cropIncomes.reduce(
      (acc, i) => acc + toViewCurrency(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc),
      0
    );

    const cropByLot: Record<string, { total: number; items: Income[] }> = {};
    cropIncomes.forEach((i) => {
      const lId = i.loteId || 'sin_lote';
      if (!cropByLot[lId]) cropByLot[lId] = { total: 0, items: [] };
      const val = toViewCurrency(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc);
      cropByLot[lId].total += val;
      cropByLot[lId].items.push(i);
    });

    const cropLotChildren: TreeNode[] = Object.entries(cropByLot).map(([lId, data]) => {
      const records: DetailRecord[] = data.items.map((i, idx) => {
        const client = getIncomeClient(i);
        return {
          id: i.id || `crop_inc_${idx}`,
          fecha: i.fecha || '',
          concepto: formatShortConceptName(getIncomeConcept(i)),
          entidad: client ? `Comprador: ${client}` : getLotName(lId),
          cantidad: i.cantidad,
          unidad: i.unidad,
          tarifa: i.precio,
          monto: toViewCurrency(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc),
          icono: getIncomeIcon(i) || 'granos',
        };
      });

      return {
        id: `prop_ing_crop_${lId}`,
        label: getLotName(lId),
        icon: 'terreno',
        type: 'item',
        amount: data.total,
        records,
      };
    });

    // 2. Gastos Directos Propiedad
    const propDirectExpenses = campaignExpenses.filter(
      (e) => e.modulo === 'propiedad' && !isInternalMachineryJobExpense(e)
    );
    const propDirectTotal = propDirectExpenses.reduce(
      (acc, e) => acc + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
      0
    );

    const propDirectByRubro: Record<string, { total: number; items: Expense[] }> = {};
    propDirectExpenses.forEach((e) => {
      const rubro = getExpenseRubro(e);
      if (!propDirectByRubro[rubro]) propDirectByRubro[rubro] = { total: 0, items: [] };
      const val = toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc);
      propDirectByRubro[rubro].total += val;
      propDirectByRubro[rubro].items.push(e);
    });

    const propDirectChildren: TreeNode[] = Object.entries(propDirectByRubro).map(
      ([rubro, data]) => {
        const records: DetailRecord[] = data.items.map((e, idx) => ({
          id: e.id || `prop_exp_${idx}`,
          fecha: e.fecha || '',
          concepto: formatShortConceptName(getExpenseDescription(e)),
          entidad: getLotName(e.loteId),
          cantidad: e.cantidad,
          unidad: e.unidad,
          tarifa: e.precio,
          monto: toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
          icono: getExpenseIcon(e) || getIconDefinition(rubro, 'gasto').id,
        }));

        return {
          id: `prop_exp_direct_${rubro}`,
          label: rubro,
          icon: getIconDefinition(rubro, 'gasto').id || 'insumo',
          type: 'item',
          amount: data.total,
          records,
        };
      }
    );

    // 3. Trabajos de maquinaria recibidos
    const internalJobs = campaignJobs.filter((j) => j.tipoTrabajo !== 'tercero');
    const internalJobsTotal = internalJobs.reduce(
      (acc, j) => acc + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
      0
    );

    const internalByLot: Record<string, { total: number; jobs: MachineryJob[] }> = {};
    internalJobs.forEach((j) => {
      const lId = j.loteId || 'sin_lote';
      if (!internalByLot[lId]) internalByLot[lId] = { total: 0, jobs: [] };
      const val = toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc);
      internalByLot[lId].total += val;
      internalByLot[lId].jobs.push(j);
    });

    const internalLotChildren: TreeNode[] = Object.entries(internalByLot).map(
      ([lId, data]) => {
        const records: DetailRecord[] = data.jobs.map((j, idx) => ({
          id: j.id || `rec_job_${idx}`,
          fecha: j.fecha || '',
          concepto: formatShortConceptName(getJobName(j)),
          entidad: getLotName(lId),
          maquinaImplemento: getMachineName(getJobMachineId(j)),
          cantidad: j.cantidad,
          unidad: j.unidad,
          tarifa: j.tarifa,
          monto: toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
          icono: getJobIcon(j) || 'tractor',
        }));

        return {
          id: `prop_exp_jobs_${lId}`,
          label: getLotName(lId),
          icon: 'terreno',
          type: 'item',
          amount: data.total,
          records,
        };
      }
    );

    const totalPropExpenses = propDirectTotal + internalJobsTotal;
    const propResult = cropIncomesTotal - totalPropExpenses;

    return [
      {
        id: 'prop_ingresos',
        label: 'INGRESOS DE PROPIEDAD',
        type: 'group',
        amount: cropIncomesTotal,
        isIncome: true,
        children: [
          {
            id: 'prop_ing_crops',
            label: 'Ventas de cosecha',
            type: 'subgroup',
            amount: cropIncomesTotal,
            children: cropLotChildren,
          },
        ],
      },
      {
        id: 'prop_gastos',
        label: 'GASTOS DE PROPIEDAD',
        type: 'group',
        amount: totalPropExpenses,
        isExpense: true,
        children: [
          {
            id: 'prop_exp_direct',
            label: 'Gastos directos',
            type: 'subgroup',
            amount: propDirectTotal,
            children: propDirectChildren,
          },
          {
            id: 'prop_exp_machinery',
            label: 'Trabajos de maquinaria',
            type: 'subgroup',
            amount: internalJobsTotal,
            children: internalLotChildren,
          },
        ],
      },
      {
        id: 'prop_resultado',
        label: 'RESULTADO OPERATIVO',
        type: 'group',
        amount: propResult,
        isResult: true,
      },
    ];
  }, [campaignIncomes, campaignExpenses, campaignJobs, activeCurrency, safeExchangeRate]);

  // ==========================================================================
  // TREE GENERATOR 4: REPORTE INDIVIDUAL DE LOTE
  // ==========================================================================
  const selectedLot = useMemo(() => {
    return safeLots.find((l) => String(l.id) === String(selectedLotId));
  }, [safeLots, selectedLotId]);

  const balanceLoteTree = useMemo((): TreeNode[] => {
    if (!selectedLot) return [];
    const lotIdStr = String(selectedLot.id);

    // 1. Incomes for this lot
    const lotIncomes = campaignIncomes.filter(
      (i) => String(i.loteId) === lotIdStr && !i.esTrabajoPropio
    );
    const lotIncomesTotal = lotIncomes.reduce(
      (acc, i) => acc + toViewCurrency(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc),
      0
    );

    const lotIncomeRecords: DetailRecord[] = lotIncomes.map((i, idx) => {
      const client = getIncomeClient(i);
      return {
        id: i.id || `lote_inc_${idx}`,
        fecha: i.fecha || '',
        concepto: getIncomeConcept(i),
        entidad: client ? `Comprador: ${client}` : selectedLot.nombre,
        cantidad: i.cantidad,
        unidad: i.unidad,
        tarifa: i.precio,
        monto: toViewCurrency(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc),
        icono: getIncomeIcon(i) || 'granos',
      };
    });

    // 2. Direct Expenses for this lot
    const lotDirectExpenses = campaignExpenses.filter(
      (e) => String(e.loteId) === lotIdStr && !isInternalMachineryJobExpense(e)
    );
    const lotDirectTotal = lotDirectExpenses.reduce(
      (acc, e) => acc + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
      0
    );

    const lotDirectByRubro: Record<string, { total: number; items: Expense[] }> = {};
    lotDirectExpenses.forEach((e) => {
      const rubro = getExpenseRubro(e);
      if (!lotDirectByRubro[rubro]) lotDirectByRubro[rubro] = { total: 0, items: [] };
      const val = toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc);
      lotDirectByRubro[rubro].total += val;
      lotDirectByRubro[rubro].items.push(e);
    });

    const lotDirectChildren: TreeNode[] = Object.entries(lotDirectByRubro).map(
      ([rubro, data]) => {
        const records: DetailRecord[] = data.items.map((e, idx) => ({
          id: e.id || `lote_exp_${idx}`,
          fecha: e.fecha || '',
          concepto: getExpenseDescription(e),
          entidad: selectedLot.nombre,
          cantidad: e.cantidad,
          unidad: e.unidad,
          tarifa: e.precio,
          monto: toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
          icono: getExpenseIcon(e) || getIconDefinition(rubro, 'gasto').id,
        }));

        return {
          id: `lote_exp_dir_${rubro}`,
          label: rubro,
          icon: getIconDefinition(rubro, 'gasto').id || 'insumo',
          type: 'item',
          amount: data.total,
          records,
        };
      }
    );

    // 3. Machinery jobs on this lot
    const lotJobs = campaignJobs.filter((j) => String(j.loteId) === lotIdStr);
    const lotJobsTotal = lotJobs.reduce(
      (acc, j) => acc + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
      0
    );

    const lotJobsByImp: Record<string, { total: number; jobs: MachineryJob[]; icon?: string }> = {};
    lotJobs.forEach((j) => {
      const impKey = getJobName(j);
      if (!lotJobsByImp[impKey]) {
        lotJobsByImp[impKey] = {
          total: 0,
          jobs: [],
          icon: getJobIcon(j) || 'tractor',
        };
      }
      const val = toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc);
      lotJobsByImp[impKey].total += val;
      lotJobsByImp[impKey].jobs.push(j);
    });

    const lotJobChildren: TreeNode[] = Object.entries(lotJobsByImp).map(([impKey, data]) => {
      const records: DetailRecord[] = data.jobs.map((j, idx) => ({
        id: j.id || `lote_job_${idx}`,
        fecha: j.fecha || '',
        concepto: impKey,
        entidad: selectedLot.nombre,
        maquinaImplemento: getMachineName(getJobMachineId(j)),
        cantidad: j.cantidad,
        unidad: j.unidad,
        tarifa: j.tarifa,
        monto: toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
        icono: data.icon,
      }));

      return {
        id: `lote_job_imp_${impKey}`,
        label: impKey,
        icon: data.icon,
        type: 'item',
        amount: data.total,
        records,
      };
    });

    const totalLotExpense = lotDirectTotal + lotJobsTotal;
    const lotResult = lotIncomesTotal - totalLotExpense;

    return [
      {
        id: 'lote_tree_ing',
        label: 'INGRESOS DEL LOTE',
        type: 'group',
        amount: lotIncomesTotal,
        isIncome: true,
        children: [
          {
            id: 'lote_tree_ing_sales',
            label: 'Ventas de cosecha',
            type: 'subgroup',
            amount: lotIncomesTotal,
            records: lotIncomeRecords,
          },
        ],
      },
      {
        id: 'lote_tree_exp',
        label: 'GASTOS DEL LOTE',
        type: 'group',
        amount: totalLotExpense,
        isExpense: true,
        children: [
          {
            id: 'lote_tree_exp_dir',
            label: 'Gastos directos en lote',
            type: 'subgroup',
            amount: lotDirectTotal,
            children: lotDirectChildren,
          },
          {
            id: 'lote_tree_exp_jobs',
            label: 'Labores de maquinaria recibidas',
            type: 'subgroup',
            amount: lotJobsTotal,
            children: lotJobChildren,
          },
        ],
      },
      {
        id: 'lote_tree_res',
        label: 'RESULTADO ECONÓMICO DEL LOTE',
        sublabel: `${selectedLot.nombre} · ${getLotSurface(selectedLot)} ha`,
        type: 'group',
        amount: lotResult,
        isResult: true,
      },
    ];
  }, [
    selectedLot,
    campaignIncomes,
    campaignExpenses,
    campaignJobs,
    activeCurrency,
    safeExchangeRate,
  ]);

  // ==========================================================================
  // TREE GENERATOR 5: REPORTE INDIVIDUAL DE CAMPAÑA
  // ==========================================================================
  const selectedCampaignDetail = useMemo(() => {
    return safeCampaigns.find((c) => String(c.id) === String(selectedCampaignDetailId));
  }, [safeCampaigns, selectedCampaignDetailId]);

  const balanceCampanaTree = useMemo((): TreeNode[] => {
    if (!selectedCampaignDetail) return [];

    const cJobs = safeJobs.filter((j) => matchesCampaign(j, selectedCampaignDetail));
    const cExpenses = safeExpenses.filter((e) => matchesCampaign(e, selectedCampaignDetail));
    const cIncomes = safeIncomes.filter((i) => matchesCampaign(i, selectedCampaignDetail));

    const extJobs = cJobs.filter((j) => j.tipoTrabajo === 'tercero');
    const extJobsTotal = extJobs.reduce(
      (acc, j) => acc + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
      0
    );

    const extRecords: DetailRecord[] = extJobs.map((j, idx) => ({
      id: j.id || `c_ext_${idx}`,
      fecha: j.fecha || '',
      concepto: formatShortConceptName(getJobName(j)),
      entidad: j.cliente ? `Cliente: ${j.cliente}` : 'Tercero',
      maquinaImplemento: getMachineName(getJobMachineId(j)),
      cantidad: j.cantidad,
      unidad: j.unidad,
      tarifa: j.tarifa,
      monto: toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
      icono: getJobIcon(j) || 'tractor',
    }));

    const internalJobs = cJobs.filter((j) => j.tipoTrabajo !== 'tercero');
    const internalJobsTotal = internalJobs.reduce(
      (acc, j) => acc + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
      0
    );

    const internalRecords: DetailRecord[] = internalJobs.map((j, idx) => ({
      id: j.id || `c_int_${idx}`,
      fecha: j.fecha || '',
      concepto: formatShortConceptName(getJobName(j)),
      entidad: getLotName(j.loteId),
      maquinaImplemento: getMachineName(getJobMachineId(j)),
      cantidad: j.cantidad,
      unidad: j.unidad,
      tarifa: j.tarifa,
      monto: toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
      icono: getJobIcon(j) || 'tractor',
    }));

    const cropIncomes = cIncomes.filter((i) => i.modulo === 'propiedad' && !i.esTrabajoPropio);
    const cropIncomesTotal = cropIncomes.reduce(
      (acc, i) => acc + toViewCurrency(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc),
      0
    );

    const cropRecords: DetailRecord[] = cropIncomes.map((i, idx) => ({
      id: i.id || `c_crop_${idx}`,
      fecha: i.fecha || '',
      concepto: formatShortConceptName(getIncomeConcept(i)),
      entidad: getIncomeClient(i) ? `Comprador: ${getIncomeClient(i)}` : getLotName(i.loteId),
      cantidad: i.cantidad,
      unidad: i.unidad,
      tarifa: i.precio,
      monto: toViewCurrency(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc),
      icono: getIncomeIcon(i) || 'granos',
    }));

    const totalIncome = extJobsTotal + internalJobsTotal + cropIncomesTotal;

    const machExpenses = cExpenses.filter((e) => e.modulo === 'maquinarias');
    const machExpensesTotal = machExpenses.reduce(
      (acc, e) => acc + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
      0
    );

    const machRecords: DetailRecord[] = machExpenses.map((e, idx) => ({
      id: e.id || `c_mexp_${idx}`,
      fecha: e.fecha || '',
      concepto: formatShortConceptName(getExpenseDescription(e)),
      entidad: getMachineName(getExpenseMachineId(e)),
      cantidad: e.cantidad,
      unidad: e.unidad,
      tarifa: e.precio,
      monto: toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
      icono: getExpenseIcon(e) || 'diesel',
    }));

    const propExpenses = cExpenses.filter(
      (e) => e.modulo === 'propiedad' && !isInternalMachineryJobExpense(e)
    );
    const propExpensesTotal = propExpenses.reduce(
      (acc, e) => acc + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
      0
    );

    const propRecords: DetailRecord[] = propExpenses.map((e, idx) => ({
      id: e.id || `c_pexp_${idx}`,
      fecha: e.fecha || '',
      concepto: formatShortConceptName(getExpenseDescription(e)),
      entidad: getLotName(e.loteId),
      cantidad: e.cantidad,
      unidad: e.unidad,
      tarifa: e.precio,
      monto: toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
      icono: getExpenseIcon(e) || 'insumo',
    }));

    const totalExpense = machExpensesTotal + propExpensesTotal + internalJobsTotal;
    const cResult = totalIncome - totalExpense;

    return [
      {
        id: 'cd_ingresos',
        label: 'INGRESOS CONSOLIDADOS',
        type: 'group',
        amount: totalIncome,
        isIncome: true,
        children: [
          {
            id: 'cd_ing_ext',
            label: 'Servicios para otros (Maquinarias)',
            type: 'subgroup',
            amount: extJobsTotal,
            records: extRecords,
          },
          {
            id: 'cd_ing_prop',
            label: 'Trabajos en propiedad (Maquinarias)',
            type: 'subgroup',
            amount: internalJobsTotal,
            records: internalRecords,
          },
          {
            id: 'cd_ing_crop',
            label: 'Ventas de cosecha (Propiedad)',
            type: 'subgroup',
            amount: cropIncomesTotal,
            records: cropRecords,
          },
        ],
      },
      {
        id: 'cd_gastos',
        label: 'GASTOS CONSOLIDADOS',
        type: 'group',
        amount: totalExpense,
        isExpense: true,
        children: [
          {
            id: 'cd_exp_mach',
            label: 'Gastos directos de Maquinarias',
            type: 'subgroup',
            amount: machExpensesTotal,
            records: machRecords,
          },
          {
            id: 'cd_exp_prop',
            label: 'Gastos directos de Propiedad',
            type: 'subgroup',
            amount: propExpensesTotal,
            records: propRecords,
          },
          {
            id: 'cd_exp_jobs',
            label: 'Trabajos de maquinaria (Propiedad)',
            type: 'subgroup',
            amount: internalJobsTotal,
            records: internalRecords,
          },
        ],
      },
      {
        id: 'cd_resultado',
        label: `RESULTADO ${selectedCampaignDetail.nombre.toUpperCase()}`,
        type: 'group',
        amount: cResult,
        isResult: true,
      },
    ];
  }, [
    selectedCampaignDetail,
    safeJobs,
    safeExpenses,
    safeIncomes,
    activeCurrency,
    safeExchangeRate,
  ]);

  // ==========================================================================
  // LOTS SUMMARY DATA
  // ==========================================================================
  const lotsSummary = useMemo(() => {
    return safeLots.map((lot) => {
      const lotIdStr = String(lot.id);
      const lotIncomes = campaignIncomes
        .filter((i) => String(i.loteId) === lotIdStr && !i.esTrabajoPropio)
        .reduce((sum, i) => sum + toViewCurrency(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc), 0);

      const lotDirectExp = campaignExpenses
        .filter((e) => String(e.loteId) === lotIdStr && !isInternalMachineryJobExpense(e))
        .reduce((sum, e) => sum + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc), 0);

      const lotMachExp = campaignJobs
        .filter((j) => String(j.loteId) === lotIdStr)
        .reduce(
          (sum, j) => sum + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
          0
        );

      const totalExp = lotDirectExp + lotMachExp;
      const netResult = lotIncomes - totalExp;
      const superficie = getLotSurface(lot);
      const marginPerHa = superficie > 0 ? netResult / superficie : null;

      return {
        lot,
        incomes: lotIncomes,
        expenses: totalExp,
        directExpenses: lotDirectExp,
        machineryExpenses: lotMachExp,
        result: netResult,
        superficie,
        marginPerHa,
      };
    });
  }, [safeLots, campaignIncomes, campaignExpenses, campaignJobs, activeCurrency, safeExchangeRate]);

  const filteredLotsSummary = useMemo(() => {
    if (!lotSearchTerm.trim()) return lotsSummary;
    const term = lotSearchTerm.toLowerCase();
    return lotsSummary.filter((item) => {
      const crop = getLotCrop(item.lot);
      return (
        item.lot.nombre.toLowerCase().includes(term) ||
        (crop && crop.toLowerCase().includes(term))
      );
    });
  }, [lotsSummary, lotSearchTerm]);

  // ==========================================================================
  // CAMPAIGNS SUMMARY DATA
  // ==========================================================================
  const campaignsSummary = useMemo(() => {
    const sorted = [...safeCampaigns].sort((a, b) => {
      const dateA = a.fechaInicio || a.nombre || '';
      const dateB = b.fechaInicio || b.nombre || '';
      return dateB.localeCompare(dateA);
    });

    return sorted.map((camp) => {
      const cJobs = safeJobs.filter((j) => matchesCampaign(j, camp));
      const cExpenses = safeExpenses.filter((e) => matchesCampaign(e, camp));
      const cIncomes = safeIncomes.filter((i) => matchesCampaign(i, camp));

      const extJobs = cJobs
        .filter((j) => j.tipoTrabajo === 'tercero')
        .reduce(
          (sum, j) => sum + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
          0
        );

      const cropIncomes = cIncomes
        .filter((i) => i.modulo === 'propiedad' && !i.esTrabajoPropio)
        .reduce((sum, i) => sum + toViewCurrency(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc), 0);

      const machExpenses = cExpenses
        .filter((e) => e.modulo === 'maquinarias')
        .reduce((sum, e) => sum + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc), 0);

      const propExpenses = cExpenses
        .filter((e) => e.modulo === 'propiedad' && !isInternalMachineryJobExpense(e))
        .reduce((sum, e) => sum + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc), 0);

      const totalIncome = extJobs + cropIncomes;
      const totalExpense = machExpenses + propExpenses;
      const netResult = totalIncome - totalExpense;

      return {
        campaign: camp,
        totalIncome,
        totalExpense,
        result: netResult,
      };
    });
  }, [safeCampaigns, safeJobs, safeExpenses, safeIncomes, activeCurrency, safeExchangeRate]);

  // ==========================================================================
  // COMPONENT: UNIFORM COMPACT EXCEL BALANCE TREE ROW RENDERER
  // (NO INDIVIDUAL OPERATIONS INSIDE BALANCE! TAPPING OPENS SEPARATE SCREEN)
  // ==========================================================================
  const renderTreeNode = (node: TreeNode, level = 0) => {
    const hasChildren = !!node.children && node.children.length > 0;
    const allRecords = collectNodeRecords(node);
    const hasRecords = allRecords.length > 0;

    // RESULT ROW (Level 0 Special Row)
    if (node.isResult) {
      const isPositive = node.amount >= 0;
      const isZero = node.amount === 0;

      const bgClass = isZero
        ? 'bg-stone-200/80 text-stone-900 border-stone-300'
        : isPositive
        ? 'bg-emerald-100 text-emerald-950 border-emerald-500'
        : 'bg-red-100 text-red-950 border-red-500';

      const textClass = isZero
        ? 'text-stone-800'
        : isPositive
        ? 'text-emerald-800'
        : 'text-red-800';

      return (
        <div
          key={node.id}
          className={`flex items-center justify-between border-2 px-2.5 py-1.5 my-1 rounded-sm shadow-2xs text-xs font-bold ${bgClass}`}
        >
          <div className="min-w-0 pr-2">
            <span className="uppercase tracking-tight block font-black truncate">
              {node.label}
            </span>
          </div>
          <div className="text-right shrink-0">
            <span className={`text-xs sm:text-sm font-black font-mono tabular-nums ${textClass}`}>
              {!isZero && isPositive ? '+' : ''}
              {formatMoney(node.amount)}
            </span>
          </div>
        </div>
      );
    }

    // INFORMATIONAL ROW (e.g. Intercompany Transfers)
    if (node.isInformative) {
      return (
        <div key={node.id} className="my-1 border border-stone-200/80 bg-stone-100/70 text-xs">
          <div
            onClick={() => {
              if (hasRecords) {
                openLibroDiario(node.label, node.sublabel, node.amount, allRecords);
              }
            }}
            className={`flex items-center justify-between px-2.5 py-1.5 ${
              hasRecords ? 'cursor-pointer hover:bg-stone-200/60' : ''
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Info className="h-3.5 w-3.5 text-stone-500 shrink-0" />
              <span className="font-bold text-stone-800 truncate">{node.label}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 font-mono font-semibold text-stone-700">
              <span>{formatMoney(node.amount)}</span>
              {hasRecords && <ChevronRight className="h-3.5 w-3.5 text-stone-400" />}
            </div>
          </div>

          {node.children && (
            <div className="divide-y divide-stone-200/60 border-t border-stone-200/60 font-bold">
              {node.children.map((child) => renderTreeNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    // LEVEL 0: MAIN GROUPS (INGRESOS, GASTOS)
    if (level === 0) {
      const isInc = node.isIncome;
      return (
        <div
          key={node.id}
          className={`border my-1 text-xs ${
            isInc
              ? 'border-emerald-300 bg-emerald-100/90 text-emerald-950'
              : 'border-red-300 bg-red-100/90 text-red-950'
          }`}
        >
          {/* Header Row */}
          <div className="flex items-center justify-between px-2.5 py-1.5 font-bold">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="uppercase tracking-tight font-extrabold truncate">
                {node.label}
              </span>
            </div>

            <div className="text-right shrink-0 ml-2">
              <span
                className={`text-xs sm:text-sm font-black font-mono tabular-nums ${
                  isInc ? 'text-emerald-900' : 'text-red-900'
                }`}
              >
                {isInc ? '+' : '-'}
                {formatMoney(node.amount)}
              </span>
            </div>
          </div>

          {/* Children Container */}
          {hasChildren && (
            <div className="divide-y divide-stone-200/80 border-t border-stone-200/80 bg-white">
              {node.children!.map((child) => renderTreeNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    // LEVEL 1: SUBGROUPS / SUBTOTALS (e.g. "Gastos directos", "Trabajos de maquinaria", "Servicios para otros", "Ventas de cosecha")
    if (level === 1) {
      return (
        <div key={node.id} className="bg-stone-200/70 text-stone-950 border-b border-stone-300">
          <div
            onClick={() => {
              if (hasRecords) {
                openLibroDiario(node.label, node.sublabel, node.amount, allRecords);
              }
            }}
            className={`flex items-center justify-between px-2.5 py-1.5 ${
              hasRecords ? 'cursor-pointer hover:bg-stone-300/60 transition' : ''
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0 pl-1">
              <span className="font-extrabold text-xs sm:text-sm text-stone-950 truncate">
                {node.label}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              <span className="font-extrabold font-mono text-xs sm:text-sm text-stone-950 tabular-nums">
                {formatMoney(node.amount)}
              </span>
              {hasRecords && <ChevronRight className="h-4 w-4 text-stone-500" />}
            </div>
          </div>

          {hasChildren && (
            <div className="divide-y divide-stone-200/60 bg-white">
              {node.children!.map((child) => renderTreeNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    // LEVEL 2: CATEGORIES / MACHINES / LOTS / EXPENSE ITEMS
    if (level === 2) {
      return (
        <div key={node.id} className="bg-white text-stone-900 border-b border-stone-200/60">
          <div
            onClick={() => {
              if (hasRecords) {
                openLibroDiario(node.label, node.sublabel, node.amount, allRecords);
              }
            }}
            className={`flex items-center justify-between px-2.5 py-1 ${
              hasRecords ? 'cursor-pointer hover:bg-stone-50 transition' : ''
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0 pl-3.5 sm:pl-5">
              {node.icon && (
                <VisualIcon
                  iconId={node.icon}
                  name={node.label}
                  size={14}
                  className="inline-block shrink-0"
                />
              )}
              <span className="font-bold text-xs text-stone-900 truncate">
                {node.label}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 ml-2 font-mono font-semibold text-xs text-stone-800 tabular-nums">
              <span>{formatMoney(node.amount)}</span>
              {hasRecords && <ChevronRight className="h-3.5 w-3.5 text-stone-400" />}
            </div>
          </div>

          {hasChildren && (
            <div className="divide-y divide-stone-100 bg-stone-50/50">
              {node.children!.map((child) => renderTreeNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    // LEVEL 3: REAL IMPLEMENTS / LEAF DETAILS
    return (
      <div key={node.id} className="bg-stone-50/60 text-stone-700 border-b border-stone-100">
        <div
          onClick={() => {
            if (hasRecords) {
              openLibroDiario(node.label, node.sublabel, node.amount, allRecords);
            }
          }}
          className={`flex items-center justify-between px-2.5 py-0.5 sm:py-1 ${
            hasRecords ? 'cursor-pointer hover:bg-stone-100/70 transition' : ''
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 pl-7 sm:pl-10">
            {node.icon && (
              <VisualIcon
                iconId={node.icon}
                name={node.label}
                size={13}
                className="inline-block shrink-0 opacity-80"
              />
            )}
            <span className="font-normal text-[11px] sm:text-xs text-stone-700 truncate">
              {node.label}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2 font-mono text-[11px] sm:text-xs text-stone-700 tabular-nums">
            <span>{formatMoney(node.amount)}</span>
            {hasRecords && <ChevronRight className="h-3 w-3 text-stone-400" />}
          </div>
        </div>

        {hasChildren && (
          <div className="divide-y divide-stone-100 bg-white">
            {node.children!.map((child) => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // ==========================================================================
  // UNIFORM TREE BALANCE TABLE WRAPPER
  // ==========================================================================
  const renderBalanceView = (
    title: string,
    subtitle: string,
    treeData: TreeNode[],
    filenamePrefix: string
  ) => {
    return (
      <div className="space-y-2">
        {/* Compact Title & Action Toolbar Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-stone-200">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-stone-900 tracking-tight">
              {title}
            </h2>
            <p className="text-[11px] text-stone-500">
              {subtitle} &bull; Campaña {currentCampaign.nombre}
            </p>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-1.5 no-print">
            {/* Export to Excel (.xlsx) */}
            <button
              type="button"
              onClick={() =>
                handleExportToExcel(
                  `${title} - Campaña ${currentCampaign.nombre}`,
                  `${filenamePrefix}_${currentCampaign.nombre}_${activeCurrency}`,
                  treeData
                )
              }
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold transition cursor-pointer min-h-[30px] shadow-2xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Excel</span>
            </button>

            {/* Quick Print */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-stone-300 text-[11px] font-semibold text-stone-700 hover:bg-stone-50 transition cursor-pointer min-h-[30px]"
            >
              <Printer className="h-3.5 w-3.5 text-stone-600" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>

        {/* Tree Table Container */}
        <div className="border border-stone-300 bg-white rounded-sm shadow-2xs overflow-hidden print:border-stone-400">
          <div className="bg-stone-200/90 border-b border-stone-300 px-2.5 py-1 flex items-center justify-between text-[11px] font-bold text-stone-700 tracking-wider uppercase">
            <span>Concepto / Agrupación Financiera</span>
            <span>Importe ({activeCurrency === 'BOB' ? 'Bs' : 'USD'})</span>
          </div>

          <div className="divide-y divide-stone-200">
            {treeData.map((node) => renderTreeNode(node))}
          </div>
        </div>
      </div>
    );
  };

  // ==========================================================================
  // COMPACT TOP CONTROLS BAR (Campaign Selector + Currency Switcher)
  // ==========================================================================
  const renderTopControls = () => {
    return (
      <div className="bg-white border border-stone-200/80 p-2 rounded-lg shadow-2xs no-print mb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Campaign Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCampaignDropdown((prev) => !prev)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200/80 border border-stone-300 text-xs font-bold text-stone-800 transition cursor-pointer min-h-[32px]"
            >
              <Calendar className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
              <span>{currentCampaign.nombre}</span>
              {currentCampaign.activa && (
                <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                  Activa
                </span>
              )}
              <ChevronRight className="h-3.5 w-3.5 text-stone-500 shrink-0 rotate-90" />
            </button>

            {/* Campaign Dropdown */}
            {showCampaignDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowCampaignDropdown(false)}
                />
                <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-lg bg-white border border-stone-300 shadow-xl overflow-hidden divide-y divide-stone-100 animate-fadeIn">
                  <div className="p-2 bg-stone-50 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                    Seleccionar Campaña a Consultar
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {safeCampaigns.map((c) => {
                      const isSelected = String(c.id) === String(selectedCampaignId);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCampaignId(String(c.id));
                            setShowCampaignDropdown(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 text-left hover:bg-stone-50 transition cursor-pointer text-xs ${
                            isSelected ? 'bg-emerald-50 font-bold text-emerald-900' : 'text-stone-800'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <p className="truncate font-semibold">{c.nombre}</p>
                            <p className="text-[10px] text-stone-400">
                              {c.fechaInicio || 'Sin fecha'} &bull; {c.estado || 'registrada'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {c.activa && (
                              <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1 rounded">
                                Activa
                              </span>
                            )}
                            {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Module-specific Currency Switcher */}
          <div className="flex items-center gap-0.5 bg-stone-100 p-0.5 rounded-md border border-stone-300">
            <button
              type="button"
              onClick={() => setActiveCurrency('BOB')}
              className={`px-2.5 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                activeCurrency === 'BOB'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Bs
            </button>
            <button
              type="button"
              onClick={() => setActiveCurrency('USD')}
              className={`px-2.5 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                activeCurrency === 'USD'
                  ? 'bg-white text-emerald-800 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              USD
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================================================
  // UNIFIED TOP NAVIGATION ("Volver" button)
  // ==========================================================================
  const renderBackButton = () => {
    let label = 'Volver a Administración';
    let targetAction = onBack || (() => {});

    if (currentScreen === 'balance_general') {
      label = 'Volver a Finanzas';
      targetAction = () => setCurrentScreen('menu');
    } else if (currentScreen === 'maquinarias') {
      label = 'Volver a Finanzas';
      targetAction = () => setCurrentScreen('menu');
    } else if (currentScreen === 'propiedad_menu') {
      label = 'Volver a Finanzas';
      targetAction = () => setCurrentScreen('menu');
    } else if (currentScreen === 'propiedad_balance') {
      label = 'Volver a Propiedad';
      targetAction = () => setCurrentScreen('propiedad_menu');
    } else if (currentScreen === 'lotes') {
      label = 'Volver a Propiedad';
      targetAction = () => setCurrentScreen('propiedad_menu');
    } else if (currentScreen === 'lote_detail') {
      label = 'Volver a Lotes';
      targetAction = () => setCurrentScreen('lotes');
    } else if (currentScreen === 'campanas') {
      label = 'Volver a Finanzas';
      targetAction = () => setCurrentScreen('menu');
    } else if (currentScreen === 'campana_detail') {
      label = 'Volver a Campañas';
      targetAction = () => setCurrentScreen('campanas');
    } else if (currentScreen === 'libro_diario') {
      label = 'Volver al balance';
      targetAction = () => {
        if (libroDiarioData?.returnScreen) {
          setCurrentScreen(libroDiarioData.returnScreen);
        } else {
          setCurrentScreen('menu');
        }
      };
    }

    return (
      <div className="pb-2 border-b border-stone-200 no-print">
        <button
          type="button"
          onClick={targetAction}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-50 transition cursor-pointer shrink-0 min-h-[32px]"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-emerald-700" />
          <span>{label}</span>
        </button>
      </div>
    );
  };

  // ==========================================================================
  // SCREEN: DETALLE / LIBRO DIARIO (PANTALLA SEPARADA NUEVA)
  // ==========================================================================
  if (currentScreen === 'libro_diario' && libroDiarioData) {
    const { title, subtitle, totalAmount, records } = libroDiarioData;

    return (
      <div className="space-y-3 max-w-3xl mx-auto w-full">
        {renderBackButton()}

        {/* Header Summary Box */}
        <div className="bg-white border border-stone-300 p-3 rounded-md shadow-2xs flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-emerald-700 shrink-0" />
              <h2 className="text-sm sm:text-base font-bold text-stone-900">
                {title}
              </h2>
            </div>
            {subtitle && (
              <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>
            )}
            <p className="text-[11px] text-stone-500 mt-0.5 font-mono">
              Campaña: <strong>{currentCampaign.nombre}</strong> &bull; Operaciones:{' '}
              <strong>{records.length}</strong>
            </p>
          </div>

          <div className="text-right shrink-0 bg-stone-100 px-3 py-1.5 rounded border border-stone-300">
            <span className="text-[10px] font-bold uppercase text-stone-500 block">
              Total Acumulado ({activeCurrency})
            </span>
            <span className="text-sm sm:text-base font-extrabold font-mono tabular-nums text-stone-900 block">
              {formatMoney(totalAmount)}
            </span>
          </div>
        </div>

        {/* Top Controls (Bs/USD + Excel + Print) */}
        <div className="flex items-center justify-between gap-2 no-print">
          <div className="flex items-center gap-0.5 bg-stone-100 p-0.5 rounded border border-stone-300">
            <button
              type="button"
              onClick={() => setActiveCurrency('BOB')}
              className={`px-2.5 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                activeCurrency === 'BOB'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Bs
            </button>
            <button
              type="button"
              onClick={() => setActiveCurrency('USD')}
              className={`px-2.5 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                activeCurrency === 'USD'
                  ? 'bg-white text-emerald-800 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              USD
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                handleExportToExcel(
                  `${title} - Campaña ${currentCampaign.nombre}`,
                  `Libro_Diario_${title.replace(/[^a-zA-Z0-9]/g, '_')}_${activeCurrency}`,
                  [
                    {
                      id: 'ld_export',
                      label: title,
                      type: 'group',
                      amount: totalAmount,
                      children: records.map((r) => ({
                        id: r.id,
                        label: r.concepto,
                        date: r.fecha,
                        entity: r.entidad,
                        unitInfo: r.cantidad ? `${r.cantidad} ${r.unidad || 'u'}` : undefined,
                        type: 'detail',
                        amount: r.monto,
                      })),
                    },
                  ]
                )
              }
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold transition cursor-pointer min-h-[30px]"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Excel</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-stone-300 text-[11px] font-semibold text-stone-700 hover:bg-stone-50 transition cursor-pointer min-h-[30px]"
            >
              <Printer className="h-3.5 w-3.5 text-stone-600" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>

        {/* Libro Diario Table */}
        <div className="border border-stone-300 bg-white rounded-sm shadow-2xs overflow-hidden print:border-stone-400">
          <div className="bg-stone-200/90 border-b border-stone-300 px-2 py-1.5 grid grid-cols-12 text-[11px] font-bold text-stone-700 uppercase tracking-wider gap-1">
            <span className="col-span-2 sm:col-span-2">Fecha</span>
            <span className="col-span-5 sm:col-span-4">Concepto / Descripción</span>
            <span className="col-span-2 sm:col-span-3">Entidad / Ref</span>
            <span className="col-span-3 sm:col-span-3 text-right">Importe ({activeCurrency})</span>
          </div>

          <div className="divide-y divide-stone-200">
            {records.map((r) => (
              <div
                key={r.id}
                className="px-2 py-1.5 grid grid-cols-12 text-xs hover:bg-stone-50 transition gap-1 items-center"
              >
                <div className="col-span-2 sm:col-span-2 font-mono text-[11px] text-stone-500 truncate">
                  {r.fecha || '-'}
                </div>

                <div className="col-span-5 sm:col-span-4 min-w-0 pr-1">
                  <div className="flex items-center gap-1.5">
                    {r.icono && (
                      <VisualIcon
                        iconId={r.icono}
                        name={r.concepto}
                        size={14}
                        className="inline-block shrink-0"
                      />
                    )}
                    <span className="font-semibold text-stone-900 truncate">
                      {r.concepto}
                    </span>
                  </div>
                  {r.maquinaImplemento && (
                    <span className="text-[10px] text-stone-400 block truncate">
                      {r.maquinaImplemento}
                    </span>
                  )}
                </div>

                <div className="col-span-2 sm:col-span-3 text-[11px] text-stone-600 truncate">
                  {r.entidad || '-'}
                  {r.cantidad ? (
                    <span className="text-[10px] text-stone-400 block font-mono">
                      {r.cantidad} {r.unidad || 'u'}{' '}
                      {r.tarifa ? `@ ${r.tarifa}` : ''}
                    </span>
                  ) : null}
                </div>

                <div className="col-span-3 sm:col-span-3 text-right font-mono font-bold text-stone-900 tabular-nums">
                  {formatMoney(r.monto)}
                </div>
              </div>
            ))}
          </div>

          {/* Table Summary Footer */}
          <div className="bg-stone-100 border-t-2 border-stone-300 px-2 py-1.5 flex items-center justify-between text-xs font-extrabold text-stone-900">
            <span>TOTAL REGISTRADO ({records.length} movimientos)</span>
            <span className="font-mono tabular-nums text-sm">
              {formatMoney(totalAmount)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // SCREEN: MAIN MENU DE FINANZAS
  // ==========================================================================
  if (currentScreen === 'menu') {
    const bgResultNode = balanceGeneralTree.find((n) => n.isResult);
    const maqResultNode = balanceMaquinariasTree.find((n) => n.isResult);
    const propResultNode = balancePropiedadTree.find((n) => n.isResult);

    const menuOptions = [
      {
        id: 'balance_general' as const,
        title: 'Balance general',
        desc: 'Consolidado integral de la empresa',
        icon: <Layers className="h-4 w-4 text-emerald-700" />,
        result: bgResultNode?.amount ?? 0,
      },
      {
        id: 'maquinarias' as const,
        title: 'Maquinarias',
        desc: 'Servicios para otros, labores internas y costos directos',
        icon: <Tractor className="h-4 w-4 text-amber-700" />,
        result: maqResultNode?.amount ?? 0,
      },
      {
        id: 'propiedad_menu' as const,
        title: 'Propiedad',
        desc: 'Balance agrícola de lotes y ventas de cosecha',
        icon: <Trees className="h-4 w-4 text-blue-700" />,
        result: propResultNode?.amount ?? 0,
      },
      {
        id: 'campanas' as const,
        title: 'Por campaña',
        desc: 'Histórico comparativo y balances por período',
        icon: <Calendar className="h-4 w-4 text-purple-700" />,
        extraInfo: `${safeCampaigns.length} campañas`,
      },
    ];

    return (
      <div className="space-y-3 max-w-2xl mx-auto w-full">
        {renderBackButton()}

        {/* Header Title */}
        <div>
          <h1 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-700" />
            <span>FINANZAS</span>
          </h1>
          <p className="text-xs text-stone-500">
            Balances y resultados económicos de la empresa
          </p>
        </div>

        {renderTopControls()}

        {/* Compact Excel-style Menu Table */}
        <div className="border border-stone-300 bg-white rounded-sm shadow-2xs overflow-hidden divide-y divide-stone-200">
          <div className="bg-stone-100 px-3 py-1.5 flex items-center justify-between text-[11px] font-bold text-stone-700 uppercase tracking-wider">
            <span>Módulo / Consulta Financiera</span>
            <span>Resultado ({activeCurrency})</span>
          </div>

          {menuOptions.map((opt) => {
            const hasResult = typeof opt.result === 'number';
            const isPos = (opt.result ?? 0) >= 0;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setCurrentScreen(opt.id)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-stone-50 transition cursor-pointer text-left group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="shrink-0 p-1 rounded bg-stone-100 border border-stone-200">
                    {opt.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-stone-900 group-hover:text-emerald-800 transition">
                      {opt.title}
                    </h3>
                    <p className="text-[11px] text-stone-500 truncate">{opt.desc}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {hasResult ? (
                    <span
                      className={`text-xs font-bold font-mono tabular-nums ${
                        isPos ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {isPos ? '+' : ''}
                      {formatMoney(opt.result)}
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-stone-500">
                      {opt.extraInfo}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-700 transition" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ==========================================================================
  // SCREEN: BALANCE GENERAL CONSOLIDADO
  // ==========================================================================
  if (currentScreen === 'balance_general') {
    return (
      <div className="space-y-3 max-w-3xl mx-auto w-full">
        {renderBackButton()}
        {renderTopControls()}
        {renderBalanceView(
          'Balance General Consolidado',
          'Ingresos reales y gastos directos de la empresa',
          balanceGeneralTree,
          'Balance_General'
        )}
      </div>
    );
  }

  // ==========================================================================
  // SCREEN: BALANCE DE MAQUINARIAS
  // ==========================================================================
  if (currentScreen === 'maquinarias') {
    return (
      <div className="space-y-3 max-w-3xl mx-auto w-full">
        {renderBackButton()}
        {renderTopControls()}
        {renderBalanceView(
          'Balance de Maquinarias',
          'Trabajos en propiedad, servicios para otros y gastos operativos',
          balanceMaquinariasTree,
          'Balance_Maquinarias'
        )}
      </div>
    );
  }

  // ==========================================================================
  // SCREEN: PROPIEDAD SUBMENU
  // ==========================================================================
  if (currentScreen === 'propiedad_menu') {
    return (
      <div className="space-y-3 max-w-2xl mx-auto w-full">
        {renderBackButton()}

        <div>
          <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <Trees className="h-5 w-5 text-emerald-700" />
            <span>Módulo Propiedad</span>
          </h2>
          <p className="text-xs text-stone-500">
            Selecciona la consulta financiera que deseas realizar
          </p>
        </div>

        {renderTopControls()}

        <div className="border border-stone-300 bg-white rounded-sm shadow-2xs overflow-hidden divide-y divide-stone-200">
          <div className="bg-stone-100 px-3 py-1.5 flex items-center justify-between text-[11px] font-bold text-stone-700 uppercase tracking-wider">
            <span>Consulta Financiera</span>
            <span>Acción</span>
          </div>

          <button
            type="button"
            onClick={() => setCurrentScreen('propiedad_balance')}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-stone-50 transition cursor-pointer text-left group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="shrink-0 p-1 rounded bg-emerald-50 border border-emerald-200">
                <Trees className="h-4 w-4 text-emerald-700" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-stone-900 group-hover:text-emerald-800 transition">
                  Balance de Propiedad
                </h3>
                <p className="text-[11px] text-stone-500 truncate">
                  Ingresos por cosechas, insumos y labores recibidas
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-700 transition shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => setCurrentScreen('lotes')}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-stone-50 transition cursor-pointer text-left group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="shrink-0 p-1 rounded bg-blue-50 border border-blue-200">
                <LandPlot className="h-4 w-4 text-blue-700" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-stone-900 group-hover:text-blue-800 transition">
                    Reportes por lote
                  </h3>
                  <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-1.5 rounded">
                    {safeLots.length}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 truncate">
                  Resultados individuales y margen económico por hectárea
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-700 transition shrink-0" />
          </button>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // SCREEN: BALANCE DE PROPIEDAD
  // ==========================================================================
  if (currentScreen === 'propiedad_balance') {
    return (
      <div className="space-y-3 max-w-3xl mx-auto w-full">
        {renderBackButton()}
        {renderTopControls()}
        {renderBalanceView(
          'Balance de Propiedad',
          'Ventas de cosecha, insumos directos y trabajos de maquinaria',
          balancePropiedadTree,
          'Balance_Propiedad'
        )}
      </div>
    );
  }

  // ==========================================================================
  // SCREEN: REPORTES POR LOTE (COMPACT LIST)
  // ==========================================================================
  if (currentScreen === 'lotes') {
    return (
      <div className="space-y-3 max-w-3xl mx-auto w-full">
        {renderBackButton()}
        {renderTopControls()}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <LandPlot className="h-4 w-4 text-emerald-700" />
              <span>Reportes por Lote ({safeLots.length})</span>
            </h2>
            <p className="text-[11px] text-stone-500">
              Desglose económico y márgenes por hectárea en Campaña {currentCampaign.nombre}
            </p>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
            <input
              type="text"
              value={lotSearchTerm}
              onChange={(e) => setLotSearchTerm(e.target.value)}
              placeholder="Buscar lote o cultivo..."
              className="w-full pl-8 pr-3 py-1 rounded-md border border-stone-300 bg-white text-xs focus:outline-none focus:border-emerald-600 transition min-h-[30px]"
            />
            {lotSearchTerm && (
              <button
                type="button"
                onClick={() => setLotSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Compact Lots Excel Table */}
        <div className="border border-stone-300 bg-white rounded-sm shadow-2xs overflow-hidden divide-y divide-stone-200">
          <div className="bg-stone-100 px-2.5 py-1.5 flex items-center justify-between text-[11px] font-bold text-stone-700 uppercase tracking-wider">
            <span>Lote / Cultivo / Superficie</span>
            <span>Resultado / Margen ha</span>
          </div>

          {filteredLotsSummary.length === 0 ? (
            <div className="p-6 text-center text-stone-500 text-xs">
              No se encontraron lotes que coincidan con la búsqueda.
            </div>
          ) : (
            filteredLotsSummary.map(
              ({
                lot,
                incomes: lInc,
                expenses: lExp,
                result: lRes,
                superficie: lSup,
                marginPerHa: lMargin,
              }) => {
                const isPositive = lRes >= 0;
                const crop = getLotCrop(lot);
                return (
                  <button
                    key={lot.id}
                    type="button"
                    onClick={() => {
                      setSelectedLotId(String(lot.id));
                      setCurrentScreen('lote_detail');
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 hover:bg-stone-50 transition cursor-pointer text-left group"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-stone-900 group-hover:text-emerald-800 transition">
                          {lot.nombre}
                        </span>
                        {crop && (
                          <span className="text-[10px] font-medium text-stone-600 bg-stone-100 px-1.5 py-0.2 rounded">
                            {crop}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-stone-500">
                          ({lSup} ha)
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-stone-500 mt-0.5">
                        Ingresos: {formatMoney(lInc)} &bull; Gastos: {formatMoney(lExp)}
                      </div>
                    </div>

                    <div className="text-right shrink-0 font-mono tabular-nums flex items-center gap-1.5">
                      <div>
                        <span
                          className={`text-xs font-bold block ${
                            isPositive ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {formatMoney(lRes)}
                        </span>
                        {lMargin !== null && (
                          <span
                            className={`text-[10px] font-semibold block ${
                              lMargin >= 0 ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {lMargin >= 0 ? '+' : ''}
                            {formatMoney(lMargin)}/ha
                          </span>
                        )}
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-stone-400 group-hover:text-emerald-700" />
                    </div>
                  </button>
                );
              }
            )
          )}
        </div>
      </div>
    );
  }

  // ==========================================================================
  // SCREEN: REPORTE INDIVIDUAL DE LOTE (DETAIL BALANCE)
  // ==========================================================================
  if (currentScreen === 'lote_detail' && selectedLot) {
    const lotSummaryItem = lotsSummary.find(
      (item) => String(item.lot.id) === String(selectedLot.id)
    );

    return (
      <div className="space-y-3 max-w-3xl mx-auto w-full">
        {renderBackButton()}
        {renderTopControls()}

        {/* Lot Header Bar */}
        <div className="bg-white border border-stone-300 p-2.5 rounded-sm flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <LandPlot className="h-4 w-4 text-emerald-700 shrink-0" />
              <h2 className="text-sm font-bold text-stone-900">
                {selectedLot.nombre}
              </h2>
            </div>
            <p className="text-[11px] text-stone-500 mt-0.5 font-mono">
              Cultivo: {getLotCrop(selectedLot) || 'Sin cultivo'} &bull; Superficie:{' '}
              {getLotSurface(selectedLot)} ha &bull; Campaña {currentCampaign.nombre}
            </p>
          </div>

          {lotSummaryItem && lotSummaryItem.marginPerHa !== null && (
            <div className="text-right shrink-0 bg-stone-100 px-2 py-1 rounded border border-stone-300">
              <span className="text-[9px] font-bold uppercase text-stone-500 block">
                Margen por hectárea
              </span>
              <span
                className={`text-xs font-extrabold font-mono tabular-nums block ${
                  lotSummaryItem.marginPerHa >= 0 ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {lotSummaryItem.marginPerHa >= 0 ? '+' : ''}
                {formatMoney(lotSummaryItem.marginPerHa)}/ha
              </span>
            </div>
          )}
        </div>

        {renderBalanceView(
          `Balance del Lote: ${selectedLot.nombre}`,
          `Ventas asignadas, gastos directos y labores de maquinaria en ${selectedLot.nombre}`,
          balanceLoteTree,
          `Reporte_Lote_${selectedLot.nombre}`
        )}
      </div>
    );
  }

  // ==========================================================================
  // SCREEN: POR CAMPAÑA (COMPACT LIST)
  // ==========================================================================
  if (currentScreen === 'campanas') {
    return (
      <div className="space-y-3 max-w-3xl mx-auto w-full">
        {renderBackButton()}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-700" />
              <span>Reportes por Campaña ({safeCampaigns.length})</span>
            </h2>
            <p className="text-[11px] text-stone-500">
              Histórico financiero consolidado ordenado de más reciente a más antigua
            </p>
          </div>

          <div className="flex items-center gap-0.5 bg-stone-100 p-0.5 rounded border border-stone-300 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveCurrency('BOB')}
              className={`px-2.5 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                activeCurrency === 'BOB'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Bs
            </button>
            <button
              type="button"
              onClick={() => setActiveCurrency('USD')}
              className={`px-2.5 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                activeCurrency === 'USD'
                  ? 'bg-white text-emerald-800 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              USD
            </button>
          </div>
        </div>

        <div className="border border-stone-300 bg-white rounded-sm shadow-2xs overflow-hidden divide-y divide-stone-200">
          <div className="bg-stone-100 px-2.5 py-1.5 flex items-center justify-between text-[11px] font-bold text-stone-700 uppercase tracking-wider">
            <span>Campaña Agrícola / Período</span>
            <span>Resultado Consolidado ({activeCurrency})</span>
          </div>

          {campaignsSummary.map(({ campaign: c, totalIncome, totalExpense, result: cRes }) => {
            const isPositive = cRes >= 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelectedCampaignDetailId(String(c.id));
                  setCurrentScreen('campana_detail');
                }}
                className="w-full flex items-center justify-between px-2.5 py-2 hover:bg-stone-50 transition cursor-pointer text-left group"
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-stone-900 group-hover:text-emerald-800 transition">
                      {c.nombre}
                    </span>
                    {c.activa && (
                      <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 rounded">
                        Activa
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-stone-500 mt-0.5">
                    Ingresos: {formatMoney(totalIncome)} &bull; Gastos: {formatMoney(totalExpense)}
                  </div>
                </div>

                <div className="text-right shrink-0 font-mono tabular-nums flex items-center gap-1.5">
                  <span
                    className={`text-xs font-bold block ${
                      isPositive ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {isPositive ? '+' : ''}
                    {formatMoney(cRes)}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-stone-400 group-hover:text-emerald-700" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ==========================================================================
  // SCREEN: REPORTE INDIVIDUAL DE CAMPAÑA (DETAIL BALANCE)
  // ==========================================================================
  if (currentScreen === 'campana_detail' && selectedCampaignDetail) {
    return (
      <div className="space-y-3 max-w-3xl mx-auto w-full">
        {renderBackButton()}

        <div className="flex justify-end no-print">
          <div className="flex items-center gap-0.5 bg-stone-100 p-0.5 rounded border border-stone-300">
            <button
              type="button"
              onClick={() => setActiveCurrency('BOB')}
              className={`px-2.5 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                activeCurrency === 'BOB'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Bs
            </button>
            <button
              type="button"
              onClick={() => setActiveCurrency('USD')}
              className={`px-2.5 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                activeCurrency === 'USD'
                  ? 'bg-white text-emerald-800 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              USD
            </button>
          </div>
        </div>

        {renderBalanceView(
          `Balance: ${selectedCampaignDetail.nombre}`,
          `Resultado consolidado de la campaña ${selectedCampaignDetail.nombre}`,
          balanceCampanaTree,
          `Balance_Campana_${selectedCampaignDetail.nombre}`
        )}
      </div>
    );
  }

  return null;
};

// ============================================================================
// EXPORTED COMPONENT WRAPPED WITH ERROR BOUNDARY
// ============================================================================
export const ReportsView: React.FC<Props> = (props) => {
  return (
    <ReportsErrorBoundary>
      <FinanzasViewInner {...props} />
    </ReportsErrorBoundary>
  );
};
