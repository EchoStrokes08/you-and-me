import { Component, type ReactNode } from 'react';
import Ballena from './Ballena';

// Si una pantalla falla, mostrar un mensaje amable en lugar de dejar la app en blanco
export function PantallaError({ texto, onReintentar }: { texto: string; onReintentar: () => void }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-3 p-6 text-center">
      <Ballena className="w-32" />
      <p className="font-titulo text-2xl font-bold">Algo se enredó</p>
      <p className="text-salvia max-w-xs">{texto}</p>
      <button onClick={onReintentar} className="btn-primary mt-2">Reintentar</button>
    </div>
  );
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };

  static getDerivedStateFromError() {
    return { error: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (this.state.error) {
      // Recargar también trae la versión nueva si el fallo fue por un despliegue reciente
      return <PantallaError texto="Esta pantalla tuvo un problema. Revisa tu conexión e intenta de nuevo." onReintentar={() => window.location.reload()} />;
    }
    return this.props.children;
  }
}
