export type IconCategory = 'maquinaria' | 'implemento' | 'gasto' | 'ingreso';

export interface IconDefinition {
  id: string;
  name: string;
  label?: string;
  category: IconCategory;
  keywords: string[];
  description?: string;
}

export const ICON_CATALOG: IconDefinition[] = [
  // --- 1. INGRESOS AGRÍCOLAS ---
  {
    id: 'soya',
    name: 'Venta de Soya',
    label: 'Venta de Soya',
    category: 'ingreso',
    keywords: ['soya', 'soja', 'cosecha', 'granos', 'venta de soya', 'legumbre', 'grano de oro', 'oleaginosa'],
    description: 'Venta o cosecha de granos de soya',
  },
  {
    id: 'maiz',
    name: 'Venta de Maíz',
    label: 'Venta de Maíz',
    category: 'ingreso',
    keywords: ['maiz', 'maíz', 'choclo', 'grano', 'venta de maiz', 'cosecha', 'cereal'],
    description: 'Venta o cosecha de maíz amarillo o blanco',
  },
  {
    id: 'trigo',
    name: 'Venta de Trigo',
    label: 'Venta de Trigo',
    category: 'ingreso',
    keywords: ['trigo', 'espiga', 'cereal', 'harina', 'venta de trigo', 'cosecha', 'pan'],
    description: 'Venta o cosecha de trigo harinero o forrajero',
  },
  {
    id: 'sorgo',
    name: 'Venta de Sorgo',
    label: 'Venta de Sorgo',
    category: 'ingreso',
    keywords: ['sorgo', 'panoja', 'grano rojo', 'venta de sorgo', 'cosecha', 'forraje'],
    description: 'Venta o cosecha de sorgo granífero',
  },
  {
    id: 'girasol',
    name: 'Venta de Girasol',
    label: 'Venta de Girasol',
    category: 'ingreso',
    keywords: ['girasol', 'pepitas', 'semilla', 'aceitera', 'venta de girasol', 'flor', 'cosecha'],
    description: 'Venta o cosecha de semillas de girasol',
  },
  {
    id: 'granos',
    name: 'Otros Granos Agrícolas',
    label: 'Otros Granos Agrícolas',
    category: 'ingreso',
    keywords: ['granos', 'productos', 'agricolas', 'chia', 'chía', 'sesamo', 'sésamo', 'frijol', 'cosecha'],
    description: 'Venta de chía, sésamo, frijol u otros productos agrícolas',
  },
  {
    id: 'otros-ingresos',
    name: 'Otros Ingresos',
    label: 'Otros Ingresos',
    category: 'ingreso',
    keywords: ['ingreso', 'dinero', 'venta', 'cobro', 'otros ingresos', 'bolivianos', 'dolares', 'renta'],
    description: 'Otros ingresos, cobros extraordinarios o servicios de la propiedad',
  },

  // --- 2. MAQUINARIAS ---
  {
    id: 'tractor',
    name: 'Tractor Agrícola',
    category: 'maquinaria',
    keywords: ['tractor', 'verde', 'john deere', 'campo', 'agricola', 'motor'],
    description: 'Tractor agrícola estándar de alta tracción para labores de campo',
  },
  {
    id: 'tractor-blue',
    name: 'Tractor New Holland',
    category: 'maquinaria',
    keywords: ['tractor', 'azul', 'new holland', 'ts115', 'ts 115', 'nh'],
    description: 'Tractor agrícola azul tipo New Holland TS115 con cabina',
  },
  {
    id: 'cosechadora',
    name: 'Cosechadora',
    category: 'maquinaria',
    keywords: ['cosechadora', 'trilladora', 'recolectora', 'granos', 'soya', 'maiz'],
    description: 'Cosechadora autopropulsada con cabezal y tolva de granos',
  },
  {
    id: 'camion',
    name: 'Camión de Carga',
    category: 'maquinaria',
    keywords: ['camion', 'transporte', 'carga', 'tolva', 'volqueta', 'granos'],
    description: 'Camión agrícola de transporte pesado y tolva granelera',
  },
  {
    id: 'cargadora',
    name: 'Pala Cargadora',
    category: 'maquinaria',
    keywords: ['cargadora', 'pala frontal', 'cargador', 'movimiento tierra', 'balde'],
    description: 'Pala cargadora frontal articulada para acopio y carga',
  },
  {
    id: 'excavadora',
    name: 'Excavadora',
    category: 'maquinaria',
    keywords: ['excavadora', 'oruga', 'retroexcavadora', 'canales', 'zanjas', 'hidraulica'],
    description: 'Excavadora sobre orugas con brazo hidráulico y cuchara',
  },
  {
    id: 'motoniveladora',
    name: 'Motoniveladora',
    category: 'maquinaria',
    keywords: ['motoniveladora', 'caminos', 'nivelacion', 'cuchilla', 'grader'],
    description: 'Motoniveladora para mantenimiento de caminos internos y desagües',
  },
  {
    id: 'pulverizadora',
    name: 'Pulverizadora Autopropulsada',
    category: 'maquinaria',
    keywords: ['pulverizadora', 'fumigadora', 'mosquito', 'botalon', 'quimicos'],
    description: 'Pulverizadora autopropulsada de alto despeje con barras de aplicación',
  },
  {
    id: 'otros-equipos',
    name: 'Otros Equipos',
    category: 'maquinaria',
    keywords: ['equipo', 'otro', 'maquinaria', 'utilitario', 'generador'],
    description: 'Equipo o maquinaria auxiliar de la propiedad',
  },

  // --- 2. IMPLEMENTOS AGRÍCOLAS ---
  {
    id: 'sembradora',
    name: 'Sembradora',
    category: 'implemento',
    keywords: ['sembradora', 'siembra', 'granos gruesos', 'granos finos', 'lineas'],
    description: 'Sembradora neumática de tiro para siembra directa y fertilización',
  },
  {
    id: 'romplow',
    name: 'Romplow',
    category: 'implemento',
    keywords: ['romplow', 'arado pesado', 'desmonte', 'roturacion', 'discos pesados'],
    description: 'Arado romplow pesado de discos para roturación de suelo virgen',
  },
  {
    id: 'ripper',
    name: 'Ripper / Subsolador',
    category: 'implemento',
    keywords: ['ripper', 'subsolador', 'descompactador', 'timones', 'puntas'],
    description: 'Subsolador ripper de timones curvos para romper capas compactadas',
  },
  {
    id: 'pala-niveladora',
    name: 'Pala Niveladora',
    category: 'implemento',
    keywords: ['pala niveladora', 'nivelacion', 'hoja', 'emparejado', 'laser'],
    description: 'Pala niveladora de arrastre para emparejado de suelos y caminos',
  },
  {
    id: 'rastra',
    name: 'Rastra de Discos',
    category: 'implemento',
    keywords: ['rastra', 'discos', 'rastreada', 'desterronado', 'preparacion'],
    description: 'Rastra tándem de discos cóncavos para preparación de cama de siembra',
  },
  {
    id: 'trailla',
    name: 'Traílla',
    category: 'implemento',
    keywords: ['trailla', 'scraper', 'movimiento tierra', 'terraplen', 'cuchilla'],
    description: 'Traílla para corte, transporte y nivelación de suelo',
  },
  {
    id: 'cortadora-sorgo',
    name: 'Cortadora de Sorgo',
    category: 'implemento',
    keywords: ['cortadora de sorgo', 'forrajera', 'corte', 'picadora', 'silaje'],
    description: 'Cortadora rotativa para cosecha de sorgo forrajero y pasturas',
  },
  {
    id: 'rolo',
    name: 'Rolo Cuchilla',
    category: 'implemento',
    keywords: ['rolo', 'triturador', 'rastrojo', 'cuchillas', 'aplastador'],
    description: 'Rolo cuchilla para acondicionamiento y picado de rastrojo vegetal',
  },
  {
    id: 'fumigadora',
    name: 'Fumigadora de Arrastre',
    category: 'implemento',
    keywords: ['fumigadora', 'tanque', 'aplicador', 'botalones', 'boquillas'],
    description: 'Fumigadora de tiro acoplada a la toma de fuerza del tractor',
  },
  {
    id: 'cultivador',
    name: 'Cultivador',
    category: 'implemento',
    keywords: ['cultivador', 'escarificador', 'arado de cinceles', 'chisel'],
    description: 'Cultivador de púas y arcos flexibles para control mecánico de malezas',
  },
  {
    id: 'otros-implementos',
    name: 'Otros Implementos',
    category: 'implemento',
    keywords: ['implemento', 'herramienta', 'acople', 'enganche', 'accesorio'],
    description: 'Implemento agrícola acoplable de tres puntos o de tiro',
  },

  // --- 3. GASTOS Y PRODUCTOS ---
  {
    id: 'diesel',
    name: 'Diésel',
    category: 'gasto',
    keywords: ['diesel', 'gasoil', 'combustible', 'carburante', 'surtidor', 'tanque'],
    description: 'Combustible diésel para maquinaria pesada y tractores',
  },
  {
    id: 'gasolina',
    name: 'Gasolina',
    category: 'gasto',
    keywords: ['gasolina', 'combustible', 'nafta', 'bidon', 'motores'],
    description: 'Gasolina para vehículos de apoyo y motobombas',
  },
  {
    id: 'aceite',
    name: 'Aceite de Motor',
    category: 'gasto',
    keywords: ['aceite', 'lubricante', '15w40', 'hidraulico', 'transmision'],
    description: 'Aceite lubricante para motor, caja y sistema hidráulico',
  },
  {
    id: 'filtro',
    name: 'Filtros',
    category: 'gasto',
    keywords: ['filtro', 'aire', 'combustible', 'aceite', 'cartucho', 'separador'],
    description: 'Filtros de aire, combustible, aceite y refrigerante',
  },
  {
    id: 'neumaticos',
    name: 'Neumáticos / Llantas',
    category: 'gasto',
    keywords: ['neumaticos', 'llantas', 'cubiertas', 'ruedas', 'gomas', 'parche'],
    description: 'Neumáticos agrícolas de tracción, cámaras y servicios de vulcanizado',
  },
  {
    id: 'bateria',
    name: 'Batería',
    category: 'gasto',
    keywords: ['bateria', 'acumulador', 'electrico', '12v', '24v', 'bornes'],
    description: 'Batería de arranque para tractores y camiones',
  },
  {
    id: 'repuestos',
    name: 'Repuestos',
    category: 'gasto',
    keywords: ['repuestos', 'piezas', 'engranajes', 'correas', 'pernos', 'mangueras'],
    description: 'Repuestos mecánicos, piezas de recambio y rodamientos',
  },
  {
    id: 'mantenimiento',
    name: 'Mantenimiento / Taller',
    category: 'gasto',
    keywords: ['mantenimiento', 'taller', 'reparacion', 'mecanico', 'servicio tecnico'],
    description: 'Mano de obra de taller, torno, soldadura y service preventivo',
  },
  {
    id: 'grasa',
    name: 'Grasas y Lubricantes',
    category: 'gasto',
    keywords: ['grasa', 'engrase', 'chasis', 'rodamientos', 'litio', 'grasera'],
    description: 'Grasas para rodamientos, pernos y articulaciones de máquinas',
  },
  {
    id: 'semillas',
    name: 'Semillas',
    category: 'gasto',
    keywords: ['semillas', 'soya', 'maiz', 'sorgo', 'girasol', 'bolsa', 'siembra'],
    description: 'Semilla certificada para siembra de campaña',
  },
  {
    id: 'fertilizante',
    name: 'Fertilizantes',
    category: 'gasto',
    keywords: ['fertilizante', 'urea', 'fosfato', 'dap', 'abono', 'nutrientes'],
    description: 'Fertilizantes químicos y orgánicos para nutrición vegetal',
  },
  {
    id: 'herbicida',
    name: 'Herbicidas',
    category: 'gasto',
    keywords: ['herbicida', 'glifosato', 'maleza', 'defoliante', 'quimico'],
    description: 'Productos fitosanitarios para control de malezas',
  },
  {
    id: 'insecticida',
    name: 'Insecticidas',
    category: 'gasto',
    keywords: ['insecticida', 'plagas', 'gusano', 'chinche', 'oruga', 'veneno'],
    description: 'Productos para control de plagas e insectos en el cultivo',
  },
  {
    id: 'otros-gastos',
    name: 'Otros Gastos',
    category: 'gasto',
    keywords: ['otros', 'varios', 'gastos', 'administrativo', 'comida', 'jornal'],
    description: 'Gastos operativos generales de la campaña o el establecimiento',
  },
];

/**
 * Normaliza y busca la mejor coincidencia de icono realista en el catálogo.
 * Soporta tanto identificadores de recursos ('tractor', 'diesel') como nombres reales de ítems o labores.
 */
export function getIconDefinition(idOrName?: string, categoryHint?: IconCategory): IconDefinition {
  if (!idOrName) {
    return getDefaultIconForCategory(categoryHint || 'maquinaria');
  }

  const clean = String(idOrName).trim().toLowerCase();

  // 1. Coincidencia exacta por ID
  const directMatch = ICON_CATALOG.find((icon) => icon.id === clean);
  if (directMatch) return directMatch;

  // 2. Mapeos de ingresos agrícolas
  if (clean.includes('soya') || clean.includes('soja')) return findIcon('soya');
  if (clean.includes('maiz') || clean.includes('maíz') || clean.includes('choclo')) return findIcon('maiz');
  if (clean.includes('trigo')) return findIcon('trigo');
  if (clean.includes('sorgo')) {
    if (clean.includes('cortadora') || categoryHint === 'implemento') return findIcon('cortadora-sorgo');
    return findIcon('sorgo');
  }
  if (clean.includes('girasol')) return findIcon('girasol');
  if (clean.includes('grano') || clean.includes('chia') || clean.includes('sesamo') || clean.includes('frijol')) return findIcon('granos');
  if (clean.includes('ingreso') || (categoryHint === 'ingreso' && clean.includes('venta'))) return findIcon('otros-ingresos');

  // 3. Mapeos comunes por nombre de labores oficiales
  if (clean.includes('sembradora') || clean.includes('siembra')) return findIcon('sembradora');
  if (clean.includes('romplow')) return findIcon('romplow');
  if (clean.includes('ripper') || clean.includes('subsolador')) return findIcon('ripper');
  if (clean.includes('pala') || clean.includes('niveladora')) return findIcon('pala-niveladora');
  if (clean.includes('rastra') || clean.includes('rastreada')) return findIcon('rastra');
  if (clean.includes('trailla') || clean.includes('traílla')) return findIcon('trailla');
  if (clean.includes('rolo')) return findIcon('rolo');
  if (clean.includes('fumig') || clean.includes('pulveriz')) {
    return categoryHint === 'maquinaria' ? findIcon('pulverizadora') : findIcon('fumigadora');
  }

  // 4. Mapeos de gastos
  if (clean.includes('diesel') || clean.includes('diésel') || clean.includes('combustible')) return findIcon('diesel');
  if (clean.includes('gasolina')) return findIcon('gasolina');
  if (clean.includes('aceite') || clean.includes('lubricante')) return findIcon('aceite');
  if (clean.includes('filtro')) return findIcon('filtro');
  if (clean.includes('neumat') || clean.includes('llanta') || clean.includes('goma')) return findIcon('neumaticos');
  if (clean.includes('bateria') || clean.includes('batería')) return findIcon('bateria');
  if (clean.includes('repuesto') || clean.includes('pieza')) return findIcon('repuestos');
  if (clean.includes('mantenimiento') || clean.includes('taller') || clean.includes('reparac')) return findIcon('mantenimiento');
  if (clean.includes('grasa')) return findIcon('grasa');
  if (clean.includes('semilla')) return findIcon('semillas');
  if (clean.includes('fertiliz') || clean.includes('urea') || clean.includes('abono')) return findIcon('fertilizante');
  if (clean.includes('herbicida')) return findIcon('herbicida');
  if (clean.includes('insecticida')) return findIcon('insecticida');
  if (clean.includes('fungicida')) return findIcon('insecticida');

  // 5. Mapeos de maquinarias
  if (clean.includes('new holland') || clean.includes('ts115') || clean.includes('ts 115')) return findIcon('tractor-blue');
  if (clean.includes('cosechadora') || clean.includes('trilladora')) return findIcon('cosechadora');
  if (clean.includes('camion') || clean.includes('camión')) return findIcon('camion');
  if (clean.includes('cargador') || clean.includes('pala')) return findIcon('cargadora');
  if (clean.includes('excavador') || clean.includes('retro')) return findIcon('excavadora');
  if (clean.includes('motonivel')) return findIcon('motoniveladora');
  if (clean.includes('tractor')) return findIcon('tractor');

  // 6. Coincidencia por palabras clave
  const keywordMatch = ICON_CATALOG.find((icon) =>
    icon.keywords.some((k) => clean.includes(k))
  );
  if (keywordMatch) return { ...keywordMatch, label: keywordMatch.label || keywordMatch.name };

  return getDefaultIconForCategory(categoryHint || 'maquinaria');
}

function findIcon(id: string): IconDefinition {
  const icon = ICON_CATALOG.find((i) => i.id === id) || ICON_CATALOG[0];
  return { ...icon, label: icon.label || icon.name };
}

export function getDefaultIconForCategory(cat: IconCategory): IconDefinition {
  if (cat === 'implemento') return findIcon('sembradora');
  if (cat === 'gasto') return findIcon('diesel');
  if (cat === 'ingreso') return findIcon('soya');
  return findIcon('tractor');
}

export function searchIcons(query: string, categoryFilter?: IconCategory | 'todos'): IconDefinition[] {
  const q = String(query || '').trim().toLowerCase();
  return ICON_CATALOG.filter((item) => {
    if (categoryFilter && categoryFilter !== 'todos' && item.category !== categoryFilter) {
      return false;
    }
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }).map((item) => ({ ...item, label: item.label || item.name }));
}
