import { motion } from 'framer-motion';
import { Corazon } from './ui';

export default function HeartsProgress({ paso, total }: { paso: number; total: number }) {
  return (
    <div className="flex flex-col items-center gap-1 py-1">
      <div className="flex gap-1.5 justify-center">
        {Array.from({ length: total }).map((_, i) => (
          <motion.span key={i} animate={{ scale: i === paso - 1 ? 1.25 : 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className={i < paso ? 'text-esmeralda' : 'text-menta'}>
            <Corazon className="w-4 h-4" lleno={i < paso} />
          </motion.span>
        ))}
      </div>
      <p className="text-xs font-bold text-salvia">Paso {paso} de {total}</p>
    </div>
  );
}
