'use client';
import { useMemberPortal } from './portal-context';
import Link from 'next/link';
export default function BankAccountPage() {
    const { member } = useMemberPortal();
    return <><section className="panel admin-form-panel"><h2>Bank account</h2>{member.bankAccount ? <dl className="loan-member-summary">{[['Bank', member.bankAccount.bankName], ['Account name', member.bankAccount.accountName], ['Account number', member.bankAccount.accountNumber]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <><p className="admin-helper">Save your account once to apply for loans.</p><Link className="button primary" href="/portal/bank-account/add">Add bank account</Link></>}</section></>;
}
