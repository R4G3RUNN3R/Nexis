import type { ServerItemSummary } from "../../lib/authApi";

function fallbackIconUrl(item: ServerItemSummary | null | undefined): string {
  const category = item?.category ?? "item";
  const slug = category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
  return `/item-icons/${slug}.svg`;
}

export function ItemIcon({ item, size = 38 }: { item: ServerItemSummary | null | undefined; size?: number }) {
  const palette = item?.iconPalette?.length ? item.iconPalette : ["#8fa0ad", "#202a33", "#d7cfb0"];
  const src = item?.iconUrl ?? fallbackIconUrl(item);
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        minWidth: size,
        border: `1px solid ${palette[2] ?? "rgba(255,255,255,0.18)"}`,
        background: `linear-gradient(135deg, ${palette[1] ?? "#111923"}, rgba(0,0,0,0.36))`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <img src={src} alt="" style={{ width: "82%", height: "82%", objectFit: "contain" }} />
    </span>
  );
}
