import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Campo, Erro } from '../componentes/pecas';
import { erroDeConfiguracao } from '../lib/supabase';

export default function Login() {
  const { sessao, entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (sessao) return <Navigate to="/" replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(await entrar(email, senha));
    setEnviando(false);
  }

  return (
    <div className="entrada">
      <form className="card entrada__cartao" onSubmit={enviar}>
        <img src="/logo-branco.webp" alt="Paideia Artes" className="entrada__logo" />
        <div>
          <h1>Entrar</h1>
          <p className="leve">Sistema de gestão da escola</p>
        </div>
        {erroDeConfiguracao ? <Erro texto={erroDeConfiguracao} /> : null}
        <Campo rotulo="E-mail">
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>
        <Campo rotulo="Senha">
          <input
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </Campo>
        {erro ? <Erro texto={erro} /> : null}
        <button className="btn" type="submit" disabled={enviando || Boolean(erroDeConfiguracao)}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>
        <p className="leve entrada__nota">
          Não tem acesso? Peça à coordenação da escola para criar o seu usuário.
        </p>
      </form>
    </div>
  );
}
