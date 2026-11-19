// En Ajustes: dejar quieto el fondo marino en este celular, para los teléfonos a los que se les hace pesado.
import { guardarFondoQuieto, useFondoQuieto } from '../../lib/fondo';
import { Interruptor } from '../ciclo/comunes';

export default function InterruptorFondo() {
  const quieto = useFondoQuieto();
  return (
    <div className="shrink-0 rounded-3xl bg-tarjeta border border-menta overflow-hidden">
      <Interruptor
        activo={!quieto}
        onCambio={(animado) => guardarFondoQuieto(!animado)}
        titulo="Fondo animado"
        detalle={quieto ? 'Quieto en este celular: la app va más liviana.' : 'Si el celular va lento, apágalo para dejar el mar quieto.'}
      />
    </div>
  );
}
