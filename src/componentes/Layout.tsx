import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { iniciais } from '../lib/formatar';
import { Icone, type NomeIcone } from './Icone';
import { ROTULO_PERFIL } from '../lib/tipos';

interface Item {
  caminho: string;
  rotulo: string;
  icone: NomeIcone;
}

export default function Layout() {
  const { perfil, eEquipe, eCoordenacao, sair } = useAuth();
  const { pathname } = useLocation();
  const ir = useNavigate();

  const itens: Item[] = [];
  // Para o professor, a chamada vem primeiro (é o que ele usa no celular).
  if (!eEquipe) itens.push({ caminho: '/chamada', rotulo: 'Chamada', icone: 'phone' });
  itens.push({ caminho: '/turmas', rotulo: eEquipe ? 'Turmas' : 'Minhas turmas', icone: 'turmas' });
  itens.push({ caminho: '/calendario', rotulo: 'Calendário', icone: 'cal' });
  itens.push({ caminho: '/espetaculos', rotulo: 'Espetáculos', icone: 'palco' });
  if (eEquipe) itens.push({ caminho: '/alunos', rotulo: 'Alunos', icone: 'alunos' });
  if (eCoordenacao) itens.push({ caminho: '/usuarios', rotulo: 'Usuários', icone: 'usuarios' });

  const botao = (i: Item) => (
    <button
      key={i.caminho}
      type="button"
      aria-current={pathname === i.caminho || pathname.startsWith(`${i.caminho}/`) ? 'page' : undefined}
      onClick={() => ir(i.caminho)}
    >
      <Icone nome={i.icone} />
      {i.rotulo}
    </button>
  );

  return (
    <div className="app">
      <aside className="side">
        <img className="logo" src="/logo-branco.png" alt="Paideia Artes" />
        <nav className="nav" aria-label="Menu principal">
          <div className="nav__rotulo">GESTÃO</div>
          {itens.map(botao)}
          {eEquipe ? (
            <>
              <div className="nav__rotulo">Visão do professor</div>
              {botao({ caminho: '/chamada', rotulo: 'Chamada no celular', icone: 'phone' })}
            </>
          ) : null}
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
