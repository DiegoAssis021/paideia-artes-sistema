-- Dados FICTÍCIOS da biblioteca, só para desenvolvimento. Pode rodar de novo (apaga e recria estes títulos).
-- Não rode em produção: os títulos e empréstimos abaixo são inventados.

delete from public.livros where titulo in (
  'O baú de aventuras', 'Gibi da Turma do Palco', 'Contos de teatro para crianças', 'Aprendendo violão',
  'Histórias em quadrinhos de dança', 'Os instrumentos da orquestra', 'Desenho passo a passo', 'A menina do tecido'
);

insert into public.livros (titulo, autor, tipo) values
  ('O baú de aventuras', 'Autoria fictícia A', 'livro'),
  ('Gibi da Turma do Palco', 'Autoria fictícia B', 'quadrinho'),
  ('Contos de teatro para crianças', 'Autoria fictícia C', 'livro'),
  ('Aprendendo violão', 'Autoria fictícia D', 'livro'),
  ('Histórias em quadrinhos de dança', 'Autoria fictícia E', 'quadrinho'),
  ('Os instrumentos da orquestra', 'Autoria fictícia F', 'livro'),
  ('Desenho passo a passo', 'Autoria fictícia G', 'quadrinho'),
  ('A menina do tecido', 'Autoria fictícia H', 'quadrinho');

-- um atrasado, um vencendo amanhã, um no prazo e uma devolução recente (alunos ativos, em ordem de nome)
with a as (select id, row_number() over (order by nome) n from public.alunos where ativo),
     l as (select id, titulo from public.livros)
insert into public.emprestimos (livro_id, aluno_id, emprestado_em, devolver_ate, devolvido_em)
select (select id from l where titulo = x.titulo), (select id from a where n = x.n),
       current_date - x.dias, current_date - x.dias + 15, case when x.devolvido then current_date - 2 end
from (values
  ('O baú de aventuras', 1, 20, false),
  ('Gibi da Turma do Palco', 2, 14, false),
  ('Aprendendo violão', 3, 3, false),
  ('Desenho passo a passo', 4, 18, true)
) as x(titulo, n, dias, devolvido);
