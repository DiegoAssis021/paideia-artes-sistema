import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useAviso } from '../componentes/Aviso';
import { Icone } from '../componentes/Icone';
import { Carregando, Erro, Selo, Topo, Vazio } from '../componentes/pecas';
import { dataLonga, diaSemanaIso, hojeIso, horaMinuto, textoContagem } from '../lib/agenda';
import { hora, iniciais } from '../lib/formatar';
import { executar, ler, supabase } from '../lib/supabase';
import type { Horario } from '../lib/tipos';
import { useCarregar } from '../lib/useCarregar';

/* ------------------------------------------------------------------ aulas de hoje */

interface AulaHoje {
  id: string;
  nome: string;
  salas: { nome: string } | null;
  perfis: { nome: string } | null;
  horarios: Horario[];
}

export function ChamadaHoje() {
  const { eEquipe } = useAuth();
  const hoje = hojeIso();
  const dia = diaSemanaIso(hoje);

  const { dados, erro, carregando } = useCarregar(async () => {
    const [turmas, presencas] = await Promise.all([
      ler<AulaHoje[]>(
        supabase
          .from('turmas')
          .select('id, nome, salas(nome), perfis(nome), horarios!inner(dia_semana, inicio, fim)')
          .eq('ativa', true)
          .eq('horarios.dia_semana', dia) as never,
      ),
      ler<{ turma_id: string; registrado_em: string }[]>(
        supabase.from('presencas').select('turma_id, registrado_em').eq('data', hoje) as never,
      ),
    ]);
    const feitas = new Map<string, string>();
    for (const p of presencas) {
      const atual = feitas.get(p.turma_id);
      if (!atual || p.registrado_em > atual) feitas.set(p.turma_id, p.registrado_em);
    }
    const aulas = turmas
      .flatMap((t) => t.horarios.map((h) => ({ turma: t, h })))
      .sort((a, b) => a.h.inicio.localeCompare(b.h.inicio) || a.turma.nome.localeCompare(b.turma.nome, 'pt-BR'));
    return { aulas, feitas };
  }, [hoje]);

  return (
    <>
      <Topo titulo="Chamada" subtitulo={`${dataLonga(hoje)}. Toque na aula para registrar quem faltou.`} />
      {erro ? <Erro texto={erro} /> : null}
      {carregando && !dados ? <Carregando /> : null}
      {dados ? (
        dados.aulas.length === 0 ? (
          <div className="card">
            <Vazio texto={eEquipe ? 'Nenhuma aula hoje.' : 'Você não tem aula hoje.'}>
              <Link className="btn btn--ghost" to="/calendario">
                Ver o calendário
              </Link>
            </Vazio>
          </div>
        ) : (
          <section className="card bloco chamada-hoje" aria-label="Aulas de hoje">
            {dados.aulas.map(({ turma, h }) => {
              const feita = dados.feitas.get(turma.id);
              return (
                <div className="aula-linha" key={`${turma.id}-${h.inicio}`}>
                  <div>
                    <b>{turma.nome}</b>
                    <span className="leve" style={{ fontSize: 13.5 }}>
                      {hora(h.inicio)} às {hora(h.fim)}
                      {turma.salas ? `, ${turma.salas.nome}` : ''}
                      {eEquipe && turma.perfis ? `, com ${turma.perfis.nome}` : ''}
                    </span>
                    {feita ? <Selo tom="ok">Chamada feita às {horaMinuto(feita)}</Selo> : null}
                  </div>
                  <Link className={feita ? 'btn btn--ghost' : 'btn btn--verde'} to={`/chamada/${turma.id}/${hoje}`}>
                    {feita ? 'Ver' : 'Fazer chamada'}
                  </Link>
                </div>
              );
            })}
          </section>
        )
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ chamada de uma turma */

interface TurmaChamada {
  id: string;
  nome: string;
  salas: { nome: string } | null;
  horarios: Horario[];
}

interface DadosChamada {
  turma: TurmaChamada;
  alunos: { aluno_id: string; nome: string }[];
  faltas: string[];
  salvoEm: string | null;
}

export function ChamadaTurma() {
  const { turmaId, data } = useParams();
  const hoje = hojeIso();
  const dataValida = !!data && /^\d{4}-\d{2}-\d{2}$/.test(data);

  const { dados, erro, carregando, recarregar } = useCarregar<DadosChamada>(async () => {
    const [turma, alunos, presencas] = await Promise.all([
      ler<TurmaChamada>(
        supabase
          .from('turmas')
          .select('id, nome, salas(nome), horarios(dia_semana, inicio, fim)')
          .eq('id', turmaId!)
          .single() as never,
      ),
      ler<{ aluno_id: string; nome: string }[]>(
        supabase.from('vw_alunos_do_professor').select('aluno_id, nome').eq('turma_id', turmaId!) as never,
      ),
      ler<{ aluno_id: string; presente: boolean; registrado_em: string }[]>(
        supabase
          .from('presencas')
          .select('aluno_id, presente, registrado_em')
          .eq('turma_id', turmaId!)
          .eq('data', data!) as never,
      ),
    ]);
    alunos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const salvoEm = presencas.reduce<string | null>((m, p) => (!m || p.registrado_em > m ? p.registrado_em : m), null);
    return { turma, alunos, faltas: presencas.filter((p) => !p.presente).map((p) => p.aluno_id), salvoEm };
  }, [turmaId, data]);

  const voltar = (
    <Link className="voltar" to="/chamada">
      <Icone nome="voltar" tamanho={18} />
      Aulas de hoje
    </Link>
  );

  if (!dataValida) return <Erro texto="Endereço de chamada inválido." />;
  if (data! > hoje)
    return (
      <>
        {voltar}
        <div className="card">
          <Vazio texto={`A chamada de ${dataLonga(data!).toLowerCase()} abre no dia da aula.`} />
        </div>
      </>
    );
  if (erro) return <Erro texto={erro} />;
  if (carregando && !dados) return <Carregando />;
  if (!dados) return null;

  const horarios = dados.turma.horarios.filter((h) => h.dia_semana === diaSemanaIso(data!));
  if (horarios.length === 0)
    return (
      <>
        {voltar}
        <div className="card">
          <Vazio texto={`${dados.turma.nome} não tem aula ${dataLonga(data!).split(',')[0].toLowerCase()}.`} />
        </div>
      </>
    );

  return (
    <>
      {voltar}
      <ListaChamada
        // remonta ao recarregar, para o estado local partir do que está salvo
        key={dados.salvoEm ?? 'nova'}
        dados={dados}
        data={data!}
        horarios={horarios}
        aoSalvar={recarregar}
      />
    </>
  );
}

function ListaChamada({
  dados,
  data,
  horarios,
  aoSalvar,
}: {
  dados: DadosChamada;
  data: string;
  horarios: Horario[];
  aoSalvar: () => void;
}) {
  const { perfil } = useAuth();
  const avisar = useAviso();
  const ir = useNavigate();
  const [faltas, setFaltas] = useState(() => new Set(dados.faltas));
  const [editando, setEditando] = useState(dados.salvoEm === null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const nF = dados.alunos.filter((a) => faltas.has(a.aluno_id)).length;
  const nP = dados.alunos.length - nF;
  const faixa = horarios.map((h) => `${hora(h.inicio)} às ${hora(h.fim)}`).join(' e ');

  function alternar(id: string) {
    if (!editando) return;
    setFaltas((f) => {
      const n = new Set(f);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      const agora = new Date().toISOString();
      await executar(
        supabase.from('presencas').upsert(
          dados.alunos.map((a) => ({
            turma_id: dados.turma.id,
            aluno_id: a.aluno_id,
            data,
            presente: !faltas.has(a.aluno_id),
            registrado_em: agora,
            registrado_por: perfil?.id,
          })),
          { onConflict: 'turma_id,aluno_id,data' },
        ),
      );
      avisar('Chamada salva');
      aoSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setSalvando(false);
    }
  }

  return (
    <section className="card chamada-real" aria-label={`Chamada de ${dados.turma.nome}`}>
      <div className="fone__topo">
        <div>
          <div className="fone__dia">{dataLonga(data)}</div>
          <h2>{dados.turma.nome}</h2>
          <div className="fone__hora">
            {faixa}
            {dados.turma.salas ? `, ${dados.turma.salas.nome}` : ''}
          </div>
        </div>
        <div className="fone__cont" role="status">
          <b>{textoContagem(nP, nF)}</b>
          <span>{editando ? 'Toque para marcar falta' : 'Chamada salva'}</span>
        </div>
      </div>

      {dados.alunos.length === 0 ? (
        <Vazio texto="Nenhum aluno matriculado nesta turma.">
          <button type="button" className="btn btn--ghost" onClick={() => ir(`/turmas/${dados.turma.id}`)}>
            Abrir a turma
          </button>
        </Vazio>
      ) : (
        <div className="fone__lista">
          {dados.alunos.map((a) => {
            const f = faltas.has(a.aluno_id);
            return (
              <button
                key={a.aluno_id}
                type="button"
                className={`aluno${f ? ' aluno--falta' : ''}`}
                aria-pressed={!f}
                aria-disabled={!editando}
                onClick={() => alternar(a.aluno_id)}
              >
                <span className="aluno__nome">
                  <span className="aluno__av" aria-hidden="true">
                    {iniciais(a.nome)}
                  </span>
                  <span>{a.nome}</span>
                </span>
                <span className="aluno__st">{f ? 'Falta' : 'Presente'}</span>
              </button>
            );
          })}
        </div>
      )}

      {dados.alunos.length > 0 ? (
        <div className="fone__rodape">
          {erro ? <Erro texto={erro} /> : null}
          {editando ? (
            <button type="button" className="fone__salvar" disabled={salvando} onClick={() => void salvar()}>
              {salvando ? 'Salvando...' : dados.salvoEm ? 'Salvar alterações' : 'Salvar chamada'}
            </button>
          ) : (
            <div className="fone__ok">
              <span>
                <Icone nome="check" />
                Chamada salva às {horaMinuto(dados.salvoEm!)}
              </span>
              <button type="button" onClick={() => setEditando(true)}>
                Editar
              </button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
