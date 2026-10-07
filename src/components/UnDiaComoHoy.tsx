import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { IconoFlecha } from './ui';

// Si hay un recuerdo de hace 1 mes, 6 meses o N años, aparece en el inicio con su foto
export default function UnDiaComoHoy() {
  const [r, setR] = useState<{ id: string; titulo: string; hace: string } | null>(null);
  const [foto, setFoto] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('recuerdo_de_hoy').then(async ({ data }) => {
      const rec = data?.[0];
      if (!rec) return;
      setR(rec);
      const { data: f } = await supabase.from('fotos_recuerdo').select('ruta').eq('recuerdo_id', rec.id).order('orden').limit(1).maybeSingle();
      if (f) {
        const { data: url } = await supabase.storage.from('recuerdos').createSignedUrl(f.ruta, 3600);
        setFoto(url?.signedUrl ?? null);
      }
    });
  }, []);

  if (!r) return null;
  return (
    <Link to="/historia" state={{ abrir: r.id }} className="card p-0 overflow-hidden relative block">
      {foto ? (
        <img src={foto} alt="" className="w-full h-44 object-cover" />
      ) : (
        <div className="h-24 bg-gradient-to-br from-esmeralda to-hondo" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-pino/85 via-pino/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4 text-white flex items-end gap-3">
        <div className="flex-1 min-w-0">
          <p className="eyebrow text-lima">📸 Un día como hoy · hace {r.hace}</p>
          <p className="font-titulo text-xl font-semibold leading-tight truncate">{r.titulo}</p>
        </div>
        <IconoFlecha className="w-5 h-5 shrink-0" />
      </div>
    </Link>
  );
}
