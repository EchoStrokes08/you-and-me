// Clima Bogotá con Open-Meteo (sin clave)
export async function climaBogota(fecha: string): Promise<{ temp: number; code: number } | null> {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=4.711&longitude=-74.0721&daily=temperature_2m_max,weathercode&timezone=America%2FBogota&start_date=${fecha}&end_date=${fecha}`);
    const j = await r.json();
    if (j.daily?.temperature_2m_max?.length) return { temp: Math.round(j.daily.temperature_2m_max[0]), code: j.daily.weathercode[0] };
  } catch {}
  return null;
}

export const climaEmoji = (code: number) => {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 67) return '🌧️';
  return '⛈️';
};
