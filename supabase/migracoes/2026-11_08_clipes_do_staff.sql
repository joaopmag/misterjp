-- 2026-11_08_clipes_do_staff.sql
--
-- ANÁLISE INDIVIDUAL FEITA PELO STAFF.
--
-- O staff põe cortes na análise individual de um jogador (Análise de Vídeo).
-- Ficam em `video_clips` como clipes do jogador (`origem: 'atleta'`), com
-- `criadoPorStaff: true`. O jogador vê-os no Portal (checkin_meus_clipes já
-- os devolve, não muda), mas NÃO os pode editar nem apagar: só os clipes
-- que ele próprio fez.
--
-- Muda só duas funções, cada uma com UMA condição a mais. Pode correr-se
-- mais de uma vez (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.checkin_clipe_editar(p_code text, p_team text, p_clipe_id text, p_inicio numeric, p_fim numeric, p_titulo text, p_nota text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_boot jsonb;
  v_team_id uuid;
  v_player_id text;
  v_row video_clips%rowtype;
  v_inicio numeric;
  v_fim numeric;
  v_titulo text;
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

  select * into v_row
  from video_clips
  where id = p_clipe_id
    and team_id = v_team_id
    and data->>'origem' = 'atleta'
    and data->>'atletaId' = v_player_id
    and coalesce(data->>'apagadoPeloAtleta', '') <> 'true'
    and coalesce(data->>'criadoPorStaff', '') <> 'true' -- os do treinador são só para ver
  limit 1;
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'erro', 'clipe_invalido');
  end if;

  if p_inicio is null or p_fim is null then
    return jsonb_build_object('ok', false, 'erro', 'tempos_invalidos');
  end if;
  v_inicio := least(p_inicio, p_fim);
  v_fim := greatest(p_inicio, p_fim);
  if v_inicio < 0 or (v_fim - v_inicio) < 1 or (v_fim - v_inicio) > 300 then
    return jsonb_build_object('ok', false, 'erro', 'duracao_invalida');
  end if;

  v_titulo := left(btrim(coalesce(p_titulo, '')), 120);
  if v_titulo = '' then
    return jsonb_build_object('ok', false, 'erro', 'titulo_obrigatorio');
  end if;

  -- Só mudam estes campos; o vídeo, o jogador e a data de criação ficam.
  v_data := v_row.data || jsonb_build_object(
    'titulo', v_titulo,
    'note', left(btrim(coalesce(p_nota, '')), 2000),
    'clipInicio', v_inicio,
    'clipFim', v_fim,
    'duracao', v_fim - v_inicio,
    'editadoEm', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );

  update video_clips
  set data = v_data, updated_at = now(), updated_by_email = 'portal-atleta'
  where id = v_row.id;

  return jsonb_build_object('ok', true, 'clipe', v_data || jsonb_build_object('id', v_row.id));
end;
$function$;

CREATE OR REPLACE FUNCTION public.checkin_clipe_apagar(p_code text, p_team text, p_clipe_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_boot jsonb;
  v_team_id uuid;
  v_player_id text;
  v_apagados integer;
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

  -- As três condições de sempre (da equipa, criado no Portal, deste atleta),
  -- mais uma: ainda não estar apagado. Já não se apaga a linha: só se marca,
  -- para o treinador continuar a ter o clipe.
  update video_clips
  set data = data || jsonb_build_object(
        'apagadoPeloAtleta', true,
        'apagadoPeloAtletaEm', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      ),
      updated_at = now(),
      updated_by_email = 'portal-atleta'
  where id = p_clipe_id
    and team_id = v_team_id
    and data->>'origem' = 'atleta'
    and data->>'atletaId' = v_player_id
    and coalesce(data->>'apagadoPeloAtleta', '') <> 'true'
    and coalesce(data->>'criadoPorStaff', '') <> 'true'; -- os do treinador são só para ver
  get diagnostics v_apagados = row_count;

  if v_apagados = 0 then
    return jsonb_build_object('ok', false, 'erro', 'clipe_invalido');
  end if;
  return jsonb_build_object('ok', true);
end;
$function$;
