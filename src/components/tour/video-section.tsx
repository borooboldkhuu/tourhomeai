/** Renders YouTube / Vimeo embeds, or a native player for direct file links. */
export function VideoSection({ url }: { url: string }) {
  const embed = toEmbedUrl(url);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-black">
      {embed ? (
        <iframe
          src={embed}
          title="Байрны видео"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="aspect-video w-full"
        />
      ) : (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={url} controls playsInline className="aspect-video w-full" />
      )}
    </div>
  );
}

function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return `https://www.youtube.com/embed${u.pathname}`;
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes("vimeo.com")) {
      return `https://player.vimeo.com/video${u.pathname}`;
    }
    return null;
  } catch {
    return null;
  }
}
