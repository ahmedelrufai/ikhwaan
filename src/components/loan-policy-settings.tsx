'use client';
import { UserPlus, X, ShieldCheck } from 'lucide-react';
import { ActionForm } from '@/components/action-feedback';
import { useRef, useState, type FormEvent } from 'react';
import type { LoanPolicy, Member, State } from '@/lib/store';
import { policyEligible, policyLabel } from '@/lib/loan-policy';
import { OFFICES } from '@/lib/loan-validation';
type PublicMember = Omit<Member, 'password'>;
export default function LoanPolicySettings({ emailStatus, policy, canManage, actor, members, officials, exceptions, busy, onAction }: {
    emailStatus?: { configured: boolean; pending: number; failed: number; sent: number }; policy?: LoanPolicy; canManage: boolean; actor: PublicMember; members: PublicMember[]; officials: PublicMember[]; exceptions: State['loanExceptions']; busy: boolean; onAction: (input: Record<string, unknown>) => Promise<void>;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [assignError, setAssignError] = useState('');
    function submit(action: string) { return async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); const data = new FormData(event.currentTarget);
        const fields: Record<string, unknown> = Object.fromEntries(data);
        if (action === 'loan-policy') {
            fields.documentRequired = data.has('documentRequired');
            fields.approvalOffices = data.getAll('approvalOffices');
            fields.disbursementOffices = data.getAll('disbursementOffices');
        }
        await onAction({ ...fields, action });
    }; }
    async function assign(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); setAssignError('');
        try { await onAction({ ...Object.fromEntries(new FormData(event.currentTarget)), action: 'loan-office' }); dialog.current?.close(); }
        catch (error) { setAssignError((error as Error).message); }
    }
    return <>{canManage && emailStatus && <section className="panel admin-form-panel"><h2>Loan email notifications</h2><p className="admin-helper">{emailStatus.configured ? 'Email is configured. Responsible officials and members receive a link when their action is needed.' : 'Email setup is incomplete. Loan actions are saved and notifications stay queued until the sender is configured.'}</p><p>{emailStatus.pending} queued · {emailStatus.sent} accepted by email provider{emailStatus.failed > 0 ? ` · ${emailStatus.failed} need delivery attention` : ''}</p></section>}<section className="panel admin-form-panel officials-panel"><div className="officials-heading"><div><span className="officials-eyebrow">PEOPLE & PERMISSIONS</span><h2>Cooperative officials</h2><p>Manage office holders and approval responsibilities.</p></div>{canManage && <button className="button secondary" type="button" onClick={() => { setAssignError(''); dialog.current?.showModal(); }}><UserPlus size={16}/>Assign position</button>}</div>
    <ActionForm className="officials-policy-form" onSubmit={submit('loan-policy')} key={policy?.configuredAt || 'unconfigured'}>
    <p className="form-hint">Select the officials required to approve loans and verify transfers. Every checked office must approve its stage. Changes apply to new applications.</p>
    {policy && !policy.approvalOffices && <p className="form-hint">Current rule: {policyLabel(policy)}. Transfer rule: {policyLabel(policy, true)}. Eligible offices are checked below; adjust the selections before saving. Saving requires every checked office.</p>}
    <div className="table-scroll"><table className="members-table"><thead><tr><th>Office</th><th>Signatory group</th><th>Official</th><th>Loan approval</th><th>Transfer approval</th></tr></thead><tbody>{OFFICES.map(office => {
        const official = officials.find(m => m.office === office);
        return <tr key={office}><td>{office}</td><td><span className="officials-group">{['President', 'Secretary General'].includes(office) ? 'A' : 'B'}</span></td><td><span className={official ? 'officials-person' : 'officials-unassigned'}>{official?.name || 'Not assigned'}</span></td><td><input type="checkbox" name="approvalOffices" value={office} aria-label={office + ' loan approval'} defaultChecked={policyEligible(policy, office)} disabled={!canManage}/></td><td><input type="checkbox" name="disbursementOffices" value={office} aria-label={office + ' transfer approval'} defaultChecked={policyEligible(policy, office, true)} disabled={!canManage}/></td></tr>;
    })}</tbody></table></div>
    {canManage && <><label className="declaration-check"><input type="checkbox" name="documentRequired" defaultChecked={policy?.documentRequired}/>Require a supporting document</label><button className="button primary" disabled={busy}>Save approval settings</button></>}
    </ActionForm></section>
    {canManage && <dialog ref={dialog} className="position-dialog" aria-labelledby="assign-position-title" aria-describedby="assign-position-description" onCancel={event => { if (busy) event.preventDefault(); }}><form className="position-form" onSubmit={assign}><header className="position-header"><span className="position-icon"><UserPlus size={21}/></span><button type="button" className="position-close" aria-label="Close assign position" disabled={busy} onClick={() => dialog.current?.close()}><X size={19}/></button><h2 id="assign-position-title">Assign position</h2><p id="assign-position-description">Choose an account and the office they will hold.</p></header><div className="position-fields"><label>Account<select name="memberId" defaultValue="" required><option value="" disabled>Select active account</option>{[...new Map([...officials, ...members].map(m => [m.id, m])).values()].filter(m => m.status === 'Active').map(m => <option key={m.id} value={m.id}>{m.name} · {m.email}</option>)}</select></label><label>Office<select name="office" defaultValue="" required><option value="" disabled>Select position</option>{OFFICES.map(office => <option key={office}>{office}</option>)}<option value="None">Remove office</option></select></label><div className="position-groups"><ShieldCheck size={17}/><div><strong>Signatory groups are assigned automatically</strong><p><b>A</b> President · Secretary General</p><p><b>B</b> Treasurer · Financial Secretary</p></div></div>{assignError && <p className="error" role="alert">{assignError}</p>}</div><footer className="position-footer"><button className="button secondary" type="button" disabled={busy} onClick={() => dialog.current?.close()}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Assigning…' : 'Assign position'}</button></footer></form></dialog>}
    <section className="panel admin-form-panel"><h2>Outstanding-loan exceptions</h2><p className="admin-helper">An exception requires the selected loan approval officials and applies to one new application.</p>{actor.office && <ActionForm className="admin-form" onSubmit={submit('loan-exception')}><label>Member<select name="memberId" defaultValue="" required><option value="" disabled>Select member</option>{members.filter(m => m.status === 'Active' && m.outstanding > 0).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Authorisation reason<textarea name="note" maxLength={2000} required/></label><button className="button secondary" disabled={busy}>Record authorisation</button></ActionForm>}{exceptions?.map(e => <div className="record" key={e.id}><div><strong>{members.find(m => m.id === e.memberId)?.name || 'Member'}</strong><p>{e.note}</p><small>{e.signatures?.map(s => s.office).join(' · ') || 'No signatories'} · {e.usedByLoanId ? 'Used' : 'Awaiting use'}</small></div></div>)}</section></>;
}
