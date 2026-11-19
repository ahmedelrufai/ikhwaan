'use client';
import { useAdminWorkspace } from './admin-context';
import Link from 'next/link';
import LoanManagementDetails from '@/components/loan-management-details';
export default function LoanDetailsPage() {
    const { data, busy, memberId, selectedLoan, loans, mutate } = useAdminWorkspace();
    return <><><Link className="member-back" href="/admin/loans">← Back to loans</Link>{selectedLoan ? <LoanManagementDetails loan={selectedLoan} member={data.members.find(m => m.id === selectedLoan.memberId)} actor={data.actor} officials={data.officials} approvals={data.loanApprovals || []} repayments={data.loanRepayments || []} transactions={data.transactions} policy={data.loanPolicy} busy={busy} onAction={mutate}/> : <section className="panel empty">Loan not found.</section>}</></>;
}
