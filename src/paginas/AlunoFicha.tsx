import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAviso } from '../componentes/Aviso';
import { Campo, Carregando, Erro, Selo } from '../componentes/pecas';
import { ativas, dataBr, iniciais, linkWhatsapp, resumoHorarios, textoIdade } from '../lib/formatar';
import { hojeIso } from '../lib/agenda';
import { executar, ler, supabase } from '../lib/supabase';
import type { Aluno, MatriculaComTurma, Responsavel } from '../lib/tipos';
import { useCarregar } from '../lib/useCarregar';

interface OpcaoTurma {
  id: string;
  nome: string;
  vagas_total: number;
  matriculas: { status: string }[];
}

interface Autorizacao {
  id: string;
  autorizado: boolean;
  assinado_por: string | null;
  observacao: string | null;
  registrado_em: string;
}

interface Dados {
  aluno: Aluno;
  autorizacoes: Autorizacao[];
  responsaveis: Responsavel[];
  matriculas: MatriculaComTurma[];
  turmas: OpcaoTurma[];
}

/** Data local (não UTC) de um carimbo de hora do banco. */
function diaLocal(t: string): string {
  const d = new Date(t);
  return dataBr(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
}

export default function AlunoFicha() {
  const { id } = useParams();
  const ir = useNavigate();
  const avisar = useAviso();
  const [escolhida, setEscolhida] = useState('');
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [assinadoPor, setAssinadoPor] = useState('');
  const [obsImagem, setObsImagem] = useState('');

  const { dados, erro, carregando, recarregar } = useCarregar<Dados>(async () => {
    const aluno = await ler<Aluno>(supabase.from('alunos').select('*').eq('id', id!).single() as never);
    const [autorizacoes, responsaveis, matriculas, turmas] = await Promise.all([
      ler<Autorizacao[]>(
        supabase
          .from('autorizacoes_imagem')
          .select('id, autorizado, assinado_por, observacao, registrado_em')
          .eq('aluno_id', id!)
          .order('registrado_em', { ascending: false })
          .limit(10) as never,
      ),
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
    return { aluno, autorizacoes, responsaveis, matriculas, turmas };
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

  const { aluno, autorizacoes, responsaveis, matriculas, turmas } = dados;
  const atual = autorizacoes[0] ?? null;
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
                                .update({ status: 'encerrada', data_fim: hojeIso() })
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
          <section className="card bloco" aria-labelledby="titulo-imagem">
            <h2 id="titulo-imagem">Uso de imagem</h2>
            <div className="imagem">
              <div>
                <b>{atual ? (atual.autorizado ? 'Autorizado' : 'Não autorizado') : 'Sem registro'}</b>
                <span>
                  {atual
                    ? `${atual.assinado_por ? `Assinado por ${atual.assinado_por}, ` : ''}registrado em ${diaLocal(atual.registrado_em)}`
                    : 'Ninguém registrou a autorização deste aluno ainda.'}
                </span>
              </div>
              <Selo tom={atual ? (atual.autorizado ? 'ok' : 'bad') : 'warn'}>
                {atual ? (atual.autorizado ? 'Pode publicar' : 'Não publicar') : 'Pendente'}
              </Selo>
            </div>
            {!atual?.autorizado ? (
              <div className="alerta alerta--bad">
                <span>
                  {atual
                    ? 'Não publicar fotos nem vídeos deste aluno no site, no Instagram ou em material do festival.'
                    : 'Sem autorização registrada, trate como não autorizado até a família assinar.'}
                </span>
              </div>
            ) : null}
            <Campo rotulo="Assinado por">
              <input
                list="lista-assinantes"
                value={assinadoPor}
                onChange={(e) => setAssinadoPor(e.target.value)}
                placeholder="Nome de quem assinou"
              />
            </Campo>
            <datalist id="lista-assinantes">
              {responsaveis.map((r) => (
                <option key={r.id} value={r.nome} />
              ))}
            </datalist>
            <Campo rotulo="Observação (opcional)">
              <input value={obsImagem} onChange={(e) => setObsImagem(e.target.value)} />
            </Campo>
            <div className="form__acoes">
              {[true, false].map((valor) => (
                <button
                  key={String(valor)}
                  type="button"
                  className={valor ? 'btn btn--verde' : 'btn btn--ghost'}
                  disabled={atual?.autorizado === valor && !assinadoPor.trim() && !obsImagem.trim()}
                  onClick={() =>
                    void agir(async () => {
                      await executar(
                        supabase.from('autorizacoes_imagem').insert({
                          aluno_id: aluno.id,
                          autorizado: valor,
                          assinado_por: assinadoPor.trim() || null,
                          observacao: obsImagem.trim() || null,
                        }),
                      );
                      setAssinadoPor('');
                      setObsImagem('');
                    }, valor ? 'Autorização registrada' : 'Recusa registrada')
                  }
                >
                  {valor ? 'Registrar autorização' : 'Registrar que não autoriza'}
                </button>
              ))}
            </div>
            {autorizacoes.length > 1 ? (
              <details>
                <summary>Histórico ({autorizacoes.length} registros)</summary>
                <div className="lista-p">
                  {autorizacoes.map((a) => (
                    <div key={a.id}>
                      <span>
                        {a.autorizado ? 'Autorizou' : 'Não autorizou'}
                        {a.assinado_por ? `, ${a.assinado_por}` : ''}
                        {a.observacao ? `. ${a.observacao}` : ''}
                      </span>
                      <span className="leve">{diaLocal(a.registrado_em)}</span>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
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
