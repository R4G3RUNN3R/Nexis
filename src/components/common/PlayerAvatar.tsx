import type { CSSProperties } from "react";

type PortraitLike = { imageUrl?: string | null; imageKey?: string | null; hasCustomImage?: boolean } | null | undefined;

function initialsFromName(name?: string | null, lastName?: string | null) {
  const first = name?.trim()?.charAt(0) ?? "";
  const second = lastName?.trim()?.charAt(0) ?? "";
  const initials = `${first}${second}`.toUpperCase();
  return initials || "?";
}

export function resolveAvatarUrl(portrait?: PortraitLike, explicitUrl?: string | null) {
  if (explicitUrl) return explicitUrl;
  if (portrait?.imageUrl) return portrait.imageUrl;
  if (portrait?.imageKey) return `/api/profile-images/${encodeURIComponent(portrait.imageKey)}`;
  return null;
}

export function PlayerAvatar({ name, lastName, portrait, src, size = 36, className, style }: { name?: string | null; lastName?: string | null; portrait?: PortraitLike; src?: string | null; size?: number; className?: string; style?: CSSProperties }) {
  const url = resolveAvatarUrl(portrait, src);
  const baseStyle: CSSProperties = { width: size, height: size, minWidth: size, borderRadius: "50%", display: "inline-grid", placeItems: "center", overflow: "hidden", border: "1px solid rgba(216,194,120,0.45)", background: "rgba(216,194,120,0.12)", color: "#f0d989", fontWeight: 800, fontSize: Math.max(11, Math.round(size * 0.36)), lineHeight: 1, ...style };
  if (url) return <img src={url} alt={`${name ?? "Citizen"} avatar`} className={className} style={{ ...baseStyle, objectFit: "cover" }} />;
  return <span className={className} style={baseStyle}>{initialsFromName(name, lastName)}</span>;
}
