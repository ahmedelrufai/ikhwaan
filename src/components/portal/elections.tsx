'use client';
import { useMemberPortal, date } from './portal-context';
import { Vote } from 'lucide-react';
import { ActionForm } from '@/components/action-feedback';
export default function ElectionsPage() {
    const { data, member, busy, action } = useMemberPortal();
    return <><>{data.elections.map(e => {
        const open = e.status === 'Scheduled' && new Date() >= new Date(e.startsAt) && new Date() < new Date(e.endsAt);
        return <section className="panel admin-form-panel" key={e.id}><h2>{e.title}</h2><p className="admin-helper">{date(e.startsAt)} – {date(e.endsAt)}</p><span className="badge">{e.status === 'Cancelled' ? 'Cancelled' : e.status === 'Published' ? 'Results' : e.hasVoted ? 'Vote recorded' : open ? 'Voting open' : new Date() < new Date(e.startsAt) ? 'Scheduled' : 'Awaiting results'}</span>{e.results.map(r => <div className="record" key={r.id}><strong>{r.name}</strong><span>{r.votes} votes</span></div>)}{open && !e.hasVoted && member.status === 'Active' && <ActionForm confirm="Submit your vote? It cannot be changed." onSubmit={async event => { event.preventDefault(); const candidateId = new FormData(event.currentTarget).get('candidateId'); await action({ action: 'vote', electionId: e.id, candidateId }, true); }}>{e.candidates.map(c => <label className="ballot-choice" key={c.id}><input type="radio" name="candidateId" value={c.id} required/>{c.name}</label>)}<button className="button primary" disabled={busy}>Submit vote</button></ActionForm>}</section>;
    })}{!data.elections.length && <section className="panel empty">No elections scheduled.</section>}</></>;
}
