/**
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
  TiposMaquina: ['id','nombre','activo','creadoEn'],
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
    return handleLogin2026_(data);
  }

  if (action === 'auth.admin.authorize') {
    return handleAdminAuthorize(data);
  }

  // 2. Validación de sesión (Usuario y/o Administrador)
  const userToken = p.token || (p.data && p.data.token);
  const adminTok = p.tokenAdmin || p.adminToken || (p.data && (p.data.tokenAdmin || p.data.adminToken));

  const adminSession = validarAdmin2026_(adminTok);
  const userSession = validarSesion2026_(userToken);

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
    'user.list', 'user.create', 'user.update', 'user.reset', 'user.revoke',
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
    'machineType.save',
    'machineType.delete',
    'harvest.update',
    'work.update',
    'updateMachineryJob',
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
    'fx.refresh',
    'refreshExchangeRateBcb',
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
    case 'user.list': return usuariosListar2026_();
    case 'user.create': return usuariosCrear2026_(payload, userSession);
    case 'user.update': return usuariosActualizar2026_(payload, userSession);
    case 'user.reset': return usuariosRestablecer2026_(payload, userSession);
    case 'user.revoke': return usuariosRevocar2026_(payload, userSession);
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
    // --- Cosechas sin precio y asignaciones de precio ---
    case 'harvest.list': return cosechasListar_2026(payload);
    case 'harvest.create': return cosechasCrear_2026(payload, userSession);
    case 'harvest.update':
      if (!adminSession) return {ok:false,error:'Solo el administrador puede editar cosechas.'};
      return cosechasActualizar_2026(payload, userSession);
    case 'harvest.price': return cosechasAsignarPrecio_2026(payload, userSession);
    case 'harvest.pending': return cosechasListar_2026({soloPendientes:true});
    case 'expense.allocate': return gastosDistribuirLotes_2026(payload, userSession);
    case 'expense.allocations': return gastosDistribucionesListar_2026(payload);

    // --- Cuentas por cobrar de servicios externos ---
    case 'cobros.list':
      return cobrosListar_2026(payload);
    case 'cobros.registrar':
      return cobrosRegistrar_2026(payload, userSession);
    case 'cobros.estado':
      return cobrosEstado_2026(payload.trabajoId || payload.id);

    case 'machineType.list':
      return handleMachineTypeList_2026();
    case 'machineType.save':
      return handleMachineTypeSave_2026(payload, userSession);
    case 'machineType.delete':
      return handleMachineTypeDelete_2026(payload.id, userSession);
    case 'machineJobType.list':
      return handleGetMachineJobTypes(payload.maquinaId);
    case 'machineJobType.save':
      return handleSaveMachineJobType(payload.jobType || payload.trabajo || payload, userSession);
    case 'machineJobType.delete':
      return handleDeleteMachineJobType(payload.id, userSession);
    case 'machineJobType.seed':
      return {ok:false,error:'La carga automática antigua está deshabilitada. Los implementos ya fueron migrados.'};

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
        if (!adminSession) return {ok:false,error:'Solo el administrador puede modificar trabajos guardados.'};
        return handleUpdateMachineryJob(payload.id || (payload.job && payload.job.id) || (payload.trabajo && payload.trabajo.id), payload.job || payload.trabajo || payload, userSession);
      }
      return handleCreateMachineryJob(payload.job || payload.trabajo || payload, userSession);
    case 'work.update':
    case 'updateMachineryJob':
      if (!adminSession) return {ok:false,error:'Solo el administrador puede modificar trabajos guardados.'};
      return handleUpdateMachineryJob(payload.id || (payload.job && payload.job.id) || (payload.trabajo && payload.trabajo.id), payload.job || payload.trabajo || payload, userSession);
    case 'deleteMachineryJob':
    case 'work.delete':
      if (!adminSession) return {ok:false,error:'Solo el administrador puede eliminar trabajos.'};
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
        if (!adminSession) return {ok:false,error:'Solo el administrador puede modificar gastos guardados.'};
        return handleUpdateExpense(payload.id || payload.expense.id, payload.expense || payload, userSession);
      }
      return handleCreateExpense(payload.expense || payload, userSession);
    case 'updateExpense':
      if (!adminSession) return {ok:false,error:'Solo el administrador puede editar o eliminar movimientos guardados.'};
        return handleUpdateExpense(payload.id || (payload.expense && payload.expense.id), payload.expense || payload, userSession);
    case 'deleteExpense':
    case 'movement.delete.expense':
      if (!adminSession) return {ok:false,error:'Solo el administrador puede editar o eliminar movimientos guardados.'};
        return handleDeleteExpense(payload.id || payload.movimientoId, userSession);

    case 'getIncomes':
    case 'movement.list.incomes':
      return handleGetIncomes(payload.campanaId, payload.modulo);
    case 'createIncome':
    case 'movement.save.income':
      if (payload.id || (payload.income && payload.income.id)) {
        if (!adminSession) return {ok:false,error:'Solo el administrador puede modificar ingresos guardados.'};
        return handleUpdateIncome(payload.id || payload.income.id, payload.income || payload, userSession);
      }
      return handleCreateIncome(payload.income || payload, userSession);
    case 'updateIncome':
      if (!adminSession) return {ok:false,error:'Solo el administrador puede editar o eliminar movimientos guardados.'};
        return handleUpdateIncome(payload.id || (payload.income && payload.income.id), payload.income || payload, userSession);
    case 'deleteIncome':
    case 'movement.delete.income':
      if (!adminSession) return {ok:false,error:'Solo el administrador puede editar o eliminar movimientos guardados.'};
        return handleDeleteIncome(payload.id || payload.movimientoId, userSession);

    case 'movement.save': {
      if (payload.id) {
        if (!adminSession) return {ok:false,error:'Solo el administrador puede modificar movimientos guardados.'};
        return handleUpdateMovement(payload.id, payload, userSession);
      }
      const isInc = String(payload.clase || payload.tipo || '').toUpperCase().includes('ING');
      if (isInc) {
        return handleCreateIncome(payload.income || payload, userSession);
      }
      return handleCreateExpense(payload.expense || payload, userSession);
    }
    case 'movement.update':
      if (!adminSession) return {ok:false,error:'Solo el administrador puede editar o eliminar movimientos guardados.'};
        return handleUpdateMovement(payload.id || payload.movimientoId, payload.movement || payload.movimiento || payload, userSession);

    case 'movement.delete':
      if (!adminSession) return {ok:false,error:'Solo el administrador puede editar o eliminar movimientos guardados.'};
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

    // --- Tipo de Cambio (Hoja Configuracion + BCB Oficial) ---
    case 'getExchangeRateConfig':
    case 'fx.get':
      return handleGetExchangeRate();
    case 'fx.syncAuto':
    case 'syncExchangeRateAuto':
      return handleSyncExchangeRateAuto(userSession);
    case 'fx.refresh':
    case 'refreshExchangeRateBcb':
      return handleRefreshExchangeRateBcb(payload || {}, userSession);
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
  const machineJobTypes = findSheetIgnoreCase_('TrabajosMaquinaria') ? handleGetMachineJobTypes().result : [];
  const machineTypes = findSheetIgnoreCase_('TiposMaquina') ? getSheetDataAsObjects('TiposMaquina') : [];
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
      machineTypes: machineTypes,
      tiposMaquina: machineTypes,
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
    const tipoRes = resolverTipoMaquina_2026(m);
    row[map['tipo']] = tipoRes.nombre;
    if (map['tipomaquinaid'] !== undefined) row[map['tipomaquinaid']] = tipoRes.id;
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
    if (m.tipo !== undefined || m.tipoMaquinaId !== undefined) {
      const tipoRes = resolverTipoMaquina_2026(m);
      if (map['tipo'] !== undefined) sheet.getRange(targetRow,map['tipo']+1).setValue(tipoRes.nombre);
      if (map['tipomaquinaid'] !== undefined) sheet.getRange(targetRow,map['tipomaquinaid']+1).setValue(tipoRes.id);
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

    if (getSheetDataAsObjects('Trabajos').some(t=>String(t.maquinaId)===idTrim) ||
        getSheetDataAsObjects('Movimientos').some(t=>String(t.maquinaId)===idTrim) ||
        getSheetDataAsObjects('TrabajosMaquinaria').some(t=>String(t.maquinaId)===idTrim)) {
      return {ok:false,error:'Esta máquina tiene trabajos o implementos asociados. Desactívela en lugar de eliminarla.'};
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
    const maquina = getSheetDataAsObjects('Maquinas').find(m=>String(m.id)===String(maquinaId));
    list = list.filter(j => maquina && String(j.tipoMaquinaId || '') === String(maquina.tipoMaquinaId || ''));
  }
  const mapped = list.filter(j => String(j.nombre || '').trim().toLowerCase() !== 'tractor solo').map(j => ({
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
    const tipoId = resolverTipoImplemento_2026(j);
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
      if (map['tipomaquinaid'] !== undefined) sheet.getRange(foundRowIdx,map['tipomaquinaid']+1).setValue(tipoId);
      // maquinaId se conserva únicamente como referencia histórica, no se reasigna.
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
      if (map['maquinaid'] !== undefined) row[map['maquinaid']] = maquinaId;
      if (map['tipomaquinaid'] !== undefined) row[map['tipomaquinaid']] = tipoId;
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
      if (getSheetDataAsObjects('Trabajos').some(t=>String(t.implementoId || t.trabajoTipoId || '')===String(id))) {
        return {ok:false,error:'Implemento utilizado en trabajos. Desactívelo en lugar de eliminarlo.'};
      }
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
    const implementoId = validarImplementoServicio_2026(maqId,j);
    if (!maqId) throw new Error('Debe especificar una maquinaria.');

    const destinoVal = String(j.destino || (j.tipoTrabajo === 'propiedad' ? 'PROPIEDAD' : 'TERCERO')).toUpperCase();
    if (destinoVal === 'PROPIEDAD' && (!j.loteId || String(j.loteId).trim() === '')) {
      throw new Error('Los trabajos para Propiedad requieren seleccionar obligatoriamente un lote.');
    }

    // Validación estricta de tipo de cambio
    const finalTc = resolverTipoCambioOperacion_2026(j.tc ?? j.tipoCambio);

    // Validación y recálculo obligatorio de importe: importe = cantidad * precioUnitario
    const cantVal = Number(j.cantidad);
    if (isNaN(cantVal) || cantVal <= 0) {
      throw new Error('La cantidad de trabajo debe ser un número mayor a 0.');
    }
    const precioVal = Number(j.precioUnitario ?? j.tarifa);
    if (isNaN(precioVal) || precioVal < 0) {
      throw new Error('El precio unitario / tarifa no puede ser un número negativo.');
    }
    const totalVal = redondear2_2026(cantVal * precioVal);

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
    if (jMap['implementoid'] !== undefined) jRow[jMap['implementoid']] = implementoId;
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

    // Los trabajos externos nuevos se consideran pendientes salvo indicación expresa.
    // El pago inicial se registra en Cobros, nunca como otro INGRESO.
    const cobroInicial = destinoVal === 'TERCERO'
      ? Number(j.montoCobradoInicial ?? (String(j.estadoCobro || '').toUpperCase() === 'PAGADO' ? totalVal : 0))
      : 0;
    if (!Number.isFinite(cobroInicial) || cobroInicial < 0 || cobroInicial > totalVal) {
      throw new Error('El cobro inicial debe estar entre cero y el importe del servicio.');
    }
    if (destinoVal === 'TERCERO') cobrosPrepararHoja_2026();
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

    if (destinoVal === 'TERCERO' && cobroInicial > 0) {
      const cobroIniUsd = monVal === 'USD' ? redondear2_2026(cobroInicial) : redondear2_2026(cobroInicial / finalTc);
      cobrosAnexar_2026({trabajoId:id, fecha:String(j.fecha || ahora.slice(0,10)),
        importe:cobroIniUsd, importeOriginal:redondear2_2026(cobroInicial), monedaCobro:monVal,
        tc:finalTc, importeUsd:cobroIniUsd, observacion:'Cobro inicial', creadoPor:usuarioNombre});
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
  lock.waitLock(15000);
  try {
    const idTrim = String(id || '').trim();
    if (!idTrim) return { ok: false, error: 'Se requiere el ID del trabajo a modificar.' };

    const jobsSheet = findSheetIgnoreCase_('Trabajos');
    const movSheet = findSheetIgnoreCase_('Movimientos');
    if (!jobsSheet || !movSheet) throw new Error('Hojas Trabajos o Movimientos no encontradas.');

    const jRows = jobsSheet.getDataRange().getValues();
    if (jRows.length < 2) return { ok: false, error: 'No existen trabajos registrados.' };

    const jHeaders = jRows[0];
    validateRequiredColumns_('Trabajos', jHeaders, SHEET_SCHEMAS.Trabajos);
    const jMap = getHeaderIndexMap_(jHeaders);

    const jobMatches = [];
    for (let i = 1; i < jRows.length; i++) {
      if (String(jRows[i][jMap['id']]) === idTrim) {
        jobMatches.push(i + 1);
      }
    }
    if (jobMatches.length === 0) return { ok: false, error: 'Trabajo no encontrado: ' + idTrim };
    if (jobMatches.length > 1) {
      return { ok: false, error: 'Inconsistencia detectada: existen múltiples trabajos con el ID ' + idTrim + '.' };
    }

    const foundRowIdx = jobMatches[0];
    const oldRow = jRows[foundRowIdx - 1].slice();

    const oldDestino = String(oldRow[jMap['destino']] || 'TERCERO').toUpperCase();
    const oldLoteId = String(oldRow[jMap['loteid']] || '');
    const oldCliente = String(oldRow[jMap['cliente']] || '');
    const oldMaqId = String(oldRow[jMap['maquinaid']] || '');
    const oldFecha = normalizeConfigDateStr_(oldRow[jMap['fecha']]) || String(oldRow[jMap['fecha']] || '');
    const oldCampanaId = String(oldRow[jMap['campanaid']] || '');
    const oldCant = Number(oldRow[jMap['cantidad']]) || 0;
    const oldUnidad = String(oldRow[jMap['unidad']] || 'ha');
    const oldPrecio = Number(oldRow[jMap['preciounitario']]) || 0;
    const oldMoneda = String(oldRow[jMap['moneda']] || 'BOB').toUpperCase() === 'USD' ? 'USD' : 'BOB';
    const oldTc = Number(oldRow[jMap['tc']]) || 0;
    const oldObs = String(oldRow[jMap['observacion']] || '');
    const oldImplementoId = jMap['implementoid'] !== undefined
      ? String(oldRow[jMap['implementoid']] || '')
      : (jMap['trabajotipoid'] !== undefined ? String(oldRow[jMap['trabajotipoid']] || '') : '');
    const oldTrabajoNombre = jMap['trabajonombre'] !== undefined ? String(oldRow[jMap['trabajonombre']] || '') : '';

    const ahora = new Date().toISOString();
    const usuarioNombre = (userSession && userSession.usuarioId) || 'admin';

    // 1. Validar destino, máquina, implemento, lote/cliente, campaña y fecha
    let newDestino = oldDestino;
    if (j.destino !== undefined && String(j.destino).trim() !== '') {
      newDestino = String(j.destino).trim().toUpperCase();
    } else if (j.tipoTrabajo !== undefined && String(j.tipoTrabajo).trim() !== '') {
      newDestino = String(j.tipoTrabajo).toLowerCase() === 'propiedad' ? 'PROPIEDAD' : 'TERCERO';
    }
    if (newDestino !== 'PROPIEDAD' && newDestino !== 'TERCERO') {
      throw new Error('Destino de trabajo inválido. Debe ser PROPIEDAD o TERCERO.');
    }

    const finalFecha = validarFechaIso_2026(j.fecha, oldFecha);
    const finalCampanaId = j.campanaId !== undefined ? String(j.campanaId).trim() : oldCampanaId;
    if (finalCampanaId && !getSheetDataAsObjects('Campanas').some(c => String(c.id) === finalCampanaId)) {
      throw new Error('La campaña seleccionada no existe.');
    }

    const finalMaqId = (j.maquinaId || j.maquinariaId)
      ? String(j.maquinaId || j.maquinariaId).trim()
      : oldMaqId;
    const maquinaObj = getSheetDataAsObjects('Maquinas').find(m => String(m.id) === finalMaqId);
    if (!maquinaObj) {
      throw new Error('La máquina seleccionada no existe.');
    }

    const finalImplementoId = (j.implementoId !== undefined || j.trabajoTipoId !== undefined)
      ? validarImplementoServicio_2026(finalMaqId, j)
      : oldImplementoId;
    if (finalImplementoId) {
      validarImplementoServicio_2026(finalMaqId, { implementoId: finalImplementoId });
    }

    let finalTrabajoNombre = '';
    if (finalImplementoId) {
      const impObj = getSheetDataAsObjects('TrabajosMaquinaria').find(x => String(x.id) === finalImplementoId);
      finalTrabajoNombre = String(j.trabajoNombre || (impObj && impObj.nombre) || oldTrabajoNombre || '').trim();
    } else if (j.trabajoNombre !== undefined) {
      finalTrabajoNombre = String(j.trabajoNombre || '').trim();
    } else if (j.implementoId === undefined && j.trabajoTipoId === undefined) {
      finalTrabajoNombre = oldTrabajoNombre;
    }

    let finalLoteId = '';
    let finalLoteNombre = '';
    let finalCliente = '';
    if (newDestino === 'PROPIEDAD') {
      const candidateLote = j.loteId !== undefined ? String(j.loteId).trim() : oldLoteId;
      if (!candidateLote) {
        throw new Error('Los trabajos para Propiedad requieren seleccionar obligatoriamente un lote.');
      }
      const loteObj = getSheetDataAsObjects('Lotes').find(l => String(l.id) === candidateLote);
      if (!loteObj) throw new Error('El lote seleccionado no existe.');
      finalLoteId = candidateLote;
      finalLoteNombre = String(j.loteNombre || loteObj.nombre || candidateLote);
      finalCliente = '';
    } else {
      finalLoteId = '';
      finalCliente = j.cliente !== undefined ? String(j.cliente || '').trim() : oldCliente;
    }

    // 2. Validar cantidad, tarifa, moneda, tipo de cambio e importe recalculado
    const finalCant = j.cantidad !== undefined
      ? Number(String(j.cantidad).replace(',', '.'))
      : oldCant;
    if (!Number.isFinite(finalCant) || finalCant <= 0) {
      throw new Error('La cantidad debe ser un número mayor a 0.');
    }

    const finalPrecio = (j.precioUnitario !== undefined || j.tarifa !== undefined)
      ? Number(String(j.precioUnitario ?? j.tarifa).replace(',', '.'))
      : oldPrecio;
    if (!Number.isFinite(finalPrecio) || finalPrecio < 0) {
      throw new Error('El precio unitario / tarifa no puede ser negativo.');
    }

    const finalTotal = redondear2_2026(finalCant * finalPrecio);
    const rawMon = j.moneda !== undefined ? String(j.moneda).toUpperCase() : oldMoneda;
    if (!['USD','BOB','BS'].includes(rawMon)) throw new Error('Moneda de servicio inválida.');
    const finalMoneda = rawMon === 'USD' ? 'USD' : 'BOB';
    const finalTc = resolverTipoCambioOperacion_2026(j.tc ?? j.tipoCambio, oldTc);
    const finalUnidad = j.unidad !== undefined ? String(j.unidad).trim() || 'ha' : oldUnidad;

    let finalObs = (j.observacion !== undefined || j.observaciones !== undefined)
      ? String(j.observacion ?? j.observaciones ?? '').trim()
      : oldObs;
    if (finalTrabajoNombre) {
      finalObs = finalObs.replace(/\s*\[Trabajo:[^\]]*\]/g, '').trim();
      finalObs = finalObs ? (finalObs + ' [Trabajo: ' + finalTrabajoNombre + ']') : ('[Trabajo: ' + finalTrabajoNombre + ']');
    } else if (j.implementoId === '' || j.trabajoTipoId === '') {
      finalObs = finalObs.replace(/\s*\[Trabajo:[^\]]*\]/g, '').trim();
    }

    // 3. Validar consistencia con cobros existentes (dentro del LockService)
    const pagosExistentes = cobrosFilas_2026().filter(r => String(r.trabajoid) === idTrim);
    if (pagosExistentes.length > 0) {
      if (newDestino !== 'TERCERO') {
        return {
          ok: false,
          error: 'No se puede cambiar este servicio a Propiedad porque ya tiene cobros registrados.'
        };
      }
      const defaultTc = Number(String(getConfigValue('TIPO_CAMBIO', 0) || '').replace(',', '.')) || finalTc;
      const trabajoAnterior = cobrosMapTrabajoDesdeFila_2026(oldRow, jMap);
      const estadoPrevio = cobrosCalcularCuenta_2026(trabajoAnterior, pagosExistentes, defaultTc);
      const nuevoImporteUsd = finalMoneda === 'USD'
        ? finalTotal
        : redondear2_2026(finalTotal / finalTc);

      if (Math.round(nuevoImporteUsd * 100) < Math.round(estadoPrevio.cobrado * 100)) {
        return {
          ok: false,
          error: 'El nuevo importe (USD ' + nuevoImporteUsd.toFixed(2) + ') no puede ser menor al monto ya cobrado (USD ' + estadoPrevio.cobrado.toFixed(2) + ').'
        };
      }
    }

    // 4. Verificar consistencia estricta de Movimientos vinculados ANTES de escribir
    const mRows = movSheet.getDataRange().getValues();
    if (mRows.length < 1) throw new Error('Hoja Movimientos sin encabezados.');
    validateRequiredColumns_('Movimientos', mRows[0], SHEET_SCHEMAS.Movimientos);
    const mMap = getHeaderIndexMap_(mRows[0]);

    const incomeMatches = [];
    const expenseMatches = [];
    for (let k = 1; k < mRows.length; k++) {
      if (String(mRows[k][mMap['trabajoid']]) === idTrim) {
        const mod = String(mRows[k][mMap['modulo']] || '').toUpperCase();
        const cls = String(mRows[k][mMap['clase']] || '').toUpperCase();
        if (mod === 'MAQUINARIAS' && cls === 'INGRESO') {
          incomeMatches.push({ rowIdx: k + 1, data: mRows[k].slice() });
        } else if (mod === 'PROPIEDAD' && cls === 'GASTO') {
          expenseMatches.push({ rowIdx: k + 1, data: mRows[k].slice() });
        }
      }
    }

    if (incomeMatches.length !== 1) {
      return {
        ok: false,
        error: 'No se puede garantizar consistencia entre Trabajos y Movimientos: se esperaba exactamente 1 ingreso de Maquinarias vinculado y se encontraron ' + incomeMatches.length + '. No se aplicaron cambios.'
      };
    }
    if (oldDestino === 'PROPIEDAD' && expenseMatches.length !== 1) {
      return {
        ok: false,
        error: 'No se puede garantizar consistencia entre Trabajos y Movimientos: el trabajo en Propiedad debería tener exactamente 1 gasto vinculado y se encontraron ' + expenseMatches.length + '. No se aplicaron cambios.'
      };
    }
    if (oldDestino === 'TERCERO' && expenseMatches.length > 0) {
      return {
        ok: false,
        error: 'Inconsistencia detectada: el servicio a tercero tiene ' + expenseMatches.length + ' gasto(s) de Propiedad vinculados. No se aplicaron cambios.'
      };
    }

    // 5. Preparar filas nuevas en memoria (escritura atómica por fila + respaldo para rollback)
    const newJobRow = oldRow.slice();
    newJobRow[jMap['fecha']] = finalFecha;
    newJobRow[jMap['campanaid']] = finalCampanaId;
    newJobRow[jMap['maquinaid']] = finalMaqId;
    if (jMap['implementoid'] !== undefined) newJobRow[jMap['implementoid']] = finalImplementoId;
    if (jMap['trabajotipoid'] !== undefined) newJobRow[jMap['trabajotipoid']] = finalImplementoId;
    if (jMap['trabajonombre'] !== undefined) newJobRow[jMap['trabajonombre']] = finalTrabajoNombre;
    newJobRow[jMap['destino']] = newDestino;
    newJobRow[jMap['loteid']] = finalLoteId;
    newJobRow[jMap['cliente']] = finalCliente;
    newJobRow[jMap['cantidad']] = finalCant;
    newJobRow[jMap['unidad']] = finalUnidad;
    newJobRow[jMap['preciounitario']] = finalPrecio;
    newJobRow[jMap['moneda']] = finalMoneda;
    newJobRow[jMap['tc']] = finalTc;
    newJobRow[jMap['importe']] = finalTotal;
    newJobRow[jMap['observacion']] = finalObs;
    newJobRow[jMap['actualizadoen']] = ahora;

    const trabajoDesc = finalTrabajoNombre ? (' - ' + finalTrabajoNombre) : '';
    const incomeDesc = newDestino === 'PROPIEDAD'
      ? ('Trabajo en propiedad' + trabajoDesc + ' (' + (finalLoteNombre || finalLoteId || 'Lote') + ')')
      : ('Servicio a tercero' + trabajoDesc + ' (' + (finalCliente || 'Externo') + ')');

    const incomeMatch = incomeMatches[0];
    const newIncomeRow = incomeMatch.data.slice();
    newIncomeRow[mMap['fecha']] = finalFecha;
    newIncomeRow[mMap['campanaid']] = finalCampanaId;
    newIncomeRow[mMap['maquinaid']] = finalMaqId;
    newIncomeRow[mMap['descripcion']] = incomeDesc;
    newIncomeRow[mMap['loteid']] = finalLoteId;
    newIncomeRow[mMap['cantidad']] = finalCant;
    newIncomeRow[mMap['unidad']] = finalUnidad;
    newIncomeRow[mMap['preciounitario']] = finalPrecio;
    newIncomeRow[mMap['importe']] = finalTotal;
    newIncomeRow[mMap['moneda']] = finalMoneda;
    newIncomeRow[mMap['tc']] = finalTc;
    newIncomeRow[mMap['actualizadoen']] = ahora;

    const expenseDesc = 'Servicio Maquinaria Propia' + trabajoDesc + ' (' + (j.maquinariaNombre || maquinaObj.nombre || finalMaqId) + ')';
    const existingExpense = expenseMatches.length === 1 ? expenseMatches[0] : null;
    let newExpenseRow = null;
    let appendedExpenseId = '';

    if (newDestino === 'PROPIEDAD') {
      if (existingExpense) {
        newExpenseRow = existingExpense.data.slice();
      } else {
        appendedExpenseId = Utilities.getUuid();
        newExpenseRow = Array(mRows[0].length).fill('');
        newExpenseRow[mMap['id']] = appendedExpenseId;
        newExpenseRow[mMap['modulo']] = 'PROPIEDAD';
        newExpenseRow[mMap['clase']] = 'GASTO';
        newExpenseRow[mMap['itemid']] = '';
        newExpenseRow[mMap['trabajoid']] = idTrim;
        newExpenseRow[mMap['creadopor']] = usuarioNombre;
        newExpenseRow[mMap['creadoen']] = ahora;
      }
      newExpenseRow[mMap['fecha']] = finalFecha;
      newExpenseRow[mMap['campanaid']] = finalCampanaId;
      newExpenseRow[mMap['maquinaid']] = finalMaqId;
      newExpenseRow[mMap['descripcion']] = expenseDesc;
      newExpenseRow[mMap['loteid']] = finalLoteId;
      newExpenseRow[mMap['cantidad']] = finalCant;
      newExpenseRow[mMap['unidad']] = finalUnidad;
      newExpenseRow[mMap['preciounitario']] = finalPrecio;
      newExpenseRow[mMap['importe']] = finalTotal;
      newExpenseRow[mMap['moneda']] = finalMoneda;
      newExpenseRow[mMap['tc']] = finalTc;
      newExpenseRow[mMap['actualizadoen']] = ahora;
    }

    // 6. Aplicar cambios con rollback ante cualquier error
    let jobWritten = false;
    let incomeWritten = false;
    let expenseUpdated = false;
    let expenseAppended = false;
    let expenseDeleted = false;

    try {
      jobsSheet.getRange(foundRowIdx, 1, 1, newJobRow.length).setValues([newJobRow]);
      jobWritten = true;

      movSheet.getRange(incomeMatch.rowIdx, 1, 1, newIncomeRow.length).setValues([newIncomeRow]);
      incomeWritten = true;

      if (newDestino === 'PROPIEDAD') {
        if (existingExpense) {
          movSheet.getRange(existingExpense.rowIdx, 1, 1, newExpenseRow.length).setValues([newExpenseRow]);
          expenseUpdated = true;
        } else {
          movSheet.appendRow(newExpenseRow);
          expenseAppended = true;
        }
      } else if (existingExpense) {
        movSheet.deleteRow(existingExpense.rowIdx);
        expenseDeleted = true;
      }

      SpreadsheetApp.flush();
    } catch (writeErr) {
      const rollbackErrors = [];
      try {
        if (expenseAppended && appendedExpenseId) deleteRowByColumn('Movimientos', 'id', appendedExpenseId);
      } catch (e) { rollbackErrors.push('eliminar gasto creado: ' + e.message); }
      try {
        if (expenseDeleted && existingExpense) movSheet.appendRow(existingExpense.data);
      } catch (e) { rollbackErrors.push('restaurar gasto eliminado: ' + e.message); }
      try {
        if (expenseUpdated && existingExpense) movSheet.getRange(existingExpense.rowIdx, 1, 1, existingExpense.data.length).setValues([existingExpense.data]);
      } catch (e) { rollbackErrors.push('restaurar gasto: ' + e.message); }
      try {
        if (incomeWritten) movSheet.getRange(incomeMatch.rowIdx, 1, 1, incomeMatch.data.length).setValues([incomeMatch.data]);
      } catch (e) { rollbackErrors.push('restaurar ingreso: ' + e.message); }
      try {
        if (jobWritten) jobsSheet.getRange(foundRowIdx, 1, 1, oldRow.length).setValues([oldRow]);
      } catch (e) { rollbackErrors.push('restaurar trabajo: ' + e.message); }
      SpreadsheetApp.flush();

      return {
        ok: false,
        error: 'Error al actualizar el trabajo y sus movimientos vinculados (' + writeErr.message + ').' +
          (rollbackErrors.length > 0 ? ' Errores de reversión: ' + rollbackErrors.join('; ') : ' Se revirtieron los cambios.')
      };
    }

    logAudit_(
      usuarioNombre,
      'UPDATE',
      'Trabajos',
      idTrim,
      'Trabajo actualizado (' + newDestino + ', ' + finalTotal + ' ' + finalMoneda + ', TC ' + finalTc + ') y movimientos sincronizados'
    );

    const cuentaActualizada = newDestino === 'TERCERO' ? cobrosEstado_2026(idTrim).result : null;

    return {
      ok: true,
      result: {
        id: idTrim,
        fecha: finalFecha,
        campanaId: finalCampanaId,
        maquinaId: finalMaqId,
        maquinariaId: finalMaqId,
        implementoId: finalImplementoId,
        trabajoTipoId: finalImplementoId,
        trabajoNombre: finalTrabajoNombre,
        destino: newDestino,
        tipoTrabajo: newDestino === 'PROPIEDAD' ? 'propiedad' : 'tercero',
        loteId: finalLoteId,
        cliente: finalCliente,
        cantidad: finalCant,
        unidad: finalUnidad,
        precioUnitario: finalPrecio,
        tarifa: finalPrecio,
        importe: finalTotal,
        total: finalTotal,
        moneda: finalMoneda,
        tc: finalTc,
        tipoCambio: finalTc,
        observacion: finalObs,
        actualizadoEn: ahora,
        cuenta: cuentaActualizada
      }
    };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
}

function handleDeleteMachineryJob(id, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000); // Lock de 15 segundos
  try {
    if (cobrosTienePagos_2026(id)) return {ok:false,error:'Este servicio tiene cobros registrados. No se puede eliminar sin conciliar sus pagos.'};
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

    const finalTc = resolverTipoCambioOperacion_2026(exp.tc ?? exp.tipoCambio);

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

    const finalTc = resolverTipoCambioOperacion_2026(inc.tc ?? inc.tipoCambio);

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
    const finalTc = resolverTipoCambioOperacion_2026(m.tc ?? m.tipoCambio, oldTc);

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
    return mod === 'PROPIEDAD' && cls === 'INGRESO' && (!isPropio || String(m.trabajoId || '').indexOf('COSECHA:') === 0);
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
// TIPO DE CAMBIO OFICIAL BCB Y AJUSTE MANUAL (HOJA CONFIGURACION)
// Claves base: TIPO_CAMBIO, FECHA_TIPO_CAMBIO, NOTA_TIPO_CAMBIO
// Claves BCB automáticas (se crean solas al usar setConfigValue):
//   TIPO_CAMBIO_MODO ('bcb' | 'manual')
//   TIPO_CAMBIO_FUENTE ('BCB (Oficial)' | 'Ajuste manual')
//   TIPO_CAMBIO_FECHA_COTIZACION (YYYY-MM-DD vigencia oficial BCB)
//   TIPO_CAMBIO_FECHA_CORTE (YYYY-MM-DD corte oficial BCB)
//   TIPO_CAMBIO_ULTIMA_CONSULTA (YYYY-MM-DD HH:mm America/La_Paz)
//   TIPO_CAMBIO_ULTIMA_CONSULTA_DIA (YYYY-MM-DD America/La_Paz)
//   TIPO_CAMBIO_ESTADO ('actualizado' | 'pendiente' | 'sin_conexion' | 'manual')
//   TIPO_CAMBIO_ERROR (mensaje discreto si falló última consulta)
// -------------------------------------------------------------

const BCB_TCO_URL_ = 'https://www.bcb.gob.bo/bcb_tco_publico_ultima_cotizacion.php';
const BOLIVIA_TZ_ = 'America/La_Paz';

function getBoliviaTodayStr_() {
  return Utilities.formatDate(new Date(), BOLIVIA_TZ_, 'yyyy-MM-dd');
}

function getBoliviaTimestampStr_() {
  return Utilities.formatDate(new Date(), BOLIVIA_TZ_, 'yyyy-MM-dd HH:mm');
}

function normalizeConfigDateStr_(val) {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return Utilities.formatDate(val, BOLIVIA_TZ_, 'yyyy-MM-dd');
  }
  const s = String(val).trim();
  const ymd = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (ymd) return ymd[1];
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    return dmy[3] + '-' + ('0' + dmy[2]).slice(-2) + '-' + ('0' + dmy[1]).slice(-2);
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, BOLIVIA_TZ_, 'yyyy-MM-dd');
  }
  return s;
}

function normalizeConfigTimestampStr_(val) {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return Utilities.formatDate(val, BOLIVIA_TZ_, 'yyyy-MM-dd HH:mm');
  }
  const s = String(val).trim();
  if (!s) return '';
  const ymdHm = s.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/);
  if (ymdHm) return ymdHm[1] + ' ' + ymdHm[2];
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, BOLIVIA_TZ_, 'yyyy-MM-dd HH:mm');
  }
  return s;
}

function parseSpanishBcbDate_(text) {
  if (!text) return '';
  const months = {
    enero: '01',
    febrero: '02',
    marzo: '03',
    abril: '04',
    mayo: '05',
    junio: '06',
    julio: '07',
    agosto: '08',
    septiembre: '09',
    setiembre: '09',
    octubre: '10',
    noviembre: '11',
    diciembre: '12'
  };
  const clean = String(text)
    .toLowerCase()
    .replace(/[áàä]/g, 'a')
    .replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u');
  const m = clean.match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
  if (!m) return '';
  const mo = months[m[2]];
  if (!mo) return '';
  return m[3] + '-' + mo + '-' + ('0' + m[1]).slice(-2);
}

function parseBcbTcoHtml_(html) {
  if (!html || typeof html !== 'string' || html.length < 100) {
    throw new Error('Respuesta vacía o incompleta del Banco Central de Bolivia.');
  }
  if (!/TIPO\s+DE\s+CAMBIO\s+OFICIAL/i.test(html)) {
    throw new Error('La respuesta del BCB no contiene el indicador de Tipo de Cambio Oficial.');
  }

  let tasa = NaN;
  let fechaCotizacion = '';
  let fechaCorte = '';

  const valMatch = html.match(/<div[^>]*class=["'][^"']*tco-public-value[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (valMatch && valMatch[1]) {
    const numMatch = valMatch[1].match(/(\d{1,3}(?:[.,]\d{1,4})?)/);
    if (numMatch) {
      tasa = parseFloat(numMatch[1].replace(',', '.'));
    }
  }

  const vigMatch = html.match(/<span[^>]*class=["'][^"']*tco-public-vigencia[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
  if (vigMatch && vigMatch[1]) {
    fechaCotizacion = parseSpanishBcbDate_(vigMatch[1]);
  }

  const corteMatch = html.match(/<span[^>]*class=["'][^"']*tco-public-date[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
  if (corteMatch && corteMatch[1]) {
    fechaCorte = parseSpanishBcbDate_(corteMatch[1]);
  }

  // Respaldo dentro del mismo HTML oficial (última fila de la tabla diaria TCO)
  if ((isNaN(tasa) || tasa <= 0 || !fechaCotizacion) && html.indexOf('tco-daily-table') !== -1) {
    const tablePart = html.split('tco-daily-table')[1] || '';
    const rowRegex = /<tr>\s*<td>([^<]+)<\/td>\s*<td>([^<]+)<\/td>\s*<\/tr>/gi;
    let lastRow = null;
    let match;
    while ((match = rowRegex.exec(tablePart)) !== null) {
      lastRow = match;
    }
    if (lastRow) {
      if (!fechaCotizacion) {
        fechaCotizacion = parseSpanishBcbDate_(lastRow[1]);
      }
      if (isNaN(tasa) || tasa <= 0) {
        const fallbackNum = String(lastRow[2] || '').trim().replace(',', '.');
        tasa = parseFloat(fallbackNum);
      }
    }
  }

  if (isNaN(tasa) || !isFinite(tasa) || tasa <= 1 || tasa >= 1000) {
    throw new Error('La cotización oficial recibida del BCB no tiene un valor numérico válido.');
  }
  if (!fechaCotizacion || !/^\d{4}-\d{2}-\d{2}$/.test(fechaCotizacion)) {
    throw new Error('No se pudo identificar la fecha de vigencia oficial del BCB.');
  }

  return {
    tasaBobPerUsd: tasa,
    fechaCotizacion: fechaCotizacion,
    fechaCorte: fechaCorte || '',
    fuenteDetalle: 'BCB (Oficial)'
  };
}

function fetchOfficialBcbRate_() {
  const response = UrlFetchApp.fetch(BCB_TCO_URL_, {
    method: 'get',
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MaquinariasYPropiedad/1.0)',
      'Accept': 'text/html,application/xhtml+xml'
    }
  });

  const status = response.getResponseCode();
  if (status !== 200) {
    throw new Error('El sitio oficial del BCB respondió con estado HTTP ' + status + '.');
  }

  const html = response.getContentText('UTF-8');
  return parseBcbTcoHtml_(html);
}

function buildExchangeRatePayload_(extra) {
  const rawTasa = getConfigValue('TIPO_CAMBIO', '');
  const tasaNum = parseFloat(String(rawTasa || '').replace(',', '.'));
  const todayBo = getBoliviaTodayStr_();

  const rawModo = String(getConfigValue('TIPO_CAMBIO_MODO', '') || '').trim().toLowerCase();
  const modo = rawModo === 'manual' ? 'manual' : 'bcb';

  const fechaAct = normalizeConfigDateStr_(getConfigValue('FECHA_TIPO_CAMBIO', ''));
  const fechaCot = normalizeConfigDateStr_(getConfigValue('TIPO_CAMBIO_FECHA_COTIZACION', ''));
  const fechaCorte = normalizeConfigDateStr_(getConfigValue('TIPO_CAMBIO_FECHA_CORTE', ''));
  const ultimaConsulta = normalizeConfigTimestampStr_(getConfigValue('TIPO_CAMBIO_ULTIMA_CONSULTA', ''));
  const ultimaConsultaDia = normalizeConfigDateStr_(getConfigValue('TIPO_CAMBIO_ULTIMA_CONSULTA_DIA', ''));
  const storedFuente = String(getConfigValue('TIPO_CAMBIO_FUENTE', '') || '').trim();
  const storedEstado = String(getConfigValue('TIPO_CAMBIO_ESTADO', '') || '').trim().toLowerCase();
  const storedError = String(getConfigValue('TIPO_CAMBIO_ERROR', '') || '').trim();
  const notaAct = String(getConfigValue('NOTA_TIPO_CAMBIO', '') || '').trim();

  const bcbConfirmado =
    modo === 'bcb' &&
    Boolean(ultimaConsulta || ultimaConsultaDia) &&
    storedFuente.toLowerCase().indexOf('bcb') !== -1;

  let fuenteDetalle = 'Valor guardado';
  if (modo === 'manual') {
    fuenteDetalle = 'Ajuste manual';
  } else if (bcbConfirmado) {
    fuenteDetalle = 'BCB (Oficial)';
  }

  let estado = 'pendiente';
  if (modo === 'manual') {
    estado = 'manual';
  } else if (bcbConfirmado && ultimaConsultaDia === todayBo && storedEstado !== 'sin_conexion' && storedEstado !== 'pendiente') {
    estado = 'actualizado';
  } else if (storedEstado === 'sin_conexion') {
    estado = 'sin_conexion';
  } else {
    estado = 'pendiente';
  }

  const base = {
    tasaBobPerUsd: !isNaN(tasaNum) && tasaNum > 0 ? tasaNum : 0,
    tasa: !isNaN(tasaNum) && tasaNum > 0 ? tasaNum : 0,
    tc: !isNaN(tasaNum) && tasaNum > 0 ? tasaNum : 0,
    fuente: modo,
    modo: modo,
    fuenteDetalle: fuenteDetalle,
    fechaActualizacion: fechaAct || fechaCot || todayBo,
    fechaCotizacion: fechaCot || (bcbConfirmado ? fechaAct : ''),
    fechaCorte: fechaCorte || '',
    ultimaConsulta: ultimaConsulta || '',
    ultimaConsultaDia: ultimaConsultaDia || '',
    estado: estado,
    errorMensaje: storedError || '',
    nota:
      notaAct ||
      (modo === 'manual'
        ? 'Ajuste manual vigente'
        : bcbConfirmado
        ? 'Cotización oficial del Banco Central de Bolivia'
        : '')
  };

  if (extra && typeof extra === 'object') {
    Object.keys(extra).forEach(function (k) {
      base[k] = extra[k];
    });
  }
  return base;
}

function handleGetExchangeRate() {
  const payload = buildExchangeRatePayload_(null);
  if (!payload.tasaBobPerUsd || payload.tasaBobPerUsd <= 0) {
    return {
      ok: false,
      error: 'Tipo de cambio no configurado en Google Sheets (hoja Configuracion, clave TIPO_CAMBIO). Ingrese a Administración -> Configuración -> Tipo de cambio para definirlo.'
    };
  }
  return { ok: true, result: payload };
}

function handleSyncExchangeRateAuto(userSession) {
  const todayBo = getBoliviaTodayStr_();
  const cache = CacheService.getScriptCache();

  // Lectura rápida antes de lock para no bloquear inicios concurrentes
  const current = buildExchangeRatePayload_(null);
  if (current.fuente === 'manual') {
    return { ok: true, result: current };
  }
  if (current.ultimaConsultaDia === todayBo && current.tasaBobPerUsd > 0) {
    return { ok: true, result: current };
  }
  if (cache.get('FX_BCB_ERR_COOLDOWN_' + todayBo)) {
    return {
      ok: true,
      result: buildExchangeRatePayload_({ estado: 'pendiente', syncSkippedCooldown: true })
    };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) {
    return { ok: true, result: current };
  }

  try {
    // Doble verificación dentro del lock para evitar consultas duplicadas
    const inside = buildExchangeRatePayload_(null);
    if (inside.fuente === 'manual') {
      return { ok: true, result: inside };
    }
    if (inside.ultimaConsultaDia === todayBo && inside.tasaBobPerUsd > 0) {
      return { ok: true, result: inside };
    }

    const nowTs = getBoliviaTimestampStr_();
    try {
      const bcb = fetchOfficialBcbRate_();
      const rateChanged = Math.abs((inside.tasaBobPerUsd || 0) - bcb.tasaBobPerUsd) > 0.00001;
      const dateChanged = inside.fechaCotizacion !== bcb.fechaCotizacion;
      const rawModo = String(getConfigValue('TIPO_CAMBIO_MODO', '') || '').trim().toLowerCase();
      const modeUninitialized = rawModo !== 'bcb';

      if (rateChanged || dateChanged || modeUninitialized) {
        setConfigValue('TIPO_CAMBIO', bcb.tasaBobPerUsd);
        setConfigValue('FECHA_TIPO_CAMBIO', bcb.fechaCotizacion);
        setConfigValue('TIPO_CAMBIO_MODO', 'bcb');
        setConfigValue('TIPO_CAMBIO_FUENTE', 'BCB (Oficial)');
        setConfigValue('TIPO_CAMBIO_FECHA_COTIZACION', bcb.fechaCotizacion);
        if (bcb.fechaCorte) {
          setConfigValue('TIPO_CAMBIO_FECHA_CORTE', bcb.fechaCorte);
        }
        setConfigValue('NOTA_TIPO_CAMBIO', 'Tipo de Cambio Oficial BCB (vigencia ' + bcb.fechaCotizacion + ')');
        logAudit_(
          userSession && userSession.usuarioId ? userSession.usuarioId : 'sistema',
          'SYNC_FX_BCB_AUTO',
          'Configuracion',
          'TIPO_CAMBIO',
          'TC oficial BCB actualizado automáticamente a ' + bcb.tasaBobPerUsd + ' (vigencia ' + bcb.fechaCotizacion + ')'
        );
      }

      setConfigValue('TIPO_CAMBIO_ULTIMA_CONSULTA', nowTs);
      setConfigValue('TIPO_CAMBIO_ULTIMA_CONSULTA_DIA', todayBo);
      setConfigValue('TIPO_CAMBIO_ESTADO', 'actualizado');
      setConfigValue('TIPO_CAMBIO_ERROR', '');
      cache.remove('FX_BCB_ERR_COOLDOWN_' + todayBo);

      return {
        ok: true,
        result: buildExchangeRatePayload_({
          updated: rateChanged || dateChanged || modeUninitialized,
          alreadyLatest: !(rateChanged || dateChanged || modeUninitialized)
        })
      };
    } catch (fetchErr) {
      // Nunca sobrescribir el último TC válido si falla el BCB
      const errMsg = fetchErr && fetchErr.message ? fetchErr.message : 'No se pudo consultar el BCB.';
      setConfigValue('TIPO_CAMBIO_ESTADO', 'pendiente');
      setConfigValue('TIPO_CAMBIO_ERROR', errMsg);
      cache.put('FX_BCB_ERR_COOLDOWN_' + todayBo, '1', 600);

      return {
        ok: true,
        result: buildExchangeRatePayload_({
          estado: 'pendiente',
          syncFailed: true,
          errorMensaje: errMsg
        })
      };
    }
  } finally {
    lock.releaseLock();
  }
}

function handleRefreshExchangeRateBcb(payload, userSession) {
  const switchToOfficial = Boolean(payload && payload.switchToOfficial);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const todayBo = getBoliviaTodayStr_();
    const nowTs = getBoliviaTimestampStr_();
    const current = buildExchangeRatePayload_(null);

    let bcb;
    try {
      bcb = fetchOfficialBcbRate_();
    } catch (fetchErr) {
      const errMsg = fetchErr && fetchErr.message ? fetchErr.message : 'No se pudo consultar el BCB.';
      if (current.fuente !== 'manual') {
        setConfigValue('TIPO_CAMBIO_ESTADO', 'pendiente');
        setConfigValue('TIPO_CAMBIO_ERROR', errMsg);
      }
      return {
        ok: false,
        error: 'No se pudo obtener la cotización oficial del BCB: ' + errMsg,
        result: buildExchangeRatePayload_({ estado: current.fuente === 'manual' ? 'manual' : 'pendiente', errorMensaje: errMsg })
      };
    }

    // No sobrescribir silenciosamente un ajuste manual salvo solicitud explícita de volver al TC oficial
    if (current.fuente === 'manual' && !switchToOfficial) {
      setConfigValue('TIPO_CAMBIO_ULTIMA_CONSULTA', nowTs);
      return {
        ok: true,
        result: buildExchangeRatePayload_({
          updated: false,
          manualPreserved: true,
          bcbPreviewRate: bcb.tasaBobPerUsd,
          bcbPreviewFecha: bcb.fechaCotizacion
        })
      };
    }

    const rateChanged = Math.abs((current.tasaBobPerUsd || 0) - bcb.tasaBobPerUsd) > 0.00001;
    const dateChanged = current.fechaCotizacion !== bcb.fechaCotizacion;
    const modeChanged = current.fuente !== 'bcb';

    if (rateChanged || dateChanged || modeChanged) {
      setConfigValue('TIPO_CAMBIO', bcb.tasaBobPerUsd);
      setConfigValue('FECHA_TIPO_CAMBIO', bcb.fechaCotizacion);
      setConfigValue('TIPO_CAMBIO_MODO', 'bcb');
      setConfigValue('TIPO_CAMBIO_FUENTE', 'BCB (Oficial)');
      setConfigValue('TIPO_CAMBIO_FECHA_COTIZACION', bcb.fechaCotizacion);
      if (bcb.fechaCorte) {
        setConfigValue('TIPO_CAMBIO_FECHA_CORTE', bcb.fechaCorte);
      }
      setConfigValue('NOTA_TIPO_CAMBIO', 'Tipo de Cambio Oficial BCB (vigencia ' + bcb.fechaCotizacion + ')');
      logAudit_(
        userSession && userSession.usuarioId ? userSession.usuarioId : 'admin',
        switchToOfficial ? 'RESTORE_FX_BCB' : 'SYNC_FX_BCB',
        'Configuracion',
        'TIPO_CAMBIO',
        'TC oficial BCB establecido en ' + bcb.tasaBobPerUsd + ' (vigencia ' + bcb.fechaCotizacion + ')'
      );
    }

    setConfigValue('TIPO_CAMBIO_ULTIMA_CONSULTA', nowTs);
    setConfigValue('TIPO_CAMBIO_ULTIMA_CONSULTA_DIA', todayBo);
    setConfigValue('TIPO_CAMBIO_ESTADO', 'actualizado');
    setConfigValue('TIPO_CAMBIO_ERROR', '');
    CacheService.getScriptCache().remove('FX_BCB_ERR_COOLDOWN_' + todayBo);

    return {
      ok: true,
      result: buildExchangeRatePayload_({
        updated: rateChanged || dateChanged || modeChanged,
        alreadyLatest: !(rateChanged || dateChanged || modeChanged)
      })
    };
  } finally {
    lock.releaseLock();
  }
}

function handleSaveExchangeRate(cfg, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const tasaNum = parseFloat(String(cfg.tasaBobPerUsd || cfg.tasa || cfg.tc || '').replace(',', '.'));
    if (isNaN(tasaNum) || !isFinite(tasaNum) || tasaNum <= 0) {
      return { ok: false, error: 'El tipo de cambio debe ser un número válido mayor a 0.' };
    }

    const todayBo = getBoliviaTodayStr_();
    const fechaStr = normalizeConfigDateStr_(cfg.fecha || cfg.fechaActualizacion || todayBo) || todayBo;
    const notaStr = String(cfg.nota || '').trim() || 'Ajuste manual registrado por el administrador';

    setConfigValue('TIPO_CAMBIO', tasaNum);
    setConfigValue('FECHA_TIPO_CAMBIO', fechaStr);
    setConfigValue('NOTA_TIPO_CAMBIO', notaStr);
    setConfigValue('TIPO_CAMBIO_MODO', 'manual');
    setConfigValue('TIPO_CAMBIO_FUENTE', 'Ajuste manual');
    setConfigValue('TIPO_CAMBIO_ESTADO', 'manual');
    setConfigValue('TIPO_CAMBIO_ERROR', '');

    logAudit_(
      userSession && userSession.usuarioId ? userSession.usuarioId : 'admin',
      'SET_FX_MANUAL',
      'Configuracion',
      'TIPO_CAMBIO',
      'Ajuste manual de tipo de cambio establecido en ' + tasaNum + ' (' + notaStr + ')'
    );

    return {
      ok: true,
      result: buildExchangeRatePayload_(null)
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

function autorizarConsultaBCB() {
  UrlFetchApp.fetch('https://www.bcb.gob.bo/');
}
// =============================================================
// ETAPA 2 (2026): TIPOS, IMPLEMENTOS Y SERVICIOS
// Requiere migraciones previas completadas.
// =============================================================
function handleMachineTypeList_2026() {
  return {ok:true,result:getSheetDataAsObjects('TiposMaquina')};
}
function resolverTipoMaquina_2026(m) {
  const tipos=getSheetDataAsObjects('TiposMaquina');
  const id=String(m.tipoMaquinaId||'').trim();
  const nombre=String(m.tipo||'').trim();
  const found=id ? tipos.find(t=>String(t.id)===id) :
    tipos.find(t=>String(t.nombre||'').trim().toLowerCase()===nombre.toLowerCase());
  if (!found) throw new Error('Seleccione un tipo de máquina existente en Administración.');
  return {id:String(found.id),nombre:String(found.nombre)};
}
function resolverTipoImplemento_2026(j) {
  const tipos=getSheetDataAsObjects('TiposMaquina');
  let id=String(j.tipoMaquinaId||'').trim();
  if (!id && j.id) {
    const anterior=getSheetDataAsObjects('TrabajosMaquinaria').find(x=>String(x.id)===String(j.id));
    if (anterior) id=String(anterior.tipoMaquinaId||'');
  }
  if (!id && (j.maquinaId||j.maquinariaId)) {
    const maquina=getSheetDataAsObjects('Maquinas').find(m=>String(m.id)===String(j.maquinaId||j.maquinariaId));
    id=maquina ? String(maquina.tipoMaquinaId||'') : '';
  }
  if (!tipos.some(t=>String(t.id)===id)) throw new Error('Seleccione un tipo de máquina válido para el implemento.');
  return id;
}
function validarImplementoServicio_2026(maquinaId,j) {
  const id=String(j.implementoId||j.trabajoTipoId||'').trim();
  if (!id) return '';
  const maquina=getSheetDataAsObjects('Maquinas').find(m=>String(m.id)===String(maquinaId));
  if (!maquina) throw new Error('Máquina seleccionada no encontrada.');
  const imp=getSheetDataAsObjects('TrabajosMaquinaria').find(x=>String(x.id)===id);
  if (!imp || String(imp.nombre||'').trim().toLowerCase()==='tractor solo') throw new Error('Implemento no válido.');
  if (String(imp.tipoMaquinaId||'')!==String(maquina.tipoMaquinaId||'')) throw new Error('El implemento no es compatible con el tipo de máquina.');
  return id;
}
function handleMachineTypeSave_2026(p,session) {
  const x=p.machineType||p.tipoMaquina||p;
  const nombre=String(x.nombre||'').trim();
  if (!nombre) throw new Error('Indique nombre del tipo de máquina.');
  const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh=findSheetIgnoreCase_('TiposMaquina');
    if (!sh) throw new Error('Falta hoja TiposMaquina. Ejecute primero la migración.');
    const data=sh.getDataRange().getValues(), h=getHeaderIndexMap_(data[0]);
    const id=String(x.id||'').trim();
    if (data.slice(1).some(r=>String(r[h['nombre']]).trim().toLowerCase()===nombre.toLowerCase() && String(r[h['id']])!==id))
      throw new Error('Ya existe un tipo con ese nombre.');
    if (id) {
      const pos=data.findIndex((r,i)=>i>0&&String(r[h['id']])===id);
      if(pos<0) throw new Error('Tipo no encontrado.');
      sh.getRange(pos+1,h['nombre']+1).setValue(nombre);
      if(x.activo!==undefined) sh.getRange(pos+1,h['activo']+1).setValue(x.activo!==false);
      logAudit_(session.usuarioId,'UPDATE','TiposMaquina',id,nombre);
      return {ok:true,result:{id,nombre}};
    }
    const newId=Utilities.getUuid(), row=Array(data[0].length).fill('');
    row[h['id']]=newId; row[h['nombre']]=nombre; row[h['activo']]=true; row[h['creadoen']]=new Date().toISOString();
    sh.appendRow(row); logAudit_(session.usuarioId,'CREATE','TiposMaquina',newId,nombre);
    return {ok:true,result:{id:newId,nombre,activo:true}};
  } finally {lock.releaseLock();}
}
function handleMachineTypeDelete_2026(id,session) {
  const target=String(id||'');
  if(getSheetDataAsObjects('Maquinas').some(m=>String(m.tipoMaquinaId)===target) ||
     getSheetDataAsObjects('TrabajosMaquinaria').some(m=>String(m.tipoMaquinaId)===target))
    return {ok:false,error:'Tipo en uso. Desactívelo en lugar de eliminarlo.'};
  const sh=findSheetIgnoreCase_('TiposMaquina');
  if(!sh) throw new Error('Falta hoja TiposMaquina.');
  const rows=sh.getDataRange().getValues(), h=getHeaderIndexMap_(rows[0]);
  const idx=rows.findIndex((r,i)=>i>0&&String(r[h['id']])===target);
  if(idx<0) return {ok:false,error:'Tipo no encontrado.'};
  sh.deleteRow(idx+1);logAudit_(session.usuarioId,'DELETE','TiposMaquina',target,'Tipo eliminado');
  return {ok:true};
}


// ============================================================
// COBROS DE SERVICIOS EXTERNOS - no crean ingresos adicionales
// ============================================================
function redondear2_2026(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function asegurarColumnasOpcionales_2026(sheet, extraCols) {
  const headers = getSheetHeaders_(sheet);
  const map = getHeaderIndexMap_(headers);
  let nextCol = headers.length;
  let added = false;
  for (let i = 0; i < extraCols.length; i++) {
    const colName = extraCols[i];
    if (map[colName.toLowerCase()] === undefined) {
      nextCol++;
      sheet.getRange(1, nextCol).setValue(colName);
      added = true;
    }
  }
  if (added) SpreadsheetApp.flush();
  return getHeaderIndexMap_(getSheetHeaders_(sheet));
}

function resolverTipoCambioOperacion_2026(rawVal, fallbackTc) {
  const tieneValor = rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '';
  if (tieneValor) {
    const parsed = Number(String(rawVal).trim().replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error('El tipo de cambio debe ser un número válido mayor a cero.');
    }
    return Math.round(parsed * 10000) / 10000;
  }
  const fb = Number(fallbackTc);
  if (Number.isFinite(fb) && fb > 0) {
    return Math.round(fb * 10000) / 10000;
  }
  const stored = Number(String(getConfigValue('TIPO_CAMBIO', '') || '').replace(',', '.'));
  if (!Number.isFinite(stored) || stored <= 0) {
    throw new Error('Tipo de cambio no configurado en Google Sheets. Configure el tipo de cambio en Administración -> Tipo de cambio.');
  }
  return Math.round(stored * 10000) / 10000;
}

function normalizarMonedaCobro_2026(raw) {
  const s = String(raw === undefined || raw === null || String(raw).trim() === '' ? 'USD' : raw).trim().toUpperCase();
  if (s === 'USD' || s === 'US$' || s === '$US' || s === 'U$D') return 'USD';
  if (s === 'BOB' || s === 'BS' || s === 'BS.' || s === 'BOLIVIANOS') return 'BOB';
  throw new Error('Moneda de cobro inválida. Use USD o Bs (BOB).');
}

function validarFechaIso_2026(rawVal, fallbackFecha) {
  const tieneValor = rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '';
  const candidate = tieneValor ? String(rawVal).trim() : normalizeConfigDateStr_(fallbackFecha || getBoliviaTodayStr_());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    throw new Error('Fecha inválida. Utilice el formato YYYY-MM-DD.');
  }
  return candidate;
}

const COBROS_CAMPOS_2026 = ['id', 'trabajoId', 'fecha', 'importe', 'moneda', 'observacion', 'creadoPor', 'creadoEn'];
const COBROS_CAMPOS_EXTRA_2026 = ['importeOriginal', 'monedaCobro', 'tc', 'importeUsd'];

function cobrosPrepararHoja_2026() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = findSheetIgnoreCase_('Cobros');
  if (!sh) {
    const allCols = COBROS_CAMPOS_2026.concat(COBROS_CAMPOS_EXTRA_2026);
    sh = ss.insertSheet('Cobros');
    sh.getRange(1, 1, 1, allCols.length).setValues([allCols]);
    sh.setFrozenRows(1);
  }
  validateRequiredColumns_('Cobros', getSheetHeaders_(sh), COBROS_CAMPOS_2026);
  asegurarColumnasOpcionales_2026(sh, COBROS_CAMPOS_EXTRA_2026);
  return sh;
}

function cobrosFilas_2026() {
  const sh = findSheetIgnoreCase_('Cobros');
  if (!sh) return [];
  const rows = sh.getDataRange().getValues();
  if (rows.length < 2) return [];
  const cols = getHeaderIndexMap_(rows[0]);
  return rows
    .slice(1)
    .filter(r => r[cols.id])
    .map(r => Object.fromEntries(Object.keys(cols).map(k => [k, r[cols[k]]])));
}

function cobrosMapTrabajoDesdeFila_2026(row, cols) {
  const monedaServicio = String(row[cols.moneda] || 'BOB').toUpperCase() === 'USD' ? 'USD' : 'BOB';
  return {
    id: String(row[cols.id] || ''),
    destino: String(row[cols.destino] || '').toUpperCase(),
    cliente: String(row[cols.cliente] || ''),
    maquinaId: cols.maquinaid !== undefined ? String(row[cols.maquinaid] || '') : '',
    implementoId: cols.implementoid !== undefined ? String(row[cols.implementoid] || '') : '',
    cantidad: cols.cantidad !== undefined ? Number(row[cols.cantidad]) || 0 : 0,
    unidad: cols.unidad !== undefined ? String(row[cols.unidad] || '') : '',
    precioUnitario: cols.preciounitario !== undefined ? Number(row[cols.preciounitario]) || 0 : 0,
    importeOriginalServicio: Number(row[cols.importe]) || 0,
    monedaOriginalServicio: monedaServicio,
    tcServicio: cols.tc !== undefined ? Number(row[cols.tc]) || 0 : 0,
    campanaId: String(row[cols.campanaid] || ''),
    fecha: normalizeConfigDateStr_(row[cols.fecha]) || String(row[cols.fecha] || ''),
    observacion: cols.observacion !== undefined ? String(row[cols.observacion] || '') : ''
  };
}

function cobrosTrabajo_2026(id) {
  const sh = findSheetIgnoreCase_('Trabajos');
  if (!sh) throw new Error('Falta hoja Trabajos');
  const rows = sh.getDataRange().getValues();
  const cols = getHeaderIndexMap_(rows[0]);
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][cols.id]) === String(id)) {
      return cobrosMapTrabajoDesdeFila_2026(rows[i], cols);
    }
  }
  throw new Error('Servicio no encontrado: ' + id);
}

function cobrosTienePagos_2026(id) {
  return cobrosFilas_2026().some(r => String(r.trabajoid) === String(id));
}

function cobrosNormalizarPago_2026(r, tcReferencia) {
  const monRaw = r.monedacobro !== undefined && String(r.monedacobro).trim() !== ''
    ? r.monedacobro
    : (r.moneda || 'USD');
  const monedaCobro = String(monRaw).trim().toUpperCase() === 'USD' ? 'USD' : 'BOB';

  const hasOriginal = r.importeoriginal !== undefined && r.importeoriginal !== '' && r.importeoriginal !== null;
  const importeOriginal = hasOriginal ? (Number(r.importeoriginal) || 0) : (Number(r.importe) || 0);

  const tcPago = Number(r.tc) || 0;
  const hasUsd = r.importeusd !== undefined && r.importeusd !== '' && r.importeusd !== null;
  let importeUsd;

  if (hasUsd) {
    importeUsd = redondear2_2026(Number(r.importeusd) || 0);
  } else if (monedaCobro === 'USD') {
    importeUsd = redondear2_2026(importeOriginal);
  } else {
    const effTc = tcPago > 0 ? tcPago : 0; // Nunca aplicar el TC actual a un pago histórico
    if (!effTc || effTc <= 0) {
      throw new Error('No hay tipo de cambio disponible para convertir un cobro histórico en Bs a USD.');
    }
    importeUsd = redondear2_2026(importeOriginal / effTc);
  }

  return {
    id: String(r.id || ''),
    trabajoId: String(r.trabajoid || ''),
    fecha: normalizeConfigDateStr_(r.fecha) || String(r.fecha || ''),
    importe: importeUsd, // Equivalente en USD aplicado a la cuenta (compatibilidad con lectores existentes)
    moneda: 'USD',
    importeOriginal: redondear2_2026(importeOriginal),
    monedaCobro: monedaCobro,
    tc: tcPago > 0 ? tcPago : (monedaCobro === 'BOB' ? tcReferencia : 0),
    importeUsd: importeUsd,
    observacion: String(r.observacion || ''),
    creadoPor: String(r.creadopor || ''),
    creadoEn: r.creadoen ? String(r.creadoen) : ''
  };
}

function cobrosCalcularCuenta_2026(t, pagosRaw, defaultTc) {
  const tcServicioEff = t.tcServicio > 0 ? t.tcServicio : defaultTc;
  let importeCuentaUsd;
  if (t.monedaOriginalServicio === 'USD') {
    importeCuentaUsd = redondear2_2026(t.importeOriginalServicio);
  } else {
    if (!tcServicioEff || tcServicioEff <= 0) {
      throw new Error('Configure un tipo de cambio válido para calcular cuentas por cobrar en USD.');
    }
    importeCuentaUsd = redondear2_2026(t.importeOriginalServicio / tcServicioEff);
  }

  const pagos = pagosRaw.map(r => cobrosNormalizarPago_2026(r, tcServicioEff));
  const cobrado = redondear2_2026(pagos.reduce((a, p) => a + Number(p.importeUsd || 0), 0));
  const saldo = Math.max(0, redondear2_2026(importeCuentaUsd - cobrado));
  const estado = saldo === 0 ? 'PAGADO' : (cobrado > 0 ? 'PARCIAL' : 'PENDIENTE');

  return {
    id: t.id,
    destino: t.destino,
    cliente: t.cliente,
    maquinaId: t.maquinaId,
    implementoId: t.implementoId,
    cantidad: t.cantidad,
    unidad: t.unidad,
    precioUnitario: t.precioUnitario,
    importe: importeCuentaUsd,
    moneda: 'USD',
    importeOriginalServicio: t.importeOriginalServicio,
    monedaOriginalServicio: t.monedaOriginalServicio,
    tcServicio: tcServicioEff,
    campanaId: t.campanaId,
    fecha: t.fecha,
    observacion: t.observacion,
    cobrado: cobrado,
    saldo: saldo,
    estado: estado,
    pagos: pagos
  };
}

function cobrosEstado_2026(id) {
  if (!id) return { ok: false, error: 'Falta trabajoId' };
  try {
    const t = cobrosTrabajo_2026(id);
    if (t.destino !== 'TERCERO') {
      return { ok: false, error: 'Los trabajos propios no generan cuentas por cobrar' };
    }
    const defaultTc = Number(String(getConfigValue('TIPO_CAMBIO', 0) || '').replace(',', '.')) || 0;
    const pagosRaw = cobrosFilas_2026().filter(r => String(r.trabajoid) === String(id));
    return { ok: true, result: cobrosCalcularCuenta_2026(t, pagosRaw, defaultTc) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function cobrosListar_2026(p) {
  try {
    const sh = findSheetIgnoreCase_('Trabajos');
    if (!sh) return { ok: false, error: 'Falta hoja Trabajos' };
    const rows = sh.getDataRange().getValues();
    if (rows.length < 2) return { ok: true, result: [], cobros: [] };

    const c = getHeaderIndexMap_(rows[0]);
    const defaultTc = Number(String(getConfigValue('TIPO_CAMBIO', 0) || '').replace(',', '.')) || 0;

    // Leer hoja Cobros una sola vez y agrupar por trabajoId
    const pagosPorTrabajo = {};
    const todosPagos = cobrosFilas_2026();
    for (let j = 0; j < todosPagos.length; j++) {
      const tid = String(todosPagos[j].trabajoid || '');
      if (!tid) continue;
      if (!pagosPorTrabajo[tid]) pagosPorTrabajo[tid] = [];
      pagosPorTrabajo[tid].push(todosPagos[j]);
    }

    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (String(r[c.destino] || '').toUpperCase() !== 'TERCERO') continue;
      const id = String(r[c.id] || '');
      if (!id) continue;
      if (p && p.campanaId && String(r[c.campanaid]) !== String(p.campanaId)) continue;

      const t = cobrosMapTrabajoDesdeFila_2026(r, c);
      const cuenta = cobrosCalcularCuenta_2026(t, pagosPorTrabajo[id] || [], defaultTc);
      if (p && p.soloPendientes && cuenta.saldo === 0) continue;
      out.push(cuenta);
    }
    return { ok: true, result: out, cobros: out };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function cobrosAnexar_2026(p) {
  const sh = cobrosPrepararHoja_2026();
  const cols = getHeaderIndexMap_(getSheetHeaders_(sh));

  const monedaCobro = normalizarMonedaCobro_2026(p.monedaCobro || p.moneda || 'USD');
  const importeOriginal = redondear2_2026(Number(p.importeOriginal ?? p.importe));
  const tcAplicado = Number(p.tc) > 0 ? Number(p.tc) : 0;
  const importeUsd = redondear2_2026(
    p.importeUsd !== undefined
      ? Number(p.importeUsd)
      : (monedaCobro === 'USD' ? importeOriginal : importeOriginal / tcAplicado)
  );

  const data = {
    id: Utilities.getUuid(),
    trabajoId: String(p.trabajoId),
    fecha: validarFechaIso_2026(p.fecha, getBoliviaTodayStr_()),
    importe: importeUsd, // Siempre USD para mantener compatibilidad histórica en columna 'importe'
    moneda: 'USD',
    observacion: String(p.observacion || '').trim(),
    creadoPor: String(p.creadoPor || 'operador'),
    creadoEn: new Date().toISOString(),
    importeOriginal: importeOriginal,
    monedaCobro: monedaCobro,
    tc: tcAplicado,
    importeUsd: importeUsd
  };

  const row = Array(sh.getLastColumn()).fill('');
  Object.keys(data).forEach(k => {
    const idx = cols[k.toLowerCase()];
    if (idx !== undefined) row[idx] = data[k];
  });

  sh.appendRow(row);
  SpreadsheetApp.flush();
  return data;
}

function cobrosRegistrar_2026(p, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const id = String(p.trabajoId || p.id || '').trim();
    if (!id) throw new Error('Falta trabajoId.');

    const estadoActual = cobrosEstado_2026(id);
    if (!estadoActual.ok) return estadoActual;
    const cuenta = estadoActual.result;

    if (cuenta.saldo <= 0) {
      throw new Error('Esta cuenta ya se encuentra pagada en su totalidad.');
    }

    const monedaCobro = normalizarMonedaCobro_2026(p.monedaCobro || p.moneda || 'USD');
    const montoOriginalRaw = Number(String(p.importeOriginal ?? p.importe ?? '').trim().replace(',', '.'));
    if (!Number.isFinite(montoOriginalRaw) || montoOriginalRaw <= 0) {
      throw new Error('El importe del cobro debe ser un número mayor a cero.');
    }
    const importeOriginal = redondear2_2026(montoOriginalRaw);
    if (Math.abs(montoOriginalRaw - importeOriginal) > 0.0001) {
      throw new Error('El importe del cobro debe tener como máximo dos decimales.');
    }

    // Tipo de cambio histórico de la operación (obligatorio si cobra en Bs; opcional/registrado si cobra en USD)
    const tcAplicado = resolverTipoCambioOperacion_2026(p.tc ?? p.tipoCambio);

    const importeUsd = monedaCobro === 'USD'
      ? importeOriginal
      : redondear2_2026(importeOriginal / tcAplicado);

    if (!Number.isFinite(importeUsd) || importeUsd <= 0) {
      throw new Error('El equivalente en USD del cobro debe ser mayor a cero.');
    }

    if (Math.round(importeUsd * 100) > Math.round(cuenta.saldo * 100)) {
      throw new Error(
        'El cobro (USD ' + importeUsd.toFixed(2) + ') supera el saldo pendiente (USD ' + cuenta.saldo.toFixed(2) + ').'
      );
    }

    const fechaCobro = validarFechaIso_2026(p.fecha, getBoliviaTodayStr_());
    const obsCobro = String(p.observacion || '').trim();

    // Protección contra envíos duplicados inmediatos (doble clic / reintento de red)
    const nowMs = Date.now();
    const duplicadoReciente = cuenta.pagos.some(pg => {
      if (!pg.creadoEn) return false;
      const diffMs = nowMs - new Date(pg.creadoEn).getTime();
      return (
        diffMs >= 0 &&
        diffMs < 30000 &&
        pg.fecha === fechaCobro &&
        pg.monedaCobro === monedaCobro &&
        Math.round(pg.importeOriginal * 100) === Math.round(importeOriginal * 100) &&
        String(pg.observacion || '').trim() === obsCobro
      );
    });
    if (duplicadoReciente && p.permitirDuplicado !== true) {
      throw new Error('Se detectó un cobro idéntico registrado hace unos segundos. Verifique el historial para evitar pagos duplicados.');
    }

    const usuarioNombre = (userSession && userSession.usuarioId) || 'operador';
    const pago = cobrosAnexar_2026({
      trabajoId: id,
      fecha: fechaCobro,
      importe: importeUsd,
      importeOriginal: importeOriginal,
      monedaCobro: monedaCobro,
      tc: tcAplicado,
      importeUsd: importeUsd,
      observacion: obsCobro,
      creadoPor: usuarioNombre
    });

    logAudit_(
      usuarioNombre,
      'COBRO_REGISTRAR',
      'Cobros',
      pago.id,
      'Trabajo ' + id + ' | ' + monedaCobro + ' ' + importeOriginal.toFixed(2) + ' (TC ' + tcAplicado + ' -> USD ' + importeUsd.toFixed(2) + ')'
    );

    return { ok: true, result: { pago: pago, cuenta: cobrosEstado_2026(id).result } };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
}

function probarCobros_2026() {
  console.log(JSON.stringify(cobrosListar_2026({ soloPendientes: true })));
}

// =============================================================
// COSECHAS Y ASIGNACIONES DE PRECIO (2026)
// Cantidades en toneladas. Ingresos se reconocen al asignar precio.
// =============================================================
const COSECHA_CAMPOS_2026=['id','fecha','campanaId','loteId','producto','toneladas','observacion','creadoPor','creadoEn'];
const PRECIO_CAMPOS_2026=['id','cosechaId','fecha','campanaId','toneladas','precioUsdTon','importeUsd','tc','movimientoId','creadoPor','creadoEn'];
function cosechasHoja_2026(nombre, campos) {
  let sh=findSheetIgnoreCase_(nombre);
  if(!sh){sh=SpreadsheetApp.getActiveSpreadsheet().insertSheet(nombre);sh.getRange(1,1,1,campos.length).setValues([campos]);sh.setFrozenRows(1);}
  validateRequiredColumns_(nombre,getSheetHeaders_(sh),campos);
  return sh;
}
function cosechasFila_2026(sh,obj){
  const m=getHeaderIndexMap_(getSheetHeaders_(sh));const r=Array(sh.getLastColumn()).fill('');
  Object.keys(obj).forEach(k=>{if(m[k.toLowerCase()]!==undefined)r[m[k.toLowerCase()]]=obj[k];});
  sh.appendRow(r);
}
function cosechasNumero_2026(v,nombre){
  const n=Number(String(v===undefined?'':v).replace(',','.'));
  if(!Number.isFinite(n)||n<=0)throw new Error(nombre+' debe ser mayor a cero.');
  return n;
}
function cosechasResumen_2026(){
  const cs=getSheetDataAsObjects('Cosechas');const as=getSheetDataAsObjects('AsignacionesPrecio');
  return cs.map(c=>{
    const asignaciones=as.filter(a=>String(a.cosechaId)===String(c.id));
    const toneladas=Number(c.toneladas)||0;
    const asignadas=asignaciones.reduce((v,a)=>v+Number(a.toneladas||0),0);
    const pendiente=Math.max(0,Math.round((toneladas-asignadas)*1000000)/1000000);
    return {...c,toneladas,asignadas,pendiente,asignaciones};
  });
}
function cosechasListar_2026(p){
  let r=cosechasResumen_2026();
  if(p&&p.campanaId)r=r.filter(c=>String(c.campanaId)===String(p.campanaId));
  if(p&&p.soloPendientes)r=r.filter(c=>c.pendiente>0);
  return {ok:true,result:r,cosechas:r};
}
function cosechasCrear_2026(p,userSession){
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    const lotes=getSheetDataAsObjects('Lotes');
    const campanas=getSheetDataAsObjects('Campanas');
    if(!lotes.some(l=>String(l.id)===String(p.loteId)))throw new Error('Seleccione un lote válido.');
    if(!campanas.some(c=>String(c.id)===String(p.campanaId)))throw new Error('Seleccione una campaña válida.');
    const sh=cosechasHoja_2026('Cosechas',COSECHA_CAMPOS_2026);
    const x={id:Utilities.getUuid(),fecha:String(p.fecha||new Date().toISOString().slice(0,10)),campanaId:String(p.campanaId),loteId:String(p.loteId),producto:String(p.producto||'Cosecha').trim(),toneladas:cosechasNumero_2026(p.toneladas,'Toneladas'),observacion:String(p.observacion||''),creadoPor:String(userSession&&userSession.usuarioId||'operador'),creadoEn:new Date().toISOString()};
    cosechasFila_2026(sh,x);
    return {ok:true,result:{...x,asignadas:0,pendiente:x.toneladas}};
  }catch(e){return {ok:false,error:e.message};}
  finally{lock.releaseLock();}
}
function cosechasActualizar_2026(p, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = p.cosecha || p.harvest || p || {};
    const id = String(p.id || p.cosechaId || data.id || '').trim();
    if (!id) throw new Error('Se requiere el ID de la cosecha a editar.');

    const sh = cosechasHoja_2026('Cosechas', COSECHA_CAMPOS_2026);
    asegurarColumnasOpcionales_2026(sh, ['actualizadoEn']);

    const rows = sh.getDataRange().getValues();
    if (rows.length < 2) throw new Error('No existen cosechas registradas.');
    const m = getHeaderIndexMap_(rows[0]);

    const matches = [];
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][m['id']]) === id) matches.push(i + 1);
    }
    if (matches.length === 0) throw new Error('Cosecha no encontrada: ' + id);
    if (matches.length > 1) throw new Error('Coincidencia ambigua: existen múltiples cosechas con el ID ' + id + '.');

    const rowIdx = matches[0];
    const oldRow = rows[rowIdx - 1];

    const oldFecha = normalizeConfigDateStr_(oldRow[m['fecha']]) || String(oldRow[m['fecha']] || '');
    const oldCampanaId = String(oldRow[m['campanaid']] || '');
    const oldLoteId = String(oldRow[m['loteid']] || '');
    const oldProducto = String(oldRow[m['producto']] || '');
    const oldToneladas = Number(oldRow[m['toneladas']]) || 0;
    const oldObservacion = String(oldRow[m['observacion']] || '');

    const finalFecha = validarFechaIso_2026(data.fecha, oldFecha);
    const finalCampanaId = data.campanaId !== undefined ? String(data.campanaId).trim() : oldCampanaId;
    const finalLoteId = data.loteId !== undefined ? String(data.loteId).trim() : oldLoteId;
    const finalProducto = data.producto !== undefined ? String(data.producto).trim() : oldProducto;
    const finalToneladas = data.toneladas !== undefined
      ? cosechasNumero_2026(data.toneladas, 'Toneladas')
      : oldToneladas;
    const finalObservacion = (data.observacion !== undefined || data.observaciones !== undefined)
      ? String(data.observacion ?? data.observaciones ?? '').trim()
      : oldObservacion;

    if (!finalProducto) throw new Error('Indique el producto de la cosecha.');
    if (!getSheetDataAsObjects('Campanas').some(c => String(c.id) === finalCampanaId)) {
      throw new Error('Seleccione una campaña válida.');
    }
    if (!getSheetDataAsObjects('Lotes').some(l => String(l.id) === finalLoteId)) {
      throw new Error('Seleccione un lote válido.');
    }

    // Verificar toneladas ya asignadas con precio sin tocar AsignacionesPrecio ni Movimientos
    const asignaciones = getSheetDataAsObjects('AsignacionesPrecio')
      .filter(a => String(a.cosechaId) === id);
    const asignadas = Math.round(
      asignaciones.reduce((v, a) => v + Number(a.toneladas || 0), 0) * 1000000
    ) / 1000000;

    if (asignadas > 0 && (finalCampanaId !== oldCampanaId || finalLoteId !== oldLoteId || finalProducto !== oldProducto)) {
      throw new Error('Una cosecha con precios asignados no puede cambiar de campaña, lote o producto sin conciliar sus movimientos financieros.');
    }

    if (finalToneladas + 0.0000001 < asignadas) {
      throw new Error(
        'No se puede reducir las toneladas (' + finalToneladas + ' t) por debajo de las toneladas que ya tienen precio asignado (' + asignadas + ' t).'
      );
    }

    const ahora = new Date().toISOString();
    const newRow = oldRow.slice();
    newRow[m['fecha']] = finalFecha;
    newRow[m['campanaid']] = finalCampanaId;
    newRow[m['loteid']] = finalLoteId;
    newRow[m['producto']] = finalProducto;
    newRow[m['toneladas']] = finalToneladas;
    newRow[m['observacion']] = finalObservacion;
    if (m['actualizadoen'] !== undefined) newRow[m['actualizadoen']] = ahora;

    sh.getRange(rowIdx, 1, 1, newRow.length).setValues([newRow]);
    SpreadsheetApp.flush();

    const usuario = String((userSession && userSession.usuarioId) || 'admin');
    logAudit_(
      usuario,
      'UPDATE',
      'Cosechas',
      id,
      finalProducto + ' | ' + finalToneladas + ' t (asignadas: ' + asignadas + ' t)'
    );

    const pendiente = Math.max(0, Math.round((finalToneladas - asignadas) * 1000000) / 1000000);
    return {
      ok: true,
      result: {
        id: id,
        fecha: finalFecha,
        campanaId: finalCampanaId,
        loteId: finalLoteId,
        producto: finalProducto,
        toneladas: finalToneladas,
        observacion: finalObservacion,
        creadoPor: String(oldRow[m['creadopor']] || ''),
        creadoEn: oldRow[m['creadoen']],
        actualizadoEn: ahora,
        asignadas: asignadas,
        pendiente: pendiente,
        asignaciones: asignaciones
      }
    };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function cosechasAsignarPrecio_2026(p,userSession){
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    const cosecha=cosechasResumen_2026().find(c=>String(c.id)===String(p.cosechaId));
    if(!cosecha)throw new Error('Cosecha no encontrada.');
    const toneladas=cosechasNumero_2026(p.toneladas,'Toneladas asignadas');
    if(toneladas>cosecha.pendiente+0.0000001)throw new Error('La cantidad supera las toneladas pendientes.');
    const precio=cosechasNumero_2026(p.precioUsdTon,'Precio USD/t');
    const tc=resolverTipoCambioOperacion_2026(p.tc ?? p.tipoCambio);
    const fecha=String(p.fecha||new Date().toISOString().slice(0,10));
    const campanaId=String(p.campanaId||cosecha.campanaId);
    if(!getSheetDataAsObjects('Campanas').some(c=>String(c.id)===campanaId))throw new Error('Campaña de venta no válida.');
    const sh=cosechasHoja_2026('AsignacionesPrecio',PRECIO_CAMPOS_2026);
    const mov=findSheetIgnoreCase_('Movimientos');
    if(!mov)throw new Error('Falta hoja Movimientos.');
    const headers=getSheetHeaders_(mov);
    validateRequiredColumns_('Movimientos',headers,SHEET_SCHEMAS.Movimientos);
    const id=Utilities.getUuid(),movId=Utilities.getUuid(),ahora=new Date().toISOString();
    const importe=Math.round(toneladas*precio*100)/100;
    const user=String(userSession&&userSession.usuarioId||'operador');
    const a={id,cosechaId:String(cosecha.id),fecha,campanaId,toneladas,precioUsdTon:precio,importeUsd:importe,tc,movimientoId:movId,creadoPor:user,creadoEn:ahora};
    // La asignación es el registro principal. Un reintento de reparación
    // puede identificar el movimiento por su ID, evitando ingresos duplicados.
    cosechasFila_2026(sh,a);
    const m={id:movId,fecha,campanaId,modulo:'PROPIEDAD',clase:'INGRESO',itemId:'',descripcion:'Venta de '+String(cosecha.producto||'cosecha'),loteId:String(cosecha.loteId),maquinaId:'',cantidad:toneladas,unidad:'t',precioUnitario:precio,importe,moneda:'USD',tc,trabajoId:'COSECHA:'+id,creadoPor:user,creadoEn:ahora,actualizadoEn:ahora};
    cosechasFila_2026(mov,m);
    return {ok:true,result:{...a,moneda:'USD'}};
  }catch(e){return {ok:false,error:e.message};}
  finally{lock.releaseLock();}
}
function probarCosechas_2026(){console.log(JSON.stringify(cosechasListar_2026({soloPendientes:true})));}


// =============================================================
// DISTRIBUCION DE GASTOS DE PROPIEDAD POR HECTAREAS (2026)
// API: expense.allocate {fecha,campanaId,descripcion,importe,moneda,tc,
//                        lotes:[{loteId,hectareas}],itemId,observacion}
// Cada lote genera un gasto individual. La hoja DistribucionesGasto
// conserva el grupo para rastrear el origen y evitar duplicados.
// =============================================================
const GASTOS_DISTRIBUCION_CAMPOS_2026 = [
  'id','grupoId','movimientoId','loteId','hectareas','importe','moneda','fecha','campanaId','creadoEn'
];
function gastosDistribucionesListar_2026(p) {
  let datos = getSheetDataAsObjects('DistribucionesGasto');
  if (p && p.grupoId) datos = datos.filter(x => String(x.grupoId) === String(p.grupoId));
  if (p && p.campanaId) datos = datos.filter(x => String(x.campanaId) === String(p.campanaId));
  return {ok:true,result:datos,distribuciones:datos};
}
function gastosDistribuirLotes_2026(p,session) {
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try {
    const lotesEntrada=p.lotes;
    if(!Array.isArray(lotesEntrada)||lotesEntrada.length<2)
      throw new Error('Seleccione al menos dos lotes para distribuir el gasto.');
    const existentes=getSheetDataAsObjects('Lotes');
    const vistos={};let totalHa=0;
    const partes=lotesEntrada.map(l=>{
      const loteId=String(l.loteId||'').trim();
      if(!loteId||vistos[loteId])throw new Error('Lote vacío o repetido.');
      vistos[loteId]=true;
      const lote=existentes.find(x=>String(x.id)===loteId);
      if(!lote)throw new Error('Lote inexistente: '+loteId);
      const ha=Number(String(l.hectareas).replace(',','.'));
      if(!Number.isFinite(ha)||ha<=0)throw new Error('Hectáreas trabajadas inválidas.');
      if(ha>Number(lote.hectareas))throw new Error('Hectáreas trabajadas superan la superficie del lote '+String(lote.nombre));
      totalHa+=ha;return {loteId,hectareas:ha};
    });
    const total=Number(String(p.importe).replace(',','.'));
    if(!Number.isFinite(total)||total<=0||Math.round(total*100)!==total*100)
      throw new Error('Indique un importe positivo con máximo dos decimales.');
    const moneda=String(p.moneda||'USD').toUpperCase();
    if(!['USD','BOB'].includes(moneda))throw new Error('Moneda inválida.');
    const tc=Number(p.tc||getConfigValue('TIPO_CAMBIO',0));
    if(!Number.isFinite(tc)||tc<=0)throw new Error('Tipo de cambio inválido.');
    const campanaId=String(p.campanaId||'');
    if(!getSheetDataAsObjects('Campanas').some(c=>String(c.id)===campanaId))
      throw new Error('Campaña inválida.');
    const descripcion=String(p.descripcion||'').trim();
    if(!descripcion)throw new Error('Indique el concepto del gasto.');
    const fecha=String(p.fecha||new Date().toISOString().slice(0,10));
    if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha))throw new Error('Fecha inválida.');
    const mov=findSheetIgnoreCase_('Movimientos');
    if(!mov)throw new Error('Falta hoja Movimientos.');
    validateRequiredColumns_('Movimientos',getSheetHeaders_(mov),SHEET_SCHEMAS.Movimientos);
    const dist=cosechasHoja_2026('DistribucionesGasto',GASTOS_DISTRIBUCION_CAMPOS_2026);
    const grupoId=String(p.grupoId||Utilities.getUuid());
    if(getSheetDataAsObjects('DistribucionesGasto').some(x=>String(x.grupoId)===grupoId))
      throw new Error('Esta distribución ya existe; consulte su historial.');
    const totalCentavos=Math.round(total*100);
    const usuario=String(session&&session.usuarioId||'operador');
    const ahora=new Date().toISOString();
    let asignados=0;const resultados=[];
    partes.forEach((parte,i)=>{
      const centavos=i===partes.length-1 ? totalCentavos-asignados : Math.round(totalCentavos*parte.hectareas/totalHa);
      asignados+=centavos;
      const importe=centavos/100,id=Utilities.getUuid();
      const movObj={id,fecha,campanaId,modulo:'PROPIEDAD',clase:'GASTO',itemId:String(p.itemId||''),
        descripcion,loteId:parte.loteId,maquinaId:'',cantidad:parte.hectareas,unidad:'ha',
        precioUnitario:importe/parte.hectareas,importe,moneda,tc,trabajoId:'',
        creadoPor:usuario,creadoEn:ahora,actualizadoEn:ahora};
      cosechasFila_2026(mov,movObj);
      const d={id:Utilities.getUuid(),grupoId,movimientoId:id,loteId:parte.loteId,
        hectareas:parte.hectareas,importe,moneda,fecha,campanaId,creadoEn:ahora};
      cosechasFila_2026(dist,d);
      resultados.push(d);
    });
    logAudit_(usuario,'CREATE','DistribucionesGasto',grupoId,descripcion+' '+total+' '+moneda);
    return {ok:true,result:{grupoId,total,moneda,totalHectareas:totalHa,partes:resultados}};
  }catch(e){return {ok:false,error:e.message};}
  finally{lock.releaseLock();}
}
function probarDistribuciones_2026(){console.log(JSON.stringify(gastosDistribucionesListar_2026({})));}



// =============================================================
// USUARIOS INDIVIDUALES 2026
// Compatibilidad: las contraseñas compartidas existentes siguen operativas.
// El alta de usuarios requiere una sesión administrativa válida.
// =============================================================
function usuariosHoja2026_(){
  let sh=findSheetIgnoreCase_('Usuarios');
  if(!sh){sh=SpreadsheetApp.getActiveSpreadsheet().insertSheet('Usuarios');sh.getRange(1,1,1,SHEET_SCHEMAS.Usuarios.length).setValues([SHEET_SCHEMAS.Usuarios]);sh.setFrozenRows(1);}
  validateRequiredColumns_('Usuarios',getSheetHeaders_(sh),SHEET_SCHEMAS.Usuarios);
  return sh;
}
function usuariosDatos2026_(){
  const sh=usuariosHoja2026_(),vals=sh.getDataRange().getValues(),m=getHeaderIndexMap_(vals[0]);
  return {sh,m,users:vals.slice(1).map((r,i)=>({row:i+2,id:String(r[m.id]||''),usuario:String(r[m.usuario]||''),nombre:String(r[m.nombre]||''),rol:String(r[m.rol]||'usuario').toLowerCase(),salt:String(r[m.salt]||''),hash:String(r[m.hash]||''),version:Number(r[m.version]||1),activo:!['false','no','0'].includes(String(r[m.activo]).toLowerCase())&&r[m.activo]!==false,creadoEn:r[m.creadoen],actualizadoEn:r[m.actualizadoen]})).filter(u=>u.id)};
}
function usuariosPublico2026_(u){return {id:u.id,usuario:u.usuario,nombre:u.nombre,rol:u.rol,activo:u.activo,creadoEn:u.creadoEn,actualizadoEn:u.actualizadoEn};}
function usuariosListar2026_(){const u=usuariosDatos2026_().users.map(usuariosPublico2026_);return {ok:true,result:u,users:u};}
function usuariosValidarNombre2026_(s){s=String(s||'').trim();if(!/^[a-zA-Z0-9._-]{3,40}$/.test(s))throw new Error('Usuario: entre 3 y 40 caracteres (letras, números, punto, guion).');return s;}
function usuariosValidarPin2026_(s){s=String(s||'');if(!/^\d{5}$/.test(s))throw new Error('El PIN debe tener exactamente cinco dígitos.');return s;}
function usuariosCrear2026_(p,session){
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    const d=usuariosDatos2026_(),usuario=usuariosValidarNombre2026_(p.usuario),pin=usuariosValidarPin2026_(p.pin),rol=String(p.rol||'usuario').toLowerCase();
    if(!['admin','usuario'].includes(rol))throw new Error('Rol inválido.');
    if(d.users.some(u=>u.usuario.toLowerCase()===usuario.toLowerCase()))throw new Error('El usuario ya existe.');
    const nombre=String(p.nombre||usuario).trim(),salt=generateSalt_(),ahora=new Date().toISOString();
    const x={id:Utilities.getUuid(),usuario,nombre,rol,salt,hash:hashWithSalt_(pin,salt),version:1,activo:true,creadoEn:ahora,actualizadoEn:ahora};
    const row=Array(d.sh.getLastColumn()).fill('');Object.keys(x).forEach(k=>{const j=d.m[k.toLowerCase()];if(j!==undefined)row[j]=x[k];});d.sh.appendRow(row);
    logAudit_(session.usuarioId,'CREATE','Usuarios',x.id,'Alta de '+usuario);
    return {ok:true,result:usuariosPublico2026_(x)};
  }catch(e){return {ok:false,error:e.message};}finally{lock.releaseLock();}
}
function usuariosActualizar2026_(p,session){
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    const d=usuariosDatos2026_(),u=d.users.find(x=>x.id===String(p.id));if(!u)throw new Error('Usuario no encontrado.');
    const rol=p.rol===undefined?u.rol:String(p.rol).toLowerCase();if(!['admin','usuario'].includes(rol))throw new Error('Rol inválido.');
    const nombre=p.nombre===undefined?u.nombre:String(p.nombre).trim();if(!nombre)throw new Error('Nombre obligatorio.');
    if(u.rol==='admin'&&rol!=='admin'&&!d.users.some(x=>x.id!==u.id&&x.rol==='admin'&&x.activo))throw new Error('Debe quedar otro administrador activo.');
    d.sh.getRange(u.row,d.m.nombre+1).setValue(nombre);d.sh.getRange(u.row,d.m.rol+1).setValue(rol);d.sh.getRange(u.row,d.m.actualizadoen+1).setValue(new Date().toISOString());
    if(rol!==u.rol)usuariosRevocarSesiones2026_(u.id);
    logAudit_(session.usuarioId,'UPDATE','Usuarios',u.id,'Datos/rol');return {ok:true,result:{id:u.id,nombre,rol}};
  }catch(e){return {ok:false,error:e.message};}finally{lock.releaseLock();}
}
function usuariosRevocarSesiones2026_(id){
  const sh=findSheetIgnoreCase_('Sesiones');if(!sh)return;const vals=sh.getDataRange().getValues();if(vals.length<2)return;const m=getHeaderIndexMap_(vals[0]);
  for(let i=1;i<vals.length;i++)if(String(vals[i][m.usuarioid])===String(id))sh.getRange(i+1,m.revocada+1).setValue(true);
}
function usuariosRestablecer2026_(p,session){
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{const d=usuariosDatos2026_(),u=d.users.find(x=>x.id===String(p.id));if(!u)throw new Error('Usuario no encontrado.');
    const pin=usuariosValidarPin2026_(p.pin),salt=generateSalt_();
    d.sh.getRange(u.row,d.m.salt+1).setValue(salt);d.sh.getRange(u.row,d.m.hash+1).setValue(hashWithSalt_(pin,salt));d.sh.getRange(u.row,d.m.version+1).setValue(u.version+1);d.sh.getRange(u.row,d.m.actualizadoen+1).setValue(new Date().toISOString());
    usuariosRevocarSesiones2026_(u.id);logAudit_(session.usuarioId,'RESET_PIN','Usuarios',u.id,'PIN actualizado');return {ok:true,result:{id:u.id}};
  }catch(e){return {ok:false,error:e.message};}finally{lock.releaseLock();}
}
function usuariosRevocar2026_(p,session){
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{const d=usuariosDatos2026_(),u=d.users.find(x=>x.id===String(p.id));if(!u)throw new Error('Usuario no encontrado.');
    if(u.rol==='admin'&&!d.users.some(x=>x.id!==u.id&&x.rol==='admin'&&x.activo))throw new Error('Debe quedar otro administrador activo.');
    d.sh.getRange(u.row,d.m.activo+1).setValue(false);d.sh.getRange(u.row,d.m.actualizadoen+1).setValue(new Date().toISOString());usuariosRevocarSesiones2026_(u.id);
    logAudit_(session.usuarioId,'REVOKE','Usuarios',u.id,'Acceso desactivado');return {ok:true,result:{id:u.id,activo:false}};
  }catch(e){return {ok:false,error:e.message};}finally{lock.releaseLock();}
}
function handleLogin2026_(p){
  const usuario=String(p.usuario||p.username||'').trim();
  if(!usuario)return handleLogin(p);
  const pin=String(p.pin||p.password||p.contrasena||'');
  const u=usuariosDatos2026_().users.find(x=>x.usuario.toLowerCase()===usuario.toLowerCase()&&x.activo);
  if(!u||hashWithSalt_(pin,u.salt)!==u.hash)return {ok:false,error:'Usuario o PIN incorrecto.'};
  const token=Utilities.getUuid(),ahora=new Date().toISOString(),expira=new Date(Date.now()+(u.rol==='admin'?60:14)*86400000).toISOString();
  const sh=findSheetIgnoreCase_('Sesiones');if(!sh)throw new Error('Falta la hoja Sesiones.');
  const m=getHeaderIndexMap_(getSheetHeaders_(sh));validateRequiredColumns_('Sesiones',getSheetHeaders_(sh),SHEET_SCHEMAS.Sesiones);
  const row=Array(sh.getLastColumn()).fill(''),data={id:Utilities.getUuid(),usuarioId:u.id,tokenHash:hashPassword_(token),version:u.version,venceEn:expira,revocada:false,creadoEn:ahora,ultimoUso:ahora};
  Object.keys(data).forEach(k=>{if(m[k.toLowerCase()]!==undefined)row[m[k.toLowerCase()]]=data[k];});sh.appendRow(row);
  logAudit_(u.id,'LOGIN','Sesiones',data.id,'Ingreso de '+u.usuario);
  const result={token,usuario:u.usuario,nombre:u.nombre,rol:u.rol,expira};if(u.rol==='admin')result.tokenAdmin=token;
  return {ok:true,result};
}
function validarSesion2026_(token){
  if(!token)return null;
  const sh=findSheetIgnoreCase_('Sesiones');if(!sh)return null;const vals=sh.getDataRange().getValues();if(vals.length<2)return null;
  const m=getHeaderIndexMap_(vals[0]),hash=hashPassword_(token);
  for(let i=1;i<vals.length;i++){
    const r=vals[i];if(String(r[m.tokenhash])!==hash)continue;
    const id=String(r[m.usuarioid]||'');if(id==='admin'||id==='usuario')return validateToken(token);
    if(r[m.revocada]===true||String(r[m.revocada]).toLowerCase()==='true')return null;
    if(new Date(r[m.venceen]).getTime()<Date.now())return null;
    const u=usuariosDatos2026_().users.find(x=>x.id===id);
    if(!u||!u.activo||Number(r[m.version])!==u.version)return null;
    sh.getRange(i+1,m.ultimouso+1).setValue(new Date().toISOString());return {id:r[m.id],usuarioId:u.id,usuario:u.usuario,rol:u.rol};
  }
  return null;
}
function validarAdmin2026_(token){
  const ses=validarSesion2026_(token);
  if(ses&&ses.rol==='admin')return ses;
  return validateAdminToken(token);
}
function probarUsuarios2026_(){console.log(JSON.stringify(usuariosListar2026_()));}
