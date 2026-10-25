// Cómo se muestra lo que responde Payakan: negritas, enlaces y listas simples, sin librerías ni HTML crudo.
// Lo usan las conversaciones con el asistente, por ejemplo en Aprender del ciclo.
import { Fragment, type ReactNode } from 'react';

// Negritas, enlaces y listas sencillas, sin librerías: lo que suele escribir Payakan
export default function TextoPayakan({ texto }: { texto: string }) {
  const enLinea = (t: string, k: string): ReactNode[] =>
    t.split(/(\*\*[^*]+\*\*|https?:\/\/[^\s)]+)/g).map((p, i) => {
      if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={`${k}-${i}`}>{p.slice(2, -2)}</strong>;
      if (/^https?:\/\//.test(p)) return <a key={`${k}-${i}`} href={p} target="_blank" rel="noreferrer" className="underline font-bold break-all">{new URL(p).hostname.replace(/^www\./, '')}</a>;
      return <Fragment key={`${k}-${i}`}>{p}</Fragment>;
    });
  const bloques = texto.replace(/^#+\s*/gm, '').split(/\n{2,}/);
  return (
    <>
      {bloques.map((b, i) => {
        const lineas = b.split('\n');
        if (lineas.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
          return (
            <ul key={i} className="flex flex-col gap-1 pl-1">
              {lineas.map((l, j) => <li key={j} className="flex gap-2"><span className="text-esmeralda shrink-0">•</span><span>{enLinea(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ''), `${i}-${j}`)}</span></li>)}
            </ul>
          );
        }
        return <p key={i}>{lineas.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{enLinea(l, `${i}-${j}`)}</Fragment>)}</p>;
      })}
    </>
  );
}
