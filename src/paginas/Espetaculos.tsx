import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useAviso } from '../componentes/Aviso';
import { Icone } from '../componentes/Icone';
import { Carregando, Erro, Selo, Stat, Topo, Vazio } from '../componentes/pecas';
import { dataLonga, hojeIso } from '../lib/agenda';
import { hora } from '../lib/formatar';
import { executar, ler, supabase } from '../lib/supabase';
import { useCarregar } from '../lib/useCarregar';

export const ROTULO_STATUS: Record<string, { tom: 'ok' | 'warn' | 'bad' | 'neutro'; texto: string }> = {
  planejamento: { tom: 'neutro', texto: 'Em planejamento' },
  confirmado: { tom: 'warn', texto: 'Em preparação' },
  realizado: { tom: 'ok', texto: 'Realizado' },
  cancelado: { tom: 'bad', texto: 'Cancelado' },
};

const TROCA = 2; // minutos de troca de palco entre números
const INTERVALO = 15;

interface Espetaculo {
  id: string;
  nome: string;
  data: string | null;
  hora_inicio: string | null;
  local: string | null;
  status: string;
  exposicao: string | null;
}

interface Numero {
  id: string;
  turma_id: string | null;
  titulo: string;
  ordem: number;
  duracao_min: number | null;
  figurino_ok: boolean;
  som_ok: boolean;
  turmas: { nome: string; perfis: { nome: string } | null } | null;
}

interface Ensaio {
  id: string;
  titulo: string;
  data: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  local: string | null;
  observacao: string | null;
}

interface TurmaSimples {
  id: string;
  nome: string;
  perfis: { nome: string } | null;
}

interface Dados {
  lista: Pick<Espetaculo, 'id' | 'nome' | 'data'>[];
  esp: Espetaculo | null;
  numeros: Numero[];
  ensaios: Ensaio[];
  turmas: TurmaSimples[];
  alunosPorTurma: Map<string, number>;
  semImagem: { aluno: string; turma: string }[] | null; // só a equipe vê
}

const textoAlunos = (n: number) => `${n} ${n === 1 ? 'aluno' : 'alunos'}`;
const relogio = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
const duracaoTexto = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m} min` : `${h}h${m ? String(m).padStart(2, '0') : ''}`;
};
const minutosDe = (h: string | null) => (h ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5)) : 18 * 60);

function quandoEnsaio(e: Ensaio): string {
  const partes: string[] = [];
  if (e.data) partes.push(dataLonga(e.data));
  if (e.hora_inicio) partes.push(`${hora(e.hora_inicio)}${e.hora_fim ? ` às ${hora(e.hora_fim)}` : ''}`);
  if (e.local) partes.push(`no ${e.local}`);
  if (e.observacao) partes.push(e.observacao);
  return partes.join(', ') || 'Sem data definida';
}

export default function Espetaculos() {
  const { id } = useParams();
  const { eEquipe } = useAuth();
  const ir = useNavigate();
  const avisar = useAviso();
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [duracao, setDuracao] = useState('');

  const { dados, erro, carregando, recarregar } = useCarregar<Dados>(async () => {
    const lista = await ler<Dados['lista']>(
      supabase.from('espetaculos').select('id, nome, data').order('data', { ascending: true, nullsFirst: false }) as never,
    );
    const hoje = hojeIso();
    const padrao = lista.find((e) => (e.data ?? '') >= hoje) ?? lista[lista.length - 1];
    const alvo = id ?? padrao?.id;
    if (!alvo) {
      return { lista, esp: null, numeros: [], ensaios: [], turmas: [], alunosPorTurma: new Map(), semImagem: null };
    }
    const [esp, numeros, ensaios, turmas] = await Promise.all([
      ler<Espetaculo>(
        supabase.from('espetaculos').select('id, nome, data, hora_inicio, local, status, exposicao').eq('id', alvo).single() as never,
      ),
      ler<Numero[]>(
        supabase
          .from('numeros_espetaculo')
          .select('id, turma_id, titulo, ordem, duracao_min, figurino_ok, som_ok, turmas(nome, perfis(nome))')
          .eq('espetaculo_id', alvo)
          .order('ordem') as never,
      ),
      ler<Ensaio[]>(
        supabase
          .from('ensaios')
          .select('id, titulo, data, hora_inicio, hora_fim, local, observacao')
          .eq('espetaculo_id', alvo)
          .order('data', { ascending: true, nullsFirst: true }) as never,
      ),
      ler<TurmaSimples[]>(supabase.from('turmas').select('id, nome, perfis(nome)').eq('ativa', true).order('nome') as never),
    ]);

    const alunosPorTurma = new Map<string, number>();
    let semImagem: Dados['semImagem'] = null;
    if (eEquipe) {
      const ids = numeros.map((n) => n.turma_id).filter((x): x is string => !!x);
      const [ms, auts] = await Promise.all([
        ler<{ turma_id: string; aluno_id: string; alunos: { nome: string } }[]>(
          supabase.from('matriculas').select('turma_id, aluno_id, alunos(nome)').eq('status', 'ativa') as never,
        ),
        ler<{ aluno_id: string; autorizado: boolean; registrado_em: string }[]>(
          supabase.from('autorizacoes_imagem').select('aluno_id, autorizado, registrado_em') as never,
        ),
      ]);
      for (const m of ms) alunosPorTurma.set(m.turma_id, (alunosPorTurma.get(m.turma_id) ?? 0) + 1);
      const ultima = new Map<string, { autorizado: boolean; em: string }>();
      for (const a of auts) {
        const atual = ultima.get(a.aluno_id);
        if (!atual || a.registrado_em > atual.em) ultima.set(a.aluno_id, { autorizado: a.autorizado, em: a.registrado_em });
      }
      const nomeTurma = new Map(turmas.map((t) => [t.id, t.nome]));
      const vistos = new Set<string>();
      semImagem = [];
      for (const m of ms) {
        if (!ids.includes(m.turma_id) || vistos.has(m.aluno_id)) continue;
        vistos.add(m.aluno_id);
        if (ultima.get(m.aluno_id)?.autorizado !== true) {
          semImagem.push({ aluno: m.alunos.nome, turma: nomeTurma.get(m.turma_id) ?? '' });
        }
      }
    }
    return { lista, esp, numeros, ensaios, turmas, alunosPorTurma, semImagem };
  }, [id, eEquipe]);

  async function agir(fazer: () => Promise<void>, aviso?: string) {
    setErroAcao(null);
    try {
      await fazer();
      if (aviso) avisar(aviso);
      recarregar();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : String(e));
    }
  }

  if (erro) return <Erro texto={erro} />;
  if (carregando && !dados) return <Carregando />;
  if (!dados) return null;

  const { lista, esp, numeros, ensaios, turmas, alunosPorTurma, semImagem } = dados;
  const novo = (
    <Link className="btn" to="/espetaculos/novo">
      Novo espetáculo
    </Link>
  );

  if (!esp) {
    return (
      <>
        <Topo titulo="Espetáculos" acoes={eEquipe ? novo : undefined} />
        <div className="card">
          <Vazio texto="Nenhum espetáculo cadastrado ainda." />
        </div>
      </>
    );
  }

  // horários: cada número começa depois do anterior, com troca de palco e um intervalo no meio
  const t0 = minutosDe(esp.hora_inicio);
  const meio = numeros.length >= 6 ? Math.ceil(numeros.length / 2) : -1;
  let cur = t0;
  const linhas = numeros.map((n, i) => {
    const inicio = cur;
    cur += n.duracao_min ?? 5;
    if (i < numeros.length - 1) cur += TROCA;
    let intervaloAs: number | null = null;
    if (i === meio - 1 && i < numeros.length - 1) {
      intervaloAs = cur;
      cur += INTERVALO;
    }
    return { n, i, inicio, intervaloAs };
  });
  const duracaoTotal = cur - t0;

  const turmasNoPalco = new Set(numeros.map((n) => n.turma_id).filter((x): x is string => !!x));
  const fora = turmas.filter((t) => !turmasNoPalco.has(t.id));
  const alunosTotal = [...turmasNoPalco].reduce((s, t) => s + (alunosPorTurma.get(t) ?? 0), 0);
  const figP = numeros.filter((n) => !n.figurino_ok).length;
  const somP = numeros.filter((n) => !n.som_ok).length;
  const nImg = semImagem?.length ?? 0;
  const pendTotal = figP + somP + nImg;
  const st = ROTULO_STATUS[esp.status] ?? ROTULO_STATUS.planejamento;
  const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios.replace('{n}', String(n)));

  const porTurma = new Map<string, number>();
  for (const a of semImagem ?? []) porTurma.set(a.turma, (porTurma.get(a.turma) ?? 0) + 1);
  const textoImagem = [...porTurma].map(([t, q]) => `${t} (${q})`).join(', ');

  function alternar(n: Numero, campo: 'figurino_ok' | 'som_ok') {
    void agir(() => executar(supabase.from('numeros_espetaculo').update({ [campo]: !n[campo] }).eq('id', n.id)));
  }

  function mover(i: number, delta: -1 | 1) {
    const a = numeros[i];
    const b = numeros[i + delta];
    if (!a || !b) return;
    void agir(async () => {
      // regrava a posição de todos, para não depender de números repetidos ou saltos
      const nova = numeros.map((n) => n.id);
      [nova[i], nova[i + delta]] = [nova[i + delta], nova[i]];
      await Promise.all(
        nova.map((nid, pos) =>
          executar(supabase.from('numeros_espetaculo').update({ ordem: pos }).eq('id', nid)),
        ),
      );
    });
  }

  function tirar(n: Numero) {
    if (!window.confirm(`Tirar "${n.titulo}" do espetáculo?`)) return;
    void agir(() => executar(supabase.from('numeros_espetaculo').delete().eq('id', n.id)), 'Número retirado');
  }

  function incluir(t: TurmaSimples) {
    void agir(
      () =>
        executar(
          supabase.from('numeros_espetaculo').insert({
            espetaculo_id: esp!.id,
            turma_id: t.id,
            titulo: t.nome,
            ordem: numeros.length,
            duracao_min: 5,
          }),
        ),
      `${t.nome} incluída`,
    );
  }

  function abrirEdicao(n: Numero) {
    setEditando(n.id);
    setTitulo(n.titulo);
    setDuracao(String(n.duracao_min ?? ''));
  }

  function salvarEdicao(n: Numero) {
    const d = duracao.trim() === '' ? null : Number(duracao);
    if (!titulo.trim() || (d !== null && (!Number.isInteger(d) || d <= 0))) {
      setErroAcao('Informe o título e uma duração em minutos (número inteiro maior que zero).');
      return;
    }
    void agir(async () => {
      await executar(supabase.from('numeros_espetaculo').update({ titulo: titulo.trim(), duracao_min: d }).eq('id', n.id));
      setEditando(null);
    }, 'Número atualizado');
  }

  return (
    <>
      <Topo titulo="Espetáculos" acoes={eEquipe ? novo : undefined} />

      {lista.length > 1 ? (
        <div className="chips" role="group" aria-label="Escolher espetáculo">
          {lista.map((e) => (
            <button key={e.id} type="button" className="chip" aria-pressed={e.id === esp.id} onClick={() => ir(`/espetaculos/${e.id}`)}>
              {e.nome}
            </button>
          ))}
        </div>
      ) : null}

      <section className="card evento">
        <div>
          <h2>{esp.nome}</h2>
          <p>
            {esp.data ? dataLonga(esp.data) : 'Data a definir'}
            {esp.hora_inicio ? `, às ${hora(esp.hora_inicio)}` : ''}
            {esp.local ? `, no ${esp.local}` : ''}
          </p>
        </div>
        <div className="topo__acoes">
          <Selo tom={st.tom}>{st.texto}</Selo>
          {eEquipe ? (
            <Link className="btn btn--ghost" to={`/espetaculos/${esp.id}/editar`}>
              Editar
            </Link>
          ) : null}
        </div>
      </section>

      <div className="stats">
        <Stat rotulo="Turmas participantes" valor={`${turmasNoPalco.size} de ${turmas.length}`} />
        {eEquipe ? <Stat rotulo="Alunos envolvidos" valor={alunosTotal} /> : null}
        <Stat
          rotulo="Duração estimada"
          valor={numeros.length ? duracaoTexto(duracaoTotal) : '0h'}
          nota={numeros.length ? `Das ${relogio(t0)} às ${relogio(t0 + duracaoTotal)}, com trocas de palco` : 'Sem números ainda'}
        />
        <Stat
          rotulo="Pendências"
          valor={pendTotal}
          tom={pendTotal ? 'vermelho' : 'verde'}
          nota={eEquipe ? 'Figurino, som e imagem' : 'Figurino e som'}
        />
      </div>

      {erroAcao ? <Erro texto={erroAcao} /> : null}

      <div className="turma-grade">
        <section className="card principal" style={{ paddingTop: 18 }}>
          <div className="bloco__topo" style={{ padding: '0 20px 6px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Ordem das apresentações</h2>
            {eEquipe ? <span className="leve" style={{ fontSize: 13.5 }}>Use as setas para mudar a ordem</span> : null}
          </div>
          {esp.exposicao ? (
            <div className="alerta alerta--info" style={{ margin: '0 20px 16px' }}>
              <Icone nome="palco" tamanho={18} />
              <span>
                <b>{esp.exposicao}</b>
              </span>
            </div>
          ) : null}
          <div className="numeros">
            {numeros.length === 0 ? (
              <Vazio texto={eEquipe ? 'Nenhum número ainda. Inclua as turmas pela lista ao lado.' : 'Nenhum número ainda.'} />
            ) : (
              linhas.map(({ n, i, inicio, intervaloAs }) => (
                <div key={n.id}>
                  <div className="numero">
                    <span className="numero__ord">{i + 1}</span>
                    <span className="numero__hora">{relogio(inicio)}</span>
                    <div className="numero__info">
                      {editando === n.id ? (
                        <div className="linha-acao">
                          <input
                            className="busca"
                            style={{ minWidth: 180 }}
                            aria-label="Título do número"
                            value={titulo}
                            onChange={(e) => setTitulo(e.target.value)}
                          />
                          <input
                            className="busca"
                            style={{ minWidth: 0, width: 90 }}
                            inputMode="numeric"
                            aria-label="Duração em minutos"
                            placeholder="min"
                            value={duracao}
                            onChange={(e) => setDuracao(e.target.value)}
                          />
                          <button type="button" className="btn" style={{ height: 40 }} onClick={() => salvarEdicao(n)}>
                            Salvar
                          </button>
                          <button type="button" className="btn btn--ghost" style={{ height: 40 }} onClick={() => setEditando(null)}>
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <>
                          <b>{n.titulo}</b>
                          <span>
                            {[
                              n.turmas?.nome,
                              n.turmas?.perfis ? `com ${n.turmas.perfis.nome}` : null,
                              n.turma_id && eEquipe ? textoAlunos(alunosPorTurma.get(n.turma_id) ?? 0) : null,
                              n.duracao_min ? `${n.duracao_min} min` : null,
                            ]
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="numero__chk">
                      <button type="button" className="pend" aria-pressed={n.figurino_ok} disabled={!eEquipe} onClick={() => alternar(n, 'figurino_ok')}>
                        {n.figurino_ok ? 'Figurino pronto' : 'Figurino pendente'}
                      </button>
                      <button type="button" className="pend" aria-pressed={n.som_ok} disabled={!eEquipe} onClick={() => alternar(n, 'som_ok')}>
                        {n.som_ok ? 'Som pronto' : 'Som pendente'}
                      </button>
                    </div>
                    {eEquipe ? (
                      <div className="numero__mover">
                        <button type="button" className="mini" aria-label={`Subir ${n.titulo}`} disabled={i === 0} onClick={() => mover(i, -1)}>
                          <Icone nome="sobe" tamanho={16} />
                        </button>
                        <button type="button" className="mini" aria-label={`Descer ${n.titulo}`} disabled={i === numeros.length - 1} onClick={() => mover(i, 1)}>
                          <Icone nome="desce" tamanho={16} />
                        </button>
                        <button type="button" className="btn--link" onClick={() => abrirEdicao(n)}>
                          Editar
                        </button>
                        <button type="button" className="mini" aria-label={`Tirar ${n.titulo} do espetáculo`} onClick={() => tirar(n)}>
                          <Icone nome="x" tamanho={15} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {intervaloAs !== null ? (
                    <div className="intervalo">
                      <Icone nome="relogio" tamanho={16} />
                      Intervalo de {INTERVALO} minutos, às {relogio(intervaloAs)}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>

        <div className="lateral">
          <section className="card bloco">
            <h2>Pendências</h2>
            <div>
              <div className="pendencia">
                <b>Figurino</b>
                <span>{figP ? plural(figP, '1 número pendente', '{n} números pendentes') : 'Tudo pronto'}</span>
              </div>
              <div className="pendencia">
                <b>Som e trilha</b>
                <span>{somP ? plural(somP, '1 número pendente', '{n} números pendentes') : 'Tudo pronto'}</span>
              </div>
              {semImagem ? (
                <div className="pendencia">
                  <b>Autorização de imagem</b>
                  <span>
                    {nImg
                      ? `${plural(nImg, '1 aluno sem autorização registrada', '{n} alunos sem autorização registrada')}, em ${textoImagem}. Combinar com quem for fotografar e filmar.`
                      : 'Todos os alunos autorizados'}
                  </span>
                </div>
              ) : null}
            </div>
          </section>

          <section className="card bloco">
            <h2>Ensaios</h2>
            <div>
              {ensaios.length === 0 ? (
                <p className="leve" style={{ fontSize: 14 }}>Nenhum ensaio marcado.</p>
              ) : (
                ensaios.map((e) => (
                  <div className="pendencia" key={e.id}>
                    <b>{e.titulo}</b>
                    <span>{quandoEnsaio(e)}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          {eEquipe ? (
            <section className="card bloco">
              <div className="bloco__topo">
                <h2>Turmas fora do espetáculo</h2>
                <span className="leve" style={{ fontSize: 13.5 }}>{fora.length}</span>
              </div>
              <div>
                {fora.length === 0 ? (
                  <p className="leve" style={{ fontSize: 14 }}>Todas as turmas estão no espetáculo.</p>
                ) : (
                  fora.map((t) => (
                    <div className="fora" key={t.id}>
                      <div>
                        <b>{t.nome}</b>
                        <span>
                          {textoAlunos(alunosPorTurma.get(t.id) ?? 0)}{t.perfis ? `, com ${t.perfis.nome}` : ''}
                        </span>
                      </div>
                      <button type="button" className="btn--link" onClick={() => incluir(t)}>
                        Incluir
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
