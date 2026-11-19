'use client';
import { useMemberPortal, money } from './portal-context';
import { ArrowDownToLine, Search, Users, Wallet } from 'lucide-react';
export default function SavingsPage() {
    const { savings, contributions, search, setSearch, transactionTable } = useMemberPortal();
    return <><><div className="two-stats"><article className="panel balance"><Wallet /><span>Special savings</span><h2>{money(savings)}</h2></article><article className="panel balance"><Users /><span>Contributions</span><h2>{money(contributions)}</h2></article></div><section className="panel"><div className="panel-heading"><h2>Your statement</h2><a className="button secondary" href="/api/portal?export=statement"><ArrowDownToLine size={16}/>Download CSV</a></div><label className="search-field"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transactions"/></label>{transactionTable}</section></></>;
}
