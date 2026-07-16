// ---------------------------------------------------------------------------
// Nexis - Guild / Consortium / Adventure Icons
//
// Order-hall glyphs: banners, seals, holdings, and the places contracts lead.
// See iconBase.tsx for the shared design language (24x24 viewBox,
// currentColor strokes, amber accent).
// ---------------------------------------------------------------------------

import { ICON_ACCENT, IconBase, type IconComponent, type IconProps } from "./iconBase";

/** Guild banner - a hall standard hung from its rod. */
export function GuildBannerIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.5 4.5 H19.5" />
      <path d="M6.5 4.5 V18 L12 15 L17.5 18 V4.5" />
      <path d="M12 7.6 L13.8 9.5 L12 11.4 L10.2 9.5 Z" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Consortium seal - a milled medallion, notched like struck wax. */
export function ConsortiumSealIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  const notches = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324];
  return (
    <IconBase {...props}>
      <circle cx="12" cy="9.8" r="5" />
      {notches.map((angle) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <line
            key={angle}
            x1={12 + 5 * Math.cos(rad)}
            y1={9.8 + 5 * Math.sin(rad)}
            x2={12 + 6.6 * Math.cos(rad)}
            y2={9.8 + 6.6 * Math.sin(rad)}
          />
        );
      })}
      <circle cx="12" cy="9.8" r="1.7" fill={accent} stroke="none" />
      <path d="M9.6 14.3 L8.4 20.4 M14.4 14.3 L15.6 20.4" strokeWidth={1.8} />
    </IconBase>
  );
}

/** Treasury - the strongbox, banded and locked. */
export function TreasuryIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 11.2 V9.8 C4 6.8 7.2 5.2 12 5.2 C16.8 5.2 20 6.8 20 9.8 V11.2" />
      <path d="M4 11.2 H20 V17.6 C20 18.7 19.1 19.4 18 19.4 H6 C4.9 19.4 4 18.7 4 17.6 Z" />
      <path d="M8 11.2 V19.4 M16 11.2 V19.4" strokeWidth={1.1} />
      <rect x="10.8" y="11.2" width="2.4" height="3.2" rx="0.5" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Armory - a great helm, slit and ridged. */
export function ArmoryIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6.6 20.6 V10.2 C6.6 5.8 9 3.4 12 3.4 C15 3.4 17.4 5.8 17.4 10.2 V20.6 Z" />
      <path d="M12 3.4 V10.4" />
      <path d="M7.4 10.4 H16.6" stroke={accent} strokeWidth={1.8} />
      <path d="M10.4 14.6 V16.2 M13.6 14.6 V16.2" strokeWidth={1.1} />
    </IconBase>
  );
}

/** Quest - a torch carried into the unknown. */
export function QuestIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 20.9 V12.2" />
      <path d="M9.3 9.2 H14.7 L14 12.2 H10 Z" />
      <path d="M12 2.4 C10.4 4.4 9.6 5.9 10.4 7.5 C10.9 8.5 13.1 8.5 13.6 7.5 C14.4 5.9 13.6 4.4 12 2.4 Z" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Dungeon - the portcullis gate below the keep. */
export function DungeonIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.6 20.6 V11 C4.6 6 8.6 3.4 12 3.4 C15.4 3.4 19.4 6 19.4 11 V20.6" />
      <path d="M8.4 6.1 V20.6 M12 4.9 V20.6 M15.6 6.1 V20.6" strokeWidth={1.1} />
      <path d="M4.6 13.6 H19.4" stroke={accent} />
    </IconBase>
  );
}

/** Skill node - a talent hex and the branches it feeds. */
export function SkillNodeIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 7.4 L16 9.7 V14.3 L12 16.6 L8 14.3 V9.7 Z" />
      <path d="M12 7.4 V4.2 M16 14.3 L18.8 15.9 M8 14.3 L5.2 15.9" strokeWidth={1.1} />
      <circle cx="12" cy="3.1" r="1.05" strokeWidth={1.1} />
      <circle cx="19.8" cy="16.5" r="1.05" strokeWidth={1.1} />
      <circle cx="4.2" cy="16.5" r="1.05" strokeWidth={1.1} />
      <circle cx="12" cy="12" r="1.6" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Org icons keyed by glyph id. */
export const ORG_ICONS: Record<string, IconComponent> = {
  "guild-banner": GuildBannerIcon,
  "consortium-seal": ConsortiumSealIcon,
  treasury: TreasuryIcon,
  armory: ArmoryIcon,
  quest: QuestIcon,
  dungeon: DungeonIcon,
  "skill-node": SkillNodeIcon,
};
