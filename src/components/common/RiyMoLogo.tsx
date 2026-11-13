import React from 'react';

interface RiyMoLogoProps {
  variant?: 'full' | 'isotipo' | 'compact';
  theme?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showSubtitle?: boolean;
}

/**
 * RIYMO Official Brand Logo
 * 
 * Concept:
 * - "RIY": Quechua for "ir" / movement, dynamic forward exploration.
 * - "MO": Moche ancestral culture, stepped-fret wave geometry.
 * - Colors: Coral (#E85B49), Forest Green (#263B35), Moche Gold (#D9B66F).
 */
export const RiyMoLogo: React.FC<RiyMoLogoProps> = ({
  variant = 'full',
  theme = 'light',
  size = 'md',
  className = '',
  showSubtitle = true,
}) => {
  const isDark = theme === 'dark';

  // Dimension scaling
  const dimensions = {
    sm: { icon: 24, text: 'text-sm', sub: 'text-[9px]' },
    md: { icon: 32, text: 'text-lg', sub: 'text-[10px]' },
    lg: { icon: 40, text: 'text-2xl', sub: 'text-xs' },
    xl: { icon: 48, text: 'text-3xl', sub: 'text-sm' },
  }[size];

  // SVG Isotipo: Stylized compass needle + Moche stepped-wave contour
  const IsotipoSVG = (
    <svg
      width={dimensions.icon}
      height={dimensions.icon}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 transition-transform duration-200 group-hover:scale-105"
      aria-hidden="true"
    >
      {/* Background soft curved container */}
      <rect
        width="40"
        height="40"
        rx="10"
        fill={isDark ? '#263B35' : '#263B35'}
      />
      
      {/* Subtle Moche stepped-fret background accent */}
      <path
        d="M8 28L14 28L14 22L20 22L20 16L26 16"
        stroke="#D9B66F"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.4"
      />

      {/* Dynamic Waypoint & Forward Exploration Needle (Coral) */}
      <path
        d="M20 7L27 21L20 18L13 21L20 7Z"
        fill="#E85B49"
      />

      {/* Needle facet shade for three-dimensional craft */}
      <path
        d="M20 7L27 21L20 18V7Z"
        fill="#D94C3C"
      />

      {/* Moche Wave Anchor (Gold & Sand) */}
      <path
        d="M13 27C15.5 24.5 18 25.5 20.5 24C23 22.5 25 24 27 26.5"
        stroke="#D9B66F"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Small Core Origin Point */}
      <circle cx="20" cy="18" r="2" fill="#FFFFFF" />
    </svg>
  );

  if (variant === 'isotipo') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        {IsotipoSVG}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {IsotipoSVG}
      <div className="flex flex-col leading-none">
        <div className={`font-display font-extrabold tracking-tight ${dimensions.text}`}>
          <span className={isDark ? 'text-white' : 'text-[#263B35]'}>RIY</span>
          <span className="text-[#E85B49]">MO</span>
        </div>
        {showSubtitle && (
          <span
            className={`font-sans tracking-widest uppercase font-semibold mt-0.5 ${dimensions.sub} ${
              isDark ? 'text-slate-400' : 'text-[#64748B]'
            }`}
          >
            Explora Perú
          </span>
        )}
      </div>
    </div>
  );
};
