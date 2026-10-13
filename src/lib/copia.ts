import { Zip, ZipDeflate, ZipPassThrough } from 'fflate';
import { supabase } from './supabase';
import { fechaBonita, hoyStr } from './utils';

/* Copia de seguridad: un ZIP con
   - recuerdos.html: para abrir en cualquier navegador, con las fotos
   - fotos/…: las fotos y videos de cada recuerdo
   - voz/…: las notas de voz de las cartas y de "Pienso en ti"
   - capsulas/…: las fotos y audios guardados en las cápsulas
   - datos.json: todo en bruto, por si algún día hay que restaurar o migrar
   Incluye solo lo que la cuenta que la descarga puede ver: las cartas que aún
   no se abren y los regalos que el otro ya compró no salen. */

export type Progreso = { paso: string; hechas?: number; total?: number };

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'recuerdo';

// Supabase devuelve máximo 1000 filas por consulta: se pide por páginas para que no falte nada
const PAGINA = 1000;
async function todo<T = any>(consulta: () => any, que: string): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await consulta().range(desde, desde + PAGINA - 1);
    if (error) throw new Error(`No pude leer ${que}`);
    filas.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGINA) return filas;
  }
}

const extension = (ruta: string, porDefecto: string) => (String(ruta).split('.').pop() || porDefecto).toLowerCase().replace(/[^a-z0-9]/g, '') || porDefecto;

export async function armarCopia(alAvanzar: (p: Progreso) => void): Promise<Blob> {
  alAvanzar({ paso: 'Reuniendo los datos…' });
  const { data: { user } } = await supabase.auth.getUser();
  const [config, perfiles, recuerdos, fotos, notas, citas, preguntasDia, respuestas, cartasEscritas, cartasRecibidas, suenos, porConocer, canciones, regalos, animos, capsulas, capsulaItems, pensamientos, reacciones, preguntasPropias] = await Promise.all([
    todo(() => supabase.from('configuracion').select('*'), 'la configuración'),
    todo(() => supabase.from('perfiles').select('*'), 'los perfiles'),
    todo(() => supabase.from('recuerdos').select('*').order('fecha').order('id'), 'los recuerdos'),
    todo(() => supabase.from('fotos_recuerdo').select('*').order('orden').order('id'), 'las fotos'),
    todo(() => supabase.from('notas_recuerdo').select('*').order('created_at').order('id'), 'las notas'),
    todo(() => supabase.from('citas').select('*, lugares(nombre), actividades(nombre), franjas(nombre), categorias_cita(nombre)').order('fecha').order('id'), 'las citas'),
    todo(() => supabase.from('pregunta_del_dia').select('fecha, pregunta_id, preguntas(texto)').order('fecha'), 'las preguntas'),
    todo(() => supabase.from('respuestas').select('*').order('created_at').order('id'), 'las respuestas'),
    todo(() => supabase.from('cartas').select('*').order('created_at').order('id'), 'las cartas'),
    todo(() => supabase.rpc('cartas_recibidas'), 'las cartas recibidas'),
    todo(() => supabase.from('suenos').select('*').order('created_at').order('id'), 'los planes'),
    todo(() => supabase.from('lugares_por_conocer').select('*').order('created_at').order('id'), 'los lugares por conocer'),
    todo(() => supabase.from('canciones').select('*').order('created_at').order('id'), 'las canciones'),
    todo(() => supabase.from('regalos').select('*').order('created_at').order('id'), 'los regalos'),
    todo(() => supabase.from('estados_animo').select('*').order('fecha').order('usuario_id'), 'los estados de ánimo'),
    todo(() => supabase.from('capsulas').select('*').order('abrir_en').order('id'), 'las cápsulas'),
    // Solo lo propio y lo de cápsulas ya abiertas
    todo(() => supabase.from('capsula_items').select('*').order('created_at').order('id'), 'lo guardado en las cápsulas'),
    todo(() => supabase.from('pensamientos').select('*').order('created_at').order('id'), 'los "Pienso en ti"'),
    todo(() => supabase.from('reacciones_respuesta').select('*').order('created_at').order('respuesta_id'), 'las reacciones'),
    // Solo las que escribió quien descarga: las del otro siguen en secreto
    todo(() => supabase.from('preguntas_propias').select('*').order('created_at').order('id'), 'las preguntas propias'),
  ]);

  const cfg = config[0] ?? {};
  const nombreDe = (id: string) => {
    const p = perfiles.find((x) => x.id === id);
    return p?.rol === 'admin' ? cfg.nombre_el : p?.rol === 'pareja' ? cfg.nombre_ella : p?.nombre || '';
  };

  // Carpeta y nombre de cada foto dentro del ZIP
  const carpeta: Record<string, string> = {};
  for (const r of recuerdos) carpeta[r.id] = `fotos/${r.fecha}-${slug(r.titulo)}-${r.id.slice(0, 4)}`;
  const rutaZip: Record<string, string> = {};
  const porRecuerdo: Record<string, any[]> = {};
  for (const f of fotos) {
    const lista = (porRecuerdo[f.recuerdo_id] ??= []);
    lista.push(f);
    rutaZip[f.id] = `${carpeta[f.recuerdo_id] ?? 'fotos/otras'}/${String(lista.length).padStart(2, '0')}.${f.tipo === 'video' ? extension(f.ruta, 'mp4') : 'jpg'}`;
  }

  // Lo del bucket "adjuntos": notas de voz de cartas y de "Pienso en ti", y fotos y audios de las cápsulas.
  // rutaAdj: ruta en el bucket → nombre dentro del ZIP
  const rutaAdj: Record<string, string> = {};
  for (const c of [...cartasEscritas, ...cartasRecibidas]) {
    if (c.audio) rutaAdj[c.audio] = `voz/cartas/${String(c.created_at).slice(0, 10)}-${slug(c.titulo)}-${c.id.slice(0, 4)}.${extension(c.audio, 'm4a')}`;
  }
  for (const p of pensamientos) {
    if (p.audio) rutaAdj[p.audio] = `voz/pienso-en-ti/${String(p.created_at).slice(0, 10)}-${slug(nombreDe(p.de) || 'nota')}-${p.id.slice(0, 4)}.${extension(p.audio, 'm4a')}`;
  }
  const porCapsula: Record<string, any[]> = {};
  for (const i of capsulaItems) {
    const lista = (porCapsula[i.capsula_id] ??= []);
    lista.push(i);
    const k = capsulas.find((x) => x.id === i.capsula_id);
    if (i.ruta) rutaAdj[i.ruta] = `capsulas/${k ? `${k.abrir_en}-${slug(k.titulo)}-${k.id.slice(0, 4)}` : 'otras'}/${String(lista.length).padStart(2, '0')}.${extension(i.ruta, i.tipo === 'foto' ? 'jpg' : 'm4a')}`;
  }

  // El ZIP se va armando archivo por archivo: así en memoria solo están los que se están
  // descargando, no todas las fotos y videos a la vez (con varios videos el celular no aguantaba)
  const partes: Blob[] = [];
  let errorZip: Error | null = null;
  const z = new Zip((e, trozo) => { if (e) errorZip = e; else partes.push(new Blob([trozo as BlobPart])); });
  const agregar = (nombre: string, bytes: Uint8Array, comprimir = false) => {
    // Fotos, videos y audios ya vienen comprimidos: se guardan tal cual
    const f = comprimir ? new ZipDeflate(nombre, { level: 6 }) : new ZipPassThrough(nombre);
    z.add(f);
    f.push(bytes, true);
  };

  // Descarga de fotos y audios, de a 4 a la vez
  const cola = [
    ...fotos.map((f) => ({ bucket: 'recuerdos', ruta: f.ruta as string, zip: rutaZip[f.id] })),
    ...Object.entries(rutaAdj).map(([ruta, zip]) => ({ bucket: 'adjuntos', ruta, zip })),
  ];
  const total = cola.length;
  const fallidas: string[] = [];
  let hechas = 0;
  alAvanzar({ paso: 'Descargando fotos y audios…', hechas, total });
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let a = cola.shift(); a; a = cola.shift()) {
      const { data, error } = await supabase.storage.from(a.bucket).download(a.ruta);
      if (error || !data) fallidas.push(a.ruta);
      else agregar(a.zip, new Uint8Array(await data.arrayBuffer()));
      alAvanzar({ paso: 'Descargando fotos y audios…', hechas: ++hechas, total });
    }
  }));

  alAvanzar({ paso: 'Armando el archivo…' });
  const hoy = hoyStr();
  const datos = {
    generado: new Date().toISOString(),
    por: user?.id ?? null,
    configuracion: cfg, perfiles, recuerdos, fotos_recuerdo: fotos, notas_recuerdo: notas, citas,
    pregunta_del_dia: preguntasDia, respuestas, cartas_escritas: cartasEscritas, cartas_recibidas: cartasRecibidas,
    suenos, lugares_por_conocer: porConocer, canciones, regalos, estados_animo: animos, capsulas, capsula_items: capsulaItems, pensamientos,
    reacciones_respuesta: reacciones, preguntas_propias: preguntasPropias,
    // Dónde quedó en el ZIP cada archivo del bucket "adjuntos"
    adjuntos: rutaAdj,
    archivos_sin_descargar: fallidas,
  };
  const texto = new TextEncoder();
  agregar('datos.json', texto.encode(JSON.stringify(datos, null, 2)), true);
  agregar('recuerdos.html', texto.encode(libro({
    cfg, hoy, nombreDe, recuerdos, porRecuerdo, rutaZip, rutaAdj, fallidas, notas, canciones,
    // En el libro solo las cartas ya abiertas, para que no sea un spoiler si lo ven juntos
    preguntasDia, respuestas, reacciones, cartas: [...cartasEscritas.filter((c: any) => c.abierta_en), ...cartasRecibidas.filter((c: any) => c.contenido)], suenos, citas,
    // Y solo las cápsulas que ya se abrieron
    capsulas: capsulas.filter((k: any) => k.abrir_en <= hoy), porCapsula,
    voces: pensamientos.filter((p: any) => p.audio),
  })), true);
  z.end();
  if (errorZip) throw errorZip;

  return new Blob(partes, { type: 'application/zip' });
}

// recuerdos.html: legible sin la app, con las fotos del mismo ZIP
function libro(d: any): string {
  const { cfg, hoy, nombreDe, recuerdos, porRecuerdo, rutaZip, rutaAdj, fallidas, notas, canciones, preguntasDia, respuestas, reacciones, cartas, suenos, citas, capsulas, porCapsula, voces } = d;
  // Reproductor de un audio del bucket "adjuntos", si se pudo descargar
  const audio = (ruta?: string | null) => (ruta && rutaAdj[ruta] && !fallidas.includes(ruta) ? `<audio controls preload="none" src="${rutaAdj[ruta]}"></audio>` : '');
  const diaDe = (ts: string) => new Date(ts).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const corazones = (n: number) => '💚'.repeat(n) + '🤍'.repeat(5 - n);

  const seccionRecuerdos = recuerdos.map((r: any) => {
    const fs = (porRecuerdo[r.id] ?? []).filter((f: any) => !fallidas.includes(f.ruta));
    const ns = notas.filter((n: any) => n.recuerdo_id === r.id);
    const cs = canciones.filter((c: any) => c.recuerdo_id === r.id);
    return `<article>
  <p class="fecha">${esc(fechaBonita(r.fecha))}</p>
  <h3>${esc(r.titulo)}</h3>
  ${r.lugar_texto ? `<p class="lugar">📍 ${esc(r.lugar_texto)}</p>` : ''}
  <p>${corazones(r.calificacion)}</p>
  ${r.descripcion ? `<p class="texto">${esc(r.descripcion)}</p>` : ''}
  ${fs.length ? `<div class="fotos">${fs.map((f: any) => f.tipo === 'video' ? `<video src="${rutaZip[f.id]}" controls preload="metadata"></video>` : `<a href="${rutaZip[f.id]}"><img src="${rutaZip[f.id]}" loading="lazy" alt=""></a>`).join('')}</div>` : ''}
  ${ns.map((n: any) => `<p class="nota"><b>${esc(nombreDe(n.usuario_id))}:</b> ${esc(n.texto)}</p>`).join('')}
  ${cs.map((c: any) => `<p class="nota">🎵 ${esc(c.titulo)}${c.artista ? ` — ${esc(c.artista)}` : ''}</p>`).join('')}
</article>`;
  }).join('\n');

  const seccionPreguntas = preguntasDia.map((p: any) => {
    const rs = respuestas.filter((r: any) => r.pregunta_id === p.pregunta_id);
    if (!rs.length) return '';
    return `<article>
  <p class="fecha">${esc(fechaBonita(p.fecha))}</p>
  <h3>${esc(p.preguntas?.texto)}</h3>
  ${rs.map((r: any) => {
    const k = reacciones.find((x: any) => x.respuesta_id === r.id);
    return `<p class="nota"><b>${esc(nombreDe(r.usuario_id))}:</b> ${esc(r.texto)}${k?.corazon ? ' 💚' : ''}</p>${k?.texto ? `<p class="nota contesta"><b>${esc(nombreDe(k.de))} le contestó:</b> ${esc(k.texto)}</p>` : ''}`;
  }).join('')}
</article>`;
  }).join('\n');

  const seccionCartas = cartas.map((c: any) => `<article>
  <p class="fecha">De ${esc(nombreDe(c.de))}${c.abrir_desde ? ` · para el ${esc(fechaBonita(c.abrir_desde))}` : c.momento ? ` · para abrir ${esc(c.momento)}` : ''}</p>
  <h3>${esc(c.emoji)} ${esc(c.titulo)}</h3>
  <p class="texto carta">${esc(c.contenido)}</p>
  ${audio(c.audio)}
</article>`).join('\n');

  const seccionCapsulas = capsulas.map((k: any) => {
    const items = porCapsula[k.id] ?? [];
    const fs = items.filter((i: any) => i.tipo === 'foto' && rutaAdj[i.ruta] && !fallidas.includes(i.ruta));
    return `<article>
  <p class="fecha">Se abrió el ${esc(fechaBonita(k.abrir_en))}</p>
  <h3>${esc(k.emoji)} ${esc(k.titulo)}</h3>
  ${items.filter((i: any) => i.tipo === 'texto').map((i: any) => `<p class="nota"><b>${esc(nombreDe(i.de))}:</b> ${esc(i.texto)}</p>`).join('')}
  ${fs.length ? `<div class="fotos">${fs.map((i: any) => `<a href="${rutaAdj[i.ruta]}"><img src="${rutaAdj[i.ruta]}" loading="lazy" alt=""></a>`).join('')}</div>` : ''}
  ${items.filter((i: any) => i.tipo === 'audio').map((i: any) => `<p class="nota"><b>${esc(nombreDe(i.de))}:</b></p>${audio(i.ruta)}`).join('')}
</article>`;
  }).join('\n');

  const seccionVoces = voces.map((p: any) => `<p class="nota"><b>${esc(nombreDe(p.de))}</b> · ${esc(diaDe(p.created_at))}</p>${audio(p.audio)}`).join('\n');

  const cumplidos = suenos.filter((s: any) => s.cumplido_en);
  const vividas = citas.filter((c: any) => c.estado === 'vivida');

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(cfg.nombre_app ?? 'You and me')} · copia del ${esc(hoy)}</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;background:#F3F7F1;color:#17332A;margin:0;padding:24px 16px;line-height:1.5}
  main{max-width:720px;margin:0 auto}
  h1{font-size:2rem;margin:0}h2{margin-top:2.5rem;border-bottom:2px solid #D8ECDF;padding-bottom:.3rem}
  h3{margin:.1rem 0 .3rem}
  article{background:#fff;border:1px solid #D8ECDF;border-radius:20px;padding:16px;margin:12px 0}
  .fecha{font-size:.75rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#5E8571;margin:0}
  .lugar{color:#5E8571;margin:0}.texto{white-space:pre-wrap}.carta{font-family:Georgia,serif;font-size:1.05rem}
  .nota{background:#EAF5ED;border-radius:14px;padding:8px 12px;margin:6px 0}
  .fotos{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:10px 0}
  .fotos img,.fotos video{width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;display:block;background:#0E2A20}
  .sub{color:#5E8571}ul{padding-left:1.2rem}audio{width:100%;margin:4px 0}.contesta{margin-left:24px}
</style></head><body><main>
<h1>${esc(cfg.nombre_app ?? 'You and me 💚')}</h1>
<p class="sub">${esc(cfg.nombre_el)} y ${esc(cfg.nombre_ella)} · juntos desde el ${esc(cfg.fecha_inicio ? fechaBonita(cfg.fecha_inicio) : '')} · copia del ${esc(fechaBonita(hoy))}</p>
<p class="sub">${recuerdos.length} recuerdos · ${vividas.length} citas vividas · ${cumplidos.length} planes cumplidos</p>
${fallidas.length ? `<p class="nota">⚠️ ${fallidas.length} ${fallidas.length === 1 ? 'archivo no se pudo' : 'archivos no se pudieron'} descargar.</p>` : ''}

<h2>📸 Recuerdos</h2>
${seccionRecuerdos || '<p class="sub">Aún no hay recuerdos.</p>'}

${seccionPreguntas.trim() ? `<h2>💭 Preguntas del día</h2>\n${seccionPreguntas}` : ''}

${seccionCartas ? `<h2>💌 Cartas</h2>\n${seccionCartas}` : ''}

${seccionCapsulas ? `<h2>⏳ Cápsulas del tiempo</h2>\n${seccionCapsulas}` : ''}

${seccionVoces ? `<h2>🎙️ Notas de voz de "Pienso en ti"</h2>\n${seccionVoces}` : ''}

${cumplidos.length ? `<h2>✨ Planes cumplidos</h2><ul>${cumplidos.map((s: any) => `<li>${esc(s.emoji)} ${esc(s.titulo)} — ${esc(fechaBonita(s.cumplido_en))}</li>`).join('')}</ul>` : ''}

${canciones.length ? `<h2>🎵 Nuestras canciones</h2><ul>${canciones.map((c: any) => `<li>${c.url ? `<a href="${esc(c.url)}">${esc(c.titulo)}</a>` : esc(c.titulo)}${c.artista ? ` — ${esc(c.artista)}` : ''}${c.nota ? ` · <i>${esc(c.nota)}</i>` : ''}</li>`).join('')}</ul>` : ''}
</main></body></html>`;
}

// En iPhone (app instalada) descargar un archivo directo no funciona bien: se comparte
// y desde ahí se guarda en Archivos. En lo demás, descarga normal.
export async function entregarArchivo(blob: Blob, nombre: string): Promise<'compartido' | 'descargado' | 'cancelado'> {
  const archivo = new File([blob], nombre, { type: 'application/zip' });
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (esIOS && navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombre });
      return 'compartido';
    } catch (e: any) {
      if (e?.name === 'AbortError') return 'cancelado';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'descargado';
}
