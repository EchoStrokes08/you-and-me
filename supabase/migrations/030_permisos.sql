-- 030_permisos.sql — El permiso de admin sale de perfiles a su propia tabla
-- perfiles.rol sigue diciendo quién es quién (admin = él, pareja = ella): de ahí salen los nombres,
-- el WhatsApp y los avisos de cumpleaños. permisos.es_admin dice quién ve y hace lo del admin
-- (panel, catálogos, configuración, sorpresas, editar lo del otro).
-- Se prende y se apaga solo desde el SQL Editor; la app no puede escribir en esta tabla:
--   update public.permisos set es_admin = true  where usuario_id = (select id from public.perfiles where nombre = 'Sarah');
--   update public.permisos set es_admin = false where usuario_id = (select id from public.perfiles where nombre = 'Sarah');

begin;

create table if not exists public.permisos (
  usuario_id uuid primary key references public.perfiles(id) on delete cascade,
  es_admin boolean not null default false
);

insert into public.permisos (usuario_id, es_admin)
select id, rol = 'admin' from public.perfiles
on conflict (usuario_id) do nothing;

alter table public.permisos enable row level security;
drop policy if exists permisos_select on public.permisos;
create policy permisos_select on public.permisos for select to authenticated using (true);
revoke all on public.permisos from anon, authenticated;
grant select on public.permisos to authenticated;

-- Todas las políticas pasan por aquí: con esto ya miran el permiso y no el rol
create or replace function public.es_admin()
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists(select 1 from public.permisos p where p.usuario_id = auth.uid() and p.es_admin);
$$;

-- Igual que en 026, pero le dice a la función de Vercel quién tiene el permiso de admin
create or replace function public.enviar_push(p_destino uuid, p_evento text, p_nombre text, p_datos jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  subs jsonb;
  v_url text;
  v_secreto text;
begin
  if exists (select 1 from perfiles where id = p_destino and grupo_aviso(p_evento) = any(avisos_silenciados)) then return; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'endpoint', s.endpoint,
           'keys', jsonb_build_object('p256dh', s.p256dh, 'auth', s.auth),
           'rol', p.rol,
           'es_admin', coalesce(pm.es_admin, false))), '[]'::jsonb)
    into subs
    from suscripciones_push s
    left join perfiles p on p.id = s.usuario_id
    left join permisos pm on pm.usuario_id = s.usuario_id
   where s.usuario_id = p_destino;

  if jsonb_array_length(subs) = 0 then return; end if;

  select valor into v_url from privado.ajustes where clave = 'notif_url';
  select valor into v_secreto from privado.ajustes where clave = 'notif_secreto';
  if v_url is null or v_secreto is null then return; end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('evento', p_evento, 'nombre', p_nombre, 'datos', p_datos, 'subs', subs),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-secreto', v_secreto)
  );
end;
$$;
revoke execute on function public.enviar_push(uuid, text, text, jsonb) from public, anon, authenticated;

-- Igual que en 025, pero el recordatorio le llega a quien tenga el permiso
create or replace function public.avisar_copia_pendiente()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  c record;
  destino uuid;
begin
  select ultima_copia, copia_avisada_en into c from configuracion where id = 1;
  if c.ultima_copia is not null and c.ultima_copia > now() - interval '30 days' then return; end if;
  if c.copia_avisada_en is not null and c.copia_avisada_en > hoy_bogota() - 7 then return; end if;

  for destino in select usuario_id from permisos where es_admin loop
    perform enviar_push(destino, 'copia_pendiente', '', jsonb_build_object(
      'dias', case when c.ultima_copia is null then null else hoy_bogota() - (c.ultima_copia at time zone 'America/Bogota')::date end));
  end loop;
  update configuracion set copia_avisada_en = hoy_bogota() where id = 1;
end;
$$;
revoke execute on function public.avisar_copia_pendiente() from public, anon, authenticated;

commit;
