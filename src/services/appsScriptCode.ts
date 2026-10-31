/**
 * Production-ready Google Apps Script (Code.gs) implementation for Google Sheets.
 * Estructura EXACTA de las 14 hojas originales y sus columnas en orden estricto:
 * 
 * 1.  Configuracion: clave, valor, actualizadoEn
 * 2.  Usuarios: id, usuario, nombre, rol, salt, hash, version, activo, creadoEn, actualizadoEn
 * 3.  AccesoInicial: usuario, pinTemporal, estado
 * 4.  CambioClaves: usuario, pinNuevo, estado
 * 5.  Sesiones: id, usuarioId, tokenHash, version, venceEn, revocada, creadoEn, ultimoUso
 * 6.  Campanas: id, nombre, activa, creadoEn
 * 7.  Lotes: id, nombre, hectareas, ubicacion, activo, creadoEn
 * 8.  Maquinas: id, nombre, tipo, icono, unidad, tarifa, moneda, activo, creadoEn
 * 9.  Items: id, nombre, modulo, clase, icono, unidad, precio, moneda, activo
 * 10. Trabajos: id, fecha, campanaId, maquinaId, destino, loteId, cliente, cantidad, unidad, precioUnitario, moneda, tc, importe, observacion, creadoPor, creadoEn, actualizadoEn
 * 11. Movimientos: id, fecha, campanaId, modulo, clase, itemId, descripcion, loteId, maquinaId, cantidad, unidad, precioUnitario, importe, moneda, tc, trabajoId, creadoPor, creadoEn, actualizadoEn
 * 12. Activos: id, tipo, referenciaId, nombre, valorInicial, moneda, tc, fecha, observacion, activo
 * 13. Mejoras: id, activoId, fecha, descripcion, importe, moneda, tc, observacion, creadoPor, creadoEn
 * 14. Auditoria: id, fecha, usuarioId, accion, entidad, entidadId, detalle
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * MAQUINARIAS Y PROPIEDAD - Backend Google Apps Script (Code.gs)
 * Base de datos: Google Sheets (Estructura Original Estricta de 14 Hojas)
 */

// -------------------------------------------------------------
// DEFINICIÓN EXACTA DE LAS 14 HOJAS Y COLUMNAS ORIGINALES
// -------------------------------------------------------------

const SHEET_SCHEMAS = {
  Configuracion: ['clave', 'valor', 'actualizadoEn'],
  Usuarios: ['id', 'usuario', 'nombre', 'rol', 'salt', 'hash', 'version', 'activo', 'creadoEn', 'actualizadoEn'],
  AccesoInicial: ['usuario', 'pinTemporal', 'estado'],
  CambioClaves: ['usuario', 'pinNuevo', 'estado'],
  Sesiones: ['id', 'usuarioId', 'tokenHash', 'version', 'venceEn', 'revocada', 'creadoEn', 'ultimoUso'],
  Campanas: ['id', 'nombre', 'activa', 'creadoEn'],
  Lotes: ['id', 'nombre', 'hectareas', 'ubicacion', 'activo', 'creadoEn'],
  Maquinas: ['id', 'nombre', 'tipo', 'icono', 'unidad', 'tarifa', 'moneda', 'activo', 'creadoEn'],
  TrabajosMaquinaria: ['id', 'maquinaId', 'nombre', 'icono', 'unidad', 'tarifa', 'moneda', 'activo', 'creadoEn', 'actualizadoEn'],
  Items: ['id', 'nombre', 'modulo', 'clase', 'icono', 'unidad', 'precio', 'moneda', 'activo'],
  Trabajos: ['id', 'fecha', 'campanaId', 'maquinaId', 'destino', 'loteId', 'cliente', 'cantidad', 'unidad', 'precioUnitario', 'moneda', 'tc', 'importe', 'observacion', 'creadoPor', 'creadoEn', 'actualizadoEn'],
  Movimientos: ['id', 'fecha', 'campanaId', 'modulo', 'clase', 'itemId', 'descripcion', 'loteId', 'maquinaId', 'cantidad', 'unidad', 'precioUnitario', 'importe', 'moneda', 'tc', 'trabajoId', 'creadoPor', 'creadoEn', 'actualizadoEn'],
  Activos: ['id', 'tipo', 'referenciaId', 'nombre', 'valorInicial', 'moneda', 'tc', 'fecha', 'observacion', 'activo'],
  Mejoras: ['id', 'activoId', 'fecha', 'descripcion', 'importe', 'moneda', 'tc', 'observacion', 'creadoPor', 'creadoEn'],
  Auditoria: ['id', 'fecha', 'usuarioId', 'accion', 'entidad', 'entidadId', 'detalle']
};

// -------------------------------------------------------------
// DISPATCHER PRINCIPAL
// -------------------------------------------------------------

function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }
    const res = dispatch_(payload);
    return createJsonResponse(res);
  } catch (err) {
    return createJsonResponse({ ok: false, error: err.message });
  }
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'health';
    if (action === 'health') {
      return createJsonResponse({ ok: true, service: 'AGRICULTURA_MAQUINARIAS', version: '3.0.0' });
    }
    return createJsonResponse({ ok: false, error: 'Método GET no permitido para esta acción' });
  } catch (err) {
    return createJsonResponse({ ok: false, error: err.message });
  }
}

function dispatch_(p) {
  const action = p.action || '';
  const data = p.data || {};

  // 1. Acciones públicas sin token
  if (action === 'health') {
    return { ok: true, service: 'AGRICULTURA_MAQUINARIAS', version: '3.0.0' };
  }

  if (action === 'auth.login' || action === 'login') {
    return handleLogin(data);
  }

  if (action === 'auth.admin.authorize') {
    return handleAdminAuthorize(data);
  }

  // 2. Validación de sesión (Usuario y/o Administrador)
  const userToken = p.token || (p.data && p.data.token);
  const adminTok = p.tokenAdmin || p.adminToken || (p.data && (p.data.tokenAdmin || p.data.adminToken));

  const adminSession = validateAdminToken(adminTok);
  const userSession = validateToken(userToken);

  // Si ninguna de las dos credenciales es válida, rechazar la petición
  const effectiveSession = adminSession || userSession;
  if (!effectiveSession) {
    return { ok: false, error: 'Sesión vencida o revocada. Inicie sesión nuevamente.', code: 'SESSION_EXPIRED' };
  }

  if (action === 'auth.session.validate') {
    return {
      ok: true,
      valid: true,
      usuario: effectiveSession.usuarioId,
      rol: adminSession ? 'admin' : (userSession ? userSession.rol : 'usuario')
    };
  }

  if (action === 'auth.logout' || action === 'logout') {
    return handleLogout(userToken, adminTok);
  }

  // 3. Verificación y revocación de autorización de dispositivo admin
  if (action === 'auth.admin.verify') {
    return handleAdminVerify(adminTok);
  }

  if (action === 'auth.admin.revoke') {
    return handleAdminRevoke(adminTok);
  }

  // 4. Acciones Administrativas Protegidas (Exigen token administrativo válido)
  // NOTA: fx.get y getExchangeRateConfig NO están aquí: se consultan con sesión operativa normal.
  const adminActions = [
    'auth.password.change',
    'password.change',
    'getCampaigns',
    'campaign.create',
    'createCampaign',
    'campaign.activate',
    'setActiveCampaign',
    'getMachines',
    'createMachine',
    'updateMachine',
    'deleteMachine',
    'machine.create',
    'machine.update',
    'machine.delete',
    'machine.save',
    'machineJobType.save',
    'machineJobType.delete',
    'machineJobType.seed',
    'getLots',
    'createLot',
    'updateLot',
    'deleteLot',
    'lot.create',
    'lot.update',
    'lot.delete',
    'lot.save',
    'getItemsConfig',
    'saveItemConfig',
    'item.save',
    'item.delete',
    'saveExchangeRateConfig',
    'fx.set',
    'getAssets',
    'asset.list',
    'createAsset',
    'asset.create',
    'updateAsset',
    'asset.update',
    'addAssetImprovement',
    'updateAssetImprovement',
    'deleteAssetImprovement',
    'asset.improvement.add',
    'asset.improvement.update',
    'asset.improvement.delete',
    'asset.save',
    'report.get',
    'reports.get',
    'financial.reports'
  ];

  if (adminActions.indexOf(action) !== -1) {
    if (!adminSession) {
      return {
        ok: false,
        error: 'Acceso denegado: se requiere autorización administrativa (CONTRASENA_ADMIN). Autorice este dispositivo.'
      };
    }
  }

  // 5. Ejecución de la acción solicitada
  const effectiveUserSession = userSession || adminSession;
  return handleAction_(action, data, effectiveUserSession, adminSession);
}

function handleAction_(action, payload, userSession, adminSession) {
  switch (action) {
    // --- Catálogo y Configuración General ---
    case 'catalog.list':
      return handleCatalogList();

    // --- Campañas (Hoja Campanas) ---
    case 'getCampaigns':
      return handleGetCampaigns();
    case 'campaign.create':
    case 'createCampaign':
      return handleCreateCampaign(payload.campaign || payload, userSession);
    case 'campaign.activate':
    case 'setActiveCampaign':
      return handleSetActiveCampaign(payload.campaignId || payload.id, userSession);

    // --- Maquinarias (Hoja Maquinas) ---
    case 'getMachines':
      return handleGetMachines();
    case 'machine.create':
    case 'createMachine':
      return handleCreateMachine(payload.machine || payload.maquinaria || payload, userSession);
    case 'machine.update':
    case 'updateMachine':
      return handleUpdateMachine(payload.id, payload.machine || payload.maquinaria || payload, userSession);
    case 'machine.delete':
    case 'deleteMachine':
      return handleDeleteMachine(payload.id || payload.maquinariaId, userSession);
    case 'machine.save':
      if (payload.deleted || payload.action === 'delete') {
        return handleDeleteMachine(payload.id || payload.maquinariaId, userSession);
      }
      if (payload.id) {
        return handleUpdateMachine(payload.id, payload.machine || payload.maquinaria || payload, userSession);
      }
      return handleCreateMachine(payload.machine || payload.maquinaria || payload, userSession);

    // --- Trabajos y Tarifas por Máquina (Hoja TrabajosMaquinaria) ---
    case 'machineJobType.list':
      return handleGetMachineJobTypes(payload.maquinaId);
    case 'machineJobType.save':
      return handleSaveMachineJobType(payload.jobType || payload.trabajo || payload, userSession);
    case 'machineJobType.delete':
      return handleDeleteMachineJobType(payload.id, userSession);
    case 'machineJobType.seed':
      return handleSeedNewHollandJobs(payload.maquinaId, userSession);

    // --- Lotes (Hoja Lotes) ---
    case 'getLots':
      return handleGetLots();
    case 'lot.create':
    case 'createLot':
      return handleCreateLot(payload.lot || payload.lote || payload, userSession);
    case 'lot.update':
    case 'updateLot':
      return handleUpdateLot(payload.id, payload.lot || payload.lote || payload, userSession);
    case 'lot.delete':
    case 'deleteLot':
      return handleDeleteLot(payload.id, userSession);
    case 'lot.save':
      if (payload.deleted || payload.action === 'delete') {
        return handleDeleteLot(payload.id, userSession);
      }
      if (payload.id) {
        return handleUpdateLot(payload.id, payload.lot || payload.lote || payload, userSession);
      }
      return handleCreateLot(payload.lot || payload.lote || payload, userSession);

    // --- Trabajos de Maquinaria (Hoja Trabajos) ---
    case 'getMachineryJobs':
    case 'work.list':
      return handleGetMachineryJobs(payload.campanaId);
    case 'createMachineryJob':
    case 'work.save':
      if (payload.id || (payload.job && payload.job.id) || (payload.trabajo && payload.trabajo.id)) {
        return handleUpdateMachineryJob(payload.id || (payload.job && payload.job.id) || (payload.trabajo && payload.trabajo.id), payload.job || payload.trabajo || payload, userSession);
      }
      return handleCreateMachineryJob(payload.job || payload.trabajo || payload, userSession);
    case 'deleteMachineryJob':
    case 'work.delete':
      return handleDeleteMachineryJob(payload.id || payload.jobId, userSession);

    // --- Movimientos (Hoja Movimientos: Gastos e Ingresos) ---
    case 'movement.list':
      return handleGetMovements(payload.campanaId, payload.modulo, payload.clase || payload.tipo);

    case 'getExpenses':
    case 'movement.list.expenses':
      return handleGetExpenses(payload.campanaId, payload.modulo);
    case 'createExpense':
    case 'movement.save.expense':
      if (payload.id || (payload.expense && payload.expense.id)) {
        return handleUpdateExpense(payload.id || payload.expense.id, payload.expense || payload, userSession);
      }
      return handleCreateExpense(payload.expense || payload, userSession);
    case 'updateExpense':
      return handleUpdateExpense(payload.id || (payload.expense && payload.expense.id), payload.expense || payload, userSession);
    case 'deleteExpense':
    case 'movement.delete.expense':
      return handleDeleteExpense(payload.id || payload.movimientoId, userSession);

    case 'getIncomes':
    case 'movement.list.incomes':
      return handleGetIncomes(payload.campanaId, payload.modulo);
    case 'createIncome':
    case 'movement.save.income':
      if (payload.id || (payload.income && payload.income.id)) {
        return handleUpdateIncome(payload.id || payload.income.id, payload.income || payload, userSession);
      }
      return handleCreateIncome(payload.income || payload, userSession);
    case 'updateIncome':
      return handleUpdateIncome(payload.id || (payload.income && payload.income.id), payload.income || payload, userSession);
    case 'deleteIncome':
    case 'movement.delete.income':
      return handleDeleteIncome(payload.id || payload.movimientoId, userSession);

    case 'movement.save': {
      if (payload.id) {
        return handleUpdateMovement(payload.id, payload, userSession);
      }
      const isInc = String(payload.clase || payload.tipo || '').toUpperCase().includes('ING');
      if (isInc) {
        return handleCreateIncome(payload.income || payload, userSession);
      }
      return handleCreateExpense(payload.expense || payload, userSession);
    }
    case 'movement.update':
      return handleUpdateMovement(payload.id || payload.movimientoId, payload.movement || payload.movimiento || payload, userSession);

    case 'movement.delete':
      return handleDeleteMovement(payload.id || payload.movimientoId, userSession);

    // --- Reportes Financieros Consolidados ---
    case 'report.get':
    case 'reports.get':
    case 'financial.reports':
      return handleGetFinancialReports(payload.campanaId);

    // --- Ítems Configurables (Hoja Items) ---
    case 'getItemsConfig':
      return handleGetItemsConfig();
    case 'saveItemConfig':
    case 'item.save':
      return handleSaveItemConfig(payload.item || payload, userSession);

    // --- Tipo de Cambio (Hoja Configuracion) ---
    case 'getExchangeRateConfig':
    case 'fx.get':
      return handleGetExchangeRate();
    case 'saveExchangeRateConfig':
    case 'fx.set':
      return handleSaveExchangeRate(payload.config || payload, userSession);

    // --- Activos Patrimoniales y Mejoras (Hojas Activos y Mejoras) ---
    case 'getAssets':
    case 'asset.list':
      return handleGetAssets();
    case 'createAsset':
    case 'asset.create':
      return handleCreateAsset(payload.asset || payload, userSession);
    case 'updateAsset':
    case 'asset.update':
      return handleUpdateAsset(payload.id || payload.assetId || (payload.asset && payload.asset.id), payload.asset || payload, userSession);
    case 'addAssetImprovement':
    case 'asset.improvement.add':
      return handleAddAssetImprovement(payload.assetId || payload.id, payload.improvement || payload, userSession);
    case 'updateAssetImprovement':
    case 'asset.improvement.update':
      return handleUpdateAssetImprovement(payload.id || payload.mejoraId || (payload.improvement && payload.improvement.id), payload.improvement || payload, userSession);
    case 'deleteAssetImprovement':
    case 'asset.improvement.delete':
      return handleDeleteAssetImprovement(payload.id || payload.mejoraId, userSession);
    case 'asset.save':
      if (payload.action === 'delete_improvement' || payload.deleteImprovement) {
        return handleDeleteAssetImprovement(payload.id || payload.mejoraId, userSession);
      }
      if (payload.action === 'update_improvement' || payload.updateImprovement) {
        return handleUpdateAssetImprovement(payload.id || payload.mejoraId || (payload.improvement && payload.improvement.id), payload.improvement || payload, userSession);
      }
      if (payload.improvement || payload.assetId) {
        return handleAddAssetImprovement(payload.assetId || payload.id, payload.improvement || payload, userSession);
      }
      if (payload.id) {
        return handleUpdateAsset(payload.id, payload.asset || payload, userSession);
      }
      return handleCreateAsset(payload.asset || payload, userSession);

    // --- Cambio de Contraseñas e Invalidación de Sesiones ---
    case 'auth.password.change':
    case 'password.change':
      return handleChangePassword(payload, userSession, adminSession);

    default:
      return { ok: false, error: 'Acción no reconocida en Google Apps Script: ' + action };
  }
}

// -------------------------------------------------------------
// GESTIÓN DE CONFIGURACIÓN Y CONTRASEÑAS EN HOJA CONFIGURACION
// -------------------------------------------------------------

function findSheetIgnoreCase_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const target = String(name).trim().toLowerCase();
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().trim().toLowerCase() === target) {
      return sheets[i];
    }
  }
  return null;
}

function getSheetHeaders_(sheet) {
  if (!sheet) return [];
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
}

function getHeaderIndexMap_(headers) {
  const map = {};
  for (let i = 0; i < headers.length; i++) {
    map[headers[i].toLowerCase()] = i;
  }
  return map;
}

function validateRequiredColumns_(sheetName, headers, requiredCols) {
  const map = getHeaderIndexMap_(headers);
  const missing = [];
  for (let i = 0; i < requiredCols.length; i++) {
    if (map[requiredCols[i].toLowerCase()] === undefined) {
      missing.push(requiredCols[i]);
    }
  }
  if (missing.length > 0) {
    throw new Error('Estructura inválida en hoja ' + sheetName + ': faltan columnas [' + missing.join(', ') + ']');
  }
}

/**
 * Obtiene un valor de la hoja "Configuracion" por su clave exacta.
 * Columnas: clave, valor, actualizadoEn
 */
function getConfigValue(key, defaultValue) {
  const sheet = findSheetIgnoreCase_('Configuracion');
  if (!sheet) return defaultValue;

  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return defaultValue;

  const headers = rows[0];
  validateRequiredColumns_('Configuracion', headers, ['clave', 'valor']);
  const map = getHeaderIndexMap_(headers);
  const keyCol = map['clave'];
  const valCol = map['valor'];

  const normKey = String(key).trim().toUpperCase();
  for (let i = 1; i < rows.length; i++) {
    const k = String(rows[i][keyCol]).trim().toUpperCase();
    if (k === normKey) {
      const v = rows[i][valCol];
      return v !== null && v !== undefined && v !== '' ? String(v).trim() : defaultValue;
    }
  }

  return defaultValue;
}

/**
 * Guarda o actualiza un valor en la hoja "Configuracion".
 * Columnas: clave, valor, actualizadoEn
 */
function setConfigValue(key, value) {
  const sheet = findSheetIgnoreCase_('Configuracion');
  if (!sheet) throw new Error('Hoja Configuracion no encontrada en Google Sheets.');

  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  validateRequiredColumns_('Configuracion', headers, ['clave', 'valor', 'actualizadoEn']);
  const map = getHeaderIndexMap_(headers);
  const keyCol = map['clave'];
  const valCol = map['valor'];
  const actCol = map['actualizadoen'];

  const normKey = String(key).trim().toUpperCase();
  const ahora = new Date().toISOString();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][keyCol]).trim().toUpperCase() === normKey) {
      sheet.getRange(i + 1, valCol + 1).setValue(value);
      sheet.getRange(i + 1, actCol + 1).setValue(ahora);
      return;
    }
  }

  // Si no existía, agregar fila respetando orden de columnas
  const newRow = [];
  newRow[keyCol] = key;
  newRow[valCol] = value;
  newRow[actCol] = ahora;
  sheet.appendRow(newRow);
}

function hashPassword_(pwd) {
  if (!pwd) return '';
  const rawBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pwd).trim());
  let hex = '';
  for (let i = 0; i < rawBytes.length; i++) {
    const b = rawBytes[i];
    const v = (b < 0 ? b + 256 : b).toString(16);
    hex += (v.length === 1 ? '0' + v : v);
  }
  return hex;
}

function generateSalt_() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 16);
}

function hashWithSalt_(password, salt) {
  if (!password) return '';
  const salted = String(salt || '') + ':' + String(password).trim();
  const rawBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salted);
  let hex = '';
  for (let i = 0; i < rawBytes.length; i++) {
    const b = rawBytes[i];
    const v = (b < 0 ? b + 256 : b).toString(16);
    hex += (v.length === 1 ? '0' + v : v);
  }
  return hex;
}

function createSaltedPassword_(password) {
  const salt = generateSalt_();
  const hash = hashWithSalt_(password, salt);
  return 'sha256:' + salt + ':' + hash;
}

function verifyPasswordAgainstStored_(inputPassword, storedValue) {
  if (!inputPassword || !storedValue) return false;
  const inputStr = String(inputPassword).trim();
  const storedStr = String(storedValue).trim();

  // Si está almacenada con el esquema moderno sha256:salt:hash
  if (storedStr.indexOf('sha256:') === 0) {
    const parts = storedStr.split(':');
    if (parts.length >= 3) {
      const salt = parts[1];
      const expectedHash = parts[2];
      const calculatedHash = hashWithSalt_(inputStr, salt);
      return calculatedHash.toLowerCase() === expectedHash.toLowerCase();
    }
  }

  // Compatibilidad hacia atrás garantizada: si todavía está en texto plano
  return inputStr === storedStr;
}

// -------------------------------------------------------------
// AUTENTICACIÓN Y SESIONES (HOJA SESIONES ORIGINAL)
// Columnas: id, usuarioId, tokenHash, version, venceEn, revocada, creadoEn, ultimoUso
// -------------------------------------------------------------

function handleLogin(data) {
  const inputPwd = String(data.password || data.contrasena || data.pin || '').trim();
  if (!inputPwd) {
    return { ok: false, error: 'Por favor ingrese la contraseña.' };
  }

  const userStoredPwd = getConfigValue('CONTRASENA_USUARIO', '');
  const adminStoredPwd = getConfigValue('CONTRASENA_ADMIN', '');

  const isUserMatch = verifyPasswordAgainstStored_(inputPwd, userStoredPwd);
  const isAdminMatch = verifyPasswordAgainstStored_(inputPwd, adminStoredPwd);

  if (!isUserMatch && !isAdminMatch) {
    return {
      ok: false,
      error: 'Contraseña incorrecta. Verifique las credenciales en la hoja Configuracion.'
    };
  }

  // Si coincide con Administrador se otorga rol admin y credencial administrativa
  const rol = isAdminMatch ? 'admin' : 'usuario';
  const nombre = isAdminMatch ? 'Administrador' : 'Operador';
  const matchedStored = isAdminMatch ? adminStoredPwd : userStoredPwd;
  const pwdVersion = hashPassword_(matchedStored);

  const token = Utilities.getUuid();
  const tokenHash = hashPassword_(token);
  // Sesiones de admin duran 60 días persistentes; sesiones de usuario 14 días
  const expira = new Date(Date.now() + (isAdminMatch ? 60 : 14) * 24 * 60 * 60 * 1000).toISOString();
  const ahora = new Date().toISOString();

  const sheet = findSheetIgnoreCase_('Sesiones');
  if (!sheet) throw new Error('Hoja Sesiones no encontrada en Google Sheets.');

  const headers = getSheetHeaders_(sheet);
  validateRequiredColumns_('Sesiones', headers, SHEET_SCHEMAS.Sesiones);
  const map = getHeaderIndexMap_(headers);

  const row = [];
  row[map['id']] = Utilities.getUuid();
  row[map['usuarioid']] = rol;
  row[map['tokenhash']] = tokenHash;
  row[map['version']] = pwdVersion;
  row[map['venceen']] = expira;
  row[map['revocada']] = false;
  row[map['creadoen']] = ahora;
  row[map['ultimouso']] = ahora;

  sheet.appendRow(row);

  logAudit_(rol, 'LOGIN', 'Sesiones', row[map['id']], 'Inicio de sesión exitoso como ' + nombre);

  const resData = {
    token: token,
    usuario: rol,
    nombre: nombre,
    rol: rol,
    expira: expira
  };

  if (isAdminMatch) {
    resData.tokenAdmin = token;
  }

  return {
    ok: true,
    result: resData
  };
}

function validateToken(token) {
  if (!token) return null;
  const sheet = findSheetIgnoreCase_('Sesiones');
  if (!sheet) return null;

  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return null;

  const headers = rows[0];
  const map = getHeaderIndexMap_(headers);
  const tokenHashCol = map['tokenhash'];
  const venceEnCol = map['venceen'];
  const revocadaCol = map['revocada'];
  const versionCol = map['version'];
  const userIdCol = map['usuarioid'];
  const ultimoUsoCol = map['ultimouso'];

  const inputHash = hashPassword_(token);
  const currentPwd = getConfigValue('CONTRASENA_USUARIO', '');
  const currentHash = currentPwd ? hashPassword_(currentPwd) : '';

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][tokenHashCol]) === inputHash) {
      const isRevocada = rows[i][revocadaCol] === true || String(rows[i][revocadaCol]).toLowerCase() === 'true';
      if (isRevocada) return null;

      const venceEn = rows[i][venceEnCol];
      if (venceEn && new Date(venceEn).getTime() < Date.now()) {
        sheet.getRange(i + 1, revocadaCol + 1).setValue(true);
        return null;
      }

      // Si cambió la contraseña en Configuracion, invalidar la sesión
      const stampedVersion = rows[i][versionCol];
      const uId = String(rows[i][userIdCol] || '');
      if (uId === 'usuario' && currentHash && stampedVersion && stampedVersion !== currentHash) {
        sheet.getRange(i + 1, revocadaCol + 1).setValue(true);
        return null;
      }
      if (uId === 'admin') {
        const currentAdminPwd = getConfigValue('CONTRASENA_ADMIN', '');
        const currentAdminHash = currentAdminPwd ? hashPassword_(currentAdminPwd) : '';
        if (currentAdminHash && stampedVersion && stampedVersion !== currentAdminHash) {
          sheet.getRange(i + 1, revocadaCol + 1).setValue(true);
          return null;
        }
      }

      // Actualizar último uso
      sheet.getRange(i + 1, ultimoUsoCol + 1).setValue(new Date().toISOString());

      return {
        id: rows[i][map['id']],
        usuarioId: uId,
        rol: uId
      };
    }
  }

  return null;
}

function handleLogout(userToken, adminTok) {
  if (!userToken && !adminTok) return { ok: true };
  const sheet = findSheetIgnoreCase_('Sesiones');
  if (!sheet) return { ok: true };

  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return { ok: true };

  const map = getHeaderIndexMap_(rows[0]);
  const tokenHashCol = map['tokenhash'];
  const revocadaCol = map['revocada'];

  const hashesToRevoke = [];
  if (userToken) hashesToRevoke.push(hashPassword_(userToken));
  if (adminTok) hashesToRevoke.push(hashPassword_(adminTok));

  for (let i = 1; i < rows.length; i++) {
    const rowHash = String(rows[i][tokenHashCol]);
    if (hashesToRevoke.indexOf(rowHash) !== -1) {
      sheet.getRange(i + 1, revocadaCol + 1).setValue(true);
    }
  }
  SpreadsheetApp.flush();
  return { ok: true };
}

function handleAdminAuthorize(data) {
  const inputPwd = String(data.password || data.contrasena || data.contrasenaAdmin || '').trim();
  if (!inputPwd) {
    return { ok: false, error: 'Por favor ingrese la contraseña de administrador (CONTRASENA_ADMIN).' };
  }

  const currentAdminPwd = getConfigValue('CONTRASENA_ADMIN', '');
  if (!currentAdminPwd || !verifyPasswordAgainstStored_(inputPwd, currentAdminPwd)) {
    return {
      ok: false,
      error: 'Contraseña de administrador incorrecta. Verifique la clave CONTRASENA_ADMIN en la hoja Configuracion.'
    };
  }

  const tokenAdmin = Utilities.getUuid();
  const tokenHash = hashPassword_(tokenAdmin);
  const pwdHash = hashPassword_(currentAdminPwd);
  const expira = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 días persistente
  const ahora = new Date().toISOString();

  const sheet = findSheetIgnoreCase_('Sesiones');
  if (!sheet) throw new Error('Hoja Sesiones no encontrada en Google Sheets.');

  const headers = getSheetHeaders_(sheet);
  validateRequiredColumns_('Sesiones', headers, SHEET_SCHEMAS.Sesiones);
  const map = getHeaderIndexMap_(headers);

  const row = [];
  row[map['id']] = Utilities.getUuid();
  row[map['usuarioid']] = 'admin';
  row[map['tokenhash']] = tokenHash;
  row[map['version']] = pwdHash;
  row[map['venceen']] = expira;
  row[map['revocada']] = false;
  row[map['creadoen']] = ahora;
  row[map['ultimouso']] = ahora;

  sheet.appendRow(row);

  logAudit_('admin', 'ADMIN_AUTHORIZE', 'Sesiones', row[map['id']], 'Dispositivo autorizado como Administrador');

  return {
    ok: true,
    result: {
      tokenAdmin: tokenAdmin,
      expira: expira
    }
  };
}

function validateAdminToken(tokenAdmin) {
  if (!tokenAdmin) return null;
  const sheet = findSheetIgnoreCase_('Sesiones');
  if (!sheet) return null;

  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return null;

  const map = getHeaderIndexMap_(rows[0]);
  const tokenHashCol = map['tokenhash'];
  const venceEnCol = map['venceen'];
  const revocadaCol = map['revocada'];
  const versionCol = map['version'];
  const userIdCol = map['usuarioid'];
  const ultimoUsoCol = map['ultimouso'];

  const inputHash = hashPassword_(tokenAdmin);
  const currentAdminPwd = getConfigValue('CONTRASENA_ADMIN', '');
  const currentHash = currentAdminPwd ? hashPassword_(currentAdminPwd) : '';

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][tokenHashCol]) === inputHash && String(rows[i][userIdCol]) === 'admin') {
      const isRevocada = rows[i][revocadaCol] === true || String(rows[i][revocadaCol]).toLowerCase() === 'true';
      if (isRevocada) return null;

      const venceEn = rows[i][venceEnCol];
      if (venceEn && new Date(venceEn).getTime() < Date.now()) {
        sheet.getRange(i + 1, revocadaCol + 1).setValue(true);
        return null;
      }

      // Si la clave administrativa cambió en Sheets: invalidar token
      const stampedVersion = rows[i][versionCol];
      if (currentHash && stampedVersion && stampedVersion !== currentHash) {
        sheet.getRange(i + 1, revocadaCol + 1).setValue(true);
        return null;
      }

      sheet.getRange(i + 1, ultimoUsoCol + 1).setValue(new Date().toISOString());

      return {
        id: rows[i][map['id']],
        usuarioId: 'admin',
        rol: 'admin'
      };
    }
  }

  return null;
}

function handleAdminVerify(tokenAdmin) {
  const admin = validateAdminToken(tokenAdmin);
  if (!admin) {
    return { ok: false, valid: false, error: 'Credencial administrativa no válida o revocada' };
  }
  return { ok: true, valid: true };
}

function handleAdminRevoke(tokenAdmin) {
  if (!tokenAdmin) return { ok: true };
  const sheet = findSheetIgnoreCase_('Sesiones');
  if (!sheet) return { ok: true };

  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return { ok: true };

  const map = getHeaderIndexMap_(rows[0]);
  const tokenHashCol = map['tokenhash'];
  const revocadaCol = map['revocada'];
  const inputHash = hashPassword_(tokenAdmin);

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][tokenHashCol]) === inputHash) {
      sheet.getRange(i + 1, revocadaCol + 1).setValue(true);
      break;
    }
  }
  return { ok: true, message: 'Autorización administrativa revocada exitosamente' };
}

/**
 * Invalida inmediatamente todas las sesiones de un rol ('admin' o 'usuario')
 * marcando revocada = true en la hoja "Sesiones".
 */
function invalidateAllSessionsForRole_(role) {
  const sheet = findSheetIgnoreCase_('Sesiones');
  if (!sheet) return;

  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return;

  const headers = rows[0];
  const map = getHeaderIndexMap_(headers);
  const userIdCol = map['usuarioid'];
  const revocadaCol = map['revocada'];

  const targetRole = String(role).trim().toLowerCase();

  for (let i = 1; i < rows.length; i++) {
    const uId = String(rows[i][userIdCol] || '').trim().toLowerCase();
    if (uId === targetRole) {
      sheet.getRange(i + 1, revocadaCol + 1).setValue(true);
    }
  }

  // Asegurar persistencia inmediata en la hoja
  SpreadsheetApp.flush();
}

/**
 * Cambia la contraseña en la hoja "Configuracion" e invalida globalmente
 * las sesiones activas en todos los dispositivos para el rol indicado.
 * Protegido con LockService contra escrituras y carreras simultáneas.
 */
function handleChangePassword(payload, userSession, adminSession) {
  // 1. Validar autorización administrativa previa (token de administrador)
  if (!adminSession || !adminSession.id) {
    return {
      ok: false,
      error: 'Acceso denegado: se requiere autorización administrativa activa para cambiar contraseñas.'
    };
  }

  const targetRole = String(payload.targetRole || payload.rol || '').trim().toLowerCase();
  const currentAdminPassword = String(payload.currentAdminPassword || payload.contrasenaActualAdmin || '').trim();
  const newPassword = String(payload.newPassword || payload.nuevaContrasena || '').trim();

  if (!currentAdminPassword) {
    return { ok: false, error: 'Debe ingresar la contraseña actual de Administrador para autorizar el cambio.' };
  }

  if (!newPassword) {
    return { ok: false, error: 'La nueva contraseña no puede estar vacía.' };
  }

  if (newPassword.length < 8) {
    return { ok: false, error: 'La nueva contraseña debe tener al menos 8 caracteres.' };
  }

  if (targetRole !== 'admin' && targetRole !== 'usuario') {
    return { ok: false, error: 'Rol destino inválido. Debe ser "admin" o "usuario".' };
  }

  // 2. Proteger con LockService para evitar condiciones de carrera por accesos simultáneos
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(10000); // Esperar hasta 10 segundos
  if (!hasLock) {
    return {
      ok: false,
      error: 'El servidor está ocupado procesando otra actualización. Intente nuevamente en unos segundos.'
    };
  }

  try {
    // 3. Validar la contraseña actual del Administrador contra Configuracion (CONTRASENA_ADMIN)
    const realAdminPassword = getConfigValue('CONTRASENA_ADMIN', '');
    if (!realAdminPassword || !verifyPasswordAgainstStored_(currentAdminPassword, realAdminPassword)) {
      return { ok: false, error: 'La contraseña actual de Administrador es incorrecta.' };
    }

    if (targetRole === 'admin') {
      // Guardar nueva CONTRASENA_ADMIN protegida con sal en Configuracion (sha256:salt:hash)
      const saltedAdminPassword = createSaltedPassword_(newPassword);
      setConfigValue('CONTRASENA_ADMIN', saltedAdminPassword);

      // Invalidar inmediatamente TODAS las sesiones de Administrador en la hoja Sesiones
      invalidateAllSessionsForRole_('admin');

      // Forzar escritura inmediata en Google Sheets
      SpreadsheetApp.flush();

      // Registrar en auditoría (NUNCA registrar contraseñas ni valores confidenciales)
      logAudit_('admin', 'CHANGE_PASSWORD', 'Configuracion', 'CONTRASENA_ADMIN', 'Contraseña de Administrador actualizada con hash seguro e invalidación global de sesiones admin');

      return {
        ok: true,
        targetRole: 'admin',
        message: 'Contraseña de Administrador actualizada exitosamente. Todas las sesiones han sido cerradas.',
        sessionRevoked: true
      };
    } else {
      // Guardar nueva CONTRASENA_USUARIO protegida con sal en Configuracion (sha256:salt:hash)
      const saltedUserPassword = createSaltedPassword_(newPassword);
      setConfigValue('CONTRASENA_USUARIO', saltedUserPassword);

      // Invalidar inmediatamente TODAS las sesiones de Usuario en la hoja Sesiones
      invalidateAllSessionsForRole_('usuario');

      // Forzar escritura inmediata en Google Sheets
      SpreadsheetApp.flush();

      // Registrar en auditoría
      logAudit_('admin', 'CHANGE_PASSWORD', 'Configuracion', 'CONTRASENA_USUARIO', 'Contraseña de Usuario actualizada con hash seguro e invalidación global de sesiones usuario');

      return {
        ok: true,
        targetRole: 'usuario',
        message: 'Contraseña de Usuario actualizada exitosamente. Todas las sesiones de usuarios operativos han sido revocadas.',
        sessionRevoked: false
      };
    }
  } finally {
    lock.releaseLock();
  }
}

// -------------------------------------------------------------
// CATÁLOGO CONSOLIDADO
// -------------------------------------------------------------

function handleCatalogList() {
  const campaigns = getSheetDataAsObjects('Campanas');
  const machines = getSheetDataAsObjects('Maquinas');
  const lots = getSheetDataAsObjects('Lotes');
  const items = getSheetDataAsObjects('Items');
  const machineJobTypes = findSheetIgnoreCase_('TrabajosMaquinaria') ? getSheetDataAsObjects('TrabajosMaquinaria') : [];
  const fxRes = handleGetExchangeRate();
  const exchangeRate = (fxRes && fxRes.ok && fxRes.result) ? fxRes.result : null;

  return {
    ok: true,
    result: {
      campaigns: campaigns,
      campanas: campaigns,
      machines: machines,
      maquinas: machines,
      maquinarias: machines,
      machineJobTypes: machineJobTypes,
      trabajosMaquinaria: machineJobTypes,
      lots: lots,
      lotes: lots,
      items: items,
      exchangeRate: exchangeRate
    }
  };
}

// -------------------------------------------------------------
// CAMPAÑAS (HOJA CAMPANAS ORIGINAL)
// Columnas: id, nombre, activa, creadoEn
// -------------------------------------------------------------

function handleGetCampaigns() {
  return { ok: true, result: getSheetDataAsObjects('Campanas') };
}

function handleCreateCampaign(c, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = findSheetIgnoreCase_('Campanas');
    if (!sheet) throw new Error('Hoja Campanas no encontrada.');

    const headers = getSheetHeaders_(sheet);
    validateRequiredColumns_('Campanas', headers, SHEET_SCHEMAS.Campanas);
    const map = getHeaderIndexMap_(headers);

    const id = Utilities.getUuid();
    const esActiva = Boolean(c.activa);

    if (esActiva) {
      // Desactivar las demás campañas
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        sheet.getRange(i + 1, map['activa'] + 1).setValue(false);
      }
    }

    const row = [];
    row[map['id']] = id;
    row[map['nombre']] = String(c.nombre || '').trim();
    row[map['activa']] = esActiva;
    row[map['creadoen']] = new Date().toISOString();

    sheet.appendRow(row);
    logAudit_(userSession?.usuarioId, 'CREATE', 'Campanas', id, 'Campaña creada: ' + c.nombre);

    return { ok: true, result: { id: id, ...c, activa: esActiva } };
  } finally {
    lock.releaseLock();
  }
}

function handleSetActiveCampaign(campaignId, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = findSheetIgnoreCase_('Campanas');
    if (!sheet) throw new Error('Hoja Campanas no encontrada.');

    const rows = sheet.getDataRange().getValues();
    if (rows.length < 2) return { ok: false, error: 'No existen campañas' };

    const map = getHeaderIndexMap_(rows[0]);
    const idCol = map['id'];
    const activaCol = map['activa'];

    for (let i = 1; i < rows.length; i++) {
      const match = String(rows[i][idCol]) === String(campaignId);
      sheet.getRange(i + 1, activaCol + 1).setValue(match);
    }

    logAudit_(userSession?.usuarioId, 'ACTIVATE', 'Campanas', campaignId, 'Campaña activada');
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// -------------------------------------------------------------
// MAQUINARIAS (HOJA MAQUINAS ORIGINAL)
// Columnas: id, nombre, tipo, icono, unidad, tarifa, moneda, activo, creadoEn
// -------------------------------------------------------------

function handleGetMachines() {
  const list = getSheetDataAsObjects('Maquinas');
  const mapped = list.map(m => ({
    ...m,
    tarifa: Number(m.tarifa) || 0,
    activo: m.activo !== false && String(m.activo).toLowerCase() !== 'false',
    estado: (m.activo !== false && String(m.activo).toLowerCase() !== 'false') ? 'operativo' : 'inactivo'
  }));
  return { ok: true, result: mapped, machines: mapped };
}

function handleCreateMachine(m, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = findSheetIgnoreCase_('Maquinas');
    if (!sheet) throw new Error('Hoja Maquinas no encontrada.');

    const headers = getSheetHeaders_(sheet);
    validateRequiredColumns_('Maquinas', headers, SHEET_SCHEMAS.Maquinas);
    const map = getHeaderIndexMap_(headers);

    const id = Utilities.getUuid();
    const row = [];
    row[map['id']] = id;
    row[map['nombre']] = String(m.nombre || '').trim();
    row[map['tipo']] = String(m.tipo || 'Tractor').trim();
    row[map['icono']] = String(m.icono || 'Tractor').trim();
    row[map['unidad']] = String(m.unidad || 'ha').trim();
    row[map['tarifa']] = Number(m.tarifa) || 0;
    row[map['moneda']] = String(m.moneda || 'BOB').trim().toUpperCase();
    row[map['activo']] = m.activo !== false && String(m.activo).toLowerCase() !== 'false';
    row[map['creadoen']] = new Date().toISOString();

    sheet.appendRow(row);
    SpreadsheetApp.flush();
    logAudit_(userSession?.usuarioId, 'CREATE', 'Maquinas', id, 'Maquinaria creada: ' + m.nombre);

    return { ok: true, result: { id, ...m } };
  } finally {
    lock.releaseLock();
  }
}

function handleUpdateMachine(id, m, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = findSheetIgnoreCase_('Maquinas');
    if (!sheet) throw new Error('Hoja Maquinas no encontrada.');

    const rows = sheet.getDataRange().getValues();
    if (rows.length < 2) return { ok: false, error: 'No existen maquinarias registradas.' };

    const headers = rows[0];
    const map = getHeaderIndexMap_(headers);
    const idCol = map['id'] !== undefined ? map['id'] : map['id_maquinaria'];

    const idTrim = String(id || '').trim();
    const identTrim = String(m.identificacion || '').trim();

    let targetRow = -1;

    if (idTrim) {
      // 1. Si se proporciona un ID, buscar EXCLUSIVAMENTE por ID sin fallback a código
      const idMatches = [];
      if (idCol !== undefined) {
        for (let i = 1; i < rows.length; i++) {
          const rowId = String(rows[i][idCol] || '').trim();
          if (rowId === idTrim) {
            idMatches.push(i + 1);
          }
        }
      }

      if (idMatches.length === 1) {
        targetRow = idMatches[0];
      } else if (idMatches.length > 1) {
        return {
          ok: false,
          error: 'Coincidencia ambigua: existen múltiples maquinarias registradas con el ID "' + idTrim + '".'
        };
      } else {
        // ID proporcionado pero no existente -> Rechazar inmediatamente sin buscar por código ni por nombre
        return {
          ok: false,
          error: 'Maquinaria no encontrada. No existe ningún registro con el ID "' + idTrim + '".'
        };
      }
    } else if (identTrim && map['identificacion'] !== undefined) {
      // 2. ÚNICAMENTE si NO se proporcionó ID, buscar por código/identificación alternativa (si es único)
      const identMatches = [];
      for (let i = 1; i < rows.length; i++) {
        const rowIdent = String(rows[i][map['identificacion']] || '').trim();
        if (rowIdent === identTrim) {
          identMatches.push(i + 1);
        }
      }

      if (identMatches.length === 1) {
        targetRow = identMatches[0];
      } else if (identMatches.length > 1) {
        return {
          ok: false,
          error: 'Coincidencia ambigua: existen múltiples maquinarias con la identificación o código "' + identTrim + '".'
        };
      } else {
        return {
          ok: false,
          error: 'Maquinaria no encontrada. No existe ningún registro con la identificación "' + identTrim + '".'
        };
      }
    } else {
      return {
        ok: false,
        error: 'Se requiere especificar un ID o código válido para actualizar la maquinaria.'
      };
    }

    if (m.nombre !== undefined && map['nombre'] !== undefined) {
      sheet.getRange(targetRow, map['nombre'] + 1).setValue(String(m.nombre).trim());
    }
    if (m.tipo !== undefined && map['tipo'] !== undefined) {
      sheet.getRange(targetRow, map['tipo'] + 1).setValue(String(m.tipo).trim());
    }
    if (m.icono !== undefined && map['icono'] !== undefined) {
      sheet.getRange(targetRow, map['icono'] + 1).setValue(String(m.icono).trim());
    }
    if (m.unidad !== undefined && map['unidad'] !== undefined) {
      sheet.getRange(targetRow, map['unidad'] + 1).setValue(String(m.unidad).trim());
    }
    if (m.tarifa !== undefined && map['tarifa'] !== undefined) {
      sheet.getRange(targetRow, map['tarifa'] + 1).setValue(Number(m.tarifa) || 0);
    }
    if (m.moneda !== undefined && map['moneda'] !== undefined) {
      sheet.getRange(targetRow, map['moneda'] + 1).setValue(String(m.moneda).trim().toUpperCase());
    }
    if (map['activo'] !== undefined) {
      let actVal = true;
      if (m.activo !== undefined) {
        actVal = m.activo !== false && String(m.activo).toLowerCase() !== 'false';
      } else if (m.estado !== undefined) {
        actVal = String(m.estado).toLowerCase() === 'operativo';
      }
      sheet.getRange(targetRow, map['activo'] + 1).setValue(actVal);
    }
    if (map['identificacion'] !== undefined && m.identificacion !== undefined) {
      sheet.getRange(targetRow, map['identificacion'] + 1).setValue(String(m.identificacion).trim());
    }
    if (map['observaciones'] !== undefined && m.observaciones !== undefined) {
      sheet.getRange(targetRow, map['observaciones'] + 1).setValue(String(m.observaciones).trim());
    }
    if (map['valorpatrimonial'] !== undefined && m.valorPatrimonial !== undefined) {
      sheet.getRange(targetRow, map['valorpatrimonial'] + 1).setValue(Number(m.valorPatrimonial) || 0);
    }

    // Forzar persistencia inmediata en Google Sheets
    SpreadsheetApp.flush();

    const matchedId = idCol !== undefined ? String(rows[targetRow - 1][idCol] || id).trim() : id;
    logAudit_(userSession?.usuarioId, 'UPDATE', 'Maquinas', matchedId, 'Maquinaria actualizada: ' + (m.nombre || matchedId));
    return { ok: true, result: { id: matchedId, ...m } };
  } finally {
    lock.releaseLock();
  }
}

function handleDeleteMachine(id, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = findSheetIgnoreCase_('Maquinas');
    if (!sheet) throw new Error('Hoja Maquinas no encontrada.');

    const rows = sheet.getDataRange().getValues();
    if (rows.length < 2) return { ok: false, error: 'No existen maquinarias registradas.' };

    const headers = rows[0];
    const map = getHeaderIndexMap_(headers);
    const idCol = map['id'] !== undefined ? map['id'] : map['id_maquinaria'];

    const idTrim = String(id || '').trim();
    if (!idTrim) return { ok: false, error: 'Se requiere ID para eliminar la maquinaria.' };

    const matches = [];
    for (let i = 1; i < rows.length; i++) {
      const rowId = idCol !== undefined ? String(rows[i][idCol] || '').trim() : '';
      if (rowId === idTrim) {
        matches.push(i + 1);
      }
    }

    if (matches.length === 0) {
      return { ok: false, error: 'Maquinaria no encontrada con ID: ' + idTrim };
    }

    if (matches.length > 1) {
      return { ok: false, error: 'Coincidencia ambigua: existen múltiples maquinarias con el ID "' + idTrim + '".' };
    }

    sheet.deleteRow(matches[0]);
    SpreadsheetApp.flush();
    logAudit_(userSession?.usuarioId, 'DELETE', 'Maquinas', idTrim, 'Maquinaria eliminada');
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// -------------------------------------------------------------
// TRABAJOS Y TARIFAS POR MÁQUINA (HOJA TRABAJOSMAQUINARIA)
// Columnas: id, maquinaId, nombre, unidad, tarifa, moneda, activo, creadoEn, actualizadoEn
// -------------------------------------------------------------

function ensureTrabajosMaquinariaSheet_() {
  let sheet = findSheetIgnoreCase_('TrabajosMaquinaria');
  if (!sheet) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    sheet = ss.insertSheet('TrabajosMaquinaria');
    sheet.appendRow(SHEET_SCHEMAS.TrabajosMaquinaria);
  } else {
    // Migración segura: si la hoja ya existe pero le falta la columna 'icono', agregarla al final sin mover columnas previas
    const headers = getSheetHeaders_(sheet);
    const map = getHeaderIndexMap_(headers);
    if (map['icono'] === undefined && headers.length > 0) {
      sheet.getRange(1, headers.length + 1).setValue('icono');
    }
  }
  return sheet;
}

function handleGetMachineJobTypes(maquinaId) {
  const sheet = findSheetIgnoreCase_('TrabajosMaquinaria');
  if (!sheet) return { ok: true, result: [] };
  let list = getSheetDataAsObjects('TrabajosMaquinaria');
  if (maquinaId) {
    list = list.filter(j => String(j.maquinaId || j.maquinariaId) === String(maquinaId));
  }
  const mapped = list.map(j => ({
    ...j,
    tarifa: Number(j.tarifa) || 0,
    activo: j.activo !== false && String(j.activo).toLowerCase() !== 'false'
  }));
  return { ok: true, result: mapped, machineJobTypes: mapped };
}

function handleSaveMachineJobType(j, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = ensureTrabajosMaquinariaSheet_();
    const rows = sheet.getDataRange().getValues();
    const headers = rows.length > 0 ? rows[0] : SHEET_SCHEMAS.TrabajosMaquinaria;
    const map = getHeaderIndexMap_(headers);
    const ahora = new Date().toISOString();

    const id = j.id || Utilities.getUuid();
    const maquinaId = String(j.maquinaId || j.maquinariaId || '').trim();
    const nombre = String(j.nombre || j.trabajo || '').trim();
    const icono = String(j.icono || '').trim();
    const unidad = String(j.unidad || 'ha').trim();
    const tarifa = Number(j.tarifa) || 0;
    const moneda = String(j.moneda || 'USD').trim().toUpperCase();
    const activo = j.activo !== false && String(j.activo).toLowerCase() !== 'false';

    let foundRowIdx = -1;
    if (j.id && rows.length > 1) {
      const idCol = map['id'];
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][idCol]) === String(j.id)) {
          foundRowIdx = i + 1;
          break;
        }
      }
    }

    if (foundRowIdx > 0) {
      if (map['maquinaid'] !== undefined) sheet.getRange(foundRowIdx, map['maquinaid'] + 1).setValue(maquinaId);
      if (map['nombre'] !== undefined) sheet.getRange(foundRowIdx, map['nombre'] + 1).setValue(nombre);
      if (map['icono'] !== undefined && j.icono !== undefined) sheet.getRange(foundRowIdx, map['icono'] + 1).setValue(icono);
      if (map['unidad'] !== undefined) sheet.getRange(foundRowIdx, map['unidad'] + 1).setValue(unidad);
      if (map['tarifa'] !== undefined) sheet.getRange(foundRowIdx, map['tarifa'] + 1).setValue(tarifa);
      if (map['moneda'] !== undefined) sheet.getRange(foundRowIdx, map['moneda'] + 1).setValue(moneda);
      if (map['activo'] !== undefined) sheet.getRange(foundRowIdx, map['activo'] + 1).setValue(activo);
      if (map['actualizadoen'] !== undefined) sheet.getRange(foundRowIdx, map['actualizadoen'] + 1).setValue(ahora);

      logAudit_(userSession?.usuarioId, 'UPDATE', 'TrabajosMaquinaria', id, 'Trabajo de máquina actualizado: ' + nombre);
      return { ok: true, result: { id, maquinaId, nombre, icono, unidad, tarifa, moneda, activo, actualizadoEn: ahora } };
    } else {
      const row = [];
      row[map['id']] = id;
      row[map['maquinaid']] = maquinaId;
      row[map['nombre']] = nombre;
      if (map['icono'] !== undefined) row[map['icono']] = icono;
      row[map['unidad']] = unidad;
      row[map['tarifa']] = tarifa;
      row[map['moneda']] = moneda;
      row[map['activo']] = activo;
      row[map['creadoen']] = ahora;
      row[map['actualizadoen']] = ahora;

      sheet.appendRow(row);
      logAudit_(userSession?.usuarioId, 'CREATE', 'TrabajosMaquinaria', id, 'Trabajo de máquina registrado: ' + nombre);
      return { ok: true, result: { id, maquinaId, nombre, icono, unidad, tarifa, moneda, activo, creadoEn: ahora, actualizadoEn: ahora } };
    }
  } finally {
    lock.releaseLock();
  }
}

function handleDeleteMachineJobType(id, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = findSheetIgnoreCase_('TrabajosMaquinaria');
    if (!sheet) return { ok: true };

    const rows = sheet.getDataRange().getValues();
    if (rows.length < 2) return { ok: true };

    const map = getHeaderIndexMap_(rows[0]);
    const idCol = map['id'];
    let foundIdx = -1;

    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][idCol]) === String(id)) {
        foundIdx = i + 1;
        break;
      }
    }

    if (foundIdx !== -1) {
      sheet.deleteRow(foundIdx);
      logAudit_(userSession?.usuarioId, 'DELETE', 'TrabajosMaquinaria', id, 'Trabajo de maquinaria eliminado');
    }
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function handleSeedNewHollandJobs(maquinaId, userSession) {
  const defaultJobs = [
    { nombre: 'Tractor con sembradora', tarifa: 30, moneda: 'USD', unidad: 'ha', icono: 'sembradora' },
    { nombre: 'Tractor con romplow', tarifa: 35, moneda: 'USD', unidad: 'ha', icono: 'romplow' },
    { nombre: 'Tractor con ripper (subsolador)', tarifa: 50, moneda: 'USD', unidad: 'ha', icono: 'ripper' },
    { nombre: 'Tractor con pala niveladora', tarifa: 45, moneda: 'USD', unidad: 'ha', icono: 'pala-niveladora' },
    { nombre: 'Tractor con rastra', tarifa: 25, moneda: 'USD', unidad: 'ha', icono: 'rastra' },
    { nombre: 'Tractor con traílla', tarifa: 35, moneda: 'USD', unidad: 'hora', icono: 'trailla' },
    { nombre: 'Tractor con cortadora de sorgo', tarifa: 20, moneda: 'USD', unidad: 'ha', icono: 'cortadora-sorgo' },
    { nombre: 'Tractor con rolo', tarifa: 30, moneda: 'USD', unidad: 'ha', icono: 'rolo' },
    { nombre: 'Fumigación', tarifa: 55, moneda: 'BOB', unidad: 'ha', icono: 'fumigadora' },
    { nombre: 'Tractor solo', tarifa: 20, moneda: 'USD', unidad: 'hora', icono: 'tractor-blue' }
  ];

  const results = [];
  for (let i = 0; i < defaultJobs.length; i++) {
    const job = defaultJobs[i];
    const res = handleSaveMachineJobType({
      maquinaId: maquinaId,
      nombre: job.nombre,
      icono: job.icono,
      tarifa: job.tarifa,
      moneda: job.moneda,
      unidad: job.unidad,
      activo: true
    }, userSession);
    if (res && res.result) results.push(res.result);
  }
  return { ok: true, result: results, count: results.length };
}

// -------------------------------------------------------------
// LOTES (HOJA LOTES ORIGINAL)
// Columnas: id, nombre, hectareas, ubicacion, activo, creadoEn
// -------------------------------------------------------------

function handleGetLots() {
  const list = getSheetDataAsObjects('Lotes');
  const mapped = list.map(l => ({
    ...l,
    hectareas: Number(l.hectareas) || 0,
    superficieHectareas: Number(l.hectareas) || 0,
    superficie: Number(l.hectareas) || 0,
    activo: l.activo !== false && String(l.activo).toLowerCase() !== 'false'
  }));
  return { ok: true, result: mapped, lots: mapped };
}

function handleCreateLot(l, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = findSheetIgnoreCase_('Lotes');
    if (!sheet) throw new Error('Hoja Lotes no encontrada.');

    const headers = getSheetHeaders_(sheet);
    validateRequiredColumns_('Lotes', headers, SHEET_SCHEMAS.Lotes);
    const map = getHeaderIndexMap_(headers);

    const id = Utilities.getUuid();
    const sup = Number(l.hectareas || l.superficieHectareas || l.superficie) || 0;

    const row = [];
    row[map['id']] = id;
    row[map['nombre']] = String(l.nombre || '').trim();
    row[map['hectareas']] = sup;
    row[map['ubicacion']] = String(l.ubicacion || '').trim();
    row[map['activo']] = l.activo !== false && String(l.activo).toLowerCase() !== 'false';
    row[map['creadoen']] = new Date().toISOString();

    sheet.appendRow(row);
    SpreadsheetApp.flush();
    logAudit_(userSession?.usuarioId, 'CREATE', 'Lotes', id, 'Lote creado: ' + l.nombre);

    return { ok: true, result: { id: id, ...l, hectareas: sup, superficieHectareas: sup } };
  } finally {
    lock.releaseLock();
  }
}

function handleUpdateLot(id, l, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = findSheetIgnoreCase_('Lotes');
    if (!sheet) throw new Error('Hoja Lotes no encontrada.');

    const rows = sheet.getDataRange().getValues();
    if (rows.length < 2) return { ok: false, error: 'No existen lotes registrados.' };

    const headers = rows[0];
    const map = getHeaderIndexMap_(headers);
    const idCol = map['id'];

    const idTrim = String(id || '').trim();
    if (!idTrim) {
      return { ok: false, error: 'Se requiere un ID válido para actualizar el lote.' };
    }

    const matches = [];
    for (let i = 1; i < rows.length; i++) {
      const rowId = idCol !== undefined ? String(rows[i][idCol] || '').trim() : '';
      if (rowId === idTrim) {
        matches.push(i + 1);
      }
    }

    if (matches.length === 0) {
      return { ok: false, error: 'Lote no encontrado. No existe ningún lote con el ID "' + idTrim + '".' };
    }

    if (matches.length > 1) {
      return { ok: false, error: 'Coincidencia ambigua: existen múltiples lotes con el ID "' + idTrim + '".' };
    }

    const targetRow = matches[0];

    if (l.nombre !== undefined && map['nombre'] !== undefined) {
      sheet.getRange(targetRow, map['nombre'] + 1).setValue(String(l.nombre).trim());
    }
    if (map['hectareas'] !== undefined && (l.hectareas !== undefined || l.superficieHectareas !== undefined || l.superficie !== undefined)) {
      const sup = Number(l.hectareas ?? l.superficieHectareas ?? l.superficie) || 0;
      sheet.getRange(targetRow, map['hectareas'] + 1).setValue(sup);
    }
    if (l.ubicacion !== undefined && map['ubicacion'] !== undefined) {
      sheet.getRange(targetRow, map['ubicacion'] + 1).setValue(String(l.ubicacion).trim());
    }
    if (map['activo'] !== undefined && l.activo !== undefined) {
      sheet.getRange(targetRow, map['activo'] + 1).setValue(l.activo !== false && String(l.activo).toLowerCase() !== 'false');
    }
    if (map['cultivo'] !== undefined && l.cultivoActual !== undefined) {
      sheet.getRange(targetRow, map['cultivo'] + 1).setValue(String(l.cultivoActual).trim());
    } else if (map['cultivoactual'] !== undefined && l.cultivoActual !== undefined) {
      sheet.getRange(targetRow, map['cultivoactual'] + 1).setValue(String(l.cultivoActual).trim());
    }
    if (map['observaciones'] !== undefined && l.observaciones !== undefined) {
      sheet.getRange(targetRow, map['observaciones'] + 1).setValue(String(l.observaciones).trim());
    }
    if (map['valorpatrimonial'] !== undefined && l.valorPatrimonial !== undefined) {
      sheet.getRange(targetRow, map['valorpatrimonial'] + 1).setValue(Number(l.valorPatrimonial) || 0);
    }

    SpreadsheetApp.flush();

    logAudit_(userSession?.usuarioId, 'UPDATE', 'Lotes', idTrim, 'Lote actualizado: ' + (l.nombre || idTrim));
    return { ok: true, result: { id: idTrim, ...l } };
  } finally {
    lock.releaseLock();
  }
}

function handleDeleteLot(id, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const idTrim = String(id || '').trim();
    if (!idTrim) return { ok: false, error: 'Se requiere un ID válido para eliminar el lote.' };
    deleteRowByColumn('Lotes', 'id', idTrim);
    SpreadsheetApp.flush();
    logAudit_(userSession?.usuarioId, 'DELETE', 'Lotes', idTrim, 'Lote eliminado');
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// -------------------------------------------------------------
// TRABAJOS DE MAQUINARIA (HOJA TRABAJOS ORIGINAL)
// Columnas: id, fecha, campanaId, maquinaId, destino, loteId, cliente, cantidad, unidad, precioUnitario, moneda, tc, importe, observacion, creadoPor, creadoEn, actualizadoEn
// -------------------------------------------------------------

function handleGetMachineryJobs(campanaId) {
  let jobs = getSheetDataAsObjects('Trabajos');
  if (campanaId) {
    jobs = jobs.filter(j => String(j.campanaId) === String(campanaId));
  }
  const mapped = jobs.map(j => ({
    ...j,
    tipoTrabajo: String(j.destino || '').toUpperCase() === 'PROPIEDAD' ? 'propiedad' : 'tercero',
    maquinariaId: j.maquinaId,
    tarifa: Number(j.precioUnitario) || 0,
    total: Number(j.importe) || 0,
    tipoCambio: Number(j.tc) || 0
  }));
  return { ok: true, result: mapped, jobs: mapped };
}

function handleCreateMachineryJob(j, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000); // 15 segundos para operación compuesta
  try {
    const jobsSheet = findSheetIgnoreCase_('Trabajos');
    const movSheet = findSheetIgnoreCase_('Movimientos');
    if (!jobsSheet) throw new Error('Hoja Trabajos no encontrada.');
    if (!movSheet) throw new Error('Hoja Movimientos no encontrada.');

    const jHeaders = getSheetHeaders_(jobsSheet);
    const mHeaders = getSheetHeaders_(movSheet);
    validateRequiredColumns_('Trabajos', jHeaders, SHEET_SCHEMAS.Trabajos);
    validateRequiredColumns_('Movimientos', mHeaders, SHEET_SCHEMAS.Movimientos);

    const jMap = getHeaderIndexMap_(jHeaders);
    const mMap = getHeaderIndexMap_(mHeaders);

    const id = Utilities.getUuid();
    const maqId = j.maquinaId || j.maquinariaId;
    if (!maqId) throw new Error('Debe especificar una maquinaria.');

    const destinoVal = String(j.destino || (j.tipoTrabajo === 'propiedad' ? 'PROPIEDAD' : 'TERCERO')).toUpperCase();
    if (destinoVal === 'PROPIEDAD' && (!j.loteId || String(j.loteId).trim() === '')) {
      throw new Error('Los trabajos para Propiedad requieren seleccionar obligatoriamente un lote.');
    }

    // Validación estricta de tipo de cambio
    const rawTc = Number(j.tc ?? j.tipoCambio);
    const storedTc = Number(getConfigValue('TIPO_CAMBIO', 0));
    const finalTc = rawTc > 0 ? rawTc : storedTc;
    if (finalTc <= 0) {
      throw new Error('Tipo de cambio no configurado en Google Sheets. Configure el tipo de cambio en Administración -> Tipo de cambio antes de registrar trabajos.');
    }

    // Validación y recálculo obligatorio de importe: importe = cantidad * precioUnitario
    const cantVal = Number(j.cantidad);
    if (isNaN(cantVal) || cantVal <= 0) {
      throw new Error('La cantidad de trabajo debe ser un número mayor a 0.');
    }
    const precioVal = Number(j.precioUnitario ?? j.tarifa);
    if (isNaN(precioVal) || precioVal < 0) {
      throw new Error('El precio unitario / tarifa no puede ser un número negativo.');
    }
    const totalVal = cantVal * precioVal;

    const rawMon = String(j.moneda || 'BOB').toUpperCase();
    const monVal = rawMon === 'USD' ? 'USD' : 'BOB';
    const ahora = new Date().toISOString();
    const usuarioNombre = userSession?.usuarioId || 'operador';

    // 1. Insertar en Trabajos
    const jRow = [];
    jRow[jMap['id']] = id;
    jRow[jMap['fecha']] = String(j.fecha || ahora.slice(0, 10));
    jRow[jMap['campanaid']] = String(j.campanaId || '');
    jRow[jMap['maquinaid']] = String(maqId);
    jRow[jMap['destino']] = destinoVal;
    jRow[jMap['loteid']] = destinoVal === 'PROPIEDAD' ? String(j.loteId || '') : '';
    jRow[jMap['cliente']] = destinoVal === 'TERCERO' ? String(j.cliente || '') : '';
    jRow[jMap['cantidad']] = cantVal;
    jRow[jMap['unidad']] = String(j.unidad || 'ha');
    jRow[jMap['preciounitario']] = precioVal;
    jRow[jMap['moneda']] = monVal;
    jRow[jMap['tc']] = finalTc;
    jRow[jMap['importe']] = totalVal;
    let obsVal = String(j.observacion || j.observaciones || '');
    if (j.trabajoNombre && obsVal.indexOf('[Trabajo:') === -1) {
      obsVal = obsVal ? (obsVal + ' [Trabajo: ' + j.trabajoNombre + ']') : ('[Trabajo: ' + j.trabajoNombre + ']');
    }
    jRow[jMap['observacion']] = obsVal;
    if (jMap['trabajonombre'] !== undefined) jRow[jMap['trabajonombre']] = String(j.trabajoNombre || '');
    if (jMap['trabajotipoid'] !== undefined) jRow[jMap['trabajotipoid']] = String(j.trabajoTipoId || '');
    jRow[jMap['creadopor']] = usuarioNombre;
    jRow[jMap['creadoen']] = ahora;
    jRow[jMap['actualizadoen']] = ahora;

    jobsSheet.appendRow(jRow);

    const trabajoDesc = j.trabajoNombre ? (' - ' + j.trabajoNombre) : '';

    // 2. Insertar en Movimientos: Ingreso de Maquinarias (siempre)
    const incRow = [];
    incRow[mMap['id']] = Utilities.getUuid();
    incRow[mMap['fecha']] = String(j.fecha || ahora.slice(0, 10));
    incRow[mMap['campanaid']] = String(j.campanaId || '');
    incRow[mMap['modulo']] = 'MAQUINARIAS';
    incRow[mMap['clase']] = 'INGRESO';
    incRow[mMap['itemid']] = '';
    incRow[mMap['descripcion']] = destinoVal === 'PROPIEDAD'
      ? ('Trabajo en propiedad' + trabajoDesc + ' (' + (j.loteNombre || j.loteId || 'Lote') + ')')
      : ('Servicio a tercero' + trabajoDesc + ' (' + (j.cliente || 'Externo') + ')');
    incRow[mMap['loteid']] = destinoVal === 'PROPIEDAD' ? String(j.loteId || '') : '';
    incRow[mMap['maquinaid']] = String(maqId);
    incRow[mMap['cantidad']] = cantVal;
    incRow[mMap['unidad']] = String(j.unidad || 'ha');
    incRow[mMap['preciounitario']] = precioVal;
    incRow[mMap['importe']] = totalVal;
    incRow[mMap['moneda']] = monVal;
    incRow[mMap['tc']] = finalTc;
    incRow[mMap['trabajoid']] = id; // VINCULACIÓN OBLIGATORIA
    incRow[mMap['creadopor']] = usuarioNombre;
    incRow[mMap['creadoen']] = ahora;
    incRow[mMap['actualizadoen']] = ahora;

    movSheet.appendRow(incRow);

    // 3. Insertar en Movimientos: Gasto vinculado de Propiedad (sólo si es en lote propio)
    if (destinoVal === 'PROPIEDAD') {
      const expRow = [];
      expRow[mMap['id']] = Utilities.getUuid();
      expRow[mMap['fecha']] = String(j.fecha || ahora.slice(0, 10));
      expRow[mMap['campanaid']] = String(j.campanaId || '');
      expRow[mMap['modulo']] = 'PROPIEDAD';
      expRow[mMap['clase']] = 'GASTO';
      expRow[mMap['itemid']] = '';
      expRow[mMap['descripcion']] = 'Servicio Maquinaria Propia' + trabajoDesc + ' (' + (j.maquinariaNombre || maqId) + ')';
      expRow[mMap['loteid']] = String(j.loteId);
      expRow[mMap['maquinaid']] = String(maqId);
      expRow[mMap['cantidad']] = cantVal;
      expRow[mMap['unidad']] = String(j.unidad || 'ha');
      expRow[mMap['preciounitario']] = precioVal;
      expRow[mMap['importe']] = totalVal;
      expRow[mMap['moneda']] = monVal;
      expRow[mMap['tc']] = finalTc;
      expRow[mMap['trabajoid']] = id; // VINCULACIÓN OBLIGATORIA
      expRow[mMap['creadopor']] = usuarioNombre;
      expRow[mMap['creadoen']] = ahora;
      expRow[mMap['actualizadoen']] = ahora;

      movSheet.appendRow(expRow);
    }

    logAudit_(usuarioNombre, 'CREATE', 'Trabajos', id, 'Trabajo registrado con movimientos vinculados');

    return {
      ok: true,
      result: {
        id,
        ...j,
        destino: destinoVal,
        tipoTrabajo: destinoVal === 'PROPIEDAD' ? 'propiedad' : 'tercero',
        cantidad: cantVal,
        precioUnitario: precioVal,
        tarifa: precioVal,
        importe: totalVal,
        total: totalVal,
        moneda: monVal,
        tc: finalTc
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function handleUpdateMachineryJob(id, j, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000); // 15 segundos para operación concurrente
  try {
    const jobsSheet = findSheetIgnoreCase_('Trabajos');
    const movSheet = findSheetIgnoreCase_('Movimientos');
    if (!jobsSheet || !movSheet) throw new Error('Hojas Trabajos o Movimientos no encontradas.');

    const jRows = jobsSheet.getDataRange().getValues();
    if (jRows.length < 2) return { ok: false, error: 'No existen trabajos' };

    const jMap = getHeaderIndexMap_(jRows[0]);
    const idCol = jMap['id'];
    let foundRowIdx = -1;

    for (let i = 1; i < jRows.length; i++) {
      if (String(jRows[i][idCol]) === String(id)) {
        foundRowIdx = i + 1;
        break;
      }
    }
    if (foundRowIdx === -1) return { ok: false, error: 'Trabajo no encontrado: ' + id };

    const oldRow = jRows[foundRowIdx - 1];
    const oldDestino = String(oldRow[jMap['destino']] || 'TERCERO').toUpperCase();
    const oldLoteId = String(oldRow[jMap['loteid']] || '');
    const oldCliente = String(oldRow[jMap['cliente']] || '');
    const oldMaqId = String(oldRow[jMap['maquinaid']] || '');
    const oldFecha = String(oldRow[jMap['fecha']] || '');
    const oldCampanaId = String(oldRow[jMap['campanaid']] || '');
    const oldCant = Number(oldRow[jMap['cantidad']]) || 0;
    const oldUnidad = String(oldRow[jMap['unidad']] || 'ha');
    const oldPrecio = Number(oldRow[jMap['preciounitario']]) || 0;
    const oldMoneda = String(oldRow[jMap['moneda']] || 'BOB').toUpperCase();
    const oldTc = Number(oldRow[jMap['tc']]) || 0;
    const oldObs = String(oldRow[jMap['observacion']] || '');

    const ahora = new Date().toISOString();
    const usuarioNombre = userSession?.usuarioId || 'operador';

    // 1. Determinar nuevo destino
    let newDestino = oldDestino;
    if (j.destino !== undefined && String(j.destino).trim() !== '') {
      newDestino = String(j.destino).trim().toUpperCase();
    } else if (j.tipoTrabajo !== undefined && String(j.tipoTrabajo).trim() !== '') {
      newDestino = String(j.tipoTrabajo).toLowerCase() === 'propiedad' ? 'PROPIEDAD' : 'TERCERO';
    }

    // 2. Validar lote según destino
    let finalLoteId = '';
    let finalCliente = '';
    if (newDestino === 'PROPIEDAD') {
      const candidateLote = j.loteId !== undefined ? String(j.loteId).trim() : oldLoteId;
      if (!candidateLote) {
        throw new Error('Los trabajos para Propiedad requieren seleccionar obligatoriamente un lote.');
      }
      finalLoteId = candidateLote;
      finalCliente = '';
    } else {
      finalLoteId = '';
      finalCliente = j.cliente !== undefined ? String(j.cliente || '').trim() : oldCliente;
    }

    // 3. Recalcular importes y validar valores
    const finalCant = j.cantidad !== undefined ? Number(j.cantidad) : oldCant;
    if (isNaN(finalCant) || finalCant <= 0) {
      throw new Error('La cantidad debe ser un número mayor a 0.');
    }

    const finalPrecio = (j.precioUnitario !== undefined || j.tarifa !== undefined)
      ? Number(j.precioUnitario ?? j.tarifa)
      : oldPrecio;
    if (isNaN(finalPrecio) || finalPrecio < 0) {
      throw new Error('El precio unitario no puede ser negativo.');
    }

    // Siempre recalcular importe = cantidad * precioUnitario
    const finalTotal = finalCant * finalPrecio;

    const rawMon = j.moneda !== undefined ? String(j.moneda).toUpperCase() : oldMoneda;
    const finalMoneda = rawMon === 'USD' ? 'USD' : 'BOB';

    const rawTc = (j.tc !== undefined || j.tipoCambio !== undefined)
      ? Number(j.tc ?? j.tipoCambio)
      : oldTc;
    const storedTc = Number(getConfigValue('TIPO_CAMBIO', 0));
    const finalTc = rawTc > 0 ? rawTc : storedTc;
    if (finalTc <= 0) {
      throw new Error('Tipo de cambio no configurado en Google Sheets. Configure el tipo de cambio en Administración -> Tipo de cambio.');
    }

    const finalMaqId = (j.maquinaId || j.maquinariaId) ? String(j.maquinaId || j.maquinariaId) : oldMaqId;
    const finalFecha = j.fecha !== undefined ? String(j.fecha) : oldFecha;
    const finalCampanaId = j.campanaId !== undefined ? String(j.campanaId) : oldCampanaId;
    const finalUnidad = j.unidad !== undefined ? String(j.unidad) : oldUnidad;
    const finalObs = (j.observacion !== undefined || j.observaciones !== undefined)
      ? String(j.observacion ?? j.observaciones ?? '')
      : oldObs;

    // 4. Actualizar fila en Trabajos
    jobsSheet.getRange(foundRowIdx, jMap['fecha'] + 1).setValue(finalFecha);
    jobsSheet.getRange(foundRowIdx, jMap['campanaid'] + 1).setValue(finalCampanaId);
    jobsSheet.getRange(foundRowIdx, jMap['maquinaid'] + 1).setValue(finalMaqId);
    jobsSheet.getRange(foundRowIdx, jMap['destino'] + 1).setValue(newDestino);
    jobsSheet.getRange(foundRowIdx, jMap['loteid'] + 1).setValue(finalLoteId);
    jobsSheet.getRange(foundRowIdx, jMap['cliente'] + 1).setValue(finalCliente);
    jobsSheet.getRange(foundRowIdx, jMap['cantidad'] + 1).setValue(finalCant);
    jobsSheet.getRange(foundRowIdx, jMap['unidad'] + 1).setValue(finalUnidad);
    jobsSheet.getRange(foundRowIdx, jMap['preciounitario'] + 1).setValue(finalPrecio);
    jobsSheet.getRange(foundRowIdx, jMap['moneda'] + 1).setValue(finalMoneda);
    jobsSheet.getRange(foundRowIdx, jMap['tc'] + 1).setValue(finalTc);
    jobsSheet.getRange(foundRowIdx, jMap['importe'] + 1).setValue(finalTotal);
    jobsSheet.getRange(foundRowIdx, jMap['observacion'] + 1).setValue(finalObs);
    jobsSheet.getRange(foundRowIdx, jMap['actualizadoen'] + 1).setValue(ahora);

    // 5. Sincronizar Movimientos vinculados
    const mRows = movSheet.getDataRange().getValues();
    const mMap = getHeaderIndexMap_(mRows[0]);
    const trabIdCol = mMap['trabajoid'];
    const moduloCol = mMap['modulo'];
    const claseCol = mMap['clase'];

    let incomeRowIdx = -1;
    let expenseRowIdx = -1;

    for (let k = 1; k < mRows.length; k++) {
      if (String(mRows[k][trabIdCol]) === String(id)) {
        const mod = String(mRows[k][moduloCol] || '').toUpperCase();
        const cls = String(mRows[k][claseCol] || '').toUpperCase();
        if (mod === 'MAQUINARIAS' && cls === 'INGRESO') {
          incomeRowIdx = k + 1;
        } else if (mod === 'PROPIEDAD' && cls === 'GASTO') {
          expenseRowIdx = k + 1;
        }
      }
    }

    const incomeDesc = newDestino === 'PROPIEDAD'
      ? ('Trabajo en propiedad (' + (j.loteNombre || finalLoteId || 'Lote') + ')')
      : ('Servicio a tercero (' + (finalCliente || 'Externo') + ')');

    // A. Actualizar o insertar Ingreso Maquinarias
    if (incomeRowIdx !== -1) {
      movSheet.getRange(incomeRowIdx, mMap['fecha'] + 1).setValue(finalFecha);
      movSheet.getRange(incomeRowIdx, mMap['campanaid'] + 1).setValue(finalCampanaId);
      movSheet.getRange(incomeRowIdx, mMap['maquinaid'] + 1).setValue(finalMaqId);
      movSheet.getRange(incomeRowIdx, mMap['descripcion'] + 1).setValue(incomeDesc);
      movSheet.getRange(incomeRowIdx, mMap['loteid'] + 1).setValue(finalLoteId);
      movSheet.getRange(incomeRowIdx, mMap['cantidad'] + 1).setValue(finalCant);
      movSheet.getRange(incomeRowIdx, mMap['unidad'] + 1).setValue(finalUnidad);
      movSheet.getRange(incomeRowIdx, mMap['preciounitario'] + 1).setValue(finalPrecio);
      movSheet.getRange(incomeRowIdx, mMap['importe'] + 1).setValue(finalTotal);
      movSheet.getRange(incomeRowIdx, mMap['moneda'] + 1).setValue(finalMoneda);
      movSheet.getRange(incomeRowIdx, mMap['tc'] + 1).setValue(finalTc);
      movSheet.getRange(incomeRowIdx, mMap['actualizadoen'] + 1).setValue(ahora);
    } else {
      const incRow = [];
      incRow[mMap['id']] = Utilities.getUuid();
      incRow[mMap['fecha']] = finalFecha;
      incRow[mMap['campanaid']] = finalCampanaId;
      incRow[mMap['modulo']] = 'MAQUINARIAS';
      incRow[mMap['clase']] = 'INGRESO';
      incRow[mMap['itemid']] = '';
      incRow[mMap['descripcion']] = incomeDesc;
      incRow[mMap['loteid']] = finalLoteId;
      incRow[mMap['maquinaid']] = finalMaqId;
      incRow[mMap['cantidad']] = finalCant;
      incRow[mMap['unidad']] = finalUnidad;
      incRow[mMap['preciounitario']] = finalPrecio;
      incRow[mMap['importe']] = finalTotal;
      incRow[mMap['moneda']] = finalMoneda;
      incRow[mMap['tc']] = finalTc;
      incRow[mMap['trabajoid']] = id;
      incRow[mMap['creadopor']] = usuarioNombre;
      incRow[mMap['creadoen']] = ahora;
      incRow[mMap['actualizadoen']] = ahora;
      movSheet.appendRow(incRow);
    }

    // B. Manejo del Gasto Vinculado de Propiedad
    if (newDestino === 'PROPIEDAD') {
      const expenseDesc = 'Servicio Maquinaria Propia (' + (j.maquinariaNombre || finalMaqId) + ')';
      if (expenseRowIdx !== -1) {
        // Actualizar gasto existente
        movSheet.getRange(expenseRowIdx, mMap['fecha'] + 1).setValue(finalFecha);
        movSheet.getRange(expenseRowIdx, mMap['campanaid'] + 1).setValue(finalCampanaId);
        movSheet.getRange(expenseRowIdx, mMap['maquinaid'] + 1).setValue(finalMaqId);
        movSheet.getRange(expenseRowIdx, mMap['descripcion'] + 1).setValue(expenseDesc);
        movSheet.getRange(expenseRowIdx, mMap['loteid'] + 1).setValue(finalLoteId);
        movSheet.getRange(expenseRowIdx, mMap['cantidad'] + 1).setValue(finalCant);
        movSheet.getRange(expenseRowIdx, mMap['unidad'] + 1).setValue(finalUnidad);
        movSheet.getRange(expenseRowIdx, mMap['preciounitario'] + 1).setValue(finalPrecio);
        movSheet.getRange(expenseRowIdx, mMap['importe'] + 1).setValue(finalTotal);
        movSheet.getRange(expenseRowIdx, mMap['moneda'] + 1).setValue(finalMoneda);
        movSheet.getRange(expenseRowIdx, mMap['tc'] + 1).setValue(finalTc);
        movSheet.getRange(expenseRowIdx, mMap['actualizadoen'] + 1).setValue(ahora);
      } else {
        // El trabajo cambió de TERCERO a PROPIEDAD: crear el gasto vinculado que no existía
        const expRow = [];
        expRow[mMap['id']] = Utilities.getUuid();
        expRow[mMap['fecha']] = finalFecha;
        expRow[mMap['campanaid']] = finalCampanaId;
        expRow[mMap['modulo']] = 'PROPIEDAD';
        expRow[mMap['clase']] = 'GASTO';
        expRow[mMap['itemid']] = '';
        expRow[mMap['descripcion']] = expenseDesc;
        expRow[mMap['loteid']] = finalLoteId;
        expRow[mMap['maquinaid']] = finalMaqId;
        expRow[mMap['cantidad']] = finalCant;
        expRow[mMap['unidad']] = finalUnidad;
        expRow[mMap['preciounitario']] = finalPrecio;
        expRow[mMap['importe']] = finalTotal;
        expRow[mMap['moneda']] = finalMoneda;
        expRow[mMap['tc']] = finalTc;
        expRow[mMap['trabajoid']] = id;
        expRow[mMap['creadopor']] = usuarioNombre;
        expRow[mMap['creadoen']] = ahora;
        expRow[mMap['actualizadoen']] = ahora;
        movSheet.appendRow(expRow);
      }
    } else {
      // El trabajo ahora es TERCERO: si existía un gasto en Propiedad vinculado, eliminarlo FÍSICAMENTE de abajo hacia arriba
      const mRowsForDel = movSheet.getDataRange().getValues();
      const mMapForDel = getHeaderIndexMap_(mRowsForDel[0]);
      const tColDel = mMapForDel['trabajoid'];
      const mColDel = mMapForDel['modulo'];
      const cColDel = mMapForDel['clase'];
      const idColDel = mMapForDel['id'];

      const expenseRowsToDelete = [];
      for (let k = 1; k < mRowsForDel.length; k++) {
        if (String(mRowsForDel[k][tColDel]) === String(id)) {
          const mod = String(mRowsForDel[k][mColDel] || '').toUpperCase();
          const cls = String(mRowsForDel[k][cColDel] || '').toUpperCase();
          if (mod === 'PROPIEDAD' && cls === 'GASTO') {
            expenseRowsToDelete.push({
              rowIdx: k + 1, // 1-based index
              data: mRowsForDel[k],
              id: String(mRowsForDel[k][idColDel] || '')
            });
          }
        }
      }

      // Ordenar de mayor a menor fila (de abajo hacia arriba)
      expenseRowsToDelete.sort(function(a, b) { return b.rowIdx - a.rowIdx; });

      const actuallyDeletedExpenses = [];
      try {
        for (let d = 0; d < expenseRowsToDelete.length; d++) {
          const target = expenseRowsToDelete[d];
          movSheet.deleteRow(target.rowIdx);
          actuallyDeletedExpenses.push(target);
        }
      } catch (errExpDel) {
        // Restaurar ÚNICAMENTE las filas de gastos en Propiedad que SÍ fueron eliminadas efectivamente
        const resErrors = [];
        for (let r = 0; r < actuallyDeletedExpenses.length; r++) {
          const itemRes = actuallyDeletedExpenses[r];
          try {
            movSheet.appendRow(itemRes.data);
          } catch (eRes) {
            resErrors.push('Fallo al reinsertar gasto en Propiedad (ID: ' + itemRes.id + '): ' + eRes.message);
          }
        }

        // Verificar por ID que los gastos eliminados se reinsertaron correctamente
        const missingExpIds = [];
        if (actuallyDeletedExpenses.length > 0) {
          const currentMovs = getSheetDataAsObjects('Movimientos');
          for (let v = 0; v < actuallyDeletedExpenses.length; v++) {
            const eId = actuallyDeletedExpenses[v].id;
            const exists = currentMovs.some(m => String(m.id) === String(eId));
            if (!exists) {
              missingExpIds.push(eId);
            }
          }
        }

        let msg = 'Error al eliminar el gasto vinculado de Propiedad (' + errExpDel.message + ').';
        if (resErrors.length > 0) {
          msg += ' Errores de restauración: ' + resErrors.join('; ') + '.';
        }
        if (missingExpIds.length > 0) {
          msg += ' ATENCIÓN: No fue posible verificar la recuperación de los gastos con IDs: [' + missingExpIds.join(', ') + '].';
        } else {
          msg += ' Se recuperaron en la planilla las filas afectadas antes de la falla.';
        }

        return { ok: false, error: msg };
      }
    }

    logAudit_(usuarioNombre, 'UPDATE', 'Trabajos', id, 'Trabajo y movimientos vinculados sincronizados correctamente');
    return {
      ok: true,
      result: {
        id,
        ...j,
        destino: newDestino,
        tipoTrabajo: newDestino === 'PROPIEDAD' ? 'propiedad' : 'tercero',
        cantidad: finalCant,
        precioUnitario: finalPrecio,
        tarifa: finalPrecio,
        importe: finalTotal,
        total: finalTotal,
        moneda: finalMoneda,
        tc: finalTc
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function handleDeleteMachineryJob(id, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000); // Lock de 15 segundos
  try {
    const jobsSheet = findSheetIgnoreCase_('Trabajos');
    const movSheet = findSheetIgnoreCase_('Movimientos');
    if (!jobsSheet || !movSheet) throw new Error('Hojas Trabajos o Movimientos no encontradas.');

    // 1. Comprobar existencia del trabajo en Trabajos y crear respaldo en memoria
    const jRows = jobsSheet.getDataRange().getValues();
    if (jRows.length < 2) return { ok: false, error: 'No existen trabajos registrados.' };

    const jHeaders = jRows[0];
    const jMap = getHeaderIndexMap_(jHeaders);
    const idCol = jMap['id'];
    let jobRowIdx = -1;
    let jobDataBackup = null;

    for (let i = 1; i < jRows.length; i++) {
      if (String(jRows[i][idCol]) === String(id)) {
        jobRowIdx = i + 1; // 1-based index
        jobDataBackup = jRows[i];
        break;
      }
    }
    if (jobRowIdx === -1) {
      return { ok: false, error: 'Trabajo no encontrado: ' + id };
    }

    // 2. Localizar todos los movimientos vinculados con sus datos e IDs
    const mRows = movSheet.getDataRange().getValues();
    const mHeaders = mRows.length > 0 ? mRows[0] : [];
    const mMap = getHeaderIndexMap_(mHeaders);
    const trabIdCol = mMap['trabajoid'];
    const movIdCol = mMap['id'];

    const linkedMovementsToDel = [];

    for (let k = 1; k < mRows.length; k++) {
      if (String(mRows[k][trabIdCol]) === String(id)) {
        linkedMovementsToDel.push({
          rowIdx: k + 1, // 1-based index
          data: mRows[k],
          id: String(mRows[k][movIdCol] || '')
        });
      }
    }

    const totalMovementsToDelete = linkedMovementsToDel.length;

    // Ordenar de mayor a menor fila (de abajo hacia arriba)
    linkedMovementsToDel.sort(function(a, b) { return b.rowIdx - a.rowIdx; });

    // Registro exacto de lo que se elimina efectivamente
    const actuallyDeletedMovements = [];
    let jobDeleted = false;

    try {
      // A. Eliminar de la hoja Movimientos una a una de abajo hacia arriba
      for (let m = 0; m < linkedMovementsToDel.length; m++) {
        const item = linkedMovementsToDel[m];
        movSheet.deleteRow(item.rowIdx);
        actuallyDeletedMovements.push(item);
      }

      // B. Eliminar la fila del trabajo de la hoja Trabajos
      jobsSheet.deleteRow(jobRowIdx);
      jobDeleted = true;

    } catch (errDel) {
      // Ocurrió un error: restaurar ÚNICAMENTE lo que realmente se eliminó
      const restorationErrors = [];

      // 1. Restaurar el trabajo si su fila llegó a eliminarse
      if (jobDeleted && jobDataBackup) {
        try {
          jobsSheet.appendRow(jobDataBackup);
        } catch (eJob) {
          restorationErrors.push('Fallo al reinsertar trabajo (ID: ' + id + '): ' + eJob.message);
        }
      }

      // 2. Restaurar ÚNICAMENTE las filas de movimientos que SÍ fueron eliminadas
      for (let r = 0; r < actuallyDeletedMovements.length; r++) {
        const delMov = actuallyDeletedMovements[r];
        try {
          movSheet.appendRow(delMov.data);
        } catch (eMov) {
          restorationErrors.push('Fallo al reinsertar movimiento (ID: ' + delMov.id + '): ' + eMov.message);
        }
      }

      // 3. Verificación de existencia por ID después de intentar la restauración
      const unverifiedIds = [];

      if (jobDeleted) {
        const currentJobs = getSheetDataAsObjects('Trabajos');
        const jobFound = currentJobs.some(j => String(j.id) === String(id));
        if (!jobFound) {
          unverifiedIds.push('Trabajo ID: ' + id);
        }
      }

      if (actuallyDeletedMovements.length > 0) {
        const currentMovs = getSheetDataAsObjects('Movimientos');
        for (let v = 0; v < actuallyDeletedMovements.length; v++) {
          const mId = actuallyDeletedMovements[v].id;
          const movFound = currentMovs.some(m => String(m.id) === String(mId));
          if (!movFound) {
            unverifiedIds.push('Movimiento ID: ' + mId);
          }
        }
      }

      // Formular respuesta de error descriptiva (SIN devolver ok: true)
      let failureDetail = 'Error durante la eliminación física del trabajo (' + errDel.message + ').';
      if (restorationErrors.length > 0) {
        failureDetail += ' Errores durante la restauración: ' + restorationErrors.join('; ') + '.';
      }
      if (unverifiedIds.length > 0) {
        failureDetail += ' ATENCIÓN: No fue posible verificar la recuperación de los siguientes registros por ID: [' + unverifiedIds.join(', ') + ']. Por favor verifique el estado en la planilla.';
      } else {
        failureDetail += ' Se restauraron exitosamente en la planilla las filas afectadas antes de la interrupción.';
      }

      return {
        ok: false,
        error: failureDetail
      };
    }

    logAudit_(userSession?.usuarioId, 'DELETE_PHYSICAL', 'Trabajos', id, 'Trabajo eliminado físicamente junto a sus ' + totalMovementsToDelete + ' movimientos vinculados');
    return { ok: true, deletedMovements: totalMovementsToDelete };
  } finally {
    lock.releaseLock();
  }
}

// -------------------------------------------------------------
// MOVIMIENTOS (HOJA MOVIMIENTOS ORIGINAL)
// Columnas: id, fecha, campanaId, modulo, clase, itemId, descripcion, loteId, maquinaId, cantidad, unidad, precioUnitario, importe, moneda, tc, trabajoId, creadoPor, creadoEn, actualizadoEn
// -------------------------------------------------------------

function handleGetMovements(campanaId, modulo, clase) {
  let list = getSheetDataAsObjects('Movimientos');
  if (campanaId) {
    list = list.filter(m => String(m.campanaId) === String(campanaId));
  }
  if (modulo) {
    list = list.filter(m => String(m.modulo || '').toUpperCase() === String(modulo).toUpperCase());
  }
  if (clase) {
    list = list.filter(m => String(m.clase || '').toUpperCase() === String(clase).toUpperCase());
  }
  const mapped = list.map(m => ({
    ...m,
    cantidad: Number(m.cantidad) || 0,
    precioUnitario: Number(m.precioUnitario) || 0,
    importe: Number(m.importe) || 0,
    tc: Number(m.tc) || 0
  }));
  return { ok: true, result: mapped, movements: mapped };
}

function handleGetExpenses(campanaId, modulo) {
  return handleGetMovements(campanaId, modulo, 'GASTO');
}

function handleGetIncomes(campanaId, modulo) {
  return handleGetMovements(campanaId, modulo, 'INGRESO');
}

function handleCreateExpense(exp, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = findSheetIgnoreCase_('Movimientos');
    if (!sheet) throw new Error('Hoja Movimientos no encontrada.');

    const headers = getSheetHeaders_(sheet);
    validateRequiredColumns_('Movimientos', headers, SHEET_SCHEMAS.Movimientos);
    const map = getHeaderIndexMap_(headers);

    const id = Utilities.getUuid();
    const cantVal = Number(exp.cantidad) || 1;
    const precioVal = Number(exp.precioUnitario ?? exp.precio) || 0;
    const totalVal = Number(exp.importe) || (cantVal * precioVal);
    const rawMon = String(exp.moneda || 'BOB').toUpperCase();
    const monVal = rawMon === 'USD' ? 'USD' : 'BOB';

    const rawTc = Number(exp.tc ?? exp.tipoCambio);
    const storedTc = Number(getConfigValue('TIPO_CAMBIO', 0));
    const finalTc = rawTc > 0 ? rawTc : storedTc;

    const ahora = new Date().toISOString();
    const usuarioNombre = userSession?.usuarioId || 'operador';

    const row = [];
    row[map['id']] = id;
    row[map['fecha']] = String(exp.fecha || ahora.slice(0, 10));
    row[map['campanaid']] = String(exp.campanaId || '');
    row[map['modulo']] = String(exp.modulo || 'PROPIEDAD').toUpperCase();
    row[map['clase']] = 'GASTO';
    row[map['itemid']] = String(exp.itemId || '');
    row[map['descripcion']] = String(exp.descripcion || exp.itemNombre || '').trim();
    row[map['loteid']] = String(exp.loteId || '');
    row[map['maquinaid']] = String(exp.maquinaId || exp.maquinariaId || '');
    row[map['cantidad']] = cantVal;
    row[map['unidad']] = String(exp.unidad || 'unidades').trim();
    row[map['preciounitario']] = precioVal;
    row[map['importe']] = totalVal;
    row[map['moneda']] = monVal;
    row[map['tc']] = finalTc;
    row[map['trabajoid']] = String(exp.trabajoId || '');
    row[map['creadopor']] = usuarioNombre;
    row[map['creadoen']] = ahora;
    row[map['actualizadoen']] = ahora;

    sheet.appendRow(row);
    logAudit_(usuarioNombre, 'CREATE', 'Movimientos', id, 'Gasto registrado: ' + (exp.descripcion || id));

    return { ok: true, result: { id, ...exp, clase: 'GASTO', importe: totalVal, tc: finalTc } };
  } finally {
    lock.releaseLock();
  }
}

function handleCreateIncome(inc, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = findSheetIgnoreCase_('Movimientos');
    if (!sheet) throw new Error('Hoja Movimientos no encontrada.');

    const headers = getSheetHeaders_(sheet);
    validateRequiredColumns_('Movimientos', headers, SHEET_SCHEMAS.Movimientos);
    const map = getHeaderIndexMap_(headers);

    const id = Utilities.getUuid();
    const cantVal = Number(inc.cantidad) || 1;
    const precioVal = Number(inc.precioUnitario ?? inc.precio) || 0;
    const totalVal = Number(inc.importe) || (cantVal * precioVal);
    const rawMon = String(inc.moneda || 'BOB').toUpperCase();
    const monVal = rawMon === 'USD' ? 'USD' : 'BOB';

    const rawTc = Number(inc.tc ?? inc.tipoCambio);
    const storedTc = Number(getConfigValue('TIPO_CAMBIO', 0));
    const finalTc = rawTc > 0 ? rawTc : storedTc;

    const ahora = new Date().toISOString();
    const usuarioNombre = userSession?.usuarioId || 'operador';

    const row = [];
    row[map['id']] = id;
    row[map['fecha']] = String(inc.fecha || ahora.slice(0, 10));
    row[map['campanaid']] = String(inc.campanaId || '');
    row[map['modulo']] = String(inc.modulo || 'PROPIEDAD').toUpperCase();
    row[map['clase']] = 'INGRESO';
    row[map['itemid']] = String(inc.itemId || '');
    row[map['descripcion']] = String(inc.descripcion || inc.itemNombre || '').trim();
    row[map['loteid']] = String(inc.loteId || '');
    row[map['maquinaid']] = String(inc.maquinaId || inc.maquinariaId || '');
    row[map['cantidad']] = cantVal;
    row[map['unidad']] = String(inc.unidad || 'unidades').trim();
    row[map['preciounitario']] = precioVal;
    row[map['importe']] = totalVal;
    row[map['moneda']] = monVal;
    row[map['tc']] = finalTc;
    row[map['trabajoid']] = String(inc.trabajoId || '');
    row[map['creadopor']] = usuarioNombre;
    row[map['creadoen']] = ahora;
    row[map['actualizadoen']] = ahora;

    sheet.appendRow(row);
    logAudit_(usuarioNombre, 'CREATE', 'Movimientos', id, 'Ingreso registrado: ' + (inc.descripcion || id));

    return { ok: true, result: { id, ...inc, clase: 'INGRESO', importe: totalVal, tc: finalTc } };
  } finally {
    lock.releaseLock();
  }
}

function handleUpdateMovement(id, m, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = findSheetIgnoreCase_('Movimientos');
    if (!sheet) throw new Error('Hoja Movimientos no encontrada.');

    const rows = sheet.getDataRange().getValues();
    if (rows.length < 2) return { ok: false, error: 'No existen movimientos registrados.' };

    const headers = rows[0];
    const map = getHeaderIndexMap_(headers);
    const idCol = map['id'];
    const trabIdCol = map['trabajoid'];

    let foundIdx = -1;
    let linkedTrabajoId = '';

    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][idCol]) === String(id)) {
        foundIdx = i + 1; // 1-based index
        linkedTrabajoId = String(rows[i][trabIdCol] || '').trim();
        break;
      }
    }

    if (foundIdx === -1) {
      return { ok: false, error: 'Movimiento no encontrado: ' + id };
    }

    // Bloquear edición directa si está vinculado a un trabajo de maquinaria
    if (linkedTrabajoId !== '') {
      return {
        ok: false,
        error: 'No se puede editar directamente un movimiento vinculado a un trabajo de maquinaria. Modifíquelo desde el módulo Maquinarias.'
      };
    }

    const ahora = new Date().toISOString();
    const usuarioNombre = userSession?.usuarioId || 'operador';

    const oldRow = rows[foundIdx - 1];
    const oldFecha = String(oldRow[map['fecha']] || '');
    const oldCampanaId = String(oldRow[map['campanaid']] || '');
    const oldModulo = String(oldRow[map['modulo']] || 'PROPIEDAD');
    const oldClase = String(oldRow[map['clase']] || 'GASTO');
    const oldDesc = String(oldRow[map['descripcion']] || '');
    const oldLoteId = String(oldRow[map['loteid']] || '');
    const oldCant = Number(oldRow[map['cantidad']]) || 1;
    const oldUnidad = String(oldRow[map['unidad']] || 'unidades');
    const oldPrecio = Number(oldRow[map['preciounitario']]) || 0;
    const oldMoneda = String(oldRow[map['moneda']] || 'BOB').toUpperCase();
    const oldTc = Number(oldRow[map['tc']]) || 0;

    const finalFecha = m.fecha !== undefined ? String(m.fecha) : oldFecha;
    const finalCampanaId = m.campanaId !== undefined ? String(m.campanaId) : oldCampanaId;
    const finalModulo = m.modulo !== undefined ? String(m.modulo).toUpperCase() : oldModulo;
    const finalClase = m.clase !== undefined ? String(m.clase).toUpperCase() : oldClase;
    const finalDesc = (m.descripcion !== undefined || m.item !== undefined || m.concepto !== undefined || m.itemGasto !== undefined)
      ? String(m.descripcion || m.item || m.concepto || m.itemGasto || '').trim()
      : oldDesc;
    const finalLoteId = m.loteId !== undefined ? String(m.loteId) : oldLoteId;
    const finalCant = m.cantidad !== undefined ? (Number(m.cantidad) || 1) : oldCant;
    const finalUnidad = m.unidad !== undefined ? String(m.unidad).trim() : oldUnidad;
    const finalPrecio = (m.precioUnitario !== undefined || m.precio !== undefined)
      ? Number(m.precioUnitario ?? m.precio)
      : oldPrecio;
    const finalTotal = m.importe !== undefined ? Number(m.importe) : (finalCant * finalPrecio);
    const rawMon = m.moneda !== undefined ? String(m.moneda).toUpperCase() : oldMoneda;
    const finalMoneda = rawMon === 'USD' ? 'USD' : 'BOB';
    const rawTc = Number(m.tc ?? m.tipoCambio);
    const storedTc = Number(getConfigValue('TIPO_CAMBIO', 0));
    const finalTc = rawTc > 0 ? rawTc : (oldTc > 0 ? oldTc : storedTc);

    if (map['fecha'] !== undefined) sheet.getRange(foundIdx, map['fecha'] + 1).setValue(finalFecha);
    if (map['campanaid'] !== undefined) sheet.getRange(foundIdx, map['campanaid'] + 1).setValue(finalCampanaId);
    if (map['modulo'] !== undefined) sheet.getRange(foundIdx, map['modulo'] + 1).setValue(finalModulo);
    if (map['clase'] !== undefined) sheet.getRange(foundIdx, map['clase'] + 1).setValue(finalClase);
    if (map['descripcion'] !== undefined) sheet.getRange(foundIdx, map['descripcion'] + 1).setValue(finalDesc);
    if (map['loteid'] !== undefined) sheet.getRange(foundIdx, map['loteid'] + 1).setValue(finalLoteId);
    if (map['maquinaid'] !== undefined && (m.maquinaId !== undefined || m.maquinariaId !== undefined)) sheet.getRange(foundIdx, map['maquinaid'] + 1).setValue(String(m.maquinaId || m.maquinariaId || '').trim());
    if (map['cantidad'] !== undefined) sheet.getRange(foundIdx, map['cantidad'] + 1).setValue(finalCant);
    if (map['unidad'] !== undefined) sheet.getRange(foundIdx, map['unidad'] + 1).setValue(finalUnidad);
    if (map['preciounitario'] !== undefined) sheet.getRange(foundIdx, map['preciounitario'] + 1).setValue(finalPrecio);
    if (map['importe'] !== undefined) sheet.getRange(foundIdx, map['importe'] + 1).setValue(finalTotal);
    if (map['moneda'] !== undefined) sheet.getRange(foundIdx, map['moneda'] + 1).setValue(finalMoneda);
    if (map['tc'] !== undefined) sheet.getRange(foundIdx, map['tc'] + 1).setValue(finalTc);
    if (map['actualizadoen'] !== undefined) sheet.getRange(foundIdx, map['actualizadoen'] + 1).setValue(ahora);

    logAudit_(usuarioNombre, 'UPDATE', 'Movimientos', id, 'Movimiento actualizado: ' + finalDesc);

    return {
      ok: true,
      result: {
        id,
        fecha: finalFecha,
        campanaId: finalCampanaId,
        modulo: finalModulo,
        clase: finalClase,
        descripcion: finalDesc,
        loteId: finalLoteId,
        cantidad: finalCant,
        unidad: finalUnidad,
        precioUnitario: finalPrecio,
        precio: finalPrecio,
        importe: finalTotal,
        total: finalTotal,
        moneda: finalMoneda,
        tc: finalTc
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function handleUpdateExpense(id, exp, userSession) {
  return handleUpdateMovement(id, { ...exp, clase: 'GASTO' }, userSession);
}

function handleUpdateIncome(id, inc, userSession) {
  return handleUpdateMovement(id, { ...inc, clase: 'INGRESO' }, userSession);
}

function handleDeleteMovement(id, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = findSheetIgnoreCase_('Movimientos');
    if (!sheet) throw new Error('Hoja Movimientos no encontrada.');

    const rows = sheet.getDataRange().getValues();
    if (rows.length < 2) return { ok: false, error: 'No existen movimientos registrados.' };

    const headers = rows[0];
    const map = getHeaderIndexMap_(headers);
    const idCol = map['id'];
    const trabIdCol = map['trabajoid'];

    let foundIdx = -1;
    let linkedTrabajoId = '';

    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][idCol]) === String(id)) {
        foundIdx = i + 1; // 1-based index
        linkedTrabajoId = String(rows[i][trabIdCol] || '').trim();
        break;
      }
    }

    if (foundIdx === -1) {
      return { ok: false, error: 'Movimiento no encontrado: ' + id };
    }

    // Bloquear eliminación individual de movimientos vinculados a trabajos de maquinaria
    if (linkedTrabajoId !== '') {
      return {
        ok: false,
        error: 'No se puede eliminar directamente un movimiento vinculado a un trabajo de maquinaria. Para eliminar este registro, elimine el trabajo correspondiente desde la sección de Maquinarias.'
      };
    }

    // Eliminación física directa para movimientos sin trabajoId
    sheet.deleteRow(foundIdx);
    logAudit_(userSession?.usuarioId, 'DELETE_PHYSICAL', 'Movimientos', id, 'Movimiento eliminado físicamente');

    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function handleDeleteExpense(id, userSession) {
  return handleDeleteMovement(id, userSession);
}

function handleDeleteIncome(id, userSession) {
  return handleDeleteMovement(id, userSession);
}

// -------------------------------------------------------------
// REPORTES FINANCIEROS MULTI-MONEDA (SIN MEZCLAR BS Y USD)
// -------------------------------------------------------------

function convertToCommonCurrencies_(amount, moneda, tc, defaultTc) {
  const num = Number(amount) || 0;
  const mon = String(moneda || 'BOB').toUpperCase();
  const effTc = (Number(tc) > 0) ? Number(tc) : (Number(defaultTc) > 0 ? Number(defaultTc) : 0);

  if (effTc <= 0) {
    throw new Error('Tipo de cambio no configurado. Configure el tipo de cambio en Administración -> Tipo de cambio para emitir reportes financieros.');
  }

  let inBob = 0;
  let inUsd = 0;

  if (mon === 'USD') {
    inUsd = num;
    inBob = num * effTc;
  } else {
    inBob = num;
    inUsd = num / effTc;
  }

  return { inBob: inBob, inUsd: inUsd };
}

function handleGetFinancialReports(campanaId) {
  let jobs = getSheetDataAsObjects('Trabajos');
  let movements = getSheetDataAsObjects('Movimientos');

  if (campanaId) {
    jobs = jobs.filter(j => String(j.campanaId) === String(campanaId));
    movements = movements.filter(m => String(m.campanaId) === String(campanaId));
  }

  const defaultTc = Number(getConfigValue('TIPO_CAMBIO', 0));
  if (defaultTc <= 0) {
    return {
      ok: false,
      error: 'Tipo de cambio no configurado en Google Sheets. Configure el tipo de cambio en Administración -> Tipo de cambio antes de consultar reportes.'
    };
  }

  // 1. Ingresos externos de maquinaria (Servicios a terceros) convertidos fila por fila
  let ext_BOB = 0;
  let ext_USD = 0;
  jobs.filter(j => String(j.destino || '').toUpperCase() === 'TERCERO').forEach(j => {
    const c = convertToCommonCurrencies_(j.importe, j.moneda, j.tc, defaultTc);
    ext_BOB += c.inBob;
    ext_USD += c.inUsd;
  });

  // 2. Servicios internos a lotes propios (Ingreso Maquinarias / Gasto Propiedad) convertidos fila por fila
  let int_BOB = 0;
  let int_USD = 0;
  jobs.filter(j => String(j.destino || '').toUpperCase() === 'PROPIEDAD').forEach(j => {
    const c = convertToCommonCurrencies_(j.importe, j.moneda, j.tc, defaultTc);
    int_BOB += c.inBob;
    int_USD += c.inUsd;
  });

  // 3. Ingresos agrícolas directos (Cosecha / Venta de granos, sin trabajoId) convertidos fila por fila
  let crop_BOB = 0;
  let crop_USD = 0;
  movements.filter(m => {
    const mod = String(m.modulo || '').toUpperCase();
    const cls = String(m.clase || '').toUpperCase();
    const isPropio = Boolean(m.trabajoId);
    return mod === 'PROPIEDAD' && cls === 'INGRESO' && !isPropio;
  }).forEach(m => {
    const c = convertToCommonCurrencies_(m.importe, m.moneda, m.tc, defaultTc);
    crop_BOB += c.inBob;
    crop_USD += c.inUsd;
  });

  // 4. Gastos operativos de maquinaria (Combustible, repuestos, mantenimiento) convertidos fila por fila
  let expMaq_BOB = 0;
  let expMaq_USD = 0;
  movements.filter(m => {
    const mod = String(m.modulo || '').toUpperCase();
    const cls = String(m.clase || '').toUpperCase();
    return mod === 'MAQUINARIAS' && cls === 'GASTO';
  }).forEach(m => {
    const c = convertToCommonCurrencies_(m.importe, m.moneda, m.tc, defaultTc);
    expMaq_BOB += c.inBob;
    expMaq_USD += c.inUsd;
  });

  // 5. Gastos agrícolas directos de la propiedad (Insumos, semillas, agroquímicos, sin trabajoId) convertidos fila por fila
  let expProp_BOB = 0;
  let expProp_USD = 0;
  movements.filter(m => {
    const mod = String(m.modulo || '').toUpperCase();
    const cls = String(m.clase || '').toUpperCase();
    const isPropio = Boolean(m.trabajoId);
    return mod === 'PROPIEDAD' && cls === 'GASTO' && !isPropio;
  }).forEach(m => {
    const c = convertToCommonCurrencies_(m.importe, m.moneda, m.tc, defaultTc);
    expProp_BOB += c.inBob;
    expProp_USD += c.inUsd;
  });

  // Totales por Unidad de Negocio (en BOB)
  const totalIngresosMaquinarias_BOB = ext_BOB + int_BOB;
  const margenMaquinarias_BOB = totalIngresosMaquinarias_BOB - expMaq_BOB;

  const totalIngresosPropiedad_BOB = crop_BOB;
  const totalGastosPropiedadTotal_BOB = expProp_BOB + int_BOB;
  const margenPropiedad_BOB = totalIngresosPropiedad_BOB - totalGastosPropiedadTotal_BOB;

  // CONSOLIDADO GENERAL (en BOB):
  // Los trabajos en propiedad propia son transferencias internas entre unidades.
  // En el resultado neto consolidado se compensan a 0 para no duplicar ingresos ni gastos:
  // Resultado = (Ingresos Externos Maquinaria + Ingresos Cosecha) - (Gastos Directos Maquinaria + Gastos Directos Propiedad)
  const resultadoConsolidado_BOB = (ext_BOB + crop_BOB) - (expMaq_BOB + expProp_BOB);

  // Totales por Unidad de Negocio (en USD)
  const totalIngresosMaquinarias_USD = ext_USD + int_USD;
  const margenMaquinarias_USD = totalIngresosMaquinarias_USD - expMaq_USD;
  const totalIngresosPropiedad_USD = crop_USD;
  const totalGastosPropiedadTotal_USD = expProp_USD + int_USD;
  const margenPropiedad_USD = totalIngresosPropiedad_USD - totalGastosPropiedadTotal_USD;
  const resultadoConsolidado_USD = (ext_USD + crop_USD) - (expMaq_USD + expProp_USD);

  return {
    ok: true,
    result: {
      campanaId: campanaId || 'todas',
      tipoCambioReferencia: defaultTc,
      totales: {
        ingresosTerceros: ext_BOB,
        trabajosPropiedad: int_BOB,
        ingresosCosecha: crop_BOB,
        gastosMaquinarias: expMaq_BOB,
        gastosPropiedadDirectos: expProp_BOB,
        gastosPropiedadTotal: totalGastosPropiedadTotal_BOB,
        margenMaquinarias: margenMaquinarias_BOB,
        margenPropiedad: margenPropiedad_BOB,
        resultadoConsolidado: resultadoConsolidado_BOB,
        // Totales estandarizados en USD para consultas bimonetarias
        usd: {
          ingresosTerceros: ext_USD,
          trabajosPropiedad: int_USD,
          ingresosCosecha: crop_USD,
          gastosMaquinarias: expMaq_USD,
          gastosPropiedadDirectos: expProp_USD,
          gastosPropiedadTotal: totalGastosPropiedadTotal_USD,
          margenMaquinarias: margenMaquinarias_USD,
          margenPropiedad: margenPropiedad_USD,
          resultadoConsolidado: resultadoConsolidado_USD
        }
      },
      detalles: {
        jobsCount: jobs.length,
        movementsCount: movements.length
      }
    }
  };
}

// -------------------------------------------------------------
// ÍTEMS CONFIGURABLES (HOJA ITEMS ORIGINAL)
// Columnas: id, nombre, modulo, clase, icono, unidad, precio, moneda, activo
// -------------------------------------------------------------

function handleGetItemsConfig() {
  const list = getSheetDataAsObjects('Items');
  const mapped = list.map(i => ({
    ...i,
    precio: Number(i.precio) || 0,
    precioPredeterminado: Number(i.precio) || 0,
    activo: i.activo !== false && String(i.activo).toLowerCase() !== 'false'
  }));
  return { ok: true, result: mapped, items: mapped };
}

function handleSaveItemConfig(item, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = findSheetIgnoreCase_('Items');
    if (!sheet) throw new Error('Hoja Items no encontrada.');

    const headers = getSheetHeaders_(sheet);
    validateRequiredColumns_('Items', headers, SHEET_SCHEMAS.Items);
    const map = getHeaderIndexMap_(headers);

    const id = item.id || Utilities.getUuid();
    deleteRowByColumn('Items', 'id', id);

    const row = [];
    row[map['id']] = id;
    row[map['nombre']] = String(item.nombre || '').trim();
    row[map['modulo']] = String(item.modulo || 'PROPIEDAD').toUpperCase();
    row[map['clase']] = String(item.clase || 'GASTO').toUpperCase();
    row[map['icono']] = String(item.icono || 'Tag').trim();
    row[map['unidad']] = String(item.unidad || '').trim();
    row[map['precio']] = Number(item.precio ?? item.precioPredeterminado) || 0;
    row[map['moneda']] = String(item.moneda || 'BOB').toUpperCase();
    row[map['activo']] = item.activo !== false && String(item.activo).toLowerCase() !== 'false';

    sheet.appendRow(row);
    logAudit_(userSession?.usuarioId, 'SAVE', 'Items', id, 'Ítem guardado: ' + item.nombre);

    return { ok: true, result: { ...item, id } };
  } finally {
    lock.releaseLock();
  }
}

// -------------------------------------------------------------
// TIPO DE CAMBIO (HOJA CONFIGURACION ORIGINAL)
// Claves: TIPO_CAMBIO, FECHA_TIPO_CAMBIO, NOTA_TIPO_CAMBIO
// -------------------------------------------------------------

function handleGetExchangeRate() {
  const rawTasa = getConfigValue('TIPO_CAMBIO', '');
  const tasaNum = parseFloat(String(rawTasa || '').replace(',', '.'));

  if (isNaN(tasaNum) || tasaNum <= 0) {
    return {
      ok: false,
      error: 'Tipo de cambio no configurado en Google Sheets (hoja Configuracion, clave TIPO_CAMBIO). Ingrese a Administración -> Configuración -> Tipo de cambio para definirlo.'
    };
  }

  const fechaAct = getConfigValue('FECHA_TIPO_CAMBIO', '');
  const notaAct = getConfigValue('NOTA_TIPO_CAMBIO', '');

  return {
    ok: true,
    result: {
      tasaBobPerUsd: tasaNum,
      tasa: tasaNum,
      tc: tasaNum,
      fuente: 'Configuracion',
      fechaActualizacion: fechaAct || new Date().toISOString().slice(0, 10),
      nota: notaAct || 'Configuración oficial en hoja Configuracion'
    }
  };
}

function handleSaveExchangeRate(cfg, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const tasaNum = parseFloat(String(cfg.tasaBobPerUsd || cfg.tasa || cfg.tc || '').replace(',', '.'));
    if (isNaN(tasaNum) || tasaNum <= 0) {
      return { ok: false, error: 'El tipo de cambio debe ser un número válido mayor a 0.' };
    }

    const fechaStr = cfg.fecha || cfg.fechaActualizacion || new Date().toISOString().slice(0, 10);
    const notaStr = cfg.nota || 'Configurado manualmente por el administrador';

    setConfigValue('TIPO_CAMBIO', tasaNum);
    setConfigValue('FECHA_TIPO_CAMBIO', fechaStr);
    setConfigValue('NOTA_TIPO_CAMBIO', notaStr);

    logAudit_(userSession?.usuarioId, 'SET_FX', 'Configuracion', 'TIPO_CAMBIO', 'Tipo de cambio establecido en ' + tasaNum);

    return {
      ok: true,
      result: {
        tasaBobPerUsd: tasaNum,
        tasa: tasaNum,
        tc: tasaNum,
        fuente: 'Configuracion',
        fechaActualizacion: fechaStr,
        nota: notaStr
      }
    };
  } finally {
    lock.releaseLock();
  }
}

// -------------------------------------------------------------
// ACTIVOS PATRIMONIALES Y MEJORAS (HOJAS ACTIVOS Y MEJORAS ORIGINALES)
// Activos: id, tipo, referenciaId, nombre, valorInicial, moneda, tc, fecha, observacion, activo
// Mejoras: id, activoId, fecha, descripcion, importe, moneda, tc, observacion, creadoPor, creadoEn
// -------------------------------------------------------------

function handleGetAssets() {
  const assets = getSheetDataAsObjects('Activos');
  const improvements = getSheetDataAsObjects('Mejoras');

  const fullAssets = assets.map(a => {
    const list = improvements.filter(m => String(m.activoId) === String(a.id));
    const sumMejoras = list.reduce((acc, m) => acc + (Number(m.importe) || 0), 0);
    const valIni = Number(a.valorInicial) || 0;
    return {
      ...a,
      valorInicial: valIni,
      fechaAdquisicion: a.fecha,
      valorAcumulado: valIni + sumMejoras,
      mejoras: list.map(m => ({
        ...m,
        costo: Number(m.importe) || 0
      })),
      activo: a.activo !== false && String(a.activo).toLowerCase() !== 'false'
    };
  });
  return { ok: true, result: fullAssets, assets: fullAssets };
}

function handleCreateAsset(a, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = findSheetIgnoreCase_('Activos');
    if (!sheet) throw new Error('Hoja Activos no encontrada.');

    const headers = getSheetHeaders_(sheet);
    validateRequiredColumns_('Activos', headers, SHEET_SCHEMAS.Activos);
    const map = getHeaderIndexMap_(headers);

    const id = Utilities.getUuid();
    const valIni = Number(a.valorInicial) || 0;
    const rawTc = Number(a.tc || a.tipoCambio || 0);

    const row = [];
    row[map['id']] = id;
    row[map['tipo']] = String(a.tipo || 'MAQUINARIA').toUpperCase();
    row[map['referenciaid']] = String(a.referenciaId || a.identificador || '');
    row[map['nombre']] = String(a.nombre || '').trim();
    row[map['valorinicial']] = valIni;
    row[map['moneda']] = String(a.moneda || 'USD').toUpperCase();
    row[map['tc']] = rawTc;
    row[map['fecha']] = String(a.fecha || a.fechaAdquisicion || new Date().toISOString().slice(0, 10));
    row[map['observacion']] = String(a.observacion || a.observaciones || '');
    row[map['activo']] = a.activo !== false;

    sheet.appendRow(row);
    SpreadsheetApp.flush();
    logAudit_(userSession?.usuarioId, 'CREATE', 'Activos', id, 'Activo creado: ' + a.nombre);

    return {
      ok: true,
      result: {
        id,
        ...a,
        valorInicial: valIni,
        valorAcumulado: valIni,
        mejoras: []
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function handleAddAssetImprovement(assetId, imp, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = findSheetIgnoreCase_('Mejoras');
    if (!sheet) throw new Error('Hoja Mejoras no encontrada.');

    const headers = getSheetHeaders_(sheet);
    validateRequiredColumns_('Mejoras', headers, SHEET_SCHEMAS.Mejoras);
    const map = getHeaderIndexMap_(headers);

    const id = Utilities.getUuid();
    const impVal = Number(imp.importe ?? imp.costo) || 0;
    const rawTc = Number(imp.tc || 0);

    const row = [];
    row[map['id']] = id;
    row[map['activoid']] = String(assetId);
    row[map['fecha']] = String(imp.fecha || new Date().toISOString().slice(0, 10));
    row[map['descripcion']] = String(imp.descripcion || '').trim();
    row[map['importe']] = impVal;
    row[map['moneda']] = String(imp.moneda || 'USD').toUpperCase();
    row[map['tc']] = rawTc;
    row[map['observacion']] = String(imp.observacion || '');
    row[map['creadopor']] = userSession?.usuarioId || 'admin';
    row[map['creadoen']] = new Date().toISOString();

    sheet.appendRow(row);
    SpreadsheetApp.flush();
    logAudit_(userSession?.usuarioId, 'ADD_IMPROVEMENT', 'Mejoras', id, 'Mejora añadida a activo ' + assetId);

    return handleGetAssets();
  } finally {
    lock.releaseLock();
  }
}

function handleUpdateAsset(id, a, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = findSheetIgnoreCase_('Activos');
    if (!sheet) throw new Error('Hoja Activos no encontrada.');

    const rows = sheet.getDataRange().getValues();
    if (rows.length < 2) return { ok: false, error: 'No existen activos registrados.' };

    const headers = rows[0];
    const map = getHeaderIndexMap_(headers);
    const idCol = map['id'];
    const refCol = map['referenciaid'];

    const targetId = String(id || '').trim();
    const targetRef = String(a.referenciaId || '').trim();

    if (!targetId && !targetRef) {
      return { ok: false, error: 'Se requiere ID o referenciaId para actualizar el activo.' };
    }

    const matches = [];
    for (let i = 1; i < rows.length; i++) {
      const rowId = idCol !== undefined ? String(rows[i][idCol] || '').trim() : '';
      const rowRef = refCol !== undefined ? String(rows[i][refCol] || '').trim() : '';

      const match =
        (targetId && (rowId === targetId || rowRef === targetId)) ||
        (targetRef && (rowId === targetRef || rowRef === targetRef));

      if (match) {
        matches.push(i + 1);
      }
    }

    if (matches.length === 0) {
      return { ok: false, error: 'Activo no encontrado: ' + (targetId || targetRef) };
    }

    if (matches.length > 1) {
      return { ok: false, error: 'Coincidencia ambigua: existen múltiples activos con el mismo ID o referencia.' };
    }

    const targetRow = matches[0];
    const rowIdx = targetRow - 1;

    if (a.valorInicial !== undefined && map['valorinicial'] !== undefined) {
      sheet.getRange(targetRow, map['valorinicial'] + 1).setValue(Number(a.valorInicial) || 0);
    }
    if (a.nombre !== undefined && map['nombre'] !== undefined) {
      sheet.getRange(targetRow, map['nombre'] + 1).setValue(String(a.nombre).trim());
    }
    if (a.tipo !== undefined && map['tipo'] !== undefined) {
      sheet.getRange(targetRow, map['tipo'] + 1).setValue(String(a.tipo).toUpperCase());
    }
    if (a.referenciaId !== undefined && refCol !== undefined) {
      sheet.getRange(targetRow, refCol + 1).setValue(String(a.referenciaId));
    }
    SpreadsheetApp.flush();
    logAudit_(userSession?.usuarioId, 'UPDATE', 'Activos', String(rows[rowIdx][idCol] || id), 'Activo actualizado: ' + (a.nombre || id));
    return handleGetAssets();
  } finally {
    lock.releaseLock();
  }
}

function handleUpdateAssetImprovement(id, imp, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = findSheetIgnoreCase_('Mejoras');
    if (!sheet) throw new Error('Hoja Mejoras no encontrada.');

    const rows = sheet.getDataRange().getValues();
    if (rows.length < 2) return { ok: false, error: 'No existen mejoras registradas.' };

    const headers = rows[0];
    const map = getHeaderIndexMap_(headers);
    const idCol = map['id'];
    if (idCol === undefined) throw new Error('Columna id no encontrada en Mejoras.');

    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][idCol]).trim() === String(id).trim()) {
        if (imp.fecha !== undefined && map['fecha'] !== undefined) {
          sheet.getRange(i + 1, map['fecha'] + 1).setValue(String(imp.fecha));
        }
        if (imp.descripcion !== undefined && map['descripcion'] !== undefined) {
          sheet.getRange(i + 1, map['descripcion'] + 1).setValue(String(imp.descripcion).trim());
        }
        if (imp.importe !== undefined || imp.costo !== undefined) {
          const val = Number(imp.importe ?? imp.costo) || 0;
          if (map['importe'] !== undefined) sheet.getRange(i + 1, map['importe'] + 1).setValue(val);
        }
        if (imp.moneda !== undefined && map['moneda'] !== undefined) {
          sheet.getRange(i + 1, map['moneda'] + 1).setValue(String(imp.moneda).toUpperCase());
        }
        SpreadsheetApp.flush();
        logAudit_(userSession?.usuarioId, 'UPDATE_IMPROVEMENT', 'Mejoras', id, 'Mejora actualizada: ' + (imp.descripcion || id));
        return handleGetAssets();
      }
    }
    return { ok: false, error: 'Mejora no encontrada: ' + id };
  } finally {
    lock.releaseLock();
  }
}

function handleDeleteAssetImprovement(id, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = findSheetIgnoreCase_('Mejoras');
    if (!sheet) throw new Error('Hoja Mejoras no encontrada.');

    const rows = sheet.getDataRange().getValues();
    if (rows.length < 2) return { ok: false, error: 'No existen mejoras registradas.' };

    const headers = rows[0];
    const map = getHeaderIndexMap_(headers);
    const idCol = map['id'];
    if (idCol === undefined) throw new Error('Columna id no encontrada en Mejoras.');

    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][idCol]).trim() === String(id).trim()) {
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        logAudit_(userSession?.usuarioId, 'DELETE_IMPROVEMENT', 'Mejoras', id, 'Mejora eliminada');
        return handleGetAssets();
      }
    }
    return { ok: false, error: 'Mejora no encontrada: ' + id };
  } finally {
    lock.releaseLock();
  }
}

// -------------------------------------------------------------
// AUDITORÍA (HOJA AUDITORIA ORIGINAL)
// Columnas: id, fecha, usuarioId, accion, entidad, entidadId, detalle
// -------------------------------------------------------------

function logAudit_(usuarioId, accion, entidad, entidadId, detalle) {
  try {
    const sheet = findSheetIgnoreCase_('Auditoria');
    if (!sheet) return;

    const headers = getSheetHeaders_(sheet);
    const map = getHeaderIndexMap_(headers);
    if (map['id'] === undefined || map['fecha'] === undefined) return;

    const row = [];
    row[map['id']] = Utilities.getUuid();
    row[map['fecha']] = new Date().toISOString();
    row[map['usuarioid']] = String(usuarioId || 'sistema');
    row[map['accion']] = String(accion || '');
    row[map['entidad']] = String(entidad || '');
    row[map['entidadid']] = String(entidadId || '');
    row[map['detalle']] = typeof detalle === 'object' ? JSON.stringify(detalle) : String(detalle || '');

    sheet.appendRow(row);
  } catch (e) {
    // La auditoría nunca debe abortar la transacción principal
  }
}

// -------------------------------------------------------------
// HELPERS GENERALES Y MANIPULACIÓN DE HOJAS
// -------------------------------------------------------------

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheetDataAsObjects(sheetName) {
  const sheet = findSheetIgnoreCase_(sheetName);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  const headers = rows[0];
  const list = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0] && row[0] !== 0) continue;
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    list.push(obj);
  }
  return list;
}

function deleteRowByColumn(sheetName, colName, value) {
  const sheet = findSheetIgnoreCase_(sheetName);
  if (!sheet) return;
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return;
  const headers = rows[0];
  const map = getHeaderIndexMap_(headers);
  const colIdx = map[colName.toLowerCase()];
  if (colIdx === undefined) return;

  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][colIdx]) === String(value)) {
      sheet.deleteRow(i + 1);
    }
  }
}
`;
