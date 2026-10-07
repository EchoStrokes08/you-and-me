import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export const BOGOTA: L.LatLngTuple = [4.6533, -74.0836];

/** Crea un mapa Leaflet con los mosaicos y controles de la app */
export function crearMapa(el: HTMLElement, centro: L.LatLngTuple = BOGOTA, zoom = 12) {
  const m = L.map(el, { zoomControl: false, attributionControl: true }).setView(centro, zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(m);
  L.control.zoom({ position: 'bottomright' }).addTo(m);
  return m;
}

/** Pin verde con corazón, para elegir un punto */
export const pinCorazon = L.divIcon({
  className: '',
  html: `<svg viewBox="0 0 40 52" width="40" height="52" style="filter: drop-shadow(0 6px 8px rgba(14,42,32,.35))">
    <path d="M20 51C20 51 38 31 38 19A18 18 0 0 0 2 19C2 31 20 51 20 51Z" fill="#1F6B4A" stroke="#fff" stroke-width="2.5"/>
    <path d="M20 27s-6-3.7-7.7-7.4c-1.2-2.7.5-5.8 3.4-5.8 1.7 0 2.8.9 4.3 2.4 1.5-1.5 2.6-2.4 4.3-2.4 2.9 0 4.6 3.1 3.4 5.8C26 23.3 20 27 20 27Z" fill="#C3E08A"/>
  </svg>`,
  iconSize: [40, 52],
  iconAnchor: [20, 50],
});

// Ballenita simplificada (mismos trazos que components/Ballena.tsx) para usar dentro de los pines
const ballena = (color: string, panza: string) => `
  <svg viewBox="0 0 200 130" width="30" height="20" aria-hidden="true">
    <path d="M50 82 C36 78 26 66 22 52 C16 48 6 48 2 52 C6 40 18 36 26 40 C26 30 34 22 44 22 C38 30 36 40 38 50 C42 62 52 70 64 72 Z" fill="${color}"/>
    <path d="M40 82 C40 54 72 36 112 36 C156 36 190 58 190 86 C190 106 172 118 144 118 L82 118 C56 118 40 102 40 82 Z" fill="${color}"/>
    <path d="M58 104 C80 116 150 120 184 98 C178 110 164 118 144 118 L82 118 C70 118 62 112 58 104 Z" fill="${panza}"/>
    <circle cx="160" cy="78" r="8" fill="#0E2A20"/>
    <circle cx="172" cy="92" r="8" fill="#F2B8A0" opacity=".8"/>
  </svg>`;

export type TipoPin = 'vivido' | 'proximo';

/** Pin en forma de burbuja con una ballena; muestra cuántas veces hemos ido */
export function pinBallena(tipo: TipoPin, visitas: number, activo = false) {
  const s = activo ? 56 : 46;
  const fondo = tipo === 'vivido' ? '#1F6B4A' : '#FFFFFD';
  const borde = tipo === 'vivido' ? '#FFFFFF' : '#2F8F63';
  const whale = tipo === 'vivido' ? ballena('#CFE9E4', '#FFFFFF') : ballena('#2C6E73', '#CFE9E4');
  const badge = visitas > 1
    ? `<span style="position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#C3E08A;color:#0E2A20;font:800 11px Nunito,sans-serif;display:flex;align-items:center;justify-content:center;border:2px solid #fff">${visitas}</span>`
    : '';
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:${s}px;height:${s + 10}px;transition:transform .2s">
      <div style="width:${s}px;height:${s}px;border-radius:50%;background:${fondo};border:3px solid ${borde};display:flex;align-items:center;justify-content:center;box-shadow:0 8px 18px -6px rgba(14,42,32,.55)${activo ? ',0 0 0 6px rgba(195,224,138,.6)' : ''}">${whale}</div>
      <div style="position:absolute;left:50%;bottom:0;width:12px;height:12px;background:${borde};transform:translateX(-50%) rotate(45deg);border-radius:2px;z-index:-1"></div>
      ${badge}
    </div>`,
    iconSize: [s, s + 10],
    iconAnchor: [s / 2, s + 6],
  });
}
