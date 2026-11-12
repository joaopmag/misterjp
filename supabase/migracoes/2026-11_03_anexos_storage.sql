-- Ponto 4: anexos fora da base de dados (versão corrigida).
-- Cria os dois buckets e as regras de acesso (cada equipa só mexe na sua pasta).
-- Pode correr-se mais do que uma vez sem estragar nada.

-- 1. Buckets
--    anexos           → Sala de Vídeo (Canal e Apresentações) e Exercícios.
--    anexos-privados  → Diário (só com link temporário, pedido com sessão).
insert into storage.buckets (id, name, public, file_size_limit)
values ('anexos', 'anexos', true, 73400320),                 -- 70 MB
       ('anexos-privados', 'anexos-privados', false, 10485760) -- 10 MB
on conflict (id) do nothing;

-- 2. Regras do bucket "anexos"
drop policy if exists "anexos: equipa select" on storage.objects;
create policy "anexos: equipa select" on storage.objects for select to authenticated
  using (bucket_id = 'anexos' and (storage.foldername(name))[1] in (
    select tm.team_id::text from public.team_members tm where tm.user_id = auth.uid()));

drop policy if exists "anexos: equipa insert" on storage.objects;
create policy "anexos: equipa insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos' and (storage.foldername(name))[1] in (
    select tm.team_id::text from public.team_members tm where tm.user_id = auth.uid()));

drop policy if exists "anexos: equipa delete" on storage.objects;
create policy "anexos: equipa delete" on storage.objects for delete to authenticated
  using (bucket_id = 'anexos' and (storage.foldername(name))[1] in (
    select tm.team_id::text from public.team_members tm where tm.user_id = auth.uid()));

-- 3. Regras do bucket "anexos-privados"
drop policy if exists "anexos-privados: equipa select" on storage.objects;
create policy "anexos-privados: equipa select" on storage.objects for select to authenticated
  using (bucket_id = 'anexos-privados' and (storage.foldername(name))[1] in (
    select tm.team_id::text from public.team_members tm where tm.user_id = auth.uid()));

drop policy if exists "anexos-privados: equipa insert" on storage.objects;
create policy "anexos-privados: equipa insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos-privados' and (storage.foldername(name))[1] in (
    select tm.team_id::text from public.team_members tm where tm.user_id = auth.uid()));

drop policy if exists "anexos-privados: equipa delete" on storage.objects;
create policy "anexos-privados: equipa delete" on storage.objects for delete to authenticated
  using (bucket_id = 'anexos-privados' and (storage.foldername(name))[1] in (
    select tm.team_id::text from public.team_members tm where tm.user_id = auth.uid()));

-- 4. Verificação: devem aparecer 6 regras.
select policyname, cmd from pg_policies
where schemaname = 'storage' and policyname like 'anexos%' order by 1;
