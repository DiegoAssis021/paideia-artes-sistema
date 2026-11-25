import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAviso } from '../componentes/Aviso';
import { Campo, Carregando, Erro, Topo } from '../componentes/pecas';
import { executar, ler, supabase } from '../lib/supabase';
import { useCarregar } from '../lib/useCarregar';
import { ROTULO_STATUS } from './Espetaculos';

interface EnsaioForm {
  titulo: string;
  data: string;
  inicio: string;
  fim: string;
  local: string;
  observacao: string;
}

interface Dados {
  esp: {
    nome: string;
    data: string | null;
    hora_inicio: string | null;
    local: string | null;
    status: string;
    exposicao: string | null;
  } | null;
  ensaios: EnsaioForm[];
}

const hhmm = (h: string | null) => (h ? h.slice(0, 5) : '');
const nulo = (s: string) => (s.trim() === '' ? null : s.trim());

export default function EspetaculoForm() {
  const { id } = useParams();
  const { dados, erro, carregando } = useCarregar<Dados>(async () => {
    if (!id) return { esp: null, ensaios: [] };
    const [esp, ens] = await Promise.all([
      ler<Dados['esp']>(
        supabase.from('espetaculos').select('nome, data, hora_inicio, local, status, exposicao').eq('id', id).single() as never,
      ),
      ler<{ titulo: string; data: string | null; hora_inicio: string | null; hora_fim: string | null; local: string | null; observacao: string | null }[]>(
        supabase
          .from('ensaios')
          .select('titulo, data, hora_inicio, hora_fim, local, observacao')
          .eq('espetaculo_id', id)
          .order('data', { ascending: true, nullsFirst: true }) as never,
      ),
    ]);
    return {
      esp,
      ensaios: ens.map((e) => ({
        titulo: e.titulo,
        data: e.data ?? '',
        inicio: hhmm(e.hora_inicio),
        fim: hhmm(e.hora_fim),
        local: e.local ?? '',
        observacao: e.observacao ?? '',
      })),
    };
  }, [id]);

  if (erro) return <Erro texto={erro} />;
  if (carregando || !dados) return <Carregando />;
  return <Formulario dados={dados} id={id} />;
}

function Formulario({ dados, id }: { dados: Dados; id?: string }) {
  const ir = useNavigate();
  const avisar = useAviso();
  const e0 = dados.esp;
  const [nome, setNome] = useState(e0?.nome ?? '');
  const [data, setData] = useState(e0?.data ?? '');
  const [horaInicio, setHoraInicio] = useState(hhmm(e0?.hora_inicio ?? null));
  const [local, setLocal] = useState(e0?.local ?? 'Teatro Almir Rodrigues');
  const [status, setStatus] = useState(e0?.status ?? 'planejamento');
  const [exposicao, setExposicao] = useState(e0?.exposicao ?? '');
  const [ensaios, setEnsaios] = useState<EnsaioForm[]>(dados.ensaios);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function mudar(i: number, parte: Partial<EnsaioForm>) {
    setEnsaios((es) => es.map((e, n) => (n === i ? { ...e, ...parte } : e)));
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (!nome.trim()) return setErro('Informe o nome do espetáculo.');
    if (ensaios.some((e) => !e.titulo.trim())) return setErro('Todo ensaio precisa de um título.');
    if (ensaios.some((e) => e.inicio && e.fim && e.fim <= e.inicio)) return setErro('O fim do ensaio precisa ser depois do início.');
    setSalvando(true);
    try {
      const campos = {
        nome: nome.trim(),
        data: nulo(data),
        hora_inicio: nulo(horaInicio),
        local: nulo(local),
        status,
        exposicao: nulo(exposicao),
      };
      let espId = id;
      if (id) {
        await executar(supabase.from('espetaculos').update(campos).eq('id', id));
        await executar(supabase.from('ensaios').delete().eq('espetaculo_id', id));
      } else {
        const criado = await ler<{ id: string }>(supabase.from('espetaculos').insert(campos).select('id').single() as never);
        espId = criado.id;
      }
      if (ensaios.length) {
        await executar(
          supabase.from('ensaios').insert(
            ensaios.map((e) => ({
              espetaculo_id: espId,
              titulo: e.titulo.trim(),
              data: nulo(e.data),
              hora_inicio: nulo(e.inicio),
              hora_fim: nulo(e.fim),
              local: nulo(e.local),
              observacao: nulo(e.observacao),
            })),
          ),
        );
      }
      avisar(id ? 'Espetáculo atualizado' : 'Espetáculo criado');
      ir(`/espetaculos/${espId}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setSalvando(false);
    }
  }

  async function apagar() {
    if (!id) return;
    if (!window.confirm(`Apagar "${nome}" com todos os números e ensaios? Isso não pode ser desfeito.`)) return;
    setErro(null);
    try {
      await executar(supabase.from('espetaculos').delete().eq('id', id));
      avisar('Espetáculo apagado');
      ir('/espetaculos');
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <Topo titulo={id ? 'Editar espetáculo' : 'Novo espetáculo'} subtitulo="Os números do palco são montados na tela do espetáculo." />
      <form className="form card bloco" onSubmit={(e) => void salvar(e)}>
        <div className="form__grade">
          <Campo rotulo="Nome">
            <input value={nome} onChange={(e) => setNome(e.target.value)} required />
          </Campo>
          <Campo rotulo="Situação">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(ROTULO_STATUS).map(([v, r]) => (
                <option key={v} value={v}>
                  {r.texto}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Data">
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Campo rotulo="Hora de início">
            <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
          </Campo>
          <Campo rotulo="Local">
            <input value={local} onChange={(e) => setLocal(e.target.value)} />
          </Campo>
          <Campo rotulo="Exposição associada (opcional)">
            <input value={exposicao} onChange={(e) => setExposicao(e.target.value)} placeholder="Ex.: Exposição de desenhos no hall" />
          </Campo>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Ensaios</h2>
        {ensaios.map((e, i) => (
          <div className="horario-linha" key={i}>
            <Campo rotulo="Título">
              <input value={e.titulo} onChange={(x) => mudar(i, { titulo: x.target.value })} />
            </Campo>
            <Campo rotulo="Data">
              <input type="date" value={e.data} onChange={(x) => mudar(i, { data: x.target.value })} />
            </Campo>
            <Campo rotulo="Início">
              <input type="time" value={e.inicio} onChange={(x) => mudar(i, { inicio: x.target.value })} />
            </Campo>
            <Campo rotulo="Fim">
              <input type="time" value={e.fim} onChange={(x) => mudar(i, { fim: x.target.value })} />
            </Campo>
            <Campo rotulo="Local">
              <input value={e.local} onChange={(x) => mudar(i, { local: x.target.value })} />
            </Campo>
            <Campo rotulo="Observação">
              <input value={e.observacao} onChange={(x) => mudar(i, { observacao: x.target.value })} placeholder="Ex.: nas aulas de novembro" />
            </Campo>
            <button type="button" className="btn btn--ghost" onClick={() => setEnsaios((es) => es.filter((_, n) => n !== i))}>
              Remover
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setEnsaios((es) => [...es, { titulo: '', data: '', inicio: '', fim: '', local: '', observacao: '' }])}
          >
            Adicionar ensaio
          </button>
        </div>

        {erro ? <Erro texto={erro} /> : null}
        <div className="form__acoes">
          <button type="submit" className="btn" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => ir(id ? `/espetaculos/${id}` : '/espetaculos')}>
            Cancelar
          </button>
          {id ? (
            <button type="button" className="btn btn--perigo" onClick={() => void apagar()}>
              Apagar espetáculo
            </button>
          ) : null}
        </div>
      </form>
    </>
  );
}
