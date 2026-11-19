import * as yup from 'yup';
export const bankDetailsSchema = yup.object({
    bankName: yup.string().trim().required('Bank name is required.').min(2, 'Enter a valid bank name.').max(150, 'Bank name: maximum 150 characters.'),
    accountName: yup.string().trim().required('Account name is required.').min(2, 'Enter a valid account name.').max(150, 'Account name: maximum 150 characters.'),
    accountNumber: yup.string().transform((value, original) => typeof original === 'string' ? value : original).trim()
        .typeError('Enter a 10-digit account number.').required('Account number is required.').matches(/^[0-9]{10}$/, 'Enter a 10-digit account number.'),
});
export function validateBankDetails(input: Record<string, unknown>) {
    return bankDetailsSchema.validateSync(input, { stripUnknown: true });
}
