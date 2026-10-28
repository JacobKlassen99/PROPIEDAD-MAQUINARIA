import React from 'react';
import { getIconDefinition, IconCategory } from '../services/iconCatalog';

interface VisualIconProps {
  iconId?: string;
  nameHint?: string;
  category?: IconCategory;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  showBadge?: boolean;
}

export const VisualIcon: React.FC<VisualIconProps> = ({
  iconId,
  nameHint,
  category,
  size = 'md',
  className = '',
}) => {
  const definition = getIconDefinition(iconId || nameHint, category);
  const id = definition.id;

  let pxSize = 36;
  if (typeof size === 'number') {
    pxSize = size;
  } else {
    switch (size) {
      case 'xs':
        pxSize = 20;
        break;
      case 'sm':
        pxSize = 26;
        break;
      case 'md':
        pxSize = 36;
        break;
      case 'lg':
        pxSize = 48;
        break;
      case 'xl':
        pxSize = 64;
        break;
    }
  }

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 select-none overflow-hidden ${className}`}
      style={{ width: pxSize, height: pxSize }}
      title={definition.name}
    >
      <svg
        viewBox="0 0 100 100"
        width={pxSize}
        height={pxSize}
        className="w-full h-full drop-shadow-xs"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Shared Gradients */}
          <linearGradient id="jdGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>
          <linearGradient id="jdYellow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#eab308" />
          </linearGradient>
          <linearGradient id="nhBlue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
          <linearGradient id="caseRed" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
          <linearGradient id="catYellow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <linearGradient id="steelMetal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#cbd5e1" />
            <stop offset="50%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
          <linearGradient id="darkTire" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id="cabGlass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.65" />
          </linearGradient>
          <linearGradient id="dieselAmber" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <linearGradient id="burlapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d6d3d1" />
            <stop offset="100%" stopColor="#a8a29e" />
          </linearGradient>
        </defs>

        {renderSvgContent(id)}
      </svg>
    </div>
  );
};

function renderSvgContent(id: string): React.ReactNode {
  switch (id) {
    // ==========================================
    // 1. MAQUINARIAS
    // ==========================================
    case 'tractor':
      return (
        <g>
          {/* Tractor Green (John Deere Style) */}
          {/* Rear Huge Tire */}
          <circle cx="34" cy="62" r="26" fill="url(#darkTire)" />
          <circle cx="34" cy="62" r="16" fill="url(#jdYellow)" stroke="#ca8a04" strokeWidth="2.5" />
          <circle cx="34" cy="62" r="6" fill="#1e293b" />
          {/* Treads Rear */}
          <path d="M22 42l6 4M14 56l7 2M16 72l6-2M26 84l4-6M42 42l-6 4M50 54l-6 2M48 72l-5-2" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />

          {/* Engine & Hood Body */}
          <path d="M36 46h32l16 12v12H36z" fill="url(#jdGreen)" />
          {/* Hood curve top */}
          <path d="M50 46h20c6 0 10 3 14 8v4H50z" fill="#4ade80" />
          {/* Yellow Side Stripe */}
          <path d="M46 54h36v3H46z" fill="url(#jdYellow)" />
          {/* Exhaust Pipe */}
          <path d="M62 46V22h4v24" fill="url(#steelMetal)" />
          <path d="M66 22l3-3" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />

          {/* Cabin */}
          <path d="M30 46h22V24H32c-3 0-5 2-6 5l-4 17h8z" fill="#14532d" />
          <path d="M32 26h18v18H28l3-16c.3-1.2 1.3-2 2.5-2z" fill="url(#cabGlass)" />
          <path d="M28 22h28v4H28z" fill="#15803d" />

          {/* Front Small Wheel */}
          <circle cx="82" cy="70" r="15" fill="url(#darkTire)" />
          <circle cx="82" cy="70" r="9" fill="url(#jdYellow)" stroke="#ca8a04" strokeWidth="2" />
          <circle cx="82" cy="70" r="3.5" fill="#1e293b" />
          {/* Front Grille & Headlight */}
          <rect x="82" y="58" width="4" height="6" rx="2" fill="#fef08a" />
        </g>
      );

    case 'tractor-blue':
      return (
        <g>
          {/* Tractor Blue (New Holland TS115 Style) */}
          {/* Rear Tire */}
          <circle cx="34" cy="62" r="26" fill="url(#darkTire)" />
          <circle cx="34" cy="62" r="16" fill="url(#steelMetal)" stroke="#64748b" strokeWidth="2.5" />
          <circle cx="34" cy="62" r="6" fill="#0f172a" />
          <path d="M22 42l6 4M14 56l7 2M16 72l6-2M26 84l4-6M42 42l-6 4M50 54l-6 2M48 72l-5-2" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />

          {/* Engine & Hood Body Blue */}
          <path d="M36 46h32l16 12v12H36z" fill="url(#nhBlue)" />
          <path d="M50 46h20c6 0 10 3 14 8v4H50z" fill="#38bdf8" />
          {/* White Side Accent Decal */}
          <path d="M46 54h36v2.5H46z" fill="#ffffff" />
          {/* Exhaust Pipe */}
          <path d="M60 46V22h4v24" fill="url(#steelMetal)" />
          <path d="M64 22l3-3" stroke="#475569" strokeWidth="2" strokeLinecap="round" />

          {/* Cabin (White Roof) */}
          <path d="M30 46h22V24H32c-3 0-5 2-6 5l-4 17h8z" fill="#0369a1" />
          <path d="M32 26h18v18H28l3-16c.3-1.2 1.3-2 2.5-2z" fill="url(#cabGlass)" />
          {/* New Holland White Cabin Roof */}
          <path d="M27 21h30v5H27z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />

          {/* Front Wheel */}
          <circle cx="82" cy="70" r="15" fill="url(#darkTire)" />
          <circle cx="82" cy="70" r="9" fill="url(#steelMetal)" stroke="#64748b" strokeWidth="2" />
          <circle cx="82" cy="70" r="3.5" fill="#0f172a" />
          {/* Headlight */}
          <rect x="82" y="58" width="4" height="6" rx="2" fill="#fef08a" />
        </g>
      );

    case 'cosechadora':
      return (
        <g>
          {/* Combine Harvester */}
          {/* Big Body */}
          <path d="M20 30h45l15 15v25H20z" fill="url(#jdGreen)" />
          <path d="M20 30h40l8 12H20z" fill="#4ade80" />
          {/* Grain Tank Top */}
          <path d="M30 20h28v12H30z" fill="url(#jdYellow)" />
          {/* Unloading Auger Pipe */}
          <path d="M20 32l-14-16h8l14 16" fill="url(#steelMetal)" />
          {/* Cabin Front Top */}
          <path d="M62 30h20v22H62z" fill="#14532d" />
          <path d="M64 32h16v18H64z" fill="url(#cabGlass)" />
          <path d="M60 27h25v4H60z" fill="#fef08a" />
          {/* Reel / Header Front */}
          <rect x="76" y="66" width="18" height="14" rx="3" fill="url(#steelMetal)" stroke="#475569" strokeWidth="1.5" />
          <circle cx="85" cy="73" r="5" fill="#cbd5e1" stroke="#334155" strokeWidth="1" />
          {/* Large Front Drive Wheel */}
          <circle cx="56" cy="72" r="18" fill="url(#darkTire)" />
          <circle cx="56" cy="72" r="10" fill="url(#jdYellow)" stroke="#ca8a04" strokeWidth="2" />
          {/* Small Rear Steering Wheel */}
          <circle cx="28" cy="76" r="12" fill="url(#darkTire)" />
          <circle cx="28" cy="76" r="6" fill="url(#jdYellow)" stroke="#ca8a04" strokeWidth="1.5" />
        </g>
      );

    case 'camion':
      return (
        <g>
          {/* Agricultural Truck */}
          {/* Cargo Dump Bed (Green/White) */}
          <rect x="12" y="32" width="48" height="34" rx="2" fill="url(#jdGreen)" stroke="#166534" strokeWidth="1.5" />
          <path d="M12 44h48M12 54h48" stroke="#166534" strokeWidth="1" />
          {/* Cabin (White / Chrome) */}
          <path d="M62 38h20c4 0 7 3 8 7l4 14v10H62z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
          {/* Windshield */}
          <path d="M64 42h16l4 10H64z" fill="url(#cabGlass)" />
          {/* Grille & Bumper */}
          <rect x="88" y="58" width="6" height="8" rx="1" fill="url(#steelMetal)" />
          <rect x="86" y="66" width="8" height="4" fill="#64748b" />
          {/* Wheels (3 Axles) */}
          <circle cx="24" cy="74" r="12" fill="url(#darkTire)" />
          <circle cx="24" cy="74" r="6" fill="url(#steelMetal)" />
          <circle cx="44" cy="74" r="12" fill="url(#darkTire)" />
          <circle cx="44" cy="74" r="6" fill="url(#steelMetal)" />
          <circle cx="78" cy="74" r="12" fill="url(#darkTire)" />
          <circle cx="78" cy="74" r="6" fill="url(#steelMetal)" />
        </g>
      );

    case 'cargadora':
      return (
        <g>
          {/* Wheel Loader */}
          {/* Main Body */}
          <path d="M22 46h32v22H22z" fill="url(#catYellow)" />
          {/* Counterweight rear */}
          <path d="M16 52h8v16h-8z" fill="#475569" />
          {/* Cab */}
          <path d="M34 26h18v22H34z" fill="#d97706" />
          <path d="M36 28h14v18H36z" fill="url(#cabGlass)" />
          <path d="M32 23h22v4H32z" fill="#1e293b" />
          {/* Boom Arms */}
          <path d="M50 56l26-16l10 18" stroke="url(#steelMetal)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* Bucket */}
          <path d="M82 46l12 6l-6 24l-12-6z" fill="url(#catYellow)" stroke="#b45309" strokeWidth="1.5" />
          {/* Teeth */}
          <path d="M94 52l4 2M91 62l4 2M88 72l4 2" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
          {/* Wheels */}
          <circle cx="30" cy="72" r="16" fill="url(#darkTire)" />
          <circle cx="30" cy="72" r="8" fill="url(#catYellow)" stroke="#ca8a04" strokeWidth="2" />
          <circle cx="68" cy="72" r="16" fill="url(#darkTire)" />
          <circle cx="68" cy="72" r="8" fill="url(#catYellow)" stroke="#ca8a04" strokeWidth="2" />
        </g>
      );

    case 'excavadora':
      return (
        <g>
          {/* Crawler Excavator */}
          {/* Continuous Tracks Base */}
          <rect x="14" y="68" width="56" height="18" rx="9" fill="url(#darkTire)" stroke="#0f172a" strokeWidth="1.5" />
          <circle cx="23" cy="77" r="6" fill="url(#steelMetal)" />
          <circle cx="35" cy="77" r="5" fill="url(#steelMetal)" />
          <circle cx="47" cy="77" r="5" fill="url(#steelMetal)" />
          <circle cx="59" cy="77" r="6" fill="url(#steelMetal)" />
          {/* Track treads */}
          <path d="M18 70h48M18 84h48" stroke="#475569" strokeWidth="2" strokeDasharray="3 3" />

          {/* Rotating Upper House */}
          <path d="M20 48h34l6 6v14H20z" fill="url(#catYellow)" />
          {/* Cab Glass */}
          <path d="M38 34h18v22H38z" fill="#d97706" />
          <path d="M40 36h14v18H40z" fill="url(#cabGlass)" />
          {/* Counterweight */}
          <rect x="16" y="50" width="8" height="18" rx="2" fill="#334155" />

          {/* Articulated Boom & Arm */}
          <path d="M52 52L68 28L88 44" stroke="url(#catYellow)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M52 52L68 28L88 44" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* Hydraulic Cylinder */}
          <line x1="56" y1="56" x2="66" y2="36" stroke="url(#steelMetal)" strokeWidth="3" />
          {/* Bucket */}
          <path d="M88 44l8 12l-10 10l-6-8z" fill="#475569" stroke="#1e293b" strokeWidth="1.5" />
          {/* Teeth */}
          <path d="M96 56l4 4M92 64l4 4" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
        </g>
      );

    case 'motoniveladora':
      return (
        <g>
          {/* Motor Grader */}
          {/* Rear Chassis & Engine */}
          <rect x="12" y="48" width="28" height="18" rx="2" fill="url(#catYellow)" />
          {/* Rear Cab */}
          <path d="M26 30h16v24H26z" fill="#d97706" />
          <path d="M28 32h12v18H28z" fill="url(#cabGlass)" />
          {/* Long Gooseneck Frame to Front */}
          <path d="M40 48L78 58" stroke="url(#catYellow)" strokeWidth="6" strokeLinecap="round" fill="none" />
          {/* Center Grader Blade */}
          <path d="M42 66L64 74" stroke="url(#steelMetal)" strokeWidth="5" strokeLinecap="square" />
          <circle cx="53" cy="62" r="5" fill="#475569" />
          {/* Rear Tandem Wheels */}
          <circle cx="20" cy="72" r="14" fill="url(#darkTire)" />
          <circle cx="20" cy="72" r="7" fill="url(#catYellow)" />
          <circle cx="36" cy="72" r="14" fill="url(#darkTire)" />
          <circle cx="36" cy="72" r="7" fill="url(#catYellow)" />
          {/* Front Steer Wheels */}
          <circle cx="82" cy="70" r="14" fill="url(#darkTire)" />
          <circle cx="82" cy="70" r="7" fill="url(#catYellow)" />
        </g>
      );

    case 'pulverizadora':
      return (
        <g>
          {/* Self-Propelled High-Clearance Sprayer */}
          {/* High Clearance Tall Struts */}
          <line x1="30" y1="46" x2="26" y2="70" stroke="url(#steelMetal)" strokeWidth="5" />
          <line x1="70" y1="46" x2="74" y2="70" stroke="url(#steelMetal)" strokeWidth="5" />
          {/* Large Tall Skinny Wheels */}
          <circle cx="26" cy="70" r="16" fill="url(#darkTire)" />
          <circle cx="26" cy="70" r="10" fill="url(#jdYellow)" />
          <circle cx="74" cy="70" r="16" fill="url(#darkTire)" />
          <circle cx="74" cy="70" r="10" fill="url(#jdYellow)" />
          {/* Elevated Central Body & Tank */}
          <rect x="28" y="34" width="44" height="20" rx="6" fill="#f8fafc" stroke="#38bdf8" strokeWidth="2" />
          {/* Front Forward Cab */}
          <path d="M64 26h14v22H64z" fill="#0284c7" />
          <path d="M66 28h10v18H66z" fill="url(#cabGlass)" />
          {/* Spray Boom Wings Folded */}
          <path d="M12 28L28 44M8 36L28 48" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" />
          <path d="M88 28L72 44M92 36L72 48" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" />
          {/* Spray Mist Dots */}
          <circle cx="16" cy="48" r="2" fill="#38bdf8" opacity="0.8" />
          <circle cx="22" cy="54" r="2" fill="#38bdf8" opacity="0.8" />
          <circle cx="82" cy="54" r="2" fill="#38bdf8" opacity="0.8" />
        </g>
      );

    case 'otros-equipos':
      return (
        <g>
          {/* Multi-Purpose Heavy Equipment */}
          <rect x="22" y="36" width="56" height="30" rx="6" fill="url(#steelMetal)" stroke="#334155" strokeWidth="2" />
          <circle cx="34" cy="72" r="14" fill="url(#darkTire)" />
          <circle cx="34" cy="72" r="7" fill="url(#catYellow)" />
          <circle cx="66" cy="72" r="14" fill="url(#darkTire)" />
          <circle cx="66" cy="72" r="7" fill="url(#catYellow)" />
          {/* Radiator & Motor Details */}
          <rect x="30" y="42" width="22" height="16" rx="2" fill="#1e293b" />
          <line x1="34" y1="46" x2="48" y2="46" stroke="#fbbf24" strokeWidth="2" />
          <line x1="34" y1="52" x2="48" y2="52" stroke="#fbbf24" strokeWidth="2" />
          <path d="M64 28v12h6V28z" fill="#64748b" />
        </g>
      );

    // ==========================================
    // 2. IMPLEMENTOS AGRÍCOLAS
    // ==========================================
    case 'sembradora':
      return (
        <g>
          {/* Planter / Seeder */}
          {/* Main Frame Bar */}
          <rect x="14" y="44" width="72" height="8" rx="2" fill="url(#caseRed)" stroke="#991b1b" strokeWidth="1.5" />
          {/* Hitch Tongue */}
          <path d="M50 44L78 22" stroke="url(#caseRed)" strokeWidth="4" strokeLinecap="round" />
          <circle cx="80" cy="21" r="3.5" fill="#facc15" />
          {/* Multiple Seed Hoppers */}
          <rect x="20" y="24" width="12" height="20" rx="3" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
          <rect x="36" y="24" width="12" height="20" rx="3" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
          <rect x="52" y="24" width="12" height="20" rx="3" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
          <rect x="68" y="24" width="12" height="20" rx="3" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
          {/* Yellow Hopper Lids */}
          <rect x="19" y="22" width="14" height="4" rx="1" fill="url(#jdYellow)" />
          <rect x="35" y="22" width="14" height="4" rx="1" fill="url(#jdYellow)" />
          <rect x="51" y="22" width="14" height="4" rx="1" fill="url(#jdYellow)" />
          <rect x="67" y="22" width="14" height="4" rx="1" fill="url(#jdYellow)" />
          {/* Double Disc Openers underneath */}
          <ellipse cx="26" cy="66" rx="5" ry="12" fill="url(#steelMetal)" stroke="#334155" />
          <ellipse cx="42" cy="66" rx="5" ry="12" fill="url(#steelMetal)" stroke="#334155" />
          <ellipse cx="58" cy="66" rx="5" ry="12" fill="url(#steelMetal)" stroke="#334155" />
          <ellipse cx="74" cy="66" rx="5" ry="12" fill="url(#steelMetal)" stroke="#334155" />
          {/* Press / Gauge Wheels */}
          <circle cx="29" cy="74" r="6" fill="url(#darkTire)" />
          <circle cx="45" cy="74" r="6" fill="url(#darkTire)" />
          <circle cx="61" cy="74" r="6" fill="url(#darkTire)" />
          <circle cx="77" cy="74" r="6" fill="url(#darkTire)" />
        </g>
      );

    case 'romplow':
      return (
        <g>
          {/* Heavy Disc Plow (Romplow) */}
          {/* Heavy Angled Beam Frame */}
          <path d="M16 34L82 52" stroke="url(#caseRed)" strokeWidth="8" strokeLinecap="round" />
          <path d="M80 50L88 28" stroke="url(#caseRed)" strokeWidth="5" strokeLinecap="round" />
          <circle cx="89" cy="26" r="3.5" fill="#facc15" />
          {/* Heavy Notched Discs */}
          <circle cx="24" cy="64" r="14" fill="url(#steelMetal)" stroke="#1e293b" strokeWidth="2" />
          <circle cx="24" cy="64" r="4" fill="#1e293b" />
          <circle cx="42" cy="67" r="14" fill="url(#steelMetal)" stroke="#1e293b" strokeWidth="2" />
          <circle cx="42" cy="67" r="4" fill="#1e293b" />
          <circle cx="60" cy="70" r="14" fill="url(#steelMetal)" stroke="#1e293b" strokeWidth="2" />
          <circle cx="60" cy="70" r="4" fill="#1e293b" />
          {/* Scrapers and Depth Wheel */}
          <circle cx="76" cy="62" r="11" fill="url(#darkTire)" />
          <circle cx="76" cy="62" r="5" fill="#cbd5e1" />
        </g>
      );

    case 'ripper':
      return (
        <g>
          {/* Subsoiler / Ripper */}
          {/* Heavy Toolbar Frame */}
          <rect x="18" y="28" width="64" height="10" rx="3" fill="url(#nhBlue)" stroke="#0369a1" strokeWidth="1.5" />
          {/* 3-Point Hitch Mast */}
          <path d="M50 16L36 28M50 16L64 28" stroke="url(#nhBlue)" strokeWidth="4" strokeLinecap="round" />
          <circle cx="50" cy="15" r="3.5" fill="#facc15" />
          {/* Deep Curved Shanks with Chisel Points */}
          <path d="M28 38v16c0 10 5 18 12 22l4-2" stroke="url(#steelMetal)" strokeWidth="6" strokeLinecap="round" fill="none" />
          <polygon points="41,74 48,78 43,82" fill="url(#catYellow)" stroke="#b45309" strokeWidth="1" />

          <path d="M50 38v16c0 10 5 18 12 22l4-2" stroke="url(#steelMetal)" strokeWidth="6" strokeLinecap="round" fill="none" />
          <polygon points="63,74 70,78 65,82" fill="url(#catYellow)" stroke="#b45309" strokeWidth="1" />

          <path d="M72 38v16c0 10 5 18 12 22l4-2" stroke="url(#steelMetal)" strokeWidth="6" strokeLinecap="round" fill="none" />
          <polygon points="85,74 92,78 87,82" fill="url(#catYellow)" stroke="#b45309" strokeWidth="1" />
        </g>
      );

    case 'pala-niveladora':
      return (
        <g>
          {/* Land Leveling Scraper Blade */}
          {/* Main Drawbar Tongue */}
          <path d="M86 32L46 44" stroke="url(#catYellow)" strokeWidth="6" strokeLinecap="round" />
          <circle cx="88" cy="31" r="4" fill="#facc15" />
          {/* Hydraulic Cylinder */}
          <rect x="52" y="30" width="16" height="6" rx="2" fill="url(#steelMetal)" />
          <line x1="68" y1="33" x2="76" y2="33" stroke="#cbd5e1" strokeWidth="2.5" />
          {/* Wide Curved Moldboard Blade */}
          <path d="M22 42c8 12 10 24 8 36h8c2-12 0-24-8-36z" fill="url(#catYellow)" stroke="#b45309" strokeWidth="1.5" />
          {/* Hardened Cutting Edge */}
          <path d="M20 74l18 4" stroke="#0f172a" strokeWidth="3" strokeLinecap="square" />
          {/* Rear Wheels */}
          <circle cx="48" cy="74" r="10" fill="url(#darkTire)" />
          <circle cx="48" cy="74" r="5" fill="#facc15" />
        </g>
      );

    case 'rastra':
      return (
        <g>
          {/* Tandem Disc Harrow */}
          {/* Central Frame */}
          <rect x="20" y="38" width="60" height="8" rx="2" fill="url(#jdGreen)" stroke="#166534" strokeWidth="1.5" />
          {/* Tongue Hitch */}
          <path d="M50 38L78 18" stroke="url(#jdGreen)" strokeWidth="4" strokeLinecap="round" />
          <circle cx="80" cy="17" r="3.5" fill="#facc15" />
          {/* Front Disc Gang */}
          <ellipse cx="26" cy="56" rx="4" ry="14" fill="url(#steelMetal)" stroke="#1e293b" />
          <ellipse cx="38" cy="56" rx="4" ry="14" fill="url(#steelMetal)" stroke="#1e293b" />
          <ellipse cx="50" cy="56" rx="4" ry="14" fill="url(#steelMetal)" stroke="#1e293b" />
          <ellipse cx="62" cy="56" rx="4" ry="14" fill="url(#steelMetal)" stroke="#1e293b" />
          <ellipse cx="74" cy="56" rx="4" ry="14" fill="url(#steelMetal)" stroke="#1e293b" />
          {/* Central Gang Shaft */}
          <line x1="22" y1="56" x2="78" y2="56" stroke="#475569" strokeWidth="2" />
          {/* Transport Tires */}
          <circle cx="50" cy="68" r="9" fill="url(#darkTire)" />
          <circle cx="50" cy="68" r="4" fill="#cbd5e1" />
        </g>
      );

    case 'trailla':
      return (
        <g>
          {/* Earthmoving Scraper (Traílla) */}
          {/* Drawbar / Gooseneck */}
          <path d="M86 36L64 42L52 50" stroke="url(#catYellow)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="88" cy="35" r="4" fill="#facc15" />
          {/* Bowl Container */}
          <path d="M22 46h32l-4 22H18z" fill="url(#catYellow)" stroke="#b45309" strokeWidth="1.5" />
          <path d="M24 48h26l-3 18H20z" fill="#fef3c7" opacity="0.6" />
          {/* Hydraulic Push Cylinder */}
          <line x1="30" y1="40" x2="48" y2="40" stroke="url(#steelMetal)" strokeWidth="3" />
          {/* Oversized Heavy Balloon Tire */}
          <circle cx="28" cy="70" r="16" fill="url(#darkTire)" />
          <circle cx="28" cy="70" r="8" fill="url(#catYellow)" />
        </g>
      );

    case 'cortadora-sorgo':
      return (
        <g>
          {/* Forage Cutter / Sorghum Chopper */}
          {/* 3-Point Mast Frame */}
          <path d="M28 32h44v14H28z" fill="url(#caseRed)" stroke="#991b1b" strokeWidth="1.5" />
          <path d="M50 16L36 32M50 16L64 32" stroke="url(#caseRed)" strokeWidth="4" />
          <circle cx="50" cy="15" r="3.5" fill="#facc15" />
          {/* Rotary Cutter Drum Heads */}
          <circle cx="36" cy="62" r="16" fill="url(#steelMetal)" stroke="#1e293b" strokeWidth="2" />
          <circle cx="64" cy="62" r="16" fill="url(#steelMetal)" stroke="#1e293b" strokeWidth="2" />
          {/* Cutting Teeth / Knives */}
          <path d="M36 46l4 8M20 62l8 4M36 78l-4-8M52 62l-8-4" stroke="#f87171" strokeWidth="2" />
          <path d="M64 46l4 8M48 62l8 4M64 78l-4-8M80 62l-8-4" stroke="#f87171" strokeWidth="2" />
          {/* Crop Gathering Crop Guides */}
          <polygon points="16,50 24,76 14,72" fill="url(#jdYellow)" />
          <polygon points="84,50 76,76 86,72" fill="url(#jdYellow)" />
        </g>
      );

    case 'rolo':
      return (
        <g>
          {/* Land Roller / Stalk Chopper (Rolo) */}
          {/* Robust Frame */}
          <rect x="18" y="32" width="64" height="12" rx="2" fill="url(#caseRed)" stroke="#991b1b" strokeWidth="1.5" />
          <path d="M50 32L78 18" stroke="url(#caseRed)" strokeWidth="4" />
          <circle cx="80" cy="17" r="3.5" fill="#facc15" />
          {/* Large Steel Cylinder Drum */}
          <rect x="22" y="46" width="56" height="28" rx="4" fill="url(#steelMetal)" stroke="#334155" strokeWidth="1.5" />
          {/* Helical Cutting Blades across drum */}
          <line x1="24" y1="52" x2="76" y2="52" stroke="#e2e8f0" strokeWidth="2.5" />
          <line x1="24" y1="60" x2="76" y2="60" stroke="#0f172a" strokeWidth="2.5" />
          <line x1="24" y1="68" x2="76" y2="68" stroke="#e2e8f0" strokeWidth="2.5" />
          {/* Drum Axle Hubs */}
          <circle cx="22" cy="60" r="5" fill="#0f172a" />
          <circle cx="78" cy="60" r="5" fill="#0f172a" />
        </g>
      );

    case 'fumigadora':
      return (
        <g>
          {/* Trailed Sprayer */}
          {/* Chemical Tank on Trailer */}
          <rect x="26" y="32" width="38" height="26" rx="8" fill="#f8fafc" stroke="#38bdf8" strokeWidth="2" />
          <path d="M38 28h14v4H38z" fill="#0284c7" />
          {/* Trailer Wheels */}
          <circle cx="45" cy="70" r="14" fill="url(#darkTire)" />
          <circle cx="45" cy="70" r="7" fill="url(#steelMetal)" />
          {/* Drawbar Tongue */}
          <path d="M54 52L82 36" stroke="url(#nhBlue)" strokeWidth="4" strokeLinecap="round" />
          <circle cx="84" cy="35" r="3.5" fill="#facc15" />
          {/* Rear Spray Bar & Booms */}
          <line x1="10" y1="50" x2="34" y2="50" stroke="#16a34a" strokeWidth="3" />
          {/* Nozzles & Spray Droplets */}
          <circle cx="12" cy="53" r="1.5" fill="#38bdf8" />
          <circle cx="18" cy="53" r="1.5" fill="#38bdf8" />
          <circle cx="24" cy="53" r="1.5" fill="#38bdf8" />
          <path d="M12 55l-3 6M18 55l-3 6M24 55l-3 6" stroke="#38bdf8" strokeWidth="1" strokeDasharray="1 1" />
        </g>
      );

    case 'cultivador':
      return (
        <g>
          {/* Field Cultivator */}
          <rect x="18" y="34" width="64" height="8" rx="2" fill="url(#jdGreen)" stroke="#166534" strokeWidth="1.5" />
          <path d="M50 18L36 34M50 18L64 34" stroke="url(#jdGreen)" strokeWidth="4" />
          {/* S-tines */}
          <path d="M26 42c0 8-6 12-6 18c0 6 6 8 10 10" stroke="url(#steelMetal)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <polygon points="30,68 36,74 28,76" fill="#facc15" />

          <path d="M44 42c0 8-6 12-6 18c0 6 6 8 10 10" stroke="url(#steelMetal)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <polygon points="48,68 54,74 46,76" fill="#facc15" />

          <path d="M62 42c0 8-6 12-6 18c0 6 6 8 10 10" stroke="url(#steelMetal)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <polygon points="66,68 72,74 64,76" fill="#facc15" />

          <path d="M80 42c0 8-6 12-6 18c0 6 6 8 10 10" stroke="url(#steelMetal)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <polygon points="84,68 90,74 82,76" fill="#facc15" />
        </g>
      );

    case 'otros-implementos':
      return (
        <g>
          {/* General Implement Hitch & Frame */}
          <polygon points="50,18 24,70 76,70" fill="none" stroke="url(#caseRed)" strokeWidth="6" strokeLinejoin="round" />
          <circle cx="50" cy="18" r="4" fill="#facc15" />
          <circle cx="24" cy="70" r="4" fill="#facc15" />
          <circle cx="76" cy="70" r="4" fill="#facc15" />
          <rect x="36" y="52" width="28" height="6" fill="url(#steelMetal)" />
        </g>
      );

    // ==========================================
    // 3. GASTOS Y PRODUCTOS
    // ==========================================
    case 'diesel':
      return (
        <g>
          {/* Diesel Fuel Drum & Dispenser */}
          <rect x="22" y="24" width="38" height="56" rx="6" fill="url(#dieselAmber)" stroke="#78350f" strokeWidth="2" />
          {/* Ribs on Drum */}
          <line x1="22" y1="42" x2="60" y2="42" stroke="#78350f" strokeWidth="2.5" />
          <line x1="22" y1="60" x2="60" y2="60" stroke="#78350f" strokeWidth="2.5" />
          {/* Bung Cap */}
          <circle cx="32" cy="24" r="3.5" fill="url(#steelMetal)" />
          {/* DIESEL Label */}
          <rect x="28" y="47" width="26" height="9" rx="2" fill="#ffffff" />
          <text x="41" y="54" fontSize="6" fontWeight="bold" fill="#b45309" textAnchor="middle" fontFamily="sans-serif">
            DIESEL
          </text>
          {/* Fuel Dispenser Nozzle on right */}
          <path d="M68 28c4 0 8 4 8 8v24l6-6" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" fill="none" />
          <polygon points="76,60 82,54 84,60" fill="#dc2626" />
          {/* Yellow Hazard Symbol */}
          <polygon points="41,30 36,38 46,38" fill="#facc15" stroke="#78350f" strokeWidth="1" />
        </g>
      );

    case 'gasolina':
      return (
        <g>
          {/* Red Fuel Jerrycan */}
          <path d="M24 30h40c3 0 6 3 6 6v44H20V36c0-3 3-6 4-6z" fill="url(#caseRed)" stroke="#991b1b" strokeWidth="2" />
          {/* Handle Top */}
          <path d="M28 30v-10h32v10" stroke="url(#caseRed)" strokeWidth="4" strokeLinecap="round" fill="none" />
          {/* Pouring Spout */}
          <path d="M60 20l8-8h6v8l-8 8" fill="url(#steelMetal)" stroke="#475569" strokeWidth="1" />
          {/* Stiffening X Emboss */}
          <line x1="28" y1="40" x2="60" y2="70" stroke="#991b1b" strokeWidth="2.5" />
          <line x1="60" y1="40" x2="28" y2="70" stroke="#991b1b" strokeWidth="2.5" />
          {/* Flame Icon */}
          <circle cx="44" cy="55" r="9" fill="#fef08a" />
          <path d="M44 48c2 3 5 5 5 8c0 3-2 5-5 5s-5-2-5-5c0-3 3-5 5-8z" fill="#f97316" />
        </g>
      );

    case 'aceite':
      return (
        <g>
          {/* Motor Oil Bottle */}
          <path d="M26 34h36l8 12v36H20V46l6-12z" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
          {/* Handle Hole */}
          <path d="M28 46h10v20H28z" fill="#ffffff" opacity="0.1" rx="3" />
          {/* Bottle Neck & Gold Cap */}
          <rect x="52" y="24" width="12" height="10" rx="2" fill="url(#jdYellow)" stroke="#ca8a04" strokeWidth="1" />
          {/* Oil Level Indicator Stripe */}
          <line x1="64" y1="48" x2="64" y2="76" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
          {/* Droplet Badge */}
          <circle cx="44" cy="58" r="8" fill="url(#jdYellow)" />
          <path d="M44 52c2 3 4 5 4 7c0 2-2 4-4 4s-4-2-4-4c0-2 2-4 4-7z" fill="#d97706" />
          <text x="44" y="76" fontSize="5" fontWeight="bold" fill="#f8fafc" textAnchor="middle" fontFamily="sans-serif">
            15W-40
          </text>
        </g>
      );

    case 'filtro':
      return (
        <g>
          {/* Heavy Duty Spin-on Filter */}
          <rect x="24" y="26" width="52" height="56" rx="8" fill="url(#nhBlue)" stroke="#0369a1" strokeWidth="2" />
          {/* Top Metallic Threaded Rim & Gasket */}
          <rect x="20" y="22" width="60" height="8" rx="3" fill="url(#steelMetal)" stroke="#334155" strokeWidth="1.5" />
          <circle cx="50" cy="26" r="4" fill="#0f172a" />
          {/* Filter Fluting Ribs */}
          <line x1="34" y1="38" x2="34" y2="72" stroke="#0284c7" strokeWidth="2.5" />
          <line x1="44" y1="38" x2="44" y2="72" stroke="#0284c7" strokeWidth="2.5" />
          <line x1="56" y1="38" x2="56" y2="72" stroke="#0284c7" strokeWidth="2.5" />
          <line x1="66" y1="38" x2="66" y2="72" stroke="#0284c7" strokeWidth="2.5" />
          {/* Filter Symbol */}
          <circle cx="50" cy="54" r="8" fill="#ffffff" />
          <path d="M46 51l8 6M46 57l8-6" stroke="#0369a1" strokeWidth="2" strokeLinecap="round" />
        </g>
      );

    case 'neumaticos':
      return (
        <g>
          {/* Heavy Agricultural Tractor Tire */}
          {/* Outer Black Tire Circle */}
          <circle cx="50" cy="50" r="38" fill="url(#darkTire)" stroke="#0f172a" strokeWidth="2.5" />
          {/* Yellow Wheel Rim */}
          <circle cx="50" cy="50" r="22" fill="url(#jdYellow)" stroke="#ca8a04" strokeWidth="2.5" />
          {/* Center Hub & 8 Lug Bolts */}
          <circle cx="50" cy="50" r="8" fill="#1e293b" />
          <circle cx="50" cy="38" r="1.8" fill="#f8fafc" />
          <circle cx="58" cy="42" r="1.8" fill="#f8fafc" />
          <circle cx="62" cy="50" r="1.8" fill="#f8fafc" />
          <circle cx="58" cy="58" r="1.8" fill="#f8fafc" />
          <circle cx="50" cy="62" r="1.8" fill="#f8fafc" />
          <circle cx="42" cy="58" r="1.8" fill="#f8fafc" />
          <circle cx="38" cy="50" r="1.8" fill="#f8fafc" />
          <circle cx="42" cy="42" r="1.8" fill="#f8fafc" />
          {/* Agricultural Chevron V Treads */}
          <path d="M44 16l6 6l-6 6M56 16l-6 6l6 6" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M78 44l-6 6l-6-6M78 56l-6-6l-6 6" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M44 84l6-6l-6-6M56 84l-6-6l6-6" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M22 44l6 6l6-6M22 56l6-6l6 6" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </g>
      );

    case 'bateria':
      return (
        <g>
          {/* Heavy Duty 12V/24V Battery */}
          <rect x="18" y="32" width="64" height="46" rx="4" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
          {/* Terminal Posts */}
          <rect x="28" y="24" width="10" height="8" rx="2" fill="#ef4444" stroke="#991b1b" />
          <text x="33" y="30" fontSize="7" fontWeight="bold" fill="#ffffff" textAnchor="middle">+</text>

          <rect x="62" y="24" width="10" height="8" rx="2" fill="#3b82f6" stroke="#1d4ed8" />
          <text x="67" y="30" fontSize="7" fontWeight="bold" fill="#ffffff" textAnchor="middle">-</text>

          {/* Carrying Handle */}
          <path d="M30 36c0-10 40-10 40 0" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" fill="none" />

          {/* Battery Cell Caps */}
          <rect x="24" y="44" width="52" height="6" rx="2" fill="#334155" />
          {/* High Power Lightning Bolt Symbol */}
          <polygon points="52,54 44,64 50,64 46,74 58,62 51,62" fill="#facc15" stroke="#ca8a04" strokeWidth="1" />
        </g>
      );

    case 'repuestos':
      return (
        <g>
          {/* Gear Cog & Wrench */}
          {/* Gear Cog */}
          <circle cx="44" cy="48" r="22" fill="url(#steelMetal)" stroke="#334155" strokeWidth="2" />
          <circle cx="44" cy="48" r="10" fill="#ffffff" stroke="#334155" strokeWidth="2" />
          {/* Gear Teeth */}
          <rect x="40" y="22" width="8" height="6" rx="1" fill="#64748b" />
          <rect x="40" y="68" width="8" height="6" rx="1" fill="#64748b" />
          <rect x="18" y="44" width="6" height="8" rx="1" fill="#64748b" />
          <rect x="64" y="44" width="6" height="8" rx="1" fill="#64748b" />
          {/* Diagonal Crossed Chrome Wrench */}
          <path d="M76 22l-32 40l-8-6l32-40c2-3 6-3 8 0z" fill="url(#jdYellow)" stroke="#b45309" strokeWidth="1.5" />
          <circle cx="78" cy="24" r="5" fill="#fef08a" stroke="#ca8a04" strokeWidth="1" />
        </g>
      );

    case 'mantenimiento':
      return (
        <g>
          {/* Toolbox & Tools */}
          <rect x="18" y="36" width="64" height="42" rx="4" fill="url(#caseRed)" stroke="#991b1b" strokeWidth="2" />
          {/* Toolbox Lid and Handle */}
          <path d="M38 36V26h24v10" stroke="#334155" strokeWidth="4" strokeLinecap="round" fill="none" />
          <rect x="16" y="36" width="68" height="8" rx="2" fill="#b91c1c" />
          {/* Chrome Latches */}
          <rect x="32" y="42" width="6" height="8" rx="1" fill="url(#steelMetal)" />
          <rect x="62" y="42" width="6" height="8" rx="1" fill="url(#steelMetal)" />
          {/* Wrench graphic on front */}
          <path d="M38 60h24M56 56l6 4l-6 4" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );

    case 'grasa':
      return (
        <g>
          {/* High-Pressure Grease Gun */}
          {/* Main Grease Cartridge Tube */}
          <rect x="30" y="28" width="40" height="22" rx="3" transform="rotate(-30 50 39)" fill="url(#steelMetal)" stroke="#334155" strokeWidth="2" />
          {/* Plunger Handle Back */}
          <path d="M22 56L12 62" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <circle cx="10" cy="63" r="4" fill="#0f172a" />
          {/* Lever Handle */}
          <path d="M68 28L78 14" stroke="#dc2626" strokeWidth="4" strokeLinecap="round" />
          {/* Flexible Output Hose with Coupler Tip */}
          <path d="M72 34c8 4 14 14 12 24l-4 6" stroke="#1e293b" strokeWidth="3" fill="none" strokeLinecap="round" />
          <rect x="76" y="62" width="6" height="10" rx="1" fill="url(#jdYellow)" />
          {/* Grease Droplet */}
          <circle cx="79" cy="76" r="3.5" fill="#f59e0b" />
        </g>
      );

    case 'semillas':
      return (
        <g>
          {/* Burlap Seed Bag with Sprout */}
          <path d="M26 34c4-6 12-8 24-8s20 2 24 8l-6 46H32z" fill="url(#burlapGrad)" stroke="#78716c" strokeWidth="2" />
          {/* Tied Neck */}
          <ellipse cx="50" cy="34" rx="20" ry="5" fill="#a8a29e" stroke="#57534e" strokeWidth="1.5" />
          <path d="M42 34l-4-6M58 34l4-6" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
          {/* Front Soya/Grain Seed Leaf Emblem */}
          <circle cx="50" cy="56" r="14" fill="#fef08a" stroke="#eab308" strokeWidth="1.5" />
          <path d="M50 48c4 3 6 8 4 12c-4 0-8-4-8-8c0-2 2-4 4-4z" fill="#22c55e" />
          <path d="M50 56c-4 3-6 8-4 12c4 0 8-4 8-8c0-2-2-4-4-4z" fill="#16a34a" />
        </g>
      );

    case 'fertilizante':
      return (
        <g>
          {/* Fertilizer Bag (NPK) */}
          <rect x="22" y="24" width="56" height="58" rx="4" fill="#ffffff" stroke="#16a34a" strokeWidth="2" />
          {/* Green Top and Bottom Trim */}
          <rect x="22" y="24" width="56" height="12" fill="#16a34a" />
          <rect x="22" y="72" width="56" height="10" fill="#16a34a" />
          {/* Sprout Logo */}
          <circle cx="50" cy="50" r="12" fill="#dcfce7" />
          <path d="M50 44v12M50 46c3-3 8-3 9 1c-3 1-7 0-9-1zM50 50c-3-3-8-3-9 1c3 1 7 0 9-1z" stroke="#15803d" strokeWidth="2" strokeLinecap="round" fill="#22c55e" />
          <text x="50" y="33" fontSize="6" fontWeight="bold" fill="#ffffff" textAnchor="middle" fontFamily="sans-serif">
            UREA / NPK
          </text>
        </g>
      );

    case 'herbicida':
      return (
        <g>
          {/* Chemical Herbicide Jug */}
          <path d="M26 34h36l8 12v36H20V46l6-12z" fill="#ffffff" stroke="#ea580c" strokeWidth="2" />
          <rect x="34" y="24" width="14" height="10" rx="2" fill="#ea580c" stroke="#c2410c" strokeWidth="1" />
          {/* Handle */}
          <path d="M26 46h10v20H26z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" rx="2" />
          {/* Warning Orange Label */}
          <rect x="40" y="46" width="26" height="26" rx="3" fill="#ffedd5" stroke="#fb923c" strokeWidth="1" />
          {/* Crossed Weed Symbol */}
          <path d="M53 52v14M49 56l8 6M57 56l-8 6" stroke="#c2410c" strokeWidth="2" strokeLinecap="round" />
          <circle cx="53" cy="59" r="8" fill="none" stroke="#ef4444" strokeWidth="1.5" />
        </g>
      );

    case 'insecticida':
      return (
        <g>
          {/* Insecticide Jug with Shield */}
          <path d="M26 34h36l8 12v36H20V46l6-12z" fill="#ffffff" stroke="#7c3aed" strokeWidth="2" />
          <rect x="34" y="24" width="14" height="10" rx="2" fill="#7c3aed" stroke="#6d28d9" strokeWidth="1" />
          {/* Handle */}
          <path d="M26 46h10v20H26z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" rx="2" />
          {/* Purple Shield Target */}
          <path d="M53 48l10 4v8c0 6-5 10-10 12c-5-2-10-6-10-12v-8z" fill="#ede9fe" stroke="#7c3aed" strokeWidth="1.5" />
          {/* Pest bug silhouette */}
          <ellipse cx="53" cy="58" rx="3.5" ry="5" fill="#6d28d9" />
          <line x1="47" y1="56" x2="59" y2="56" stroke="#6d28d9" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="47" y1="60" x2="59" y2="60" stroke="#6d28d9" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );

    case 'otros-gastos':
    default:
      return (
        <g>
          {/* Invoice / Ledger with Coin */}
          <rect x="22" y="22" width="46" height="58" rx="4" fill="#ffffff" stroke="#64748b" strokeWidth="2" />
          <line x1="30" y1="32" x2="58" y2="32" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
          <line x1="30" y1="40" x2="54" y2="40" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
          <line x1="30" y1="48" x2="50" y2="48" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
          {/* Green Check / Total */}
          <rect x="30" y="58" width="22" height="6" rx="2" fill="#dcfce7" />
          <path d="M34 61l3 3l6-6" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* Gold Coin at Corner */}
          <circle cx="68" cy="66" r="14" fill="url(#jdYellow)" stroke="#ca8a04" strokeWidth="2" />
          <circle cx="68" cy="66" r="9" fill="#fef08a" stroke="#ca8a04" strokeWidth="1" />
          <text x="68" y="70" fontSize="11" fontWeight="bold" fill="#854d0e" textAnchor="middle" fontFamily="sans-serif">
            $
          </text>
        </g>
      );
  }
}
