// ---------------------------------------------------------------------------
// Nexis - Stat & Resource Icons
//
// Vital-reserve and currency glyphs. See iconBase.tsx for the shared design
// language (24x24 viewBox, currentColor strokes, amber accent).
// ---------------------------------------------------------------------------

import { ICON_ACCENT, IconBase, type IconComponent, type IconProps } from "./iconBase";

/** Energy - a stormbolt, charged. */
export function EnergyIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M13.5 2.5 L6 13.5 H11 L9.5 21.5 L18 10 H12.8 Z" fill={accent} fillOpacity={0.22} />
    </IconBase>
  );
}

/** Health - a steady heart. */
export function HealthIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path
        d="M12 20 C5.5 15.5 3.5 11.5 4.5 8 C5.5 4.8 10 4 12 7.5 C14 4 18.5 4.8 19.5 8 C20.5 11.5 18.5 15.5 12 20 Z"
        fill={accent}
        fillOpacity={0.22}
      />
    </IconBase>
  );
}

/** Stamina - a road boot at speed. */
export function StaminaIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7.2 3.8 H12.2 V11.6 L17.9 14.5 C19.5 15.3 19.3 17.6 17.5 17.6 H7.2 Z" />
      <path d="M7.2 6.4 H12.2" strokeWidth={1.1} />
      <path d="M3 7.6 H5.4 M2.4 11.2 H4.8 M3 14.8 H5.2" stroke={accent} />
    </IconBase>
  );
}

/** Comfort - a warm tankard, still steaming. */
export function ComfortIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6.2 9.8 H15.8 V18.8 C15.8 19.8 15 20.4 14 20.4 H8 C7 20.4 6.2 19.8 6.2 18.8 Z" />
      <path d="M15.8 11.8 H16.9 C18.8 11.8 18.8 16.4 16.9 16.4 H15.8" />
      <path d="M9 7.4 C8.5 6.4 9.5 5.7 9 4.4 M12.8 7.4 C12.3 6.4 13.3 5.7 12.8 4.4" stroke={accent} />
    </IconBase>
  );
}

/** Mana - a faceted arcane crystal. */
export function ManaIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3.2 L18.4 9.6 L12 20.8 L5.6 9.6 Z" />
      <path d="M5.6 9.6 H18.4 M12 3.2 V20.8" strokeWidth={1.1} />
      <path d="M12 7.4 L14.4 9.6 L12 13.4 L9.6 9.6 Z" fill={accent} fillOpacity={0.28} stroke="none" />
    </IconBase>
  );
}

/** Nerve - the gambler's die. */
export function NerveIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4.7" y="4.7" width="14.6" height="14.6" rx="2.8" />
      <circle cx="8.6" cy="8.6" r="1.1" fill={accent} stroke="none" />
      <circle cx="15.4" cy="8.6" r="1.1" fill={accent} stroke="none" />
      <circle cx="12" cy="12" r="1.1" fill={accent} stroke="none" />
      <circle cx="8.6" cy="15.4" r="1.1" fill={accent} stroke="none" />
      <circle cx="15.4" cy="15.4" r="1.1" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Gold - a minted coin bearing the realm's mark. */
export function GoldIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="5.3" strokeWidth={1.1} />
      <path d="M12 9.3 L14.3 12 L12 14.7 L9.7 12 Z" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Shadow - a waning moon and a distant spark. */
export function ShadowIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14.6 3.4 C9 4.6 5.4 9.4 6.4 14.9 C7.2 19.2 10.8 21.4 14.6 20.8 C11.2 18.6 9.4 14.8 10.2 10.4 C10.8 7.4 12.4 4.9 14.6 3.4 Z" />
      <path d="M17.6 5.5 L18.2 6.5 L19.2 7.1 L18.2 7.7 L17.6 8.7 L17 7.7 L16 7.1 L17 6.5 Z" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Level - rank chevrons, earned one at a time. */
export function LevelIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 19 L12 14.6 L18 19" />
      <path d="M6 13.8 L12 9.4 L18 13.8" />
      <path d="M6 8.6 L12 4.2 L18 8.6" stroke={accent} />
    </IconBase>
  );
}

/** Experience - the four-point spark of hard lessons. */
export function ExperienceIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3 L13.7 10.3 L21 12 L13.7 13.7 L12 21 L10.3 13.7 L3 12 L10.3 10.3 Z" />
      <circle cx="12" cy="12" r="1.3" fill={accent} stroke="none" />
    </IconBase>
  );
}

/** Stat icons keyed by stat id. */
export const STAT_ICONS: Record<string, IconComponent> = {
  energy: EnergyIcon,
  health: HealthIcon,
  stamina: StaminaIcon,
  comfort: ComfortIcon,
  nerve: NerveIcon,
  mana: ManaIcon,
  gold: GoldIcon,
  shadow: ShadowIcon,
  level: LevelIcon,
  experience: ExperienceIcon,
};
