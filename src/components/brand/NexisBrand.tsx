type NexisBrandProps = {
  className?: string;
  alt?: string;
  decorative?: boolean;
};

export function NexisBrand({ className, alt = "Nexis", decorative = false }: NexisBrandProps) {
  return (
    <img
      src="/brand/nexis-mark-128.webp"
      className={className}
      alt={decorative ? "" : alt}
      aria-hidden={decorative || undefined}
      draggable={false}
      decoding="async"
    />
  );
}
