'use client';
import { useAdminWorkspace } from './admin-context';
import Link from 'next/link';
import { useRouter } from 'nextjs-toploader/app';
import { ActionForm } from '@/components/action-feedback';
export default function NewTransactionPage() {
    const { selectMember, saveButton, submit } = useAdminWorkspace();
    const router = useRouter();
    return <><Link className="member-back" href="/admin/transactions">← Back to transactions</Link><section className="panel admin-form-panel"><h2>Record transaction</h2><ActionForm className="admin-form" onSubmit={async event => { await submit('transaction')(event); router.push('/admin/transactions'); }}>{selectMember}<label>Type<select name="type" required><option>Savings</option><option>Contribution</option></select></label><label>Amount (NGN)<input name="amount" type="number" min="0.01" step="0.01" required/></label><label>Reference<input name="reference" maxLength={100} required/></label><label className="full-width">Description<input name="description" maxLength={500} required/></label>{saveButton}</ActionForm></section></>;
}
