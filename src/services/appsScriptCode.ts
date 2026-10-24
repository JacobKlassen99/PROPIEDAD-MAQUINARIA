/**
 * Production-ready Google Apps Script (Code.gs) implementation for Google Sheets.
 * This exact script can be pasted into Google Sheets > Extensiones > Apps Script.
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * MAQUINARIAS Y PROPIEDAD - Backend Google Apps Script (Code.gs)
 * Base de datos: Google Sheets
 */

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

// Whitelist of public actions (no token required)
function dispatch_(p) {
  let action = p.action || '', a = p.data || {};
  if (action === 'health') return { ok: true, service: 'AGRICULTURA_MAQUINARIAS' };
  if (action === 'auth.login') return login_(a);
  let u = auth_(p.token);
  if (!u) return { ok: false, error: 'Sesion vencida o revocada' };
  // Acciones protegidas (catalog.list, work.save, movement.save, report.get, etc.)
  return handleProtectedAction_(action, a, u);
}

function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }
    const res = dispatch_(payload);
    return createJsonResponse(res);
  } catch(err) {
    return createJsonResponse({ ok: false, error: err.message });
  }
}

function handleProtectedAction_(action, a, u) {
  let payload = a || {};
  switch (action) {
    case "auth.logout":
    case "logout":
      return handleLogout(u.token);

      case "getCampaigns":
        return handleGetCampaigns();
      case "createCampaign":
        return handleCreateCampaign(payload.campaign);
      case "setActiveCampaign":
        return handleSetActiveCampaign(payload.campaignId);

      case "getMachines":
        return handleGetMachines();
      case "createMachine":
        return handleCreateMachine(payload.machine);
      case "updateMachine":
        return handleUpdateMachine(payload.id, payload.machine);
      case "deleteMachine":
        return handleDeleteMachine(payload.id);

      case "getLots":
        return handleGetLots();
      case "createLot":
        return handleCreateLot(payload.lot);
      case "updateLot":
        return handleUpdateLot(payload.id, payload.lot);
      case "deleteLot":
        return handleDeleteLot(payload.id);

      case "getMachineryJobs":
        return handleGetMachineryJobs(payload.campanaId);
      case "createMachineryJob":
        return handleCreateMachineryJob(payload.job);
      case "updateMachineryJob":
        return handleUpdateMachineryJob(payload.id, payload.job);
      case "deleteMachineryJob":
        return handleDeleteMachineryJob(payload.id);

      case "getExpenses":
        return handleGetExpenses(payload.campanaId, payload.modulo);
      case "createExpense":
        return handleCreateExpense(payload.expense);
      case "deleteExpense":
        return handleDeleteExpense(payload.id);

      case "getIncomes":
        return handleGetIncomes(payload.campanaId, payload.modulo);
      case "createIncome":
        return handleCreateIncome(payload.income);
      case "deleteIncome":
        return handleDeleteIncome(payload.id);

      case "getItemsConfig":
        return handleGetItemsConfig();
      case "saveItemConfig":
        return handleSaveItemConfig(payload.item);

      case "getAssets":
        // Restricción: Solo administradores pueden ver valores patrimoniales
        if (session.rol !== "admin") {
          return createJsonResponse({ ok: false, error: "Acceso denegado: se requieren permisos de administrador" });
        }
        return handleGetAssets();
      case "createAsset":
        if (session.rol !== "admin") {
          return createJsonResponse({ ok: false, error: "Acceso denegado" });
        }
        return handleCreateAsset(payload.asset);
      case "addAssetImprovement":
        if (session.rol !== "admin") {
          return createJsonResponse({ ok: false, error: "Acceso denegado" });
        }
        return handleAddAssetImprovement(payload.assetId, payload.improvement);

      case "getExchangeRateConfig":
        return handleGetExchangeRate();
      case "saveExchangeRateConfig":
        return handleSaveExchangeRate(payload.config);

      default:
        return createJsonResponse({ ok: false, error: "Acción no reconocida: " + action });
    }
  } catch (err) {
    return createJsonResponse({ ok: false, error: "Error interno en Google Apps Script: " + err.message });
  }
}

// ----------------- HELPERS & UTILITIES -----------------

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(sheetName, defaultHeaders) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (defaultHeaders && defaultHeaders.length > 0) {
      sheet.appendRow(defaultHeaders);
      sheet.getRange(1, 1, 1, defaultHeaders.length).setFontWeight("bold");
    }
  }
  return sheet;
}

function getSheetDataAsObjects(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
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

// ----------------- AUTH & SESSIONS -----------------

function handleLogin(usuario, pin) {
  if (!usuario || !pin) {
    return createJsonResponse({ ok: false, error: "Usuario y PIN requeridos" });
  }
  const usersSheet = getOrCreateSheet("Usuarios", ["usuario", "pin", "nombre", "rol"]);
  const users = getSheetDataAsObjects("Usuarios");

  // Si la hoja Usuarios está vacía, registrar al usuario admin por defecto con PIN proporcionado
  let user = users.find(u => String(u.usuario).toLowerCase() === String(usuario).toLowerCase());
  if (!user && users.length === 0 && String(usuario).toLowerCase() === "admin") {
    usersSheet.appendRow(["admin", String(pin), "Administrador", "admin"]);
    user = { usuario: "admin", pin: String(pin), nombre: "Administrador", rol: "admin" };
  }

  if (!user || String(user.pin) !== String(pin)) {
    return createJsonResponse({ ok: false, error: "Credenciales inválidas. Verifique el PIN de 5 dígitos." });
  }

  const token = Utilities.getUuid();
  const sessionsSheet = getOrCreateSheet("Sesiones", ["token", "usuario", "nombre", "rol", "expira"]);
  const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  sessionsSheet.appendRow([token, user.usuario, user.nombre || user.usuario, user.rol || "admin", expira]);

  return createJsonResponse({
    ok: true,
    result: {
      token: token,
      usuario: user.usuario,
      nombre: user.nombre || user.usuario,
      rol: user.rol || "admin",
      expira: expira
    }
  });
}

function validateToken(token) {
  const sessions = getSheetDataAsObjects("Sesiones");
  const s = sessions.find(item => item.token === token);
  if (!s) return null;
  if (s.expira && new Date(s.expira).getTime() < Date.now()) {
    return null;
  }
  return s;
}

function handleLogout(token) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Sesiones");
  if (sheet) {
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === token) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
  }
  return createJsonResponse({ ok: true });
}

// ----------------- CAMPAIGNS -----------------

function handleGetCampaigns() {
  const campaigns = getSheetDataAsObjects("Campanas");
  return createJsonResponse({ ok: true, result: campaigns });
}

function handleCreateCampaign(c) {
  const sheet = getOrCreateSheet("Campanas", ["id", "nombre", "activa", "fechaInicio", "fechaFin", "estado"]);
  const id = Utilities.getUuid();
  if (c.activa) {
    // Desactivar las demás
    handleSetActiveCampaign(id);
  }
  sheet.appendRow([id, c.nombre, c.activa ? true : false, c.fechaInicio || new Date().toISOString().slice(0, 10), c.fechaFin || "", c.estado || "activa"]);
  return createJsonResponse({ ok: true, result: { id, ...c } });
}

function handleSetActiveCampaign(campaignId) {
  const sheet = getOrCreateSheet("Campanas", ["id", "nombre", "activa", "fechaInicio", "fechaFin", "estado"]);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    sheet.getRange(i + 1, 3).setValue(rows[i][0] === campaignId);
  }
  return createJsonResponse({ ok: true });
}

// ----------------- MACHINES -----------------

function handleGetMachines() {
  return createJsonResponse({ ok: true, result: getSheetDataAsObjects("Maquinarias") });
}

function handleCreateMachine(m) {
  const sheet = getOrCreateSheet("Maquinarias", ["id", "nombre", "identificacion", "tipo", "tarifa", "unidad", "moneda", "estado", "observaciones"]);
  const id = Utilities.getUuid();
  sheet.appendRow([id, m.nombre, m.identificacion, m.tipo, Number(m.tarifa) || 0, m.unidad, m.moneda, m.estado || "operativo", m.observaciones || ""]);
  return createJsonResponse({ ok: true, result: { id, ...m } });
}

function handleUpdateMachine(id, m) {
  const sheet = getOrCreateSheet("Maquinarias");
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      for (const key in m) {
        const colIdx = headers.indexOf(key);
        if (colIdx !== -1) {
          sheet.getRange(i + 1, colIdx + 1).setValue(m[key]);
        }
      }
      return createJsonResponse({ ok: true });
    }
  }
  return createJsonResponse({ ok: false, error: "Maquinaria no encontrada" });
}

function handleDeleteMachine(id) {
  const sheet = getOrCreateSheet("Maquinarias");
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      sheet.deleteRow(i + 1);
      return createJsonResponse({ ok: true });
    }
  }
  return createJsonResponse({ ok: false, error: "Maquinaria no encontrada" });
}

// ----------------- LOTS -----------------

function handleGetLots() {
  return createJsonResponse({ ok: true, result: getSheetDataAsObjects("Lotes") });
}

function handleCreateLot(l) {
  const sheet = getOrCreateSheet("Lotes", ["id", "nombre", "superficieHectareas", "cultivoActual", "ubicacion", "observaciones"]);
  const id = Utilities.getUuid();
  sheet.appendRow([id, l.nombre, Number(l.superficieHectareas) || 0, l.cultivoActual || "", l.ubicacion || "", l.observaciones || ""]);
  return createJsonResponse({ ok: true, result: { id, ...l } });
}

function handleUpdateLot(id, l) {
  const sheet = getOrCreateSheet("Lotes");
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      for (const key in l) {
        const colIdx = headers.indexOf(key);
        if (colIdx !== -1) {
          sheet.getRange(i + 1, colIdx + 1).setValue(l[key]);
        }
      }
      return createJsonResponse({ ok: true });
    }
  }
  return createJsonResponse({ ok: false, error: "Lote no encontrado" });
}

function handleDeleteLot(id) {
  const sheet = getOrCreateSheet("Lotes");
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      sheet.deleteRow(i + 1);
      return createJsonResponse({ ok: true });
    }
  }
  return createJsonResponse({ ok: false, error: "Lote no encontrado" });
}

// ----------------- MACHINERY JOBS & LINKED MOVEMENTS -----------------

function handleGetMachineryJobs(campanaId) {
  let jobs = getSheetDataAsObjects("TrabajosMaquinaria");
  if (campanaId) {
    jobs = jobs.filter(j => j.campanaId === campanaId);
  }
  return createJsonResponse({ ok: true, result: jobs });
}

function handleCreateMachineryJob(j) {
  const jobsSheet = getOrCreateSheet("TrabajosMaquinaria", [
    "id", "tipoTrabajo", "fecha", "campanaId", "campanaNombre", "maquinariaId",
    "maquinariaNombre", "cliente", "loteId", "loteNombre", "cantidad", "unidad",
    "tarifa", "moneda", "tipoCambio", "total", "observacion", "linkedMovimientoId"
  ]);

  const id = Utilities.getUuid();
  const linkedId = Utilities.getUuid();

  jobsSheet.appendRow([
    id, j.tipoTrabajo, j.fecha, j.campanaId, j.campanaNombre || "",
    j.maquinariaId, j.maquinariaNombre || "", j.cliente || "",
    j.loteId || "", j.loteNombre || "", Number(j.cantidad) || 0,
    j.unidad, Number(j.tarifa) || 0, j.moneda, Number(j.tipoCambio) || 1,
    Number(j.total) || 0, j.observacion || "", linkedId
  ]);

  // REGLA CENTRAL DEL SISTEMA:
  // 1. Ingreso de maquinaria siempre registrado
  const incomesSheet = getOrCreateSheet("Ingresos", [
    "id", "fecha", "campanaId", "modulo", "maquinariaId", "maquinariaNombre",
    "loteId", "loteNombre", "concepto", "cantidad", "unidad", "precio",
    "moneda", "tipoCambio", "total", "observacion", "esTrabajoPropio", "trabajoId"
  ]);

  incomesSheet.appendRow([
    linkedId + "-inc", j.fecha, j.campanaId, "maquinarias",
    j.maquinariaId, j.maquinariaNombre || "", "", "",
    j.tipoTrabajo === "propiedad" ? "Trabajo en propiedad (" + (j.loteNombre || "Lote") + ")" : "Servicio a tercero (" + (j.cliente || "Externo") + ")",
    Number(j.cantidad) || 0, j.unidad, Number(j.tarifa) || 0,
    j.moneda, Number(j.tipoCambio) || 1, Number(j.total) || 0,
    j.observacion || "", j.tipoTrabajo === "propiedad", id
  ]);

  // 2. Si es en propiedad: Gasto de Propiedad asignado al Lote obligatorio
  if (j.tipoTrabajo === "propiedad" && j.loteId) {
    const expensesSheet = getOrCreateSheet("Gastos", [
      "id", "fecha", "campanaId", "modulo", "maquinariaId", "maquinariaNombre",
      "loteId", "loteNombre", "itemGasto", "cantidad", "unidad", "precio",
      "moneda", "tipoCambio", "total", "observacion", "esTrabajoPropio", "trabajoId"
    ]);

    expensesSheet.appendRow([
      linkedId + "-exp", j.fecha, j.campanaId, "propiedad",
      j.maquinariaId, j.maquinariaNombre || "", j.loteId, j.loteNombre || "",
      "Servicio Maquinaria Propia (" + (j.maquinariaNombre || "Máquina") + ")",
      Number(j.cantidad) || 0, j.unidad, Number(j.tarifa) || 0,
      j.moneda, Number(j.tipoCambio) || 1, Number(j.total) || 0,
      j.observacion || "", true, id
    ]);
  }

  return createJsonResponse({ ok: true, result: { id, ...j, linkedMovimientoId: linkedId } });
}

function handleDeleteMachineryJob(id) {
  // Eliminar trabajo y movimientos vinculados automáticamente
  deleteRowByColumn("TrabajosMaquinaria", "id", id);
  deleteRowByColumn("Ingresos", "trabajoId", id);
  deleteRowByColumn("Gastos", "trabajoId", id);
  return createJsonResponse({ ok: true });
}

function deleteRowByColumn(sheetName, colName, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return;
  const headers = rows[0];
  const colIdx = headers.indexOf(colName);
  if (colIdx === -1) return;

  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][colIdx]) === String(value)) {
      sheet.deleteRow(i + 1);
    }
  }
}

// ----------------- EXPENSES & INCOMES -----------------

function handleGetExpenses(campanaId, modulo) {
  let list = getSheetDataAsObjects("Gastos");
  if (campanaId) list = list.filter(e => e.campanaId === campanaId);
  if (modulo) list = list.filter(e => e.modulo === modulo);
  return createJsonResponse({ ok: true, result: list });
}

function handleCreateExpense(e) {
  const sheet = getOrCreateSheet("Gastos", [
    "id", "fecha", "campanaId", "modulo", "maquinariaId", "maquinariaNombre",
    "loteId", "loteNombre", "itemGasto", "cantidad", "unidad", "precio",
    "moneda", "tipoCambio", "total", "observacion", "esTrabajoPropio", "trabajoId"
  ]);
  const id = Utilities.getUuid();
  sheet.appendRow([
    id, e.fecha, e.campanaId, e.modulo, e.maquinariaId || "", e.maquinariaNombre || "",
    e.loteId || "", e.loteNombre || "", e.itemGasto, Number(e.cantidad) || 0,
    e.unidad || "", Number(e.precio) || 0, e.moneda, Number(e.tipoCambio) || 1,
    Number(e.total) || 0, e.observacion || "", false, ""
  ]);
  return createJsonResponse({ ok: true, result: { id, ...e } });
}

function handleDeleteExpense(id) {
  deleteRowByColumn("Gastos", "id", id);
  return createJsonResponse({ ok: true });
}

function handleGetIncomes(campanaId, modulo) {
  let list = getSheetDataAsObjects("Ingresos");
  if (campanaId) list = list.filter(i => i.campanaId === campanaId);
  if (modulo) list = list.filter(i => i.modulo === modulo);
  return createJsonResponse({ ok: true, result: list });
}

function handleCreateIncome(i) {
  const sheet = getOrCreateSheet("Ingresos", [
    "id", "fecha", "campanaId", "modulo", "maquinariaId", "maquinariaNombre",
    "loteId", "loteNombre", "concepto", "cantidad", "unidad", "precio",
    "moneda", "tipoCambio", "total", "observacion", "esTrabajoPropio", "trabajoId"
  ]);
  const id = Utilities.getUuid();
  sheet.appendRow([
    id, i.fecha, i.campanaId, i.modulo, i.maquinariaId || "", i.maquinariaNombre || "",
    i.loteId || "", i.loteNombre || "", i.concepto, Number(i.cantidad) || 0,
    i.unidad || "", Number(i.precio) || 0, i.moneda, Number(i.tipoCambio) || 1,
    Number(i.total) || 0, i.observacion || "", false, ""
  ]);
  return createJsonResponse({ ok: true, result: { id, ...i } });
}

function handleDeleteIncome(id) {
  deleteRowByColumn("Ingresos", "id", id);
  return createJsonResponse({ ok: true });
}

// ----------------- CONFIGURABLE ITEMS -----------------

function handleGetItemsConfig() {
  return createJsonResponse({ ok: true, result: getSheetDataAsObjects("ConfigItems") });
}

function handleSaveItemConfig(item) {
  const sheet = getOrCreateSheet("ConfigItems", ["id", "tipo", "nombre", "icono", "unidad", "precioPredeterminado", "moneda"]);
  const id = item.id || Utilities.getUuid();
  deleteRowByColumn("ConfigItems", "id", id);
  sheet.appendRow([id, item.tipo, item.nombre, item.icono || "Tag", item.unidad || "", Number(item.precioPredeterminado) || 0, item.moneda || "BOB"]);
  return createJsonResponse({ ok: true, result: { ...item, id } });
}

// ----------------- ASSETS & IMPROVEMENTS -----------------

function handleGetAssets() {
  const assets = getSheetDataAsObjects("Activos");
  const improvements = getSheetDataAsObjects("MejorasActivos");
  const fullAssets = assets.map(a => {
    const list = improvements.filter(m => m.assetId === a.id);
    const sumMejoras = list.reduce((acc, m) => acc + (Number(m.costo) || 0), 0);
    return {
      ...a,
      valorAcumulado: (Number(a.valorInicial) || 0) + sumMejoras,
      mejoras: list
    };
  });
  return createJsonResponse({ ok: true, result: fullAssets });
}

function handleCreateAsset(a) {
  const sheet = getOrCreateSheet("Activos", ["id", "tipo", "nombre", "identificador", "valorInicial", "moneda", "fechaAdquisicion"]);
  const id = Utilities.getUuid();
  sheet.appendRow([id, a.tipo, a.nombre, a.identificador || "", Number(a.valorInicial) || 0, a.moneda, a.fechaAdquisicion]);
  return createJsonResponse({ ok: true, result: { id, ...a, valorAcumulado: Number(a.valorInicial) || 0, mejoras: [] } });
}

function handleAddAssetImprovement(assetId, imp) {
  const sheet = getOrCreateSheet("MejorasActivos", ["id", "assetId", "fecha", "descripcion", "costo", "moneda"]);
  const id = Utilities.getUuid();
  sheet.appendRow([id, assetId, imp.fecha, imp.descripcion, Number(imp.costo) || 0, imp.moneda]);
  return handleGetAssets();
}

// ----------------- EXCHANGE RATE -----------------

function handleGetExchangeRate() {
  const list = getSheetDataAsObjects("ConfigTipoCambio");
  if (list.length > 0) {
    return createJsonResponse({ ok: true, result: list[0] });
  }
  return createJsonResponse({
    ok: true,
    result: {
      tasaBobPerUsd: 6.96,
      fuente: "manual",
      fechaActualizacion: new Date().toISOString().slice(0, 10),
      nota: "Configuración manual"
    }
  });
}

function handleSaveExchangeRate(cfg) {
  const sheet = getOrCreateSheet("ConfigTipoCambio", ["tasaBobPerUsd", "fuente", "fechaActualizacion", "nota"]);
  sheet.clearContents();
  sheet.appendRow(["tasaBobPerUsd", "fuente", "fechaActualizacion", "nota"]);
  sheet.appendRow([Number(cfg.tasaBobPerUsd) || 6.96, cfg.fuente || "manual", new Date().toISOString().slice(0, 10), cfg.nota || "Configurado manualmente"]);
  return createJsonResponse({ ok: true, result: cfg });
}
`;
