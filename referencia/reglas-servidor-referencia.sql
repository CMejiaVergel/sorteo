-- =============================================================
--  SOLO REFERENCIA. No se usa Supabase en la versión formal.
--  Este archivo muestra las reglas de servidor del prototipo
--  (apartar, girar, consultar) para contrastar el comportamiento.
--  El esquema real de base de datos se define aparte.
-- =============================================================

-- =============================================================
--  Tablero de Sorteos · Base de datos para Supabase
--  Cómo usarlo: en Supabase abre "SQL Editor" → "New query",
--  pega TODO este archivo y pulsa "Run". Se puede correr de nuevo
--  sin dañar datos.
-- =============================================================

create extension if not exists pgcrypto;

-- ---------- Tablas ----------
create table if not exists ajustes (
  id int primary key default 1 check (id = 1),
  negocio text default 'El Pato de la Suerte',
  whatsapp text default '',
  plantilla text default 'Hola {nombre}, {saludo}. Tienes {numeros} por un valor de {total} en el sorteo {sorteo} del {fecha}. Para cancelar, Nequi {nequi} a nombre de {titular}. ¡Mucha suerte!'
);
insert into ajustes (id) values (1) on conflict (id) do nothing;
alter table ajustes add column if not exists diseno jsonb not null default '{}'::jsonb;

create table if not exists sorteos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  loteria text default '',
  imagen text default '',
  logo_loteria text default '',
  jornada text not null default 'dia' check (jornada in ('dia','noche')),
  fecha date,
  hora text default '',
  premio_total numeric default 0,
  valor_boleta numeric not null default 0,
  premio_ultimas numeric default 0,
  premio_primeras numeric default 0,
  premio_medio numeric default 0,
  nequi text default '',
  nequi_titular text default '',
  activo boolean not null default true,
  orden int not null default 0,
  creado timestamptz not null default now()
);

alter table sorteos add column if not exists color text not null default '';
alter table sorteos add column if not exists etiqueta text not null default '';
alter table sorteos add column if not exists logo_ocupado text not null default '';
alter table sorteos add column if not exists fondo_imagen text not null default '';

create table if not exists contactos (
  telefono text primary key check (telefono ~ '^3[0-9]{9}$'),
  nombre text not null,
  creado timestamptz not null default now()
);

create table if not exists reservas (
  id uuid primary key default gen_random_uuid(),
  sorteo_id uuid not null references sorteos(id) on delete cascade,
  numero smallint not null check (numero between 0 and 99),
  telefono text not null,
  nombre text not null,
  tipo text not null default 'cliente' check (tipo in ('cliente','fijo')),
  pagado boolean not null default false,
  creado timestamptz not null default now(),
  unique (sorteo_id, numero)            -- ningún número se repite en un sorteo
);

create table if not exists tragamonedas_config (
  id int primary key default 1 check (id = 1),
  activo boolean not null default true,
  prob_tres numeric not null default 1,     -- % de probabilidad de 3 caritas iguales
  premio_tres text not null default 'Un número gratis',
  prob_dos numeric not null default 10,     -- % de probabilidad de 2 caritas iguales
  premio_dos text not null default '$1.000 de descuento'
);
insert into tragamonedas_config (id) values (1) on conflict (id) do nothing;

create table if not exists giros (
  id bigserial primary key,
  telefono text not null,
  fecha date not null default ((now() at time zone 'America/Bogota')::date),
  resultado text[] not null,
  gano int not null default 0,
  premio text default '',
  reclamado boolean not null default false,
  creado timestamptz not null default now(),
  unique (telefono, fecha)              -- un tiro por celular al día
);

-- ---------- Seguridad (RLS) ----------
-- El público solo puede VER los sorteos activos, los ajustes y los premios
-- de la tragamonedas. Todo lo demás lo hace a través de las funciones de abajo.
-- El administrador (usuario con sesión iniciada) puede hacer todo.
alter table ajustes enable row level security;
alter table sorteos enable row level security;
alter table contactos enable row level security;
alter table reservas enable row level security;
alter table tragamonedas_config enable row level security;
alter table giros enable row level security;

drop policy if exists publico_lee_ajustes on ajustes;
create policy publico_lee_ajustes on ajustes for select to anon using (true);
drop policy if exists publico_lee_sorteos on sorteos;
create policy publico_lee_sorteos on sorteos for select to anon using (activo);
drop policy if exists publico_lee_traga on tragamonedas_config;
create policy publico_lee_traga on tragamonedas_config for select to anon using (true);

do $$
declare t text;
begin
  foreach t in array array['ajustes','sorteos','contactos','reservas','tragamonedas_config','giros'] loop
    execute format('drop policy if exists admin_todo on %I', t);
    execute format('create policy admin_todo on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ---------- Funciones públicas ----------
-- Números ocupados de un sorteo (solo los números, nunca nombres ni teléfonos)
create or replace function numeros_ocupados(p_sorteo uuid)
returns setof smallint language sql security definer set search_path = public as $$
  select numero from reservas where sorteo_id = p_sorteo order by numero;
$$;

-- Si el celular ya está en el banco de contactos, devuelve su nombre
create or replace function buscar_contacto(p_tel text)
returns text language sql security definer set search_path = public as $$
  select nombre from contactos where telefono = p_tel;
$$;

-- Apartar números: todo o nada, sin repetidos
create or replace function reservar(p_sorteo uuid, p_numeros int[], p_nombre text, p_tel text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_ocupados int[];
  v_nombre text;
begin
  if not exists (select 1 from sorteos where id = p_sorteo and activo) then
    return json_build_object('ok', false, 'error', 'Este sorteo ya no está disponible.');
  end if;
  if p_tel !~ '^3[0-9]{9}$' then
    return json_build_object('ok', false, 'error', 'Escribe un celular de 10 dígitos que empiece por 3.');
  end if;
  if length(trim(coalesce(p_nombre, ''))) < 2 then
    return json_build_object('ok', false, 'error', 'Escribe tu nombre.');
  end if;
  if coalesce(array_length(p_numeros, 1), 0) = 0 or array_length(p_numeros, 1) > 30 then
    return json_build_object('ok', false, 'error', 'Elige entre 1 y 30 números.');
  end if;
  if exists (select 1 from unnest(p_numeros) n where n < 0 or n > 99) then
    return json_build_object('ok', false, 'error', 'Número fuera del tablero.');
  end if;

  select array_agg(numero order by numero) into v_ocupados
    from reservas where sorteo_id = p_sorteo and numero = any(p_numeros);
  if v_ocupados is not null then
    return json_build_object('ok', false, 'ocupados', v_ocupados);
  end if;

  insert into contactos (telefono, nombre) values (p_tel, trim(p_nombre))
    on conflict (telefono) do nothing;
  select nombre into v_nombre from contactos where telefono = p_tel;

  insert into reservas (sorteo_id, numero, telefono, nombre)
    select p_sorteo, n, p_tel, v_nombre from (select distinct unnest(p_numeros) n) x;

  return json_build_object('ok', true, 'nombre', v_nombre);
exception when unique_violation then
  return json_build_object('ok', false, 'error', 'Alguien acaba de apartar uno de tus números. Revisa el tablero y elige otro.');
end $$;

-- Tragamonedas: el resultado se decide en el servidor (no se puede hacer trampa)
create or replace function girar(p_tel text)
returns json language plpgsql security definer set search_path = public as $$
declare
  c tragamonedas_config;
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  caras text[] := array['moneda','trebol','herradura','siete','diamante'];
  mezcla text[];
  r float := random() * 100;
  res text[];
  v_gano int := 0;
  v_premio text := '';
  g giros;
begin
  select * into c from tragamonedas_config where id = 1;
  if not c.activo then
    return json_build_object('ok', false, 'motivo', 'inactiva');
  end if;
  if p_tel !~ '^3[0-9]{9}$' then
    return json_build_object('ok', false, 'motivo', 'telefono');
  end if;
  select * into g from giros where telefono = p_tel and fecha = v_hoy;
  if found then
    return json_build_object('ok', false, 'motivo', 'ya_giro', 'resultado', g.resultado, 'gano', g.gano, 'premio', g.premio);
  end if;

  select array_agg(x order by random()) into mezcla from unnest(caras) x;
  if r < c.prob_tres then
    res := array[mezcla[1], mezcla[1], mezcla[1]]; v_gano := 3; v_premio := c.premio_tres;
  elsif r < c.prob_tres + c.prob_dos then
    case floor(random() * 3)::int
      when 0 then res := array[mezcla[1], mezcla[1], mezcla[2]];
      when 1 then res := array[mezcla[1], mezcla[2], mezcla[1]];
      else        res := array[mezcla[2], mezcla[1], mezcla[1]];
    end case;
    v_gano := 2; v_premio := c.premio_dos;
  else
    res := array[mezcla[1], mezcla[2], mezcla[3]];
  end if;

  insert into giros (telefono, fecha, resultado, gano, premio) values (p_tel, v_hoy, res, v_gano, v_premio);
  return json_build_object('ok', true, 'resultado', res, 'gano', v_gano, 'premio', v_premio);
exception when unique_violation then
  return json_build_object('ok', false, 'motivo', 'ya_giro');
end $$;

grant execute on function numeros_ocupados(uuid) to anon, authenticated;
grant execute on function buscar_contacto(text) to anon, authenticated;
grant execute on function reservar(uuid, int[], text, text) to anon, authenticated;
grant execute on function girar(text) to anon, authenticated;


-- Mis números: el cliente consulta sus números con su celular
create or replace function mis_numeros(p_tel text)
returns json language sql security definer set search_path = public as $$
  select json_build_object(
    'nombre', (select nombre from contactos where telefono = p_tel),
    'sorteos', coalesce((select json_agg(x order by x.fecha desc nulls last, x.nombre) from (
       select s.id, s.nombre, s.fecha, s.hora, s.jornada, s.valor_boleta, s.nequi, s.nequi_titular, s.color, s.imagen,
              array_agg(r.numero order by r.numero) as numeros,
              coalesce(array_agg(r.numero order by r.numero) filter (where r.pagado), '{}') as pagados
         from reservas r join sorteos s on s.id = r.sorteo_id
        where r.telefono = p_tel
          and (s.activo or s.fecha >= (now() at time zone 'America/Bogota')::date - 7)
        group by s.id) x), '[]'::json));
$$;
grant execute on function mis_numeros(text) to anon, authenticated;

-- ---------- Imágenes (logos y portadas) ----------
insert into storage.buckets (id, name, public) values ('imagenes', 'imagenes', true)
  on conflict (id) do nothing;
drop policy if exists admin_sube_imagenes on storage.objects;
create policy admin_sube_imagenes on storage.objects for insert to authenticated with check (bucket_id = 'imagenes');
drop policy if exists admin_edita_imagenes on storage.objects;
create policy admin_edita_imagenes on storage.objects for update to authenticated using (bucket_id = 'imagenes');
drop policy if exists admin_borra_imagenes on storage.objects;
create policy admin_borra_imagenes on storage.objects for delete to authenticated using (bucket_id = 'imagenes');
