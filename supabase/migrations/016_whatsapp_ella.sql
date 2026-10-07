-- 016_whatsapp_ella.sql
-- WhatsApp de ella: cuando él crea o edita una cita, el aviso le llega a ella

begin;

alter table public.configuracion add column if not exists whatsapp_ella text not null default '573197020914';

commit;
