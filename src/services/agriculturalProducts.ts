import type { ItemConfig } from '../types';

export function normalizeConceptText(value: string | undefined | null): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Strips common Spanish/English sales or harvest prefixes so legacy product text
 * (e.g. "Soya") can be unambiguously matched against registered concepts (e.g. "Venta de Soya").
 */
export function stripAgriculturalProductPrefixes(normalized: string): string {
  let s = normalized.trim();
  const patterns = [
    /^venta\s+de\s+cosecha\s+de\s+/,
    /^venta\s+de\s+cosecha\s+/,
    /^venta\s+cosecha\s+de\s+/,
    /^venta\s+cosecha\s+/,
    /^venta\s+de\s+/,
    /^venta\s+/,
    /^cosecha\s+de\s+/,
    /^cosecha\s+/,
    /^harvest\s+sale\s+of\s+/,
    /^harvest\s+sale\s+/,
    /^sale\s+of\s+/,
    /^harvest\s+of\s+/,
    /^harvest\s+/,
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of patterns) {
      if (re.test(s)) {
        s = s.replace(re, '').trim();
        changed = true;
      }
    }
  }
  return s;
}

const NON_HARVEST_PROPERTY_INCOME_PATTERNS: RegExp[] = [
  /\b(interes|intereses|mora|moratorio|interest|late\s+payment|recargo)\b/,
  /\b(servicio|servicios|alquiler|arriendo|arrendamiento|renta|maquinaria|flete|transporte|comision|honorario|service|services|rental|lease|freight)\b/,
  /\b(otros?\s+ingresos?|other\s+income|subsidio|reembolso|devolucion|ajuste|indemnizacion|seguro|prestamo|credito|bono|aporte|dividendo|multa|varios)\b/,
];

export function isPropertyIncomeConcept(item: ItemConfig | null | undefined): boolean {
  if (!item) return false;
  const mod = String(item.modulo || '').trim().toUpperCase();
  const cls = String(item.clase || '').trim().toUpperCase();
  const tipo = String(item.tipo || '').trim().toLowerCase();

  if (mod === 'MAQUINARIAS' || tipo.includes('maquinaria')) return false;
  if (cls && !cls.includes('ING')) return false;

  const isProp = mod === 'PROPIEDAD' || tipo === 'ingreso_propiedad' || (!mod && tipo.includes('propiedad'));
  const isIng = cls.includes('ING') || tipo === 'ingreso_propiedad';
  return isProp && isIng;
}

export function isNonHarvestPropertyIncomeConcept(item: ItemConfig | null | undefined): boolean {
  if (!item) return true;
  if (String(item.id || '').trim().toUpperCase() === 'SYS_INTERES_MORA') return true;
  const norm = normalizeConceptText(item.nombre);
  if (!norm) return true;
  return NON_HARVEST_PROPERTY_INCOME_PATTERNS.some((re) => re.test(norm));
}

/**
 * Identifies income concepts registered in Administración → Conceptos → Ingresos (Módulo Propiedad)
 * that represent agricultural harvest products, excluding interest, services, rentals, and misc incomes.
 */
export function isAgriculturalProductConcept(item: ItemConfig | null | undefined): boolean {
  if (!isPropertyIncomeConcept(item)) return false;
  return !isNonHarvestPropertyIncomeConcept(item);
}

/**
 * Returns active agricultural product concepts for Propiedad → Registrar cosecha.
 * Single source of truth: no hardcoded crop list and no duplicates.
 */
export function getActiveAgriculturalProductConcepts(itemsConfig: ItemConfig[] | undefined | null): ItemConfig[] {
  const list = Array.isArray(itemsConfig) ? itemsConfig : [];
  const seenIds = new Set<string>();
  const result: ItemConfig[] = [];
  for (const item of list) {
    if (!item || item.activo === false) continue;
    if (!isAgriculturalProductConcept(item)) continue;
    const idKey = String(item.id || '').trim() || normalizeConceptText(item.nombre);
    if (!idKey || seenIds.has(idKey)) continue;
    seenIds.add(idKey);
    result.push(item);
  }
  return result.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
}

export interface AgriculturalConceptResolution {
  concept: ItemConfig | null;
  status: 'by_id' | 'exact_name' | 'legacy_unambiguous' | 'ambiguous' | 'unmatched';
  candidates?: ItemConfig[];
}

/**
 * Resolves a harvest or harvest-sale record to its registered Property income concept.
 * Priority:
 *  1. Stable conceptoId (works even if the concept was renamed or deactivated).
 *  2. Exact normalized name match among Property income concepts (only if unique).
 *  3. Unambiguous prefix-stripped match among agricultural product concepts (e.g. "Soya" -> "Venta de Soya"),
 *     refusing to auto-merge whenever more than one concept matches.
 */
export function resolveAgriculturalConcept(
  params: { conceptoId?: string; producto?: string } | null | undefined,
  itemsConfig: ItemConfig[] | undefined | null
): AgriculturalConceptResolution {
  const list = Array.isArray(itemsConfig) ? itemsConfig : [];
  if (!params || list.length === 0) {
    return { concept: null, status: 'unmatched' };
  }

  const targetId = String(params.conceptoId || '').trim();
  if (targetId) {
    const byId = list.find((it) => it && String(it.id || '').trim() === targetId);
    if (byId) {
      return { concept: byId, status: 'by_id' };
    }
  }

  const normProd = normalizeConceptText(params.producto);
  if (!normProd) {
    return { concept: null, status: 'unmatched' };
  }

  const propIncomes = list.filter((it) => isPropertyIncomeConcept(it));

  // Exact normalized name match
  const exactMatches = propIncomes.filter((it) => normalizeConceptText(it.nombre) === normProd);
  if (exactMatches.length === 1) {
    return { concept: exactMatches[0], status: 'exact_name' };
  }
  if (exactMatches.length > 1) {
    const activeExact = exactMatches.filter((it) => it.activo !== false);
    if (activeExact.length === 1) {
      return { concept: activeExact[0], status: 'exact_name' };
    }
    return { concept: null, status: 'ambiguous', candidates: exactMatches };
  }

  // Unambiguous legacy core-name match (e.g. "Soya" <-> "Venta de Soya")
  const targetCore = stripAgriculturalProductPrefixes(normProd);
  if (!targetCore) {
    return { concept: null, status: 'unmatched' };
  }

  const agriConcepts = propIncomes.filter((it) => !isNonHarvestPropertyIncomeConcept(it));
  const coreMatches = agriConcepts.filter(
    (it) => stripAgriculturalProductPrefixes(normalizeConceptText(it.nombre)) === targetCore
  );

  if (coreMatches.length === 1) {
    return { concept: coreMatches[0], status: 'legacy_unambiguous' };
  }
  if (coreMatches.length > 1) {
    return { concept: null, status: 'ambiguous', candidates: coreMatches };
  }

  return { concept: null, status: 'unmatched' };
}

export interface HarvestProductDisplayInfo {
  conceptoId: string;
  displayName: string;
  iconId: string;
  concept: ItemConfig | null;
  status: AgriculturalConceptResolution['status'];
}

export function getHarvestProductDisplay(
  record: { conceptoId?: string; producto?: string } | null | undefined,
  itemsConfig: ItemConfig[] | undefined | null
): HarvestProductDisplayInfo {
  const resolution = resolveAgriculturalConcept(record, itemsConfig);
  const rawName = String(record?.producto || '').trim();
  if (resolution.concept) {
    return {
      conceptoId: resolution.concept.id,
      displayName: resolution.concept.nombre,
      iconId: resolution.concept.icono || '',
      concept: resolution.concept,
      status: resolution.status,
    };
  }
  return {
    conceptoId: String(record?.conceptoId || '').trim(),
    displayName: rawName,
    iconId: '',
    concept: null,
    status: resolution.status,
  };
}
