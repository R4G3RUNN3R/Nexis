// ---------------------------------------------------------------------------
// Nexis - Icon Library Base
//
// Shared frame for the original, hand-authored UI icon set (nav, stats,
// conditions, map markers, achievement categories, org glyphs). Follows the
// precedent set by src/assets/travel/transportIcons.tsx: there is no
// SVG-to-component loader wired into vite.config.ts (no vite-plugin-svgr), so
// the icons are authored as inline-SVG React components to stay crisp at any
// size and recolorable via the theme.
//
// Design language ("engraver's line"):
//   - uniform 24x24 viewBox, default rendered size 20
//   - stroke-based line art, stroke = currentColor so icons inherit the
//     surrounding text color; strokeWidth 1.5 (hairline detail 1.1)
//   - round caps and joins throughout
//   - one optional small solid detail per icon in the `accent` color
//     (defaults to the Ashen Crown amber #d89a47) for a subtle 2-tone look
//   - every glyph composed to stay legible at 16px
//
// These are NOT derived from, traced over, or referencing any third-party
// game's art - every path was composed directly as basic shapes for Nexis.
// ---------------------------------------------------------------------------

import type { ReactElement, ReactNode, SVGProps } from "react";

/** Ashen Crown amber - default accent for the 2-tone details. */
export const ICON_ACCENT = "#d89a47";

export type IconProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  /** Rendered width/height in px (icons are square). Defaults to 20. */
  size?: number | string;
  /** Accessible name; also rendered as a <title>. Omit for decorative use. */
  title?: string;
  /** Color of the small solid accent detail. Defaults to amber #d89a47. */
  accent?: string;
};

export type IconComponent = (props: IconProps) => ReactElement;

type IconBaseProps = Omit<IconProps, "accent"> & { children: ReactNode };

export function IconBase({ size = 20, title, children, ...rest }: IconBaseProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}
