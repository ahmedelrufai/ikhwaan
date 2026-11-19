'use client';
import { useAdminWorkspace } from './admin-context';
import Link from 'next/link';
import { useRouter } from 'nextjs-toploader/app';
import { ActionForm } from '@/components/action-feedback';
export default function NewDividendPage() {
    const { selectMember, saveButton, submit } = useAdminWorkspace();
    const router = useRouter();
    return <><Link className="member-back" href="/admin/dividends">← Back to dividends</Link><section className="panel admin-form-panel"><h2>Allocate dividend</h2><p className="admin-helper">Enter the committee-approved amount for each member.</p><ActionForm className="admin-form" onSubmit={async event => { await submit('dividend')(event); router.push('/admin/dividends'); }}>{selectMember}<label>Period<input name="period" required maxLength={80} placeholder="2026"/></label><label>Amount (NGN)<input name="amount" type="number" min="0.01" step="0.01" required/></label>{saveButton}</ActionForm></section></>;
}
