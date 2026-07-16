// ---------------------------------------------------------------------------
// Nexis - Player Condition Icons
//
// Status glyphs for the citizen's current condition. See iconBase.tsx for the
// shared design language (24x24 viewBox, currentColor strokes, amber accent).
// ---------------------------------------------------------------------------

import { ICON_ACCENT, IconBase, type IconComponent, type IconProps } from "./iconBase";

/** Normal / Ready - fit for duty, shield checked. */
export function ConditionReadyIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 2.8 L19.6 5.4 V10.8 C19.6 15.9 16.6 19.5 12 21.2 C7.4 19.5 4.4 15.9 4.4 10.8 V5.4 Z" />
      <path d="M8.7 11.7 L11.1 14.1 L15.4 9.4" stroke={accent} strokeWidth={1.8} />
    </IconBase>
  );
}

/** Hospital - laid up in the recovery ward. */
export function ConditionHospitalIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3.4 5.4 V19.2" />
      <path d="M20.6 12.6 V19.2" />
      <path d="M3.4 15.6 H20.6" />
      <path d="M4.6 12.6 C4.6 10.3 8.4 10.3 8.4 12.6" />
      <path d="M8.4 12.6 H20.6" />
      <path d="M16.9 4.6 V7.8 M15.3 6.2 H18.5" stroke={accent} />
    </IconBase>
  );
}

/** Jail - the barred window of a holding cell. */
export function ConditionJailIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="5.4" y="5.4" width="13.2" height="13.2" rx="1" />
      <path d="M9.4 5.4 V18.6 M14.6 5.4 V18.6" />
      <path d="M5.4 12 H18.6" stroke={accent} />
    </IconBase>
  );
}

/** Traveling - underway between waypoints. */
export function ConditionTravelingIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="4.9" cy="18.1" r="1.5" fill={accent} stroke="none" />
      <path d="M7 16.4 C10 14.6 12.8 12.2 15.5 8.9" strokeDasharray="2.4 2.3" />
      <path d="M16.9 7.2 L13.8 8 M16.9 7.2 L16.2 10.3" />
    </IconBase>
  );
}

/** In Combat - steel drawn, sparks flying. */
export function ConditionCombatIcon({ accent = ICON_ACCENT, ...props }: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3.9 20.1 L6 18 M4.2 16.2 L7.8 19.8 M6 18 L15.7 8.3" />
      <path d="M17.9 3.3 V4.9 M20.7 6.1 H19.1 M17.9 8.9 V7.3 M15.1 6.1 H16.7" stroke={accent} />
    </IconBase>
  );
}

/** Condition icons keyed by condition id. */
export const CONDITION_ICONS: Record<string, IconComponent> = {
  normal: ConditionReadyIcon,
  hospital: ConditionHospitalIcon,
  jail: ConditionJailIcon,
  traveling: ConditionTravelingIcon,
  combat: ConditionCombatIcon,
};
