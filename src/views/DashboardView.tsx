import React from 'react';
import {
  Tractor,
  Trees,
  Wrench,
  Layers,
  Calendar,
  AlertCircle,
  PlusCircle,
  History,
  LandPlot,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { Campaign, Machine, Lot, MachineryJob } from '../types';
import { formatDateDDMMAAAA } from '../services/backend';

interface Props {
  activeCampaign: Campaign | null;
  machines: Machine[];
  lots: Lot[];
  jobs: MachineryJob[];
  onNavigate: (view: 'maquinarias' | 'propiedad' | 'administracion') => void;
}

export const DashboardView: React.FC<Props> = ({
  activeCampaign,
  machines,
  lots,
  jobs,
  onNavigate,
}) => {
  // Filter jobs for active campaign and sort newest to oldest
  const campaignJobs = (activeCampaign
    ? jobs.filter((j) => j.campanaId === activeCampaign.id)
    : jobs
  ).slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  // Operational aggregates
  const totalHours = campaignJobs
    .filter((j) => j.unidad === 'hora' || (j.unidad as string) === 'h')
    .reduce((sum, j) => sum + (Number(j.cantidad) || 0), 0);

  const totalHectares = campaignJobs
    .filter((j) => j.unidad === 'hectarea' || (j.unidad as string) === 'ha')
    .reduce((sum, j) => sum + (Number(j.cantidad) || 0), 0);

  return (
    <div className="space-y-6 pb-8 w-full">
      {/* Active Campaign Banner */}
      {!activeCampaign ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 text-amber-700 shrink-0" />
            <div>
              <p className="font-bold">No hay una campaña activa seleccionada.</p>
              <p className="text-amber-800 text-[11px]">
                Configura o activa una campaña en Administración para sincronizar las actividades.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('administracion')}
            className="rounded-xl bg-amber-700 px-3.5 py-2 font-bold text-white hover:bg-amber-800 transition cursor-pointer min-h-[38px] text-center"
          >
            Configurar Campaña
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-stone-900 p-4 sm:p-5 text-white shadow-md border border-stone-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold truncate">
                Panel de Actividad Operativa
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight mt-1 truncate">
              {activeCampaign.nombre}
            </h1>
            <p className="text-[11px] sm:text-xs text-stone-400 mt-0.5 truncate">
              Iniciada: {activeCampaign.fechaInicio || 'Fecha no definida'} &bull; Registro centralizado de labores
            </p>
          </div>
        </div>
      )}

      {/* Operational Summary Grid (No Monetary Data) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* KPI 1: Maquinarias */}
        <div className="rounded-2xl border border-stone-200 bg-white p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wide">
              Maquinarias
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 shrink-0">
              <Tractor className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-stone-900 mt-2 font-mono">
            {machines.length} <span className="text-xs font-normal text-stone-500">equipos</span>
          </p>
        </div>

        {/* KPI 2: Lotes */}
        <div className="rounded-2xl border border-stone-200 bg-white p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wide">
              Lotes
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 shrink-0">
              <LandPlot className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-stone-900 mt-2 font-mono">
            {lots.length} <span className="text-xs font-normal text-stone-500">lotes</span>
          </p>
        </div>

        {/* KPI 3: Trabajos Realizados */}
        <div className="rounded-2xl border border-stone-200 bg-white p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wide">
              Trabajos
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 shrink-0">
              <Wrench className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-stone-900 mt-2 font-mono">
            {campaignJobs.length} <span className="text-xs font-normal text-stone-500">labores</span>
          </p>
        </div>

        {/* KPI 4: Horas Trabajadas */}
        <div className="rounded-2xl border border-stone-200 bg-white p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wide">
              Horas
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-700 shrink-0">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-emerald-800 mt-2 font-mono">
            {totalHours.toFixed(1)} <span className="text-xs font-normal text-stone-500">hrs</span>
          </p>
        </div>

        {/* KPI 5: Hectáreas Trabajadas */}
        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-stone-200 bg-white p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wide">
              Hectáreas
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-700 shrink-0">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-emerald-800 mt-2 font-mono">
            {totalHectares.toFixed(1)} <span className="text-xs font-normal text-stone-500">ha</span>
          </p>
        </div>
      </div>

      {/* Quick Access Shortcuts Section (Accesos Rápidos) */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
        <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider border-b border-stone-100 pb-2">
          Accesos Rápidos
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Shortcut 1 */}
          <button
            type="button"
            onClick={() => onNavigate('maquinarias')}
            className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-stone-50/70 hover:bg-emerald-50 hover:border-emerald-300 transition cursor-pointer text-left group min-h-[52px]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <PlusCircle className="h-4.5 w-4.5 text-emerald-700 shrink-0" />
              <span className="text-xs font-bold text-stone-800 group-hover:text-emerald-900 truncate">
                Registrar trabajo de maquinaria
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-700 shrink-0 ml-1" />
          </button>

          {/* Shortcut 2 */}
          <button
            type="button"
            onClick={() => onNavigate('maquinarias')}
            className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-stone-50/70 hover:bg-emerald-50 hover:border-emerald-300 transition cursor-pointer text-left group min-h-[52px]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <History className="h-4.5 w-4.5 text-emerald-700 shrink-0" />
              <span className="text-xs font-bold text-stone-800 group-hover:text-emerald-900 truncate">
                Movimientos de trabajos
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-700 shrink-0 ml-1" />
          </button>

          {/* Shortcut 3 */}
          <button
            type="button"
            onClick={() => onNavigate('propiedad')}
            className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-stone-50/70 hover:bg-emerald-50 hover:border-emerald-300 transition cursor-pointer text-left group min-h-[52px]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <LandPlot className="h-4.5 w-4.5 text-emerald-700 shrink-0" />
              <span className="text-xs font-bold text-stone-800 group-hover:text-emerald-900 truncate">
                Mis lotes
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-700 shrink-0 ml-1" />
          </button>

          {/* Shortcut 4 */}
          <button
            type="button"
            onClick={() => onNavigate('propiedad')}
            className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-stone-50/70 hover:bg-emerald-50 hover:border-emerald-300 transition cursor-pointer text-left group min-h-[52px]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Trees className="h-4.5 w-4.5 text-emerald-700 shrink-0" />
              <span className="text-xs font-bold text-stone-800 group-hover:text-emerald-900 truncate">
                Consultar movimientos
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-700 shrink-0 ml-1" />
          </button>
        </div>
      </div>

      {/* Recent Works List (Strictly NO prices or financial values) */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
          <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-700" />
            Últimos Trabajos Registrados
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('maquinarias')}
            className="text-xs text-emerald-700 hover:underline font-semibold"
          >
            Ver todos &rarr;
          </button>
        </div>

        {campaignJobs.length === 0 ? (
          <div className="py-10 text-center text-xs text-stone-400">
            No hay trabajos registrados en la campaña activa.
          </div>
        ) : (
          <div className="space-y-2">
            {/* MOBILE VIEW: Cards */}
            <div className="block sm:hidden space-y-2">
              {campaignJobs.slice(0, 6).map((job) => (
                <div key={job.id} className="p-3 rounded-xl border border-stone-200 bg-stone-50/70 text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-stone-900">{formatDateDDMMAAAA(job.fecha)} &bull; {job.maquinariaNombre || 'Maquinaria'}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${job.tipoTrabajo === 'propiedad' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                      {job.tipoTrabajo === 'propiedad' ? 'Propiedad' : 'Terceros'}
                    </span>
                  </div>
                  <div className="text-stone-600 flex justify-between pt-0.5">
                    <span>{job.tipoTrabajo === 'propiedad' ? `Lote: ${job.loteNombre || 'Lote'}` : `Cliente: ${job.cliente || 'Tercero'}`}</span>
                    <span className="font-bold font-mono text-emerald-800">{job.cantidad} {job.unidad}</span>
                  </div>
                  {job.observacion && (
                    <p className="text-[11px] text-stone-500 italic pt-1 border-t border-stone-200/60 truncate">
                      {job.observacion}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* DESKTOP VIEW: Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-stone-600">
                    <th className="py-2.5 px-3 font-semibold">Fecha</th>
                    <th className="py-2.5 px-3 font-semibold">Maquinaria</th>
                    <th className="py-2.5 px-3 font-semibold">Tipo</th>
                    <th className="py-2.5 px-3 font-semibold">Destino / Cliente</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Cantidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {campaignJobs.slice(0, 6).map((job) => (
                    <tr key={job.id} className="hover:bg-stone-50">
                      <td className="py-2 px-3 text-stone-600 whitespace-nowrap">{formatDateDDMMAAAA(job.fecha)}</td>
                      <td className="py-2 px-3 font-bold text-stone-900">{job.maquinariaNombre || 'Maquinaria'}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${job.tipoTrabajo === 'propiedad' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                          {job.tipoTrabajo === 'propiedad' ? 'Propiedad' : 'Terceros'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-stone-700">
                        {job.tipoTrabajo === 'propiedad' ? (job.loteNombre || 'Lote Propiedad') : (job.cliente || 'Tercero')}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-800 font-mono">
                        {job.cantidad} {job.unidad}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
