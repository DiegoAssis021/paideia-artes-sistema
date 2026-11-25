import { useEffect, useRef, useState } from 'react';
import { Campo, Erro } from './pecas';

export interface AlunoDaTurma {
  id: string;
  nome: string;
}

export interface EdicaoNumero {
  titulo: string;
  duracao: number | null;
  /** Alunos da turma que ficam de fora deste número. */
  ausentes: string[];
}

interface Props {
  tituloInicial: string;
  duracaoInicial: number | null;
  nomeTurma: string | null;
  alunos: AlunoDaTurma[];
  ausentesIniciais: Set<string>;
  aoSalvar: (e: EdicaoNumero) => Promise<void>;
  aoFechar: () => void;
}

/** Janela para editar um número do espetáculo: título, duração e quais alunos da turma participam. */
export function JanelaNumero({ tituloInicial, duracaoInicial, nomeTurma, alunos, ausentesIniciais, aoSalvar, aoFechar }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [titulo, setTitulo] = useState(tituloInicial);
  const [duracao, setDuracao] = useState(duracaoInicial ? String(duracaoInicial) : '');
  const [participa, setParticipa] = useState<Set<string>>(
    () => new Set(alunos.filter((a) => !ausentesIniciais.has(a.id)).map((a) => a.id)),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  function alternar(id: string) {
    setParticipa((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function salvar() {
    const d = duracao.trim() === '' ? null : Number(duracao);
    if (!titulo.trim()) return setErro('Informe o título do número.');
    if (d !== null && (!Number.isInteger(d) || d <= 0)) return setErro('A duração deve ser um número inteiro de minutos, maior que zero.');
    if (alunos.length > 0 && participa.size === 0) return setErro('Marque pelo menos um aluno. Para tirar a turma, use o X da lista.');
    setErro(null);
    setSalvando(true);
    try {
      await aoSalvar({ titulo: titulo.trim(), duracao: d, ausentes: alunos.filter((a) => !participa.has(a.id)).map((a) => a.id) });
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setSalvando(false);
    }
  }

  return (
    <dialog ref={ref} className="janela" aria-labelledby="janela-titulo" onClose={aoFechar} onCancel={aoFechar}>
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar();
        }}
      >
        <h2 id="janela-titulo">Editar número</h2>
        <div className="form__grade">
          <Campo rotulo="Título do número">
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus />
          </Campo>
          <Campo rotulo="Duração em minutos">
            <input inputMode="numeric" value={duracao} onChange={(e) => setDuracao(e.target.value)} placeholder="5" />
          </Campo>
        </div>

        {alunos.length > 0 ? (
          <fieldset className="janela__alunos">
            <legend>
              Quem participa{nomeTurma ? ` da ${nomeTurma}` : ''}: {participa.size} de {alunos.length}
            </legend>
            <div className="bib-acoes">
              <button type="button" className="btn--link" onClick={() => setParticipa(new Set(alunos.map((a) => a.id)))}>
                Marcar todos
              </button>
              <button type="button" className="btn--link" onClick={() => setParticipa(new Set())}>
                Desmarcar todos
              </button>
            </div>
            <div className="janela__lista">
              {alunos.map((a) => (
                <label key={a.id} className="campo campo--marcar">
                  <input type="checkbox" checked={participa.has(a.id)} onChange={() => alternar(a.id)} />
                  {a.nome}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {erro ? <Erro texto={erro} /> : null}
        <div className="form__acoes">
          <button type="submit" className="btn" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={aoFechar}>
            Cancelar
          </button>
        </div>
      </form>
    </dialog>
  );
}
