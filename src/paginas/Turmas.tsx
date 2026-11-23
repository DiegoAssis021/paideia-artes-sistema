import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Carregando, Erro, Selo, Stat, Topo, Vazio } from '../componentes/pecas';
import { ativas, faixaIdade, resumoHorarios, situacaoVagas } from '../lib/formatar';
import { ler, supabase } from '../lib/supabase';
import type { TurmaLinha } from '../lib/tipos';
import { useCarregar } from '../lib/useCarregar';

const FAIXAS = [
  { id: 'todas', rotulo: 'Todas as idades', min: 0, max: 200 },
  { id: 'cri', rotulo: 'Crianças (até 11 anos)', min: 0, max: 11 },
  { id: 'ado', rotulo: 'Adolescentes (12 a 17)', min: 12, max: 17 },
  { id: 'adu', rotulo: 'Adultos (18 ou mais)', min: 18, max: 200 },
];

const CONSULTA =
  'id, nome, idade_min, idade_max, vagas_total, publicada_no_site, ativa, professor_id, sala_id, curso_id,' +
  ' cursos(nome), salas(nome, cor), perfis(nome), horarios(dia_semana, inicio, fim), matriculas(status)';

export default function Turmas() {
  const { eEquipe } = useAuth();
  const ir = useNavigate();
  const [curso, setCurso] = useState('Todos');
  const [faixa, setFaixa] = useState('todas');
  const [soVaga, setSoVaga] = useState(false);

  const { dados, erro, carregando } = useCarregar(
    async () =>
      ler<TurmaLinha[]>(supabase.from('turmas').select(CONSULTA).eq('ativa', true).order('nome') as never),
    [],
  );

  const cursos = useMemo(
    () => ['Todos', ...new Set((dados ?? []).map((t) => t.cursos?.nome ?? '').filter(Boolean))],
    [dados],
  );

  const todas = useMemo(
    () => (dados ?? []).map((t) => ({ t, v: situacaoVagas(t.vagas_total, ativas(t.matriculas)), ocup: ativas(t.matriculas) })),
    [dados],
  );

  const lista = todas.filter(({ t, v }) => {
    const f = FAIXAS.find((x) => x.id === faixa)!;
    const tMin = t.idade_min ?? 0;
    const tMax = t.idade_max ?? 200;
    return (
      (curso === 'Todos' || t.cursos?.nome === curso) &&
      tMin <= f.max &&
      tMax >= f.min &&
      (!soVaga || v.livres > 0)
    );
  });

  const matr = todas.reduce((a, x) => a + x.ocup, 0);
  const vagas = todas.reduce((a, x) => a + x.v.livres, 0);
  const lotadas = todas.filter((x) => x.v.livres === 0).length;
  const ultimas = todas.filter((x) => x.v.livres > 0 && x.v.livres <= 2).length;

  return (
    <>
      <Topo
        titulo={eEquipe ? 'Turmas' : 'Minhas turmas'}
        subtitulo="Segundo semestre de 2026"
        acoes={
          eEquipe ? (
            <button type="button" className="btn" onClick={() => ir('/turmas/nova')}>
              Nova turma
            </button>
          ) : null
        }
      />
      {erro ? <Erro texto={erro} /> : null}
      {carregando ? <Carregando /> : null}
      {dados ? (
        <>
          <div className="stats">
            <Stat rotulo={eEquipe ? 'Turmas ativas' : 'Minhas turmas'} valor={todas.length} />
            <Stat rotulo="Matrículas" valor={matr} />
            {eEquipe ? (
              <>
                <Stat rotulo="Vagas abertas" valor={vagas} />
                <Stat rotulo="Turmas lotadas" valor={lotadas} nota={`${ultimas} com as últimas vagas`} />
              </>
            ) : null}
          </div>

          <section className="card filtros" aria-label="Filtros">
            <div>
              <div className="filtros__rotulo" id="rot-curso">
                Curso
              </div>
              <div className="chips" role="group" aria-labelledby="rot-curso">
                {cursos.map((c) => (
                  <button key={c} type="button" className="chip" aria-pressed={c === curso} onClick={() => setCurso(c)}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="filtros__linha">
              <div className="filtros__ctrl">
                <label>
                  Faixa de idade
                  <select value={faixa} onChange={(e) => setFaixa(e.target.value)}>
                    {FAIXAS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.rotulo}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <input type="checkbox" checked={soVaga} onChange={(e) => setSoVaga(e.target.checked)} />
                  Só turmas com vaga
                </label>
              </div>
            </div>
          </section>

          <div className="card tabela">
            {lista.length === 0 ? (
              <Vazio texto={todas.length === 0 ? 'Nenhuma turma cadastrada ainda.' : 'Nenhuma turma com esses filtros.'}>
                {todas.length > 0 ? (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      setCurso('Todos');
                      setFaixa('todas');
                      setSoVaga(false);
                    }}
                  >
                    Limpar filtros
                  </button>
                ) : null}
              </Vazio>
            ) : (
              <table style={{ minWidth: 920 }}>
                <thead>
                  <tr>
                    <th scope="col">Turma</th>
                    <th scope="col">Idade</th>
                    <th scope="col">Dias e horário</th>
                    <th scope="col">Professor</th>
                    <th scope="col">Sala</th>
                    <th scope="col">Ocupação</th>
                    <th scope="col">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(({ t, v, ocup }) => {
                    const h = resumoHorarios(t.horarios);
                    return (
                      <tr key={t.id}>
                        <td>
                          <div className="dois">
                            <Link className="link-turma" to={`/turmas/${t.id}`}>
                              {t.nome}
                            </Link>
                            <span className="leve">{t.cursos?.nome}</span>
                          </div>
                        </td>
                        <td className="nw">{faixaIdade(t.idade_min, t.idade_max)}</td>
                        <td>
                          <div className="dois">
                            <span style={{ fontWeight: 500 }}>{h.dias}</span>
                            <span className="leve" style={{ fontSize: 13 }}>
                              {h.faixa}
                            </span>
                          </div>
                        </td>
                        <td className="nw">{t.perfis?.nome ?? 'Sem professor'}</td>
                        <td className="nw">
                          {t.salas ? (
                            <>
                              <span className="sala-dot sala-dot--tab" style={{ ['--cor' as string]: t.salas.cor }} />
                              {t.salas.nome}
                            </>
                          ) : (
                            'Sem sala'
                          )}
                        </td>
                        <td>
                          <div className="ocup">
                            <span>
                              {ocup} de {t.vagas_total} alunos
                            </span>
                            <div className="barra" aria-hidden="true">
                              <div style={{ width: `${v.pct}%`, background: v.cor }} />
                            </div>
                          </div>
                        </td>
                        <td>
                          <Selo tom={v.tom}>{v.texto}</Selo>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}
