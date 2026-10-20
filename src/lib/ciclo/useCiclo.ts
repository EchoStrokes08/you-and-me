import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { hoyStr } from '../utils';
import * as A from './almacen';
import { huella, type Llaves } from './cripto';
import { armarVista, esDiaDificil, programarAvisos, type ContenidoAviso } from './compartir';
import { entre, predecir } from './prediccion';
import { ajustesIniciales, type Ajustes, type Dia } from './tipos';

export type EstadoCuenta = 'cargando' | 'error' | 'nueva' | 'bloqueada' | 'perdida' | 'lista';
// Cómo va lo compartido: si la pareja no tiene llave todavía, o si su llave cambió desde la última vez
export type EstadoCompartir = 'apagado' | 'ok' | 'sin-llave' | 'llave-cambio' | 'error';
export type Pareja = { usuario_id: string; publica: JsonWebKey; huella: string };

export function useCiclo(uid: string) {
  const [estado, setEstado] = useState<EstadoCuenta>('cargando');
  const [fila, setFila] = useState<A.FilaLlaves>(null);
  const [almacen, setAlmacen] = useState<A.Almacen | null>(null);
  const [dias, setDias] = useState<Map<string, Dia>>(new Map());
  const [ajustes, setAjustes] = useState<Ajustes | null>(null);
  const [pareja, setPareja] = useState<Pareja | null>(null);
  const [compartir, setCompartir] = useState<EstadoCompartir>('apagado');
  const [ilegibles, setIlegibles] = useState(0);
  const [hoy, setHoy] = useState(hoyStr);

  // Lo último, para que lo que se manda a la pareja nunca salga con datos viejos
  const ref = useRef({ dias, ajustes, almacen, pareja });
  ref.current = { dias, ajustes, almacen, pareja };

  const abrirCon = useCallback(async (a: A.Almacen) => {
    const r = await a.cargar();
    setAlmacen(a);
    setDias(r.dias);
    setAjustes(r.ajustes);
    setIlegibles(r.ilegibles);
    ref.current = { ...ref.current, dias: r.dias, ajustes: r.ajustes, almacen: a };
    setEstado('lista');
  }, []);

  const iniciar = useCallback(async () => {
    setEstado('cargando');
    try {
      const [f, g] = await Promise.all([A.filaLlaves(uid), A.llavesGuardadas(uid)]);
      setFila(f);
      if (!f) {
        // Se borró desde otro celular: lo de aquí ya no sirve
        if (g) await A.olvidarEnEsteCelular(uid);
        setEstado('nueva');
        return;
      }
      if (g && g.llaves.publica.x === f.publica.x && g.llaves.publica.y === f.publica.y) {
        await abrirCon(new A.Almacen(uid, g.llaves, g.modo));
        return;
      }
      if (g) await A.olvidarEnEsteCelular(uid); // llaves de antes de cambiar de lugar o de empezar de nuevo
      setEstado(f.llavero ? 'bloqueada' : 'perdida');
    } catch {
      setEstado('error');
    }
  }, [uid, abrirCon]);

  useEffect(() => { iniciar(); }, [iniciar]);

  // Si la app queda abierta de un día para otro
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === 'visible') setHoy(hoyStr()); };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, []);

  const prediccion = useMemo(() => (ajustes ? predecir([...dias.values()], ajustes, hoy) : null), [dias, ajustes, hoy]);

  // La llave de la pareja, revisando que sea la misma de la primera vez
  const revisarPareja = useCallback(async (): Promise<{ p: Pareja | null; estado: EstadoCompartir }> => {
    const l = await A.llavePareja();
    if (!l) return { p: null, estado: 'sin-llave' };
    const p = { ...l, huella: await huella(l.publica) };
    setPareja(p);
    const a = ref.current.ajustes;
    if (a?.huellaPareja && a.huellaPareja !== p.huella) return { p, estado: 'llave-cambio' };
    return { p, estado: 'ok' };
  }, []);

  // Arma lo que ve la pareja y los avisos programados, y los sube cifrados para su llave
  const sincronizar = useCallback(async () => {
    const { dias: ds, ajustes: a, almacen: al } = ref.current;
    if (!a || !al) return;
    if (!a.compartir.activo) { setCompartir('apagado'); return; }
    try {
      const { p, estado: e } = await revisarPareja();
      setCompartir(e);
      if (!p || e !== 'ok') return;
      if (!a.huellaPareja) {
        const conHuella = { ...a, huellaPareja: p.huella };
        ref.current.ajustes = conHuella;
        setAjustes(conHuella);
        await al.guardarAjustes(conHuella);
      }
      const h = hoyStr();
      const lista = [...ds.values()];
      const pr = predecir(lista, a, h);
      const v = armarVista(pr, lista, a, h);
      if (v) await A.publicarVista(uid, p, v);
      await A.reprogramarAvisos(uid, p, programarAvisos(pr, a, new Date()));
    } catch {
      setCompartir('error');
    }
  }, [uid, revisarPareja]);

  // Al abrir: lo compartido se rehace con las fechas de hoy
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (estado === 'lista' && ajustes) sincronizar(); }, [estado, hoy]);

  const pendiente = useRef<number | null>(null);
  const sincronizarLuego = useCallback(() => {
    if (pendiente.current) window.clearTimeout(pendiente.current);
    pendiente.current = window.setTimeout(() => { pendiente.current = null; sincronizar(); }, 900);
  }, [sincronizar]);

  const guardarDia = useCallback(async (d: Dia) => {
    const { almacen: al, ajustes: a, dias: ds } = ref.current;
    if (!al) return;
    const antes = ds.get(d.fecha);
    const vacio = !d.flujo && d.dolor == null && !d.animo?.length && !d.sintomas?.length && d.temperatura == null && d.tempMuneca == null && d.fcReposo == null
      && !d.lh && !d.embarazo && !d.moco && !d.relaciones && !d.necesidades?.length && !d.nota?.trim() && !d.energia;
    const nuevo = new Map(ds);
    if (vacio) nuevo.delete(d.fecha); else nuevo.set(d.fecha, { ...d, actualizado: Date.now() });
    ref.current.dias = nuevo;
    setDias(nuevo);
    if (vacio) await al.borrarDia(d.fecha); else await al.guardarDia(nuevo.get(d.fecha)!);
    // Día difícil: se avisa una vez, si ella lo activó y es de hoy o de ayer
    if (a?.compartir.activo && a.alertas.diaDificil && esDiaDificil(d) && !(antes && esDiaDificil(antes)) && d.fecha <= hoyStr() && entre(d.fecha, hoyStr()) <= 1) {
      const { p, estado: e } = await revisarPareja();
      if (p && e === 'ok') await A.mandarAviso(p, { tipo: 'dia_dificil', dolor: d.dolor, sintomas: d.sintomas ?? [] }).catch(() => {});
    }
    sincronizarLuego();
  }, [revisarPareja, sincronizarLuego]);

  const guardarVarios = useCallback(async (lista: Dia[]) => {
    const { almacen: al, dias: ds } = ref.current;
    if (!al || !lista.length) return;
    const nuevo = new Map(ds);
    for (const d of lista) nuevo.set(d.fecha, d);
    ref.current.dias = nuevo;
    setDias(nuevo);
    await al.guardarVarios(lista);
    sincronizarLuego();
  }, [sincronizarLuego]);

  const guardarAjustes = useCallback(async (a: Ajustes, opciones: { revocar?: boolean } = {}) => {
    const al = ref.current.almacen;
    if (!al) return;
    const antes = ref.current.ajustes;
    ref.current.ajustes = a;
    setAjustes(a);
    // Revocar va primero y sin esperar a nada más: que deje de verse al instante
    if (opciones.revocar || (antes?.compartir.activo && !a.compartir.activo)) {
      await A.revocar(uid);
      setCompartir('apagado');
    }
    await al.guardarAjustes(a);
    if (a.compartir.activo) await sincronizar();
  }, [uid, sincronizar]);

  // Ella confirma que la llave nueva de su pareja es la correcta (cambió de celular o empezó de nuevo)
  const aceptarLlaveNueva = useCallback(async () => {
    const a = ref.current.ajustes;
    const p = ref.current.pareja;
    if (!a || !p) return;
    await guardarAjustes({ ...a, huellaPareja: p.huella });
  }, [guardarAjustes]);

  const enviarNecesidad = useCallback(async (id: string, nota?: string): Promise<'ok' | EstadoCompartir> => {
    const { p, estado: e } = await revisarPareja();
    if (!p || e !== 'ok') return e;
    const contenido: ContenidoAviso = { tipo: 'necesidad', id, ...(nota?.trim() ? { nota: nota.trim().slice(0, 200) } : {}) };
    await A.mandarAviso(p, contenido);
    // Queda anotado en el día, para el informe y para recordar
    const h = hoyStr();
    const d = ref.current.dias.get(h) ?? { fecha: h, actualizado: Date.now() };
    if (ref.current.ajustes) await guardarDia({ ...d, necesidades: [...new Set([...(d.necesidades ?? []), id])] });
    return 'ok';
  }, [revisarPareja, guardarDia]);

  // ---------- Crear, abrir y cuidar la cuenta ----------
  const crear = useCallback(async (modo: A.Modo, clave: string | null, recordarAqui: boolean) => {
    if (modo === 'nube') {
      const { llaves, codigo } = await A.crearEnNube(uid, clave!, recordarAqui);
      setFila(await A.filaLlaves(uid));
      await abrirCon(new A.Almacen(uid, llaves, 'nube'));
      return codigo;
    }
    const llaves = await A.crearLocal(uid);
    setFila(await A.filaLlaves(uid));
    await abrirCon(new A.Almacen(uid, llaves, 'local'));
    return null;
  }, [uid, abrirCon]);

  const empezarRegistro = useCallback(async (inicial: Ajustes, periodos: string[]) => {
    const al = ref.current.almacen;
    if (!al) return;
    await al.guardarAjustes(inicial);
    ref.current.ajustes = inicial;
    setAjustes(inicial);
    if (periodos.length) {
      const ahora = Date.now();
      const lista: Dia[] = periodos.flatMap((inicio) =>
        Array.from({ length: inicial.periodoTipico }, (_, k) => {
          const f = new Date(inicio + 'T00:00:00');
          f.setDate(f.getDate() + k);
          const fecha = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
          return { fecha, flujo: k < 2 ? 'medio' as const : 'leve' as const, actualizado: ahora };
        }).filter((d) => d.fecha <= hoyStr()));
      await guardarVarios(lista);
    }
    await A.registrarConsentimiento('otorgado', inicial.consentimiento.version);
  }, [guardarVarios]);

  const desbloquear = useCallback(async (clave: string, recordarAqui: boolean) => {
    if (!fila) return false;
    const l = await A.desbloquear(uid, fila, clave, recordarAqui);
    if (!l) return false;
    await abrirCon(new A.Almacen(uid, l, 'nube'));
    return true;
  }, [uid, fila, abrirCon]);

  const recuperar = useCallback(async (codigo: string, nueva: string, recordarAqui: boolean) => {
    if (!fila) return false;
    const l = await A.recuperar(uid, fila, codigo, nueva, recordarAqui);
    if (!l) return false;
    setFila(await A.filaLlaves(uid));
    await abrirCon(new A.Almacen(uid, l, 'nube'));
    return true;
  }, [uid, fila, abrirCon]);

  const bloquear = useCallback(async () => {
    await A.olvidarEnEsteCelular(uid);
    setAlmacen(null);
    setDias(new Map());
    setAjustes(null);
    setEstado('bloqueada');
  }, [uid]);

  const cambiarDeLugar = useCallback(async (destino: A.Modo, clave?: string) => {
    const al = ref.current.almacen;
    if (!al) return null;
    const { almacen: nuevo, codigo } = await A.cambiarDeLugar(al, destino, clave);
    setFila(await A.filaLlaves(uid));
    await abrirCon(nuevo);
    return codigo ?? null;
  }, [uid, abrirCon]);

  const borrarTodo = useCallback(async () => {
    const a = ref.current.ajustes;
    await A.borrarTodo(uid, ref.current.almacen);
    if (a) await A.registrarConsentimiento('revocado', a.consentimiento.version).catch(() => {});
    setAlmacen(null);
    setDias(new Map());
    setAjustes(null);
    setFila(null);
    setCompartir('apagado');
    setEstado('nueva');
  }, [uid]);

  // Dejar de llevar el ciclo sin borrar la llave (por ejemplo, si solo quiere seguir recibiendo)
  const dejarDeRegistrar = useCallback(async () => {
    const al = ref.current.almacen;
    const a = ref.current.ajustes;
    if (!al) return;
    await A.revocar(uid);
    await al.borrarRegistros();
    if (a) await A.registrarConsentimiento('revocado', a.consentimiento.version).catch(() => {});
    setDias(new Map());
    setAjustes(null);
    setCompartir('apagado');
  }, [uid]);

  return {
    estado, fila, almacen, llaves: almacen?.llaves ?? null as Llaves | null, modo: almacen?.modo ?? null,
    dias, ajustes, prediccion, hoy, pareja, compartir, ilegibles,
    iniciar, crear, empezarRegistro, desbloquear, recuperar, bloquear, cambiarDeLugar, borrarTodo, dejarDeRegistrar,
    guardarDia, guardarVarios, guardarAjustes, aceptarLlaveNueva, enviarNecesidad, sincronizar, revisarPareja,
  };
}
export type Ciclo = ReturnType<typeof useCiclo>;

// Lo que la pareja comparte conmigo, al día con Realtime (si revoca, desaparece en el momento)
export function useRecibido(uid: string, llaves: Llaves | null) {
  const [vista, setVista] = useState<Awaited<ReturnType<typeof A.leerVistaRecibida>>>(null);
  const [avisos, setAvisos] = useState<A.AvisoRecibido[]>([]);
  const [cargado, setCargado] = useState(false);

  const cargar = useCallback(async () => {
    if (!llaves) return;
    try {
      const [v, av] = await Promise.all([A.leerVistaRecibida(uid, llaves), A.leerAvisosRecibidos(uid, llaves)]);
      setVista(v);
      setAvisos(av);
    } catch { /* sin conexión: queda lo último */ }
    setCargado(true);
  }, [uid, llaves]);

  useEffect(() => {
    if (!llaves) return;
    cargar();
    const ch = supabase.channel('ciclo-recibido')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ciclo_compartido' }, () => cargar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ciclo_avisos' }, () => cargar())
      .subscribe();
    const alVolver = () => { if (document.visibilityState === 'visible') cargar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { supabase.removeChannel(ch); document.removeEventListener('visibilitychange', alVolver); };
  }, [llaves, cargar]);

  const descartar = useCallback(async (id: string) => {
    setAvisos((a) => a.filter((x) => x.id !== id));
    await A.descartarAviso(id);
  }, []);

  return { vista, avisos, cargado, descartar, recargar: cargar };
}

export const nuevosAjustes = (hoy: string) => ajustesIniciales(hoy);
