// ---------------------------------------------------------------------------
// Nexis - External Vote-Site Icons
//
// Generic ranking/voting glyphs used to link out to third-party game-listing
// sites (Apex Web Gaming, Top Web Games). These are original shapes in the
// same "engraver's line" language as the rest of the icon set - not traces
// or recreations of either site's actual logo, since neither site publishes
// a required embeddable badge.
// ---------------------------------------------------------------------------

import { ICON_ACCENT, IconBase, type IconProps } from "./iconBase";

/** Ranked ribbon - a vote badge with a starred medallion. */
export function RankedRibbonIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8.4 13.6 L6 20.4 L9.6 19 L12 20.8 L14.4 19 L18 20.4 L15.6 13.6" />
      <circle cx="12" cy="9.6" r="5.4" />
      <path d="M12 6.6 L12.9 8.4 L14.8 8.7 L13.4 10 L13.8 11.9 L12 11 L10.2 11.9 L10.6 10 L9.2 8.7 L11.1 8.4 Z" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Rising ranks - an ascending bar chart with an arrow crest. */
export function RisingRankIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.6 20 H19.4" />
      <path d="M7 20 V14.4" />
      <path d="M11.4 20 V10.6" />
      <path d="M15.8 20 V7.4" />
      <path d="M14.6 5.4 L18.2 4.4 L18.9 8.1" />
      <path d="M14.4 8.4 L18.2 4.4" />
      <circle cx="18.2" cy="4.4" r="1" fill={accent} stroke="none" />
    </IconBase>
  );
}
