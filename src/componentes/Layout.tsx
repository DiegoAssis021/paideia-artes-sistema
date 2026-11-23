import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { iniciais } from '../lib/formatar';
import { ROTULO_PERFIL } from '../lib/tipos';

const ICONES = {
  turmas: '<rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 10h18M9 4v16"></path>',
  alunos:
    '<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"></path><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.6.8 2.6 2.5 3 5.2"></path>',
  usuarios:
    '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z"></path><path d="M9 12l2 2 4-4"></path>',
} as const;

function Icone({ nome }: { nome: keyof typeof ICONES }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICONES[nome] }}
    />
  );
}

interface Item {
  caminho: string;
  rotulo: string;
  icone: keyof typeof ICONES;
}

export default function Layout() {
  const { perfil, eEquipe, eCoordenacao, sair } = useAuth();
  const { pathname } = useLocation();
  const ir = useNavigate();

  const itens: Item[] = [{ caminho: '/turmas', rotulo: eEquipe ? 'Turmas' : 'Minhas turmas', icone: 'turmas' }];
  if (eEquipe) itens.push({ caminho: '/alunos', rotulo: 'Alunos', icone: 'alunos' });
  if (eCoordenacao) itens.push({ caminho: '/usuarios', rotulo: 'Usuários', icone: 'usuarios' });

  return (
    <div className="app">
      <aside className="side">
        <img className="logo" src="/logo-branco.png" alt="Paideia Artes" />
        <nav className="nav" aria-label="Menu principal">
          <div className="nav__rotulo">GESTÃO</div>
          {itens.map((i) => (
            <button
              key={i.caminho}
              type="button"
              aria-current={pathname === i.caminho || pathname.startsWith(`${i.caminho}/`) ? 'page' : undefined}
              onClick={() => ir(i.caminho)}
            >
              <Icone nome={i.icone} />
              {i.rotulo}
            </button>
          ))}
        </nav>
        <div className="eu">
          <div className="av" aria-hidden="true">
            {iniciais(perfil?.nome ?? '?')}
          </div>
          <div>
            <b>{perfil?.nome}</b>
            <span>{perfil ? ROTULO_PERFIL[perfil.perfil] : ''}</span>
          </div>
        </div>
        <button type="button" className="sair" onClick={() => void sair()}>
          Sair
        </button>
      </aside>
      <main tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
