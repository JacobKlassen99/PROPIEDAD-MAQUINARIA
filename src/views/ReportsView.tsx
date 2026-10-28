import React, { useState } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  Filter,
  DollarSign,
  Tractor,
  Trees,
  TrendingUp,
  TrendingDown,
  Layers,
  Calendar,
} from 'lucide-react';
import {
  Campaign,
  Machine,
  Lot,
  MachineryJob,
  Expense,
  Income,
  Currency,
  ExchangeRateConfig,
} from '../types';

interface Props {
  campaigns: Campaign[];
  activeCampaign: Campaign | null;
  machines: Machine[];
  lots: Lot[];
  jobs: MachineryJob[];
  expenses: Expense[];
  incomes: Income[];
  currency: Currency;
  exchangeRate: ExchangeRateConfig;
}

type ReportTab = 'consolidado' | 'maquinarias' | 'propiedad' | 'comparativa';

export const ReportsView: React.FC<Props> = ({
  campaigns,
  activeCampaign,
  machines,
  lots,
  jobs,
  expenses,
  incomes,
  currency,
  exchangeRate,
}) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('consolidado');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(
    activeCampaign?.id || ''
  );

  // Helper to convert any amount to the active view currency ('BOB' | 'USD') before summing
  const toViewCurrency = (amount: number, itemMoneda: Currency | string = 'BOB', itemTc?: number): number => {
    const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    const itemCur: Currency = String(itemMoneda || 'BOB').toUpperCase().includes('USD') ? 'USD' : 'BOB';
    if (itemCur === currency) return num;

    const rate = (typeof itemTc === 'number' && itemTc > 0)
      ? itemTc
      : (exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0 ? exchangeRate.tasaBobPerUsd : 0);

    if (rate <= 0) {
      return num;
    }

    if (itemCur === 'USD' && currency === 'BOB') {
      return num * rate;
    }
    if (itemCur === 'BOB' && currency === 'USD') {
      return num / rate;
    }
    return num;
  };

  const formatMoney = (val: number | undefined | null) => {
    const symbol = currency === 'BOB' ? 'Bs' : 'USD';
    const num = typeof val === 'number' && !isNaN(val) ? val : 0;
    return `${symbol} ${num.toLocaleString('es-BO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Filter dataset by selected campaign
  const filteredJobs = selectedCampaignId
    ? jobs.filter((j) => j.campanaId === selectedCampaignId)
    : jobs;
  const filteredExpenses = selectedCampaignId
    ? expenses.filter((e) => e.campanaId === selectedCampaignId)
    : expenses;
  const filteredIncomes = selectedCampaignId
    ? incomes.filter((i) => i.campanaId === selectedCampaignId)
    : incomes;

  // Consolidado Real (Conversión unificada a la moneda seleccionada antes de sumar)
  const extJobIncomes = filteredJobs
    .filter((j) => j.tipoTrabajo === 'tercero')
    .reduce((sum, j) => sum + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio), 0);

  const intJobIncomes = filteredJobs
    .filter((j) => j.tipoTrabajo === 'propiedad')
    .reduce((sum, j) => sum + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio), 0);

  const cropIncomes = filteredIncomes
    .filter((i) => i.modulo === 'propiedad' && !i.esTrabajoPropio)
    .reduce((sum, i) => sum + toViewCurrency(Number(i.total) || 0, i.moneda, i.tipoCambio), 0);

  const maqDirectExps = filteredExpenses
    .filter((e) => e.modulo === 'maquinarias')
    .reduce((sum, e) => sum + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio), 0);

  const propDirectExps = filteredExpenses
    .filter((e) => e.modulo === 'propiedad' && !e.esTrabajoPropio)
    .reduce((sum, e) => sum + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio), 0);

  const propMaqServiceExps = filteredExpenses
    .filter((e) => e.modulo === 'propiedad' && e.esTrabajoPropio)
    .reduce((sum, e) => sum + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio), 0);

  // Consolidado real sin duplicar
  const consolidatedIncomes = extJobIncomes + cropIncomes;
  const consolidatedExpenses = maqDirectExps + propDirectExps;
  const consolidatedProfit = consolidatedIncomes - consolidatedExpenses;

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Export CSV
  const handleExportCSV = () => {
    let rows: string[][] = [];
    if (activeTab === 'consolidado') {
      rows = [
        ['CONCEPTO', 'IMPORTE (' + currency + ')'],
        ['Ingresos Servicios Externos', extJobIncomes.toFixed(2)],
        ['Ingresos Venta Cosecha Agrícola', cropIncomes.toFixed(2)],
        ['TOTAL INGRESOS REALES', consolidatedIncomes.toFixed(2)],
        ['Gastos Directos Maquinarias', maqDirectExps.toFixed(2)],
        ['Gastos Agrícolas Directos', propDirectExps.toFixed(2)],
        ['TOTAL GASTOS REALES', consolidatedExpenses.toFixed(2)],
        ['RESULTADO CONSOLIDADO', consolidatedProfit.toFixed(2)],
      ];
    } else if (activeTab === 'maquinarias') {
      rows = [
        ['MAQUINARIA', 'TIPO', 'TARIFA', 'HORAS', 'HA', 'INGRESOS', 'GASTOS', 'MARGEN'],
        ...machines.map((m) => {
          const mJobs = filteredJobs.filter((j) => j.maquinariaId === m.id);
          const mExps = filteredExpenses.filter((e) => e.maquinariaId === m.id);
          const hrs = mJobs.filter((j) => j.unidad === 'hora').reduce((s, j) => s + (Number(j.cantidad) || 0), 0);
          const ha = mJobs.filter((j) => j.unidad === 'hectarea').reduce((s, j) => s + (Number(j.cantidad) || 0), 0);
          const inc = mJobs.reduce((s, j) => s + toViewCurrency(Number(j.total) || 0, j.moneda, j.tipoCambio), 0);
          const exp = mExps.reduce((s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio), 0);
          return [m.nombre, m.tipo, `${m.tarifa}/${m.unidad}`, hrs.toFixed(1), ha.toFixed(1), inc.toFixed(2), exp.toFixed(2), (inc - exp).toFixed(2)];
        }),
      ];
    } else {
      rows = [
        ['LOTE', 'HA', 'CULTIVO', 'INGRESOS COSECHA', 'GASTOS DIRECTOS', 'MAQUINARIA PROPIA', 'RESULTADO NETO'],
        ...lots.map((l) => {
          const lIncs = filteredIncomes.filter((i) => i.loteId === l.id).reduce((s, i) => s + toViewCurrency(Number(i.total) || 0, i.moneda, i.tipoCambio), 0);
          const lExpDir = filteredExpenses.filter((e) => e.loteId === l.id && !e.esTrabajoPropio).reduce((s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio), 0);
          const lExpMaq = filteredExpenses.filter((e) => e.loteId === l.id && e.esTrabajoPropio).reduce((s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tipoCambio), 0);
          const net = lIncs - (lExpDir + lExpMaq);
          return [l.nombre, String(l.superficieHectareas), l.cultivoActual || '', lIncs.toFixed(2), lExpDir.toFixed(2), lExpMaq.toFixed(2), net.toFixed(2)];
        }),
      ];
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reporte_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 w-full">
      {/* Header & Controls */}
      <div className="flex flex-col gap-3 border-b border-stone-200 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-xs">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight truncate">
              REPORTES FINANCIEROS Y OPERATIVOS
            </h1>
            <p className="text-[11px] sm:text-xs text-stone-500 truncate">
              Consolidado sin doble contabilización y análisis por módulo
            </p>
          </div>
        </div>

        {/* Filter and Action Buttons - Wraps Cleanly on Small Mobile */}
        <div className="flex flex-wrap items-center gap-2 w-full">
          <div className="flex items-center gap-1.5 bg-stone-100 px-3 py-2 rounded-xl border border-stone-200 flex-1 min-w-[170px]">
            <Filter className="h-3.5 w-3.5 text-stone-500 shrink-0" />
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="text-xs bg-transparent border-none font-semibold text-stone-800 focus:outline-none w-full"
            >
              <option value="">-- Todas las Campañas --</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.activa ? '(Activa)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition cursor-pointer min-h-[38px]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition cursor-pointer min-h-[38px]"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>

        {/* Subtabs - Mobile Responsive */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs w-full">
          <button
            type="button"
            onClick={() => setActiveTab('consolidado')}
            className={`min-h-[38px] px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer text-center truncate ${
              activeTab === 'consolidado'
                ? 'bg-white text-emerald-800 shadow-xs border border-stone-200'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Consolidado General
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('maquinarias')}
            className={`min-h-[38px] px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer text-center truncate ${
              activeTab === 'maquinarias'
                ? 'bg-white text-emerald-800 shadow-xs border border-stone-200'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Maquinarias
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('propiedad')}
            className={`min-h-[38px] px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer text-center truncate ${
              activeTab === 'propiedad'
                ? 'bg-white text-emerald-800 shadow-xs border border-stone-200'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Propiedad
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('comparativa')}
            className={`min-h-[38px] px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer text-center truncate ${
              activeTab === 'comparativa'
                ? 'bg-white text-emerald-800 shadow-xs border border-stone-200'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Campañas
          </button>
        </div>
      </div>

      {/* TAB 1: CONSOLIDADO GENERAL */}
      {activeTab === 'consolidado' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5">
              <span className="text-[11px] sm:text-xs font-semibold text-emerald-800 uppercase tracking-wider block">
                Total Ingresos Reales Externos
              </span>
              <p className="text-xl sm:text-2xl font-bold text-emerald-950 mt-1 break-words">
                {formatMoney(consolidatedIncomes)}
              </p>
              <div className="mt-3 text-xs text-emerald-800 space-y-1 border-t border-emerald-200/60 pt-2">
                <div className="flex justify-between">
                  <span>Servicios a Terceros:</span>
                  <span className="font-semibold">{formatMoney(extJobIncomes)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Venta de Cosechas:</span>
                  <span className="font-semibold">{formatMoney(cropIncomes)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 sm:p-5">
              <span className="text-[11px] sm:text-xs font-semibold text-red-800 uppercase tracking-wider block">
                Total Gastos Reales
              </span>
              <p className="text-xl sm:text-2xl font-bold text-red-950 mt-1 break-words">
                {formatMoney(consolidatedExpenses)}
              </p>
              <div className="mt-3 text-xs text-red-800 space-y-1 border-t border-red-200/60 pt-2">
                <div className="flex justify-between">
                  <span>Gastos Maquinarias:</span>
                  <span className="font-semibold">{formatMoney(maqDirectExps)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Gastos Agrícolas Directos:</span>
                  <span className="font-semibold">{formatMoney(propDirectExps)}</span>
                </div>
              </div>
            </div>

            <div className="col-span-1 sm:col-span-2 lg:col-span-1 rounded-2xl border border-stone-300 bg-stone-900 text-white p-4 sm:p-5 shadow-lg">
              <span className="text-[11px] sm:text-xs font-semibold text-emerald-400 uppercase tracking-wider block">
                Resultado Neto Consolidado
              </span>
              <p className="text-xl sm:text-2xl font-bold text-white mt-1 break-words">
                {formatMoney(consolidatedProfit)}
              </p>
              <p className="text-[11px] text-stone-400 mt-3 pt-2 border-t border-stone-800">
                El trabajo interno de maquinaria propia ({formatMoney(intJobIncomes)}) se compensó internamente sin duplicar gastos.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs">
            <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-4 pb-2 border-b border-stone-100">
              Estado de Resultados Consolidado de la Operación
            </h3>

            {/* MOBILE VIEW: Stacked Clean Breakdown Cards */}
            <div className="block md:hidden space-y-2.5">
              <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 space-y-1 text-xs">
                <p className="font-bold text-stone-900 text-xs">Ingresos Externos (Terceros)</p>
                <div className="flex justify-between text-stone-600">
                  <span>Módulo Maquinarias:</span>
                  <span className="font-mono font-semibold text-stone-900">{formatMoney(extJobIncomes)}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Módulo Propiedad:</span>
                  <span className="font-mono text-stone-400">-</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-stone-200 font-bold text-stone-900">
                  <span>Total Ingresos Externos:</span>
                  <span className="font-mono text-emerald-800">{formatMoney(extJobIncomes)}</span>
                </div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 space-y-1 text-xs">
                <p className="font-bold text-stone-900 text-xs">Ingresos Agrícolas (Cosecha)</p>
                <div className="flex justify-between text-stone-600">
                  <span>Módulo Maquinarias:</span>
                  <span className="font-mono text-stone-400">-</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Módulo Propiedad:</span>
                  <span className="font-mono font-semibold text-stone-900">{formatMoney(cropIncomes)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-stone-200 font-bold text-stone-900">
                  <span>Total Cosecha:</span>
                  <span className="font-mono text-emerald-800">{formatMoney(cropIncomes)}</span>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-amber-950 text-xs">Trabajo Interno Maquinaria Propia</p>
                  <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                    Se compensa a 0
                  </span>
                </div>
                <div className="flex justify-between text-stone-700">
                  <span>Ingreso Maquinarias:</span>
                  <span className="font-mono font-bold text-emerald-800">+{formatMoney(intJobIncomes)}</span>
                </div>
                <div className="flex justify-between text-stone-700">
                  <span>Costo Lote Propiedad:</span>
                  <span className="font-mono font-bold text-red-700">-{formatMoney(propMaqServiceExps)}</span>
                </div>
                <p className="text-[10px] text-amber-800 italic pt-1">
                  Movimiento interno vinculado. No altera la caja consolidada.
                </p>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 space-y-1 text-xs">
                <p className="font-bold text-stone-900 text-xs">Gastos Directos de Operación</p>
                <div className="flex justify-between text-stone-600">
                  <span>Maquinarias (Diésel, Repuestos, etc.):</span>
                  <span className="font-mono text-red-700">-{formatMoney(maqDirectExps)}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Propiedad (Semillas, Químicos, etc.):</span>
                  <span className="font-mono text-red-700">-{formatMoney(propDirectExps)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-stone-200 font-bold text-stone-900">
                  <span>Total Gastos Reales:</span>
                  <span className="font-mono text-red-700">-{formatMoney(consolidatedExpenses)}</span>
                </div>
              </div>

              <div className="rounded-xl border-2 border-stone-800 bg-stone-900 text-white p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                    Utilidad / Margen Consolidado
                  </span>
                  <span className="text-base font-bold font-mono text-emerald-300">
                    {formatMoney(consolidatedProfit)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-stone-800 text-stone-300">
                  <div>
                    <span className="text-stone-400 block">Margen Maquinarias:</span>
                    <span className="font-mono font-bold text-white">
                      {formatMoney(extJobIncomes + intJobIncomes - maqDirectExps)}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block">Margen Propiedad:</span>
                    <span className="font-mono font-bold text-white">
                      {formatMoney(cropIncomes - (propDirectExps + propMaqServiceExps))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* DESKTOP VIEW: Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-stone-600">
                    <th className="py-2.5 px-3 font-bold">Rubro / Concepto</th>
                    <th className="py-2.5 px-3 font-bold text-right">Maquinarias</th>
                    <th className="py-2.5 px-3 font-bold text-right">Propiedad</th>
                    <th className="py-2.5 px-3 font-bold text-right">Ajuste Interno</th>
                    <th className="py-2.5 px-3 font-bold text-right">Consolidado Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-mono">
                  <tr>
                    <td className="py-2 px-3 font-sans font-medium text-stone-900">Ingresos Externos (Terceros)</td>
                    <td className="py-2 px-3 text-right text-stone-900">{formatMoney(extJobIncomes)}</td>
                    <td className="py-2 px-3 text-right text-stone-400">-</td>
                    <td className="py-2 px-3 text-right text-stone-400">-</td>
                    <td className="py-2 px-3 text-right font-bold text-stone-900">{formatMoney(extJobIncomes)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-sans font-medium text-stone-900">Ingresos Agrícolas (Cosecha)</td>
                    <td className="py-2 px-3 text-right text-stone-400">-</td>
                    <td className="py-2 px-3 text-right text-stone-900">{formatMoney(cropIncomes)}</td>
                    <td className="py-2 px-3 text-right text-stone-400">-</td>
                    <td className="py-2 px-3 text-right font-bold text-stone-900">{formatMoney(cropIncomes)}</td>
                  </tr>
                  <tr className="bg-amber-50/40 text-amber-900">
                    <td className="py-2 px-3 font-sans font-medium">Trabajo Interno Maquinaria Propia</td>
                    <td className="py-2 px-3 text-right text-emerald-800">+{formatMoney(intJobIncomes)}</td>
                    <td className="py-2 px-3 text-right text-red-700">-{formatMoney(propMaqServiceExps)}</td>
                    <td className="py-2 px-3 text-right font-bold text-amber-800">Se compensa (0)</td>
                    <td className="py-2 px-3 text-right font-bold text-stone-500">0.00</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-sans font-medium text-stone-900">Gastos Directos de Operación</td>
                    <td className="py-2 px-3 text-right text-red-700">-{formatMoney(maqDirectExps)}</td>
                    <td className="py-2 px-3 text-right text-red-700">-{formatMoney(propDirectExps)}</td>
                    <td className="py-2 px-3 text-right text-stone-400">-</td>
                    <td className="py-2 px-3 text-right font-bold text-red-700">-{formatMoney(consolidatedExpenses)}</td>
                  </tr>
                  <tr className="border-t-2 border-stone-800 bg-stone-100 font-sans font-bold text-sm">
                    <td className="py-3 px-3 text-stone-900">UTILIDAD / MARGEN NETO</td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-800">
                      {formatMoney(extJobIncomes + intJobIncomes - maqDirectExps)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-stone-900">
                      {formatMoney(cropIncomes - (propDirectExps + propMaqServiceExps))}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-stone-500">0.00</td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-900">
                      {formatMoney(consolidatedProfit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MAQUINARIAS */}
      {activeTab === 'maquinarias' && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider pb-2 border-b border-stone-100">
            Reporte por Maquinaria
          </h3>

          {/* MOBILE VIEW: Vertical Cards */}
          <div className="block md:hidden space-y-2.5">
            {machines.map((m) => {
              const mJobs = filteredJobs.filter((j) => j.maquinariaId === m.id);
              const mExps = filteredExpenses.filter((e) => e.maquinariaId === m.id);

              const hrs = mJobs.filter((j) => j.unidad === 'hora').reduce((s, j) => s + (Number(j.cantidad) || 0), 0);
              const ha = mJobs.filter((j) => j.unidad === 'hectarea').reduce((s, j) => s + (Number(j.cantidad) || 0), 0);

              const incTerceros = mJobs
                .filter((j) => j.tipoTrabajo === 'tercero')
                .reduce((s, j) => s + toViewCurrency(Number(j.total) || 0, j.moneda, j.tc), 0);
              const incPropiedad = mJobs
                .filter((j) => j.tipoTrabajo === 'propiedad')
                .reduce((s, j) => s + toViewCurrency(Number(j.total) || 0, j.moneda, j.tc), 0);
              const expDirect = mExps.reduce((s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tc), 0);
              const net = incTerceros + incPropiedad - expDirect;

              return (
                <div key={m.id} className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 space-y-2">
                  <div className="flex items-center justify-between border-b border-stone-200/60 pb-2">
                    <div>
                      <h4 className="text-xs font-bold text-stone-900">{m.nombre}</h4>
                      <span className="text-[10px] text-stone-500">{m.tipo} &bull; {m.identificacion}</span>
                    </div>
                    <span className="text-xs font-mono font-semibold text-emerald-800">
                      {hrs.toFixed(1)} hrs &bull; {ha.toFixed(1)} ha
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-stone-600">
                    <div className="flex justify-between">
                      <span>Ingresos Terceros:</span>
                      <span className="font-mono text-stone-900">{formatMoney(incTerceros)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ingresos Propiedad:</span>
                      <span className="font-mono text-emerald-800">{formatMoney(incPropiedad)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gastos Directos:</span>
                      <span className="font-mono text-red-700">{formatMoney(expDirect)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-stone-200/60">
                    <span className="text-xs font-bold text-stone-900">Margen Neto:</span>
                    <span className={`text-sm font-bold font-mono ${net >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>
                      {formatMoney(net)}
                    </span>
                  </div>
                </div>
              );
            })}

            {machines.length === 0 && (
              <div className="py-10 text-center text-xs text-stone-400">
                No hay maquinarias configuradas.
              </div>
            )}
          </div>

          {/* DESKTOP VIEW: Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-stone-600">
                  <th className="py-2.5 px-3 font-semibold">Maquinaria</th>
                  <th className="py-2.5 px-3 font-semibold">Tipo</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Horas</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Hectáreas</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Ingresos Terceros</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Ingresos Propiedad</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Gastos Directos</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Margen Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {machines.map((m) => {
                  const mJobs = filteredJobs.filter((j) => j.maquinariaId === m.id);
                  const mExps = filteredExpenses.filter((e) => e.maquinariaId === m.id);

                  const hrs = mJobs.filter((j) => j.unidad === 'hora').reduce((s, j) => s + (Number(j.cantidad) || 0), 0);
                  const ha = mJobs.filter((j) => j.unidad === 'hectarea').reduce((s, j) => s + (Number(j.cantidad) || 0), 0);

                  const incTerceros = mJobs
                    .filter((j) => j.tipoTrabajo === 'tercero')
                    .reduce((s, j) => s + toViewCurrency(Number(j.total) || 0, j.moneda, j.tc), 0);
                  const incPropiedad = mJobs
                    .filter((j) => j.tipoTrabajo === 'propiedad')
                    .reduce((s, j) => s + toViewCurrency(Number(j.total) || 0, j.moneda, j.tc), 0);
                  const expDirect = mExps.reduce((s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tc), 0);
                  const net = incTerceros + incPropiedad - expDirect;

                  return (
                    <tr key={m.id} className="hover:bg-stone-50">
                      <td className="py-2.5 px-3 font-bold text-stone-900">{m.nombre}</td>
                      <td className="py-2.5 px-3 text-stone-600">{m.tipo}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{hrs.toFixed(1)} h</td>
                      <td className="py-2.5 px-3 text-right font-mono">{ha.toFixed(1)} ha</td>
                      <td className="py-2.5 px-3 text-right font-mono text-stone-900">{formatMoney(incTerceros)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-800">{formatMoney(incPropiedad)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-red-700">{formatMoney(expDirect)}</td>
                      <td className="py-2.5 px-3 text-right font-bold font-mono text-stone-900">{formatMoney(net)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PROPIEDAD */}
      {activeTab === 'propiedad' && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider pb-2 border-b border-stone-100">
            Reporte por Lote Agrícola
          </h3>

          {/* MOBILE VIEW: Vertical Cards */}
          <div className="block md:hidden space-y-2.5">
            {lots.map((l) => {
              const lIncs = filteredIncomes
                .filter((i) => i.loteId === l.id)
                .reduce((s, i) => s + toViewCurrency(Number(i.total) || 0, i.moneda, i.tc), 0);
              const lExpDir = filteredExpenses
                .filter((e) => e.loteId === l.id && !e.esTrabajoPropio)
                .reduce((s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tc), 0);
              const lExpMaq = filteredExpenses
                .filter((e) => e.loteId === l.id && e.esTrabajoPropio)
                .reduce((s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tc), 0);
              const totalGasto = lExpDir + lExpMaq;
              const net = lIncs - totalGasto;

              return (
                <div key={l.id} className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 space-y-2">
                  <div className="flex items-center justify-between border-b border-stone-200/60 pb-2">
                    <div>
                      <h4 className="text-xs font-bold text-stone-900">{l.nombre}</h4>
                      <span className="text-[10px] text-stone-500">{l.superficieHectareas} ha &bull; {l.cultivoActual || 'Sin cultivo'}</span>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-stone-600">
                    <div className="flex justify-between">
                      <span>Venta Cosecha:</span>
                      <span className="font-mono text-emerald-800 font-semibold">{formatMoney(lIncs)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gastos Directos:</span>
                      <span className="font-mono text-red-700">{formatMoney(lExpDir)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Maquinaria Propia:</span>
                      <span className="font-mono text-amber-700">{formatMoney(lExpMaq)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-stone-200/60 font-semibold text-stone-800">
                      <span>Gasto Total Lote:</span>
                      <span className="font-mono text-red-800">{formatMoney(totalGasto)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-stone-200/60">
                    <span className="text-xs font-bold text-stone-900">Resultado Neto:</span>
                    <span className={`text-sm font-bold font-mono ${net >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>
                      {formatMoney(net)}
                    </span>
                  </div>
                </div>
              );
            })}

            {lots.length === 0 && (
              <div className="py-10 text-center text-xs text-stone-400">
                No hay lotes configurados.
              </div>
            )}
          </div>

          {/* DESKTOP VIEW: Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-stone-600">
                  <th className="py-2.5 px-3 font-semibold">Lote</th>
                  <th className="py-2.5 px-3 font-semibold">Superficie</th>
                  <th className="py-2.5 px-3 font-semibold">Cultivo</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Venta Cosecha</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Gastos Directos</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Maquinaria Propia</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Gasto Total Lote</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Resultado Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {lots.map((l) => {
                  const lIncs = filteredIncomes
                    .filter((i) => i.loteId === l.id)
                    .reduce((s, i) => s + toViewCurrency(Number(i.total) || 0, i.moneda, i.tc), 0);
                  const lExpDir = filteredExpenses
                    .filter((e) => e.loteId === l.id && !e.esTrabajoPropio)
                    .reduce((s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tc), 0);
                  const lExpMaq = filteredExpenses
                    .filter((e) => e.loteId === l.id && e.esTrabajoPropio)
                    .reduce((s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tc), 0);
                  const totalGasto = lExpDir + lExpMaq;
                  const net = lIncs - totalGasto;

                  return (
                    <tr key={l.id} className="hover:bg-stone-50">
                      <td className="py-2.5 px-3 font-bold text-stone-900">{l.nombre}</td>
                      <td className="py-2.5 px-3 text-stone-600">{l.superficieHectareas} ha</td>
                      <td className="py-2.5 px-3 text-stone-700">{l.cultivoActual || '-'}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-800">{formatMoney(lIncs)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-red-700">{formatMoney(lExpDir)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-700">{formatMoney(lExpMaq)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-red-800 font-semibold">{formatMoney(totalGasto)}</td>
                      <td className={`py-2.5 px-3 text-right font-bold font-mono ${net >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>
                        {formatMoney(net)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: COMPARATIVA CAMPAÑAS */}
      {activeTab === 'comparativa' && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider pb-2 border-b border-stone-100">
            Comparación Histórica entre Campañas
          </h3>

          {/* MOBILE VIEW: Vertical Cards */}
          <div className="block md:hidden space-y-2.5">
            {campaigns.map((c) => {
              const cJobs = jobs.filter((j) => j.campanaId === c.id);
              const cIncomes = incomes.filter((i) => i.campanaId === c.id);
              const cExpenses = expenses.filter((e) => e.campanaId === c.id);

              const ext = cJobs
                .filter((j) => j.tipoTrabajo === 'tercero')
                .reduce((s, j) => s + toViewCurrency(Number(j.total) || 0, j.moneda, j.tc), 0);
              const crop = cIncomes
                .filter((i) => i.modulo === 'propiedad' && !i.esTrabajoPropio)
                .reduce((s, i) => s + toViewCurrency(Number(i.total) || 0, i.moneda, i.tc), 0);
              const exp = cExpenses
                .filter((e) => !e.esTrabajoPropio)
                .reduce((s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tc), 0);
              const profit = ext + crop - exp;

              return (
                <div key={c.id} className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 space-y-2">
                  <div className="flex items-center justify-between border-b border-stone-200/60 pb-2">
                    <span className="text-xs font-bold text-stone-900">{c.nombre}</span>
                    <span className={`px-2 py-0.5 text-[10px] rounded font-semibold ${c.activa ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'}`}>
                      {c.activa ? 'Activa' : 'Cerrada'}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-stone-600">
                    <div className="flex justify-between">
                      <span>Ingresos Externos:</span>
                      <span className="font-mono text-stone-900">{formatMoney(ext)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ingresos Agrícolas:</span>
                      <span className="font-mono text-emerald-800">{formatMoney(crop)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gastos Reales:</span>
                      <span className="font-mono text-red-700">{formatMoney(exp)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-stone-200/60">
                    <span className="text-xs font-bold text-stone-900">Resultado Neto:</span>
                    <span className={`text-sm font-bold font-mono ${profit >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>
                      {formatMoney(profit)}
                    </span>
                  </div>
                </div>
              );
            })}

            {campaigns.length === 0 && (
              <div className="py-10 text-center text-xs text-stone-400">
                No hay campañas registradas.
              </div>
            )}
          </div>

          {/* DESKTOP VIEW: Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-stone-600">
                  <th className="py-2.5 px-3 font-semibold">Campaña</th>
                  <th className="py-2.5 px-3 font-semibold">Estado</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Ingresos Externos</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Ingresos Agrícolas</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Gastos Reales</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Resultado Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {campaigns.map((c) => {
                  const cJobs = jobs.filter((j) => j.campanaId === c.id);
                  const cIncomes = incomes.filter((i) => i.campanaId === c.id);
                  const cExpenses = expenses.filter((e) => e.campanaId === c.id);

                  const ext = cJobs
                    .filter((j) => j.tipoTrabajo === 'tercero')
                    .reduce((s, j) => s + toViewCurrency(Number(j.total) || 0, j.moneda, j.tc), 0);
                  const crop = cIncomes
                    .filter((i) => i.modulo === 'propiedad' && !i.esTrabajoPropio)
                    .reduce((s, i) => s + toViewCurrency(Number(i.total) || 0, i.moneda, i.tc), 0);
                  const exp = cExpenses
                    .filter((e) => !e.esTrabajoPropio)
                    .reduce((s, e) => s + toViewCurrency(Number(e.total) || 0, e.moneda, e.tc), 0);
                  const profit = ext + crop - exp;

                  return (
                    <tr key={c.id} className="hover:bg-stone-50">
                      <td className="py-2.5 px-3 font-bold text-stone-900">{c.nombre}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 text-[10px] rounded font-semibold ${c.activa ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'}`}>
                          {c.activa ? 'Activa' : 'Cerrada'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-stone-900">{formatMoney(ext)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-800">{formatMoney(crop)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-red-700">{formatMoney(exp)}</td>
                      <td className={`py-2.5 px-3 text-right font-bold font-mono ${profit >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>
                        {formatMoney(profit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
