import { zip, type Zippable } from 'fflate';
import { supabase } from './supabase';
import { fechaBonita } from './utils';

/* Copia de seguridad: un ZIP con
   - recuerdos.html: para abrir en cualquier navegador, con las fotos
   - fotos/…: las fotos originales de cada recuerdo
   - datos.json: todo en bruto, por si algún día hay que restaurar o migrar
   Incluye solo lo que la cuenta que la descarga puede ver: las cartas que aún
   no se abren y los regalos que el otro ya compró no salen. */

export type Progreso = { paso: string; hechas?: number; total?: number };

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'recuerdo';

async function todo<T = any>(consulta: PromiseLike<{ data: T[] | null; error: any }>, que: string): Promise<T[]> {
  const { data, error } = await consulta;
  if (error) throw new Error(`No pude leer ${que}`);
  return data ?? [];
}

export async function armarCopia(alAvanzar: (p: Progreso) => void): Promise<Blob> {
  alAvanzar({ paso: 'Reuniendo los datos…' });
  const { data: { user } } = await supabase.auth.getUser();
  const [config, perfiles, recuerdos, fotos, notas, citas, preguntasDia, respuestas, cartasEscritas, cartasRecibidas, suenos, canciones, regalos, animos] = await Promise.all([
    todo(supabase.from('configuracion').select('*'), 'la configuración'),
    todo(supabase.from('perfiles').select('*'), 'los perfiles'),
    todo(supabase.from('recuerdos').select('*').order('fecha'), 'los recuerdos'),
    todo(supabase.from('fotos_recuerdo').select('*').order('orden'), 'las fotos'),
    todo(supabase.from('notas_recuerdo').select('*').order('created_at'), 'las notas'),
    todo(supabase.from('citas').select('*, lugares(nombre), actividades(nombre), franjas(nombre), categorias_cita(nombre)').order('fecha'), 'las citas'),
    todo(supabase.from('pregunta_del_dia').select('fecha, pregunta_id, preguntas(texto)').order('fecha'), 'las preguntas'),
    todo(supabase.from('respuestas').select('*').order('created_at'), 'las respuestas'),
    todo(supabase.from('cartas').select('*').order('created_at'), 'las cartas'),
    todo(supabase.rpc('cartas_recibidas') as any, 'las cartas recibidas'),
    todo(supabase.from('suenos').select('*').order('created_at'), 'los planes'),
    todo(supabase.from('canciones').select('*').order('created_at'), 'las canciones'),
    todo(supabase.from('regalos').select('*').order('created_at'), 'los regalos'),
    todo(supabase.from('estados_animo').select('*').order('fecha'), 'los estados de ánimo'),
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
    rutaZip[f.id] = `${carpeta[f.recuerdo_id] ?? 'fotos/otras'}/${String(lista.length).padStart(2, '0')}.jpg`;
  }

  // Descarga de fotos, de a 4 a la vez
  const archivos: Zippable = {};
  const fallidas: string[] = [];
  let hechas = 0;
  alAvanzar({ paso: 'Descargando fotos…', hechas, total: fotos.length });
  const cola = [...fotos];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let f = cola.shift(); f; f = cola.shift()) {
      const { data, error } = await supabase.storage.from('recuerdos').download(f.ruta);
      if (error || !data) fallidas.push(f.ruta);
      else archivos[rutaZip[f.id]] = [new Uint8Array(await data.arrayBuffer()), { level: 0 }]; // JPEG ya viene comprimido
      alAvanzar({ paso: 'Descargando fotos…', hechas: ++hechas, total: fotos.length });
    }
  }));

  alAvanzar({ paso: 'Armando el archivo…' });
  const hoy = new Date().toISOString().slice(0, 10);
  const datos = {
    generado: new Date().toISOString(),
    por: user?.id ?? null,
    configuracion: cfg, perfiles, recuerdos, fotos_recuerdo: fotos, notas_recuerdo: notas, citas,
    pregunta_del_dia: preguntasDia, respuestas, cartas_escritas: cartasEscritas, cartas_recibidas: cartasRecibidas,
    suenos, canciones, regalos, estados_animo: animos,
    fotos_sin_descargar: fallidas,
  };
  const texto = new TextEncoder();
  archivos['datos.json'] = texto.encode(JSON.stringify(datos, null, 2));
  archivos['recuerdos.html'] = texto.encode(libro({
    cfg, hoy, nombreDe, recuerdos, porRecuerdo, rutaZip, fallidas, notas, canciones,
    // En el libro solo las cartas ya abiertas, para que no sea un spoiler si lo ven juntos
    preguntasDia, respuestas, cartas: [...cartasEscritas.filter((c: any) => c.abierta_en), ...cartasRecibidas.filter((c: any) => c.contenido)], suenos, citas,
  }));

  const bytes = await new Promise<Uint8Array>((ok, falla) => zip(archivos, (e, d) => (e ? falla(e) : ok(d))));
  return new Blob([bytes as BlobPart], { type: 'application/zip' });
}

// recuerdos.html: legible sin la app, con las fotos del mismo ZIP
function libro(d: any): string {
  const { cfg, hoy, nombreDe, recuerdos, porRecuerdo, rutaZip, fallidas, notas, canciones, preguntasDia, respuestas, cartas, suenos, citas } = d;
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
  ${fs.length ? `<div class="fotos">${fs.map((f: any) => `<a href="${rutaZip[f.id]}"><img src="${rutaZip[f.id]}" loading="lazy" alt=""></a>`).join('')}</div>` : ''}
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
  ${rs.map((r: any) => `<p class="nota"><b>${esc(nombreDe(r.usuario_id))}:</b> ${esc(r.texto)}</p>`).join('')}
</article>`;
  }).join('\n');

  const seccionCartas = cartas.map((c: any) => `<article>
  <p class="fecha">De ${esc(nombreDe(c.de))}${c.abrir_desde ? ` · para el ${esc(fechaBonita(c.abrir_desde))}` : c.momento ? ` · para abrir ${esc(c.momento)}` : ''}</p>
  <h3>${esc(c.emoji)} ${esc(c.titulo)}</h3>
  <p class="texto carta">${esc(c.contenido)}</p>
</article>`).join('\n');

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
  .fotos img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;display:block}
  .sub{color:#5E8571}ul{padding-left:1.2rem}
</style></head><body><main>
<h1>${esc(cfg.nombre_app ?? 'You and me 💚')}</h1>
<p class="sub">${esc(cfg.nombre_el)} y ${esc(cfg.nombre_ella)} · juntos desde el ${esc(cfg.fecha_inicio ? fechaBonita(cfg.fecha_inicio) : '')} · copia del ${esc(fechaBonita(hoy))}</p>
<p class="sub">${recuerdos.length} recuerdos · ${vividas.length} citas vividas · ${cumplidos.length} planes cumplidos</p>
${fallidas.length ? `<p class="nota">⚠️ ${fallidas.length} fotos no se pudieron descargar.</p>` : ''}

<h2>📸 Recuerdos</h2>
${seccionRecuerdos || '<p class="sub">Aún no hay recuerdos.</p>'}

${seccionPreguntas.trim() ? `<h2>💭 Preguntas del día</h2>\n${seccionPreguntas}` : ''}

${seccionCartas ? `<h2>💌 Cartas</h2>\n${seccionCartas}` : ''}

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
