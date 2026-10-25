// El mapa base de la app (Leaflet + OpenStreetMap): cómo se crea, centro y zoom de Bogotá, los pines
// de corazón para los lugares y los de ballenita. Lo usan las pantallas Lugares, la de mirar
// recuerdos y la de elegir el sitio de una cita.
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

// Ballenita simplificada (mismos trazos que components/mascotas/Ballena.tsx, sin motas ni pliegues) para usar dentro de los pines
const CUERPO = 'M38 33 C48 38 60 42 74 42 C100 37 128 31 160 31 C190 31 214 35 226 42 C234 46 235 51 231 55 C222 68 206 82 184 89 C158 97 126 96 102 89 C78 81 58 66 46 54 C42 48 40 41 38 33 Z';
let idBallena = 0;
const ballena = (color: string, panza: string, ancho: number) => {
  const clip = `pin-cuerpo-${idBallena++}`;
  return `
  <svg viewBox="4 10 234 114" width="${ancho}" height="${Math.round(ancho * 114 / 234)}" aria-hidden="true" style="display:block">
    <defs><clipPath id="${clip}"><path d="${CUERPO}"/></clipPath></defs>
    <path d="M40 34 C42 26 48 19 55 15 C57 21 55 29 49 37 Z" fill="${color}"/>
    <path d="M42 33 C32 29 18 26 7 27 C12 33 24 40 42 45 Z" fill="${color}"/>
    <path d="M82 41 C86 34 94 33 100 34 C98 36 100 39 106 40 Z" fill="${color}"/>
    <path d="M156 92 C154 102 151 112 152 121 C158 120 162 116 165 110 C168 104 171 98 174 92 Z" fill="${color}"/>
    <path d="${CUERPO}" fill="${color}"/>
    <g clip-path="url(#${clip})">
      <path d="M232 47 C222 49 208 49 196 51 C184 54 172 60 160 66 C148 71 130 72 112 71 C92 70 72 62 50 52 L40 60 L40 140 L240 140 L240 47 Z" fill="${panza}"/>
    </g>
    <path d="M231 49 C218 50 204 50 192 53 C182 56 172 61 160 67" stroke="#0E2A20" stroke-opacity=".4" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M136 68 C126 82 108 102 97 118 C102 121 108 120 112 117 C116 117 119 113 123 112 C126 109 129 107 131 103 C135 96 141 86 150 72 Z" fill="${color}"/>
    <path d="M97 118 C102 121 108 120 112 117 C116 117 119 113 123 112 C126 109 129 107 131 103 C135 96 141 86 150 72 L147 72 C139 86 132 96 127 103 C122 108 114 112 100 117 Z" fill="${panza}"/>
    <circle cx="163" cy="57" r="7" fill="#0E2A20"/>
    <circle cx="165" cy="54.5" r="2.4" fill="#fff"/>
    <ellipse cx="152" cy="64" rx="6" ry="3.6" fill="#F2B8A0" opacity=".8"/>
  </svg>`;
};

export type TipoPin = 'vivido' | 'proximo' | 'deseo';

/** Pin en forma de burbuja con una ballena; muestra cuántas veces hemos ido */
export function pinBallena(tipo: TipoPin, visitas: number, activo = false) {
  const s = activo ? 56 : 46;
  // Por conocer: durazno y borde punteado, para que se distinga de lo vivido y de lo que viene
  const fondo = tipo === 'vivido' ? '#1F6B4A' : tipo === 'deseo' ? '#FBE3D8' : '#FFFFFD';
  const borde = tipo === 'vivido' ? '#FFFFFF' : tipo === 'deseo' ? '#A94E35' : '#2F8F63';
  const ancho = s - 12;
  const whale = tipo === 'vivido' ? ballena('#CFE9E4', '#FFFFFF', ancho) : tipo === 'deseo' ? ballena('#A94E35', '#F2B8A0', ancho) : ballena('#2C6E73', '#CFE9E4', ancho);
  const badge = visitas > 1
    ? `<span style="position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#C3E08A;color:#0E2A20;font:800 11px Nunito,sans-serif;display:flex;align-items:center;justify-content:center;border:2px solid #fff">${visitas}</span>`
    : '';
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:${s}px;height:${s + 10}px;transition:transform .2s">
      <div style="width:${s}px;height:${s}px;border-radius:50%;background:${fondo};border:3px ${tipo === 'deseo' ? 'dashed' : 'solid'} ${borde};display:flex;align-items:center;justify-content:center;box-shadow:0 8px 18px -6px rgba(14,42,32,.55)${activo ? ',0 0 0 6px rgba(195,224,138,.6)' : ''}">${whale}</div>
      <div style="position:absolute;left:50%;bottom:0;width:12px;height:12px;background:${borde};transform:translateX(-50%) rotate(45deg);border-radius:2px;z-index:-1"></div>
      ${badge}
    </div>`,
    iconSize: [s, s + 10],
    iconAnchor: [s / 2, s + 6],
  });
}
