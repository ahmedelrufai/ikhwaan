'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import type { repaymentDashboard } from '@/lib/repayment-dates';
import Pagination from './pagination';
import { paginate } from '@/lib/pagination';
type Snapshot = ReturnType<typeof repaymentDashboard>;
const money = (amount: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount / 100);
export default function RepaymentDashboard({ snapshot, members, compact = false, onMore }: { snapshot: Snapshot; members: { id: string; name: string }[]; compact?: boolean; onMore?: () => void }) {
    const router = useRouter();
    const [filter, setFilter] = useState('All'), [page, setPage] = useState(1), [pageSize, setPageSize] = useState(10);
    const rows = snapshot.rows.filter(r => filter === 'All' || r.status === filter);
    const result = paginate(rows, page, pageSize);
    const visible = compact ? snapshot.rows.slice(0, 5) : result.items;
    return <section className="panel repayment-dashboard"><div className="panel-heading"><h2>Repayment due dates</h2>{compact && <button className="activity-more" onClick={onMore}>View all →</button>}{!compact && <label className="repayment-filter"><span className="sr-only">Filter repayment dates</span><select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}>{['All', 'Overdue', 'Due today', 'Upcoming'].map(status => <option key={status}>{status}</option>)}</select></label>}</div><div className="repayment-due-summary">{[{ label: 'Overdue', amount: snapshot.overdue, className: 'overdue' }, { label: 'Due today', amount: snapshot.dueToday, className: 'today' }, { label: 'Next 7 days', amount: snapshot.upcoming, className: 'upcoming' }].map(s => <div key={s.label} className={s.className}><span>{s.label}</span><strong>{money(s.amount)}</strong></div>)}</div><div className="table-scroll"><table className="members-table"><thead><tr><th>Member / loan</th><th>Due date</th><th>Remaining due</th><th>Status</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>{visible.map(row => <tr key={row.loanId + row.installment} onClick={event => { if (!(event.target as HTMLElement).closest('a')) router.push('/admin/loans/' + encodeURIComponent(row.loanId)); }}><td><Link className="member-name-link" href={'/admin/loans/' + encodeURIComponent(row.loanId)}>{members.find(m => m.id === row.memberId)?.name || 'Member'}</Link><small>{row.reference} · Installment {row.installment}</small></td><td>{new Date(row.dueDate + 'T12:00:00+01:00').toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric' })}</td><td className="loan-amount">{money(row.outstanding)}</td><td><span className={'member-status due-' + row.status.toLowerCase().replace(/ /g, '-')}><i/>{row.status}</span></td><td><Link className="member-view-link" href={'/admin/loans/' + encodeURIComponent(row.loanId)}>View loan →</Link></td></tr>)}</tbody></table></div>{!visible.length && <div className="empty">{snapshot.rows.length ? 'No repayments match this filter.' : 'No unpaid scheduled repayments.'}</div>}{!compact && <Pagination {...result} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} label="Repayment pages"/>}</section>;
}
