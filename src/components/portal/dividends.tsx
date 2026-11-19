'use client';
import { useMemberPortal, money, date } from './portal-context';
export default function DividendsPage() {
    const { data, dividendTotal } = useMemberPortal();
    return <><section className="panel"><div className="panel-heading"><h2>Your allocations</h2><strong>{money(dividendTotal)}</strong></div>{data.dividends.map(d => <div className="record" key={d.id}><div><strong>{d.period}</strong><small>{date(d.createdAt)}</small></div><strong>{money(d.amount)}</strong></div>)}{!data.dividends.length && <div className="empty">No dividends declared yet.</div>}</section></>;
}
