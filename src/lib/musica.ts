// Convierte un link de Spotify o YouTube en el reproductor que se puede incrustar
export type Reproductor = { plataforma: 'spotify' | 'youtube'; embed: string; alto: number };

export function reproductor(url?: string | null): Reproductor | null {
  if (!url) return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '');

  // open.spotify.com/track/ID (también álbumes y playlists; a veces con /intl-es/ antes)
  if (host === 'open.spotify.com') {
    const m = u.pathname.match(/\/(track|album|playlist|episode)\/([A-Za-z0-9]+)/);
    if (m) return { plataforma: 'spotify', embed: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, alto: m[1] === 'track' ? 152 : 352 };
  }

  // youtube.com/watch?v=ID, music.youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.slice(1);
  else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    id = u.searchParams.get('v') ?? u.pathname.match(/\/(?:shorts|embed)\/([\w-]+)/)?.[1] ?? null;
  }
  if (id && /^[\w-]{6,}$/.test(id)) return { plataforma: 'youtube', embed: `https://www.youtube-nocookie.com/embed/${id}`, alto: 200 };

  return null;
}

// Intenta sacar el título del link (oEmbed); si falla, se escribe a mano
export async function tituloDelLink(url: string): Promise<string | null> {
  const r = reproductor(url);
  if (!r) return null;
  const endpoint = r.plataforma === 'spotify'
    ? `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`
    : `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    return ((await res.json()) as { title?: string }).title ?? null;
  } catch {
    return null;
  }
}
