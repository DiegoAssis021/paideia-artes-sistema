-- Dados FICTÍCIOS de espetáculos (só para desenvolvimento). Pode rodar mais de uma vez.
-- Precisa do seed.sql (turmas) e da migration 20261125000001_ensaios.sql já aplicados.

delete from public.espetaculos where nome in ('V Festival Mizinho', 'Mostra de fim de ano');

insert into public.espetaculos (nome, data, hora_inicio, local, status, exposicao) values
  ('V Festival Mizinho',   date '2026-11-28', '18:00', 'Teatro Almir Rodrigues', 'confirmado',   'Exposição de desenhos no hall de entrada'),
  ('Mostra de fim de ano', date '2026-12-12', '17:00', 'Teatro Almir Rodrigues', 'planejamento', null);

insert into public.numeros_espetaculo (espetaculo_id, turma_id, titulo, ordem, duracao_min, figurino_ok, som_ok)
select e.id, t.id, n.titulo, n.ordem, n.dur, n.fig, n.som
from (values
  ('V Festival Mizinho', 'Ballet baby',            'Jardim encantado',        0,  5, true,  true),
  ('V Festival Mizinho', 'Teatro infantil',        'O baú de histórias',      1, 10, true,  false),
  ('V Festival Mizinho', 'Musicalização infantil', 'Bandinha do Paideia',     2,  5, true,  true),
  ('V Festival Mizinho', 'Ballet infantojuvenil',  'Valsa das flores',        3,  6, false, true),
  ('V Festival Mizinho', 'Violão iniciante',       'Clássicos do baião',      4,  6, true,  true),
  ('V Festival Mizinho', 'K-Pop',                  'Coreografia autoral',     5,  5, false, true),
  ('V Festival Mizinho', 'Palhaçaria',             'A mala perdida',          6,  8, true,  false),
  ('V Festival Mizinho', 'Tecido acrobático',      'Voo',                     7,  6, true,  true),
  ('V Festival Mizinho', 'Jazz jovem e adulto',    'Noite de jazz',           8,  6, true,  false),
  ('V Festival Mizinho', 'Teatro adulto',          'Cenas de família',        9, 12, false, true),
  ('Mostra de fim de ano', 'Ballet infantojuvenil', 'Trechos de O Quebra-Nozes', 0, 8, false, true),
  ('Mostra de fim de ano', 'Teatro infantil',       'Auto de Natal',          1, 10, false, false),
  ('Mostra de fim de ano', 'K-Pop',                 'Coreografia de encerramento', 2, 5, false, true)
) as n(espetaculo, turma, titulo, ordem, dur, fig, som)
join public.espetaculos e on e.nome = n.espetaculo
join public.turmas t on t.nome = n.turma;

insert into public.ensaios (espetaculo_id, titulo, data, hora_inicio, hora_fim, local, observacao)
select e.id, x.titulo, x.data, x.ini, x.fim, x.local, x.obs
from (values
  ('V Festival Mizinho', 'Ensaios por turma',             null::date,       null::time, null::time, null,                      'Nas aulas de novembro'),
  ('V Festival Mizinho', 'Ensaio geral',                  date '2026-11-21', '13:00',   '17:00',    'Teatro Almir Rodrigues', null),
  ('V Festival Mizinho', 'Ensaio técnico de luz e som',   date '2026-11-27', '19:00',   '21:00',    'Teatro Almir Rodrigues', null),
  ('Mostra de fim de ano', 'Ensaio geral',                date '2026-12-05', '13:00',   '17:00',    'Teatro Almir Rodrigues', null)
) as x(espetaculo, titulo, data, ini, fim, local, obs)
join public.espetaculos e on e.nome = x.espetaculo;
