'use client';
import { useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

const options = ['Male', 'Female'];
export default function GenderSelect({ defaultValue = '' }: { defaultValue?: string }) {
    const id = useId();
    const trigger = useRef<HTMLButtonElement>(null);
    const [value, setValue] = useState(defaultValue);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    function choose(index: number) { setValue(options[index]); setOpen(false); trigger.current?.focus(); }
    return <span className="gender-select" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
        <select className="gender-native" name="gender" required value={value} tabIndex={-1} aria-hidden="true" onChange={e => setValue(e.target.value)} onInvalid={e => { e.preventDefault(); setOpen(true); trigger.current?.focus(); }}><option value="">Select gender</option>{options.map(option => <option key={option}>{option}</option>)}</select>
        <button ref={trigger} type="button" className="gender-trigger" role="combobox" aria-label="Gender" aria-required="true" aria-expanded={open} aria-controls={id} aria-activedescendant={open ? `${id}-${active}` : undefined} onClick={() => { setActive(Math.max(0, options.indexOf(value))); setOpen(!open); }} onKeyDown={e => {
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) { e.preventDefault(); setOpen(true); setActive(e.key === 'Home' ? 0 : e.key === 'End' ? 1 : !open ? Math.max(0, options.indexOf(value)) : (active + 1) % options.length); }
            else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
            else if (open && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); choose(active); }
            else if (e.key.toLowerCase() === 'm' || e.key.toLowerCase() === 'f') { e.preventDefault(); setOpen(true); setActive(e.key.toLowerCase() === 'm' ? 0 : 1); }
        }}><span className={value ? '' : 'gender-placeholder'}>{value || 'Select gender'}</span><ChevronDown size={17}/></button>
        {open && <span id={id} role="listbox" aria-label="Gender" className="gender-options">{options.map((option, index) => <span key={option} id={`${id}-${index}`} role="option" aria-selected={value === option} className={active === index ? 'highlighted' : ''} onMouseEnter={() => setActive(index)} onMouseDown={e => e.preventDefault()} onClick={() => choose(index)}>{option}{value === option && <Check size={16}/>}</span>)}</span>}
    </span>;
}
