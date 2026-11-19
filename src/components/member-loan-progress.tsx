import type { Loan } from '@/lib/store';
export default function MemberLoanProgress({ loan }: { loan: Loan & { queueClosed?: boolean } }) {
    const funded = ['Disbursed', 'Repaying', 'Completed', 'Repaid'].includes(loan.status);
    const closed = ['Cancelled', 'Rejected'].includes(loan.status);
    const step = loan.status === 'Draft' ? 0 : ['Pending', 'Under Review'].includes(loan.status) ? 1 : loan.status === 'Approved' ? 2 : funded ? 4 : loan.termsAcceptedAt ? 3 : 2;
    const message = loan.queueClosed ? 'This application’s calendar-year queue has closed. Contact the Secretary General to request renewal.'
        : loan.status === 'Draft' ? 'Finish your request and submit it when you are ready.'
        : ['Pending', 'Under Review'].includes(loan.status) ? 'Your request is with the cooperative. No action is needed from you yet.'
        : loan.status === 'Approved' ? 'Your request is approved. The cooperative is preparing your repayment offer.'
        : loan.status === 'Awaiting Disbursement' ? !loan.termsAcceptedAt ? 'Your next step: review the offer below, then accept or decline it.' : loan.pendingDisbursement ? 'Your bank transfer is being verified. No further action is needed from you.' : 'You accepted the offer. The cooperative will arrange and verify your bank transfer.'
        : ['Completed', 'Repaid'].includes(loan.status) ? 'Your loan is fully repaid. Your records remain available below.'
        : funded ? 'Follow the payment dates below. The cooperative records each repayment against your loan.'
        : loan.status === 'Rejected' ? 'Your request was declined. Read the decision below or contact the cooperative with your reference.' : 'This application is closed. Its history remains available below.';
    return <div className="loan-journey-note"><p>{message}</p>{!closed && !loan.queueClosed && <ol className="loan-member-progress" aria-label="Application progress">{['Apply', 'Review', 'Your offer', 'Bank transfer', 'Repay'].map((label, index) => <li key={label} className={index < step ? 'done' : index === step ? 'current' : ''} aria-current={index === step ? 'step' : undefined}><span>{index < step ? '✓' : index + 1}</span>{label}</li>)}</ol>}</div>;
}
