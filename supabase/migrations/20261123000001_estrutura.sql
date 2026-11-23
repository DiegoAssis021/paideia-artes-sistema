-- Paideia Artes: estrutura do banco (tabelas e tipos).
-- A RLS (quem pode ver e alterar o quê) fica na migration seguinte.
-- Nenhum dado de cartão é guardado em lugar nenhum: só a forma de pagamento em texto (Pix, dinheiro...).

create type public.perfil_tipo as enum ('coordenacao', 'secretaria', 'professor');

-- ---------------------------------------------------------------- pessoas com acesso
-- Uma linha por usuário do Supabase Auth. Quem se cadastra entra inativo (ativo = false)
-- e só ganha acesso quando a coordenação libera.
create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  perfil public.perfil_tipo not null default 'professor',
  ativo boolean not null default false,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------- estrutura da escola
create table public.salas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  uso text,
  cor text not null default '#605B6E',
  ordem smallint not null default 0
);

create table public.cursos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ordem smallint not null default 0
);

create table public.turmas (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos (id),
  nome text not null,
  semestre text not null default '2026.2',
  idade_min smallint,
  idade_max smallint,
  vagas_total smallint not null check (vagas_total > 0),
  professor_id uuid references public.perfis (id) on delete set null,
  sala_id uuid references public.salas (id) on delete set null,
  publicada_no_site boolean not null default true,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  check (idade_min is null or idade_max is null or idade_min <= idade_max)
);
create index turmas_professor_idx on public.turmas (professor_id);
create index turmas_curso_idx on public.turmas (curso_id);

-- dia_semana: 1 = segunda ... 7 = domingo
create table public.horarios (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas (id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 1 and 7),
  inicio time not null,
  fim time not null,
  check (fim > inicio)
);
create index horarios_turma_idx on public.horarios (turma_id);

-- ---------------------------------------------------------------- alunos e responsáveis
create table public.responsaveis (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  parentesco text,
  whatsapp text,
  email text,
  observacoes text,
  criado_em timestamptz not null default now()
);

create table public.alunos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nascimento date,
  responsavel_id uuid references public.responsaveis (id) on delete set null,
  -- O professor enxerga só nome, idade e este contato (pela view vw_alunos_do_professor).
  contato_emergencia_nome text,
  contato_emergencia_telefone text,
  observacoes text,
  ativo boolean not null default true,
  aluno_desde date not null default current_date,
  criado_em timestamptz not null default now()
);
create index alunos_responsavel_idx on public.alunos (responsavel_id);
create index alunos_nome_idx on public.alunos (lower(nome));

create table public.matriculas (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  turma_id uuid not null references public.turmas (id) on delete cascade,
  status text not null default 'ativa' check (status in ('ativa', 'trancada', 'encerrada')),
  data_inicio date not null default current_date,
  data_fim date,
  criado_em timestamptz not null default now()
);
-- Um aluno não pode ter duas matrículas ativas na mesma turma.
create unique index matriculas_ativa_unica on public.matriculas (aluno_id, turma_id) where status = 'ativa';
create index matriculas_turma_idx on public.matriculas (turma_id);

-- ---------------------------------------------------------------- chamada
create table public.presencas (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas (id) on delete cascade,
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  data date not null,
  presente boolean not null,
  registrado_por uuid references public.perfis (id) on delete set null default auth.uid(),
  registrado_em timestamptz not null default now(),
  unique (turma_id, aluno_id, data)
);
create index presencas_turma_data_idx on public.presencas (turma_id, data);

-- ---------------------------------------------------------------- financeiro
create table public.mensalidades (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  competencia date not null check (extract(day from competencia) = 1), -- sempre dia 1 do mês
  valor numeric(10, 2) not null check (valor >= 0),
  vencimento date not null,
  status text not null default 'avencer' check (status in ('avencer', 'pago', 'atraso', 'cancelado')),
  pago_em date,
  forma_pagamento text, -- texto livre: Pix, dinheiro... NUNCA número de cartão
  criado_em timestamptz not null default now(),
  unique (aluno_id, competencia)
);
create index mensalidades_status_idx on public.mensalidades (status, vencimento);

-- ---------------------------------------------------------------- uso de imagem
-- Histórico: o estado atual de cada aluno é o registro mais recente.
create table public.autorizacoes_imagem (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  autorizado boolean not null,
  assinado_por text,
  observacao text,
  registrado_em timestamptz not null default now(),
  registrado_por uuid references public.perfis (id) on delete set null default auth.uid()
);
create index autorizacoes_imagem_aluno_idx on public.autorizacoes_imagem (aluno_id, registrado_em desc);

-- ---------------------------------------------------------------- espetáculos
create table public.espetaculos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  data date,
  hora_inicio time,
  local text,
  status text not null default 'planejamento' check (status in ('planejamento', 'confirmado', 'realizado', 'cancelado')),
  criado_em timestamptz not null default now()
);

create table public.numeros_espetaculo (
  id uuid primary key default gen_random_uuid(),
  espetaculo_id uuid not null references public.espetaculos (id) on delete cascade,
  turma_id uuid references public.turmas (id) on delete set null,
  titulo text not null,
  ordem smallint not null default 0,
  duracao_min smallint check (duracao_min is null or duracao_min > 0),
  figurino_ok boolean not null default false,
  som_ok boolean not null default false,
  observacoes text
);
create index numeros_espetaculo_idx on public.numeros_espetaculo (espetaculo_id, ordem);

-- ---------------------------------------------------------------- biblioteca
create table public.livros (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  autor text,
  tipo text not null default 'livro' check (tipo in ('livro', 'quadrinho')),
  criado_em timestamptz not null default now()
);

-- Prazo de 15 dias. Não há renovação nem multa (regra da escola).
create table public.emprestimos (
  id uuid primary key default gen_random_uuid(),
  livro_id uuid not null references public.livros (id) on delete cascade,
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  emprestado_em date not null default current_date,
  devolver_ate date not null default (current_date + 15),
  devolvido_em date,
  check (devolver_ate >= emprestado_em)
);
-- Um livro só pode estar emprestado para uma pessoa por vez.
create unique index emprestimos_livro_aberto on public.emprestimos (livro_id) where devolvido_em is null;
create index emprestimos_aluno_idx on public.emprestimos (aluno_id);

-- ---------------------------------------------------------------- novo usuário entra inativo
create function public.novo_usuario_cria_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, perfil, ativo)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(new.email, '@', 1)), 'professor', false);
  return new;
end;
$$;

create trigger ao_criar_usuario
after insert on auth.users
for each row execute function public.novo_usuario_cria_perfil();
