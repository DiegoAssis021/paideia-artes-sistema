import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useAviso } from '../componentes/Aviso';
import { Campo, Carregando, Erro, Selo, Stat, Topo, Vazio } from '../componentes/pecas';
import { faixaIdade, resumoHorarios, situacaoVagas, textoIdade } from '../lib/formatar';
import { diaSemanaIso, hojeIso } from '../lib/agenda';
import { executar, ler, supabase } from '../lib/supabase';
import type { Horario } from '../lib/tipos';
import { useCarregar } from '../lib/useCarregar';

interface TurmaInfo {
  id: string;
  nome: string;
  idade_min: number | null;
  idade_max: number | null;
  vagas_total: number;
  publicada_no_site: boolean;
  cursos: { nome: string } | null;
  salas: { nome: string; cor: string } | null;
  perfis: { nome: string } | null;
  horarios: Horario[];
}

interface LinhaAluno {
  matriculaId: string | null;
  alunoId: string;
  nome: string;
  nascimento: string | null;
  contato: string | null;
  telefone: string | null;
}

interface Dados {
  turma: TurmaInfo;
  alunos: LinhaAluno[];
  candidatos: { id: string; nome: string }[];
}

export default function TurmaDetalhe() {
  const { id } = useParams();
  const { eEquipe } = useAuth();
  const ir = useNavigate();
  const avisar = useAviso();
  const [escolhido, setEscolhido] = useState('');
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const { dados, erro, carregando, recarregar } = useCarregar<Dados>(async () => {
    const turma = await ler<TurmaInfo>(
      supabase
        .from('turmas')
        .select(
          'id, nome, idade_min, idade_max, vagas_total, publicada_no_site, cursos(nome), salas(nome, cor), perfis(nome), horarios(dia_semana, inicio, fim)',
        )
        .eq('id', id!)
        .single() as never,
    );

    let alunos: LinhaAluno[];
    let candidatos: Dados['candidatos'] = [];
    if (eEquipe) {
      const ms = await ler<
        {
          id: string;
          alunos: {
            id: string;
            nome: string;
            nascimento: string | null;
            contato_emergencia_nome: string | null;
            contato_emergencia_telefone: string | null;
          };
        }[]
      >(
        supabase
          .from('matriculas')
          .select('id, alunos(id, nome, nascimento, contato_emergencia_nome, contato_emergencia_telefone)')
          .eq('turma_id', id!)
          .eq('status', 'ativa') as never,
      );
      alunos = ms.map((m) => ({
        matriculaId: m.id,
        alunoId: m.alunos.id,
        nome: m.alunos.nome,
        nascimento: m.alunos.nascimento,
        contato: m.alunos.contato_emergencia_nome,
        telefone: m.alunos.contato_emergencia_telefone,
      }));
      const todos = await ler<{ id: string; nome: string }[]>(
        supabase.from('alunos').select('id, nome').eq('ativo', true).order('nome') as never,
      );
      const jaTem = new Set(alunos.map((a) => a.alunoId));
      candidatos = todos.filter((a) => !jaTem.has(a.id));
    } else {
      // professor: só nome, idade e contato de emergência, pela view restrita
      const vs = await ler<
        {
          aluno_id: string;
          nome: string;
          nascimento: string | null;
          contato_emergencia_nome: string | null;
          contato_emergencia_telefone: string | null;
        }[]
      >(supabase.from('vw_alunos_do_professor').select('*').eq('turma_id', id!) as never);
      alunos = vs.map((v) => ({
        matriculaId: null,
        alunoId: v.aluno_id,
        nome: v.nome,
        nascimento: v.nascimento,
        contato: v.contato_emergencia_nome,
        telefone: v.contato_emergencia_telefone,
      }));
    }
    alunos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return { turma, alunos, candidatos };
  }, [id, eEquipe]);

  async function matricular() {
    if (!escolhido) return;
    setErroAcao(null);
    setOcupado(true);
    try {
      await executar(supabase.from('matriculas').insert({ aluno_id: escolhido, turma_id: id }));
      setEscolhido('');
      avisar('Aluno matriculado');
      recarregar();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : String(e));
    }
    setOcupado(false);
  }

  async function encerrar(matriculaId: string, nome: string) {
    if (!window.confirm(`Encerrar a matrícula de ${nome} nesta turma?`)) return;
    setErroAcao(null);
    try {
      await executar(
        supabase
          .from('matriculas')
          .update({ status: 'encerrada', data_fim: hojeIso() })
          .eq('id', matriculaId),
      );
      avisar('Matrícula encerrada');
      recarregar();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : String(e));
    }
  }

  if (erro) return <Erro texto={erro} />;
  if (carregando && !dados) return <Carregando />;
  if (!dados) return null;

  const { turma, alunos, candidatos } = dados;
  const v = situacaoVagas(turma.vagas_total, alunos.length);
  const h = resumoHorarios(turma.horarios);
  const hoje = hojeIso();
  const temAulaHoje = turma.horarios.some((x) => x.dia_semana === diaSemanaIso(hoje));

  return (
    <>
      <button type="button" className="voltar" onClick={() => ir('/turmas')}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Voltar para turmas
      </button>
      <Topo
        titulo={turma.nome}
        subtitulo={`${turma.cursos?.nome ?? ''} · ${faixaIdade(turma.idade_min, turma.idade_max)} · ${h.dias}${h.faixa ? `, ${h.faixa}` : ''}`}
        acoes={
          <>
            {temAulaHoje ? (
              <Link className="btn btn--verde" to={`/chamada/${turma.id}/${hoje}`}>
                Fazer a chamada de hoje
              </Link>
            ) : null}
            {eEquipe ? (
              <Link className="btn btn--ghost" to={`/turmas/${turma.id}/editar`}>
                Editar turma
              </Link>
            ) : null}
          </>
        }
      />

      <div className="stats">
        <Stat rotulo="Ocupação" valor={`${alunos.length} de ${turma.vagas_total}`} nota={<Selo tom={v.tom}>{v.texto}</Selo>} />
        <Stat rotulo="Professor" valor={<span style={{ fontSize: 22 }}>{turma.perfis?.nome ?? 'Sem professor'}</span>} />
        <Stat
          rotulo="Sala"
          valor={<span style={{ fontSize: 22 }}>{turma.salas?.nome ?? 'Sem sala'}</span>}
          nota={turma.publicada_no_site ? 'Vagas publicadas no site' : 'Não publicada no site'}
        />
      </div>

      {eEquipe ? (
        <section className="card bloco" aria-label="Matricular aluno">
          <h2>Matricular aluno nesta turma</h2>
          {v.livres === 0 ? (
            <p className="leve">A turma está lotada. Encerre uma matrícula ou aumente as vagas em Editar turma.</p>
          ) : (
            <div className="linha-acao">
              <Campo rotulo="Aluno">
                <select value={escolhido} onChange={(e) => setEscolhido(e.target.value)}>
                  <option value="">Escolha um aluno</option>
                  {candidatos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <button type="button" className="btn" disabled={!escolhido || ocupado} onClick={() => void matricular()}>
                Matricular
              </button>
              <Link className="btn btn--ghost" to="/alunos/novo">
                Cadastrar novo aluno
              </Link>
            </div>
          )}
          {erroAcao ? <Erro texto={erroAcao} /> : null}
        </section>
      ) : null}

      <div className="card tabela">
        {alunos.length === 0 ? (
          <Vazio texto="Nenhum aluno matriculado nesta turma ainda." />
        ) : (
          <table style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th scope="col">Aluno</th>
                <th scope="col">Idade</th>
                <th scope="col">Contato de emergência</th>
                {eEquipe ? <th scope="col">Ação</th> : null}
              </tr>
            </thead>
            <tbody>
              {alunos.map((a) => (
                <tr key={a.alunoId}>
                  <td>
                    {eEquipe ? (
                      <Link className="link-turma" to={`/alunos/${a.alunoId}`}>
                        {a.nome}
                      </Link>
                    ) : (
                      <span className="forte">{a.nome}</span>
                    )}
                  </td>
                  <td className="nw">{textoIdade(a.nascimento)}</td>
                  <td>
                    <div className="dois">
                      <span>{a.contato ?? 'Não informado'}</span>
                      <span className="leve" style={{ fontSize: 13 }}>
                        {a.telefone ?? ''}
                      </span>
                    </div>
                  </td>
                  {eEquipe ? (
                    <td>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ height: 40, fontSize: 13.5 }}
                        onClick={() => void encerrar(a.matriculaId!, a.nome)}
                      >
                        Encerrar matrícula
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
