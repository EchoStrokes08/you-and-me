// Contexto con el número de citas esperando confirmación del admin (las cuenta el Shell de
// App.tsx al día con Realtime); lo consume la pestaña de navegación para mostrar su aviso.
import { createContext, useContext } from 'react';

// Citas que esperan confirmación del admin (las cuenta el Shell en App.tsx)
export const PendientesContext = createContext(0);
export const usePendientes = () => useContext(PendientesContext);
