-- Corre isto no Supabase: Dashboard -> SQL Editor -> New query -> colar -> Run
--
-- Objetivo: o link do questionário (?checkin=1), aberto pelos atletas
-- SEM sessão de treinador, precisa de conseguir:
--   - LER 'players'    (para saber quem pode fazer login com o código de 4 dígitos)
--   - LER 'sessions'   (para saber qual é o treino de hoje, no ecrã de RPE)
--   - LER e ESCREVER 'monitoring' (para gravar e depois re-editar o registo do dia)
--
-- Atualmente as tabelas só têm políticas "to authenticated", por isso um
-- visitante anónimo recebe sempre 0 linhas (sem erro) — é isso que faz
-- aparecer "Ainda sem plantel" mesmo havendo jogadores, e que impede o
-- registo de wellness/RPE de ser gravado.
--
-- Este script é aditivo: não apaga tabelas nem dados, só acrescenta
-- políticas para o papel 'anon'. Pode ser corrido várias vezes sem
-- problema (usa "drop policy if exists" antes de cada "create").

-- Leitura anónima do plantel (para o login por código no ecrã do atleta)
drop policy if exists "anon read players" on players;
create policy "anon read players" on players for select to anon using (true);

-- Leitura anónima das sessões (para saber o treino de hoje no RPE)
drop policy if exists "anon read sessions" on sessions;
create policy "anon read sessions" on sessions for select to anon using (true);

-- Monitorização: leitura (para saber se o atleta já respondeu hoje),
-- inserção (primeiro registo do dia) e atualização (se o atleta voltar
-- a abrir o link e corrigir a resposta do mesmo dia — a app faz upsert).
drop policy if exists "anon read monitoring" on monitoring;
create policy "anon read monitoring" on monitoring for select to anon using (true);

drop policy if exists "anon insert monitoring" on monitoring;
create policy "anon insert monitoring" on monitoring for insert to anon with check (true);

drop policy if exists "anon update monitoring" on monitoring;
create policy "anon update monitoring" on monitoring for update to anon using (true);

-- Nota de segurança: como o "login" do atleta é só um código de 4
-- dígitos verificado no browser (não é autenticação real do Supabase),
-- estas políticas usam using(true) — ou seja, qualquer pessoa com o
-- link consegue, em teoria, ler/escrever qualquer registo de
-- monitorização, não só o do seu próprio código. Para a maioria das
-- equipas isto é um risco aceitável (o link não é público, só é
-- partilhado com o plantel), mas fica registado caso queiras reforçar
-- isto no futuro (ex: código secreto por jogador validado no servidor).
