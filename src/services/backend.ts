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
  AssetImprovement,
  ExchangeRateConfig,
  ExchangeRateStatus,
  BackendHealthResponse,
  Currency,
  CobroEstado,
  CobroPago,
  CobroCuenta,
  HarvestPriceAssignment,
  HarvestRecord,
  ExpenseAllocationLot,
  ExpenseAllocationGroup,
  Customer,
  PaymentSettings,
  HarvestSale,
  HarvestSaleDistribution,
  HarvestSaleStatus,
  ArDebt,
  ArDebtApplicationItem,
  ArCustomerSummary,
  ArPaymentRecord,
  DebitNoteLine,
  DebitNoteRecord,
  PaymentReceiptLine,
  PaymentReceiptRecord,
} from '../types';
import {
  getCacheSessionGeneration,
  invalidateQueries,
  resetAllCache,
} from './dataCache';
import { computeHarvestAvailability, normalizeHarvestUnit } from './harvestAvailability';

/**
 * Backend Communication Service for MAQUINARIAS Y PROPIEDAD
 * All backend calls are strictly centralized here.
 * Connects directly to Google Apps Script / Google Sheets.
 */

const GAS_DIRECT_URL = 'https://script.google.com/macros/s/AKfycbwiFRh5R1k5ZxxFD67Fl0xcmIA1NVbx9XOg2gtjbvyYgAFoprbVB8foMTnUpPvMY0tf/exec';
const PROXY_URL = '/api/gas';

export type BackendErrorKind = 'auth' | 'network' | 'server' | 'invalid_response' | 'unknown';

export class BackendError extends Error {
  readonly kind: BackendErrorKind;
  readonly status?: number;
  readonly code?: string;

  constructor(
    message: string,
    kind: BackendErrorKind = 'unknown',
    options?: { status?: number; code?: string }
  ) {
    super(message);
    this.name = 'BackendError';
    this.kind = kind;
    this.status = options?.status;
    this.code = options?.code;
  }
}

function isLikelyCredentialErrorMessage(msg: string, code?: string): boolean {
  const lower = String(msg || '').toLowerCase();
  const c = String(code || '').toUpperCase();
  if (c === 'INVALID_CREDENTIALS' || c === 'AUTH_FAILED' || c === 'UNAUTHORIZED') return true;
  return (
    lower.includes('contraseña incorrecta') ||
    lower.includes('contrasena incorrecta') ||
    lower.includes('usuario o pin incorrecto') ||
    lower.includes('pin incorrecto') ||
    lower.includes('credenciales incorrectas') ||
    lower.includes('ingrese la contraseña') ||
    lower.includes('ingrese la contrasena')
  );
}

// In-flight request deduplication map
const pendingRequests = new Map<string, Promise<any>>();

// Temporary in-memory cache
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const memoryCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

// Read-only actions whose responses can safely warm the in-memory HTTP cache
const CACHEABLE_READ_ACTIONS = new Set([
  'catalog.list',
  'work.list',
  'movement.list',
  'asset.list',
  'fx.get',
  'machineType.list',
  'machineJobType.list',
  'getItemsConfig',
  'report.get',
  'cobros.list',
  'cobros.estado',
  'harvest.list',
  'harvest.pending',
  'harvestSale.list',
  'customer.list',
  'paymentSettings.get',
  'ar.summary',
  'ar.customer',
  'ar.documents',
  'expense.allocations',
]);

function canonicalizePayload(payload: Record<string, any> = {}): string {
  const clean: Record<string, any> = {};
  const keys = Object.keys(payload).sort();
  for (const k of keys) {
    if (payload[k] !== undefined) {
      clean[k] = payload[k];
    }
  }
  return JSON.stringify(clean);
}

// Short-term in-memory cache for admin authorization verification (cleared on token/session change)
let lastAdminVerifyToken: string | null = null;
let lastAdminVerifyAt = 0;
let pendingAdminVerify: Promise<boolean> | null = null;
const ADMIN_VERIFY_TTL_MS = 60 * 1000;

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

type AdminAuthChangeListener = (isAdmin: boolean) => void;
const adminAuthListeners = new Set<AdminAuthChangeListener>();

export function onAdminAuthChange(listener: AdminAuthChangeListener): () => void {
  adminAuthListeners.add(listener);
  return () => adminAuthListeners.delete(listener);
}

export function setAdminToken(token: string | null): void {
  const prevToken = inMemoryAdminToken;
  inMemoryAdminToken = token;
  if (prevToken !== token) {
    lastAdminVerifyToken = null;
    lastAdminVerifyAt = 0;
    pendingAdminVerify = null;
  }
  try {
    if (token) {
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  } catch {
    // Ignore storage quota or access errors
  }
  const authorized = !!token;
  adminAuthListeners.forEach((fn) => fn(authorized));
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

export function getBoliviaDateString(dateInput: Date | string = new Date()): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const safeDate = isNaN(d.getTime()) ? new Date() : d;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/La_Paz',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(safeDate);
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // Fallback below
  }
  return getLocalDateString(safeDate);
}

/**
 * Format numeric exchange rates using Bolivian regional standard:
 * dot for thousands, comma for decimals (2 decimals, e.g. 11,75).
 * Display-only; never alters stored numeric precision.
 */
export function formatExchangeRateNumber(val: number | undefined | null): string {
  if (typeof val !== 'number' || !isFinite(val) || val <= 0) return '—';
  const formatted = val.toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  // Ensure comma decimal even in environments where es-BO locale falls back to en-US
  if (/^\d{1,3}(,\d{3})*\.\d{2}$/.test(formatted)) {
    return formatted.replace(/,/g, '_').replace(/\./g, ',').replace(/_/g, '.');
  }
  return formatted;
}

/**
 * Cleanly format any exchange rate date/timestamp into DD/MM/AAAA (or DD/MM/AAAA · HH:mm),
 * stripping ugly GMT technical strings from Google Sheets Date serialization.
 */
export function formatExchangeRateDate(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return '';
    return formatDateDDMMAAAA(getBoliviaDateString(dateInput));
  }
  const str = String(dateInput).trim();
  if (!str) return '';

  // Match YYYY-MM-DD HH:mm
  const matchYmdTime = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2})/);
  if (matchYmdTime) {
    return `${matchYmdTime[3]}/${matchYmdTime[2]}/${matchYmdTime[1]} · ${matchYmdTime[4]}`;
  }
  // Match YYYY-MM-DD anywhere (including ISO)
  const matchYmd = str.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (matchYmd) {
    return `${matchYmd[3].padStart(2, '0')}/${matchYmd[2].padStart(2, '0')}/${matchYmd[1]}`;
  }
  // Match DD/MM/YYYY
  const matchDmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (matchDmy) {
    return `${matchDmy[1].padStart(2, '0')}/${matchDmy[2].padStart(2, '0')}/${matchDmy[3]}`;
  }
  // Handle legacy JS Date strings containing GMT (e.g. "Fri Nov 20 2026 00:00:00 GMT-0400 ...")
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return formatDateDDMMAAAA(getBoliviaDateString(parsed));
  }
  return str;
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

/**
 * Hard reset of all private in-memory caches and in-flight maps.
 * Called automatically on logout, session switch, admin revocation, or password change.
 */
export function resetAllPrivateMemoryData() {
  memoryCache.clear();
  pendingRequests.clear();
  lastAdminVerifyToken = null;
  lastAdminVerifyAt = 0;
  pendingAdminVerify = null;
  resetAllCache();
}

export function setActiveSession(session: UserSession | null) {
  const prevToken = activeSession?.token || null;
  const prevUser = activeSession?.usuario || null;
  const nextToken = session?.token || null;
  const nextUser = session?.usuario || null;
  const sessionChanged = prevToken !== nextToken || prevUser !== nextUser;

  activeSession = session;
  if (session) {
    if (sessionChanged && prevToken !== null) {
      // Switching to a different user or token: wipe all private cached data
      resetAllPrivateMemoryData();
    }
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
    resetAllPrivateMemoryData();
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
 * Selective invalidation after mutations:
 * - Clears only matching raw HTTP cache entries in memoryCache.
 * - Marks matching SWR entries in dataCache as stale WITHOUT wiping currently displayed data.
 */
export function invalidateBackendDomains(patterns: string[]) {
  for (const pattern of patterns) {
    clearMemoryCache(pattern);
  }
  invalidateQueries(patterns);
}

/**
 * Low-level dispatch to Google Apps Script
 */
async function callGAS<T>(action: string, payload: Record<string, any> = {}, useCache = false): Promise<T> {
  const isSensitiveAuthAction =
    action === 'auth.login' ||
    action === 'auth.logout' ||
    action === 'auth.admin.authorize' ||
    action === 'auth.admin.revoke';

  const cacheKey = isSensitiveAuthAction ? '' : `${action}:${canonicalizePayload(payload)}`;
  const reqGen = getCacheSessionGeneration();

  if (!isSensitiveAuthAction && useCache && memoryCache.has(cacheKey)) {
    const entry = memoryCache.get(cacheKey)!;
    if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
      return entry.data as T;
    }
    memoryCache.delete(cacheKey);
  }

  // Deduplicate inflight requests for identical non-sensitive queries
  if (!isSensitiveAuthAction && pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)! as Promise<T>;
  }

  const requestPromise = (async () => {
    let body: Record<string, any>;
    const currentAdminToken = getAdminToken();

    if (action === 'auth.login') {
      // Contract for auth.login:
      // - Never include existing session/admin tokens.
      // - Always keep PIN / password as string to preserve leading zeros.
      // - Only include `usuario` when an explicit individual username is supplied;
      //   omitting `usuario` allows GAS handleLogin2026_() to delegate to handleLogin()
      //   for shared CONTRASENA_USUARIO / CONTRASENA_ADMIN authentication.
      const rawUsuario =
        payload.usuario !== undefined && payload.usuario !== null
          ? String(payload.usuario).trim()
          : '';
      const rawSecret = String(
        payload.pin ?? payload.password ?? payload.contrasena ?? ''
      ).trim();

      const loginData: Record<string, string> = {
        pin: rawSecret,
        password: rawSecret,
        contrasena: rawSecret,
      };
      if (rawUsuario) {
        loginData.usuario = rawUsuario;
      }

      body = {
        action: 'auth.login',
        data: loginData,
      };
    } else if (action === 'auth.admin.authorize') {
      // Contract for auth.admin.authorize: validates CONTRASENA_ADMIN (preserved as string)
      const rawAdminSecret = String(
        payload.password ?? payload.contrasena ?? payload.contrasenaAdmin ?? ''
      ).trim();
      body = {
        action: 'auth.admin.authorize',
        ...(activeSession?.token ? { token: activeSession.token } : {}),
        data: {
          password: rawAdminSecret,
          contrasena: rawAdminSecret,
          contrasenaAdmin: rawAdminSecret,
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

    const serializedBody = JSON.stringify(body);
    let response: Response;
    try {
      // First attempt via full-stack / Netlify proxy (cache: 'no-store' for Safari/Android reliability)
      response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: serializedBody,
        cache: 'no-store',
      });

      if (!response.ok && response.status === 404) {
        // Fallback to direct Apps Script only if proxy route does not exist
        response = await fetch(GAS_DIRECT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: serializedBody,
          redirect: 'follow',
          cache: 'no-store',
        });
      }
    } catch {
      // Network error reaching proxy: try direct Apps Script as fallback
      try {
        response = await fetch(GAS_DIRECT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: serializedBody,
          redirect: 'follow',
          cache: 'no-store',
        });
      } catch {
        throw new BackendError(
          'No se pudo conectar con el servidor. Verifica tu conexión a internet e intenta nuevamente.',
          'network'
        );
      }
    }

    let rawText = '';
    try {
      rawText = await response.text();
    } catch {
      throw new BackendError(
        'Se interrumpió la comunicación con el servidor. Intenta nuevamente.',
        'network',
        { status: response.status }
      );
    }

    let data: any;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      if (response.status >= 500) {
        throw new BackendError(
          `El servidor no respondió correctamente (HTTP ${response.status}). Intenta nuevamente en unos momentos.`,
          'server',
          { status: response.status }
        );
      }
      throw new BackendError(
        'El servidor devolvió una respuesta inválida. Intenta nuevamente en unos momentos.',
        'invalid_response',
        { status: response.status }
      );
    }

    if (!data || typeof data !== 'object') {
      throw new BackendError(
        'El servidor devolvió una respuesta inválida o vacía. Intenta nuevamente.',
        'invalid_response',
        { status: response.status }
      );
    }

    // Distinguish HTTP 5xx / proxy errors from business/auth responses
    if (!response.ok && response.status >= 500) {
      const serverMsg =
        typeof data.error === 'string' && data.error.trim()
          ? data.error.trim()
          : `Error del servidor (HTTP ${response.status}). Intenta nuevamente en unos momentos.`;
      throw new BackendError(serverMsg, 'server', {
        status: response.status,
        code: typeof data.code === 'string' ? data.code : undefined,
      });
    }

    // Safe diagnostic logging (no token/PIN/password logged)
    if (action === 'getMachines' || action === 'getLots' || action === 'getCampaigns') {
      const keysStr = data && typeof data === 'object' ? Object.keys(data).join(', ') : 'none';
      console.log(`[GAS Diagnostic] Action: ${action} | Succeeded: ${data?.ok} | Response keys: [${keysStr}]`);
      if (!data?.ok && data?.error) {
        console.warn(`[GAS Diagnostic Error] Action ${action} message: "${data.error}"`);
      }
    }

    if (!data.ok) {
      const rawErrMsg =
        typeof data.error === 'string' && data.error.trim()
          ? data.error.trim()
          : `Error en la acción ${action}`;
      const errStr = rawErrMsg.toLowerCase();
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
        code === 'UNAUTHORIZED_ADMIN' ||
        errStr.includes('autorización administrativa') ||
        errStr.includes('autorizacion administrativa') ||
        errStr.includes('autorización de administrador') ||
        errStr.includes('autorizacion de administrador') ||
        errStr.includes('token administrativo') ||
        errStr.includes('credencial administrativa') ||
        errStr.includes('contrasena_admin')
      ) {
        setAdminToken(null);
      }

      const isProxyOrServerErr =
        errStr.includes('proxy') ||
        errStr.includes('timeout') ||
        errStr.includes('lockservice') ||
        errStr.includes('no encontrada') ||
        errStr.includes('falta la hoja') ||
        errStr.includes('exceeded maximum execution time');

      const kind: BackendErrorKind = isLikelyCredentialErrorMessage(rawErrMsg, code)
        ? 'auth'
        : isProxyOrServerErr
        ? 'server'
        : action === 'auth.login'
        ? 'server'
        : 'unknown';

      throw new BackendError(rawErrMsg, kind, { status: response.status, code });
    }

    // Preserve sibling fields (e.g. `harvests`, `distributions`) when an endpoint returns an array in `result`
    // alongside another distinct top-level collection (such as `harvestSale.list`).
    const preserveMultiCollectionEnvelope =
      action === 'harvestSale.list' &&
      Array.isArray(data.result) &&
      (Array.isArray(data.harvests) || Array.isArray(data.cosechas) || Array.isArray(data.distributions));
    const result =
      data.result !== undefined
        ? preserveMultiCollectionEnvelope
          ? { ...data, result: data.result }
          : data.result
        : data;

    // Warm in-memory cache on read actions (only if session generation hasn't changed)
    if (
      !isSensitiveAuthAction &&
      (useCache || CACHEABLE_READ_ACTIONS.has(action)) &&
      reqGen === getCacheSessionGeneration()
    ) {
      memoryCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }

    return result as T;
  })();

  if (!isSensitiveAuthAction) {
    pendingRequests.set(cacheKey, requestPromise);
  }

  try {
    return await requestPromise;
  } finally {
    if (!isSensitiveAuthAction && pendingRequests.get(cacheKey) === requestPromise) {
      pendingRequests.delete(cacheKey);
    }
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
  const secret = String(password ?? '').trim();
  if (!secret) {
    throw new BackendError('Ingrese la contraseña.', 'auth');
  }

  // IMPORTANT: Do NOT pass a hardcoded `usuario` field here.
  // GAS `handleLogin2026_` checks `if (!usuario) return handleLogin(p)` to
  // validate shared CONTRASENA_USUARIO / CONTRASENA_ADMIN credentials.
  const result = await callGAS<UserSession & { tokenAdmin?: string }>('auth.login', {
    pin: secret,
    password: secret,
    contrasena: secret,
  });

  if (!result || typeof result.token !== 'string' || !result.token.trim()) {
    throw new BackendError(
      'El servidor no devolvió un token de sesión válido. Intenta nuevamente.',
      'invalid_response'
    );
  }

  if (result.tokenAdmin) {
    setAdminToken(result.tokenAdmin);
  }

  setActiveSession(result);
  return result;
}

/**
 * Compatible con inicio de sesión por usuario + PIN (conservando ceros iniciales como texto)
 * o contraseña compartida si `usuario` está vacío.
 */
export async function loginWithPin(usuario: string, pin: string): Promise<UserSession> {
  const cleanUser = String(usuario ?? '').trim();
  const cleanPin = String(pin ?? '').trim();

  if (!cleanUser) {
    return loginWithUserPassword(cleanPin);
  }
  if (!cleanPin) {
    throw new BackendError('Ingrese el PIN o contraseña.', 'auth');
  }

  const result = await callGAS<UserSession & { tokenAdmin?: string }>('auth.login', {
    usuario: cleanUser,
    pin: cleanPin,
    password: cleanPin,
    contrasena: cleanPin,
  });

  if (!result || typeof result.token !== 'string' || !result.token.trim()) {
    throw new BackendError(
      'El servidor no devolvió un token de sesión válido. Intenta nuevamente.',
      'invalid_response'
    );
  }

  if (result.tokenAdmin) {
    setAdminToken(result.tokenAdmin);
  }

  setActiveSession(result);
  return result;
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

export async function verifyAdminAuthorization(force = false): Promise<boolean> {
  const currentToken = getAdminToken();
  if (!currentToken) {
    return false;
  }
  if (
    !force &&
    lastAdminVerifyToken === currentToken &&
    Date.now() - lastAdminVerifyAt < ADMIN_VERIFY_TTL_MS
  ) {
    return true;
  }
  if (pendingAdminVerify && !force) {
    return pendingAdminVerify;
  }
  let verifyPromise: Promise<boolean> | null = null;
  verifyPromise = (async () => {
    try {
      const res = await callGAS<{ valid?: boolean; ok?: boolean }>('auth.admin.verify', {
        tokenAdmin: currentToken,
        token: currentToken,
      });
      if (res && (res.valid === true || res.ok === true)) {
        lastAdminVerifyToken = currentToken;
        lastAdminVerifyAt = Date.now();
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
      // Si fue un fallo transitorio de red o conexión, conservar la credencial existente
      return true;
    } finally {
      if (pendingAdminVerify === verifyPromise) {
        pendingAdminVerify = null;
      }
    }
  })();

  pendingAdminVerify = verifyPromise;
  return verifyPromise;
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
    resetAllPrivateMemoryData();
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
    // GAS handleLogout revokes both userToken and adminTok; clear both locally
    setAdminToken(null);
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

  // Limpiar toda la caché privada de memoria local
  resetAllPrivateMemoryData();

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
  invalidateBackendDomains(['catalog.', 'report.']);
  return res;
}

export async function setActiveCampaign(campaignId: string): Promise<void> {
  const payload = { campaignId, id: campaignId };
  await callGAS('campaign.activate', payload);
  invalidateBackendDomains(['catalog.', 'report.']);
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

  let tipoMapped: 'gasto_maquinaria' | 'gasto_propiedad' | 'ingreso_propiedad' | 'ingreso_maquinaria' = 'gasto_propiedad';
  if (moduloVal === 'MAQUINARIAS') {
    tipoMapped = claseVal === 'INGRESO' ? 'ingreso_maquinaria' : 'gasto_maquinaria';
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
  const idVal = String(raw.id || raw.ID || raw.id_lote || '');
  const valPat = parseDecimalNumber(
    raw.valorPatrimonial ??
    raw.valor_patrimonial ??
    raw.valorTotalUsd ??
    raw.valor_total_usd ??
    raw.valorInicial ??
    0
  );

  return {
    id: idVal,
    nombre: String(raw.nombre || raw.Nombre || raw.lote || raw.Lote || ''),
    superficieHectareas: parsedSup,
    superficie: parsedSup,
    cultivoActual: raw.cultivoActual || raw.cultivo || raw.Cultivo || raw.cultivo_actual || '',
    ubicacion: raw.ubicacion || raw.Ubicacion || raw.ubicación || '',
    observaciones: raw.observaciones || raw.observacion || raw.Notas || raw.Observaciones || '',
    valorPatrimonial: valPat > 0 ? valPat : undefined,
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

  const finalId = String(idVal || identVal || nameVal || `m_${Math.random().toString(36).substr(2, 6)}`);
  const valPat = parseDecimalNumber(
    raw.valorPatrimonial ??
    raw.valor_patrimonial ??
    raw.valorTotalUsd ??
    raw.valor_total_usd ??
    raw.valorInicial ??
    0
  );

  return {
    id: finalId,
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
    valorPatrimonial: valPat > 0 ? valPat : undefined,
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
    m.trabajos = allJobTypes.filter((j) => String(j.maquinaId) === String(m.id));
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
  const valPat = parseDecimalNumber(machine.valorPatrimonial);
  const isActivo = machine.estado ? machine.estado === 'operativo' : (machine.activo !== false);

  const machineData = {
    ...machine,
    identificacion: machine.identificacion ? String(machine.identificacion).trim() : 'TR-01',
    nombre: String(machine.nombre || '').trim(),
    unidad: codeUnidad,
    unidadCobro: codeUnidad,
    unidad_cobro: codeUnidad,
    unidadMedida: codeUnidad,
    tarifa: tarifaNum,
    costo: tarifaNum,
    precio: tarifaNum,
    activo: isActivo,
    estado: machine.estado || (isActivo ? 'operativo' : 'inactivo'),
    ...(valPat > 0 ? { valorPatrimonial: valPat, valorTotalUsd: valPat } : {}),
  };

  const payload = {
    ...machineData,
    machine: machineData,
    maquinaria: machineData,
  };

  const res = await callGAS<any>('machine.save', payload, false);
  if (!res || (typeof res === 'object' && res.ok === false)) {
    throw new Error(res?.error || 'El backend de Google Sheets no confirmó la creación de la maquinaria.');
  }

  invalidateBackendDomains(['catalog.', 'machineType.', 'asset.']);
  const created = normalizeMachine(res);
  if (valPat > 0 && created.id) {
    await upsertAssetForEntity(created.id, 'MAQUINARIA', created.nombre, valPat);
  }
  return {
    ...created,
    valorPatrimonial: valPat > 0 ? valPat : created.valorPatrimonial,
  };
}

export async function updateMachine(id: string, machine: Partial<Machine>): Promise<Machine> {
  const rawU = String(machine.unidad || '').toLowerCase();
  const codeUnidad: 'h' | 'ha' = (rawU.includes('ha') || rawU.includes('hect')) ? 'ha' : 'h';
  const tarifaNum = parseDecimalNumber(machine.tarifa);
  const valPat = machine.valorPatrimonial !== undefined ? parseDecimalNumber(machine.valorPatrimonial) : undefined;
  const isActivo = machine.estado ? machine.estado === 'operativo' : (machine.activo !== false);

  const { id: _, ...restMachine } = machine as any;
  const machineData = {
    id,
    ...restMachine,
    identificacion: machine.identificacion !== undefined ? String(machine.identificacion).trim() : id,
    nombre: String(machine.nombre || '').trim(),
    unidad: codeUnidad,
    unidadCobro: codeUnidad,
    unidad_cobro: codeUnidad,
    unidadMedida: codeUnidad,
    tarifa: tarifaNum,
    costo: tarifaNum,
    precio: tarifaNum,
    activo: isActivo,
    estado: machine.estado || (isActivo ? 'operativo' : 'inactivo'),
    ...(valPat !== undefined ? { valorPatrimonial: valPat, valorTotalUsd: valPat } : {}),
  };

  const payload = {
    id,
    maquinariaId: id,
    ...machineData,
    machine: machineData,
    maquinaria: machineData,
  };

  const res = await callGAS<any>('machine.save', payload, false);
  if (!res || (typeof res === 'object' && res.ok === false)) {
    throw new Error(res?.error || 'El backend de Google Sheets no confirmó la actualización de la maquinaria.');
  }

  // Clear affected caches so subsequent catalog/asset reads fetch fresh from Sheets
  invalidateBackendDomains(['catalog.', 'machineType.', 'asset.']);

  // Synchronously await patrimonial asset update
  if (valPat !== undefined && id) {
    await upsertAssetForEntity(id, 'MAQUINARIA', machine.nombre || res?.nombre || '', valPat);
  }

  const updated = normalizeMachine(res);

  // Verification step: verify fresh persistence in Google Sheets
  const freshMachines = await getMachines(false);
  const found = freshMachines.find(
    (m) =>
      m.id === id ||
      m.identificacion === id ||
      (machineData.identificacion && m.identificacion === machineData.identificacion)
  );

  if (!found) {
    throw new Error(
      `No se pudo verificar la maquinaria "${machineData.nombre}" en Google Sheets tras guardar los cambios.`
    );
  }

  return {
    ...found,
    valorPatrimonial: valPat !== undefined ? valPat : (found.valorPatrimonial ?? updated.valorPatrimonial),
  };
}

export async function deleteMachine(id: string): Promise<void> {
  const cleanId = String(id || '').trim();
  if (!cleanId) {
    throw new Error('Se requiere el identificador de la maquinaria para eliminarla.');
  }
  const payload = { id: cleanId, maquinariaId: cleanId, deleted: true };
  let res: any;
  try {
    res = await callGAS<any>('machine.delete', payload);
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    const isUnknownAction =
      msg.includes('acción no reconocida') ||
      msg.includes('accion no reconocida') ||
      msg.includes('unknown action');
    if (isUnknownAction) {
      res = await callGAS<any>('machine.save', payload);
    } else {
      throw err;
    }
  }
  if (res && res.ok === false) {
    throw new Error(res.error || 'No se pudo eliminar la maquinaria en el servidor.');
  }
  invalidateBackendDomains(['catalog.', 'machineType.', 'machineJobType.', 'asset.']);
}

// -------------------------------------------------------------
// 4.1 Machine Job Types (Tipos de Trabajo y Tarifas por Máquina)
// -------------------------------------------------------------

/**
 * Identifies virtual machine-only work labels ("Tractor solo", "Máquina sola")
 * that must NOT be treated as physical implements.
 * Historical job records referencing these labels are preserved untouched.
 */
export function isVirtualMachineOnlyImplement(name?: string | null): boolean {
  const n = String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return n === 'tractor solo' || n === 'maquina sola';
}

export async function getMachineTypes(useCache = true): Promise<string[]> {
  const res = await callGAS<any>('machineType.list', {}, useCache);
  const rawList = extractArrayFromResponse(res, [
    'machineTypes',
    'tiposMaquinaria',
    'tipos',
    'items',
    'result',
  ]);
  const set = new Set<string>();
  for (const entry of rawList) {
    if (typeof entry === 'string' && entry.trim()) {
      set.add(entry.trim());
    } else if (entry && typeof entry === 'object') {
      const label = String(entry.nombre || entry.Nombre || entry.tipo || entry.Tipo || '').trim();
      if (label) set.add(label);
    }
  }
  return Array.from(set);
}

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
  const tipoMaq = String(raw.tipoMaquina || raw.tipo_maquina || raw.machineType || '').trim();
  return {
    id: String(raw.id || raw.ID || `mjt_${Math.random().toString(36).substr(2, 6)}`),
    maquinaId: String(raw.maquinaId || raw.maquinariaId || raw.maquina_id || ''),
    ...(tipoMaq ? { tipoMaquina: tipoMaq } : {}),
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
    const res = await callGAS<any>('machineJobType.list', maquinaId ? { maquinaId } : {}, useCache);
    list = extractArrayFromResponse(res, [
      'machineJobTypes',
      'trabajosMaquinaria',
      'jobTypes',
      'items',
      'result',
      'trabajos',
    ]);
  } catch {
    // Fallback to catalog.list if machineJobType.list is unavailable
  }

  if (list.length === 0) {
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
      // empty list
    }
  }

  const normalized = list.map(normalizeMachineJobType);

  if (maquinaId) {
    return normalized.filter((j) => String(j.maquinaId) === String(maquinaId));
  }
  return normalized;
}

export async function saveMachineJobType(
  jobType: Partial<MachineJobType> & { nombre: string; maquinaId: string; tipoMaquina?: string }
): Promise<MachineJobType> {
  const rawU = String(jobType.unidad || 'ha').toLowerCase();
  const codeUnidad: 'hora' | 'ha' = (rawU.includes('hora') || rawU === 'h') ? 'hora' : 'ha';
  const tarifaNum = parseDecimalNumber(jobType.tarifa);
  const rawMon = String(jobType.moneda || 'USD').toUpperCase();
  const monedaVal: Currency = (rawMon === 'BOB' || rawMon === 'BS') ? 'BOB' : 'USD';

  const jobTypeData = {
    ...jobType,
    nombre: jobType.nombre.trim(),
    maquinaId: jobType.maquinaId,
    ...(jobType.tipoMaquina ? { tipoMaquina: jobType.tipoMaquina.trim() } : {}),
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
  invalidateBackendDomains(['catalog.', 'machineJobType.', 'asset.']);
  return normalizeMachineJobType(res?.result || res || jobTypeData);
}

export async function deleteMachineJobType(id: string): Promise<void> {
  const cleanId = String(id || '').trim();
  if (!cleanId) {
    throw new Error('Se requiere el identificador del implemento para eliminarlo.');
  }
  const payload = { id: cleanId, deleted: true, action: 'delete' };
  const res = await callGAS<any>('machineJobType.delete', payload);
  if (res && res.ok === false) {
    throw new Error(res.error || 'No se pudo eliminar el implemento en el servidor.');
  }
  invalidateBackendDomains(['catalog.', 'machineJobType.', 'machineType.', 'asset.']);
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
  const valPat = parseDecimalNumber(lot.valorPatrimonial);
  const lotData = {
    ...lot,
    nombre: String(lot.nombre || '').trim(),
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
    ...(valPat > 0 ? { valorPatrimonial: valPat, valorTotalUsd: valPat } : {}),
  };

  const payload = {
    ...lotData,
    lot: lotData,
    lote: lotData,
  };

  const res = await callGAS<any>('lot.save', payload, false);
  if (!res || (typeof res === 'object' && res.ok === false)) {
    throw new Error(res?.error || 'El backend de Google Sheets no confirmó la creación del lote.');
  }

  invalidateBackendDomains(['catalog.', 'asset.']);
  const created = normalizeLot(res);
  if (valPat > 0 && created.id) {
    await upsertAssetForEntity(created.id, 'LOTE', created.nombre, valPat);
  }
  return {
    ...created,
    valorPatrimonial: valPat > 0 ? valPat : created.valorPatrimonial,
  };
}

export async function updateLot(id: string, lot: Partial<Lot>): Promise<Lot> {
  const supNum = parseDecimalNumber(lot.superficieHectareas);
  const valPat = lot.valorPatrimonial !== undefined ? parseDecimalNumber(lot.valorPatrimonial) : undefined;
  const { id: _, ...restLot } = lot as any;
  const lotData = {
    id,
    ...restLot,
    nombre: String(lot.nombre || '').trim(),
    superficie: supNum,
    superficieHectareas: supNum,
    hectareas: supNum,
    ha: supNum,
    cantidad: supNum,
    area: supNum,
    cultivoActual: lot.cultivoActual || '',
    ubicacion: lot.ubicacion || '',
    observaciones: lot.observaciones || '',
    ...(valPat !== undefined ? { valorPatrimonial: valPat, valorTotalUsd: valPat } : {}),
  };

  const payload = {
    id,
    loteId: id,
    ...lotData,
    lot: lotData,
    lote: lotData,
  };

  const res = await callGAS<any>('lot.save', payload, false);
  if (!res || (typeof res === 'object' && res.ok === false)) {
    throw new Error(res?.error || 'El backend de Google Sheets no confirmó la actualización del lote.');
  }

  invalidateBackendDomains(['catalog.', 'asset.']);

  // Synchronously await asset sync
  if (valPat !== undefined && id) {
    await upsertAssetForEntity(id, 'LOTE', lot.nombre || res?.nombre || '', valPat);
  }

  const updated = normalizeLot(res);

  // Verification step: verify fresh persistence in Google Sheets
  const freshLots = await getLots(false);
  const found = freshLots.find((l) => l.id === id);

  if (!found) {
    throw new Error(
      `No se pudo verificar el lote "${lotData.nombre}" en Google Sheets tras guardar los cambios.`
    );
  }

  return {
    ...found,
    valorPatrimonial: valPat !== undefined ? valPat : (found.valorPatrimonial ?? updated.valorPatrimonial),
  };
}

export async function deleteLot(id: string): Promise<void> {
  const payload = { id, deleted: true, action: 'delete' };
  await callGAS('lot.save', payload);
  invalidateBackendDomains(['catalog.', 'asset.']);
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
    clienteId: raw.clienteId ? String(raw.clienteId).trim() : '',
    cliente: String(raw.cliente || raw.clienteNombre || ''),
    clientePendiente:
      raw.clientePendiente === true ||
      String(raw.clientePendiente || '').toUpperCase() === 'TRUE' ||
      String(raw.clientePendiente || '').toUpperCase() === 'SI',
    plazoDias:
      raw.plazoDias !== undefined && raw.plazoDias !== '' && raw.plazoDias !== null
        ? parseDecimalNumber(raw.plazoDias)
        : undefined,
    fechaVencimiento: raw.fechaVencimiento ? formatDateDDMMAAAA(raw.fechaVencimiento) : '',
    aplicarInteres:
      raw.aplicarInteres === true ||
      String(raw.aplicarInteres || '').toUpperCase() === 'TRUE' ||
      String(raw.aplicarInteres || '').toUpperCase() === 'SI',
    tasaInteresMensual:
      raw.tasaInteresMensual !== undefined && raw.tasaInteresMensual !== '' && raw.tasaInteresMensual !== null
        ? parseDecimalNumber(raw.tasaInteresMensual)
        : undefined,
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
    creadoEn: raw.creadoEn ? String(raw.creadoEn) : undefined,
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
    implementoId: job.trabajoTipoId || '',
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
    ...(job.clienteId ? { clienteId: job.clienteId } : {}),
    ...(job.cliente ? { cliente: job.cliente } : {}),
    ...(job.clientePendiente !== undefined ? { clientePendiente: Boolean(job.clientePendiente) } : {}),
    ...(job.tipoTrabajo === 'tercero'
      ? {
          plazoDias: job.plazoDias !== undefined ? Number(job.plazoDias) : '',
          fechaVencimiento: job.fechaVencimiento || '',
          aplicarInteres: Boolean(job.aplicarInteres),
          tasaInteresMensual: job.aplicarInteres ? Number(job.tasaInteresMensual || 0) : 0,
        }
      : {
          clienteId: '',
          clientePendiente: false,
          plazoDias: '',
          fechaVencimiento: '',
          aplicarInteres: false,
          tasaInteresMensual: 0,
        }),
    cantidad: cantNum,
    tarifa: tarifaNum,
    precio: tarifaNum,
    precioUnitario: tarifaNum,
    importe: totalNum,
    total: totalNum,
    moneda: job.moneda === 'USD' ? 'USD' : 'BOB',
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
  invalidateBackendDomains(['work.', 'movement.', 'cobros.', 'ar.', 'report.']);
  return {
    ...job,
    id: res?.id || res?.result?.id || `job_${Date.now()}`,
    total: totalNum,
    observacion: finalObs,
  };
}

export async function updateMachineryJob(
  id: string,
  job: Partial<MachineryJob>
): Promise<MachineryJob & { cuenta?: CobroCuenta | null }> {
  const rawU = String(job.unidad || '').toLowerCase();
  const codeUnidad: 'hora' | 'ha' = rawU.includes('hora') || rawU === 'h' ? 'hora' : 'ha';
  const hasCant = job.cantidad !== undefined;
  const cantNum = hasCant ? parseDecimalNumber(job.cantidad) : undefined;
  const hasTarifa = job.tarifa !== undefined;
  const tarifaNum = hasTarifa ? parseDecimalNumber(job.tarifa) : undefined;
  const gasMoneda = job.moneda ? (job.moneda === 'USD' ? 'USD' : 'BOB') : undefined;
  const hasExplicitTc = job.tipoCambio !== undefined || job.tc !== undefined;
  const tcRaw = job.tipoCambio !== undefined ? job.tipoCambio : job.tc;
  const tcNum = hasExplicitTc ? resolveEffectiveExchangeRate(tcRaw) : undefined;
  const { id: _, ...restJob } = job as any;

  let finalObs = job.observacion;
  if (job.trabajoNombre && finalObs !== undefined && !finalObs.includes('[Trabajo:')) {
    finalObs = finalObs ? `${finalObs} [Trabajo: ${job.trabajoNombre}]` : `[Trabajo: ${job.trabajoNombre}]`;
  }

  const jobData = {
    id,
    ...restJob,
    ...(job.campanaId !== undefined ? { campanaId: job.campanaId } : {}),
    ...(job.maquinariaId ? { maquinaId: job.maquinariaId, maquinariaId: job.maquinariaId } : {}),
    ...(job.tipoTrabajo
      ? { destino: job.tipoTrabajo === 'propiedad' ? 'PROPIEDAD' : 'TERCERO', tipoTrabajo: job.tipoTrabajo }
      : {}),
    ...(job.trabajoTipoId !== undefined
      ? { implementoId: job.trabajoTipoId || '', trabajoTipoId: job.trabajoTipoId || '' }
      : {}),
    ...(job.trabajoNombre !== undefined
      ? { trabajoNombre: job.trabajoNombre, labor: job.trabajoNombre, trabajo: job.trabajoNombre }
      : {}),
    ...(job.tipoTrabajo === 'propiedad'
      ? {
          loteId: job.loteId || '',
          loteNombre: job.loteNombre || '',
          cliente: '',
          clienteId: '',
          clientePendiente: false,
          plazoDias: '',
          fechaVencimiento: '',
          aplicarInteres: false,
          tasaInteresMensual: 0,
        }
      : job.tipoTrabajo === 'tercero'
      ? {
          cliente: job.cliente || '',
          clienteId: job.clienteId || '',
          clientePendiente: Boolean(job.clientePendiente),
          ...(job.plazoDias !== undefined ? { plazoDias: Number(job.plazoDias) } : {}),
          ...(job.fechaVencimiento !== undefined ? { fechaVencimiento: job.fechaVencimiento } : {}),
          ...(job.aplicarInteres !== undefined ? { aplicarInteres: Boolean(job.aplicarInteres) } : {}),
          ...(job.tasaInteresMensual !== undefined ? { tasaInteresMensual: Number(job.tasaInteresMensual) } : {}),
          loteId: '',
          loteNombre: '',
        }
      : {}),
    unidad: codeUnidad,
    unidadCobro: codeUnidad,
    ...(cantNum !== undefined && cantNum > 0 ? { cantidad: cantNum } : {}),
    ...(tarifaNum !== undefined
      ? { tarifa: tarifaNum, precio: tarifaNum, precioUnitario: tarifaNum }
      : {}),
    ...(cantNum !== undefined && tarifaNum !== undefined
      ? { importe: Number((cantNum * tarifaNum).toFixed(2)), total: Number((cantNum * tarifaNum).toFixed(2)) }
      : {}),
    ...(gasMoneda ? { moneda: gasMoneda } : {}),
    ...(tcNum !== undefined && tcNum > 0 ? { tc: tcNum, tipoCambio: tcNum } : {}),
    ...(finalObs !== undefined ? { observacion: finalObs, observaciones: finalObs } : {}),
  };

  const payload = {
    id,
    ...jobData,
    job: jobData,
    trabajo: jobData,
  };

  let res: any;
  try {
    res = await callGAS<any>('work.update', payload);
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('acción no reconocida') || msg.includes('accion no reconocida') || msg.includes('unknown action')) {
      res = await callGAS<any>('work.save', payload);
    } else {
      throw err;
    }
  }

  invalidateBackendDomains(['work.', 'movement.', 'cobros.', 'ar.', 'report.']);
  const cuentaRaw = res?.cuenta || res?.result?.cuenta;
  return {
    ...(job as any),
    id: res?.id || res?.result?.id || id,
    observacion: finalObs !== undefined ? finalObs : (job as any).observacion,
    cuenta: cuentaRaw ? normalizeCobroCuenta({ ...cuentaRaw, trabajoId: cuentaRaw.trabajoId || id }) : null,
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
  invalidateBackendDomains(['work.', 'movement.', 'cobros.', 'ar.', 'report.']);
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
        creadoEn: e.creadoEn ? String(e.creadoEn) : undefined,
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
  invalidateBackendDomains(['movement.', 'report.']);
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
  const tcNum = expense.tipoCambio !== undefined ? parseDecimalNumber(expense.tipoCambio) : undefined;
  const totalNum =
    expense.total !== undefined
      ? parseDecimalNumber(expense.total)
      : (cantNum !== undefined && precioNum !== undefined ? cantNum * precioNum : undefined);

  const gasModulo = expense.modulo
    ? (expense.modulo === 'propiedad' ? 'PROPIEDAD' : 'MAQUINARIAS')
    : undefined;

  const payload: Record<string, any> = {
    id,
    movimientoId: id,
    clase: 'GASTO',
    tipo: 'gasto',
    ...(gasModulo ? { modulo: gasModulo } : {}),
    ...(expense.fecha ? { fecha: expense.fecha } : {}),
    ...(expense.campanaId ? { campanaId: expense.campanaId } : {}),
    ...(expense.itemGasto ? { descripcion: expense.itemGasto, item: expense.itemGasto, itemGasto: expense.itemGasto } : {}),
    ...(cantNum !== undefined ? { cantidad: cantNum } : {}),
    ...(expense.unidad !== undefined ? { unidad: expense.unidad } : {}),
    ...(precioNum !== undefined ? { precioUnitario: precioNum, precio: precioNum } : {}),
    ...(totalNum !== undefined ? { importe: totalNum, total: totalNum } : {}),
    ...(gasMoneda ? { moneda: gasMoneda } : {}),
    ...(tcNum !== undefined && tcNum > 0 ? { tc: tcNum, tipoCambio: tcNum } : {}),
    ...(expense.observacion !== undefined ? { observaciones: expense.observacion, observacion: expense.observacion } : {}),
    ...(expense.loteId !== undefined ? { loteId: expense.loteId } : {}),
    ...(expense.maquinariaId !== undefined ? { maquinaId: expense.maquinariaId, maquinariaId: expense.maquinariaId } : {}),
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

  invalidateBackendDomains(['movement.', 'report.']);
  return {
    ...(expense as any),
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
  invalidateBackendDomains(['movement.', 'report.']);
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
        itemId: i.itemId ? String(i.itemId).trim() : undefined,
        concepto: String(i.descripcion || i.concepto || i.item || 'Ingreso Cosecha'),
        icono: i.icono || i.Icono || undefined,
        cantidad: cant,
        unidad: String(i.unidad || ''),
        precio: prec,
        moneda: mon,
        tipoCambio: parseDecimalNumber(i.tc ?? i.tipoCambio ?? getConfiguredExchangeRate() ?? 0),
        total: tot,
        observacion: String(i.observaciones || i.observacion || ''),
        esTrabajoPropio: Boolean(
          i.esTrabajoPropio ||
            (i.trabajoId &&
              !String(i.trabajoId).trim().toUpperCase().startsWith('COSECHA:') &&
              !String(i.trabajoId).trim().toUpperCase().startsWith('INTERES_COBRO:'))
        ),
        trabajoId: i.trabajoId || undefined,
        creadoEn: i.creadoEn ? String(i.creadoEn) : undefined,
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
  invalidateBackendDomains(['movement.', 'report.']);
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

  invalidateBackendDomains(['movement.', 'report.']);
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
  invalidateBackendDomains(['movement.', 'report.']);
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
  invalidateBackendDomains(['catalog.', 'getItemsConfig']);
  return {
    id: res?.id || res?.result?.id || item.id || `itm_${Date.now()}`,
    nombre: item.nombre,
    modulo: gasModulo as any,
    clase: gasClase as any,
    tipo:
      gasModulo === 'MAQUINARIAS'
        ? gasClase === 'INGRESO'
          ? 'ingreso_maquinaria'
          : 'gasto_maquinaria'
        : gasClase === 'INGRESO'
        ? 'ingreso_propiedad'
        : 'gasto_propiedad',
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
    const rawMejoras = Array.isArray(a.mejoras) ? a.mejoras : [];
    const normalizedMejoras: AssetImprovement[] = rawMejoras.map((m: any, idx: number) => ({
      id: String(m.id || m.mejoraId || `imp_${a.id}_${idx + 1}`),
      activoId: String(m.activoId || a.id || ''),
      fecha: String(m.fecha || new Date().toISOString().slice(0, 10)),
      descripcion: String(m.descripcion || m.detalle || 'Mejora'),
      costo: parseDecimalNumber(m.importe ?? m.costo ?? 0),
      moneda: (String(m.moneda || 'USD').toUpperCase().includes('BOB') ? 'BOB' : 'USD') as Currency,
    }));
    const sumMejoras = normalizedMejoras.reduce((acc: number, m: AssetImprovement) => acc + m.costo, 0);

    let rawTipo = String(a.tipo || '').toUpperCase();
    let normTipo: 'MAQUINARIA' | 'LOTE' | 'IMPLEMENTO' | 'OTRO' = 'MAQUINARIA';
    if (rawTipo.includes('LOT') || rawTipo.includes('TERREN') || rawTipo.includes('CAMP')) {
      normTipo = 'LOTE';
    } else if (rawTipo.includes('IMP')) {
      normTipo = 'IMPLEMENTO';
    } else if (rawTipo.includes('OTR') || rawTipo.includes('INFRA') || rawTipo.includes('SILO')) {
      normTipo = 'OTRO';
    }

    const refId = String(a.referenciaId || a.referencia_id || a.identificador || '');

    return {
      id: String(a.id || `ast_${Math.random().toString(36).substr(2, 6)}`),
      tipo: normTipo,
      nombre: String(a.nombre || 'Activo'),
      identificador: refId,
      referenciaId: refId,
      icono: a.icono ? String(a.icono).trim() : undefined,
      valorInicial: valIni,
      moneda: mon,
      fechaAdquisicion: String(a.fecha || a.fechaAdquisicion || '').slice(0, 10),
      valorAcumulado: valIni + sumMejoras,
      mejoras: normalizedMejoras,
      activo: a.activo !== false,
    };
  });
}

export async function createAsset(asset: Omit<Asset, 'id' | 'valorAcumulado' | 'mejoras'>): Promise<Asset> {
  let gasTipo: 'MAQUINARIA' | 'LOTE' | 'IMPLEMENTO' | 'OTRO' = 'MAQUINARIA';
  const rawTipo = String(asset.tipo || '').toUpperCase();
  if (rawTipo.includes('LOT') || rawTipo.includes('TERREN') || rawTipo.includes('CAMP')) {
    gasTipo = 'LOTE';
  } else if (rawTipo.includes('IMP')) {
    gasTipo = 'IMPLEMENTO';
  } else if (rawTipo.includes('OTR') || rawTipo.includes('INFRA') || rawTipo.includes('SILO')) {
    gasTipo = 'OTRO';
  } else {
    gasTipo = 'MAQUINARIA';
  }

  const valNum = parseDecimalNumber(asset.valorInicial);
  const gasMoneda = (asset.moneda === 'USD' ? 'USD' : 'BS');
  const tcNum = resolveEffectiveExchangeRate();
  const refId = asset.referenciaId || asset.identificador || '';

  const payload: Record<string, any> = {
    tipo: gasTipo,
    nombre: asset.nombre.trim(),
    referenciaId: refId,
    identificador: refId,
    valorInicial: valNum,
    importe: valNum,
    total: valNum,
    moneda: gasMoneda,
    tc: tcNum,
    tipoCambio: tcNum,
    fecha: asset.fechaAdquisicion || new Date().toISOString().slice(0, 10),
    fechaAdquisicion: asset.fechaAdquisicion || new Date().toISOString().slice(0, 10),
    ...(asset.icono ? { icono: asset.icono } : {}),
  };

  const res = await callGAS<any>('asset.save', payload);
  invalidateBackendDomains(['asset.', 'catalog.']);
  return {
    ...asset,
    id: res?.id || res?.result?.id || `ast_${Date.now()}`,
    valorAcumulado: valNum,
    mejoras: [],
  };
}

export async function updateAsset(id: string, asset: Partial<Asset>): Promise<any> {
  const payload: Record<string, any> = {
    id,
    assetId: id,
    ...(asset.nombre ? { nombre: asset.nombre.trim() } : {}),
    ...(asset.tipo ? { tipo: String(asset.tipo).toUpperCase() } : {}),
    ...(asset.referenciaId ? { referenciaId: asset.referenciaId } : {}),
    ...(asset.valorInicial !== undefined ? { valorInicial: parseDecimalNumber(asset.valorInicial) } : {}),
    ...(asset.moneda ? { moneda: asset.moneda } : {}),
    asset,
  };

  let res: any;
  try {
    res = await callGAS<any>('updateAsset', payload);
  } catch {
    try {
      res = await callGAS<any>('asset.update', payload);
    } catch {
      res = await callGAS<any>('asset.save', payload);
    }
  }
  invalidateBackendDomains(['asset.', 'catalog.']);
  return res;
}

export async function addAssetImprovement(
  assetId: string,
  improvement: { fecha: string; descripcion: string; costo: number; moneda: 'BOB' | 'USD' }
): Promise<Asset> {
  const impData = {
    fecha: improvement.fecha,
    descripcion: improvement.descripcion.trim(),
    costo: parseDecimalNumber(improvement.costo),
    importe: parseDecimalNumber(improvement.costo),
    moneda: improvement.moneda || 'USD',
  };
  const payload = { assetId, id: assetId, improvement: impData, ...impData };
  let res: any;
  try {
    res = await callGAS<any>('addAssetImprovement', payload);
  } catch {
    try {
      res = await callGAS<any>('asset.improvement.add', payload);
    } catch {
      res = await callGAS<any>('asset.save', payload);
    }
  }
  invalidateBackendDomains(['asset.', 'catalog.']);
  return res;
}

export async function updateAssetImprovement(
  mejoraId: string,
  improvement: { fecha: string; descripcion: string; costo: number; moneda?: Currency; assetId?: string }
): Promise<any> {
  const impData = {
    id: mejoraId,
    fecha: improvement.fecha,
    descripcion: improvement.descripcion.trim(),
    costo: parseDecimalNumber(improvement.costo),
    importe: parseDecimalNumber(improvement.costo),
    moneda: improvement.moneda || 'USD',
  };
  const payload = {
    ...impData,
    mejoraId,
    assetId: improvement.assetId,
    action: 'update_improvement',
    updateImprovement: true,
    improvement: impData,
  };

  let res: any;
  try {
    res = await callGAS<any>('updateAssetImprovement', payload);
  } catch {
    try {
      res = await callGAS<any>('asset.improvement.update', payload);
    } catch {
      res = await callGAS<any>('asset.save', payload);
    }
  }
  invalidateBackendDomains(['asset.', 'catalog.']);
  return res;
}

export async function deleteAssetImprovement(mejoraId: string, assetId?: string): Promise<any> {
  const payload = {
    id: mejoraId,
    mejoraId,
    assetId,
    action: 'delete_improvement',
    deleteImprovement: true,
  };

  let res: any;
  try {
    res = await callGAS<any>('deleteAssetImprovement', payload);
  } catch {
    try {
      res = await callGAS<any>('asset.improvement.delete', payload);
    } catch {
      res = await callGAS<any>('asset.save', payload);
    }
  }
  invalidateBackendDomains(['asset.', 'catalog.']);
  return res;
}

export async function upsertAssetForEntity(
  referenciaId: string,
  tipo: 'MAQUINARIA' | 'LOTE' | 'IMPLEMENTO',
  nombre: string,
  valorPatrimonial?: number,
  icono?: string
): Promise<void> {
  const val = parseDecimalNumber(valorPatrimonial);
  try {
    const assets = await getAssets(false);
    const existing = assets.find(
      (a) =>
        (a.referenciaId && a.referenciaId === referenciaId) ||
        (a.identificador && a.identificador === referenciaId) ||
        (a.nombre && a.nombre.trim().toLowerCase() === nombre.trim().toLowerCase() && a.tipo === tipo)
    );

    if (existing) {
      await updateAsset(existing.id, {
        referenciaId,
        nombre: nombre.trim(),
        tipo,
        valorInicial: val !== undefined ? val : existing.valorInicial,
        moneda: 'USD',
      });
    } else if (val > 0) {
      await createAsset({
        tipo,
        nombre: nombre.trim(),
        identificador: referenciaId,
        referenciaId,
        icono,
        valorInicial: val,
        moneda: 'USD',
        fechaAdquisicion: new Date().toISOString().slice(0, 10),
      });
    }
  } catch (err) {
    console.warn('[upsertAssetForEntity] Warning:', err);
  }
}

export async function upsertAssetForImplement(
  referenciaId: string,
  nombre: string,
  valorPatrimonial?: number,
  icono?: string
): Promise<void> {
  return upsertAssetForEntity(referenciaId, 'IMPLEMENTO', nombre, valorPatrimonial, icono);
}

// -------------------------------------------------------------
// 11. Exchange Rate (Tipo de Cambio Oficial BCB + Ajuste Manual)
// -------------------------------------------------------------

const FX_AUTO_SYNC_STORAGE_KEY = 'myp_fx_auto_sync_meta';
let inFlightAutoSync: Promise<ExchangeRateConfig | null> | null = null;

function normalizeDateToYmd(raw?: string | Date | null): string {
  if (!raw) return '';
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? '' : getBoliviaDateString(raw);
  }
  const s = String(raw).trim();
  if (!s) return '';
  const ymd = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (ymd) return ymd[1];
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return getBoliviaDateString(parsed);
  return s;
}

function normalizeExchangeRateResponse(res: any): ExchangeRateConfig | null {
  if (!res || typeof res !== 'object') return null;
  const src = res.exchangeRate && typeof res.exchangeRate === 'object' ? res.exchangeRate : res;
  const tasa = parseDecimalNumber(src.tasaBobPerUsd ?? src.tasa ?? src.tc ?? src.rate);
  if (tasa <= 0) return null;

  const todayBo = getBoliviaDateString();
  const rawModo = String(src.modo ?? src.fuente ?? '').trim().toLowerCase();
  const isManual = rawModo === 'manual';
  const fuente: 'manual' | 'bcb' = isManual ? 'manual' : 'bcb';

  const fechaActualizacion = normalizeDateToYmd(src.fechaActualizacion ?? src.fecha) || todayBo;
  const ultimaConsultaDia = normalizeDateToYmd(src.ultimaConsultaDia);
  const ultimaConsulta = String(src.ultimaConsulta || '').trim();
  const rawEstado = String(src.estado || '').trim().toLowerCase();
  const rawFuenteDetalle = String(src.fuenteDetalle || '').trim();

  // Official BCB is ONLY confirmed when an official BCB query has actually succeeded.
  // Never present an unverified stored value from prior configuration as "BCB (Oficial)".
  const isBcbConfirmed =
    fuente === 'bcb' &&
    Boolean(ultimaConsulta || ultimaConsultaDia) &&
    (rawEstado === 'actualizado' || rawFuenteDetalle.toLowerCase().includes('bcb'));

  const fechaCotizacion = normalizeDateToYmd(src.fechaCotizacion) || (isBcbConfirmed ? fechaActualizacion : '');
  const fechaCorte = normalizeDateToYmd(src.fechaCorte);

  let estado: ExchangeRateStatus;
  if (fuente === 'manual') {
    estado = 'manual';
  } else if (
    isBcbConfirmed &&
    (!ultimaConsultaDia || ultimaConsultaDia === todayBo) &&
    rawEstado !== 'sin_conexion' &&
    rawEstado !== 'pendiente'
  ) {
    estado = 'actualizado';
  } else if (rawEstado === 'sin_conexion') {
    estado = 'sin_conexion';
  } else {
    estado = 'pendiente';
  }

  const fuenteDetalle =
    fuente === 'manual'
      ? 'Ajuste manual'
      : isBcbConfirmed
      ? 'BCB (Oficial)'
      : 'Valor guardado';

  return {
    tasaBobPerUsd: tasa,
    fuente,
    fechaActualizacion,
    fechaCotizacion: fechaCotizacion || undefined,
    fechaCorte: fechaCorte || undefined,
    ultimaConsulta: ultimaConsulta || undefined,
    ultimaConsultaDia: ultimaConsultaDia || undefined,
    estado,
    fuenteDetalle,
    errorMensaje: src.errorMensaje ? String(src.errorMensaje).trim() : undefined,
    nota: src.nota ? String(src.nota).trim() : '',
  };
}

export async function getExchangeRateConfig(useCache = true): Promise<ExchangeRateConfig> {
  try {
    const res = await callGAS<any>('fx.get', {}, useCache);
    const normalized = normalizeExchangeRateResponse(res);
    if (normalized) {
      setConfiguredExchangeRate(normalized.tasaBobPerUsd);
      return normalized;
    }
  } catch {
    // fallback to catalog.list
  }

  try {
    const res = await callGAS<any>('catalog.list', {}, useCache);
    const normalized = normalizeExchangeRateResponse(res);
    if (normalized) {
      setConfiguredExchangeRate(normalized.tasaBobPerUsd);
      return normalized;
    }
  } catch {
    // fallback
  }

  const existingRate = getConfiguredExchangeRate();
  return {
    tasaBobPerUsd: existingRate > 0 ? existingRate : 0,
    fuente: 'bcb',
    fuenteDetalle: 'Valor guardado',
    fechaActualizacion: getBoliviaDateString(),
    estado: typeof navigator !== 'undefined' && navigator.onLine === false ? 'sin_conexion' : 'pendiente',
  };
}

/**
 * Non-blocking daily automatic sync against official BCB through Google Apps Script.
 * - Never overwrites a manual override (fuente === 'manual').
 * - Runs at most once per Bolivia calendar day (America/La_Paz), with short failure cooldown.
 * - Never throws or replaces a valid stored rate with zero.
 */
export async function syncExchangeRateDailyAuto(
  currentRate?: ExchangeRateConfig | null
): Promise<ExchangeRateConfig | null> {
  if (!getActiveSession()) return null;

  const todayBo = getBoliviaDateString();

  // Never silently override manual adjustment
  if (currentRate?.fuente === 'manual') {
    return null;
  }

  // Already successfully checked today in Bolivia timezone
  if (currentRate?.ultimaConsultaDia === todayBo && (currentRate?.tasaBobPerUsd || 0) > 0) {
    return null;
  }

  // Offline check
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return currentRate
      ? { ...currentRate, estado: 'sin_conexion' }
      : null;
  }

  // Client-side cooldown to prevent repeated redundant calls on reloads/tabs
  try {
    const rawMeta = localStorage.getItem(FX_AUTO_SYNC_STORAGE_KEY);
    if (rawMeta) {
      const meta = JSON.parse(rawMeta) as { day?: string; status?: string; ts?: number };
      if (meta.day === todayBo && meta.status === 'ok') {
        return null;
      }
      if (meta.day === todayBo && meta.status === 'err' && meta.ts && Date.now() - meta.ts < 10 * 60 * 1000) {
        return null;
      }
    }
  } catch {
    // Ignore storage access errors
  }

  if (inFlightAutoSync) {
    return inFlightAutoSync;
  }

  inFlightAutoSync = (async () => {
    try {
      const res = await callGAS<any>('fx.syncAuto', {}, false);
      const normalized = normalizeExchangeRateResponse(res);
      if (normalized && normalized.tasaBobPerUsd > 0) {
        setConfiguredExchangeRate(normalized.tasaBobPerUsd);
        clearMemoryCache('fx.get');
        clearMemoryCache('catalog.list');

        const syncedOk = !res?.syncFailed && normalized.estado === 'actualizado';
        try {
          localStorage.setItem(
            FX_AUTO_SYNC_STORAGE_KEY,
            JSON.stringify({ day: todayBo, status: syncedOk ? 'ok' : 'err', ts: Date.now() })
          );
        } catch {
          // Ignore storage error
        }
        return normalized;
      }
      return null;
    } catch (err: any) {
      const msg = String(err?.message || '');
      const isOffline =
        (typeof navigator !== 'undefined' && navigator.onLine === false) ||
        /failed to fetch|network|offline|timeout/i.test(msg);

      try {
        localStorage.setItem(
          FX_AUTO_SYNC_STORAGE_KEY,
          JSON.stringify({ day: todayBo, status: 'err', ts: Date.now() })
        );
      } catch {
        // Ignore storage error
      }

      if (currentRate && currentRate.tasaBobPerUsd > 0) {
        return {
          ...currentRate,
          estado: isOffline ? 'sin_conexion' : 'pendiente',
        };
      }
      return null;
    } finally {
      inFlightAutoSync = null;
    }
  })();

  return inFlightAutoSync;
}

export interface BcbRefreshResult {
  config: ExchangeRateConfig;
  updated: boolean;
  alreadyLatest?: boolean;
  manualPreserved?: boolean;
  bcbPreviewRate?: number;
  bcbPreviewFecha?: string;
}

/**
 * Explicit admin refresh against official BCB via Google Apps Script (fx.refresh).
 * Requires existing administrative authorization.
 */
export async function refreshExchangeRateFromBcb(options?: {
  switchToOfficial?: boolean;
}): Promise<BcbRefreshResult> {
  const switchToOfficial = Boolean(options?.switchToOfficial);
  let res: any;
  try {
    res = await callGAS<any>('fx.refresh', { switchToOfficial }, false);
  } catch (err: any) {
    const rawMsg = String(err?.message || 'Error de comunicación con el backend');
    if (/acci[oó]n no reconocida/i.test(rawMsg)) {
      throw new Error(
        'El backend de Google Apps Script aún no tiene instalada la consulta automática al BCB (fx.refresh). Actualice Código.gs y despliegue una nueva versión del Web App.'
      );
    }
    throw new Error(rawMsg);
  }

  const normalized = normalizeExchangeRateResponse(res);
  if (!normalized || normalized.tasaBobPerUsd <= 0) {
    throw new Error('No se recibió una cotización oficial válida desde el backend.');
  }

  setConfiguredExchangeRate(normalized.tasaBobPerUsd);
  clearMemoryCache('fx.get');
  clearMemoryCache('catalog.list');

  try {
    const todayBo = getBoliviaDateString();
    if (normalized.estado === 'actualizado') {
      localStorage.setItem(
        FX_AUTO_SYNC_STORAGE_KEY,
        JSON.stringify({ day: todayBo, status: 'ok', ts: Date.now() })
      );
    }
  } catch {
    // Ignore storage error
  }

  const previewRate = parseDecimalNumber(res?.bcbPreviewRate);
  return {
    config: normalized,
    updated: Boolean(res?.updated),
    alreadyLatest: Boolean(res?.alreadyLatest),
    manualPreserved: Boolean(res?.manualPreserved),
    bcbPreviewRate: previewRate > 0 ? previewRate : undefined,
    bcbPreviewFecha: res?.bcbPreviewFecha ? normalizeDateToYmd(res.bcbPreviewFecha) : undefined,
  };
}

export async function saveExchangeRateConfig(config: {
  tasaBobPerUsd: number;
  nota?: string;
  fecha?: string;
}): Promise<ExchangeRateConfig> {
  const tcNum = parseDecimalNumber(config.tasaBobPerUsd);
  if (tcNum <= 0) {
    throw new Error('El tipo de cambio debe ser un número positivo mayor a 0.');
  }

  const boliviaDateStr = config.fecha ? normalizeDateToYmd(config.fecha) : getBoliviaDateString();

  const payload = {
    tasa: tcNum,
    tasaBobPerUsd: tcNum,
    tc: tcNum,
    rate: tcNum,
    modo: 'manual',
    fuente: 'manual',
    fecha: boliviaDateStr,
    fechaActualizacion: boliviaDateStr,
    fecha_actualizacion: boliviaDateStr,
    date: boliviaDateStr,
    nota: config.nota || 'Ajuste manual registrado por el administrador',
  };

  let res: any;
  try {
    res = await callGAS<any>('fx.set', payload);
  } catch (err: any) {
    throw new Error(`Error en el backend al guardar el tipo de cambio vía fx.set: ${err?.message || 'Error de comunicación'}`);
  }

  invalidateBackendDomains(['fx.', 'catalog.']);
  try {
    localStorage.removeItem(FX_AUTO_SYNC_STORAGE_KEY);
  } catch {
    // Ignore storage error
  }

  const normalized = normalizeExchangeRateResponse(res);
  if (normalized) {
    const finalConfig: ExchangeRateConfig = {
      ...normalized,
      fuente: 'manual',
      estado: 'manual',
      fuenteDetalle: 'Ajuste manual',
    };
    setConfiguredExchangeRate(finalConfig.tasaBobPerUsd);
    return finalConfig;
  }

  setConfiguredExchangeRate(tcNum);
  return {
    tasaBobPerUsd: tcNum,
    fuente: 'manual',
    fechaActualizacion: boliviaDateStr,
    estado: 'manual',
    fuenteDetalle: 'Ajuste manual',
    nota: config.nota || '',
  };
}

// -------------------------------------------------------------
// 12. Financial Reports (Acción administrativa report.get)
// -------------------------------------------------------------

export async function getFinancialReports(campanaId?: string, useCache = true): Promise<any> {
  return callGAS<any>('report.get', { campanaId }, useCache);
}

// -------------------------------------------------------------
// 13. Cobros (Cuentas por cobrar de servicios a clientes externos)
// -------------------------------------------------------------

function normalizeCurrencyCode(raw: any, fallback: Currency = 'BOB'): Currency {
  const s = String(raw || '').trim().toUpperCase();
  if (s === 'USD' || s === 'U$D' || s === 'US$' || s === '$') return 'USD';
  if (s === 'BOB' || s === 'BS' || s === 'BS.') return 'BOB';
  return fallback;
}

function normalizeCobroEstado(raw: any, importe: number, cobrado: number, saldo: number): CobroEstado {
  const s = String(raw || '').trim().toUpperCase();
  if (s === 'PAGADO' || s === 'COBRADO') return 'PAGADO';
  if (s === 'PARCIAL') return 'PARCIAL';
  if (s === 'PENDIENTE') return 'PENDIENTE';
  if (importe > 0 && saldo <= 0.005) return 'PAGADO';
  if (cobrado > 0 && saldo > 0.005) return 'PARCIAL';
  return 'PENDIENTE';
}

export function normalizeCobroPago(raw: any, fallbackTrabajoId = ''): CobroPago {
  if (!raw || typeof raw !== 'object') {
    return {
      id: '',
      trabajoId: fallbackTrabajoId,
      fecha: '',
      importe: 0,
    };
  }
  const importeUsdRaw =
    raw.importeUsd !== undefined && raw.importeUsd !== null && raw.importeUsd !== ''
      ? parseDecimalNumber(raw.importeUsd)
      : parseDecimalNumber(raw.importe ?? raw.monto ?? raw.total ?? 0);
  const monedaCobro = raw.monedaCobro
    ? normalizeCurrencyCode(raw.monedaCobro, 'USD')
    : raw.moneda
    ? normalizeCurrencyCode(raw.moneda, 'USD')
    : 'USD';
  const tcVal = parseDecimalNumber(raw.tc ?? raw.tipoCambio ?? 0);
  const importeOriginalRaw =
    raw.importeOriginal !== undefined && raw.importeOriginal !== null && raw.importeOriginal !== ''
      ? parseDecimalNumber(raw.importeOriginal)
      : monedaCobro === 'BOB' && tcVal > 0
      ? Number((importeUsdRaw * tcVal).toFixed(2))
      : importeUsdRaw;

  return {
    id: String(raw.id || raw.pagoId || raw.ID || `pag_${Math.random().toString(36).slice(2, 8)}`),
    trabajoId: String(raw.trabajoId || raw.trabajo_id || fallbackTrabajoId || ''),
    fecha: normalizeDateToYmd(raw.fecha) || String(raw.fecha || ''),
    importe: importeUsdRaw,
    moneda: raw.moneda ? normalizeCurrencyCode(raw.moneda, 'USD') : 'USD',
    importeOriginal: importeOriginalRaw,
    monedaCobro,
    tc: tcVal > 0 ? tcVal : undefined,
    importeUsd: importeUsdRaw,
    observacion: String(raw.observacion ?? raw.observaciones ?? raw.nota ?? '').trim(),
    creadoPor: raw.creadoPor ? String(raw.creadoPor) : undefined,
    creadoEn: raw.creadoEn ? String(raw.creadoEn) : undefined,
  };
}

export function normalizeCobroCuenta(raw: any): CobroCuenta {
  const src = raw && typeof raw === 'object' ? raw : {};
  const trabajoId = String(src.trabajoId || src.trabajo_id || src.id || src.ID || '');
  const importe = parseDecimalNumber(src.importe ?? src.total ?? src.importeOriginal ?? 0);
  const cobrado = parseDecimalNumber(src.cobrado ?? src.importeCobrado ?? src.pagado ?? 0);
  const saldoRaw = src.saldo !== undefined && src.saldo !== null && src.saldo !== ''
    ? parseDecimalNumber(src.saldo)
    : Math.max(0, Number((importe - cobrado).toFixed(2)));
  const saldo = Math.max(0, Number(saldoRaw.toFixed(2)));
  const moneda = normalizeCurrencyCode(src.moneda, 'USD');
  const estado = normalizeCobroEstado(src.estado, importe, cobrado, saldo);
  const rawPagos = Array.isArray(src.pagos) ? src.pagos : [];
  const pagos = rawPagos.map((p: any) => normalizeCobroPago(p, trabajoId));

  const importeOriginalServicio =
    src.importeOriginalServicio !== undefined && src.importeOriginalServicio !== null && src.importeOriginalServicio !== ''
      ? parseDecimalNumber(src.importeOriginalServicio)
      : undefined;
  const monedaOriginalServicio = src.monedaOriginalServicio
    ? normalizeCurrencyCode(src.monedaOriginalServicio, moneda)
    : undefined;
  const tcServicio = parseDecimalNumber(src.tcServicio ?? src.tc ?? src.tipoCambio ?? 0) || undefined;
  const precioUnitario =
    src.precioUnitario !== undefined && src.precioUnitario !== null && src.precioUnitario !== ''
      ? parseDecimalNumber(src.precioUnitario)
      : src.tarifa !== undefined && src.tarifa !== null && src.tarifa !== ''
      ? parseDecimalNumber(src.tarifa)
      : undefined;

  return {
    id: String(src.id || trabajoId),
    trabajoId,
    fecha: normalizeDateToYmd(src.fecha) || String(src.fecha || ''),
    campanaId: src.campanaId ? String(src.campanaId) : undefined,
    campanaNombre: src.campanaNombre || src.campana ? String(src.campanaNombre || src.campana) : undefined,
    cliente: String(src.cliente || src.clienteNombre || 'Cliente externo').trim(),
    maquinariaId: src.maquinariaId || src.maquinaId ? String(src.maquinariaId || src.maquinaId) : undefined,
    maquinariaNombre: src.maquinariaNombre || src.maquina ? String(src.maquinariaNombre || src.maquina) : undefined,
    implementoId: src.implementoId || src.trabajoTipoId ? String(src.implementoId || src.trabajoTipoId) : undefined,
    trabajoNombre: src.trabajoNombre || src.trabajo || src.labor || src.descripcion
      ? String(src.trabajoNombre || src.trabajo || src.labor || src.descripcion)
      : undefined,
    cantidad: src.cantidad !== undefined ? parseDecimalNumber(src.cantidad) : undefined,
    unidad: src.unidad ? String(src.unidad) : undefined,
    tarifa: precioUnitario,
    precioUnitario,
    importe,
    moneda,
    tipoCambio: tcServicio,
    importeOriginalServicio,
    monedaOriginalServicio,
    tcServicio,
    cobrado,
    saldo,
    estado,
    observacion: String(src.observacion ?? src.observaciones ?? '').trim(),
    pagos,
  };
}

export async function getCobros(
  options?: { campanaId?: string; soloPendientes?: boolean },
  useCache = false
): Promise<CobroCuenta[]> {
  const payload: Record<string, any> = {};
  if (options?.campanaId) payload.campanaId = options.campanaId;
  if (options?.soloPendientes !== undefined) payload.soloPendientes = options.soloPendientes;

  const res = await callGAS<any>('cobros.list', payload, useCache);
  const rawList = extractArrayFromResponse(res, ['cobros', 'cuentas', 'result', 'items']);
  return rawList.map(normalizeCobroCuenta);
}

export async function getCobroEstado(trabajoId: string, useCache = false): Promise<CobroCuenta> {
  if (!trabajoId || !trabajoId.trim()) {
    throw new Error('Se requiere el identificador del servicio (trabajoId) para consultar su estado de cobro.');
  }
  const res = await callGAS<any>('cobros.estado', { trabajoId: trabajoId.trim() }, useCache);
  const cuentaRaw = res?.cuenta || (res?.result && !Array.isArray(res.result) ? res.result : res);
  if (!cuentaRaw || typeof cuentaRaw !== 'object') {
    throw new Error('El backend no devolvió un estado de cobro válido.');
  }
  return normalizeCobroCuenta({ ...cuentaRaw, trabajoId: cuentaRaw.trabajoId || trabajoId });
}

export async function registrarCobro(params: {
  trabajoId: string;
  importe?: number;
  importeOriginal?: number;
  monedaCobro?: Currency;
  tc?: number;
  fecha: string;
  observacion?: string;
}): Promise<{ pago: CobroPago | null; cuenta: CobroCuenta | null }> {
  const importeOriginalNum = parseDecimalNumber(params.importeOriginal ?? params.importe);
  if (!params.trabajoId || !params.trabajoId.trim()) {
    throw new Error('Falta el identificador del servicio a cobrar.');
  }
  if (importeOriginalNum <= 0) {
    throw new Error('El importe del cobro debe ser mayor a 0.');
  }
  if (!params.fecha) {
    throw new Error('La fecha del cobro es obligatoria.');
  }

  const monedaNorm: Currency = params.monedaCobro === 'BOB' ? 'BOB' : 'USD';
  const tcNum = resolveEffectiveExchangeRate(params.tc);

  const payload = {
    trabajoId: params.trabajoId.trim(),
    importe: importeOriginalNum,
    importeOriginal: importeOriginalNum,
    monedaCobro: monedaNorm,
    moneda: monedaNorm,
    tc: tcNum,
    tipoCambio: tcNum,
    fecha: params.fecha,
    observacion: (params.observacion || '').trim(),
  };

  const res = await callGAS<any>('cobros.registrar', payload, false);
  invalidateBackendDomains(['cobros.']);

  const pagoRaw = res?.pago || res?.result?.pago;
  const cuentaRaw = res?.cuenta || res?.result?.cuenta;

  return {
    pago: pagoRaw ? normalizeCobroPago(pagoRaw, params.trabajoId) : null,
    cuenta: cuentaRaw ? normalizeCobroCuenta({ ...cuentaRaw, trabajoId: cuentaRaw.trabajoId || params.trabajoId }) : null,
  };
}

// -------------------------------------------------------------
// 14. Cosechas sin precio y fijación parcial/total de precios
// -------------------------------------------------------------

export function normalizeHarvestAssignment(raw: any, fallbackCosechaId = ''): HarvestPriceAssignment {
  const src = raw && typeof raw === 'object' ? raw : {};
  const toneladas = parseDecimalNumber(src.toneladas ?? src.cantidad ?? 0);
  const precioUsdTon = parseDecimalNumber(src.precioUsdTon ?? src.precio ?? src.precioUnitario ?? 0);
  const tc = parseDecimalNumber(src.tc ?? src.tipoCambio ?? 0);
  const totalUsd = parseDecimalNumber(src.totalUsd ?? src.importeUsd ?? src.importe ?? toneladas * precioUsdTon);
  const totalBob = parseDecimalNumber(src.totalBob ?? src.importeBob ?? (tc > 0 ? totalUsd * tc : 0));

  return {
    id: String(src.id || src.asignacionId || src.ID || `asig_${Math.random().toString(36).slice(2, 8)}`),
    cosechaId: String(src.cosechaId || src.cosecha_id || fallbackCosechaId || ''),
    fecha: normalizeDateToYmd(src.fecha) || String(src.fecha || ''),
    campanaId: src.campanaId ? String(src.campanaId) : undefined,
    toneladas,
    precioUsdTon,
    tc,
    totalUsd,
    totalBob: totalBob > 0 ? totalBob : undefined,
    movimientoId: src.movimientoId ? String(src.movimientoId) : undefined,
    observacion: String(src.observacion ?? src.observaciones ?? '').trim() || undefined,
    creadoEn: src.creadoEn ? String(src.creadoEn) : undefined,
  };
}

export function normalizeHarvestRecord(raw: any): HarvestRecord {
  const src = raw && typeof raw === 'object' ? raw : {};
  const id = String(src.id || src.cosechaId || src.ID || '');
  const toneladas = parseDecimalNumber(src.toneladas ?? src.toneladasTotales ?? src.cantidad ?? 0);
  const rawAsigs = Array.isArray(src.asignaciones)
    ? src.asignaciones
    : Array.isArray(src.precios)
    ? src.precios
    : [];
  const asignaciones: HarvestPriceAssignment[] = rawAsigs.map((a: any) =>
    normalizeHarvestAssignment(a, id)
  );
  const sumAsig = asignaciones.reduce((acc: number, a: HarvestPriceAssignment) => acc + a.toneladas, 0);
  const asignadas =
    src.asignadas !== undefined && src.asignadas !== null && src.asignadas !== ''
      ? parseDecimalNumber(src.asignadas)
      : src.toneladasAsignadas !== undefined && src.toneladasAsignadas !== null && src.toneladasAsignadas !== ''
      ? parseDecimalNumber(src.toneladasAsignadas)
      : sumAsig;
  const pendienteRaw =
    src.pendiente !== undefined && src.pendiente !== null && src.pendiente !== ''
      ? parseDecimalNumber(src.pendiente)
      : src.toneladasPendientes !== undefined && src.toneladasPendientes !== null && src.toneladasPendientes !== ''
      ? parseDecimalNumber(src.toneladasPendientes)
      : Math.max(0, Number((toneladas - asignadas).toFixed(4)));
  const pendiente = Math.max(0, Number(pendienteRaw.toFixed(4)));

  return {
    id,
    fecha: normalizeDateToYmd(src.fecha) || String(src.fecha || ''),
    campanaId: String(src.campanaId || src.campana_id || ''),
    campanaNombre: src.campanaNombre || src.campana ? String(src.campanaNombre || src.campana) : undefined,
    loteId: String(src.loteId || src.lote_id || ''),
    loteNombre: src.loteNombre || src.lote ? String(src.loteNombre || src.lote) : undefined,
    producto: String(src.producto || src.cultivo || src.concepto || 'Cosecha').trim(),
    unidad: normalizeHarvestUnit(src.unidad ?? src.Unidad ?? 't').canonicalUnit,
    toneladas,
    asignadas,
    pendiente,
    estado: src.estado ? String(src.estado) : undefined,
    observacion: String(src.observacion ?? src.observaciones ?? '').trim(),
    asignaciones,
    creadoEn: src.creadoEn ? String(src.creadoEn) : undefined,
  };
}

export async function getHarvests(
  options?: { campanaId?: string; soloPendientes?: boolean },
  useCache = false
): Promise<HarvestRecord[]> {
  const payload: Record<string, any> = {};
  if (options?.campanaId) payload.campanaId = options.campanaId;
  if (options?.soloPendientes !== undefined) payload.soloPendientes = options.soloPendientes;

  const res = await callGAS<any>('harvest.list', payload, useCache);
  const rawList = extractArrayFromResponse(res, ['cosechas', 'harvests', 'result', 'items']);
  return rawList.map(normalizeHarvestRecord);
}

export async function getPendingHarvests(useCache = false): Promise<HarvestRecord[]> {
  const res = await callGAS<any>('harvest.pending', {}, useCache);
  const rawList = extractArrayFromResponse(res, ['cosechas', 'pendientes', 'harvests', 'result', 'items']);
  return rawList.map(normalizeHarvestRecord);
}

export async function createHarvest(params: {
  fecha: string;
  campanaId: string;
  loteId: string;
  producto: string;
  toneladas: number;
  unidad?: string;
  observacion?: string;
  idempotencyKey?: string;
}): Promise<HarvestRecord> {
  const tons = parseDecimalNumber(params.toneladas);
  if (!params.campanaId) throw new Error('Selecciona la campaña de la cosecha.');
  if (!params.loteId) throw new Error('Selecciona el lote de la cosecha.');
  if (!params.producto || !params.producto.trim()) throw new Error('Indica el producto cosechado.');
  if (tons <= 0) throw new Error('La cantidad cosechada debe ser mayor a 0.');

  const payload = {
    fecha: params.fecha,
    campanaId: params.campanaId,
    loteId: params.loteId,
    producto: params.producto.trim(),
    toneladas: tons,
    unidad: normalizeHarvestUnit(params.unidad || 'toneladas').canonicalUnit,
    observacion: (params.observacion || '').trim(),
    idempotencyKey: params.idempotencyKey || `harv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };

  const res = await callGAS<any>('harvest.create', payload, false);
  invalidateBackendDomains(['harvest.', 'harvestSale.', 'report.']);
  const rawRecord = res?.cosecha || (res?.result && !Array.isArray(res.result) ? res.result : res);
  return normalizeHarvestRecord({
    ...payload,
    ...(rawRecord && typeof rawRecord === 'object' ? rawRecord : {}),
  });
}

export async function updateHarvest(
  id: string,
  params: {
    fecha?: string;
    campanaId?: string;
    loteId?: string;
    producto?: string;
    toneladas?: number;
    unidad?: string;
    observacion?: string;
  }
): Promise<HarvestRecord> {
  if (!id || !id.trim()) {
    throw new Error('Falta el identificador de la cosecha a actualizar.');
  }
  const payload: Record<string, any> = { id: id.trim() };
  if (params.fecha !== undefined) payload.fecha = params.fecha;
  if (params.campanaId !== undefined) payload.campanaId = params.campanaId;
  if (params.loteId !== undefined) payload.loteId = params.loteId;
  if (params.producto !== undefined) {
    const prod = params.producto.trim();
    if (!prod) throw new Error('Indica el producto cosechado.');
    payload.producto = prod;
  }
  if (params.toneladas !== undefined) {
    const tons = parseDecimalNumber(params.toneladas);
    if (tons <= 0) throw new Error('La cantidad cosechada debe ser mayor a 0.');
    payload.toneladas = tons;
  }
  if (params.unidad !== undefined) {
    payload.unidad = normalizeHarvestUnit(params.unidad).canonicalUnit;
  }
  if (params.observacion !== undefined) {
    payload.observacion = params.observacion.trim();
  }

  const res = await callGAS<any>('harvest.update', payload, false);
  invalidateBackendDomains(['harvest.', 'harvestSale.', 'report.']);
  const rawRecord = res?.cosecha || (res?.result && !Array.isArray(res.result) ? res.result : res);
  return normalizeHarvestRecord({
    ...payload,
    ...(rawRecord && typeof rawRecord === 'object' ? rawRecord : {}),
  });
}

export async function deleteHarvest(id: string): Promise<void> {
  if (!id || !id.trim()) {
    throw new Error('Falta el identificador de la cosecha a eliminar.');
  }
  await callGAS<any>('harvest.delete', { id: id.trim() }, false);
  invalidateBackendDomains(['harvest.', 'harvestSale.', 'report.']);
}

export async function assignHarvestPrice(params: {
  cosechaId: string;
  fecha: string;
  campanaId: string;
  toneladas: number;
  precioUsdTon: number;
  tc: number;
}): Promise<{ asignacion: HarvestPriceAssignment | null; cosecha: HarvestRecord | null }> {
  const tons = parseDecimalNumber(params.toneladas);
  const precio = parseDecimalNumber(params.precioUsdTon);
  const tcNum = resolveEffectiveExchangeRate(params.tc);

  if (!params.cosechaId) throw new Error('Selecciona la cosecha a la que deseas asignar precio.');
  if (!params.campanaId) throw new Error('Selecciona la campaña para registrar el ingreso.');
  if (tons <= 0) throw new Error('Las toneladas a asignar deben ser mayores a 0.');
  if (precio <= 0) throw new Error('El precio USD/tonelada debe ser mayor a 0.');

  const payload = {
    cosechaId: params.cosechaId,
    fecha: params.fecha,
    campanaId: params.campanaId,
    toneladas: tons,
    precioUsdTon: precio,
    tc: tcNum,
  };

  const res = await callGAS<any>('harvest.price', payload, false);
  // Backend creates the Property income automatically; invalidate harvest, movement & report caches
  invalidateBackendDomains(['harvest.', 'movement.', 'report.']);

  const asigRaw = res?.asignacion || res?.result?.asignacion || res?.precio || res?.result?.precio;
  const cosechaRaw = res?.cosecha || res?.result?.cosecha;
  return {
    asignacion: asigRaw ? normalizeHarvestAssignment(asigRaw, params.cosechaId) : null,
    cosecha: cosechaRaw ? normalizeHarvestRecord(cosechaRaw) : null,
  };
}

// -------------------------------------------------------------
// 15. Gastos distribuidos entre lotes (expense.allocate / expense.allocations)
// -------------------------------------------------------------

export function normalizeExpenseAllocationGroup(raw: any): ExpenseAllocationGroup {
  const src = raw && typeof raw === 'object' ? raw : {};
  const grupoId = String(src.grupoId || src.grupo_id || src.id || src.ID || '');
  const rawLotes = Array.isArray(src.lotes)
    ? src.lotes
    : Array.isArray(src.detalle)
    ? src.detalle
    : Array.isArray(src.distribucion)
    ? src.distribucion
    : [];

  const lotes: ExpenseAllocationLot[] = rawLotes.map((l: any) => ({
    loteId: String(l.loteId || l.lote_id || l.id || ''),
    loteNombre: l.loteNombre || l.nombre || l.lote ? String(l.loteNombre || l.nombre || l.lote) : undefined,
    hectareas: parseDecimalNumber(l.hectareas ?? l.ha ?? 0),
    porcentaje: l.porcentaje !== undefined ? parseDecimalNumber(l.porcentaje) : undefined,
    importe: l.importe !== undefined || l.monto !== undefined ? parseDecimalNumber(l.importe ?? l.monto) : undefined,
    movimientoId: l.movimientoId ? String(l.movimientoId) : undefined,
  }));

  const haTot =
    src.hectareasTotales !== undefined
      ? parseDecimalNumber(src.hectareasTotales)
      : lotes.reduce((sum, l) => sum + l.hectareas, 0);

  return {
    id: String(src.id || grupoId || `alloc_${Math.random().toString(36).slice(2, 8)}`),
    grupoId,
    fecha: normalizeDateToYmd(src.fecha) || String(src.fecha || ''),
    campanaId: String(src.campanaId || src.campana_id || ''),
    campanaNombre: src.campanaNombre || src.campana ? String(src.campanaNombre || src.campana) : undefined,
    descripcion: String(src.descripcion || src.itemGasto || src.item || 'Gasto distribuido').trim(),
    itemId: src.itemId ? String(src.itemId) : undefined,
    importe: parseDecimalNumber(src.importe ?? src.importeTotal ?? src.total ?? 0),
    moneda: normalizeCurrencyCode(src.moneda, 'BOB'),
    tc: parseDecimalNumber(src.tc ?? src.tipoCambio ?? 0),
    hectareasTotales: haTot > 0 ? haTot : undefined,
    observacion: String(src.observacion ?? src.observaciones ?? '').trim(),
    lotes,
    creadoEn: src.creadoEn ? String(src.creadoEn) : undefined,
  };
}

export async function allocateExpense(params: {
  fecha: string;
  campanaId: string;
  descripcion: string;
  importe: number;
  moneda: Currency;
  tc: number;
  lotes: Array<{ loteId: string; hectareas: number }>;
  itemId?: string;
  observacion?: string;
}): Promise<{ grupo: ExpenseAllocationGroup | null; raw: any }> {
  const importeNum = parseDecimalNumber(params.importe);
  const tcNum = resolveEffectiveExchangeRate(params.tc);

  if (!params.campanaId) {
    throw new Error('Debes tener una campaña activa para registrar un gasto distribuido.');
  }
  if (!params.descripcion || !params.descripcion.trim()) {
    throw new Error('La descripción del gasto es obligatoria.');
  }
  if (importeNum <= 0) {
    throw new Error('El importe total del gasto debe ser mayor a 0.');
  }
  if (!Array.isArray(params.lotes) || params.lotes.length < 2) {
    throw new Error('Un gasto distribuido requiere al menos dos lotes.');
  }

  const normalizedLotes = params.lotes.map((l) => ({
    loteId: String(l.loteId),
    hectareas: parseDecimalNumber(l.hectareas),
  }));
  if (normalizedLotes.some((l) => !l.loteId || l.hectareas <= 0)) {
    throw new Error('Todos los lotes seleccionados deben tener hectáreas válidas mayores a 0.');
  }

  const gasMoneda = params.moneda === 'USD' ? 'USD' : 'BOB';
  const payload = {
    fecha: params.fecha,
    campanaId: params.campanaId,
    descripcion: params.descripcion.trim(),
    importe: importeNum,
    moneda: gasMoneda,
    tc: tcNum,
    lotes: normalizedLotes,
    itemId: params.itemId || '',
    observacion: (params.observacion || '').trim(),
  };

  // Single backend request: GAS generates the per-lot movements and allocation group
  const res = await callGAS<any>('expense.allocate', payload, false);
  invalidateBackendDomains(['expense.allocations', 'movement.', 'report.']);

  const grupoRaw = res?.grupo || (res?.result && !Array.isArray(res.result) ? res.result : res);
  return {
    grupo: grupoRaw && typeof grupoRaw === 'object' ? normalizeExpenseAllocationGroup({ ...payload, ...grupoRaw }) : null,
    raw: res,
  };
}

export async function getExpenseAllocations(
  options?: { campanaId?: string; grupoId?: string },
  useCache = false
): Promise<ExpenseAllocationGroup[]> {
  const payload: Record<string, any> = {};
  if (options?.campanaId) payload.campanaId = options.campanaId;
  if (options?.grupoId) payload.grupoId = options.grupoId;

  const res = await callGAS<any>('expense.allocations', payload, useCache);
  const rawList = extractArrayFromResponse(res, [
    'allocations',
    'distribuciones',
    'grupos',
    'result',
    'items',
  ]);
  return rawList.map(normalizeExpenseAllocationGroup);
}

export function parseFlexibleDate(dateStr: string | undefined | null): number {
  if (!dateStr) return 0;
  const str = String(dateStr).trim();
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minute = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const second = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const dt = new Date(year, month, day, hour, minute, second);
    const ts = dt.getTime();
    if (!isNaN(ts)) return ts;
  }
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+T?(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const hour = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const minute = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
    const second = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;
    const dt = new Date(year, month, day, hour, minute, second);
    const ts = dt.getTime();
    if (!isNaN(ts)) return ts;
  }
  const parsed = Date.parse(str);
  return isNaN(parsed) ? 0 : parsed;
}

export function compareChronologicalDesc(
  a: { fecha?: string; creadoEn?: string },
  b: { fecha?: string; creadoEn?: string }
): number {
  const timeA = parseFlexibleDate(a.fecha);
  const timeB = parseFlexibleDate(b.fecha);
  if (timeA !== timeB) {
    return timeB - timeA;
  }
  const createdA = parseFlexibleDate(a.creadoEn);
  const createdB = parseFlexibleDate(b.creadoEn);
  if (createdA !== createdB) {
    return createdB - createdA;
  }
  return 0;
}

export function getMachineIcon(maquinaId?: string, machines: any[] = [], fallbackIcon?: string): string {
  if (!maquinaId) return fallbackIcon || 'tractor';
  const cleanId = String(maquinaId).trim();
  const found = machines.find(
    (m) =>
      String(m.id || '').trim() === cleanId ||
      String(m.nombre || '').trim().toLowerCase() === cleanId.toLowerCase()
  );
  if (found?.icono) return String(found.icono).trim();
  if (fallbackIcon) return fallbackIcon;
  return 'tractor';
}

// =============================================================
// 14. CUSTOMERS CATALOG (Administración → Clientes)
// =============================================================

function parseBoolFlag(v: any, defaultVal = false): boolean {
  if (typeof v === 'boolean') return v;
  if (v === undefined || v === null || v === '') return defaultVal;
  const s = String(v).trim().toUpperCase();
  if (s === 'TRUE' || s === '1' || s === 'SI' || s === 'SÍ' || s === 'YES' || s === 'ACTIVO') return true;
  if (s === 'FALSE' || s === '0' || s === 'NO' || s === 'INACTIVO') return false;
  return defaultVal;
}

export function normalizeCustomer(raw: any): Customer {
  if (!raw || typeof raw !== 'object') {
    return { id: '', nombre: '', activo: true };
  }
  return {
    id: String(raw.id || raw.ID || '').trim(),
    nombre: String(raw.nombre || raw.Nombre || '').trim(),
    telefono: raw.telefono !== undefined ? String(raw.telefono || '').trim() : '',
    direccion: raw.direccion !== undefined ? String(raw.direccion || '').trim() : '',
    activo: parseBoolFlag(raw.activo, true),
    creadoEn: raw.creadoEn ? String(raw.creadoEn) : undefined,
    actualizadoEn: raw.actualizadoEn ? String(raw.actualizadoEn) : undefined,
  };
}

export async function getCustomers(useCache = true): Promise<Customer[]> {
  try {
    const res = await callGAS<any>('customer.list', {}, useCache);
    const list = extractArrayFromResponse(res, ['customers', 'clientes', 'result', 'items']);
    return list.map(normalizeCustomer).filter((c) => Boolean(c.id && c.nombre));
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('acción no reconocida') || msg.includes('accion no reconocida') || msg.includes('unknown action')) {
      return [];
    }
    throw err;
  }
}

export async function createCustomer(data: {
  nombre: string;
  telefono?: string;
  direccion?: string;
}): Promise<Customer> {
  const payload = {
    nombre: data.nombre.trim(),
    telefono: (data.telefono || '').trim(),
    direccion: (data.direccion || '').trim(),
  };
  const res = await callGAS<any>('customer.create', payload, false);
  invalidateBackendDomains(['customer.', 'ar.', 'work.', 'harvestSale.']);
  const created = res?.customer || res?.cliente || res?.result || res;
  return normalizeCustomer({ ...payload, ...(created || {}) });
}

export async function updateCustomer(
  id: string,
  data: { nombre: string; telefono?: string; direccion?: string; activo?: boolean }
): Promise<Customer> {
  const payload = {
    id,
    nombre: data.nombre.trim(),
    telefono: (data.telefono || '').trim(),
    direccion: (data.direccion || '').trim(),
    ...(data.activo !== undefined ? { activo: data.activo } : {}),
  };
  const res = await callGAS<any>('customer.update', payload, false);
  invalidateBackendDomains(['customer.', 'ar.', 'work.', 'harvestSale.']);
  const updated = res?.customer || res?.cliente || res?.result || res;
  return normalizeCustomer({ ...payload, ...(updated || {}) });
}

export async function toggleCustomerActive(id: string, activo: boolean): Promise<Customer> {
  const res = await callGAS<any>('customer.toggle', { id, activo }, false);
  invalidateBackendDomains(['customer.', 'ar.']);
  const updated = res?.customer || res?.cliente || res?.result || res;
  return normalizeCustomer({ id, activo, ...(updated || {}) });
}

export async function deleteCustomer(id: string): Promise<{ deleted: boolean; deactivated?: boolean; message?: string }> {
  const res = await callGAS<any>('customer.delete', { id }, false);
  invalidateBackendDomains(['customer.', 'ar.']);
  return {
    deleted: Boolean(res?.deleted ?? res?.result?.deleted ?? true),
    deactivated: Boolean(res?.deactivated ?? res?.result?.deactivated ?? false),
    message: res?.message || res?.result?.message,
  };
}

// =============================================================
// 15. PAYMENT & INTEREST SETTINGS (Administración → Configuración de cobros)
// =============================================================

export function normalizePaymentSettings(raw: any): PaymentSettings {
  if (!raw || typeof raw !== 'object') {
    return {
      plazoDiasPredeterminado: null,
      aplicarInteresPorDefecto: false,
      porcentajeInteresMensual: null,
      configurado: false,
    };
  }
  const src = raw.settings || raw.config || raw.result || raw;
  const rawPlazo = src.plazoDiasPredeterminado ?? src.plazoDiasDefault ?? src.COBRO_PLAZO_DIAS;
  const rawTasa = src.porcentajeInteresMensual ?? src.tasaInteresMensualDefault ?? src.COBRO_INTERES_MENSUAL;
  const plazo =
    rawPlazo !== '' && rawPlazo !== null && rawPlazo !== undefined && !isNaN(Number(rawPlazo))
      ? Math.max(0, Math.round(Number(rawPlazo)))
      : null;
  const tasa =
    rawTasa !== '' && rawTasa !== null && rawTasa !== undefined && !isNaN(Number(rawTasa))
      ? Math.max(0, Number(rawTasa))
      : null;
  const aplicar = parseBoolFlag(
    src.aplicarInteresPorDefecto ?? src.aplicarInteresDefault ?? src.COBRO_INTERES_ACTIVO,
    false
  );
  const configurado =
    parseBoolFlag(src.configurado, false) || plazo !== null || tasa !== null || aplicar;

  return {
    plazoDiasPredeterminado: plazo,
    aplicarInteresPorDefecto: aplicar && tasa !== null && tasa > 0,
    porcentajeInteresMensual: tasa,
    configurado,
    actualizadoEn: src.actualizadoEn ? String(src.actualizadoEn) : undefined,
  };
}

export async function getPaymentSettings(useCache = true): Promise<PaymentSettings> {
  try {
    const res = await callGAS<any>('paymentSettings.get', {}, useCache);
    return normalizePaymentSettings(res);
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('acción no reconocida') || msg.includes('accion no reconocida') || msg.includes('unknown action')) {
      return {
        plazoDiasPredeterminado: null,
        aplicarInteresPorDefecto: false,
        porcentajeInteresMensual: null,
        configurado: false,
      };
    }
    throw err;
  }
}

export async function savePaymentSettings(settings: {
  plazoDiasPredeterminado: number | null;
  aplicarInteresPorDefecto: boolean;
  porcentajeInteresMensual: number | null;
}): Promise<PaymentSettings> {
  const payload = {
    plazoDiasPredeterminado:
      settings.plazoDiasPredeterminado === null ? '' : Math.max(0, Math.round(settings.plazoDiasPredeterminado)),
    aplicarInteresPorDefecto: Boolean(settings.aplicarInteresPorDefecto),
    porcentajeInteresMensual:
      settings.porcentajeInteresMensual === null ? '' : Math.max(0, Number(settings.porcentajeInteresMensual)),
  };
  const res = await callGAS<any>('paymentSettings.save', payload, false);
  invalidateBackendDomains(['paymentSettings.']);
  return normalizePaymentSettings(res);
}

// =============================================================
// 16. HARVEST SALES (Propiedad → Ventas de cosecha — Admin only)
// =============================================================

export function computeHarvestSaleStatus(
  compradorPendiente: boolean,
  precioPendiente: boolean
): HarvestSaleStatus {
  if (compradorPendiente && precioPendiente) return 'COMPRADOR_Y_PRECIO_PENDIENTES';
  if (compradorPendiente) return 'COMPRADOR_PENDIENTE';
  if (precioPendiente) return 'PRECIO_PENDIENTE';
  return 'VENTA_COMPLETA';
}

export function normalizeHarvestSaleDistribution(raw: any): HarvestSaleDistribution {
  const rawMoneda = String(raw?.moneda || 'USD').toUpperCase();
  const moneda: Currency = rawMoneda === 'USD' || rawMoneda === 'U$D' ? 'USD' : 'BOB';
  return {
    id: String(raw?.id || raw?.ID || '').trim(),
    ventaId: String(raw?.ventaId || raw?.venta_id || '').trim(),
    cosechaId: String(raw?.cosechaId || raw?.cosecha_id || '').trim(),
    loteId: String(raw?.loteId || raw?.lote_id || '').trim(),
    loteNombre: String(raw?.loteNombre || raw?.lote || '').trim() || undefined,
    campanaId: String(raw?.campanaId || raw?.campana_id || '').trim(),
    campanaNombre: String(raw?.campanaNombre || raw?.campana || '').trim() || undefined,
    producto: String(raw?.producto || '').trim(),
    unidad: normalizeHarvestUnit(raw?.unidad || 't').canonicalUnit,
    toneladasAsignadas: parseDecimalNumber(raw?.toneladasAsignadas ?? raw?.toneladas ?? raw?.cantidad ?? 0),
    participacionPct: parseDecimalNumber(raw?.participacionPct ?? raw?.porcentaje ?? 0),
    precioUnitario: parseDecimalNumber(raw?.precioUnitario ?? 0),
    importeAsignado: parseDecimalNumber(raw?.importeAsignado ?? raw?.importe ?? 0),
    moneda,
    tcHistorico: parseDecimalNumber(raw?.tcHistorico ?? raw?.tc ?? 6.96),
    movimientoId: String(raw?.movimientoId || '').trim() || undefined,
    anulada: parseBoolFlag(raw?.anulada, false),
    creadoEn: raw?.creadoEn ? String(raw.creadoEn) : undefined,
    actualizadoEn: raw?.actualizadoEn ? String(raw.actualizadoEn) : undefined,
  };
}

export function normalizeHarvestSale(raw: any): HarvestSale {
  const rawMoneda = String(raw?.moneda || 'USD').toUpperCase();
  const moneda: Currency = rawMoneda === 'USD' || rawMoneda === 'U$D' ? 'USD' : 'BOB';
  const cantidad = parseDecimalNumber(raw?.cantidad ?? raw?.toneladas ?? raw?.cantidadAsignada ?? 0);
  const precioVal = parseDecimalNumber(raw?.precioUnitario ?? raw?.precioUsdTon ?? 0);
  const precioPendiente =
    raw?.precioPendiente !== undefined
      ? parseBoolFlag(raw.precioPendiente, precioVal <= 0)
      : precioVal <= 0;
  const clienteId = String(raw?.clienteId || '').trim();
  const clienteNombre = String(raw?.clienteNombre || raw?.comprador || raw?.cliente || '').trim();
  const compradorPendiente =
    raw?.compradorPendiente !== undefined
      ? parseBoolFlag(raw.compradorPendiente, !clienteId && !clienteNombre)
      : !clienteId && !clienteNombre;
  const importeTotal = precioPendiente
    ? 0
    : parseDecimalNumber(raw?.importeTotal ?? raw?.importe ?? (precioVal > 0 ? cantidad * precioVal : 0));

  const validStates: HarvestSaleStatus[] = [
    'COMPRADOR_Y_PRECIO_PENDIENTES',
    'COMPRADOR_PENDIENTE',
    'PRECIO_PENDIENTE',
    'VENTA_COMPLETA',
  ];
  const rawEstado = String(raw?.estado || '').toUpperCase() as HarvestSaleStatus;
  const estado = validStates.includes(rawEstado)
    ? rawEstado
    : computeHarvestSaleStatus(compradorPendiente, precioPendiente);

  const isComplete = !compradorPendiente && !precioPendiente;
  const rawPlazo =
    isComplete && raw?.plazoDias !== undefined && raw?.plazoDias !== '' && raw?.plazoDias !== null
      ? parseDecimalNumber(raw.plazoDias)
      : undefined;
  const rawAplicarInteres = isComplete ? parseBoolFlag(raw?.aplicarInteres, false) : false;
  const rawTasa = rawAplicarInteres ? parseDecimalNumber(raw?.tasaInteresMensual ?? 0) : 0;
  const rawDists = Array.isArray(raw?.distribuciones)
    ? raw.distribuciones.map(normalizeHarvestSaleDistribution)
    : undefined;

  return {
    id: String(raw?.id || raw?.ID || '').trim(),
    cosechaId: String(raw?.cosechaId || '').trim(),
    fecha: formatDateDDMMAAAA(raw?.fecha || ''),
    campanaId: String(raw?.campanaId || '').trim(),
    campanaNombre: String(raw?.campanaNombre || raw?.campana || '').trim(),
    loteId: String(raw?.loteId || '').trim(),
    loteNombre: String(raw?.loteNombre || raw?.lote || '').trim(),
    origenResumen: String(raw?.origenResumen || '').trim() || undefined,
    producto: String(raw?.producto || '').trim(),
    cantidad,
    unidad: normalizeHarvestUnit(raw?.unidad || 't').canonicalUnit,
    clienteId: clienteId || undefined,
    clienteNombre: clienteNombre || undefined,
    compradorPendiente,
    precioUnitario: precioPendiente ? 0 : precioVal,
    precioPendiente,
    moneda,
    tc: parseDecimalNumber(raw?.tc ?? raw?.tipoCambio ?? 6.96),
    importeTotal,
    plazoDias: rawPlazo,
    fechaVencimiento: isComplete && raw?.fechaVencimiento ? formatDateDDMMAAAA(raw.fechaVencimiento) : '',
    fechaCompletado: isComplete && raw?.fechaCompletado ? formatDateDDMMAAAA(raw.fechaCompletado) : '',
    aplicarInteres: rawAplicarInteres && rawTasa > 0,
    tasaInteresMensual: rawAplicarInteres && rawTasa > 0 ? rawTasa : 0,
    observacion: String(raw?.observacion || '').trim(),
    movimientoId: String(raw?.movimientoId || '').trim() || undefined,
    estado,
    estadoComprador: compradorPendiente ? 'PENDIENTE' : 'ASIGNADO',
    estadoPrecio: precioPendiente ? 'PENDIENTE' : 'ASIGNADO',
    anulada: parseBoolFlag(raw?.anulada, false),
    distribuciones: rawDists,
    creadoPor: raw?.creadoPor ? String(raw.creadoPor) : undefined,
    creadoEn: raw?.creadoEn ? String(raw.creadoEn) : undefined,
    actualizadoEn: raw?.actualizadoEn ? String(raw.actualizadoEn) : undefined,
  };
}

export async function getHarvestSales(
  options?: { campanaId?: string; includeAnuladas?: boolean },
  useCache = true
): Promise<{ sales: HarvestSale[]; harvests: HarvestRecord[] }> {
  const payload: Record<string, any> = {};
  if (options?.campanaId && options.campanaId !== 'all') payload.campanaId = options.campanaId;
  if (options?.includeAnuladas) payload.includeAnuladas = true;

  try {
    const res = await callGAS<any>('harvestSale.list', payload, useCache);
    const salesRaw = extractArrayFromResponse(res, ['sales', 'ventas', 'asignaciones', 'result']);
    const hasEmbeddedHarvests =
      Array.isArray(res?.harvests) ||
      Array.isArray(res?.cosechas) ||
      Array.isArray(res?.result?.harvests) ||
      Array.isArray(res?.result?.cosechas);

    let harvestsNormalized: HarvestRecord[];
    if (hasEmbeddedHarvests) {
      const harvestsRaw = Array.isArray(res?.harvests)
        ? res.harvests
        : Array.isArray(res?.cosechas)
        ? res.cosechas
        : Array.isArray(res?.result?.harvests)
        ? res.result.harvests
        : res.result.cosechas;
      harvestsNormalized = harvestsRaw.map(normalizeHarvestRecord);
    } else {
      // Fallback if response omitted embedded harvests collection
      harvestsNormalized = await getHarvests(
        {
          ...(options?.campanaId && options.campanaId !== 'all' ? { campanaId: options.campanaId } : {}),
          soloPendientes: false,
        },
        useCache
      );
    }

    const salesNormalized = salesRaw.map(normalizeHarvestSale).filter((s) => Boolean(s.id));
    const rawDistributions = Array.isArray(res?.distributions)
      ? res.distributions
      : Array.isArray(res?.result?.distributions)
      ? res.result.distributions
      : [];
    const distributionsNormalized = rawDistributions.map(normalizeHarvestSaleDistribution);
    // Reconcile availability centrally using distributions (with legacy fallback)
    const reconciledHarvests = computeHarvestAvailability(
      harvestsNormalized,
      salesNormalized,
      distributionsNormalized.length > 0 ? distributionsNormalized : undefined
    );

    return {
      sales: salesNormalized,
      harvests: reconciledHarvests,
    };
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('acción no reconocida') || msg.includes('accion no reconocida') || msg.includes('unknown action')) {
      const fallbackHarvests = await getHarvests(
        {
          ...(options?.campanaId && options.campanaId !== 'all' ? { campanaId: options.campanaId } : {}),
          soloPendientes: false,
        },
        useCache
      );
      return { sales: [], harvests: computeHarvestAvailability(fallbackHarvests) };
    }
    throw err;
  }
}

export async function createHarvestSale(params: {
  producto?: string;
  unidad?: string;
  cosechaId?: string;
  fecha: string;
  cantidad: number;
  clienteId?: string;
  compradorPendiente?: boolean;
  precioPendiente?: boolean;
  precioUnitario?: number;
  moneda: Currency;
  tc: number;
  plazoDias?: number | null;
  fechaVencimiento?: string;
  aplicarInteres?: boolean;
  tasaInteresMensual?: number;
  observacion?: string;
  idempotencyKey?: string;
}): Promise<HarvestSale> {
  const payload: Record<string, any> = {
    fecha: params.fecha,
    cantidad: parseDecimalNumber(params.cantidad),
    clienteId: params.compradorPendiente ? '' : (params.clienteId || '').trim(),
    compradorPendiente: Boolean(params.compradorPendiente || !params.clienteId),
    precioPendiente: Boolean(params.precioPendiente),
    precioUnitario: params.precioPendiente ? 0 : parseDecimalNumber(params.precioUnitario ?? 0),
    moneda: params.moneda === 'USD' ? 'USD' : 'BOB',
    tc: resolveEffectiveExchangeRate(params.tc),
    plazoDias: params.plazoDias !== undefined && params.plazoDias !== null ? Number(params.plazoDias) : '',
    fechaVencimiento: params.fechaVencimiento || '',
    aplicarInteres: Boolean(params.aplicarInteres),
    tasaInteresMensual: params.aplicarInteres ? Number(params.tasaInteresMensual || 0) : 0,
    observacion: (params.observacion || '').trim(),
    idempotencyKey: params.idempotencyKey || `hs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
  if (params.producto && params.producto.trim()) {
    payload.producto = params.producto.trim();
  }
  if (params.unidad && params.unidad.trim()) {
    payload.unidad = normalizeHarvestUnit(params.unidad).canonicalUnit;
  }
  if (params.cosechaId && params.cosechaId.trim()) {
    payload.cosechaId = params.cosechaId.trim();
  }
  const res = await callGAS<any>('harvestSale.create', payload, false);
  invalidateBackendDomains(['harvestSale.', 'harvest.', 'movement.', 'ar.', 'report.']);
  const created = res?.sale || res?.venta || res?.result || res;
  return normalizeHarvestSale({ ...payload, ...(created || {}) });
}

export async function updateHarvestSale(
  id: string,
  params: {
    fecha?: string;
    cantidad?: number;
    clienteId?: string;
    compradorPendiente?: boolean;
    precioPendiente?: boolean;
    precioUnitario?: number;
    moneda?: Currency;
    tc?: number;
    plazoDias?: number | null;
    fechaVencimiento?: string;
    aplicarInteres?: boolean;
    tasaInteresMensual?: number;
    observacion?: string;
  }
): Promise<HarvestSale> {
  const payload: Record<string, any> = { id };
  if (params.fecha !== undefined) payload.fecha = params.fecha;
  if (params.cantidad !== undefined) payload.cantidad = parseDecimalNumber(params.cantidad);
  if (params.compradorPendiente !== undefined) payload.compradorPendiente = Boolean(params.compradorPendiente);
  if (params.clienteId !== undefined) payload.clienteId = params.compradorPendiente ? '' : params.clienteId;
  if (params.precioPendiente !== undefined) payload.precioPendiente = Boolean(params.precioPendiente);
  if (params.precioUnitario !== undefined) {
    payload.precioUnitario = params.precioPendiente ? 0 : parseDecimalNumber(params.precioUnitario ?? 0);
  }
  if (params.moneda !== undefined) payload.moneda = params.moneda === 'USD' ? 'USD' : 'BOB';
  if (params.tc !== undefined) payload.tc = resolveEffectiveExchangeRate(params.tc);
  if (params.plazoDias !== undefined) payload.plazoDias = params.plazoDias === null ? '' : Number(params.plazoDias);
  if (params.fechaVencimiento !== undefined) payload.fechaVencimiento = params.fechaVencimiento;
  if (params.aplicarInteres !== undefined) payload.aplicarInteres = Boolean(params.aplicarInteres);
  if (params.tasaInteresMensual !== undefined) {
    payload.tasaInteresMensual = params.aplicarInteres ? Number(params.tasaInteresMensual || 0) : 0;
  }
  if (params.observacion !== undefined) payload.observacion = params.observacion.trim();

  const res = await callGAS<any>('harvestSale.update', payload, false);
  invalidateBackendDomains(['harvestSale.', 'harvest.', 'movement.', 'ar.', 'report.']);
  const updated = res?.sale || res?.venta || res?.result || res;
  return normalizeHarvestSale({ ...payload, ...(updated || {}) });
}

export async function cancelHarvestSale(id: string): Promise<void> {
  await callGAS<any>('harvestSale.cancel', { id }, false);
  invalidateBackendDomains(['harvestSale.', 'harvest.', 'movement.', 'ar.', 'report.']);
}

// =============================================================
// 17. CENTRALIZED ACCOUNTS RECEIVABLE, PAYMENTS & DOCUMENTS
// =============================================================

export function normalizeArDebtApplication(raw: any): ArDebtApplicationItem {
  const monedaDeuda: Currency = String(raw?.monedaDeuda || 'USD').toUpperCase().includes('USD') ? 'USD' : 'BOB';
  const monedaPago: Currency = String(raw?.monedaPago || monedaDeuda).toUpperCase().includes('USD') ? 'USD' : 'BOB';
  const rawTipo = String(raw?.deudaTipo || raw?.tipo || 'TRABAJO').toUpperCase();
  const deudaTipo = rawTipo === 'VENTA_COSECHA' ? 'VENTA_COSECHA' : 'TRABAJO';
  const rawMod = String(raw?.moduloOrigen || raw?.origen || (deudaTipo === 'VENTA_COSECHA' ? 'PROPIEDAD' : 'MAQUINARIAS')).toUpperCase();

  return {
    id: String(raw?.id || '').trim(),
    cobroId: String(raw?.cobroId || '').trim(),
    deudaTipo,
    deudaId: String(raw?.deudaId || '').trim(),
    clienteId: raw?.clienteId ? String(raw.clienteId).trim() : undefined,
    moduloOrigen: rawMod === 'PROPIEDAD' ? 'PROPIEDAD' : 'MAQUINARIAS',
    campanaOrigenId: raw?.campanaOrigenId ? String(raw.campanaOrigenId).trim() : undefined,
    loteOrigenId: raw?.loteOrigenId ? String(raw.loteOrigenId).trim() : undefined,
    fechaCobro: formatDateDDMMAAAA(raw?.fechaCobro || raw?.fecha || ''),
    monedaDeuda,
    monedaPago,
    tcAplicado: parseDecimalNumber(raw?.tcAplicado ?? raw?.tc ?? 6.96),
    importeOriginalPagado: parseDecimalNumber(raw?.importeOriginalPagado ?? 0),
    importeEquivalenteDeuda: parseDecimalNumber(raw?.importeEquivalenteDeuda ?? 0),
    saldoCapitalAnterior: parseDecimalNumber(raw?.saldoCapitalAnterior ?? 0),
    interesAcumuladoAnterior: parseDecimalNumber(raw?.interesAcumuladoAnterior ?? 0),
    interesPagado: parseDecimalNumber(raw?.interesPagado ?? 0),
    capitalPagado: parseDecimalNumber(raw?.capitalPagado ?? 0),
    saldoCapitalRestante: parseDecimalNumber(raw?.saldoCapitalRestante ?? 0),
    interesRestante: parseDecimalNumber(raw?.interesRestante ?? 0),
    movimientoInteresId: raw?.movimientoInteresId ? String(raw.movimientoInteresId).trim() : undefined,
    anulado: parseBoolFlag(raw?.anulado, false),
    creadoPor: raw?.creadoPor ? String(raw.creadoPor) : undefined,
    creadoEn: raw?.creadoEn ? String(raw.creadoEn) : undefined,
  };
}

export function normalizeArDebt(raw: any): ArDebt {
  const rawMoneda = String(raw?.moneda || 'USD').toUpperCase();
  const moneda: Currency = rawMoneda === 'USD' || rawMoneda === 'U$D' ? 'USD' : 'BOB';
  const rawTipo = String(raw?.deudaTipo || (String(raw?.origen || '').toUpperCase() === 'PROPIEDAD' ? 'VENTA_COSECHA' : 'TRABAJO')).toUpperCase();
  const deudaTipo = rawTipo === 'VENTA_COSECHA' ? 'VENTA_COSECHA' : 'TRABAJO';
  const origen: 'MAQUINARIAS' | 'PROPIEDAD' =
    deudaTipo === 'VENTA_COSECHA' || String(raw?.origen || '').toUpperCase() === 'PROPIEDAD'
      ? 'PROPIEDAD'
      : 'MAQUINARIAS';
  const rawEstado = String(raw?.estado || 'PENDIENTE').toUpperCase();
  const estado: CobroEstado =
    rawEstado === 'COBRADO' || rawEstado === 'PAGADA' || rawEstado === 'PAGADO'
      ? 'COBRADO'
      : rawEstado === 'PARCIAL'
      ? 'PARCIAL'
      : 'PENDIENTE';

  const deudaId = String(raw?.deudaId || raw?.id || '').trim();
  const aplicaciones = Array.isArray(raw?.aplicaciones)
    ? raw.aplicaciones.map(normalizeArDebtApplication)
    : [];

  return {
    id: String(raw?.id || `${deudaTipo}:${deudaId}`),
    deudaTipo,
    deudaId,
    origen,
    clienteId: raw?.clienteId ? String(raw.clienteId).trim() : undefined,
    clienteNombre: String(raw?.clienteNombre || raw?.cliente || '').trim(),
    clientePendiente: parseBoolFlag(raw?.clientePendiente, !String(raw?.clienteId || '').trim()),
    fecha: formatDateDDMMAAAA(raw?.fecha || raw?.fechaOperacion || ''),
    concepto: String(raw?.concepto || '').trim(),
    campanaId: raw?.campanaId ? String(raw.campanaId).trim() : undefined,
    campanaNombre: raw?.campanaNombre ? String(raw.campanaNombre).trim() : undefined,
    loteId: raw?.loteId ? String(raw.loteId).trim() : undefined,
    loteNombre: raw?.loteNombre ? String(raw.loteNombre).trim() : undefined,
    maquinaId: raw?.maquinaId ? String(raw.maquinaId).trim() : undefined,
    maquinaNombre: raw?.maquinaNombre ? String(raw.maquinaNombre).trim() : undefined,
    cantidad: parseDecimalNumber(raw?.cantidad ?? 0),
    unidad: String(raw?.unidad || '').trim(),
    precioUnitario: parseDecimalNumber(raw?.precioUnitario ?? 0),
    moneda,
    tcHistorico: parseDecimalNumber(raw?.tcHistorico ?? raw?.tc ?? 6.96),
    importeOriginal: parseDecimalNumber(raw?.importeOriginal ?? 0),
    plazoDias: Math.max(0, Math.round(parseDecimalNumber(raw?.plazoDias ?? 0))),
    fechaVencimiento: raw?.fechaVencimiento ? formatDateDDMMAAAA(raw.fechaVencimiento) : '',
    aplicarInteres: parseBoolFlag(raw?.aplicarInteres, false),
    tasaInteresMensual: parseDecimalNumber(raw?.tasaInteresMensual ?? 0),
    pagosAnteriores: parseDecimalNumber(raw?.pagosAnteriores ?? 0),
    pagosCapitalAnteriores: parseDecimalNumber(raw?.pagosCapitalAnteriores ?? 0),
    pagosInteresAnteriores: parseDecimalNumber(raw?.pagosInteresAnteriores ?? 0),
    capitalPendiente: parseDecimalNumber(raw?.capitalPendiente ?? 0),
    interesAcumulado: parseDecimalNumber(raw?.interesAcumulado ?? 0),
    totalPendiente: parseDecimalNumber(raw?.totalPendiente ?? 0),
    diasAtraso: Math.max(0, Math.round(parseDecimalNumber(raw?.diasAtraso ?? 0))),
    vencida: parseBoolFlag(raw?.vencida, false),
    estado,
    observacion: raw?.observacion ? String(raw.observacion) : undefined,
    aplicaciones,
  };
}

export function normalizeArCustomerSummary(raw: any): ArCustomerSummary {
  const usdRaw = raw?.usd || {};
  const bobRaw = raw?.bob || {};
  return {
    clienteId: String(raw?.clienteId || raw?.id || '').trim(),
    clienteNombre: String(raw?.clienteNombre || raw?.nombre || '').trim(),
    telefono: raw?.telefono ? String(raw.telefono).trim() : undefined,
    direccion: raw?.direccion ? String(raw.direccion).trim() : undefined,
    activo: parseBoolFlag(raw?.activo, true),
    registrosPendientes: Math.round(parseDecimalNumber(raw?.registrosPendientes ?? 0)),
    registrosVencidos: Math.round(parseDecimalNumber(raw?.registrosVencidos ?? 0)),
    usd: {
      capitalPendiente: parseDecimalNumber(usdRaw.capitalPendiente ?? raw?.capitalUsd ?? 0),
      interesAcumulado: parseDecimalNumber(usdRaw.interesAcumulado ?? raw?.interesUsd ?? 0),
      totalPendiente: parseDecimalNumber(usdRaw.totalPendiente ?? raw?.totalUsd ?? 0),
    },
    bob: {
      capitalPendiente: parseDecimalNumber(bobRaw.capitalPendiente ?? raw?.capitalBob ?? 0),
      interesAcumulado: parseDecimalNumber(bobRaw.interesAcumulado ?? raw?.interesBob ?? 0),
      totalPendiente: parseDecimalNumber(bobRaw.totalPendiente ?? raw?.totalBob ?? 0),
    },
    deudas: Array.isArray(raw?.deudas) ? raw.deudas.map(normalizeArDebt) : [],
  };
}

export function normalizeArPaymentRecord(raw: any): ArPaymentRecord {
  const rawMon = String(raw?.monedaPago || raw?.moneda || 'USD').toUpperCase();
  const monedaPago: Currency = rawMon === 'USD' || rawMon === 'U$D' ? 'USD' : 'BOB';
  const id = String(raw?.id || raw?.cobroId || '').trim();
  return {
    id,
    cobroId: String(raw?.cobroId || id),
    fecha: formatDateDDMMAAAA(raw?.fecha || ''),
    clienteId: raw?.clienteId ? String(raw.clienteId).trim() : undefined,
    clienteNombre: String(raw?.clienteNombre || raw?.cliente || '').trim(),
    monedaPago,
    importeOriginalPagado: parseDecimalNumber(raw?.importeOriginalPagado ?? raw?.montoPago ?? raw?.monto ?? 0),
    tcAplicado: parseDecimalNumber(raw?.tcAplicado ?? raw?.tc ?? 6.96),
    tipoPago: String(raw?.tipoPago || 'PARCIAL').toUpperCase() === 'TOTAL' ? 'TOTAL' : 'PARCIAL',
    capitalTotalAplicado: parseDecimalNumber(raw?.capitalTotalAplicado ?? 0),
    interesTotalAplicado: parseDecimalNumber(raw?.interesTotalAplicado ?? 0),
    monedaTotalesAplicados: String(raw?.monedaTotalesAplicados || monedaPago).toUpperCase().includes('USD') ? 'USD' : 'BOB',
    capitalAplicadoUsd: parseDecimalNumber(raw?.capitalAplicadoUsd ?? 0),
    interesAplicadoUsd: parseDecimalNumber(raw?.interesAplicadoUsd ?? 0),
    capitalAplicadoBob: parseDecimalNumber(raw?.capitalAplicadoBob ?? 0),
    interesAplicadoBob: parseDecimalNumber(raw?.interesAplicadoBob ?? 0),
    notaCobroNumero: raw?.notaCobroNumero ? String(raw.notaCobroNumero).trim() : undefined,
    observacion: raw?.observacion ? String(raw.observacion).trim() : undefined,
    anulado: parseBoolFlag(raw?.anulado, false),
    creadoPor: raw?.creadoPor ? String(raw.creadoPor) : undefined,
    creadoEn: raw?.creadoEn ? String(raw.creadoEn) : undefined,
    aplicaciones: Array.isArray(raw?.aplicaciones)
      ? raw.aplicaciones.map(normalizeArDebtApplication)
      : [],
  };
}

function roundMoney2(val: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function hasDefinedValue(val: any): boolean {
  return val !== undefined && val !== null && String(val).trim() !== '';
}

export function normalizeDebitNoteLine(raw: any): DebitNoteLine {
  const monedaRaw = String(raw?.moneda || raw?.monedaDeuda || 'USD').trim().toUpperCase();
  const moneda: Currency = monedaRaw === 'BOB' || monedaRaw === 'BS' || monedaRaw === 'BS.' ? 'BOB' : 'USD';
  const deudaTipo =
    String(raw?.deudaTipo || 'TRABAJO').trim().toUpperCase() === 'VENTA_COSECHA'
      ? 'VENTA_COSECHA'
      : 'TRABAJO';
  const origenRaw = String(raw?.origen || (deudaTipo === 'VENTA_COSECHA' ? 'PROPIEDAD' : 'MAQUINARIAS'))
    .trim()
    .toUpperCase();
  const origen: 'MAQUINARIAS' | 'PROPIEDAD' = origenRaw === 'PROPIEDAD' ? 'PROPIEDAD' : 'MAQUINARIAS';

  // Preserve original operation date; never substitute today's date if absent
  const rawOpDate = raw?.fecha ?? raw?.fechaOperacion ?? raw?.fechaTrabajo ?? raw?.fechaDeuda ?? '';
  const fecha = hasDefinedValue(rawOpDate) ? formatDateDDMMAAAA(rawOpDate) : '';

  const rawDueDate = raw?.fechaVencimiento ?? '';
  const fechaVencimiento = hasDefinedValue(rawDueDate) ? formatDateDDMMAAAA(rawDueDate) : undefined;

  // Map real pending principal (GAS writes `capitalPendiente`; frontend uses `saldoPendiente`).
  // Never substitute cantidad * precioUnitario (would ignore partial payments).
  const rawPrincipal = hasDefinedValue(raw?.saldoPendiente)
    ? raw.saldoPendiente
    : hasDefinedValue(raw?.capitalPendiente)
    ? raw.capitalPendiente
    : 0;
  const saldoPendiente = roundMoney2(parseDecimalNumber(rawPrincipal));

  // Map real accrued interest (GAS writes `interesAcumulado`; frontend uses `interes`).
  const rawInterest = hasDefinedValue(raw?.interes)
    ? raw.interes
    : hasDefinedValue(raw?.interesAcumulado)
    ? raw.interesAcumulado
    : 0;
  const interes = roundMoney2(parseDecimalNumber(rawInterest));

  // Map real total receivable (GAS writes `totalPendiente`; frontend uses `totalPorCobrar`).
  const hasExplicitTotal = hasDefinedValue(raw?.totalPorCobrar) || hasDefinedValue(raw?.totalPendiente);
  const totalPorCobrar = hasExplicitTotal
    ? roundMoney2(parseDecimalNumber(hasDefinedValue(raw?.totalPorCobrar) ? raw.totalPorCobrar : raw.totalPendiente))
    : roundMoney2(saldoPendiente + interes);

  const importeOriginal = hasDefinedValue(raw?.importeOriginal)
    ? roundMoney2(parseDecimalNumber(raw.importeOriginal))
    : undefined;
  const pagosAnteriores = hasDefinedValue(raw?.pagosAnteriores)
    ? roundMoney2(parseDecimalNumber(raw.pagosAnteriores))
    : undefined;

  return {
    deudaTipo,
    deudaId: String(raw?.deudaId || '').trim(),
    fecha,
    concepto: String(raw?.concepto || '').trim(),
    origen,
    campanaNombre: raw?.campanaNombre ? String(raw.campanaNombre).trim() : undefined,
    loteNombre: raw?.loteNombre ? String(raw.loteNombre).trim() : undefined,
    maquinaNombre: raw?.maquinaNombre ? String(raw.maquinaNombre).trim() : undefined,
    cantidad: parseDecimalNumber(raw?.cantidad ?? 0),
    unidad: String(raw?.unidad || (deudaTipo === 'VENTA_COSECHA' ? 't' : 'ha')).trim(),
    precioUnitario: roundMoney2(parseDecimalNumber(raw?.precioUnitario ?? 0)),
    fechaVencimiento,
    diasAtraso: Math.max(0, Math.round(parseDecimalNumber(raw?.diasAtraso ?? 0))),
    moneda,
    importeOriginal,
    pagosAnteriores,
    saldoPendiente,
    interes,
    totalPorCobrar,
  };
}

export function normalizePaymentReceiptLine(
  raw: any,
  receiptCtx?: {
    monedaPago: Currency;
    tcAplicado: number;
    totalOriginalPagado: number;
    itemCount: number;
  }
): PaymentReceiptLine {
  const monedaDeudaRaw = String(raw?.monedaDeuda || raw?.moneda || 'USD').trim().toUpperCase();
  const monedaDeuda: Currency =
    monedaDeudaRaw === 'BOB' || monedaDeudaRaw === 'BS' || monedaDeudaRaw === 'BS.' ? 'BOB' : 'USD';

  const monedaPagoRaw = String(raw?.monedaPago || receiptCtx?.monedaPago || monedaDeuda).trim().toUpperCase();
  const monedaPago: Currency =
    monedaPagoRaw === 'BOB' || monedaPagoRaw === 'BS' || monedaPagoRaw === 'BS.' ? 'BOB' : 'USD';

  const deudaTipo =
    String(raw?.deudaTipo || 'TRABAJO').trim().toUpperCase() === 'VENTA_COSECHA'
      ? 'VENTA_COSECHA'
      : 'TRABAJO';
  const origenRaw = String(raw?.origen || (deudaTipo === 'VENTA_COSECHA' ? 'PROPIEDAD' : 'MAQUINARIAS'))
    .trim()
    .toUpperCase();
  const origen: 'MAQUINARIAS' | 'PROPIEDAD' = origenRaw === 'PROPIEDAD' ? 'PROPIEDAD' : 'MAQUINARIAS';

  const rawDebtDate = raw?.fechaDeuda ?? raw?.fechaOperacion ?? raw?.fecha ?? '';
  const fechaDeuda = hasDefinedValue(rawDebtDate) ? formatDateDDMMAAAA(rawDebtDate) : undefined;

  const importeAnterior = roundMoney2(
    parseDecimalNumber(
      hasDefinedValue(raw?.importeAnterior)
        ? raw.importeAnterior
        : hasDefinedValue(raw?.saldoAnterior)
        ? raw.saldoAnterior
        : 0
    )
  );
  const capitalPagado = roundMoney2(parseDecimalNumber(raw?.capitalPagado ?? 0));
  const interesPagado = roundMoney2(parseDecimalNumber(raw?.interesPagado ?? 0));

  const hasExplicitTotal =
    hasDefinedValue(raw?.totalPagado) ||
    hasDefinedValue(raw?.importeAplicadoDeuda) ||
    hasDefinedValue(raw?.equivalenteDescontado);
  const totalPagado = hasExplicitTotal
    ? roundMoney2(
        parseDecimalNumber(
          hasDefinedValue(raw?.totalPagado)
            ? raw.totalPagado
            : hasDefinedValue(raw?.importeAplicadoDeuda)
            ? raw.importeAplicadoDeuda
            : raw.equivalenteDescontado
        )
      )
    : roundMoney2(capitalPagado + interesPagado);

  const equivalenteDescontado = roundMoney2(
    parseDecimalNumber(
      hasDefinedValue(raw?.equivalenteDescontado)
        ? raw.equivalenteDescontado
        : hasDefinedValue(raw?.importeAplicadoDeuda)
        ? raw.importeAplicadoDeuda
        : totalPagado
    )
  );

  const saldoRestante = roundMoney2(parseDecimalNumber(raw?.saldoRestante ?? 0));
  const tcAplicado = resolveEffectiveExchangeRate(raw?.tcAplicado ?? receiptCtx?.tcAplicado ?? 6.96);

  let importeOriginalPagado: number;
  if (hasDefinedValue(raw?.importeOriginalPagado)) {
    importeOriginalPagado = roundMoney2(parseDecimalNumber(raw.importeOriginalPagado));
  } else if (receiptCtx && receiptCtx.itemCount === 1 && receiptCtx.totalOriginalPagado > 0) {
    importeOriginalPagado = roundMoney2(receiptCtx.totalOriginalPagado);
  } else if (monedaPago === monedaDeuda) {
    importeOriginalPagado = totalPagado;
  } else if (monedaDeuda === 'USD' && monedaPago === 'BOB') {
    importeOriginalPagado = roundMoney2(totalPagado * tcAplicado);
  } else {
    importeOriginalPagado = tcAplicado > 0 ? roundMoney2(totalPagado / tcAplicado) : totalPagado;
  }

  return {
    deudaTipo,
    deudaId: String(raw?.deudaId || '').trim(),
    fechaDeuda,
    concepto: String(raw?.concepto || '').trim(),
    origen,
    campanaNombre: raw?.campanaNombre ? String(raw.campanaNombre).trim() : undefined,
    loteNombre: raw?.loteNombre ? String(raw.loteNombre).trim() : undefined,
    maquinaNombre: raw?.maquinaNombre ? String(raw.maquinaNombre).trim() : undefined,
    monedaDeuda,
    importeAnterior,
    capitalPagado,
    interesPagado,
    totalPagado,
    saldoRestante,
    monedaPago,
    importeOriginalPagado,
    tcAplicado,
    equivalenteDescontado,
  };
}

export function normalizeDebitNoteRecord(raw: any): DebitNoteRecord {
  let rawItems = Array.isArray(raw?.items) ? raw.items : [];
  if (!rawItems.length && typeof raw?.snapshotJson === 'string' && raw.snapshotJson.trim()) {
    try {
      const parsed = JSON.parse(raw.snapshotJson);
      if (Array.isArray(parsed?.items)) rawItems = parsed.items;
      else if (Array.isArray(parsed)) rawItems = parsed;
    } catch {
      // ignore invalid JSON
    }
  }
  const items: DebitNoteLine[] = rawItems.map(normalizeDebitNoteLine);
  const sumUsd = roundMoney2(
    items.filter((i) => i.moneda === 'USD').reduce((acc, i) => acc + i.totalPorCobrar, 0)
  );
  const sumBob = roundMoney2(
    items.filter((i) => i.moneda === 'BOB').reduce((acc, i) => acc + i.totalPorCobrar, 0)
  );
  const totalUsd = hasDefinedValue(raw?.totalUsd)
    ? roundMoney2(parseDecimalNumber(raw.totalUsd))
    : sumUsd;
  const totalBob = hasDefinedValue(raw?.totalBob)
    ? roundMoney2(parseDecimalNumber(raw.totalBob))
    : sumBob;

  return {
    id: String(raw?.id || '').trim(),
    numero: String(raw?.numero || '').trim(),
    fecha: formatDateDDMMAAAA(raw?.fecha || raw?.fechaEmision || ''),
    clienteId: String(raw?.clienteId || '').trim(),
    clienteNombre: String(raw?.clienteNombre || '').trim(),
    clienteTelefono: raw?.clienteTelefono ? String(raw.clienteTelefono).trim() : undefined,
    clienteDireccion: raw?.clienteDireccion ? String(raw.clienteDireccion).trim() : undefined,
    totalUsd,
    totalBob,
    items,
    observacion: raw?.observacion ? String(raw.observacion).trim() : undefined,
    creadoPor: raw?.creadoPor ? String(raw.creadoPor) : undefined,
    creadoEn: raw?.creadoEn ? String(raw.creadoEn) : undefined,
  };
}

export function normalizePaymentReceiptRecord(raw: any): PaymentReceiptRecord {
  let rawItems = Array.isArray(raw?.items) ? raw.items : [];
  if (!rawItems.length && typeof raw?.snapshotJson === 'string' && raw.snapshotJson.trim()) {
    try {
      const parsed = JSON.parse(raw.snapshotJson);
      if (Array.isArray(parsed?.items)) rawItems = parsed.items;
      else if (Array.isArray(parsed)) rawItems = parsed;
    } catch {
      // ignore
    }
  }
  const rawMon = String(raw?.monedaPago || 'USD').trim().toUpperCase();
  const monedaPago: Currency = rawMon === 'BOB' || rawMon === 'BS' || rawMon === 'BS.' ? 'BOB' : 'USD';
  const importeOriginalPagado = roundMoney2(
    parseDecimalNumber(raw?.importeOriginalPagado ?? raw?.montoRecibido ?? 0)
  );
  const tcAplicado = resolveEffectiveExchangeRate(raw?.tcAplicado ?? raw?.tc ?? 6.96);

  const items: PaymentReceiptLine[] = rawItems.map((it: any) =>
    normalizePaymentReceiptLine(it, {
      monedaPago,
      tcAplicado,
      totalOriginalPagado: importeOriginalPagado,
      itemCount: rawItems.length,
    })
  );

  const sumUsd = roundMoney2(
    items.filter((i) => i.monedaDeuda === 'USD').reduce((acc, i) => acc + i.totalPagado, 0)
  );
  const sumBob = roundMoney2(
    items.filter((i) => i.monedaDeuda === 'BOB').reduce((acc, i) => acc + i.totalPagado, 0)
  );
  const totalAplicadoUsd = hasDefinedValue(raw?.totalAplicadoUsd)
    ? roundMoney2(parseDecimalNumber(raw.totalAplicadoUsd))
    : sumUsd;
  const totalAplicadoBob = hasDefinedValue(raw?.totalAplicadoBob)
    ? roundMoney2(parseDecimalNumber(raw.totalAplicadoBob))
    : sumBob;

  return {
    id: String(raw?.id || '').trim(),
    numero: String(raw?.numero || '').trim(),
    cobroId: String(raw?.cobroId || '').trim(),
    fecha: formatDateDDMMAAAA(raw?.fecha || raw?.fechaEmision || ''),
    clienteId: String(raw?.clienteId || '').trim(),
    clienteNombre: String(raw?.clienteNombre || '').trim(),
    clienteTelefono: raw?.clienteTelefono ? String(raw.clienteTelefono).trim() : undefined,
    clienteDireccion: raw?.clienteDireccion ? String(raw.clienteDireccion).trim() : undefined,
    tipoPago: String(raw?.tipoPago || 'PARCIAL').toUpperCase() === 'TOTAL' ? 'TOTAL' : 'PARCIAL',
    monedaPago,
    importeOriginalPagado,
    tcAplicado,
    totalAplicadoUsd,
    totalAplicadoBob,
    items,
    observacion: raw?.observacion ? String(raw.observacion).trim() : undefined,
    anulado: parseBoolFlag(raw?.anulado, false),
    creadoPor: raw?.creadoPor ? String(raw.creadoPor) : undefined,
    creadoEn: raw?.creadoEn ? String(raw.creadoEn) : undefined,
  };
}

export interface ArSummaryResponse {
  customers: ArCustomerSummary[];
  unassignedDebts: ArDebt[];
  totals: {
    capitalUsd: number;
    interesUsd: number;
    totalUsd: number;
    capitalBob: number;
    interesBob: number;
    totalBob: number;
    unassignedUsd: number;
    unassignedBob: number;
    unassignedCount: number;
  };
}

export async function getArSummary(useCache = true): Promise<ArSummaryResponse> {
  const res = await callGAS<any>('ar.summary', {}, useCache);
  const src = res?.result || res || {};
  const customersRaw = Array.isArray(src.customers)
    ? src.customers
    : Array.isArray(src.clientes)
    ? src.clientes
    : [];
  const unassignedRaw = Array.isArray(src.unassignedDebts)
    ? src.unassignedDebts
    : Array.isArray(src.deudasSinCliente)
    ? src.deudasSinCliente
    : [];
  const totalsRaw = src.totals || src.totales || {};

  return {
    customers: customersRaw.map(normalizeArCustomerSummary),
    unassignedDebts: unassignedRaw.map(normalizeArDebt),
    totals: {
      capitalUsd: parseDecimalNumber(totalsRaw.capitalUsd ?? 0),
      interesUsd: parseDecimalNumber(totalsRaw.interesUsd ?? 0),
      totalUsd: parseDecimalNumber(totalsRaw.totalUsd ?? 0),
      capitalBob: parseDecimalNumber(totalsRaw.capitalBob ?? 0),
      interesBob: parseDecimalNumber(totalsRaw.interesBob ?? 0),
      totalBob: parseDecimalNumber(totalsRaw.totalBob ?? 0),
      unassignedUsd: parseDecimalNumber(totalsRaw.unassignedUsd ?? 0),
      unassignedBob: parseDecimalNumber(totalsRaw.unassignedBob ?? 0),
      unassignedCount: Math.round(parseDecimalNumber(totalsRaw.unassignedCount ?? unassignedRaw.length)),
    },
  };
}

export interface ArCustomerDetailResponse {
  customer: Customer;
  summary: ArCustomerSummary;
  debts: ArDebt[];
  payments: ArPaymentRecord[];
  debitNotes: DebitNoteRecord[];
  paymentReceipts: PaymentReceiptRecord[];
}

export async function getArCustomerDetail(
  clienteId: string,
  useCache = true
): Promise<ArCustomerDetailResponse> {
  const res = await callGAS<any>('ar.customer', { clienteId }, useCache);
  const src = res?.result || res || {};
  return {
    customer: normalizeCustomer(src.customer || src.cliente || { id: clienteId }),
    summary: normalizeArCustomerSummary(src.summary || src.resumen || { clienteId }),
    debts: (Array.isArray(src.debts) ? src.debts : Array.isArray(src.deudas) ? src.deudas : []).map(normalizeArDebt),
    payments: (Array.isArray(src.payments) ? src.payments : Array.isArray(src.cobros) ? src.cobros : []).map(
      normalizeArPaymentRecord
    ),
    debitNotes: (Array.isArray(src.debitNotes) ? src.debitNotes : Array.isArray(src.notasDebito) ? src.notasDebito : []).map(
      normalizeDebitNoteRecord
    ),
    paymentReceipts: (
      Array.isArray(src.paymentReceipts)
        ? src.paymentReceipts
        : Array.isArray(src.notasCobro)
        ? src.notasCobro
        : []
    ).map(normalizePaymentReceiptRecord),
  };
}

export async function assignDebtCustomer(params: {
  deudaTipo: 'TRABAJO' | 'VENTA_COSECHA';
  deudaId: string;
  clienteId: string;
}): Promise<void> {
  await callGAS<any>('ar.debt.assignCustomer', params, false);
  invalidateBackendDomains(['ar.', 'work.', 'harvestSale.', 'customer.']);
}

export async function registerArPayment(params: {
  clienteId: string;
  fecha: string;
  monedaPago: Currency;
  tcAplicado: number;
  observacion?: string;
  idempotencyKey?: string;
  aplicaciones: Array<{
    deudaTipo: 'TRABAJO' | 'VENTA_COSECHA';
    deudaId: string;
    importeOriginalPagado: number;
  }>;
}): Promise<{
  payment: ArPaymentRecord;
  receipt: PaymentReceiptRecord | null;
}> {
  const payload = {
    clienteId: params.clienteId,
    fecha: params.fecha,
    monedaPago: params.monedaPago === 'USD' ? 'USD' : 'BOB',
    tcAplicado: resolveEffectiveExchangeRate(params.tcAplicado),
    observacion: (params.observacion || '').trim(),
    idempotencyKey: params.idempotencyKey || `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    aplicaciones: params.aplicaciones.map((a) => ({
      deudaTipo: a.deudaTipo,
      deudaId: a.deudaId,
      importeOriginalPagado: parseDecimalNumber(a.importeOriginalPagado),
    })),
  };
  const res = await callGAS<any>('ar.payment.register', payload, false);
  invalidateBackendDomains(['ar.', 'cobros.', 'movement.', 'report.', 'harvestSale.', 'work.']);
  const src = res?.result || res || {};
  return {
    payment: normalizeArPaymentRecord(src.payment || src.cobro || {}),
    receipt: src.receipt || src.notaCobro ? normalizePaymentReceiptRecord(src.receipt || src.notaCobro) : null,
  };
}

export async function cancelArPayment(cobroId: string): Promise<void> {
  await callGAS<any>('ar.payment.cancel', { cobroId }, false);
  invalidateBackendDomains(['ar.', 'cobros.', 'movement.', 'report.', 'harvestSale.', 'work.']);
}

export async function createDebitNote(params: {
  clienteId: string;
  fecha: string;
  deudas: Array<{ deudaTipo: 'TRABAJO' | 'VENTA_COSECHA'; deudaId: string }>;
  observacion?: string;
  idempotencyKey?: string;
}): Promise<DebitNoteRecord> {
  const payload = {
    clienteId: params.clienteId,
    fecha: params.fecha,
    deudas: params.deudas,
    observacion: (params.observacion || '').trim(),
    idempotencyKey: params.idempotencyKey || `nd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
  const res = await callGAS<any>('ar.debitNote.create', payload, false);
  invalidateBackendDomains(['ar.']);
  const src = res?.debitNote || res?.notaDebito || res?.result || res;
  return normalizeDebitNoteRecord(src);
}

export async function getArDocuments(
  clienteId?: string,
  useCache = true
): Promise<{ debitNotes: DebitNoteRecord[]; paymentReceipts: PaymentReceiptRecord[] }> {
  const res = await callGAS<any>('ar.documents', clienteId ? { clienteId } : {}, useCache);
  const src = res?.result || res || {};
  return {
    debitNotes: (Array.isArray(src.debitNotes) ? src.debitNotes : Array.isArray(src.notasDebito) ? src.notasDebito : []).map(
      normalizeDebitNoteRecord
    ),
    paymentReceipts: (
      Array.isArray(src.paymentReceipts)
        ? src.paymentReceipts
        : Array.isArray(src.notasCobro)
        ? src.notasCobro
        : []
    ).map(normalizePaymentReceiptRecord),
  };
}


