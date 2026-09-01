import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

// Aviso exibido enquanto a conta continuar com a senha padrao da plataforma.
export default function DefaultPasswordAlert() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  if (!user?.passwordIsDefault) return null;

  return (
    <div className="alert alert-warning d-flex flex-wrap align-items-center gap-2 py-2 small">
      <strong>Senha padrao em uso.</strong>
      <span className="flex-grow-1">
        Este painel esta acessivel pela internet — troque a senha para evitar acesso indevido.
      </span>
      {pathname !== '/configuracoes' && (
        <Link to="/configuracoes" className="btn btn-warning btn-sm fw-medium">
          Alterar agora
        </Link>
      )}
    </div>
  );
}
