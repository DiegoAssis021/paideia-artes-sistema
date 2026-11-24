import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Carregando, Erro, Selo, Stat, Topo, Vazio } from '../componentes/pecas';
import { semAcento, textoIdade } from '../lib/formatar';
import { ler, supabase } from '../lib/supabase';
import { useCarregar } from '../lib/useCarregar';

interface Linha {
  id: string;
  nome: string;
  nascimento: string | null;
  ativo: boolean;
  aluno_responsaveis: { ordem: number; responsaveis: { nome: string } | null }[];
  matriculas: { status: string; turmas: { nome: string } | null }[];
}

function nomesResp(a: Linha): string[] {
  return [...a.aluno_responsaveis]
    .sort((x, y) => x.ordem - y.ordem)
    .map((v) => v.responsaveis?.nome ?? '')
    .filter(Boolean);
}

export default function Alunos() {
  const ir = useNavigate();
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<'ativos' | 'inativos' | 'todos'>('ativos');

  const { dados, erro, carregando } = useCarregar(
    () =>
      ler<Linha[]>(
        supabase
          .from('alunos')
          .select('id, nome, nascimento, ativo, aluno_responsaveis(ordem, responsaveis(nome)), matriculas(status, turmas(nome))')
          .order('nome') as never,
      ),
    [],
  );

  const lista = useMemo(() => {
    const termo = semAcento(busca.trim());
    return (dados ?? []).filter(
      (a) =>
        (situacao === 'todos' || (situacao === 'ativos' ? a.ativo : !a.ativo)) &&
        (termo === '' || semAcento(a.nome).includes(termo) || nomesResp(a).some((n) => semAcento(n).includes(termo))),
    );
  }, [dados, busca, situacao]);

  const total = dados?.length ?? 0;
  const ativosN = (dados ?? []).filter((a) => a.ativo).length;
  const semTurma = (dados ?? []).filter((a) => a.ativo && !a.matriculas.some((m) => m.status === 'ativa')).length;

  return (
    <>
      <Topo
        titulo="Alunos"
        subtitulo="Fichas, responsáveis e matrículas"
        acoes={
          <button type="button" className="btn" onClick={() => ir('/alunos/novo')}>
            Novo aluno
          </button>
        }
      />
      {erro ? <Erro texto={erro} /> : null}
      {carregando ? <Carregando /> : null}
      {dados ? (
        <>
          <div className="stats">
            <Stat rotulo="Alunos cadastrados" valor={total} />
            <Stat rotulo="Alunos ativos" valor={ativosN} />
            <Stat rotulo="Ativos sem turma" valor={semTurma} tom={semTurma > 0 ? 'vermelho' : 'verde'} />
          </div>

          <section className="card filtros" aria-label="Filtros">
            <div className="filtros__linha">
              <div className="filtros__ctrl">
                <label>
                  Buscar
                  <input
                    className="busca"
                    type="search"
                    placeholder="Nome do aluno ou do responsável"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                </label>
                <label>
                  Situação
                  <select value={situacao} onChange={(e) => setSituacao(e.target.value as typeof situacao)}>
                    <option value="ativos">Ativos</option>
                    <option value="inativos">Inativos</option>
                    <option value="todos">Todos</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          <div className="card tabela">
            {lista.length === 0 ? (
              <Vazio texto={total === 0 ? 'Nenhum aluno cadastrado ainda.' : 'Nenhum aluno com esses filtros.'} />
            ) : (
              <table style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th scope="col">Aluno</th>
                    <th scope="col">Idade</th>
                    <th scope="col">Responsável</th>
                    <th scope="col">Turmas</th>
                    <th scope="col">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((a) => {
                    const turmas = a.matriculas.filter((m) => m.status === 'ativa').map((m) => m.turmas?.nome ?? '');
                    return (
                      <tr key={a.id}>
                        <td>
                          <Link className="link-turma" to={`/alunos/${a.id}`}>
                            {a.nome}
                          </Link>
                        </td>
                        <td className="nw">{textoIdade(a.nascimento)}</td>
                        <td>{nomesResp(a).join(', ') || <span className="leve">Sem responsável</span>}</td>
                        <td>{turmas.length ? turmas.join(', ') : <span className="leve">Sem turma</span>}</td>
                        <td>
                          <Selo tom={a.ativo ? 'ok' : 'nao'}>{a.ativo ? 'Ativo' : 'Inativo'}</Selo>
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
