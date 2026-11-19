'use client';
import Link from 'next/link';
import { useRouter } from 'nextjs-toploader/app';
import { ActionForm } from '@/components/action-feedback';
import { useMemberPortal } from './portal-context';
export default function AddBankAccountPage({ returnToLoan = false }: { returnToLoan?: boolean }) {
    const { member, busy, action } = useMemberPortal();
    const router = useRouter();
    const destination = returnToLoan ? '/portal/loans/new' : '/portal/bank-account';
    if (member.bankAccount) return <section className="panel portal-form-page"><h2>Your bank account is saved</h2><p>{member.bankAccount.bankName} · {member.bankAccount.accountNumber}</p><Link className="button primary" href={destination}>Continue</Link></section>;
    return <section className="panel portal-form-page"><Link className="text-button" href="/portal/bank-account">← Bank account</Link><h2>Add bank account</h2><p>Save your bank account once for future loan applications.</p><ActionForm onSubmit={async event => { event.preventDefault(); await action({ ...Object.fromEntries(new FormData(event.currentTarget)), action: 'bank-account' }, true); router.push(destination); }}><label>Bank name<input name="bankName" required minLength={2} maxLength={150}/></label><label>Account name<input name="accountName" required minLength={2} maxLength={150}/></label><label>Account number<input name="accountNumber" type="text" inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} placeholder="10-digit account number" required/></label><button className="button primary" disabled={busy}>{busy ? 'Saving…' : returnToLoan ? 'Save & continue to application' : 'Save bank account'}</button></ActionForm></section>;
}
