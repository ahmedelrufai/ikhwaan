'use client';
import { useAdminWorkspace, date, Empty } from './admin-context';
import { ActionForm } from '@/components/action-feedback';
export default function WithdrawalsPage() {
    const { data, memberId, memberName, saveButton, submit } = useAdminWorkspace();
    return <><section className="panel">{data.withdrawals.map(w => <article className="record admin-record" key={w.id}><div><strong>{memberName(w.memberId)}</strong><p>{w.reason}</p><small>Eligible {date(w.eligibleAt)}</small><span className="badge">{w.status}</span></div>{w.status === 'Pending' && <ActionForm className="admin-inline-form" onSubmit={submit('withdrawal-review')}><input name="id" type="hidden" value={w.id}/><label>Decision<select name="decision"><option>Approved</option><option>Rejected</option></select></label><label>Review note<input name="note" required maxLength={2000}/></label>{saveButton}</ActionForm>}</article>)}{!data.withdrawals.length && <Empty/>}</section></>;
}
