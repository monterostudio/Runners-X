export function assetUrl(value: unknown, fallback = ""): string {
  const url = typeof value === "string" && value ? value : fallback;
  return url.startsWith("uploads/") ? `/${url}` : url.startsWith("images/") ? `/${url}` : url;
}

export function publicHref(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "#";
  const href = value.trim();
  const legacyPages: Record<string, string> = {
    "index.php": "/", "resultados.php": "/resultados", "noticias.php": "/noticias", "galeria.php": "/galeria",
  };
  const legacy = href.match(/^(?:\.\/)?(index|resultados|noticias|galeria)\.php(#[A-Za-z0-9_-]+)?$/i);
  if (legacy) return `${legacyPages[`${legacy[1].toLowerCase()}.php`]}${legacy[2] ?? ""}`;
  if (href.startsWith("#") || (href.startsWith("/") && !href.startsWith("//"))) return href;
  try {
    const parsed = new URL(href);
    return ["http:", "https:", "mailto:"].includes(parsed.protocol) ? href : "#";
  } catch {
    return /^(?:\.\/)?[A-Za-z0-9._/-]+(?:#[A-Za-z0-9_-]+)?$/.test(href) ? `/${href.replace(/^\.\//, "")}` : "#";
  }
}
