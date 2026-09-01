export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  // Janela de no maximo 5 paginas ao redor da atual
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  const pages = [];
  for (let p = start; p <= end; p++) pages.push(p);

  return (
    <nav aria-label="Paginacao dos webhooks">
      <ul className="pagination pagination-sm mb-0">
        <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
          <button type="button" className="page-link" onClick={() => onChange(page - 1)} disabled={page <= 1}>
            Anterior
          </button>
        </li>

        {start > 1 && (
          <li className="page-item">
            <button type="button" className="page-link" onClick={() => onChange(1)}>1</button>
          </li>
        )}
        {start > 2 && <li className="page-item disabled"><span className="page-link">…</span></li>}

        {pages.map((p) => (
          <li key={p} className={`page-item ${p === page ? 'active' : ''}`}>
            <button type="button" className="page-link" onClick={() => onChange(p)}>{p}</button>
          </li>
        ))}

        {end < totalPages - 1 && <li className="page-item disabled"><span className="page-link">…</span></li>}
        {end < totalPages && (
          <li className="page-item">
            <button type="button" className="page-link" onClick={() => onChange(totalPages)}>{totalPages}</button>
          </li>
        )}

        <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
          <button
            type="button"
            className="page-link"
            onClick={() => onChange(page + 1)}
            disabled={page >= totalPages}
          >
            Proxima
          </button>
        </li>
      </ul>
    </nav>
  );
}
