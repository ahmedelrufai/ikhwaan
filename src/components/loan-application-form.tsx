'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { lagosDateKey } from '@/lib/repayment-dates';
import { loanRequestSchema } from '@/lib/loan-validation';
import type { Loan, Member, State } from '@/lib/store';
const money = (amount: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount / 100);
export default function LoanApplicationForm({ member, contributions, history, draft, documentRequired, onAction, error }: { member: Omit<Member, 'password'>; contributions: number; history: State['transactions']; draft: Loan | null; documentRequired: boolean; error: string; onAction: (payload: Record<string, unknown>) => Promise<boolean> }) {
    const requestController = useRef<AbortController | null>(null);
    useEffect(() => () => requestController.current?.abort(), []);
    const [sending, setSending] = useState(false);
    const [localError, setLocalError] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [documentId, setDocumentId] = useState(draft?.supportingDocumentId || '');
    async function save(form: HTMLFormElement, isDraft: boolean) {
        if (sending) return;
        const controller = new AbortController(); requestController.current = controller;
        setSending(true); setLocalError('');
        try {
            const fields: Record<string, unknown> = Object.fromEntries(new FormData(form));
            fields.declaration = fields.declaration === 'on';
            if (!isDraft) loanRequestSchema.validateSync(fields);
            let supportingDocumentId = documentId;
            if (file && !supportingDocumentId) {
                if (file.size > 5 * 1024 * 1024) throw new Error('Supporting document: maximum 5 MB.');
                const upload = new FormData(); upload.set('file', file);
                const response = await fetch('/api/loan-documents', { method: 'POST', body: upload, signal: controller.signal });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                supportingDocumentId = result.id; setDocumentId(result.id);
            }
            if (controller.signal.aborted) return;
            await onAction({ ...fields, id: draft?.id, supportingDocumentId, action: isDraft ? 'loan-draft' : 'loan' });
        } catch (e) { if (!controller.signal.aborted) setLocalError(e instanceof Error ? e.message : 'Unable to save.'); }
        finally { if (!controller.signal.aborted) setSending(false); }
    }
    function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void save(event.currentTarget, false); }
    return <form onSubmit={submit}><h2>{draft ? 'Continue loan application' : 'Apply for emergency loan'}</h2><div className="loan-journey-note"><strong>How your application works</strong><ol><li>Submit your request for review.</li><li>Review the approved amount, interest and payment dates.</li><li>Accept the offer before the cooperative verifies your bank transfer.</li></ol><p>You can save a draft and finish later.</p></div><fieldset className="registration-section"><legend>Member information</legend><dl className="loan-member-summary">{[['Name', member.name], ['Membership no.', member.number], ['Phone', member.phone], ['Email', member.email], ['Status', member.status], ['Contributions', money(contributions)], ['Outstanding loan', money(member.outstanding)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><details className="loan-terms-details"><summary>Contribution history</summary>{history.filter(t => t.type === 'Contribution').slice().reverse().map(t => <div className="loan-history-item" key={t.id}><strong>{money(t.amount)}</strong><small>{new Date(t.date).toLocaleDateString('en-GB')} · {t.description}</small></div>)}{!history.some(t => t.type === 'Contribution') && <p className="form-hint">No contributions recorded.</p>}</details></fieldset><fieldset className="registration-section"><legend>Loan request</legend><label>Requested amount (NGN)<input name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" defaultValue={draft?.amount ? draft.amount / 100 : ''} required/></label><label>Reason for loan<textarea name="reason" rows={3} maxLength={2000} defaultValue={draft?.reason} required/></label><label>When could you start repaying?<input name="proposedRepaymentDate" type="date" min={lagosDateKey()} defaultValue={draft?.proposedRepaymentDate || ''} required/><small className="form-hint">Your preferred date. The final schedule will be shown in your offer.</small></label><label>Supporting document {documentRequired ? '' : '(optional)'}<input name="document" type="file" accept="application/pdf,image/png,image/jpeg" required={documentRequired && !documentId} onChange={e => { setFile(e.target.files?.[0] || null); setDocumentId(''); }}/></label><small className="form-hint">PDF, PNG or JPEG · Maximum 5 MB</small>{documentId && <a className="text-button" target="_blank" rel="noopener noreferrer" href={'/api/loan-documents?id=' + encodeURIComponent(documentId)}>Saved document</a>}</fieldset><div className="saved-account-summary"><strong>Disbursement account · {member.bankAccount?.bankName}</strong><span>{member.bankAccount?.accountName} · {member.bankAccount?.accountNumber}</span></div><label className="declaration-check"><input type="checkbox" name="declaration" required/><span>I confirm this information is accurate, understand this request is subject to approval. I will review and accept the final repayment offer separately.</span></label>{(localError || error) && <p className="error" role="alert">{localError || error}</p>}<div className="admin-actions"><button className="button secondary" type="button" disabled={sending} onClick={e => { const form = e.currentTarget.form; if (form) void save(form, true); }}>Save draft</button><button className="button primary" disabled={sending}>{sending ? 'Saving…' : 'Submit application'}</button></div></form>;
}
