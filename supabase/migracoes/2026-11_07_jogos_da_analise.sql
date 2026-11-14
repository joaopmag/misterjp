-- 2026-11_07_jogos_da_analise.sql
--
-- JOGOS POR LINK NA ANÁLISE DE VÍDEO: SÓ PARA O STAFF.
--
-- Os jogos e cortes que o staff põe na Análise de Vídeo (separador "Jogos
-- por link") ficam na tabela `videos` com `daAnalise: true`. Não são para
-- o Portal enquanto o staff não carregar em "Publicar" (`publicado: true`):
-- aí aparecem na Sala de Vídeo e no Portal, como os outros.
--
-- Muda duas funções, cada uma só com UMA linha a mais (o resto fica
-- exatamente como estava):
--   · checkin_biblioteca: não devolve os vídeos `daAnalise` não publicados;
--   · checkin_clipe_criar: não deixa um jogador fazer clipes neles.
--
-- Pode correr-se mais de uma vez (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.checkin_biblioteca(p_code text, p_team text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_boot jsonb;
  v_team_id uuid;
  v_videos jsonb;
begin
  -- Reaproveita a validação do código já feita em checkin_bootstrap —
  -- não se repete aqui a lógica de procurar o atleta pelo código, só
  -- se confirma que o código é válido. `p_days` a 1 chega: não é
  -- preciso histórico nenhum para isto, só saber se o código existe.
  -- `checkin_bootstrap` espera `uuid` no terceiro argumento — por
  -- isso o cast já acontece aqui, antes de chamar.
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
    return null; -- código inválido — mesmo comportamento do checkin_bootstrap
  end if;

  -- O CANAL GERAL — os mesmos vídeos de Biblioteca > Canal, excluindo
  -- os de scouting (adversário ou jogador observado) e os que estão só
  -- na Análise de Vídeo (daAnalise) e ainda não publicados.
  select coalesce(jsonb_agg(v.data || jsonb_build_object('id', v.id) order by v.created_at asc), '[]'::jsonb)
  into v_videos
  from videos v
  where v.team_id = v_team_id
    and (v.data->>'adversarioId') is null
    and (v.data->>'scoutId') is null
    and (coalesce(v.data->>'daAnalise', '') <> 'true' or coalesce(v.data->>'publicado', '') = 'true');

  return jsonb_build_object('videos', v_videos);
end;
$function$;

CREATE OR REPLACE FUNCTION public.checkin_clipe_criar(p_code text, p_team text, p_video_id text, p_inicio numeric, p_fim numeric, p_titulo text, p_nota text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_boot jsonb;
  v_team_id uuid;
  v_player_id text;
  v_player_nome text;
  v_video videos%rowtype;
  v_inicio numeric;
  v_fim numeric;
  v_titulo text;
  v_nota text;
  v_id text;
  v_data jsonb;
  v_youtube text;
  v_ficheiro boolean;
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
  v_player_nome := coalesce(v_boot->'player'->>'name', '');

  -- O vídeo tem de ser da equipa e visível no Portal (o mesmo filtro de
  -- checkin_biblioteca: nada de scouting), e ser do YouTube OU um vídeo
  -- carregado (ficheiro com link http). Os clipes da Análise de Vídeo
  -- (ficheiros próprios, com clipInicio mas sem clipNoFicheiro) não contam.
  select * into v_video
  from videos
  where id::text = p_video_id and team_id = v_team_id
  limit 1;

  v_youtube := coalesce(v_video.data->>'youtubeId', '');
  v_ficheiro := v_youtube = ''
    and coalesce(v_video.data->>'kind', '') = 'video'
    and coalesce(v_video.data->>'dataUrl', '') ~ '^https?://'
    and ((v_video.data->'clipInicio') is null or coalesce(v_video.data->>'clipNoFicheiro', '') = 'true');

  if v_video.id is null
     or (v_video.data->>'adversarioId') is not null
     or (v_video.data->>'scoutId') is not null
     or (coalesce(v_video.data->>'daAnalise', '') = 'true' and coalesce(v_video.data->>'publicado', '') <> 'true')
     or (v_youtube = '' and not v_ficheiro) then
    return jsonb_build_object('ok', false, 'erro', 'video_invalido');
  end if;

  if p_inicio is null or p_fim is null then
    return jsonb_build_object('ok', false, 'erro', 'tempos_invalidos');
  end if;
  v_inicio := least(p_inicio, p_fim);
  v_fim := greatest(p_inicio, p_fim);
  -- Entre 1 e 300 segundos (tem de bater certo com MAX_CLIPE_ATLETA_SEG na app).
  if v_inicio < 0 or (v_fim - v_inicio) < 1 or (v_fim - v_inicio) > 300 then
    return jsonb_build_object('ok', false, 'erro', 'duracao_invalida');
  end if;

  v_titulo := left(btrim(coalesce(p_titulo, '')), 120);
  if v_titulo = '' then
    return jsonb_build_object('ok', false, 'erro', 'titulo_obrigatorio');
  end if;
  v_nota := left(btrim(coalesce(p_nota, '')), 2000);

  v_id := 'atl_' || replace(gen_random_uuid()::text, '-', '');

  -- Se o vídeo de origem já era um corte, aponta para o vídeo completo
  -- (tal como os cortes do staff no Canal).
  v_data := jsonb_build_object(
    'origem', 'atleta',
    'atletaId', v_player_id,
    'atletaNome', v_player_nome,
    'titulo', v_titulo,
    'note', v_nota,
    'clipInicio', v_inicio,
    'clipFim', v_fim,
    'duracao', v_fim - v_inicio,
    'videoOrigemId', v_video.id::text,
    'clipOrigemId', coalesce(nullif(v_video.data->>'clipOrigemId', ''), v_video.id::text),
    'originalTitulo', coalesce(nullif(v_video.data->>'clipOrigemTitulo', ''), v_video.data->>'title', ''),
    'jogoId', v_video.data->'jogoId',
    'jornada', coalesce(v_video.data->>'jornada', ''),
    'criadoEm', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  ) || case
    when v_ficheiro then jsonb_build_object('dataUrl', v_video.data->>'dataUrl', 'clipNoFicheiro', true)
    else jsonb_build_object('youtubeId', v_youtube)
  end;

  insert into video_clips (id, team_id, data, updated_by_email, updated_at)
  values (v_id, v_team_id, v_data, 'portal-atleta', now());

  return jsonb_build_object('ok', true, 'clipe', v_data || jsonb_build_object('id', v_id));
end;
$function$;
