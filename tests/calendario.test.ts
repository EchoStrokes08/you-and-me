// Pruebas de src/lib/calendario: el evento de una cita y sus links a Google Calendar e ICS.
// Cuidado con la zona horaria: las horas esperadas fijan America/Bogota, sin mocks.
import { describe, expect, it } from 'vitest';
import { eventoDeCita, linkGoogle, linkIcs } from '../src/lib/calendario';

const cita = {
  fecha: '2026-10-16', hora_confirmada: '19:30:00', es_cita_sorpresa: false,
  lugares: { nombre: 'Monserrate' }, lugar_personalizado: null, lugar_direccion: 'Cra. 2 Este #21-48', lugar_lat: 4.6, lugar_lng: -74.05,
  actividades: { nombre: 'Ver el atardecer' }, franjas: { nombre: 'Noche' }, nota_admin: 'Lleva chaqueta',
};

describe('eventoDeCita', () => {
  it('arma el evento con lugar, hora y detalles', () => {
    expect(eventoDeCita(cita, false)).toEqual({
      titulo: 'Cita 💚 Monserrate', fecha: '2026-10-16', hora: '19:30', lugar: 'Cra. 2 Este #21-48',
      detalles: 'Ver el atardecer\nNoche\nLleva chaqueta\nhttps://www.google.com/maps/search/?api=1&query=4.6,-74.05',
    });
  });

  it('una sorpresa no le cuenta a ella ni el lugar, ni la actividad, ni el mapa', () => {
    const e = eventoDeCita({ ...cita, es_cita_sorpresa: true }, true);
    expect(e.titulo).toBe('Cita sorpresa 🎁💚');
    expect(e.lugar).toBe('');
    expect(e.detalles).toBe('Noche\nLleva chaqueta');
  });

  it('a quien la planeó sí se le muestra todo', () => {
    expect(eventoDeCita({ ...cita, es_cita_sorpresa: true }, false).titulo).toBe('Cita 💚 Monserrate');
  });
});

describe('links de calendario', () => {
  it('Google: con hora dura 3 horas, en hora de Bogotá', () => {
    const u = new URL(linkGoogle(eventoDeCita(cita, false)));
    expect(u.searchParams.get('dates')).toBe('20261017T003000Z/20261017T033000Z');
    expect(u.searchParams.get('ctz')).toBe('America/Bogota');
  });

  it('Google: sin hora es de todo el día y termina al día siguiente', () => {
    const u = new URL(linkGoogle(eventoDeCita({ ...cita, hora_confirmada: null, fecha: '2026-12-31' }, false)));
    expect(u.searchParams.get('dates')).toBe('20261231/20270101');
  });

  it('.ics: la hora solo va si la cita tiene', () => {
    const conHora = new URLSearchParams(linkIcs(eventoDeCita(cita, false)).split('?')[1]);
    expect(conHora.get('h')).toBe('19:30');
    expect(conHora.get('t')).toBe('Cita 💚 Monserrate');
    const sinHora = new URLSearchParams(linkIcs(eventoDeCita({ ...cita, hora_confirmada: null }, false)).split('?')[1]);
    expect(sinHora.has('h')).toBe(false);
  });
});
