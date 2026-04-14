const ABSOLUTE_RESERVED_PUBLIC_ID = 1_000_000;

export function isAbsoluteOwner(publicId: number | null | undefined) {
  return publicId === ABSOLUTE_RESERVED_PUBLIC_ID;
}

export function resolveDisplayTitle(rawTitle: string | null | undefined, publicId: number | null | undefined) {
  const title = (rawTitle ?? "").trim();

  if (title === "0" || title.toLowerCase() === "the_absolute" || title.toLowerCase() === "the absolute") {
    return isAbsoluteOwner(publicId) ? "The Absolute" : "None";
  }

  return title || "None";
}

export function sanitizeStoredTitle(rawTitle: string | null | undefined, publicId: number | null | undefined) {
  const title = (rawTitle ?? "").trim();

  if (title === "0" || title.toLowerCase() === "the_absolute" || title.toLowerCase() === "the absolute") {
    return isAbsoluteOwner(publicId) ? "0" : "";
  }

  return title;
}
