import { useMemo, useState } from 'react';
import { useAviso } from '../componentes/Aviso';
import { Campo, Carregando, Erro, Selo, Stat, Topo, Vazio } from '../componentes/pecas';
import { Icone } from '../componentes/Icone';
import { deIso, hojeIso, primeiroNome, somarDias } from '../lib/agenda';
import { dataBr, linkWhatsapp, semAcento } from '../lib/formatar';
import { executar, ler, supabase } from '../lib/supabase';
import { useCarregar } from '../lib/useCarregar';

const PRAZO_DIAS = 15;

interface Livro {
  id: string;
  titulo: string;
  autor: string | null;
  tipo: 'livro' | 'quadrinho';
}

interface Responsavel {
  nome: string;
  whatsapp: string | null;
}

interface Emprestimo {
  id: string;
  livro_id: string;
  aluno_id: string;
  emprestado_em: string;
  devolver_ate: string;
  devolvido_em: string | null;
  alunos: { nome: string; aluno_responsaveis?: { ordem: number; responsaveis: Responsavel | null }[] } | null;
}

interface Dados {
  livros: Livro[];
  abertos: Emprestimo[];
  recentes: Emprestimo[];
  alunos: { id: string; nome: string }[];
}

type Tom = 'ok' | 'warn' | 'bad' | 'neutro';

interface Situacao {
  tipo: 'atrasado' | 'emprestado';
  tom: Tom;
  texto: string;
  dias: number;
  atencao: boolean;
}

function diasEntre(de: string, ate: string): number {
  return Math.round((deIso(ate).getTime() - deIso(de).getTime()) / 86_400_000);
}

function situacao(e: Emprestimo, hoje: string): Situacao {
  const d = diasEntre(hoje, e.devolver_ate);
  if (d < 0) return { tipo: 'atrasado', tom: 'bad', texto: `Atrasado há ${-d} ${d === -1 ? 'dia' : 'dias'}`, dias: d, atencao: true };
  if (d === 0) return { tipo: 'emprestado', tom: 'warn', texto: 'Vence hoje', dias: d, atencao: true };
  if (d === 1) return { tipo: 'emprestado', tom: 'warn', texto: 'Vence amanhã', dias: d, atencao: true };
  if (d === 2) return { tipo: 'emprestado', tom: 'warn', texto: 'Vence em 2 dias', dias: d, atencao: true };
  return { tipo: 'emprestado', tom: 'neutro', texto: `Faltam ${d} dias`, dias: d, atencao: false };
}

function responsavelDe(e: Emprestimo): Responsavel | null {
  const lista = [...(e.alunos?.aluno_responsaveis ?? [])].sort((a, b) => a.ordem - b.ordem);
  const todos = lista.map((x) => x.responsaveis).filter((r): r is Responsavel => r !== null);
  return todos.find((r) => r.whatsapp) ?? todos[0] ?? null;
}

/** Texto do lembrete. A secretaria revisa antes de enviar. */
function textoLembrete(e: Emprestimo, livro: Livro, s: Situacao): string {
  const resp = responsavelDe(e);
  const aluno = primeiroNome(e.alunos?.nome);
  const quem = resp ? primeiroNome(resp.nome) : aluno;
  const sujeito = resp ? aluno : 'você';
  const abre = `Oi, ${quem}! Aqui é da secretaria do Paideia Artes.\n\n`;
  if (s.tipo === 'atrasado') {
    return `${abre}O livro “${livro.titulo}” que ${sujeito} pegou emprestado na biblioteca da escola deveria ter voltado no dia ${dataBr(e.devolver_ate)}. Dá para devolver na próxima aula? O prazo de empréstimo é de ${PRAZO_DIAS} dias.\n\nObrigada!`;
  }
  return `${abre}Passando para lembrar que o livro “${livro.titulo}” que ${sujeito} pegou emprestado na biblioteca da escola deve voltar até o dia ${dataBr(e.devolver_ate)} (${s.texto.toLowerCase()}). O prazo de empréstimo é de ${PRAZO_DIAS} dias.\n\nObrigada!`;
}

export default function Biblioteca() {
  const avisar = useAviso();
  const hoje = hojeIso();
  const [tipo, setTipo] = useState<'todos' | 'quadrinho' | 'livro'>('todos');
  const [sit, setSit] = useState<'todas' | 'disp' | 'emp' | 'atr'>('todas');
  const [busca, setBusca] = useState('');
  const [emprestando, setEmprestando] = useState(false);
  const [cadastrando, setCadastrando] = useState(false);
  const [lembrete, setLembrete] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const [livroEscolhido, setLivroEscolhido] = useState('');
  const [nomeAluno, setNomeAluno] = useState('');
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novoAutor, setNovoAutor] = useState('');
  const [novoTipo, setNovoTipo] = useState<'livro' | 'quadrinho'>('quadrinho');

  const { dados, erro, carregando, recarregar } = useCarregar<Dados>(async () => {
    const [livros, abertos, recentes, alunos] = await Promise.all([
      ler<Livro[]>(supabase.from('livros').select('id, titulo, autor, tipo').order('titulo') as never),
      ler<Emprestimo[]>(
        supabase
          .from('emprestimos')
          .select(
            'id, livro_id, aluno_id, emprestado_em, devolver_ate, devolvido_em, alunos(nome, aluno_responsaveis(ordem, responsaveis(nome, whatsapp)))',
          )
          .is('devolvido_em', null) as never,
      ),
      ler<Emprestimo[]>(
        supabase
          .from('emprestimos')
          .select('id, livro_id, aluno_id, emprestado_em, devolver_ate, devolvido_em, alunos(nome)')
          .not('devolvido_em', 'is', null)
          .order('devolvido_em', { ascending: false })
          .limit(5) as never,
      ),
      ler<{ id: string; nome: string }[]>(supabase.from('alunos').select('id, nome').eq('ativo', true).order('nome') as never),
    ]);
    return { livros, abertos, recentes, alunos };
  }, []);

  const linhas = useMemo(() => {
    if (!dados) return [];
    const porLivro = new Map(dados.abertos.map((e) => [e.livro_id, e]));
    const q = semAcento(busca.trim());
    return dados.livros
      .map((l) => {
        const e = porLivro.get(l.id) ?? null;
        return { l, e, s: e ? situacao(e, hoje) : null };
      })
      .filter((x) => {
        if (tipo !== 'todos' && x.l.tipo !== tipo) return false;
        if (sit === 'disp' && x.e) return false;
        if (sit === 'emp' && !x.e) return false;
        if (sit === 'atr' && x.s?.tipo !== 'atrasado') return false;
        if (q && !semAcento(`${x.l.titulo} ${x.l.autor ?? ''}`).includes(q)) return false;
        return true;
      });
  }, [dados, tipo, sit, busca, hoje]);

  if (erro) return <Erro texto={erro} />;
  if (carregando && !dados) return <Carregando />;
  if (!dados) return null;

  const { livros, abertos, recentes, alunos } = dados;
  const livroPor = (id: string) => livros.find((l) => l.id === id);
  const disponiveis = livros.filter((l) => !abertos.some((e) => e.livro_id === l.id));
  const atrasados = abertos.filter((e) => situacao(e, hoje).tipo === 'atrasado').length;
  const atencao = abertos
    .map((e) => ({ e, s: situacao(e, hoje), l: livroPor(e.livro_id) }))
    .filter((x) => x.s.atencao && x.l)
    .sort((a, b) => a.s.dias - b.s.dias);
  const lembreteAberto = lembrete ? abertos.find((e) => e.id === lembrete) : undefined;

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

  function emprestar() {
    const aluno = alunos.find((a) => semAcento(a.nome) === semAcento(nomeAluno.trim()));
    if (!livroEscolhido) return setErroAcao('Escolha o livro.');
    if (!aluno) return setErroAcao('Escolha um aluno da lista. Quem ainda não é aluno precisa ser cadastrado antes.');
    void agir(async () => {
      await executar(
        supabase.from('emprestimos').insert({
          livro_id: livroEscolhido,
          aluno_id: aluno.id,
          emprestado_em: hoje,
          devolver_ate: somarDias(hoje, PRAZO_DIAS),
        }),
      );
      setLivroEscolhido('');
      setNomeAluno('');
      setEmprestando(false);
    }, 'Empréstimo registrado');
  }

  function devolver(e: Emprestimo) {
    void agir(async () => {
      await executar(supabase.from('emprestimos').update({ devolvido_em: hoje }).eq('id', e.id));
      if (lembrete === e.id) setLembrete(null);
    }, 'Devolução registrada');
  }

  function cadastrar() {
    const titulo = novoTitulo.trim();
    if (!titulo) return setErroAcao('Digite o título.');
    void agir(async () => {
      await executar(supabase.from('livros').insert({ titulo, autor: novoAutor.trim() || null, tipo: novoTipo }));
      setNovoTitulo('');
      setNovoAutor('');
      setCadastrando(false);
    }, 'Livro cadastrado');
  }

  const botaoLembrar = (e: Emprestimo) => (
    <button type="button" className="btn--link" onClick={() => setLembrete(e.id)}>
      Lembrar no WhatsApp
    </button>
  );

  const cartaoLembrete = () => {
    const e = lembreteAberto;
    const l = e ? livroPor(e.livro_id) : undefined;
    if (!e || !l) return null;
    const texto = textoLembrete(e, l, situacao(e, hoje));
    const resp = responsavelDe(e);
    const link = linkWhatsapp(resp?.whatsapp ?? null, texto) ?? `https://wa.me/?text=${encodeURIComponent(texto)}`;
    return (
      <section className="card msg" aria-label="Mensagem de lembrete">
        <div className="msg__topo">
          <h2>Lembrete sobre “{l.titulo}”</h2>
          <button type="button" className="fechar" aria-label="Fechar mensagem" onClick={() => setLembrete(null)}>
            <Icone nome="x" tamanho={18} />
          </button>
        </div>
        <p className="msg__texto">{texto}</p>
        <div className="msg__acoes">
          <a className="btn btn--verde" href={link} target="_blank" rel="noopener noreferrer">
            Abrir no WhatsApp
          </a>
          <span>
            {resp?.whatsapp
              ? `Vai para ${resp.nome}. A secretaria revisa o texto antes de enviar.`
              : 'Sem WhatsApp cadastrado: escolha o contato no próprio WhatsApp. A secretaria revisa o texto antes de enviar.'}
          </span>
        </div>
      </section>
    );
  };

  return (
    <div className="bib-tab" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Topo
        titulo="Biblioteca"
        subtitulo={`Empréstimo de até ${PRAZO_DIAS} dias`}
        acoes={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setCadastrando((v) => !v);
                setEmprestando(false);
              }}
            >
              Cadastrar livro
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setEmprestando((v) => !v);
                setCadastrando(false);
              }}
            >
              Novo empréstimo
            </button>
          </>
        }
      />

      <div className="stats">
        <Stat rotulo="Títulos no acervo" valor={livros.length} />
        <Stat rotulo="Disponíveis" valor={disponiveis.length} tom="verde" />
        <Stat rotulo="Emprestados" valor={abertos.length} nota="Inclui os atrasados" />
        <Stat rotulo="Atrasados" valor={atrasados} tom={atrasados ? 'vermelho' : 'verde'} nota={`Prazo de ${PRAZO_DIAS} dias`} />
      </div>

      {erroAcao ? <Erro texto={erroAcao} /> : null}

      {emprestando ? (
        <section className="card bloco" aria-label="Novo empréstimo">
          <h2>Novo empréstimo</h2>
          <div className="bib-form__grade">
            <Campo rotulo="Livro">
              <select value={livroEscolhido} onChange={(e) => setLivroEscolhido(e.target.value)}>
                <option value="">{disponiveis.length ? 'Escolha um livro disponível' : 'Nenhum livro disponível'}</option>
                {disponiveis.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.titulo} ({l.tipo})
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Aluno que está pegando">
              <input
                list="bib-alunos"
                autoComplete="off"
                value={nomeAluno}
                onChange={(e) => setNomeAluno(e.target.value)}
                placeholder="Comece a digitar o nome"
              />
            </Campo>
            <datalist id="bib-alunos">
              {alunos.map((a) => (
                <option key={a.id} value={a.nome} />
              ))}
            </datalist>
          </div>
          <p className="bib-prazo">
            Empréstimo de hoje ({dataBr(hoje)}). Devolver até <b>{dataBr(somarDias(hoje, PRAZO_DIAS))}</b>, em {PRAZO_DIAS} dias.
          </p>
          <div className="bib-acoes">
            <button type="button" className="btn" onClick={emprestar}>
              Registrar empréstimo
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setEmprestando(false)}>
              Cancelar
            </button>
          </div>
        </section>
      ) : null}

      {cadastrando ? (
        <section className="card bloco" aria-label="Cadastrar livro">
          <h2>Cadastrar livro</h2>
          <div className="bib-form__grade">
            <Campo rotulo="Título">
              <input value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)} />
            </Campo>
            <Campo rotulo="Autor (opcional)">
              <input value={novoAutor} onChange={(e) => setNovoAutor(e.target.value)} />
            </Campo>
            <Campo rotulo="Tipo">
              <select value={novoTipo} onChange={(e) => setNovoTipo(e.target.value as 'livro' | 'quadrinho')}>
                <option value="quadrinho">Quadrinho</option>
                <option value="livro">Livro</option>
              </select>
            </Campo>
          </div>
          <div className="bib-acoes">
            <button type="button" className="btn" onClick={cadastrar}>
              Cadastrar
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setCadastrando(false)}>
              Cancelar
            </button>
          </div>
        </section>
      ) : null}

      {cartaoLembrete()}

      <section className="card bloco" aria-label="Pedem atenção">
        <div className="bloco__topo">
          <h2>Pedem atenção</h2>
          <span className="leve">Atrasados e com devolução em até 2 dias</span>
        </div>
        {atencao.length === 0 ? (
          <p className="leve">Nenhum empréstimo atrasado ou vencendo nos próximos dias.</p>
        ) : (
          <div>
            {atencao.map(({ e, s, l }) => (
              <div className="bib-aten" key={e.id}>
                <div className="bib-aten__txt">
                  <b>{l!.titulo}</b>
                  <span className="leve">
                    Com {e.alunos?.nome}, devolver até {dataBr(e.devolver_ate)}
                  </span>
                  <Selo tom={s.tom}>{s.texto}</Selo>
                </div>
                <div className="bib-acoes">
                  {botaoLembrar(e)}
                  <button type="button" className="btn--link" onClick={() => devolver(e)}>
                    Registrar devolução
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card bib-filtros" aria-label="Filtros do acervo">
        <div className="bib-filtros__linha">
          <div>
            <div className="filtros__rotulo" id="rot-tipo" style={{ marginBottom: 8 }}>
              Tipo
            </div>
            <div className="chips" role="group" aria-labelledby="rot-tipo">
              {(
                [
                  ['todos', 'Todos'],
                  ['quadrinho', 'Quadrinhos'],
                  ['livro', 'Livros'],
                ] as const
              ).map(([v, r]) => (
                <button key={v} type="button" className="chip" aria-pressed={tipo === v} onClick={() => setTipo(v)}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="filtros__rotulo" id="rot-sit" style={{ marginBottom: 8 }}>
              Situação
            </div>
            <div className="chips" role="group" aria-labelledby="rot-sit">
              {(
                [
                  ['todas', 'Todos'],
                  ['disp', 'Disponíveis'],
                  ['emp', 'Emprestados'],
                  ['atr', 'Atrasados'],
                ] as const
              ).map(([v, r]) => (
                <button key={v} type="button" className="chip" aria-pressed={sit === v} onClick={() => setSit(v)}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
        <label className="campo bib-busca">
          Buscar
          <input type="search" placeholder="Título ou autor" value={busca} onChange={(e) => setBusca(e.target.value)} autoComplete="off" />
        </label>
      </section>

      <span className="leve">
        Mostrando {linhas.length} de {livros.length} títulos
      </span>
      <div className="card tabela" tabIndex={0} role="region" aria-label="Acervo da biblioteca">
        {linhas.length === 0 ? (
          <Vazio texto={livros.length === 0 ? 'Nenhum livro cadastrado ainda.' : 'Nenhum título com esses filtros.'}>
            {livros.length > 0 ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setTipo('todos');
                  setSit('todas');
                  setBusca('');
                }}
              >
                Limpar filtros
              </button>
            ) : null}
          </Vazio>
        ) : (
          <table style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th scope="col">Título</th>
                <th scope="col">Tipo</th>
                <th scope="col">Situação</th>
                <th scope="col">Ação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ l, e, s }) => (
                <tr key={l.id}>
                  <td>
                    <div className="dois">
                      <span className="forte">{l.titulo}</span>
                      {l.autor ? <span className="leve">{l.autor}</span> : null}
                    </div>
                  </td>
                  <td>
                    <Selo tom={l.tipo === 'quadrinho' ? 'azul' : 'nao'}>{l.tipo === 'quadrinho' ? 'Quadrinho' : 'Livro'}</Selo>
                  </td>
                  <td>
                    {e && s ? (
                      <div className="dois" style={{ alignItems: 'flex-start', gap: 4 }}>
                        <Selo tom={s.tom}>{s.texto}</Selo>
                        <span className="leve">
                          Com {e.alunos?.nome}, devolver até {dataBr(e.devolver_ate)}
                        </span>
                      </div>
                    ) : (
                      <Selo tom="ok">Disponível</Selo>
                    )}
                  </td>
                  <td>
                    {e && s ? (
                      <div className="bib-acoes">
                        {s.atencao ? botaoLembrar(e) : null}
                        <button type="button" className="btn--link" onClick={() => devolver(e)}>
                          Registrar devolução
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn--link"
                        onClick={() => {
                          setLivroEscolhido(l.id);
                          setEmprestando(true);
                          setCadastrando(false);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        Emprestar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <section className="card bloco" aria-label="Devoluções recentes">
        <h2>Devoluções recentes</h2>
        {recentes.length === 0 ? (
          <p className="leve">Nenhuma devolução registrada ainda.</p>
        ) : (
          <div>
            {recentes.map((e) => {
              const atraso = diasEntre(e.devolver_ate, e.devolvido_em!);
              return (
                <div className="bib-hist" key={e.id}>
                  <div>
                    <b style={{ fontWeight: 600 }}>{livroPor(e.livro_id)?.titulo ?? 'Livro removido'}</b>
                    <br />
                    <span className="leve">
                      {e.alunos?.nome}, devolvido em {dataBr(e.devolvido_em)}
                    </span>
                  </div>
                  {atraso > 0 ? (
                    <Selo tom="warn">{`Com ${atraso} ${atraso === 1 ? 'dia' : 'dias'} de atraso`}</Selo>
                  ) : (
                    <Selo tom="ok">No prazo</Selo>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
