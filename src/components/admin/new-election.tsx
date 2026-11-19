'use client';
import { useAdminWorkspace } from './admin-context';
import Link from 'next/link';
import { useRouter } from 'nextjs-toploader/app';
import { ActionForm } from '@/components/action-feedback';
export default function NewElectionPage() {
    const { saveButton, submit } = useAdminWorkspace();
    const router = useRouter();
    return <><Link className="member-back" href="/admin/elections">← Back to elections</Link><section className="panel admin-form-panel"><h2>Schedule ballot</h2><p className="admin-helper">Active members get one vote per ballot. Results publish after closing. Ties remain tied.</p><ActionForm className="admin-form" onSubmit={async event => { await submit('election')(event); router.push('/admin/elections'); }}><label className="full-width">Position / title<input name="title" required maxLength={150}/></label><label>Starts<input name="startsAt" type="datetime-local" required/></label><label>Ends<input name="endsAt" type="datetime-local" required/></label><label className="full-width">Candidates (one per line)<textarea name="candidates" rows={4} required/></label>{saveButton}</ActionForm></section></>;
}
