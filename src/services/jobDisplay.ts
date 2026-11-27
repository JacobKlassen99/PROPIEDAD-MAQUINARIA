import { Machine, MachineJobType, MachineryJob } from '../types';
import { getIconDefinition } from './iconCatalog';

export interface ResolvedJobDisplay {
  /** Primary display title: Implement name (priority) -> Machine name. Never generic "Labor de maquinaria". */
  title: string;
  /** Icon ID corresponding to the implement (when present) or machine. */
  icon: string;
  /** Resolved machine name (including inactive machines). */
  machineName: string;
  /** Resolved implement name if the job used an implement (including inactive implements), otherwise null. */
  implementName: string | null;
}

const GENERIC_JOB_LABELS = new Set([
  'labor de maquinaria',
  'machinery job',
  'trabajo de maquinaria',
  'labor',
  'servicio',
  'service',
  'trabajo',
  'job',
]);

function isGenericJobLabel(raw: string | undefined | null): boolean {
  if (!raw) return true;
  const norm = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!norm) return true;
  if (GENERIC_JOB_LABELS.has(norm)) return true;
  if (norm.startsWith('labor con ') || norm.startsWith('job with ')) return true;
  return false;
}

function capitalizeTitle(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Resolves the display title and icon for a MachineryJob across Machinery history,
 * Property lot jobs, and Financial reports.
 *
 * Rules:
 * - Machine only -> Machine name + Machine icon
 * - Implement only -> Implement name + Implement icon
 * - Machine + Implement -> Implement name (prioritized) + Implement icon
 * - Resolves by linked IDs including inactive machines and inactive implements.
 * - Never returns generic "Labor de maquinaria" when machine or implement info exists.
 */
export function resolveJobDisplay(
  job: Partial<MachineryJob> & Record<string, any>,
  machines: Machine[] = [],
  machineJobTypes: MachineJobType[] = [],
  lang: 'es' | 'en' = 'es'
): ResolvedJobDisplay {
  const safeMachines = Array.isArray(machines) ? machines : [];
  const safeJobTypes = Array.isArray(machineJobTypes) ? machineJobTypes : [];

  // 1. Resolve machine (including inactive machines)
  const rawMachineId = String(job.maquinariaId || job.maquinaId || '').trim();
  const rawMachineName = String(job.maquinariaNombre || job.maquina || '').trim();

  const matchedMachine =
    safeMachines.find((m) => rawMachineId && String(m.id) === rawMachineId) ||
    safeMachines.find(
      (m) =>
        rawMachineId &&
        m.nombre &&
        m.nombre.trim().toLowerCase() === rawMachineId.toLowerCase()
    ) ||
    safeMachines.find(
      (m) =>
        rawMachineName &&
        m.nombre &&
        m.nombre.trim().toLowerCase() === rawMachineName.toLowerCase()
    ) ||
    null;

  const machineName = matchedMachine?.nombre || rawMachineName || '';

  // 2. Collect all implements (top-level catalog + nested machine.trabajos, including inactive)
  const allImplements: MachineJobType[] = [...safeJobTypes];
  const seenImpIds = new Set(allImplements.map((jt) => String(jt.id)));
  for (const m of safeMachines) {
    if (Array.isArray(m.trabajos)) {
      for (const jt of m.trabajos) {
        if (jt && !seenImpIds.has(String(jt.id))) {
          seenImpIds.add(String(jt.id));
          allImplements.push(jt);
        }
      }
    }
  }

  const rawImpId = String(
    job.trabajoTipoId || job.implementoId || job.tipoTrabajoId || ''
  ).trim();
  const rawImpNameRaw = String(job.trabajoNombre || job.trabajo || job.labor || '').trim();
  const rawImpName = isGenericJobLabel(rawImpNameRaw) ? '' : rawImpNameRaw;

  let matchedImplement: MachineJobType | null = null;
  if (rawImpId) {
    matchedImplement =
      allImplements.find((jt) => String(jt.id) === rawImpId) || null;
  }
  if (!matchedImplement && rawImpName) {
    const normImp = rawImpName.toLowerCase();
    // Prefer an implement compatible with the job's machine if matched
    matchedImplement =
      (matchedMachine
        ? allImplements.find(
            (jt) =>
              String(jt.maquinaId) === String(matchedMachine.id) &&
              jt.nombre.trim().toLowerCase() === normImp
          )
        : null) ||
      allImplements.find((jt) => jt.nombre.trim().toLowerCase() === normImp) ||
      null;
  }

  // If rawImpName is identical to the machine name and there's no implement ID, treat as machine-only
  const implementNameCandidate = matchedImplement?.nombre || rawImpName || '';
  const isActuallyMachineOnly =
    !matchedImplement &&
    !rawImpId &&
    implementNameCandidate &&
    machineName &&
    implementNameCandidate.toLowerCase() === machineName.toLowerCase();

  const implementName = isActuallyMachineOnly
    ? null
    : implementNameCandidate
    ? capitalizeTitle(implementNameCandidate)
    : null;

  // 3. Title priority: Implement -> Machine -> fallback
  const title =
    implementName ||
    (machineName ? capitalizeTitle(machineName) : '') ||
    (lang === 'en' ? 'Machinery' : 'Maquinaria');

  // 4. Icon priority: Implement icon (if implement used) -> Machine icon -> job.icono -> name hint
  let icon = '';
  if (implementName) {
    icon =
      matchedImplement?.icono ||
      (job.icono && String(job.icono).trim()) ||
      getIconDefinition(implementName, 'implemento').id;
  } else {
    icon =
      matchedMachine?.icono ||
      (job.icono && String(job.icono).trim()) ||
      getIconDefinition(machineName || matchedMachine?.tipo || 'tractor', 'maquinaria').id;
  }

  return {
    title,
    icon: icon || 'tractor',
    machineName: machineName ? capitalizeTitle(machineName) : (lang === 'en' ? 'Machinery' : 'Maquinaria'),
    implementName,
  };
}
