import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Icone } from '../componentes/Icone';
import { Carregando, Erro, Vazio } from '../componentes/pecas';
import {
  dataLonga,
  deIso,
  diaSemanaIso,
  diasDaSemana,
  distribuirFaixas,
  faixaDeDatas,
  hojeIso,
  horaDecimal,
  horaMinuto,
  horaTexto,
  inicioDaSemana,
  primeiroNome,
  relativo,
  somarDias,
  textoContagem,
  type DiaDaSemana,
  type Relativo,
} from '../lib/agenda';
import { DIAS_LONGOS } from '../lib/formatar';
import { ler, supabase } from '../lib/supabase';
import { useCarregar } from '../lib/useCarregar';

const INI = 8;
const FIM = 21;

interface Sala {
  id: string;
  nome: string;
  uso: string | null;
  cor: string;
}

interface TurmaLida {
  id: string;
  nome: string;
  vagas_total: number;
  sala_id: string | null;
  salas: Sala | null;
  perfis: { nome: string } | null;
  matriculas: { status: string }[];
  horarios: { id: string; dia_semana: number; inicio: string; fim: string }[];
}

interface PresencaLida {
  turma_id: string;
  data: string;
  presente: boolean;
  registrado_em: string;
  perfis: { nome: string } | null;
}

interface Chamada {
  presentes: number;
  faltas: number;
  em: string;
  por: string | null;
}

type Tipo = 'feita' | 'pendente' | 'hoje' | 'futura';

interface Aula {
  chave: string;
  turmaId: string;
  nome: string;
  sala: Sala | null;
  prof: string | null;
  alunos: number;
  vagas: number;
  dia: number;
  data: string;
  ini: number;
  fim: number;
  rel: Relativo;
  chamada: Chamada | null;
  tipo: Tipo;
}

function tipoDe(rel: Relativo, chamada: Chamada | null): Tipo {
  if (rel === 'futuro') return 'futura';
  if (chamada) return 'feita';
  return rel === 'passado' ? 'pendente' : 'hoje';
}

const faixaHorario = (a: Aula) => `${horaTexto(a.ini)} às ${horaTexto(a.fim)}`;
const nomeDoDia = (iso: string) => DIAS_LONGOS[diaSemanaIso(iso)];

/** Hora atual arredondada para baixo em 15 minutos, dentro do horário da escola. */
function agoraArredondado(): number {
  const d = new Date();
  const h = d.getHours() + Math.floor(d.getMinutes() / 15) / 4;
  return Math.min(Math.max(h, INI), 20.75);
}

/** Domingo não tem aula: o "dia de hoje" das salas vira a segunda seguinte. */
function diaUtil(iso: string): string {
  return diaSemanaIso(iso) === 7 ? somarDias(iso, 1) : iso;
}

export default function Calendario() {
  const { eEquipe } = useAuth();
  const hoje = hojeIso();
  const [semana, setSemana] = useState(() => inicioDaSemana(diaUtil(hoje)));
  const [vista, setVista] = useState<'semana' | 'salas'>('semana');
  const [sel, setSel] = useState<string | null>(null);
  const [salaDia, setSalaDia] = useState(() => diaUtil(hoje));
  const [salaHora, setSalaHora] = useState(agoraArredondado);

  const dias = useMemo(() => diasDaSemana(semana), [semana]);
  const sabado = dias[dias.length - 1].iso;

  const { dados, erro, carregando } = useCarregar(async () => {
    const [turmas, presencas, salas] = await Promise.all([
      ler<TurmaLida[]>(
        supabase
          .from('turmas')
          .select(
            'id, nome, vagas_total, sala_id, salas(id, nome, uso, cor), perfis(nome), matriculas(status), horarios(id, dia_semana, inicio, fim)',
          )
          .eq('ativa', true) as never,
      ),
      ler<PresencaLida[]>(
        supabase
          .from('presencas')
          .select('turma_id, data, presente, registrado_em, perfis(nome)')
          .gte('data', semana)
          .lte('data', sabado) as never,
      ),
      eEquipe
        ? ler<Sala[]>(supabase.from('salas').select('id, nome, uso, cor').order('ordem') as never)
        : Promise.resolve([] as Sala[]),
    ]);

    const chamadas = new Map<string, Chamada>();
    for (const p of presencas) {
      const k = `${p.turma_id}|${p.data}`;
      const c = chamadas.get(k) ?? { presentes: 0, faltas: 0, em: p.registrado_em, por: p.perfis?.nome ?? null };
      if (p.presente) c.presentes++;
      else c.faltas++;
      if (p.registrado_em >= c.em) {
        c.em = p.registrado_em;
        c.por = p.perfis?.nome ?? c.por;
      }
      chamadas.set(k, c);
    }

    const aulas: Aula[] = [];
    for (const t of turmas) {
      for (const h of t.horarios) {
        if (h.dia_semana < 1 || h.dia_semana > 6) continue;
        const data = somarDias(semana, h.dia_semana - 1);
        const rel = relativo(data);
        const chamada = chamadas.get(`${t.id}|${data}`) ?? null;
        aulas.push({
          chave: h.id,
          turmaId: t.id,
          nome: t.nome,
          sala: t.salas,
          prof: t.perfis?.nome ?? null,
          alunos: t.matriculas.filter((m) => m.status === 'ativa').length,
          vagas: t.vagas_total,
          dia: h.dia_semana,
          data,
          ini: horaDecimal(h.inicio),
          fim: horaDecimal(h.fim),
          rel,
          chamada,
          tipo: tipoDe(rel, chamada),
        });
      }
    }
    aulas.sort((a, b) => a.dia - b.dia || a.ini - b.ini || a.nome.localeCompare(b.nome, 'pt-BR'));
    return { aulas, salas };
  }, [semana, eEquipe]);

  function mudarSemana(nova: string) {
    setSemana(nova);
    setSel(null);
    // a visão Salas acompanha a semana, no mesmo dia da semana
    setSalaDia((d) => somarDias(nova, diaSemanaIso(d) - 1));
  }

  function verSalas(a: Aula) {
    setSalaDia(a.data);
    setSalaHora(Math.min(Math.max(a.ini, INI), 20.75));
    setVista('salas');
  }

  function irParaAgora() {
    const d = diaUtil(hojeIso());
    setSemana(inicioDaSemana(d));
    setSalaDia(d);
    setSalaHora(agoraArredondado());
  }

  const contemHoje = hoje >= semana && hoje <= sabado;
  const subtitulo =
    vista === 'salas'
      ? 'Quais salas estão livres e quais estão ocupadas, por dia e horário.'
      : `Semana de ${faixaDeDatas(semana, sabado)}.${contemHoje ? ` Hoje é ${dataLonga(hoje).split(',')[0].toLowerCase()}, dia ${deIso(hoje).getDate()}.` : ''}`;

  return (
    <>
      <div className="topo">
        <div>
          <h1>Calendário</h1>
          <p>{subtitulo}</p>
        </div>
        {vista === 'semana' ? (
          <div className="legenda">
            <span>
              <i style={{ background: 'var(--verde-f)', border: '1px solid var(--verde-b)' }} />
              Chamada feita
            </span>
            <span>
              <i style={{ background: 'var(--verm-f)', border: '1px solid var(--verm-b)' }} />
              Sem chamada
            </span>
            <span>
              <i style={{ background: 'var(--ambar-f)', border: '1px solid var(--ambar-b)' }} />
              Hoje
            </span>
            <span>
              <i style={{ background: 'var(--branco)', border: '1px solid rgba(31,29,43,.25)' }} />
              Próximas aulas
            </span>
          </div>
        ) : null}
      </div>

      <div className="cal-nav">
        {eEquipe ? (
          <div className="chips" role="group" aria-label="Vista do calendário">
            <button type="button" className="chip" aria-pressed={vista === 'semana'} onClick={() => setVista('semana')}>
              Semana
            </button>
            <button type="button" className="chip" aria-pressed={vista === 'salas'} onClick={() => setVista('salas')}>
              Salas
            </button>
          </div>
        ) : null}
        <div className="cal-nav" role="group" aria-label="Escolher a semana" style={{ marginLeft: eEquipe ? 'auto' : 0 }}>
          <button type="button" className="btn--link" onClick={() => mudarSemana(somarDias(semana, -7))}>
            Semana anterior
          </button>
          <button
            type="button"
            className="btn--link"
            disabled={contemHoje}
            onClick={() => mudarSemana(inicioDaSemana(diaUtil(hojeIso())))}
          >
            Esta semana
          </button>
          <button type="button" className="btn--link" onClick={() => mudarSemana(somarDias(semana, 7))}>
            Próxima semana
          </button>
        </div>
      </div>

      {erro ? <Erro texto={erro} /> : null}
      {carregando && !dados ? <Carregando /> : null}
      {dados ? (
        vista === 'salas' && eEquipe ? (
          <VisaoSalas
            dias={dias}
            aulas={dados.aulas}
            salas={dados.salas}
            dia={salaDia}
            hora={salaHora}
            aoDia={setSalaDia}
            aoHora={setSalaHora}
            aoAgora={irParaAgora}
          />
        ) : (
          <VisaoSemana dias={dias} aulas={dados.aulas} sel={sel} aoSelecionar={setSel} aoVerSalas={eEquipe ? verSalas : null} />
        )
      ) : null}
    </>
  );
}

/* ================================================================== Semana */

function VisaoSemana({
  dias,
  aulas,
  sel,
  aoSelecionar,
  aoVerSalas,
}: {
  dias: DiaDaSemana[];
  aulas: Aula[];
  sel: string | null;
  aoSelecionar: (chave: string) => void;
  aoVerSalas: ((a: Aula) => void) | null;
}) {
  const PX = 76;
  const horas = [];
  for (let h = INI; h < FIM; h++) horas.push(h);

  // dias com aulas sobrepostas ganham coluna mais larga
  const porDia = new Map(dias.map((d) => [d.dia, distribuirFaixas(aulas.filter((a) => a.dia === d.dia))]));
  const colunas = dias
    .map((d) => {
      const max = Math.max(1, ...(porDia.get(d.dia) ?? []).map((a) => a.faixas));
      return `minmax(0,${1 + 0.5 * (max - 1)}fr)`;
    })
    .join(' ');

  const escolhida =
    aulas.find((a) => a.chave === sel) ??
    aulas.find((a) => a.rel === 'hoje') ??
    aulas.find((a) => a.rel === 'futuro') ??
    aulas[0] ??
    null;

  return (
    <div className="cal-wrap">
      <section className="card cal" aria-label="Semana" tabIndex={0}>
        <div className="cal__grade" style={{ gridTemplateColumns: `48px ${colunas}` }}>
          <div style={{ borderBottom: '1px solid rgba(31,29,43,.1)' }} />
          {dias.map((d) => (
            <div key={d.iso} className={`cal__cab${d.rel === 'hoje' ? ' cal__cab--hoje' : ''}`} aria-current={d.rel === 'hoje' ? 'date' : undefined}>
              <span>{d.curto}</span>
              <b>{d.num}</b>
            </div>
          ))}
          <div className="cal__horas">
            {horas.map((h) => (
              <div key={h}>{h}h</div>
            ))}
          </div>
          {dias.map((d) => {
            const doDia = porDia.get(d.dia) ?? [];
            const cls = `cal__col${d.rel === 'hoje' ? ' cal__col--hoje' : d.rel === 'passado' ? ' cal__col--passado' : ''}`;
            return (
              <div key={d.iso} className={cls} style={{ height: (FIM - INI) * PX }}>
                {doDia.map((a) => {
                  const ini = Math.max(a.ini, INI);
                  const fim = Math.min(a.fim, FIM);
                  const larg = 100 / a.faixas;
                  const status =
                    a.tipo === 'feita'
                      ? `${a.chamada!.presentes} de ${a.chamada!.presentes + a.chamada!.faltas} presentes`
                      : a.tipo === 'pendente'
                        ? 'Sem chamada'
                        : a.tipo === 'hoje'
                          ? 'Hoje'
                          : '';
                  const estilo: CSSProperties = {
                    top: (ini - INI) * PX + 2,
                    height: Math.max((fim - ini) * PX - 4, 24),
                    left: `calc(${a.faixa * larg}% + 3px)`,
                    width: `calc(${larg}% - 6px)`,
                  };
                  return (
                    <button
                      key={a.chave}
                      type="button"
                      className={`aula aula--${a.tipo}`}
                      aria-pressed={escolhida?.chave === a.chave}
                      aria-label={`${a.nome}, ${nomeDoDia(a.data)}, ${faixaHorario(a)}${status ? `, ${status}` : ''}`}
                      style={estilo}
                      onClick={() => aoSelecionar(a.chave)}
                    >
                      <b>{a.nome}</b>
                      <span>{faixaHorario(a)}</span>
                      <span className="st">{status}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>

      <aside className="card painel" aria-label="Detalhes da aula">
        {escolhida ? (
          <Painel a={escolhida} aoVerSalas={aoVerSalas} />
        ) : (
          <Vazio texto="Nenhuma aula nesta semana." />
        )}
      </aside>
    </div>
  );
}

function Painel({ a, aoVerSalas }: { a: Aula; aoVerSalas: ((a: Aula) => void) | null }) {
  const matric = `${a.alunos} ${a.alunos === 1 ? 'aluno matriculado' : 'alunos matriculados'}, de ${a.vagas} vagas`;
  const linkChamada = `/chamada/${a.turmaId}/${a.data}`;
  const prof = primeiroNome(a.prof);

  let corpo;
  if (a.tipo === 'feita') {
    corpo = <DetalheChamada a={a} />;
  } else if (a.tipo === 'pendente') {
    const texto = `Oi, ${prof}! A chamada de ${a.nome} de ${nomeDoDia(a.data).toLowerCase()} (${deIso(a.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}) ainda está em aberto no sistema. Consegue registrar quando puder? Obrigada!`;
    corpo = (
      <div className="col">
        <div className="alerta alerta--bad">
          <Icone nome="warn" tamanho={18} />
          <span>A chamada desta aula ainda não foi registrada.</span>
        </div>
        <span className="leve" style={{ fontSize: 14 }}>
          {matric}
        </span>
        {prof ? (
          <a className="btn btn--verde" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer">
            Lembrar {prof} no WhatsApp
          </a>
        ) : null}
        <Link className="btn btn--ghost" to={linkChamada}>
          Registrar a chamada agora
        </Link>
      </div>
    );
  } else {
    const info =
      a.tipo === 'hoje'
        ? `Aula de hoje. A chamada fica com ${prof || 'o professor'}, pelo celular, e aparece aqui assim que for salva.`
        : 'Aula prevista. A chamada abre no dia da aula.';
    corpo = (
      <div className="col">
        <div className="alerta alerta--info">{info}</div>
        <span className="leve" style={{ fontSize: 14 }}>
          {matric}
        </span>
        {a.tipo === 'hoje' ? (
          <Link className="btn btn--verde" to={linkChamada}>
            Fazer a chamada
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div>
        <div className="painel__data">
          {dataLonga(a.data)}, {faixaHorario(a)}
        </div>
        <h2>{a.nome}</h2>
        <div className="painel__local">
          {a.sala?.nome ?? 'Sem sala'}
          {a.prof ? `, com ${a.prof}` : ''}
        </div>
      </div>
      {corpo}
      <Link className="btn btn--ghost" to={`/turmas/${a.turmaId}`}>
        Abrir a turma
      </Link>
      {aoVerSalas ? (
        <button type="button" className="btn btn--ghost" onClick={() => aoVerSalas(a)}>
          Ver as salas neste horário
        </button>
      ) : null}
    </>
  );
}

function DetalheChamada({ a }: { a: Aula }) {
  const { dados, erro } = useCarregar(async () => {
    const [presencas, nomes] = await Promise.all([
      ler<{ aluno_id: string; presente: boolean }[]>(
        supabase.from('presencas').select('aluno_id, presente').eq('turma_id', a.turmaId).eq('data', a.data) as never,
      ),
      ler<{ aluno_id: string; nome: string }[]>(
        supabase.from('vw_alunos_do_professor').select('aluno_id, nome').eq('turma_id', a.turmaId) as never,
      ),
    ]);
    const nome = new Map(nomes.map((n) => [n.aluno_id, n.nome]));
    return presencas
      .map((p) => ({ id: p.aluno_id, nome: nome.get(p.aluno_id) ?? 'Aluno que saiu da turma', falta: !p.presente }))
      .sort((x, y) => (x.falta !== y.falta ? (x.falta ? -1 : 1) : x.nome.localeCompare(y.nome, 'pt-BR')));
  }, [a.turmaId, a.data]);

  const c = a.chamada!;
  return (
    <div className="col">
      <div className="alerta alerta--ok">
        <Icone nome="check" tamanho={18} />
        <span>
          Chamada registrada{c.por ? ` por ${c.por}` : ''} às {horaMinuto(c.em)}.
        </span>
      </div>
      <span style={{ fontSize: 15, fontWeight: 700 }}>{textoContagem(c.presentes, c.faltas)}</span>
      {erro ? <Erro texto={erro} /> : null}
      {dados ? (
        <div className="lista-p">
          {dados.map((p) => (
            <div key={p.id}>
              <span>{p.nome}</span>
              <span className={`selo ${p.falta ? 'selo--bad' : 'selo--ok'}`} style={{ padding: '4px 11px', fontSize: 12.5 }}>
                {p.falta ? 'Falta' : 'Presente'}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <Link className="btn--link" to={`/chamada/${a.turmaId}/${a.data}`}>
        Corrigir a chamada
      </Link>
    </div>
  );
}

/* ================================================================== Salas */

function VisaoSalas({
  dias,
  aulas,
  salas,
  dia,
  hora,
  aoDia,
  aoHora,
  aoAgora,
}: {
  dias: DiaDaSemana[];
  aulas: Aula[];
  salas: Sala[];
  dia: string;
  hora: number;
  aoDia: (iso: string) => void;
  aoHora: (h: number) => void;
  aoAgora: () => void;
}) {
  const PX = 60;
  const h = Math.floor(hora + 1e-6);
  const m = Math.round((hora - h) * 60);
  const faixaRef = useRef<HTMLDivElement>(null);

  // traz a hora escolhida para o meio da fileira (sem animação para quem pediu menos movimento)
  useEffect(() => {
    const f = faixaRef.current;
    const b = f?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (!f || !b || f.scrollWidth <= f.clientWidth) return;
    const reduz = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    f.scrollTo({ left: b.offsetLeft - (f.clientWidth - b.offsetWidth) / 2, behavior: reduz ? 'auto' : 'smooth' });
  }, [h]);

  function teclaHora(e: KeyboardEvent<HTMLDivElement>) {
    let novo = h;
    if (e.key === 'ArrowRight') novo = Math.min(h + 1, 20);
    else if (e.key === 'ArrowLeft') novo = Math.max(h - 1, INI);
    else if (e.key === 'Home') novo = INI;
    else if (e.key === 'End') novo = 20;
    else return;
    e.preventDefault();
    aoHora(novo + m / 60);
    faixaRef.current?.querySelector<HTMLButtonElement>(`[data-h="${novo}"]`)?.focus();
  }

  const diaNum = diaSemanaIso(dia);
  const usoSala = (salaId: string, d: number) =>
    aulas.filter((a) => a.dia === d && a.sala?.id === salaId).sort((x, y) => x.ini - y.ini);

  let ocupadas = 0;
  const cartoes = salas.map((s) => {
    const lista = usoSala(s.id, diaNum);
    const atual = lista.find((a) => a.ini <= hora && hora < a.fim) ?? null;
    const prox = lista.find((a) => a.ini > hora) ?? null;
    if (atual) ocupadas++;
    let proxDia: Aula | null = null;
    if (!atual && !prox) {
      for (let d = diaNum + 1; d <= 6 && !proxDia; d++) proxDia = usoSala(s.id, d)[0] ?? null;
    }
    return { s, lista, atual, prox, proxDia };
  });
  const livres = salas.length - ocupadas;
  const resumo = `${nomeDoDia(dia)}, às ${horaTexto(hora)}: ${
    ocupadas === 0
      ? 'todas as salas livres'
      : `${ocupadas} ${ocupadas === 1 ? 'sala ocupada' : 'salas ocupadas'} e ${livres} ${livres === 1 ? 'livre' : 'livres'}`
  }.`;

  const horas = [];
  for (let k = INI; k <= 20; k++) horas.push(k);
  const marcas = [];
  for (let k = INI; k < FIM; k++) marcas.push(k);

  return (
    <>
      <section className="card salas-ctrl" aria-label="Escolher o momento">
        <div className="chips" role="group" aria-label="Dia">
          {dias.map((d) => (
            <button key={d.iso} type="button" className="chip" aria-pressed={d.iso === dia} onClick={() => aoDia(d.iso)}>
              {d.curto} {d.num}
              {d.rel === 'hoje' ? ' · hoje' : ''}
            </button>
          ))}
        </div>
        <div className="hora-bloco">
          <div className="hora-topo">
            <span className="hora-rotulo">Horário</span>
            <output aria-live="polite">{horaTexto(hora)}</output>
            <button type="button" className="btn btn--ghost" onClick={aoAgora}>
              Agora
            </button>
          </div>
          <div className="hora-strip" role="group" aria-label="Hora" ref={faixaRef} onKeyDown={teclaHora}>
            {horas.map((k) => (
              <button
                key={k}
                type="button"
                className="chip chip--hora"
                data-h={k}
                aria-pressed={k === h}
                aria-label={`${k} horas`}
                tabIndex={k === h ? 0 : -1}
                onClick={() => aoHora(k + m / 60)}
              >
                {k}h
              </button>
            ))}
          </div>
          <div className="hora-min">
            <span className="hora-rotulo">Minutos</span>
            <div className="seg" role="group" aria-label="Minutos">
              {[0, 15, 30, 45].map((mm) => (
                <button key={mm} type="button" aria-pressed={mm === m} aria-label={`${mm} minutos`} onClick={() => aoHora(h + mm / 60)}>
                  :{String(mm).padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {salas.length === 0 ? (
        <div className="card">
          <Vazio texto="Nenhuma sala cadastrada." />
        </div>
      ) : (
        <div className="col" style={{ gap: 18 }}>
          <p className="salas-resumo" role="status">
            {resumo}
          </p>
          <div className="salas-cards">
            {cartoes.map(({ s, atual, prox, proxDia }) => {
              const vars = { '--cor': s.cor } as CSSProperties;
              const nome = (
                <div className="sala-card__nome">
                  <span className="sala-dot" aria-hidden="true" />
                  <div>
                    <h3>{s.nome}</h3>
                    <span className="leve">{s.uso ?? ''}</span>
                  </div>
                </div>
              );
              if (atual) {
                const depois =
                  prox && prox.ini === atual.fim ? `Depois: ${prox.nome}, das ${faixaHorario(prox)}.` : 'Depois: livre.';
                return (
                  <article key={s.id} className="card sala-card sala-card--ocupada" style={vars}>
                    {nome}
                    <span className="pill pill--oc">Ocupada</span>
                    <div>
                      <div className="sala-card__turma">{atual.nome}</div>
                      <p>
                        {atual.prof ? `Com ${atual.prof}, ` : ''}
                        {faixaHorario(atual)}, {atual.alunos} {atual.alunos === 1 ? 'aluno' : 'alunos'}.
                      </p>
                    </div>
                    <p>
                      Termina às {horaTexto(atual.fim)}. {depois}
                    </p>
                    <Link className="btn--link" to={`/turmas/${atual.turmaId}`}>
                      Abrir a turma
                    </Link>
                  </article>
                );
              }
              let titulo: string;
              let detalhe: string;
              if (prox) {
                titulo = `Livre até ${horaTexto(prox.ini)}`;
                detalhe = `Depois: ${prox.nome}, das ${faixaHorario(prox)}.`;
              } else {
                titulo = 'Livre pelo resto do dia';
                detalhe = proxDia
                  ? `Próxima aula: ${nomeDoDia(proxDia.data).toLowerCase()}, ${horaTexto(proxDia.ini)}, ${proxDia.nome}.`
                  : 'Sem mais aulas nesta semana.';
              }
              return (
                <article key={s.id} className="card sala-card" style={vars}>
                  {nome}
                  <span className="pill pill--li">Livre</span>
                  <div>
                    <div className="sala-card__turma">{titulo}</div>
                    <p>{detalhe}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <section className="card" aria-label="Ocupação das salas no dia">
            <div className="bloco__topo" style={{ padding: '18px 20px 12px' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Ocupação do dia, sala por sala</h2>
              <div className="legenda">
                <span>
                  <i style={{ background: 'var(--leve)' }} />
                  Bloco cheio: ocupada no horário escolhido
                </span>
                <span>
                  <i style={{ background: 'var(--cinza-f)', border: '1px solid var(--cinza-b)' }} />
                  Bloco claro: outras aulas do dia
                </span>
              </div>
            </div>
            <p className="dica-rolagem">Deslize para o lado para ver todas as salas.</p>
            <div className="tabela" tabIndex={0} role="region" aria-label="Grade das salas, role para o lado">
              <div className="vg" style={{ minWidth: Math.max(900, 56 + salas.length * 130), '--n': salas.length } as CSSProperties}>
                <div className="vg-cabs">
                  <div />
                  {salas.map((s) => (
                    <div key={s.id} className="vg-cab" style={{ '--cor': s.cor } as CSSProperties}>
                      <span className="sala-dot" aria-hidden="true" />
                      <div>
                        <b>{s.nome}</b>
                        <small>{s.uso ?? ''}</small>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="vg-corpo">
                  <div className="vg-horas">
                    {marcas.map((k) => (
                      <span key={k}>{k}h</span>
                    ))}
                  </div>
                  {cartoes.map(({ s, lista, atual }) => (
                    <div key={s.id} className="vg-col" style={{ '--cor': s.cor } as CSSProperties}>
                      {lista.map((a) => {
                        const ini = Math.max(a.ini, INI);
                        const fim = Math.min(a.fim, FIM);
                        const rot = `${a.nome}, ${s.nome}, ${faixaHorario(a)}`;
                        return (
                          <Link
                            key={a.chave}
                            to={`/turmas/${a.turmaId}`}
                            className={`vg-bloco${a === atual ? ' vg-bloco--agora' : ''}`}
                            aria-label={rot}
                            title={rot}
                            style={{ top: (ini - INI) * PX + 2, height: Math.max((fim - ini) * PX - 4, 22), textDecoration: 'none' }}
                          >
                            <b>{a.nome}</b>
                            <span>{faixaHorario(a)}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                  <div className="vg-agora" style={{ top: (hora - INI) * PX }}>
                    <span>{horaTexto(hora)}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
