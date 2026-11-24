import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAviso } from '../componentes/Aviso';
import { Campo, Carregando, Erro, Selo } from '../componentes/pecas';
import { ativas, dataBr, iniciais, linkWhatsapp, resumoHorarios, textoIdade } from '../lib/formatar';
import { executar, ler, supabase } from '../lib/supabase';
import type { Aluno, MatriculaComTurma, Responsavel } from '../lib/tipos';
import { useCarregar } from '../lib/useCarregar';

interface OpcaoTurma {
  id: string;
  nome: string;
  vagas_total: number;
  matriculas: { status: string }[];
}

interface Dados {
  aluno: Aluno;
  responsaveis: Responsavel[];
  matriculas: MatriculaComTurma[];
  turmas: OpcaoTurma[];
}

export default function AlunoFicha() {
  const { id } = useParams();
  const ir = useNavigate();
  const avisar = useAviso();
  const [escolhida, setEscolhida] = useState('');
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const { dados, erro, carregando, recarregar } = useCarregar<Dados>(async () => {
    const aluno = await ler<Aluno>(supabase.from('alunos').select('*').eq('id', id!).single() as never);
    const [responsaveis, matriculas, turmas] = await Promise.all([
      ler<{ ordem: number; responsaveis: Responsavel | null }[]>(
        supabase
          .from('aluno_responsaveis')
          .select('ordem, responsaveis(id, nome, parentesco, whatsapp, email)')
          .eq('aluno_id', id!)
          .order('ordem') as never,
      ).then((v) => v.map((x) => x.responsaveis).filter((r): r is Responsavel => r !== null)),
      ler<MatriculaComTurma[]>(
        supabase
          .from('matriculas')
          .select(
            'id, status, data_inicio, turma_id, turmas(nome, vagas_total, cursos(nome), salas(nome), perfis(nome), horarios(dia_semana, inicio, fim))',
          )
          .eq('aluno_id', id!)
          .eq('status', 'ativa') as never,
      ),
      ler<OpcaoTurma[]>(
        supabase.from('turmas').select('id, nome, vagas_total, matriculas(status)').eq('ativa', true).order('nome') as never,
      ),
    ]);
    return { aluno, responsaveis, matriculas, turmas };
  }, [id]);

  async function agir(fazer: () => Promise<void>, ok: string) {
    setErroAcao(null);
    try {
      await fazer();
      avisar(ok);
      recarregar();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : String(e));
    }
  }

  if (erro) return <Erro texto={erro} />;
  if (carregando && !dados) return <Carregando />;
  if (!dados) return null;

  const { aluno, responsaveis, matriculas, turmas } = dados;
  const jaTem = new Set(matriculas.map((m) => m.turma_id));
  const opcoes = turmas.filter((t) => !jaTem.has(t.id) && ativas(t.matriculas) < t.vagas_total);
  const wa = linkWhatsapp(responsaveis.find((r) => r.whatsapp)?.whatsapp ?? null);

  function campo(rotulo: string, valor: string | null | undefined) {
    return (
      <div>
        <small>{rotulo}</small>
        <span>{valor || 'Não informado'}</span>
      </div>
    );
  }

  return (
    <>
      <button type="button" className="voltar" onClick={() => ir('/alunos')}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Voltar para alunos
      </button>

      <div className="ficha-topo">
        <div className="ficha-id">
          <div className="avatar-g" aria-hidden="true">
            {iniciais(aluno.nome)}
          </div>
          <div>
            <h1>{aluno.nome}</h1>
            <div className="tags">
              <Selo tom={aluno.ativo ? 'ok' : 'nao'}>{aluno.ativo ? 'Ativo' : 'Inativo'}</Selo>
              <span className="tag">{textoIdade(aluno.nascimento)}</span>
              <span className="tag">Aluno desde {dataBr(aluno.aluno_desde)}</span>
            </div>
          </div>
        </div>
        <div className="topo__acoes">
          {wa ? (
            <a className="btn btn--ghost" href={wa} target="_blank" rel="noopener noreferrer">
              Mensagem ao responsável
            </a>
          ) : null}
          <Link className="btn btn--ghost" to={`/alunos/${aluno.id}/editar`}>
            Editar ficha
          </Link>
        </div>
      </div>

      {erroAcao ? <Erro texto={erroAcao} /> : null}

      <div className="ficha-grade">
        <div className="col" style={{ gap: 18 }}>
          <section className="card bloco">
            <h2>Turmas</h2>
            {matriculas.length === 0 ? <p className="leve">Este aluno não está matriculado em nenhuma turma.</p> : null}
            {matriculas.map((m) => {
              const t = m.turmas;
              const h = resumoHorarios(t?.horarios ?? []);
              return (
                <div className="turma-item" key={m.id}>
                  <div>
                    <Link className="link-turma" to={`/turmas/${m.turma_id}`}>
                      {t?.nome}
                    </Link>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ height: 36, fontSize: 13 }}
                      onClick={() => {
                        if (!window.confirm(`Encerrar a matrícula em ${t?.nome}?`)) return;
                        void agir(
                          () =>
                            executar(
                              supabase
                                .from('matriculas')
                                .update({ status: 'encerrada', data_fim: new Date().toISOString().slice(0, 10) })
                                .eq('id', m.id),
                            ),
                          'Matrícula encerrada',
                        );
                      }}
                    >
                      Encerrar
                    </button>
                  </div>
                  <span>
                    {h.dias}
                    {h.faixa ? `, ${h.faixa}` : ''}
                    {t?.salas ? `, ${t.salas.nome}` : ''}
                    {t?.perfis ? `, com ${t.perfis.nome}` : ''}
                  </span>
                  <span>Desde {dataBr(m.data_inicio)}</span>
                </div>
              );
            })}
            <div className="linha-acao">
              <Campo rotulo="Matricular em outra turma">
                <select value={escolhida} onChange={(e) => setEscolhida(e.target.value)}>
                  <option value="">{opcoes.length ? 'Escolha uma turma' : 'Nenhuma turma com vaga'}</option>
                  {opcoes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome} ({t.vagas_total - ativas(t.matriculas)} vagas)
                    </option>
                  ))}
                </select>
              </Campo>
              <button
                type="button"
                className="btn"
                disabled={!escolhida}
                onClick={() =>
                  void agir(async () => {
                    await executar(supabase.from('matriculas').insert({ aluno_id: aluno.id, turma_id: escolhida }));
                    setEscolhida('');
                  }, 'Aluno matriculado')
                }
              >
                Matricular
              </button>
            </div>
          </section>
        </div>

        <div className="col" style={{ gap: 18 }}>
          <section className="card bloco">
            <h2>{responsaveis.length > 1 ? 'Responsáveis' : 'Responsável'}</h2>
            {responsaveis.length > 0 ? (
              <>
                {responsaveis.map((r, i) => (
                  <div className="campos" key={r.id} style={i > 0 ? { marginTop: 16 } : undefined}>
                    {campo(i === 0 ? 'Nome (principal)' : 'Nome', r.nome)}
                    {campo('Parentesco', r.parentesco)}
                    {campo('WhatsApp', r.whatsapp)}
                    {campo('E-mail', r.email)}
                  </div>
                ))}
                <div className="campos" style={{ marginTop: 16 }}>
                  {campo('Contato de emergência', aluno.contato_emergencia_nome)}
                  {campo('Telefone de emergência', aluno.contato_emergencia_telefone)}
                </div>
              </>
            ) : (
              <p className="leve">Sem responsável cadastrado. Use Editar ficha para incluir.</p>
            )}
          </section>
          <section className="card bloco">
            <h2>Observações da secretaria</h2>
            <p style={{ fontSize: 15, lineHeight: 1.6 }}>{aluno.observacoes || 'Nenhuma observação.'}</p>
          </section>
        </div>
      </div>
    </>
  );
}
