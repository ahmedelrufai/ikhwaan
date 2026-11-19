'use client';
import Link from 'next/link';
import { useRouter } from 'nextjs-toploader/app';
import { ActionForm } from '@/components/action-feedback';
import { useMemberPortal } from './portal-context';
export default function WithdrawalPage() {
    const { data, member, busy, action } = useMemberPortal();
    const router = useRouter();
    const pending = data.withdrawals.some(notice => notice.status === 'Pending');
    return <section className="panel portal-form-page"><Link className="text-button" href="/portal/membership">← My membership</Link><h2>Membership withdrawal notice</h2><p>Withdrawal requires three calendar months’ notice, cleared loans, and administrator approval.</p>{pending ? <p>You already have a pending notice. Track it on your membership page.</p> : member.outstanding > 0 ? <p>Settle your outstanding loan before submitting a withdrawal notice.</p> : <ActionForm confirm="Submit your membership withdrawal notice?" onSubmit={async event => { event.preventDefault(); await action({ ...Object.fromEntries(new FormData(event.currentTarget)), action: 'withdraw' }, true); router.push('/portal/membership'); }}><label>Reason for withdrawal<textarea name="reason" required rows={4} maxLength={2000}/></label><button className="button primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit withdrawal notice'}</button></ActionForm>}</section>;
}
