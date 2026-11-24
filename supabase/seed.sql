-- SEED DE DESENVOLVIMENTO: tudo aqui é FICTÍCIO (nomes, telefones, datas).
-- Nunca rode em produção. Pode ser rodado de novo: apaga os dados de exemplo antes.
--
-- Os professores do seed são usuários "de mentira" (sem senha, e-mail @exemplo.invalid):
-- servem só para as turmas terem professor. Ninguém consegue entrar com eles.
-- Para entrar no sistema, crie o seu usuário em Authentication > Users no Supabase e
-- promova-o a coordenação (veja o README, seção "Primeiro acesso").

-- limpeza (ordem respeita as chaves estrangeiras)
delete from public.presencas;
delete from public.matriculas;
delete from public.horarios;
delete from public.turmas;
delete from public.alunos;
delete from public.aluno_responsaveis;
delete from public.responsaveis;
delete from auth.users where email like '%@exemplo.invalid';

-- ---------------------------------------------------------------- professores fictícios
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'carla@exemplo.invalid',   '{"nome":"Carla Menezes"}',   now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'bruna@exemplo.invalid',   '{"nome":"Bruna Assunção"}',  now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'thiago@exemplo.invalid',  '{"nome":"Thiago Lins"}',     now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a4', 'authenticated', 'authenticated', 'marcos@exemplo.invalid',  '{"nome":"Marcos Teles"}',    now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a5', 'authenticated', 'authenticated', 'renata@exemplo.invalid',  '{"nome":"Renata Souza"}',    now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a6', 'authenticated', 'authenticated', 'paulo@exemplo.invalid',   '{"nome":"Paulo Vieira"}',    now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a7', 'authenticated', 'authenticated', 'livia@exemplo.invalid',   '{"nome":"Lívia Rocha"}',     now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a8', 'authenticated', 'authenticated', 'bia@exemplo.invalid',     '{"nome":"Bia Castro"}',      now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a9', 'authenticated', 'authenticated', 'leo@exemplo.invalid',     '{"nome":"Léo Amaral"}',      now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000b0', 'authenticated', 'authenticated', 'gabriel@exemplo.invalid', '{"nome":"Gabriel Nunes"}',   now(), now());

-- o gatilho criou os perfis inativos; libera como professores
update public.perfis set perfil = 'professor', ativo = true
where id in (select id from auth.users where email like '%@exemplo.invalid');

-- ---------------------------------------------------------------- turmas
insert into public.turmas (curso_id, nome, idade_min, idade_max, vagas_total, professor_id, sala_id)
select c.id, v.nome, v.imin, v.imax, v.vagas, p.id, s.id
from (values
  ('Dança',         'Ballet baby',            3,  5,  12, 'Carla Menezes',  'Sala Denise'),
  ('Dança',         'Ballet infantojuvenil',  6, 12,  12, 'Carla Menezes',  'Sala Denise'),
  ('Dança',         'Jazz jovem e adulto',   15, null, 14, 'Bruna Assunção', 'Sala Carmy Ferreira'),
  ('Dança',         'K-Pop',                 10, 17,  15, 'Thiago Lins',    'Sala Denise'),
  ('Dança',         'Dança de salão',        18, null, 16, 'Marcos Teles',   'Sala Carmy Ferreira'),
  ('Teatro',        'Teatro infantil',        7, 11,  15, 'Renata Souza',   'Sala Carmy Ferreira'),
  ('Teatro',        'Teatro adulto',         18, null, 15, 'Renata Souza',   'Teatro Almir Rodrigues'),
  ('Música',        'Violão iniciante',      12, null,  6, 'Paulo Vieira',   'Sala Emerson Raphael'),
  ('Música',        'Canto popular',         14, null,  8, 'Lívia Rocha',    'Sala Marcinha Gomes'),
  ('Musicalização', 'Musicalização infantil', 4,  6,   8, 'Lívia Rocha',    'Sala Ray Barroso'),
  ('Tecido e lira', 'Tecido acrobático',     12, null,  6, 'Bia Castro',     'Teatro Almir Rodrigues'),
  ('Palhaçaria',    'Palhaçaria',            14, null, 12, 'Léo Amaral',     'Sala Carmy Ferreira'),
  ('Dublagem',      'Dublagem',              14, null, 10, 'Marcos Teles',   'Sala Marcinha Gomes'),
  ('Desenho',       'Desenho infantil',       7, 12,  10, 'Gabriel Nunes',   'Sala de Desenho')
) as v(curso, nome, imin, imax, vagas, prof, sala)
join public.cursos c on c.nome = v.curso
join public.perfis p on p.nome = v.prof
join public.salas s on s.nome = v.sala;

-- ---------------------------------------------------------------- horários (1 = segunda ... 7 = domingo)
insert into public.horarios (turma_id, dia_semana, inicio, fim)
select t.id, v.dia, v.ini::time, v.fim::time
from (values
  ('Ballet baby', 1, '14:00', '15:00'), ('Ballet baby', 3, '14:00', '15:00'),
  ('Ballet infantojuvenil', 2, '16:00', '17:00'), ('Ballet infantojuvenil', 5, '16:00', '17:00'),
  ('Jazz jovem e adulto', 1, '19:00', '20:00'), ('Jazz jovem e adulto', 3, '19:00', '20:00'),
  ('K-Pop', 6, '10:00', '11:30'),
  ('Dança de salão', 5, '20:00', '21:00'),
  ('Teatro infantil', 6, '09:00', '10:30'),
  ('Teatro adulto', 4, '19:00', '21:00'),
  ('Violão iniciante', 2, '17:00', '18:00'),
  ('Canto popular', 3, '18:00', '19:00'),
  ('Musicalização infantil', 6, '11:00', '12:00'),
  ('Tecido acrobático', 4, '09:00', '10:30'),
  ('Palhaçaria', 3, '20:00', '21:00'),
  ('Dublagem', 5, '17:00', '18:30'),
  ('Desenho infantil', 6, '14:00', '15:30')
) as v(turma, dia, ini, fim)
join public.turmas t on t.nome = v.turma;

-- ---------------------------------------------------------------- responsáveis e alunos fictícios
with resp as (
  insert into public.responsaveis (nome, parentesco, whatsapp, email) values
    ('Patrícia Martins',  'Mãe',  '(21) 90000-0001', 'patricia@exemplo.invalid'),
    ('Ricardo Almeida',   'Pai',  '(21) 90000-0002', 'ricardo@exemplo.invalid'),
    ('Dona Lúcia Prado',  'Avó',  '(21) 90000-0003', null),
    ('Fernanda Tavares',  'Mãe',  '(21) 90000-0004', 'fernanda@exemplo.invalid'),
    ('Jorge Bastos',      'Pai',  '(21) 90000-0005', null),
    ('Camila Duarte',     'Mãe',  '(21) 90000-0006', 'camila@exemplo.invalid'),
    ('Sandra Pinheiro',   'Mãe',  '(21) 90000-0007', null),
    ('Marta Queiroz',     'Mãe',  '(21) 90000-0008', 'marta@exemplo.invalid'),
    ('Ricardo Ribeiro',   'Pai',  '(21) 90000-0009', 'ricardo.ribeiro@exemplo.invalid')
  returning id, nome
),
v as (
  select * from (values
  ('Sofia Martins Ribeiro', '2018-04-12', 'Patrícia Martins', 'Ricardo Ribeiro (pai)', '(21) 90000-0011', 'Prefere ser chamada de Sofi.', '2024-03-12'),
  ('Pedro Martins Ribeiro', '2013-09-03', 'Patrícia Martins', 'Ricardo Ribeiro (pai)', '(21) 90000-0011', null, '2024-03-12'),
  ('Helena Almeida',        '2019-01-20', 'Ricardo Almeida',  'Ana Almeida (mãe)',     '(21) 90000-0012', null, '2025-02-10'),
  ('Miguel Almeida',        '2016-06-08', 'Ricardo Almeida',  'Ana Almeida (mãe)',     '(21) 90000-0012', null, '2025-02-10'),
  ('Laura Prado',           '2017-11-30', 'Dona Lúcia Prado', 'Dona Lúcia Prado',      '(21) 90000-0003', 'Quem busca às terças é a avó.', '2023-08-01'),
  ('Davi Tavares',          '2012-02-14', 'Fernanda Tavares', 'Fernanda Tavares',      '(21) 90000-0004', null, '2024-08-05'),
  ('Alice Tavares',         '2014-05-27', 'Fernanda Tavares', 'Fernanda Tavares',      '(21) 90000-0004', null, '2024-08-05'),
  ('Theo Bastos',           '2015-10-10', 'Jorge Bastos',     'Jorge Bastos',          '(21) 90000-0005', null, '2025-03-03'),
  ('Valentina Duarte',      '2011-07-19', 'Camila Duarte',    'Camila Duarte',         '(21) 90000-0006', null, '2022-02-14'),
  ('Enzo Duarte',           '2018-12-02', 'Camila Duarte',    'Camila Duarte',         '(21) 90000-0006', null, '2025-02-17'),
  ('Beatriz Pinheiro',      '2009-03-25', 'Sandra Pinheiro',  'Sandra Pinheiro',       '(21) 90000-0007', null, '2021-09-01'),
  ('Lucas Queiroz',         '2010-08-16', 'Marta Queiroz',    'Marta Queiroz',         '(21) 90000-0008', null, '2023-03-06'),
  ('Cecília Queiroz',       '2017-04-04', 'Marta Queiroz',    'Marta Queiroz',         '(21) 90000-0008', null, '2023-03-06')
) as t(nome, nasc, resp, emerg, tel, obs, desde)
),
novos as (
  insert into public.alunos (nome, nascimento, contato_emergencia_nome, contato_emergencia_telefone, observacoes, aluno_desde)
  select nome, nasc::date, emerg, tel, obs, desde::date from v
  returning id, nome
)
-- Responsável principal (ordem 1) e, para os irmãos Ribeiro, um segundo responsável.
insert into public.aluno_responsaveis (aluno_id, responsavel_id, ordem)
select n.id, r.id, 1 from novos n join v on v.nome = n.nome join resp r on r.nome = v.resp
union all
select n.id, r.id, 2 from novos n join resp r on r.nome = 'Ricardo Ribeiro'
where n.nome in ('Sofia Martins Ribeiro', 'Pedro Martins Ribeiro');

-- ---------------------------------------------------------------- matrículas
insert into public.matriculas (aluno_id, turma_id, data_inicio)
select a.id, t.id, a.aluno_desde
from (values
  ('Sofia Martins Ribeiro', 'Ballet infantojuvenil'), ('Sofia Martins Ribeiro', 'Teatro infantil'),
  ('Pedro Martins Ribeiro', 'Violão iniciante'),
  ('Helena Almeida', 'Ballet baby'),
  ('Miguel Almeida', 'Desenho infantil'),
  ('Laura Prado', 'Ballet infantojuvenil'), ('Laura Prado', 'Musicalização infantil'),
  ('Davi Tavares', 'K-Pop'), ('Davi Tavares', 'Violão iniciante'),
  ('Alice Tavares', 'Teatro infantil'), ('Alice Tavares', 'Ballet infantojuvenil'),
  ('Theo Bastos', 'Desenho infantil'),
  ('Valentina Duarte', 'K-Pop'), ('Valentina Duarte', 'Canto popular'),
  ('Enzo Duarte', 'Ballet baby'),
  ('Beatriz Pinheiro', 'Jazz jovem e adulto'), ('Beatriz Pinheiro', 'Dublagem'),
  ('Lucas Queiroz', 'Dublagem'), ('Lucas Queiroz', 'Palhaçaria'),
  ('Cecília Queiroz', 'Musicalização infantil'), ('Cecília Queiroz', 'Desenho infantil')
) as v(aluno, turma)
join public.alunos a on a.nome = v.aluno
join public.turmas t on t.nome = v.turma;

-- ---------------------------------------------------------------- chamadas fictícias
-- Aulas das últimas duas semanas (até ontem). Algumas ficam sem chamada de propósito,
-- para o calendário mostrar aulas "sem chamada"; as faltas são sorteadas de forma fixa.
insert into public.presencas (turma_id, aluno_id, data, presente, registrado_por, registrado_em)
select m.turma_id, m.aluno_id, d.dia::date,
       (length(a.nome) + extract(day from d.dia)::int) % 6 <> 0,
       t.professor_id,
       (d.dia::date + h.fim + interval '5 minutes') at time zone 'America/Sao_Paulo'
from generate_series(current_date - 14, current_date - 1, interval '1 day') as d(dia)
join public.horarios h on h.dia_semana = extract(isodow from d.dia)::int
join public.turmas t on t.id = h.turma_id and t.ativa
join public.matriculas m on m.turma_id = t.id and m.status = 'ativa'
join public.alunos a on a.id = m.aluno_id
where (extract(day from d.dia)::int + length(t.nome)) % 4 <> 0
on conflict (turma_id, aluno_id, data) do nothing;
