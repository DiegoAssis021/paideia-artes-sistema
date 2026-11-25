import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { iniciais } from '../lib/formatar';
import { Icone, type NomeIcone } from './Icone';
import { ROTULO_PERFIL } from '../lib/tipos';

const TITULOS: Record<string, string> = {
  chamada: 'Chamada',
  turmas: 'Turmas',
  calendario: 'Calendário',
  espetaculos: 'Espetáculos',
  alunos: 'Alunos',
  biblioteca: 'Biblioteca',
  usuarios: 'Usuários',
};

interface Item {
  caminho: string;
  rotulo: string;
  icone: NomeIcone;
}

export default function Layout() {
  const { perfil, eEquipe, eCoordenacao, sair } = useAuth();
  const { pathname } = useLocation();
  const principal = useRef<HTMLElement>(null);
  const primeira = useRef(true);

  // Ao trocar de tela: título da aba acompanha a tela e o foco vai ao conteúdo,
  // para o leitor de tela e o teclado perceberem a mudança.
  useEffect(() => {
    const nome = TITULOS[pathname.split('/')[1] ?? ''];
    document.title = nome ? `${nome} · Paideia Artes` : 'Sistema Paideia Artes';
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    principal.current?.focus({ preventScroll: true });
  }, [pathname]);

  const itens: Item[] = [];
  // Para o professor, a chamada vem primeiro (é o que ele usa no celular).
  if (!eEquipe) itens.push({ caminho: '/chamada', rotulo: 'Chamada', icone: 'phone' });
  itens.push({ caminho: '/turmas', rotulo: eEquipe ? 'Turmas' : 'Minhas turmas', icone: 'turmas' });
  itens.push({ caminho: '/calendario', rotulo: 'Calendário', icone: 'cal' });
  itens.push({ caminho: '/espetaculos', rotulo: 'Espetáculos', icone: 'palco' });
  if (eEquipe) itens.push({ caminho: '/alunos', rotulo: 'Alunos', icone: 'alunos' });
  if (eEquipe) itens.push({ caminho: '/biblioteca', rotulo: 'Biblioteca', icone: 'livro' });
  if (eCoordenacao) itens.push({ caminho: '/usuarios', rotulo: 'Usuários', icone: 'usuarios' });

  const botao = (i: Item) => (
    <NavLink key={i.caminho} to={i.caminho}>
      <Icone nome={i.icone} />
      {i.rotulo}
    </NavLink>
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
      <main ref={principal} tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
