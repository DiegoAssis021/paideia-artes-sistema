import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAviso } from '../componentes/Aviso';
import { Campo, Carregando, Erro, Topo } from '../componentes/pecas';
import { executar, ler, supabase } from '../lib/supabase';
import type { Aluno, Responsavel } from '../lib/tipos';
import { useCarregar } from '../lib/useCarregar';

interface Dados {
  aluno: Aluno | null;
  responsaveis: Responsavel[];
}

const vazioParaNulo = (s: string) => (s.trim() === '' ? null : s.trim());

export default function AlunoForm() {
  const { id } = useParams();
  const { dados, erro, carregando } = useCarregar<Dados>(async () => {
    const [aluno, responsaveis] = await Promise.all([
      id ? ler<Aluno>(supabase.from('alunos').select('*').eq('id', id).single() as never) : Promise.resolve(null),
      ler<Responsavel[]>(
        supabase.from('responsaveis').select('id, nome, parentesco, whatsapp, email').order('nome') as never,
      ),
    ]);
    return { aluno, responsaveis };
  }, [id]);

  if (erro) return <Erro texto={erro} />;
  if (carregando || !dados) return <Carregando />;
  return <Formulario dados={dados} id={id} />;
}

function Formulario({ dados, id }: { dados: Dados; id?: string }) {
  const ir = useNavigate();
  const avisar = useAviso();
  const a = dados.aluno;
  const resp0 = dados.responsaveis.find((r) => r.id === a?.responsavel_id) ?? null;

  const [nome, setNome] = useState(a?.nome ?? '');
  const [nascimento, setNascimento] = useState(a?.nascimento ?? '');
  const [emergNome, setEmergNome] = useState(a?.contato_emergencia_nome ?? '');
  const [emergTel, setEmergTel] = useState(a?.contato_emergencia_telefone ?? '');
  const [obs, setObs] = useState(a?.observacoes ?? '');
  const [ativo, setAtivo] = useState(a?.ativo ?? true);

  const [respId, setRespId] = useState(resp0?.id ?? '');
  const [respNome, setRespNome] = useState(resp0?.nome ?? '');
  const [parentesco, setParentesco] = useState(resp0?.parentesco ?? '');
  const [whatsapp, setWhatsapp] = useState(resp0?.whatsapp ?? '');
  const [email, setEmail] = useState(resp0?.email ?? '');

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function escolherResponsavel(novoId: string) {
    setRespId(novoId);
    const r = dados.responsaveis.find((x) => x.id === novoId);
    setRespNome(r?.nome ?? '');
    setParentesco(r?.parentesco ?? '');
    setWhatsapp(r?.whatsapp ?? '');
    setEmail(r?.email ?? '');
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      let responsavelId: string | null = null;
      if (respNome.trim() !== '') {
        const corpoResp = {
          nome: respNome.trim(),
          parentesco: vazioParaNulo(parentesco),
          whatsapp: vazioParaNulo(whatsapp),
          email: vazioParaNulo(email),
        };
        if (respId) {
          await executar(supabase.from('responsaveis').update(corpoResp).eq('id', respId));
          responsavelId = respId;
        } else {
          const novo = await ler<{ id: string }>(
            supabase.from('responsaveis').insert(corpoResp).select('id').single() as never,
          );
          responsavelId = novo.id;
        }
      }
      const corpo = {
        nome: nome.trim(),
        nascimento: nascimento || null,
        responsavel_id: responsavelId,
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
          <h2>Responsável</h2>
          <Campo rotulo="Responsável">
            <select value={respId} onChange={(e) => escolherResponsavel(e.target.value)}>
              <option value="">Novo responsável</option>
              {dados.responsaveis.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          </Campo>
          <p className="sub-nota">
            Irmãos podem compartilhar o mesmo responsável. Ao editar um responsável existente, a mudança vale para todos os
            alunos ligados a ele.
          </p>
          <div className="form__grade">
            <Campo rotulo="Nome do responsável">
              <input value={respNome} onChange={(e) => setRespNome(e.target.value)} />
            </Campo>
            <Campo rotulo="Parentesco">
              <input value={parentesco} onChange={(e) => setParentesco(e.target.value)} placeholder="Mãe, pai, avó..." />
            </Campo>
            <Campo rotulo="WhatsApp">
              <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(21) 90000-0000" />
            </Campo>
            <Campo rotulo="E-mail">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Campo>
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
