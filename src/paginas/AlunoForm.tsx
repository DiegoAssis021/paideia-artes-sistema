import { useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAviso } from '../componentes/Aviso';
import { Campo, Carregando, Erro, Topo } from '../componentes/pecas';
import { executar, ler, supabase } from '../lib/supabase';
import type { Aluno, Responsavel } from '../lib/tipos';
import { useCarregar } from '../lib/useCarregar';

interface Dados {
  aluno: Aluno | null;
  responsaveis: Responsavel[];
  vinculados: string[]; // ids dos responsáveis do aluno, em ordem
}

interface LinhaResp {
  chave: number;
  id: string; // '' = novo responsável
  nome: string;
  parentesco: string;
  whatsapp: string;
  email: string;
}

const vazioParaNulo = (s: string) => (s.trim() === '' ? null : s.trim());

export default function AlunoForm() {
  const { id } = useParams();
  const { dados, erro, carregando } = useCarregar<Dados>(async () => {
    const [aluno, responsaveis, vinculos] = await Promise.all([
      id ? ler<Aluno>(supabase.from('alunos').select('*').eq('id', id).single() as never) : Promise.resolve(null),
      ler<Responsavel[]>(
        supabase.from('responsaveis').select('id, nome, parentesco, whatsapp, email').order('nome') as never,
      ),
      id
        ? ler<{ responsavel_id: string }[]>(
            supabase.from('aluno_responsaveis').select('responsavel_id').eq('aluno_id', id).order('ordem') as never,
          )
        : Promise.resolve([] as { responsavel_id: string }[]),
    ]);
    return { aluno, responsaveis, vinculados: vinculos.map((v) => v.responsavel_id) };
  }, [id]);

  if (erro) return <Erro texto={erro} />;
  if (carregando || !dados) return <Carregando />;
  return <Formulario dados={dados} id={id} />;
}

function Formulario({ dados, id }: { dados: Dados; id?: string }) {
  const ir = useNavigate();
  const avisar = useAviso();
  const a = dados.aluno;

  const [nome, setNome] = useState(a?.nome ?? '');
  const [nascimento, setNascimento] = useState(a?.nascimento ?? '');
  const [emergNome, setEmergNome] = useState(a?.contato_emergencia_nome ?? '');
  const [emergTel, setEmergTel] = useState(a?.contato_emergencia_telefone ?? '');
  const [obs, setObs] = useState(a?.observacoes ?? '');
  const [ativo, setAtivo] = useState(a?.ativo ?? true);

  const proxima = useRef(0);
  const novaLinha = (r?: Responsavel): LinhaResp => ({
    chave: proxima.current++,
    id: r?.id ?? '',
    nome: r?.nome ?? '',
    parentesco: r?.parentesco ?? '',
    whatsapp: r?.whatsapp ?? '',
    email: r?.email ?? '',
  });
  const [linhas, setLinhas] = useState<LinhaResp[]>(() => {
    const existentes = dados.vinculados
      .map((rid) => dados.responsaveis.find((r) => r.id === rid))
      .filter((r): r is Responsavel => !!r)
      .map((r) => novaLinha(r));
    return existentes.length ? existentes : [novaLinha()];
  });

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function mudar(chave: number, parte: Partial<LinhaResp>) {
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...parte } : l)));
  }

  function escolherResponsavel(chave: number, novoId: string) {
    const r = dados.responsaveis.find((x) => x.id === novoId);
    mudar(chave, {
      id: novoId,
      nome: r?.nome ?? '',
      parentesco: r?.parentesco ?? '',
      whatsapp: r?.whatsapp ?? '',
      email: r?.email ?? '',
    });
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const idsResp: string[] = [];
      for (const l of linhas) {
        if (l.nome.trim() === '') continue;
        const corpoResp = {
          nome: l.nome.trim(),
          parentesco: vazioParaNulo(l.parentesco),
          whatsapp: vazioParaNulo(l.whatsapp),
          email: vazioParaNulo(l.email),
        };
        let rid = l.id;
        if (rid) {
          await executar(supabase.from('responsaveis').update(corpoResp).eq('id', rid));
        } else {
          const novo = await ler<{ id: string }>(
            supabase.from('responsaveis').insert(corpoResp).select('id').single() as never,
          );
          rid = novo.id;
        }
        if (!idsResp.includes(rid)) idsResp.push(rid);
      }
      const corpo = {
        nome: nome.trim(),
        nascimento: nascimento || null,
        contato_emergencia_nome: vazioParaNulo(emergNome),
        contato_emergencia_telefone: vazioParaNulo(emergTel),
        observacoes: vazioParaNulo(obs),
        ativo,
      };
      let alunoId = id;
      if (id) {
        await executar(supabase.from('alunos').update(corpo).eq('id', id));
      } else {
        const novo = await ler<{ id: string }>(supabase.from('alunos').insert(corpo).select('id').single() as never);
        alunoId = novo.id;
      }
      await executar(supabase.from('aluno_responsaveis').delete().eq('aluno_id', alunoId!));
      if (idsResp.length) {
        await executar(
          supabase
            .from('aluno_responsaveis')
            .insert(idsResp.map((rid, i) => ({ aluno_id: alunoId, responsavel_id: rid, ordem: i + 1 }))),
        );
      }
      avisar(id ? 'Ficha atualizada' : 'Aluno cadastrado');
      ir(`/alunos/${alunoId}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setSalvando(false);
    }
  }

  return (
    <>
      <Topo titulo={id ? 'Editar ficha do aluno' : 'Novo aluno'} subtitulo="Use só dados reais em produção; em desenvolvimento, só dados fictícios" />
      <form className="form" onSubmit={salvar}>
        <section className="card bloco">
          <h2>Aluno</h2>
          <div className="form__grade">
            <Campo rotulo="Nome completo">
              <input required value={nome} onChange={(e) => setNome(e.target.value)} />
            </Campo>
            <Campo rotulo="Data de nascimento">
              <input type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} />
            </Campo>
            <Campo rotulo="Contato de emergência (nome)">
              <input value={emergNome} onChange={(e) => setEmergNome(e.target.value)} />
            </Campo>
            <Campo rotulo="Contato de emergência (telefone)">
              <input type="tel" value={emergTel} onChange={(e) => setEmergTel(e.target.value)} />
            </Campo>
          </div>
          <Campo rotulo="Observações da secretaria">
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} />
          </Campo>
          {id ? (
            <label className="campo campo--marcar">
              <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
              Aluno ativo
            </label>
          ) : null}
        </section>

        <section className="card bloco">
          <h2>Responsáveis</h2>
          <p className="sub-nota">
            O primeiro é o responsável principal (recebe a mensagem pelo WhatsApp). Irmãos podem compartilhar os mesmos
            responsáveis. Ao editar um responsável existente, a mudança vale para todos os alunos ligados a ele.
          </p>
          {linhas.map((l, i) => (
            <div
              key={l.chave}
              style={i > 0 ? { marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(128,128,128,.3)' } : undefined}
            >
              <Campo rotulo={i === 0 ? 'Responsável principal' : `Responsável ${i + 1}`}>
                <select value={l.id} onChange={(e) => escolherResponsavel(l.chave, e.target.value)}>
                  <option value="">Novo responsável</option>
                  {dados.responsaveis.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <div className="form__grade">
                <Campo rotulo="Nome do responsável">
                  <input value={l.nome} onChange={(e) => mudar(l.chave, { nome: e.target.value })} />
                </Campo>
                <Campo rotulo="Parentesco">
                  <input
                    value={l.parentesco}
                    onChange={(e) => mudar(l.chave, { parentesco: e.target.value })}
                    placeholder="Mãe, pai, avó..."
                  />
                </Campo>
                <Campo rotulo="WhatsApp">
                  <input
                    type="tel"
                    value={l.whatsapp}
                    onChange={(e) => mudar(l.chave, { whatsapp: e.target.value })}
                    placeholder="(21) 90000-0000"
                  />
                </Campo>
                <Campo rotulo="E-mail">
                  <input type="email" value={l.email} onChange={(e) => mudar(l.chave, { email: e.target.value })} />
                </Campo>
              </div>
              {linhas.length > 1 ? (
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ height: 36, fontSize: 13 }}
                  onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
                >
                  Remover este responsável
                </button>
              ) : null}
            </div>
          ))}
          <div style={{ marginTop: 16 }}>
            <button type="button" className="btn btn--ghost" onClick={() => setLinhas((ls) => [...ls, novaLinha()])}>
              Adicionar outro responsável
            </button>
          </div>
        </section>

        {erro ? <Erro texto={erro} /> : null}
        <div className="form__acoes">
          <button className="btn" type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => ir(id ? `/alunos/${id}` : '/alunos')}>
            Cancelar
          </button>
        </div>
      </form>
    </>
  );
}
