import React, { useEffect, useState } from 'react';
import { ArrowLeft, Download, Printer, Share2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { DebitNoteRecord, PaymentReceiptRecord } from '../types';
import { useI18n } from '../services/i18n';
import { formatDateLocale, formatMoneyLocale, formatNumberLocale } from '../services/formatters';
import {
  buildDebitNoteSecondaryMeta,
  buildPaymentReceiptSecondaryMeta,
  computeDebitNoteSummary,
  computePaymentReceiptLineDisplay,
  computePaymentReceiptSummary,
  formatDebitNoteDueCell,
  formatDocumentAmount,
  getCurrencyShortLabel,
  parseDocumentConcept,
} from '../services/documentFormatting';
import {
  generateDebitNotePdf,
  generatePaymentReceiptPdf,
  sharePdfViaWhatsApp,
  triggerBlobDownload,
} from '../services/pdfDocuments';

interface DocumentPreviewScreenProps {
  mode: 'debit_note' | 'payment_receipt';
  debitNote?: DebitNoteRecord;
  paymentReceipt?: PaymentReceiptRecord;
  onBack: () => void;
}

export const DocumentPreviewScreen: React.FC<DocumentPreviewScreenProps> = ({
  mode,
  debitNote,
  paymentReceipt,
  onBack,
}) => {
  const { lang, bi, t } = useI18n();
  const [busyAction, setBusyAction] = useState<'pdf' | 'wa' | null>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    document.body.classList.add('print-letter-doc');
    return () => {
      document.body.classList.remove('print-letter-doc');
    };
  }, []);

  const isDebit = mode === 'debit_note' && Boolean(debitNote);
  const isReceipt = mode === 'payment_receipt' && Boolean(paymentReceipt);

  const docTitle = isDebit
    ? bi('NOTA DE DÉBITO', 'DEBIT NOTE')
    : bi('NOTA DE COBRO', 'PAYMENT RECEIPT');
  const appTitle = bi('Maquinarias y Propiedad', 'Machinery & Property');
  const nonFiscal = bi(
    'Documento administrativo interno · No válido como factura fiscal',
    'Internal administrative document · Not valid as a tax invoice'
  );

  const docNumber = isDebit ? debitNote!.numero : paymentReceipt?.numero || '';
  const docDateRaw = isDebit ? debitNote!.fecha : paymentReceipt?.fecha || '';
  const docDate = formatDateLocale(docDateRaw, lang);
  const clientName = isDebit ? debitNote!.clienteNombre : paymentReceipt?.clienteNombre || '';
  const clientPhone = isDebit ? debitNote!.clienteTelefono : paymentReceipt?.clienteTelefono;
  const clientAddress = isDebit ? debitNote!.clienteDireccion : paymentReceipt?.clienteDireccion;
  const observation = (isDebit ? debitNote!.observacion : paymentReceipt?.observacion || '')?.trim();

  const debitSummary = isDebit ? computeDebitNoteSummary(debitNote!) : null;
  const receiptSummary = isReceipt ? computePaymentReceiptSummary(paymentReceipt!) : null;

  const buildPdf = async () => {
    if (isDebit && debitNote) {
      return generateDebitNotePdf(debitNote, lang);
    }
    if (isReceipt && paymentReceipt) {
      return generatePaymentReceiptPdf(paymentReceipt, lang);
    }
    throw new Error(bi('Documento no disponible.', 'Document not available.'));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    setBusyAction('pdf');
    setNotice(null);
    try {
      const { blob, filename } = await buildPdf();
      triggerBlobDownload(blob, filename);
      setNotice({
        type: 'ok',
        text: bi(`PDF descargado: ${filename}`, `PDF downloaded: ${filename}`),
      });
    } catch (err: any) {
      setNotice({
        type: 'err',
        text: err?.message || bi('No se pudo generar el PDF.', 'Could not generate PDF.'),
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleShareWhatsApp = async () => {
    setBusyAction('wa');
    setNotice(null);
    try {
      const { blob, filename } = await buildPdf();
      const summaryText = isDebit
        ? bi(
            `Hola ${clientName}, le compartimos la Nota de Débito N.° ${docNumber} del ${docDate} de ${appTitle}.`,
            `Hello ${clientName}, here is Debit Note No. ${docNumber} dated ${docDate} from ${appTitle}.`
          )
        : bi(
            `Hola ${clientName}, le compartimos la Nota de Cobro N.° ${docNumber} del ${docDate} de ${appTitle}.`,
            `Hello ${clientName}, here is Payment Receipt No. ${docNumber} dated ${docDate} from ${appTitle}.`
          );

      const res = await sharePdfViaWhatsApp({
        blob,
        filename,
        phone: clientPhone,
        message: summaryText,
        title: `${docTitle} ${docNumber}`,
      });

      if (res.method === 'web_share') {
        setNotice({
          type: 'ok',
          text: bi('Documento PDF compartido.', 'PDF document shared.'),
        });
      } else if (res.method === 'whatsapp_fallback') {
        setNotice({
          type: 'ok',
          text: bi(
            'PDF descargado y WhatsApp abierto. Adjunta el archivo descargado en el chat.',
            'PDF downloaded and WhatsApp opened. Attach the downloaded file in the chat.'
          ),
        });
      }
    } catch (err: any) {
      setNotice({
        type: 'err',
        text: err?.message || bi('No se pudo compartir el documento.', 'Could not share document.'),
      });
    } finally {
      setBusyAction(null);
    }
  };

  const debitCurrLabel = debitSummary?.singleCurrency
    ? getCurrencyShortLabel(debitSummary.singleCurrency)
    : null;
  const receiptCurrLabel = receiptSummary?.singleCurrency
    ? getCurrencyShortLabel(receiptSummary.singleCurrency)
    : null;

  return (
    <div className="space-y-4">
      {/* Top Action Bar (hidden on print) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#E5EAE6]">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE2DD] bg-white text-[#26352D] hover:bg-[#F5F7F4] transition cursor-pointer"
            aria-label={t('common.back')}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-[#1F2D25] truncate">
              {docTitle} {docNumber ? `· ${docNumber}` : ''}
            </h2>
            <p className="text-xs text-[#64746B] truncate">{clientName}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrint}
            className="h-9 px-3 rounded-xl border border-[#CFD8D2] bg-white hover:bg-[#F5F7F4] text-xs font-semibold text-[#26352D] inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>{bi('Imprimir', 'Print')}</span>
          </button>
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={handleDownloadPdf}
            className="h-9 px-3 rounded-xl border border-[#24875B] bg-[#24875B] hover:bg-[#1E734D] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" />
            <span>
              {busyAction === 'pdf'
                ? bi('Generando...', 'Generating...')
                : bi('Descargar PDF', 'Download PDF')}
            </span>
          </button>
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={handleShareWhatsApp}
            className="h-9 px-3 rounded-xl border border-[#1E8E5A]/30 bg-[#EAF6F0] hover:bg-[#DCF0E6] text-xs font-semibold text-[#16653E] inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>
              {busyAction === 'wa'
                ? bi('Preparando...', 'Preparing...')
                : bi('Compartir WhatsApp', 'Share WhatsApp')}
            </span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`no-print rounded-xl border px-3.5 py-2.5 text-xs font-medium flex items-start gap-2 ${
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

      {/* Letter Portrait Administrative Sheet */}
      <div className="print-doc-root max-w-[820px] mx-auto bg-white rounded-2xl border border-[#E2E7E3] shadow-sm px-4 py-5 sm:px-7 sm:py-6 text-[#111827] font-sans">
        {/* Document Header */}
        <div className="flex items-start justify-between gap-4 pb-3.5 border-b border-[#D1D5DB]">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/icon-192.png"
              alt={appTitle}
              className="h-9 w-9 rounded-lg object-contain shrink-0"
            />
            <div className="min-w-0">
              <p className="text-[15px] sm:text-base font-bold text-[#111827] leading-tight">
                {appTitle}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className="text-[14px] sm:text-[15px] font-bold tracking-wide text-[#111827] leading-tight">
              {docTitle}
            </p>
            <p className="text-xs font-semibold text-[#1F2937] mt-1 tabular-nums">
              {bi('N.°', 'No.')} {docNumber || '—'}
            </p>
            <p className="text-xs text-[#4B5563] mt-0.5 tabular-nums">
              {bi('Fecha', 'Date')}: {docDate}
            </p>
            {isReceipt && paymentReceipt?.anulado && (
              <p className="text-[11px] font-bold text-[#B91C1C] mt-1 uppercase tracking-wide">
                {bi('ANULADA', 'CANCELLED')}
              </p>
            )}
          </div>
        </div>

        {/* Client Info */}
        <div className="pt-3.5 pb-3.5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1.5">
          <div className="min-w-0">
            <p className="text-[15px] sm:text-[16px] font-bold text-[#111827] leading-snug">
              {clientName || '—'}
            </p>
            {(clientPhone || clientAddress) && (
              <p className="text-xs text-[#4B5563] mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                {clientPhone && (
                  <span>
                    {bi('Tel.', 'Phone')}: {clientPhone}
                  </span>
                )}
                {clientAddress && <span>{clientAddress}</span>}
              </p>
            )}
          </div>

          {isReceipt && paymentReceipt && (
            <div className="text-xs text-[#4B5563] sm:text-right tabular-nums">
              <span className="font-semibold text-[#1F2937]">
                {paymentReceipt.tipoPago === 'TOTAL'
                  ? bi('Pago total', 'Full payment')
                  : bi('Pago parcial', 'Partial payment')}
              </span>
              <span className="mx-1.5 text-[#9CA3AF]">·</span>
              <span>
                {bi('Recibido', 'Received')}:{' '}
                <strong className="font-semibold text-[#111827]">
                  {formatMoneyLocale(paymentReceipt.importeOriginalPagado, paymentReceipt.monedaPago, lang)}
                </strong>
              </span>
              {receiptSummary?.hasCrossCurrency && (
                <>
                  <span className="mx-1.5 text-[#9CA3AF]">·</span>
                  <span>
                    {bi('TC', 'FX')}: {formatNumberLocale(paymentReceipt.tcAplicado, lang, 2)}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* DEBIT NOTE TABLE — 8 columns with independent Vencimiento & Interés */}
        {isDebit && debitNote && debitSummary && (
          <>
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full border-collapse text-[11.5px]">
                <thead>
                  <tr className="bg-[#F3F4F6] text-[#374151] border-t border-b border-[#D1D5DB]">
                    <th className="py-2 px-1.5 text-left font-semibold whitespace-nowrap">
                      {bi('Fecha', 'Date')}
                    </th>
                    <th className="py-2 px-1.5 text-left font-semibold">
                      {bi('Concepto', 'Concept')}
                    </th>
                    <th className="py-2 px-1.5 text-right font-semibold whitespace-nowrap">
                      {bi('Cantidad', 'Qty')}
                    </th>
                    <th className="py-2 px-1.5 text-right font-semibold whitespace-nowrap">
                      {debitCurrLabel
                        ? bi(`Precio unit. (${debitCurrLabel})`, `Unit price (${debitCurrLabel})`)
                        : bi('Precio unit.', 'Unit price')}
                    </th>
                    <th className="py-2 px-1.5 text-left font-semibold whitespace-nowrap">
                      {bi('Vencimiento', 'Due date')}
                    </th>
                    <th className="py-2 px-1.5 text-right font-semibold whitespace-nowrap">
                      {debitCurrLabel
                        ? bi(`Capital pend. (${debitCurrLabel})`, `Pending prin. (${debitCurrLabel})`)
                        : bi('Capital pend.', 'Pending prin.')}
                    </th>
                    <th className="py-2 px-1.5 text-right font-semibold whitespace-nowrap">
                      {debitCurrLabel
                        ? bi(`Interés (${debitCurrLabel})`, `Interest (${debitCurrLabel})`)
                        : bi('Interés', 'Interest')}
                    </th>
                    <th className="py-2 px-1.5 text-right font-semibold whitespace-nowrap">
                      {debitCurrLabel
                        ? bi(`Total (${debitCurrLabel})`, `Total (${debitCurrLabel})`)
                        : bi('Total', 'Total')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {debitNote.items.map((item, idx) => {
                    const parsed = parseDocumentConcept(item);
                    const metaLines = buildDebitNoteSecondaryMeta(item, lang);
                    const dueDisplay = formatDebitNoteDueCell(item, lang);
                    const hasRowInterest = item.interes > 0.005;
                    return (
                      <tr
                        key={`${item.deudaTipo}_${item.deudaId}_${idx}`}
                        className="border-b border-[#E5E7EB] align-top"
                      >
                        <td className="py-2 px-1.5 text-[#374151] whitespace-nowrap tabular-nums">
                          {item.fecha ? formatDateLocale(item.fecha, lang) : '—'}
                        </td>
                        <td className="py-2 px-1.5 min-w-[140px]">
                          <div className="font-semibold text-[#111827] leading-snug">
                            {parsed.primary}
                          </div>
                          {metaLines.map((line, mIdx) => (
                            <div
                              key={mIdx}
                              className="text-[10.5px] text-[#6B7280] leading-snug mt-0.5"
                            >
                              {line}
                            </div>
                          ))}
                        </td>
                        <td className="py-2 px-1.5 text-right text-[#374151] whitespace-nowrap tabular-nums">
                          {formatNumberLocale(item.cantidad, lang, 2)} {item.unidad}
                        </td>
                        <td className="py-2 px-1.5 text-right text-[#374151] whitespace-nowrap tabular-nums">
                          {formatDocumentAmount(
                            item.precioUnitario,
                            item.moneda,
                            debitSummary.singleCurrency,
                            lang
                          )}
                        </td>
                        <td className="py-2 px-1.5 text-left whitespace-nowrap tabular-nums">
                          <div className="text-[#374151]">{dueDisplay.dueDateText}</div>
                          {dueDisplay.overdueText && (
                            <div className="text-[10px] text-[#9A3412] font-medium mt-0.5">
                              {dueDisplay.overdueText}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-1.5 text-right text-[#374151] whitespace-nowrap tabular-nums">
                          {formatDocumentAmount(
                            item.saldoPendiente,
                            item.moneda,
                            debitSummary.singleCurrency,
                            lang
                          )}
                        </td>
                        <td className="py-2 px-1.5 text-right text-[#4B5563] whitespace-nowrap tabular-nums">
                          {hasRowInterest
                            ? formatDocumentAmount(
                                item.interes,
                                item.moneda,
                                debitSummary.singleCurrency,
                                lang
                              )
                            : '—'}
                        </td>
                        <td className="py-2 px-1.5 text-right font-semibold text-[#111827] whitespace-nowrap tabular-nums">
                          {formatDocumentAmount(
                            item.totalPorCobrar,
                            item.moneda,
                            debitSummary.singleCurrency,
                            lang
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* DEBIT NOTE TOTALS (Right-Aligned, Separated per Currency) */}
            <div className="print-doc-totals mt-4 flex justify-end">
              <div className="w-full sm:w-[300px] space-y-3">
                {debitSummary.blocks.map((block) => {
                  const isMixed = debitSummary.blocks.length > 1;
                  const cLabel = getCurrencyShortLabel(block.currency);
                  return (
                    <div key={block.currency} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-4 px-2.5 py-0.5 text-[#4B5563]">
                        <span>
                          {isMixed
                            ? bi(`Capital pendiente (${cLabel})`, `Pending principal (${cLabel})`)
                            : bi('Capital pendiente', 'Pending principal')}
                        </span>
                        <span className="font-semibold text-[#111827] tabular-nums whitespace-nowrap">
                          {formatMoneyLocale(block.principal, block.currency, lang)}
                        </span>
                      </div>

                      {block.interest > 0.005 && (
                        <div className="flex items-center justify-between gap-4 px-2.5 py-0.5 text-[#4B5563]">
                          <span>
                            {isMixed
                              ? bi(`Interés por mora (${cLabel})`, `Late interest (${cLabel})`)
                              : bi('Interés por mora', 'Late interest')}
                          </span>
                          <span className="font-semibold text-[#111827] tabular-nums whitespace-nowrap">
                            {formatMoneyLocale(block.interest, block.currency, lang)}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-4 rounded-md bg-[#F3F4F6] px-2.5 py-2 mt-1 border-t border-[#D1D5DB]">
                        <span className="text-[12.5px] font-bold tracking-wide text-[#111827] uppercase">
                          {isMixed
                            ? bi(`Total por cobrar (${cLabel})`, `Total receivable (${cLabel})`)
                            : bi('Total por cobrar', 'Total receivable')}
                        </span>
                        <span className="text-[14px] font-bold text-[#111827] tabular-nums whitespace-nowrap">
                          {formatMoneyLocale(block.total, block.currency, lang)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* PAYMENT RECEIPT TABLE — 7 columns with independent Pagado Bs column */}
        {isReceipt && paymentReceipt && receiptSummary && (
          <>
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full border-collapse text-[11.5px]">
                <thead>
                  <tr className="bg-[#F3F4F6] text-[#374151] border-t border-b border-[#D1D5DB]">
                    <th className="py-2 px-1.5 text-left font-semibold whitespace-nowrap">
                      {bi('Fecha', 'Date')}
                    </th>
                    <th className="py-2 px-1.5 text-left font-semibold">
                      {bi('Concepto', 'Concept')}
                    </th>
                    <th className="py-2 px-1.5 text-right font-semibold whitespace-nowrap">
                      {receiptCurrLabel
                        ? bi(`Saldo ant. (${receiptCurrLabel})`, `Prev. bal. (${receiptCurrLabel})`)
                        : bi('Saldo ant.', 'Prev. bal.')}
                    </th>
                    <th className="py-2 px-1.5 text-right font-semibold whitespace-nowrap">
                      {receiptCurrLabel
                        ? bi(`Interés (${receiptCurrLabel})`, `Interest (${receiptCurrLabel})`)
                        : bi('Interés', 'Interest')}
                    </th>
                    <th className="py-2 px-1.5 text-right font-semibold whitespace-nowrap">
                      {bi('Pagado USD', 'Paid USD')}
                    </th>
                    <th className="py-2 px-1.5 text-right font-semibold whitespace-nowrap">
                      {bi('Pagado Bs', 'Paid Bs')}
                    </th>
                    <th className="py-2 px-1.5 text-right font-semibold whitespace-nowrap">
                      {receiptCurrLabel
                        ? bi(`Saldo rest. (${receiptCurrLabel})`, `Remaining (${receiptCurrLabel})`)
                        : bi('Saldo rest.', 'Remaining')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paymentReceipt.items.map((item, idx) => {
                    const parsed = parseDocumentConcept(item);
                    const metaLines = buildPaymentReceiptSecondaryMeta(item, lang);
                    const hasRowInterest = item.interesPagado > 0.005;
                    const lineDisp = computePaymentReceiptLineDisplay(
                      item,
                      paymentReceipt.tcAplicado
                    );

                    return (
                      <tr
                        key={`${item.deudaTipo}_${item.deudaId}_${idx}`}
                        className="border-b border-[#E5E7EB] align-top"
                      >
                        <td className="py-2 px-1.5 text-[#374151] whitespace-nowrap tabular-nums">
                          {item.fechaDeuda ? formatDateLocale(item.fechaDeuda, lang) : '—'}
                        </td>
                        <td className="py-2 px-1.5 min-w-[140px]">
                          <div className="font-semibold text-[#111827] leading-snug">
                            {parsed.primary}
                          </div>
                          {metaLines.map((line, mIdx) => (
                            <div
                              key={mIdx}
                              className="text-[10.5px] text-[#6B7280] leading-snug mt-0.5"
                            >
                              {line}
                            </div>
                          ))}
                        </td>
                        <td className="py-2 px-1.5 text-right text-[#4B5563] whitespace-nowrap tabular-nums">
                          {formatDocumentAmount(
                            item.importeAnterior,
                            item.monedaDeuda,
                            receiptSummary.singleCurrency,
                            lang
                          )}
                        </td>
                        <td className="py-2 px-1.5 text-right text-[#4B5563] whitespace-nowrap tabular-nums">
                          {hasRowInterest
                            ? formatDocumentAmount(
                                item.interesPagado,
                                item.monedaDeuda,
                                receiptSummary.singleCurrency,
                                lang
                              )
                            : '—'}
                        </td>
                        <td className="py-2 px-1.5 text-right whitespace-nowrap tabular-nums">
                          {lineDisp.paidUsd ? (
                            <>
                              <div
                                className={
                                  lineDisp.paidUsd.isActualReceived
                                    ? 'font-semibold text-[#111827]'
                                    : 'font-medium text-[#374151]'
                                }
                              >
                                {formatNumberLocale(lineDisp.paidUsd.value, lang, 2)}
                              </div>
                              {lineDisp.paidUsd.isEquivalentApplied && (
                                <div className="text-[9.5px] text-[#6B7280] mt-0.5">
                                  {bi('Equiv. aplicado', 'Applied equiv.')}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-[#9CA3AF]">—</span>
                          )}
                        </td>
                        <td className="py-2 px-1.5 text-right whitespace-nowrap tabular-nums">
                          {lineDisp.paidBs ? (
                            <>
                              <div
                                className={
                                  lineDisp.paidBs.isActualReceived
                                    ? 'font-semibold text-[#111827]'
                                    : 'font-medium text-[#374151]'
                                }
                              >
                                {formatNumberLocale(lineDisp.paidBs.value, lang, 2)}
                              </div>
                              {lineDisp.paidBs.isEquivalentApplied && (
                                <div className="text-[9.5px] text-[#6B7280] mt-0.5">
                                  {bi('Equiv. aplicado', 'Applied equiv.')}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-[#9CA3AF]">—</span>
                          )}
                        </td>
                        <td className="py-2 px-1.5 text-right text-[#374151] whitespace-nowrap tabular-nums">
                          {formatDocumentAmount(
                            item.saldoRestante,
                            item.monedaDeuda,
                            receiptSummary.singleCurrency,
                            lang
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* PAYMENT RECEIPT TOTALS (Right-Aligned, Separated per Currency — Never summing USD + Bs) */}
            <div className="print-doc-totals mt-4 flex justify-end">
              <div className="w-full sm:w-[320px] space-y-3">
                {receiptSummary.blocks.map((block) => {
                  const isMixed = receiptSummary.blocks.length > 1;
                  const cLabel = getCurrencyShortLabel(block.currency);
                  const isConvertedBlock =
                    receiptSummary.hasCrossCurrency && block.currency !== paymentReceipt.monedaPago;
                  return (
                    <div key={block.currency} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-4 px-2.5 py-0.5 text-[#4B5563]">
                        <span>
                          {isMixed
                            ? bi(`Capital aplicado (${cLabel})`, `Principal applied (${cLabel})`)
                            : bi('Capital aplicado', 'Principal applied')}
                        </span>
                        <span className="font-semibold text-[#111827] tabular-nums whitespace-nowrap">
                          {formatMoneyLocale(block.capital, block.currency, lang)}
                        </span>
                      </div>

                      {block.interest > 0.005 && (
                        <div className="flex items-center justify-between gap-4 px-2.5 py-0.5 text-[#4B5563]">
                          <span>
                            {isMixed
                              ? bi(`Interés cobrado (${cLabel})`, `Interest paid (${cLabel})`)
                              : bi('Interés cobrado', 'Interest paid')}
                          </span>
                          <span className="font-semibold text-[#111827] tabular-nums whitespace-nowrap">
                            {formatMoneyLocale(block.interest, block.currency, lang)}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-4 rounded-md bg-[#F3F4F6] px-2.5 py-2 mt-1 border-t border-[#D1D5DB]">
                        <span className="text-[12px] font-bold tracking-wide text-[#111827] uppercase">
                          {isConvertedBlock
                            ? bi(`Equivalente aplicado (${cLabel})`, `Equivalent applied (${cLabel})`)
                            : isMixed
                            ? bi(`Total cobrado (${cLabel})`, `Total paid (${cLabel})`)
                            : bi('Total cobrado', 'Total paid')}
                        </span>
                        <span className="text-[13.5px] font-bold text-[#111827] tabular-nums whitespace-nowrap">
                          {formatMoneyLocale(block.total, block.currency, lang)}
                        </span>
                      </div>

                      {block.remaining > 0.005 && (
                        <div className="flex items-center justify-between gap-4 px-2.5 pt-1 text-[#4B5563]">
                          <span>
                            {isMixed
                              ? bi(`Saldo restante (${cLabel})`, `Remaining balance (${cLabel})`)
                              : bi('Saldo restante', 'Remaining balance')}
                          </span>
                          <span className="font-semibold text-[#111827] tabular-nums whitespace-nowrap">
                            {formatMoneyLocale(block.remaining, block.currency, lang)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {receiptSummary.hasCrossCurrency && (
                  <div className="rounded-md bg-[#EAF5EE] border border-[#24875B]/25 px-2.5 py-2 flex items-center justify-between gap-3 text-xs tabular-nums">
                    <div>
                      <div className="font-bold text-[#16553A] uppercase tracking-wide text-[11px]">
                        {bi('Importe recibido', 'Amount received')}
                      </div>
                      <div className="text-[10.5px] text-[#3A6B53]">
                        {bi('TC aplicado', 'Applied FX')}:{' '}
                        {formatNumberLocale(paymentReceipt.tcAplicado, lang, 2)}
                      </div>
                    </div>
                    <span className="text-[14px] font-bold text-[#16553A] whitespace-nowrap">
                      {formatMoneyLocale(
                        paymentReceipt.importeOriginalPagado,
                        paymentReceipt.monedaPago,
                        lang
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Observation (hidden completely when empty) */}
        {observation && (
          <div className="mt-4 pt-3 border-t border-[#E5E7EB] text-xs text-[#374151]">
            <span className="font-semibold text-[#111827]">
              {bi('Observación', 'Observation')}:{' '}
            </span>
            <span>{observation}</span>
          </div>
        )}

        {/* Single Non-Fiscal Footer immediately below content */}
        <div className="print-doc-footer mt-4 pt-2.5 border-t border-[#E5E7EB]">
          <p className="text-[10.5px] text-[#6B7280]">{nonFiscal}</p>
        </div>
      </div>
    </div>
  );
};
