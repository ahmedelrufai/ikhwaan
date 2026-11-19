import type { LoanTerms } from '@/lib/store';
const money = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(value / 100);
export default function LoanOfferSummary({ terms }: { terms: LoanTerms }) {
    const amounts = terms.installments.map(i => i.amount);
    const minimum = Math.min(...amounts), maximum = Math.max(...amounts);
    return <dl className="loan-offer-summary"><div><dt>Approved amount</dt><dd>{money(terms.approvedAmount)}</dd></div><div><dt>Interest (one-time {terms.interestRate || 0}%)</dt><dd>{money(terms.interestAmount || 0)}</dd></div><div><dt>First due date</dt><dd>{terms.installments[0]?.dueDate || 'Not recorded'}</dd></div><div><dt>Monthly installments</dt><dd>{amounts.length} months</dd></div><div><dt>Monthly repayment</dt><dd>{amounts.length ? minimum === maximum ? money(minimum) : `${money(minimum)} – ${money(maximum)}` : 'Not recorded'}</dd></div><div className="loan-offer-total"><dt>Total repayment</dt><dd>{money(amounts.reduce((sum, amount) => sum + amount, 0))}</dd></div></dl>;
}
