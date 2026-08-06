import { useState } from "react";

export type OneShotArtVariant = "thumb" | "scene" | "outcome";

function placeholderCopy(kind: string | undefined, variant: OneShotArtVariant) {
  if (variant === "thumb") return kind === "combat" ? "Encounter art pending" : "Contract art pending";
  if (variant === "outcome") return "Outcome art pending";
  return kind === "combat" ? "Encounter illustration pending" : "Scene illustration pending";
}

export function OneShotArt({
  imageUrl,
  alt,
  variant = "scene",
  kind,
  className = "",
}: {
  imageUrl: string | null | undefined;
  alt: string;
  variant?: OneShotArtVariant;
  kind?: string;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(imageUrl) && imageUrl !== failedUrl;

  return (
    <div className={`one-shot-art one-shot-art--${variant} one-shot-art--${kind === "combat" ? "combat" : "civic"} ${className}`.trim()}>
      {showImage ? (
        <img
          src={imageUrl ?? undefined}
          alt={alt}
          className="one-shot-art__image"
          loading="lazy"
          onError={() => setFailedUrl(imageUrl ?? null)}
        />
      ) : (
        <div className="one-shot-art__placeholder" aria-label={alt}>
          <span className="one-shot-art__placeholder-mark">{kind === "combat" ? "⚔" : "✦"}</span>
          <span className="one-shot-art__placeholder-copy">{placeholderCopy(kind, variant)}</span>
        </div>
      )}
    </div>
  );
}
