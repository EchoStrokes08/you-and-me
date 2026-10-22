import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import type { Vale } from '../lib/tipos';
import { useAvisos } from '../lib/avisos';
import { ChipsConMas, Esqueleto, IconoCheck, IconoVale, Segmented, Vacio } from './ui';

// Ideas para no arrancar de cero; se pueden cambiar antes de regalarlo
const IDEAS = [
  'Un masaje', 'Yo escojo la peli', 'Desayuno en la cama', 'Un abrazo de 10 minutos', 'Te cocino lo que quieras', 'Ganas una discusión',
  'Una cita sorpresa', 'Un día de consentirte', 'Un helado cuando quieras', 'Una sesión de fotos', 'Yo lavo los platos', 'Una carta escrita a mano',
  'Una noche de juegos', 'Tú escoges el plan del finde', 'Una tarde sin celulares', 'Un postre sorpresa', 'Una playlist hecha para ti',
  'Un baile en la sala', 'Te hago trencitas', 'Un picnic', 'Te acompaño a hacer vueltas', 'Maratón de tu serie', 'Un sí a lo que pidas',
];

// Cupones (en la base, la tabla `vales`): uno le regala al otro algo que puede usar cuando quiera.
// Usarlo le avisa a quien lo regaló.
export default function Cupones({ yo, pareja }: { yo: string; pareja: string }) {
  const { revisar, confirmar, aviso } = useAvisos();
  const [vista, setVista] = useState<'mios' | 'regalados'>('mios');
  const [vales, setVales] = useState<Vale[]>([]);
  const [cargado, setCargado] = useState(false);
  const [otro, setOtro] = useState<string | null>(null);
  // El asistente puede dejar una idea de cupón lista para regalar
  const idea = (useLocation().state as { cupon?: string } | null)?.cupon;
  const [titulo, setTitulo] = useState(idea ?? '');
  const [detalle, setDetalle] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    const { data } = await supabase.from('vales').select('*').order('created_at', { ascending: false });
    setVales(data ?? []);
    // Si nadie le ha regalado vales todavía, se abre donde puede regalar uno
    if (!cargado && (idea || !(data ?? []).some((v) => v.para === yo))) setVista('regalados');
    setCargado(true);
  };
  useEffect(() => {
    cargar();
    supabase.from('perfiles').select('id').neq('id', yo).limit(1).maybeSingle().then(({ data }) => setOtro(data?.id ?? null));
    // Si el otro lo usa o lo cumple con la app abierta, se ve sin recargar
    const ch = supabase.channel('cupones-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'vales' }, cargar).subscribe();
    return () => { supabase.removeChannel(ch); };
    // cargar se crea en cada render; basta con suscribirse una vez por usuario
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [yo]);

  const regalar = async () => {
    if (!titulo.trim() || !otro) return;
    setGuardando(true);
    const { error } = revisar(await supabase.from('vales').insert({ para: otro, titulo: titulo.trim(), detalle: detalle.trim() }), 'No pude regalar el cupón');
    setGuardando(false);
    if (error) return;
    setTitulo(''); setDetalle('');
    aviso(`Listo: ${pareja} ya tiene su cupón 🎟️`);
    cargar();
  };

  const usar = async (v: Vale) => {
    if (!(await confirmar({ titulo: `¿Usar «${v.titulo}» ahora?`, texto: `Le aviso a ${pareja} que te toca 💚`, boton: 'Usarlo' }))) return;
    const { error } = revisar(await supabase.rpc('redimir_vale', { p_id: v.id }), 'No pude usar el cupón');
    if (!error) aviso(`${pareja} ya sabe que lo quieres usar 💚`);
    cargar();
  };

  const cumplir = async (v: Vale) => {
    revisar(await supabase.rpc('cumplir_vale', { p_id: v.id }), 'No pude marcarlo');
    cargar();
  };

  const retirar = async (v: Vale) => {
    if (!(await confirmar({ titulo: `¿Retirar «${v.titulo}»?`, texto: `${pareja} ya no lo va a poder usar.`, boton: 'Retirar', peligro: true }))) return;
    revisar(await supabase.from('vales').delete().eq('id', v.id), 'No pude retirarlo');
    cargar();
  };

  const mios = vales.filter((v) => v.para === yo);
  const regalados = vales.filter((v) => v.de === yo);
  const porCumplir = regalados.filter((v) => v.redimido_en && !v.cumplido_en).length;

  return (
    <div className="flex flex-col gap-4">
      <Segmented id="vista-cupones" value={vista} onChange={setVista}
        options={[['mios', 'Para mí'], ['regalados', porCumplir ? `Los que regalé · ${porCumplir}` : 'Los que regalé']] as const} />

      {!cargado ? <Esqueleto className="h-28" /> : vista === 'mios' ? (
        mios.length === 0 ? <Vacio titulo="Aún no tienes cupones" texto={`Cuando ${pareja} te regale uno, aparece aquí para que lo uses cuando quieras.`} /> : (
          <div className="flex flex-col gap-3 stagger">
            {mios.map((v) => (
              <Vale key={v.id} v={v} de={pareja}>
                {!v.redimido_en ? (
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => usar(v)} className="btn-primary px-4 shrink-0">Usar</motion.button>
                ) : !v.cumplido_en ? (
                  <span className="badge bg-durazno/30 text-coral shrink-0">Esperando</span>
                ) : <span className="badge bg-seleccion text-bosque shrink-0"><IconoCheck className="w-3.5 h-3.5" /> Cumplido</span>}
              </Vale>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="card p-4 flex flex-col gap-3">
            <p className="font-titulo text-xl font-semibold">Regálale un cupón a {pareja}</p>
            <ChipsConMas opciones={IDEAS} elegida={titulo} onElegir={setTitulo} etiqueta="Ideas de cupones" />
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={60} placeholder="Cupón para…" aria-label="Cupón para" className="input" />
            <input value={detalle} onChange={(e) => setDetalle(e.target.value)} maxLength={200} placeholder="Letra pequeña (opcional)" aria-label="Letra pequeña" className="input" />
            <button onClick={regalar} disabled={!titulo.trim() || !otro || guardando} className="btn-primary"><IconoVale className="w-5 h-5" /> {guardando ? 'Regalando…' : 'Regalar cupón'}</button>
          </div>
          {regalados.length === 0 ? <Vacio titulo="No has regalado cupones" texto="Un masaje, un desayuno, ganar una discusión… lo que quieras regalar." /> : (
            <div className="flex flex-col gap-3 stagger">
              {regalados.map((v) => (
                <Vale key={v.id} v={v} para={pareja}>
                  {!v.redimido_en ? (
                    <button onClick={() => retirar(v)} className="min-h-11 px-2 text-sm text-salvia font-bold shrink-0">Retirar</button>
                  ) : !v.cumplido_en ? (
                    <button onClick={() => cumplir(v)} className="btn-primary px-4 shrink-0">Ya lo cumplí</button>
                  ) : <span className="badge bg-seleccion text-bosque shrink-0"><IconoCheck className="w-3.5 h-3.5" /> Cumplido</span>}
                </Vale>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Día y mes en hora local (redimido_en y cumplido_en son timestamptz)
const dia = (ts: string) => new Date(ts).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });

// Un cupón con forma de boleta: el talón a la izquierda, la línea punteada y lo que vale
function Vale({ v, de, para, children }: { v: Vale; de?: string; para?: string; children: React.ReactNode }) {
  const usado = !!v.redimido_en && !v.cumplido_en;
  const estado = v.cumplido_en ? `Cumplido el ${dia(v.cumplido_en)}`
    : v.redimido_en ? `${de ? 'Lo usaste' : `${para} lo usó`} el ${dia(v.redimido_en)}`
    : de ? `De ${de}` : `Para ${para} · sin usar`;
  return (
    <div className={`card p-0 flex items-stretch overflow-hidden ${v.cumplido_en ? 'opacity-70' : ''} ${usado && para ? 'border-durazno' : ''}`}>
      <div className={`w-16 shrink-0 flex items-center justify-center border-r-2 border-dashed border-menta ${v.cumplido_en ? 'bg-seleccion text-salvia' : 'bg-hondo text-lima'}`}>
        <IconoVale className="w-7 h-7" />
      </div>
      <div className="flex-1 min-w-0 p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="eyebrow">Cupón para</p>
          <p className="font-titulo text-lg font-semibold leading-tight">{v.titulo}</p>
          {v.detalle && <p className="text-sm text-salvia italic">{v.detalle}</p>}
          <p className="text-xs font-bold text-salvia mt-1 first-letter:uppercase">{estado}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
