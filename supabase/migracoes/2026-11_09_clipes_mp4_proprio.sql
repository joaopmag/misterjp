-- 2026-11_09_clipes_mp4_proprio.sql
--
-- CLIPES DOS JOGADORES COM MP4 PRÓPRIO.
--
-- OS CLIPES FICAM SEMPRE: os jogos inteiros carregados ficam 90 dias (+30
-- uma vez), os clipes nunca se apagam com eles.
--
-- Os clipes feitos sobre um jogo carregado por ficheiro apontam
-- para o jogo (link da app /api/video-jogo) e tocam só o troço. O serviço
-- de vídeo passa a cortar cada um para um MP4 seu e guarda no clipe
--   ficheiroProprio = { url, path, inicio, fim, tamanho, em }
-- (inicio/fim = tempos do jogo que o MP4 cobre). Assim o clipe sobrevive
-- ao jogo sair do Canal ou ser apagado.
--
-- 1) clipes_por_materializar: a lista do que falta (clipes dos jogadores em
--    video_clips e clipes do staff no Canal em videos), para o serviço de
--    vídeo. Só a chave de serviço a pode chamar (nem o Portal nem a app).
-- 2) video_publico: a página pública de um vídeo junto usa o MP4 próprio
--    quando ele cobre os tempos do clipe.
--
-- Pode correr-se mais de uma vez.

-- (a assinatura mudou: devolve também a tabela)
DROP FUNCTION IF EXISTS public.clipes_por_materializar(integer);

CREATE OR REPLACE FUNCTION public.clipes_por_materializar(p_limite integer DEFAULT 40)
 RETURNS TABLE(tabela text, id text, team_id uuid)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with todos as (
    select 'video_clips'::text as tabela, c.id::text as id, c.team_id, c.data, c.created_at from video_clips c
    union all
    select 'videos'::text, v.id::text, v.team_id, v.data, v.created_at from videos v
  )
  select t.tabela, t.id, t.team_id
  from todos t
  where coalesce(t.data->>'clipNoFicheiro', '') = 'true'
    and coalesce(t.data->>'dataUrl', '') like '%/api/video-jogo?t=%'
    and coalesce(t.data->>'apagadoPeloAtleta', '') <> 'true'
    and jsonb_typeof(t.data->'clipInicio') = 'number' and jsonb_typeof(t.data->'clipFim') = 'number'
    -- ainda sem MP4, ou o MP4 já não cobre os tempos (o clipe foi editado)
    and (
      t.data->'ficheiroProprio' is null
      or (t.data->'ficheiroProprio'->>'inicio')::numeric > (t.data->>'clipInicio')::numeric + 0.05
      or (t.data->'ficheiroProprio'->>'fim')::numeric < (t.data->>'clipFim')::numeric - 0.05
    )
    -- falhou há menos de 24 h com estes mesmos tempos: espera
    and not (
      coalesce(t.data->'ficheiroProprioFalhou'->>'chave', '') =
        ((t.data->>'clipInicio')::numeric)::text || '-' || ((t.data->>'clipFim')::numeric)::text || '|' || coalesce(t.data->>'dataUrl', '')
      and coalesce((t.data->'ficheiroProprioFalhou'->>'em')::timestamptz, 'epoch'::timestamptz) > now() - interval '24 hours'
    )
  order by t.created_at asc
  limit greatest(1, least(coalesce(p_limite, 40), 200));
$function$;

REVOKE ALL ON FUNCTION public.clipes_por_materializar(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clipes_por_materializar(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clipes_por_materializar(integer) TO service_role;

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
  -- Com MP4 próprio que cobre os tempos: esse ficheiro, com os tempos
  -- deslocados para dentro dele.
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'youtubeId', nullif(c.data->>'youtubeId', ''),
           'src', case
                    when x.fp then c.data->'ficheiroProprio'->>'url'
                    when coalesce(c.data->>'youtubeId', '') = '' and coalesce(c.data->>'clipNoFicheiro', '') = 'true'
                      then c.data->>'dataUrl' end,
           'inicio', (c.data->>'clipInicio')::numeric - case when x.fp then (c.data->'ficheiroProprio'->>'inicio')::numeric else 0 end,
           'fim', (c.data->>'clipFim')::numeric - case when x.fp then (c.data->'ficheiroProprio'->>'inicio')::numeric else 0 end,
           'titulo', coalesce(c.data->>'titulo', '')
         )) order by e.ord), '[]'::jsonb)
  into v_segs
  from jsonb_array_elements_text(coalesce(v_linha.data->'ids', '[]'::jsonb)) with ordinality as e(value, ord)
  join video_clips c on c.id::text = e.value and c.team_id = v_linha.team_id
  cross join lateral (
    select coalesce(c.data->'ficheiroProprio'->>'url', '') ~ '^https?://'
       and (c.data->'ficheiroProprio'->>'inicio')::numeric <= (c.data->>'clipInicio')::numeric + 0.05
       and (c.data->'ficheiroProprio'->>'fim')::numeric >= (c.data->>'clipFim')::numeric - 0.05 as fp
  ) x
  where coalesce(c.data->>'youtubeId', '') <> ''
     or (coalesce(c.data->>'clipNoFicheiro', '') = 'true' and coalesce(c.data->>'dataUrl', '') ~ '^https?://');

  return jsonb_build_object('nome', coalesce(v_linha.data->>'nome', ''), 'segmentos', v_segs);
end;
$function$;
