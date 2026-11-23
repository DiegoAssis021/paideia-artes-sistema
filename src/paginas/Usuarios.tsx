import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useAviso } from '../componentes/Aviso';
import { Carregando, Erro, Selo, Topo } from '../componentes/pecas';
import { executar, ler, supabase } from '../lib/supabase';
import { ROTULO_PERFIL, type Perfil, type PerfilTipo } from '../lib/tipos';
import { useCarregar } from '../lib/useCarregar';

const PERMISSOES: [string, boolean, boolean, boolean][] = [
  ['Ver e editar turmas e matrículas', true, true, false],
  ['Ver as próprias turmas e a chamada', true, true, true],
  ['Ver e editar ficha dos alunos', true, true, false],
  ['Ver nome, idade e contato de emergência da turma', true, true, true],
  ['Cobranças e mensalidades', true, true, false],
  ['Totais do financeiro', true, false, false],
  ['Liberar acesso e definir perfis', true, false, false],
];

export default function Usuarios() {
  const { perfil: eu } = useAuth();
  const avisar = useAviso();
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const { dados, erro, carregando, recarregar } = useCarregar(
    () => ler<Perfil[]>(supabase.from('perfis').select('id, nome, perfil, ativo').order('nome') as never),
    [],
  );

  async function mudar(p: Perfil, parte: Partial<Pick<Perfil, 'perfil' | 'ativo'>>) {
    setErroAcao(null);
    try {
      await executar(supabase.from('perfis').update(parte).eq('id', p.id));
      avisar('Acesso atualizado');
      recarregar();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : String(e));
    }
  }

  const sim = (v: boolean) => (v ? '✓' : '—');

  return (
    <>
      <Topo titulo="Usuários" subtitulo="Quem tem acesso ao sistema e com qual perfil" />
      {erro ? <Erro texto={erro} /> : null}
      {erroAcao ? <Erro texto={erroAcao} /> : null}
      {carregando && !dados ? <Carregando /> : null}

      <section className="card sec">
        <div className="sec__topo">
          <h2>Pessoas com acesso</h2>
          <span className="leve" style={{ fontSize: 13.5 }}>
            {dados?.length ?? 0} pessoas
          </span>
        </div>
        <div className="tabela">
          <table style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th scope="col" style={{ paddingLeft: 22 }}>Nome</th>
                <th scope="col">Perfil</th>
                <th scope="col">Acesso</th>
              </tr>
            </thead>
            <tbody>
              {(dados ?? []).map((p) => {
                const sou = p.id === eu?.id;
                return (
                  <tr key={p.id}>
                    <td style={{ paddingLeft: 22 }}>
                      <span className="forte">{p.nome}</span>
                      {sou ? <span className="leve"> (você)</span> : null}
                    </td>
                    <td>
                      <select
                        aria-label={`Perfil de ${p.nome}`}
                        value={p.perfil}
                        disabled={sou}
                        onChange={(e) => void mudar(p, { perfil: e.target.value as PerfilTipo })}
                        style={{ height: 40, padding: '0 12px', borderRadius: 10, border: '1.5px solid rgba(31,29,43,.2)', background: '#fff', fontSize: 14.5 }}
                      >
                        {(Object.keys(ROTULO_PERFIL) as PerfilTipo[]).map((k) => (
                          <option key={k} value={k}>
                            {ROTULO_PERFIL[k]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`selo selo--${p.ativo ? 'ok' : 'warn'} selo-btn`}
                        disabled={sou}
                        aria-label={`${p.ativo ? 'Bloquear' : 'Liberar'} o acesso de ${p.nome}`}
                        onClick={() => void mudar(p, { ativo: !p.ativo })}
                      >
                        {p.ativo ? 'Liberado' : 'Aguardando liberação'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="rodape-nota">
          Para dar acesso a alguém novo: crie o usuário no Supabase (Authentication, Users) e depois libere aqui. Você não
          pode alterar o seu próprio acesso.
        </p>
      </section>

      <section className="card sec">
        <h2>O que cada perfil pode fazer</h2>
        <div className="tabela" style={{ padding: '8px 0 4px' }}>
          <table style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th scope="col" style={{ paddingLeft: 22 }}>Permissão</th>
                <th scope="col">Coordenação</th>
                <th scope="col">Secretaria</th>
                <th scope="col">Professor</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSOES.map(([nome, c, s, p]) => (
                <tr key={nome}>
                  <td style={{ paddingLeft: 22 }}>{nome}</td>
                  <td><Selo tom={c ? 'ok' : 'nao'}>{sim(c)}</Selo></td>
                  <td><Selo tom={s ? 'ok' : 'nao'}>{sim(s)}</Selo></td>
                  <td><Selo tom={p ? 'ok' : 'nao'}>{sim(p)}</Selo></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
