// ---------------------------------------------------------------------------
// Nexis - Achievement / Legacy Category Icons
//
// One glyph per achievement tracker category, plus the honor and medal marks.
// See iconBase.tsx for the shared design language (24x24 viewBox,
// currentColor strokes, amber accent).
// ---------------------------------------------------------------------------

import { ICON_ACCENT, IconBase, type IconComponent, type IconProps } from "./iconBase";

/** Attacking / Combat - a shield with a blade passing behind. */
export function CategoryCombatIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.2 4.2 L8.2 8.2 M15.8 15.8 L19.8 19.8" />
      <path d="M12 5 L17.5 7 V11.5 C17.5 15.5 15.2 18.3 12 19.5 C8.8 18.3 6.5 15.5 6.5 11.5 V7 Z" />
      <circle cx="12" cy="11.5" r="1.2" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Weapons - an oiled sword, point up. */
export function CategoryWeaponsIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 2.6 L13.4 5 V15.5 H10.6 V5 Z" />
      <path d="M7.5 15.5 H16.5" />
      <path d="M12 15.5 V19" />
      <circle cx="12" cy="20.2" r="1.2" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Education - quill and inkwell, ink still wet. */
export function CategoryEducationIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="5" y="16.4" width="6" height="4.2" rx="0.8" />
      <path d="M4.2 16.4 H12" />
      <path d="M6.2 18.3 H9.8" stroke={accent} strokeWidth={1.6} />
      <path d="M19.6 4.4 C15 6 10.6 11 8.4 16.2" />
      <path d="M19.6 4.4 C18.2 9 14.4 13.2 8.4 16.2" />
    </IconBase>
  );
}

/** Travel - a wagon wheel, spokes true. */
export function CategoryTravelIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  const spokes = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8" />
      {spokes.map((angle) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <line
            key={angle}
            x1={12 + 2.3 * Math.cos(rad)}
            y1={12 + 2.3 * Math.sin(rad)}
            x2={12 + 7.7 * Math.cos(rad)}
            y2={12 + 7.7 * Math.sin(rad)}
            strokeWidth={1.2}
          />
        );
      })}
      <circle cx="12" cy="12" r="2.3" strokeWidth={1.1} />
      <circle cx="12" cy="12" r="1.2" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Exploration / Discoveries - a surveyor's spyglass catching light. */
export function CategoryDiscoveriesIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="9.6" cy="9.6" r="5.2" />
      <path d="M13.4 13.4 L19.4 19.4" strokeWidth={1.8} />
      <circle cx="9.6" cy="9.6" r="1.2" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Economy / Market - stacked coin and a standing mark. */
export function CategoryEconomyIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="16.6" cy="8.6" r="4.7" />
      <path d="M16.6 6.7 L18.2 8.6 L16.6 10.5 L15 8.6 Z" fill={accent} stroke="none" />
      <ellipse cx="9" cy="15.2" rx="5.6" ry="2.1" />
      <path d="M3.4 15.2 V18.3 A5.6 2.1 0 0 0 14.6 18.3 V15.2" />
    </IconBase>
  );
}

/** Items / Crafting - the forge hammer at rest. */
export function CategoryCraftingIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 20.9 L12.9 13" strokeWidth={1.8} />
      <path d="M10.8 10.9 L15.1 6.6 L18.4 9.9 L14.1 14.2 Z" />
      <path d="M19.6 5.4 L21.2 3.8 M20.6 8.6 L22.2 8.2" stroke={accent} />
    </IconBase>
  );
}

/** Guild / Consortium - two rings bound in compact. */
export function CategoryOrgIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="8.9" cy="12" r="5.1" />
      <circle cx="15.1" cy="12" r="5.1" />
      <circle cx="12" cy="12" r="1.2" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Contracts / Quests - a sealed writ. */
export function CategoryContractsIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 3.4 H14.8 L18 6.6 V20.6 H6 Z" />
      <path d="M14.8 3.4 V6.6 H18" strokeWidth={1.1} />
      <path d="M8.4 10.2 H15.6 M8.4 12.8 H13.8" strokeWidth={1.1} />
      <circle cx="10.2" cy="16.6" r="1.9" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Commitment / Time - the hourglass, sand falling. */
export function CategoryTimeIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6.6 3.4 H17.4 M6.6 20.6 H17.4" />
      <path d="M8.2 3.4 C8.2 8 10.6 9.6 12 12 C13.4 9.6 15.8 8 15.8 3.4" />
      <path d="M8.2 20.6 C8.2 16 10.6 14.4 12 12 C13.4 14.4 15.8 16 15.8 20.6" />
      <path d="M10 20.6 C10.6 18.7 11.5 17.7 12 17.2 C12.5 17.7 13.4 18.7 14 20.6 Z" fill={accent} stroke="none" />
      <circle cx="12" cy="14.6" r="0.55" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Miscellaneous - a sundries pouch, drawn tight. */
export function CategoryMiscIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9.4 9.6 C5.9 11.6 4.7 15.1 6.1 17.9 C7.5 20.7 16.5 20.7 17.9 17.9 C19.3 15.1 18.1 11.6 14.6 9.6" />
      <path d="M9.4 9.6 C10.4 8.8 13.6 8.8 14.6 9.6" />
      <path d="M9.4 9.6 L8.5 7.4 M14.6 9.6 L15.5 7.4" strokeWidth={1.1} />
      <circle cx="12" cy="9.1" r="1" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Honor - the laurel and the star it circles. */
export function HonorIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 20.6 C7 20.1 3.9 15.6 4.4 10" />
      <path d="M12 20.6 C17 20.1 20.1 15.6 19.6 10" />
      <path d="M5.2 14.9 L3.3 15.7 M4.5 12.1 L2.6 12.2 M5 9.2 L3.5 8" strokeWidth={1.1} />
      <path d="M18.8 14.9 L20.7 15.7 M19.5 12.1 L21.4 12.2 M19 9.2 L20.5 8" strokeWidth={1.1} />
      <path d="M12 6.4 L12.9 8.4 L14.9 9.3 L12.9 10.2 L12 12.2 L11.1 10.2 L9.1 9.3 L11.1 8.4 Z" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Medal - ribbon and disc, pinned for service. */
export function MedalIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8.7 3.4 L11.2 10.4 M15.3 3.4 L12.8 10.4" />
      <circle cx="12" cy="14.7" r="4.5" />
      <circle cx="12" cy="14.7" r="1.6" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Category icons keyed by tracker category id. */
export const CATEGORY_ICONS: Record<string, IconComponent> = {
  combat: CategoryCombatIcon,
  weapons: CategoryWeaponsIcon,
  education: CategoryEducationIcon,
  travel: CategoryTravelIcon,
  discoveries: CategoryDiscoveriesIcon,
  economy: CategoryEconomyIcon,
  crafting: CategoryCraftingIcon,
  org: CategoryOrgIcon,
  contracts: CategoryContractsIcon,
  time: CategoryTimeIcon,
  misc: CategoryMiscIcon,
  honor: HonorIcon,
  medal: MedalIcon,
};
