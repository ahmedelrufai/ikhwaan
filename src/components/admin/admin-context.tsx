'use client';
import { createContext, useContext, type Dispatch, type SetStateAction, type ReactNode, type FormEvent } from 'react';
import type { repaymentDashboard } from '@/lib/repayment-dates';
import type { paginate } from '@/lib/pagination';
import type { Member, State, Dividend } from '@/lib/store';
import type { electionView } from '@/lib/admin';
export type AdminData = Omit<State, 'members' | 'elections' | 'dividends' | 'loans'> & {
    section?: string; pageMeta?: import('@/lib/admin-read').AdminPageMeta; memberTotal?: number; loanSummary?: import('@/lib/admin-read').LoanSummary;
    repaymentDashboard: ReturnType<typeof repaymentDashboard>; loanPolicyManager: boolean;
    loanEmailStatus?: { configured: boolean; pending: number; failed: number; sent: number };
    officials: Omit<Member, 'password'>[]; loans: (State['loans'][number] & { queueClosed?: boolean; overdue?: number })[];
    paymentProviderConfigured: boolean; actor: Omit<Member, 'password'>; members: Omit<Member, 'password'>[];
    elections: ReturnType<typeof electionView>[]; dividends: Dividend[];
};
type Paginated<T> = ReturnType<typeof paginate<T>>;
type AdminContextValue = {
    data: AdminData; busy: boolean; search: string; statusFilter: string;
    setSearch: Dispatch<SetStateAction<string>>; setStatusFilter: Dispatch<SetStateAction<string>>;
    memberId?: string; loanId?: string; selectedMember?: AdminData['members'][number]; selectedLoan?: AdminData['loans'][number];
    visibleMembers: AdminData['members']; memberPage: Paginated<AdminData['members'][number]>;
    pendingMembers: AdminData['members']; pendingLoans: AdminData['loans']; loans: AdminData['loans']; loanPage: Paginated<AdminData['loans'][number]>;
    activities: State['audit']; filteredActivities: State['audit']; auditPage: Paginated<State['audit'][number]>;
    memberName: (id: string) => string; matches: (text: string) => boolean;
    selectMember: ReactNode; saveButton: ReactNode;
    pagination: (result: ReturnType<typeof paginate>, label: string) => ReactNode;
    activityRow: (activity: State['audit'][number]) => ReactNode;
    changeView: (name: string) => void;
    mutate: (payload: Record<string, unknown>, form?: HTMLFormElement) => Promise<void>;
    submit: (action: string) => (event: FormEvent<HTMLFormElement>) => Promise<void>;
};
export const AdminContext = createContext<AdminContextValue | null>(null);
export function useAdminWorkspace() {
    const value = useContext(AdminContext);
    if (!value) throw new Error('Admin pages must be rendered in the administration layout.');
    return value;
}
export const money = (amount: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount / 100);
export const date = (value: string) => new Date(value).toLocaleString('en-GB', { timeZone: 'Africa/Lagos' });
export function Empty({ children = 'No records yet.' }: { children?: ReactNode }) { return <div className="empty">{children}</div>; }
