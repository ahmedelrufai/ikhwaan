'use client';
import Link from 'next/link';
import { useAdminWorkspace } from './admin-context';
import LoanPolicySettings from '@/components/loan-policy-settings';
export default function LoanSettingsPage() {
    const { data, busy, mutate } = useAdminWorkspace();
    return <><Link className="member-back" href="/admin/loans">← Back to loans</Link><LoanPolicySettings emailStatus={data.loanEmailStatus} policy={data.loanPolicy} canManage={data.loanPolicyManager} actor={data.actor} members={data.members} officials={data.officials} exceptions={data.loanExceptions} busy={busy} onAction={mutate}/></>;
}
