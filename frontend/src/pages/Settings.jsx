import { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header.jsx';
import DefaultPasswordAlert from '../components/DefaultPasswordAlert.jsx';
import { useAuth } from '../components/AuthContext.jsx';
import { api } from '../lib/api';

export default function Settings() {
  const { user, setUser } = useAuth();

  // --- troca de senha ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState(null); // { type, text }
  const [pwdSaving, setPwdSaving] = useState(false);

  // --- troca de usuario ---
  const [newEmail, setNewEmail] = useState(user?.email || '');
  const [accountPassword, setAccountPassword] = useState('');
  const [accMsg, setAccMsg] = useState(null);
  const [accSaving, setAccSaving] = useState(false);

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPwdMsg(null);

    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'danger', text: 'A confirmacao nao confere com a nova senha.' });
      return;
    }
    if (newPassword.length < 8) {
      setPwdMsg({ type: 'danger', text: 'A nova senha precisa ter pelo menos 8 caracteres.' });
      return;
    }

    setPwdSaving(true);
    try {
      const res = await api.changePassword(currentPassword, newPassword);
      setUser(res.user);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwdMsg({ type: 'success', text: 'Senha alterada com sucesso.' });
    } catch (err) {
      setPwdMsg({ type: 'danger', text: err.message || 'Nao foi possivel alterar a senha.' });
    } finally {
      setPwdSaving(false);
    }
  }

  async function handleAccountSubmit(e) {
    e.preventDefault();
    setAccMsg(null);
    setAccSaving(true);
    try {
      const res = await api.changeAccount(newEmail.trim(), accountPassword);
      setUser(res.user);
      setAccountPassword('');
      setAccMsg({ type: 'success', text: 'Usuario alterado com sucesso.' });
    } catch (err) {
      setAccMsg({ type: 'danger', text: err.message || 'Nao foi possivel alterar o usuario.' });
    } finally {
      setAccSaving(false);
    }
  }

  return (
    <>
      <Header />

      <main className="container py-4" style={{ maxWidth: 820 }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h1 className="h5 fw-semibold mb-1">Configuracoes</h1>
            <p className="text-muted small mb-0">Credenciais de acesso ao painel.</p>
          </div>
          <Link to="/" className="btn btn-outline-secondary btn-sm">Voltar</Link>
        </div>

        <DefaultPasswordAlert />

        {/* Alterar senha */}
        <section className="card shadow-sm mb-4">
          <div className="card-header bg-white py-3">
            <h2 className="h6 fw-semibold mb-0">Alterar senha</h2>
          </div>
          <div className="card-body">
            {pwdMsg && <div className={`alert alert-${pwdMsg.type} py-2 small`}>{pwdMsg.text}</div>}

            <form onSubmit={handlePasswordSubmit}>
              <div className="row g-3">
                <div className="col-12 col-md-4">
                  <label htmlFor="currentPassword" className="form-label small fw-medium">Senha atual</label>
                  <input
                    id="currentPassword"
                    type="password"
                    className="form-control"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div className="col-12 col-md-4">
                  <label htmlFor="newPassword" className="form-label small fw-medium">Nova senha</label>
                  <input
                    id="newPassword"
                    type="password"
                    className="form-control"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <div className="form-text">Minimo de 8 caracteres.</div>
                </div>
                <div className="col-12 col-md-4">
                  <label htmlFor="confirmPassword" className="form-label small fw-medium">Confirmar nova senha</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    className="form-control"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-dark btn-sm mt-3" disabled={pwdSaving}>
                {pwdSaving ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          </div>
        </section>

        {/* Alterar usuario */}
        <section className="card shadow-sm">
          <div className="card-header bg-white py-3">
            <h2 className="h6 fw-semibold mb-0">Alterar usuario</h2>
          </div>
          <div className="card-body">
            {accMsg && <div className={`alert alert-${accMsg.type} py-2 small`}>{accMsg.text}</div>}

            <form onSubmit={handleAccountSubmit}>
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label htmlFor="newEmail" className="form-label small fw-medium">Usuario ou email</label>
                  <input
                    id="newEmail"
                    type="text"
                    className="form-control"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    autoComplete="username"
                    minLength={3}
                    required
                  />
                  <div className="form-text">E o identificador usado no login.</div>
                </div>
                <div className="col-12 col-md-6">
                  <label htmlFor="accountPassword" className="form-label small fw-medium">Senha atual</label>
                  <input
                    id="accountPassword"
                    type="password"
                    className="form-control"
                    value={accountPassword}
                    onChange={(e) => setAccountPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <div className="form-text">Confirma que e voce quem esta alterando.</div>
                </div>
              </div>

              <button type="submit" className="btn btn-dark btn-sm mt-3" disabled={accSaving}>
                {accSaving ? 'Salvando...' : 'Salvar usuario'}
              </button>
            </form>
          </div>
        </section>
      </main>
    </>
  );
}
