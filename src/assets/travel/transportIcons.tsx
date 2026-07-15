// ---------------------------------------------------------------------------
// Nexis - Travel Transport Icons
//
// Original, hand-authored SVG silhouettes for each server-defined transport
// tier (see server/data/transportData.js). Simple geometric / line-art icon
// style ("elegant icon", not detailed illustration) rendered in the Ashen
// Crown amber palette so they sit naturally on the dark travel splash.
//
// These are NOT derived from, traced over, or referencing any third-party
// game's art (Torn or otherwise) - every path below was composed directly
// as basic shapes for this project.
//
// Convention note: this project stores bitmap art under src/assets/<area>/
// and imports it as a module (see src/assets/maps/nexis-world-map-expanded.jpg
// used by src/pages/Travel.tsx). There is no SVG-to-component loader wired
// into vite.config.ts (no vite-plugin-svgr), so importing a raw .svg file
// here would only yield a URL, not a themeable inline element. To keep these
// icons crisp at any size and recolorable via the theme, they are authored
// as small inline-SVG React components and kept under this same
// src/assets/travel/ directory, matching the project's "assets live under
// src/assets/<area>/" convention as closely as the toolchain allows.
// ---------------------------------------------------------------------------

import type { SVGProps } from "react";

const INK = "#0b0908";
const GOLD = "#d89a47";
const GOLD_SOFT = "#c78a3c";
const GOLD_LIGHT = "#f2cf95";
const GROUND = "rgba(216, 154, 71, 0.28)";

export type TransportIconId =
  | "foot"
  | "donkey"
  | "riding_horse"
  | "cart"
  | "caravan"
  | "wagon"
  | "ship"
  | "unknown";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Frame({ title, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

function GroundLine() {
  return <line x1="6" y1="52" x2="58" y2="52" stroke={GROUND} strokeWidth="2" strokeLinecap="round" />;
}

/** On Foot - a cloaked wanderer mid-stride, leaning on a walking staff. */
export function FootIcon(props: IconProps) {
  return (
    <Frame title="On Foot" {...props}>
      <GroundLine />
      <circle cx="27" cy="15" r="4.2" fill={GOLD_LIGHT} />
      <path d="M22 20 L32 20 L36 46 L27 46 L23 34 L19 46 L13 46 Z" fill={GOLD} />
      <path d="M32 20 L36 46" stroke={INK} strokeWidth="0.6" opacity="0.4" />
      <line x1="37" y1="23" x2="48" y2="50" stroke={GOLD_SOFT} strokeWidth="2.4" strokeLinecap="round" />
      <line x1="37" y1="23" x2="43" y2="19" stroke={GOLD_SOFT} strokeWidth="2.4" strokeLinecap="round" />
    </Frame>
  );
}

/** Donkey - small pack animal, long ears, saddle bags. */
export function DonkeyIcon(props: IconProps) {
  return (
    <Frame title="Donkey" {...props}>
      <GroundLine />
      <path d="M16 44 L16 34 L20 24 L30 22 L38 26 L40 34 L40 44" fill="none" />
      <ellipse cx="27" cy="36" rx="13" ry="8" fill={GOLD} />
      <rect x="20" y="30" width="9" height="8" rx="1.5" fill={GOLD_SOFT} />
      <path d="M38 30 C43 28 45 22 44 17 C42 19 39 21 36 24 Z" fill={GOLD} />
      <path d="M43 18 L48 14" stroke={GOLD} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M40 16 L44 11" stroke={GOLD} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M16 44 L14 52 M22 44 L21 52 M32 44 L33 52 M38 44 L40 52" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />
      <path d="M14 34 L8 38" stroke={GOLD_SOFT} strokeWidth="2.6" strokeLinecap="round" />
    </Frame>
  );
}

/** Riding Horse - taller mount, raised foreleg, flowing mane and tail. */
export function HorseIcon(props: IconProps) {
  return (
    <Frame title="Riding Horse" {...props}>
      <GroundLine />
      <ellipse cx="28" cy="32" rx="15" ry="8.5" fill={GOLD} />
      <path d="M40 26 C46 22 48 14 45 8 C42 11 38 15 34 20 Z" fill={GOLD} />
      <path d="M45 9 C41 10 38 13 36 16" stroke={GOLD_LIGHT} strokeWidth="1.6" fill="none" opacity="0.7" />
      <path d="M14 30 C9 29 6 32 5 36 C9 35 12 34 16 34 Z" fill={GOLD_SOFT} />
      <path d="M18 40 L14 52 M25 40 L22 52" stroke={GOLD} strokeWidth="3.2" strokeLinecap="round" />
      <path d="M33 40 L37 48 L42 44" stroke={GOLD} strokeWidth="3.2" strokeLinecap="round" fill="none" />
      <path d="M38 39 L44 46" stroke={GOLD} strokeWidth="3.2" strokeLinecap="round" />
    </Frame>
  );
}

/** Cart - light two-wheeled hauler, no draft animal shown. */
export function CartIcon(props: IconProps) {
  return (
    <Frame title="Cart" {...props}>
      <GroundLine />
      <rect x="14" y="24" width="30" height="14" rx="1.5" fill={GOLD} />
      <path d="M44 28 L54 20" stroke={GOLD_SOFT} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="22" cy="44" r="8" fill="none" stroke={GOLD} strokeWidth="2.6" />
      <circle cx="22" cy="44" r="1.6" fill={GOLD_LIGHT} />
      <circle cx="38" cy="44" r="8" fill="none" stroke={GOLD} strokeWidth="2.6" />
      <circle cx="38" cy="44" r="1.6" fill={GOLD_LIGHT} />
      {[0, 45, 90, 135].map((angle) => (
        <line
          key={`w1-${angle}`}
          x1={22 - 6 * Math.cos((angle * Math.PI) / 180)}
          y1={44 - 6 * Math.sin((angle * Math.PI) / 180)}
          x2={22 + 6 * Math.cos((angle * Math.PI) / 180)}
          y2={44 + 6 * Math.sin((angle * Math.PI) / 180)}
          stroke={GOLD}
          strokeWidth="1.3"
        />
      ))}
      {[0, 45, 90, 135].map((angle) => (
        <line
          key={`w2-${angle}`}
          x1={38 - 6 * Math.cos((angle * Math.PI) / 180)}
          y1={44 - 6 * Math.sin((angle * Math.PI) / 180)}
          x2={38 + 6 * Math.cos((angle * Math.PI) / 180)}
          y2={44 + 6 * Math.sin((angle * Math.PI) / 180)}
          stroke={GOLD}
          strokeWidth="1.3"
        />
      ))}
    </Frame>
  );
}

/** Caravan - the standard hired covered wagon (default transport). */
export function CaravanIcon(props: IconProps) {
  return (
    <Frame title="Caravan" {...props}>
      <GroundLine />
      <rect x="12" y="30" width="32" height="12" rx="1.5" fill={GOLD_SOFT} />
      <path
        d="M12 30 C12 18 44 18 44 30 Z"
        fill="none"
        stroke={GOLD}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path d="M18 30 C18 22 38 22 38 30" fill="none" stroke={GOLD_LIGHT} strokeWidth="1.2" opacity="0.6" />
      <path d="M44 34 L52 27" stroke={GOLD_SOFT} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="20" cy="46" r="6.5" fill="none" stroke={GOLD} strokeWidth="2.4" />
      <circle cx="36" cy="46" r="6.5" fill="none" stroke={GOLD} strokeWidth="2.4" />
      <circle cx="20" cy="46" r="1.4" fill={GOLD_LIGHT} />
      <circle cx="36" cy="46" r="1.4" fill={GOLD_LIGHT} />
    </Frame>
  );
}

/** Wagon - heavier freight vehicle, four wheels, stacked cargo. */
export function WagonIcon(props: IconProps) {
  return (
    <Frame title="Wagon" {...props}>
      <GroundLine />
      <rect x="8" y="28" width="42" height="12" rx="1.5" fill={GOLD} />
      <rect x="13" y="18" width="9" height="11" fill={GOLD_SOFT} />
      <rect x="24" y="15" width="9" height="14" fill={GOLD_SOFT} />
      <rect x="35" y="19" width="8" height="10" fill={GOLD_SOFT} />
      <path d="M50 32 L58 25" stroke={GOLD_SOFT} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="16" cy="46" r="6" fill="none" stroke={GOLD} strokeWidth="2.4" />
      <circle cx="30" cy="46" r="6" fill="none" stroke={GOLD} strokeWidth="2.4" />
      <circle cx="44" cy="46" r="6" fill="none" stroke={GOLD} strokeWidth="2.4" />
      <circle cx="16" cy="46" r="1.3" fill={GOLD_LIGHT} />
      <circle cx="30" cy="46" r="1.3" fill={GOLD_LIGHT} />
      <circle cx="44" cy="46" r="1.3" fill={GOLD_LIGHT} />
    </Frame>
  );
}

/** Ship - regional water transport, single mast and full sail. */
export function ShipIcon(props: IconProps) {
  return (
    <Frame title="Ship" {...props}>
      <path d="M8 44 C20 50 44 50 56 44 L50 52 L14 52 Z" fill={GOLD} />
      <line x1="30" y1="44" x2="30" y2="10" stroke={GOLD_SOFT} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M31 12 L46 30 L31 32 Z" fill={GOLD_LIGHT} opacity="0.92" />
      <path d="M29 18 L18 32 L29 32 Z" fill={GOLD} opacity="0.85" />
      <path d="M30 10 L36 6" stroke={GOLD_SOFT} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6 48 C10 46 12 50 16 48" stroke={GROUND} strokeWidth="1.6" fill="none" />
      <path d="M46 49 C50 47 52 51 56 49" stroke={GROUND} strokeWidth="1.6" fill="none" />
    </Frame>
  );
}

/** Fallback - a compass rose for any transport id without a dedicated icon. */
export function UnknownTransportIcon(props: IconProps) {
  return (
    <Frame title="Journey" {...props}>
      <circle cx="32" cy="32" r="19" fill="none" stroke={GOLD} strokeWidth="2.2" />
      <path d="M32 14 L36 30 L32 34 L28 30 Z" fill={GOLD_LIGHT} />
      <path d="M32 50 L28 34 L32 30 L36 34 Z" fill={GOLD_SOFT} />
      <path d="M14 32 L30 28 L34 32 L30 36 Z" fill={GOLD_SOFT} />
      <path d="M50 32 L34 36 L30 32 L34 28 Z" fill={GOLD_LIGHT} />
      <circle cx="32" cy="32" r="3" fill={GOLD_LIGHT} />
    </Frame>
  );
}

export const TRANSPORT_ICONS: Record<TransportIconId, (props: IconProps) => JSX.Element> = {
  foot: FootIcon,
  donkey: DonkeyIcon,
  riding_horse: HorseIcon,
  cart: CartIcon,
  caravan: CaravanIcon,
  wagon: WagonIcon,
  ship: ShipIcon,
  unknown: UnknownTransportIcon,
};

export function getTransportIcon(modeId: string | null | undefined) {
  if (modeId && modeId in TRANSPORT_ICONS) {
    return TRANSPORT_ICONS[modeId as TransportIconId];
  }
  return UnknownTransportIcon;
}
