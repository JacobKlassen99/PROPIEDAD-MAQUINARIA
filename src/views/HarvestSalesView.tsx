import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Edit2,
  Loader2,
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
} from '../types';
import * as backend from '../services/backend';
import { cacheKeys, getCachedQuery, setCachedQuery } from '../services/dataCache';
import { usePersistedMemoryState } from '../hooks/useSwrQuery';
import {
  computeHarvestAvailability,
  filterAvailableHarvests,
} from '../services/harvestAvailability';
import { addDaysToIso, round2 } from '../services/interestEngine';
import { useI18n } from '../services/i18n';
import { VisualIcon } from '../components/VisualIcon';
import { CustomerPicker } from '../components/CustomerPicker';
import { ObservationField } from '../components/ObservationField';
import { Switch } from '../components/Switch';
import { formatDateLocale, formatMoneyLocale, formatNumberLocale } from '../services/formatters';

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

type SaleScreen = 'list' | 'detail' | 'form';
type ListTab = 'sales' | 'harvests';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toInputIso(dateStr?: string): string {
  if (!dateStr) return todayIso();
  const s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return todayIso();
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
  const [listTab, setListTab] = usePersistedMemoryState<ListTab>('harvestSales.listTab', 'sales');
  const [search, setSearch] = usePersistedMemoryState<string>('harvestSales.search', '');
  const [statusFilter, setStatusFilter] = usePersistedMemoryState<HarvestSaleStatus | 'ALL'>('harvestSales.statusFilter', 'ALL');
  const [campaignFilter, setCampaignFilter] = usePersistedMemoryState<string>('harvestSales.campaignFilter', 'all');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  // Create / Edit Form state
  const [editingSale, setEditingSale] = useState<HarvestSale | null>(null);
  const [formHarvestId, setFormHarvestId] = useState('');
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

  const [saving, setSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancelSale, setConfirmCancelSale] = useState<HarvestSale | null>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadData = useCallback(async (forceFresh = false) => {
    const key = cacheKeys.harvestSalesList('all');
    const c = getCachedQuery<{ sales: HarvestSale[]; harvests: HarvestRecord[] }>(key);
    if (c?.data && !forceFresh) {
      const reconciledCached = computeHarvestAvailability(c.data.harvests, c.data.sales);
      setSales(c.data.sales);
      setHarvests(reconciledCached);
      setHasLoaded(true);
      setLoading(false);
      setRefreshing(true);
    } else if (!c?.data) {
      setLoading(true);
      setRefreshing(false);
    } else {
      setRefreshing(true);
    }

    setLoadError(null);

    try {
      const fresh = await backend.getHarvestSales({}, !forceFresh);
      const reconciledHarvests = computeHarvestAvailability(fresh.harvests, fresh.sales);
      const normalizedBundle = {
        sales: fresh.sales,
        harvests: reconciledHarvests,
      };
      setCachedQuery(key, normalizedBundle);
      setCachedQuery(cacheKeys.harvestPending(), filterAvailableHarvests(reconciledHarvests));
      setSales(normalizedBundle.sales);
      setHarvests(normalizedBundle.harvests);
      setHasLoaded(true);
      setLoadError(null);
    } catch (err: any) {
      const errMsg =
        err?.message ||
        bi(
          'No se pudieron cargar las ventas y cosechas disponibles. Verifica tu conexión e intenta nuevamente.',
          'Could not load sales and available harvests. Check your connection and try again.'
        );
      setLoadError(errMsg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bi]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Reset invalid persisted campaign filter if that campaign no longer exists
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

  const resolveProductIcon = useCallback(
    (producto: string): string => {
      const norm = String(producto || '').trim().toLowerCase();
      const match = itemsConfig.find(
        (it) => String(it.nombre || '').trim().toLowerCase() === norm && it.icono
      );
      if (match?.icono) return match.icono;
      if (norm.includes('soya') || norm.includes('soja') || norm.includes('soy')) return 'bean';
      if (norm.includes('maiz') || norm.includes('maíz') || norm.includes('corn')) return 'wheat';
      if (norm.includes('sorgo') || norm.includes('trigo') || norm.includes('girasol')) return 'sprout';
      return 'wheat';
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

  const activeSales = useMemo(() => {
    const targetCamp = campaignFilter && campaignFilter !== 'all' ? String(campaignFilter).trim() : '';
    return sales
      .filter((s) => !s.anulada && (!targetCamp || String(s.campanaId || '').trim() === targetCamp))
      .sort((a, b) => backend.compareChronologicalDesc(a, b));
  }, [sales, campaignFilter]);

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeSales.filter((s) => {
      if (statusFilter !== 'ALL' && s.estado !== statusFilter) return false;
      if (!q) return true;
      const buyer = resolveBuyerDisplay(s);
      const lotName = s.loteNombre || lotMap.get(s.loteId)?.nombre || '';
      const campName = s.campanaNombre || campaignMap.get(s.campanaId)?.nombre || '';
      return `${buyer} ${s.producto} ${lotName} ${campName} ${s.fecha}`.toLowerCase().includes(q);
    });
  }, [activeSales, search, statusFilter, resolveBuyerDisplay, lotMap, campaignMap]);

  const availableHarvests = useMemo(
    () =>
      filterAvailableHarvests(harvests, campaignFilter).sort((a, b) =>
        backend.compareChronologicalDesc(a, b)
      ),
    [harvests, campaignFilter]
  );

  const selectedSale = useMemo(
    () => sales.find((s) => s.id === selectedSaleId) || null,
    [sales, selectedSaleId]
  );

  const isBuyerDefined = !formCompradorPendiente && Boolean(formClienteId.trim());
  const parsedFormPrice = Number(String(formPrecioUnitario).replace(',', '.'));
  const isPriceDefined = !formPrecioPendiente && Number.isFinite(parsedFormPrice) && parsedFormPrice > 0;
  const canShowPaymentTerms = isBuyerDefined && isPriceDefined;

  // Automatically preload default payment settings ONCE when a sale becomes complete
  // (both buyer selected from catalog AND valid price defined), starting the term from
  // the completion date (never from harvest date or initial pending registration date).
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

  const openCreateFormForHarvest = (harvest?: HarvestRecord) => {
    const targetHarvest = harvest || availableHarvests[0] || null;
    const defaultTc =
      exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0 ? exchangeRate.tasaBobPerUsd : 6.96;
    const today = todayIso();

    setEditingSale(null);
    setWasAlreadyComplete(false);
    setTermsAutoLoaded(false);
    setTermsBaseDate(today);
    setFormHarvestId(targetHarvest?.id || '');
    setFormDate(today);
    setFormCantidad(targetHarvest ? String(round2(targetHarvest.pendiente)) : '');
    setFormClienteId('');
    setFormCompradorPendiente(true);
    setFormPrecioPendiente(false);
    setFormPrecioUnitario('');
    setFormMoneda('USD');
    setFormTc(String(defaultTc));
    // Start with empty payment terms until both buyer and price are defined
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

    setEditingSale(sale);
    setWasAlreadyComplete(alreadyComplete);
    setTermsAutoLoaded(alreadyComplete);
    setTermsBaseDate(originalBase);
    setFormHarvestId(sale.cosechaId);
    setFormDate(isoDate);
    setFormCantidad(String(sale.cantidad));
    setFormClienteId(sale.clienteId || '');
    setFormCompradorPendiente(Boolean(sale.compradorPendiente || !sale.clienteId));
    setFormPrecioPendiente(Boolean(sale.precioPendiente));
    setFormPrecioUnitario(sale.precioPendiente ? '' : String(sale.precioUnitario));
    setFormMoneda(sale.moneda || 'USD');
    setFormTc(String(sale.tc > 0 ? sale.tc : exchangeRate?.tasaBobPerUsd || 6.96));
    if (alreadyComplete) {
      // Preserve original payment terms and dates without resetting the term
      setFormPlazoDias(sale.plazoDias !== undefined && sale.plazoDias !== null ? String(sale.plazoDias) : '');
      setFormFechaVencimiento(isoDue);
      setFormAplicarInteres(Boolean(sale.aplicarInteres));
      setFormTasaInteres(sale.tasaInteresMensual > 0 ? String(sale.tasaInteresMensual) : '');
    } else {
      // Pending sales do not carry payment terms until completed
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

  const selectedFormHarvest = useMemo(
    () => harvests.find((h) => h.id === formHarvestId) || null,
    [harvests, formHarvestId]
  );

  const maxAllowedTons = useMemo(() => {
    if (editingSale) {
      const h = harvests.find((x) => x.id === editingSale.cosechaId);
      return round2((h?.pendiente || 0) + editingSale.cantidad);
    }
    return round2(selectedFormHarvest?.pendiente || 0);
  }, [editingSale, harvests, selectedFormHarvest]);

  const formLiveTotal = useMemo(() => {
    if (formPrecioPendiente) return 0;
    const qty = Number(String(formCantidad).replace(',', '.'));
    const price = Number(String(formPrecioUnitario).replace(',', '.'));
    if (!Number.isFinite(qty) || !Number.isFinite(price) || qty <= 0 || price <= 0) return 0;
    return round2(qty * price);
  }, [formPrecioPendiente, formCantidad, formPrecioUnitario]);

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    if (!editingSale && !formHarvestId) {
      setNotice({
        type: 'err',
        text: bi('Selecciona una cosecha con toneladas disponibles.', 'Select a harvest with available tons.'),
      });
      return;
    }

    const qty = Number(String(formCantidad).replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) {
      setNotice({
        type: 'err',
        text: bi('Ingresa una cantidad de toneladas mayor a 0.', 'Enter a tons quantity greater than 0.'),
      });
      return;
    }
    if (maxAllowedTons > 0 && qty > maxAllowedTons + 0.005) {
      setNotice({
        type: 'err',
        text: bi(
          `La cantidad supera las toneladas disponibles (${fmtNum(maxAllowedTons)} t).`,
          `Quantity exceeds available tons (${fmtNum(maxAllowedTons)} t).`
        ),
      });
      return;
    }

    const price = Number(String(formPrecioUnitario).replace(',', '.'));
    if (!formPrecioPendiente && (!Number.isFinite(price) || price <= 0)) {
      setNotice({
        type: 'err',
        text: bi(
          'Ingresa un precio unitario mayor a 0 o marca «Precio pendiente».',
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
          cosechaId: formHarvestId,
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
      }

      await Promise.all([
        loadData(true),
        onDataMutated ? Promise.resolve(onDataMutated()) : Promise.resolve(),
      ]);

      setNotice({
        type: 'ok',
        text: editingSale
          ? bi('Venta de cosecha actualizada correctamente.', 'Harvest sale updated successfully.')
          : bi('Venta de cosecha registrada correctamente.', 'Harvest sale registered successfully.'),
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
          'Venta anulada y toneladas devueltas al saldo disponible de la cosecha.',
          'Sale cancelled and tons returned to harvest available balance.'
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
  // SCREEN: CREATE / EDIT HARVEST SALE (INDEPENDENT SCREEN)
  // -----------------------------------------------------------
  if (screen === 'form') {
    const harvestInfo = editingSale
      ? `${editingSale.producto} · ${editingSale.loteNombre || lotMap.get(editingSale.loteId)?.nombre || ''} · ${editingSale.campanaNombre || campaignMap.get(editingSale.campanaId)?.nombre || ''}`
      : selectedFormHarvest
      ? `${selectedFormHarvest.producto} · ${selectedFormHarvest.loteNombre || lotMap.get(selectedFormHarvest.loteId)?.nombre || ''}`
      : '';

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-[#E7ECE8]">
          <button
            type="button"
            onClick={() => {
              setScreen(editingSale ? 'detail' : 'list');
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
            {harvestInfo && <p className="text-xs text-[#64746B] truncate">{harvestInfo}</p>}
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
          {/* Cosecha de origen (solo al crear) */}
          {!editingSale && (
            <div>
              <label className="block text-[13px] font-semibold text-[#26352D] mb-1">
                {bi('Cosecha de origen', 'Source harvest')}
                <span className="text-[#C44545] ml-0.5">*</span>
              </label>
              <select
                value={formHarvestId}
                onChange={(e) => {
                  const id = e.target.value;
                  setFormHarvestId(id);
                  const h = availableHarvests.find((x) => x.id === id);
                  if (h) setFormCantidad(String(round2(h.pendiente)));
                }}
                required
                className="w-full h-[40px] rounded-xl border border-[#CFD8D2] bg-white px-3 text-sm font-semibold text-[#1F2D25] focus:border-[#24875B] focus:outline-none"
              >
                <option value="">{bi('Seleccionar cosecha...', 'Select harvest...')}</option>
                {availableHarvests.map((h) => {
                  const lotLabel = h.loteNombre || lotMap.get(h.loteId)?.nombre || '';
                  const primary = [h.producto, lotLabel].filter(Boolean).join(' · ');
                  return (
                    <option key={h.id} value={h.id}>
                      {`${primary} — ${fmtNum(h.pendiente)} t ${bi('disp.', 'avail.')}`}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* 1. Comprador */}
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

          {/* 2. Cantidad (t) y Fecha en la misma fila compacta */}
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-2.5 items-end">
              <div className="min-w-0">
                <label className="block text-[13px] font-semibold text-[#26352D] mb-1 whitespace-nowrap truncate">
                  {bi('Cantidad (t)', 'Quantity (t)')}
                  <span className="text-[#C44545] ml-0.5">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={maxAllowedTons > 0 ? maxAllowedTons : undefined}
                  value={formCantidad}
                  onChange={(e) => setFormCantidad(e.target.value)}
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
                    // Only recalculate due date from formDate on a brand-new complete sale;
                    // never reset terms on an already-completed sale or when completing a pending sale.
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
            {maxAllowedTons > 0 && (
              <p className="text-[11px] text-[#64746B] tabular-nums">
                {bi('Disponible:', 'Available:')} <span className="font-semibold text-[#1D704B]">{fmtNum(maxAllowedTons)} t</span>
              </p>
            )}
          </div>

          {/* 3. Casilla «Precio pendiente» (controla únicamente los campos de precio) */}
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

          {/* 4, 5, 6. Moneda (USD / Bs), Precio / t y TC alineados, e Importe total */}
          {!formPrecioPendiente && (
            <div className="space-y-3 rounded-xl border border-[#E7ECE8] bg-[#F9FBF9] p-3">
              {/* 4. Moneda (USD / Bs) */}
              <Switch<Currency>
                label={t('common.currency')}
                value={formMoneda}
                onChange={handleCurrencyToggle}
                leftOption={{ value: 'USD', label: 'USD' }}
                rightOption={{ value: 'BOB', label: 'Bs' }}
              />

              {/* 5. Precio / t y TC en la misma fila, títulos e inputs perfectamente alineados */}
              <div className="grid grid-cols-2 gap-2.5 items-end">
                <div className="min-w-0">
                  <label className="block text-[13px] font-semibold text-[#26352D] mb-1 whitespace-nowrap truncate">
                    {bi('Precio / t', 'Price / t')}
                    <span className="text-[#C44545] ml-0.5">*</span>
                  </label>
                  <input
                    type="number"
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
                    step="0.01"
                    min="0.01"
                    value={formTc}
                    onChange={(e) => setFormTc(e.target.value)}
                    required
                    className="w-full h-[40px] rounded-xl border border-[#CFD8D2] bg-white px-3 text-sm font-semibold text-[#1F2D25] tabular-nums focus:border-[#24875B] focus:outline-none"
                  />
                </div>
              </div>

              {/* 6. Importe total de la venta */}
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

          {/* 7. Condiciones de cobro (ÚNICAMENTE cuando comprador del catálogo Y precio estén definidos) */}
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

          {/* 8. Observación */}
          <ObservationField
            value={formObs}
            onChange={setFormObs}
            placeholder={bi('Observación de la venta...', 'Sale observation...')}
          />

          {/* 9. Botón Guardar */}
          <div className="pt-1 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setScreen(editingSale ? 'detail' : 'list');
                setNotice(null);
              }}
              className="h-[40px] px-4 rounded-xl border border-[#CFD8D2] bg-white text-sm font-semibold text-[#4B5A52] hover:bg-[#F5F7F4] cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
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
  // SCREEN: HARVEST SALE DETAIL (INDEPENDENT SCREEN)
  // -----------------------------------------------------------
  if (screen === 'detail' && selectedSale) {
    const buyer = resolveBuyerDisplay(selectedSale);
    const st = statusLabel(selectedSale.estado);
    const lotName = selectedSale.loteNombre || lotMap.get(selectedSale.loteId)?.nombre || '—';
    const campName = selectedSale.campanaNombre || campaignMap.get(selectedSale.campanaId)?.nombre || '—';

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
              <VisualIcon iconId={resolveProductIcon(selectedSale.producto)} nameHint={selectedSale.producto} category="ingreso" size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#1F2D25] truncate">{selectedSale.producto}</p>
              <p className="text-xs text-[#64746B] truncate">
                {lotName} · {campName} · {fmtDate(selectedSale.fecha)}
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
                  : `${fmtMoney(selectedSale.precioUnitario, selectedSale.moneda)} / t`}
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
              <span className="text-[#7A8780] block">{bi('Fecha de registro', 'Sale date')}</span>
              <span className="text-[#26352D] font-medium tabular-nums">{fmtDate(selectedSale.fecha)}</span>
            </div>
          </div>

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
                  `¿Deseas anular esta venta de ${fmtNum(confirmCancelSale.cantidad)} t de ${confirmCancelSale.producto}? Las toneladas volverán a quedar disponibles para venta.`,
                  `Cancel this sale of ${fmtNum(confirmCancelSale.cantidad)} t of ${confirmCancelSale.producto}? The tons will become available again.`
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
  // SCREEN: HARVEST SALES MAIN LIST
  // -----------------------------------------------------------
  const distinctAvailableCampaigns = new Set(
    availableHarvests
      .map((h) => h.campanaNombre || campaignMap.get(h.campanaId)?.nombre || '')
      .filter(Boolean)
  ).size;
  const distinctSalesCampaigns = new Set(
    activeSales
      .map((s) => s.campanaNombre || campaignMap.get(s.campanaId)?.nombre || '')
      .filter(Boolean)
  ).size;

  const isInitialLoading = loading && !hasLoaded && !loadError;
  const isBlockingLoadError = Boolean(loadError) && !hasLoaded;
  const canRegisterSale =
    effectiveIsAdmin && hasLoaded && !isBlockingLoadError && !loading && availableHarvests.length > 0;

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
              bi('Verificando cosechas disponibles...', 'Checking available harvests...')
            ) : isBlockingLoadError ? (
              <span className="text-[#B42323] font-medium">
                {bi('Error al cargar información', 'Error loading data')}
              </span>
            ) : (
              <>
                {activeSales.length} {bi('ventas', 'sales')} · {availableHarvests.length}{' '}
                {bi('disponibles', 'available')}
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
        onClick={() => openCreateFormForHarvest()}
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

      {/* Non-blocking refresh error banner (when cached data is already displayed) */}
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

      {/* Campaign filter (unified across both Ventas and Disponibles) */}
      {campaigns.length > 1 && hasLoaded && (
        <div className="flex items-center gap-2">
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            aria-label={bi('Filtrar por campaña', 'Filter by campaign')}
            className="w-full h-[38px] px-3 rounded-xl border border-[#CFD8D2] bg-white text-xs font-semibold text-[#26352D] focus:border-[#24875B] focus:outline-none"
          >
            <option value="all">{bi('Todas las campañas', 'All campaigns')}</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Compact Tabs: Ventas / Disponibles */}
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
          onClick={() => setListTab('harvests')}
          className={`h-9 rounded-lg text-xs font-bold transition cursor-pointer tabular-nums ${
            listTab === 'harvests'
              ? 'bg-white text-[#1F2D25] shadow-xs'
              : 'text-[#5E6D64] hover:text-[#1F2D25]'
          }`}
        >
          {bi('Disponibles', 'Available')} ({hasLoaded ? availableHarvests.length : '—'})
        </button>
      </div>

      {/* State B: Blocking Load Error (never masquerade as 0 records) */}
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
        /* State A: Initial Loading / Verifying */
        <div className="rounded-2xl border border-[#E2E7E3] bg-white p-8 flex items-center justify-center gap-2 text-sm text-[#5E6D64]">
          <Loader2 className="h-4 w-4 animate-spin text-[#24875B]" />
          <span>{bi('Verificando ventas y cosechas disponibles...', 'Checking sales and available harvests...')}</span>
        </div>
      ) : listTab === 'sales' ? (
        <>
          {/* Search & Status filter (only shown when there are sales to filter or active filter) */}
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
              {availableHarvests.length > 0 && !search.trim() && statusFilter === 'ALL' && (
                <button
                  type="button"
                  onClick={() => setListTab('harvests')}
                  className="text-xs font-bold text-[#24875B] hover:underline cursor-pointer"
                >
                  {bi(
                    `Ver ${availableHarvests.length} cosecha(s) disponible(s)`,
                    `View ${availableHarvests.length} available harvest(s)`
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#E2E7E3] bg-white divide-y divide-[#EEF2EF] overflow-hidden">
              {filteredSales.map((sale) => {
                const buyer = resolveBuyerDisplay(sale);
                const st = statusLabel(sale.estado);
                const lotName = sale.loteNombre || lotMap.get(sale.loteId)?.nombre || '';
                const campName = sale.campanaNombre || campaignMap.get(sale.campanaId)?.nombre || '';
                const subtitleParts = [
                  sale.producto,
                  lotName,
                  distinctSalesCampaigns > 1 ? campName : '',
                  fmtDate(sale.fecha),
                ].filter(Boolean);

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
                        <VisualIcon iconId={resolveProductIcon(sale.producto)} nameHint={sale.producto} category="ingreso" size={22} />
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
        /* Available Harvests Tab */
        <div className="space-y-2">
          {availableHarvests.length === 0 ? (
            <div className="rounded-2xl border border-[#E2E7E3] bg-white px-4 py-8 text-center space-y-2">
              <p className="text-sm font-medium text-[#5E6D64]">
                {campaignFilter !== 'all'
                  ? bi('No hay cosechas disponibles en esta campaña.', 'No harvests available in this campaign.')
                  : bi('No hay cosechas disponibles para la venta.', 'No harvests available for sale.')}
              </p>
              {campaignFilter !== 'all' && filterAvailableHarvests(harvests, 'all').length > 0 && (
                <button
                  type="button"
                  onClick={() => setCampaignFilter('all')}
                  className="text-xs font-bold text-[#24875B] hover:underline cursor-pointer"
                >
                  {bi('Mostrar todas las campañas', 'Show all campaigns')}
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#E2E7E3] bg-white divide-y divide-[#EEF2EF] overflow-hidden">
              {availableHarvests.map((h) => {
                const lotName = h.loteNombre || lotMap.get(h.loteId)?.nombre || '';
                const campName = h.campanaNombre || campaignMap.get(h.campanaId)?.nombre || '';
                const metaParts = [
                  lotName,
                  distinctAvailableCampaigns > 1 ? campName : '',
                  fmtDate(h.fecha),
                ].filter(Boolean);

                return (
                  <div key={h.id} className="px-3.5 py-3 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="h-9 w-9 rounded-xl bg-[#EAF5EE] text-[#1D704B] flex items-center justify-center shrink-0">
                        <VisualIcon iconId={resolveProductIcon(h.producto)} nameHint={h.producto} category="ingreso" size={22} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#1F2D25] truncate leading-snug">{h.producto}</p>
                        <p className="text-xs text-[#64746B] truncate">
                          {metaParts.join(' · ')}
                        </p>
                        <p className="text-xs font-bold text-[#1D704B] tabular-nums whitespace-nowrap mt-0.5">
                          {fmtNum(h.pendiente)} t {bi('disponibles', 'available')}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!effectiveIsAdmin}
                      onClick={() => openCreateFormForHarvest(h)}
                      className="h-9 px-3 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer shrink-0 disabled:opacity-45"
                    >
                      <span>{bi('Vender', 'Sell')}</span>
                    </button>
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
