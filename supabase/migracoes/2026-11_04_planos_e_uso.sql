-- Preparação comercial: planos por equipa e registo do uso de serviços pagos.
-- Pode correr-se mais do que uma vez. Não muda nada no funcionamento atual:
-- sem plano definido, não há limite nenhum.

-- 1. Plano de cada equipa. Só se altera aqui no Supabase (ou, no futuro,
--    pela faturação): a app só consegue LER, para ninguém subir o próprio limite.
create table if not exists public.planos_equipa (
  team_id    uuid primary key references public.teams(id) on delete cascade,
  plano      text not null default 'base',
  limites    jsonb not null default '{}'::jsonb,   -- ex.: {"seguir_jogador_mes": 50}
  atualizado_em timestamptz not null default now()
);
alter table public.planos_equipa enable row level security;
drop policy if exists "planos: equipa lê o seu" on public.planos_equipa;
create policy "planos: equipa lê o seu" on public.planos_equipa for select to authenticated
  using (team_id in (select equipas_do_utilizador()));

-- 2. Uso de serviços que custam dinheiro (hoje: seguimento de jogador no Modal).
--    Só o servidor escreve aqui; a equipa pode ler o seu uso.
create table if not exists public.uso_servicos (
  id       bigserial primary key,
  team_id  uuid not null references public.teams(id) on delete cascade,
  servico  text not null,
  user_id  uuid,
  em       timestamptz not null default now(),
  detalhe  jsonb
);
create index if not exists uso_servicos_equipa_servico_em on public.uso_servicos (team_id, servico, em);
alter table public.uso_servicos enable row level security;
drop policy if exists "uso: equipa lê o seu" on public.uso_servicos;
create policy "uso: equipa lê o seu" on public.uso_servicos for select to authenticated
  using (team_id in (select equipas_do_utilizador()));

-- 3. Verificação
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('planos_equipa', 'uso_servicos');

-- EXEMPLOS (não correr agora):
-- Pôr um limite de 50 seguimentos por mês a uma equipa:
--   insert into planos_equipa (team_id, plano, limites)
--   values ('<id da equipa>', 'base', '{"seguir_jogador_mes": 50}')
--   on conflict (team_id) do update set limites = excluded.limites, atualizado_em = now();
-- Ver o uso deste mês por equipa:
--   select t.nome, count(*) from uso_servicos u join teams t on t.id = u.team_id
--   where u.servico = 'seguir_jogador' and u.em >= date_trunc('month', now())
--   group by 1 order by 2 desc;
