// Lluvia de corazones para celebrar, con las mascotas desfilando detrás; ocupa toda la pantalla pero deja pasar los toques.
// Los corazones salen al azar una sola vez al montar: si se remonta, cambia el sorteo.
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Corazon } from './ui';
import { DesfileMascotas } from './MascotaDinamica';

const tonos = ['#2F8F63', '#1F6B4A', '#C3E08A', '#5E8571', '#F2B8A0'];

export default function HeartRain() {
  // Posiciones al azar una sola vez, al montar
  const [hearts] = useState(() => Array.from({ length: 28 }).map((_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    dur: 1.8 + Math.random() * 1.6,
    size: 14 + Math.random() * 20,
    giro: (Math.random() - 0.5) * 60,
    color: tonos[i % tonos.length],
  })));
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {hearts.map((h, i) => (
        <motion.span
          key={i}
          initial={{ y: -40, opacity: 0, rotate: 0 }}
          animate={{ y: '110vh', opacity: [0, 1, 1, 0], rotate: h.giro }}
          transition={{ duration: h.dur, delay: h.delay, ease: 'easeIn' }}
          style={{ position: 'absolute', left: `${h.left}%`, width: h.size, height: h.size, color: h.color }}
        ><Corazon className="w-full h-full" /></motion.span>
      ))}
      <DesfileMascotas className="absolute inset-0" />
    </div>
  );
}
