import {
  UserSession,
  Campaign,
  Machine,
  MachineJobType,
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

const GAS_DIRECT_URL = 'https://script.google.com/macros/s/AKfycbwiFRh5R1k5ZxxFD67Fl0xcmIA1NVbx9XOg2gtjbvyYgAFoprbVB8foMTnUpPvMY0tf/exec';
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

// Restore session from localStorage (with fallback to sessionStorage for backwards compatibility)
try {
  const saved = localStorage.getItem('myp_session') || sessionStorage.getItem('myp_session');
  if (saved) {
    activeSession = JSON.parse(saved);
  }
} catch {
  activeSession = null;
}

export function getActiveSession(): UserSession | null {
  return activeSession;
}

const ADMIN_TOKEN_KEY = 'myp_admin_token';
let inMemoryAdminToken: string | null = null;
try {
  inMemoryAdminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
} catch {
  inMemoryAdminToken = null;
}

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || inMemoryAdminToken;
  } catch {
    return inMemoryAdminToken;
  }
}

export function isAdminAuthorizationVerifiedInSession(): boolean {
  // Dispositivo previamente autorizado como Administrador
  return !!getAdminToken();
}

export function setAdminToken(token: string | null): void {
  inMemoryAdminToken = token;
  try {
    if (token) {
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  } catch {
    // Ignore storage quota or access errors
  }
}

export function hasAdminAuthorization(): boolean {
  return !!getAdminToken();
}

let inMemoryExchangeRate: number = 0;

export function setConfiguredExchangeRate(rate: number): void {
  if (typeof rate === 'number' && rate > 0) {
    inMemoryExchangeRate = rate;
  }
}

export function getConfiguredExchangeRate(): number {
  return inMemoryExchangeRate;
}

export function resolveEffectiveExchangeRate(candidateRate?: any): number {
  const parsed = parseDecimalNumber(candidateRate);
  if (parsed > 0) return parsed;
  const inMem = getConfiguredExchangeRate();
  if (inMem > 0) return inMem;
  throw new Error(
    'Tipo de cambio no configurado en Google Sheets. Por favor configure el tipo de cambio en Administración -> Configuración -> Tipo de cambio antes de registrar operaciones.'
  );
}

export function checkIsAdmin(_session?: UserSession | any): boolean {
  // Seguridad administrativa estricta: nunca conceder acceso por texto, rol local o username
  return hasAdminAuthorization();
}

export function getLocalDateString(dateInput: Date | string = new Date()): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format any date string (ISO, YYYY-MM-DD, etc.) into DD/MM/AAAA cleanly
 * without timezone offset shifts.
 */
export function formatDateDDMMAAAA(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return '';
    const day = String(dateInput.getDate()).padStart(2, '0');
    const month = String(dateInput.getMonth() + 1).padStart(2, '0');
    const year = dateInput.getFullYear();
    return `${day}/${month}/${year}`;
  }
  const str = String(dateInput).trim();
  // Match YYYY-MM-DD anywhere in the string (including ISO 2026-10-23T...)
  const matchYMD = str.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (matchYMD) {
    const [, year, month, day] = matchYMD;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  // Match DD/MM/YYYY
  const matchDMY = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (matchDMY) {
    const [, day, month, year] = matchDMY;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  return str;
}

/**
 * Identify internal technical machine/entity codes like MAQ-48BCF9E8FA9149 or UUIDs
 * so they can be hidden from seniors and regular users in favor of friendly names and types.
 */
export function isTechnicalId(str?: string | null): boolean {
  if (!str) return false;
  const trimmed = String(str).trim();
  if (/^MAQ[-_]?[A-Z0-9]{6,}/i.test(trimmed)) return true;
  if (/^[a-f0-9]{8}-[a-f0-9]{4}/i.test(trimmed)) return true;
  if (/^(m_|maq_|job_|exp_|inc_|lot_)[a-z0-9]+/i.test(trimmed)) return true;
  if (/^[A-Z0-9]{12,}$/.test(trimmed)) return true;
  return false;
}

type SessionChangeListener = (session: UserSession | null) => void;
const sessionListeners = new Set<SessionChangeListener>();

export function onSessionChange(listener: SessionChangeListener): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

export function setActiveSession(session: UserSession | null) {
  activeSession = session;
  if (session) {
    try {
      localStorage.setItem('myp_session', JSON.stringify(session));
      sessionStorage.setItem('myp_session', JSON.stringify(session));
    } catch {
      // Ignore storage quota or security policy error
    }
  } else {
    try {
      localStorage.removeItem('myp_session');
      sessionStorage.removeItem('myp_session');
    } catch {
      // Ignore error
    }
    clearMemoryCache();
  }
  sessionListeners.forEach((listener) => {
    try {
      listener(session);
    } catch {
      // Ignore listener error
    }
  });
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
    const currentAdminToken = getAdminToken();

    if (action === 'auth.login') {
      // Contract for auth.login: never include tokens, credentials inside data
      body = {
        action: 'auth.login',
        data: {
          usuario: payload.usuario || 'usuario',
          pin: payload.pin || payload.password || payload.contrasena,
          password: payload.password || payload.contrasena || payload.pin,
          contrasena: payload.contrasena || payload.password || payload.pin,
        },
      };
    } else if (action === 'auth.admin.authorize') {
      // Contract for auth.admin.authorize: validates CONTRASENA_ADMIN
      body = {
        action: 'auth.admin.authorize',
        ...(activeSession?.token ? { token: activeSession.token } : {}),
        data: {
          password: payload.password || payload.contrasena || payload.contrasenaAdmin,
          contrasena: payload.contrasena || payload.password || payload.contrasenaAdmin,
          contrasenaAdmin: payload.contrasenaAdmin || payload.password || payload.contrasena,
        },
      };
    } else {
      // General or administrative actions: attach user token & admin token
      body = {
        ...(activeSession?.token ? { token: activeSession.token } : {}),
        ...(currentAdminToken ? { tokenAdmin: currentAdminToken, adminToken: currentAdminToken } : {}),
        data: {
          ...payload,
          ...(currentAdminToken ? { tokenAdmin: currentAdminToken, adminToken: currentAdminToken } : {}),
        },
        ...payload,
        action,
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
      const errStr = String(data.error || '').toLowerCase();
      const code = String(data.code || '');

      // Check for expired or missing user session, revoked token, or password update
      if (
        code === 'SESSION_EXPIRED' ||
        errStr.includes('sesión vencida') ||
        errStr.includes('sesion vencida') ||
        errStr.includes('se requiere iniciar sesion') ||
        errStr.includes('revocada')
      ) {
        if (action !== 'auth.login' && action !== 'health') {
          setActiveSession(null);
          setAdminToken(null);
        }
      }

      // Check for expired or revoked administrative token or changed CONTRASENA_ADMIN
      if (
        errStr.includes('autorización de administrador') ||
        errStr.includes('autorizacion de administrador') ||
        errStr.includes('token administrativo') ||
        errStr.includes('credencial administrativa')
      ) {
        setAdminToken(null);
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
// 2. Authentication: Doble Contraseña (Usuario y Administrador)
// -------------------------------------------------------------

/**
 * Iniciar sesión con CONTRASENA_USUARIO
 * Da acceso a los módulos operativos MAQUINARIAS y PROPIEDAD.
 */
export async function loginWithUserPassword(password: string): Promise<UserSession> {
  if (!password || !password.trim()) {
    throw new Error('Ingrese la contraseña.');
  }

  const result = await callGAS<UserSession & { tokenAdmin?: string }>('auth.login', {
    usuario: 'usuario',
    pin: password.trim(),
    password: password.trim(),
    contrasena: password.trim(),
  });

  if (!result || !result.token) {
    throw new Error('La autenticación en Apps Script no retornó un token válido');
  }

  if (result.tokenAdmin) {
    setAdminToken(result.tokenAdmin);
  }

  setActiveSession(result);
  return result;
}

/**
 * Compatible con la llamada anterior de loginWithPin
 */
export async function loginWithPin(usuario: string, pin: string): Promise<UserSession> {
  return loginWithUserPassword(pin || usuario);
}

/**
 * Autorizar este dispositivo como Administrador mediante CONTRASENA_ADMIN
 * Emite un tokenAdmin que se guarda en localStorage de este equipo.
 */
export async function authorizeAdminDevice(password: string): Promise<{ tokenAdmin: string }> {
  if (!password || !password.trim()) {
    throw new Error('Ingrese la contraseña de administrador.');
  }

  const result = await callGAS<{ tokenAdmin?: string; token?: string; expira?: string }>(
    'auth.admin.authorize',
    {
      password: password.trim(),
      contrasena: password.trim(),
      contrasenaAdmin: password.trim(),
    }
  );

  const tokenAdmin = result?.tokenAdmin || result?.token;
  if (!tokenAdmin) {
    throw new Error('No se recibió la credencial administrativa del backend');
  }

  setAdminToken(tokenAdmin);
  return { tokenAdmin };
}

export async function verifyAdminAuthorization(): Promise<boolean> {
  const currentToken = getAdminToken();
  if (!currentToken) {
    return false;
  }
  try {
    const res = await callGAS<{ valid?: boolean; ok?: boolean }>('auth.admin.verify', {
      tokenAdmin: currentToken,
      token: currentToken,
    });
    if (res && (res.valid === true || res.ok === true)) {
      return true;
    }
    setAdminToken(null);
    return false;
  } catch (err: unknown) {
    const msg = String(err instanceof Error ? err.message : '').toLowerCase();
    if (
      msg.includes('credencial') ||
      msg.includes('autorización') ||
      msg.includes('autorizacion') ||
      msg.includes('token') ||
      msg.includes('revocad') ||
      msg.includes('vencid') ||
      msg.includes('no válida') ||
      msg.includes('no valida')
    ) {
      setAdminToken(null);
      return false;
    }
    return false;
  }
}

/**
 * Revocar la autorización administrativa de este dispositivo en Apps Script y eliminarla de localStorage
 */
export async function revokeAdminAuthorization(): Promise<void> {
  const currentToken = getAdminToken();
  try {
    if (currentToken) {
      await callGAS('auth.admin.revoke', { tokenAdmin: currentToken, token: currentToken });
    }
  } catch {
    // Continuar con la revocación local aun si falló la red
  } finally {
    setAdminToken(null);
    clearMemoryCache();
  }
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

/**
 * Validar si la sesión actual del usuario o dispositivo sigue activa y no ha sido revocada en Google Apps Script.
 * Si la contraseña fue cambiada, Apps Script retorna SESSION_EXPIRED o error de sesión vencida,
 * lo cual dispara automáticamente el cierre de sesión en memoria y notifica a los componentes.
 */
export async function validateCurrentSession(): Promise<boolean> {
  const session = getActiveSession();
  if (!session || !session.token) {
    return false;
  }

  try {
    const res = await callGAS<{ valid: boolean; ok?: boolean }>(
      'auth.session.validate',
      { token: session.token },
      false
    );
    if (!res || res.valid === false || res.ok === false) {
      setActiveSession(null);
      setAdminToken(null);
      return false;
    }
    return true;
  } catch (err: unknown) {
    const msg = String(err instanceof Error ? err.message : '').toLowerCase();
    if (
      msg.includes('sesión vencida') ||
      msg.includes('sesion vencida') ||
      msg.includes('revocada') ||
      msg.includes('se requiere iniciar sesion')
    ) {
      setActiveSession(null);
      setAdminToken(null);
      return false;
    }
    return true;
  }
}

/**
 * Cambiar contraseña de Administrador (CONTRASENA_ADMIN) o de Usuario (CONTRASENA_USUARIO).
 * Exige la contraseña actual de Administrador para autorizar el cambio.
 * Al completarse, invalida de forma inmediata y global todas las sesiones del rol afectado en Google Sheets.
 */
export async function changeSystemPassword(
  targetRole: 'admin' | 'usuario',
  currentAdminPassword: string,
  newPassword: string
): Promise<{ ok: boolean; message: string; targetRole: string; sessionRevoked: boolean }> {
  if (!currentAdminPassword || !currentAdminPassword.trim()) {
    throw new Error('Debe ingresar la contraseña actual de Administrador para autorizar el cambio.');
  }
  if (!newPassword || !newPassword.trim()) {
    throw new Error('La nueva contraseña no puede estar vacía.');
  }
  if (newPassword.trim().length < 8) {
    throw new Error('La nueva contraseña debe tener al menos 8 caracteres.');
  }

  const result = await callGAS<{ ok: boolean; message: string; targetRole: string; sessionRevoked: boolean }>(
    'auth.password.change',
    {
      targetRole,
      currentAdminPassword: currentAdminPassword.trim(),
      newPassword: newPassword.trim(),
    },
    false
  );

  // Si se cambió la contraseña de administrador, limpiar el token administrativo local y cerrar la sesión actual
  if (targetRole === 'admin') {
    setAdminToken(null);
    setActiveSession(null);
  }

  // Limpiar toda la caché de memoria local
  clearMemoryCache();

  return result;
}

// -------------------------------------------------------------
// 3. Campaigns (Campañas)
// -------------------------------------------------------------

export async function getCampaigns(useCache = true): Promise<Campaign[]> {
  const res = await callGAS<any>('catalog.list', {}, useCache);
  const rawList = extractArrayFromResponse(res, ['campaigns', 'campanas', 'Campanas', 'items']);
  console.log(`[catalog.list Diagnostic - Campanas] Count: ${rawList.length}`);
  return rawList.map(normalizeCampaign);
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

export function normalizeCampaign(raw: any): Campaign {
  if (!raw || typeof raw !== 'object') {
    return {
      id: '',
      nombre: '',
      activa: false,
      estado: 'activa',
      fechaInicio: '',
    };
  }
  return {
    id: String(raw.id || raw.ID || raw.campanaId || raw.CampanaId || ''),
    nombre: String(raw.nombre ?? raw.Nombre ?? raw.name ?? raw.Name ?? ''),
    activa: Boolean(raw.activa ?? raw.Activa ?? raw.is_active ?? raw.activo ?? false),
    fechaInicio: String(raw.fechaInicio ?? raw.FechaInicio ?? raw.fecha ?? ''),
    fechaFin: raw.fechaFin ? String(raw.fechaFin) : undefined,
    estado: String(raw.estado ?? raw.Estado ?? 'activa').toLowerCase() as 'activa' | 'cerrada',
  };
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
    icono: raw.icono ? String(raw.icono).trim() : undefined,
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

  const rawJobTypes = extractArrayFromResponse(res, [
    'machineJobTypes',
    'trabajosMaquinaria',
    'laboresMaquinaria',
    'tarifasMaquinaria',
    'machineJobs',
    'jobTypes',
  ]);
  const allJobTypes = rawJobTypes.map(normalizeMachineJobType);

  const normalized = rawList.map((raw) => {
    const m = normalizeMachine(raw);
    let jobsForMachine = allJobTypes.filter((j) => String(j.maquinaId) === String(m.id));
    const isNewHolland =
      m.nombre.toLowerCase().includes('new holland') ||
      m.nombre.toLowerCase().includes('ts115') ||
      m.nombre.toLowerCase().includes('ts 115');

    if (jobsForMachine.length === 0 && isNewHolland) {
      jobsForMachine = NEW_HOLLAND_DEFAULT_JOBS.map((j, idx) => ({
        ...j,
        id: `nh_default_${idx + 1}`,
        maquinaId: m.id,
      }));
    }
    m.trabajos = jobsForMachine;
    return m;
  });

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
  const payload = { id, maquinariaId: id, deleted: true };
  let res: any;
  try {
    res = await callGAS<any>('machine.delete', payload);
  } catch {
    res = await callGAS<any>('machine.save', payload);
  }
  if (res && res.ok === false) {
    throw new Error(res.error || 'No se pudo eliminar la maquinaria en el servidor.');
  }
  clearMemoryCache();
}

// -------------------------------------------------------------
// 4.1 Machine Job Types (Tipos de Trabajo y Tarifas por Máquina)
// -------------------------------------------------------------

export const NEW_HOLLAND_DEFAULT_JOBS: Omit<MachineJobType, 'id' | 'maquinaId'>[] = [
  { nombre: 'Tractor con sembradora', tarifa: 30, moneda: 'USD', unidad: 'ha', icono: 'sembradora', activo: true },
  { nombre: 'Tractor con romplow', tarifa: 35, moneda: 'USD', unidad: 'ha', icono: 'romplow', activo: true },
  { nombre: 'Tractor con ripper (subsolador)', tarifa: 50, moneda: 'USD', unidad: 'ha', icono: 'ripper', activo: true },
  { nombre: 'Tractor con pala niveladora', tarifa: 45, moneda: 'USD', unidad: 'ha', icono: 'pala-niveladora', activo: true },
  { nombre: 'Tractor con rastra', tarifa: 25, moneda: 'USD', unidad: 'ha', icono: 'rastra', activo: true },
  { nombre: 'Tractor con traílla', tarifa: 35, moneda: 'USD', unidad: 'hora', icono: 'trailla', activo: true },
  { nombre: 'Tractor con cortadora de sorgo', tarifa: 20, moneda: 'USD', unidad: 'ha', icono: 'cortadora-sorgo', activo: true },
  { nombre: 'Tractor con rolo', tarifa: 30, moneda: 'USD', unidad: 'ha', icono: 'rolo', activo: true },
  { nombre: 'Fumigación', tarifa: 55, moneda: 'BOB', unidad: 'ha', icono: 'fumigadora', activo: true },
  { nombre: 'Tractor solo', tarifa: 20, moneda: 'USD', unidad: 'hora', icono: 'tractor-blue', activo: true },
];

export function normalizeMachineJobType(raw: any): MachineJobType {
  if (!raw || typeof raw !== 'object') {
    return {
      id: '',
      maquinaId: '',
      nombre: '',
      tarifa: 0,
      moneda: 'USD',
      unidad: 'ha',
      activo: true,
    };
  }
  const rawMoneda = String(raw.moneda || raw.Moneda || 'USD').toUpperCase();
  const rawUnidad = String(raw.unidad || raw.Unidad || 'ha').toLowerCase();
  const normalizedUnidad: 'hora' | 'ha' = (rawUnidad.includes('hora') || rawUnidad === 'h') ? 'hora' : 'ha';
  return {
    id: String(raw.id || raw.ID || `mjt_${Math.random().toString(36).substr(2, 6)}`),
    maquinaId: String(raw.maquinaId || raw.maquinariaId || raw.maquina_id || ''),
    nombre: String(raw.nombre || raw.Nombre || raw.trabajo || 'Labor'),
    icono: raw.icono ? String(raw.icono).trim() : undefined,
    tarifa: parseDecimalNumber(raw.tarifa ?? raw.Tarifa ?? raw.precio ?? 0),
    moneda: (rawMoneda === 'BOB' || rawMoneda === 'BS' ? 'BOB' : 'USD') as Currency,
    unidad: normalizedUnidad,
    activo: raw.activo !== false && String(raw.activo).toLowerCase() !== 'false',
  };
}

export async function getMachineJobTypes(maquinaId?: string, useCache = true): Promise<MachineJobType[]> {
  let list: any[] = [];
  try {
    const res = await callGAS<any>('catalog.list', {}, useCache);
    list = extractArrayFromResponse(res, [
      'machineJobTypes',
      'trabajosMaquinaria',
      'laboresMaquinaria',
      'tarifasMaquinaria',
      'machineJobs',
      'jobTypes',
    ]);
  } catch {
    // fallback
  }

  if (list.length === 0) {
    try {
      const res = await callGAS<any>('machineJobType.list', { maquinaId }, useCache);
      list = extractArrayFromResponse(res, ['jobTypes', 'items', 'result', 'trabajos']);
    } catch {
      // empty list
    }
  }

  const normalized = list.map(normalizeMachineJobType);

  if (maquinaId) {
    return normalized.filter((j) => String(j.maquinaId) === String(maquinaId));
  }
  return normalized;
}

export async function saveMachineJobType(jobType: Partial<MachineJobType> & { nombre: string; maquinaId: string }): Promise<MachineJobType> {
  const rawU = String(jobType.unidad || 'ha').toLowerCase();
  const codeUnidad: 'hora' | 'ha' = (rawU.includes('hora') || rawU === 'h') ? 'hora' : 'ha';
  const tarifaNum = parseDecimalNumber(jobType.tarifa);
  const rawMon = String(jobType.moneda || 'USD').toUpperCase();
  const monedaVal: Currency = (rawMon === 'BOB' || rawMon === 'BS') ? 'BOB' : 'USD';

  const jobTypeData = {
    ...jobType,
    nombre: jobType.nombre.trim(),
    maquinaId: jobType.maquinaId,
    tarifa: tarifaNum,
    moneda: monedaVal,
    unidad: codeUnidad,
    activo: jobType.activo !== false,
  };

  const payload = {
    ...jobTypeData,
    jobType: jobTypeData,
    trabajo: jobTypeData,
  };

  const res = await callGAS<any>('machineJobType.save', payload);
  clearMemoryCache();
  return normalizeMachineJobType(res?.result || res || jobTypeData);
}

export async function deleteMachineJobType(id: string): Promise<void> {
  const payload = { id, deleted: true, action: 'delete' };
  try {
    await callGAS('machineJobType.delete', payload);
  } catch {
    await callGAS('machineJobType.save', payload);
  }
  clearMemoryCache();
}

export async function seedNewHollandJobs(maquinaId: string): Promise<MachineJobType[]> {
  const saved: MachineJobType[] = [];
  for (const jobDef of NEW_HOLLAND_DEFAULT_JOBS) {
    const res = await saveMachineJobType({
      ...jobDef,
      maquinaId,
    });
    saved.push(res);
  }
  clearMemoryCache();
  return saved;
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

export function normalizeMachineryJob(raw: any): MachineryJob {
  if (!raw || typeof raw !== 'object') {
    return {
      id: '',
      tipoTrabajo: 'tercero',
      fecha: new Date().toISOString().slice(0, 10),
      campanaId: '',
      maquinariaId: '',
      cantidad: 0,
      unidad: 'ha',
      tarifa: 0,
      moneda: 'BOB',
      tipoCambio: 6.96,
      total: 0,
    };
  }
  const idVal = String(raw.id || raw.ID || '');
  const tipoRaw = String(raw.tipoTrabajo || raw.destino || raw.tipo || '').toLowerCase();
  const tipoTrabajoVal: 'tercero' | 'propiedad' =
    tipoRaw.includes('prop') || String(raw.destino || '').toUpperCase() === 'PROPIEDAD'
      ? 'propiedad'
      : 'tercero';

  const cantVal = parseDecimalNumber(raw.cantidad ?? raw.horas ?? raw.hectareas ?? 0);
  const tarifaVal = parseDecimalNumber(raw.tarifa ?? raw.precioUnitario ?? raw.precio ?? 0);
  const totalVal = parseDecimalNumber(raw.total ?? raw.importe ?? cantVal * tarifaVal);
  const rawMoneda = String(raw.moneda || 'BOB').toUpperCase();
  const monedaVal: Currency = rawMoneda === 'USD' || rawMoneda === 'U$D' ? 'USD' : 'BOB';
  const rawUnidad = String(raw.unidad || 'ha').toLowerCase();
  const unidadVal = rawUnidad.includes('hora') || rawUnidad === 'h' ? 'hora' : 'ha';

  let trabajoNombreVal = String(
    raw.trabajoNombre || raw.trabajo || raw.labor || raw.trabajo_nombre || raw.tipo_trabajo || ''
  ).trim();
  const obs = String(raw.observacion || raw.observaciones || '');
  if (!trabajoNombreVal && obs.includes('[Trabajo:')) {
    const match = obs.match(/\[Trabajo:\s*([^\]]+)\]/);
    if (match && match[1]) {
      trabajoNombreVal = match[1].trim();
    }
  }

  return {
    id: idVal,
    tipoTrabajo: tipoTrabajoVal,
    fecha: formatDateDDMMAAAA(raw.fecha || ''),
    campanaId: String(raw.campanaId || raw.id_campana || ''),
    campanaNombre: raw.campanaNombre || raw.campana || '',
    maquinariaId: String(raw.maquinariaId || raw.maquinaId || raw.id_maquina || ''),
    maquinariaNombre: raw.maquinariaNombre || raw.maquina || raw.maquinaria || '',
    trabajoTipoId: String(raw.trabajoTipoId || raw.trabajo_tipo_id || raw.tipoTrabajoId || ''),
    trabajoNombre: trabajoNombreVal,
    icono: raw.icono ? String(raw.icono).trim() : undefined,
    cliente: String(raw.cliente || ''),
    loteId: String(raw.loteId || raw.id_lote || ''),
    loteNombre: raw.loteNombre || raw.lote || '',
    cantidad: cantVal,
    unidad: unidadVal,
    tarifa: tarifaVal,
    moneda: monedaVal,
    tipoCambio: parseDecimalNumber(raw.tipoCambio ?? raw.tc ?? 6.96),
    tc: parseDecimalNumber(raw.tc ?? raw.tipoCambio ?? 6.96),
    total: totalVal,
    observacion: obs,
    linkedMovimientoId: raw.linkedMovimientoId || raw.trabajoId || '',
  };
}

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
  return list.map(normalizeMachineryJob);
}

export async function createMachineryJob(job: Omit<MachineryJob, 'id'>): Promise<MachineryJob> {
  const rawU = String(job.unidad || '').toLowerCase();
  const codeUnidad: 'hora' | 'ha' = rawU.includes('hora') || rawU === 'h' ? 'hora' : 'ha';
  const cantNum = parseDecimalNumber(job.cantidad);
  const tarifaNum = parseDecimalNumber(job.tarifa);
  const totalNum = parseDecimalNumber(job.total) || cantNum * tarifaNum;
  const gasMoneda = job.moneda === 'USD' ? 'USD' : 'BS';
  const tcNum = resolveEffectiveExchangeRate(job.tipoCambio);
  const gasDestino = job.tipoTrabajo === 'propiedad' ? 'PROPIEDAD' : 'TERCERO';

  let finalObs = job.observacion || '';
  if (job.trabajoNombre && !finalObs.includes('[Trabajo:')) {
    finalObs = finalObs ? `${finalObs} [Trabajo: ${job.trabajoNombre}]` : `[Trabajo: ${job.trabajoNombre}]`;
  }

  const jobData = {
    ...job,
    maquinaId: job.maquinariaId,
    maquinariaId: job.maquinariaId,
    destino: gasDestino,
    tipoTrabajo: job.tipoTrabajo,
    fecha: job.fecha,
    campanaId: job.campanaId,
    campanaNombre: job.campanaNombre || '',
    trabajoTipoId: job.trabajoTipoId || '',
    trabajoNombre: job.trabajoNombre || '',
    labor: job.trabajoNombre || '',
    trabajo: job.trabajoNombre || '',
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
    observacion: finalObs,
    observaciones: finalObs,
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
    observacion: finalObs,
  };
}

export async function updateMachineryJob(id: string, job: Partial<MachineryJob>): Promise<MachineryJob> {
  const rawU = String(job.unidad || '').toLowerCase();
  const codeUnidad: 'hora' | 'ha' = rawU.includes('hora') || rawU === 'h' ? 'hora' : 'ha';
  const cantNum = parseDecimalNumber(job.cantidad);
  const tarifaNum = parseDecimalNumber(job.tarifa);
  const gasMoneda = job.moneda ? (job.moneda === 'USD' ? 'USD' : 'BS') : undefined;
  const tcNum =
    job.tipoCambio !== undefined
      ? resolveEffectiveExchangeRate(job.tipoCambio)
      : getConfiguredExchangeRate() > 0
      ? getConfiguredExchangeRate()
      : undefined;
  const { id: _, ...restJob } = job as any;

  let finalObs = job.observacion;
  if (job.trabajoNombre && finalObs !== undefined && !finalObs.includes('[Trabajo:')) {
    finalObs = finalObs ? `${finalObs} [Trabajo: ${job.trabajoNombre}]` : `[Trabajo: ${job.trabajoNombre}]`;
  }

  const jobData = {
    id,
    ...restJob,
    ...(job.maquinariaId ? { maquinaId: job.maquinariaId, maquinariaId: job.maquinariaId } : {}),
    ...(job.tipoTrabajo
      ? { destino: job.tipoTrabajo === 'propiedad' ? 'PROPIEDAD' : 'TERCERO', tipoTrabajo: job.tipoTrabajo }
      : {}),
    ...(job.trabajoTipoId !== undefined ? { trabajoTipoId: job.trabajoTipoId } : {}),
    ...(job.trabajoNombre !== undefined ? { trabajoNombre: job.trabajoNombre, labor: job.trabajoNombre, trabajo: job.trabajoNombre } : {}),
    unidad: codeUnidad,
    unidadCobro: codeUnidad,
    ...(cantNum ? { cantidad: cantNum } : {}),
    ...(tarifaNum ? { tarifa: tarifaNum, precio: tarifaNum, precioUnitario: tarifaNum } : {}),
    ...(gasMoneda ? { moneda: gasMoneda } : {}),
    ...(tcNum ? { tc: tcNum, tipoCambio: tcNum } : {}),
    ...(finalObs !== undefined ? { observacion: finalObs, observaciones: finalObs } : {}),
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
    observacion: finalObs !== undefined ? finalObs : (job as any).observacion,
  };
}

export async function deleteMachineryJob(id: string): Promise<void> {
  const payload = { id, jobId: id, deleted: true, action: 'delete' };
  try {
    await callGAS('work.delete', payload);
  } catch (err: any) {
    console.warn('[deleteMachineryJob] work.delete failed, trying deleteMachineryJob fallback:', err?.message);
    await callGAS('deleteMachineryJob', payload);
  }
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
        icono: e.icono ? String(e.icono).trim() : undefined,
        cantidad: cant,
        unidad: String(e.unidad || ''),
        precio: prec,
        moneda: mon,
        tipoCambio: parseDecimalNumber(e.tc ?? e.tipoCambio ?? getConfiguredExchangeRate() ?? 0),
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
  const tcNum = resolveEffectiveExchangeRate(expense.tipoCambio);

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

export async function updateExpense(id: string, expense: Partial<Expense>): Promise<Expense> {
  const cantNum = expense.cantidad !== undefined ? (parseDecimalNumber(expense.cantidad) || 1) : undefined;
  const precioNum = expense.precio !== undefined ? parseDecimalNumber(expense.precio) : undefined;
  const gasMoneda = expense.moneda ? (expense.moneda === 'USD' ? 'USD' : 'BS') : undefined;
  const tcNum = expense.tipoCambio !== undefined ? resolveEffectiveExchangeRate(expense.tipoCambio) : undefined;
  const totalNum =
    expense.total !== undefined
      ? parseDecimalNumber(expense.total)
      : (cantNum !== undefined && precioNum !== undefined ? cantNum * precioNum : undefined);

  const payload: Record<string, any> = {
    id,
    movimientoId: id,
    modulo: 'PROPIEDAD',
    clase: 'GASTO',
    tipo: 'gasto',
    ...(expense.fecha ? { fecha: expense.fecha } : {}),
    ...(expense.campanaId ? { campanaId: expense.campanaId } : {}),
    ...(expense.itemGasto ? { descripcion: expense.itemGasto, item: expense.itemGasto, itemGasto: expense.itemGasto } : {}),
    ...(cantNum !== undefined ? { cantidad: cantNum } : {}),
    ...(expense.unidad ? { unidad: expense.unidad } : {}),
    ...(precioNum !== undefined ? { precioUnitario: precioNum, precio: precioNum } : {}),
    ...(totalNum !== undefined ? { importe: totalNum, total: totalNum } : {}),
    ...(gasMoneda ? { moneda: gasMoneda } : {}),
    ...(tcNum !== undefined ? { tc: tcNum, tipoCambio: tcNum } : {}),
    ...(expense.observacion !== undefined ? { observaciones: expense.observacion, observacion: expense.observacion } : {}),
    ...(expense.loteId ? { loteId: expense.loteId } : {}),
  };

  let res: any;
  try {
    res = await callGAS<any>('updateExpense', payload);
  } catch {
    try {
      res = await callGAS<any>('movement.update', payload);
    } catch {
      res = await callGAS<any>('movement.save', payload);
    }
  }

  if (res && res.ok === false) {
    throw new Error(res.error || 'No se pudo actualizar el gasto en Google Sheets.');
  }

  clearMemoryCache();
  return {
    ...expense as any,
    id,
    total: totalNum ?? (expense.total || 0),
  };
}

export async function deleteExpense(id: string): Promise<void> {
  const payload = { id, movimientoId: id, tipo: 'gasto', clase: 'GASTO', deleted: true, action: 'delete' };
  try {
    await callGAS('movement.delete', payload);
  } catch (err: any) {
    console.warn('[deleteExpense] movement.delete failed, trying deleteExpense fallback:', err?.message);
    await callGAS('deleteExpense', payload);
  }
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
        icono: i.icono || i.Icono || undefined,
        cantidad: cant,
        unidad: String(i.unidad || ''),
        precio: prec,
        moneda: mon,
        tipoCambio: parseDecimalNumber(i.tc ?? i.tipoCambio ?? getConfiguredExchangeRate() ?? 0),
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
  const tcNum = resolveEffectiveExchangeRate(income.tipoCambio);

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
    ...(income.icono ? { icono: income.icono } : {}),
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

export async function updateIncome(id: string, income: Partial<Income>): Promise<Income> {
  const cantNum = income.cantidad !== undefined ? (parseDecimalNumber(income.cantidad) || 0) : undefined;
  const precioNum = income.precio !== undefined ? parseDecimalNumber(income.precio) : undefined;
  const gasMoneda = income.moneda ? (income.moneda === 'USD' ? 'USD' : 'BS') : undefined;
  const tcNum = income.tipoCambio !== undefined ? resolveEffectiveExchangeRate(income.tipoCambio) : undefined;
  const totalNum =
    income.total !== undefined
      ? parseDecimalNumber(income.total)
      : (cantNum !== undefined && precioNum !== undefined ? cantNum * precioNum : undefined);

  const payload: Record<string, any> = {
    id,
    movimientoId: id,
    modulo: 'PROPIEDAD',
    clase: 'INGRESO',
    tipo: 'ingreso',
    ...(income.fecha ? { fecha: income.fecha } : {}),
    ...(income.campanaId ? { campanaId: income.campanaId } : {}),
    ...(income.concepto ? { descripcion: income.concepto, concepto: income.concepto, item: income.concepto } : {}),
    ...(cantNum !== undefined ? { cantidad: cantNum } : {}),
    ...(income.unidad ? { unidad: income.unidad } : {}),
    ...(precioNum !== undefined ? { precioUnitario: precioNum, precio: precioNum } : {}),
    ...(totalNum !== undefined ? { importe: totalNum, total: totalNum } : {}),
    ...(gasMoneda ? { moneda: gasMoneda } : {}),
    ...(tcNum !== undefined ? { tc: tcNum, tipoCambio: tcNum } : {}),
    ...(income.observacion !== undefined ? { observaciones: income.observacion, observacion: income.observacion } : {}),
    ...(income.loteId ? { loteId: income.loteId } : {}),
  };

  let res: any;
  try {
    res = await callGAS<any>('updateIncome', payload);
  } catch {
    try {
      res = await callGAS<any>('movement.update', payload);
    } catch {
      res = await callGAS<any>('movement.save', payload);
    }
  }

  if (res && res.ok === false) {
    throw new Error(res.error || 'No se pudo actualizar el ingreso en Google Sheets.');
  }

  clearMemoryCache();
  return {
    ...income as any,
    id,
    total: totalNum ?? (income.total || 0),
  };
}

export async function deleteIncome(id: string): Promise<void> {
  const payload = { id, movimientoId: id, tipo: 'ingreso', clase: 'INGRESO', deleted: true, action: 'delete' };
  try {
    await callGAS('movement.delete', payload);
  } catch (err: any) {
    console.warn('[deleteIncome] movement.delete failed, trying deleteIncome fallback:', err?.message);
    await callGAS('deleteIncome', payload);
  }
  clearMemoryCache();
}

// -------------------------------------------------------------
// 9. Configurable Items (Ítems de gasto / ingreso)
// -------------------------------------------------------------

export async function getItemsConfig(useCache = true): Promise<ItemConfig[]> {
  try {
    const res = await callGAS<any>('catalog.list', {}, useCache);
    const rawItems = extractArrayFromResponse(res, ['items', 'itemsConfig', 'conceptos', 'rubros', 'catalog']);
    if (rawItems && rawItems.length > 0) {
      return rawItems.filter(Boolean).map(normalizeItemConfig);
    }
  } catch {
    // fallback
  }

  try {
    const res = await callGAS<any>('getItemsConfig', {}, useCache);
    const rawItems = extractArrayFromResponse(res, ['items', 'itemsConfig', 'result', 'conceptos']);
    return (rawItems || []).filter(Boolean).map(normalizeItemConfig);
  } catch {
    return [];
  }
}

export async function saveItemConfig(item: Partial<ItemConfig> & { nombre: string; modulo?: string; clase?: string }): Promise<ItemConfig> {
  const gasModulo = (item.modulo || (item.tipo === 'gasto_maquinaria' ? 'MAQUINARIAS' : 'PROPIEDAD')).toUpperCase();
  const gasClase = (item.clase || (item.tipo === 'ingreso_propiedad' ? 'INGRESO' : 'GASTO')).toUpperCase();
  const gasMoneda = (item.moneda === 'USD' ? 'USD' : 'BS');
  const precioNum = parseDecimalNumber(item.precioPredeterminado ?? item.precio);

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
  const tcNum = resolveEffectiveExchangeRate();

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
    const res = await callGAS<any>('fx.get', {}, useCache);
    const tasa = parseDecimalNumber(res?.tasaBobPerUsd ?? res?.tasa ?? res?.tc ?? res?.rate);
    if (tasa > 0) {
      setConfiguredExchangeRate(tasa);
      return {
        tasaBobPerUsd: tasa,
        fuente: res?.fuente || 'manual',
        fechaActualizacion: res?.fechaActualizacion || res?.fecha || getLocalDateString(),
        nota: res?.nota || '',
      };
    }
  } catch {
    // fallback to catalog.list
  }

  try {
    const res = await callGAS<any>('catalog.list', {}, useCache);
    if (res && res.exchangeRate) {
      const parsedRate = parseDecimalNumber(res.exchangeRate.tasaBobPerUsd ?? res.exchangeRate.tasa);
      if (parsedRate > 0) setConfiguredExchangeRate(parsedRate);
      return res.exchangeRate;
    }
    const tasa = parseDecimalNumber(res?.tasaBobPerUsd ?? res?.exchangeRate?.tasaBobPerUsd ?? res?.tasa);
    if (tasa > 0) {
      setConfiguredExchangeRate(tasa);
      return {
        tasaBobPerUsd: tasa,
        fuente: res?.fuente || 'manual',
        fechaActualizacion: res?.fechaActualizacion || res?.exchangeRate?.fechaActualizacion || getLocalDateString(),
        nota: res?.nota || '',
      };
    }
  } catch {
    // fallback
  }

  const existingRate = getConfiguredExchangeRate();
  return {
    tasaBobPerUsd: existingRate > 0 ? existingRate : 0,
    fuente: 'manual' as const,
    fechaActualizacion: getLocalDateString(),
  };
}

export async function saveExchangeRateConfig(config: { tasaBobPerUsd: number; nota?: string; fecha?: string }): Promise<ExchangeRateConfig> {
  const tcNum = parseDecimalNumber(config.tasaBobPerUsd);
  if (tcNum <= 0) {
    throw new Error('El tipo de cambio debe ser un número positivo mayor a 0.');
  }

  const localDateStr = config.fecha ? getLocalDateString(config.fecha) : getLocalDateString();

  const payload = {
    tasa: tcNum,
    tasaBobPerUsd: tcNum,
    tc: tcNum,
    rate: tcNum,
    fecha: localDateStr,
    fechaActualizacion: localDateStr,
    fecha_actualizacion: localDateStr,
    date: localDateStr,
    nota: config.nota || 'Configurado manualmente por el administrador',
  };

  let res: any;
  try {
    res = await callGAS<any>('fx.set', payload);
  } catch (err: any) {
    throw new Error(`Error en el backend al guardar el tipo de cambio vía fx.set: ${err?.message || 'Error de comunicación'}`);
  }

  clearMemoryCache();

  const returnedTasa = parseDecimalNumber(
    res?.tasaBobPerUsd ?? res?.tasa ?? res?.tc ?? res?.rate ?? tcNum
  );

  const finalTasa = returnedTasa || tcNum;
  setConfiguredExchangeRate(finalTasa);

  return {
    tasaBobPerUsd: finalTasa,
    fuente: res?.fuente || 'manual',
    fechaActualizacion: res?.fechaActualizacion || res?.fecha || localDateStr,
    nota: res?.nota || config.nota || '',
  };
}

// -------------------------------------------------------------
// 12. Financial Reports (Acción administrativa report.get)
// -------------------------------------------------------------

export async function getFinancialReports(campanaId?: string, useCache = true): Promise<any> {
  return callGAS<any>('report.get', { campanaId }, useCache);
}
