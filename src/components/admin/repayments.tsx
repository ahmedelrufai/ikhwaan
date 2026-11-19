'use client';
import { useAdminWorkspace } from './admin-context';
import RepaymentDashboard from '@/components/repayment-dashboard';
export default function RepaymentsPage() {
    const { data } = useAdminWorkspace();
    return <><RepaymentDashboard snapshot={data.repaymentDashboard} members={data.members}/></>;
}
