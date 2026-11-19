'use client';
import { useAdminWorkspace, money, Empty } from './admin-context';
import Link from 'next/link';
export default function DividendsPage() {
    const { data, memberId, memberName } = useAdminWorkspace();
    return <><><div className="admin-page-actions"><Link className="button primary" href="/admin/dividends/new">Allocate dividend</Link></div><section className="panel">{data.dividends.map(d => <div className="record" key={d.id}><div><strong>{memberName(d.memberId)}</strong><small>{d.period}</small></div><strong>{money(d.amount)}</strong></div>)}{!data.dividends.length && <Empty/>}</section></></>;
}
