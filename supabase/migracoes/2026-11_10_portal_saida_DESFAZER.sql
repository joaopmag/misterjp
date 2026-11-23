-- =====================================================================
-- DESFAZER 2026-11_10_portal_saida.sql: volta a pôr as funções como
-- estavam na base a 23/11/2026 (antes da migração) e apaga a função nova.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.checkin_jogador(p_code text, p_team uuid)
 RETURNS TABLE(id text, team_id uuid, data jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_n              int;
  v_ip             text := public.checkin_ip();
  v_falhas         int;
  v_falhas_equipa  int;
begin
  -- Sessão do cartão de atleta (chave longa e aleatória: não se adivinha).
  if p_code like 's\_%' then
    return query
      select p.id::text, p.team_id, p.data
      from public.checkin_sessoes s
      join public.checkin_cartoes k on k.id = s.cartao_id
      join public.players p on p.id::text = k.player_id and p.team_id = k.team_id
      where s.chave_hash = public.checkin_hash(p_code)
        and s.expira_em > now()
        and k.revogado_em is null
        and (p_team is null or k.team_id = p_team)
      limit 1;
    return;
  end if;

  -- Travão por ligação: 12 erros em 10 minutos → bloqueia 10 minutos.
  if v_ip is not null then
    select count(*) into v_falhas
    from public.checkin_tentativas t
    where t.ip = v_ip
      and t.criado_em > now() - interval '10 minutes';
    if v_falhas >= 12 then
      raise exception 'Demasiadas tentativas. Tenta outra vez daqui a 10 minutos.';
    end if;
  end if;

  -- Travão da equipa: 40 erros → abranda (3 s); 100 erros → pára 10 minutos.
  if p_team is not null then
    select count(*) into v_falhas_equipa
    from public.checkin_tentativas t
    where t.team_id = p_team
      and t.criado_em > now() - interval '10 minutes';
    if v_falhas_equipa >= 100 then
      raise exception 'Demasiadas tentativas erradas nesta equipa. Tenta outra vez daqui a 10 minutos.';
    end if;
    if v_falhas_equipa >= 40 then
      perform pg_sleep(3);
    end if;
  end if;

  -- Códigos antigos desligados pelo staff?
  if p_team is not null and exists (select 1 from public.checkin_config c where c.team_id = p_team and c.so_cartao) then
    raise exception 'A entrada agora é feita com o cartão de atleta. Pede o teu código de ativação ao staff técnico.';
  end if;

  -- A validação de sempre, sem os jogadores terminados.
  if p_team is not null then
    return query
      select p.id::text, p.team_id, p.data from public.players p
      where p.data->>'code' = p_code and p.team_id = p_team
        and not exists (select 1 from public.checkin_terminados x where x.team_id = p.team_id and x.player_id = p.id::text)
      limit 1;
  else
    select count(*) into v_n from public.players p where p.data->>'code' = p_code;
    if v_n > 1 then
      raise exception 'Código ambíguo — usa o link da tua equipa';
    end if;
    return query
      select p.id::text, p.team_id, p.data from public.players p
      where p.data->>'code' = p_code
        and not exists (select 1 from public.checkin_terminados x where x.team_id = p.team_id and x.player_id = p.id::text)
      limit 1;
  end if;

  if not found then
    insert into public.checkin_tentativas (team_id, ip) values (p_team, v_ip);
    delete from public.checkin_tentativas where criado_em < now() - interval '1 day';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.checkin_bootstrap(p_code text, p_days integer, p_team uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id text; v_team uuid; v_data jsonb;
begin
  select j.id, j.team_id, j.data into v_id, v_team, v_data
  from public.checkin_jogador(p_code, p_team) j;
  if v_id is null then return null; end if;
  return jsonb_build_object(
    'player', jsonb_build_object(
      'id', v_id, 'name', v_data->>'name',
      'position', v_data->>'position', 'number', v_data->>'number',
      'birthdate', v_data->>'birthdate'
    ),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'date', s.data->>'date',
        'phase', s.data->>'phase', 'focus', s.data->>'focus'))
      from public.sessions s
      where s.team_id = v_team
        and s.data->>'date' ~ '^\d{4}-\d{2}-\d{2}$'
        and (s.data->>'date')::date >= current_date - p_days
        and (s.data->>'date')::date <= current_date
    ), '[]'::jsonb),
    'monitoring', coalesce((
      select jsonb_agg(m.data || jsonb_build_object('id', m.id::text))
      from public.monitoring m
      where m.team_id = v_team
        and m.data->>'playerId' = v_id
        and m.data->>'date' ~ '^\d{4}-\d{2}-\d{2}$'
        and (m.data->>'date')::date >= current_date - p_days
    ), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.checkin_save(p_code text, p_date text, p_type text, p_fields jsonb, p_days integer, p_team uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_player_id text; v_team uuid; v_days int; v_fields jsonb;
begin
  select j.id, j.team_id into v_player_id, v_team
  from public.checkin_jogador(p_code, p_team) j;
  if v_player_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Código inválido');
  end if;

  v_days := greatest(0, least(coalesce(p_days, 0), 6));

  if p_date !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Data inválida'; end if;
  if p_type not in ('wellness', 'rpe') then raise exception 'Tipo de registo inválido'; end if;
  if p_date::date > current_date or p_date::date < current_date - v_days then
    raise exception 'Fora da janela de dias permitida';
  end if;
  if p_fields is null or jsonb_typeof(p_fields) <> 'object' then raise exception 'Respostas inválidas'; end if;

  -- As respostas nunca escolhem de quem, de quando nem de que tipo é o registo.
  v_fields := p_fields - 'playerId' - 'date' - 'type' - 'id' - 'teamId';

  insert into public.monitoring (id, data, team_id)
  values (
    gen_random_uuid()::text,
    jsonb_build_object('playerId', v_player_id, 'date', p_date, 'type', p_type) || v_fields,
    v_team
  )
  on conflict (team_id, (data->>'playerId'), (data->>'date'), (data->>'type'))
  do update set data = monitoring.data || excluded.data;

  return jsonb_build_object('ok', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.checkin_meus_clipes(p_code text, p_team text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_boot jsonb;
  v_team_id uuid;
  v_player_id text;
  v_clipes jsonb;
begin
  begin
    v_team_id := p_team::uuid;
  exception when others then
    v_team_id := null;
  end;
  if v_team_id is null then
    return jsonb_build_object('clipes', '[]'::jsonb);
  end if;

  v_boot := checkin_bootstrap(p_code, 1, v_team_id);
  if v_boot is null or v_boot->'player' is null or (v_boot->'player'->>'id') is null then
    return null; -- código inválido, mesmo comportamento de checkin_biblioteca
  end if;
  v_player_id := v_boot->'player'->>'id';

  select coalesce(jsonb_agg(c.data || jsonb_build_object('id', c.id) order by c.created_at asc), '[]'::jsonb)
  into v_clipes
  from video_clips c
  where c.team_id = v_team_id
    and c.data->>'origem' = 'atleta'
    and c.data->>'atletaId' = v_player_id
    and coalesce(c.data->>'apagadoPeloAtleta', '') <> 'true';

  return jsonb_build_object('clipes', v_clipes);
end;
$function$;

CREATE OR REPLACE FUNCTION public.checkin_meus_videos(p_code text, p_team text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_boot jsonb;
  v_team_id uuid;
  v_player_id text;
  v_lista jsonb;
begin
  begin
    v_team_id := p_team::uuid;
  exception when others then
    v_team_id := null;
  end;
  if v_team_id is null then
    return jsonb_build_object('videos', '[]'::jsonb);
  end if;

  v_boot := checkin_bootstrap(p_code, 1, v_team_id);
  if v_boot is null or v_boot->'player' is null or (v_boot->'player'->>'id') is null then
    return null; -- código inválido
  end if;
  v_player_id := v_boot->'player'->>'id';

  select coalesce(jsonb_agg(v.data || jsonb_build_object('id', v.id) order by v.updated_at desc), '[]'::jsonb)
  into v_lista
  from video_compilacoes v
  where v.team_id = v_team_id
    and v.data->>'atletaId' = v_player_id;

  return jsonb_build_object('videos', v_lista);
end;
$function$;

CREATE OR REPLACE FUNCTION public.checkin_video_guardar(p_code text, p_team text, p_id text, p_nome text, p_ids jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_boot jsonb;
  v_team_id uuid;
  v_player_id text;
  v_nome text;
  v_ids jsonb;
  v_id text;
  v_existente video_compilacoes%rowtype;
  v_data jsonb;
begin
  begin
    v_team_id := p_team::uuid;
  exception when others then
    v_team_id := null;
  end;
  if v_team_id is null then
    return jsonb_build_object('ok', false, 'erro', 'equipa_invalida');
  end if;

  v_boot := checkin_bootstrap(p_code, 1, v_team_id);
  if v_boot is null or v_boot->'player' is null or (v_boot->'player'->>'id') is null then
    return jsonb_build_object('ok', false, 'erro', 'codigo_invalido');
  end if;
  v_player_id := v_boot->'player'->>'id';

  if p_ids is null or jsonb_typeof(p_ids) <> 'array' then
    return jsonb_build_object('ok', false, 'erro', 'sem_clipes');
  end if;

  -- Só os clipes do próprio jogador (não apagados), pela ordem pedida.
  select coalesce(jsonb_agg(x.cid order by x.ord), '[]'::jsonb)
  into v_ids
  from (
    select distinct on (e.value) e.value as cid, e.ord
    from jsonb_array_elements_text(p_ids) with ordinality as e(value, ord)
    join video_clips c
      on c.id::text = e.value
     and c.team_id = v_team_id
     and c.data->>'origem' = 'atleta'
     and c.data->>'atletaId' = v_player_id
     and coalesce(c.data->>'apagadoPeloAtleta', '') <> 'true'
    order by e.value, e.ord
  ) x;

  if jsonb_array_length(v_ids) = 0 then
    return jsonb_build_object('ok', false, 'erro', 'sem_clipes');
  end if;
  if jsonb_array_length(v_ids) > 60 then
    return jsonb_build_object('ok', false, 'erro', 'demasiados_clipes');
  end if;

  v_nome := left(btrim(coalesce(p_nome, '')), 80);
  if v_nome = '' then v_nome := 'O meu vídeo'; end if;

  if coalesce(btrim(p_id), '') = '' then
    v_id := 'cmp_' || replace(gen_random_uuid()::text, '-', '');
    v_data := jsonb_build_object(
      'atletaId', v_player_id,
      'nome', v_nome,
      'ids', v_ids,
      'criadoEm', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    );
    insert into video_compilacoes (id, team_id, data, updated_by_email, updated_at)
    values (v_id, v_team_id, v_data, 'portal-atleta', now());
  else
    select * into v_existente from video_compilacoes
    where id = p_id and team_id = v_team_id and data->>'atletaId' = v_player_id;
    if v_existente.id is null then
      return jsonb_build_object('ok', false, 'erro', 'video_invalido');
    end if;
    v_id := v_existente.id;
    v_data := v_existente.data || jsonb_build_object('nome', v_nome, 'ids', v_ids);
    update video_compilacoes set data = v_data, updated_by_email = 'portal-atleta', updated_at = now()
    where id = v_id;
  end if;

  return jsonb_build_object('ok', true, 'video', v_data || jsonb_build_object('id', v_id));
end;
$function$;

CREATE OR REPLACE FUNCTION public.checkin_video_ficheiros(p_code text, p_team text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_team_id uuid;
  v_boot jsonb;
  v_player_id text;
  v_lista jsonb;
begin
  begin
    v_team_id := p_team::uuid;
  exception when others then
    v_team_id := null;
  end;
  if v_team_id is null then
    return jsonb_build_object('ok', false, 'erro', 'equipa_invalida');
  end if;

  v_boot := checkin_bootstrap(p_code, 1, v_team_id);
  if v_boot is null or v_boot->'player' is null or (v_boot->'player'->>'id') is null then
    return jsonb_build_object('ok', false, 'erro', 'codigo_invalido');
  end if;
  v_player_id := v_boot->'player'->>'id';

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id', id::text,
           'estado', data->>'ficheiroEstado',
           'url', data->>'ficheiroUrl',
           'assinatura', data->>'ficheiroAssinatura',
           'erro', data->>'ficheiroErro',
           'tamanho', data->'ficheiroTamanho',
           'pedidoEm', data->>'ficheiroPedidoEm'
         ))), '[]'::jsonb)
  into v_lista
  from video_compilacoes
  where team_id = v_team_id and data->>'atletaId' = v_player_id;

  return jsonb_build_object('ok', true, 'atletaId', v_player_id, 'videos', v_lista);
end;
$function$;

CREATE OR REPLACE FUNCTION public.checkin_video_apagar(p_code text, p_team text, p_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_boot jsonb;
  v_team_id uuid;
  v_player_id text;
  v_n int;
begin
  begin
    v_team_id := p_team::uuid;
  exception when others then
    v_team_id := null;
  end;
  if v_team_id is null then
    return jsonb_build_object('ok', false, 'erro', 'equipa_invalida');
  end if;

  v_boot := checkin_bootstrap(p_code, 1, v_team_id);
  if v_boot is null or v_boot->'player' is null or (v_boot->'player'->>'id') is null then
    return jsonb_build_object('ok', false, 'erro', 'codigo_invalido');
  end if;
  v_player_id := v_boot->'player'->>'id';

  delete from video_compilacoes
  where id = p_id and team_id = v_team_id and data->>'atletaId' = v_player_id;
  get diagnostics v_n = row_count;

  return jsonb_build_object('ok', v_n > 0, 'erro', case when v_n > 0 then null else 'video_invalido' end);
end;
$function$;

CREATE OR REPLACE FUNCTION public.checkin_video_partilhar(p_code text, p_team text, p_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_boot jsonb;
  v_team_id uuid;
  v_player_id text;
  v_linha video_compilacoes%rowtype;
  v_base text;
  v_codigo text;
  v_tentativas int := 0;
begin
  begin
    v_team_id := p_team::uuid;
  exception when others then
    v_team_id := null;
  end;
  if v_team_id is null then
    return jsonb_build_object('ok', false, 'erro', 'equipa_invalida');
  end if;

  v_boot := checkin_bootstrap(p_code, 1, v_team_id);
  if v_boot is null or v_boot->'player' is null or (v_boot->'player'->>'id') is null then
    return jsonb_build_object('ok', false, 'erro', 'codigo_invalido');
  end if;
  v_player_id := v_boot->'player'->>'id';

  select * into v_linha from video_compilacoes
  where id = p_id and team_id = v_team_id and data->>'atletaId' = v_player_id;
  if v_linha.id is null then
    return jsonb_build_object('ok', false, 'erro', 'video_invalido');
  end if;

  if coalesce(v_linha.data->>'codigo', '') <> '' then
    return jsonb_build_object('ok', true, 'codigo', v_linha.data->>'codigo');
  end if;

  -- "O meu Vídeo 1!" -> "o-meu-video-1"
  v_base := lower(coalesce(v_linha.data->>'nome', 'video'));
  v_base := translate(v_base, 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := btrim(v_base, '-');
  v_base := left(v_base, 40);
  if v_base = '' then v_base := 'video'; end if;

  loop
    v_codigo := v_base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 4);
    exit when not exists (select 1 from video_compilacoes where data->>'codigo' = v_codigo);
    v_tentativas := v_tentativas + 1;
    if v_tentativas > 20 then
      return jsonb_build_object('ok', false, 'erro', 'sem_codigo');
    end if;
  end loop;

  update video_compilacoes
  set data = data || jsonb_build_object('codigo', v_codigo), updated_at = now(), updated_by_email = 'portal-atleta'
  where id = v_linha.id;

  return jsonb_build_object('ok', true, 'codigo', v_codigo);
end;
$function$;

DROP FUNCTION IF EXISTS public.checkin_estado_saida(jsonb);

COMMIT;
