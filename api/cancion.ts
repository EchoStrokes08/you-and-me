// Canciones: título y artista de un link (?url=) y búsqueda en Spotify mientras se escribe (?q=).
// Spotify no deja leer su página ni su API desde el navegador, por eso se hace aquí.
// La búsqueda usa la API de Spotify con SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET (app gratis en developer.spotify.com).
type Datos = { titulo: string | null; artista: string | null };
type Resultado = { id: string; titulo: string; artista: string; portada: string | null; url: string };

const meta = (html: string, nombre: string) => {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)="${nombre}"[^>]+content="([^"]*)"`, 'i'));
  return m ? decodificar(m[1]) : null;
};
const decodificar = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/* ---------- Link → título y artista ---------- */
async function spotify(url: string): Promise<Datos> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'es' } });
  if (!res.ok) return { titulo: null, artista: null };
  const html = await res.text();
  // og:description de una canción: "Artista · Álbum · Song · 2020"
  const artista = meta(html, 'music:musician_description') ?? meta(html, 'og:description')?.split(' · ')[0] ?? null;
  return { titulo: meta(html, 'og:title'), artista };
}

// Lo que sobra en los títulos de YouTube: (Official Video), [Lyrics], (Letra)…
const RUIDO = /\s*[([][^)\]]*(official|oficial|video|lyric|letra|audio|visualizer|mv|hd|4k|remaster)[^)\]]*[)\]]/gi;

async function youtube(url: string): Promise<Datos> {
  const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
  if (!res.ok) return { titulo: null, artista: null };
  const { title = '', author_name = '' } = (await res.json()) as { title?: string; author_name?: string };
  const limpio = title.replace(RUIDO, '').trim();
  // "Artista - Canción"
  const partes = limpio.split(/\s+[-–—]\s+/);
  if (partes.length >= 2) return { artista: partes[0].trim(), titulo: partes.slice(1).join(' - ').trim() };
  // Canales de YouTube Music: "Artista - Topic"; de discográfica: "ArtistaVEVO"
  const canal = author_name.replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').replace(/\s*(Official|Oficial)$/i, '').trim();
  return { titulo: limpio || null, artista: canal || null };
}

async function deLink(link: string): Promise<Response> {
  let u: URL;
  try { u = new URL(link); } catch { return Response.json({ titulo: null, artista: null }, { status: 400 }); }
  const host = u.hostname.replace(/^www\./, '');
  let datos: Datos = { titulo: null, artista: null };
  try {
    if (host === 'open.spotify.com') datos = await spotify(`https://open.spotify.com${u.pathname}`);
    else if (['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) datos = await youtube(link);
    else return Response.json(datos, { status: 400 });
  } catch { /* sin datos: se escriben a mano */ }
  return Response.json(datos, { headers: { 'Cache-Control': 'public, s-maxage=86400' } });
}

/* ---------- Búsqueda en Spotify ---------- */
// El token dura una hora; se reutiliza mientras la función siga viva
let token: { valor: string; vence: number } | null = null;

// Devuelve el token, o por qué no se pudo (para saber qué arreglar en Vercel o en Spotify)
async function tokenSpotify(): Promise<{ token: string } | { error: string; detalle?: string }> {
  // trim: al pegar las claves en Vercel a veces se cuela un espacio o un salto de línea
  const id = process.env.SPOTIFY_CLIENT_ID?.trim(), secreto = process.env.SPOTIFY_CLIENT_SECRET?.trim();
  if (!id || !secreto) return { error: !id && !secreto ? 'faltan_las_dos_claves' : !id ? 'falta_SPOTIFY_CLIENT_ID' : 'falta_SPOTIFY_CLIENT_SECRET' };
  if (token && token.vence > Date.now()) return { token: token.valor };
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${id}:${secreto}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) return { error: 'spotify_rechazo_las_claves', detalle: `${res.status} ${(await res.text()).slice(0, 200)}` };
  const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
  token = { valor: access_token, vence: Date.now() + (expires_in - 60) * 1000 };
  return { token: access_token };
}

async function buscar(q: string): Promise<Response> {
  const t = await tokenSpotify();
  // Sin claves o con claves malas: la app sigue funcionando, solo sin sugerencias
  if ('error' in t) return Response.json({ resultados: [], ...t }, { status: 503 });
  const res = await fetch(`https://api.spotify.com/v1/search?type=track&limit=6&market=CO&q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${t.token}` },
  });
  if (!res.ok) return Response.json({ resultados: [], error: 'busqueda_fallo', detalle: `${res.status} ${(await res.text()).slice(0, 200)}` }, { status: 502 });
  const { tracks } = (await res.json()) as { tracks: { items: any[] } };
  const resultados: Resultado[] = tracks.items.map((x) => ({
    id: x.id,
    titulo: x.name,
    artista: x.artists.map((a: any) => a.name).join(', '),
    // Las imágenes vienen de la más grande a la más pequeña
    portada: x.album?.images?.at(-1)?.url ?? null,
    url: x.external_urls.spotify,
  }));
  return Response.json({ resultados }, { headers: { 'Cache-Control': 'public, s-maxage=3600' } });
}

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const q = p.get('q')?.trim();
  if (q) return buscar(q.slice(0, 100));
  return deLink(p.get('url') ?? '');
}
