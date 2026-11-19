import type { Loan } from './store.ts';
export function calculateLoanInterest(principal: number, rate: unknown = '0') {
    const value = String(rate);
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(value) || Number(value) > 100) throw new Error('Enter an interest rate from 0 to 100 with up to 2 decimal places.');
    if (!Number.isSafeInteger(principal) || principal <= 0) throw new Error('Enter a positive approved amount.');
    const basisPoints = Math.round(Number(value) * 100);
    const interestAmount = Math.round(principal * basisPoints / 10000);
    return { interestRate: basisPoints / 100, interestAmount, totalRepayment: principal + interestAmount };
}
export function loanRepaymentTotal(loan: Loan) { return loan.terms?.totalRepayment ?? loan.terms?.approvedAmount ?? loan.amount; }
export function loanRepaymentBalance(loan: Loan) { return ['Disbursed', 'Repaying'].includes(loan.status) ? Math.max(0, loanRepaymentTotal(loan) - (loan.repaid || 0)) : 0; }
