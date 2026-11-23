-- Paideia Artes: RLS em TODAS as tabelas.
-- Perfis (CLAUDE.md):
--   coordenacao: tudo, inclusive quem tem acesso a quê.
--   secretaria:  turmas, matrículas, ficha dos alunos e cobranças.
--   professor:   só as próprias turmas e a chamada. Sem financeiro.
--                Vê só nome, idade e contato de emergência (view vw_alunos_do_professor).
-- Sem política = ninguém acessa. O papel "anon" não recebe política nenhuma.

-- ---------------------------------------------------------------- funções auxiliares
-- security definer + search_path vazio: leem perfis sem cair em recursão de RLS.
create function public.perfil_atual()
returns public.perfil_tipo
language sql
stable
security definer
set search_path = ''
as $$
  select p.perfil from public.perfis p where p.id = auth.uid() and p.ativo
$$;

create function public.eh_coordenacao()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.perfil_atual() = 'coordenacao', false)
$$;

-- coordenação ou secretaria
create function public.eh_equipe()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.perfil_atual() in ('coordenacao', 'secretaria'), false)
$$;

create function public.usuario_ativo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.perfil_atual() is not null
$$;

-- a turma é do professor logado?
create function public.turma_do_professor(p_turma uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.turmas t
    where t.id = p_turma and t.professor_id = auth.uid()
  ) and public.perfil_atual() = 'professor'
$$;

revoke all on function public.perfil_atual(), public.eh_coordenacao(), public.eh_equipe(),
  public.usuario_ativo(), public.turma_do_professor(uuid) from public, anon;
grant execute on function public.perfil_atual(), public.eh_coordenacao(), public.eh_equipe(),
  public.usuario_ativo(), public.turma_do_professor(uuid) to authenticated;

-- ---------------------------------------------------------------- liga a RLS
alter table public.perfis enable row level security;
alter table public.salas enable row level security;
alter table public.cursos enable row level security;
alter table public.turmas enable row level security;
alter table public.horarios enable row level security;
alter table public.responsaveis enable row level security;
alter table public.alunos enable row level security;
alter table public.matriculas enable row level security;
alter table public.presencas enable row level security;
alter table public.mensalidades enable row level security;
alter table public.autorizacoes_imagem enable row level security;
alter table public.espetaculos enable row level security;
alter table public.numeros_espetaculo enable row level security;
alter table public.livros enable row level security;
alter table public.emprestimos enable row level security;

-- ---------------------------------------------------------------- perfis
-- Cada pessoa lê o próprio perfil (mesmo inativa, para ver "aguardando liberação").
-- Usuários ativos veem nome e perfil dos colegas (precisam do nome do professor).
-- Só a coordenação cria, altera ou remove. Ninguém altera o próprio perfil (evita se promover).
create policy perfis_ler on public.perfis for select to authenticated
  using (id = (select auth.uid()) or (select public.usuario_ativo()));
create policy perfis_inserir on public.perfis for insert to authenticated
  with check ((select public.eh_coordenacao()));
create policy perfis_alterar on public.perfis for update to authenticated
  using ((select public.eh_coordenacao())) with check ((select public.eh_coordenacao()));
create policy perfis_apagar on public.perfis for delete to authenticated
  using ((select public.eh_coordenacao()));

-- ---------------------------------------------------------------- salas e cursos
create policy salas_ler on public.salas for select to authenticated using ((select public.usuario_ativo()));
create policy salas_escrever on public.salas for all to authenticated
  using ((select public.eh_coordenacao())) with check ((select public.eh_coordenacao()));

create policy cursos_ler on public.cursos for select to authenticated using ((select public.usuario_ativo()));
create policy cursos_escrever on public.cursos for all to authenticated
  using ((select public.eh_coordenacao())) with check ((select public.eh_coordenacao()));

-- ---------------------------------------------------------------- turmas e horários
create policy turmas_ler on public.turmas for select to authenticated
  using ((select public.eh_equipe()) or (professor_id = (select auth.uid()) and (select public.usuario_ativo())));
create policy turmas_escrever on public.turmas for all to authenticated
  using ((select public.eh_equipe())) with check ((select public.eh_equipe()));

create policy horarios_ler on public.horarios for select to authenticated
  using ((select public.eh_equipe()) or (select public.turma_do_professor(turma_id)));
create policy horarios_escrever on public.horarios for all to authenticated
  using ((select public.eh_equipe())) with check ((select public.eh_equipe()));

-- ---------------------------------------------------------------- alunos e responsáveis (só equipe)
create policy responsaveis_equipe on public.responsaveis for all to authenticated
  using ((select public.eh_equipe())) with check ((select public.eh_equipe()));

create policy alunos_equipe on public.alunos for all to authenticated
  using ((select public.eh_equipe())) with check ((select public.eh_equipe()));

-- ---------------------------------------------------------------- matrículas
-- Professor lê só as matrículas das próprias turmas (são ids, sem dado pessoal).
create policy matriculas_ler on public.matriculas for select to authenticated
  using ((select public.eh_equipe()) or (select public.turma_do_professor(turma_id)));
create policy matriculas_escrever on public.matriculas for all to authenticated
  using ((select public.eh_equipe())) with check ((select public.eh_equipe()));

-- ---------------------------------------------------------------- presenças (chamada)
-- Professor lança e corrige a chamada só das próprias turmas, e só para alunos matriculados nelas.
create policy presencas_ler on public.presencas for select to authenticated
  using ((select public.eh_equipe()) or (select public.turma_do_professor(turma_id)));
create policy presencas_equipe on public.presencas for all to authenticated
  using ((select public.eh_equipe())) with check ((select public.eh_equipe()));
create policy presencas_professor_inserir on public.presencas for insert to authenticated
  with check (
    (select public.turma_do_professor(turma_id))
    and exists (
      select 1 from public.matriculas m
      where m.turma_id = presencas.turma_id and m.aluno_id = presencas.aluno_id and m.status = 'ativa'
    )
  );
create policy presencas_professor_alterar on public.presencas for update to authenticated
  using ((select public.turma_do_professor(turma_id)))
  with check ((select public.turma_do_professor(turma_id)));

-- ---------------------------------------------------------------- financeiro e imagem (só equipe, nunca professor)
create policy mensalidades_equipe on public.mensalidades for all to authenticated
  using ((select public.eh_equipe())) with check ((select public.eh_equipe()));

create policy autorizacoes_imagem_equipe on public.autorizacoes_imagem for all to authenticated
  using ((select public.eh_equipe())) with check ((select public.eh_equipe()));

-- ---------------------------------------------------------------- espetáculos (leitura para todos os ativos)
create policy espetaculos_ler on public.espetaculos for select to authenticated using ((select public.usuario_ativo()));
create policy espetaculos_escrever on public.espetaculos for all to authenticated
  using ((select public.eh_equipe())) with check ((select public.eh_equipe()));

create policy numeros_ler on public.numeros_espetaculo for select to authenticated using ((select public.usuario_ativo()));
create policy numeros_escrever on public.numeros_espetaculo for all to authenticated
  using ((select public.eh_equipe())) with check ((select public.eh_equipe()));

-- ---------------------------------------------------------------- biblioteca
create policy livros_ler on public.livros for select to authenticated using ((select public.usuario_ativo()));
create policy livros_escrever on public.livros for all to authenticated
  using ((select public.eh_equipe())) with check ((select public.eh_equipe()));

create policy emprestimos_equipe on public.emprestimos for all to authenticated
  using ((select public.eh_equipe())) with check ((select public.eh_equipe()));

-- ---------------------------------------------------------------- view do professor
-- Só nome, nascimento (para calcular a idade) e contato de emergência, e só dos alunos
-- de turmas do próprio professor. A equipe vê de todas as turmas.
-- Roda com o dono da view (por isso filtra por auth.uid() aqui dentro) e fica fechada para anon.
create view public.vw_alunos_do_professor
with (security_invoker = false)
as
select
  m.turma_id,
  a.id as aluno_id,
  a.nome,
  a.nascimento,
  a.contato_emergencia_nome,
  a.contato_emergencia_telefone
from public.matriculas m
join public.alunos a on a.id = m.aluno_id
where m.status = 'ativa'
  and a.ativo
  and (public.eh_equipe() or public.turma_do_professor(m.turma_id));

revoke all on public.vw_alunos_do_professor from public, anon;
grant select on public.vw_alunos_do_professor to authenticated;

-- ---------------------------------------------------------------- permissões de tabela
-- A RLS filtra linhas; estes grants garantem que o papel anon não toque em nada.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
