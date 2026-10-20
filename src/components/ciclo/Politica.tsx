// Aviso de privacidad y autorización para datos sensibles (Ley 1581 de 2012 y Decreto 1377 de 2013).
// Los datos de salud son sensibles: su tratamiento necesita autorización explícita, previa e informada,
// y nadie está obligado a darlos.
export function PoliticaCiclo({ nombreAdmin }: { nombreAdmin: string }) {
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed">
      <p><b>Qué datos.</b> Fechas del periodo, flujo, síntomas, dolor, estado de ánimo, temperatura, pruebas de ovulación y embarazo, notas y lo que importes de relojes o anillos. Son datos de salud: la ley los trata como <b>datos sensibles</b>.</p>
      <p><b>Para qué.</b> Solo para que veas y entiendas tu ciclo, predecir tus próximos días, generar tu informe para el médico y, si tú lo decides, compartir con tu pareja lo que escojas. Nada más.</p>
      <p><b>Es voluntario.</b> No tienes que dar ninguno de estos datos, ni contestar ninguna pregunta, para usar el resto de la app.</p>
      <p><b>Cómo se protegen.</b> Todo se cifra en tu celular antes de salir de él, con llaves que solo tú tienes. Lo que se guarda en el servidor son sobres cifrados que nadie puede leer: ni {nombreAdmin} como administrador de la app, ni Supabase (donde está la base), ni Vercel, ni quien tenga una copia de seguridad. Si escoges "solo este celular", tus registros ni siquiera se suben.</p>
      <p><b>Quién más los ve.</b> Nadie, salvo lo que tú actives en "Compartir", y lo puedes apagar cuando quieras. Las notificaciones a tu pareja solo dicen que le dejaste algo, nunca qué. Payakan, el asistente, no tiene acceso a esta sección.</p>
      <p><b>Cero venta de datos.</b> No se venden, alquilan ni ceden a nadie, no hay publicidad ni analítica en esta sección y no se usan para entrenar inteligencia artificial.</p>
      <p><b>Tus derechos.</b> Puedes conocer, actualizar, corregir, descargar y suprimir tus datos, y revocar esta autorización, en cualquier momento desde "Mis datos y privacidad". Borrar es inmediato y definitivo. Si algo no funciona, escríbele a {nombreAdmin}; también puedes acudir a la Superintendencia de Industria y Comercio.</p>
      <p><b>Fuera de Colombia.</b> La base está en servidores de Supabase fuera del país; como solo guarda datos cifrados que no puede leer, no recibe tu información en claro. El diseño sigue también los principios del GDPR europeo para datos de salud: consentimiento explícito, minimización, portabilidad y supresión.</p>
      <p className="text-salvia">Versión del 20 de octubre de 2026.</p>
    </div>
  );
}
