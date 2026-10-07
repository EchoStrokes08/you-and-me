-- 001_esquema.sql — Esquema, RLS, funciones y storage
-- Ejecutar en el SQL Editor de Supabase o con psql.

create extension if not exists pgcrypto;

-- ============ TABLAS ============

create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  rol text not null default 'pareja' check (rol in ('admin','pareja'))
);

create table if not exists public.configuracion (
  id int primary key default 1 check (id = 1),
  nombre_app text not null default 'You and me 💚',
  nombre_ella text not null default 'Sarah',
  apodo_ella text not null default 'Ma vie',
  nombre_el text not null default 'Oscar',
  fecha_inicio date not null default '2025-03-30',
  whatsapp text not null default '573135746229',
  color_principal text not null default '#2F6B4F'
);

create table if not exists public.categorias_cita (
  slug text primary key,
  nombre text not null,
  emoji text not null default '✨',
  color text not null default '#8FB39A',
  descripcion text not null default '',
  activo boolean not null default true,
  orden int not null default 0
);

create table if not exists public.lugares (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  zona text not null default '',
  descripcion text not null default '',
  emoji text not null default '📍',
  imagen_url text,
  categorias text[] not null default '{}',
  precio int not null default 2 check (precio between 1 and 4),
  duracion text not null default '',
  link_maps text,
  es_sorpresa boolean not null default false,
  es_escapada boolean not null default false,
  activo boolean not null default true,
  orden int not null default 0
);

create table if not exists public.actividades (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text not null default '',
  emoji text not null default '✨',
  imagen_url text,
  precio int not null default 2 check (precio between 1 and 4),
  dias_permitidos int[],
  nota text,
  es_comodin boolean not null default false,
  es_sorpresa boolean not null default false,
  activo boolean not null default true,
  orden int not null default 0
);

create table if not exists public.lugar_actividad (
  lugar_id uuid not null references public.lugares(id) on delete cascade,
  actividad_id uuid not null references public.actividades(id) on delete cascade,
  primary key (lugar_id, actividad_id)
);

create table if not exists public.franjas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  emoji text not null default '🕐',
  horario text not null default '',
  activo boolean not null default true,
  orden int not null default 0
);

create table if not exists public.opciones_llevar (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('detalle','vestimenta')),
  nombre text not null,
  descripcion text not null default '',
  emoji text not null default '🎁',
  imagen_url text,
  es_sorpresa boolean not null default false,
  activo boolean not null default true,
  orden int not null default 0
);

create table if not exists public.fechas_no_disponibles (
  fecha date primary key,
  motivo text
);

create table if not exists public.citas (
  id uuid primary key default gen_random_uuid(),
  creada_por uuid not null references auth.users(id),
  categoria_slug text references public.categorias_cita(slug),
  lugar_id uuid references public.lugares(id),
  actividad_id uuid references public.actividades(id),
  fecha date,
  franja_id uuid references public.franjas(id),
  vestimenta_id uuid references public.opciones_llevar(id),
  es_cita_sorpresa boolean not null default false,
  nota_ella text,
  estado text not null default 'pendiente' check (estado in ('pendiente','confirmada','vivida','cancelada')),
  hora_confirmada time,
  nota_admin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cita_detalles (
  cita_id uuid not null references public.citas(id) on delete cascade,
  opcion_id uuid not null references public.opciones_llevar(id),
  primary key (cita_id, opcion_id)
);

create table if not exists public.categorias_preguntas (
  slug text primary key,
  nombre text not null,
  emoji text not null default '💬',
  color text not null default '#8FB39A',
  activo boolean not null default true,
  orden int not null default 0
);

create table if not exists public.preguntas (
  id uuid primary key default gen_random_uuid(),
  categoria_slug text not null references public.categorias_preguntas(slug),
  texto text not null,
  activo boolean not null default true,
  orden int not null default 0
);

create table if not exists public.pregunta_del_dia (
  fecha date primary key,
  pregunta_id uuid not null references public.preguntas(id)
);

create table if not exists public.respuestas (
  id uuid primary key default gen_random_uuid(),
  pregunta_id uuid not null references public.preguntas(id) on delete cascade,
  usuario_id uuid not null references auth.users(id),
  texto text not null,
  created_at timestamptz not null default now(),
  unique (pregunta_id, usuario_id)
);

create table if not exists public.preguntas_conversadas (
  pregunta_id uuid primary key references public.preguntas(id) on delete cascade,
  fecha date not null default current_date
);

create table if not exists public.recuerdos (
  id uuid primary key default gen_random_uuid(),
  cita_id uuid references public.citas(id) on delete set null,
  titulo text not null,
  fecha date not null,
  lugar_texto text not null default '',
  descripcion text not null default '',
  calificacion int not null default 5 check (calificacion between 1 and 5),
  creado_por uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.fotos_recuerdo (
  id uuid primary key default gen_random_uuid(),
  recuerdo_id uuid not null references public.recuerdos(id) on delete cascade,
  ruta text not null,
  orden int not null default 0
);

create table if not exists public.notas_recuerdo (
  id uuid primary key default gen_random_uuid(),
  recuerdo_id uuid not null references public.recuerdos(id) on delete cascade,
  usuario_id uuid not null references auth.users(id),
  texto text not null,
  created_at timestamptz not null default now()
);

-- ============ TRIGGERS Y FUNCIONES ============

-- Crear perfil al registrar usuario
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, rol)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)), 'pareja')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trg_citas_updated on public.citas;
create trigger trg_citas_updated before update on public.citas
  for each row execute function public.touch_updated_at();

-- Máximo 2 detalles por cita
create or replace function public.max_dos_detalles()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.cita_detalles where cita_id = new.cita_id) >= 2 then
    raise exception 'Una cita admite máximo 2 detalles';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_max_detalles on public.cita_detalles;
create trigger trg_max_detalles before insert on public.cita_detalles
  for each row execute function public.max_dos_detalles();

-- es_admin()
create or replace function public.es_admin()
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists(select 1 from public.perfiles where id = auth.uid() and rol = 'admin');
$$;

-- Pregunta del día: la misma para los dos, elegida una vez por día
create or replace function public.obtener_pregunta_del_dia()
returns public.preguntas
language plpgsql security definer set search_path = public
as $$
declare
  hoy date := (now() at time zone 'America/Bogota')::date;
  pid uuid;
  preg public.preguntas;
begin
  select pregunta_id into pid from public.pregunta_del_dia where fecha = hoy;

  if pid is null then
    select p.id into pid
    from public.preguntas p
    where p.activo
    order by (select max(fecha) from public.pregunta_del_dia where pregunta_id = p.id) nulls first, random()
    limit 1;

    insert into public.pregunta_del_dia (fecha, pregunta_id)
    values (hoy, pid)
    on conflict (fecha) do nothing;

    select pregunta_id into pid from public.pregunta_del_dia where fecha = hoy;
  end if;

  select * into preg from public.preguntas where id = pid;
  return preg;
end;
$$;

-- Respuestas respetando la regla de visibilidad:
-- solo ves la del otro cuando ya escribiste la tuya.
create or replace function public.obtener_respuestas(p_pregunta_id uuid)
returns setof public.respuestas
language plpgsql security definer set search_path = public stable
as $$
begin
  return query
    select r.* from public.respuestas r
    where r.pregunta_id = p_pregunta_id
      and (
        r.usuario_id = auth.uid()
        or exists (
          select 1 from public.respuestas m
          where m.pregunta_id = p_pregunta_id and m.usuario_id = auth.uid()
        )
      )
    order by r.created_at;
end;
$$;

-- ============ RLS ============

alter table public.perfiles enable row level security;
alter table public.configuracion enable row level security;
alter table public.categorias_cita enable row level security;
alter table public.lugares enable row level security;
alter table public.actividades enable row level security;
alter table public.lugar_actividad enable row level security;
alter table public.franjas enable row level security;
alter table public.opciones_llevar enable row level security;
alter table public.fechas_no_disponibles enable row level security;
alter table public.citas enable row level security;
alter table public.cita_detalles enable row level security;
alter table public.categorias_preguntas enable row level security;
alter table public.preguntas enable row level security;
alter table public.pregunta_del_dia enable row level security;
alter table public.respuestas enable row level security;
alter table public.preguntas_conversadas enable row level security;
alter table public.recuerdos enable row level security;
alter table public.fotos_recuerdo enable row level security;
alter table public.notas_recuerdo enable row level security;

-- perfiles: ambos se leen; cada uno edita su nombre; rol lo cambia admin (o SQL)
create policy perfiles_select on public.perfiles for select to authenticated using (true);
create policy perfiles_update on public.perfiles for update to authenticated
  using (id = auth.uid() or public.es_admin())
  with check (id = auth.uid() or public.es_admin());

-- configuracion: lectura para ambos, escritura admin
create policy config_select on public.configuracion for select to authenticated using (true);
create policy config_update on public.configuracion for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy config_insert on public.configuracion for insert to authenticated with check (public.es_admin());

-- Catálogos: lectura para ambos, escritura admin
do $$
declare t text;
begin
  foreach t in array array['categorias_cita','lugares','actividades','lugar_actividad','franjas','opciones_llevar','fechas_no_disponibles','categorias_preguntas','preguntas'] loop
    execute format('create policy %I_select on public.%I for select to authenticated using (true)', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (public.es_admin())', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated using (public.es_admin()) with check (public.es_admin())', t, t);
    execute format('create policy %I_delete on public.%I for delete to authenticated using (public.es_admin())', t, t);
  end loop;
end $$;

-- pregunta_del_dia: todos leen; la función (security definer) inserta; admin gestiona
create policy pregunta_del_dia_select on public.pregunta_del_dia for select to authenticated using (true);
create policy pregunta_del_dia_insert on public.pregunta_del_dia for insert to authenticated with check (true);
create policy pregunta_del_dia_update on public.pregunta_del_dia for update to authenticated using (public.es_admin());
create policy pregunta_del_dia_delete on public.pregunta_del_dia for delete to authenticated using (public.es_admin());

-- conversadas: ambos leen y marcan; ambos pueden reiniciar
create policy conversadas_select on public.preguntas_conversadas for select to authenticated using (true);
create policy conversadas_insert on public.preguntas_conversadas for insert to authenticated with check (true);
create policy conversadas_delete on public.preguntas_conversadas for delete to authenticated using (true);

-- citas
create policy citas_select on public.citas for select to authenticated using (true);
create policy citas_insert on public.citas for insert to authenticated with check (creada_por = auth.uid());
create policy citas_update on public.citas for update to authenticated
  using (public.es_admin() or (creada_por = auth.uid() and estado = 'pendiente'))
  with check (public.es_admin() or (creada_por = auth.uid() and estado in ('pendiente','cancelada')));
create policy citas_delete on public.citas for delete to authenticated using (public.es_admin());

create policy cita_detalles_select on public.cita_detalles for select to authenticated using (true);
create policy cita_detalles_insert on public.cita_detalles for insert to authenticated with check (true);
create policy cita_detalles_delete on public.cita_detalles for delete to authenticated using (
  public.es_admin() or exists(select 1 from public.citas c where c.id = cita_id and c.creada_por = auth.uid() and c.estado = 'pendiente')
);

-- respuestas: lees la tuya siempre; la del otro solo cuando ya respondiste
create policy respuestas_select on public.respuestas for select to authenticated
  using (
    usuario_id = auth.uid()
    or exists (
      select 1 from public.respuestas m
      where m.pregunta_id = respuestas.pregunta_id and m.usuario_id = auth.uid()
    )
  );
create policy respuestas_insert on public.respuestas for insert to authenticated with check (usuario_id = auth.uid());
create policy respuestas_update on public.respuestas for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- recuerdos: ambos crean y editan los propios; admin todo
create policy recuerdos_select on public.recuerdos for select to authenticated using (true);
create policy recuerdos_insert on public.recuerdos for insert to authenticated with check (creado_por = auth.uid());
create policy recuerdos_update on public.recuerdos for update to authenticated using (creado_por = auth.uid() or public.es_admin()) with check (creado_por = auth.uid() or public.es_admin());
create policy recuerdos_delete on public.recuerdos for delete to authenticated using (creado_por = auth.uid() or public.es_admin());

create policy fotos_select on public.fotos_recuerdo for select to authenticated using (true);
create policy fotos_insert on public.fotos_recuerdo for insert to authenticated with check (true);
create policy fotos_delete on public.fotos_recuerdo for delete to authenticated using (
  public.es_admin() or exists(select 1 from public.recuerdos r where r.id = recuerdo_id and r.creado_por = auth.uid())
);

create policy notas_select on public.notas_recuerdo for select to authenticated using (true);
create policy notas_insert on public.notas_recuerdo for insert to authenticated with check (usuario_id = auth.uid());
create policy notas_update on public.notas_recuerdo for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- ============ STORAGE ============

insert into storage.buckets (id, name, public) values ('catalogo','catalogo', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('recuerdos','recuerdos', false) on conflict (id) do nothing;

create policy catalogo_public_read on storage.objects for select to public using (bucket_id = 'catalogo');
create policy catalogo_admin_write on storage.objects for insert to authenticated with check (bucket_id = 'catalogo' and public.es_admin());
create policy catalogo_admin_update on storage.objects for update to authenticated using (bucket_id = 'catalogo' and public.es_admin());
create policy catalogo_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'catalogo' and public.es_admin());

create policy recuerdos_read on storage.objects for select to authenticated using (bucket_id = 'recuerdos');
create policy recuerdos_write on storage.objects for insert to authenticated with check (bucket_id = 'recuerdos');
create policy recuerdos_update on storage.objects for update to authenticated using (bucket_id = 'recuerdos');
create policy recuerdos_delete on storage.objects for delete to authenticated using (bucket_id = 'recuerdos');

-- fila única de configuración
insert into public.configuracion (id) values (1) on conflict (id) do nothing;
