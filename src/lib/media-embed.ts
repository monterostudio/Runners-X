export function mediaSourceUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export function socialMediaPlatform(value: unknown): string | null {
  const source = mediaSourceUrl(value);
  if (!source) return null;
  const host = new URL(source).hostname.toLowerCase().replace(/^www\./, "");
  const platforms: Array<[string, string]> = [
    ["youtube.com", "YouTube"],
    ["youtube-nocookie.com", "YouTube"],
    ["youtu.be", "YouTube"],
    ["instagram.com", "Instagram"],
    ["tiktok.com", "TikTok"],
    ["vimeo.com", "Vimeo"],
    ["facebook.com", "Facebook"],
    ["fb.watch", "Facebook"],
    ["x.com", "X"],
    ["twitter.com", "X"],
    ["threads.net", "Threads"],
    ["pinterest.com", "Pinterest"],
    ["pin.it", "Pinterest"],
    ["twitch.tv", "Twitch"],
    ["snapchat.com", "Snapchat"],
    ["linkedin.com", "LinkedIn"],
    ["reddit.com", "Reddit"],
  ];
  return platforms.find(([domain]) => host === domain || host.endsWith(`.${domain}`))?.[1] ?? null;
}

export function socialVideoEmbedUrl(value: unknown): string | null {
  const source = mediaSourceUrl(value);
  if (!source) return null;
  const url = new URL(source);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  if (["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "youtu.be"].includes(host)) {
    const segments = url.pathname.split("/").filter(Boolean);
    const videoId = host === "youtu.be"
      ? segments[0]
      : url.searchParams.get("v") ?? (["embed", "shorts", "live"].includes(segments[0] ?? "") ? segments[1] : undefined);
    return videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId)
      ? `https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1`
      : null;
  }

  if (["instagram.com", "m.instagram.com"].includes(host)) {
    const segments = url.pathname.split("/").filter(Boolean);
    const kind = segments[0];
    const shortcode = segments[1];
    return ["p", "reel", "reels", "tv"].includes(kind ?? "") && shortcode && /^[A-Za-z0-9_-]+$/.test(shortcode)
      ? `https://www.instagram.com/${kind}/${shortcode}/embed/`
      : null;
  }

  if (["tiktok.com", "m.tiktok.com", "vm.tiktok.com"].includes(host)) {
    const match = url.pathname.match(/\/video\/(\d+)/);
    return match ? `https://www.tiktok.com/player/v1/${match[1]}?autoplay=0&loop=0&music_info=0&description=0` : null;
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const match = url.pathname.match(/\/(?:video\/)?(\d+)/);
    return match ? `https://player.vimeo.com/video/${match[1]}` : null;
  }

  if (["facebook.com", "m.facebook.com", "web.facebook.com"].includes(host)) {
    const segments = url.pathname.split("/").filter(Boolean);
    if (url.searchParams.has("v") || segments.some((segment) => ["videos", "reel", "reels"].includes(segment))) {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url.href)}&show_text=false`;
    }
  }

  if (host === "fb.watch") {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url.href)}&show_text=false`;
  }

  if (host === "pinterest.com" || host === "www.pinterest.com") {
    const pinId = url.pathname.match(/\/pin\/(\d+)/)?.[1];
    return pinId ? `https://www.pinterest.com/pin/${pinId}/embed/` : null;
  }

  return null;
}

export function isVideoFileUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /\.(?:mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(value);
}
