'use client';
import { useAdminWorkspace, money, date, Empty } from './admin-context';
import Link from 'next/link';
export default function TransactionsPage() {
    const { data, memberName, matches } = useAdminWorkspace();
    const transactions = data.transactions.filter(t => matches(`${memberName(t.memberId)} ${t.description} ${t.reference || ''}`)).slice().reverse();
    return <><div className="admin-page-actions"><a className="button secondary" href="/api/admin?export=transactions">Export CSV</a><Link className="button primary" href="/admin/transactions/new">Record transaction</Link></div><section className="panel"><div className="table-scroll"><table><thead><tr><th>Member</th><th>Date</th><th>Type</th><th>Amount</th><th>Reference</th></tr></thead><tbody>{transactions.map(t => <tr key={t.id}><td>{memberName(t.memberId)}</td><td>{date(t.date)}</td><td>{t.type}<small>{t.description}</small></td><td>{money(t.amount)}</td><td>{t.reference || '—'}</td></tr>)}</tbody></table></div>{!transactions.length && <Empty/>}</section></>;
}
