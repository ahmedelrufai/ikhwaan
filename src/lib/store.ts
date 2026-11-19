import { mongoClient } from './mongodb.ts';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
export type BankAccount = {
    bankName: string;
    accountName: string;
    accountNumber: string;
    savedAt: string;
};
export type Office = 'President' | 'Secretary General' | 'Treasurer' | 'Financial Secretary';
export type ApprovalCombination = 'A only' | 'B only' | 'Either A or B' | 'A+B' | 'All four';
export type LoanPolicy = {
    approvalOffices?: Office[];
    disbursementOffices?: Office[];
    approvalCombination: ApprovalCombination;
    disbursementCombination?: ApprovalCombination;
    documentRequired: boolean;
    configuredAt: string;
};
export type LoanApproval = {
    id: string;
    loanId: string;
    actorId: string;
    office: Office;
    cycle?: number;
    stage: 'Financial review' | 'Availability review' | 'Approval' | 'Disbursement';
    decision: 'Approved' | 'Rejected';
    note: string;
    createdAt: string;
};
export type LoanRepayment = {
    id: string;
    loanId: string;
    memberId: string;
    amount: number;
    reference: string;
    date: string;
    recordedBy: string;
};
export type LoanTerms = {
    interestRate?: number;
    interestAmount?: number;
    totalRepayment?: number;
    approvedAmount: number;
    repaymentTerms: string;
    installments: {
        dueDate: string;
        amount: number;
    }[];
    recordedBy: string;
    recordedAt: string;
};
export type Member = {
    id: string;
    number: string;
    name: string;
    email: string;
    password: string; // Legacy hashes retained for storage compatibility; public sign-in uses email OTP.
    profileStatus?: 'Incomplete' | 'Submitted';
    emailVerifiedAt?: string;
    role: 'member' | 'admin' | 'electoral';
    status: string;
    phone: string;
    address: string;
    occupation: string;
    officeAddress: string;
    nationality: string;
    state: string;
    lga: string;
    gender: string;
    kinName: string;
    kinRelationship: string;
    kinAddress: string;
    kinPhone: string;
    kinEmail: string;
    outstanding: number;
    sessionVersion?: number;
    bankAccount?: BankAccount;
    office?: Office;
    managesLoanPolicy?: boolean;
};
export type Loan = {
    policySnapshot?: LoanPolicy;
    reference?: string;
    reviewCycle?: number;
    termsHistory?: LoanTerms[];
    submittedAt?: string;
    updatedAt?: string;
    expiresAt?: string;
    repaymentPreference?: string;
    proposedRepaymentDate?: string;
    declarationAcceptedAt?: string;
    supportingDocumentId?: string;
    terms?: LoanTerms;
    termsAcceptedAt?: string;
    termsDeclinedAt?: string;
    pendingDisbursement?: {
        reference: string;
        date: string;
    };
    exception?: {
        authorizedBy: string;
        note: string;
        createdAt: string;
    };
    disbursement?: {
        reference: string;
        date: string;
        recordedBy: string;
        verifiedAt: string;
    };
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    id: string;
    memberId: string;
    amount: number;
    reason: string;
    status: string;
    createdAt: string;
    queue: number;
    period: string;
    cancelledAt?: string;
    reviewedAt?: string;
    decisionNote?: string;
    disbursedAt?: string;
    repaid?: number;
};
export type Payment = {
    purpose?: 'Membership fee' | 'Loan repayment';
    loanId?: string;
    customerEmail?: string;
    reconciliationStatus?: 'Applied' | 'Needs review';
    reconciliationNote?: string;
    id: string;
    memberId: string;
    reference: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
    verifiedAt?: string;
    checkoutUrl?: string;
};
export type Election = {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    candidates: {
        id: string;
        name: string;
    }[];
    votes: {
        memberId: string;
        candidateId: string;
    }[];
    status: 'Scheduled' | 'Cancelled' | 'Published';
};
export type Dividend = {
    id: string;
    memberId: string;
    amount: number;
    period: string;
    createdAt: string;
};
export type State = {
    emailOtps?: import('./email-otp.ts').EmailOtp[];
    memberProfiles?: import('./profiles.ts').MemberProfile[];
    loanEmails?: import('./loan-notifications.ts').LoanEmail[];
    loanPolicy?: LoanPolicy;
    loanApprovals?: LoanApproval[];
    loanRepayments?: LoanRepayment[];
    loanExceptions?: {
        policySnapshot?: LoanPolicy;
        id: string;
        memberId: string;
        authorizedBy: string;
        note: string;
        createdAt: string;
        usedByLoanId?: string;
        signatures?: {
            actorId: string;
            office: Office;
        }[];
    }[];
    paymentSettings?: {
        enabled: boolean;
        membershipFee: number;
    };
    elections?: Election[];
    dividends?: Dividend[];
    payments?: Payment[];
    members: Member[];
    loans: Loan[];
    withdrawals: {
        id: string;
        memberId: string;
        reason: string;
        createdAt: string;
        eligibleAt: string;
        status: string;
    }[];
    announcements: {
        id: string;
        title: string;
        body: string;
        category: string;
        createdAt: string;
    }[];
    transactions: {
        id: string;
        memberId: string;
        date: string;
        description: string;
        type: string;
        amount: number;
        status: string;
        reference?: string;
        loanId?: string;
    }[];
    audit: {
        id: string;
        actor: string;
        subject?: {
            type: 'member' | 'loan';
            id: string;
        };
        action: string;
        createdAt: string;
    }[];
};
export function hash(password: string) { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; }
export function verify(password: string, stored: string) { const [salt, key] = stored.split(':'); const supplied = scryptSync(password, salt, 64); const actual = Buffer.from(key, 'hex'); return actual.length === supplied.length && timingSafeEqual(supplied, actual); }
export function emptyState(): State { return { members: [], loans: [], withdrawals: [], announcements: [], transactions: [], audit: [] }; }
type StateDocument = {
    _id: string;
    revision: number;
    data: State;
};
export type StateField = keyof State;
const localQueues = new Map<string, Promise<void>>();
/** Reads run concurrently; Mongo writes still use revision checks and local writes remain serialized. */
export async function withState<T>(fn: (state: State) => T | Promise<T>, write = false, fields?: StateField[]): Promise<T> {
    if (write && fields)
        throw new Error('Writes require the complete state.');
    if (process.env.MONGODB_URI) {
        const key = 'mongo:' + process.env.MONGODB_URI + ':' + (process.env.MONGODB_DB || 'ikhwaan');
        let release: (() => void) | undefined, pending: Promise<void> | undefined;
        if (write) {
            const previous = localQueues.get(key) || Promise.resolve();
            pending = new Promise<void>(resolve => { release = resolve; });
            localQueues.set(key, pending);
            await previous;
        }
        try {
            const client = await mongoClient();
            const collection = client.db(process.env.MONGODB_DB || 'ikhwaan').collection<StateDocument>('portal');
            const projection = fields ? Object.fromEntries(['revision', ...fields.map(field => `data.${field}`)].map(field => [field, 1])) : undefined;
            let doc = await collection.findOne({ _id: 'state' }, { projection });
            if (!doc) {
                if (!write)
                    return fn(emptyState());
                await collection.updateOne({ _id: 'state' }, { $setOnInsert: { revision: 0, data: emptyState() } }, { upsert: true });
                doc = await collection.findOne({ _id: 'state' });
            }
            const state = fields ? Object.assign(emptyState(), doc!.data) : doc!.data;
            const result = await fn(state);
            if (write) {
                const updated = await collection.updateOne({ _id: 'state', revision: doc!.revision }, { $set: { data: state }, $inc: { revision: 1 } });
                if (!updated.modifiedCount)
                    throw new Error('Another update was made. Please retry.');
            }
            return result;
        }
        finally {
            release?.();
            if (pending && localQueues.get(key) === pending)
                localQueues.delete(key);
        }
    }
    if (process.env.NODE_ENV === 'production')
        throw new Error('MongoDB must be configured in production.');
    const directory = process.env.PORTAL_DATA_DIR || path.join(process.cwd(), '.data');
    const file = path.join(directory, 'portal.json');
    const previous = localQueues.get(file) || Promise.resolve();
    let pending: Promise<void> | undefined, release: (() => void) | undefined;
    if (write) {
        pending = new Promise<void>(resolve => { release = resolve; });
        localQueues.set(file, pending);
    }
    await previous;
    try {
        let state: State;
        try {
            state = JSON.parse(await readFile(file, 'utf8'));
        }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
                throw error;
            state = emptyState();
        }
        const result = await fn(state);
        if (write) {
            await mkdir(directory, { recursive: true });
            await writeFile(`${file}.tmp`, JSON.stringify(state));
            await rename(`${file}.tmp`, file);
        }
        return result;
    }
    finally {
        release?.();
        if (pending && localQueues.get(file) === pending)
            localQueues.delete(file);
    }
}
/** Session checks fetch just the matching account rather than the complete state document. */
export async function memberForSession(id: string, version: number) {
    if (!process.env.MONGODB_URI)
        return withState(state => state.members.find(member => member.id === id && (member.sessionVersion || 0) === version) || null);
    const client = await mongoClient();
    const doc = await client.db(process.env.MONGODB_DB || 'ikhwaan').collection<StateDocument>('portal').aggregate<{ member?: Member }>([
        { $match: { _id: 'state' } },
        { $project: {
            _id: 0,
            member: { $arrayElemAt: [
                { $filter: { input: { $ifNull: ['$data.members', []] }, as: 'member', cond: { $eq: ['$$member.id', { $literal: id }] } } },
                0,
            ] },
        } },
    ]).next();
    const member = doc?.member;
    return member && (member.sessionVersion || 0) === version ? member : null;
}
export function audit(state: State, actor: string, action: string, subject?: {
    type: 'member' | 'loan';
    id: string;
}) { state.audit.unshift({ id: randomUUID(), actor, action, createdAt: new Date().toISOString(), ...(subject ? { subject } : {}) }); }
export function publicMember(member: Member) { const { password, ...safe } = member; void password; return safe; }
