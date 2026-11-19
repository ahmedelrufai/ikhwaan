'use client';
import { useMemberPortal, date } from './portal-context';
import { Megaphone } from 'lucide-react';
export default function AnnouncementsPage() {
    const { data } = useMemberPortal();
    return <><div className="announcements-list">{data.announcements.map(a => <article className="panel announcement-full" key={a.id}><span className="stat-icon green"><Megaphone size={22}/></span><div><span className="eyebrow">{a.category} · {date(a.createdAt)}</span><h2>{a.title}</h2><p>{a.body}</p></div></article>)}</div></>;
}
