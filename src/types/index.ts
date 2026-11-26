export type Currency = 'BOB' | 'USD';

export interface UserSession {
  token: string;
  usuario: string;
  nombre: string;
  rol: 'admin' | 'usuario';
  expira?: string;
}

export interface Campaign {
  id: string;
  nombre: string;
  activa: boolean;
  fechaInicio: string;
  fechaFin?: string;
  estado: 'activa' | 'cerrada';
}

export interface MachineJobType {
  id: string;
  maquinaId: string;
  tipoMaquina?: string;
  nombre: string;
  icono?: string;
  tarifa: number;
  moneda: Currency;
  unidad: 'h' | 'ha' | 'hora' | 'hectarea' | string;
  activo?: boolean;
}

export interface Machine {
  id: string;
  nombre: string;
  identificacion: string;
  tipo: string;
  icono?: string;
  tarifa: number;
  unidad: 'h' | 'ha' | 'hora' | 'hectarea' | string;
  unidadCobro?: 'h' | 'ha' | string;
  moneda: Currency;
  estado: 'operativo' | 'mantenimiento' | 'inactivo';
  activo?: boolean;
  observaciones?: string;
  trabajos?: MachineJobType[];
  valorPatrimonial?: number;
}

export interface Lot {
  id: string;
  nombre: string;
  superficieHectareas: number;
  superficie?: number;
  cultivoActual?: string;
  ubicacion?: string;
  observaciones?: string;
  valorPatrimonial?: number;
}

export interface MachineryJob {
  id: string;
  tipoTrabajo: 'tercero' | 'propiedad';
  fecha: string;
  campanaId: string;
  campanaNombre?: string;
  maquinariaId: string;
  maquinariaNombre?: string;
  maquinariaIcono?: string;
  trabajoTipoId?: string;
  trabajoNombre?: string;
  trabajoIcono?: string;
  clienteId?: string;
  cliente?: string;
  clientePendiente?: boolean;
  plazoDias?: number;
  fechaVencimiento?: string;
  aplicarInteres?: boolean;
  tasaInteresMensual?: number;
  loteId?: string;
  loteNombre?: string;
  cantidad: number;
  unidad: 'hora' | 'hectarea' | 'h' | 'ha' | string;
  tarifa: number;
  moneda: Currency;
  tipoCambio: number;
  tc?: number;
  total: number;
  observacion?: string;
  linkedMovimientoId?: string;
  icono?: string;
  creadoEn?: string;
}

export interface Expense {
  id: string;
  fecha: string;
  campanaId: string;
  modulo: 'maquinarias' | 'propiedad';
  maquinariaId?: string;
  maquinariaNombre?: string;
  maquinariaIcono?: string;
  loteId?: string;
  loteNombre?: string;
  itemGasto: string;
  itemIcono?: string;
  icono?: string;
  cantidad: number;
  unidad: string;
  precio: number;
  moneda: Currency;
  tipoCambio: number;
  tc?: number;
  total: number;
  observacion?: string;
  esTrabajoPropio?: boolean;
  trabajoId?: string;
  creadoEn?: string;
}

export interface Income {
  id: string;
  fecha: string;
  campanaId: string;
  modulo: 'maquinarias' | 'propiedad';
  maquinariaId?: string;
  maquinariaNombre?: string;
  loteId?: string;
  loteNombre?: string;
  itemId?: string;
  concepto: string;
  icono?: string;
  cantidad: number;
  unidad?: string;
  precio: number;
  moneda: Currency;
  tipoCambio: number;
  tc?: number;
  total: number;
  observacion?: string;
  esTrabajoPropio?: boolean;
  trabajoId?: string;
  creadoEn?: string;
}

export interface ItemConfig {
  id: string;
  tipo: 'gasto_maquinaria' | 'gasto_propiedad' | 'ingreso_propiedad' | 'ingreso_maquinaria';
  modulo?: 'MAQUINARIAS' | 'PROPIEDAD' | 'maquinarias' | 'propiedad';
  clase?: 'GASTO' | 'INGRESO';
  nombre: string;
  icono?: string;
  unidad?: string;
  precioPredeterminado?: number;
  precio?: number;
  moneda: Currency;
  activo?: boolean;
}

export interface AssetImprovement {
  id: string;
  activoId?: string;
  fecha: string;
  descripcion: string;
  costo: number;
  moneda: Currency;
}

export interface Asset {
  id: string;
  tipo: 'MAQUINARIA' | 'LOTE' | 'IMPLEMENTO' | 'OTRO' | 'maquinaria' | 'terreno' | 'infraestructura' | 'implemento';
  nombre: string;
  identificador?: string;
  referenciaId?: string;
  icono?: string;
  valorInicial: number;
  moneda: Currency;
  fechaAdquisicion: string;
  valorAcumulado: number;
  mejoras: AssetImprovement[];
  activo?: boolean;
}

export interface ImplementItem {
  id: string;
  nombre: string;
  icono?: string;
  referenciaId: string;
  asset?: Asset;
  baseVal: number;
  mejoras: AssetImprovement[];
  sumMejoras: number;
  totVal: number;
  origen: 'activo' | 'labor';
}


export type ExchangeRateStatus = 'actualizado' | 'pendiente' | 'sin_conexion' | 'manual';

export interface ExchangeRateConfig {
  tasaBobPerUsd: number;
  fuente: 'manual' | 'bcb';
  fechaActualizacion: string;
  fechaCotizacion?: string;
  fechaCorte?: string;
  ultimaConsulta?: string;
  ultimaConsultaDia?: string;
  estado?: ExchangeRateStatus;
  fuenteDetalle?: string;
  errorMensaje?: string;
  nota?: string;
}

export interface BackendHealthResponse {
  ok: boolean;
  service?: string;
  version?: string;
  timestamp?: string;
}

export type CobroEstado = 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'COBRADO';

export interface CobroPago {
  id: string;
  trabajoId: string;
  fecha: string;
  importe: number;
  moneda?: Currency;
  importeOriginal?: number;
  monedaCobro?: Currency;
  tc?: number;
  importeUsd?: number;
  observacion?: string;
  creadoPor?: string;
  creadoEn?: string;
}

export interface CobroCuenta {
  id?: string;
  trabajoId: string;
  fecha: string;
  campanaId?: string;
  campanaNombre?: string;
  cliente: string;
  maquinariaId?: string;
  maquinariaNombre?: string;
  implementoId?: string;
  trabajoNombre?: string;
  cantidad?: number;
  unidad?: string;
  tarifa?: number;
  precioUnitario?: number;
  importe: number;
  moneda: Currency;
  tipoCambio?: number;
  importeOriginalServicio?: number;
  monedaOriginalServicio?: Currency;
  tcServicio?: number;
  cobrado: number;
  saldo: number;
  estado: CobroEstado;
  observacion?: string;
  pagos: CobroPago[];
}

export interface HarvestPriceAssignment {
  id: string;
  cosechaId: string;
  fecha: string;
  campanaId?: string;
  toneladas: number;
  precioUsdTon: number;
  tc: number;
  totalUsd?: number;
  totalBob?: number;
  movimientoId?: string;
  observacion?: string;
  creadoEn?: string;
}

export interface HarvestRecord {
  id: string;
  fecha: string;
  campanaId: string;
  campanaNombre?: string;
  loteId: string;
  loteNombre?: string;
  producto: string;
  toneladas: number;
  asignadas: number;
  pendiente: number;
  estado?: string;
  observacion?: string;
  asignaciones: HarvestPriceAssignment[];
  creadoEn?: string;
}

export interface ExpenseAllocationLot {
  loteId: string;
  loteNombre?: string;
  hectareas: number;
  porcentaje?: number;
  importe?: number;
  movimientoId?: string;
}

export interface ExpenseAllocationGroup {
  id: string;
  grupoId: string;
  fecha: string;
  campanaId: string;
  campanaNombre?: string;
  descripcion: string;
  itemId?: string;
  importe: number;
  moneda: Currency;
  tc: number;
  hectareasTotales?: number;
  observacion?: string;
  lotes: ExpenseAllocationLot[];
  creadoEn?: string;
}

export type MainView = 'inicio' | 'maquinarias' | 'propiedad' | 'administracion';

// -------------------------------------------------------------
// Customers Catalog (Administración -> Clientes)
// -------------------------------------------------------------
export interface Customer {
  id: string;
  nombre: string;
  telefono?: string;
  direccion?: string;
  activo: boolean;
  creadoEn?: string;
  actualizadoEn?: string;
}

// -------------------------------------------------------------
// Payment Settings (Administración -> Configuración de cobros)
// -------------------------------------------------------------
export interface PaymentSettings {
  plazoDiasPredeterminado: number | null;
  aplicarInteresPorDefecto: boolean;
  porcentajeInteresMensual: number | null;
  configurado: boolean;
  actualizadoEn?: string;
}

// -------------------------------------------------------------
// Harvest Sales (Propiedad -> Ventas de cosecha, Admin-only)
// -------------------------------------------------------------
export type HarvestSaleStatus =
  | 'COMPRADOR_Y_PRECIO_PENDIENTES'
  | 'COMPRADOR_PENDIENTE'
  | 'PRECIO_PENDIENTE'
  | 'VENTA_COMPLETA';

export interface HarvestSale {
  id: string;
  cosechaId: string;
  fecha: string;
  campanaId: string;
  campanaNombre?: string;
  loteId: string;
  loteNombre?: string;
  producto: string;
  cantidad: number;
  unidad: string;
  clienteId?: string;
  clienteNombre?: string;
  compradorPendiente: boolean;
  precioUnitario: number;
  precioPendiente: boolean;
  moneda: Currency;
  tc: number;
  importeTotal: number;
  plazoDias?: number;
  fechaVencimiento?: string;
  fechaCompletado?: string;
  aplicarInteres: boolean;
  tasaInteresMensual: number;
  observacion?: string;
  movimientoId?: string;
  estado: HarvestSaleStatus;
  estadoComprador: 'ASIGNADO' | 'PENDIENTE';
  estadoPrecio: 'ASIGNADO' | 'PENDIENTE';
  anulada?: boolean;
  creadoPor?: string;
  creadoEn?: string;
  actualizadoEn?: string;
}

// -------------------------------------------------------------
// Centralized Accounts Receivable (Administración -> Cuentas por cobrar)
// -------------------------------------------------------------
export type ArDebtType = 'TRABAJO' | 'VENTA_COSECHA';

export interface ArDebtApplicationItem {
  id: string;
  cobroId: string;
  deudaTipo: ArDebtType;
  deudaId: string;
  clienteId?: string;
  moduloOrigen: 'MAQUINARIAS' | 'PROPIEDAD';
  campanaOrigenId?: string;
  loteOrigenId?: string;
  fechaCobro: string;
  monedaDeuda: Currency;
  monedaPago: Currency;
  tcAplicado: number;
  importeOriginalPagado: number;
  importeEquivalenteDeuda: number;
  saldoCapitalAnterior: number;
  interesAcumuladoAnterior: number;
  interesPagado: number;
  capitalPagado: number;
  saldoCapitalRestante: number;
  interesRestante: number;
  movimientoInteresId?: string;
  anulado?: boolean;
  creadoPor?: string;
  creadoEn?: string;
}

export interface ArDebt {
  id: string;
  deudaTipo: ArDebtType;
  deudaId: string;
  origen: 'MAQUINARIAS' | 'PROPIEDAD';
  clienteId?: string;
  clienteNombre: string;
  clientePendiente: boolean;
  fecha: string;
  concepto: string;
  campanaId?: string;
  campanaNombre?: string;
  loteId?: string;
  loteNombre?: string;
  maquinaId?: string;
  maquinaNombre?: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  moneda: Currency;
  tcHistorico: number;
  importeOriginal: number;
  plazoDias: number;
  fechaVencimiento?: string;
  aplicarInteres: boolean;
  tasaInteresMensual: number;
  pagosAnteriores: number;
  pagosCapitalAnteriores: number;
  pagosInteresAnteriores: number;
  capitalPendiente: number;
  interesAcumulado: number;
  totalPendiente: number;
  diasAtraso: number;
  vencida: boolean;
  estado: CobroEstado;
  observacion?: string;
  aplicaciones: ArDebtApplicationItem[];
}

export interface ArCurrencyTotals {
  capitalPendiente: number;
  interesAcumulado: number;
  totalPendiente: number;
}

export interface ArCustomerSummary {
  clienteId: string;
  clienteNombre: string;
  telefono?: string;
  direccion?: string;
  activo: boolean;
  registrosPendientes: number;
  registrosVencidos: number;
  usd: ArCurrencyTotals;
  bob: ArCurrencyTotals;
  deudas: ArDebt[];
}

export interface ArPaymentRecord {
  id: string;
  cobroId: string;
  fecha: string;
  clienteId?: string;
  clienteNombre: string;
  monedaPago: Currency;
  importeOriginalPagado: number;
  tcAplicado: number;
  tipoPago: 'PARCIAL' | 'TOTAL';
  capitalTotalAplicado: number;
  interesTotalAplicado: number;
  monedaTotalesAplicados?: Currency;
  capitalAplicadoUsd?: number;
  interesAplicadoUsd?: number;
  capitalAplicadoBob?: number;
  interesAplicadoBob?: number;
  notaCobroNumero?: string;
  observacion?: string;
  anulado?: boolean;
  creadoPor?: string;
  creadoEn?: string;
  aplicaciones: ArDebtApplicationItem[];
}

export interface DebitNoteLine {
  deudaTipo: ArDebtType;
  deudaId: string;
  fecha: string;
  concepto: string;
  origen: 'MAQUINARIAS' | 'PROPIEDAD';
  campanaNombre?: string;
  loteNombre?: string;
  maquinaNombre?: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  fechaVencimiento?: string;
  diasAtraso: number;
  moneda: Currency;
  importeOriginal?: number;
  pagosAnteriores?: number;
  saldoPendiente: number;
  interes: number;
  totalPorCobrar: number;
}

export interface DebitNoteRecord {
  id: string;
  numero: string;
  fecha: string;
  clienteId: string;
  clienteNombre: string;
  clienteTelefono?: string;
  clienteDireccion?: string;
  totalUsd: number;
  totalBob: number;
  items: DebitNoteLine[];
  observacion?: string;
  creadoPor?: string;
  creadoEn?: string;
}

export interface PaymentReceiptLine {
  deudaTipo: ArDebtType;
  deudaId: string;
  fechaDeuda?: string;
  concepto: string;
  origen: 'MAQUINARIAS' | 'PROPIEDAD';
  campanaNombre?: string;
  loteNombre?: string;
  maquinaNombre?: string;
  monedaDeuda: Currency;
  importeAnterior: number;
  capitalPagado: number;
  interesPagado: number;
  totalPagado: number;
  saldoRestante: number;
  monedaPago: Currency;
  importeOriginalPagado: number;
  tcAplicado: number;
  equivalenteDescontado: number;
}

export interface PaymentReceiptRecord {
  id: string;
  numero: string;
  cobroId: string;
  fecha: string;
  clienteId: string;
  clienteNombre: string;
  clienteTelefono?: string;
  clienteDireccion?: string;
  tipoPago: 'PARCIAL' | 'TOTAL';
  monedaPago: Currency;
  importeOriginalPagado: number;
  tcAplicado: number;
  totalAplicadoUsd: number;
  totalAplicadoBob: number;
  items: PaymentReceiptLine[];
  observacion?: string;
  anulado?: boolean;
  creadoPor?: string;
  creadoEn?: string;
}

