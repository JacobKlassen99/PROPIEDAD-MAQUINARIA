import type { HarvestRecord, HarvestSale } from '../types';

export const HARVEST_AVAILABILITY_EPSILON = 0.0001;

function roundTons(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 1_000_000) / 1_000_000;
}

/**
 * Centralized harvest availability calculation shared across PropertyView,
 * HarvestSalesView, and backend normalization.
 *
 * Available tons = harvested tons - sum(non-cancelled sales for that harvest),
 * explicitly counting sales with pending buyer and/or pending price so the same
 * tons can never be sold twice.
 */
export function computeHarvestAvailability(
  harvests: HarvestRecord[],
  sales?: HarvestSale[]
): HarvestRecord[] {
  const list = Array.isArray(harvests) ? harvests : [];
  if (!sales) {
    return list.map((h) => {
      const toneladas = Math.max(0, roundTons(h.toneladas));
      const asignadas = Math.max(0, roundTons(h.asignadas));
      const pendiente = Math.max(0, roundTons(toneladas - asignadas));
      return {
        ...h,
        toneladas,
        asignadas,
        pendiente,
      };
    });
  }

  const committedByHarvestId = new Map<string, number>();
  for (const sale of sales) {
    if (!sale || sale.anulada) continue;
    const cid = String(sale.cosechaId || '').trim();
    if (!cid) continue;
    const qty = Math.max(0, roundTons(sale.cantidad));
    if (qty <= 0) continue;
    committedByHarvestId.set(cid, roundTons((committedByHarvestId.get(cid) || 0) + qty));
  }

  return list.map((h) => {
    const id = String(h.id || '').trim();
    const toneladas = Math.max(0, roundTons(h.toneladas));
    const committedFromSales = committedByHarvestId.get(id) ?? 0;
    const asignadas = Math.max(0, roundTons(committedFromSales));
    const pendiente = Math.max(0, roundTons(toneladas - asignadas));
    return {
      ...h,
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
