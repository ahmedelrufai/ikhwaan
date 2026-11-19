import { lagosDateKey, validDateKey } from './repayment-dates.ts';
import * as yup from 'yup';
export const loanRequestSchema = yup.object({
    amount: yup.string().trim().required('Amount is required.').max(30),
    reason: yup.string().trim().required('Reason is required.').max(2000, 'Reason: maximum 2,000 characters.'),
    proposedRepaymentDate: yup.string().required('Choose a repayment date.').test('date', 'Choose a valid repayment date.', value => !!value && validDateKey(value)).test('future', 'Repayment date cannot be in the past.', function(value) { const now = this.options.context?.now ? new Date(this.options.context.now) : new Date(); return !!value && value >= lagosDateKey(now); }),
    declaration: yup.boolean().oneOf([true], 'Accept the declaration.').required('Accept the declaration.'),
});
export const LOAN_STATUSES = ['Draft', 'Pending', 'Under Review', 'Approved', 'Rejected', 'Awaiting Disbursement', 'Disbursed', 'Repaying', 'Completed', 'Cancelled'];
export const OFFICES = ['President', 'Secretary General', 'Treasurer', 'Financial Secretary'] as const;
