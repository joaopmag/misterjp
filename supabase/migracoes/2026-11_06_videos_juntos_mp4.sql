-- 2026-11_06_videos_juntos_mp4.sql
--
-- "OS MEUS VÍDEOS" EM MP4 FEITO NO SERVIDOR.
--
-- Quando o jogador guarda um vídeo feito de clipes de vídeos carregados,
-- o video-worker junta-os num MP4 (720p) e guarda-o no Storage
-- (videos-clipes/<equipa>/juntos/<jogador>/<vídeo>.mp4). O estado fica no
-- `data` do próprio vídeo (video_compilacoes): ficheiroEstado,
-- ficheiroUrl, ficheiroAssinatura, ficheiroErro…
--
-- Esta função nova serve as duas pontas:
--   · o video-worker confirma o código do Portal e que o vídeo é DESSE
--     jogador, antes de fazer ou apagar o ficheiro;
--   · a app lê o estado ("a preparar" → "pronto") sem depender do que
--     checkin_meus_videos devolve.
-- Não muda nenhuma função que já existe. Pode correr-se mais de uma vez.

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

GRANT EXECUTE ON FUNCTION public.checkin_video_ficheiros(text, text) TO anon, authenticated, service_role;
