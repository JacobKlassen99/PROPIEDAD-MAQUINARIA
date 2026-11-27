import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Edit2,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  Campaign,
  Currency,
  Customer,
  ExchangeRateConfig,
  HarvestRecord,
  HarvestSale,
  HarvestSaleStatus,
  ItemConfig,
  Lot,
  PaymentSettings,
  WarehouseProductSummary,
} from '../types';
import * as backend from '../services/backend';
import { cacheKeys, getCachedQuery, revalidateQuery } from '../services/dataCache';
import { fetchNormalizedHarvestSalesBundle } from '../services/preloader';
import { usePersistedMemoryState } from '../hooks/useSwrQuery';
import {
  HARVEST_AVAILABILITY_EPSILON,
  buildWarehouseProductKey,
  buildWarehouseSummaries,
  computeHarvestAvailability,
  computeProportionalDistribution,
  formatSaleOriginSummary,
} from '../services/harvestAvailability';
import { getHarvestProductDisplay } from '../services/agriculturalProducts';
import { addDaysToIso, round2 } from '../services/interestEngine';
import { useI18n } from '../services/i18n';
import { VisualIcon } from '../components/VisualIcon';
import { CustomerPicker } from '../components/CustomerPicker';
import { ObservationField } from '../components/ObservationField';
import { Switch } from '../components/Switch';
import { formatDateLocale, formatMoneyLocale, formatNumberLocale, formatPercentMax1 } from '../services/formatters';

interface HarvestSalesViewProps {
  customers: Customer[];
  campaigns: Campaign[];
  lots: Lot[];
  itemsConfig: ItemConfig[];
  exchangeRate: ExchangeRateConfig | null;
  paymentSettings: PaymentSettings | null;
  activeCampaignId?: string;
  isAdmin?: boolean;
  initialAvailableHarvests?: HarvestRecord[];
  onBack: () => void;
  onDataMutated?: () => Promise<void> | void;
}

type SaleScreen = 'list' | 'warehouse_detail' | 'detail' | 'form';
type ListTab = 'sales' | 'warehouse';

function todayIso(): string {
  return backend.getBoliviaTodayIso();
}

function toInputIso(dateStr?: string): string {
  return backend.toBoliviaIsoDate(dateStr, true);
}

function makeSaleIdempotencyKey(): string {
  return `hs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const HarvestSalesView: React.FC<HarvestSalesViewProps> = ({
  customers,
  campaigns,
  lots,
  itemsConfig,
  exchangeRate,
  paymentSettings,
  isAdmin,
  initialAvailableHarvests,
  onBack,
  onDataMutated,
}) => {
  const { lang, t, bi } = useI18n();
  const effectiveIsAdmin = isAdmin ?? backend.hasAdminAuthorization();
  const fmtNum = useCallback((val: number, decimals = 2) => formatNumberLocale(val, lang, decimals), [lang]);
  const fmtMoney = useCallback((val: number, curr: Currency) => formatMoneyLocale(val, curr, lang), [lang]);
  const fmtDate = useCallback((dateStr?: string) => formatDateLocale(dateStr, lang), [lang]);

  const cached = getCachedQuery<{ sales: HarvestSale[]; harvests: HarvestRecord[] }>(
    cacheKeys.harvestSalesList('all')
  );
  const initialCachedBundle = cached?.data ?? null;
  const initialHarvestSeed =
    initialCachedBundle && initialCachedBundle.harvests.length > 0
      ? initialCachedBundle.harvests
      : initialAvailableHarvests || [];

  const [sales, setSales] = useState<HarvestSale[]>(initialCachedBundle?.sales || []);
  const [harvests, setHarvests] = useState<HarvestRecord[]>(initialHarvestSeed);
  const [hasLoaded, setHasLoaded] = useState<boolean>(Boolean(initialCachedBundle));
  const [loading, setLoading] = useState<boolean>(!initialCachedBundle);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [screen, setScreen] = useState<SaleScreen>('list');
  const [rawListTab, setRawListTab] = usePersistedMemoryState<string>('harvestSales.listTab', 'sales');
  const listTab: ListTab = rawListTab === 'warehouse' || rawListTab === 'harvests' ? 'warehouse' : 'sales';
  const setListTab = useCallback((tab: ListTab) => setRawListTab(tab), [setRawListTab]);

  const [search, setSearch] = usePersistedMemoryState<string>('harvestSales.search', '');
  const [statusFilter, setStatusFilter] = usePersistedMemoryState<HarvestSaleStatus | 'ALL'>('harvestSales.statusFilter', 'ALL');
  const [campaignFilter, setCampaignFilter] = usePersistedMemoryState<string>('harvestSales.campaignFilter', 'all');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [selectedProductKey, setSelectedProductKey] = useState<string | null>(null);

  // Create / Edit Form state (warehouse product mode)
  const [editingSale, setEditingSale] = useState<HarvestSale | null>(null);
  const [formProductKey, setFormProductKey] = useState('');
  const [formDate, setFormDate] = useState(todayIso);
  const [formCantidad, setFormCantidad] = useState('');
  const [formClienteId, setFormClienteId] = useState('');
  const [formCompradorPendiente, setFormCompradorPendiente] = useState(true);
  const [formPrecioPendiente, setFormPrecioPendiente] = useState(false);
  const [formPrecioUnitario, setFormPrecioUnitario] = useState('');
  const [formMoneda, setFormMoneda] = useState<Currency>('USD');
  const [formTc, setFormTc] = useState<string>(() =>
    String(exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0 ? exchangeRate.tasaBobPerUsd : 6.96)
  );
  const [formPlazoDias, setFormPlazoDias] = useState<string>('');
  const [formFechaVencimiento, setFormFechaVencimiento] = useState<string>('');
  const [formAplicarInteres, setFormAplicarInteres] = useState<boolean>(false);
  const [formTasaInteres, setFormTasaInteres] = useState<string>('');
  const [formObs, setFormObs] = useState('');
  const [wasAlreadyComplete, setWasAlreadyComplete] = useState(false);
  const [termsAutoLoaded, setTermsAutoLoaded] = useState(false);
  const [termsBaseDate, setTermsBaseDate] = useState<string>(todayIso);
  const [returnScreenAfterForm, setReturnScreenAfterForm] = useState<'list' | 'warehouse_detail' | 'detail'>('list');
  const idempotencyKeyRef = useRef<string>(makeSaleIdempotencyKey());

  const [saving, setSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancelSale, setConfirmCancelSale] = useState<HarvestSale | null>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadData = useCallback(async (forceFresh = false) => {
    const key = cacheKeys.harvestSalesList('all');
    const c = getCachedQuery<{ sales: HarvestSale[]; harvests: HarvestRecord[] }>(key);
    if (c?.data) {
      const reconciledCached = computeHarvestAvailability(c.data.harvests, c.data.sales);
      setSales(c.data.sales);
      setHarvests(reconciledCached);
      setHasLoaded(true);
      setLoading(false);
      setRefreshing(forceFresh);
    } else {
      setLoading(true);
      setRefreshing(false);
    }

    setLoadError(null);

    try {
      const normalizedBundle = await revalidateQuery(
        key,
        () => fetchNormalizedHarvestSalesBundle(!forceFresh),
        {
          force: forceFresh,
          minIntervalMs: 15_000,
        }
      );
      setSales(normalizedBundle.sales);
      setHarvests(normalizedBundle.harvests);
      setHasLoaded(true);
      setLoadError(null);
    } catch (err: any) {
      const errMsg =
        err?.message ||
        bi(
          'No se pudieron cargar las ventas y el almacén de cosechas. Verifica tu conexión e intenta nuevamente.',
          'Could not load sales and harvest warehouse. Check your connection and try again.'
        );
      if (!c?.data) {
        setLoadError(errMsg);
      } else {
        setNotice({ type: 'err', text: errMsg });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bi]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  useEffect(() => {
    if (
      campaignFilter !== 'all' &&
      campaigns.length > 0 &&
      !campaigns.some((c) => String(c.id) === String(campaignFilter))
    ) {
      setCampaignFilter('all');
    }
  }, [campaignFilter, campaigns, setCampaignFilter]);

  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach((c) => map.set(String(c.id), c));
    return map;
  }, [customers]);

  const lotMap = useMemo(() => {
    const map = new Map<string, Lot>();
    lots.forEach((l) => map.set(String(l.id), l));
    return map;
  }, [lots]);

  const campaignMap = useMemo(() => {
    const map = new Map<string, Campaign>();
    campaigns.forEach((c) => map.set(String(c.id), c));
    return map;
  }, [campaigns]);

  const resolveProductDisplay = useCallback(
    (record: { conceptoId?: string; producto?: string }) =>
      getHarvestProductDisplay(record, itemsConfig),
    [itemsConfig]
  );

  const resolveProductIcon = useCallback(
    (producto: string, conceptoId?: string): string => {
      const info = getHarvestProductDisplay({ conceptoId, producto }, itemsConfig);
      if (info.iconId) return info.iconId;
      const norm = String(info.displayName || producto || '').trim().toLowerCase();
      if (norm.includes('soya') || norm.includes('soja') || norm.includes('soy')) return 'soya';
      if (norm.includes('maiz') || norm.includes('maíz') || norm.includes('corn')) return 'maiz';
      if (norm.includes('sorgo')) return 'sorgo';
      if (norm.includes('trigo') || norm.includes('wheat')) return 'trigo';
      if (norm.includes('girasol') || norm.includes('sunflower')) return 'girasol';
      return 'granos';
    },
    [itemsConfig]
  );

  const resolveBuyerDisplay = useCallback(
    (sale: HarvestSale): string => {
      if (sale.clienteId && customerMap.has(String(sale.clienteId))) {
        return customerMap.get(String(sale.clienteId))!.nombre;
      }
      if (!sale.compradorPendiente && sale.clienteNombre) {
        return sale.clienteNombre;
      }
      return t('harvestSales.pendingBuyer');
    },
    [customerMap, t]
  );

  const statusLabel = useCallback(
    (st: HarvestSaleStatus): { text: string; tone: string } => {
      switch (st) {
        case 'COMPRADOR_Y_PRECIO_PENDIENTES':
          return { text: t('harvestSales.statusBothPending'), tone: 'text-amber-700' };
        case 'COMPRADOR_PENDIENTE':
          return { text: t('harvestSales.statusBuyerPending'), tone: 'text-amber-700' };
        case 'PRECIO_PENDIENTE':
          return { text: t('harvestSales.statusPricePending'), tone: 'text-amber-700' };
        case 'VENTA_COMPLETA':
        default:
          return { text: t('harvestSales.statusComplete'), tone: 'text-[#1D704B]' };
      }
    },
    [t]
  );

  // General Harvest Warehouse across ALL lots & ALL campaigns (prior-campaign stock stays available until sold)
  const warehouseSummaries = useMemo<WarehouseProductSummary[]>(
    () => buildWarehouseSummaries(harvests, sales, lots, campaigns, undefined, itemsConfig),
    [harvests, sales, lots, campaigns, itemsConfig]
  );

  const warehouseProductsWithStock = useMemo(
    () => warehouseSummaries.filter((p) => p.totalDisponible > HARVEST_AVAILABILITY_EPSILON),
    [warehouseSummaries]
  );

  const selectedWarehouseProduct = useMemo(
    () => warehouseSummaries.find((p) => p.key === selectedProductKey) || null,
    [warehouseSummaries, selectedProductKey]
  );

  const activeSales = useMemo(() => {
    const targetCamp = campaignFilter && campaignFilter !== 'all' ? String(campaignFilter).trim() : '';
    return sales
      .filter((s) => {
        if (s.anulada) return false;
        if (!targetCamp) return true;
        if (String(s.campanaId || '').trim() === targetCamp) return true;
        if (Array.isArray(s.distribuciones) && s.distribuciones.length > 0) {
          return s.distribuciones.some((d) => !d.anulada && String(d.campanaId || '').trim() === targetCamp);
        }
        return false;
      })
      .sort((a, b) => backend.compareChronologicalDesc(a, b));
  }, [sales, campaignFilter]);

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeSales.filter((s) => {
      if (statusFilter !== 'ALL' && s.estado !== statusFilter) return false;
      if (!q) return true;
      const buyer = resolveBuyerDisplay(s);
      const origin = formatSaleOriginSummary(s, lang);
      const lotNames = (s.distribuciones || [])
        .map((d) => d.loteNombre || lotMap.get(d.loteId)?.nombre || '')
        .join(' ');
      const campName = s.campanaNombre || campaignMap.get(s.campanaId)?.nombre || '';
      const prodDisplay = resolveProductDisplay(s).displayName || s.producto;
      return `${buyer} ${prodDisplay} ${s.producto} ${origin} ${lotNames} ${campName} ${s.fecha}`.toLowerCase().includes(q);
    });
  }, [activeSales, search, statusFilter, resolveBuyerDisplay, resolveProductDisplay, lang, lotMap, campaignMap]);

  const selectedSale = useMemo(
    () => sales.find((s) => s.id === selectedSaleId) || null,
    [sales, selectedSaleId]
  );

  const isBuyerDefined = !formCompradorPendiente && Boolean(formClienteId.trim());
  const parsedFormPrice = Number(String(formPrecioUnitario).replace(',', '.'));
  const isPriceDefined = !formPrecioPendiente && Number.isFinite(parsedFormPrice) && parsedFormPrice > 0;
  const canShowPaymentTerms = isBuyerDefined && isPriceDefined;

  // Auto-load default payment terms ONCE when a sale becomes complete (catalog buyer + valid price)
  useEffect(() => {
    if (screen !== 'form') return;
    if (!canShowPaymentTerms || termsAutoLoaded || wasAlreadyComplete) return;

    const completionDate = editingSale ? todayIso() : (formDate || todayIso());
    setTermsBaseDate(completionDate);

    const defaultPlazo =
      paymentSettings?.plazoDiasPredeterminado !== null && paymentSettings?.plazoDiasPredeterminado !== undefined
        ? Math.max(0, Math.round(Number(paymentSettings.plazoDiasPredeterminado)))
        : null;
    const defaultApplyInterest = Boolean(paymentSettings?.aplicarInteresPorDefecto);
    const defaultRate =
      paymentSettings?.porcentajeInteresMensual !== null && paymentSettings?.porcentajeInteresMensual !== undefined
        ? String(paymentSettings.porcentajeInteresMensual)
        : '';

    setFormPlazoDias(defaultPlazo !== null ? String(defaultPlazo) : '');
    setFormFechaVencimiento(defaultPlazo !== null ? addDaysToIso(completionDate, defaultPlazo) : '');
    setFormAplicarInteres(defaultApplyInterest);
    setFormTasaInteres(defaultRate);
    setTermsAutoLoaded(true);
  }, [screen, canShowPaymentTerms, termsAutoLoaded, wasAlreadyComplete, editingSale, formDate, paymentSettings]);

  const openCreateFormForProduct = (productKey?: string, returnTo: 'list' | 'warehouse_detail' = 'list') => {
    const targetProduct =
      (productKey ? warehouseProductsWithStock.find((p) => p.key === productKey) : null) ||
      warehouseProductsWithStock[0] ||
      null;
    const defaultTc =
      exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0 ? exchangeRate.tasaBobPerUsd : 6.96;
    const today = todayIso();

    idempotencyKeyRef.current = makeSaleIdempotencyKey();
    setReturnScreenAfterForm(returnTo);
    setEditingSale(null);
    setWasAlreadyComplete(false);
    setTermsAutoLoaded(false);
    setTermsBaseDate(today);
    setFormProductKey(targetProduct?.key || '');
    setFormDate(today);
    setFormCantidad('');
    setFormClienteId('');
    setFormCompradorPendiente(true);
    setFormPrecioPendiente(false);
    setFormPrecioUnitario('');
    setFormMoneda('USD');
    setFormTc(String(defaultTc));
    setFormPlazoDias('');
    setFormFechaVencimiento('');
    setFormAplicarInteres(false);
    setFormTasaInteres('');
    setFormObs('');
    setNotice(null);
    setScreen('form');
  };

  const openEditForm = (sale: HarvestSale) => {
    const isoDate = toInputIso(sale.fecha);
    const alreadyComplete =
      sale.estado === 'VENTA_COMPLETA' &&
      !sale.compradorPendiente &&
      Boolean(sale.clienteId) &&
      !sale.precioPendiente &&
      sale.precioUnitario > 0;
    const isoDue = alreadyComplete && sale.fechaVencimiento ? toInputIso(sale.fechaVencimiento) : '';
    const originalBase = alreadyComplete
      ? sale.fechaCompletado
        ? toInputIso(sale.fechaCompletado)
        : isoDate
      : todayIso();

    const resolvedEditProd = resolveProductDisplay(sale);
    setReturnScreenAfterForm('detail');
    setEditingSale(sale);
    setWasAlreadyComplete(alreadyComplete);
    setTermsAutoLoaded(alreadyComplete);
    setTermsBaseDate(originalBase);
    setFormProductKey(
      buildWarehouseProductKey(sale.producto, sale.unidad, resolvedEditProd.conceptoId || undefined)
    );
    setFormDate(isoDate);
    setFormCantidad(String(sale.cantidad));
    setFormClienteId(sale.clienteId || '');
    setFormCompradorPendiente(Boolean(sale.compradorPendiente || !sale.clienteId));
    setFormPrecioPendiente(Boolean(sale.precioPendiente));
    setFormPrecioUnitario(sale.precioPendiente ? '' : String(sale.precioUnitario));
    setFormMoneda(sale.moneda || 'USD');
    setFormTc(String(sale.tc > 0 ? sale.tc : exchangeRate?.tasaBobPerUsd || 6.96));
    if (alreadyComplete) {
      setFormPlazoDias(sale.plazoDias !== undefined && sale.plazoDias !== null ? String(sale.plazoDias) : '');
      setFormFechaVencimiento(isoDue);
      setFormAplicarInteres(Boolean(sale.aplicarInteres));
      setFormTasaInteres(sale.tasaInteresMensual > 0 ? String(sale.tasaInteresMensual) : '');
    } else {
      setFormPlazoDias('');
      setFormFechaVencimiento('');
      setFormAplicarInteres(false);
      setFormTasaInteres('');
    }
    setFormObs(sale.observacion || '');
    setNotice(null);
    setScreen('form');
  };

  const handleCurrencyToggle = (nextCurrency: Currency) => {
    if (nextCurrency === formMoneda) return;
    const tc = Number(String(formTc).replace(',', '.')) || 6.96;
    const curPrice = Number(String(formPrecioUnitario).replace(',', '.'));
    if (Number.isFinite(curPrice) && curPrice > 0 && tc > 0) {
      const converted = nextCurrency === 'BOB' ? curPrice * tc : curPrice / tc;
      setFormPrecioUnitario(String(round2(converted)));
    }
    setFormMoneda(nextCurrency);
  };

  const handlePlazoChange = (val: string) => {
    setFormPlazoDias(val);
    const n = Number(val);
    const base = wasAlreadyComplete
      ? termsBaseDate
      : editingSale
      ? todayIso()
      : formDate || todayIso();
    if (val.trim() !== '' && Number.isFinite(n) && n >= 0 && base) {
      setFormFechaVencimiento(addDaysToIso(base, Math.round(n)));
    } else if (val.trim() === '') {
      setFormFechaVencimiento('');
    }
  };

  const selectedFormProduct = useMemo(
    () => warehouseSummaries.find((p) => p.key === formProductKey) || null,
    [warehouseSummaries, formProductKey]
  );

  const formUnitLabel = editingSale?.unidad || selectedFormProduct?.unidad || 't';

  const maxAllowedTons = useMemo(() => {
    if (editingSale) {
      const currentAvail = selectedFormProduct?.totalDisponible || 0;
      return round2(currentAvail + editingSale.cantidad);
    }
    return round2(selectedFormProduct?.totalDisponible || 0);
  }, [editingSale, selectedFormProduct]);

  const parsedFormQty = useMemo(() => {
    const v = Number(String(formCantidad).replace(',', '.'));
    return Number.isFinite(v) && v > 0 ? v : 0;
  }, [formCantidad]);

  const formLiveTotal = useMemo(() => {
    if (formPrecioPendiente) return 0;
    const price = Number(String(formPrecioUnitario).replace(',', '.'));
    if (!Number.isFinite(parsedFormQty) || !Number.isFinite(price) || parsedFormQty <= 0 || price <= 0) return 0;
    return round2(parsedFormQty * price);
  }, [formPrecioPendiente, parsedFormQty, formPrecioUnitario]);

  // Live proportional distribution preview (for new sales or delta on quantity increase during edit)
  const distributionPreview = useMemo(() => {
    if (!selectedFormProduct) return { rows: [], error: null as string | null };
    const price = formPrecioPendiente ? 0 : Number(String(formPrecioUnitario).replace(',', '.')) || 0;
    const tc = Number(String(formTc).replace(',', '.')) || 6.96;

    if (!editingSale) {
      if (parsedFormQty <= 0) return { rows: [], error: null };
      if (parsedFormQty > selectedFormProduct.totalDisponible + 0.0005) {
        return {
          rows: [],
          error: bi(
            `Supera el stock disponible (${fmtNum(selectedFormProduct.totalDisponible)} ${formUnitLabel}).`,
            `Exceeds available stock (${fmtNum(selectedFormProduct.totalDisponible)} ${formUnitLabel}).`
          ),
        };
      }
      try {
        const rows = computeProportionalDistribution(selectedFormProduct.cosechasDisponibles, parsedFormQty, {
          precioPendiente: formPrecioPendiente || price <= 0,
          precioUnitario: price,
          moneda: formMoneda,
          tc,
          lots,
          campaigns,
        });
        return { rows, error: null };
      } catch (e: any) {
        return { rows: [], error: e?.message || null };
      }
    }

    // Editing sale: if increasing quantity, preview distribution of the delta
    const delta = parsedFormQty - editingSale.cantidad;
    if (delta > HARVEST_AVAILABILITY_EPSILON) {
      if (delta > selectedFormProduct.totalDisponible + 0.0005) {
        return {
          rows: [],
          error: bi(
            `El incremento (+${fmtNum(delta)} ${formUnitLabel}) supera el stock disponible (${fmtNum(selectedFormProduct.totalDisponible)} ${formUnitLabel}).`,
            `Increase (+${fmtNum(delta)} ${formUnitLabel}) exceeds available stock (${fmtNum(selectedFormProduct.totalDisponible)} ${formUnitLabel}).`
          ),
        };
      }
      try {
        const rows = computeProportionalDistribution(selectedFormProduct.cosechasDisponibles, delta, {
          precioPendiente: formPrecioPendiente || price <= 0,
          precioUnitario: price,
          moneda: formMoneda,
          tc,
          lots,
          campaigns,
        });
        return { rows, error: null };
      } catch (e: any) {
        return { rows: [], error: e?.message || null };
      }
    }

    return { rows: [], error: null };
  }, [
    selectedFormProduct,
    editingSale,
    parsedFormQty,
    formPrecioPendiente,
    formPrecioUnitario,
    formMoneda,
    formTc,
    lots,
    campaigns,
    formUnitLabel,
    fmtNum,
    bi,
  ]);

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setNotice(null);

    if (!editingSale && !selectedFormProduct) {
      setNotice({
        type: 'err',
        text: bi('Selecciona un producto con stock disponible en almacén.', 'Select a product with available warehouse stock.'),
      });
      return;
    }

    const qty = Number(String(formCantidad).replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) {
      setNotice({
        type: 'err',
        text: bi('Ingresa una cantidad mayor a 0.', 'Enter a quantity greater than 0.'),
      });
      return;
    }
    if (qty > maxAllowedTons + 0.0005) {
      setNotice({
        type: 'err',
        text: bi(
          `La cantidad supera el stock disponible en almacén (${fmtNum(maxAllowedTons)} ${formUnitLabel}).`,
          `Quantity exceeds available warehouse stock (${fmtNum(maxAllowedTons)} ${formUnitLabel}).`
        ),
      });
      return;
    }

    const price = Number(String(formPrecioUnitario).replace(',', '.'));
    if (!formPrecioPendiente && (!Number.isFinite(price) || price <= 0)) {
      setNotice({
        type: 'err',
        text: bi(
          'Ingresa un precio por tonelada mayor a 0 o marca «Precio pendiente».',
          'Enter a unit price greater than 0 or mark "Pending price".'
        ),
      });
      return;
    }

    const tc = Number(String(formTc).replace(',', '.'));
    if (!Number.isFinite(tc) || tc <= 0) {
      setNotice({
        type: 'err',
        text: bi('El tipo de cambio debe ser mayor a 0.', 'Exchange rate must be greater than 0.'),
      });
      return;
    }

    const isSaleComplete = !formCompradorPendiente && Boolean(formClienteId.trim()) && !formPrecioPendiente && price > 0;
    const plazoNum =
      isSaleComplete && formPlazoDias.trim() !== '' ? Math.max(0, Math.round(Number(formPlazoDias))) : null;
    const effectiveFechaVencimiento = isSaleComplete ? formFechaVencimiento : '';
    const effectiveAplicarInteres = isSaleComplete ? formAplicarInteres : false;
    const tasaNum = effectiveAplicarInteres ? Number(String(formTasaInteres).replace(',', '.')) : 0;
    if (effectiveAplicarInteres && (!Number.isFinite(tasaNum) || tasaNum <= 0)) {
      setNotice({
        type: 'err',
        text: bi(
          'Ingresa una tasa mensual de interés mayor a 0 o desactiva el interés.',
          'Enter a monthly interest rate greater than 0 or disable interest.'
        ),
      });
      return;
    }

    setSaving(true);
    try {
      let saved: HarvestSale;
      if (editingSale) {
        saved = await backend.updateHarvestSale(editingSale.id, {
          fecha: formDate,
          cantidad: qty,
          clienteId: formCompradorPendiente ? '' : formClienteId,
          compradorPendiente: formCompradorPendiente || !formClienteId,
          precioPendiente: formPrecioPendiente,
          precioUnitario: formPrecioPendiente ? 0 : price,
          moneda: formMoneda,
          tc,
          plazoDias: plazoNum,
          fechaVencimiento: effectiveFechaVencimiento,
          aplicarInteres: effectiveAplicarInteres,
          tasaInteresMensual: tasaNum,
          observacion: formObs.trim(),
        });
      } else {
        saved = await backend.createHarvestSale({
          conceptoId: selectedFormProduct!.conceptoId,
          producto: selectedFormProduct!.producto,
          unidad: selectedFormProduct!.unidad,
          fecha: formDate,
          cantidad: qty,
          clienteId: formCompradorPendiente ? '' : formClienteId,
          compradorPendiente: formCompradorPendiente || !formClienteId,
          precioPendiente: formPrecioPendiente,
          precioUnitario: formPrecioPendiente ? 0 : price,
          moneda: formMoneda,
          tc,
          plazoDias: plazoNum,
          fechaVencimiento: effectiveFechaVencimiento,
          aplicarInteres: effectiveAplicarInteres,
          tasaInteresMensual: tasaNum,
          observacion: formObs.trim(),
          idempotencyKey: idempotencyKeyRef.current,
        });
      }

      idempotencyKeyRef.current = makeSaleIdempotencyKey();

      await Promise.all([
        loadData(true),
        onDataMutated ? Promise.resolve(onDataMutated()) : Promise.resolve(),
      ]);

      setNotice({
        type: 'ok',
        text: editingSale
          ? bi('Venta de cosecha actualizada correctamente.', 'Harvest sale updated successfully.')
          : bi('Venta registrada y distribuida proporcionalmente en el almacén.', 'Sale recorded and proportionally distributed from warehouse.'),
      });
      setSelectedSaleId(saved.id);
      setEditingSale(null);
      setScreen('detail');
    } catch (err: any) {
      setNotice({
        type: 'err',
        text: err?.message || bi('No se pudo guardar la venta de cosecha.', 'Could not save harvest sale.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelSaleConfirmed = async () => {
    if (!confirmCancelSale) return;
    const target = confirmCancelSale;
    setConfirmCancelSale(null);
    setCancellingId(target.id);
    setNotice(null);
    try {
      await backend.cancelHarvestSale(target.id);
      await Promise.all([
        loadData(true),
        onDataMutated ? Promise.resolve(onDataMutated()) : Promise.resolve(),
      ]);
      setNotice({
        type: 'ok',
        text: bi(
          'Venta anulada y toneladas devueltas a sus cosechas de origen.',
          'Sale cancelled and tons returned to source harvests.'
        ),
      });
      setSelectedSaleId(null);
      setScreen('list');
    } catch (err: any) {
      setNotice({
        type: 'err',
        text: err?.message || bi('No se pudo anular la venta.', 'Could not cancel sale.'),
      });
    } finally {
      setCancellingId(null);
    }
  };

  // -----------------------------------------------------------
  // SCREEN: WAREHOUSE PRODUCT DETAIL (BY LOT & CAMPAIGN)
  // -----------------------------------------------------------
  if (screen === 'warehouse_detail' && selectedWarehouseProduct) {
    const prod = selectedWarehouseProduct;
    const hasStock = prod.totalDisponible > HARVEST_AVAILABILITY_EPSILON;

    return (
      <div className="space-y-3.5">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E7ECE8]">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                setScreen('list');
                setSelectedProductKey(null);
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE2DD] bg-white text-[#26352D] hover:bg-[#F5F7F4] transition cursor-pointer"
              aria-label={t('common.back')}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="h-9 w-9 rounded-xl bg-[#EAF5EE] text-[#1D704B] flex items-center justify-center shrink-0">
              <VisualIcon iconId={resolveProductIcon(prod.producto, prod.conceptoId)} nameHint={prod.producto} category="ingreso" size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[#26352D] truncate leading-snug">{prod.producto}</h2>
              <p className="text-xs text-[#64746B] truncate">
                {bi('Almacén de cosechas', 'Harvest warehouse')} · {prod.lotesCount}{' '}
                {prod.lotesCount === 1 ? bi('lote', 'lot') : bi('lotes', 'lots')}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={!effectiveIsAdmin || !hasStock}
            onClick={() => openCreateFormForProduct(prod.key, 'warehouse_detail')}
            className="h-9 px-3.5 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0 disabled:opacity-45"
          >
            <span>{bi('Vender', 'Sell')}</span>
          </button>
        </div>

        {/* 3-metric summary: Total cosechado, Total vendido, Total disponible */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-[#E2E7E3] bg-white px-3 py-2.5">
            <p className="text-[11px] font-medium text-[#64746B] truncate">{bi('Cosechado', 'Harvested')}</p>
            <p className="text-sm font-extrabold text-[#1F2D25] tabular-nums mt-0.5 whitespace-nowrap">
              {fmtNum(prod.totalCosechado)} {prod.unidad}
            </p>
          </div>
          <div className="rounded-xl border border-[#E2E7E3] bg-white px-3 py-2.5">
            <p className="text-[11px] font-medium text-[#64746B] truncate">{bi('Vendido', 'Sold')}</p>
            <p className="text-sm font-extrabold text-[#1F2D25] tabular-nums mt-0.5 whitespace-nowrap">
              {fmtNum(prod.totalVendido)} {prod.unidad}
            </p>
          </div>
          <div className="rounded-xl border border-[#BFE0CD] bg-[#EAF5EE] px-3 py-2.5">
            <p className="text-[11px] font-semibold text-[#1D5C3F] truncate">{bi('Disponible', 'Available')}</p>
            <p className="text-sm font-extrabold text-[#175B3D] tabular-nums mt-0.5 whitespace-nowrap">
              {fmtNum(prod.totalDisponible)} {prod.unidad}
            </p>
          </div>
        </div>

        {/* Breakdown by lot & campaign */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#5E6D64]">
              {bi('Desglose por lote y campaña', 'Breakdown by lot & campaign')}
            </h3>
            <span className="text-[11px] font-semibold text-[#5E6D64] tabular-nums">
              {formatPercentMax1(prod.porcentajeVendido, lang)} {bi('vendido', 'sold')}
            </span>
          </div>

          <div className="rounded-2xl border border-[#E2E7E3] bg-white divide-y divide-[#EEF2EF] overflow-hidden">
            {prod.lotes.map((row) => {
              const barPct = Math.min(100, Math.max(0, row.porcentajeVendido));
              return (
                <div key={row.key} className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#1F2D25] truncate leading-snug">{row.loteNombre}</p>
                      <p className="text-xs text-[#64746B] truncate">{row.campanaNombre}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-extrabold text-[#1D704B] tabular-nums whitespace-nowrap">
                        {fmtNum(row.disponible)} {prod.unidad} {bi('disp.', 'avail.')}
                      </p>
                      <p className="text-[11px] font-semibold text-[#5E6D64] tabular-nums whitespace-nowrap">
                        {formatPercentMax1(row.porcentajeVendido, lang)} {bi('vendido', 'sold')}
                      </p>
                    </div>
                  </div>

                  {/* Green horizontal progress bar (% vendido = sold / harvested * 100) */}
                  <div className="h-2 w-full rounded-full bg-[#E8EFEA] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#24875B] transition-all duration-300"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px] text-[#5E6D64] tabular-nums flex-wrap">
                    <span>
                      {bi('Cosechado:', 'Harvested:')} <strong className="text-[#1F2D25]">{fmtNum(row.cosechado)} {prod.unidad}</strong>
                      {' · '}
                      {bi('Vendido:', 'Sold:')} <strong className="text-[#1F2D25]">{fmtNum(row.vendido)} {prod.unidad}</strong>
                    </span>
                    {row.disponible > HARVEST_AVAILABILITY_EPSILON && (
                      <span className="text-[#1D704B] font-semibold">
                        {formatPercentMax1(row.participacionStockPct, lang)} {bi('del stock actual', 'of current stock')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------
  // SCREEN: CREATE / EDIT HARVEST SALE (FROM WAREHOUSE)
  // -----------------------------------------------------------
  if (screen === 'form') {
    const editQtyDelta = editingSale ? round2(parsedFormQty - editingSale.cantidad) : 0;
    const editProdDisplay = editingSale ? resolveProductDisplay(editingSale).displayName || editingSale.producto : '';
    const headerSub = editingSale
      ? `${editProdDisplay} · ${formatSaleOriginSummary(editingSale, lang) || editingSale.loteNombre || ''}`
      : selectedFormProduct
      ? `${selectedFormProduct.producto} · ${fmtNum(selectedFormProduct.totalDisponible)} ${selectedFormProduct.unidad} ${bi('disponibles', 'available')}`
      : '';

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-[#E7ECE8]">
          <button
            type="button"
            onClick={() => {
              setScreen(returnScreenAfterForm);
              setNotice(null);
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE2DD] bg-white text-[#26352D] hover:bg-[#F5F7F4] transition cursor-pointer"
            aria-label={t('common.back')}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#26352D] leading-snug">
              {editingSale ? t('harvestSales.editSale') : t('harvestSales.newSale')}
            </h2>
            {headerSub && <p className="text-xs text-[#64746B] truncate">{headerSub}</p>}
          </div>
        </div>

        {notice && (
          <div
            className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium flex items-start gap-2 ${
              notice.type === 'ok'
                ? 'border-[#24875B]/30 bg-[#EAF5EE] text-[#1D5C3F]'
                : 'border-[#C44545]/30 bg-[#FCECEC] text-[#962D2D]'
            }`}
          >
            {notice.type === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[#24875B]" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#C44545]" />
            )}
            <span>{notice.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveSale} className="rounded-2xl border border-[#E2E7E3] bg-white p-4 space-y-3.5">
          {/* 1. Producto desde Almacén (solo al crear) */}
          {!editingSale ? (
            <div className="space-y-1.5">
              <label className="block text-[13px] font-semibold text-[#26352D]">
                {bi('Producto en almacén', 'Warehouse product')}
                <span className="text-[#C44545] ml-0.5">*</span>
              </label>
              <select
                value={formProductKey}
                onChange={(e) => {
                  setFormProductKey(e.target.value);
                  setFormCantidad('');
                }}
                required
                className="w-full h-[40px] rounded-xl border border-[#CFD8D2] bg-white px-3 text-sm font-semibold text-[#1F2D25] focus:border-[#24875B] focus:outline-none"
              >
                <option value="">{bi('Seleccionar producto...', 'Select product...')}</option>
                {warehouseProductsWithStock.map((prod) => (
                  <option key={prod.key} value={prod.key}>
                    {`${prod.producto} — ${fmtNum(prod.totalDisponible)} ${prod.unidad} (${prod.lotesDisponiblesCount} ${
                      prod.lotesDisponiblesCount === 1 ? bi('lote', 'lot') : bi('lotes', 'lots')
                    })`}
                  </option>
                ))}
              </select>
              {selectedFormProduct && (
                <div className="flex items-center justify-between rounded-xl bg-[#EAF5EE] border border-[#BFE0CD] px-3 py-2 text-xs">
                  <span className="font-semibold text-[#1D5C3F]">
                    {bi('Disponible en almacén', 'Available in warehouse')}
                  </span>
                  <span className="font-extrabold text-[#175B3D] tabular-nums">
                    {fmtNum(selectedFormProduct.totalDisponible)} {selectedFormProduct.unidad}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-[#F5F8F6] border border-[#E2E7E3] px-3 py-2.5 flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <span className="text-[#64746B] block">{bi('Producto', 'Product')}</span>
                <span className="font-bold text-[#1F2D25]">{editProdDisplay}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[#64746B] block">{bi('Máx. vendible', 'Max sellable')}</span>
                <span className="font-bold text-[#1D704B] tabular-nums">
                  {fmtNum(maxAllowedTons)} {formUnitLabel}
                </span>
              </div>
            </div>
          )}

          {/* 2. Cantidad a vender y Fecha */}
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-2.5 items-end">
              <div className="min-w-0">
                <label className="block text-[13px] font-semibold text-[#26352D] mb-1 whitespace-nowrap truncate">
                  {bi(`Cantidad (${formUnitLabel})`, `Quantity (${formUnitLabel})`)}
                  <span className="text-[#C44545] ml-0.5">*</span>
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0.0001"
                  max={maxAllowedTons > 0 ? maxAllowedTons : undefined}
                  value={formCantidad}
                  onChange={(e) => setFormCantidad(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full h-[40px] rounded-xl border border-[#CFD8D2] bg-white px-3 text-sm font-semibold text-[#1F2D25] tabular-nums focus:border-[#24875B] focus:outline-none"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-[13px] font-semibold text-[#26352D] mb-1 whitespace-nowrap truncate">
                  {t('common.date')}
                  <span className="text-[#C44545] ml-0.5">*</span>
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => {
                    const nextDate = e.target.value;
                    setFormDate(nextDate);
                    if (!editingSale && canShowPaymentTerms && formPlazoDias.trim() !== '' && !isNaN(Number(formPlazoDias))) {
                      setTermsBaseDate(nextDate);
                      setFormFechaVencimiento(addDaysToIso(nextDate, Math.round(Number(formPlazoDias))));
                    }
                  }}
                  required
                  className="w-full h-[40px] rounded-xl border border-[#CFD8D2] bg-white px-2.5 text-sm font-medium text-[#1F2D25] tabular-nums focus:border-[#24875B] focus:outline-none"
                />
              </div>
            </div>
            {distributionPreview.error && (
              <p className="text-[11px] font-semibold text-[#C44545]">{distributionPreview.error}</p>
            )}
          </div>

          {/* 3. Comprador */}
          <CustomerPicker
            label={bi('Comprador', 'Buyer')}
            customers={customers}
            selectedCustomerId={formCompradorPendiente ? '' : formClienteId}
            isPending={formCompradorPendiente}
            allowPending
            pendingLabel={t('harvestSales.pendingBuyer')}
            placeholder={bi('Seleccionar comprador', 'Select buyer')}
            onSelectCustomer={(c) => {
              setFormClienteId(c.id);
              setFormCompradorPendiente(false);
            }}
            onSelectPending={() => {
              setFormClienteId('');
              setFormCompradorPendiente(true);
              if (!wasAlreadyComplete) {
                setTermsAutoLoaded(false);
                setFormPlazoDias('');
                setFormFechaVencimiento('');
                setFormAplicarInteres(false);
                setFormTasaInteres('');
              }
            }}
            required
          />

          {/* 4. Casilla «Precio pendiente» */}
          <div className="pt-0.5">
            <label className="inline-flex items-center gap-2.5 cursor-pointer select-none min-h-[36px]">
              <input
                type="checkbox"
                checked={formPrecioPendiente}
                onChange={(e) => {
                  const nextPending = e.target.checked;
                  setFormPrecioPendiente(nextPending);
                  if (nextPending && !wasAlreadyComplete) {
                    setTermsAutoLoaded(false);
                    setFormPlazoDias('');
                    setFormFechaVencimiento('');
                    setFormAplicarInteres(false);
                    setFormTasaInteres('');
                  }
                }}
                className="h-4 w-4 rounded border-[#B9C8BF] text-[#24875B] focus:ring-[#24875B]"
              />
              <span className="text-sm font-semibold text-[#26352D]">
                {t('harvestSales.pendingPrice')}
              </span>
            </label>
          </div>

          {/* 5. Moneda (USD / Bs), Precio / t y TC alineados, e Importe total */}
          {!formPrecioPendiente && (
            <div className="space-y-3 rounded-xl border border-[#E7ECE8] bg-[#F9FBF9] p-3">
              <Switch<Currency>
                label={t('common.currency')}
                value={formMoneda}
                onChange={handleCurrencyToggle}
                leftOption={{ value: 'USD', label: 'USD' }}
                rightOption={{ value: 'BOB', label: 'Bs' }}
              />

              <div className="grid grid-cols-2 gap-2.5 items-end">
                <div className="min-w-0">
                  <label className="block text-[13px] font-semibold text-[#26352D] mb-1 whitespace-nowrap truncate">
                    {bi(`Precio / ${formUnitLabel}`, `Price / ${formUnitLabel}`)}
                    <span className="text-[#C44545] ml-0.5">*</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    value={formPrecioUnitario}
                    onChange={(e) => setFormPrecioUnitario(e.target.value)}
                    required={!formPrecioPendiente}
                    placeholder="0.00"
                    className="w-full h-[40px] rounded-xl border border-[#CFD8D2] bg-white px-3 text-sm font-semibold text-[#1F2D25] tabular-nums focus:border-[#24875B] focus:outline-none"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-[13px] font-semibold text-[#26352D] mb-1 whitespace-nowrap truncate">
                    {bi('TC (Bs/USD)', 'FX (Bs/USD)')}
                    <span className="text-[#C44545] ml-0.5">*</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    value={formTc}
                    onChange={(e) => setFormTc(e.target.value)}
                    required
                    className="w-full h-[40px] rounded-xl border border-[#CFD8D2] bg-white px-3 text-sm font-semibold text-[#1F2D25] tabular-nums focus:border-[#24875B] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-[#E2E7E3]">
                <span className="text-xs font-semibold text-[#4B5A52]">
                  {bi('Importe total', 'Total amount')}
                </span>
                <span className="text-base font-extrabold text-[#175B3D] tabular-nums whitespace-nowrap text-right">
                  {fmtMoney(formLiveTotal, formMoneda)}
                </span>
              </div>
            </div>
          )}

          {/* 6. Condiciones de cobro (ÚNICAMENTE cuando comprador del catálogo Y precio estén definidos) */}
          {canShowPaymentTerms && (
            <div className="rounded-xl border border-[#E7ECE8] bg-[#F9FBF9] p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[#5E6D64]">
                  {bi('Condiciones de cobro', 'Payment terms')}
                </p>
                {editingSale && !wasAlreadyComplete && (
                  <span className="text-[11px] font-semibold text-[#1D704B]">
                    {bi('Plazo desde hoy', 'Term starts today')}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5 items-end">
                <div className="min-w-0">
                  <label className="block text-[13px] font-semibold text-[#26352D] mb-1 whitespace-nowrap truncate">
                    {bi('Plazo (días)', 'Term (days)')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formPlazoDias}
                    onChange={(e) => handlePlazoChange(e.target.value)}
                    placeholder={bi('Opcional', 'Optional')}
                    className="w-full h-[40px] rounded-xl border border-[#CFD8D2] bg-white px-3 text-sm font-medium text-[#1F2D25] tabular-nums focus:border-[#24875B] focus:outline-none"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-[13px] font-semibold text-[#26352D] mb-1 whitespace-nowrap truncate">
                    {bi('Vencimiento', 'Due date')}
                  </label>
                  <input
                    type="date"
                    value={formFechaVencimiento}
                    onChange={(e) => setFormFechaVencimiento(e.target.value)}
                    className="w-full h-[40px] rounded-xl border border-[#CFD8D2] bg-white px-2.5 text-sm font-medium text-[#1F2D25] tabular-nums focus:border-[#24875B] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-1 border-t border-[#E7ECE8] space-y-2.5">
                <Switch<boolean>
                  inline
                  label={bi('Aplicar interés por mora', 'Apply late interest')}
                  value={formAplicarInteres}
                  onChange={setFormAplicarInteres}
                />

                {formAplicarInteres && (
                  <div>
                    <label className="block text-[13px] font-semibold text-[#26352D] mb-1 whitespace-nowrap truncate">
                      {bi('Interés mensual (%)', 'Monthly interest (%)')}
                      <span className="text-[#C44545] ml-0.5">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formTasaInteres}
                      onChange={(e) => setFormTasaInteres(e.target.value)}
                      placeholder="0.00"
                      className="w-full h-[40px] rounded-xl border border-[#CFD8D2] bg-white px-3 text-sm font-semibold text-[#1F2D25] tabular-nums focus:border-[#24875B] focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 7. Vista previa compacta de distribución proporcional automática */}
          {!editingSale && distributionPreview.rows.length > 0 && (
            <div className="rounded-xl border border-[#D4E6DC] bg-[#F5FBF7] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-[#1D5C3F]">
                  {bi('Distribución proporcional automática', 'Automatic proportional distribution')}
                </p>
                <span className="text-[11px] font-semibold text-[#24875B] tabular-nums">
                  {distributionPreview.rows.length}{' '}
                  {distributionPreview.rows.length === 1 ? bi('origen', 'source') : bi('orígenes', 'sources')}
                </span>
              </div>
              <div className="divide-y divide-[#DFECE4]">
                {distributionPreview.rows.map((r) => (
                  <div key={r.cosechaId} className="py-1.5 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#1F2D25] truncate">{r.loteNombre}</p>
                      <p className="text-[11px] text-[#5E6D64] truncate">
                        {r.campanaNombre} · {formatPercentMax1(r.participacionPct, lang)}
                      </p>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <p className="font-bold text-[#1F2D25] whitespace-nowrap">
                        {fmtNum(r.toneladasAsignadas)} {r.unidad}
                      </p>
                      {!formPrecioPendiente && r.importeAsignado > 0 && (
                        <p className="text-[11px] font-semibold text-[#1D704B] whitespace-nowrap">
                          {fmtMoney(r.importeAsignado, r.moneda)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nota de distribución al editar */}
          {editingSale && (
            <div className="rounded-xl border border-[#E2E7E3] bg-[#F8FAF8] px-3 py-2.5 text-xs text-[#4B5A52] space-y-1.5">
              {Math.abs(editQtyDelta) <= HARVEST_AVAILABILITY_EPSILON ? (
                <p>
                  {bi(
                    'La distribución física entre lotes de origen se conservará intacta; solo se actualizarán los datos comerciales y montos.',
                    'The physical distribution across source lots will remain unchanged; only commercial terms and amounts will update.'
                  )}
                </p>
              ) : editQtyDelta < 0 ? (
                <p>
                  {bi(
                    `La reducción (${fmtNum(Math.abs(editQtyDelta))} ${formUnitLabel}) se devolverá proporcionalmente a las cosechas de origen de esta venta.`,
                    `The reduction (${fmtNum(Math.abs(editQtyDelta))} ${formUnitLabel}) will be returned proportionally to this sale's source harvests.`
                  )}
                </p>
              ) : (
                <>
                  <p>
                    {bi(
                      `Se conservará la distribución original (${fmtNum(editingSale.cantidad)} ${formUnitLabel}) y el incremento (+${fmtNum(editQtyDelta)} ${formUnitLabel}) se distribuirá proporcionalmente sobre el stock disponible actual:`,
                      `Original allocation (${fmtNum(editingSale.cantidad)} ${formUnitLabel}) will be preserved and only the increase (+${fmtNum(editQtyDelta)} ${formUnitLabel}) will be proportionally distributed over current available stock:`
                    )}
                  </p>
                  {distributionPreview.rows.length > 0 && (
                    <div className="divide-y divide-[#E4EAE6] pt-1">
                      {distributionPreview.rows.map((r) => (
                        <div key={r.cosechaId} className="py-1 flex items-center justify-between gap-2 text-[11px]">
                          <span className="truncate text-[#26352D] font-medium">
                            {r.loteNombre} ({r.campanaNombre})
                          </span>
                          <span className="font-bold text-[#1D704B] tabular-nums whitespace-nowrap">
                            +{fmtNum(r.toneladasAsignadas)} {r.unidad}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 8. Observación */}
          <ObservationField
            value={formObs}
            onChange={setFormObs}
            placeholder={bi('Observación de la venta...', 'Sale observation...')}
          />

          {/* 9. Botones */}
          <div className="pt-1 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setScreen(returnScreenAfterForm);
                setNotice(null);
              }}
              className="h-[40px] px-4 rounded-xl border border-[#CFD8D2] bg-white text-sm font-semibold text-[#4B5A52] hover:bg-[#F5F7F4] cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || Boolean(distributionPreview.error)}
              className="h-[40px] px-5 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white text-sm font-bold inline-flex items-center gap-2 transition cursor-pointer disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{saving ? t('common.saving') : t('common.save')}</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  // -----------------------------------------------------------
  // SCREEN: HARVEST SALE DETAIL (WITH DISTRIBUTION BREAKDOWN)
  // -----------------------------------------------------------
  if (screen === 'detail' && selectedSale) {
    const buyer = resolveBuyerDisplay(selectedSale);
    const st = statusLabel(selectedSale.estado);
    const originSummary =
      formatSaleOriginSummary(selectedSale, lang) ||
      selectedSale.loteNombre ||
      lotMap.get(selectedSale.loteId)?.nombre ||
      '—';
    const activeDists = (selectedSale.distribuciones || []).filter((d) => !d.anulada && d.toneladasAsignadas > 0);
    const campName =
      selectedSale.campanaNombre ||
      campaignMap.get(selectedSale.campanaId)?.nombre ||
      (activeDists.length === 1 ? activeDists[0].campanaNombre || campaignMap.get(activeDists[0].campanaId)?.nombre : '') ||
      '';

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E7ECE8]">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                setScreen('list');
                setSelectedSaleId(null);
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE2DD] bg-white text-[#26352D] hover:bg-[#F5F7F4] transition cursor-pointer"
              aria-label={t('common.back')}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[#26352D] truncate">{buyer}</h2>
              <p className={`text-xs font-semibold ${st.tone}`}>{st.text}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openEditForm(selectedSale)}
            className="h-9 px-3 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>{t('harvestSales.editSale')}</span>
          </button>
        </div>

        {notice && (
          <div
            className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium flex items-start gap-2 ${
              notice.type === 'ok'
                ? 'border-[#24875B]/30 bg-[#EAF5EE] text-[#1D5C3F]'
                : 'border-[#C44545]/30 bg-[#FCECEC] text-[#962D2D]'
            }`}
          >
            {notice.type === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[#24875B]" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#C44545]" />
            )}
            <span>{notice.text}</span>
          </div>
        )}

        <div className="rounded-2xl border border-[#E2E7E3] bg-white p-4 space-y-3">
          <div className="flex items-center gap-3 pb-3 border-b border-[#EEF2EF]">
            <div className="h-10 w-10 rounded-xl bg-[#EAF5EE] text-[#1D704B] flex items-center justify-center shrink-0">
              <VisualIcon
                iconId={resolveProductIcon(selectedSale.producto, selectedSale.conceptoId)}
                nameHint={resolveProductDisplay(selectedSale).displayName || selectedSale.producto}
                category="ingreso"
                size={24}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#1F2D25] truncate">
                {resolveProductDisplay(selectedSale).displayName || selectedSale.producto}
              </p>
              <p className="text-xs text-[#64746B] truncate">
                {[originSummary, campName, fmtDate(selectedSale.fecha)].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-extrabold text-[#1F2D25] tabular-nums whitespace-nowrap">
                {fmtNum(selectedSale.cantidad)} {selectedSale.unidad || 't'}
              </p>
              {!selectedSale.precioPendiente && (
                <p className="text-xs font-bold text-[#1D704B] tabular-nums whitespace-nowrap">
                  {fmtMoney(selectedSale.importeTotal, selectedSale.moneda)}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[#7A8780] block">{bi('Comprador', 'Buyer')}</span>
              <span className="font-bold text-[#1F2D25]">{buyer}</span>
            </div>
            <div>
              <span className="text-[#7A8780] block">{bi('Precio unitario', 'Unit price')}</span>
              <span className="font-bold text-[#1F2D25] tabular-nums whitespace-nowrap">
                {selectedSale.precioPendiente
                  ? t('harvestSales.pendingPrice')
                  : `${fmtMoney(selectedSale.precioUnitario, selectedSale.moneda)} / ${selectedSale.unidad || 't'}`}
              </span>
            </div>
            <div>
              <span className="text-[#7A8780] block">{bi('Tipo de cambio', 'Exchange rate')}</span>
              <span className="text-[#26352D] font-medium tabular-nums">{fmtNum(selectedSale.tc)}</span>
            </div>
            <div>
              <span className="text-[#7A8780] block">{bi('Vencimiento', 'Due date')}</span>
              <span className="text-[#26352D] font-medium tabular-nums">
                {selectedSale.estado === 'VENTA_COMPLETA' && selectedSale.fechaVencimiento
                  ? fmtDate(selectedSale.fechaVencimiento)
                  : '—'}
              </span>
            </div>
            <div>
              <span className="text-[#7A8780] block">{bi('Interés por mora', 'Late interest')}</span>
              <span className="text-[#26352D] font-medium tabular-nums">
                {selectedSale.estado !== 'VENTA_COMPLETA'
                  ? '—'
                  : selectedSale.aplicarInteres && selectedSale.tasaInteresMensual > 0
                  ? `${fmtNum(selectedSale.tasaInteresMensual)}% ${bi('mensual', 'monthly')}`
                  : bi('Desactivado', 'Disabled')}
              </span>
            </div>
            <div>
              <span className="text-[#7A8780] block">{bi('Fecha de venta', 'Sale date')}</span>
              <span className="text-[#26352D] font-medium tabular-nums">{fmtDate(selectedSale.fecha)}</span>
            </div>
          </div>

          {/* Historical Proportional Distribution by Source Lot & Campaign */}
          {activeDists.length > 0 && (
            <div className="pt-3 border-t border-[#EEF2EF] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#26352D]">
                  {bi('Distribución por lote de origen', 'Distribution by source lot')}
                </span>
                <span className="text-[11px] font-semibold text-[#64746B] tabular-nums">
                  {activeDists.length}{' '}
                  {activeDists.length === 1 ? bi('lote', 'lot') : bi('lotes', 'lots')}
                </span>
              </div>
              <div className="rounded-xl border border-[#E7ECE8] bg-[#FAFBF9] divide-y divide-[#EEF2EF]">
                {activeDists.map((d, idx) => {
                  const dLot = d.loteNombre || lotMap.get(d.loteId)?.nombre || d.loteId || '—';
                  const dCamp = d.campanaNombre || campaignMap.get(d.campanaId)?.nombre || d.campanaId || '';
                  return (
                    <div key={d.id || `${d.cosechaId}_${idx}`} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold text-[#1F2D25] truncate">{dLot}</p>
                        <p className="text-[11px] text-[#64746B] truncate">
                          {[dCamp, formatPercentMax1(d.participacionPct, lang)].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="text-right shrink-0 tabular-nums">
                        <p className="font-bold text-[#1F2D25] whitespace-nowrap">
                          {fmtNum(d.toneladasAsignadas)} {d.unidad || selectedSale.unidad || 't'}
                        </p>
                        {!selectedSale.precioPendiente && d.importeAsignado > 0 && (
                          <p className="text-[11px] font-semibold text-[#1D704B] whitespace-nowrap">
                            {fmtMoney(d.importeAsignado, d.moneda || selectedSale.moneda)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedSale.observacion && (
            <div className="pt-2 border-t border-[#EEF2EF] text-xs">
              <span className="text-[#7A8780] block mb-0.5">{t('common.observation')}</span>
              <p className="text-[#26352D] leading-relaxed">{selectedSale.observacion}</p>
            </div>
          )}

          <div className="pt-2 border-t border-[#EEF2EF] flex items-center justify-end">
            <button
              type="button"
              disabled={cancellingId === selectedSale.id}
              onClick={() => setConfirmCancelSale(selectedSale)}
              className="h-9 px-3 rounded-xl border border-[#DCE2DD] bg-white hover:bg-[#FCECEC] hover:border-[#C44545]/40 text-xs font-bold text-[#B42323] inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{bi('Anular venta', 'Cancel sale')}</span>
            </button>
          </div>
        </div>

        {/* Confirm Cancel Sale Modal */}
        {confirmCancelSale && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
            onClick={() => setConfirmCancelSale(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white border border-[#DCE2DD] p-4 space-y-3 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-bold text-[#26352D]">
                {bi('Anular venta de cosecha', 'Cancel harvest sale')}
              </h3>
              <p className="text-xs text-[#5E6D64] leading-relaxed">
                {bi(
                  `¿Deseas anular esta venta de ${fmtNum(confirmCancelSale.cantidad)} ${confirmCancelSale.unidad || 't'} de ${confirmCancelSale.producto}? Las cantidades volverán a sus cosechas de origen en el almacén.`,
                  `Cancel this sale of ${fmtNum(confirmCancelSale.cantidad)} ${confirmCancelSale.unidad || 't'} of ${confirmCancelSale.producto}? Quantities will return to their source harvests in the warehouse.`
                )}
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmCancelSale(null)}
                  className="h-9 px-3.5 rounded-xl border border-[#CFD8D2] bg-white text-xs font-semibold text-[#4B5A52] hover:bg-[#F5F7F4] cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleCancelSaleConfirmed}
                  className="h-9 px-4 rounded-xl bg-[#C44545] hover:bg-[#A93838] text-xs font-bold text-white cursor-pointer"
                >
                  {bi('Anular venta', 'Cancel sale')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -----------------------------------------------------------
  // SCREEN: HARVEST SALES MAIN LIST (VENTAS / ALMACÉN)
  // -----------------------------------------------------------
  const isInitialLoading = loading && !hasLoaded && !loadError;
  const isBlockingLoadError = Boolean(loadError) && !hasLoaded;
  const canRegisterSale =
    effectiveIsAdmin && hasLoaded && !isBlockingLoadError && !loading && warehouseProductsWithStock.length > 0;

  return (
    <div className="space-y-3.5">
      {/* Clean unclipped header */}
      <div className="flex items-center gap-2.5 pb-2 border-b border-[#E7ECE8]">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE2DD] bg-white text-[#26352D] hover:bg-[#F5F7F4] transition cursor-pointer"
          aria-label={t('common.back')}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-[#26352D] leading-snug">{t('harvestSales.title')}</h2>
          <p className="text-xs text-[#64746B] tabular-nums">
            {isInitialLoading ? (
              bi('Consultando almacén y ventas...', 'Checking warehouse and sales...')
            ) : isBlockingLoadError ? (
              <span className="text-[#B42323] font-medium">
                {bi('Error al cargar información', 'Error loading data')}
              </span>
            ) : (
              <>
                {activeSales.length} {bi('ventas', 'sales')} · {warehouseProductsWithStock.length}{' '}
                {warehouseProductsWithStock.length === 1
                  ? bi('producto en almacén', 'product in warehouse')
                  : bi('productos en almacén', 'products in warehouse')}
                {refreshing ? ` · ${bi('Actualizando...', 'Updating...')}` : ''}
              </>
            )}
          </p>
        </div>
      </div>

      {/* Primary action full-width below header */}
      <button
        type="button"
        disabled={!canRegisterSale}
        onClick={() => openCreateFormForProduct(undefined, 'list')}
        className="w-full h-[42px] px-4 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-45 shadow-xs"
      >
        {isInitialLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{bi('Verificando...', 'Checking...')}</span>
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" />
            <span>{bi('Registrar venta', 'Record sale')}</span>
          </>
        )}
      </button>

      {/* Non-blocking refresh error banner */}
      {loadError && hasLoaded && (
        <div className="rounded-xl border border-[#C44545]/30 bg-[#FCECEC] px-3.5 py-2.5 text-xs font-medium text-[#962D2D] flex items-center justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#C44545]" />
            <span className="break-words">{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => loadData(true)}
            className="shrink-0 h-8 px-2.5 rounded-lg bg-white border border-[#C44545]/30 text-[#962D2D] font-bold inline-flex items-center gap-1 hover:bg-[#FFF6F6] cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{bi('Reintentar', 'Retry')}</span>
          </button>
        </div>
      )}

      {notice && (
        <div
          className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium flex items-start gap-2 ${
            notice.type === 'ok'
              ? 'border-[#24875B]/30 bg-[#EAF5EE] text-[#1D5C3F]'
              : 'border-[#C44545]/30 bg-[#FCECEC] text-[#962D2D]'
          }`}
        >
          {notice.type === 'ok' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[#24875B]" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#C44545]" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Compact Tabs: Ventas / Almacén */}
      <div className="grid grid-cols-2 gap-1.5 bg-[#EDF1EE] p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setListTab('sales')}
          className={`h-9 rounded-lg text-xs font-bold transition cursor-pointer tabular-nums ${
            listTab === 'sales'
              ? 'bg-white text-[#1F2D25] shadow-xs'
              : 'text-[#5E6D64] hover:text-[#1F2D25]'
          }`}
        >
          {bi('Ventas', 'Sales')} ({hasLoaded ? activeSales.length : '—'})
        </button>
        <button
          type="button"
          onClick={() => setListTab('warehouse')}
          className={`h-9 rounded-lg text-xs font-bold transition cursor-pointer tabular-nums ${
            listTab === 'warehouse'
              ? 'bg-white text-[#1F2D25] shadow-xs'
              : 'text-[#5E6D64] hover:text-[#1F2D25]'
          }`}
        >
          {bi('Almacén', 'Warehouse')} ({hasLoaded ? warehouseSummaries.length : '—'})
        </button>
      </div>

      {/* State B: Blocking Load Error */}
      {isBlockingLoadError ? (
        <div className="rounded-2xl border border-[#C44545]/30 bg-white px-4 py-7 text-center space-y-3">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#FCECEC] text-[#C44545]">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-[#26352D]">
              {bi('No se pudo cargar Ventas de cosecha', 'Could not load Harvest sales')}
            </p>
            <p className="text-xs text-[#5E6D64] max-w-sm mx-auto">{loadError}</p>
          </div>
          <button
            type="button"
            onClick={() => loadData(true)}
            className="h-9 px-4 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{bi('Reintentar', 'Retry')}</span>
          </button>
        </div>
      ) : isInitialLoading ? (
        <div className="rounded-2xl border border-[#E2E7E3] bg-white p-8 flex items-center justify-center gap-2 text-sm text-[#5E6D64]">
          <Loader2 className="h-4 w-4 animate-spin text-[#24875B]" />
          <span>{bi('Consultando almacén y ventas...', 'Loading warehouse and sales...')}</span>
        </div>
      ) : listTab === 'sales' ? (
        <>
          {/* Campaign filter (applies to Ventas history; Almacén always aggregates all campaigns) */}
          {campaigns.length > 1 && hasLoaded && (
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              aria-label={bi('Filtrar ventas por campaña', 'Filter sales by campaign')}
              className="w-full h-[38px] px-3 rounded-xl border border-[#CFD8D2] bg-white text-xs font-semibold text-[#26352D] focus:border-[#24875B] focus:outline-none"
            >
              <option value="all">{bi('Todas las campañas', 'All campaigns')}</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          )}

          {/* Search & Status filter */}
          {(activeSales.length > 0 || search.trim() !== '' || statusFilter !== 'ALL') && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7A8780]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={bi('Buscar comprador, producto o lote...', 'Search buyer, product or lot...')}
                  className="w-full h-[40px] pl-9 pr-3 rounded-xl border border-[#CFD8D2] bg-white text-sm text-[#1F2D25] focus:border-[#24875B] focus:outline-none"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="h-[40px] px-3 rounded-xl border border-[#CFD8D2] bg-white text-xs font-semibold text-[#26352D] focus:border-[#24875B] focus:outline-none"
              >
                <option value="ALL">{bi('Todos los estados', 'All statuses')}</option>
                <option value="COMPRADOR_Y_PRECIO_PENDIENTES">{t('harvestSales.statusBothPending')}</option>
                <option value="COMPRADOR_PENDIENTE">{t('harvestSales.statusBuyerPending')}</option>
                <option value="PRECIO_PENDIENTE">{t('harvestSales.statusPricePending')}</option>
                <option value="VENTA_COMPLETA">{t('harvestSales.statusComplete')}</option>
              </select>
            </div>
          )}

          {/* Sales List */}
          {filteredSales.length === 0 ? (
            <div className="rounded-2xl border border-[#E2E7E3] bg-white px-4 py-8 text-center space-y-2">
              <p className="text-sm font-medium text-[#5E6D64]">
                {search.trim() || statusFilter !== 'ALL'
                  ? bi('No hay ventas que coincidan con el filtro.', 'No sales match the current filter.')
                  : campaignFilter !== 'all'
                  ? bi('No hay ventas registradas en esta campaña.', 'No sales recorded in this campaign.')
                  : bi('Aún no hay ventas registradas.', 'No sales recorded yet.')}
              </p>
              {warehouseProductsWithStock.length > 0 && !search.trim() && statusFilter === 'ALL' && (
                <button
                  type="button"
                  onClick={() => setListTab('warehouse')}
                  className="text-xs font-bold text-[#24875B] hover:underline cursor-pointer"
                >
                  {bi(
                    `Ver almacén (${warehouseProductsWithStock.length} ${
                      warehouseProductsWithStock.length === 1 ? 'producto disponible' : 'productos disponibles'
                    })`,
                    `View warehouse (${warehouseProductsWithStock.length} ${
                      warehouseProductsWithStock.length === 1 ? 'product available' : 'products available'
                    })`
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#E2E7E3] bg-white divide-y divide-[#EEF2EF] overflow-hidden">
              {filteredSales.map((sale) => {
                const buyer = resolveBuyerDisplay(sale);
                const st = statusLabel(sale.estado);
                const origin =
                  formatSaleOriginSummary(sale, lang) ||
                  sale.loteNombre ||
                  lotMap.get(sale.loteId)?.nombre ||
                  '';
                const saleProdInfo = resolveProductDisplay(sale);
                const saleProdName = saleProdInfo.displayName || sale.producto;
                const subtitleParts = [saleProdName, origin, fmtDate(sale.fecha)].filter(Boolean);

                return (
                  <button
                    key={sale.id}
                    type="button"
                    onClick={() => {
                      setSelectedSaleId(sale.id);
                      setNotice(null);
                      setScreen('detail');
                    }}
                    className="w-full px-3.5 py-3 flex items-center justify-between gap-2.5 text-left hover:bg-[#F7F9F7] transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="h-9 w-9 rounded-xl bg-[#EAF5EE] text-[#1D704B] flex items-center justify-center shrink-0">
                        <VisualIcon
                          iconId={resolveProductIcon(sale.producto, sale.conceptoId)}
                          nameHint={saleProdName}
                          category="ingreso"
                          size={22}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#1F2D25] truncate">{buyer}</p>
                        <p className="text-xs text-[#64746B] truncate">{subtitleParts.join(' · ')}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-extrabold text-[#1F2D25] tabular-nums whitespace-nowrap">
                          {fmtNum(sale.cantidad)} {sale.unidad || 't'}
                        </p>
                        <p className={`text-[11px] font-semibold whitespace-nowrap ${st.tone}`}>{st.text}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-[#8A9890]" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* General Harvest Warehouse Tab (grouped by product across all lots & campaigns) */
        <div className="space-y-2.5">
          {warehouseSummaries.length === 0 ? (
            <div className="rounded-2xl border border-[#E2E7E3] bg-white px-4 py-8 text-center space-y-2">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#F1F5F2] text-[#64746B]">
                <Package className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-[#5E6D64]">
                {bi('No hay cosechas registradas en el almacén.', 'No harvests recorded in the warehouse.')}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#E2E7E3] bg-white divide-y divide-[#EEF2EF] overflow-hidden">
              {warehouseSummaries.map((prod) => {
                const hasStock = prod.totalDisponible > HARVEST_AVAILABILITY_EPSILON;
                const lotsCountToDisplay = prod.lotesCount;
                return (
                  <div
                    key={prod.key}
                    onClick={() => {
                      setSelectedProductKey(prod.key);
                      setNotice(null);
                      setScreen('warehouse_detail');
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedProductKey(prod.key);
                        setNotice(null);
                        setScreen('warehouse_detail');
                      }
                    }}
                    className="px-3.5 py-3 flex items-center justify-between gap-2.5 hover:bg-[#F7F9F7] transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="h-10 w-10 rounded-xl bg-[#EAF5EE] text-[#1D704B] flex items-center justify-center shrink-0">
                        <VisualIcon iconId={resolveProductIcon(prod.producto, prod.conceptoId)} nameHint={prod.producto} category="ingreso" size={24} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#1F2D25] truncate leading-snug">{prod.producto}</p>
                        <p className="text-xs text-[#64746B] truncate">
                          {lotsCountToDisplay} {lotsCountToDisplay === 1 ? bi('lote', 'lot') : bi('lotes', 'lots')}
                          {' · '}
                          {formatPercentMax1(prod.porcentajeVendido, lang)} {bi('vendido', 'sold')}
                        </p>
                        <p
                          className={`text-xs font-extrabold tabular-nums whitespace-nowrap mt-0.5 ${
                            hasStock ? 'text-[#1D704B]' : 'text-[#7A8780]'
                          }`}
                        >
                          {fmtNum(prod.totalDisponible)} {prod.unidad}{' '}
                          {hasStock ? bi('disponibles', 'available') : bi('agotado', 'sold out')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={!effectiveIsAdmin || !hasStock}
                        onClick={(e) => {
                          e.stopPropagation();
                          openCreateFormForProduct(prod.key, 'list');
                        }}
                        className="h-9 px-3 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer disabled:opacity-40"
                      >
                        <span>{bi('Vender', 'Sell')}</span>
                      </button>
                      <ChevronRight className="h-4 w-4 text-[#8A9890]" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
