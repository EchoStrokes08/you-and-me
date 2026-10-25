// Hoja con las conversaciones guardadas con Payakan: entrar a una, borrarla o empezar una nueva.
// La usa la sección Aprender del ciclo; la lista y las acciones las trae quien la monta.
import { Hoja, IconoBasura, IconoMas } from './ui';

export type ConversacionResumen = { id: string; titulo: string; actualizada: string };

const cuando = (iso: string) => {
  const d = new Date(iso);
  const dias = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (dias === 0) return `Hoy, ${d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}`;
  if (dias === 1) return 'Ayer';
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
};

// Las conversaciones guardadas con Payakan: abrir una, borrarla o empezar otra
export default function HistorialConversaciones({ abierta, onClose, titulo = 'Conversaciones', nota, lista, actual, onAbrir, onBorrar, onNueva }: {
  abierta: boolean; onClose: () => void; titulo?: string; nota?: string;
  lista: ConversacionResumen[]; actual: string | null;
  onAbrir: (id: string) => void; onBorrar: (id: string) => void; onNueva: () => void;
}) {
  return (
    <Hoja abierta={abierta} onClose={onClose} titulo={titulo}>
      <button type="button" className="btn-primary self-stretch" onClick={() => { onNueva(); onClose(); }}>
        <IconoMas className="w-5 h-5" />Conversación nueva
      </button>
      {nota && <p className="text-sm text-salvia -mt-2">{nota}</p>}
      {lista.length === 0 ? (
        <p className="text-salvia text-center py-4">Todavía no hay conversaciones guardadas.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <button type="button" onClick={() => { onAbrir(c.id); onClose(); }} aria-current={c.id === actual ? 'true' : undefined}
                className={`fila-aviso min-h-14 flex-1 min-w-0 text-left ${c.id === actual ? 'ring-2 ring-esmeralda' : ''}`}>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold leading-tight truncate">{c.titulo}</span>
                  <span className="block text-xs text-salvia">{cuando(c.actualizada)}</span>
                </span>
              </button>
              <button type="button" onClick={() => onBorrar(c.id)} className="btn-icon shrink-0" aria-label={`Borrar la conversación "${c.titulo}"`}>
                <IconoBasura className="w-5 h-5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Hoja>
  );
}
