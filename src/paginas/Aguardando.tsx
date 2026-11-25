import { useAuth } from '../auth/AuthContext';

/** Tela para quem entrou mas ainda não foi liberado pela coordenação (ou perdeu o acesso). */
export default function Aguardando() {
  const { perfil, sair } = useAuth();
  return (
    <div className="entrada">
      <div className="card entrada__cartao">
        <img src="/logo-branco.webp" alt="Paideia Artes" className="entrada__logo" />
        <div>
          <h1>Acesso ainda não liberado</h1>
          <p className="leve" style={{ marginTop: 8 }}>
            {perfil
              ? 'Seu usuário existe, mas a coordenação ainda não liberou o acesso. Avise a coordenação e tente de novo.'
              : 'Não encontramos um perfil para este usuário. Avise a coordenação da escola.'}
          </p>
        </div>
        <button type="button" className="btn btn--ghost" onClick={() => void sair()}>
          Sair
        </button>
      </div>
    </div>
  );
}
