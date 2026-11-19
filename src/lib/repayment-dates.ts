import type { Loan } from './store.ts';
export function lagosDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}-${parts.find(p => p.type === 'day')!.value}`;
}
export function validDateKey(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function installmentProgress(loan: Loan, now = new Date()) {
    const today = lagosDateKey(now);
    let available = Math.max(0, loan.repaid || 0);
    const funded = ['Disbursed', 'Repaying', 'Completed', 'Repaid'].includes(loan.status);
    return [...(loan.terms?.installments || [])].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((installment, index) => {
        const paid = Math.min(available, installment.amount); available -= paid;
        const outstanding = installment.amount - paid;
        const status = !funded ? 'Scheduled' : !outstanding ? 'Paid' : installment.dueDate < today ? 'Overdue' : installment.dueDate === today ? 'Due today' : 'Upcoming';
        return { loanId: loan.id, memberId: loan.memberId, reference: loan.reference || loan.id, installment: index + 1, dueDate: installment.dueDate, amount: installment.amount, paid, outstanding, status };
    });
}
export function repaymentDashboard(loans: Loan[], now = new Date()) {
    const today = lagosDateKey(now), limit = new Date(`${today}T00:00:00Z`); limit.setUTCDate(limit.getUTCDate() + 7);
    const nextWeek = limit.toISOString().slice(0, 10);
    const rows = loans.filter(l => ['Disbursed', 'Repaying'].includes(l.status)).flatMap(l => installmentProgress(l, now)).filter(r => r.outstanding > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.reference.localeCompare(b.reference));
    const overdue = rows.filter(r => r.status === 'Overdue'), dueToday = rows.filter(r => r.status === 'Due today'), upcoming = rows.filter(r => r.status === 'Upcoming' && r.dueDate <= nextWeek);
    const total = (items: typeof rows) => items.reduce((sum, row) => sum + row.outstanding, 0);
    return { today, nextWeek, rows, overdue: total(overdue), dueToday: total(dueToday), upcoming: total(upcoming), overdueCount: overdue.length, dueTodayCount: dueToday.length };
}
