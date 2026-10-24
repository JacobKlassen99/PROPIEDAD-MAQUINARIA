import {
  UserSession,
  Campaign,
  Machine,
  Lot,
  MachineryJob,
  Expense,
  Income,
  ItemConfig,
  Asset,
  ExchangeRateConfig,
  BackendHealthResponse,
  Currency,
} from '../types';

/**
 * Backend Communication Service for MAQUINARIAS Y PROPIEDAD
 * All backend calls are strictly centralized here.
 * Connects directly to Google Apps Script / Google Sheets.
 */

const GAS_DIRECT_URL = 'https://script.google.com/macros/s/AKfycbyKl_Rx_xLs3dzNkNb_Fosf0txpebqEyQtA1QyAXgrKTWZFIV7n3BreSZe8dNWdwgQI2w/exec';
const PROXY_URL = '/api/gas';

// In-flight request deduplication map
const pendingRequests = new Map<string, Promise<any>>();

// Temporary in-memory cache
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const memoryCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

// Session state (Token only, never store passwords or PINs)
let activeSession: UserSession | null = null;

// Try to restore session from sessionStorage (only token and public profile)
try {
  const saved = sessionStorage.getItem('myp_session');
  if (saved) {
    activeSession = JSON.parse(saved);
  }
} catch {
  activeSession = null;
}

export function getActiveSession(): UserSession | null {
  return activeSession;
}

export function checkIsAdmin(session: UserSession | any): boolean {
  if (!session) return false;

  if (session.esAdmin === true || session.isAdmin === true) {
    return true;
  }

  const rawRol = session.rol ?? session.role ?? session.perfil ?? session.nivel ?? '';
  if (rawRol) {
    const normalizedRol = String(rawRol).trim().toLowerCase();
    return (
      normalizedRol === 'admin' ||
      normalizedRol === 'administrador'
    );
  }

  // Fallback if rol attribute is omitted in backend session payload
  const rawUser = String(session.usuario ?? session.username ?? '').trim().toLowerCase();
  return rawUser === 'admin';
}

export function setActiveSession(session: UserSession | null) {
  activeSession = session;
  if (session) {
    sessionStorage.setItem('myp_session', JSON.stringify(session));
  } else {
    sessionStorage.removeItem('myp_session');
    clearMemoryCache();
  }
}

export function clearMemoryCache(pattern?: string) {
  if (!pattern) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.includes(pattern)) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Low-level dispatch to Google Apps Script
 */
async function callGAS<T>(action: string, payload: Record<string, any> = {}, useCache = false): Promise<T> {
  const cacheKey = `${action}:${JSON.stringify(payload)}`;

  if (useCache && memoryCache.has(cacheKey)) {
    const entry = memoryCache.get(cacheKey)!;
    if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
      return entry.data as T;
    }
    memoryCache.delete(cacheKey);
  }

  // Deduplicate inflight requests for identical queries
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)! as Promise<T>;
  }

  const requestPromise = (async () => {
    let body: Record<string, any>;

    if (action === 'auth.login') {
      // EXACT contract for auth.login: never include token, credentials strictly inside data
      body = {
        action: 'auth.login',
        data: {
          usuario: payload.usuario,
          pin: payload.pin,
        },
      };
    } else {
      // Protected or general actions: token at root level, parameters inside data
      body = {
        action,
        ...(activeSession?.token ? { token: activeSession.token } : {}),
        data: payload,
        ...payload,
      };
    }

    let response: Response;
    try {
      // First attempt via full-stack / Netlify proxy
      response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok && response.status === 404) {
        // Fallback to direct Apps Script if proxy route is unavailable
        response = await fetch(GAS_DIRECT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(body),
          redirect: 'follow',
        });
      }
    } catch {
      // Network fallback directly to GAS
      response = await fetch(GAS_DIRECT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        redirect: 'follow',
      });
    }

    const data = await response.json();

    // Safe diagnostic logging (no token/PIN/password logged)
    if (action === 'getMachines' || action === 'getLots' || action === 'getCampaigns') {
      const keysStr = data && typeof data === 'object' ? Object.keys(data).join(', ') : 'none';
      console.log(`[GAS Diagnostic] Action: ${action} | Succeeded: ${data?.ok} | Response keys: [${keysStr}]`);
      if (!data?.ok && data?.error) {
        console.warn(`[GAS Diagnostic Error] Action ${action} message: "${data.error}"`);
      }
    }

    if (!data.ok) {
      // Check for expired or missing session
      if (data.error === 'Se requiere iniciar sesion' || data.error === 'Sesion vencida o revocada') {
        if (action !== 'auth.login' && action !== 'health') {
          setActiveSession(null);
        }
      }
      throw new Error(data.error || `Error en la acción ${action}`);
    }

    const result = data.result !== undefined ? data.result : data;

    if (useCache) {
      memoryCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }

    return result as T;
  })();

  pendingRequests.set(cacheKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    pendingRequests.delete(cacheKey);
  }
}

// -------------------------------------------------------------
// 1. Health & Connection Diagnostics
// -------------------------------------------------------------

export async function checkBackendHealth(): Promise<BackendHealthResponse> {
  return callGAS<BackendHealthResponse>('health', {}, false);
}

// -------------------------------------------------------------
// 2. Authentication (PIN login)
// -------------------------------------------------------------

export async function loginWithPin(usuario: string, pin: string): Promise<UserSession> {
  const result = await callGAS<UserSession>('auth.login', { usuario, pin });
  if (!result || !result.token) {
    throw new Error('La autenticación en Apps Script no retornó un token válido');
  }
  setActiveSession(result);
  return result;
}

export async function logout(): Promise<void> {
  try {
    if (activeSession?.token) {
      await callGAS('auth.logout', {});
    }
  } catch {
    // Ignore network error on logout
  } finally {
    setActiveSession(null);
  }
}

// -------------------------------------------------------------
// 3. Campaigns (Campañas)
// -------------------------------------------------------------

export async function getCampaigns(useCache = true): Promise<Campaign[]> {
  const res = await callGAS<any>('catalog.list', {}, useCache);
  const rawList = extractArrayFromResponse(res, ['campaigns', 'campanas', 'Campanas', 'items']);
  console.log(`[catalog.list Diagnostic - Campanas] Count: ${rawList.length}`);
  return rawList;
}

export async function createCampaign(campaign: Omit<Campaign, 'id'>): Promise<Campaign> {
  const payload = { ...campaign, campaign };
  const res = await callGAS<Campaign>('campaign.create', payload);
  clearMemoryCache();
  return res;
}

export async function setActiveCampaign(campaignId: string): Promise<void> {
  const payload = { campaignId, id: campaignId };
  await callGAS('campaign.activate', payload);
  clearMemoryCache();
}

// -------------------------------------------------------------
// Helper Data Normalizers & Decimal Parsers
// -------------------------------------------------------------

/**
 * Helper to safely extract arrays from various Google Apps Script response formats.
 */
export function extractArrayFromResponse(res: any, possibleKeys: string[] = []): any[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;

  // 1. Direct top-level keys
  for (const key of possibleKeys) {
    if (res[key] && Array.isArray(res[key])) {
      return res[key];
    }
  }

  // 2. Nested containers (res.result, res.data, res.catalog, res.response)
  const containers = [res.result, res.data, res.catalog, res.response];
  for (const container of containers) {
    if (!container) continue;
    if (Array.isArray(container)) return container;
    if (typeof container === 'object') {
      for (const key of possibleKeys) {
        if (container[key] && Array.isArray(container[key])) {
          return container[key];
        }
      }
    }
  }

  return [];
}

export function parseDecimalNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    const cleaned = val.replace(',', '.').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function normalizeItemConfig(raw: any): ItemConfig {
  if (!raw || typeof raw !== 'object') {
    return {
      id: '',
      tipo: 'gasto_propiedad',
      modulo: 'PROPIEDAD',
      clase: 'GASTO',
      nombre: '',
      icono: 'Tag',
      unidad: '',
      precioPredeterminado: 0,
      moneda: 'BOB',
      activo: true,
    };
  }

  const rawModulo = String(raw.modulo || raw.Modulo || '').toUpperCase();
  const rawClase = String(raw.clase || raw.Clase || raw.tipo || '').toUpperCase();
  const moduloVal: 'MAQUINARIAS' | 'PROPIEDAD' = rawModulo.includes('MAQ') ? 'MAQUINARIAS' : 'PROPIEDAD';
  const claseVal: 'INGRESO' | 'GASTO' = rawClase.includes('ING') ? 'INGRESO' : 'GASTO';

  let tipoMapped: 'gasto_maquinaria' | 'gasto_propiedad' | 'ingreso_propiedad' = 'gasto_propiedad';
  if (moduloVal === 'MAQUINARIAS') {
    tipoMapped = 'gasto_maquinaria';
  } else if (claseVal === 'INGRESO') {
    tipoMapped = 'ingreso_propiedad';
  } else {
    tipoMapped = 'gasto_propiedad';
  }

  const rawMoneda = String(raw.moneda || raw.Moneda || 'BOB').toUpperCase();
  const monedaVal: Currency = rawMoneda.includes('USD') ? 'USD' : 'BOB';
  const activoVal = raw.activo !== false && String(raw.activo).toLowerCase() !== 'no';

  return {
    id: String(raw.id || raw.ID || `itm_${Math.random().toString(36).substr(2, 6)}`),
    nombre: String(raw.nombre || raw.Nombre || raw.descripcion || ''),
    tipo: tipoMapped,
    modulo: moduloVal,
    clase: claseVal,
    icono: String(raw.icono || 'Tag'),
    unidad: String(raw.unidad || raw.Unidad || ''),
    precioPredeterminado: parseDecimalNumber(raw.precio ?? raw.precioUnitario ?? raw.precioPredeterminado ?? 0),
    moneda: monedaVal,
    activo: activoVal,
  };
}

export function normalizeLot(raw: any): Lot {
  if (!raw || typeof raw !== 'object') {
    return { id: '', nombre: '', superficieHectareas: 0, superficie: 0 };
  }
  const supVal =
    raw.superficieHectareas ??
    raw.superficie ??
    raw.hectareas ??
    raw.ha ??
    raw.superficie_ha ??
    raw.superficieHa ??
    raw.area ??
    raw.Superficie ??
    raw.Hectareas ??
    0;

  const parsedSup = parseDecimalNumber(supVal);

  return {
    id: String(raw.id || raw.ID || raw.id_lote || ''),
    nombre: String(raw.nombre || raw.Nombre || raw.lote || raw.Lote || ''),
    superficieHectareas: parsedSup,
    superficie: parsedSup,
    cultivoActual: raw.cultivoActual || raw.cultivo || raw.Cultivo || raw.cultivo_actual || '',
    ubicacion: raw.ubicacion || raw.Ubicacion || raw.ubicación || '',
    observaciones: raw.observaciones || raw.observacion || raw.Notas || raw.Observaciones || '',
  };
}

export function normalizeMachine(raw: any): Machine {
  if (!raw || typeof raw !== 'object') {
    return {
      id: '',
      nombre: '',
      identificacion: '',
      tipo: 'Tractor',
      tarifa: 0,
      unidad: 'h',
      unidadCobro: 'h',
      moneda: 'BOB',
      estado: 'operativo',
    };
  }

  const rawUnidad = String(
    raw.unidad || raw.unidadCobro || raw.unidad_cobro || raw.unidadMedida || raw.Unidad || 'h'
  ).toLowerCase();

  const normalizedUnidad: 'h' | 'ha' =
    rawUnidad.includes('ha') || rawUnidad.includes('hect') ? 'ha' : 'h';

  const nameVal =
    raw.nombre ||
    raw.Nombre ||
    raw.modelo ||
    raw.Modelo ||
    raw.maquinaria ||
    raw.Maquinaria ||
    raw.maquinas ||
    raw.Maquinas ||
    raw.descripcion ||
    raw.Descripcion ||
    raw.equipo ||
    raw.Equipo ||
    raw.item ||
    raw.Item ||
    '';

  const idVal =
    raw.id ||
    raw.ID ||
    raw.id_maquinaria ||
    raw.idMaquinaria ||
    raw.id_machine ||
    raw.codigo ||
    raw.Codigo ||
    '';

  const identVal =
    raw.identificacion ||
    raw.Identificacion ||
    raw.identificación ||
    raw.Identificación ||
    raw.codigo ||
    raw.Codigo ||
    raw.identificador ||
    raw.Identificador ||
    raw.TR ||
    '';

  const tarifaVal = parseDecimalNumber(
    raw.tarifa ??
      raw.Tarifa ??
      raw.costo ??
      raw.Costo ??
      raw.precio ??
      raw.Precio ??
      raw.tarifaBase ??
      raw.tarifa_base ??
      0
  );

  const monedaVal = String(raw.moneda || raw.Moneda || 'BOB').toUpperCase();

  const estadoRaw = String(
    raw.estado || raw.Estado || raw.status || raw.Status || 'operativo'
  ).toLowerCase();
  const estadoVal: 'operativo' | 'mantenimiento' | 'inactivo' = estadoRaw.includes('manten')
    ? 'mantenimiento'
    : estadoRaw.includes('inact')
    ? 'inactivo'
    : 'operativo';

  return {
    id: String(idVal || identVal || nameVal || `m_${Math.random().toString(36).substr(2, 6)}`),
    nombre: String(nameVal || identVal || 'Maquinaria Sin Nombre'),
    identificacion: String(identVal || idVal || 'TR-01'),
    tipo: String(raw.tipo || raw.Tipo || 'Tractor'),
    tarifa: tarifaVal,
    unidad: normalizedUnidad,
    unidadCobro: normalizedUnidad,
    moneda: (monedaVal === 'USD' ? 'USD' : 'BOB') as Currency,
    estado: estadoVal,
    observaciones: String(raw.observaciones || raw.Observaciones || raw.observacion || raw.Notas || ''),
  };
}

// -------------------------------------------------------------
// 4. Machines (Maquinarias)
// -------------------------------------------------------------

export async function getMachines(useCache = true): Promise<Machine[]> {
  const res = await callGAS<any>('catalog.list', {}, useCache);

  if (res && typeof res === 'object') {
    const keys = Object.keys(res);
    const resultKeys = res.result && typeof res.result === 'object' ? Object.keys(res.result) : [];
    console.log(`[catalog.list Diagnostic] Top keys: [${keys.join(', ')}] ${resultKeys.length ? `| result keys: [${resultKeys.join(', ')}]` : ''}`);
  }

  const rawList = extractArrayFromResponse(res, [
    'machines',
    'maquinas',
    'Maquinas',
    'maquinarias',
    'Maquinarias',
    'flota',
    'items',
  ]);

  const normalized = rawList.map(normalizeMachine);
  console.log(`[catalog.list Diagnostic - Maquinas] Raw items: ${rawList.length} | Normalized: ${normalized.length}`);
  return normalized;
}

export async function createMachine(machine: Omit<Machine, 'id'>): Promise<Machine> {
  const codeUnidad: 'h' | 'ha' =
    machine.unidad === 'ha' || machine.unidad === 'hectarea' || machine.unidad === 'Hectárea'
      ? 'ha'
      : 'h';
  const tarifaNum = parseDecimalNumber(machine.tarifa);

  const machineData = {
    ...machine,
    unidad: codeUnidad,
    unidadCobro: codeUnidad,
    unidad_cobro: codeUnidad,
    unidadMedida: codeUnidad,
    tarifa: tarifaNum,
    costo: tarifaNum,
    precio: tarifaNum,
  };

  const payload = {
    ...machineData,
    machine: machineData,
    maquinaria: machineData,
  };

  const res = await callGAS<any>('machine.save', payload);
  clearMemoryCache();
  return normalizeMachine(res);
}

export async function updateMachine(id: string, machine: Partial<Machine>): Promise<Machine> {
  const rawU = String(machine.unidad || '').toLowerCase();
  const codeUnidad: 'h' | 'ha' = (rawU.includes('ha') || rawU.includes('hect')) ? 'ha' : 'h';
  const tarifaNum = parseDecimalNumber(machine.tarifa);

  const { id: _, ...restMachine } = machine as any;
  const machineData = {
    id,
    ...restMachine,
    unidad: codeUnidad,
    unidadCobro: codeUnidad,
    unidad_cobro: codeUnidad,
    unidadMedida: codeUnidad,
    tarifa: tarifaNum,
    costo: tarifaNum,
    precio: tarifaNum,
  };

  const payload = {
    id,
    ...machineData,
    machine: machineData,
    maquinaria: machineData,
  };

  const res = await callGAS<any>('machine.save', payload);
  clearMemoryCache();
  return normalizeMachine(res);
}

export async function deleteMachine(id: string): Promise<void> {
  const payload = { id, deleted: true, action: 'delete' };
  await callGAS('machine.save', payload);
  clearMemoryCache();
}

// -------------------------------------------------------------
// 5. Lots (Lotes)
// -------------------------------------------------------------

export async function getLots(useCache = true): Promise<Lot[]> {
  const res = await callGAS<any>('catalog.list', {}, useCache);

  const rawList = extractArrayFromResponse(res, [
    'lots',
    'lotes',
    'Lotes',
    'items',
  ]);

  const normalized = rawList.map(normalizeLot);
  console.log(`[catalog.list Diagnostic - Lotes] Raw items: ${rawList.length} | Normalized: ${normalized.length}`);
  return normalized;
}

export async function createLot(lot: Omit<Lot, 'id'>): Promise<Lot> {
  const supNum = parseDecimalNumber(lot.superficieHectareas);
  const lotData = {
    ...lot,
    nombre: lot.nombre,
    superficie: supNum,
    superficieHectareas: supNum,
    hectareas: supNum,
    ha: supNum,
    cantidad: supNum,
    area: supNum,
    cultivoActual: lot.cultivoActual || '',
    cultivo: lot.cultivoActual || '',
    ubicacion: lot.ubicacion || '',
    observaciones: lot.observaciones || '',
  };

  const payload = {
    ...lotData,
    lot: lotData,
    lote: lotData,
  };

  const res = await callGAS<any>('lot.save', payload);
  clearMemoryCache();
  return normalizeLot(res);
}

export async function updateLot(id: string, lot: Partial<Lot>): Promise<Lot> {
  const supNum = parseDecimalNumber(lot.superficieHectareas);
  const { id: _, ...restLot } = lot as any;
  const lotData = {
    id,
    ...restLot,
    superficie: supNum,
    superficieHectareas: supNum,
    hectareas: supNum,
    ha: supNum,
    cantidad: supNum,
    area: supNum,
    cultivoActual: lot.cultivoActual || '',
    ubicacion: lot.ubicacion || '',
    observaciones: lot.observaciones || '',
  };

  const payload = {
    id,
    ...lotData,
    lot: lotData,
    lote: lotData,
  };

  const res = await callGAS<any>('lot.save', payload);
  clearMemoryCache();
  return normalizeLot(res);
}

export async function deleteLot(id: string): Promise<void> {
  const payload = { id, deleted: true, action: 'delete' };
  await callGAS('lot.save', payload);
  clearMemoryCache();
}

// -------------------------------------------------------------
// 6. Machinery Jobs (Servicios a terceros y Trabajos en propiedad)
// -------------------------------------------------------------

export async function getMachineryJobs(campanaId?: string, useCache = true): Promise<MachineryJob[]> {
  let res: any;
  try {
    res = await callGAS<any>('work.list', { campanaId }, useCache);
  } catch {
    res = await callGAS<any>('catalog.list', { campanaId }, useCache);
  }

  let list = extractArrayFromResponse(res, ['jobs', 'trabajos', 'servicios', 'items', 'Trabajos']);
  if (campanaId) {
    list = list.filter((j) => !j.campanaId || j.campanaId === campanaId);
  }
  return list;
}

export async function createMachineryJob(job: Omit<MachineryJob, 'id'>): Promise<MachineryJob> {
  const rawU = String(job.unidad || '').toLowerCase();
  const codeUnidad: 'h' | 'ha' = (rawU.includes('ha') || rawU.includes('hect')) ? 'ha' : 'h';
  const cantNum = parseDecimalNumber(job.cantidad);
  const tarifaNum = parseDecimalNumber(job.tarifa);
  const totalNum = parseDecimalNumber(job.total) || cantNum * tarifaNum;
  const gasMoneda = (job.moneda === 'USD' ? 'USD' : 'BS');
  const tcNum = parseDecimalNumber(job.tipoCambio) || 6.96;
  const gasDestino = job.tipoTrabajo === 'propiedad' ? 'PROPIEDAD' : 'TERCERO';

  const jobData = {
    ...job,
    maquinaId: job.maquinariaId,
    maquinariaId: job.maquinariaId,
    destino: gasDestino,
    tipoTrabajo: job.tipoTrabajo,
    fecha: job.fecha,
    campanaId: job.campanaId,
    campanaNombre: job.campanaNombre || '',
    ...(job.loteId ? { loteId: job.loteId, loteNombre: job.loteNombre || '' } : {}),
    ...(job.cliente ? { cliente: job.cliente } : {}),
    cantidad: cantNum,
    tarifa: tarifaNum,
    precio: tarifaNum,
    precioUnitario: tarifaNum,
    importe: totalNum,
    total: totalNum,
    moneda: gasMoneda,
    unidad: codeUnidad,
    unidadCobro: codeUnidad,
    tc: tcNum,
    tipoCambio: tcNum,
    observacion: job.observacion || '',
    observaciones: job.observacion || '',
  };

  const payload = {
    ...jobData,
    job: jobData,
    trabajo: jobData,
  };

  const res = await callGAS<any>('work.save', payload);
  clearMemoryCache();
  return {
    ...job,
    id: res?.id || res?.result?.id || `job_${Date.now()}`,
    total: totalNum,
  };
}

export async function updateMachineryJob(id: string, job: Partial<MachineryJob>): Promise<MachineryJob> {
  const rawU = String(job.unidad || '').toLowerCase();
  const codeUnidad: 'h' | 'ha' = (rawU.includes('ha') || rawU.includes('hect')) ? 'ha' : 'h';
  const cantNum = parseDecimalNumber(job.cantidad);
  const tarifaNum = parseDecimalNumber(job.tarifa);
  const gasMoneda = job.moneda ? (job.moneda === 'USD' ? 'USD' : 'BS') : undefined;
  const tcNum = job.tipoCambio ? (parseDecimalNumber(job.tipoCambio) || 6.96) : 6.96;
  const { id: _, ...restJob } = job as any;

  const jobData = {
    id,
    ...restJob,
    ...(job.maquinariaId ? { maquinaId: job.maquinariaId, maquinariaId: job.maquinariaId } : {}),
    ...(job.tipoTrabajo ? { destino: job.tipoTrabajo === 'propiedad' ? 'PROPIEDAD' : 'TERCERO', tipoTrabajo: job.tipoTrabajo } : {}),
    unidad: codeUnidad,
    unidadCobro: codeUnidad,
    ...(cantNum ? { cantidad: cantNum } : {}),
    ...(tarifaNum ? { tarifa: tarifaNum, precio: tarifaNum, precioUnitario: tarifaNum } : {}),
    ...(gasMoneda ? { moneda: gasMoneda } : {}),
    tc: tcNum,
    tipoCambio: tcNum,
  };

  const payload = {
    id,
    ...jobData,
    job: jobData,
    trabajo: jobData,
  };

  const res = await callGAS<any>('work.save', payload);
  clearMemoryCache();
  return {
    ...(job as any),
    id: res?.id || res?.result?.id || id,
  };
}

export async function deleteMachineryJob(id: string): Promise<void> {
  const payload = { id, deleted: true, action: 'delete' };
  await callGAS('work.save', payload);
  clearMemoryCache();
}

// -------------------------------------------------------------
// 7. Expenses (Gastos de maquinaria y agrícolas)
// -------------------------------------------------------------

export async function getExpenses(campanaId?: string, modulo?: 'maquinarias' | 'propiedad', useCache = true): Promise<Expense[]> {
  let res: any;
  try {
    res = await callGAS<any>('movement.list', { campanaId, modulo: modulo ? (modulo === 'propiedad' ? 'PROPIEDAD' : 'MAQUINARIAS') : undefined }, useCache);
  } catch {
    res = await callGAS<any>('catalog.list', { campanaId, modulo }, useCache);
  }

  let list = extractArrayFromResponse(res, ['expenses', 'gastos', 'movimientos', 'items', 'Gastos']);
  
  // Filter and map movements to Expense format
  const mappedList: Expense[] = list
    .filter((e: any) => {
      const c = String(e.clase || e.tipo || '').toUpperCase();
      return c === 'GASTO' || c === '' || e.itemGasto !== undefined;
    })
    .map((e: any) => {
      const rawMod = String(e.modulo || '').toLowerCase();
      const modNorm: 'maquinarias' | 'propiedad' = rawMod.includes('prop') ? 'propiedad' : 'maquinarias';
      const cant = parseDecimalNumber(e.cantidad) || 1;
      const prec = parseDecimalNumber(e.precioUnitario ?? e.precio ?? 0);
      const tot = parseDecimalNumber(e.importe ?? e.total ?? cant * prec);
      const rawMon = String(e.moneda || 'BOB').toUpperCase();
      const mon: Currency = rawMon.includes('USD') ? 'USD' : 'BOB';

      return {
        id: String(e.id || `exp_${Math.random().toString(36).substr(2, 6)}`),
        fecha: String(e.fecha || '').slice(0, 10),
        campanaId: String(e.campanaId || ''),
        modulo: modNorm,
        maquinariaId: e.maquinaId || e.maquinariaId || undefined,
        maquinariaNombre: e.maquinariaNombre || undefined,
        loteId: e.loteId || undefined,
        loteNombre: e.loteNombre || undefined,
        itemGasto: String(e.descripcion || e.itemGasto || e.item || 'Gasto'),
        cantidad: cant,
        unidad: String(e.unidad || ''),
        precio: prec,
        moneda: mon,
        tipoCambio: parseDecimalNumber(e.tc ?? e.tipoCambio ?? 6.96),
        total: tot,
        observacion: String(e.observaciones || e.observacion || ''),
        esTrabajoPropio: Boolean(e.esTrabajoPropio || e.trabajoId),
        trabajoId: e.trabajoId || undefined,
      };
    });

  let filtered = mappedList;
  if (campanaId) {
    filtered = filtered.filter((e) => !e.campanaId || e.campanaId === campanaId);
  }
  if (modulo) {
    filtered = filtered.filter((e) => !e.modulo || e.modulo === modulo);
  }
  return filtered;
}

export async function createExpense(expense: Omit<Expense, 'id'>): Promise<Expense> {
  const cantNum = parseDecimalNumber(expense.cantidad) || 1;
  const precioNum = parseDecimalNumber(expense.precio);
  const totalNum = parseDecimalNumber(expense.total) || cantNum * precioNum;
  const gasModulo: 'MAQUINARIAS' | 'PROPIEDAD' = expense.modulo === 'propiedad' ? 'PROPIEDAD' : 'MAQUINARIAS';
  const gasMoneda = (expense.moneda === 'USD' ? 'USD' : 'BS');
  const tcNum = parseDecimalNumber(expense.tipoCambio) || 6.96;

  const payload: Record<string, any> = {
    modulo: gasModulo,
    clase: 'GASTO',
    tipo: 'gasto',
    fecha: expense.fecha,
    campanaId: expense.campanaId,
    descripcion: expense.itemGasto,
    item: expense.itemGasto,
    itemGasto: expense.itemGasto,
    cantidad: cantNum,
    unidad: expense.unidad || '',
    precioUnitario: precioNum,
    precio: precioNum,
    importe: totalNum,
    total: totalNum,
    moneda: gasMoneda,
    tc: tcNum,
    tipoCambio: tcNum,
    observaciones: expense.observacion || '',
    observacion: expense.observacion || '',
    ...(expense.maquinariaId ? { maquinaId: expense.maquinariaId, maquinariaId: expense.maquinariaId } : {}),
    ...(expense.loteId ? { loteId: expense.loteId } : {}),
  };

  const res = await callGAS<any>('movement.save', payload);
  clearMemoryCache();
  return {
    ...expense,
    id: res?.id || res?.result?.id || `exp_${Date.now()}`,
    total: totalNum,
  };
}

export async function deleteExpense(id: string): Promise<void> {
  const payload = { id, tipo: 'gasto', clase: 'GASTO', deleted: true, action: 'delete' };
  await callGAS('movement.save', payload);
  clearMemoryCache();
}

// -------------------------------------------------------------
// 8. Incomes (Ingresos agrícolas y de servicios)
// -------------------------------------------------------------

export async function getIncomes(campanaId?: string, modulo?: 'maquinarias' | 'propiedad', useCache = true): Promise<Income[]> {
  let res: any;
  try {
    res = await callGAS<any>('movement.list', { campanaId, modulo: modulo ? (modulo === 'maquinarias' ? 'MAQUINARIAS' : 'PROPIEDAD') : undefined }, useCache);
  } catch {
    res = await callGAS<any>('catalog.list', { campanaId, modulo }, useCache);
  }

  let list = extractArrayFromResponse(res, ['incomes', 'ingresos', 'movimientos', 'items', 'Ingresos']);

  const mappedList: Income[] = list
    .filter((i: any) => {
      const c = String(i.clase || i.tipo || '').toUpperCase();
      return c === 'INGRESO' || i.concepto !== undefined;
    })
    .map((i: any) => {
      const rawMod = String(i.modulo || '').toLowerCase();
      const modNorm: 'maquinarias' | 'propiedad' = rawMod.includes('maq') ? 'maquinarias' : 'propiedad';
      const cant = parseDecimalNumber(i.cantidad) || 0;
      const prec = parseDecimalNumber(i.precioUnitario ?? i.precio ?? 0);
      const tot = parseDecimalNumber(i.importe ?? i.total ?? cant * prec);
      const rawMon = String(i.moneda || 'BOB').toUpperCase();
      const mon: Currency = rawMon.includes('USD') ? 'USD' : 'BOB';

      return {
        id: String(i.id || `inc_${Math.random().toString(36).substr(2, 6)}`),
        fecha: String(i.fecha || '').slice(0, 10),
        campanaId: String(i.campanaId || ''),
        modulo: modNorm,
        maquinariaId: i.maquinaId || i.maquinariaId || undefined,
        maquinariaNombre: i.maquinariaNombre || undefined,
        loteId: i.loteId || undefined,
        loteNombre: i.loteNombre || undefined,
        concepto: String(i.descripcion || i.concepto || i.item || 'Ingreso Cosecha'),
        cantidad: cant,
        unidad: String(i.unidad || ''),
        precio: prec,
        moneda: mon,
        tipoCambio: parseDecimalNumber(i.tc ?? i.tipoCambio ?? 6.96),
        total: tot,
        observacion: String(i.observaciones || i.observacion || ''),
        esTrabajoPropio: Boolean(i.esTrabajoPropio || i.trabajoId),
        trabajoId: i.trabajoId || undefined,
      };
    });

  let filtered = mappedList;
  if (campanaId) {
    filtered = filtered.filter((i) => !i.campanaId || i.campanaId === campanaId);
  }
  if (modulo) {
    filtered = filtered.filter((i) => !i.modulo || i.modulo === modulo);
  }
  return filtered;
}

export async function createIncome(income: Omit<Income, 'id'>): Promise<Income> {
  const cantNum = parseDecimalNumber(income.cantidad) || 0;
  const precioNum = parseDecimalNumber(income.precio);
  const totalNum = parseDecimalNumber(income.total) || cantNum * precioNum;
  const gasModulo: 'MAQUINARIAS' | 'PROPIEDAD' = income.modulo === 'maquinarias' ? 'MAQUINARIAS' : 'PROPIEDAD';
  const gasMoneda = (income.moneda === 'USD' ? 'USD' : 'BS');
  const tcNum = parseDecimalNumber(income.tipoCambio) || 6.96;

  const payload: Record<string, any> = {
    modulo: gasModulo,
    clase: 'INGRESO',
    tipo: 'ingreso',
    fecha: income.fecha,
    campanaId: income.campanaId,
    descripcion: income.concepto,
    concepto: income.concepto,
    item: income.concepto,
    cantidad: cantNum,
    unidad: income.unidad || '',
    precioUnitario: precioNum,
    precio: precioNum,
    importe: totalNum,
    total: totalNum,
    moneda: gasMoneda,
    tc: tcNum,
    tipoCambio: tcNum,
    observaciones: income.observacion || '',
    observacion: income.observacion || '',
    ...(income.loteId ? { loteId: income.loteId } : {}),
    ...(income.maquinariaId ? { maquinaId: income.maquinariaId, maquinariaId: income.maquinariaId } : {}),
  };

  const res = await callGAS<any>('movement.save', payload);
  clearMemoryCache();
  return {
    ...income,
    id: res?.id || res?.result?.id || `inc_${Date.now()}`,
    total: totalNum,
  };
}

export async function deleteIncome(id: string): Promise<void> {
  const payload = { id, tipo: 'ingreso', clase: 'INGRESO', deleted: true, action: 'delete' };
  await callGAS('movement.save', payload);
  clearMemoryCache();
}

// -------------------------------------------------------------
// 9. Configurable Items (Ítems de gasto / ingreso)
// -------------------------------------------------------------

export async function getItemsConfig(useCache = true): Promise<ItemConfig[]> {
  try {
    const res = await callGAS<any>('catalog.list', {}, useCache);
    const rawItems = extractArrayFromResponse(res, ['items', 'itemsConfig', 'conceptos']);
    if (rawItems.length > 0) {
      return rawItems.map(normalizeItemConfig);
    }
  } catch {
    // fallback
  }

  try {
    const res = await callGAS<any>('getItemsConfig', {}, useCache);
    const rawItems = extractArrayFromResponse(res, ['items', 'itemsConfig', 'result']);
    return rawItems.map(normalizeItemConfig);
  } catch {
    return [];
  }
}

export async function saveItemConfig(item: Partial<ItemConfig> & { nombre: string; modulo?: string; clase?: string }): Promise<ItemConfig> {
  const gasModulo = (item.modulo || (item.tipo === 'gasto_maquinaria' ? 'MAQUINARIAS' : 'PROPIEDAD')).toUpperCase();
  const gasClase = (item.clase || (item.tipo === 'ingreso_propiedad' ? 'INGRESO' : 'GASTO')).toUpperCase();
  const gasMoneda = (item.moneda === 'USD' ? 'USD' : 'BS');
  const precioNum = parseDecimalNumber(item.precioPredeterminado);

  const payload: Record<string, any> = {
    modulo: gasModulo,
    clase: gasClase,
    nombre: item.nombre.trim(),
    moneda: gasMoneda,
    unidad: item.unidad || '',
    precio: precioNum,
    precioUnitario: precioNum,
    icono: item.icono || 'Tag',
    activo: item.activo !== false,
  };
  if (item.id) {
    payload.id = item.id;
  }

  const res = await callGAS<any>('item.save', payload);
  clearMemoryCache();
  return {
    id: res?.id || res?.result?.id || item.id || `itm_${Date.now()}`,
    nombre: item.nombre,
    modulo: gasModulo as any,
    clase: gasClase as any,
    tipo: (gasModulo === 'MAQUINARIAS' ? 'gasto_maquinaria' : (gasClase === 'INGRESO' ? 'ingreso_propiedad' : 'gasto_propiedad')),
    icono: item.icono || 'Tag',
    unidad: item.unidad || '',
    precioPredeterminado: precioNum,
    moneda: (gasMoneda === 'USD' ? 'USD' : 'BOB'),
    activo: item.activo !== false,
  };
}

// -------------------------------------------------------------
// 10. Assets & Patrimonial Improvements (Activos y Mejoras)
// -------------------------------------------------------------

export async function getAssets(useCache = true): Promise<Asset[]> {
  let list: any[] = [];
  try {
    const res = await callGAS<any>('asset.list', {}, useCache);
    list = extractArrayFromResponse(res, ['assets', 'activos', 'result', 'items']);
  } catch {
    try {
      const res = await callGAS<any>('catalog.list', {}, useCache);
      list = extractArrayFromResponse(res, ['assets', 'activos', 'result', 'items']);
    } catch {
      list = [];
    }
  }

  return list.map((a: any) => {
    const valIni = parseDecimalNumber(a.valorInicial ?? a.importe ?? a.costo ?? 0);
    const rawMon = String(a.moneda || 'USD').toUpperCase();
    const mon: Currency = rawMon.includes('BOB') || rawMon === 'BS' ? 'BOB' : 'USD';
    const mejorasList = Array.isArray(a.mejoras) ? a.mejoras : [];
    const sumMejoras = mejorasList.reduce((acc: number, m: any) => acc + (parseDecimalNumber(m.costo) || 0), 0);

    let rawTipo = String(a.tipo || '').toUpperCase();
    let normTipo: 'MAQUINARIA' | 'LOTE' | 'OTRO' = 'MAQUINARIA';
    if (rawTipo.includes('LOT') || rawTipo.includes('TERREN') || rawTipo.includes('CAMP')) {
      normTipo = 'LOTE';
    } else if (rawTipo.includes('OTR') || rawTipo.includes('INFRA') || rawTipo.includes('SILO')) {
      normTipo = 'OTRO';
    }

    return {
      id: String(a.id || `ast_${Math.random().toString(36).substr(2, 6)}`),
      tipo: normTipo,
      nombre: String(a.nombre || 'Activo'),
      identificador: a.identificador || '',
      valorInicial: valIni,
      moneda: mon,
      fechaAdquisicion: String(a.fecha || a.fechaAdquisicion || '').slice(0, 10),
      valorAcumulado: valIni + sumMejoras,
      mejoras: mejorasList,
      activo: a.activo !== false,
    };
  });
}

export async function createAsset(asset: Omit<Asset, 'id' | 'valorAcumulado' | 'mejoras'>): Promise<Asset> {
  let gasTipo: 'MAQUINARIA' | 'LOTE' | 'OTRO' = 'MAQUINARIA';
  const rawTipo = String(asset.tipo || '').toUpperCase();
  if (rawTipo.includes('LOT') || rawTipo.includes('TERREN') || rawTipo.includes('CAMP')) {
    gasTipo = 'LOTE';
  } else if (rawTipo.includes('OTR') || rawTipo.includes('INFRA') || rawTipo.includes('SILO')) {
    gasTipo = 'OTRO';
  } else {
    gasTipo = 'MAQUINARIA';
  }

  const valNum = parseDecimalNumber(asset.valorInicial);
  const gasMoneda = (asset.moneda === 'USD' ? 'USD' : 'BS');
  const tcNum = 6.96;

  const payload = {
    tipo: gasTipo,
    nombre: asset.nombre.trim(),
    identificador: asset.identificador ? asset.identificador.trim() : '',
    valorInicial: valNum,
    importe: valNum,
    total: valNum,
    moneda: gasMoneda,
    tc: tcNum,
    tipoCambio: tcNum,
    fecha: asset.fechaAdquisicion || new Date().toISOString().slice(0, 10),
    fechaAdquisicion: asset.fechaAdquisicion || new Date().toISOString().slice(0, 10),
  };

  const res = await callGAS<any>('asset.save', payload);
  clearMemoryCache();
  return {
    ...asset,
    id: res?.id || res?.result?.id || `ast_${Date.now()}`,
    valorAcumulado: valNum,
    mejoras: [],
  };
}

export async function addAssetImprovement(
  assetId: string,
  improvement: { fecha: string; descripcion: string; costo: number; moneda: 'BOB' | 'USD' }
): Promise<Asset> {
  const payload = { assetId, id: assetId, improvement };
  const res = await callGAS<Asset>('asset.save', payload);
  clearMemoryCache();
  return res;
}

// -------------------------------------------------------------
// 11. Exchange Rate (Tipo de Cambio BOB/USD)
// -------------------------------------------------------------

export async function getExchangeRateConfig(useCache = true): Promise<ExchangeRateConfig> {
  try {
    const res = await callGAS<any>('catalog.list', {}, useCache);
    if (res && res.exchangeRate) return res.exchangeRate;
    if (res && typeof res.tasaBobPerUsd === 'number') {
      return {
        tasaBobPerUsd: res.tasaBobPerUsd,
        fuente: res.fuente || 'manual',
        fechaActualizacion: res.fechaActualizacion || new Date().toISOString().slice(0, 10),
        nota: res.nota,
      };
    }
  } catch {
    // fallback for read-only
  }
  return callGAS<ExchangeRateConfig>('getExchangeRateConfig', {}, useCache).catch(() => ({
    tasaBobPerUsd: 6.96,
    fuente: 'manual' as const,
    fechaActualizacion: new Date().toISOString().slice(0, 10),
  }));
}

export async function saveExchangeRateConfig(config: { tasaBobPerUsd: number; nota?: string }): Promise<ExchangeRateConfig> {
  const payload = { key: 'exchangeRate', ...config, config };
  const res = await callGAS<ExchangeRateConfig>('config.set', payload);
  clearMemoryCache();
  return res;
}
