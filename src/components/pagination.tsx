'use client';
export default function Pagination({ page, pages, start, end, total, pageSize, onPageChange, onPageSizeChange, label }: {
    page: number; pages: number; start: number; end: number; total: number; pageSize: number;
    onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void; label: string;
}) {
    const first = Math.max(1, Math.min(page - 2, pages - 4));
    const numbers = Array.from({ length: Math.min(5, pages) }, (_, i) => first + i);
    return <div className="pagination"><div className="pagination-summary"><span>{start}–{end} of {total}</span><label>Rows<select value={pageSize} onChange={e => onPageSizeChange(Number(e.target.value))}>{[10, 25, 50].map(size => <option key={size}>{size}</option>)}</select></label></div><nav aria-label={label} className="pagination-controls"><button disabled={page === 1} onClick={() => onPageChange(page - 1)}>Previous</button>{first > 1 && <><button onClick={() => onPageChange(1)}>1</button>{first > 2 && <span>…</span>}</>}{numbers.map(number => <button key={number} aria-current={number === page ? 'page' : undefined} onClick={() => onPageChange(number)}>{number}</button>)}{numbers.at(-1)! < pages && <>{numbers.at(-1)! < pages - 1 && <span>…</span>}<button onClick={() => onPageChange(pages)}>{pages}</button></>}<button disabled={page === pages} onClick={() => onPageChange(page + 1)}>Next</button></nav></div>;
}
