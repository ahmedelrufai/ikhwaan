'use client';
import { useAdminWorkspace, date, Empty } from './admin-context';
import Link from 'next/link';
import { ActionButton } from '@/components/action-feedback';
export default function ElectionsPage() {
    const { data, busy, mutate } = useAdminWorkspace();
    return <><><div className="admin-page-actions"><Link className="button primary" href="/admin/elections/new">Schedule ballot</Link></div><section className="panel">{data.elections.map(e => <article className="record admin-record" key={e.id}><div><strong>{e.title}</strong><small>{date(e.startsAt)} – {date(e.endsAt)}</small><p>{e.candidates.map(c => c.name).join(' · ')}</p><span className="badge">{e.status}</span><small>{e.turnout} votes</small>{e.results.map(r => <p key={r.id}>{r.name}: {r.votes}</p>)}</div>{e.status === 'Scheduled' && <div className="admin-actions"><ActionButton className="button secondary" disabled={busy || new Date(e.endsAt) > new Date()} onAction={() => mutate({ action: 'election-publish', id: e.id })}>Publish results</ActionButton><ActionButton className="button danger" disabled={busy} onAction={() => mutate({ action: 'election-cancel', id: e.id })} confirm="Cancel this ballot?">Cancel ballot</ActionButton></div>}</article>)}{!data.elections.length && <Empty/>}</section></></>;
}
