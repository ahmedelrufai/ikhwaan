'use client';
import { createContext, useContext, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { electionView } from '@/lib/admin';
import type { Member, Loan, State, Payment, Dividend } from '@/lib/store';
export type PortalData = {
    loanPolicy: { documentRequired: boolean }; loanRepayments: NonNullable<State['loanRepayments']>; loanApprovals: NonNullable<State['loanApprovals']>;
    dividends: Dividend[]; elections: ReturnType<typeof electionView>[]; payments: Payment[]; paymentsEnabled: boolean; loanRepaymentsEnabled: boolean; membershipFee: number;
    member: Omit<Member, 'password'>; transactions: State['transactions']; loans: Loan[]; withdrawals: State['withdrawals']; announcements: State['announcements'];
};
type PortalContextValue = {
    data: PortalData; member: PortalData['member']; savings: number; contributions: number; dividendTotal: number;
    months: { label: string; savings: number; contributions: number }[]; chartMax: number; hasActiveApplication: boolean;
    busy: boolean; error: string; search: string; setSearch: Dispatch<SetStateAction<string>>; setError: Dispatch<SetStateAction<string>>; setModal: Dispatch<SetStateAction<string>>;
    action: (payload: Record<string, unknown>, inline?: boolean) => Promise<boolean>;
    applyForLoan: (draft?: Loan | null) => void; navigate: (name: string) => void;
    startPayment: () => Promise<void>; verifyPayment: (reference: string) => Promise<void>; transactionTable: ReactNode;
};
export const MemberPortalContext = createContext<PortalContextValue | null>(null);
export function useMemberPortal() {
    const value = useContext(MemberPortalContext);
    if (!value) throw new Error('Member pages must be rendered in the portal layout.');
    return value;
}
export const money = (kobo: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(kobo / 100);
export const date = (value: string) => new Date(value).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric' });
