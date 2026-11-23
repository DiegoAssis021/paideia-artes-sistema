import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAviso } from '../componentes/Aviso';
import { Campo, Carregando, Erro, Topo } from '../componentes/pecas';
import { DIAS_LONGOS } from '../lib/formatar';
import { executar, ler, supabase } from '../lib/supabase';
import type { Curso, Horario, Perfil, Sala } from '../lib/tipos';
import { useCarregar } from '../lib/useCarregar';

interface Dados {
  cursos: Curso[];
  salas: Sala[];
  professores: Perfil[];
  turma: {
    nome: string;
    curso_id: string;
    idade_min: number | null;
    idade_max: number | null;
    vagas_total: number;
    professor_id: string | null;
    sala_id: string | null;
    publicada_no_site: boolean;
    horarios: Horario[];
  } | null;
}

const hhmm = (h: string) => h.slice(0, 5);
const numOuNulo = (s: string) => (s.trim() === '' ? null : Number(s));

export default function TurmaForm() {
  const { id } = useParams();
  const editando = Boolean(id);
  const { dados, erro, carregando } = useCarregar<Dados>(async () => {
    const [cursos, salas, professores, turma] = await Promise.all([
      ler<Curso[]>(supabase.from('cursos').select('id, nome').order('ordem') as never),
      ler<Sala[]>(supabase.from('salas').select('id, nome, cor').order('ordem') as never),
      ler<Perfil[]>(
        supabase.from('perfis').select('id, nome, perfil, ativo').eq('perfil', 'professor').eq('ativo', true).order('nome') as never,
      ),
      id
        ? ler<Dados['turma']>(
            supabase
              .from('turmas')
              .select(
                'nome, curso_id, idade_min, idade_max, vagas_total, professor_id, sala_id, publicada_no_site, horarios(dia_semana, inicio, fim)',
              )
              .eq('id', id)
              .single() as never,
          )
        : Promise.resolve(null),
    ]);
    return { cursos, salas, professores, turma };
  }, [id]);

  if (erro) return <Erro texto={erro} />;
  if (carregando || !dados) return <Carregando />;
  return <Formulario dados={dados} id={id} editando={editando} />;
}

function Formulario({ dados, id, editando }: { dados: Dados; id?: string; editando: boolean }) {
  const ir = useNavigate();
  const avisar = useAviso();
  const t = dados.turma;
  const [nome, setNome] = useState(t?.nome ?? '');
  const [cursoId, setCursoId] = useState(t?.curso_id ?? dados.cursos[0]?.id ?? '');
  const [idadeMin, setIdadeMin] = useState(t?.idade_min?.toString() ?? '');
  const [idadeMax, setIdadeMax] = useState(t?.idade_max?.toString() ?? '');
  const [vagas, setVagas] = useState(t?.vagas_total.toString() ?? '10');
  const [professorId, setProfessorId] = useState(t?.professor_id ?? '');
  const [salaId, setSalaId] = useState(t?.sala_id ?? '');
  const [publicada, setPublicada] = useState(t?.publicada_no_site ?? true);
  const [horarios, setHorarios] = useState<Horario[]>(
    t?.horarios.length ? t.horarios.map((h) => ({ ...h, inicio: hhmm(h.inicio), fim: hhmm(h.fim) })) : [],
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function mudarHorario(i: number, parte: Partial<Horario>) {
    setHorarios((hs) => hs.map((h, n) => (n === i ? { ...h, ...parte } : h)));
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (horarios.some((h) => h.fim <= h.inicio)) {
      setErro('Em cada horário, o fim precisa ser depois do início.');
      return;
    }
    setSalvando(true);
    try {
      const corpo = {
        nome: nome.trim(),
        curso_id: cursoId,
        idade_min: numOuNulo(idadeMin),
        idade_max: numOuNulo(idadeMax),
        vagas_total: Number(vagas),
        professor_id: professorId || null,
        sala_id: salaId || null,
        publicada_no_site: publicada,
      };
      let turmaId = id;
      if (editando && id) {
        await executar(supabase.from('turmas').update(corpo).eq('id', id));
        await executar(supabase.from('horarios').delete().eq('turma_id', id));
      } else {
        const nova = await ler<{ id: string }>(supabase.from('turmas').insert(corpo).select('id').single() as never);
        turmaId = nova.id;
      }
      if (horarios.length > 0) {
        await executar(
          supabase.from('horarios').insert(
            horarios.map((h) => ({ turma_id: turmaId, dia_semana: h.dia_semana, inicio: h.inicio, fim: h.fim })),
          ),
        );
      }
      avisar(editando ? 'Turma atualizada' : 'Turma criada');
      ir(`/turmas/${turmaId}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setSalvando(false);
    }
  }

  return (
    <>
      <Topo titulo={editando ? 'Editar turma' : 'Nova turma'} subtitulo="Segundo semestre de 2026" />
      <form className="card bloco form" onSubmit={salvar}>
        <div className="form__grade">
          <Campo rotulo="Nome da turma">
            <input required value={nome} onChange={(e) => setNome(e.target.value)} />
          </Campo>
          <Campo rotulo="Curso">
            <select required value={cursoId} onChange={(e) => setCursoId(e.target.value)}>
              {dados.cursos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Vagas">
            <input type="number" min={1} required value={vagas} onChange={(e) => setVagas(e.target.value)} />
          </Campo>
          <Campo rotulo="Idade mínima (opcional)">
            <input type="number" min={0} value={idadeMin} onChange={(e) => setIdadeMin(e.target.value)} />
          </Campo>
          <Campo rotulo="Idade máxima (opcional)">
            <input type="number" min={0} value={idadeMax} onChange={(e) => setIdadeMax(e.target.value)} />
          </Campo>
          <Campo rotulo="Professor">
            <select value={professorId} onChange={(e) => setProfessorId(e.target.value)}>
              <option value="">Sem professor</option>
              {dados.professores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Sala">
            <select value={salaId} onChange={(e) => setSalaId(e.target.value)}>
              <option value="">Sem sala</option>
              {dados.salas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <label className="campo campo--marcar">
          <input type="checkbox" checked={publicada} onChange={(e) => setPublicada(e.target.checked)} />
          Publicar as vagas desta turma no site
        </label>

        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <legend style={{ fontWeight: 700, fontSize: 16, padding: 0, marginBottom: 6 }}>Dias e horários</legend>
          {horarios.length === 0 ? <p className="sub-nota">Nenhum horário ainda.</p> : null}
          {horarios.map((h, i) => (
            <div className="horario-linha" key={i}>
              <Campo rotulo="Dia">
                <select value={h.dia_semana} onChange={(e) => mudarHorario(i, { dia_semana: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <option key={d} value={d}>
                      {DIAS_LONGOS[d]}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Início">
                <input type="time" required value={h.inicio} onChange={(e) => mudarHorario(i, { inicio: e.target.value })} />
              </Campo>
              <Campo rotulo="Fim">
                <input type="time" required value={h.fim} onChange={(e) => mudarHorario(i, { fim: e.target.value })} />
              </Campo>
              <button type="button" className="btn btn--ghost" onClick={() => setHorarios((hs) => hs.filter((_, n) => n !== i))}>
                Remover
              </button>
            </div>
          ))}
          <div>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setHorarios((hs) => [...hs, { dia_semana: 1, inicio: '14:00', fim: '15:00' }])}
            >
              Adicionar horário
            </button>
          </div>
        </fieldset>

        {erro ? <Erro texto={erro} /> : null}
        <div className="form__acoes">
          <button className="btn" type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar turma'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => ir(editando ? `/turmas/${id}` : '/turmas')}>
            Cancelar
          </button>
        </div>
      </form>
    </>
  );
}
