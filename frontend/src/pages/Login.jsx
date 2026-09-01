import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext.jsx';

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Nao foi possivel entrar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-wrapper">
      <div className="card shadow-sm login-card">
        <div className="card-body p-4">
          <h1 className="h5 fw-semibold mb-1">Painel de Webhooks</h1>
          <p className="text-muted small mb-4">Entre para ver os webhooks da Axxon Pay.</p>

          {error && (
            <div className="alert alert-danger py-2 small" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label htmlFor="email" className="form-label small fw-medium">Email</label>
              <input
                id="email"
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
                autoFocus
              />
            </div>

            <div className="mb-4">
              <label htmlFor="password" className="form-label small fw-medium">Senha</label>
              <input
                id="password"
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button type="submit" className="btn btn-dark w-100" disabled={submitting}>
              {submitting ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
