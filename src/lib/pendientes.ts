import { createContext, useContext } from 'react';

// Citas que esperan confirmación del admin (las cuenta el Shell en App.tsx)
export const PendientesContext = createContext(0);
export const usePendientes = () => useContext(PendientesContext);
