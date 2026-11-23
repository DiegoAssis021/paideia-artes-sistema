-- Dados de referência da escola (não são dados de alunos): salas e cursos.
-- Cores das salas seguem o protótipo; as indefinidas usam cinza até a escola escolher.

insert into public.salas (nome, uso, cor, ordem) values
  ('Sala Carmy Ferreira',    'Teatro e dança',       '#A82A21', 1),
  ('Sala Marcinha Gomes',    'Música',               '#1F1D2B', 2),
  ('Sala Ray Barroso',       'Música',               '#605B6E', 3),
  ('Sala de Desenho',        'Desenho',              '#2766A6', 4),
  ('Sala Denise',            'Dança',                '#7A3D9B', 5),
  ('Teatro Almir Rodrigues', 'Andar de baixo',       '#605B6E', 6),
  ('Sala Emerson Raphael',   'Piano e instrumentos', '#2F6B4F', 7);

insert into public.cursos (nome, ordem) values
  ('Música', 1),
  ('Dança', 2),
  ('Teatro', 3),
  ('Dublagem', 4),
  ('Tecido e lira', 5),
  ('Palhaçaria', 6),
  ('Musicalização', 7),
  ('Desenho', 8);
