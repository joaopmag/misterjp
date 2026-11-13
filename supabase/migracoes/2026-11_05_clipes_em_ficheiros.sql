-- 2026-11_05_clipes_em_ficheiros.sql
--
-- CLIPES DOS ATLETAS SOBRE VÍDEOS CARREGADOS (ficheiro), além do YouTube.
--
-- Muda só duas funções (o resto fica como estava, linha a linha):
--   · checkin_clipe_criar: aceita também um vídeo carregado da equipa
--     (kind 'video', link http no Storage). O clipe guarda o MESMO link
--     (`dataUrl`) e `clipNoFicheiro: true` — não se copia nada no Storage.
--     O link vem SEMPRE do vídeo gravado na base, nunca do pedido.
--   · video_publico: a página pública de "Os meus vídeos" passa a receber
--     também os clipes de ficheiro (`src`).
--
-- checkin_biblioteca, checkin_meus_clipes, checkin_clipe_editar,
-- checkin_video_guardar/partilhar/apagar não precisam de mudar: já
-- devolvem/guardam o `data` inteiro do clipe e do vídeo.
--
-- Pode correr-se mais de uma vez (CREATE OR REPLACE).

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

CREATE OR REPLACE FUNCTION public.video_publico(p_codigo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_linha video_compilacoes%rowtype;
  v_segs jsonb;
begin
  if coalesce(btrim(p_codigo), '') = '' then
    return null;
  end if;
  select * into v_linha from video_compilacoes where data->>'codigo' = p_codigo limit 1;
  if v_linha.id is null then
    return null;
  end if;

  -- YouTube (`youtubeId`) ou vídeo carregado (`src` = link do ficheiro).
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'youtubeId', nullif(c.data->>'youtubeId', ''),
           'src', case when coalesce(c.data->>'youtubeId', '') = '' and coalesce(c.data->>'clipNoFicheiro', '') = 'true'
                       then c.data->>'dataUrl' end,
           'inicio', (c.data->>'clipInicio')::numeric,
           'fim', (c.data->>'clipFim')::numeric,
           'titulo', coalesce(c.data->>'titulo', '')
         )) order by e.ord), '[]'::jsonb)
  into v_segs
  from jsonb_array_elements_text(coalesce(v_linha.data->'ids', '[]'::jsonb)) with ordinality as e(value, ord)
  join video_clips c on c.id::text = e.value and c.team_id = v_linha.team_id
  where coalesce(c.data->>'youtubeId', '') <> ''
     or (coalesce(c.data->>'clipNoFicheiro', '') = 'true' and coalesce(c.data->>'dataUrl', '') ~ '^https?://');

  return jsonb_build_object('nome', coalesce(v_linha.data->>'nome', ''), 'segmentos', v_segs);
end;
$function$;
