import type {
  Campaign,
  Currency,
  HarvestRecord,
  HarvestSale,
  HarvestSaleDistribution,
  Lot,
  WarehouseLotBreakdown,
  WarehouseProductSummary,
} from '../types';

export const HARVEST_AVAILABILITY_EPSILON = 0.0001;

export function roundTons(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 1_000_000) / 1_000_000;
}

export function roundQty4(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 10_000) / 10_000;
}

export function roundMoney2(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function roundPct2(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function normalizeProductKey(product?: string): string {
  return String(product || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export interface NormalizedUnitInfo {
  canonicalUnit: string;
  family: 'mass' | 'other';
  factorToCanonical: number;
}

/**
 * Normalizes compatible harvest units without ever mixing incompatible units.
 * - Mass units (toneladas, ton, t, kg, quintales/qq) normalize to metric tons ('t').
 * - Any other unit (bolsas, sacos, cajas, etc.) stays strictly in its own unit bucket.
 */
export function normalizeHarvestUnit(rawUnit?: string): NormalizedUnitInfo {
  const cleaned = String(rawUnit || 't')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\.$/, '');

  if (
    !cleaned ||
    cleaned === 't' ||
    cleaned === 'tn' ||
    cleaned === 'tm' ||
    cleaned === 'ton' ||
    cleaned === 'tons' ||
    cleaned === 'tonelada' ||
    cleaned === 'toneladas'
  ) {
    return { canonicalUnit: 't', family: 'mass', factorToCanonical: 1 };
  }
  if (cleaned === 'kg' || cleaned === 'kilo' || cleaned === 'kilos' || cleaned === 'kilogramo' || cleaned === 'kilogramos') {
    return { canonicalUnit: 't', family: 'mass', factorToCanonical: 0.001 };
  }
  if (cleaned === 'qq' || cleaned === 'quintal' || cleaned === 'quintales') {
    // Bolivian agricultural quintal = 46 kg = 0.046 metric tons
    return { canonicalUnit: 't', family: 'mass', factorToCanonical: 0.046 };
  }
  return { canonicalUnit: cleaned, family: 'other', factorToCanonical: 1 };
}

export function toCanonicalUnitQuantity(qty: number, rawUnit?: string): { quantity: number; unit: string } {
  const info = normalizeHarvestUnit(rawUnit);
  return {
    quantity: roundTons((Number(qty) || 0) * info.factorToCanonical),
    unit: info.canonicalUnit,
  };
}

export function buildWarehouseProductKey(product?: string, rawUnit?: string): string {
  const prodKey = normalizeProductKey(product);
  const unitInfo = normalizeHarvestUnit(rawUnit);
  return `${prodKey}::${unitInfo.canonicalUnit}`;
}

/**
 * Centralized harvest availability calculation shared across PropertyView,
 * HarvestSalesView, ReportsView, and backend normalization.
 *
 * Available tons = harvested tons - sum(active committed distributions for that harvest),
 * falling back to legacy single-harvest sale.cosechaId when a sale has no distributions.
 * Explicitly counts sales with pending buyer and/or pending price so the same tons
 * can never be sold twice.
 */
export function computeHarvestAvailability(
  harvests: HarvestRecord[],
  sales?: HarvestSale[],
  extraDistributions?: HarvestSaleDistribution[]
): HarvestRecord[] {
  const list = Array.isArray(harvests) ? harvests : [];
  if (!sales && !extraDistributions) {
    return list.map((h) => {
      const unitInfo = normalizeHarvestUnit(h.unidad);
      const toneladas = Math.max(0, roundTons(h.toneladas));
      const asignadas = Math.max(0, roundTons(h.asignadas));
      const pendiente = Math.max(0, roundTons(toneladas - asignadas));
      return {
        ...h,
        unidad: unitInfo.canonicalUnit,
        toneladas,
        asignadas,
        pendiente,
      };
    });
  }

  const committedByHarvestId = new Map<string, number>();
  const salesCoveredByDist = new Set<string>();

  const activeSaleIds = new Set<string>();
  const cancelledSaleIds = new Set<string>();
  (sales || []).forEach((s) => {
    if (!s || !s.id) return;
    if (s.anulada) cancelledSaleIds.add(String(s.id).trim());
    else activeSaleIds.add(String(s.id).trim());
  });

  // 1. Count distributions embedded on non-cancelled sales
  for (const sale of sales || []) {
    if (!sale || sale.anulada) continue;
    const saleId = String(sale.id || '').trim();
    const dists = Array.isArray(sale.distribuciones)
      ? sale.distribuciones.filter((d) => d && !d.anulada && Number(d.toneladasAsignadas || 0) > 0)
      : [];

    if (dists.length > 0) {
      if (saleId) salesCoveredByDist.add(saleId);
      for (const d of dists) {
        const cid = String(d.cosechaId || '').trim();
        if (!cid) continue;
        const qty = Math.max(0, roundTons(d.toneladasAsignadas));
        if (qty <= 0) continue;
        committedByHarvestId.set(cid, roundTons((committedByHarvestId.get(cid) || 0) + qty));
      }
    }
  }

  // 2. Count extra standalone distributions if not already embedded in sales
  for (const d of extraDistributions || []) {
    if (!d || d.anulada) continue;
    const vid = String(d.ventaId || '').trim();
    if (vid && (salesCoveredByDist.has(vid) || cancelledSaleIds.has(vid))) continue;
    const cid = String(d.cosechaId || '').trim();
    if (!cid) continue;
    const qty = Math.max(0, roundTons(d.toneladasAsignadas));
    if (qty <= 0) continue;
    if (vid) salesCoveredByDist.add(vid);
    committedByHarvestId.set(cid, roundTons((committedByHarvestId.get(cid) || 0) + qty));
  }

  // 3. Legacy fallback: active sales without distributions commit directly against sale.cosechaId
  for (const sale of sales || []) {
    if (!sale || sale.anulada) continue;
    const saleId = String(sale.id || '').trim();
    if (saleId && salesCoveredByDist.has(saleId)) continue;
    const cid = String(sale.cosechaId || '').trim();
    if (!cid) continue;
    const qty = Math.max(0, roundTons(sale.cantidad));
    if (qty <= 0) continue;
    committedByHarvestId.set(cid, roundTons((committedByHarvestId.get(cid) || 0) + qty));
  }

  return list.map((h) => {
    const id = String(h.id || '').trim();
    const unitInfo = normalizeHarvestUnit(h.unidad);
    const toneladas = Math.max(0, roundTons(h.toneladas));
    const committed = committedByHarvestId.get(id) ?? 0;
    const asignadas = Math.max(0, roundTons(committed));
    const pendiente = Math.max(0, roundTons(toneladas - asignadas));
    return {
      ...h,
      unidad: unitInfo.canonicalUnit,
      toneladas,
      asignadas,
      pendiente,
    };
  });
}

/**
 * Returns harvests with strictly positive available tons, optionally filtered by campaign.
 */
export function filterAvailableHarvests(
  harvests: HarvestRecord[],
  campaignId?: string
): HarvestRecord[] {
  const targetCamp = campaignId && campaignId !== 'all' ? String(campaignId).trim() : '';
  return (Array.isArray(harvests) ? harvests : []).filter((h) => {
    if (!h || !String(h.id || '').trim()) return false;
    if (targetCamp && String(h.campanaId || '').trim() !== targetCamp) return false;
    return Number(h.pendiente || 0) > HARVEST_AVAILABILITY_EPSILON;
  });
}

/**
 * Single source-of-truth counter for harvests with available tons.
 */
export function countAvailableHarvests(
  harvests: HarvestRecord[],
  campaignId?: string
): number {
  return filterAvailableHarvests(harvests, campaignId).length;
}

/**
 * Groups harvests into the General Harvest Warehouse by (normalized product, compatible unit)
 * across ALL lots and ALL campaigns so prior-campaign stock remains available until sold.
 */
export function buildWarehouseSummaries(
  harvests: HarvestRecord[],
  sales?: HarvestSale[],
  lots?: Lot[],
  campaigns?: Campaign[],
  extraDistributions?: HarvestSaleDistribution[]
): WarehouseProductSummary[] {
  const reconciled = computeHarvestAvailability(harvests, sales, extraDistributions);

  const lotNameMap = new Map<string, string>();
  (lots || []).forEach((l) => {
    if (l?.id) lotNameMap.set(String(l.id).trim(), l.nombre);
  });
  const campNameMap = new Map<string, string>();
  (campaigns || []).forEach((c) => {
    if (c?.id) campNameMap.set(String(c.id).trim(), c.nombre);
  });

  const productGroups = new Map<
    string,
    {
      key: string;
      producto: string;
      unidad: string;
      totalCosechado: number;
      totalVendido: number;
      totalDisponible: number;
      lotBuckets: Map<string, WarehouseLotBreakdown>;
      cosechasDisponibles: HarvestRecord[];
    }
  >();

  for (const h of reconciled) {
    if (!h || !String(h.id || '').trim()) continue;
    const prodDisplay = String(h.producto || 'Cosecha').trim() || 'Cosecha';
    const unitInfo = normalizeHarvestUnit(h.unidad);
    const key = buildWarehouseProductKey(prodDisplay, unitInfo.canonicalUnit);

    let group = productGroups.get(key);
    if (!group) {
      group = {
        key,
        producto: prodDisplay,
        unidad: unitInfo.canonicalUnit,
        totalCosechado: 0,
        totalVendido: 0,
        totalDisponible: 0,
        lotBuckets: new Map(),
        cosechasDisponibles: [],
      };
      productGroups.set(key, group);
    }

    const cosechado = Math.max(0, roundTons(h.toneladas));
    const vendido = Math.max(0, roundTons(h.asignadas));
    const disponible = Math.max(0, roundTons(h.pendiente));

    group.totalCosechado = roundTons(group.totalCosechado + cosechado);
    group.totalVendido = roundTons(group.totalVendido + vendido);
    group.totalDisponible = roundTons(group.totalDisponible + disponible);

    const loteId = String(h.loteId || '').trim();
    const campanaId = String(h.campanaId || '').trim();
    const loteNombre =
      (loteId && lotNameMap.get(loteId)) ||
      (h.loteNombre && h.loteNombre.trim()) ||
      loteId ||
      'Sin lote';
    const campanaNombre =
      (campanaId && campNameMap.get(campanaId)) ||
      (h.campanaNombre && h.campanaNombre.trim()) ||
      campanaId ||
      'Sin campaña';

    const bucketKey = `${loteId}::${campanaId}`;
    let bucket = group.lotBuckets.get(bucketKey);
    if (!bucket) {
      bucket = {
        key: bucketKey,
        loteId,
        loteNombre,
        campanaId,
        campanaNombre,
        cosechado: 0,
        vendido: 0,
        disponible: 0,
        porcentajeVendido: 0,
        participacionStockPct: 0,
        cosechaIds: [],
      };
      group.lotBuckets.set(bucketKey, bucket);
    }
    bucket.cosechado = roundTons(bucket.cosechado + cosechado);
    bucket.vendido = roundTons(bucket.vendido + vendido);
    bucket.disponible = roundTons(bucket.disponible + disponible);
    bucket.cosechaIds.push(h.id);

    if (disponible > HARVEST_AVAILABILITY_EPSILON) {
      group.cosechasDisponibles.push({
        ...h,
        loteNombre,
        campanaNombre,
        unidad: unitInfo.canonicalUnit,
      });
    }
  }

  const summaries: WarehouseProductSummary[] = [];

  productGroups.forEach((group) => {
    const lotList = Array.from(group.lotBuckets.values())
      .map((b) => {
        const porcentajeVendido =
          b.cosechado > HARVEST_AVAILABILITY_EPSILON
            ? Math.min(100, roundPct2((b.vendido / b.cosechado) * 100))
            : 0;
        const participacionStockPct =
          group.totalDisponible > HARVEST_AVAILABILITY_EPSILON && b.disponible > HARVEST_AVAILABILITY_EPSILON
            ? roundPct2((b.disponible / group.totalDisponible) * 100)
            : 0;
        return {
          ...b,
          porcentajeVendido,
          participacionStockPct,
        };
      })
      .sort((a, b) => {
        if (b.disponible !== a.disponible) return b.disponible - a.disponible;
        return a.loteNombre.localeCompare(b.loteNombre, 'es', { numeric: true });
      });

    const porcentajeVendido =
      group.totalCosechado > HARVEST_AVAILABILITY_EPSILON
        ? Math.min(100, roundPct2((group.totalVendido / group.totalCosechado) * 100))
        : 0;

    const distinctLots = new Set(lotList.map((l) => l.loteId || l.loteNombre)).size;
    const distinctAvailableLots = new Set(
      lotList.filter((l) => l.disponible > HARVEST_AVAILABILITY_EPSILON).map((l) => l.loteId || l.loteNombre)
    ).size;

    summaries.push({
      key: group.key,
      producto: group.producto,
      unidad: group.unidad,
      totalCosechado: group.totalCosechado,
      totalVendido: group.totalVendido,
      totalDisponible: group.totalDisponible,
      porcentajeVendido,
      lotesCount: distinctLots,
      lotesDisponiblesCount: distinctAvailableLots,
      lotes: lotList,
      cosechasDisponibles: group.cosechasDisponibles.sort((a, b) => {
        if (b.pendiente !== a.pendiente) return b.pendiente - a.pendiente;
        return String(a.id).localeCompare(String(b.id));
      }),
    });
  });

  return summaries.sort((a, b) => {
    const aHas = a.totalDisponible > HARVEST_AVAILABILITY_EPSILON ? 1 : 0;
    const bHas = b.totalDisponible > HARVEST_AVAILABILITY_EPSILON ? 1 : 0;
    if (bHas !== aHas) return bHas - aHas;
    if (b.totalDisponible !== a.totalDisponible) return b.totalDisponible - a.totalDisponible;
    return a.producto.localeCompare(b.producto, 'es');
  });
}

export interface ProportionalDistributionRow {
  cosechaId: string;
  loteId: string;
  loteNombre: string;
  campanaId: string;
  campanaNombre: string;
  producto: string;
  unidad: string;
  disponibleAntes: number;
  participacionPct: number;
  toneladasAsignadas: number;
  precioUnitario: number;
  importeAsignado: number;
  moneda: Currency;
  tcHistorico: number;
}

/**
 * Deterministic proportional distribution of `quantityToSell` across all available harvests
 * of the selected product.
 *
 * Guarantees:
 * - sum(toneladasAsignadas) === roundQty4(quantityToSell)
 * - Every row satisfies 0 < toneladasAsignadas <= disponibleAntes
 * - When priced, sum(importeAsignado) === roundMoney2(quantityToSell * precioUnitario)
 * - Deterministic ordering by (cosechaId) tie-breaker so frontend preview matches GAS backend.
 */
export function computeProportionalDistribution(
  availableHarvests: HarvestRecord[],
  quantityToSell: number,
  options?: {
    precioPendiente?: boolean;
    precioUnitario?: number;
    moneda?: Currency;
    tc?: number;
    lots?: Lot[];
    campaigns?: Campaign[];
  }
): ProportionalDistributionRow[] {
  const qty = roundQty4(quantityToSell);
  if (!Number.isFinite(qty) || qty <= 0) return [];

  const lotMap = new Map<string, string>();
  (options?.lots || []).forEach((l) => {
    if (l?.id) lotMap.set(String(l.id).trim(), l.nombre);
  });
  const campMap = new Map<string, string>();
  (options?.campaigns || []).forEach((c) => {
    if (c?.id) campMap.set(String(c.id).trim(), c.nombre);
  });

  const eligible = (availableHarvests || [])
    .filter((h) => h && Number(h.pendiente || 0) > HARVEST_AVAILABILITY_EPSILON)
    .map((h) => ({
      ...h,
      pendiente: roundQty4(h.pendiente),
      unidad: normalizeHarvestUnit(h.unidad).canonicalUnit,
    }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  if (eligible.length === 0) return [];

  const totalAvailable = roundQty4(eligible.reduce((s, h) => s + h.pendiente, 0));
  if (qty > totalAvailable + 0.0001) {
    throw new Error(
      `La cantidad a vender (${qty}) supera el stock disponible en almacén (${totalAvailable}).`
    );
  }

  // Work in integer ten-thousandths (1e4) for exact, reproducible mass distribution
  const SCALE = 10_000;
  const targetUnits = Math.round(qty * SCALE);
  const caps = eligible.map((h) => Math.round(h.pendiente * SCALE));
  const totalCapUnits = caps.reduce((s, c) => s + c, 0);

  const exactShares = eligible.map((_, idx) => (targetUnits * caps[idx]) / totalCapUnits);
  const allocUnits = exactShares.map((val, idx) => Math.min(caps[idx], Math.floor(val)));
  let remainder = targetUnits - allocUnits.reduce((s, u) => s + u, 0);

  // Distribute remainder deterministically by largest fractional part without exceeding cap
  if (remainder > 0) {
    const order = eligible
      .map((_, idx) => ({
        idx,
        frac: exactShares[idx] - Math.floor(exactShares[idx]),
        cap: caps[idx],
        id: String(eligible[idx].id),
      }))
      .sort((a, b) => {
        if (Math.abs(b.frac - a.frac) > 1e-12) return b.frac - a.frac;
        if (b.cap !== a.cap) return b.cap - a.cap;
        return a.id.localeCompare(b.id);
      });

    let guard = 0;
    while (remainder > 0 && guard < 10) {
      let progressed = false;
      for (const item of order) {
        if (remainder <= 0) break;
        if (allocUnits[item.idx] < caps[item.idx]) {
          allocUnits[item.idx] += 1;
          remainder -= 1;
          progressed = true;
        }
      }
      if (!progressed) break;
      guard += 1;
    }
  }

  const precioPend = Boolean(options?.precioPendiente) || !(Number(options?.precioUnitario) > 0);
  const precio = precioPend ? 0 : Number(options?.precioUnitario || 0);
  const moneda: Currency = options?.moneda === 'BOB' ? 'BOB' : 'USD';
  const tc = Number(options?.tc) > 0 ? Number(options?.tc) : 6.96;

  // Build rows with positive allocation
  const rawRows = eligible
    .map((h, idx) => {
      const assigned = allocUnits[idx] / SCALE;
      return { h, assigned, units: allocUnits[idx] };
    })
    .filter((r) => r.units > 0);

  // Distribute exact monetary cents proportionally across allocated tons
  const totalCents = precioPend ? 0 : Math.round(roundMoney2(qty * precio) * 100);
  const rowCents: number[] = rawRows.map(() => 0);
  if (!precioPend && totalCents > 0 && rawRows.length > 0) {
    const totalAssignedUnits = rawRows.reduce((s, r) => s + r.units, 0);
    const exactCents = rawRows.map((r) => (totalCents * r.units) / totalAssignedUnits);
    for (let i = 0; i < rawRows.length; i++) {
      rowCents[i] = Math.floor(exactCents[i]);
    }
    let remCents = totalCents - rowCents.reduce((s, c) => s + c, 0);
    const centOrder = rawRows
      .map((r, idx) => ({
        idx,
        frac: exactCents[idx] - Math.floor(exactCents[idx]),
        units: r.units,
        id: String(r.h.id),
      }))
      .sort((a, b) => {
        if (Math.abs(b.frac - a.frac) > 1e-12) return b.frac - a.frac;
        if (b.units !== a.units) return b.units - a.units;
        return a.id.localeCompare(b.id);
      });
    for (let i = 0; i < centOrder.length && remCents > 0; i++) {
      rowCents[centOrder[i].idx] += 1;
      remCents -= 1;
    }
  }

  // Ensure displayed participacionPct sums cleanly to 100.00%
  const totalUnitsAll = rawRows.reduce((s, r) => s + r.units, 0);
  const pctBp = rawRows.map((r) => Math.floor((10_000 * r.units) / totalUnitsAll));
  let remBp = 10_000 - pctBp.reduce((s, v) => s + v, 0);
  const pctOrder = rawRows
    .map((r, idx) => ({
      idx,
      frac: (10_000 * r.units) / totalUnitsAll - Math.floor((10_000 * r.units) / totalUnitsAll),
      id: String(r.h.id),
    }))
    .sort((a, b) => {
      if (Math.abs(b.frac - a.frac) > 1e-12) return b.frac - a.frac;
      return a.id.localeCompare(b.id);
    });
  for (let i = 0; i < pctOrder.length && remBp > 0; i++) {
    pctBp[pctOrder[i].idx] += 1;
    remBp -= 1;
  }

  return rawRows.map((r, idx) => ({
    cosechaId: String(r.h.id),
    loteId: String(r.h.loteId || ''),
    loteNombre:
      (r.h.loteId && lotMap.get(String(r.h.loteId).trim())) ||
      r.h.loteNombre ||
      String(r.h.loteId || ''),
    campanaId: String(r.h.campanaId || ''),
    campanaNombre:
      (r.h.campanaId && campMap.get(String(r.h.campanaId).trim())) ||
      r.h.campanaNombre ||
      String(r.h.campanaId || ''),
    producto: String(r.h.producto || ''),
    unidad: r.h.unidad,
    disponibleAntes: r.h.pendiente,
    participacionPct: pctBp[idx] / 100,
    toneladasAsignadas: r.assigned,
    precioUnitario: precio,
    importeAsignado: rowCents[idx] / 100,
    moneda,
    tcHistorico: tc,
  }));
}

/**
 * Formats a concise lot-origin summary for a sale (e.g. "Lote 1" or "2 lotes" / "2 lots").
 */
export function formatSaleOriginSummary(
  sale: HarvestSale,
  lang: 'es' | 'en' = 'es'
): string {
  const dists = Array.isArray(sale.distribuciones)
    ? sale.distribuciones.filter((d) => d && !d.anulada && Number(d.toneladasAsignadas || 0) > 0)
    : [];
  if (dists.length === 0) {
    return sale.loteNombre || sale.origenResumen || '';
  }
  const uniqueLotNames = Array.from(
    new Set(dists.map((d) => String(d.loteNombre || d.loteId || '').trim()).filter(Boolean))
  );
  if (uniqueLotNames.length <= 1) {
    return uniqueLotNames[0] || sale.loteNombre || '';
  }
  if (uniqueLotNames.length === 2) {
    return uniqueLotNames.join(' · ');
  }
  return lang === 'en' ? `${uniqueLotNames.length} lots` : `${uniqueLotNames.length} lotes`;
}
