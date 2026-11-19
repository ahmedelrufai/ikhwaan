import type { ApprovalCombination, Office, LoanPolicy } from './store.ts';
export const APPROVAL_COMBINATIONS: ApprovalCombination[] = ['A only', 'B only', 'Either A or B', 'A+B', 'All four'];
export const POLICY_LABELS: Record<ApprovalCombination, string> = { 'A only': 'One Signatory-A', 'B only': 'One Signatory-B', 'Either A or B': 'One Signatory-A or Signatory-B', 'A+B': 'One Signatory-A + one Signatory-B', 'All four': 'All four officials' };
export function eligibleSignatory(rule: ApprovalCombination, office?: Office) {
    if (!office) return false;
    const a = ['President', 'Secretary General'].includes(office);
    return rule === 'A only' ? a : rule === 'B only' ? !a : true;
}
export function signatureProgress(rule: ApprovalCombination, signatures: { office: Office }[]) {
    const offices = new Set(signatures.map(s => s.office));
    const a = offices.has('President') || offices.has('Secretary General');
    const b = offices.has('Treasurer') || offices.has('Financial Secretary');
    if (rule === 'All four') return ['President', 'Secretary General', 'Treasurer', 'Financial Secretary'].filter(o => !offices.has(o as Office)).join(', ') || 'Complete';
    if (rule === 'A only') return a ? 'Complete' : 'Awaiting A';
    if (rule === 'B only') return b ? 'Complete' : 'Awaiting B';
    if (rule === 'Either A or B') return a || b ? 'Complete' : 'Awaiting A or B';
    return a && b ? 'Complete' : a ? 'A approved; awaiting B' : b ? 'B approved; awaiting A' : 'Awaiting A and B';
}

export function policyOffices(policy: LoanPolicy | undefined, transfer = false) {
    return transfer ? policy?.disbursementOffices : policy?.approvalOffices;
}
export function policyEligible(policy: LoanPolicy | undefined, office?: Office, transfer = false) {
    if (!policy || !office) return false;
    const selected = policyOffices(policy, transfer);
    return selected ? selected.includes(office) : eligibleSignatory(transfer ? policy.disbursementCombination || policy.approvalCombination : policy.approvalCombination, office);
}
export function policyProgress(policy: LoanPolicy | undefined, signatures: { office: Office }[], transfer = false) {
    if (!policy) return 'Policy required';
    const selected = policyOffices(policy, transfer);
    if (!selected) return signatureProgress(transfer ? policy.disbursementCombination || policy.approvalCombination : policy.approvalCombination, signatures);
    const missing = selected.filter(office => !signatures.some(s => s.office === office));
    return !selected.length ? 'No officials selected' : missing.length ? 'Awaiting ' + missing.join(', ') : 'Complete';
}
export function policyLabel(policy: LoanPolicy | undefined, transfer = false) {
    if (!policy) return 'Not configured';
    const selected = policyOffices(policy, transfer);
    return selected ? selected.join(' + ') : POLICY_LABELS[transfer ? policy.disbursementCombination || policy.approvalCombination : policy.approvalCombination];
}

export function canManageLoanTerms(policy: LoanPolicy | undefined, office?: Office) {
    return policy?.approvalOffices ? policyEligible(policy, office) : office === 'Secretary General';
}
