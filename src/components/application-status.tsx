'use client';
import { useEffect, useState } from 'react';
import { accountDestination } from '@/lib/access';
export default function ApplicationStatus({ status: initialStatus }: { status: string }) {
    const [status, setStatus] = useState(initialStatus);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    async function refresh() {
        try {
            const response = await fetch('/api/auth', { cache: 'no-store' });
            if (!response.ok) throw new Error('Unable to check status.');
            const { member } = await response.json();
            if (!member) { window.location.replace('/'); return; }
            if (accountDestination(member) !== '/application-status') { window.location.replace(accountDestination(member)); return; }
            setStatus(member.status); setError('');
        } catch { setError('Unable to check status. Try again.'); }
    }
    useEffect(() => {
        const check = () => void refresh();
        window.addEventListener('focus', check);
        const timer = setInterval(check, 30000);
        return () => { window.removeEventListener('focus', check); clearInterval(timer); };
    }, []);
    const pending = status === 'Pending review';
    return <main className="loading"><section className="panel application-status"><div className="brand">IKHWAAN</div><h1>{pending ? 'Awaiting approval' : status === 'Rejected' ? 'Application not approved' : 'Membership inactive'}</h1><p>{pending ? 'Your profile has been submitted to the administrator. You’ll be able to use the dashboard once it is approved.' : 'Contact the cooperative about your membership.'}</p><span className="badge">{status}</span>{error && <p role="alert" className="error">{error}</p>}<div className="admin-actions"><button className="button secondary" disabled={busy} onClick={async () => { setBusy(true); await refresh(); setBusy(false); }}>Check status</button><button className="button secondary" disabled={busy} onClick={async () => {
        setBusy(true);
        try {
            const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
            if (!response.ok) throw new Error();
            window.location.replace('/');
        } catch { setError('Unable to sign out. Try again.'); setBusy(false); }
    }}>Sign out</button></div></section></main>;
}
