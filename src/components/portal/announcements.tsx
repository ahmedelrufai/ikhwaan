'use client';
import { useMemberPortal, date } from './portal-context';
import { Megaphone } from 'lucide-react';
export default function AnnouncementsPage() {
    const { data } = useMemberPortal();
    return <><div className="announcements-list">{data.announcements.map(a => <article className="panel announcement-full" key={a.id}><span className="stat-icon green"><Megaphone size={22}/></span><div><span className="eyebrow">{a.category} · {date(a.createdAt)}</span><h2>{a.title}</h2><p>{a.body}</p></div></article>)}{!data.announcements.length && <section className="panel empty"><Megaphone size={25}/><h2>No announcements yet</h2><p>Updates from the cooperative will appear here.</p></section>}</div></>;
}
