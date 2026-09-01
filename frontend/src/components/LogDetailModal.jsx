import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatDate, pretty } from '../lib/format';

export default function LogDetailModal({ logId, onClose }) {
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    setLog(null);

    api
      .log(logId)
      .then((res) => alive && setLog(res.data))
      .catch((err) => alive && setError(err.message || 'Erro ao carregar o log'))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [logId]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
    };
  }, [onClose]);

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" onClick={onClose}>
        <div
          className="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title h6 mb-0">
                Webhook #{logId}
                {log && (
                  <span className={`badge ms-2 ${log.success ? 'text-bg-success' : 'text-bg-danger'}`}>
                    {log.success ? 'Reenviado' : 'Falhou'}
                  </span>
                )}
              </h2>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} />
            </div>

            <div className="modal-body">
              {loading && <p className="text-muted small mb-0">Carregando...</p>}
              {error && <div className="alert alert-danger py-2 small mb-0">{error}</div>}

              {log && (
                <>
                  <div className="row g-3 mb-3 small">
                    <div className="col-6 col-md-3">
                      <div className="detail-label">Recebido em</div>
                      <div>{formatDate(log.created_at)}</div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="detail-label">Reenviado em</div>
                      <div>{formatDate(log.forwarded_at)}</div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="detail-label">Gateway</div>
                      <div>{log.gateway}</div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="detail-label">IP de origem</div>
                      <div className="mono">{log.source_ip || '—'}</div>
                    </div>
                  </div>

                  <div className="row g-4">
                    {/* Recebido da Axxon */}
                    <div className="col-lg-6">
                      <h3 className="h6 fw-semibold border-bottom pb-2 mb-3">Recebido da Axxon</h3>

                      <div className="detail-label">received_body</div>
                      <pre className="json-block mb-3">{pretty(log.received_body)}</pre>

                      <div className="detail-label">received_headers</div>
                      <pre className="json-block">{pretty(log.received_headers)}</pre>
                    </div>

                    {/* Reenviado ao sistema */}
                    <div className="col-lg-6">
                      <h3 className="h6 fw-semibold border-bottom pb-2 mb-3">Reenviado ao sistema</h3>

                      <div className="detail-label">forwarded_url</div>
                      <p className="mono small text-break mb-3">{log.forwarded_url || '—'}</p>

                      <div className="detail-label">forwarded_status</div>
                      <p className="mb-3">
                        {log.forwarded_status ? (
                          <span
                            className={`badge ${
                              log.forwarded_status >= 200 && log.forwarded_status < 300
                                ? 'text-bg-success'
                                : 'text-bg-danger'
                            }`}
                          >
                            HTTP {log.forwarded_status}
                          </span>
                        ) : (
                          <span className="badge text-bg-secondary">sem resposta</span>
                        )}
                      </p>

                      <div className="detail-label">forwarded_response</div>
                      <pre className="json-block mb-3">{pretty(log.forwarded_response)}</pre>

                      <div className="detail-label">error</div>
                      {log.error ? (
                        <div className="alert alert-danger py-2 small mb-0 mono">{log.error}</div>
                      ) : (
                        <p className="text-muted small mb-0">Nenhum erro registrado.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
