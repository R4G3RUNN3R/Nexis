// ---------------------------------------------------------------------------
// Nexis - Atlas & Map Marker Icons
//
// Glyphs for the world atlas: settlement pins, hidden and rumored sites,
// corridors, and discovery. See iconBase.tsx for the shared design language
// (24x24 viewBox, currentColor strokes, amber accent).
// ---------------------------------------------------------------------------

import { ICON_ACCENT, IconBase, type IconComponent, type IconProps } from "./iconBase";

/** City pin - a charted settlement. */
export function CityPinIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 21.2 C7.6 15.9 5.4 12.6 5.4 9.4 C5.4 5.5 8.3 2.8 12 2.8 C15.7 2.8 18.6 5.5 18.6 9.4 C18.6 12.6 16.4 15.9 12 21.2 Z" />
      <circle cx="12" cy="9.4" r="2.2" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Capital pin - a crowned seat of power. */
export function CapitalPinIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 21.2 C7.6 15.9 5.4 12.6 5.4 9.4 C5.4 5.5 8.3 2.8 12 2.8 C15.7 2.8 18.6 5.5 18.6 9.4 C18.6 12.6 16.4 15.9 12 21.2 Z" />
      <path d="M8.9 11.6 V8.3 L10.9 9.8 L12 7.4 L13.1 9.8 L15.1 8.3 V11.6 Z" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Hidden site - a veiled marker, half-charted. */
export function HiddenSiteIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3.4 L20.6 12 L12 20.6 L3.4 12 Z" strokeDasharray="2.6 2.3" />
      <circle cx="12" cy="12" r="1.5" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Rumored site - tavern talk, unverified. */
export function RumoredSiteIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.6" strokeDasharray="3 2.7" />
      <path d="M9.4 9.2 C9.4 5.9 14.6 5.9 14.6 9.2 C14.6 11.6 12 11.3 12 13.9" />
      <circle cx="12" cy="17.2" r="1.15" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Route - a known corridor between two anchors. */
export function RouteIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="4.8" cy="17.2" r="1.9" />
      <path d="M7.3 15 C10.2 12.7 13.8 11.3 16.9 8.9" strokeDasharray="2.6 2.5" />
      <circle cx="19.2" cy="6.8" r="1.9" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Discovery - the surveyor's compass, needle set north. */
export function DiscoveryIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 4.9 L14 12 L12 19.1 L10 12 Z" />
      <path d="M12 4.9 L14 12 H10 Z" fill={accent} stroke="none" />
      <path d="M4.9 12 H6.7 M17.3 12 H19.1" strokeWidth={1.1} />
    </IconBase>
  );
}

/** Map icons keyed by marker id. */
export const MAP_ICONS: Record<string, IconComponent> = {
  city: CityPinIcon,
  capital: CapitalPinIcon,
  hidden: HiddenSiteIcon,
  rumored: RumoredSiteIcon,
  route: RouteIcon,
  discovery: DiscoveryIcon,
};
