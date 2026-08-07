-- Corre isto no Supabase: Dashboard -> SQL Editor -> New query -> colar -> Run
--
-- Esta versão troca o armazenamento "um bloco JSON gigante por secção"
-- (ex: todo o Plantel numa linha só) por uma tabela por secção, com UMA
-- LINHA POR REGISTO (um jogador, uma sessão, um jogo...). Isso permite
-- saber exatamente quem editou cada jogador/sessão/jogo e quando — não só
-- "alguém mexeu no Plantel", mas "o Fábio editou o jogador X às 14:32".
--
-- Se já tinhas corrido uma versão anterior deste schema, este script
-- apaga as tabelas antigas antes de recriar. Se já lá tiveres dados
-- importantes, avisa antes de correr isto — preparamos uma migração em
-- vez de um apagar.

drop table if exists app_storage cascade;
drop table if exists audit_log cascade;
drop table if exists players cascade;
drop table if exists exercises cascade;
drop table if exists sessions cascade;
drop table if exists monitoring cascade;
drop table if exists matches cascade;
drop table if exists scouting cascade;
drop table if exists videos cascade;
drop table if exists convocatorias cascade;
drop table if exists diario cascade;
drop table if exists season_config cascade;

-- ---------------------------------------------------------------
-- Uma tabela por secção da app. "data" guarda o registo (jogador,
-- sessão, jogo, ...) tal como a app já o representa — evita reescrever
-- toda a lógica de formulários da app à volta de colunas rígidas.
-- "id" é o mesmo id que a app já gera para cada registo.
-- ---------------------------------------------------------------
create table players       (id text primary key, data jsonb not null default '{}', updated_by uuid, updated_by_email text, updated_at timestamptz not null default now(), created_at timestamptz not null default now());
create table exercises     (id text primary key, data jsonb not null default '{}', updated_by uuid, updated_by_email text, updated_at timestamptz not null default now(), created_at timestamptz not null default now());
create table sessions      (id text primary key, data jsonb not null default '{}', updated_by uuid, updated_by_email text, updated_at timestamptz not null default now(), created_at timestamptz not null default now());
create table monitoring    (id text primary key, data jsonb not null default '{}', updated_by uuid, updated_by_email text, updated_at timestamptz not null default now(), created_at timestamptz not null default now());
create table matches       (id text primary key, data jsonb not null default '{}', updated_by uuid, updated_by_email text, updated_at timestamptz not null default now(), created_at timestamptz not null default now());
create table scouting      (id text primary key, data jsonb not null default '{}', updated_by uuid, updated_by_email text, updated_at timestamptz not null default now(), created_at timestamptz not null default now());
create table videos        (id text primary key, data jsonb not null default '{}', updated_by uuid, updated_by_email text, updated_at timestamptz not null default now(), created_at timestamptz not null default now());
create table convocatorias (id text primary key, data jsonb not null default '{}', updated_by uuid, updated_by_email text, updated_at timestamptz not null default now(), created_at timestamptz not null default now());
create table diario        (id text primary key, data jsonb not null default '{}', updated_by uuid, updated_by_email text, updated_at timestamptz not null default now(), created_at timestamptz not null default now());

-- A Época é um único registo (não uma lista) — fica à parte, com id fixo.
create table season_config (
  id text primary key default 'default',
  data jsonb not null default '{}',
  updated_by uuid, updated_by_email text, updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Histórico completo: cada alteração (criar/editar/apagar), em
-- qualquer tabela, fica registada aqui para sempre — é isto que dá o
-- "quem mudou o quê e quando" ao nível de cada registo individual.
-- ---------------------------------------------------------------
create table audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text not null,
  action text not null,          -- 'insert' | 'update' | 'delete'
  changed_by uuid,
  changed_by_email text,
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);
create index audit_log_lookup on audit_log (table_name, record_id, changed_at desc);

-- Preenche updated_by/updated_by_email/updated_at sozinho, a partir de
-- quem está autenticado — não é preciso (nem dá para) o browser inventar.
create or replace function stamp_meta()
returns trigger as $$
begin
  new.updated_by = auth.uid();
  new.updated_by_email = auth.jwt() ->> 'email';
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

-- Grava uma linha no histórico sempre que um registo é criado, editado
-- ou apagado, em qualquer uma das tabelas.
create or replace function log_audit()
returns trigger as $$
begin
  insert into audit_log(table_name, record_id, action, changed_by, changed_by_email, old_data, new_data)
  values (
    TG_TABLE_NAME,
    coalesce(new.id, old.id),
    lower(TG_OP),
    auth.uid(),
    auth.jwt() ->> 'email',
    case when TG_OP = 'DELETE' then old.data else null end,
    case when TG_OP in ('INSERT','UPDATE') then new.data else null end
  );
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$ language plpgsql security definer;

-- Aplica os gatilhos, o RLS e a partilha em tempo real a todas as
-- tabelas de uma vez (evita repetir o mesmo bloco 10 vezes).
do $$
declare t text;
begin
  foreach t in array array['players','exercises','sessions','monitoring','matches','scouting','videos','convocatorias','diario','season_config']
  loop
    execute format('drop trigger if exists %I_stamp_meta on %I;', t, t);
    execute format('create trigger %I_stamp_meta before insert or update on %I for each row execute procedure stamp_meta();', t, t);

    execute format('drop trigger if exists %I_log_audit on %I;', t, t);
    execute format('create trigger %I_log_audit after insert or update or delete on %I for each row execute procedure log_audit();', t, t);

    execute format('alter table %I enable row level security;', t);

    execute format('drop policy if exists "authenticated read" on %I;', t);
    execute format('create policy "authenticated read" on %I for select to authenticated using (true);', t);

    execute format('drop policy if exists "authenticated insert" on %I;', t);
    execute format('create policy "authenticated insert" on %I for insert to authenticated with check (true);', t);

    execute format('drop policy if exists "authenticated update" on %I;', t);
    execute format('create policy "authenticated update" on %I for update to authenticated using (true);', t);

    execute format('drop policy if exists "authenticated delete" on %I;', t);
    execute format('create policy "authenticated delete" on %I for delete to authenticated using (true);', t);

    execute format('alter publication supabase_realtime add table %I;', t);
  end loop;
end $$;

-- O histórico só precisa de ser lido (nunca editado à mão pela app).
alter table audit_log enable row level security;
drop policy if exists "authenticated read audit" on audit_log;
create policy "authenticated read audit" on audit_log for select to authenticated using (true);
