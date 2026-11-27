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
  Auditoria: ['id', 'fecha', 'usuarioId', 'accion', 'entidad', 'entidadId', 'detalle'],
  Clientes: ['id', 'nombre', 'telefono', 'direccion', 'activo', 'creadoEn', 'actualizadoEn'],
  CobroAplicaciones: ['id', 'cobroId', 'deudaTipo', 'deudaId', 'clienteId', 'moduloOrigen', 'campanaOrigenId', 'loteOrigenId', 'fechaCobro', 'monedaDeuda', 'monedaPago', 'tcAplicado', 'importeOriginalPagado', 'importeEquivalenteDeuda', 'saldoCapitalAnterior', 'interesAcumuladoAnterior', 'interesPagado', 'capitalPagado', 'saldoCapitalRestante', 'interesRestante', 'movimientoInteresId', 'anulado', 'creadoPor', 'creadoEn'],
  NotasDebito: ['id', 'numero', 'fecha', 'clienteId', 'clienteNombre', 'clienteTelefono', 'clienteDireccion', 'totalUsd', 'totalBob', 'snapshotJson', 'observacion', 'creadoPor', 'creadoEn', 'idempotencyKey'],
  NotasCobro: ['id', 'numero', 'cobroId', 'fecha', 'clienteId', 'clienteNombre', 'clienteTelefono', 'clienteDireccion', 'tipoPago', 'monedaPago', 'importeOriginalPagado', 'tcAplicado', 'totalAplicadoUsd', 'totalAplicadoBob', 'snapshotJson', 'observacion', 'anulado', 'creadoPor', 'creadoEn'],
  DistribucionesVenta: ['id', 'ventaId', 'cosechaId', 'loteId', 'campanaId', 'producto', 'unidad', 'toneladasAsignadas', 'participacionPct', 'precioUnitario', 'importeAsignado', 'moneda', 'tcHistorico', 'movimientoId', 'anulada', 'creadoEn', 'actualizadoEn']
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
    'harvest.delete',
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
    'financial.reports',
    'customer.create',
    'customer.update',
    'customer.toggle',
    'customer.delete',
    'paymentSettings.save',
    'harvestSale.list',
    'harvestSale.create',
    'harvestSale.update',
    'harvestSale.cancel',
    'harvest.price',
    'ar.summary',
    'ar.customer',
    'ar.debt.assignCustomer',
    'ar.payment.register',
    'ar.payment.cancel',
    'ar.debitNote.create',
    'ar.documents',
    'cobros.list',
    'cobros.estado',
    'cobros.registrar'
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
    case 'harvest.delete':
      if (!adminSession) return {ok:false,error:'Solo el administrador puede eliminar cosechas.'};
      return cosechasEliminar_2026(payload, userSession);
    case 'harvest.price': return cosechasAsignarPrecio_2026(payload, userSession);
    case 'harvest.pending': return cosechasListar_2026({soloPendientes:true});
    case 'expense.allocate': return gastosDistribuirLotes_2026(payload, userSession);
    case 'expense.allocations': return gastosDistribucionesListar_2026(payload);

    // --- Cuentas por cobrar de servicios externos (compatibilidad heredada) ---
    case 'cobros.list':
      return cobrosListar_2026(payload);
    case 'cobros.registrar':
      return cobrosRegistrar_2026(payload, userSession);
    case 'cobros.estado':
      return cobrosEstado_2026(payload.trabajoId || payload.id);

    // --- Catálogo de Clientes ---
    case 'customer.list':
      return clientesListar_2026(payload);
    case 'customer.create':
      return clientesCrear_2026(payload, userSession);
    case 'customer.update':
      return clientesActualizar_2026(payload, userSession);
    case 'customer.toggle':
      return clientesToggle_2026(payload, userSession);
    case 'customer.delete':
      return clientesEliminar_2026(payload, userSession);

    // --- Configuración de Cobros e Interés ---
    case 'paymentSettings.get':
      return configCobrosObtener_2026();
    case 'paymentSettings.save':
      return configCobrosGuardar_2026(payload, userSession);

    // --- Ventas de Cosecha (Admin) ---
    case 'harvestSale.list':
      return ventasCosechaListar_2026(payload);
    case 'harvestSale.create':
      return ventasCosechaCrear_2026(payload, userSession);
    case 'harvestSale.update':
      return ventasCosechaActualizar_2026(payload, userSession);
    case 'harvestSale.cancel':
      return ventasCosechaAnular_2026(payload, userSession);

    // --- Cuentas por Cobrar Centralizadas, Cobros y Documentos (Admin) ---
    case 'ar.summary':
      return arResumen_2026(payload);
    case 'ar.customer':
      return arDetalleCliente_2026(payload);
    case 'ar.debt.assignCustomer':
      return arAsignarClienteDeuda_2026(payload, userSession);
    case 'ar.payment.register':
      return arRegistrarCobro_2026(payload, userSession);
    case 'ar.payment.cancel':
      return arAnularCobro_2026(payload, userSession);
    case 'ar.debitNote.create':
      return arCrearNotaDebito_2026(payload, userSession);
    case 'ar.documents':
      return arListarDocumentos_2026(payload);

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

    const nameCol = map['nombre'];
    const machineName = nameCol !== undefined ? String(rows[matches[0] - 1][nameCol] || '').trim() : '';

    if (getSheetDataAsObjects('Trabajos').some(t => String(t.maquinaId || '').trim() === idTrim)) {
      return { ok: false, error: 'No se puede eliminar esta máquina porque tiene trabajos históricos registrados. Desactívela en lugar de eliminarla.' };
    }
    if (getSheetDataAsObjects('Movimientos').some(t => String(t.maquinaId || '').trim() === idTrim)) {
      return { ok: false, error: 'No se puede eliminar esta máquina porque tiene movimientos registrados. Desactívela en lugar de eliminarla.' };
    }
    if (getSheetDataAsObjects('TrabajosMaquinaria').some(t => String(t.maquinaId || '').trim() === idTrim)) {
      return { ok: false, error: 'No se puede eliminar esta máquina porque tiene implementos asociados. Desactívela en lugar de eliminarla.' };
    }
    if (tieneRegistroPatrimonialActivo_(idTrim, machineName, 'MAQUINA')) {
      return { ok: false, error: 'No se puede eliminar esta máquina porque tiene registros patrimoniales o mejoras vinculadas. Desactívela en lugar de eliminarla.' };
    }
    sheet.deleteRow(matches[0]);
    SpreadsheetApp.flush();
    logAudit_(userSession?.usuarioId, 'DELETE', 'Maquinas', idTrim, 'Maquinaria eliminada');
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function tieneRegistroPatrimonialActivo_(referenciaId, nombre, tipoFiltro) {
  if (!findSheetIgnoreCase_('Activos')) return false;
  const idTrim = String(referenciaId || '').trim();
  const nameLower = String(nombre || '').trim().toLowerCase();
  const activos = getSheetDataAsObjects('Activos');
  const mejoras = findSheetIgnoreCase_('Mejoras') ? getSheetDataAsObjects('Mejoras') : [];
  const mejorasCountByActivo = {};
  for (let i = 0; i < mejoras.length; i++) {
    const aid = String(mejoras[i].activoId || '').trim();
    if (aid) mejorasCountByActivo[aid] = (mejorasCountByActivo[aid] || 0) + 1;
  }
  return activos.some(function (a) {
    const isAct = a.activo !== false && String(a.activo).toLowerCase() !== 'false';
    if (!isAct) return false;
    const tipo = String(a.tipo || '').trim().toUpperCase();
    if (tipoFiltro === 'IMPLEMENTO') {
      if (tipo !== 'IMPLEMENTO') return false;
    } else if (tipoFiltro === 'MAQUINA') {
      if (tipo === 'IMPLEMENTO' || tipo === 'LOTE') return false;
    }
    const aId = String(a.id || '').trim();
    const refId = String(a.referenciaId || '').trim();
    const aName = String(a.nombre || '').trim().toLowerCase();
    const matchesEntity =
      (idTrim && (refId === idTrim || aId === idTrim)) ||
      (nameLower && aName === nameLower);
    if (!matchesEntity) return false;
    const valIni = Number(a.valorInicial) || 0;
    const mejorasCnt = mejorasCountByActivo[aId] || 0;
    return valIni > 0 || mejorasCnt > 0;
  });
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
    const idTrim = String(id || '').trim();
    if (!idTrim) {
      return { ok: false, error: 'Se requiere ID para eliminar el implemento.' };
    }

    const sheet = findSheetIgnoreCase_('TrabajosMaquinaria');
    if (!sheet) {
      return { ok: false, error: 'No se encontró la hoja de implementos (TrabajosMaquinaria).' };
    }

    const rows = sheet.getDataRange().getValues();
    if (rows.length < 2) {
      return { ok: false, error: 'Implemento no encontrado con ID: ' + idTrim };
    }

    const map = getHeaderIndexMap_(rows[0]);
    const idCol = map['id'];
    let foundIdx = -1;

    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][idCol] || '').trim() === idTrim) {
        foundIdx = i + 1;
        break;
      }
    }

    if (foundIdx === -1) {
      return { ok: false, error: 'Implemento no encontrado con ID: ' + idTrim };
    }

    const nameCol = map['nombre'];
    const maqCol = map['maquinaid'];
    const implName = nameCol !== undefined ? String(rows[foundIdx - 1][nameCol] || '').trim() : '';
    const implMaqId = maqCol !== undefined ? String(rows[foundIdx - 1][maqCol] || '').trim() : '';
    const implNameLower = implName.toLowerCase();

    const hasLinkedJobs = getSheetDataAsObjects('Trabajos').some(function (t) {
      const refImplId = String(t.implementoId || t.trabajoTipoId || '').trim();
      if (refImplId === idTrim) return true;
      if (implNameLower && String(t.trabajoNombre || '').trim().toLowerCase() === implNameLower) {
        if (!implMaqId || String(t.maquinaId || '').trim() === implMaqId) return true;
      }
      return false;
    });
    if (hasLinkedJobs) {
      return { ok: false, error: 'No se puede eliminar este implemento porque tiene trabajos históricos registrados. Puede mantenerlo inactivo.' };
    }

    const hasLinkedMovements = getSheetDataAsObjects('Movimientos').some(function (m) {
      return String(m.implementoId || '').trim() === idTrim;
    });
    if (hasLinkedMovements) {
      return { ok: false, error: 'No se puede eliminar este implemento porque tiene movimientos registrados. Puede mantenerlo inactivo.' };
    }

    if (tieneRegistroPatrimonialActivo_(idTrim, implName, 'IMPLEMENTO')) {
      return { ok: false, error: 'No se puede eliminar este implemento porque tiene registros patrimoniales o mejoras vinculadas. Puede mantenerlo inactivo.' };
    }

    sheet.deleteRow(foundIdx);
    SpreadsheetApp.flush();
    logAudit_(userSession?.usuarioId, 'DELETE', 'TrabajosMaquinaria', idTrim, 'Implemento eliminado: ' + implName);
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
  const customerMap = {};
  const clientesSheet = findSheetIgnoreCase_('Clientes');
  if (clientesSheet) {
    getSheetDataAsObjects('Clientes').forEach(c => {
      if (c && c.id) customerMap[String(c.id).trim()] = String(c.nombre || '').trim();
    });
  }
  const mapped = jobs.map(j => {
    const cId = String(j.clienteId || '').trim();
    const dynamicName = cId && customerMap[cId] ? customerMap[cId] : String(j.cliente || '');
    return {
      ...j,
      clienteId: cId,
      cliente: dynamicName,
      clientePendiente: finParseBool_2026(j.clientePendiente, String(j.destino || '').toUpperCase() !== 'PROPIEDAD' && !cId && !dynamicName),
      plazoDias: j.plazoDias !== '' && j.plazoDias !== undefined && j.plazoDias !== null ? Number(j.plazoDias) : '',
      fechaVencimiento: j.fechaVencimiento ? (normalizeConfigDateStr_(j.fechaVencimiento) || String(j.fechaVencimiento)) : '',
      aplicarInteres: finParseBool_2026(j.aplicarInteres, false),
      tasaInteresMensual: j.tasaInteresMensual !== '' && j.tasaInteresMensual !== undefined && j.tasaInteresMensual !== null ? Number(j.tasaInteresMensual) : 0,
      tipoTrabajo: String(j.destino || '').toUpperCase() === 'PROPIEDAD' ? 'propiedad' : 'tercero',
      maquinariaId: j.maquinaId,
      tarifa: Number(j.precioUnitario) || 0,
      total: Number(j.importe) || 0,
      tipoCambio: Number(j.tc) || 0
    };
  });
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

    asegurarColumnasOpcionales_2026(jobsSheet, ['clienteId', 'clientePendiente', 'plazoDias', 'fechaVencimiento', 'aplicarInteres', 'tasaInteresMensual']);
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
    const cantVal = Number(String(j.cantidad ?? '').trim().replace(',', '.'));
    if (!Number.isFinite(cantVal) || cantVal <= 0) {
      throw new Error('La cantidad de trabajo debe ser un número mayor a 0.');
    }
    const precioVal = Number(String(j.precioUnitario ?? j.tarifa ?? '').trim().replace(',', '.'));
    if (!Number.isFinite(precioVal) || precioVal < 0) {
      throw new Error('El precio unitario / tarifa no puede ser un número negativo.');
    }
    const totalVal = redondear2_2026(cantVal * precioVal);

    const rawMon = String(j.moneda || 'BOB').trim().toUpperCase();
    if (!['USD', 'BOB', 'BS', 'BS.'].includes(rawMon)) {
      throw new Error('Moneda de servicio inválida.');
    }
    const monVal = rawMon === 'USD' ? 'USD' : 'BOB';
    const fechaVal = validarFechaIso_2026(j.fecha, getBoliviaTodayStr_());
    const ahora = new Date().toISOString();
    const usuarioNombre = userSession?.usuarioId || 'operador';

    // Resolución de cliente y condiciones de cobro para servicios externos
    let resolvedClienteId = '';
    let resolvedClienteNombre = '';
    let resolvedClientePendiente = false;
    let resolvedPlazoDias = '';
    let resolvedFechaVenc = '';
    let resolvedAplicarInteres = false;
    let resolvedTasaInteres = 0;

    if (destinoVal === 'TERCERO') {
      const reqClienteId = String(j.clienteId || '').trim();
      const reqPendiente = finParseBool_2026(j.clientePendiente, false);
      if (!reqPendiente && reqClienteId) {
        const cliObj = clientesBuscarPorId_2026(reqClienteId);
        if (!cliObj) throw new Error('El cliente seleccionado no existe en el catálogo.');
        resolvedClienteId = cliObj.id;
        resolvedClienteNombre = cliObj.nombre;
        resolvedClientePendiente = false;
      } else if (reqPendiente || !reqClienteId) {
        resolvedClienteId = '';
        resolvedClienteNombre = reqPendiente ? '' : String(j.cliente || '').trim();
        resolvedClientePendiente = reqPendiente || !resolvedClienteNombre;
      }
      const rawPlazo = j.plazoDias !== undefined && j.plazoDias !== '' && j.plazoDias !== null
        ? Number(String(j.plazoDias).replace(',', '.'))
        : NaN;
      if (Number.isFinite(rawPlazo) && rawPlazo >= 0) {
        resolvedPlazoDias = Math.round(rawPlazo);
        resolvedFechaVenc = j.fechaVencimiento
          ? validarFechaIso_2026(j.fechaVencimiento, finAddDaysIso_2026(fechaVal, resolvedPlazoDias))
          : finAddDaysIso_2026(fechaVal, resolvedPlazoDias);
      } else if (j.fechaVencimiento && String(j.fechaVencimiento).trim() !== '') {
        resolvedFechaVenc = validarFechaIso_2026(j.fechaVencimiento, fechaVal);
        resolvedPlazoDias = Math.max(0, finDaysDiffIso_2026(fechaVal, resolvedFechaVenc));
      }
      resolvedAplicarInteres = finParseBool_2026(j.aplicarInteres, false);
      const rawTasa = Number(String(j.tasaInteresMensual ?? 0).replace(',', '.'));
      resolvedTasaInteres = resolvedAplicarInteres && Number.isFinite(rawTasa) && rawTasa > 0 ? redondear2_2026(rawTasa) : 0;
      if (resolvedTasaInteres <= 0) resolvedAplicarInteres = false;
    }

    // 1. Insertar en Trabajos
    const jRow = Array(jHeaders.length).fill('');
    jRow[jMap['id']] = id;
    jRow[jMap['fecha']] = fechaVal;
    jRow[jMap['campanaid']] = String(j.campanaId || '');
    jRow[jMap['maquinaid']] = String(maqId);
    if (jMap['implementoid'] !== undefined) jRow[jMap['implementoid']] = implementoId;
    jRow[jMap['destino']] = destinoVal;
    jRow[jMap['loteid']] = destinoVal === 'PROPIEDAD' ? String(j.loteId || '') : '';
    jRow[jMap['cliente']] = destinoVal === 'TERCERO' ? resolvedClienteNombre : '';
    if (jMap['clienteid'] !== undefined) jRow[jMap['clienteid']] = resolvedClienteId;
    if (jMap['clientependiente'] !== undefined) jRow[jMap['clientependiente']] = resolvedClientePendiente;
    if (jMap['plazodias'] !== undefined) jRow[jMap['plazodias']] = resolvedPlazoDias;
    if (jMap['fechavencimiento'] !== undefined) jRow[jMap['fechavencimiento']] = resolvedFechaVenc;
    if (jMap['aplicarinteres'] !== undefined) jRow[jMap['aplicarinteres']] = resolvedAplicarInteres;
    if (jMap['tasainteresmensual'] !== undefined) jRow[jMap['tasainteresmensual']] = resolvedTasaInteres;
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
    // El pago inicial se registra mediante el motor centralizado de Cuentas por Cobrar.
    const cobroInicial = destinoVal === 'TERCERO'
      ? Number(String(j.montoCobradoInicial ?? (String(j.estadoCobro || '').toUpperCase() === 'PAGADO' ? totalVal : 0)).trim().replace(',', '.'))
      : 0;
    if (!Number.isFinite(cobroInicial) || cobroInicial < 0 || Math.round(cobroInicial * 100) > Math.round(totalVal * 100)) {
      throw new Error('El cobro inicial debe estar entre cero y el importe del servicio.');
    }
    if (destinoVal === 'TERCERO' && cobroInicial > 0) {
      if (!userSession || userSession.rol !== 'admin') {
        throw new Error('Solo el administrador puede registrar cobros. Guarde el servicio como pendiente y registre el cobro desde Administración → Cuentas por cobrar.');
      }
      if (clientePendiente || !resolvedClienteId) {
        throw new Error('No se puede registrar un cobro inicial sin un cliente asignado del catálogo.');
      }
    }
    if (destinoVal === 'TERCERO') cobrosPrepararHoja_2026();
    jobsSheet.appendRow(jRow);

    const trabajoDesc = j.trabajoNombre ? (' - ' + j.trabajoNombre) : '';

    // 2. Insertar en Movimientos: Ingreso de Maquinarias (siempre)
    const incRow = [];
    incRow[mMap['id']] = Utilities.getUuid();
    incRow[mMap['fecha']] = fechaVal;
    incRow[mMap['campanaid']] = String(j.campanaId || '');
    incRow[mMap['modulo']] = 'MAQUINARIAS';
    incRow[mMap['clase']] = 'INGRESO';
    incRow[mMap['itemid']] = '';
    incRow[mMap['descripcion']] = destinoVal === 'PROPIEDAD'
      ? ('Trabajo en propiedad' + trabajoDesc + ' (' + (j.loteNombre || j.loteId || 'Lote') + ')')
      : ('Servicio a tercero' + trabajoDesc + ' (' + (resolvedClienteNombre || 'Cliente pendiente') + ')');
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
      expRow[mMap['fecha']] = fechaVal;
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
      SpreadsheetApp.flush();
      const cobroInitRes = arRegistrarCobroInternal_2026({
        clienteId: resolvedClienteId,
        fecha: fechaVal,
        monedaPago: monVal,
        tcAplicado: finalTc,
        observacion: 'Cobro inicial',
        idempotencyKey: 'INIT-TRABAJO-' + id,
        aplicaciones: [{
          deudaTipo: 'TRABAJO',
          deudaId: id,
          importeOriginalPagado: redondear2_2026(cobroInicial)
        }]
      }, userSession);
      if (!cobroInitRes || !cobroInitRes.ok) {
        throw new Error((cobroInitRes && cobroInitRes.error) || 'No se pudo registrar el cobro inicial.');
      }
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

    asegurarColumnasOpcionales_2026(jobsSheet, ['clienteId', 'clientePendiente', 'plazoDias', 'fechaVencimiento', 'aplicarInteres', 'tasaInteresMensual']);
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
      finalTrabajoNombre = String((impObj && impObj.nombre) || j.trabajoNombre || oldTrabajoNombre || '').trim();
    } else if (j.trabajoNombre !== undefined) {
      finalTrabajoNombre = String(j.trabajoNombre || '').trim();
    } else if (j.implementoId === undefined && j.trabajoTipoId === undefined) {
      finalTrabajoNombre = oldTrabajoNombre;
    }

    let finalLoteId = '';
    let finalLoteNombre = '';
    let finalCliente = '';
    let finalClienteId = '';
    let finalClientePendiente = false;
    let finalPlazoDias = '';
    let finalFechaVenc = '';
    let finalAplicarInteres = false;
    let finalTasaInteres = 0;

    const oldClienteId = jMap['clienteid'] !== undefined ? String(oldRow[jMap['clienteid']] || '').trim() : '';
    const oldClientePendiente = jMap['clientependiente'] !== undefined ? finParseBool_2026(oldRow[jMap['clientependiente']], !oldClienteId && !oldCliente) : (!oldClienteId && !oldCliente);
    const oldPlazoDias = jMap['plazodias'] !== undefined ? oldRow[jMap['plazodias']] : '';
    const oldFechaVenc = jMap['fechavencimiento'] !== undefined ? (normalizeConfigDateStr_(oldRow[jMap['fechavencimiento']]) || String(oldRow[jMap['fechavencimiento']] || '')) : '';
    const oldAplicarInteres = jMap['aplicarinteres'] !== undefined ? finParseBool_2026(oldRow[jMap['aplicarinteres']], false) : false;
    const oldTasaInteres = jMap['tasainteresmensual'] !== undefined ? (Number(oldRow[jMap['tasainteresmensual']]) || 0) : 0;

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
      finalClienteId = '';
      finalClientePendiente = false;
      finalPlazoDias = '';
      finalFechaVenc = '';
      finalAplicarInteres = false;
      finalTasaInteres = 0;
    } else {
      finalLoteId = '';
      const hasClienteUpdate = j.clienteId !== undefined || j.clientePendiente !== undefined || j.cliente !== undefined;
      if (hasClienteUpdate) {
        const reqPend = finParseBool_2026(j.clientePendiente, false);
        const reqCid = String(j.clienteId || '').trim();
        if (!reqPend && reqCid) {
          const cliObj = clientesBuscarPorId_2026(reqCid);
          if (!cliObj) throw new Error('El cliente seleccionado no existe en el catálogo.');
          finalClienteId = cliObj.id;
          finalCliente = cliObj.nombre;
          finalClientePendiente = false;
        } else {
          finalClienteId = '';
          finalCliente = reqPend ? '' : String(j.cliente || '').trim();
          finalClientePendiente = reqPend || !finalCliente;
        }
      } else {
        finalClienteId = oldClienteId;
        finalCliente = oldCliente;
        finalClientePendiente = oldClientePendiente;
      }

      if (j.plazoDias !== undefined || j.fechaVencimiento !== undefined) {
        const rawP = j.plazoDias !== undefined && j.plazoDias !== '' && j.plazoDias !== null
          ? Number(String(j.plazoDias).replace(',', '.'))
          : NaN;
        if (Number.isFinite(rawP) && rawP >= 0) {
          finalPlazoDias = Math.round(rawP);
          finalFechaVenc = j.fechaVencimiento
            ? validarFechaIso_2026(j.fechaVencimiento, finAddDaysIso_2026(finalFecha, finalPlazoDias))
            : finAddDaysIso_2026(finalFecha, finalPlazoDias);
        } else if (j.fechaVencimiento && String(j.fechaVencimiento).trim() !== '') {
          finalFechaVenc = validarFechaIso_2026(j.fechaVencimiento, finalFecha);
          finalPlazoDias = Math.max(0, finDaysDiffIso_2026(finalFecha, finalFechaVenc));
        } else {
          finalPlazoDias = '';
          finalFechaVenc = '';
        }
      } else {
        finalPlazoDias = oldPlazoDias;
        finalFechaVenc = oldFechaVenc;
      }

      if (j.aplicarInteres !== undefined || j.tasaInteresMensual !== undefined) {
        finalAplicarInteres = finParseBool_2026(j.aplicarInteres, oldAplicarInteres);
        const rawT = Number(String(j.tasaInteresMensual !== undefined ? j.tasaInteresMensual : oldTasaInteres).replace(',', '.'));
        finalTasaInteres = finalAplicarInteres && Number.isFinite(rawT) && rawT > 0 ? redondear2_2026(rawT) : 0;
        if (finalTasaInteres <= 0) finalAplicarInteres = false;
      } else {
        finalAplicarInteres = oldAplicarInteres;
        finalTasaInteres = oldTasaInteres;
      }
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
    const rawMon = j.moneda !== undefined ? String(j.moneda).trim().toUpperCase() : oldMoneda;
    if (!['USD', 'BOB', 'BS', 'BS.'].includes(rawMon)) throw new Error('Moneda de servicio inválida.');
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

    // 3. Validar consistencia con cobros activos (modernos en CobroAplicaciones y heredados en Cobros)
    const arActual = arConstruirDeudas_2026(getBoliviaTodayStr_());
    const deudaActual = arActual.debts.find(function (d) {
      return d.deudaTipo === 'TRABAJO' && String(d.deudaId) === idTrim;
    });
    const tieneCobrosActivos = Boolean(deudaActual && deudaActual.aplicaciones && deudaActual.aplicaciones.length > 0);
    if (tieneCobrosActivos) {
      if (newDestino !== 'TERCERO') {
        return {
          ok: false,
          error: 'No se puede cambiar este servicio a Propiedad porque ya tiene cobros registrados.'
        };
      }
      if (finalMoneda !== oldMoneda) {
        return {
          ok: false,
          error: 'No se puede cambiar la moneda de un servicio que ya tiene cobros registrados.'
        };
      }
      if (oldClienteId && (finalClientePendiente || finalClienteId !== oldClienteId)) {
        return {
          ok: false,
          error: 'No se puede cambiar el cliente de un servicio que ya tiene cobros activos. Anule los cobros primero.'
        };
      }
      if (deudaActual.minActivePayDate && finalFecha > deudaActual.minActivePayDate) {
        return {
          ok: false,
          error: 'La fecha del servicio (' + finalFecha + ') no puede ser posterior al primer cobro registrado (' + deudaActual.minActivePayDate + ').'
        };
      }
      const capitalYaCobrado = redondear2_2026(Number(deudaActual.pagosCapitalAnteriores || 0));
      if (Math.round(finalTotal * 100) < Math.round(capitalYaCobrado * 100)) {
        return {
          ok: false,
          error: 'El nuevo importe (' + finalMoneda + ' ' + finalTotal.toFixed(2) + ') no puede ser menor al capital ya cobrado (' + finalMoneda + ' ' + capitalYaCobrado.toFixed(2) + ').'
        };
      }
      const pagosLegacySinTc = cobrosFilas_2026().filter(function (r) {
        return String(r.trabajoid) === idTrim && !finParseBool_2026(r.anulado, false);
      }).some(function (r) {
        const monRaw = r.monedacobro !== undefined && String(r.monedacobro).trim() !== '' ? r.monedacobro : (r.moneda || 'USD');
        const esBob = String(monRaw).trim().toUpperCase() !== 'USD';
        const tieneUsd = r.importeusd !== undefined && r.importeusd !== '' && r.importeusd !== null;
        const tieneTc = Number(r.tc) > 0;
        return esBob && !tieneUsd && !tieneTc;
      });
      if (pagosLegacySinTc && oldTc > 0 && Math.abs(finalTc - oldTc) > 0.0001) {
        return {
          ok: false,
          error: 'No se puede modificar el tipo de cambio de este servicio porque existen cobros históricos en Bs sin tipo de cambio propio.'
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
    if (jMap['clienteid'] !== undefined) newJobRow[jMap['clienteid']] = finalClienteId;
    if (jMap['clientependiente'] !== undefined) newJobRow[jMap['clientependiente']] = finalClientePendiente;
    if (jMap['plazodias'] !== undefined) newJobRow[jMap['plazodias']] = finalPlazoDias;
    if (jMap['fechavencimiento'] !== undefined) newJobRow[jMap['fechavencimiento']] = finalFechaVenc;
    if (jMap['aplicarinteres'] !== undefined) newJobRow[jMap['aplicarinteres']] = finalAplicarInteres;
    if (jMap['tasainteresmensual'] !== undefined) newJobRow[jMap['tasainteresmensual']] = finalTasaInteres;
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
        if (incomeWritten) {
          const incomeId = String(incomeMatch.data[mMap['id']] || '');
          const curMovRows = movSheet.getDataRange().getValues();
          let targetIncRow = -1;
          for (let rIdx = 1; rIdx < curMovRows.length; rIdx++) {
            if (String(curMovRows[rIdx][mMap['id']]) === incomeId) {
              targetIncRow = rIdx + 1;
              break;
            }
          }
          if (targetIncRow > 1) {
            movSheet.getRange(targetIncRow, 1, 1, incomeMatch.data.length).setValues([incomeMatch.data]);
          } else {
            rollbackErrors.push('restaurar ingreso: fila no localizada por ID');
          }
        }
      } catch (e) { rollbackErrors.push('restaurar ingreso: ' + e.message); }
      try {
        if (expenseUpdated && existingExpense) movSheet.getRange(existingExpense.rowIdx, 1, 1, existingExpense.data.length).setValues([existingExpense.data]);
      } catch (e) { rollbackErrors.push('restaurar gasto: ' + e.message); }
      try {
        if (expenseDeleted && existingExpense) movSheet.appendRow(existingExpense.data);
      } catch (e) { rollbackErrors.push('restaurar gasto eliminado: ' + e.message); }
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
    const isProtectedMora = String(id) === 'SYS_INTERES_MORA';
    deleteRowByColumn('Items', 'id', id);

    const row = [];
    row[map['id']] = id;
    row[map['nombre']] = isProtectedMora ? 'Interés por mora' : String(item.nombre || '').trim();
    row[map['modulo']] = isProtectedMora ? 'MAQUINARIAS' : String(item.modulo || 'PROPIEDAD').toUpperCase();
    row[map['clase']] = isProtectedMora ? 'INGRESO' : String(item.clase || 'GASTO').toUpperCase();
    row[map['icono']] = String(item.icono || (isProtectedMora ? 'Percent' : 'Tag')).trim();
    row[map['unidad']] = String(item.unidad || '').trim();
    row[map['precio']] = Number(item.precio ?? item.precioPredeterminado) || 0;
    row[map['moneda']] = String(item.moneda || (isProtectedMora ? 'USD' : 'BOB')).toUpperCase();
    row[map['activo']] = isProtectedMora ? true : (item.activo !== false && String(item.activo).toLowerCase() !== 'false');

    sheet.appendRow(row);
    logAudit_(userSession?.usuarioId, 'SAVE', 'Items', id, 'Ítem guardado: ' + row[map['nombre']]);

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
  const parts = candidate.split('-').map(Number);
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  if (dt.getUTCFullYear() !== parts[0] || (dt.getUTCMonth() + 1) !== parts[1] || dt.getUTCDate() !== parts[2]) {
    throw new Error('Fecha inválida. Verifique año, mes y día.');
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
    .map(r => Object.fromEntries(Object.keys(cols).map(k => [k, r[cols[k]]])))
    .filter(r => {
      if (finParseBool_2026(r.anulado, false)) return false;
      if (String(r.estadoregistro || '').trim().toUpperCase() === 'PENDIENTE') return false;
      return true;
    });
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
  const idStr = String(id || '').trim();
  const hasLegacy = cobrosFilas_2026().some(r => String(r.trabajoid) === idStr && !finParseBool_2026(r.anulado, false));
  if (hasLegacy) return true;
  const appSheet = findSheetIgnoreCase_('CobroAplicaciones');
  if (!appSheet) return false;
  return getSheetDataAsObjects('CobroAplicaciones').some(
    a => String(a.deudaTipo || '').toUpperCase() === 'TRABAJO' && String(a.deudaId) === idStr && !finParseBool_2026(a.anulado, false)
  );
}

function cobrosNormalizarPago_2026(r, tcHistoricoServicio) {
  const monRaw = r.monedacobro !== undefined && String(r.monedacobro).trim() !== ''
    ? r.monedacobro
    : (r.moneda || 'USD');
  const monedaCobro = String(monRaw).trim().toUpperCase() === 'USD' ? 'USD' : 'BOB';

  const hasOriginal = r.importeoriginal !== undefined && r.importeoriginal !== '' && r.importeoriginal !== null;
  const importeOriginal = hasOriginal ? (Number(r.importeoriginal) || 0) : (Number(r.importe) || 0);

  const tcPago = Number(r.tc) || 0;
  const tcHist = Number(tcHistoricoServicio) > 0 ? Number(tcHistoricoServicio) : 0;
  const effTc = tcPago > 0 ? tcPago : tcHist; // Solo usa TC propio o TC histórico del servicio (nunca el TC actual global)
  const hasUsd = r.importeusd !== undefined && r.importeusd !== '' && r.importeusd !== null;
  let importeUsd;

  if (hasUsd) {
    importeUsd = redondear2_2026(Number(r.importeusd) || 0);
  } else if (monedaCobro === 'USD') {
    importeUsd = redondear2_2026(importeOriginal);
  } else {
    if (!effTc || effTc <= 0) {
      throw new Error('No hay tipo de cambio histórico disponible para convertir un cobro histórico en Bs a USD.');
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
    tc: tcPago > 0 ? tcPago : (monedaCobro === 'BOB' ? effTc : 0),
    importeUsd: importeUsd,
    observacion: String(r.observacion || ''),
    creadoPor: String(r.creadopor || ''),
    creadoEn: r.creadoen instanceof Date ? r.creadoen.toISOString() : (r.creadoen ? String(r.creadoen) : '')
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

  const pagos = pagosRaw.map(r => cobrosNormalizarPago_2026(r, t.tcServicio));
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

function cobrosMapDeudaACuentaLegacy_2026(debt, defaultTc) {
  const tcServicioEff = debt.tcHistorico > 0 ? debt.tcHistorico : (defaultTc > 0 ? defaultTc : 6.96);
  const importeCuentaUsd = debt.moneda === 'USD'
    ? redondear2_2026(debt.importeOriginal)
    : redondear2_2026(debt.importeOriginal / tcServicioEff);
  const cobradoUsd = debt.moneda === 'USD'
    ? redondear2_2026(debt.pagosCapitalAnteriores)
    : redondear2_2026(debt.pagosCapitalAnteriores / tcServicioEff);
  const saldoUsd = debt.moneda === 'USD'
    ? redondear2_2026(debt.totalPendiente)
    : redondear2_2026(debt.totalPendiente / tcServicioEff);
  const estado = debt.totalPendiente <= 0.005 ? 'PAGADO' : (debt.pagosAnteriores > 0 ? 'PARCIAL' : 'PENDIENTE');
  const pagos = (debt.aplicaciones || []).map(function (a) {
    const impUsd = finConvertCurrency_2026(a.importeOriginalPagado, a.monedaPago, 'USD', a.tcAplicado || tcServicioEff);
    return {
      id: a.cobroId || a.id,
      trabajoId: debt.deudaId,
      fecha: a.fechaCobro,
      importe: impUsd,
      moneda: 'USD',
      importeOriginal: redondear2_2026(a.importeOriginalPagado),
      monedaCobro: a.monedaPago,
      tc: a.tcAplicado || tcServicioEff,
      importeUsd: impUsd,
      interesPagado: redondear2_2026(a.interesPagado || 0),
      capitalPagado: redondear2_2026(a.capitalPagado || 0),
      observacion: '',
      creadoPor: a.creadoPor || '',
      creadoEn: a.creadoEn || ''
    };
  });

  return {
    id: debt.deudaId,
    destino: 'TERCERO',
    cliente: debt.clienteNombre || '',
    clienteId: debt.clienteId || '',
    clientePendiente: Boolean(debt.clientePendiente),
    maquinaId: debt.maquinaId || '',
    implementoId: '',
    cantidad: debt.cantidad || 0,
    unidad: debt.unidad || 'ha',
    precioUnitario: debt.precioUnitario || 0,
    importe: importeCuentaUsd,
    moneda: 'USD',
    importeOriginalServicio: debt.importeOriginal,
    monedaOriginalServicio: debt.moneda,
    tcServicio: tcServicioEff,
    campanaId: debt.campanaId || '',
    fecha: debt.fecha || '',
    observacion: debt.observacion || '',
    cobrado: cobradoUsd,
    saldo: saldoUsd,
    capitalPendiente: debt.capitalPendiente,
    interesAcumulado: debt.interesAcumulado,
    totalPendienteOriginal: debt.totalPendiente,
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
    const defaultTc = Number(String(getConfigValue('TIPO_CAMBIO', 0) || '').replace(',', '.')) || 6.96;
    const built = arConstruirDeudas_2026(getBoliviaTodayStr_());
    const debt = built.debts.find(function (d) { return d.deudaTipo === 'TRABAJO' && String(d.deudaId) === String(id); });
    if (!debt) return { ok: false, error: 'Servicio no encontrado: ' + id };
    return { ok: true, result: cobrosMapDeudaACuentaLegacy_2026(debt, defaultTc) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function cobrosListar_2026(p) {
  try {
    const defaultTc = Number(String(getConfigValue('TIPO_CAMBIO', 0) || '').replace(',', '.')) || 6.96;
    const built = arConstruirDeudas_2026(getBoliviaTodayStr_());
    const out = [];
    for (let i = 0; i < built.debts.length; i++) {
      const d = built.debts[i];
      if (d.deudaTipo !== 'TRABAJO') continue;
      if (p && p.campanaId && String(d.campanaId) !== String(p.campanaId)) continue;
      const cuenta = cobrosMapDeudaACuentaLegacy_2026(d, defaultTc);
      if (p && p.soloPendientes && cuenta.saldo <= 0) continue;
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
  if (monedaCobro === 'BOB' && p.importeUsd === undefined && !(tcAplicado > 0)) {
    throw new Error('Se requiere un tipo de cambio válido para registrar un cobro en Bs.');
  }
  const importeUsd = redondear2_2026(
    p.importeUsd !== undefined
      ? Number(p.importeUsd)
      : (monedaCobro === 'USD' ? importeOriginal : importeOriginal / tcAplicado)
  );

  const data = {
    id: Utilities.getUuid(),
    trabajoId: String(p.trabajoId),
    fecha: validarFechaIso_2026(p.fecha, getBoliviaTodayStr_()),
    importe: importeUsd,
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

// Endpoint heredado endurecido: enruta siempre a arRegistrarCobro_2026
// para impedir omitir validaciones de mora, cliente, idempotencia, aplicaciones o sobrepagos.
function cobrosRegistrar_2026(p, userSession) {
  try {
    const id = String((p && (p.trabajoId || p.id)) || '').trim();
    if (!id) return { ok: false, error: 'Falta trabajoId.' };

    const sh = findSheetIgnoreCase_('Trabajos');
    if (!sh) return { ok: false, error: 'Falta hoja Trabajos.' };
    const trabajo = getSheetDataAsObjects('Trabajos').find(function (r) { return String(r.id || '').trim() === id; });
    if (!trabajo) return { ok: false, error: 'Servicio no encontrado: ' + id };
    if (String(trabajo.destino || '').toUpperCase() !== 'TERCERO') {
      return { ok: false, error: 'Los trabajos propios no generan cuentas por cobrar.' };
    }

    const clienteId = String(trabajo.clienteId || '').trim();
    const clientePendiente = !clienteId || finParseBool_2026(trabajo.clientePendiente, false);
    if (clientePendiente || !clienteId) {
      return {
        ok: false,
        error: 'Este servicio no tiene un cliente asignado en el catálogo. Asigne el cliente desde Administración → Cuentas por cobrar antes de registrar cobros.'
      };
    }

    const monedaCobro = normalizarMonedaCobro_2026(p.monedaCobro || p.moneda || 'USD');
    const montoOriginalRaw = Number(String(p.importeOriginal ?? p.importe ?? '').trim().replace(',', '.'));
    if (!Number.isFinite(montoOriginalRaw) || montoOriginalRaw <= 0) {
      return { ok: false, error: 'El importe del cobro debe ser un número mayor a cero.' };
    }

    const arRes = arRegistrarCobro_2026({
      clienteId: clienteId,
      fecha: p.fecha,
      monedaPago: monedaCobro,
      tcAplicado: p.tc !== undefined ? p.tc : p.tipoCambio,
      observacion: String(p.observacion || '').trim(),
      idempotencyKey: String(p.idempotencyKey || '').trim(),
      aplicaciones: [{
        deudaTipo: 'TRABAJO',
        deudaId: id,
        importeOriginalPagado: redondear2_2026(montoOriginalRaw)
      }]
    }, userSession);

    if (!arRes || !arRes.ok) return arRes;

    const estadoNuevo = cobrosEstado_2026(id);
    return {
      ok: true,
      result: {
        pago: arRes.payment,
        cuenta: estadoNuevo.ok ? estadoNuevo.result : null,
        receipt: arRes.receipt || null
      }
    };
  } catch (err) {
    return { ok: false, error: err.message };
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
const COSECHA_EXTRA_COLS_2026=['unidad','actualizadoEn','idempotencyKey'];
const PRECIO_CAMPOS_2026=['id','cosechaId','fecha','campanaId','toneladas','precioUsdTon','importeUsd','tc','movimientoId','creadoPor','creadoEn'];
const DISTRIBUCIONES_VENTA_CAMPOS_2026=[
  'id','ventaId','cosechaId','loteId','campanaId','producto','unidad',
  'toneladasAsignadas','participacionPct','precioUnitario','importeAsignado',
  'moneda','tcHistorico','movimientoId','anulada','creadoEn','actualizadoEn'
];

function almacenNormalizarProducto_2026(producto) {
  return String(producto || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function almacenNormalizarUnidad_2026(rawUnit) {
  const cleaned = String(rawUnit || 't')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\.$/, '');
  if (!cleaned || cleaned === 't' || cleaned === 'tn' || cleaned === 'tm' || cleaned === 'ton' || cleaned === 'tons' || cleaned === 'tonelada' || cleaned === 'toneladas') {
    return { canonicalUnit: 't', family: 'mass', factor: 1 };
  }
  if (cleaned === 'kg' || cleaned === 'kilo' || cleaned === 'kilos' || cleaned === 'kilogramo' || cleaned === 'kilogramos') {
    return { canonicalUnit: 't', family: 'mass', factor: 0.001 };
  }
  if (cleaned === 'qq' || cleaned === 'quintal' || cleaned === 'quintales') {
    return { canonicalUnit: 't', family: 'mass', factor: 0.046 };
  }
  return { canonicalUnit: cleaned, family: 'other', factor: 1 };
}

function almacenRedondearQty4_2026(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round((v + Number.EPSILON) * 10000) / 10000;
}

function almacenRedondearTons6_2026(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round((v + Number.EPSILON) * 1000000) / 1000000;
}

function almacenRecalcularImportesDistribucion_2026(dists, precioPendiente, precioUnitario, moneda, tc) {
  const list = Array.isArray(dists) ? dists : [];
  const totalQty = almacenRedondearQty4_2026(list.reduce(function (s, d) { return s + (Number(d.toneladasAsignadas) || 0); }, 0));
  const precio = precioPendiente ? 0 : (Number(precioUnitario) || 0);
  const totalCents = precioPendiente || precio <= 0 ? 0 : Math.round(redondear2_2026(totalQty * precio) * 100);
  const SCALE = 10000;
  const units = list.map(function (d) { return Math.max(0, Math.round((Number(d.toneladasAsignadas) || 0) * SCALE)); });
  const totalUnits = units.reduce(function (s, u) { return s + u; }, 0);

  const cents = list.map(function () { return 0; });
  if (!precioPendiente && totalCents > 0 && totalUnits > 0) {
    const exactCents = units.map(function (u) { return (totalCents * u) / totalUnits; });
    for (let i = 0; i < list.length; i++) cents[i] = Math.floor(exactCents[i]);
    let rem = totalCents - cents.reduce(function (s, c) { return s + c; }, 0);
    const order = list.map(function (d, idx) {
      return { idx: idx, frac: exactCents[idx] - Math.floor(exactCents[idx]), units: units[idx], id: String(d.cosechaId || d.id || idx) };
    }).sort(function (a, b) {
      if (Math.abs(b.frac - a.frac) > 1e-12) return b.frac - a.frac;
      if (b.units !== a.units) return b.units - a.units;
      return a.id.localeCompare(b.id);
    });
    for (let i = 0; i < order.length && rem > 0; i++) {
      cents[order[i].idx] += 1;
      rem -= 1;
    }
  }

  // Recalcular porcentajes exactos que sumen 100.00%
  const pctBp = list.map(function () { return 0; });
  if (totalUnits > 0) {
    const exactBp = units.map(function (u) { return (10000 * u) / totalUnits; });
    for (let i = 0; i < list.length; i++) pctBp[i] = Math.floor(exactBp[i]);
    let remBp = 10000 - pctBp.reduce(function (s, v) { return s + v; }, 0);
    const pctOrder = list.map(function (d, idx) {
      return { idx: idx, frac: exactBp[idx] - Math.floor(exactBp[idx]), id: String(d.cosechaId || d.id || idx) };
    }).sort(function (a, b) {
      if (Math.abs(b.frac - a.frac) > 1e-12) return b.frac - a.frac;
      return a.id.localeCompare(b.id);
    });
    for (let i = 0; i < pctOrder.length && remBp > 0; i++) {
      pctBp[pctOrder[i].idx] += 1;
      remBp -= 1;
    }
  }

  return list.map(function (d, idx) {
    return {
      ...d,
      participacionPct: pctBp[idx] / 100,
      precioUnitario: precio,
      importeAsignado: cents[idx] / 100,
      moneda: moneda === 'BOB' ? 'BOB' : 'USD',
      tcHistorico: Number(tc) > 0 ? Number(tc) : 6.96
    };
  });
}

function almacenCalcularDistribucionProporcional_2026(cosechasDisponibles, cantidad, precioPendiente, precioUnitario, moneda, tc) {
  const qty = almacenRedondearQty4_2026(cantidad);
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('La cantidad vendida debe ser mayor a cero.');

  const eligible = (cosechasDisponibles || [])
    .filter(function (h) { return h && Number(h.pendiente || 0) > 0.0001; })
    .map(function (h) {
      return {
        ...h,
        pendiente: almacenRedondearQty4_2026(h.pendiente),
        unidad: almacenNormalizarUnidad_2026(h.unidad).canonicalUnit
      };
    })
    .sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });

  if (eligible.length === 0) {
    throw new Error('No existe stock disponible en almacén para el producto seleccionado.');
  }

  const totalAvail = almacenRedondearQty4_2026(eligible.reduce(function (s, h) { return s + h.pendiente; }, 0));
  if (qty > totalAvail + 0.0001) {
    throw new Error('La cantidad (' + qty + ') supera el stock disponible en almacén (' + totalAvail + ').');
  }

  const SCALE = 10000;
  const targetUnits = Math.round(qty * SCALE);
  const caps = eligible.map(function (h) { return Math.round(h.pendiente * SCALE); });
  const totalCapUnits = caps.reduce(function (s, c) { return s + c; }, 0);
  if (targetUnits > totalCapUnits) {
    throw new Error('La cantidad (' + qty + ') supera el stock disponible en almacén (' + (totalCapUnits / SCALE) + ').');
  }

  const exactShares = eligible.map(function (_, idx) { return (targetUnits * caps[idx]) / totalCapUnits; });
  const allocUnits = exactShares.map(function (val, idx) { return Math.min(caps[idx], Math.floor(val)); });
  let remainder = targetUnits - allocUnits.reduce(function (s, u) { return s + u; }, 0);

  if (remainder > 0) {
    const order = eligible.map(function (h, idx) {
      return { idx: idx, frac: exactShares[idx] - Math.floor(exactShares[idx]), cap: caps[idx], id: String(h.id) };
    }).sort(function (a, b) {
      if (Math.abs(b.frac - a.frac) > 1e-12) return b.frac - a.frac;
      if (b.cap !== a.cap) return b.cap - a.cap;
      return a.id.localeCompare(b.id);
    });
    let guard = 0;
    while (remainder > 0 && guard < 10) {
      let progressed = false;
      for (let i = 0; i < order.length && remainder > 0; i++) {
        const idx = order[i].idx;
        if (allocUnits[idx] < caps[idx]) {
          allocUnits[idx] += 1;
          remainder -= 1;
          progressed = true;
        }
      }
      if (!progressed) break;
      guard += 1;
    }
  }

  const rawRows = [];
  for (let i = 0; i < eligible.length; i++) {
    if (allocUnits[i] <= 0) continue;
    const h = eligible[i];
    rawRows.push({
      cosechaId: String(h.id),
      loteId: String(h.loteId || ''),
      campanaId: String(h.campanaId || ''),
      producto: String(h.producto || ''),
      unidad: h.unidad,
      toneladasAsignadas: allocUnits[i] / SCALE
    });
  }

  return almacenRecalcularImportesDistribucion_2026(rawRows, precioPendiente, precioUnitario, moneda, tc);
}

function almacenResumenOrigen_2026(dists, lotesMap, fallbackLoteId) {
  const list = Array.isArray(dists) ? dists.filter(function (d) { return d && !d.anulada && Number(d.toneladasAsignadas || 0) > 0; }) : [];
  const seen = {};
  const names = [];
  list.forEach(function (d) {
    const lid = String(d.loteId || '').trim();
    const nm = (lid && lotesMap[lid] && lotesMap[lid].nombre) ? String(lotesMap[lid].nombre).trim() : (d.loteNombre || lid);
    if (nm && !seen[nm]) {
      seen[nm] = true;
      names.push(nm);
    }
  });
  if (names.length === 0 && fallbackLoteId) {
    const fb = lotesMap[String(fallbackLoteId)] && lotesMap[String(fallbackLoteId)].nombre;
    return fb ? String(fb).trim() : '';
  }
  if (names.length <= 2) return names.join(' · ');
  return names.length + ' lotes';
}

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
  const cs=getSheetDataAsObjects('Cosechas');
  const allSales=findSheetIgnoreCase_('AsignacionesPrecio') ? getSheetDataAsObjects('AsignacionesPrecio') : [];
  const invalidSaleIds={};
  const validSales=[];
  allSales.forEach(function(a){
    const sid=String(a.id||'').trim();
    if(!sid) return;
    const estReg=String(a.estadoRegistro||'').trim().toUpperCase();
    if(finParseBool_2026(a.anulada,false) || estReg==='PENDIENTE'){
      invalidSaleIds[sid]=true;
    } else {
      validSales.push(a);
    }
  });

  const distRows=findSheetIgnoreCase_('DistribucionesVenta') ? getSheetDataAsObjects('DistribucionesVenta') : [];
  const committedByHarvest={};
  const salesCoveredByDist={};
  const distsByHarvest={};

  distRows.forEach(function(d){
    if(finParseBool_2026(d.anulada,false)) return;
    const vid=String(d.ventaId||'').trim();
    if(vid && invalidSaleIds[vid]) return;
    const cid=String(d.cosechaId||'').trim();
    const qty=Number(d.toneladasAsignadas||0);
    if(!cid || !Number.isFinite(qty) || qty<=0) return;
    if(vid) salesCoveredByDist[vid]=true;
    committedByHarvest[cid]=almacenRedondearTons6_2026((committedByHarvest[cid]||0)+qty);
    if(!distsByHarvest[cid]) distsByHarvest[cid]=[];
    distsByHarvest[cid].push(d);
  });

  // Compatibilidad heredada: ventas válidas aún sin filas en DistribucionesVenta
  validSales.forEach(function(a){
    const sid=String(a.id||'').trim();
    if(sid && salesCoveredByDist[sid]) return;
    const cid=String(a.cosechaId||'').trim();
    const qty=Number(a.toneladas||0);
    if(!cid || !Number.isFinite(qty) || qty<=0) return;
    committedByHarvest[cid]=almacenRedondearTons6_2026((committedByHarvest[cid]||0)+qty);
  });

  return cs.map(function(c){
    const cid=String(c.id||'').trim();
    const asignaciones=validSales.filter(function(a){ return String(a.cosechaId)===cid; });
    const unitInfo=almacenNormalizarUnidad_2026(c.unidad);
    const toneladas=almacenRedondearTons6_2026(Number(c.toneladas)||0);
    const asignadas=almacenRedondearTons6_2026(committedByHarvest[cid]||0);
    const pendiente=Math.max(0,almacenRedondearTons6_2026(toneladas-asignadas));
    return {...c,unidad:unitInfo.canonicalUnit,toneladas,asignadas,pendiente,asignaciones,distribuciones:distsByHarvest[cid]||[]};
  });
}
function cosechasListar_2026(p){
  let r=cosechasResumen_2026();
  if(p&&p.campanaId)r=r.filter(c=>String(c.campanaId)===String(p.campanaId));
  if(p&&p.soloPendientes)r=r.filter(c=>c.pendiente>0.0001);
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
    asegurarColumnasOpcionales_2026(sh,COSECHA_EXTRA_COLS_2026);

    const idem=String((p&&p.idempotencyKey)||'').trim();
    if(idem){
      const dup=cosechasResumen_2026().find(function(c){ return String(c.idempotencyKey||'').trim()===idem; });
      if(dup) return {ok:true,result:dup,cosecha:dup};
    }

    const producto=String(p.producto||'').trim();
    if(!producto) throw new Error('Indique el producto o concepto cosechado.');
    const rawQty=cosechasNumero_2026(p.toneladas!==undefined?p.toneladas:p.cantidad,'Cantidad cosechada');
    const unitInfo=almacenNormalizarUnidad_2026(p.unidad);
    const canonicalQty=almacenRedondearQty4_2026(rawQty*unitInfo.factor);
    if(canonicalQty<=0) throw new Error('La cantidad cosechada debe ser mayor a cero.');

    const fecha=validarFechaIso_2026(p.fecha,getBoliviaTodayStr_());
    const ahora=new Date().toISOString();
    const usuario=String(userSession&&userSession.usuarioId||'operador');
    const x={
      id:Utilities.getUuid(),
      fecha:fecha,
      campanaId:String(p.campanaId),
      loteId:String(p.loteId),
      producto:producto,
      unidad:unitInfo.canonicalUnit,
      toneladas:canonicalQty,
      observacion:String(p.observacion||'').trim(),
      creadoPor:usuario,
      creadoEn:ahora,
      actualizadoEn:ahora,
      idempotencyKey:idem
    };
    finAppendObj_2026(sh,x);
    SpreadsheetApp.flush();
    logAudit_(usuario,'CREATE','Cosechas',x.id,producto+' | '+canonicalQty+' '+unitInfo.canonicalUnit);
    return {ok:true,result:{...x,asignadas:0,pendiente:x.toneladas,asignaciones:[]},cosecha:{...x,asignadas:0,pendiente:x.toneladas,asignaciones:[]}};
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
    asegurarColumnasOpcionales_2026(sh, COSECHA_EXTRA_COLS_2026);

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
    const oldCampanaId = String(oldRow[m['campanaid']] || '').trim();
    const oldLoteId = String(oldRow[m['loteid']] || '').trim();
    const oldProducto = String(oldRow[m['producto']] || '').trim();
    const oldUnidad = almacenNormalizarUnidad_2026(m['unidad'] !== undefined ? oldRow[m['unidad']] : 't').canonicalUnit;
    const oldToneladas = Number(oldRow[m['toneladas']]) || 0;
    const oldObservacion = String(oldRow[m['observacion']] || '');

    const finalFecha = validarFechaIso_2026(data.fecha, oldFecha);
    const finalCampanaId = data.campanaId !== undefined ? String(data.campanaId).trim() : oldCampanaId;
    const finalLoteId = data.loteId !== undefined ? String(data.loteId).trim() : oldLoteId;
    const finalProducto = data.producto !== undefined ? String(data.producto).trim() : oldProducto;
    const unitInfo = data.unidad !== undefined ? almacenNormalizarUnidad_2026(data.unidad) : almacenNormalizarUnidad_2026(oldUnidad);
    const finalUnidad = unitInfo.canonicalUnit;
    const qtyProvided = data.toneladas !== undefined ? data.toneladas : data.cantidad;
    const rawQty = qtyProvided !== undefined
      ? cosechasNumero_2026(qtyProvided, 'Cantidad')
      : oldToneladas;
    const finalToneladas = qtyProvided !== undefined
      ? almacenRedondearQty4_2026(rawQty * (data.unidad !== undefined ? unitInfo.factor : 1))
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

    // Verificar toneladas ya comprometidas en DistribucionesVenta y/o AsignacionesPrecio activas
    const summaryItem = cosechasResumen_2026().find(function (c) { return String(c.id) === id; });
    const asignadas = summaryItem ? Number(summaryItem.asignadas || 0) : 0;
    const asignaciones = summaryItem ? (summaryItem.asignaciones || []) : [];

    if (asignadas > 0.0001 && (finalCampanaId !== oldCampanaId || finalLoteId !== oldLoteId || almacenNormalizarProducto_2026(finalProducto) !== almacenNormalizarProducto_2026(oldProducto) || finalUnidad !== oldUnidad)) {
      throw new Error('Una cosecha con cantidades ya vendidas o comprometidas no puede cambiar de campaña, lote, producto o unidad.');
    }

    if (finalToneladas + 0.000001 < asignadas) {
      throw new Error(
        'No se puede reducir la cantidad (' + finalToneladas + ' ' + finalUnidad + ') por debajo de las cantidades ya comprometidas en ventas (' + asignadas + ' ' + finalUnidad + ').'
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
    if (m['unidad'] !== undefined) newRow[m['unidad']] = finalUnidad;
    if (m['actualizadoen'] !== undefined) newRow[m['actualizadoen']] = ahora;

    sh.getRange(rowIdx, 1, 1, newRow.length).setValues([newRow]);
    SpreadsheetApp.flush();

    const usuario = String((userSession && userSession.usuarioId) || 'admin');
    logAudit_(
      usuario,
      'UPDATE',
      'Cosechas',
      id,
      finalProducto + ' | ' + finalToneladas + ' ' + finalUnidad + ' (comprometidas: ' + asignadas + ')'
    );

    const pendiente = Math.max(0, almacenRedondearTons6_2026(finalToneladas - asignadas));
    return {
      ok: true,
      result: {
        id: id,
        fecha: finalFecha,
        campanaId: finalCampanaId,
        loteId: finalLoteId,
        producto: finalProducto,
        unidad: finalUnidad,
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
function cosechasEliminar_2026(p, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const id = String((p && (p.id || p.cosechaId)) || '').trim();
    if (!id) throw new Error('Se requiere el ID de la cosecha a eliminar.');

    const sh = cosechasHoja_2026('Cosechas', COSECHA_CAMPOS_2026);
    const rows = sh.getDataRange().getValues();
    if (rows.length < 2) throw new Error('Cosecha no encontrada.');
    const m = getHeaderIndexMap_(rows[0]);

    let targetRow = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][m['id']] || '').trim() === id) {
        targetRow = i + 1;
        break;
      }
    }
    if (targetRow === -1) throw new Error('Cosecha no encontrada: ' + id);

    const summaryItem = cosechasResumen_2026().find(function (c) { return String(c.id) === id; });
    const committed = summaryItem ? Number(summaryItem.asignadas || 0) : 0;
    if (committed > 0.0001) {
      throw new Error('No se puede eliminar esta cosecha porque tiene ' + committed + ' t comprometidas en ventas o distribuciones activas.');
    }

    sh.deleteRow(targetRow);
    SpreadsheetApp.flush();
    logAudit_(userSession && userSession.usuarioId, 'DELETE', 'Cosechas', id, 'Cosecha eliminada');
    return { ok: true, result: { id: id, deleted: true } };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

// Endpoint heredado endurecido: enruta siempre a ventasCosechaCrear_2026
// para aplicar todas las validaciones financieras vigentes (anulada, estado, moneda, catálogo, idempotencia).
function cosechasAsignarPrecio_2026(p, userSession) {
  const req = p || {};
  const cantidad = req.cantidad !== undefined ? req.cantidad : req.toneladas;
  const precio = req.precioUnitario !== undefined ? req.precioUnitario : req.precioUsdTon;
  const res = ventasCosechaCrear_2026({
    cosechaId: req.cosechaId,
    fecha: req.fecha,
    campanaId: req.campanaId,
    cantidad: cantidad,
    toneladas: cantidad,
    precioUnitario: precio,
    moneda: req.moneda || 'USD',
    tc: req.tc !== undefined ? req.tc : req.tipoCambio,
    clienteId: req.clienteId || '',
    compradorPendiente: req.compradorPendiente !== undefined ? req.compradorPendiente : !String(req.clienteId || '').trim(),
    precioPendiente: false,
    plazoDias: req.plazoDias,
    fechaVencimiento: req.fechaVencimiento,
    aplicarInteres: req.aplicarInteres,
    tasaInteresMensual: req.tasaInteresMensual,
    observacion: req.observacion || '',
    idempotencyKey: req.idempotencyKey || ''
  }, userSession);
  if (!res || !res.ok) return res;
  return { ok: true, result: res.result, sale: res.sale };
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
    const total=Number(String(p.importe ?? '').trim().replace(',','.'));
    if(!Number.isFinite(total)||total<=0||Math.abs(Math.round(total*100)-total*100)>0.0001)
      throw new Error('Indique un importe positivo con máximo dos decimales.');
    const monedaRaw=String(p.moneda||'USD').trim().toUpperCase();
    if(!['USD','BOB','BS','BS.'].includes(monedaRaw))throw new Error('Moneda inválida.');
    const moneda=monedaRaw==='USD'?'USD':'BOB';
    const tc=resolverTipoCambioOperacion_2026(p.tc ?? p.tipoCambio);
    const campanaId=String(p.campanaId||'');
    if(!getSheetDataAsObjects('Campanas').some(c=>String(c.id)===campanaId))
      throw new Error('Campaña inválida.');
    const descripcion=String(p.descripcion||'').trim();
    if(!descripcion)throw new Error('Indique el concepto del gasto.');
    const fecha=validarFechaIso_2026(p.fecha,getBoliviaTodayStr_());
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

// =============================================================
// MÓDULO FINANCIERO 2026: CLIENTES, CONFIGURACIÓN DE COBROS,
// VENTAS DE COSECHA, CUENTAS POR COBRAR, INTERÉS POR MORA,
// NOTAS DE DÉBITO, NOTAS DE COBRO Y MIGRACIÓN NO DESTRUCTIVA
// =============================================================

const VENTA_COSECHA_EXTRA_COLS_2026 = [
  'loteId', 'producto', 'unidad', 'clienteId', 'clienteNombre', 'compradorPendiente',
  'precioUnitario', 'moneda', 'importeTotal', 'precioPendiente',
  'plazoDias', 'fechaVencimiento', 'fechaCompletado', 'aplicarInteres', 'tasaInteresMensual',
  'observacion', 'estado', 'anulada', 'actualizadoEn', 'idempotencyKey',
  'origenResumen', 'estadoRegistro'
];

const COBROS_EXTRA_COLS_2026 = [
  'clienteId', 'clienteNombre', 'tipoPago', 'monedaPago', 'tcAplicado',
  'capitalTotalAplicado', 'interesTotalAplicado', 'monedaTotalesAplicados',
  'capitalAplicadoUsd', 'interesAplicadoUsd', 'capitalAplicadoBob', 'interesAplicadoBob',
  'notaCobroNumero', 'anulado', 'estadoRegistro', 'idempotencyKey'
];

function finParseBool_2026(v, defVal) {
  if (typeof v === 'boolean') return v;
  if (v === undefined || v === null || v === '') return Boolean(defVal);
  const s = String(v).trim().toUpperCase();
  if (s === 'TRUE' || s === '1' || s === 'SI' || s === 'SÍ' || s === 'YES' || s === 'ACTIVO') return true;
  if (s === 'FALSE' || s === '0' || s === 'NO' || s === 'INACTIVO') return false;
  return Boolean(defVal);
}

function finNormName_2026(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function finToIsoDate_2026(val) {
  if (!val) return '';
  if (Object.prototype.toString.call(val) === '[object Date]' && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, BOLIVIA_TZ_, 'yyyy-MM-dd');
  }
  const s = String(val).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    return dmy[3] + '-' + String(dmy[2]).padStart(2, '0') + '-' + String(dmy[1]).padStart(2, '0');
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, BOLIVIA_TZ_, 'yyyy-MM-dd');
  }
  return '';
}

function finAddDaysIso_2026(isoStr, days) {
  const base = finToIsoDate_2026(isoStr);
  if (!base) return '';
  const parts = base.split('-').map(Number);
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  dt.setUTCDate(dt.getUTCDate() + Math.round(Number(days) || 0));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function finDaysDiffIso_2026(startIso, endIso) {
  const a = finToIsoDate_2026(startIso);
  const b = finToIsoDate_2026(endIso);
  if (!a || !b) return 0;
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  const ta = Date.UTC(pa[0], pa[1] - 1, pa[2]);
  const tb = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  return Math.round((tb - ta) / 86400000);
}

function finEnsureSheet_2026(name, columns) {
  let sh = findSheetIgnoreCase_(name);
  if (!sh) {
    sh = SpreadsheetApp.getActiveSpreadsheet().insertSheet(name);
    sh.getRange(1, 1, 1, columns.length).setValues([columns]);
    sh.setFrozenRows(1);
    return sh;
  }
  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
    sh.getRange(1, 1, 1, columns.length).setValues([columns]);
    sh.setFrozenRows(1);
    return sh;
  }
  asegurarColumnasOpcionales_2026(sh, columns);
  return sh;
}

function finAppendObj_2026(sheet, obj) {
  const headers = getSheetHeaders_(sheet);
  const map = getHeaderIndexMap_(headers);
  const row = Array(headers.length).fill('');
  Object.keys(obj).forEach(function (k) {
    const idx = map[String(k).toLowerCase()];
    if (idx !== undefined) row[idx] = obj[k];
  });
  sheet.appendRow(row);
  return row;
}

function finConvertCurrency_2026(amount, fromCur, toCur, tc) {
  const val = Number(amount) || 0;
  const f = String(fromCur || 'USD').toUpperCase() === 'USD' ? 'USD' : 'BOB';
  const t = String(toCur || 'USD').toUpperCase() === 'USD' ? 'USD' : 'BOB';
  if (f === t) return redondear2_2026(val);
  const rate = Number(tc) > 0 ? Number(tc) : 6.96;
  if (f === 'USD' && t === 'BOB') return redondear2_2026(val * rate);
  return redondear2_2026(val / rate);
}

function finNextSequentialNumber_2026(sheetName, prefix) {
  const sh = findSheetIgnoreCase_(sheetName);
  let maxNum = 0;
  if (sh && sh.getLastRow() >= 2) {
    const rows = getSheetDataAsObjects(sheetName);
    rows.forEach(function (r) {
      const numStr = String(r.numero || '').trim();
      const match = numStr.match(/(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (Number.isFinite(n) && n > maxNum) maxNum = n;
      }
    });
  }
  return prefix + '-' + String(maxNum + 1).padStart(5, '0');
}

function finGetActiveCampaignId_2026(fallbackId) {
  const campanas = getSheetDataAsObjects('Campanas');
  const active = campanas.find(function (c) { return finParseBool_2026(c.activa, false); });
  if (active && active.id) return String(active.id);
  if (fallbackId) return String(fallbackId);
  return campanas.length > 0 ? String(campanas[0].id || '') : '';
}

function finResolverCampanaPorFecha_2026(fechaIso, fallbackCampanaId) {
  const targetDate = finToIsoDate_2026(fechaIso) || getBoliviaTodayStr_();
  const campanas = getSheetDataAsObjects('Campanas').filter(function (c) {
    return c && String(c.id || '').trim() !== '';
  });
  if (campanas.length === 0) return String(fallbackCampanaId || '');

  // 1. Prioridad máxima: campañas con rango explícito fechaInicio / fechaFin
  const explicitMatches = [];
  for (let i = 0; i < campanas.length; i++) {
    const c = campanas[i];
    const start = finToIsoDate_2026(c.fechaInicio);
    const end = finToIsoDate_2026(c.fechaFin);
    if (!start && !end) continue;
    const afterStart = !start || targetDate >= start;
    const beforeEnd = !end || targetDate <= end;
    if (afterStart && beforeEnd) {
      explicitMatches.push({
        id: String(c.id).trim(),
        start: start || '0000-01-01',
        hasEnd: Boolean(end),
        creadoEn: String(c.creadoEn || '')
      });
    }
  }
  if (explicitMatches.length > 0) {
    explicitMatches.sort(function (a, b) {
      if (a.start !== b.start) return a.start > b.start ? -1 : 1;
      if (a.hasEnd !== b.hasEnd) return a.hasEnd ? -1 : 1;
      return b.creadoEn.localeCompare(a.creadoEn);
    });
    return explicitMatches[0].id;
  }

  // 2. Segunda prioridad: periodo/año inferido desde el nombre de la campaña (ej. "Campaña 2025", "Verano 2025-2026")
  const targetYear = parseInt(targetDate.slice(0, 4), 10);
  const nameMatches = [];
  for (let i = 0; i < campanas.length; i++) {
    const c = campanas[i];
    const nombre = String(c.nombre || '').trim();
    const normNombre = finNormName_2026(nombre);
    const createdIso = finToIsoDate_2026(c.creadoEn);
    const rangeMatch = nombre.match(/\b(20\d{2})\s*[-\/]\s*(20\d{2})\b/);
    if (rangeMatch) {
      const y1 = parseInt(rangeMatch[1], 10);
      const y2 = parseInt(rangeMatch[2], 10);
      const infStart = normNombre.indexOf('verano') !== -1 ? (y1 + '-10-01') : (y1 + '-01-01');
      const infEnd = normNombre.indexOf('verano') !== -1 ? (y2 + '-04-30') : (y2 + '-12-31');
      if (targetDate >= infStart && targetDate <= infEnd) {
        nameMatches.push({
          id: String(c.id).trim(),
          specificity: normNombre.indexOf('verano') !== -1 ? 3 : 1,
          createdOk: Boolean(createdIso && createdIso <= targetDate),
          createdIso: createdIso || '0000-01-01',
          activa: finParseBool_2026(c.activa, false)
        });
      }
      continue;
    }
    const singleMatch = nombre.match(/\b(20\d{2})\b/);
    if (singleMatch) {
      const y = parseInt(singleMatch[1], 10);
      if (y === targetYear) {
        const isInvierno = normNombre.indexOf('invierno') !== -1;
        const infStart = isInvierno ? (y + '-04-01') : (y + '-01-01');
        const infEnd = isInvierno ? (y + '-10-31') : (y + '-12-31');
        if (targetDate >= infStart && targetDate <= infEnd) {
          nameMatches.push({
            id: String(c.id).trim(),
            specificity: isInvierno ? 3 : 2,
            createdOk: Boolean(createdIso && createdIso <= targetDate),
            createdIso: createdIso || '0000-01-01',
            activa: finParseBool_2026(c.activa, false)
          });
        }
      }
    }
  }
  if (nameMatches.length > 0) {
    nameMatches.sort(function (a, b) {
      if (a.specificity !== b.specificity) return b.specificity - a.specificity;
      if (a.createdOk !== b.createdOk) return a.createdOk ? -1 : 1;
      if (a.createdIso !== b.createdIso) return a.createdIso > b.createdIso ? -1 : 1;
      if (a.activa !== b.activa) return a.activa ? -1 : 1;
      return 0;
    });
    return nameMatches[0].id;
  }

  // 3. Tercera prioridad: cronología de creadoEn (la campaña vigente en la fecha efectiva de cobro)
  const chronoMatches = [];
  for (let i = 0; i < campanas.length; i++) {
    const c = campanas[i];
    const createdIso = finToIsoDate_2026(c.creadoEn);
    if (createdIso && createdIso <= targetDate) {
      chronoMatches.push({ id: String(c.id).trim(), createdIso: createdIso, creadoEn: String(c.creadoEn || '') });
    }
  }
  if (chronoMatches.length > 0) {
    chronoMatches.sort(function (a, b) {
      if (a.createdIso !== b.createdIso) return a.createdIso > b.createdIso ? -1 : 1;
      return b.creadoEn.localeCompare(a.creadoEn);
    });
    return chronoMatches[0].id;
  }

  // 4. Respaldo: campaña de origen de la deuda si existe en Campanas, o campaña activa
  const fb = String(fallbackCampanaId || '').trim();
  if (fb && campanas.some(function (c) { return String(c.id).trim() === fb; })) {
    return fb;
  }
  return finGetActiveCampaignId_2026(fb);
}

function finEnsureInterestConcept_2026() {
  const sh = findSheetIgnoreCase_('Items');
  if (!sh) return false;
  const rows = getSheetDataAsObjects('Items');
  const exists = rows.some(function (r) { return String(r.id || '').trim() === 'SYS_INTERES_MORA'; });
  if (exists) return false;
  finAppendObj_2026(sh, {
    id: 'SYS_INTERES_MORA',
    nombre: 'Interés por mora',
    modulo: 'MAQUINARIAS',
    clase: 'INGRESO',
    icono: 'Percent',
    unidad: '',
    precio: 0,
    moneda: 'USD',
    activo: true
  });
  return true;
}

// -------------------------------------------------------------
// 1. CATÁLOGO DE CLIENTES (Hoja Clientes)
// -------------------------------------------------------------

function clientesBuscarPorId_2026(id) {
  const cleanId = String(id || '').trim();
  if (!cleanId) return null;
  const sh = findSheetIgnoreCase_('Clientes');
  if (!sh) return null;
  const rows = getSheetDataAsObjects('Clientes');
  const found = rows.find(function (c) { return String(c.id || '').trim() === cleanId; });
  if (!found) return null;
  return {
    id: String(found.id).trim(),
    nombre: String(found.nombre || '').trim(),
    telefono: String(found.telefono || '').trim(),
    direccion: String(found.direccion || '').trim(),
    activo: finParseBool_2026(found.activo, true),
    creadoEn: found.creadoEn ? String(found.creadoEn) : '',
    actualizadoEn: found.actualizadoEn ? String(found.actualizadoEn) : ''
  };
}

function clientesListar_2026(p) {
  const sh = finEnsureSheet_2026('Clientes', SHEET_SCHEMAS.Clientes);
  const rows = getSheetDataAsObjects(sh.getName());
  const list = rows
    .filter(function (r) { return String(r.id || '').trim() !== '' && String(r.nombre || '').trim() !== ''; })
    .map(function (r) {
      return {
        id: String(r.id).trim(),
        nombre: String(r.nombre || '').trim(),
        telefono: String(r.telefono || '').trim(),
        direccion: String(r.direccion || '').trim(),
        activo: finParseBool_2026(r.activo, true),
        creadoEn: r.creadoEn ? String(r.creadoEn) : '',
        actualizadoEn: r.actualizadoEn ? String(r.actualizadoEn) : ''
      };
    })
    .sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
  return { ok: true, result: list, customers: list, clientes: list };
}

function clientesCrear_2026(p, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = finEnsureSheet_2026('Clientes', SHEET_SCHEMAS.Clientes);
    const nombre = String((p && p.nombre) || '').trim().replace(/\s+/g, ' ');
    if (!nombre) return { ok: false, error: 'El nombre del cliente es obligatorio.' };
    const normNew = finNormName_2026(nombre);
    const existing = getSheetDataAsObjects(sh.getName());
    if (existing.some(function (c) { return finNormName_2026(c.nombre) === normNew; })) {
      return { ok: false, error: 'Ya existe un cliente registrado con ese nombre.' };
    }
    const ahora = new Date().toISOString();
    const record = {
      id: 'CLI-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
      nombre: nombre,
      telefono: String((p && p.telefono) || '').trim(),
      direccion: String((p && p.direccion) || '').trim(),
      activo: true,
      creadoEn: ahora,
      actualizadoEn: ahora
    };
    finAppendObj_2026(sh, record);
    SpreadsheetApp.flush();
    logAudit_(userSession && userSession.usuarioId, 'CREATE', 'Clientes', record.id, 'Cliente creado: ' + nombre);
    return { ok: true, result: record, customer: record };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function clientesActualizar_2026(p, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const id = String((p && p.id) || '').trim();
    if (!id) return { ok: false, error: 'Se requiere el ID del cliente.' };
    const nombre = String((p && p.nombre) || '').trim().replace(/\s+/g, ' ');
    if (!nombre) return { ok: false, error: 'El nombre del cliente es obligatorio.' };

    const sh = finEnsureSheet_2026('Clientes', SHEET_SCHEMAS.Clientes);
    const vals = sh.getDataRange().getValues();
    if (vals.length < 2) return { ok: false, error: 'Cliente no encontrado.' };
    const m = getHeaderIndexMap_(vals[0]);
    const normNew = finNormName_2026(nombre);

    let targetRow = -1;
    for (let i = 1; i < vals.length; i++) {
      const rowId = String(vals[i][m['id']] || '').trim();
      if (rowId === id) {
        targetRow = i + 1;
      } else if (finNormName_2026(vals[i][m['nombre']]) === normNew) {
        return { ok: false, error: 'Ya existe otro cliente con ese nombre.' };
      }
    }
    if (targetRow === -1) return { ok: false, error: 'Cliente no encontrado.' };

    const ahora = new Date().toISOString();
    const row = vals[targetRow - 1].slice();
    row[m['nombre']] = nombre;
    row[m['telefono']] = String((p && p.telefono) || '').trim();
    row[m['direccion']] = String((p && p.direccion) || '').trim();
    if (p && p.activo !== undefined) row[m['activo']] = finParseBool_2026(p.activo, true);
    row[m['actualizadoen']] = ahora;

    sh.getRange(targetRow, 1, 1, row.length).setValues([row]);
    SpreadsheetApp.flush();
    logAudit_(userSession && userSession.usuarioId, 'UPDATE', 'Clientes', id, 'Cliente actualizado: ' + nombre);
    const updated = {
      id: id,
      nombre: nombre,
      telefono: row[m['telefono']],
      direccion: row[m['direccion']],
      activo: finParseBool_2026(row[m['activo']], true),
      creadoEn: String(row[m['creadoen']] || ''),
      actualizadoEn: ahora
    };
    return { ok: true, result: updated, customer: updated };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function clientesToggle_2026(p, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const id = String((p && p.id) || '').trim();
    if (!id) return { ok: false, error: 'Se requiere el ID del cliente.' };
    const sh = finEnsureSheet_2026('Clientes', SHEET_SCHEMAS.Clientes);
    const vals = sh.getDataRange().getValues();
    if (vals.length < 2) return { ok: false, error: 'Cliente no encontrado.' };
    const m = getHeaderIndexMap_(vals[0]);

    let targetRow = -1;
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][m['id']] || '').trim() === id) {
        targetRow = i + 1;
        break;
      }
    }
    if (targetRow === -1) return { ok: false, error: 'Cliente no encontrado.' };

    const newActivo = finParseBool_2026(p.activo, !finParseBool_2026(vals[targetRow - 1][m['activo']], true));
    const ahora = new Date().toISOString();
    sh.getRange(targetRow, m['activo'] + 1).setValue(newActivo);
    sh.getRange(targetRow, m['actualizadoen'] + 1).setValue(ahora);
    SpreadsheetApp.flush();
    logAudit_(userSession && userSession.usuarioId, 'TOGGLE', 'Clientes', id, 'Estado activo: ' + newActivo);
    const updated = clientesBuscarPorId_2026(id);
    return { ok: true, result: updated, customer: updated };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function clientesTieneVinculos_2026(clienteId) {
  const cid = String(clienteId || '').trim();
  if (!cid) return false;
  const checkSheet = function (sheetName, col) {
    const sh = findSheetIgnoreCase_(sheetName);
    if (!sh) return false;
    return getSheetDataAsObjects(sheetName).some(function (r) {
      return String(r[col] || '').trim() === cid;
    });
  };
  return (
    checkSheet('Trabajos', 'clienteId') ||
    checkSheet('AsignacionesPrecio', 'clienteId') ||
    checkSheet('Cobros', 'clienteId') ||
    checkSheet('CobroAplicaciones', 'clienteId') ||
    checkSheet('NotasDebito', 'clienteId') ||
    checkSheet('NotasCobro', 'clienteId')
  );
}

function clientesEliminar_2026(p, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const id = String((p && p.id) || '').trim();
    if (!id) return { ok: false, error: 'Se requiere el ID del cliente.' };
    const existing = clientesBuscarPorId_2026(id);
    if (!existing) return { ok: false, error: 'Cliente no encontrado.' };
    if (clientesTieneVinculos_2026(id)) {
      return {
        ok: false,
        error: 'Este cliente tiene registros vinculados (servicios, ventas, cobros o notas) y no puede eliminarse. Puedes desactivarlo para conservar el historial.'
      };
    }
    deleteRowByColumn('Clientes', 'id', id);
    SpreadsheetApp.flush();
    logAudit_(userSession && userSession.usuarioId, 'DELETE', 'Clientes', id, 'Cliente eliminado: ' + existing.nombre);
    return { ok: true, result: { deleted: true, id: id }, deleted: true };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

// -------------------------------------------------------------
// 2. CONFIGURACIÓN DE COBROS E INTERÉS POR MORA
// -------------------------------------------------------------

function configCobrosObtener_2026() {
  const rawPlazo = getConfigValue('COBRO_PLAZO_DIAS', '');
  const rawActivo = getConfigValue('COBRO_INTERES_ACTIVO', '');
  const rawTasa = getConfigValue('COBRO_INTERES_MENSUAL', '');
  const rawUpd = getConfigValue('COBRO_CONFIG_ACTUALIZADO', '');

  const plazoNum = rawPlazo !== '' && rawPlazo !== null && rawPlazo !== undefined && !isNaN(Number(rawPlazo))
    ? Math.max(0, Math.round(Number(rawPlazo)))
    : null;
  const tasaNum = rawTasa !== '' && rawTasa !== null && rawTasa !== undefined && !isNaN(Number(rawTasa))
    ? Math.max(0, redondear2_2026(Number(rawTasa)))
    : null;
  const aplicar = finParseBool_2026(rawActivo, false) && tasaNum !== null && tasaNum > 0;
  const configurado = plazoNum !== null || tasaNum !== null || String(rawActivo) !== '';

  const settings = {
    plazoDiasPredeterminado: plazoNum,
    aplicarInteresPorDefecto: aplicar,
    porcentajeInteresMensual: tasaNum,
    configurado: configurado,
    actualizadoEn: rawUpd ? String(rawUpd) : undefined
  };
  return { ok: true, result: settings, settings: settings };
}

function configCobrosGuardar_2026(p, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const rawPlazo = p ? p.plazoDiasPredeterminado : '';
    const plazoVal = rawPlazo !== '' && rawPlazo !== null && rawPlazo !== undefined
      ? Math.max(0, Math.round(Number(String(rawPlazo).replace(',', '.'))))
      : '';
    if (plazoVal !== '' && !Number.isFinite(plazoVal)) {
      return { ok: false, error: 'El plazo predeterminado en días no es válido.' };
    }
    const aplicar = finParseBool_2026(p && p.aplicarInteresPorDefecto, false);
    const rawTasa = p ? p.porcentajeInteresMensual : '';
    const tasaVal = rawTasa !== '' && rawTasa !== null && rawTasa !== undefined
      ? Math.max(0, redondear2_2026(Number(String(rawTasa).replace(',', '.'))))
      : '';
    if (tasaVal !== '' && !Number.isFinite(tasaVal)) {
      return { ok: false, error: 'El porcentaje de interés mensual no es válido.' };
    }
    if (aplicar && (tasaVal === '' || tasaVal <= 0)) {
      return { ok: false, error: 'Si activas el interés por mora predeterminado, ingresa un porcentaje mensual mayor a 0.' };
    }

    const ahora = new Date().toISOString();
    setConfigValue('COBRO_PLAZO_DIAS', plazoVal === '' ? '' : String(plazoVal));
    setConfigValue('COBRO_INTERES_ACTIVO', aplicar ? 'TRUE' : 'FALSE');
    setConfigValue('COBRO_INTERES_MENSUAL', tasaVal === '' ? '' : String(tasaVal));
    setConfigValue('COBRO_CONFIG_ACTUALIZADO', ahora);
    SpreadsheetApp.flush();

    logAudit_(
      userSession && userSession.usuarioId,
      'UPDATE',
      'Configuracion',
      'COBRO_CONFIG',
      'Plazo=' + plazoVal + ', Interes=' + aplicar + ', Tasa=' + tasaVal + '%'
    );
    return configCobrosObtener_2026();
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

// -------------------------------------------------------------
// 3. VENTAS DE COSECHA (Hoja AsignacionesPrecio — Admin)
// -------------------------------------------------------------

function ventasCosechaEstado_2026(compradorPendiente, precioPendiente) {
  if (compradorPendiente && precioPendiente) return 'COMPRADOR_Y_PRECIO_PENDIENTES';
  if (compradorPendiente) return 'COMPRADOR_PENDIENTE';
  if (precioPendiente) return 'PRECIO_PENDIENTE';
  return 'VENTA_COMPLETA';
}

function ventasCosechaResolverCondiciones_2026(opts) {
  const isNew = Boolean(opts && opts.isNew);
  const wasComplete = Boolean(opts && opts.wasComplete);
  const isComplete = Boolean(opts && opts.isComplete);
  const p = (opts && opts.payload) || {};
  const existing = (opts && opts.existing) || {};
  const completionBase = finToIsoDate_2026(opts && opts.completionBaseDate) || getBoliviaTodayStr_();

  // Regla obligatoria: mientras falte comprador del catálogo o precio válido,
  // NO se establece plazo, fecha de vencimiento ni intereses.
  if (!isComplete) {
    return {
      plazoDias: '',
      fechaVencimiento: '',
      fechaCompletado: '',
      aplicarInteres: false,
      tasaInteresMensual: 0
    };
  }

  // Transición a venta completa (nueva venta completa o completado de una venta pendiente):
  // El plazo comienza desde la fecha en que se completa la venta (completionBase),
  // nunca desde la fecha de cosecha ni desde el registro inicial de una venta pendiente.
  if (isNew || !wasComplete) {
    const fechaCompletado = completionBase;
    const hasExplicitPlazo = p.plazoDias !== undefined;
    const hasExplicitVenc = p.fechaVencimiento !== undefined && String(p.fechaVencimiento).trim() !== '';
    const hasExplicitInt = p.aplicarInteres !== undefined;
    const hasExplicitTasa = p.tasaInteresMensual !== undefined;
    const callerSuppliedAny = hasExplicitPlazo || hasExplicitVenc || hasExplicitInt || hasExplicitTasa;

    let plazoDias = '';
    let fechaVencimiento = '';
    let aplicarInteres = false;
    let tasaInteresMensual = 0;

    if (!callerSuppliedAny) {
      // Precargar automáticamente desde Administración -> Configuración de cobros
      const cfgRes = configCobrosObtener_2026();
      const cfg = (cfgRes && cfgRes.result) || {};
      if (cfg.plazoDiasPredeterminado !== null && cfg.plazoDiasPredeterminado !== undefined && cfg.plazoDiasPredeterminado !== '') {
        const dp = Number(cfg.plazoDiasPredeterminado);
        if (Number.isFinite(dp) && dp >= 0) {
          plazoDias = Math.round(dp);
          fechaVencimiento = finAddDaysIso_2026(fechaCompletado, plazoDias);
        }
      }
      aplicarInteres = Boolean(cfg.aplicarInteresPorDefecto);
      const dt = Number(cfg.porcentajeInteresMensual || 0);
      tasaInteresMensual = aplicarInteres && Number.isFinite(dt) && dt > 0 ? redondear2_2026(dt) : 0;
      if (tasaInteresMensual <= 0) aplicarInteres = false;
    } else {
      const rawPlazo = p.plazoDias !== undefined && p.plazoDias !== '' && p.plazoDias !== null
        ? Number(String(p.plazoDias).replace(',', '.'))
        : NaN;
      if (Number.isFinite(rawPlazo) && rawPlazo >= 0) {
        plazoDias = Math.round(rawPlazo);
        fechaVencimiento = p.fechaVencimiento && String(p.fechaVencimiento).trim() !== ''
          ? validarFechaIso_2026(p.fechaVencimiento, finAddDaysIso_2026(fechaCompletado, plazoDias))
          : finAddDaysIso_2026(fechaCompletado, plazoDias);
      } else if (p.fechaVencimiento && String(p.fechaVencimiento).trim() !== '') {
        fechaVencimiento = validarFechaIso_2026(p.fechaVencimiento, fechaCompletado);
        plazoDias = Math.max(0, finDaysDiffIso_2026(fechaCompletado, fechaVencimiento));
      }

      aplicarInteres = finParseBool_2026(p.aplicarInteres, false);
      const rawTasa = Number(String(p.tasaInteresMensual || 0).replace(',', '.'));
      tasaInteresMensual = aplicarInteres && Number.isFinite(rawTasa) && rawTasa > 0 ? redondear2_2026(rawTasa) : 0;
      if (tasaInteresMensual <= 0) aplicarInteres = false;
    }

    return {
      plazoDias: plazoDias,
      fechaVencimiento: fechaVencimiento,
      fechaCompletado: fechaCompletado,
      aplicarInteres: aplicarInteres,
      tasaInteresMensual: tasaInteresMensual
    };
  }

  // Edición de una venta que YA estaba completa:
  // Conservar sus condiciones y fechas originales sin reiniciar automáticamente el plazo.
  const preservedFechaCompletado = finToIsoDate_2026(existing.fechaCompletado) || finToIsoDate_2026(existing.fecha) || completionBase;
  let finalPlazo = existing.plazoDias !== undefined && existing.plazoDias !== '' && existing.plazoDias !== null
    ? Math.max(0, Math.round(Number(existing.plazoDias)))
    : '';
  let finalVenc = finToIsoDate_2026(existing.fechaVencimiento);

  if (p.plazoDias !== undefined || p.fechaVencimiento !== undefined) {
    const rawP = p.plazoDias !== undefined && p.plazoDias !== '' && p.plazoDias !== null
      ? Number(String(p.plazoDias).replace(',', '.'))
      : NaN;
    if (Number.isFinite(rawP) && rawP >= 0) {
      finalPlazo = Math.round(rawP);
      finalVenc = p.fechaVencimiento && String(p.fechaVencimiento).trim() !== ''
        ? validarFechaIso_2026(p.fechaVencimiento, finalVenc || finAddDaysIso_2026(preservedFechaCompletado, finalPlazo))
        : finAddDaysIso_2026(preservedFechaCompletado, finalPlazo);
    } else if (p.fechaVencimiento && String(p.fechaVencimiento).trim() !== '') {
      finalVenc = validarFechaIso_2026(p.fechaVencimiento, finalVenc || preservedFechaCompletado);
      finalPlazo = Math.max(0, finDaysDiffIso_2026(preservedFechaCompletado, finalVenc));
    } else {
      finalPlazo = '';
      finalVenc = '';
    }
  }

  let finalAplicarInt = p.aplicarInteres !== undefined
    ? finParseBool_2026(p.aplicarInteres, false)
    : finParseBool_2026(existing.aplicarInteres, false);
  const rawTasa = p.tasaInteresMensual !== undefined
    ? Number(String(p.tasaInteresMensual || 0).replace(',', '.'))
    : (Number(existing.tasaInteresMensual) || 0);
  const finalTasaInt = finalAplicarInt && Number.isFinite(rawTasa) && rawTasa > 0 ? redondear2_2026(rawTasa) : 0;
  if (finalTasaInt <= 0) finalAplicarInt = false;

  return {
    plazoDias: finalPlazo,
    fechaVencimiento: finalVenc,
    fechaCompletado: preservedFechaCompletado,
    aplicarInteres: finalAplicarInt,
    tasaInteresMensual: finalTasaInt
  };
}

function ventasCosechaMapearDistribucion_2026(raw, lotesMap, campanasMap) {
  const loteId = String(raw.loteId || '').trim();
  const campanaId = String(raw.campanaId || '').trim();
  const rawMon = String(raw.moneda || 'USD').trim().toUpperCase();
  const moneda = rawMon === 'BOB' || rawMon === 'BS' ? 'BOB' : 'USD';
  return {
    id: String(raw.id || '').trim(),
    ventaId: String(raw.ventaId || '').trim(),
    cosechaId: String(raw.cosechaId || '').trim(),
    loteId: loteId,
    loteNombre: (lotesMap[loteId] && lotesMap[loteId].nombre) || '',
    campanaId: campanaId,
    campanaNombre: (campanasMap[campanaId] && campanasMap[campanaId].nombre) || '',
    producto: String(raw.producto || '').trim(),
    unidad: almacenNormalizarUnidad_2026(raw.unidad).canonicalUnit,
    toneladasAsignadas: almacenRedondearQty4_2026(Number(raw.toneladasAsignadas || 0)),
    participacionPct: redondear2_2026(Number(raw.participacionPct || 0)),
    precioUnitario: redondear2_2026(Number(raw.precioUnitario || 0)),
    importeAsignado: redondear2_2026(Number(raw.importeAsignado || 0)),
    moneda: moneda,
    tcHistorico: Number(raw.tcHistorico) > 0 ? Number(raw.tcHistorico) : 6.96,
    movimientoId: String(raw.movimientoId || '').trim(),
    anulada: finParseBool_2026(raw.anulada, false),
    creadoEn: raw.creadoEn ? String(raw.creadoEn) : '',
    actualizadoEn: raw.actualizadoEn ? String(raw.actualizadoEn) : ''
  };
}

function ventasCosechaMapear_2026(raw, cosechasMap, lotesMap, campanasMap, clientesMap, distsByVenta) {
  const saleId = String(raw.id || '').trim();
  const dists = (distsByVenta && distsByVenta[saleId]) ? distsByVenta[saleId] : [];
  const activeDists = dists.filter(function (d) { return !d.anulada && Number(d.toneladasAsignadas || 0) > 0; });

  const cosecha = cosechasMap[String(raw.cosechaId || '')] || {};
  const singleDist = activeDists.length === 1 ? activeDists[0] : null;
  const loteId = String(raw.loteId || (singleDist ? singleDist.loteId : '') || cosecha.loteId || '').trim();
  const campanaId = String(raw.campanaId || (singleDist ? singleDist.campanaId : '') || cosecha.campanaId || '').trim();
  const producto = String(raw.producto || (activeDists[0] ? activeDists[0].producto : '') || cosecha.producto || '').trim();
  const clienteId = String(raw.clienteId || '').trim();
  const clienteObj = clienteId ? clientesMap[clienteId] : null;
  const clienteNombre = clienteObj ? clienteObj.nombre : String(raw.clienteNombre || '').trim();
  const compradorPendiente = raw.compradorPendiente !== undefined && raw.compradorPendiente !== ''
    ? finParseBool_2026(raw.compradorPendiente, !clienteId)
    : !clienteId;

  const cantidad = Number(raw.toneladas || raw.cantidad || 0) || 0;
  const precioRaw = raw.precioUnitario !== undefined && raw.precioUnitario !== ''
    ? Number(raw.precioUnitario)
    : Number(raw.precioUsdTon || 0);
  const precioUnitario = Number.isFinite(precioRaw) ? precioRaw : 0;
  const precioPendiente = raw.precioPendiente !== undefined && raw.precioPendiente !== ''
    ? finParseBool_2026(raw.precioPendiente, precioUnitario <= 0)
    : precioUnitario <= 0;

  const rawMon = String(raw.moneda || 'USD').trim().toUpperCase();
  const moneda = rawMon === 'BOB' || rawMon === 'BS' ? 'BOB' : 'USD';
  const tc = Number(raw.tc) > 0 ? Number(raw.tc) : 6.96;
  const importeTotal = precioPendiente
    ? 0
    : redondear2_2026(
        raw.importeTotal !== undefined && raw.importeTotal !== ''
          ? Number(raw.importeTotal)
          : (raw.importeUsd !== undefined && raw.importeUsd !== '' ? Number(raw.importeUsd) : cantidad * precioUnitario)
      );

  const fecha = finToIsoDate_2026(raw.fecha);
  const estado = ventasCosechaEstado_2026(compradorPendiente, precioPendiente);
  const isComplete = estado === 'VENTA_COMPLETA';
  const plazoDias = isComplete && raw.plazoDias !== undefined && raw.plazoDias !== '' && raw.plazoDias !== null
    ? Math.max(0, Math.round(Number(raw.plazoDias)))
    : '';
  const fechaVencimiento = isComplete && raw.fechaVencimiento ? finToIsoDate_2026(raw.fechaVencimiento) : '';
  const fechaCompletado = isComplete
    ? (raw.fechaCompletado ? finToIsoDate_2026(raw.fechaCompletado) : fecha)
    : '';
  const aplicarInteres = isComplete ? finParseBool_2026(raw.aplicarInteres, false) : false;
  const tasaInteresMensual = aplicarInteres ? (Number(raw.tasaInteresMensual) || 0) : 0;
  const origenResumen = String(raw.origenResumen || '').trim() || almacenResumenOrigen_2026(activeDists, lotesMap, loteId);
  const loteNombre = (lotesMap[loteId] && lotesMap[loteId].nombre) || origenResumen || '';

  return {
    id: saleId,
    cosechaId: String(raw.cosechaId || '').trim(),
    fecha: fecha,
    campanaId: campanaId,
    campanaNombre: (campanasMap[campanaId] && campanasMap[campanaId].nombre) || '',
    loteId: loteId,
    loteNombre: loteNombre,
    origenResumen: origenResumen,
    producto: producto,
    cantidad: cantidad,
    toneladas: cantidad,
    unidad: almacenNormalizarUnidad_2026(raw.unidad || cosecha.unidad || 't').canonicalUnit,
    clienteId: compradorPendiente ? '' : clienteId,
    clienteNombre: compradorPendiente ? '' : clienteNombre,
    compradorPendiente: compradorPendiente,
    precioUnitario: precioPendiente ? 0 : precioUnitario,
    precioPendiente: precioPendiente,
    moneda: moneda,
    tc: tc,
    importeTotal: importeTotal,
    plazoDias: plazoDias,
    fechaVencimiento: fechaVencimiento,
    fechaCompletado: fechaCompletado,
    aplicarInteres: aplicarInteres && tasaInteresMensual > 0,
    tasaInteresMensual: aplicarInteres && tasaInteresMensual > 0 ? tasaInteresMensual : 0,
    observacion: String(raw.observacion || '').trim(),
    movimientoId: String(raw.movimientoId || '').trim(),
    estado: estado,
    estadoComprador: compradorPendiente ? 'PENDIENTE' : 'ASIGNADO',
    estadoPrecio: precioPendiente ? 'PENDIENTE' : 'ASIGNADO',
    anulada: finParseBool_2026(raw.anulada, false),
    distribuciones: activeDists,
    creadoPor: String(raw.creadoPor || ''),
    creadoEn: raw.creadoEn ? String(raw.creadoEn) : '',
    actualizadoEn: raw.actualizadoEn ? String(raw.actualizadoEn) : ''
  };
}

function ventasCosechaListar_2026(p) {
  const shAsig = cosechasHoja_2026('AsignacionesPrecio', PRECIO_CAMPOS_2026);
  asegurarColumnasOpcionales_2026(shAsig, VENTA_COSECHA_EXTRA_COLS_2026);

  const harvests = cosechasResumen_2026();
  const cosechasMap = {};
  harvests.forEach(function (c) { cosechasMap[String(c.id)] = c; });
  const lotesMap = {};
  getSheetDataAsObjects('Lotes').forEach(function (l) { lotesMap[String(l.id)] = l; });
  const campanasMap = {};
  getSheetDataAsObjects('Campanas').forEach(function (c) { campanasMap[String(c.id)] = c; });
  const clientesMap = {};
  if (findSheetIgnoreCase_('Clientes')) {
    getSheetDataAsObjects('Clientes').forEach(function (c) { clientesMap[String(c.id)] = c; });
  }

  const distsByVenta = {};
  const allDistributions = [];
  if (findSheetIgnoreCase_('DistribucionesVenta')) {
    getSheetDataAsObjects('DistribucionesVenta').forEach(function (r) {
      if (!r || !String(r.id || '').trim()) return;
      const mapped = ventasCosechaMapearDistribucion_2026(r, lotesMap, campanasMap);
      allDistributions.push(mapped);
      if (!distsByVenta[mapped.ventaId]) distsByVenta[mapped.ventaId] = [];
      distsByVenta[mapped.ventaId].push(mapped);
    });
  }

  let sales = getSheetDataAsObjects('AsignacionesPrecio')
    .filter(function (a) {
      if (String(a.id || '').trim() === '') return false;
      if (String(a.estadoRegistro || '').trim().toUpperCase() === 'PENDIENTE') return false;
      return true;
    })
    .map(function (a) { return ventasCosechaMapear_2026(a, cosechasMap, lotesMap, campanasMap, clientesMap, distsByVenta); });

  const includeAnuladas = p && finParseBool_2026(p.includeAnuladas, false);
  if (!includeAnuladas) {
    sales = sales.filter(function (s) { return !s.anulada; });
  }
  if (p && p.campanaId) {
    const targetCamp = String(p.campanaId);
    sales = sales.filter(function (s) {
      if (String(s.campanaId) === targetCamp) return true;
      return Array.isArray(s.distribuciones) && s.distribuciones.some(function (d) { return String(d.campanaId) === targetCamp; });
    });
  }
  const filteredHarvests = (p && p.campanaId)
    ? harvests.filter(function (h) { return String(h.campanaId) === String(p.campanaId); })
    : harvests;

  return { ok: true, result: sales, sales: sales, harvests: filteredHarvests, distributions: allDistributions };
}

function ventasCosechaTienePagosActivos_2026(ventaId) {
  const sh = findSheetIgnoreCase_('CobroAplicaciones');
  if (!sh) return false;
  const vid = String(ventaId || '').trim();
  return getSheetDataAsObjects('CobroAplicaciones').some(function (a) {
    return String(a.deudaTipo || '').toUpperCase() === 'VENTA_COSECHA' &&
      String(a.deudaId || '').trim() === vid &&
      !finParseBool_2026(a.anulado, false);
  });
}

function ventasCosechaLimpiarParcial_2026(ventaId, writtenMovIds) {
  const vid = String(ventaId || '').trim();
  if (!vid) return;
  const movSet = {};
  (writtenMovIds || []).forEach(function (mid) { if (mid) movSet[String(mid).trim()] = true; });

  const movSh = findSheetIgnoreCase_('Movimientos');
  if (movSh && movSh.getLastRow() >= 2) {
    const mVals = movSh.getDataRange().getValues();
    const mMap = getHeaderIndexMap_(mVals[0]);
    for (let k = mVals.length - 1; k >= 1; k--) {
      const rid = String(mVals[k][mMap['id']] || '').trim();
      const tid = String(mVals[k][mMap['trabajoid']] || '').trim();
      if (movSet[rid] || tid === 'COSECHA:' + vid) {
        movSh.deleteRow(k + 1);
      }
    }
  }

  const distSh = findSheetIgnoreCase_('DistribucionesVenta');
  if (distSh && distSh.getLastRow() >= 2) {
    const dVals = distSh.getDataRange().getValues();
    const dMap = getHeaderIndexMap_(dVals[0]);
    for (let k = dVals.length - 1; k >= 1; k--) {
      if (String(dVals[k][dMap['ventaid']] || '').trim() === vid) {
        distSh.deleteRow(k + 1);
      }
    }
  }

  const asigSh = findSheetIgnoreCase_('AsignacionesPrecio');
  if (asigSh && asigSh.getLastRow() >= 2) {
    const aVals = asigSh.getDataRange().getValues();
    const aMap = getHeaderIndexMap_(aVals[0]);
    for (let k = aVals.length - 1; k >= 1; k--) {
      if (String(aVals[k][aMap['id']] || '').trim() === vid) {
        asigSh.deleteRow(k + 1);
      }
    }
  }

  SpreadsheetApp.flush();
}

function ventasCosechaCrear_2026(p, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const shAsig = cosechasHoja_2026('AsignacionesPrecio', PRECIO_CAMPOS_2026);
    asegurarColumnasOpcionales_2026(shAsig, VENTA_COSECHA_EXTRA_COLS_2026);
    const shDist = finEnsureSheet_2026('DistribucionesVenta', DISTRIBUCIONES_VENTA_CAMPOS_2026);

    const idem = String((p && p.idempotencyKey) || '').trim();
    if (idem) {
      const existing = getSheetDataAsObjects('AsignacionesPrecio').find(function (a) {
        return String(a.idempotencyKey || '').trim() === idem;
      });
      if (existing) {
        if (String(existing.estadoRegistro || '').trim().toUpperCase() === 'PENDIENTE') {
          ventasCosechaLimpiarParcial_2026(String(existing.id || '').trim(), []);
        } else {
          const listed = ventasCosechaListar_2026({ includeAnuladas: true });
          const found = listed.sales.find(function (s) { return s.id === String(existing.id); });
          return { ok: true, result: found || existing, sale: found || existing };
        }
      }
    }

    const cantidad = almacenRedondearQty4_2026(cosechasNumero_2026(p.cantidad !== undefined ? p.cantidad : p.toneladas, 'Cantidad vendida'));
    const compradorPendiente = finParseBool_2026(p.compradorPendiente, !String(p.clienteId || '').trim());
    let clienteId = '';
    let clienteNombre = '';
    if (!compradorPendiente) {
      clienteId = String(p.clienteId || '').trim();
      const cli = clientesBuscarPorId_2026(clienteId);
      if (!cli) throw new Error('El comprador seleccionado no existe en el catálogo de clientes.');
      clienteNombre = cli.nombre;
    }

    const precioPendiente = finParseBool_2026(p.precioPendiente, false);
    let precioUnitario = 0;
    if (!precioPendiente) {
      precioUnitario = cosechasNumero_2026(p.precioUnitario, 'Precio unitario');
    }

    const rawMon = String(p.moneda || 'USD').trim().toUpperCase();
    if (['USD', 'BOB', 'BS', 'BS.'].indexOf(rawMon) === -1) {
      throw new Error('Moneda inválida.');
    }
    const moneda = rawMon === 'BOB' || rawMon === 'BS' || rawMon === 'BS.' ? 'BOB' : 'USD';
    const tc = resolverTipoCambioOperacion_2026(p.tc !== undefined ? p.tc : p.tipoCambio);
    const fecha = validarFechaIso_2026(p.fecha, getBoliviaTodayStr_());

    const allHarvests = cosechasResumen_2026();
    const cosechaIdReq = String((p && p.cosechaId) || '').trim();
    const productoReq = String((p && p.producto) || '').trim();
    const unidadReq = almacenNormalizarUnidad_2026(p && p.unidad).canonicalUnit;

    let eligibleHarvests = [];
    let productoFinal = '';
    let unidadFinal = unidadReq;

    if (productoReq && !cosechaIdReq) {
      // Modo almacén general por producto: distribuir proporcionalmente entre todas las cosechas con stock del mismo producto y unidad
      const targetProdKey = almacenNormalizarProducto_2026(productoReq);
      eligibleHarvests = allHarvests.filter(function (h) {
        return almacenNormalizarProducto_2026(h.producto) === targetProdKey &&
          almacenNormalizarUnidad_2026(h.unidad).canonicalUnit === unidadReq &&
          Number(h.pendiente || 0) > 0.0001;
      });
      if (eligibleHarvests.length === 0) {
        throw new Error('No existe stock disponible en almacén para "' + productoReq + '" (' + unidadReq + ').');
      }
      productoFinal = String(eligibleHarvests[0].producto || productoReq).trim();
      unidadFinal = unidadReq;
    } else if (cosechaIdReq) {
      // Compatibilidad directa para venta de una cosecha específica
      const single = allHarvests.find(function (c) { return String(c.id) === cosechaIdReq; });
      if (!single) throw new Error('Cosecha no encontrada.');
      eligibleHarvests = [single];
      productoFinal = String(single.producto || productoReq || 'Cosecha').trim();
      unidadFinal = almacenNormalizarUnidad_2026(single.unidad).canonicalUnit;
    } else {
      throw new Error('Debe seleccionar un producto del almacén para registrar la venta.');
    }

    const plannedDists = almacenCalcularDistribucionProporcional_2026(
      eligibleHarvests,
      cantidad,
      precioPendiente,
      precioUnitario,
      moneda,
      tc
    );

    const lotesMap = {};
    getSheetDataAsObjects('Lotes').forEach(function (l) { lotesMap[String(l.id)] = l; });
    const origenResumen = almacenResumenOrigen_2026(plannedDists, lotesMap, '');

    const singleSource = plannedDists.length === 1 ? plannedDists[0] : null;
    const headerCosechaId = singleSource ? singleSource.cosechaId : '';
    const headerLoteId = singleSource ? singleSource.loteId : '';
    const headerCampanaId = String(
      (p && p.campanaId) ||
      (singleSource ? singleSource.campanaId : '') ||
      finResolverCampanaPorFecha_2026(fecha, plannedDists[0] ? plannedDists[0].campanaId : '')
    ).trim();

    if (headerCampanaId && !getSheetDataAsObjects('Campanas').some(function (c) { return String(c.id) === headerCampanaId; })) {
      throw new Error('Campaña de venta no válida.');
    }

    const importeTotal = precioPendiente ? 0 : redondear2_2026(cantidad * precioUnitario);
    const importeUsd = precioPendiente ? 0 : finConvertCurrency_2026(importeTotal, moneda, 'USD', tc);

    const isComplete = !compradorPendiente && Boolean(clienteId) && !precioPendiente && precioUnitario > 0;
    const resolvedTerms = ventasCosechaResolverCondiciones_2026({
      isNew: true,
      wasComplete: false,
      isComplete: isComplete,
      payload: p,
      completionBaseDate: fecha,
      existing: null
    });

    const id = Utilities.getUuid();
    const ahora = new Date().toISOString();
    const usuario = String((userSession && userSession.usuarioId) || 'admin');
    const estado = ventasCosechaEstado_2026(compradorPendiente, precioPendiente);

    const movSheet = findSheetIgnoreCase_('Movimientos');
    if (!precioPendiente && importeTotal > 0) {
      if (!movSheet) throw new Error('Hoja Movimientos no encontrada.');
      validateRequiredColumns_('Movimientos', getSheetHeaders_(movSheet), SHEET_SCHEMAS.Movimientos);
    }

    const headerRowObj = {
      id: id,
      cosechaId: headerCosechaId,
      fecha: fecha,
      campanaId: headerCampanaId,
      toneladas: cantidad,
      precioUsdTon: moneda === 'USD' ? precioUnitario : (precioPendiente ? 0 : redondear2_2026(precioUnitario / tc)),
      importeUsd: importeUsd,
      tc: tc,
      movimientoId: '',
      creadoPor: usuario,
      creadoEn: ahora,
      loteId: headerLoteId,
      producto: productoFinal,
      unidad: unidadFinal,
      clienteId: clienteId,
      clienteNombre: clienteNombre,
      compradorPendiente: compradorPendiente,
      precioUnitario: precioUnitario,
      moneda: moneda,
      importeTotal: importeTotal,
      precioPendiente: precioPendiente,
      plazoDias: resolvedTerms.plazoDias,
      fechaVencimiento: resolvedTerms.fechaVencimiento,
      fechaCompletado: resolvedTerms.fechaCompletado,
      aplicarInteres: resolvedTerms.aplicarInteres,
      tasaInteresMensual: resolvedTerms.tasaInteresMensual,
      observacion: String(p.observacion || '').trim(),
      estado: estado,
      anulada: false,
      actualizadoEn: ahora,
      idempotencyKey: idem,
      origenResumen: origenResumen,
      estadoRegistro: 'PENDIENTE'
    };

    const writtenMovIds = [];
    let headerRowIdx = -1;
    let firstMovId = '';

    try {
      // Paso 1: Anclar encabezado como PENDIENTE
      finAppendObj_2026(shAsig, headerRowObj);
      headerRowIdx = shAsig.getLastRow();

      // Paso 2: Persistir cada distribución histórica y su ingreso por lote/campaña de origen (sin duplicar)
      const desc = 'Venta de ' + productoFinal + (clienteNombre ? ' (' + clienteNombre + ')' : '');
      for (let i = 0; i < plannedDists.length; i++) {
        const d = plannedDists[i];
        let movId = '';
        if (!precioPendiente && d.importeAsignado > 0 && movSheet) {
          movId = Utilities.getUuid();
          if (!firstMovId) firstMovId = movId;
          finAppendObj_2026(movSheet, {
            id: movId,
            fecha: fecha,
            campanaId: String(d.campanaId || headerCampanaId),
            modulo: 'PROPIEDAD',
            clase: 'INGRESO',
            itemId: '',
            descripcion: desc,
            loteId: String(d.loteId || ''),
            maquinaId: '',
            cantidad: d.toneladasAsignadas,
            unidad: unidadFinal,
            precioUnitario: precioUnitario,
            importe: d.importeAsignado,
            moneda: moneda,
            tc: tc,
            trabajoId: 'COSECHA:' + id,
            creadoPor: usuario,
            creadoEn: ahora,
            actualizadoEn: ahora
          });
          writtenMovIds.push(movId);
        }

        finAppendObj_2026(shDist, {
          id: 'DIST-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
          ventaId: id,
          cosechaId: d.cosechaId,
          loteId: d.loteId,
          campanaId: d.campanaId,
          producto: productoFinal,
          unidad: unidadFinal,
          toneladasAsignadas: d.toneladasAsignadas,
          participacionPct: d.participacionPct,
          precioUnitario: d.precioUnitario,
          importeAsignado: d.importeAsignado,
          moneda: moneda,
          tcHistorico: tc,
          movimientoId: movId,
          anulada: false,
          creadoEn: ahora,
          actualizadoEn: ahora
        });
      }

      // Paso 3: Confirmar encabezado
      const aHeaders = getSheetHeaders_(shAsig);
      const aMap = getHeaderIndexMap_(aHeaders);
      let confirmRow = headerRowIdx;
      if (confirmRow < 2 || String(shAsig.getRange(confirmRow, aMap['id'] + 1).getValue() || '').trim() !== id) {
        const aVals = shAsig.getDataRange().getValues();
        for (let rIdx = aVals.length - 1; rIdx >= 1; rIdx--) {
          if (String(aVals[rIdx][aMap['id']] || '').trim() === id) {
            confirmRow = rIdx + 1;
            break;
          }
        }
      }
      if (confirmRow >= 2) {
        if (aMap['movimientoid'] !== undefined) shAsig.getRange(confirmRow, aMap['movimientoid'] + 1).setValue(firstMovId);
        if (aMap['estadoregistro'] !== undefined) shAsig.getRange(confirmRow, aMap['estadoregistro'] + 1).setValue('CONFIRMADO');
      }
      SpreadsheetApp.flush();
    } catch (writeErr) {
      try {
        ventasCosechaLimpiarParcial_2026(id, writtenMovIds);
      } catch (rbErr) {
        Logger.log('Error al revertir venta parcial ' + id + ': ' + rbErr.message);
      }
      throw new Error('Error al registrar la venta (se revirtieron los cambios parciales): ' + writeErr.message);
    }

    logAudit_(usuario, 'CREATE', 'AsignacionesPrecio', id, 'Venta almacén ' + productoFinal + ' ' + cantidad + ' ' + unidadFinal + ' (' + plannedDists.length + ' origenes) | ' + estado);

    const listed = ventasCosechaListar_2026({ includeAnuladas: true });
    const created = listed.sales.find(function (s) { return s.id === id; }) || headerRowObj;
    return { ok: true, result: created, sale: created };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function ventasCosechaActualizar_2026(p, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const id = String((p && p.id) || '').trim();
    if (!id) throw new Error('Se requiere el ID de la venta.');

    const shAsig = cosechasHoja_2026('AsignacionesPrecio', PRECIO_CAMPOS_2026);
    asegurarColumnasOpcionales_2026(shAsig, VENTA_COSECHA_EXTRA_COLS_2026);
    const shDist = finEnsureSheet_2026('DistribucionesVenta', DISTRIBUCIONES_VENTA_CAMPOS_2026);

    const vals = shAsig.getDataRange().getValues();
    if (vals.length < 2) throw new Error('Venta no encontrada.');
    const m = getHeaderIndexMap_(vals[0]);

    let targetRow = -1;
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][m['id']] || '').trim() === id) {
        targetRow = i + 1;
        break;
      }
    }
    if (targetRow === -1) throw new Error('Venta no encontrada: ' + id);

    const oldRow = vals[targetRow - 1].slice();
    if (finParseBool_2026(oldRow[m['anulada']], false)) {
      throw new Error('No se puede editar una venta anulada.');
    }

    const hasPayments = ventasCosechaTienePagosActivos_2026(id);
    const allHarvests = cosechasResumen_2026();
    const cosechasMap = {};
    allHarvests.forEach(function (c) { cosechasMap[String(c.id)] = c; });

    // Cargar distribuciones activas existentes (o sintetizar 100% desde cosechaId heredado si aún no migrado)
    const distValsAll = shDist.getDataRange().getValues();
    const dMap = getHeaderIndexMap_(distValsAll[0]);
    const existingDistRecords = [];
    for (let i = 1; i < distValsAll.length; i++) {
      const r = distValsAll[i];
      if (String(r[dMap['ventaid']] || '').trim() !== id) continue;
      if (finParseBool_2026(r[dMap['anulada']], false)) continue;
      existingDistRecords.push({
        rowIdx: i + 1,
        id: String(r[dMap['id']] || '').trim(),
        ventaId: id,
        cosechaId: String(r[dMap['cosechaid']] || '').trim(),
        loteId: String(r[dMap['loteid']] || '').trim(),
        campanaId: String(r[dMap['campanaid']] || '').trim(),
        producto: String(r[dMap['producto']] || '').trim(),
        unidad: almacenNormalizarUnidad_2026(r[dMap['unidad']]).canonicalUnit,
        toneladasAsignadas: almacenRedondearQty4_2026(Number(r[dMap['toneladasasignadas']] || 0)),
        participacionPct: redondear2_2026(Number(r[dMap['participacionpct']] || 0)),
        movimientoId: String(r[dMap['movimientoid']] || '').trim()
      });
    }

    const oldCosechaId = String(oldRow[m['cosechaid']] || '').trim();
    const oldCant = almacenRedondearQty4_2026(Number(oldRow[m['toneladas']]) || 0);
    const oldFecha = finToIsoDate_2026(oldRow[m['fecha']]) || getBoliviaTodayStr_();
    const oldCampanaId = String(oldRow[m['campanaid']] || '');
    const oldProducto = String(oldRow[m['producto']] || (cosechasMap[oldCosechaId] && cosechasMap[oldCosechaId].producto) || '').trim();
    const oldUnidad = almacenNormalizarUnidad_2026(oldRow[m['unidad']] || (cosechasMap[oldCosechaId] && cosechasMap[oldCosechaId].unidad) || 't').canonicalUnit;
    const oldClienteId = String(oldRow[m['clienteid']] || '').trim();
    const oldClienteNombre = String(oldRow[m['clientenombre']] || '').trim();
    const oldCompPend = finParseBool_2026(oldRow[m['compradorpendiente']], !oldClienteId);
    const oldPrecio = Number(oldRow[m['preciounitario']] !== '' ? oldRow[m['preciounitario']] : oldRow[m['preciousdton']]) || 0;
    const oldPrecioPend = finParseBool_2026(oldRow[m['preciopendiente']], oldPrecio <= 0);
    const oldMoneda = String(oldRow[m['moneda']] || 'USD').toUpperCase() === 'BOB' ? 'BOB' : 'USD';
    const oldTc = Number(oldRow[m['tc']]) > 0 ? Number(oldRow[m['tc']]) : 6.96;
    const oldMovId = String(oldRow[m['movimientoid']] || '').trim();

    let baseDists = existingDistRecords.slice();
    if (baseDists.length === 0 && oldCosechaId) {
      const legacyC = cosechasMap[oldCosechaId] || {};
      baseDists = [{
        rowIdx: -1,
        id: 'DIST-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
        ventaId: id,
        cosechaId: oldCosechaId,
        loteId: String(oldRow[m['loteid']] || legacyC.loteId || '').trim(),
        campanaId: String(oldCampanaId || legacyC.campanaId || '').trim(),
        producto: oldProducto,
        unidad: oldUnidad,
        toneladasAsignadas: oldCant,
        participacionPct: 100,
        movimientoId: oldMovId
      }];
    }

    const finalCant = p.cantidad !== undefined ? almacenRedondearQty4_2026(cosechasNumero_2026(p.cantidad, 'Cantidad vendida')) : oldCant;
    const finalFecha = p.fecha !== undefined ? validarFechaIso_2026(p.fecha, oldFecha) : oldFecha;

    let finalCompPend = p.compradorPendiente !== undefined ? finParseBool_2026(p.compradorPendiente, oldCompPend) : oldCompPend;
    let finalClienteId = oldClienteId;
    let finalClienteNombre = oldClienteNombre;
    if (p.compradorPendiente !== undefined || p.clienteId !== undefined) {
      if (finalCompPend) {
        if (hasPayments) throw new Error('No se puede dejar el comprador pendiente porque la venta ya tiene cobros registrados.');
        finalClienteId = '';
        finalClienteNombre = '';
      } else {
        const reqCid = String(p.clienteId !== undefined ? p.clienteId : oldClienteId).trim();
        if (!reqCid) {
          finalCompPend = true;
          finalClienteId = '';
          finalClienteNombre = '';
        } else {
          if (hasPayments && oldClienteId && reqCid !== oldClienteId) {
            throw new Error('No se puede cambiar el comprador porque esta venta ya tiene cobros registrados.');
          }
          const cli = clientesBuscarPorId_2026(reqCid);
          if (!cli) throw new Error('El comprador seleccionado no existe en el catálogo.');
          finalClienteId = cli.id;
          finalClienteNombre = cli.nombre;
        }
      }
    }

    const finalPrecioPend = p.precioPendiente !== undefined ? finParseBool_2026(p.precioPendiente, oldPrecioPend) : oldPrecioPend;
    if (finalPrecioPend && hasPayments) {
      throw new Error('No se puede dejar el precio pendiente porque esta venta ya tiene cobros registrados.');
    }
    const finalPrecio = finalPrecioPend
      ? 0
      : (p.precioUnitario !== undefined ? cosechasNumero_2026(p.precioUnitario, 'Precio unitario') : (oldPrecio > 0 ? oldPrecio : cosechasNumero_2026(0, 'Precio unitario')));

    const finalMoneda = p.moneda !== undefined
      ? (String(p.moneda).trim().toUpperCase() === 'BOB' || String(p.moneda).trim().toUpperCase() === 'BS' ? 'BOB' : 'USD')
      : oldMoneda;
    if (hasPayments && finalMoneda !== oldMoneda) {
      throw new Error('No se puede cambiar la moneda de una venta con cobros registrados.');
    }
    const finalTc = p.tc !== undefined ? resolverTipoCambioOperacion_2026(p.tc, oldTc) : oldTc;
    const finalTotal = finalPrecioPend ? 0 : redondear2_2026(finalCant * finalPrecio);
    const finalImporteUsd = finalPrecioPend ? 0 : finConvertCurrency_2026(finalTotal, finalMoneda, 'USD', finalTc);

    if (hasPayments) {
      const apps = getSheetDataAsObjects('CobroAplicaciones').filter(function (a) {
        return String(a.deudaTipo || '').toUpperCase() === 'VENTA_COSECHA' &&
          String(a.deudaId || '').trim() === id &&
          !finParseBool_2026(a.anulado, false);
      });
      const paidCap = redondear2_2026(apps.reduce(function (s, a) { return s + (Number(a.capitalPagado) || 0); }, 0));
      if (finalTotal + 0.01 < paidCap) {
        throw new Error('El nuevo importe (' + finalTotal.toFixed(2) + ') no puede ser menor al capital ya cobrado (' + paidCap.toFixed(2) + ').');
      }
    }

    // Calcular distribuciones finales según cambio de cantidad:
    // - Sin cambio de cantidad: conservar exactamente toneladasAsignadas y lotes originales (NO recalcular)
    // - Disminución de cantidad: reducir proporcionalmente devolviendo toneladas a sus orígenes originales
    // - Aumento de cantidad: conservar asignación original y distribuir solo el incremento desde stock actual
    let nextDistsRaw = [];
    const qtyDiff = almacenRedondearQty4_2026(finalCant - oldCant);
    if (Math.abs(qtyDiff) <= 0.00005) {
      nextDistsRaw = baseDists.map(function (d) { return { ...d }; });
    } else if (qtyDiff < 0) {
      // Escalar proporcionalmente las distribuciones existentes hacia abajo
      const SCALE = 10000;
      const targetUnits = Math.round(finalCant * SCALE);
      const oldUnits = baseDists.map(function (d) { return Math.max(0, Math.round(d.toneladasAsignadas * SCALE)); });
      const sumOldUnits = oldUnits.reduce(function (s, u) { return s + u; }, 0);
      const exactScaled = oldUnits.map(function (u) { return sumOldUnits > 0 ? (targetUnits * u) / sumOldUnits : 0; });
      const newUnits = exactScaled.map(function (v, idx) { return Math.min(oldUnits[idx], Math.floor(v)); });
      let rem = targetUnits - newUnits.reduce(function (s, u) { return s + u; }, 0);
      const order = baseDists.map(function (d, idx) {
        return { idx: idx, frac: exactScaled[idx] - Math.floor(exactScaled[idx]), id: String(d.cosechaId) };
      }).sort(function (a, b) {
        if (Math.abs(b.frac - a.frac) > 1e-12) return b.frac - a.frac;
        return a.id.localeCompare(b.id);
      });
      for (let i = 0; i < order.length && rem > 0; i++) {
        const idx = order[i].idx;
        if (newUnits[idx] < oldUnits[idx]) {
          newUnits[idx] += 1;
          rem -= 1;
        }
      }
      for (let i = 0; i < baseDists.length; i++) {
        if (newUnits[i] > 0) {
          nextDistsRaw.push({ ...baseDists[i], toneladasAsignadas: newUnits[i] / SCALE });
        }
      }
    } else {
      // Aumento de cantidad: distribuir únicamente el delta sobre stock disponible actual del producto
      const targetProdKey = almacenNormalizarProducto_2026(oldProducto);
      const availForDelta = allHarvests.filter(function (h) {
        return almacenNormalizarProducto_2026(h.producto) === targetProdKey &&
          almacenNormalizarUnidad_2026(h.unidad).canonicalUnit === oldUnidad &&
          Number(h.pendiente || 0) > 0.0001;
      });
      const deltaDists = almacenCalcularDistribucionProporcional_2026(
        availForDelta,
        qtyDiff,
        true,
        0,
        finalMoneda,
        finalTc
      );
      const mergedMap = {};
      baseDists.forEach(function (d) {
        mergedMap[d.cosechaId] = { ...d };
      });
      deltaDists.forEach(function (dd) {
        if (mergedMap[dd.cosechaId]) {
          mergedMap[dd.cosechaId].toneladasAsignadas = almacenRedondearQty4_2026(
            mergedMap[dd.cosechaId].toneladasAsignadas + dd.toneladasAsignadas
          );
        } else {
          mergedMap[dd.cosechaId] = {
            rowIdx: -1,
            id: 'DIST-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
            ventaId: id,
            cosechaId: dd.cosechaId,
            loteId: dd.loteId,
            campanaId: dd.campanaId,
            producto: oldProducto,
            unidad: oldUnidad,
            toneladasAsignadas: dd.toneladasAsignadas,
            participacionPct: 0,
            movimientoId: ''
          };
        }
      });
      nextDistsRaw = Object.keys(mergedMap).sort().map(function (k) { return mergedMap[k]; });
    }

    const finalDists = almacenRecalcularImportesDistribucion_2026(
      nextDistsRaw,
      finalPrecioPend,
      finalPrecio,
      finalMoneda,
      finalTc
    );

    const oldWasComplete = !oldCompPend && Boolean(oldClienteId) && !oldPrecioPend && oldPrecio > 0;
    const newIsComplete = !finalCompPend && Boolean(finalClienteId) && !finalPrecioPend && finalPrecio > 0;
    const oldFechaCompletado = m['fechacompletado'] !== undefined ? finToIsoDate_2026(oldRow[m['fechacompletado']]) : '';

    const resolvedTerms = ventasCosechaResolverCondiciones_2026({
      isNew: false,
      wasComplete: oldWasComplete,
      isComplete: newIsComplete,
      payload: p,
      completionBaseDate: getBoliviaTodayStr_(),
      existing: {
        fecha: oldFecha,
        fechaCompletado: oldFechaCompletado,
        plazoDias: oldRow[m['plazodias']],
        fechaVencimiento: oldRow[m['fechavencimiento']],
        aplicarInteres: oldRow[m['aplicarinteres']],
        tasaInteresMensual: oldRow[m['tasainteresmensual']]
      }
    });

    const finalObs = p.observacion !== undefined ? String(p.observacion || '').trim() : String(oldRow[m['observacion']] || '');
    const finalEstado = ventasCosechaEstado_2026(finalCompPend, finalPrecioPend);
    const ahora = new Date().toISOString();
    const usuario = String((userSession && userSession.usuarioId) || 'admin');

    const lotesMap = {};
    getSheetDataAsObjects('Lotes').forEach(function (l) { lotesMap[String(l.id)] = l; });
    const origenResumen = almacenResumenOrigen_2026(finalDists, lotesMap, '');

    // Conciliación atómica de Movimientos para esta venta (1 ingreso por distribución con lote y campaña de origen, sin duplicados)
    const movSheet = findSheetIgnoreCase_('Movimientos');
    let firstMovId = '';
    const desc = 'Venta de ' + oldProducto + (finalClienteNombre ? ' (' + finalClienteNombre + ')' : '');

    if (movSheet) {
      const mVals = movSheet.getDataRange().getValues();
      const mMap = getHeaderIndexMap_(mVals[0]);
      const existingMovRowById = {};
      const allSaleMovRowIndices = [];
      for (let k = 1; k < mVals.length; k++) {
        const rid = String(mVals[k][mMap['id']] || '').trim();
        const tid = String(mVals[k][mMap['trabajoid']] || '').trim();
        if (tid === 'COSECHA:' + id || (oldMovId && rid === oldMovId)) {
          existingMovRowById[rid] = k + 1;
          allSaleMovRowIndices.push({ rowIdx: k + 1, id: rid });
        }
      }

      const keptMovIds = {};
      if (!finalPrecioPend && finalTotal > 0) {
        for (let i = 0; i < finalDists.length; i++) {
          const d = finalDists[i];
          const existingMid = String(d.movimientoId || '').trim();
          const rowNum = existingMid && existingMovRowById[existingMid] ? existingMovRowById[existingMid] : -1;
          if (rowNum !== -1) {
            const mRow = mVals[rowNum - 1].slice();
            mRow[mMap['fecha']] = finalFecha;
            mRow[mMap['campanaid']] = String(d.campanaId || oldCampanaId);
            mRow[mMap['descripcion']] = desc;
            mRow[mMap['loteid']] = String(d.loteId || '');
            mRow[mMap['cantidad']] = d.toneladasAsignadas;
            mRow[mMap['unidad']] = oldUnidad;
            mRow[mMap['preciounitario']] = finalPrecio;
            mRow[mMap['importe']] = d.importeAsignado;
            mRow[mMap['moneda']] = finalMoneda;
            mRow[mMap['tc']] = finalTc;
            mRow[mMap['actualizadoen']] = ahora;
            movSheet.getRange(rowNum, 1, 1, mRow.length).setValues([mRow]);
            keptMovIds[existingMid] = true;
            if (!firstMovId) firstMovId = existingMid;
          } else {
            const newMid = Utilities.getUuid();
            d.movimientoId = newMid;
            if (!firstMovId) firstMovId = newMid;
            keptMovIds[newMid] = true;
            finAppendObj_2026(movSheet, {
              id: newMid,
              fecha: finalFecha,
              campanaId: String(d.campanaId || oldCampanaId),
              modulo: 'PROPIEDAD',
              clase: 'INGRESO',
              itemId: '',
              descripcion: desc,
              loteId: String(d.loteId || ''),
              maquinaId: '',
              cantidad: d.toneladasAsignadas,
              unidad: oldUnidad,
              precioUnitario: finalPrecio,
              importe: d.importeAsignado,
              moneda: finalMoneda,
              tc: finalTc,
              trabajoId: 'COSECHA:' + id,
              creadoPor: usuario,
              creadoEn: ahora,
              actualizadoEn: ahora
            });
          }
        }
      } else {
        finalDists.forEach(function (d) { d.movimientoId = ''; });
      }

      // Eliminar cualquier movimiento sobrante de esta venta (de abajo hacia arriba)
      for (let k = allSaleMovRowIndices.length - 1; k >= 0; k--) {
        const entry = allSaleMovRowIndices[k];
        if (!keptMovIds[entry.id]) {
          movSheet.deleteRow(entry.rowIdx);
        }
      }
    }

    // Conciliar hoja DistribucionesVenta
    const keptDistRowMap = {};
    for (let i = 0; i < finalDists.length; i++) {
      const d = finalDists[i];
      if (d.rowIdx && d.rowIdx >= 2) {
        keptDistRowMap[d.rowIdx] = true;
        const dRow = distValsAll[d.rowIdx - 1].slice();
        dRow[dMap['toneladasasignadas']] = d.toneladasAsignadas;
        dRow[dMap['participacionpct']] = d.participacionPct;
        dRow[dMap['preciounitario']] = d.precioUnitario;
        dRow[dMap['importeasignado']] = d.importeAsignado;
        dRow[dMap['moneda']] = finalMoneda;
        dRow[dMap['tchistorico']] = finalTc;
        dRow[dMap['movimientoid']] = d.movimientoId || '';
        dRow[dMap['anulada']] = false;
        dRow[dMap['actualizadoen']] = ahora;
        shDist.getRange(d.rowIdx, 1, 1, dRow.length).setValues([dRow]);
      } else {
        finAppendObj_2026(shDist, {
          id: d.id || ('DIST-' + Utilities.getUuid().slice(0, 8).toUpperCase()),
          ventaId: id,
          cosechaId: d.cosechaId,
          loteId: d.loteId,
          campanaId: d.campanaId,
          producto: oldProducto,
          unidad: oldUnidad,
          toneladasAsignadas: d.toneladasAsignadas,
          participacionPct: d.participacionPct,
          precioUnitario: d.precioUnitario,
          importeAsignado: d.importeAsignado,
          moneda: finalMoneda,
          tcHistorico: finalTc,
          movimientoId: d.movimientoId || '',
          anulada: false,
          creadoEn: ahora,
          actualizadoEn: ahora
        });
      }
    }
    // Marcar como anuladas las distribuciones previas que ya no aplican (por ejemplo al reducir cantidad a 0 en alguna fila)
    existingDistRecords.forEach(function (ex) {
      if (!keptDistRowMap[ex.rowIdx]) {
        shDist.getRange(ex.rowIdx, dMap['anulada'] + 1).setValue(true);
        shDist.getRange(ex.rowIdx, dMap['movimientoid'] + 1).setValue('');
        shDist.getRange(ex.rowIdx, dMap['actualizadoen'] + 1).setValue(ahora);
      }
    });

    const newRow = oldRow.slice();
    newRow[m['fecha']] = finalFecha;
    newRow[m['toneladas']] = finalCant;
    newRow[m['preciousdton']] = finalMoneda === 'USD' ? finalPrecio : (finalPrecioPend ? 0 : redondear2_2026(finalPrecio / finalTc));
    newRow[m['importeusd']] = finalImporteUsd;
    newRow[m['tc']] = finalTc;
    newRow[m['movimientoid']] = firstMovId;
    newRow[m['clienteid']] = finalClienteId;
    newRow[m['clientenombre']] = finalClienteNombre;
    newRow[m['compradorpendiente']] = finalCompPend;
    newRow[m['preciounitario']] = finalPrecio;
    newRow[m['moneda']] = finalMoneda;
    newRow[m['importetotal']] = finalTotal;
    newRow[m['preciopendiente']] = finalPrecioPend;
    newRow[m['plazodias']] = resolvedTerms.plazoDias;
    newRow[m['fechavencimiento']] = resolvedTerms.fechaVencimiento;
    if (m['fechacompletado'] !== undefined) newRow[m['fechacompletado']] = resolvedTerms.fechaCompletado;
    newRow[m['aplicarinteres']] = resolvedTerms.aplicarInteres;
    newRow[m['tasainteresmensual']] = resolvedTerms.tasaInteresMensual;
    newRow[m['observacion']] = finalObs;
    newRow[m['estado']] = finalEstado;
    if (m['origenresumen'] !== undefined) newRow[m['origenresumen']] = origenResumen;
    if (m['estadoregistro'] !== undefined) newRow[m['estadoregistro']] = 'CONFIRMADO';
    newRow[m['actualizadoen']] = ahora;

    shAsig.getRange(targetRow, 1, 1, newRow.length).setValues([newRow]);
    SpreadsheetApp.flush();
    logAudit_(usuario, 'UPDATE', 'AsignacionesPrecio', id, 'Venta actualizada: ' + finalEstado + ' (' + finalCant + ' ' + oldUnidad + ')');

    const listed = ventasCosechaListar_2026({ includeAnuladas: true });
    const updated = listed.sales.find(function (s) { return s.id === id; });
    return { ok: true, result: updated, sale: updated };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function ventasCosechaAnular_2026(p, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const id = String((p && p.id) || '').trim();
    if (!id) throw new Error('Se requiere el ID de la venta a anular.');
    if (ventasCosechaTienePagosActivos_2026(id)) {
      return { ok: false, error: 'No se puede anular esta venta porque tiene cobros activos registrados. Anule primero los cobros correspondientes.' };
    }

    const shAsig = cosechasHoja_2026('AsignacionesPrecio', PRECIO_CAMPOS_2026);
    asegurarColumnasOpcionales_2026(shAsig, VENTA_COSECHA_EXTRA_COLS_2026);
    const vals = shAsig.getDataRange().getValues();
    if (vals.length < 2) throw new Error('Venta no encontrada.');
    const m = getHeaderIndexMap_(vals[0]);

    let targetRow = -1;
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][m['id']] || '').trim() === id) {
        targetRow = i + 1;
        break;
      }
    }
    if (targetRow === -1) throw new Error('Venta no encontrada.');

    const movIdsToDelete = {};
    const headerMovId = String(vals[targetRow - 1][m['movimientoid']] || '').trim();
    if (headerMovId) movIdsToDelete[headerMovId] = true;

    const ahora = new Date().toISOString();
    const shDist = findSheetIgnoreCase_('DistribucionesVenta');
    if (shDist && shDist.getLastRow() >= 2) {
      const dVals = shDist.getDataRange().getValues();
      const dMap = getHeaderIndexMap_(dVals[0]);
      for (let i = 1; i < dVals.length; i++) {
        if (String(dVals[i][dMap['ventaid']] || '').trim() === id) {
          const dMovId = String(dVals[i][dMap['movimientoid']] || '').trim();
          if (dMovId) movIdsToDelete[dMovId] = true;
          shDist.getRange(i + 1, dMap['anulada'] + 1).setValue(true);
          shDist.getRange(i + 1, dMap['movimientoid'] + 1).setValue('');
          if (dMap['actualizadoen'] !== undefined) shDist.getRange(i + 1, dMap['actualizadoen'] + 1).setValue(ahora);
        }
      }
    }

    const movSheet = findSheetIgnoreCase_('Movimientos');
    if (movSheet && movSheet.getLastRow() >= 2) {
      const mVals = movSheet.getDataRange().getValues();
      const mMap = getHeaderIndexMap_(mVals[0]);
      for (let k = mVals.length - 1; k >= 1; k--) {
        const rid = String(mVals[k][mMap['id']] || '').trim();
        const tid = String(mVals[k][mMap['trabajoid']] || '').trim();
        if (movIdsToDelete[rid] || tid === 'COSECHA:' + id) {
          movSheet.deleteRow(k + 1);
        }
      }
    }

    shAsig.getRange(targetRow, m['anulada'] + 1).setValue(true);
    shAsig.getRange(targetRow, m['movimientoid'] + 1).setValue('');
    if (m['estadoregistro'] !== undefined) shAsig.getRange(targetRow, m['estadoregistro'] + 1).setValue('ANULADO');
    shAsig.getRange(targetRow, m['actualizadoen'] + 1).setValue(ahora);
    SpreadsheetApp.flush();

    logAudit_(userSession && userSession.usuarioId, 'CANCEL', 'AsignacionesPrecio', id, 'Venta de cosecha anulada y stock devuelto a cosechas de origen');
    return { ok: true, result: { id: id, anulada: true } };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

// -------------------------------------------------------------
// 4. CUENTAS POR COBRAR CENTRALIZADAS E INTERÉS SIMPLE POR MORA
// -------------------------------------------------------------

function arCalcularInteresSimple_2026(debt, activeApps, asOfIso) {
  const importeOriginal = redondear2_2026(debt.importeOriginal);
  const aplicarInteres = Boolean(debt.aplicarInteres) && Number(debt.tasaInteresMensual) > 0 && Boolean(debt.fechaVencimiento);
  const tasa = Number(debt.tasaInteresMensual) || 0;
  const fechaVenc = finToIsoDate_2026(debt.fechaVencimiento);
  const refDate = finToIsoDate_2026(asOfIso) || getBoliviaTodayStr_();

  // Excluir pagos con fecha posterior a la fecha de consulta (refDate) o sin fecha válida
  const sortedApps = (activeApps || [])
    .filter(function (a) {
      const payDate = finToIsoDate_2026(a && (a.fechaCobro || a.fecha));
      return Boolean(payDate) && payDate <= refDate;
    })
    .sort(function (a, b) {
      const fa = finToIsoDate_2026(a.fechaCobro || a.fecha);
      const fb = finToIsoDate_2026(b.fechaCobro || b.fecha);
      if (fa !== fb) return fa < fb ? -1 : 1;
      return String(a.creadoEn || '').localeCompare(String(b.creadoEn || ''));
    });

  let capitalPendiente = importeOriginal;
  let interesAcumulado = 0;
  let cursorDate = fechaVenc;
  let pagosCapital = 0;
  let pagosInteres = 0;

  for (let i = 0; i < sortedApps.length; i++) {
    const app = sortedApps[i];
    const payDate = finToIsoDate_2026(app.fechaCobro || app.fecha);
    if (!payDate || payDate > refDate) continue;

    if (aplicarInteres && cursorDate && capitalPendiente > 0.005 && payDate > cursorDate) {
      const dias = finDaysDiffIso_2026(cursorDate, payDate);
      if (dias > 0) {
        const dev = capitalPendiente * (tasa / 100) * (dias / 30);
        interesAcumulado = redondear2_2026(interesAcumulado + dev);
      }
      cursorDate = payDate;
    }

    const intPaid = redondear2_2026(Number(app.interesPagado) || 0);
    const capPaid = redondear2_2026(Number(app.capitalPagado) || 0);

    interesAcumulado = redondear2_2026(Math.max(0, interesAcumulado - intPaid));
    capitalPendiente = redondear2_2026(Math.max(0, capitalPendiente - capPaid));
    pagosInteres = redondear2_2026(pagosInteres + intPaid);
    pagosCapital = redondear2_2026(pagosCapital + capPaid);
  }

  if (aplicarInteres && cursorDate && capitalPendiente > 0.005 && refDate > cursorDate) {
    const diasFinal = finDaysDiffIso_2026(cursorDate, refDate);
    if (diasFinal > 0) {
      const devFinal = capitalPendiente * (tasa / 100) * (diasFinal / 30);
      interesAcumulado = redondear2_2026(interesAcumulado + devFinal);
    }
  }

  if (capitalPendiente <= 0.005) {
    capitalPendiente = 0;
    if (interesAcumulado <= 0.005) interesAcumulado = 0;
  }

  const totalPendiente = redondear2_2026(capitalPendiente + interesAcumulado);
  const diasAtraso = (totalPendiente > 0.005 && fechaVenc && refDate > fechaVenc)
    ? Math.max(0, finDaysDiffIso_2026(fechaVenc, refDate))
    : 0;
  const vencida = diasAtraso > 0;
  const pagosAnteriores = redondear2_2026(pagosCapital + pagosInteres);
  const estado = totalPendiente <= 0.005 ? 'COBRADO' : (pagosAnteriores > 0 ? 'PARCIAL' : 'PENDIENTE');

  return {
    pagosAnteriores: pagosAnteriores,
    pagosCapitalAnteriores: pagosCapital,
    pagosInteresAnteriores: pagosInteres,
    capitalPendiente: capitalPendiente,
    interesAcumulado: interesAcumulado,
    totalPendiente: totalPendiente,
    diasAtraso: diasAtraso,
    vencida: vencida,
    estado: estado
  };
}

function arConstruirDeudas_2026(asOfIso) {
  const refDate = finToIsoDate_2026(asOfIso) || getBoliviaTodayStr_();
  const clientesMap = {};
  if (findSheetIgnoreCase_('Clientes')) {
    getSheetDataAsObjects('Clientes').forEach(function (c) {
      if (c && c.id) {
        clientesMap[String(c.id).trim()] = {
          id: String(c.id).trim(),
          nombre: String(c.nombre || '').trim(),
          telefono: String(c.telefono || '').trim(),
          direccion: String(c.direccion || '').trim(),
          activo: finParseBool_2026(c.activo, true)
        };
      }
    });
  }
  const campanasMap = {};
  getSheetDataAsObjects('Campanas').forEach(function (c) { campanasMap[String(c.id)] = c; });
  const lotesMap = {};
  getSheetDataAsObjects('Lotes').forEach(function (l) { lotesMap[String(l.id)] = l; });
  const maquinasMap = {};
  getSheetDataAsObjects('Maquinas').forEach(function (m) { maquinasMap[String(m.id)] = m; });
  const cosechasMap = {};
  if (findSheetIgnoreCase_('Cosechas')) {
    getSheetDataAsObjects('Cosechas').forEach(function (c) { cosechasMap[String(c.id)] = c; });
  }

  // Detectar encabezados de Cobros en estado PENDIENTE o ANULADO para ignorar registros incompletos
  const cobrosRaw = findSheetIgnoreCase_('Cobros') ? getSheetDataAsObjects('Cobros') : [];
  const pendingOrAnnulledCobroIds = {};
  cobrosRaw.forEach(function (r) {
    const cid = String(r.id || '').trim();
    if (!cid) return;
    const estReg = String(r.estadoRegistro || '').trim().toUpperCase();
    if (estReg === 'PENDIENTE' || finParseBool_2026(r.anulado, false)) {
      pendingOrAnnulledCobroIds[cid] = true;
    }
  });

  // Cargar aplicaciones modernas (CobroAplicaciones)
  const appsByDebt = {};
  const cobroIdsConApps = {};
  if (findSheetIgnoreCase_('CobroAplicaciones')) {
    getSheetDataAsObjects('CobroAplicaciones').forEach(function (a) {
      const appCobroId = String(a.cobroId || '').trim();
      if (appCobroId) cobroIdsConApps[appCobroId] = true;
      if (finParseBool_2026(a.anulado, false)) return;
      if (appCobroId && pendingOrAnnulledCobroIds[appCobroId]) return;
      const key = String(a.deudaTipo || 'TRABAJO').toUpperCase() + ':' + String(a.deudaId || '').trim();
      if (!appsByDebt[key]) appsByDebt[key] = [];
      appsByDebt[key].push({
        id: String(a.id || ''),
        cobroId: appCobroId,
        deudaTipo: String(a.deudaTipo || 'TRABAJO').toUpperCase(),
        deudaId: String(a.deudaId || ''),
        clienteId: String(a.clienteId || ''),
        moduloOrigen: String(a.moduloOrigen || 'MAQUINARIAS').toUpperCase(),
        campanaOrigenId: String(a.campanaOrigenId || ''),
        loteOrigenId: String(a.loteOrigenId || ''),
        fechaCobro: finToIsoDate_2026(a.fechaCobro),
        monedaDeuda: String(a.monedaDeuda || 'USD').toUpperCase() === 'BOB' ? 'BOB' : 'USD',
        monedaPago: String(a.monedaPago || 'USD').toUpperCase() === 'BOB' ? 'BOB' : 'USD',
        tcAplicado: Number(a.tcAplicado) || 6.96,
        importeOriginalPagado: Number(a.importeOriginalPagado) || 0,
        importeEquivalenteDeuda: Number(a.importeEquivalenteDeuda) || 0,
        saldoCapitalAnterior: Number(a.saldoCapitalAnterior) || 0,
        interesAcumuladoAnterior: Number(a.interesAcumuladoAnterior) || 0,
        interesPagado: Number(a.interesPagado) || 0,
        capitalPagado: Number(a.capitalPagado) || 0,
        saldoCapitalRestante: Number(a.saldoCapitalRestante) || 0,
        interesRestante: Number(a.interesRestante) || 0,
        movimientoInteresId: String(a.movimientoInteresId || ''),
        anulado: false,
        creadoPor: String(a.creadoPor || ''),
        creadoEn: String(a.creadoEn || '')
      });
    });
  }

  // Incluir cobros heredados (anteriores a CobroAplicaciones) exactamente una vez y sin desfase cambiario
  const trabajosMap = {};
  getSheetDataAsObjects('Trabajos').forEach(function (t) { trabajosMap[String(t.id)] = t; });
  const defaultTcGlobal = Number(String(getConfigValue('TIPO_CAMBIO', 6.96) || '').replace(',', '.')) || 6.96;

  const legacyByTrabajo = {};
  const seenLegacyCobroIds = {};
  cobrosRaw.forEach(function (r) {
    const cid = String(r.id || '').trim();
    if (cid && cobroIdsConApps[cid]) return;
    if (cid && seenLegacyCobroIds[cid]) return;
    if (finParseBool_2026(r.anulado, false)) return;
    if (String(r.estadoRegistro || '').trim().toUpperCase() === 'PENDIENTE') return;
    // Si tiene notaCobroNumero o tipoPago pertenece al flujo moderno (ya gestionado por CobroAplicaciones)
    if (String(r.notaCobroNumero || '').trim() !== '' || String(r.tipoPago || '').trim() !== '') return;
    const tid = String(r.trabajoId || '').trim();
    if (!tid || !trabajosMap[tid]) return;
    if (cid) seenLegacyCobroIds[cid] = true;
    if (!legacyByTrabajo[tid]) legacyByTrabajo[tid] = [];
    legacyByTrabajo[tid].push(r);
  });

  Object.keys(legacyByTrabajo).forEach(function (tid) {
    const t = trabajosMap[tid];
    const rowsLeg = legacyByTrabajo[tid];
    const monedaDeuda = String(t.moneda || 'BOB').toUpperCase() === 'USD' ? 'USD' : 'BOB';
    const importeDeuda = redondear2_2026(Number(t.importe) || 0);
    const tcHist = Number(t.tc) > 0 ? Number(t.tc) : defaultTcGlobal;
    const importeCuentaUsd = monedaDeuda === 'USD'
      ? importeDeuda
      : redondear2_2026(importeDeuda / tcHist);

    const key = 'TRABAJO:' + tid;
    if (!appsByDebt[key]) appsByDebt[key] = [];

    const normalizedLegs = [];
    let totalLegUsd = 0;
    let totalLegEquiv = 0;

    for (let i = 0; i < rowsLeg.length; i++) {
      const r = rowsLeg[i];
      const cid = String(r.id || ('ROW-' + i)).trim();
      const monedaPagoRaw = String(r.monedaCobro || r.moneda || 'USD').trim().toUpperCase();
      const monedaPago = monedaPagoRaw === 'USD' ? 'USD' : 'BOB';
      const hasOriginal = r.importeOriginal !== undefined && r.importeOriginal !== '' && r.importeOriginal !== null;
      const orig = redondear2_2026(hasOriginal ? (Number(r.importeOriginal) || 0) : (Number(r.importe) || 0));
      const tcPago = Number(r.tc) > 0 ? Number(r.tc) : tcHist;
      const hasUsd = r.importeUsd !== undefined && r.importeUsd !== '' && r.importeUsd !== null;
      const impUsd = hasUsd
        ? redondear2_2026(Number(r.importeUsd) || 0)
        : (monedaPago === 'USD' ? orig : redondear2_2026(orig / tcPago));

      // Equivalente exacto en monedaDeuda respetando la liquidación histórica en USD del módulo legacy:
      // - Deuda USD: el monto acreditado siempre fue impUsd.
      // - Deuda BOB cobrada en BOB: monto directo orig.
      // - Deuda BOB cobrada en USD: legacy acreditaba impUsd contra importeCuentaUsd (calculado a tcHist),
      //   por lo que el capital BOB amortizado equivale a impUsd * tcHist.
      let equiv;
      if (monedaDeuda === 'USD') {
        equiv = impUsd;
      } else if (monedaPago === 'BOB') {
        equiv = orig;
      } else {
        equiv = redondear2_2026(impUsd * tcHist);
      }

      totalLegUsd = redondear2_2026(totalLegUsd + impUsd);
      totalLegEquiv = redondear2_2026(totalLegEquiv + equiv);
      normalizedLegs.push({
        cid: cid,
        fechaCobro: finToIsoDate_2026(r.fecha) || finToIsoDate_2026(t.fecha),
        monedaPago: monedaPago,
        tcPago: tcPago,
        orig: orig,
        equiv: equiv,
        creadoPor: String(r.creadoPor || ''),
        creadoEn: String(r.creadoEn || '')
      });
    }

    // Si en el esquema histórico el servicio quedó totalmente saldado en USD (saldoUsd === 0),
    // asegurar que diferencias de redondeo o TC en el último pago no reabran saldo pendiente fantasma.
    if (normalizedLegs.length > 0 && Math.round(totalLegUsd * 100) >= Math.round(importeCuentaUsd * 100)) {
      const diff = redondear2_2026(importeDeuda - totalLegEquiv);
      if (diff > 0) {
        normalizedLegs[normalizedLegs.length - 1].equiv = redondear2_2026(normalizedLegs[normalizedLegs.length - 1].equiv + diff);
      }
    }

    for (let i = 0; i < normalizedLegs.length; i++) {
      const leg = normalizedLegs[i];
      appsByDebt[key].push({
        id: 'LEG-' + leg.cid,
        cobroId: leg.cid,
        deudaTipo: 'TRABAJO',
        deudaId: tid,
        clienteId: String(t.clienteId || ''),
        moduloOrigen: 'MAQUINARIAS',
        campanaOrigenId: String(t.campanaId || ''),
        loteOrigenId: '',
        fechaCobro: leg.fechaCobro,
        monedaDeuda: monedaDeuda,
        monedaPago: leg.monedaPago,
        tcAplicado: leg.tcPago,
        importeOriginalPagado: leg.orig,
        importeEquivalenteDeuda: leg.equiv,
        saldoCapitalAnterior: 0,
        interesAcumuladoAnterior: 0,
        interesPagado: 0,
        capitalPagado: leg.equiv,
        saldoCapitalRestante: 0,
        interesRestante: 0,
        movimientoInteresId: '',
        anulado: false,
        creadoPor: leg.creadoPor,
        creadoEn: leg.creadoEn
      });
    }
  });

  function computeAppDateBounds_(apps) {
    let minD = '';
    let maxD = '';
    for (let i = 0; i < apps.length; i++) {
      const d = finToIsoDate_2026(apps[i].fechaCobro || apps[i].fecha);
      if (!d) continue;
      if (!minD || d < minD) minD = d;
      if (!maxD || d > maxD) maxD = d;
    }
    return { minActivePayDate: minD, maxActivePayDate: maxD };
  }

  const debts = [];

  // A. Servicios externos de Maquinarias (hoja Trabajos, todas las campañas y años)
  getSheetDataAsObjects('Trabajos').forEach(function (t) {
    if (String(t.destino || '').toUpperCase() !== 'TERCERO') return;
    const importe = redondear2_2026(Number(t.importe) || 0);
    if (importe <= 0) return;

    const id = String(t.id || '').trim();
    const key = 'TRABAJO:' + id;
    const clienteId = String(t.clienteId || '').trim();
    const cliObj = clienteId ? clientesMap[clienteId] : null;
    const clienteNombre = cliObj ? cliObj.nombre : String(t.cliente || '').trim();
    const clientePendiente = !clienteId || finParseBool_2026(t.clientePendiente, false);
    const maqObj = maquinasMap[String(t.maquinaId || '')] || {};
    const campObj = campanasMap[String(t.campanaId || '')] || {};
    const moneda = String(t.moneda || 'BOB').toUpperCase() === 'USD' ? 'USD' : 'BOB';

    let labor = String(t.trabajoNombre || '').trim();
    const obs = String(t.observacion || '');
    if (!labor && obs.indexOf('[Trabajo:') !== -1) {
      const m = obs.match(/\[Trabajo:\s*([^\]]+)\]/);
      if (m && m[1]) labor = m[1].trim();
    }
    const concepto = (maqObj.nombre ? maqObj.nombre : 'Maquinaria') + (labor ? ' — ' + labor : ' — Servicio');
    const fecha = finToIsoDate_2026(t.fecha);
    const plazoDias = t.plazoDias !== '' && t.plazoDias !== undefined && t.plazoDias !== null ? Math.max(0, Math.round(Number(t.plazoDias))) : 0;
    const fechaVencimiento = t.fechaVencimiento ? finToIsoDate_2026(t.fechaVencimiento) : '';
    const aplicarInteres = finParseBool_2026(t.aplicarInteres, false);
    const tasaInteresMensual = aplicarInteres ? (Number(t.tasaInteresMensual) || 0) : 0;

    const base = {
      id: key,
      deudaTipo: 'TRABAJO',
      deudaId: id,
      origen: 'MAQUINARIAS',
      clienteId: clientePendiente ? '' : clienteId,
      clienteNombre: clientePendiente ? '' : clienteNombre,
      clientePendiente: clientePendiente,
      fecha: fecha,
      concepto: concepto,
      campanaId: String(t.campanaId || ''),
      campanaNombre: String(campObj.nombre || ''),
      loteId: '',
      loteNombre: '',
      maquinaId: String(t.maquinaId || ''),
      maquinaNombre: String(maqObj.nombre || ''),
      cantidad: Number(t.cantidad) || 0,
      unidad: String(t.unidad || 'ha'),
      precioUnitario: Number(t.precioUnitario) || 0,
      moneda: moneda,
      tcHistorico: Number(t.tc) > 0 ? Number(t.tc) : 6.96,
      importeOriginal: importe,
      plazoDias: plazoDias,
      fechaVencimiento: fechaVencimiento,
      aplicarInteres: aplicarInteres,
      tasaInteresMensual: tasaInteresMensual,
      observacion: obs
    };

    const apps = appsByDebt[key] || [];
    const bounds = computeAppDateBounds_(apps);
    const calc = arCalcularInteresSimple_2026(base, apps, refDate);
    debts.push({ ...base, ...calc, ...bounds, aplicaciones: apps });
  });

  // B. Ventas de cosecha con precio (hoja AsignacionesPrecio, una sola operación comercial / deuda por venta)
  const distsByVentaAr = {};
  if (findSheetIgnoreCase_('DistribucionesVenta')) {
    getSheetDataAsObjects('DistribucionesVenta').forEach(function (d) {
      if (!d || finParseBool_2026(d.anulada, false)) return;
      const vid = String(d.ventaId || '').trim();
      if (!vid) return;
      if (!distsByVentaAr[vid]) distsByVentaAr[vid] = [];
      distsByVentaAr[vid].push(ventasCosechaMapearDistribucion_2026(d, lotesMap, campanasMap));
    });
  }

  if (findSheetIgnoreCase_('AsignacionesPrecio')) {
    getSheetDataAsObjects('AsignacionesPrecio').forEach(function (a) {
      if (finParseBool_2026(a.anulada, false)) return;
      if (String(a.estadoRegistro || '').trim().toUpperCase() === 'PENDIENTE') return;
      const id = String(a.id || '').trim();
      if (!id) return;

      const cant = Number(a.toneladas || 0) || 0;
      const precio = Number(a.precioUnitario !== undefined && a.precioUnitario !== '' ? a.precioUnitario : (a.precioUsdTon || 0)) || 0;
      const precioPend = a.precioPendiente !== undefined && a.precioPendiente !== ''
        ? finParseBool_2026(a.precioPendiente, precio <= 0)
        : precio <= 0;
      if (precioPend || precio <= 0) return;

      const moneda = String(a.moneda || 'USD').toUpperCase() === 'BOB' ? 'BOB' : 'USD';
      const importe = redondear2_2026(
        a.importeTotal !== undefined && a.importeTotal !== ''
          ? Number(a.importeTotal)
          : (a.importeUsd !== undefined && a.importeUsd !== '' ? Number(a.importeUsd) : cant * precio)
      );
      if (importe <= 0) return;

      const key = 'VENTA_COSECHA:' + id;
      const saleDists = distsByVentaAr[id] || [];
      const singleDist = saleDists.length === 1 ? saleDists[0] : null;
      const cosecha = cosechasMap[String(a.cosechaId || '')] || {};
      const loteId = String(a.loteId || (singleDist ? singleDist.loteId : '') || cosecha.loteId || '').trim();
      const campanaId = String(a.campanaId || (singleDist ? singleDist.campanaId : '') || cosecha.campanaId || '').trim();
      const producto = String(a.producto || (saleDists[0] ? saleDists[0].producto : '') || cosecha.producto || 'Cosecha').trim();
      const loteObj = lotesMap[loteId] || {};
      const campObj = campanasMap[campanaId] || {};
      const origenResumen = String(a.origenResumen || '').trim() || almacenResumenOrigen_2026(saleDists, lotesMap, loteId);
      const displayLot = String(loteObj.nombre || origenResumen || '').trim();

      const clienteId = String(a.clienteId || '').trim();
      const cliObj = clienteId ? clientesMap[clienteId] : null;
      const clienteNombre = cliObj ? cliObj.nombre : String(a.clienteNombre || '').trim();
      const clientePendiente = !clienteId || finParseBool_2026(a.compradorPendiente, false);

      const fecha = finToIsoDate_2026(a.fecha);
      // Mientras el comprador esté pendiente (o falte precio), no existe plazo, vencimiento ni interés por mora
      const saleIsComplete = !clientePendiente && !precioPend && precio > 0;
      const plazoDias = saleIsComplete && a.plazoDias !== '' && a.plazoDias !== undefined && a.plazoDias !== null
        ? Math.max(0, Math.round(Number(a.plazoDias)))
        : 0;
      const fechaVencimiento = saleIsComplete && a.fechaVencimiento ? finToIsoDate_2026(a.fechaVencimiento) : '';
      const aplicarInteres = saleIsComplete ? finParseBool_2026(a.aplicarInteres, false) : false;
      const tasaInteresMensual = aplicarInteres ? (Number(a.tasaInteresMensual) || 0) : 0;

      const base = {
        id: key,
        deudaTipo: 'VENTA_COSECHA',
        deudaId: id,
        origen: 'PROPIEDAD',
        clienteId: clientePendiente ? '' : clienteId,
        clienteNombre: clientePendiente ? '' : clienteNombre,
        clientePendiente: clientePendiente,
        fecha: fecha,
        concepto: 'Venta de ' + producto + (displayLot ? ' — ' + displayLot : ''),
        campanaId: campanaId,
        campanaNombre: String(campObj.nombre || ''),
        loteId: loteId,
        loteNombre: displayLot,
        maquinaId: '',
        maquinaNombre: '',
        cantidad: cant,
        unidad: almacenNormalizarUnidad_2026(a.unidad || cosecha.unidad || 't').canonicalUnit,
        precioUnitario: precio,
        moneda: moneda,
        tcHistorico: Number(a.tc) > 0 ? Number(a.tc) : 6.96,
        importeOriginal: importe,
        plazoDias: plazoDias,
        fechaVencimiento: fechaVencimiento,
        aplicarInteres: aplicarInteres,
        tasaInteresMensual: tasaInteresMensual,
        observacion: String(a.observacion || ''),
        distribuciones: saleDists
      };

      const apps = appsByDebt[key] || [];
      const bounds = computeAppDateBounds_(apps);
      const calc = arCalcularInteresSimple_2026(base, apps, refDate);
      debts.push({ ...base, ...calc, ...bounds, aplicaciones: apps });
    });
  }

  return { debts: debts, clientesMap: clientesMap };
}

function arResumen_2026(p) {
  const built = arConstruirDeudas_2026(p && p.fechaCorte);
  const debts = built.debts;
  const clientesMap = built.clientesMap;

  const grouped = {};
  const unassignedDebts = [];
  const totals = {
    capitalUsd: 0, interesUsd: 0, totalUsd: 0,
    capitalBob: 0, interesBob: 0, totalBob: 0,
    unassignedUsd: 0, unassignedBob: 0, unassignedCount: 0
  };

  // Pre-cargar todos los clientes registrados en el catálogo (incluyendo clientes sin deuda)
  // para que el selector local Con deuda / Sin deuda / Todos funcione sin peticiones adicionales
  Object.keys(clientesMap).forEach(function (cid) {
    const cli = clientesMap[cid];
    if (!cli || !cli.id || !cli.nombre) return;
    if (cli.activo === false) return;
    grouped[cid] = {
      clienteId: cli.id,
      clienteNombre: cli.nombre,
      telefono: cli.telefono || '',
      direccion: cli.direccion || '',
      activo: cli.activo,
      registrosPendientes: 0,
      registrosVencidos: 0,
      usd: { capitalPendiente: 0, interesAcumulado: 0, totalPendiente: 0 },
      bob: { capitalPendiente: 0, interesAcumulado: 0, totalPendiente: 0 },
      deudas: []
    };
  });

  debts.forEach(function (d) {
    if (d.totalPendiente <= 0.005) return;

    if (d.moneda === 'USD') {
      totals.capitalUsd = redondear2_2026(totals.capitalUsd + d.capitalPendiente);
      totals.interesUsd = redondear2_2026(totals.interesUsd + d.interesAcumulado);
      totals.totalUsd = redondear2_2026(totals.totalUsd + d.totalPendiente);
    } else {
      totals.capitalBob = redondear2_2026(totals.capitalBob + d.capitalPendiente);
      totals.interesBob = redondear2_2026(totals.interesBob + d.interesAcumulado);
      totals.totalBob = redondear2_2026(totals.totalBob + d.totalPendiente);
    }

    if (!d.clienteId || d.clientePendiente) {
      unassignedDebts.push(d);
      totals.unassignedCount += 1;
      if (d.moneda === 'USD') totals.unassignedUsd = redondear2_2026(totals.unassignedUsd + d.totalPendiente);
      else totals.unassignedBob = redondear2_2026(totals.unassignedBob + d.totalPendiente);
      return;
    }

    if (!grouped[d.clienteId]) {
      const cli = clientesMap[d.clienteId] || { id: d.clienteId, nombre: d.clienteNombre || 'Cliente', activo: true };
      grouped[d.clienteId] = {
        clienteId: d.clienteId,
        clienteNombre: cli.nombre,
        telefono: cli.telefono || '',
        direccion: cli.direccion || '',
        activo: cli.activo,
        registrosPendientes: 0,
        registrosVencidos: 0,
        usd: { capitalPendiente: 0, interesAcumulado: 0, totalPendiente: 0 },
        bob: { capitalPendiente: 0, interesAcumulado: 0, totalPendiente: 0 },
        deudas: []
      };
    }

    const g = grouped[d.clienteId];
    g.registrosPendientes += 1;
    if (d.vencida) g.registrosVencidos += 1;
    const bucket = d.moneda === 'USD' ? g.usd : g.bob;
    bucket.capitalPendiente = redondear2_2026(bucket.capitalPendiente + d.capitalPendiente);
    bucket.interesAcumulado = redondear2_2026(bucket.interesAcumulado + d.interesAcumulado);
    bucket.totalPendiente = redondear2_2026(bucket.totalPendiente + d.totalPendiente);
    g.deudas.push(d);
  });

  const customers = Object.keys(grouped).map(function (k) { return grouped[k]; }).sort(function (a, b) {
    const aHas = a.registrosPendientes > 0 ? 1 : 0;
    const bHas = b.registrosPendientes > 0 ? 1 : 0;
    if (bHas !== aHas) return bHas - aHas;
    if (b.registrosVencidos !== a.registrosVencidos) return b.registrosVencidos - a.registrosVencidos;
    return a.clienteNombre.localeCompare(b.clienteNombre, 'es');
  });

  const payloadOut = { customers: customers, unassignedDebts: unassignedDebts, totals: totals };
  return { ok: true, result: payloadOut, ...payloadOut };
}

function arListarDocumentos_2026(p) {
  const cid = p && p.clienteId ? String(p.clienteId).trim() : '';
  const debitNotes = [];
  if (findSheetIgnoreCase_('NotasDebito')) {
    getSheetDataAsObjects('NotasDebito').forEach(function (r) {
      if (!r.id) return;
      if (cid && String(r.clienteId || '').trim() !== cid) return;
      let items = [];
      try {
        const parsed = JSON.parse(String(r.snapshotJson || '[]'));
        items = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.items) ? parsed.items : []);
      } catch (e) { items = []; }
      debitNotes.push({
        id: String(r.id),
        numero: String(r.numero || ''),
        fecha: finToIsoDate_2026(r.fecha),
        clienteId: String(r.clienteId || ''),
        clienteNombre: String(r.clienteNombre || ''),
        clienteTelefono: String(r.clienteTelefono || ''),
        clienteDireccion: String(r.clienteDireccion || ''),
        totalUsd: Number(r.totalUsd) || 0,
        totalBob: Number(r.totalBob) || 0,
        items: items,
        observacion: String(r.observacion || ''),
        creadoPor: String(r.creadoPor || ''),
        creadoEn: String(r.creadoEn || '')
      });
    });
  }

  const pendingCobroIds = {};
  if (findSheetIgnoreCase_('Cobros')) {
    getSheetDataAsObjects('Cobros').forEach(function (c) {
      const idc = String(c.id || '').trim();
      if (idc && String(c.estadoRegistro || '').trim().toUpperCase() === 'PENDIENTE') {
        pendingCobroIds[idc] = true;
      }
    });
  }

  const paymentReceipts = [];
  if (findSheetIgnoreCase_('NotasCobro')) {
    getSheetDataAsObjects('NotasCobro').forEach(function (r) {
      if (!r.id) return;
      const rcId = String(r.cobroId || '').trim();
      if (rcId && pendingCobroIds[rcId]) return;
      if (cid && String(r.clienteId || '').trim() !== cid) return;
      let items = [];
      try {
        const parsed = JSON.parse(String(r.snapshotJson || '[]'));
        items = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.items) ? parsed.items : []);
      } catch (e) { items = []; }
      paymentReceipts.push({
        id: String(r.id),
        numero: String(r.numero || ''),
        cobroId: rcId,
        fecha: finToIsoDate_2026(r.fecha),
        clienteId: String(r.clienteId || ''),
        clienteNombre: String(r.clienteNombre || ''),
        clienteTelefono: String(r.clienteTelefono || ''),
        clienteDireccion: String(r.clienteDireccion || ''),
        tipoPago: String(r.tipoPago || 'PARCIAL').toUpperCase() === 'TOTAL' ? 'TOTAL' : 'PARCIAL',
        monedaPago: String(r.monedaPago || 'USD').toUpperCase() === 'BOB' ? 'BOB' : 'USD',
        importeOriginalPagado: Number(r.importeOriginalPagado) || 0,
        tcAplicado: Number(r.tcAplicado) || 6.96,
        totalAplicadoUsd: Number(r.totalAplicadoUsd) || 0,
        totalAplicadoBob: Number(r.totalAplicadoBob) || 0,
        items: items,
        observacion: String(r.observacion || ''),
        anulado: finParseBool_2026(r.anulado, false),
        creadoPor: String(r.creadoPor || ''),
        creadoEn: String(r.creadoEn || '')
      });
    });
  }

  debitNotes.sort(function (a, b) { return String(b.creadoEn || b.fecha).localeCompare(String(a.creadoEn || a.fecha)); });
  paymentReceipts.sort(function (a, b) { return String(b.creadoEn || b.fecha).localeCompare(String(a.creadoEn || a.fecha)); });

  const out = { debitNotes: debitNotes, paymentReceipts: paymentReceipts };
  return { ok: true, result: out, ...out };
}

function arDetalleCliente_2026(p) {
  const clienteId = String((p && p.clienteId) || '').trim();
  if (!clienteId) return { ok: false, error: 'Se requiere el ID del cliente.' };
  const customer = clientesBuscarPorId_2026(clienteId);
  if (!customer) return { ok: false, error: 'Cliente no encontrado.' };

  const built = arConstruirDeudas_2026(p && p.fechaCorte);
  const customerDebts = built.debts.filter(function (d) { return String(d.clienteId) === clienteId; });

  const summary = {
    clienteId: customer.id,
    clienteNombre: customer.nombre,
    telefono: customer.telefono,
    direccion: customer.direccion,
    activo: customer.activo,
    registrosPendientes: 0,
    registrosVencidos: 0,
    usd: { capitalPendiente: 0, interesAcumulado: 0, totalPendiente: 0 },
    bob: { capitalPendiente: 0, interesAcumulado: 0, totalPendiente: 0 },
    deudas: customerDebts
  };

  customerDebts.forEach(function (d) {
    if (d.totalPendiente <= 0.005) return;
    summary.registrosPendientes += 1;
    if (d.vencida) summary.registrosVencidos += 1;
    const b = d.moneda === 'USD' ? summary.usd : summary.bob;
    b.capitalPendiente = redondear2_2026(b.capitalPendiente + d.capitalPendiente);
    b.interesAcumulado = redondear2_2026(b.interesAcumulado + d.interesAcumulado);
    b.totalPendiente = redondear2_2026(b.totalPendiente + d.totalPendiente);
  });

  // Historial de cobros del cliente (modernos + heredados de sus trabajos, excluyendo PENDIENTE)
  const customerTrabajoIds = {};
  customerDebts.forEach(function (d) {
    if (d.deudaTipo === 'TRABAJO' && d.deudaId) customerTrabajoIds[String(d.deudaId)] = true;
  });

  const appsByCobro = {};
  if (findSheetIgnoreCase_('CobroAplicaciones')) {
    getSheetDataAsObjects('CobroAplicaciones').forEach(function (a) {
      if (String(a.clienteId || '').trim() !== clienteId) return;
      const cid = String(a.cobroId || '').trim();
      if (!appsByCobro[cid]) appsByCobro[cid] = [];
      appsByCobro[cid].push(a);
    });
  }

  const payments = [];
  if (findSheetIgnoreCase_('Cobros')) {
    getSheetDataAsObjects('Cobros').forEach(function (c) {
      const cid = String(c.id || '').trim();
      if (!cid) return;
      if (String(c.estadoRegistro || '').trim().toUpperCase() === 'PENDIENTE') return;
      const cTrabajoId = String(c.trabajoId || '').trim();
      const matchesCustomer =
        String(c.clienteId || '').trim() === clienteId ||
        Boolean(appsByCobro[cid]) ||
        Boolean(cTrabajoId && customerTrabajoIds[cTrabajoId]);
      if (!matchesCustomer) return;
      const apps = appsByCobro[cid] || [];
      const monPago = String(c.monedaPago || c.monedaCobro || 'USD').toUpperCase() === 'BOB' ? 'BOB' : 'USD';
      const monTotales = String(c.monedaTotalesAplicados || monPago).toUpperCase() === 'BOB' ? 'BOB' : 'USD';
      payments.push({
        id: cid,
        cobroId: cid,
        fecha: finToIsoDate_2026(c.fecha),
        clienteId: clienteId,
        clienteNombre: customer.nombre,
        monedaPago: monPago,
        importeOriginalPagado: Number(c.importeOriginal || c.importe || 0) || 0,
        tcAplicado: Number(c.tcAplicado || c.tc || 6.96) || 6.96,
        tipoPago: String(c.tipoPago || 'PARCIAL').toUpperCase() === 'TOTAL' ? 'TOTAL' : 'PARCIAL',
        capitalTotalAplicado: Number(c.capitalTotalAplicado || 0) || 0,
        interesTotalAplicado: Number(c.interesTotalAplicado || 0) || 0,
        monedaTotalesAplicados: monTotales,
        capitalAplicadoUsd: Number(c.capitalAplicadoUsd || 0) || 0,
        interesAplicadoUsd: Number(c.interesAplicadoUsd || 0) || 0,
        capitalAplicadoBob: Number(c.capitalAplicadoBob || 0) || 0,
        interesAplicadoBob: Number(c.interesAplicadoBob || 0) || 0,
        notaCobroNumero: String(c.notaCobroNumero || ''),
        observacion: String(c.observacion || ''),
        anulado: finParseBool_2026(c.anulado, false),
        creadoPor: String(c.creadoPor || ''),
        creadoEn: String(c.creadoEn || ''),
        aplicaciones: apps
      });
    });
  }
  payments.sort(function (a, b) { return String(b.creadoEn || b.fecha).localeCompare(String(a.creadoEn || a.fecha)); });

  const docs = arListarDocumentos_2026({ clienteId: clienteId });
  const out = {
    customer: customer,
    summary: summary,
    debts: customerDebts,
    payments: payments,
    debitNotes: docs.debitNotes,
    paymentReceipts: docs.paymentReceipts
  };
  return { ok: true, result: out, ...out };
}

function arAsignarClienteDeuda_2026(p, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const deudaTipo = String((p && p.deudaTipo) || '').toUpperCase();
    const deudaId = String((p && p.deudaId) || '').trim();
    const clienteId = String((p && p.clienteId) || '').trim();
    if (!deudaId || !clienteId) return { ok: false, error: 'Se requiere la deuda y el cliente.' };
    const cli = clientesBuscarPorId_2026(clienteId);
    if (!cli) return { ok: false, error: 'Cliente no encontrado en el catálogo.' };
    const ahora = new Date().toISOString();

    if (deudaTipo === 'TRABAJO') {
      const sh = findSheetIgnoreCase_('Trabajos');
      if (!sh) throw new Error('Hoja Trabajos no encontrada.');
      asegurarColumnasOpcionales_2026(sh, ['clienteId', 'clientePendiente']);
      const vals = sh.getDataRange().getValues();
      const m = getHeaderIndexMap_(vals[0]);
      let rowIdx = -1;
      for (let i = 1; i < vals.length; i++) {
        if (String(vals[i][m['id']] || '').trim() === deudaId) { rowIdx = i + 1; break; }
      }
      if (rowIdx === -1) return { ok: false, error: 'Servicio no encontrado.' };
      sh.getRange(rowIdx, m['clienteid'] + 1).setValue(cli.id);
      sh.getRange(rowIdx, m['cliente'] + 1).setValue(cli.nombre);
      sh.getRange(rowIdx, m['clientependiente'] + 1).setValue(false);
      if (m['actualizadoen'] !== undefined) sh.getRange(rowIdx, m['actualizadoen'] + 1).setValue(ahora);
      SpreadsheetApp.flush();
      logAudit_(userSession && userSession.usuarioId, 'ASSIGN_CUSTOMER', 'Trabajos', deudaId, 'Cliente asignado: ' + cli.nombre);
      return { ok: true, result: { deudaTipo: deudaTipo, deudaId: deudaId, clienteId: cli.id, clienteNombre: cli.nombre } };
    }

    if (deudaTipo === 'VENTA_COSECHA') {
      const sh = cosechasHoja_2026('AsignacionesPrecio', PRECIO_CAMPOS_2026);
      asegurarColumnasOpcionales_2026(sh, VENTA_COSECHA_EXTRA_COLS_2026);
      const vals = sh.getDataRange().getValues();
      const m = getHeaderIndexMap_(vals[0]);
      let rowIdx = -1;
      for (let i = 1; i < vals.length; i++) {
        if (String(vals[i][m['id']] || '').trim() === deudaId) { rowIdx = i + 1; break; }
      }
      if (rowIdx === -1) return { ok: false, error: 'Venta de cosecha no encontrada.' };
      const existingRow = vals[rowIdx - 1];
      const oldClienteId = String(existingRow[m['clienteid']] || '').trim();
      const oldCompPend = finParseBool_2026(existingRow[m['compradorpendiente']], !oldClienteId);
      const precioVal = Number(existingRow[m['preciounitario']] !== '' ? existingRow[m['preciounitario']] : existingRow[m['preciousdton']]) || 0;
      const precioPend = finParseBool_2026(existingRow[m['preciopendiente']], precioVal <= 0);
      const oldWasComplete = !oldCompPend && Boolean(oldClienteId) && !precioPend && precioVal > 0;
      const newIsComplete = !precioPend && precioVal > 0;

      const resolvedTerms = ventasCosechaResolverCondiciones_2026({
        isNew: false,
        wasComplete: oldWasComplete,
        isComplete: newIsComplete,
        payload: {},
        completionBaseDate: getBoliviaTodayStr_(),
        existing: {
          fecha: finToIsoDate_2026(existingRow[m['fecha']]),
          fechaCompletado: m['fechacompletado'] !== undefined ? finToIsoDate_2026(existingRow[m['fechacompletado']]) : '',
          plazoDias: existingRow[m['plazodias']],
          fechaVencimiento: existingRow[m['fechavencimiento']],
          aplicarInteres: existingRow[m['aplicarinteres']],
          tasaInteresMensual: existingRow[m['tasainteresmensual']]
        }
      });

      sh.getRange(rowIdx, m['clienteid'] + 1).setValue(cli.id);
      sh.getRange(rowIdx, m['clientenombre'] + 1).setValue(cli.nombre);
      sh.getRange(rowIdx, m['compradorpendiente'] + 1).setValue(false);
      sh.getRange(rowIdx, m['estado'] + 1).setValue(ventasCosechaEstado_2026(false, precioPend));
      sh.getRange(rowIdx, m['plazodias'] + 1).setValue(resolvedTerms.plazoDias);
      sh.getRange(rowIdx, m['fechavencimiento'] + 1).setValue(resolvedTerms.fechaVencimiento);
      if (m['fechacompletado'] !== undefined) {
        sh.getRange(rowIdx, m['fechacompletado'] + 1).setValue(resolvedTerms.fechaCompletado);
      }
      sh.getRange(rowIdx, m['aplicarinteres'] + 1).setValue(resolvedTerms.aplicarInteres);
      sh.getRange(rowIdx, m['tasainteresmensual'] + 1).setValue(resolvedTerms.tasaInteresMensual);
      sh.getRange(rowIdx, m['actualizadoen'] + 1).setValue(ahora);
      SpreadsheetApp.flush();
      logAudit_(userSession && userSession.usuarioId, 'ASSIGN_CUSTOMER', 'AsignacionesPrecio', deudaId, 'Comprador asignado: ' + cli.nombre);
      return { ok: true, result: { deudaTipo: deudaTipo, deudaId: deudaId, clienteId: cli.id, clienteNombre: cli.nombre } };
    }

    return { ok: false, error: 'Tipo de deuda inválido.' };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function finValidarFechaCobroEstricta_2026(rawDate, fallbackIso) {
  if (rawDate === undefined || rawDate === null || String(rawDate).trim() === '') {
    return fallbackIso || getBoliviaTodayStr_();
  }
  const s = String(rawDate).trim();
  let y, m, d;
  const isoM = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dmyM = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (isoM) {
    y = parseInt(isoM[1], 10);
    m = parseInt(isoM[2], 10);
    d = parseInt(isoM[3], 10);
  } else if (dmyM) {
    d = parseInt(dmyM[1], 10);
    m = parseInt(dmyM[2], 10);
    y = parseInt(dmyM[3], 10);
  } else {
    throw new Error('Fecha de cobro inválida ("' + s + '"). Use formato YYYY-MM-DD.');
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== (m - 1) ||
    dt.getUTCDate() !== d ||
    y < 2000 || y > 2100
  ) {
    throw new Error('Fecha de cobro fuera de rango o inexistente: "' + s + '".');
  }
  return String(y) + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

function arLimpiarCobroParcial_2026(cobroId, writtenMovIds) {
  const cid = String(cobroId || '').trim();
  if (!cid) return;
  const movIdSet = {};
  (writtenMovIds || []).forEach(function (mid) {
    if (mid) movIdSet[String(mid).trim()] = true;
  });

  // 1. Eliminar movimientos de interés parciales
  const movSh = findSheetIgnoreCase_('Movimientos');
  const prefix = 'INTERES_COBRO:' + cid + ':';
  if (movSh && movSh.getLastRow() >= 2) {
    const mVals = movSh.getDataRange().getValues();
    const mMap = getHeaderIndexMap_(mVals[0]);
    for (let k = mVals.length - 1; k >= 1; k--) {
      const rid = String(mVals[k][mMap['id']] || '').trim();
      const tid = String(mVals[k][mMap['trabajoid']] || '').trim();
      if (movIdSet[rid] || tid.indexOf(prefix) === 0) {
        movSh.deleteRow(k + 1);
      }
    }
  }

  // 2. Eliminar NotasCobro parciales
  const ncSh = findSheetIgnoreCase_('NotasCobro');
  if (ncSh && ncSh.getLastRow() >= 2) {
    const nVals = ncSh.getDataRange().getValues();
    const nMap = getHeaderIndexMap_(nVals[0]);
    for (let k = nVals.length - 1; k >= 1; k--) {
      if (String(nVals[k][nMap['cobroid']] || '').trim() === cid) {
        ncSh.deleteRow(k + 1);
      }
    }
  }

  // 3. Eliminar CobroAplicaciones parciales
  const appsSh = findSheetIgnoreCase_('CobroAplicaciones');
  if (appsSh && appsSh.getLastRow() >= 2) {
    const aVals = appsSh.getDataRange().getValues();
    const aMap = getHeaderIndexMap_(aVals[0]);
    for (let k = aVals.length - 1; k >= 1; k--) {
      if (String(aVals[k][aMap['cobroid']] || '').trim() === cid) {
        appsSh.deleteRow(k + 1);
      }
    }
  }

  // 4. Eliminar encabezado en Cobros
  const cobrosSh = findSheetIgnoreCase_('Cobros');
  if (cobrosSh && cobrosSh.getLastRow() >= 2) {
    const cVals = cobrosSh.getDataRange().getValues();
    const cMap = getHeaderIndexMap_(cVals[0]);
    for (let k = cVals.length - 1; k >= 1; k--) {
      if (String(cVals[k][cMap['id']] || '').trim() === cid) {
        cobrosSh.deleteRow(k + 1);
      }
    }
  }

  SpreadsheetApp.flush();
}

function arRegistrarCobroInternal_2026(p, userSession) {
  const clienteId = String((p && p.clienteId) || '').trim();
  const cli = clientesBuscarPorId_2026(clienteId);
  if (!cli) return { ok: false, error: 'Cliente no encontrado.' };

  const cobrosSh = cobrosPrepararHoja_2026();
  asegurarColumnasOpcionales_2026(cobrosSh, COBROS_EXTRA_COLS_2026);
  const appsSh = finEnsureSheet_2026('CobroAplicaciones', SHEET_SCHEMAS.CobroAplicaciones);
  const notasCobroSh = finEnsureSheet_2026('NotasCobro', SHEET_SCHEMAS.NotasCobro);

  const idem = String((p && p.idempotencyKey) || '').trim();
  if (idem) {
    const dup = getSheetDataAsObjects('Cobros').find(function (c) {
      return String(c.idempotencyKey || '').trim() === idem;
    });
    if (dup) {
      const dupEstado = String(dup.estadoRegistro || '').trim().toUpperCase();
      if (dupEstado === 'PENDIENTE') {
        // Recuperación automática tras fallo intermedio previo con la misma clave de idempotencia
        arLimpiarCobroParcial_2026(String(dup.id || '').trim(), []);
      } else {
        const docs = arListarDocumentos_2026({ clienteId: clienteId });
        const rec = docs.paymentReceipts.find(function (r) { return r.cobroId === String(dup.id); }) || null;
        const existingApps = getSheetDataAsObjects('CobroAplicaciones').filter(function (a) {
          return String(a.cobroId || '').trim() === String(dup.id || '').trim();
        });
        const paymentExisting = {
          ...dup,
          cobroId: String(dup.id || ''),
          importeOriginalPagado: Number(dup.importeOriginal || dup.importe || 0) || 0,
          aplicaciones: existingApps
        };
        return { ok: true, result: { payment: paymentExisting, receipt: rec }, payment: paymentExisting, receipt: rec };
      }
    }
  }

  const fecha = finValidarFechaCobroEstricta_2026(p.fecha, getBoliviaTodayStr_());
  const rawMon = String(p.monedaPago || 'USD').trim().toUpperCase();
  const monedaPago = rawMon === 'BOB' || rawMon === 'BS' || rawMon === 'BS.' ? 'BOB' : 'USD';
  const tcAplicado = resolverTipoCambioOperacion_2026(p.tcAplicado !== undefined ? p.tcAplicado : p.tc);
  const aplicacionesReq = Array.isArray(p.aplicaciones) ? p.aplicaciones : [];
  if (aplicacionesReq.length === 0) return { ok: false, error: 'Debe seleccionar al menos una deuda para cobrar.' };

  // Calcular deudas exactas a la fecha efectiva del cobro (excluyendo pagos posteriores a fecha)
  const built = arConstruirDeudas_2026(fecha);
  const debtMap = {};
  built.debts.forEach(function (d) { debtMap[d.deudaTipo + ':' + d.deudaId] = d; });

  const cobroId = 'COB-' + Utilities.getUuid().slice(0, 8).toUpperCase();
  const ahora = new Date().toISOString();
  const usuario = String((userSession && userSession.usuarioId) || 'admin');
  const obs = String(p.observacion || '').trim();

  let totalOriginalPagado = 0;
  let totalAplicadoUsd = 0;
  let totalAplicadoBob = 0;
  let capitalAplicadoUsd = 0;
  let interesAplicadoUsd = 0;
  let capitalAplicadoBob = 0;
  let interesAplicadoBob = 0;
  let capitalTotalMonedaPago = 0;
  let interesTotalMonedaPago = 0;
  let todasLiquidadas = true;

  const preparedApps = [];
  const receiptItems = [];
  const seenDebtKeys = {};
  const cumulativeAppliedByDebt = {};

  for (let i = 0; i < aplicacionesReq.length; i++) {
    const req = aplicacionesReq[i] || {};
    const deudaTipoNorm = String(req.deudaTipo || 'TRABAJO').trim().toUpperCase();
    const deudaIdNorm = String(req.deudaId || '').trim();
    if (!deudaIdNorm || (deudaTipoNorm !== 'TRABAJO' && deudaTipoNorm !== 'VENTA_COSECHA')) {
      throw new Error('Referencia de deuda inválida en la solicitud de cobro.');
    }
    const key = deudaTipoNorm + ':' + deudaIdNorm;

    // 1. Impedir aplicaciones duplicadas sobre la misma deuda en una sola solicitud
    if (seenDebtKeys[key]) {
      throw new Error('No se permiten aplicaciones duplicadas sobre la misma deuda (' + key + ') dentro de una misma solicitud.');
    }
    seenDebtKeys[key] = true;

    const debt = debtMap[key];
    if (!debt) throw new Error('Deuda no encontrada: ' + key);
    if (String(debt.clienteId) !== clienteId) throw new Error('La deuda seleccionada no pertenece a este cliente.');
    if (debt.totalPendiente <= 0.005) throw new Error('La deuda "' + debt.concepto + '" ya se encuentra saldada.');

    // 3. Validar fechas de cobro: no antes de la operación ni retroactivo antes del último cobro activo
    if (debt.fecha && fecha < debt.fecha) {
      throw new Error('La fecha del cobro (' + fecha + ') no puede ser anterior a la fecha de la operación (' + debt.fecha + ') de "' + debt.concepto + '".');
    }
    if (debt.maxActivePayDate && fecha < debt.maxActivePayDate) {
      throw new Error('No se permite registrar un cobro retroactivo (' + fecha + ') anterior al último pago registrado (' + debt.maxActivePayDate + ') en "' + debt.concepto + '". Anule el pago posterior antes de corregir el historial.');
    }

    const origPaidRaw = Number(String(req.importeOriginalPagado ?? '').trim().replace(',', '.'));
    if (!Number.isFinite(origPaidRaw) || origPaidRaw <= 0) {
      throw new Error('El importe a pagar debe ser mayor a 0.');
    }
    const origPaid = redondear2_2026(origPaidRaw);
    if (Math.abs(origPaidRaw - origPaid) > 0.0001) {
      throw new Error('El importe a pagar debe tener como máximo dos decimales.');
    }

    const equivDeuda = finConvertCurrency_2026(origPaid, monedaPago, debt.moneda, tcAplicado);
    const prevCumulative = cumulativeAppliedByDebt[key] || 0;
    const saldoDisponible = redondear2_2026(Math.max(0, debt.totalPendiente - prevCumulative));

    if (monedaPago === debt.moneda) {
      if (origPaid > saldoDisponible + 0.005) {
        throw new Error('El importe aplicado (' + origPaid.toFixed(2) + ' ' + debt.moneda + ') supera el saldo pendiente (' + saldoDisponible.toFixed(2) + ' ' + debt.moneda + ') de "' + debt.concepto + '".');
      }
    } else {
      const maxOrigAllowed = finConvertCurrency_2026(saldoDisponible, debt.moneda, monedaPago, tcAplicado);
      if (origPaid > maxOrigAllowed + 0.01 || equivDeuda > saldoDisponible + 0.02) {
        throw new Error('El importe aplicado (' + equivDeuda.toFixed(2) + ' ' + debt.moneda + ') supera el saldo pendiente (' + saldoDisponible.toFixed(2) + ' ' + debt.moneda + ') de "' + debt.concepto + '".');
      }
    }
    const clampedEquiv = redondear2_2026(Math.min(equivDeuda, saldoDisponible));
    cumulativeAppliedByDebt[key] = redondear2_2026(prevCumulative + clampedEquiv);
    if (cumulativeAppliedByDebt[key] > debt.totalPendiente + 0.005) {
      throw new Error('El saldo acumulado aplicado supera el saldo pendiente de "' + debt.concepto + '".');
    }

    // Orden de imputación obligatorio: 1° interés vencido, 2° capital
    const interesPagado = redondear2_2026(Math.min(clampedEquiv, debt.interesAcumulado));
    const capitalPagado = redondear2_2026(Math.min(Math.max(0, clampedEquiv - interesPagado), debt.capitalPendiente));
    const interesRestante = redondear2_2026(Math.max(0, debt.interesAcumulado - interesPagado));
    const saldoCapitalRestante = redondear2_2026(Math.max(0, debt.capitalPendiente - capitalPagado));
    if (saldoCapitalRestante > 0.01 || interesRestante > 0.01) todasLiquidadas = false;

    const appId = 'APP-' + Utilities.getUuid().slice(0, 8).toUpperCase();
    preparedApps.push({
      id: appId,
      debt: debt,
      cobroId: cobroId,
      deudaTipo: debt.deudaTipo,
      deudaId: debt.deudaId,
      clienteId: clienteId,
      moduloOrigen: debt.origen,
      campanaOrigenId: debt.campanaId || '',
      loteOrigenId: debt.loteId || '',
      fechaCobro: fecha,
      monedaDeuda: debt.moneda,
      monedaPago: monedaPago,
      tcAplicado: tcAplicado,
      importeOriginalPagado: origPaid,
      importeEquivalenteDeuda: clampedEquiv,
      saldoCapitalAnterior: debt.capitalPendiente,
      interesAcumuladoAnterior: debt.interesAcumulado,
      interesPagado: interesPagado,
      capitalPagado: capitalPagado,
      saldoCapitalRestante: saldoCapitalRestante,
      interesRestante: interesRestante,
      movimientoInteresId: '',
      anulado: false,
      creadoPor: usuario,
      creadoEn: ahora
    });

    totalOriginalPagado = redondear2_2026(totalOriginalPagado + origPaid);

    // 4. Totales estrictamente separados por moneda de deuda + totales convertidos explícitamente a monedaPago
    if (debt.moneda === 'USD') {
      totalAplicadoUsd = redondear2_2026(totalAplicadoUsd + clampedEquiv);
      capitalAplicadoUsd = redondear2_2026(capitalAplicadoUsd + capitalPagado);
      interesAplicadoUsd = redondear2_2026(interesAplicadoUsd + interesPagado);
    } else {
      totalAplicadoBob = redondear2_2026(totalAplicadoBob + clampedEquiv);
      capitalAplicadoBob = redondear2_2026(capitalAplicadoBob + capitalPagado);
      interesAplicadoBob = redondear2_2026(interesAplicadoBob + interesPagado);
    }

    const intEnMonPago = finConvertCurrency_2026(interesPagado, debt.moneda, monedaPago, tcAplicado);
    const capEnMonPago = debt.moneda === monedaPago
      ? capitalPagado
      : redondear2_2026(Math.max(0, origPaid - intEnMonPago));
    interesTotalMonedaPago = redondear2_2026(interesTotalMonedaPago + intEnMonPago);
    capitalTotalMonedaPago = redondear2_2026(capitalTotalMonedaPago + capEnMonPago);

    receiptItems.push({
      deudaTipo: debt.deudaTipo,
      deudaId: debt.deudaId,
      origen: debt.origen,
      fechaOperacion: debt.fecha,
      concepto: debt.concepto,
      loteNombre: debt.loteNombre || '',
      maquinaNombre: debt.maquinaNombre || '',
      campanaNombre: debt.campanaNombre || '',
      monedaDeuda: debt.moneda,
      monedaPago: monedaPago,
      tcAplicado: tcAplicado,
      importeOriginalPagado: origPaid,
      equivalenteDescontado: clampedEquiv,
      saldoAnterior: debt.totalPendiente,
      interesPagado: interesPagado,
      capitalPagado: capitalPagado,
      importeAplicadoDeuda: clampedEquiv,
      saldoRestante: redondear2_2026(saldoCapitalRestante + interesRestante)
    });
  }

  // Verificar si el cliente tiene otras deudas pendientes no incluidas para definir TOTAL vs PARCIAL
  const paidKeys = {};
  preparedApps.forEach(function (a) { paidKeys[a.deudaTipo + ':' + a.deudaId] = true; });
  const hasOtherPending = built.debts.some(function (d) {
    return String(d.clienteId) === clienteId && d.totalPendiente > 0.005 && !paidKeys[d.deudaTipo + ':' + d.deudaId];
  });
  const tipoPago = (todasLiquidadas && !hasOtherPending) ? 'TOTAL' : 'PARCIAL';

  // Preparar en memoria todas las filas antes de escribir (y resolver campaña por fecha efectiva de cobro)
  const movSheet = findSheetIgnoreCase_('Movimientos');
  const needsInterestIncome = preparedApps.some(function (a) { return a.interesPagado > 0.005; });
  if (needsInterestIncome && !movSheet) {
    throw new Error('Hoja Movimientos no encontrada para registrar el ingreso por interés de mora.');
  }

  const notaNumero = finNextSequentialNumber_2026('NotasCobro', 'NC');
  const notaId = 'NRC-' + Utilities.getUuid().slice(0, 8).toUpperCase();
  const importeUsdTotal = finConvertCurrency_2026(totalOriginalPagado, monedaPago, 'USD', tcAplicado);

  const cobroHeader = {
    id: cobroId,
    trabajoId: preparedApps.length === 1 && preparedApps[0].deudaTipo === 'TRABAJO' ? preparedApps[0].deudaId : '',
    fecha: fecha,
    importe: importeUsdTotal,
    importeOriginal: totalOriginalPagado,
    monedaCobro: monedaPago,
    monedaPago: monedaPago,
    tc: tcAplicado,
    tcAplicado: tcAplicado,
    importeUsd: importeUsdTotal,
    observacion: obs,
    creadoPor: usuario,
    creadoEn: ahora,
    clienteId: cli.id,
    clienteNombre: cli.nombre,
    tipoPago: tipoPago,
    capitalTotalAplicado: capitalTotalMonedaPago,
    interesTotalAplicado: interesTotalMonedaPago,
    monedaTotalesAplicados: monedaPago,
    capitalAplicadoUsd: capitalAplicadoUsd,
    interesAplicadoUsd: interesAplicadoUsd,
    capitalAplicadoBob: capitalAplicadoBob,
    interesAplicadoBob: interesAplicadoBob,
    notaCobroNumero: notaNumero,
    anulado: false,
    estadoRegistro: 'PENDIENTE',
    idempotencyKey: idem
  };

  const receiptRecord = {
    id: notaId,
    numero: notaNumero,
    cobroId: cobroId,
    fecha: fecha,
    clienteId: cli.id,
    clienteNombre: cli.nombre,
    clienteTelefono: cli.telefono,
    clienteDireccion: cli.direccion,
    tipoPago: tipoPago,
    monedaPago: monedaPago,
    importeOriginalPagado: totalOriginalPagado,
    tcAplicado: tcAplicado,
    totalAplicadoUsd: totalAplicadoUsd,
    totalAplicadoBob: totalAplicadoBob,
    snapshotJson: JSON.stringify({
      items: receiptItems,
      monedaTotalesAplicados: monedaPago,
      capitalTotalAplicado: capitalTotalMonedaPago,
      interesTotalAplicado: interesTotalMonedaPago,
      porMoneda: {
        USD: { capital: capitalAplicadoUsd, interes: interesAplicadoUsd, total: totalAplicadoUsd },
        BOB: { capital: capitalAplicadoBob, interes: interesAplicadoBob, total: totalAplicadoBob }
      }
    }),
    observacion: obs,
    anulado: false,
    creadoPor: usuario,
    creadoEn: ahora
  };

  // Fase de escritura transaccional con encabezado PENDIENTE primero y reversión completa ante error intermedio
  const writtenMovIds = [];
  let headerRowIdx = -1;
  try {
    // Paso 1: Escribir encabezado en Cobros como PENDIENTE (ancla la clave de idempotencia desde el inicio)
    finAppendObj_2026(cobrosSh, cobroHeader);
    headerRowIdx = cobrosSh.getLastRow();

    // Paso 2: Escribir ingresos por interés cobrado (distribuidos por lote y campaña de origen en ventas de cosecha) y aplicaciones
    let ensuredConcept = false;
    for (let i = 0; i < preparedApps.length; i++) {
      const app = preparedApps[i];
      if (app.interesPagado > 0.005 && movSheet) {
        if (!ensuredConcept) {
          finEnsureInterestConcept_2026();
          ensuredConcept = true;
        }
        const moduloDestino = app.moduloOrigen === 'PROPIEDAD' ? 'PROPIEDAD' : 'MAQUINARIAS';
        const saleDists = (moduloDestino === 'PROPIEDAD' && app.deudaTipo === 'VENTA_COSECHA' && Array.isArray(app.debt.distribuciones))
          ? app.debt.distribuciones.filter(function (d) { return d && !d.anulada && Number(d.toneladasAsignadas || 0) > 0; })
          : [];

        if (moduloDestino === 'PROPIEDAD' && saleDists.length > 0) {
          // Distribuir el interés cobrado entre los lotes y campañas de origen según participación monetaria
          const totalIntCents = Math.round(redondear2_2026(app.interesPagado) * 100);
          const weights = saleDists.map(function (d) {
            const w = Number(d.importeAsignado || 0);
            return w > 0 ? w : Number(d.toneladasAsignadas || 0);
          });
          const sumWeights = weights.reduce(function (s, w) { return s + w; }, 0);
          const exactCents = weights.map(function (w) { return sumWeights > 0 ? (totalIntCents * w) / sumWeights : 0; });
          const partCents = exactCents.map(function (v) { return Math.floor(v); });
          let remInt = totalIntCents - partCents.reduce(function (s, c) { return s + c; }, 0);
          const intOrder = saleDists.map(function (d, idx) {
            return { idx: idx, frac: exactCents[idx] - Math.floor(exactCents[idx]), w: weights[idx], id: String(d.cosechaId || idx) };
          }).sort(function (a, b) {
            if (Math.abs(b.frac - a.frac) > 1e-12) return b.frac - a.frac;
            if (b.w !== a.w) return b.w - a.w;
            return a.id.localeCompare(b.id);
          });
          for (let j = 0; j < intOrder.length && remInt > 0; j++) {
            partCents[intOrder[j].idx] += 1;
            remInt -= 1;
          }

          const createdIntIds = [];
          for (let j = 0; j < saleDists.length; j++) {
            if (partCents[j] <= 0) continue;
            const d = saleDists[j];
            const partAmt = partCents[j] / 100;
            const movIntId = Utilities.getUuid();
            createdIntIds.push(movIntId);
            finAppendObj_2026(movSheet, {
              id: movIntId,
              fecha: fecha,
              campanaId: String(d.campanaId || app.campanaOrigenId || finResolverCampanaPorFecha_2026(fecha, app.campanaOrigenId)),
              modulo: 'PROPIEDAD',
              clase: 'INGRESO',
              itemId: 'SYS_INTERES_MORA',
              descripcion: 'Interés por mora - ' + cli.nombre + ' (' + app.debt.concepto + ')',
              loteId: String(d.loteId || ''),
              maquinaId: '',
              cantidad: 1,
              unidad: 'mora',
              precioUnitario: partAmt,
              importe: partAmt,
              moneda: app.monedaDeuda,
              tc: tcAplicado,
              trabajoId: 'INTERES_COBRO:' + cobroId + ':' + app.id,
              creadoPor: usuario,
              creadoEn: ahora,
              actualizadoEn: ahora
            });
            writtenMovIds.push(movIntId);
          }
          app.movimientoInteresId = createdIntIds.join(',');
        } else {
          const movIntId = Utilities.getUuid();
          app.movimientoInteresId = movIntId;
          const campForIncome = moduloDestino === 'PROPIEDAD'
            ? String(app.campanaOrigenId || finResolverCampanaPorFecha_2026(fecha, app.campanaOrigenId))
            : finResolverCampanaPorFecha_2026(fecha, app.campanaOrigenId);
          finAppendObj_2026(movSheet, {
            id: movIntId,
            fecha: fecha,
            campanaId: campForIncome,
            modulo: moduloDestino,
            clase: 'INGRESO',
            itemId: 'SYS_INTERES_MORA',
            descripcion: 'Interés por mora - ' + cli.nombre + ' (' + app.debt.concepto + ')',
            loteId: moduloDestino === 'PROPIEDAD' ? (app.loteOrigenId || '') : '',
            maquinaId: moduloDestino === 'MAQUINARIAS' ? (app.debt.maquinaId || '') : '',
            cantidad: 1,
            unidad: 'mora',
            precioUnitario: app.interesPagado,
            importe: app.interesPagado,
            moneda: app.monedaDeuda,
            tc: tcAplicado,
            trabajoId: 'INTERES_COBRO:' + cobroId + ':' + app.id,
            creadoPor: usuario,
            creadoEn: ahora,
            actualizadoEn: ahora
          });
          writtenMovIds.push(movIntId);
        }
      }
      const appToSave = { ...app };
      delete appToSave.debt;
      finAppendObj_2026(appsSh, appToSave);
    }

    // Paso 3: Escribir Nota de Cobro correlativa
    finAppendObj_2026(notasCobroSh, receiptRecord);

    // Paso 4: Confirmar encabezado del cobro (CONFIRMADO)
    const cHeaders = getSheetHeaders_(cobrosSh);
    const cMap = getHeaderIndexMap_(cHeaders);
    if (cMap['estadoregistro'] !== undefined) {
      // Verificar que headerRowIdx sigue correspondiendo a cobroId
      let confirmRow = headerRowIdx;
      if (confirmRow < 2 || String(cobrosSh.getRange(confirmRow, cMap['id'] + 1).getValue() || '').trim() !== cobroId) {
        const cVals = cobrosSh.getDataRange().getValues();
        for (let rIdx = cVals.length - 1; rIdx >= 1; rIdx--) {
          if (String(cVals[rIdx][cMap['id']] || '').trim() === cobroId) {
            confirmRow = rIdx + 1;
            break;
          }
        }
      }
      if (confirmRow >= 2) {
        cobrosSh.getRange(confirmRow, cMap['estadoregistro'] + 1).setValue('CONFIRMADO');
      }
    }
    cobroHeader.estadoRegistro = 'CONFIRMADO';
    SpreadsheetApp.flush();
  } catch (writeErr) {
    try {
      arLimpiarCobroParcial_2026(cobroId, writtenMovIds);
    } catch (cleanupErr) {
      Logger.log('Error al limpiar cobro parcial ' + cobroId + ': ' + cleanupErr.message);
    }
    throw new Error('Error al guardar el cobro (se revirtieron los registros parciales): ' + writeErr.message);
  }

  logAudit_(usuario, 'CREATE', 'Cobros', cobroId, notaNumero + ' | ' + cli.nombre + ' | ' + totalOriginalPagado + ' ' + monedaPago);

  const paymentOut = {
    ...cobroHeader,
    cobroId: cobroId,
    importeOriginalPagado: totalOriginalPagado,
    aplicaciones: preparedApps.map(function (a) { const x = { ...a }; delete x.debt; return x; })
  };
  const receiptOut = { ...receiptRecord, items: receiptItems };
  return { ok: true, result: { payment: paymentOut, receipt: receiptOut }, payment: paymentOut, receipt: receiptOut };
}

function arRegistrarCobro_2026(p, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return arRegistrarCobroInternal_2026(p, userSession);
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function arAnularCobro_2026(p, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const cobroId = String((p && (p.cobroId || p.id)) || '').trim();
    if (!cobroId) return { ok: false, error: 'Se requiere el ID del cobro a anular.' };

    const cobrosSh = cobrosPrepararHoja_2026();
    asegurarColumnasOpcionales_2026(cobrosSh, COBROS_EXTRA_COLS_2026);
    const cVals = cobrosSh.getDataRange().getValues();
    const cMap = getHeaderIndexMap_(cVals[0]);
    let foundCobroRow = -1;
    for (let i = 1; i < cVals.length; i++) {
      if (String(cVals[i][cMap['id']] || '').trim() === cobroId) {
        foundCobroRow = i + 1;
        break;
      }
    }
    if (foundCobroRow === -1) return { ok: false, error: 'Cobro no encontrado.' };

    const cobroYaAnulado = finParseBool_2026(cVals[foundCobroRow - 1][cMap['anulado']], false);
    const oldCobroEstado = cMap['estadoregistro'] !== undefined ? cVals[foundCobroRow - 1][cMap['estadoregistro']] : '';

    // Inspeccionar estado actual en hojas hijas para soportar recuperación idempotente de anulaciones interrumpidas
    const appsSh = findSheetIgnoreCase_('CobroAplicaciones');
    const appsToAnnul = [];
    const movIdsToDelete = {};
    if (appsSh && appsSh.getLastRow() >= 2) {
      const aVals = appsSh.getDataRange().getValues();
      const aMap = getHeaderIndexMap_(aVals[0]);
      for (let i = 1; i < aVals.length; i++) {
        if (String(aVals[i][aMap['cobroid']] || '').trim() === cobroId) {
          const midRaw = String(aVals[i][aMap['movimientointeresid']] || '').trim();
          if (midRaw) {
            midRaw.split(',').forEach(function (part) {
              const cleanPart = String(part || '').trim();
              if (cleanPart) movIdsToDelete[cleanPart] = true;
            });
          }
          if (!finParseBool_2026(aVals[i][aMap['anulado']], false)) {
            appsToAnnul.push({ rowIdx: i + 1, colIdx: aMap['anulado'] + 1 });
          }
        }
      }
    }

    const ncSh = findSheetIgnoreCase_('NotasCobro');
    const notasToAnnul = [];
    if (ncSh && ncSh.getLastRow() >= 2) {
      const nVals = ncSh.getDataRange().getValues();
      const nMap = getHeaderIndexMap_(nVals[0]);
      for (let i = 1; i < nVals.length; i++) {
        if (String(nVals[i][nMap['cobroid']] || '').trim() === cobroId) {
          if (!finParseBool_2026(nVals[i][nMap['anulado']], false)) {
            notasToAnnul.push({ rowIdx: i + 1, colIdx: nMap['anulado'] + 1 });
          }
        }
      }
    }

    const movSh = findSheetIgnoreCase_('Movimientos');
    const prefix = 'INTERES_COBRO:' + cobroId + ':';
    const movRowsToDelete = [];
    if (movSh && movSh.getLastRow() >= 2) {
      const mVals = movSh.getDataRange().getValues();
      const mMap = getHeaderIndexMap_(mVals[0]);
      for (let k = mVals.length - 1; k >= 1; k--) {
        const rid = String(mVals[k][mMap['id']] || '').trim();
        const tid = String(mVals[k][mMap['trabajoid']] || '').trim();
        if (movIdsToDelete[rid] || tid.indexOf(prefix) === 0) {
          movRowsToDelete.push({ rowIdx: k + 1, values: mVals[k].slice() });
        }
      }
    }

    if (cobroYaAnulado && appsToAnnul.length === 0 && notasToAnnul.length === 0 && movRowsToDelete.length === 0) {
      return { ok: false, error: 'Este cobro ya se encuentra anulado.' };
    }

    const modifiedApps = [];
    const modifiedNotas = [];
    const deletedMovValues = [];
    let cobroMarked = false;

    try {
      // 1. Marcar CobroAplicaciones.anulado = true
      for (let i = 0; i < appsToAnnul.length; i++) {
        appsSh.getRange(appsToAnnul[i].rowIdx, appsToAnnul[i].colIdx).setValue(true);
        modifiedApps.push(appsToAnnul[i]);
      }

      // 2. Marcar NotasCobro.anulado = true
      for (let i = 0; i < notasToAnnul.length; i++) {
        ncSh.getRange(notasToAnnul[i].rowIdx, notasToAnnul[i].colIdx).setValue(true);
        modifiedNotas.push(notasToAnnul[i]);
      }

      // 3. Eliminar movimientos de interés por mora vinculados (de abajo hacia arriba)
      for (let i = 0; i < movRowsToDelete.length; i++) {
        movSh.deleteRow(movRowsToDelete[i].rowIdx);
        deletedMovValues.push(movRowsToDelete[i].values);
      }

      // 4. Marcar Cobros.anulado = true al final (si falla antes, reintentar converge sin falsos positivos)
      if (!cobroYaAnulado) {
        cobrosSh.getRange(foundCobroRow, cMap['anulado'] + 1).setValue(true);
        if (cMap['estadoregistro'] !== undefined) {
          cobrosSh.getRange(foundCobroRow, cMap['estadoregistro'] + 1).setValue('ANULADO');
        }
        cobroMarked = true;
      }

      SpreadsheetApp.flush();
    } catch (cancelErr) {
      // Reversión de emergencia si ocurrió un fallo intermedio durante la anulación
      try {
        if (cobroMarked && !cobroYaAnulado) {
          cobrosSh.getRange(foundCobroRow, cMap['anulado'] + 1).setValue(false);
          if (cMap['estadoregistro'] !== undefined) {
            cobrosSh.getRange(foundCobroRow, cMap['estadoregistro'] + 1).setValue(oldCobroEstado);
          }
        }
        for (let i = deletedMovValues.length - 1; i >= 0; i--) {
          movSh.appendRow(deletedMovValues[i]);
        }
        for (let i = 0; i < modifiedNotas.length; i++) {
          ncSh.getRange(modifiedNotas[i].rowIdx, modifiedNotas[i].colIdx).setValue(false);
        }
        for (let i = 0; i < modifiedApps.length; i++) {
          appsSh.getRange(modifiedApps[i].rowIdx, modifiedApps[i].colIdx).setValue(false);
        }
        SpreadsheetApp.flush();
      } catch (rbErr) {
        Logger.log('Error en rollback de anulación ' + cobroId + ': ' + rbErr.message);
      }
      throw new Error('Error al anular el cobro (se revirtieron los cambios parciales): ' + cancelErr.message);
    }

    logAudit_(userSession && userSession.usuarioId, 'CANCEL', 'Cobros', cobroId, 'Cobro anulado e intereses revertidos');
    return { ok: true, result: { cobroId: cobroId, anulado: true } };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function arCrearNotaDebito_2026(p, userSession) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const clienteId = String((p && p.clienteId) || '').trim();
    const cli = clientesBuscarPorId_2026(clienteId);
    if (!cli) return { ok: false, error: 'Cliente no encontrado.' };

    const sh = finEnsureSheet_2026('NotasDebito', SHEET_SCHEMAS.NotasDebito);
    const idem = String((p && p.idempotencyKey) || '').trim();
    if (idem) {
      const dup = getSheetDataAsObjects('NotasDebito').find(function (n) {
        return String(n.idempotencyKey || '').trim() === idem;
      });
      if (dup) {
        const docs = arListarDocumentos_2026({ clienteId: clienteId });
        const found = docs.debitNotes.find(function (d) { return d.id === String(dup.id); });
        return { ok: true, result: found || dup, debitNote: found || dup };
      }
    }

    const fecha = validarFechaIso_2026(p.fecha, getBoliviaTodayStr_());
    const reqDeudas = Array.isArray(p.deudas) ? p.deudas : [];
    if (reqDeudas.length === 0) return { ok: false, error: 'Seleccione al menos una deuda pendiente para emitir la nota de débito.' };

    const built = arConstruirDeudas_2026(fecha);
    const debtMap = {};
    built.debts.forEach(function (d) { debtMap[d.deudaTipo + ':' + d.deudaId] = d; });

    const items = [];
    let totalUsd = 0;
    let totalBob = 0;

    for (let i = 0; i < reqDeudas.length; i++) {
      const ref = reqDeudas[i];
      const key = String(ref.deudaTipo || 'TRABAJO').toUpperCase() + ':' + String(ref.deudaId || '').trim();
      const debt = debtMap[key];
      if (!debt) throw new Error('Deuda no encontrada: ' + key);
      if (String(debt.clienteId) !== clienteId) throw new Error('Todas las deudas deben pertenecer al mismo cliente.');
      if (debt.totalPendiente <= 0.005) continue;

      items.push({
        deudaTipo: debt.deudaTipo,
        deudaId: debt.deudaId,
        origen: debt.origen,
        fechaOperacion: debt.fecha,
        concepto: debt.concepto,
        campanaNombre: debt.campanaNombre || '',
        loteNombre: debt.loteNombre || '',
        maquinaNombre: debt.maquinaNombre || '',
        cantidad: debt.cantidad,
        unidad: debt.unidad,
        precioUnitario: debt.precioUnitario,
        moneda: debt.moneda,
        importeOriginal: debt.importeOriginal,
        pagosAnteriores: debt.pagosAnteriores,
        capitalPendiente: debt.capitalPendiente,
        fechaVencimiento: debt.fechaVencimiento,
        diasAtraso: debt.diasAtraso,
        tasaInteresMensual: debt.tasaInteresMensual,
        interesAcumulado: debt.interesAcumulado,
        totalPendiente: debt.totalPendiente
      });
      if (debt.moneda === 'USD') totalUsd = redondear2_2026(totalUsd + debt.totalPendiente);
      else totalBob = redondear2_2026(totalBob + debt.totalPendiente);
    }

    if (items.length === 0) return { ok: false, error: 'Las deudas seleccionadas no tienen saldo pendiente.' };

    const numero = finNextSequentialNumber_2026('NotasDebito', 'ND');
    const id = 'NDB-' + Utilities.getUuid().slice(0, 8).toUpperCase();
    const ahora = new Date().toISOString();
    const usuario = String((userSession && userSession.usuarioId) || 'admin');
    const obs = String(p.observacion || '').trim();

    const record = {
      id: id,
      numero: numero,
      fecha: fecha,
      clienteId: cli.id,
      clienteNombre: cli.nombre,
      clienteTelefono: cli.telefono,
      clienteDireccion: cli.direccion,
      totalUsd: totalUsd,
      totalBob: totalBob,
      snapshotJson: JSON.stringify({ items: items }),
      observacion: obs,
      creadoPor: usuario,
      creadoEn: ahora,
      idempotencyKey: idem
    };

    finAppendObj_2026(sh, record);
    SpreadsheetApp.flush();
    logAudit_(usuario, 'CREATE', 'NotasDebito', id, numero + ' | ' + cli.nombre);

    const out = { ...record, items: items };
    return { ok: true, result: out, debitNote: out };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

// -------------------------------------------------------------
// 5. MIGRACIÓN NO DESTRUCTIVA E IDEMPOTENTE (2026)
// Ejecutar manualmente en Apps Script tras desplegar el código.
// -------------------------------------------------------------

function finNormNameLoose_2026(s) {
  return finNormName_2026(s).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function migrarEstructuraFinanciera2026() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const summary = {
      ok: true,
      hojasCreadasOVerificadas: [],
      columnasAgregadas: [],
      conceptoInteresCreado: false,
      clientesMigrados: 0,
      trabajosVinculados: 0,
      trabajosOmitidosPorAmbiguedad: 0,
      clientesAmbiguos: [],
      detalleOmitidosPorAmbiguedad: []
    };

    // 1. Crear o verificar hojas nuevas
    ['Clientes', 'CobroAplicaciones', 'NotasDebito', 'NotasCobro'].forEach(function (name) {
      finEnsureSheet_2026(name, SHEET_SCHEMAS[name]);
      summary.hojasCreadasOVerificadas.push(name);
    });
    cobrosPrepararHoja_2026();
    cosechasHoja_2026('Cosechas', COSECHA_CAMPOS_2026);
    cosechasHoja_2026('AsignacionesPrecio', PRECIO_CAMPOS_2026);

    // 2. Asegurar columnas opcionales sin borrar ni reordenar datos existentes
    const trabajosSh = findSheetIgnoreCase_('Trabajos');
    if (trabajosSh) {
      asegurarColumnasOpcionales_2026(trabajosSh, ['clienteId', 'clientePendiente', 'plazoDias', 'fechaVencimiento', 'aplicarInteres', 'tasaInteresMensual']);
      summary.columnasAgregadas.push('Trabajos');
    }
    const asigSh = findSheetIgnoreCase_('AsignacionesPrecio');
    if (asigSh) {
      asegurarColumnasOpcionales_2026(asigSh, VENTA_COSECHA_EXTRA_COLS_2026);
      summary.columnasAgregadas.push('AsignacionesPrecio');
    }
    const cobrosSh = findSheetIgnoreCase_('Cobros');
    if (cobrosSh) {
      asegurarColumnasOpcionales_2026(cobrosSh, COBROS_EXTRA_COLS_2026);
      summary.columnasAgregadas.push('Cobros');
    }
    const cosechasSh = findSheetIgnoreCase_('Cosechas');
    if (cosechasSh) {
      asegurarColumnasOpcionales_2026(cosechasSh, ['actualizadoEn']);
      summary.columnasAgregadas.push('Cosechas');
    }

    // 3. Asegurar concepto de sistema Interés por mora
    summary.conceptoInteresCreado = finEnsureInterestConcept_2026();

    // 4. Migrar nombres históricos de clientes desde Trabajos → Clientes evitando vinculaciones ambiguas
    const clientesSh = findSheetIgnoreCase_('Clientes');
    if (trabajosSh && clientesSh && trabajosSh.getLastRow() >= 2) {
      const existingClientes = getSheetDataAsObjects('Clientes');
      const existingByNorm = {};
      const existingByLoose = {};

      existingClientes.forEach(function (c) {
        if (!c || !c.nombre || !c.id) return;
        const cid = String(c.id).trim();
        const cname = String(c.nombre).trim();
        const norm = finNormName_2026(cname);
        const loose = finNormNameLoose_2026(cname);
        if (!existingByNorm[norm]) existingByNorm[norm] = [];
        existingByNorm[norm].push({ id: cid, nombre: cname });
        if (loose) {
          if (!existingByLoose[loose]) existingByLoose[loose] = [];
          existingByLoose[loose].push({ id: cid, nombre: cname });
        }
      });

      const tVals = trabajosSh.getDataRange().getValues();
      const tMap = getHeaderIndexMap_(tVals[0]);
      const ahora = new Date().toISOString();

      // Pre-escaneo de nombres históricos en Trabajos para detectar colisiones de normalización laxa (ej. "Agro-Sur" vs "Agro Sur")
      const legacyNormsByLoose = {};
      for (let i = 1; i < tVals.length; i++) {
        const dest = String(tVals[i][tMap['destino']] || '').toUpperCase();
        if (dest !== 'TERCERO') continue;
        const currentCid = String(tVals[i][tMap['clienteid']] || '').trim();
        if (currentCid) continue;
        const legacyName = String(tVals[i][tMap['cliente']] || '').trim().replace(/\s+/g, ' ');
        if (!legacyName) continue;
        const norm = finNormName_2026(legacyName);
        const loose = finNormNameLoose_2026(legacyName);
        if (!loose) continue;
        if (!legacyNormsByLoose[loose]) legacyNormsByLoose[loose] = {};
        legacyNormsByLoose[loose][norm] = legacyName;
      }

      const ambiguousReported = {};
      const registerAmbiguity = function (key, motivo, candidatos) {
        if (ambiguousReported[key]) return;
        ambiguousReported[key] = true;
        summary.clientesAmbiguos.push({
          clave: key,
          motivo: motivo,
          candidatos: candidatos
        });
      };

      const createdByNorm = {};
      const createdByLoose = {};

      for (let i = 1; i < tVals.length; i++) {
        const dest = String(tVals[i][tMap['destino']] || '').toUpperCase();
        if (dest !== 'TERCERO') continue;
        const currentCid = String(tVals[i][tMap['clienteid']] || '').trim();
        if (currentCid) continue;
        const legacyName = String(tVals[i][tMap['cliente']] || '').trim().replace(/\s+/g, ' ');
        if (!legacyName) continue;

        const trabajoId = String(tVals[i][tMap['id']] || ('ROW-' + (i + 1))).trim();
        const norm = finNormName_2026(legacyName);
        const loose = finNormNameLoose_2026(legacyName);

        const normMatches = existingByNorm[norm] || [];
        const looseMatches = loose ? (existingByLoose[loose] || []) : [];
        const distinctLegacyForLoose = loose && legacyNormsByLoose[loose] ? Object.keys(legacyNormsByLoose[loose]) : [];

        // Caso A: Múltiples clientes existentes comparten el mismo nombre normalizado -> AMBIGUO
        if (normMatches.length > 1) {
          const candIds = normMatches.map(function (x) { return x.id; });
          registerAmbiguity(norm, 'Múltiples clientes existentes comparten el mismo nombre normalizado', normMatches);
          summary.trabajosOmitidosPorAmbiguedad += 1;
          summary.detalleOmitidosPorAmbiguedad.push({
            trabajoId: trabajoId,
            clienteTexto: legacyName,
            motivo: 'Múltiples clientes en catálogo con el mismo nombre normalizado',
            candidatosIds: candIds
          });
          if (tMap['clientependiente'] !== undefined && String(tVals[i][tMap['clientependiente']] || '').trim() === '') {
            trabajosSh.getRange(i + 1, tMap['clientependiente'] + 1).setValue(true);
          }
          continue;
        }

        // Caso B: Colisión con cliente(s) existente(s) que difieren solo en puntuación/separadores -> AMBIGUO
        if (looseMatches.length > 1 || (normMatches.length === 0 && looseMatches.length >= 1)) {
          const candIds = looseMatches.map(function (x) { return x.id; });
          registerAmbiguity(loose || norm, 'Coincidencia ambigua por puntuación o variantes en catálogo Clientes', looseMatches);
          summary.trabajosOmitidosPorAmbiguedad += 1;
          summary.detalleOmitidosPorAmbiguedad.push({
            trabajoId: trabajoId,
            clienteTexto: legacyName,
            motivo: 'Coincidencia ambigua con clientes existentes en catálogo',
            candidatosIds: candIds
          });
          if (tMap['clientependiente'] !== undefined && String(tVals[i][tMap['clientependiente']] || '').trim() === '') {
            trabajosSh.getRange(i + 1, tMap['clientependiente'] + 1).setValue(true);
          }
          continue;
        }

        // Caso C: Sin cliente existente, pero múltiples variantes históricas en Trabajos colisionan en clave laxa -> AMBIGUO
        if (normMatches.length === 0 && distinctLegacyForLoose.length > 1) {
          const variants = distinctLegacyForLoose.map(function (k) { return legacyNormsByLoose[loose][k]; });
          registerAmbiguity(loose, 'Múltiples variantes de nombre histórico en Trabajos', variants);
          summary.trabajosOmitidosPorAmbiguedad += 1;
          summary.detalleOmitidosPorAmbiguedad.push({
            trabajoId: trabajoId,
            clienteTexto: legacyName,
            motivo: 'Múltiples variantes de nombre histórico requieren confirmación manual',
            candidatosIds: []
          });
          if (tMap['clientependiente'] !== undefined && String(tVals[i][tMap['clientependiente']] || '').trim() === '') {
            trabajosSh.getRange(i + 1, tMap['clientependiente'] + 1).setValue(true);
          }
          continue;
        }

        // Caso seguro e inequívoco: exactamente 1 cliente existente o 1 nombre histórico único
        let cid = normMatches.length === 1 ? normMatches[0].id : (createdByNorm[norm] || (loose ? createdByLoose[loose] : ''));
        if (!cid) {
          cid = 'CLI-' + Utilities.getUuid().slice(0, 8).toUpperCase();
          finAppendObj_2026(clientesSh, {
            id: cid,
            nombre: legacyName,
            telefono: '',
            direccion: '',
            activo: true,
            creadoEn: ahora,
            actualizadoEn: ahora
          });
          createdByNorm[norm] = cid;
          if (loose) createdByLoose[loose] = cid;
          existingByNorm[norm] = [{ id: cid, nombre: legacyName }];
          if (loose) existingByLoose[loose] = [{ id: cid, nombre: legacyName }];
          summary.clientesMigrados += 1;
        }
        trabajosSh.getRange(i + 1, tMap['clienteid'] + 1).setValue(cid);
        trabajosSh.getRange(i + 1, tMap['clientependiente'] + 1).setValue(false);
        summary.trabajosVinculados += 1;
      }
    }

    SpreadsheetApp.flush();
    Logger.log(JSON.stringify(summary));
    return summary;
  } finally {
    lock.releaseLock();
  }
}

// -------------------------------------------------------------
// 6. MIGRACIÓN NO DESTRUCTIVA E IDEMPOTENTE DEL ALMACÉN GENERAL DE COSECHAS (2026)
// Ejecutar manualmente en Apps Script tras desplegar el código actualizado.
// -------------------------------------------------------------

function migrarAlmacenCosechas2026() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const report = {
      ok: true,
      hojasCreadasOVerificadas: [],
      columnasAgregadas: [],
      cosechasUnidadNormalizada: 0,
      ventasMigradasADistribucion: 0,
      ventasYaMigradas: 0,
      ventasAnuladasOmitidas: 0,
      registrosAmbiguos: [],
      ingresosDirectosHeredados: []
    };

    // 1. Crear o verificar DistribucionesVenta y hojas vinculadas
    const shDist = finEnsureSheet_2026('DistribucionesVenta', DISTRIBUCIONES_VENTA_CAMPOS_2026);
    report.hojasCreadasOVerificadas.push('DistribucionesVenta');
    const shCosechas = cosechasHoja_2026('Cosechas', COSECHA_CAMPOS_2026);
    asegurarColumnasOpcionales_2026(shCosechas, COSECHA_EXTRA_COLS_2026);
    report.columnasAgregadas.push('Cosechas');
    const shAsig = cosechasHoja_2026('AsignacionesPrecio', PRECIO_CAMPOS_2026);
    asegurarColumnasOpcionales_2026(shAsig, VENTA_COSECHA_EXTRA_COLS_2026);
    report.columnasAgregadas.push('AsignacionesPrecio');

    // 2. Completar unidad='t' únicamente donde esté vacía en Cosechas (sin alterar cantidades históricas)
    const cVals = shCosechas.getDataRange().getValues();
    if (cVals.length >= 2) {
      const cMap = getHeaderIndexMap_(cVals[0]);
      if (cMap['unidad'] !== undefined) {
        for (let i = 1; i < cVals.length; i++) {
          const cid = String(cVals[i][cMap['id']] || '').trim();
          if (!cid) continue;
          const curU = String(cVals[i][cMap['unidad']] || '').trim();
          if (!curU) {
            shCosechas.getRange(i + 1, cMap['unidad'] + 1).setValue('t');
            report.cosechasUnidadNormalizada += 1;
          }
        }
      }
    }

    const cosechasMap = {};
    getSheetDataAsObjects('Cosechas').forEach(function (c) {
      if (c && c.id) cosechasMap[String(c.id).trim()] = c;
    });
    const lotesMap = {};
    getSheetDataAsObjects('Lotes').forEach(function (l) {
      if (l && l.id) lotesMap[String(l.id).trim()] = l;
    });

    // 3. Detectar ventas que ya tienen distribuciones activas en DistribucionesVenta (idempotencia)
    const existingDistByVenta = {};
    getSheetDataAsObjects('DistribucionesVenta').forEach(function (d) {
      const vid = String(d.ventaId || '').trim();
      if (!vid || finParseBool_2026(d.anulada, false)) return;
      if (!existingDistByVenta[vid]) existingDistByVenta[vid] = [];
      existingDistByVenta[vid].push(d);
    });

    // 4. Migrar ventas históricas de cosecha única -> fila 100% en DistribucionesVenta (sin duplicar ventas ni ingresos)
    const aVals = shAsig.getDataRange().getValues();
    const ahora = new Date().toISOString();
    if (aVals.length >= 2) {
      const aMap = getHeaderIndexMap_(aVals[0]);
      for (let i = 1; i < aVals.length; i++) {
        const row = aVals[i];
        const ventaId = String(row[aMap['id']] || '').trim();
        if (!ventaId) continue;

        if (finParseBool_2026(row[aMap['anulada']], false)) {
          report.ventasAnuladasOmitidas += 1;
          continue;
        }
        if (String(row[aMap['estadoregistro']] || '').trim().toUpperCase() === 'PENDIENTE') {
          report.registrosAmbiguos.push({
            tipo: 'VENTA_PENDIENTE_INCOMPLETA',
            ventaId: ventaId,
            motivo: 'Encabezado de venta en estado PENDIENTE sin confirmar; requiere revisión manual.'
          });
          continue;
        }

        if (existingDistByVenta[ventaId] && existingDistByVenta[ventaId].length > 0) {
          report.ventasYaMigradas += 1;
          continue;
        }

        const cosechaId = String(row[aMap['cosechaid']] || '').trim();
        const cant = almacenRedondearQty4_2026(Number(row[aMap['toneladas']] || 0));
        if (!cosechaId || !cosechasMap[cosechaId] || cant <= 0) {
          report.registrosAmbiguos.push({
            tipo: 'VENTA_SIN_COSECHA_VALIDA',
            ventaId: ventaId,
            cosechaId: cosechaId,
            toneladas: cant,
            motivo: 'La venta histórica no apunta a una cosecha válida en Cosechas; no se inventó distribución.'
          });
          continue;
        }

        const cObj = cosechasMap[cosechaId];
        const loteId = String(row[aMap['loteid']] || cObj.loteId || '').trim();
        const campanaId = String(cObj.campanaId || row[aMap['campanaid']] || '').trim();
        const producto = String(row[aMap['producto']] || cObj.producto || 'Cosecha').trim();
        const unidad = almacenNormalizarUnidad_2026(row[aMap['unidad']] || cObj.unidad || 't').canonicalUnit;
        const precioRaw = row[aMap['preciounitario']] !== '' && row[aMap['preciounitario']] !== undefined
          ? Number(row[aMap['preciounitario']])
          : Number(row[aMap['preciousdton']] || 0);
        const precioPend = row[aMap['preciopendiente']] !== '' && row[aMap['preciopendiente']] !== undefined
          ? finParseBool_2026(row[aMap['preciopendiente']], precioRaw <= 0)
          : precioRaw <= 0;
        const precioUnitario = precioPend ? 0 : (Number.isFinite(precioRaw) ? precioRaw : 0);
        const monedaRaw = String(row[aMap['moneda']] || 'USD').trim().toUpperCase();
        const moneda = monedaRaw === 'BOB' || monedaRaw === 'BS' ? 'BOB' : 'USD';
        const tc = Number(row[aMap['tc']]) > 0 ? Number(row[aMap['tc']]) : 6.96;
        const importeAsignado = precioPend
          ? 0
          : redondear2_2026(
              row[aMap['importetotal']] !== '' && row[aMap['importetotal']] !== undefined
                ? Number(row[aMap['importetotal']])
                : (row[aMap['importeusd']] !== '' && row[aMap['importeusd']] !== undefined ? Number(row[aMap['importeusd']]) : cant * precioUnitario)
            );
        const movId = String(row[aMap['movimientoid']] || '').trim();

        finAppendObj_2026(shDist, {
          id: 'DIST-MIG-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
          ventaId: ventaId,
          cosechaId: cosechaId,
          loteId: loteId,
          campanaId: campanaId,
          producto: producto,
          unidad: unidad,
          toneladasAsignadas: cant,
          participacionPct: 100,
          precioUnitario: precioUnitario,
          importeAsignado: importeAsignado,
          moneda: moneda,
          tcHistorico: tc,
          movimientoId: movId,
          anulada: false,
          creadoEn: String(row[aMap['creadoen']] || ahora),
          actualizadoEn: ahora
        });

        // Actualizar columnas informativas no destructivas en encabezado si estaban vacías
        if (aMap['origenresumen'] !== undefined && !String(row[aMap['origenresumen']] || '').trim()) {
          const lotName = (lotesMap[loteId] && lotesMap[loteId].nombre) ? String(lotesMap[loteId].nombre).trim() : '';
          if (lotName) shAsig.getRange(i + 1, aMap['origenresumen'] + 1).setValue(lotName);
        }
        if (aMap['estadoregistro'] !== undefined && !String(row[aMap['estadoregistro']] || '').trim()) {
          shAsig.getRange(i + 1, aMap['estadoregistro'] + 1).setValue('CONFIRMADO');
        }

        existingDistByVenta[ventaId] = [{ ventaId: ventaId, cosechaId: cosechaId }];
        report.ventasMigradasADistribucion += 1;
      }
    }

    // 5. Auditar ingresos directos heredados en Movimientos (no vinculados a COSECHA: ni SYS_INTERES_MORA)
    // Se informan para trazabilidad sin modificar ni duplicar movimientos históricos
    if (findSheetIgnoreCase_('Movimientos')) {
      getSheetDataAsObjects('Movimientos').forEach(function (mov) {
        if (String(mov.modulo || '').toUpperCase() !== 'PROPIEDAD') return;
        if (String(mov.clase || '').toUpperCase() !== 'INGRESO') return;
        const tid = String(mov.trabajoId || '').trim();
        const itemId = String(mov.itemId || '').trim();
        if (tid.indexOf('COSECHA:') === 0 || itemId === 'SYS_INTERES_MORA' || tid.indexOf('INTERES_COBRO:') === 0) return;
        report.ingresosDirectosHeredados.push({
          movimientoId: String(mov.id || ''),
          fecha: finToIsoDate_2026(mov.fecha),
          campanaId: String(mov.campanaId || ''),
          loteId: String(mov.loteId || ''),
          descripcion: String(mov.descripcion || ''),
          cantidad: Number(mov.cantidad || 0),
          importe: Number(mov.importe || 0),
          moneda: String(mov.moneda || 'USD'),
          nota: 'Ingreso histórico directo conservado intacto (sin duplicar ni inventar cosecha).'
        });
      });
    }

    SpreadsheetApp.flush();
    Logger.log(JSON.stringify(report));
    return report;
  } finally {
    lock.releaseLock();
  }
}


