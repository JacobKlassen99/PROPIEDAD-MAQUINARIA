import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  FileText,
  History,
  Loader2,
  Phone,
  Receipt,
  Search,
  UserPlus,
  XCircle,
} from 'lucide-react';
import type {
  ArCustomerSummary,
  ArDebt,
  ArPaymentRecord,
  Currency,
  Customer,
  DebitNoteRecord,
  ExchangeRateConfig,
  PaymentReceiptRecord,
} from '../types';
import * as backend from '../services/backend';
import {
  cacheKeys,
  getCachedQuery,
  setCachedQuery,
} from '../services/dataCache';
import {
  convertDebtToPaymentCurrency,
  convertPaymentToDebtCurrency,
  round2,
  splitDebtApplication,
} from '../services/interestEngine';
import { useI18n } from '../services/i18n';
import { CustomerPicker } from '../components/CustomerPicker';
import { DocumentPreviewScreen } from '../components/DocumentPreviewScreen';
import { Switch } from '../components/Switch';
import { ObservationField } from '../components/ObservationField';
import { formatDateLocale, formatMoneyLocale, formatNumberLocale } from '../services/formatters';

interface AccountsReceivableViewProps {
  customers: Customer[];
  exchangeRate: ExchangeRateConfig | null;
  onBack: () => void;
  onDataMutated?: () => Promise<void> | void;
  initialCustomerId?: string | null;
}

type ArScreen =
  | 'list'
  | 'customer_detail'
  | 'register_payment'
  | 'history'
  | 'preview_debit_note'
  | 'preview_receipt';

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const AccountsReceivableView: React.FC<AccountsReceivableViewProps> = ({
  customers,
  exchangeRate,
  onBack,
  onDataMutated,
  initialCustomerId = null,
}) => {
  const { lang, t, bi } = useI18n();
  const fmtNum = useCallback((val: number) => formatNumberLocale(val, lang, 2), [lang]);
  const fmtMoney = useCallback((val: number, curr: Currency) => formatMoneyLocale(val, curr, lang), [lang]);
  const fmtDate = useCallback((dateStr?: string) => formatDateLocale(dateStr, lang), [lang]);

  const cachedSummary = getCachedQuery<backend.ArSummaryResponse>(cacheKeys.arSummary());
  const [summaryData, setSummaryData] = useState<backend.ArSummaryResponse | null>(
    cachedSummary?.data ?? null
  );
  const [loadingSummary, setLoadingSummary] = useState(!cachedSummary?.data);
  const [refreshingSummary, setRefreshingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [screen, setScreen] = useState<ArScreen>(initialCustomerId ? 'customer_detail' : 'list');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialCustomerId);
  const [detailData, setDetailData] = useState<backend.ArCustomerDetailResponse | null>(() => {
    if (!initialCustomerId) return null;
    return getCachedQuery<backend.ArCustomerDetailResponse>(cacheKeys.arCustomerDetail(initialCustomerId))?.data ?? null;
  });
  const [loadingDetail, setLoadingDetail] = useState(Boolean(initialCustomerId && !detailData));
  const [refreshingDetail, setRefreshingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [showZeroBalanceCustomers, setShowZeroBalanceCustomers] = useState(false);

  // Assign customer to unassigned debt
  const [assigningDebt, setAssigningDebt] = useState<ArDebt | null>(null);
  const [assignTargetCustomerId, setAssignTargetCustomerId] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);

  // Multi-select debts on customer detail
  const [selectedDebtKeys, setSelectedDebtKeys] = useState<string[]>([]);

  // Payment registration state
  const [payDate, setPayDate] = useState(todayIso);
  const [payCurrency, setPayCurrency] = useState<Currency>('USD');
  const [payTc, setPayTc] = useState<string>(() =>
    String(exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0 ? exchangeRate.tasaBobPerUsd : 6.96)
  );
  const [payAmounts, setPayAmounts] = useState<Record<string, string>>({});
  const [payObs, setPayObs] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Debit note generation
  const [generatingDebitNote, setGeneratingDebitNote] = useState(false);
  const [debitNoteObs, setDebitNoteObs] = useState('');
  const [showDebitNoteConfirm, setShowDebitNoteConfirm] = useState(false);

  // Previewed documents
  const [activeDebitNote, setActiveDebitNote] = useState<DebitNoteRecord | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<PaymentReceiptRecord | null>(null);
  const [previewReturnScreen, setPreviewReturnScreen] = useState<ArScreen>('customer_detail');

  // Cancel payment confirmation
  const [confirmCancelPayment, setConfirmCancelPayment] = useState<ArPaymentRecord | null>(null);
  const [cancellingPaymentId, setCancellingPaymentId] = useState<string | null>(null);

  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadSummary = useCallback(async (forceFresh = false) => {
    const cached = getCachedQuery<backend.ArSummaryResponse>(cacheKeys.arSummary());
    setSummaryError(null);
    if (cached?.data && !forceFresh) {
      setSummaryData(cached.data);
      setLoadingSummary(false);
      setRefreshingSummary(true);
    } else if (!cached?.data) {
      setLoadingSummary(true);
    } else {
      setRefreshingSummary(true);
    }
    try {
      const fresh = await backend.getArSummary(!forceFresh);
      setCachedQuery(cacheKeys.arSummary(), fresh);
      setSummaryData(fresh);
      setSummaryError(null);
    } catch (err: any) {
      const errMsg =
        err?.message ||
        bi('No se pudieron consultar las cuentas por cobrar.', 'Could not load accounts receivable.');
      if (cached?.data) {
        setNotice({ type: 'err', text: errMsg });
      } else {
        setSummaryError(errMsg);
      }
    } finally {
      setLoadingSummary(false);
      setRefreshingSummary(false);
    }
  }, [bi]);

  const loadCustomerDetail = useCallback(async (clienteId: string, forceFresh = false) => {
    const key = cacheKeys.arCustomerDetail(clienteId);
    const cached = getCachedQuery<backend.ArCustomerDetailResponse>(key);
    setDetailError(null);
    if (cached?.data && !forceFresh) {
      setDetailData(cached.data);
      setLoadingDetail(false);
      setRefreshingDetail(true);
    } else if (!cached?.data) {
      setLoadingDetail(true);
    } else {
      setRefreshingDetail(true);
    }
    try {
      const fresh = await backend.getArCustomerDetail(clienteId, !forceFresh);
      setCachedQuery(key, fresh);
      setDetailData(fresh);
      setDetailError(null);
    } catch (err: any) {
      const errMsg =
        err?.message ||
        bi('No se pudo cargar la cuenta del cliente.', 'Could not load customer account.');
      if (cached?.data) {
        setNotice({ type: 'err', text: errMsg });
      } else {
        setDetailError(errMsg);
      }
    } finally {
      setLoadingDetail(false);
      setRefreshingDetail(false);
    }
  }, [bi]);

  useEffect(() => {
    loadSummary(false);
  }, [loadSummary]);

  useEffect(() => {
    if (initialCustomerId) {
      setSelectedCustomerId(initialCustomerId);
      setScreen('customer_detail');
      loadCustomerDetail(initialCustomerId, false);
    }
  }, [initialCustomerId, loadCustomerDetail]);

  const openCustomerAccount = (clienteId: string) => {
    setSelectedCustomerId(clienteId);
    setSelectedDebtKeys([]);
    setNotice(null);
    setScreen('customer_detail');
    loadCustomerDetail(clienteId, false);
  };

  const filteredCustomerSummaries = useMemo(() => {
    const list = summaryData?.customers || [];
    const q = search.trim().toLowerCase();
    return list
      .filter((c) => {
        const hasDebt = c.usd.totalPendiente > 0.005 || c.bob.totalPendiente > 0.005 || c.registrosPendientes > 0;
        if (!showZeroBalanceCustomers && !hasDebt) return false;
        if (!q) return true;
        return `${c.clienteNombre} ${c.telefono || ''}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (b.registrosVencidos !== a.registrosVencidos) return b.registrosVencidos - a.registrosVencidos;
        return a.clienteNombre.localeCompare(b.clienteNombre, 'es', { sensitivity: 'base' });
      });
  }, [summaryData, search, showZeroBalanceCustomers]);

  const pendingDebts = useMemo(
    () =>
      (detailData?.debts || [])
        .filter((d) => d.totalPendiente > 0.005 && d.estado !== 'COBRADO')
        .sort((a, b) => backend.compareChronologicalDesc(a, b)),
    [detailData]
  );

  const selectedDebts = useMemo(
    () => pendingDebts.filter((d) => selectedDebtKeys.includes(d.id)),
    [pendingDebts, selectedDebtKeys]
  );

  const toggleDebtSelection = (debtKey: string) => {
    setSelectedDebtKeys((prev) =>
      prev.includes(debtKey) ? prev.filter((k) => k !== debtKey) : [...prev, debtKey]
    );
  };

  const toggleSelectAllDebts = () => {
    if (selectedDebtKeys.length === pendingDebts.length) {
      setSelectedDebtKeys([]);
    } else {
      setSelectedDebtKeys(pendingDebts.map((d) => d.id));
    }
  };

  const openPaymentScreen = () => {
    const targets = selectedDebts.length > 0 ? selectedDebts : pendingDebts;
    if (targets.length === 0) {
      setNotice({
        type: 'err',
        text: bi('No hay deudas pendientes seleccionadas para cobrar.', 'No pending debts selected for payment.'),
      });
      return;
    }
    if (selectedDebtKeys.length === 0) {
      setSelectedDebtKeys(targets.map((d) => d.id));
    }
    const defaultCurr: Currency = targets.every((d) => d.moneda === 'BOB') ? 'BOB' : 'USD';
    const defaultTc =
      exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0 ? exchangeRate.tasaBobPerUsd : 6.96;
    setPayDate(todayIso());
    setPayCurrency(defaultCurr);
    setPayTc(String(defaultTc));
    const initialMap: Record<string, string> = {};
    targets.forEach((d) => {
      const fullInPayCurr = convertDebtToPaymentCurrency(d.totalPendiente, d.moneda, defaultCurr, defaultTc);
      initialMap[d.id] = fullInPayCurr > 0 ? String(round2(fullInPayCurr)) : '';
    });
    setPayAmounts(initialMap);
    setPayObs('');
    setNotice(null);
    setScreen('register_payment');
  };

  const parsedPayTc = useMemo(() => {
    const n = Number(String(payTc).replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [payTc]);

  const paymentPreviewRows = useMemo(() => {
    const targets = selectedDebts.length > 0 ? selectedDebts : pendingDebts;
    return targets.map((d) => {
      const rawStr = payAmounts[d.id] ?? '';
      const amountInPayCurr = Number(String(rawStr).replace(',', '.'));
      const validNum = Number.isFinite(amountInPayCurr) && amountInPayCurr > 0 ? round2(amountInPayCurr) : 0;
      const equivInDebtCurr =
        parsedPayTc > 0
          ? convertPaymentToDebtCurrency(validNum, payCurrency, d.moneda, parsedPayTc)
          : d.moneda === payCurrency
          ? validNum
          : 0;
      const maxInPayCurr =
        parsedPayTc > 0
          ? convertDebtToPaymentCurrency(d.totalPendiente, d.moneda, payCurrency, parsedPayTc)
          : d.moneda === payCurrency
          ? d.totalPendiente
          : 0;
      const exceeds = equivInDebtCurr > d.totalPendiente + 0.02;
      const split = splitDebtApplication(
        Math.min(equivInDebtCurr, d.totalPendiente),
        d.interesAcumulado,
        d.capitalPendiente
      );
      return {
        debt: d,
        amountInPayCurr: validNum,
        equivInDebtCurr,
        maxInPayCurr: round2(maxInPayCurr),
        exceeds,
        split,
      };
    });
  }, [selectedDebts, pendingDebts, payAmounts, payCurrency, parsedPayTc]);

  const paymentSummaryTotals = useMemo(() => {
    let totalInPayCurr = 0;
    let totalUsdApplied = 0;
    let totalBobApplied = 0;
    let totalInterestUsd = 0;
    let totalInterestBob = 0;
    let hasExceed = false;
    let appliedCount = 0;

    for (const row of paymentPreviewRows) {
      if (row.exceeds) hasExceed = true;
      if (row.amountInPayCurr > 0) {
        appliedCount += 1;
        totalInPayCurr = round2(totalInPayCurr + row.amountInPayCurr);
        if (row.debt.moneda === 'USD') {
          totalUsdApplied = round2(totalUsdApplied + row.equivInDebtCurr);
          totalInterestUsd = round2(totalInterestUsd + row.split.interesPagado);
        } else {
          totalBobApplied = round2(totalBobApplied + row.equivInDebtCurr);
          totalInterestBob = round2(totalInterestBob + row.split.interesPagado);
        }
      }
    }
    return {
      totalInPayCurr,
      totalUsdApplied,
      totalBobApplied,
      totalInterestUsd,
      totalInterestBob,
      hasExceed,
      appliedCount,
    };
  }, [paymentPreviewRows]);

  const handlePaymentCurrencyChange = (nextCurrency: Currency) => {
    if (nextCurrency === payCurrency) return;
    const tc = parsedPayTc > 0 ? parsedPayTc : 6.96;
    const nextMap: Record<string, string> = {};
    for (const row of paymentPreviewRows) {
      if (row.amountInPayCurr > 0) {
        const converted = convertPaymentToDebtCurrency(row.amountInPayCurr, payCurrency, nextCurrency, tc);
        nextMap[row.debt.id] = String(round2(converted));
      } else {
        nextMap[row.debt.id] = '';
      }
    }
    setPayCurrency(nextCurrency);
    setPayAmounts(nextMap);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;
    setNotice(null);

    if (parsedPayTc <= 0) {
      setNotice({
        type: 'err',
        text: bi('El tipo de cambio debe ser mayor a 0.', 'Exchange rate must be greater than 0.'),
      });
      return;
    }
    if (paymentSummaryTotals.appliedCount === 0 || paymentSummaryTotals.totalInPayCurr <= 0) {
      setNotice({
        type: 'err',
        text: bi('Ingresa un monto mayor a 0 en al menos una deuda.', 'Enter an amount greater than 0 on at least one debt.'),
      });
      return;
    }
    if (paymentSummaryTotals.hasExceed) {
      setNotice({
        type: 'err',
        text: bi(
          'El monto ingresado supera el saldo pendiente de una o más deudas.',
          'Entered amount exceeds the pending balance on one or more debts.'
        ),
      });
      return;
    }

    setSubmittingPayment(true);
    try {
      const aplicaciones = paymentPreviewRows
        .filter((r) => r.amountInPayCurr > 0)
        .map((r) => ({
          deudaTipo: r.debt.deudaTipo,
          deudaId: r.debt.deudaId,
          importeOriginalPagado: r.amountInPayCurr,
        }));

      const res = await backend.registerArPayment({
        clienteId: selectedCustomerId,
        fecha: payDate,
        monedaPago: payCurrency,
        tcAplicado: parsedPayTc,
        observacion: payObs.trim(),
        aplicaciones,
      });

      await Promise.all([
        loadCustomerDetail(selectedCustomerId, true),
        loadSummary(true),
        onDataMutated ? Promise.resolve(onDataMutated()) : Promise.resolve(),
      ]);

      setSelectedDebtKeys([]);
      if (res.receipt) {
        setActiveReceipt(res.receipt);
        setPreviewReturnScreen('customer_detail');
        setScreen('preview_receipt');
      } else {
        setNotice({
          type: 'ok',
          text: bi('Cobro registrado correctamente.', 'Payment registered successfully.'),
        });
        setScreen('customer_detail');
      }
    } catch (err: any) {
      setNotice({
        type: 'err',
        text: err?.message || bi('No se pudo registrar el cobro.', 'Could not register payment.'),
      });
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleGenerateDebitNote = async () => {
    if (!selectedCustomerId) return;
    const targets = selectedDebts.length > 0 ? selectedDebts : pendingDebts;
    if (targets.length === 0) {
      setNotice({
        type: 'err',
        text: bi('Selecciona al menos una deuda pendiente.', 'Select at least one pending debt.'),
      });
      return;
    }
    setGeneratingDebitNote(true);
    setNotice(null);
    try {
      const note = await backend.createDebitNote({
        clienteId: selectedCustomerId,
        fecha: todayIso(),
        deudas: targets.map((d) => ({ deudaTipo: d.deudaTipo, deudaId: d.deudaId })),
        observacion: debitNoteObs.trim(),
      });
      setShowDebitNoteConfirm(false);
      setDebitNoteObs('');
      await loadCustomerDetail(selectedCustomerId, true);
      setActiveDebitNote(note);
      setPreviewReturnScreen('customer_detail');
      setScreen('preview_debit_note');
    } catch (err: any) {
      setNotice({
        type: 'err',
        text: err?.message || bi('No se pudo generar la Nota de Débito.', 'Could not generate Debit Note.'),
      });
    } finally {
      setGeneratingDebitNote(false);
    }
  };

  const handleAssignCustomerToDebt = async () => {
    if (!assigningDebt || !assignTargetCustomerId) return;
    setAssignSaving(true);
    setNotice(null);
    try {
      await backend.assignDebtCustomer({
        deudaTipo: assigningDebt.deudaTipo,
        deudaId: assigningDebt.deudaId,
        clienteId: assignTargetCustomerId,
      });
      setAssigningDebt(null);
      setAssignTargetCustomerId('');
      await Promise.all([
        loadSummary(true),
        onDataMutated ? Promise.resolve(onDataMutated()) : Promise.resolve(),
      ]);
      setNotice({
        type: 'ok',
        text: bi('Cliente asignado correctamente a la deuda.', 'Customer assigned to debt successfully.'),
      });
    } catch (err: any) {
      setNotice({
        type: 'err',
        text: err?.message || bi('No se pudo asignar el cliente.', 'Could not assign customer.'),
      });
    } finally {
      setAssignSaving(false);
    }
  };

  const handleCancelPaymentConfirmed = async () => {
    if (!confirmCancelPayment || !selectedCustomerId) return;
    const target = confirmCancelPayment;
    setConfirmCancelPayment(null);
    setCancellingPaymentId(target.id);
    setNotice(null);
    try {
      await backend.cancelArPayment(target.cobroId || target.id);
      await Promise.all([
        loadCustomerDetail(selectedCustomerId, true),
        loadSummary(true),
        onDataMutated ? Promise.resolve(onDataMutated()) : Promise.resolve(),
      ]);
      setNotice({
        type: 'ok',
        text: bi('Cobro anulado y saldos recalculados.', 'Payment cancelled and balances recalculated.'),
      });
    } catch (err: any) {
      setNotice({
        type: 'err',
        text: err?.message || bi('No se pudo anular el cobro.', 'Could not cancel payment.'),
      });
    } finally {
      setCancellingPaymentId(null);
    }
  };

  // -----------------------------------------------------------
  // SCREEN: DOCUMENT PREVIEW (DEBIT NOTE OR PAYMENT RECEIPT)
  // -----------------------------------------------------------
  if (screen === 'preview_debit_note' && activeDebitNote) {
    return (
      <DocumentPreviewScreen
        mode="debit_note"
        debitNote={activeDebitNote}
        onBack={() => setScreen(previewReturnScreen)}
      />
    );
  }

  if (screen === 'preview_receipt' && activeReceipt) {
    return (
      <DocumentPreviewScreen
        mode="payment_receipt"
        paymentReceipt={activeReceipt}
        onBack={() => setScreen(previewReturnScreen)}
      />
    );
  }

  // -----------------------------------------------------------
  // SCREEN: PAYMENT & DOCUMENT HISTORY
  // -----------------------------------------------------------
  if (screen === 'history' && detailData) {
    const receiptsByCobroId = new Map<string, PaymentReceiptRecord>();
    detailData.paymentReceipts.forEach((r) => {
      if (r.cobroId) receiptsByCobroId.set(r.cobroId, r);
      if (r.numero) receiptsByCobroId.set(r.numero, r);
    });

    const sortedPayments = [...detailData.payments].sort((a, b) =>
      backend.compareChronologicalDesc(a, b)
    );
    const sortedDebitNotes = [...detailData.debitNotes].sort((a, b) =>
      backend.compareChronologicalDesc(a, b)
    );

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-[#E7ECE8]">
          <button
            type="button"
            onClick={() => setScreen('customer_detail')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE2DD] bg-white text-[#26352D] hover:bg-[#F5F7F4] transition cursor-pointer"
            aria-label={t('common.back')}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#26352D] truncate">
              {bi('Historial de cobros y notas', 'Payment & document history')}
            </h2>
            <p className="text-xs text-[#64746B] truncate">{detailData.customer.nombre}</p>
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

        {/* Payments & Receipts */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#64746B]">
            {bi('Cobros registrados', 'Recorded payments')} ({sortedPayments.length})
          </h3>
          {sortedPayments.length === 0 ? (
            <div className="rounded-2xl border border-[#E2E7E3] bg-white px-4 py-6 text-center text-xs text-[#64746B]">
              {bi('Este cliente no tiene cobros registrados.', 'This customer has no recorded payments.')}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#E2E7E3] bg-white divide-y divide-[#EEF2EF] overflow-hidden">
              {sortedPayments.map((p) => {
                const receipt =
                  receiptsByCobroId.get(p.cobroId) ||
                  receiptsByCobroId.get(p.id) ||
                  (p.notaCobroNumero ? receiptsByCobroId.get(p.notaCobroNumero) : undefined);
                const isCancelling = cancellingPaymentId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`p-3.5 space-y-2 ${p.anulado ? 'bg-[#FAF6F6] opacity-70' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-bold text-[#1F2D25] tabular-nums whitespace-nowrap">
                            {fmtMoney(p.importeOriginalPagado, p.monedaPago)}
                          </span>
                          <span className="text-[11px] font-semibold text-[#64746B] tabular-nums">
                            · {fmtDate(p.fecha)}
                          </span>
                          {p.notaCobroNumero && (
                            <span className="text-[11px] font-bold text-[#1D5C3F] tabular-nums">
                              · {p.notaCobroNumero}
                            </span>
                          )}
                          {p.anulado && (
                            <span className="text-[11px] font-bold text-[#B42323]">
                              ({bi('ANULADO', 'CANCELLED')})
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#64746B] mt-0.5">
                          {p.tipoPago === 'TOTAL'
                            ? bi('Pago total', 'Full payment')
                            : bi('Pago parcial', 'Partial payment')}
                          {' · '}
                          TC {fmtNum(p.tcAplicado)}
                          {p.aplicaciones.length > 0 && (
                            <span>
                              {' · '}
                              {p.aplicaciones.length}{' '}
                              {p.aplicaciones.length === 1
                                ? bi('deuda', 'debt')
                                : bi('deudas', 'debts')}
                            </span>
                          )}
                        </p>
                        {p.observacion && (
                          <p className="text-xs text-[#4B5A52] mt-1">{p.observacion}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {receipt && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveReceipt(receipt);
                              setPreviewReturnScreen('history');
                              setScreen('preview_receipt');
                            }}
                            className="h-8 px-2.5 rounded-lg border border-[#CFD8D2] bg-white hover:bg-[#EAF5EE] text-xs font-semibold text-[#1D5C3F] inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                            <span>{bi('Nota', 'Receipt')}</span>
                          </button>
                        )}
                        {!p.anulado && (
                          <button
                            type="button"
                            disabled={isCancelling}
                            onClick={() => setConfirmCancelPayment(p)}
                            className="h-8 px-2.5 rounded-lg border border-[#DCE2DD] bg-white hover:bg-[#FCECEC] text-xs font-semibold text-[#B42323] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>{bi('Anular', 'Cancel')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Debit Notes */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#64746B]">
            {bi('Notas de débito emitidas', 'Issued debit notes')} ({sortedDebitNotes.length})
          </h3>
          {sortedDebitNotes.length === 0 ? (
            <div className="rounded-2xl border border-[#E2E7E3] bg-white px-4 py-6 text-center text-xs text-[#64746B]">
              {bi('No hay notas de débito emitidas para este cliente.', 'No debit notes issued for this customer.')}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#E2E7E3] bg-white divide-y divide-[#EEF2EF] overflow-hidden">
              {sortedDebitNotes.map((dn) => (
                <div key={dn.id} className="p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#1F2D25] tabular-nums">
                      {dn.numero} <span className="text-xs font-normal text-[#64746B]">· {fmtDate(dn.fecha)}</span>
                    </p>
                    <p className="text-xs font-semibold text-[#4B5A52] tabular-nums mt-0.5">
                      {dn.totalUsd > 0 && <span className="whitespace-nowrap">{fmtMoney(dn.totalUsd, 'USD')}</span>}
                      {dn.totalUsd > 0 && dn.totalBob > 0 && <span className="mx-1.5">·</span>}
                      {dn.totalBob > 0 && <span className="whitespace-nowrap">{fmtMoney(dn.totalBob, 'BOB')}</span>}
                      <span className="font-normal text-[#64746B] ml-1.5">
                        ({dn.items.length} {dn.items.length === 1 ? bi('ítem', 'item') : bi('ítems', 'items')})
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDebitNote(dn);
                      setPreviewReturnScreen('history');
                      setScreen('preview_debit_note');
                    }}
                    className="h-8 px-3 rounded-lg border border-[#CFD8D2] bg-white hover:bg-[#F5F7F4] text-xs font-semibold text-[#26352D] inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>{bi('Ver / Reimprimir', 'View / Reprint')}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Confirm Cancel Payment Modal */}
        {confirmCancelPayment && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
            onClick={() => setConfirmCancelPayment(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white border border-[#DCE2DD] p-4 space-y-3 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-bold text-[#26352D]">
                {bi('Anular cobro registrado', 'Cancel recorded payment')}
              </h3>
              <p className="text-xs text-[#5E6D64] leading-relaxed">
                {bi(
                  `¿Deseas anular el cobro de ${fmtMoney(confirmCancelPayment.importeOriginalPagado, confirmCancelPayment.monedaPago)} del ${confirmCancelPayment.fecha}? Se revertirán las aplicaciones a capital e intereses y cualquier ingreso por interés de mora vinculado.`,
                  `Cancel the payment of ${fmtMoney(confirmCancelPayment.importeOriginalPagado, confirmCancelPayment.monedaPago)} from ${confirmCancelPayment.fecha}? Principal/interest applications and any linked late-payment interest income will be reversed.`
                )}
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmCancelPayment(null)}
                  className="h-9 px-3.5 rounded-xl border border-[#CFD8D2] bg-white text-xs font-semibold text-[#4B5A52] hover:bg-[#F5F7F4] cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleCancelPaymentConfirmed}
                  className="h-9 px-4 rounded-xl bg-[#C44545] hover:bg-[#A93838] text-xs font-bold text-white cursor-pointer"
                >
                  {bi('Anular cobro', 'Cancel payment')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -----------------------------------------------------------
  // SCREEN: REGISTER MULTI-DEBT / MULTI-CURRENCY PAYMENT
  // -----------------------------------------------------------
  if (screen === 'register_payment' && detailData) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-[#E7ECE8]">
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setScreen('customer_detail');
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE2DD] bg-white text-[#26352D] hover:bg-[#F5F7F4] transition cursor-pointer"
            aria-label={t('common.back')}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#26352D] truncate">
              {bi('Registrar cobro', 'Record payment')}
            </h2>
            <p className="text-xs text-[#64746B] truncate">{detailData.customer.nombre}</p>
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

        <form onSubmit={handleSubmitPayment} className="space-y-4">
          {/* Payment metadata */}
          <div className="rounded-2xl border border-[#E2E7E3] bg-white p-4 space-y-3">
            <Switch<Currency>
              label={bi('Moneda de pago', 'Payment currency')}
              value={payCurrency}
              onChange={handlePaymentCurrencyChange}
              leftOption={{ value: 'USD', label: 'USD' }}
              rightOption={{ value: 'BOB', label: 'Bs' }}
            />

            <div className="grid grid-cols-2 gap-2.5 items-end">
              <div className="min-w-0">
                <label className="block text-[13px] font-semibold text-[#26352D] mb-1 whitespace-nowrap truncate">
                  {t('common.date')}
                  <span className="text-[#C44545] ml-0.5">*</span>
                </label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  required
                  className="w-full h-[40px] rounded-xl border border-[#CFD8D2] bg-white px-2.5 text-sm font-medium text-[#1F2D25] tabular-nums focus:border-[#24875B] focus:outline-none"
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
                  value={payTc}
                  onChange={(e) => setPayTc(e.target.value)}
                  required
                  className="w-full h-[40px] rounded-xl border border-[#CFD8D2] bg-white px-3 text-sm font-semibold text-[#1F2D25] tabular-nums focus:border-[#24875B] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Per-debt distribution */}
          <div className="rounded-2xl border border-[#E2E7E3] bg-white divide-y divide-[#EEF2EF] overflow-hidden">
            <div className="px-4 py-2.5 bg-[#F7F9F7] flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#5E6D64]">
                {bi('Distribución por deuda', 'Distribution by debt')}
              </span>
              <button
                type="button"
                onClick={() => {
                  const next: Record<string, string> = {};
                  paymentPreviewRows.forEach((r) => {
                    next[r.debt.id] = r.maxInPayCurr > 0 ? String(r.maxInPayCurr) : '';
                  });
                  setPayAmounts(next);
                }}
                className="text-xs font-bold text-[#24875B] hover:underline cursor-pointer shrink-0"
              >
                {bi('Completar todo', 'Fill all')}
              </button>
            </div>

            {paymentPreviewRows.map((row) => {
              const d = row.debt;
              const isCross = d.moneda !== payCurrency;
              return (
                <div key={d.id} className="p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#1F2D25] truncate">{d.concepto}</p>
                      <p className="text-xs text-[#64746B]">
                        {d.origen === 'MAQUINARIAS' ? t('nav.machinery') : t('nav.property')}
                        {d.loteNombre ? ` · ${d.loteNombre}` : ''}
                        {d.campanaNombre ? ` · ${d.campanaNombre}` : ''}
                        {` · ${fmtDate(d.fecha)}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-extrabold text-[#1F2D25] tabular-nums whitespace-nowrap">
                        {bi('Saldo:', 'Due:')} {fmtMoney(d.totalPendiente, d.moneda)}
                      </p>
                      <p className="text-[11px] text-[#64746B] tabular-nums whitespace-nowrap">
                        {bi('Cap:', 'Prin:')} {fmtNum(d.capitalPendiente)}
                        {d.interesAcumulado > 0 ? ` · Int: ${fmtNum(d.interesAcumulado)}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#64746B]">
                        {payCurrency === 'USD' ? 'USD' : 'Bs'}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={payAmounts[d.id] ?? ''}
                        onChange={(e) =>
                          setPayAmounts((prev) => ({ ...prev, [d.id]: e.target.value }))
                        }
                        placeholder="0.00"
                        className={`w-full h-[40px] pl-12 pr-3 rounded-xl border text-sm font-bold tabular-nums focus:outline-none ${
                          row.exceeds
                            ? 'border-[#C44545] bg-[#FCECEC]/40 text-[#B42323]'
                            : 'border-[#CFD8D2] bg-white text-[#1F2D25] focus:border-[#24875B]'
                        }`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPayAmounts((prev) => ({ ...prev, [d.id]: String(row.maxInPayCurr) }))
                      }
                      className="h-[40px] px-3 rounded-xl border border-[#CFD8D2] bg-[#F7F9F7] hover:bg-[#EAF5EE] text-xs font-bold text-[#1D5C3F] transition cursor-pointer whitespace-nowrap"
                    >
                      {bi('Saldo total', 'Full balance')}
                    </button>
                  </div>

                  {/* Live application breakdown */}
                  {row.amountInPayCurr > 0 && (
                    <div
                      className={`rounded-xl px-3 py-2 text-xs space-y-0.5 tabular-nums ${
                        row.exceeds
                          ? 'bg-[#FCECEC] text-[#962D2D]'
                          : 'bg-[#F5F9F6] text-[#2B4739]'
                      }`}
                    >
                      {row.exceeds ? (
                        <p className="font-semibold">
                          {bi(
                            `Supera el máximo permitido (${fmtMoney(row.maxInPayCurr, payCurrency)}).`,
                            `Exceeds maximum allowed (${fmtMoney(row.maxInPayCurr, payCurrency)}).`
                          )}
                        </p>
                      ) : (
                        <>
                          {isCross && (
                            <p>
                              {bi('Equivalente:', 'Equivalent:')}{' '}
                              <strong className="whitespace-nowrap">{fmtMoney(row.equivInDebtCurr, d.moneda)}</strong> (TC {fmtNum(parsedPayTc)})
                            </p>
                          )}
                          <p>
                            {bi('1° Interés:', '1st Interest:')}{' '}
                            <strong className="whitespace-nowrap">{fmtMoney(row.split.interesPagado, d.moneda)}</strong>
                            {' · '}
                            {bi('2° Capital:', '2nd Principal:')}{' '}
                            <strong className="whitespace-nowrap">{fmtMoney(row.split.capitalPagado, d.moneda)}</strong>
                            {' · '}
                            {bi('Resta:', 'Left:')}{' '}
                            <strong className="whitespace-nowrap">{fmtMoney(row.split.totalRestante, d.moneda)}</strong>
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Live Totals Summary */}
          <div className="rounded-2xl border border-[#24875B]/30 bg-[#EAF5EE] p-3.5 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase text-[#1D5C3F]">
                {bi('Total a cobrar', 'Total to collect')} ({paymentSummaryTotals.appliedCount})
              </span>
              <span className="text-base font-extrabold text-[#1D5C3F] tabular-nums whitespace-nowrap">
                {fmtMoney(paymentSummaryTotals.totalInPayCurr, payCurrency)}
              </span>
            </div>
            {(paymentSummaryTotals.totalInterestUsd > 0 || paymentSummaryTotals.totalInterestBob > 0) && (
              <p className="text-xs text-[#2B4739]">
                {bi(
                  'Se registrará ingreso por interés por mora:',
                  'Late payment interest income will be recorded:'
                )}{' '}
                <strong className="tabular-nums whitespace-nowrap">
                  {[
                    paymentSummaryTotals.totalInterestUsd > 0
                      ? fmtMoney(paymentSummaryTotals.totalInterestUsd, 'USD')
                      : '',
                    paymentSummaryTotals.totalInterestBob > 0
                      ? fmtMoney(paymentSummaryTotals.totalInterestBob, 'BOB')
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </strong>
              </p>
            )}
          </div>

          {/* Observation with Voice Dictation */}
          <div className="rounded-2xl border border-[#E2E7E3] bg-white p-4">
            <ObservationField
              value={payObs}
              onChange={setPayObs}
              placeholder={bi(
                'Ej. Transferencia bancaria, efectivo, referencia...',
                'e.g. Bank transfer, cash, reference...'
              )}
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setScreen('customer_detail')}
              className="h-[42px] px-4 rounded-xl border border-[#CFD8D2] bg-white text-sm font-semibold text-[#4B5A52] hover:bg-[#F5F7F4] cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={
                submittingPayment ||
                paymentSummaryTotals.hasExceed ||
                paymentSummaryTotals.totalInPayCurr <= 0
              }
              className="h-[42px] px-5 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white text-sm font-bold inline-flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              {submittingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              <span>
                {submittingPayment
                  ? bi('Registrando cobro...', 'Recording payment...')
                  : bi('Confirmar cobro y generar nota', 'Confirm payment & receipt')}
              </span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  // -----------------------------------------------------------
  // SCREEN: CUSTOMER ACCOUNT DETAIL
  // -----------------------------------------------------------
  if (screen === 'customer_detail' && selectedCustomerId) {
    const cust = detailData?.customer || customers.find((c) => c.id === selectedCustomerId);
    const summ = detailData?.summary;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-[#E7ECE8]">
          <button
            type="button"
            onClick={() => {
              if (initialCustomerId) {
                onBack();
              } else {
                setScreen('list');
                setSelectedCustomerId(null);
                setNotice(null);
                setDetailError(null);
              }
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE2DD] bg-white text-[#26352D] hover:bg-[#F5F7F4] transition cursor-pointer"
            aria-label={t('common.back')}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-[#26352D] leading-snug">
              {cust?.nombre || bi('Cuenta de cliente', 'Customer account')}
            </h2>
            <p className="text-xs text-[#64746B] truncate">
              {cust?.telefono ? `${cust.telefono}` : bi('Sin teléfono', 'No phone')}
              {refreshingDetail ? ` · ${bi('Actualizando...', 'Updating...')}` : ''}
            </p>
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

        {loadingDetail && !detailData ? (
          <div className="rounded-2xl border border-[#E2E7E3] bg-white p-8 flex items-center justify-center gap-2 text-sm text-[#5E6D64]">
            <Loader2 className="h-4 w-4 animate-spin text-[#24875B]" />
            <span>{bi('Cargando cuenta del cliente...', 'Loading customer account...')}</span>
          </div>
        ) : detailError && !detailData ? (
          <div className="rounded-2xl border border-[#C44545]/25 bg-white p-6 text-center space-y-3">
            <AlertCircle className="h-7 w-7 text-[#C44545] mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-[#26352D]">
                {bi('No se pudo cargar la cuenta del cliente', 'Could not load customer account')}
              </p>
              <p className="text-xs text-[#64746B] break-words">{detailError}</p>
            </div>
            <button
              type="button"
              onClick={() => loadCustomerDetail(selectedCustomerId, true)}
              className="h-9 px-4 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white text-xs font-bold cursor-pointer"
            >
              {bi('Reintentar', 'Retry')}
            </button>
          </div>
        ) : (
          <>
            {/* Customer Totals Header (USD & Bs strictly separated, side-by-side even on mobile) */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-[#E2E7E3] bg-white p-3 space-y-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#64746B]">
                    USD
                  </span>
                  {(summ?.registrosVencidos || 0) > 0 && (
                    <span className="text-[11px] font-bold text-[#B42323] whitespace-nowrap">
                      {summ?.registrosVencidos} {bi('venc.', 'ovd.')}
                    </span>
                  )}
                </div>
                <p className="text-base sm:text-xl font-extrabold text-[#1F2D25] tabular-nums whitespace-nowrap">
                  {fmtMoney(summ?.usd.totalPendiente || 0, 'USD')}
                </p>
                <div className="text-[11px] text-[#64746B] space-y-0.5 tabular-nums">
                  <p className="whitespace-nowrap truncate">
                    {bi('Capital:', 'Principal:')} {fmtNum(summ?.usd.capitalPendiente || 0)}
                  </p>
                  <p className="whitespace-nowrap truncate">
                    {bi('Interés:', 'Interest:')} {fmtNum(summ?.usd.interesAcumulado || 0)}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E2E7E3] bg-white p-3 space-y-1 min-w-0">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#64746B]">
                  Bs
                </span>
                <p className="text-base sm:text-xl font-extrabold text-[#1F2D25] tabular-nums whitespace-nowrap">
                  {fmtMoney(summ?.bob.totalPendiente || 0, 'BOB')}
                </p>
                <div className="text-[11px] text-[#64746B] space-y-0.5 tabular-nums">
                  <p className="whitespace-nowrap truncate">
                    {bi('Capital:', 'Principal:')} {fmtNum(summ?.bob.capitalPendiente || 0)}
                  </p>
                  <p className="whitespace-nowrap truncate">
                    {bi('Interés:', 'Interest:')} {fmtNum(summ?.bob.interesAcumulado || 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Primary Actions Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                disabled={pendingDebts.length === 0}
                onClick={openPaymentScreen}
                className="h-[40px] px-3 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-45"
              >
                <DollarSign className="h-4 w-4" />
                <span>
                  {selectedDebts.length > 0
                    ? bi(`Registrar cobro (${selectedDebts.length})`, `Record payment (${selectedDebts.length})`)
                    : bi('Registrar cobro', 'Record payment')}
                </span>
              </button>

              <button
                type="button"
                disabled={pendingDebts.length === 0 || generatingDebitNote}
                onClick={() => setShowDebitNoteConfirm(true)}
                className="h-[40px] px-3 rounded-xl border border-[#CFD8D2] bg-white hover:bg-[#F5F7F4] text-[#26352D] text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-45"
              >
                <FileText className="h-4 w-4" />
                <span>
                  {selectedDebts.length > 0
                    ? bi(`Nota de débito (${selectedDebts.length})`, `Debit note (${selectedDebts.length})`)
                    : bi('Generar nota de débito', 'Generate debit note')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setScreen('history')}
                className="h-[40px] px-3 rounded-xl border border-[#CFD8D2] bg-white hover:bg-[#F5F7F4] text-[#26352D] text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <History className="h-4 w-4" />
                <span>
                  {bi('Historial', 'History')} ({detailData?.payments.length || 0})
                </span>
              </button>
            </div>

            {/* Debts Selection & Detailed Breakdown */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#64746B]">
                  {bi('Deudas pendientes', 'Pending debts')} ({pendingDebts.length})
                </h3>
                {pendingDebts.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAllDebts}
                    className="text-xs font-bold text-[#24875B] hover:underline cursor-pointer"
                  >
                    {selectedDebtKeys.length === pendingDebts.length
                      ? bi('Deseleccionar todas', 'Unselect all')
                      : bi('Seleccionar todas', 'Select all')}
                  </button>
                )}
              </div>

              {pendingDebts.length === 0 ? (
                <div className="rounded-2xl border border-[#E2E7E3] bg-white px-4 py-8 text-center space-y-1">
                  <p className="text-sm font-semibold text-[#1D5C3F]">
                    {bi('Sin saldo pendiente', 'No pending balance')}
                  </p>
                  <p className="text-xs text-[#64746B]">
                    {bi(
                      'Puedes consultar cobros anteriores y reimprimir notas desde Historial.',
                      'You can review prior payments and reprint documents from History.'
                    )}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {pendingDebts.map((d) => {
                    const checked = selectedDebtKeys.includes(d.id);
                    return (
                      <div
                        key={d.id}
                        onClick={() => toggleDebtSelection(d.id)}
                        className={`rounded-2xl border p-3.5 transition cursor-pointer ${
                          checked
                            ? 'border-[#24875B] bg-[#F5FBF7]'
                            : 'border-[#E2E7E3] bg-white hover:border-[#B9C8BF]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center shrink-0 ${
                              checked
                                ? 'border-[#24875B] bg-[#24875B] text-white'
                                : 'border-[#B9C8BF] bg-white'
                            }`}
                          >
                            {checked && <Check className="h-3.5 w-3.5" />}
                          </div>

                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-[#1F2D25] leading-snug">
                                  {d.concepto}
                                </p>
                                <p className="text-xs text-[#64746B] mt-0.5">
                                  {d.origen === 'MAQUINARIAS' ? t('nav.machinery') : t('nav.property')}
                                  {d.campanaNombre ? ` · ${d.campanaNombre}` : ''}
                                  {d.loteNombre ? ` · ${d.loteNombre}` : ''}
                                  {` · ${fmtDate(d.fecha)}`}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-extrabold text-[#1F2D25] tabular-nums whitespace-nowrap">
                                  {fmtMoney(d.totalPendiente, d.moneda)}
                                </p>
                                <p
                                  className={`text-[11px] font-bold whitespace-nowrap ${
                                    d.vencida ? 'text-[#B42323]' : 'text-[#5E6D64]'
                                  }`}
                                >
                                  {d.vencida
                                    ? bi(`Vencida (${d.diasAtraso}d)`, `Overdue (${d.diasAtraso}d)`)
                                    : d.estado === 'PARCIAL'
                                    ? bi('Pago parcial', 'Partial')
                                    : bi('Pendiente', 'Pending')}
                                </p>
                              </div>
                            </div>

                            {/* Compact administrative grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1.5 pt-2 border-t border-[#EEF2EF] text-[11px]">
                              <div>
                                <span className="text-[#7A8780] block">{bi('Importe original', 'Original amount')}</span>
                                <span className="font-semibold text-[#1F2D25] tabular-nums whitespace-nowrap">
                                  {fmtMoney(d.importeOriginal, d.moneda)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[#7A8780] block">{bi('Pagos anteriores', 'Prior payments')}</span>
                                <span className="font-semibold text-[#1F2D25] tabular-nums whitespace-nowrap">
                                  {fmtMoney(d.pagosAnteriores, d.moneda)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[#7A8780] block">{bi('Capital pendiente', 'Pending principal')}</span>
                                <span className="font-semibold text-[#1F2D25] tabular-nums whitespace-nowrap">
                                  {fmtMoney(d.capitalPendiente, d.moneda)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[#7A8780] block">{bi('Interés acumulado', 'Accrued interest')}</span>
                                <span className="font-semibold text-[#1F2D25] tabular-nums whitespace-nowrap">
                                  {fmtMoney(d.interesAcumulado, d.moneda)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[#7A8780] block">{bi('Vencimiento', 'Due date')}</span>
                                <span className="text-[#26352D] font-medium tabular-nums">
                                  {d.fechaVencimiento ? fmtDate(d.fechaVencimiento) : '—'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[#7A8780] block">{bi('Días de atraso', 'Days overdue')}</span>
                                <span className={`tabular-nums ${d.diasAtraso > 0 ? 'font-bold text-[#B42323]' : 'text-[#26352D]'}`}>
                                  {d.diasAtraso}
                                </span>
                              </div>
                              <div>
                                <span className="text-[#7A8780] block">{bi('Tasa mensual', 'Monthly rate')}</span>
                                <span className="text-[#26352D] font-medium tabular-nums">
                                  {d.aplicarInteres && d.tasaInteresMensual > 0
                                    ? `${fmtNum(d.tasaInteresMensual)}%`
                                    : bi('Sin interés', 'No interest')}
                                </span>
                              </div>
                              <div>
                                <span className="text-[#7A8780] block">{bi('Moneda', 'Currency')}</span>
                                <span className="font-semibold text-[#26352D]">
                                  {d.moneda === 'USD' ? 'USD' : 'Bs'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Debit Note confirmation modal */}
        {showDebitNoteConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
            onClick={() => setShowDebitNoteConfirm(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white border border-[#DCE2DD] p-4 space-y-3 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-bold text-[#26352D]">
                {bi('Generar Nota de Débito', 'Generate Debit Note')}
              </h3>
              <p className="text-xs text-[#5E6D64] leading-relaxed">
                {bi(
                  `Se emitirá una Nota de Débito histórica con ${
                    selectedDebts.length > 0 ? selectedDebts.length : pendingDebts.length
                  } deuda(s) seleccionada(s). No crea nuevas deudas ni ingresos.`,
                  `A historical Debit Note will be issued with ${
                    selectedDebts.length > 0 ? selectedDebts.length : pendingDebts.length
                  } selected debt(s). It creates no new debts or income.`
                )}
              </p>
              <ObservationField
                value={debitNoteObs}
                onChange={setDebitNoteObs}
                placeholder={bi('Observación opcional para el documento...', 'Optional note for the document...')}
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDebitNoteConfirm(false)}
                  className="h-9 px-3.5 rounded-xl border border-[#CFD8D2] bg-white text-xs font-semibold text-[#4B5A52] hover:bg-[#F5F7F4] cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  disabled={generatingDebitNote}
                  onClick={handleGenerateDebitNote}
                  className="h-9 px-4 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {generatingDebitNote && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{bi('Emitir nota', 'Issue note')}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -----------------------------------------------------------
  // SCREEN: CENTRALIZED ACCOUNTS RECEIVABLE LIST
  // -----------------------------------------------------------
  const totals = summaryData?.totals;
  const unassignedDebts = summaryData?.unassignedDebts || [];

  return (
    <div className="space-y-3.5">
      {/* Clean unclipped header (no secondary refresh button) */}
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
          <h2 className="text-base font-bold text-[#26352D] leading-snug">{t('ar.title')}</h2>
          <p className="text-xs text-[#64746B]">
            {bi('Todas las campañas y gestiones', 'All campaigns and years')}
            {refreshingSummary ? ` · ${bi('Actualizando...', 'Updating...')}` : ''}
          </p>
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

      {/* 4 DISTINCT STATES: 1. Loading | 2. Connection/Backend Error (NO $0 cards) | 3. Empty | 4. Loaded with data */}
      {loadingSummary && !summaryData && !summaryError ? (
        <div className="rounded-2xl border border-[#E2E7E3] bg-white p-8 flex items-center justify-center gap-2 text-sm text-[#5E6D64]">
          <Loader2 className="h-4 w-4 animate-spin text-[#24875B]" />
          <span>{bi('Cargando cuentas por cobrar...', 'Loading accounts receivable...')}</span>
        </div>
      ) : summaryError && !summaryData ? (
        <div className="rounded-2xl border border-[#C44545]/25 bg-white px-5 py-7 text-center space-y-3">
          <AlertCircle className="h-7 w-7 text-[#C44545] mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-[#26352D]">
              {bi('No se pudieron cargar las cuentas por cobrar', 'Could not load accounts receivable')}
            </p>
            <p className="text-xs text-[#64746B] leading-relaxed break-words">
              {summaryError}
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadSummary(true)}
            className="h-9 px-4 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white text-xs font-bold inline-flex items-center justify-center transition cursor-pointer"
          >
            {bi('Reintentar', 'Retry')}
          </button>
        </div>
      ) : (
        <>
          {/* Separate USD (left) and Bs (right) compact summary boxes side-by-side even on mobile */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl border border-[#E2E7E3] bg-white p-3 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64746B]">
                USD
              </p>
              <p className="text-base sm:text-xl font-extrabold text-[#1F2D25] tabular-nums whitespace-nowrap mt-0.5">
                {fmtMoney(totals?.totalUsd || 0, 'USD')}
              </p>
              <div className="mt-1.5 space-y-0.5 text-[11px] text-[#64746B] tabular-nums">
                <p className="whitespace-nowrap truncate">
                  {bi('Capital:', 'Principal:')} {fmtNum(totals?.capitalUsd || 0)}
                </p>
                <p className="whitespace-nowrap truncate">
                  {bi('Interés:', 'Interest:')} {fmtNum(totals?.interesUsd || 0)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E2E7E3] bg-white p-3 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64746B]">
                Bs
              </p>
              <p className="text-base sm:text-xl font-extrabold text-[#1F2D25] tabular-nums whitespace-nowrap mt-0.5">
                {fmtMoney(totals?.totalBob || 0, 'BOB')}
              </p>
              <div className="mt-1.5 space-y-0.5 text-[11px] text-[#64746B] tabular-nums">
                <p className="whitespace-nowrap truncate">
                  {bi('Capital:', 'Principal:')} {fmtNum(totals?.capitalBob || 0)}
                </p>
                <p className="whitespace-nowrap truncate">
                  {bi('Interés:', 'Interest:')} {fmtNum(totals?.interesBob || 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Unassigned Customer Debts Section */}
          {unassignedDebts.length > 0 && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50/70 overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-amber-200/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="h-4 w-4 text-amber-700 shrink-0" />
                  <span className="text-xs font-bold text-amber-950 truncate">
                    {bi(
                      `Sin cliente asignado (${unassignedDebts.length})`,
                      `Unassigned customer (${unassignedDebts.length})`
                    )}
                  </span>
                </div>
              </div>

              <div className="divide-y divide-amber-200/70">
                {unassignedDebts.map((d) => (
                  <div key={d.id} className="px-3.5 py-2.5 flex items-center justify-between gap-2.5 bg-white/75">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#1F2D25] truncate">{d.concepto}</p>
                      <p className="text-xs text-[#64746B] truncate">
                        {d.origen === 'MAQUINARIAS' ? t('nav.machinery') : t('nav.property')}
                        {d.loteNombre ? ` · ${d.loteNombre}` : ''}
                        {` · ${fmtDate(d.fecha)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-extrabold text-[#1F2D25] tabular-nums whitespace-nowrap">
                        {fmtMoney(d.totalPendiente, d.moneda)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAssigningDebt(d);
                          setAssignTargetCustomerId('');
                        }}
                        className="h-8 px-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span>{bi('Asignar', 'Assign')}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search + True Switch for "Mostrar clientes sin deuda" */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7A8780]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={bi('Buscar cliente...', 'Search customer...')}
                className="w-full h-[40px] pl-9 pr-3 rounded-xl border border-[#CFD8D2] bg-white text-sm text-[#1F2D25] focus:border-[#24875B] focus:outline-none"
              />
            </div>

            <div className="rounded-xl border border-[#E2E7E3] bg-white px-3.5 py-2">
              <Switch<boolean>
                inline
                label={bi('Mostrar clientes sin deuda', 'Show customers without debt')}
                value={showZeroBalanceCustomers}
                onChange={setShowZeroBalanceCustomers}
              />
            </div>
          </div>

          {/* Customers AR List (Empty vs Data) */}
          {filteredCustomerSummaries.length === 0 ? (
            <div className="rounded-2xl border border-[#E2E7E3] bg-white px-4 py-8 text-center text-sm font-medium text-[#5E6D64]">
              {search.trim()
                ? bi('No se encontraron clientes con ese nombre.', 'No customers match that search.')
                : bi('No hay clientes con saldo pendiente.', 'No customers with pending balance.')}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#E2E7E3] bg-white divide-y divide-[#EEF2EF] overflow-hidden">
              {filteredCustomerSummaries.map((c: ArCustomerSummary) => (
                <button
                  key={c.clienteId}
                  type="button"
                  onClick={() => openCustomerAccount(c.clienteId)}
                  className="w-full px-3.5 py-3 flex items-center justify-between gap-2.5 text-left hover:bg-[#F7F9F7] transition cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#1F2D25] truncate">{c.clienteNombre}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#64746B]">
                      {c.telefono && (
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Phone className="h-3 w-3" />
                          {c.telefono}
                        </span>
                      )}
                      {c.registrosPendientes > 0 && (
                        <span className="tabular-nums">
                          {c.registrosPendientes}{' '}
                          {c.registrosPendientes === 1
                            ? bi('pendiente', 'pending')
                            : bi('pendientes', 'pending')}
                        </span>
                      )}
                      {c.registrosVencidos > 0 && (
                        <span className="font-semibold text-[#B42323] whitespace-nowrap tabular-nums">
                          · {c.registrosVencidos}{' '}
                          {c.registrosVencidos === 1
                            ? bi('vencida', 'overdue')
                            : bi('vencidas', 'overdue')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="text-right tabular-nums">
                      {c.usd.totalPendiente > 0.005 && (
                        <p className="text-sm font-extrabold text-[#1F2D25] whitespace-nowrap">
                          {fmtMoney(c.usd.totalPendiente, 'USD')}
                        </p>
                      )}
                      {c.bob.totalPendiente > 0.005 && (
                        <p className="text-sm font-extrabold text-[#1F2D25] whitespace-nowrap">
                          {fmtMoney(c.bob.totalPendiente, 'BOB')}
                        </p>
                      )}
                      {c.usd.totalPendiente <= 0.005 && c.bob.totalPendiente <= 0.005 && (
                        <p className="text-xs font-semibold text-[#24875B] whitespace-nowrap">
                          {bi('Al día', 'Settled')}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#8A9890]" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Assign Customer to Unassigned Debt Modal */}
      {assigningDebt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onClick={() => setAssigningDebt(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white border border-[#DCE2DD] p-4 space-y-3.5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-[#26352D]">
              {bi('Asignar cliente a la deuda', 'Assign customer to debt')}
            </h3>
            <div className="rounded-xl bg-[#F7F9F7] border border-[#E7ECE8] p-2.5 text-xs">
              <p className="font-bold text-[#1F2D25]">{assigningDebt.concepto}</p>
              <p className="text-[#64746B] mt-0.5 tabular-nums">
                {fmtDate(assigningDebt.fecha)} · {fmtMoney(assigningDebt.totalPendiente, assigningDebt.moneda)}
              </p>
            </div>
            <CustomerPicker
              label={t('customers.selectCustomer')}
              customers={customers}
              selectedCustomerId={assignTargetCustomerId}
              onSelectCustomer={(c) => setAssignTargetCustomerId(c.id)}
              required
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAssigningDebt(null)}
                className="h-9 px-3.5 rounded-xl border border-[#CFD8D2] bg-white text-xs font-semibold text-[#4B5A52] hover:bg-[#F5F7F4] cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={!assignTargetCustomerId || assignSaving}
                onClick={handleAssignCustomerToDebt}
                className="h-9 px-4 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {assignSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{bi('Guardar asignación', 'Save assignment')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
