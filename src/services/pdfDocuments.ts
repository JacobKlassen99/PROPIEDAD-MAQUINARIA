import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DebitNoteRecord, PaymentReceiptRecord } from '../types';
import type { AppLanguage } from './translations';
import { formatDateLocale, formatMoneyLocale, formatNumberLocale } from './formatters';
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
} from './documentFormatting';

let cachedLogoDataUrl: string | null | undefined = undefined;

async function loadLogoDataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl !== undefined) return cachedLogoDataUrl;
  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    cachedLogoDataUrl = null;
    return null;
  }
  try {
    const res = await fetch('/icon-192.png');
    if (!res.ok) {
      cachedLogoDataUrl = null;
      return null;
    }
    const blob = await res.blob();
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    cachedLogoDataUrl = dataUrl;
    return dataUrl;
  } catch {
    cachedLogoDataUrl = null;
    return null;
  }
}

function buildSafeFilename(prefix: string, numero: string, clientName: string): string {
  const cleanNum = (numero || 'DOC').replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanClient = (clientName || 'cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 28);
  return `${prefix}_${cleanNum}${cleanClient ? '_' + cleanClient : ''}.pdf`;
}

export interface GeneratedPdfResult {
  blob: Blob;
  filename: string;
}

interface RichConceptCell {
  primary: string;
  secondaryLines: string[];
}

interface RichTwoLineCell {
  primary: string;
  secondary: string | null;
  boldPrimary?: boolean;
  secondaryColor?: [number, number, number];
  align: 'left' | 'right';
}

const COLOR_TEXT: [number, number, number] = [17, 24, 39];       // #111827
const COLOR_MUTED: [number, number, number] = [75, 85, 99];      // #4B5563
const COLOR_SUBTLE: [number, number, number] = [107, 114, 128];  // #6B7280
const COLOR_HEAD_TEXT: [number, number, number] = [55, 65, 81];  // #374151
const COLOR_HEAD_BG: [number, number, number] = [243, 244, 246]; // #F3F4F6
const COLOR_BORDER: [number, number, number] = [209, 213, 219];  // #D1D5DB
const COLOR_ROW_LINE: [number, number, number] = [229, 231, 235];// #E5E7EB
const COLOR_OVERDUE: [number, number, number] = [154, 52, 18];   // #9A3412
const COLOR_GREEN_BG: [number, number, number] = [234, 245, 238];// #EAF5EE
const COLOR_GREEN_TEXT: [number, number, number] = [22, 85, 58]; // #16553A

function drawDocumentHeader(
  doc: jsPDF,
  logo: string | null,
  params: {
    appName: string;
    docTitle: string;
    numeroLabel: string;
    dateLabel: string;
    cancelledLabel?: string;
    marginX: number;
    marginY: number;
    pageW: number;
  }
): number {
  const { appName, docTitle, numeroLabel, dateLabel, cancelledLabel, marginX, marginY, pageW } = params;
  const rightX = pageW - marginX;

  const logoSize = 9.5;
  let textStartX = marginX;
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', marginX, marginY, logoSize, logoSize);
      textStartX = marginX + logoSize + 2.8;
    } catch {
      // continue without logo
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(appName, textStartX, marginY + 6.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(docTitle, rightX, marginY + 4.2, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(31, 41, 55);
  doc.text(numeroLabel, rightX, marginY + 8.6, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(dateLabel, rightX, marginY + 12.6, { align: 'right' });

  let headerBottom = marginY + 15.2;
  if (cancelledLabel) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(185, 28, 28);
    doc.text(cancelledLabel, rightX, marginY + 16.4, { align: 'right' });
    headerBottom = marginY + 18.6;
  }

  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.28);
  doc.line(marginX, headerBottom, rightX, headerBottom);

  return headerBottom + 4.8;
}

function drawClientSection(
  doc: jsPDF,
  params: {
    clientName: string;
    clientPhone?: string;
    clientAddress?: string;
    rightMetaLine?: string;
    lang: AppLanguage;
    marginX: number;
    pageW: number;
    startY: number;
  }
): number {
  const { clientName, clientPhone, clientAddress, rightMetaLine, lang, marginX, pageW, startY } = params;
  const rightX = pageW - marginX;
  const maxLeftW = rightMetaLine ? pageW - marginX * 2 - 78 : pageW - marginX * 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...COLOR_TEXT);
  const nameLines = doc.splitTextToSize(clientName || '—', maxLeftW);
  doc.text(nameLines, marginX, startY);

  if (rightMetaLine) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(rightMetaLine, rightX, startY, { align: 'right' });
  }

  let y = startY + nameLines.length * 4.4;

  const contactParts: string[] = [];
  if (clientPhone && clientPhone.trim()) {
    contactParts.push(`${lang === 'en' ? 'Phone' : 'Tel.'}: ${clientPhone.trim()}`);
  }
  if (clientAddress && clientAddress.trim()) {
    contactParts.push(clientAddress.trim());
  }

  if (contactParts.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(...COLOR_MUTED);
    const contactLines = doc.splitTextToSize(contactParts.join('  ·  '), pageW - marginX * 2);
    doc.text(contactLines, marginX, y);
    y += contactLines.length * 3.8;
  }

  return y + 2.8;
}

function drawObservationAndFooter(
  doc: jsPDF,
  params: {
    observation?: string;
    nonFiscalText: string;
    lang: AppLanguage;
    marginX: number;
    marginY: number;
    pageW: number;
    pageH: number;
    startY: number;
  }
): void {
  const { observation, nonFiscalText, lang, marginX, marginY, pageW, pageH, startY } = params;
  const rightX = pageW - marginX;
  const usableW = pageW - marginX * 2;
  let y = startY;

  const obs = (observation || '').trim();
  if (obs) {
    const label = lang === 'en' ? 'Observation: ' : 'Observación: ';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    const wrapped = doc.splitTextToSize(label + obs, usableW);
    const obsHeight = wrapped.length * 3.8 + 5;
    if (y + obsHeight > pageH - marginY - 8) {
      doc.addPage();
      y = marginY + 4;
    }
    doc.setDrawColor(...COLOR_ROW_LINE);
    doc.setLineWidth(0.22);
    doc.line(marginX, y, rightX, y);
    y += 4.2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(...COLOR_HEAD_TEXT);
    doc.text(wrapped, marginX, y);
    y += wrapped.length * 3.8 + 1.5;
  }

  if (y + 8 > pageH - marginY - 4) {
    doc.addPage();
    y = marginY + 4;
  }

  doc.setDrawColor(...COLOR_ROW_LINE);
  doc.setLineWidth(0.22);
  doc.line(marginX, y, rightX, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(...COLOR_SUBTLE);
  doc.text(nonFiscalText, marginX, y);

  const totalPages = doc.getNumberOfPages();
  if (totalPages > 1) {
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...COLOR_SUBTLE);
      const pageTxt = lang === 'en' ? `Page ${p} / ${totalPages}` : `Página ${p} / ${totalPages}`;
      doc.text(pageTxt, rightX, pageH - 6, { align: 'right' });
    }
  }
}

function drawTwoLineCell(
  doc: jsPDF,
  cell: { x: number; y: number; width: number; height: number },
  info: RichTwoLineCell
): void {
  const padX = 1.6;
  const anchorX = info.align === 'right' ? cell.x + cell.width - padX : cell.x + padX;
  const opts = info.align === 'right' ? { align: 'right' as const } : undefined;

  doc.setFont('helvetica', info.boldPrimary ? 'bold' : 'normal');
  doc.setFontSize(7.9);
  doc.setTextColor(...(info.boldPrimary ? COLOR_TEXT : COLOR_HEAD_TEXT));
  doc.text(info.primary, anchorX, cell.y + 4.7, opts);

  if (info.secondary) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.7);
    doc.setTextColor(...(info.secondaryColor || COLOR_SUBTLE));
    doc.text(info.secondary, anchorX, cell.y + 7.9, opts);
  }
}

export async function generateDebitNotePdf(
  debitNote: DebitNoteRecord,
  lang: AppLanguage = 'es'
): Promise<GeneratedPdfResult> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const logo = await loadLogoDataUrl();
  const pageW = doc.internal.pageSize.getWidth(); // 215.9 mm
  const pageH = doc.internal.pageSize.getHeight(); // 279.4 mm
  const marginX = 10;
  const marginY = 10;

  const appName = lang === 'en' ? 'Machinery & Property' : 'Maquinarias y Propiedad';
  const docTitle = lang === 'en' ? 'DEBIT NOTE' : 'NOTA DE DÉBITO';
  const nonFiscal =
    lang === 'en'
      ? 'Internal administrative document · Not valid as a tax invoice'
      : 'Documento administrativo interno · No válido como factura fiscal';

  const summary = computeDebitNoteSummary(debitNote);
  const currSuffix = summary.singleCurrency
    ? ` (${getCurrencyShortLabel(summary.singleCurrency)})`
    : '';

  let y = drawDocumentHeader(doc, logo, {
    appName,
    docTitle,
    numeroLabel: `${lang === 'en' ? 'No.' : 'N.°'} ${debitNote.numero || '—'}`,
    dateLabel: `${lang === 'en' ? 'Date' : 'Fecha'}: ${formatDateLocale(debitNote.fecha, lang)}`,
    marginX,
    marginY,
    pageW,
  });

  y = drawClientSection(doc, {
    clientName: debitNote.clienteNombre,
    clientPhone: debitNote.clienteTelefono,
    clientAddress: debitNote.clienteDireccion,
    lang,
    marginX,
    pageW,
    startY: y,
  });

  // 8 columns summing to 195.9 mm:
  // 18 + 55.9 + 18 + 20 + 21 + 22 + 19 + 22 = 195.9 mm
  const conceptColW = 55.9;
  const conceptCells: RichConceptCell[] = [];
  const dueCells: RichTwoLineCell[] = [];

  const bodyRows = debitNote.items.map((item) => {
    const parsed = parseDocumentConcept(item);
    const secondaryLines = buildDebitNoteSecondaryMeta(item, lang);
    conceptCells.push({ primary: parsed.primary, secondaryLines });

    const dueDisplay = formatDebitNoteDueCell(item, lang);
    dueCells.push({
      primary: dueDisplay.dueDateText,
      secondary: dueDisplay.overdueText,
      boldPrimary: false,
      secondaryColor: COLOR_OVERDUE,
      align: 'left',
    });

    const conceptPlaceholder = [parsed.primary, ...secondaryLines].join('\n');
    const duePlaceholder = dueDisplay.overdueText
      ? `${dueDisplay.dueDateText}\n${dueDisplay.overdueText}`
      : dueDisplay.dueDateText;

    const interestTxt =
      item.interes > 0.005
        ? formatDocumentAmount(item.interes, item.moneda, summary.singleCurrency, lang)
        : '—';

    return [
      item.fecha ? formatDateLocale(item.fecha, lang) : '—',
      conceptPlaceholder,
      `${formatNumberLocale(item.cantidad, lang, 2)} ${item.unidad}`,
      formatDocumentAmount(item.precioUnitario, item.moneda, summary.singleCurrency, lang),
      duePlaceholder,
      formatDocumentAmount(item.saldoPendiente, item.moneda, summary.singleCurrency, lang),
      interestTxt,
      formatDocumentAmount(item.totalPorCobrar, item.moneda, summary.singleCurrency, lang),
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX, top: marginY, bottom: marginY + 4 },
    theme: 'plain',
    head: [
      [
        lang === 'en' ? 'Date' : 'Fecha',
        lang === 'en' ? 'Concept' : 'Concepto',
        lang === 'en' ? 'Qty' : 'Cantidad',
        (lang === 'en' ? 'Unit price' : 'P. unit.') + currSuffix,
        lang === 'en' ? 'Due date' : 'Vencimiento',
        (lang === 'en' ? 'Pending prin.' : 'Capital pend.') + currSuffix,
        (lang === 'en' ? 'Interest' : 'Interés') + currSuffix,
        (lang === 'en' ? 'Total' : 'Total') + currSuffix,
      ],
    ],
    body: bodyRows,
    styles: {
      font: 'helvetica',
      fontSize: 7.9,
      textColor: COLOR_TEXT,
      cellPadding: { top: 2.2, bottom: 2.2, left: 1.5, right: 1.5 },
      valign: 'top',
      lineColor: COLOR_ROW_LINE,
      lineWidth: 0,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: COLOR_HEAD_BG,
      textColor: COLOR_HEAD_TEXT,
      fontStyle: 'bold',
      fontSize: 7.3,
      cellPadding: { top: 2.3, bottom: 2.3, left: 1.5, right: 1.5 },
    },
    columnStyles: {
      0: { cellWidth: 18, halign: 'left', textColor: COLOR_HEAD_TEXT },
      1: { cellWidth: conceptColW, halign: 'left' },
      2: { cellWidth: 18, halign: 'right', textColor: COLOR_HEAD_TEXT },
      3: { cellWidth: 20, halign: 'right', textColor: COLOR_HEAD_TEXT },
      4: { cellWidth: 21, halign: 'left', textColor: COLOR_HEAD_TEXT },
      5: { cellWidth: 22, halign: 'right', textColor: COLOR_HEAD_TEXT },
      6: { cellWidth: 19, halign: 'right', textColor: COLOR_MUTED },
      7: { cellWidth: 22, halign: 'right', fontStyle: 'bold', textColor: COLOR_TEXT },
    },
    didParseCell: (data) => {
      if (data.section === 'head') {
        if (data.column.index === 2 || data.column.index === 3 || data.column.index >= 5) {
          data.cell.styles.halign = 'right';
        }
      }
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.textColor = [255, 255, 255];
      }
      if (data.section === 'body' && data.column.index === 4 && dueCells[data.row.index]?.secondary) {
        data.cell.styles.textColor = [255, 255, 255];
      }
    },
    didDrawCell: (data) => {
      const { cell } = data;
      if (data.section === 'head') {
        doc.setDrawColor(...COLOR_BORDER);
        doc.setLineWidth(0.25);
        doc.line(cell.x, cell.y, cell.x + cell.width, cell.y);
        doc.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
      } else if (data.section === 'body') {
        doc.setDrawColor(...COLOR_ROW_LINE);
        doc.setLineWidth(0.2);
        doc.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);

        if (data.column.index === 1) {
          const meta = conceptCells[data.row.index];
          if (meta) {
            const innerX = cell.x + 1.5;
            const innerW = cell.width - 3;
            let cursorY = cell.y + 4.7;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.9);
            doc.setTextColor(...COLOR_TEXT);
            const primaryWrapped = doc.splitTextToSize(meta.primary, innerW);
            doc.text(primaryWrapped, innerX, cursorY);
            cursorY += primaryWrapped.length * 3.35;

            if (meta.secondaryLines.length > 0) {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(6.9);
              doc.setTextColor(...COLOR_SUBTLE);
              meta.secondaryLines.forEach((line) => {
                const subWrapped = doc.splitTextToSize(line, innerW);
                doc.text(subWrapped, innerX, cursorY);
                cursorY += subWrapped.length * 3.0;
              });
            }
          }
        } else if (data.column.index === 4) {
          const due = dueCells[data.row.index];
          if (due && due.secondary) {
            drawTwoLineCell(doc, cell, due);
          }
        }
      }
    },
  });

  // Right-aligned totals block (separated by currency — NEVER sum USD + Bs)
  const finalTableY = (doc as any).lastAutoTable?.finalY ?? y + 20;
  let totalY = finalTableY + 5;
  const totalsW = 78;
  const totalsX = pageW - marginX - totalsW;
  const rightX = pageW - marginX;

  for (const block of summary.blocks) {
    const isMixed = summary.blocks.length > 1;
    const cLabel = getCurrencyShortLabel(block.currency);
    const hasInterest = block.interest > 0.005;
    const blockH = (hasInterest ? 11 : 6) + 9 + 3;

    if (totalY + blockH > pageH - marginY - 10) {
      doc.addPage();
      totalY = marginY + 4;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.4);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(
      isMixed
        ? lang === 'en'
          ? `Pending principal (${cLabel})`
          : `Capital pendiente (${cLabel})`
        : lang === 'en'
        ? 'Pending principal'
        : 'Capital pendiente',
      totalsX + 2.5,
      totalY
    );
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLOR_TEXT);
    doc.text(formatMoneyLocale(block.principal, block.currency, lang), rightX - 2.5, totalY, {
      align: 'right',
    });
    totalY += 4.8;

    if (hasInterest) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.4);
      doc.setTextColor(...COLOR_MUTED);
      doc.text(
        isMixed
          ? lang === 'en'
            ? `Late interest (${cLabel})`
            : `Interés por mora (${cLabel})`
          : lang === 'en'
          ? 'Late interest'
          : 'Interés por mora',
        totalsX + 2.5,
        totalY
      );
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLOR_TEXT);
      doc.text(formatMoneyLocale(block.interest, block.currency, lang), rightX - 2.5, totalY, {
        align: 'right',
      });
      totalY += 4.8;
    }

    const boxY = totalY - 2.2;
    const boxH = 8.2;
    doc.setFillColor(...COLOR_HEAD_BG);
    doc.roundedRect(totalsX, boxY, totalsW, boxH, 1.2, 1.2, 'F');
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.25);
    doc.line(totalsX, boxY, totalsX + totalsW, boxY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(...COLOR_TEXT);
    doc.text(
      isMixed
        ? lang === 'en'
          ? `TOTAL RECEIVABLE (${cLabel})`
          : `TOTAL POR COBRAR (${cLabel})`
        : lang === 'en'
        ? 'TOTAL RECEIVABLE'
        : 'TOTAL POR COBRAR',
      totalsX + 2.5,
      boxY + 5.4
    );
    doc.setFontSize(10);
    doc.text(formatMoneyLocale(block.total, block.currency, lang), rightX - 2.5, boxY + 5.4, {
      align: 'right',
    });

    totalY = boxY + boxH + 4.5;
  }

  drawObservationAndFooter(doc, {
    observation: debitNote.observacion,
    nonFiscalText: nonFiscal,
    lang,
    marginX,
    marginY,
    pageW,
    pageH,
    startY: totalY + 1,
  });

  const blob = doc.output('blob');
  const filename = buildSafeFilename(
    lang === 'en' ? 'Debit_Note' : 'Nota_Debito',
    debitNote.numero,
    debitNote.clienteNombre
  );
  return { blob, filename };
}

export async function generatePaymentReceiptPdf(
  receipt: PaymentReceiptRecord,
  lang: AppLanguage = 'es'
): Promise<GeneratedPdfResult> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const logo = await loadLogoDataUrl();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 10;
  const marginY = 10;

  const appName = lang === 'en' ? 'Machinery & Property' : 'Maquinarias y Propiedad';
  const docTitle = lang === 'en' ? 'PAYMENT RECEIPT' : 'NOTA DE COBRO';
  const nonFiscal =
    lang === 'en'
      ? 'Internal administrative document · Not valid as a tax invoice'
      : 'Documento administrativo interno · No válido como factura fiscal';

  const summary = computePaymentReceiptSummary(receipt);
  const currSuffix = summary.singleCurrency
    ? ` (${getCurrencyShortLabel(summary.singleCurrency)})`
    : '';
  const equivSubLabel = lang === 'en' ? 'Applied equiv.' : 'Equiv. aplicado';

  let y = drawDocumentHeader(doc, logo, {
    appName,
    docTitle,
    numeroLabel: `${lang === 'en' ? 'No.' : 'N.°'} ${receipt.numero || '—'}`,
    dateLabel: `${lang === 'en' ? 'Date' : 'Fecha'}: ${formatDateLocale(receipt.fecha, lang)}`,
    cancelledLabel: receipt.anulado ? (lang === 'en' ? 'CANCELLED' : 'ANULADA') : undefined,
    marginX,
    marginY,
    pageW,
  });

  const payTypeTxt =
    receipt.tipoPago === 'TOTAL'
      ? lang === 'en'
        ? 'Full payment'
        : 'Pago total'
      : lang === 'en'
      ? 'Partial payment'
      : 'Pago parcial';
  const receivedTxt = `${lang === 'en' ? 'Received' : 'Recibido'}: ${formatMoneyLocale(
    receipt.importeOriginalPagado,
    receipt.monedaPago,
    lang
  )}`;
  const fxPart = summary.hasCrossCurrency
    ? ` · ${lang === 'en' ? 'FX' : 'TC'} ${formatNumberLocale(receipt.tcAplicado, lang, 2)}`
    : '';

  y = drawClientSection(doc, {
    clientName: receipt.clienteNombre,
    clientPhone: receipt.clienteTelefono,
    clientAddress: receipt.clienteDireccion,
    rightMetaLine: `${payTypeTxt} · ${receivedTxt}${fxPart}`,
    lang,
    marginX,
    pageW,
    startY: y,
  });

  // 7 columns summing to 195.9 mm:
  // 19 + 60.9 + 23 + 20 + 25 + 25 + 23 = 195.9 mm
  const conceptColW = 60.9;
  const conceptCells: RichConceptCell[] = [];
  const paidUsdCells: Array<RichTwoLineCell | null> = [];
  const paidBsCells: Array<RichTwoLineCell | null> = [];

  const bodyRows = receipt.items.map((item) => {
    const parsed = parseDocumentConcept(item);
    const secondaryLines = buildPaymentReceiptSecondaryMeta(item, lang);
    conceptCells.push({ primary: parsed.primary, secondaryLines });

    const lineDisp = computePaymentReceiptLineDisplay(item, receipt.tcAplicado);

    const usdCell: RichTwoLineCell | null = lineDisp.paidUsd
      ? {
          primary: formatNumberLocale(lineDisp.paidUsd.value, lang, 2),
          secondary: lineDisp.paidUsd.isEquivalentApplied ? equivSubLabel : null,
          boldPrimary: lineDisp.paidUsd.isActualReceived,
          align: 'right',
        }
      : null;
    paidUsdCells.push(usdCell);

    const bsCell: RichTwoLineCell | null = lineDisp.paidBs
      ? {
          primary: formatNumberLocale(lineDisp.paidBs.value, lang, 2),
          secondary: lineDisp.paidBs.isEquivalentApplied ? equivSubLabel : null,
          boldPrimary: lineDisp.paidBs.isActualReceived,
          align: 'right',
        }
      : null;
    paidBsCells.push(bsCell);

    const conceptPlaceholder = [parsed.primary, ...secondaryLines].join('\n');
    const usdPlaceholder = usdCell
      ? usdCell.secondary
        ? `${usdCell.primary}\n${usdCell.secondary}`
        : usdCell.primary
      : '—';
    const bsPlaceholder = bsCell
      ? bsCell.secondary
        ? `${bsCell.primary}\n${bsCell.secondary}`
        : bsCell.primary
      : '—';

    const interestTxt =
      item.interesPagado > 0.005
        ? formatDocumentAmount(item.interesPagado, item.monedaDeuda, summary.singleCurrency, lang)
        : '—';

    return [
      item.fechaDeuda ? formatDateLocale(item.fechaDeuda, lang) : '—',
      conceptPlaceholder,
      formatDocumentAmount(item.importeAnterior, item.monedaDeuda, summary.singleCurrency, lang),
      interestTxt,
      usdPlaceholder,
      bsPlaceholder,
      formatDocumentAmount(item.saldoRestante, item.monedaDeuda, summary.singleCurrency, lang),
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX, top: marginY, bottom: marginY + 4 },
    theme: 'plain',
    head: [
      [
        lang === 'en' ? 'Date' : 'Fecha',
        lang === 'en' ? 'Concept' : 'Concepto',
        (lang === 'en' ? 'Prev. bal.' : 'Saldo ant.') + currSuffix,
        (lang === 'en' ? 'Interest' : 'Interés') + currSuffix,
        lang === 'en' ? 'Paid USD' : 'Pagado USD',
        lang === 'en' ? 'Paid Bs' : 'Pagado Bs',
        (lang === 'en' ? 'Remaining' : 'Saldo rest.') + currSuffix,
      ],
    ],
    body: bodyRows,
    styles: {
      font: 'helvetica',
      fontSize: 7.9,
      textColor: COLOR_TEXT,
      cellPadding: { top: 2.2, bottom: 2.2, left: 1.5, right: 1.5 },
      valign: 'top',
      lineColor: COLOR_ROW_LINE,
      lineWidth: 0,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: COLOR_HEAD_BG,
      textColor: COLOR_HEAD_TEXT,
      fontStyle: 'bold',
      fontSize: 7.4,
      cellPadding: { top: 2.3, bottom: 2.3, left: 1.5, right: 1.5 },
    },
    columnStyles: {
      0: { cellWidth: 19, halign: 'left', textColor: COLOR_HEAD_TEXT },
      1: { cellWidth: conceptColW, halign: 'left' },
      2: { cellWidth: 23, halign: 'right', textColor: COLOR_MUTED },
      3: { cellWidth: 20, halign: 'right', textColor: COLOR_MUTED },
      4: { cellWidth: 25, halign: 'right', textColor: COLOR_TEXT },
      5: { cellWidth: 25, halign: 'right', textColor: COLOR_TEXT },
      6: { cellWidth: 23, halign: 'right', textColor: COLOR_HEAD_TEXT },
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index >= 2) {
        data.cell.styles.halign = 'right';
      }
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.textColor = [255, 255, 255];
      }
      if (data.section === 'body' && data.column.index === 4) {
        const c = paidUsdCells[data.row.index];
        if (c) {
          if (c.secondary) data.cell.styles.textColor = [255, 255, 255];
          else if (c.boldPrimary) data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = COLOR_SUBTLE;
        }
      }
      if (data.section === 'body' && data.column.index === 5) {
        const c = paidBsCells[data.row.index];
        if (c) {
          if (c.secondary) data.cell.styles.textColor = [255, 255, 255];
          else if (c.boldPrimary) data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = COLOR_SUBTLE;
        }
      }
    },
    didDrawCell: (data) => {
      const { cell } = data;
      if (data.section === 'head') {
        doc.setDrawColor(...COLOR_BORDER);
        doc.setLineWidth(0.25);
        doc.line(cell.x, cell.y, cell.x + cell.width, cell.y);
        doc.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
      } else if (data.section === 'body') {
        doc.setDrawColor(...COLOR_ROW_LINE);
        doc.setLineWidth(0.2);
        doc.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);

        if (data.column.index === 1) {
          const meta = conceptCells[data.row.index];
          if (meta) {
            const innerX = cell.x + 1.5;
            const innerW = cell.width - 3;
            let cursorY = cell.y + 4.7;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.9);
            doc.setTextColor(...COLOR_TEXT);
            const primaryWrapped = doc.splitTextToSize(meta.primary, innerW);
            doc.text(primaryWrapped, innerX, cursorY);
            cursorY += primaryWrapped.length * 3.35;

            if (meta.secondaryLines.length > 0) {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(6.9);
              doc.setTextColor(...COLOR_SUBTLE);
              meta.secondaryLines.forEach((line) => {
                const subWrapped = doc.splitTextToSize(line, innerW);
                doc.text(subWrapped, innerX, cursorY);
                cursorY += subWrapped.length * 3.0;
              });
            }
          }
        } else if (data.column.index === 4) {
          const c = paidUsdCells[data.row.index];
          if (c && c.secondary) {
            drawTwoLineCell(doc, cell, c);
          }
        } else if (data.column.index === 5) {
          const c = paidBsCells[data.row.index];
          if (c && c.secondary) {
            drawTwoLineCell(doc, cell, c);
          }
        }
      }
    },
  });

  // Right-aligned totals block (separated by currency — NEVER sum USD + Bs)
  const finalTableY = (doc as any).lastAutoTable?.finalY ?? y + 20;
  let totalY = finalTableY + 5;
  const totalsW = 86;
  const totalsX = pageW - marginX - totalsW;
  const rightX = pageW - marginX;

  for (const block of summary.blocks) {
    const isMixed = summary.blocks.length > 1;
    const cLabel = getCurrencyShortLabel(block.currency);
    const hasInterest = block.interest > 0.005;
    const hasRemaining = block.remaining > 0.005;
    const isConvertedBlock = summary.hasCrossCurrency && block.currency !== receipt.monedaPago;
    const blockH = 6 + (hasInterest ? 5 : 0) + 9 + (hasRemaining ? 6 : 0) + 3;

    if (totalY + blockH > pageH - marginY - 10) {
      doc.addPage();
      totalY = marginY + 4;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.3);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(
      isMixed
        ? lang === 'en'
          ? `Principal applied (${cLabel})`
          : `Capital aplicado (${cLabel})`
        : lang === 'en'
        ? 'Principal applied'
        : 'Capital aplicado',
      totalsX + 2.5,
      totalY
    );
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLOR_TEXT);
    doc.text(formatMoneyLocale(block.capital, block.currency, lang), rightX - 2.5, totalY, {
      align: 'right',
    });
    totalY += 4.8;

    if (hasInterest) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.3);
      doc.setTextColor(...COLOR_MUTED);
      doc.text(
        isMixed
          ? lang === 'en'
            ? `Interest paid (${cLabel})`
            : `Interés cobrado (${cLabel})`
          : lang === 'en'
          ? 'Interest paid'
          : 'Interés cobrado',
        totalsX + 2.5,
        totalY
      );
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLOR_TEXT);
      doc.text(formatMoneyLocale(block.interest, block.currency, lang), rightX - 2.5, totalY, {
        align: 'right',
      });
      totalY += 4.8;
    }

    const boxY = totalY - 2.2;
    const boxH = 8.2;
    doc.setFillColor(...COLOR_HEAD_BG);
    doc.roundedRect(totalsX, boxY, totalsW, boxH, 1.2, 1.2, 'F');
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.25);
    doc.line(totalsX, boxY, totalsX + totalsW, boxY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.4);
    doc.setTextColor(...COLOR_TEXT);
    doc.text(
      isConvertedBlock
        ? lang === 'en'
          ? `EQUIVALENT APPLIED (${cLabel})`
          : `EQUIVALENTE APLICADO (${cLabel})`
        : isMixed
        ? lang === 'en'
          ? `TOTAL PAID (${cLabel})`
          : `TOTAL COBRADO (${cLabel})`
        : lang === 'en'
        ? 'TOTAL PAID'
        : 'TOTAL COBRADO',
      totalsX + 2.5,
      boxY + 5.4
    );
    doc.setFontSize(9.8);
    doc.text(formatMoneyLocale(block.total, block.currency, lang), rightX - 2.5, boxY + 5.4, {
      align: 'right',
    });

    totalY = boxY + boxH + 4.2;

    if (hasRemaining) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.2);
      doc.setTextColor(...COLOR_MUTED);
      doc.text(
        isMixed
          ? lang === 'en'
            ? `Remaining balance (${cLabel})`
            : `Saldo restante (${cLabel})`
          : lang === 'en'
          ? 'Remaining balance'
          : 'Saldo restante',
        totalsX + 2.5,
        totalY
      );
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLOR_TEXT);
      doc.text(formatMoneyLocale(block.remaining, block.currency, lang), rightX - 2.5, totalY, {
        align: 'right',
      });
      totalY += 4.8;
    }
  }

  if (summary.hasCrossCurrency) {
    const recBoxH = 10;
    if (totalY + recBoxH > pageH - marginY - 10) {
      doc.addPage();
      totalY = marginY + 4;
    }
    const recY = totalY - 1.5;
    doc.setFillColor(...COLOR_GREEN_BG);
    doc.roundedRect(totalsX, recY, totalsW, recBoxH, 1.2, 1.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.1);
    doc.setTextColor(...COLOR_GREEN_TEXT);
    doc.text(
      lang === 'en' ? 'AMOUNT RECEIVED' : 'IMPORTE RECIBIDO',
      totalsX + 2.5,
      recY + 4.2
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.1);
    doc.text(
      `${lang === 'en' ? 'Applied FX' : 'TC aplicado'}: ${formatNumberLocale(
        receipt.tcAplicado,
        lang,
        2
      )}`,
      totalsX + 2.5,
      recY + 8.0
    );
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.8);
    doc.text(
      formatMoneyLocale(receipt.importeOriginalPagado, receipt.monedaPago, lang),
      rightX - 2.5,
      recY + 6.4,
      { align: 'right' }
    );
    totalY = recY + recBoxH + 3.5;
  }

  drawObservationAndFooter(doc, {
    observation: receipt.observacion,
    nonFiscalText: nonFiscal,
    lang,
    marginX,
    marginY,
    pageW,
    pageH,
    startY: totalY + 1,
  });

  const blob = doc.output('blob');
  const filename = buildSafeFilename(
    lang === 'en' ? 'Payment_Receipt' : 'Nota_Cobro',
    receipt.numero,
    receipt.clienteNombre
  );
  return { blob, filename };
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function sanitizeWhatsAppPhone(phone?: string): string {
  const digits = String(phone || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.length === 8) return `591${digits}`;
  return digits;
}

export async function sharePdfViaWhatsApp(params: {
  blob: Blob;
  filename: string;
  phone?: string;
  message: string;
  title: string;
}): Promise<{ method: 'web_share' | 'whatsapp_fallback' }> {
  const file = new File([params.blob], params.filename, { type: 'application/pdf' });
  const nav = navigator as any;
  if (typeof nav?.share === 'function') {
    try {
      const canShareFiles = typeof nav.canShare === 'function' ? nav.canShare({ files: [file] }) : false;
      if (canShareFiles) {
        await nav.share({
          title: params.title,
          text: params.message,
          files: [file],
        });
        return { method: 'web_share' };
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { method: 'web_share' };
      }
      // fallback below
    }
  }

  triggerBlobDownload(params.blob, params.filename);
  const cleanPhone = sanitizeWhatsAppPhone(params.phone);
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(params.message)}`
    : `https://wa.me/?text=${encodeURIComponent(params.message)}`;
  const link = document.createElement('a');
  link.href = waUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return { method: 'whatsapp_fallback' };
}
