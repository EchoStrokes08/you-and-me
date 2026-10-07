// Clima con Open-Meteo (sin clave). Si no se sabe dónde es la cita, se usa Bogotá.
export const BOGOTA = { lat: 4.711, lng: -74.0721 };

export type Clima = { temp: number; code: number; lluvia: number | null };

// Con hora: el pronóstico de esa hora. Sin hora: la máxima del día.
export async function climaPara(fecha: string, lat = BOGOTA.lat, lng = BOGOTA.lng, hora?: string | null): Promise<Clima | null> {
  try {
    const base = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&timezone=America%2FBogota&start_date=${fecha}&end_date=${fecha}`;
    if (hora) {
      const j = await (await fetch(`${base}&hourly=temperature_2m,weathercode,precipitation_probability`)).json();
      const h = Number(hora.slice(0, 2));
      if (j.hourly?.temperature_2m?.[h] != null) {
        return { temp: Math.round(j.hourly.temperature_2m[h]), code: j.hourly.weathercode[h], lluvia: j.hourly.precipitation_probability?.[h] ?? null };
      }
    }
    const j = await (await fetch(`${base}&daily=temperature_2m_max,weathercode,precipitation_probability_max`)).json();
    if (j.daily?.temperature_2m_max?.length) {
      return { temp: Math.round(j.daily.temperature_2m_max[0]), code: j.daily.weathercode[0], lluvia: j.daily.precipitation_probability_max?.[0] ?? null };
    }
  } catch {}
  return null;
}

export const climaEmoji = (code: number) => {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 67) return '🌧️';
  return '⛈️';
};
