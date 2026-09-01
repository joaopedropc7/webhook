import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import Pagination from '../components/Pagination.jsx';
import LogDetailModal from '../components/LogDetailModal.jsx';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';

const LIMIT_OPTIONS = [10, 20, 50, 100];

export default function Dashboard() {
  const navigate = useNavigate();

  // Estado da consulta. Trocar filtro volta para a pagina 1;
  // trocar de pagina mantem os filtros.
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [successFilter, setSuccessFilter] = useState(''); // '' | 'true' | 'false'
  const [search, setSearch] = useState('');       // valor digitado
  const [appliedSearch, setAppliedSearch] = useState(''); // valor efetivamente aplicado

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.logs({ page, limit, success: successFilter, q: appliedSearch });
      setLogs(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      // se a pagina atual ficou fora do intervalo (ex.: apos filtrar), corrige
      if (res.page > res.totalPages) setPage(res.totalPages);
    } catch (err) {
      if (err.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      setError(err.message || 'Erro ao carregar os webhooks');
      setLogs([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, limit, successFilter, appliedSearch, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  // Qualquer mudanca de filtro reinicia a paginacao
  function changeFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    changeFilter(setAppliedSearch, search.trim());
  }

  function clearFilters() {
    setSearch('');
    setAppliedSearch('');
    setSuccessFilter('');
    setPage(1);
  }

  const hasFilters = successFilter !== '' || appliedSearch !== '';

  return (
    <>
      <Header />

      <main className="container-fluid px-3 px-lg-4 py-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <div>
            <h1 className="h5 fw-semibold mb-1">Webhooks recebidos</h1>
            <p className="text-muted small mb-0">
              {loading ? 'Carregando...' : `${total} registro${total === 1 ? '' : 's'} encontrado${total === 1 ? '' : 's'}`}
            </p>
          </div>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={load} disabled={loading}>
            Atualizar
          </button>
        </div>

        {/* Filtros */}
        <div className="card shadow-sm mb-3">
          <div className="card-body py-3">
            <form className="row g-2 align-items-end" onSubmit={handleSearchSubmit}>
              <div className="col-12 col-md-5">
                <label htmlFor="q" className="form-label small fw-medium mb-1">Buscar no conteudo recebido</label>
                <input
                  id="q"
                  type="search"
                  className="form-control form-control-sm"
                  placeholder="ex.: transactionId, email, status..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="col-6 col-md-3">
                <label htmlFor="success" className="form-label small fw-medium mb-1">Status do reenvio</label>
                <select
                  id="success"
                  className="form-select form-select-sm"
                  value={successFilter}
                  onChange={(e) => changeFilter(setSuccessFilter, e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="true">Somente sucesso</option>
                  <option value="false">Somente erro</option>
                </select>
              </div>

              <div className="col-6 col-md-2">
                <label htmlFor="limit" className="form-label small fw-medium mb-1">Por pagina</label>
                <select
                  id="limit"
                  className="form-select form-select-sm"
                  value={limit}
                  onChange={(e) => changeFilter(setLimit, Number(e.target.value))}
                >
                  {LIMIT_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-md-2 d-flex gap-2">
                <button type="submit" className="btn btn-dark btn-sm flex-fill">Filtrar</button>
                {hasFilters && (
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={clearFilters}>
                    Limpar
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        {/* Tabela */}
        <div className="card shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover table-sm align-middle mb-0 table-logs">
              <thead className="table-light">
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Data/hora</th>
                  <th scope="col">Gateway</th>
                  <th scope="col">Reenvio</th>
                  <th scope="col">HTTP</th>
                  <th scope="col" className="d-none d-lg-table-cell">Destino</th>
                  <th scope="col" className="text-end">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">Carregando...</td>
                  </tr>
                )}

                {!loading && logs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      Nenhum webhook encontrado.
                    </td>
                  </tr>
                )}

                {!loading &&
                  logs.map((row) => (
                    <tr key={row.id}>
                      <td className="text-muted mono">{row.id}</td>
                      <td>{formatDate(row.created_at)}</td>
                      <td><span className="badge text-bg-light border">{row.gateway}</span></td>
                      <td>
                        <span className={`badge ${row.success ? 'text-bg-success' : 'text-bg-danger'}`}>
                          {row.success ? 'Sucesso' : 'Erro'}
                        </span>
                      </td>
                      <td className="mono">
                        {row.forwarded_status ? row.forwarded_status : <span className="text-muted">—</span>}
                      </td>
                      <td className="d-none d-lg-table-cell text-muted small text-truncate" style={{ maxWidth: 320 }}>
                        {row.forwarded_url || '—'}
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-outline-dark btn-sm"
                          onClick={() => setSelectedId(row.id)}
                        >
                          Ver detalhes
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="card-footer bg-white d-flex flex-wrap align-items-center justify-content-between gap-2 py-2">
            <span className="text-muted small">
              Pagina {page} de {totalPages}
            </span>
            <Pagination page={page} totalPages={totalPages} onChange={(p) => setPage(p)} />
          </div>
        </div>
      </main>

      {selectedId !== null && (
        <LogDetailModal logId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </>
  );
}
