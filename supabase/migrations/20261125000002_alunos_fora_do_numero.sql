-- Espetáculos: nem todo aluno da turma participa de cada número.
-- Por padrão, todos os alunos com matrícula ativa na turma participam; esta tabela guarda só quem FICA DE FORA.
-- Assim, quem se matricula depois entra no número sozinho e não há lista para manter em dia.
create table public.numeros_espetaculo_ausentes (
  numero_id uuid not null references public.numeros_espetaculo (id) on delete cascade,
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (numero_id, aluno_id)
);
create index numeros_espetaculo_ausentes_aluno_idx on public.numeros_espetaculo_ausentes (aluno_id);

-- Dado de aluno: só a equipe lê e escreve (o professor não vê alunos de outras turmas).
alter table public.numeros_espetaculo_ausentes enable row level security;
create policy numeros_ausentes_equipe on public.numeros_espetaculo_ausentes for all to authenticated
  using ((select public.eh_equipe())) with check ((select public.eh_equipe()));
