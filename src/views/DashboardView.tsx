import React from 'react';
import {
  Tractor,
  Layers,
  Wrench,
  Activity,
  LandPlot,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { Campaign, Machine, Lot, MachineryJob, MainView } from '../types';
import { formatDateDDMMAAAA } from '../services/backend';

interface Props {
  activeCampaign: Campaign | null;
  machines: Machine[];
  lots: Lot[];
  jobs: MachineryJob[];
  onNavigate: (view: MainView) => void;
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
    .filter((j) => j.unidad === 'hora' || (j.unidad as string) === 'h' || (j.unidad as string) === 'horas')
    .reduce((sum, j) => sum + (Number(j.cantidad) || 0), 0);

  const totalHectares = campaignJobs
    .filter((j) => j.unidad === 'hectarea' || (j.unidad as string) === 'ha' || (j.unidad as string) === 'hectareas')
    .reduce((sum, j) => sum + (Number(j.cantidad) || 0), 0);

  // Up to 5 most recent jobs
  const recentJobs = campaignJobs.slice(0, 5);

  const formatUnit = (unit: string | undefined): string => {
    if (!unit) return '';
    const u = unit.toLowerCase().trim();
    if (u === 'hora' || u === 'h' || u === 'horas') return 'horas';
    if (u === 'hectarea' || u === 'ha' || u === 'hectareas') return 'ha';
    return unit;
  };

  const formatQuantity = (val: number | undefined): string => {
    if (val === undefined || val === null || isNaN(val)) return '0';
    return Number(val).toLocaleString('es-BO', { maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-4 pb-6 w-full max-w-4xl mx-auto">
      {/* Aviso si no hay campaña activa */}
      {!activeCampaign && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 text-amber-700 shrink-0" />
            <div>
              <p className="font-bold text-sm">No hay una campaña activa seleccionada</p>
              <p className="text-amber-800 text-xs">
                Selecciona o activa una campaña en Administración para visualizar la información correspondiente.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('administracion')}
            className="rounded-xl bg-amber-700 px-4 py-2 font-bold text-white hover:bg-amber-800 transition active:scale-95 cursor-pointer min-h-[40px] text-center"
          >
            Configurar Campaña
          </button>
        </div>
      )}

      {/* CINCO ESTADÍSTICAS OPERATIVAS (Altura compacta estilo iOS) */}
      <section aria-label="Estadísticas generales">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
          {/* 1. Maquinarias */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-3.5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs font-semibold text-slate-500">
                Maquinarias
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 shrink-0">
                <Tractor className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-1.5">
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {machines.length}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">equipos registrados</p>
            </div>
          </div>

          {/* 2. Lotes */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-3.5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs font-semibold text-slate-500">
                Lotes
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 shrink-0">
                <LandPlot className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-1.5">
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {lots.length}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">lotes registrados</p>
            </div>
          </div>

          {/* 3. Trabajos */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-3.5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs font-semibold text-slate-500">
                Trabajos
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 shrink-0">
                <Wrench className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-1.5">
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {campaignJobs.length}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">trabajos registrados</p>
            </div>
          </div>

          {/* 4. Horas */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-3.5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs font-semibold text-slate-500">
                Horas
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 shrink-0">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-1.5">
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {totalHours.toLocaleString('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">horas trabajadas</p>
            </div>
          </div>

          {/* 5. Hectáreas (En teléfono ocupa las 2 columnas) */}
          <div className="col-span-2 lg:col-span-1 rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-3.5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs font-semibold text-slate-500">
                Hectáreas
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 shrink-0">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-1.5">
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {totalHectares.toLocaleString('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">hectáreas trabajadas</p>
            </div>
          </div>
        </div>
      </section>

      {/* ÚLTIMOS TRABAJOS REGISTRADOS */}
      <section aria-label="Últimos trabajos registrados" className="space-y-2.5">
        <div className="flex items-center justify-between px-1 pt-1">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Últimos trabajos registrados
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('maquinarias')}
            className="text-xs sm:text-sm font-bold text-emerald-700 hover:text-emerald-800 transition flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-emerald-50 cursor-pointer min-h-[36px]"
          >
            <span>Ver todos</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {recentJobs.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs">
            <p className="text-xs sm:text-sm font-medium text-slate-500">
              No hay trabajos registrados en esta gestión.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentJobs.map((job) => {
              const formattedDate = formatDateDDMMAAAA(job.fecha);
              const isPropiedad = job.tipoTrabajo === 'propiedad';

              // Main title: job name or machinery name or default
              const mainTitle = job.trabajoNombre || job.maquinariaNombre || 'Trabajo de maquinaria';

              // Build details array avoiding repetition
              const details: string[] = [];
              if (job.trabajoNombre && job.maquinariaNombre) {
                details.push(job.maquinariaNombre);
              }
              if (isPropiedad && job.loteNombre) {
                details.push(`Lote: ${job.loteNombre}`);
              } else if (!isPropiedad && job.cliente) {
                details.push(`Cliente: ${job.cliente}`);
              }

              const subText = details.join(' • ');

              const unitText = formatUnit(job.unidad);
              const qtyText = formatQuantity(job.cantidad);

              return (
                <div
                  key={job.id}
                  onClick={() => onNavigate('maquinarias')}
                  className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-3.5 shadow-xs hover:border-emerald-300 hover:shadow-sm transition active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Detalle izquierdo */}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {formattedDate || 'Sin fecha'}
                        </span>
                        <span
                          className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                            isPropiedad
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                              : 'bg-blue-50 text-blue-800 border-blue-200/80'
                          }`}
                        >
                          {isPropiedad ? 'Propiedad' : 'Terceros'}
                        </span>
                      </div>

                      <p className="text-sm sm:text-base font-bold text-slate-900 leading-snug truncate">
                        {mainTitle}
                      </p>

                      {subText ? (
                        <p className="text-xs text-slate-600 truncate">
                          {subText}
                        </p>
                      ) : null}

                      {job.observacion ? (
                        <p className="text-[11px] text-slate-400 italic pt-0.5 truncate">
                          {job.observacion}
                        </p>
                      ) : null}
                    </div>

                    {/* Detalle derecho: Cantidad y Unidad */}
                    <div className="text-right shrink-0 self-center pl-2">
                      <p className="text-base sm:text-lg font-extrabold text-slate-900 font-mono leading-none">
                        {qtyText}
                      </p>
                      <p className="text-xs font-semibold text-slate-500 mt-1">
                        {unitText}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
