export function Cargando() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-3" role="status" aria-live="polite">
      <span className="w-10 h-10 rounded-full border-4 border-menta border-t-bosque animate-spin" aria-hidden="true" />
      <p className="eyebrow">Nadando hacia ti…</p>
    </div>
  );
}
