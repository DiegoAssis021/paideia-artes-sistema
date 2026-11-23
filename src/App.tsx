import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import Layout from './componentes/Layout';
import { Carregando } from './componentes/pecas';
import Aguardando from './paginas/Aguardando';
import AlunoFicha from './paginas/AlunoFicha';
import AlunoForm from './paginas/AlunoForm';
import Alunos from './paginas/Alunos';
import Login from './paginas/Login';
import TurmaDetalhe from './paginas/TurmaDetalhe';
import TurmaForm from './paginas/TurmaForm';
import Turmas from './paginas/Turmas';
import Usuarios from './paginas/Usuarios';

/** Exige usuário logado e liberado (perfil ativo). */
function Protegida() {
  const { carregando, sessao, perfil } = useAuth();
  if (carregando) return <Carregando />;
  if (!sessao) return <Navigate to="/entrar" replace />;
  if (!perfil?.ativo) return <Aguardando />;
  return <Layout />;
}

function SoEquipe() {
  const { eEquipe } = useAuth();
  return eEquipe ? <Outlet /> : <Navigate to="/turmas" replace />;
}

function SoCoordenacao() {
  const { eCoordenacao } = useAuth();
  return eCoordenacao ? <Outlet /> : <Navigate to="/turmas" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<Login />} />
      <Route element={<Protegida />}>
        <Route path="/" element={<Navigate to="/turmas" replace />} />
        <Route path="/turmas" element={<Turmas />} />
        <Route path="/turmas/:id" element={<TurmaDetalhe />} />
        <Route element={<SoEquipe />}>
          <Route path="/turmas/nova" element={<TurmaForm />} />
          <Route path="/turmas/:id/editar" element={<TurmaForm />} />
          <Route path="/alunos" element={<Alunos />} />
          <Route path="/alunos/novo" element={<AlunoForm />} />
          <Route path="/alunos/:id" element={<AlunoFicha />} />
          <Route path="/alunos/:id/editar" element={<AlunoForm />} />
        </Route>
        <Route element={<SoCoordenacao />}>
          <Route path="/usuarios" element={<Usuarios />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/turmas" replace />} />
    </Routes>
  );
}
