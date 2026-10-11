import { useState } from 'react';
import { reproductor } from '../lib/musica';
import { IconoCamara, IconoMusica, IconoPlay } from './ui';

// Una canción: título, artista y el reproductor (se carga al tocar "Escuchar")
export default function Cancion({ c, acciones }: { c: any; acciones?: React.ReactNode }) {
  const [sonando, setSonando] = useState(false);
  const rep = reproductor(c.url);
  return (
    <div className="card p-3 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 shrink-0 rounded-2xl bg-hondo text-white flex items-center justify-center"><IconoMusica className="w-5 h-5" /></span>
        <div className="flex-1 min-w-0">
          <p className="font-bold leading-tight truncate">{c.titulo}</p>
          {c.artista && <p className="text-sm text-salvia truncate">{c.artista}</p>}
        </div>
        {rep ? (
          <button onClick={() => setSonando(!sonando)} data-active={sonando} className="chip px-3 text-sm shrink-0">{sonando ? 'Ocultar' : <><IconoPlay className="w-4 h-4" /> Escuchar</>}</button>
        ) : c.url ? (
          <a href={c.url} target="_blank" rel="noreferrer" className="chip px-3 text-sm shrink-0">Abrir</a>
        ) : null}
        {acciones}
      </div>
      {c.nota && <p className="text-sm text-bosque-oscuro/80 italic">“{c.nota}”</p>}
      {c.recuerdos?.titulo && <p className="text-sm text-salvia flex items-center gap-1.5"><IconoCamara className="w-4 h-4" /> {c.recuerdos.titulo}</p>}
      {sonando && rep && (
        <iframe src={rep.embed} height={rep.alto} className="w-full rounded-2xl border-0" loading="lazy" title={c.titulo}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" />
      )}
    </div>
  );
}
