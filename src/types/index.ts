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
  cliente?: string;
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
  tipo: 'gasto_maquinaria' | 'gasto_propiedad' | 'ingreso_propiedad';
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


export interface ExchangeRateConfig {
  tasaBobPerUsd: number;
  fuente: 'manual' | 'bcb';
  fechaActualizacion: string;
  nota?: string;
}

export interface BackendHealthResponse {
  ok: boolean;
  service?: string;
  version?: string;
  timestamp?: string;
}

export type MainView = 'inicio' | 'maquinarias' | 'propiedad' | 'administracion';
