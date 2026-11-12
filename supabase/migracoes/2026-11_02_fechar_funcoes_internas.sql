-- Fecha às pessoas sem sessão (anon) as funções internas do servidor.
-- Estas funções só são usadas por dentro (gatilhos, registo de atividade,
-- travões do Portal, cálculo da sequência). A app não as chama diretamente.
-- O Portal continua a funcionar: as funções checkin_* correm com os
-- privilégios do dono da base de dados e chamam estas por dentro.
-- Nada muda para a equipa técnica com sessão iniciada nem para o servidor.

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as f
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = any (array[
        '_streak_dias_calc',
        'activity_campos','activity_diff','activity_info','activity_info_t','activity_sensivel',
        'auditoria_equipa',
        'checkin_falha','checkin_hash','checkin_ip','checkin_travao',
        'equipa_apagar_rastos','equipa_marcar_rastos',
        'gps_marcar_alteracao','necessidades_marcar_alteracao',
        'log_activity','log_audit',
        'mjp_mascarar_diagrama','mjp_mascarar_elementos','mjp_onze_revelado',
        'proteger_team_members','quadro_tatico_set_updated_by','stamp_meta'
      ])
  loop
    execute format('revoke execute on function %s from public, anon', r.f);
    execute format('grant execute on function %s to authenticated, service_role', r.f);
  end loop;
end $$;

-- Verificação: depois de correr, esta lista já não deve mostrar nenhuma das funções acima.
select p.proname
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and has_function_privilege('anon', p.oid, 'execute')
order by 1;

-- PARA DESFAZER (só se algo deixar de funcionar): corre o bloco abaixo.
-- do $$ declare r record; begin
--   for r in select p.oid::regprocedure as f from pg_proc p
--     where p.pronamespace = 'public'::regnamespace and p.proname = any (array[
--       '_streak_dias_calc','activity_campos','activity_diff','activity_info','activity_info_t',
--       'activity_sensivel','auditoria_equipa','checkin_falha','checkin_hash','checkin_ip',
--       'checkin_travao','equipa_apagar_rastos','equipa_marcar_rastos','gps_marcar_alteracao',
--       'necessidades_marcar_alteracao','log_activity','log_audit','mjp_mascarar_diagrama',
--       'mjp_mascarar_elementos','mjp_onze_revelado','proteger_team_members',
--       'quadro_tatico_set_updated_by','stamp_meta'])
--   loop execute format('grant execute on function %s to public, anon', r.f); end loop;
-- end $$;
