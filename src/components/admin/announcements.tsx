'use client';
import { useAdminWorkspace, date, Empty } from './admin-context';
import Link from 'next/link';
import { ActionButton } from '@/components/action-feedback';
export default function AnnouncementsPage() {
    const { data, busy, mutate } = useAdminWorkspace();
    return <><><div className="admin-page-actions"><Link className="button primary" href="/admin/announcements/new">Publish announcement</Link></div><section className="panel">{data.announcements.map(a => <article className="record" key={a.id}><div><strong>{a.title}</strong><p>{a.body}</p><small>{date(a.createdAt)}</small></div><ActionButton className="button danger" disabled={busy} onAction={() => mutate({ action: 'announcement-delete', id: a.id })} confirm="Remove this announcement?">Remove</ActionButton></article>)}{!data.announcements.length && <Empty/>}</section></></>;
}
