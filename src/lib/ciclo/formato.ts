import type { Permisos } from './tipos';

export const fechaCorta = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
export const fechaDia = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

export const resumenPermisos = (p: Permisos) => {
  const partes = [p.periodo && 'fechas del periodo', p.fase && 'fase', p.animo && 'ánimo', p.sintomas && 'síntomas', p.fertil && 'ventana fértil', p.planificacion && 'planificación'].filter(Boolean);
  return partes.length ? partes.join(', ') : 'solo lo que le cuentes con los botones';
};

export const descargar = (datos: BlobPart, nombre: string, tipo: string) => {
  const url = URL.createObjectURL(new Blob([datos], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
