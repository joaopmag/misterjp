-- Correção de segurança do checkin_save (Portal do Atleta).
-- Igual à versão atual, com duas proteções no servidor:
--   1. a janela de dias para trás passa a ter um máximo de 6 (o mesmo
--      CHECKIN_DAYS_BACK da app), mesmo que alguém peça mais;
--   2. as respostas não podem trocar o jogador, a data nem o tipo do registo.
-- O Portal já envia sempre 6 dias e só as respostas, por isso o uso normal não muda.
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
