-- Um aluno pode ter mais de um responsável (e um responsável, vários alunos).
create table public.aluno_responsaveis (
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  responsavel_id uuid not null references public.responsaveis (id) on delete cascade,
  ordem smallint not null default 1,  -- 1 = responsável principal (recebe a mensagem de WhatsApp)
  primary key (aluno_id, responsavel_id)
);
create index aluno_responsaveis_resp_idx on public.aluno_responsaveis (responsavel_id);

-- Leva os vínculos que já existiam.
insert into public.aluno_responsaveis (aluno_id, responsavel_id, ordem)
select id, responsavel_id, 1 from public.alunos where responsavel_id is not null;

drop index public.alunos_responsavel_idx;
alter table public.alunos drop column responsavel_id;

alter table public.aluno_responsaveis enable row level security;
create policy aluno_responsaveis_equipe on public.aluno_responsaveis for all to authenticated
  using ((select public.eh_equipe())) with check ((select public.eh_equipe()));
