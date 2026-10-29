import React from 'react';
import { getIconDefinition, IconCategory } from '../services/iconCatalog';

interface VisualIconProps {
  iconId?: string;
  name?: string;
  nameHint?: string;
  category?: IconCategory;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  showBadge?: boolean;
}

export const VisualIcon: React.FC<VisualIconProps> = ({
  iconId,
  name,
  nameHint,
  category,
  size = 'md',
  className = '',
}) => {
  const definition = getIconDefinition(iconId || name || nameHint, category);
  const id = definition.id;

  let pxSize = 38;
  if (typeof size === 'number') {
    pxSize = size;
  } else {
    switch (size) {
      case 'xs':
        pxSize = 22;
        break;
      case 'sm':
        pxSize = 28;
        break;
      case 'md':
        pxSize = 38;
        break;
      case 'lg':
        pxSize = 52;
        break;
      case 'xl':
        pxSize = 72;
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
          {/* Realistic 3D Volumetric Lighting & Shadows */}
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3.5" stdDeviation="2.5" floodColor="#0f172a" floodOpacity="0.25" />
          </filter>

          {/* John Deere Green */}
          <linearGradient id="jdGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="35%" stopColor="#16a34a" />
            <stop offset="85%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#14532d" />
          </linearGradient>

          {/* John Deere Yellow */}
          <linearGradient id="jdYellow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="40%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#ca8a04" />
          </linearGradient>

          {/* New Holland Blue */}
          <linearGradient id="nhBlue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="30%" stopColor="#0284c7" />
            <stop offset="85%" stopColor="#0369a1" />
            <stop offset="100%" stopColor="#075985" />
          </linearGradient>

          {/* Case IH Red */}
          <linearGradient id="caseRed" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fca5a5" />
            <stop offset="35%" stopColor="#dc2626" />
            <stop offset="85%" stopColor="#b91c1c" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </linearGradient>

          {/* Caterpillar Gold / CAT Yellow */}
          <linearGradient id="catYellow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="35%" stopColor="#eab308" />
            <stop offset="85%" stopColor="#ca8a04" />
            <stop offset="100%" stopColor="#854d0e" />
          </linearGradient>

          {/* Steel & Chrome Metallic */}
          <linearGradient id="steelMetal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="40%" stopColor="#cbd5e1" />
            <stop offset="80%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>

          {/* Deep Rubber Tire */}
          <linearGradient id="darkTire" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="40%" stopColor="#1e293b" />
            <stop offset="90%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>

          {/* Tinted Cabin Glass with Specular Glare */}
          <linearGradient id="cabGlass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f0f9ff" stopOpacity="0.95" />
            <stop offset="40%" stopColor="#38bdf8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.85" />
          </linearGradient>

          {/* Amber Translucent Fuel */}
          <linearGradient id="dieselAmber" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="35%" stopColor="#f59e0b" />
            <stop offset="85%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>

          {/* Burlap / Jute Grain Sack */}
          <linearGradient id="burlapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f5f5f4" />
            <stop offset="35%" stopColor="#e7e5e4" />
            <stop offset="75%" stopColor="#a8a29e" />
            <stop offset="100%" stopColor="#78716c" />
          </linearGradient>

          {/* Rich Golden Wheat */}
          <linearGradient id="wheatGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="30%" stopColor="#facc15" />
            <stop offset="70%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>

          {/* Soya Pod & Seed Gradients */}
          <linearGradient id="soyaPod" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#bbf7d0" />
            <stop offset="35%" stopColor="#4ade80" />
            <stop offset="75%" stopColor="#16a34a" />
            <stop offset="100%" stopColor="#14532d" />
          </linearGradient>
          <linearGradient id="soyaBean" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef9c3" />
            <stop offset="45%" stopColor="#fde047" />
            <stop offset="85%" stopColor="#ca8a04" />
            <stop offset="100%" stopColor="#854d0e" />
          </linearGradient>

          {/* Sorgo Red Bronze */}
          <linearGradient id="sorgoRed" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="35%" stopColor="#dc2626" />
            <stop offset="75%" stopColor="#991b1b" />
            <stop offset="100%" stopColor="#450a0a" />
          </linearGradient>

          {/* Corn Kernels */}
          <linearGradient id="cornKernel" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="40%" stopColor="#facc15" />
            <stop offset="80%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>

          {/* Sunflower Center Disc */}
          <radialGradient id="sunflowerDisc" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#78350f" />
            <stop offset="60%" stopColor="#451a03" />
            <stop offset="100%" stopColor="#1c0a00" />
          </radialGradient>

          {/* Ground Drop Shadow Oval */}
          <radialGradient id="groundShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0f172a" stopOpacity="0.32" />
            <stop offset="70%" stopColor="#0f172a" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>
        </defs>

        {renderSvgContent(id)}
      </svg>
    </div>
  );
};

function renderSvgContent(id: string): React.ReactNode {
  switch (id) {
    // ==========================================
    // 0. INGRESOS AGRÍCOLAS (Realistas, 3D, Fondo Transparente)
    // ==========================================
    case 'soya':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="87" rx="38" ry="5.5" fill="url(#groundShadow)" />
          {/* Leaf Accent */}
          <path d="M72 32c6-10 16-12 20-10c0 8-4 17-12 20c-5-2-7-6-8-10z" fill="url(#jdGreen)" stroke="#14532d" strokeWidth="1.2" />
          <path d="M72 32c4 2 9 6 13 8" stroke="#86efac" strokeWidth="1" fill="none" />
          {/* Stem */}
          <path d="M22 24c8 4 14 12 18 20" stroke="#15803d" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          {/* Main Soybean Pod Curved */}
          <path d="M22 28c16 8 44 14 62 44c-12 8-36 10-60-6c-6-16-4-28-2-38z" fill="url(#soyaPod)" stroke="#14532d" strokeWidth="2.2" />
          <path d="M28 36c14 6 36 12 50 34" stroke="#86efac" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.8" />
          {/* Pod Open Crevice revealing beans */}
          <path d="M30 40c12 6 32 12 44 28c-4 5-16 6-28 1c-10-6-14-18-16-29z" fill="#14532d" opacity="0.65" />
          {/* Three Plump Glossy Soybeans */}
          <circle cx="38" cy="46" r="8" fill="url(#soyaBean)" stroke="#a16207" strokeWidth="1.2" />
          <ellipse cx="36" cy="43.5" rx="3" ry="1.8" fill="#ffffff" opacity="0.75" />
          <path d="M36 47c1 1 3 1 4 0" stroke="#78350f" strokeWidth="0.8" strokeLinecap="round" fill="none" />
          <circle cx="52" cy="56" r="9" fill="url(#soyaBean)" stroke="#a16207" strokeWidth="1.2" />
          <ellipse cx="49.5" cy="53" rx="3.5" ry="2" fill="#ffffff" opacity="0.8" />
          <path d="M50 57c1.5 1 3.5 1 5 0" stroke="#78350f" strokeWidth="0.8" strokeLinecap="round" fill="none" />
          <circle cx="67" cy="67" r="8.5" fill="url(#soyaBean)" stroke="#a16207" strokeWidth="1.2" />
          <ellipse cx="64.5" cy="64" rx="3" ry="1.8" fill="#ffffff" opacity="0.75" />
          <path d="M65 68c1 1 3 1 4 0" stroke="#78350f" strokeWidth="0.8" strokeLinecap="round" fill="none" />
        </g>
      );

    case 'maiz':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="88" rx="34" ry="5.5" fill="url(#groundShadow)" />
          {/* Back Husk Leaf */}
          <path d="M28 78c-8-22-2-48 10-62c4 18 10 32 8 50z" fill="url(#soyaPod)" stroke="#15803d" strokeWidth="1.8" />
          {/* Corn Cob Cylinder Curved */}
          <path d="M34 26c4-12 16-16 26-10c6 18 10 38 6 58c-8 6-22 8-28 0c-4-16-4-32-4-48z" fill="#ca8a04" stroke="#854d0e" strokeWidth="2" />
          {/* Individual Golden Kernels Grid */}
          <g fill="url(#cornKernel)" stroke="#ca8a04" strokeWidth="0.8">
            <rect x="42" y="20" width="5.5" height="4.5" rx="1.5" />
            <rect x="48.5" y="21" width="5.5" height="4.5" rx="1.5" />
            <rect x="38" y="26" width="6" height="5" rx="1.5" />
            <rect x="45" y="27" width="6" height="5" rx="1.5" />
            <rect x="52" y="27" width="6" height="5" rx="1.5" />
            <rect x="36" y="33" width="6.5" height="5" rx="1.5" />
            <rect x="43.5" y="33.5" width="6.5" height="5" rx="1.5" />
            <rect x="51" y="34" width="6.5" height="5" rx="1.5" />
            <rect x="58" y="34" width="5.5" height="5" rx="1.5" />
            <rect x="36" y="40" width="6.5" height="5.5" rx="1.5" />
            <rect x="43.5" y="40.5" width="6.5" height="5.5" rx="1.5" />
            <rect x="51" y="41" width="6.5" height="5.5" rx="1.5" />
            <rect x="58.5" y="41" width="5.5" height="5.5" rx="1.5" />
            <rect x="37" y="47.5" width="6.5" height="5.5" rx="1.5" />
            <rect x="44.5" y="48" width="6.5" height="5.5" rx="1.5" />
            <rect x="52" y="48" width="6.5" height="5.5" rx="1.5" />
            <rect x="59" y="48" width="5" height="5.5" rx="1.5" />
            <rect x="38" y="55" width="6.5" height="5.5" rx="1.5" />
            <rect x="45.5" y="55.5" width="6.5" height="5.5" rx="1.5" />
            <rect x="53" y="55.5" width="6" height="5.5" rx="1.5" />
            <rect x="40" y="62" width="6" height="5" rx="1.5" />
            <rect x="47" y="62.5" width="6" height="5" rx="1.5" />
            <rect x="54" y="62.5" width="5.5" height="5" rx="1.5" />
          </g>
          {/* Specular Kernels Glare */}
          <ellipse cx="46" cy="35" rx="2" ry="1.2" fill="#ffffff" opacity="0.65" />
          <ellipse cx="53" cy="42" rx="2" ry="1.2" fill="#ffffff" opacity="0.65" />
          <ellipse cx="47" cy="50" rx="2" ry="1.2" fill="#ffffff" opacity="0.65" />
          {/* Silk Tuft */}
          <path d="M48 18c-3-6-4-10-2-14M52 17c2-5 6-8 8-11M49 16c0-6 4-9 6-12" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" fill="none" />
          {/* Foreground Husk Leaves Peel Open */}
          <path d="M26 82c2-18 10-36 22-48c-8 16-12 34-10 50z" fill="url(#jdGreen)" stroke="#14532d" strokeWidth="2" />
          <path d="M68 80c-2-18-10-34-20-46c8 14 12 30 10 48z" fill="url(#jdGreen)" stroke="#14532d" strokeWidth="2" />
          <path d="M42 82c4 4 12 4 16 0l-2 8h-12z" fill="#15803d" stroke="#14532d" strokeWidth="1.5" />
        </g>
      );

    case 'trigo':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="88" rx="32" ry="5" fill="url(#groundShadow)" />
          {/* Stems */}
          <path d="M40 86c2-28 6-44 10-64" stroke="#ca8a04" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M48 86c-2-24-10-38-16-56" stroke="#b45309" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M52 86c4-22 14-36 20-52" stroke="#b45309" strokeWidth="2.5" strokeLinecap="round" fill="none" />

          {/* Central Tall Wheat Ear */}
          <g transform="translate(0, -2)">
            <path d="M50 22L44 6M50 20L50 4M50 22L56 6M47 28L37 14M53 28L63 14M46 36L34 22M54 36L66 22M46 44L34 32M54 44L66 32" stroke="#eab308" strokeWidth="1.3" strokeLinecap="round" />
            <ellipse cx="46" cy="24" rx="4.5" ry="3.5" transform="rotate(-30 46 24)" fill="url(#wheatGold)" stroke="#b45309" strokeWidth="1" />
            <ellipse cx="54" cy="24" rx="4.5" ry="3.5" transform="rotate(30 54 24)" fill="url(#wheatGold)" stroke="#b45309" strokeWidth="1" />
            <ellipse cx="45" cy="31" rx="5" ry="3.8" transform="rotate(-30 45 31)" fill="url(#wheatGold)" stroke="#b45309" strokeWidth="1" />
            <ellipse cx="55" cy="31" rx="5" ry="3.8" transform="rotate(30 55 31)" fill="url(#wheatGold)" stroke="#b45309" strokeWidth="1" />
            <ellipse cx="45" cy="39" rx="5" ry="4" transform="rotate(-30 45 39)" fill="url(#wheatGold)" stroke="#b45309" strokeWidth="1" />
            <ellipse cx="55" cy="39" rx="5" ry="4" transform="rotate(30 55 39)" fill="url(#wheatGold)" stroke="#b45309" strokeWidth="1" />
            <ellipse cx="46" cy="47" rx="5" ry="3.8" transform="rotate(-30 46 47)" fill="url(#wheatGold)" stroke="#b45309" strokeWidth="1" />
            <ellipse cx="54" cy="47" rx="5" ry="3.8" transform="rotate(30 54 47)" fill="url(#wheatGold)" stroke="#b45309" strokeWidth="1" />
            <ellipse cx="50" cy="18" rx="3.5" ry="4.5" fill="url(#wheatGold)" stroke="#b45309" strokeWidth="1" />
            <circle cx="48" cy="28" r="1.2" fill="#ffffff" opacity="0.8" />
            <circle cx="52" cy="36" r="1.2" fill="#ffffff" opacity="0.8" />
          </g>

          {/* Left Wheat Ear */}
          <g transform="rotate(-18 32 30)">
            <path d="M32 26L24 12M32 24L32 10M32 26L40 12M29 34L19 22M35 34L45 22" stroke="#ca8a04" strokeWidth="1.1" strokeLinecap="round" />
            <ellipse cx="28" cy="28" rx="4" ry="3.2" transform="rotate(-30 28 28)" fill="url(#wheatGold)" stroke="#b45309" strokeWidth="0.9" />
            <ellipse cx="36" cy="28" rx="4" ry="3.2" transform="rotate(30 36 28)" fill="url(#wheatGold)" stroke="#b45309" strokeWidth="0.9" />
            <ellipse cx="28" cy="36" rx="4.2" ry="3.4" transform="rotate(-30 28 36)" fill="url(#wheatGold)" stroke="#b45309" strokeWidth="0.9" />
            <ellipse cx="36" cy="36" rx="4.2" ry="3.4" transform="rotate(30 36 36)" fill="url(#wheatGold)" stroke="#b45309" strokeWidth="0.9" />
            <ellipse cx="32" cy="22" rx="3" ry="4" fill="url(#wheatGold)" stroke="#b45309" strokeWidth="0.9" />
          </g>

          {/* Right Wheat Ear */}
          <g transform="rotate(18 68 34)">
            <path d="M68 30L60 16M68 28L68 14M68 30L76 16M65 38L55 26M71 38L81 26" stroke="#ca8a04" strokeWidth="1.1" strokeLinecap="round" />
            <ellipse cx="64" cy="32" rx="4" ry="3.2" transform="rotate(-30 64 32)" fill="url(#wheatGold)" stroke="#b45309" strokeWidth="0.9" />
            <ellipse cx="72" cy="32" rx="4" ry="3.2" transform="rotate(30 72 32)" fill="url(#wheatGold)" stroke="#b45309" strokeWidth="0.9" />
            <ellipse cx="64" cy="40" rx="4.2" ry="3.4" transform="rotate(-30 64 40)" fill="url(#wheatGold)" stroke="#b45309" strokeWidth="0.9" />
            <ellipse cx="72" cy="40" rx="4.2" ry="3.4" transform="rotate(30 72 40)" fill="url(#wheatGold)" stroke="#b45309" strokeWidth="0.9" />
            <ellipse cx="68" cy="26" rx="3" ry="4" fill="url(#wheatGold)" stroke="#b45309" strokeWidth="0.9" />
          </g>
        </g>
      );

    case 'sorgo':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="88" rx="34" ry="5" fill="url(#groundShadow)" />
          {/* Stalk & Leaf */}
          <path d="M48 86c0-26 4-46 2-68" stroke="#15803d" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <path d="M48 64c12 4 28 2 34-8c-10-2-24 0-34 4z" fill="url(#jdGreen)" stroke="#14532d" strokeWidth="1.5" />
          {/* Sorghum Panicle Base */}
          <path d="M38 28c4-14 16-18 24-8c10 12 12 32 4 48c-10 6-24 6-30-4c-6-12-4-24 2-36z" fill="#7f1d1d" />
          {/* Clusters of Seeds */}
          <g fill="url(#sorgoRed)" stroke="#7f1d1d" strokeWidth="0.8">
            <circle cx="48" cy="18" r="3.6" />
            <circle cx="53" cy="17" r="3.4" />
            <circle cx="50" cy="22" r="3.8" />
            <circle cx="43" cy="25" r="3.8" />
            <circle cx="48" cy="27" r="4.2" />
            <circle cx="54" cy="26" r="4" />
            <circle cx="59" cy="25" r="3.6" />
            <circle cx="39" cy="33" r="4" />
            <circle cx="45" cy="34" r="4.4" />
            <circle cx="51" cy="34" r="4.4" />
            <circle cx="57" cy="34" r="4.2" />
            <circle cx="63" cy="33" r="3.8" />
            <circle cx="37" cy="42" r="4.2" />
            <circle cx="43" cy="42" r="4.6" />
            <circle cx="49" cy="43" r="4.8" />
            <circle cx="56" cy="42" r="4.6" />
            <circle cx="62" cy="41" r="4" />
            <circle cx="68" cy="42" r="3.6" />
            <circle cx="36" cy="50" r="4" />
            <circle cx="42" cy="51" r="4.6" />
            <circle cx="49" cy="51" r="4.8" />
            <circle cx="56" cy="50" r="4.6" />
            <circle cx="62" cy="50" r="4.2" />
            <circle cx="39" cy="58" r="4.2" />
            <circle cx="46" cy="59" r="4.6" />
            <circle cx="53" cy="59" r="4.6" />
            <circle cx="59" cy="58" r="4" />
            <circle cx="44" cy="66" r="3.8" />
            <circle cx="51" cy="66" r="4" />
          </g>
          <circle cx="47" cy="26" r="1.1" fill="#ffffff" opacity="0.65" />
          <circle cx="50" cy="41" r="1.3" fill="#ffffff" opacity="0.7" />
          <circle cx="44" cy="50" r="1.2" fill="#ffffff" opacity="0.65" />
          <circle cx="55" cy="49" r="1.2" fill="#ffffff" opacity="0.65" />
        </g>
      );

    case 'girasol':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="88" rx="36" ry="5.5" fill="url(#groundShadow)" />
          {/* Stem & Leaf */}
          <path d="M46 86c0-18 6-32 8-46" stroke="#15803d" strokeWidth="5.5" strokeLinecap="round" fill="none" />
          <path d="M52 68c14 2 26-4 30-14c-12 0-22 6-30 14z" fill="url(#jdGreen)" stroke="#14532d" strokeWidth="1.8" />
          <path d="M48 76c-12 2-22-4-26-12c10 0 18 6 26 12z" fill="url(#jdGreen)" stroke="#14532d" strokeWidth="1.8" />

          {/* Sunflower Golden Petals */}
          <g fill="url(#cornKernel)" stroke="#ca8a04" strokeWidth="1.2">
            <path d="M50 42l-4-28c4-2 8-2 12 0l-4 28z" />
            <path d="M50 42l16-24c4 3 6 7 6 12l-22 12z" />
            <path d="M50 42l26-10c3 4 3 9 0 14l-26-4z" />
            <path d="M50 42l28 6c1 5-1 9-5 12l-23-18z" />
            <path d="M50 42l20 20c-3 4-7 5-12 4l-8-24z" />
            <path d="M50 42l6 28c-4 2-8 2-12 0l6-28z" />
            <path d="M50 42l-16 24c-4-3-6-7-6-12l22-12z" />
            <path d="M50 42l-26 10c-3-4-3-9 0-14l26 4z" />
            <path d="M50 42l-28-6c-1-5 1-9 5-12l23 18z" />
            <path d="M50 42l-20-20c3-4 7-5 12-4l8 24z" />
          </g>

          {/* Inner Golden Petals */}
          <g fill="url(#jdYellow)" stroke="#d97706" strokeWidth="0.9" opacity="0.95">
            <path d="M50 42l-3-20c3-2 6-2 9 0l-3 20z" />
            <path d="M50 42l14-16c3 2 4 5 4 8l-18 8z" />
            <path d="M50 42l18-5c2 3 2 6 0 9l-18-4z" />
            <path d="M50 42l14 14c-2 3-5 4-8 3l-6-17z" />
            <path d="M50 42l-2 20c-3 1-6 1-9 0l2-20z" />
            <path d="M50 42l-14 16c-3-2-4-5-4-8l18-8z" />
            <path d="M50 42l-18 5c-2-3-2-6 0-9l18 4z" />
            <path d="M50 42l-14-14c2-3 5-4 8-3l6 17z" />
          </g>

          {/* Central Dark Seed Disc */}
          <circle cx="50" cy="42" r="16" fill="url(#sunflowerDisc)" stroke="#78350f" strokeWidth="2" />
          <circle cx="50" cy="42" r="13" fill="none" stroke="#d97706" strokeWidth="1" strokeDasharray="2.5 2" />
          <circle cx="50" cy="42" r="9" fill="none" stroke="#ca8a04" strokeWidth="1" strokeDasharray="2 1.8" />
          <circle cx="50" cy="42" r="5" fill="none" stroke="#eab308" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
          <circle cx="50" cy="42" r="2.5" fill="#ca8a04" />
        </g>
      );

    case 'granos':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="88" rx="38" ry="6" fill="url(#groundShadow)" />
          {/* Spilled Grains */}
          <g fill="url(#wheatGold)" stroke="#b45309" strokeWidth="0.8">
            <ellipse cx="26" cy="85" rx="3.5" ry="2.2" transform="rotate(-15 26 85)" />
            <ellipse cx="34" cy="86" rx="4" ry="2.5" transform="rotate(25 34 86)" />
            <ellipse cx="66" cy="86" rx="3.8" ry="2.4" transform="rotate(-20 66 86)" />
            <ellipse cx="74" cy="84" rx="3.5" ry="2.2" transform="rotate(35 74 84)" />
          </g>
          {/* Wooden / Terracotta Harvest Bowl */}
          <path d="M18 50c4 24 20 36 32 36s28-12 32-36z" fill="#78350f" stroke="#451a03" strokeWidth="2.5" />
          <ellipse cx="50" cy="50" rx="32" ry="9" fill="#92400e" stroke="#451a03" strokeWidth="2.2" />
          <ellipse cx="50" cy="50" rx="29" ry="7.5" fill="#451a03" />

          {/* Mound of Harvested Grains */}
          <path d="M22 50c6-18 20-26 28-26s22 8 28 26c-8 6-20 8-28 8s-20-2-28-8z" fill="url(#wheatGold)" stroke="#b45309" strokeWidth="1.8" />
          <g fill="url(#cornKernel)" stroke="#ca8a04" strokeWidth="0.7">
            <ellipse cx="42" cy="36" rx="3.2" ry="2" transform="rotate(-20 42 36)" />
            <ellipse cx="50" cy="34" rx="3.5" ry="2.2" transform="rotate(10 50 34)" />
            <ellipse cx="58" cy="37" rx="3.2" ry="2" transform="rotate(30 58 37)" />
            <ellipse cx="36" cy="43" rx="3.5" ry="2.2" transform="rotate(-30 36 43)" />
            <ellipse cx="45" cy="42" rx="3.8" ry="2.4" transform="rotate(15 45 42)" />
            <ellipse cx="54" cy="43" rx="3.6" ry="2.3" transform="rotate(-15 54 43)" />
            <ellipse cx="63" cy="44" rx="3.4" ry="2.2" transform="rotate(25 63 44)" />
            <circle cx="49" cy="47" r="2.5" fill="#22c55e" stroke="#15803d" strokeWidth="0.6" />
            <circle cx="39" cy="48" r="2.5" fill="#22c55e" stroke="#15803d" strokeWidth="0.6" />
            <circle cx="60" cy="49" r="2.5" fill="#22c55e" stroke="#15803d" strokeWidth="0.6" />
          </g>
          <path d="M42 50c2 8 14 8 16 0" fill="url(#wheatGold)" stroke="#b45309" strokeWidth="1.5" />
        </g>
      );

    case 'otros-ingresos':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="88" rx="38" ry="6" fill="url(#groundShadow)" />
          {/* Banknotes Stack */}
          <g transform="translate(0, 4)">
            <rect x="18" y="52" width="46" height="26" rx="3" transform="rotate(-6 41 65)" fill="#15803d" stroke="#14532d" strokeWidth="1.8" />
            <rect x="18" y="47" width="46" height="26" rx="3" transform="rotate(-2 41 60)" fill="#16a34a" stroke="#14532d" strokeWidth="1.8" />
            <rect x="18" y="42" width="46" height="26" rx="3" fill="#22c55e" stroke="#14532d" strokeWidth="2" />
            <rect x="22" y="46" width="38" height="18" rx="2" fill="none" stroke="#dcfce7" strokeWidth="1.2" />
            <circle cx="41" cy="55" r="5.5" fill="#dcfce7" stroke="#15803d" strokeWidth="1" />
            <text x="41" y="58.5" fontSize="7.5" fontWeight="900" fill="#15803d" textAnchor="middle" fontFamily="sans-serif">$</text>
          </g>

          {/* Stack of Gold Coins */}
          <g transform="translate(18, 0)">
            <ellipse cx="52" cy="74" rx="14" ry="6" fill="#ca8a04" stroke="#854d0e" strokeWidth="1.5" />
            <path d="M38 74v4c0 3.3 6.3 6 14 6s14-2.7 14-6v-4" fill="#a16207" stroke="#854d0e" strokeWidth="1.5" />
            <ellipse cx="52" cy="68" rx="14" ry="6" fill="#ca8a04" stroke="#854d0e" strokeWidth="1.5" />
            <path d="M38 68v4c0 3.3 6.3 6 14 6s14-2.7 14-6v-4" fill="#a16207" stroke="#854d0e" strokeWidth="1.5" />
            <ellipse cx="52" cy="62" rx="14" ry="6" fill="url(#jdYellow)" stroke="#854d0e" strokeWidth="1.8" />
            <ellipse cx="52" cy="62" rx="11" ry="4.5" fill="none" stroke="#ca8a04" strokeWidth="1.2" strokeDasharray="1.5 1.5" />
            <text x="52" y="65" fontSize="8" fontWeight="900" fill="#854d0e" textAnchor="middle" fontFamily="sans-serif">$</text>
          </g>

          {/* Upward Growth Arrow */}
          <path d="M62 34l12-14l6 6l-18 18z" fill="#16a34a" />
          <path d="M56 26l22-12l2 24l-6-6l-14 14z" fill="#22c55e" stroke="#14532d" strokeWidth="1.8" />
        </g>
      );

    // ==========================================
    // 1. MAQUINARIAS (Realistas, 3D, Fondo Transparente)
    // ==========================================
    case 'tractor':
      return (
        <g filter="url(#softShadow)">
          {/* Ground Contact Shadow */}
          <ellipse cx="50" cy="88" rx="42" ry="6" fill="url(#groundShadow)" />

          {/* Tractor Green (John Deere Style) */}
          {/* Rear Huge Tire with Deep Rubber Treads */}
          <circle cx="34" cy="62" r="26" fill="url(#darkTire)" />
          <circle cx="34" cy="62" r="16" fill="url(#jdYellow)" stroke="#ca8a04" strokeWidth="2.5" />
          <circle cx="34" cy="62" r="6" fill="#0f172a" />
          {/* Chevron V Treads */}
          <path d="M22 42l6 4M14 56l7 2M16 72l6-2M26 84l4-6M42 42l-6 4M50 54l-6 2M48 72l-5-2" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />

          {/* Hood Body with 3D Volume */}
          <path d="M36 46h32l16 12v12H36z" fill="url(#jdGreen)" />
          {/* Hood Curve Top Highlight */}
          <path d="M50 46h20c6 0 10 3 14 8v4H50z" fill="#86efac" opacity="0.6" />
          {/* Yellow Side Stripe */}
          <path d="M46 54h36v3H46z" fill="url(#jdYellow)" />
          {/* Exhaust Pipe & Flap */}
          <path d="M62 46V20h4v26" fill="url(#steelMetal)" />
          <path d="M66 20l4-3" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />

          {/* Cabin (Glass Glare & Roof) */}
          <path d="M30 46h22V24H32c-3 0-5 2-6 5l-4 17h8z" fill="#14532d" />
          <path d="M32 26h18v18H28l3-16c.3-1.2 1.3-2 2.5-2z" fill="url(#cabGlass)" />
          <path d="M34 28l10 12" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
          <path d="M28 22h28v4H28z" fill="url(#jdGreen)" stroke="#15803d" strokeWidth="1" />

          {/* Front Small Wheel */}
          <circle cx="82" cy="70" r="15" fill="url(#darkTire)" />
          <circle cx="82" cy="70" r="9" fill="url(#jdYellow)" stroke="#ca8a04" strokeWidth="2" />
          <circle cx="82" cy="70" r="3.5" fill="#0f172a" />
          {/* Headlight LED */}
          <rect x="82" y="58" width="5" height="7" rx="2" fill="#fef08a" stroke="#ca8a04" strokeWidth="0.8" />
        </g>
      );

    case 'tractor-blue':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="88" rx="42" ry="6" fill="url(#groundShadow)" />

          {/* Tractor Blue (New Holland TS115 Style) */}
          {/* Rear Tire */}
          <circle cx="34" cy="62" r="26" fill="url(#darkTire)" />
          <circle cx="34" cy="62" r="16" fill="url(#steelMetal)" stroke="#64748b" strokeWidth="2.5" />
          <circle cx="34" cy="62" r="6" fill="#0f172a" />
          <path d="M22 42l6 4M14 56l7 2M16 72l6-2M26 84l4-6M42 42l-6 4M50 54l-6 2M48 72l-5-2" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />

          {/* Engine & Hood Body Blue */}
          <path d="M36 46h32l16 12v12H36z" fill="url(#nhBlue)" />
          <path d="M50 46h20c6 0 10 3 14 8v4H50z" fill="#7dd3fc" opacity="0.6" />
          {/* White Side Accent Decal */}
          <path d="M46 54h36v2.5H46z" fill="#ffffff" />
          {/* Exhaust Pipe */}
          <path d="M60 46V20h4v26" fill="url(#steelMetal)" />
          <path d="M64 20l4-3" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />

          {/* Cabin (New Holland White Roof) */}
          <path d="M30 46h22V24H32c-3 0-5 2-6 5l-4 17h8z" fill="#0369a1" />
          <path d="M32 26h18v18H28l3-16c.3-1.2 1.3-2 2.5-2z" fill="url(#cabGlass)" />
          <path d="M34 28l10 12" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
          <path d="M26 20h31v5H26z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.2" />

          {/* Front Wheel */}
          <circle cx="82" cy="70" r="15" fill="url(#darkTire)" />
          <circle cx="82" cy="70" r="9" fill="url(#steelMetal)" stroke="#64748b" strokeWidth="2" />
          <circle cx="82" cy="70" r="3.5" fill="#0f172a" />
          {/* Headlight */}
          <rect x="82" y="58" width="5" height="7" rx="2" fill="#fef08a" stroke="#ca8a04" strokeWidth="0.8" />
        </g>
      );

    case 'cosechadora':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="88" rx="44" ry="6" fill="url(#groundShadow)" />

          {/* Combine Harvester */}
          {/* Main Body */}
          <path d="M18 28h46l16 16v26H18z" fill="url(#jdGreen)" />
          <path d="M18 28h40l8 12H18z" fill="#86efac" opacity="0.5" />
          {/* Grain Tank Top */}
          <path d="M28 18h28v12H28z" fill="url(#jdYellow)" />
          {/* Unloading Auger Pipe */}
          <path d="M18 30l-14-16h8l14 16" fill="url(#steelMetal)" stroke="#334155" strokeWidth="1" />
          {/* Cabin Front Top */}
          <path d="M62 28h20v22H62z" fill="#14532d" />
          <path d="M64 30h16v18H64z" fill="url(#cabGlass)" />
          <path d="M66 32l8 10" stroke="#ffffff" strokeWidth="2" opacity="0.7" />
          <path d="M60 25h25v4H60z" fill="#fef08a" />
          {/* Reel / Header Front */}
          <rect x="76" y="64" width="20" height="16" rx="3" fill="url(#steelMetal)" stroke="#334155" strokeWidth="1.5" />
          <circle cx="86" cy="72" r="6" fill="#e2e8f0" stroke="#334155" strokeWidth="1" />
          {/* Large Front Drive Wheel */}
          <circle cx="56" cy="72" r="18" fill="url(#darkTire)" />
          <circle cx="56" cy="72" r="10" fill="url(#jdYellow)" stroke="#ca8a04" strokeWidth="2" />
          <circle cx="56" cy="72" r="4" fill="#0f172a" />
          {/* Small Rear Steering Wheel */}
          <circle cx="26" cy="76" r="12" fill="url(#darkTire)" />
          <circle cx="26" cy="76" r="6" fill="url(#jdYellow)" stroke="#ca8a04" strokeWidth="1.5" />
        </g>
      );

    case 'camion':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="88" rx="44" ry="6" fill="url(#groundShadow)" />

          {/* Cargo Dump Bed (Green/White) */}
          <rect x="10" y="30" width="50" height="36" rx="3" fill="url(#jdGreen)" stroke="#166534" strokeWidth="1.5" />
          <path d="M10 42h50M10 54h50" stroke="#166534" strokeWidth="1.5" />
          {/* Cabin (White / Chrome) */}
          <path d="M62 36h20c4 0 7 3 8 7l4 14v11H62z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
          {/* Windshield */}
          <path d="M64 40h16l4 10H64z" fill="url(#cabGlass)" />
          <path d="M66 42l6 6" stroke="#ffffff" strokeWidth="1.8" opacity="0.8" />
          {/* Grille & Bumper */}
          <rect x="88" y="56" width="6" height="10" rx="1" fill="url(#steelMetal)" />
          <rect x="86" y="66" width="8" height="4" fill="#475569" />
          {/* Wheels (3 Axles) */}
          <circle cx="22" cy="74" r="12" fill="url(#darkTire)" />
          <circle cx="22" cy="74" r="6" fill="url(#steelMetal)" />
          <circle cx="42" cy="74" r="12" fill="url(#darkTire)" />
          <circle cx="42" cy="74" r="6" fill="url(#steelMetal)" />
          <circle cx="78" cy="74" r="12" fill="url(#darkTire)" />
          <circle cx="78" cy="74" r="6" fill="url(#steelMetal)" />
        </g>
      );

    case 'cargadora':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="88" rx="44" ry="6" fill="url(#groundShadow)" />

          {/* Wheel Loader */}
          <path d="M20 44h34v24H20z" fill="url(#catYellow)" />
          {/* Counterweight rear */}
          <path d="M14 50h8v18h-8z" fill="#334155" />
          {/* Cab */}
          <path d="M32 24h20v20H32z" fill="#ca8a04" />
          <path d="M34 26h16v16H34z" fill="url(#cabGlass)" />
          <path d="M30 21h24v4H30z" fill="#0f172a" />
          {/* Boom Arms */}
          <path d="M48 54l28-18l10 20" stroke="url(#steelMetal)" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* Bucket */}
          <path d="M82 44l13 6l-6 26l-13-6z" fill="url(#catYellow)" stroke="#ca8a04" strokeWidth="1.5" />
          {/* Teeth */}
          <path d="M95 50l4 2M92 60l4 2M89 70l4 2" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
          {/* Wheels */}
          <circle cx="28" cy="72" r="16" fill="url(#darkTire)" />
          <circle cx="28" cy="72" r="8" fill="url(#catYellow)" stroke="#ca8a04" strokeWidth="2" />
          <circle cx="68" cy="72" r="16" fill="url(#darkTire)" />
          <circle cx="68" cy="72" r="8" fill="url(#catYellow)" stroke="#ca8a04" strokeWidth="2" />
        </g>
      );

    case 'excavadora':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="88" rx="42" ry="6" fill="url(#groundShadow)" />

          {/* Continuous Tracks Base */}
          <rect x="12" y="66" width="58" height="20" rx="10" fill="url(#darkTire)" stroke="#0f172a" strokeWidth="2" />
          <circle cx="21" cy="76" r="6" fill="url(#steelMetal)" />
          <circle cx="33" cy="76" r="5" fill="url(#steelMetal)" />
          <circle cx="45" cy="76" r="5" fill="url(#steelMetal)" />
          <circle cx="61" cy="76" r="6" fill="url(#steelMetal)" />
          <path d="M16 68h50M16 84h50" stroke="#64748b" strokeWidth="2.5" strokeDasharray="3 3" />

          {/* Rotating Upper House */}
          <path d="M18 46h36l6 6v14H18z" fill="url(#catYellow)" />
          {/* Cab Glass */}
          <path d="M36 32h20v22H36z" fill="#ca8a04" />
          <path d="M38 34h16v18H38z" fill="url(#cabGlass)" />
          {/* Counterweight */}
          <rect x="14" y="48" width="8" height="18" rx="2" fill="#1e293b" />

          {/* Articulated Boom & Arm */}
          <path d="M50 50L68 26L88 42" stroke="url(#catYellow)" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M50 50L68 26L88 42" stroke="#b45309" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* Hydraulic Cylinder */}
          <line x1="54" y1="54" x2="65" y2="34" stroke="url(#steelMetal)" strokeWidth="3" />
          {/* Bucket */}
          <path d="M88 42l9 13l-11 11l-6-9z" fill="#334155" stroke="#0f172a" strokeWidth="1.5" />
          {/* Teeth */}
          <path d="M97 55l4 4M93 63l4 4" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
        </g>
      );

    case 'motoniveladora':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="88" rx="44" ry="6" fill="url(#groundShadow)" />

          {/* Rear Engine & Chassis */}
          <rect x="10" y="46" width="30" height="20" rx="2" fill="url(#catYellow)" />
          {/* Rear Cab */}
          <path d="M24 28h18v22H24z" fill="#ca8a04" />
          <path d="M26 30h14v18H26z" fill="url(#cabGlass)" />
          {/* Frame to Front */}
          <path d="M38 46L80 56" stroke="url(#catYellow)" strokeWidth="6.5" strokeLinecap="round" fill="none" />
          {/* Grader Blade */}
          <path d="M40 64L64 72" stroke="url(#steelMetal)" strokeWidth="5.5" strokeLinecap="square" />
          <circle cx="52" cy="60" r="5" fill="#334155" />
          {/* Rear Wheels */}
          <circle cx="18" cy="72" r="14" fill="url(#darkTire)" />
          <circle cx="18" cy="72" r="7" fill="url(#catYellow)" />
          <circle cx="34" cy="72" r="14" fill="url(#darkTire)" />
          <circle cx="34" cy="72" r="7" fill="url(#catYellow)" />
          {/* Front Wheels */}
          <circle cx="82" cy="70" r="14" fill="url(#darkTire)" />
          <circle cx="82" cy="70" r="7" fill="url(#catYellow)" />
        </g>
      );

    case 'pulverizadora':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="88" rx="44" ry="6" fill="url(#groundShadow)" />

          {/* Tall Struts */}
          <line x1="28" y1="44" x2="24" y2="70" stroke="url(#steelMetal)" strokeWidth="5.5" />
          <line x1="72" y1="44" x2="76" y2="70" stroke="url(#steelMetal)" strokeWidth="5.5" />
          {/* Wheels */}
          <circle cx="24" cy="70" r="16" fill="url(#darkTire)" />
          <circle cx="24" cy="70" r="10" fill="url(#jdYellow)" />
          <circle cx="76" cy="70" r="16" fill="url(#darkTire)" />
          <circle cx="76" cy="70" r="10" fill="url(#jdYellow)" />
          {/* Elevated Tank */}
          <rect x="26" y="32" width="48" height="22" rx="7" fill="#f8fafc" stroke="#38bdf8" strokeWidth="2" />
          {/* Forward Cab */}
          <path d="M66 24h15v22H66z" fill="#0284c7" />
          <path d="M68 26h11v18H68z" fill="url(#cabGlass)" />
          {/* Spray Booms Folded */}
          <path d="M10 26L26 42M6 34L26 46" stroke="#16a34a" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M90 26L74 42M94 34L74 46" stroke="#16a34a" strokeWidth="3.5" strokeLinecap="round" />
          {/* Spray Mist */}
          <circle cx="14" cy="48" r="2" fill="#38bdf8" opacity="0.9" />
          <circle cx="20" cy="54" r="2" fill="#38bdf8" opacity="0.9" />
          <circle cx="84" cy="54" r="2" fill="#38bdf8" opacity="0.9" />
        </g>
      );

    case 'otros-equipos':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="88" rx="42" ry="6" fill="url(#groundShadow)" />

          <rect x="20" y="34" width="60" height="32" rx="6" fill="url(#steelMetal)" stroke="#1e293b" strokeWidth="2" />
          <circle cx="32" cy="72" r="14" fill="url(#darkTire)" />
          <circle cx="32" cy="72" r="7" fill="url(#catYellow)" />
          <circle cx="68" cy="72" r="14" fill="url(#darkTire)" />
          <circle cx="68" cy="72" r="7" fill="url(#catYellow)" />
          <rect x="28" y="40" width="24" height="18" rx="2" fill="#0f172a" />
          <line x1="32" y1="44" x2="48" y2="44" stroke="#facc15" strokeWidth="2.5" />
          <line x1="32" y1="50" x2="48" y2="50" stroke="#facc15" strokeWidth="2.5" />
          <path d="M66 26v12h6V26z" fill="#475569" />
        </g>
      );

    // ==========================================
    // 2. IMPLEMENTOS AGRÍCOLAS
    // ==========================================
    case 'sembradora':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="86" rx="42" ry="5" fill="url(#groundShadow)" />

          {/* Main Red Frame */}
          <rect x="12" y="42" width="76" height="9" rx="2" fill="url(#caseRed)" stroke="#7f1d1d" strokeWidth="1.5" />
          <path d="M50 42L80 20" stroke="url(#caseRed)" strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="82" cy="19" r="4" fill="#facc15" />

          {/* Hoppers */}
          <rect x="18" y="22" width="13" height="20" rx="3" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
          <rect x="35" y="22" width="13" height="20" rx="3" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
          <rect x="52" y="22" width="13" height="20" rx="3" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
          <rect x="69" y="22" width="13" height="20" rx="3" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />

          <rect x="17" y="20" width="15" height="4" rx="1" fill="url(#jdYellow)" />
          <rect x="34" y="20" width="15" height="4" rx="1" fill="url(#jdYellow)" />
          <rect x="51" y="20" width="15" height="4" rx="1" fill="url(#jdYellow)" />
          <rect x="68" y="20" width="15" height="4" rx="1" fill="url(#jdYellow)" />

          <ellipse cx="24" cy="66" rx="5" ry="13" fill="url(#steelMetal)" stroke="#1e293b" />
          <ellipse cx="41" cy="66" rx="5" ry="13" fill="url(#steelMetal)" stroke="#1e293b" />
          <ellipse cx="58" cy="66" rx="5" ry="13" fill="url(#steelMetal)" stroke="#1e293b" />
          <ellipse cx="75" cy="66" rx="5" ry="13" fill="url(#steelMetal)" stroke="#1e293b" />

          <circle cx="27" cy="75" r="6" fill="url(#darkTire)" />
          <circle cx="44" cy="75" r="6" fill="url(#darkTire)" />
          <circle cx="61" cy="75" r="6" fill="url(#darkTire)" />
          <circle cx="78" cy="75" r="6" fill="url(#darkTire)" />
        </g>
      );

    case 'romplow':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="86" rx="42" ry="5" fill="url(#groundShadow)" />

          <path d="M14 32L82 50" stroke="url(#caseRed)" strokeWidth="8.5" strokeLinecap="round" />
          <path d="M80 48L88 26" stroke="url(#caseRed)" strokeWidth="5.5" strokeLinecap="round" />
          <circle cx="89" cy="24" r="4" fill="#facc15" />

          <circle cx="22" cy="64" r="15" fill="url(#steelMetal)" stroke="#0f172a" strokeWidth="2" />
          <circle cx="22" cy="64" r="4" fill="#0f172a" />
          <circle cx="41" cy="67" r="15" fill="url(#steelMetal)" stroke="#0f172a" strokeWidth="2" />
          <circle cx="41" cy="67" r="4" fill="#0f172a" />
          <circle cx="60" cy="70" r="15" fill="url(#steelMetal)" stroke="#0f172a" strokeWidth="2" />
          <circle cx="60" cy="70" r="4" fill="#0f172a" />

          <circle cx="78" cy="62" r="12" fill="url(#darkTire)" />
          <circle cx="78" cy="62" r="5" fill="#f8fafc" />
        </g>
      );

    case 'ripper':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="86" rx="42" ry="5" fill="url(#groundShadow)" />

          <rect x="16" y="26" width="68" height="11" rx="3" fill="url(#nhBlue)" stroke="#075985" strokeWidth="1.5" />
          <path d="M50 14L34 26M50 14L66 26" stroke="url(#nhBlue)" strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="50" cy="13" r="4" fill="#facc15" />

          <path d="M26 37v16c0 10 5 18 12 22l4-2" stroke="url(#steelMetal)" strokeWidth="6.5" strokeLinecap="round" fill="none" />
          <polygon points="39,72 47,76 41,81" fill="url(#catYellow)" stroke="#b45309" strokeWidth="1" />

          <path d="M50 37v16c0 10 5 18 12 22l4-2" stroke="url(#steelMetal)" strokeWidth="6.5" strokeLinecap="round" fill="none" />
          <polygon points="63,72 71,76 65,81" fill="url(#catYellow)" stroke="#b45309" strokeWidth="1" />

          <path d="M74 37v16c0 10 5 18 12 22l4-2" stroke="url(#steelMetal)" strokeWidth="6.5" strokeLinecap="round" fill="none" />
          <polygon points="87,72 95,76 89,81" fill="url(#catYellow)" stroke="#b45309" strokeWidth="1" />
        </g>
      );

    case 'pala-niveladora':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="86" rx="42" ry="5" fill="url(#groundShadow)" />

          <path d="M88 30L46 42" stroke="url(#catYellow)" strokeWidth="6.5" strokeLinecap="round" />
          <circle cx="90" cy="29" r="4.5" fill="#facc15" />

          <rect x="52" y="28" width="18" height="7" rx="2" fill="url(#steelMetal)" />
          <line x1="70" y1="31.5" x2="78" y2="31.5" stroke="#cbd5e1" strokeWidth="3" />

          <path d="M20 40c8 12 10 26 8 38h9c2-12 0-26-8-38z" fill="url(#catYellow)" stroke="#b45309" strokeWidth="1.5" />
          <path d="M18 76l20 4" stroke="#0f172a" strokeWidth="3.5" strokeLinecap="square" />

          <circle cx="48" cy="74" r="11" fill="url(#darkTire)" />
          <circle cx="48" cy="74" r="5" fill="#facc15" />
        </g>
      );

    case 'rastra':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="86" rx="42" ry="5" fill="url(#groundShadow)" />

          <rect x="18" y="36" width="64" height="9" rx="2" fill="url(#jdGreen)" stroke="#14532d" strokeWidth="1.5" />
          <path d="M50 36L78 16" stroke="url(#jdGreen)" strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="80" cy="15" r="4" fill="#facc15" />

          <ellipse cx="24" cy="56" rx="4.5" ry="15" fill="url(#steelMetal)" stroke="#0f172a" />
          <ellipse cx="37" cy="56" rx="4.5" ry="15" fill="url(#steelMetal)" stroke="#0f172a" />
          <ellipse cx="50" cy="56" rx="4.5" ry="15" fill="url(#steelMetal)" stroke="#0f172a" />
          <ellipse cx="63" cy="56" rx="4.5" ry="15" fill="url(#steelMetal)" stroke="#0f172a" />
          <ellipse cx="76" cy="56" rx="4.5" ry="15" fill="url(#steelMetal)" stroke="#0f172a" />

          <line x1="20" y1="56" x2="80" y2="56" stroke="#334155" strokeWidth="2.5" />

          <circle cx="50" cy="68" r="10" fill="url(#darkTire)" />
          <circle cx="50" cy="68" r="5" fill="#cbd5e1" />
        </g>
      );

    case 'trailla':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="86" rx="42" ry="5" fill="url(#groundShadow)" />

          <path d="M88 34L64 40L50 48" stroke="url(#catYellow)" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="90" cy="33" r="4.5" fill="#facc15" />

          <path d="M20 44h34l-4 24H16z" fill="url(#catYellow)" stroke="#b45309" strokeWidth="1.5" />
          <path d="M22 46h28l-3 20H18z" fill="#fef08a" opacity="0.6" />

          <line x1="28" y1="38" x2="48" y2="38" stroke="url(#steelMetal)" strokeWidth="3.5" />

          <circle cx="26" cy="70" r="17" fill="url(#darkTire)" />
          <circle cx="26" cy="70" r="8" fill="url(#catYellow)" />
        </g>
      );

    case 'cortadora-sorgo':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="86" rx="42" ry="5" fill="url(#groundShadow)" />

          <path d="M26 30h48v15H26z" fill="url(#caseRed)" stroke="#7f1d1d" strokeWidth="1.5" />
          <path d="M50 14L34 30M50 14L66 30" stroke="url(#caseRed)" strokeWidth="4.5" />
          <circle cx="50" cy="13" r="4" fill="#facc15" />

          <circle cx="34" cy="62" r="17" fill="url(#steelMetal)" stroke="#0f172a" strokeWidth="2" />
          <circle cx="66" cy="62" r="17" fill="url(#steelMetal)" stroke="#0f172a" strokeWidth="2" />

          <path d="M34 45l4 8M17 62l8 4M34 79l-4-8M51 62l-8-4" stroke="#f87171" strokeWidth="2.5" />
          <path d="M66 45l4 8M49 62l8 4M66 79l-4-8M83 62l-8-4" stroke="#f87171" strokeWidth="2.5" />

          <polygon points="14,48 22,76 12,72" fill="url(#jdYellow)" />
          <polygon points="86,48 78,76 88,72" fill="url(#jdYellow)" />
        </g>
      );

    case 'rolo':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="86" rx="42" ry="5" fill="url(#groundShadow)" />

          <rect x="16" y="30" width="68" height="13" rx="2" fill="url(#caseRed)" stroke="#7f1d1d" strokeWidth="1.5" />
          <path d="M50 30L78 16" stroke="url(#caseRed)" strokeWidth="4.5" />
          <circle cx="80" cy="15" r="4" fill="#facc15" />

          <rect x="20" y="45" width="60" height="30" rx="5" fill="url(#steelMetal)" stroke="#1e293b" strokeWidth="2" />

          <line x1="22" y1="52" x2="78" y2="52" stroke="#f8fafc" strokeWidth="3" />
          <line x1="22" y1="60" x2="78" y2="60" stroke="#0f172a" strokeWidth="3" />
          <line x1="22" y1="68" x2="78" y2="68" stroke="#f8fafc" strokeWidth="3" />

          <circle cx="20" cy="60" r="5" fill="#0f172a" />
          <circle cx="80" cy="60" r="5" fill="#0f172a" />
        </g>
      );

    case 'fumigadora':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="86" rx="42" ry="5" fill="url(#groundShadow)" />

          <rect x="24" y="30" width="40" height="28" rx="9" fill="#ffffff" stroke="#38bdf8" strokeWidth="2.5" />
          <path d="M36 26h16v4H36z" fill="#0284c7" />

          <circle cx="44" cy="70" r="15" fill="url(#darkTire)" />
          <circle cx="44" cy="70" r="7" fill="url(#steelMetal)" />

          <path d="M54 52L82 34" stroke="url(#nhBlue)" strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="84" cy="33" r="4" fill="#facc15" />

          <line x1="8" y1="48" x2="32" y2="48" stroke="#16a34a" strokeWidth="3.5" />
          <circle cx="10" cy="51" r="2" fill="#38bdf8" />
          <circle cx="17" cy="51" r="2" fill="#38bdf8" />
          <circle cx="24" cy="51" r="2" fill="#38bdf8" />
          <path d="M10 53l-3 7M17 53l-3 7M24 53l-3 7" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="1 1" />
        </g>
      );

    case 'cultivador':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="86" rx="42" ry="5" fill="url(#groundShadow)" />

          <rect x="16" y="32" width="68" height="9" rx="2" fill="url(#jdGreen)" stroke="#14532d" strokeWidth="1.5" />
          <path d="M50 16L34 32M50 16L66 32" stroke="url(#jdGreen)" strokeWidth="4.5" />

          <path d="M24 41c0 8-6 12-6 18c0 6 6 8 10 10" stroke="url(#steelMetal)" strokeWidth="4" strokeLinecap="round" fill="none" />
          <polygon points="28,67 35,73 27,76" fill="#facc15" />

          <path d="M42 41c0 8-6 12-6 18c0 6 6 8 10 10" stroke="url(#steelMetal)" strokeWidth="4" strokeLinecap="round" fill="none" />
          <polygon points="46,67 53,73 45,76" fill="#facc15" />

          <path d="M60 41c0 8-6 12-6 18c0 6 6 8 10 10" stroke="url(#steelMetal)" strokeWidth="4" strokeLinecap="round" fill="none" />
          <polygon points="64,67 71,73 63,76" fill="#facc15" />

          <path d="M78 41c0 8-6 12-6 18c0 6 6 8 10 10" stroke="url(#steelMetal)" strokeWidth="4" strokeLinecap="round" fill="none" />
          <polygon points="82,67 89,73 81,76" fill="#facc15" />
        </g>
      );

    case 'otros-implementos':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="86" rx="42" ry="5" fill="url(#groundShadow)" />

          <polygon points="50,16 22,72 78,72" fill="none" stroke="url(#caseRed)" strokeWidth="7" strokeLinejoin="round" />
          <circle cx="50" cy="16" r="4.5" fill="#facc15" />
          <circle cx="22" cy="72" r="4.5" fill="#facc15" />
          <circle cx="78" cy="72" r="4.5" fill="#facc15" />
          <rect x="34" y="52" width="32" height="7" fill="url(#steelMetal)" />
        </g>
      );

    // ==========================================
    // 3. GASTOS Y PRODUCTOS
    // ==========================================
    case 'diesel':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="44" cy="86" rx="26" ry="5" fill="url(#groundShadow)" />

          {/* Diesel Fuel Drum */}
          <rect x="20" y="22" width="40" height="58" rx="8" fill="url(#dieselAmber)" stroke="#78350f" strokeWidth="2.5" />
          <line x1="20" y1="40" x2="60" y2="40" stroke="#78350f" strokeWidth="3" />
          <line x1="20" y1="60" x2="60" y2="60" stroke="#78350f" strokeWidth="3" />
          <circle cx="30" cy="22" r="4" fill="url(#steelMetal)" stroke="#334155" strokeWidth="1" />

          {/* DIESEL Label */}
          <rect x="26" y="46" width="28" height="10" rx="2.5" fill="#ffffff" stroke="#eab308" strokeWidth="1" />
          <text x="40" y="53.5" fontSize="6.5" fontWeight="900" fill="#b45309" textAnchor="middle" fontFamily="sans-serif">
            DIESEL
          </text>

          {/* Red Fuel Dispenser Hose & Nozzle */}
          <path d="M68 26c4 0 9 4 9 9v26l7-7" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <polygon points="76,58 83,51 85,58" fill="#dc2626" />

          {/* Yellow Hazard Symbol */}
          <polygon points="40,28 35,37 45,37" fill="#facc15" stroke="#78350f" strokeWidth="1" />
        </g>
      );

    case 'gasolina':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="46" cy="86" rx="28" ry="5" fill="url(#groundShadow)" />

          <path d="M22 28h42c3 0 6 3 6 6v46H18V34c0-3 3-6 4-6z" fill="url(#caseRed)" stroke="#7f1d1d" strokeWidth="2.5" />
          <path d="M26 28v-11h34v11" stroke="url(#caseRed)" strokeWidth="4.5" strokeLinecap="round" fill="none" />

          <path d="M60 17l9-9h7v9l-9 9" fill="url(#steelMetal)" stroke="#334155" strokeWidth="1" />

          <line x1="26" y1="38" x2="60" y2="72" stroke="#7f1d1d" strokeWidth="3" />
          <line x1="60" y1="38" x2="26" y2="72" stroke="#7f1d1d" strokeWidth="3" />

          <circle cx="43" cy="55" r="10" fill="#fef08a" />
          <path d="M43 47c2 3 5 6 5 9c0 3-2 5-5 5s-5-2-5-5c0-3 3-6 5-9z" fill="#f97316" />
        </g>
      );

    case 'aceite':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="44" cy="86" rx="26" ry="5" fill="url(#groundShadow)" />

          <path d="M24 32h38l8 13v37H18V45l6-13z" fill="#1e293b" stroke="#0f172a" strokeWidth="2.5" />
          <path d="M26 45h10v22H26z" fill="#ffffff" opacity="0.12" rx="3" />

          <rect x="52" y="22" width="13" height="11" rx="2" fill="url(#jdYellow)" stroke="#ca8a04" strokeWidth="1.2" />

          <line x1="65" y1="46" x2="65" y2="76" stroke="#f59e0b" strokeWidth="3.5" strokeLinecap="round" />

          <circle cx="43" cy="57" r="9" fill="url(#jdYellow)" />
          <path d="M43 51c2 3 4 5 4 8c0 2-2 4-4 4s-4-2-4-4c0-3 2-5 4-8z" fill="#d97706" />
          <text x="43" y="76" fontSize="5.5" fontWeight="bold" fill="#f8fafc" textAnchor="middle" fontFamily="sans-serif">
            15W-40
          </text>
        </g>
      );

    case 'filtro':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="86" rx="28" ry="5" fill="url(#groundShadow)" />

          <rect x="22" y="24" width="56" height="58" rx="9" fill="url(#nhBlue)" stroke="#075985" strokeWidth="2.5" />
          <rect x="18" y="20" width="64" height="9" rx="3" fill="url(#steelMetal)" stroke="#1e293b" strokeWidth="1.8" />
          <circle cx="50" cy="24.5" r="4.5" fill="#0f172a" />

          <line x1="32" y1="36" x2="32" y2="74" stroke="#0284c7" strokeWidth="3" />
          <line x1="44" y1="36" x2="44" y2="74" stroke="#0284c7" strokeWidth="3" />
          <line x1="56" y1="36" x2="56" y2="74" stroke="#0284c7" strokeWidth="3" />
          <line x1="68" y1="36" x2="68" y2="74" stroke="#0284c7" strokeWidth="3" />

          <circle cx="50" cy="55" r="9" fill="#ffffff" />
          <path d="M45 51l10 8M45 59l10-8" stroke="#0369a1" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      );

    case 'neumaticos':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="88" rx="38" ry="6" fill="url(#groundShadow)" />

          <circle cx="50" cy="50" r="40" fill="url(#darkTire)" stroke="#0f172a" strokeWidth="2.8" />
          <circle cx="50" cy="50" r="23" fill="url(#jdYellow)" stroke="#ca8a04" strokeWidth="2.8" />

          <circle cx="50" cy="50" r="8.5" fill="#0f172a" />
          <circle cx="50" cy="37" r="2" fill="#ffffff" />
          <circle cx="59" cy="41" r="2" fill="#ffffff" />
          <circle cx="63" cy="50" r="2" fill="#ffffff" />
          <circle cx="59" cy="59" r="2" fill="#ffffff" />
          <circle cx="50" cy="63" r="2" fill="#ffffff" />
          <circle cx="41" cy="59" r="2" fill="#ffffff" />
          <circle cx="37" cy="50" r="2" fill="#ffffff" />
          <circle cx="41" cy="41" r="2" fill="#ffffff" />

          <path d="M43 14l7 7l-7 7M57 14l-7 7l7 7" stroke="#64748b" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M82 43l-7 7l-7-7M82 57l-7-7l-7 7" stroke="#64748b" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M43 86l7-7l-7-7M57 86l-7-7l7-7" stroke="#64748b" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M18 43l7 7l7-7M18 57l7-7l7 7" stroke="#64748b" strokeWidth="3" strokeLinecap="round" fill="none" />
        </g>
      );

    case 'bateria':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="86" rx="36" ry="5" fill="url(#groundShadow)" />

          <rect x="16" y="30" width="68" height="48" rx="5" fill="#1e293b" stroke="#0f172a" strokeWidth="2.5" />

          <rect x="26" y="21" width="12" height="9" rx="2" fill="#ef4444" stroke="#991b1b" />
          <text x="32" y="28" fontSize="8" fontWeight="bold" fill="#ffffff" textAnchor="middle">+</text>

          <rect x="62" y="21" width="12" height="9" rx="2" fill="#3b82f6" stroke="#1d4ed8" />
          <text x="68" y="28" fontSize="8" fontWeight="bold" fill="#ffffff" textAnchor="middle">-</text>

          <path d="M28 34c0-11 44-11 44 0" stroke="#f59e0b" strokeWidth="3.5" strokeLinecap="round" fill="none" />

          <rect x="22" y="42" width="56" height="7" rx="2" fill="#334155" />

          <polygon points="53,52 44,63 51,63 46,74 59,61 51,61" fill="#facc15" stroke="#ca8a04" strokeWidth="1" />
        </g>
      );

    case 'repuestos':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="86" rx="34" ry="5" fill="url(#groundShadow)" />

          <circle cx="42" cy="48" r="23" fill="url(#steelMetal)" stroke="#1e293b" strokeWidth="2.5" />
          <circle cx="42" cy="48" r="10" fill="#ffffff" stroke="#1e293b" strokeWidth="2.5" />

          <rect x="38" y="21" width="8" height="7" rx="1" fill="#475569" />
          <rect x="38" y="68" width="8" height="7" rx="1" fill="#475569" />
          <rect x="15" y="44" width="7" height="8" rx="1" fill="#475569" />
          <rect x="62" y="44" width="7" height="8" rx="1" fill="#475569" />

          <path d="M78 20l-34 42l-9-7l34-42c2.5-3 7-3 9 0z" fill="url(#jdYellow)" stroke="#b45309" strokeWidth="1.8" />
          <circle cx="80" cy="22" r="5" fill="#fef08a" stroke="#ca8a04" strokeWidth="1" />
        </g>
      );

    case 'mantenimiento':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="86" rx="38" ry="5" fill="url(#groundShadow)" />

          <rect x="16" y="34" width="68" height="44" rx="5" fill="url(#caseRed)" stroke="#7f1d1d" strokeWidth="2.5" />

          <path d="M38 34V23h24v11" stroke="#334155" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <rect x="14" y="34" width="72" height="9" rx="2" fill="#b91c1c" />

          <rect x="32" y="41" width="7" height="9" rx="1" fill="url(#steelMetal)" />
          <rect x="61" y="41" width="7" height="9" rx="1" fill="url(#steelMetal)" />

          <path d="M38 60h24M56 55l6 5l-6 5" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );

    case 'grasa':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="44" cy="86" rx="32" ry="5" fill="url(#groundShadow)" />

          <rect x="28" y="26" width="42" height="24" rx="4" transform="rotate(-30 49 38)" fill="url(#steelMetal)" stroke="#1e293b" strokeWidth="2.5" />

          <path d="M20 56L10 63" stroke="#334155" strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="8" cy="64" r="4.5" fill="#0f172a" />

          <path d="M68 26L80 12" stroke="#dc2626" strokeWidth="4.5" strokeLinecap="round" />

          <path d="M72 32c8 4 15 14 13 25l-4 6" stroke="#0f172a" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <rect x="76" y="62" width="7" height="11" rx="1.5" fill="url(#jdYellow)" />

          <circle cx="79.5" cy="78" r="4" fill="#f59e0b" />
        </g>
      );

    case 'semillas':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="86" rx="30" ry="5" fill="url(#groundShadow)" />

          <path d="M24 32c4-6 13-8 26-8s22 2 26 8l-6 48H30z" fill="url(#burlapGrad)" stroke="#57534e" strokeWidth="2.5" />

          <ellipse cx="50" cy="32" rx="22" ry="5.5" fill="#a8a29e" stroke="#44403c" strokeWidth="1.8" />
          <path d="M41 32l-5-7M59 32l5-7" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />

          <circle cx="50" cy="56" r="15" fill="#fef08a" stroke="#eab308" strokeWidth="1.8" />
          <path d="M50 47c4 3 7 8 4 13c-4 0-9-4-8-9c0-2 2-4 4-4z" fill="#22c55e" />
          <path d="M50 56c-4 3-7 8-4 13c4 0 9-4 8-9c0-2-2-4-4-4z" fill="#16a34a" />
        </g>
      );

    case 'fertilizante':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="50" cy="86" rx="32" ry="5" fill="url(#groundShadow)" />

          <rect x="20" y="22" width="60" height="60" rx="5" fill="#ffffff" stroke="#16a34a" strokeWidth="2.5" />

          <rect x="20" y="22" width="60" height="13" fill="#16a34a" />
          <rect x="20" y="70" width="60" height="12" fill="#16a34a" />

          <circle cx="50" cy="49" r="13" fill="#dcfce7" />
          <path d="M50 42v13M50 44c3-3 8-3 9 1c-3 1-7 0-9-1zM50 49c-3-3-8-3-9 1c3 1 7 0 9-1z" stroke="#15803d" strokeWidth="2.2" strokeLinecap="round" fill="#22c55e" />
          <text x="50" y="31.5" fontSize="6.5" fontWeight="900" fill="#ffffff" textAnchor="middle" fontFamily="sans-serif">
            UREA / NPK
          </text>
        </g>
      );

    case 'herbicida':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="44" cy="86" rx="26" ry="5" fill="url(#groundShadow)" />

          <path d="M24 32h38l8 13v37H18V45l6-13z" fill="#ffffff" stroke="#ea580c" strokeWidth="2.5" />
          <rect x="33" y="21" width="15" height="11" rx="2" fill="#ea580c" stroke="#c2410c" strokeWidth="1.2" />

          <path d="M24 45h10v22H24z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.2" rx="2" />

          <rect x="39" y="45" width="28" height="28" rx="3" fill="#ffedd5" stroke="#fb923c" strokeWidth="1.2" />

          <path d="M53 51v15M48 56l10 7M58 56l-10 7" stroke="#c2410c" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="53" cy="59.5" r="9" fill="none" stroke="#ef4444" strokeWidth="1.8" />
        </g>
      );

    case 'insecticida':
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="44" cy="86" rx="26" ry="5" fill="url(#groundShadow)" />

          <path d="M24 32h38l8 13v37H18V45l6-13z" fill="#ffffff" stroke="#7c3aed" strokeWidth="2.5" />
          <rect x="33" y="21" width="15" height="11" rx="2" fill="#7c3aed" stroke="#6d28d9" strokeWidth="1.2" />

          <path d="M24 45h10v22H24z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.2" rx="2" />

          <path d="M53 47l11 4v9c0 7-6 11-11 13c-5-2-11-6-11-13v-9z" fill="#ede9fe" stroke="#7c3aed" strokeWidth="1.8" />

          <ellipse cx="53" cy="58" rx="4" ry="5.5" fill="#6d28d9" />
          <line x1="46" y1="56" x2="60" y2="56" stroke="#6d28d9" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="46" y1="60" x2="60" y2="60" stroke="#6d28d9" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );

    case 'otros-gastos':
    default:
      return (
        <g filter="url(#softShadow)">
          <ellipse cx="48" cy="86" rx="32" ry="5" fill="url(#groundShadow)" />

          <rect x="20" y="20" width="48" height="62" rx="5" fill="#ffffff" stroke="#475569" strokeWidth="2.5" />
          <line x1="28" y1="31" x2="58" y2="31" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="28" y1="40" x2="54" y2="40" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="28" y1="49" x2="48" y2="49" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" />

          <rect x="28" y="59" width="24" height="7" rx="2" fill="#dcfce7" />
          <path d="M32 62.5l3.5 3.5l7-7" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />

          <circle cx="68" cy="66" r="15" fill="url(#jdYellow)" stroke="#ca8a04" strokeWidth="2.2" />
          <circle cx="68" cy="66" r="10" fill="#fef08a" stroke="#ca8a04" strokeWidth="1" />
          <text x="68" y="70.5" fontSize="12" fontWeight="900" fill="#854d0e" textAnchor="middle" fontFamily="sans-serif">
            $
          </text>
        </g>
      );
  }
}
