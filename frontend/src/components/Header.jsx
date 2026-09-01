import { useAuth } from './AuthContext.jsx';

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar navbar-expand navbar-dark bg-dark shadow-sm">
      <div className="container-fluid px-3 px-lg-4">
        <span className="navbar-brand fw-semibold mb-0">
          Webhooks Axxon
          <span className="badge text-bg-secondary ms-2 fw-normal">proxy</span>
        </span>
        <div className="d-flex align-items-center gap-3 ms-auto">
          <span className="text-white-50 small d-none d-sm-inline">{user?.email}</span>
          <button type="button" className="btn btn-outline-light btn-sm" onClick={logout}>
            Sair
          </button>
        </div>
      </div>
    </nav>
  );
}
