import React, { useState, useEffect } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { getIconAssetUrl, getIconDefinition, IconCategory } from '../services/iconCatalog';

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
  const src = getIconAssetUrl(definition.id);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  let pxSize = 38;
  if (typeof size === 'number') {
    pxSize = size;
  } else {
    switch (size) {
      case 'xs':
        pxSize = 24;
        break;
      case 'sm':
        pxSize = 30;
        break;
      case 'md':
        pxSize = 40;
        break;
      case 'lg':
        pxSize = 54;
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
      {failed ? (
        <ImageIcon
          className="text-[#8B9890]"
          style={{ width: Math.max(14, Math.round(pxSize * 0.6)), height: Math.max(14, Math.round(pxSize * 0.6)) }}
          aria-hidden="true"
        />
      ) : (
        <img
          src={src}
          alt={definition.name}
          width={pxSize}
          height={pxSize}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="w-full h-full object-contain pointer-events-none"
        />
      )}
    </div>
  );
};
