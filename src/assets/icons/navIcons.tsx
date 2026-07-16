// ---------------------------------------------------------------------------
// Nexis - Navigation Icons
//
// One original line-art glyph per nav destination. See iconBase.tsx for the
// shared design language (24x24 viewBox, currentColor strokes, amber accent).
// ---------------------------------------------------------------------------

import { ICON_ACCENT, IconBase, type IconComponent, type IconProps } from "./iconBase";

/** Home - a hearth-lit cottage with a warded window. */
export function HomeIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3.2 11.2 L12 3.6 L20.8 11.2" />
      <path d="M5.4 12.6 V20.4 H18.6 V12.6" />
      <path d="M10 20.4 V16.2 C10 14.2 14 14.2 14 16.2 V20.4" />
      <path d="M12 6.9 L13.5 8.4 L12 9.9 L10.5 8.4 Z" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Profile - a citizen bust with a cloak clasp. */
export function ProfileIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="7.8" r="3.4" />
      <path d="M5.4 20.2 C5.4 15.6 8.4 13.4 12 13.4 C15.6 13.4 18.6 15.6 18.6 20.2" />
      <circle cx="12" cy="16.4" r="1" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Life Paths - one road forking toward two futures, waystone at the base. */
export function LifePathsIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 21 V13.4" />
      <path d="M12 13.4 C12 10.4 8.4 10 6.6 6.8" />
      <path d="M6 10 L6.6 6.8 L9.8 7.5" />
      <path d="M12 13.4 C12 10.4 15.6 10 17.4 6.8" />
      <path d="M18 10 L17.4 6.8 L14.2 7.5" />
      <circle cx="12" cy="21" r="1.2" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Inventory - a traveler's satchel with a buckled flap. */
export function InventoryIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4.6" y="9.6" width="14.8" height="9.6" rx="2" />
      <path d="M4.6 13.9 H19.4" />
      <path d="M9.2 9.6 V8.2 C9.2 6.6 14.8 6.6 14.8 8.2 V9.6" />
      <circle cx="12" cy="16.3" r="1.2" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Crafting - a smith's anvil, struck and sparking. */
export function CraftingIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3.2 11.4 L7.6 9.6 H17.2 V11.4 H14.4 L15.6 16.6 H8.4 L9.6 11.4 Z" />
      <path d="M6 18.6 H18" />
      <path d="M18.4 6.2 L19.7 4.5 M18.4 6.2 L20.4 6.6" stroke={accent} strokeWidth={1.6} />
      <circle cx="17.4" cy="8.2" r="1.1" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Education - an open study book with a ribbon marker. */
export function EducationIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 6.8 V19.2" />
      <path d="M12 6.8 C10 5.2 6.8 4.8 3.6 5.4 V17.6 C6.8 17 10 17.4 12 19.2" />
      <path d="M12 6.8 C14 5.2 17.2 4.8 20.4 5.4 V17.6 C17.2 17 14 17.4 12 19.2" />
      <path d="M14.6 5.3 V9.6 L15.7 8.7 L16.8 9.6 V5.5 Z" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Skills - a practice target with an arrow set in the mark. */
export function SkillsIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="13.4" r="6.9" />
      <circle cx="11" cy="13.4" r="3.1" />
      <circle cx="11" cy="13.4" r="1.2" fill={accent} stroke="none" />
      <path d="M21.3 3.1 L11.8 12.6" />
      <path d="M18.6 3 L21.3 3.1 L21.4 5.8" />
    </IconBase>
  );
}

/** Adventure - a field map, route dotted, objective marked. */
export function AdventureIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4.6" y="5.4" width="14.8" height="13.2" rx="1.2" />
      <path d="M7.6 16.2 C9.6 12.2 12.2 14.6 14 10.6" strokeWidth={1.6} strokeDasharray="0.1 2.6" />
      <path d="M15.4 7.2 L17.8 9.6 M17.8 7.2 L15.4 9.6" stroke={accent} strokeWidth={1.6} />
    </IconBase>
  );
}

/** Housing - an arched, hinged door with a brass handle. */
export function HousingIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6.6 20.6 V10.6 C6.6 6.4 9.2 4.4 12 4.4 C14.8 4.4 17.4 6.4 17.4 10.6 V20.6" />
      <path d="M4.4 20.6 H19.6" />
      <path d="M6.6 9.4 H8.8 M6.6 14.2 H8.8" strokeWidth={1.1} />
      <circle cx="14.9" cy="13" r="1.1" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** City - a crenellated gate wall with a pennant over the arch. */
export function CityIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 20.5 V6.2 H5.8 V4.4 H7.6 V6.2 H9.4 V11.2" />
      <path d="M20 20.5 V6.2 H18.2 V4.4 H16.4 V6.2 H14.6 V11.2" />
      <path d="M9.4 11.2 H14.6" />
      <path d="M9.6 20.5 V15.4 C9.6 12.6 14.4 12.6 14.4 15.4 V20.5" />
      <path d="M11.2 11.2 V12.6 L12 12.1 L12.8 12.6 V11.2 Z" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Civic Jobs - a laborer's barrow, loaded for the day's work. */
export function CivicJobsIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.6 9.8 H17 L15.4 14.8 H7.2 Z" />
      <path d="M17 9.8 L20.8 8.6" />
      <circle cx="8.6" cy="18" r="2.4" />
      <path d="M8.2 14.8 L8.6 15.6" />
      <path d="M14.6 14.8 L15.8 18.8" />
      <path d="M7.4 9.8 C8.6 7.2 13 7.2 14.2 9.8 Z" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Travel - a crossroads signpost with opposing waymarks. */
export function TravelIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 21 V3.6" />
      <path d="M8.6 21 H15.4" />
      <path d="M12 5.4 H17.8 L20.2 7.2 L17.8 9 H12 Z" />
      <path d="M12 10.8 H7 L4.6 12.6 L7 14.4 H12 Z" />
      <circle cx="12" cy="2.9" r="1" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** World Map - a tri-fold atlas sheet with a marked position. */
export function WorldMapIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3.8 6 L9.3 4.4 L14.7 6 L20.2 4.4 V18 L14.7 19.6 L9.3 18 L3.8 19.6 Z" />
      <path d="M9.3 4.4 V18 M14.7 6 V19.6" strokeWidth={1.1} />
      <circle cx="12" cy="10.6" r="1.5" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Codex - a clasped tome with a cover boss. */
export function CodexIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4.8" y="3.6" width="14.4" height="16.8" rx="1.6" />
      <path d="M8 3.6 V20.4" />
      <path d="M19.2 10.6 H20.8 V13.4 H19.2" strokeWidth={1.1} />
      <path d="M13.6 9.9 L15.5 12 L13.6 14.1 L11.7 12 Z" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Arena - crossed dueling swords. */
export function ArenaIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 4.6 L16.1 15.7 M14.5 17.3 L17.7 14.1 M16.1 15.7 L18.4 18" />
      <path d="M19 4.6 L7.9 15.7 M6.3 14.1 L9.5 17.3 M7.9 15.7 L5.6 18" />
      <circle cx="19.2" cy="18.8" r="1" fill={accent} stroke="none" />
      <circle cx="4.8" cy="18.8" r="1" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** City Board - a public noticeboard with a pinned bill. */
export function CityBoardIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="4.8" width="16" height="11" rx="1" />
      <path d="M7.6 15.8 V20.6 M16.4 15.8 V20.6" />
      <rect x="6.8" y="7.2" width="4.8" height="6" strokeWidth={1.1} />
      <path d="M13.8 8.8 H17.2 M13.8 11.2 H16.4" strokeWidth={1.1} />
      <circle cx="9.2" cy="7.2" r="0.9" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Salvage Yard - a cracked cog stripped for parts. */
export function SalvageYardIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12.6" r="5" />
      {teeth.map((angle) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <line
            key={angle}
            x1={12 + 5 * Math.cos(rad)}
            y1={12.6 + 5 * Math.sin(rad)}
            x2={12 + 6.9 * Math.cos(rad)}
            y2={12.6 + 6.9 * Math.sin(rad)}
          />
        );
      })}
      <circle cx="12" cy="12.6" r="1.7" strokeWidth={1.1} />
      <path d="M13.4 8 L11.2 12 L13.2 12.9 L11 16.9" stroke={accent} strokeWidth={1.4} fill="none" />
    </IconBase>
  );
}

/** Hospital - an apothecary's mortar and pestle. */
export function HospitalIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.8 10.6 H19.2 C19.2 14.8 16.2 17.4 12 17.4 C7.8 17.4 4.8 14.8 4.8 10.6 Z" />
      <path d="M12 17.4 V19" />
      <path d="M9 20.6 H15" />
      <path d="M16.2 3.4 L11 10.6" strokeWidth={2.2} />
      <circle cx="16.8" cy="2.7" r="1.2" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Guilds - a rallying pennant on its standard pole. */
export function GuildsIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6.4 21 V3" />
      <path d="M6.4 4.2 H18.2 L15.4 7.6 L18.2 11 H6.4 Z" />
      <path d="M4.4 21 H8.4" />
      <circle cx="10.6" cy="7.6" r="1.2" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Consortiums - a merchant's balance, weighed and level. */
export function ConsortiumsIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3.4 V18.6" />
      <path d="M4.6 6.2 H19.4" />
      <path d="M4.6 6.2 L2.9 10.6 M4.6 6.2 L6.3 10.6" strokeWidth={1.1} />
      <path d="M2.5 10.7 C2.9 12.9 6.3 12.9 6.7 10.7" />
      <path d="M19.4 6.2 L17.7 10.6 M19.4 6.2 L21.1 10.6" strokeWidth={1.1} />
      <path d="M17.3 10.7 C17.7 12.9 21.1 12.9 21.5 10.7" />
      <path d="M8.8 20.8 H15.2 M10.4 18.6 L9.4 20.8 M13.6 18.6 L14.6 20.8" />
      <circle cx="12" cy="2.8" r="1" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Admin - the warden's master key. */
export function AdminIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="7" cy="12" r="3.6" />
      <path d="M10.6 12 H20.6" />
      <path d="M17.2 12 V15.3 M20 12 V14.5" />
      <path d="M7 10.2 L8.6 12 L7 13.8 L5.4 12 Z" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Nav icons keyed by destination id (matches route naming). */
export const NAV_ICONS: Record<string, IconComponent> = {
  home: HomeIcon,
  profile: ProfileIcon,
  "life-paths": LifePathsIcon,
  inventory: InventoryIcon,
  crafting: CraftingIcon,
  education: EducationIcon,
  skills: SkillsIcon,
  adventure: AdventureIcon,
  housing: HousingIcon,
  city: CityIcon,
  "civic-jobs": CivicJobsIcon,
  travel: TravelIcon,
  "world-map": WorldMapIcon,
  codex: CodexIcon,
  arena: ArenaIcon,
  "city-board": CityBoardIcon,
  "salvage-yard": SalvageYardIcon,
  hospital: HospitalIcon,
  guilds: GuildsIcon,
  consortiums: ConsortiumsIcon,
  admin: AdminIcon,
};
